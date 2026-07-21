// Port of svg_2d.py::generate_all_elevations. Thin wrapper — calls
// expandRoomWalls once, then generateElevationView for each of the four
// standard architectural views. Returns per-view SVG strings so the
// caller (browser editor or the parity harness) can decide what to do
// with them.

import { expandRoomWalls, type HouseConfig } from "./expand";
import { generateElevationView } from "./elevationView";

export interface ElevationOutput {
  view: "front" | "back" | "left" | "right";
  content: string;
}

export function generateAllElevations(
  houseConfig: HouseConfig,
): ElevationOutput[] {
  const hc = expandRoomWalls(houseConfig, undefined, { lenient: true });
  const views: Array<"front" | "back" | "left" | "right"> = [
    "front",
    "back",
    "left",
    "right",
  ];
  return views.map((view) => ({
    view,
    content: generateElevationView(hc, view),
  }));
}
