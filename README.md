# watercolor-ai（暂名）

> 不是"生成一张水彩画"，而是**像人一样画一张水彩画**：从构图开始，一笔一笔、一层一层地画完——水在纸上自己干、自己渗、自己长出边缘。

**一句话定位**：agent 水彩画家 —— LLM 管意图，介质引擎管水，时间线管叙事。

## 为什么存在

- diffusion 强在采样，但过程不可见、不可干预、不可复现；
- 水彩引擎（Rebelle / Expresii / Fresco）强在介质，但不会自己构图，只等一只手；
- LLM 强在意图（构图、笔序、色彩理论、技法），但不知道水会怎么流。

我们做**除法**：三权分立，各干各最擅长的事。这个组合落在所有现有产品的空象限里：**过程可见 + 介质真实 + 自主创作**。

## 核心信念

1. **水彩的美是时间函数**。水痕是湿区边缘蒸发时的回流，毛边是颜料随水渗进纸纤维，颗粒聚集是重颜料在纸谷里沉降。这些不是形状，是过程。
2. **介质必须真实，但不必物理**。观众认的是"感知签名"不是方程。引擎职责：湿扩散、边缘沉积、回流开花、颗粒聚集、干燥时间线。
3. **过程即产品**。作画过程本身就是内容：可观看、可暂停、可提问、可回放。

## 资产

- **画 = 程序**：笔触列表是这幅画的源代码，引擎是解释器。同一张画可以换纸、换倾斜、重放干燥过程、在 8K 重渲染。
- **作画即内容**：真实的干燥时间线让"进化动图"不再是几张图的轮播，而是时间流逝本身。

## 当前状态（Phase 0 完成 ✅ + 光谱色彩系统）

介质引擎尖峰已交付，纯 JS + typed array，**零依赖**，Node 可跑（浏览器兼容设计）：

- 五个感知签名工件全部实现并有独立视觉验证：湿扩散、边缘沉积线、回流开花（cauliflower/backrun）、颗粒聚集、干燥时间线
- **双颜色系统**：RGB 三通道 KM（基线）与 **16 波段光谱 KM**（400-700nm，每支颜料一条光谱，CIE 1931 + D65 → XYZ → sRGB）。全强度 24 色平均 ΔE：RGB 5.5 → **光谱 3.2**。切换：`COLOR_SYSTEM=spectral node demo/render-demo.js`
- **分层架构**（见 `docs/architecture.md`）：core（介质）/ color（颜色）/ brush（笔触）/ paper / io / studio 六部，颜色与笔触可独立异步升级
- 手绘 31 笔 demo 场景（`demo/scene.js`）：湿铺天空、罩染远山、干皴树冠、池塘趁湿滴清水 ×2、重颗粒群青沉淀、洗色
- **24 色卡**（`demo/color-chart.js`）：RGB | 光谱 | 平涂参照三栏并排 + CIELAB 指标（`demo/color-metrics.js`）——色彩回归之锚
- 产出（`out/`）：
  - `demo_final.png` / `demo_final_spectral.png` — 完整画面（1280×960）
  - `evolution.gif` / `drying_timeline.gif` — 作画过程 + 10 秒真实干燥动图（GIF 已修，PIL 验证）
  - `compare.png` — 引擎 vs 平涂 SVG 模拟对比
  - `effects_sheet.png` — 8 格技法面板（平涂/湿接湿/罩染/干皴/回流/颗粒/边缘/洗色）
  - `color_chart_compare.png` — 24 色卡三栏（RGB | 光谱 | 平涂参照）
  - `crop_pond.png` / `crop_granulation.png` — 回流开花与颗粒特写

### 诚实评分（vision 独立评审）

| 对象 | 分数 | 说明 |
|---|---|---|
| 引擎全景观感 | **6.5/10** | 背景湿铺 ≈ 8 分；物体笔触 4-5 分（Phase 1 的活） |
| 回流开花特写 | 6.5-7/10 | 闭环深色蕾丝 + 浅色水渍心成立 |
| 24 色卡（RGB 系统） | 7.2/10 | 色彩准确自然；运笔同模与重颗粒待立 |
| 24 色卡（光谱系统） | **8.5/10** | 约 17-18 支可盲认；全强度平均 ΔE 5.5→3.2 |
| Open-Watercolor-Sim（对照基准） | 2.5-3/10 | 官方 demo "带颜色的雾" |

门槛解读：**"水是真的"已过半**（缩略图一眼是松散水彩小品；水痕会长出来），色彩"准"已足而"艳/深/身份"尚在途中——光谱系统是向史明克级迈出的第一步。

## 项目史

所作之事，尽录于 **`chronicle/`**（平实开发日志，五个阶段文件 + 参考速查）：探测与引擎 → 回流与笔触 → 色卡与 KM → 光谱与分层 → 参数/评分/bug 速查。

## 快速开始

```bash
node demo/render-demo.js   # 完整场景 → out/demo_final.png + 两个动图
node demo/effects.js       # 8 格效果测试面板
node demo/color-chart.js   # 24 色卡三栏（RGB | 光谱 | 平涂参照）
node demo/color-metrics.js # CIELAB 双系统对照（色彩回归基准）
node demo/compare.js       # 引擎 vs 平涂对比图
node demo/crop.js          # 回流开花 / 颗粒特写

# 光谱颜色系统（16 通道，慢约 2.7 倍）：
#   PowerShell: $env:COLOR_SYSTEM="spectral"; node demo/render-demo.js
#   或改 package.json 里 demo:spectral 脚本
```

## 仓库布局

- `chronicle/` — **项目史（仿《明史》四体：本纪/志/表/列传）**
- `docs/paradigm.md` — 范式：从对话中沉淀的认知精华
- `docs/architecture.md` — **分层架构与升级缝（松耦合升级的正式规格）**
- `docs/engine.md` — 强引擎规格：五个工件 + **stroke 协议 v0.2** + 工件缺口 backlog
- `docs/engine-js.md` — JS 引擎实现说明（数据结构、管线、bloom 算子、参数表、已知问题）
- `docs/watercolor_engine_spec.md` — Hobbs/Curtis 算法规格（研究产出，公式有出处）
- `docs/agent-loop.md` — 接入层：agent 笔序 + vision 阶段批评（Phase 1）
- `docs/taste.md` — 品味观与手文件：品味不生成、被继承被选择；人是唯一神谕；产品四档（看/画/同画/传）
- `docs/teaching-mvp.md` — Phase 1 第一刀：教学回放 MVP 的范围切割（教不会画的）
- `docs/lessons.md` — dsh-studio 实战教训（本项目的需求输入）
- `docs/roadmap.md` — 尖峰 → 接入 → 产品化
- `src/core/` — 介质引擎（通道数泛化）；`src/color/` — 颜色系统（RGB/光谱）；`src/brush/` — 笔触；`src/paper/` — 纸纹；`src/io/` — PNG/GIF；`src/studio/` — 编排装配
- `demo/` — 场景与运行器
- `probe/` — Open-Watercolor-Sim 探测全记录（评估、源码、冒烟脚本、对比图）
- `research/` — Curtis SIGGRAPH'97 专利 US6198489 全文 + CIE 1931/D65 标准数据

## 关联项目

- dsh-sight — 眼睛（vision 工具）
- dsh-studio — 手（SVG 前身；教训见 `docs/lessons.md`）
- DeepSeek Harness — 宿主运行时

## 下一步

见 `docs/roadmap.md`：**Phase 1 — 接入 LLM**（stroke 协议 v0.2 定稿、dsh-studio 循环骨架移植、vision 阶段批评、一句话到完整水彩的端到端 demo）。
