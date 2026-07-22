# Stage 1 — Options structure (what we can support)

The vocabulary + choices the AI works with. Three parts:
- **A. Space catalog** — the atomic spaces (the nouns). Konkan-traditional (from
  the reference plan) + modern.
- **B. Program options** — the choices the AI elicits from the user (the knobs).
- **C. Composition rules** — how choices instantiate / merge / relate spaces.

Everything downstream (graph, grid, parametric) is derived from an
**instantiated program** = the set of space instances + relations produced by
applying the user's option values to this structure.

Design note: this is authored to be **machine-readable** (an AI consumes it) and
human-fine-tunable. Shown here as tables/pseudo-JSON; the built form is a JSON/TS
data file.

---

> **Neutral-catalog note (decided):** the catalog is **generic** — space `id`s are
> neutral (`central_hall`, not `majghar`). The `konkan` column below is the
> **alias/label applied by the Konkan archetype** (§E), not part of the base type.
> Other archetypes reuse the same generic types with their own labels/defaults.
> The built data file uses generic ids; the tables here keep the Konkan names for
> readability against the reference plan.

## A. Space catalog

Attributes per space type:
- `id` — canonical key. `label` — display. `konkan` — traditional name / plan #.
- `category` — grouping (below).
- `enclosure` — `enclosed` | `semi_open` (roofed, open-sided: verandahs) | `open`
  (unroofed: yards).
- `wet` — needs plumbing/drainage (kitchen, baths, utility).
- `floor` — `ground` | `upper` | `attic` | `any` | `yard` (site, outside footprint).
- `size` — relative size class (see §D). Drives grid control-variable defaults.
- `mult` — multiplicity: `1` | `0..1` | `1..n` | `0..n`.
- `default` — in the **Konkan archetype** by default? (✓ / ✕ / opt).

### Traditional Konkan (numbers = reference plan legend)

| id | label | konkan | category | enclosure | wet | floor | size | mult | default |
|----|-------|--------|----------|-----------|-----|-------|------|------|---------|
| `house_entry` | House entry | 1 | circulation | open | – | ground | xs | 1 | ✓ |
| `angan` | Front courtyard | 2 Angan | outdoor | open | – | yard(front) | l | 0..1 | ✓ |
| `tulsi` | Tulsi Vrindavan | 3 | ritual-object | open | – | yard(in angan) | xs | 0..1 | ✓ |
| `otti` | Front verandah | 4 Otti | threshold | semi_open | – | ground | m | 0..1 | ✓ |
| `majghar` | Central hall | 5 Majghar | living-core | enclosed | – | ground | xl | 1 | ✓ |
| `mala` | Attic / loft | 5A Mala | storage-loft | enclosed | – | attic | l | 0..1 | ✓ |
| `dev_ghar` | Pooja room | 6 Dev Ghar | ritual | enclosed | – | ground | s | 0..1 | ✓ |
| `private_room` | Bedroom | 7 | private | enclosed | – | any | m/l | 1..n | ✓ |
| `kitchen` | Kitchen | 8 | service | enclosed | wet | ground | m | 1 | ✓ |
| `store_room` | Store (Kothar) | 9 | storage | enclosed | – | ground | s | 0..1 | ✓ |
| `padvi` | Rear verandah | 10 Padvi | threshold | semi_open | – | ground | s | 0..1 | ✓ |
| `washroom` | Bath / toilet | 11 | wet | enclosed | wet | any | xs | 1..n | ✓ |
| `paras` | Backyard | 12 Paras | outdoor | open | – | yard(rear) | l | 0..1 | ✓ |
| `shed` | Storage shed | 13 | storage | semi_open | – | yard | s | 0..1 | opt |
| `well` | Water well | 14 | utility | open | (water) | yard | xs | 0..1 | opt |

### Modern additions

| id | label | category | enclosure | wet | floor | size | mult | default |
|----|-------|----------|-----------|-----|-------|------|------|---------|
| `living_room` | Living room | living-core | enclosed | – | ground | l | 0..1 | ✕ |
| `dining` | Dining | living-core | enclosed | – | ground | m | 0..1 | ✕ |
| `garage` | Garage / car porch | vehicle | enclosed/semi | – | ground | l | 0..1 | ✕ |
| `staircase` | Staircase | circulation | enclosed | – | vertical | s | 0..n | auto |
| `balcony` | Balcony | threshold | semi_open | – | upper | s | 0..n | ✕ |
| `utility` | Utility / washing | service | semi_open | wet | ground | xs | 0..1 | ✕ |
| `attached_bath` | Ensuite bath | wet | enclosed | wet | any | xs | 0..n | ✕ |

**Categories** (for rules/grouping): `circulation, outdoor, threshold, living-core,
private, ritual, ritual-object, service, wet, storage, storage-loft, vehicle,
utility, structure`.

Key semantics worth pinning:
- **Konkan spine** — the traditional front→back circulation axis:
  `house_entry → angan → otti → majghar → padvi → paras`. `majghar` is the hub;
  private rooms, kitchen, dev_ghar branch off it.
- **thresholds** (otti/padvi/balcony) are roofed but open-sided — they mediate
  indoor↔outdoor and read as depth-shallow, width-wide strips.
- **mala** is the loft in the pitched-roof volume above majghar (see the section
  in the reference image), reached by a ladder/stair.

---

## B. Program options (the choices)

Grouped. Each option: `key`, `type`, `default`, and what it drives. `enum`/`int`/
`bool`. The AI elicits these in an interview (extending `wadi-config`'s
design-brief step), honoring the constraints in §C.

### B1 · Scale & massing
| key | type | default | notes |
|-----|------|---------|-------|
| `floors` | 1 \| 2 | 1 | ground only, or ground+first |
| `mala` | bool | true | attic loft in the roof volume |
| `roof` | konkan_hip \| konkan_gable \| flat | konkan_hip | pitched = enables mala |
| `plinth` | none \| low \| raised | raised | traditional raised base |

### B2 · Bedrooms (`private_room`)
| key | type | default | notes |
|-----|------|---------|-------|
| `bedroom_count` | 1..4 | 2 | |
| `bedrooms[]` | per-room object | – | one entry per bedroom |
| &nbsp;&nbsp;`.size` | standard \| master | standard | master ⇒ size class L |
| &nbsp;&nbsp;`.attached_bath` | bool | false | ensuite, accessed only from this room |
| &nbsp;&nbsp;`.floor` | ground \| upper | ground | upper needs `floors:2` |

### B3 · Social core (living / dining / kitchen)
One `core_style` picks the arrangement; it resolves which of
{majghar, living_room, dining, kitchen} instantiate and what merges.
| value | meaning |
|-------|---------|
| `traditional_majghar` (default) | central hall is the hub; kitchen separate; dining happens in majghar/kitchen (no separate dining) |
| `modern_separate` | living_room + dining + kitchen as three separate rooms (majghar optional) |
| `open_ldk` | living + dining + kitchen merged into one open space |
| `living_dining` | living+dining merged; kitchen separate |
| `dining_kitchen` | dining+kitchen merged (eat-in kitchen); living/majghar separate |

| key | type | default | notes |
|-----|------|---------|-------|
| `core_style` | enum above | traditional_majghar | |
| `keep_majghar` | bool | true | keep a central hall even in a modern style |

### B4 · Ritual & traditional
| key | type | default |
|-----|------|---------|
| `dev_ghar` | bool | true |
| `otti` (front verandah) | bool | true |
| `angan` (front court) | bool | true |
| `tulsi` | bool | = angan |
| `padvi` (rear verandah) | bool | true |

### B5 · Service & storage
| key | type | default | notes |
|-----|------|---------|-------|
| `store_room` | bool | true | |
| `shared_bath_count` | 0..n | 1 | common baths beyond ensuites |
| `toilet_style` | indian \| western \| both | western | affects bath fixture/size |
| `utility` | bool | false | washing area (often off padvi) |
| `shed` | bool | false | in the yard |
| `well` | bool | false | in the yard |

### B6 · Modern
| key | type | default | notes |
|-----|------|---------|-------|
| `garage` | none \| car_porch \| enclosed | none | |
| `car_count` | 1..2 | 1 | if garage ≠ none |
| `balcony_count` | 0..n | 0 | upper floors |

### B7 · Site & fit (the parametric knobs)
| key | type | default | notes |
|-----|------|---------|-------|
| `plot` | {length, width} | – | project units (10 = 1 ft) |
| `orientation` | N \| E \| S \| W | – | entry/front direction |
| `setback_front` | size | angan depth | front yard (angan) |
| `setback_rear` | size | paras depth | back yard (paras) |
| `setback_side` | size | small | |

`plot`, `plinth`, and the per-space size classes become the **control variables**
in stages 4–5. Changing them re-fits the whole house.

---

## C. Composition rules

How option values become an **instantiated program** (space instances + relations).
These are the deterministic transforms the tool applies.

1. **Core resolution** — `core_style` decides instances + merges:
   - `traditional_majghar` → `majghar`(1) + `kitchen`(1); no `dining`/`living_room`.
   - `modern_separate` → `living_room` + `dining` + `kitchen`; `majghar` iff `keep_majghar`.
   - `open_ldk` → one merged instance `ldk` (enclosure enclosed, size = Σ of L+D+K).
   - `living_dining` → merged `living_dining` + separate `kitchen`.
   - `dining_kitchen` → merged `kitchen_dining` + separate `living_room`/`majghar`.
2. **Bedrooms** — instantiate `private_room × bedroom_count`; per-room `size`
   (master ⇒ L). `attached_bath:true` → create a `washroom` (an `attached_bath`
   instance) whose **only** access interface is that bedroom.
3. **Shared baths** — `washroom × shared_bath_count`, accessed from circulation
   (majghar / passage), not from a bedroom.
4. **Vertical (bedroom floor over ground)** — `floors:2` ⇒ auto-add `staircase`(1)
   (off the hall/rear-verandah) and a first `Storey`. The upper floor is a
   **simpler bedroom/bath floor stacked over the ground plan** — any
   `bedrooms[].floor:upper` + their ensuites live there; the hall-hub stays
   single-storey (double-height below the roof). **Wet spaces on the upper floor
   are placed over ground-floor wet spaces** (baths/kitchen) so plumbing stacks.
   `mala:true` + pitched roof ⇒ add `attic` (Mala) in the roof volume above the
   hall (ladder/stair access), distinct from a full first storey.
5. **Konkan spine** — when traditional options are on, order the front→back axis
   `house_entry → angan → otti → majghar → padvi → paras`; branch private_rooms,
   kitchen, dev_ghar, store off majghar. This becomes the graph's primary path.
6. **Yard spaces** — `angan`/`paras` sized from `setback_front`/`setback_rear`;
   `tulsi` placed in `angan`; `well`/`shed` placed in a yard.
7. **Garage** — placed at the front (off angan / street side); `enclosed` = walled,
   `car_porch` = semi_open.

**Constraints (validation)** the AI must respect when eliciting:
- `attached_bath` requires its bedroom. `bedrooms[].floor:upper` requires `floors:2`.
- `mala` requires a pitched `roof`. `balcony_count>0` requires `floors:2`.
- `tulsi`/`well`/`shed` require a yard (`angan`/`paras`) or free plot area.
- At least one of {`majghar`, `living_room`, `ldk`} must exist (a social core).
- Wet spaces (kitchen, baths, utility) should be groupable for a plumbing stack
  (soft rule → informs grid placement, stage 3).

---

## D. Size classes (relative → control-variable defaults)

Relative sizes feed the grid's default control-variable values (stage 4). Nominal
footprints in **feet** (become project units ×10); tunable per project.

| class | example spaces | nominal W×D (ft) |
|-------|----------------|------------------|
| `xl` | majghar / ldk | 16 × 16 |
| `l` | master bed, living_room, garage, mala | 12 × 14 |
| `m` | standard bed, kitchen, dining, otti | 10 × 12 |
| `s` | dev_ghar, store, padvi, staircase, shed | 8 × 8 |
| `xs` | bath / wc, tulsi, well, utility | 5 × 7 |

Thresholds (otti/padvi/balcony) are **depth-shallow**: width spans the adjacent
core, depth ≈ 5–7 ft regardless of class. Yards (angan/paras) are sized by
setback, not class.

---

## E. Archetypes (neutral catalog + presets)

An **archetype** is a named preset over the generic catalog. It supplies:
- **defaults** — starting values for the §B options (e.g. Konkan turns on
  otti/angan/dev_ghar/padvi/mala, raised plinth, pitched roof).
- **aliases** — display labels/names for generic space ids (Konkan: `central_hall`
  → "Majghar", `front_verandah` → "Otti", `front_court` → "Angan", `rear_verandah`
  → "Padvi", `back_yard` → "Paras", `pooja` → "Dev Ghar", `attic` → "Mala",
  `store` → "Kothar", `bedroom` → "Private Room").
- **spine + adjacency template** — the archetype's canonical topology (Konkan:
  `entry → front_court → front_verandah → central_hall → rear_verandah → back_yard`,
  hall-as-hub). Other archetypes define their own (a modern bungalow might use a
  foyer→living hub with no spine).
- **size-class tweaks** — optional per-archetype overrides of §D.

v1 ships the **`konkan`** archetype (the reference plan) fully; the structure
supports adding `modern_bungalow` etc. later without touching the catalog.

Generic-id ↔ Konkan-alias map (core ones):
`entry`, `front_court`(Angan), `tulsi`, `front_verandah`(Otti),
`central_hall`(Majghar), `attic`(Mala), `pooja`(Dev Ghar), `bedroom`(Private Room),
`kitchen`, `store`(Kothar), `rear_verandah`(Padvi), `bath`, `back_yard`(Paras),
`shed`, `well` + modern `living_room`, `dining`, `garage`, `staircase`, `balcony`,
`utility`, `ensuite`.

## Decisions (locked)

- **Full catalog** now. **Neutral catalog + archetypes** (Konkan is one archetype).
- **Multi-storey = bedroom floor over ground**: `floors:2` adds a stacked
  bedroom/bath storey over the ground plan; wet spaces stacked over ground wet
  spaces for plumbing; the hall-hub stays single-storey. Added to §C rule 4.
- **CLI app** delivery (see `../house-designer/05-app-architecture.md`).

## Still to settle

- **Size-class numbers** (§D) — sensible starting nominals? They set the default
  feel of every generated house; easy to tune later per archetype.
- Exact archetype **default option-values** for `konkan` (draft in the built data
  file; review then).
