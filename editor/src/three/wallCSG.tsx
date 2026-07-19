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
  // Wall centre in Three-space (Y is up). `cy` is anchored to `height`
  // (the START height) — see buildWallGeometry — so a sloped wall keeps
  // the same bottom as a flat one of that height.
  cx: number;
  cy: number;
  cz: number;
  // Wall extents. `length` runs along the wall; `depth` is wall thickness.
  length: number;
  depth: number;
  height: number;
  // Optional END height for a sloped top. When present and != height, the
  // top slants from `height` at the start end (local -X) to `heightEnd` at
  // the end (local +X). Omitted / equal ⇒ a plain flat-top box.
  heightEnd?: number;
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
  const { cx, cy, cz, length, depth, height, heightEnd, rotY, color, openings } = props;

  const geometry = useMemo(() => {
    return buildWallGeometry(length, depth, height, heightEnd, openings);
  }, [length, depth, height, heightEnd, openings]);

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
  heightEnd: number | undefined,
  openings: WallOpening[],
): THREE.BufferGeometry {
  // Flat top (box) unless a distinct end height is given, in which case
  // build a sloped-top prism. Both share the same bottom (local Y =
  // -height/2), so the caller's `cy` and the opening-cutter maths (which
  // use `height`) are identical for either.
  const wallGeom =
    heightEnd === undefined || heightEnd === height
      ? new THREE.BoxGeometry(length, height, depth)
      : buildSlopedWall(length, depth, height, heightEnd);
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

// A wall with a sloped top: same bottom (local Y = -heightStart/2) as the
// equivalent flat box of `heightStart`, with the top edge running from
// `heightStart` at the start end (local -X) to `heightEnd` at the end
// (+X). Built as an extruded trapezoidal profile (XY), depth along Z.
function buildSlopedWall(
  length: number,
  depth: number,
  heightStart: number,
  heightEnd: number,
): THREE.BufferGeometry {
  const bottom = -heightStart / 2;
  const s = new THREE.Shape();
  s.moveTo(-length / 2, bottom);               // start-bottom
  s.lineTo(length / 2, bottom);                // end-bottom
  s.lineTo(length / 2, bottom + heightEnd);    // end-top
  s.lineTo(-length / 2, bottom + heightStart); // start-top
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  // ExtrudeGeometry runs Z from 0..depth; recentre across the wall thickness.
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
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
