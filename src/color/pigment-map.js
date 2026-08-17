// 24 色（马利）→ 单颜料 CI 代码映射 + 复配色配方
// 用途：任务 2 绑定实测光谱数据。实测库（FORS/Pigments Checker）只覆盖单颜料；
// 复配色（湖蓝/草绿/橄榄绿/佩恩灰/天蓝）无单颜料数据 → 按 mix 配方做 K·d 线性混合。
// 注意：赭石/土黄同为 PY43、熟褐/生褐同为 PBr7（煅烧/生料变体），绑定实测时以样本 ID 区分。
export const PIGMENT_MAP = {
  "锌白":   { ci: "PW4",  note: "zinc white" },
  "柠檬黄": { ci: "PY3",  note: "hansa/lemon yellow" },
  "中镉黄": { ci: "PY35", note: "cadmium yellow" },
  "土黄":   { ci: "PY43", note: "yellow ochre" },
  "桔黄":   { ci: "PO20", note: "cadmium orange" },
  "朱红":   { ci: "PR108", note: "cadmium red" },
  "大红":   { ci: "PR254", note: "pyrrole red" },
  "深红":   { ci: "PR179", note: "perylene maroon" },
  "玫瑰红": { ci: "PV19",  note: "quinacridone rose" },
  "紫罗兰": { ci: "PV23",  note: "dioxazine violet" },
  "群青":   { ci: "PB29",  note: "ultramarine" },
  "钴蓝":   { ci: "PB28",  note: "cobalt blue" },
  "湖蓝":   { ci: null, mix: { "PB35": 1, "PW4": 1.4 }, note: "cerulean + white 复配色（高白含量）" },
  "普蓝":   { ci: "PB27",  note: "prussian blue" },
  "翠绿":   { ci: "PG18",  note: "viridian" },
  "深绿":   { ci: "PG7",   note: "phthalo green" },
  "草绿":   { ci: null, mix: { "PG7": 1, "PY3": 0.5 }, note: "hooker's green 复配色" },
  "橄榄绿": { ci: null, mix: { "PY43": 1, "PB15": 0.25 }, note: "olive 复配色" },
  "赭石":   { ci: "PY43",  note: "yellow ochre（与土黄同源，样本浓度不同）" },
  "熟褐":   { ci: "PBr7",  note: "burnt umber（煅烧）" },
  "生褐":   { ci: "PBr7",  note: "raw umber（生料）" },
  "佩恩灰": { ci: null, mix: { "PBk9": 1, "PB15": 0.3 }, note: "payne's grey 复配色" },
  "象牙黑": { ci: "PBk9",  note: "bone/ivory black" },
  "天蓝":   { ci: null, mix: { "PB35": 1, "PW4": 0.8 }, note: "cerulean + white 复配色" },
};

/** 复配色配方 → 各组分的 K·d 权重（总质量归一）：引擎溶液混合已按通道线性，权重即配比 */
export function mixWeights(name) {
  const m = PIGMENT_MAP[name];
  if (!m || !m.mix) return null;
  const total = Object.values(m.mix).reduce((a, b) => a + b, 0);
  const out = {};
  for (const [k, v] of Object.entries(m.mix)) out[k] = v / total;
  return out;
}
