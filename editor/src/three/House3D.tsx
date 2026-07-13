// Walks the (already expanded) house_config and emits box primitives.
// One <group> per layer so the layer toggles can hide whole buckets by
// toggling the group's `visible` prop.
//
// Walls are rendered with CSG subtraction for their openings so doors
// and windows are actual holes rather than flat overlays. Openings are
// matched to walls by physical position (independent of the opening's
// `direction` field, so direction-override cases like
// Bathroom_2_Entry_N — which sits on Bedroom_3's south wall but faces
// north — resolve to the right wall).

import { useMemo } from "react";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import { deriveForHouse } from "../svg2d/roofGeometry";
import {
  computeFloorZBands,
  readGlobals,
  readPlotBounds,
  toThreePos,
} from "./coords";
import {
  BeamBox,
  FloorSlabBox,
  GroundPlane,
  PillarBox,
  PlinthBox,
} from "./boxes";
import { HipRoofMesh, type HipRoofGeom } from "./roof";
import { StaircaseMesh } from "./staircase";
import { OpeningPane, WallWithOpenings, type WallOpening } from "./wallCSG";
import { DEFAULT_LAYERS, useLayerStore } from "./layers";

interface Obj {
  type: string;
  [k: string]: unknown;
}

const POS_TOL = 2.0; // matches Python's normalize_edge_key tolerance

export function House3D({ config }: { config: HouseConfig }) {
  const visible = useLayerStore((s) => s.visible);

  const byLayer = useMemo(() => {
    const hc = expandRoomWalls(config);
    const globals = readGlobals();
    const plot = readPlotBounds(hc);
    const bands = computeFloorZBands(
      hc.floors ?? [],
      globals.plinthHeight,
      globals.slabThickness,
      globals.floorHeights,
    );

    const groups: Record<string, React.ReactNode[]> = {};
    const push = (layer: string, node: React.ReactNode) => {
      (groups[layer] ??= []).push(node);
    };

    // Hip roof — derived geometry (matches roof_geometry.py).
    try {
      const derived = deriveForHouse(
        hc as unknown as Parameters<typeof deriveForHouse>[0],
        DEFAULT_GLOBAL_CONFIG,
      );
      if (derived) {
        let hipConfig: Obj | undefined;
        for (const floor of hc.floors ?? []) {
          for (const obj of (floor.objects as Obj[] | undefined) ?? []) {
            if (obj.type === "hip_roof") { hipConfig = obj; break; }
          }
          if (hipConfig) break;
        }
        const n = (k: string) => derived[k] as number;
        const merged: HipRoofGeom = {
          eave_x_west: n("eave_x_west"),
          eave_x_east: n("eave_x_east"),
          eave_y_north: n("eave_y_north"),
          eave_y_south: n("eave_y_south"),
          eave_z: n("eave_z"),
          ridge_y_start: n("ridge_y_start"),
          ridge_y_end: n("ridge_y_end"),
          ridge_h: n("ridge_h"),
          ridge_axis:
            (hipConfig?.ridge_axis as "y" | "x" | undefined) ??
            (derived.ridge_axis as "y" | "x"),
          ridge_ext_u: derived.ridge_ext_u as number | undefined,
        };
        push(
          "loft",
          <HipRoofMesh
            key="hip-roof"
            geom={merged}
            plotWidth={plot.width}
            plotLength={plot.length}
          />,
        );
      }
    } catch { /* under-specified — skip */ }

    // Plinth
    if (hc.plinth) {
      const p = hc.plinth as {
        x: number; y: number; width: number; length: number; height: number;
      };
      const c = toThreePos(p.x + p.width / 2, p.y + p.length / 2, 0, plot.width, plot.length);
      push(
        "plinth",
        <PlinthBox
          key="plinth"
          cx={c.x}
          cz={c.z}
          width={p.width}
          length={p.length}
          height={p.height}
        />,
      );
    }

    // Per-floor: index openings by physical position first, then emit
    // walls with position-matched openings.
    for (let fi = 0; fi < (hc.floors ?? []).length; fi++) {
      const floor = hc.floors![fi];
      const band = bands[fi];
      const objects = (floor.objects as Obj[] | undefined) ?? [];
      const floorNum = (floor.floor_number as number) ?? fi;
      const roomLayer = floorNum === 0 ? "f0" : "f1";
      const slabLayer = floorNum === 0 ? "plinth" : "f1_slab";
      const openings = objects.filter((o) => o.type === "door" || o.type === "window");

      for (let oi = 0; oi < objects.length; oi++) {
        const obj = objects[oi];
        const key = `f${fi}-${oi}`;

        if (obj.type === "floor_slab") {
          const x = obj.x as number, y = obj.y as number;
          const w = obj.width as number, l = obj.length as number;
          const c = toThreePos(x + w / 2, y + l / 2, 0, plot.width, plot.length);
          push(
            slabLayer,
            <FloorSlabBox
              key={key}
              cx={c.x}
              cz={c.z}
              width={w}
              length={l}
              z={band.slabZ}
              thickness={globals.slabThickness}
            />,
          );
        } else if (obj.type === "beam") {
          const x = obj.x as number, y = obj.y as number;
          const w = obj.width as number, l = obj.length as number;
          const h = (obj.height as number | undefined) ?? globals.beamSize;
          const c = toThreePos(x + w / 2, y + l / 2, 0, plot.width, plot.length);
          push(
            "f1_beam",
            <BeamBox
              key={key}
              cx={c.x}
              cz={c.z}
              width={w}
              length={l}
              z={band.slabZ}
              height={h}
            />,
          );
        } else if (obj.type === "pillar") {
          const x = obj.x as number, y = obj.y as number;
          const w = (obj.width as number | undefined) ?? (obj.size as number | undefined) ?? globals.wallThickness;
          const l = (obj.length as number | undefined) ?? (obj.size as number | undefined) ?? globals.wallThickness;
          const h = (obj.height as number | undefined) ?? band.floorHeight;
          const c = toThreePos(x, y, 0, plot.width, plot.length);
          push(
            "pillars",
            <PillarBox
              key={key}
              cx={c.x}
              cz={c.z}
              width={w}
              length={l}
              z={globals.plinthHeight}
              height={h}
            />,
          );
        } else if (obj.type === "room") {
          emitRoomWalls(obj, band, globals, plot, key, openings, push, roomLayer);
        } else if (obj.type === "wall") {
          emitStandaloneWall(obj, band, globals, plot, key, openings, push, roomLayer);
        } else if (obj.type === "staircase") {
          // Supports the "new" schema (start_x/start_y + step_* +
          // compass direction). Legacy format (x/y/width/length) can be
          // added later — the current house_config uses only the new one.
          const startX = obj.start_x as number;
          const startY = obj.start_y as number;
          const numSteps = (obj.num_steps as number | undefined) ?? 10;
          const stepWidth = (obj.step_width as number | undefined) ?? 30;
          const stepTread = (obj.step_tread as number | undefined) ?? 10;
          const stepRise = (obj.step_rise as number | undefined) ?? 5;
          const direction =
            (obj.direction as "north" | "south" | "east" | "west" | undefined) ?? "north";
          push(
            slabLayer,
            <StaircaseMesh
              key={key}
              startX={startX}
              startY={startY}
              numSteps={numSteps}
              stepWidth={stepWidth}
              stepTread={stepTread}
              stepRise={stepRise}
              direction={direction}
              wallZ={band.wallZ}
              plotWidth={plot.width}
              plotLength={plot.length}
            />,
          );
        }
        // door/window: emitted alongside their wall via WallWithOpenings +
        // OpeningPane. No standalone rendering.
      }
    }

    return groups;
  }, [config]);

  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);

  return (
    <>
      {visible.ground !== false && (
        <GroundPlane width={plot.width} length={plot.length} />
      )}
      {DEFAULT_LAYERS.map((l) => (
        <group key={l.id} visible={visible[l.id] !== false}>
          {byLayer[l.id]}
        </group>
      ))}
    </>
  );
}

// ---- helpers -------------------------------------------------------

type PushFn = (layer: string, node: React.ReactNode) => void;

interface Band {
  slabZ: number; wallZ: number; wallTop: number; floorHeight: number;
}
interface Globals {
  wallThickness: number;
  plinthHeight: number;
  slabThickness: number;
  roofThickness: number;
  beamSize: number;
  floorHeights: Record<number, number>;
}
interface Plot { width: number; length: number }

function heightFor(
  room: Obj,
  side: string,
  defaultH: number,
): number {
  const wh = (room.wall_heights as Record<string, unknown> | undefined) ?? {};
  const entry = wh[side];
  if (typeof entry === "number") return entry;
  if (entry && typeof entry === "object") {
    const h = (entry as { height?: number }).height;
    if (typeof h === "number") return h;
  }
  const h = room.height as number | undefined;
  return h ?? defaultH;
}

// Match an opening to a wall by physical position (independent of the
// opening's `direction` field, which can be overridden). Returns the
// `along` and `from` offsets in the wall's local frame if it matches.
function matchOpeningToRoomWall(
  op: Obj,
  side: "north" | "south" | "east" | "west",
  rx: number, ry: number, rw: number, rl: number, t: number,
): WallOpening | null {
  const x = op.x as number, y = op.y as number;
  const w = op.width as number, h = op.height as number;
  const kind = op.type as "door" | "window";
  const sill = kind === "window" ? ((op.sill_height as number | undefined) ?? 0) : 0;

  if (side === "north") {
    // Wall at y ~ ry
    if (Math.abs(y - ry) > POS_TOL) return null;
    if (x < rx - POS_TOL || x + w > rx + rw + POS_TOL) return null;
    return { along: x - rx, from: sill, width: w, height: h, kind };
  }
  if (side === "south") {
    if (Math.abs(y - (ry + rl - t)) > POS_TOL) return null;
    if (x < rx - POS_TOL || x + w > rx + rw + POS_TOL) return null;
    return { along: x - rx, from: sill, width: w, height: h, kind };
  }
  if (side === "west") {
    if (Math.abs(x - rx) > POS_TOL) return null;
    if (y < ry - POS_TOL || y + w > ry + rl + POS_TOL) return null;
    return { along: y - ry, from: sill, width: w, height: h, kind };
  }
  // east
  if (Math.abs(x - (rx + rw - t)) > POS_TOL) return null;
  if (y < ry - POS_TOL || y + w > ry + rl + POS_TOL) return null;
  return { along: y - ry, from: sill, width: w, height: h, kind };
}

function matchOpeningToStandaloneWall(
  op: Obj,
  sx: number, sy: number, ex: number, ey: number, t: number,
): WallOpening | null {
  const dx = ex - sx, dy = ey - sy;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;
  const ux = dx / length, uy = dy / length;
  const x = op.x as number, y = op.y as number;
  const w = op.width as number, h = op.height as number;
  const kind = op.type as "door" | "window";
  const sill = kind === "window" ? ((op.sill_height as number | undefined) ?? 0) : 0;

  // Project (x, y) onto the wall's line.
  // The expander shifts the opening's world coord by -t/2 along the
  // wall's normal (see wall_opening_to_flat), so project from the
  // opening's "outer" side back to the wall centreline.
  const halfT = t / 2;
  const nx = -uy, ny = ux; // perpendicular (normal), rotated 90° CCW
  const cx = x + halfT * Math.abs(nx);
  const cy = y + halfT * Math.abs(ny);
  const proj = (cx - sx) * ux + (cy - sy) * uy;
  const perp = Math.abs((cx - sx) * nx + (cy - sy) * ny);
  if (perp > POS_TOL) return null;
  if (proj < -POS_TOL || proj + w > length + POS_TOL) return null;
  return { along: proj, from: sill, width: w, height: h, kind };
}

function emitRoomWalls(
  obj: Obj,
  band: Band,
  globals: Globals,
  plot: Plot,
  key: string,
  openings: Obj[],
  push: PushFn,
  layer: string,
) {
  const rawWalls = obj.walls as string[] | Record<string, unknown> | undefined;
  const wallsList: string[] = rawWalls
    ? Array.isArray(rawWalls) ? rawWalls : Object.keys(rawWalls)
    : ["north", "south", "east", "west"];
  const rx = obj.x as number, ry = obj.y as number;
  const rw = obj.width as number, rl = obj.length as number;
  const t = (obj.wall_thickness as number | undefined) ?? globals.wallThickness;

  for (const sideRaw of wallsList) {
    const side = sideRaw.toLowerCase() as "north" | "south" | "east" | "west";
    const wh = heightFor(obj, side, band.floorHeight);

    const matched: WallOpening[] = [];
    for (const op of openings) {
      const m = matchOpeningToRoomWall(op, side, rx, ry, rw, rl, t);
      if (m) matched.push(m);
    }

    let cxW: number, cyW: number, wallLen: number, rotY: number;
    if (side === "north") {
      cxW = rx + rw / 2; cyW = ry + t / 2; wallLen = rw; rotY = 0;
    } else if (side === "south") {
      cxW = rx + rw / 2; cyW = ry + rl - t / 2; wallLen = rw; rotY = 0;
    } else if (side === "east") {
      cxW = rx + rw - t / 2; cyW = ry + rl / 2; wallLen = rl - 2 * t; rotY = -Math.PI / 2;
    } else {
      cxW = rx + t / 2; cyW = ry + rl / 2; wallLen = rl - 2 * t; rotY = -Math.PI / 2;
    }
    // East/west walls are inset from N/S walls by `t` on each end to
    // avoid double-counting corners — shift the matched openings' along
    // offset accordingly.
    if (side === "east" || side === "west") {
      for (const m of matched) m.along -= t;
    }
    const c = toThreePos(cxW, cyW, 0, plot.width, plot.length);

    push(
      layer,
      <WallWithOpenings
        key={`${key}-${side}`}
        cx={c.x}
        cy={band.wallZ + wh / 2}
        cz={c.z}
        length={wallLen}
        depth={t}
        height={wh}
        rotY={rotY}
        color="#f5c9a0"
        openings={matched}
      />,
    );
    // Paint a translucent pane back into each opening so windows read
    // as glass and doors as timber panels.
    for (const m of matched) {
      const localAlong = m.along + m.width / 2 - wallLen / 2;
      const localFrom = m.from + m.height / 2 - wh / 2;
      // Move the pane onto the same rotation frame as the wall.
      const dx = Math.cos(rotY) * localAlong + Math.sin(rotY) * 0;
      const dz = -Math.sin(rotY) * localAlong + Math.cos(rotY) * 0;
      push(
        "openings",
        <OpeningPane
          key={`${key}-${side}-op-${m.along.toFixed(2)}`}
          cx={c.x + dx}
          cy={band.wallZ + wh / 2 + localFrom}
          cz={c.z + dz}
          width={m.width}
          height={m.height}
          rotY={rotY}
          kind={m.kind}
          wallDepth={t}
        />,
      );
    }
  }
}

function emitStandaloneWall(
  obj: Obj,
  band: Band,
  globals: Globals,
  plot: Plot,
  key: string,
  openings: Obj[],
  push: PushFn,
  layer: string,
) {
  const sx = obj.start_x as number, sy = obj.start_y as number;
  const ex = obj.end_x as number, ey = obj.end_y as number;
  const t = (obj.thickness as number | undefined) ?? globals.wallThickness;
  const h = (obj.height as number | undefined) ?? band.floorHeight;
  const dx = ex - sx, dy = ey - sy;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 1e-6) return;
  const rotY = Math.atan2(-dy, dx);

  const matched: WallOpening[] = [];
  for (const op of openings) {
    const m = matchOpeningToStandaloneWall(op, sx, sy, ex, ey, t);
    if (m) matched.push(m);
  }

  const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
  const c = toThreePos(midX, midY, 0, plot.width, plot.length);
  push(
    layer,
    <WallWithOpenings
      key={key}
      cx={c.x}
      cy={band.wallZ + h / 2}
      cz={c.z}
      length={wallLen}
      depth={t}
      height={h}
      rotY={rotY}
      color="#f5c9a0"
      openings={matched}
    />,
  );
  for (const m of matched) {
    const localAlong = m.along + m.width / 2 - wallLen / 2;
    const localFrom = m.from + m.height / 2 - h / 2;
    const dxL = Math.cos(rotY) * localAlong;
    const dzL = -Math.sin(rotY) * localAlong;
    push(
      "openings",
      <OpeningPane
        key={`${key}-op-${m.along.toFixed(2)}`}
        cx={c.x + dxL}
        cy={band.wallZ + h / 2 + localFrom}
        cz={c.z + dzL}
        width={m.width}
        height={m.height}
        rotY={rotY}
        kind={m.kind}
        wallDepth={t}
      />,
    );
  }
}
