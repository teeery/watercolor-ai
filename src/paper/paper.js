// 纸：高度场 H（bump）+ 持水容量 C + 细颗粒 G + 纤维方向场 Tx/Ty（M1 各向异性）
// 规格 §5：H = fBm（octaves 4-6），C = clamp(H·capScale + capOff)
// 细颗粒 G 是更高频的一层，用于渲染纹理与颗粒聚集调制
// M1：纤维方向 θ = 低频 value noise（平滑）＋预设主方向偏置；H 叠加沿纤维拉伸的条状分量
import { fbmField, fbm2D, valueNoise2D } from "./noise.js";

/** M4：纸纹三档预设（hot = 热压细纹 / cold = 中纹默认 / rough = 粗纹方向性强）
 *  注意：speckleFreq 越低 → 颗粒聚簇越粗（rough 用低频粗簇，hot 用高频细砂） */
const PAPER_PRESETS = {
  hot: { amplitude: 0.4, freq: 0.012, grainFreq: 0.14, grainAmp: 0.25, speckleFreq: 0.5, fiberAmp: 0.05, capScale: 0.3 },
  cold: {},
  rough: { amplitude: 1.6, freq: 0.03, grainFreq: 0.2, grainAmp: 1.0, speckleFreq: 0.16, fiberAmp: 0.42, fiberBias: 0.4, capScale: 0.75 },
};

/**
 * @param {number} w 网格宽
 * @param {number} h 网格高
 * @param {object} opt { seed, preset('hot'|'cold'|'rough'), freq(纸纹主频), octaves, amplitude, capScale, capOff, grainFreq, grainAmp,
 *   fiberFreq(方向场频率), fiberBias(预设主方向弧度), fiberAmp(H 条状分量幅度) }
 */
export function makePaper(w, h, { preset = "cold", ...userOpts } = {}) {
  const {
    seed = 0,
    freq = 0.018,
    octaves = 5,
    amplitude = 1.0,   // H 的起伏幅度（>0）
    capScale = 0.5,
    capOff = 0.35,
    grainFreq = 0.09,
    grainAmp = 0.5,
    speckleFreq = 0.42,
    fiberFreq = 0.012,   // M1：纤维方向场频率（低频 → 大域平滑转向）
    fiberBias = 0,       // M1：预设主方向（弧度；0 = 纯噪声方向）
    fiberAmp = 0.18,     // M1：H 沿纤维条状分量的幅度（保守起步，防"木纹滤镜"）
  } = { ...(PAPER_PRESETS[preset] || {}), ...userOpts };
  // H：主纸纹（0..1，中心 0.5 为平均高度）
  const H = fbmField(w, h, { freq, octaves, seed, normalize: true }).data;
  // M1：纤维方向场 θ（低频 value noise + 平滑偏置）
  const Tx = new Float32Array(w * h);
  const Ty = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 相邻两点差分方向做 2×2 平滑，避免格间跳变
      const th = valueNoise2D(x * fiberFreq, y * fiberFreq, seed ^ 0x51ab2d) * Math.PI * 2 + fiberBias;
      Tx[y * w + x] = Math.cos(th);
      Ty[y * w + x] = Math.sin(th);
    }
  }
  // M1：H 叠加沿纤维拉伸的条状分量（沿纤维坐标压缩 → 条带沿纤维拉长）
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const tx = Tx[i], ty = Ty[i];
      // 沿纤维坐标 a、跨纤维坐标 b
      const a = x * tx + y * ty, b = -x * ty + y * tx;
      const streak = fbm2D(a * 0.02 + 7.3, b * 0.14, { octaves: 3, seed: seed ^ 0x1e7a35 });
      H[i] = H[i] + fiberAmp * (streak - 0.5) * 2;
    }
  }
  // 重新归一化 H 到 [0,1]（叠加后中心仍在 ~0.5）
  {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < H.length; i++) { if (H[i] < mn) mn = H[i]; if (H[i] > mx) mx = H[i]; }
    const s = mx > mn ? 1 / (mx - mn) : 1;
    for (let i = 0; i < H.length; i++) H[i] = (H[i] - mn) * s;
  }
  // C：持水容量（洼地多持水）
  const C = new Float32Array(w * h);
  for (let i = 0; i < H.length; i++) {
    C[i] = Math.min(1.0, Math.max(0.05, H[i] * capScale + capOff));
  }
  // G：中频颗粒层，沉积与渲染调制用
  const G = fbmField(w, h, { freq: grainFreq, octaves: 4, seed: seed ^ 0x9e3779b9, normalize: true }).data;
  for (let i = 0; i < G.length; i++) G[i] = 0.5 + (G[i] - 0.5) * grainAmp * 2;
  // F：高频细颗粒（granulation 聚簇的尺度）
  const F = fbmField(w, h, { freq: speckleFreq, octaves: 3, seed: seed ^ 0x85ebca6b, normalize: true }).data;
  for (let i = 0; i < F.length; i++) F[i] = 0.5 + (F[i] - 0.5) * 1.6;
  return { w, h, H, C, G, F, Tx, Ty, amplitude };
}

/** 采样 fBm 单点（低频主纹），用于纸张放大渲染时的连续值 */
export function paperSample(paper, x, y) {
  return fbm2D(x * paper.freq, y * paper.freq, { octaves: paper.octaves, seed: paper.seed });
}
