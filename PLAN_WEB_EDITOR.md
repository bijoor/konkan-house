# Plan: Standalone Web Editor for house_config

**Status**: All 6 phases complete (Phases 0–6 shipped 2026-07-11 → 2026-07-12)
**Stack**: React 19 + TypeScript + Vite 8 + React Three Fiber (R3F) + drei + Zod 4 + Tailwind 4 + zundo + three-bvh-csg + @react-three/postprocessing
**Deployment**: Static site published to `docs/editor/` (same GitHub Pages site as the model viewer)
**Verification**: 42/42 parity checks pass (34 primitive + 3 floor plan + 5 elevation SVGs byte-identical to Python)

## Architecture

```
┌───────────────────────────────────────┐        ┌───────────────────────────┐
│  Browser editor (React + R3F + drei)  │        │  Existing Python pipeline │
│  ─────────────────────────────────────│        │  ─────────────────────────│
│  • Form-based schema editor           │        │  house_config.py          │
│  • Live SVG preview (ported svg_2d)   │  JSON  │    ↓ (reads)              │
│  • Live 3D preview (R3F + drei)       │◄──────►│  house_config.json        │
│  • Validation via JSON Schema/Zod     │download│    ↓ (feeds)              │
│  • Import + Download buttons          │import  │  Blender build → GLB/SVG  │
└───────────────────────────────────────┘        └───────────────────────────┘
```

- Editor is a **standalone SPA**. No backend, no auth, no CI dependency.
- User workflow: edit in browser → **Download JSON** → drop file into repo → run existing Blender pipeline.
- Round-trip: click **Load JSON** to reopen a saved config.
- `house_config.json` is the source of truth; `house_config.py` is a thin loader.

## Key decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | **React 18 + TypeScript** | Largest ecosystem, best form/UI primitives (Radix, RHF), R3F+drei is the most mature Three.js binding. |
| Config source of truth | **JSON** (`house_config.json`) | Single source, no drift. Python becomes a ~15-line loader. |
| Render trigger | **Manual local via file exchange** | Editor exports JSON; user runs Blender locally. Zero infrastructure. |
| State management | Zustand (+ zundo for undo/redo) | Simplest fit for this shape. |
| CSS | Tailwind | Fastest for a solo project. |
| Forms | react-hook-form + Zod | RHF has biggest ecosystem; Zod schema is derivable from JSON Schema. |
| 3D binding | @react-three/fiber + @react-three/drei | Best-in-class helpers (OrbitControls, Environment, useGLTF). |

## Phase 0 — Extract JSON as source of truth (Python side) · ~2 days

**Goal**: `house_config.py` becomes a thin loader; `house_config.json` becomes canonical.

- [ ] Snapshot current SVG output for verification baseline
- [ ] Extract `HOUSE_CONFIG` dict → `house_config.json` (preserve int vs. float types)
- [ ] Rewrite `house_config.py` as a ~15-line loader that reads the JSON
- [ ] Verify Blender build + SVG regen byte-identical against snapshot
- [ ] Author JSON Schema at `schema/house_config.schema.json` covering all object types (`floor_slab`, `pillar`, `room` with nested-walls form, `wall` with `openings`, `beam`, `staircase`, `door`, `window`, `hip_roof`, `gable_roof`, `fink` truss)

## Phase 1 — Editor scaffolding · ~3 days

- Bootstrap `editor/` at repo root: Vite + React 18 + TypeScript + Tailwind
- Deps: `react`, `zustand`, `zod`, `react-hook-form`, `@radix-ui/*`, `@react-three/fiber`, `@react-three/drei`
- File I/O: `<input type=file>` for import, `URL.createObjectURL()` for download
- Vite output to `docs/editor/` with `base: './'`
- UI shell: left sidebar (floor tabs + object tree), center preview, right property panel, top bar with **Load JSON** / **Download JSON** / **Validate**

## Phase 2 — SVG live preview (port `svg_2d.py`) · ~1 week

- Port `svg_2d.py` + `house_expand.py` to TypeScript under `editor/src/svg2d/`
- Verify byte-identical output vs. Python for all 8 SVGs
- Live SVG preview tab; per-file export buttons

## Phase 3 — 3D live preview (R3F + drei) · ~1 week

- `<Canvas>` with `<OrbitControls>`, directional + ambient lights, `<Environment preset="sunset">`
- Box geometry per object type (`RoomBox`, `WallBox`, `PillarBox`, `BeamBox`, `FloorSlabBox`)
- Openings as face-textured rects (no CSG yet)
- Simplified hip roof mesh
- Camera preset buttons (front/back/left/right/iso/top)
- Layer toggles driven by JSON `layers` config
- GLB loader for "high-quality Blender output" alternative view (`useGLTF`)

## Phase 4 — Form-based schema editor · ~1 week

- Object-type-specific editors: Room (with nested per-side walls editor), Wall (standalone), Opening (door/window), Pillar, Beam, Roof
- Undo/redo via `zundo`
- Copy/paste/duplicate objects
- Inline validation errors; Download button disabled if config invalid

## Phase 5 — Progressive rendering enhancements · ongoing

Ranked by likely value:

1. Real openings via CSG (`three-bvh-csg`) — cached per-wall
2. Roof frame rendering (trusses, rafters, purlins as line/box geometry)
3. Materials preset selector (flat / concrete / plaster / laterite PBR palettes)
4. Post-processing (`@react-three/postprocessing` — SSAO, bloom, tone mapping)
5. HDR environment upgrades with time-of-day slider
6. Section cutter (slice model at any horizontal/vertical plane)
7. Measurement tool
8. Multi-config side-by-side comparison

## Phase 6 — Publish · ~1 day

- `npm run build` → `docs/editor/`
- Cross-link from `docs/index.html`
- README: document the "edit → download → drop into repo → run Blender" workflow

## Timeline

| Phase | Work | Duration | Cumulative |
|---|---|---|---|
| 0 | JSON extraction + Python loader | 2 d | 2 d |
| 1 | Editor scaffolding + load/save | 3 d | 1 wk |
| 2 | SVG port + live preview | 1 wk | 2 wk |
| 3 | 3D live preview | 1 wk | 3 wk |
| 4 | Form-based editor | 1 wk | 4 wk |
| 5 | Progressive enhancements | ongoing | — |
| 6 | Publish | 1 d | ~4½ wk |

**Total to fully-usable editor: ~4-5 weeks of focused work.** Each phase is independently shippable.
