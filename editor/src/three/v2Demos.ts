// Hardcoded multi-segment demo configs for the v2 preview.
//
// These bypass the compat adapter (which only handles single-segment
// legacy configs) and drive the v2 pipeline directly, so you can
// see joint resolution working (valley members at inside corners,
// ridges meeting cleanly at joints) BEFORE the editor form UI for
// authoring multi-segment configs lands.
//
// All configs fit inside a 500×500 plot at wall_top_z ≈ 100. They
// use `default_endpoint: "closed"` — classical hip appearance.

import type { RoofConfig } from "../svg2d/roof/v2/model";

export type V2DemoId =
  | "house"        // = use the loaded house config; no demo overlay
  | "lshape"
  | "ushape"
  | "courtyard"
  | "dutch_gable"
  | "shed_lshape_hip"
  | "shed_lshape_valley";

export interface V2Demo {
  id: V2DemoId;
  label: string;
  description: string;
  config: RoofConfig;
}

const commonPitched = {
  slope: { by: "height" as const, ridge_h: 50 },
  min_overhang: 25,
};

const commonShed = {
  slope: { by: "height" as const, ridge_h: 30 },
  min_overhang: 20,
};

export const V2_DEMOS: V2Demo[] = [
  {
    id: "lshape",
    label: "L-shape (2 segs)",
    description: "Two hip roofs meeting at 90° — expect ONE valley from joint apex to inside corner.",
    config: {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "a", start: [150, 50], end: [150, 300], width: 300 },
        { id: "b", start: [150, 300], end: [450, 300], width: 200 },
      ],
      default_endpoint: "closed",
      ...commonPitched,
    },
  },
  {
    id: "ushape",
    label: "U-shape (3 segs)",
    description: "Three connected wings — expect TWO valleys at the two inside corners.",
    config: {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "west", start: [50, 50], end: [50, 400], width: 100 },
        { id: "south", start: [50, 400], end: [450, 400], width: 100 },
        { id: "east", start: [450, 400], end: [450, 50], width: 100 },
      ],
      default_endpoint: "closed",
      ...commonPitched,
    },
  },
  {
    id: "courtyard",
    label: "Courtyard (4 segs)",
    description: "Ring of four wings — all endpoints joint, expect FOUR valleys converging on the inside courtyard corners.",
    config: {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "n", start: [50, 50], end: [450, 50], width: 100 },
        { id: "e", start: [450, 50], end: [450, 450], width: 100 },
        { id: "s", start: [450, 450], end: [50, 450], width: 100 },
        { id: "w", start: [50, 450], end: [50, 50], width: 100 },
      ],
      default_endpoint: "closed",
      ...commonPitched,
    },
  },
  {
    id: "shed_lshape_hip",
    label: "Shed L-shape (hip corner)",
    description: "Two shed segments meeting at 90°; both HIGH edges on the inside → HIP line down from inside corner to segment endpoint.",
    config: {
      type: "roof",
      roof_type: "shed",
      segments: [
        {
          id: "a",
          start: [50, 100],
          end: [300, 100],
          width: 100,
          shed_high_side: "left",
        },
        {
          id: "b",
          start: [300, 100],
          end: [300, 400],
          width: 100,
          shed_high_side: "left",
        },
      ],
      ...commonShed,
    },
  },
  {
    id: "shed_lshape_valley",
    label: "Shed L-shape (valley corner)",
    description: "Same segments; both LOW edges on the inside → VALLEY line up from inside corner to segment endpoint (water pools).",
    config: {
      type: "roof",
      roof_type: "shed",
      segments: [
        {
          id: "a",
          start: [50, 100],
          end: [300, 100],
          width: 100,
          shed_high_side: "right",
        },
        {
          id: "b",
          start: [300, 100],
          end: [300, 400],
          width: 100,
          shed_high_side: "right",
        },
      ],
      ...commonShed,
    },
  },
  {
    id: "dutch_gable",
    label: "Dutch gable (1 seg)",
    description: "Single segment: open (gable) on start, closed (hip) on end. Formerly needed a special roof type; v2 gets it with one endpoint flip.",
    config: {
      type: "roof",
      roof_type: "pitched",
      segments: [
        {
          id: "s0",
          start: [150, 50],
          end: [150, 450],
          width: 300,
          start_endpoint: "open",
          end_endpoint: "closed",
          gable_overhang_start: 15,
        },
      ],
      ...commonPitched,
    },
  },
];

export function findDemo(id: V2DemoId | undefined): V2Demo | undefined {
  if (!id || id === "house") return undefined;
  return V2_DEMOS.find((d) => d.id === id);
}
