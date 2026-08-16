// 零依赖 GIF89a 编码器（全局调色板 6×7×6 + 4 灰 = 256 色，LZW）
export function encodeGIF(frames, { w, h, delayCs = 20, loop = 0 }) {
  const B = [];
  const byte = (v) => B.push(v & 0xff);
  const word = (v) => { B.push(v & 0xff, (v >> 8) & 0xff); };

  // 调色板
  const palette = new Uint8Array(256 * 3);
  let pi = 0;
  for (let r = 0; r < 6; r++)
    for (let g = 0; g < 7; g++)
      for (let b = 0; b < 6; b++) {
        palette[pi * 3] = (r * 255 / 5) | 0;
        palette[pi * 3 + 1] = (g * 255 / 6) | 0;
        palette[pi * 3 + 2] = (b * 255 / 5) | 0;
        pi++;
      }
  for (let k = 0; k < 4; k++) {
    const v = (k * 255 / 3) | 0;
    palette[pi * 3] = v; palette[pi * 3 + 1] = v; palette[pi * 3 + 2] = v;
    pi++;
  }

  const quant = (r, g, b) => {
    const ri = Math.min(5, (r * 5 / 255 + 0.5) | 0);
    const gi = Math.min(6, (g * 6 / 255 + 0.5) | 0);
    const bi = Math.min(5, (b * 5 / 255 + 0.5) | 0);
    return ri * 42 + gi * 6 + bi;
  };

  // Header
  for (const c of "GIF89a") B.push(c.charCodeAt(0));
  word(w); word(h);
  byte(0xf7); // GCT 256, color res 8
  byte(0); byte(0);
  for (let i = 0; i < 256 * 3; i++) byte(palette[i]);

  // Netscape loop
  byte(0x21); byte(0xff); byte(0x0b);
  for (const c of "NETSCAPE2.0") B.push(c.charCodeAt(0));
  byte(0x03); byte(0x01); word(loop); byte(0x00);

  const minCode = 8;
  const clear = 256, eoi = 257;

  const lzwEncode = (indices) => {
    const dict = new Map();
    let dictSize = 258, codeSize = 9;
    const out = [];
    let bitBuf = 0, bitCount = 0;
    const emit = (code) => {
      bitBuf |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) { out.push(bitBuf & 0xff); bitBuf >>>= 8; bitCount -= 8; }
    };
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = prefix * 4096 + k; // prefix < 4096, k < 256 → 唯一
      const hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      dict.set(key, dictSize);
      dictSize++;
      if (dictSize === 4096) {
        // 表满：以当前 12 位宽发 clear，重置
        emit(clear);
        dict.clear();
        dictSize = 258;
        codeSize = 9;
      } else if (dictSize === (1 << codeSize) + 1 && codeSize < 12) {
        // 编码器加条目比解码器早一个码（解码器读到下一个码才加对应条目），
        // 故切换比"表尺寸到 2^n"晚一条目：dictSize === 2^n + 1 时才加宽
        codeSize++;
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (bitCount > 0) out.push(bitBuf & 0xff);
    return out;
  };

  for (const rgba of frames) {
    // GCE
    byte(0x21); byte(0xf9); byte(0x04);
    byte(0x04); // disposal: none
    word(delayCs);
    byte(0x00); byte(0x00);
    // Image descriptor
    byte(0x2c);
    word(0); word(0); word(w); word(h);
    byte(0x00);
    // 量化
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) idx[i] = quant(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    const lzw = lzwEncode(idx);
    byte(minCode);
    // sub-blocks
    for (let i = 0; i < lzw.length; i += 255) {
      const n = Math.min(255, lzw.length - i);
      byte(n);
      for (let j = 0; j < n; j++) byte(lzw[i + j]);
    }
    byte(0x00);
  }
  byte(0x3b);
  return Buffer.from(B);
}

import { writeFileSync } from "node:fs";
export function writeGIF(filePath, frames, opts) {
  writeFileSync(filePath, encodeGIF(frames, opts));
}
