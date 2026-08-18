# 双会话协作契约(brush 会话 × medium-upgrade 会话)

> 本文件是给两个并发会话看的**共享工作区规则**,目的:隔离并行、零冲突、可追溯。
> 现状验证:两个会话已在同一工作区、同一 `brush` 分支上并行提交 15+ 个 commit,历史线性零冲突——此契约把已验证的做法固化成文字。
> 2026-08-17 起双会话已合并为单线开发,本契约作为协作方式的文字记录随 v0.3.0 存档于 `docs/`。

## 1. 目录所有权(谁的文件谁动)

| 路径 | 所有者 | 说明 |
|---|---|---|
| `src/brush/`、`docs/brush-dynamics.md` | **brush 会话** | 笔刷动力学 v2 设计与实现 |
| `research/*.md`、`research/*.txt`、`research/probes/`、`demo/*-probe.js`、`demo/*-test.js` | **brush 会话** | 文献精读归档、探测残料、数值探针与冒烟测试 |
| `src/core/`、`src/paper/`、`docs/medium-upgrade.md`、`docs/engine-js.md`、`demo/bench.js` 等 | **medium-upgrade 会话** | 介质核心、纸纹、性能 |
| `src/color/`、`docs/*color*` | **color 会话** | 颜色系统 |
| 其余共享文件(`docs/engine.md` 等) | 先到先改,改前读最新 | 交叉引用类小编辑 |

## 2. 提交纪律(硬规则)

1. **永远 `git add <具体路径>`,禁止 `git add -A` / `git commit -a`**——不扫走别人的未提交工作;
2. **禁止 `git switch` / `git checkout` / `git clean` / `git reset --hard`**——两个会话共用这一个 checkout,切分支会把对方未提交的改动带走或撞车;
3. 提交前 `git status --short` 一眼确认要提交的就是自己的文件;
4. commit message 前缀标明归属:`brush:` / `perf(Mx):` / `fix(core):` / `color:`。

## 3. 接口接触点(跨目录的显式约定)

| 接触点 | 约定 |
|---|---|
| `src/core/engine.js` | brush v2.0 实现**暂不改引擎**——`wetnessAt` 直接读 `engine.W`/`paper.C` 实现;`depositMask.waterMask`、`pickupAt` 由 medium 会话落地后 brush 再消费 |
| `src/paper/` 的 Tx/Ty、σ 钉扎、κ | 由 medium 会话按 `research/moxi2005-close-reading.md` 落地;brush §7 只消费 |
| `src/brush/strokes.js` | 归 brush 会话;medium 会话不碰 |
| 文档交叉引用 | brush 会话只在自己文档里写指针,不直接改 medium 的文档 |
| **干笔 × σ 钉扎/宏观侵蚀(跨会话 TODO)** | medium 的 M1/M2 按"水量门槛"拒收低水笔触(σ 拒新湿格、macroMinWater 蚀除),会整段吃掉干笔/飞白。物理上干笔是"低水高颜料",门槛应看"颜料通量"而非水量。待 medium 会话调;期间 brush-lab 面板用 `params:{sigma0:0, macroCut:0}` 隔离验收 |

## 4. 分支策略(现状即最优)

- 两个会话**共用一个 `brush` 分支单线推进**:引擎先行(M0 已落)、笔刷后行(v2.0 实现),线性历史无需合并;
- 若将来必须分线:先清空各自未提交工作,再 `git worktree add -b <新分支>` 建第二个 checkout(注意:同一分支不能同时 checkout 在两个 worktree,分线必须换名);
- 合并点由人(用户)决定,不在会话内自动合并。

## 5. 消费链(已验证的工作模式)

brush 会话产精读报告(`research/*-close-reading.md`)→ medium 会话读报告落地修复(例:`6b2859f fix(core)` 引 Curtis 精读)→ 修复改变验收口径 → brush 会话同步文档(例:验收口径像素差 → vision+探针)。**保持这个方向,不要互相直接改对方的代码。**
