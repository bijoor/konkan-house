// Add mono_pitch trusses to any shed roof in a template that doesn't
// already have one. Positions are evenly spaced along the segment
// (at 1/4, 1/2, 3/4 of its length) — same convention as the other
// templates' pitched-roof truss positions.

import * as fs from "node:fs";
import * as path from "node:path";

const DIRS = [
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/editor/public/templates",
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/templates",
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/editor/templates",
];

function segLength(s: { start: number[]; end: number[] }): number {
  const dx = s.end[0] - s.start[0];
  const dy = s.end[1] - s.start[1];
  return Math.hypot(dx, dy);
}

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  console.log(`\n=== ${dir} ===`);
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "index.json") continue;
    const full = path.join(dir, name);
    const cfg = JSON.parse(fs.readFileSync(full, "utf8"));
    let changed = false;
    for (const floor of cfg.floors ?? []) {
      for (const obj of floor.objects ?? []) {
        if (obj.type !== "roof" || obj.roof_type !== "shed") continue;
        if (obj.trusses && obj.trusses.length > 0) continue;   // skip if already has
        // Add one truss entry per segment at 1/4, 1/2, 3/4 of length.
        const trusses = [];
        for (const seg of obj.segments) {
          const L = segLength(seg);
          trusses.push({
            segment_id: seg.id,
            type: "mono_pitch",
            positions_along: [L * 0.25, L * 0.5, L * 0.75].map((n) => Math.round(n)),
          });
        }
        obj.trusses = trusses;
        console.log(`  ${name}: added ${trusses.length} mono_pitch truss group(s)`);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(full, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    }
  }
}
