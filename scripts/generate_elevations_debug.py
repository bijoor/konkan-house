#!/usr/bin/env python3
"""
Standalone script to generate elevation views with debug output
Does not require Blender/bpy
"""
import os, sys
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(_PROJECT_ROOT)
sys.path.insert(0, os.path.join(_PROJECT_ROOT, "python"))

# Import only non-Blender modules
from config import GLOBAL_CONFIG
from svg_2d import generate_all_elevations

# Configure
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

# Load HOUSE_CONFIG from house_config.py (which itself reads
# house_config.json). We strip the Blender-only konkan_house_lib
# import, inject __file__ so the JSON loader resolves, then exec.
_HC_PATH = os.path.join(_PROJECT_ROOT, 'python', 'house_config.py')
with open(_HC_PATH, 'r') as f:
    config_code = f.read().replace(
        'from konkan_house_lib import GLOBAL_CONFIG',
        '# GLOBAL_CONFIG imported separately',
    )
_ns = {'GLOBAL_CONFIG': GLOBAL_CONFIG, '__file__': _HC_PATH}
exec(config_code, _ns)
HOUSE_CONFIG = _ns['HOUSE_CONFIG']

# Rename to house_config for compatibility
house_config = HOUSE_CONFIG

print("Generating elevations with debug output...")
print(f"House has {len(house_config['floors'])} floors")

generate_all_elevations(house_config, output_dir='docs')

print("\n✓ Done! Check docs folder for:")
print("  - elevation_*.svg files")
print("  - walls_debug_*.json files")
