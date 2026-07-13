# archive/

Legacy scripts and companion docs kept for reference only.

- `render_with_blenderkit.py`, `render_with_procedural.py`, `render_with_textures.py`, `render_all_perspectives_with_textures.py`, `render_final_textures.py`, `render_realistic_perspectives.py`, `build_and_render_realistic.py` — one-off Blender rendering experiments that layered materials/textures onto the procedurally-built model.
- `apply_realistic_materials.py`, `apply_materials.sh` — pair for applying a fixed material scheme to `house-model.blend`. Paths inside the script are still relative to the repo root; move them back up if you want to re-run.
- `BLENDERKIT_INSTRUCTIONS.md`, `TEXTURE_DOWNLOAD_INSTRUCTIONS.md` — companion notes to the above.
- `test_crop_debug.py`, `test_texture_scale.py` — ad-hoc debug scripts.
- `konkan_house_lib_old.py` — the pre-refactor monolithic library. Superseded by `blender_3d.py`, `svg_2d.py` and the thin `konkan_house_lib.py` facade.

None of these are on the active build/render path. Do not import from `archive/`.
