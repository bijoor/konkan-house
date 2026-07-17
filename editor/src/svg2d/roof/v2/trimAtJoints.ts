// Step 6d — trim slope planes and surface members at joints.
//
// Two-stage trim:
//   1. Trim slope + hip_face plane polygons at each joint's valley/hip
//      line (Sutherland-Hodgman half-plane clip). Non-adjacent planes
//      are unchanged.
//   2. Clip each surface member (rafter/purlin/ring_beam/pani_patti/
//      eave_L_channel/corner_double_angle/vent_strut) against its
//      face polygon (post-trim). Members tagged with
//      `source_plane_id` clip against that face's trimmed polygon;
//      members without a face tag fall back to per-joint half-plane
//      trim (segment-boundary members like ring beams).
//
// Non-destructive: returns a new spec.

import type {
  Point3D,
  RoofPlane,
  RoofSpec,
  StraightMember,
} from "./model";

interface TrimLine {
  jointId: string;
  apex: Point3D;      // (joint XY, ridgeZ)
  base: Point3D;      // (inside corner XY, wall_top_z)
  dirXY: [number, number];   // unit vector from apex-XY toward base-XY
  perpXY: [number, number];  // perpendicular unit vector (CCW from dirXY)
}

const TRIMMABLE_MEMBER_ROLES: Set<StraightMember["role"]> = new Set([
  "rafter", "purlin", "ring_beam",
  "pani_patti", "eave_L_channel", "corner_double_angle",
  "vent_strut",
]);

const TRIMMABLE_PLANE_ROLES: Set<RoofPlane["role"]> = new Set([
  "slope", "hip_face",
]);

export function trimAtJoints(spec: RoofSpec): RoofSpec {
  // ------------------------------------------------------------------
  // Build joint trim lines.
  // ------------------------------------------------------------------
  const trimLines = new Map<string, TrimLine>();
  for (const m of spec.members) {
    if (m.role !== "valley" && m.role !== "hip") continue;
    if (!m.id.startsWith("joint.")) continue;
    const dx = m.end[0] - m.start[0];
    const dy = m.end[1] - m.start[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const dirXY: [number, number] = [dx / len, dy / len];
    const perpXY: [number, number] = [-dirXY[1], dirXY[0]];
    trimLines.set(m.id, {
      jointId: m.id, apex: m.start, base: m.end, dirXY, perpXY,
    });
  }
  if (trimLines.size === 0) return spec;

  // ------------------------------------------------------------------
  // Ring-beam vertex reroute: for each valley joint, the outside_hip
  // member runs diagonally from the joint apex (ridge Z) DOWN to the
  // outside corner (eave Z). The ring beam sits at wall-top Z, which
  // is between these two Z values. We compute the XY where the
  // outside hip CROSSES wall-top Z, and move ring beams' joint-apex
  // endpoints to that XY. The ring vertex thus coincides with the
  // angular outside hip at the ring's own height.
  // ------------------------------------------------------------------
  // First, find the ring beam Z (all ring beams share it).
  let ringBeamZ: number | null = null;
  for (const m of spec.members) {
    if (m.role === "ring_beam") { ringBeamZ = m.start[2]; break; }
  }

  const apexToOutside = new Map<string, { xy: [number, number] }>();
  if (ringBeamZ != null) {
    for (const m of spec.members) {
      if (m.role !== "hip") continue;
      if (!m.id.includes("outside_hip")) continue;
      const key = `${m.start[0].toFixed(2)},${m.start[1].toFixed(2)}`;
      // Interpolate along outside_hip: find t where Z = ringBeamZ.
      //   start.z + t * (end.z - start.z) = ringBeamZ
      const dz = m.end[2] - m.start[2];
      if (Math.abs(dz) < 1e-6) continue;
      const t = (ringBeamZ - m.start[2]) / dz;
      // Clamp to [0, 1] so degenerate cases don't shoot the vertex
      // past either endpoint.
      const tc = Math.max(0, Math.min(1, t));
      const x = m.start[0] + tc * (m.end[0] - m.start[0]);
      const y = m.start[1] + tc * (m.end[1] - m.start[1]);
      apexToOutside.set(key, { xy: [x, y] });
    }
  }

  // ------------------------------------------------------------------
  // Trim planes (half-plane clip per joint edge).
  //
  // IMPORTANT: for planes affected by 2+ joints (e.g. the inside face
  // of a segment on a closed loop, cut by valleys from both endpoint
  // joints), keep-side must be determined from the ORIGINAL polygon
  // vertices, not from the post-previous-trim shape. Otherwise the
  // majority can flip after the first trim removes vertices, and the
  // wrong half gets kept on the second pass.
  // ------------------------------------------------------------------
  const newPlanes = spec.planes.map((p) => {
    if (!p.joint_edges || p.joint_edges.length === 0) return p;
    if (!TRIMMABLE_PLANE_ROLES.has(p.role)) return p;
    // Precompute keep-side per joint edge from ORIGINAL polygon.
    const keepPosByJoint = new Map<string, boolean>();
    for (const jointId of p.joint_edges) {
      const line = trimLines.get(jointId);
      if (!line) continue;
      let pos = 0, neg = 0;
      for (const v of p.vertices) {
        const d = signedDistXY(v[0], v[1], line);
        if (d > 1e-3) pos++;
        else if (d < -1e-3) neg++;
      }
      keepPosByJoint.set(jointId, pos > neg);
    }
    let trimmed = p;
    for (const jointId of p.joint_edges) {
      const line = trimLines.get(jointId);
      if (!line) continue;
      const keepPos = keepPosByJoint.get(jointId);
      if (keepPos == null) continue;
      trimmed = trimPlaneByLine(trimmed, line, keepPos);
    }
    return trimmed;
  });

  // Build plane-id → (possibly trimmed) plane lookup.
  const planeById = new Map<string, RoofPlane>();
  for (const p of newPlanes) planeById.set(p.id, p);

  // ------------------------------------------------------------------
  // Per-joint segment lookup (for the fallback half-plane trim of
  // members that lack source_plane_id).
  // ------------------------------------------------------------------
  const jointToSegs = new Map<string, Set<string>>();
  for (const line of trimLines.values()) {
    const combined = spec.members.find((mm) => mm.id === line.jointId);
    if (!combined || !combined.source_segment_id) continue;
    const parts = combined.source_segment_id.split("+");
    jointToSegs.set(line.jointId, new Set(parts));
  }

  // Per (jointId, segmentId) → which side of the valley the segment
  // keeps. Used for fallback half-plane trim.
  const segKeepPositive = new Map<string, Map<string, boolean>>();
  for (const [jointId, segs] of jointToSegs) {
    const line = trimLines.get(jointId)!;
    const perSeg = new Map<string, boolean>();
    for (const segId of segs) {
      let pos = 0, neg = 0;
      for (const p of spec.planes) {
        if (p.source_segment_id !== segId) continue;
        if (!TRIMMABLE_PLANE_ROLES.has(p.role)) continue;
        for (const v of p.vertices) {
          const d = signedDistXY(v[0], v[1], line);
          if (d > 1e-3) pos++;
          else if (d < -1e-3) neg++;
        }
      }
      perSeg.set(segId, pos > neg);
    }
    segKeepPositive.set(jointId, perSeg);
  }

  // ------------------------------------------------------------------
  // Clip surface members.
  //   - If source_plane_id is set: clip against that face polygon.
  //   - Else: fall back to per-joint half-plane trim (eave members).
  // ------------------------------------------------------------------
  const newMembers: StraightMember[] = [];
  for (const m of spec.members) {
    if (!TRIMMABLE_MEMBER_ROLES.has(m.role)) {
      newMembers.push(m);
      continue;
    }
    if (m.source_plane_id) {
      const face = planeById.get(m.source_plane_id);
      if (!face) {
        // Unknown face — pass through (shouldn't happen).
        newMembers.push(m);
        continue;
      }
      const clipped = clipSegmentToPolygon(m.start, m.end, face.vertices);
      if (clipped) {
        newMembers.push({ ...m, start: clipped[0], end: clipped[1] });
      }
      continue;
    }
    // Fallback path — members that follow eave/segment boundary.
    let survivor: StraightMember | null = m;
    for (const [jointId, segs] of jointToSegs) {
      if (!survivor) break;
      const segId = survivor.source_segment_id ?? "";
      if (!segs.has(segId)) continue;
      const line = trimLines.get(jointId);
      if (!line) continue;
      const keepPos = segKeepPositive.get(jointId)?.get(segId) ?? false;
      survivor = trimMemberByLine(survivor, line, keepPos);
    }
    if (!survivor) continue;
    // For RING BEAMS specifically: after trimming, if an endpoint lies
    // on a joint apex XY, re-route it to that joint's outside corner
    // XY (keeping the ring beam's own Z). This makes the ring follow
    // the L's outside perimeter (two diagonals meeting at outside
    // corner) instead of terminating at the concave wall corner.
    if (survivor.role === "ring_beam" && apexToOutside.size > 0) {
      const startKey = `${survivor.start[0].toFixed(2)},${survivor.start[1].toFixed(2)}`;
      const endKey = `${survivor.end[0].toFixed(2)},${survivor.end[1].toFixed(2)}`;
      const sOut = apexToOutside.get(startKey);
      const eOut = apexToOutside.get(endKey);
      if (sOut) {
        survivor = {
          ...survivor,
          start: [sOut.xy[0], sOut.xy[1], survivor.start[2]],
        };
      }
      if (eOut) {
        survivor = {
          ...survivor,
          end: [eOut.xy[0], eOut.xy[1], survivor.end[2]],
        };
      }
    }
    newMembers.push(survivor);
  }

  return { ...spec, members: newMembers, planes: newPlanes };
}

// ------------------------------------------------------------------
// Plane trimming — Sutherland-Hodgman half-plane clip.
// ------------------------------------------------------------------

function signedDistXY(x: number, y: number, line: TrimLine): number {
  return (x - line.apex[0]) * line.perpXY[0] + (y - line.apex[1]) * line.perpXY[1];
}

function trimPlaneByLine(
  plane: RoofPlane,
  line: TrimLine,
  keepPositiveOverride?: boolean,
): RoofPlane {
  const verts = plane.vertices;
  if (verts.length < 3) return plane;
  let posCount = 0, negCount = 0;
  for (const v of verts) {
    const d = signedDistXY(v[0], v[1], line);
    if (d > 1e-3) posCount++;
    else if (d < -1e-3) negCount++;
  }
  if (posCount === 0 || negCount === 0) return plane;
  const keepPositive = keepPositiveOverride ?? (posCount > negCount);

  const kept: Point3D[] = [];
  const inside = (v: Point3D): boolean => {
    const d = signedDistXY(v[0], v[1], line);
    return keepPositive ? d >= -1e-3 : d <= 1e-3;
  };
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const aIn = inside(a);
    const bIn = inside(b);
    if (aIn) kept.push(a);
    if (aIn !== bIn) {
      const dA = signedDistXY(a[0], a[1], line);
      const dB = signedDistXY(b[0], b[1], line);
      const t = dA / (dA - dB);
      const xi = a[0] + t * (b[0] - a[0]);
      const yi = a[1] + t * (b[1] - a[1]);
      const zi = a[2] + t * (b[2] - a[2]);
      kept.push([xi, yi, zi]);
    }
  }
  if (kept.length < 3) return plane;
  return { ...plane, vertices: kept };
}

// ------------------------------------------------------------------
// Fallback half-plane member trim (used for members without a face tag).
// ------------------------------------------------------------------

function trimMemberByLine(
  m: StraightMember,
  line: TrimLine,
  keepPositive: boolean,
): StraightMember | null {
  const dA = signedDistXY(m.start[0], m.start[1], line);
  const dB = signedDistXY(m.end[0], m.end[1], line);
  const startIn = keepPositive ? dA >= -1e-3 : dA <= 1e-3;
  const endIn = keepPositive ? dB >= -1e-3 : dB <= 1e-3;
  if (startIn && endIn) return m;
  if (!startIn && !endIn) return null;
  const denom = dA - dB;
  if (Math.abs(denom) < 1e-9) return null;
  const t = dA / denom;
  const xi = m.start[0] + t * (m.end[0] - m.start[0]);
  const yi = m.start[1] + t * (m.end[1] - m.start[1]);
  const zi = m.start[2] + t * (m.end[2] - m.start[2]);
  const isect: Point3D = [xi, yi, zi];
  const ax = startIn ? m.start[0] : xi;
  const ay = startIn ? m.start[1] : yi;
  const az = startIn ? m.start[2] : zi;
  const bx = startIn ? xi : m.end[0];
  const by = startIn ? yi : m.end[1];
  const bz = startIn ? zi : m.end[2];
  const lenSq = (bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2;
  if (lenSq < 1e-4) return null;
  return startIn ? { ...m, end: isect } : { ...m, start: isect };
}

// ------------------------------------------------------------------
// Clip a 3D line segment against a convex 3D polygon.
// The polygon must be planar and convex; the segment is assumed
// to lie on (or very close to) the polygon's plane.
//
// Uses Sutherland-Hodgman: for each polygon edge, clip the segment
// against the half-plane "inside the polygon" as defined by the
// in-plane inward normal (n × edge_dir, with n = polygon's plane
// normal from Newell's method).
// ------------------------------------------------------------------

function clipSegmentToPolygon(
  start: Point3D,
  end: Point3D,
  poly: Point3D[],
): [Point3D, Point3D] | null {
  if (poly.length < 3) return [start, end];
  const n = polygonNormalNewell(poly);
  if (!n) return [start, end];
  let s: Point3D = [start[0], start[1], start[2]];
  let e: Point3D = [end[0], end[1], end[2]];
  const tol = 1e-3;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edge: Point3D = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    // In-plane inward normal (perpendicular to edge, lying in
    // polygon plane). For CCW winding viewed from +n, this
    // points into the interior.
    const inward: Point3D = [
      n[1] * edge[2] - n[2] * edge[1],
      n[2] * edge[0] - n[0] * edge[2],
      n[0] * edge[1] - n[1] * edge[0],
    ];
    const dS = (s[0] - a[0]) * inward[0]
             + (s[1] - a[1]) * inward[1]
             + (s[2] - a[2]) * inward[2];
    const dE = (e[0] - a[0]) * inward[0]
             + (e[1] - a[1]) * inward[1]
             + (e[2] - a[2]) * inward[2];
    const sIn = dS >= -tol;
    const eIn = dE >= -tol;
    if (!sIn && !eIn) return null;
    if (sIn && eIn) continue;
    const denom = dS - dE;
    if (Math.abs(denom) < 1e-9) return null;
    const t = dS / denom;
    const ip: Point3D = [
      s[0] + t * (e[0] - s[0]),
      s[1] + t * (e[1] - s[1]),
      s[2] + t * (e[2] - s[2]),
    ];
    if (sIn) e = ip; else s = ip;
  }
  const lenSq = (e[0] - s[0]) ** 2 + (e[1] - s[1]) ** 2 + (e[2] - s[2]) ** 2;
  if (lenSq < 1e-4) return null;
  return [s, e];
}

function polygonNormalNewell(poly: Point3D[]): Point3D | null {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9) return null;
  return [nx / len, ny / len, nz / len];
}
