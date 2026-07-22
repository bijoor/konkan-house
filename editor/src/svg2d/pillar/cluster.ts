// Port of svg_2d.py: _collect_ground_floor_pillars + _cluster_pillars_by_axis.

import { DEFAULT_GLOBAL_CONFIG } from "../config";
import type { HouseConfig } from "../expand";
import { pillarExtents } from "./extents";

export interface Pillar {
  name: string;
  x: number;
  y: number;
  width: number;
  length: number;
  height?: number;
}

export interface PillarCluster {
  axis: "x" | "y";
  centre: number;
  min: number;
  max: number;
  pillars: Pillar[];
}

// Tolerance (in input units) used when grouping pillars into rows/columns.
// Pillar centres within this distance along the relevant axis are treated as
// the same row (Y axis) or column (X axis). Mirrors the module-level constant.
export const PILLAR_CLUSTER_TOLERANCE = 20.0;

export function collectGroundFloorPillars(houseConfig: HouseConfig): Pillar[] {
  const defaultSize = DEFAULT_GLOBAL_CONFIG.wall_thickness ?? 8;
  const pillars: Pillar[] = [];
  // The pillar detail views show the column layout of the LOWEST floor that has
  // pillars (the plinth floor has none, so it's naturally skipped). Purely
  // content-based — no plinth-floor detection.
  const groundFloor = (houseConfig.floors ?? []).find((f) =>
    (f.objects ?? []).some((o) => (o as { type?: string }).type === "pillar"),
  );
  if (groundFloor) {
    for (const obj of groundFloor.objects ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = obj as any;
      if (o.type !== "pillar") continue;
      const { width, length } = pillarExtents(o, defaultSize);
      // Stored x,y is the TOP-LEFT CORNER; the pillar module works in centers.
      pillars.push({
        name: o.name ?? "",
        x: o.x + width / 2,
        y: o.y + length / 2,
        width,
        length,
        height: o.height,
      });
    }
  }
  return pillars;
}

export function clusterPillarsByAxis(
  pillars: Pillar[],
  axis: "x" | "y",
  tolerance: number,
): PillarCluster[] {
  if (pillars.length === 0) return [];

  // Python sorts with stable Timsort. JS Array.prototype.sort is stable in
  // modern engines (ES2019+), which is what we need to preserve order among
  // equal keys — this matches Python's behaviour.
  const sorted = [...pillars].sort((a, b) => a[axis] - b[axis]);
  const groups: Pillar[][] = [];
  let current: Pillar[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    const prev = current[current.length - 1];
    if (Math.abs(p[axis] - prev[axis]) <= tolerance) {
      current.push(p);
    } else {
      groups.push(current);
      current = [p];
    }
  }
  groups.push(current);

  return groups.map((group) => {
    const coords = group.map((p) => p[axis]);
    const sum = coords.reduce((s, v) => s + v, 0);
    return {
      axis,
      centre: sum / coords.length,
      min: Math.min(...coords),
      max: Math.max(...coords),
      pillars: group,
    };
  });
}
