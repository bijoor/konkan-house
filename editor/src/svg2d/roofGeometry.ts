// Port of roof_geometry.py. Pure math — no bpy, no I/O. Returns the same
// derived-geometry dict the Python side merges into the hip_roof config.
//
// Numeric-type note: Python uses `float(...)`, `math.tan`, `math.radians`
// and mixed float multiplication throughout — every value in the returned
// dict is a Python float. In JS these are just numbers; downstream
// consumers must format via `fFloat` to reproduce "0.0"/"1.0" trailing
// zeroes.

import type { GlobalConfig } from "./config";
import type { HouseConfig } from "./expand";

type HipRoof = Record<string, unknown>;

export function findHipRoof(
  houseConfig: HouseConfig,
): [HipRoof | null, number | null] {
  for (const floor of houseConfig.floors ?? []) {
    for (const obj of (floor.objects ?? []) as HipRoof[]) {
      if (obj.type === "hip_roof") {
        return [obj, (floor.floor_number as number | undefined) ?? 0];
      }
    }
  }
  return [null, null];
}

export function computeTopFloorWallTopZ(
  floorNumber: number,
  globalConfig: GlobalConfig,
  beamOffset = 0.0,
): number {
  let z = globalConfig.plinth_height as number;
  const slab = (globalConfig.floor_slab_thickness as number | undefined) ?? 0;
  const floorHeights = globalConfig.floor_heights as Record<number, number>;
  for (let f = 0; f < floorNumber; f++) {
    z += slab;
    z += floorHeights[f];
  }
  z += beamOffset;
  return z;
}

export function deriveHipRoofGeometry(
  hipRoof: HipRoof,
  wallTopZ: number,
  houseTransU: number,
  houseLongU: number,
  ridgeAxis: string = "y",
): Record<string, unknown> {
  if (ridgeAxis !== "y") {
    throw new Error(
      "deriveHipRoofGeometry currently supports ridge_axis='y' only",
    );
  }

  const trusses = hipRoof.trusses as { positions?: number[] } | undefined;
  if (!trusses || !trusses.positions) {
    throw new Error("hip_roof.trusses.positions is required");
  }
  const positions = trusses.positions;
  if (positions.length < 2) {
    throw new Error("hip_roof.trusses.positions needs at least two entries");
  }
  for (let i = 0; i < positions.length - 1; i++) {
    if (positions[i + 1] <= positions[i]) {
      throw new Error(
        "hip_roof.trusses.positions must be strictly increasing",
      );
    }
  }
  const ridgeYStart = Number(positions[0]);
  const ridgeYEnd = Number(positions[positions.length - 1]);
  if (ridgeYStart <= 0) {
    throw new Error(`trusses.positions[0]=${ridgeYStart} must be > 0`);
  }
  if (ridgeYEnd >= houseLongU) {
    throw new Error(
      `trusses.positions[-1]=${ridgeYEnd} must be < house_long_u (${houseLongU})`,
    );
  }

  const dMax = Math.max(
    houseTransU / 2.0,
    ridgeYStart,
    houseLongU - ridgeYEnd,
  );

  let ridgeH: number;
  if ("ridge_h_ft" in hipRoof) {
    const v = hipRoof.ridge_h_ft as number;
    if (v <= 0) throw new Error("hip_roof.ridge_h_ft must be > 0");
    ridgeH = v * 10.0;
  } else if ("min_pitch_deg" in hipRoof) {
    const mp = Number(hipRoof.min_pitch_deg);
    if (!(mp > 0 && mp < 90)) {
      throw new Error("hip_roof.min_pitch_deg must be in (0, 90)");
    }
    ridgeH = dMax * Math.tan((mp * Math.PI) / 180);
  } else {
    throw new Error(
      "hip_roof must specify one of 'ridge_h_ft' or 'min_pitch_deg'",
    );
  }

  const minOv = Number(hipRoof.min_overhang_ft ?? 0) * 10.0;
  if (minOv <= 0) throw new Error("hip_roof.min_overhang_ft must be > 0");

  const dCrit = Math.min(
    houseTransU / 2.0,
    ridgeYStart,
    houseLongU - ridgeYEnd,
  );

  const pitchEw =
    (Math.atan(ridgeH / (houseTransU / 2.0)) * 180) / Math.PI;
  const pitchN = (Math.atan(ridgeH / ridgeYStart) * 180) / Math.PI;
  const pitchS =
    (Math.atan(ridgeH / (houseLongU - ridgeYEnd)) * 180) / Math.PI;

  const eaveDrop = (minOv * ridgeH) / dCrit;
  const eaveZ = wallTopZ - eaveDrop;

  const oEw = (minOv * (houseTransU / 2.0)) / dCrit;
  const oN = (minOv * ridgeYStart) / dCrit;
  const oS = (minOv * (houseLongU - ridgeYEnd)) / dCrit;

  const ventCfg =
    (hipRoof.ridge_ventilation as Record<string, unknown> | null | undefined) ??
    {};
  let ridgeExtU =
    Math.max(0.0, Number(ventCfg.extension_ft ?? 0.0)) * 10.0;
  const maxExtU = Math.min(ridgeYStart - 1.0, houseLongU - ridgeYEnd - 1.0);
  if (ridgeExtU > maxExtU && maxExtU > 0) {
    ridgeExtU = maxExtU;
  }
  const hasRidgeVent = ridgeExtU > 1e-6;
  const ridgeYStartExt = ridgeYStart - ridgeExtU;
  const ridgeYEndExt = ridgeYEnd + ridgeExtU;

  return {
    eave_x_west: 0 - oEw,
    eave_x_east: houseTransU + oEw,
    eave_y_north: 0 - oN,
    eave_y_south: houseLongU + oS,
    eave_z: eaveZ,
    ridge_y_start: ridgeYStart,
    ridge_y_end: ridgeYEnd,
    ridge_h: ridgeH,
    ridge_axis: ridgeAxis,
    slope_angle_ew: pitchEw,
    slope_angle_ns: pitchN,
    slope_angle_ns_n: pitchN,
    slope_angle_ns_s: pitchS,
    wall_top_above_eave: eaveDrop,
    wall_top_above_eave_ft: eaveDrop / 10.0,
    overhang_ew_ft: oEw / 10.0,
    overhang_n_ft: oN / 10.0,
    overhang_s_ft: oS / 10.0,
    d_crit: dCrit,
    ridge_ext_u: ridgeExtU,
    ridge_ext_ft: ridgeExtU / 10.0,
    has_ridge_vent: hasRidgeVent,
    ridge_y_start_ext: ridgeYStartExt,
    ridge_y_end_ext: ridgeYEndExt,
    ridge_vent_cfg: { ...ventCfg },
  };
}

export function deriveForHouse(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): Record<string, unknown> | null {
  const [hipRoof, floorNum] = findHipRoof(houseConfig);
  if (hipRoof === null || floorNum === null) return null;
  const framing =
    (hipRoof.framing as Record<string, unknown> | undefined) ?? {};
  const houseFt = (framing.house_footprint_ft as [number, number] | undefined) ??
    [27.0, 45.0];
  const houseTransU = houseFt[0] * 10.0;
  const houseLongU = houseFt[1] * 10.0;
  let beamOffsetU: number;
  if ("beam_offset_ft" in hipRoof) {
    beamOffsetU = (hipRoof.beam_offset_ft as number) * 10.0;
  } else {
    beamOffsetU = Number(globalConfig.wall_thickness ?? 8);
  }
  const wallTopZ = computeTopFloorWallTopZ(floorNum, globalConfig, beamOffsetU);
  return deriveHipRoofGeometry(
    hipRoof,
    wallTopZ,
    houseTransU,
    houseLongU,
    (hipRoof.ridge_axis as string | undefined) ?? "y",
  );
}
