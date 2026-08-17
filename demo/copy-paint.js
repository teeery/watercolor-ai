// 临摹运行器（全记录版）：每一笔快照 + 每一模拟帧 PNG + 三个 GIF
// 产物：out/copy-frames/stroke_XXX.png（每笔后的画面）
//       out/copy-frames/frame_XXXX.png（每 50 步的画面）
//       out/copy-frames/dry_XX.png（干燥期每 35 步）
//       out/copy-strokes.gif（每笔一帧，0.8s/帧）| out/copy-evolution.gif（全过程）| out/copy-drying.gif
//       out/copy-final.png（2× 终稿 960×1280）
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { writeGIF } from "../src/io/gif.js";
import { mkdirSync } from "node:fs";
import { scene, DRY_STEPS, DRY_FRAME_EVERY, EVO_FRAME_EVERY } from "./copy-scene.js";

const OUT = "out";
const FRAMES = `${OUT}/copy-frames`;
mkdirSync(FRAMES, { recursive: true });
const t0 = performance.now();

const studio = createStudio({ width: 480, height: 640, seed: 5, painterSeed: 11 });
const { engine, apply, render } = studio;

// GIF 帧用 1×（省内存），快照/终稿用 2×
const frameImg = () => render({ upscale: 1 });
const snapImg = () => render({ upscale: 2 });

const strokeFrames = [];
const evoFrames = [];
const dryFrames = [];
let frameNo = 0;

for (let i = 0; i < scene.length; i++) {
  const { stroke, stepsAfter } = scene[i];
  apply(stroke);
  let left = stepsAfter;
  while (left > 0) {
    const chunk = Math.min(EVO_FRAME_EVERY, left);
    engine.step(chunk);
    left -= chunk;
    const img = frameImg();
    frameNo++;
    writePNG(`${FRAMES}/frame_${String(frameNo).padStart(4, "0")}.png`, img.data, img.w, img.h);
    evoFrames.push(img.data);
  }
  const snap = snapImg();
  writePNG(`${FRAMES}/stroke_${String(i + 1).padStart(3, "0")}.png`, snap.data, snap.w, snap.h);
  strokeFrames.push(frameImg().data);
  console.log(`stroke ${i + 1}/${scene.length} done (frames ${frameNo})`);
}

for (let s = 0; s < DRY_STEPS; s++) {
  engine.step(1);
  if ((s + 1) % DRY_FRAME_EVERY === 0) {
    const img = frameImg();
    writePNG(`${FRAMES}/dry_${String((s + 1) / DRY_FRAME_EVERY).padStart(2, "0")}.png`, img.data, img.w, img.h);
    dryFrames.push(img.data);
  }
}

const final = snapImg();
writePNG(`${OUT}/copy-final.png`, final.data, final.w, final.h);
writeGIF(`${OUT}/copy-strokes.gif`, strokeFrames, { w: 480, h: 640, delayCs: 80 });
writeGIF(`${OUT}/copy-evolution.gif`, evoFrames, { w: 480, h: 640, delayCs: 12 });
writeGIF(`${OUT}/copy-drying.gif`, dryFrames, { w: 480, h: 640, delayCs: 50 });

console.log(`strokes ${scene.length} | frames ${frameNo} + dry ${dryFrames.length} | steps ${engine.stepCount} | water ${engine.totalWater().toFixed(2)} | elapsed ${((performance.now() - t0) / 1000).toFixed(1)}s`);
console.log(`out/copy-frames/ (${frameNo + scene.length + dryFrames.length} PNG) + copy-strokes.gif + copy-evolution.gif + copy-drying.gif + copy-final.png`);
