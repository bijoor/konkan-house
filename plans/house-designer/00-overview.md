# Wadi House Designer — an AI design tool (overview)

A **tool used by an AI** (Claude via a skill/MCP), **not a UI**. It gives the AI a
formal methodology + knowledge base to interactively design a house with a user,
then emit a parametric `.wadi` / `house_config.json` that the Wadi app renders and
live-updates.

## Why now

It builds directly on two things already in the repo:
- The **parametric engine** (variables + points + formulas + grid) added to the
  Wadi editor — the substrate for the parametric model (step 5). See
  `plans/object-relationships-plan.md`.
- The **`wadi-config` skill** — already does "plain-English brief → derive config,
  keep a `house_brief.md`, re-derive on change." This methodology formalizes that
  brief into a structured, rule-driven pipeline.

## The pipeline (five stages)

```
1. OPTIONS      what the user wants — a structured catalog of spaces + choices
                (bedrooms, combine LDK, garage, Konkan traditional spaces, …)
        │  elicited by the AI from the user (interview), constrained by rules
        ▼
2. LOGICAL      a BOT-style graph (W3C Building Topology Ontology, high level):
   GRAPH        Zones (spaces) + Interfaces (adjacency/doors) + hierarchy
                (Building▸Storey▸Space) + relative-size + access relations
        │  a topology, no coordinates yet
        ▼
3. GRID         place the graph onto a layout grid (per floor). Grid lines are
                symbolic (colA, colB, row1…); each space occupies grid cells.
        │  structure fixed; dimensions still symbolic
        ▼
4. CONTROL      the grid line spacings ARE control variables, defaulted from each
   VARIABLES    space's relative size. A handful of high-level knobs (plot,
                plinth, bay widths) drive the rest via formulas.
        │
        ▼
5. PARAMETRIC   emit variables + points + formulas + objects → .wadi. The user
   .wadi        tweaks control variables to fit plot/plinth; the Wadi app
                live-re-renders. (Uses the engine we just built.)
```

Each stage is a defined, inspectable artifact the AI produces and the user can
steer. This doc set covers them in order:
- `01-options-structure.md` — stage 1 (**this is the current deliverable**)
- `02-logical-graph.md` — stage 2 (BOT) — TODO
- `03-grid-and-controls.md` — stages 3–4 — TODO
- `04-emit-wadi.md` — stage 5 (→ parametric config) — TODO

## Delivery shape (DECIDED) — a CLI app of composable tools

**Not a UI, and not just a skill.** We build a real **app**: a set of deterministic
**CLI tools**, one per pipeline stage, that a skill (and later an MCP server) drives.
Each tool reads a JSON artifact and writes the next one, so the AI can run a stage,
show the result to the user, tweak, and continue. TypeScript, to reuse the editor's
Zod schema, the `.wadi` format, and the parametric resolver we built.

```
options.json ─(design options)→ program.json ─(design graph)→ graph.json
   ─(design grid)→ grid.json ─(design emit)→ house.wadi   (+ house.wadi opens live in the Wadi app)
```

The skill later becomes a thin methodology layer that calls these tools and
interviews the user; `wadi-config` stays the low-level JSON layer `emit` targets.

## Locked decisions (from stage-1 review)

- **Full catalog** up front (not a lean subset).
- **Neutral catalog + archetypes**: the catalog is generic space types + rules;
  **Konkan is one selectable archetype** (defaults + aliases + spine), modern
  bungalow etc. can be added later.
- **Multi-storey = bedroom floor over ground**: upper floors are simpler
  bedroom/bath floors stacked over the ground plan (wet spaces stacked for
  plumbing); the hall-hub stays single-storey.
- **Delivery = CLI app** whose tools a skill/MCP consumes.
