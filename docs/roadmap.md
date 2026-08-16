# Roadmap

## Phase 0 — 介质引擎尖峰 ✅ 完成（1 个工作日）

- 纯 JS 实现五工件，typed array，零依赖，Node 可跑：`src/core/engine.js` 等（实现说明见 `docs/engine-js.md`）。
- 手绘 31 笔 demo：湿铺 / 干皴 / 回流开花（清水滴）/ 颗粒沉淀 / 溅点 / 洗色 / 干燥时间线。
- 产出：`out/compare.png`（引擎 vs 平涂对比）+ `out/drying_timeline.gif`（10 秒真实干燥）+ `out/evolution.gif`（作画全过程）+ 特写与阶段快照。
- 门槛评估（vision 独立评审）：整体 6.5/10，背景湿铺 8/10，回流开花特写 6.5-7/10；对照基准 Open-Watercolor-Sim 2.5-3/10（探测记录见 `probe/OWS-评估.md`）。**"水是真的"过半，继续 Phase 1；物体笔触品味留待 agent 层解决。**
- 探测结论：8 个候选开源引擎无一可被 agent 直接驱动（均为交互式应用）；借用"算法"（Hobbs/Curtis）而非"程序"的路线得到验证。
- 追加交付（尖峰后演进，过程见 `chronicle/02-04`）：回流算子六版迭代、ribbon/dry-brush/lift 笔触层、KM 单常数渲染、**16 波段光谱颜色系统**（24 色平均 ΔE 5.5→3.2，光谱色卡 8.5/10）、**六部分层重构**（`src/{core,color,brush,paper,io,studio}`，升级缝见 `docs/architecture.md`）。

## Phase 1 — 接入 LLM（约 1 周）

- stroke 协议 v0.2 定稿（`brush`/`motion` 对象、颜料名优先、全默认值；见 `docs/engine.md`）+ 颜料/纸预设数据化（→ `src/assets/`）。
- dsh-studio 循环骨架移植（阶段制、预算、keep-best、诚实守则）→ 落点 `src/agent/`。
- vision 阶段批评接入（rubric、度量、多候选选 1）→ 落点 `src/critique/`；限流降级路径。
- 时间线录制/回放骨架 → 落点 `src/time/`（护城河层，最早值得建）。
- 交付：一个从"一句话"到"完整水彩 + 时间线动图 + gallery"的端到端 demo。

## Phase 2 — 产品化

- 时间线录制 / 回放 / 暂停；用户参与钩子（阶段间提问、亲手加一笔、换纸重渲染）。
- 8K 重渲染；recipe（stroke 源码）导出 / 分享。
- 会话日志过程量化（agent-介质共创曲线，CCSM 式编码移植）→ 落点 `src/session/`。
- 作品挂进 dsh 会话（attachments）。
- 成长层排队：跨会话记忆 + 风格形成（外四环中成本最低、最易被无限推迟；见 `docs/architecture.md`）。
- 独立仓库命名与发布（候选：`dsh-aquarelle`）；install.md 镜像 dsh-sight 形态。
- 选题策略：先风景 / 静物出 demo（人物是翻车重灾区）。

## 开放问题

- 颜料物性模型：粒重/沉降速度 → 湿中分离/絮凝/halo（当前所有通道平流速度相同，永不分离）；实测光谱数据替换程序化近似（替换缝已留，见 `docs/architecture.md`）。
- 笔刷形状库（round/flat/rigger）与 motion 因果耦合（known issue #4：纹理层 → 因果层）。
- 纸纹资产：程序化已上线（高度/持水/颗粒场），三档纹理可选待做。
- 性能预算：640×480 半分辨率模拟 31 笔 ≈ 55-65s；光谱系统慢约 2.7 倍（优化空间见 `docs/engine-js.md`）。
- 引擎运行位置（host Node vs 浏览器）与 dsh 集成方式。

层与目录映射见 `docs/architecture.md`（代码级六部 + 系统级能力层）。
