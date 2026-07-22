# App architecture — the CLI tool set

A TypeScript CLI app: one deterministic tool per pipeline stage, each reading a
JSON artifact and writing the next. A skill (later MCP) drives them and interviews
the user between stages. Reuses the editor's `.wadi` Zod schema + the parametric
resolver.

## Package

`designer/` — a new package sibling to `editor/`. TypeScript, run with `tsx`
(as the rest of the repo does); a `wadi-design` bin for the skill to call.

```
designer/
  package.json          # bin: wadi-design → src/cli.ts (via tsx)
  tsconfig.json
  src/
    cli.ts              # arg parsing (node:util parseArgs) + subcommand dispatch
    schema/             # Zod schemas for each ARTIFACT
      options.ts        #   the user's choices (input)
      program.ts        #   instantiated program (spaces + relations)
      graph.ts          #   BOT logical graph
      grid.ts           #   grid layout + control variables
    catalog/
      catalog.ts        # loader + Zod for the space catalog
      archetypes.ts     # loader + Zod for archetype presets
    stages/
      options.ts        # options + archetype → program        (stage 1)
      graph.ts          # program → BOT graph                  (stage 2)
      grid.ts           # graph → grid + control variables      (stages 3-4)
      emit.ts           # grid → .wadi (variables/points/formulas/objects) (stage 5)
    wadi/
      bridge.ts         # import editor's HouseConfig schema + resolveParametric;
                        # helpers to build objects/variables/points/formulas
  data/
    catalog.json        # the neutral space catalog (full)
    archetypes/
      konkan.json       # the Konkan preset (defaults + aliases + spine)
    size-classes.json
  test/                 # vitest — golden artifacts per stage
```

Reuse: `wadi/bridge.ts` imports from `../../editor/src/schema/houseConfig` and
`../../editor/src/param/resolve` (tsx resolves TS across the two packages). Keeps
one source of truth for the `.wadi` format + the resolver. (If cross-package
imports get awkward, promote the shared bits to a tiny `shared/` later.)

## CLI surface

Every command: `--in <file|-.stdin>`, `--out <file|-.stdout>`, JSON in/out, so the
skill can pipe and inspect. `--archetype konkan` where relevant.

| command | in → out | does |
|---------|----------|------|
| `wadi-design catalog` | – → catalog.json | dump catalog + archetypes (AI introspection) |
| `wadi-design options` | options.json → program.json | validate choices vs catalog+archetype; instantiate spaces + relations (§C rules) |
| `wadi-design graph` | program.json → graph.json | build the BOT graph (zones/interfaces/hierarchy) |
| `wadi-design grid` | graph.json → grid.json | place on a grid; derive control variables from size classes |
| `wadi-design emit` | grid.json → house.wadi | render to a parametric `.wadi` (uses the engine) |
| `wadi-design design` | options.json → house.wadi | run all stages; `--open` to `open -a Wadi` |
| `wadi-design validate` | any artifact | Zod-validate an artifact |

Intermediate artifacts are first-class + inspectable, so the AI can run one stage,
show the user, tweak options/graph/grid, and re-run downstream.

## How the skill uses it (later)

The `wadi-house-designer` skill = interview methodology + calls to these tools.
It elicits options → `wadi-design options` → shows the program → `graph` → `grid`
→ `emit` → opens the `.wadi` live in the Wadi app. `wadi-config` remains the
low-level layer the emitted file conforms to.

## Build order

1. **Stage 1 CLI — DONE.** schema/options + schema/program + catalog (22 spaces) +
   konkan archetype + `stages/options` + `catalog`/`options`/`resolve`/`validate`
   commands + 13 tests. Choices → instantiated program, verified on konkan
   defaults + modern variants (open-LDK, 2-floor with stacked plumbing).
2. **Stage 2 `graph`** — program → BOT graph (zones/interfaces/hierarchy). NEXT.
3. Stages 3-4 `grid` — graph → grid + control variables.
4. Stage 5 `emit` — grid → `.wadi` (variables/points/formulas/objects), live in the app.
5. `design` orchestrator. 6. Wrap in the skill.
