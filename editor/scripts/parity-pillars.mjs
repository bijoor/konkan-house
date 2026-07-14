// Byte-diff parity: TS pillar output vs the checked-in Python output in
// ../docs/2d/pillar_elevations/ and ../docs/2d/pillar_sections/.
// Assumes `python3 scripts/generate_pillar_elevations.py` was run recently
// (or that Python's output already reflects the current house_config.json).

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { generateAllPillarSvgs } from "../src/svg2d/pillar/index.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const elevationsDir = path.join(repoRoot, "docs", "2d", "pillar_elevations");
const sectionsDir = path.join(repoRoot, "docs", "2d", "pillar_sections");

const cfg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "house_config.json"), "utf8"),
);

const svgs = generateAllPillarSvgs(cfg);

let passed = 0;
let failed = 0;

for (const { filename, content: tsContent } of svgs) {
  // Elevations live in one folder, sections in another. The filename
  // pattern determines which.
  const dir = filename.startsWith("pillar_elevation_")
    ? elevationsDir
    : sectionsDir;
  const pyPath = path.join(dir, filename);
  if (!fs.existsSync(pyPath)) {
    console.log(`  · ${filename}: no Python reference`);
    continue;
  }
  const py = fs.readFileSync(pyPath, "utf8");
  if (py === tsContent) {
    console.log(`  ✓ ${filename} (${tsContent.length} bytes)`);
    passed++;
  } else {
    // Find first divergence point for quick diagnosis
    let idx = 0;
    while (idx < py.length && idx < tsContent.length && py[idx] === tsContent[idx]) idx++;
    const line = py.slice(0, idx).split("\n").length;
    console.log(`  ✗ ${filename}`);
    console.log(`    diverges at char ${idx} (line ${line}):`);
    console.log(`    Python: …${JSON.stringify(py.slice(Math.max(0, idx - 40), idx + 60))}`);
    console.log(`    TS:     …${JSON.stringify(tsContent.slice(Math.max(0, idx - 40), idx + 60))}`);
    failed++;
  }
}

console.log();
console.log(
  failed === 0
    ? `${passed}/${passed + failed} pillar outputs byte-identical`
    : `${passed}/${passed + failed} matched, ${failed} diverged`,
);
process.exit(failed === 0 ? 0 : 1);
