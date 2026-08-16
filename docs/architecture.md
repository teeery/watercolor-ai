# 分层架构与升级缝

> 目标：各子系统可**松耦合、逐步、异步**升级（例如升级色彩的同时升级笔触，互不阻塞）。
> 历史叙事见 `chronicle/表/模块表.md`；此文档为正式规格。

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
engine.depositMask(mask, { water, amount })
engine.liftMask(mask, opts)
engine.pushPigmentRadial(cx, cy, radius, strength)
engine.step(n)
```

### StrokePainter（brush/strokes.js）

形状层只产出 mask 并调用 engine.depositMask——**不关心通道维度**。升级运笔（压力曲线、新形状）不动引擎。

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
