// Parity test — legacy shed_roof derivation vs new v2 deriveShedRoof.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveShedRoofGeometry,
  type ShedRoofConfig,
} from "../shedGeometry";
import { oldRectRoofToSegments } from "./adapters";
import { deriveShedRoof, shedSlopeFootprint } from "./deriveShed";

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(here, "..", "..", "..", "..", "public", "templates");

type LegacyObj = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  length?: number;
  slope_dir?: string;
  rise?: number;
  min_pitch_deg?: number;
  min_overhang?: number;
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
}

function findShedRoofs(templates: TemplateFile[]): Case[] {
  const out: Case[] = [];
  for (const t of templates) {
    const floors = t.json.floors ?? [];
    for (let fi = 0; fi < floors.length; fi++) {
      const objs = floors[fi].objects ?? [];
      for (let oi = 0; oi < objs.length; oi++) {
        if (objs[oi].type === "shed_roof") {
          out.push({ templateName: t.name, floorIdx: fi, objIdx: oi, legacy: objs[oi] });
        }
      }
    }
  }
  return out;
}

const templates = loadTemplates();
const cases = findShedRoofs(templates);
const WALL_TOP_Z = 100;

describe("parity: legacy shed_roof vs deriveShedRoof", () => {
  if (cases.length === 0) {
    it.skip("no templates contain shed_roof objects", () => {});
    return;
  }

  for (const c of cases) {
    it(`${c.templateName} floor ${c.floorIdx} obj ${c.objIdx} — slope Z + footprint match`, () => {
      const shedCfg = c.legacy as unknown as ShedRoofConfig;
      const legacyGeom = deriveShedRoofGeometry(
        shedCfg,
        WALL_TOP_Z,
        Number(c.legacy.width ?? 300),
        Number(c.legacy.length ?? 400),
        Number(c.legacy.x ?? 0),
        Number(c.legacy.y ?? 0),
      );

      const v2Cfg = oldRectRoofToSegments(c.legacy);
      const spec = deriveShedRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
      const fp = shedSlopeFootprint(spec);
      expect(fp).not.toBeNull();

      // Footprint bounds should match legacy eave_* bounds.
      expect(fp!.x_min).toBeCloseTo(legacyGeom.eave_x_west, 6);
      expect(fp!.x_max).toBeCloseTo(legacyGeom.eave_x_east, 6);
      expect(fp!.y_min).toBeCloseTo(legacyGeom.eave_y_north, 6);
      expect(fp!.y_max).toBeCloseTo(legacyGeom.eave_y_south, 6);
      // High and low eave Z should match.
      expect(fp!.low_z).toBeCloseTo(legacyGeom.eave_z_low, 6);
      expect(fp!.high_z).toBeCloseTo(legacyGeom.eave_z_high, 6);
    });
  }
});
