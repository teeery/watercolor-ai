// M5 验收面板：湿中混色互渗 / 粒重分离 / 再湿率
// 输出：m5_p1_mix.png, m5_p2_separate.png, m5_p3_rewet.png, m5_sheet.png
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";

const OUT = "out";
mkdirSync(OUT, { recursive: true });
const PW = 128, PH = 128, SC = 2;

const crop = (img, gx, gy, gw, gh, scale) => {
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
const blit = (src, dst, dx, dy) => {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4, d = ((dy + y) * dst.w + dx + x) * 4;
      dst.data[d] = src.data[s]; dst.data[d + 1] = src.data[s + 1]; dst.data[d + 2] = src.data[s + 2]; dst.data[d + 3] = 255;
    }
  }
};

// —— P1 湿中混色：玫瑰红(染色0.8 扩散慢) × 柠檬黄(染色0.3 扩散快) 湿接 ——
const s1 = createStudio({ width: 640, height: 480, seed: 11, painterSeed: 29 });
s1.apply({ type: "wet-wash", region: { cx: 200, cy: 240, rx: 62, ry: 74 }, pigment: { color: "#a8505c", granulation: 0.2, staining: 0.8, amount: 1.5 }, water: 0.7 }, 25);
s1.apply({ type: "wet-wash", region: { cx: 300, cy: 240, rx: 62, ry: 74 }, pigment: { color: "#ecd800", granulation: 0.1, staining: 0.3, amount: 1.5 }, water: 0.7 }, 280);
const f1 = s1.render();
writePNG(`${OUT}/m5_p1_mix.png`, ...(() => { const c = crop(f1, 272, 352, PW * SC, PH * SC, 1); return [c.data, c.w, c.h]; })());

// —— P2 分离（并排对比）：群青(重) 与 玫瑰红(轻) 同参数重力淌流，轻颜料应淌得更远 ——
const s2 = createStudio({ width: 640, height: 480, seed: 11, painterSeed: 29, params: { gravRun: 0.3, runW0: 0.1, evap: 0.005 } });
s2.apply({ type: "wet-wash", region: { cx: 190, cy: 150, rx: 48, ry: 40 }, pigment: { color: "#37496e", granulation: 0.9, staining: 0.4, amount: 1.6 }, water: 0.9, layers: 2 }, 480);
s2.apply({ type: "wet-wash", region: { cx: 310, cy: 150, rx: 48, ry: 40 }, pigment: { color: "#5296be", granulation: 0.15, staining: 0.4, amount: 1.6 }, water: 0.9, layers: 2 }, 480);
const f2 = s2.render();
writePNG(`${OUT}/m5_p2_separate.png`, ...(() => { const c = crop(f2, 240, 180, 384, 256, 1); return [c.data, c.w, c.h]; })());

// —— P3 再湿率：群青(染色0.4 再湿强) vs 普蓝(染色0.85 再湿弱) 同滴清水 ——
const s3 = createStudio({ width: 640, height: 480, seed: 11, painterSeed: 29 });
s3.apply({ type: "wet-wash", region: { cx: 200, cy: 240, rx: 56, ry: 66 }, pigment: { color: "#37496e", granulation: 0.9, staining: 0.4, amount: 1.6 }, water: 0.7 }, 160);
s3.apply({ type: "wet-wash", region: { cx: 300, cy: 240, rx: 56, ry: 66 }, pigment: { color: "#1f3d5e", granulation: 0.35, staining: 0.85, amount: 1.6 }, water: 0.7 }, 160);
// 各自带对应颜料属性的清水滴（再湿率由 setPigment 携带）
s3.apply({ type: "re-wet", region: { cx: 200, cy: 240, rx: 16, ry: 16 }, water: 0.95, pigment: { color: "#37496e", granulation: 0.9, staining: 0.4, amount: 0 } }, 300);
s3.apply({ type: "re-wet", region: { cx: 300, cy: 240, rx: 16, ry: 16 }, water: 0.95, pigment: { color: "#1f3d5e", granulation: 0.35, staining: 0.85, amount: 0 } }, 300);
const f3 = s3.render();
writePNG(`${OUT}/m5_p3_rewet.png`, ...(() => { const c = crop(f3, 272, 352, PW * SC, PH * SC, 1); return [c.data, c.w, c.h]; })());

// —— 合并（P2 居中加宽）——
const sheet = { data: new Uint8Array((256 + 384 + 256) * 256 * 4), w: 256 + 384 + 256, h: 256 };
blit(crop(f1, 272, 352, 256, 256, 1), sheet, 0, 0);
blit(crop(f2, 240, 180, 384, 256, 1), sheet, 256, 0);
blit(crop(f3, 272, 352, 256, 256, 1), sheet, 640, 0);
writePNG(`${OUT}/m5_sheet.png`, sheet.data, sheet.w, sheet.h);
console.log("wrote m5_p1_mix / m5_p2_separate / m5_p3_rewet / m5_sheet");
