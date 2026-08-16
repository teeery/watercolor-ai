# 强引擎规格 v0.2

## 定位：感知签名，不是物理模拟

不做 Rebelle / Expresii 级别的全物理水模拟（那是一个研究组的成果）。做**合成水彩的感知签名**——观众认的是视觉签名，不是方程（Fresco / Procreate 已证明这条路成立）。

目标画布 1280×960 起步；纯 JS + typed array，可运行在 host（Node）与浏览器。模拟在半分辨率网格（640×480）上进行（水彩是软的，模糊本就在签名里），上采样回全分辨率。

## 五个工件（Phase 0 已交付 ✅）

实现细节、迭代史、参数表见 `docs/engine-js.md`；状态由 vision 独立评审验证（README 诚实评分表）。

### 1. 湿扩散 wet diffusion ✅
- 现象：湿区颜料向四周渗开，随时间扩散，对比度衰减。
- 做法：半拉格朗日平流 + 扩散 + 掩码扩张（清水前锋，bbox 限定）。
- 验收：一笔湿铺 10 秒内自然晕开，边缘不再锋利。

### 2. 边缘沉积 edge darkening ✅
- 现象：干笔触边缘有一条深色沉积线。
- 做法：渲染侧 颜料 mask → box blur 相减得**内侧**边缘带 → 纸纹噪声调制宽度 → 加深（只取内侧，外侧白纸不染灰）。
- 验收：干皴一笔，"毛边 + 深边"同时成立，像真笔扫过。

### 3. 回流开花 cauliflower / backrun ✅
- 现象：湿区再滴清水，颜料被推挤成锯齿状潮线，形似菜花。
- 做法：pushPigmentRadial 显式搬运（质量守恒）+ 解析增强；6 版迭代（v5-v13）的教训见 engine-js.md。
- 验收：滴一滴清水进湿区，10 秒内长出一圈锯齿花边。现状：瓣形偏机械、两朵大小雷同（known issue #2）。

### 4. 颗粒聚集 granulation ✅
- 现象：重颜料（群青 / 赭石类）在纸谷沉降成点状颗粒。
- 做法：纸纹细颗粒 × 纸谷偏置 × 每颜料"颗粒度"参数。
- 验收：同一笔分别用"细腻颜料"与"重颗粒颜料"，颗粒感差异肉眼可见。现状：与纸纤维方向绑定偏弱（known issue #3）。

### 5. 干燥时间线 drying timeline ✅
- 现象：湿区随蒸发变干：边缘先干、含水率下降、水痕在回放中"长出来"。
- 做法：每个笔触带时间戳；蒸发 + 冻结；阶段快照用于回放与动图。
- 验收：一段 10 秒回放里，观众亲眼看见扩散 → 沉积 → 水痕成形。**这是全片的 wow 时刻，也是区别于"笔刷滤镜"的护城河。**

## 超出五工件的已交付件

- 回流环前缘沉积（frontDeposit）、湿区边缘加深（模拟侧）、重力参数（弱）
- 笔触层：ribbon（Chaikin×2 圆角、宽度插值、压力包络、fbm 抖动）、dry-brush（泪滴戳 + 条状飞白 + `clip: "last-ribbon"`）、spatter、lift（方向拉伸 + 残留）
- 颜色系统：KM 单常数渲染 + RGB / 光谱（16 波段）双系统接口；24 色颜料库 + 程序化光谱
- studio 装配层（demo 与未来 agent 只依赖 Studio 稳定接口）

## 工件缺口 backlog（优先级）

原则：**因果耦合优先于新效果**（known issue #4：飞白/咖啡环/洗色已上线但仍是"纹理层"，与压力曲线、蒸发历史、笔速的因果耦合不足）。

| 优先级 | 工件 | 理由 |
|---|---|---|
| P1 | 重力淌色/滴流 | gravity 已存在，调大 + 湿区竖直速度即可 |
| P1 | 盐花 | mask 后晶格排盐 + 吸水，纯形态算子 |
| P1 | 独立咖啡环 | frontDeposit 已有，独立成算子即得 |
| P1 | 笔刷形状库（圆头/平头/大排刷） | ribbon 已支持宽度包络，加 shape 参数 |
| P2 | 沿笔含水梯度（湿笔→枯笔） | 压力包络已有，改沿程衰减 |
| P2 | 湿中颜料分离/絮凝 | 需颜料"粒重"，平流速度按粒重分档 |
| P2 | 纤维方向性颗粒 | 细噪×纸谷 → 加方向场 |
| P3 | 实测光谱、halo、全物理 NS | 极晚或永远不做 |

## stroke 指令协议（v0.2）

agent（LLM）与引擎之间的界面。一幅画 = 一份有序的 stroke JSON 列表 = 画的源代码。设计原则见 `docs/architecture.md` 第五节。

```json
{
  "strokes": [
    {
      "t": 0,
      "type": "wet-wash",
      "brush": { "shape": "flat", "width": 60, "load": 0.8 },
      "region": "paper-upper-half",
      "pigment": { "name": "群青", "amount": 0.5 },
      "water": 0.8,
      "motion": { "speed": 0.3, "pressure": [0.2, 1.0, 0.1] },
      "paper": { "wetness": 0.9, "texture": "cold-press" }
    },
    {
      "t": 24000,
      "type": "dry-brush",
      "brush": { "shape": "round", "width": 14, "load": 0.15 },
      "path": "M 320 400 C 380 380, 420 430, 480 410",
      "pigment": { "name": "深绿", "amount": 0.4 },
      "water": 0.15,
      "motion": { "speed": 0.7, "pressure": [0.1, 0.8, 0.0] },
      "paper": { "wetness": 0.1, "texture": "cold-press" }
    }
  ],
  "paper": { "texture": "cold-press", "size": [1280, 960], "tilt": 0 },
  "meta": { "title": "榕树下的女孩", "style": "watercolor" }
}
```

字段说明：

- `pigment.name` 走颜料库（24 色，自动携带 granulation / staining / 光谱）；`pigment.color` hex 为兜底（按 RGB 距离反查最近预设）。**名字优先**——LLM 说"群青"比说 hex 自然，且名字携带库里的物性参数。
- `brush`（v0.2 新增）：`shape`（round / flat / rigger...）、`width`、`load`（装水量，驱动沿程含水与枯笔）。这是"笔的身份"落点。
- `motion`（v0.2 新增）：`speed` 驱动飞白密度与纹理；`pressure` 数组驱动纹理 × 蒸发历史耦合——known issue #4 的钥匙，把"纹理层"升级成"因果层"。
- 全部字段有默认值：LLM 只写它想控制的，协议不逼模型填满。
- 类型初集：`wet-wash`（湿铺）、`dry-brush`（干皴）、`glaze`（罩染）、`spatter`（溅点）、`re-wet`（再润湿，触发回流）、`lift`（洗色）、`salt`（盐花，P1 backlog）。
- `water` ∈ 0..1 控制扩散半径；引擎只解释协议，不做构图判断——构图是模型的事。

> 兼容性：v0.2 新增字段全部可选，现有 `demo/scene.js` 的 v0.1 写法继续有效。Phase 1 起 agent 按 v0.2 书写。
>
> **`brush` / `motion` 字段的语义与因果链（笔的身份、水库状态机、飞白涌现、湿纸反馈）见 `docs/brush-dynamics.md`** —— 当前实现只读 shape+颜料+water，笔刷动力学为待建件（known issue #4 的解法，`brush` 分支）。

## 非目标（当前明确不做）

- 全物理 Navier-Stokes 模拟、纸纤维微观建模、色彩化学全模拟。现状：混色已由 KM 单常数 + 16 波段光谱覆盖（`src/color/system.js`）；实测颜料光谱数据属资产层，非介质层。
- 文本 / 签名元素（先画好水，再谈签名）。

## 尖峰验收标准（Phase 0 已通过 ✅）

1. 手绘 31 笔：湿铺天空、罩染远山、干皴树冠、池塘趁湿滴清水 ×2、重颗粒群青沉淀、溅点、洗色。
2. 产出：`out/demo_final.png`、`out/evolution.gif`（真实时间线 75 帧）、`out/drying_timeline.gif`、`out/compare.png`、crop 特写、stage 快照。
3. 判断标准：看的人第一反应是"这水是真的"，而不是"这是矢量图"——整体 6.5/10（背景湿铺 8/10、回流特写 6.5-7/10），对照基准 Open-Watercolor-Sim 2.5-3/10。
