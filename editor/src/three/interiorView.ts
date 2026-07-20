import { create } from "zustand";
import {
  computeFloorZBands,
  readGlobals,
  readPlotBounds,
  toThreePos,
} from "./coords";
import { expandRoomWalls } from "../svg2d/expand";

// A place to stand inside the model, in Three.js world coords.
export interface InteriorTarget {
  key: string; // `${floorIdx}:${objIdx}` — identifies the room in the picker
  label: string; // "Ground Floor: Bedroom_1"
  eye: [number, number, number]; // camera position (eye level, room centre)
}

interface InteriorState {
  target: InteriorTarget | null;
  enter: (t: InteriorTarget) => void;
  exit: () => void;
}

// Shared by the picker (writes) and the 3D scene (reads → first-person cam).
export const useInteriorStore = create<InteriorState>((set) => ({
  target: null,
  enter: (t) => set({ target: t }),
  exit: () => set({ target: null }),
}));

// Analog movement input from the on-screen joystick, each component in
// [-1, 1]: x = strafe (right +), y = forward (up on the stick = +). A plain
// mutable object (not store state) so the joystick can update it every
// pointer-move without triggering React re-renders — the scene's useFrame
// reads it directly and blends it with the WASD keys.
export const interiorMove = { x: 0, y: 0 };

export interface RoomEntry {
  key: string;
  floorIdx: number;
  floorName: string;
  name: string;
  eye: [number, number, number];
}

// Default eye height above the floor's walking surface, as a PHYSICAL
// height. Converted to project units per the model's configurable
// units (below) so it stays ~5 ft whatever the units-to-project scale is.
// Capped below the ceiling for short walls.
const EYE_HEIGHT_FEET = 5;

// One display unit spans this many feet, per `units.system`. Combined with
// `units.per_unit` (project units per ONE display unit) this gives the
// project-units-per-foot needed to place a physical height in the model.
const FEET_PER_DISPLAY_UNIT: Record<string, number> = {
  feet_inches: 1,
  feet: 1,
  meters: 3.280839895, // 1 m
  centimeters: 0.032808399, // 1 cm
  millimeters: 0.003280839, // 1 mm
};

// Convert a physical height in feet to project units using the config's
// (optional) display-unit settings. Default 10 units = 1 ft (feet_inches),
// matching the historical hard-coded eye height of 50 units for 5 ft.
function feetToProjectUnits(
  feet: number,
  units?: { system?: string; per_unit?: number },
): number {
  const perUnit = units?.per_unit ?? 10; // project units per 1 display unit
  const feetPerDisplayUnit = FEET_PER_DISPLAY_UNIT[units?.system ?? "feet_inches"] ?? 1;
  const unitsPerFoot = perUnit / feetPerDisplayUnit;
  return feet * unitsPerFoot;
}

// Enumerate every room in the config with the eye position (Three coords)
// you'd stand at to look around inside it. Uses the same coord helpers the
// 3D scene uses, so the eye lands exactly in the rendered room.
export function listRooms(config: unknown): RoomEntry[] {
  const hc = config as {
    defaults?: Parameters<typeof readGlobals>[0];
    plinth?: { height?: number };
    units?: { system?: string; per_unit?: number };
    floors?: Array<{ name?: string; objects?: Array<Record<string, unknown>> }>;
  } | null;
  if (!hc || !hc.floors) return [];

  const eyeUnits = feetToProjectUnits(EYE_HEIGHT_FEET, hc.units);

  const g = readGlobals(hc.defaults, hc.plinth?.height);
  const bands = computeFloorZBands(
    hc.floors as Array<Record<string, unknown>>,
    g.plinthHeight,
    g.slabThickness,
    g.floorHeight,
    g.wallHeight,
  );
  let plot;
  try {
    plot = readPlotBounds(expandRoomWalls(config as never) as never);
  } catch {
    plot = readPlotBounds(hc as unknown as Record<string, unknown>);
  }

  const out: RoomEntry[] = [];
  hc.floors.forEach((f, fi) => {
    const band = bands[fi];
    if (!band) return;
    const floorName = (f.name as string | undefined) ?? `Floor ${fi}`;
    (f.objects ?? []).forEach((o, oi) => {
      if (o.type !== "room") return;
      const x = o.x as number, y = o.y as number;
      const w = o.width as number, l = o.length as number;
      if ([x, y, w, l].some((n) => typeof n !== "number")) return;
      const eyeH = Math.min(eyeUnits, band.wallHeight * 0.6);
      const p = toThreePos(x + w / 2, y + l / 2, band.wallZ + eyeH, plot.width, plot.length);
      out.push({
        key: `${fi}:${oi}`,
        floorIdx: fi,
        floorName,
        name: (o.name as string | undefined) ?? `Room ${oi}`,
        eye: [p.x, p.y, p.z],
      });
    });
  });
  return out;
}
