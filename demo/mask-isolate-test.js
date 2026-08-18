// demo/mask-isolate-test.js — 纯 mask 层隔离:10 戳平顶椭圆 max-merge,输出 PNG 供检查弧纹
import { paintEllipse } from "../src/brush/footprints.js";
import { writePNG } from "../src/io/png.js";

const w = 200, h = 100;
const mask = new Float32Array(w * h);
const ds = 6.3, rA = 35, rB = 25, soft = 8.8;
for (let k = 0; k < 30; k++) {
  const x = 20 + k * ds;
  paintEllipse(mask, w, h, x, 50, rA, rB, 1, 0, soft, { asymHead: 1.5, asymTail: 0.92 });
}
// 检查中线剖面与整体
const prof = [];
for (let x = 10; x < 190; x += 2) prof.push(mask[50 * w + x].toFixed(2));
console.log("中线剖面:", prof.join(" "));
// 输出可视化(灰度 → RGBA8)
const img = new Uint8Array(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const v = Math.round(Math.min(1, mask[i]) * 255);
  img[i * 4] = v; img[i * 4 + 1] = v; img[i * 4 + 2] = v; img[i * 4 + 3] = 255;
}
writePNG("out/mask-isolate.png", img, w, h);
console.log("saved out/mask-isolate.png");
