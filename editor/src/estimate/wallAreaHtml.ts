// HTML report for the wall-area estimator — Summary + Per-floor + Per-wall
// takeoff tables. Mirrors svg2d/roof/htmlBom.ts styling (.roof-bom-card) so it
// sits visually alongside the Roof Details BOM tables. Self-contained HTML
// string, injected into svgMap and shown in the viewer's Quantities tab; it
// re-computes on every config edit via the panel builder in viewer/main.ts.

import type { WallAreaReport } from "./wallArea";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const STYLE = `
  <style>
    .wa-card { padding: 1rem 1.25rem; color: #1e293b; }
    .wa-card h3 { margin: 1.25rem 0 0.6rem 0; font-size: 1rem; color: #B85028; font-weight: 600; }
    .wa-card h3:first-child { margin-top: 0; }
    .wa-card p.note { margin: 0 0 0.75rem 0; font-size: 0.78rem; color: #64748b; }
    .wa-card table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .wa-card th, .wa-card td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .wa-card th { background: #f8fafc; font-weight: 600; color: #334155; }
    .wa-card tbody tr:last-child td { border-bottom: none; }
    .wa-card td.num, .wa-card th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .wa-card tr.total td { font-weight: 700; border-top: 2px solid #cbd5e1; }
    .wa-card details { margin-top: 0.5rem; }
    .wa-card summary { cursor: pointer; font-size: 0.85rem; color: #334155; font-weight: 600; padding: 0.3rem 0; }
    .wa-card tr.ext td { background: #fdf4f0; }
    .wa-card .tag { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 4px; }
    .wa-card .tag-external { background: #B85028; color: #fff; }
    .wa-card .tag-internal { background: #e2e8f0; color: #475569; }
  </style>`;

export function wallAreaHtml(r: WallAreaReport): string {
  const u = r.units;
  const sq = u.sqLabel;
  const a = (areaU: number) => u.toDisplay(areaU); // display sq units
  const fmtA = (areaU: number) => Math.round(a(areaU)).toLocaleString();
  const fmtM2 = (areaU: number) => u.toSqm(areaU).toFixed(1);
  const fmtLen = (lenU: number) => (lenU / u.perUnit).toFixed(1);

  // ---- Summary ----
  const summaryRows: string[] = [];
  const line = (label: string, areaU: number, cls = "") =>
    `<tr class="${cls}"><td>${escapeHtml(label)}</td><td class="num">${fmtA(areaU)}</td><td class="num">${fmtM2(areaU)}</td></tr>`;
  summaryRows.push(line("External walls (net of openings)", r.external.net));
  if (r.gables.area > 0) summaryRows.push(line("Gable ends (above eaves)", r.gables.area));
  summaryRows.push(line("External — total (exterior paint)", r.grandExternal, "total"));
  summaryRows.push(line("Internal wall faces (interior paint)", r.internal.net));

  const summary = `
    <h3>Wall area summary</h3>
    <p class="note">External = the outside, weather-facing faces of perimeter walls + gable
      ends → exterior paint. Internal = the protected inside faces (the inner face of
      external walls + both faces of interior partitions) → interior paint. Door/window
      openings deducted.</p>
    <table>
      <thead><tr><th>Surface</th><th class="num">${escapeHtml(sq)}</th><th class="num">m²</th></tr></thead>
      <tbody>${summaryRows.join("")}</tbody>
    </table>`;

  // ---- Per floor ----
  const floorRows = r.perFloor
    .filter((f) => f.external.net > 0 || f.internal.net > 0)
    .map((f) =>
      `<tr><td>${escapeHtml(f.name)}</td>` +
      `<td class="num">${fmtA(f.external.net)}</td>` +
      `<td class="num">${fmtA(f.internal.net)}</td></tr>`)
    .join("");
  const perFloor = `
    <h3>By floor <span style="font-weight:400;color:#94a3b8;font-size:0.8rem">(${escapeHtml(sq)}, net)</span></h3>
    <table>
      <thead><tr><th>Floor</th><th class="num">External</th><th class="num">Internal</th></tr></thead>
      <tbody>${floorRows || `<tr><td colspan="3">No walls.</td></tr>`}</tbody>
    </table>`;

  // ---- Per-wall inventory (one row per wall) ----
  const tag = (t: "external" | "internal") =>
    `<span class="tag tag-${t}">${t === "external" ? "External" : "Internal"}</span>`;
  const cell = (v: number) => (v > 0 ? fmtA(v) : "—");
  const invRows = r.inventory
    .map((row) =>
      `<tr class="${row.type === "external" ? "ext" : ""}">` +
      `<td>${escapeHtml(r.perFloor[row.floor]?.name ?? `F${row.floor}`)}</td>` +
      `<td>${escapeHtml(row.room)}</td>` +
      `<td>${escapeHtml(row.wall)}</td>` +
      `<td>${tag(row.type)}</td>` +
      `<td class="num">${fmtLen(row.lengthU)}×${fmtLen(row.heightU)}</td>` +
      `<td class="num">${cell(row.extAreaU)}</td>` +
      `<td class="num">${cell(row.intAreaU)}</td></tr>`)
    .join("");
  const gableRows = r.gables.rows
    .map((g) =>
      `<tr class="ext"><td>Roof</td><td>—</td>` +
      `<td>gable · ${escapeHtml(g.segment)}${g.side ? " / " + escapeHtml(g.side) : ""}</td>` +
      `<td>${tag("external")}</td>` +
      `<td class="num">${fmtLen(g.baseU)}×${fmtLen(g.heightU)}</td>` +
      `<td class="num">${fmtA(g.areaU)}</td><td class="num">—</td></tr>`)
    .join("");
  const extCount = r.inventory.filter((x) => x.type === "external").length;
  const inventory = `
    <details open>
      <summary>Wall inventory — ${extCount} external of ${r.inventory.length} walls</summary>
      <p class="note">One row per wall. <b>Exterior</b> = its weather-facing outside area
        (exterior paint); <b>Interior</b> = its protected inside face(s) (interior paint).
        Areas in ${escapeHtml(sq)}, net of openings.</p>
      <table>
        <thead><tr><th>Floor</th><th>Room</th><th>Wall</th><th>Type</th>
          <th class="num">L×H</th><th class="num">Exterior</th><th class="num">Interior</th></tr></thead>
        <tbody>${invRows}${gableRows}</tbody>
      </table>
    </details>`;

  return `${STYLE}<div class="wa-card">${summary}${perFloor}${inventory}</div>`;
}
