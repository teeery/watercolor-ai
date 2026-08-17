// 任务 2 构建器 · Pigments Checker FORS 实测数据 → 24 色实测光谱 JSON
// 1) 解析 acrylic binder 目录全部 txt（nm\tR%）
// 2) 24 色映射：直接绑定或候选择优（ΔE00 vs 标称 hex），复配色在 K 空间混合
// 3) 写 src/color/data/pigments-measured.json + out/color/data/ 副本；打印每支选择与 ΔE
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spectralToSRGB, srgbToLab } from "../src/color/srgb.js";
import { deltaE00 } from "../src/color/deltae.js";
import { PIGMENTS } from "../src/color/pigments.js";

const SRC_DIR = "out/color/data/_probe/pc_unzip/Database Reflectance Spectra Pigments + acrylic binder on cardboard";
const OUT_JSON = "src/color/data/pigments-measured.json";

// —— 1) 解析全部 txt（CHSOS）+ 装载 Golden 数据 ——
const raw = {}; // name -> {nm, R}
for (const f of readdirSync(SRC_DIR)) {
  if (!f.endsWith(".txt")) continue;
  const nm = [], R = [];
  for (const line of readFileSync(`${SRC_DIR}/${f}`, "utf8").split("\n")) {
    const [a, b] = line.trim().split(/\s+/);
    if (a === undefined || b === undefined) continue;
    const l = parseFloat(a), r = parseFloat(b);
    if (Number.isNaN(l) || Number.isNaN(r)) continue;
    nm.push(l); R.push(Math.min(1, Math.max(0, r / 100)));
  }
  if (nm.length > 10) raw[f.slice(0, -4)] = { nm, R };
}
console.log(`解析 ${Object.keys(raw).length} 支实测颜料光谱`);
// Golden HB（D65/10°，400-700@10nm，白背卡 6mil 干膜）——现代颜料统一协议数据
const goldenDoc = JSON.parse(readFileSync("research/color/golden-hb.json", "utf8"));
const goldenNm = goldenDoc.nm;
const golden = goldenDoc.paints;
console.log(`装载 Golden ${Object.keys(golden).length} 支`);
/** 数据源解析：G:xxx → Golden；否则 CHSOS txt */
function src(ref) {
  if (ref.startsWith("G:")) {
    const g = golden[ref.slice(2)];
    return g ? { nm: goldenNm, R: g.R } : null;
  }
  return raw[ref] ?? null;
}

// —— 2) 1nm 重采样（线性插值；对 0.17nm 与 10nm 网格都正确） ——
function to1nm({ nm, R }) {
  const outN = [], outR = [];
  for (let l = Math.ceil(nm[0]); l <= Math.floor(nm[nm.length - 1]); l++) {
    outN.push(l);
    outR.push(sampleAt({ nm, R }, l));
  }
  return { nm: outN, R: outR };
}

// —— 3) 双常数 K/S 空间混合（与引擎同模型：K_i = s_i·(1-R)²/2R，S_i = s_i） ——
// 组分散射系数先验（与 pigments.js 的 scatter 表一致；白色高 S 才能真正提亮混合）
const SCATTER = {
  "phthalo blue": 0.5, "zinc white": 8.0, "phthalo green": 0.6,
  "PY 3 - hansa yellow 10G": 3.0, "ivory black": 1.0, "bone black": 1.0, "lamp black": 1.0,
  "prussian blue": 0.5, "cobalt cerulean b": 1.2, "ultramarine b art": 0.8, "ultramarine b nat": 0.8,
  "alizarine": 0.5, "yellow ochre": 1.5, "titanium white": 6.0, "manganese violet": 0.8,
  // Golden HB
  "G:Prussian Blue Hue": 0.5, "G:Cerulean Blue Chromium": 1.2, "G:Dioxazine Purple": 0.6,
  "G:Quin Magenta": 0.5, "G:Paynes Gray": 0.8, "G:Hookers Green Hue": 0.7,
  "G:Phthalo Green BS": 0.6, "G:Cad Red Light": 1.5, "G:Cad Yellow Medium": 2.0,
  "G:Cadmium Orange": 1.8, "G:Ultramarine Blue": 0.8, "G:Cobalt Blue": 1.2,
  "G:Burnt Umber": 1.5, "G:Raw Umber": 1.5, "G:Bone Black": 1.0, "G:Yellow Ochre": 1.5,
  "G:Viridian Green Hue": 0.9, "G:Chromium Oxide": 1.3, "G:Pyrrole Red": 1.4,
  "G:Napthol Red Medium": 1.3, "G:Alizarin Crimson Hue": 0.6, "G:Hansa Yellow Light": 2.5,
  "G:Red Oxide": 1.5, "G:Quin Violet": 0.6, "G:Cerulean Blue Deep": 1.2, "G:Burnt Sienna": 1.6,
  "G:Cobalt Turquoise": 0.8,
};
function mixAtNative(components, weights) {
  const grid = [];
  const set = new Set();
  for (const c of components) for (const l of c.nm) set.add(Math.round(l * 10));
  const nm = Array.from(set).sort((a, b) => a - b).map((v) => v / 10);
  let Ssum = 0;
  const K = nm.map(() => 0);
  for (let j = 0; j < components.length; j++) {
    const c = components[j], w = weights[j];
    const s = SCATTER[c.name] ?? 1.0;
    Ssum += w * s;
    for (let i = 0; i < nm.length; i++) {
      const r = Math.max(sampleAt(c, nm[i]), 0.02);
      K[i] += w * s * ((1 - r) * (1 - r)) / (2 * r);
    }
  }
  const R = K.map((k) => {
    const a = 1 + k / Ssum;
    return a - Math.sqrt(Math.max(1e-8, a * a - 1));
  });
  return { nm, R };
}
function sampleAt({ nm, R }, l) {
  if (l <= nm[0]) return R[0];
  if (l >= nm[nm.length - 1]) return R[nm.length - 1];
  let i = 1;
  while (nm[i] < l) i++;
  const t = (l - nm[i - 1]) / (nm[i] - nm[i - 1]);
  return R[i - 1] * (1 - t) + R[i] * t;
}

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function dEofSpectrum({ nm, R }, hex) {
  const { resampleToBands } = {}; // 见下方：直接在这里做 16 波段重采样（内联）
  const BANDS = 16;
  const bands = new Float32Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const l0 = 400 + b * 20;
    let s = 0;
    for (let l = l0; l < l0 + 20; l++) s += sampleAt({ nm, R }, l);
    bands[b] = s / 20;
  }
  const lab = srgbToLab(spectralToSRGB(bands));
  return deltaE00(srgbToLab(hex2rgb(hex)), lab);
}

// —— 4) 24 色映射（候选择优） ——
const BIND = {
  "锌白":   { mix: [{ "zinc white": 1, "titanium white": 0.12 }] },   // 减钛白 → 更冷的奶白（vision：#1 再冷半格）
  "柠檬黄": { force: "G:Hansa Yellow Light" },
  "中镉黄": { force: "G:Cad Yellow Medium" },
  "土黄":   { force: "G:Yellow Ochre" },
  "桔黄":   { force: "G:Cadmium Orange" },
  "朱红":   { force: "G:Cad Red Light" },
  "大红":   { force: "G:Pyrrole Red" },
  "深红":   { mix: [{ "G:Alizarin Crimson Hue": 1, "G:Quin Magenta": 0.2 }] },   // 加喹吖酮品红 → 淡档更玫瑰（vision：#8）
  "玫瑰红": { force: "G:Quin Magenta" },
  // 紫罗兰：Golden 二噁嗪/Quin Violet 均被白卡洗平（蓝端反射丢失），混色试 3 个配比仍无紫相
  // → 保留 CHSOS 锰紫 + 6% 锌白（vision 9.2 已过）
  "紫罗兰": { mix: [{ "manganese violet": 1, "zinc white": 0.06 }] },
  "群青":   { force: "G:Ultramarine Blue" },
  "钴蓝":   { force: "G:Cobalt Blue" },
  "湖蓝":   { mix: [{ "G:Cerulean Blue Deep": 1, "zinc white": 0.9, "G:Cobalt Turquoise": 0.15 }] },   // 加钴松石绿相 → "湖"水蓝绿（vision：#13 加半格绿）
  // 普蓝：Golden 铁蓝样品也被白卡洗平（0.04-0.05 全平）→ 保留程序化铁蓝形状（vision 已过）
  "翠绿":   { force: "G:Viridian Green Hue" },
  "深绿":   { mix: [{ "G:Phthalo Green BS": 1, "G:Viridian Green Hue": 0.45 }] },   // viridian 提莹 → 淡档莹亮（vision：#16 降黑成分）
  "草绿":   { mix: [{ "phthalo green": 1, "PY 3 - hansa yellow 10G": 0.5 }] },   // Hookers Green Hue 被白卡洗平 → CHSOS 混色
  "橄榄绿": { force: "G:Chromium Oxide" },
  "赭石":   { force: "G:Yellow Ochre" },
  "熟褐":   { mix: [{ "G:Burnt Umber": 1, "G:Burnt Sienna": 0.6 }] },      // 混煅赭暖化 → 与生褐拉开冷暖
  "生褐":   { force: "G:Raw Umber" },
  "佩恩灰": { force: "G:Paynes Gray" },
  "象牙黑": { force: "G:Bone Black" },
  "天蓝":   { mix: [{ "G:Cerulean Blue Chromium": 1, "zinc white": 1.4 }] },
};

const doc = {
  source: "Pigments Checker v5 (CHSOS) — FORS spectral database of historical pigments",
  license: "CHSOS 公开免费下载（https://chsopensource.org/fors/）；数据库出处随本项目引用保留",
  url: "https://chsopensource.org/fors/",
  retrieved: new Date().toISOString().slice(0, 10),
  binder: "acrylic binder on cardboard（VIS 域与阿拉伯胶差异小；provenance 如实记录）",
  pigments: {},
};

console.log("\n颜料        选择                          ΔE00(R∞vs hex)");
let maxDE = 0;
for (const p of PIGMENTS) {
  const spec = BIND[p.name];
  if (!spec) { console.log(`${p.name.padEnd(6)} ⚠ 无数据源，保留程序化`); continue; }
  let best = null, bestDE = Infinity, bestNote = "";
  if (spec.force) {
    best = { ...src(spec.force), note: spec.force };
    bestDE = dEofSpectrum(best, p.hex);
  }
  if (!best && spec.direct) {
    for (const cand of spec.direct) {
      const s = src(cand);
      if (!s) continue;
      const de = dEofSpectrum(s, p.hex);
      if (de < bestDE) { bestDE = de; best = { ...s, note: cand }; }
    }
  }
  for (const m of spec.mix ?? []) {
    const mNames = Object.keys(m);
    const comps = mNames.map((k) => ({ name: k, ...src(k) })).filter((c) => c.nm);
    if (comps.length !== mNames.length) continue;
    const mixed = mixAtNative(comps, mNames.map((k) => m[k]));
    const de = dEofSpectrum(mixed, p.hex);
    if (de < bestDE) { bestDE = de; best = { ...mixed, note: "mix:" + mNames.map((k) => `${k.slice(0, 12)}:${m[k]}`).join("+") }; }
  }
  if (!best) { console.log(`${p.name.padEnd(6)} ⚠ 无数据源，保留程序化`); continue; }
  const one = to1nm(best);
  doc.pigments[p.name] = { ci: (BIND[p.name].ci) ?? "", sample: best.note, nm: one.nm, R: one.R.map((v) => +v.toFixed(4)) };
  maxDE = Math.max(maxDE, bestDE);
  console.log(`${p.name.padEnd(6)} ${best.note.padEnd(42)} ${bestDE.toFixed(1)}`);
}
console.log(`\n最大绑定 ΔE00 = ${maxDE.toFixed(1)}`);

mkdirSync("src/color/data", { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(doc, null, 1));
mkdirSync("out/color/data", { recursive: true });
writeFileSync("out/color/data/pigments-measured.json", JSON.stringify(doc, null, 1));
console.log(`wrote ${OUT_JSON} (+ out/color/data 副本)`);
