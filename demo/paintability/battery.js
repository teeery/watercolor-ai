// 可画性十基元电池 v0.1 —— **随机贪心求解下界**（不是可达域裁决！）
//
// 重要方法学警示（本版本的核心产出就是一个负面结果）：
// 1. fitFlat 是「残差重要性采样 + 随机提案」的贪心，不是 oracle——它连「自己就能一笔 ribbon 画出的直线」
//    都搜不到（vision 复核：1_line 中栏 5 条线几乎全漏/错位）。所以下面所有数字测的是**求解器有多弱**，
//    不是**引擎/表示可不可达**。
// 2. 本电池的目标是用**同一套 FlatCanvas 原语**画出来的（比如直线 = 一笔 ribbon），故「表示可达性」是平凡真；
//    真正要问的可达域（介质引擎能不能画出这些形状）必须换**介质引擎渲染器** + **真 oracle（参数扫描/进化）**。
// 3. 对照 `docs/paintability.md` 分锅规则：随机贪心逼近不了 → 先修 oracle，不是给引擎甩锅。
//
// 结论口径：此处 PSNR = 「随机贪心求解下界」；9(湿画湿边界)、10(干燥细节保真) 依赖介质引擎，defer。
// 产物：out/paintability/{summary.json, 每基元 {target|fit|err}.png 蒙太奇}
import { fitFlat, refineColors, msePsnr } from "../../src/paintability/oracle1.js";
import { FlatCanvas } from "../../src/paintability/flat.js";
import { writePNG } from "../../src/io/png.js";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 480, H = 640, N = W * H;
const OUT = "out/paintability";
mkdirSync(OUT, { recursive: true });
const PAPER = [0.99, 0.975, 0.94];

// ---- 目标生成器（painter 在一块 FlatCanvas 上画出「理想」形状；渐变/条纹/提色直接写像素）----
const C = {
  ink: [0.12, 0.14, 0.16], dark: [0.16, 0.20, 0.17], mid: [0.40, 0.44, 0.36],
  red: [0.55, 0.22, 0.20], blue: [0.20, 0.30, 0.50], ochre: [0.60, 0.48, 0.22],
};

const PRIMITIVES = [
  {
    id: "1_line", title: "直线（多方向/多宽度）",
    note: "基本笔画保真 + 方向不变性；任一方向被抹糊 → 嫌疑 1/5",
    paint(c) {
      const lines = [[0, 0.35, 0.85, 0.35, 6], [30, 0.15, 0.15, 0.6, 0.6, 3], [60, 0.7, 0.1, 0.35, 0.6, 4], [90, 0.5, 0.15, 0.5, 0.8, 5], [45, 0.2, 0.7, 0.75, 0.9, 2]];
      for (const [ang, x0, y0, x1, y1, w] of lines) {
        const dx = (x1 - x0) * W, dy = (y1 - y0) * H;
        const len = Math.hypot(dx, dy);
        c.paint({ type: "ribbon", color: C.ink, alpha: 0.9, soft: 1.2, radius: w / 2, radiusEnd: w / 2, path: [[x0 * W, y0 * H], [x0 * W + dx, y0 * H + dy]] });
      }
    },
  },
  {
    id: "2_curve", title: "曲线 / 尖叶 / 收锋",
    note: "连续曲率 + 尖端点；尖端被抹圆 → 嫌疑 1",
    paint(c) {
      c.paint({ type: "ribbon", color: C.dark, alpha: 0.9, soft: 1.5, radius: 9, radiusEnd: 0.8, path: [[60, 520], [150, 380], [260, 420], [360, 300]] });
      c.paint({ type: "poly", color: C.mid, alpha: 0.9, soft: 1.2, points: [[300, 150], [420, 90], [455, 210], [400, 230], [320, 205]] });
    },
  },
  {
    id: "3_topology", title: "三角形 / T 型 / 封闭轮廓",
    note: "角点、接头、闭合；顶点断开或轮廓不闭合 → 嫌疑 1/2",
    paint(c) {
      c.paint({ type: "poly", color: C.mid, alpha: 0.9, soft: 1, points: [[80, 460], [180, 300], [240, 460]] });
      c.paint({ type: "rect", color: C.ink, alpha: 0.9, x0: 300, y0: 280, x1: 380, y1: 480, soft: 1 });
      c.paint({ type: "rect", color: C.ink, alpha: 0.9, x0: 260, y0: 280, x1: 420, y1: 330, soft: 1 });
      // 闭合方形轮廓（四边）
      const o = [[90, 90, 200, 99], [90, 90, 99, 200], [191, 90, 200, 200], [90, 191, 200, 200]];
      for (const [a, b, d, e] of o) c.paint({ type: "rect", color: C.blue, alpha: 0.9, x0: a, y0: b, x1: d, y1: e, soft: 1 });
    },
  },
  {
    id: "4_edge", title: "边缘谱（硬边 ↔ 软边）",
    note: "单一控制轴 soft 上的可调性；软边成片/硬边糊化 → 嫌疑 2",
    paint(c) {
      c.paint({ type: "rect", color: C.dark, alpha: 0.9, x0: 120, y0: 120, x1: 360, y1: 210, soft: 0 });
      c.paint({ type: "rect", color: C.dark, alpha: 0.9, x0: 120, y0: 250, x1: 360, y1: 340, soft: 7 });
      c.paint({ type: "rect", color: C.dark, alpha: 0.9, x0: 120, y0: 380, x1: 360, y1: 470, soft: 16 });
    },
  },
  {
    id: "5_gradient", title: "平滑渐变",
    note: "强度连续域可控性；出现可见条带 → 嫌疑 2/4（★手动栅格化目标）",
    paint(c) {
      const from = C.ink, to = PAPER;
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        for (let y = 180; y < 440; y++) {
          const o = (y * W + x) * 3;
          c.rgb[o] = from[0] + (to[0] - from[0]) * u;
          c.rgb[o + 1] = from[1] + (to[1] - from[1]) * u;
          c.rgb[o + 2] = from[2] + (to[2] - from[2]) * u;
        }
      }
    },
  },
  {
    id: "6_glaze", title: "透明罩染（叠层）",
    note: "glaze 叠层与交叠混色可达域；交叠色错误 → 颜色/层次",
    paint(c) {
      c.paint({ type: "ellipse", color: C.red, alpha: 0.55, cx: 180, cy: 300, rx: 110, ry: 140, soft: 3 });
      c.paint({ type: "ellipse", color: C.blue, alpha: 0.55, cx: 300, cy: 330, rx: 110, ry: 140, soft: 3 });
    },
  },
  {
    id: "7_freq", title: "空间频率条纹",
    note: "频率响应 → 可达频率上限（与网格对比）；细条纹被抹糊 → 嫌疑 4（★手动栅格化目标）",
    paint(c) {
      const bands = [1, 2, 4, 8, 16];
      let x0 = 20;
      for (const bw of bands) {
        for (let x = x0; x < x0 + 80; x++) {
          const dark = Math.floor((x - x0) / (bw * 2)) % 2 === 0;
          if (dark) for (let y = 120; y < 520; y++) { const o = (y * W + x) * 3; c.rgb[o] = C.ink[0]; c.rgb[o + 1] = C.ink[1]; c.rgb[o + 2] = C.ink[2]; }
        }
        x0 += 92;
      }
    },
  },
  {
    id: "8_lift", title: "负形 / 留白 / 提色",
    note: "减法能力（平面代理 = 画纸色覆盖压暗底）；真 lift 需介质（见 fail）",
    paint(c) {
      c.paint({ type: "rect", color: C.dark, alpha: 0.92, x0: 90, y0: 150, x1: 390, y1: 520, soft: 4 });
      c.paint({ type: "ellipse", color: PAPER, alpha: 0.9, cx: 240, cy: 320, rx: 90, ry: 110, soft: 2 });
    },
  },
];

// 表示层可达性（由构造判定 + oracle-line 实测背书）：
// 用 c.paint 画出来的目标 → 表示可达是平凡真；直接写像素的目标（渐变/条纹）→ 才需要真 oracle 判。
const REPRESENTATION = {
  "1_line": "可达(由构造: ribbon)",
  "2_curve": "可达(由构造: ribbon/poly)",
  "3_topology": "可达(由构造: poly/rect)",
  "4_edge": "可达(由构造: rect soft∈[0,16])",
  "5_gradient": "可达(单软边 rect=线性渐变, 实测 ~∞)",
  "6_glaze": "可达(由构造: ellipse alpha叠层)",
  "7_freq": "可达但=奈奎斯特壁(1px条纹)",
  "8_lift": "平涂代理可达; 真提色需介质引擎",
};

// ---- 度量：全局 MSE + 形状区域（footprint）MSE ----
function footprintMetric(target, fit) {
  let n = 0, s = 0;
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    const dr = Math.abs(target[o] - PAPER[0]), dg = Math.abs(target[o + 1] - PAPER[1]), db = Math.abs(target[o + 2] - PAPER[2]);
    if (Math.max(dr, dg, db) < 0.04) continue;
    n++;
    const e0 = target[o] - fit[o], e1 = target[o + 1] - fit[o + 1], e2 = target[o + 2] - fit[o + 2];
    s += e0 * e0 + e1 * e1 + e2 * e2;
  }
  const mse = n > 0 ? s / (n * 3) : 0;
  return { mse, psnr: mse > 0 ? 10 * Math.log10(1 / mse) : Infinity, n };
}

function heat(e) {
  const t = Math.min(1, e * 3);
  let r, g, b;
  if (t < 0.25) { const u = t / 0.25; r = 0; g = u; b = 1; }
  else if (t < 0.5) { const u = (t - 0.25) / 0.25; r = 0; g = 1; b = 1 - u; }
  else if (t < 0.75) { const u = (t - 0.5) / 0.25; r = u; g = 1; b = 0; }
  else { const u = (t - 0.75) / 0.25; r = 1; g = 1 - u; b = 0; }
  return [r * 255, g * 255, b * 255];
}

function writeMontage(id, target, fit) {
  const mw = W * 3, mh = H;
  const out = new Uint8Array(mw * mh * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const e = Math.sqrt(((target[o] - fit[o]) ** 2 + (target[o + 1] - fit[o + 1]) ** 2 + (target[o + 2] - fit[o + 2]) ** 2) / 3) / 0.4;
      const pe = heat(e);
      const di = (y * mw + x) * 4;
      out[di] = (target[o] * 255) | 0; out[di + 1] = (target[o + 1] * 255) | 0; out[di + 2] = (target[o + 2] * 255) | 0; out[di + 3] = 255;
      const d1 = di + W * 4;
      out[d1] = (fit[o] * 255) | 0; out[d1 + 1] = (fit[o + 1] * 255) | 0; out[d1 + 2] = (fit[o + 2] * 255) | 0; out[d1 + 3] = 255;
      const d2 = di + 2 * W * 4;
      out[d2] = pe[0]; out[d2 + 1] = pe[1]; out[d2 + 2] = pe[2]; out[d2 + 3] = 255;
    }
  }
  writePNG(`${OUT}/${id}.png`, out, mw, mh);
}

// ---- 主流程 ----
const summary = [];
for (const p of PRIMITIVES) {
  const c = new FlatCanvas(W, H);
  p.paint(c);
  const target = Float32Array.from(c.rgb);
  const t0 = performance.now();
  const { strokes, canvas } = fitFlat(target, { w: W, h: H, maxStrokes: 96, candidates: 48, seed: 7 });
  refineColors(target, canvas, strokes, { passes: 3 });
  const fit = canvas.rgb;
  const g = msePsnr(target, fit);
  const fp = footprintMetric(target, fit);
  const dt = ((performance.now() - t0) / 1000).toFixed(1);
  summary.push({ id: p.id, title: p.title, globalPSNR: +g.psnr.toFixed(2), footprintPSNR: +fp.psnr.toFixed(2), footprintPx: fp.n, representation: REPRESENTATION[p.id], greedyLowerBound: +fp.psnr.toFixed(2) });
  writeMontage(p.id, target, fit);
  console.log(`[${p.id}] ${p.title}: 贪心下界 ${fp.psnr.toFixed(2)}dB | 表示层 ${REPRESENTATION[p.id]}  (${dt}s)`);
}

console.log("\n=== 十基元电池 v0.1 成绩卡（表示层可达 vs 随机贪心下界）===");
console.log("id\ttitle\t贪心下界\t表示层可达性");
for (const r of summary) console.log(`${r.id}\t${r.title}\t${r.greedyLowerBound}\t${r.representation}`);
console.log(`\n9_湿画湿边界 / 10_干燥细节保真：依赖介质引擎，v0.1 defer`);
console.log(`⚠ 判读：贪心下界低 ≠ 不可达（见 demo/paintability/oracle-line.js：同一线，贪心 6.6dB、全局网格 oracle 172dB）。表示层可达性才是 v0.1 的裁决。`);
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`\nwrote out/paintability/summary.json + 8 张 {target|fit|err}.png`);