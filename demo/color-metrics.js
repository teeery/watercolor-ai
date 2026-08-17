// 色彩回归基准 v2（色彩线验收尺子，替代旧版单点 ΔE76）
// 浓档 amount=2.4（wet-wash）+ 淡档 amount=0.7（glaze）× ΔE76 / ΔE00 / ΔC / ΔH(°) × 24 色 × 双系统
// 输出：控制台表 + out/color/report.json（旧基线的浓档 ΔE76 均值仍在表里，可与 baseline.json 对照）
import { createStudio, makeColorSystem } from "../src/studio/studio.js";
import { srgbToLab } from "../src/color/srgb.js";
import { deltaE76, deltaE00, hueDiffDeg, chromaDiff } from "../src/color/deltae.js";
import { PIGMENTS } from "../src/color/pigments.js";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT_DIR = "out/color";
const COLS = 6, CH = 120, CW = 640 / 6;
const STRONG = { type: "wet-wash", amount: 2.4, water: 0.5 };
const DILUTE = { type: "glaze", amount: 0.7, water: 0.6 };
const FIX_TARGETS = ["紫罗兰", "翠绿", "生褐", "锌白"];
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const strongCy = (row) => row * CH + CH * 0.30;
const diluteCy = (row) => row * CH + CH * 0.68;

function boxMean(r, g, b, w, h, cx, cy, rad = 3) {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      const i = y * w + x;
      sr += r[i]; sg += g[i]; sb += b[i]; n++;
    }
  }
  return [sr / n, sg / n, sb / n];
}

function measure(colorSystem) {
  const studio = createStudio({ width: 640, height: 480, seed: 21, painterSeed: 31, colorSystem });
  const { apply, composite } = studio;
  for (let i = 0; i < PIGMENTS.length; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW + CW / 2;
    const pig = { name: p.name, color: p.hex, granulation: p.granulation, staining: p.staining };
    apply({ type: STRONG.type, region: { cx, cy: strongCy(row), rx: 36, ry: 26 }, pigment: { ...pig, amount: STRONG.amount }, water: STRONG.water, layers: 1 }, 100);
    apply({ type: DILUTE.type, region: { cx, cy: diluteCy(row), rx: 36, ry: 26 }, pigment: { ...pig, amount: DILUTE.amount }, water: DILUTE.water, layers: 1 }, 100);
  }
  studio.engine.step(300);
  const { r, g, b, w, h } = composite();
  const rows = [];
  for (let i = 0; i < PIGMENTS.length; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = Math.round(col * CW + CW / 2);
    const target = srgbToLab(hex2rgb(p.hex));
    const sLab = srgbToLab(boxMean(r, g, b, w, h, cx, Math.round(strongCy(row))));
    const dLab = srgbToLab(boxMean(r, g, b, w, h, cx, Math.round(diluteCy(row))));
    rows.push({
      name: p.name,
      strong: {
        dE76: +deltaE76(target, sLab).toFixed(1), dE00: +deltaE00(target, sLab).toFixed(1),
        dC: +chromaDiff(target, sLab).toFixed(1), dH: +hueDiffDeg(target, sLab).toFixed(1),
        lab: sLab,
      },
      dilute: {
        dE76: +deltaE76(target, dLab).toFixed(1), dE00: +deltaE00(target, dLab).toFixed(1),
        dC: +chromaDiff(target, dLab).toFixed(1), dH: +hueDiffDeg(target, dLab).toFixed(1),
        lab: dLab,
      },
    });
  }
  return rows;
}

const systems = { rgb: measure(makeColorSystem("rgb")), spectral: measure(makeColorSystem("spectral")) };

// —— 控制台表 ——
for (const [sysName, rows] of Object.entries(systems)) {
  const label = sysName === "spectral" ? "光谱" : "RGB ";
  console.log(`\n== ${label}系统（浓 ${STRONG.amount} / 淡 ${DILUTE.amount}）==`);
  console.log("颜料       浓ΔE00 浓ΔC  浓ΔH   淡ΔE00 淡ΔC  淡ΔH");
  const m = { s00: 0, s76: 0, d00: 0, dH: 0, dC: 0 };
  for (const row of rows) {
    const s = row.strong, d = row.dilute;
    m.s00 += s.dE00; m.s76 += s.dE76; m.d00 += d.dE00; m.dH += Math.abs(d.dH); m.dC += Math.abs(d.dC);
    console.log(
      `${row.name.padEnd(5)} ${s.dE00.toFixed(1).padStart(6)} ${s.dC.toFixed(1).padStart(5)} ${s.dH.toFixed(0).padStart(5)}`
      + `   ${d.dE00.toFixed(1).padStart(6)} ${d.dC.toFixed(1).padStart(5)} ${d.dH.toFixed(0).padStart(5)}`,
    );
  }
  console.log(`均值          ${(m.s00 / 24).toFixed(1).padStart(6)}（浓ΔE76 ${(m.s76 / 24).toFixed(1)}）`
    + `   ${(m.d00 / 24).toFixed(1).padStart(6)} |ΔH| ${(m.dH / 24).toFixed(1)}° |ΔC| ${(m.dC / 24).toFixed(1)}`);
}

// —— 四支偏色方向诊断（目标 vs 实测 Lab） ——
const fmt = (l) => `${l.L.toFixed(0)} ${l.a.toFixed(1)} ${l.b.toFixed(1)} C${Math.hypot(l.a, l.b).toFixed(1)}`;
console.log("\n== 四支偏色方向诊断（光谱系统：L / a / b / C*）==");
for (const name of FIX_TARGETS) {
  const row = systems.spectral.find((r) => r.name === name);
  const t = srgbToLab(hex2rgb(PIGMENTS.find((p) => p.name === name).hex));
  console.log(`${name.padEnd(5)} 目标 ${fmt(t)}`);
  console.log(`      浓测 ${fmt(row.strong.lab)}（ΔE00 ${row.strong.dE00}）`);
  console.log(`      淡测 ${fmt(row.dilute.lab)}（ΔE00 ${row.dilute.dE00}，ΔH ${row.dilute.dH}°）`);
}

// —— JSON 报告 ——
mkdirSync(OUT_DIR, { recursive: true });
const report = {
  date: new Date().toISOString().slice(0, 10),
  tool: "color-metrics v2",
  method: "浓档 wet-wash amount=2.4 water=0.5 / 淡档 glaze amount=0.7 water=0.6；7×7 中心盒均值；ΔE00(CIE2000)",
  rgb: systems.rgb.map(({ name, strong, dilute }) => ({ name, strong, dilute })),
  spectral: systems.spectral.map(({ name, strong, dilute }) => ({ name, strong, dilute })),
};
writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify(report, null, 2));
console.log(`\nwrote ${OUT_DIR}/report.json`);
