#!/usr/bin/env python3
"""
Standalone script to generate the four pillar/slab structural elevation SVGs
(front, back, left, right). Does not require Blender/bpy.
"""
import os, sys
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(_PROJECT_ROOT)
sys.path.insert(0, os.path.join(_PROJECT_ROOT, "python"))

from config import GLOBAL_CONFIG
from svg_2d import generate_all_pillar_elevations

GLOBAL_CONFIG.update({
    'units_to_meters_ratio': 0.1,
    'scale_factor': 1.0,
    'ground_level_z': 0.0,
    'floor_heights': {
        0: 100.0,
        1: 100.0,
        2: 42.0,
        3: 50.0,
    },
    'wall_thickness': 8,
    'floor_slab_thickness': 8,
    'plinth_height': 30,
})

# Load HOUSE_CONFIG via exec of house_config.py (which itself reads
# house_config.json). Strip the Blender-only konkan_house_lib import
# and inject __file__ so the JSON loader resolves.
_HC_PATH = os.path.join(_PROJECT_ROOT, 'python', 'house_config.py')
with open(_HC_PATH, 'r') as f:
    config_code = f.read().replace(
        'from konkan_house_lib import GLOBAL_CONFIG',
        '# GLOBAL_CONFIG imported separately',
    )
_ns = {'GLOBAL_CONFIG': GLOBAL_CONFIG, '__file__': _HC_PATH}
exec(config_code, _ns)
house_config = _ns['HOUSE_CONFIG']

print("Generating pillar elevations...")

# The Python generator emits every file into a single directory. Since
# the docs reorg split them across docs/2d/{pillar_elevations,pillar_sections}/,
# we render into a scratch dir and then move each file to its final spot.
import tempfile, shutil

with tempfile.TemporaryDirectory() as tmp:
    generate_all_pillar_elevations(house_config, output_dir=tmp)

    elevations_dir = os.path.join(_PROJECT_ROOT, 'docs', '2d', 'pillar_elevations')
    sections_dir = os.path.join(_PROJECT_ROOT, 'docs', '2d', 'pillar_sections')
    os.makedirs(elevations_dir, exist_ok=True)
    os.makedirs(sections_dir, exist_ok=True)

    for name in os.listdir(tmp):
        src = os.path.join(tmp, name)
        if name.startswith('pillar_elevation_'):
            shutil.move(src, os.path.join(elevations_dir, name))
        elif name.startswith('pillar_section_'):
            shutil.move(src, os.path.join(sections_dir, name))

print("\n✓ Done! Files written to docs/2d/{pillar_elevations,pillar_sections}/")
