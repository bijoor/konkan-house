# 06 — Template-library layouts (curated, parametric, switch-off)

Status: **design + proof**. Supersedes the algorithmic layout as the PRIMARY path
(the slicing engine from [[04-graph-driven-layout]] stays as a fallback). Decided
with the user 2026-07-21.

## Why

Algorithmic layout (slicing search) is unreliable — it produces valid but
impractical plans (oversized hub, room strips). Quality can't come from a general
generator at this stage; it has to come from **curation**. So the layout stage
flips from *generate* to *retrieve*:

> Match the graph to a library of **hand-designed, good-quality** plans, rather
> than inventing geometry.

## Key idea — a template is a parametric `.wadi` with switch-off rooms

A template is NOT a static plan. It's a **maximum-configuration `.wadi`** — a
complete, well-proportioned, hand-designed house holding the MOST rooms it can (e.g.
Konkan with 4 bedrooms + pooja + study + 2 verandahs) — authored parametrically so
that **switching a room off collapses its space and the rest of the house re-fits**,
purely through the formula engine we already built (variables / points / formulas,
[[project_object_relationships_plan]]).

Mechanism (no new engine, no editor change):
- The template's grid spacings are gated by toggle variables:
  `X3 = X2 + has_pooja * poojaW`. Setting `has_pooja = 0` collapses that bay.
- To switch a room off: set its toggle to 0 **and remove the room object**. The
  cumulative grid formulas shift every downstream line; neighbours slide over; the
  house shrinks. The editor's resolver does this live.

So the human author owns quality (layout + proportions + how it degrades as rooms
drop); the system just sets toggles and drops objects.

## Pipeline

```
graph → matchTemplate → configure(toggles + role bindings) → .wadi
            └─ no match ─→ (fallback) algorithmic layout → sizing → grid → emit
```

The template already IS a `.wadi`, so a matched program skips layout/sizing/grid/emit
entirely — it configures a finished parametric house.

## Pieces to build

1. **Template schema + library** (`data/templates/*.wadi` + a sidecar map). A
   template bundles the parametric `.wadi` (`config`) with:
   - `roles`: `objectName → role` (catalog space id or category) — which slot is what.
   - `toggles`: `role/object → toggle variable` — how to switch each optional room off.
   - `archetype`, `id`, `label`, capacity per role (e.g. bedroom ≤ 4).

2. **capture-template** (authoring, user's choice): read a good `.wadi` (the
   reference house, a curated example, or anything designed in the Wadi editor) + a
   small roles/toggles mapping → a library template. Library grows from REAL,
   approved designs, authored in the tool best at it. The toggle FORMULAS are
   authored in the `.wadi` itself (in the editor).

3. **matcher**: graph → best template. Assign the program's rooms to template slots
   by role/category; a template fits if it covers the required rooms (respecting
   capacities) and its geometry satisfies the required adjacencies. Rank by fit
   (room-count match, adjacencies met, fewest empty slots). Compute the toggle
   settings + role→instance bindings.

4. **configure** (`stages/configure.ts`): template + {toggle values, rooms to
   remove, role→label bindings} → a concrete `.wadi`. Sets toggle variables, drops
   switched-off room objects, relabels role rooms with the program's instances,
   optionally overrides sizes. The formula engine re-fits.

5. **Real floor-plan rendering** in the picker (the user's second ask): since every
   candidate resolves to a `.wadi`, render the ACTUAL plan (via the editor's
   renderer, shelled out like `validate.mjs`) and show real plans in the layout
   picker — not abstract lattices. Also `render --in house.wadi` → a plan page.

## Proof (this increment)

`data/templates/konkan-row-demo.wadi` — a tiny hand-authored toggleable template:
Hall · Bedroom · Pooja(toggle) · Kitchen · Study(toggle) in a row, grid gated by
`has_pooja` / `has_study`. Switching pooja+study off (set vars 0, remove the two
rooms) must re-flow: Kitchen slides left, the house narrows by exactly their bays,
walls stay single. Verified through the editor's real `resolveParametric` + render.

## Notes / tradeoffs

- **Coverage** is limited to the library; the algorithmic engine (04) is the
  fallback so nothing ever fails to produce a house.
- **Authoring craft**: a template must be authored so it degrades gracefully as
  rooms drop (good toggle formulas). That's the human's job; an editor `enabled`
  toggle per object (preview with/without a room) would help authoring — optional,
  later. The pipeline itself needs no editor change (configure removes objects).
- **Variability lives in the `.wadi`**, per the user: one max-config template flexes
  across many programs via toggles + formulas, instead of many fixed templates.
