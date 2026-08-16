// 渲染：场 → RGBA8（纸纹/颗粒/湿暗/边缘加深 公共阴影层 × 颜色系统提供的每像素 RGB）
// 颜色合成（RGB 三通道 KM 或 16 波段光谱 KM）在 ColorSystem 里，可独立升级
export function compositePlanes(eng, colorSystem, {
  paperColor = [0.99, 0.975, 0.94],
  wetDarken = 0.07,
  grainShade = 0.10,
  edgeDarken = 0.12, // M1：模拟侧边缘加深（stage 7/8 bugfix）已生效，渲染侧降权防"灰色铅笔线"（vision 终审意见）
  edgeBlur = 4,
  granShade = 0.22,
} = {}) {
  const { w, h, W, Dm, Pm, paper } = eng;
  const { H, G, F } = paper;

  const pmask = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const d = Dm[i] + Pm[i];
    pmask[i] = d > 0.02 ? 1 : d / 0.02;
  }
  const pblur = boxBlur(pmask, w, h, edgeBlur);

  const r = new Float32Array(w * h);
  const g = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const hh = H[i], gg = G[i], ff = F[i];
      const painted = pmask[i];
      const valley = 0.5 - hh;
      const baseShade = (0.96 + 0.08 * hh) * (1 + grainShade * (gg - 0.5) * 0.5)
        * (1 - granShade * (ff - 0.5) * (0.6 + 0.8 * valley) * painted);
      const wet = Math.min(1, W[i]);
      const wetShade = 1 - wetDarken * wet;
      let edge = pmask[i] - pblur[i];
      edge = edge > 0 ? edge : 0;
      const edgeBand = edge * (0.7 + 0.6 * ff);
      const edgeShade = 1 - edgeDarken * edgeBand;
      const [cr, cg, cb] = colorSystem.pixelToRGB(eng, i, paperColor);
      r[i] = cr * baseShade * wetShade * edgeShade;
      g[i] = cg * baseShade * wetShade * edgeShade;
      b[i] = cb * baseShade * wetShade * edgeShade;
    }
  }
  return { r, g, b, w, h, pmask };
}

export function renderRGBA(eng, colorSystem, opts = {}) {
  const { r, g, b, w, h } = compositePlanes(eng, colorSystem, opts);
  const upscale = opts.upscale ?? 2;
  const W2 = w * upscale, H2 = h * upscale;
  const out = new Uint8Array(W2 * H2 * 4);
  const inv = 1 / upscale;
  for (let y2 = 0; y2 < H2; y2++) {
    const fy = (y2 + 0.5) * inv - 0.5;
    let y0 = Math.floor(fy);
    if (y0 < 0) y0 = 0;
    let y1 = y0 + 1;
    if (y1 > h - 1) y1 = h - 1;
    const ty = fy - y0;
    const row2 = y2 * W2;
    const r0 = y0 * w, r1 = y1 * w;
    for (let x2 = 0; x2 < W2; x2++) {
      const fx = (x2 + 0.5) * inv - 0.5;
      let x0 = Math.floor(fx);
      if (x0 < 0) x0 = 0;
      let x1 = x0 + 1;
      if (x1 > w - 1) x1 = w - 1;
      const tx = fx - x0;
      const i00 = r0 + x0, i10 = r0 + x1, i01 = r1 + x0, i11 = r1 + x1;
      const o = (row2 + x2) * 4;
      const vr = bilerp(r, i00, i10, i01, i11, tx, ty);
      const vg = bilerp(g, i00, i10, i01, i11, tx, ty);
      const vb = bilerp(b, i00, i10, i01, i11, tx, ty);
      out[o]     = vr < 0 ? 0 : vr > 1 ? 255 : (vr * 255) | 0;
      out[o + 1] = vg < 0 ? 0 : vg > 1 ? 255 : (vg * 255) | 0;
      out[o + 2] = vb < 0 ? 0 : vb > 1 ? 255 : (vb * 255) | 0;
      out[o + 3] = 255;
    }
  }
  return { data: out, w: W2, h: H2 };
}

/** 可分离 box blur */
function boxBlur(src, w, h, rad) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const inv = 1 / (2 * rad + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -rad; x <= rad; x++) acc += src[row + ((x + w) % w)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * inv;
      acc += src[row + ((x + rad + 1 + w) % w)] - src[row + ((x - rad + w) % w)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -rad; y <= rad; y++) acc += tmp[((y + h) % h) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * inv;
      acc += tmp[((y + rad + 1 + h) % h) * w + x] - tmp[((y - rad + h) % h) * w + x];
    }
  }
  return out;
}

function bilerp(a, i00, i10, i01, i11, tx, ty) {
  const v0 = a[i00] + (a[i10] - a[i00]) * tx;
  const v1 = a[i01] + (a[i11] - a[i01]) * tx;
  return v0 + (v1 - v0) * ty;
}
