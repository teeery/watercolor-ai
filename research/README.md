# research/ 索引

> 按四类整理：论文原文（papers）、标准数据（data）、精读笔记（notes）、探测残料（probes）。
> PDF 原则上不进 git（版权原件仅本地保存；已在历史中的两件除外）。提取文本与笔记进 git。

## papers/medium — 介质与笔触论文

| 文件 | 内容 | 状态 |
|---|---|---|
| curtis1997.pdf / .txt | Curtis et al. 1997 *Computer-Generated Watercolor*（SIGGRAPH'97，介质引擎的祖论文；PDF 为 UW paper_small 版） | PDF+txt 进 git |
| us6198489-curtis-patent.pdf / .txt | 同一模型的专利全文（US6198489，与论文交叉验证用） | 进 git |
| wetbrush2015.pdf / .txt | Chen et al. 2015 *Wetbrush: GPU-based 3D Painting Simulation at the Bristle Level*（SIGGRAPH'15） | txt 进 git，PDF 仅本地 |
| zheng2017-example-brushes.pdf / .txt | Zheng et al. 2017 *Example-Based Brushes for Coherent Stylized Renderings*（NPAR'17） | 同上 |
| diverti2010-bristle-brush.pdf / .txt | DiVerdi et al. 2010 *Industrial-strength painting with a virtual bristle brush*（VRST'10，Adobe） | 同上 |
| montesdeoca2017-cg.pdf / .txt | Montesdeoca et al. 2017 *Art-directed watercolor stylization of 3D animations*（CG） | 同上 |
| montesdeoca2017-npar.pdf / .txt | Montesdeoca et al. 2017 *Edge- and substrate-based effects for watercolor stylization*（NPAR'17） | 同上 |
| moxi2005.pdf / .txt | Chu & Tai 2005 *MoXi: Real-Time Ink Dispersion in Absorbent Paper* | 同上 |
| bousseau2006.pdf / .txt | Bousseau et al. 2006 *Interactive watercolor rendering with temporal coherence and abstraction* | PDF 为 0 字节损坏下载（保留待重下），txt 进 git |

## papers/color — 色彩论文

| 文件 | 内容 | 状态 |
|---|---|---|
| mixbox2021.pdf / .txt | Sochorová & Jamriška 2021 *Practical Pigment Mixing for Digital Painting*（SIGGRAPH Asia'21；实测 K/S、Duncan 混合、Saunderson、色域代理） | txt 进 git，PDF 仅本地 |
| berns2016-apds.pdf / .txt | Berns 2016 *Artist Paint Spectral Database*（19 支 Golden 丙烯 masstone-tint K/S；Saunderson K1=0.03/K2=0.65） | 同上 |
| berns2009-cic.pdf / .txt | Ashbaugh, Berns et al. 2009 *Artist Material BRDF Database*（CIC'09，表面外观 BRDF 库） | 同上 |
| npar2017-recoloring-abstract.html / -citation.html / -bitstream.bin | Aharoni-Mack et al. 2017 *Pigment-Based Recoloring of Watercolor Paintings*（NPAR'17）——EG 库需授权无 PDF；摘要已录，bitstream 为失败下载残留 | 仅本地 |
| vanlaerhoven2005-abstract.html | Van Laerhoven & Van Reeth 2005 *Real-time simulation of watery paint*——无公开全文，摘要页 | 仅本地 |

## papers/agent — 教机器作画的 agent 论文

| 文件 | 内容 | 状态 |
|---|---|---|
| [2112.08930] Intelli-Paint：迈向开发类人绘画剂.pdf | Intelli-Paint: Towards Developing Human-like Painting Agents（ECCV 2022；ar5iv 中文机翻打印版，31 页含补充材料） | 提取全文 `probes/ip_text.txt` 进 git，PDF 仅本地 |
| 3680528.3687574.pdf | Inverse Painting: Reconstructing The Painting Process（SIGGRAPH Asia 2024） | 提取全文 `probes/invpaint_text.txt` 进 git，PDF 仅本地 |
| huang2019-learning-to-paint.pdf / .txt | Huang et al. 2019 *Learning to Paint with Model-based Deep Reinforcement Learning*（ICCV'19） | txt 进 git，PDF 仅本地 |
| zou2021-stylized-neural-painting.pdf / .txt | Zou et al. 2021 *Stylized Neural Painting*（CVPR'21） | 同上 |
| liu2026-differentiable-stroke-planning.pdf / .txt | Liu et al. 2026 *Differentiable Stroke Planning with Dual Parameterization for Efficient and High-Fidelity Painting Creation*（CVPR'26） | 同上 |

精读与对比见 `docs/predecessors-agents.md`（册一 Intelli-Paint、册二 Inverse Painting）。

## data — 标准数据

| 文件 | 内容 |
|---|---|
| cie1931-cmf-2deg.csv | CIE 1931 2° 标准观察者（1nm，colour-science 数据集） |
| d65-spd.csv | D65 光源光谱功率分布 |
| golden-hb.json | Golden 78 支 HB 丙烯实测反射谱（xlsx 的机器可读转换，`demo/color-golden-dump.py` 生成；`demo/color-data-build.js` 的输入） |

## notes — 精读笔记与调研

| 文件 | 内容 |
|---|---|
| curtis1997-close-reading.md | Curtis 逐项对照 + 纠错清单（吸附符号/edgeK 空转等，已核验） |
| wetbrush2015-close-reading.md / zheng2017-close-reading.md / bousseau2006-close-reading.md / diverti2010-close-reading.md / montesdeoca2017-close-reading.md / moxi2005-close-reading.md | 各论文精读 |
| brush-dynamics-survey.md | 笔刷动力学调研（Rebelle/Fresco/Wetbrush/DAB/MoXi/Curtis 六源 + 采纳清单） |
| papers-candidates.md | 论文候选清单（brush 会话） |
| 色彩文献调研与差距分析.md | 色彩线论文调研：Mixbox/Berns/NPAR'17 精读 + 逐项对照 + 差距清单 |

## probes — 探测残料

早期抓取/探测实验的中间产物（baidu/bing 检索页、allorigins 探测、CT 探测脚本、OW-Sim 冒烟），仅存档。

## 数据源原件（git 外，本地保留）

- `out/color/data/Reflectance Data for Golden HB 10 mil Drawdowns over White.xlsx` —— Golden 原始数据（用户下载）
- `out/color/data/_probe/` —— CHSOS Pigments Checker FORS ZIP 与解包（82 支 txt）
- `out/color/` 下五份色彩线验收报告（过程证据，见各 TASK 报告）
