# Open-Watercolor-Sim 探测评估

> 状态：探测进行中（源码已审阅，本机安装测试中，视觉验收待 vision 限流恢复）

## 事实（已核实）

- **PyPI 包**：`open-watercolor-sim` 0.1.1，纯 Python 轮子（21KB），依赖 `taichi>=1.7.4`、`numpy>=2.0`、`pillow>=10.0`
- **许可证**：Apache-2.0 ✅
- **仓库**：https://github.com/shuoqichen/Open-Watercolor-Sim （作者 Shuoqi Chen，2026）
- **架构**：Taichi GPU 内核（Eulerian 网格：W 含水率 / P 湿颜料 RGBA / A 已染颜料 / V 速度场 / T 纸纹），ping-pong 缓冲，半拉格朗日平流 + 扩散，参考 Stam 1999 / Curtis 1997 / Deegan 1997
- **支持后端**：CUDA / Metal / Vulkan，失败自动回退 CPU
- **本机硬件**：RTX 2050 4GB（Taichi CUDA/Vulkan 均可），Python 3.11.9，Node 24

## 无头驱动可行性 ✅

```python
from open_watercolor_sim.brush.watercolor_engine import WatercolorEngine
eng = WatercolorEngine(res=384, dt=1/60, seed=0, arch="gpu")
eng.paint(x, y, radius, dryness)      # 落笔（笔触印）
eng.paint_mask(np.ndarray)            # 任意 mask 沉积（有机形状）
eng.set_color(r, g, b)
eng.step(steps)                       # 确定性时间步进（蒸发/沉积/平流/扩散）
img = eng.render(full_res=True)       # 返回 numpy uint8 数组 → PIL 存 PNG
```

- `seed` 参数存在；笔触路径用 Python `random`（仅有机多边形辅助函数），常规 paint 无随机 → 可复现
- **时间线可行**：`step()` 是确定性时间推进，任意时刻 `render()` 即快照 → 干燥动图 = 落笔后循环 step+render
- 不需要 GUI / 显示器（viewer.py 只是 GGUI 前端）

## 我们需求的映射

| 需求（docs/engine.md） | OWS 覆盖 | 缺口 |
|---|---|---|
| 湿扩散 | ✅ 水/颜料双扩散系数 + 平流 | — |
| 边缘沉积 | ✅ 蒸发边缘沉积（咖啡环）+ edge_darkening 参数 | — |
| 回流开花 cauliflower | ⚠️ 部分：边缘沉积 + 湍流噪声有花边趋势，无显式 re-wet 机制 | 需验证能否"滴清水制造回流"（re-wet = 高 dryness 低 pigment 落笔？） |
| 颗粒聚集 | ✅ 纸纹 × granulation 参数 | — |
| 干燥时间线 | ✅ 蒸发率 + step() 确定性推进 | 需我们加"时间线录制"层 |
| 纸纹 | ✅ 多倍频值噪声 | — |
| stroke JSON 协议 | ❌ 无（只有 paint API） | **我们的活**：协议 → paint/steps 适配器 |
| lift 洗色 / spatter / salt | ❌ 无 lift/salt；spatter 可用小半径 paint 模拟 | lift 需验证能否近似 |
| 浏览器运行 | ❌ Taichi 桌面/GPU 栈 | Phase 2 再议；demo 阶段 host Python 子进程可接受 |

## 关键参数（默认值，来自 configs.py）

- brush_radius 40.8、pigment_load 1.578、water_release 2.0
- diffusion 0.4、canvas_evaporation 0.2、gravity 1.486、granulation 0.784、edge_darkening 1.903
- 扩散随分辨率平方缩放，速度/重力线性缩放（res 基准 512）→ 换分辨率观感稳定

## 风险清单

1. **Python 子进程依赖**：agent 循环在 Node 宿主，需 spawn Python + JSON stdio 桥；部署重（Python+taichi+驱动）。demo 验证可接受，产品化是大包袱。
2. **taichi 体积**：wheel 83MB；已装好（.venv-ows），安装走 danger-full-access 一次放行成功。
3. **4GB 显存**：512² 无压力。**CUDA 实测可用**：OWS 用 taichi 1.7 已删除的 `ti.core` 探测 GPU 会误判回退 CPU；4 行 shim 解法（先 `ti.init(arch=ti.cuda)` 再置 `_GLOBAL_TAICHI_INITIALIZED=True`）已写入 smoke_test.py。
4. **视觉质量未验收**：demo.png 已下载、demo.gif 已抽 10 帧到 gif_frames/；vision 免费额度持续 429 限流，待恢复评分。
5. **lift 缺失**：洗色无法原生做 → 若不支持，Phase 1 的"撤笔"能力受限（可退化为局部白覆盖 + 纸纹，观感存疑）。
6. **cauliflower 显式机制缺失**：回流是水彩标志性签名，若调不出来，本引擎的五签名只覆盖 3.5 个。
7. **⚠️ set_color 陷阱（已实锤）**：`set_color()` 会被下一次 `update_params()` 以 `p.color_rgb` 默认紫红 (0.8, 0.102, 0.8) 覆盖；第一版冒烟图整张是紫红的。颜色必须走 `update_params(color_rgb=…)`。官方 demo 可能同样中招。
8. **CPU 性能实测**：512² 下 128 步/秒（10 秒时间线 4.7s）→ CPU 也够 demo 用；CUDA 更快。

## 本机运行结论（已更新）

- ✅ pip 安装成功（taichi 1.7.4 + numpy + pillow + ows 0.1.1，.venv-ows）
- ✅ 无头运行成功（CPU 回退版跑通，产出 mid/dry_000-019/final + drying_timeline.gif）
- ✅ CUDA 后端经 shim 可用（RTX 2050）
- ✅ 观感验收完成：vision 评分见下（含 v2 参数极限实验：四象限边缘/扩散/湿接湿组合均无回流花边，参数救不了内核）

## vision 验收（2026 轮）

| 对象 | 评分 | 核心诊断 |
|---|---|---|
| 官方 demo.png（作者自调参数） | **2.5/10** | "带颜色的雾"：零高频信息、纸纹未调制沉积、边缘沉积弱（edge 拉到 3.0 仍无轮廓线）、颗粒/回流全无 |
| 我们的冒烟测试 v1 | **3/10** | 天空竖条纹（等距盖章所致）、干皴像印章、色滩过圆、清水滴无 bloom、颗粒呈条纹状 |
| v2 参数极限实验（cauliflower 四象限） | 无回流 | A 基线 / B 加强边缘 / C 高扩散 / D 湿接湿——四个参数组合全部无 cauliflower，证实内核结构性缺失 |
| **自研 JS 引擎（本仓库）** | **6.5/10** | 五签名全成立；回流开花特写 6.5-7/10。详见 README 与 docs/engine-js.md |

**根因是内核层，不是笔触层**：扩散各向同性=高斯模糊；边缘沉积 `edge_term` 实现过弱且过宽；granulation 只乘在 settle 分支的噪声上、视觉贡献可忽略；无 re-wet/掩码扩张机制 → cauliflower 结构性缺失。参数拉满也救不回来（官方 demo 即证明）。

## 探测结论（已闭环）

**机制层面通过，质量层面不达标；自研 JS 引擎胜出。** OWS 可被无头驱动、确定性、CUDA 可用、Apache-2.0——但它的渲染质量过不了 roadmap 的"水是真的"门槛，且缺口在内核实现，修补 = 分叉重写其 Taichi 内核。最终选择方案 C（用户确认）：**JS 引擎主线（已交付，6.5/10），OWS 保留作并行渲染对照**。OWS 的资产留存于 `probe/ows/`（源码、冒烟脚本、shim、调参版渲染图），Phase 1/2 如需"真物理对照渲染"可直接复用 `smoke_v2.py`。

## 决策记录

- A 方案：分叉修补 OWS 内核（保留 GPU）→ 未选（维护成本 > 收益）
- B 方案：JS 引擎主线 → 已交付
- C 方案（**用户选定**）：B + OWS 保留作并行渲染对照
