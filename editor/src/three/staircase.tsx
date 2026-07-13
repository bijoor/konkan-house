// Staircase — one box per step, each rising `step_rise` above the last.
// The whole stack sits on the floor slab (its bottom at wall_z) so each
// step reads as a stair "block" filled up to that height, giving the
// familiar silhouette in section view.
//
// Compass direction convention (matches Python's elevation code):
//   start_x, start_y = plan-view position of the BOTTOM step's near edge
//   'north' → steps march northward (Y decreases) as they rise
//   'south' → southward (Y increases)
//   'east'  → eastward (X increases)
//   'west'  → westward (X decreases)

import type { Vec3 } from "./coords";
import { toThreePos } from "./coords";

export interface StaircaseProps {
  startX: number;
  startY: number;
  numSteps: number;
  stepWidth: number;
  stepTread: number;
  stepRise: number;
  direction: "north" | "south" | "east" | "west";
  wallZ: number;
  plotWidth: number;
  plotLength: number;
  color?: string;
}

export function StaircaseMesh({
  startX, startY, numSteps, stepWidth, stepTread, stepRise, direction,
  wallZ, plotWidth, plotLength, color = "#c19a6b",
}: StaircaseProps) {
  const steps: React.ReactNode[] = [];
  const isNS = direction === "north" || direction === "south";

  for (let i = 0; i < numSteps; i++) {
    const stepTopZ = wallZ + (i + 1) * stepRise;
    const stepHeight = (i + 1) * stepRise;

    // Compute the plan-view corner of step i.
    let x: number, y: number;
    if (direction === "north") {
      x = startX;
      y = startY - (i + 1) * stepTread;
    } else if (direction === "south") {
      x = startX;
      y = startY + i * stepTread;
    } else if (direction === "east") {
      x = startX + i * stepTread;
      y = startY;
    } else {
      x = startX - (i + 1) * stepTread;
      y = startY;
    }

    const w = isNS ? stepWidth : stepTread;
    const l = isNS ? stepTread : stepWidth;
    // Centre in world coords, then Three coords via toThreePos.
    const c = toThreePos(x + w / 2, y + l / 2, 0, plotWidth, plotLength);
    steps.push(
      <mesh
        key={i}
        position={[c.x, wallZ + stepHeight / 2, c.z]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, stepHeight, l]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>,
    );
    void stepTopZ;
  }

  return <group>{steps}</group>;
}

// Kept exported for potential future use in a top-down thumbnail; not
// currently wired.
export function staircaseFootprint(
  props: Pick<StaircaseProps, "startX" | "startY" | "numSteps" | "stepWidth" | "stepTread" | "direction">,
): { x: number; y: number; width: number; length: number } {
  const { startX, startY, numSteps, stepWidth, stepTread, direction } = props;
  const total = numSteps * stepTread;
  if (direction === "north") return { x: startX, y: startY - total, width: stepWidth, length: total };
  if (direction === "south") return { x: startX, y: startY, width: stepWidth, length: total };
  if (direction === "east")  return { x: startX, y: startY, width: total, length: stepWidth };
  return { x: startX - total, y: startY, width: total, length: stepWidth };
}

// Vec3 is re-exported so callers importing StaircaseMesh don't also need
// to reach into ./coords for the type.
export type { Vec3 };
