// 笔触层：stroke 协议 → 形状 mask → 引擎沉积注入
// 形状：有机 blob（fbm 扰动椭圆）、手绘线（抖动盖章）、溅点
// 注意：mask 与引擎网格同为左上原点（y 向下）
// v2.0：新增新管线分流——stroke 带 brush/motion/load.tip/interleave 任一字段 → BrushState
// （笔刷动力学,见 docs/brush-dynamics.md）;legacy 路径原代码冻结。
import { mulberry32 } from "../paper/prng.js";
import { fbm2D, valueNoise2D } from "../paper/noise.js";
import { isNewPipeline } from "./brush.js";
import { BrushState } from "./dynamics.js";

export class StrokePainter {
  constructor(engine, { seed = 1, colorSystem = null } = {}) {
    this.eng = engine;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.mask = new Float32Array(engine.n);
    this.mask2 = new Float32Array(engine.n);
    this._lastRibbon = null; // 最近一次 ribbon 的 mask（供 clip: "last-ribbon" 用）
    this.colorSystem = colorSystem; // ColorSystem 实例（缺省 → RGB 兜底基）
    this._brushSeq = 0;            // 新管线每笔索引（per-stroke RNG 流 = painterSeed ^ strokeIndex）
    this.lastBrushState = null;    // 最近一次新管线 BrushState（brush-lab 断言用）
  }

  clear() { this.mask.fill(0); }
  /** 有机 blob：椭圆 + 角度域多倍频 fbm 扰动 + 软边（小 blob 减小扰动避免海胆感） */
  blob(cx, cy, rx, ry, { jag = 0.22, soft = 9 } = {}) {
    const { w, h } = this.eng;
    this.clear();
    const jagEff = jag * Math.min(1, Math.min(rx, ry) / 90);
    const x0 = Math.max(0, Math.floor(cx - rx - soft - 10));
    const x1 = Math.min(w - 1, Math.ceil(cx + rx + soft + 10));
    const y0 = Math.max(0, Math.floor(cy - ry - soft - 10));
    const y1 = Math.min(h - 1, Math.ceil(cy + ry + soft + 10));
    const sigma = soft / Math.max(4, Math.min(rx, ry)); // 归一化软边宽
    const sx = 1 / rx, sy = 1 / ry;
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) * sx, dy = (y - cy) * sy;
        const d = Math.sqrt(dx * dx + dy * dy);
        let wob = 1;
        if (d > 0.02) {
          const ang = Math.atan2(dy, dx);
          // 多倍频小扰动 + 一个低频大叶（避免多边形感）
          const n1 = fbm2D(cx * 0.02 + ang * 2.6, cy * 0.02 + ang * 4.1, { octaves: 6, seed: 7 });
          const n2 = fbm2D(cx * 0.006 + ang * 1.1, cy * 0.006 + ang * 1.6, { octaves: 3, seed: 19 });
          wob = 1 + jagEff * ((n1 - 0.5) * 1.2 + (n2 - 0.5) * 0.7);
        }
        const m = (0.5 - (d - wob) / (2 * sigma + 1e-6));
        this.mask[row + x] = m < 0 ? 0 : m > 1 ? 1 : m;
      }
    }
    return this.mask;
  }

  /** 条带笔触（ribbon）：沿路径扫出的湿铺条带，宽度随路径线性插值，
   *  边缘沿程抖动 → 有起收笔和宽窄变化的手绘扫笔感（协议层"为什么都是圆的"的解药） */
  ribbon(path, { radius = 40, radiusEnd = null, soft = 8, jag = 0.14 } = {}) {
    const { w, h } = this.eng;
    this.clear();
    const rEnd = radiusEnd ?? radius;
    // Chaikin 圆角平滑 ×2：消掉折线顶点的尖角
    let pts = path;
    for (let iter = 0; iter < 2; iter++) {
      if (pts.length <= 2) break;
      const sm = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        sm.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
        sm.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      sm.push(pts[pts.length - 1]);
      pts = sm;
    }
    const segs = [];
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const len = Math.hypot(bx - ax, by - ay);
      if (len > 0) { segs.push({ ax, ay, bx, by, len }); total += len; }
    }
    if (segs.length === 0) return this.blob(pts[0][0], pts[0][1], radius, radius);
    const R = Math.max(radius, rEnd) * (1 + jag) + soft + 6;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of pts) {
      if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
      if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
    }
    bx0 = Math.max(0, Math.floor(bx0 - R)); bx1 = Math.min(w - 1, Math.ceil(bx1 + R));
    by0 = Math.max(0, Math.floor(by0 - R)); by1 = Math.min(h - 1, Math.ceil(by1 + R));
    const invT = 1 / (total + 1e-9);
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        let bestD = Infinity, bestT = 0;
        let acc = 0;
        for (const sg of segs) {
          const dx = x - sg.ax, dy = y - sg.ay;
          const ex = sg.bx - sg.ax, ey = sg.by - sg.ay;
          const e2 = ex * ex + ey * ey;
          let t = (dx * ex + dy * ey) / e2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = sg.ax + ex * t, py = sg.ay + ey * t;
          const d = Math.hypot(x - px, y - py);
          if (d < bestD) { bestD = d; bestT = (acc + t * sg.len) * invT; }
          acc += sg.len;
        }
        // 宽度 = 首尾插值 × 压力包络（入锋窄 → 腹宽 → 收笔提尖）× 沿程抖动
        const rise = Math.min(1, bestT / 0.22);
        const fall = Math.min(1, (1 - bestT) / 0.30);
        const mid = Math.min(rise, fall);
        const belly = 1 - 0.18 * Math.sin(Math.PI * Math.min(1, bestT * 1.1));
        const env = (0.30 + 0.70 * mid) * belly;
        const wid = (radius + (rEnd - radius) * bestT) * env;
        const wob = 1 + jag * (fbm2D(bestT * 4.5 + 9.2, 1.7, { octaves: 3, seed: 23 }) - 0.5) * 2;
        const m = 0.5 - (bestD - wid * wob) / (2 * soft + 1e-6);
        this.mask[y * w + x] = m < 0 ? 0 : m > 1 ? 1 : m;
      }
    }
    this._lastRibbon = this.mask.slice(); // 供后续 clip 使用
    return this.mask;
  }

  /** 沿路径盖章（手绘抖动：间距/半径/干湿/垂直游走；泪滴戳沿笔向，尾部收尖） */
  strokePath(path, radius, { spacing = 0.55, rJitter = 0.25, wJitter = 0.3, soft = 0.5, grainBreak = 0, elongMin = 1.4, elongMax = 2.6 } = {}) {
    const { w, h, paper } = this.eng;
    this.clear();
    const rng = this.rng;
    // 折线长度与累计
    const segs = [];
    let total = 0;
    for (let k = 0; k < path.length - 1; k++) {
      const [ax, ay] = path[k], [bx, by] = path[k + 1];
      const len = Math.hypot(bx - ax, by - ay);
      segs.push({ ax, ay, bx, by, len });
      total += len;
    }
    const nStamps = Math.max(1, Math.round(total / (radius * spacing)));
    for (let s = 0; s <= nStamps; s++) {
      // 间距抖动：打破等距行列感
      const target = (s + (rng() - 0.5) * 0.55) / nStamps * total;
      const tClamp = target < 0 ? 0 : target > total ? total : target;
      let acc = 0, x = path[0][0], y = path[0][1], dirX = 1, dirY = 0;
      for (const sg of segs) {
        if (acc + sg.len >= tClamp) {
          const t = (tClamp - acc) / (sg.len + 1e-9);
          x = sg.ax + (sg.bx - sg.ax) * t;
          y = sg.ay + (sg.by - sg.ay) * t;
          dirX = (sg.bx - sg.ax) / (sg.len + 1e-9);
          dirY = (sg.by - sg.ay) / (sg.len + 1e-9);
          break;
        }
        acc += sg.len;
      }
      // 笔向角抖动：dab 朝向不完全一致（更手绘）
      const angJit = (rng() - 0.5) * 0.35;
      const cJ = Math.cos(angJit), sJ = Math.sin(angJit);
      const dJX = dirX * cJ - dirY * sJ, dJY = dirX * sJ + dirY * cJ;
      x += (rng() - 0.5) * 2 * radius * wJitter;
      y += (rng() - 0.5) * 2 * radius * wJitter;
      const r = radius * (1 + (rng() - 0.5) * 2 * rJitter);
      const elong = elongMin + rng() * (elongMax - elongMin); // 笔向拉长
      const hard = soft * (0.5 + rng() * 1.2);   // 每戳硬度不一
      this._stampEllipse(x, y, r, r * elong, dJX, dJY, hard, grainBreak);
    }
    return this.mask;
  }

  /** 泪滴戳（沿笔向；头圆尾尖；grainBreak>0 时按沿笔势条状噪声打碎 → 飞白） */
  _stampEllipse(cx, cy, rA, rB, dirX, dirY, softPx, grainBreak) {
    const { w, h, paper } = this.eng;
    const R = Math.max(rA, rB) + softPx + 2;
    const x0 = Math.max(0, Math.floor(cx - R));
    const x1 = Math.min(w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R));
    const y1 = Math.min(h - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        // 旋转到笔向坐标
        const a = dx * dirX + dy * dirY;   // 沿笔向
        const bb = -dx * dirY + dy * dirX; // 垂直笔向
        const aN = a / rA, bN = bb / rB;
        // 泪滴：头部略圆、尾部收窄成笔锋（真实笔触不是对称椭圆）
        const asym = aN < 0 ? 1.5 : 0.92;
        const d = Math.sqrt((aN * asym) * (aN * asym) + bN * bN);
        const m = 1 - (d - 1) / (softPx / rA + 1e-6);
        if (m <= 0) continue;
        let v = m > 1 ? 1 : m;
        if (grainBreak > 0) {
          // 飞白：沿笔势拉伸的条状噪声（a 压缩 → 枯裂带沿笔向拉长）+ 高频细颗粒
          const streak = valueNoise2D(a * 0.10 + 13.7, bb * 0.55, 77);
          const ff = paper.F[row + x];
          const gf = ff < 0 ? 0 : ff > 1 ? 1 : ff;
          v *= (1 - grainBreak) + grainBreak * (0.15 + 0.75 * streak + 0.5 * (gf - 0.5));
          if (v < 0) v = 0;
        }
        const i = row + x;
        if (v > this.mask[i]) this.mask[i] = v > 1 ? 1 : v;
      }
    }
  }

  /** 溅点：中心 + 高斯散布；尺寸幂律分布（少量大滴 + 多数小点）+ 随机椭圆拉长 */
  spatter(cx, cy, { count = 40, spread = 80, rMin = 0.8, rMax = 7 } = {}) {
    this.clear();
    const rng = this.rng;
    for (let k = 0; k < count; k++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * spread;
      // 幂律：r = rMin + (rMax-rMin) * t^2（小滴居多）
      const t = Math.sqrt(rng());
      const r = rMin + (rMax - rMin) * t;
      const elong = 1 + rng() * 1.6;
      const dir = rng() * Math.PI;
      this._stampEllipse(
        cx + Math.cos(a) * d, cy + Math.sin(a) * d,
        r, r * elong, Math.cos(dir), Math.sin(dir), r * (0.3 + rng() * 0.4), 0,
      );
    }
    return this.mask;
  }

  /** 应用一笔（协议 stroke）：颜料规范 → 颜色系统的每通道 K 基 → 引擎 */
  apply(stroke) {
    // v2.0 新管线分流（spatter/re-wet/lift 维持现算子,不经过水库）
    const specialOps = new Set(["spatter", "re-wet", "lift"]);
    if (isNewPipeline(stroke) && !specialOps.has(stroke.type)) {
      this.applyNew(stroke);
      return;
    }
    const eng = this.eng;
    const pig = stroke.pigment || {};
    // 颜色系统提供 K 基（RGB 3 通道或光谱 16 通道，笔触层不关心维度）
    const K = this.colorSystem ? this.colorSystem.pigmentBasis(pig) : defaultBasis(pig);
    eng.setPigment({
      K,
      granulation: pig.granulation ?? 0.5,
      staining: pig.staining ?? 0.5,
    });
    const water = stroke.water ?? 0.5;
    const amount = pig.amount ?? 0.8;

    switch (stroke.type) {
      case "wet-wash": {
        const layers = stroke.layers ?? 1;
        for (let l = 0; l < layers; l++) {
          if (stroke.path) {
            // 条带扫笔：湿铺沿笔势（宽窄 + 沿程抖动）
            const n = stroke.path.length - 1;
            const last = stroke.path[n];
            this.ribbon(stroke.path, {
              radius: stroke.radius ?? 50,
              radiusEnd: stroke.radiusEnd ?? (stroke.radius ?? 50) * 0.92,
              soft: stroke.hard ? 0.5 : (stroke.soft ?? 7), jag: 0.14,
            });
            eng.depositMask(this.mask, { water, amount: amount / layers, hard: stroke.hard ?? false });
            eng.step(40);
          } else {
            const { cx, cy, rx, ry } = stroke.region;
            // hard(主体物)：软边 0.5 + jag 0.08 → 光滑整圆轮廓（消多边形感）
            this.blob(cx + (this.rng() - 0.5) * rx * 0.2, cy + (this.rng() - 0.5) * ry * 0.2, rx, ry, { jag: stroke.hard ? 0.08 : 0.3, soft: stroke.hard ? 0.5 : (stroke.soft ?? 6) });
            eng.depositMask(this.mask, { water, amount: amount / layers, hard: stroke.hard ?? false });
            eng.step(40);
          }
        }
        break;
      }
      case "glaze": {
        if (stroke.path) {
          this.ribbon(stroke.path, {
            radius: stroke.radius ?? 40,
            radiusEnd: stroke.radiusEnd ?? (stroke.radius ?? 40) * 0.9,
            soft: stroke.soft ?? 9, jag: 0.1,
          });
          eng.depositMask(this.mask, { water: water * 0.7, amount });
        } else {
          const { cx, cy, rx, ry } = stroke.region;
          this.blob(cx, cy, rx, ry, { jag: 0.25, soft: stroke.soft ?? 8 });
          eng.depositMask(this.mask, { water: water * 0.7, amount });
        }
        break;
      }
      case "dry-brush": {
        this.strokePath(stroke.path, stroke.radius ?? 10, {
          spacing: stroke.spacing ?? 0.45, rJitter: 0.3, wJitter: 0.32, soft: 0.4, grainBreak: stroke.grainBreak ?? 0.9,
          elongMin: stroke.elongMin ?? 1.4, elongMax: stroke.elongMax ?? 2.6,
        });
        // 纹理层裁剪在上一条 ribbon 内：dab 不再定义轮廓
        if (stroke.clip === "last-ribbon" && this._lastRibbon) {
          const rb = this._lastRibbon;
          for (let i = 0; i < this.mask.length; i++) this.mask[i] *= rb[i];
        }
        eng.depositMask(this.mask, { water: water * 0.25, amount: amount * 1.4 });
        break;
      }
      case "spatter": {
        const { cx, cy } = stroke.center;
        this.spatter(cx, cy, { count: stroke.count ?? 40, spread: stroke.spread ?? 80 });
        eng.depositMask(this.mask, { water: water * 0.5, amount: amount * 0.8 });
        break;
      }
      case "re-wet": {
        const { cx, cy, rx, ry } = stroke.region;
        this.blob(cx, cy, rx, ry, { jag: 0.15, soft: 4 });
        // 先把颜料推开（回流开花核心算子），再注清水
        const rad = (rx + ry) / 2;
        eng.pushPigmentRadial(cx, cy, rad, stroke.push ?? rad * 1.8);
        eng.depositMask(this.mask, { water, amount: 0 }); // 清水
        break;
      }
      case "lift": {
        const { cx, cy, rx, ry } = stroke.region;
        this.blob(cx, cy, rx, ry, { jag: 0.2, soft: 6 });
        eng.liftMask(this.mask, {
          liftP: stroke.liftP ?? 0.6, liftD: stroke.liftD ?? 0.35, water: 0.3,
          dir: stroke.dir ?? 0,
          push: stroke.push ?? 0.5, // M4：边缘堆挤
        });
        break;
      }
      case "salt": {
        // M4 盐花：在湿区撒盐晶（幂律尺寸 + 高斯散布），每颗盐吸色推色成星形亮斑
        const { cx, cy } = stroke.center ?? { cx: 320, cy: 240 };
        const count = stroke.count ?? 14, spread = stroke.spread ?? 60;
        for (let s = 0; s < count; s++) {
          const a = this.rng() * Math.PI * 2;
          const d = Math.sqrt(this.rng()) * spread;
          const t = Math.sqrt(this.rng());
          const r = (stroke.rMin ?? 2) + (stroke.rMax ?? 7 - (stroke.rMin ?? 2)) * t;
          eng.saltMask(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, {
            arms: stroke.arms ?? (5 + Math.floor(this.rng() * 3)),
            lift: stroke.lift ?? 0.55,
          });
        }
        break;
      }
      case "cover": {
        // 协议 v0.3：整幅覆盖湿铺（region = 整数格矩形区域 {x0,y0,x1,y1}），
        // 治愈"agent 判断 ribbon 几何失误 → 画面留白带"的问题
        const { x0, y0, x1, y1 } = stroke.region;
        const soft = stroke.soft ?? 10;
        const { w, h } = this.eng;
        this.clear();
        for (let y = Math.max(0, y0 - soft); y <= Math.min(h - 1, y1 + soft); y++) {
          for (let x = Math.max(0, x0 - soft); x <= Math.min(w - 1, x1 + soft); x++) {
            const dx = Math.max(x0 - x, 0, x - x1);
            const dy = Math.max(y0 - y, 0, y - y1);
            const d = Math.max(dx, dy);
            const m = d <= 0 ? 1 : d >= soft ? 0 : 1 - d / soft;
            if (m > 0) this.mask[y * w + x] = m;
          }
        }
        eng.depositMask(this.mask, { water, amount, hard: stroke.hard ?? false });
        break;
      }
      default:
        throw new Error(`unknown stroke type: ${stroke.type}`);
    }
  }

  /** v2.0 新管线:配方 → BrushState → 发射 → 分桶沉积 → interleave(引擎只读 + depositMask,不改引擎) */
  applyNew(stroke) {
    const eng = this.eng;
    const pig = (stroke.load?.pigment ?? stroke.pigment) || {};
    const K = this.colorSystem ? this.colorSystem.pigmentBasis(pig) : defaultBasis(pig);
    eng.setPigment({
      K,
      granulation: pig.granulation ?? 0.5,
      staining: pig.staining ?? 0.5,
    });
    // 混色提供者:每桶按 tipShare 混合 belly 色与 tip 色(charging);
    // 无名颜色时用 defaultBasis 兜底(与 legacy 一致)。
    const cs = this.colorSystem;
    const bellyRGB = cs && cs.pigmentRGB ? cs.pigmentRGB(pig) : hexToRgb01(pig.color);
    const tipPig = stroke.load?.tip ?? null;
    const tipRGB = tipPig ? (cs && cs.pigmentRGB ? cs.pigmentRGB(tipPig) : hexToRgb01(tipPig.color)) : null;
    const basis = (prov, tipFrac) => {
      if (prov.tipRGB && tipFrac > 1e-6 && tipFrac < 0.9999) {
        const [br, bg, bb] = prov.bellyRGB, [tr, tg, tb] = prov.tipRGB;
        const mix = [br + (tr - br) * tipFrac, bg + (tg - bg) * tipFrac, bb + (tb - bb) * tipFrac];
        return { K: defaultBasis({ color: mix }), granulation: pig.granulation ?? 0.5, staining: pig.staining ?? 0.5 };
      }
      const usePig = tipFrac > 0.5 && prov.tipRGB ? (stroke.load?.tip ?? pig) : pig;
      const K2 = cs ? cs.pigmentBasis(usePig) : defaultBasis(usePig);
      return { K: K2, granulation: pig.granulation ?? 0.5, staining: pig.staining ?? 0.5 };
    };
    const state = new BrushState(eng, stroke, {
      painterSeed: this.seed ?? 1,
      strokeIndex: this._brushSeq++,
      pigment: { bellyRGB, tipRGB, basis },
    });
    state.run();
    this.lastBrushState = state;
  }
}

export function hexToRgb01(hex) {
  if (!hex) return [0.5, 0.5, 0.5];
  const s = hex.replace("#", "");
  const v = parseInt(s, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** 无颜色系统时的 RGB 兜底基（(1-R)²/2R） */
function defaultBasis(pig) {
  if (!pig || !pig.color) return new Float32Array(3);
  const rgb = typeof pig.color === "string" ? hexToRgb01(pig.color) : (pig.color || [0.5, 0.5, 0.5]);
  const K = (c) => { const rc = Math.max(c, 0.02); const t = 1 - rc; return (t * t) / (2 * rc); };
  return Float32Array.from([K(rgb[0]), K(rgb[1]), K(rgb[2])]);
}
