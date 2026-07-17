import { describe, expect, it } from "vitest";
import { buildFinkTrussMembers, populateTrussMembers } from "./truss";
import type { TrussTriangle } from "./model";

const triangle = (): TrussTriangle => ({
  id: "t0",
  bottom_left: [0, 0, 100],
  bottom_right: [200, 0, 100],   // 200u span
  apex: [100, 0, 200],            // 100u rise → 45° pitch
  source_segment_id: "seg",
});

describe("buildFinkTrussMembers", () => {
  const t = triangle();
  const members = buildFinkTrussMembers(t);

  it("emits 8 members total (Fink pattern)", () => {
    expect(members.length).toBe(8);
  });

  it("2 top chords + 1 bottom chord + 5 web members", () => {
    const top = members.filter((m) => m.role === "truss_top_chord");
    const bottom = members.filter((m) => m.role === "truss_bottom_chord");
    const web = members.filter((m) => m.role === "truss_web");
    expect(top.length).toBe(2);
    expect(bottom.length).toBe(1);
    expect(web.length).toBe(5);   // king post + 2 diag + 2 vert
  });

  it("top chords span from bottom corners to apex", () => {
    const tops = members.filter((m) => m.role === "truss_top_chord");
    const starts = tops.map((m) => JSON.stringify(m.start));
    expect(starts).toContain(JSON.stringify(t.bottom_left));
    expect(starts).toContain(JSON.stringify(t.bottom_right));
    for (const m of tops) {
      expect(m.end).toEqual(t.apex);
    }
  });

  it("bottom chord spans between the two bottom corners", () => {
    const bc = members.find((m) => m.role === "truss_bottom_chord")!;
    expect(bc.start).toEqual(t.bottom_left);
    expect(bc.end).toEqual(t.bottom_right);
  });

  it("king post is vertical (X + Y equal, only Z differs)", () => {
    const king = members.find((m) => m.id.endsWith("king_post"))!;
    expect(king.start[0]).toBeCloseTo(king.end[0], 6);
    expect(king.start[1]).toBeCloseTo(king.end[1], 6);
    expect(king.end[2]).toBeGreaterThan(king.start[2]);
  });

  it("diagonals go from bottom-chord panel points to the APEX", () => {
    const diag = members.find((m) => m.id.endsWith("web.left.diag"))!;
    // Panel ratio 0.25 → left panel at (0 + 0.25·200, 0, 100) = (50, 0, 100)
    expect(diag.start).toEqual([50, 0, 100]);
    expect(diag.end).toEqual(t.apex);   // (100, 0, 200)
  });

  it("verticals are actually vertical (panel point → top-chord midpoint directly above)", () => {
    const vert = members.find((m) => m.id.endsWith("web.left.vert"))!;
    // Start = (50, 0, 100). End should be at same X + Y, at Z = 100 + rise/2 = 150.
    expect(vert.start[0]).toBeCloseTo(vert.end[0], 6);
    expect(vert.start[1]).toBeCloseTo(vert.end[1], 6);
    expect(vert.end[2]).toBeCloseTo(150, 6);
  });

  it("right diagonal + vertical mirror the left ones", () => {
    const rd = members.find((m) => m.id.endsWith("web.right.diag"))!;
    const rv = members.find((m) => m.id.endsWith("web.right.vert"))!;
    // Right panel at 0.75 × 200 = 150.
    expect(rd.start).toEqual([150, 0, 100]);
    expect(rd.end).toEqual(t.apex);
    expect(rv.start[0]).toBeCloseTo(rv.end[0], 6);
    expect(rv.end[2]).toBeCloseTo(150, 6);
  });

  it("member IDs are prefixed with the triangle ID", () => {
    for (const m of members) {
      expect(m.id.startsWith("t0.")).toBe(true);
    }
  });

  it("all members carry the source segment ID", () => {
    for (const m of members) {
      expect(m.source_segment_id).toBe("seg");
    }
  });
});

describe("populateTrussMembers", () => {
  it("returns a new array with .members populated on each triangle", () => {
    const src = [triangle(), triangle()];
    src[1] = { ...src[1], id: "t1" };
    const out = populateTrussMembers(src);
    expect(out.length).toBe(2);
    expect(out[0].members?.length).toBe(8);
    expect(out[1].members?.length).toBe(8);
    // Source array unchanged.
    expect(src[0].members).toBeUndefined();
  });
});
