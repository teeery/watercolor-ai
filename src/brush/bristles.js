// N 毛模型(brush dynamics v2 §3)——锚点 + 阻尼尖端 + β 滞后 + splay 迟滞
// 每支笔实例生成一次:N 根毛、横向偏移 b_i ∈ [-1,1]、尖端位置 tips[i]
// 每戳推进:
//   anchor_i = pos + perp · (b_i · width)          // 腹锚随路径平移
//   tip_i   += (anchor_i − tip_i) · kStiff        // 阻尼追随
//   tip_i   += velocity · β · lagCoef             // 尖端滞后:转急弯毛甩外侧(DiVerdi 只留速度)
//   splay   += (target(p) − splay) · (1 − e^{−dt/τ})
// 毛缘绘制:每戳把毛尖段(沿 anchor→tip 方向,长 2-3px)raster 进 mask2(max 合并),
// 线宽 = clamp(3·16/N, 1.5, 3)(毛厚反比根数保覆盖);dynamics 层负责边缘带门控与浓度。

export class Bristles {
  /**
   * @param {object} brush { bristle:N, beta, spring }
   * @param {number} seed 每笔 RNG 流种子(确定性:painterSeed ^ strokeIndex 由上层给)
   */
  constructor(brush, seed = 1) {
    this.N = Math.max(2, Math.round(brush.bristle ?? 12));
    this.beta = brush.beta ?? 0.25;
    this.spring = brush.spring ?? 0.7;
    this.kStiff = 0.35;
    this.tau = 0.4;          // splay 迟滞时间常数 s
    this.kCurl = 26;         // 转向离心系数:毛甩到转角外侧的幅度
    // 横向偏移均匀分布(确定性;毛的"出身")
    this.b = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) this.b[i] = (i + 0.5) / this.N * 2 - 1;
    this.tips = new Float32Array(this.N * 2);
    this.hist = new Float32Array(this.N * 2 * 6); // 近 6 戳毛尖历史(连续排线用,更长丝缕)
    this._histHead = 0;
    this.splay = 0;
    this.lineW = Math.min(3, Math.max(1.5, 3 * 16 / this.N)); // 毛厚反比根数保覆盖
    // 毛缘权重(密度函数,形状身份):平头两侧重(双轨边)、圆头中间重、排刷/勾线均匀
    const shape = brush.shape ?? "round";
    this.edgeW = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      const b = this.b[i], ab = Math.abs(b);
      switch (shape) {
        case "flat": this.edgeW[i] = 0.45 + 1.1 * ab * ab; break;
        case "round": this.edgeW[i] = 1 - 0.5 * ab; break;
        case "wash": this.edgeW[i] = 1 - 0.8 * ab * ab; break;
        default: this.edgeW[i] = 1; break;
      }
    }
    // 首次使用前 tips 未初始化 → init 标记
    this._init = false;
    this._curl = 0; // 曲率动量(转角甩毛的平滑扫弧)
  }

  /** 重置状态(同一笔内继续;新笔时用) */
  reset(cx, cy) {
    this._init = true;
    for (let i = 0; i < this.N; i++) {
      this.tips[i * 2] = cx;
      this.tips[i * 2 + 1] = cy;
      for (let k = 0; k < 6; k++) {
        this.hist[(k * this.N + i) * 2] = cx;
        this.hist[(k * this.N + i) * 2 + 1] = cy;
      }
    }
    this._histHead = 0;
    this.splay = 0;
    this._curl = 0;
  }

  /**
   * 推进一戳。
   * 滞后模型修正(v2 实现笔记):
   *  - 直行拖尾由 kStiff<1 的阻尼追随给出(尖端天然落后于锚点);
   *  - 转角"毛甩外侧"是离心效应:displacement = perp · (−cross(prev,new)) · kCurl·v,
   *    与 Wetbrush/DiVerdi 的"非惯性系抹加速度只留速度"一致(只吃速度、吃曲率,不吃沿速度项)。
   * @param {number} cx,cy 笔腹中心
   * @param {number} dirX,dirY 笔向单位向量
   * @param {number} p pressure 0..1
   * @param {number} v speed 0..1
   * @param {number} dt 接触时间 s(水库同款 dt)
   * @param {number} baseWidth 基准宽度(网格 px)
   * @param {number} prevDirX,prevDirY 上一戳笔向(离心计算用;缺省 = 当前)
   * @returns {number} 当前足迹半宽(压力×splay 迟滞后)
   */
  advance(cx, cy, dirX, dirY, p, v, dt, baseWidth, prevDirX = dirX, prevDirY = dirY) {
    if (!this._init) this.reset(cx, cy);
    // splay 迟滞:target = 压力(压满 → 毛张开)
    const splayTarget = p;
    const kSplay = 1 - Math.exp(-dt / this.tau);
    this.splay += (splayTarget - this.splay) * kSplay;
    const width = baseWidth * (1 + this.spring * this.splay);

    const perpX = -dirY, perpY = dirX;
    const cross = prevDirX * dirY - prevDirY * dirX;  // z 分量:转向方向与幅度(直行 = 0)
    // 曲率动量:cross 累积并逐戳衰减 → 外侧毛在转角前后 3-4 戳平滑甩出(扫弧,非单戳三角补丁)
    this._curl = this._curl * 0.55 + cross * 0.45;
    const fling = -this._curl * this.kCurl * this.beta * v;
    const fx = perpX * fling, fy = perpY * fling;
    for (let i = 0; i < this.N; i++) {
      const b = this.b[i] * width;
      const ax = cx + perpX * b, ay = cy + perpY * b;
      let tx = this.tips[i * 2] + (ax - this.tips[i * 2]) * this.kStiff + fx;
      let ty = this.tips[i * 2 + 1] + (ay - this.tips[i * 2 + 1]) * this.kStiff + fy;
      this.tips[i * 2] = tx;
      this.tips[i * 2 + 1] = ty;
    }
    // 推入历史(环形,4 槽)
    const slot = this._histHead;
    this._histHead = (this._histHead + 1) % 6;
    for (let i = 0; i < this.N; i++) {
      this.hist[(slot * this.N + i) * 2] = this.tips[i * 2];
      this.hist[(slot * this.N + i) * 2 + 1] = this.tips[i * 2 + 1];
    }
    return width;
  }

  /**
   * 把毛尖**连续折线** raster 进 mask2(max 合并):
   * 用近 6 戳毛尖历史画 5 段折线 → 连续排线(非离散点链);
   * 转角时折线甩向外侧 = 刮痕;平头笔两侧权重高 = 双轨边。
   * @param {Float32Array} mask2 毛缘 mask(w*h)
   * @param {number} w,h 画布
   * @param {number} gb 当前飞白强度(0..1):线宽随干度加粗(干笔丝缕更醒目)
   */
  paintMarks(mask2, w, h, gb = 0) {
    const hw = this.lineW * (1 + gb * 1.4) * 0.5;
    // 按时间序取历史点:最旧 → 最新
    for (let i = 0; i < this.N; i++) {
      const wt = this.edgeW[i];
      for (let seg = 0; seg < 5; seg++) {
        const k0 = (this._histHead + seg) % 6;
        const k1 = (this._histHead + seg + 1) % 6;
        const px = this.hist[(k0 * this.N + i) * 2], py = this.hist[(k0 * this.N + i) * 2 + 1];
        const tx = this.hist[(k1 * this.N + i) * 2], ty = this.hist[(k1 * this.N + i) * 2 + 1];
        const dx = tx - px, dy = ty - py;
        const len = Math.hypot(dx, dy);
        if (len < 0.01) continue;
        const ux = dx / len, uy = dy / len;
        const x0 = Math.max(0, Math.floor(Math.min(px, tx) - hw - 1));
        const x1 = Math.min(w - 1, Math.ceil(Math.max(px, tx) + hw + 1));
        const y0 = Math.max(0, Math.floor(Math.min(py, ty) - hw - 1));
        const y1 = Math.min(h - 1, Math.ceil(Math.max(py, ty) + hw + 1));
        for (let y = y0; y <= y1; y++) {
          const row = y * w;
          for (let x = x0; x <= x1; x++) {
            // 点到线段距离(参数投影)
            const vx = x - px, vy = y - py;
            let t = vx * ux + vy * uy;
            if (t < 0) t = 0; else if (t > len) t = len;
            const qx = px + ux * t - x, qy = py + uy * t - y;
            const d = Math.hypot(qx, qy);
            const m = (1 - d / hw) * wt;
            if (m <= 0) continue;
            const idx = row + x;
            if (m > mask2[idx]) mask2[idx] = m;
          }
        }
      }
    }
  }
}
