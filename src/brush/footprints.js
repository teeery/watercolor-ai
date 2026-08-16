// 足迹函数(brush dynamics v2 §3 腹池)——pool mask 绘制
// 形状:泪滴(round)/ 斜刃矩形(flat)/ 宽腹椭圆(wash)/ 发丝(rigger)
// mask 与引擎网格同坐标(左上原点,y 向下);绘制为 max 合并、软边由 soft 控制。
import { mulberry32 } from "../paper/prng.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** 在 mask 上 max-合并一个"软边椭圆(可旋转、可不对称)"
 *  平顶式:内部 d ≤ 1−softN 恒为 1(戳间重叠自然融成平带,无周期峰值=杀印章链),仅边缘软降 */
export function paintEllipse(mask, w, h, cx, cy, rA, rB, dirX, dirY, soft, { asymHead = 1, asymTail = 1, bias = 0 } = {}) {
  const R = Math.max(rA, rB) + soft + 2;
  const x0 = Math.max(0, Math.floor(cx - R));
  const x1 = Math.min(w - 1, Math.ceil(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R));
  const y1 = Math.min(h - 1, Math.ceil(cy + R));
  const softN = soft / (Math.min(rA, rB) + 1e-6);
  const inv = 1 / (2 * softN);
  for (let y = y0; y <= y1; y++) {
    const row = y * w;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      const a = dx * dirX + dy * dirY;        // 沿笔向
      const bb = -dx * dirY + dy * dirX;      // 垂直笔向
      const asym = a < 0 ? asymHead : asymTail;
      const d = Math.sqrt((a * asym / rA) ** 2 + (bb / rB) ** 2);
      const m = (1 + softN - d) * inv + bias;  // 平顶:内部 1.0、d≥1+softN 为 0
      if (m <= 0) continue;
      const i = row + x;
      const v = m > 1 ? 1 : m;
      if (v > mask[i]) mask[i] = v;
    }
  }
}

/** 泪滴(round):头圆尾尖、沿笔向拉长 */
export function footprintRound(mask, w, h, cx, cy, dirX, dirY, width, soft, rng) {
  const elong = 1.4 + (rng ? rng() : 0) * 0.6;
  paintEllipse(mask, w, h, cx, cy, width * elong, width, dirX, dirY, soft, { asymHead: 1.5, asymTail: 0.92 });
}

/** 斜刃矩形(flat):chisel 头,宽度近似不变,圆角软边 */
export function footprintFlat(mask, w, h, cx, cy, dirX, dirY, width, soft, rng) {
  // 矩形近似:沿笔向短、垂直笔向宽(平头笔腹),头尾用双椭圆收角
  paintEllipse(mask, w, h, cx, cy, width * 0.55, width, dirX, dirY, soft, { asymHead: 1.15, asymTail: 1.15 });
}

/** 宽腹椭圆(wash):大宽幅、弧形腹 */
export function footprintWash(mask, w, h, cx, cy, dirX, dirY, width, soft, rng) {
  paintEllipse(mask, w, h, cx, cy, width * 0.7, width, dirX, dirY, soft, { asymHead: 0.9, asymTail: 0.9 });
}

/** 发丝(rigger):细长线 */
export function footprintRigger(mask, w, h, cx, cy, dirX, dirY, width, soft, rng) {
  paintEllipse(mask, w, h, cx, cy, width * 2.2, width, dirX, dirY, Math.max(1, soft * 0.4), { asymHead: 1.2, asymTail: 1.2 });
}

/** 按 shape 分发 */
export function paintFootprint(shape, mask, w, h, cx, cy, dirX, dirY, width, soft, rng) {
  switch (shape) {
    case "flat": return footprintFlat(mask, w, h, cx, cy, dirX, dirY, width, soft, rng);
    case "wash": return footprintWash(mask, w, h, cx, cy, dirX, dirY, width, soft, rng);
    case "rigger": return footprintRigger(mask, w, h, cx, cy, dirX, dirY, width, soft, rng);
    default: return footprintRound(mask, w, h, cx, cy, dirX, dirY, width, soft, rng);
  }
}
