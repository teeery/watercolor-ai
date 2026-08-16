// 24 支颜料的 400-700nm 反射光谱（16 波段）
// 做法：按颜料家族构造光谱形状（镉类陡峭边、群青长波回升、酞菁绿肩、铁氧化物平滑上升……），
// 再对每支颜料做坐标下降拟合，使其光谱 → sRGB（CIE 1931 + D65）≈ 标称 hex。
// 诚实声明：这是"按家族身份的程序化光谱近似"，不是实测颜料数据；
// 将来可无缝替换为实测光谱（接口只要求 16 波段反射率）。
import { BANDS, BAND_START, BAND_STEP, spectralToSRGB, srgbToLab } from "./srgb.js";
import { PIGMENTS } from "./pigments.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const gauss = (l, mu, sigma) => Math.exp(-((l - mu) ** 2) / (2 * sigma * sigma));
const sigmoid = (t) => 1 / (1 + Math.exp(-t));

// —— 家族形状（λ: 400-700，1nm 采样） ——
const FAMILIES = {
  // 陡峭边：镉黄/橙/红类。lo/hi = 边两侧反射率；tail = 长波附加
  edge: (p, l) => clamp01(p.lo + (p.hi - p.lo) * sigmoid((l - p.le) / p.s) + p.tail * Math.max(0, (l - 650) / 50)),
  // 单谷吸收带（绿谷）：玫瑰红/紫罗兰类
  dip: (p, l) => clamp01(p.base - p.depth * gauss(l, p.mu, p.sigma)),
  // 双峰反射：蓝/绿类（两个反射峰）
  hump2: (p, l) => clamp01(p.base + p.h1 * gauss(l, p.mu1, p.s1) + p.h2 * gauss(l, p.mu2, p.s2)),
  // 群青：蓝峰 + 绿谷 + 长波回升（著名的紫外长尾）
  ultramarine: (p, l) => clamp01(p.base + p.h1 * gauss(l, p.mu1, p.s1) - p.d2 * gauss(l, p.mu2, p.s2) + p.rt * Math.max(0, (l - 620) / 80)),
  // 酞菁/普蓝：强蓝峰 + 绿肩 + 红尾
  phthalo: (p, l) => clamp01(p.base + p.h1 * gauss(l, p.mu1, p.s1) + p.h2 * gauss(l, p.mu2, p.s2) + p.rt * Math.max(0, (l - 640) / 60)),
  // 铁氧化物：平滑上升（赭石/生熟褐）
  oxide: (p, l) => clamp01(p.lo + (p.hi - p.lo) * ((l - 400) / 300) ** p.g),
  // 群青绿/橄榄：宽绿峰 + 红尾
  olive: (p, l) => clamp01(p.base + p.h1 * gauss(l, p.mu1, p.s1) + p.rt * ((l - 400) / 300) ** 1.2),
  // 草绿：黄边 + 蓝吸收 → 双段
  sap: (p, l) => clamp01(p.lo + (p.hi - p.lo) * sigmoid((l - p.le) / p.s) - p.depth * gauss(l, p.mu, p.sigma)),
  // 中性（佩恩灰/黑/白）：低平 + 微冷暖
  neutral: (p, l) => clamp01(p.base + p.tilt * ((l - 400) / 300) + p.h1 * gauss(l, p.mu1, p.s1)),
};

// 每支颜料的家族 + 起始参数（按名称索引）
const PRESETS = {
  "锌白":   { fam: "neutral", p: { base: 0.93, tilt: 0.045, h1: 0, mu1: 450, s1: 40 } },
  "柠檬黄": { fam: "edge", p: { lo: 0.06, hi: 0.97, le: 500, s: 14, tail: 0.02 } },
  "中镉黄": { fam: "edge", p: { lo: 0.05, hi: 0.96, le: 516, s: 16, tail: 0.06 } },
  "土黄":   { fam: "oxide", p: { lo: 0.10, hi: 0.90, g: 1.6 } },
  "桔黄":   { fam: "edge", p: { lo: 0.05, hi: 0.95, le: 552, s: 22, tail: 0.12 } },
  "朱红":   { fam: "edge", p: { lo: 0.06, hi: 0.94, le: 585, s: 18, tail: 0.10 } },
  "大红":   { fam: "edge", p: { lo: 0.08, hi: 0.92, le: 597, s: 16, tail: 0.08 } },
  "深红":   { fam: "edge", p: { lo: 0.10, hi: 0.88, le: 608, s: 18, tail: 0.05 } },
  "玫瑰红": { fam: "dip", p: { base: 0.92, depth: 0.78, mu: 532, sigma: 42 } },
  "紫罗兰": { fam: "dip", p: { base: 0.88, depth: 0.74, mu: 548, sigma: 55 } },
  "群青":   { fam: "ultramarine", p: { base: 0.30, h1: 0.62, mu1: 448, s1: 40, d2: 0.34, mu2: 565, s2: 55, rt: 0.30 } },
  "钴蓝":   { fam: "hump2", p: { base: 0.05, h1: 0.68, mu1: 462, s1: 52, h2: 0.30, mu2: 515, s2: 60 } },
  "湖蓝":   { fam: "hump2", p: { base: 0.10, h1: 0.62, mu1: 470, s1: 48, h2: 0.55, mu2: 515, s2: 55 } },
  "普蓝":   { fam: "phthalo", p: { base: 0.04, h1: 0.75, mu1: 452, s1: 42, h2: 0.35, mu2: 520, s2: 65, rt: 0.30 } },
  "翠绿":   { fam: "hump2", p: { base: 0.06, h1: 0.70, mu1: 532, s1: 46, h2: 0.30, mu2: 460, s2: 62 } },
  "深绿":   { fam: "hump2", p: { base: 0.05, h1: 0.65, mu1: 530, s1: 55, h2: 0.35, mu2: 460, s2: 65 } },
  "草绿":   { fam: "sap", p: { lo: 0.06, hi: 0.80, le: 528, s: 24, depth: 0.45, mu: 655, sigma: 55 } },
  "橄榄绿": { fam: "olive", p: { base: 0.22, h1: 0.42, mu1: 545, s1: 55, rt: 0.30 } },
  "赭石":   { fam: "oxide", p: { lo: 0.06, hi: 0.88, g: 1.9 } },
  "熟褐":   { fam: "oxide", p: { lo: 0.05, hi: 0.80, g: 2.1 } },
  "生褐":   { fam: "oxide", p: { lo: 0.04, hi: 0.66, g: 2.3 } },
  "佩恩灰": { fam: "neutral", p: { base: 0.06, tilt: 0.01, h1: 0.14, mu1: 458, s1: 60 } },
  "象牙黑": { fam: "neutral", p: { base: 0.035, tilt: 0.002, h1: 0.05, mu1: 455, s1: 60 } },
  "天蓝":   { fam: "hump2", p: { base: 0.25, h1: 0.55, mu1: 468, s1: 48, h2: 0.50, mu2: 510, s2: 58 } },
};

// —— 拟合：光谱 → sRGB 与目标 hex 的 CIELAB 距离，坐标下降 ——
function spectrumToBands(fam, p) {
  const bands = new Float32Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const l0 = BAND_START + b * BAND_STEP;
    let s = 0;
    for (let l = l0; l < l0 + BAND_STEP; l++) s += FAMILIES[fam](p, l);
    bands[b] = clamp01(s / BAND_STEP);
  }
  return bands;
}

function deltaE(lab1, lab2) {
  return Math.hypot(lab1.L - lab2.L, lab1.a - lab2.a, lab1.b - lab2.b);
}

const KEY_PARAMS = {
  edge: ["le", "s", "hi", "lo", "tail"],
  dip: ["mu", "sigma", "depth", "base"],
  hump2: ["mu1", "s1", "h1", "h2", "mu2"],
  ultramarine: ["mu1", "h1", "d2", "rt", "base"],
  phthalo: ["mu1", "h1", "h2", "rt", "base"],
  oxide: ["g", "hi", "lo"],
  olive: ["mu1", "h1", "rt", "base"],
  sap: ["le", "depth", "mu", "hi"],
  neutral: ["base", "tilt", "h1"],
};

// 每家族前两个关键参数的粗网格预搜索（防坐标下降陷入局部最优）
const GRID_KEYS = {
  edge: ["le", "s"], dip: ["mu", "sigma"], hump2: ["mu1", "mu2"],
  ultramarine: ["mu1", "d2"], phthalo: ["mu1", "h2"], oxide: ["g", "hi"],
  olive: ["mu1", "h1"], sap: ["le", "depth"], neutral: ["base", "tilt"],
};
const GRID_STEPS = { le: 10, s: 6, mu: 14, sigma: 12, mu1: 12, mu2: 16, g: 0.25, hi: 0.07, d2: 0.08, h1: 0.08, h2: 0.08, depth: 0.08, base: 0.06, tilt: 0.03 };

function fitSpectrum(fam, p0, targetLab) {
  const p = { ...p0 };
  const params = KEY_PARAMS[fam] || Object.keys(p0);
  const scales = { le: 6, s: 5, hi: 0.08, lo: 0.05, mu: 8, sigma: 10, depth: 0.06, base: 0.05, h1: 0.05, h2: 0.05, d2: 0.05, rt: 0.05, g: 0.12, tilt: 0.02, mu1: 8, s1: 8, mu2: 8, tail: 0.04 };
  let best = Infinity;
  const evalF = (pp) => deltaE(srgbToLab(spectralToSRGB(spectrumToBands(fam, pp))), targetLab);
  best = evalF(p); // 预设先作基线：网格/下降只接受改进，绝不覆盖更好的预设

  // 粗网格预搜索（两关键参数 × [-2,-1,0,1,2] 步长）
  const gk = GRID_KEYS[fam] || params.slice(0, 2);
  for (let a = -2; a <= 2; a++) {
    for (let b = -2; b <= 2; b++) {
      const cand = { ...p };
      cand[gk[0]] = p[gk[0]] + a * (GRID_STEPS[gk[0]] || 5);
      cand[gk[1]] = p[gk[1]] + b * (GRID_STEPS[gk[1]] || 5);
      const e = evalF(cand);
      if (e < best) { best = e; p[gk[0]] = cand[gk[0]]; p[gk[1]] = cand[gk[1]]; }
    }
  }

  for (let iter = 0; iter < 80; iter++) {
    for (const key of params) {
      const sc = (scales[key] || 0.05) * Math.max(0.3, 1 - iter / 90);
      for (const dir of [1, -1]) {
        const cand = { ...p, [key]: p[key] + dir * sc };
        const e = evalF(cand);
        if (e < best) { best = e; p[key] = cand[key]; }
      }
    }
    if (best < 1.0) break;
  }
  return { p, de: best };
}

const cache = new Map();

/** 取一支颜料的 16 波段反射光谱（拟合并缓存） */
export function pigmentSpectrum(pig) {
  if (cache.has(pig.name)) return cache.get(pig.name);
  const preset = PRESETS[pig.name];
  if (!preset) throw new Error(`无光谱预设: ${pig.name}`);
  const targetLab = srgbToLab(hexToRgb01Local(pig.hex ?? pig.color));
  const { p, de } = fitSpectrum(preset.fam, preset.p, targetLab);
  const bands = spectrumToBands(preset.fam, p);
  cache.set(pig.name, bands);
  if (de > 6) console.warn(`[spectra] ${pig.name} 拟合 ΔE=${de.toFixed(1)}（>6，色差偏大）`);
  return bands;
}

function hexToRgb01Local(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** 全部 24 支颜料预拟合（模块加载时执行一次，约 1-2 秒） */
export function precomputeSpectra() {
  for (const pig of PIGMENTS) pigmentSpectrum(pig);
  return cache;
}
