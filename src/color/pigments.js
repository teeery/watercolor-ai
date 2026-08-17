// 颜料预设库 v0.3（24 色，马利水彩常用色）
// hex = 绑定光谱的 R∞ → sRGB（2026-08-16 第二版：主源 Golden HB 78 支实测反射谱
//   D65/10°/400-700@10nm；锌白/紫罗兰/草绿/普蓝保留 CHSOS 或程序化——Golden 白卡
//   测量把透明深色洗平，已记录；见 color-data-build.js BIND 注释）
// granulation 0..1 颗粒度；staining 0..1 着色力
// scatter = S 系数（双常数 KM 散射/遮盖力）；strength = 着色强度 κ（单位质量光学厚度倍率）
export const PIGMENTS = [
  { name: "锌白", hex: "#d6d1ca", granulation: 0.05, staining: 0.15, scatter: 12.0, strength: 0.8 },
  { name: "柠檬黄", hex: "#f9e31b", granulation: 0.10, staining: 0.30, scatter: 4.0, strength: 0.5 },
  { name: "中镉黄", hex: "#ffcf00", granulation: 0.15, staining: 0.35, scatter: 4.0, strength: 1.1 },
  { name: "土黄", hex: "#b78144", granulation: 0.30, staining: 0.25, scatter: 2.0, strength: 0.9 },
  { name: "桔黄", hex: "#ff731f", granulation: 0.20, staining: 0.45, scatter: 3.0, strength: 0.8 },
  { name: "朱红", hex: "#e54433", granulation: 0.25, staining: 0.50, scatter: 2.5, strength: 1.1 },
  { name: "大红", hex: "#c32b33", granulation: 0.20, staining: 0.65, scatter: 2.5, strength: 1.1 },
  { name: "深红", hex: "#583c3e", granulation: 0.30, staining: 0.75, scatter: 2.0, strength: 1.2 },
  { name: "玫瑰红", hex: "#7b3443", granulation: 0.20, staining: 0.80, scatter: 0.5, strength: 2.6 },
  { name: "紫罗兰", hex: "#663771", granulation: 0.35, staining: 0.60, scatter: 0.6, strength: 1.3 },
  { name: "群青", hex: "#3a3269", granulation: 0.90, staining: 0.40, scatter: 0.8, strength: 1.0 },
  { name: "钴蓝", hex: "#3048a2", granulation: 0.60, staining: 0.45, scatter: 1.2, strength: 1.0 },
  { name: "湖蓝", hex: "#6497b2", granulation: 0.25, staining: 0.55, scatter: 1.4, strength: 1.2 },
  { name: "普蓝", hex: "#1f3d5e", granulation: 0.35, staining: 0.85, scatter: 0.5, strength: 3.0 },
  { name: "翠绿", hex: "#1d5b54", granulation: 0.30, staining: 0.50, scatter: 0.9, strength: 1.6 },
  { name: "深绿", hex: "#2e484b", granulation: 0.30, staining: 0.60, scatter: 0.6, strength: 2.4 },
  { name: "草绿", hex: "#717f3d", granulation: 0.25, staining: 0.45, scatter: 0.9, strength: 1.5 },
  { name: "橄榄绿", hex: "#52724d", granulation: 0.45, staining: 0.35, scatter: 1.1, strength: 1.3 },
  { name: "赭石", hex: "#b78144", granulation: 0.70, staining: 0.30, scatter: 1.5, strength: 1.0 },
  { name: "熟褐", hex: "#53423c", granulation: 0.50, staining: 0.40, scatter: 1.5, strength: 1.1 },
  { name: "生褐", hex: "#4b443f", granulation: 0.80, staining: 0.35, scatter: 1.5, strength: 1.2 },
  { name: "佩恩灰", hex: "#37383d", granulation: 0.50, staining: 0.70, scatter: 0.8, strength: 1.5 },
  { name: "象牙黑", hex: "#393939", granulation: 0.40, staining: 0.75, scatter: 1.0, strength: 0.6 },
  { name: "天蓝", hex: "#83a6c3", granulation: 0.15, staining: 0.40, scatter: 1.2, strength: 1.4 },
];
