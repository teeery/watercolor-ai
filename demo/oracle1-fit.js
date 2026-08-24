// Oracle 1 运行器：平面笔触拟合《乡村田野》参照图
// 产物（out/oracle1/）：
//   reference.png   参照图降采样（2×）
//   flat_final.png  平面拟合终稿（2×）
//   montage.png     参照 | 平面拟合 | 引擎干画 copy-final 三栏
//   curve.png       mse-vs-笔数 误差曲线
//   strokes.json    全笔触 recipe + 误差历史（可复现重放）
// 用法：node demo/oracle1-fit.js [maxStrokes=160] [candidates=96]
import { fitFlat, refineColors, loadTarget, msePsnr } from "../src/paintability/oracle1.js";
import { decodePNG, resizeRGBAtoRGB, writePNG } from "../src/io/png.js";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

const OUT = "out/oracle1";
mkdirSync(OUT, { recursive: true });
const W = 480, H = 640;
const maxStrokes = parseInt(process.argv[2] ?? "160", 10);
const candidates = parseInt(process.argv[3] ?? "96", 10);
const REF = "out/copy-ref/乡村田野.png";

if (!existsSync(REF)) {
  console.error(`[oracle1] 参照图不存在：${REF}（按仓库惯例，参照原件仅本地，不入库）`);
  process.exit(1);
}

const t0 = performance.now();
const target = loadTarget(REF, W, H);
const { strokes, history, canvas } = fitFlat(target, { w: W, h: H, maxStrokes, candidates, seed: 7 });
const { mse: greedyMse, psnr: greedyPsnr } = msePsnr(target, canvas.rgb);
const refined = refineColors(target, canvas, strokes, { passes: 3 });
const mse = refined.mse, psnr = refined.psnr;
const dt = ((performance.now() - t0) / 1000).toFixed(1);

function toRGBA(frgb, w, h, upscale) {
  const W2 = w * upscale, H2 = h * upscale;
  const out = new Uint8Array(W2 * H2 * 4);
  for (let y2 = 0; y2 < H2; y2++) {
    const i0 = (((y2 / upscale) | 0) * w) * 3;
    for (let x2 = 0; x2 < W2; x2++) {
      const i = i0 + ((x2 / upscale) | 0) * 3;
      const o = (y2 * W2 + x2) * 4;
      out[o] = (frgb[i] * 255) | 0; out[o + 1] = (frgb[i + 1] * 255) | 0; out[o + 2] = (frgb[i + 2] * 255) | 0; out[o + 3] = 255;
    }
  }
  return { data: out, w: W2, h: H2 };
}

const refImg = toRGBA(target, W, H, 2);
const flatImg = toRGBA(canvas.rgb, W, H, 2);
writePNG(`${OUT}/reference.png`, refImg.data, refImg.w, refImg.h);
writePNG(`${OUT}/flat_final.png`, flatImg.data, flatImg.w, flatImg.h);

// 三栏 montage（1×：参照 | 平面拟合 | 引擎干画）
const panels = [toRGBA(target, W, H, 1).data, toRGBA(canvas.rgb, W, H, 1).data];
if (existsSync("out/copy-final.png")) {
  const cf = decodePNG(readFileSync("out/copy-final.png"));
  panels.push(toRGBA(resizeRGBAtoRGB(cf.data, cf.w, cf.h, W, H), W, H, 1).data);
}
const MW = W * panels.length, mont = new Uint8Array(MW * H * 4);
for (let p = 0; p < panels.length; p++) {
  const src = panels[p];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 4, di = (y * MW + p * W + x) * 4;
    mont[di] = src[si]; mont[di + 1] = src[si + 1]; mont[di + 2] = src[si + 2]; mont[di + 3] = 255;
  }
}
writePNG(`${OUT}/montage.png`, mont, MW, H);

// 误差曲线
writePNG(`${OUT}/curve.png`, ...plotCurve(history));

const rec = { config: { w: W, h: H, maxStrokes, candidates, seed: 7 }, history, greedy: { mse: greedyMse, psnr: greedyPsnr }, refined: { mse, psnr }, elapsedSec: dt };
writeFileSync(`${OUT}/strokes.json`, JSON.stringify(strokes, null, 0));
writeFileSync(`${OUT}/report.json`, JSON.stringify(rec, null, 2));

console.log(`[oracle1] strokes=${strokes.length} greedy mse=${greedyMse.toFixed(6)} (${greedyPsnr.toFixed(2)}dB) -> refined mse=${mse.toFixed(6)} (${psnr.toFixed(2)}dB) elapsed=${dt}s`);
console.log(`[oracle1] curve: ${history.map((p) => `${p.strokes}:${p.mse.toFixed(5)}`).join("  ")}`);
console.log(`[oracle1] wrote out/oracle1/ (reference.png flat_final.png montage.png curve.png strokes.json report.json)`);

// —— 极简折线图：axes + polyline，白底黑线 ——
function plotCurve(history) {
  const pw = 800, ph = 500;
  const buf = new Uint8Array(pw * ph * 4).fill(255);
  const xs = history.map((p) => p.strokes), ys = history.map((p) => p.mse);
  const x0 = 60, x1 = pw - 20, y0 = 20, y1 = ph - 50;
  const minX = 0, maxX = Math.max(1, xs[xs.length - 1]);
  const minY = 0, maxY = Math.max(1e-6, ...ys) * 1.05;
  const fx = (x) => x0 + (x - minX) / (maxX - minX) * (x1 - x0);
  const fy = (y) => y1 - (y - minY) / (maxY - minY) * (y1 - y0);
  const line = (ax, ay, bx, by, c = 0) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = (ax + (bx - ax) * t) | 0, y = (ay + (by - ay) * t) | 0;
      if (x < 0 || x >= pw || y < 0 || y >= ph) continue;
      const o = (y * pw + x) * 4;
      buf[o] = buf[o + 1] = buf[o + 2] = c; buf[o + 3] = 255;
    }
  };
  line(x0, y1, x1, y1); line(x0, y1, x0, y0); // 轴
  for (let i = 1; i < xs.length; i++) line(fx(xs[i - 1]), fy(ys[i - 1]), fx(xs[i]), fy(ys[i]));
  return [buf, pw, ph];
}