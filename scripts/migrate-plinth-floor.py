#!/usr/bin/env python3
"""Migrate a house config from a top-level `plinth` to a Plinth floor.

Transforms (in place):
  - prepend floor 0 "Plinth" (height = old plinth height) holding a `ground`
    object (from site plot) + a `plinth` object (from the old top-level plinth,
    carrying its formulas/enabled),
  - renumber existing floors +1,
  - delete the top-level `plinth`.

Idempotent: files with no top-level `plinth` are skipped. JSON + .wadi (JSON).
"""
import json
import sys
from collections import OrderedDict


def migrate(cfg: dict) -> bool:
    if "plinth" not in cfg:
        return False  # already migrated / nothing to do

    plinth = cfg.pop("plinth")
    site = cfg.get("site", {})
    plot_w = site.get("plot_width", plinth.get("width", 270))
    plot_l = site.get("plot_length", plinth.get("length", 450))

    ground = OrderedDict(
        type="ground", name="Ground", layer="ground",
        x=0, y=0, width=plot_w, length=plot_l,
    )

    plinth_obj = OrderedDict(type="plinth", name="Plinth", layer="plinth")
    for k in ("x", "y", "width", "length", "height"):
        plinth_obj[k] = plinth.get(k, 0)
    # Preserve parametric drivers on the plinth object itself.
    if "formulas" in plinth:
        plinth_obj["formulas"] = plinth["formulas"]
    if "enabled" in plinth:
        plinth_obj["enabled"] = plinth["enabled"]

    plinth_floor = OrderedDict(
        floor_number=0, name="Plinth", height=plinth.get("height", 30),
    )
    # If the plinth height was a formula, drive the floor height with it too.
    ph_formula = (plinth.get("formulas") or {}).get("height")
    if ph_formula:
        plinth_floor["formulas"] = {"height": ph_formula}
    plinth_floor["objects"] = [ground, plinth_obj]

    floors = cfg.get("floors", [])
    for i, f in enumerate(floors):
        f["floor_number"] = (f.get("floor_number", i) or 0) + 1
    cfg["floors"] = [plinth_floor] + floors
    return True


def main(paths):
    changed = 0
    for p in paths:
        with open(p, "r") as fh:
            cfg = json.load(fh, object_pairs_hook=OrderedDict)
        if migrate(cfg):
            with open(p, "w") as fh:
                json.dump(cfg, fh, indent=2)
                fh.write("\n")
            print(f"migrated {p}")
            changed += 1
        else:
            print(f"skip (no top-level plinth) {p}")
    print(f"\n{changed}/{len(paths)} migrated")


if __name__ == "__main__":
    main(sys.argv[1:])
