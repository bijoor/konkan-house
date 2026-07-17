import { describe, expect, it } from "vitest";
import { deriveFlatRoof } from "./deriveFlat";
import { derivePitchedRoof } from "./derivePitched";
import type { RoofConfig } from "./model";
import { resolveJoints, ridgeZFromConfig } from "./resolveJoints";
import { computeSpecBounds, renderTopViewPanel } from "./topViewPanel";

const solidPitched = (): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300 }],
  default_endpoint: "closed",
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
});

const flatCfg = (): RoofConfig => ({
  type: "roof",
  roof_type: "flat",
  segments: [{ id: "s0", start: [150, 20], end: [150, 420], width: 300 }],
  min_overhang: 5,
  slab_thickness: 6,
  parapet_height: 30,
});

describe("computeSpecBounds", () => {
  it("returns null for an empty spec", () => {
    expect(computeSpecBounds({ members: [], planes: [], trusses: [] })).toBeNull();
  });

  it("computes bounds from plane vertices", () => {
    const spec = derivePitchedRoof(solidPitched(), { wallTopZ: 100 });
    const b = computeSpecBounds(spec)!;
    // With overhang 25 and hip pyramid, footprint should span x∈[-25,325] roughly.
    expect(b.x_min).toBeLessThanOrEqual(0);
    expect(b.x_max).toBeGreaterThanOrEqual(300);
    expect(b.y_min).toBeLessThanOrEqual(0);
    expect(b.y_max).toBeGreaterThanOrEqual(500);
  });
});

describe("renderTopViewPanel", () => {
  it("produces well-formed SVG with the expected outer wrapper", () => {
    const spec = derivePitchedRoof(solidPitched(), { wallTopZ: 100 });
    const svg = renderTopViewPanel(spec, { width: 400, height: 300 });
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="300"');
    expect(svg).toContain('viewBox="0 0 400 300"');
  });

  it("renders one polygon per plane and one line per member", () => {
    const spec = derivePitchedRoof(solidPitched(), { wallTopZ: 100 });
    const svg = renderTopViewPanel(spec, { width: 400, height: 300, showLegend: false });
    const polyCount = (svg.match(/<polygon/g) ?? []).length;
    const lineCount = (svg.match(/<line/g) ?? []).length;
    // Pure hip: 2 slopes + 2 hip_faces = 4 planes → 4 polygons.
    expect(polyCount).toBe(4);
    // 1 ridge + 4 hip diagonals + 4 ring beams = 9 members.
    // (No trusses configured; no truss ticks.)
    expect(lineCount).toBe(9);
  });

  it("shows the empty-spec fallback when bounds are null", () => {
    const svg = renderTopViewPanel(
      { members: [], planes: [], trusses: [] },
      { width: 200, height: 100 },
    );
    expect(svg).toContain("(empty roof spec)");
    expect((svg.match(/<polygon/g) ?? []).length).toBe(0);
  });

  it("renders a legend by default and skips it when showLegend=false", () => {
    const spec = derivePitchedRoof(solidPitched(), { wallTopZ: 100 });
    const withLegend = renderTopViewPanel(spec, { width: 400, height: 300 });
    const without = renderTopViewPanel(spec, { width: 400, height: 300, showLegend: false });
    expect(withLegend).toContain("Ridge");
    expect(withLegend).toContain("Valley");
    expect(without).not.toContain("Ridge");
  });

  it("renders a title bar when title is provided", () => {
    const spec = derivePitchedRoof(solidPitched(), { wallTopZ: 100 });
    const svg = renderTopViewPanel(spec, {
      width: 400, height: 300, title: "My Roof",
    });
    expect(svg).toContain("My Roof");
  });

  it("handles a flat roof (1 slab plane, optional 4 parapet planes + caps)", () => {
    const spec = deriveFlatRoof(flatCfg(), { wallTopZ: 100 });
    const svg = renderTopViewPanel(spec, { width: 400, height: 300, showLegend: false });
    const polyCount = (svg.match(/<polygon/g) ?? []).length;
    // 1 flat_slab + 4 parapet planes = 5 polygons.
    expect(polyCount).toBe(5);
  });

  it("renders trusses as dashed tick lines", () => {
    const cfg = solidPitched();
    cfg.trusses = [
      { segment_id: "s0", type: "fink", positions_along: [125, 250, 375] },
    ];
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const svg = renderTopViewPanel(spec, { width: 400, height: 300, showLegend: false });
    const truss_dash = svg.match(/stroke-dasharray="2,2"/g) ?? [];
    // One dashed line per truss.
    expect(truss_dash.length).toBe(3);
  });

  it("handles multi-segment L-shape with joints (uses resolveJoints for valleys)", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "a", start: [150, 0], end: [150, 250], width: 300 },
        { id: "b", start: [150, 250], end: [500, 250], width: 200 },
      ],
      default_endpoint: "closed",
      slope: { by: "height", ridge_h: 50 },
      min_overhang: 25,
    };
    const wallTopZ = 100;
    const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
    let spec = derivePitchedRoof(cfg, { wallTopZ });
    spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ });

    const svg = renderTopViewPanel(spec, { width: 400, height: 300, showLegend: false });
    // 4 slope planes + 2 hip_faces (one per leaf) = 6 planes.
    const polyCount = (svg.match(/<polygon/g) ?? []).length;
    expect(polyCount).toBe(6);
    // Valley dashes appear because resolveJoints added a valley member.
    expect(svg).toContain('stroke-dasharray="4,3"');
  });
});
