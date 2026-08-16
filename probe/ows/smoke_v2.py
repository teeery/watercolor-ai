# -*- coding: utf-8 -*-
"""
OWS 调优轮 v2：
1. 修机械感：不规则盖章（间距/半径/干湿抖动 + 手部游走）、rough-blob mask 湿铺
2. cauliflower 实验：四象限参数组合（边缘/颗粒/扩散/湿接湿）
输出：final.png、四象限 crop、干燥时间线帧
"""
import os, math, random
import numpy as np

import taichi as ti
for _arch, _name in [(ti.cuda, "cuda"), (ti.vulkan, "vulkan"), (ti.cpu, "cpu")]:
    try:
        ti.init(arch=_arch, offline_cache=True)
        print(f"[shim] taichi backend: {_name}")
        break
    except Exception as _e:
        print(f"[shim] {_name} unavailable")
import open_watercolor_sim.brush.watercolor_engine as _wce
_wce._GLOBAL_TAICHI_INITIALIZED = True
from open_watercolor_sim.brush.watercolor_engine import WatercolorEngine

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "smoke_v2_out")
os.makedirs(OUT, exist_ok=True)
RES = 512
DT = 1.0 / 60.0
rng = random.Random(7)


def save(img_u8, name):
    Image.fromarray(np.flip(img_u8.swapaxes(0, 1), 0)).save(os.path.join(OUT, name))
    print(f"  saved {name}")


def rough_blob_mask(cx, cy, r, npts=16, noise=0.30):
    """有机 blob mask（保存图坐标，左上原点）。"""
    img = Image.new("L", (RES, RES), 0)
    pts = []
    for k in range(npts):
        a = 2 * math.pi * k / npts
        rr = r * (1 + noise * math.sin(a * 3 + 1.7) * math.sin(a * 2 + 0.4) + rng.uniform(-noise * 0.5, noise * 0.5))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    ImageDraw.Draw(img).polygon(pts, fill=255)
    m = np.asarray(img, dtype=np.float32) / 255.0
    # 软边缘
    from PIL import ImageFilter
    m = np.asarray(img.filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255.0
    return m


def apply_blob_wash(eng, cx, cy, r, times=2):
    """用 mask 铺湿洗（保存图坐标）。"""
    m = rough_blob_mask(cx, cy, r)
    for _ in range(times):
        eng.paint_mask(np.flipud(m))  # 字段原点左下
        eng.step(30)


def hand_stamp_line(eng, x0, y0, x1, y1, radius, dryness0, dryness1, steps_n, brush_id=0):
    """模拟手绘一笔：间距/半径/垂直抖动。y 为字段坐标（左下原点）。"""
    n = int(steps_n)
    for k in range(n + 1):
        t = k / n
        x = x0 + (x1 - x0) * t + rng.gauss(0, radius * 0.12)
        y = y0 + (y1 - y0) * t + rng.gauss(0, radius * 0.15)
        r = radius * (1 + rng.gauss(0, 0.12))
        d = dryness0 + (dryness1 - dryness0) * t + rng.gauss(0, 0.03)
        eng.paint_brush(int(x), int(y), max(3, int(r)), brush_id=brush_id, dryness=min(1.0, max(0.0, d)))


def main():
    eng = WatercolorEngine(res=RES, dt=DT, seed=7, arch="gpu")

    # ============ 1) 天空：两片错位 rough blob 湿铺（不再等距盖戳） ============
    eng.update_params(color_rgb=(0.55, 0.68, 0.80), pigment_load=1.2, water_release=1.8,
                      diffusion=0.5, paper_texture_scale=2.2)
    apply_blob_wash(eng, 170, 70, 150, times=3)
    apply_blob_wash(eng, 340, 60, 160, times=3)
    eng.step(150)

    eng.update_params(color_rgb=(0.42, 0.55, 0.72), pigment_load=0.7, water_release=1.5)
    apply_blob_wash(eng, 240, 90, 130, times=2)
    eng.step(200)

    # ============ 2) 草地干皴：手绘游走线，干湿渐变 ============
    eng.update_params(color_rgb=(0.45, 0.62, 0.35), pigment_load=1.3, water_release=0.3,
                      brush_radius=22, granulation=0.7, edge_darkening=1.6)
    field_top = lambda y_saved: RES - y_saved
    for i in range(6):
        x0 = rng.uniform(10, 90); x1 = x0 + rng.uniform(340, 420)
        yy = field_top(rng.uniform(300, 380))
        hand_stamp_line(eng, x0, yy, x1, yy + rng.uniform(-25, 25), 18, 0.78, 0.92, 26, brush_id=1)
    eng.step(240)

    # ============ 3) 颗粒对比：两滩 rough blob ============
    eng.update_params(color_rgb=(0.30, 0.32, 0.55), pigment_load=1.4, water_release=1.0,
                      granulation=1.0, paper_texture_scale=3.5, settle_coeff=0.5)
    apply_blob_wash(eng, 80, 440, 55, times=2)
    eng.step(120)
    eng.update_params(color_rgb=(0.75, 0.30, 0.30), granulation=0.05, paper_texture_scale=1.2)
    apply_blob_wash(eng, 432, 440, 55, times=2)

    save(eng.render(full_res=True), "01_mid.png")

    # ============ 4) cauliflower 四象限实验 ============
    quads = {
        "A_base":   dict(cx=128, cy=150, edge=1.9, gran=0.78, diff=0.4, settle=0.32, wet_first=False),
        "B_edge":   dict(cx=384, cy=150, edge=2.0, gran=1.0,  diff=0.4, settle=0.6,  wet_first=False),
        "C_diff":   dict(cx=128, cy=390, edge=1.9, gran=0.8,  diff=0.75, settle=0.6, wet_first=False),
        "D_wetwet": dict(cx=384, cy=390, edge=2.0, gran=0.8,  diff=0.5, settle=0.32, wet_first=True),
    }
    for name, q in quads.items():
        eng.update_params(color_rgb=(0.35, 0.45, 0.62), pigment_load=1.1, water_release=1.4,
                          edge_darkening=q["edge"], granulation=q["gran"], diffusion=q["diff"],
                          settle_coeff=q["settle"], brush_radius=30)
        apply_blob_wash(eng, q["cx"], q["cy"], 60, times=2)
        if q["wet_first"]:
            eng.step(60)   # 湿接湿：趁湿滴水
        else:
            eng.step(240)  # 半干后滴水
        # 清水滴
        eng.update_params(pigment_load=0.0, water_release=2.0)
        eng.paint(q["cx"], RES - q["cy"], 20, dryness=0.0)
        eng.step(420)  # 7 秒看回流
        img = eng.render(full_res=True)
        save(img, f"cauli_{name}_full.png")
        # crop 保存图坐标 (y_top, x_left)
        arr = np.flip(img.swapaxes(0, 1), 0)
        h = 110
        crop = arr[q["cy"] - h:q["cy"] + h, q["cx"] - h:q["cx"] + h]
        Image.fromarray(crop).save(os.path.join(OUT, f"cauli_{name}.png"))

    save(eng.render(full_res=True), "final.png")

    # ============ 5) 干燥时间线 ============
    frame_every = int(0.5 / DT)
    for s in range(int(10.0 / DT)):
        eng.step(1)
        if (s + 1) % frame_every == 0:
            save(eng.render(full_res=True), f"dry_{s // frame_every + 1:03d}.png")
    save(eng.render(full_res=True), "final_dry.png")
    print("DONE")


if __name__ == "__main__":
    main()
