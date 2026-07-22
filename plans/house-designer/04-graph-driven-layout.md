# 04 — Graph-driven layout (grid refinement)

Status: **design / thinking** (not yet built). Supersedes the topology handling in
`03-grid-and-controls.md`: that stage's slicing tree invents *both* topology and
geometry in one pass. This document inverts that — **topology (the graph) becomes
the editable source of truth, and geometry (grid) becomes a solved consequence.**

## Why change

Today: `options → program → graph → grid(slicing) → emit`. The `grid` stage
recursively guillotine-slices the footprint ordered by zone. Problems:

- The **graph is throwaway** — it's built but the grid ignores it and re-derives
  adjacency from wherever the slice happens to cut. Rooms that the archetype says
  should connect often don't end up adjacent.
- **No interfaces surface in geometry** — the graph knows "hall↔bedroom = door",
  but emit produces no doors/openings, so generated houses are disconnected boxes.
- **One layout only** — slicing yields a single tiling; the user can't explore
  alternative arrangements.
- **Grid is unconstrained** — near-coincident cut lines create sliver bays and
  mis-aligned columns; nothing enforces a minimum bay or aligns pillars.

Target: `options → program → **graph(interfaces, editable)** → **layout(topological, many)** → **sizing(reference)** → **grid(constrained)** → emit(+openings)`.

The user edits the **graph** (via the AI skill), sees candidate **layouts**, picks
one; sizing + grid + emit are deterministic from there.

## New pipeline

```
options ─▶ program ─▶ graph ─────▶ layout ─────▶ sizing ─────▶ grid ─────▶ emit
                       ▲  (edit)     │ (choose)                              │
                       └── AI skill ─┘ candidate K                          ▼
                                                                       .wadi (+doors)
```

Each stage is a JSON-in/JSON-out CLI command (as today). Two stages are new
(`layout`, `sizing`); `graph` gains interfaces + rendering + edit ops; `grid` is
reworked but keeps the **same Grid artifact + emit** (so the parametric emit from
[[03-grid-and-controls]] / the reference-convention emit is untouched).

---

## Stage 1 — Archetype interfaces (data model)

Replace the ad-hoc `topology.{sequence, adjacencies}` with a unified **interfaces**
rule list. An interface is a *typed edge template* between roles:

```jsonc
// archetype.topology.interfaces[]
{
  "between": ["central_hall", "private"],   // role = space-id | category | zone | "outside"
  "type": "door",                            // wall | door | open | threshold
  "strength": "required",                    // required (hard) | preferred (soft)
  "cardinality": "each",                     // one | each (hub→EACH bedroom)
  "axis": "any"                              // any | spine (lay along the main axis, in order)
}
```

Interface **types** (these carry all the way to emit → openings):

| type | adjacency | opening in the shared wall |
|------|-----------|----------------------------|
| `wall` | share a wall | none (solid) |
| `door` | share a wall | a door object, centred |
| `open` | share a wall | wide cased opening (no leaf) |
| `threshold` | share an edge | verandah-style open transition (columns, no wall) |

Sugar that expands into interfaces (keep for authoring brevity):

- `hub: central_hall` → `{between:[hub, "*unattached*"], type:"door", cardinality:"each"}`
  — the hub reaches every room not otherwise connected (guarantees connectivity).
- `sequence: [...]` → consecutive `threshold`/`open` interfaces with `axis:"spine"`
  (the Konkan front-to-back axis).
- `zones` unchanged (used by layout scoring for clustering).

External interfaces use the reserved node `"outside"`: `{between:["entry","outside"],
type:"door"}` = the front door; windows default onto exterior walls (Phase E).

`konkan.json` re-expressed: spine interfaces (entry→…→back_yard, threshold/open) +
hub doors to each private room + the existing kitchen/store/verandah doors.
`modern.json`: foyer↔ldk open, ldk↔each bedroom door, garage↔foyer door, etc.

---

## Stage 2 — Graph: editable + viewable

`program → graph` already builds the BOT graph (`adjacent` edges carry
`interface: door|open|none`). Changes:

1. **Instantiate interface rules** over instances: expand `cardinality:"each"` across
   every instance of a category/zone; resolve roles→iids; dedupe. The `hub`
   "unattached" rule runs last, connecting any still-disconnected room.
2. **Realizability check** (surfaced here, before layout): the *required* subgraph
   must be **connected** and **planar** (a floor plan is planar). Report violations
   with the offending edges so the user can fix the graph.
3. **Render**: `graph --render mermaid|dot` → a node-link diagram the AI skill shows
   the user (nodes coloured by zone, edges styled by interface type).
4. **Edit ops** (the "edit the graph via the AI skill" path). The skill can just
   mutate the graph JSON and re-validate, but provide safe helpers:
   `graph-edit --add-edge A B --interface door`, `--remove-edge A B`,
   `--add-space <catalog-id> [--connect-to X --interface door]`,
   `--set-size iid l`, `--set-zone iid private`. Each validates + re-checks
   realizability and writes the graph back.

The graph is now the **primary artifact a human/AI reasons about**; everything
downstream is derived.

---

## Stage 3 — Layout: graph → many topological arrangements  ⟵ the heart

**Input:** the graph (required `adjacent` edges + boundary/orientation hints).
**Output:** K candidate **Layout**s — each a set of rooms as rectangles on an
*integer/topological* lattice (NO real dimensions yet), such that every required
adjacency is a shared wall **segment** (positive-length contact), plus which rooms
touch each of the 4 outer sides.

This is the classic **rectangular-dual / floor-plan-realization** problem: given an
adjacency graph, tile a rectangle with rectangles whose contacts match the graph.

### Engine options (honest trade-off)

**(A) Rectangular dual via Regular Edge Labeling (REL)** — the rigorous method
(Kozminski–Kinnen; GPLAN / Shekhawat). Triangulate the planar adjacency graph, add
4 corner vertices (N/E/S/W), compute an REL (two transversal structures), read off a
rectangular dual; the set of RELs forms a distributive lattice → principled
**enumeration of alternative layouts**. Realizes *any* dualizable graph. Cost:
large — planar embedding, triangulation, separating-triangle handling, REL flips.
Weeks of careful, well-tested work.

**(B) Graph-guided slicing search** — enumerate/search guillotine partitions;
each induces a set of adjacencies; **score by how many required edges it realizes**
+ shape quality; keep top-K. Reuses today's slicing infra. Much cheaper. Limit:
slicing floor plans are a strict subset — a "pinwheel" (central room touched by 4
around it in a cycle) isn't sliceable, so some required-adjacency sets are
unreachable → fall back to inserting circulation or softening an edge (and reporting
it). Real hub-and-spoke Konkan/modern plans are largely sliceable.

**(C) Constraint/force placement** — MIP or force-directed then rectangularize;
fuzzy, heavy, hard to guarantee validity. Not recommended.

**Recommendation:** ship **(B)** first; keep the **Layout artifact engine-agnostic**
so **(A)** can replace the engine later without touching sizing/grid/emit. Phase B
delivers real value (graph-honouring, multi-candidate) at a fraction of the cost.

### Candidate scoring / ranking

- **Hard:** all `required` adjacencies realized. If not → mark candidate
  `needs_circulation`/`unrealized:[edges]` and either auto-insert a corridor node or
  surface to the user.
- **Soft (rank):** preferred adjacencies met · compactness (bbox / used area near 1)
  · aspect ratios near size-class ratio · zone contiguity · orientation (spine axis
  straight; entry/verandah on the front side; wet rooms grouped; multi-storey wet
  stacked) · structural-regularity potential (few distinct cut lines).
- Emit top-K (default 3–5) with scores; the AI skill renders them for the user to
  choose (or auto-pick rank 1).

### Layout artifact (sketch)

```jsonc
{
  "archetype": "konkan",
  "candidates": [{
    "score": 0.82,
    "rooms": [{ "iid": "...", "x0": 0, "x1": 2, "y0": 0, "y1": 1 }],  // topological units
    "boundary": { "N": ["front_verandah"], "S": ["back_yard"], "E": [...], "W": [...] },
    "adjacencies": [{ "a": "...", "b": "...", "interface": "door", "side": "E" }],
    "unrealized": []
  }]
}
```

---

## Stage 4 — Sizing: reference sizes → real dimensions

**Input:** one chosen topological layout. **Output:** real coordinate for every cut
line, so each room gets ≥ its minimum and ≈ its preferred size.

A topological layout induces vertical cut lines (`Vx`) and horizontal cut lines
(`Hy`); each room spans a contiguous range of each. Build the two **constraint
graphs** (VLSI dimensioning):

- Width: for room r spanning `Vx[a..b]`, `x(b) − x(a) ≥ minW(r)`, soft target
  `≈ prefW(r)`.
- Height: symmetric with `Hy` and depth.

Solve:

1. **Longest-path (critical path)** for the minimal feasible x/y of each line —
   guarantees every room ≥ min. (No solver dependency; pure graph longest-path.)
2. **Distribute slack** toward preferred sizes and to square up the outline
   (rooms below preferred grow first). Optional upgrade: a tiny **LP** minimising
   Σ weighted |size − preferred| subject to the min constraints — cleaner targeting,
   but adds a solver. Start with longest-path + slack heuristic.

**Data:** enrich `size-classes.json` from a single `w×d` to `{min, pref, max}` per
axis so the sizer has slack:

```jsonc
"m": { "w": {"min":10,"pref":12,"max":14}, "d": {"min":10,"pref":12,"max":16} }
```

Output = the layout with real coords on every cut line + each room's real w/d
("how much space is allocated, and how").

---

## Stage 5 — Grid: derive a *constrained* structural grid

**Input:** the dimensioned layout (cut lines with real coords). **Output:** the
existing **Grid artifact** (columns/rows as cumulative lines + placements + spacing
vars) — so **emit is unchanged**. This stage becomes *regularize*, not *slice*:

1. **Cluster / snap lines (min-distance constraint).** Collect all room-boundary
   coords; 1-D cluster with a `min_separation` threshold. Lines within `min_gap`
   merge to one grid line (snapped position). This is exactly the user's *"two grid
   points too close → cramped"* rule, and it **globally aligns columns** (near-
   coincident lines across the plan collapse → pillars line up).
   - `min_gap` default ≈ `max(wallT + margin, min_bay)` (e.g. ~3 ft structural min).
2. **Re-check room minima.** If a merge pushed a room below its min size, split the
   cluster / nudge lines out to `≥ min_gap` and re-solve locally.
3. **Max-bay split (optional).** A bay wider than `max_bay` gets an intermediate
   structural line so pillar spacing / beam spans stay realistic.
4. **Emit Grid.** Unique clustered coords → cumulative `GridLine`s; spacings →
   control variables; placements tie each room to its 4 lines. → feeds the existing
   reference-convention emit (colW/rowH knobs, A1/B2 node matrix, dimension points,
   pillars on nodes).

Grid **constraints** collected in one place: `min_gap` (min bay), per-room min/pref
(from sizing), global column alignment (via clustering), optional `max_bay`, outline
rectangularity (from the rectangular dual). All tunable in the archetype/options.

---

## Stage 6 — Emit: interfaces → openings (the payoff)

Because interface types ride on the realized adjacencies through layout→grid, emit
can finally connect rooms:

- realized `adjacent` + `door` → a door object centred on the shared wall segment.
- `open` → a wide cased opening; `threshold` → open verandah edge (columns only).
- `wall`/`none` → solid.
- `entry`→`outside` → front door; windows default onto exterior walls (heuristic
  or explicit `outside` interfaces).

This closes the loop the user asked for — layouts that genuinely *connect rooms*.

---

## Realizability loop (why the editable graph matters)

If the required adjacencies can't be realized (non-planar, or non-sliceable under
engine B), the layout stage **reports the conflict** (which edges, and a suggestion:
add a hall/corridor, soften an edge, re-zone). The user edits the **graph** via the
AI skill and re-runs. The graph being the editable source of truth is what makes
this iterative fix possible — the old slicing-first flow had nowhere to intervene.

---

## Phasing

- **A. Interfaces + graph tooling** — archetype `interfaces` model; graph
  instantiation + realizability check; `graph --render mermaid`; graph-edit ops.
  *(Graph becomes the editable, viewable source of truth.)*
- **B. Layout stage** — graph-guided slicing search, K candidates, adjacency scoring
  + ranking; Layout artifact + `layout` CLI. *(Many topological layouts from the graph.)*
- **C. Sizing stage** — size-class min/pref/max; longest-path + slack dimensioning;
  `sizing`/`size` CLI.
- **D. Grid rework** — constrained regularize (min-gap cluster/align) from the
  dimensioned layout; keep Grid artifact + emit stable.
- **E. Emit openings** — interfaces → doors/openings/windows.
- **F. (optional, advanced)** REL rectangular-dual engine for non-sliceable graphs.

## Decisions (locked 2026-07-21)

1. **Layout engine: B now, A later.** Build graph-guided **slicing search** now;
   keep the Layout artifact engine-agnostic so the **REL rectangular-dual** engine
   (Phase F) swaps in later with no rework of sizing/grid/emit.
2. **Sizing solver:** hand-rolled **longest-path + slack** (no deps) first; LP is a
   later optional upgrade.
3. **Openings: deferred.** Land interfaces→layout→sizing→grid first (rooms + walls +
   pillars, single-walled, connected-by-adjacency). Door/opening/window emission
   (Phase E) is a follow-up once the topology pipeline is proven.
4. **Size-class enrichment** to `{min,pref,max}` — yes, proceed (needed by sizing).

### Build order

**A. Interfaces + graph tooling** → **B. Layout (slicing search)** → **C. Sizing** →
**D. Grid rework**. (E openings, F REL — deferred.)

### Status (all of A–D DONE, 91 tests)

Pipeline wired end to end: `design` now runs options→program→graph→layout→sizing→
grid→emit, so the chosen layout candidate drives the emitted `.wadi` (`--candidate i`;
`--slicing` falls back to the legacy program→grid engine). Phase D's `dimLayoutToGrid`
(`src/stages/gridFromLayout.ts`) unifies per-storey lattices into ONE global grid and
regularizes it: cluster lines within `snap_tol` (1.5 ft → align floors + drop
slivers), then enforce `min_gap` (2 ft min bay). Emits the same Grid artifact, so the
reference-convention emit is unchanged. All six examples emit valid `.wadi`. Known
open items: comb layouts oversize the hub (shape — eased by REL/Phase F); openings
(Phase E); cross-floor column alignment is top-left-anchored (fine for v1).
