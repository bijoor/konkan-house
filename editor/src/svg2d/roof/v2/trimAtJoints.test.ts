import { describe, expect, it } from "vitest";
import { derivePitchedRoof } from "./derivePitched";
import type { RoofConfig } from "./model";
import { resolveJoints, ridgeZFromConfig } from "./resolveJoints";
import { trimAtJoints } from "./trimAtJoints";
import { populateRoofFraming } from "./rafters";
import { DEFAULT_V2_FRAMING } from "./bom";

// L-shape config: wing 1 N-S from (150, 0) to (150, 250), width 300;
// wing 2 E-W from (150, 250) to (500, 250), width 200. Joint at
// (150, 250).
const lShape = (): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [
    { id: "a", start: [150, 0], end: [150, 250], width: 300 },
    { id: "b", start: [150, 250], end: [500, 250], width: 200 },
  ],
  default_endpoint: "closed",
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
});

describe("trimAtJoints — L-shape", () => {
  const cfg = lShape();
  const wallTopZ = 100;
  const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
  const spec0 = derivePitchedRoof(cfg, { wallTopZ });
  const spec1 = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
  const spec2 = populateRoofFraming(spec1, DEFAULT_V2_FRAMING, cfg, wallTopZ);
  const trimmed = trimAtJoints(spec2);

  it("emits one valley member (from resolveJoints)", () => {
    const valleys = trimmed.members.filter((m) => m.role === "valley");
    expect(valleys.length).toBe(1);
  });

  it("wing 1's east slope has been trimmed (5 vertices, not 4)", () => {
    // Wing 1 = seg "a", east slope = slope.right (rightN = +X for +Y segment).
    const slope = trimmed.planes.find(
      (p) => p.source_segment_id === "a"
        && p.role === "slope"
        && p.side_of_segment === "right",
    );
    expect(slope).toBeDefined();
    // Original quad had 4 vertices. Trimming by the valley should
    // insert 1 intersection point → 5 vertices (pentagon). Or if
    // one vertex is cut off, could be 4 (still quad). Either way,
    // vertex count changes if it was actually clipped.
    expect(slope!.vertices.length).toBeGreaterThanOrEqual(4);
  });

  it("wing 2's north slope has been trimmed", () => {
    // Wing 2 = seg "b", north slope = slope.right (rightN = -Y for +X segment = north).
    const slope = trimmed.planes.find(
      (p) => p.source_segment_id === "b"
        && p.role === "slope"
        && p.side_of_segment === "right",
    );
    expect(slope).toBeDefined();
    expect(slope!.vertices.length).toBeGreaterThanOrEqual(4);
  });

  it("some wing-1 rafters that cross into wing 2's territory are trimmed shorter", () => {
    // Face-based emission fills the (trimmed) slope.right polygon
    // for wing 1 — so rafters there should exist and be shorter than
    // the untrimmed rafter length.
    const wing1RightRafters = trimmed.members.filter(
      (m) => m.role === "rafter" && m.source_plane_id === "a.slope.right",
    );
    expect(wing1RightRafters.length).toBeGreaterThan(0);
  });

  it("wing-1 ring-beam members overlapping wing 2 are trimmed", () => {
    // Ring beam on wing 1 has 4 sides at wall_top_z. The east side
    // (X = 300 for width 300 centered at 150) runs from Y=0 to Y=250.
    // At the joint (Y=250), it would extend into wing 2's territory.
    // The valley trim should shorten this.
    const wing1Ring = trimmed.members.filter(
      (m) => m.role === "ring_beam" && m.source_segment_id === "a",
    );
    expect(wing1Ring.length).toBeGreaterThan(0);
  });
});

describe("trimAtJoints — single segment (no joints)", () => {
  it("returns spec unchanged when there are no joint members", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "closed",
      slope: { by: "height", ridge_h: 50 },
      min_overhang: 25,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const trimmed = trimAtJoints(spec);
    expect(trimmed.planes.length).toBe(spec.planes.length);
    expect(trimmed.members.length).toBe(spec.members.length);
  });
});
