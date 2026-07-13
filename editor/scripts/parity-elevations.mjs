// Byte-diff parity: TS elevation output vs the checked-in Python output
// in ../docs/. Runs after `python3 regenerate_combined_svgs.py`.
//
// Usage: node scripts/parity-elevations.mjs [front|back|left|right|combined|all]

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { generateAllElevations } from "../src/svg2d/elevationsAll.ts";
import { generateCombinedElevations } from "../src/svg2d/elevationsCombined.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
// R3 moved elevations into docs/2d/elevations/.
const docsDir = path.join(repoRoot, "docs", "2d", "elevations");
const target = process.argv[2] ?? "all";

const cfg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "house_config.json"), "utf8"),
);

let passed = 0;
let failed = 0;

const wantedViews = target === "all" || target === "combined"
  ? ["front", "back", "left", "right"]
  : [target];

if (target === "all" || target === "front" || target === "back" ||
    target === "left" || target === "right") {
  const perView = generateAllElevations(cfg);
  for (const { view, content } of perView) {
    if (!wantedViews.includes(view)) continue;
    const filename = `elevation_${view}.svg`;
    const pyPath = path.join(docsDir, filename);
    if (!fs.existsSync(pyPath)) {
      console.log(`  · ${filename}: no Python reference`);
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
}

if (target === "all" || target === "combined") {
  const content = generateCombinedElevations(cfg);
  const pyPath = path.join(docsDir, "elevations_combined.svg");
  if (fs.existsSync(pyPath)) {
    const py = fs.readFileSync(pyPath, "utf8");
    if (py === content) {
      console.log(`  ✓ elevations_combined.svg (${content.length} bytes)`);
      passed++;
    } else {
      console.log(`  ✗ elevations_combined.svg`);
      printFirstDiff(py, content);
      failed++;
    }
  }
}

console.log(`\n${passed}/${passed + failed} elevation SVGs byte-identical`);
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
