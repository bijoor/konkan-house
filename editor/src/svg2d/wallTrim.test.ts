import { describe, expect, it } from "vitest";
import { pillarRects, trimSpans, type PillarRect } from "./wallTrim";

describe("pillarRects", () => {
  it("builds top-left-corner footprints matching the DRAWN pillar rectangle", () => {
    const rects = pillarRects([
      { type: "pillar", x: 10, y: 20, width: 10, length: 12 }, // both given → 10×12
      { type: "pillar", x: 0, y: 0, width: 10 }, // length missing → wall_thickness (8), NOT width
      { type: "pillar", x: 50, y: 0, size: 14 }, // square from size
      { type: "pillar", x: 80, y: 0 }, // nothing → wall_thickness square
      { type: "room", x: 5, y: 5 }, // ignored
    ]);
    expect(rects).toEqual([
      { x0: 10, y0: 20, x1: 20, y1: 32 },
      { x0: 0, y0: 0, x1: 10, y1: 8 },
      { x0: 50, y0: 0, x1: 64, y1: 14 },
      { x0: 80, y0: 0, x1: 88, y1: 8 },
    ]);
  });
});

describe("trimSpans — a wall run minus overlapping pillars", () => {
  const wall = { center: 4, start: 0, end: 100, thickness: 8 }; // horizontal band y∈[0,8]

  it("returns the full span when no pillar overlaps", () => {
    expect(trimSpans("h", wall.center, wall.start, wall.end, wall.thickness, [])).toEqual([[0, 100]]);
  });

  it("ignores a pillar that misses the wall's band", () => {
    const far: PillarRect = { x0: 40, y0: 50, x1: 50, y1: 60 }; // y far from [0,8]
    expect(trimSpans("h", wall.center, wall.start, wall.end, wall.thickness, [far])).toEqual([[0, 100]]);
  });

  it("trims an end pillar back to its face", () => {
    const corner: PillarRect = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(trimSpans("h", wall.center, wall.start, wall.end, wall.thickness, [corner])).toEqual([[10, 100]]);
  });

  it("splits around a mid-wall pillar", () => {
    const mid: PillarRect = { x0: 45, y0: 0, x1: 55, y1: 10 };
    expect(trimSpans("h", wall.center, wall.start, wall.end, wall.thickness, [mid])).toEqual([
      [0, 45],
      [55, 100],
    ]);
  });

  it("trims both ends (the common corner-pillar case)", () => {
    const a: PillarRect = { x0: 0, y0: 0, x1: 10, y1: 10 };
    const b: PillarRect = { x0: 90, y0: 0, x1: 100, y1: 10 };
    expect(trimSpans("h", wall.center, wall.start, wall.end, wall.thickness, [a, b])).toEqual([[10, 90]]);
  });

  it("works on the vertical axis too", () => {
    const p: PillarRect = { x0: 0, y0: 0, x1: 10, y1: 10 }; // covers x-band, trims y-start
    expect(trimSpans("v", 4, 0, 100, 8, [p])).toEqual([[10, 100]]);
  });
});
