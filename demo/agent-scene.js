// agent 实测场景 v4：《三个柿子》——按 v3 vision 三斧修正
// ① 接触点压暗（果底与影相接，消悬浮）；② 每果左上软高光（~5% 面积）；③ 蒂改四裂扁帽；
// 另：投影整体右移（左上光源）、hard 轮廓已改整圆（jag 0.08）
export const scene = [
  // —— 背景：覆盖湿铺 + 果组后方暖晕 ——
  { stroke: { type: "cover", region: { x0: -6, y0: -6, x1: 646, y1: 360 }, soft: 12, pigment: { color: "#b8c4c6", granulation: 0.15, staining: 0.35, amount: 0.5 }, water: 0.8, layers: 1 }, stepsAfter: 220 },
  { stroke: { type: "glaze", region: { cx: 318, cy: 300, rx: 170, ry: 130 }, pigment: { color: "#d9cbb8", granulation: 0.1, staining: 0.3, amount: 0.28 }, water: 0.5 }, stepsAfter: 180 },
  // —— 桌面 ——
  { stroke: { type: "wet-wash", path: [[10, 396], [320, 382], [630, 396]], radius: 62, radiusEnd: 50, pigment: { color: "#c9a97a", granulation: 0.3, staining: 0.45, amount: 0.9 }, water: 0.55, layers: 1 }, stepsAfter: 200 },
  { stroke: { type: "wet-wash", path: [[10, 452], [320, 442], [630, 450]], radius: 42, radiusEnd: 34, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.7 }, water: 0.45, layers: 1 }, stepsAfter: 200 },
  // —— 群影（右移，配合左上光源）——
  { stroke: { type: "glaze", region: { cx: 312, cy: 420, rx: 175, ry: 28 }, pigment: { color: "#8a7a60", granulation: 0.3, staining: 0.5, amount: 0.35 }, water: 0.5 }, stepsAfter: 90 },
  // —— 后中柿子（v6：高光强化+右下收暗+反光带贴剪影内+接触影吞晕）——
  { stroke: { type: "wet-wash", region: { cx: 300, cy: 292, rx: 46, ry: 46 }, pigment: { color: "#e8a33d", granulation: 0.2, staining: 0.5, amount: 1.8 }, water: 0.55, layers: 1, hard: true }, stepsAfter: 120 },
  { stroke: { type: "glaze", region: { cx: 286, cy: 270, rx: 24, ry: 20 }, pigment: { color: "#f2c063", granulation: 0.15, staining: 0.4, amount: 0.9 }, water: 0.4, hard: true }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 283, cy: 265, rx: 11, ry: 9 }, pigment: { color: "#fbe0a0", granulation: 0.1, staining: 0.35, amount: 0.6 }, water: 0.35, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 300, cy: 306, rx: 44, ry: 38 }, pigment: { color: "#d18f2e", granulation: 0.2, staining: 0.5, amount: 0.42 }, water: 0.4, hard: true }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 314, cy: 324, rx: 18, ry: 13 }, pigment: { color: "#9a6a1c", granulation: 0.2, staining: 0.55, amount: 0.45 }, water: 0.35, hard: true }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 294, cy: 328, rx: 12, ry: 5 }, pigment: { color: "#d9b06a", granulation: 0.15, staining: 0.4, amount: 0.35 }, water: 0.32, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 302, cy: 336, rx: 24, ry: 7 }, pigment: { color: "#8f6a24", granulation: 0.3, staining: 0.55, amount: 0.8 }, water: 0.3, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 314, cy: 362, rx: 36, ry: 11 }, pigment: { color: "#8a7a60", granulation: 0.35, staining: 0.5, amount: 0.65 }, water: 0.45 }, stepsAfter: 80 },
  { stroke: { type: "wet-wash", region: { cx: 300, cy: 244, rx: 16, ry: 5.5 }, pigment: { color: "#6b6b3e", granulation: 0.5, staining: 0.45, amount: 1.5 }, water: 0.3, hard: true }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[292, 244], [284, 241]], pigment: { color: "#5a5c2e", granulation: 0.5, staining: 0.45, amount: 1.3 }, water: 0.26 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[308, 244], [316, 241]], pigment: { color: "#5a5c2e", granulation: 0.5, staining: 0.45, amount: 1.3 }, water: 0.26 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[300, 247], [296, 251]], pigment: { color: "#4f522a", granulation: 0.5, staining: 0.5, amount: 1.2 }, water: 0.24 }, stepsAfter: 40 },
  // —— 前左柿子（v5：单层浓涂 + 强化高光 + 反光带 + 橄榄褐蒂）——
  { stroke: { type: "wet-wash", region: { cx: 196, cy: 350, rx: 52, ry: 50 }, pigment: { color: "#ea692f", granulation: 0.25, staining: 0.5, amount: 1.9 }, water: 0.6, layers: 1, hard: true }, stepsAfter: 140 },
  { stroke: { type: "glaze", region: { cx: 181, cy: 328, rx: 26, ry: 24 }, pigment: { color: "#f49a52", granulation: 0.15, staining: 0.4, amount: 0.95 }, water: 0.4, hard: true }, stepsAfter: 110 },
  { stroke: { type: "glaze", region: { cx: 175, cy: 318, rx: 13, ry: 11 }, pigment: { color: "#fbc492", granulation: 0.1, staining: 0.35, amount: 0.65 }, water: 0.35, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 196, cy: 364, rx: 48, ry: 40 }, pigment: { color: "#d15c2b", granulation: 0.25, staining: 0.5, amount: 0.5 }, water: 0.4, hard: true }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 210, cy: 384, rx: 26, ry: 16 }, pigment: { color: "#a5431f", granulation: 0.25, staining: 0.55, amount: 0.5 }, water: 0.35, hard: true }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 188, cy: 384, rx: 14, ry: 6 }, pigment: { color: "#e0a06a", granulation: 0.15, staining: 0.4, amount: 0.35 }, water: 0.32, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 198, cy: 396, rx: 24, ry: 7.5 }, pigment: { color: "#8f451f", granulation: 0.3, staining: 0.55, amount: 0.8 }, water: 0.3, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 224, cy: 428, rx: 46, ry: 13 }, pigment: { color: "#8a7a60", granulation: 0.35, staining: 0.5, amount: 0.6 }, water: 0.45 }, stepsAfter: 80 },
  { stroke: { type: "wet-wash", region: { cx: 196, cy: 298, rx: 16, ry: 5.5 }, pigment: { color: "#6b6b3e", granulation: 0.5, staining: 0.45, amount: 1.5 }, water: 0.3, hard: true }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[189, 298], [182, 295]], pigment: { color: "#5a5c2e", granulation: 0.5, staining: 0.45, amount: 1.3 }, water: 0.26 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[203, 298], [210, 295]], pigment: { color: "#5a5c2e", granulation: 0.5, staining: 0.45, amount: 1.3 }, water: 0.26 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[196, 301], [192, 305]], pigment: { color: "#4f522a", granulation: 0.5, staining: 0.5, amount: 1.2 }, water: 0.24 }, stepsAfter: 40 },
  // —— 前右柿子（v7：补左上高光 + 蒂周提亮 + 投影右下 + 底溢色纸色修补）——
  { stroke: { type: "wet-wash", region: { cx: 432, cy: 372, rx: 56, ry: 54 }, pigment: { color: "#d1542a", granulation: 0.25, staining: 0.5, amount: 2.0 }, water: 0.6, layers: 1, hard: true }, stepsAfter: 150 },
  { stroke: { type: "glaze", region: { cx: 416, cy: 348, rx: 28, ry: 26 }, pigment: { color: "#e07a3c", granulation: 0.15, staining: 0.4, amount: 0.95 }, water: 0.4, hard: true }, stepsAfter: 110 },
  { stroke: { type: "glaze", region: { cx: 410, cy: 340, rx: 12, ry: 11 }, pigment: { color: "#f4a878", granulation: 0.1, staining: 0.35, amount: 0.65 }, water: 0.35, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 432, cy: 322, rx: 13, ry: 6 }, pigment: { color: "#d97a45", granulation: 0.15, staining: 0.4, amount: 0.3 }, water: 0.32, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 432, cy: 388, rx: 50, ry: 42 }, pigment: { color: "#b8441f", granulation: 0.25, staining: 0.5, amount: 0.5 }, water: 0.4, hard: true }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 448, cy: 410, rx: 26, ry: 16 }, pigment: { color: "#8f3419", granulation: 0.25, staining: 0.55, amount: 0.5 }, water: 0.35, hard: true }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 424, cy: 408, rx: 14, ry: 6 }, pigment: { color: "#d9885a", granulation: 0.15, staining: 0.4, amount: 0.35 }, water: 0.32, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 434, cy: 422, rx: 26, ry: 7.5 }, pigment: { color: "#7e3017", granulation: 0.3, staining: 0.55, amount: 0.8 }, water: 0.3, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 462, cy: 452, rx: 52, ry: 14 }, pigment: { color: "#8a7a60", granulation: 0.35, staining: 0.5, amount: 0.65 }, water: 0.45 }, stepsAfter: 80 },
  { stroke: { type: "wet-wash", region: { cx: 432, cy: 316, rx: 16, ry: 5.5 }, pigment: { color: "#6b6b3e", granulation: 0.5, staining: 0.45, amount: 1.5 }, water: 0.3, hard: true }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[425, 316], [418, 313]], pigment: { color: "#5a5c2e", granulation: 0.5, staining: 0.45, amount: 1.3 }, water: 0.26 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[439, 316], [446, 313]], pigment: { color: "#5a5c2e", granulation: 0.5, staining: 0.45, amount: 1.3 }, water: 0.26 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[432, 319], [428, 323]], pigment: { color: "#4f522a", granulation: 0.5, staining: 0.5, amount: 1.2 }, water: 0.24 }, stepsAfter: 40 },
  // —— v7 纸色修补：提掉三处溢色晕（恢复纸面，画手常用操作）——
  { stroke: { type: "lift", region: { cx: 330, cy: 296, rx: 14, ry: 16 }, liftP: 0.55, liftD: 0.5, water: 0.2, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 162, cy: 290, rx: 12, ry: 10 }, liftP: 0.5, liftD: 0.45, water: 0.2, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 456, cy: 416, rx: 12, ry: 7 }, liftP: 0.5, liftD: 0.45, water: 0.2, push: 0 }, stepsAfter: 100 },
  // —— v8 纸色修补加强：大掩膜彻底清晕 + 中果体积收紧 + 地面白缺口修补 ——
  { stroke: { type: "lift", region: { cx: 332, cy: 298, rx: 18, ry: 20 }, liftP: 0.7, liftD: 0.6, water: 0.2, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 314, cy: 346, rx: 16, ry: 6 }, liftP: 0.6, liftD: 0.55, water: 0.2, push: 0 }, stepsAfter: 90 },
  { stroke: { type: "lift", region: { cx: 172, cy: 388, rx: 14, ry: 10 }, liftP: 0.6, liftD: 0.55, water: 0.2, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 210, cy: 412, rx: 14, ry: 6 }, liftP: 0.6, liftD: 0.55, water: 0.2, push: 0 }, stepsAfter: 90 },
  { stroke: { type: "lift", region: { cx: 446, cy: 418, rx: 16, ry: 7 }, liftP: 0.65, liftD: 0.6, water: 0.2, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 316, cy: 314, rx: 16, ry: 12 }, pigment: { color: "#a87e2e", granulation: 0.2, staining: 0.55, amount: 0.4 }, water: 0.33, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 302, cy: 340, rx: 20, ry: 5.5 }, pigment: { color: "#8f6a24", granulation: 0.3, staining: 0.55, amount: 0.7 }, water: 0.3, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 24, cy: 452, rx: 16, ry: 10 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.5 }, water: 0.35 }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 612, cy: 450, rx: 16, ry: 10 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.5 }, water: 0.35 }, stepsAfter: 90 },
  // —— v9 收官：强 lift 提净残余晕 + 投影贴底 + 左果冷灰交界 + 地面补边 ——
  { stroke: { type: "lift", region: { cx: 334, cy: 300, rx: 16, ry: 18 }, liftP: 0.85, liftD: 0.8, water: 0.18, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 310, cy: 346, rx: 18, ry: 7 }, liftP: 0.8, liftD: 0.75, water: 0.18, push: 0 }, stepsAfter: 90 },
  { stroke: { type: "lift", region: { cx: 196, cy: 410, rx: 22, ry: 8 }, liftP: 0.8, liftD: 0.75, water: 0.18, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 446, cy: 420, rx: 18, ry: 7 }, liftP: 0.8, liftD: 0.75, water: 0.18, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "lift", region: { cx: 188, cy: 288, rx: 4, ry: 4 }, liftP: 0.85, liftD: 0.8, water: 0.15, push: 0 }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 210, cy: 380, rx: 16, ry: 10 }, pigment: { color: "#b06a45", granulation: 0.2, staining: 0.5, amount: 0.35 }, water: 0.33, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 16, cy: 452, rx: 22, ry: 12 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.6 }, water: 0.35 }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 618, cy: 450, rx: 22, ry: 12 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.6 }, water: 0.35 }, stepsAfter: 90 },
  // —— v9.5 清尾：中果右黄溢笔 lift + 贴底接触 + 左果补高光 + 地面补边加宽 ——
  { stroke: { type: "lift", region: { cx: 336, cy: 306, rx: 14, ry: 12 }, liftP: 0.85, liftD: 0.8, water: 0.18, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 304, cy: 340, rx: 22, ry: 6 }, pigment: { color: "#8f6a24", granulation: 0.3, staining: 0.55, amount: 0.75 }, water: 0.3, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 180, cy: 322, rx: 11, ry: 10 }, pigment: { color: "#f9c08a", granulation: 0.1, staining: 0.35, amount: 0.5 }, water: 0.33, hard: true }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 12, cy: 454, rx: 26, ry: 14 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.7 }, water: 0.35 }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 622, cy: 450, rx: 26, ry: 14 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.7 }, water: 0.35 }, stepsAfter: 90 },
  // —— v11 终版：先强 lift 提掉残黄再背景罩平（透明罩染压不住底层）——
  { stroke: { type: "lift", region: { cx: 344, cy: 304, rx: 20, ry: 16 }, liftP: 0.9, liftD: 0.85, water: 0.15, push: 0 }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 344, cy: 304, rx: 22, ry: 18 }, pigment: { color: "#b8c4c6", granulation: 0.1, staining: 0.4, amount: 1.1 }, water: 0.45, hard: true }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 322, cy: 300, rx: 16, ry: 16 }, pigment: { color: "#c9922c", granulation: 0.2, staining: 0.55, amount: 0.45 }, water: 0.33, hard: true }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 302, cy: 342, rx: 24, ry: 7 }, pigment: { color: "#8f6a24", granulation: 0.3, staining: 0.55, amount: 0.55 }, water: 0.32 }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 196, cy: 400, rx: 24, ry: 7 }, pigment: { color: "#8f451f", granulation: 0.3, staining: 0.55, amount: 0.7 }, water: 0.3, hard: true }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 620, cy: 448, rx: 30, ry: 14 }, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.75 }, water: 0.35 }, stepsAfter: 90 },
  // —— 桌面纹理 + 背景轻洗色 ——
  { stroke: { type: "glaze", region: { cx: 540, cy: 424, rx: 70, ry: 24 }, pigment: { color: "#a5855a", granulation: 0.4, staining: 0.5, amount: 0.4 }, water: 0.45 }, stepsAfter: 120 },
  { stroke: { type: "lift", region: { cx: 560, cy: 120, rx: 46, ry: 32 }, liftP: 0.35, liftD: 0.25, water: 0.25 }, stepsAfter: 140 },
];

export const DRY_STEPS = 900;
export const DRY_FRAME_EVERY = 30;
export const EVO_FRAME_EVERY = 60;
