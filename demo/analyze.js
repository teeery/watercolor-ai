// 数值自检：区域颜色 / 边缘环暗度 / 水滴径向剖面（vision 限流期间的客观代理）
import { createStudio } from "../src/studio/studio.js";

const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const { apply, composite } = studio;

apply({ type: "wet-wash", region: { cx: 320, cy: 130, rx: 310, ry: 150 },
  pigment: { color: "#7da6c9", granulation: 0.2, staining: 0.5, amount: 1.5 }, water: 0.85, layers: 2 }, 250);
apply({ type: "wet-wash", region: { cx: 320, cy: 420, rx: 330, ry: 90 },
  pigment: { color: "#c9b37d", granulation: 0.4, staining: 0.6, amount: 1.65 }, water: 0.6, layers: 2 }, 250);
apply({ type: "dry-brush", radius: 16, path: [[260, 200], [290, 165], [330, 150], [370, 160], [400, 195]],
  pigment: { color: "#4d7a52", granulation: 0.6, staining: 0.4, amount: 1.9 }, water: 0.2 }, 150);
apply({ type: "re-wet", region: { cx: 470, cy: 200, rx: 26, ry: 26 }, water: 1.0 }, 500);

const { r, g, b, w, h, pmask } = composite();
const lum = (i) => 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
const region = (x0, y0, x1, y1) => {
  let R = 0, G = 0, B = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x; R += r[i]; G += g[i]; B += b[i]; n++;
  }
  return [R / n, G / n, B / n].map((v) => v.toFixed(3));
};

console.log("top(sky)  RGB:", region(40, 10, 600, 80), "expect r<b (blue)");
console.log("bottom    RGB:", region(40, 380, 600, 460), "expect r>b (ochre)");
console.log("dry-brush RGB:", region(280, 160, 400, 210), "expect g>r,b (green)");

let edgeLum = 0, edgeN = 0, intLum = 0, intN = 0;
for (let i = 0; i < w * h; i++) {
  if (pmask[i] > 0.15 && pmask[i] < 0.85) { edgeLum += lum(i); edgeN++; }
  else if (pmask[i] >= 0.99) { intLum += lum(i); intN++; }
}
console.log(`edge band lum: ${(edgeLum / edgeN).toFixed(3)} vs interior: ${(intLum / intN).toFixed(3)}`);
console.log("droplet radial lum profile (center→out):");
for (let k = 0; k <= 6; k++) {
  const rad = k * 10;
  let s = 0, n = 0;
  for (let y = 200 - rad; y <= 200 + rad; y++) for (let x = 470 - rad; x <= 470 + rad; x++) {
    if (y < 0 || y >= h || x < 0 || x >= w) continue;
    const d = Math.hypot(x - 470, y - 200);
    if (d >= rad && d < rad + 10) { s += lum(y * w + x); n++; }
  }
  if (n > 0) console.log(`  r=${rad}-${rad + 10}: ${(s / n).toFixed(3)}`);
}
