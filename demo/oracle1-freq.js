// Oracle 1 终证 · 频率消融：抹平子网格纹理后，表示能否吃下「网格可分辨的内容」？
// 对 480×640 目标做 box-blur(r=0..4)，分别拟合并测：
//   fitPSNR = PSNR(拟合, 抹平目标)          —— 表示对「可分辨结构」的重建能力
//   gapPSNR = PSNR(原图, 抹平目标)          —— 抹平掉的子网格高频有多大（信息地板）
// 若 fitPSNR 随 r 显著爬升、且 r≥2 时 gapPSNR 掉到 ≈17dB（与未抹平拟合的原样 PSNR 同量级），
// 即证明：表示已吃下网格可分辨内容，剩余 17.3dB 缺口 = 子网格高频纹理（频率上限）。铁证。
import { fitFlat, refineColors, loadTarget, msePsnr, boxBlurRGB } from "../src/paintability/oracle1.js";
import { writePNG } from "../src/io/png.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "out/oracle1";
mkdirSync(OUT, { recursive: true });
const W = 480, H = 640;
const REF = "out/copy-ref/乡村田野.png";
const radii = [0, 1, 2, 3, 4];

if (!existsSync(REF)) {
  console.error(`[oracle1-freq] 参照图不存在：${REF}（按仓库惯例，参照原件仅本地，不入库）`);
  process.exit(1);
}

const target = loadTarget(REF, W, H);
const rows = [];

for (const r of radii) {
  const tp = r === 0 ? target : boxBlurRGB(target, W, H, r);
  const t0 = performance.now();
  const { strokes, history, canvas } = fitFlat(tp, { w: W, h: H, maxStrokes: 160, candidates: 96, seed: 7 });
  refineColors(tp, canvas, strokes, { passes: 3 });
  const { mse, psnr } = msePsnr(tp, canvas.rgb);
  const gap = r === 0 ? msePsnr(target, target).psnr : msePsnr(target, tp).psnr;
  const dt = ((performance.now() - t0) / 1000).toFixed(1);
  rows.push({ r, fitPSNR: +psnr.toFixed(2), gapPSNR: +gap.toFixed(2), fitMse: +mse.toFixed(6), sec: +dt });
  console.log(`r=${r}  fitPSNR=${psnr.toFixed(2)}dB  gapPSNR(orig-vs-blur)=${gap.toFixed(2)}dB  fitMSE=${mse.toFixed(6)}  (${dt}s)`);

  // 存 r=0 / r=2 的拟合与抹平目标对比图（便于人眼/vision 复核）
  if (r === 0 || r === 2) {
    const panel = (frgb) => {
      const img = new Uint8Array(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        const o = i * 4, s = i * 3;
        img[o] = (frgb[s] * 255) | 0; img[o + 1] = (frgb[s + 1] * 255) | 0; img[o + 2] = (frgb[s + 2] * 255) | 0; img[o + 3] = 255;
      }
      return img;
    };
    const side = (buf) => { const size = 256; const out = new Uint8Array(size * size * 4); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const si = ((y * H / size | 0) * W + (x * W / size | 0)) * 4; const di = (y * size + x) * 4; out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = 255; } return { data: out, size }; };
    const a = side(panel(tp)), b = side(panel(canvas.rgb));
    const mw = 512, mh = 256, mont = new Uint8Array(mw * mh * 4);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const src = (x < 256 ? a.data : b.data), si = (y * 256 + (x % 256)) * 4, di = (y * mw + x) * 4;
      mont[di] = src[si]; mont[di + 1] = src[si + 1]; mont[di + 2] = src[si + 2]; mont[di + 3] = 255;
    }
    writePNG(`${OUT}/freq_r${r}.png`, mont, mw, mh);
  }
}

console.log("\n=== 频率消融表（160 笔 + 颜色精修）===");
console.log("r\tfitPSNR\tgapPSNR(orig-vs-blur)\t判读");
for (const row of rows) {
  console.log(`${row.r}\t${row.fitPSNR}\t${row.gapPSNR}\t${row.r === 0 ? "未抹平基线(=17.3dB 级缺口)" : row.gapPSNR <= 18 ? "缺口已在 17-18dB：子网格高频即地板" : "缺口尚大"}`);
}
writeFileSync(`${OUT}/freq-ablation.json`, JSON.stringify(rows, null, 2));
console.log("\nwrote out/oracle1/freq-ablation.json + freq_r0.png + freq_r2.png");