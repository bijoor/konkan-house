// V2 perspective (isometric) panel — projects the RoofSpec's 3D
// geometry onto a 30° isometric view. Each plane draws as a filled
// polygon; each spine member (ridge/hip/valley) draws as a line on
// top. The panel is self-contained SVG suitable for embedding in the
// master roof canvas.
//
// Isometric projection formula (matches legacy `perspective.ts`):
//   iso_x = (x - y) * cos30
//   iso_y = z - (x + y) * sin30
//
// The result is then scaled to fit the panel and centered.

import type { Point3D, RoofPlane, RoofSpec, StraightMember } from "./model";

const COS30 = Math.cos((30 * Math.PI) / 180);
const SIN30 = Math.sin((30 * Math.PI) / 180);

function iso(p: Point3D): [number, number] {
  return [(p[0] - p[1]) * COS30, p[2] - (p[0] + p[1]) * SIN30];
}

// Colour palette matching the elevation projection.
const PLANE_COLORS: Record<string, { fill: string; stroke: string }> = {
  slope: { fill: "#c66", stroke: "#5a2e0b" },
  hip_face: { fill: "#c66", stroke: "#5a2e0b" },
  gable_wall: { fill: "#e0c9a6", stroke: "#8a6a3f" },
  flat_slab: { fill: "#a8a4a0", stroke: "#5a5854" },
  parapet: { fill: "#a8a4a0", stroke: "#5a5854" },
};

const MEMBER_STROKES: Partial<Record<StraightMember["role"], string>> = {
  ridge: "#3b1a05",
  hip: "#5a2e0b",
  valley: "#1e3a8a",
};

// Sort planes back-to-front by centroid iso_y (SVG painter's algorithm)
// so front-facing planes overlay back-facing ones correctly.
function centroidIsoY(p: RoofPlane): number {
  let sum = 0;
  for (const v of p.vertices) sum += iso(v)[1];
  return sum / p.vertices.length;
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

  // Sort planes back-to-front.
  const sortedPlanes = [...spec.planes]
    .filter((p) => p.role !== "parapet" || p.vertices.length >= 3)
    .sort((a, b) => centroidIsoY(b) - centroidIsoY(a));

  for (const p of sortedPlanes) {
    if (p.vertices.length < 3) continue;
    const pts = p.vertices.map(toSvg)
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const color = PLANE_COLORS[p.role] ?? PLANE_COLORS.slope;
    svg += `<polygon points="${pts}" fill="${color.fill}" fill-opacity="0.85" stroke="${color.stroke}" stroke-width="1"/>\n`;
  }

  // Members on top.
  for (const m of spec.members) {
    const stroke = MEMBER_STROKES[m.role];
    if (!stroke) continue;
    const [x1, y1] = toSvg(m.start);
    const [x2, y2] = toSvg(m.end);
    svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="2"/>\n`;
  }

  svg += `</g>\n`;
  return svg;
}
