#!/bin/bash
# Script to apply realistic materials to the house model in Blender

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Blender executable path (macOS)
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"

# Blend file
BLEND_FILE="$SCRIPT_DIR/house-model.blend"

# Python script to run
PYTHON_SCRIPT="$SCRIPT_DIR/apply_realistic_materials.py"

echo "=========================================="
echo "Applying Realistic Materials to House Model"
echo "=========================================="
echo ""
echo "Blend file: $BLEND_FILE"
echo "Script: $PYTHON_SCRIPT"
echo ""

# Check if Blender exists
if [ ! -f "$BLENDER" ]; then
    echo "Error: Blender not found at $BLENDER"
    echo "Please install Blender or update the path in this script"
    exit 1
fi

# Check if blend file exists
if [ ! -f "$BLEND_FILE" ]; then
    echo "Error: Blend file not found at $BLEND_FILE"
    exit 1
fi

# Run Blender with the script
"$BLENDER" "$BLEND_FILE" --python "$PYTHON_SCRIPT"

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="
