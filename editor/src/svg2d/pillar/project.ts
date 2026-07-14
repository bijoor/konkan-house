// Port of svg_2d.py: _project_pillar + _project_slab_band.
// Projects world-coordinate pillars/slabs onto the view axis.

import type { Pillar } from "./cluster";

export interface PillarProjection {
  proj_x: number;
  visible_w: number;
  depth: number;
}

export type ViewType = "front" | "back" | "left" | "right";

export function projectPillar(
  pillar: Pillar,
  viewType: ViewType,
  buildingWidth: number,
  buildingLength: number,
): PillarProjection {
  const { x: wx, y: wy, width: dim_x, length: dim_y } = pillar;
  if (viewType === "front") {
    const visible_w = dim_x;
    const proj_x = buildingWidth - ((wx - dim_x / 2) + visible_w);
    const depth = -(wy - dim_y / 2);
    return { proj_x, visible_w, depth };
  }
  if (viewType === "back") {
    const visible_w = dim_x;
    const proj_x = wx - dim_x / 2;
    const depth = wy + dim_y / 2;
    return { proj_x, visible_w, depth };
  }
  if (viewType === "left") {
    const visible_w = dim_y;
    const proj_x = wy - dim_y / 2;
    const depth = -(wx - dim_x / 2);
    return { proj_x, visible_w, depth };
  }
  // right
  const visible_w = dim_y;
  const proj_x = buildingLength - ((wy - dim_y / 2) + visible_w);
  const depth = wx + dim_x / 2;
  return { proj_x, visible_w, depth };
}

export interface SlabLike {
  x: number;
  y: number;
  width: number;
  length: number;
}

// Returns [sx, sw] for the projected slab band.
export function projectSlabBand(
  slab: SlabLike,
  viewType: ViewType,
  buildingWidth: number,
  buildingLength: number,
): [number, number] {
  const { x: sx, y: sy, width: sw, length: sl } = slab;
  if (viewType === "front") return [buildingWidth - (sx + sw), sw];
  if (viewType === "back") return [sx, sw];
  if (viewType === "left") return [sy, sl];
  return [buildingLength - (sy + sl), sl];
}
