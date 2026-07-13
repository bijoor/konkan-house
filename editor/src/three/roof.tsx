// Hip roof mesh — reconstructs the four sloping faces from the derived
// geometry (see roofGeometry.ts). Uses the same math as the Python
// elevation renderer, so the 3D preview and SVG elevations stay
// consistent.
//
// Geometry recap for ridge_axis='y':
//   eave corners (all at eave_z):
//     NW (xw, yn),  NE (xe, yn),  SE (xe, ys),  SW (xw, ys)
//   ridge endpoints (at eave_z + ridge_h):
//     R1 = ((xw+xe)/2, ridge_y_start),  R2 = ((xw+xe)/2, ridge_y_end)
//   faces:
//     N hip end (triangle):    NW → R1 → NE
//     S hip end (triangle):    SE → R2 → SW
//     W main slope (trapezoid): NW → SW → R2 → R1
//     E main slope (trapezoid): NE → R1 → R2 → SE
//   plus the ridge line and (optionally) the ridge-vent extension.

import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./coords";

export interface HipRoofGeom {
  eave_x_west: number;
  eave_x_east: number;
  eave_y_north: number;
  eave_y_south: number;
  eave_z: number;
  ridge_y_start: number;
  ridge_y_end: number;
  ridge_x_start?: number;
  ridge_x_end?: number;
  ridge_h: number;
  ridge_axis: "y" | "x";
  ridge_ext_u?: number;
}

interface Props {
  geom: HipRoofGeom;
  // World → three transform (matches toThreePos from ./coords).
  plotWidth: number;
  plotLength: number;
  color?: string;
  ridgeThickness?: number;
}

export function HipRoofMesh({
  geom,
  plotWidth,
  plotLength,
  color = "#c8582f",
  ridgeThickness = 3,
}: Props) {
  const { geometry, ridgePoints, ventPoints } = useMemo(() => {
    return buildHipRoof(geom, plotWidth, plotLength);
  }, [geom, plotWidth, plotLength]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      {/* Ridge cap — a thin dark line along the ridge for visual clarity. */}
      <RidgeLine
        p1={ridgePoints[0]}
        p2={ridgePoints[1]}
        thickness={ridgeThickness}
        color="#5a2a15"
      />
      {ventPoints && (
        <>
          <RidgeLine
            p1={ventPoints[0]}
            p2={ridgePoints[0]}
            thickness={ridgeThickness}
            color="#5a2a15"
          />
          <RidgeLine
            p1={ridgePoints[1]}
            p2={ventPoints[1]}
            thickness={ridgeThickness}
            color="#5a2a15"
          />
        </>
      )}
    </group>
  );
}

function RidgeLine({
  p1, p2, thickness, color,
}: {
  p1: Vec3; p2: Vec3; thickness: number; color: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
    const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
    const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(v2, v1);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      dir.clone().normalize(),
    );
    return { position: mid, quaternion: q, length: len };
  }, [p1, p2]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[length, thickness, thickness]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Build the 4-face hip roof as a BufferGeometry. Two triangular hip
// ends + two trapezoidal main slopes. Winding is CCW when viewed from
// outside (so `side: DoubleSide` isn't strictly needed, but we still
// set it to be forgiving).
function buildHipRoof(g: HipRoofGeom, plotWidth: number, plotLength: number) {
  // World → three: (x, y, z) → (x - plotW/2, worldZ, y - plotL/2)
  const t = (wx: number, wy: number, wz: number): Vec3 => ({
    x: wx - plotWidth / 2,
    y: wz,
    z: wy - plotLength / 2,
  });

  const eaveZ = g.eave_z;
  const ridgeZ = eaveZ + g.ridge_h;

  let corners: {
    nw: Vec3; ne: Vec3; se: Vec3; sw: Vec3;
    r1: Vec3; r2: Vec3;
  };
  let vent: [Vec3, Vec3] | undefined;

  if (g.ridge_axis === "y") {
    const ridgeX = (g.eave_x_west + g.eave_x_east) / 2;
    const nw = t(g.eave_x_west, g.eave_y_north, eaveZ);
    const ne = t(g.eave_x_east, g.eave_y_north, eaveZ);
    const se = t(g.eave_x_east, g.eave_y_south, eaveZ);
    const sw = t(g.eave_x_west, g.eave_y_south, eaveZ);
    const r1 = t(ridgeX, g.ridge_y_start, ridgeZ);
    const r2 = t(ridgeX, g.ridge_y_end, ridgeZ);
    corners = { nw, ne, se, sw, r1, r2 };
    const ext = g.ridge_ext_u ?? 0;
    if (ext > 1e-6) {
      vent = [
        t(ridgeX, g.ridge_y_start - ext, ridgeZ),
        t(ridgeX, g.ridge_y_end + ext, ridgeZ),
      ];
    }
  } else {
    // ridge_axis='x' — hips at east/west, ridge along X centred on Y
    const ridgeY = (g.eave_y_north + g.eave_y_south) / 2;
    const rxs = g.ridge_x_start ?? g.eave_x_west;
    const rxe = g.ridge_x_end ?? g.eave_x_east;
    const nw = t(g.eave_x_west, g.eave_y_north, eaveZ);
    const ne = t(g.eave_x_east, g.eave_y_north, eaveZ);
    const se = t(g.eave_x_east, g.eave_y_south, eaveZ);
    const sw = t(g.eave_x_west, g.eave_y_south, eaveZ);
    const r1 = t(rxs, ridgeY, ridgeZ);
    const r2 = t(rxe, ridgeY, ridgeZ);
    corners = { nw, ne, se, sw, r1, r2 };
    const ext = g.ridge_ext_u ?? 0;
    if (ext > 1e-6) {
      vent = [t(rxs - ext, ridgeY, ridgeZ), t(rxe + ext, ridgeY, ridgeZ)];
    }
  }

  const { nw, ne, se, sw, r1, r2 } = corners;
  // 6 unique vertices, indexed into triangles.
  const verts: number[] = [
    nw.x, nw.y, nw.z, // 0
    ne.x, ne.y, ne.z, // 1
    se.x, se.y, se.z, // 2
    sw.x, sw.y, sw.z, // 3
    r1.x, r1.y, r1.z, // 4
    r2.x, r2.y, r2.z, // 5
  ];
  const idx: number[] = [];
  if (g.ridge_axis === "y") {
    // N hip end (triangle NW-R1-NE, CCW viewed from north)
    idx.push(0, 4, 1);
    // S hip end (triangle SE-R2-SW, CCW viewed from south)
    idx.push(2, 5, 3);
    // W main slope (trapezoid NW-SW-R2-R1, split into two tris CCW from west)
    idx.push(0, 3, 5, 0, 5, 4);
    // E main slope (trapezoid NE-R1-R2-SE, CCW from east)
    idx.push(1, 4, 5, 1, 5, 2);
  } else {
    // W hip end (NW-R1-SW, viewed from west)
    idx.push(0, 4, 3);
    // E hip end (SE-R2-NE, viewed from east)
    idx.push(2, 5, 1);
    // N main slope (NW-NE-R2-R1, viewed from north)
    idx.push(0, 1, 5, 0, 5, 4);
    // S main slope (SW-R1-R2-SE, viewed from south)
    idx.push(3, 4, 5, 3, 5, 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(verts, 3),
  );
  geometry.setIndex(idx);
  geometry.computeVertexNormals();

  return {
    geometry,
    ridgePoints: [r1, r2] as [Vec3, Vec3],
    ventPoints: vent,
  };
}
