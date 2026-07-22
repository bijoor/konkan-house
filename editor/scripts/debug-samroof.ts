import { readFileSync } from "node:fs";
import { expandRoomWalls } from "../src/svg2d/expand";
import { computeFloorZBands, readGlobals } from "../src/three/coords";
import { computeMergedV2Spec } from "../src/svg2d/roof/v2/computeFromHouse";
import { computeTopFloorWallTopZ } from "../src/svg2d/roofGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "../src/svg2d/config";

const cfg = JSON.parse(readFileSync(process.argv[2], "utf8"));
const hc: any = expandRoomWalls(cfg);
const g = readGlobals(hc.defaults, hc.plinth?.height);
const bands = computeFloorZBands(hc.floors, g.plinthHeight, g.slabThickness, g.floorHeight, g.wallHeight);
console.log("plinthHeight", g.plinthHeight);
hc.floors.forEach((f:any,fi:number)=>{
  const b = bands[fi];
  console.log(`floor ${fi} ${f.name}: slabZ=${b.slabZ} wallZ=${b.wallZ} wallTop=${b.wallTop} slabThick=${b.slabThickness} wallHeight=${b.wallHeight}`);
});
// wallTopZ used by the roof (per floor that has a roof)
hc.floors.forEach((f:any,fi:number)=>{
  const hasRoof = (f.objects||[]).some((o:any)=>o.type==="roof");
  if(!hasRoof) return;
  const wtz = computeTopFloorWallTopZ(fi, DEFAULT_GLOBAL_CONFIG, 0, hc.floors, hc.defaults, hc.plinth?.height);
  console.log(`roof on floor ${fi}: computeTopFloorWallTopZ = ${wtz}`);
});
const spec = computeMergedV2Spec(hc);
const bySeg: Record<string, {zmin:number,zmax:number}> = {};
for (const p of spec.planes) {
  const zs = p.vertices.map((v:any)=>v[2]);
  const sid = p.source_segment_id;
  if(!bySeg[sid]) bySeg[sid]={zmin:Infinity,zmax:-Infinity};
  bySeg[sid].zmin=Math.min(bySeg[sid].zmin,...zs);
  bySeg[sid].zmax=Math.max(bySeg[sid].zmax,...zs);
}
console.log("=== roof planes z-range per segment ===");
for(const [s,r] of Object.entries(bySeg)) console.log(`  ${s}: eaveZ=${r.zmin} ridgeZ=${r.zmax}`);

console.log("=== raw floor fields vs GC defaults ===");
console.log("GC floor_height", DEFAULT_GLOBAL_CONFIG.floor_height, "wall_height", DEFAULT_GLOBAL_CONFIG.wall_height, "slab", DEFAULT_GLOBAL_CONFIG.floor_slab_thickness);
console.log("house.defaults", JSON.stringify(hc.defaults));
hc.floors.forEach((f:any,fi:number)=>console.log(`floor ${fi}: height=${f.height} wall_height=${f.wall_height} slab_thickness=${f.slab_thickness} roofs=${(f.objects||[]).filter((o:any)=>o.type==='roof').length}`));
