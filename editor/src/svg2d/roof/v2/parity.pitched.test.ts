// Parity test — legacy hip_roof / gable_roof derivation vs new v2
// derivePitchedRoof. For every template with a pitched roof, we
// derive geometry via both paths and assert:
//   - Full footprint (eave x/y bounds) matches within 1e-6.
//   - Eave Z matches (accounting for the legacy eaveDrop math).
//   - Ridge Z (apex) matches.
//   - Ridge start/end coordinates match.
//   - Truss count matches.
//
// This proves the v2 code produces the SAME roof envelope as legacy
// on the real templates — the load-bearing correctness gate for
// Step 4.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveHipRoofGeometry } from "../../roofGeometry";
import {
  deriveGableRoofGeometry,
  type GableRoofConfig,
} from "../gableGeometry";
import { oldRectRoofToSegments } from "./adapters";
import {
  derivePitchedRoof,
  pitchedRidge,
  pitchedSlopeFootprint,
} from "./derivePitched";

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(
  here, "..", "..", "..", "..", "public", "templates",
);

type LegacyObj = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  length?: number;
  ridge_axis?: "x" | "y";
  ridge_h?: number;
  min_pitch_deg?: number;
  min_overhang?: number;
  gable_overhang?: number;
  trusses?: { type?: string; positions?: number[] };
  [k: string]: unknown;
};

type TemplateFile = {
  name: string;
  json: { floors?: Array<{ objects?: LegacyObj[] }> };
};

function loadTemplates(): TemplateFile[] {
  if (!fs.existsSync(templatesDir)) return [];
  return fs.readdirSync(templatesDir)
    .filter((f: string) => f.endsWith(".json") && f !== "index.json")
    .map((f: string) => ({
      name: f,
      json: JSON.parse(fs.readFileSync(path.join(templatesDir, f), "utf8")),
    }));
}

interface Case {
  templateName: string;
  floorIdx: number;
  objIdx: number;
  legacy: LegacyObj;
  isHip: boolean;
}

function findPitchedRoofs(templates: TemplateFile[]): Case[] {
  const out: Case[] = [];
  for (const t of templates) {
    const floors = t.json.floors ?? [];
    for (let fi = 0; fi < floors.length; fi++) {
      const objs = floors[fi].objects ?? [];
      for (let oi = 0; oi < objs.length; oi++) {
        const type = objs[oi].type;
        if (type === "hip_roof" || type === "gable_roof") {
          out.push({
            templateName: t.name,
            floorIdx: fi,
            objIdx: oi,
            legacy: objs[oi],
            isHip: type === "hip_roof",
          });
        }
      }
    }
  }
  return out;
}

const templates = loadTemplates();
const cases = findPitchedRoofs(templates);
const WALL_TOP_Z = 100;

describe("parity: legacy hip/gable_roof vs derivePitchedRoof", () => {
  if (cases.length === 0) {
    it.skip("no pitched roofs in templates", () => {});
    return;
  }

  for (const c of cases) {
    const label = `${c.templateName} floor ${c.floorIdx} obj ${c.objIdx} (${c.isHip ? "hip" : "gable"})`;

    it(`${label} — eave Z + ridge Z match`, () => {
      const legacyGeom = c.isHip
        ? (deriveHipRoofGeometry(
            c.legacy,
            WALL_TOP_Z,
            Number(c.legacy.width ?? 300),
            Number(c.legacy.length ?? 400),
            (c.legacy.ridge_axis ?? "y") as string,
            Number(c.legacy.x ?? 0),
            Number(c.legacy.y ?? 0),
          ) as {
            eave_z: number;
            ridge_h: number;
          })
        : (deriveGableRoofGeometry(
            c.legacy as GableRoofConfig,
            WALL_TOP_Z,
            Number(c.legacy.width ?? 300),
            Number(c.legacy.length ?? 400),
            Number(c.legacy.x ?? 0),
            Number(c.legacy.y ?? 0),
          ) as {
            eave_z: number;
            ridge_h: number;
          });
      const legacyRidgeZ = WALL_TOP_Z + legacyGeom.ridge_h;

      const v2Cfg = oldRectRoofToSegments(c.legacy);
      const spec = derivePitchedRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
      const fp = pitchedSlopeFootprint(spec)!;

      expect(fp.eave_z).toBeCloseTo(legacyGeom.eave_z, 6);
      expect(fp.ridge_z).toBeCloseTo(legacyRidgeZ, 6);
    });

    it(`${label} — footprint (eave x/y bounds) match`, () => {
      const legacyGeom = c.isHip
        ? (deriveHipRoofGeometry(
            c.legacy,
            WALL_TOP_Z,
            Number(c.legacy.width ?? 300),
            Number(c.legacy.length ?? 400),
            (c.legacy.ridge_axis ?? "y") as string,
            Number(c.legacy.x ?? 0),
            Number(c.legacy.y ?? 0),
          ) as {
            eave_x_west: number;
            eave_x_east: number;
            eave_y_north: number;
            eave_y_south: number;
          })
        : (deriveGableRoofGeometry(
            c.legacy as GableRoofConfig,
            WALL_TOP_Z,
            Number(c.legacy.width ?? 300),
            Number(c.legacy.length ?? 400),
            Number(c.legacy.x ?? 0),
            Number(c.legacy.y ?? 0),
          ) as {
            eave_x_west: number;
            eave_x_east: number;
            eave_y_north: number;
            eave_y_south: number;
          });

      const v2Cfg = oldRectRoofToSegments(c.legacy);
      const spec = derivePitchedRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
      const fp = pitchedSlopeFootprint(spec)!;

      expect(fp.x_min).toBeCloseTo(legacyGeom.eave_x_west, 6);
      expect(fp.x_max).toBeCloseTo(legacyGeom.eave_x_east, 6);
      expect(fp.y_min).toBeCloseTo(legacyGeom.eave_y_north, 6);
      expect(fp.y_max).toBeCloseTo(legacyGeom.eave_y_south, 6);
    });

    it(`${label} — ridge endpoints match`, () => {
      const axis = (c.legacy.ridge_axis ?? "y") as "x" | "y";
      const roofX = Number(c.legacy.x ?? 0);
      const roofY = Number(c.legacy.y ?? 0);
      const roofW = Number(c.legacy.width ?? 300);
      const roofL = Number(c.legacy.length ?? 400);
      // Legacy hip only sets ridge_y_* for y-axis and ridge_x_* for
      // x-axis (the other pair is undefined). Legacy gable sets both,
      // but with the same interpretation. We read the pair that
      // corresponds to the ridge axis and derive the perpendicular
      // constant (centre) from roof geometry.
      const legacyGeom = c.isHip
        ? (deriveHipRoofGeometry(
            c.legacy,
            WALL_TOP_Z,
            roofW,
            roofL,
            axis,
            roofX,
            roofY,
          ) as Record<string, number | undefined>)
        : (deriveGableRoofGeometry(
            c.legacy as GableRoofConfig,
            WALL_TOP_Z,
            roofW,
            roofL,
            roofX,
            roofY,
          ) as Record<string, number | undefined>);

      const v2Cfg = oldRectRoofToSegments(c.legacy);
      const spec = derivePitchedRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
      const ridge = pitchedRidge(spec)!;

      if (axis === "y") {
        // Ridge runs along Y; perpendicular (X) is constant at centre.
        const centreX = roofX + roofW / 2;
        expect(ridge.start[0]).toBeCloseTo(centreX, 6);
        expect(ridge.end[0]).toBeCloseTo(centreX, 6);
        expect(ridge.start[1]).toBeCloseTo(legacyGeom.ridge_y_start as number, 6);
        expect(ridge.end[1]).toBeCloseTo(legacyGeom.ridge_y_end as number, 6);
      } else {
        // Ridge runs along X; perpendicular (Y) is constant at centre.
        const centreY = roofY + roofL / 2;
        expect(ridge.start[1]).toBeCloseTo(centreY, 6);
        expect(ridge.end[1]).toBeCloseTo(centreY, 6);
        expect(ridge.start[0]).toBeCloseTo(legacyGeom.ridge_x_start as number, 6);
        expect(ridge.end[0]).toBeCloseTo(legacyGeom.ridge_x_end as number, 6);
      }
    });

    if (c.isHip) {
      it(`${label} — truss count matches legacy positions`, () => {
        const expected = c.legacy.trusses?.positions?.length ?? 0;
        const v2Cfg = oldRectRoofToSegments(c.legacy);
        const spec = derivePitchedRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
        expect(spec.trusses.length).toBe(expected);
      });
    }
  }
});
