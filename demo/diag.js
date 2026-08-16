// 诊断 v3：每阶段结束的场状态（debugHook）
import { WatercolorEngine } from "../src/core/engine.js";
import { StrokePainter } from "../src/brush/strokes.js";
import { RgbColorSystem } from "../src/color/system.js";

const cs = new RgbColorSystem();
const eng = new WatercolorEngine({ w: 320, h: 240, seed: 1, channels: cs.channels });
const painter = new StrokePainter(eng, { seed: 2, colorSystem: cs });
painter.blob(160, 120, 80, 60, { jag: 0.3, soft: 5 });
eng.depositMask(painter.mask, { water: 0.8, amount: 0.6 });
eng.setPigment({ K: cs.pigmentBasis({ color: "#6679b3" }), granulation: 0.5, staining: 0.5 });

let step = 0;
eng.debugHook = (name) => {
  let w = 0, wmin = 1e9, wmax = -1e9, p = 0, uxmax = 0;
  for (let i = 0; i < eng.n; i++) {
    const wi = eng.W[i];
    w += wi;
    if (wi < wmin) wmin = wi;
    if (wi > wmax) wmax = wi;
    for (let c = 0; c < eng.ch; c++) p += eng.P[c][i];
    const u = Math.abs(eng.ux[i]);
    if (u > uxmax) uxmax = u;
  }
  console.log(`step${step} ${name.padEnd(10)} W=${w.toFixed(0).padStart(9)} [${wmin.toFixed(2)},${wmax.toFixed(2)}] P=${p.toFixed(0).padStart(9)} |ux|=${uxmax.toFixed(2)}`);
};
eng.debugHook("0-init");
eng.step(1);
step = 1;
