// 编排层（Studio）：装配 引擎(core) + 颜色系统(color) + 笔触(brush) + 渲染(color/io)
// demo 与将来的 agent 层只依赖 Studio 的稳定接口；各子系统可独立异步升级。
// 颜色系统选择：环境变量 COLOR_SYSTEM=spectral 切光谱，缺省 RGB 三通道。
import { WatercolorEngine } from "../core/engine.js";
import { StrokePainter } from "../brush/strokes.js";
import { renderRGBA, compositePlanes } from "../color/render.js";
import { RgbColorSystem, SpectralColorSystem } from "../color/system.js";

export function makeColorSystem(kind = process.env.COLOR_SYSTEM) {
  return kind === "spectral" ? new SpectralColorSystem() : new RgbColorSystem();
}

/**
 * @param {object} opt { width, height, seed, painterSeed, colorSystem?, params? }
 * @returns { engine, painter, colorSystem, apply(stroke, steps?), render(opts?), composite(opts?) }
 */
export function createStudio({ width = 640, height = 480, seed = 0, painterSeed = 1, colorSystem, params } = {}) {
  const cs = colorSystem ?? makeColorSystem();
  const engine = new WatercolorEngine({ w: width, h: height, seed, params, channels: cs.channels });
  const painter = new StrokePainter(engine, { seed: painterSeed, colorSystem: cs });
  const apply = (stroke, steps) => { painter.apply(stroke); if (steps) engine.step(steps); };
  const render = (opts) => renderRGBA(engine, cs, opts);
  const composite = (opts) => compositePlanes(engine, cs, opts);
  return { engine, painter, colorSystem: cs, apply, render, composite };
}

export { WatercolorEngine, StrokePainter, RgbColorSystem, SpectralColorSystem };
