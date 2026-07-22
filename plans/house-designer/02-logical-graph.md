# Stage 2 — general topology + the BOT logical graph

Two things, decided together because they share the topology vocabulary:
1. **Generalize archetype topology** from Konkan's `spine + hub` to a neutral
   **zones + adjacency-rules** model, so modern (zoned, non-linear) archetypes fit.
2. **Stage-2 `graph`** command: program → a BOT-style logical graph the grid stage
   lays out.

## A. Generalized archetype topology (replaces spine/hub/adjacency)

An archetype now declares a `topology` block:

```jsonc
"topology": {
  "hub": "central_hall",              // primary circulation space (role); "" if none
  "sequence": ["entry","front_court","front_verandah","central_hall","rear_verandah","back_yard"],
                                      // ordered adjacency chain (Konkan spine); [] for zoned models
  "zones": [                          // functional groupings (public/private/service …)
    { "id": "core",    "label": "Living core", "categories": ["living_core","circulation","ritual"] },
    { "id": "private", "label": "Private",      "categories": ["private","wet"] },
    { "id": "service", "label": "Service",      "categories": ["service","storage","utility"] }
  ],
  "adjacencies": [                    // explicit canonical pairs
    { "a": "central_hall", "b": "kitchen", "interface": "door" },
    { "a": "kitchen", "b": "store", "interface": "door" }
  ]
}
```

- **Konkan** = a non-empty `sequence` (the spine) + `hub` + a few `adjacencies`.
- **Modern** = **empty `sequence`**, a `hub` (foyer/living), zones that cluster
  public/private/service, and `adjacencies` connecting the clusters. No spine.

Zones map to space instances by **category** (or an explicit `spaces` list); the
transform stamps each instance with its `zone`. Zones drive grid clustering (stage
3) and appear as `Zone` nodes in the graph.

**Structural relations stay program-driven** (archetype-independent): a bedroom
branches off the hub; an ensuite is accessed only from its bedroom; a shared bath
off the hub; upper wet stacks over ground wet; a ritual object sits inside its
container; the staircase attaches to the hub. The archetype `topology` only adds
the fixed skeleton (`sequence`, `adjacencies`) + the `hub` identity + `zones`.

## B. The BOT graph (stage-2 artifact)

High-level [BOT](https://w3id.org/bot) shape: **Zones** (Building ▸ Storey ▸ Space,
plus functional Zones) and **adjacency/interface** edges. Nodes + edges:

```jsonc
{
  "archetype": "konkan",
  "nodes": [
    { "id": "building", "type": "Building" },
    { "id": "ground",   "type": "Storey", "level": 0, "label": "Ground Floor" },
    { "id": "central_hall", "type": "Space",
      "space": { "type": "central_hall", "label": "Majghar", "category": "living_core",
                 "size": "xl", "wet": false, "zone": "core", "storey": "ground" } },
    { "id": "z_private", "type": "Zone", "label": "Private" }
  ],
  "edges": [
    { "rel": "hasStorey", "from": "building", "to": "ground" },      // bot:hasStorey
    { "rel": "hasSpace",  "from": "ground", "to": "central_hall" }, // bot:hasSpace
    { "rel": "adjacent",  "from": "front_verandah", "to": "central_hall", "interface": "open" }, // bot:adjacentZone + bot:Interface
    { "rel": "access",    "from": "bedroom_1", "to": "ensuite_1" },
    { "rel": "contains",  "from": "front_court", "to": "tulsi" },   // bot:containsZone
    { "rel": "stacked",   "from": "bath_1", "to": "ensuite_2" },
    { "rel": "inZone",    "from": "central_hall", "to": "z_private" }
  ]
}
```

Program relations map to edges:
`spine|branch|adjacent → adjacent` (keep the interface), `access → access`,
`contains → contains`, `stacked → stacked`. Plus `hasStorey`/`hasSpace` hierarchy
from storeys, and `Zone` nodes + `inZone` edges from the archetype zones.

`access` and `stacked` are our design-semantic extensions on top of BOT's core
adjacency; the grid stage uses them (accessed-together spaces are placed touching;
stacked spaces share an X/Y across storeys).

## Build steps

1. Archetype schema → `topology` block (+ `zones`); re-express `konkan.json`;
   transform applies `topology.sequence`/`adjacencies`, stamps `zone` on instances.
   (Stage-1 tests stay green — same program, relations equivalent.)
2. `schema/graph.ts` + `stages/graph.ts` (program → graph) + `graph` CLI command
   + tests. Verify the Konkan graph.
3. THEN extend: modern spaces (catalog) + a `modern` archetype (empty sequence,
   zones) + authoring commands (`add-space`, `new-archetype`, `validate`).
