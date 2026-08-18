# Curtis 1997 精读复核（brush 分支,对 v2 笔刷动力学与引擎现状的原文对照）

> 材料:`research/papers/medium/curtis1997.pdf`(UW 官方 paper_small 版,文字完整)+ `research/papers/medium/us6198489-curtis-patent.txt`(同模型专利全文,交叉验证)+ `research/papers/medium/curtis1997.txt`(提取文本)。
> 方法:子代理原文精读 → 主代理对两处"可验证代码事实"本地复核(已确认)。行号以复核时的 M0 工作区 `src/core/engine.js` 为准,行号会漂,以表达式为准。
> 结论口径:本文只记录与**笔刷动力学 v2** 相关的部分;介质引擎的修复建议归 `medium-upgrade` 分支,不在本分支动 `src/core/`。

## 1. 模型骨架(用我们引擎的术语复述)

Curtis 1997 = **有序 glaze 集合**,每层 glaze 独立跑三层流体模拟(§3、§4):

1. **浅水层**:staggered 网格动量方程 `∂u/∂t = −(∂u²/∂x+∂uv/∂y) + μ∇²u − ∂p/∂x − ρu`(§4.3.1);`RelaxDivergence` 消震荡(§4.3.2);**FlowOutward 边干**(§4.3.3)——边缘减水压 → 向外流 → 颜料被持续运到边缘沉积;
2. **颜料层**:upwind 通量平流(§4.4,**随水同速、无滞后**)+ 双向吸附/解吸(§4.5):吸附 `ε_down = α·g·(1 − σ·h)`,解吸 `ε_up = (α/ω)·d·(1 + (h−1)·σ)`;
3. **毛细层**:仅 backrun 用,容量 c 驱动扩散 + 掩码扩张(§4.6)。
4. 渲染 = **两常数 KM**(K+S,白/黑底反演)逐层复合(§5)。
5. **无显式全局蒸发**——干燥 = 边干 + 毛细吸收。我们的 evap + freeze 是自加。

## 2. 逐项对照(判定:✅等价 / 🔶近似 / ❌缺失 / ⚠️理解错了)

| Curtis 机制 | 我们实现 | 判定 |
|---|---|---|
| 动量 + μ∇²u + 纸坡 ∇h(§4.3.1) | u = −∇W·kPress + 重力 + G 噪声扰动 | 🔶 简化版;丢 ∇²u/散度松弛;**纸坡 ∇H 未用,G 噪声顶替** |
| 颜料 upwind 随水同速(§4.4) | 半拉格朗日,pigAdv 0.65 < 0.9(滞后) | 🔶 换方法 + 自加滞后(非原文) |
| 吸附 `α·g·(1 − σ·h)`(§4.5) | `depScale·(1 + expo·(H−0.5))·(1 + granScale·(F−0.5))` | ⚠️ **高度符号反了**(纠错 #1) |
| 解吸 `(α/ω)·d·(1 + (h−1)·σ)`(§4.5) | 无解吸(只有 liftMask 显式算子) | ❌ 缺失 |
| 边缘加深 = FlowOutward 减水压(§4.3.3 eq3) | frontDeposit + edgeK + 渲染侧 edgeDarken | ⚠️ 机制不同 + **edgeK 阶段恒空转**(纠错 #2),真实深边只剩渲染侧 |
| backrun = 毛细层容量扩散(§4.6) | re-wet/bloom 显式搬运 + 阈值掩码扩张 | ❌ 无毛细层;⚠️ "backrun = 掩码扩张+边缘先干"是误解(纠错 #3) |
| 干笔 = 纸高 > 阈值只触峰(§4.7,专利 claim16) | v2 `contact = H > hThr(gb)` | ✅ 方向对(原文本就是这个思想) |
| 两常数 KM(K+S)(§5) | 单常数 KM(仅 K) | 🔶 有意简化(ΔE 3.2 有据) |
| 密度 α(轻重颜料分离)(§4.5) | 无 density 字段,靠 pigAdv 滞后冒充 | ❌ 缺失(P2 的 mass 字段) |

## 3. Curtis 的"笔"(对 v2 最重要的一个结论)

**原文不建模笔。** 交互绘制 = 圆形高斯笔涂注入初始 g/p/M(§6.1);"自动笔刷" = 区域场注入(太淡处加颜料+水、太深处只加水,跑 3-10 步,δ×0.5 精化,重复 2-5 次;§6.2,专利 col.18 L1010-1036)。**没有 brush 对象、压力、速度、水库、毛**。§7 与专利 col.3 明言 bristle 笔刷模型是 future work。

→ 我们的"笔 = 弧长状态机 + 水库 + N 毛"是**原文空白区的自创**,不冲突:两条路最终汇入同一组场(depositMask),相容。这也说明笔刷动力学的正确性不能靠 Curtis 背书,只能靠 brush-lab 数值断言 + vision 终审(§11 的验收口径不变,反而更重要了)。

## 4. 可抄清单(性价比序)

1. **解吸项** `ε_up = (α/ω)·d·(1 + (h−1)·σ)` —— 洗色/湿接湿/边缘迁移的因果根,我们最贵的缺口;medium-upgrade B(岸线算子)应有此式做依据。
2. **高度符号修正**:吸附改 `(1 − σ·H)` —— granulation 落谷立刻成立(当前代码注释说"纸谷偏置"却反着做)。
3. **FlowOutward** `p ← p − β·(1 − blur(M))·M`,β ∈ [.01,.05] —— 比"钉边"便宜的持续向内流,岸线算子 B 的原文依据。
4. **纸坡 ∇H 入流场**(替换 G 噪声扰动)—— 纸纹因果,零成本。
5. **density α 字段** —— 颜料分离(已在 P2 backlog 的 mass)。
6. **两常数 KM(K+S)** —— 不透明/干涉颜料(印度红、紫类)需要,留作色彩线远期。

## 5. 纠错清单(两处已本地核验 ✅)

> 状态更新(2026-08):①② 已由 M0 会话在 `src/core/engine.js` 修复——沉积段改 `1 − expo·hb`;edgeK 段改 `e = M − blur(M)` 内侧边带(bugfix 注释引用本报告纠错 #2)。③④ 仍待 medium-upgrade。

1. ✅ **沉积率高度符号反**。`engine.js` 沉积段:`hb = H[i]−0.5; kk = depScale·(1 + expo·hb)·(1 + granScale·grain)`——H>0.5(纸峰)时 kk 更大 → 峰多沉积。Curtis 是 `1 − σ·h`(谷多吸附)。且段注释自称"纸谷偏置"。**真 bug,归 medium-upgrade 修。**
2. ✅ **edgeK 阶段恒 no-op**。`if (!M[i]) continue;` 只留 M=1 格 → `e = Mb[i] − (M[i]?1:0) = Mb[i] − 1 ≤ 0` → `if (e <= 0.02) continue;` 永远跳过。edgeK=0.45 从未生效;渲染侧 edgeDarken 是唯一深边。同理蒸发段的 evapEdge/拉边只作用于 M=0 的 0<W≤θ 外沿格 → "咖啡环弱而均匀"的解释。**真 bug,归 medium-upgrade 修。**
3. ⚠️ "backrun = 掩码扩张 + 边缘先干"是误解:backrun 是毛细层容量 c 驱动的分支扩散(§4.6);我们的 re-wet 显式搬运是自创算子(质量守恒方案仍然成立,但不应挂 Curtis 名)。
4. ⚠️ 边缘加深归属答错:Curtis 是纯模拟侧(压力流);我们是模拟(近失效)+渲染双轨。engine-js.md 如实写了"渲染侧",但不应把 edgeDarken 标为"抄对 Curtis"。
5. ⚠️ pigAdv 滞后(0.65)非原文;Curtis 颜料随水同速,分离靠 α/σ。滞后是自加启发(有其感知价值,但应诚实标注来源)。
6. ⚠️ staining 映射错位:Curtis staining ω 降**解吸**(更永久);我们加到**吸附率**(0.4+1.2·stain)——方向同(都更永久)但机制错,且无解吸使染色无法动态重溶。

## 6. 对 v2 笔刷动力学的净影响

- 方向不变、验收口径不变(v2 §11);"笔"是自创区,无人可抄、只能自己证。
- v2 §7 对"湿边浓集归 medium-upgrade B"的表述需修正:依据从"引擎已有 edgeK"改为"Curtis FlowOutward 原文(且当前 edgeK 空转,真实深边只有渲染侧)"。
- 干笔纸齿阈值(签名 #12)拿到原文背书:§4.7 / 专利 claim16。
- 解吸项缺失顺带解释了 v2 §4 的湿接湿稀释需要"笔侧负通量"来兜底——纸侧若能解吸,笔侧压力会小很多。两件事不冲突,但值得在实现 v2.1 时对照。

## 7. 网络获取方法(环境备忘)

本沙箱 Windows PowerShell 5.1 的 .NET 网络栈对外 HTTPS 全面失效(连接被关闭),**Python 3.11 urllib 正常**。可用路径:`research/probes/download-papers.py`(分块读 + 重试)与 `research/probes/extract-text.py`(pypdf 提取,venv 已装 pypdf)。UW 服务器慢,必须分块读并耐心重试;citeseerx / web.archive.org / UBC 从本机不可达(超时/403),Wetbrush 全文需人工下载后放入 `research/papers/medium/wetbrush2015.pdf`。
