// Sanity check — after migration, ensure every template still parses
// against the schema and can compute a v2 spec + roof panels without
// throwing.

import * as fs from "node:fs";
import * as path from "node:path";
import { validate } from "../src/schema/houseConfig";
import { computeMergedV2Spec } from "../src/svg2d/roof/v2/computeFromHouse";
import { generateAllFloorPlans } from "../src/svg2d/floorPlansAll";

const TEMPLATES_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/templates";

const files = fs.readdirSync(TEMPLATES_DIR).filter(
  (n) => n.endsWith(".json") && n !== "index.json",
);
let failed = 0;
for (const name of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8"));
  const v = validate(raw);
  if (!v.ok) {
    failed++;
    console.log(`[${name}] SCHEMA FAIL:`);
    for (const e of (v.errors ?? []).slice(0, 3)) console.log(`  /${e.path}: ${e.message}`);
    continue;
  }
  try {
    const spec = computeMergedV2Spec(raw);
    const plans = generateAllFloorPlans(raw);
    const ring = spec.members.filter((m) => m.role === "ring_beam").length;
    const rafter = spec.members.filter((m) => m.role === "rafter").length;
    console.log(`[${name}] OK — ring:${ring} rafters:${rafter} plans:${plans.length}`);
  } catch (e) {
    failed++;
    console.log(`[${name}] PIPELINE FAIL: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} templates passed`);
process.exit(failed === 0 ? 0 : 1);
