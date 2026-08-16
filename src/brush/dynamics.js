// 发射器与时间交错(brush dynamics v2 §2/§6/§8)——BrushState:沿弧长推进 → 分桶沉积 → interleave
// 单位约定(§9):新管线几何以 1280×960 画布坐标为基准,×0.5 落到 640×480 模拟网格。
// 引擎耦合:只调用 depositMask + 只读 W/paper(不改引擎,遵守 COORDINATION.md)。
import { Reservoir } from "./reservoir.js";
import { makeMotion } from "./motion.js";
import { resolveBrush, RECIPES } from "./brush.js";
import { Bristles } from "./bristles.js";
import { paintFootprint } from "./footprints.js";

const GRID_SCALE = 0.5;   // 画布 → 网格
const VSCALE = 60;        // speed=1 → 60 px/s(画布口径)
const SPACING = 0.35;     // Δs = SPACING·width(网格口径;0.35 密戳消"印章链")
const CHUNKS = 6;         // interleave 分块数
const kStep = 0.3;        // interleave 步数 ∝ 弧长系数(§6:总步数 = min(arcLen·kStep, budgetMax))
const SEG_PER_SEGMENT = 4; // 每段戳数(路径顺序分段:无量化、沿路径密度连续)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Chaikin 圆角平滑 ×iter(与旧 ribbon 一致) */
function chaikin(pts, iter = 2) {
  let out = pts;
  for (let k = 0; k < iter; k++) {
    if (out.length <= 2) break;
    const sm = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, ay] = out[i], [bx, by] = out[i + 1];
      sm.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      sm.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    sm.push(out[out.length - 1]);
    out = sm;
  }
  return out;
}

/** region → 大排刷蛇形往返路径(§9:区域湿铺 = 蛇形填充的简写) */
function serpentine(region, widthGrid) {
  const { cx, cy, rx, ry } = region;
  const stepY = Math.max(2, widthGrid * 1.6);
  const rows = [];
  let y = cy - ry;
  let dir = 1;
  while (y <= cy + ry) {
    const t = 1 - Math.abs(y - cy) / (ry || 1);
    const half = rx * Math.sqrt(Math.max(0.05, 1 - (1 - t) ** 2));
    if (dir === 1) rows.push([cx - half, y], [cx + half, y]);
    else rows.push([cx + half, y], [cx - half, y]);
    dir = -dir;
    y += stepY;
  }
  return rows.length >= 2 ? rows : [[cx, cy]];
}

export class BrushState {
  /**
   * @param {WatercolorEngine} engine
   * @param {object} stroke v0.3 stroke(已含 path 或 region)
   * @param {object} opt { painterSeed, strokeIndex, pigment }
   *   opt.pigment = { bellyRGB:[r,g,b]0..1, tipRGB:[r,g,b]|null, basis:(pig)=>K, granulation, staining }
   */
  constructor(engine, stroke, { painterSeed = 1, strokeIndex = 0, pigment = null } = {}) {
    this.eng = engine;
    this.stroke = stroke;
    this.pigmentProvider = pigment;
    const recipe = RECIPES[stroke.type] ?? {};
    this.brush = resolveBrush(stroke.brush ?? recipe.brush);
    const load = stroke.load ?? {};
    this.pigment = load.pigment ?? stroke.pigment ?? { amount: 0.8 };
    this.loadWater = load.water ?? recipe.load?.water ?? 0.5;
    this.loadTip = load.tip ?? null;
    this.motion = makeMotion(stroke.motion ?? recipe.motion ?? {});
    this.kBreak = stroke.kBreak ?? recipe.kBreak ?? 1.4;
    this.gamma = stroke.gamma ?? recipe.gamma ?? 1.2;
    this.reservoir = new Reservoir(
      { water: this.loadWater, pigment: this.pigment, tip: this.loadTip },
      this.brush.capacity,
      { kBreak: this.kBreak, gamma: this.gamma },
    );
    this.bristles = new Bristles(this.brush, painterSeed ^ (strokeIndex * 0x9e3779b9));
    this.widthGrid = Math.max(2, (this.brush.width ?? 14) * GRID_SCALE);

    // 路径:path(画布坐标 ×0.5)或 region → 蛇形;Chaikin ×2
    let rawPath = stroke.path;
    if (!rawPath && stroke.region) rawPath = serpentine(stroke.region, this.widthGrid);
    if (!rawPath || rawPath.length < 2) {
      this.pts = stroke.path ? chaikin(stroke.path) : [[engine.w * 0.5, engine.h * 0.5]];
    } else {
      this.pts = chaikin(rawPath.map(([x, y]) => [x * GRID_SCALE, y * GRID_SCALE]));
    }
    this.segLens = [];
    this.totalLen = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const [ax, ay] = this.pts[i], [bx, by] = this.pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      this.segLens.push(len);
      this.totalLen += len;
    }
    this.ds = Math.max(1, SPACING * this.widthGrid);

    // interleave 判据(§6):path 型、长度 > 150px(网格)、显式 motion 或 interleave.on
    this.interleave = !!(stroke.interleave?.on || stroke.motion) && this.totalLen > 150;
    this.budgetMax = stroke.interleave?.budget ?? 90;

    // 分桶与记账:改"路径顺序分段"(每 SEG 戳一段,无量化 → 沿路径密度连续,无串珠)
    this.segments = [];
    this._curSeg = null;
    this._cover = new Float32Array(engine.n); // max-blend 覆盖掩码(消段间重叠累积)
    this.stamps = 0;
    this.interleavedSteps = 0;
    this.tipReleasedTotal = 0; // charging 记账(跨 interleave 块累计)
  }

  /** 湿纸反馈(只读引擎字段;COORDINATION.md 允许的读缝) */
  wetnessAt(x, y) {
    const { w, h, W, paper } = this.eng;
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
    return Math.min(1, W[yi * w + xi] / Math.max(0.05, paper.C[yi * w + xi]));
  }

  _segmentFor(w, a, tipShare) {
    if (!this._curSeg || this._curSeg.n >= SEG_PER_SEGMENT) {
      const seg = {
        pool: new Float32Array(this.eng.n),
        bristle: new Float32Array(this.eng.n),
        wSum: 0, aSum: 0, pTipSum: 0, wetSum: 0, gbSum: 0, n: 0,
      };
      this.segments.push(seg);
      this._curSeg = seg;
    }
    const b = this._curSeg;
    b.wSum += w; b.aSum += a; b.pTipSum += tipShare * a; b.n++;
    return b;
  }

  _flushSegments(segList) {
    const eng = this.eng;
    const prov = this.pigmentProvider;
    const K_WATER = 6.0, K_AMOUNT = 2.0; // 单位换算:每戳膜厚口径 → 引擎 legacy 观感尺度(校准值)
    const covered = this._cover; // 跨块持久(本笔内):max-blend 覆盖掩码不随 chunk 重置 → 杀块边界双倍沉积串珠
    // 按路径顺序沉积(笔头定义前缘线),covered mask 做 max-blend:每格只被先到者覆盖一次
    for (const b of segList) {
      if (b.n === 0) continue;
      const wAvg = b.wSum / b.n;
      const aAvg = b.aSum / b.n;
      const wetAvg = b.wetSum / b.n;
      const gbAvg = b.gbSum / b.n;
      // 毛缘门控:干态涌现(有效毛厚过渡);湿池(低 gb)抑制腹池内部的毛痕,干态(高 gb)毛痕横贯笔腹(排线)
      const gbScale = 0.25 + 0.75 * gbAvg;
      const suppressInterior = gbAvg < 0.5;
      for (let i = 0; i < b.bristle.length; i++) {
        const pool = b.pool[i];
        let m = b.bristle[i] * gbScale;
        if (m > 0 && suppressInterior && pool > 0.55) m *= Math.max(0, 1 - (pool - 0.55) * 2.2);
        b.bristle[i] = m < 0 ? 0 : m > 1 ? 1 : m;
      }
      // max-blend:pool 与 bristle 都只落在未覆盖区
      for (let i = 0; i < b.pool.length; i++) {
        const c = covered[i];
        if (c >= 1) { b.pool[i] = 0; b.bristle[i] = 0; continue; }
        const k = 1 - c;
        if (b.pool[i] > 0) {
          b.pool[i] *= k;
          if (b.pool[i] > covered[i]) covered[i] = b.pool[i];
        }
        if (b.bristle[i] > 0) b.bristle[i] *= k;
      }
      // 干态纸齿断纹(飞白):gb 高时按纸细颗粒 F 阈值撕裂 pool/毛缘 → 露纸丝状白痕
      if (gbAvg > 0.25) {
        const F = eng.paper.F;
        const thr = 0.85 - 0.5 * gbAvg;
        for (let i = 0; i < b.pool.length; i++) {
          if (b.pool[i] <= 0 && b.bristle[i] <= 0) continue;
          const f = F[i];
          let keep = f > thr ? 1 : (f > thr - 0.18 ? (f - (thr - 0.18)) / 0.18 : 0);
          b.pool[i] *= keep;
          b.bristle[i] *= keep;
        }
      }
      const wDep = Math.min(2.0, wAvg * K_WATER * (1 - 0.6 * wetAvg)); // kAbsorb=0.6:湿纸吸不动
      // 颜料随湿纸衰减(湿接湿稀释:叠在湿区的第二笔应更软更淡,而非越叠越暗)
      const aDep = aAvg * K_AMOUNT * (1 - 0.5 * wetAvg);
      // 每段混色:tipShare → belly 色与 tip 色混合(charging 一笔多色)
      if (prov) {
        const tipFrac = b.aSum > 1e-9 ? b.pTipSum / b.aSum : 0;
        eng.setPigment(prov.basis(prov, tipFrac));
      }
      eng.depositMask(b.pool, { water: wDep, amount: aDep });
      eng.depositMask(b.bristle, { water: wDep * 0.3, amount: aDep * 1.6 }); // 毛缘:少水多色(连续拖痕,1.6× 强化双轨)
    }
  }

  /** 主入口:发射整笔。返回 { steps: 交错步数 } */
  run() {
    const eng = this.eng;
    const n = Math.max(1, Math.round(this.totalLen / this.ds));
    this.reservoir.setStrokeLength(n); // 颜料释放率按戳数锚定(满载撑完全笔)
    this._cover.fill(0); // max-blend 覆盖掩码在本笔开始清零(跨 interleave 块持久)

    const stamp = (k) => {
      const s = n === 0 ? 0 : k / n;
      const t = s * this.totalLen;
      let acc = 0, xi = this.pts[0][0], yi = this.pts[0][1], dx = 1, dy = 0;
      for (let i = 0; i < this.segLens.length; i++) {
        if (acc + this.segLens[i] >= t) {
          const f = this.segLens[i] <= 0 ? 0 : (t - acc) / this.segLens[i];
          const [ax, ay] = this.pts[i], [bx, by] = this.pts[i + 1];
          xi = ax + (bx - ax) * f;
          yi = ay + (by - ay) * f;
          const il = 1 / (this.segLens[i] || 1);
          dx = (bx - ax) * il; dy = (by - ay) * il;
          break;
        }
        acc += this.segLens[i];
      }
      const p = this.motion.pressure(s);
      const v = Math.max(this.motion.speed(s), 0.02);
      const dt = Math.min(this.ds / (v * VSCALE * GRID_SCALE), 1.5);
      const { dw, amount, tipShare, gb } = this.reservoir.release(p, v, this.ds);
      this.reservoir.wick(p, this.wetnessAt(xi, yi), dt);
      this.reservoir.capillary();
      const width = this.bristles.advance(xi, yi, dx, dy, p, v, dt, this.widthGrid, this._prevDX, this._prevDY);
      this._prevDX = dx; this._prevDY = dy;
      if (dw > 1e-9 || amount > 1e-9) {
        this.tipReleasedTotal += tipShare * amount;
        const b = this._segmentFor(dw, amount, tipShare);
        b.wetSum += this.wetnessAt(xi, yi);
        b.gbSum += gb;
        const soft = Math.max(3, this.ds * 0.8);
        paintFootprint(this.brush.shape, b.pool, eng.w, eng.h, xi, yi, dx, dy, width * 1.4, soft, null);
        this.bristles.paintMarks(b.bristle, eng.w, eng.h);
        return { dt, seg: b };
      }
      return null;
    };
    this._prevDX = 1; this._prevDY = 0;

    if (!this.interleave) {
      for (let k = 0; k <= n; k++) { stamp(k); this.stamps++; }
      this._flushSegments(this.segments);
      return { steps: 0 };
    }

    // interleave:按戳分块,画一块 → 沉积一块 → 步进一块(§6:块步数按真实 dt 比例)
    let dtTotal = 0;
    const chunkInfo = [];
    const chunkSize = Math.max(1, Math.ceil((n + 1) / CHUNKS));
    for (let c = 0; c < CHUNKS; c++) {
      const lo = c * chunkSize, hi = Math.min(n, lo + chunkSize - 1);
      if (lo > n) break;
      const segStart = this.segments.length;
      let dtSum = 0;
      for (let k = lo; k <= hi; k++) {
        const r = stamp(k);
        this.stamps++;
        if (r) dtSum += r.dt;
      }
      chunkInfo.push({ segs: this.segments.slice(segStart), dtSum });
      dtTotal += dtSum;
    }
    dtTotal = dtTotal || 1e-9;
    const totalSteps = Math.max(CHUNKS, Math.min(Math.round(dtTotal * 60), this.budgetMax));
    this.chunkDebug = [];
    let stepBudgetLeft = totalSteps;
    for (const ch of chunkInfo) {
      const steps = Math.max(1, Math.round(totalSteps * (ch.dtSum / dtTotal)));
      this._flushSegments(ch.segs);
      this.chunkDebug.push({ nSegs: ch.segs.length, steps });
      this.interleavedSteps += steps;
      eng.step(Math.min(steps, stepBudgetLeft));
      stepBudgetLeft -= steps;
    }
    return { steps: this.interleavedSteps };
  }

  /** 数值断言辅助 */
  assertions() {
    return {
      conservationOK: this.reservoir.conservationOK(),
      releasedW: this.reservoir.releasedW,
      releasedP: this.reservoir.releasedP,
      wickedW: this.reservoir.wickedW,
      tipReleased: this.tipReleasedTotal,
      stamps: this.stamps,
      stamps: this.stamps,
      segments: this.segments.length,
      interleavedSteps: this.interleavedSteps,
      totalLen: this.totalLen,
    };
  }
}
