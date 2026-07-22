import { describe, it, expect } from "vitest";
import { expandStaircase } from "./stairExpand";

type Obj = { type: string; [k: string]: unknown };
type Dir = "north" | "south" | "east" | "west";

// rise_height 90 / step_rise 5 → 18 RISERS. Treads = risers − (num flights).
const base = (over: Partial<Obj> = {}): Obj => ({
  type: "staircase",
  name: "Stair",
  start_x: 100,
  start_y: 50,
  rise_height: 90,
  step_rise: 5,
  step_tread: 10,
  step_width: 30,
  direction: "south",
  ...over,
});
const expand = (over: Partial<Obj> = {}, slab = 8, below = 100) =>
  expandStaircase(base(over), slab, below);

const stairs = (o: Obj[]) => o.filter((x) => x.type === "staircase");
const landings = (o: Obj[]) => o.filter((x) => x.type === "floor_slab");
const treads = (o: Obj[]) => stairs(o).reduce((a, s) => a + (s.num_steps as number), 0);
// walking-surface z of every tread across every flight
const treadLevels = (o: Obj[]) =>
  stairs(o).flatMap((s: any) =>
    Array.from({ length: s.num_steps }, (_, i) =>
      +(s.z_offset + (i + 1) * s.step_rise).toFixed(4),
    ),
  );
const platformLevels = (o: Obj[], floorTop: number, floorBottom: number) => [
  floorTop,
  floorBottom,
  ...landings(o).map((l: any) => +(l.z_offset + l.thickness).toFixed(4)),
];

const DV: Record<Dir, [number, number]> = {
  south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0],
};
// the flight whose TOP near corner sits at (start_x, start_y) = the floor-meeting flight
const topFlight = (o: Obj[]): any =>
  stairs(o).find((s: any) => {
    const [vx, vy] = DV[s.direction as Dir];
    const r = s.num_steps * s.step_tread;
    return Math.abs(s.start_x + r * vx - 100) < 1e-6 && Math.abs(s.start_y + r * vy - 50) < 1e-6;
  });

describe("expandStaircase", () => {
  it("single flight: R risers → R−1 treads, top tread a riser below the floor", () => {
    const out = expand();
    expect(out).toHaveLength(1);
    expect(out[0].num_steps).toBe(17); // 18 risers − 1
    expect("rise_height" in out[0]).toBe(false);
    expect(topFlight(out)).toBeDefined(); // anchored at (100,50)
    const lv = treadLevels(out);
    expect(Math.max(...lv)).toBe(8 - 5); // top tread = floor(8) − one riser
    expect(Math.min(...lv)).toBe(8 - 90 + 5); // bottom tread = floor-below + one riser
  });

  it("rise_height defaults to the floor-below height when omitted", () => {
    const out = expandStaircase(base({ rise_height: undefined }), 8, 100);
    expect(out[0].num_steps).toBe(19); // 20 risers − 1
  });

  it("explicit z_offset sets the TOP (floor) height; no tread sits on it", () => {
    const out = expand({ z_offset: 50 });
    const lv = treadLevels(out);
    expect(Math.max(...lv)).toBe(50 - 5); // top tread a riser below the floor at 50
    expect(lv).not.toContain(50);
  });

  it("does not split when the run fits within max_run", () => {
    const out = expand({ max_run: 400 });
    expect(out).toHaveLength(1);
    expect(out[0].num_steps).toBe(17);
  });

  it("splits into balanced switchback flights; treads = risers − numFlights", () => {
    const out = expand({ max_run: 60 }); // capRisers 7 → 3 flights of 6 risers
    expect(stairs(out)).toHaveLength(3);
    expect(landings(out)).toHaveLength(2);
    expect(stairs(out).map((s) => s.num_steps)).toEqual([5, 5, 5]); // 6 risers − 1
    expect(treads(out)).toBe(18 - 3);
  });

  it("no tread coincides with the floor or any landing (fall from each platform)", () => {
    for (const mr of [undefined, 100, 60] as const) {
      const out = expand(mr ? { max_run: mr } : {});
      const lv = treadLevels(out);
      const plat = platformLevels(out, 8, 8 - 90);
      const collisions = lv.filter((z) => plat.some((p) => Math.abs(z - p) < 1e-6));
      expect(collisions).toEqual([]);
    }
  });

  it("the floor-meeting (top) flight is always `direction`, regardless of flight count", () => {
    for (const [mr, n] of [[undefined, 1], [100, 2], [60, 3]] as const) {
      const out = expand(mr ? { max_run: mr } : {});
      expect(stairs(out)).toHaveLength(n);
      expect(topFlight(out)?.direction).toBe("south");
    }
  });

  it("default turn (clockwise going down): return lane +X; anticlockwise mirrors", () => {
    const cw = expand({ max_run: 60 });
    const ccw = expand({ max_run: 60, turn: "anticlockwise" });
    // return lane is the middle (north) flight
    const north = (o: Obj[]) => stairs(o).find((s: any) => s.direction === "north") as any;
    expect(north(cw).start_x).toBeGreaterThan(100);
    expect(north(ccw).start_x).toBeLessThan(100);
  });

  it("flight_gap widens landings to bridge the void", () => {
    const out = expand({ max_run: 60, flight_gap: 12 });
    for (const l of landings(out)) expect(l.width).toBe(72); // 2×30 + 12
  });

  for (const direction of ["south", "north", "east", "west"] as const) {
    it(`anchors the top-flight to (start_x,start_y) + is \`${direction}\` for ${direction}`, () => {
      const out = expand({ max_run: 60, direction });
      const tf = topFlight(out);
      expect(tf).toBeDefined();
      expect(tf.direction).toBe(direction);
      expect(treads(out)).toBe(18 - 3);
    });
  }
});
