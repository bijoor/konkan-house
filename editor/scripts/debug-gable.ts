import { derivePitchedRoof } from "../src/svg2d/roof/v2/derivePitched";
import type { RoofConfig } from "../src/svg2d/roof/v2/model";

function run(gableOH: number | undefined) {
  const cfg = {
    type: "roof", roof_type: "pitched", default_endpoint: "closed",
    segments: [
      { id: "seg0", start: [950, 992], end: [950, 1866], width: 1046,
        start_endpoint: "open",
        ...(gableOH !== undefined ? { gable_overhang_start: gableOH } : {}) },
      { id: "seg1", start: [950, 1866], end: [90, 1866], width: 800 },
    ],
    slope: { by: "height", ridge_h: 200 }, min_overhang: 50,
  } as unknown as RoofConfig;
  const spec = derivePitchedRoof(cfg, { wallTopZ: 0 });
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const gw = spec.planes.find((p) => p.id === "seg0.gable_wall.start");
  const sl = spec.planes.find((p) => p.id === "seg0.slope.left");
  const ridge = spec.members.find((m) => m.id === "seg0.ridge");
  console.log(`--- gable_overhang_start = ${gableOH ?? "(default → min_overhang 50)"} ---`);
  console.log("  gable wall verts (y should be 992 = wall line):", gw?.vertices.map(v=>v.map(r1)));
  console.log("  ridge start y (extends past wall toward -Y if <992):", ridge && r1((ridge.start as number[])[1]));
  console.log("  left-slope gable-end eave corner y:", sl && sl.vertices.filter(v=>v[2]<0).map(v=>r1(v[1])));
}
run(undefined);
run(0);
