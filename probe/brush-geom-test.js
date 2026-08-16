// probe/brush-geom-test.js — 毛层与足迹的几何冒烟测试
// 用法: node probe/brush-geom-test.js
import { Bristles } from "../src/brush/bristles.js";
import { paintFootprint } from "../src/brush/footprints.js";
import { mulberry32 } from "../src/paper/prng.js";

let failures = 0;
const ok = (name, cond, detail = "") => {
  if (!cond) { failures++; console.error(`FAIL ${name} ${detail}`); }
  else console.log(`ok   ${name} ${detail}`);
};

const W = 200, H = 160;

// ---------- 1) 足迹绘制:非零像素在 bbox 内、确定、软边 ----------
{
  for (const shape of ["round", "flat", "wash", "rigger"]) {
    const mask = new Float32Array(W * H);
    paintFootprint(shape, mask, W, H, 100, 80, 0.8, 0.6, 20, 3, mulberry32(5));
    let nz = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = mask[y * W + x];
      if (v > 0) { nz++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    ok(`${shape} 足迹非零像素`, nz > 200, `nz=${nz}`);
    ok(`${shape} 足迹在合理范围`, x0 >= 60 && x1 <= 140 && y0 >= 40 && y1 <= 120, `bbox=[${x0},${y0}]-[${x1},${y1}]`);
    // 确定性
    const m2 = new Float32Array(W * H);
    paintFootprint(shape, m2, W, H, 100, 80, 0.8, 0.6, 20, 3, mulberry32(5));
    let same = true;
    for (let i = 0; i < mask.length; i++) if (mask[i] !== m2[i]) { same = false; break; }
    ok(`${shape} 足迹确定性`, same);
  }
}

// ---------- 2) 毛层:转角离心(毛尖甩到转角外侧)+ 直行拖尾 ----------
{
  const brush = { bristle: 24, beta: 0.5, spring: 0.7 };
  const br = new Bristles(brush, 7);
  br.reset(100, 100);
  // 向右直行 20 戳让毛尖接近锚点,然后急转向上(右转上,外侧 = +x 方向)
  let width = 12;
  for (let i = 0; i < 20; i++) width = br.advance(100 + i * 2, 100, 1, 0, 0.7, 0.8, 0.1, 12);
  const anchor0x = 141 - width; // b[0]=-1 左缘毛的锚点 x(perp=(1,0) for dir=(0,-1))
  br.advance(141, 95, 0, -1, 0.7, 0.8, 0.1, 12, 1, 0); // 急转向上
  const tipX = br.tips[0], tipY = br.tips[1];
  const ax0 = 141 + 1 * -width; // 左缘锚点
  ok("转角离心:毛尖甩向 +x 外侧", tipX - ax0 > 1.5, `tip.x=${tipX.toFixed(1)} anchor.x=${ax0.toFixed(1)}`);
  ok("毛尖未收敛(滞后存在)", Math.hypot(tipX - ax0, tipY - 95) > 1, `dist=${Math.hypot(tipX - ax0, tipY - 95).toFixed(2)}`);
  ok("splay 随压力上升", br.splay > 0.3, `splay=${br.splay.toFixed(3)}`);
  // 直行拖尾:重置后向右直行一戳,毛尖应落后于锚点(未收敛)
  const br2 = new Bristles(brush, 7);
  br2.reset(100, 100);
  br2.advance(120, 100, 1, 0, 0.7, 0.8, 0.1, 12);
  const gap = (120 + 1 * 12) - br2.tips[0]; // 右缘锚点 vs 毛尖
  ok("直行拖尾(kStiff<1 未收敛)", gap > 2, `gap=${gap.toFixed(2)}px`);
}

// ---------- 3) 毛厚反比根数保覆盖 ----------
{
  const b4 = new Bristles({ bristle: 4, beta: 0.25, spring: 0.7 }, 1);
  const b32 = new Bristles({ bristle: 32, beta: 0.25, spring: 0.7 }, 1);
  ok("毛厚反比根数(N=4 粗)", b4.lineW === 3, `lineW=${b4.lineW}`);
  ok("毛厚反比根数(N=32 细)", b32.lineW === 1.5, `lineW=${b32.lineW}`);
}

// ---------- 4) 毛缘 mask 绘制:非零、确定、在合理范围 ----------
{
  const brush = { bristle: 16, beta: 0.3, spring: 0.5, shape: "flat" };
  const br = new Bristles(brush, 3);
  const mask2 = new Float32Array(W * H);
  br.reset(100, 80);
  br.advance(110, 80, 1, 0, 0.8, 0.6, 0.1, 10);
  br.paintMarks(mask2, W, H);
  let nz = 0;
  for (let i = 0; i < mask2.length; i++) if (mask2[i] > 0) nz++;
  ok("毛缘 mask 非零像素", nz > 20, `nz=${nz}`);
  const br2 = new Bristles(brush, 3);
  const mask3 = new Float32Array(W * H);
  br2.reset(100, 80);
  br2.advance(110, 80, 1, 0, 0.8, 0.6, 0.1, 10);
  br2.paintMarks(mask3, W, H);
  let same = true;
  for (let i = 0; i < mask2.length; i++) if (mask2[i] !== mask3[i]) { same = false; break; }
  ok("毛缘 mask 确定性", same);
  // 平头双轨:两侧权重高于中心(edgeW 形状)
  const wL = br.edgeW[0], wM = br.edgeW[8], wR = br.edgeW[15];
  ok("平头笔两侧毛缘权重大于中心(双轨边由构造保证)", wL > wM && wR > wM, `wL=${wL.toFixed(2)} wM=${wM.toFixed(2)} wR=${wR.toFixed(2)}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
