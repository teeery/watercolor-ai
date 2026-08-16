// 介质能力展示集：生成 3 块新面板 + 归档现有验收产物 → out/showcase/ + README.md 能力索引
// 用法：node demo/showcase.js
import { createStudio } from "../src/studio/studio.js";
import { writePNG } from "../src/io/png.js";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";

const OUT = "out";
const DIR = `${OUT}/showcase`;
mkdirSync(DIR, { recursive: true });

// —— 01 笔触五型（湿铺条带 / 干皴 / 罩染 / 溅点 / 盐花，各自独立区域）——
{
  const s = createStudio({ width: 640, height: 480, seed: 13, painterSeed: 37 });
  s.apply({ type: "wet-wash", path: [[24, 260], [100, 225], [176, 260]], radius: 24, radiusEnd: 16, pigment: { color: "#5b8fc7", granulation: 0.3, staining: 0.5, amount: 1.5 }, water: 0.5 }, 200);
  s.apply({ type: "dry-brush", radius: 8, path: [[186, 290], [250, 250], [310, 285]], pigment: { color: "#4d7a52", granulation: 0.6, staining: 0.4, amount: 1.8 }, water: 0.3, grainBreak: 0.85 }, 120);
  s.apply({ type: "glaze", path: [[318, 175], [380, 200], [434, 170]], radius: 18, radiusEnd: 12, pigment: { color: "#c74a5b", granulation: 0.3, staining: 0.5, amount: 1.1 }, water: 0.5 }, 180);
  s.apply({ type: "spatter", center: { cx: 512, cy: 240 }, count: 34, spread: 62, pigment: { color: "#d8b64a", granulation: 0.25, staining: 0.4, amount: 1.5 } }, 160);
  s.apply({ type: "wet-wash", region: { cx: 64, cy: 150, rx: 34, ry: 46 }, pigment: { color: "#3a4a7a", granulation: 0.9, staining: 0.7, amount: 1.5 }, water: 0.65 }, 30);
  s.apply({ type: "salt", center: { cx: 64, cy: 150 }, count: 8, spread: 28, rMin: 5, rMax: 12, lift: 0.95, arms: 5 }, 300);
  const img = s.render();
  writePNG(`${DIR}/01_brushstrokes.png`, img.data, img.w, img.h);
  console.log("01_brushstrokes");
}

// —— 04 各向异性纸纹（强方向纤维 + 低水条带：边缘沿纤维撕裂/爬行）——
{
  const s = createStudio({ width: 256, height: 256, seed: 21, painterSeed: 41, params: { paper: { fiberBias: 0.6, fiberAmp: 0.4, preset: "rough" } } });
  s.apply({ type: "wet-wash", path: [[30, 128], [128, 112], [226, 132]], radius: 34, radiusEnd: 26, pigment: { color: "#6f8fa8", granulation: 0.6, staining: 0.45, amount: 1.5 }, water: 0.5 }, 300);
  const img = s.render();
  writePNG(`${DIR}/04_paper_anisotropy.png`, img.data, img.w, img.h);
  console.log("04_paper_anisotropy");
}

// —— 05 宏观破圆（双团叠压：高含水大团 + 小团，缺口与半岛读作构图而非打孔）——
{
  const s = createStudio({ width: 256, height: 256, seed: 33, painterSeed: 47 });
  s.apply({ type: "wet-wash", region: { cx: 128, cy: 136, rx: 84, ry: 62 }, pigment: { color: "#7d8a5b", granulation: 0.4, staining: 0.55, amount: 1.4 }, water: 0.8, layers: 1 }, 40);
  s.apply({ type: "wet-wash", region: { cx: 96, cy: 172, rx: 48, ry: 36 }, pigment: { color: "#5e7658", granulation: 0.45, staining: 0.5, amount: 1.3 }, water: 0.7, layers: 1 }, 320);
  const img = s.render();
  writePNG(`${DIR}/05_macro_breaking.png`, img.data, img.w, img.h);
  console.log("05_macro_breaking");
}

// —— 归档现有验收产物 ——
const copies = [
  ["effects_p5_bloom.png", "02_bloom.png"],             // 回流开花（曲率驱动圆瓣）
  ["crop_pond.png", "03_shoreline.png"],                // 岸线三层结构（水线+透明带+外线）
  ["m4_p3_run.png", "06_gravity_runs.png"],             // 重力淌色/滴流
  ["crop_granulation.png", "07_granulation.png"],       // 颗粒聚集（纸谷沉积）
  ["m5_sheet.png", "08_mixing.png"],                    // 湿中混色 / 粒重分离 / 再湿率
  ["m4_p5_paper.png", "09_paper_presets.png"],          // 纸纹三档 hot/cold/rough
  ["m4_p2_hardedge.png", "10_hard_vs_soft.png"],        // 硬边 vs 软边
  ["m4_p1_salt.png", "11_salt.png"],                    // 盐花
  ["m4_p4_liftpile.png", "12_lift_pileup.png"],         // 洗色边缘堆挤
  ["demo_final.png", "13_demo_full.png"],               // 全景 demo
  ["evolution.gif", "14_evolution.gif"],                // 作画全过程
  ["drying_timeline.gif", "15_drying_timeline.gif"],    // 干燥时间线
];
for (const [src, dst] of copies) {
  try {
    copyFileSync(`${OUT}/${src}`, `${DIR}/${dst}`);
    console.log(dst);
  } catch (e) {
    console.log(`MISS ${src} (先跑对应 demo 再补)`);
  }
}

// —— README 能力索引 ——
const readme = `# 介质引擎能力展示（out/showcase）

生成时间：最近一次 \`node demo/showcase.js\`（另需 \`node demo/effects.js\`、\`node demo/m4-effects.js\`、\`node demo/m5-mixing.js\`、\`node demo/render-demo.js\`、\`node demo/crop.js\` 提供归档件）。

| # | 文件 | 展示能力 | 机制 |
|---|---|---|---|
| 01 | 01_brushstrokes.png | 笔触五型：湿铺条带 / 干皴飞白 / 罩染 / 溅点 / 盐花 | ribbon+压力包络 / 泪滴戳+grainBreak / KM 叠色 / 幂律散布 / 星形吸色 |
| 02 | 02_bloom.png | 回流开花：圆润菜花瓣 + 深色蕾丝环 + 浅色水渍心 | 曲率驱动半径剖面（M3）+ 显式质量守恒搬运 |
| 03 | 03_shoreline.png | 岸线三层结构：深色水线 + 近岸透明带 + 外侧浅线 | 蒸发驱动的向内输运（M2）+ 切线断环 + 曲率调制 |
| 04 | 04_paper_anisotropy.png | 各向异性纸纹：湿铺边缘沿纤维爬行的毛边/toe | 纤维方向场 Tx/Ty + σ 钉扎 + 沿纤维毛细爬行（M1） |
| 05 | 05_macro_breaking.png | 宏观破圆：色块边缘的缺口/半岛（非标准椭圆） | σ 宏观分量 + 沉积后宏观侵蚀（M2.2，含水量门限/湿接保护） |
| 06 | 06_gravity_runs.png | 重力淌色：滴流与淌痕（尾迹在 mask 下方） | 通道噪声流速 + 滴流前沿推进 + 淌动中固着变慢（M4） |
| 07 | 07_granulation.png | 颗粒聚集：颜料沉入纸谷成絮状团簇 | 沉积 ∝(1−σ·h) 纸谷偏置 + 细颗粒调制（Curtis bugfix#1） |
| 08 | 08_mixing.png | 湿中混色互渗 / 粒重分离 / 再湿率 | 每颜料扩散率 + 粒重平流滞后 + 再湿率重溶（M5） |
| 09 | 09_paper_presets.png | 纸纹三档：hot 细砂 / cold 中纹 / rough 粗簇方向纹 | makePaper preset（M4） |
| 10 | 10_hard_vs_solid.png | 硬边 vs 软边 | hard 标志（跳过钉扎/爬行/侵蚀 + 锐 mask） |
| 11 | 11_salt.png | 盐花：近白星形盐眼 + 周围暗环 | saltMask 星形吸色推色（M4） |
| 12 | 12_lift_pileup.png | 洗色：亮区缺口 + 擦拭方向边缘颜料堆挤 | liftMask 推挤（M4，known issue #6 关闭） |
| 13 | 13_demo_full.png | 全景：32 笔风景（天空/远山/树/池塘/地面） | 全机制合流，vision 8.8/10 |
| 14 | 14_evolution.gif | 作画全过程（逐笔推进） | 时间线 = 叙事 |
| 15 | 15_drying_timeline.gif | 干燥 10 秒真实时间线 | 蒸发→咖啡环→固着 |

评分轨迹：bugfix 物理归位 → M1 7.5 → M2 8.5 → M2.2-2.4 定稿 → M5 8.8。
`;
writeFileSync(`${DIR}/README.md`, readme);
console.log("README.md");
