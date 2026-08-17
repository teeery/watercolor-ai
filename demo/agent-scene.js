// agent 实测场景 v2：《三个柿子》——按 vision 诊断修正后重画
// v1 → v2：背景改 cover 覆盖语义(消白带)；果实加 hard(光滑轮廓,消咬痕)；果蒂短笔画(消条码/悬空线)；去桌面杂笔
export const scene = [
  // —— 背景：整幅上 2/3 覆盖湿铺（cover 语义，不再依赖 ribbon 几何）——
  { stroke: { type: "cover", region: { x0: -6, y0: -6, x1: 646, y1: 330 }, soft: 12, pigment: { color: "#b8c4c6", granulation: 0.15, staining: 0.35, amount: 0.5 }, water: 0.8, layers: 1 }, stepsAfter: 240 },
  // —— 桌面：赭黄两条带（下 1/4）——
  { stroke: { type: "wet-wash", path: [[10, 420], [320, 404], [630, 420]], radius: 62, radiusEnd: 50, pigment: { color: "#c9a97a", granulation: 0.3, staining: 0.45, amount: 0.9 }, water: 0.55, layers: 1 }, stepsAfter: 200 },
  { stroke: { type: "wet-wash", path: [[10, 452], [320, 442], [630, 450]], radius: 42, radiusEnd: 34, pigment: { color: "#b08d5c", granulation: 0.3, staining: 0.45, amount: 0.7 }, water: 0.45, layers: 1 }, stepsAfter: 200 },
  // —— 接触影 ——
  { stroke: { type: "glaze", region: { cx: 212, cy: 368, rx: 52, ry: 20 }, pigment: { color: "#7a6a55", granulation: 0.35, staining: 0.5, amount: 0.75 }, water: 0.5 }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 424, cy: 396, rx: 56, ry: 22 }, pigment: { color: "#7a6a55", granulation: 0.35, staining: 0.5, amount: 0.75 }, water: 0.5 }, stepsAfter: 80 },
  { stroke: { type: "glaze", region: { cx: 322, cy: 318, rx: 44, ry: 16 }, pigment: { color: "#7a6a55", granulation: 0.35, staining: 0.5, amount: 0.6 }, water: 0.5 }, stepsAfter: 60 },
  // —— 后中柿子（hard：光滑果体轮廓）——
  { stroke: { type: "wet-wash", region: { cx: 320, cy: 262, rx: 46, ry: 44 }, pigment: { color: "#e8a33d", granulation: 0.2, staining: 0.5, amount: 1.6 }, water: 0.55, layers: 2, hard: true }, stepsAfter: 120 },
  { stroke: { type: "glaze", region: { cx: 308, cy: 248, rx: 24, ry: 22 }, pigment: { color: "#f2c063", granulation: 0.15, staining: 0.4, amount: 0.9 }, water: 0.4, hard: true }, stepsAfter: 100 },
  { stroke: { type: "glaze", region: { cx: 328, cy: 278, rx: 22, ry: 18 }, pigment: { color: "#c98a2b", granulation: 0.2, staining: 0.55, amount: 0.55 }, water: 0.35, hard: true }, stepsAfter: 90 },
  { stroke: { type: "dry-brush", radius: 3, path: [[320, 216], [313, 200]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.45, amount: 1.6 }, water: 0.28 }, stepsAfter: 50 },
  // —— 前左柿子 ——
  { stroke: { type: "wet-wash", region: { cx: 212, cy: 316, rx: 52, ry: 50 }, pigment: { color: "#ea692f", granulation: 0.25, staining: 0.5, amount: 1.7 }, water: 0.6, layers: 2, hard: true }, stepsAfter: 140 },
  { stroke: { type: "glaze", region: { cx: 198, cy: 298, rx: 28, ry: 26 }, pigment: { color: "#f49a52", granulation: 0.15, staining: 0.4, amount: 0.95 }, water: 0.4, hard: true }, stepsAfter: 110 },
  { stroke: { type: "glaze", region: { cx: 226, cy: 338, rx: 24, ry: 20 }, pigment: { color: "#c1542c", granulation: 0.25, staining: 0.55, amount: 0.6 }, water: 0.35, hard: true }, stepsAfter: 100 },
  { stroke: { type: "dry-brush", radius: 3, path: [[214, 264], [207, 247]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.45, amount: 1.6 }, water: 0.28 }, stepsAfter: 50 },
  // —— 前右柿子 ——
  { stroke: { type: "wet-wash", region: { cx: 424, cy: 340, rx: 56, ry: 54 }, pigment: { color: "#d1542a", granulation: 0.25, staining: 0.5, amount: 1.8 }, water: 0.6, layers: 2, hard: true }, stepsAfter: 150 },
  { stroke: { type: "glaze", region: { cx: 408, cy: 320, rx: 30, ry: 28 }, pigment: { color: "#e07a3c", granulation: 0.15, staining: 0.4, amount: 0.95 }, water: 0.4, hard: true }, stepsAfter: 110 },
  { stroke: { type: "glaze", region: { cx: 442, cy: 364, rx: 26, ry: 22 }, pigment: { color: "#b34424", granulation: 0.25, staining: 0.55, amount: 0.6 }, water: 0.35, hard: true }, stepsAfter: 100 },
  { stroke: { type: "dry-brush", radius: 3, path: [[426, 284], [419, 266]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.45, amount: 1.6 }, water: 0.28 }, stepsAfter: 50 },
  // —— 桌面纹理（单笔淡罩染，去杂笔溅点）——
  { stroke: { type: "glaze", region: { cx: 480, cy: 420, rx: 70, ry: 24 }, pigment: { color: "#a5855a", granulation: 0.4, staining: 0.5, amount: 0.4 }, water: 0.45 }, stepsAfter: 120 },
  // —— 背景右下轻洗色 ——
  { stroke: { type: "lift", region: { cx: 545, cy: 130, rx: 42, ry: 30 }, liftP: 0.35, liftD: 0.25, water: 0.25 }, stepsAfter: 140 },
];

export const DRY_STEPS = 600;
export const DRY_FRAME_EVERY = 30;
export const EVO_FRAME_EVERY = 60;
