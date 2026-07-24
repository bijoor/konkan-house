// Wall-area estimator: external (weather-facing) and internal (room-facing)
// wall surface areas for a house config, net of door/window openings, plus
// gable-end triangles above the eaves. Pure + synchronous — no bpy, no DOM —
// so it can run in the viewer panel builder, in Node tests, or a CLI.
//
// Definitions (surface-based, chosen for paint/plaster estimation):
//   * EXTERNAL area = the OUTSIDE faces of walls that face out of the building
//     footprint (what exterior paint covers) + gable-end triangles.
//   * INTERNAL area = the INSIDE (room-facing) faces of every wall that bounds
//     a room — this includes the inner face of external walls and BOTH faces of
//     interior partitions (what interior paint covers).
// A wall face is classified by sampling a point just beyond it: if that point
// lies inside a room on ANY floor it faces an interior space (handles
// double-height voids); otherwise it faces outside → external.
//
// Coordinates are Inkscape-style (X-right, Y-down); areas are accumulated in
// square project units and converted for display via the config `units` block
// (default 10 units = 1 ft), mirroring svg2d/format.ts.

import { computeMergedV2Spec } from "../svg2d/roof/v2/computeFromHouse";
import type { HouseConfig } from "../svg2d/expand";

type Bag = Record<string, unknown>;
const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);

// ---- units -----------------------------------------------------------------

type UnitSystem = "feet_inches" | "feet" | "meters" | "centimeters" | "millimeters";
const M2_PER_DISPLAY: Record<UnitSystem, number> = {
  feet_inches: 0.09290304, // 1 sq ft
  feet: 0.09290304,
  meters: 1,
  centimeters: 1e-4,
  millimeters: 1e-6,
};
const SQ_LABEL: Record<UnitSystem, string> = {
  feet_inches: "sq ft",
  feet: "sq ft",
  meters: "m²",
  centimeters: "cm²",
  millimeters: "mm²",
};

export interface AreaUnits {
  perUnit: number; // project units per ONE display unit (e.g. 10 for feet)
  system: UnitSystem;
  sqLabel: string; // e.g. "sq ft"
  toDisplay(areaUnits: number): number; // sq project-units -> sq display-units
  toSqm(areaUnits: number): number; // sq project-units -> m^2
}

function readUnits(config: HouseConfig): AreaUnits {
  const u = (config as Bag).units as { system?: UnitSystem; per_unit?: number } | undefined;
  const system: UnitSystem = u?.system ?? "feet_inches";
  const perUnit = num(u?.per_unit, system === "feet_inches" || system === "feet" ? 10 : 1) || 1;
  const m2 = M2_PER_DISPLAY[system] ?? M2_PER_DISPLAY.feet_inches;
  return {
    perUnit,
    system,
    sqLabel: SQ_LABEL[system] ?? "sq ft",
    toDisplay: (a) => a / (perUnit * perUnit),
    toSqm: (a) => (a / (perUnit * perUnit)) * m2,
  };
}

// ---- geometry helpers ------------------------------------------------------

interface Rect { x: number; y: number; w: number; l: number }
type Side = "north" | "south" | "east" | "west";

// Room rectangles across ALL floors — the building footprint used to decide
// whether a wall face looks onto interior space (a room below counts, so
// double-height voids read as interior).
function allRoomRects(config: HouseConfig): Rect[] {
  const rects: Rect[] = [];
  for (const fl of (config.floors ?? []) as Bag[]) {
    for (const o of ((fl.objects ?? []) as Bag[])) {
      if (o.type !== "room") continue;
      if (o.enabled === false) continue;
      rects.push({ x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length) });
    }
  }
  return rects;
}

// Is (px,py) inside any room interior? `eps` insets each rect so a point exactly
// on a shared edge is not counted as inside.
function inAnyRoom(rects: Rect[], px: number, py: number, eps = 1): boolean {
  for (const r of rects) {
    if (px > r.x + eps && px < r.x + r.w - eps && py > r.y + eps && py < r.y + r.l - eps) return true;
  }
  return false;
}

// Outward normal (unit) for a room side.
const OUT_NORMAL: Record<Side, [number, number]> = {
  north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
};
const OPPOSITE: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

function openingsArea(wc: Bag | undefined): number {
  const ops = (wc?.openings as Bag[] | undefined) ?? [];
  let a = 0;
  for (const op of ops) a += num(op.width) * num(op.height);
  return a;
}

// ---- report types ----------------------------------------------------------

export interface AreaTriple { gross: number; openings: number; net: number } // sq project-units
export interface FloorAreas {
  floor: number;
  name: string;
  external: AreaTriple;
  internal: AreaTriple;
}
export interface WallTakeoffRow {
  floor: number;
  wall: string; // e.g. "Bedroom_1 / west" or "Washbasin_Wall"
  face: "external" | "internal";
  lengthU: number;
  heightU: number;
  areaU: number; // net of openings
}
export interface GableRow { segment: string; side: string; baseU: number; heightU: number; areaU: number }

export interface WallAreaReport {
  external: AreaTriple; // walls only (gables added into `grandExternal`)
  internal: AreaTriple;
  gables: { area: number; rows: GableRow[] };
  grandExternal: number; // external.net + gables.area
  perFloor: FloorAreas[];
  rows: WallTakeoffRow[];
  units: AreaUnits;
}

function triple(): AreaTriple { return { gross: 0, openings: 0, net: 0 }; }
function add(t: AreaTriple, gross: number, openings: number) {
  const g = Math.max(0, gross), o = Math.min(g, Math.max(0, openings));
  t.gross += g; t.openings += o; t.net += g - o;
}

// ---- main ------------------------------------------------------------------

export function computeWallAreas(config: HouseConfig): WallAreaReport {
  const units = readUnits(config);
  const defaults = (config as Bag).defaults as Bag | undefined;
  const defWallH = num(defaults?.wall_height, 90);
  const wallT = num(defaults?.wall_thickness, 8);
  const probe = Math.max(6, wallT * 1.5);
  const rects = allRoomRects(config);

  const external = triple(), internal = triple();
  const rows: WallTakeoffRow[] = [];
  const perFloor: FloorAreas[] = [];

  const floors = (config.floors ?? []) as Bag[];
  for (let fi = 0; fi < floors.length; fi++) {
    const fl = floors[fi];
    const floorWallH = num(fl.wall_height, defWallH);
    const fExt = triple(), fInt = triple();
    const objs = (fl.objects ?? []) as Bag[];

    // sides declared on this floor's rooms — used to skip an interior outward
    // face when the neighbour models the same partition from its own side.
    const declared = objs
      .filter((o) => o.type === "room" && o.enabled !== false)
      .map((o) => ({ rect: { x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length) }, sides: roomSides(o) }));

    for (const o of objs) {
      if (o.enabled === false) continue;

      if (o.type === "room") {
        const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
        const roomH = o.height !== undefined ? num(o.height) : undefined;
        const sides = roomSides(o);
        for (const side of Object.keys(sides) as Side[]) {
          const wc = sides[side];
          const h = wc?.height !== undefined ? num(wc.height) : roomH ?? floorWallH;
          const len = side === "north" || side === "south" ? rw : rl;
          const face = len * h;
          const op = openingsArea(wc);
          // INSIDE (room-facing) face is always interior.
          add(internal, face, op); add(fInt, face, op);
          rows.push({ floor: fi, wall: `${o.name ?? "Room"} / ${side} (inner)`, face: "internal", lengthU: len, heightU: h, areaU: Math.max(0, face - op) });
          // OUTSIDE face — classify.
          const [nx, ny] = OUT_NORMAL[side];
          const cx = side === "east" ? rx + rw : side === "west" ? rx : rx + rw / 2;
          const cy = side === "south" ? ry + rl : side === "north" ? ry : ry + rl / 2;
          const px = cx + nx * probe, py = cy + ny * probe;
          if (inAnyRoom(rects, px, py)) {
            // faces another room — skip if the neighbour declares the matching
            // wall (its inner face already counts this surface).
            if (!neighbourDeclares(declared, { x: rx, y: ry, w: rw, l: rl }, side, px, py, wallT)) {
              add(internal, face, op); add(fInt, face, op);
              rows.push({ floor: fi, wall: `${o.name ?? "Room"} / ${side} (outer)`, face: "internal", lengthU: len, heightU: h, areaU: Math.max(0, face - op) });
            }
          } else {
            add(external, face, op); add(fExt, face, op);
            rows.push({ floor: fi, wall: `${o.name ?? "Room"} / ${side}`, face: "external", lengthU: len, heightU: h, areaU: Math.max(0, face - op) });
          }
        }
      } else if (o.type === "wall") {
        const sx = num(o.start_x), sy = num(o.start_y), ex = num(o.end_x), ey = num(o.end_y);
        const len = Math.hypot(ex - sx, ey - sy);
        if (len <= 0) continue;
        const h = o.height !== undefined ? num(o.height) : floorWallH;
        const face = len * h;
        const op = openingsArea(o);
        const mx = (sx + ex) / 2, my = (sy + ey) / 2;
        // unit perpendicular
        const dx = (ex - sx) / len, dy = (ey - sy) / len;
        const nlen = 1;
        const perps: [number, number][] = [[-dy * nlen, dx * nlen], [dy * nlen, -dx * nlen]];
        for (const [pnx, pny] of perps) {
          const px = mx + pnx * probe, py = my + pny * probe;
          const isInt = inAnyRoom(rects, px, py);
          if (isInt) { add(internal, face, op); add(fInt, face, op); }
          else { add(external, face, op); add(fExt, face, op); }
          rows.push({ floor: fi, wall: `${o.name ?? "Wall"}`, face: isInt ? "internal" : "external", lengthU: len, heightU: h, areaU: Math.max(0, face - op) });
        }
      }
    }
    perFloor.push({ floor: num(fl.floor_number, fi), name: String(fl.name ?? `Floor ${fi}`), external: fExt, internal: fInt });
  }

  const gables = computeGables(config);
  return {
    external, internal, gables,
    grandExternal: external.net + gables.area,
    perFloor, rows, units,
  };
}

// Normalise a room's `walls` (dict {side:cfg} or array of side names) to a
// side→config map covering only declared sides.
function roomSides(o: Bag): Partial<Record<Side, Bag>> {
  const w = o.walls;
  const out: Partial<Record<Side, Bag>> = {};
  if (Array.isArray(w)) {
    for (const s of w) if (isSide(s)) out[s] = {};
  } else if (w && typeof w === "object") {
    for (const s of Object.keys(w as Bag)) if (isSide(s)) out[s] = (w as Bag)[s] as Bag;
  }
  return out;
}
function isSide(s: unknown): s is Side {
  return s === "north" || s === "south" || s === "east" || s === "west";
}

// Does the room containing the sample point declare a wall on the side facing
// back toward us, at nearly the same location? If so, that neighbour's inner
// face already accounts for this surface → we skip our outer face.
function neighbourDeclares(
  declared: { rect: Rect; sides: Partial<Record<Side, Bag>> }[],
  self: Rect, side: Side, px: number, py: number, wallT: number,
): boolean {
  const back = OPPOSITE[side];
  const tol = wallT * 1.5 + 2;
  for (const d of declared) {
    if (d.rect === self || (d.rect.x === self.x && d.rect.y === self.y && d.rect.w === self.w && d.rect.l === self.l)) continue;
    // must contain the sample point
    if (!(px > d.rect.x && px < d.rect.x + d.rect.w && py > d.rect.y && py < d.rect.y + d.rect.l)) continue;
    if (!d.sides[back]) continue;
    const edge = back === "north" ? d.rect.y : back === "south" ? d.rect.y + d.rect.l : back === "west" ? d.rect.x : d.rect.x + d.rect.w;
    const ours = side === "north" ? self.y : side === "south" ? self.y + self.l : side === "west" ? self.x : self.x + self.w;
    if (Math.abs(edge - ours) <= tol) return true;
  }
  return false;
}

// Gable-end triangles above the eaves (external), uniform across V2 + legacy
// roofs. area = 0.5 * base * (ridge rise) from each `gable_wall` plane.
function computeGables(config: HouseConfig): { area: number; rows: GableRow[] } {
  const rows: GableRow[] = [];
  let area = 0;
  try {
    const spec = computeMergedV2Spec(config, { filter: "all" });
    for (const p of spec.planes) {
      if (p.role !== "gable_wall") continue;
      const v = p.vertices;
      if (!v || v.length < 3) continue;
      const zs = v.map((q) => q[2]);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const base = v.filter((q) => q[2] === minZ);
      if (base.length < 2) continue;
      const baseLen = Math.hypot(base[0][0] - base[1][0], base[0][1] - base[1][1]);
      const height = maxZ - minZ;
      const a = 0.5 * baseLen * height;
      area += a;
      rows.push({ segment: p.source_segment_id ?? p.id, side: p.side_of_segment ?? "", baseU: baseLen, heightU: height, areaU: a });
    }
  } catch {
    // roof geometry failure must not blank the whole report
  }
  return { area, rows };
}
