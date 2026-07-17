# Roof modelling — architectural plan (v2)

Revised to match the segment-based model in `roof-modeling-idea.md`.
The previous rectangle-per-roof model is replaced by a
**line-segment-polygon** abstraction where each roof is described as
one or more connected line segments, each carrying a width.

## Motivation

The current roof code:

- Hip and gable each carry ~350 lines of Y-axis-only geometry.
- Extending to `ridge_axis='x'` by swapping / reflecting failed
  because reflection flips handedness in ways quaternion math can't
  cleanly reverse.
- Frame builders mix three concerns: computing ridges + ring beam,
  placing rafters + purlins, placing trusses.
- Every new roof type (flat, shed, hypothetical dutch-hip, L-shape,
  courtyard section) duplicates rafter/purlin/truss logic.
- Junctions have no home because the pipeline assumes exactly one
  rectangular roof at a time.

The unifying idea (from `roof-modeling-idea.md`):

> The roof of a house can be modelled as a **polygon of line
> segments**, each with a width perpendicular to the segment. Each
> segment is at the CENTRE of its width. Flat = polygon extruded down
> to slab. Shed = slope perpendicular to each segment. Gable = two
> symmetric slopes rising to the segment as ridge. Hip = gable +
> perpendicular slopes at open ends.

This makes:

- **Ridge axis freedom** — a segment can run in any direction, not
  just world-X or world-Y. Diagonal segments work too.
- **Complex shapes** — L, U, courtyard, T all become segment chains
  with joint nodes.
- **Joints** — first-class, computed from shared endpoints, with
  plane intersection giving valleys and hip diagonals.
- **Uniform machinery** — one derivation per roof type, applied to
  each segment; joints handled once.
- **Gable + hip unification** — classical "gable" and "hip" are the
  same roof (called `pitched`) distinguished only by whether each
  segment endpoint is `open` (gable-end wall) or `closed` (hip
  triangle). Dutch-gables (hip one end, gable the other) come for
  free.

## Core data model

Everything below is expressed in project units (10 u = 1 ft). Roof
coordinates live in world XY at wall-top level; the derive functions
lift into Z.

```ts
interface Point2D { x: number; y: number; }
interface Point3D { x: number; y: number; z: number; }

// One segment = one ridge line for gable/hip; one high edge for shed;
// or a spine line for flat. The polygon "footprint" of the segment is
// the width-thick rectangle centred on the line.
interface RoofSegment {
  id: string;
  start: Point2D;                    // world XY at wall-top plane
  end: Point2D;
  width: number;                     // total width, centred on the segment
  // For pitched roofs (roof_type='pitched'), each leaf endpoint
  // (not shared with another segment) is either OPEN or CLOSED:
  //   open   → covered by a vertical gable-end wall (classic gable)
  //   closed → covered by a sloped hip-face triangle (classic hip)
  // A single pitched roof can mix them (e.g. gable on one end, hip
  // on the other — a "dutch gable"). Ignored for endpoints that
  // form a joint; joint resolution takes over there.
  //
  // If unset, defaults come from the roof-level `default_endpoint`
  // ("open" for a pure-gable feel, "closed" for a pure-hip feel).
  start_endpoint?: "open" | "closed";
  end_endpoint?: "open" | "closed";
  // Shed only: which side (looking along start→end) is HIGH. Ignored
  // for the other roof types.
  shed_high_side?: "left" | "right";
  // Optional per-segment override of the roof-level slope.
  slope_override?: SlopeSpec;
  // Optional per-segment framing overrides.
  framing_override?: RoofFramingConfig;
}

type SlopeSpec =
  | { by: "angle"; angle_deg: number }
  | { by: "height"; ridge_h: number };  // rise above wall_top

interface RoofConfig {
  type: "roof";                      // NEW consolidated type
  // Three roof types now — hip + gable are unified into "pitched"
  // with per-endpoint open/closed. A pure gable = all endpoints
  // open; a pure hip = all endpoints closed; anything in between
  // (dutch gable, hipped-gable) is a mix.
  roof_type: "flat" | "shed" | "pitched";
  segments: RoofSegment[];
  // For pitched roofs: the default endpoint style applied to any
  // segment endpoint that doesn't override it. Recommended default
  // for a new pitched roof = "closed" (hip) — safer structurally.
  // User picks per-endpoint overrides for gable ends.
  default_endpoint?: "open" | "closed";
  // Default slope for pitched / shed; per-segment overrides win.
  slope?: SlopeSpec;
  min_overhang?: number;             // default 20 (2 ft)
  framing?: RoofFramingConfig;
  material?: string;
  // Optional tile / stock config (currently on hip_roof only).
  tile_density?: { mangalore_per_sft: number; ceiling_per_sft: number; waste_pct: number };
  metal_stock?: { default_length_ft: number; cutting_waste_pct: number };
  // Optional explicit truss placements. Each entry names a segment
  // and gives positions_along = 0..segment_length offsets from
  // segment.start. Falls back to auto-placement (see decisions).
  trusses?: Array<{ segment_id: string; type: "fink"; positions_along: number[] }>;
}
```

**Joints are IMPLICIT.** Two segments whose endpoints coincide
(within epsilon) form a joint — no explicit `joins_to` config needed.

**Segments that don't share endpoints** produce separate visually
independent roof sections. Useful for detached wings or two houses
on one plot.

## Universal spec (all roof types)

Every roof-type derive function produces the same output shape,
ready for rendering + BOM:

```ts
interface RoofPlane {
  id: string;
  vertices: Point3D[];               // CCW when viewed from outward
  outward_normal: Point3D;
  role: "slope" | "gable_wall" | "parapet" | "hip_face" | "flat_slab";
  // For "slope" / "hip_face" — used by populatePlaneRafters/Purlins.
  rafter_direction?: Vector3D;       // in-plane, up-slope
  purlin_direction?: Vector3D;       // in-plane, parallel to ridge
  source_segment_id: string;
  side_of_segment?: "left" | "right" | "end_start" | "end_end";
}

interface StraightMember {
  id: string;
  start: Point3D;
  end: Point3D;
  cross_section_in: [number, number];
  wall_thickness_mm: number;
  role:
    | "ridge" | "hip" | "valley"
    | "ring_beam" | "hip_beam" | "vent_strut" | "parapet_cap"
    | "rafter" | "purlin"
    | "truss_chord_top" | "truss_chord_bottom" | "truss_king_post" | "truss_web";
  bucket: "spine" | "surface";
  source_segment_id: string;
}

interface TrussTriangle {
  id: string;
  bottom_left: Point3D;              // ring-beam corner
  bottom_right: Point3D;              // opposite ring-beam corner
  apex: Point3D;                     // under ridge
  source_segment_id: string;
  along_position: number;            // offset from segment.start
}

interface RoofSpec {
  roof_id: string;
  members: StraightMember[];
  planes: RoofPlane[];
  trusses: TrussTriangle[];
  label?: string;
}
```

## Per-roof-type derivation

Each roof type has one top-level function that iterates segments and
produces the same `RoofSpec` shape. Joints are resolved AFTER all
segments are derived.

### Flat

```
deriveFlatRoof(cfg):
  spec = { members: [], planes: [], trusses: [] }
  polygon = union of segment rectangles           # may be non-convex
  spec.planes.push({
    vertices: polygon @ (wall_top + slab_thickness),
    role: "flat_slab",
  })
  spec.members.push(...ringBeamAround(polygon))
  if parapet_height > 0:
    for each polygon edge:
      spec.planes.push(vertical parapet wall rectangle)
      spec.members.push(parapet_cap beam)
  return spec
```

### Shed

```
deriveShedRoof(cfg):
  spec = { members: [], planes: [], trusses: [] }
  for each segment:
    # Offset the segment ±width/2 perpendicular; high side rises.
    high_line = offsetLine(seg, +width/2 toward high_side)
    low_line  = offsetLine(seg, -width/2 toward high_side)
    high_z    = wall_top + ridge_h                # from slope spec
    low_z     = wall_top - eave_drop              # overhang drop
    # One sloped quad plane
    spec.planes.push({
      vertices: [high_line.start@high_z, high_line.end@high_z,
                 low_line.end@low_z,     low_line.start@low_z],
      role: "slope",
      rafter_direction: perpendicular to segment (low → high),
      purlin_direction: parallel to segment,
    })
    spec.members.push({ role: "ridge", start: high_line.start, end: high_line.end })
    spec.members.push(...ringBeamAround(segment_rect))
    # Vertical gable-end infills on the two perpendicular ends
    for endpoint in [start, end] where endpoint.is_open:
      spec.planes.push(vertical trapezoid infill)
  return spec
```

### Pitched (unified gable + hip)

One derive function handles both classical types. Each leaf endpoint
of each segment is either **open** (gable-end wall) or **closed**
(hip triangle) — pulled from `segment.start_endpoint` /
`segment.end_endpoint`, falling back to `cfg.default_endpoint`.

```
derivePitchedRoof(cfg):
  spec = { members: [], planes: [], trusses: [] }
  endpoint_shared = resolveEndpoints(cfg.segments)   # {point: [refs]}
  for each segment:
    ridge_z = wall_top + ridge_h
    # Ridge IS the segment lifted to ridge_z. Ridge endpoints get
    # TRIMMED inward for CLOSED endpoints so the hip triangle has
    # room. See ridgeEndpointFor() below.
    ridge_start_3d = ridgeEndpointFor(seg, "start", endpoint_shared)
    ridge_end_3d   = ridgeEndpointFor(seg, "end",   endpoint_shared)
    spec.members.push({ role: "ridge", start: ridge_start_3d, end: ridge_end_3d })
    # Two eave lines parallel to segment at eave_z
    left_eave  = offsetLine(seg, +width/2)
    right_eave = offsetLine(seg, -width/2)
    # Two slope quads (or trapezoids when ridge is trimmed)
    spec.planes.push({
      vertices: [ridge_start_3d, right_eave.start@eave_z,
                 right_eave.end@eave_z, ridge_end_3d],
      role: "slope", side_of_segment: "right", ... })
    spec.planes.push({
      vertices: [ridge_start_3d, ridge_end_3d,
                 left_eave.end@eave_z, left_eave.start@eave_z],
      role: "slope", side_of_segment: "left", ... })
    # End caps at each leaf endpoint
    for endpoint in ["start", "end"] where endpoint is not in a joint:
      style = seg[endpoint + "_endpoint"] ?? cfg.default_endpoint ?? "closed"
      apex_at_endpoint = (seg[endpoint], ridge_z)
      left_corner  = left_eave[endpoint] @ eave_z
      right_corner = right_eave[endpoint] @ eave_z
      if style === "open":
        # Vertical gable-end wall triangle
        spec.planes.push({ vertices: [left_corner, apex_at_endpoint, right_corner],
                           role: "gable_wall" })
      else:  # closed → hip
        # Sloped hip-face triangle + two hip ridges + trimmed main ridge
        spec.planes.push({ vertices: [left_corner, apex_at_endpoint, right_corner],
                           role: "hip_face" })
        spec.members.push({ role: "hip", start: apex_at_endpoint, end: left_corner })
        spec.members.push({ role: "hip", start: apex_at_endpoint, end: right_corner })
        # (ridge_start_3d / ridge_end_3d already trimmed inward
        # by ridgeEndpointFor when this endpoint was "closed")
    spec.members.push(...ringBeamAround(segment_rect))
    for pos in trussesFor(segment):
      apex = (interpolate(seg, pos), ridge_z)
      L    = leftWallAt(seg, pos)
      R    = rightWallAt(seg, pos)
      spec.trusses.push({ bottom_left: L, bottom_right: R, apex })
  return spec

ridgeEndpointFor(seg, which, endpoint_shared):
  # For an OPEN endpoint, the ridge reaches the segment endpoint (or
  # extends slightly further if `gable_overhang` is set).
  # For a CLOSED endpoint, the ridge stops inward by
  #   setback = ridge_h / tan(pitch)
  # so the hip triangle has room to slope down. Joint endpoints don't
  # trim here — the joint resolver handles those.
  ...
```

Advantages of the unified type:

- One code path instead of two.
- **Dutch gable** ("hipped gable") comes for free — set one endpoint
  open, the other closed.
- The editor form shows one **Roof** picker with a **default endpoint
  style** dropdown; per-endpoint overrides in the segment list.
- BOM + panels + rendering all consume the same `RoofSpec` shape —
  no branching on gable-vs-hip anywhere downstream.

## Joint resolution

Runs AFTER all roofs are derived, BEFORE rendering / BOM. Walks the
endpoint list; every two segments that share an endpoint form a
joint.

```
resolveJoints(specs: RoofSpec[]):
  endpoints = { point: [segment_ref, ...] }
  for each roof, each segment:
    endpoints[seg.start].push(seg.id + ":start")
    endpoints[seg.end].push(seg.id + ":end")
  for each shared_point, refs in endpoints:
    if len(refs) == 2:
      resolveBinaryJoint(specs, refs[0], refs[1])
    elif len(refs) > 2:
      resolveMultiJoint(specs, shared_point, refs)   # Y / T
```

### Binary joint (two segments meeting)

- **Both pitched** (same roof type — the endpoint style at the
  joint is irrelevant since the joint absorbs both endcaps):
  - Ridges meet at the joint apex (both lift to the same Z).
  - The two roofs' inner slopes intersect along a **valley** line
    (inside corner) or fold along a **hip** line (outside corner)
    depending on the joint's convexity.
  - Emit a `valley` or `hip` `StraightMember`.
  - Trim each roof's slope plane so its edge lies along the
    valley/hip line, not the original rectangular edge.
  - Remove any gable-wall / hip-face plane that the joint endpoint
    would have carried — the neighbour absorbs it. (This is why
    per-endpoint `open`/`closed` only matters at *leaf* endpoints,
    not shared ones.)
- **Both shed** (same direction): planes intersect along a diagonal
  from the joint down to the low-eave outside corner. Trim planes
  to that diagonal.
- **Both flat**: unified polygon; no ridge/valley to compute.
- **Mixed types**: fall back to visual overlap for Phase 1 (each
  roof draws independently). Phase 2 (advanced) handles mixed
  joints properly.

### Multi-joint (3+ segments meeting)

Y and T junctions. Uncommon. Phase 3.

## Universal helpers

All axis-agnostic — they operate on planes and triangles produced
by the derive functions. Same as v1 plan:

- `populatePlaneRafters(plane, framing): StraightMember[]`
- `populatePlanePurlins(plane, framing): StraightMember[]`
- `buildShellSurface(plane): ShellMeshTriangles`
- `buildTrussMembers(triangle, cfg): StraightMember[]`
- `ringBeamAround(polygon, cfg): StraightMember[]`
  — one segment per polygon edge; handles concave polygons

### Rafter direction from plane

Every `role="slope"` plane carries `rafter_direction` (in-plane,
up-slope) and `purlin_direction` (in-plane, parallel to ridge). The
derive function sets these from the segment's direction:

```
rafter_direction = perpendicular to segment, projected into the slope plane
purlin_direction = segment direction, projected into the slope plane
```

The helpers use these directly — no more `ridge_axis` switching
anywhere.

## Rendering pipeline

**3D scene** (`House3D`):

```
allSpecs = roofs.map(cfg => derive*Roof(cfg))
allSpecs = resolveJoints(allSpecs)
for each spec:
  emit spec.members as boxes                      (spine layer)
  for plane in spec.planes:
    if plane.role in ("slope", "gable_wall", "parapet", "hip_face", "flat_slab"):
      emit buildShellSurface(plane) as mesh
    if plane.role in ("slope", "hip_face"):
      emit populatePlaneRafters(plane) as boxes   (surface layer)
      emit populatePlanePurlins(plane) as boxes   (surface layer)
  for tri in spec.trusses:
    emit buildTrussMembers(tri) as boxes          (spine layer)
```

Two React components: `<RoofSpine>` and `<RoofSurface>`, each
consuming a filtered `StraightMember[]`.

**2D top view** projects everything to XY:
- Segments as ridge lines (bold)
- Slope plane outlines
- Projected rafters + purlins
- Truss cross-lines at each `along_position`

**2D cross-section**: cut perpendicular to a segment at a chosen
point. For each intersected plane, draw its section-line. Draw the
truss silhouette. Purlin cross-sections as small squares.

**2D slope-face**: pick one slope plane, unroll to 2D uv. Rafters =
vertical lines (up-slope), purlins = horizontal lines (parallel to
ridge).

**BOM**: iterate members from every spec + every
`populatePlaneRafters/Purlins` call. Group by matSpec.

## Backward compatibility

Current schema has four separate roof types (`hip_roof`,
`gable_roof`, `flat_roof`, `shed_roof`) each with
`x, y, width, length`. The new model collapses `gable_roof` and
`hip_roof` into a single `pitched` roof type distinguished only by
its per-endpoint `open`/`closed` setting. Migration:

- **Add** the new `roof` type. Old types keep working via a compat
  adapter that converts a single-rectangle config into a
  single-segment `roof` config with the equivalent `roof_type`.
- The adapter derives the segment: centre line of the rectangle in
  the direction of `ridge_axis` (or `slope_dir` for shed); width =
  the perpendicular dimension.
- **Legacy `gable_roof`** → `roof` with `roof_type: "pitched"` and
  `default_endpoint: "open"` (both leaf endpoints of the single
  segment become gable walls).
- **Legacy `hip_roof`** → `roof` with `roof_type: "pitched"` and
  `default_endpoint: "closed"` (both leaf endpoints become hip
  triangles).
- **Dutch gable** (hip on one end, gable on the other) is expressible
  in the new model but has no legacy equivalent — new authoring only.
- All new template configs use `type: "roof"` with `segments: [...]`.
- Once every consumer is on the segment model, the four old types
  become read-only aliases handled by the adapter.

## Migration steps

Each step is independently commitable and testable.

### Step 1 — Data model + segment utilities (0.5 day)

- Define interfaces in `svg2d/roof/model.ts`
- `segmentRect(seg)` → the width-thick rectangle
- `offsetLine(seg, distance)` → line offset perpendicular
- `interpolatePoint(seg, along)` → point at `along` distance
- `resolveEndpoints(segments)` → endpoint→segments map
- Compat adapter: `oldRectRoofToSegments(cfg)` for the four legacy
  types

### Step 2 — Flat roof migration (0.5 day)

- Write `deriveFlatRoof(cfg): RoofSpec`
- Compat: legacy `flat_roof` → 1-segment `roof` (roof_type=flat)
- New 3D shell renderer consumes the spec
- Verify existing `flat_roof` templates render identically

### Step 3 — Shed roof migration (1 day)

- `deriveShedRoof(cfg): RoofSpec`
- Compat for legacy `shed_roof` with `slope_dir`
- Verify existing `shed_roof` templates render identically

### Step 4 — Pitched roof migration (3 days)

Single unified type that handles the former `gable_roof` and
`hip_roof` (plus dutch-gable mixes).

- `derivePitchedRoof(cfg): RoofSpec` — one derivation, per-endpoint
  open/closed dispatch (open → vertical gable-end wall plane;
  closed → sloped hip-face triangle + 2 hip diagonals + trimmed
  ridge endpoint via `ridgeEndpointFor`)
- Wire universal helpers: `populatePlaneRafters`,
  `populatePlanePurlins`, `buildTrussMembers`, `buildShellSurface`
- Compat adapters:
  - Legacy `gable_roof` → 1-segment pitched with
    `default_endpoint: "open"`
  - Legacy `hip_roof` → 1-segment pitched with
    `default_endpoint: "closed"`
- Verify existing gable + hip templates render identically **on
  both ridge_axis values** — this is where diagonal + x-axis +
  y-axis gables and hips all start working uniformly.
- **X-axis hip roofs render correctly** for the first time.
- Delete `buildFrame` (350 lines) — universal helpers cover it.
- New capability: dutch-gable authoring by mixing endpoint styles
  on a single segment (no legacy analogue, so no compat concern).

### Step 5 — Multi-segment configs (1 day)

- Templates: L-shape villa (2 segments), courtyard home (4 segments)
- Editor form: segment list with add/remove/reorder, each segment
  editable (start, end, width, per-segment overrides)
- Ring beam handles non-rectangular polygons

### Step 6 — Joint resolution (2–3 days)

- `resolveJoints(specs): specs` mutates the derived specs
- Binary joints for same-type (pitched-pitched, shed-shed)
- Cross-type joints (pitched-shed, pitched-flat) as follow-ups
- Valley + hip member emission
- Slope plane trimming to valley/hip line
- **Real courtyard home starts looking right** — four corner joints
  get proper valleys instead of overlapping shells

### Step 7 — Detail SVG panels rewrite (1–2 days)

- Rewrite pitched/flat/shed compose modules to consume `RoofSpec`
- One drawing routine per panel type
- Deletes duplicated logic across the compose modules (in
  particular, gable and hip compose collapse into one pitched
  compose module)

### Step 8 — BOM aggregation rewrite (0.5 day)

- Single BOM path that iterates every roof's spec
- Deletes `gableBom.ts` and flat/shed BOM shims

### Step 9 — Deprecate old types (0.5 day)

- Editor: `+ Add object → Roof` (single unified option, with a
  `roof_type` picker of flat / shed / pitched)
- Old `hip_roof` / `gable_roof` / `flat_roof` / `shed_roof` still
  loadable via compat adapter, but forms + BOM emit `roof`

## Estimated effort

| Step | Rough size |
|---|---|
| 1  Data model + utilities        | 0.5 day |
| 2  Flat migration                | 0.5 day |
| 3  Shed migration                | 1 day |
| 4  Pitched migration (gable+hip) | 3 days |
| 5  Multi-segment configs         | 1 day |
| 6  Joint resolution              | 2–3 days |
| 7  Detail SVG panels rewrite     | 1–2 days |
| 8  BOM aggregation rewrite       | 0.5 day |
| 9  Deprecate old types           | 0.5 day |
| **Total**                        | **10–12 days** |

## Design decisions to lock down before Step 1

1. **Coordinate frame for segments.** World XY (matches rooms /
   walls) or per-roof local origin with a translate?
   Recommendation: **world XY** — simpler, matches rooms.

2. **Endpoint matching tolerance.** For joint detection.
   Recommendation: **`epsilon = 0.5` units** (~0.6 in).

3. **Shared segment walls.** Two adjoining segments should share the
   ring beam on their shared wall. Recommendation: **compute the
   union polygon of all segment rectangles first, then draw ring
   beam around the union's edges only** (skips shared edges).

4. **Same-type shed joints.** Discontinuity at the joint (with a
   valley member) vs. re-aligning the two slopes to meet at a
   natural ridge? Recommendation: **discontinuity + valley member**
   (simplest); mixing shed directions is unusual.

5. **Truss auto-placement.** Fixed spacing per segment vs. always
   manual? Recommendation: **auto-place** with per-roof
   `truss_spacing_ft` (default 6 ft); user can specify explicit
   `positions_along[]` to override.

6. **Overhang direction.** For shed the low-side overhang extends
   past the wall down-slope; the high-side overhang extends UPWARD
   past the wall + ridge. Perpendicular ends: symmetric.
   Recommendation: **symmetric `min_overhang` on all four edges**.

7. **Slope spec: per-roof or per-segment?** User's idea has segments
   with different widths — implies segments can differ. Slope too?
   Recommendation: **per-roof default + per-segment override** via
   `segment.slope_override`.

8. **Concave planes.** A flat roof over a concave union polygon
   needs concave-polygon triangulation. Recommendation for Phase 1:
   **split any concave slope plane into multiple simply-connected
   sub-planes at derivation time** so populators only see convex
   polygons.

9. **Diagonal segments.** The user's idea allows segments in any
   direction, not just axis-aligned. All the math works — but the
   editor form UX needs a way to author non-axis-aligned segments
   (e.g. drag endpoints on a 2D canvas). Recommendation for Phase 1:
   **support diagonal segments in the config + renderer, defer 2D
   drag editing to a separate UX phase**. Users type in coordinates.

10. **Segment order matters for pitched/shed.** `start → end` defines
    the "along" direction; `shed_high_side`, `start_endpoint` /
    `end_endpoint`, and eave labels (`left` / `right`) are all
    relative to it. Recommendation: **left = +90° CCW from
    `start→end` direction, right = -90° CCW**.

11. **Default endpoint style for pitched.** New pitched roofs need
    a sensible default when the user hasn't set per-endpoint
    overrides. Recommendation: **`default_endpoint: "closed"`
    (pure hip)** — matches the dominant Konkan-house pattern. Pure
    gables and dutch gables are one-click overrides.

12. **Ridge trim for closed endpoints.** A closed (hip) endpoint
    must trim the ridge inward so the hip triangle can slope down
    from the ridge apex. Trim distance = `ridge_h / tan(pitch)`.
    Recommendation: **compute the trim inside `ridgeEndpointFor`
    so slope-plane vertices and ridge members stay consistent
    automatically**; open endpoints skip the trim and can even
    extend beyond the segment endpoint via `gable_overhang`.

## Immediate next action

Approve / edit this plan. When ready:

- **Step 1 + Step 2** together in a single branch — data model +
  flat roof migration. Small enough to review as one PR, big enough
  to prove the architecture end-to-end.
- Step 3 (shed) and Step 4 (pitched) land as separate PRs, each
  independently verifiable against the existing templates. Step 4
  is the load-bearing PR — it collapses two legacy roof types into
  one, fixes x-axis hip frames, and unlocks dutch-gable authoring.
