# 分层架构与升级缝

> 目标：各子系统可**松耦合、逐步、异步**升级（例如升级色彩的同时升级笔触，互不阻塞）。
> 本文档两个视角：前五节为**代码级**（已交付六部的接口与升级缝）；第六节起为**系统级**（能力层全景与构建顺序）。
> 历史叙事见 `chronicle/05-参考速查.md`；此文档为正式规格。

## 六部（src/）

| 部 | 职责 | 可独立升级的内容 |
|---|---|---|
| `core/` | 介质核心：场、九步管线、回流算子 | 水行为算法（扩散/沉积/回流） |
| `color/` | 颜色系统：颜料 → 每通道 K 基 → 每像素 RGB | **色彩模型**（RGB 3 通道 ↔ 光谱 16 通道 ↔ 将来双常数 KM/实测光谱） |
| `brush/` | 笔触：形状 mask、运笔 | **笔触形状与运笔**（压力曲线、墨量衰减……） |
| `paper/` | 纸纹：噪声、高度、容量 | 纸种预设、各向异性纤维 |
| `io/` | PNG/GIF 编码 | 输出格式 |
| `studio/` | 编排装配 | demo 与 agent 层的唯一依赖 |

## 核心接口

### ColorSystem（color/system.js）

```js
class ColorSystem {
  channels;                          // 3 或 16
  pigmentBasis(pig) → Float32Array;  // 颜料 → 单位质量的每通道 K（吸收/散射比）
  pigmentRGB(pig) → [r,g,b];         // 参照色（色卡/校验用）
  pixelToRGB(eng, i, paperColor) → [r,g,b]; // 每像素合成（KM 三通道或光谱 KM → XYZ → sRGB）
}
```

引擎（core）**不知道通道的含义**：它只搬运每通道 K·d 与质量 d。颜色革命（exp → KM → 光谱）未改引擎一行。

### WatercolorEngine（core/engine.js）

```js
new WatercolorEngine({ w, h, seed, params, channels })  // channels 由 ColorSystem 决定
engine.setPigment({ K, granulation, staining })
engine.depositMask(mask, { water, amount })   // 可选 { waterMask? }：水走 waterMask、颜料走 mask（brush-dynamics v2 缝）
engine.wetnessAt(x, y)                        // 只读：纸面湿度查询（brush-dynamics v2 湿纸反馈）
engine.pickupAt(x, y, r)                      // 只读：接触区溶液+沉积采样（v2.1 脏笔）
engine.liftMask(mask, opts)
engine.pushPigmentRadial(cx, cy, radius, strength)
engine.step(n)
```

### StrokePainter（brush/strokes.js）

形状层产出 mask 并调用 engine.depositMask——**不关心通道维度**。升级运笔（压力曲线、新形状）不动引擎。
笔刷动力学（v2，见 `docs/brush-dynamics.md`）在此层之上增加三个**只读/扩展缝**：`wetnessAt`/`pickupAt` 只读查询、`depositMask.waterMask` 水颜分离沉积——都不改变引擎行为（缺省参数 = 旧行为），颜色革命与介质升级依然互不感知。

### Studio（studio/studio.js）

```js
const studio = createStudio({ width, height, seed, painterSeed, colorSystem, params });
studio.apply(stroke, steps);  // 一笔
studio.render(opts);          // RGBA
studio.composite(opts);       // 网格平面（分析用）
```

颜色系统切换：环境变量 `COLOR_SYSTEM=spectral` 或显式传 `colorSystem`。

## 依赖方向（禁环）

```
studio → { core, color, brush }
demo   → { studio, io, color }
color  → brush（仅 hexToRgb01 工具，已知小依赖，可随时抽离）
core   → paper
brush  → paper
```

## 异步升级路线（示例）

- **色彩线**：实测颜料光谱 / 双常数 KM / 着色力曲线 → 新 ColorSystem → studio 注入，全部 demo 通过切换开关验证。
- **笔触线**：压力曲线（窄-宽-窄随机化）、墨量衰减、新形状 → 只改 brush/。
- **介质线**：各向异性纸纹、更稳的流动 → 只改 core/ 与 paper/。
- **验收**：两线各自跑 `demo/color-metrics.js`（色卡 CIELAB）与 `demo/effects.js`（8 格面板），互不干扰。

## 检验基准（回归之锚）

1. `demo/color-chart.js` — 24 色卡三栏（RGB | 光谱 | 平涂参照）——色彩之锚。
2. `demo/color-metrics.js` — CIELAB ΔE/ΔC* 双系统对照——色彩之数。
3. `demo/effects.js` — 8 格技法面板——笔触与水法之锚。
4. `demo/render-demo.js` — 31 笔全景 + 干燥动图——整体之锚。
5. `demo/paintability/`（待建）— 十基元正交电池 + oracle 寻优下限——可画性之锚（见 `docs/paintability.md`）。

## 视角二：能力层（系统级）

> 前五节回答"代码怎么分层、怎么安全升级"；这一节回答"完整的水彩 AI 系统需要哪些能力，现在有几层，roadmap 挂在哪一层"。

### 内六层：画好一张画的最小完整管线

| 层 | 职责 | 现状 | 代码落点 |
|---|---|---|---|
| 介质层 | 水行为：湿扩散、边缘沉积、回流开花、颗粒聚集、干燥时间线 | ✅ 交付 | `src/core/` |
| 意图层 | 构图、笔序、技法、留白判断、改笔决策；中间表示 = 可绘制表征 Z（`docs/paintable-representation.md`） | 🔶 Phase 1 | `src/agent/`（待建） |
| 眼睛层 | 看真实画布、局部批评、多候选变体选 1 | 🔶 Phase 1 | `src/critique/`（待建） |
| 资产层 | 颜料库、纸预设、技法词典 | 🔶 部分：24 色颜料库 + 程序化光谱 | `src/color/`；数据化后搬 `src/assets/` |
| 时间与记忆层 | 录制/回放/暂停/重渲染、会话日志、过程量化 | 🔶 引擎有时间戳；录制回放 Phase 2 | `src/time/`（待建） |
| 交互与解释层 | 用户提问、亲手加一笔、批评原文、recipe 分享 | ❌ Phase 2 | `src/session/`（待建） |

贯穿性胶水（不属于任何一层，但决定成败）：阶段预算、keep-best、限流降级、日志即证据链——dsh-studio 遗产（`docs/lessons.md`），Phase 1 移植。

### 外四环：从"执行器"到"画家"

内六层是一台无状态执行器（画完即忘）。完整强大的系统是有职业生涯的画家，靠四个外环：

| 环 | 内容 | 成本 |
|---|---|---|
| 世界层 | 湿度→蒸发速率、倾斜→淌色方向、温度 | 低-中（协议 `paper.tilt` 已埋钩子） |
| 成长层 | 作品集、风格形成、品味校准、用户偏好 | **低**（纯 LLM 侧：记忆库 + 历史批评）——成本最低、概念提升最大、最易被无限推迟 |
| 共创层 | 人机共创钩子、多人画布、CCSM 过程量化、recipe remix/fork | 中（Phase 2 一部分） |
| 工具链/研究层 | 引擎调试器（含水场可视化）、参数调校 UI、8K 管线、两幅画 diff、过程分析 | 中-高 |

对照相关项目调研：CCSM 量化→共创层；Drawcto 解释框→交互与解释层；Graffiti-X 遥测→工具链层；Collabdraw 可 fork→共创层平台化。

### 目录生长规则

**不建空壳**——哪层来了哪个模块就建哪个。预期长出：

```
src/
  core/effects/     bloom/edge/granulation/frontDeposit 从 engine.js 抽出（现全在 23KB 单文件）
  brush/shapes/     笔形库（圆头/平头/大排刷）
  brush/dynamics/   含水梯度、枯笔、飞白（与 motion 因果耦合）
  color/mixing/     湿中混色、分离/絮凝、halo（需颜料粒重模型）
  time/             时间线、录制/回放/重渲染（护城河层，最早值得建）
  critique/         vision 批评接口、rubric、度量
  agent/            笔序规划、技法知识、循环骨架
  session/          会话日志、过程量化曲线、gallery
  assets/           颜料/纸/技法预设数据（pigments.js → pigments.json）
```

### 工件优先级与协议原则

- 引擎侧缺口 backlog 与优先级（P1/P2/P3）见 `docs/engine.md`「工件缺口 backlog」；原则：**因果耦合优先于新效果**（让已有效果由同一条因果链驱动，而非堆新件）。
- stroke 协议 v0.2 与设计原则（颜料名优先 / brush 对象 / motion 因果钥匙 / 全默认值）见 `docs/engine.md`「stroke 指令协议」。

### 构建顺序

介质 ✅ → 意图 + 眼睛 + 胶水 + 资产数据化（Phase 1）→ time 层（录制/回放，护城河）→ 交互解释 / 成长层（Phase 2）。

四个身份（自主画师 / 共创伙伴 / 研究仪器 / 产品平台）对"强大"的定义不同；`docs/paradigm.md` 的"过程即产品"已偏向共创伙伴/平台。**成长层解决"第 100 张画和第 1 张画有没有区别"，成本最低、最易被无限推迟——建议 Phase 1 末就排一次队。**
