// One-off: replace the 4 separate wing-roofs in courtyard_home.json
// with a single 4-segment closed-loop roof around the courtyard.
//
// Segments (CCW around the courtyard):
//   seg0 N wing (W→E): (90, 100) → (510, 100), width 200
//   seg1 E wing (N→S): (510, 100) → (510, 446), width 180
//   seg2 S wing (E→W): (510, 446) → (90, 446), width 108
//   seg3 W wing (S→N): (90, 446) → (90, 100), width 180
//
// All four corners become joints — no leaf endpoints, so
// hip_setback / default_endpoint don't apply.

import * as fs from "node:fs";

const NAME = "courtyard_home.json";
const DIRS = [
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/editor/public/templates",
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/templates",
  "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/editor/templates",
];

const unifiedRoof = {
  type: "roof",
  roof_type: "pitched",
  default_endpoint: "closed",
  segments: [
    {
      id: "seg0",
      start: [90, 100],
      end: [510, 100],
      width: 200,
    },
    {
      id: "seg1",
      start: [510, 100],
      end: [510, 446],
      width: 180,
    },
    {
      id: "seg2",
      start: [510, 446],
      end: [90, 446],
      width: 108,
    },
    {
      id: "seg3",
      start: [90, 446],
      end: [90, 100],
      width: 180,
    },
  ],
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
  trusses: [
    { segment_id: "seg0", type: "fink", positions_along: [100, 210, 320] },
    { segment_id: "seg1", type: "fink", positions_along: [80, 173, 266] },
    { segment_id: "seg2", type: "fink", positions_along: [100, 210, 320] },
    { segment_id: "seg3", type: "fink", positions_along: [80, 173, 266] },
  ],
};

for (const dir of DIRS) {
  const full = `${dir}/${NAME}`;
  if (!fs.existsSync(full)) {
    console.log(`skip ${full} (missing)`);
    continue;
  }
  const cfg = JSON.parse(fs.readFileSync(full, "utf8"));
  for (const floor of cfg.floors ?? []) {
    const objs = floor.objects ?? [];
    const roofs = objs.filter((o: { type?: string }) => o.type === "roof");
    if (roofs.length === 0) continue;
    // Remove all existing roofs on this floor and add the unified one.
    floor.objects = objs.filter((o: { type?: string }) => o.type !== "roof");
    floor.objects.push(unifiedRoof);
    console.log(`${dir}/${NAME}: replaced ${roofs.length} roofs with 1 unified`);
  }
  fs.writeFileSync(full, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
