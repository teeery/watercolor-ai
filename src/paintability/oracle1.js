// Oracle 1：平面笔触拟合——现有参数化笔触词汇能否重建目标？（无介质，纯表示能力测试）
// 方法：粗到细贪心匹配追踪（coarse-to-fine greedy matching pursuit）。
//   进度 t=step/N 驱动「尺寸带」从大塌缩到小：早段只许大洗（rect/ellipse 铺底），
//   晚段只许小笔（ribbon/poly 补细节）——镜像引擎「五阶段作画制度」。
//   每步在残差最大处重要性采样落笔点，按「覆盖率加权残差能量」选笔，校正色合成。
// 产出：mse-vs-笔数曲线（单次运行内增量记录）+ 笔触 recipe（可复现重放）。
// 定位：贪心是「可达」的下界见证——贪心都能逼近，表示必然够；贪心高位平台，才需换 oracle/补词汇。
import { FlatCanvas } from "./flat.js";
import { decodePNG, resizeRGBAtoRGB } from "../io/png.js";
import { readFileSync } from "node:fs";
import { mulberry32 } from "../paper/prng.js";

/** 读参照图（本地 PNG）→ 降采样到 w×h 的线性 RGB Float32Array */
export function loadTarget(path, w, h) {
  const png = decodePNG(readFileSync(path));
  return resizeRGBAtoRGB(png.data, png.w, png.h, w, h);
}

/** 逐通道 MSE（0..1 像素域）+ PSNR */
export function msePsnr(a, b) {
  let s = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d * d; }
  const mse = s / n;
  return { mse, psnr: mse > 0 ? 10 * Math.log10(1 / mse) : Infinity };
}

const ALPHA = { rect: 0.62, ellipse: 0.65, poly: 0.85, ribbon: 0.8 };

// 阶段化类型权重：早段重 wash（rect/ellipse），晚段重 detail（ribbon/poly）
const COARSE = [["rect", 0.34], ["ellipse", 0.34], ["poly", 0.10], ["ribbon", 0.22]];
const FINE = [["rect", 0.04], ["ellipse", 0.04], ["poly", 0.10], ["ribbon", 0.82]];

function blendType(t) {
  const mix = { rect: 0, ellipse: 0, poly: 0, ribbon: 0 };
  for (const [ty, c] of COARSE) mix[ty] += c * (1 - t);
  for (const [ty, f] of FINE) mix[ty] += f * t;
  return mix;
}

function pickType(mix, rnd) {
  let r = rnd(), acc = 0;
  for (const [ty, wgt] of Object.entries(mix)) { acc += wgt; if (r < acc) return ty; }
  return "ribbon";
}

const lerp = (a, b, t) => a + (b - a) * t;

/** 依残差能量重要性采样一个种子像素（能量 = 像素级 |r|²） */
function buildSampler(target, canvas) {
  const n = canvas.n;
  const prefix = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const d0 = target[o] - canvas.rgb[o], d1 = target[o + 1] - canvas.rgb[o + 1], d2 = target[o + 2] - canvas.rgb[o + 2];
    const e = d0 * d0 + d1 * d1 + d2 * d2;
    total += e;
    prefix[i] = total;
  }
  return {
    total,
    sample(rnd) {
      if (total <= 1e-12) return (rnd() * n) | 0;
      let lo = 0, hi = n - 1, t = rnd() * total;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (prefix[mid] < t) lo = mid + 1; else hi = mid; }
      return lo;
    },
  };
}

/** 生成一个候选笔触：尺寸取进度 t 决定的「尺寸带」[lo,hi]，颜色由打分时校正 */
function propose(type, w, h, rnd, sampler, t) {
  let ci;
  if (rnd() < 0.82) ci = sampler.sample(rnd); else ci = (rnd() * (w * h)) | 0;
  const cx = (ci % w), cy = (ci / w) | 0;
  const s = { type, color: [0, 0, 0], alpha: ALPHA[type] };
  const U = (lo, hi) => lo + rnd() * (hi - lo);
  if (type === "rect") {
    const rw = U(lerp(180, 5, t), lerp(470, 46, t));
    const rh = U(lerp(140, 5, t), lerp(360, 42, t));
    const x0 = cx - rw * (0.3 + rnd() * 0.7), y0 = cy - rh * (0.3 + rnd() * 0.7);
    s.x0 = x0; s.y0 = y0; s.x1 = x0 + rw; s.y1 = y0 + rh; s.soft = 5 + rnd() * 12;
  } else if (type === "ellipse") {
    s.cx = cx; s.cy = cy;
    s.rx = Math.max(2, U(lerp(110, 5, t), lerp(210, 30, t)));
    s.ry = Math.max(2, U(lerp(130, 5, t), lerp(270, 36, t)));
    s.soft = 4 + rnd() * 8;
  } else if (type === "poly") {
    const k = 3 + ((rnd() * 3) | 0);
    const pts = [];
    const rad = U(lerp(50, 6, t), lerp(95, 22, t));
    for (let i = 0; i < k; i++) {
      const ang = (i / k) * Math.PI * 2 + rnd() * 0.6;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    s.points = pts; s.soft = 2 + rnd() * 4;
  } else { // ribbon
    const nPt = 2 + ((rnd() * 2) | 0);
    const ang = rnd() * Math.PI * 2;
    const len = U(lerp(110, 10, t), lerp(230, 90, t));
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const path = [];
    for (let i = 0; i < nPt; i++) {
      const tt = i / (nPt - 1 || 1);
      path.push([cx + dx * len * tt + (rnd() - 0.5) * 26, cy + dy * len * tt + (rnd() - 0.5) * 26]);
    }
    s.path = path; s.radius = Math.max(1, U(lerp(20, 1.5, t), lerp(32, 20, t)));
    s.radiusEnd = s.radius * (0.4 + rnd() * 0.8); s.soft = 1.5 + rnd() * 4;
  }
  return s;
}

/**
 * 粗到细贪心平面拟合。返回 { strokes, history, canvas, w, h }
 */
export function fitFlat(target, {
  w = 480, h = 640, seed = 7, maxStrokes = 160, candidates = 96, logEvery = 1,
} = {}) {
  const canvas = new FlatCanvas(w, h);
  const rnd = mulberry32(seed);
  const strokes = [];
  const history = [];

  for (let step = 0; step < maxStrokes; step++) {
    const t = step / maxStrokes;
    const mixer = blendType(t);
    const sampler = buildSampler(target, canvas);
    let best = null;
    for (let c = 0; c < candidates; c++) {
      const ty = pickType(mixer, rnd);
      const s = propose(ty, w, h, rnd, sampler, t);
      if (ty === "rect") canvas.rect(s.x0, s.y0, s.x1, s.y1, s.soft);
      else if (ty === "ellipse") canvas.ellipse(s.cx, s.cy, s.rx, s.ry, s.soft);
      else if (ty === "poly") canvas.poly(s.points, s.soft);
      else canvas.ribbon(s.path, { radius: s.radius, radiusEnd: s.radiusEnd, soft: s.soft });

      const m = canvas._mask;
      let s0 = 0, eSum = 0, tR = 0, tG = 0, tB = 0, cR = 0, cG = 0, cB = 0;
      for (let i = 0; i < canvas.n; i++) {
        const a = m[i];
        if (a <= 0) continue;
        const o = i * 3;
        const tr = target[o], tg = target[o + 1], tb = target[o + 2];
        const cr = canvas.rgb[o], cg = canvas.rgb[o + 1], cb = canvas.rgb[o + 2];
        const dr = tr - cr, dg = tg - cg, db = tb - cb;
        s0 += a;
        eSum += a * (dr * dr + dg * dg + db * db);
        tR += a * tr; tG += a * tg; tB += a * tb;
        cR += a * cr; cG += a * cg; cB += a * cb;
      }
      if (s0 < 1e-6) continue;
      // 按「总残差能量」（非均值）选笔：大块低/中频区域的总误差远大于小块高频细节，
      // 从而自然实现粗到细（先铺大色块，后补细节）；颜色已是最优，故误差单调不增。
      const score = eSum;
      if (score <= 0) continue;
      if (!best || score > best.score) best = { score, s, s0, tR, tG, tB, cR, cG, cB };
    }
    if (!best) break;
    const a = best.s.alpha;
    best.s.color = [
      Math.min(1, Math.max(0, best.cR / best.s0 + (best.tR - best.cR) / (best.s0 * a))),
      Math.min(1, Math.max(0, best.cG / best.s0 + (best.tG - best.cG) / (best.s0 * a))),
      Math.min(1, Math.max(0, best.cB / best.s0 + (best.tB - best.cB) / (best.s0 * a))),
    ];
    canvas.paint(best.s);
    strokes.push(best.s);
    if ((step + 1) % logEvery === 0) {
      const { mse, psnr } = msePsnr(target, canvas.rgb);
      history.push({ strokes: step + 1, mse, psnr });
    }
  }
  const { mse, psnr } = msePsnr(target, canvas.rgb);
  history.push({ strokes: strokes.length, mse, psnr });
  return { strokes, history, canvas, w, h };
}

/** 把 strokes 重放到一个新画布（复现 recipe），返回 FlatCanvas */
export function replay(strokes, w, h) {
  const canvas = new FlatCanvas(w, h);
  for (const s of strokes) canvas.paint(s);
  return canvas;
}