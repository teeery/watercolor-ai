// M4 廉价件验收面板：盐花 / 硬边 vs 软边 / 重力淌色 / lift 堆挤 / 纸纹三档
// 输出：m4_p1_salt.png ... m4_p5_paper.png + m4_sheet.png（并排）
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

const PW = 128, PH = 128;           // 每面板网格尺寸
const SC = 2;                       // 2× 上采样
const blit = (src, dst, dx, dy) => { // src: {data,w,h} → dst 起点 (dx,dy)
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4, d = ((dy + y) * dst.w + dx + x) * 4;
      dst.data[d] = src.data[s]; dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2]; dst.data[d + 3] = 255;
    }
  }
};
const crop = (img, gx, gy, gw, gh, scale) => { // 从渲染图裁面板区并上采样
  const out = new Uint8Array(gw * scale * gh * scale * 4);
  for (let y = 0; y < gh * scale; y++) {
    for (let x = 0; x < gw * scale; x++) {
      const fx = gx + (x + 0.5) / scale, fy = gy + (y + 0.5) / scale;
      const ix = Math.min(img.w - 1, fx | 0), iy = Math.min(img.h - 1, fy | 0);
      const s = (iy * img.w + ix) * 4, d = (y * gw * scale + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = 255;
    }
  }
  return { data: out, w: gw * scale, h: gh * scale };
};

// —— P1 盐花 + P2 硬边 vs 软边 + P4 lift 堆挤（共用主 studio，冷压纸）——
const studio = createStudio({ width: 640, height: 480, seed: 9, painterSeed: 23 });
const { apply, render } = studio;

// P1 盐花：颗粒蓝湿铺 + 撒盐
apply({ type: "wet-wash", region: { cx: 64, cy: 240, rx: 44, ry: 66 }, pigment: { color: "#3a4a7a", granulation: 0.9, staining: 0.7, amount: 1.6 }, water: 0.65, layers: 1 }, 40);
apply({ type: "salt", center: { cx: 64, cy: 240 }, count: 9, spread: 40, rMin: 5, rMax: 14, lift: 0.95, arms: 5 }, 320);

// P2 硬边（hard 标志 + soft 0.5）vs 软边（soft 10）
apply({ type: "wet-wash", region: { cx: 164, cy: 240, rx: 36, ry: 60 }, pigment: { color: "#c74a5b", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.55, hard: true }, 220);
apply({ type: "wet-wash", region: { cx: 232, cy: 240, rx: 36, ry: 60 }, pigment: { color: "#c74a5b", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.55, soft: 10 }, 220);

// P4 lift 堆挤：铺色后向右擦拭，右侧边缘应有颜料堆积
apply({ type: "wet-wash", region: { cx: 448, cy: 240, rx: 52, ry: 64 }, pigment: { color: "#8a5b6b", granulation: 0.3, staining: 0.55, amount: 1.5 }, water: 0.6, layers: 1 }, 200);
apply({ type: "lift", region: { cx: 448, cy: 240, rx: 34, ry: 26 }, liftP: 0.55, liftD: 0.35, water: 0.3, dir: 0, push: 0.85 }, 240);

const full1 = render();
// full1 已是 2× 图（1280×960）：裁切用 2× 坐标、scale 1
writePNG(`${OUT}/m4_p1_salt.png`, ...(() => { const c = crop(full1, 0, 352, PW * SC, PH * SC, 1); return [c.data, c.w, c.h]; })());
writePNG(`${OUT}/m4_p2_hardedge.png`, ...(() => { const c = crop(full1, 256, 352, PW * SC, PH * SC, 1); return [c.data, c.w, c.h]; })());
writePNG(`${OUT}/m4_p4_liftpile.png`, ...(() => { const c = crop(full1, 768, 352, PW * SC, PH * SC, 1); return [c.data, c.w, c.h]; })());

// —— P3 重力淌色（独立 studio；蒸发放慢 + 淌动中固着慢 → 颜料随水流走）——
const gStudio = createStudio({ width: 640, height: 480, seed: 9, painterSeed: 23, params: { gravRun: 0.4, runW0: 0.1, evap: 0.004 } });
gStudio.apply({ type: "wet-wash", region: { cx: 64, cy: 150, rx: 52, ry: 40 }, pigment: { color: "#5b8fc7", granulation: 0.3, staining: 0.3, amount: 1.6 }, water: 0.95, layers: 3 }, 420);
const gFull = gStudio.render();
writePNG(`${OUT}/m4_p3_run.png`, ...(() => { const c = crop(gFull, 0, 224, PW * SC, PH * SC, 1); return [c.data, c.w, c.h]; })());

// —— P5 纸纹三档（hot/cold/rough 三个 studio）——
const sheetP5 = new Uint8Array(PW * SC * 3 * PH * SC * 4);
const presets = ["hot", "cold", "rough"];
const hex = ["#7da6c9", "#7da6c9", "#7da6c9"];
for (let p = 0; p < 3; p++) {
  const ps = createStudio({ width: 128, height: 128, seed: 9, painterSeed: 23, params: { paper: { preset: presets[p] } } });
  ps.apply({ type: "wet-wash", region: { cx: 64, cy: 64, rx: 44, ry: 48 }, pigment: { color: hex[p], granulation: p === 2 ? 1.0 : 0.8, staining: 0.55, amount: 1.6 }, water: 0.6, layers: 1 }, 300);
  const img = ps.render();
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      const d = (y * PW * SC * 3 + p * PW * SC + x) * 4;
      sheetP5[d] = img.data[s]; sheetP5[d + 1] = img.data[s + 1]; sheetP5[d + 2] = img.data[s + 2]; sheetP5[d + 3] = 255;
    }
  }
}
writePNG(`${OUT}/m4_p5_paper.png`, sheetP5, PW * SC * 3, PH * SC);

// —— 合并 sheet（5 面板并排）——
const sheet = { data: new Uint8Array(PW * SC * 5 * PH * SC * 4), w: PW * SC * 5, h: PH * SC };
const bufs = [crop(full1, 0, 352, PW * SC, PH * SC, 1), crop(full1, 256, 352, PW * SC, PH * SC, 1), crop(gFull, 0, 224, PW * SC, PH * SC, 1), crop(full1, 768, 352, PW * SC, PH * SC, 1), { data: sheetP5, w: PW * SC * 3, h: PH * SC }];
for (let p = 0; p < 5; p++) blit(bufs[p], sheet, p * PW * SC, 0);
writePNG(`${OUT}/m4_sheet.png`, sheet.data, sheet.w, sheet.h);
console.log("wrote m4_p1_salt / m4_p2_hardedge / m4_p3_run / m4_p4_liftpile / m4_p5_paper / m4_sheet");
