// 任务 4 验收 · 着色力曲线（v4：低水流协议——集成后重标定）
// 普蓝 vs 群青，浓度阶梯 amount = [0.1, 0.25, 0.5, 1.0]，glaze + 低水（water 0.25）
// 着色力签名 = 浓度响应度：普蓝（κ3.0）稀释梯度陡，群青（κ1.0+重沉降）早饱和
// 门：ΔL(0.1→0.25) 比 普蓝/群青 ≥ 1.5
// 输出：out/color/tint_test.png + tint_report.json + 控制台
import { createStudio, makeColorSystem } from "../src/studio/studio.js";
import { srgbToLab } from "../src/color/srgb.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "out/color";
mkdirSync(OUT, { recursive: true });
const W = 640, H = 480;

const studio = createStudio({ width: W, height: H, seed: 9, painterSeed: 17, colorSystem: makeColorSystem("spectral") });
const { apply, engine, composite } = studio;

const AMOUNTS = [0.1, 0.25, 0.5, 1.0];
const ROWS = [
  { name: "普蓝", hex: "#1f3d5e", y: 150, strength: 3.0 },
  { name: "群青", hex: "#3a3269", y: 330, strength: 1.0 },
];
const XS = [100, 245, 390, 535];

for (const row of ROWS) {
  for (let k = 0; k < AMOUNTS.length; k++) {
    apply({ type: "glaze", region: { cx: XS[k], cy: row.y, rx: 55, ry: 42 }, pigment: { name: row.name, color: row.hex, amount: AMOUNTS[k] }, water: 0.25, layers: 1 }, 60);
  }
}
engine.step(200);
const { r, g, b, w } = composite();

function boxLab(cx, cy, rad = 3) {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      const i = y * w + x;
      sr += r[i]; sg += g[i]; sb += b[i]; n++;
    }
  }
  return srgbToLab([sr / n, sg / n, sb / n]);
}

const report = { date: new Date().toISOString().slice(0, 10), test: "着色力曲线 v4（低水流 glaze 协议，隔离 M5 沉降）", amounts: AMOUNTS, rows: [] };
console.log("amount     普蓝 L*   群青 L*");
const curves = {};
for (const row of ROWS) {
  const curve = [];
  for (let k = 0; k < AMOUNTS.length; k++) {
    curve.push(+boxLab(XS[k], row.y).L.toFixed(1));
  }
  curves[row.name] = curve;
  report.rows.push({ name: row.name, strength: row.strength, LByAmount: curve });
}
for (let k = 0; k < AMOUNTS.length; k++) {
  console.log(`${AMOUNTS[k].toFixed(2).padStart(6)} ${curves.普蓝[k].toFixed(1).padStart(9)} ${curves.群青[k].toFixed(1).padStart(9)}`);
}

// 着色力签名（集成后重标定）：浓度响应度——普蓝（κ3.0）稀释梯度陡，群青（κ1.0+重沉降）早饱和
// 门：ΔL(0.1→0.25) 比 普蓝/群青 ≥ 1.5
const dPr = curves.普蓝[0] - curves.普蓝[1];
const dUl = curves.群青[0] - curves.群青[1];
report.slopeRatio = +(dPr / dUl).toFixed(2);
const pass = dPr / dUl >= 1.5;
report.pass = pass;
console.log(`\n浓度响应度 ΔL(0.1→0.25)：普蓝 ${dPr.toFixed(1)}，群青 ${dUl.toFixed(1)}，比 = ${report.slopeRatio}（门 ≥ 1.5）→ ${pass ? "PASS" : "FAIL"}`);

const img = studio.render();
writePNG(`${OUT}/tint_test.png`, img.data, img.w, img.h);
writeFileSync(`${OUT}/tint_report.json`, JSON.stringify(report, null, 2));
console.log(`wrote ${OUT}/tint_test.png + tint_report.json`);
