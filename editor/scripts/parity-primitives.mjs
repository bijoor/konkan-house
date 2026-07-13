// Parity harness: for each SVG primitive we've ported, invoke both the
// Python original and the TS port on identical inputs and diff. Bails on
// the first mismatch and prints a unified diff so we can zero in fast.
//
// Usage: node scripts/parity-primitives.mjs

import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";
import {
  svgDrawWall,
  svgDrawRoom,
  svgDrawDoor,
  svgDrawWindow,
  svgDrawFloorSlab,
  svgDrawPillar,
  svgDrawBeam,
  svgDrawStaircase,
} from "../src/svg2d/shapes.ts";
import { formatDimension } from "../src/svg2d/format.ts";
import { expandRoomWalls } from "../src/svg2d/expand.ts";
import {
  normalizeEdgeKey,
  extractFloorEdges,
  classifyPerimeterEdges,
  detectWallConnections,
  assignDimensionOffsetLevels,
} from "../src/svg2d/edges.ts";
import {
  svgDrawDimensionLine,
  assignOpeningOffsetLevels,
  svgDrawOpeningDimensions,
} from "../src/svg2d/dimensions.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

// Each case: [label, python-call-source, ts-value]
// python-call-source is a snippet run inside svg_2d's namespace.
const cases = [
  // Walls
  ["svg_draw_wall horizontal", `svg_draw_wall(0, 0, 100, 0, 8)`, svgDrawWall(0, 0, 100, 0, 8)],
  ["svg_draw_wall vertical",   `svg_draw_wall(0, 0, 0, 100, 8)`, svgDrawWall(0, 0, 0, 100, 8)],
  ["svg_draw_wall float",      `svg_draw_wall(10.5, 20.5, 100.0, 0.0, 8)`, svgDrawWall(10.5, 20.5, 100.0, 0.0, 8)],
  // Rooms
  ["svg_draw_room all sides",  `svg_draw_room(0, 0, 100, 80, 8)`, svgDrawRoom(0, 0, 100, 80, 8)],
  ["svg_draw_room partial",    `svg_draw_room(0, 0, 100, 80, 8, walls=['north','east'])`, svgDrawRoom(0, 0, 100, 80, 8, ["north", "east"])],
  // Doors / windows
  ["svg_draw_door north",      `svg_draw_door(50, 100, 30, 'north')`, svgDrawDoor(50, 100, 30, "north")],
  ["svg_draw_door south",      `svg_draw_door(50, 100, 30, 'south')`, svgDrawDoor(50, 100, 30, "south")],
  ["svg_draw_door east",       `svg_draw_door(50, 100, 30, 'east')`,  svgDrawDoor(50, 100, 30, "east")],
  ["svg_draw_door west",       `svg_draw_door(50, 100, 30, 'west')`,  svgDrawDoor(50, 100, 30, "west")],
  ["svg_draw_window north",    `svg_draw_window(50, 100, 30, 'north')`, svgDrawWindow(50, 100, 30, "north")],
  ["svg_draw_window east",     `svg_draw_window(50, 100, 30, 'east')`,  svgDrawWindow(50, 100, 30, "east")],
  // Slabs / beams / pillars / stairs
  ["svg_draw_floor_slab",      `svg_draw_floor_slab(0, 0, 270, 450)`, svgDrawFloorSlab(0, 0, 270, 450)],
  ["svg_draw_beam",            `svg_draw_beam(10, 20, 30, 40)`, svgDrawBeam(10, 20, 30, 40)],
  ["svg_draw_pillar size",     `svg_draw_pillar(100, 200, size=10)`, svgDrawPillar(100, 200, 10)],
  ["svg_draw_pillar wh",       `svg_draw_pillar(100, 200, width=12, length=8)`, svgDrawPillar(100, 200, undefined, 12, 8)],
  ["svg_draw_staircase up 5",  `svg_draw_staircase(0, 0, 40, 100, 'up', num_steps=5)`, svgDrawStaircase(0, 0, 40, 100, "up", 5)],
  ["svg_draw_staircase down",  `svg_draw_staircase(10, 20, 40, 80, 'down')`, svgDrawStaircase(10, 20, 40, 80, "down")],
  // format_dimension
  ["format_dimension 100",     `format_dimension(100)`, formatDimension(100)],
  ["format_dimension 137",     `format_dimension(137)`, formatDimension(137)],
  ["format_dimension 5",       `format_dimension(5)`, formatDimension(5)],
  ["format_dimension 100.5",   `format_dimension(100.5)`, formatDimension(100.5)],
  // Dimension lines
  ["svg_draw_dimension_line H",    `svg_draw_dimension_line(0, 0, 100, 0, 30, is_horizontal=True)`, svgDrawDimensionLine(0, 0, 100, 0, 30, true)],
  ["svg_draw_dimension_line H neg",`svg_draw_dimension_line(0, 100, 200, 100, -30, is_horizontal=True)`, svgDrawDimensionLine(0, 100, 200, 100, -30, true)],
  ["svg_draw_dimension_line V",    `svg_draw_dimension_line(0, 0, 0, 200, 30, is_horizontal=False)`, svgDrawDimensionLine(0, 0, 0, 200, 30, false)],
  ["svg_draw_dimension_line V neg",`svg_draw_dimension_line(100, 0, 100, 200, -30, is_horizontal=False)`, svgDrawDimensionLine(100, 0, 100, 200, -30, false)],
  ["svg_draw_dimension_line short",`svg_draw_dimension_line(0, 0, 5, 0, 30, is_horizontal=True)`, svgDrawDimensionLine(0, 0, 5, 0, 30, true)],
  ["svg_draw_dimension_line adj",  `svg_draw_dimension_line(0, 0, 100, 0, 30, is_horizontal=True, adjust_start=True, adjust_end=True)`, svgDrawDimensionLine(0, 0, 100, 0, 30, true, true, true)],
  // Opening dimensions
  ["svg_draw_opening_dimensions N 0", `svg_draw_opening_dimensions(50, 0, 30, 'north', 0, 200, 0)`, svgDrawOpeningDimensions(50, 0, 30, "north", 0, 200, 0)],
  ["svg_draw_opening_dimensions S 1", `svg_draw_opening_dimensions(50, 200, 30, 'south', 0, 200, 1)`, svgDrawOpeningDimensions(50, 200, 30, "south", 0, 200, 1)],
  ["svg_draw_opening_dimensions E 0", `svg_draw_opening_dimensions(200, 50, 30, 'east', 0, 300, 0)`, svgDrawOpeningDimensions(200, 50, 30, "east", 0, 300, 0)],
  ["svg_draw_opening_dimensions W 0", `svg_draw_opening_dimensions(0, 50, 30, 'west', 0, 300, 0)`, svgDrawOpeningDimensions(0, 50, 30, "west", 0, 300, 0)],
  ["svg_draw_opening_dimensions N ref",`svg_draw_opening_dimensions(75, 0, 30, 'north', 0, 200, 0, reference_point=25)`, svgDrawOpeningDimensions(75, 0, 30, "north", 0, 200, 0, 25)],
];

// Build one Python program that runs all the calls and prints results
// separated by a sentinel, so we only spawn Python once.
const SENTINEL = "###__CASE_BREAK__###";
const pyCallList = cases.map((c) => c[1]).join(`, print("${SENTINEL}"), `);
// house_config.py transitively imports bpy via konkan_house_lib, so we
// can't just `import house_config`. Instead we replay the same trick
// regenerate_combined_svgs.py uses: strip the bpy-tainted import line
// and exec the config source into a namespace where GLOBAL_CONFIG is
// pre-provided by our direct import of `config`.
const pyProgram = `
import sys, pathlib
sys.path.insert(0, str(pathlib.Path("${repoRoot.replace(/"/g, '\\"')}")))
from config import GLOBAL_CONFIG
config_code = (pathlib.Path("${repoRoot.replace(/"/g, '\\"')}") / "house_config.py").read_text()
config_code = config_code.replace("from konkan_house_lib import GLOBAL_CONFIG", "")
exec(config_code, {"GLOBAL_CONFIG": GLOBAL_CONFIG, "__file__": str(pathlib.Path("${repoRoot.replace(/"/g, '\\"')}") / "house_config.py")})
from svg_2d import (svg_draw_wall, svg_draw_room, svg_draw_door, svg_draw_window,
                    svg_draw_floor_slab, svg_draw_pillar, svg_draw_beam,
                    svg_draw_staircase, format_dimension,
                    svg_draw_dimension_line, svg_draw_opening_dimensions,
                    extract_floor_edges, classify_perimeter_edges,
                    detect_wall_connections, assign_dimension_offset_levels,
                    normalize_edge_key)

def _emit(v):
    if isinstance(v, str):
        sys.stdout.write(v)
    else:
        print(repr(v))
${cases
  .map(
    (c, i) => `_emit(${c[1]})
sys.stdout.write("${SENTINEL}\\n")`,
  )
  .join("\n")}
`;

const res = spawnSync("python3", ["-c", pyProgram], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (res.status !== 0) {
  console.error("Python invocation failed:", res.stderr);
  process.exit(2);
}
const parts = res.stdout.split(SENTINEL + "\n");
// Last element is the trailing "" after the final sentinel.
if (parts.length - 1 !== cases.length) {
  console.error(`Expected ${cases.length} results, got ${parts.length - 1}`);
  process.exit(2);
}

let passed = 0;
let failed = 0;
for (let i = 0; i < cases.length; i++) {
  const [label, , tsOut] = cases[i];
  const pyOut = parts[i];
  if (pyOut === tsOut) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`    Python: ${JSON.stringify(pyOut)}`);
    console.log(`    TS:     ${JSON.stringify(tsOut)}`);
    failed++;
  }
}

// expand.ts parity: expand the real house_config.json through both.
const cfg = JSON.parse(
  (await import("node:fs")).readFileSync(path.join(repoRoot, "house_config.json"), "utf8"),
);
const tsExpanded = expandRoomWalls(cfg);
const pyExpandProgram = `
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path("${repoRoot.replace(/"/g, '\\"')}")))
from config import GLOBAL_CONFIG
config_code = (pathlib.Path("${repoRoot.replace(/"/g, '\\"')}") / "house_config.py").read_text()
config_code = config_code.replace("from konkan_house_lib import GLOBAL_CONFIG", "")
ns = {"GLOBAL_CONFIG": GLOBAL_CONFIG, "__file__": str(pathlib.Path("${repoRoot.replace(/"/g, '\\"')}") / "house_config.py")}
exec(config_code, ns)
from house_expand import expand_room_walls
print(json.dumps(expand_room_walls(ns["HOUSE_CONFIG"]), sort_keys=True))
`;
const pyExpandRes = spawnSync("python3", ["-c", pyExpandProgram], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (pyExpandRes.status !== 0) {
  console.error("Python expand invocation failed:", pyExpandRes.stderr);
  process.exit(2);
}
const pyExpanded = JSON.parse(pyExpandRes.stdout);
const tsExpandedJson = JSON.parse(JSON.stringify(tsExpanded, Object.keys(tsExpanded).sort()));
// Normalize both to sorted-key JSON for comparison.
const a = JSON.stringify(pyExpanded, Object.keys(pyExpanded).sort());
const b = JSON.stringify(tsExpanded, Object.keys(tsExpanded).sort());
// Sorting requires deep sort — do it via canonicalize.
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canon(v[k])]),
    );
  }
  return v;
}
const canonPy = JSON.stringify(canon(pyExpanded));
const canonTs = JSON.stringify(canon(tsExpanded));
if (canonPy === canonTs) {
  console.log("  ✓ expand_room_walls: TS output matches Python");
  passed++;
} else {
  console.log("  ✗ expand_room_walls: TS output differs from Python");
  // Print first diff
  const lenMin = Math.min(canonPy.length, canonTs.length);
  let idx = 0;
  while (idx < lenMin && canonPy[idx] === canonTs[idx]) idx++;
  console.log(`    diverges at char ${idx}:`);
  console.log(`    Python: …${canonPy.slice(Math.max(0, idx - 40), idx + 60)}…`);
  console.log(`    TS:     …${canonTs.slice(Math.max(0, idx - 40), idx + 60)}…`);
  failed++;
}

// Structural parity: run edge extraction + dimension-level assignment +
// wall-connection detection on the real ground floor and compare as
// canonical JSON. Python emits tuples; we serialize them as strings
// matching TS's normalizeEdgeKey ("x1,y1,x2,y2") for comparability.
const groundFloor = cfg.floors[0];
const tsEdges = extractFloorEdges(groundFloor);
// Compute bounds from the floor slab (ground floor has one).
const slab = groundFloor.objects.find((o) => o.type === "floor_slab");
const bounds = {
  min_x: slab.x,
  max_x: slab.x + slab.width,
  min_y: slab.y,
  max_y: slab.y + slab.length,
};
const tsPerim = classifyPerimeterEdges(tsEdges, bounds);
const tsConn = detectWallConnections(tsEdges);
const tsDimNorth = assignDimensionOffsetLevels(tsPerim.north, true);
const tsDimWest = assignDimensionOffsetLevels(tsPerim.west, false);

const pyStructProgram = `
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path("${repoRoot.replace(/"/g, '\\"')}")))
from config import GLOBAL_CONFIG
config_code = (pathlib.Path("${repoRoot.replace(/"/g, '\\"')}") / "house_config.py").read_text()
config_code = config_code.replace("from konkan_house_lib import GLOBAL_CONFIG", "")
ns = {"GLOBAL_CONFIG": GLOBAL_CONFIG, "__file__": str(pathlib.Path("${repoRoot.replace(/"/g, '\\"')}") / "house_config.py")}
exec(config_code, ns)
from svg_2d import (extract_floor_edges, classify_perimeter_edges,
                     detect_wall_connections, assign_dimension_offset_levels)

def key_str(t):
    # normalize_edge_key returns (x1,y1,x2,y2); render like TS "x1,y1,x2,y2"
    return f"{t[0]},{t[1]},{t[2]},{t[3]}"

hc = ns["HOUSE_CONFIG"]
gf = hc["floors"][0]
edges = extract_floor_edges(gf)
slab = next(o for o in gf["objects"] if o.get("type") == "floor_slab")
bounds = dict(min_x=slab["x"], max_x=slab["x"]+slab["width"],
              min_y=slab["y"], max_y=slab["y"]+slab["length"])
perim = classify_perimeter_edges(edges, bounds)
conn = detect_wall_connections(edges)
dim_n = assign_dimension_offset_levels(perim["north"], True)
dim_w = assign_dimension_offset_levels(perim["west"], False)

def canon_edge_dict(d):
    return sorted([{"key": key_str(k), **v} for k, v in d.items()], key=lambda e: e["key"])

out = {
  "horizontal": canon_edge_dict(edges["horizontal"]),
  "vertical":   canon_edge_dict(edges["vertical"]),
  "perim_north_len": len(perim["north"]),
  "perim_south_len": len(perim["south"]),
  "perim_east_len":  len(perim["east"]),
  "perim_west_len":  len(perim["west"]),
  "conn": sorted([{"key": key_str(k), "start": v[0], "end": v[1]} for k, v in conn.items()], key=lambda e: e["key"]),
  "dim_n": sorted([{"key": key_str(k), "level": v} for k, v in dim_n.items()], key=lambda e: e["key"]),
  "dim_w": sorted([{"key": key_str(k), "level": v} for k, v in dim_w.items()], key=lambda e: e["key"]),
}
print(json.dumps(out))
`;
const pyStructRes = spawnSync("python3", ["-c", pyStructProgram], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (pyStructRes.status !== 0) {
  console.error("Python struct check failed:", pyStructRes.stderr);
  process.exit(2);
}
const pyStruct = JSON.parse(pyStructRes.stdout);
function canonEdgeDict(d) {
  return Object.entries(d)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
const tsStruct = {
  horizontal: canonEdgeDict(tsEdges.horizontal),
  vertical:   canonEdgeDict(tsEdges.vertical),
  perim_north_len: tsPerim.north.length,
  perim_south_len: tsPerim.south.length,
  perim_east_len:  tsPerim.east.length,
  perim_west_len:  tsPerim.west.length,
  conn: Object.entries(tsConn).map(([key, [s, e]]) => ({ key, start: s, end: e }))
        .sort((a, b) => (a.key < b.key ? -1 : 1)),
  dim_n: Object.entries(tsDimNorth).map(([key, level]) => ({ key, level }))
         .sort((a, b) => (a.key < b.key ? -1 : 1)),
  dim_w: Object.entries(tsDimWest).map(([key, level]) => ({ key, level }))
         .sort((a, b) => (a.key < b.key ? -1 : 1)),
};

const canonJson = (x) => JSON.stringify(x, null, 0);
if (canonJson(pyStruct) === canonJson(tsStruct)) {
  console.log("  ✓ edges/perim/conn/dim structural parity (ground floor)");
  passed++;
} else {
  console.log("  ✗ edges/perim/conn/dim structural mismatch");
  // Find first differing top-level key
  for (const k of Object.keys(pyStruct)) {
    const a = canonJson(pyStruct[k]);
    const b = canonJson(tsStruct[k]);
    if (a !== b) {
      console.log(`    key '${k}' differs:`);
      console.log(`      Python: ${a.slice(0, 200)}`);
      console.log(`      TS:     ${b.slice(0, 200)}`);
    }
  }
  failed++;
}

console.log(`\n${passed}/${passed + failed} parity checks passed`);
process.exit(failed === 0 ? 0 : 1);
