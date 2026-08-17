# 候选论文精读清单(2026-08 调研,brush 分支归档)

> 调研方法:web_search + HTTP HEAD 校验 PDF 可访问性("✅确认" = 实测 200 application/pdf)。
> 排序逻辑:免费全文 + 直接覆盖最多工作包 + 可移植到纯 JS 640×480。

## 第一梯队(免费可读 + 直接覆盖下一步工作)

| # | 论文 | 覆盖工作包 | PDF |
|---|---|---|---|
| 1 | Montesdeoca et al. 2017, "Art-directed watercolor stylization of 3D animations in real-time"(C&G) | 岸线 M2 / bloom M3 / 颜料 P2 / 性能 | ✅ 已下载精读中 |
| 2 | Montesdeoca, Seah & Rall 2017, "Edge- and substrate-based effects for watercolor stylization"(NPAR) | 岸线 M2 核心公式 | ✅ 已下载精读中 |
| 3 | DiVerdi et al. 2010, "Industrial-strength painting with a virtual bristle brush"(VRST) | **笔刷 v2 直接蓝本** | ⚠️ 付费:ACM `10.1145/1889863.1889889`;Adobe 落地页 `research.adobe.com/publication/industrial-strength-painting-with-a-virtual-bristle-brush/` |
| 4 | Bousseau et al. 2006, "Interactive watercolor rendering with temporal coherence and abstraction"(NPAR) | 时域相干 / 性能 | ✅ 已下载精读中 |
| 5 | Chu & Tai 2005, "MoXi: Real-Time Ink Dispersion in Absorbent Paper"(SIGGRAPH) | 纸纹 M1 各向异性纤维 | ✅ 项目页 `visgraph.cse.ust.hk/MoXi/`(服务器曾 502,待重试或人工下载) |

## 第二梯队

| # | 论文 | 覆盖 | PDF |
|---|---|---|---|
| 6 | DiVerdi et al. 2012, "A lightweight, procedural, vector watercolor painting engine"(I3D)/TVCG 2013 "Painting with Polygons" | 性能对照方案 | ⚠️ 付费;Adobe 落地页 |
| 7 | Van Laerhoven et al. 2004, "Real-time watercolor painting on a distributed paper model"(CGI) | 纸纹 M1 / 性能 | ⚠️ IEEE 付费 |
| 8 | Montesdeoca et al. 2018, "MNPR: A Framework for Real-Time Expressive NPR of 3D CG"(Expressive) | 框架参照 | ✅ `hal.science/hal-01814332v2/document` |
| 9 | Van Laerhoven et al. 2005, "Real-time Simulation of Thin Paint Media"(SIGGRAPH Talks) | bloom M3 / 岸线 M2 | ✅ `history.siggraph.org/.../2005-Talks-Vanlaerhoven_Real-time-Simulation-of-Thin-Paint-Media.pdf` |
| 10 | Small 1991, "Simulating watercolor by modeling diffusion, pigment, and paper fibers"(SPIE) | 历史参照 | ⚠️ SPIE 付费 |
| 11 | Jintae Lee 2001, "Simulating oriental black-ink painting"(IEEE CG&A) | 纸纹 M1 各向异性 | ⚠️ IEEE 付费 |
| 12 | Bousseau et al. 2007, "Video watercolorization using bidirectional texture advection"(SIGGRAPH/TOG) | 动画/视频时域相干 | ✅ `hal.science/hal-00171411v1/document` |

## 建议精读顺序

1. **Montesdeoca C&G 2017 + NPAR 2017**(已开读)——单篇覆盖 medium-upgrade 大部分算子,算法轻量可直译 JS;
2. **DiVerdi 2010**——笔刷 v2 的唯一工业级蓝本(无免费 PDF,走机构订阅/联系作者求 TR);
3. **Bousseau 2006**(已开读)——时域相干 + 湿度驱动扩散抽象。

## 调研边界说明

- 各向异性纸纹/纤维场 2015 后的专门工作、颜料粒重分离/实测光谱的专门论文,本次未找到比 MoXi(2005)/Jintae Lee(2001)/Montesdeoca(2017 含 granulation)更直接且有免费全文的篇目;
- P2(粒重/实测光谱)的最实落点:Montesdeoca 的 granulation 实现 + Small 1991 的颜料分层思想;若要再深,应转查色彩科学/材料物理(纸张毛细 + 颜料絮凝/沉降),而非图形学会议。
