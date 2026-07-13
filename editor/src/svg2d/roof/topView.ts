// top_view_panel — svg_2d.py lines 6611-7168.
import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat, f1, f2 } from "./format";

export function topViewPanel(
  x0: number,
  y0: number,
  w_p: number,
  h_p: number,
  computed: RoofComputed,
  _layout: Layout,
): string {
  const {
    roof,
    house_config,
    ridge_axis,
    eave_xw,
    eave_xe,
    eave_yn,
    eave_ys,
    d_hip_n,
    d_hip_s,
    d_hip_w,
    d_hip_e,
    span_x,
    span_y,
    slopes,
    rafter_spacing_u,
    rafter_size_in,
    rafter_wall_mm,
    rafter_spacing_in,
    purlin_spacing_u,
    purlin_size_in,
    purlin_wall_mm,
    purlin_spacing_in,
    ridge_size_in,
    ridge_wall_mm,
    truss_count,
    truss_cfg,
    truss_y_positions,
    ring_beam_size,
    ring_beam_wall,
    wall_inset_trans,
    wall_inset_long_n,
    wall_inset_long_s,
    hip_beam_size,
    hip_beam_wall,
    hip_beam_count_per_end,
    hip_beam_total_count,
    hip_beam_between_trusses,
    house_ft,
    framing,
    IN_PER_UNIT,
    long_truss_count,
    long_truss_cfg,
    long_truss_positions,
  } = computed;

  const title_h = 40;
  const inner_pad = 60;
  const label_col_w = 300;

  let ridge_x_pos = 0, ridge_y_pos = 0, r_y_start = 0, r_y_end = 0, r_x_start = 0, r_x_end = 0;
  if (ridge_axis === "y") {
    ridge_x_pos = (eave_xw + eave_xe) / 2.0;
    r_y_start = eave_yn + d_hip_n;
    r_y_end = eave_ys - d_hip_s;
  } else {
    ridge_y_pos = (eave_yn + eave_ys) / 2.0;
    r_x_start = eave_xw + d_hip_w;
    r_x_end = eave_xe - d_hip_e;
  }

  const world_w = span_x;
  const world_h = span_y;
  const avail_w = w_p - 2 * inner_pad - label_col_w;
  const avail_h = h_p - title_h - 2 * inner_pad;
  const s_scale = Math.min(avail_w / world_w, avail_h / world_h) * 0.95;
  const drawing_cx = x0 + inner_pad + avail_w / 2;
  const drawing_cy = y0 + title_h + inner_pad + avail_h / 2;
  const world_cx = (eave_xw + eave_xe) / 2.0;
  const world_cy = (eave_yn + eave_ys) / 2.0;

  function T(wx: number, wy: number): [number, number] {
    return [drawing_cx + (wx - world_cx) * s_scale, drawing_cy + (wy - world_cy) * s_scale];
  }

  const NW = T(eave_xw, eave_yn);
  const NE = T(eave_xe, eave_yn);
  const SE = T(eave_xe, eave_ys);
  const SW = T(eave_xw, eave_ys);
  let NR: [number, number], SR: [number, number];
  if (ridge_axis === "y") {
    NR = T(ridge_x_pos, r_y_start);
    SR = T(ridge_x_pos, r_y_end);
  } else {
    NR = T(r_x_start, ridge_y_pos);
    SR = T(r_x_end, ridge_y_pos);
  }

  let faces: Record<string, [number, number][]>;
  if (ridge_axis === "y") {
    faces = {
      N: [NW, NE, NR],
      S: [SW, SR, SE],
      W: [NW, NR, SR, SW],
      E: [NE, SE, SR, NR],
    };
  } else {
    faces = {
      W: [NW, NR, SW],
      E: [NE, SE, SR],
      N: [NW, NE, SR, NR],
      S: [SW, NR, SR, SE],
    };
  }

  const cid = "topfv";
  let s = "";
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w_p)}" height="${f(h_p)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w_p)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + w_p / 2)}" y="${f(y0 + title_h - 13)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">ROOF PLAN — Top View (framing layout)</text>\n`;

  // Clip paths (dict ordering: N, S, W, E for axis='y')
  const faceCodesOrder = ridge_axis === "y" ? ["N", "S", "W", "E"] : ["W", "E", "N", "S"];
  s += `<defs>\n`;
  for (const code of faceCodesOrder) {
    const poly = faces[code];
    const pts = poly.map(([px, py]) => `${f1(px)},${f1(py)}`).join(" ");
    s += `<clipPath id="${cid}_${code}"><polygon points="${pts}"/></clipPath>\n`;
  }
  s += `</defs>\n`;

  // Faint tint fill
  for (const code of faceCodesOrder) {
    const poly = faces[code];
    const pts = poly.map(([px, py]) => `${f1(px)},${f1(py)}`).join(" ");
    s += `<polygon points="${pts}" fill="#f8ecd8" fill-opacity="0.7" stroke="none"/>\n`;
  }

  const rafter_stroke = "#8B4513";
  function inToPx(inches: number): number {
    return (inches / IN_PER_UNIT) * s_scale;
  }
  const rafter_w = Math.max(inToPx(rafter_size_in[0]), 1.4);

  function rafterPositions(base_len: number): number[] {
    const n_r = Math.trunc(base_len / rafter_spacing_u) + 1;
    const gap = base_len - (n_r - 1) * rafter_spacing_u;
    const first_off = gap > 0 ? gap / 2.0 : 0.0;
    return Array.from({ length: n_r }, (_, i) => first_off + i * rafter_spacing_u);
  }

  if (ridge_axis === "y") {
    for (const off of rafterPositions(span_y)) {
      const y_r = eave_yn + off;
      const p1 = T(eave_xw, y_r);
      const p2 = T(ridge_x_pos, y_r);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${rafter_stroke}" stroke-width="${rafter_w}" clip-path="url(#${cid}_W)"/>\n`;
    }
    for (const off of rafterPositions(span_y)) {
      const y_r = eave_yn + off;
      const p1 = T(eave_xe, y_r);
      const p2 = T(ridge_x_pos, y_r);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${rafter_stroke}" stroke-width="${rafter_w}" clip-path="url(#${cid}_E)"/>\n`;
    }
    for (const off of rafterPositions(span_x)) {
      const x_r = eave_xw + off;
      const p1 = T(x_r, eave_yn);
      const p2 = T(x_r, r_y_start);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${rafter_stroke}" stroke-width="${rafter_w}" clip-path="url(#${cid}_N)"/>\n`;
    }
    for (const off of rafterPositions(span_x)) {
      const x_r = eave_xw + off;
      const p1 = T(x_r, eave_ys);
      const p2 = T(x_r, r_y_end);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${rafter_stroke}" stroke-width="${rafter_w}" clip-path="url(#${cid}_S)"/>\n`;
    }
  }

  const purlin_stroke = "#4a8fbf";
  const purlin_w = Math.max(inToPx(purlin_size_in[0]), 0.7);
  if (ridge_axis === "y") {
    const main_step_plan = purlin_spacing_u * Math.cos((slopes.find((s) => s.code === "W")!.pitch * Math.PI) / 180);
    const half_span_x = span_x / 2.0;
    const n_main = Math.trunc(half_span_x / main_step_plan);
    for (let i = 1; i <= n_main; i++) {
      const x_w = eave_xw + i * main_step_plan;
      const p1 = T(x_w, eave_yn);
      const p2 = T(x_w, eave_ys);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${purlin_stroke}" stroke-width="${purlin_w}" clip-path="url(#${cid}_W)"/>\n`;
      const x_e = eave_xe - i * main_step_plan;
      const p1e = T(x_e, eave_yn);
      const p2e = T(x_e, eave_ys);
      s += `<line x1="${f1(p1e[0])}" y1="${f1(p1e[1])}" x2="${f1(p2e[0])}" y2="${f1(p2e[1])}" stroke="${purlin_stroke}" stroke-width="${purlin_w}" clip-path="url(#${cid}_E)"/>\n`;
    }
    const hip_pitch_n = slopes[2].pitch;
    const hip_pitch_s = slopes[3].pitch;
    const hip_step_n = purlin_spacing_u * Math.cos((hip_pitch_n * Math.PI) / 180);
    const hip_step_s = purlin_spacing_u * Math.cos((hip_pitch_s * Math.PI) / 180);
    const n_hip_n = hip_step_n > 0 ? Math.trunc(d_hip_n / hip_step_n) : 0;
    const n_hip_s = hip_step_s > 0 ? Math.trunc(d_hip_s / hip_step_s) : 0;
    for (let i = 1; i <= n_hip_n; i++) {
      const y_n = eave_yn + i * hip_step_n;
      const p1 = T(eave_xw, y_n);
      const p2 = T(eave_xe, y_n);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${purlin_stroke}" stroke-width="${purlin_w}" clip-path="url(#${cid}_N)"/>\n`;
    }
    for (let i = 1; i <= n_hip_s; i++) {
      const y_s = eave_ys - i * hip_step_s;
      const p1 = T(eave_xw, y_s);
      const p2 = T(eave_xe, y_s);
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${purlin_stroke}" stroke-width="${purlin_w}" clip-path="url(#${cid}_S)"/>\n`;
    }
  }

  const ridge_stroke = "#5a3a17";
  const ridge_w = Math.max(inToPx(ridge_size_in[0]), 2.6);
  const vent_ext_u = Number(roof.ridge_ext_u ?? 0.0);
  const has_vent = vent_ext_u > 0;
  let NR_ext: [number, number], SR_ext: [number, number];
  if (has_vent && ridge_axis === "y") {
    NR_ext = T(ridge_x_pos, r_y_start - vent_ext_u);
    SR_ext = T(ridge_x_pos, r_y_end + vent_ext_u);
  } else if (has_vent) {
    NR_ext = T(r_x_start - vent_ext_u, ridge_y_pos);
    SR_ext = T(r_x_end + vent_ext_u, ridge_y_pos);
  } else {
    NR_ext = NR;
    SR_ext = SR;
  }
  s += `<line x1="${f1(NR_ext[0])}" y1="${f1(NR_ext[1])}" x2="${f1(SR_ext[0])}" y2="${f1(SR_ext[1])}" stroke="${ridge_stroke}" stroke-width="${ridge_w}"/>\n`;
  let hips: Array<[[number, number], [number, number]]>;
  if (ridge_axis === "y") {
    hips = [[NR, NW], [NR, NE], [SR, SW], [SR, SE]];
  } else {
    hips = [[NR, NW], [NR, SW], [SR, NE], [SR, SE]];
  }
  for (const [a, b] of hips) {
    s += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${ridge_stroke}" stroke-width="${ridge_w}"/>\n`;
  }

  if (has_vent) {
    const strut_stroke = "#5a3a17";
    const strut_w = Math.max(ridge_w * 0.5, 1.4);
    function ptAlong2d(a: [number, number], b: [number, number], dist_world: number): [number, number] {
      const dx_svg = b[0] - a[0];
      const dy_svg = b[1] - a[1];
      const length_svg = Math.sqrt(dx_svg ** 2 + dy_svg ** 2);
      if (length_svg <= 0) return a;
      const dist_svg = dist_world * s_scale;
      const t = dist_svg / length_svg;
      return [a[0] + t * dx_svg, a[1] + t * dy_svg];
    }
    if (ridge_axis === "y") {
      const configs: Array<[[number, number], [number, number], [number, number], [number, number]]> = [
        [NR_ext, NR, NW, NE],
        [SR_ext, SR, SW, SE],
      ];
      for (const [ext_pt, apex_pt, corner_a, corner_b] of configs) {
        const p_a = ptAlong2d(apex_pt, corner_a, vent_ext_u);
        const p_b = ptAlong2d(apex_pt, corner_b, vent_ext_u);
        for (const foot of [p_a, p_b]) {
          s += `<line x1="${f1(ext_pt[0])}" y1="${f1(ext_pt[1])}" x2="${f1(foot[0])}" y2="${f1(foot[1])}" stroke="${strut_stroke}" stroke-width="${f1(strut_w)}" stroke-dasharray="5,3" opacity="0.85"/>\n`;
        }
      }
    }
  }

  // Trusses
  if (truss_count > 0) {
    const truss_stroke = "#8b0000";
    const truss_chord_size = (truss_cfg.chord_size_in as [number, number]) ?? [2, 4];
    const truss_w_px = Math.max(inToPx(truss_chord_size[0]), 2.2);
    const blue = "#0066cc";
    for (let i = 0; i < truss_y_positions.length; i++) {
      const pos = truss_y_positions[i];
      let p1: [number, number], p2: [number, number];
      if (ridge_axis === "y") {
        p1 = T(eave_xw, pos);
        p2 = T(eave_xe, pos);
      } else {
        p1 = T(pos, eave_yn);
        p2 = T(pos, eave_ys);
      }
      s += `<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="${truss_stroke}" stroke-width="${f1(truss_w_px)}" opacity="0.85"/>\n`;
      const mid_x = (p1[0] + p2[0]) / 2;
      const mid_y = (p1[1] + p2[1]) / 2;
      s += `<circle cx="${f1(mid_x)}" cy="${f1(mid_y)}" r="8" fill="white" stroke="${truss_stroke}" stroke-width="1.2"/>\n`;
      s += `<text x="${f1(mid_x)}" y="${f1(mid_y + 4)}" text-anchor="middle" font-size="10" font-weight="700" fill="${truss_stroke}">T${i + 1}</text>\n`;
    }

    if (truss_count > 1 && ridge_axis === "y") {
      const dim_x = T(eave_xe, 0)[0] + 26;
      for (const pos of truss_y_positions) {
        const [_ignore, py] = T(eave_xe, pos);
        void _ignore;
        s += `<line x1="${f1(T(eave_xe, pos)[0])}" y1="${f1(py)}" x2="${f1(dim_x + 4)}" y2="${f1(py)}" stroke="${blue}" stroke-width="0.5" stroke-dasharray="3,2"/>\n`;
      }
      for (let i = 0; i < truss_count - 1; i++) {
        const py1 = T(eave_xe, truss_y_positions[i])[1];
        const py2 = T(eave_xe, truss_y_positions[i + 1])[1];
        const _sp_u = Math.abs(truss_y_positions[i + 1] - truss_y_positions[i]);
        s += `<line x1="${f1(dim_x)}" y1="${f1(py1)}" x2="${f1(dim_x)}" y2="${f1(py2)}" stroke="${blue}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
        s += `<text x="${f1(dim_x + 6)}" y="${f1((py1 + py2) / 2 + 4)}" text-anchor="start" font-size="11" fill="${blue}">${formatDimension(_sp_u)}</text>\n`;
      }
    }
  }

  // Ring beam
  let rb_xw: number, rb_xe: number, rb_yn: number, rb_ys: number;
  if (ridge_axis === "y") {
    rb_xw = eave_xw + wall_inset_trans;
    rb_xe = eave_xe - wall_inset_trans;
    rb_yn = eave_yn + wall_inset_long_n;
    rb_ys = eave_ys - wall_inset_long_s;
  } else {
    rb_xw = eave_xw + wall_inset_long_n;
    rb_xe = eave_xe - wall_inset_long_s;
    rb_yn = eave_yn + wall_inset_trans;
    rb_ys = eave_ys - wall_inset_trans;
  }
  const rb_nw = T(rb_xw, rb_yn);
  const rb_ne = T(rb_xe, rb_yn);
  const rb_se = T(rb_xe, rb_ys);
  const rb_sw = T(rb_xw, rb_ys);
  const ring_stroke = "#1e5aa6";
  const ring_w = Math.max(inToPx(ring_beam_size[0]), 2.0);
  s += `<polygon points="${f1(rb_nw[0])},${f1(rb_nw[1])} ${f1(rb_ne[0])},${f1(rb_ne[1])} ${f1(rb_se[0])},${f1(rb_se[1])} ${f1(rb_sw[0])},${f1(rb_sw[1])}" fill="none" stroke="${ring_stroke}" stroke-width="${f1(ring_w)}" opacity="0.85"/>\n`;
  s += `<text x="${f1((rb_ne[0] + rb_se[0]) / 2 + 12)}" y="${f1((rb_ne[1] + rb_se[1]) / 2)}" text-anchor="start" font-size="11" font-weight="600" fill="${ring_stroke}">Ring beam (${house_ft[0].toFixed(0)}'×${house_ft[1].toFixed(0)}')</text>\n`;

  // Hip-end beams
  if (hip_beam_total_count > 0 && ridge_axis === "y" && truss_count >= 2) {
    const hip_beam_stroke = "#8a4a1a";
    const hip_beam_w = Math.max(inToPx(hip_beam_size[0]), 1.8);
    for (let i = 0; i < hip_beam_count_per_end; i++) {
      const _frac = (i + 1) / (hip_beam_count_per_end + 1);
      const bx_world = rb_xw + _frac * (rb_xe - rb_xw);
      const p_n_start = T(bx_world, truss_y_positions[0]);
      const p_n_end = T(bx_world, rb_yn);
      s += `<line x1="${f1(p_n_start[0])}" y1="${f1(p_n_start[1])}" x2="${f1(p_n_end[0])}" y2="${f1(p_n_end[1])}" stroke="${hip_beam_stroke}" stroke-width="${f1(hip_beam_w)}" opacity="0.85"/>\n`;
      const p_s_start = T(bx_world, truss_y_positions[truss_y_positions.length - 1]);
      const p_s_end = T(bx_world, rb_ys);
      s += `<line x1="${f1(p_s_start[0])}" y1="${f1(p_s_start[1])}" x2="${f1(p_s_end[0])}" y2="${f1(p_s_end[1])}" stroke="${hip_beam_stroke}" stroke-width="${f1(hip_beam_w)}" opacity="0.85"/>\n`;
      if (hip_beam_between_trusses) {
        for (let _j = 0; _j < truss_y_positions.length - 1; _j++) {
          const p_a = T(bx_world, truss_y_positions[_j]);
          const p_b = T(bx_world, truss_y_positions[_j + 1]);
          s += `<line x1="${f1(p_a[0])}" y1="${f1(p_a[1])}" x2="${f1(p_b[0])}" y2="${f1(p_b[1])}" stroke="${hip_beam_stroke}" stroke-width="${f1(hip_beam_w)}" opacity="0.85"/>\n`;
        }
      }
    }
  }
  void long_truss_count; void long_truss_cfg; void long_truss_positions; // stubs (unused)

  // Eave assembly bands
  const pp_w_in = 1.0;
  const pp_w_px = Math.max(inToPx(pp_w_in), 2.0);
  const eave_L_ch_size = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const eave_L_w_px = Math.max(inToPx(eave_L_ch_size[0]), 2.0);

  s += `<polygon points="${f1(NW[0])},${f1(NW[1])} ${f1(NE[0])},${f1(NE[1])} ${f1(SE[0])},${f1(SE[1])} ${f1(SW[0])},${f1(SW[1])}" fill="none" stroke="#4a8fbf" stroke-width="${f1(pp_w_px)}" opacity="0.55"/>\n`;

  const offset_px = inToPx(pp_w_in);
  const NW_L: [number, number] = [NW[0] + offset_px, NW[1] + offset_px];
  const NE_L: [number, number] = [NE[0] - offset_px, NE[1] + offset_px];
  const SE_L: [number, number] = [SE[0] - offset_px, SE[1] - offset_px];
  const SW_L: [number, number] = [SW[0] + offset_px, SW[1] - offset_px];
  s += `<polygon points="${f1(NW_L[0])},${f1(NW_L[1])} ${f1(NE_L[0])},${f1(NE_L[1])} ${f1(SE_L[0])},${f1(SE_L[1])} ${f1(SW_L[0])},${f1(SW_L[1])}" fill="none" stroke="#404040" stroke-width="${f1(eave_L_w_px)}" opacity="0.55"/>\n`;

  s += `<polygon points="${f1(NW[0])},${f1(NW[1])} ${f1(NE[0])},${f1(NE[1])} ${f1(SE[0])},${f1(SE[1])} ${f1(SW[0])},${f1(SW[1])}" fill="none" stroke="#222" stroke-width="1.0"/>\n`;

  // Legend
  const west_eave_svg_x = T(eave_xw, world_cy)[0];
  const legend_x = x0 + inner_pad + 10;
  const legend_y = y0 + title_h + inner_pad + 90;
  const legend_w = Math.min(370, west_eave_svg_x - legend_x - 20);
  const row_h = 26;
  const eave_L_ch_size2 = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const eave_L_ch_wall = Number(framing.eave_L_channel_wall_mm ?? 3);
  const pp_cfg_leg = (framing.pani_patti as Record<string, unknown>) ?? {};
  const pp_h_in_leg = Number(pp_cfg_leg.height_in ?? 6);
  const pp_thk_mm_leg = Number(pp_cfg_leg.thickness_mm ?? 1.2);

  const legend_rows: Array<[string, string, number, string]> = [
    ["rafter", rafter_stroke, rafter_w,
      `${rafter_size_in[0]}"×${rafter_size_in[1]}"×${rafter_wall_mm} mm HSS RAFTER @ ${rafter_spacing_in}" OC`],
    ["purlin", purlin_stroke, purlin_w,
      `${purlin_size_in[0]}"×${purlin_size_in[1]}"×${purlin_wall_mm} mm HSS PURLIN (flat) @ ${purlin_spacing_in}" OC`],
    ["ridge", ridge_stroke, ridge_w,
      `${ridge_size_in[0]}"×${ridge_size_in[1]}"×${ridge_wall_mm} mm HSS RIDGE / HIP`],
    ["truss", "#8b0000",
      Math.max(inToPx(((truss_cfg.chord_size_in as [number, number]) ?? [2, 4])[0]), 2.2),
      `FINK TRUSS × ${truss_count} — ${((truss_cfg.chord_size_in as [number, number]) ?? [2, 4])[0]}"×${((truss_cfg.chord_size_in as [number, number]) ?? [2, 4])[1]}"×${Number(truss_cfg.chord_wall_mm ?? 3)} mm HSS, ${house_ft[0].toFixed(0)}' span`],
    ["ring_beam", "#1e5aa6",
      Math.max(inToPx(ring_beam_size[0]), 2.0),
      `RING BEAM ${house_ft[0].toFixed(0)}'×${house_ft[1].toFixed(0)}' — ${ring_beam_size[0]}"×${ring_beam_size[1]}"×${ring_beam_wall} mm HSS @ wall top`],
    ["hip_beam", "#8a4a1a",
      Math.max(inToPx(hip_beam_size[0]), 1.8),
      `HIP-END BEAMS × ${hip_beam_total_count} — ${hip_beam_size[0]}"×${hip_beam_size[1]}"×${hip_beam_wall} mm HSS`],
    ["pani", "#4a8fbf", Math.max(inToPx(1.0), 1.8),
      `${pp_h_in_leg.toFixed(0)}" × ${pp_thk_mm_leg} mm GI PANI PATTI (outer eave band)`],
    ["eave", "#404040", Math.max(inToPx(eave_L_ch_size2[0]), 1.8),
      `${eave_L_ch_size2[0]}"×${eave_L_ch_size2[1]}"×${eave_L_ch_wall} mm L-CHANNEL (inboard of Pani Patti)`],
    ["scale", "#666", 0.0,
      `(all widths drawn to scale — 1 pixel ≈ ${(1.0 / (s_scale / IN_PER_UNIT)).toFixed(2)}")`],
  ];
  const n_rows = legend_rows.length;
  const legend_h = 22 + n_rows * row_h + 12;

  s += `<rect x="${f(legend_x)}" y="${f(legend_y)}" width="${fFloat(legend_w)}" height="${f(legend_h)}" fill="#ffffff" fill-opacity="0.92" stroke="#888" stroke-width="1"/>\n`;
  s += `<text x="${f(legend_x + 10)}" y="${f(legend_y + 16)}" font-size="12" font-weight="700" fill="#222">KEY</text>\n`;
  const sample_x1 = legend_x + 10;
  const sample_x2 = sample_x1 + 34;
  const text_x = sample_x2 + 8;
  for (let i = 0; i < legend_rows.length; i++) {
    const [_kind, color, sw, text] = legend_rows[i];
    void _kind;
    const ry = legend_y + 22 + row_h * (i + 0.5) + 4;
    if (sw > 0) {
      s += `<line x1="${f(sample_x1)}" y1="${fFloat(ry - 4)}" x2="${f(sample_x2)}" y2="${fFloat(ry - 4)}" stroke="${color}" stroke-width="${sw}"/>\n`;
    }
    s += `<text x="${f(text_x)}" y="${fFloat(ry)}" text-anchor="start" font-size="12" fill="#222">${text}</text>\n`;
  }

  // Compass rose
  const cx_n = x0 + inner_pad + 30;
  const cy_n = y0 + title_h + inner_pad + 30;
  s += `<line x1="${f(cx_n)}" y1="${f(cy_n + 22)}" x2="${f(cx_n)}" y2="${f(cy_n - 22)}" stroke="#333" stroke-width="1" marker-end="url(#arr)"/>\n`;
  s += `<text x="${f(cx_n)}" y="${f(cy_n - 26)}" text-anchor="middle" font-size="12" font-weight="600" fill="#222">N</text>\n`;

  // Suppress unused warnings
  void house_config; void f2;

  return s;
}
