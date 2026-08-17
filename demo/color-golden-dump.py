# 一次性转换：Golden HB xlsx → research/data/golden-hb.json（供 color-data-build.js 使用）
import openpyxl, json

wb = openpyxl.load_workbook(
    "out/color/data/Reflectance Data for Golden HB 10 mil Drawdowns over White.xlsx",
    data_only=True,
)
ws = wb["Sheet1"]
out = {}
for r in ws.iter_rows(min_row=3, values_only=True):
    name = r[1].strip() if r[1] else None
    if not name:
        continue
    R = [v / 100 for v in r[6:37] if v is not None]
    out[name] = {"R": [round(v, 4) for v in R], "L": round(r[2], 1)}

doc = {
    "source": "Golden Artist Colors HB 10 mil drawdowns over white (D65/10deg, 400-700nm @10nm)",
    "note": "reflectance includes white backing card (6 mil dry film); K/S=(1-R)^2/2R per Golden — 非分离 K/S，故只用 R",
    "nm": [400 + i * 10 for i in range(31)],
    "paints": out,
}
json.dump(doc, open("research/data/golden-hb.json", "w"), indent=1)
print("paints:", len(out))
