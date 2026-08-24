// Oracle 1 终证 · 网格尺度天花板定位：抹平目标(r=2)下，「软笔(现配置)」vs「硬边+不透明」谁更高？
// 若硬边+不透明把 fitPSNR(vs blur2) 从 ~18.9dB 显著顶高 → 地板成因 = 软剪影/低不透明度（可修，处方=硬轮廓+不透明）；
// 若几乎不动 → 网格尺度亦是更深瓶颈（贪心求解/表示）。
import { fitFlat, refineColors, loadTarget, msePsnr, boxBlurRGB } from "../src/paintability/oracle1.js";
import { existsSync } from "node:fs";

const W = 480, H = 640;
const REF = "out/copy-ref/乡村田野.png";
if (!existsSync(REF)) { console.error(`[oracle1-hardtest] 缺参照 ${REF}`); process.exit(1); }

const target = loadTarget(REF, W, H);
const blur2 = boxBlurRGB(target, W, H, 2);

function runCfg(label, opts) {
  const t0 = performance.now();
  const { strokes, canvas } = fitFlat(blur2, { w: W, h: H, maxStrokes: 160, candidates: 96, seed: 7, ...opts });
  refineColors(blur2, canvas, strokes, { passes: 3 });
  const { mse, psnr } = msePsnr(blur2, canvas.rgb);
  console.log(`[${label}] fitPSNR(vs blur2)=${psnr.toFixed(2)}dB  mse=${mse.toFixed(6)}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
  return psnr;
}

const soft = runCfg("soft     (现配置)", {});
const hard = runCfg("hard+opaque", { opaque: true, hard: true });
const hardSoft = runCfg("hard only", { hard: true });

console.log(`\nsoft=${soft.toFixed(2)}dB  hard+opaque=${hard.toFixed(2)}dB  hard-only=${hardSoft.toFixed(2)}dB`);
console.log(hard > soft + 1 ? "=> 硬边+不透明显著顶开网格尺度天花板：地板成因 = 软剪影/低不透明度（可修）" : "=> 硬边+不透明改动不大：网格尺度瓶颈更深（贪心求解或表示本身）");