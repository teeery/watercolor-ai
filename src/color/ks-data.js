// 实测 K/S 数据适配层（Berns APDS 契约）——任务 ① 的装载入口
// JSON 契约：
// {
//   "source": "Berns 2016 Artist Paint Spectral Database（Golden Heavy Body 丙烯）",
//   "license": "...", "url": "...", "retrieved": "...",
//   "saunderson": { "k1": 0.03, "k2": 0.65, "kInstr": 1 },
//   "pigments": {
//     "<马利名>": { "ci": "PB29", "nm": [380,390,...750], "K": [..], "S": [..] }
//   }
// }
// 装载路径：env MEASURED_KS_PATH → src/color/data/ks-measured.json → out/color/data/ks-measured.json
// K/S 重采样到 16 波段；缺数据 → 注册表空 → system.js 回退 scatter/strength 先验路径。
// 注意：APDS 的 K/S 带物理单位，接入前需在构建时按引擎质量单位归一化
// （以"amount=2.4 达到 masstone"为锚），归一化常数写进 JSON 的 "scale" 字段。
import { readFileSync, existsSync } from "node:fs";
import { BANDS, BAND_START, BAND_STEP } from "./srgb.js";

const registry = new Map(); // name -> { K: Float32Array, S: Float32Array, meta }
let loaded = false;

/** nm/K/S 三数组 → 16 波段（波段内 1nm 步进取均，线性插值） */
export function resampleKS(nm, K, S) {
  const outK = new Float32Array(BANDS), outS = new Float32Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const l0 = BAND_START + b * BAND_STEP;
    let sk = 0, ss = 0;
    for (let l = l0; l < l0 + BAND_STEP; l++) { sk += samp(nm, K, l); ss += samp(nm, S, l); }
    outK[b] = sk / BAND_STEP; outS[b] = ss / BAND_STEP;
  }
  return { K: outK, S: outS };
}

function samp(nm, V, l) {
  if (l <= nm[0]) return V[0];
  const last = nm.length - 1;
  if (l >= nm[last]) return V[last];
  let i = 1;
  while (nm[i] < l) i++;
  const t = (l - nm[i - 1]) / (nm[i] - nm[i - 1]);
  return V[i - 1] * (1 - t) + V[i] * t;
}

export function loadKSFile(filePath) {
  if (!existsSync(filePath)) return { loaded: 0, errors: [`文件不存在: ${filePath}`] };
  const doc = JSON.parse(readFileSync(filePath, "utf8"));
  const errors = [];
  const meta = { source: doc.source, license: doc.license, url: doc.url, retrieved: doc.retrieved, saunderson: doc.saunderson, scale: doc.scale };
  let loaded = 0;
  for (const [name, entry] of Object.entries(doc.pigments ?? {})) {
    if (!Array.isArray(entry.nm) || !Array.isArray(entry.K) || !Array.isArray(entry.S)) { errors.push(`${name}: 需要 nm/K/S 数组`); continue; }
    if (entry.nm.length !== entry.K.length || entry.nm.length !== entry.S.length) { errors.push(`${name}: nm/K/S 长度不等`); continue; }
    const scale = doc.scale ?? 1;
    const { K, S } = resampleKS(entry.nm, entry.K.map((v) => v * scale), entry.S.map((v) => v * scale));
    registry.set(name, { K, S, meta: { ...meta, ci: entry.ci } });
    loaded++;
  }
  return { loaded, errors };
}

export function initMeasuredKS(extraPaths = []) {
  if (loaded) return registry;
  loaded = true;
  const cwd = process.cwd();
  const paths = [
    process.env.MEASURED_KS_PATH,
    `${cwd}/src/color/data/ks-measured.json`,
    `${cwd}/out/color/data/ks-measured.json`,
    ...extraPaths,
  ].filter(Boolean);
  for (const p of paths) {
    const { loaded: n, errors } = loadKSFile(p);
    if (n > 0) console.log(`[ks-data] ${p}: 装载 ${n} 条实测 K/S`);
    if (errors.length && n === 0 && !errors[0].startsWith("文件不存在")) console.warn(`[ks-data] ${p}:`, errors.join("; "));
  }
  return registry;
}

export function getMeasuredKS(name) {
  initMeasuredKS();
  return registry.get(name) ?? null;
}
export function hasMeasuredKS(name) { initMeasuredKS(); return registry.has(name); }
