import { create } from "zustand";

// Visibility layers roughly match the ones used in docs/index.html's GLB
// viewer. Each object we render gets tagged with a layer id; the layer
// panel toggles whole groups on/off. Colors here are hints for future
// use (e.g. material override or legend swatches).
export interface LayerDef {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_LAYERS: LayerDef[] = [
  { id: "loft", label: "Roof shell", color: "#e88968" },
  { id: "f1_beam", label: "First floor top beams", color: "#6b4423" },
  { id: "f1", label: "First floor walls", color: "#f5c9a0" },
  { id: "f1_slab", label: "First floor slab", color: "#b8b8b8" },
  { id: "f0", label: "Ground floor walls", color: "#f5c9a0" },
  { id: "openings", label: "Doors & windows", color: "#7ab6ff" },
  { id: "pillars", label: "Pillars", color: "#ffffff" },
  { id: "plinth", label: "Plinth", color: "#a0826d" },
  { id: "ground", label: "Ground", color: "#5c7346" },
];

interface LayerState {
  visible: Record<string, boolean>;
  toggle: (id: string) => void;
  setAll: (visible: boolean) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  visible: Object.fromEntries(DEFAULT_LAYERS.map((l) => [l.id, true])),
  toggle: (id) =>
    set((s) => ({ visible: { ...s.visible, [id]: !s.visible[id] } })),
  setAll: (visible) =>
    set(() => ({
      visible: Object.fromEntries(DEFAULT_LAYERS.map((l) => [l.id, visible])),
    })),
}));

// Which layer a per-floor object belongs to. Ground floor rooms/walls
// land in "f0"; first-floor in "f1"; slabs above ground in "f1_slab";
// beams above first floor walls in "f1_beam". Pillars are their own
// bucket (they span multiple floors visually).
export function layerForObject(
  objType: string,
  floorNumber: number,
): string {
  if (objType === "pillar") return "pillars";
  if (objType === "hip_roof" || objType === "gable_roof") return "loft";
  if (objType === "door" || objType === "window") return "openings";
  if (objType === "floor_slab") {
    return floorNumber === 0 ? "plinth" : "f1_slab";
  }
  if (objType === "beam") return "f1_beam";
  if (objType === "room" || objType === "wall") {
    return floorNumber === 0 ? "f0" : "f1";
  }
  return "ground";
}
