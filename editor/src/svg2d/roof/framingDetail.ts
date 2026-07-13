// framing_detail_panel — svg_2d.py lines 4632-4766.
// Six metal-pipe cross-sections in a row.

import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { f, fFloat, f1 } from "./format";

interface DrawMemberOpts {
  cx_px: number;
  size_in: [number, number];
  fill: string;
  stroke: string;
  label: string;
  spec: string;
  wall_mm?: number | null;
  is_angle?: boolean;
  angle_thk_mm?: number | null;
  cross_baseline: number;
  detail_scale: number;
  // Track whether size dims came from JSON as floats (Python `6.0`)
  // vs ints (Python `6`). The pani_patti height_in is float; all
  // other members' size_in come from JSON int arrays.
  w_is_float?: boolean;
  d_is_float?: boolean;
}

function drawMember(o: DrawMemberOpts): string {
  const [w_in, d_in] = o.size_in;
  const w_px = w_in * o.detail_scale;
  const d_px = d_in * o.detail_scale;
  const rx = o.cx_px - w_px / 2;
  const ry = o.cross_baseline - d_px;
  let out = "";
  if (o.is_angle) {
    const t_mm = o.angle_thk_mm ?? 3.0;
    const t_px = (t_mm / 25.4) * o.detail_scale;
    const pts: [number, number][] = [
      [rx, o.cross_baseline],
      [rx + w_px, o.cross_baseline],
      [rx + w_px, ry],
      [rx + w_px - t_px, ry],
      [rx + w_px - t_px, o.cross_baseline - t_px],
      [rx, o.cross_baseline - t_px],
    ];
    const pts_str = pts.map(([px, py]) => `${f1(px)},${f1(py)}`).join(" ");
    out += `<polygon points="${pts_str}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="2" stroke-linejoin="miter"/>\n`;
  } else {
    out += `<rect x="${fFloat(rx)}" y="${fFloat(ry)}" width="${fFloat(w_px)}" height="${fFloat(d_px)}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="2"/>\n`;
  }
  if (o.wall_mm && o.wall_mm > 0 && !o.is_angle) {
    const t_in = o.wall_mm / 25.4;
    const t_px = t_in * o.detail_scale;
    if (w_px > 4 * t_px && d_px > 4 * t_px) {
      out += `<rect x="${fFloat(rx + t_px)}" y="${fFloat(ry + t_px)}" width="${fFloat(w_px - 2 * t_px)}" height="${fFloat(d_px - 2 * t_px)}" fill="white" stroke="${o.stroke}" stroke-width="0.8"/>\n`;
    }
  }
  out += `<text x="${fFloat(o.cx_px)}" y="${f(o.cross_baseline + 60)}" text-anchor="middle" font-size="14" font-weight="600" fill="#222">${o.label}</text>\n`;
  out += `<text x="${fFloat(o.cx_px)}" y="${f(o.cross_baseline + 78)}" text-anchor="middle" font-size="12" fill="#333">${o.spec}</text>\n`;

  const wdy = o.cross_baseline + 15;
  out += `<line x1="${fFloat(rx)}" y1="${f(o.cross_baseline)}" x2="${fFloat(rx)}" y2="${f(wdy + 6)}" stroke="#0066cc" stroke-width="0.5"/>\n`;
  out += `<line x1="${fFloat(rx + w_px)}" y1="${f(o.cross_baseline)}" x2="${fFloat(rx + w_px)}" y2="${f(wdy + 6)}" stroke="#0066cc" stroke-width="0.5"/>\n`;
  out += `<line x1="${fFloat(rx)}" y1="${f(wdy)}" x2="${fFloat(rx + w_px)}" y2="${f(wdy)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  const w_in_str = o.w_is_float ? fFloat(w_in) : `${w_in}`;
  const d_in_str = o.d_is_float ? fFloat(d_in) : `${d_in}`;
  out += `<text x="${fFloat(o.cx_px)}" y="${f(wdy - 4)}" text-anchor="middle" font-size="10" fill="#0066cc">${w_in_str}"</text>\n`;

  const ddx = rx - 15;
  out += `<line x1="${fFloat(rx)}" y1="${fFloat(ry)}" x2="${fFloat(ddx - 6)}" y2="${fFloat(ry)}" stroke="#0066cc" stroke-width="0.5"/>\n`;
  out += `<line x1="${fFloat(rx)}" y1="${f(o.cross_baseline)}" x2="${fFloat(ddx - 6)}" y2="${f(o.cross_baseline)}" stroke="#0066cc" stroke-width="0.5"/>\n`;
  out += `<line x1="${fFloat(ddx)}" y1="${fFloat(ry)}" x2="${fFloat(ddx)}" y2="${f(o.cross_baseline)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  out += `<text x="${fFloat(ddx - 6)}" y="${fFloat(ry + d_px / 2)}" text-anchor="end" font-size="10" fill="#0066cc">${d_in_str}"</text>\n`;
  return out;
}

export function framingDetailPanel(
  x0: number,
  y0: number,
  computed: RoofComputed,
  layout: Layout,
): string {
  const { framing, rafter_size_in, rafter_wall_mm, rafter_spacing_in,
    purlin_size_in, purlin_wall_mm, purlin_spacing_in,
    ridge_size_in, ridge_wall_mm } = computed;
  const { canvas_w, outer_pad, framing_panel_h } = layout;
  const detail_scale = 8.0;
  const title_h = 40;
  const panel_full_w = canvas_w - 2 * outer_pad;
  const area_y = y0 + title_h + 30;
  const cross_baseline = area_y + 130;

  let s = "";
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(panel_full_w)}" height="${f(framing_panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(panel_full_w)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + panel_full_w / 2)}" y="${f(y0 + title_h - 12)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">FRAMING DETAIL — Metal Pipe Cross Sections</text>\n`;

  const barge_size_in = (framing.barge_pipe_size_in as [number, number]) ?? [3, 1];
  const barge_wall_mm = (framing.barge_pipe_wall_mm as number) ?? 1.6;
  const L_ch_size_in = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const L_ch_wall_mm = (framing.eave_L_channel_wall_mm as number) ?? 3;
  const centres = [0.12, 0.28, 0.44, 0.60, 0.76, 0.92].map((frac) => x0 + panel_full_w * frac);
  const pp_cfg = (framing.pani_patti as Record<string, unknown>) ?? {};
  const pp_h_in = Number(pp_cfg.height_in ?? 6);
  const pp_thk_mm = Number(pp_cfg.thickness_mm ?? 1.2);

  s += drawMember({
    cx_px: centres[0],
    size_in: rafter_size_in,
    fill: "#c8a377",
    stroke: "#8B4513",
    label: "RAFTER",
    spec: `${rafter_size_in[0]}"×${rafter_size_in[1]}"×${rafter_wall_mm}mm @ ${rafter_spacing_in}" OC`,
    wall_mm: rafter_wall_mm,
    cross_baseline,
    detail_scale,
  });
  s += drawMember({
    cx_px: centres[1],
    size_in: purlin_size_in,
    fill: "#a8c9e0",
    stroke: "#4a8fbf",
    label: "PURLIN",
    spec: `${purlin_size_in[0]}"×${purlin_size_in[1]}"×${purlin_wall_mm}mm @ ${purlin_spacing_in}" OC (flat)`,
    wall_mm: purlin_wall_mm,
    cross_baseline,
    detail_scale,
  });
  s += drawMember({
    cx_px: centres[2],
    size_in: ridge_size_in,
    fill: "#a6764a",
    stroke: "#5a3a17",
    label: "RIDGE",
    spec: `${ridge_size_in[0]}"×${ridge_size_in[1]}"×${ridge_wall_mm}mm (central + 4 hip)`,
    wall_mm: ridge_wall_mm,
    cross_baseline,
    detail_scale,
  });
  s += drawMember({
    cx_px: centres[3],
    size_in: [0.05, pp_h_in],
    fill: "#a8c9e0",
    stroke: "#4a8fbf",
    label: "PANI PATTI",
    spec: `${pp_h_in.toFixed(0)}" × ${pp_thk_mm} mm GI strip (bottom flush with rafter bottom)`,
    wall_mm: null,
    cross_baseline,
    detail_scale,
    w_is_float: true, // 0.05 is float
    d_is_float: true, // pp_h_in from JSON 6.0
  });
  s += drawMember({
    cx_px: centres[4],
    size_in: L_ch_size_in,
    fill: "#7a7a80",
    stroke: "#404040",
    label: "EAVE L-CHANNEL",
    spec: `${L_ch_size_in[0]}"×${L_ch_size_in[1]}"×${L_ch_wall_mm}mm on top of Pani Patti`,
    wall_mm: null,
    is_angle: true,
    angle_thk_mm: L_ch_wall_mm,
    cross_baseline,
    detail_scale,
  });
  s += drawMember({
    cx_px: centres[5],
    size_in: barge_size_in,
    fill: "#a6764a",
    stroke: "#5a3a17",
    label: "BARGE PIPE",
    spec: `${barge_size_in[0]}"×${barge_size_in[1]}"×${barge_wall_mm}mm welded to purlin ends`,
    wall_mm: barge_wall_mm,
    cross_baseline,
    detail_scale,
  });

  return s;
}
