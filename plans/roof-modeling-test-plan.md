# Roof modelling v2 — test plan

Companion to `roof-modeling-plan.md`. Every migration step lands
with tests that (a) prove new code correct in isolation and
(b) prove no user-visible regression against the templates
already checked in under `editor/public/templates/`.

## Framework

- **Runner**: `vitest` (added to editor devDependencies)
- **Location**: colocate `*.test.ts` next to source (idiomatic
  vitest layout, easy to move with the code)
- **Commands**:
  - `npm test` — one-shot run (CI-friendly)
  - `npm run test:watch` — TDD loop
- **Assertions**: `expect(...)` with vitest's built-in matchers.
  Floating-point comparisons use `.toBeCloseTo(x, precision)` at
  precision 6 unless a specific step needs looser.

## Test categories

Each migration step contributes one or more of these:

1. **Unit tests** — pure math, no I/O. Fast, deterministic.
2. **Adapter tests** — verify legacy config shapes convert to
   v2 shapes exactly as expected.
3. **Parity tests** — for every template with a roof of the
   type being migrated, derive geometry via both the old code
   and the new code, then compare invariants (footprint,
   apex/ridge Z, plane count, member count where applicable).
   Failures print the diff so we know exactly which template
   broke.
4. **Snapshot tests** — for a fixed set of representative
   configs, capture the derived `RoofSpec` as JSON. Snapshots
   live under `__snapshots__/`. Reviewing snapshot diffs during
   a PR replaces manual visual QC of the templates.

## Per-step test coverage

### Step 1 — Data model + segment utilities

**File**: `editor/src/svg2d/roof/v2/segments.test.ts`

Unit tests (pure math):
- `segmentLength` — axis-aligned N-S, E-W, diagonal, zero-length
- `segmentUnitVector` — same set; assert unit magnitude
- `segmentNormal` — left-normal is +90° CCW from direction
- `offsetLine(seg, +d)` — offsets left; `-d` offsets right
- `segmentRect(seg, w)` — 4 corners, CCW winding, area = length × w
- `interpolatePoint(seg, along)` — 0 → start, len → end, 0.5·len →
  midpoint
- `resolveEndpoints(segments)`:
  - Zero shared endpoints → all references marked "leaf"
  - Two segments meeting at a corner → shared endpoint has 2 refs
  - Three segments meeting → multi-joint with 3 refs
  - Epsilon: two endpoints 0.4 units apart merge (default epsilon
    = 0.5); 0.6 units apart stay separate

**File**: `editor/src/svg2d/roof/v2/adapters.test.ts`

Adapter tests (`oldRectRoofToSegments`):
- `flat_roof {x, y, width, length}` → one segment, endpoints on
  the long-axis centre line, correct width
- `shed_roof + slope_dir` → segment perpendicular to slope; width
  from cross dimension
- `gable_roof + ridge_axis: "y"` → segment along Y, width = X
  extent; `default_endpoint: "open"`
- `gable_roof + ridge_axis: "x"` → segment along X, width = Y
  extent; `default_endpoint: "open"`
- `hip_roof + ridge_axis: "y"/"x"` → same as gable but
  `default_endpoint: "closed"`
- All legacy `x, y, width, length, ridge_axis` combinations round-trip
  through the adapter without loss

### Step 2 — Flat roof migration

**File**: `editor/src/svg2d/roof/v2/deriveFlat.test.ts`

Unit:
- Empty segments → empty spec
- One rectangular segment → 1 `role: "flat_slab"` plane; vertices
  at the four corners of the segment rectangle
- Overhang extends slab past segment rectangle by `min_overhang`
  on all sides
- Slab Z = wall_top_z + slab_thickness

**Parity** (`editor/src/svg2d/roof/v2/parity.flat.test.ts`):
- For each template under `editor/public/templates/` that
  contains a `flat_roof`:
  - Derive via legacy `deriveFlatFromObject`
  - Convert to v2 via `oldRectRoofToSegments` + `deriveFlatRoof`
  - Assert:
    - Slab top-Z matches
    - Slab footprint (min/max X, Y) matches within 1e-6
    - Overhang, parapet height, parapet thickness all preserved

### Step 3 — Shed roof migration

**File**: `editor/src/svg2d/roof/v2/deriveShed.test.ts`

Unit:
- Single segment, `shed_high_side: "left"` → high edge at
  offsetLine(+w/2) at high_z; low edge at offsetLine(-w/2) at low_z
- Slope quad has 4 vertices, `rafter_direction` perpendicular to
  segment (low→high)
- Open endpoints emit trapezoid infill planes; joint endpoints
  do not
- `shed_high_side: "right"` mirrors the above

**Parity** (`parity.shed.test.ts`):
- Every template with `shed_roof`:
  - High and low eave Z match legacy
  - Slope area matches legacy
  - Overhang preserved

### Step 4 — Pitched roof migration (biggest step)

**File**: `editor/src/svg2d/roof/v2/derivePitched.test.ts`

Unit:
- **All-open** (classical gable) — 1 segment, both endpoints
  open:
  - 2 slope planes + 2 `gable_wall` planes; 0 hip members
  - Ridge runs full segment length
  - Apex Z = wall_top + ridge_h
- **All-closed** (classical hip) — 1 segment, both endpoints
  closed:
  - 2 slope planes + 2 `hip_face` planes; 4 hip diagonals
  - Ridge trimmed inward by `ridge_h / tan(pitch)` at each end
- **Dutch gable** — 1 segment, one endpoint open, one closed:
  - 2 slope planes + 1 gable_wall + 1 hip_face + 2 hip diagonals
  - Ridge trimmed on the closed end only
- **X-axis ridge** — same three cases with the segment running
  along X; assert every plane / member is a rotation of the Y
  case (this proves axis-agnosticism)
- **Diagonal segment** — 45° segment; assert derived planes
  respect the segment's direction (rafters perpendicular to
  segment)
- **Trusses**:
  - `positions_along: [10, 50, 100]` → 3 triangles, apex at
    (interpolate(seg, pos), ridge_z), bottom edge at eave line
  - Empty positions → 0 triangles

**Parity — gable** (`parity.gable.test.ts`):
- Every template with `gable_roof` (Y-axis + X-axis if any):
  - Ridge start/end within 1e-6 of legacy `ridge_y_start/end` (or
    `ridge_x_start/end`)
  - Apex Z matches legacy `ridge_z`
  - Slope plane count = 2
  - Truss count matches legacy `trusses.positions.length`

**Parity — hip** (`parity.hip.test.ts`):
- Every template with `hip_roof`:
  - Ridge start/end (post-trim) matches legacy
  - Apex Z matches legacy `ridge_z`
  - 4 hip diagonals emitted
  - Truss count matches
- **Konkan-house sample** — the reference config in
  `house_config.json`: assert bit-identical shell footprint
  before/after migration

**Snapshot** (`__snapshots__/pitched.snap`):
- Serialise `derivePitchedRoof(cfg)` output for 6 canonical
  configs — pure gable Y, pure gable X, pure hip Y, pure hip X,
  dutch gable, diagonal — as JSON with rounded coords
- Snapshot diff reviewed on every PR that touches derivation

### Step 5 — Multi-segment configs

**File**: `editor/src/svg2d/roof/v2/multiSegment.test.ts`

Unit:
- L-shape (2 segments, shared endpoint) — `resolveEndpoints`
  reports 1 joint, 2 leaves
- U-shape (3 segments, 2 joints) — correct joint / leaf counts
- Courtyard (4 segments, all joints) — 0 leaves; every endpoint
  is a joint

Parity:
- Load `l_shape_villa.json`, `courtyard_home.json` templates,
  derive both ways; assert per-segment shells still line up
  (joint resolution NOT yet applied, so overlap is expected —
  but each segment's individual footprint must match legacy per-
  rectangle output)

### Step 6 — Joint resolution

**File**: `editor/src/svg2d/roof/v2/resolveJoints.test.ts`

Unit:
- Two pitched roofs meeting at 90° inside corner → 1 valley
  member emitted
- Two pitched roofs meeting at 90° outside corner → 1 hip
  member; both roofs' end caps removed
- Two shed roofs same direction → discontinuity + valley
- Two flat roofs → unified polygon (no members)
- Mixed types (Phase 1) → no joint resolution; visual overlap OK

Snapshot:
- Courtyard house's 4 corner joints — snapshot member counts and
  positions to catch geometry regressions

### Step 7 — Detail SVG panels rewrite

**File**: `editor/src/svg2d/roof/v2/panels.test.ts`

- Rendered SVG length + panel count matches old pipeline for
  every template
- No `NaN` in any coordinate (regression guard — this bug hit
  the old pipeline twice)

### Step 8 — BOM aggregation rewrite

**File**: `editor/src/svg2d/roof/v2/bom.test.ts`

- Frame BOM member counts match legacy per template
- Metal BOM linear-feet totals match legacy per template
- Tile BOM area totals match legacy per template

### Step 9 — Deprecate old types

- All templates re-saved in v2 format (`type: "roof"`,
  `segments: [...]`)
- Round-trip test: load v2 template → derive → serialise → reload
  → derive again → bit-identical spec

## Test data strategy

- **Templates as fixtures**: read from `editor/public/templates/*.json`
  at test time. Any new template automatically joins the parity
  suite.
- **Reference config**: `house_config.json` at repo root is the
  Konkan house; treat it as an additional fixture and require
  parity with it at every step.
- **Manual synthetic cases**: small in-file configs for corner
  cases the templates don't cover (dutch gable, diagonal segment,
  pure X-axis single-segment, epsilon-boundary endpoints, etc.).

## Failure surface

Every parity test prints:
- The template file name
- The specific numeric diff (expected vs actual)
- A JSON-stringified snippet of both derived specs

This makes triage from a CI failure a matter of reading the log,
not re-running locally. Matches the ergonomics of the existing
`parity-primitives.mjs` harness.

## Coverage targets

- **Step 1 + 2** (this PR): 100% branch coverage of `segments.ts`
  and `adapters.ts`; every existing template exercises
  `deriveFlatRoof` via the parity suite.
- **Step 4** (pitched): parity + snapshot required for every
  gable/hip template. `buildFrame` (350 lines) may only be
  deleted after all parity tests pass on the v2 code.
- **Overall**: no migration step lands with red tests.
