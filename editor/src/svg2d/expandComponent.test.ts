import { describe, expect, it } from "vitest";
import { expandRoomWalls } from "./expand";

// A tiny 2-object component whose pillar width is driven by an input variable.
const base = (objects: unknown[]) =>
  ({
    site: { plot_width: 500, plot_length: 500 },
    components: {
      duo: {
        variables: { w: 20 },
        objects: [
          { type: "pillar", name: "P", x: 0, y: 0, formulas: { width: "= w" } },
          { type: "floor_slab", x: 5, y: 5, width: 10, length: 10, z_offset: 3 },
        ],
      },
    },
    floors: [{ floor_number: 0, name: "F", objects }],
  }) as never;

describe("component expansion", () => {
  it("places a component's objects at the instance offset + composes z_offset + overrides params", () => {
    const cfg = base([
      { type: "component", ref: "duo", x: 100, y: 50, z_offset: 8, params: { w: 30 } },
    ]);
    const out = expandRoomWalls(cfg, 8, { lenient: true });
    const objs = out.floors[0].objects as Array<Record<string, unknown>>;
    const pillar = objs.find((o) => o.type === "pillar")!;
    expect(pillar.x).toBe(100);
    expect(pillar.y).toBe(50);
    expect(pillar.width).toBe(30); // param override
    const slab = objs.find((o) => o.type === "floor_slab")!;
    expect(slab.x).toBe(105);
    expect(slab.y).toBe(55);
    expect(slab.z_offset).toBe(11); // 3 (local) + 8 (instance lift)
    // The instance itself is flattened away.
    expect(objs.some((o) => o.type === "component")).toBe(false);
  });

  it("two instances share one definition, placed independently, using the default param", () => {
    const cfg = base([
      { type: "component", ref: "duo", x: 0, y: 0 },
      { type: "component", ref: "duo", x: 200, y: 0 },
    ]);
    const out = expandRoomWalls(cfg, 8, { lenient: true });
    const pillars = (out.floors[0].objects as Array<Record<string, unknown>>).filter(
      (o) => o.type === "pillar",
    );
    expect(pillars.map((p) => p.x as number).sort((a, b) => a - b)).toEqual([0, 200]);
    expect(pillars.every((p) => p.width === 20)).toBe(true); // default w
  });

  it("a missing ref warns (lenient) instead of throwing", () => {
    const warnings: string[] = [];
    const cfg = base([{ type: "component", ref: "nope", x: 0, y: 0 }]);
    const out = expandRoomWalls(cfg, 8, { lenient: true, onWarning: (m) => warnings.push(m) });
    expect(out.floors[0].objects.length).toBe(0);
    expect(warnings.join(" ")).toMatch(/unknown component 'nope'/);
  });

  it("a '= formula' param is evaluated in the host scope", () => {
    const cfg = {
      site: { plot_width: 500, plot_length: 500 },
      variables: { hostW: 42 },
      components: {
        duo: {
          variables: { w: 20 },
          objects: [{ type: "pillar", name: "P", x: 0, y: 0, formulas: { width: "= w" } }],
        },
      },
      floors: [
        {
          floor_number: 0,
          name: "F",
          objects: [{ type: "component", ref: "duo", x: 0, y: 0, params: { w: "= hostW" } }],
        },
      ],
    } as never;
    const out = expandRoomWalls(cfg, 8, { lenient: true });
    const pillar = (out.floors[0].objects as Array<Record<string, unknown>>).find(
      (o) => o.type === "pillar",
    )!;
    expect(pillar.width).toBe(42);
  });
});
