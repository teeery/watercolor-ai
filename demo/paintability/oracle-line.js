// 直基元「真 oracle」演示 —— 同一表示（一笔 ribbon），随机贪心 vs 局部坐标下降 vs 全局粗-细参数扫描。
// 关键发现：细直线的损失地形是「大海捞针」——局部搜索（贪心/坐标下降）几乎处处无梯度，会卡死在低位；
// 只有全局粗网格先「找到」直线、再局部精修，才是真 oracle。这正是 docs/paintability.md 说「参数扫描」而非「随机」的原因。
import { FlatCanvas } from "../../src/paintability/flat.js";
import { fitFlat, refineColors } from "../../src/paintability/oracle1.js";

const W = 480, H = 640, N = W * H;
const PAPER = [0.99, 0.975, 0.94];
const INK = [0.12, 0.14, 0.16];
const TRUTH = { cx: 0.435 * W, cy: 0.42 * H, L: 0.285 * W, w: 3, soft: 1.2 }; // cx=208.8 cy=268.8 L=136.8

function makeTarget() {
  const c = new FlatCanvas(W, H);
  c.paint({ type: "ribbon", color: INK, alpha: 0.9, soft: TRUTH.soft, radius: TRUTH.w, radiusEnd: TRUTH.w, path: [[TRUTH.cx - TRUTH.L, TRUTH.cy], [TRUTH.cx + TRUTH.L, TRUTH.cy]] });
  return Float32Array.from(c.rgb);
}
function fpMse(target, fit) {
  let n = 0, s = 0;
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    const d = Math.max(Math.abs(target[o] - PAPER[0]), Math.abs(target[o + 1] - PAPER[1]), Math.abs(target[o + 2] - PAPER[2]));
    if (d < 0.04) continue;
    n++;
    const e0 = target[o] - fit[o], e1 = target[o + 1] - fit[o + 1], e2 = target[o + 2] - fit[o + 2];
    s += e0 * e0 + e1 * e1 + e2 * e2;
  }
  return n > 0 ? s / (n * 3) : 0;
}
const dB = (m) => (m > 0 ? 10 * Math.log10(1 / m) : Infinity);

const target = makeTarget();

// --- 1) 随机贪心 ---
let t0 = performance.now();
const g = fitFlat(target, { w: W, h: H, maxStrokes: 48, candidates: 48, seed: 7 });
refineColors(target, g.canvas, g.strokes, { passes: 3 });
const greedyDb = dB(fpMse(target, g.canvas.rgb));
console.log(`[random-greedy]      ${greedyDb.toFixed(2)} dB  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);

// --- 2) 局部坐标下降（无全局初值）---
function renderLine(s) {
  const c = new FlatCanvas(W, H);
  c.paint({ type: "ribbon", color: INK, alpha: 0.9, soft: TRUTH.soft, radius: s.w, radiusEnd: s.w, path: [[s.cx - s.L, s.cy], [s.cx + s.L, s.cy]] });
  return c.rgb;
}
t0 = performance.now();
let s = { cx: W / 2, cy: H * Math.random(), L: 60 + Math.random() * 120, w: 1.6 + Math.random() * 5 };
let e = fpMse(target, renderLine(s));
const st = { cy: 5, cx: 8, L: 12, w: 0.8 };
const KS = ["cy", "cx", "L", "w"];
for (let it = 0; it < 200; it++) {
  let imp = false;
  for (const k of KS) for (const sgn of [+1, -1]) {
    const c = { ...s, [k]: s[k] + sgn * st[k] };
    if (c.w < 0.5) c.w = 0.5; if (c.L < 5) c.L = 5;
    const en = fpMse(target, renderLine(c));
    if (en < e) { s = c; e = en; imp = true; }
  }
  if (!imp) for (const k of KS) st[k] *= 0.7;
}
const localDb = dB(e);
console.log(`[local-descent]      ${localDb.toFixed(2)} dB  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);

// --- 3) 全局粗网格（θ×cy 扫描）+ 局部精修 ---
t0 = performance.now();
let best = { cy: H / 2, L: 140, w: 3, bestE: Infinity };
for (let th = 0; th < Math.PI; th += Math.PI / 24) {
  if (Math.min(th, Math.PI - th) > 0.12) continue; // 限「近水平」先粗扫（真 oracle 可放宽为全角度，此处演示免除 90° 直线族的歧义）
  for (let cy = 0; cy < H; cy += 3) {
    const c = { cx: W / 2, cy, L: 140, w: 3 };
    if (Math.abs(Math.cos(th)) < 0.99) c.cx = W / 2; // 水平为主，cx 固定居中足够
    const c2 = new FlatCanvas(W, H);
    const dx = Math.cos(th) * c.L, dy = Math.sin(th) * c.L;
    c2.paint({ type: "ribbon", color: INK, alpha: 0.9, soft: TRUTH.soft, radius: c.w, radiusEnd: c.w, path: [[c.cx - dx, c.cy - dy], [c.cx + dx, c.cy + dy]] });
    const en = fpMse(target, c2.rgb);
    if (en < best.bestE) best = { ...c, bestE: en };
  }
}
// 精修
s = { cx: best.cx, cy: best.cy, L: best.L, w: best.w };
e = best.bestE;
for (const k of KS) st[k] = k === "cy" ? 1 : k === "cx" ? 1 : k === "L" ? 2 : 0.2;
for (let it = 0; it < 160; it++) {
  let imp = false;
  for (const k of KS) for (const sgn of [+1, -1]) {
    const c = { ...s, [k]: s[k] + sgn * st[k] };
    if (c.w < 0.5) c.w = 0.5; if (c.L < 5) c.L = 5;
    const en = fpMse(target, renderLine(c));
    if (en < e) { s = c; e = en; imp = true; }
  }
  if (!imp) for (const k of KS) st[k] *= 0.6;
}
const oracleDb = dB(e);
console.log(`[global-grid oracle] ${oracleDb.toFixed(2)} dB  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);

console.log("\n=== 结论 ===");
console.log(`同一表示：随机贪心 ${greedyDb.toFixed(2)} dB | 局部坐标下降 ${localDb.toFixed(2)} dB（无初值→卡针尖）| 全局网格+精修 ${oracleDb.toFixed(2)} dB`);
console.log(oracleDb > 30 ? "⇒ 真 oracle(参数扫描)能达 ~∞；低分是「细直线损失地形针尖单点」所致，不是引擎/表示不可达。" : "⇒ 仍偏低，或有实现瑕疵需进一步查。");