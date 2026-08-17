# Zheng 2017 精读复核（brush 分支,Example-Based Brushes 对照笔触层）

> 材料:`research/papers/medium/zheng2017-example-brushes.pdf`(用户提供,10 页)+ `research/papers/medium/zheng2017-example-brushes.txt`(提取文本)。
> Zheng, Milliez, Gross, Sumner, "Example-Based Brushes for Coherent Stylized Renderings", NPAR 2017(ETH Zurich / Disney Research Zurich)。

## 1. 方法骨架

example brush = 物理笔触扫描 → 沿 spine 拉直成 l×h 直笔纹理(rib quad-mesh);属性极薄(仅长度 lq + 目标形状;压力/颜色/宽度都是 future work)。时间相干 = 预计算长度层级纹理 + 运行时 w:0→wmax **连续揭示像素列** + 2D 变形 + Poisson 混合。

## 2. 路线差异(抄与不抄的边界)

- **不兼容**:屏幕空间投影/深度排序、3D 场景输入、无介质模拟(它没有水,时间相干是几何变形相干,不是物理干燥时间线)、扫描笔触库采集、HoG+Poisson 调色(我们的颜色是真颜料 RYB/KM 涌现)、整体缩放笔触、压力→宽度调制(我们有水库因果,不吃它的)。
- **正交可抄**:①"spine+quad strip 拉直 → 沿直线合成 → 变形回路径"的表示——**弧长为规范轴**,纹理合成与路径几何解耦;②"离散层级 + 连续 reveal"的时间相干模式。

## 3. 可抄清单(性价比序)

1. **弧长为规范轴**:我们的水库/毛层本来就是弧长参数化的(§4/§6),此论文独立佐证该选择的普适性;Phase 2 回放(时间线录制)用弧长轴会更确定、可插值;
2. **层级纹理 + 连续 reveal** ↔ 我们的 drying_timeline/evolution.gif 与 §6 压缩交错:90 步 = 层级,推进 = reveal——动图实现可参考其"预计算层级 + 连续揭示"避免逐帧重渲染;
3. **Poisson 消缝**(低优先,Phase 2 时间线拼接时用);
4. **blur+阈值自动提边界 mask**(若做笔触边界特效用)。

## 4. 拒绝清单

屏幕空间投影、扫描笔触库、HoG+Poisson 调色、整体缩放笔触、压力→宽度调制、3D 场景渲染管线。

## 5. 对 v2 的净影响

- 不抄属性集(其 brush 属性比我们 v0.3 协议还薄——属性丰富度不是它的卖点);
- 其时间相干与我们"物理干燥时间线"只在模式层同构,机制层不同——不可当依据;
- **纹理层方向(v2.1+)**:论文"拉直—合成—rib 贴图"是"压力调宽而不拉伸纹理"的解法——我们 v2 §5 的 verb/包络若要在 v2.1 加笔触纹理层(毛缘纹理跟随宽度变化),可按此思路:弧长轴合成纹理、rib 映射回路径,纹理不随宽度拉伸变形。
