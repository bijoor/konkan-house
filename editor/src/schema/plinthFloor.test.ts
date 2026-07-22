import { describe, expect, it } from "vitest";
import { validate } from "./houseConfig";
import { findPlinthObject, plinthGeom } from "./plinthFloor";

const migrated = {
  site: { reference_x: 0, reference_y: 0, plot_width: 100, plot_length: 200 },
  floors: [
    { floor_number: 0, name: "Plinth", height: 30, objects: [
      { type: "ground", x: 0, y: 0, width: 100, length: 200 },
      { type: "plinth", x: 0, y: 0, width: 100, length: 200, height: 30 },
    ] },
    { floor_number: 1, name: "Ground Floor", objects: [{ type: "room", name: "R", x: 0, y: 0, width: 10, length: 10 }] },
    { floor_number: 2, name: "First Floor", objects: [] },
  ],
};

// Legacy: top-level plinth, no Plinth floor, ground floor is number 0.
const legacy = {
  site: { reference_x: 0, reference_y: 0, plot_width: 100, plot_length: 200 },
  plinth: { x: 0, y: 0, width: 100, length: 200, height: 30 },
  floors: [
    { floor_number: 0, name: "Ground Floor", objects: [{ type: "room", name: "R", x: 0, y: 0, width: 10, length: 10 }] },
    { floor_number: 1, name: "First Floor", objects: [] },
  ],
};

describe("plinthFloor helpers", () => {
  it("reads the plinth object on a migrated config", () => {
    expect(plinthGeom(migrated)).toEqual({ x: 0, y: 0, width: 100, length: 200, height: 30 });
    expect(validate(migrated).ok).toBe(true);
  });

  it("a legacy config (no plinth floor) loads and has no plinth geometry", () => {
    // The legacy top-level `plinth` key is tolerated by the schema (ignored),
    // so the file loads instead of failing validation.
    expect(validate(legacy).ok).toBe(true);
    // No plinth OBJECT anywhere → no plinth geometry (renders without a plinth).
    expect(findPlinthObject(legacy)).toBeUndefined();
    expect(plinthGeom(legacy)).toBeUndefined();
  });
});
