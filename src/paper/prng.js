// 确定性随机：mulberry32 PRNG + 2D 格点哈希（value noise 用）
// 同一 seed → 同一序列；跨平台一致（IEEE754 double）

/** mulberry32 流式 PRNG，返回 [0,1) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D 整数格点哈希 → [0,1)。value noise 的晶格随机值。 */
export function hash2d(ix, iy, seed = 0) {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 1274126177;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** 生成一张 W×H 的白噪声纹理（可平铺/偏移采样用） */
export function makeNoiseTexture(w, h, seed = 0) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      out[y * w + x] = hash2d(x, y, seed);
  return out;
}
