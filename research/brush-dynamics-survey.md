# 数字绘画"笔刷动力学/刷毛动力学"调研报告

> 目标:为水彩引擎"感知签名"笔触层升级提供设计输入。粒度来自论文摘要/官方博客与既有文献知识,部分细节需以原文精读为准。

## 1. Escape Motions Rebelle — bristle 引擎
【模型抽象】brush = 一组独立刷毛(每根含弯折、张角、载水量、载色量),纸 = 可吸收基材(含水量上限 + 颜料沉降),像素级 NanoPixel 水色仿真(水扩散、颜料迁移、干燥、颗粒沉降)。
【产生的感知签名】湿边深色水痕、granulation 颗粒沉降、颜料分层混色、刷毛分叉纹理、起笔/收笔浓淡。
【可负担性】expensive — 逐像素流体 + 逐刷毛,依赖 GPU/多线程,与单线程 640×480 预算冲突;只抄"抽象",不抄内核。
【值得抄的点】①"刷毛数/张角/载水量/载色量"作为 brush 身份参数,而非逐根仿真;②纸用"含水量上限 + 吸收率"两张标量场,与我们的网格模拟天然同构。

## 2. Adobe Fresco Live Brushes + Wetbrush(SIGGRAPH 2015)
【模型抽象】刷毛 = 可变形细条(条带几何),与画布求交得接触 footprint;画布 = 水层 + 颜料层高度场,GPU 逐帧对流/吸收/蒸发(Fresco 为其工程化降维版)。
【产生的感知签名】湿接湿混色、颜料随水扩散、干燥硬边、刷毛接触脚印纹理、刮擦露底。
【可负担性】expensive — Wetbrush 全 GPU 逐帧流体;抄其"footprint→水色注入"接口而非流体核。
【值得抄的点】①footprint 概念 = ribbon 包络的直接升级:用 bristle 条带与纸求交得到多段接触足迹,决定注水注色分布;②两层(水/颜料)标量场,可用 typed array 稀疏实现。

## 3. 学术三篇
**DAB(Baxter et al. 2001)**
【模型抽象】brush = 细分曲面 + 多根刷毛发丝做物理形变;画布 = 颜料浓度高度场;每根刷毛尖端按压力独立沉积。
【感知签名】刷毛并排纹理、压力对应墨量、笔毛脚印。
【可负担性】expensive — 细分曲面 + 物理 + 力反馈;只抄 bristle-tip footprint 沉积。
【值得抄的点】"每根刷毛尖端独立沉积"→ 降维成 footprint 内与位置相关的密度函数(边缘浓中间淡),不逐根算。

**MoXi(Chu & Tai 2001)**
【模型抽象】纸 = 纤维网格(吸收/阻滞),墨 = 水 + 粒子;Lattice Boltzmann 扩散,颜料被纤维捕获滞留。
【感知签名】墨水洇开、颗粒滞留、纤维晕染。
【可负担性】medium — LBM 轻但仍是全场粒子;纸纤维"捕获概率"是便宜签名。
【值得抄的点】纸纹理用"每格随机捕获率/阻滞率"静态标量场,即可复现飞白 + 洇边,无需逐帧粒子。

**Curtis et al. 1997**
【模型抽象】浅水方程(水高 + 颜料浓度两层)+ 纸高场;刷子 = 注水注色源;蒸发使边缘颜料浓集。
【感知签名】湿边(边缘深色)、backrun 回流、颗粒、干笔飞白。
【可负担性】medium~expensive — 浅水方程是全场 PDE,但已远轻于 NS;边缘浓集是最便宜也最"水彩"的签名。
【值得抄的点】湿边 = 蒸发致边缘浓集,可用"水层梯度大的格点加深颜料"启发式实现——性价比之王。

## 4. 传统技法物理机制(→ 对应签名)
- **variegated wash / charging**:湿区扩散 + 笔尖异色注入 → 渐变;机制 = 颜料在水层扩散 + 注入色斑。
- **dry-brush skip**:纸齿高场,低水笔只触峰 → 飞白;机制 = 接触阈值。
- **flat brush 双轨边(railroad tracks)**:平头笔两侧刷毛载色多 → 双轨;机制 = footprint 边缘浓中间淡。
- **起笔水珠 / 提笔收尖**:接触瞬间注水 burst + 收笔 footprint 收窄 → 头重尾尖;速度/压力包络已有雏形。
- **湿接湿稀释/吸水**:清水笔触湿区 → 负转移(纸→笔),稀释 + 擦亮;机制 = 可负颜料通量。

## 建议采纳清单(按性价比排序)
1. 【cheap,立即】湿边浓集(蒸发边缘加深)——补"水彩身份"最核心缺的签名,单启发式。
2. 【cheap】纸齿高场 + 逐格随机捕获率 → 接触阈值飞白 + 洇边,升级现有 dry-brush 泪滴戳。
3. 【cheap~medium】footprint 密度函数(边缘浓中间淡 + 平头笔双轨),把 ribbon 包络升级为"有形状的笔"。
4. 【medium】brush 身份参数(bristle 数/张角/载水量/载色量/吸水量)落入 stroke v0.2 的 brush/motion 字段,驱动以上机制。
5. 【medium】两层标量场(水 + 颜料)+ 可负颜料通量,实现 charging/variegated/湿接湿吸水,对接现有 640×480 grid。
6. 【expensive,暂缓】逐刷毛几何 / 全流体(Rebelle/Wetbrush 级),仅作长期目标或局部降维。

## 来源
- Rebelle bristle 博客: https://www.escapemotions.com/blog/rebelle-8-bristle-brushes
- Rebelle 8.2 发布: https://www.cgchannel.com/2025/12/escape-motions-releases-rebelle-8/
- Rebelle 概述(Wiki): https://en.wikipedia.org/wiki/Rebelle_(software)
- Wetbrush(ACM): https://dl.acm.org/doi/10.1145/2816795.2818066
- Wetbrush PDF: https://citeseerx.ist.psu.edu/document?doi=76b3da4fa416aef7699fa2822962f4cdad022d8f&repid=rep1&type=pdf
- DAB(Google Research): https://research.google/pubs/dab-interactive-haptic-painting-with-3d-virtual-brushes-2/
- DAB(Semantic Scholar): https://www.semanticscholar.org/paper/DAB%3A-Interactive-Haptic-Painting-with-3D-Virtual-Baxter-Scheib/1d59ae586543058910661357f19cf0c6f8912555
- MoXi(ACM): https://dl.acm.org/doi/epdf/10.1145/1187112.1187186
- MoXi 项目页: http://visgraph.cse.ust.hk/MoXi/
- Curtis 1997(ACM): https://dl.acm.org/doi/10.1145/258734.258896
- Curtis 1997(Semantic Scholar): https://www.semanticscholar.org/paper/Computer-generated-watercolor-Curtis-Anderson/41e32ac0fd2be3c72402ac060410be042d96ef0e/
- Fresco 发布: https://www.cgchannel.com/2019/06/adobe-unveils-fresco/
- Variegated wash: https://watercoloracademy.com/watercolor-academy-news/variegated-wash-in-watercolor-painting
- Dry brush: https://watercoloracademy.com/watercolor-academy-news/dry-brush-watercolor-painting-technique
