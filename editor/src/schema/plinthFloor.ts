// Helpers for the Plinth floor — the first floor (floor_number 0), which holds
// the `ground` and `plinth` objects that used to be a top-level `config.plinth`
// key + an auto-derived ground plane.
//
// Renderers that historically read `config.plinth` now read the plinth OBJECT
// via `plinthGeom`; renderers that iterated `floors` (when the plinth was
// separate) now iterate `habitableFloors` so their output is unchanged.

export interface PlinthGeom {
  x: number;
  y: number;
  width: number;
  length: number;
  height: number;
}

type Floor = Record<string, unknown>;
type Obj = Record<string, unknown>;

// A floor is the "base" (Plinth) floor when it carries a plinth or ground
// object. Detected by OBJECT PRESENCE — not by floor_number — so an un-migrated
// legacy config (no plinth/ground objects) has NO plinth floor, and every one
// of its floors is treated as habitable and renders normally.
function isBaseFloor(f: Floor): boolean {
  return ((f.objects as Obj[] | undefined) ?? []).some(
    (o) => o.type === "plinth" || o.type === "ground",
  );
}

// The Plinth floor = the first floor carrying a plinth/ground object (undefined
// for legacy configs that have none).
export function findPlinthFloor(config: unknown): Floor | undefined {
  const floors = (config as { floors?: Floor[] })?.floors ?? [];
  return floors.find(isBaseFloor);
}

export function findPlinthObject(config: unknown): Obj | undefined {
  const floor = findPlinthFloor(config);
  const objs = (floor?.objects as Obj[] | undefined) ?? [];
  return objs.find((o) => o.type === "plinth");
}

// Plinth footprint + height (the old top-level `config.plinth`), or undefined
// when a config has no plinth floor yet.
export function plinthGeom(config: unknown): PlinthGeom | undefined {
  const p = findPlinthObject(config);
  if (!p) return undefined;
  return {
    x: (p.x as number) ?? 0,
    y: (p.y as number) ?? 0,
    width: (p.width as number) ?? 0,
    length: (p.length as number) ?? 0,
    height: (p.height as number) ?? 0,
  };
}
