// materials_takeoff_panel — svg_2d.py lines 5901-6171.
import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat, f1 } from "./format";

export function materialsTakeoffPanel(
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
    rafter_spacing_in,
    purlin_size_in,
    purlin_wall_mm,
    purlin_spacing_in,
    ridge_size_in,
    ridge_wall_mm,
    totals,
    central_ridge_total,
    hip_slant_n_val,
    hip_slant_s_val,
    hip_slant,
    hip_ridges_total,
    eave_perim_total,
    span_x,
    span_y,
    truss_count,
    truss_cfg,
    truss_top_chord_len,
    truss_bottom_chord_len,
    truss_king_post_len,
    truss_diag_len,
    truss_vert_len,
    ring_beam_size,
    ring_beam_wall,
    ring_beam_total,
    house_ft,
    house_trans_u,
    house_long_u,
    wall_top_above_eave_ft,
    hip_beam_size,
    hip_beam_wall,
    hip_beam_total_count,
    hip_beam_total_len,
    hip_beam_between_trusses,
    hip_beam_bay_count,
    hip_beam_count_per_end,
    hip_beam_n_len,
    hip_beam_s_len,
    truss_y_positions,
    has_ridge_vent,
    vent_strut_count,
    vent_strut_total,
    vent_strut_len_each,
    slopes,
    slope_qty,
    h,
  } = computed;
  const { canvas_w, outer_pad, materials_panel_h } = layout;
  const panel_full_w = canvas_w - 2 * outer_pad;
  const title_h = 40;
  let s = "";
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(materials_panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + panel_full_w / 2)}" y="${fY0(y0 + title_h - 12)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">MATERIALS TAKEOFF — Verification of Quantities</text>\n`;

  const table_y = y0 + title_h + 30;
  const row_h = 24;
  const col_x: Record<string, number> = {
    member: 40,
    section: 260,
    count: 470,
    total: 620,
    max: 780,
    notes: 920,
  };

  s += `<line x1="${f(x0 + 30)}" y1="${fY0(table_y)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(table_y)}" stroke="#333" stroke-width="1"/>\n`;
  const header_y = table_y + 18;
  const headers: Array<[string, number]> = [
    ["Member", col_x.member],
    ["HSS section × wall", col_x.section],
    ["Pieces", col_x.count],
    ["Total linear", col_x.total],
    ["Max piece", col_x.max],
    ["Notes", col_x.notes],
  ];
  for (const [label, cx] of headers) {
    s += `<text x="${f(x0 + cx)}" y="${fY0(header_y)}" font-size="12" font-weight="600" fill="#222">${label}</text>\n`;
  }
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(table_y + row_h)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(table_y + row_h)}" stroke="#333" stroke-width="1"/>\n`;

  function sect(size: [number, number], wall: number): string {
    return `${size[0]}"×${size[1]}"×${wall}mm`;
  }
  const rows: string[][] = [
    ["Rafter", sect(rafter_size_in, rafter_wall_mm), `${totals.rafter_count}`,
      formatDimension(totals.rafter_total), formatDimension(totals.rafter_max),
      `@ ${rafter_spacing_in}" OC, sum of individual lengths`],
    ["Purlin", sect(purlin_size_in, purlin_wall_mm), `${totals.purlin_count}`,
      formatDimension(totals.purlin_total), formatDimension(totals.purlin_max),
      `@ ${purlin_spacing_in}" OC, sum of individual lengths`],
    ["Central ridge", sect(ridge_size_in, ridge_wall_mm), "1",
      formatDimension(central_ridge_total), formatDimension(central_ridge_total),
      "Top ridge = configured ridge_length"],
    ["Hip ridges (N)", sect(ridge_size_in, ridge_wall_mm), "2",
      formatDimension(2 * hip_slant_n_val), formatDimension(hip_slant_n_val),
      "2 diagonals from N ridge endpoint to N eave corners"],
    ["Hip ridges (S)", sect(ridge_size_in, ridge_wall_mm), "2",
      formatDimension(2 * hip_slant_s_val), formatDimension(hip_slant_s_val),
      "2 diagonals from S ridge endpoint to S eave corners"],
  ];

  const pp_cfg = (framing.pani_patti as Record<string, unknown>) ?? {};
  const pp_h_in = Number(pp_cfg.height_in ?? 6);
  const pp_thk_mm = Number(pp_cfg.thickness_mm ?? 1.2);
  const L_ch_sz = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const L_ch_wall = Number(framing.eave_L_channel_wall_mm ?? 3);
  const barge_sz = (framing.barge_pipe_size_in as [number, number]) ?? [3, 1];
  const barge_wall = Number(framing.barge_pipe_wall_mm ?? 1.6);
  const ridge_ang_sz = (framing.ridge_angle_size_in as [number, number]) ?? [1, 1];
  const ridge_ang_wall = Number(framing.ridge_angle_wall_mm ?? 3);
  const corner_ang_sz = (framing.corner_double_angle_size_in as [number, number]) ?? [1, 1];
  const corner_ang_wall = Number(framing.corner_double_angle_wall_mm ?? 3);

  rows.push(
    ["Pani Patti", `${pp_h_in.toFixed(0)}"×${pp_thk_mm} mm GI`, "4",
      formatDimension(eave_perim_total), formatDimension(Math.max(span_x, span_y)),
      "Water-protector strip along entire eave perimeter"],
    ["Eave L-channel", sect(L_ch_sz, L_ch_wall), "4",
      formatDimension(eave_perim_total), formatDimension(Math.max(span_x, span_y)),
      `${L_ch_sz[0]}"×${L_ch_sz[1]}"×${L_ch_wall}mm angle on top of Pani Patti`],
    ["Barge pipe", sect(barge_sz, barge_wall), "0", "0", "—",
      "N/A for hip roof (no free edges); include if adjacent to non-adjoining section"],
    ["Ridge angle", sect(ridge_ang_sz, ridge_ang_wall), "—", "—", "—",
      "Only if roof width isn't a clean tile multiple (supports cut top tiles)"],
    ["Corner double angle", sect(corner_ang_sz, corner_ang_wall), "4 × 2",
      formatDimension(2 * hip_ridges_total), formatDimension(hip_slant),
      "Doubled — 2 legs along each of the 4 hip ridges to support cut ceiling tiles"],
  );

  if (truss_count > 0) {
    const tc_sz = (truss_cfg.chord_size_in as [number, number]) ?? [2, 4];
    const tc_wall = Number(truss_cfg.chord_wall_mm ?? 3);
    const tw_sz = (truss_cfg.web_size_in as [number, number]) ?? [2, 2];
    const tw_wall = Number(truss_cfg.web_wall_mm ?? 2);
    rows.push(
      ["Truss top chord", sect(tc_sz, tc_wall), `${truss_count * 2}`,
        formatDimension(truss_count * 2 * truss_top_chord_len),
        formatDimension(truss_top_chord_len),
        `Fink truss — 2 sloping top chords per truss × ${truss_count} trusses`],
      ["Truss bottom chord", sect(tc_sz, tc_wall), `${truss_count}`,
        formatDimension(truss_count * truss_bottom_chord_len),
        formatDimension(truss_bottom_chord_len),
        `Horizontal tie beam × ${truss_count} trusses`],
      ["Truss king post", sect(tw_sz, tw_wall), `${truss_count}`,
        formatDimension(truss_count * truss_king_post_len),
        formatDimension(truss_king_post_len),
        "Central vertical post — peak to bottom-chord centre"],
      ["Truss web diagonals", sect(tw_sz, tw_wall), `${truss_count * 2}`,
        formatDimension(truss_count * 2 * truss_diag_len),
        formatDimension(truss_diag_len),
        "Peak to bottom-chord panel points (2 per truss)"],
      ["Truss web verticals", sect(tw_sz, tw_wall), `${truss_count * 2}`,
        formatDimension(truss_count * 2 * truss_vert_len),
        formatDimension(truss_vert_len),
        "Top-chord panel points to bottom-chord panel points (2 per truss)"],
    );
  }

  rows.push(
    ["Ring beam", sect(ring_beam_size, ring_beam_wall), "4",
      formatDimension(ring_beam_total),
      formatDimension(Math.max(house_trans_u, house_long_u)),
      `Perimeter tie at wall top (${house_ft[0].toFixed(0)}' × ${house_ft[1].toFixed(0)}' frame, ${(wall_top_above_eave_ft * 12).toFixed(0)}" above eave)`],
  );

  if (hip_beam_total_count > 0) {
    let hb_note = `${hip_beam_count_per_end} per hip end (× 2 ends) — corner truss to N/S wall`;
    if (hip_beam_between_trusses && hip_beam_bay_count > 0) {
      const _n_bays = truss_y_positions.length - 1;
      hb_note += `; extended through ${_n_bays} ridge-zone bay(s) — continuous N wall → S wall`;
    }
    rows.push(
      ["Hip-end beam", sect(hip_beam_size, hip_beam_wall), `${hip_beam_total_count}`,
        formatDimension(hip_beam_total_len),
        formatDimension(Math.max(hip_beam_n_len, hip_beam_s_len)),
        hb_note],
    );
  }
  if (has_ridge_vent) {
    const strut_sect = (truss_cfg.web_size_in as [number, number]) ?? [2, 2];
    const strut_wall = Number(truss_cfg.web_wall_mm ?? 2);
    rows.push(
      ["Vent-strut", sect(strut_sect, strut_wall), `${vent_strut_count}`,
        formatDimension(vent_strut_total), formatDimension(vent_strut_len_each),
        `${Math.trunc(vent_strut_count / 2)} per end — ties extended ridge back to hip ridges`],
    );
  }

  const cellKeys = ["member", "section", "count", "total", "max", "notes"];
  let row_y = table_y + row_h + 18;
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const key = cellKeys[i];
      s += `<text x="${f(x0 + col_x[key])}" y="${fY0(row_y)}" font-size="12" fill="#333">${row[i]}</text>\n`;
    }
    row_y += row_h;
  }
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(row_y - 8)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(row_y - 8)}" stroke="#333" stroke-width="1"/>\n`;

  // ---- description ----
  let desc_y = row_y + 12;
  s += `<text x="${f(x0 + 40)}" y="${fY0(desc_y)}" font-size="14" font-weight="600" fill="#222">How the quantities were computed</text>\n`;
  desc_y += 22;
  const line_gap = 15;
  const lines: Array<[string, boolean]> = [];
  lines.push(["Inputs (from the config):", true]);
  lines.push([`  • Eave bounding box: ${formatDimension(span_x)} × ${formatDimension(span_y)} (perimeter ${formatDimension(eave_perim_total)})`, false]);
  lines.push([`  • Main slope pitch: ${f1(slopes[0].pitch)}°   |   Hip-end pitch: ${f1(slopes[2].pitch)}°   |   Ridge height above eave h = ${formatDimension(h)}`, false]);
  lines.push([`  • Rafter spacing: ${rafter_spacing_in}"   |   Purlin spacing: ${purlin_spacing_in}"`, false]);
  lines.push([`  • Slope L (perpendicular height on the slope face): main = ${formatDimension(slopes[0].perp_h)}, hip end = ${formatDimension(slopes[2].perp_h)}`, false]);
  lines.push(["", false]);
  lines.push(["Rafters — per slope, rafter count = floor(eave / spacing) + 1; each rafter's length", false]);
  lines.push(["is the perpendicular distance from its position on the eave up to either the top edge", false]);
  lines.push(["(central ridge, on the trapezoidal main slopes) or to a hip ridge (on the triangular", false]);
  lines.push(["hip ends, and near the corners of the main slopes).", false]);
  for (const code of ["W", "E", "N", "S"]) {
    const q = slope_qty[code];
    lines.push([`   ${code} slope: ${q.rafter_count} rafters, total ${formatDimension(q.rafter_total)}  (longest ${formatDimension(q.rafter_max)})`, false]);
  }
  lines.push([`   Total: ${totals.rafter_count} rafters, ${formatDimension(totals.rafter_total)}`, true]);
  lines.push(["", false]);
  lines.push([`Purlins — placed every ${purlin_spacing_in}" starting ${purlin_spacing_in}" above the eave (the y=0 row is the eave-edge`, false]);
  lines.push(["pipe, counted separately). At height y, each purlin spans between the two hip ridges:", false]);
  lines.push(["L(y) = eave − 2·d_hip·y/height   (for the triangular hip ends, d_hip = eave/2).", false]);
  for (const code of ["W", "E", "N", "S"]) {
    const q = slope_qty[code];
    lines.push([`   ${code} slope: ${q.purlin_count} purlins, total ${formatDimension(q.purlin_total)}  (longest ${formatDimension(q.purlin_max)})`, false]);
  }
  lines.push([`   Total: ${totals.purlin_count} purlins, ${formatDimension(totals.purlin_total)}`, true]);
  lines.push(["", false]);
  lines.push([`Central ridge — 1 piece, length = ridge_length = ${formatDimension(central_ridge_total)}.`, false]);
  lines.push(["", false]);
  lines.push(["Hip ridges — 4 pieces (one per corner). Each is the 3-D diagonal from a ridge", false]);
  lines.push(["endpoint to an eave corner:  L = √((eave_x_east−eave_x_west)/2)² + d_hip² + h²)", false]);
  lines.push([`   N pair: 2 × ${formatDimension(hip_slant_n_val)} = ${formatDimension(2 * hip_slant_n_val)}   |   S pair: 2 × ${formatDimension(hip_slant_s_val)} = ${formatDimension(2 * hip_slant_s_val)}   |   Total: ${formatDimension(hip_ridges_total)}`, true]);
  lines.push(["", false]);
  lines.push(["Eave edge — one continuous run around the eave bounding box:", false]);
  lines.push([`   2 × (${formatDimension(span_x)} + ${formatDimension(span_y)}) = ${formatDimension(eave_perim_total)}`, true]);

  for (const [text, bold] of lines) {
    const weight = bold ? ` font-weight="600"` : "";
    s += `<text x="${f(x0 + 40)}" y="${fY0(desc_y)}" font-size="12" fill="#333"${weight}>${text}</text>\n`;
    desc_y += line_gap;
  }

  return s;
}
