# out/ — 渲染产物索引

> 本目录所有内容均可由 `node demo/*.js` 重新生成;**除 `baseline-m0/` 与本 README 外不进 git**。
> 重跑不会自动清旧文件,历史残留标 ⚠️ 的可随时删。

## 快速重建

```bash
npm test                  # smoke_final.png(冒烟)
node demo/render-demo.js  # 全景全家桶
node demo/agent-paint.js  # 《三个柿子》
node demo/copy-paint.js   # 《乡村田野》
node demo/showcase.js     # 15 件能力集(需先跑 effects/m4/m5/render/crop)
```

## 作品(三幅画 + 冒烟)

| 文件 | 生成 | 内容 |
|---|---|---|
| `demo_final.png` / `evolution.gif` / `drying_timeline.gif` / `stage_06..32.png` | `demo/render-demo.js` | 32 笔全景《树与池塘》:终稿(1280×960)/作画过程/10 秒干燥/阶段快照 |
| 同名 `_spectral` 版 | `COLOR_SYSTEM=spectral` 同上 | 16 波段光谱渲染 |
| `stage_23/25/29/31/33.png` ⚠️ | 旧场景版残留 | 新版本已改用 06-32,旧件可删 |
| `agent_still_life.png` / `agent_evolution.gif` / `agent_drying.gif` | `demo/agent-paint.js` | 《三个柿子》75 笔定稿与作画/干燥过程 |
| `agent_still_life - 1.0.png` ⚠️ | 中间版留存 | 可删 |
| `copy-final.png` / `copy-strokes.gif` / `copy-evolution.gif` / `copy-drying.gif` | `demo/copy-paint.js` | 《乡村田野》83 笔终稿(2× 960×1280)与逐笔/过程/干燥动图 |
| `copy-frames/` | `demo/copy-paint.js` | 逐笔快照 83 + 模拟帧 168 + 干燥帧 20(共 271 PNG) |
| `copy-ref/乡村田野.png` | 人工放置 | 临摹参照原图(论文图 10a 底图,已另存 `paper/figures/fig_field_original.png`) |
| `smoke_final.png` | `npm test`(`demo/smoke.js`) | 冒烟渲染 |

## 色彩

| 文件 | 生成 | 内容 |
|---|---|---|
| `color_chart.png` / `color_chart_spectral.png` / `color_chart_compare.png` | `demo/color-chart.js` | 24 色卡:RGB 栏 / 光谱栏 / 三栏并排(回归之锚) |
| `color_chart_engine.png` ⚠️ | 旧版产物 | 引擎平涂参照,可删 |
| `color/` | 色彩线工具与实验 | 171 件:Golden 原始 xlsx、CHSOS 光谱解包、CIELAB 指标报告(baseline*.json)、罩染/调和测试图、色卡迭代草稿——**数据原件本地保留,不进 git** |

## 技法面板

| 文件 | 生成 | 内容 |
|---|---|---|
| `effects_sheet.png` / `effects_p1..p8_*.png`(+`_spectral`) | `demo/effects.js` | 8 格技法面板:平涂/湿接湿/罩染/干皴/回流/颗粒/边缘/洗色 |
| `m4_sheet.png` / `m4_p1..p5_*.png` | `demo/m4-effects.js` | M4 五件:盐花/硬边/重力淌色/lift/纸纹预设 |
| `m5_sheet.png` / `m5_p1..p3_*.png` | `demo/m5-mixing.js` | M5:湿中混色/粒重分离/再湿率 |

## 对比与特写

| 文件 | 生成 | 内容 |
|---|---|---|
| `compare.png`(+`_spectral`) | `demo/compare.js` | 引擎 vs 平涂 SVG 对照 |
| `crop_pond.png` / `crop_granulation.png`(+`_spectral`) | `demo/crop.js` | 回流开花 / 颗粒聚集特写 |
| `crop_c2/c5/c7/c9.png`、`crop_cell*.png` ⚠️ | brush-lab 面板迭代裁剪 | 旧面板版本残留,可删 |
| `mask-isolate.png` | `demo/mask-isolate-test.js` | mask 层隔离探针图 |

## 笔刷实验室与性能

| 文件 | 生成 | 内容 |
|---|---|---|
| `brush-lab.png` / `brush-lab-assertions.json` | `demo/brush-lab.js` | v2.0 验收面板 + 断言参数快照 |
| `bench_final.png` / `bench_evo.gif` | `demo/bench.js` | 1280×960 性能基准 |

## 展示集与基线

| 路径 | 生成 | 内容 |
|---|---|---|
| `showcase/` | `demo/showcase.js` | 15 件能力展示集(笔触五型/回流/岸线/纸纹/破圆/淌色/颗粒/混色/硬边/盐花/lift/全景/过程/干燥)+ 自带 README 索引 |
| `baseline-m0/` | **入库,不复生** | M0 位级确定产物快照——介质升级的回归对照基准 |

## 清理

除 `baseline-m0/` 与 `copy-ref/` 外全部可删后重跑;标 ⚠️ 者是新版本跑过后不再生成的旧残留,随时可删。
