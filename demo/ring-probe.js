// 数值探针：水滴 1 周围 8 个扇区的 D 分布（铲子之后、模拟之后）
import { createStudio } from "../src/studio/studio.js";
import { scene } from "./scene.js";

const studio = createStudio({ width: 640, height: 480, seed: 3, painterSeed: 11 });
const { engine, apply } = studio;

let idx = 0;
for (; idx < scene.length; idx++) {
  if (scene[idx].stroke.type === "re-wet") break;
  apply(scene[idx].stroke, scene[idx].stepsAfter);
}
apply(scene[idx].stroke);
const sector = (label) => {
  const cxs = 98, cys = 340;
  const sums = new Array(8).fill(0), cnt = new Array(8).fill(0);
  for (let y = cys - 24; y <= cys + 24; y++) {
    for (let x = cxs - 24; x <= cxs + 24; x++) {
      if (x < 0 || y < 0 || x >= 640 || y >= 480) continue;
      const dx = x - cxs, dy = y - cys;
      const d = Math.hypot(dx, dy);
      if (d < 8 || d > 22) continue;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += Math.PI * 2;
      const s = Math.floor(a / (Math.PI / 4)) % 8;
      const i = y * 640 + x;
      for (let c = 0; c < engine.ch; c++) sums[s] += engine.D[c][i];
      cnt[s]++;
    }
  }
  console.log(label, sums.map((s, k) => `s${k}=${(s / (cnt[k] || 1)).toFixed(3)}`).join(" "));
};
sector("after droplet1 push (before sim):");
engine.step(scene[idx].stepsAfter);
sector("after sim steps:");
