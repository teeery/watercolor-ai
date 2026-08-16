// 颜色系统接口（升级缝）：颜料规范 → 每通道 K·d 基（引擎搬运的"吸收量"）→ 每像素 RGB
// RGB 系统（3 通道）与光谱系统（16 通道）实现同一接口 → 颜色子系统可独立异步升级
import { spectralToSRGB, BANDS } from "./srgb.js";
import { pigmentSpectrum, precomputeSpectra } from "./spectra.js";
import { PIGMENTS } from "./pigments.js";
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

/** 光谱系统：16 波段（400-700nm / 20nm），每支颜料一条反射光谱；
 *  模拟端在光谱域搬运 K·d，渲染时逐波段 KM 合成 → XYZ → sRGB */
export class SpectralColorSystem {
  constructor({ paperReflectance } = {}) {
    this.channels = BANDS;
    this.name = "spectral";
    // 纸的光谱反射率：暖白（蓝端轻微吸收 → 米白纸色）
    this.paperR = paperReflectance ?? (() => {
      const R = new Float32Array(BANDS);
      for (let b = 0; b < BANDS; b++) R[b] = 0.965 + 0.025 * (b / (BANDS - 1));
      return R;
    })();
    precomputeSpectra();
  }

  pigmentBasis(pig) {
    if (!pig || (!pig.name && !pig.color)) return new Float32Array(BANDS); // 纯水笔：零基
    const spec = pig.name ? pig : nearestPigment(pig);
    const R = pigmentSpectrum(spec);
    const K = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      const rc = Math.max(R[b], 0.02);
      const t = 1 - rc;
      K[b] = (t * t) / (2 * rc);
    }
    return K;
  }

  pigmentRGB(pig) { return hexToRgb01(pig.color); }

  pixelToRGB(eng, i) {
    const { D, P, Dm, Pm } = eng;
    const m = Dm[i] + Pm[i];
    const R = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      R[b] = kmReflectance(D[b][i] + P[b][i], m, this.paperR[b]);
    }
    return spectralToSRGB(R);
  }
}
