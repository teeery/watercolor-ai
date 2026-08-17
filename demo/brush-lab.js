// demo/brush-lab.js — 笔刷动力学 v2.0 验收面板(v2 §11)
// 9 格感知签名 + 内置数值断言(守恒/单调/确定性/配方调校),产物:
//   out/brush-lab.png             9 格面板(1920×1440)
//   out/brush-lab-assertions.json 数值断言结果
// 用法: node demo/brush-lab.js
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

const CW = 640, CH = 480;          // 单元格(引擎网格)
const COLS = 3, ROWS = 3;
const sheet = new Uint8Array(CW * CH * 4 * COLS * ROWS); // RGBA8(与 writePNG 字节步长一致)
let failures = 0;
const assertions = [];
const ok = (name, cond, detail = "") => {
  assertions.push({ name, pass: !!cond, detail });
  if (!cond) failures++;
};

function makeStudio() {
  // 笔刷层验收隔离:medium 会话的 σ 钉扎(M1)与宏观侵蚀(M2)按"水量门槛"拒收低水笔触,
  // 会把干笔/飞白整段钉掉——两者与笔刷层正交,面板内关闭以便单独验收笔刷;
  // 交互调优(干笔 × σ/侵蚀)记为跨会话 TODO,见 COORDINATION.md §3。
  return createStudio({
    width: CW, height: CH, seed: 3, painterSeed: 11,
    params: { sigma0: 0, macroCut: 0, frontDeposit: 0.05 },
  });
}

/** 把一个 studio 的渲染结果放进面板格 (col,row) */
function blit(studio, col, row, label) {
  const img = studio.render({ upscale: 1 }); // 640×480 网格直出(默认 2× 上采样,面板按网格拼)
  const { data } = img;
  for (let y = 0; y < CH; y++) {
    const sy = row * CH + y;
    for (let x = 0; x < CW; x++) {
      const si = (sy * (CW * COLS) + col * CW + x) * 4;
      const di = (y * CW + x) * 4;
      sheet[si] = data[di];
      sheet[si + 1] = data[di + 1];
      sheet[si + 2] = data[di + 2];
      sheet[si + 3] = data[di + 3];
    }
  }
  console.log(`[${label}] rendered`);
}

// ---------- ① 四支笔身份(同一路径 × 4 支笔) ----------
{
  const st = makeStudio();
  const path = [[180, 220], [700, 160], [1120, 240]];
  const brushes = ["勾线笔", "貂毛圆头", "猪鬃平头", "大排刷"];
  brushes.forEach((name, i) => {
    st.apply({
      type: "wet-wash", brush: { name },
      load: { water: 0.5, pigment: { color: "#4a6b8a", amount: 0.9 } },
      motion: { verb: "拖" },
      path: path.map(([x, y]) => [x, y + i * 120]),
    });
  });
  st.engine.step(120);
  blit(st, 0, 0, "① 四支笔身份");
}

// ---------- ② 单笔湿→干连续谱 ----------
{
  const st = makeStudio();
  st.apply({
    type: "wet-wash", brush: { name: "貂毛圆头", width: 36 },
    load: { water: 0.35, pigment: { color: "#5d4232", amount: 1.1 } },
    motion: { verb: "拖" },
    path: [[120, 400], [1240, 400]],
  });
  const bs = st.painter.lastBrushState;
  const r = bs.reservoir;
  ok("② 水库枯竭(尾水 < 30%)", r.totalWater() < r.w0 * 0.3, `尾水=${r.totalWater().toFixed(3)} w0=${r.w0.toFixed(3)}`);
  ok("② 守恒", r.conservationOK(), `Σdw=${r.releasedW.toFixed(3)} w0=${r.w0.toFixed(3)} wicked=${r.wickedW.toFixed(3)} 尾水=${r.totalWater().toFixed(4)}`);
  st.engine.step(200);
  blit(st, 1, 0, "② 单笔湿→干");
}

// ---------- ③ 快/慢因果 ----------
{
  const st = makeStudio();
  const base = {
    type: "wet-wash", brush: { name: "猪鬃平头" },
    load: { water: 0.5, pigment: { color: "#7a4a3a", amount: 0.9 } },
  };
  st.apply({ ...base, motion: { verb: "扫", speed: [0.15] }, path: [[150, 260], [1150, 260]] });
  st.apply({ ...base, motion: { verb: "扫", speed: [0.95] }, path: [[150, 460], [1150, 460]] });
  st.engine.step(160);
  blit(st, 2, 0, "③ 快/慢因果");
}

// ---------- ④ 犹豫成洼 ----------
{
  const st = makeStudio();
  st.apply({
    type: "wet-wash", brush: { name: "貂毛圆头", width: 30 },
    load: { water: 0.6, pigment: { color: "#3a5a7a", amount: 1.0 } },
    motion: { verb: "顿" },
    path: [[140, 400], [640, 400], [1140, 400]],
  });
  st.engine.step(220);
  blit(st, 0, 1, "④ 犹豫成洼");
}

// ---------- ⑤ 转角刮痕 ----------
{
  const st = makeStudio();
  st.apply({
    type: "dry-brush", brush: { name: "貂毛圆头", beta: 0.6 }, // 圆头:中轴毛痕为主,转角甩弧可读
    load: { water: 0.2, pigment: { color: "#2f4a3a", amount: 1.2 } },
    motion: { verb: "甩", speed: [0.9] },
    path: [[150, 600], [700, 580], [700, 240], [1150, 260]], // 90° 硬转角
  });
  st.engine.step(100);
  blit(st, 1, 1, "⑤ 转角刮痕");
}

// ---------- ⑥ 平头双轨边 ----------
{
  const st = makeStudio();
  st.apply({
    type: "wet-wash", brush: { name: "猪鬃平头", width: 46 },
    load: { water: 0.22, pigment: { color: "#6a4a2a", amount: 1.2 } },
    motion: { verb: "拖", pressure: [0.7, 0.7, 0.7] },
    path: [[160, 400], [1200, 400]],
  });
  st.engine.step(160);
  blit(st, 2, 1, "⑥ 平头双轨边");
}

// ---------- ⑦ 一笔多色渐变(charging) ----------
{
  const st = makeStudio();
  st.apply({
    type: "wet-wash", brush: { name: "大排刷", width: 50 },
    load: { water: 0.6, pigment: { color: "#3a4a8a", amount: 0.9 }, tip: { color: "#3a7a4a", amount: 0.9 } },
    motion: { verb: "扫" },
    path: [[140, 400], [1200, 400]],
  });
  const bs = st.painter.lastBrushState;
  const a = bs.assertions();
  ok("⑦ tip 色已消耗(charging 混色数据存在)", a.tipReleased > 0.05, `tipReleased=${a.tipReleased.toFixed(3)}`);
  st.engine.step(200);
  blit(st, 0, 2, "⑦ 一笔多色");
}

// ---------- ⑧ 湿接湿稀释(吸水因果) ----------
{
  const st = makeStudio();
  const wet = {
    type: "wet-wash", brush: { name: "大排刷" },
    load: { water: 0.8, pigment: { color: "#4a7a9a", amount: 0.9 } },
    motion: { verb: "扫" },
    path: [[140, 380], [1180, 380]],
  };
  st.apply(wet);
  st.engine.step(6); // 趁湿
  const waterBefore = st.engine.totalWater();
  st.apply({
    ...wet, load: { water: 0.35, pigment: { color: "#7a3a4a", amount: 0.9 } },
    path: [[140, 420], [1180, 420]], motion: { verb: "扫" },
  });
  const bs = st.painter.lastBrushState;
  ok("⑧ 湿纸吸水(负通量 > 0)", bs.reservoir.wickedW > 0, `wicked=${bs.reservoir.wickedW.toFixed(3)}`);
  ok("⑧ 引擎有过湿区", waterBefore > 0, `water=${waterBefore.toFixed(2)}`);
  st.engine.step(260);
  blit(st, 1, 2, "⑧ 湿接湿稀释");
}

// ---------- ⑨ 一笔之内干燥(interleave) ----------
{
  const st = makeStudio();
  st.apply({
    type: "wet-wash", brush: { name: "大排刷", width: 44 },
    load: { water: 0.35, pigment: { color: "#6a6a3a", amount: 0.9 } },
    motion: { verb: "拖", speed: [0.2] },
    interleave: { on: true, budget: 180 }, // 低装水 + 大预算:前段在笔画内真正干透(出沉积环/露纸),后段仍湿
    path: [[120, 360], [1240, 400]],
  });
  const bs = st.painter.lastBrushState;
  ok("⑨ interleave 触发", bs.interleave === true && bs.interleavedSteps >= 100, `steps=${bs.interleavedSteps}`);
  st.engine.step(10); // 立即渲染:湿度梯度不被后续统一干燥抹平
  blit(st, 2, 2, "⑨ 一笔之内干燥");
}

// ---------- 产物 ----------
// 空白自检:面板不能是纯背景色(像素级防回归,v2 校准教训;Uint8 口径)
{
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < sheet.length; i += 4) {
    const v = sheet[i] + sheet[i + 1] + sheet[i + 2];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  ok("面板非空白(存在笔触像素)", range > 60, `RGBsum范围=[${min},${max}]`);
}
writePNG(`${OUT}/brush-lab.png`, sheet, CW * COLS, CH * ROWS);
import { writeFileSync } from "node:fs";
writeFileSync(`${OUT}/brush-lab-assertions.json`, JSON.stringify({ pass: failures === 0, assertions }, null, 2));
console.log(`\n${failures === 0 ? "ALL ASSERTIONS PASS" : `${failures} FAILURES`}`);
console.log("outputs: out/brush-lab.png, out/brush-lab-assertions.json");
process.exit(failures === 0 ? 0 : 1);
