// probe/reservoir-probe.js — v1 水库状态机数值探针（独立运行，不依赖 src/）
// 验证四件事：
//   ① dt = Δs/v 在 v→0（犹豫/停笔）处发散，无钳制时水库击穿（负值/超发）
//   ② 钳制 + 守恒后，三种速度剖面的 wLoad(s)/飞白 grainBreak(s)/wDep(s) 曲线形态
//   ③ 释放总量守恒：Σ dw ≤ 初始装水
//   ④ 分桶沉积的真实调用数：量化 water×amount 后 distinct 组合数
// 用法：node probe/reservoir-probe.js
// 注：数值全部为笔刷层标量预算（640×480 网格、半分辨率模拟口径）

const L = 300;          // 路径长 px
const WIDTH = 20;       // 基准笔宽
const SPACING = 0.5;    // 弧长步系数
const ds = SPACING * WIDTH;          // 每戳弧长 10px
const nStamps = Math.round(L / ds);  // 30 戳
const VSCALE = 60;      // speed=1 → 60 px/s（绝对值锚）

// v1 §三默认包络（旧 ribbon 的 rise/fall/belly 常量）
function pressure(s) {
  const rise = Math.min(1, s / 0.22);
  const fall = Math.min(1, (1 - s) / 0.30);
  const mid = Math.min(rise, fall);
  const belly = 1 - 0.18 * Math.sin(Math.PI * Math.min(1, s * 1.1));
  return (0.30 + 0.70 * mid) * belly;
}

const profiles = {
  "匀速慢(0.15)": () => 0.15,
  "匀速快(0.9)":  () => 0.9,
  "中段犹豫":     (s) => 0.9 - 0.85 * Math.exp(-((s - 0.5) ** 2) / 0.004), // s=0.5 处 v≈0.05
};

function simulate(vfn, { clampDt = true, dtMax = 0.8, conserve = true } = {}) {
  const cap = 1.0, w0 = 0.8, p0 = 1.0;
  const kRelease = 0.9, kBreak = 1.4, alpha = 0.5, kPigmentUse = 0.012;
  let wLoad = w0, pLoad = p0, released = 0;
  let dtMaxSeen = 0;
  const rows = [];
  for (let i = 0; i <= nStamps; i++) {
    const s = i / nStamps;
    const p = pressure(s);
    const v = Math.max(vfn(s), 0.02);
    const dtRaw = ds / (v * VSCALE);
    if (dtRaw > dtMaxSeen) dtMaxSeen = dtRaw;
    const dt = clampDt ? Math.min(dtRaw, dtMax) : dtRaw;
    let dw = kRelease * p * dt * (wLoad / cap);
    if (conserve && dw > wLoad) dw = wLoad;
    wLoad -= dw;
    released += dw;
    const amount = pLoad * p ** alpha;
    pLoad = Math.max(0, pLoad - kPigmentUse * p * dt);
    const gb = Math.max(0, Math.min(1, kBreak * (1 - wLoad / cap) * (0.4 + 0.6 * v)));
    rows.push({ s: +s.toFixed(2), p: +p.toFixed(2), v: +v.toFixed(2), dtRaw: +dtRaw.toFixed(3), dt: +dt.toFixed(3), dw: +dw.toFixed(3), wLoad: +wLoad.toFixed(3), amount: +amount.toFixed(3), gb: +gb.toFixed(2) });
  }
  return { rows, released, wLoadEnd: wLoad, dtMaxSeen };
}

function fmtRow(r) {
  return `s=${String(r.s).padStart(4)} p=${String(r.p).padStart(4)} v=${String(r.v).padStart(4)} dt=${String(r.dt).padStart(6)} dw=${String(r.dw).padStart(6)} wLoad=${String(r.wLoad).padStart(6)} amt=${String(r.amount).padStart(5)} gb=${String(r.gb).padStart(4)}`;
}

console.log("=== ① dt 发散检查：无钳制 × 中段犹豫 ===");
{
  const r = simulate(profiles["中段犹豫"], { clampDt: false, conserve: false });
  console.log(`dtRaw max = ${r.dtMaxSeen.toFixed(2)}s（每戳 10px 行程，停笔 0.05 速度 → 3.33s）`);
  console.log(`末戳 wLoad = ${r.wLoadEnd.toFixed(3)}（负值 = 击穿），Σdw = ${r.released.toFixed(3)} > 初始 0.8 = 超发`);
}

console.log("\n=== ② 钳制 + 守恒后的三剖面（每 3 戳取样）===");
for (const [name, fn] of Object.entries(profiles)) {
  const r = simulate(fn);
  const conserveOK = r.released <= 0.8 + 1e-9 && r.wLoadEnd >= -1e-9;
  console.log(`\n-- ${name}：dtMax=${r.dtMaxSeen.toFixed(2)}s | 尾 wLoad=${r.wLoadEnd.toFixed(3)} | 尾飞白 gb=${r.rows[r.rows.length - 1].gb.toFixed(2)} | 守恒=${conserveOK ? "OK" : "FAIL"}`);
  console.log("  " + r.rows.filter((_, i) => i % 3 === 0).map(fmtRow).join("\n  "));
}

console.log("\n=== ④ 分桶沉积调用数（dw 8 档 × amount 8 档）===");
for (const [name, fn] of Object.entries(profiles)) {
  const r = simulate(fn);
  const dws = r.rows.map((x) => x.dw);
  const amts = r.rows.map((x) => x.amount);
  const dwMax = Math.max(...dws) || 1, amtMax = Math.max(...amts) || 1;
  const q = (v, mx) => Math.min(7, Math.floor((v / mx) * 8));
  const combos = new Set();
  for (let i = 0; i < r.rows.length; i++) combos.add(q(dws[i], dwMax) * 8 + q(amts[i], amtMax));
  console.log(`${name}: ${combos.size} 次 depositMask（30 戳）`);
}
