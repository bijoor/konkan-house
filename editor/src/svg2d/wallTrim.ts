// Because rooms/walls are defined on OUTER dimensions and pillars sit at the
// grid corners, a pillar always overlaps the walls meeting there. This trims a
// wall's run so it stops at the pillar faces (walls butt into columns) instead
// of passing under them. A wall is a 1-D segment along its axis, a pillar is a
// rectangle, so trimming is interval subtraction along the wall's axis for every
// pillar whose perpendicular extent covers the wall's thickness band.

import { DEFAULT_GLOBAL_CONFIG } from "./config";

export interface PillarRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EPS = 1e-6;

// Footprints of every pillar on a floor (top-left corner + size). The size rule
// MUST match svgDrawPillar / PillarBox EXACTLY so the trim footprint is the same
// rectangle that is painted — a missing dimension falls back to `size`, then to
// the wall thickness (NOT to the other dimension: a width-only pillar draws as a
// width×wall_thickness rectangle, so the wall must trim to that same rectangle,
// otherwise it leaves a gap at the pillar face).
export function pillarRects(objects: Array<Record<string, unknown>> | undefined): PillarRect[] {
  const def = DEFAULT_GLOBAL_CONFIG.wall_thickness;
  const out: PillarRect[] = [];
  for (const o of objects ?? []) {
    if (o.type !== "pillar") continue;
    const x = o.x as number;
    const y = o.y as number;
    const size = o.size as number | undefined;
    const w = (o.width as number | undefined) ?? size ?? def;
    const l = (o.length as number | undefined) ?? size ?? def;
    if (typeof x === "number" && typeof y === "number") out.push({ x0: x, y0: y, x1: x + w, y1: y + l });
  }
  return out;
}

// Subtract the intervals in `covered` from [lo,hi]; returns the leftover pieces.
function subtract(lo: number, hi: number, covered: [number, number][]): [number, number][] {
  if (!covered.length) return [[lo, hi]];
  covered.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = lo;
  for (const [s, e] of covered) {
    if (s > cur) out.push([cur, Math.min(s, hi)]);
    cur = Math.max(cur, e);
    if (cur >= hi) break;
  }
  if (cur < hi) out.push([cur, hi]);
  return out.filter(([a, b]) => b - a > EPS);
}

// For an axis-aligned wall (axis "h" = runs in x, "v" = runs in y) with
// perpendicular centre `center`, running [start,end] with `thickness`, return
// the sub-spans NOT covered by an overlapping pillar. A single unchanged span
// means "no trim".
export function trimSpans(
  axis: "h" | "v",
  center: number,
  start: number,
  end: number,
  thickness: number,
  pillars: PillarRect[],
): [number, number][] {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const half = thickness / 2;
  const bandLo = center - half;
  const bandHi = center + half;
  const covered: [number, number][] = [];
  for (const p of pillars) {
    const perpLo = axis === "h" ? p.y0 : p.x0;
    const perpHi = axis === "h" ? p.y1 : p.x1;
    if (Math.min(perpHi, bandHi) - Math.max(perpLo, bandLo) <= EPS) continue; // not on this wall
    const axLo = axis === "h" ? p.x0 : p.y0;
    const axHi = axis === "h" ? p.x1 : p.y1;
    const s = Math.max(axLo, lo);
    const e = Math.min(axHi, hi);
    if (e - s > EPS) covered.push([s, e]);
  }
  return subtract(lo, hi, covered);
}
