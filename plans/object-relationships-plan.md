# Object Relationships via Parametric Variables & Grid

Status: **design, approved-in-principle** (2026-07-21). Supersedes the constraint-solver
direction that was explored and rejected as too complex. Realises the "introduce
formulae in the values of base object parameters" idea from
[`higher-level-entities.md`](higher-level-entities.md), now viable because the
Python builder is retired (TS editor is the single source of truth, so a formula
evaluator lives in exactly one place).

## 1. Goal

Let a house define **named variables** and **named points** (a grid), and let any
object's coordinate/size field be **driven by a formula** over them. Relationships
between objects become emergent: two rooms that both reference `colB` share a wall;
change `colB` (or a variable it derives from) and both update. No constraint solver,
no bidirectional resolution — a single directional evaluation pass, same spirit as
the existing `z_offset` resolution.

Explicitly **out of scope for v1** (deferred, see §9): object-to-object references,
per-object stable ids, control-point anchoring, drag-to-edit. v1 relates objects
only through **shared variables/points**, which needs none of those.

## 2. The model

### House-level (new, all optional)
- `variables: Record<string, number | string>` — named scalars. A string value that
  **starts with `=`** is a **formula** (see the syntax convention below), and a
  variable's formula may reference **other variables** — so fixed relationships between
  variables are first-class:
  ```jsonc
  wall_t: 8,
  colA:   0,
  bay:    150,
  colB:   "= colA + bay",        // colB tracks colA + bay
  colC:   "= colB + bay",        // chains off colB
  eaves:  "= wall_t * 2",        // pure inter-variable relationship
  ```
  Change `bay` and every variable derived from it (`colB`, `colC`, …) updates in one
  pass, and so does every object field bound to them. This is the primary way to
  express "these dimensions are locked together." Grid **lines** are just variables by
  naming convention (`colA`, `colB`, `row1`, `wall_t`, `bay`).
- `points: Record<string, { x: number|string; y: number|string }>` — named 2D points
  for anchors that don't sit on a single grid line, e.g.
  `P_LivingNW = { x: "= colA", y: "= row1" }`.

### Syntax convention (uniform everywhere)
A value is a **formula iff it is a string beginning with `=`** — the same rule for
variables, point fields, and object field formulas (`= colA + wall_t`). A plain number
is a literal. This is exactly what the editor's smart field types (§3), so what the
user types and what is stored on disk match. The stored formula string **includes the
leading `=`**; the evaluator strips it before parsing.

### Per object (new, optional)
- `formulas?: Record<string, string>` — maps a geometry field name to its formula
  source, e.g. `{ x: "= colA", width: "= bay", y: "= row1 + wall_t" }`.
- The object's existing numeric fields (`x`, `y`, `width`, `start_x`, …) **keep the
  last resolved value**. So `formulas` is the source; the numeric field is the cached
  output.

**Why store both.** The numeric field is what every renderer, share link, and any
viewer-without-the-engine already reads — keeping it valid means the whole existing
pipeline and forward/back-compat are untouched. The formula is additive metadata that
lets the engine recompute. This also answers the deferred "where does the solved
geometry live" question: **in place, in the numeric fields; formulas are the recompute
source.**

### Formula language (v1)
Arithmetic `+ - * / ( )` and numeric literals over references to:
- a variable by name: `colA`, `wall_t`
- a point field: `P_LivingNW.x`, `P_LivingNW.y`

NOT object fields (`Living.x`) — that needs identity (§9). A tiny hand-written
tokenizer + shunting-yard evaluator; **no `eval`**, deterministic, safe.

## 3. Editing UX (the single smart field)

Forms use hand-rolled `NumberField`s (`editor/src/forms/fields.tsx`) that commit on
blur/Enter and already refresh from the store on external change. Extend the field so
it accepts **either a number or a formula**:
- Leading `=` (spreadsheet convention) marks a formula: typing `=colA + wall_t`
  stores `"colA + wall_t"` into `object.formulas[field]` and shows the **resolved
  number** when not focused (with an `fx`/formula affordance so the user can see/edit
  the source).
- A plain number stores into the numeric field and **clears** any `formulas[field]`.
- Invalid formula → field flagged, value left at last good (advisory, like the
  existing validation banner — never blocks the write).

A dedicated **Variables** and **Points** panel (Phase 2) lets the user add/rename/edit
the named table; grid lines can be tagged for later visualisation.

## 4. The engine

`resolveParametric(config) -> config` — one directional pass:
1. **Variables** — topologically resolve (variables may reference variables); detect
   cycles → leave unresolved + warn.
2. **Points** — resolve `{x,y}` (may reference variables + earlier points).
3. **Objects** — for each object, for each `formulas[field]`, evaluate over
   variables+points and write the result into the object's numeric field.

Because object formulas reference only variables/points (not each other), there is no
inter-object ordering problem in v1.

### Where it hooks
Fold `resolveParametric` into the store's mutation seam so user-edit + recompute land
in one `set` (one undo snapshot) and all subscribers re-derive from resolved geometry.
Per the pipeline map, the highest-leverage seam is a single internal `commit(next)`
that the object/house actions in `editor/src/state/configStore.ts` funnel through
(`updateObject`/`replaceObject`/`updateFloor`/`insertObject`/`duplicateObject`/…);
also run it in `loadConfig`. Downstream (`expandRoomWalls`, floor plans, elevations,
`House3D`, Layout) is **unchanged** — it only ever sees resolved numbers.

Errors (cycles, bad refs, divide-by-zero) must never throw into the store: catch →
keep last good numbers → surface through the existing geometry-warning banner
(`wadi-geometry-warnings` CustomEvent, `viewer/main.ts`).

## 5. Schema additions

`editor/src/schema/houseConfig.ts` is Zod `.strict()` with no load migration, so every
new key must be declared and **optional** so old files still load:
- `HouseConfig`: add optional `variables`, `points` (and later an optional
  `grid: { columns?: string[]; rows?: string[] }` that just *tags* which variables are
  lines, for UI).
- Each object type (discriminated union): add optional
  `formulas: z.record(z.string(), z.string())`. Simplest via a shared base merged into
  each member, or repeated per type.
- Keep `schema/house_config.schema.json` in sync (the CI mirror check).
- Forward-compat: a newer file opened on an older build fails `.strict()` today and
  shows the "newer version" banner — same behaviour as other additive fields; the
  resolved numbers still describe the house.

## 6. Meta-functions (Phase 3, authoring sugar)

Buttons/skill helpers that **wire shared variables/points** — they run at author time,
not render time:
- `adjacentEast(A, B, gap?)` → ensure a column var `= A.col + A.width (+gap)` and point
  B's `x` formula at it.
- `sameWidth([...])` / `sameLength` → point their `width`/`length` formulas at one var.
- `alignTop/Bottom/Left/Right([...])` → share a row/col var on the relevant edge.
- `stack([...])` → objects on different floors share the same col/row (plumbing).
Each is a small transform on `variables` + object `formulas`; nothing new at runtime.

## 7. Interactions with existing systems

- **Renderers / expand**: untouched — resolved numbers only.
- **Vertical (`z_offset`)**: unchanged; formulas are for the XY plane (and can drive
  `z_offset` too if useful). Cross-floor "stack" is an XY relationship.
- **Undo**: whole-config snapshot; recompute folded into the same `set` = one step.
- **Validation**: Zod stays structural/advisory; formula errors go to the warning
  layer, non-blocking.
- **Share links / .wadi / AI skill**: variables+points+formulas serialize with the
  config, so they travel. The `wadi-config` skill gains a natural way to encode a
  design brief's relationships as variables (Phase 5) — the original
  higher-level-entities intent, without a DSL.

## 8. Phasing

1. **Engine + schema** — `variables`/`points`/`formulas`, evaluator, `resolveParametric`
   in `commit`, cycle/error → warning. Prove headlessly with a hand-authored config
   (two adjacent rooms sharing `colB`). No UI beyond raw JSON.
2. **Field UX + panels** — smart `=formula` field with `fx` affordance; Variables &
   Points panel.
3. **Meta-functions + grid drawing** — relationship buttons; draw column/row lines in
   the 2D plan.
4. **(later) Object refs + control points** — needs stable object identity; unlocks
   `Living.right` style formulas and 9-point anchoring.
5. **(later) AI skill** — author variables/formulae from a brief.

## 9. Deferred / open

- **Object identity** — objects have no id (addressed by array index); required before
  object-to-object formulas or control points. Add an optional auto-assigned `id` when
  we reach Phase 4.
- **Control points** (the 9-grid `N,S,E,W,NE,…,C`) — reintroduce as anchoring sugar
  once object refs exist.
- **Drag-to-edit** the plan feeding formulas/snap — a Phase-4+ nicety.
- **Grid as first-class** (`columns`/`rows` structure with auto intersection points and
  drawn lines) vs the v1 convention of naming scalar variables — decide at Phase 3.

## 10. Worked example

```jsonc
variables: { wall_t: 8, colA: 0, bay: 150, colB: "= colA + bay", row1: 0, depth: 200 }
objects: [
  { type: "room", name: "Living",
    x: 0,   y: 0, width: 150, length: 200,
    formulas: { x: "= colA", y: "= row1", width: "= bay", length: "= depth" } },
  { type: "room", name: "Dining",
    x: 150, y: 0, width: 150, length: 200,
    formulas: { x: "= colB", y: "= row1", width: "= bay", length: "= depth" } }
]
```
`colB = colA + bay` ⇒ Dining's left edge sits on Living's right edge (shared wall).
Change `bay` → both rooms resize and Dining shifts, staying adjacent. Change `colA` →
the whole block slides. Zero solver.
