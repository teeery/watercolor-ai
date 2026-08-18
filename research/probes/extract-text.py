# research/probes/extract-text.py — pypdf 提取 PDF 文本 → research/<name>.txt
import sys
from pypdf import PdfReader

def extract(src, dst):
    r = PdfReader(src)
    print(f"{src}: {len(r.pages)} pages", flush=True)
    with open(dst, "w", encoding="utf-8") as f:
        for i, page in enumerate(r.pages):
            try:
                t = page.extract_text() or ""
            except Exception as e:
                t = f"[page {i+1} extract error: {e}]"
            f.write(f"\n===== PAGE {i+1} =====\n")
            f.write(t)
    print(f"written {dst}", flush=True)

if __name__ == "__main__":
    for src, dst in [("research/curtis1997.pdf", "research/curtis1997.txt"),
                     ("research/wetbrush2015.pdf", "research/wetbrush2015.txt")]:
        try:
            extract(src, dst)
        except Exception as e:
            print(f"FAIL {src}: {e}", flush=True)
