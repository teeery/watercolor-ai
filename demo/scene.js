// demo 场景：约 23 笔的手绘风景（湿铺天空 / 罩染远山 / 干皴树冠 / 回流开花 / 颗粒沉淀 / 溅点 / 洗色）
// 坐标：640×480 网格，左上原点。stepsAfter = 该笔后推进的模拟步数（1 步 = 1/60 秒）
export const scene = [
  // —— 天空（两条横向扫笔湿铺，先浅后深；下带加宽盖过远山顶部，消除白蝴蝶结留白）——
  { stroke: { type: "wet-wash", path: [[30, 100], [320, 84], [610, 104]], radius: 150, radiusEnd: 126, pigment: { color: "#a8c8e0", granulation: 0.15, staining: 0.4, amount: 0.99 }, water: 0.85, layers: 2 }, stepsAfter: 300 },
  { stroke: { type: "wet-wash", path: [[40, 60], [320, 50], [600, 66]], radius: 140, radiusEnd: 124, pigment: { color: "#7da6c9", granulation: 0.2, staining: 0.5, amount: 0.86 }, water: 0.7, layers: 1 }, stepsAfter: 250 },
  // —— 远山（沿山脊的罩染扫笔；M2.1：上探覆盖天空下缘 + 两山互叠，消白缝）——
  { stroke: { type: "glaze", path: [[30, 226], [150, 205], [300, 232]], radius: 62, radiusEnd: 46, pigment: { color: "#8fae9c", granulation: 0.3, staining: 0.45, amount: 0.99 }, water: 0.5 }, stepsAfter: 200 },
  { stroke: { type: "glaze", path: [[268, 234], [500, 210], [620, 230]], radius: 55, radiusEnd: 42, pigment: { color: "#87a795", granulation: 0.3, staining: 0.45, amount: 0.99 }, water: 0.5 }, stepsAfter: 180 },
  // —— 地面（两条横向扫笔湿铺）——
  { stroke: { type: "wet-wash", path: [[20, 420], [320, 402], [620, 416]], radius: 85, radiusEnd: 72, pigment: { color: "#d8c49a", granulation: 0.35, staining: 0.55, amount: 1.06 }, water: 0.65, layers: 2 }, stepsAfter: 300 },
  { stroke: { type: "wet-wash", path: [[20, 452], [320, 444], [620, 450]], radius: 55, radiusEnd: 45, pigment: { color: "#c9a97a", granulation: 0.35, staining: 0.55, amount: 0.92 }, water: 0.5, layers: 1 }, stepsAfter: 250 },
  // —— 树冠：湿铺打底 + 5 笔干皴 + 2 笔亮部（避免焦黑死团）——
  { stroke: { type: "glaze", region: { cx: 482, cy: 172, rx: 88, ry: 78 }, pigment: { color: "#4d7a52", granulation: 0.4, staining: 0.4, amount: 0.86 }, water: 0.55 }, stepsAfter: 80 },
  { stroke: { type: "dry-brush", radius: 16, path: [[415, 205], [445, 170], [480, 150], [515, 160], [545, 195]], pigment: { color: "#4d7a52", granulation: 0.6, staining: 0.4, amount: 1.32 }, water: 0.3 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 14, path: [[420, 180], [455, 145], [500, 130], [540, 150]], pigment: { color: "#5d8a5e", granulation: 0.55, staining: 0.4, amount: 1.25 }, water: 0.28 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 15, path: [[430, 220], [465, 195], [505, 185], [535, 205]], pigment: { color: "#3f6b47", granulation: 0.6, staining: 0.4, amount: 1.32 }, water: 0.3 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 13, path: [[450, 160], [475, 175], [505, 170]], pigment: { color: "#4d7a52", granulation: 0.55, staining: 0.4, amount: 1.12 }, water: 0.28 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 9, path: [[440, 190], [475, 175], [510, 195], [540, 180]], pigment: { color: "#3f6b47", granulation: 0.55, staining: 0.4, amount: 1.25 }, water: 0.25 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 8, path: [[460, 140], [490, 155], [520, 140]], pigment: { color: "#8fb98a", granulation: 0.45, staining: 0.35, amount: 0.99 }, water: 0.28 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 7, path: [[500, 145], [525, 165], [535, 190]], pigment: { color: "#8fb98a", granulation: 0.45, staining: 0.35, amount: 0.92 }, water: 0.28 }, stepsAfter: 50 },
  // —— 树干：连续收细 ribbon 骨干（光滑剪影）+ 树皮纹理层（裁剪在骨干内）+ 枝 ——
  { stroke: { type: "glaze", path: [[458, 212], [452, 258], [454, 300], [456, 336], [459, 358]], radius: 11, radiusEnd: 5, pigment: { color: "#6b4f3a", granulation: 0.55, staining: 0.55, amount: 1.81 }, water: 0.28 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 6, path: [[459, 216], [453, 262], [456, 308], [458, 348]], clip: "last-ribbon", pigment: { color: "#5d4232", granulation: 0.6, staining: 0.5, amount: 1.32 }, water: 0.13, grainBreak: 0.7, elongMin: 1.8, elongMax: 2.6, spacing: 0.55 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 5, path: [[456, 232], [438, 205], [428, 182]], pigment: { color: "#6b4f3a", granulation: 0.6, staining: 0.5, amount: 1.81 }, water: 0.14, grainBreak: 0.3, elongMin: 1.2, elongMax: 1.8, spacing: 0.7 }, stepsAfter: 40 },
  { stroke: { type: "dry-brush", radius: 4, path: [[455, 245], [470, 222], [480, 205]], pigment: { color: "#6b4f3a", granulation: 0.6, staining: 0.5, amount: 1.65 }, water: 0.13, grainBreak: 0.3, elongMin: 1.2, elongMax: 1.8, spacing: 0.7 }, stepsAfter: 40 },
  // —— 树底投影：单条渐隐条带 + 内核（不再是离散脚印）——
  { stroke: { type: "glaze", path: [[408, 370], [458, 366], [508, 372]], radius: 26, radiusEnd: 8, pigment: { color: "#9a8a63", granulation: 0.4, staining: 0.5, amount: 0.66 }, water: 0.55 }, stepsAfter: 60 },
  { stroke: { type: "glaze", path: [[436, 374], [460, 372], [488, 376]], radius: 14, radiusEnd: 5, pigment: { color: "#8a7a55", granulation: 0.4, staining: 0.5, amount: 0.86 }, water: 0.45 }, stepsAfter: 100 },
  // —— 前景草：向上挑的短笔触（不是横排圆点）——
  { stroke: { type: "dry-brush", radius: 6, path: [[70, 452], [78, 430]], pigment: { color: "#7a8a4d", granulation: 0.5, staining: 0.45, amount: 1.98 }, water: 0.3, elongMin: 1.6, elongMax: 2.4 }, stepsAfter: 90 },
  { stroke: { type: "dry-brush", radius: 5, path: [[140, 456], [150, 434]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.45, amount: 1.98 }, water: 0.3, elongMin: 1.6, elongMax: 2.4 }, stepsAfter: 90 },
  { stroke: { type: "dry-brush", radius: 6, path: [[250, 456], [260, 436]], pigment: { color: "#7a8a4d", granulation: 0.5, staining: 0.45, amount: 1.81 }, water: 0.28, elongMin: 1.6, elongMax: 2.4 }, stepsAfter: 90 },
  { stroke: { type: "dry-brush", radius: 5, path: [[560, 452], [572, 432]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.45, amount: 1.98 }, water: 0.3, elongMin: 1.6, elongMax: 2.4 }, stepsAfter: 90 },
  // —— 池塘 + 趁湿滴清水（回流开花；两朵大小区分）——
  { stroke: { type: "wet-wash", region: { cx: 108, cy: 345, rx: 100, ry: 42 }, pigment: { color: "#6f8fa8", granulation: 0.3, staining: 0.45, amount: 1.48 }, water: 0.8, layers: 1 }, stepsAfter: 25 },
  { stroke: { type: "re-wet", region: { cx: 98, cy: 340, rx: 16, ry: 16 }, water: 0.95 }, stepsAfter: 320 },
  { stroke: { type: "re-wet", region: { cx: 138, cy: 360, rx: 9, ry: 9 }, water: 0.95 }, stepsAfter: 320 },
  // —— 重颗粒沉淀（群青 puddle：稀释晕圈 + 高含水 → 透明梯度，不贴纸）——
  { stroke: { type: "wet-wash", region: { cx: 530, cy: 418, rx: 66, ry: 40 }, pigment: { color: "#3a4a7a", granulation: 1.0, staining: 0.7, amount: 0.65 }, water: 0.9, layers: 1 }, stepsAfter: 160 },
  { stroke: { type: "wet-wash", region: { cx: 530, cy: 418, rx: 50, ry: 29 }, pigment: { color: "#3a4a7a", granulation: 1.0, staining: 0.7, amount: 1.35 }, water: 0.7, layers: 2 }, stepsAfter: 260 },
  { stroke: { type: "lift", region: { cx: 235, cy: 428, rx: 38, ry: 18 }, liftP: 0.4, liftD: 0.3, water: 0.3 }, stepsAfter: 150 },
  // —— 树冠轮廓打破：两笔小半径 outlier dab（破圆形剪影）——
  { stroke: { type: "dry-brush", radius: 6, path: [[546, 214], [556, 226]], pigment: { color: "#5d8a5e", granulation: 0.5, staining: 0.4, amount: 1.65 }, water: 0.2 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 5, path: [[412, 218], [400, 232]], pigment: { color: "#4d7a52", granulation: 0.5, staining: 0.4, amount: 1.48 }, water: 0.2 }, stepsAfter: 50 },
];

export const DRY_STEPS = 600;      // 收尾干燥 10 秒
export const DRY_FRAME_EVERY = 30; // 每 0.5 秒一帧
export const EVO_FRAME_EVERY = 60; // 作画过程每 1 秒一帧
