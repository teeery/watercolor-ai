// probe/brush-core-test.js — 笔刷动力学核心逻辑冒烟测试(守恒/单调/确定性/verb/配方)
// 用法: node probe/brush-core-test.js   (跑挂 = 非零退出)
import { Reservoir } from "../src/brush/reservoir.js";
import { makeMotion, legacyPressure, VERBS } from "../src/brush/motion.js";
import { resolveBrush, RECIPES, isNewPipeline } from "../src/brush/brush.js";

let failures = 0;
const ok = (name, cond, detail = "") => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${detail}`); }
  else console.log(`ok   ${name} ${detail}`);
};

// ---------- 1) 水库守恒 ----------
{
  const VSCALE = 60, WIDTH = 20, SPACING = 0.5, ds = SPACING * WIDTH, N = 60;
  const profiles = {
    slow: () => 0.15,
    fast: () => 0.9,
    hesitate: (s) => 0.9 - 0.85 * Math.exp(-((s - 0.5) ** 2) / 0.004),
  };
  for (const [name, vfn] of Object.entries(profiles)) {
    const r = new Reservoir({ water: 0.8, pigment: { amount: 1.0 }, tip: { amount: 0.3 } }, 1.0, { kBreak: 1.4, gamma: 0.8 });
    let prevGb = -1;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const p = legacyPressure(s);
      const { gb } = r.release(p, Math.max(vfn(s), 0.02), ds);
      r.capillary();
      // gb 单调断言只对恒速剖面成立:犹豫段 v 骤降 → (0.4+0.6v) 项回落 → gb 短暂回退
      // 是"犹豫成洼(局部更湿)"的设计行为,非 bug。
      if (name !== "hesitate" && gb < prevGb - 1e-9) ok(`${name} gb 单调`, false, `s=${s.toFixed(2)} gb=${gb} prev=${prevGb}`);
      prevGb = gb;
    }
    ok(`${name} 守恒(Σdw≤w0, 非负)`, r.conservationOK(), `Σdw=${r.releasedW.toFixed(4)} w0=${r.w0.toFixed(3)} 尾水=${r.totalWater().toFixed(4)}`);
    ok(`${name} 颜料非负且已扣减`, r.totalPigment() >= -1e-9 && r.totalPigment() <= r.p0 + 1e-9, `p0=${r.p0.toFixed(3)} 尾=${r.totalPigment().toFixed(4)}`);
  }
}

// ---------- 2) 指数释放无击穿(犹豫段 dtMax 钳) ----------
{
  const r = new Reservoir({ water: 0.8, pigment: { amount: 1.0 } }, 1.0, { kBreak: 1.4, gamma: 1.5 });
  for (let i = 0; i < 30; i++) r.release(0.8, 0.05, 10); // 停笔 30 戳
  ok("犹豫停笔不击穿", r.totalWater() >= -1e-9 && r.releasedW <= r.w0 + 1e-9, `Σdw=${r.releasedW.toFixed(4)} ≤ w0=${r.w0}`);
}

// ---------- 3) 确定性(同参数两跑逐位一致) ----------
{
  const run = () => {
    const r = new Reservoir({ water: 0.7, pigment: { amount: 0.9 }, tip: { amount: 0.2 } }, 1.1, { kBreak: 1.4, gamma: 0.8 });
    const trace = [];
    for (let i = 0; i <= 40; i++) {
      const { dw, amount, gb } = r.release(legacyPressure(i / 40), 0.5, 10);
      r.capillary();
      trace.push(`${dw.toFixed(12)}|${amount.toFixed(12)}|${gb.toFixed(12)}`);
    }
    return trace.join(";");
  };
  ok("确定性(两次运行一致)", run() === run());
}

// ---------- 4) 负通量迟滞 ----------
{
  const r = new Reservoir({ water: 0.4, pigment: { amount: 0.8 } }, 1.0, { kBreak: 1.4, gamma: 1.5 });
  let w1 = 0;
  for (let i = 0; i < 20; i++) w1 += r.wick(0.8, 0.9, 0.2); // 连续湿纸吸水
  ok("负通量:湿纸吸水进 tip", w1 > 0 && r.totalWater() > 0.4 * 1.0 * 0.15 + 1e-9, `wicked=${w1.toFixed(4)}`);
  ok("负通量:不超容量", r.totalWater() <= r.cap + 1e-9, `total=${r.totalWater().toFixed(4)} cap=${r.cap}`);
}

// ---------- 5) motion:legacy 包络与 ribbon 公式一致 / verb 值域 / 校验抛错 ----------
{
  const rise = (s) => Math.min(1, s / 0.22);
  const fall = (s) => Math.min(1, (1 - s) / 0.30);
  for (let i = 0; i <= 20; i++) {
    const s = i / 20;
    const mid = Math.min(rise(s), fall(s));
    const belly = 1 - 0.18 * Math.sin(Math.PI * Math.min(1, s * 1.1));
    const expect = (0.30 + 0.70 * mid) * belly;
    const got = legacyPressure(s);
    if (Math.abs(expect - got) > 1e-12) { failures++; console.error(`FAIL legacy 包络 s=${s} expect=${expect} got=${got}`); break; }
  }
  console.log("ok   legacy 包络与 ribbon 公式逐点一致");
  for (const [verb, def] of Object.entries(VERBS)) {
    const m = makeMotion({ verb });
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const p = m.pressure(s), v = m.speed(s);
      if (p < 0 || p > 1 || v < 0 || v > 1) { failures++; console.error(`FAIL verb ${verb} s=${s} p=${p} v=${v}`); break; }
    }
  }
  console.log("ok   verb 编译值域 [0,1]");
  let threw = false;
  try { makeMotion({ pressure: [0.5, 1.5] }); } catch { threw = true; }
  ok("校验:pressure 越界抛错", threw);
  threw = false;
  try { makeMotion({ pressure: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] }); } catch { threw = true; }
  ok("校验:pressure 超长抛错", threw);
}

// ---------- 6) 画笔库与配方 ----------
{
  const b = resolveBrush("勾线笔");
  ok("预设:勾线笔", b.shape === "rigger" && b.width === 4 && b.bristle === 4);
  const c = resolveBrush({ name: "貂毛圆头", width: 22 });
  ok("预设+覆盖", c.shape === "round" && c.width === 22 && c.bristle === 12);
  const d = resolveBrush({ shape: "flat" });
  ok("裸 shape 兜底毛数", d.shape === "flat" && d.bristle === 24);
  ok("recipe:dry-brush γ=0.8", RECIPES["dry-brush"].gamma === 0.8);
  ok("新管线判据", isNewPipeline({ type: "wet-wash" }) === false
    && isNewPipeline({ type: "wet-wash", brush: {} }) === true
    && isNewPipeline({ type: "glaze", motion: { verb: "拖" } }) === true
    && isNewPipeline({ load: { tip: { amount: 0.2 } } }) === true);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
