# M0 行为保持回归工具：两张 PNG 的像素差统计
# 用法: python demo/png-diff.py <baseline.png> <candidate.png>
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert("RGB"), dtype=np.int16)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB"), dtype=np.int16)
assert a.shape == b.shape, f"shape mismatch: {a.shape} vs {b.shape}"
d = np.abs(a - b)
mean = float(d.mean())
mx = int(d.max())
gt1 = int((d > 1).any(axis=2).sum())
gt3 = int((d > 3).any(axis=2).sum())
tot = a.shape[0] * a.shape[1]
status = "IDENTICAL" if mx == 0 else ("PASS" if mean <= 0.5 and gt3 == 0 else "FAIL")
print(f"{sys.argv[1]}\n  vs {sys.argv[2]}")
print(f"  mean={mean:.4f} max={mx} px>1={gt1} px>3={gt3} / {tot}  => {status}")
sys.exit(0 if status != "FAIL" else 1)
