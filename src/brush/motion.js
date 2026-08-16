// 运动层（brush dynamics v2 §5）——pressure/speed 包络 + 笔法动词编译
// 包络 = 控制点(1-5 个,值域[0,1])沿弧长 s∈[0,1] 分段线性插值;
// 缺省包络 = 旧 ribbon 的 rise/fall/belly 常量(v1 公式,legacy 行为回归之锚)。
// verb 编译表:verb 给骨架,显式数组覆盖细节。

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 控制点 → 分段线性包络(控制点均匀分布在 s∈[0,1]) */
function envelopeFromPoints(points) {
  const pts = points.map((v) => clamp01(v));
  if (pts.length === 1) return () => pts[0];
  const n = pts.length - 1;
  return (s) => {
    const t = clamp01(s) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    return pts[i] + (pts[i + 1] - pts[i]) * f;
  };
}

/** 旧 ribbon 缺省压力包络(与 strokes.js 原 rise/fall/belly 公式逐项一致) */
export function legacyPressure(s) {
  const rise = Math.min(1, s / 0.22);
  const fall = Math.min(1, (1 - s) / 0.30);
  const mid = Math.min(rise, fall);
  const belly = 1 - 0.18 * Math.sin(Math.PI * Math.min(1, s * 1.1));
  return (0.30 + 0.70 * mid) * belly;
}

/** 笔法动词编译表:verb → {pressure:[...], speed: 标量或数组} */
export const VERBS = {
  "扫":   { pressure: [0.5, 0.7, 0.5], speed: [0.4, 0.6, 0.4] },  // 湿铺
  "拖":   { pressure: [0.35, 0.5, 0.3], speed: 0.6 },              // 干皴长线
  "皴":   { pressure: [0.3, 0.6, 0.2, 0.5, 0.25], speed: 0.7 },    // 树冠纹理
  "点":   { pressure: [0.9, 0.0], speed: [0.05, 0.9] },             // 点厾:顿后快离
  "顿":   { pressure: [0.5, 0.9, 0.5], speed: [0.5, 0.05, 0.7] },   // 犹豫成洼
  "提":   { pressure: [0.5, 0.15], speed: 0.6 },                    // 收笔提尖
  "甩":   { pressure: [0.6, 0.4], speed: [0.9, 1.0] },              // 飞白点串
  "回锋": { pressure: [0.4, 0.5], speed: [0.3, 0.5] },              // 起笔
};

/** 校验:数组长度 ∈ [1,5]、值域 [0,1];speed 禁止 0(引擎侧 vMin 兜底)。越界抛错,不静默。 */
function validatePoints(arr, name) {
  if (!Array.isArray(arr)) {
    if (typeof arr !== "number" || !isFinite(arr) || arr < 0 || arr > 1) {
      throw new Error(`motion.${name} 值须 ∈ [0,1], got ${arr}`);
    }
    return [arr];
  }
  if (arr.length < 1 || arr.length > 5) throw new Error(`motion.${name} 数组长度须 ∈ [1,5], got ${arr.length}`);
  for (const v of arr) {
    if (typeof v !== "number" || !isFinite(v) || v < 0 || v > 1) {
      throw new Error(`motion.${name} 值须 ∈ [0,1], got ${v}`);
    }
  }
  return arr.map(clamp01);
}

/**
 * @param {object} motion { verb?, pressure?, speed? }
 * @returns {{ pressure:(s)=>number, speed:(s)=>number }}
 * 规则:verb 给骨架、数组覆盖细节、全缺省 = legacy 包络 + 中速。
 */
export function makeMotion(motion = {}) {
  let pressurePts, speedPts;
  if (motion.pressure !== undefined) {
    pressurePts = validatePoints(motion.pressure, "pressure");
  } else if (motion.verb && VERBS[motion.verb]) {
    pressurePts = validatePoints(VERBS[motion.verb].pressure, "pressure");
  } else {
    return {
      pressure: legacyPressure,
      speed: motion.speed !== undefined ? envelopeFromPoints(validatePoints(motion.speed, "speed")) : () => 0.5,
      legacy: true,
    };
  }
  if (motion.speed !== undefined) {
    speedPts = validatePoints(motion.speed, "speed");
  } else if (motion.verb && VERBS[motion.verb]) {
    speedPts = validatePoints(VERBS[motion.verb].speed, "speed");
  } else {
    speedPts = [0.5];
  }
  return {
    pressure: envelopeFromPoints(pressurePts),
    speed: envelopeFromPoints(speedPts),
    legacy: false,
  };
}
