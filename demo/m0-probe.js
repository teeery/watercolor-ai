// M0 场 dump 探针：跑完第 N 笔后把 W/P/D/M 写二进制，供新旧引擎逐格对比
// 用法：node demo/m0-probe.js dump <strokeIndex>
import { mkdirSync, writeFileSync } from "node:fs";
import { createStudio } from "../src/studio/studio.js";
import { scene } from "./scene.js";

const [, , mode, idxStr] = process.argv;
const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const { engine, apply } = studio;

if (mode === "dump") {
  const idx = Number(idxStr || 0);
  for (let si = 0; si <= idx; si++) apply(scene[si].stroke, scene[si].stepsAfter);
  dumpState(engine, "out/dump");
  console.log(`dumped after stroke ${idx}`);
} else if (mode === "dumpstep") {
  const n = Number(idxStr || 0);
  apply(scene[0].stroke, 0);
  engine.step(n);
  dumpState(engine, "out/dump");
  console.log(`dumped after stroke 0 + ${n} steps`);
} else if (mode === "chart") {
  // 色卡流程逐笔校验和（RGB 3 通道，不含标签直写）
  const { PIGMENTS } = await import("../src/color/pigments.js");
  const s = createStudio({ width: 640, height: 480, seed: 21, painterSeed: 31 });
  const { apply, engine } = s;
  const sum = (a) => { let x = 0; for (let i = 0; i < a.length; i++) x += a[i]; return x; };
  const COLS = 6, CW = 640 / COLS, CH = 480 / 4;
  for (let i = 0; i < PIGMENTS.length; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW + CW / 2;
    const cyTop = row * CH + CH * 0.28;
    const cyDil = row * CH + CH * 0.58;
    const halfW = CW * 0.30;
    const pig = { name: p.name, color: p.hex, granulation: p.granulation, staining: p.staining, amount: 2.0 };
    apply({ type: "wet-wash", path: [[cx - halfW, cyTop - 3], [cx, cyTop + 1], [cx + halfW, cyTop - 2]], radius: CH * 0.16, radiusEnd: CH * 0.12, pigment: pig, water: 0.55, layers: 1 }, 70);
    console.log(`${i}a\t${p.name}\tW=${sum(engine.W).toFixed(6)}\tP=${engine.P.reduce((t, c) => t + sum(c), 0).toFixed(6)}\tD=${engine.D.reduce((t, c) => t + sum(c), 0).toFixed(6)}\tPm=${sum(engine.Pm).toFixed(6)}\tDm=${sum(engine.Dm).toFixed(6)}\tM=${engine.M.reduce((t, v) => t + v, 0)}`);
    apply({ type: "glaze", path: [[cx - halfW, cyDil - 2], [cx, cyDil + 2], [cx + halfW, cyDil - 1]], radius: CH * 0.14, radiusEnd: CH * 0.10, pigment: { ...pig, amount: 0.7 }, water: 0.6 }, 110);
    console.log(`${i}b\t${p.name}\tW=${sum(engine.W).toFixed(6)}\tP=${engine.P.reduce((t, c) => t + sum(c), 0).toFixed(6)}\tD=${engine.D.reduce((t, c) => t + sum(c), 0).toFixed(6)}\tPm=${sum(engine.Pm).toFixed(6)}\tDm=${sum(engine.Dm).toFixed(6)}\tM=${engine.M.reduce((t, v) => t + v, 0)}`);
  }
  engine.step(400);
  console.log(`end\tW=${sum(engine.W).toFixed(6)}\tP=${engine.P.reduce((t, c) => t + sum(c), 0).toFixed(6)}\tD=${engine.D.reduce((t, c) => t + sum(c), 0).toFixed(6)}\tPm=${sum(engine.Pm).toFixed(6)}\tDm=${sum(engine.Dm).toFixed(6)}\tM=${engine.M.reduce((t, v) => t + v, 0)}`);
} else if (mode === "chartdump") {
  const { PIGMENTS } = await import("../src/color/pigments.js");
  const s = createStudio({ width: 640, height: 480, seed: 21, painterSeed: 31 });
  const { apply, engine } = s;
  const COLS = 6, CW = 640 / COLS, CH = 480 / 4;
  for (let i = 0; i < PIGMENTS.length; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW + CW / 2;
    const cyTop = row * CH + CH * 0.28, cyDil = row * CH + CH * 0.58;
    const halfW = CW * 0.30;
    const pig = { name: p.name, color: p.hex, granulation: p.granulation, staining: p.staining, amount: 2.0 };
    apply({ type: "wet-wash", path: [[cx - halfW, cyTop - 3], [cx, cyTop + 1], [cx + halfW, cyTop - 2]], radius: CH * 0.16, radiusEnd: CH * 0.12, pigment: pig, water: 0.55, layers: 1 }, 70);
    apply({ type: "glaze", path: [[cx - halfW, cyDil - 2], [cx, cyDil + 2], [cx + halfW, cyDil - 1]], radius: CH * 0.14, radiusEnd: CH * 0.10, pigment: { ...pig, amount: 0.7 }, water: 0.6 }, 110);
  }
  engine.step(400);
  dumpState(engine, "out/dump");
  console.log("chart state dumped");
} else if (mode === "celltrace") {
  // 追踪单格：打印每个 step 后的 W/M/P0/ux/uy（定位分歧点）
  const x = Number(idxStr), y = Number(process.argv[4] || 0), n = Number(process.argv[5] || 300);
  const i = y * 640 + x;
  apply(scene[0].stroke, 0);
  for (let s = 1; s <= n; s++) {
    engine.step(1);
    console.log(`${s}\tW=${engine.W[i].toExponential(3)}\tM=${engine.M[i]}\tP0=${engine.P[0][i].toExponential(3)}\tux=${engine.ux[i].toExponential(3)}\tuy=${engine.uy[i].toExponential(3)}`);
  }
} else if (mode === "selfcheck") {
  // 活跃集一致性自检：alx/aly 是否与格坐标一致、反向索引是否互逆
  const n = Number(idxStr || 255);
  apply(scene[0].stroke, 0);
  engine.step(n);
  let bad = 0;
  for (let k = 0; k < engine._alCount; k++) {
    const i = engine._al[k];
    const x = i % 640, y = (i / 640) | 0;
    if (engine._alx[k] !== x || engine._aly[k] !== y) { if (bad < 8) console.log(`slot ${k}: i=${i} alx=${engine._alx[k]} aly=${engine._aly[k]} want ${x},${y}`); bad++; }
    if (engine._alIdx[i] !== k) { if (bad < 8) console.log(`slot ${k}: idx[${i}]=${engine._alIdx[i]} want ${k}`); bad++; }
  }
  let orphans = 0;
  for (let k = 0; k < engine._alCount; k++) {
    if (engine.W[engine._al[k]] <= 0) orphans++;
  }
  console.log(`selfcheck @step ${n}: count=${engine._alCount} bad=${bad} dead-in-list=${orphans}`);
  dumpState(engine, "out/dump");
} else if (mode === "trace") {
  // 逐阶段校验和：定位第一个分歧的 (step, stage)
  const n = Number(idxStr || 260);
  const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  apply(scene[0].stroke, 0);
  engine.debugHook = (name) => {
    const Ws = sum(engine.W);
    const Ps = engine.P.reduce((s, c) => s + sum(c), 0);
    const Ds = engine.D.reduce((s, c) => s + sum(c), 0);
    const Pms = sum(engine.Pm), Dms = sum(engine.Dm), Ms = engine.M.reduce((s, v) => s + v, 0);
    console.log(`${engine.stepCount}\t${name}\t${Ws}\t${Ps}\t${Ds}\t${Pms}\t${Dms}\t${Ms}`);
  };
  engine.step(n);
} else {
  const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  for (let si = 0; si < scene.length; si++) {
    apply(scene[si].stroke, scene[si].stepsAfter);
    console.log(`${si}\t${sum(engine.W).toFixed(6)}\t${engine.P.reduce((s, c) => s + sum(c), 0).toFixed(6)}\t${engine.D.reduce((s, c) => s + sum(c), 0).toFixed(6)}\t${engine.M.reduce((s, v) => s + v, 0)}`);
  }
}

function dumpState(engine, dir) {
  mkdirSync(dir, { recursive: true });
  const { W, P, D, M, Pm, Dm, ux, uy } = engine;
  writeFileSync(`${dir}/W.bin`, Buffer.from(W.buffer));
  writeFileSync(`${dir}/M.bin`, Buffer.from(M.buffer));
  writeFileSync(`${dir}/ux.bin`, Buffer.from(ux.buffer));
  writeFileSync(`${dir}/uy.bin`, Buffer.from(uy.buffer));
  writeFileSync(`${dir}/Pm.bin`, Buffer.from(Pm.buffer));
  writeFileSync(`${dir}/Dm.bin`, Buffer.from(Dm.buffer));
  for (let c = 0; c < P.length; c++) writeFileSync(`${dir}/P${c}.bin`, Buffer.from(P[c].buffer));
  for (let c = 0; c < D.length; c++) writeFileSync(`${dir}/D${c}.bin`, Buffer.from(D[c].buffer));
}
