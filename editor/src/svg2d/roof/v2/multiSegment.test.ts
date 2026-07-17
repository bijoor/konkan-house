// Multi-segment pitched roof tests. Verifies:
//   - Each segment emits its own slope/endcap/ridge/ring-beam set.
//   - Joint endpoints (shared between segments) suppress endcaps
//     regardless of per-segment or roof-level style config.
//   - Ring beam is emitted per segment (4 members × N segments);
//     Step 6 will trim shared edges.
//
// These are LOGICAL invariants — no XY-value comparisons against
// legacy, because legacy has no multi-segment representation.
// Instead we assert counts and topology.

import { describe, expect, it } from "vitest";
import { derivePitchedRoof } from "./derivePitched";
import type { RoofConfig } from "./model";
import { resolveEndpoints } from "./segments";

const commonProps = {
  slope: { by: "height", ridge_h: 50 } as const,
  min_overhang: 25,
};

describe("joint endpoints — ridge reaches the joint (no trim)", () => {
  it("L-shape: both ridges terminate at the shared endpoint (same X/Y/Z)", () => {
    // A: (150,0) → (150,250); B: (150,250) → (500,250). Joint at (150,250).
    // A.end should extend to y=250, B.start should extend to x=150. Both
    // ridges at ridgeZ = wall_top + ridge_h = 150.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "a", start: [150, 0], end: [150, 250], width: 300 },
        { id: "b", start: [150, 250], end: [500, 250], width: 200 },
      ],
      default_endpoint: "closed",
      ...commonProps,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridgeA = spec.members.find(
      (m) => m.role === "ridge" && m.source_segment_id === "a",
    )!;
    const ridgeB = spec.members.find(
      (m) => m.role === "ridge" && m.source_segment_id === "b",
    )!;
    // A's ridge end should be at (150, 250, ridgeZ).
    expect(ridgeA.end[0]).toBeCloseTo(150, 6);
    expect(ridgeA.end[1]).toBeCloseTo(250, 6);
    // B's ridge start should be at the same point.
    expect(ridgeB.start[0]).toBeCloseTo(150, 6);
    expect(ridgeB.start[1]).toBeCloseTo(250, 6);
    // Both at ridgeZ (150).
    expect(ridgeA.end[2]).toBeCloseTo(150, 6);
    expect(ridgeB.start[2]).toBeCloseTo(150, 6);
  });

  it("courtyard: every ridge endpoint coincides with a segment endpoint", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "n", start: [0, 0], end: [400, 0], width: 100 },
        { id: "e", start: [400, 0], end: [400, 400], width: 100 },
        { id: "s", start: [400, 400], end: [0, 400], width: 100 },
        { id: "w", start: [0, 400], end: [0, 0], width: 100 },
      ],
      default_endpoint: "closed",
      ...commonProps,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    for (const seg of cfg.segments) {
      const ridge = spec.members.find(
        (m) => m.role === "ridge" && m.source_segment_id === seg.id,
      )!;
      // Ridge should span the FULL segment (no trim at either end).
      expect(ridge.start[0]).toBeCloseTo(seg.start[0], 6);
      expect(ridge.start[1]).toBeCloseTo(seg.start[1], 6);
      expect(ridge.end[0]).toBeCloseTo(seg.end[0], 6);
      expect(ridge.end[1]).toBeCloseTo(seg.end[1], 6);
    }
  });
});

describe("multi-segment pitched: L-shape (2 segments, 1 joint)", () => {
  const cfg: RoofConfig = {
    type: "roof",
    roof_type: "pitched",
    segments: [
      { id: "a", start: [150, 0], end: [150, 250], width: 300 },
      { id: "b", start: [150, 250], end: [500, 250], width: 200 },
    ],
    default_endpoint: "closed",
    ...commonProps,
  };

  it("has 1 joint entry + 2 leaf entries", () => {
    const entries = resolveEndpoints(cfg.segments);
    expect(entries.filter((e) => e.isJoint).length).toBe(1);
    expect(entries.filter((e) => !e.isJoint).length).toBe(2);
  });

  it("emits 4 slope planes (2 per segment)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(4);
  });

  it("emits 2 hip_face endcaps (one per leaf endpoint; joint suppressed)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(0);
  });

  it("emits 2 ridge members (one per segment)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "ridge").length).toBe(2);
  });

  it("emits ring beam per segment (8 members total: 4×2)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "ring_beam").length).toBe(8);
  });

  it("emits 4 hip diagonals (2 per closed leaf endpoint)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "hip").length).toBe(4);
  });

  it("mixed endpoint styles: open leaf + closed leaf → 1 gable_wall + 1 hip_face", () => {
    const mixed: RoofConfig = {
      ...cfg,
      segments: [
        { ...cfg.segments[0], start_endpoint: "open" },      // leaf → open
        { ...cfg.segments[1], end_endpoint: "closed" },      // leaf → closed
      ],
    };
    const spec = derivePitchedRoof(mixed, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(1);
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(1);
  });
});

describe("multi-segment pitched: U-shape (3 segments, 2 joints)", () => {
  // Segment "a" runs S at x=0, "b" runs E at bottom, "c" runs N at x=400.
  const cfg: RoofConfig = {
    type: "roof",
    roof_type: "pitched",
    segments: [
      { id: "a", start: [0, 0], end: [0, 300], width: 200 },
      { id: "b", start: [0, 300], end: [400, 300], width: 200 },
      { id: "c", start: [400, 300], end: [400, 0], width: 200 },
    ],
    default_endpoint: "closed",
    ...commonProps,
  };

  it("has 2 joint entries + 2 leaf entries", () => {
    const entries = resolveEndpoints(cfg.segments);
    expect(entries.filter((e) => e.isJoint).length).toBe(2);
    expect(entries.filter((e) => !e.isJoint).length).toBe(2);
  });

  it("emits 6 slope planes (2 per segment)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(6);
  });

  it("emits 2 hip_face endcaps (only 2 leaf endpoints)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(2);
  });

  it("emits 3 ridges + 12 ring-beam members (4 per segment)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "ridge").length).toBe(3);
    expect(spec.members.filter((m) => m.role === "ring_beam").length).toBe(12);
  });
});

describe("multi-segment pitched: courtyard (4 segments, all joints)", () => {
  const cfg: RoofConfig = {
    type: "roof",
    roof_type: "pitched",
    segments: [
      { id: "n", start: [0, 0], end: [400, 0], width: 100 },
      { id: "e", start: [400, 0], end: [400, 400], width: 100 },
      { id: "s", start: [400, 400], end: [0, 400], width: 100 },
      { id: "w", start: [0, 400], end: [0, 0], width: 100 },
    ],
    default_endpoint: "closed",
    ...commonProps,
  };

  it("all 4 endpoints are joints (0 leaves)", () => {
    const entries = resolveEndpoints(cfg.segments);
    expect(entries.length).toBe(4);
    expect(entries.every((e) => e.isJoint)).toBe(true);
    expect(entries.every((e) => e.refs.length === 2)).toBe(true);
  });

  it("emits 8 slope planes (2 per segment)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(8);
  });

  it("emits 0 endcaps (every endpoint is a joint)", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(0);
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(0);
    expect(spec.members.filter((m) => m.role === "hip").length).toBe(0);
  });

  it("emits 4 ridges + 16 ring-beam members", () => {
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "ridge").length).toBe(4);
    expect(spec.members.filter((m) => m.role === "ring_beam").length).toBe(16);
  });

  it("joint style override: even if user sets endpoint=open, joint stays closed (no endcap)", () => {
    const forced: RoofConfig = {
      ...cfg,
      default_endpoint: "open",
      segments: cfg.segments.map((s) => ({
        ...s,
        start_endpoint: "open" as const,
        end_endpoint: "open" as const,
      })),
    };
    const spec = derivePitchedRoof(forced, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(0);
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(0);
  });
});

describe("multi-segment ring beam: single-segment sanity", () => {
  it("single-segment pitched still emits 4 ring-beam members", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "closed",
      ...commonProps,
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "ring_beam").length).toBe(4);
    // All ring beam members at wall_top_z (100).
    for (const m of spec.members.filter((mm) => mm.role === "ring_beam")) {
      expect(m.start[2]).toBeCloseTo(100, 6);
      expect(m.end[2]).toBeCloseTo(100, 6);
    }
  });
});
