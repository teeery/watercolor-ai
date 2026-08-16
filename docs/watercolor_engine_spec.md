# 水彩感知引擎算法规格（可直接实现版）

## 0 目标与来源
只求五个视觉签名可辨识，不做全物理。来源：【A】Hobbs《A Guide to Simulating Watercolor Paint with Generative Art》(tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art)；【B】Curtis 等 SIGGRAPH'97 物理模型——专利 US6198489（已下载全文 PDF 并提取文本，可验证公式均出自此）；【C】移植（§8）。"待实验"= 无确定值/形式，须实测调参。

## 1 数据结构（640×480 半分辨率，Float32Array 平铺）
- 表层水 W[i]：水量 0..~2（可过饱和）【A】【B】。
- 颜料溶液 P[i]：悬浮颜料量 0..1+RGB（或多颜料栈，见 §3）。
- 沉积层 D[i]：已固着纸面颜料量 0..1+RGB，渲染主来源【B】。
- 纸纹：高度 H[i]（bump，影响流动与吸附）、持水容量 C[i]，同一噪声场派生【B】。
- 湿区掩码 M[i]∈{0,1}：限定水可流动区【B】。
- 步进：每笔注入 W、P、M，迭代 N≈100–500 步（专利自动刷每轮 3–10 步【B】）。
- 参数映射：不透明度≈KM 的 K/S 与沉积厚度 d（栈 amount 即 d）【B】；浓度≈注入 P 初值（0.1 淡/0.5 浓，待实验）；水量≈注入 W 与 C 之比。

## 2 单层管线（每步依次）
1) 水流动【A】【B】：速度 u,v 由压力差驱动，减纸坡；max(|u|,|v|)>1 则减步长 Δt（CFL）【B】。轻量替代（待实验）：水平均化 CA——W 高于邻格按差流出，流出量受 H 调制（Hobbs 描述即"受纸纹影响的简单 CA"【A，细节待核对】）。
2) 散度消减【B】：dp=−relax·(u_{i+½}−u_{i−½}+v_{j+½}−v_{j−½})，四邻重分配至 div≤maxdiv 或 count≥maxsteps。
3) 颜料平流【B】：gs 减流出量，按 u,v 通量搬邻格，nSteps=1/Δt 内循环。
4) 吸附/解吸【B】：Ddown=gd·lift·(1+exposure·(H−1))；Dup=gs·deposit·(1−exposure·H)；gd+=Ddown−Dup；gs+=Dup−Ddown。exposure 使低洼处更易沉积→颗粒聚集雏形。
5) 边缘加深【B】：blur=高斯(mask,edgeKer)；mask>0 处 p−=min(blur·darkening,p)。边缘减压→水携颜料向边缘→暗边＝边缘沉积签名。
6) 毛细扩散+背流【B】：mask>0 处 q+=min(absorption,pcap−q)；扩散常数≈0.25（原文排版有乱，待核对）；发送格水>ε、接收格<δ 才扩散；水>θ 的格并入湿区掩码。**掩码扩张＋边缘先干＝回流开花**。
7) 蒸发【A】【B】：W*=(1−evap)，evap≈0.005–0.05/步（待实验）。边沿水膜先干，强化 5)。
8) 干燥冻结：W<ε_dry(≈0.001) 时 P 全并入 D，不再流动。

## 3 多层混合（Hobbs 特殊混合函数）
- Hobbs 原文：每格存颜料栈（amount+RGB），渲染用自写混合函数——**具体形式原文待核对**（本环境无法访问原站，不编造）。
- 替代①【B】KM 单常数：每颜料给 K、S（每 RGB 通道）。单层（厚 d）：a=1+K/S，b=√(a²−1)；R=sinh(bSd)/(a·sinh(bSd)+b·cosh(bSd))，T=b/(a·sinh(bSd)+b·cosh(bSd))。两层复合：R=R1+T1²R2/(1−R1R2)，T=T1T2/(1−R1R2)。K/S 由白/黑底观色反推：(1−R)²/(2R)（以专利原文为准，PDF 提取有损）。
- 替代②【B 同族 US8296668】按颜料比加权：pf=(pf·σs+ps·σf)/(σs+σf)。
- 替代③ Mixbox（observablehq.com/@mjbo/hello-mixbox）工业颜料混合，有开源端口。
- 建议：栈长≤4 逐层 KM 复合；性能不足退化②。

## 4 参数表（专利参数名【B】，数值起步值待实验）
| 参数 | 含义 | 起步 |
|---|---|---|
| deposit | 吸附率/步 | 0.05–0.2 |
| lift | 解吸率 | 0.001–0.01 |
| exposure | 纸高对吸附影响（沉降感） | 0–3 |
| absorption | 吸入纸内水量/步 | 0.01–0.05 |
| darkening | 边缘加深倍率 | 0.05–0.5 |
| edgeKer | 边缘模糊核 σ（像素） | 1–3 |
| ε/δ/θ | 毛细发送/接收/湿润阈值 | 0.1/0.05/0.3 |
| pcap | 纸持水容量 | 0.3–0.8 |
| evap | 蒸发率 | 0.005–0.05 |
| relax/maxdiv/maxsteps | 散度消减 | 0.25/0.01/50 |

观感影响最强：deposit、evap、纸纹幅度、edgeKer/darkening。

## 5 纸纹
- value noise（晶格随机+双线性插值+smoothstep）做 fBm：octaves 4–6，频率×2，增益 0.5【A】。
- H=fBm(x·f0) 归 0..1；C=clamp(H·capScale+capOff)。bump 供 §2.1 slope，吸附经 exposure 调制。Perlin 亦可，value noise 更便宜【A】。

## 6 五签名覆盖矩阵
| 签名 | Hobbs 原文【A】 | 本规格实现 |
|---|---|---|
| 湿扩散 | √（水层 CA；另提 caustic 纹样，机制待核对） | §2.1–2.3 |
| 边缘沉积 | √（蒸发留色/暗边） | §2.5、2.7 |
| 回流开花 | × | §2.6 掩码扩张+边缘先干；进阶：干燥前沿不稳定/指进（DLA 类）【B，待实验】 |
| 颗粒聚集 | 部分（纸纹+沉降） | exposure 沉降+高频噪声调制 deposit（待实验） |
| 干燥时间线 | × | §2.7–2.8；含水率 m(t)=m0·e^(−kt)，分 wet/damp/dry，damp 期为 backrun 窗口（待实验） |

## 7 sudoaquarelle.com
客户端 JS 单页应用；本环境 HTTPS 出网被沙箱阻断，JS 无法抓取（**未验证**）。报道称其为 Claude Code 生成的水彩物理模拟（explainx.ai/blog/sudo-aquarelle-claude-code-watercolor-simulator，未核实）；CSDN《Aquarelle 源码深度剖析》分析的是 Ramotion/aquarelle（另一项目）。建议联网环境抓其 JS bundle 核对。

## 8 移植清单（许可证均待在线核对）
- ericyd/generative-art（Rust，examples/watercolor1.rs）：github.com/ericyd/generative-art
- Neill Bogie OpenProcessing 846117（Processing 直译）：openprocessing.org/sketch/846117/
- haschdl/generative（JS，PRoseGarden）：github.com/haschdl/generative
- axelinternet/p5-watercolor（p5.js）：github.com/axelinternet/p5-watercolor
- Ramotion/aquarelle（JS WebGL，常见标注 Apache-2.0）：github.com/Ramotion/aquarelle
- aschinchon/watercolors（R，stepping-stone CA 纹样）：github.com/aschinchon/watercolors
- Curtis 物理模型：SIGGRAPH'97+专利 US6198489（§2/§3 数学来源）
- Isaac Karth 解读（2017）：procedural-generation.isaackarth.com/2017/04/26/a-generative-approach-to-simulating-watercolor.html
- 实践参考：80.lv/articles/simulating-watercolor-using-houdini-s-cops；jrmeyer.github.io/misc/2026/02/21/ghostty-watercolors.html
