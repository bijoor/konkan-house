// CSG-based box renderer for horizontal members (floor slabs AND beams).
// Subtracts pillar footprints from the box so a column passes through its own
// opening instead of overlapping (and z-fighting with) the deck/beam. Mirrors
// wallCSG's Brush/Evaluator pattern; geometry is cached per (box + holes) via
// useMemo so it only rebuilds on a real change.

import { useMemo } from "react";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export interface BoxHole {
  // Pillar footprint in the box's LOCAL frame (origin at the box centre):
  //   x/z: hole centre offset (three-X / three-Z, = world offsets, no flip/scale)
  //   w/l: hole extents (three-X / three-Z)
  x: number;
  z: number;
  w: number;
  l: number;
}

// A single shared evaluator — one per mesh would be wasteful.
const evaluator = new Evaluator();
evaluator.useGroups = false;

export function BoxWithHoles({
  cx, cy, cz, width, length, thickness, color, holes,
}: {
  cx: number; cy: number; cz: number; // box CENTRE in Three-space (Y up)
  width: number; length: number; thickness: number;
  color: string;
  holes: BoxHole[];
}) {
  const geometry = useMemo(
    () => buildBoxGeometry(width, length, thickness, holes),
    [width, length, thickness, holes],
  );
  return (
    <mesh geometry={geometry} position={[cx, cy, cz]} castShadow receiveShadow>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Built in the box's LOCAL frame — origin at centre, X = world X, Y = up
// (thickness), Z = world (Inkscape) Y. Each hole cutter spans the full thickness
// (+ a hair, so CSG leaves no razor-thin face) and is subtracted.
function buildBoxGeometry(
  width: number,
  length: number,
  thickness: number,
  holes: BoxHole[],
): THREE.BufferGeometry {
  const boxGeom = new THREE.BoxGeometry(width, thickness, length);
  if (holes.length === 0) return boxGeom;

  let brush = new Brush(boxGeom);
  brush.updateMatrixWorld();
  for (const h of holes) {
    const cutterGeom = new THREE.BoxGeometry(h.w, thickness + 0.5, h.l);
    const cutter = new Brush(cutterGeom);
    cutter.position.set(h.x, 0, h.z);
    cutter.updateMatrixWorld();
    brush = evaluator.evaluate(brush, cutter, SUBTRACTION);
    cutterGeom.dispose();
  }
  const outGeom = brush.geometry.clone();
  boxGeom.dispose();
  return outGeom;
}
