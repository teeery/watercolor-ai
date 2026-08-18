import sys, pathlib
from pypdf import PdfReader

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
r = PdfReader(str(src))
parts = []
for i, p in enumerate(r.pages):
    parts.append(f"\n===== PAGE {i+1} =====\n")
    parts.append(p.extract_text() or "")
# 某些 PDF 嵌入字体映射到代理码点,直接 utf-8 写盘会崩;以替换符清洗
text = "".join(parts).encode("utf-8", errors="replace").decode("utf-8")
out.write_text(text, encoding="utf-8")
print(f"pages={len(r.pages)} chars={len(text)} -> {out}")
