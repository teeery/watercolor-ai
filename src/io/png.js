// 零依赖 PNG 编码器（RGBA8）+ 解码器（8-bit gray/RGB/palette/grayA/RGBA）
// PNG = 签名 + IHDR + IDAT(deflate) + IEND；CRC32 表 + zlib 用 node:zlib
import { deflateSync, inflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** RGBA8 Uint8Array（w*h*4，行优先）→ PNG Buffer */
export function encodePNG(rgba, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/** 写 PNG 文件 */
export function writePNG(filePath, rgba, w, h) {
  writeFileSync(filePath, encodePNG(rgba, w, h));
}

/** 零依赖 PNG 解码器：8-bit gray(0)/RGB(2)/palette(3)/grayA(4)/RGBA(6)，filter 0-4，非隔行 */
export function decodePNG(src) {
  const buf = src instanceof Uint8Array ? src : new Uint8Array(src);
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error("decodePNG: not a PNG");
  }
  const read32 = (o) => ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;
  let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null;
  const idat = [];
  let o = 8;
  while (o + 8 <= buf.length) {
    const len = read32(o);
    const type = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
    const d0 = o + 8;
    if (type === "IHDR") {
      w = read32(d0); h = read32(d0 + 4);
      bitDepth = buf[d0 + 8]; colorType = buf[d0 + 9]; interlace = buf[d0 + 12];
    } else if (type === "PLTE") palette = buf.subarray(d0, d0 + len);
    else if (type === "IDAT") idat.push(buf.subarray(d0, d0 + len));
    else if (type === "IEND") break;
    o = d0 + len + 4;
  }
  if (bitDepth !== 8) throw new Error(`decodePNG: unsupported bitDepth ${bitDepth}`);
  if (interlace !== 0) throw new Error("decodePNG: interlaced PNG unsupported");
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (chans == null) throw new Error(`decodePNG: unsupported colorType ${colorType}`);
  if (colorType === 3 && !palette) throw new Error("decodePNG: palette PNG missing PLTE");

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * chans;
  const img = new Uint8Array(stride * h);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    for (let x = 0; x < stride; x++) {
      const a = x >= chans ? cur[x - chans] : 0;
      const b = prev[x];
      const c = x >= chans ? prev[x - chans] : 0;
      let v = raw[p++];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) v = (v + paeth(a, b, c)) & 255;
      cur[x] = v;
    }
    img.set(cur, y * stride);
    prev.set(cur);
  }

  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o4 = i * 4;
    if (colorType === 0) { out[o4] = out[o4 + 1] = out[o4 + 2] = img[i]; out[o4 + 3] = 255; }
    else if (colorType === 2) { out[o4] = img[i * 3]; out[o4 + 1] = img[i * 3 + 1]; out[o4 + 2] = img[i * 3 + 2]; out[o4 + 3] = 255; }
    else if (colorType === 3) { const q = img[i] * 3; out[o4] = palette[q]; out[o4 + 1] = palette[q + 1]; out[o4 + 2] = palette[q + 2]; out[o4 + 3] = 255; }
    else if (colorType === 4) { out[o4] = out[o4 + 1] = out[o4 + 2] = img[i * 2]; out[o4 + 3] = img[i * 2 + 1]; }
    else { out[o4] = img[i * 4]; out[o4 + 1] = img[i * 4 + 1]; out[o4 + 2] = img[i * 4 + 2]; out[o4 + 3] = img[i * 4 + 3]; }
  }
  return { data: out, w, h };
}

/** RGBA8 双线性缩放到 (dw, dh)，输出 Float32Array(dw*dh*3) 线性 RGB（0..1） */
export function resizeRGBAtoRGB(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh * 3);
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy = (y + 0.5) * sy - 0.5;
    let y0 = Math.floor(fy); if (y0 < 0) y0 = 0;
    let y1 = y0 + 1; if (y1 > sh - 1) y1 = sh - 1;
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = (x + 0.5) * sx - 0.5;
      let x0 = Math.floor(fx); if (x0 < 0) x0 = 0;
      let x1 = x0 + 1; if (x1 > sw - 1) x1 = sw - 1;
      const tx = fx - x0;
      const o = (y * dw + x) * 3;
      for (let c = 0; c < 3; c++) {
        const i00 = (y0 * sw + x0) * 4 + c, i10 = (y0 * sw + x1) * 4 + c;
        const i01 = (y1 * sw + x0) * 4 + c, i11 = (y1 * sw + x1) * 4 + c;
        const v0 = src[i00] + (src[i10] - src[i00]) * tx;
        const v1 = src[i01] + (src[i11] - src[i01]) * tx;
        out[o + c] = (v0 + (v1 - v0) * ty) / 255;
      }
    }
  }
  return out;
}
