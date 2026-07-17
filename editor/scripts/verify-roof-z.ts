import { computeTopFloorWallTopZ } from "../src/svg2d/roofGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "../src/svg2d/config";

// Scenario: plinth=30, 3 floors, all floor_height=100.
const wallTopZ_forRoof = computeTopFloorWallTopZ(
  2,
  { ...DEFAULT_GLOBAL_CONFIG, plinth_height: 30, floor_height: 100 },
  0,
  [{ height: 100 }, { height: 100 }, {}],
  { floor_height: 100 },
);
console.log("Roof wall-top-Z (ring beam Z) =", wallTopZ_forRoof);
console.log("Expected: 30 + 100 + 100 = 230");
