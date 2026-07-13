// truss_elevation_panel — svg_2d.py lines 5626-5899.
import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat, f0, f1 } from "./format";

export function trussElevationPanel(
  x0: number,
  y0: number,
  computed: RoofComputed,
  layout: Layout,
  y0IsFloat = false,
): string {
  const fY0 = (n: number) => (y0IsFloat ? fFloat(n) : f(n));
  const {
    truss_count,
    truss_cfg,
    truss_bottom_chord_len,
    truss_king_post_len,
    truss_top_chord_len,
    truss_diag_len,
    truss_vert_len,
    truss_chord_total_each,
    truss_web_total_each,
    slope_ew,
    house_ft,
    ring_beam_size,
    ring_beam_wall,
    ring_beam_total,
    hip_beam_size,
    hip_beam_wall,
    hip_beam_total_len,
    hip_beam_total_count,
  } = computed;
  const { canvas_w, outer_pad, truss_panel_h } = layout;
  const panel_full_w = canvas_w - 2 * outer_pad;
  const title_h = 40;
  let s = "";
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(truss_panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + panel_full_w / 2)}" y="${fY0(y0 + title_h - 12)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">FINK TRUSS ELEVATION — bottom chord on ring beam (× ${truss_count} identical trusses)</text>\n`;

  if (truss_count === 0) {
    s += `<text x="${fFloat(x0 + panel_full_w / 2)}" y="${fFloat(y0 + truss_panel_h / 2)}" text-anchor="middle" font-size="14" fill="#666">(no trusses configured)</text>\n`;
    return s;
  }

  const chord_stroke = "#8b0000";
  const web_stroke = "#c25050";
  const blue = "#0066cc";

  // Layout for the single detailed Fink truss
  const inner_pad = 30;
  const avail_w = panel_full_w - 2 * inner_pad - 320;
  const avail_h = truss_panel_h - title_h - 80;
  const base_ft = (truss_bottom_chord_len * 1.2) / 12.0;
  const h_ft = (truss_king_post_len * 1.2) / 12.0;
  const scale = Math.min(avail_w / (base_ft + 4), avail_h / (h_ft + 3));
  const origin_x = x0 + inner_pad + (avail_w - base_ft * scale) / 2;
  const origin_y = y0 + title_h + 40 + h_ft * scale;

  s += `<text x="${f1(origin_x + (base_ft * scale) / 2)}" y="${f1(y0 + title_h + 18)}" text-anchor="middle" font-size="13" font-weight="600" fill="#8b0000">FINK TRUSS × ${truss_count} — transverse, spans ${formatDimension(truss_bottom_chord_len)} × rise ${formatDimension(truss_king_post_len)}</text>\n`;

  // Draw Fink truss
  const chord_w = 3.0;
  const web_w = 1.8;
  const chord_wS = fFloat(chord_w);
  const web_wS = fFloat(web_w);
  const ft_scale = scale;
  function P(fx: number, fy: number): [number, number] {
    return [origin_x + fx * ft_scale, origin_y - fy * ft_scale];
  }
  const B0 = P(0, 0);
  const B1 = P(base_ft * 0.25, 0);
  const B2 = P(base_ft * 0.5, 0);
  const B3 = P(base_ft * 0.75, 0);
  const B4 = P(base_ft, 0);
  const T1 = P(base_ft * 0.25, h_ft * 0.5);
  const Tpk = P(base_ft * 0.5, h_ft);
  const T3 = P(base_ft * 0.75, h_ft * 0.5);

  s += `<line x1="${f1(B0[0])}" y1="${f1(B0[1])}" x2="${f1(Tpk[0])}" y2="${f1(Tpk[1])}" stroke="${chord_stroke}" stroke-width="${chord_wS}"/>\n`;
  s += `<line x1="${f1(Tpk[0])}" y1="${f1(Tpk[1])}" x2="${f1(B4[0])}" y2="${f1(B4[1])}" stroke="${chord_stroke}" stroke-width="${chord_wS}"/>\n`;
  s += `<line x1="${f1(B0[0])}" y1="${f1(B0[1])}" x2="${f1(B4[0])}" y2="${f1(B4[1])}" stroke="${chord_stroke}" stroke-width="${chord_wS}"/>\n`;
  s += `<line x1="${f1(Tpk[0])}" y1="${f1(Tpk[1])}" x2="${f1(B2[0])}" y2="${f1(B2[1])}" stroke="${web_stroke}" stroke-width="${web_wS}"/>\n`;
  s += `<line x1="${f1(Tpk[0])}" y1="${f1(Tpk[1])}" x2="${f1(B1[0])}" y2="${f1(B1[1])}" stroke="${web_stroke}" stroke-width="${web_wS}"/>\n`;
  s += `<line x1="${f1(Tpk[0])}" y1="${f1(Tpk[1])}" x2="${f1(B3[0])}" y2="${f1(B3[1])}" stroke="${web_stroke}" stroke-width="${web_wS}"/>\n`;
  s += `<line x1="${f1(T1[0])}" y1="${f1(T1[1])}" x2="${f1(B1[0])}" y2="${f1(B1[1])}" stroke="${web_stroke}" stroke-width="${web_wS}"/>\n`;
  s += `<line x1="${f1(T3[0])}" y1="${f1(T3[1])}" x2="${f1(B3[0])}" y2="${f1(B3[1])}" stroke="${web_stroke}" stroke-width="${web_wS}"/>\n`;
  const dot_r = Math.max(chord_w * 0.9, 2.0);
  for (const p of [B0, B1, B2, B3, B4, T1, Tpk, T3]) {
    s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(dot_r)}" fill="${chord_stroke}"/>\n`;
  }
  // show_dims block
  const dim_y = B0[1] + 40;
  s += `<line x1="${f1(B0[0])}" y1="${f1(dim_y)}" x2="${f1(B4[0])}" y2="${f1(dim_y)}" stroke="${blue}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${f1((B0[0] + B4[0]) / 2)}" y="${f1(dim_y - 6)}" text-anchor="middle" font-size="12" fill="${blue}">Bottom chord = ${formatDimension(truss_bottom_chord_len)}</text>\n`;
  s += `<line x1="${f1(Tpk[0] - 30)}" y1="${f1(Tpk[1])}" x2="${f1(Tpk[0] - 30)}" y2="${f1(B2[1])}" stroke="${blue}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${f1(Tpk[0] - 36)}" y="${f1((Tpk[1] + B2[1]) / 2 + 4)}" text-anchor="end" font-size="11" fill="${blue}">h = ${formatDimension(truss_king_post_len)}</text>\n`;
  const tc_mid_x = (B0[0] + Tpk[0]) / 2;
  const tc_mid_y = (B0[1] + Tpk[1]) / 2;
  s += `<text x="${f1(tc_mid_x - 20)}" y="${f1(tc_mid_y - 8)}" text-anchor="middle" font-size="12" fill="${chord_stroke}" font-weight="600">Top chord ${formatDimension(truss_top_chord_len)}</text>\n`;
  s += `<text x="${f1(Tpk[0] + 10)}" y="${f1((Tpk[1] + B2[1]) / 2 + 4)}" text-anchor="start" font-size="11" fill="${web_stroke}">King post ${formatDimension(truss_king_post_len)}</text>\n`;
  s += `<text x="${f1((B1[0] + Tpk[0]) / 2 - 8)}" y="${f1((B1[1] + Tpk[1]) / 2 + 4)}" text-anchor="end" font-size="10" fill="${web_stroke}">diag ${formatDimension(truss_diag_len)}</text>\n`;
  s += `<text x="${f1(T1[0] + 6)}" y="${f1((T1[1] + B1[1]) / 2 + 4)}" text-anchor="start" font-size="10" fill="${web_stroke}">vert ${formatDimension(truss_vert_len)}</text>\n`;
  s += `<text x="${f1(B0[0] + 25)}" y="${f1(B0[1] - 6)}" text-anchor="start" font-size="11" fill="#444">${f0(slope_ew)}°</text>\n`;

  // BOM callout
  const bom_x = x0 + panel_full_w - 290;
  const bom_y = y0 + title_h + 20;
  const line_h = 16;
  const tc_sz = (truss_cfg.chord_size_in as [number, number]) ?? [2, 4];
  const tc_wall = Number(truss_cfg.chord_wall_mm ?? 3);
  const tw_sz = (truss_cfg.web_size_in as [number, number]) ?? [2, 2];
  const tw_wall = Number(truss_cfg.web_wall_mm ?? 2);
  const bom_lines: Array<[string, string, boolean]> = [
    [`FINK TRUSS × ${truss_count} (identical)`, "#8b0000", true],
    [`Chord (${tc_sz[0]}"×${tc_sz[1]}"×${tc_wall} mm) each: ${formatDimension(truss_chord_total_each)}`, "#333", false],
    [`Web (${tw_sz[0]}"×${tw_sz[1]}"×${tw_wall} mm) each: ${formatDimension(truss_web_total_each)}`, "#333", false],
    ["", "#333", false],
    [`Total for ${truss_count} trusses:`, "#8b0000", true],
    [`Chord total: ${formatDimension(truss_count * truss_chord_total_each)}`, "#333", false],
    [`Web total: ${formatDimension(truss_count * truss_web_total_each)}`, "#333", false],
    ["", "#333", false],
    [`RING BEAM (${f0(house_ft[0])}'×${f0(house_ft[1])}')`, "#1e5aa6", true],
    [`${ring_beam_size[0]}"×${ring_beam_size[1]}"×${ring_beam_wall} mm perimeter: ${formatDimension(ring_beam_total)}`, "#333", false],
    ["", "#333", false],
    [`HIP-END BEAMS × ${hip_beam_total_count}`, "#8a4a1a", true],
    [`${hip_beam_size[0]}"×${hip_beam_size[1]}"×${hip_beam_wall} mm total: ${formatDimension(hip_beam_total_len)}`, "#333", false],
  ];
  for (let i = 0; i < bom_lines.length; i++) {
    const [text, color, bold] = bom_lines[i];
    const weight = bold ? ` font-weight="600"` : "";
    s += `<text x="${f(bom_x)}" y="${fY0(bom_y + i * line_h)}" font-size="11" fill="${color}"${weight}>${text}</text>\n`;
  }

  return s;
}
