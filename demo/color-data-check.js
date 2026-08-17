// 任务 2 工具 · 实测光谱数据校验与覆盖检查
// 1) 装载注册表：报 24 色覆盖 + 每支状态（实测 / 程序化 fallback / 复配色待配）
// 2) 实测条目绑定质量：实测 16 波段 → sRGB vs 标称 hex 的 ΔE00
// 3) 重采样保真：夹具条目带 refBands16（程序化基准），比对重采样误差
// 输出：out/color/data_check.json + 控制台
import { initMeasured, getMeasuredMeta, measuredCoverage } from "../src/color/measured-spectra.js";
import { pigmentSpectrum } from "../src/color/spectra.js";
import { spectralToSRGB, srgbToLab } from "../src/color/srgb.js";
import { deltaE00 } from "../src/color/deltae.js";
import { PIGMENTS } from "../src/color/pigments.js";
import { PIGMENT_MAP } from "../src/color/pigment-map.js";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

const OUT = "out/color";
mkdirSync(OUT, { recursive: true });
initMeasured();

const names = PIGMENTS.map((p) => p.name);
const measured = measuredCoverage(names);
const mixes = names.filter((n) => PIGMENT_MAP[n]?.mix);
const directCI = names.filter((n) => PIGMENT_MAP[n]?.ci && !PIGMENT_MAP[n]?.mix);
const missingCI = names.filter((n) => !PIGMENT_MAP[n]?.ci && !PIGMENT_MAP[n]?.mix);

console.log(`实测覆盖: ${measured.length}/24${measured.length ? " → " + measured.join(" ") : "（无数据文件，程序化 fallback 生效）"}`);
console.log(`直接映射单颜料: ${directCI.length} 支 | 复配色待配: ${mixes.length} 支（${mixes.join(" ") || "无"}） | 缺映射: ${missingCI.length}（${missingCI.join(" ") || "无"}）`);

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const report = { date: new Date().toISOString().slice(0, 10), measured, mixes, directCI, missingCI, entries: [] };

if (measured.length) {
  console.log("\n实测条目绑定质量（R∞ → sRGB vs 标称 hex）：");
  for (const name of measured) {
    const bands = pigmentSpectrum({ name });
    const lab = srgbToLab(spectralToSRGB(bands));
    const target = srgbToLab(hex2rgb(PIGMENTS.find((p) => p.name === name).hex));
    const dE = +deltaE00(target, lab).toFixed(1);
    const meta = getMeasuredMeta(name);
    console.log(`${name.padEnd(6)} ΔE00=${dE.toFixed(1)}  [${(meta?.source ?? "?").slice(0, 34)}]`);
    report.entries.push({ name, dE00: dE, meta });
  }
}

// —— 重采样保真（夹具字段 refBands16） ——
const fixturePath = process.env.MEASURED_SPECTRA_PATH;
if (fixturePath && existsSync(fixturePath)) {
  const doc = JSON.parse(readFileSync(fixturePath, "utf8"));
  console.log("\n重采样保真（resample(nm→16) vs 夹具 refBands16）：");
  report.resampleErrors = [];
  for (const [name, entry] of Object.entries(doc.pigments ?? {})) {
    if (!entry.refBands16) continue;
    const bands = pigmentSpectrum({ name });
    let maxErr = 0;
    for (let b = 0; b < 16; b++) maxErr = Math.max(maxErr, Math.abs(bands[b] - entry.refBands16[b]));
    report.resampleErrors.push({ name, maxErr: +maxErr.toFixed(4) });
    console.log(`${name.padEnd(6)} 最大波段误差 ${maxErr.toFixed(4)}（<0.005 为管线正确）`);
  }
}

writeFileSync(`${OUT}/data_check.json`, JSON.stringify(report, null, 2));
console.log(`\nwrote ${OUT}/data_check.json`);
