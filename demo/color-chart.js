// 24 色卡：RGB 系统 vs 光谱系统 vs 平涂参照，三栏并排
// 输出：color_chart_compare.png（3840×960）+ color_chart[_spectral].png（单系统版）
import { createStudio, makeColorSystem } from "../src/studio/studio.js";
import { StrokePainter, hexToRgb01 } from "../src/brush/strokes.js";
import { saundersonToInternal } from "../src/color/system.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync } from "node:fs";
import { PIGMENTS } from "../src/color/pigments.js";

const OUT = "out";
mkdirSync(OUT, { recursive: true });

const COLS = 6, ROWS = 4;
const CW = 640 / COLS, CH = 480 / ROWS;

const DIGITS = {
  0: [0b111, 0b101, 0b101, 0b101, 0b111], 1: [0b010, 0b110, 0b010, 0b010, 0b111],
  2: [0b111, 0b001, 0b111, 0b100, 0b111], 3: [0b111, 0b001, 0b111, 0b001, 0b111],
  4: [0b101, 0b101, 0b111, 0b001, 0b001], 5: [0b111, 0b100, 0b111, 0b001, 0b111],
  6: [0b111, 0b100, 0b111, 0b101, 0b111], 7: [0b111, 0b001, 0b010, 0b010, 0b010],
  8: [0b111, 0b101, 0b111, 0b101, 0b111], 9: [0b111, 0b101, 0b111, 0b001, 0b111],
};

function paintChart(colorSystem) {
  const studio = createStudio({ width: 640, height: 480, seed: 21, painterSeed: 31, colorSystem });
  const { engine, apply } = studio;
  const label = (n, cx, cy) => {
    const s = String(n);
    const totalW = s.length * 4 - 1;
    let ox = cx - (totalW * 2) / 2;
    for (const ch of s) {
      const d = DIGITS[+ch];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (d[r] & (0b100 >> c)) {
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
              const i = (cy + r * 2 + dy) * 640 + (ox + c * 2 + dx);
              engine.D[0][i] += 1.4; engine.D[1][i] += 1.3; engine.D[2][i] += 1.2;
            }
          }
        }
      }
      ox += 8;
    }
  };
  // 注意：标签直接写 D[0..2] 只在 RGB 3 通道系统有意义；光谱系统下跳过标签（列序即编号）
  for (let i = 0; i < PIGMENTS.length; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW + CW / 2;
    const cyTop = row * CH + CH * 0.28;
    const cyDil = row * CH + CH * 0.58;
    const halfW = CW * 0.30;
    // 锌白覆盖弱（咖啡环把中心流薄）→ 浓档加量保"奶膜体量"（vision：再叠一层浓度）
    const strongAmt = p.name === "锌白" ? 4.2 : 2.0;
    // M1 容纸度 + M5 沉积：低着色颜料水多时中心被流空（vision：#1/#24 浓偏浅）→ 减水
    const strongWater = (p.staining ?? 0.5) < 0.3 ? 0.35 : 0.55;
    const pig = { name: p.name, color: p.hex, granulation: p.granulation, staining: p.staining, amount: strongAmt };
    // 稀释档按"同等光学稀释度"取量：amt = x_target/(b·κs0)，x_target=0.35；
    // b 从 hex 线性反射率经 Saunderson 逆变换反推——深色 b 大 → 取量极少 → 真正稀释
    const lin = hexToRgb01(p.hex).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const rint = saundersonToInternal(lin.reduce((a, b) => a + b, 0) / 3);
    const K0 = (1 - rint) * (1 - rint) / (2 * rint);
    const bCoef = Math.sqrt((1 + K0) * (1 + K0) - 1);
    const diluteAmt = Math.min(0.55, Math.max(0.015, 0.35 / (bCoef * (p.strength ?? 1) * (p.scatter ?? 1))));
    apply({
      type: "wet-wash",
      path: [[cx - halfW, cyTop - 3], [cx, cyTop + 1], [cx + halfW, cyTop - 2]],
      radius: CH * 0.16, radiusEnd: CH * 0.12,
      pigment: pig, water: strongWater, layers: 1, hard: true,   // 浓档=masstone 参照：跳过 σ 钉扎/爬行/侵蚀 → 实心无洞（vision：#7 闪电白）
    }, 70);
    apply({
      type: "glaze",
      path: [[cx - halfW, cyDil - 2], [cx, cyDil + 2], [cx + halfW, cyDil - 1]],
      radius: CH * 0.14, radiusEnd: CH * 0.10,
      pigment: { ...pig, amount: diluteAmt }, water: 0.6,
    }, 110);
    if (colorSystem.channels === 3) label(i + 1, cx, row * CH + CH * 0.82);
  }
  engine.step(400);
  return studio.render({ edgeDarken: 0.24 }); // 浓档实心后加一圈半透明水线，找回透明水彩线索（vision 建议）
}

function paintFlatReference() {
  const flat = new Float32Array(640 * 480 * 3);
  for (let i = 0; i < 640 * 480; i++) { flat[i * 3] = 0.99; flat[i * 3 + 1] = 0.975; flat[i * 3 + 2] = 0.94; }
  const dummy = { n: 640 * 480, w: 640, h: 480, paper: null };
  const painter = new StrokePainter(dummy, { seed: 31 });
  const over = (mask, rgb, alpha) => {
    for (let i = 0; i < 640 * 480; i++) {
      const m = mask[i];
      if (m <= 0) continue;
      const a = Math.min(1, m * alpha);
      flat[i * 3] = flat[i * 3] * (1 - a) + rgb[0] * a;
      flat[i * 3 + 1] = flat[i * 3 + 1] * (1 - a) + rgb[1] * a;
      flat[i * 3 + 2] = flat[i * 3 + 2] * (1 - a) + rgb[2] * a;
    }
  };
  for (let i = 0; i < PIGMENTS.length; i++) {
    const p = PIGMENTS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW + CW / 2;
    const cyTop = row * CH + CH * 0.28;
    const cyDil = row * CH + CH * 0.58;
    const halfW = CW * 0.30;
    const rgb = hexToRgb01(p.hex);
    over(painter.ribbon([[cx - halfW, cyTop - 3], [cx, cyTop + 1], [cx + halfW, cyTop - 2]], { radius: CH * 0.16, radiusEnd: CH * 0.12, soft: 6, jag: 0.06 }), rgb, 0.85);
    over(painter.ribbon([[cx - halfW, cyDil - 2], [cx, cyDil + 2], [cx + halfW, cyDil - 1]], { radius: CH * 0.14, radiusEnd: CH * 0.10, soft: 6, jag: 0.06 }), rgb, 0.38);
  }
  const out = new Uint8Array(640 * 480 * 4);
  for (let i = 0; i < 640 * 480; i++) {
    out[i * 4] = (flat[i * 3] * 255) | 0;
    out[i * 4 + 1] = (flat[i * 3 + 1] * 255) | 0;
    out[i * 4 + 2] = (flat[i * 3 + 2] * 255) | 0;
    out[i * 4 + 3] = 255;
  }
  return { data: out, w: 640, h: 480 };
}

const rgbImg = paintChart(makeColorSystem("rgb"));
writePNG(`${OUT}/color_chart.png`, rgbImg.data, rgbImg.w, rgbImg.h);
const specImg = paintChart(makeColorSystem("spectral"));
writePNG(`${OUT}/color_chart_spectral.png`, specImg.data, specImg.w, specImg.h);
const flatImg = paintFlatReference();

// 三栏拼接：RGB 引擎 | 光谱引擎 | 平涂参照（各 1280×960）
const W = 1280, H = 960;
const canvas = new Uint8Array(W * 3 * H * 4).fill(255);
const put = (img, col) => {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const li = (y * W + x) * 4;
      const lo = (y * W * 3 + col * W + x) * 4;
      canvas[lo] = img.data[li]; canvas[lo + 1] = img.data[li + 1]; canvas[lo + 2] = img.data[li + 2]; canvas[lo + 3] = 255;
    }
  }
};
put(rgbImg, 0);
put(specImg, 1);
put({ data: flatImg.data, w: 1280, h: 960 }, 2);
// 平涂是 640×480 → 最近邻放大
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const si = ((y >> 1) * 640 + (x >> 1)) * 4;
    const lo = (y * W * 3 + 2 * W + x) * 4;
    canvas[lo] = flatImg.data[si]; canvas[lo + 1] = flatImg.data[si + 1]; canvas[lo + 2] = flatImg.data[si + 2]; canvas[lo + 3] = 255;
  }
}
writePNG(`${OUT}/color_chart_compare.png`, canvas, W * 3, H);
console.log("wrote color_chart_compare.png (RGB | spectral | flat) + color_chart.png + color_chart_spectral.png");
