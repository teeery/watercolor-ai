# 前辈调研：水彩介质引擎与流体求解（对我们的借鉴分析）

> 结论先行：**有帮助，且帮助分层**。Tyler Hobbs 指南是本项目 Phase 0 的头号参考资料（它验证了我们"感知签名、不做物理"的整个路线）；Rebelle/Expresii 用来定验收标准而不是被抄；底层求解库全部列为升级路径，不进 v0；四个"开源引擎"里有两个查无实据。另外，sudoaquarelle 证明"AI × 水彩模拟"方向已有先行者，但**没有一个是 agent 画家**——空象限仍空着。

## 一、闭源标杆：定"像真的水"的验收线，不抄

| 产品 | 底细 | 对我们的意义 |
|---|---|---|
| **Rebelle**（Escape Motions，闭源） | 真实颜料/纸张物理：扩散、颗粒聚集、rewet、倾斜水流。证明"介质真实可以卖钱"，也证明这是研究组级投入 | 它是我们的**感知上限参照物**。我们的验收标准写成"观众第一反应是水是真的"，Rebelle 就是那个"真"的定义。它的 pigment 属性面板（granulation/staining）也是我们颜料预设库的字段来源 |
| **Expresii**（Nelson Chu，闭源） | 学术血统：HKUST 博士论文 "Making digital painting organic"，SIGGRAPH 2005 论文 **MoXi**（Lattice Boltzmann 实时墨水扩散），GPU 加速 | MoXi 是**回流开花类现象最正统的公开算法源头**。我们不抄闭源代码，但 MoXi 论文公开——若 v0 的元胞规则回流不够像，LBM 是升级路径 |

**两位的共同弱点（我们的机会）**：都不会自己构图，只等一只手。没有 stroke 级结构化协议，没有时间线叙事产品，没有 agent。这就是 README 里"除法"的立身之处。

## 二、开源引擎逐个分析

### 1. Tyler Hobbs 指南 —— 最重要，直接照着学
[A Guide to Simulating Watercolor Paint with Generative Art](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art)

- 路线与我们完全同构：**不求解 NS 方程，用程序化手段伪造感知签名**（多边形颜料块 + 噪声形变 + 边缘深线 + 颜料颗粒纹理 + 纸纹）。
- 与五个工件的映射：湿扩散（形变模糊）→ 工件 1；边缘沉积（它有专节）→ 工件 2；颗粒聚集（pigment texture 专节）→ 工件 4；纸纹处理 → 开放问题"纸纹资产"的程序化答案。
- 结论：**Phase 0 实现工件 1/2/4 时人手一份**。它没做的是：真实回流开花、真实干燥时间线——这两个恰好是我们的护城河工件。

### 2. Paint-Splatter（Swift Metal）
[github.com/CalebKierum/Paint-Splatter](https://github.com/CalebKierum/Paint-Splatter) —— "Simulates watercolor paint that splatters and mixes in real time using a shader. Tutorial inside."

- 价值在**教程**（shader 里怎么做溅点混合与边缘堆积的思路），不在代码：Swift/Metal 无法直接移植进我们的 JS 引擎。
- 判定：**学思路，不抄代码**。适合实现 `spatter` 笔型时参考。

### 3. Open-Watercolor-Sim（Taichi，Python）
- PyPI 上有此包（[piwheels 镜像](https://www.piwheels.org/project/open-watercolor-sim/)），Taichi 实现，应是某篇实时水彩论文的复现/封装（同领域公开论文还有 IEEE 2017 "Real-Time Watercolor Simulation with Fluid Vorticity Within Brush Stroke"、TAMU 硕士论文 "GPU programming for real-time watercolor simulation"）。
- 判定：**存为学术参考**。栈与我们冲突（Taichi/Python 进不了 Node/browser 引擎），不值得为此改栈；但它的效果视频/论文是回流工件（工件 3）的对照物。

### 4. Watercolor_simulation（Godot + Compute Shader）—— 查无实据
- 未找到这个确切仓库。GitHub 上真实存在的是若干 Godot 水彩 shader（如 [AleksLitynski/WatercolorShader](https://github.com/AleksLitynski/WatercolorShader) 及 Godot Shaders 站的同类条目），都是单 pass 风格化着色器，不是模拟引擎。
- 判定：**按不存在处理**。若有确切仓库链接，可补一轮分析；即使存在，Godot shader 也无法直接进 JS 引擎，价值上限是 shader 技巧参考。

### 5. Syntic（Haskell）—— 查无实据
- 任何渠道（GitHub/搜索引擎/hackage）都搜不到叫 Syntic 的水彩模拟项目。可能是误传、记忆偏差或极冷门个人仓库。
- 判定：**按不存在处理**。如有链接请提供。

### 6. shuimo-liuyun（WebGL 水墨）—— 查无实据
- GitHub 上找不到该仓库（有同名但无关的 npm 包）。若在 Gitee 或为私人项目，无法核实。
- 判定：水墨与我们的硬笔水彩签名（毛边/回流/颗粒）重合度有限，即使找到，价值上限是**视觉参考**，不是实现参考。不影响主线。

### 7. OpenBrush（Unity，源自 Google Tilt Brush）
[github.com/icosa-foundation/open-brush](https://github.com/icosa-foundation/open-brush)

- VR 笔刷绘画引擎，Tilt Brush 开源分支（宽松许可血统）。它的强项是笔刷系统与笔触存储，**与水彩介质无关**。
- 判定：**跳过**。它解决的"画笔姿态/笔触格式"问题我们用 stroke JSON 协议解决得更贴合 LLM。

### 8. sudoaquarelle.com —— 竞品观察 + 需求验证
[explainx 报道](https://explainx.ai/blog/sudo-aquarelle-claude-code-watercolor-simulator-physics-august-2026)：用 Claude Code 构建的在线物理水彩模拟器（HN 2.9K 赞，含多颜料与实验功能）。

- 三个信号：① "AI 参与水彩"方向有真实需求，且有人已经用 AI 把介质模拟造出来了——**证明 Phase 0 的介质腿是可以在合理时间内站起来的**；② 它是**人手绘工具**（AI 只负责写模拟器），没有 agent 构图、没有干燥时间线产品——我们的空象限未被占据；③ 它说明"纯手绘水彩模拟"正在商品化，我们**必须**押注差异化：agent 自主创作 + 时间即叙事。
- 判定：**持续观察**。不进 roadmap 主线，但每次 Phase 评审时看一眼它有没有长出 agent 和时间线。

## 三、底层求解库：全部列为"升级路径"，不进 v0

| 库 | 是什么 | 判定 |
|---|---|---|
| **Stable Fluids**（Jos Stam） | 半拉格朗日对流求解 NS 的经典算法；GPU 版见 GPU Gems 38 章 | v0 的五个工件都不需要 NS。若将来要"真流体溅落/流动"，从 GPU Gems 38 移植 WebGL2 是后手。**注意：GPU Gems 代码有 NVIDIA 条款，移植要重写** |
| **LiquidFun**（Google，Box2D 粒子流体，BSD） | 2D 粒子流体 | `spatter`/颜料滴落的物理后手。C++，进 JS 引擎要重写；v0 用规则噪声溅点即可 |
| **Taichi**（Apache-2.0） | Python 可嵌入的 GPU 计算框架 | 只有当我们决定"引擎出 GPU 版"才有意义。v0 纯 JS/CPU 大概率够（水彩是软的，半分辨率网格+高斯模糊的算力需求不高） |

## 四、对 roadmap 开放问题的回答

1. **颜料库参数来源** → 已有公开答案：handprint.com（Bruce MacEvoy 的水彩颜料数据库，staining/granulation/dispersion 等属性齐全，业界标准参考）做字段来源，数值手调；Rebelle 的 pigment 面板做字段设计参照。
2. **纸纹资产** → 程序化优先（Tyler Hobbs 已完整验证多噪声纸纹路线），贴图后置。
3. **性能预算** → 半分辨率 CPU 模拟大概率达标；不达标时的后手是 GPU Gems 38 的 WebGL 移植，不是 Taichi。
4. **引擎位置** → 维持"纯 JS、Node+browser 双跑"。所有前辈中没有任何一个跑在 JS 里——这是我们的生态位，也是"浏览器回放干燥时间线"的产品前提。

## 五、诚实标注（查证边界）

- 本调研基于 2026-08 的公开检索；pwsh 直连 GitHub API 被沙箱拦截，个别仓库以搜索引擎结果为准。
- `Syntic`、`shuimo-liuyun`、`Watercolor_simulation (Godot)` 三个仓库**查无实据**，不纳入决策依据。
- 许可红线：只借算法思路（算法不受版权保护），不抄代码；引用代码前逐个仓库核许可（本项目自身会以独立实现为主，天然规避）。
