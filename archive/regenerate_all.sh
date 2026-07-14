#!/bin/bash
# Regenerate all 2D SVG outputs (floor plans, elevations, combined views).
# Standalone — does NOT require Blender. For the 3D GLB, open
# konkan_house_config.py in Blender's Text Editor and press Alt+P.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Run generator scripts from repo root so relative `open('house_config.py')`
# resolves. Each `python3 script.py` below is invoked with $SCRIPT_DIR-relative
# path so we don't rely on cwd for locating the script itself.
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "Regenerating all 2D outputs"
echo "=========================================="

echo ""
echo "[1/3] Individual floor plans..."
python3 "$SCRIPT_DIR/generate_floor_plans.py"

echo ""
echo "[2/3] Individual elevations..."
python3 "$SCRIPT_DIR/generate_elevations_debug.py"

echo ""
echo "[3/3] Combined floor plans + elevations..."
python3 "$SCRIPT_DIR/regenerate_combined_svgs.py"

echo ""
echo "=========================================="
echo "Done. Outputs in docs/"
echo "=========================================="
