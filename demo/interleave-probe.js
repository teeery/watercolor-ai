// demo/interleave-probe.js — 一笔之内"沉积-模拟交错"的预算与效果量化
// 问题：真实作画时,长笔画的前段在笔还在画后段时就已经在蒸发。
//       现引擎是"整笔沉积完 → 统一 step",一笔之内没有时间流动。
//       交错方案:每 N 戳沉积一块 → engine.step(k) → 继续。
//       本探针量化:① 一笔的真实作画时长 ② 压缩到多少模拟步(预算)
//       ③ 前段在笔画完成时的干燥程度(效果) ④ 全场景成本。
// 用法：node demo/interleave-probe.js

const VSCALE = 60;       // speed=1 → 60 px/s
const EVAP = 0.010;      // 引擎蒸发率/步(engine.js p.evap)
const STEP_MS = 11.5;    // 实测 ≈55s / 4800 步(含渲染帧摊薄,engine-js.md §性能)
const SCENE_STEPS = 4975; // 现 32 笔场景总步数(render-demo 实测)

// 三种典型笔画
const strokes = [
  { name: "短皴笔",   len: 60,  v: 0.9 },
  { name: "中段扫笔", len: 180, v: 0.4 },
  { name: "长湿铺",   len: 420, v: 0.15 },
];

console.log("=== ① 一笔的真实作画时长 ===");
for (const st of strokes) {
  const dur = st.len / (st.v * VSCALE);
  console.log(`${st.name}: ${st.len}px @ ${st.v} → ${dur.toFixed(1)}s 真实时间 = ${Math.round(dur * 60)} 模拟步(1:1)`);
}

console.log("\n=== ② 压缩预算:每笔 ≤ B 步(整数下采样,保持因果相对量) ===");
const B = 90; // 每笔模拟步上限(预算参数)
for (const st of strokes) {
  const dur = st.len / (st.v * VSCALE);
  const steps = Math.min(B, Math.max(1, Math.round(dur * 60)));
  const headDry = 1 - Math.pow(1 - EVAP, steps); // 前段在笔画完成时的失水比例
  console.log(`${st.name}: 交错 ${steps} 步 | 笔画完成时前段已蒸发 ${(headDry * 100).toFixed(0)}% 水`);
}

console.log("\n=== ③ 全场景成本(假设 60% 笔画长度 > 150px 才启用交错) ===");
{
  const interleaved = strokes.filter((s) => s.len > 150);
  const extraSteps = interleaved.reduce((a, s) => a + Math.min(B, Math.round(s.len / (s.v * VSCALE) * 60)), 0);
  const extraSec = (extraSteps * STEP_MS) / 1000;
  console.log(`新增 ${extraSteps} 步 ≈ +${extraSec.toFixed(0)}s(基线 ${(SCENE_STEPS * STEP_MS / 1000).toFixed(0)}s,+${((extraSteps / SCENE_STEPS) * 100).toFixed(0)}%)`);
}

console.log("\n=== ④ 干燥在'一笔之内'可见的判据 ===");
{
  // 前后段含水量差:前段失水 headDry vs 后段刚沉积 0 失水
  const st = strokes[2];
  const steps = Math.min(B, Math.round(st.len / (st.v * VSCALE) * 60));
  const headDry = 1 - Math.pow(1 - EVAP, steps);
  console.log(`长湿铺:前段失水 ${(headDry * 100).toFixed(0)}% vs 后段 0% → 同一笔内水痕梯度 ${(headDry * 100).toFixed(0)} 个百分点`);
  console.log("注:蒸发是边缘加速的(evapEdge 2.5),实际边带干燥更快;此处为保守下限");
}
