// Pillar footprint + corner→center helpers.
//
// Pillars store `x,y` as the TOP-LEFT CORNER (consistent with room /
// floor_slab / beam). Their projection / placement math, however, works in
// CENTERS, so each renderer converts corner→center at the point it reads a
// pillar. `width`/`length` may be omitted and fall back to an explicit `size`,
// then the caller's wall thickness — centralised here so every renderer
// resolves the effective footprint identically (the conversion depends on it).

export interface PillarLike {
  x: number;
  y: number;
  width?: number;
  length?: number;
  size?: number;
}

export function pillarExtents(
  o: { width?: number; length?: number; size?: number },
  wallThickness: number,
): { width: number; length: number } {
  return {
    width: o.width ?? o.size ?? wallThickness,
    length: o.length ?? o.size ?? wallThickness,
  };
}

// Corner (stored x,y) → center, plus the resolved footprint.
export function pillarCenter(
  o: PillarLike,
  wallThickness: number,
): { cx: number; cy: number; width: number; length: number } {
  const { width, length } = pillarExtents(o, wallThickness);
  return { cx: o.x + width / 2, cy: o.y + length / 2, width, length };
}
