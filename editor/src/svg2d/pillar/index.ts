// Public entry points for the pillar SVG generator port.
//
// Mirrors svg_2d.py:
//   - generate_pillar_elevation_view (per side: front/back/left/right)
//   - generate_pillar_section_view   (per internal row/column)
//   - generate_all_pillar_elevations (dispatcher — 4 elevations + N sections)

import type { HouseConfig } from "../expand";
import {
  collectGroundFloorPillars,
  clusterPillarsByAxis,
  PILLAR_CLUSTER_TOLERANCE,
} from "./cluster";
import { renderPillarView } from "./render";
import type { ViewType } from "./project";

export interface PillarSvgFile {
  filename: string;
  content: string;
  // Human-readable label for the tab picker / manifest.
  label: string;
}

const ELEVATION_LABELS: Record<ViewType, string> = {
  front: "Front Elevation",
  back: "Back Elevation",
  left: "Left Elevation",
  right: "Right Elevation",
};

export function generatePillarElevationView(
  houseConfig: HouseConfig,
  viewType: ViewType,
  scale = 2.0,
): string {
  const pillars = collectGroundFloorPillars(houseConfig);
  const axis: "x" | "y" = (viewType === "front" || viewType === "back") ? "y" : "x";
  const clusters = clusterPillarsByAxis(pillars, axis, PILLAR_CLUSTER_TOLERANCE);
  if (clusters.length === 0) {
    throw new Error("No ground-floor pillars to draw");
  }
  const chosen = (viewType === "front" || viewType === "left")
    ? clusters[0]
    : clusters[clusters.length - 1];

  const title = `${ELEVATION_LABELS[viewType]} - Pillars &amp; Slabs`;
  return renderPillarView(houseConfig, {
    viewType,
    pillarsToShow: chosen.pillars,
    title,
    scale,
    allPillars: pillars,
  });
}

// Matches svg_2d.py::_section_label
function sectionLabel(axis: "x" | "y", index: number): string {
  if (axis === "y") {
    const letter = String.fromCharCode("A".charCodeAt(0) + index);
    return `${letter}-${letter}`;
  }
  return `${index + 1}-${index + 1}`;
}

// Matches svg_2d.py::_section_filename_part
function sectionFilenamePart(axis: "x" | "y", index: number): string {
  if (axis === "y") {
    const letter = String.fromCharCode("A".charCodeAt(0) + index).toLowerCase();
    return `row_${letter}`;
  }
  return `col_${index + 1}`;
}

export function generatePillarSectionView(
  houseConfig: HouseConfig,
  axis: "x" | "y",
  clusterIndex: number,
  scale = 2.0,
): string {
  const pillars = collectGroundFloorPillars(houseConfig);
  const clusters = clusterPillarsByAxis(pillars, axis, PILLAR_CLUSTER_TOLERANCE);
  if (!(clusterIndex >= 0 && clusterIndex < clusters.length)) {
    throw new RangeError(
      `clusterIndex ${clusterIndex} out of range (have ${clusters.length} ${axis}-clusters)`,
    );
  }
  const chosen = clusters[clusterIndex];
  const viewType: ViewType = axis === "y" ? "front" : "left";
  const label = sectionLabel(axis, clusterIndex);
  const title = `Section ${label} - Pillars &amp; Slabs`;

  return renderPillarView(houseConfig, {
    viewType,
    pillarsToShow: chosen.pillars,
    title,
    scale,
    allPillars: pillars,
  });
}

// End-to-end dispatcher matching generate_all_pillar_elevations.
// Returns everything in memory (browser-safe). Callers that want to
// write to disk map over the returned array.
export function generateAllPillarSvgs(houseConfig: HouseConfig): PillarSvgFile[] {
  const pillars = collectGroundFloorPillars(houseConfig);
  const yClusters = clusterPillarsByAxis(pillars, "y", PILLAR_CLUSTER_TOLERANCE);
  const xClusters = clusterPillarsByAxis(pillars, "x", PILLAR_CLUSTER_TOLERANCE);
  const out: PillarSvgFile[] = [];

  // 4 outer elevations
  for (const viewType of ["front", "back", "left", "right"] as ViewType[]) {
    out.push({
      filename: `pillar_elevation_${viewType}.svg`,
      content: generatePillarElevationView(houseConfig, viewType),
      label: ELEVATION_LABELS[viewType],
    });
  }

  // Internal Y-row sections (skip first + last; those are front/back)
  for (let idx = 1; idx < yClusters.length - 1; idx++) {
    const label = sectionLabel("y", idx);
    const suffix = sectionFilenamePart("y", idx);
    out.push({
      filename: `pillar_section_${suffix}.svg`,
      content: generatePillarSectionView(houseConfig, "y", idx),
      label: `Row ${label}`,
    });
  }

  // Internal X-column sections (skip first + last; those are left/right)
  for (let idx = 1; idx < xClusters.length - 1; idx++) {
    const label = sectionLabel("x", idx);
    const suffix = sectionFilenamePart("x", idx);
    out.push({
      filename: `pillar_section_${suffix}.svg`,
      content: generatePillarSectionView(houseConfig, "x", idx),
      label: `Column ${label}`,
    });
  }

  return out;
}
