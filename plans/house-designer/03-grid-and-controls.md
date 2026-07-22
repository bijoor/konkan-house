# Stages 3–4 — grid layout + control variables

Turn the BOT graph into a **grid**: a set of column (X) and row (Y) grid lines, with
each space occupying a rectangle bounded by those lines. **Grid-line spacings are
the control variables**, defaulted from each space's reference size. The user later
tweaks a handful of these to fit their plot — and stage 5 emits them as the `.wadi`
`variables` + formula-driven objects, so the Wadi app re-renders live.

Reference-informed (from the on-grid case studies): real houses sit on a **named
structural column grid** (C1…Cn, B1…Bn) with pillars at intersections; rooms snap to
those lines. Real sizes (ft): living ~16×17, bedroom ~12×12, kitchen ~8×10, dining
~10×12, bath ~4×8 (narrow), pooja ~5×6, passage ~3 wide. Those become variable
defaults; walls 230/150 mm and levels (plinth 4ft, floor 12ft) feed stage 5.

## Grid model (artifact)

```jsonc
{
  "archetype": "konkan",
  "variables": { "bayA": 100, "bayB": 160, "row1": 120, "wall_t": 8, ... },
  "columns": [ { "id": "X0", "at": "0" }, { "id": "X1", "at": "= X0 + bayA" }, … ], // cumulative
  "rows":    [ { "id": "Y0", "at": "0" }, { "id": "Y1", "at": "= Y0 + row1" }, … ],
  "placements": [
    { "space": "central_hall", "storey": "ground", "x0": "X1", "x1": "X2", "y0": "Y1", "y1": "Y2" },
    …
  ]
}
```

- **Grid lines are cumulative**: `X_i = X_{i-1} + bay_i`. The `bay_i` / `row_j` are
  the control variables (project units, 10 = 1 ft), defaulted from the sizes of the
  spaces that span them.
- Each **placement** ties a space to four grid lines. Stage 5 turns that into a
  room object with `x = X0.value`, `width = X1 − X0`, etc. — as **formulas** over
  the variables, so moving a bay moves everything on it.
- **Plot/plinth fit**: the outer lines' spacings (and a few key bays) are the knobs
  the user changes to fit their plot; the rest can be pinned or scale with them.

## Layout algorithm — the fork

Placing an arbitrary adjacency graph onto a rectangular grid is floor-planning.
Three tractable strategies (pick one for v1):

- **A. Slicing tree (recursive H/V splits).** Recursively split the footprint —
  first by zones (public/private/service), then rooms within — into a slicing
  floorplan. Split ratios come from sizes. Always yields a valid rectangular
  layout, handles any room count. Grid lines emerge from slice coordinates (not
  globally aligned across the whole plan, but locally rectangular). Most general;
  moderate effort.
- **B. Archetype grid template.** The archetype declares a fixed cell template
  (Konkan's classic 3×3 hall-centered grid); rooms drop into named cells. Produces
  authentic, globally-aligned grids that match the references — but rigid (awkward
  with variable bedroom counts / modern zoning). Low effort per template, low
  generality.
- **C. Zone bands + packed rows.** Lay zones as bands; pack each zone's rooms into
  rows within its band. Simple and general; grids align within a band but not
  always across bands. Low effort, decent results.

**Recommendation: A (slicing tree), archetype-guided** — the archetype's
sequence/zones seed the top-level splits (Konkan → spine bands with the hall
central; modern → zone regions), then rooms slice within. It's general (any
program), always valid, and naturally parametric (every slice = a control
variable). A globally-aligned structural grid (like the reference sheets, with
columns running the full depth) is a **later refinement** (snap slice lines to a
shared column set); v1 accepts locally-rectangular grids.

## Build steps (once the strategy is confirmed)

1. `schema/grid.ts` (variables + columns + rows + placements).
2. `stages/grid.ts` — graph → grid (the layout algorithm) + default control
   variables from size classes/reference dims.
3. `grid` CLI command + tests (konkan + modern lay out validly, no overlaps,
   grid lines resolve).
4. THEN stage 5 `emit`: grid → `.wadi` (site/plinth + per-space room objects with
   formula geometry over the grid variables + roof + levels) → live in the app.
