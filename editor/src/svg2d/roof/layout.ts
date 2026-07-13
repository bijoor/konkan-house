// Layout constants + canvas sizing — port of svg_2d.py lines 4326-4382.

import type { RoofComputed } from "./geometry";

export interface Layout {
  panel_w: number;
  panel_h: number;
  inner_margin: number;
  title_bar_h: number;
  canvas_title_h: number;
  outer_pad: number;
  col_gap: number;
  row_gap: number;
  framing_panel_h: number;
  external_eave_panel_w: number;
  external_eave_panel_h: number;
  materials_panel_h: number;
  consolidated_panel_h: number;
  truss_panel_h: number;
  persp_row_h: number;
  section_h: number;
  top_view_h: number;
  tile_panel_h: number;
  canvas_w: number;
  canvas_h: number;
  scale: number;
  hips_asym: boolean;
}

export function computeLayout(computed: RoofComputed): Layout {
  const panel_w = 850;
  const panel_h = 620;
  const inner_margin = 90;
  const title_bar_h = 46;
  const canvas_title_h = 60;
  const outer_pad = 30;
  const col_gap = 24;
  const row_gap = 24;
  const framing_panel_h = 240;
  const materials_panel_h = 1180;
  const consolidated_panel_h = 460;
  const truss_panel_h = 400;
  const persp_row_h = 620;
  const section_h = (persp_row_h - row_gap) / 2; // 298
  const top_view_h = 1080;
  const tile_panel_h = 890;

  const canvas_w = outer_pad * 2 + 2 * panel_w + col_gap;
  const external_eave_panel_w = canvas_w - 2 * outer_pad;
  const external_eave_panel_h = external_eave_panel_w * (210.0 / 297.0);

  let _asym_extra_h = 0;
  const hips_asym =
    Math.abs(computed.slopes[2].pitch - computed.slopes[3].pitch) > 0.1;
  if (hips_asym) _asym_extra_h = panel_h + row_gap;

  const canvas_h =
    canvas_title_h +
    outer_pad +
    top_view_h +
    row_gap +
    persp_row_h +
    row_gap +
    panel_h +
    row_gap +
    _asym_extra_h +
    framing_panel_h +
    row_gap +
    external_eave_panel_h +
    row_gap +
    truss_panel_h +
    row_gap +
    materials_panel_h +
    row_gap +
    consolidated_panel_h +
    row_gap +
    tile_panel_h +
    outer_pad;

  const max_base = Math.max(...computed.slopes.map((s) => s.base));
  const max_h = Math.max(...computed.slopes.map((s) => s.perp_h));
  const draw_w = panel_w - 2 * inner_margin;
  const draw_h = panel_h - title_bar_h - 2 * inner_margin;
  const scale = Math.min(draw_w / max_base, draw_h / max_h) * 0.95;

  return {
    panel_w,
    panel_h,
    inner_margin,
    title_bar_h,
    canvas_title_h,
    outer_pad,
    col_gap,
    row_gap,
    framing_panel_h,
    external_eave_panel_w,
    external_eave_panel_h,
    materials_panel_h,
    consolidated_panel_h,
    truss_panel_h,
    persp_row_h,
    section_h,
    top_view_h,
    tile_panel_h,
    canvas_w,
    canvas_h,
    scale,
    hips_asym,
  };
}
