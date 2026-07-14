// Port of svg_2d.py::_build_key_plan_svg. Byte-identical for all four
// elevations and every internal section.
//
// Python's f-strings render ints as "10" and floats as "10.5" (whole
// floats keep their `.0`). JS has one Number type, so callers pass
// explicit `isFloat` flags for values whose Python type isn't obvious
// at the call site. Inside this function most computed values are
// floats (products with `planScale`, halves) so we use `fFloat`
// unconditionally there.

import type { Pillar } from "./cluster";
import type { ViewType } from "./project";
import { f, fFloat } from "../format";

export interface BuildKeyPlanOptions {
  allPillars: Pillar[];
  highlightedPillars: Pillar[];
  buildingWidth: number;
  buildingLength: number;
  viewType: ViewType;
  insetOriginX: number;
  insetOriginXIsFloat: boolean;
  insetOriginY: number;
  insetOriginYIsFloat: boolean;
  insetSize: number;
  insetSizeIsFloat: boolean;
}

export function buildKeyPlanSvg(opts: BuildKeyPlanOptions): string {
  const {
    allPillars,
    highlightedPillars,
    buildingWidth,
    buildingLength,
    viewType,
    insetOriginX,
    insetOriginXIsFloat,
    insetOriginY,
    insetOriginYIsFloat,
    insetSize,
    insetSizeIsFloat,
  } = opts;

  const pad = 8;   // int
  const avail = insetSize - 2 * pad;   // int if insetSize int
  const planScale = avail / Math.max(buildingWidth, buildingLength);   // float
  const planW = buildingWidth * planScale;   // float
  const planL = buildingLength * planScale;   // float
  const originX = insetOriginX + pad + (avail - planW) / 2;   // float
  const originY = insetOriginY + pad + (avail - planL) / 2;   // float

  const fmtIx = (n: number, isFloat: boolean) => (isFloat ? fFloat(n) : f(n));

  let s = '<g class="key-plan">\n';
  // Inset frame — insetOriginX/Y/insetSize use their carried type
  s +=
    `<rect x="${fmtIx(insetOriginX, insetOriginXIsFloat)}" y="${fmtIx(insetOriginY, insetOriginYIsFloat)}" width="${fmtIx(insetSize, insetSizeIsFloat)}" ` +
    `height="${fmtIx(insetSize, insetSizeIsFloat)}" fill="#fff" stroke="#000" stroke-width="0.7"/>\n` +
    // insetOriginX + 4: float + int = float if insetOriginX float, else int
    `<text x="${fmtIx(insetOriginX + 4, insetOriginXIsFloat)}" y="${fmtIx(insetOriginY + 10, insetOriginYIsFloat)}" font-size="7" ` +
    `font-weight="bold" fill="#000">KEY PLAN</text>\n`;
  // Building outline — originX/Y/planW/planL are all floats
  s +=
    `<rect x="${fFloat(originX)}" y="${fFloat(originY)}" width="${fFloat(planW)}" height="${fFloat(planL)}" ` +
    `fill="none" stroke="#000" stroke-width="0.6"/>\n`;

  // Highlighted set via reference equality (Python id()-based)
  const highlightedSet = new Set<Pillar>(highlightedPillars);
  for (const p of allPillars) {
    const cx = originX + p.x * planScale;   // float
    const cy = originY + p.y * planScale;   // float
    const size = Math.max(1.4, p.width * planScale);   // float
    const isHi = highlightedSet.has(p);
    const fill = isHi ? "#c00" : "#888";
    s +=
      `<rect x="${fFloat(cx - size / 2)}" y="${fFloat(cy - size / 2)}" width="${fFloat(size)}" ` +
      `height="${fFloat(size)}" fill="${fill}" stroke="none"/>\n`;
  }

  // Cut-line + arrows
  if (highlightedPillars.length > 0) {
    if (viewType === "front" || viewType === "back") {
      const cy = originY +
        (highlightedPillars.reduce((s, p) => s + p.y, 0) / highlightedPillars.length) *
          planScale;   // float
      const x1 = originX - 4;   // float
      const x2 = originX + planW + 4;   // float
      s +=
        `<line x1="${fFloat(x1)}" y1="${fFloat(cy)}" x2="${fFloat(x2)}" y2="${fFloat(cy)}" ` +
        `stroke="#c00" stroke-width="0.8" stroke-dasharray="3,1.5"/>\n`;
      const arrowDy = viewType === "front" ? 4 : -4;   // int
      for (const ax of [x1 + 2, x2 - 2]) {
        const back = arrowDy > 0 ? 1.5 : -1.5;   // float
        s +=
          `<polygon points="${fFloat(ax)},${fFloat(cy + arrowDy)} ` +
          `${fFloat(ax - 2)},${fFloat(cy + arrowDy - back)} ` +
          `${fFloat(ax + 2)},${fFloat(cy + arrowDy - back)}" ` +
          `fill="#c00"/>\n`;
      }
    } else {
      const cx = originX +
        (highlightedPillars.reduce((s, p) => s + p.x, 0) / highlightedPillars.length) *
          planScale;
      const y1 = originY - 4;
      const y2 = originY + planL + 4;
      s +=
        `<line x1="${fFloat(cx)}" y1="${fFloat(y1)}" x2="${fFloat(cx)}" y2="${fFloat(y2)}" ` +
        `stroke="#c00" stroke-width="0.8" stroke-dasharray="3,1.5"/>\n`;
      const arrowDx = viewType === "left" ? 4 : -4;
      for (const ay of [y1 + 2, y2 - 2]) {
        const back = arrowDx > 0 ? 1.5 : -1.5;
        s +=
          `<polygon points="${fFloat(cx + arrowDx)},${fFloat(ay)} ` +
          `${fFloat(cx + arrowDx - back)},${fFloat(ay - 2)} ` +
          `${fFloat(cx + arrowDx - back)},${fFloat(ay + 2)}" ` +
          `fill="#c00"/>\n`;
      }
    }
  }

  // Compass mark 'N'
  s +=
    `<text x="${fFloat(originX + planW / 2)}" y="${fFloat(originY - 1)}" font-size="6" ` +
    `text-anchor="middle" fill="#000">N</text>\n`;
  s += "</g>\n";
  return s;
}
