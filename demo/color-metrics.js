// 色彩深度测量：RGB 系统 vs 光谱系统，24 色全强度 CIELAB 对比（L* 明度 / C* 色度 / ΔE）
import { createStudio, makeColorSystem } from "../src/studio/studio.js";
import { srgbToLab } from "../src/color/srgb.js";
import { PIGMENTS } from "../src/color/pigments.js";

const COLS = 6, CH = 120, CW = 640 / 6;
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

function measure(colorSystem) {
  const studio = createStudio({ width: 640, height: 480, seed: 21, painterSeed: 31, colorSystem });
  const { apply, composite } = studio;
  for (let i = 0; i < 24; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW + CW / 2, cy = row * CH + CH * 0.5;
    apply({
      type: "wet-wash", region: { cx, cy, rx: 40, ry: 40 },
      pigment: { name: p.name, color: p.hex, granulation: p.granulation, staining: p.staining, amount: 2.4 },
      water: 0.5, layers: 1,
    }, 200);
  }
  studio.engine.step(300);
  const { r, g, b, w, h } = composite();
  const rows = [];
  for (let i = 0; i < 24; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = Math.round(col * CW + CW / 2), cy = Math.round(row * CH + CH * 0.5);
    const idx = cy * w + cx;
    const target = srgbToLab(hex2rgb(p.hex));
    const meas = srgbToLab([r[idx], g[idx], b[idx]]);
    rows.push({
      name: p.name, target, meas,
      dE: Math.hypot(meas.L - target.L, meas.a - target.a, meas.b - target.b),
      dC: meas.C - target.C,
    });
  }
  return rows;
}

const rgb = measure(makeColorSystem("rgb"));
const spec = measure(makeColorSystem("spectral"));
console.log("颜料        RGB:ΔE  RGB:ΔC*   光谱:ΔE  光谱:ΔC*");
const dEsum = { rgb: 0, spec: 0 };
for (let i = 0; i < 24; i++) {
  dEsum.rgb += rgb[i].dE; dEsum.spec += spec[i].dE;
  console.log(
    PIGMENTS[i].name.padEnd(6),
    rgb[i].dE.toFixed(1).padStart(8),
    rgb[i].dC.toFixed(1).padStart(7),
    spec[i].dE.toFixed(1).padStart(8),
    spec[i].dC.toFixed(1).padStart(7),
  );
}
console.log(`\n平均 ΔE：RGB ${(dEsum.rgb / 24).toFixed(1)} | 光谱 ${(dEsum.spec / 24).toFixed(1)}`);
