// Convert legacy rectangle-based roof configs (flat_roof, shed_roof,
// gable_roof, hip_roof) into v2 RoofConfig with segments.
//
// The rule per Design decision #10: segment start → end direction is
// "along" the ridge (for pitched roofs) or "along" the flat centreline
// (for flat / shed). Width is the perpendicular extent. Segments
// generated here start at the NW corner and run to the SE / SW corner
// depending on the axis.

import type {
  EndpointStyle,
  RoofConfig,
  RoofSegment,
  SlopeSpec,
} from "./model";
import { segmentLength } from "./segments";

// Loose input type — legacy configs are Record<string, unknown> as
// stored in JSON. We narrow field by field.
type LegacyRoof = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  length?: number;
  ridge_axis?: "x" | "y";
  slope_dir?: "north" | "south" | "east" | "west";
  ridge_h?: number;
  rise?: number;
  min_pitch_deg?: number;
  // Pitched (hip/gable) uses min_overhang; flat/shed uses overhang.
  // Adapter reads whichever is set.
  min_overhang?: number;
  overhang?: number;
  gable_overhang?: number;
  slab_thickness?: number;
  parapet_height?: number;
  parapet_thickness?: number;
  material?: string;
  framing?: Record<string, unknown>;
  trusses?: { type?: string; positions?: number[] };
  tile_density?: {
    mangalore_per_sft: number;
    ceiling_per_sft: number;
    waste_pct: number;
  };
  metal_stock?: {
    default_length_ft: number;
    cutting_waste_pct: number;
  };
  [k: string]: unknown;
};

// Build the segment centreline for a rectangle at (x, y) with size
// width × length. `alongAxis` = "y" means segment runs N-S along the
// long dim; "x" means E-W along the trans dim. Width of the segment
// is always the cross dimension.
function rectSegment(
  id: string,
  x: number,
  y: number,
  w: number,
  l: number,
  alongAxis: "x" | "y",
): RoofSegment {
  if (alongAxis === "y") {
    // Segment runs N (y_min) → S (y_max) at x-centre. Perpendicular
    // width = the rectangle's X extent.
    const cx = x + w / 2;
    return {
      id,
      start: [cx, y],
      end: [cx, y + l],
      width: w,
    };
  }
  // alongAxis === "x": segment runs W (x_min) → E (x_max) at y-centre.
  // Perpendicular width = the rectangle's Y extent.
  const cy = y + l / 2;
  return {
    id,
    start: [x, cy],
    end: [x + w, cy],
    width: l,
  };
}

// Legacy shed convention (see python/shedGeometry.ts comment header):
//   slope_dir names the HIGH side — the top of the slope.
// So slope_dir="south" means the SOUTH edge is high; the roof pitches
// DOWN from south to north. The ridge (high edge) runs W-E along the
// south edge; the segment lies along that high edge.
//
// Segment orientation: the segment runs ALONG the high edge.
//   slope_dir north/south → high edge is horizontal → segment along X
//   slope_dir east/west   → high edge is vertical   → segment along Y
//
// Placement of segment centreline (per rectSegment we've already
// picked, which puts the segment at the CENTRE of the rectangle
// perpendicular to itself). But for shed, the segment should sit at
// the HIGH EDGE, not the centre — we adjust the endpoints so the
// segment is offset to the high side of the rectangle.
//
// shed_high_side (relative to segment direction):
//   segment along X (W→E): "left" = +Y (south), "right" = -Y (north)
//     slope_dir="south" (high=south) → high on +Y → LEFT
//     slope_dir="north" (high=north) → high on -Y → RIGHT
//   segment along Y (N→S): "left" = -X (west), "right" = +X (east)
//     slope_dir="east" (high=east) → high on +X → RIGHT
//     slope_dir="west" (high=west) → high on -X → LEFT
function shedGeometry(
  x: number,
  y: number,
  w: number,
  l: number,
  slopeDir: "north" | "south" | "east" | "west",
): { seg: RoofSegment; highSide: "left" | "right" } {
  if (slopeDir === "north" || slopeDir === "south") {
    const seg = rectSegment("seg0", x, y, w, l, "x");
    const highSide = slopeDir === "south" ? "left" : "right";
    return { seg, highSide };
  }
  const seg = rectSegment("seg0", x, y, w, l, "y");
  const highSide = slopeDir === "east" ? "right" : "left";
  return { seg, highSide };
}

// Convert one legacy roof object into a v2 RoofConfig.
export function oldRectRoofToSegments(cfg: LegacyRoof): RoofConfig {
  const x = Number(cfg.x ?? 0);
  const y = Number(cfg.y ?? 0);
  const w = Number(cfg.width ?? 300);
  const l = Number(cfg.length ?? 400);
  const minOverhang =
    cfg.min_overhang != null
      ? Number(cfg.min_overhang)
      : cfg.overhang != null
        ? Number(cfg.overhang)
        : undefined;

  // Slope spec resolution — pitched uses ridge_h; shed uses rise (same
  // semantics: rise from wall_top to ridge/high-edge). Either roof
  // type may specify min_pitch_deg as an alternative.
  let slope: SlopeSpec | undefined;
  if (cfg.ridge_h != null) {
    slope = { by: "height", ridge_h: Number(cfg.ridge_h) };
  } else if (cfg.rise != null) {
    slope = { by: "height", ridge_h: Number(cfg.rise) };
  } else if (cfg.min_pitch_deg != null) {
    slope = { by: "angle", angle_deg: Number(cfg.min_pitch_deg) };
  }

  const common = {
    min_overhang: minOverhang,
    slope,
    material: cfg.material,
    framing: cfg.framing as RoofConfig["framing"] | undefined,
    tile_density: cfg.tile_density,
    metal_stock: cfg.metal_stock,
  };

  switch (cfg.type) {
    case "flat_roof": {
      const seg = rectSegment("seg0", x, y, w, l, "y");
      return {
        type: "roof",
        roof_type: "flat",
        segments: [seg],
        slab_thickness: cfg.slab_thickness,
        parapet_height: cfg.parapet_height,
        parapet_thickness: cfg.parapet_thickness,
        ...common,
      };
    }
    case "shed_roof": {
      const slopeDir = (cfg.slope_dir ?? "south") as
        | "north" | "south" | "east" | "west";
      const { seg, highSide } = shedGeometry(x, y, w, l, slopeDir);
      seg.shed_high_side = highSide;
      return {
        type: "roof",
        roof_type: "shed",
        segments: [seg],
        ...common,
      };
    }
    case "gable_roof":
    case "hip_roof": {
      const axis = (cfg.ridge_axis ?? "y") as "x" | "y";
      const seg = rectSegment("seg0", x, y, w, l, axis);
      const alongLen = segmentLength(seg);
      const positions = cfg.trusses?.positions ?? [];
      const trusses = positions.length
        ? [
            {
              segment_id: seg.id,
              type: "fink" as const,
              positions_along: [...positions],
            },
          ]
        : undefined;
      const defaultEndpoint: EndpointStyle =
        cfg.type === "gable_roof" ? "open" : "closed";

      // Hip roof: derive ridge-trim setbacks from truss positions,
      // matching legacy behaviour where the ridge runs between
      // positions[0] and positions[-1].
      if (cfg.type === "hip_roof" && positions.length >= 2) {
        seg.hip_setback_start = Number(positions[0]);
        seg.hip_setback_end = alongLen - Number(positions[positions.length - 1]);
      }
      // Legacy ridge_ventilation.extension_ft → per-endpoint ridge
      // extension past the hip apex. Applies to both ends of the
      // ridge (legacy applies it symmetrically).
      if (cfg.type === "hip_roof") {
        const vent = (cfg as unknown as { ridge_ventilation?: { extension_ft?: number } })
          .ridge_ventilation;
        const extFt = vent?.extension_ft;
        if (extFt != null && Number(extFt) > 0) {
          const extU = Number(extFt) * 10;
          seg.hip_ridge_extension_start = extU;
          seg.hip_ridge_extension_end = extU;
        }
      }
      // Gable roof: legacy gable_overhang extends ridge past the wall
      // on both ends. IMPORTANT — legacy defaults gable_overhang to
      // 0 when unset (no eave/ridge extension past the wall). v2
      // defaults to min_overhang for parity with side eaves. To
      // preserve legacy parity we ALWAYS set explicit values on the
      // adapter output (falling back to 0 when the legacy config
      // omitted it), so the v2 default doesn't leak into converted
      // legacy configs.
      if (cfg.type === "gable_roof") {
        const legacyOv = cfg.gable_overhang != null ? Number(cfg.gable_overhang) : 0;
        seg.gable_overhang_start = legacyOv;
        seg.gable_overhang_end = legacyOv;
      }
      return {
        type: "roof",
        roof_type: "pitched",
        segments: [seg],
        default_endpoint: defaultEndpoint,
        trusses,
        ...common,
      };
    }
    default:
      throw new Error(`oldRectRoofToSegments: unknown legacy type "${cfg.type}"`);
  }
}
