// 硬边矩形湿铺剖面探针：量边缘带（距边界 0-5 格）与内部的沉积对比
// 用法：node demo/bug-probe.js edge
import { createStudio } from "../src/studio/studio.js";

const [, , mode] = process.argv;
if (mode === "edge") {
  const studio = createStudio({ width: 320, height: 240, seed: 5, painterSeed: 17 });
  const { engine } = studio;
  // 硬边矩形 mask（x 80-240, y 60-180，边缘 1 格软边）
  const mask = new Float32Array(320 * 240);
  for (let y = 0; y < 240; y++) {
    for (let x = 0; x < 320; x++) {
      const dx = Math.max(0, 80 - x, x - 240);
      const dy = Math.max(0, 60 - y, y - 180);
      const d = Math.max(dx, dy);
      mask[y * 320 + x] = d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.2 : 0;
    }
  }
  engine.setPigment({ K: Float32Array.from([1.2, 1.0, 0.8]), granulation: 0.5, staining: 0.6 });
  engine.depositMask(mask, { water: 0.6, amount: 1.5 });
  engine.step(600);
  // 沿 y=120 行剖面：x 75..115（左边缘内外）
  const { Dm } = engine;
  console.log("x | dist-from-edge | Dm");
  for (let x = 74; x <= 115; x++) {
    const i = 120 * 320 + x;
    console.log(`${x}\t${x - 80}\t${Dm[i].toFixed(4)}`);
  }
  // 内部基准（x=160, y=120）
  const core = Dm[120 * 320 + 160];
  const edgeMax = Math.max(...Array.from({ length: 8 }, (_, k) => Dm[120 * 320 + 79 - k]));
  console.log(`core(x=160)=${core.toFixed(4)}  edgeMax(x 72-79)=${edgeMax.toFixed(4)}  edge/core=${(edgeMax / core).toFixed(3)}`);
}
