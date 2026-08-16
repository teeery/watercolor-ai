// 空间水库(brush dynamics v2 §4)——tip/belly/heel 三深度桶 + 毛细回补 + 负通量 + 守恒
// 纯逻辑、无 RNG(确定性由构造保证);常数初值见 docs/brush-dynamics.md §11。
//
// 口径说明(实现校准,v2.0):
//   引擎 depositMask 的 water/amount 是"每格膜厚"(legacy 一笔 water=0.8、amount≈1.0 直接作用每格)。
//   水库因此用两个口径:
//     - 每戳释放 dw ≈ load.water 量级(0..1,引擎 W 单位),amount ≈ pigment.amount 量级(0..1);
//     - 水库预算 = 释放量 × cap(容量系数,默认 capacity·15),保证一笔 30-60 戳守恒可续。
//   关键方程(§4):
//     dt   = min(Δs / max(v, vMin), dtMax)
//     dw   = min(wLevel·(1 − exp(−kRelease·p·dt))·contactScale, wTotal)   // 指数释放 + 守恒钳
//     pRelease = aLevel·(dw/wLevel)·kPig·fPig + kDry·aLevel·gb·p·fPig     // 颜料随水 + 干笔刮擦
//     gb   = clamp(kBreak · (1 − wTotal/w0)^γ · (0.4 + 0.6v), 0, 1)

export const RESERVOIR_CONSTANTS = {
  kRelease: 1.2,     // 指数释放率 s⁻¹
  dtMax: 1.5,        // 停笔/慢笔释放上限 s(1.5 让"慢=积墨"与中速拉开;击穿由 exposedW 钳兜底)
  vMin: 0.02,        // 速度下钳
  kPig: 0.9,         // 颜料随水释放系数
  kDry: 0.35,        // 干笔刮擦留色系数
  kWick: 0.3,        // 湿纸吸水
  kAbsorb: 0.6,      // 湿纸吸收衰减(dynamics 层消费)
  kCapillary: 0.25,  // tip 回补率/戳
  epsHyst: 0.1,      // 吸放迟滞带(Wetbrush 式 12/13 采纳)
  capFactor: 45,     // 容量 → 水库预算系数(校准:满载笔覆盖 ~1.5-2× 典型笔画,飞白只在尾部涌现)
  // 桶配比
  tipFrac: 0.15, bellyFrac: 0.6, heelFrac: 0.25,
  // 压力接触门(smoothstep 区间;v2.0 校准放宽:轻压也有腹桶参与)
  bellyP: [0.35, 0.6], heelP: [0.65, 0.85],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (p, a, b) => {
  const t = (p - a) / (b - a);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
};

/**
 * @param {object} load   { water, pigment:{amount}, tip:{amount}? }(water 0..1 引擎膜厚口径)
 * @param {number} capacity 笔的持水容量系数(brush.capacity,配方口径)
 * @param {object} kBreak { kBreak, gamma }  飞白强度与陡度(recipe:wet γ=1.5 / dry γ=0.8)
 */
export class Reservoir {
  constructor(load = {}, capacity = 1.0, { kBreak = 1.4, gamma = 1.2 } = {}, constants = {}) {
    const C = { ...RESERVOIR_CONSTANTS, ...constants };
    this.C = C;
    this.wLevel = Math.max(0.02, load.water ?? 0.5);          // 每戳水膜基准(引擎单位)
    this.aLevel = Math.max(0.02, load.pigment?.amount ?? 0.8); // 每戳颜料基准
    const cap = Math.max(2, capacity * C.capFactor);
    this.cap = cap;
    this.kBreak = kBreak;
    this.gamma = gamma;
    const w0 = this.wLevel * cap;
    this.w0 = w0;
    this.w = {
      tip: w0 * C.tipFrac,
      belly: w0 * C.bellyFrac,
      heel: w0 * C.heelFrac,
    };
    // 默认颜料按水配比均匀悬浮三桶(轻压只出 tip 也有色);
    // load.tip 覆盖 tip 桶 → charging 渐变(一笔前段 tip 色、后段 belly 色)。
    const pMain = this.aLevel;
    const pTip = Math.max(0, load.tip?.amount ?? pMain * C.tipFrac);
    const pBudget = cap * 0.9; // 颜料预算 ≈ 水预算 ×0.9
    this.p0 = pBudget;
    this.p = {
      tip: pTip / pMain * pBudget * C.tipFrac,
      belly: pBudget * C.bellyFrac,
      heel: pBudget * C.heelFrac,
    };
    this._pTotal = this.p.tip + this.p.belly + this.p.heel;
    // 负通量迟滞状态:+1 在吸、-1 在放、0 未定
    this.fluxDir = 0;
    // 记账(数值断言用)
    this.releasedW = 0;
    this.releasedP = 0;
    this.wickedW = 0;
  }

  totalWater() { return this.w.tip + this.w.belly + this.w.heel; }
  totalPigment() { return this.p.tip + this.p.belly + this.p.heel; }

  /** 压力接触门:tip 常接触、belly p>0.35、heel p>0.65(smoothstep,校准放宽) */
  contactFracs(p) {
    const C = this.C;
    return {
      tip: 1,
      belly: smooth(p, C.bellyP[0], C.bellyP[1]),
      heel: smooth(p, C.heelP[0], C.heelP[1]),
    };
  }

  /** 当前飞白强度(gb 涌现):水库枯竭 × 速度 */
  grainBreak(v) {
    let dep = 1 - this.totalWater() / this.w0;
    if (dep < 0) dep = 0;
    return clamp01(this.kBreak * Math.pow(dep, this.gamma) * (0.4 + 0.6 * v));
  }

  /** 毛细回补:tip 先出、belly 持续补;颜料悬浮在水里,随水势梯度沿 depth 链迁移(heel→belly→tip) */
  capillary() {
    const k = this.C.kCapillary;
    // tip ← belly
    let moveW = k * (this.w.belly - this.w.tip);
    if (moveW > 0) {
      const m = Math.min(moveW, this.w.belly);
      const share = this.w.belly > 0 ? m / this.w.belly : 0;
      const mp = this.p.belly * share * 0.8;
      this.w.tip += m; this.w.belly -= m;
      this.p.tip += mp; this.p.belly -= mp;
    }
    // belly ← heel
    moveW = k * (this.w.heel - this.w.belly);
    if (moveW > 0) {
      const m = Math.min(moveW, this.w.heel);
      const share = this.w.heel > 0 ? m / this.w.heel : 0;
      const mp = this.p.heel * share * 0.8;
      this.w.belly += m; this.w.heel -= m;
      this.p.belly += mp; this.p.heel -= mp;
    }
  }

  /**
   * 释放一戳(纯函数式更新内部状态)。水与颜料各自独立受接触门控制:
   * 干笔水干后仍可靠"刮擦"留色——颜料不随水膜缩水(校准 v2.0)。
   * @returns {{dw:number, amount:number, tipShare:number, gb:number}}
   *   tipShare = 本戳释放颜料中 tip 桶占比(charging 混色用:0 = 全 belly 色,1 = 全 tip 色)
   */
  release(p, v, ds) {
    const C = this.C;
    const dt = Math.min(ds / Math.max(v, C.vMin), C.dtMax);
    const f = this.contactFracs(p);
    const wTotal = this.totalWater();
    const exposedW = this.w.tip * f.tip + this.w.belly * f.belly + this.w.heel * f.heel;
    const pTotal = this.totalPigment();
    const exposedP = this.p.tip * f.tip + this.p.belly * f.belly + this.p.heel * f.heel;
    const gb = this.grainBreak(v);
    if (p <= 0 || (wTotal <= 1e-9 && pTotal <= 1e-9)) return { dw: 0, amount: 0, tipShare: 0, gb };

    // —— 水:指数释放 + 守恒钳 ——
    let dw = 0;
    if (exposedW > 1e-9) {
      const contactScale = 0.7 + 0.3 * (exposedW / Math.max(wTotal, 1e-9));
      dw = this.wLevel * (1 - Math.exp(-C.kRelease * p * dt)) * contactScale;
      if (dw > exposedW) dw = exposedW; // 守恒钳:只有接触到的水能释放(未接触桶不可透支)
      for (const k of ["tip", "belly", "heel"]) {
        this.w[k] = Math.max(0, this.w[k] - dw * (this.w[k] * f[k] / exposedW));
      }
    }

    // —— 颜料:装载浓度口径,独立于水;随余量衰减 + 干笔刮擦 ——
    let pRelease = 0, tipShare = 0;
    if (exposedP > 1e-9) {
      const fPig = exposedP / Math.max(pTotal, 1e-9);
      const loadFrac = wTotal / Math.max(this.w0, 1e-9);
      pRelease = this.aLevel * fPig * (0.4 + 0.5 * loadFrac + 0.3 * gb * p) * C.kPig;
      if (pRelease > exposedP) pRelease = exposedP;
      tipShare = (this.p.tip * f.tip) / exposedP;
      for (const k of ["tip", "belly", "heel"]) {
        this.p[k] = Math.max(0, this.p[k] - pRelease * (this.p[k] * f[k] / exposedP));
      }
    }

    this.releasedW += dw;
    this.releasedP += pRelease;
    return { dw, amount: pRelease, tipShare, gb };
  }

  /** 负通量(纸→笔):湿纸上吸水进 tip 桶,带迟滞带(ε=0.1)防逐戳抖动。 */
  wick(p, paperWet, dt) {
    const C = this.C;
    const hyst = C.epsHyst;
    let wet = paperWet;
    if (this.fluxDir === 1) wet = Math.max(0, wet - hyst);
    else if (this.fluxDir === -1) wet = Math.max(0, wet - hyst * 0.5);
    const space = Math.max(0, this.cap * 0.3 - this.w.tip); // tip 桶有独立上限
    const dw = Math.min(space, C.kWick * wet * p * dt);
    if (dw > 1e-9) {
      this.w.tip += dw;
      this.wickedW += dw;
      this.fluxDir = 1;
    } else if (paperWet < hyst) {
      this.fluxDir = -1;
    }
    return dw;
  }

  /** 数值断言辅助:守恒与否(释放 ≤ 初始装水 + 湿纸吸回;wick 吸回的水可再释放,物理正确) */
  conservationOK(eps = 1e-6) {
    return this.releasedW <= this.w0 + this.wickedW + eps && this.totalWater() >= -eps && this.totalPigment() >= -eps;
  }
}
