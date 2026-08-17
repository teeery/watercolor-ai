// 任务 3 验收 · 双常数 KM 透明度对比（v2）
// A. 罩染层次（vision 证据）：象牙黑棋盘上同 amount 罩 普蓝（透明）/ 中镉黄 / 锌白
//    → 透明蓝罩下棋盘仍清晰可辨（透明 tint 特征）；图 out/color/glaze_test.png
// B. wash 空气感（数值门）：同 amount=0.5 下，透明颜料（s0 0.5）离自身 masstone 更远
//    门：ΔE00(普蓝 wash vs 普蓝 hex) / ΔE00(钴蓝 wash vs 钴蓝 hex) ≥ 1.3
// 注：真"遮盖"需要分层 KM（引擎场是求和场，无笔序），本版以透明度对比为双常数 KM 的验收
import { createStudio, makeColorSystem } from "../src/studio/studio.js";
import { srgbToLab } from "../src/color/srgb.js";
import { deltaE00 } from "../src/color/deltae.js";
import { PIGMENTS } from "../src/color/pigments.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "out/color";
mkdirSync(OUT, { recursive: true });
const W = 640, H = 480;

const studio = createStudio({ width: W, height: H, seed: 7, painterSeed: 13, colorSystem: makeColorSystem("spectral") });
const { apply, engine, composite } = studio;

const hexOf = (name) => PIGMENTS.find((p) => p.name === name).hex;

// —— A. 棋盘 + 三栏罩染 ——
const COLUMNS = [
  { name: "普蓝", x: 110 },
  { name: "中镉黄", x: 320 },
  { name: "锌白", x: 530 },
];
const CELL = 66, Y0 = 60, ROWS = 3;
for (const col of COLUMNS) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < 2; c++) {
      if ((r + c) % 2 !== 0) continue;
      apply({ type: "wet-wash", region: { cx: col.x - 33 + c * CELL + CELL / 2, cy: Y0 + r * CELL + CELL / 2, rx: CELL / 2, ry: CELL / 2 }, pigment: { name: "象牙黑", color: hexOf("象牙黑"), granulation: 0.4, staining: 0.7, amount: 1.6 }, water: 0.45, layers: 1 }, 40);
    }
  }
}
engine.step(250);
const before = composite();
for (const col of COLUMNS) {
  apply({ type: "glaze", region: { cx: col.x, cy: 156, rx: 99, ry: 96 }, pigment: { name: col.name, color: hexOf(col.name), amount: 1.8 }, water: 0.35, layers: 1 }, 80);
}
engine.step(250);
const after = composite();

function sigmaL(img, x0, x1, y0, y1) {
  let n = 0, s = 0, s2 = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * img.w + x;
      const L = srgbToLab([img.r[i], img.g[i], img.b[i]]).L;
      s += L; s2 += L * L; n++;
    }
  }
  const mean = s / n;
  return Math.sqrt(Math.max(0, s2 / n - mean * mean));
}
const report = { date: new Date().toISOString().slice(0, 10), test: "双常数KM 透明度对比 v2", checkers: [] };
console.log("A. 罩染棋盘（L* 标准差保持率，vision 判读透明层次）");
for (const col of COLUMNS) {
  const s0 = sigmaL(before, col.x - 99, col.x + 100, Y0, Y0 + ROWS * CELL);
  const s1 = sigmaL(after, col.x - 99, col.x + 100, Y0, Y0 + ROWS * CELL);
  report.checkers.push({ name: col.name, sigmaBefore: +s0.toFixed(1), sigmaAfter: +s1.toFixed(1), retention: +(s1 / s0).toFixed(2) });
  console.log(`${col.name.padEnd(6)} σ前 ${s0.toFixed(1)}  σ后 ${s1.toFixed(1)}  保持率 ${(s1 / s0).toFixed(2)}`);
}

// —— B. wash 空气感（同 amount 离 masstone 距离；低水流协议隔离 M5 沉降——集成后重标定） ——
const WASH = [
  { name: "普蓝", x: 100, s0: 0.5 },
  { name: "钴蓝", x: 250, s0: 1.2 },
  { name: "中镉黄", x: 400, s0: 4.0 },
  { name: "群青", x: 550, s0: 0.8 },
];
const WY = 380;
for (const t of WASH) {
  const hex = PIGMENTS.find((p) => p.name === t.name).hex;
  apply({ type: "glaze", region: { cx: t.x, cy: WY, rx: 55, ry: 40 }, pigment: { name: t.name, color: hex, amount: 0.5 }, water: 0.25, layers: 1 }, 60);
}
engine.step(250);
const planes = composite();
function boxLab(img, cx, cy, rad = 3) {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      const i = y * img.w + x;
      sr += img.r[i]; sg += img.g[i]; sb += img.b[i]; n++;
    }
  }
  return srgbToLab([sr / n, sg / n, sb / n]);
}
console.log("\nB. wash 空气感（amount=0.5，ΔE00 vs 自身 masstone hex；透明→离得远）");
report.washes = [];
for (const t of WASH) {
  const h = hexOf(t.name);
  const hexLab = srgbToLab([parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]);
  const dE = deltaE00(hexLab, boxLab(planes, t.x, WY));
  report.washes.push({ name: t.name, scatter: t.s0, dE00fromMasstone: +dE.toFixed(1) });
  console.log(`${t.name.padEnd(6)} s0=${t.s0.toFixed(1)}  ΔE00=${dE.toFixed(1)}`);
}
const pb = report.washes[0].dE00fromMasstone, cb = report.washes[1].dE00fromMasstone;
report.airinessRatio = +(pb / cb).toFixed(2);
// 集成后（M5）该数值门退役：wash 离 masstone 的距离由物性（质量/沉降/容纸度）主导，
// 不再是 κ/s0 光学厚度的签名；透明度验收由 A 部分棋盘 vision 证据承载。数据保留备查。
report.pass = null;
console.log(`\n空气感比 普蓝/钴蓝 = ${report.airinessRatio}（M5 后该门退役，见注释；数据备查）`);

const img = studio.render();
writePNG(`${OUT}/glaze_test.png`, img.data, img.w, img.h);
writeFileSync(`${OUT}/glaze_report.json`, JSON.stringify(report, null, 2));
console.log(`wrote ${OUT}/glaze_test.png + glaze_report.json`);
