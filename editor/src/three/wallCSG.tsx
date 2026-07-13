// CSG-based wall renderer. Subtracts opening cuboids from a wall box so
// doors and windows become actual holes rather than flat overlays.
//
// Geometry is built with three-bvh-csg's Evaluator + Brush and cached
// per (wall + openings) via useMemo, so panning the camera or toggling
// unrelated layers doesn't retrigger CSG.

import { useMemo } from "react";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export interface WallOpening {
  // Local-space (wall-relative) rectangle to subtract. All coords are
  // in world units on the wall's principal axes:
  //   along:  offset along the wall's length axis
  //   from:   offset from the wall's bottom (i.e. sill_height for
  //           windows, 0 for doors)
  //   width:  extent along the wall's length axis
  //   height: extent up the wall
  along: number;
  from: number;
  width: number;
  height: number;
  kind: "door" | "window";
}

interface Props {
  // Wall centre in Three-space (Y is up).
  cx: number;
  cy: number;
  cz: number;
  // Wall extents. `length` runs along the wall; `depth` is wall thickness.
  length: number;
  depth: number;
  height: number;
  // Wall's orientation as a rotation around the Y axis, in radians.
  // 0 = wall runs along X (east-west); Math.PI/2 = along Z (north-south).
  rotY: number;
  color: string;
  openings: WallOpening[];
}

// A single shared evaluator — creating one per mesh is wasteful.
const evaluator = new Evaluator();
evaluator.useGroups = false;

export function WallWithOpenings(props: Props) {
  const { cx, cy, cz, length, depth, height, rotY, color, openings } = props;

  const geometry = useMemo(() => {
    return buildWallGeometry(length, depth, height, openings);
  }, [length, depth, height, openings]);

  return (
    <mesh
      geometry={geometry}
      position={[cx, cy, cz]}
      rotation={[0, rotY, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// The wall is built in its LOCAL frame — origin at the wall's centre,
// X along wall length, Y up, Z across wall thickness. The caller
// rotates it into world orientation via rotY.
function buildWallGeometry(
  length: number,
  depth: number,
  height: number,
  openings: WallOpening[],
): THREE.BufferGeometry {
  const wallGeom = new THREE.BoxGeometry(length, height, depth);
  if (openings.length === 0) return wallGeom;

  let brush = new Brush(wallGeom);
  brush.updateMatrixWorld();

  for (const op of openings) {
    // Cutter extends slightly beyond the wall thickness (depth + a hair)
    // so CSG doesn't leave a razor-thin sliver on the far face.
    const cutterGeom = new THREE.BoxGeometry(
      op.width,
      op.height,
      depth + 0.5,
    );
    const cutter = new Brush(cutterGeom);
    // Position the cutter in the wall's local frame:
    //   X: opening centre along the wall's length
    //   Y: opening centre stacked from bottom
    //   Z: 0 (centred through wall thickness)
    cutter.position.set(
      op.along + op.width / 2 - length / 2,
      op.from + op.height / 2 - height / 2,
      0,
    );
    cutter.updateMatrixWorld();

    brush = evaluator.evaluate(brush, cutter, SUBTRACTION);
    cutterGeom.dispose();
  }

  // Extract the final geometry from the resulting brush.
  const outGeom = brush.geometry.clone();
  wallGeom.dispose();
  return outGeom;
}

// Openings render as empty holes cut through the wall — no glass, no
// door slab. The wall's CSG hole is left open so you can see straight
// through. Kept as a component (rather than deleted at the call site)
// so a future toggle can bring back glass/door slab treatments without
// touching every caller.
export function OpeningPane(_: {
  cx: number; cy: number; cz: number;
  width: number; height: number; rotY: number;
  kind: "door" | "window";
  wallDepth?: number;
}) {
  return null;
}
