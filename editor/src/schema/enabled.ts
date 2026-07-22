// The object `enabled` switch (see houseConfig.ts `enabledField`). An object is
// hidden from every view when `enabled` resolves to `false` or `0`; absent /
// `true` / any non-zero number shows it. `formulas.enabled` (e.g. "= has_pooja")
// is resolved into `enabled` by the parametric resolver before rendering, so a
// variable can switch a room on/off — the basis of switch-off template rooms.

export function isEnabled(obj: unknown): boolean {
  const e = (obj as { enabled?: unknown } | null | undefined)?.enabled;
  return !(e === false || e === 0);
}

// Keep only the enabled objects (used at every render/compute boundary so a
// disabled object contributes to nothing — geometry, bounds, roof, dimensions).
export function activeObjects<T>(objects: T[] | undefined | null): T[] {
  return (objects ?? []).filter(isEnabled);
}
