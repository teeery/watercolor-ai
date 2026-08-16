// 裁切输出：跑场景到指定位置后输出局部放大图（vision 细评用）
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { scene } from "./scene.js";

const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const tag = studio.colorSystem.name === "spectral" ? "_spectral" : "";
for (const { stroke, stepsAfter } of scene) studio.apply(stroke, stepsAfter);

const { r, g, b, w, h } = studio.composite();

function cropToPNG(x0, y0, x1, y1, scale, name) {
  const cw = x1 - x0, ch = y1 - y0;
  const out = new Uint8Array(cw * scale * ch * scale * 4);
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 255 : (v * 255) | 0);
  for (let y = 0; y < ch * scale; y++) {
    for (let x = 0; x < cw * scale; x++) {
      const gx = x0 + (x + 0.5) / scale - 0.5, gy = y0 + (y + 0.5) / scale - 0.5;
      const ix0 = Math.max(0, gx | 0), iy0 = Math.max(0, gy | 0);
      const ix1 = Math.min(w - 1, ix0 + 1), iy1 = Math.min(h - 1, iy0 + 1);
      const tx = gx - ix0, ty = gy - iy0;
      const i00 = iy0 * w + ix0, i10 = iy0 * w + ix1, i01 = iy1 * w + ix0, i11 = iy1 * w + ix1;
      const o = (y * cw * scale + x) * 4;
      const bil = (a) => {
        const v0 = a[i00] + (a[i10] - a[i00]) * tx, v1 = a[i01] + (a[i11] - a[i01]) * tx;
        return v0 + (v1 - v0) * ty;
      };
      out[o] = cl(bil(r)); out[o + 1] = cl(bil(g)); out[o + 2] = cl(bil(b)); out[o + 3] = 255;
    }
  }
  writePNG(`out/${name}${tag}.png`, out, cw * scale, ch * scale);
  console.log(`[${studio.colorSystem.name}] wrote out/${name}${tag}.png (${cw * scale}x${ch * scale})`);
}

cropToPNG(10, 285, 230, 400, 3, "crop_pond");
cropToPNG(455, 380, 600, 460, 3, "crop_granulation");
