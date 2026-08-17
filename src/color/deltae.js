// CIELAB 色差工具：ΔE76 / ΔE00（CIE 2000）/ 色相角差 / 色度差
// 色彩线验收尺子：浓/淡两档 × ΔE00 + ΔH + ΔC（见 out/color/PLAN.md）

/** ΔE76（旧基线用） */
export function deltaE76(l1, l2) {
  return Math.hypot(l1.L - l2.L, l1.a - l2.a, l1.b - l2.b);
}

/** CIE DE2000（kL=kC=kH=1，标准参考条件），输入 {L,a,b} */
export function deltaE00(l1, l2) {
  const L1 = l1.L, a1 = l1.a, b1 = l1.b;
  const L2 = l2.L, a2 = l2.a, b2 = l2.b;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : ((Math.atan2(b1, a1p) * 180 / Math.PI) + 360) % 360;
  const h2p = C2p === 0 ? 0 : ((Math.atan2(b2, a2p) * 180 / Math.PI) + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = (h1p + h2p + 360) / 2;
  const rad = (d) => d * Math.PI / 180;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp))
    + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.20 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(rad(2 * dTheta)) * RC;
  const dL = dLp / SL, dC = dCp / SC, dH = dHp / SH;
  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
}

/** 色相角差（度，带符号 -180..180）；任一色 C* < chromaFloor 时色相无意义 → 0 */
export function hueDiffDeg(l1, l2, chromaFloor = 8) {
  if (Math.hypot(l1.a, l1.b) < chromaFloor || Math.hypot(l2.a, l2.b) < chromaFloor) return 0;
  const h1 = Math.atan2(l1.b, l1.a) * 180 / Math.PI;
  const h2 = Math.atan2(l2.b, l2.a) * 180 / Math.PI;
  return ((h2 - h1 + 540) % 360) - 180;
}

/** 色度差：测 - 目标（正 = 过艳） */
export function chromaDiff(l1, l2) {
  return Math.hypot(l2.a, l2.b) - Math.hypot(l1.a, l1.b);
}
