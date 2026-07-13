// slope_panel — svg_2d.py lines 4387-4629.
// Emits one panel for a slope (trapezoid or triangle) with rafters, purlins,
// outline, dimensions, angles.

import type { RoofComputed, Slope } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat, f1, f2 } from "./format";

export function slopePanel(
  x0: number,
  y0: number,
  slope: Slope,
  computed: RoofComputed,
  layout: Layout,
): string {
  const { panel_w, panel_h, inner_margin, title_bar_h, scale } = layout;
  const {
    rafter_spacing_u,
    purlin_spacing_u,
    rafter_spacing_in,
    purlin_spacing_in,
  } = computed;

  const base = slope.base;
  const top = slope.top;
  const perp_h = slope.perp_h;
  const slant = slope.slant;
  const pitch = slope.pitch;
  const is_tri = slope.is_tri;

  const base_px = base * scale;
  const top_px = top * scale;
  const perp_h_px = perp_h * scale;

  const area_x = x0 + inner_margin;
  const area_y = y0 + title_bar_h + inner_margin;
  const area_w = panel_w - 2 * inner_margin;
  const area_h = panel_h - title_bar_h - 2 * inner_margin;
  const cx = area_x + area_w / 2;
  const baseline_y = area_y + area_h - (area_h - perp_h_px) / 2;
  const top_y = baseline_y - perp_h_px;

  const bot_left: [number, number] = [cx - base_px / 2, baseline_y];
  const bot_right: [number, number] = [cx + base_px / 2, baseline_y];
  let top_left: [number, number], top_right: [number, number];
  if (is_tri) {
    top_left = [cx, top_y];
    top_right = [cx, top_y];
  } else {
    const _dL = slope.d_hip_left ?? (base - top) / 2.0;
    const _dR = slope.d_hip_right ?? (base - top) / 2.0;
    top_left = [bot_left[0] + _dL * scale, top_y];
    top_right = [bot_right[0] - _dR * scale, top_y];
  }

  let s = "";
  // Panel background + border + title bar
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(panel_w)}" height="${f(panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${f(y0)}" width="${f(panel_w)}" height="${f(title_bar_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + panel_w / 2)}" y="${f(y0 + title_bar_h - 15)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">${slope.title}</text>\n`;

  // Purlins
  function slant_x_at(y_pixels: number, side: string): number {
    if (perp_h_px <= 0) {
      return side === "left" ? bot_left[0] : bot_right[0];
    }
    const frac = (baseline_y - y_pixels) / perp_h_px;
    if (side === "left") {
      return bot_left[0] + (top_left[0] - bot_left[0]) * frac;
    }
    return bot_right[0] + (top_right[0] - bot_right[0]) * frac;
  }
  const n_purlins = Math.trunc(perp_h / purlin_spacing_u);
  for (let i = 1; i <= n_purlins; i++) {
    const y_from_base = Math.min(i * purlin_spacing_u, perp_h);
    const y_p = baseline_y - y_from_base * scale;
    const xl = slant_x_at(y_p, "left");
    const xr = slant_x_at(y_p, "right");
    if (xr - xl <= 0.5) continue;
    s += `<line x1="${f2(xl)}" y1="${f2(y_p)}" x2="${f2(xr)}" y2="${f2(y_p)}" stroke="#4a8fbf" stroke-width="0.7" opacity="0.75"/>\n`;
  }

  // Rafters
  const n_rafters = Math.trunc(base / rafter_spacing_u) + 1;
  const gap = base - (n_rafters - 1) * rafter_spacing_u;
  const first_offset = gap > 0 ? gap / 2.0 : 0.0;
  for (let i = 0; i < n_rafters; i++) {
    const x_from_left = first_offset + i * rafter_spacing_u;
    const x_r = bot_left[0] + x_from_left * scale;
    let y_top: number;
    if (is_tri || top_px <= 0) {
      if (x_r < cx) {
        const frac = cx !== bot_left[0] ? (x_r - bot_left[0]) / (cx - bot_left[0]) : 1;
        y_top = baseline_y - frac * perp_h_px;
      } else if (x_r > cx) {
        const frac = bot_right[0] !== cx ? (bot_right[0] - x_r) / (bot_right[0] - cx) : 1;
        y_top = baseline_y - frac * perp_h_px;
      } else {
        y_top = top_y;
      }
    } else {
      if (top_left[0] <= x_r && x_r <= top_right[0]) {
        y_top = top_y;
      } else if (x_r < top_left[0]) {
        const frac = top_left[0] !== bot_left[0] ? (x_r - bot_left[0]) / (top_left[0] - bot_left[0]) : 1;
        y_top = baseline_y - frac * perp_h_px;
      } else {
        const frac = bot_right[0] !== top_right[0] ? (bot_right[0] - x_r) / (bot_right[0] - top_right[0]) : 1;
        y_top = baseline_y - frac * perp_h_px;
      }
    }
    s += `<line x1="${f2(x_r)}" y1="${f2(baseline_y)}" x2="${f2(x_r)}" y2="${f2(y_top)}" stroke="#666" stroke-width="0.9" opacity="0.9"/>\n`;
  }

  // Slope outline
  let outline = `M ${f2(bot_left[0])} ${f2(baseline_y)} L ${f2(bot_right[0])} ${f2(baseline_y)} L ${f2(top_right[0])} ${f2(top_y)} `;
  if (!is_tri) outline += `L ${f2(top_left[0])} ${f2(top_y)} `;
  outline += "Z";
  s += `<path d="${outline}" fill="none" stroke="#8B4513" stroke-width="3"/>\n`;

  // Dimension lines
  const dim_y = baseline_y + 42;
  s += `<line x1="${fFloat(bot_left[0])}" y1="${fFloat(baseline_y)}" x2="${fFloat(bot_left[0])}" y2="${fFloat(dim_y + 8)}" stroke="#0066cc" stroke-width="0.6"/>\n`;
  s += `<line x1="${fFloat(bot_right[0])}" y1="${fFloat(baseline_y)}" x2="${fFloat(bot_right[0])}" y2="${fFloat(dim_y + 8)}" stroke="#0066cc" stroke-width="0.6"/>\n`;
  s += `<line x1="${fFloat(bot_left[0])}" y1="${fFloat(dim_y)}" x2="${fFloat(bot_right[0])}" y2="${fFloat(dim_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${fFloat(cx)}" y="${fFloat(dim_y - 6)}" text-anchor="middle" font-size="12" fill="#0066cc">eave = ${formatDimension(base)}</text>\n`;

  if (!is_tri && top > 0) {
    const tdim_y = top_y - 24;
    s += `<line x1="${fFloat(top_left[0])}" y1="${fFloat(top_y)}" x2="${fFloat(top_left[0])}" y2="${fFloat(tdim_y - 8)}" stroke="#0066cc" stroke-width="0.6"/>\n`;
    s += `<line x1="${fFloat(top_right[0])}" y1="${fFloat(top_y)}" x2="${fFloat(top_right[0])}" y2="${fFloat(tdim_y - 8)}" stroke="#0066cc" stroke-width="0.6"/>\n`;
    s += `<line x1="${fFloat(top_left[0])}" y1="${fFloat(tdim_y)}" x2="${fFloat(top_right[0])}" y2="${fFloat(tdim_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
    s += `<text x="${fFloat(cx)}" y="${fFloat(tdim_y - 6)}" text-anchor="middle" font-size="12" fill="#0066cc">ridge = ${formatDimension(top)}</text>\n`;
  }

  // Perp height dim
  const h_dim_x = bot_right[0] + 32;
  s += `<line x1="${fFloat(bot_right[0])}" y1="${fFloat(baseline_y)}" x2="${fFloat(h_dim_x + 8)}" y2="${fFloat(baseline_y)}" stroke="#0066cc" stroke-width="0.6" stroke-dasharray="3,3"/>\n`;
  s += `<line x1="${fFloat(top_right[0])}" y1="${fFloat(top_y)}" x2="${fFloat(h_dim_x + 8)}" y2="${fFloat(top_y)}" stroke="#0066cc" stroke-width="0.6" stroke-dasharray="3,3"/>\n`;
  s += `<line x1="${fFloat(h_dim_x)}" y1="${fFloat(baseline_y)}" x2="${fFloat(h_dim_x)}" y2="${fFloat(top_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${fFloat(h_dim_x + 6)}" y="${fFloat((baseline_y + top_y) / 2)}" text-anchor="start" font-size="11" fill="#0066cc">height = ${formatDimension(perp_h)}</text>\n`;

  const mid_slant_x = (bot_left[0] + top_left[0]) / 2 - 8;
  const mid_slant_y = (baseline_y + top_y) / 2;
  s += `<text x="${fFloat(mid_slant_x)}" y="${fFloat(mid_slant_y)}" text-anchor="end" font-size="10" fill="#555">hip = ${formatDimension(slant)}</text>\n`;

  // Interior corner angles
  let base_corner_deg_L: number, base_corner_deg_R: number;
  let top_corner_deg_L: number, top_corner_deg_R: number;
  let apex_deg: number;
  if (perp_h > 0) {
    if (is_tri) {
      const base_corner_deg = (Math.atan(perp_h / (base / 2.0)) * 180) / Math.PI;
      apex_deg = 180.0 - 2.0 * base_corner_deg;
      base_corner_deg_L = base_corner_deg_R = base_corner_deg;
      top_corner_deg_L = top_corner_deg_R = 0.0;
    } else {
      const _dL = slope.d_hip_left ?? (base - top) / 2.0;
      const _dR = slope.d_hip_right ?? (base - top) / 2.0;
      base_corner_deg_L = _dL > 0 ? (Math.atan(perp_h / _dL) * 180) / Math.PI : 90.0;
      base_corner_deg_R = _dR > 0 ? (Math.atan(perp_h / _dR) * 180) / Math.PI : 90.0;
      top_corner_deg_L = 180.0 - base_corner_deg_L;
      top_corner_deg_R = 180.0 - base_corner_deg_R;
      apex_deg = 0.0;
    }
  } else {
    base_corner_deg_L = base_corner_deg_R = 0.0;
    top_corner_deg_L = top_corner_deg_R = 0.0;
    apex_deg = 0.0;
  }

  s += `<text x="${fFloat(bot_left[0] + 8)}" y="${fFloat(baseline_y - 6)}" text-anchor="start" font-size="11" fill="#333">${f1(base_corner_deg_L)}°</text>\n`;
  s += `<text x="${fFloat(bot_right[0] - 8)}" y="${fFloat(baseline_y - 6)}" text-anchor="end" font-size="11" fill="#333">${f1(base_corner_deg_R)}°</text>\n`;
  if (is_tri) {
    s += `<text x="${fFloat(top_left[0])}" y="${fFloat(top_y + 15)}" text-anchor="middle" font-size="11" fill="#333">${f1(apex_deg)}°</text>\n`;
  } else {
    s += `<text x="${fFloat(top_left[0] + 6)}" y="${fFloat(top_y + 14)}" text-anchor="start" font-size="11" fill="#333">${f1(top_corner_deg_L)}°</text>\n`;
    s += `<text x="${fFloat(top_right[0] - 6)}" y="${fFloat(top_y + 14)}" text-anchor="end" font-size="11" fill="#333">${f1(top_corner_deg_R)}°</text>\n`;
  }

  const pitch_label_y = y0 + title_bar_h + 20;
  s += `<text x="${fFloat(cx)}" y="${f(pitch_label_y)}" text-anchor="middle" font-size="15" font-weight="600" fill="#8B4513">ROOF PITCH: ${f1(pitch)}°</text>\n`;

  let face_area_sft: number;
  if (is_tri) {
    face_area_sft = (0.5 * base * perp_h) / 100.0;
  } else {
    face_area_sft = (0.5 * (base + top) * perp_h) / 100.0;
  }
  s += `<text x="${fFloat(cx)}" y="${f(pitch_label_y + 18)}" text-anchor="middle" font-size="13" fill="#333">AREA: ${face_area_sft.toFixed(0)} sft per face   (× 2 = ${(face_area_sft * 2).toFixed(0)} sft)</text>\n`;

  const note_x = x0 + panel_w - 10;
  const note_y = y0 + title_bar_h + 20;
  s += `<text x="${f(note_x)}" y="${f(note_y)}" text-anchor="end" font-size="11" fill="#333">${n_rafters} rafters @ ${rafter_spacing_in}" OC</text>\n`;
  s += `<text x="${f(note_x)}" y="${f(note_y + 15)}" text-anchor="end" font-size="11" fill="#333">${n_purlins} purlins @ ${purlin_spacing_in}" OC</text>\n`;

  return s;
}
