// 主运行器：跑完整场景 → 阶段快照 + 最终 PNG + 作画过程动图 + 10 秒干燥动图
// 颜色系统：COLOR_SYSTEM=spectral 切光谱（16 通道），缺省 RGB 三通道
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { writeGIF } from "../src/io/gif.js";
import { mkdirSync } from "node:fs";
import { scene, DRY_STEPS, DRY_FRAME_EVERY, EVO_FRAME_EVERY } from "./scene.js";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

const t0 = performance.now();
const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const { engine, apply, render } = studio;

const evoFrames = [];
const stageSnaps = [];

for (let i = 0; i < scene.length; i++) {
  const { stroke, stepsAfter } = scene[i];
  apply(stroke);
  let left = stepsAfter;
  while (left > 0) {
    const chunk = Math.min(EVO_FRAME_EVERY, left);
    engine.step(chunk);
    left -= chunk;
    if (left <= 0 || chunk === EVO_FRAME_EVERY) evoFrames.push(render().data);
  }
  if ((i + 1) % 6 === 0 || i === scene.length - 1) {
    const img = render();
    writePNG(`${OUT}/stage_${String(i + 1).padStart(2, "0")}.png`, img.data, img.w, img.h);
    stageSnaps.push(i + 1);
  }
}

const dryFrames = [];
for (let s = 0; s < DRY_STEPS; s++) {
  engine.step(1);
  if ((s + 1) % DRY_FRAME_EVERY === 0) dryFrames.push(render().data);
}

const tRender = performance.now();

const final = render();
const tag = studio.colorSystem.name === "spectral" ? "_spectral" : "";
writePNG(`${OUT}/demo_final${tag}.png`, final.data, final.w, final.h);
writeGIF(`${OUT}/evolution${tag}.gif`, evoFrames, { w: final.w, h: final.h, delayCs: 12 });
writeGIF(`${OUT}/drying_timeline${tag}.gif`, dryFrames, { w: final.w, h: final.h, delayCs: 50 });
console.log(`[${studio.colorSystem.name}] strokes: ${scene.length} | sim steps: ${engine.stepCount}`);
console.log(`evo frames: ${evoFrames.length} | dry frames: ${dryFrames.length}`);
console.log(`water left: ${engine.totalWater().toFixed(2)} | elapsed: ${((tRender - t0) / 1000).toFixed(1)}s`);
console.log(`outputs: demo_final${tag}.png, evolution${tag}.gif, drying_timeline${tag}.gif`);
