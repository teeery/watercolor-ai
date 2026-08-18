# Roadmap

## Phase 0 — 介质引擎尖峰 ✅ 完成（1 个工作日）

- 纯 JS 实现五工件，typed array，零依赖，Node 可跑：`src/engine.js` 等（实现说明见 `docs/engine-js.md`）。
- 手绘 31 笔 demo：湿铺 / 干皴 / 回流开花（清水滴）/ 颗粒沉淀 / 溅点 / 洗色 / 干燥时间线。
- 产出：`out/compare.png`（引擎 vs 平涂对比）+ `out/drying_timeline.gif`（10 秒真实干燥）+ `out/evolution.gif`（作画全过程）+ 特写与阶段快照。
- 门槛评估（vision 独立评审）：整体 6.5/10，背景湿铺 8/10，回流开花特写 6.5-7/10；对照基准 Open-Watercolor-Sim 2.5-3/10（探测记录见 `research/probes/OWS-评估.md`）。**"水是真的"过半，继续 Phase 1；物体笔触品味留待 agent 层解决。**
- 探测结论：8 个候选开源引擎无一可被 agent 直接驱动（均为交互式应用）；借用"算法"（Hobbs/Curtis）而非"程序"的路线得到验证。

## Phase 1 — 接入 LLM（约 1 周）

- **第一刀（已定）**：教学回放 MVP——教不会画的；范围切割与验收见 `docs/teaching-mvp.md`。
- stroke JSON 协议定稿 + 颜料 / 纸预设库。
- 可绘制表征 Z 的 schema v0.1 与简版 Z 编译路径（意图与笔序的中间层，见 `docs/paintable-representation.md`）——延展方向，第一版不要求全套。
- dsh-studio 循环骨架移植（阶段制、预算、keep-best、诚实守则）。
- vision 阶段批评接入；限流降级路径。
- 交付：一个从"一句话"到"完整水彩 + 时间线动图 + gallery"的端到端 demo。

## 可画性基准（前置于 AI 优化，引擎侧）

> "先证引擎可画，再让 agent 优化"——详见 `docs/paintability.md`。此前漏掉的核心问题：动作集合与介质动力学能否稳定产生目标图像（控制论：可控性 / 介质可达域）。

- 十个正交基元（直线/尖叶/T 接/边缘谱/渐变/罩染/条纹/负形/湿中边界/干燥保真）+ oracle 最优笔触搜索，测目标→最终干画最低误差；
- 每基元一张成绩卡（目标 | 最优干画 | 误差 | 失败模式）；失败项转 engine.md backlog——oracle 画不出的，锅在引擎不在 agent；
- 交付：`demo/paintability/` 运行器 + `out/paintability/` 成绩卡 + 展示说明页；
- 与 Phase 1 顺序：教学 MVP 不动引擎、可先行；agent 循环上线前必须出第一版基元成绩。

## Phase 2 — 产品化

- 时间线录制 / 回放 / 暂停；用户参与钩子（阶段间提问、亲手加一笔、换纸重渲染）。
- 8K 重渲染；recipe（stroke 源码）导出 / 分享。
- 作品挂进 dsh 会话（attachments）。
- 独立仓库命名与发布（候选：`dsh-aquarelle`）；install.md 镜像 dsh-sight 形态。
- 选题策略：先风景 / 静物出 demo（人物是翻车重灾区）。

## 开放问题

- 颜料库参数来源（手调 vs 借鉴公开水彩颜料数据）
- 纸纹资产（程序化 vs 贴图）
- 性能预算（1280×960 半分辨率模拟的帧耗时）
- 引擎运行位置（host Node vs 浏览器）与 dsh 集成方式
