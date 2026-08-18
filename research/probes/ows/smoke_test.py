# -*- coding: utf-8 -*-
"""
OWS 冒烟测试：验证 open-watercolor-sim 在本机可无头运行。
- 画约 10 笔（湿铺天空 + 干皴 + 清水滴回流尝试 + 颗粒对比）
- 输出关键快照 PNG + 干燥时间线帧序列
- 打印性能数据（step 耗时）
"""
import sys, time, os
import numpy as np

# --- taichi 后端 shim：OWS 用 taichi 1.7 已删除的 ti.core 探测 GPU，会误判并回退 CPU。
# --- 这里先按 cuda → vulkan → cpu 顺序显式初始化，再骗过它的全局标志。
import taichi as ti
for _arch, _name in [(ti.cuda, "cuda"), (ti.vulkan, "vulkan"), (ti.cpu, "cpu")]:
    try:
        ti.init(arch=_arch, offline_cache=True)
        print(f"[shim] taichi backend: {_name}")
        break
    except Exception as _e:
        print(f"[shim] {_name} unavailable: {type(_e).__name__}: {str(_e)[:140]}")
import open_watercolor_sim.brush.watercolor_engine as _wce
_wce._GLOBAL_TAICHI_INITIALIZED = True

from open_watercolor_sim.brush.watercolor_engine import WatercolorEngine
from open_watercolor_sim.brush.configs import SimParams

OUT = os.path.join(os.path.dirname(__file__), "smoke_out")
os.makedirs(OUT, exist_ok=True)

RES = 512
DT = 1.0 / 60.0
SEED = 42

def save(img_u8, name):
    # field shape (W, H, 3) 原点左下 → PIL 需要 (H, W, 3) 原点左上
    from PIL import Image
    Image.fromarray(np.flip(img_u8.swapaxes(0, 1), 0)).save(os.path.join(OUT, name))
    print(f"  saved {name}")

def main():
    t0 = time.perf_counter()
    eng = WatercolorEngine(res=RES, dt=DT, seed=SEED, arch="gpu")
    print(f"[init] {time.perf_counter()-t0:.2f}s backend OK")

    # 1) 湿铺天空：顶部大半径、高含水、低颜料
    # 注意：颜色必须走 update_params(color_rgb=...)，set_color 会被随后的 update_params 用默认紫红覆盖
    eng.update_params(color_rgb=(0.55, 0.68, 0.80),  # 天蓝
                      pigment_load=0.8, water_release=2.0, brush_radius=90, diffusion=0.5)
    for x in range(40, RES - 40, 40):
        eng.paint(x, RES - 60, 90, dryness=0.15)
        eng.paint(x + 20, RES - 90, 90, dryness=0.1)
    eng.step(120)  # 2 秒扩散

    # 2) 第二层天蓝罩染
    eng.update_params(color_rgb=(0.42, 0.55, 0.72),
                      pigment_load=0.5, water_release=1.5)
    for x in range(60, RES - 60, 50):
        eng.paint(x, RES - 120, 80, dryness=0.25)
    eng.step(180)

    # 3) 干皴草地：低含水、高颜料、海绵刷
    eng.update_params(color_rgb=(0.45, 0.62, 0.35),
                      pigment_load=1.4, water_release=0.25, brush_radius=26, granulation=0.8, edge_darkening=1.6)
    for x in range(20, RES, 28):
        eng.paint_brush(x, 150 + (x % 5) * 8, 26, brush_id=1, dryness=0.75)
    eng.step(240)

    # 4) 清水滴回流尝试：只加水不加颜料
    eng.update_params(pigment_load=0.0, water_release=2.0, brush_radius=24)
    eng.paint(RES // 2, RES - 160, 24, dryness=0.0)
    eng.step(300)  # 5 秒看回流

    # 5) 重颗粒颜料对比（左下）
    eng.update_params(color_rgb=(0.30, 0.32, 0.55),  # 群青
                      pigment_load=1.5, water_release=0.9, brush_radius=40, granulation=1.0)
    eng.paint(80, 90, 40, dryness=0.3)
    eng.step(120)
    # 细腻颜料对比（右下）
    eng.update_params(color_rgb=(0.75, 0.30, 0.30),  # 茜红
                      granulation=0.1)
    eng.paint(RES - 80, 90, 40, dryness=0.3)

    save(eng.render(full_res=True), "01_mid.png")

    # 6) 干燥时间线：最后落笔后连续 step，每 0.5 秒 sim 时间存一帧
    N_DRY_SECONDS = 10.0
    steps_total = int(N_DRY_SECONDS / DT)
    frame_every = int(0.5 / DT)
    t_start = time.perf_counter()
    frame_no = 0
    for s in range(steps_total):
        eng.step(1)
        if (s + 1) % frame_every == 0:
            save(eng.render(full_res=True), f"dry_{frame_no:03d}.png")
            frame_no += 1
    dry_elapsed = time.perf_counter() - t_start
    print(f"[perf] {steps_total} steps in {dry_elapsed:.2f}s → {steps_total/dry_elapsed:.0f} steps/s")

    save(eng.render(full_res=True), "final.png")
    print("DONE")

if __name__ == "__main__":
    main()
