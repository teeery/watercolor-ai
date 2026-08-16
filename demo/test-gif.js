// GIF 编码器验证套件：覆盖 511/1023/2047/4096 全部码宽边界
import { encodeGIF } from "../src/io/gif.js";
import { writeFileSync } from "node:fs";

// 用例 1：64×64 渐变（字典必过 511）
const grad = (W, H, f) => {
  const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    d[i] = (x * 4 + f * 20) & 255;
    d[i + 1] = (y * 4) & 255;
    d[i + 2] = ((x + y) * 2 + f * 40) & 255;
    d[i + 3] = 255;
  }
  return d;
};
writeFileSync("out/gif-test-1.gif", encodeGIF([grad(64, 64, 0)], { w: 64, h: 64 }));
console.log("wrote test-1 (gradient 64)");

// 用例 2：256×256 伪随机（逼满 12 位表，触发表满 reset）
let s = 12345;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const noise = new Uint8Array(256 * 256 * 4);
for (let i = 0; i < 256 * 256; i++) {
  noise[i * 4] = (rnd() * 255) | 0;
  noise[i * 4 + 1] = (rnd() * 255) | 0;
  noise[i * 4 + 2] = (rnd() * 255) | 0;
  noise[i * 4 + 3] = 255;
}
writeFileSync("out/gif-test-2.gif", encodeGIF([noise], { w: 256, h: 256 }));
console.log("wrote test-2 (noise 256)");

// 用例 3：多帧
writeFileSync("out/gif-test-3.gif", encodeGIF([grad(64, 64, 0), grad(64, 64, 1), grad(64, 64, 2)], { w: 64, h: 64 }));
console.log("wrote test-3 (3 frames)");
