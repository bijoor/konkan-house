// V2 perspective (isometric) panel — projects the RoofSpec's 3D
// geometry onto a 30° isometric view as a STRUCTURAL FRAME: trusses,
// ring beam, tie beams, ridge/hip/valley + eave perimeter. The tile
// SHELL and the rafter/purlin surface layer are intentionally NOT
// drawn — this is the frame view. Self-contained SVG.
//
// Isometric projection formula (matches legacy `perspective.ts`):
//   iso_x = (x - y) * cos30
//   iso_y = z - (x + y) * sin30
//
// The result is then scaled to fit the panel and centered.

import type { Point3D, RoofSpec, StraightMember } from "./model";
import { buildTrussMembers } from "./truss";

const COS30 = Math.cos((30 * Math.PI) / 180);
const SIN30 = Math.sin((30 * Math.PI) / 180);

function iso(p: Point3D): [number, number] {
  return [(p[0] - p[1]) * COS30, p[2] - (p[0] + p[1]) * SIN30];
}

// Surface layer — a DIFFERENT layer, not part of this frame view.
const SURFACE_ROLES = new Set<StraightMember["role"]>(["rafter", "purlin"]);

// Stroke colour + width per frame member role.
const FRAME_STROKES: Partial<Record<StraightMember["role"], string>> = {
  ridge: "#3b1a05",
  hip: "#5a2e0b",
  valley: "#1e3a8a",
  ring_beam: "#166534",
  hip_beam: "#b45309",
  vent_strut: "#a16207",
  tie_beam: "#0369a1",
  truss_top_chord: "#7c3aed",
  truss_bottom_chord: "#6d28d9",
  truss_web: "#8b5cf6",
  pani_patti: "#9ca3af",
  eave_L_channel: "#6b7280",
  corner_double_angle: "#6b7280",
};
function frameWidth(role: StraightMember["role"]): number {
  if (role === "ridge") return 2.4;
  if (role === "ring_beam" || role === "hip" || role === "valley" || role === "tie_beam") return 2;
  if (role.startsWith("truss")) return 1.2;
  if (role === "pani_patti" || role === "eave_L_channel" || role === "corner_double_angle") return 1;
  return 1.6;
}

export function v2PerspectivePanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  spec: RoofSpec,
  opts: { title?: string; wallTopZ?: number; groundZ?: number } = {},
): string {
  const titleH = opts.title ? 40 : 0;
  const innerPad = 20;
  const drawW = width - 2 * innerPad;
  const drawH = height - titleH - 2 * innerPad;

  // Compute iso bounds of all planes + members.
  let minIx = Infinity, maxIx = -Infinity;
  let minIy = Infinity, maxIy = -Infinity;
  const consider = (p: Point3D) => {
    const [ix, iy] = iso(p);
    if (ix < minIx) minIx = ix;
    if (ix > maxIx) maxIx = ix;
    if (iy < minIy) minIy = iy;
    if (iy > maxIy) maxIy = iy;
  };
  for (const p of spec.planes) for (const v of p.vertices) consider(v);
  for (const m of spec.members) { consider(m.start); consider(m.end); }
  if (!isFinite(minIx)) return "";

  const isoW = maxIx - minIx || 1;
  const isoH = maxIy - minIy || 1;
  const scale = Math.min(drawW / isoW, drawH / isoH);
  const offX = x0 + innerPad + (drawW - isoW * scale) / 2 - minIx * scale;
  const offY = y0 + titleH + innerPad + (drawH - isoH * scale) / 2 - minIy * scale;
  const toSvg = (p: Point3D): [number, number] => {
    const [ix, iy] = iso(p);
    // SVG y grows downward → invert iso_y by using (maxIy - iy) span.
    return [offX + ix * scale, offY + (maxIy - iy + minIy) * scale];
  };

  let svg = `<g id="v2-perspective" transform="translate(0,0)">\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#fdfcfa" stroke="#333" stroke-width="1"/>\n`;
  if (opts.title) {
    svg += `<text x="${x0 + width / 2}" y="${y0 + 24}" text-anchor="middle" font-size="14" font-weight="bold" fill="#222">${opts.title}</text>\n`;
  }

  const line = (m: StraightMember): string => {
    const [x1, y1] = toSvg(m.start);
    const [x2, y2] = toSvg(m.end);
    const stroke = FRAME_STROKES[m.role] ?? "#475569";
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${frameWidth(m.role)}" stroke-linecap="round"/>\n`;
  };

  // Frame members — everything except the rafter/purlin surface layer
  // and the tile shell. Trusses (below) draw on top.
  for (const m of spec.members) {
    if (SURFACE_ROLES.has(m.role)) continue;
    svg += line(m);
  }

  // Trusses — expand each triangle to its chord/web members.
  for (const t of spec.trusses) {
    const members = t.members ?? buildTrussMembers(t);
    for (const m of members) svg += line(m);
  }

  svg += `</g>\n`;
  return svg;
}
