// agent 实测运行器：跑 agent-scene.js（LLM 只通过 stroke 协议构思的静物）→ 最终 PNG + 过程动图 + 干燥动图
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { writeGIF } from "../src/io/gif.js";
import { mkdirSync } from "node:fs";
import { scene, DRY_STEPS, DRY_FRAME_EVERY, EVO_FRAME_EVERY } from "./agent-scene.js";

const OUT = "out";
mkdirSync(OUT, { recursive: true });
const t0 = performance.now();
const studio = createStudio({ width: 640, height: 480, seed: 7, painterSeed: 19 });
const { engine, apply, render } = studio;

const evoFrames = [];
for (const { stroke, stepsAfter } of scene) {
  apply(stroke);
  let left = stepsAfter;
  while (left > 0) {
    const chunk = Math.min(EVO_FRAME_EVERY, left);
    engine.step(chunk);
    left -= chunk;
    if (left <= 0 || chunk === EVO_FRAME_EVERY) evoFrames.push(render().data);
  }
}
const dryFrames = [];
for (let s = 0; s < DRY_STEPS; s++) {
  engine.step(1);
  if ((s + 1) % DRY_FRAME_EVERY === 0) dryFrames.push(render().data);
}
const final = render();
writePNG(`${OUT}/agent_still_life.png`, final.data, final.w, final.h);
writeGIF(`${OUT}/agent_evolution.gif`, evoFrames, { w: final.w, h: final.h, delayCs: 12 });
writeGIF(`${OUT}/agent_drying.gif`, dryFrames, { w: final.w, h: final.h, delayCs: 50 });
console.log(`agent scene: ${scene.length} strokes | sim steps ${engine.stepCount} | water left ${engine.totalWater().toFixed(2)} | elapsed ${((performance.now() - t0) / 1000).toFixed(1)}s`);
