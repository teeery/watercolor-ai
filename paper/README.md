# paper/ 目录说明

本目录是 watercolor-ai 项目成果论文的源稿与配图。论文正文为 `paper.md`，配图在 `figures/`。

## 文件清单

| 文件 | 说明 |
|---|---|
| `paper.md` | 论文正文（Markdown 源稿，中文，含英文摘要） |
| `figures/*.png` | 全部配图（12 幅正文图 + 若干备选单图） |
| `make-figures.ps1` | 从 `out/` 的 GIF / 逐笔快照重新生成序列条带图 |
| `make-diagrams.ps1` | 重新生成两张架构图 |
| `make-composites.ps1` | 重新生成三张多面板合成图 |
| `pandoc-width.lua` | Pandoc 过滤器：为所有图片设定宽度（LaTeX/PDF 导出用） |

## 导出 PDF

### 方式一：Typora（推荐，最简单）

1. 用 Typora 打开 `paper.md`；
2. 菜单 `文件 → 导出 → PDF` 即可。Typora 会自动把图片缩放到页宽、并渲染中文。

### 方式二：Pandoc + XeLaTeX

```bash
# Windows PowerShell
pandoc paper.md -o paper.pdf `
  --pdf-engine=xelatex `
  -V CJKmainfont="Microsoft YaHei" `
  -V geometry:margin=2.4cm `
  -L pandoc-width.lua `
  --number-sections
```

`pandoc-width.lua` 会把所有图片统一设为 `0.88\textwidth`，避免高分辨率 PNG 溢出页面；
不想要统一宽度时删掉 `-L pandoc-width.lua` 参数即可。

### 方式三：VS Code + Markdown PDF 插件

直接打开 `paper.md`，按插件说明导出（图片会自动适配页面宽度）。

## 重新生成配图（可选）

配图脚本从仓库 `out/` 目录的现有产物抽取，无需重跑引擎：

```powershell
.\paper\make-figures.ps1      # 三条序列条带图（三个柿子 / 乡村田野 / 干燥时间线）
.\paper\make-diagrams.ps1     # 两张架构图
.\paper\make-composites.ps1   # 三张多面板合成图
```

若 `out/` 产物缺失，先按仓库 README 重跑：

```bash
node demo/agent-paint.js   # 《三个柿子》→ out/agent_evolution.gif 等
node demo/copy-paint.js    # 《乡村田野》→ out/copy-frames/、out/copy-final.png 等
```

## 图清单

| 图号 | 文件 | 内容 |
|---|---|---|
| 图 1 | `fig_division.png` | 系统分工：三权分立与反馈闭环 |
| 图 2 | `fig_arch.png` | 六部分层架构与升级缝 |
| 图 3 | `fig_demo_full.png` | 32 笔全景《树与池塘》（8.8/10） |
| 图 4 | `fig_signatures.png` | 感知签名特写（回流开花 / 岸线 / 颗粒） |
| 图 5 | `fig_showcase_grid.png` | 扩展技法八格 |
| 图 6 | `fig_color_chart.png` | 24 色卡三栏（RGB \| 光谱 \| 平涂） |
| 图 7 | `fig_ows_baseline.png` | 对照基准 Open-Watercolor-Sim |
| 图 8 | `fig_still_life_final.png` | 《三个柿子》定稿 |
| 图 9 | `seq_still_life.png` | 《三个柿子》作画序列（8 帧） |
| 图 10 | `fig_field_pair.png` | 《乡村田野》原作 vs 临摹 |
| 图 11 | `seq_field.png` | 《乡村田野》笔序序列（10 帧） |
| 图 12 | `seq_drying.png` | 干燥时间线（7 帧） |
