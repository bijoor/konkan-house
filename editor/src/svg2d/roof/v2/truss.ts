// Fink truss members. A Fink truss is the most common trussed rafter
// pattern: two top chords sloping up to the apex, one horizontal
// bottom chord, one vertical king post from bottom-chord midpoint to
// apex, and two web pieces on each side (a diagonal + a vertical)
// forming the classic "W" internal bracing.
//
// Given a TrussTriangle {bottom_left, bottom_right, apex} produce
// the 8 members that make up one Fink truss. The chord section
// size (steel pipe) is passed in; defaults align with legacy
// truss_cfg defaults.

import type {
  Point3D,
  StraightMember,
  TrussTriangle,
} from "./model";

export interface TrussSectionConfig {
  chord_size_in: [number, number];
  chord_wall_mm: number;
  web_size_in: [number, number];
  web_wall_mm: number;
  material?: string;
}

export const DEFAULT_TRUSS_SECTION: TrussSectionConfig = {
  chord_size_in: [2, 4],
  chord_wall_mm: 3,
  web_size_in: [2, 2],
  web_wall_mm: 2,
  material: "MS",
};

// Midpoint of two 3D points.
function mid(a: Point3D, b: Point3D): Point3D {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

// A quarter-point along the segment from a to b: t=0.25 is one-quarter
// of the way from a; t=0.75 is one-quarter of the way from b.
function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// Emit the 8 Fink truss members for one triangle. Matches the
// legacy geometry in svg2d/roof/geometry.ts (panel_ratio_bottom
// default 0.25):
//   - 2 top chords    (bottom_left → apex,  bottom_right → apex)
//   - 1 bottom chord  (bottom_left → bottom_right)
//   - 1 king post     (bottom_chord_midpoint → apex; vertical, len=rise)
//   - 2 diagonals     (bottom_chord panel-point → apex on each side;
//                      len = sqrt(dx² + rise²))
//   - 2 verticals     (bottom_chord panel-point → top-chord midpoint
//                      directly above it; vertical, len = rise/2)
//
// The bottom-chord panel points sit at panel_ratio and (1-panel_ratio)
// of the span; the corresponding top-chord attachment point for the
// vertical is the midpoint of that side's top chord (in a symmetric
// truss, that point sits exactly above the panel point).
export function buildFinkTrussMembers(
  triangle: TrussTriangle,
  _cfg: TrussSectionConfig = DEFAULT_TRUSS_SECTION,
): StraightMember[] {
  const { bottom_left: bl, bottom_right: br, apex } = triangle;
  const panelRatio = 0.25;   // matches legacy default panel_ratio_bottom
  const bcMid = mid(bl, br);
  const bcLeftPanel = lerp(bl, br, panelRatio);        // 25% along bottom chord
  const bcRightPanel = lerp(bl, br, 1 - panelRatio);   // 75% along
  // In a symmetric truss the vertical from bcLeftPanel goes straight
  // up to the midpoint of the left top chord (bl→apex).
  const tcLeftMid = mid(bl, apex);
  const tcRightMid = mid(br, apex);

  const id = (suffix: string) => `${triangle.id}.${suffix}`;

  return [
    // Top chords
    { id: id("top_chord.left"),  start: bl, end: apex, role: "truss_top_chord",
      source_segment_id: triangle.source_segment_id },
    { id: id("top_chord.right"), start: br, end: apex, role: "truss_top_chord",
      source_segment_id: triangle.source_segment_id },
    // Bottom chord
    { id: id("bottom_chord"), start: bl, end: br, role: "truss_bottom_chord",
      source_segment_id: triangle.source_segment_id },
    // King post (vertical, midpoint of bottom chord → apex)
    { id: id("king_post"), start: bcMid, end: apex, role: "truss_web",
      source_segment_id: triangle.source_segment_id },
    // Left diagonal (panel point → apex)
    { id: id("web.left.diag"), start: bcLeftPanel, end: apex,
      role: "truss_web", source_segment_id: triangle.source_segment_id },
    // Left vertical (panel point → top-chord midpoint directly above)
    { id: id("web.left.vert"), start: bcLeftPanel, end: tcLeftMid,
      role: "truss_web", source_segment_id: triangle.source_segment_id },
    // Right diagonal (panel point → apex)
    { id: id("web.right.diag"), start: bcRightPanel, end: apex,
      role: "truss_web", source_segment_id: triangle.source_segment_id },
    // Right vertical (panel point → top-chord midpoint directly above)
    { id: id("web.right.vert"), start: bcRightPanel, end: tcRightMid,
      role: "truss_web", source_segment_id: triangle.source_segment_id },
  ];
}

// Mono-pitch (shed) truss members. Given a TrussTriangle where:
//   bottom_left  = LOW wall corner (at wall_top)
//   bottom_right = HIGH wall corner (at wall_top)
//   apex         = directly above bottom_right at wall_top + rise
// build the members. Right-triangle shape:
//   - Top chord (sloping): bottom_left → apex
//   - Bottom chord (horizontal): bottom_left → bottom_right
//   - Vertical post: bottom_right → apex
//   - Diagonal web: 1/3 point on bottom chord → apex (bracing)
//   - Vertical web: 2/3 point on bottom chord → point on top chord
//     directly above it
export function buildMonoPitchTrussMembers(
  triangle: TrussTriangle,
  _cfg: TrussSectionConfig = DEFAULT_TRUSS_SECTION,
): StraightMember[] {
  const { bottom_left: bl, bottom_right: br, apex } = triangle;
  // Point on top chord directly above a bottom-chord fraction f (from bl).
  // Top chord: bl → apex. Above bcAt(f) means shift Z up so it hits
  // the top chord. Since top chord runs bl→apex linearly, top-chord
  // point at parameter t has same XY as (1-t)·bl + t·apex. Its XY
  // matches bl + t·(apex − bl). So for a bottom-chord XY at bl + f·(br−bl),
  // we want t such that bl_x + t·(apex_x − bl_x) = bl_x + f·(br_x − bl_x).
  // Since bl_x=br_x cross-axis component equals 0 in general, use the
  // XY along-vector: apex_xy − bl_xy = br_xy − bl_xy (both go across
  // the width), so t = f.
  const bcThird = lerp(bl, br, 1 / 3);
  const bcTwoThird = lerp(bl, br, 2 / 3);
  const tcTwoThird = lerp(bl, apex, 2 / 3);

  const id = (suffix: string) => `${triangle.id}.${suffix}`;
  const seg = triangle.source_segment_id;
  return [
    { id: id("top_chord"), start: bl, end: apex, role: "truss_top_chord",
      source_segment_id: seg },
    { id: id("bottom_chord"), start: bl, end: br, role: "truss_bottom_chord",
      source_segment_id: seg },
    { id: id("post.high"), start: br, end: apex, role: "truss_web",
      source_segment_id: seg },
    { id: id("web.diag"), start: bcThird, end: apex, role: "truss_web",
      source_segment_id: seg },
    { id: id("web.vert"), start: bcTwoThird, end: tcTwoThird, role: "truss_web",
      source_segment_id: seg },
  ];
}

// Dispatch based on truss.kind (default fink for backward compat).
export function buildTrussMembers(
  triangle: TrussTriangle,
  cfg: TrussSectionConfig = DEFAULT_TRUSS_SECTION,
): StraightMember[] {
  return triangle.kind === "mono_pitch"
    ? buildMonoPitchTrussMembers(triangle, cfg)
    : buildFinkTrussMembers(triangle, cfg);
}

// Convenience — populate .members on every TrussTriangle in a spec.
// Mutates via a shallow-clone so callers can compose without side
// effects on the input spec.
export function populateTrussMembers(
  trusses: readonly TrussTriangle[],
  cfg: TrussSectionConfig = DEFAULT_TRUSS_SECTION,
): TrussTriangle[] {
  return trusses.map((t) => ({
    ...t,
    members: buildTrussMembers(t, cfg),
  }));
}
