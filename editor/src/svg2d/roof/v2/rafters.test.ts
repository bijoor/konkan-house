import { describe, expect, it } from "vitest";
import { DEFAULT_V2_FRAMING } from "./bom";
import { derivePitchedRoof } from "./derivePitched";
import type { RoofConfig } from "./model";
import { populateRoofFraming } from "./rafters";

const pureHip = (): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300 }],
  default_endpoint: "closed",
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
});

const pureGable = (): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300 }],
  default_endpoint: "open",
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
});

describe("populateRoofFraming — pure hip", () => {
  const cfg = pureHip();
  const wallTopZ = 100;
  const spec = derivePitchedRoof(cfg, { wallTopZ });
  const populated = populateRoofFraming(spec, DEFAULT_V2_FRAMING, cfg, wallTopZ);

  const rafters = populated.members.filter((m) => m.role === "rafter");
  const purlins = populated.members.filter((m) => m.role === "purlin");

  it("emits rafters on main slope planes", () => {
    const mainSlope = rafters.filter((r) => r.source_plane_id?.includes("slope"));
    expect(mainSlope.length).toBeGreaterThan(0);
  });

  it("emits rafters on hip-face planes", () => {
    const hipEnd = rafters.filter((r) => r.source_plane_id?.includes("hip_face"));
    expect(hipEnd.length).toBeGreaterThan(0);
  });

  it("emits purlins on main slope planes (parallel to ridge, N-S → constant X)", () => {
    const main = purlins.filter((p) => p.source_plane_id?.includes("slope"));
    expect(main.length).toBeGreaterThan(0);
    for (const p of main) {
      expect(Math.abs(p.start[0] - p.end[0])).toBeLessThan(1e-3);
    }
  });

  it("emits purlins on hip-face planes (parallel to hip-end eave, E-W → constant Y)", () => {
    const hipEnd = purlins.filter((p) => p.source_plane_id?.includes("hip_face"));
    expect(hipEnd.length).toBeGreaterThan(0);
    for (const p of hipEnd) {
      expect(Math.abs(p.start[1] - p.end[1])).toBeLessThan(1e-3);
    }
  });

  it("main-slope rafters in the ridge Y range reach ridge Z", () => {
    const main = rafters.filter((r) => r.source_plane_id?.includes("slope"));
    // For Y ∈ [150, 350] (ridge range), max Z should be ridgeZ = 150.
    const inRidge = main.filter(
      (r) => r.start[1] >= 150 && r.start[1] <= 350
          && r.end[1] >= 150 && r.end[1] <= 350,
    );
    for (const r of inRidge) {
      const maxZ = Math.max(r.start[2], r.end[2]);
      expect(maxZ).toBeCloseTo(150, 1);
    }
  });

  it("hip-zone rafters on main slopes have upper Z strictly below ridge Z", () => {
    const main = rafters.filter((r) => r.source_plane_id?.includes("slope"));
    const jacks = main.filter(
      (r) => r.start[1] < 100 && r.end[1] < 100,
    );
    for (const r of jacks) {
      const maxZ = Math.max(r.start[2], r.end[2]);
      expect(maxZ).toBeLessThan(150);
    }
  });
});

describe("populateRoofFraming — pure gable", () => {
  const cfg = pureGable();
  const wallTopZ = 100;
  const spec = derivePitchedRoof(cfg, { wallTopZ });
  const populated = populateRoofFraming(spec, DEFAULT_V2_FRAMING, cfg, wallTopZ);

  it("emits rafters only on slope planes (gable has no hip_face)", () => {
    const rafters = populated.members.filter((m) => m.role === "rafter");
    expect(rafters.length).toBeGreaterThan(0);
    for (const r of rafters) {
      expect(r.source_plane_id).toContain("slope");
    }
  });

  it("emits purlins only on slope planes", () => {
    const purlins = populated.members.filter((m) => m.role === "purlin");
    expect(purlins.length).toBeGreaterThan(0);
    for (const p of purlins) {
      expect(p.source_plane_id).toContain("slope");
    }
  });

  it("every rafter reaches the ridge (upper Z = ridgeZ)", () => {
    const rafters = populated.members.filter((m) => m.role === "rafter");
    for (const r of rafters) {
      const maxZ = Math.max(r.start[2], r.end[2]);
      expect(maxZ).toBeCloseTo(150, 1);
    }
  });
});

describe("populateRoofFraming — non-pitched roofs are no-ops", () => {
  it("flat roof spec is returned unchanged", () => {
    const spec = { members: [], planes: [], trusses: [] };
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "flat",
      segments: [{ id: "s", start: [0, 50], end: [200, 50], width: 100 }],
    };
    const out = populateRoofFraming(spec, DEFAULT_V2_FRAMING, cfg, 100);
    expect(out).toEqual(spec);
  });
});

describe("populateRoofFraming — non-destructive", () => {
  it("original spec is untouched", () => {
    const cfg = pureHip();
    const wallTopZ = 100;
    const spec = derivePitchedRoof(cfg, { wallTopZ });
    const before = spec.members.length;
    populateRoofFraming(spec, DEFAULT_V2_FRAMING, cfg, wallTopZ);
    expect(spec.members.length).toBe(before);
  });
});
