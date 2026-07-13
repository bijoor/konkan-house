// consolidated_bom_panel — svg_2d.py lines 6174-6332.
import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat } from "./format";

export function consolidatedBomPanel(
  x0: number,
  y0: number,
  computed: RoofComputed,
  layout: Layout,
  y0IsFloat = false,
): string {
  const fY0 = (n: number) => (y0IsFloat ? fFloat(n) : f(n));
  const {
    framing,
    rafter_size_in,
    rafter_wall_mm,
    purlin_size_in,
    purlin_wall_mm,
    ridge_size_in,
    ridge_wall_mm,
    totals,
    central_ridge_total,
    hip_ridges_total,
    ring_beam_size,
    ring_beam_wall,
    ring_beam_total,
    truss_count,
    truss_cfg,
    truss_top_chord_len,
    truss_bottom_chord_len,
    truss_king_post_len,
    truss_diag_len,
    truss_vert_len,
    hip_beam_size,
    hip_beam_wall,
    hip_beam_total_count,
    hip_beam_total_len,
    has_ridge_vent,
    vent_strut_count,
    vent_strut_total,
    eave_perim_total,
  } = computed;
  const { canvas_w, outer_pad, consolidated_panel_h } = layout;
  const panel_full_w = canvas_w - 2 * outer_pad;
  const title_h = 40;
  let s = "";
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(consolidated_panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + panel_full_w / 2)}" y="${fY0(y0 + title_h - 12)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">CONSOLIDATED PROCUREMENT LIST — Totals by Material Spec</text>\n`;

  const pp_cfg = (framing.pani_patti as Record<string, unknown>) ?? {};
  const pp_h_in = Number(pp_cfg.height_in ?? 6);
  const pp_thk_mm = Number(pp_cfg.thickness_mm ?? 1.2);
  const L_ch_sz = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const L_ch_wall = Number(framing.eave_L_channel_wall_mm ?? 3);
  const corner_ang_sz = (framing.corner_double_angle_size_in as [number, number]) ?? [1, 1];
  const corner_ang_wall = Number(framing.corner_double_angle_wall_mm ?? 3);
  const tc_sz = truss_count > 0 ? ((truss_cfg.chord_size_in as [number, number]) ?? [2, 4]) : null;
  const tc_wall = truss_count > 0 ? Number(truss_cfg.chord_wall_mm ?? 3) : null;
  const tw_sz = truss_count > 0 ? ((truss_cfg.web_size_in as [number, number]) ?? [2, 2]) : null;
  const tw_wall = truss_count > 0 ? Number(truss_cfg.web_wall_mm ?? 2) : null;

  function hss(size: [number, number], wall: number): string {
    return `HSS ${size[0]}"×${size[1]}"×${wall} mm`;
  }
  function gi(h_in: number, thk_mm: number): string {
    return `GI strip ${h_in.toFixed(0)}"×${thk_mm} mm`;
  }
  function angle(size: [number, number], wall: number): string {
    return `L-angle ${size[0]}"×${size[1]}"×${wall} mm`;
  }
  const purlin_spec = hss(purlin_size_in, purlin_wall_mm);
  type Member = [string, string, number, number];
  const members: Member[] = [
    [hss(rafter_size_in, rafter_wall_mm), "Rafters", totals.rafter_count, totals.rafter_total],
    [purlin_spec, "Purlins", totals.purlin_count, totals.purlin_total],
    [hss(ridge_size_in, ridge_wall_mm), "Central ridge", 1, central_ridge_total],
    [hss(ridge_size_in, ridge_wall_mm), "Hip ridges", 4, hip_ridges_total],
    [hss(ring_beam_size, ring_beam_wall), "Ring beam", 4, ring_beam_total],
  ];
  if (hip_beam_total_count > 0) {
    members.push([hss(hip_beam_size, hip_beam_wall), "Hip-end beams", hip_beam_total_count, hip_beam_total_len]);
  }
  if (has_ridge_vent) {
    const strut_sect = (truss_cfg.web_size_in as [number, number]) ?? [2, 2];
    const strut_wall = Number(truss_cfg.web_wall_mm ?? 2);
    members.push([hss(strut_sect, strut_wall), "Ridge-vent struts", vent_strut_count, vent_strut_total]);
  }
  if (truss_count > 0 && tc_sz && tw_sz) {
    members.push(
      [hss(tc_sz, tc_wall!), "Truss top chords", truss_count * 2, truss_count * 2 * truss_top_chord_len],
      [hss(tc_sz, tc_wall!), "Truss bottom chords", truss_count, truss_count * truss_bottom_chord_len],
      [hss(tw_sz, tw_wall!), "Truss king posts", truss_count, truss_count * truss_king_post_len],
      [hss(tw_sz, tw_wall!), "Truss web diagonals", truss_count * 2, truss_count * 2 * truss_diag_len],
      [hss(tw_sz, tw_wall!), "Truss web verticals", truss_count * 2, truss_count * 2 * truss_vert_len],
    );
  }
  members.push(
    [gi(pp_h_in, pp_thk_mm), "Pani Patti", 4, eave_perim_total],
    [angle(L_ch_sz, L_ch_wall), "Eave L-channel", 4, eave_perim_total],
    [angle(corner_ang_sz, corner_ang_wall), "Corner double angle (hips)", 4 * 2, 2 * hip_ridges_total],
  );

  // Group by spec (OrderedDict)
  const groups = new Map<string, { members: [string, number, number][]; total_pcs: number; total_len: number }>();
  for (const [spec, label, pcs, tot] of members) {
    let g = groups.get(spec);
    if (!g) {
      g = { members: [], total_pcs: 0, total_len: 0.0 };
      groups.set(spec, g);
    }
    g.members.push([label, pcs, tot]);
    g.total_pcs += pcs;
    g.total_len += tot;
  }

  const table_y = y0 + title_h + 30;
  const row_h = 22;
  const col_x: Record<string, number> = { spec: 40, members: 350, pieces: 900, total: 1050 };
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(table_y)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(table_y)}" stroke="#333" stroke-width="1"/>\n`;
  const header_y = table_y + 18;
  const headers: Array<[string, number]> = [
    ["Material spec", col_x.spec],
    ["Members using this spec", col_x.members],
    ["Total pieces", col_x.pieces],
    ["Total linear", col_x.total],
  ];
  for (const [label, cx] of headers) {
    s += `<text x="${f(x0 + cx)}" y="${fY0(header_y)}" font-size="12" font-weight="600" fill="#222">${label}</text>\n`;
  }
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(table_y + row_h)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(table_y + row_h)}" stroke="#333" stroke-width="1"/>\n`;

  let row_y = table_y + row_h + 16;
  for (const [spec, g] of groups) {
    const mem_list = g.members.map(([lbl, pcs, tot]) => `${lbl} (${pcs}× ${formatDimension(tot)})`).join(", ");
    s += `<text x="${f(x0 + col_x.spec)}" y="${fY0(row_y)}" font-size="12" font-weight="600" fill="#222">${spec}</text>\n`;
    s += `<text x="${f(x0 + col_x.members)}" y="${fY0(row_y)}" font-size="11" fill="#444">${mem_list}</text>\n`;
    s += `<text x="${f(x0 + col_x.pieces)}" y="${fY0(row_y)}" font-size="12" fill="#333">${g.total_pcs}</text>\n`;
    s += `<text x="${f(x0 + col_x.total)}" y="${fY0(row_y)}" font-size="12" font-weight="700" fill="#0a4">${formatDimension(g.total_len)}</text>\n`;
    row_y += row_h;
  }
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(row_y - 8)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(row_y - 8)}" stroke="#333" stroke-width="1"/>\n`;

  let summary_y = row_y + 24;
  s += `<text x="${f(x0 + 40)}" y="${fY0(summary_y)}" font-size="14" font-weight="600" fill="#222">Grand totals by material family</text>\n`;
  summary_y += 20;
  const family_totals: Record<string, number> = { HSS: 0.0, "GI strip": 0.0, "L-angle": 0.0 };
  for (const [spec, g] of groups) {
    for (const fam of Object.keys(family_totals)) {
      if (spec.startsWith(fam)) {
        family_totals[fam] += g.total_len;
        break;
      }
    }
  }
  for (const fam of Object.keys(family_totals)) {
    s += `<text x="${f(x0 + 60)}" y="${fY0(summary_y)}" font-size="12" fill="#333">• ${fam}: <tspan font-weight="700" fill="#0a4">${formatDimension(family_totals[fam])}</tspan></text>\n`;
    summary_y += 18;
  }
  return s;
}
