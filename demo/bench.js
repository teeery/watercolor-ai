// M0 性能仪表：跑 render-demo 场景，用 debugHook 分阶段计时 → 定位热点
// 用法：node demo/bench.js            （RGB）
// 输出：分阶段耗时表 + 渲染/IO 分解。不改任何 out/ 产物（最终 PNG 仅作冒烟校验）。
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { writeGIF } from "../src/io/gif.js";
import { mkdirSync } from "node:fs";
import { scene, DRY_STEPS, DRY_FRAME_EVERY, EVO_FRAME_EVERY } from "./scene.js";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

// 静止短路 A/B：QUIESCENT_U=0.02 node demo/bench.js （0 = 关，行为保持模式）
const QU = Number(process.env.QUIESCENT_U || 0);
const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11, params: { quiescentU: QU } });
const { engine, apply, render } = studio;
const tag = studio.colorSystem.name === "spectral" ? "_spectral" : "";

// —— 分阶段计时：debugHook 在每个阶段边界打点，两次打点之差 = 刚结束的那个阶段 ——
const STAGES = ["1-flow", "2-water", "3-expand", "4-pigment", "5-deposit", "6-front", "7-edge", "8-evap", "9-freeze"];
const paintAcc = Object.fromEntries(STAGES.map((n) => [n, 0]));
const dryAcc = Object.fromEntries(STAGES.map((n) => [n, 0]));
let bucket = paintAcc;
let prev = performance.now();
engine.debugHook = (name) => {
  const now = performance.now();
  bucket[name] += now - prev;
  prev = now;
};
// 每次 step() 调用重置 prev，避免跨调用间（渲染/笔触）的时长混入下一阶段
const origStep = engine.step.bind(engine);
engine.step = (n) => { prev = performance.now(); origStep(n); };

// —— 作画阶段（与 render-demo 同节奏，但不穿插渲染 → 纯模拟耗时）——
let tStroke = 0;
for (const { stroke, stepsAfter } of scene) {
  const t0 = performance.now();
  apply(stroke);
  tStroke += performance.now() - t0;
  let left = stepsAfter;
  while (left > 0) {
    const chunk = Math.min(EVO_FRAME_EVERY, left);
    engine.step(chunk);
    left -= chunk;
  }
}
const tSimPaint = performance.now();

// —— 干燥阶段 ——
bucket = dryAcc;
for (let s = 0; s < DRY_STEPS; s++) engine.step(1);
const tSimDry = performance.now();

// —— 渲染与 IO ——
const evoN = Math.ceil(scene.reduce((s, x) => s + x.stepsAfter, 0) / EVO_FRAME_EVERY);
const dryN = Math.ceil(DRY_STEPS / DRY_FRAME_EVERY);
let tRender = 0;
for (let i = 0; i < evoN + dryN + 1; i++) {
  const t0 = performance.now();
  render();
  tRender += performance.now() - t0;
}
const t0io = performance.now();
const final = render();
writePNG(`${OUT}/bench_final${tag}.png`, final.data, final.w, final.h);
const tPng = performance.now() - t0io;
const t0gif = performance.now();
// GIF 计时用 4 帧 32×32（大尺寸 GIF 耗时以 render-demo 自身的 elapsed 为准）
const gifFrames = [];
{
  let v = 0;
  for (let f = 0; f < 4; f++) {
    const buf = new Uint8Array(32 * 32 * 4);
    for (let i = 0; i < buf.length; i += 4) { buf[i] = v; buf[i + 1] = 64; buf[i + 2] = 192 - v; buf[i + 3] = 255; }
    v += 32;
    gifFrames.push(buf);
  }
}
writeGIF(`${OUT}/bench_evo${tag}.gif`, gifFrames, { w: 32, h: 32, delayCs: 12 });
const tGif = performance.now() - t0gif;
const tTotal = performance.now();

const fmt = (ms) => (ms / 1000).toFixed(2) + "s";
const line = (label, table) =>
  `${label.padEnd(12)} ${STAGES.map((n) => table[n].toFixed(1).padStart(6)).join("")} ms   (${fmt(STAGES.reduce((s, n) => s + table[n], 0))})`;
console.log(`[${studio.colorSystem.name}] bench (${scene.length} strokes, ${engine.stepCount} sim steps, quiescentU=${QU})`);
console.log("stage          " + STAGES.map((n) => n.replace(/^\d-/, "").padStart(6)).join("") + "   total");
console.log(line("paint", paintAcc));
console.log(line("dry", dryAcc));
console.log(`stroke masks  ${fmt(tStroke)} | paint sim ${fmt(tSimPaint)} | dry sim ${fmt(tSimDry)}`);
console.log(`render x${evoN + dryN + 1}  ${fmt(tRender)} (${((tRender / (evoN + dryN + 1)) * 1).toFixed(1)}ms/frame) | PNG ${fmt(tPng)} | GIF(空) ${fmt(tGif)}`);
console.log(`TOTAL ${fmt(tTotal)}`);
