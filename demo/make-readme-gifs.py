# demo/make-readme-gifs.py — 从 out/ 的大 GIF 生成 README 展示用的小尺寸预览
# 用法: .venv-ows\Scripts\python.exe demo/make-readme-gifs.py
# 依赖: PIL(.venv-ows 已装)。先跑 node demo/render-demo.js / agent-paint.js / copy-paint.js 再跑本脚本。

from PIL import Image
import os

JOBS = [
    # (源, 目标, 最大宽, 每 N 帧取 1, 颜色数)
    ("out/evolution.gif",          "assets/panorama_evolution.gif",  360, 1, 64),
    ("out/agent_evolution.gif",    "assets/persimmons_evolution.gif", 256, 2, 48),
    ("out/copy-strokes.gif",       "assets/field_strokes.gif",       224, 1, 48),
    ("out/drying_timeline.gif",    "assets/drying_timeline.gif",     360, 1, 64),
]

def shrink(src, dst, max_w, stride, colors):
    im = Image.open(src)
    frames = []
    durations = []
    i = 0
    try:
        while True:
            im.seek(i)
            if i % stride == 0:
                frame = im.convert("RGB")
                w, h = frame.size
                if w > max_w:
                    frame = frame.resize((max_w, round(h * max_w / w)), Image.LANCZOS)
                frames.append(frame.quantize(colors=colors, method=Image.MEDIANCUT))
                durations.append(im.info.get("duration", 120))
            i += 1
    except EOFError:
        pass
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    frames[0].save(dst, save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=2, optimize=False)
    print(f"{src} -> {dst}: {len(frames)} frames, {os.path.getsize(dst)/1024:.0f} KB")

for src, dst, w, stride, colors in JOBS:
    if not os.path.exists(src):
        print(f"SKIP {src} (先跑对应 demo 脚本)")
        continue
    shrink(src, dst, w, stride, colors)
