// 纸：高度场 H（bump）+ 持水容量 C + 细颗粒 G
// 规格 §5：H = fBm（octaves 4-6），C = clamp(H·capScale + capOff)
// 细颗粒 G 是更高频的一层，用于渲染纹理与颗粒聚集调制
import { fbmField, fbm2D } from "./noise.js";

/**
 * @param {number} w 网格宽
 * @param {number} h 网格高
 * @param {object} opt { seed, freq(纸纹主频), octaves, amplitude(纸纹起伏幅度), capScale, capOff, grainFreq, grainAmp }
 */
export function makePaper(w, h, {
  seed = 0,
  freq = 0.018,
  octaves = 5,
  amplitude = 1.0,   // H 的起伏幅度（>0）
  capScale = 0.5,
  capOff = 0.35,
  grainFreq = 0.09,
  grainAmp = 0.5,
  speckleFreq = 0.42,
} = {}) {
  // H：主纸纹（0..1，中心 0.5 为平均高度）
  const H = fbmField(w, h, { freq, octaves, seed, normalize: true }).data;
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
  return { w, h, H, C, G, F, amplitude };
}

/** 采样 fBm 单点（低频主纹），用于纸张放大渲染时的连续值 */
export function paperSample(paper, x, y) {
  return fbm2D(x * paper.freq, y * paper.freq, { octaves: paper.octaves, seed: paper.seed });
}
