# Montesdeoca 姊妹篇精读复核(brush 分支,2017 C&G + NPAR)

> 材料:`research/papers/medium/montesdeoca2017-cg.txt`(15 页)+ `research/papers/medium/montesdeoca2017-npar.txt`(10 页)。
> Montesdeoca et al., "Art-directed watercolor stylization of 3D animations in real-time"(C&G 2017);"Edge- and substrate-based effects for watercolor stylization"(NPAR 2017)。

## 1. 方法骨架(引擎术语)

- **CG17**:手抖/湿接湿 = object-space 顶点位移(Eq1-2);颜料湍流 = 低频密度衰减(Eq6);**渗色 bleeding** = 4D joint-bilateral 模糊 + `Icb = Ctrl(B−I) + I`(Eq7);**边缘加深** = 模糊相减 + 透射指数 `I^(1+Ctrl·max(Ib−I))`(Eq8);**纸变形** = UV 沿法向偏置;**granulation** = 减法/透射 split(Eq9,`Piv` 反纸高)。
- **NPAR17**:边缘加深 = RGBD Sobel → 逐像素宽度 Wk 高斯 `Eb = GWk∗Esobel` → 强度 Ie → `C^(1+Ed)`(§3.1);gap/overlap = 沿梯度 marche 混 RYB/露纸(§3.2 Alg1);**dry-brush + granulation 统一** = 高度阈值 `Hr<a` 只涂峰、`Hr≥a` 谷加深 `da = 1+dg·Hiv·D`, `C^da`(§4.1 Eq1-4);纸光照 = 法向漫射(§4.2 Eq5)。

两篇全是**图像/物体空间静态后处理**:无颜料输运、无时间线、无质量守恒。

## 2. 关键判定

1. **边缘加深**:Montesdeoca 是静态滤波器(宽度/强度分离、梯度带),**没有透明带/水线/浅线三层、无时间演化**;我们 M2 的签名目标是三层岸线 + 干燥时间线(护城河)→ **坚持 FlowOutward 输送**。只抄他的"宽度 Wk 与强度 Ie 分离 + 模糊成梯度带 + 指数变暗"进 render 缝,替掉均匀 `edgeBlur=4` 与线性 `1−edgeDarken·band`。
2. **granulation**:双方同"谷深峰浅",但他是**纯着色后处理**(反纸高当遮罩,无质量),我们是**吸附偏置**(沉积率落谷,质量守恒,更近 Curtis)。高度符号已修(engine.js L548 `1−expo·hb`;render.js `valley=0.5−hh`),无需再动。净抄 = NPAR 峰值阈值 split 给 M4 干笔。
3. **渗色 ≠ bloom**:bleeding = 湿接湿两色互渗(≈P2 互渗);bloom/回流开花 = backrun 干燥前沿失稳——两篇**都没实现 backrun**,M3 曲率驱动 R(θ) 是自创,勿挂 Montesdeoca 名。bleeding 蓝图可抄:joint-bilateral 的 depth 门换成 W(湿)门,逐通道模糊颜料浓度再 mask 回混。

## 3. 可抄清单(性价比序)

1. **NPAR §4.1 干笔/粒化 split**(最高):`Hr = (H−.5)·r+.5`;`Hr<a → Pa = tdry·|Hr−a|·(Cs−C)+C`(只涂峰),`else da = 1+dg·Hiv·D; C^da`(谷加深)。H 已是 Float32Array,一次遍历沉积格,640×480 全抄。
2. **NPAR §3.1 / CG Eq8 边缘变暗**:`Ed = GWk∗Esobel·Ie; C ← C^(1+Ed)`。指数式有界(免线性欠冲),Wk 乘纸/湍流噪声实现"断裂"。render.js 把 `edgeShade = 1−edgeDarken·band` 改 pow,逐像素一次。
3. **NPAR §4.2 纸光照 Eq5**:`Id = 1−(1−(L·(r·N)))·ds`,N 取 ∇H,一遍漫射,可选 M4。
4. **CG §3.3 bleeding Alg1**:separable 双边,深度门→湿门,给 P2 互渗。
5. **CG §3.3 granulation split Eq9**:饱和死区教训(1ⁿ=1)适用 KM,深色加减法项。
6. **NPAR §3.2 gap/overlap Alg1**:pmask 上沿梯度露纸/混 RYB,可选 M4 轮廓缝。

## 4. 拒绝清单

object-space 顶点位移(手抖/bleeding 顶点外拉);反射模型 cangiante/dilution(N·L);RGBD Sobel + 深度/zbuffer/MRT;顶点色 RGBA 参数 mask;Maya GPU 管线与 1920×1080 指标;扫描基材(shape-from-shading);各向同性 granulation(无方向场)。

## 5. 纠错清单(对我们计划的)

1. **符号已修**:Curtis 纠错 #1 已落地,计划若仍写"待修符号"须同步;M1 只做方向调制,勿重复改符号。
2. **渗色≠bloom**:M3 无文可抄,别引 Montesdeoca。
3. **纸坡 ∇H 仍缺**:M1 流场仍用 G 噪声顶替 ∇H——建议 `u += ∇H·kSlope`,纸纹因果零成本(Curtis #4 + NPAR §4.2 同证)。
4. **render 线性边缘项改指数** + 可变宽(可抄 #2),并把"断裂"搬一半进 render 缝,省 M2 一条沉积率调制。
5. **M4 干笔改峰值阈值**:grainBreak 纯笔势纹理 → `Hr<a` 接纸基材(known #4 同源)。
6. **验收口径**:M0 已破"逐位一致"(mean .12/255);M1-M3 抄图像后处理必再破像素回归——硬门槛应从"像素差"切到"vision + 探针"。
