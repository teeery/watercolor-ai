// value noise 2D + fBm（Hobbs 规格 §5：晶格随机 + 双线性插值 + smoothstep，更便宜）
import { hash2d } from "./prng.js";

const smoothstep = (t) => t * t * (3 - 2 * t);

/** 单频 value noise，返回 [0,1) */
export function valueNoise2D(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smoothstep(x - x0), ty = smoothstep(y - y0);
  const v00 = hash2d(x0, y0, seed);
  const v10 = hash2d(x0 + 1, y0, seed);
  const v01 = hash2d(x0, y0 + 1, seed);
  const v11 = hash2d(x0 + 1, y0 + 1, seed);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

/** fBm：octaves 层，频率 ×lacunarity，振幅 ×gain */
export function fbm2D(x, y, { octaves = 5, lacunarity = 2.0, gain = 0.5, seed = 0 } = {}) {
  let amp = 1.0, freq = 1.0, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + o * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm; // [0,1)
}

/**
 * 预生成一张 fBm 噪声场（Float32Array, w*h, 行优先），返回 {data, min, max}
 * normalize=true 时归一化到 [0,1]。
 */
export function fbmField(w, h, { freq = 0.02, octaves = 5, gain = 0.5, seed = 0, normalize = true } = {}) {
  const data = new Float32Array(w * h);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = fbm2D(x * freq, y * freq, { octaves, gain, seed });
      data[y * w + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (normalize && max > min) {
    const s = 1 / (max - min);
    for (let i = 0; i < data.length; i++) data[i] = (data[i] - min) * s;
    return { data, min: 0, max: 1 };
  }
  return { data, min, max };
}
