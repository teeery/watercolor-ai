// 对比图：本引擎渲染 vs 平涂模拟（dsh-studio 式 SVG 平涂：同形状、平色、无介质）
// 输出 2560×960 并排：左 = 引擎（水是真的），右 = 平涂
import { createStudio } from "../src/studio/studio.js";
import { StrokePainter, hexToRgb01 } from "../src/brush/strokes.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";
import { scene } from "./scene.js";

const OUT = "out";
mkdirSync(OUT, { recursive: true });
const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const tag = studio.colorSystem.name === "spectral" ? "_spectral" : "";

// —— 引擎侧 ——
for (const { stroke, stepsAfter } of scene) studio.apply(stroke, stepsAfter);
const left = studio.render();

// —— 平涂侧 ——
const paper = [0.99, 0.975, 0.94];
const flat = new Float32Array(640 * 480 * 3);
for (let i = 0; i < 640 * 480; i++) {
  flat[i * 3] = paper[0]; flat[i * 3 + 1] = paper[1]; flat[i * 3 + 2] = paper[2];
}
const flatPainter = new StrokePainter(studio.engine, { seed: 11 });
const over = (mask, [cr, cg, cb], alpha) => {
  for (let i = 0; i < 640 * 480; i++) {
    const m = mask[i];
    if (m <= 0) continue;
    const a = Math.min(1, m * alpha);
    flat[i * 3] = flat[i * 3] * (1 - a) + cr * a;
    flat[i * 3 + 1] = flat[i * 3 + 1] * (1 - a) + cg * a;
    flat[i * 3 + 2] = flat[i * 3 + 2] * (1 - a) + cb * a;
  }
};
for (const { stroke } of scene) {
  if (stroke.type === "re-wet" || stroke.type === "lift") continue;
  const rgb = stroke.pigment.color ? hexToRgb01(stroke.pigment.color) : [0.5, 0.5, 0.5];
  const amt = Math.min(0.85, (stroke.pigment.amount ?? 0.5) * 0.28);
  let mask;
  switch (stroke.type) {
    case "wet-wash": case "glaze": {
      if (stroke.path) mask = flatPainter.ribbon(stroke.path, { radius: stroke.radius, radiusEnd: stroke.radiusEnd, soft: 9, jag: 0.08 });
      else { const { cx, cy, rx, ry } = stroke.region; mask = flatPainter.blob(cx, cy, rx, ry, { jag: 0.15, soft: 10 }); }
      break;
    }
    case "dry-brush": {
      mask = flatPainter.strokePath(stroke.path, stroke.radius, { spacing: 0.6, rJitter: 0.2, wJitter: 0.25, soft: 0.6, grainBreak: 0 });
      break;
    }
    case "spatter": {
      mask = flatPainter.spatter(stroke.center.cx, stroke.center.cy, { count: stroke.count, spread: stroke.spread });
      break;
    }
    default: continue;
  }
  over(mask, rgb, amt);
}
const right = new Uint8Array(640 * 480 * 4);
for (let i = 0; i < 640 * 480; i++) {
  right[i * 4] = (flat[i * 3] * 255) | 0;
  right[i * 4 + 1] = (flat[i * 3 + 1] * 255) | 0;
  right[i * 4 + 2] = (flat[i * 3 + 2] * 255) | 0;
  right[i * 4 + 3] = 255;
}

// —— 拼接 ——
const W = 1280, H = 960;
const canvas = new Uint8Array(W * 2 * H * 4).fill(255);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const li = (y * W + x) * 4;
    const lo = (y * W * 2 + x) * 4;
    canvas[lo] = left.data[li]; canvas[lo + 1] = left.data[li + 1]; canvas[lo + 2] = left.data[li + 2]; canvas[lo + 3] = 255;
    const sx = x >> 1, sy = y >> 1;
    const ri = (sy * 640 + sx) * 4;
    const ro = (y * W * 2 + x + W) * 4;
    canvas[ro] = right[ri]; canvas[ro + 1] = right[ri + 1]; canvas[ro + 2] = right[ri + 2]; canvas[ro + 3] = 255;
  }
}
writePNG(`${OUT}/compare${tag}.png`, canvas, W * 2, H);
console.log(`[${studio.colorSystem.name}] wrote ${OUT}/compare${tag}.png (${W * 2}x${H}): left=engine, right=flat`);
