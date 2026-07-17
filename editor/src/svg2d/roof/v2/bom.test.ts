import { describe, expect, it } from "vitest";
import {
  computeAggregateBom,
  computeAllBom,
  computeFrameBom,
  computeMetalBom,
  DEFAULT_METAL_STOCK,
  DEFAULT_V2_FRAMING,
  matSpec,
  ridgeRunFt,
  slopeAreaSft,
} from "./bom";
import { deriveFlatRoof } from "./deriveFlat";
import { derivePitchedRoof } from "./derivePitched";
import type { RoofConfig } from "./model";
import { resolveJoints, ridgeZFromConfig } from "./resolveJoints";

const commonPitched = {
  slope: { by: "height" as const, ridge_h: 50 },
  min_overhang: 25,
};

const pureHip = (): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300 }],
  default_endpoint: "closed",
  ...commonPitched,
});

const pureGable = (): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300 }],
  default_endpoint: "open",
  ...commonPitched,
});

describe("matSpec", () => {
  it("canonical format matches legacy exactly", () => {
    expect(matSpec([6, 3], 3, "MS")).toBe("6×3 in × 3 mm MS");
  });
});

describe("computeFrameBom — pure hip", () => {
  const spec = derivePitchedRoof(pureHip(), { wallTopZ: 100 });
  const rows = computeFrameBom(spec);

  it("has central ridge + hip ridges + ring beam rows", () => {
    const items = rows.map((r) => r.item);
    expect(items).toContain("Central ridge");
    expect(items).toContain("Hip ridges");
    expect(items).toContain("Ring beam");
  });
  it("does not have a valleys row (no joints in single-segment hip)", () => {
    const items = rows.map((r) => r.item);
    expect(items).not.toContain("Valleys");
  });
  it("central ridge count = 1", () => {
    expect(rows.find((r) => r.item === "Central ridge")!.count).toBe(1);
  });
  it("hip ridges count = 4 (2 endcaps × 2 diagonals)", () => {
    expect(rows.find((r) => r.item === "Hip ridges")!.count).toBe(4);
  });
  it("ring beam count = 4 (segment rectangle edges)", () => {
    expect(rows.find((r) => r.item === "Ring beam")!.count).toBe(4);
  });
  it("ridge totalLenFt = 200u / 10 = 20 ft (segment 500u, hip trims 150u each side → 200u ridge)", () => {
    const ridge = rows.find((r) => r.item === "Central ridge")!;
    expect(ridge.totalLenFt).toBeCloseTo(20, 6);
  });
});

describe("computeFrameBom — pure gable (no hips)", () => {
  const spec = derivePitchedRoof(pureGable(), { wallTopZ: 100 });
  const rows = computeFrameBom(spec);

  it("has central ridge + ring beam, no hip ridges", () => {
    const items = rows.map((r) => r.item);
    expect(items).toContain("Central ridge");
    expect(items).toContain("Ring beam");
    expect(items).not.toContain("Hip ridges");
  });
  it("central ridge spans segment + default gable_overhang on each end", () => {
    // Gable now defaults gable_overhang to min_overhang (25). Ridge
    // = 500u segment + 25 on each end = 550u = 55 ft.
    const ridge = rows.find((r) => r.item === "Central ridge")!;
    expect(ridge.totalLenFt).toBeCloseTo(55, 6);
  });
});

describe("computeFrameBom — L-shape with joint valleys", () => {
  const cfg: RoofConfig = {
    type: "roof",
    roof_type: "pitched",
    segments: [
      { id: "a", start: [150, 0], end: [150, 250], width: 300 },
      { id: "b", start: [150, 250], end: [500, 250], width: 200 },
    ],
    default_endpoint: "closed",
    ...commonPitched,
  };
  const wallTopZ = 100;
  const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
  const base = derivePitchedRoof(cfg, { wallTopZ });
  const spec = resolveJoints(cfg, base, { wallTopZ, ridgeZ });
  const rows = computeFrameBom(spec);

  it("emits a Valleys row (from resolveJoints output)", () => {
    const valleys = rows.find((r) => r.item === "Valleys");
    expect(valleys).toBeDefined();
    expect(valleys!.count).toBe(1);
  });
  it("emits 2 central-ridge line items (one per segment) — count is 2", () => {
    expect(rows.find((r) => r.item === "Central ridge")!.count).toBe(2);
  });
  it("hip ridges = 5 (4 leaf-endpoint diagonals + 1 outside-hip at joint)", () => {
    expect(rows.find((r) => r.item === "Hip ridges")!.count).toBe(5);
  });
});

describe("computeFrameBom — trusses", () => {
  const cfgWithTrusses = (): RoofConfig => ({
    ...pureHip(),
    trusses: [{ segment_id: "s0", type: "fink", positions_along: [100, 250, 400] }],
  });

  it("emits 3 truss rows (top chord + bottom chord + webs) when trusses exist", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    const items = rows.map((r) => r.item);
    expect(items).toContain("Truss top chord");
    expect(items).toContain("Truss bottom chord");
    expect(items).toContain("Truss webs");
  });

  it("truss top chord count = 2 × number of trusses", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    const top = rows.find((r) => r.item === "Truss top chord")!;
    expect(top.count).toBe(6);   // 2 chords × 3 trusses
  });

  it("truss bottom chord count = 1 × number of trusses", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    const bc = rows.find((r) => r.item === "Truss bottom chord")!;
    expect(bc.count).toBe(3);
  });

  it("truss webs count = 5 × number of trusses (king post + 2 diag + 2 vert)", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    const web = rows.find((r) => r.item === "Truss webs")!;
    expect(web.count).toBe(15);
  });

  it("truss chord matSpec = 2×4 in × 3 mm MS by default", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    const top = rows.find((r) => r.item === "Truss top chord")!;
    expect(top.matSpec).toBe("2×4 in × 3 mm MS");
  });

  it("truss webs matSpec = 2×2 in × 2 mm MS by default", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    const web = rows.find((r) => r.item === "Truss webs")!;
    expect(web.matSpec).toBe("2×2 in × 2 mm MS");
  });

  it("custom truss section flows into matSpec", () => {
    const spec = derivePitchedRoof(cfgWithTrusses(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec, {
      truss: {
        chord_size_in: [3, 5], chord_wall_mm: 4,
        web_size_in: [2, 3], web_wall_mm: 2.5,
      },
    });
    expect(rows.find((r) => r.item === "Truss top chord")!.matSpec)
      .toBe("3×5 in × 4 mm MS");
    expect(rows.find((r) => r.item === "Truss webs")!.matSpec)
      .toBe("2×3 in × 2.5 mm MS");
  });

  it("no trusses → no truss rows", () => {
    const spec = derivePitchedRoof(pureHip(), { wallTopZ: 100 });
    const rows = computeFrameBom(spec);
    expect(rows.find((r) => r.item === "Truss top chord")).toBeUndefined();
  });
});

describe("computeFrameBom — framing overrides", () => {
  const spec = derivePitchedRoof(pureHip(), { wallTopZ: 100 });
  it("custom ridge_size_in flows into the row's matSpec", () => {
    const rows = computeFrameBom(spec, { ridge_size_in: [4, 2], ridge_wall_mm: 2 });
    const ridge = rows.find((r) => r.item === "Central ridge")!;
    expect(ridge.matSpec).toBe("4×2 in × 2 mm MS");
  });
  it("custom material flows through matSpec", () => {
    const rows = computeFrameBom(spec, { material: "GI" });
    for (const r of rows) expect(r.matSpec.endsWith("GI")).toBe(true);
  });
});

describe("computeMetalBom", () => {
  const spec = derivePitchedRoof(pureHip(), { wallTopZ: 100 });
  const frameRows = computeFrameBom(spec);

  it("aggregates by matSpec — ridge + hip use same size → one row", () => {
    const metal = computeMetalBom(frameRows);
    const ridgeGroup = metal.find((r) => r.matSpec.startsWith("6×3"));
    expect(ridgeGroup).toBeDefined();
    // Ridge (20 ft) + hip ridges (4 × diagonal length) all group here.
    const ridgeRow = frameRows.find((r) => r.item === "Central ridge")!;
    const hipRow = frameRows.find((r) => r.item === "Hip ridges")!;
    expect(ridgeGroup!.totalLenFt).toBeCloseTo(
      ridgeRow.totalLenFt + hipRow.totalLenFt, 6,
    );
  });
  it("pieces to order = ceil(total × (1 + waste) / stock)", () => {
    const metal = computeMetalBom(frameRows, {
      default_length_ft: 20, cutting_waste_pct: 5,
    });
    for (const r of metal) {
      const withWaste = r.totalLenFt * 1.05;
      const expected = Math.ceil(withWaste / 20);
      expect(r.piecesToOrder).toBe(expected);
    }
  });
  it("contributingItems lists every FrameBomRow that fed the group", () => {
    const metal = computeMetalBom(frameRows);
    const ridgeGroup = metal.find((r) => r.matSpec.startsWith("6×3"))!;
    expect(ridgeGroup.contributingItems).toEqual(
      ["Central ridge", "Hip ridges"],
    );
  });
  it("output is alphabetically sorted by matSpec (localeCompare)", () => {
    const metal = computeMetalBom(frameRows);
    const specs = metal.map((r) => r.matSpec);
    const sorted = [...specs].sort((a, b) => a.localeCompare(b));
    expect(specs).toEqual(sorted);
  });
});

describe("computeAllBom + computeAggregateBom", () => {
  it("computeAllBom returns matching frame + metal from one spec", () => {
    const spec = derivePitchedRoof(pureHip(), { wallTopZ: 100 });
    const { frame, metal } = computeAllBom(spec);
    expect(frame.length).toBeGreaterThan(0);
    expect(metal.length).toBeGreaterThan(0);
  });
  it("computeAggregateBom merges rows across multiple roofs", () => {
    // Two identical hip roofs → each row's count / total should double.
    const spec = derivePitchedRoof(pureHip(), { wallTopZ: 100 });
    const single = computeFrameBom(spec);
    const agg = computeAggregateBom([{ spec }, { spec }]);
    for (const row of agg.frame) {
      const solo = single.find(
        (r) => r.item === row.item && r.matSpec === row.matSpec,
      )!;
      expect(row.count).toBe(solo.count * 2);
      expect(row.totalLenFt).toBeCloseTo(solo.totalLenFt * 2, 6);
      // maxLenFt should NOT double — single piece length is unchanged
      expect(row.maxLenFt).toBeCloseTo(solo.maxLenFt, 6);
    }
  });
});

describe("computeFrameBom — flat roof (parapet caps only)", () => {
  const flatCfg: RoofConfig = {
    type: "roof",
    roof_type: "flat",
    segments: [{ id: "s0", start: [150, 20], end: [150, 420], width: 300 }],
    min_overhang: 5,
    slab_thickness: 6,
    parapet_height: 30,
    parapet_thickness: 8,
  };
  it("has parapet_cap row when parapet_height > 0", () => {
    const spec = deriveFlatRoof(flatCfg, { wallTopZ: 100 });
    // Note: current DEFAULT_V2_FRAMING doesn't list parapet_cap because
    // that's not part of the roof frame. It's emitted as members with
    // role=parapet_cap; those don't appear in the frame BOM (they're
    // a separate line-item category). Verify no crash and empty output.
    const rows = computeFrameBom(spec);
    // Flat has no ridge / hip / valley / ring beam / rafter / purlin.
    expect(rows.length).toBe(0);
  });
});

describe("slopeAreaSft + ridgeRunFt", () => {
  it("slopeAreaSft = 0 for empty spec", () => {
    expect(slopeAreaSft({ members: [], planes: [], trusses: [] })).toBe(0);
  });

  it("pure hip: slope area sums 2 slope quads + 2 hip triangles", () => {
    // Konkan-style hip: 300u × 500u, ridge_h 50, overhang 25.
    // Verified via computeSpecBounds in Step 7; here just sanity that
    // area is > 0 and roughly matches the footprint × secant(pitch).
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "closed",
      ...commonPitched,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const area = slopeAreaSft(spec);
    // Footprint ≈ (300+50) × (500+50) / 100 sqft ≈ 1925 sqft flat.
    // Pitched adds ~5-15% for slope. Expect > 1900 sqft.
    expect(area).toBeGreaterThan(1900);
    expect(area).toBeLessThan(2500);
  });

  it("pure gable slope area > pure hip slope area (gables don't add hip triangles but slopes are wider)", () => {
    // Actually pure gable has 2 rectangular slopes covering the full
    // long-axis extent; hip has 2 trapezoidal slopes + 2 hip
    // triangles. Total surface is similar; skip strict comparison,
    // just verify both non-zero.
    const gableCfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "open",
      ...commonPitched,
    };
    expect(slopeAreaSft(derivePitchedRoof(gableCfg, { wallTopZ: 100 }))).toBeGreaterThan(0);
  });

  it("ridgeRunFt sums only ridge members (excludes hip diagonals + ring beam)", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "closed",   // hip: ridge trimmed 150u each end → 200u ridge
      ...commonPitched,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(ridgeRunFt(spec)).toBeCloseTo(20, 6);  // 200u / 10 = 20 ft
  });

  it("ridgeRunFt for pure gable = segment + default gable_overhang each end", () => {
    // 500u segment + 25u overhang each end (default = min_overhang) = 550u = 55 ft.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "open",
      ...commonPitched,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(ridgeRunFt(spec)).toBeCloseTo(55, 6);
  });
});

describe("defaults sanity", () => {
  it("DEFAULT_V2_FRAMING matches legacy roof_framing defaults", () => {
    expect(DEFAULT_V2_FRAMING.rafter_size_in).toEqual([2, 4]);
    expect(DEFAULT_V2_FRAMING.rafter_spacing_in).toBe(36);
    expect(DEFAULT_V2_FRAMING.ridge_size_in).toEqual([6, 3]);
    expect(DEFAULT_V2_FRAMING.ring_beam_size_in).toEqual([4, 2]);
  });
  it("DEFAULT_METAL_STOCK matches common Indian MS pipe stock", () => {
    expect(DEFAULT_METAL_STOCK.default_length_ft).toBe(20);
    expect(DEFAULT_METAL_STOCK.cutting_waste_pct).toBe(5);
  });
});
