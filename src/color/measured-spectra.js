// 实测光谱适配层：公开颜料反射率数据 → 16 波段注册表
// 数据契约（JSON）：
// {
//   "source": "FORS IFAC-CNR | Pigments Checker v5 | ...",
//   "license": "引用/许可原文", "url": "...", "retrieved": "2026-08-16",
//   "binder": "dry pigment | oil | gum arabic",   // 非水彩 binder 时形状可用、绝对值别较真
//   "bandSpec": { "start": 400, "step": 20, "n": 16 },   // 可选：数据自身网格
//   "pigments": {
//     "<马利名或 CI 代码>": {
//       "ci": "PB29", "sample": "FORS-xxx 谱线 ID",
//       "nm": [400, 405, ...], "R": [0.xxx, ...]      // 任意网格，适配层重采样到 16 波段
//     }, ...,
//     "<复配色名>": { "mix": { "<组分名>": 权重, ... }, "note": "..." }  // 组分须已在本文件定义
//   }
// }
// 装载路径（优先序）：env MEASURED_SPECTRA_PATH → src/color/data/pigments-measured.json
//   → out/color/data/pigments-measured.json。缺文件 = 空注册表（程序化 fallback），不致命。
import { readFileSync, existsSync } from "node:fs";
import { BANDS, BAND_START, BAND_STEP } from "./srgb.js";

const registry = new Map(); // name -> { bands: Float32Array, meta: {...} }
let loaded = false;

/** 任意 nm 网格 → 16 波段（400-700/20nm，波段内 1nm 步进取均；界外线性延拓） */
export function resampleToBands(nm, R) {
  const out = new Float32Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const l0 = BAND_START + b * BAND_STEP;
    let s = 0;
    for (let l = l0; l < l0 + BAND_STEP; l++) s += sampleAt(nm, R, l);
    out[b] = s / BAND_STEP;
    if (out[b] < 0) out[b] = 0; else if (out[b] > 1) out[b] = 1;
  }
  return out;
}

function sampleAt(nm, R, l) {
  if (l <= nm[0]) return R[0];
  const last = nm.length - 1;
  if (l >= nm[last]) return R[last];
  let i = 1;
  while (nm[i] < l) i++;
  const t = (l - nm[i - 1]) / (nm[i] - nm[i - 1]);
  return R[i - 1] * (1 - t) + R[i] * t;
}

/** 校验单条：返回错误列表（空 = 通过） */
export function validateEntry(name, entry) {
  const errs = [];
  if (!entry || typeof entry !== "object") return [`${name}: 条目缺失`];
  if (!Array.isArray(entry.nm) || !Array.isArray(entry.R)) return [`${name}: 需要 nm/R 数组`];
  if (entry.nm.length !== entry.R.length) errs.push(`${name}: nm/R 长度不等`);
  if (entry.nm.length < 2) errs.push(`${name}: 光谱点过少`);
  for (let i = 1; i < entry.nm.length; i++) if (entry.nm[i] <= entry.nm[i - 1]) { errs.push(`${name}: nm 非严格递增`); break; }
  if (entry.R.some((v) => typeof v !== "number" || Number.isNaN(v))) errs.push(`${name}: R 含非数值`);
  return errs;
}

/** K 空间混合（KM 吸收空间线性混合）：K_mix = Σ w·K_i，K_i = (1-R_i)²/(2R_i)；
 *  R_mix = 1 + K_mix - sqrt(K_mix² + 2·K_mix)。组分为 16 波段反射率。 */
export function mixBands(components, weights) {
  const K = new Float32Array(BANDS);
  let wSum = 0;
  for (const [name, w] of Object.entries(weights)) {
    const R = components[name];
    if (!R) throw new Error(`混合组分缺失: ${name}`);
    wSum += w;
    for (let b = 0; b < BANDS; b++) {
      const rc = Math.max(R[b], 0.02);
      K[b] += w * ((1 - rc) * (1 - rc)) / (2 * rc);
    }
  }
  const out = new Float32Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const k = K[b] / wSum;
    out[b] = 1 + k - Math.sqrt(k * k + 2 * k);
  }
  return out;
}

/** 装载一个数据文件 → 注册表（幂等；返回 {loaded, errors}） */
export function loadMeasuredFile(filePath) {
  if (!existsSync(filePath)) return { loaded: 0, errors: [`文件不存在: ${filePath}`] };
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const doc = raw.data ?? raw; // 允许 {data: {...}} 包装
  const errors = [];
  const meta = { source: doc.source, license: doc.license, url: doc.url, retrieved: doc.retrieved, binder: doc.binder };
  if (!doc.source) errors.push("缺少 provenance 字段 source");
  if (!doc.license) errors.push("缺少 provenance 字段 license");
  let loaded = 0;
  const bandsByName = new Map();
  const mixEntries = [];
  for (const [name, entry] of Object.entries(doc.pigments ?? {})) {
    if (entry.mix) { mixEntries.push([name, entry]); continue; }
    const errs = validateEntry(name, entry);
    if (errs.length) { errors.push(...errs); continue; }
    const bands = resampleToBands(entry.nm, entry.R);
    registry.set(name, { bands, meta: { ...meta, ci: entry.ci, sample: entry.sample } });
    bandsByName.set(name, bands);
    loaded++;
  }
  // 混色条目：组分齐 → K 空间混合；组分缺 → 报错跳过
  for (const [name, entry] of mixEntries) {
    try {
      const bands = mixBands(bandsByName, entry.mix);
      registry.set(name, { bands, meta: { ...meta, ci: entry.ci, sample: entry.sample, mix: entry.mix } });
      loaded++;
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }
  return { loaded, errors };
}

/** 初始化：按优先序装载（幂等，只跑一次） */
export function initMeasured(extraPaths = []) {
  if (loaded) return registry;
  loaded = true;
  const cwd = process.cwd();
  const paths = [
    process.env.MEASURED_SPECTRA_PATH,
    `${cwd}/src/color/data/pigments-measured.json`,
    `${cwd}/out/color/data/pigments-measured.json`,
    ...extraPaths,
  ].filter(Boolean);
  for (const p of paths) {
    const { loaded: n, errors } = loadMeasuredFile(p);
    if (n > 0 || errors.some((e) => !e.startsWith("文件不存在"))) {
      if (errors.length) console.warn(`[measured-spectra] ${p}:`, errors.join("; "));
      if (n > 0) console.log(`[measured-spectra] ${p}: 装载 ${n} 条实测光谱`);
    }
  }
  return registry;
}

export function hasMeasured(name) { initMeasured(); return registry.has(name); }
export function getMeasuredBands(name) { initMeasured(); return registry.get(name)?.bands ?? null; }
export function getMeasuredMeta(name) { initMeasured(); return registry.get(name)?.meta ?? null; }
/** 给定名单的实测覆盖率 */
export function measuredCoverage(names) { initMeasured(); return names.filter((n) => registry.has(n)); }
