// One-off migration: convert legacy roofs in template configs to v2
// `type: "roof"` (using the built-in oldRectRoofToSegments adapter)
// and add the new house-level `defaults` block for floor/wall/slab.
//
// Idempotent — re-running against already-migrated templates just
// re-normalises them.

import * as fs from "node:fs";
import * as path from "node:path";
import { oldRectRoofToSegments } from "../src/svg2d/roof/v2/adapters";

// Every location templates live — the SOURCE in editor/public/ is
// the primary; docs/templates + docs/editor/templates are build
// outputs that get overwritten by Vite. Migrate all three so a
// subsequent build doesn't stamp legacy files back over the migrated
// docs copy.
const TEMPLATES_DIRS = [
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/editor/public/templates",
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/templates",
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/editor/templates",
];
const LEGACY_ROOF_TYPES = new Set([
  "hip_roof", "gable_roof", "flat_roof", "shed_roof",
]);
const NEW_DEFAULTS = {
  floor_height: 98,
  wall_height: 90,
  slab_thickness: 8,
};

interface LegacyRoof {
  type: string;
  x?: number; y?: number;
  width?: number; length?: number;
  [k: string]: unknown;
}

function migrate(cfg: Record<string, unknown>): { changed: boolean; report: string[] } {
  const report: string[] = [];
  let changed = false;

  // 1. Ensure house-level defaults block.
  const defaults = (cfg.defaults as Record<string, unknown> | undefined) ?? {};
  const beforeDefaults = JSON.stringify(defaults);
  const nextDefaults = { ...defaults, ...NEW_DEFAULTS };
  if (JSON.stringify(nextDefaults) !== beforeDefaults) {
    cfg.defaults = nextDefaults;
    report.push(`  defaults ← ${JSON.stringify(NEW_DEFAULTS)}`);
    changed = true;
  }

  // 2. Convert legacy roofs to v2 per floor.
  const floors = cfg.floors as Array<Record<string, unknown>> | undefined;
  if (floors) {
    for (const floor of floors) {
      const objects = floor.objects as Array<Record<string, unknown>> | undefined;
      if (!objects) continue;
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const t = obj.type as string | undefined;
        if (!t || !LEGACY_ROOF_TYPES.has(t)) continue;
        // Fill x/y/width/length defaults from plot if missing so the
        // adapter has something to work with.
        const legacy: LegacyRoof = { type: t, ...obj };
        if (legacy.x == null) legacy.x = 0;
        if (legacy.y == null) legacy.y = 0;
        const plotW = (cfg.plinth as { width?: number } | undefined)?.width
          ?? (cfg.site as { plot_width?: number } | undefined)?.plot_width;
        const plotL = (cfg.plinth as { length?: number } | undefined)?.length
          ?? (cfg.site as { plot_length?: number } | undefined)?.plot_length;
        if (legacy.width == null && plotW != null) legacy.width = plotW;
        if (legacy.length == null && plotL != null) legacy.length = plotL;
        const v2 = oldRectRoofToSegments(legacy);
        objects[i] = v2 as unknown as Record<string, unknown>;
        report.push(`  ${t} → roof (roof_type=${v2.roof_type})`);
        changed = true;
      }
    }
  }

  return { changed, report };
}

// Walk every template file in every location. Skip index.json (a
// manifest, not a config).
for (const dir of TEMPLATES_DIRS) {
  if (!fs.existsSync(dir)) {
    console.log(`\n(skipping ${dir} — does not exist)`);
    continue;
  }
  console.log(`\n=== ${dir} ===`);
  const entries = fs.readdirSync(dir);
  for (const name of entries) {
    if (!name.endsWith(".json") || name === "index.json") continue;
    const full = path.join(dir, name);
    const raw = JSON.parse(fs.readFileSync(full, "utf8"));
    const { changed, report } = migrate(raw);
    console.log(`\n[${name}]`);
    if (!changed) {
      console.log("  (already up-to-date)");
      continue;
    }
    for (const line of report) console.log(line);
    fs.writeFileSync(full, JSON.stringify(raw, null, 2) + "\n", "utf8");
  }
}
