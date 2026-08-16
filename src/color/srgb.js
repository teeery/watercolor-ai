// 光谱 → 三刺激值 → sRGB 的色度工具（CIE 1931 2° + D65，数据来自 colour-science 数据集）
import { CMF_1NM, D65_1NM } from "./cie-data.js";

export const BANDS = 16;            // 400-700nm，20nm 一档
export const BAND_START = 400;
export const BAND_STEP = 20;

// 每个波段的预积分权重：Wx[b] = Σ_{λ∈band} x̄(λ)·D65(λ)·Δλ（λ 从 400 起 1nm 步进）
// 归一化：完美漫反射体（R=1）→ Y=100 的传统约定改作 ΣWy = 1，使纸色映射直观
const bandWeights = (() => {
  const Wx = new Float64Array(BANDS), Wy = new Float64Array(BANDS), Wz = new Float64Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    const l0 = BAND_START + b * BAND_STEP;
    for (let l = l0; l < l0 + BAND_STEP; l++) {
      const k = Math.min(300, l - 400); // CMF/D65 数组下标（400-700，最后一段到 719 越界 → 钳到 700）
      Wx[b] += CMF_1NM.x[k] * D65_1NM[k];
      Wy[b] += CMF_1NM.y[k] * D65_1NM[k];
      Wz[b] += CMF_1NM.z[k] * D65_1NM[k];
    }
  }
  let sY = 0;
  for (let b = 0; b < BANDS; b++) sY += Wy[b];
  const n = 1 / sY;
  for (let b = 0; b < BANDS; b++) { Wx[b] *= n; Wy[b] *= n; Wz[b] *= n; }
  return { Wx, Wy, Wz };
})();

/** 16 波段反射率 → XYZ（D65 白点归一） */
export function spectralToXYZ(R) {
  let X = 0, Y = 0, Z = 0;
  for (let b = 0; b < BANDS; b++) {
    X += R[b] * bandWeights.Wx[b];
    Y += R[b] * bandWeights.Wy[b];
    Z += R[b] * bandWeights.Wz[b];
  }
  return { X, Y, Z };
}

/** XYZ(D65) → 线性 sRGB */
export function xyzToLinearRGB({ X, Y, Z }) {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ];
}

export function linearToSRGB(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** 16 波段反射率 → sRGB [0..1]（钳位） */
export function spectralToSRGB(R) {
  const [lr, lg, lb] = xyzToLinearRGB(spectralToXYZ(R));
  const cl = (v) => { const s = linearToSRGB(v); return s < 0 ? 0 : s > 1 ? 1 : s; };
  return [cl(lr), cl(lg), cl(lb)];
}

/** sRGB → XYZ（用于 CIELAB 校验） */
export function srgbToXYZ([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r), G = lin(g), B = lin(b);
  return {
    X: 0.4124 * R + 0.3576 * G + 0.1805 * B,
    Y: 0.2126 * R + 0.7152 * G + 0.0722 * B,
    Z: 0.0193 * R + 0.1192 * G + 0.9505 * B,
  };
}

/** sRGB → CIELAB */
export function srgbToLab([r, g, b]) {
  const { X, Y, Z } = srgbToXYZ([r, g, b]);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047), fy = f(Y / 1.0), fz = f(Z / 1.08883);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bv = 200 * (fy - fz);
  return { L, a, b: bv, C: Math.hypot(a, bv) };
}
