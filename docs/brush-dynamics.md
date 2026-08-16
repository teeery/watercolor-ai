# 笔刷动力学设计（brush dynamics）

> 回答"笔触还有更多东西吗"：有，缺口集中在**笔的身份**。
> 现在的 stroke 是"形状 + 颜料 + 水量"，没有"用什么笔、装多少水、多快划过"——没有笔的引擎只能**盖章**，不能**画**。
> 本文是 known issue #4（纹理层 → 因果层）的正式解法。落点 `src/brush/`，引擎一行不改（可选加一个只读查询）。

## 一、核心模型：笔 = 沿弧长的状态机

把一笔 stroke 重新参数化为弧长 `s ∈ [0,1]`。一支笔从头画到尾，是一个**状态机沿路径推进**的过程，每推进一步发射一枚戳（stamp）：

```
stamp(s) = {
  x, y, dir,            // 位置与笔向
  width(s),             // 压力 → 足迹宽度
  water(s),             // 水库 → 本次释放的水
  amount(s),            // 水库 → 本次释放的颜料
  grainBreak(s)         // 水库枯竭 → 飞白强度（涌现，不是参数）
}
```

三层状态：

| 层 | 输入 | 状态 | 输出 |
|---|---|---|---|
| 身份层（brush） | `brush.shape/width/capacity/spring/bristle` | 不变 | 足迹函数、容量、裂发特性 |
| 运动层（motion） | `motion.pressure[]` / `motion.speed[]` | 不变 | `pressure(s)`、`speed(s)` 包络 |
| 水库层（reservoir） | 上面两层 + 纸面湿度 | `wLoad`（余水）、`pLoad`（余颜料）**沿程递减** | 每戳的水量与颜料量 |

前两层决定"这是一支什么样的笔"，第三层决定"这一笔从湿画到干的过程"。**这才是"画"与"盖章"的分界**。

## 二、笔的身份（brush 对象）

```js
brush = {
  shape: "round" | "flat" | "wash" | "rigger",  // 足迹函数
  width: 18,          // 基准宽度（px，网格坐标）
  capacity: 1.0,      // 持水量 0..2（相对 width²，毛发多 → 大）
  spring: 0.7,        // 压感：pressure → 宽度展宽的响应
  bristle: 0.3,       // 分叉倾向：干笔时沿笔向裂成几股（排线感）
}
```

四支笔的身份差异（同一路径、同一颜料，画出来必须像四支不同的笔）：

| shape | 足迹 | 宽度-压力 | 容量 | 干笔特征 |
|---|---|---|---|---|
| round 圆头 | 泪滴（头圆尾尖） | 展宽明显 `p^0.5` | 中 | 碎点、单股 |
| flat 平头 | 矩形斜刃 + 边齿 | 几乎不展宽 `p^0.2` | 中 | **平行发丝沟**（排线） |
| wash 大排刷 | 宽矩形 + 弧形腹 | 不展宽 | **大** | 宽排线、整幅留痕 |
| rigger 勾线笔 | 细长发丝 | 不展宽 | **小** | 快速枯竭成虚线 |

足迹函数的签名：`footprint(stamp, mask)` —— 与现有 `_stampEllipse` 同构，只是几何不同。发丝沟 = 沿笔向的几道稳定通道场（**每支笔实例生成一次**，播种自 brush 身份，不随机游走），干笔时 `mask ×= channel(paper.F 调制)`，这就是"这支笔的指纹"。

## 三、运动层：pressure / speed 包络

`motion.pressure = [0.3, 1.0, 0.1]`（3-5 个控制点，LLM 友好）→ 沿弧长插值成 `pressure(s)` 包络（现有 ribbon 的 rise/fall/belly 包络推广成通用控制点版本）。

- `pressure(s)` → 足迹宽度 + 水释放率（压得越重、放水越多）。
- `speed(s)`（0..1，1 = 快）→ 每戳接触时间 `dt = spacing / v`。
  - 慢 = 接触久 = **积墨成洼**（犹豫处自然出深水坑）；
  - 快 = 一掠而过 = 留水量少 = **自然出枯笔**。
- 收笔提尖：`pressure < pLift(≈0.15)` 时足迹宽度线性收尖到点——`radiusEnd` 从"参数"变成"压力曲线尾端"的因果结果。
- 旧 stroke 无 motion 时，合成默认包络 = 现 ribbon 的 rise 0.22 / fall 0.30 / belly 0.18 —— **旧 demo 一帧不变地兼容**。

## 四、水库状态机（核心方程）

```
每戳（弧长步 Δs = spacing·width，dt = Δs / v）：
  p = pressure(s),  v = speed(s)
  Δw = kRelease · p · dt · (wLoad / cap)          // ① 释放：压力×接触时间×余量
  wLoad -= Δw

  paperWet = engine.wetnessAt(x, y)               // ② 纸面反馈（只读查询）
  wDep = Δw · (1 - kAbsorb · paperWet)            //    湿纸吸不动 → 少进纸
  wLoad += kWick · paperWet · p · dt              //    笔从纸上吸回水（湿接湿变稀的因）
  pLoad -= kDilute · paperWet · p · dt            //    颜料被纸上水稀释

  amount = pLoad · load.pigment.amount · p^α      // ③ 颜料随余量递减
  grainBreak = clamp(kBreak · (1 - wLoad/cap) · (0.4 + 0.6·v), 0, 1)   // ④ 飞白涌现
```

**飞白不再是 stroke 类型**，而是水库枯竭的必然结果：一笔长扫笔，前段饱满湿铺 → 中段薄 → 尾段枯笔飞白。`wet-wash` 与 `dry-brush` 从"两种物理"降级为"同一连续谱的两端"。

湿纸反馈（②）把现有的 `glaze = water×0.7` 参数 hack 换成因果链：湿纸上再画，笔被稀释、边变软、色变淡——因为**笔把纸上的水吸走了**，下一戳自然更稀。这是 wet-on-wet 的因果基础，也是将来"笔脏了/混色了"的挂载点。

## 五、stroke 类型降级为配方（recipe）

`apply()` 里的 switch 不再分支物理，只查一张配方表：

| type | 预设 brush | 预设 load.water | 预设 motion |
|---|---|---|---|
| wet-wash | wash 或 flat，capacity 高 | 0.8 | 慢、压力平 |
| glaze | flat，capacity 中 | 0.4 | 慢 |
| dry-brush | round，bristle 高 | 0.15 | 快、压力抖 |
| spatter / re-wet / lift | 不经过水库（维持现有算子） | — | — |

- 显式写了 `brush`/`motion` 的 stroke 覆盖配方 —— **LLM 想控制什么就写什么，不写用配方**（延续协议"全默认值"原则）。
- `region` 型湿铺统一为"大排刷蛇形填充路径"的简写（brush 层合成往返路径，agent 无感）——区域与路径两种湿铺从此共用同一个水库。
- 旧 `scene.js` v0.1 写法（只有 shape+颜料+water）走配方 + 默认包络，**输出不变**（回归之锚：`demo/render-demo.js` 与 `demo/effects.js` 必须逐像素可复现）。

## 六、落地与依赖方向

```
src/brush/
  brush.js      笔预设（round/flat/wash/rigger）+ 配方表（stroke type → brush+load+motion）
  dynamics.js   BrushState：包络插值、水库状态机、沿弧长发射器
  footprints.js 足迹函数（泪滴/平头斜刃/排刷腹/发丝）+ 发丝通道场
  strokes.js    apply() 改为：配方 → BrushState → 发射 → 分桶沉积；保留 blob/spatter/re-wet/lift
src/core/engine.js   +wetnessAt(x, y) 只读查询（W 与 paper.C），零行为变更
```

依赖方向不变、无环：`brush → core(只读) / paper`；`studio → brush`。

**性能预算**：发射器按 `water×amount` 双维分桶（各 ≤8 档，实际每笔 5-8 个组合）→ 每桶一次 `depositMask`。每笔 ≤8 次沉积调用，比现在 strokePath 逐戳调用的常数还小；状态机本身是标量运算。32 笔 ≈ 61s 的总预算不增加。

## 七、验收标准（感知签名，vision 独立评审）

新锚：`demo/brush-lab.js`（8 格面板 + 一张长扫笔特写）：

1. **单笔湿→干连续谱**：一笔 40px 宽、300px 长的扫笔，不换笔不换参数，尾段自然飞白。vision 认得出"这是同一笔从头画到尾"。
2. **四支笔的身份**：同一路径 × round/flat/wash/rigger，像四支不同的笔，不靠颜色区分。
3. **速度/压力的因果**：慢 = 积墨成洼，快 = 枯飞白；改 motion 控制点，画跟着变。
4. **湿接湿的因果**：湿纸上再画，笔变稀、边变软、色变淡（不是参数 hack，是笔吸走了纸上的水）。
5. **回归**：`demo/render-demo.js`、`demo/effects.js`、`demo/color-chart.js` 输出逐像素不变。

## 八、非目标（明确不做）

- 单根毛发级别的物理（毛发弯曲、墨珠动力学）——Rebelle/Expresii 的研究组成果，非感知签名所需。
- 颜料粒重分档、湿中分离/絮凝（P2 backlog，属颜料模型，不属笔）。
- 笔在画外世界里的行为（调色盘蘸水、涮笔）——Phase 1 agent 用"load 预设"抽象代替，将来需要时再立对象。

## 九、为什么这个设计能干掉"盖章感"

现在的假，全因每笔的 water/amount/grainBreak 是**常数**：形状可以有机，但整笔同湿同浓同纹理 → 一看就是贴图。水库状态机让这三个量**沿弧长连续变化且互为因果**（水少 → 飞白多；压力大 → 水多 → 枯得更慢……）。观众的"这是画出来的"感知，来自**同一支笔在一笔之内的连续变化**，不来自更多形状。
