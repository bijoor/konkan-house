// Public entry point for the roof SVG generator port. Mirrors the
// end-to-end behaviour of svg_2d.py::generate_roof_sections_svg — takes a
// house config JSON blob, writes 14 SVGs + one JSON manifest to `outDir`.

import fs from "node:fs";
import path from "node:path";
import { expandRoomWalls, type HouseConfig } from "../expand";
import { computeAll } from "./geometry";
import { computeLayout } from "./layout";
import { compose } from "./compose";
import { splitPanels } from "./manifest";

export function generateRoofSectionsSvg(cfg: HouseConfig, outDir: string): void {
  const hc = expandRoomWalls(cfg);
  const computed = computeAll(hc);
  if (!computed) return;
  const layout = computeLayout(computed);
  const { masterSvg, panels } = compose(computed, layout);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "roof_plan.svg"), masterSvg, "utf8");

  const { files, manifestJson } = splitPanels(panels);
  for (const { filename, content } of files) {
    fs.writeFileSync(path.join(outDir, filename), content, "utf8");
  }
  fs.writeFileSync(path.join(outDir, "roof_panels.json"), manifestJson, "utf8");
}
