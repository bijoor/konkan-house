import { generateFloorPlanSvg } from "./floorPlan";
import { expandRoomWalls, type HouseConfig } from "./expand";

// Port of svg_2d.py::generate_all_floor_plans. Returns a map from
// generated filename to SVG contents. Callers write each entry to disk
// (Python side) or display them in the editor preview (browser side).
export interface FloorPlanFile {
  filename: string;
  content: string;
}

export function generateAllFloorPlans(houseConfig: HouseConfig): FloorPlanFile[] {
  const hc = expandRoomWalls(houseConfig);
  const out: FloorPlanFile[] = [];
  for (const floor of hc.floors ?? []) {
    const floorNum = (floor.floor_number as number | undefined) ?? 0;
    const floorName = (floor.name as string | undefined) ?? `Floor_${floorNum}`;
    const filename = `floor_plan_${floorNum}_${floorName.replace(/ /g, "_")}.svg`;
    const content = generateFloorPlanSvg(floor);
    // Match Python: floors with no bounded 2D objects (e.g. loft with
    // only a hip_roof) return '' and Python skips writing them, so we
    // omit them from the output list too.
    if (!content) continue;
    out.push({ filename, content });
  }
  return out;
}
