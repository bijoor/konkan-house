# Konkan House Editor

A standalone browser-based editor for `house_config.json` — the JSON that
drives both the Blender 3D pipeline and the SVG floor plan / elevation
generators in the parent repo. Ships to `docs/editor/` on the same
GitHub Pages site as the model viewer.

## What it does

- **Load / edit / download** `house_config.json` entirely in the browser
- **Live SVG previews** of floor plans and elevations, byte-identical to
  the Python `svg_2d.py` output (42/42 parity checks pass)
- **Live 3D preview** (React Three Fiber) with CSG openings, hip roof,
  staircase, section cutter, layer toggles, camera presets, and
  postprocessing (SSAO + ACES tone mapping + SMAA)
- **Form-based property editor** with undo/redo (⌘/Ctrl+Z), validation,
  duplicate/delete, and keyboard shortcuts

## Workflow

The editor never touches disk directly — it uses the browser's file
picker to load and the download API to save. To iterate on a design:

1. **Open** `docs/editor/` (or the GitHub Pages URL). On first load it
   auto-fetches `../house_config.json` from the same Pages site, so
   there's usually no manual load step.
2. **Edit** — click any object in the left sidebar tree, tweak fields
   in the right panel, watch the SVG and 3D previews update live.
3. **Download** — ⌘/Ctrl+S or the top-bar button saves the JSON.
4. **Drop it into the repo** — replace `blender/house_config.json` with
   the downloaded file.
5. **Regenerate outputs**:
   - `python3 regenerate_combined_svgs.py` for SVG floor plans /
     elevations (no Blender needed)
   - Open `konkan_house_config.py` in Blender's Text Editor and press
     Alt+P for the full GLB + material build

## Local development

```bash
cd editor
npm install
npm run dev        # Vite dev server (usually http://localhost:5173)
npm run build      # Production build → ../docs/editor/ + copies
                   # ../house_config.json to ../docs/house_config.json
```

### Parity harnesses (verify TS ports match Python)

```bash
npm run parity-primitives   # 34 shape / dimension / expand checks
npm run parity-floorplans   # 3 whole-SVG byte diffs
npm run parity-elevations   # 5 whole-SVG byte diffs
npm run parity-all          # all of the above
```

Each byte-diff compares the TS `svg2d/` output against the Python
output already sitting in `../docs/`. If the Python output is stale,
regenerate it first with `python3 ../regenerate_combined_svgs.py`.

### Schema validation

```bash
npm run smoke-validate      # Zod schema check on ../house_config.json
```

## Deployment

The editor deploys as a subpath of the same GitHub Pages site as the
model viewer. `vite.config.ts` sets `base: './'` for path-agnostic
asset URLs and points `build.outDir` at `../docs/editor/`. A build
plugin copies `../house_config.json` to `../docs/house_config.json` so
the auto-load fetch on first visit works.

To publish: run `npm run build`, commit `docs/editor/` and
`docs/house_config.json`, and push. GitHub Pages serves from `docs/`.

## Architecture

```
editor/src/
├── App.tsx                     shell + auto-load bootstrap
├── components/
│   ├── TopBar.tsx              load / download / validate / undo / redo
│   ├── Sidebar.tsx             floor tabs + object tree
│   ├── PropertyPanel.tsx       dispatcher → per-type editor
│   └── PreviewArea.tsx         tabs: Summary | Plans | Elevations | 3D
├── forms/                      per-object-type editors
│   ├── RoomForm.tsx            nested per-side walls + openings
│   ├── WallForm.tsx            standalone walls
│   ├── simpleForms.tsx         pillar / beam / slab / staircase / roof
│   └── fields.tsx              NumberField / TextField / SelectField
├── io/fileIO.ts                pickAndLoadConfig / downloadConfig
├── schema/houseConfig.ts       Zod schema (mirrors JSON Schema)
├── state/configStore.ts        Zustand + zundo undo/redo
├── svg2d/                      TypeScript port of svg_2d.py
│   ├── expand.ts               house_expand.py port
│   ├── format.ts               f() / fFloat() numeric helpers
│   ├── shapes.ts               svg_draw_wall / room / door / …
│   ├── edges.ts                edge extraction + dimension levels
│   ├── dimensions.ts           svg_draw_dimension_line etc.
│   ├── floorPlan.ts            generate_floor_plan_svg
│   ├── floorPlansAll.ts        generate_all_floor_plans
│   ├── floorPlansCombined.ts   generate_combined_floor_plans
│   ├── elevationView.ts        generate_elevation_view (1176 LOC port)
│   ├── elevationsAll.ts        generate_all_elevations
│   ├── elevationsCombined.ts   generate_combined_elevations
│   ├── roofGeometry.ts         roof_geometry.py port
│   └── config.ts               GLOBAL_CONFIG defaults / dimensions
├── three/                      3D preview
│   ├── ThreePreview.tsx        Canvas + lights + orbit + postFX +
│   │                           camera presets + section cutter
│   ├── House3D.tsx             config → box primitives per layer
│   ├── boxes.tsx               simple wrappers around <boxGeometry>
│   ├── wallCSG.tsx             three-bvh-csg wall + opening subtraction
│   ├── roof.tsx                hip roof mesh + ridge line + vent ext
│   ├── staircase.tsx           per-step stacked-box staircase
│   ├── coords.ts               world → Three transforms
│   └── layers.ts               layer definitions + visibility store
└── scripts/                    parity + validation runners
    ├── parity-primitives.mjs
    ├── parity-floorplans.mjs
    ├── parity-elevations.mjs
    └── smoke-validate.ts
```

## Numeric formatting convention

The parity harnesses require byte-identical output vs. Python. Python
distinguishes `int` (`"110"`) from `float` (`"110.0"`); JavaScript has
one `Number` type. `svg2d/format.ts` provides two formatters used
throughout the port:

- `f(n)` — bare rendering (`"110"` for whole numbers)
- `fFloat(n)` — Python-float rendering (`"110.0"` for whole numbers)

The trick when porting is to identify which side of the int/float
divide each Python expression lands on. Any expression touched by `/`
in Python 3 is float; anything derived from an integer-only chain is
int. When a function receives a value that could be either, the port
threads a boolean flag (see `offsetIsFloat` / `x1IsFloat` on
`svgDrawDimensionLine`, or the shadowed-`width` quirk in
`floorPlan.ts`).

## Known limitations

- Roof forms use a raw-JSON display — a proper editor is future work.
- Standalone walls with diagonal geometry render with a bounding-box
  approximation in the 3D preview (axis-aligned walls are exact).
- The `GLOBAL_CONFIG.update({...})` block in `house_config.py`
  (materials palette, layer definitions, floor heights) is hard-coded
  in `svg2d/config.ts` — if you change it in Python, update
  `config.ts` in lockstep.
