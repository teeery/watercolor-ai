// 临摹《乡村田野》v3——P0-P2 重造：人字屋顶/天空负形云/通长树带/带茎麦穗/檐下蓝灰投影
export const scene = [
  // —— 天空：整片连续蓝洗（上深下浅）→ lift 负形云 ——
  { stroke: { type: "cover", region: { x0: -4, y0: -4, x1: 484, y1: 268 }, soft: 10, pigment: { color: "#86b0d8", granulation: 0.3, staining: 0.4, amount: 0.5 }, water: 0.75, layers: 1 }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: -4, y0: -4, x1: 484, y1: 96 }, soft: 14, pigment: { color: "#5f84ac", granulation: 0.35, staining: 0.45, amount: 0.5 }, water: 0.7, layers: 1 }, stepsAfter: 120 },
  { stroke: { type: "lift", region: { cx: 90, cy: 64, rx: 70, ry: 40 }, liftP: 0.7, liftD: 0.6, water: 0.25, push: 0 }, stepsAfter: 60 },
  { stroke: { type: "lift", region: { cx: 240, cy: 96, rx: 85, ry: 46 }, liftP: 0.7, liftD: 0.6, water: 0.25, push: 0 }, stepsAfter: 60 },
  { stroke: { type: "lift", region: { cx: 396, cy: 84, rx: 72, ry: 42 }, liftP: 0.7, liftD: 0.6, water: 0.25, push: 0 }, stepsAfter: 60 },
  { stroke: { type: "lift", region: { cx: 60, cy: 210, rx: 66, ry: 46 }, liftP: 0.6, liftD: 0.55, water: 0.22, push: 0 }, stepsAfter: 60 },
  { stroke: { type: "lift", region: { cx: 420, cy: 220, rx: 62, ry: 42 }, liftP: 0.6, liftD: 0.55, water: 0.22, push: 0 }, stepsAfter: 90 },
  // —— 通长树带（灰绿湿点，上虚下实）——
  { stroke: { type: "wet-wash", region: { cx: 60, cy: 330, rx: 62, ry: 24 }, pigment: { color: "#7a8a6f", granulation: 0.35, staining: 0.45, amount: 0.7 }, water: 0.55, layers: 1 }, stepsAfter: 40 },
  { stroke: { type: "wet-wash", region: { cx: 150, cy: 334, rx: 52, ry: 22 }, pigment: { color: "#748466", granulation: 0.35, staining: 0.45, amount: 0.65 }, water: 0.55, layers: 1 }, stepsAfter: 40 },
  { stroke: { type: "wet-wash", region: { cx: 250, cy: 328, rx: 46, ry: 20 }, pigment: { color: "#7a8a6f", granulation: 0.35, staining: 0.45, amount: 0.6 }, water: 0.55, layers: 1 }, stepsAfter: 40 },
  { stroke: { type: "wet-wash", region: { cx: 350, cy: 332, rx: 50, ry: 21 }, pigment: { color: "#748466", granulation: 0.35, staining: 0.45, amount: 0.65 }, water: 0.55, layers: 1 }, stepsAfter: 40 },
  { stroke: { type: "wet-wash", region: { cx: 435, cy: 330, rx: 55, ry: 23 }, pigment: { color: "#7a8a6f", granulation: 0.35, staining: 0.45, amount: 0.7 }, water: 0.55, layers: 1 }, stepsAfter: 150 },
  // —— 麦田底色（近浓远淡）——
  { stroke: { type: "cover", region: { x0: -4, y0: 348, x1: 484, y1: 560 }, soft: 14, pigment: { color: "#ecd78a", granulation: 0.2, staining: 0.4, amount: 0.6 }, water: 0.7, layers: 1 }, stepsAfter: 160 },
  { stroke: { type: "cover", region: { x0: -4, y0: 430, x1: 484, y1: 575 }, soft: 16, pigment: { color: "#d8b64a", granulation: 0.25, staining: 0.45, amount: 0.55 }, water: 0.6, layers: 1 }, stepsAfter: 180 },
  // —— 房屋 v6：山墙五边形朝观者 + 坡面退向右后方（透视正确的双坡顶）——
  { stroke: { type: "poly", points: [[242, 298], [270, 264], [300, 252], [330, 264], [358, 298]], soft: 2, pigment: { color: "#e0cb96", granulation: 0.08, staining: 0.4, amount: 2.0 }, water: 0.4, hard: true }, stepsAfter: 80 },
  { stroke: { type: "cover", region: { x0: 242, y0: 296, x1: 358, y1: 334 }, soft: 3, pigment: { color: "#e0cb96", granulation: 0.08, staining: 0.4, amount: 1.9 }, water: 0.4, hard: true }, stepsAfter: 80 },
  { stroke: { type: "cover", region: { x0: 308, y0: 300, x1: 358, y1: 334 }, soft: 3, pigment: { color: "#c4b48a", granulation: 0.15, staining: 0.4, amount: 0.7 }, water: 0.4, hard: true }, stepsAfter: 70 },
  { stroke: { type: "poly", points: [[166, 356], [194, 326], [224, 316], [254, 326], [282, 356]], soft: 2, pigment: { color: "#e0cb96", granulation: 0.08, staining: 0.4, amount: 2.0 }, water: 0.4, hard: true }, stepsAfter: 80 },
  { stroke: { type: "cover", region: { x0: 170, y0: 352, x1: 278, y1: 382 }, soft: 3, pigment: { color: "#e0cb96", granulation: 0.08, staining: 0.4, amount: 1.9 }, water: 0.4, hard: true }, stepsAfter: 80 },
  { stroke: { type: "cover", region: { x0: 235, y0: 362, x1: 322, y1: 380 }, soft: 3, pigment: { color: "#e0cb96", granulation: 0.08, staining: 0.4, amount: 1.9 }, water: 0.4, hard: true }, stepsAfter: 70 },
  // 左坡（面观者，暖赭） + 右坡（退向后，深棕）
  { stroke: { type: "poly", points: [[244, 264], [300, 250], [300, 292], [244, 300]], soft: 2, pigment: { color: "#9a6a40", granulation: 0.35, staining: 0.6, amount: 1.6 }, water: 0.42, hard: true }, stepsAfter: 80 },
  { stroke: { type: "poly", points: [[300, 250], [356, 262], [356, 300], [300, 292]], soft: 2, pigment: { color: "#6a4a2e", granulation: 0.35, staining: 0.6, amount: 1.7 }, water: 0.42, hard: true }, stepsAfter: 80 },
  { stroke: { type: "poly", points: [[168, 328], [224, 314], [224, 352], [168, 362]], soft: 2, pigment: { color: "#9a6a40", granulation: 0.35, staining: 0.6, amount: 1.5 }, water: 0.42, hard: true }, stepsAfter: 70 },
  { stroke: { type: "poly", points: [[224, 314], [280, 326], [280, 362], [224, 352]], soft: 2, pigment: { color: "#6a4a2e", granulation: 0.35, staining: 0.6, amount: 1.6 }, water: 0.42, hard: true }, stepsAfter: 70 },
  { stroke: { type: "poly", points: [[232, 366], [280, 348], [280, 376], [232, 390]], soft: 2, pigment: { color: "#9a6a40", granulation: 0.35, staining: 0.6, amount: 1.4 }, water: 0.42, hard: true }, stepsAfter: 60 },
  { stroke: { type: "poly", points: [[280, 348], [328, 366], [328, 390], [280, 376]], soft: 2, pigment: { color: "#6a4a2e", granulation: 0.35, staining: 0.6, amount: 1.5 }, water: 0.42, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 353, y0: 336, x1: 394, y1: 368 }, soft: 3, pigment: { color: "#8a5a3a", granulation: 0.35, staining: 0.6, amount: 1.5 }, water: 0.42, hard: true }, stepsAfter: 70 },
  // 檐下投影带（暖灰，贴檐口）
  { stroke: { type: "glaze", region: { cx: 300, cy: 290, rx: 58, ry: 5 }, pigment: { color: "#8a7a60", granulation: 0.3, staining: 0.5, amount: 0.45 }, water: 0.38 }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 224, cy: 348, rx: 52, ry: 5 }, pigment: { color: "#8a7a60", granulation: 0.3, staining: 0.5, amount: 0.45 }, water: 0.38 }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 280, cy: 370, rx: 44, ry: 4 }, pigment: { color: "#8a7a60", granulation: 0.3, staining: 0.5, amount: 0.4 }, water: 0.38 }, stepsAfter: 60 },
  // 瓦线 + 脊线
  { stroke: { type: "dry-brush", radius: 2, path: [[260, 272], [268, 254]], pigment: { color: "#5a3a28", granulation: 0.4, staining: 0.7, amount: 1.3 }, water: 0.2, spacing: 0.9 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 2, path: [[284, 266], [292, 250]], pigment: { color: "#5a3a28", granulation: 0.4, staining: 0.7, amount: 1.3 }, water: 0.2, spacing: 0.9 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 2, path: [[316, 266], [308, 250]], pigment: { color: "#5a3a28", granulation: 0.4, staining: 0.7, amount: 1.3 }, water: 0.2, spacing: 0.9 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 2, path: [[340, 272], [332, 254]], pigment: { color: "#5a3a28", granulation: 0.4, staining: 0.7, amount: 1.3 }, water: 0.2, spacing: 0.9 }, stepsAfter: 50 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[244, 281], [300, 240], [362, 281]], pigment: { color: "#4a3020", granulation: 0.35, staining: 0.7, amount: 1.5 }, water: 0.2 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[168, 341], [224, 312], [284, 341]], pigment: { color: "#4a3020", granulation: 0.35, staining: 0.7, amount: 1.4 }, water: 0.2 }, stepsAfter: 60 },
  // 窗（深暖棕）+ 中棚暗门洞
  { stroke: { type: "cover", region: { x0: 274, y0: 302, x1: 283, y1: 318 }, soft: 1, pigment: { color: "#5a3a28", granulation: 0.1, staining: 0.7, amount: 1.8 }, water: 0.28, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 185, y0: 356, x1: 194, y1: 370 }, soft: 1, pigment: { color: "#5a3a28", granulation: 0.1, staining: 0.7, amount: 1.8 }, water: 0.28, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 272, y0: 372, x1: 282, y1: 380 }, soft: 1, pigment: { color: "#5a3a28", granulation: 0.1, staining: 0.7, amount: 1.7 }, water: 0.26, hard: true }, stepsAfter: 60 },
  // 蓝廊栏：白底 + 竖向蓝条（原作竖条栏杆）
  { stroke: { type: "cover", region: { x0: 298, y0: 291, x1: 355, y1: 323 }, soft: 3, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.3 }, water: 0.4, hard: true }, stepsAfter: 80 },
  { stroke: { type: "cover", region: { x0: 302, y0: 293, x1: 306, y1: 321 }, soft: 1, pigment: { color: "#5f7cb8", granulation: 0.2, staining: 0.5, amount: 1.4 }, water: 0.32, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 314, y0: 293, x1: 318, y1: 321 }, soft: 1, pigment: { color: "#5f7cb8", granulation: 0.2, staining: 0.5, amount: 1.4 }, water: 0.32, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 326, y0: 293, x1: 330, y1: 321 }, soft: 1, pigment: { color: "#5f7cb8", granulation: 0.2, staining: 0.5, amount: 1.4 }, water: 0.32, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 338, y0: 293, x1: 342, y1: 321 }, soft: 1, pigment: { color: "#5f7cb8", granulation: 0.2, staining: 0.5, amount: 1.4 }, water: 0.32, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 350, y0: 293, x1: 354, y1: 321 }, soft: 1, pigment: { color: "#5f7cb8", granulation: 0.2, staining: 0.5, amount: 1.4 }, water: 0.32, hard: true }, stepsAfter: 60 },
  { stroke: { type: "wet-wash", path: [[300, 305], [354, 305]], radius: 2, radiusEnd: 2, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.5 }, water: 0.25, soft: 1.5 }, stepsAfter: 60 },
  // 石墙
  { stroke: { type: "dry-brush", radius: 3, path: [[300, 378], [460, 372]], pigment: { color: "#8a7a68", granulation: 0.5, staining: 0.5, amount: 1.2 }, water: 0.28, spacing: 0.7 }, stepsAfter: 70 },
  { stroke: { type: "spatter", center: { cx: 390, cy: 374 }, count: 26, spread: 85, pigment: { color: "#9a8a72", granulation: 0.5, staining: 0.5, amount: 1.3 }, water: 0.25 }, stepsAfter: 90 },
  // —— 麦田：房脚亮带 → 带茎麦穗簇 → 橙黄点簇 → 白点成簇 ——
  { stroke: { type: "glaze", region: { cx: 240, cy: 345, rx: 220, ry: 14 }, pigment: { color: "#f4e9b0", granulation: 0.15, staining: 0.35, amount: 0.45 }, water: 0.45 }, stepsAfter: 90 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[96, 468], [100, 440], [108, 452]], pigment: { color: "#a8842c", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.22, elongMin: 2.2, elongMax: 3.0, spacing: 0.8 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[150, 462], [146, 436], [140, 448]], pigment: { color: "#a8842c", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.22, elongMin: 2.2, elongMax: 3.0, spacing: 0.8 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[200, 456], [196, 430], [190, 442]], pigment: { color: "#a8842c", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.22, elongMin: 2.2, elongMax: 3.0, spacing: 0.8 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[300, 458], [296, 432], [290, 444]], pigment: { color: "#a8842c", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.22, elongMin: 2.2, elongMax: 3.0, spacing: 0.8 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[352, 462], [348, 436], [342, 448]], pigment: { color: "#a8842c", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.22, elongMin: 2.2, elongMax: 3.0, spacing: 0.8 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 2.5, path: [[402, 466], [398, 440], [392, 452]], pigment: { color: "#a8842c", granulation: 0.4, staining: 0.5, amount: 1.4 }, water: 0.22, elongMin: 2.2, elongMax: 3.0, spacing: 0.8 }, stepsAfter: 70 },
  { stroke: { type: "spatter", center: { cx: 200, cy: 480 }, count: 24, spread: 90, pigment: { color: "#c98a3c", granulation: 0.45, staining: 0.5, amount: 1.3 }, water: 0.3 }, stepsAfter: 120 },
  { stroke: { type: "spatter", center: { cx: 330, cy: 486 }, count: 22, spread: 85, pigment: { color: "#c98a3c", granulation: 0.45, staining: 0.5, amount: 1.3 }, water: 0.3 }, stepsAfter: 120 },
  { stroke: { type: "spatter", center: { cx: 260, cy: 500 }, count: 12, spread: 110, pigment: { color: "#a86a28", granulation: 0.45, staining: 0.55, amount: 1.3 }, water: 0.28 }, stepsAfter: 110 },
  { stroke: { type: "spatter", center: { cx: 190, cy: 440 }, count: 20, spread: 100, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.3 }, water: 0.22 }, stepsAfter: 90 },
  { stroke: { type: "spatter", center: { cx: 330, cy: 445 }, count: 20, spread: 95, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.3 }, water: 0.22 }, stepsAfter: 90 },
  // 雏菊
  { stroke: { type: "cover", region: { x0: 82, y0: 419, x1: 91, y1: 432 }, soft: 2, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.4 }, water: 0.3, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 125, y0: 419, x1: 134, y1: 432 }, soft: 2, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.4 }, water: 0.3, hard: true }, stepsAfter: 60 },
  { stroke: { type: "cover", region: { x0: 84, y0: 423, x1: 89, y1: 428 }, soft: 1, pigment: { color: "#d8b64a", granulation: 0.2, staining: 0.5, amount: 1.2 }, water: 0.28, hard: true }, stepsAfter: 50 },
  { stroke: { type: "cover", region: { x0: 127, y0: 423, x1: 132, y1: 428 }, soft: 1, pigment: { color: "#d8b64a", granulation: 0.2, staining: 0.5, amount: 1.2 }, water: 0.28, hard: true }, stepsAfter: 60 },
  // —— 前景草带：整宽底 → 弧形尖叶三色交错 ——
  { stroke: { type: "cover", region: { x0: -4, y0: 556, x1: 484, y1: 644 }, soft: 12, pigment: { color: "#6a8448", granulation: 0.4, staining: 0.5, amount: 0.6 }, water: 0.55, layers: 1 }, stepsAfter: 120 },
  { stroke: { type: "dry-brush", radius: 5, path: [[30, 622], [42, 552], [36, 516]], pigment: { color: "#7a8a4d", granulation: 0.45, staining: 0.45, amount: 1.6 }, water: 0.26, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 5, path: [[92, 626], [106, 556], [100, 522]], pigment: { color: "#7a8a4d", granulation: 0.45, staining: 0.45, amount: 1.6 }, water: 0.26, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 5, path: [[164, 624], [176, 554], [170, 518]], pigment: { color: "#7a8a4d", granulation: 0.45, staining: 0.45, amount: 1.6 }, water: 0.26, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 5, path: [[328, 628], [314, 558], [320, 522]], pigment: { color: "#7a8a4d", granulation: 0.45, staining: 0.45, amount: 1.6 }, water: 0.26, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 5, path: [[400, 626], [386, 556], [392, 520]], pigment: { color: "#7a8a4d", granulation: 0.45, staining: 0.45, amount: 1.6 }, water: 0.26, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 5, path: [[454, 624], [442, 554], [448, 518]], pigment: { color: "#7a8a4d", granulation: 0.45, staining: 0.45, amount: 1.6 }, water: 0.26, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 70 },
  { stroke: { type: "dry-brush", radius: 4, path: [[58, 632], [70, 570], [64, 540]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.5, amount: 1.6 }, water: 0.24, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 4, path: [[218, 634], [210, 572], [216, 542]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.5, amount: 1.6 }, water: 0.24, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 4, path: [[360, 636], [370, 574], [364, 544]], pigment: { color: "#5d7340", granulation: 0.5, staining: 0.5, amount: 1.6 }, water: 0.24, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 3.5, path: [[128, 638], [140, 584], [134, 556]], pigment: { color: "#3f5b33", granulation: 0.5, staining: 0.55, amount: 1.6 }, water: 0.22, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 3.5, path: [[280, 640], [272, 586], [278, 558]], pigment: { color: "#3f5b33", granulation: 0.5, staining: 0.55, amount: 1.6 }, water: 0.22, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 60 },
  { stroke: { type: "dry-brush", radius: 3.5, path: [[420, 638], [432, 584], [426, 556]], pigment: { color: "#3f5b33", granulation: 0.5, staining: 0.55, amount: 1.6 }, water: 0.22, elongMin: 1.8, elongMax: 2.4 }, stepsAfter: 70 },
  { stroke: { type: "glaze", region: { cx: 35, cy: 610, rx: 55, ry: 32 }, pigment: { color: "#33502a", granulation: 0.45, staining: 0.6, amount: 0.8 }, water: 0.5 }, stepsAfter: 90 },
  { stroke: { type: "glaze", region: { cx: 445, cy: 610, rx: 55, ry: 32 }, pigment: { color: "#33502a", granulation: 0.45, staining: 0.6, amount: 0.8 }, water: 0.5 }, stepsAfter: 90 },
  { stroke: { type: "spatter", center: { cx: 260, cy: 560 }, count: 18, spread: 170, pigment: { color: "#f2ede2", granulation: 0.1, staining: 0.5, amount: 1.3 }, water: 0.22 }, stepsAfter: 100 },
  // —— 收尾：房上云带改三团负形云（下缘起伏，蓝绕白走）——
  { stroke: { type: "lift", region: { cx: 170, cy: 224, rx: 66, ry: 30 }, liftP: 0.55, liftD: 0.5, water: 0.2, push: 0 }, stepsAfter: 80 },
  { stroke: { type: "lift", region: { cx: 300, cy: 230, rx: 58, ry: 26 }, liftP: 0.55, liftD: 0.5, water: 0.2, push: 0 }, stepsAfter: 80 },
  { stroke: { type: "lift", region: { cx: 410, cy: 218, rx: 62, ry: 28 }, liftP: 0.55, liftD: 0.5, water: 0.2, push: 0 }, stepsAfter: 110 },
];

export const DRY_STEPS = 700;
export const DRY_FRAME_EVERY = 35;
export const EVO_FRAME_EVERY = 50;
