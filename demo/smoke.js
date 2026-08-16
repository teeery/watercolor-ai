// JS 引擎冒烟：几笔 + 干燥 + PNG 输出 + 性能计时（分层重构后的回归测试）
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const { engine, apply, render } = studio;

const t0 = performance.now();

apply({ type: "wet-wash", region: { cx: 320, cy: 130, rx: 310, ry: 150 },
  pigment: { color: "#7da6c9", granulation: 0.2, staining: 0.5, amount: 1.5 }, water: 0.85, layers: 2 }, 250);
apply({ type: "wet-wash", region: { cx: 320, cy: 420, rx: 330, ry: 90 },
  pigment: { color: "#c9b37d", granulation: 0.4, staining: 0.6, amount: 1.65 }, water: 0.6, layers: 2 }, 250);
apply({ type: "dry-brush", radius: 16, path: [[260, 200], [290, 165], [330, 150], [370, 160], [400, 195]],
  pigment: { color: "#4d7a52", granulation: 0.6, staining: 0.4, amount: 1.9 }, water: 0.2 }, 150);
apply({ type: "re-wet", region: { cx: 470, cy: 200, rx: 26, ry: 26 }, water: 1.0 }, 500);

const tPainting = performance.now();
let frames = [];
for (let s = 0; s < 600; s++) {
  engine.step(1);
  if ((s + 1) % 30 === 0) frames.push(render().data);
}
const tDry = performance.now();

console.log(`paint phase: ${((tPainting - t0) / 1000).toFixed(1)}s`);
console.log(`dry 600 steps + 20 renders: ${((tDry - tPainting) / 1000).toFixed(1)}s`);
console.log(`totalWater after dry: ${engine.totalWater().toFixed(2)}`);

const final = render();
writePNG(`${OUT}/smoke_final.png`, final.data, final.w, final.h);
console.log(`wrote ${OUT}/smoke_final.png (${final.w}x${final.h})`);
