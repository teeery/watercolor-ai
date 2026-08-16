// 空间水库（brush dynamics v2 §4）——tip/belly/heel 三深度桶 + 毛细回补 + 负通量 + 守恒
// 纯逻辑、无 RNG（确定性由构造保证）；全部常数见 docs/brush-dynamics.md §11 初值表。
// 关键方程（v2 §4）：
//   dt      = min(Δs / max(v, vMin), dtMax)
//   dw      = exposedW · (1 − exp(−kRelease·p·dt))     // 指数释放：自动非负、自动饱和
//   pRelease = exposedP · (dw/cap)·kPig + kDry·exposedP·gb·p
//   gb      = clamp(kBreak · (1 − wTotal/cap)^γ · (0.4 + 0.6v), 0, 1)

export const RESERVOIR_CONSTANTS = {
  kRelease: 1.2,     // 指数释放率 s⁻¹
  dtMax: 0.8,        // 停笔毛细释放上限 s
  vMin: 0.02,        // 速度下钳
  kPig: 0.7,         // 颜料随水释放系数
  kDry: 0.35,        // 干笔刮擦留色系数
  kWick: 0.3,        // 湿纸吸水
  kAbsorb: 0.6,      // 湿纸吸收衰减（dynamics 层消费）
  kCapillary: 0.25,  // tip 回补率/戳
  epsHyst: 0.1,      // 吸放迟滞带（Wetbrush 式 12/13 采纳）
  alpha: 0.5,        // 压力对颜料释放的指数
  // 桶配比
  tipFrac: 0.15, bellyFrac: 0.6, heelFrac: 0.25,
  // 压力接触门（smoothstep 区间）
  bellyP: [0.5, 0.7], heelP: [0.8, 0.9],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (p, a, b) => {
  const t = (p - a) / (b - a);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
};

/**
 * @param {object} load   { water, pigment:{amount}, tip:{amount}? }
 * @param {number} cap    笔的持水量（来自 brush.capacity，配方口径）
 * @param {object} kBreak { kBreak, gamma }  飞白强度与陡度（recipe 提供：wet γ=1.5 / dry γ=0.8）
 */
export class Reservoir {
  constructor(load = {}, cap = 1.0, { kBreak = 1.4, gamma = 1.2 } = {}, constants = {}) {
    const C = { ...RESERVOIR_CONSTANTS, ...constants };
    this.C = C;
    this.cap = Math.max(0.05, cap);
    const w0 = Math.max(0, (load.water ?? 0.5) * this.cap);
    this.w0 = w0;
    this.w = {
      tip: w0 * C.tipFrac,
      belly: w0 * C.bellyFrac,
      heel: w0 * C.heelFrac,
    };
    const pBelly = Math.max(0, load.pigment?.amount ?? 0.8);
    const pTip = Math.max(0, load.tip?.amount ?? 0);
    this.p = { tip: pTip, belly: pBelly, heel: pBelly };
    this.p0 = pTip + pBelly * 2;
    this.kBreak = kBreak;
    this.gamma = gamma;
    // 负通量迟滞状态：+1 在吸、-1 在放、0 未定
    this.fluxDir = 0;
    // 记账（数值断言用）
    this.releasedW = 0;
    this.releasedP = 0;
    this.wickedW = 0;
  }

  /** 总余水与总余颜料（未乘桶接触门） */
  totalWater() { return this.w.tip + this.w.belly + this.w.heel; }
  totalPigment() { return this.p.tip + this.p.belly + this.p.heel; }

  /** 压力接触门:tip 常接触、belly p>0.5、heel p>0.8（smoothstep） */
  contactFracs(p) {
    const C = this.C;
    return {
      tip: 1,
      belly: smooth(p, C.bellyP[0], C.bellyP[1]),
      heel: smooth(p, C.heelP[0], C.heelP[1]),
    };
  }

  /** 当前飞白强度（gb 涌现）:水库枯竭 × 速度 */
  grainBreak(v) {
    const dep = 1 - this.totalWater() / this.cap;
    if (dep < 0) dep = 0;
    return clamp01(this.kBreak * Math.pow(dep, this.gamma) * (0.4 + 0.6 * v));
  }

  /** 毛细回补:tip 先出、belly 持续补（每戳） */
  capillary() {
    const k = this.C.kCapillary;
    const move = k * (this.w.belly - this.w.tip);
    if (move > 0) {
      const m = Math.min(move, this.w.belly);
      this.w.tip += m;
      this.w.belly -= m;
    }
  }

  /**
   * 释放一戳。纯函数式更新内部状态。
   * @param {number} p    pressure 0..1
   * @param {number} v    speed（已钳 vMin）
   * @param {number} ds  弧长步（px，网格坐标）
   * @returns {{dw:number, amount:number, gb:number}}
   */
  release(p, v, ds) {
    const C = this.C;
    const dt = Math.min(ds / Math.max(v, C.vMin), C.dtMax);
    const f = this.contactFracs(p);
    const exposedW = this.w.tip * f.tip + this.w.belly * f.belly + this.w.heel * f.heel;
    const exposedP = this.p.tip * f.tip + this.p.belly * f.belly + this.p.heel * f.heel;
    if (exposedW <= 1e-9 || p <= 0) return { dw: 0, amount: 0, gb: this.grainBreak(v) };

    const dw = exposedW * (1 - Math.exp(-C.kRelease * p * dt));
    const gb = this.grainBreak(v);
    const pRelease = exposedP * (dw / this.cap) * C.kPig + C.kDry * exposedP * gb * p;

    // 按各桶贡献比例扣减（守恒由构造保证：dw ≤ exposedW）
    for (const k of ["tip", "belly", "heel"]) {
      const shareW = this.w[k] * f[k] / (exposedW || 1);
      this.w[k] -= dw * shareW;
      const shareP = this.p[k] * f[k] / (exposedP || 1);
      this.p[k] = Math.max(0, this.p[k] - pRelease * shareP);
    }
    this.releasedW += dw;
    this.releasedP += pRelease;
    return { dw, amount: pRelease, gb };
  }

  /**
   * 负通量（纸→笔）:湿纸上吸水进 tip 桶,带迟滞带(ε=0.1)防逐戳抖动。
   * @param {number} paperWet 纸面湿度 0..1（dynamics 层从 engine.W/paper.C 采样）
   */
  wick(p, paperWet, dt) {
    const C = this.C;
    const hyst = C.epsHyst;
    let wet = paperWet;
    if (this.fluxDir === 1) wet = Math.max(0, wet - hyst);      // 正在吸:降门槛防抖
    else if (this.fluxDir === -1) wet = Math.max(0, wet - hyst * 0.5);
    const space = Math.max(0, this.cap - this.totalWater());
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

  /** 数值断言辅助:守恒与否（Σdw ≤ w0 + ε） */
  conservationOK(eps = 1e-6) {
    return this.releasedW <= this.w0 + eps && this.totalWater() >= -eps && this.totalPigment() >= -eps;
  }
}
