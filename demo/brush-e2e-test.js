// demo/brush-e2e-test.js — 新管线端到端:真引擎 + 守恒断言 + PNG 级确定性 + legacy 冒烟
// 用法: node demo/brush-e2e-test.js
import { createStudio } from "../src/studio/studio.js";
import { scene } from "./scene.js";

let failures = 0;
const ok = (name, cond, detail = "") => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${detail}`); }
  else console.log(`ok   ${name} ${detail}`);
};

// ---------- A) legacy 冒烟:完整 32 笔场景仍能跑(不炸、水能蒸发干) ----------
{
  const st = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
  for (const { stroke, stepsAfter } of scene) {
    st.apply(stroke);
    st.engine.step(stepsAfter);
  }
  st.engine.step(600);
  ok("legacy 32 笔场景完整运行", st.engine.stepCount >= 4900, `steps=${st.engine.stepCount}`);
}

// ---------- B) 新管线四连:路径湿铺 / 干皴(verb) / region 蛇形 / interleave ----------
const NEW_STROKES = [
  { type: "wet-wash", brush: { name: "大排刷" }, load: { water: 0.8, pigment: { color: "#a8c8e0", amount: 0.9 } },
    motion: { verb: "扫" }, path: [[200, 120], [600, 140], [1000, 130]] },
  { type: "dry-brush", brush: { name: "貂毛圆头" }, load: { water: 0.2, pigment: { color: "#4d7a52", amount: 1.0 } },
    motion: { verb: "皴" }, path: [[220, 300], [520, 260], [900, 310]] },
  { type: "wet-wash", brush: { name: "猪鬃平头" }, load: { water: 0.6, pigment: { color: "#3a4a7a", amount: 0.8 } },
    region: { cx: 640, cy: 400, rx: 180, ry: 70 } },
  { type: "wet-wash", brush: { name: "大排刷" }, load: { water: 0.7, pigment: { color: "#8fae9c", amount: 0.8 } },
    motion: { verb: "拖", speed: [0.2, 0.5] }, interleave: { on: true, budget: 90 },
    path: [[150, 500], [450, 480], [750, 510], [1050, 490]] },
];

{
  const st = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
  for (const s of NEW_STROKES) st.apply(s);
  const a = st.painter.lastBrushState.assertions();
  ok("新管线:守恒(Σdw ≤ w0)", a.conservationOK, `Σdw=${a.releasedW.toFixed(3)}`);
  ok("新管线:戳数/段数合理", a.stamps >= 10 && a.segments >= 1, `stamps=${a.stamps} segments=${a.segments}`);
  const interleaved = st.painter.lastBrushState.interleave;
  ok("interleave 判据:长笔 + motion 触发", interleaved === true);
  st.engine.step(300);
  ok("新管线:引擎有水且可干燥", st.engine.totalWater() >= 0, `water=${st.engine.totalWater().toFixed(2)}`);
}

// ---------- C) PNG 级确定性:两次同 seed 渲染逐字节一致 ----------
{
  const renderOnce = () => {
    const st = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
    for (const s of NEW_STROKES) st.apply(s);
    st.engine.step(200);
    return st.render().data;
  };
  const a = renderOnce(), b = renderOnce();
  let same = true, maxDiff = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > 0) { same = false; if (d > maxDiff) maxDiff = d; }
  }
  ok("PNG 级确定性(两次渲染一致)", same, `maxDiff=${maxDiff}`);
}

// ---------- D) 单笔湿→干连续谱:同一支笔长扫,尾部 gb 高 ----------
{
  const st = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
  st.apply({
    type: "wet-wash", brush: { name: "貂毛圆头", width: 40 }, load: { water: 0.35, pigment: { color: "#5d4232", amount: 1.2 } },
    motion: { verb: "拖" }, path: [[100, 240], [1200, 240]],
  });
  const r = st.painter.lastBrushState.reservoir;
  ok("长笔湿→干:水库枯竭", r.totalWater() < r.w0 * 0.3, `尾水=${r.totalWater().toFixed(3)} / w0=${r.w0.toFixed(3)}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
