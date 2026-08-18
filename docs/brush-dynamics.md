# 笔刷动力学设计 v2（深潜版）

> v2 取代 v1（git `e565161`）。这一轮的增量不是"更多形状"，而是把 v1 一笔带过的三件事做成可实现的规格：
> **笔毛之间**（bristle 毛层）、**纸笔之间**（纸齿/纤维/湿纸耦合）、**一笔之内的时间**（沉积-模拟交错）。
> 输入：`research/brush-dynamics-survey.md`（业界调研）、`demo/reservoir-probe.js`、`demo/interleave-probe.js`（数值探针，均已提交 `4274e5a`）、对抗式评审（附录 C）。
> 高要求的定义：**每一条感知签名都有数值代理可证伪，vision 只做终审**——延续 `demo/analyze.js` / `ring-probe.js` / `color-metrics.js` 的项目传统。

## 0. 三条因果线（v2 的全部野心）

| 线 | v1 | v2 增量 | 干掉哪种"假" |
|---|---|---|---|
| 一笔之内 | 水库湿→干 | **时间交错**：笔画前段在收笔前已开始蒸发 | "贴图感"（整笔同干燥度） |
| 笔毛之间 | channel field 一笔带过 | **N 毛模型**：滞后刮痕、splay 迟滞、双轨边 | "印章感"（轮廓无毛、无身份） |
| 纸笔之间 | wetnessAt 单点 | **纸齿接触阈值 + 纤维方向场 + 负通量** | "悬浮感"（笔与纸不咬合） |

## 1. 感知签名总表（master checklist）

| # | 签名 | 现状 | v2 机制 | 数值代理 | 章节 |
|---|---|---|---|---|---|
| 1 | 湿铺扩散软边 | ✅ 已交付（背景 8/10） | 保持，回归冻结 | 回归像素差=0 | — |
| 2 | 一笔之内湿→干连续谱 | ❌ 整笔同湿 | 水库 + 时间交错 | 头/尾 W 差 ≥ 50% | §4 §6 |
| 3 | 干笔飞白（涌现） | 纹理层参数 | 水库枯竭 → gb 爬升 | gb(s) 非降、守恒 | §4 §7 |
| 4 | 平头排线 + 双轨边 | ❌ | 毛层密度函数（边缘浓中间淡） | 边带/中心浓度比 | §3 |
| 5 | 转角笔毛滞后刮痕 | ❌ | 阻尼毛尖拖尾 | 转角外侧掩码长度 | §3 |
| 6 | 起笔水珠 / 收笔提尖 | 半成立（radiusEnd） | 首戳 burst + 压力尾端收尖 | 首/尾戳宽度比 | §5 |
| 7 | 一笔多色渐变（charging） | ❌ | 空间水库 tip-load | 前后段色相位移 | §4 |
| 8 | 湿接湿稀释（吸水） | hack（glaze×0.7） | 负通量：纸→笔 | wLoad 回升可测 | §4 |
| 9 | 脏笔（吸色再留色） | ❌ | pickup 桶（v2.1 落地） | 残留色相偏移 | §4 |
| 10 | 犹豫积墨成洼 | ❌ | dt∝1/v 因果 + dtMax 钳 | 慢段 dw 峰值 | §4 §8 |
| 11 | 一笔之内干燥时间线 | ❌ | interleave 分块步进 | 探针：前段失水 49-60% | §6 |
| 12 | 纸齿跳过（枯笔只触峰） | 噪声伪飞白 | H 高度阈值接触 | 触峰像素占比 | §7 |

## 2. 模型总览：v1 三层 → v2 五层

```
stamp(s) = {
  x, y, dir,              // 位置与笔向
  width(s),               // 压力 × splay 迟滞 → 足迹宽度
  pool(s),                // 腹池 mask（平滑，湿态主体）
  bristleMarks(s),        // 毛缘 mask（干态边缘 + 刮痕，毛层产出）
  water(s), amount(s),    // 空间水库 → 释放
  gb(s)                   // 飞白涌现（水库 × 纸齿 × 速度）
}
```

五层：**身份层**（brush 身份 + 画笔库）→ **毛层**（N 毛模型，产 bristleMarks）→ **运动层**（包络 + 笔法动词编译）→ **空间水库**（深度桶 + 负通量）→ **时间层**（interleave 调度）。前四层每戳推进，第五层按块推进引擎。

## 3. 毛层：N 毛模型（不逐根物理，但毛是身份载体）

v1 的"发丝通道场"不可实现——它没有说明通道场从哪来、怎么与路径相互作用。v2 用**可实现的降维毛模型**：

**毛 = 锚点 + 阻尼尖端**（每支笔 N 根，N 按形状：round 12 / flat 24 / wash 32 / rigger 4）：

```
anchor_i(s) = 笔腹锚点（随路径平移，横向偏移 b_i 固定 → 毛的"出身"）
tip_i ← tip_i + (anchor_i - tip_i) · kStiff          // 阻尼追随（每戳一次标量运算）
tip_i += 笔速度 × lagCoef                             // 尖端滞后项：转急弯时毛甩在外侧
```

- **滞后项的物理定标（Wetbrush/DiVerdi 精读采纳）**：lagCoef/kStiff 重述为 β 参数化——β=0 = 刚体随笔（无滞后刮痕），**β=1 = 全滞后（惯性完整）**；默认 0.25。β 扫的是"非惯性系抹除强度"（DiVerdi §3.4：抹加速度/科氏/向心，只留速度做摩擦；lagCoef 只吃速度不吃加速度），不是 DER 全物理的代理（见 `research/wetbrush2015-close-reading.md` / `diverti2010-close-reading.md`）。
- **转角刮痕**：路径转向时 tip 落后于 anchor → 尖端扫过转角外侧 → 外刃出现几根细刮痕、内侧收窄。这是行书/草书笔触最贵的签名，成本是 N×2 个标量。
- **splay 迟滞**：`splay ← splay + (splayTarget(p) - splay)·(1-e^{-dt/τ})`，宽度 = width·(1 + spring·splay)。足迹宽度滞后于压力 → 压下去、提起来的"肉感"。**诚实标注**：DiVerdi 无显式迟滞（其 tip spreading 靠砍毛间碰撞 + DER 涌现，O(N²) 预算外）——我们的一阶滤波是替他砍掉毛间碰撞补的感知代理，非抄他。
- **腹池 + 毛缘分解**（密度函数出自 **DAB** 的"边缘浓中间淡"，非 Wetbrush/DiVerdi——两者都无密度函数，精读纠错）：足迹 = 腹池 mask（平滑椭圆/斜刃，湿态主体）+ 毛缘 mask（N 个 2-3px 短线段，干态边缘）。毛缘浓度 = 中心的 1.3-1.6 倍 → **边缘浓中间淡**；平头笔毛缘只分布在两侧 → **双轨边（railroad tracks）** 由构造保证。**实现建议（DiVerdi 精读）**：用"有效毛厚"随 gb 单轴过渡（毛厚反比根数保覆盖、厚度降 = 覆盖率降），不硬切双 mask。诚实标注：这是 **2D 感知代理**，不是 Wetbrush/DiVerdi 级亚像素脚印（他们靠 40-600 毛/128 采样/20 万粒子才出那种纹理，我们 N=4-32 够双轨边/刮痕，不够亚像素）。
- 成本：毛缘只画在足迹边缘带（|d−r| < 3px 的环），N=24 时每戳 ≈ 200-400 像素写入，与现有 `_stampEllipse` 同量级。

**非目标**：不做 Rebelle 级逐根毛弯折/墨珠；毛的"根数/刚度/张角/载水载色"只作为 brush 身份参数（调研结论：抄抽象，不抄内核）。

## 4. 空间水库：从标量到深度桶

v1 的水库是标量（wLoad/pLoad），解释不了"笔尖蘸深色 → 一笔渐变"（charging）与"双色装笔"（variegated wash）——这是传统水彩最"手绘"的签名。v2 把水库改成**沿笔杆深度的 3 个桶**：

```
reservoir = {
  tip:   { water, pigment },   // 接触顺序第一：轻压只出 tip → 淡而细
  belly: { water, pigment },   // p > 0.5 释放
  heel:  { water, pigment },   // p > 0.8 释放（重压"按干"）
}
```

- **装水/蘸色**：`load.water` 灌满三桶；`load.pigment` 进 belly；`load.tip = {name, amount}` 把第二种颜料只装进 tip → **一笔前段是 tip 色、后段是 belly 色**，charging 由构造保证。
- **毛细回补**：每戳 `tip.water += k·(belly.water − tip.water)`——tip 先出、belly 持续补 → 长笔画的"细水长流"。
- **负通量（纸→笔）**：湿纸上作画，笔吸水 `wLoad += kWick·paperWet·p·dt` 并吸色进 tip 桶（**脏笔**，v2.1 落地——先吸水后吸色，避免一次性改引擎太宽）。实现必须用**位置式混合**（Wetbrush 式 10 两遍混合:d 距离权重,不是刚性 wicking 力——刚力会像 Wetbrush 图 8 左那样发散）。glaze×0.7 的 hack 就此删除。
- **吸放阈值迟滞（Wetbrush 式 12/13 采纳）**：吸/放之间加 ε=0.1 迟滞带（m<M 吸、m>(1+ε)M 放）——防止临界状态逐戳抖动,水库状态机稳。
- **守恒与释放（v1 两处硬伤在此修复，评审 S0-2/S0-3）**：

```
dt   = min(Δs / max(v, vMin), dtMax)              // vMin=0.02, dtMax=0.8s（停笔=毛细有限释放）
dw   = wLoad·(1 − exp(−kRelease·p·dt))            // 指数释放：自动非负、自动饱和，无需钳制
wLoad -= dw                                       // 水守恒由构造保证（Σdw ≤ 初始装水）
pRelease = pLoad·(dw/cap)·kPig + kDry·pLoad·gb·p  // 颜料随水出 + 干笔刮擦项（gb 大时靠摩擦留色）
pLoad -= pRelease                                 // 评审 S0-2：v1 只读不扣，颜料水库永不减——此处显式扣减
amount = pRelease
```

## 5. 运动层与笔法词汇（LLM 界面）

`motion.pressure = [0.3, 1.0, 0.1]` 对 LLM 太裸（评审意见一致）。v2 增加**动词层**：

| verb | 编译成 p(s) | v(s) | 用途 |
|---|---|---|---|
| 扫 | 平（0.6-0.8） | 慢→中 | 湿铺 |
| 拖 | 轻（0.3-0.5） | 中 | 干皴长线 |
| 皴 | 抖（0.4±0.2 噪声） | 中快 | 树冠纹理 |
| 点 | 顿（0.9 → 0） | 0.05→快离 | 点厾 |
| 顿 | 深谷（局部 0.05） | 犹豫成洼 | 强调 |
| 提 | 线性收尖到 pLift | 中 | 收笔 |
| 甩 | 快（0.9+） | 尾部跳跃 | 飞白点串 |
| 回锋 | 反向短段 | 慢 | 起笔 |

LLM 写作例：`"motion": { "verb": "拖", "pressure": [0.4, 1.0, 0.1] }`——verb 给骨架，数组覆盖细节。全部有默认值，延续协议"不逼模型填满"。

> v2.1+ 纹理层方向（Zheng 2017 精读启发）：若给毛缘加纹理，"拉直—弧长轴合成—rib 映射回路径"是"压力调宽而不拉伸纹理"的解法（`research/zheng2017-close-reading.md`）；弧长规范轴同时利于 Phase 2 时间线回放的确定性。

## 6. 时间层：一笔之内的模拟交错（探针已定价）

真实作画一笔 420px 湿铺 @0.15 速度 ≈ **47 秒**，画到一半前段已在蒸发。1:1 交错 = 2800 步/笔，不可行（全场景预算才 4975 步）。**压缩交错**（`demo/interleave-probe.js` 实测）：

- 规则：仅 `path` 型、长度 > 150px、且显式声明 `interleave.on` 或 `motion` 的笔画启用；每笔模拟步按弧块的**真实 dt 比例**连续分配(慢段多步、快段少步),总步数 = `min(arcLen·kStep, budgetMax)`,budgetMax=90 是**软上限**而非定值封顶(Bousseau 2006 精读修正:定值封顶是离散量化,长笔的干燥差会饱和——按弧长连续分可缓解)。
- 效果：笔画完成时，**前段已蒸发 49-60% 水**，后段 0%——同一笔内出现干燥梯度，这是"过程即产品"在最小尺度的兑现。
- 成本：全场景 +180 步 ≈ **+2s（+4%）**（按 60% 笔画超 150px 估算）。
- 回归：legacy 笔画不交错 → `demo/render-demo.js` 输出像素级不变。

## 7. 纸笔耦合（对齐 medium-upgrade A/B，只消费不重复）

- **纤维方向场**（medium-upgrade A 的 Tx/Ty）：飞白条向 = `lerp(笔势, 纤维, gb)`——湿态沿笔势、越干越沿纸纤维。毛缘刮痕的残留方向同理。纸纹三档预设（hot/cold/rough）在此消费。
- **纸齿接触阈值**：`contact = H > hThr(gb)`，gb 越大阈值越高 → 枯笔只在纸峰留痕（签名 #12）。H 场已有，纯 mask 乘法。
- **湿边浓集**（调研性价比第一的 Curtis 式启发）：升级归 medium-upgrade B（岸线算子），**原文依据 = Curtis §4.3.3 FlowOutward**（`p ← p − β·(1−blur(M))·M`，边带减水压 → 向外流 → 颜料持续运到边沉积，β ∈ [.01,.05]）。精读核验发现：引擎模拟侧 `edgeK` 阶段**恒空转**（`e = Mb−1 ≤ 0` 永远跳过），当前真实深边只有渲染侧 edgeDarken；该修复归 medium-upgrade（见 `research/curtis1997-close-reading.md` 纠错 #2）。笔刷层的职责不变：提供"边缘清晰的水量梯度"（首戳 burst 水珠 + 腹池边缘），不重复实现浓集。
- **granulation**：F/G 消费保持现状，方向性升级归 medium-upgrade A。
- **known issue #4 划界（评审 S1-6 采纳）**：v2 只认领 #4 的**飞白子项**（纹理 × 压力/笔速因果）；咖啡环/岸线子项归 medium-upgrade B（岸线算子），互不重复。依赖声明：**本设计依赖 M1 的 Tx/Ty 场与 M0 的活跃集**——M0 未落地前分桶沉积是全画布扫描（§8-4），性能口径以 M0 后为准。

## 8. 数值鲁棒性与确定性（探针实测 + 评审证实的接口事实）

`demo/reservoir-probe.js` 对 v1 公式的 30 戳仿真结果：

1. **dt 发散（击穿实锤）**：犹豫段 v=0.05 → dtRaw = 3.33s/戳；无钳制时末戳 `wLoad = −0.008`、`Σdw = 0.808 > 0.8`（超发）。修法（§4 已落）：`dt = min(Δs/max(v,vMin), dtMax)` + **指数释放** `dw = wLoad·(1−exp(−kRelease·p·dt))`——自动非负、自动饱和，守恒钳只是兜底。
2. **慢笔早枯**：匀速慢 0.15 在 s≈0.35 就耗尽全部水，后 65% 笔画无水可放。这是物理事实（真画家要反复蘸笔），但意味着**配方参数必须经探针调校**——探针从此是调参仪表：wet-wash 配方断言"耗尽点 s* ∈ [0.5, 0.85]"。
3. **gb 早饱和**：匀速快 0.9 在 s≈0.3 就 gb=1.0（余水还有 25%）。修法：`gb = kBreak·(1−wLoad/cap)^γ·(0.4+0.6v)`，γ 按配方（wet 1.5 / dry 0.8），让飞白在最后 1/3 才铺满。
4. **沉积接口与分桶（评审 S0-1/S0-4 采纳，v1 两处对引擎的真实性错误）**：① `depositMask` 里水与颜料乘**同一个 mask**（engine.js L100-101），而湿纸反馈要求 water 逐格被 `paperWet` 调制、颜料另走一路 → 引擎扩展 `depositMask(mask, {water, amount, waterMask?})`：水走 `waterMask`（含湿纸调制），颜料走 `mask`，waterMask 缺省 = mask（旧行为不变）。② `depositMask` 是 **O(w·h) 全画布扫描**（engine.js L94-95，不看 bbox），v1 声称"≤8 次沉积比逐戳便宜"是错的——旧 strokePath 是单 mask 累积后 **1 次**沉积，新管线 12-13 桶 = 12-13 次全扫。修法：depositMask 增加 mask bbox 短路（先行）+ **依赖 M0 活跃集后按戳沉积**（每戳 O(戳面积)，量化阶梯问题随之消失）；M0 落地前按段沉积并接受 ~13 次/笔。
5. **确定性（评审 S0-5 采纳）**：每笔 RNG 流 = `mulberry32(painterSeed ^ strokeIndex)`；同 seed 两次运行输出 PNG **字节级一致**（验收断言）。legacy 路径是**原代码冻结**（不重写），新/旧管线的 rng 调用序互不干扰——回归靠冻结，不靠复刻。

## 9. 协议 v0.3 草案

```json
{
  "t": 0,
  "type": "wet-wash",                          // 保留：降级为 recipe 别名（wet-wash/dry-brush/glaze）
  "brush": { "name": "貂毛圆头8号" },           // 画笔库预设名优先；或对象覆盖 shape/width/capacity/spring/bristle
  "load": {
    "water": 0.7,
    "pigment": { "name": "群青", "amount": 0.5 },
    "tip": { "name": "深绿", "amount": 0.2 }    // v0.3 新增：笔尖蘸色 → charging 渐变
  },
  "motion": { "verb": "拖", "speed": [0.3, 0.6], "pressure": [0.4, 1.0, 0.1] },
  "path": [[320, 400], [400, 380], [480, 410]],
  "interleave": { "on": true, "budget": 90 }   // v0.3 新增：一笔之内的时间
}
```

- **兼容规则（机械判据，非口头承诺）**：`brush` / `motion` / `load.tip` / `interleave` 任一出现 → 新动力学管线；全部缺席 → legacy 管线（**原代码冻结**——M0 已破"逐位一致"回归，legacy 的回归锚改为"与 M0 后基线一致"，判据 = 探针 + vision，见 §11 注）。`type` 在两条管线里都是 recipe 查表键。
- **单位**：`width` 等长度以 1280×960 画布坐标为基准，笔刷层 ×0.5 落到 640×480 模拟网格（v0.2 示例 width:60 即画布口径）。
- **命名归一（评审 S1-8 采纳）**：水的三处概念合并——顶层 `water`（v0.1）与 `brush.load`（v0.2）在新管线里**统一为 `load.water`**；`brush.load` 标记废弃（写了的按装水量折算到 load.water）。`motion.speed` 在 v0.3 允许标量或数组（标量 = 常数剖面）。
- **brush 字段接线语义（DiVerdi 精读采纳）**：`width = f(pressure, spring)` 显式次序——压力过 stiffness 才到宽度（DiVerdi §3.6 Fig3），不是顺序相乘；`bristle` 字段同时决定毛缘线宽（**毛厚反比根数保覆盖**：N 小则毛粗、总覆盖不变）；`pickup` 桶独立消耗（v2.1 脏笔释放时优先消耗吸回的颜料）。
- **v0.1 → v0.3 字段映射表**（legacy 场景无需重写，但新 agent 应知旧字段的语义归宿）：

| v0.1 字段 | 新管线归宿 |
|---|---|
| `radius` / `radiusEnd` | `brush.width` + 默认压力包络（尾端收尖） |
| `water`（顶层） | `load.water` |
| `pigment.amount` | `load.pigment.amount` |
| `grainBreak` | **废除**：由水库涌现（配方 kBreak/γ 控制强度） |
| `clip: "last-ribbon"` | 保留为 v0.3 可选字段（毛缘裁剪在上一笔轮廓内） |
| `layers` | 保留（同路径重复扫） |
| `elongMin/Max` / `spacing` | 折入 brush 毛参数（rigger 长戳、round 短戳） |

- **校验（评审 S2-11 采纳）**：`pressure`/`speed` 数组长度 ∈ [1,5]、值域 [0,1]（pressure 允许 0 = 提笔悬空，speed 不允许 0 → 引擎侧再钳 vMin 兜底）；越界输入拒绝并报错，不静默。
- `region` 型：legacy 走 blob；新管线合成"大排刷蛇形往返路径"（spacing = 0.8·width，速度 0.4）共用同一水库。

## 10. 落地与预算

```
src/brush/
  brush.js       画笔库预设（圆头/平头/排刷/勾线 × 毛参数）+ recipe 表
  motion.js      包络插值 + verb 编译表
  reservoir.js   空间水库（3 桶、毛细回补、负通量、守恒钳）
  bristles.js    N 毛模型（锚点-尖端、splay 迟滞、毛缘 mask）
  footprints.js  腹池足迹（泪滴/斜刃/排刷腹）
  dynamics.js    BrushState 发射器 + interleave 调度
  strokes.js     apply()：新/legacy 分流；spatter/re-wet/lift 维持现算子
src/core/engine.js  +wetnessAt(x,y) / +pickupAt(x,y,r)（只读查询，零行为变更）
                   depositMask 扩展 {waterMask?}（水走 waterMask、颜料走 mask；缺省=旧行为）
                   depositMask 增加 mask bbox 短路（先行优化，M0 活跃集落地后按戳沉积）
probe/            reservoir-probe.js / interleave-probe.js（已提交，调参仪表）
demo/brush-lab.js 9 格验收面板（待建）
```

- 依赖方向：`brush → core(只读 + 沉积扩展)/paper`，`studio → brush`，无环。`docs/architecture.md` 的"形状层只产出 mask 并调用 depositMask"边界按此更新（wetnessAt/pickupAt 为只读缝，waterMask 为沉积缝）。
- 预算：状态机标量运算可忽略；毛缘每戳 200-400px 写入；分桶沉积 **M0 前 ~13 次全画布扫描/笔（须 bbox 短路先行），M0 后按戳 O(戳面积)**；interleave +4% 场景时间。总预算以 M0 落地后的口径为准。
- 分两期落地：**v2.0** = §3-§8 除 pickup 吸色外全部 + brush-lab.js；**v2.1** = 脏笔 pickup（引擎 pickupAt）+ 调色盘蘸笔对象。

## 11. 验收（可证伪，vision 只做终审）

**数值断言**（brush-lab.js 内置，跑挂即失败）：
1. 守恒：任意笔 `Σdw ≤ load.water·cap + 1e-6`，`wLoad ≥ 0`、`pLoad ≥ 0` 全程；
2. 单调：`gb(s)` 非降、`amount(s)` 非增（无 pickup 时）；
3. 确定性：同 seed 两次渲染字节级一致；
4. 回归：legacy 32 笔场景与 M0 后基线一致——**像素差硬门槛已不可用**（M0 活跃集迭代顺序已破逐位一致，Montesdeoca 精读确认 mean .12/255），回归判据 = 探针剖面 + vision 评分不退化（±0.5 分内）；
5. 配方调校：wet-wash 耗尽点 s* ∈ [0.5,0.85]；dry-brush 在 gb=0.5 时余水比 ∈ [0.3,0.6]。

**统计代理（评审 S1-9 采纳，vision 之外的第二道判官）**：
6. 沿弧长亮度单调性：单笔中段亮度方差应随 s 显著上升（飞白变体）——相关系数 ρ(亮度, s) 过阈值；
7. 宽度-压力斜率：`width(s)` 与 `pressure(s)` 的回归斜率 ∈ [0.2, 0.8]（spring 生效但不失控）；
8. 水分-速度相关：`wDep(s)` 与 `v(s)` 相关系数 < −0.3（慢必多水，因果成立）；
9. 重叠区浓度降幅：湿纸上第二笔重叠区 D 增量低于同参数干纸对照 ≥ 30%（吸水因果）。

**常数初值表（全部待 brush-lab 调校，初始值来自探针口径）**：

| 常数 | 初值 | 含义 |
|---|---|---|
| kRelease | 1.2 s⁻¹ | 指数释放率 |
| dtMax | 0.8 s | 停笔毛细释放上限 |
| vMin | 0.02 | 速度下钳 |
| kPig | 0.7 | 颜料随水释放系数 |
| kDry | 0.35 | 干笔刮擦留色系数 |
| kBreak | 1.4 / γ: wet 1.5, dry 0.8 | 飞白强度与陡度 |
| kWick | 0.3 / kDilute 0.15 | 湿纸吸水/稀释 |
| kStiff | 0.35 / τ(splay) 0.4s | 毛阻尼 / 展宽迟滞 |
| kAbsorb | 0.6 | 湿纸吸收衰减 |

**vision 终审（9 格）**：① 四支笔身份（同一路径）② 单笔湿→干连续谱 ③ 快/慢因果 ④ 犹豫成洼 ⑤ 转角刮痕 ⑥ 平头双轨边 ⑦ 一笔多色渐变 ⑧ 湿接湿稀释 ⑨ 一笔之内干燥。目标：物体笔触从 vision 的 4-5 分进入 6.5+，且①②⑤⑥⑦ 五格"像手画的"成立即算 v2.0 达标。

## 12. 非目标与已知限（诚实）

- 不做：逐根毛物理/墨珠、全流体 NS、颜料粒重分离（P2）、调色盘涮笔对象（v2.1）、笔外世界。
- 已知限：慢笔早枯是物理事实——长笔画必须短（agent 笔序要写短笔、勤蘸笔）；interleave 的时间压缩率按笔画长度固定（90 步），超长笔画的前后干燥差会饱和；脏笔吸色未落地前，湿接湿只稀释不染色。
- 精读复核发现的引擎侧问题:① 沉积率高度符号反(`1+expo·(H−0.5)` → Curtis 应为 `1−σ·H`)与 ② `edgeK` 阶段恒 no-op——**已由 M0 会话在 `src/core/engine.js` 修复**(bugfix 注释引 Curtis 精读复核,2026-08,工作区);③ 无解吸项(lift/湿接湿的纸侧因果根缺失)与 ④ backrun ≠ "掩码扩张+边缘先干"(是毛细层容量扩散,我们的 re-wet 是自创算子,不应挂 Curtis 名)——仍待 medium-upgrade。详见 `research/curtis1997-close-reading.md`。
- 时域相干警示(Bousseau 2006 §2,见 `research/bousseau2006-close-reading.md`):"扩散必破坏时域相干"——我们的半拉格朗日+拉普拉斯是时域脆点,drying_timeline 帧间跳变是扩散+离散采样的**固有产物**,不是渲染 bug。缓解三件(Phase 2 前必须):① 特征生灭连续化(frontDeposit/bloom 一步钉死 → 2-3 步 ramp);② M0 静止短路重启加 2-3 步淡入(硬切换正是论文要消的离散跳变,归 perf 工作流);③ 层级+reveal 时间模式(Zheng 2017 附录 F)。
- Montesdeoca 2017 精读的 medium-upgrade 侧指针(见 `research/montesdeoca2017-close-reading.md`):① 纸坡 ∇H 入 M1 流场(现仍用 G 噪声顶替);② render 线性边缘项改指数+可变宽(抄 NPAR §3.1);③ M4 干笔改峰值阈值 split(抄 NPAR §4.1);④ bleeding 蓝图(湿门 joint-bilateral)给 P2;⑤ **验收口径整体切换:像素差 → vision+探针**(M0 已破逐位一致)。

## 附录 A：数值探针原始数据（摘要）

| 探针 | 关键数 | 结论 |
|---|---|---|
| reservoir ① | v=0.05 → dtRaw 3.33s；无钳 wLoad=−0.008、Σdw=0.808>0.8 | dt 发散击穿，必须 dtMax+守恒钳 |
| reservoir ② | 慢笔 s≈0.35 耗尽、尾 gb=0.69；快笔 s≈0.3 gb=1.0、尾 wLoad=0.016 | 配方参数必须经探针调校；gb 公式重平衡 |
| reservoir ④ | 30 戳 → 12-13 个分桶组合 | v1"≤8 次沉积"更正为 ~13 |
| interleave ① | 60px@0.9=1.1s；180px@0.4=7.5s；420px@0.15=46.7s（=2800 步） | 1:1 交错不可行 |
| interleave ②③ | budget=90 → 前段失水 49-60%；场景 +180 步 ≈ +2s（+4%） | 压缩交错可行且便宜 |

## 附录 B：业界调研摘要

全文见 `research/brush-dynamics-survey.md`。采纳：① 湿边浓集（Curtis 启发，归 medium-upgrade B 岸线算子）② 纸齿高场接触阈值（MoXi 式静态场）③ footprint 密度函数/双轨边（DAB/Rebelle 抽象）④ brush 身份参数入协议 ⑤ 水+颜料双层场与负通量（Wetbrush 接口思想）。拒绝：逐刷毛几何、全流体（预算外）。来源 URL 见调研文件。

## 附录 C：对抗评审 punch list 与处置

评审子代理对 v1 的 11 条意见（S0 致命 > S1 严重 > S2 高要求），处置如下：

| # | 意见 | 处置 |
|---|---|---|
| S0-1 | 水/颜料同 mask 耦合 + wetnessAt 不存在 | ✅ §8-4 / §10：depositMask 加 waterMask 缝 + wetnessAt 只读缝 |
| S0-2 | 颜料水库不守恒（pLoad 只读不扣） | ✅ §4：显式 `pLoad -= pRelease` |
| S0-3 | dt=Δs/v 在 v→0 发散 | ✅ §4/§8：vMin + dtMax + 指数释放 |
| S0-4 | 分桶性能断言错误（depositMask 是 O(w·h) 全扫） | ✅ §8-4/§10：更正为 bbox 短路先行、M0 后按戳沉积 |
| S0-5 | 回归锚不可复现（rng 调用序） | ✅ §8-5/§9：legacy 原代码冻结 + per-stroke seed + 映射表 |
| S1-6 | 与 medium-upgrade 撞车（Tx/Ty 未消费、#4 双认领） | ✅ §7：只认领飞白子项、依赖 M1/M0 |
| S1-7 | 无 intra-stroke 时间交错 | ✅ §6：interleave 探针定价（+4% 换一笔之内的时间） |
| S1-8 | 协议不自洽（load/capacity/water 三处同名异物、speed 标量数组） | ✅ §9：命名归一 + speed 数组化 + 映射表 |
| S1-9 | 验收不可证伪（无数值代理、六常数无初值） | ✅ §11：统计代理 6-9 + 常数初值表 |
| S2-10 | 空间水库/脏笔/毛层缺失 | ✅ §3/§4：N 毛模型 + 深度桶 + pickup（脏笔排 v2.1） |
| S2-11 | LLM 可写性（裸数组、speed=0 陷阱） | ✅ §5/§9：verb 词汇 + 校验规则 |

评审提出的"v2 必增 7 章"全部落入本稿：沉积接口改造（§8-4/§10）、守恒与 dt（§4）、可复现契约（§8-5/§9）、时间调度（§6）、medium-upgrade 对齐（§7）、协议 v0.3（§9）、数值验收与常数表（§11）。

## 附录 D：Curtis 1997 原文精读复核（摘要）

全文与逐项对照见 `research/curtis1997-close-reading.md`。与本设计的净影响：

1. **Curtis 不建模笔**（交互=高斯笔涂注入,自动笔刷=区域场注入;bristle 模型原文明言是 future work）——我们的"笔 = 弧长状态机 + 水库 + N 毛"是原文空白区的自创,不冲突;笔的动力学**只有 DiVerdi 2010 一家直接蓝本**(抄抽象:非惯性系/毛厚覆盖/宽度接线/pickup 消耗;拒 DER 求解,见附录 J),其余全靠 brush-lab 数值断言 + vision 自己证。
2. 干笔纸齿阈值(签名 #12)拿到原文背书(§4.7 / 专利 claim16)。
3. 两处已本地核验的引擎 bug(归 medium-upgrade):沉积率高度符号反、edgeK 阶段恒空转(§12 已知限)。
4. 可抄清单按性价比:解吸项 > 高度符号修正 > FlowOutward > 纸坡 ∇H > density α > 两常数 KM。

## 附录 E：Wetbrush 2015 原文精读复核（摘要）

全文与逐项对照见 `research/wetbrush2015-close-reading.md`。与本设计的净影响：

1. **纠错**:v2 §3 原先"抄 DAB/Wetbrush 的密度函数思想"是误认——Wetbrush **无**脚印密度函数(明言不用 stamp map),"边缘浓中间淡 1.3-1.6 倍"出自 **DAB**;已改归因。"腹池+毛缘"与 Wetbrush"粒子+密度场"**不同构**(我们按湿/干语义切分、永不互转;他们按距毛远近切分同一液体、可互转)——只作直觉借用,不作机制依据。
2. **采纳**(已折入正文):β 非惯性旋钮(§3 滞后定标)、吸放阈值 ε=0.1 迟滞(§4)、位置式混合替代刚力 pickup(§4)、RYB 亮度混合(记入 color 线 backlog)。
3. **诚实界**:N=4-32 毛是 2D 感知代理,出不了 Wetbrush 级亚像素脚印(40-600 毛 ×128 采样 + 20 万粒子)——与"不做逐根毛物理"的定位一致,不追。
4. **拒绝**:FLIP/PIC 粒子、不可压压力投影、固定点 Jacobi、逐根毛采样、3D 体渲染——GPU 专属或预算外;水彩的纸吸收/毛细/蒸发/粒重是 Curtis 路线的活(论文 §8 自列 watercolor+percolation 为 future work)。
5. 顺带验证 v2 §6:论文"油彩高粘、笔走液止"→ 戳间液体近似冻结,支持压缩交错只对蒸发上粗调度、无需流体子步。

## 附录 F:Zheng 2017(Example-Based Brushes)精读复核(摘要)

全文见 `research/zheng2017-close-reading.md`。净影响:

1. **路线正交**:屏幕空间风格化与我们介质模拟不兼容,但其"弧长为规范轴(纹理与路径几何解耦)"与"层级纹理 + 连续 reveal 的时间相干模式"是可抄的表示层思想;
2. **采纳**:弧长规范轴(独立佐证我们水库/毛层已按弧长参数化;利 Phase 2 回放);层级+reveal 模式 ↔ §6 压缩交错与 drying_timeline 动图实现;纹理层"拉直—合成—rib 映射"(v2.1+,压力调宽不拉伸纹理,已记 §5);
3. **拒绝**:扫描笔触库、HoG+Poisson 调色、压力→宽度调制、屏幕空间管线;
4. **警示**:其 brush 属性比我们协议还薄、其时间相干是几何变形相干非物理干燥——不可当富属性模型或物理依据抄。

## 附录 G:Bousseau 2006 精读复核(摘要)

全文见 `research/bousseau2006-close-reading.md`。净影响:

1. **前提纠错**:该文**无**湿度驱动扩散模型(明言拒绝流体模拟),是静态图像滤波管线——不能当"扩散+时域"的依据抄,只能抄其**特征生灭连续化**原则;
2. **采纳**:① 特征生灭 2-3 步 ramp(frontDeposit/bloom 一步钉死改渐变,归 medium-upgrade);② M0 静止短路重启加淡入斜坡(归 perf 工作流);③ 密度参数 d 统一渲染接口(替代 edgeDarken/granShade 魔数,归 render/color 线);④ 抽象先行单帧校验(归 Phase 1 agent 层);
3. **修正 §6**:interleave 预算从定值封顶改按弧长连续分配 + 软上限(已改);
4. **哲学警示入 §12**:"扩散必破坏时域相干"——drying_timeline 跳变是扩散+离散采样的固有产物,Phase 2 前必须上三项缓解。

## 附录 H:Montesdeoca 2017 姊妹篇精读复核(摘要)

全文见 `research/montesdeoca2017-close-reading.md`。净影响:

1. **坚持 FlowOutward,不抄其静态边缘**:他无透明带/水线/浅线三层、无时间演化——M2 岸线算子必须走 Curtis 输送路线;只抄"宽度/强度分离 + 指数变暗"进 render 缝;
2. **granulation**:他纯着色、我们质量守恒(更近 Curtis);高度符号两侧已修,不再动;净抄 NPAR 峰值阈值 split 给 M4 干笔;
3. **渗色 ≠ bloom**:两篇都没实现 backrun,M3 曲率驱动是自创;bleeding 蓝图(湿门 joint-bilateral)抄给 P2;
4. **验收口径切换**(已改 §9/§11):M0 破逐位一致 → 回归判据从像素差改为探针 + vision;
5. 其余 medium-upgrade 侧指针(纸坡 ∇H、render 指数边缘、干笔峰值阈值)已记 §12。

## 附录 I:MoXi 2005 精读复核(摘要,归 medium-upgrade M1 消费)

全文见 `research/moxi2005-close-reading.md`。净影响:

1. **M1 方案要改主机制**:MoXi 根本没做方向场——它的各向异性来自**标量变渗透率 κ + pinning 阈值 σ 钉扎 + 速度依赖阻滞**;我们的 Tx/Ty 角度场是更强的表示,但若只靠 kD∥/kD⊥ 扩散张量落地会退化成**木纹滤镜**——§A-2 应降为辅助,主机制换 σ 钉扎 + κ 变渗透率;
2. **必抄三件**(式号见精读文件):σ 钉扎阈值(治愈圆润前沿)、容纸度 max(1−ρ/λ)(浅边晕)、SIMULATEHINDRANCE 阻滞(pigAdv 按 |u| 与纤维夹角打折 = 方向颗粒的物理版);
3. **冻结改渐变固着**(SIMULATEFIXTURE):W<ε 二值冻结 → FixFactor 渐变,"颜料随纤维滞留"才成立;
4. 拒绝 LBE 本体与双层储水(半拉格朗日 + 单 W 场已够);
5. 注意:MoXi 是墨(单色)模型,多颜料水彩的絮凝/粒重仍属 P2,无文可抄。

## 附录 J:DiVerdi 2010 精读复核(摘要)

全文见 `research/diverti2010-close-reading.md`。净影响:

1. **笔的动力学唯一工业蓝本**:毛 = DER 隐式求解(预算外,拒),但四个抽象全部采纳——非惯性系只留速度(验证 lagCoef 实现)、毛厚反比根数保覆盖(毛缘线宽规则)、width=f(p,spring) 接线(§9 已写)、pickup 独立消耗(v2.1 脏笔);
2. **三处归因/表述修正**(已改 §3/§9/附录 D):β=1 是"全滞后"非"全物理";毛缘 1.3-1.6× 是 DAB 独家(第三家确认无密度函数);splay 迟滞是我们的感知代理(替他砍 O(N²) 毛间碰撞),非抄他;
3. **实现建议**:腹池/毛缘不硬切双 mask,用"有效毛厚"随 gb 单轴过渡(§3 已写);
4. 拒绝:DER 求解、连续碰撞、隐式雅可比、3D 倾角、矢量扫掠包络、多核管线、塑性 reset 工作流(艺术家嫌 confusing)。
