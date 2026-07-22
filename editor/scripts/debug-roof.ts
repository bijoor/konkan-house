import { derivePitchedRoof } from "../src/svg2d/roof/v2/derivePitched";
import { resolveJoints, ridgeZFromConfig } from "../src/svg2d/roof/v2/resolveJoints";
import { trimAtJoints } from "../src/svg2d/roof/v2/trimAtJoints";
import type { RoofConfig } from "../src/svg2d/roof/v2/model";

const cfg = {
  type: "roof", roof_type: "pitched", default_endpoint: "closed",
  segments: [
    { id: "seg0", start: [950, 992], end: [950, 1866], width: 1046, start_endpoint: "open" },
    { id: "seg1", start: [950, 1866], end: [90, 1866], width: 800 },
  ],
  slope: { by: "height", ridge_h: 200 }, min_overhang: 50,
} as unknown as RoofConfig;

const wallTopZ = 0;
let spec = derivePitchedRoof(cfg, { wallTopZ });
const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ });
spec = trimAtJoints(spec);

const r2 = (n: number) => Math.round(n * 10) / 10;
const fmt = (v: number[]) => `[${v.map(r2).join(",")}]`;
console.log("=== PLANES (after trim) ===");
for (const p of spec.planes) {
  console.log(`${p.id}  role=${p.role} side=${p.side_of_segment ?? "-"} jointEdges=${(p.joint_edges ?? []).join(",")}`);
  console.log("   verts: " + p.vertices.map(fmt).join(" "));
}
console.log("\n=== JOINT MEMBERS ===");
for (const m of spec.members.filter((m) => m.id.startsWith("joint.") || m.role === "valley" || m.role === "hip"))
  console.log(`${m.id} ${m.role}: ${fmt(m.start as number[])} -> ${fmt(m.end as number[])}`);
