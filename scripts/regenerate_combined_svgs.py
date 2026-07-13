#!/usr/bin/env python3
"""
Regenerate SVGs from the Python reference implementation.

This is the parity reference — it feeds the editor's parity harnesses
(`npm run parity-all`) which byte-diff the TypeScript output against
what this script writes.

Since refactor phase R3 the outputs land in per-type subfolders under
`docs/`:
    docs/2d/floor_plans/    — floor_plan_*.svg + floor_plans_combined.svg
    docs/2d/elevations/     — elevation_*.svg + elevations_combined.svg
    docs/2d/roof/           — roof_*.svg + roof_panels.json

Run this any time you change house_config.json and want to regenerate
the reference for parity checks.
"""
import os
import sys
import pathlib
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_PYTHON_DIR = os.path.join(_PROJECT_ROOT, "python")
sys.path.insert(0, _PYTHON_DIR)
os.chdir(_PROJECT_ROOT)  # so svg_2d writes into docs/ relative to root

from config import GLOBAL_CONFIG

# Read and execute house_config.py without importing konkan_house_lib (which needs Blender)
with open(os.path.join(_PYTHON_DIR, 'house_config.py'), 'r') as f:
    config_code = f.read()

# Remove the Blender-dependent import
config_code = config_code.replace(
    'from konkan_house_lib import GLOBAL_CONFIG',
    '# GLOBAL_CONFIG imported separately'
)

# Execute config in a namespace. `__file__` is injected so
# house_config.py's JSON loader can resolve the config path under exec.
namespace = {
    'GLOBAL_CONFIG': GLOBAL_CONFIG,
    '__file__': str(pathlib.Path(_PYTHON_DIR) / 'house_config.py'),
}
exec(config_code, namespace)

# Import SVG functions (no Blender dependency)
from svg_2d import (
    generate_combined_floor_plans, generate_combined_elevations,
    generate_roof_sections_svg,
    generate_all_floor_plans, generate_all_elevations,
)

HOUSE_CONFIG = namespace['HOUSE_CONFIG']

# Per-type output subdirs under docs/
DOCS = pathlib.Path(_PROJECT_ROOT) / 'docs'
FLOOR_PLANS_DIR = str(DOCS / '2d' / 'floor_plans')
ELEVATIONS_DIR = str(DOCS / '2d' / 'elevations')
ROOF_DIR = str(DOCS / '2d' / 'roof')
os.makedirs(FLOOR_PLANS_DIR, exist_ok=True)
os.makedirs(ELEVATIONS_DIR, exist_ok=True)
os.makedirs(ROOF_DIR, exist_ok=True)

if __name__ == "__main__":
    print("\n" + "="*70)
    print("Regenerating SVGs (Python reference)")
    print("="*70)

    print("\n1. Combined floor plans...")
    generate_combined_floor_plans(HOUSE_CONFIG, output_dir=FLOOR_PLANS_DIR)

    print("\n2. Combined elevations...")
    generate_combined_elevations(HOUSE_CONFIG, output_dir=ELEVATIONS_DIR)

    print("\n3. Roof sections...")
    generate_roof_sections_svg(HOUSE_CONFIG, output_dir=ROOF_DIR)

    print("\n4. Individual floor plan SVGs (per floor)...")
    generate_all_floor_plans(HOUSE_CONFIG, output_dir=FLOOR_PLANS_DIR)

    print("\n5. Individual elevation SVGs (front/back/left/right)...")
    generate_all_elevations(HOUSE_CONFIG, output_dir=ELEVATIONS_DIR)

    print("\n" + "="*70)
    print("✓ Done!")
    print("="*70)
