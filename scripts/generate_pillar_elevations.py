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
generate_all_pillar_elevations(house_config, output_dir='docs')

print("\n✓ Done! Check docs folder for pillar_elevation_*.svg files")
