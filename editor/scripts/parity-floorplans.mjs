// Byte-diff parity: TS floor-plan output vs the checked-in Python
// output in ../docs/. Assumes docs/*.svg were regenerated recently from
// the current house_config.json (they were during Phase 0).
//
// Usage: node scripts/parity-floorplans.mjs

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { generateAllFloorPlans } from "../src/svg2d/floorPlansAll.ts";
import { generateCombinedFloorPlans } from "../src/svg2d/floorPlansCombined.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const docsDir = path.join(repoRoot, "docs");

const cfg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "house_config.json"), "utf8"),
);

let passed = 0;
let failed = 0;

const perFloor = generateAllFloorPlans(cfg);
for (const { filename, content } of perFloor) {
  const pyPath = path.join(docsDir, filename);
  if (!fs.existsSync(pyPath)) {
    console.log(`  · ${filename}: no Python reference to compare`);
    continue;
  }
  const py = fs.readFileSync(pyPath, "utf8");
  if (py === content) {
    console.log(`  ✓ ${filename} (${content.length} bytes)`);
    passed++;
  } else {
    console.log(`  ✗ ${filename}`);
    printFirstDiff(py, content);
    failed++;
  }
}

// Combined
const combinedContent = generateCombinedFloorPlans(cfg);
const combinedPath = path.join(docsDir, "floor_plans_combined.svg");
if (fs.existsSync(combinedPath)) {
  const py = fs.readFileSync(combinedPath, "utf8");
  if (py === combinedContent) {
    console.log(`  ✓ floor_plans_combined.svg (${combinedContent.length} bytes)`);
    passed++;
  } else {
    console.log(`  ✗ floor_plans_combined.svg`);
    printFirstDiff(py, combinedContent);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} floor plans byte-identical`);
process.exit(failed === 0 ? 0 : 1);

function printFirstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length !== b.length) {
    console.log(`    lengths differ: Python=${a.length} TS=${b.length}`);
    const longer = a.length > b.length ? "Python" : "TS";
    const extra = (a.length > b.length ? a : b).slice(n, n + 120);
    console.log(`    extra ${longer} content at end: ${JSON.stringify(extra)}`);
    return;
  }
  const before = 60;
  const after = 120;
  const start = Math.max(0, i - before);
  console.log(`    diverges at char ${i} (line ${a.slice(0, i).split("\n").length}):`);
  console.log(`    Python: …${JSON.stringify(a.slice(start, i + after))}`);
  console.log(`    TS:     …${JSON.stringify(b.slice(start, i + after))}`);
}
