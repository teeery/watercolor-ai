// 渐变基元「真 oracle」—— 平滑渐变是否可达？
// 关键发现：flat rect 的软边覆盖是「线性斜坡」，于是**一条软边 rect（软边跨度=带宽）就能精确重建线性渐变**；
// 之前跑分里渐变只到 ~19.5dB 是贪心的锅（它的 rect 提案 soft≤~17、alpha=0.62，永远覆盖不到「全宽软边」这条解），不是表示不可达。
import { FlatCanvas } from "../../src/paintability/flat.js";
import { fitFlat, refineColors, msePsnr } from "../../src/paintability/oracle1.js";

const W = 480, H = 640;
const PAPER = [0.99, 0.975, 0.94];
const FROM = [0.12, 0.14, 0.16]; // 深端
const X0 = 40, X1 = 440, Y0 = 240, Y1 = 400, L = X1 - X0;

function buildTarget() {
  const c = new FlatCanvas(W, H);
  for (let x = X0; x < X1; x++) {
    const t = (x - X0) / L;
    for (let y = Y0; y < Y1; y++) {
      const o = (y * W + x) * 3;
      c.rgb[o] = FROM[0] + (PAPER[0] - FROM[0]) * t;
      c.rgb[o + 1] = FROM[1] + (PAPER[1] - FROM[1]) * t;
      c.rgb[o + 2] = FROM[2] + (PAPER[2] - FROM[2]) * t;
    }
  }
  return Float32Array.from(c.rgb);
}
function bandMse(target, fit) {
  let s = 0, n = 0;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const o = (y * W + x) * 3;
    for (let k = 0; k < 3; k++) { const d = target[o + k] - fit[o + k]; s += d * d; n++; }
  }
  return s / n;
}
const dB = (m) => (m > 0 ? 10 * Math.log10(1 / m) : Infinity);

const target = buildTarget();

// --- 1) 单条全宽软边 rect（解析解）：alpha=0.9, soft=带宽 L, 色 = paper + (FROM-paper)/0.9 ---
const A = 0.9;
const col = [0, 1, 2].map((k) => PAPER[k] + (FROM[k] - PAPER[k]) / A);
const c1 = new FlatCanvas(W, H);
c1.paint({ type: "rect", color: col, alpha: A, x0: 0, y0: Y0, x1: X0, y1: Y1, soft: L }); // 右边界= X0，软边向右铺满 [X0,X1]
console.log(`[single-soft-rect] 渐变带 PSNR ${dB(bandMse(target, Float32Array.from(c1.rgb))).toFixed(2)} dB`);

// --- 2) 对照：K 段硬台阶（flat 平色阶梯）的条带地板 ---
for (const K of [1, 4, 16, 64, 256]) {
  const c = new FlatCanvas(W, H);
  for (let k = 0; k < K; k++) {
    const xa = X0 + (k * L) / K, xb = X0 + ((k + 1) * L) / K;
    const tMid = (xa + xb) / 2 / 480 * 0 + ((xa + xb) / 2 - X0) / L;
    const cc = [0, 1, 2].map((j) => FROM[j] + (PAPER[j] - FROM[j]) * tMid);
    c.paint({ type: "rect", color: cc, alpha: 1, x0: xa, y0: Y0, x1: xb, y1: Y1, soft: 0 });
  }
  console.log(`[K=${String(K).padStart(3)} hard-stair] 渐变带 PSNR ${dB(bandMse(target, Float32Array.from(c.rgb))).toFixed(2)} dB`);
}

// --- 3) 贪心当前水平 ---
let t0 = performance.now();
const g = fitFlat(target, { w: W, h: H, maxStrokes: 96, candidates: 48, seed: 7 });
refineColors(target, g.canvas, g.strokes, { passes: 3 });
console.log(`[random-greedy]    渐变带 PSNR ${dB(bandMse(target, Float32Array.from(g.canvas.rgb))).toFixed(2)} dB  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);

console.log("\n=== 结论 ===");
console.log("单条软边 rect 精确重建线性渐变（~∞）⇒ 平滑渐变「可达」；条带地板只出现在平色阶梯（1/K²）与贪心（提案不含全宽软边）。");