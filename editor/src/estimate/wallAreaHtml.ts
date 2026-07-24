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
  summaryRows.push(line("External — total", r.grandExternal, "total"));
  summaryRows.push(line("Internal walls (both faces, net of openings)", r.internal.net));

  const summary = `
    <h3>Wall area summary</h3>
    <p class="note">External = outward faces of perimeter walls + gable ends (exterior paint).
      Internal = room-facing surfaces of every wall, both sides of partitions and the inner
      face of external walls (interior paint). Door/window openings deducted.</p>
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

  // ---- Per-wall takeoff (collapsible) ----
  const takeoffRows = r.rows
    .filter((row) => row.areaU > 0)
    .map((row) =>
      `<tr><td>${escapeHtml(r.perFloor[row.floor]?.name ?? `F${row.floor}`)}</td>` +
      `<td>${escapeHtml(row.wall)}</td>` +
      `<td>${row.face}</td>` +
      `<td class="num">${fmtLen(row.lengthU)}</td>` +
      `<td class="num">${fmtLen(row.heightU)}</td>` +
      `<td class="num">${fmtA(row.areaU)}</td></tr>`)
    .join("");
  const gableTakeoff = r.gables.rows
    .map((g) =>
      `<tr><td>—</td><td>Gable · ${escapeHtml(g.segment)}${g.side ? " / " + escapeHtml(g.side) : ""}</td>` +
      `<td>external</td><td class="num">${fmtLen(g.baseU)}</td><td class="num">${fmtLen(g.heightU)}</td>` +
      `<td class="num">${fmtA(g.areaU)}</td></tr>`)
    .join("");
  const takeoff = `
    <details>
      <summary>Per-wall takeoff (${r.rows.filter((x) => x.areaU > 0).length + r.gables.rows.length} faces)</summary>
      <table>
        <thead><tr><th>Floor</th><th>Wall / face</th><th>Type</th>
          <th class="num">Length</th><th class="num">Height</th><th class="num">Area (${escapeHtml(sq)})</th></tr></thead>
        <tbody>${takeoffRows}${gableTakeoff}</tbody>
      </table>
    </details>`;

  return `${STYLE}<div class="wa-card">${summary}${perFloor}${takeoff}</div>`;
}
