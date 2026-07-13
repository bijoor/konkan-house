// tile_panel — svg_2d.py lines 6399-6605.
import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat, f0 } from "./format";

// Python's `f'{v:,}'` for int (comma thousands separator)
function commaInt(n: number): string {
  return n.toLocaleString("en-US");
}
// Python's `f'{v:,.2f}'`
function commaF2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function tilePanel(
  x0: number,
  y0: number,
  computed: RoofComputed,
  layout: Layout,
  y0IsFloat = false,
): string {
  const fY0 = (n: number) => (y0IsFloat ? fFloat(n) : f(n));
  const {
    slopes,
    slope_areas_sft,
    total_roof_area_sft,
    waste_pct,
    area_with_waste_sft,
    procured,
    subtotal,
    delivery,
    igst_rate,
    igst,
    grand_total,
    total_ridge_run_ft,
    indicotto_need,
    ceiling_need,
    ridge_need,
    indicotto_delta,
    indicotto_short,
    ceiling_delta,
    ceiling_short,
    ridge_delta,
    ridge_short,
    central_ridge_total,
    hip_slant,
  } = computed;
  const { canvas_w, outer_pad, tile_panel_h } = layout;
  const panel_full_w = canvas_w - 2 * outer_pad;
  const title_h = 40;
  let s = "";
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(tile_panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${fY0(y0)}" width="${f(panel_full_w)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<text x="${fFloat(x0 + panel_full_w / 2)}" y="${fY0(y0 + title_h - 12)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">TILE ROOFING — Procured (Nuvocotto Invoice #12, 27-Apr-2026)</text>\n`;

  const area_x = x0 + 40;
  let area_y = y0 + title_h + 30;
  s += `<text x="${f(area_x)}" y="${fY0(area_y)}" font-size="14" font-weight="600" fill="#222">Roof surface area (measured on the slope face)</text>\n`;
  area_y += 22;
  const main_sl = slopes[0];
  const hip_sl = slopes[2];
  const area_lines = [
    `   Main slope (trapezoid): ½·(${formatDimension(main_sl.base)} + ${formatDimension(main_sl.top)})·${formatDimension(main_sl.perp_h)} = ${f0(slope_areas_sft[main_sl.code])} sft × 2 faces = ${f0(slope_areas_sft[main_sl.code] * 2)} sft`,
    `   Hip end   (triangle):  ½·${formatDimension(hip_sl.base)}·${formatDimension(hip_sl.perp_h)} = ${f0(slope_areas_sft[hip_sl.code])} sft × 2 faces = ${f0(slope_areas_sft[hip_sl.code] * 2)} sft`,
  ];
  for (const line of area_lines) {
    s += `<text x="${f(area_x)}" y="${fY0(area_y)}" font-size="12" fill="#333">${line}</text>\n`;
    area_y += 16;
  }
  area_y += 4;
  s += `<text x="${f(area_x)}" y="${fY0(area_y)}" font-size="12" font-weight="600" fill="#222">   Total roof surface = ${f0(total_roof_area_sft)} sft   |   with ${Math.trunc(waste_pct * 100)}% waste allowance = ${f0(area_with_waste_sft)} sft</text>\n`;

  let table_y = y0 + title_h + 200;
  const row_h = 22;
  const col_x: Record<string, number> = { name: 40, size: 310, qty: 460, rate: 550, amount: 660, note: 800 };
  s += `<text x="${f(x0 + col_x.name)}" y="${fY0(table_y)}" font-size="14" font-weight="600" fill="#222">Items procured — for the contractor to reconcile against site delivery</text>\n`;
  table_y += 22;
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(table_y)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(table_y)}" stroke="#333" stroke-width="1"/>\n`;
  const header_y = table_y + 16;
  const headers: Array<[string, string]> = [
    ["Item", "name"],
    ["Tile size", "size"],
    ["Qty (Nos)", "qty"],
    ["Rate (₹)", "rate"],
    ["Amount (₹)", "amount"],
    ["Notes", "note"],
  ];
  for (const [label, key] of headers) {
    s += `<text x="${f(x0 + col_x[key])}" y="${fY0(header_y)}" font-size="12" font-weight="600" fill="#222">${label}</text>\n`;
  }
  s += `<line x1="${f(x0 + 30)}" y1="${fY0(table_y + row_h)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(table_y + row_h)}" stroke="#333" stroke-width="1"/>\n`;

  let row_y = table_y + row_h + 16;
  for (const p of procured) {
    const amount = p.qty * p.rate;
    const cells: Array<[string, string]> = [
      [p.name, "name"],
      [p.size, "size"],
      [commaInt(p.qty), "qty"],
      [p.rate.toFixed(2), "rate"],
      [commaF2(amount), "amount"],
      [p.note, "note"],
    ];
    for (const [val, key] of cells) {
      s += `<text x="${f(x0 + col_x[key])}" y="${fY0(row_y)}" font-size="12" fill="#333">${val}</text>\n`;
    }
    row_y += row_h;
  }

  s += `<line x1="${f(x0 + 30)}" y1="${fY0(row_y - 6)}" x2="${f(x0 + panel_full_w - 30)}" y2="${fY0(row_y - 6)}" stroke="#333" stroke-width="1"/>\n`;
  row_y += 6;
  const totals_rows: Array<[string, string]> = [
    ["Sub-total (8,962 items):", commaF2(subtotal)],
    ["Delivery charges:", commaF2(delivery)],
    ["IGST @ 12%:", commaF2(igst)],
    ["GRAND TOTAL:", commaF2(grand_total)],
  ];
  for (const [label, amt] of totals_rows) {
    const bold = label.startsWith("GRAND") ? 'font-weight="600"' : "";
    s += `<text x="${f(x0 + col_x.rate)}" y="${fY0(row_y)}" font-size="12" fill="#333" ${bold}>${label}</text>\n`;
    s += `<text x="${f(x0 + col_x.note - 30)}" y="${fY0(row_y)}" font-size="12" fill="#333" text-anchor="end" ${bold}>₹ ${amt}</text>\n`;
    row_y += 18;
  }

  // Notes
  let note_y = row_y + 14;
  s += `<text x="${f(x0 + 40)}" y="${fY0(note_y)}" font-size="14" font-weight="600" fill="#222">Design cross-check &amp; contractor notes</text>\n`;
  note_y += 20;
  const line_gap = 15;

  const ridge_short_ft = Math.max(0, ridge_need - procured[2].qty);
  const extra_ridge_cost = ridge_short_ft * procured[2].rate;
  const extra_ridge_total = extra_ridge_cost * (1 + igst_rate);

  const left_notes: Array<[string, boolean]> = [
    ["ASSUMPTIONS (per Quote #92-2585, 15-Apr-2026):", true],
    ["• Indicotto rooftile: 16\" × 10\" (406 × 254 mm), 1.33 tiles/sft.", false],
    ["  16\" tile − 4\" (100 mm) overlap = 12\" purlin OC.", false],
    ["• Ceiling Tile 12×8 (Nutical Plain): 12\" × 8\" (305 × 203 mm),", false],
    ["  1.5 tiles/sft. 12\" dim spans purlin-centre to purlin-centre.", false],
    ["• Ridge tiles: sold per 1 running foot of ridge.", false],
    ["", false],
    [`• Indicotto: ${f0(total_roof_area_sft)} sft × 1.33 × 10% waste = ${commaInt(indicotto_need)}. Ordered 4,150 → ${indicotto_delta}.`, indicotto_short],
    [`• Ceiling: ${f0(total_roof_area_sft)} sft × 1.5 × 10% waste = ${commaInt(ceiling_need)}. Ordered 4,700 → ${ceiling_delta}.`, ceiling_short],
    [`• Ridge: ${formatDimension(central_ridge_total)} central + 4 × ${formatDimension(hip_slant)} hips = ${f0(total_ridge_run_ft)} ft;`, false],
    [`   +10% waste = ${ridge_need} ft. Ordered 100 ft → ${ridge_delta}.`, ridge_short],
    ["", false],
    [`ACTION — order ${ridge_short_ft} additional running feet of ridge cap:`, true],
    [`   ${ridge_short_ft} × ₹${procured[2].rate.toFixed(2)} = ₹${commaF2(extra_ridge_cost)};  with 12% IGST ≈ ₹${commaF2(extra_ridge_total)}.`, true],
    ["", false],
    ["• Order was originally sized for the earlier two-face gable design,", false],
    ["  which had a longer central ridge but no hip ridges. Moving to hip", false],
    ["  shortened the central ridge (55'→15') but added 4 hip ridges of", false],
    ["  ~26' each. The 100 ft order is short by that delta.", false],
    [`• Tile margins (${indicotto_delta}, ${ceiling_delta}) also stem from the`, false],
    ["  earlier larger gable surface. Confirm with contractor whether the", false],
    ["  surplus is for outbuildings or should be treated as excess.", false],
  ];

  const right_notes: Array<[string, boolean]> = [
    ["CONSTRUCTION DETAILS (per Santosh Roofing video):", true],
    ["• RIDGE: sealed with Top Flex UV tape, then ridge tiles laid without", false],
    ["  cement mortar — the sealed tape holds them and stays watertight.", false],
    ["• VALLEY: 3\" gap held between the two tile fields (straight-line cut).", false],
    ["  Metal strip + cement seal the gap and channel water down; paint to match.", false],
    ["• BARGE: sealed with cement mortar for clean, waterproof edges.", false],
    ["• WALL JUNCTIONS: self-adhesive easy-flash ~5\" up the wall and 5\" onto", false],
    ["  the tile; silicone bead along the top edge of the flashing.", false],
    ["  Silicone at every gap around pipe penetrations.", false],
    ["• WATER CHANNELS: brackets sit in the gap above the Pani Patti, PVC", false],
    ["  channels drop into the brackets, downpipe carries water to ground.", false],
    ["", false],
    ["SITE RULES:", true],
    ["• NEVER step between two ceiling tiles — the tile has low strength on", false],
    ["  its own and will crack; step only where a purlin is underneath.", false],
    ["• Check every ceiling tile for cracks BEFORE the membrane goes on —", false],
    ["  a broken tile is hard to reach once membrane + top tile are down.", false],
    ["• Anchor bolts embedded 6–8\" into footing; deeper footing = more stability.", false],
    ["• Column base plate welded onto the projecting rebar (2\" projection)", false],
    ["  for a permanent, non-pull-out joint.", false],
    ["• Flood-test the whole roof at the end for leaks. Do NOT walk on wet", false],
    ["  tiles — they are extremely slippery when wet.", false],
    ["", false],
    [`• Roof pitch: main slopes ${slopes[0].pitch.toFixed(1)}°, hip ends ${slopes[2].pitch.toFixed(1)}° (both above 20° min).`, false],
    ["• Hip-end pitch is shallow for Konkan monsoon intensity. Give flashing", false],
    ["  and underlay at the four hip ridges extra attention.", false],
  ];

  const left_x = x0 + 40;
  const right_x = x0 + 40 + (canvas_w - 2 * outer_pad) / 2;
  let left_y = note_y;
  let right_y = note_y;
  for (const [text, bold] of left_notes) {
    const weight = bold ? ` font-weight="600"` : "";
    const color = bold ? "#b00" : "#333";
    s += `<text x="${f(left_x)}" y="${fY0(left_y)}" font-size="12" fill="${color}"${weight}>${text}</text>\n`;
    left_y += line_gap;
  }
  for (const [text, bold] of right_notes) {
    const weight = bold ? ` font-weight="600"` : "";
    const color = bold ? "#b00" : "#333";
    s += `<text x="${fFloat(right_x)}" y="${f(right_y)}" font-size="12" fill="${color}"${weight}>${text}</text>\n`;
    right_y += line_gap;
  }

  return s;
}
