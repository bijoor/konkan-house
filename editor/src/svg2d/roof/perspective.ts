// perspective_panel — svg_2d.py lines 7171-7543.
import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { f, fFloat, f0, f1 } from "./format";
import { DEFAULT_GLOBAL_CONFIG } from "../config";
import { pillarCenter, type PillarLike } from "../pillar/extents";

type Pt3 = [number, number, number];

export function perspectivePanel(
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
    h,
    truss_count,
    truss_y_positions,
    ring_beam_size,
    wall_inset_trans,
    wall_inset_long_n,
    wall_inset_long_s,
    hip_beam_count_per_end,
    hip_beam_between_trusses,
    hip_beam_total_count,
    wall_top_u,
    ridge_depth_u,
    house_ft,
  } = computed;
  void ring_beam_size;
  const title_h = 40;
  const inner_pad = 30;
  const cos30 = Math.cos((30 * Math.PI) / 180);
  const sin30 = Math.sin((30 * Math.PI) / 180);
  const eave_z_ref = Number(roof.eave_z ?? 0);
  const r_z = eave_z_ref + h;
  const wall_top_z = eave_z_ref + wall_top_u;

  let r_x = 0, r_y1 = 0, r_y2 = 0, r_y = 0, r_x1 = 0, r_x2 = 0;
  let rb_xw: number, rb_xe: number, rb_yn: number, rb_ys: number;
  let R1: Pt3, R2: Pt3;
  if (ridge_axis === "y") {
    r_x = (eave_xw + eave_xe) / 2.0;
    r_y1 = eave_yn + d_hip_n;
    r_y2 = eave_ys - d_hip_s;
    R1 = [r_x, r_y1, r_z];
    R2 = [r_x, r_y2, r_z];
    rb_xw = eave_xw + wall_inset_trans;
    rb_xe = eave_xe - wall_inset_trans;
    rb_yn = eave_yn + wall_inset_long_n;
    rb_ys = eave_ys - wall_inset_long_s;
  } else {
    r_y = (eave_yn + eave_ys) / 2.0;
    r_x1 = eave_xw + d_hip_w;
    r_x2 = eave_xe - d_hip_e;
    R1 = [r_x1, r_y, r_z];
    R2 = [r_x2, r_y, r_z];
    rb_xw = eave_xw + wall_inset_long_n;
    rb_xe = eave_xe - wall_inset_long_s;
    rb_yn = eave_yn + wall_inset_trans;
    rb_ys = eave_ys - wall_inset_trans;
  }

  function iso(pt: Pt3): [number, number] {
    const [px, py, pz] = pt;
    return [(px - py) * cos30, pz - (px + py) * sin30];
  }
  const wall_bot_z = eave_z_ref - 40;
  const anchor_pts: [number, number][] = [
    iso([eave_xw, eave_yn, eave_z_ref]),
    iso([eave_xe, eave_yn, eave_z_ref]),
    iso([eave_xe, eave_ys, eave_z_ref]),
    iso([eave_xw, eave_ys, eave_z_ref]),
    iso(R1),
    iso(R2),
    iso([rb_xw, rb_yn, wall_top_z]),
    iso([rb_xe, rb_yn, wall_top_z]),
    iso([rb_xe, rb_ys, wall_top_z]),
    iso([rb_xw, rb_ys, wall_top_z]),
    iso([rb_xw, rb_yn, wall_bot_z]),
    iso([rb_xe, rb_yn, wall_bot_z]),
    iso([rb_xe, rb_ys, wall_bot_z]),
    iso([rb_xw, rb_ys, wall_bot_z]),
  ];
  const xs = anchor_pts.map((v) => v[0]);
  const ys = anchor_pts.map((v) => v[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  const world_w = Math.max(maxx - minx, 1);
  const world_h = Math.max(maxy - miny, 1);
  const draw_w = w_p - 2 * inner_pad;
  const draw_h = h_p - title_h - 2 * inner_pad;
  const ps = Math.min(draw_w / world_w, draw_h / world_h) * 0.88;
  const tx = x0 + w_p / 2 - ((minx + maxx) / 2) * ps;
  const ty = y0 + title_h + (h_p - title_h) / 2 + ((miny + maxy) / 2) * ps;

  function toSvgPt(pt3d: Pt3): [number, number] {
    const [vx, vy] = iso(pt3d);
    return [tx + vx * ps, ty - vy * ps];
  }
  function drawLine(a3: Pt3, b3: Pt3, stroke: string, stroke_w: number, opacity = 1.0, dash: string | null = null): string {
    const a = toSvgPt(a3);
    const b = toSvgPt(b3);
    const extra = dash ? ` stroke-dasharray="${dash}"` : "";
    return `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${stroke}" stroke-width="${fFloat(stroke_w)}" opacity="${fFloat(opacity)}"${extra}/>\n`;
  }
  function drawDot(pt3d: Pt3, r: number, fill: string): string {
    const a = toSvgPt(pt3d);
    return `<circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="${fFloat(r)}" fill="${fill}"/>\n`;
  }

  let s = "";
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w_p)}" height="${f(h_p)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w_p)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + w_p / 2)}" y="${f(y0 + title_h - 13)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">PERSPECTIVE — Structural frame (isometric)</text>\n`;

  const eave_corners: Pt3[] = [
    [eave_xw, eave_yn, eave_z_ref],
    [eave_xe, eave_yn, eave_z_ref],
    [eave_xe, eave_ys, eave_z_ref],
    [eave_xw, eave_ys, eave_z_ref],
  ];
  for (let i = 0; i < 4; i++) {
    s += drawLine(eave_corners[i], eave_corners[(i + 1) % 4], "#b48a5a", 0.8, 0.55, "4,3");
  }
  s += drawLine(R1, R2, "#a17545", 1.0, 0.7);
  let hip_pairs: Array<[Pt3, Pt3]>;
  if (ridge_axis === "y") {
    hip_pairs = [[R1, eave_corners[0]], [R1, eave_corners[1]], [R2, eave_corners[2]], [R2, eave_corners[3]]];
  } else {
    hip_pairs = [[R1, eave_corners[0]], [R1, eave_corners[3]], [R2, eave_corners[1]], [R2, eave_corners[2]]];
  }
  for (const [a, b] of hip_pairs) s += drawLine(a, b, "#a17545", 0.8, 0.55, "4,3");

  // Walls
  const wall_stroke = "#8a7f6d";
  const wall_fill = "#e5dfd2";
  const wall_quads: Array<[Pt3, Pt3, Pt3, Pt3, string]> = [
    [[rb_xw, rb_yn, wall_bot_z], [rb_xe, rb_yn, wall_bot_z], [rb_xe, rb_yn, wall_top_z], [rb_xw, rb_yn, wall_top_z], "N"],
    [[rb_xw, rb_ys, wall_bot_z], [rb_xe, rb_ys, wall_bot_z], [rb_xe, rb_ys, wall_top_z], [rb_xw, rb_ys, wall_top_z], "S"],
    [[rb_xw, rb_yn, wall_bot_z], [rb_xw, rb_ys, wall_bot_z], [rb_xw, rb_ys, wall_top_z], [rb_xw, rb_yn, wall_top_z], "W"],
    [[rb_xe, rb_yn, wall_bot_z], [rb_xe, rb_ys, wall_bot_z], [rb_xe, rb_ys, wall_top_z], [rb_xe, rb_yn, wall_top_z], "E"],
  ];
  function avgSvgY(pts: Pt3[]): number {
    return pts.reduce((s, p) => s + toSvgPt(p)[1], 0) / pts.length;
  }
  const sorted = [...wall_quads].sort((a, b) => avgSvgY([a[0], a[1], a[2], a[3]]) - avgSvgY([b[0], b[1], b[2], b[3]]));
  for (const quad of sorted) {
    const pts = [quad[0], quad[1], quad[2], quad[3]];
    const pts_str = pts.map((p) => {
      const [px, py] = toSvgPt(p);
      return `${f1(px)},${f1(py)}`;
    }).join(" ");
    s += `<polygon points="${pts_str}" fill="${wall_fill}" fill-opacity="0.55" stroke="${wall_stroke}" stroke-width="0.9" stroke-linejoin="round"/>\n`;
  }

  // Pillars
  const pillar_stroke = "#3f2f1a";
  const pillar_fill = "#7a6244";
  const pillar_positions_set = new Set<string>();
  const pillar_positions: [number, number][] = [];
  // Pillars store x,y as the TOP-LEFT CORNER; this view marks each pillar's
  // center, so convert corner→center using the resolved footprint.
  const pillarWT =
    (house_config as { defaults?: { wall_thickness?: number } }).defaults?.wall_thickness ??
    DEFAULT_GLOBAL_CONFIG.wall_thickness ??
    8;
  for (const floor of house_config.floors ?? []) {
    for (const obj of (floor.objects ?? []) as Record<string, unknown>[]) {
      if (obj.type === "pillar") {
        const { cx: px, cy: py } = pillarCenter(obj as unknown as PillarLike, pillarWT);
        const key = `${px},${py}`;
        if (!pillar_positions_set.has(key)) {
          pillar_positions_set.add(key);
          pillar_positions.push([px, py]);
        }
      }
    }
  }
  // Python's sorted(set of tuples) sorts lexicographically
  pillar_positions.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [_px, _py] of pillar_positions) {
    const _wx = rb_xw + _px;
    const _wy = rb_yn + _py;
    if (!(rb_xw <= _wx && _wx <= rb_xe && rb_yn <= _wy && _wy <= rb_ys)) continue;
    const _bot: Pt3 = [_wx, _wy, wall_bot_z];
    const _top: Pt3 = [_wx, _wy, wall_top_z + 4];
    s += drawLine(_bot, _top, pillar_stroke, 2.0, 0.95);
    const _rb_pt = toSvgPt([_wx, _wy, wall_top_z]);
    s += `<circle cx="${f1(_rb_pt[0])}" cy="${f1(_rb_pt[1])}" r="2.4" fill="${pillar_fill}" stroke="${pillar_stroke}" stroke-width="0.7"/>\n`;
  }

  // Ring beam
  const rb_corners: Pt3[] = [
    [rb_xw, rb_yn, wall_top_z],
    [rb_xe, rb_yn, wall_top_z],
    [rb_xe, rb_ys, wall_top_z],
    [rb_xw, rb_ys, wall_top_z],
  ];
  const ring_stroke = "#1e5aa6";
  for (let i = 0; i < 4; i++) {
    s += drawLine(rb_corners[i], rb_corners[(i + 1) % 4], ring_stroke, 2.4, 0.95);
  }

  // Hip-end beams
  const hip_beam_stroke = "#8a4a1a";
  if (truss_count >= 2 && ridge_axis === "y") {
    for (let i = 0; i < hip_beam_count_per_end; i++) {
      const _frac = (i + 1) / (hip_beam_count_per_end + 1);
      const bx_world = rb_xw + _frac * (rb_xe - rb_xw);
      s += drawLine([bx_world, truss_y_positions[0], wall_top_z], [bx_world, rb_yn, wall_top_z], hip_beam_stroke, 1.6);
      s += drawLine([bx_world, truss_y_positions[truss_y_positions.length - 1], wall_top_z], [bx_world, rb_ys, wall_top_z], hip_beam_stroke, 1.6);
      if (hip_beam_between_trusses) {
        for (let _j = 0; _j < truss_y_positions.length - 1; _j++) {
          s += drawLine(
            [bx_world, truss_y_positions[_j], wall_top_z],
            [bx_world, truss_y_positions[_j + 1], wall_top_z],
            hip_beam_stroke, 1.6);
        }
      }
    }
  }

  const hip_ridge_stroke = "#6b4423";
  const vent_ext_u = Number(roof.ridge_ext_u ?? 0.0);
  const has_vent = vent_ext_u > 0;
  let R1_ext: Pt3, R2_ext: Pt3;
  if (has_vent && ridge_axis === "y") {
    R1_ext = [r_x, r_y1 - vent_ext_u, r_z];
    R2_ext = [r_x, r_y2 + vent_ext_u, r_z];
  } else if (has_vent) {
    R1_ext = [r_x1 - vent_ext_u, r_y, r_z];
    R2_ext = [r_x2 + vent_ext_u, r_y, r_z];
  } else {
    R1_ext = R1;
    R2_ext = R2;
  }
  s += drawLine(R1_ext, R2_ext, hip_ridge_stroke, 2.0, 0.95);
  let hip_ridge_pairs: Array<[Pt3, Pt3]>;
  if (ridge_axis === "y") {
    hip_ridge_pairs = [[R1, eave_corners[0]], [R1, eave_corners[1]], [R2, eave_corners[2]], [R2, eave_corners[3]]];
  } else {
    hip_ridge_pairs = [[R1, eave_corners[0]], [R1, eave_corners[3]], [R2, eave_corners[1]], [R2, eave_corners[2]]];
  }
  for (const [_a, _b] of hip_ridge_pairs) s += drawLine(_a, _b, hip_ridge_stroke, 2.0, 0.95);

  if (has_vent) {
    function pt3Along(a: Pt3, b: Pt3, dist: number): Pt3 {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length <= 0) return a;
      const t = dist / length;
      return [a[0] + t * dx, a[1] + t * dy, a[2] + t * dz];
    }
    let strut_pairs: Array<[Pt3, Pt3]>;
    if (ridge_axis === "y") {
      strut_pairs = [
        [R1_ext, pt3Along(R1, eave_corners[0], vent_ext_u)],
        [R1_ext, pt3Along(R1, eave_corners[1], vent_ext_u)],
        [R2_ext, pt3Along(R2, eave_corners[2], vent_ext_u)],
        [R2_ext, pt3Along(R2, eave_corners[3], vent_ext_u)],
      ];
    } else {
      strut_pairs = [
        [R1_ext, pt3Along(R1, eave_corners[0], vent_ext_u)],
        [R1_ext, pt3Along(R1, eave_corners[3], vent_ext_u)],
        [R2_ext, pt3Along(R2, eave_corners[1], vent_ext_u)],
        [R2_ext, pt3Along(R2, eave_corners[2], vent_ext_u)],
      ];
    }
    const strut_stroke = "#6b4423";
    for (const [_a, _b] of strut_pairs) {
      s += drawLine(_a, _b, strut_stroke, 1.4, 0.9, "5,3");
    }
  }

  // Trusses
  const truss_stroke = "#8b0000";
  const web_stroke = "#c25050";
  const truss_peak_z = r_z - ridge_depth_u;
  if (truss_count > 0 && ridge_axis === "y") {
    const ridge_x_p = (eave_xw + eave_xe) / 2.0;
    for (let i = 0; i < truss_y_positions.length; i++) {
      const ty_pos = truss_y_positions[i];
      const B0: Pt3 = [rb_xw, ty_pos, wall_top_z];
      const B4: Pt3 = [rb_xe, ty_pos, wall_top_z];
      const B1: Pt3 = [rb_xw + 0.25 * (rb_xe - rb_xw), ty_pos, wall_top_z];
      const B2: Pt3 = [ridge_x_p, ty_pos, wall_top_z];
      const B3: Pt3 = [rb_xw + 0.75 * (rb_xe - rb_xw), ty_pos, wall_top_z];
      const Tpk: Pt3 = [ridge_x_p, ty_pos, truss_peak_z];
      const T1: Pt3 = [rb_xw + 0.25 * (rb_xe - rb_xw), ty_pos, (wall_top_z + truss_peak_z) / 2];
      const T3: Pt3 = [rb_xw + 0.75 * (rb_xe - rb_xw), ty_pos, (wall_top_z + truss_peak_z) / 2];
      s += drawLine(B0, Tpk, truss_stroke, 2.4);
      s += drawLine(Tpk, B4, truss_stroke, 2.4);
      s += drawLine(B0, B4, truss_stroke, 2.4);
      for (const [a, b] of [[Tpk, B2], [Tpk, B1], [Tpk, B3], [T1, B1], [T3, B3]] as Array<[Pt3, Pt3]>) {
        s += drawLine(a, b, web_stroke, 1.2);
      }
      for (const jp of [B0, B1, B2, B3, B4, T1, Tpk, T3]) {
        s += drawDot(jp, 2.0, truss_stroke);
      }
      const pk_svg = toSvgPt(Tpk);
      s += `<circle cx="${f1(pk_svg[0])}" cy="${f1(pk_svg[1])}" r="9" fill="white" stroke="${truss_stroke}" stroke-width="1.2"/>\n`;
      s += `<text x="${f1(pk_svg[0])}" y="${f1(pk_svg[1] + 4)}" text-anchor="middle" font-size="10" font-weight="700" fill="${truss_stroke}">T${i + 1}</text>\n`;
    }
  }

  // Compass labels
  const eave_pairs: Array<[string, Pt3, Pt3]> = [
    ["N", eave_corners[0], eave_corners[1]],
    ["S", eave_corners[2], eave_corners[3]],
    ["W", eave_corners[3], eave_corners[0]],
    ["E", eave_corners[1], eave_corners[2]],
  ];
  for (const [label, a, b] of eave_pairs) {
    const ap = toSvgPt(a);
    const bp = toSvgPt(b);
    const mx = (ap[0] + bp[0]) / 2;
    const my = (ap[1] + bp[1]) / 2 + 15;
    s += `<text x="${f1(mx)}" y="${f1(my)}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${label}</text>\n`;
  }

  // Legend
  const lg_x = x0 + inner_pad;
  const lg_y = y0 + title_h + inner_pad;
  s += `<text x="${f(lg_x)}" y="${f(lg_y)}" font-size="11" font-weight="600" fill="${truss_stroke}">■ Fink truss × ${truss_count}</text>\n`;
  s += `<text x="${f(lg_x)}" y="${f(lg_y + 16)}" font-size="11" font-weight="600" fill="${ring_stroke}">■ Ring beam (${f0(house_ft[0])}' × ${f0(house_ft[1])}')</text>\n`;
  s += `<text x="${f(lg_x)}" y="${f(lg_y + 32)}" font-size="11" font-weight="600" fill="${hip_beam_stroke}">■ Hip-end beams × ${hip_beam_total_count}</text>\n`;
  s += `<text x="${f(lg_x)}" y="${f(lg_y + 48)}" font-size="11" font-weight="600" fill="${hip_ridge_stroke}">■ Ridges × 5 (1 central + 4 hip)</text>\n`;
  s += `<text x="${f(lg_x)}" y="${f(lg_y + 64)}" font-size="11" font-weight="600" fill="${wall_stroke}">■ House walls (4)</text>\n`;
  s += `<text x="${f(lg_x)}" y="${f(lg_y + 80)}" font-size="11" font-weight="600" fill="${pillar_stroke}">■ Pillars × ${pillar_positions_set.size}</text>\n`;
  s += `<text x="${f(lg_x)}" y="${f(lg_y + 96)}" font-size="10" fill="#666">(roof shell dashed for context)</text>\n`;

  return s;
}
