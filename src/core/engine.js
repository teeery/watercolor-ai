// 水彩介质引擎核心（感知签名版，Curtis-lite）—— 通道数泛化版
// 场：W 水量 / P[c] 溶液颜料（NCH 通道）/ D[c] 沉积颜料 / Pm,Dm 质量 / M 湿掩码 / ux,uy 流速
// 每步管线：流场 → 水平流 → 颜料平流 → 沉积 → 前缘沉积(回流环) → 边缘加深 → 蒸发(咖啡环) → 冻结
// 通道语义由颜色系统（src/color/system.js）定义：RGB 系统 NCH=3；光谱系统 NCH=16。
// 引擎只搬运"每通道 K·d 吸收量"与质量 d，不理解通道含义 → 颜色/介质解耦。
// 参考：docs/watercolor_engine_spec.md（Hobbs 指南 + Curtis US6198489）
import { makePaper } from "../paper/paper.js";
import { fbm2D, valueNoise2D } from "../paper/noise.js";

const CLAMP = (v, a, b) => (v < a ? a : v > b ? b : v);

function bilerpAt(src, i00, tx, ty, w) {
  const v00 = src[i00], v10 = src[i00 + 1], v01 = src[i00 + w], v11 = src[i00 + w + 1];
  const a = v00 + (v10 - v00) * tx, b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

export class WatercolorEngine {
  /**
   * @param {object} opt { w, h, seed, params?, channels=3 }
   * channels = 颜料通道数（由 ColorSystem 决定）
   */
  constructor({ w = 640, h = 480, seed = 0, params = {}, channels = 3 } = {}) {
    this.w = w;
    this.h = h;
    this.n = w * h;
    this.seed = seed;
    this.stepCount = 0;
    this.ch = channels;

    this.paper = makePaper(w, h, { seed: seed, ...params.paper });

    this.W = new Float32Array(this.n);
    this.P = Array.from({ length: channels }, () => new Float32Array(this.n));
    this.D = Array.from({ length: channels }, () => new Float32Array(this.n));
    this.Pm = new Float32Array(this.n);
    this.Dm = new Float32Array(this.n);
    this.M = new Uint8Array(this.n);
    this.ux = new Float32Array(this.n); this.uy = new Float32Array(this.n);
    // scratch（每通道一份，供平流/回流算子用）
    this._sP = Array.from({ length: channels }, () => new Float32Array(this.n));
    this._s2 = new Float32Array(this.n);
    this._s3 = new Float32Array(this.n);
    this._Mb = new Float32Array(this.n);
    // M0 性能：活跃集（W>0 的格）+ 反向索引 + 坐标镜像 + 本步新湿格列表（替代 T 数组）
    this._al = new Uint32Array(this.n);
    this._alCount = 0;
    this._alIdx = new Int32Array(this.n).fill(-1);
    this._alx = new Uint16Array(this.n);
    this._aly = new Uint16Array(this.n);
    this._tl = new Uint32Array(this.n);
    this._tlCount = 0;
    // M1 σ 钉扎 scratch：depositMask 中被钉扎的格 + 其 mask 值
    this._pinBuf = new Uint32Array(this.n);
    this._pinM = new Float32Array(this.n);
    // M2.3：本笔"旧湿格"标记（宏观侵蚀的湿接保护）
    this._om = new Uint8Array(this.n);
    // 孤儿集：W>0 但在迭代 bbox 之外的格（bbox 版不处理它们，直到 bbox 扩张或尾部蒸发）
    this._ol = new Uint32Array(this.n);
    this._olCount = 0;
    this._olIdx = new Int32Array(this.n).fill(-1);
    this._olx = new Uint16Array(this.n);
    this._oly = new Uint16Array(this.n);
    this._lastMaxU = Infinity;  // 上一步最大流速（静止短路判断用）
    this._qDirty = true;        // 有新水注入 → 下步强制完整管线

    // 默认参数（每步率）
    this.p = {
      kPress: 0.4,      // 压力→流速
      gravity: 0.025,   // 重力（向下）
      advCoef: 0.9,     // 水半拉格朗日系数
      kDiff: 0.075,     // 水扩散
      theta: 0.10,      // 湿掩码扩张阈值
      deposit: 0.028,   // 沉积率/步（低 → 颜料保持流动，回流才有料可推）
      exposure: 1.5,    // 纸高对沉积的影响
      frontDeposit: 0.18, // 前缘(0→1)沉积率 → 回流环
      edgeK: 0.45,      // 湿区边缘加深率
      blurR: 3,         // 边缘模糊半径（格）
      evap: 0.010,      // 蒸发率/步
      evapEdge: 2.5,    // 边缘蒸发加速
      epsDry: 0.004,    // 冻结阈值
      pigAdv: 0.65,     // 颜料半拉格朗日系数（滞后于水 → 水走前、颜料留后）
      quiescentU: 0,    // 静止短路阈值：max|u| 低于它则跳过流场+两级平流（0=关，行为保持）
      anisoDiff: 0.25,  // M1：扩散各向异性（辅助机制；MoXi 主机制是 σ 钉扎 + κ 变渗透率）
      kFib: 0.1,        // M1：流场沿纤维耦合（辅助，防"木纹滤镜"）
      kSlope: 0.4,      // M1：纸坡 ∇H 入流场（Montesdeoca 指针①，替换 G 噪声扰动）
      kappaG: 0.35,     // M1：κ 变渗透率的纸纹分量
      kappaF: 0.3,      // M1：κ 的固着堵塞反馈分量（沉积多 → 渗透率低 → 分支纹）
      sigma0: 0.08,     // M1：σ 钉扎基阈（0 = 关钉扎）
      sigmaG: 0.05,     // M1：σ 的纸纹分量
      sigmaP: 0.06,     // M1：σ 的颜料密度分量（重湿处更钉）
      sigmaL: 0.03,     // M1：σ 的沿纤维线段纹理分量
      sigmaM: 0.06,     // M2.1：σ 的低频宏观分量（30-60 格波长缺口/半岛，破圆润宏观轮廓）
      macroCut: 8,      // M2.2：宏观侵蚀最深格数（新湿格边界按宏观噪声迭代蚀除，突破软边宽度限制）
      macroThresh: 0.72, // M2.2：宏观侵蚀的噪声阈值（>此值才蚀）
      macroMinWater: 0.55, // M2.3：宏观侵蚀的水量门限（低水细笔触不蚀，防"树干被咬断"）
      hindrance: 0.5,   // M1：阻滞强度（颜料横纤维流速打折 → 方向颗粒/沉积断裂的物理版）
      hindRange: 0.5,   // M1：阻滞随 |u| 上升的平滑区间
      fixRate: 0.5,     // M1：渐变固着率/步（MoXi SIMULATEFIXTURE，替换二值冻结）
      capLam: 3.0,      // M1：容纸度 max(1−ρ/λ, m) 的 λ
      capMin: 0.35,     // M1：容纸度的下限 m
      shoreK: 0.65,     // M2：岸线算子总开关（0=关；干燥速度驱动的向内输运）——集成调参：大水量湿铺色块上原 1.0 掏空邻居成"闪电白"，柔化
      shoreCurv: 0.5,   // M2：曲率调制（弯处水线浓，直线段淡/断）——集成调参：0.8 在噪声边界上放大成折线 artifact
      shoreSplit: 0.5,  // M2：granulation 分档（重颗粒少被拉向水线，滞留透明带沉淀）
      shoreBreak: 0.7,  // M2：沿切线噪声断环深度（0=连续环，1=全断）
      gravRun: 0,      // M4：重力淌色强度（0=关；高含水区向下淌流 + 沿 x 的纵向通道噪声 → 滴流/淌痕）
      runW0: 0.2,      // M4：淌色触发水量阈值（低阈值 → 淌动窗口更长）
      dripThresh: 0.10, // M4：滴流推进阈值（底部水压 × 通道噪声 > 阈值 → 前沿向下推一格）
      diffusion: 0.02,  // M5：颜料溶液扩散基率（湿中混色互渗；×每颜料 diffusivity）
      massLag: 0.35,    // M5：粒重平流滞后强度（重颜料走得慢 → 分离）
      ...params,
    };

    // 当前颜料属性（每笔设置）：K = 每通道吸收/散射比 × 单位质量
    this.pigment = { K: new Float32Array(channels), granulation: 0.5, staining: 0.5 };

    this._bbox = { x0: 0, y0: 0, x1: 0, y1: 0, valid: false };
    this.debugHook = null; // (stageName, engine) => void
  }

  /** K：单位质量的每通道吸收系数（由 ColorSystem.pigmentBasis 提供）；granulation/staining 0..1
   *  M5：物性四字段 transparency/rewetRate/diffusivity/mass——
   *  未提供时按 granulation/staining 推导（颜料库数据化后可直接传入覆盖，替换缝在此） */
  setPigment({ K, granulation = 0.5, staining = 0.5, transparency, rewetRate, diffusivity, mass } = {}) {
    this.pigment.K.set(K);
    this.pigment.granulation = granulation;
    this.pigment.staining = staining;
    this.pigment.transparency = transparency ?? Math.max(0, Math.min(1, 1 - staining * 0.7 - granulation * 0.2));
    this.pigment.rewetRate = rewetRate ?? 0.35 + 0.55 * (1 - staining);
    this.pigment.diffusivity = diffusivity ?? 0.3 + 0.5 * (1 - staining);
    this.pigment.mass = mass ?? 0.3 + 0.6 * granulation;
  }

  /** 格是否在（已 padding、已钳制到画布的）迭代 bbox 内 */
  _isInPaddedBBox(x, y) {
    const b = this._bbox;
    if (!b.valid) return false;
    const pad = 2 + this.p.blurR;
    return x >= Math.max(0, b.x0 - pad) && x <= Math.min(this.w - 1, b.x1 + pad)
      && y >= Math.max(0, b.y0 - pad) && y <= Math.min(this.h - 1, b.y1 + pad);
  }

  /** 活跃集维护：W 从 0 变正时入列；bbox 外的格进孤儿集（复刻 bbox 版"不处理"语义） */
  _pushActive(i) {
    if (this._alIdx[i] >= 0 || this._olIdx[i] >= 0) return;
    const x = i % this.w, y = (i / this.w) | 0;
    if (this._isInPaddedBBox(x, y)) {
      const s = this._alCount++;
      this._al[s] = i;
      this._alIdx[i] = s;
      this._alx[s] = x;
      this._aly[s] = y;
    } else {
      const s = this._olCount++;
      this._ol[s] = i;
      this._olIdx[i] = s;
      this._olx[s] = x;
      this._oly[s] = y;
    }
  }

  /** 活跃集维护：冻结/蒸干时出列（swap-with-last，O(1)） */
  _removeActive(i) {
    const a = this._alIdx, al = this._al;
    const s = a[i];
    if (s < 0) return;
    const last = --this._alCount;
    if (s !== last) {
      const j = al[last];
      al[s] = j;
      this._alx[s] = this._alx[last];
      this._aly[s] = this._aly[last];
      a[j] = s;
    }
    a[i] = -1;
  }

  /** 孤儿集出列（swap-with-last，O(1)） */
  _removeOrphan(i) {
    const a = this._olIdx, ol = this._ol;
    const s = a[i];
    if (s < 0) return;
    const last = --this._olCount;
    if (s !== last) {
      const j = ol[last];
      ol[s] = j;
      this._olx[s] = this._olx[last];
      this._oly[s] = this._oly[last];
      a[j] = s;
    }
    a[i] = -1;
  }

  /** bbox 变化（收紧/扩张）后重新分流：孤儿入列、主列格出列 */
  _resyncBBoxLists() {
    for (let k = 0; k < this._olCount; k++) {
      const i = this._ol[k];
      if (this._isInPaddedBBox(this._olx[k], this._oly[k])) {
        this._removeOrphan(i);
        this._pushActive(i);
        k--;
      }
    }
    for (let k = 0; k < this._alCount; k++) {
      const i = this._al[k];
      if (!this._isInPaddedBBox(this._alx[k], this._aly[k])) {
        this._removeActive(i);
        this._pushActive(i);
        k--;
      }
    }
  }

  /** 溶液总吸收量（任意通道） */
  solutionTotal(i) {
    let s = 0;
    for (let c = 0; c < this.ch; c++) s += this.P[c][i];
    return s;
  }

  /** M2.2/M2.3 宏观噪声场（σ 钉扎与宏观侵蚀共用）：低频 + 中频混合，轮廓更毛糙（防"圆盘咬口"） */
  _macroNoise(x, y) {
    return (fbm2D(x * 0.03 + 5.1, y * 0.03 + 8.7, { octaves: 2, seed: 83 })
      + 0.45 * fbm2D(x * 0.11 + 1.7, y * 0.11 + 4.3, { octaves: 2, seed: 97 })) / 1.45;
  }

  /** M1 σ 钉扎阈值（MoXi §5.3.3 式9 的落地）：
   *  σ = σ0 + σg·(G−0.5)·2 + σp·min(1, Ptotal·0.5) + σl·(沿纤维线段噪声−0.5)·2
   *      + σm·(宏观噪声−0.5)·2   ← M2.1：宏观缺口/半岛 */
  _sigmaAt(i) {
    const { G, Tx, Ty } = this.paper;
    const p = this.p;
    let pt = 0;
    for (let c = 0; c < this.ch; c++) pt += this.P[c][i];
    const x = i % this.w, y = (i / this.w) | 0;
    const a = x * Tx[i] + y * Ty[i], b = -x * Ty[i] + y * Tx[i];
    const line = valueNoise2D(a * 0.04 + 2.7, b * 0.35, 61);
    const mac = this._macroNoise(x, y);
    return p.sigma0 + p.sigmaG * (G[i] - 0.5) * 2 + p.sigmaP * Math.min(1, pt * 0.5)
      + p.sigmaL * (line - 0.5) * 2 + p.sigmaM * (mac - 0.5) * 2;
  }

  /** 沉积注入：mask 为 [0,1] Float32Array（已含形状与软边），water 0..1，amount 颜料质量
   *  M1：新湿格受 σ 钉扎（低水/高钉扎区前沿回退 → 毛边），钉扎格可沿纤维爬行润湿
   *  M4：hard = true 时跳过钉扎/爬行/宏观侵蚀 → 利落硬边（配合 soft≈0.5 的锐 mask） */
  depositMask(mask, { water = 0.5, amount = 0.8, hard = false } = {}) {
    const { w, h, W, P, Pm, D, Dm, M, ch } = this;
    const { C, G, Tx, Ty } = this.paper;
    const K = this.pigment.K;
    const bbox = this._bbox;
    const p = this.p;
    this._qDirty = true;
    const pinBuf = this._pinBuf, pinM = this._pinM;
    let pinCount = 0;
    const newWet = this._tl; // 本笔新湿格（M2.2 宏观侵蚀用；_tl 阶段间空闲）
    let newCount = 0;
    this._om.fill(0);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const m = mask[i];
        if (m <= 0) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        const aM = amount * m;
        if (!M[i]) {
          // M1 σ 钉扎：局部水量低于钉扎阈值 → 前沿回退（毛边/锯齿前沿的成因）
          const wAdd = water * m * (0.3 + 0.9 * C[i]);
          if (!hard && p.sigma0 > 0 && wAdd < this._sigmaAt(i)) {
            pinBuf[pinCount] = i;
            pinM[pinCount] = m;
            pinCount++;
            continue;
          }
          const w0 = W[i];
          W[i] = Math.min(2.0, W[i] + wAdd);
          if (w0 <= 0 && W[i] > 0) this._pushActive(i);
          // 新湿格：笔触边界即刻钉出前缘沉积线（水彩标志性深边）
          const grain = G[i] - 0.5;
          const fk = p.frontDeposit * (0.6 + 0.8 * grain);
          for (let c = 0; c < ch; c++) {
            const aK = K[c] * aM;
            D[c][i] += aK * fk;
            P[c][i] += aK * (1 - fk);
          }
          Dm[i] += aM * fk;
          Pm[i] += aM * (1 - fk);
          M[i] = 1;
          newWet[newCount++] = i;
        } else {
          this._om[i] = 1; // 本笔前已湿（湿接保护用）
          const w0 = W[i];
          W[i] = Math.min(2.0, W[i] + water * m * (0.3 + 0.9 * C[i]));
          if (w0 <= 0 && W[i] > 0) this._pushActive(i);
          for (let c = 0; c < ch; c++) P[c][i] += K[c] * aM;
          Pm[i] += aM;
        }
      }
    }
    // M1 毛细爬行：钉扎格沿纤维方向的邻格已湿 → 爬行润湿（方向性 toe/分支）
    if (!hard) for (let t = 0; t < pinCount; t++) {
      const i = pinBuf[t];
      const m = pinM[t];
      const x = i % w, y = (i / w) | 0;
      const fx = Math.abs(Tx[i]) >= Math.abs(Ty[i]);
      const dx = fx ? (Tx[i] >= 0 ? 1 : -1) : 0;
      const dy = fx ? 0 : (Ty[i] >= 0 ? 1 : -1);
      let crawled = false;
      for (const sgn of [1, -1]) {
        const nx = x + dx * sgn, ny = y + dy * sgn;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (M[ny * w + nx]) { crawled = true; break; }
      }
      if (!crawled) continue;
      const w0 = W[i];
      W[i] = Math.min(2.0, W[i] + water * m * (0.3 + 0.9 * C[i]));
      if (w0 <= 0 && W[i] > 0) this._pushActive(i);
      const aM = amount * m;
      const grain = G[i] - 0.5;
      const fk = p.frontDeposit * (0.6 + 0.8 * grain);
      for (let c = 0; c < ch; c++) {
        const aK = K[c] * aM;
        D[c][i] += aK * fk;
        P[c][i] += aK * (1 - fk);
      }
      Dm[i] += aM * fk;
      Pm[i] += aM * (1 - fk);
      M[i] = 1;
      newWet[newCount++] = i;
    }
    // M2.2/M2.3 宏观侵蚀：新湿格边界按宏观噪声迭代蚀除（缺口深度跟随噪声值）
    //  M2.3 保护：低水笔触不蚀；与旧湿格相邻处不蚀（湿接白缝）
    //  M2.4：湿邻保护扩到 8 邻域；阈值加高频抖动（消直角方冲）；深度随笔触尺寸自适应
    if (!hard && p.macroCut > 0 && water >= p.macroMinWater) {
      const minDim = Math.min(x1 - x0, y1 - y0);
      const cutN = Math.min(p.macroCut, Math.max(4, Math.round(0.11 * minDim)));
      for (let iter = 0; iter < cutN; iter++) {
        let cutAny = false;
        for (let t = 0; t < newCount; t++) {
          const i = newWet[t];
          if (!M[i]) continue;
          const x = i % w, y = (i / w) | 0;
          const isEdge = (x > 0 && !M[i - 1]) || (x < w - 1 && !M[i + 1])
            || (y > 0 && !M[i - w]) || (y < h - 1 && !M[i + w]);
          if (!isEdge) continue;
          // 8 邻域旧湿保护
          let nearOld = false;
          for (let dy = -1; dy <= 1 && !nearOld; dy++) {
            for (let dx = -1; dx <= 1 && !nearOld; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (this._om[ny * w + nx]) nearOld = true;
            }
          }
          if (nearOld) continue;
          if (this._macroNoise(x, y) > p.macroThresh) {
            W[i] = 0;
            for (let c = 0; c < ch; c++) { P[c][i] = 0; D[c][i] = 0; }
            Pm[i] = 0; Dm[i] = 0;
            M[i] = 0;
            this._removeActive(i);
            cutAny = true;
          }
        }
        if (!cutAny) break;
      }
    }
    if (x1 >= x0) {
      if (!bbox.valid) { bbox.x0 = x0; bbox.y0 = y0; bbox.x1 = x1; bbox.y1 = y1; bbox.valid = true; }
      else {
        if (x0 < bbox.x0) bbox.x0 = x0;
        if (y0 < bbox.y0) bbox.y0 = y0;
        if (x1 > bbox.x1) bbox.x1 = x1;
        if (y1 > bbox.y1) bbox.y1 = y1;
      }
      this._resyncBBoxLists();
    }
  }

  /** 清色（lift）：mask 内溶液与沉积按比例移除，加少量水；
   *  dir = 擦拭方向（弧度），残留噪声沿该方向拉伸 → 平行条纹沟槽
   *  M4：被移除的颜料沿 dir 推挤 → 起收笔边缘堆挤（known issue #6） */
  liftMask(mask, { liftP = 0.6, liftD = 0.35, water = 0.3, dir = 0, push = 0.5 } = {}) {
    const { w, h, W, P, Pm, D, Dm, ch, _sP, _s2 } = this;
    const ca = Math.cos(dir), sa = Math.sin(dir);
    const dxi = Math.round(ca), dyi = Math.round(sa);
    this._qDirty = true;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const m = mask[i];
        if (m <= 0) continue;
        const a = x * ca + y * sa;
        const bb = -x * sa + y * ca;
        const streak = 0.4 + 1.2 * Math.abs(valueNoise2D(a * 0.06 + 5.3, bb * 0.5, 89) - 0.5);
        const kP = 1 - liftP * m * streak;
        const kD = 1 - liftD * m * streak;
        for (let c = 0; c < ch; c++) {
          _sP[c][i] = (P[c][i] * (1 - kP) + D[c][i] * (1 - kD)) * push;
          P[c][i] *= kP; D[c][i] *= kD;
        }
        _s2[i] = (Pm[i] * (1 - kP) + Dm[i] * (1 - kD)) * push;
        Pm[i] *= kP; Dm[i] *= kD;
        const w0 = W[i];
        W[i] = Math.min(2.0, W[i] + water * m);
        if (w0 <= 0 && W[i] > 0) this._pushActive(i);
      }
    }
    // 第二趟：被推挤的颜料沉积到擦拭前进方向的邻格（mask 边缘处自然堆积）
    if (push > 0) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          if (mask[i] <= 0) continue;
          const nx = x + dxi, ny = y + dyi;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const n = ny * w + nx;
          for (let c = 0; c < ch; c++) D[c][n] += _sP[c][i];
          Dm[n] += _s2[i];
        }
      }
    }
  }

  /** M4 盐花：盐晶吸色推色（心部亮斑 + 外围沉积环 + 星形臂），纯形态算子 */
  saltMask(cx, cy, r, { arms = 6, lift = 0.55, absorb = 0.25 } = {}) {
    const { w, h, W, P, Pm, D, Dm, ch } = this;
    this._qDirty = true;
    const R = Math.ceil(r * 1.3);
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        const i = row + x;
        const ang = Math.atan2(dy, dx);
        const star = 0.55 + 0.45 * Math.abs(Math.cos(ang * arms * 0.5)); // M4.1：瓣加宽（谷地板 0.55）→ 臂读得出来
        if (d < r * star) {
          // 盐晶吸色：心部颜料被推开（亮斑，D 通道全量吸 → 近白盐眼）
          for (let c = 0; c < ch; c++) { P[c][i] *= 1 - lift; D[c][i] *= 1 - lift; }
          Pm[i] *= 1 - lift; Dm[i] *= 1 - lift;
          W[i] = Math.max(0, W[i] - absorb);
        } else if (d < r * 1.3) {
          // 外围沉积环（被推开的颜料聚在盐晶周围）
          let amb = 0;
          for (let c = 0; c < ch; c++) amb += P[c][i] + D[c][i];
          if (amb > 1e-5) {
            const span = r * 1.3 - r * star;
            const kk = 0.5 * (1 - Math.max(0, d - r * star) / span); // M4：暗环更强
            for (let c = 0; c < ch; c++) { D[c][i] += (P[c][i] + D[c][i]) * kk; P[c][i] *= 1 - kk; }
            Dm[i] += (Pm[i] + Dm[i]) * kk; Pm[i] *= 1 - kk;
          }
        }
      }
    }
  }

  /** M3：曲率驱动半径剖面（菜花失稳的玩具模型）：
   *  R ← R + dt·(vc·(κ̄−κ(θ)) + vn·noise(θ)) + D·R'' —— 低曲率处生长、高曲率凹口停驻，
   *  曲率扩散项把尖角抹圆（圆润由构造保证）；谷地板防 V 形尖凹口；均值归位保环径。 */
  _bloomProfile(radius, seed) {
    const N = 256;
    const R = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const th = (j / N) * Math.PI * 2;
      const n = fbm2D(Math.cos(th) * 1.4 + seed * 0.7, Math.sin(th) * 1.4 - seed * 0.3, { octaves: 3, seed: 101 });
      R[j] = radius * (1 + 0.06 * (n - 0.5) * 2);
    }
    const nArr = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const th = (j / N) * Math.PI * 2;
      nArr[j] = fbm2D(Math.cos(th) * 2.1 + seed * 1.1, Math.sin(th) * 2.1 + seed * 0.9, { octaves: 2, seed: 211 });
    }
    const dt = 0.3, vc = 0.6, vn = 0.05, diff = 0.15;
    const kaps = new Float32Array(N);
    for (let it = 0; it < 22; it++) {
      const prev = R.slice();
      let kapMean = 0;
      for (let j = 0; j < N; j++) {
        const jm = (j + N - 1) % N, jp = (j + 1) % N;
        const R1 = (prev[jp] - prev[jm]) * 0.5;
        const R2 = prev[jp] - 2 * prev[j] + prev[jm];
        const denom = Math.pow(prev[j] * prev[j] + R1 * R1, 1.5) + 1e-9;
        // 无量纲曲率 κ·R（生长率与前沿尺度匹配）
        kaps[j] = ((prev[j] * prev[j] + 2 * R1 * R1 - prev[j] * R2) / denom) * prev[j];
        kapMean += kaps[j];
      }
      kapMean /= N;
      for (let j = 0; j < N; j++) {
        const jm = (j + N - 1) % N, jp = (j + 1) % N;
        const R2 = prev[jp] - 2 * prev[j] + prev[jm];
        R[j] = prev[j] * (1 + dt * (vc * (kapMean - kaps[j]) + vn * (nArr[j] - 0.5) * 2)) + diff * R2;
        if (R[j] < radius * 0.55) R[j] = radius * 0.55;
        if (R[j] > radius * 1.55) R[j] = radius * 1.55;
      }
    }
    // 花瓣谷地板：凹口肥圆不尖
    for (let j = 0; j < N; j++) if (R[j] < radius * 0.86) R[j] = radius * 0.86;
    // 均值归位
    let mean = 0;
    for (let j = 0; j < N; j++) mean += R[j];
    mean /= N;
    const s = radius / mean;
    for (let j = 0; j < N; j++) R[j] *= s;
    return { prof: R, noise: nArr }; // M2.2：噪声场一并返回，供 rim 亮度/宽度调制
  }

  /** 清水滴回流开花算子（显式搬运版，通道泛化）：
   *  内区 (d<Rθ) 溶液+沉积颜料按比例扣走 → 沿同角度搬到噪声调制的前沿带钉入沉积
   *  → 深色蕾丝环必然成形；滴心稀释 → 浅色水渍心。
   *  M3：形状生成器换曲率驱动半径剖面（表驱动）；质量守恒搬运机制不动。 */
  pushPigmentRadial(cx, cy, radius, strength = 24, seed) {
    const { w, h, P, Pm, D, Dm, paper, ch, _sP } = this;
    const { F } = paper;
    if (seed === undefined) {
      if (this._bloomCount === undefined) this._bloomCount = 0;
      seed = this._bloomCount++ * 13.7 + radius * 0.31;
    }
    const { prof, noise: profNoise } = this._bloomProfile(radius, seed);
    const N = prof.length;
    const profAt = (ang) => {
      let t = ang % (Math.PI * 2);
      if (t < 0) t += Math.PI * 2;
      t = (t / (Math.PI * 2)) * N;
      const j0 = t | 0, j1 = (j0 + 1) % N, f = t - j0;
      return prof[j0] * (1 - f) + prof[j1] * f;
    };
    const noiseAt = (ang) => {
      let t = ang % (Math.PI * 2);
      if (t < 0) t += Math.PI * 2;
      t = (t / (Math.PI * 2)) * N;
      const j0 = t | 0, j1 = (j0 + 1) % N, f = t - j0;
      return profNoise[j0] * (1 - f) + profNoise[j1] * f;
    };
    for (let c = 0; c < ch; c++) _sP[c].set(P[c]);
    const R = radius + strength + 4;
    const x0 = Math.max(0, Math.floor(cx - R));
    const x1 = Math.min(w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R));
    const y1 = Math.min(h - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx);
        const Rθ = profAt(ang);
        // 圆心格：只扣走、无搬运目的地（消除中心黑点伪影）
        if (d <= 0.01) {
          const k = 0.55;
          for (let c = 0; c < ch; c++) { P[c][i] *= 1 - k; D[c][i] *= 1 - k; }
          Pm[i] *= 1 - k; Dm[i] *= 1 - k;
          continue;
        }
        if (d >= Rθ) continue;
        const nz = (F[i] - 0.5) * 1.6;
        const k = 0.45 * (0.7 + 0.6 * nz);
        const kD = k * (0.3 + 1.4 * this.pigment.rewetRate); // M5：再湿率——高重湿颜料沉积层易被重新溶解
        const mv = new Array(ch);
        let total = 0;
        for (let c = 0; c < ch; c++) {
          const pc = _sP[c][i] * k, dc = D[c][i] * kD;
          P[c][i] = _sP[c][i] - pc;
          D[c][i] -= dc;
          mv[c] = (pc + dc) * 0.9;
          total += mv[c];
        }
        const pmv = Pm[i] * k, dmv = Dm[i] * kD;
        Pm[i] -= pmv; Dm[i] -= dmv;
        const mm = (pmv + dmv) * 0.9;
        if (total <= 1e-6) continue;
        const inv = 1 / d;
        const nx = dx * inv, ny = dy * inv;
        const aJit = (F[(x + 29) % w + ((y + 7) % h) * w] - 0.5) * 0.35;
        const ca = Math.cos(ang + aJit), sa = Math.sin(ang + aJit);
        const jit = (F[(x + 17) % w + ((y + 13) % h) * w] - 0.5) * radius * 0.28;
        const destR = Rθ * (1 + 0.08 * nz) + jit;
        const petal = 0.55 + 0.45 * Math.min(1, Math.max(0, (Rθ / radius - 1) / 0.35)); // 瓣尖溅射更浓
        const rim = 0.7 + 0.5 * noiseAt(ang); // M2.2：环亮度沿角度缓变，消"均匀描边感"
        const bandW = (1.5 + 2.5 * (0.5 + 0.5 * nz)) * (0.8 + 0.4 * noiseAt(ang));
        const splat = (rr, frac) => {
          let fx = cx + ca * rr, fy = cy + sa * rr;
          fx = fx < 0 ? 0 : fx > w - 1.001 ? w - 1.001 : fx;
          fy = fy < 0 ? 0 : fy > h - 1.001 ? h - 1.001 : fy;
          const x0f = fx | 0, y0f = fy | 0, tx = fx - x0f, ty = fy - y0f;
          const f = frac * petal * rim;
          const j00 = y0f * w + x0f;
          const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
          for (let c = 0; c < ch; c++) {
            const mc = mv[c] * f;
            D[c][j00] += mc * w00; D[c][j00 + 1] += mc * w10; D[c][j00 + w] += mc * w01; D[c][j00 + w + 1] += mc * w11;
          }
          const mf = mm * f;
          Dm[j00] += mf * w00; Dm[j00 + 1] += mf * w10; Dm[j00 + w] += mf * w01; Dm[j00 + w + 1] += mf * w11;
        };
        splat(destR - 1, 0.5);
        splat(destR + bandW * 0.5, 0.32);
        splat(destR + bandW, 0.18);
        splat(destR + bandW + 2, 0.08);
        splat(destR + bandW + 5, 0.05);
        splat(destR + bandW + 8, 0.02);
        splat(0.62 * Rθ, 0.10);
      }
    }
    // 解析增强：环带闭合性由构造保证
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 0.01 || d > radius + strength + 4) continue;
        const ang = Math.atan2(dy, dx);
        const Rθ = profAt(ang);
        let amb = 0;
        for (let c = 0; c < ch; c++) amb += D[c][i] + P[c][i];
        if (amb <= 1e-5) continue;
        const t = Math.abs(d - Rθ);
        if (t < 4.0) {
          const wgt = (1 - t / 4.0) * (0.55 + 0.9 * (F[i] - 0.5));
          const boost = 0.5 * wgt * (0.7 + 0.5 * noiseAt(ang)); // M2.2：环亮度随角度缓变
          for (let c = 0; c < ch; c++) {
            D[c][i] += (D[c][i] + P[c][i]) * boost;
            P[c][i] *= 1 - boost;
          }
          Dm[i] += (Dm[i] + Pm[i]) * boost;
          Pm[i] *= 1 - boost;
        }
        const t2 = Math.abs(d - 0.6 * Rθ);
        if (t2 < 1.6) {
          const wgt = (1 - t2 / 1.6) * 0.28;
          for (let c = 0; c < ch; c++) {
            D[c][i] += (D[c][i] + P[c][i]) * wgt;
            P[c][i] *= 1 - wgt;
          }
          Dm[i] += (Dm[i] + Pm[i]) * wgt;
          Pm[i] *= 1 - wgt;
        }
      }
    }
    // 滴心稀释：随角度（0.75×Rθ 以内）清到浅色——不切进向内凹的花瓣
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 0.01) continue;
        const ang = Math.atan2(dy, dx);
        const Rθ = profAt(ang);
        if (d < Rθ * 0.75) {
          const t = d / (Rθ * 0.75);
          const soft = t < 0.8 ? 1 : (1 - t) / 0.2; // M2.3：外圈 20% 线性淡出，消内白环硬边
          const kP = 1 - 0.58 * soft, kD = 1 - 0.45 * soft;
          for (let c = 0; c < ch; c++) { P[c][i] *= kP; D[c][i] *= kD; }
          Pm[i] *= kP; Dm[i] *= kD;
        }
      }
    }
  }

  /** 推进 steps 步 */
  step(steps = 1) {
    for (let s = 0; s < steps; s++) this._stepOnce();
  }

  _stepOnce() {
    const { w, h, n, W, P, Pm, D, Dm, M, ux, uy, p, paper, ch } = this;
    const { H, G, F, Tx, Ty } = paper;
    this.stepCount++;

    if (this._bbox.valid && this.stepCount % 30 === 0) this._tightenBBox();

    let { x0, y0, x1, y1 } = this._bbox;
    if (!this._bbox.valid) {
      this._evaporateTail();
      return;
    }
    const pad = 2 + p.blurR;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const hook = this.debugHook;
    const mark = (name) => { if (hook) hook(name, this); };
    const al = this._al, alx = this._alx, aly = this._aly;
    const ac = this._alCount; // 阶段 1-8 期间列表不变（出列只发生在阶段 9）

    // ---------- 0) 静止短路（可选；quiescentU=0 时为行为保持模式） ----------
    const qU = p.quiescentU;
    const quiescent = qU > 0 && this._lastMaxU < qU && !this._qDirty;
    this._qDirty = false;
    let maxU = 0;

    // ---------- 1) 流场 ----------
    // M1：压力项 × κ 变渗透率（MoXi：沉积多 → 渗透率低 → 分支纹）；
    //     G 噪声扰动 → 纸坡 ∇H（Montesdeoca 指针①）；小量沿纤维耦合（辅助）
    const kPress = p.kPress, grav = p.gravity;
    const kSlope = p.kSlope, kFib = p.kFib, kappaG = p.kappaG, kappaF = p.kappaF;
    if (!quiescent) {
      for (let k = 0; k < ac; k++) {
        const i = al[k];
        const wv = W[i];
        if (wv <= 1e-4) { ux[i] = 0; uy[i] = 0; continue; }
        const x = alx[k], y = aly[k];
        const iL = x > 0 ? i - 1 : i, iR = x < w - 1 ? i + 1 : i;
        const iU = y > 0 ? i - w : i, iD = y < h - 1 ? i + w : i;
        const kap = 1 + kappaG * (G[i] - 0.5) * 2 - kappaF * Math.min(1, Dm[i] * 1.5);
        const kk = kap < 0.2 ? 0.2 : kap > 1.5 ? 1.5 : kap;
        let uxv = -(W[iR] - W[iL]) * 0.5 * kPress * kk - (H[iR] - H[iL]) * 0.5 * kSlope * wv;
        let uyv = -(W[iD] - W[iU]) * 0.5 * kPress * kk + grav * wv - (H[iD] - H[iU]) * 0.5 * kSlope * wv;
        if (p.gravRun > 0 && wv > p.runW0) {
          // M4：重力淌色——高含水区向下淌流，沿 x 的通道噪声形成纵向滴流/淌痕
          uyv += p.gravRun * wv * (0.3 + 1.2 * valueNoise2D(x * 0.07 + 2.2, 3.7, 47));
        }
        if (kFib > 0) {
          const tdot = uxv * Tx[i] + uyv * Ty[i];
          uxv += tdot * Tx[i] * kFib;
          uyv += tdot * Ty[i] * kFib;
        }
        ux[i] = uxv; uy[i] = uyv;
        if (qU > 0) {
          const au = uxv < 0 ? -uxv : uxv, av = uyv < 0 ? -uyv : uyv;
          if (au > maxU) maxU = au;
          if (av > maxU) maxU = av;
        }
      }
    } else {
      for (let k = 0; k < ac; k++) { const i = al[k]; ux[i] = 0; uy[i] = 0; }
    }

    // ---------- 2) 水半拉格朗日平流 + 扩散 ----------
    mark("1-flow");
    const adv = p.advCoef, kDiff = p.kDiff;
    const sW = this._s2;
    if (!quiescent) {
      for (let k = 0; k < ac; k++) {
        const i = al[k];
        const wv = W[i];
        if (wv <= 1e-5) { sW[i] = 0; continue; }
        let nw;
        const uvx = ux[i], uvy = uy[i];
        if (uvx === 0 && uvy === 0) {
          nw = wv; // u 恰为 0 → 反溯即本格，bilerp ≡ 拷贝（严格等价）
        } else {
          const x = alx[k], y = aly[k];
          let wx = x - uvx * adv, wy = y - uvy * adv;
          wx = CLAMP(wx, 0, w - 1.001); wy = CLAMP(wy, 0, h - 1.001);
          const x0f = wx | 0, y0f = wy | 0, tx = wx - x0f, ty = wy - y0f;
          const i00 = y0f * w + x0f;
          const v00 = W[i00], v10 = W[i00 + 1], v01 = W[i00 + w], v11 = W[i00 + w + 1];
          const a = v00 + (v10 - v00) * tx, b = v01 + (v11 - v01) * tx;
          nw = a + (b - a) * ty;
        }
        const x = alx[k], y = aly[k];
        const wL = x > 0 ? W[i - 1] : wv, wR = x < w - 1 ? W[i + 1] : wv;
        const wU = y > 0 ? W[i - w] : wv, wD = y < h - 1 ? W[i + w] : wv;
        // M1：扩散 × κ 变渗透率；各向异性仅作辅助（anisoDiff 小，防木纹滤镜）
        const aniso = p.anisoDiff;
        const kap = 1 + p.kappaG * (G[i] - 0.5) * 2 - p.kappaF * Math.min(1, Dm[i] * 1.5);
        const kk = kap < 0.2 ? 0.2 : kap > 1.5 ? 1.5 : kap;
        let lap;
        if (aniso > 0) {
          const ax = Tx[i] * Tx[i];
          const wxA = 1 + aniso * (2 * ax - 1);
          const wyA = 1 + aniso * (2 * (1 - ax) - 1);
          lap = (wL + wR) * wxA + (wU + wD) * wyA - 2 * (wxA + wyA) * wv;
        } else {
          lap = wL + wR + wU + wD - 4 * wv;
        }
        nw += kDiff * kk * lap;
        sW[i] = nw < 0 ? 0 : nw > 2 ? 2 : nw;
      }
      for (let k = 0; k < ac; k++) { const i = al[k]; W[i] = sW[i]; }
    }

    // ---------- 3) 掩码扩张 + 前缘标记 ----------
    mark("2-water");
    const theta = p.theta;
    this._tlCount = 0;
    for (let k = 0; k < ac; k++) {
      const i = al[k];
      if (!M[i] && W[i] > theta) { M[i] = 1; this._tl[this._tlCount++] = i; }
    }
    // M4 重力滴流：底部水压 × 通道噪声 → 湿前沿向下推进一格（滴流/淌痕的成因）
    // 取边界格与其上方格中水多者为源，水+颜料按比例转移 → 尾巴必然可见
    if (p.gravRun > 0) {
      for (let k = 0; k < ac; k++) {
        const i = al[k];
        if (!M[i]) continue;
        const x = alx[k], y = aly[k];
        if (y >= h - 1) continue;
        const below = i + w;
        if (M[below]) continue;
        const above = y > 0 ? i - w : i;
        const src = W[above] > W[i] ? above : i;
        const head = W[src];
        if (head <= p.runW0) continue;
        const chan = valueNoise2D(x * 0.07 + 2.2, 3.7, 47);
        if (head * chan < p.dripThresh) continue;
        const move = Math.min(head * 0.4, head - 0.03);
        if (move <= 0) continue;
        const frac = move / head;
        W[below] = Math.min(2, W[below] + move);
        W[src] -= move;
        const fracC = frac * (1 - 0.4 * this.pigment.mass); // M5：滴流转移按粒重打折——重颜料少被带走（分离）
        for (let c = 0; c < ch; c++) {
          const pc = P[c][src] * fracC;
          P[c][below] += pc;
          P[c][src] -= pc;
        }
        const pm = Pm[src] * fracC;
        Pm[below] += pm; Pm[src] -= pm;
        M[below] = 1;
        // 扩展 bbox 使其不落入孤儿集
        const b = this._bbox;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
        if (y + 1 < b.y0) b.y0 = y + 1; if (y + 1 > b.y1) b.y1 = y + 1;
        this._pushActive(below);
        this._tl[this._tlCount++] = below;
      }
    }

    // ---------- 4) 颜料半拉格朗日平流（每通道） ----------
    mark("3-expand");
    const pigAdv = p.pigAdv;
    const hind = p.hindrance, hindRange = p.hindRange;
    const diffBase = p.diffusion;
    const massLag = p.massLag;
    const pig = this.pigment;
    if (!quiescent) {
      // M1 阻滞因子每格预计算一次（hypot 昂贵，勿进通道循环）；_s3 阶段 7 前空闲
      // M5：粒重平流滞后一并折入（重颜料走得慢 → 分离）
      const advEffArr = this._s3;
      const lag = 1 - massLag * pig.mass;
      if (hind > 0 || massLag > 0) {
        const TxP = paper.Tx, TyP = paper.Ty;
        for (let k = 0; k < ac; k++) {
          const i = al[k];
          const uvx = ux[i], uvy = uy[i];
          if (uvx === 0 && uvy === 0) { advEffArr[i] = pigAdv * lag; continue; }
          let advEff = pigAdv;
          if (hind > 0) {
            const um = Math.sqrt(uvx * uvx + uvy * uvy);
            const t = um / hindRange;
            const s = t >= 1 ? 1 : t <= 0 ? 0 : t * t * (3 - 2 * t);
            const cross = Math.abs(TxP[i] * (uvy / um) - TyP[i] * (uvx / um));
            advEff *= 1 - hind * s * cross;
          }
          advEffArr[i] = advEff * lag;
        }
      }
      // M5：每颜料扩散率（湿中混色互渗）——低染色颜料扩散快
      const diffK = diffBase * (0.25 + 1.5 * pig.diffusivity);
      for (let c = 0; c < ch; c++) {
        const PC = P[c];
        const sP = this._sP[c];
        for (let k = 0; k < ac; k++) {
          const i = al[k];
          const pv = PC[i];
          const x = alx[k], y = aly[k];
          if (pv <= 1e-6) {
            if (!(diffK > 0 && M[i])) { sP[i] = 0; continue; }
          }
          const uvx = ux[i], uvy = uy[i];
          let adv;
          if (pv <= 1e-6) adv = 0;
          else if (uvx === 0 && uvy === 0) adv = pv;
          else {
            const advEff = (hind > 0 || massLag > 0) ? advEffArr[i] : pigAdv * lag;
            let px = x - uvx * advEff, py = y - uvy * advEff;
            px = CLAMP(px, 0, w - 1.001); py = CLAMP(py, 0, h - 1.001);
            const x0f = px | 0, y0f = py | 0, tx = px - x0f, ty = py - y0f;
            const i00 = y0f * w + x0f;
            adv = bilerpAt(PC, i00, tx, ty, w);
          }
          // M5：湿中互渗扩散（M=1 时即使本格无颜料也算——颜料渗入清水区）
          if (diffK > 0 && M[i]) {
            const pL = x > 0 ? PC[i - 1] : 0, pR = x < w - 1 ? PC[i + 1] : 0;
            const pU = y > 0 ? PC[i - w] : 0, pD = y < h - 1 ? PC[i + w] : 0;
            adv += diffK * (pL + pR + pU + pD - 4 * pv);
          }
          sP[i] = adv < 0 ? 0 : adv;
        }
        for (let k = 0; k < ac; k++) { const i = al[k]; PC[i] = sP[i]; }
      }
      // 质量通道同速平流（同阻滞）
      {
        const sP = this._s2;
        for (let k = 0; k < ac; k++) {
          const i = al[k];
          const pv = Pm[i];
          if (pv <= 1e-6) { sP[i] = 0; continue; }
          const uvx = ux[i], uvy = uy[i];
          if (uvx === 0 && uvy === 0) { sP[i] = pv; continue; }
          const x = alx[k], y = aly[k];
          const advEff = (hind > 0 || massLag > 0) ? advEffArr[i] : pigAdv * lag;
          let px = x - uvx * advEff, py = y - uvy * advEff;
          px = CLAMP(px, 0, w - 1.001); py = CLAMP(py, 0, h - 1.001);
          const x0f = px | 0, y0f = py | 0, tx = px - x0f, ty = py - y0f;
          const i00 = y0f * w + x0f;
          sP[i] = bilerpAt(Pm, i00, tx, ty, w);
        }
        for (let k = 0; k < ac; k++) { const i = al[k]; Pm[i] = sP[i]; }
      }
    }
    this._lastMaxU = maxU; // 静止短路判断用的"上一步流速"

    // ---------- 5) 沉积（纸谷偏置 + 细颗粒调制 + 容纸度） ----------
    // Curtis 1997 §4.5：吸附 ∝ (1 − σ·h)，h 为纸高 → 谷多吸附、峰少吸附（bugfix：原 +hb 符号反）
    // M1 容纸度（MoXi §5.2）：max(1−ρ/λ, m)，湿区低吸 → 浅边晕
    mark("4-pigment");
    const dep = p.deposit, expo = p.exposure;
    const gran = this.pigment.granulation, stain = this.pigment.staining;
    const depScale = dep * (0.4 + 1.2 * stain);
    const granScale = gran * 1.8;
    const capLam = p.capLam, capMin = p.capMin;
    for (let k = 0; k < ac; k++) {
      const i = al[k];
      if (!M[i]) continue;
      const hb = H[i] - 0.5;
      const grain = F[i] - 0.5;
      let kk = depScale * (1 - expo * hb) * (1 + granScale * grain);
      const cap = 1 - W[i] / capLam;
      kk *= cap > capMin ? cap : capMin;
      if (p.gravRun > 0) kk *= 1 - Math.min(0.6, p.gravRun * W[i] * 1.5); // M4：淌动中固着变慢 → 颜料随水流走（滴流/淌痕的成因）
      kk = kk < 0 ? 0 : kk > 0.5 ? 0.5 : kk;
      let total = 0;
      for (let c = 0; c < ch; c++) total += P[c][i];
      if (total <= 1e-6) continue;
      for (let c = 0; c < ch; c++) {
        const pc = P[c][i];
        D[c][i] += pc * kk;
        P[c][i] = pc * (1 - kk);
      }
      const pm = Pm[i];
      Dm[i] += pm * kk;
      Pm[i] = pm * (1 - kk);
    }

    // ---------- 6) 前缘沉积 ----------
    mark("5-deposit");
    const fd = p.frontDeposit;
    if (fd > 0) {
      const tl = this._tl, tc = this._tlCount;
      for (let t = 0; t < tc; t++) {
        const i = tl[t];
        let total = 0;
        for (let c = 0; c < ch; c++) total += P[c][i];
        if (total <= 1e-6) continue;
        const grain = G[i] - 0.5;
        let kk = fd * (0.5 + 0.5 * grain);
        kk = kk < 0 ? 0 : kk > 0.8 ? 0.8 : kk;
        for (let c = 0; c < ch; c++) {
          const pc = P[c][i];
          D[c][i] += pc * kk;
          P[c][i] = pc * (1 - kk);
        }
        const pm = Pm[i];
        Dm[i] += pm * kk;
        Pm[i] = pm * (1 - kk);
      }
    }

    // ---------- 7) 湿区边缘加深 ----------
    // bugfix：e = M − blur(M)（湿区内侧边带）。原实现 e = blur(M) − M 对 M=1 格恒 ≤0，
    // 过不了 e>0.02 门槛 → edgeK 从未生效（Curtis 1997 精读复核纠错 #2）。
    mark("6-front");
    this._blurM(x0, y0, x1, y1, p.blurR);
    const edgeK = p.edgeK, Mb = this._Mb;
    for (let k = 0; k < ac; k++) {
      const i = al[k];
      if (!M[i]) continue;
      let e = (M[i] ? 1 : 0) - Mb[i];
      if (e <= 0.02) continue;
      e = e > 1 ? 1 : e;
      const kk = edgeK * e;
      let total = 0;
      for (let c = 0; c < ch; c++) total += P[c][i];
      if (total <= 1e-6) continue;
      for (let c = 0; c < ch; c++) {
        const pc = P[c][i];
        D[c][i] += pc * kk;
        P[c][i] = pc * (1 - kk);
      }
      const pm = Pm[i];
      Dm[i] += pm * kk;
      Pm[i] = pm * (1 - kk);
    }

    // ---------- 8) 蒸发（边缘先干 + 咖啡环） ----------
    // 注意：本阶段向邻格 P[c][ii] 原地乘减（跨格写依赖，迭代顺序敏感）→
    // 必须保持 bbox 栅格序遍历，不能换成活跃集（活跃集顺序会被出列打乱）。
    // bugfix：e = M − blur(M)（湿区内侧边带）。原实现极性反 → evapEdge 与咖啡环拉取
    // 只作用于湿区外的干边带（0<W≤θ 外沿格），内侧边缘从不加速蒸发（咖啡环弱而均匀的成因）。
    mark("7-edge");
    const evap = p.evap, evapEdge = p.evapEdge;
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        const wv = W[i];
        if (wv <= 1e-5) continue;
        const e = (M[i] ? 1 : 0) - Mb[i];
        const rate = evap * (1 + evapEdge * (e > 0 ? e : 0));
        W[i] = wv * (1 - rate);
        if (e > 0.04) {
          const gx = Mb[i + 1] - Mb[i - 1];
          const gy = Mb[i + w] - Mb[i - w];
          const gl = Math.hypot(gx, gy);
          if (gl > 1e-3) {
            let ix = i + Math.round(gx / gl);
            if (x === 0 || x === w - 1) ix = i;
            let iy = i + w * Math.round(gy / gl);
            if (y === 0 || y === h - 1) iy = i;
            // M2 岸线算子（Curtis FlowOutward 的落地）：干燥速度驱动的向内输运
            //  × 沿切线噪声断环 × 纸纹调制 × 曲率调制 × granulation 分档
            let kkBase = 0.12 * (e > 1 ? 1 : e);
            let shore = 1;
            if (p.shoreK > 0) {
              const dryDrive = 1 + p.evapEdge * e;                       // 蒸发越快输运越强（因果耦合）
              const tx = -gy / gl, ty = gx / gl;                          // 岸边切线
              const s = x * tx + y * ty;
              const tn = valueNoise2D(s * 0.09 + 4.1, 3.7, 71);           // 沿切线 1D 噪声
              const breakF = (1 - p.shoreBreak) + p.shoreBreak * tn;      // 断环深度
              const gmod = 0.5 + 1.0 * G[i];                              // 纸纹：谷处成线更浓
              let curv = 0;
              {
                const tIdx = Math.round(ty) * w + Math.round(tx);
                const n1 = i + tIdx, n2 = i - tIdx;
                if (n1 >= 0 && n1 < this.n && n2 >= 0 && n2 < this.n) {
                  curv = Math.abs(Mb[n1] + Mb[n2] - 2 * Mb[i]);           // 边界弯曲度代理
                }
              }
              const curvTerm = 1 + p.shoreCurv * curv;                    // 弯处水线浓、直线段淡
              shore = p.shoreK * dryDrive * breakF * gmod * curvTerm;
            }
            for (const ii of [ix, iy]) {
              // M2：granulation 分档——重颗粒少被拉向水线（滞留在透明带沉淀 = 分离雏形）
              let kk = kkBase * shore;
              if (p.shoreSplit > 0) kk *= 1 - p.shoreSplit * this.pigment.granulation * 0.5;
              if (kk > 0.3) kk = 0.3; // 集成调参：原 0.4 上限仍会掏空内邻格
              let total = 0;
              for (let c = 0; c < ch; c++) total += P[c][ii];
              if (total <= 1e-6) continue;
              for (let c = 0; c < ch; c++) {
                const pc = P[c][ii];
                D[c][i] += pc * kk;
                P[c][ii] = pc * (1 - kk);
              }
              const pm = Pm[ii];
              Dm[i] += pm * kk;
              Pm[ii] = pm * (1 - kk);
            }
          }
        }
      }
    }

    // ---------- 9) 冻结 ----------
    mark("8-evap");
    const eps = p.epsDry;
    const fixR = p.fixRate;
    for (let k = 0; k < this._alCount; k++) {
      const i = this._al[k];
      if (W[i] >= eps) continue;
      if (W[i] > 0) W[i] = 0;
      if (M[i]) M[i] = 0;
      let total = 0;
      for (let c = 0; c < ch; c++) total += P[c][i];
      if (total > 0.02) {
        // M1 渐变固着（MoXi SIMULATEFIXTURE）：每步固着一部分，颜料随纤维滞留数步
        // （干格仍在列表内，u=0 原地不动，逐step P→D）
        for (let c = 0; c < ch; c++) {
          const mv = P[c][i] * fixR;
          D[c][i] += mv;
          P[c][i] -= mv;
        }
        const mm = Pm[i] * fixR;
        Dm[i] += mm;
        Pm[i] -= mm;
      } else {
        // 固着完成：清零残量（≤0.02 的尾巴对渲染无感）并出列
        for (let c = 0; c < ch; c++) P[c][i] = 0;
        Pm[i] = 0;
        this._removeActive(i);
        k--; // 该槽位被队尾元素顶替，需重查
      }
    }
    mark("9-freeze");
  }

  /** 全域尾水蒸发（bbox 失效后使用；主列 + 孤儿集 = {W>0}） */
  _evaporateTail() {
    const { W, P, Pm, D, Dm, p, ch } = this;
    const evap = p.evap, eps = p.epsDry;
    for (let k = 0; k < this._alCount; k++) {
      const i = this._al[k];
      const wv = W[i];
      if (wv <= 0) { this._removeActive(i); k--; continue; }
      const nw = wv * (1 - evap);
      if (nw < eps) {
        W[i] = 0;
        for (let c = 0; c < ch; c++) { D[c][i] += P[c][i]; P[c][i] = 0; }
        Dm[i] += Pm[i]; Pm[i] = 0;
        this._removeActive(i);
        k--;
      } else {
        W[i] = nw;
      }
    }
    for (let k = 0; k < this._olCount; k++) {
      const i = this._ol[k];
      const wv = W[i];
      if (wv <= 0) { this._removeOrphan(i); k--; continue; }
      const nw = wv * (1 - evap);
      if (nw < eps) {
        W[i] = 0;
        for (let c = 0; c < ch; c++) { D[c][i] += P[c][i]; P[c][i] = 0; }
        Dm[i] += Pm[i]; Pm[i] = 0;
        this._removeOrphan(i);
        k--;
      } else {
        W[i] = nw;
      }
    }
  }

  /** 湿掩码 box 模糊（_Mb = blur(M)） */
  _blurM(x0, y0, x1, y1, r) {
    const { w, M, _Mb, _s3 } = this;
    const rad = r >= 1 ? r : 1;
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = x0 - rad; x <= x0 + rad; x++) acc += M[row + CLAMP(x, 0, w - 1)];
      const inv = 1 / (2 * rad + 1);
      for (let x = x0; x <= x1; x++) {
        _s3[row + x] = acc * inv;
        acc += M[row + CLAMP(x + rad + 1, 0, w - 1)] - M[row + CLAMP(x - rad, 0, w - 1)];
      }
    }
    for (let x = x0; x <= x1; x++) {
      let acc = 0;
      for (let y = y0 - rad; y <= y0 + rad; y++) acc += _s3[CLAMP(y, 0, this.h - 1) * w + x];
      const inv = 1 / (2 * rad + 1);
      for (let y = y0; y <= y1; y++) {
        _Mb[y * w + x] = acc * inv;
        acc += _s3[CLAMP(y + rad + 1, 0, this.h - 1) * w + x] - _s3[CLAMP(y - rad, 0, this.h - 1) * w + x];
      }
    }
  }

  /** 每 30 步精确重算 bbox（扫活跃集而非全画布，等价） */
  _tightenBBox() {
    const { w, h, M } = this;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let k = 0; k < this._alCount; k++) {
      const i = this._al[k];
      if (!M[i]) continue;
      const x = this._alx[k], y = this._aly[k];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 >= x0) { this._bbox = { x0, y0, x1, y1, valid: true }; }
    else this._bbox = { x0: 0, y0: 0, x1: 0, y1: 0, valid: false };
    this._resyncBBoxLists();
  }

  /** 全画布还有多少水（干燥判定） */
  totalWater() {
    let s = 0;
    const { W } = this;
    for (let i = 0; i < this.n; i++) s += W[i];
    return s;
  }
}
