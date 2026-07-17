import { describe, expect, it } from "vitest";
import type { RoofSegment } from "./model";
import {
  findEndpointEntry,
  interpolatePoint,
  isLeafEndpoint,
  offsetLine,
  resolveEndpoints,
  segmentLeftNormal,
  segmentLength,
  segmentRect,
  segmentUnitVector,
} from "./segments";

const seg = (
  id: string,
  start: [number, number],
  end: [number, number],
  width = 100,
): RoofSegment => ({ id, start, end, width });

describe("segmentLength", () => {
  it("N-S axis-aligned", () => {
    expect(segmentLength(seg("a", [0, 0], [0, 100]))).toBe(100);
  });
  it("E-W axis-aligned", () => {
    expect(segmentLength(seg("a", [0, 0], [100, 0]))).toBe(100);
  });
  it("diagonal 3-4-5", () => {
    expect(segmentLength(seg("a", [0, 0], [3, 4]))).toBe(5);
  });
  it("zero length", () => {
    expect(segmentLength(seg("a", [5, 5], [5, 5]))).toBe(0);
  });
});

describe("segmentUnitVector", () => {
  it("points along the segment", () => {
    const u = segmentUnitVector(seg("a", [0, 0], [0, 100]));
    expect(u[0]).toBeCloseTo(0, 10);
    expect(u[1]).toBeCloseTo(1, 10);
  });
  it("has unit magnitude for diagonals", () => {
    const u = segmentUnitVector(seg("a", [0, 0], [7, 24]));
    expect(Math.hypot(u[0], u[1])).toBeCloseTo(1, 10);
  });
  it("returns [0,0] for zero-length (does not throw)", () => {
    expect(segmentUnitVector(seg("a", [5, 5], [5, 5]))).toEqual([0, 0]);
  });
});

describe("segmentLeftNormal", () => {
  it("+Y segment → -X normal (left = west)", () => {
    // Segment pointing +Y; +90° CCW rotation → -X.
    const n = segmentLeftNormal(seg("a", [0, 0], [0, 10]));
    expect(n[0]).toBeCloseTo(-1, 10);
    expect(n[1]).toBeCloseTo(0, 10);
  });
  it("+X segment → +Y normal (left = south in Inkscape frame)", () => {
    const n = segmentLeftNormal(seg("a", [0, 0], [10, 0]));
    expect(n[0]).toBeCloseTo(0, 10);
    expect(n[1]).toBeCloseTo(1, 10);
  });
});

describe("offsetLine", () => {
  it("positive distance offsets to LEFT of segment", () => {
    // +Y segment, left = -X. Offset +5 → start/end shift -X by 5.
    const off = offsetLine(seg("a", [0, 0], [0, 100]), 5);
    expect(off.start).toEqual([-5, 0]);
    expect(off.end).toEqual([-5, 100]);
  });
  it("negative distance offsets to RIGHT of segment", () => {
    const off = offsetLine(seg("a", [0, 0], [0, 100]), -5);
    expect(off.start).toEqual([5, 0]);
    expect(off.end).toEqual([5, 100]);
  });
  it("preserves segment length", () => {
    const original = seg("a", [10, 20], [30, 60]);
    const off = offsetLine(original, 7);
    const dx = off.end[0] - off.start[0];
    const dy = off.end[1] - off.start[1];
    expect(Math.hypot(dx, dy)).toBeCloseTo(segmentLength(original), 10);
  });
});

describe("segmentRect", () => {
  it("returns 4 corners with correct area (axis-aligned)", () => {
    // +Y segment, width 20 → rectangle spans x ∈ [-10, 10], y ∈ [0, 100].
    const [sr, er, el, sl] = segmentRect(seg("a", [0, 0], [0, 100], 20));
    // sr = start-right = (+10, 0); er = end-right = (+10, 100);
    // el = end-left = (-10, 100); sl = start-left = (-10, 0).
    expect(sr).toEqual([10, 0]);
    expect(er).toEqual([10, 100]);
    expect(el).toEqual([-10, 100]);
    expect(sl).toEqual([-10, 0]);
  });
  it("area = length × width for diagonal", () => {
    const s = seg("a", [0, 0], [3, 4], 10);
    const [p0, p1, p2, p3] = segmentRect(s);
    // Compute polygon area via shoelace.
    const pts = [p0, p1, p2, p3];
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % 4];
      area += x1 * y2 - x2 * y1;
    }
    expect(Math.abs(area / 2)).toBeCloseTo(5 * 10, 6);
  });
});

describe("interpolatePoint", () => {
  it("0 → start", () => {
    expect(interpolatePoint(seg("a", [10, 20], [30, 60]), 0)).toEqual([10, 20]);
  });
  it("length → end", () => {
    const s = seg("a", [10, 20], [30, 60]);
    const pt = interpolatePoint(s, segmentLength(s));
    expect(pt[0]).toBeCloseTo(30, 10);
    expect(pt[1]).toBeCloseTo(60, 10);
  });
  it("halfway → midpoint", () => {
    const s = seg("a", [0, 0], [100, 0]);
    expect(interpolatePoint(s, 50)).toEqual([50, 0]);
  });
  it("clamps below zero to start", () => {
    expect(interpolatePoint(seg("a", [10, 20], [30, 60]), -10)).toEqual([10, 20]);
  });
  it("clamps past length to end", () => {
    const s = seg("a", [0, 0], [100, 0]);
    expect(interpolatePoint(s, 999)).toEqual([100, 0]);
  });
});

describe("resolveEndpoints", () => {
  it("single segment → 2 leaf entries", () => {
    const segs = [seg("a", [0, 0], [100, 0])];
    const entries = resolveEndpoints(segs);
    expect(entries.length).toBe(2);
    expect(entries.every((e) => !e.isJoint)).toBe(true);
    expect(entries.every((e) => e.refs.length === 1)).toBe(true);
  });
  it("L-shape → 1 joint + 2 leaves", () => {
    const segs = [
      seg("a", [0, 0], [100, 0]),      // W → corner
      seg("b", [100, 0], [100, 100]),  // corner → S
    ];
    const entries = resolveEndpoints(segs);
    const joints = entries.filter((e) => e.isJoint);
    const leaves = entries.filter((e) => !e.isJoint);
    expect(joints.length).toBe(1);
    expect(leaves.length).toBe(2);
    expect(joints[0].refs.length).toBe(2);
  });
  it("courtyard (4-cycle) → 4 joints, 0 leaves", () => {
    const segs = [
      seg("a", [0, 0], [100, 0]),
      seg("b", [100, 0], [100, 100]),
      seg("c", [100, 100], [0, 100]),
      seg("d", [0, 100], [0, 0]),
    ];
    const entries = resolveEndpoints(segs);
    expect(entries.length).toBe(4);
    expect(entries.every((e) => e.isJoint)).toBe(true);
    expect(entries.every((e) => e.refs.length === 2)).toBe(true);
  });
  it("Y junction (3 segments at one point) → multi-joint with 3 refs", () => {
    const segs = [
      seg("a", [0, 0], [50, 50]),
      seg("b", [100, 0], [50, 50]),
      seg("c", [50, 100], [50, 50]),
    ];
    const entries = resolveEndpoints(segs);
    const joint = entries.find((e) => e.refs.length === 3);
    expect(joint).toBeDefined();
    expect(entries.filter((e) => !e.isJoint).length).toBe(3);
  });
  it("epsilon: points 0.4u apart merge (default eps=0.5)", () => {
    const segs = [
      seg("a", [0, 0], [100, 0]),
      seg("b", [100.4, 0], [200, 0]),
    ];
    const entries = resolveEndpoints(segs);
    // 3 unique points: [0,0], [~100,0] merged, [200,0].
    expect(entries.length).toBe(3);
    const joint = entries.find((e) => e.refs.length === 2);
    expect(joint).toBeDefined();
  });
  it("epsilon: points 0.6u apart stay separate", () => {
    const segs = [
      seg("a", [0, 0], [100, 0]),
      seg("b", [100.6, 0], [200, 0]),
    ];
    const entries = resolveEndpoints(segs);
    expect(entries.length).toBe(4);
    expect(entries.every((e) => !e.isJoint)).toBe(true);
  });
});

describe("findEndpointEntry / isLeafEndpoint", () => {
  const segs = [
    seg("a", [0, 0], [100, 0]),
    seg("b", [100, 0], [100, 100]),
  ];
  const entries = resolveEndpoints(segs);

  it("finds the entry containing a given endpoint", () => {
    const e = findEndpointEntry(entries, "a", "start");
    expect(e).toBeDefined();
    expect(e!.point).toEqual([0, 0]);
  });
  it("isLeafEndpoint true for the free end", () => {
    expect(isLeafEndpoint(entries, "a", "start")).toBe(true);
  });
  it("isLeafEndpoint false at the shared corner", () => {
    expect(isLeafEndpoint(entries, "a", "end")).toBe(false);
    expect(isLeafEndpoint(entries, "b", "start")).toBe(false);
  });
});
