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

export interface RoomEntry {
  key: string;
  floorIdx: number;
  floorName: string;
  name: string;
  eye: [number, number, number];
}

// Default eye height above the floor's walking surface (project units,
// 10 = 1 ft → ~5.5 ft). Capped below the ceiling for short walls.
const EYE_HEIGHT = 55;

// Enumerate every room in the config with the eye position (Three coords)
// you'd stand at to look around inside it. Uses the same coord helpers the
// 3D scene uses, so the eye lands exactly in the rendered room.
export function listRooms(config: unknown): RoomEntry[] {
  const hc = config as {
    defaults?: Parameters<typeof readGlobals>[0];
    plinth?: { height?: number };
    floors?: Array<{ name?: string; objects?: Array<Record<string, unknown>> }>;
  } | null;
  if (!hc || !hc.floors) return [];

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
      const eyeH = Math.min(EYE_HEIGHT, band.wallHeight * 0.6);
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
