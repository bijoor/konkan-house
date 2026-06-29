#!/bin/bash
# Regenerate Blender renders: realistic perspective PNGs + auto-crop.
# Requires Blender installed at /Applications/Blender.app and python3 + Pillow
# for the cropping step.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
BLEND_FILE="$SCRIPT_DIR/house-model.blend"

if [ ! -f "$BLENDER" ]; then
    echo "Error: Blender not found at $BLENDER"
    exit 1
fi

if [ ! -f "$BLEND_FILE" ]; then
    echo "Error: Blend file not found at $BLEND_FILE"
    exit 1
fi

echo "=========================================="
echo "Regenerating Blender renders + interactive 3D"
echo "=========================================="

echo ""
echo "[1/3] Rendering realistic perspectives (Blender headless)..."
"$BLENDER" --background "$BLEND_FILE" --python "$SCRIPT_DIR/render_all_final.py"

echo ""
echo "[2/3] Auto-cropping rendered perspectives..."
python3 "$SCRIPT_DIR/auto_crop_perspectives.py"

echo ""
echo "[3/3] Generating interactive 3D models (normal + exploded GLB)..."
python3 "$SCRIPT_DIR/generate_3d_models.py"

echo ""
echo "=========================================="
echo "Done."
echo "  PNGs:  docs/realistic_perspectives/"
echo "  GLBs:  docs/konkan_house.glb, docs/konkan_house_exploded.glb"
echo "=========================================="
