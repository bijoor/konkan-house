// Port of svg_2d.py::generate_combined_elevations. Uses the same regex
// tag-depth splicing pattern as floorPlansCombined.ts. Assembles the
// four elevation views side-by-side (left, front, right, back — the
// standard architectural order) with a header title and per-view labels
// beneath. Byte-identical output vs the checked-in
// docs/elevations_combined.svg.

import { expandRoomWalls, type HouseConfig } from "./expand";
import { generateElevationView } from "./elevationView";
import { scaledTextSize } from "./config";
import { f, fFloat } from "./format";

interface ElevationEntry {
  view: string;
  label: string;
  content: string;
  canvasWidth: number;
  canvasHeight: number;
  translateX: number;
  contentWidth: number;
}

export function generateCombinedElevations(houseConfig: HouseConfig): string {
  const hc = expandRoomWalls(houseConfig, undefined, { lenient: true });
  const scale = 2.0;
  const spacing = 100;
  const leftRightMargin = 80;
  const topMargin = 60;
  const bottomMargin = 120;
  const titleSpace = 40;
  const labelOffset = 30;

  const views: Array<[string, string]> = [
    ["left", "Left Elevation"],
    ["front", "Front Elevation"],
    ["right", "Right Elevation"],
    ["back", "Back Elevation"],
  ];

  const elevationData: ElevationEntry[] = [];
  for (const [viewType, viewLabel] of views) {
    const svgContent = generateElevationView(
      hc,
      viewType as "front" | "back" | "left" | "right",
      scale,
    );

    const transformPattern =
      /<g transform="translate\(([0-9.]+),\s*([0-9.]+)\)\s*scale\([^)]+\)">/;
    const transformMatch = transformPattern.exec(svgContent);
    if (!transformMatch) continue;

    const translateX = Number(transformMatch[1]);
    const translateY = Number(transformMatch[2]);
    const startPos = transformMatch.index + transformMatch[0].length;

    let depth = 1;
    let pos = startPos;
    let contentOnly = "";
    while (depth > 0 && pos < svgContent.length) {
      const nextOpen = svgContent.indexOf("<g ", pos);
      const nextClose = svgContent.indexOf("</g>", pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 3;
      } else {
        depth -= 1;
        if (depth === 0) {
          contentOnly = svgContent.slice(startPos, nextClose);
          break;
        }
        pos = nextClose + 4;
      }
    }
    if (depth !== 0) continue;

    // Python emits `translate({translate_x}, {translate_y})` where these
    // are Python floats (parsed via `float()` from the regex match). So
    // even integer values render "150.0".
    const drawingContent = `<g transform="translate(${fFloat(translateX)}, ${fFloat(translateY)}) scale(2.0, 2.0)">\n${contentOnly}\n</g>`;

    const svgMatch = /<svg[^>]+width="([0-9.]+)"[^>]+height="([0-9.]+)"/.exec(svgContent);
    const svgWidth = svgMatch ? Number(svgMatch[1]) : 1000;
    const svgHeight = svgMatch ? Number(svgMatch[2]) : 800;

    // Content width spans the plot (matches generateElevationView's canvas).
    const site = (houseConfig.site as Record<string, unknown> | undefined) ?? {};
    let baseContentWidth: number;
    if (viewType === "front" || viewType === "back") {
      baseContentWidth = (site.plot_width as number | undefined) ?? 0;
    } else {
      baseContentWidth = (site.plot_length as number | undefined) ?? 0;
    }
    const contentScale = scale;
    const scaledContentWidth = baseContentWidth * contentScale;

    elevationData.push({
      view: viewType,
      label: viewLabel,
      content: drawingContent,
      canvasWidth: svgWidth,
      canvasHeight: svgHeight,
      translateX,
      contentWidth: scaledContentWidth,
    });
  }

  if (elevationData.length === 0) return "";

  const maxHeight = Math.max(...elevationData.map((e) => e.canvasHeight));
  const totalWidth =
    elevationData.reduce((s, e) => s + e.canvasWidth, 0) +
    spacing * (elevationData.length - 1);

  let canvasWidth = totalWidth + 2 * leftRightMargin;
  const canvasHeight = titleSpace + topMargin + maxHeight + labelOffset + bottomMargin;

  // canvas_width is `total_width + 2 * 80`. total_width contains float
  // (canvas_width parsed as float). So canvas_width is float.
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${fFloat(canvasWidth)}" height="${fFloat(canvasHeight)}" viewBox="0 0 ${fFloat(canvasWidth)} ${fFloat(canvasHeight)}">
<title>All Elevations</title>
<defs>
    <style>
        text { font-family: Arial, sans-serif; }
        .view-label { font-size: ${scaledTextSize(16)}px; font-weight: bold; fill: #333; }
    </style>
</defs>
`;

  const titleY = titleSpace - 10;
  svg += `<text x="${fFloat(canvasWidth / 2)}" y="${f(titleY)}" text-anchor="middle" font-size="${scaledTextSize(20)}" font-weight="bold" fill="#333">All Elevations</text>\n`;

  const labelY = titleSpace + topMargin + maxHeight + labelOffset;
  let currentX = leftRightMargin;
  // Python: current_x is int on the first iteration (80) then float after
  // adding canvas_width (float). Track the taint like floorPlansCombined.
  let currentXIsFloat = false;
  const contentStartY = titleSpace + topMargin;
  for (const elev of elevationData) {
    // Reassign local canvasWidth per Python (shadows outer name).
    canvasWidth = elev.canvasWidth;
    const translateXLocal = elev.translateX;
    void translateXLocal;
    void elev.contentWidth;

    svg += `<g id="elevation_${elev.view}">\n`;
    const cxStr = currentXIsFloat ? fFloat(currentX) : f(currentX);
    svg += `<g transform="translate(${cxStr}, ${f(contentStartY)})">\n`;
    svg += elev.content;
    svg += "</g>\n";
    // label_x = current_x + canvas_width / 2. canvas_width is float.
    const labelX = currentX + canvasWidth / 2;
    svg += `<text x="${fFloat(labelX)}" y="${fFloat(labelY)}" text-anchor="middle" class="view-label">${elev.label}</text>\n`;
    svg += "</g>\n";
    currentX += canvasWidth + spacing;
    currentXIsFloat = true;
  }

  svg += "</svg>";
  return svg;
}
