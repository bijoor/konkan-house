// Coordinate system mapping.
//
// House config uses Inkscape-style world coords: X right (east), Y down
// (south), Z up. Three.js is right-handed with X right, Y up, Z toward
// the viewer. We map:
//   ThreeX  =  worldX             (east)
//   ThreeY  =  worldZ             (up)
//   ThreeZ  =  worldY             (south)
//
// The model is recentred so the plot's centre-line sits at the origin —
// makes OrbitControls behave naturally around the building.

import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FloorZBounds {
  slabZ: number; // World Z of top of the floor's slab (walls sit on this)
  wallZ: number; // World Z of bottom of walls
  wallTop: number; // World Z of top of walls
  floorHeight: number;
}

// Compute the per-floor Z bands the elevation code uses. Same math:
//   current_z = plinth_height
//   for floor:
//     slab_z   = current_z
//     wall_z   = current_z + slab_thickness
//     wall_top = wall_z + floor_height
//     current_z = wall_top
export function computeFloorZBands(
  floors: Array<Record<string, unknown>>,
  plinthHeight: number,
  slabThickness: number,
  floorHeights: Record<number, number>,
): FloorZBounds[] {
  const bands: FloorZBounds[] = [];
  let current = plinthHeight;
  for (const floor of floors) {
    const num = (floor.floor_number as number | undefined) ?? 0;
    const fh = floorHeights[num] ?? 100;
    const slabZ = current;
    const wallZ = slabZ + slabThickness;
    const wallTop = wallZ + fh;
    bands.push({ slabZ, wallZ, wallTop, floorHeight: fh });
    current = wallTop;
  }
  return bands;
}

// Convert world-space (worldX, worldY, worldZ) → Three.js coords,
// recentred at the plot midpoint so the model sits around the origin.
export function toThreePos(
  worldX: number,
  worldY: number,
  worldZ: number,
  plotWidth: number,
  plotLength: number,
): Vec3 {
  return {
    x: worldX - plotWidth / 2,
    y: worldZ,
    z: worldY - plotLength / 2,
  };
}

export interface PlotBounds {
  width: number; // X extent (east/west)
  length: number; // Y extent (north/south)
}

// Read the plot footprint from a house_config, falling back to the
// plinth footprint if `site` is absent.
export function readPlotBounds(house: Record<string, unknown>): PlotBounds {
  const site = house.site as { plot_width?: number; plot_length?: number } | undefined;
  const plinth = house.plinth as { width?: number; length?: number } | undefined;
  return {
    width: site?.plot_width ?? plinth?.width ?? 270,
    length: site?.plot_length ?? plinth?.length ?? 450,
  };
}

// Convenience: pull the constants we need from DEFAULT_GLOBAL_CONFIG.
export function readGlobals() {
  const g = DEFAULT_GLOBAL_CONFIG;
  return {
    wallThickness: g.wall_thickness,
    plinthHeight: g.plinth_height,
    slabThickness: g.floor_slab_thickness,
    roofThickness: g.roof_thickness,
    beamSize: g.beam_size,
    floorHeights: g.floor_heights,
  };
}
