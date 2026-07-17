import * as fs from "node:fs";
import { computeMergedV2Spec } from "../src/svg2d/roof/v2/computeFromHouse";
import type { HouseConfig } from "../src/svg2d/expand";

const cfg = JSON.parse(
  fs.readFileSync("/Users/ashutoshbijoor/Downloads/house_config.json", "utf8"),
) as HouseConfig;

import { collectV2FramingSpecs } from "../src/svg2d/roof/v2/computeFromHouse";
import { computeTopFloorWallTopZ } from "../src/svg2d/roofGeometry";
import { expandRoomWalls } from "../src/svg2d/expand";
import { DEFAULT_GLOBAL_CONFIG } from "../src/svg2d/config";
const hc = expandRoomWalls(cfg);
const wtz = computeTopFloorWallTopZ(0, DEFAULT_GLOBAL_CONFIG, 8, hc.floors as any, (hc as any).defaults);
console.log(`wallTopZ = ${wtz}`);

// Also test the master compose to reproduce browser errors.
try {
  const { computeV2RoofSections } = await import("../src/svg2d/roof/v2/compose");
  const master = computeV2RoofSections(cfg);
  console.log(`master OK: ${master ? "returned result" : "null"}`);
} catch (e) {
  console.error("computeV2RoofSections FAILED:", e);
}
try {
  const { generateAllFloorPlans } = await import("../src/svg2d/floorPlansAll");
  const plans = generateAllFloorPlans(cfg);
  console.log(`floor plans: ${plans.length} files`);
} catch (e) {
  console.error("generateAllFloorPlans FAILED:", e);
}
try {
  const { computeRoofSections } = await import("../src/svg2d/roof");
  const r = computeRoofSections(cfg);
  console.log(`computeRoofSections: ${r ? "OK" : "null"}`);
} catch (e) {
  console.error("computeRoofSections FAILED:", e);
}
try {
  const { validate } = await import("../src/schema/houseConfig");
  const v = validate(cfg);
  console.log(`schema validate: ok=${v.ok} ${v.errors ? "errors=" + v.errors.length : ""}`);
} catch (e) {
  console.error("schema validate FAILED:", e);
}

const spec = computeMergedV2Spec(cfg);

console.log("=== members by role ===");
const byRole = new Map<string, number>();
for (const m of spec.members) {
  byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1);
}
for (const [role, n] of byRole) console.log(`  ${role}: ${n}`);

console.log("\n=== planes by role + side ===");
for (const p of spec.planes) {
  console.log(
    `  ${p.id.padEnd(30)} role=${p.role.padEnd(12)} side=${(p.side_of_segment ?? "-").padEnd(6)} verts=${p.vertices.length}`,
  );
  for (const v of p.vertices) {
    console.log(`      (${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`);
  }
}

console.log("\n=== joint members ===");
for (const m of spec.members) {
  if (!m.id.startsWith("joint.")) continue;
  console.log(
    `  ${m.id.padEnd(28)} role=${m.role.padEnd(6)} ` +
    `(${m.start[0].toFixed(1)}, ${m.start[1].toFixed(1)}, ${m.start[2].toFixed(1)}) → ` +
    `(${m.end[0].toFixed(1)}, ${m.end[1].toFixed(1)}, ${m.end[2].toFixed(1)})`,
  );
}

console.log("\n=== ring_beam members ===");
for (const m of spec.members) {
  if (m.role !== "ring_beam") continue;
  console.log(
    `  ${m.id.padEnd(28)} ` +
    `(${m.start[0].toFixed(1)}, ${m.start[1].toFixed(1)}) → ` +
    `(${m.end[0].toFixed(1)}, ${m.end[1].toFixed(1)})`,
  );
}

console.log("\n=== pani_patti / eave_L_channel / corner_double_angle ===");
for (const m of spec.members) {
  if (m.role !== "pani_patti" && m.role !== "eave_L_channel"
      && m.role !== "corner_double_angle") continue;
  console.log(
    `  ${m.id.padEnd(38)} role=${m.role.padEnd(20)} ` +
    `(${m.start[0].toFixed(1)}, ${m.start[1].toFixed(1)}, ${m.start[2].toFixed(1)}) → ` +
    `(${m.end[0].toFixed(1)}, ${m.end[1].toFixed(1)}, ${m.end[2].toFixed(1)})`,
  );
}
