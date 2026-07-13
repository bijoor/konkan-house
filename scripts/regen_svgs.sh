#!/usr/bin/env bash
# Regenerate all 2D SVG outputs (floor plans + elevations + combined).
#
# Currently a thin wrapper around the Python reference implementation.
# Phase R2 will replace the body with a call to the editor's TypeScript
# generator (editor/scripts/dump-svgs.mjs) so we have a single source of
# truth for SVG code. The interface — running this script produces
# fresh SVGs in docs/ — will stay the same.
#
# Usage:
#   ./scripts/regen_svgs.sh
#
# Prerequisites (current):
#   - Python 3 on PATH
#   - No Blender required (regenerate_combined_svgs.py sidesteps bpy)
set -euo pipefail

# Resolve the repo root from this script's location, independent of CWD.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd -- "${REPO_ROOT}"
python3 regenerate_combined_svgs.py
