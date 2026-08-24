// 平面渲染器（Oracle 1 / 可画性基准共用）：
// 无介质的平涂合成——笔触参数（几何 + 颜色 + 不透明度）→ 软覆盖 mask → alpha-over 合成。
// 目的：把「笔触表示本身能否重建目标」与「介质动力学」彻底解耦。介质是另一张牌，这里只问表示。
// 与 src/brush/strokes.js 的 mask 同源，但剥离 fbm/纸纹/抖动：纯参数化几何（几何是自由度，抖动不是）。
export class FlatCanvas {
  constructor(w, h, { paper = [0.99, 0.975, 0.94] } = {}) {
    this.w = w; this.h = h;
    this.n = w * h;
    this.rgb = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      this.rgb[o] = paper[0]; this.rgb[o + 1] = paper[1]; this.rgb[o + 2] = paper[2];
    }
    this._mask = new Float32Array(this.n);
  }

  clearMask() { this._mask.fill(0); }

  /** 重置画布为纸色（几何精修反复重渲染用） */
  reset(paper = [0.99, 0.975, 0.94]) {
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      this.rgb[o] = paper[0]; this.rgb[o + 1] = paper[1]; this.rgb[o + 2] = paper[2];
    }
  }

  /** 软边矩形（cover 原语）→ 覆盖 mask */
  rect(x0, y0, x1, y1, soft = 3) {
    const { w, h, _mask: m } = this;
    this.clearMask();
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    for (let y = Math.max(0, Math.floor(ya - soft)); y <= Math.min(h - 1, Math.ceil(yb + soft)); y++) {
      const row = y * w;
      for (let x = Math.max(0, Math.floor(xa - soft)); x <= Math.min(w - 1, Math.ceil(xb + soft)); x++) {
        const dx = Math.max(xa - x, 0, x - xb);
        const dy = Math.max(ya - y, 0, y - yb);
        const d = Math.max(dx, dy);
        const v = d <= 0 ? 1 : d >= soft ? 0 : 1 - d / soft;
        if (v > 0) m[row + x] = v;
      }
    }
    return m;
  }

  /** 软边椭圆（wet-wash/glaze 区域原语 → 纯椭圆，无 fbm） */
  ellipse(cx, cy, rx, ry, soft = 4) {
    const { w, h, _mask: m } = this;
    this.clearMask();
    rx = Math.max(rx, 0.5); ry = Math.max(ry, 0.5);
    const x0 = Math.max(0, Math.floor(cx - rx - soft - 2));
    const x1 = Math.min(w - 1, Math.ceil(cx + rx + soft + 2));
    const y0 = Math.max(0, Math.floor(cy - ry - soft - 2));
    const y1 = Math.min(h - 1, Math.ceil(cy + ry + soft + 2));
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = (0.5 - (d - 1) / (2 * soft / Math.min(rx, ry) + 1e-6));
        if (v <= 0) continue;
        m[row + x] = v > 1 ? 1 : v;
      }
    }
    return m;
  }

  /** 软边多边形（poly 原语：直边屋顶/山墙等主体形状） */
  poly(points, soft = 2) {
    const { w, h, _mask: m } = this;
    this.clearMask();
    const n = points.length;
    if (n < 3) return m;
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const bx0 = Math.max(0, Math.floor(Math.min(...xs) - soft));
    const bx1 = Math.min(w - 1, Math.ceil(Math.max(...xs) + soft));
    const by0 = Math.max(0, Math.floor(Math.min(...ys) - soft));
    const by1 = Math.min(h - 1, Math.ceil(Math.max(...ys) + soft));
    const distSeg = (px, py, ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    };
    for (let y = by0; y <= by1; y++) {
      const row = y * w;
      for (let x = bx0; x <= bx1; x++) {
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          if ((ys[i] > y) !== (ys[j] > y) && x < ((xs[j] - xs[i]) * (y - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
        }
        let v = inside ? 1 : 0;
        if (!inside && soft > 0) {
          let d = Infinity;
          for (let i = 0, j = n - 1; i < n; j = i++) d = Math.min(d, distSeg(x, y, xs[i], ys[i], xs[j], ys[j]));
          v = 1 - d / soft;
        }
        if (v > 0) m[row + x] = v > 1 ? 1 : v;
      }
    }
    return m;
  }

  /** 条带笔触（ribbon：起收笔宽窄 + 软边；路径经 Chaikin 平滑去尖角） */
  ribbon(path, { radius = 20, radiusEnd = null, soft = 3 } = {}) {
    const { w, h, _mask: m } = this;
    this.clearMask();
    if (!path || path.length === 0) return m;
    if (path.length === 1) return this.ellipse(path[0][0], path[0][1], radius, radius, soft);
    const rEnd = radiusEnd ?? radius;
    let pts = path;
    for (let iter = 0; iter < 2; iter++) {
      if (pts.length <= 2) break;
      const sm = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        sm.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
        sm.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      sm.push(pts[pts.length - 1]);
      pts = sm;
    }
    const segs = [];
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const len = Math.hypot(bx - ax, by - ay);
      if (len <= 0) continue;
      segs.push({ ax, ay, bx, by, len });
      total += len;
    }
    const R = Math.max(radius, rEnd) + soft + 4;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of pts) {
      if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
      if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
    }
    bx0 = Math.max(0, Math.floor(bx0 - R)); bx1 = Math.min(w - 1, Math.ceil(bx1 + R));
    by0 = Math.max(0, Math.floor(by0 - R)); by1 = Math.min(h - 1, Math.ceil(by1 + R));
    const invT = 1 / (total + 1e-9);
    for (let y = by0; y <= by1; y++) {
      const row = y * w;
      for (let x = bx0; x <= bx1; x++) {
        let bestD = Infinity, bestT = 0, acc = 0;
        for (const sg of segs) {
          const dx = x - sg.ax, dy = y - sg.ay;
          const ex = sg.bx - sg.ax, ey = sg.by - sg.ay;
          const e2 = ex * ex + ey * ey;
          let t = (dx * ex + dy * ey) / e2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(x - (sg.ax + ex * t), y - (sg.ay + ey * t));
          if (d < bestD) { bestD = d; bestT = (acc + t * sg.len) * invT; }
          acc += sg.len;
        }
        // 首尾收锋（压力包络）+ 线性宽窄
        const rise = Math.min(1, bestT / 0.25);
        const fall = Math.min(1, (1 - bestT) / 0.25);
        const env = 0.35 + 0.65 * Math.min(rise, fall);
        const wid = (radius + (rEnd - radius) * bestT) * env;
        const v = 0.5 - (bestD - wid) / (2 * soft + 1e-6);
        if (v > 0) m[row + x] = v > 1 ? 1 : v;
      }
    }
    return m;
  }

  /** 颗粒溅点（spatter）：一组软圆滴；drops 由调用方显式给出（确定性，无隐藏 RNG） */
  spatter(drops, { softRatio = 0.4 } = {}) {
    this.clearMask();
    const { w, h, _mask: m } = this;
    for (const d of drops) {
      const r = Math.max(0.5, d.r);
      const x0 = Math.max(0, Math.floor(d.x - r - 2)), x1 = Math.min(w - 1, Math.ceil(d.x + r + 2));
      const y0 = Math.max(0, Math.floor(d.y - r - 2)), y1 = Math.min(h - 1, Math.ceil(d.y + r + 2));
      const soft = r * softRatio + 0.5;
      for (let y = y0; y <= y1; y++) {
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          const dd = Math.hypot(x - d.x, y - d.y);
          const v = 0.5 - (dd - r) / (2 * soft + 1e-6);
          if (v <= 0) continue;
          const i = row + x;
          if (v > m[i]) m[i] = v > 1 ? 1 : v;
        }
      }
    }
    return m;
  }

  /** 按类型填 this._mask（覆盖 0..1），返回 mask 引用——paint 与颜色精修共用 */
  fillMask(stroke) {
    const t = stroke.type;
    if (t === "rect") this.rect(stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.soft ?? 3);
    else if (t === "ellipse") this.ellipse(stroke.cx, stroke.cy, stroke.rx, stroke.ry, stroke.soft ?? 4);
    else if (t === "poly") this.poly(stroke.points, stroke.soft ?? 2);
    else if (t === "ribbon") this.ribbon(stroke.path, { radius: stroke.radius ?? 20, radiusEnd: stroke.radiusEnd ?? null, soft: stroke.soft ?? 3 });
    else if (t === "spatter") this.spatter(stroke.drops ?? [], {});
    else throw new Error(`FlatCanvas: unknown stroke type ${t}`);
    return this._mask;
  }

  /** 一笔：按类型填 mask → 颜色 + 不透明度 alpha-over 合成 */
  paint(stroke) {
    this.fillMask(stroke);
    const [cr, cg, cb] = stroke.color;
    const alpha = stroke.alpha ?? 0.8;
    const { rgb: buf, _mask: m, n } = this;
    for (let i = 0; i < n; i++) {
      const mask = m[i];
      if (mask <= 0) continue;
      const a = Math.min(1, mask * alpha);
      const ia = 1 - a;
      const o = i * 3;
      buf[o] = buf[o] * ia + cr * a;
      buf[o + 1] = buf[o + 1] * ia + cg * a;
      buf[o + 2] = buf[o + 2] * ia + cb * a;
    }
  }

  /** 输出 RGBA8（可选 upscale，正整数倍，最近邻上采样用于对照图拼接） */
  toRGBA(upscale = 1) {
    const { w, h, rgb: buf } = this;
    const W = w * upscale, H = h * upscale;
    const out = new Uint8Array(W * H * 4);
    for (let y2 = 0; y2 < H; y2++) {
      const srcY = (y2 / upscale) | 0;
      for (let x2 = 0; x2 < W; x2++) {
        const i = (srcY * w + ((x2 / upscale) | 0)) * 3;
        const o = (y2 * W + x2) * 4;
        out[o] = (buf[i] * 255) | 0;
        out[o + 1] = (buf[i + 1] * 255) | 0;
        out[o + 2] = (buf[i + 2] * 255) | 0;
        out[o + 3] = 255;
      }
    }
    return { data: out, w: W, h: H };
  }
}