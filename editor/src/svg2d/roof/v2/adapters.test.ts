import { describe, expect, it } from "vitest";
import { oldRectRoofToSegments } from "./adapters";

describe("oldRectRoofToSegments — flat_roof", () => {
  it("one segment along Y (default long-axis convention)", () => {
    const v2 = oldRectRoofToSegments({
      type: "flat_roof",
      x: 10,
      y: 20,
      width: 300,
      length: 400,
      slab_thickness: 6,
      parapet_height: 30,
    });
    expect(v2.roof_type).toBe("flat");
    expect(v2.segments.length).toBe(1);
    const s = v2.segments[0];
    expect(s.start).toEqual([160, 20]);        // cx=160, y=20
    expect(s.end).toEqual([160, 420]);         // cx=160, y+l=420
    expect(s.width).toBe(300);
    expect(v2.slab_thickness).toBe(6);
    expect(v2.parapet_height).toBe(30);
  });
});

describe("oldRectRoofToSegments — shed_roof", () => {
  // Legacy convention (see shedGeometry.ts): slope_dir names the HIGH
  // edge. slope_dir="south" → south edge is the high edge.
  it("slope_dir=south → segment along X, high side = left (=south)", () => {
    // Rect x=0 y=0 w=200 l=100. Segment runs W→E (alongAxis=x).
    // Left of W→E is +Y (south). slope_dir=south → HIGH on +Y → LEFT.
    const v2 = oldRectRoofToSegments({
      type: "shed_roof",
      x: 0,
      y: 0,
      width: 200,
      length: 100,
      slope_dir: "south",
      rise: 20,
    });
    expect(v2.roof_type).toBe("shed");
    const s = v2.segments[0];
    expect(s.start).toEqual([0, 50]);
    expect(s.end).toEqual([200, 50]);
    expect(s.width).toBe(100);
    expect(s.shed_high_side).toBe("left");
    // rise → slope by height.
    expect(v2.slope).toEqual({ by: "height", ridge_h: 20 });
  });
  it("slope_dir=north → high side = right", () => {
    const v2 = oldRectRoofToSegments({
      type: "shed_roof",
      x: 0,
      y: 0,
      width: 200,
      length: 100,
      slope_dir: "north",
      rise: 15,
    });
    expect(v2.segments[0].shed_high_side).toBe("right");
  });
  it("slope_dir=east → segment along Y, high side = right (=east)", () => {
    const v2 = oldRectRoofToSegments({
      type: "shed_roof",
      x: 0,
      y: 0,
      width: 100,
      length: 200,
      slope_dir: "east",
      rise: 40,
    });
    const s = v2.segments[0];
    // alongAxis=y → cx=50, segment (50,0) → (50,200)
    expect(s.start).toEqual([50, 0]);
    expect(s.end).toEqual([50, 200]);
    expect(s.width).toBe(100);
    // Left of N→S is +X (east) → HIGH on +X → RIGHT.
    expect(s.shed_high_side).toBe("right");
  });
  it("min_pitch_deg becomes SlopeSpec by angle", () => {
    const v2 = oldRectRoofToSegments({
      type: "shed_roof",
      x: 0,
      y: 0,
      width: 100,
      length: 100,
      slope_dir: "south",
      min_pitch_deg: 25,
    });
    expect(v2.slope).toEqual({ by: "angle", angle_deg: 25 });
  });
});

describe("oldRectRoofToSegments — gable_roof", () => {
  it("ridge_axis=y → pitched with default_endpoint=open, segment along Y", () => {
    const v2 = oldRectRoofToSegments({
      type: "gable_roof",
      x: 0,
      y: 0,
      width: 300,
      length: 500,
      ridge_axis: "y",
      ridge_h: 50,
      min_overhang: 25,
    });
    expect(v2.roof_type).toBe("pitched");
    expect(v2.default_endpoint).toBe("open");
    expect(v2.slope).toEqual({ by: "height", ridge_h: 50 });
    expect(v2.min_overhang).toBe(25);
    const s = v2.segments[0];
    expect(s.start).toEqual([150, 0]);
    expect(s.end).toEqual([150, 500]);
    expect(s.width).toBe(300);
  });
  it("ridge_axis=x → segment along X, width = Y extent", () => {
    const v2 = oldRectRoofToSegments({
      type: "gable_roof",
      x: 0,
      y: 0,
      width: 600,
      length: 200,
      ridge_axis: "x",
      ridge_h: 40,
    });
    const s = v2.segments[0];
    expect(s.start).toEqual([0, 100]);
    expect(s.end).toEqual([600, 100]);
    expect(s.width).toBe(200);
  });
});

describe("oldRectRoofToSegments — hip_roof", () => {
  it("ridge_axis=y → pitched with default_endpoint=closed", () => {
    const v2 = oldRectRoofToSegments({
      type: "hip_roof",
      x: 0,
      y: 0,
      width: 180,
      length: 308,
      ridge_axis: "y",
      ridge_h: 45,
      min_overhang: 25,
      trusses: { type: "fink", positions: [70, 150, 240] },
    });
    expect(v2.roof_type).toBe("pitched");
    expect(v2.default_endpoint).toBe("closed");
    expect(v2.trusses).toEqual([
      {
        segment_id: "seg0",
        type: "fink",
        positions_along: [70, 150, 240],
      },
    ]);
    const s = v2.segments[0];
    expect(s.start).toEqual([90, 0]);
    expect(s.end).toEqual([90, 308]);
    expect(s.width).toBe(180);
  });
  it("ridge_axis=x preserves truss positions along X", () => {
    const v2 = oldRectRoofToSegments({
      type: "hip_roof",
      x: 0,
      y: 0,
      width: 600,
      length: 200,
      ridge_axis: "x",
      ridge_h: 50,
      trusses: { type: "fink", positions: [100, 300, 500] },
    });
    const s = v2.segments[0];
    expect(s.start).toEqual([0, 100]);
    expect(s.end).toEqual([600, 100]);
    expect(s.width).toBe(200);
    expect(v2.trusses![0].positions_along).toEqual([100, 300, 500]);
  });
  it("unknown legacy type throws", () => {
    expect(() =>
      oldRectRoofToSegments({ type: "bogus_roof", x: 0, y: 0, width: 1, length: 1 }),
    ).toThrow(/unknown legacy type/);
  });
});

describe("oldRectRoofToSegments — common propagation", () => {
  it("material + framing + tile_density + metal_stock pass through", () => {
    const v2 = oldRectRoofToSegments({
      type: "hip_roof",
      x: 0,
      y: 0,
      width: 300,
      length: 400,
      ridge_axis: "y",
      ridge_h: 50,
      material: "clay_tile",
      framing: { rafter_size_ft: [0.15, 0.3] },
      tile_density: { mangalore_per_sft: 15, ceiling_per_sft: 1, waste_pct: 5 },
      metal_stock: { default_length_ft: 20, cutting_waste_pct: 8 },
    });
    expect(v2.material).toBe("clay_tile");
    expect(v2.framing).toEqual({ rafter_size_ft: [0.15, 0.3] });
    expect(v2.tile_density).toEqual({
      mangalore_per_sft: 15,
      ceiling_per_sft: 1,
      waste_pct: 5,
    });
    expect(v2.metal_stock).toEqual({
      default_length_ft: 20,
      cutting_waste_pct: 8,
    });
  });
});
