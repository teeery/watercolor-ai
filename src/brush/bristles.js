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
    this.kCurl = 8;          // 转向离心系数:毛甩到转角外侧的幅度
    // 横向偏移均匀分布(确定性;毛的"出身")
    this.b = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) this.b[i] = (i + 0.5) / this.N * 2 - 1;
    this.tips = new Float32Array(this.N * 2);
    this.splay = 0;
    this.lineW = Math.min(3, Math.max(1.5, 3 * 16 / this.N)); // 毛厚反比根数保覆盖
    // 首次使用前 tips 未初始化 → init 标记
    this._init = false;
  }

  /** 重置状态(同一笔内继续;新笔时用) */
  reset(cx, cy) {
    this._init = true;
    for (let i = 0; i < this.N; i++) {
      this.tips[i * 2] = cx;
      this.tips[i * 2 + 1] = cy;
    }
    this.splay = 0;
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
    const fling = -cross * this.kCurl * this.beta * v;
    const fx = perpX * fling, fy = perpY * fling;
    for (let i = 0; i < this.N; i++) {
      const b = this.b[i] * width;
      const ax = cx + perpX * b, ay = cy + perpY * b;
      let tx = this.tips[i * 2] + (ax - this.tips[i * 2]) * this.kStiff + fx;
      let ty = this.tips[i * 2 + 1] + (ay - this.tips[i * 2 + 1]) * this.kStiff + fy;
      this.tips[i * 2] = tx;
      this.tips[i * 2 + 1] = ty;
    }
    return width;
  }

  /**
   * 把当前毛尖段 raster 进 mask2(max 合并)。
   * 段方向 = anchor→tip(毛的瞬时朝向),长度 ≈ 2.5px。
   * @param {Float32Array} mask2 毛缘 mask(w*h)
   * @param {number} w,h 画布
   * @param {number} cx,cy 笔腹中心(用于 anchor 方向)
   * @param {number} dirX,dirY 笔向
   * @param {number} width 当前足迹半宽(advance 返回值)
   */
  paintMarks(mask2, w, h, cx, cy, dirX, dirY, width) {
    const perpX = -dirY, perpY = dirX;
    const hw = this.lineW * 0.5;
    for (let i = 0; i < this.N; i++) {
      const b = this.b[i] * width;
      const ax = cx + perpX * b, ay = cy + perpY * b;
      let tx = this.tips[i * 2], ty = this.tips[i * 2 + 1];
      // 段:tip → tip+方向延伸 2.5px(毛尖出锋)
      const dx = tx - ax, dy = ty - ay;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const ex = tx + ux * 2.5, ey = ty + uy * 2.5;
      const x0 = Math.max(0, Math.floor(Math.min(tx, ex) - hw - 1));
      const x1 = Math.min(w - 1, Math.ceil(Math.max(tx, ex) + hw + 1));
      const y0 = Math.max(0, Math.floor(Math.min(ty, ey) - hw - 1));
      const y1 = Math.min(h - 1, Math.ceil(Math.max(ty, ey) + hw + 1));
      for (let y = y0; y <= y1; y++) {
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          // 点到线段距离
          const px = x - tx, py = y - ty;
          const t = clamp01(px * ux + py * uy);
          const qx = tx + ux * t - x, qy = ty + uy * t - y;
          const d = Math.hypot(qx, qy);
          const m = 1 - d / hw;
          if (m <= 0) continue;
          const idx = row + x;
          const v = m > 1 ? 1 : m;
          if (v > mask2[idx]) mask2[idx] = v;
        }
      }
    }
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
