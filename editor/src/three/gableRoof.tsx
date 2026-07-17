// Gable-roof mesh — two sloping rectangular surfaces meeting at a
// central ridge, with vertical triangular gable-end walls at each
// end of the ridge. Simpler than hip: no hip diagonals, ridge runs
// the full length of the roof.
//
// Geometry recap for ridge_axis='y':
//   eave corners (all at eave_z):
//     NW (xw, yn),  NE (xe, yn),  SE (xe, ys),  SW (xw, ys)
//   ridge endpoints (at eave_z + wall_top_above_eave + ridge_h):
//     R1 = (ridge_x, yn),  R2 = (ridge_x, ys)   with ridge_x = (xw+xe)/2
//   faces:
//     W slope (rect): NW → SW → R2 → R1
//     E slope (rect): NE → R1 → R2 → SE
//     N gable-end wall (tri): NW → R1 → NE
//     S gable-end wall (tri): SE → R2 → SW

import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./coords";
import type { GableRoofGeom } from "../svg2d/roof/gableGeometry";

interface Props {
  geom: GableRoofGeom;
  plotWidth: number;
  plotLength: number;
  color?: string;
  gableWallColor?: string;
  shellLift?: number;
}

export function GableRoofMesh({
  geom,
  plotWidth,
  plotLength,
  color = "#c8582f",
  gableWallColor = "#f5f1e8",
  shellLift = 5,
}: Props) {
  const { slopeGeometry, gableWallGeometry } = useMemo(() => {
    return buildGableRoof(geom, plotWidth, plotLength, shellLift);
  }, [geom, plotWidth, plotLength, shellLift]);

  return (
    <group>
      <mesh geometry={slopeGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      <mesh geometry={gableWallGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={gableWallColor}
          side={THREE.DoubleSide}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

// Split the shell into two BufferGeometries so the sloping tile
// surfaces and the (typically plaster-coloured) gable-end walls can
// take different materials without splitting draw calls per face.
function buildGableRoof(
  g: GableRoofGeom,
  plotWidth: number,
  plotLength: number,
  shellLift: number,
) {
  const t = (wx: number, wy: number, wz: number): Vec3 => ({
    x: wx - plotWidth / 2,
    y: wz,
    z: wy - plotLength / 2,
  });

  const eaveZ = g.eave_z + shellLift;
  const ridgeZ = eaveZ + g.wall_top_above_eave + g.ridge_h;

  // For ridge_axis='y' the ridge runs along Y at the middle X. Its
  // two endpoints are (ridgeMidX, ridge_y_start) and (ridgeMidX,
  // ridge_y_end). Slopes are on the west and east flanks; gable
  // walls close the north + south ends.
  // For ridge_axis='x' everything is rotated 90°: the ridge runs
  // along X at the middle Y; slopes on north + south flanks; gable
  // walls on east + west ends.
  const isY = g.ridge_axis === "y";
  const ridgeMidX = (g.eave_x_west + g.eave_x_east) / 2;
  const ridgeMidY = (g.eave_y_north + g.eave_y_south) / 2;

  const nw = t(g.eave_x_west, g.eave_y_north, eaveZ);
  const ne = t(g.eave_x_east, g.eave_y_north, eaveZ);
  const se = t(g.eave_x_east, g.eave_y_south, eaveZ);
  const sw = t(g.eave_x_west, g.eave_y_south, eaveZ);
  // Ridge endpoints. For y-axis they sit at (mid, ridge_y_start/end);
  // for x-axis at (ridge_x_start/end, mid).
  const r1 = isY
    ? t(ridgeMidX, g.ridge_y_start, ridgeZ)
    : t(g.ridge_x_start, ridgeMidY, ridgeZ);
  const r2 = isY
    ? t(ridgeMidX, g.ridge_y_end, ridgeZ)
    : t(g.ridge_x_end, ridgeMidY, ridgeZ);

  // Vertices — same 6 corners for both axis cases.
  const slopeVerts: number[] = [
    nw.x, nw.y, nw.z, // 0
    ne.x, ne.y, ne.z, // 1
    se.x, se.y, se.z, // 2
    sw.x, sw.y, sw.z, // 3
    r1.x, r1.y, r1.z, // 4
    r2.x, r2.y, r2.z, // 5
  ];

  // Face indices differ by axis. For y-axis:
  //   W slope: NW-SW-R2-R1, E slope: NE-R1-R2-SE
  //   N gable: NW-R1-NE, S gable: SE-R2-SW
  // For x-axis (r1 near west edge, r2 near east):
  //   N slope: NW-R1-R2-NE, S slope: SW-R1... wait let me re-derive.
  // For ridge_axis='x' the ridge runs W→E, so:
  //   R1 = (near west, mid Y, ridgeZ), R2 = (near east, mid Y, ridgeZ)
  //   North slope quad: NW→R1→R2→NE (from outside/north looking south)
  //   South slope quad: SW→SE→R2→R1 (viewed from south)
  //   W gable-end tri: NW→R1→SW
  //   E gable-end tri: NE→SE→R2
  let slopeIdx: number[];
  let gableIdx: number[];
  if (isY) {
    slopeIdx = [
      // W slope (NW-SW-R2-R1)
      0, 3, 5,
      0, 5, 4,
      // E slope (NE-R1-R2-SE)
      1, 4, 5,
      1, 5, 2,
    ];
    gableIdx = [
      // N gable end (NW→R1→NE)
      0, 1, 4,
      // S gable end (SE→R2→SW)
      2, 3, 5,
    ];
  } else {
    // Note: R1 near west (x = ridge_x_start), R2 near east.
    slopeIdx = [
      // N slope (NW-R1-R2-NE)
      0, 4, 5,
      0, 5, 1,
      // S slope (SW-SE-R2-R1)
      3, 5, 4,
      3, 2, 5,
    ];
    gableIdx = [
      // W gable-end (NW-SW-R1)
      0, 3, 4,
      // E gable-end (NE-R2-SE)
      1, 5, 2,
    ];
    // Correct winding: for gable ends viewed from outside, use tris
    // that put the ridge apex between the two eave corners.
    // W end: apex at R1, base NW-SW
    // E end: apex at R2, base NE-SE
    gableIdx = [
      // W gable-end (NW → R1 → SW)
      0, 4, 3,
      // E gable-end (SE → R2 → NE)
      2, 5, 1,
    ];
  }
  // Correct N-gable/S-gable winding (isY): apex at R1 (north) between
  // NW and NE; apex at R2 (south) between SE and SW.
  if (isY) {
    gableIdx = [
      // N gable end apex R1 between NW & NE
      0, 4, 1,
      // S gable end apex R2 between SE & SW
      2, 5, 3,
    ];
  }

  const slopeGeometry = new THREE.BufferGeometry();
  slopeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(slopeVerts, 3),
  );
  slopeGeometry.setIndex(slopeIdx);
  slopeGeometry.computeVertexNormals();

  const gableWallGeometry = new THREE.BufferGeometry();
  gableWallGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(slopeVerts, 3),
  );
  gableWallGeometry.setIndex(gableIdx);
  gableWallGeometry.computeVertexNormals();

  return { slopeGeometry, gableWallGeometry };
}
