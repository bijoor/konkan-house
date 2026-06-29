#!/bin/bash
# Regenerate all 2D SVG outputs (floor plans, elevations, combined views).
# Standalone — does NOT require Blender. For the 3D GLB, open
# konkan_house_config.py in Blender's Text Editor and press Alt+P.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Regenerating all 2D outputs"
echo "=========================================="

echo ""
echo "[1/3] Individual floor plans..."
python3 generate_floor_plans.py

echo ""
echo "[2/3] Individual elevations..."
python3 generate_elevations_debug.py

echo ""
echo "[3/3] Combined floor plans + elevations..."
python3 regenerate_combined_svgs.py

echo ""
echo "=========================================="
echo "Done. Outputs in docs/"
echo "=========================================="
