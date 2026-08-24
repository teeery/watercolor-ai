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

const ALPHA = { rect: 0.62, ellipse: 0.65, poly: 0.85, ribbon: 0.8, spatter: 0.9 };

// 阶段化类型权重：早段重 wash（rect/ellipse），晚段重 detail（ribbon/poly/spatter）
const COARSE = [["rect", 0.34], ["ellipse", 0.34], ["poly", 0.10], ["ribbon", 0.22], ["spatter", 0.0]];
const FINE = [["rect", 0.03], ["ellipse", 0.03], ["poly", 0.07], ["ribbon", 0.57], ["spatter", 0.30]];

function blendType(t, spatterWeight) {
  // 早段 wash 重、晚段 detail 重；spatterWeight 缩放晚段颗粒占比（受控消融：0=禁用，1=满额）
  const mix = { rect: 0, ellipse: 0, poly: 0, ribbon: 0, spatter: 0 };
  for (const [ty, c] of COARSE) mix[ty] += c * (1 - t);
  for (const [ty, f] of FINE) mix[ty] += (ty === "spatter" ? f * spatterWeight : f) * t;
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
function propose(type, w, h, rnd, sampler, t, opts) {
  let ci;
  if (rnd() < 0.82) ci = sampler.sample(rnd); else ci = (rnd() * (w * h)) | 0;
  const cx = (ci % w), cy = (ci / w) | 0;
  const s = { type, color: [0, 0, 0], alpha: ALPHA[type] };
  const U = (lo, hi) => lo + rnd() * (hi - lo);
  const sf = opts.sharpFine ? lerp(1, 0.42, t) : 1; // 细段更硬边（消「失焦」软边成片）
  if (type === "rect") {
    const rw = U(lerp(180, 5, t), lerp(470, 46, t));
    const rh = U(lerp(140, 5, t), lerp(360, 42, t));
    const x0 = cx - rw * (0.3 + rnd() * 0.7), y0 = cy - rh * (0.3 + rnd() * 0.7);
    s.x0 = x0; s.y0 = y0; s.x1 = x0 + rw; s.y1 = y0 + rh; s.soft = (5 + rnd() * 12) * sf;
  } else if (type === "ellipse") {
    s.cx = cx; s.cy = cy;
    s.rx = Math.max(2, U(lerp(110, 5, t), lerp(210, 30, t)));
    s.ry = Math.max(2, U(lerp(130, 5, t), lerp(270, 36, t)));
    s.soft = (4 + rnd() * 8) * sf;
  } else if (type === "poly") {
    const k = 3 + ((rnd() * 3) | 0);
    const pts = [];
    const rad = U(lerp(50, 6, t), lerp(95, 22, t));
    for (let i = 0; i < k; i++) {
      const ang = (i / k) * Math.PI * 2 + rnd() * 0.6;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    s.points = pts; s.soft = (2 + rnd() * 4) * sf;
  } else if (type === "ribbon") {
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
    s.radiusEnd = s.radius * (0.4 + rnd() * 0.8); s.soft = (1.5 + rnd() * 4) * sf;
  } else { // spatter：颗粒纹理（麦穗/石墙/草丛的高频斑点，deterministic drops）
    const count = 8 + ((rnd() * 34) | 0);
    const spread = U(lerp(26, 6, t), lerp(70, 40, t));
    const drops = [];
    for (let d = 0; d < count; d++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * spread;
      drops.push({ x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, r: 0.6 + rnd() * 2.0 });
    }
    s.drops = drops;
  }
  return s;
}

/**
 * 粗到细贪心平面拟合。返回 { strokes, history, canvas, w, h }
 */
export function fitFlat(target, {
  w = 480, h = 640, seed = 7, maxStrokes = 160, candidates = 96, logEvery = 1,
  spatterWeight = 1, sharpFine = true,
} = {}) {
  const canvas = new FlatCanvas(w, h);
  const rnd = mulberry32(seed);
  const strokes = [];
  const history = [];
  const opts = { spatterWeight, sharpFine };

  for (let step = 0; step < maxStrokes; step++) {
    const t = step / maxStrokes;
    const mixer = blendType(t, spatterWeight);
    const sampler = buildSampler(target, canvas);
    let best = null;
    for (let c = 0; c < candidates; c++) {
      const ty = pickType(mixer, rnd);
      const s = propose(ty, w, h, rnd, sampler, t, opts);
      if (ty === "rect") canvas.rect(s.x0, s.y0, s.x1, s.y1, s.soft);
      else if (ty === "ellipse") canvas.ellipse(s.cx, s.cy, s.rx, s.ry, s.soft);
      else if (ty === "poly") canvas.poly(s.points, s.soft);
      else if (ty === "spatter") canvas.spatter(s.drops, {});
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

/** 深拷贝一笔（保留 color/alpha 与几何字段） */
function cloneStroke(s) {
  return JSON.parse(JSON.stringify(s));
}

/** 就地扰动一笔的几何（小步随机抖动；poly/ribbon 逐点抖，width/radius 百分比抖） */
function perturbGeometry(s, rnd) {
  const j = () => (rnd() - 0.5) * 2;
  const jp = (v, scale) => v + j() * scale;
  if (s.type === "rect") {
    const cxp = (s.x0 + s.x1) / 2, cyp = (s.y0 + s.y1) / 2;
    const hs = 6, w = (s.x1 - s.x0) / 2, hgt = (s.y1 - s.y0) / 2;
    const ncxp = jp(cxp, hs), ncyp = jp(cyp, hs);
    const nw = Math.max(3, w * (1 + j() * 0.15)), nh = Math.max(3, hgt * (1 + j() * 0.15));
    s.x0 = ncxp - nw; s.x1 = ncxp + nw; s.y0 = ncyp - nh; s.y1 = ncyp + nh;
  } else if (s.type === "ellipse") {
    s.cx = jp(s.cx, 6); s.cy = jp(s.cy, 6);
    s.rx = Math.max(2, s.rx * (1 + j() * 0.15)); s.ry = Math.max(2, s.ry * (1 + j() * 0.15));
  } else if (s.type === "poly") {
    for (const p of s.points) { p[0] = jp(p[0], 6); p[1] = jp(p[1], 6); }
  } else if (s.type === "ribbon") {
    for (const p of s.path) { p[0] = jp(p[0], 6); p[1] = jp(p[1], 6); }
    s.radius = Math.max(1, s.radius * (1 + j() * 0.2));
    s.radiusEnd = Math.max(1, s.radiusEnd * (1 + j() * 0.2));
  } else if (s.type === "spatter") {
    for (const d of s.drops) { d.x = jp(d.x, 4); d.y = jp(d.y, 4); }
  }
}

/**
 * 几何精修：对细段（refineFrom 之后）每笔做 kPerturb 次随机扰动、整图重渲染评估、保优。
 * 非凸 → 只在贪心几何的邻域内做局部下降；配合 refineColors（凸颜色最优）逼近「几何局部最优 + 颜色全局最优」。
 * 代价：每笔 (1+kPerturb) 次全渲染，O(rounds·(N-refineFrom)·kPerturb·N·n)——细段多、预算多时较慢，按需收口。
 */
export function refineGeometry(target, canvas, strokes, { refineFrom = 0.5, kPerturb = 6, rounds = 1, seed = 99 } = {}) {
  const N = strokes.length, start = Math.floor(N * refineFrom);
  const rnd = mulberry32(seed);
  const render = (kOverride = -1, cand = null) => {
    canvas.reset();
    for (let i = 0; i < N; i++) canvas.paint(i === kOverride ? cand : strokes[i]);
  };
  for (let r = 0; r < rounds; r++) {
    for (let k = start; k < N; k++) {
      render();
      let bestLoss = msePsnr(target, canvas.rgb).mse;
      let bestStroke = null;
      for (let j = 0; j < kPerturb; j++) {
        const cand = cloneStroke(strokes[k]);
        perturbGeometry(cand, rnd);
        render(k, cand);
        const L = msePsnr(target, canvas.rgb).mse;
        if (L < bestLoss) { bestLoss = L; bestStroke = cand; }
      }
      if (bestStroke) strokes[k] = bestStroke;
    }
    render();
  }
  return msePsnr(target, canvas.rgb);
}

/**
 * 颜色精修：固定几何与 alpha，坐标下降求全局最优颜色。
 * 依据：平面 alpha-over 合成对每笔颜色是线性的 → 目标是最小二乘 → 凸 → 坐标下降收敛到全局最优。
 * 每笔颜色 c_k 在终稿中的系数 g = alpha·mask·S（S = 其后所有笔的透射率乘积），
 * 逆序扫描维持 S，避开了前缀积下溢（S∈[0,1]，下溢到 0 只是「该笔对像素不可见」，无害）。
 * 意义：greedy 只做了「插入时逐笔最优色」，这里是固定几何下的联合最优——两者之差即 greedy 在颜色维度留下的余量。
 */
export function refineColors(target, canvas, strokes, { passes = 3 } = {}) {
  const n = canvas.n;
  const N = strokes.length;
  if (N === 0) return { mse: msePsnr(target, canvas.rgb).mse };
  const S = new Float32Array(n);
  const g = new Float32Array(n);
  for (let pass = 0; pass < passes; pass++) {
    S.fill(1);
    for (let k = N - 1; k >= 0; k--) {
      const s = strokes[k];
      const m = canvas.fillMask(s);
      const a = s.alpha;
      let den = 0, numR = 0, numG = 0, numB = 0;
      for (let p = 0; p < n; p++) {
        const gp = a * m[p] * S[p];
        g[p] = gp;
        if (gp <= 0) continue;
        const o = p * 3;
        den += gp * gp;
        numR += (target[o] - canvas.rgb[o]) * gp;
        numG += (target[o + 1] - canvas.rgb[o + 1]) * gp;
        numB += (target[o + 2] - canvas.rgb[o + 2]) * gp;
      }
      if (den > 1e-12) {
        const dR = numR / den, dG = numG / den, dB = numB / den;
        const c = s.color;
        c[0] = Math.min(1, Math.max(0, c[0] + dR));
        c[1] = Math.min(1, Math.max(0, c[1] + dG));
        c[2] = Math.min(1, Math.max(0, c[2] + dB));
        for (let p = 0; p < n; p++) {
          const gp = g[p];
          if (gp <= 0) continue;
          const o = p * 3;
          canvas.rgb[o] += dR * gp;
          canvas.rgb[o + 1] += dG * gp;
          canvas.rgb[o + 2] += dB * gp;
        }
      }
      for (let p = 0; p < n; p++) S[p] *= (1 - a * m[p]);
    }
  }
  const { mse, psnr } = msePsnr(target, canvas.rgb);
  return { mse, psnr };
}