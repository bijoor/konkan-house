// Integration test — walks the full sequence that connects per-floor
// heights to the ring beam's Z position:
//
//   1. computeTopFloorWallTopZ(topFloorIdx, globals, 0, floors, defaults)
//      → sums plinth + Σ floor_heights (per user's directive:
//        slab_thickness is NOT part of the vertical stack).
//   2. derivePitchedRoof(cfg, { wallTopZ })
//      → emits a ring_beam member at exactly opts.wallTopZ.
//   3. The ring beam's start.z (= end.z) is that same value.
//
// Scenario: default plinth = 30, 2 floors below the roof, each with
//   floor_height = 98 (drives the stack)
//   wall_height  = 90 (independent — walls stand 90 tall)
//   slab_thickness = 8 (independent — deck depth, NOT summed)
// Expected roof wall-top-Z (== ring beam Z) = 30 + 98 + 98 = 226.

import { describe, expect, it } from "vitest";
import { DEFAULT_GLOBAL_CONFIG } from "../../config";
import { computeTopFloorWallTopZ } from "../../roofGeometry";
import { derivePitchedRoof } from "./derivePitched";
import { computeMergedV2Spec } from "./computeFromHouse";
import type { RoofConfig } from "./model";
import type { HouseConfig } from "../../expand";

describe("floor heights → ring beam Z (integration)", () => {
  it("default plinth 30 + two floors at floor_height 98 → ring beam Z = 226", () => {
    // Step 1 — configure the globals + house defaults + per-floor stack.
    const globals = {
      ...DEFAULT_GLOBAL_CONFIG,
      // plinth stays at the code default (30)
      floor_height: 98,      // used if a floor lacks its own `height`
      wall_height: 90,       // (independent, not consumed by roof Z)
      floor_slab_thickness: 8, // (independent, not summed into Z)
    };
    const houseDefaults = {
      floor_height: 98,
      wall_height: 90,
      slab_thickness: 8,
    };
    // Plinth floor (idx 0, height 30), ground (idx 1), first (idx 2), roof
    // floor (idx 3). Ground/first pick up 98 from defaults; the stack seeds at
    // ground level 0 and the plinth floor's own height (30) is the first term.
    const floors: Array<{ height?: number; slab_thickness?: number }> = [
      { height: 30 }, {}, {}, {},
    ];

    // Step 2 — compute the wall-top-Z the roof pipeline uses.
    const wallTopZ = computeTopFloorWallTopZ(
      3,       // roof lives on floor index 3 → sums floors [0..2] = plinth+2
      globals,
      0,       // beamOffset removed for v2 (always 0)
      floors,
      houseDefaults,
    );
    expect(wallTopZ).toBeCloseTo(30 + 98 + 98, 6);
    expect(wallTopZ).toBe(226);

    // Step 3 — derive a minimal pitched-roof spec and check the ring
    // beam's Z matches the wallTopZ that we passed in.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "seg0", start: [50, 0], end: [50, 200], width: 100 }],
      default_endpoint: "closed",
      slope: { by: "height", ridge_h: 50 },
      min_overhang: 20,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ });

    const ringBeams = spec.members.filter((m) => m.role === "ring_beam");
    expect(ringBeams.length).toBeGreaterThan(0);
    for (const rb of ringBeams) {
      expect(rb.start[2]).toBe(226);
      expect(rb.end[2]).toBe(226);
    }
  });

  it("computeMergedV2Spec (end-to-end path used by the app) puts the ring beam at 226", () => {
    // Full HouseConfig-shaped input that flows through the SAME code
    // path that the app + SVG generators use (computeMergedV2Spec →
    // computeTopFloorWallTopZ inside the loop → derivePitchedRoof).
    const house: HouseConfig = {
      site: {
        reference_x: 0, reference_y: 0,
        plot_length: 200, plot_width: 100,
      },
      defaults: { floor_height: 98, wall_height: 90, slab_thickness: 8 },
      floors: [
        { floor_number: 0, name: "Plinth", height: 30, objects: [
          { type: "ground", x: 0, y: 0, width: 100, length: 200 },
          { type: "plinth", x: 0, y: 0, width: 100, length: 200, height: 30 },
        ] },
        { floor_number: 1, name: "Ground", objects: [] },
        { floor_number: 2, name: "First", objects: [] },
        {
          floor_number: 3, name: "Roof", objects: [
            {
              type: "roof",
              roof_type: "pitched",
              segments: [{ id: "seg0", start: [50, 0], end: [50, 200], width: 100 }],
              default_endpoint: "closed",
              slope: { by: "height", ridge_h: 50 },
              min_overhang: 20,
            } as unknown as Record<string, unknown>,
          ],
        },
      ],
    } as unknown as HouseConfig;

    const spec = computeMergedV2Spec(house);
    const ringBeams = spec.members.filter((m) => m.role === "ring_beam");
    expect(ringBeams.length).toBeGreaterThan(0);
    for (const rb of ringBeams) {
      expect(rb.start[2]).toBe(226);
      expect(rb.end[2]).toBe(226);
    }
  });

  it("slab_thickness and wall_height do NOT affect ring beam Z (independence check)", () => {
    const globals = { ...DEFAULT_GLOBAL_CONFIG };
    // floors = [plinth(30), ground, first, roof]; roof at index 3.
    const withThickSlab = computeTopFloorWallTopZ(
      3, globals, 0, [{ height: 30 }, {}, {}, {}],
      { floor_height: 98, wall_height: 90, slab_thickness: 8 },
    );
    const withHugeSlab = computeTopFloorWallTopZ(
      3, globals, 0, [{ height: 30 }, {}, {}, {}],
      { floor_height: 98, wall_height: 90, slab_thickness: 999 },
    );
    const withHugeWall = computeTopFloorWallTopZ(
      3, globals, 0, [{ height: 30 }, {}, {}, {}],
      { floor_height: 98, wall_height: 999, slab_thickness: 8 },
    );
    expect(withThickSlab).toBe(226);
    expect(withHugeSlab).toBe(226);
    expect(withHugeWall).toBe(226);
  });

  it("per-floor `height` override wins over house.defaults.floor_height", () => {
    const globals = { ...DEFAULT_GLOBAL_CONFIG };
    // floors = [plinth(30), ground(98), first(108), roof]; roof at index 3.
    // Expected: 0 + 30 + 98 + 108 = 236.
    const wallTopZ = computeTopFloorWallTopZ(
      3, globals, 0,
      [{ height: 30 }, {}, { height: 108 }, {}],
      { floor_height: 98 },
    );
    expect(wallTopZ).toBe(236);
  });
});
