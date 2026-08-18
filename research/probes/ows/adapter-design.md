# 适配器设计：stroke 协议 → 引擎（引擎无关层）

> 无论 demo 后端是 OWS（Python/Taichi）还是自研 JS 引擎，这一层的接口保持不变。
> 参考：docs/engine.md 的 stroke 协议草案；本文件是对它的 v0.2 细化。

## 引擎无关接口（Node 侧）

```js
interface MediumRenderer {
  // 设置纸与全局参数（尺寸、纸纹、seed）
  setup(paper: { size:[w,h], texture:'cold-press'|'hot-press', seed:number }): void
  // 按 t 升序应用一批笔触；返回每个笔触完成后的引擎内部时间
  applyStrokes(strokes: Stroke[]): Promise<void>
  // 取 t 时刻（或当前时刻）的快照 → RGBA Uint8Array（或 PNG buffer）
  snapshot(opts?: { t?: number; scale?: number }): Promise<ImageBuffer>
  // 时间线录制：给定采样点，产出帧序列（供 GIF/回放）
  recordTimeline(samples: number[]): Promise<Frame[]>
}
```

- 时间单位：ms（协议里 `t` 即真实作画时刻）
- 确定性：同 seed + 同笔画序列 → 同输出（OWS 满足：seed 固定噪声；JS 引擎同样约束）
- 坐标：左上原点，与浏览器/PNG 一致（OWS 内部左下原点，适配器负责翻转）

## stroke 协议 v0.2（与 engine.md 草案的差异）

| type | 语义 | 关键参数 |
|---|---|---|
| `wet-wash` | 湿铺大面 | region 或 path、water 高、pigment 低、layers(遍数) |
| `dry-brush` | 干皴 | path、water 低、pigment 中高、jitter(断续感) |
| `glaze` | 罩染（干后叠透明色层） | path/region、water 中、pigment 低 |
| `spatter` | 溅点 | center、radius 分布、count、water 中 |
| `re-wet` | 再润湿（清水滴/清水平刷 → 触发回流） | path/region、pigment=0、water 高 |
| `lift` | 洗色 | **v0 引擎不支持（OWS 无此机制）→ 协议保留但适配器报 warning 跳过** |

pigment 对象：`{ color, granulation(0..1), staining(0..1) }`
每笔：`{ t, type, ...几何, water(0..1), pigment, paper? }`

## OWS 映射表

| 协议 | OWS 调用 | 参数映射 |
|---|---|---|
| 几何 path | 沿路径按 `radius*0.8` 间距 `paint(x,y,r,dryness)` 盖戳（viewer 同款节奏） | path 转 stamps |
| water(0..1) | `water_release` | `water_release = 0.1 + water*1.9`（默认 2.0 为 1.0） |
| pigment.color | `update_params(color_rgb=…)` | ⚠️ **陷阱**：`set_color()` 会被下一次 `update_params()` 用 `p.color_rgb` 默认紫红 (0.8,0.102,0.8) 覆盖；颜色必须与其它参数同一次 update_params 传入 |
| pigment.granulation | `update_params(granulation=…)` | 直接（每笔前更新全局参数，笔画串行所以可行） |
| pigment.staining | `update_params(settle_coeff, absorption_coeff)` | `settle_coeff = 0.1 + staining*0.4` |
| dry-brush | `paint_brush(..., brush_id=1, dryness≈0.7-0.9)` | 海绵刷 = 断续纹理 |
| wet-wash | `paint(..., dryness≈0.1-0.3)` 多遍 | 大半径、低 pigment_load |
| re-wet | `paint(..., dryness=0, pigment_load=0)` | 纯加水 → 待验证能否挤出回流花边 |
| spatter | 小半径随机点 `paint` | count×2px 半径 |
| t | 笔触间 `step((t2-t1)/dt)` | dt=1/60 |
| paper.texture | `update_params(paper_texture_scale=…)` | cold-press ≈ 2.2（默认），hot-press ≈ 0.8 |

## 时间线录制（干燥动图）

- 最后一笔落笔后，连续 `step()` 推进 N 秒（demo: 10s = 600 步），每 0.5s 存帧
- 帧序列 → GIF（PIL 或纯 JS GIF 编码）
- 关键帧判定：W 场全域 < ε 时可提前结束并记录"实际干燥时长"

## 已知缺口（如实记录）

1. `lift` 无原生支持 → 协议保留，适配器跳过并 log（诚实守则：不伪造）
2. cauliflower 无显式机制 → 依赖边缘沉积 + 湍流；smoke test 第 4 笔专门验证
3. 每笔的 pigment 参数是全局的（OWS）→ 串行适配器无冲突；将来并行渲染需引擎支持 per-stroke 参数
