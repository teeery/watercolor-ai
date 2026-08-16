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
const SPACING = 0.5;      // Δs = SPACING·width(网格口径)
const CHUNKS = 6;         // interleave 分块数
const kStep = 0.3;        // interleave 步数 ∝ 弧长系数(§6:总步数 = min(arcLen·kStep, budgetMax))
const BUCKETS_W = 8, BUCKETS_A = 8;

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
   * @param {object} opt { painterSeed, strokeIndex }
   */
  constructor(engine, stroke, { painterSeed = 1, strokeIndex = 0 } = {}) {
    this.eng = engine;
    this.stroke = stroke;
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

    // 分桶与记账
    this.poolMasks = [];
    this.bristleMasks = [];
    this.bucketKeys = [];
    this.bucketOrder = [];     // key → 首次出现序
    this._bucketIdx = new Map();
    this.stamps = 0;
    this.interleavedSteps = 0;
  }

  /** 湿纸反馈(只读引擎字段;COORDINATION.md 允许的读缝) */
  wetnessAt(x, y) {
    const { w, h, W, paper } = this.eng;
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
    return Math.min(1, W[yi * w + xi] / Math.max(0.05, paper.C[yi * w + xi]));
  }

  _bucketFor(w, a) {
    // w,a 都是 0..max 范围;量化到 8 档(0 档 = 0)
    const wIdx = w <= 1e-9 ? 0 : 1 + Math.min(BUCKETS_W - 1, (w / this._wMax) * BUCKETS_W | 0);
    const aIdx = a <= 1e-9 ? 0 : 1 + Math.min(BUCKETS_A - 1, (a / this._aMax) * BUCKETS_A | 0);
    const key = wIdx * BUCKETS_A + aIdx;
    let b = this._bucketIdx.get(key);
    if (!b) {
      b = {
        key,
        order: this.bucketOrder.length,
        pool: new Float32Array(this.eng.n),
        bristle: new Float32Array(this.eng.n),
        wSum: 0, aSum: 0, wetSum: 0, gbSum: 0, n: 0,
      };
      this.bucketOrder.push(key);
      this._bucketIdx.set(key, b);
      this.poolMasks.push(b.pool);
      this.bristleMasks.push(b.bristle);
      this.bucketKeys.push(key);
    }
    b.wSum += w; b.aSum += a; b.n++;
    return b;
  }

  _flushBuckets(bucketList) {
    const eng = this.eng;
    for (const b of bucketList) {
      if (b.n === 0) continue;
      const wAvg = b.wSum / b.n;
      const aAvg = b.aSum / b.n;
      const wetAvg = b.wetSum / b.n;
      const gbAvg = b.gbSum / b.n;
      // 毛缘门控:干态涌现(有效毛厚过渡)+ 抑制腹池内部(毛缘只留边缘带)
      const gbScale = 0.25 + 0.75 * gbAvg;
      for (let i = 0; i < b.bristle.length; i++) {
        const pool = b.pool[i];
        let m = b.bristle[i] * gbScale;
        if (m > 0 && pool > 0.6) m *= Math.max(0, 1 - (pool - 0.6) * 2.5);
        b.bristle[i] = m < 0 ? 0 : m > 1 ? 1 : m;
      }
      const wDep = wAvg * (1 - 0.6 * wetAvg); // kAbsorb=0.6:湿纸吸不动
      eng.depositMask(b.pool, { water: wDep, amount: aAvg });
      eng.depositMask(b.bristle, { water: wDep * 0.3, amount: aAvg * 1.5 }); // 毛缘:少水多色(1.3-1.6× 的离散化)
    }
  }

  /** 主入口:发射整笔。返回 { steps: 交错步数 } */
  run() {
    const eng = this.eng;
    const n = Math.max(1, Math.round(this.totalLen / this.ds));
    // 分桶量化上界:单戳最大释水 ≈ 初始水×指数释放饱和;单戳最大颜料 ≈ 初始颜料
    this._wMax = Math.max(0.1, Math.min(1.0, this.loadWater * this.brush.capacity * 0.62));
    this._aMax = Math.max(0.05, this.reservoir.p0 * 0.3);

    // 记录每戳的 (dt, bucket) 供 interleave 按真实时间分配
    const stampsInfo = [];
    let prevDirX = 1, prevDirY = 0;
    for (let k = 0; k <= n; k++) {
      const s = n === 0 ? 0 : k / n;
      const t = s * this.totalLen;
      // 弧长 → 位置与切线
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
      const dt = Math.min(this.ds / (v * VSCALE * GRID_SCALE), 0.8);
      const { dw, amount, gb } = this.reservoir.release(p, v, this.ds);
      this.reservoir.wick(p, this.wetnessAt(xi, yi), dt);
      this.reservoir.capillary();
      const width = this.bristles.advance(xi, yi, dx, dy, p, v, dt, this.widthGrid, prevDirX, prevDirY);
      prevDirX = dx; prevDirY = dy;
      if (dw > 1e-9 || amount > 1e-9) {
        const b = this._bucketFor(dw, amount);
        b.wetSum += this.wetnessAt(xi, yi);
        b.gbSum += gb;
        // 绘制:腹池(软边) + 毛缘
        paintFootprint(this.brush.shape, b.pool, eng.w, eng.h, xi, yi, dx, dy, width * 1.4, 2.5, null);
        this.bristles.paintMarks(b.bristle, eng.w, eng.h, xi, yi, dx, dy, width);
        stampsInfo.push({ dt, b });
      }
      this.stamps++;
    }

    const bucketList = this.bucketOrder.map((key) => this._bucketIdx.get(key));

    if (!this.interleave) {
      this._flushBuckets(bucketList);
      return { steps: 0 };
    }

    // interleave:6 块,步数按块真实 dt 比例分配,总步数 = min(Σdt·60, budgetMax)
    const totalDt = stampsInfo.reduce((a, x) => a + x.dt, 0) || 1e-9;
    const totalSteps = Math.max(CHUNKS, Math.min(Math.round(totalDt * 60), this.budgetMax));
    const chunkSize = Math.max(1, Math.ceil(stampsInfo.length / CHUNKS));
    let idx = 0;
    let stepBudgetLeft = totalSteps;
    for (let c = 0; c < CHUNKS && idx < stampsInfo.length; c++) {
      const end = Math.min(stampsInfo.length, idx + chunkSize);
      let chunkDt = 0;
      const seen = new Set();
      for (let j = idx; j < end; j++) { chunkDt += stampsInfo[j].dt; seen.add(stampsInfo[j].b.key); }
      const steps = Math.max(1, Math.round(totalSteps * (chunkDt / totalDt)));
      this._flushBuckets(bucketList.filter((b) => seen.has(b.key)));
      this.interleavedSteps += steps;
      eng.step(Math.min(steps, stepBudgetLeft));
      stepBudgetLeft -= steps;
      // 已沉积的桶清零(下一块重新累积)
      for (const b of bucketList) { if (seen.has(b.key)) { b.pool.fill(0); b.bristle.fill(0); b.wSum = 0; b.aSum = 0; b.wetSum = 0; b.gbSum = 0; b.n = 0; } }
      idx = end;
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
      stamps: this.stamps,
      buckets: this.bucketKeys.length,
      interleavedSteps: this.interleavedSteps,
      totalLen: this.totalLen,
    };
  }
}
