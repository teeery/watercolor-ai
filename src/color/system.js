// 颜色系统接口（升级缝）：颜料规范 → 每通道 K·d 基（引擎搬运的"吸收量"）→ 每像素 RGB
// RGB 系统（3 通道）与光谱系统（16 通道）实现同一接口 → 颜色子系统可独立异步升级
import { spectralToSRGB, BANDS } from "./srgb.js";
import { pigmentSpectrum, precomputeSpectra } from "./spectra.js";
import { PIGMENTS } from "./pigments.js";
import { getMeasuredKS } from "./ks-data.js";
import { hexToRgb01 } from "../brush/strokes.js";

/** 匿名颜料（只有 color hex）→ 找最近预设名的光谱（按 RGB 距离） */
function nearestPigment(pig) {
  const rgb = hexToRgb01(pig.color);
  let best = null, bestD = Infinity;
  for (const p of PIGMENTS) {
    const pr = hexToRgb01(p.hex);
    const d = (pr[0] - rgb[0]) ** 2 + (pr[1] - rgb[1]) ** 2 + (pr[2] - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Modified Saunderson 表面反射修正（Berns APDS 实测常数 K1=0.03/K2=0.65）：
 *  逆变换（外部测量 → KM 内部反射率）：r = (R − k1·kInstr) / (1 − k1·kInstr − k2(1−R))
 *  正变换（KM 内部 → 外部）：R' = k1·kInstr + (1−k1)(1−k2)r / (1−k2r)
 *  kInstr：1 = 积分球全收集（水彩 matte）；0 = 光泽表面（Mixbox eq.6 形式）。
 *  注意：往返恒等 → masstone 外部色 ≡ 实测反射谱，hex 无需重导出。 */
export function saundersonToInternal(R, { k1 = 0.03, k2 = 0.65, kInstr = 1 } = {}) {
  const num = R - k1 * kInstr;
  const den = 1 - k1 * kInstr - k2 * (1 - R);
  if (den <= 0) return R;
  const r = num / den;
  return r < 0 ? 0 : r > 1 ? 1 : r;
}
export function saundersonToExternal(r, { k1 = 0.03, k2 = 0.65, kInstr = 1 } = {}) {
  const den = 1 - k2 * r;
  if (den <= 0) return 1;
  const R = k1 * kInstr + (1 - k1) * (1 - k2) * r / den;
  return R < 0 ? 0 : R > 1 ? 1 : R;
}

/** KM 单常数（通道级）：kd = K·d（吸收×厚度），m = d（质量），Rg = 纸反射率 */
export function kmReflectance(kd, m, Rg) {
  if (m <= 1e-6) return Rg;
  const K = kd / m;
  const a = 1 + K;
  const bb = Math.sqrt(Math.max(1e-8, a * a - 1));
  let x = bb * m;
  if (x < 1e-4) return Rg;
  let coth;
  if (x > 20) coth = 1;
  else { const e = Math.exp(2 * x); coth = (e + 1) / (e - 1); }
  const denom = a + bb * coth - Rg;
  if (denom <= 0) return 0;
  return (1 - Rg * (a - bb * coth)) / denom;
}

/** KM 双常数（通道级）：kd = K·d，sd = S·d（散射光学厚度），Rg = 背景反射率。
 *  sd≈0 → Beer-Lambert 透底（纯吸收层，透明颜料的极限）；x>20 → R∞ 极限。
 *  R∞ 端点 = a - b = 1+K/S - sqrt((1+K/S)²-1)；K = S·(1-R∞)²/(2R∞) 时 R∞ 恰为拟合谱 */
export function twoConstantKM(kd, sd, Rg) {
  if (sd < 1e-4) return Rg * Math.exp(-2 * Math.max(0, kd));
  const a = 1 + kd / sd;
  const bb = Math.sqrt(Math.max(1e-8, a * a - 1));
  const x = bb * sd;
  if (x < 1e-4) return Rg;
  let coth;
  if (x > 20) coth = 1;
  else { const e = Math.exp(2 * x); coth = (e + 1) / (e - 1); }
  const denom = a + bb * coth - Rg;
  if (denom <= 0) return 0;
  return (1 - Rg * (a - bb * coth)) / denom;
}

/** RGB 三通道系统（当前基线：hex → (1-R)²/2R 基） */
export class RgbColorSystem {
  constructor() { this.channels = 3; this.name = "rgb"; }

  pigmentBasis(pig) {
    if (!pig || !pig.color) return new Float32Array(this.channels); // 纯水笔（re-wet）：零基
    const [r, g, b] = hexToRgb01(pig.color);
    const K = (c) => { const rc = Math.max(c, 0.02); const t = 1 - rc; return (t * t) / (2 * rc); };
    return Float32Array.from([K(r), K(g), K(b)]);
  }

  pigmentRGB(pig) { return hexToRgb01(pig.color); }

  /** 每像素 RGB：3 通道 KM（纸反射率 = paperColor） */
  pixelToRGB(eng, i, paperColor) {
    const { D, P, Dm, Pm } = eng;
    const m = Dm[i] + Pm[i];
    return [
      kmReflectance(D[0][i] + P[0][i], m, paperColor[0]),
      kmReflectance(D[1][i] + P[1][i], m, paperColor[1]),
      kmReflectance(D[2][i] + P[2][i], m, paperColor[2]),
    ];
  }
}

/** 光谱系统：16 波段 × 双常数 KM（K/S 分离，32 通道 = 前16 K·d + 后16 S·d）。
 *  颜料基：K_b = strength·scatter·(1-R)²/(2R)，S_b = scatter → R∞ 端点恒等于拟合谱，
 *  厚度速率由 scatter 决定：透明颜料（酞菁 0.5）薄层透底、遮盖颜料（镉 2.5-4 / 锌白 8）薄层藏底。
 *  引擎通道数泛化：K·d 与 S·d 按同一质量搬运（Pm/Dm 共享），零 core 改动。 */
export class SpectralColorSystem {
  constructor({ paperReflectance, k1 = 0.03, k2 = 0.65, kInstr = 1 } = {}) {
    this.channels = BANDS * 2;
    this.name = "spectral";
    this.saund = { k1, k2, kInstr };
    // 纸的光谱反射率（外部）：暖白（蓝端轻微吸收 → 米白纸色）
    this.paperR = paperReflectance ?? (() => {
      const R = new Float32Array(BANDS);
      for (let b = 0; b < BANDS; b++) R[b] = 0.965 + 0.025 * (b / (BANDS - 1));
      return R;
    })();
    // KM 需要内部语义的纸反射率（Saunderson 逆变换一次）
    this.paperRInternal = this.paperR.map((R) => saundersonToInternal(R, this.saund));
    precomputeSpectra();
  }

  pigmentBasis(pig) {
    if (!pig || (!pig.name && !pig.color)) return new Float32Array(this.channels); // 纯水笔：零基
    const spec = pig.name ? pig : nearestPigment(pig);
    // 实测 K/S 优先（APDS 等：K、S 绝对值直接可用，scatter/strength 已内含其中）
    const measured = getMeasuredKS(spec.name);
    if (measured) {
      const out = new Float32Array(this.channels);
      for (let b = 0; b < BANDS; b++) { out[b] = measured.K[b]; out[BANDS + b] = measured.S[b]; }
      return out;
    }
    const R = pigmentSpectrum(spec);
    const scatter = spec.scatter ?? 1.0;
    const strength = spec.strength ?? 1.0;
    const out = new Float32Array(this.channels);
    for (let b = 0; b < BANDS; b++) {
      // 外部实测反射率 → 内部（KM 语义）→ K = (1-r)²/2r
      const re = Math.max(R[b], 0.02);
      const rint = saundersonToInternal(re, this.saund);
      const t = 1 - rint;
      out[b] = strength * scatter * (t * t) / (2 * rint); // K（每单位质量吸收）
      out[BANDS + b] = strength * scatter;                // S（每单位质量散射）
    }
    // 物理约定：strength 同时乘 K 与 S → K/S 不变、R∞ 不变；
    // 等效光学厚度 = strength·scatter·m → 着色力只影响"多少质量达到 masstone"。
    return out;
  }

  pigmentRGB(pig) { return hexToRgb01(pig.color); }

  pixelToRGB(eng, i) {
    const { D, P, Dm, Pm } = eng;
    const m = Dm[i] + Pm[i];
    if (m <= 1e-6) return spectralToSRGB(this.paperR);
    const R = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      const rint = twoConstantKM(D[b][i] + P[b][i], D[b + BANDS][i] + P[b + BANDS][i], this.paperRInternal[b]);
      R[b] = saundersonToExternal(rint, this.saund);
    }
    return spectralToSRGB(R);
  }
}
