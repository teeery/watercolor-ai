// 画笔库与配方表（brush dynamics v2 §2/§5/§9）——brush 身份 + stroke type → 配方
// 预设名优先(LLM 友好);对象可覆盖任意字段;width 以 1280×960 画布坐标为基准(动力学层 ×0.5 落网格)。

export const BRUSH_PRESETS = {
  "貂毛圆头":    { shape: "round",  width: 14, capacity: 1.0, spring: 0.7,  bristle: 12, hair: "sable",    beta: 0.25 },
  "貂毛圆头8号": { shape: "round",  width: 8,  capacity: 0.8, spring: 0.7,  bristle: 8,  hair: "sable",    beta: 0.25 },
  "猪鬃平头":    { shape: "flat",   width: 20, capacity: 1.1, spring: 0.25, bristle: 24, hair: "hog",      beta: 0.3 },
  "大排刷":      { shape: "wash",   width: 60, capacity: 1.8, spring: 0.15, bristle: 32, hair: "synthetic", beta: 0.35 },
  "勾线笔":      { shape: "rigger", width: 4,  capacity: 0.5, spring: 0.6,  bristle: 4,  hair: "sable",    beta: 0.2 },
};

/**
 * @param {object|string} spec { name } 或 { shape, width, capacity, spring, bristle, beta } 或预设名
 * @returns 完整 brush 对象(预设 + 覆盖;无 name 且无 shape 时用圆头默认)
 */
export function resolveBrush(spec = {}) {
  const base = typeof spec === "string" ? BRUSH_PRESETS[spec] : BRUSH_PRESETS[spec?.name];
  const over = typeof spec === "string" ? {} : { ...spec };
  delete over.name;
  const def = { shape: "round", width: 14, capacity: 1.0, spring: 0.7, beta: 0.25 };
  const merged = { ...def, ...(base ?? {}), ...over };
  // 毛数兜底只在"预设与覆盖都没给 bristle"时按形状填(round 12 / flat 24 / wash 32 / rigger 4)
  if (base?.bristle === undefined && over.bristle === undefined) {
    merged.bristle = { round: 12, flat: 24, wash: 32, rigger: 4 }[merged.shape] ?? 12;
  }
  return merged;
}

/**
 * 配方表:stroke type → { brush, load, motion, kBreak, gamma }
 * 仅用于新管线(brush/motion/load.tip/interleave 任一出现)内补缺;legacy 路径不走这里。
 */
export const RECIPES = {
  "wet-wash": {
    brush: { name: "大排刷" },
    load: { water: 0.8 },
    motion: { verb: "扫" },
    kBreak: 1.4, gamma: 1.5,
  },
  glaze: {
    brush: { name: "猪鬃平头" },
    load: { water: 0.4 },
    motion: { verb: "拖" },
    kBreak: 1.4, gamma: 1.5,
  },
  "dry-brush": {
    brush: { name: "貂毛圆头" },
    load: { water: 0.15 },
    motion: { verb: "皴" },
    kBreak: 1.4, gamma: 0.8,
  },
};

/** 新管线入口判据(v2 §9 兼容规则):任一显式动力学字段出现 → 新管线 */
export function isNewPipeline(stroke = {}) {
  return !!(stroke.brush || stroke.motion || stroke.load?.tip || stroke.interleave);
}
