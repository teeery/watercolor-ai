// 效果测试面板：8 个独立实验（平涂 / 湿接湿过渡 / 罩染 / 干皴 / 回流 / 颗粒 / 边缘 / 洗色）
// 输出：effects_sheet[_spectral].png（全景）+ effects_pX[_spectral].png（每格 ×2 特写）
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

const studio = createStudio({ width: 640, height: 480, seed: 5, painterSeed: 17 });
const { apply, render, composite, engine } = studio;
const tag = studio.colorSystem.name === "spectral" ? "_spectral" : "";

const cols = [85, 235, 385, 535];
const rows = [115, 335];

// P1 平涂湿铺：横向条带扫笔（有起收笔和宽窄变化，不是圆块）
apply({ type: "wet-wash", path: [[cols[0] - 56, rows[0] - 6], [cols[0], rows[0] - 2], [cols[0] + 56, rows[0] + 4]], radius: 58, radiusEnd: 46, pigment: { color: "#5b8fc7", granulation: 0.2, staining: 0.5, amount: 1.39 }, water: 0.8, layers: 1 }, 320);

// P2 湿接湿过渡：两条斜向扫笔交叉（蓝→黄）
apply({ type: "wet-wash", path: [[cols[1] - 42, rows[0] - 48], [cols[1] - 12, rows[0] - 14], [cols[1] + 26, rows[0] + 24]], radius: 30, radiusEnd: 22, pigment: { color: "#5b8fc7", granulation: 0.2, staining: 0.45, amount: 1.65 }, water: 0.85, layers: 1 }, 50);
apply({ type: "wet-wash", path: [[cols[1] + 44, rows[0] - 50], [cols[1] + 14, rows[0] - 16], [cols[1] - 24, rows[0] + 22]], radius: 30, radiusEnd: 22, pigment: { color: "#d8b64a", granulation: 0.25, staining: 0.45, amount: 1.65 }, water: 0.8, layers: 1 }, 380);

// P3 罩染：三条错位扫笔（茜红→藤黄→蓝）
apply({ type: "wet-wash", path: [[cols[2] - 52, rows[0] - 30], [cols[2] + 6, rows[0] - 22], [cols[2] + 52, rows[0] - 8]], radius: 34, radiusEnd: 26, pigment: { color: "#c74a5b", granulation: 0.25, staining: 0.5, amount: 1.32 }, water: 0.6, layers: 1 }, 280);
apply({ type: "glaze", path: [[cols[2] - 40, rows[0] + 14], [cols[2] + 14, rows[0] + 22], [cols[2] + 48, rows[0] + 34]], radius: 30, radiusEnd: 24, pigment: { color: "#d8b64a", granulation: 0.25, staining: 0.4, amount: 1.12 }, water: 0.45 }, 240);
apply({ type: "glaze", path: [[cols[2] - 44, rows[0] - 2], [cols[2] + 10, rows[0] + 4], [cols[2] + 46, rows[0] + 12]], radius: 26, radiusEnd: 20, pigment: { color: "#5b7fc7", granulation: 0.25, staining: 0.4, amount: 0.86 }, water: 0.4 }, 280);

// P4 干皴：三笔不同干湿
apply({ type: "dry-brush", radius: 11, path: [[cols[3] - 40, rows[0] + 46], [cols[3], rows[0] + 22], [cols[3] + 40, rows[0] + 8]], pigment: { color: "#4d7a52", granulation: 0.6, staining: 0.4, amount: 1.98 }, water: 0.12 }, 60);
apply({ type: "dry-brush", radius: 9, path: [[cols[3] - 44, rows[0] + 20], [cols[3] - 4, rows[0] - 2], [cols[3] + 36, rows[0] - 16]], pigment: { color: "#3f6b47", granulation: 0.55, staining: 0.4, amount: 1.82 }, water: 0.22 }, 70);
apply({ type: "dry-brush", radius: 7, path: [[cols[3] - 36, rows[0] - 8], [cols[3] + 2, rows[0] - 28], [cols[3] + 32, rows[0] - 40]], pigment: { color: "#6a9a68", granulation: 0.5, staining: 0.4, amount: 1.65 }, water: 0.3 }, 80);

// P5 回流开花：小湿铺趁湿滴清水
apply({ type: "wet-wash", region: { cx: cols[0], cy: rows[1], rx: 56, ry: 66 }, pigment: { color: "#6f8fa8", granulation: 0.3, staining: 0.45, amount: 1.58 }, water: 0.8, layers: 1 }, 30);
apply({ type: "re-wet", region: { cx: cols[0] - 12, cy: rows[1] - 8, rx: 12, ry: 12 }, water: 0.95 }, 420);

// P6 颗粒聚集：重颗粒群青 vs 细腻茜红
apply({ type: "wet-wash", region: { cx: cols[1] - 26, cy: rows[1], rx: 40, ry: 50 }, pigment: { color: "#3a4a7a", granulation: 1.0, staining: 0.7, amount: 1.82 }, water: 0.6, layers: 2 }, 240);
apply({ type: "wet-wash", region: { cx: cols[1] + 30, cy: rows[1] + 8, rx: 36, ry: 44 }, pigment: { color: "#c74a5b", granulation: 0.05, staining: 0.5, amount: 1.65 }, water: 0.6, layers: 2 }, 240);

// P7 边缘沉积：弧线扫笔（不是圆块）看深色沉积线
apply({ type: "wet-wash", path: [[cols[2] - 54, rows[1] + 30], [cols[2] - 24, rows[1] - 26], [cols[2] + 18, rows[1] - 46], [cols[2] + 54, rows[1] - 24]], radius: 30, radiusEnd: 22, pigment: { color: "#7d8a5b", granulation: 0.35, staining: 0.55, amount: 1.65 }, water: 0.55, layers: 1 }, 420);

// P8 洗色 lift：先铺后洗出亮区
apply({ type: "wet-wash", region: { cx: cols[3], cy: rows[1], rx: 58, ry: 70 }, pigment: { color: "#8a5b6b", granulation: 0.3, staining: 0.55, amount: 1.65 }, water: 0.65, layers: 1 }, 200);
apply({ type: "lift", region: { cx: cols[3] + 6, cy: rows[1] - 4, rx: 24, ry: 16 }, liftP: 0.7, liftD: 0.45, water: 0.3 }, 220);

const full = render();
writePNG(`${OUT}/effects_sheet${tag}.png`, full.data, full.w, full.h);

const { r, g, b, w, h } = composite();
const names = ["p1_flat_wash", "p2_wet_transition", "p3_glaze", "p4_dry_brush", "p5_bloom", "p6_granulation", "p7_edge", "p8_lift"];
let k = 0;
for (let ri = 0; ri < 2; ri++) {
  for (let ci = 0; ci < 4; ci++) {
    const cx = cols[ci], cy = rows[ri];
    const pw = 132, ph = 172, scale = 2;
    const out = new Uint8Array(pw * scale * ph * scale * 4);
    const cl = (v) => (v < 0 ? 0 : v > 1 ? 255 : (v * 255) | 0);
    for (let y = 0; y < ph * scale; y++) {
      for (let x = 0; x < pw * scale; x++) {
        const gx = cx - pw / 2 + (x + 0.5) / scale, gy = cy - ph / 2 + (y + 0.5) / scale;
        const ix0 = Math.max(0, gx | 0), iy0 = Math.max(0, gy | 0);
        const ix1 = Math.min(w - 1, ix0 + 1), iy1 = Math.min(h - 1, iy0 + 1);
        const tx = gx - ix0, ty = gy - iy0;
        const i00 = iy0 * w + ix0, i10 = iy0 * w + ix1, i01 = iy1 * w + ix0, i11 = iy1 * w + ix1;
        const bil = (a) => {
          const v0 = a[i00] + (a[i10] - a[i00]) * tx, v1 = a[i01] + (a[i11] - a[i01]) * tx;
          return v0 + (v1 - v0) * ty;
        };
        const o = (y * pw * scale + x) * 4;
        out[o] = cl(bil(r)); out[o + 1] = cl(bil(g)); out[o + 2] = cl(bil(b)); out[o + 3] = 255;
      }
    }
    writePNG(`${OUT}/effects_${names[k++]}${tag}.png`, out, pw * scale, ph * scale);
  }
}
console.log(`[${studio.colorSystem.name}] wrote effects_sheet${tag}.png + 8 panel crops`);
