#!/usr/bin/env bash
# Regenerate all 2D SVG outputs (floor plans + elevations + combined)
# from house_config.json into docs/. Uses the editor's TypeScript
# generator so there's a single source of truth for SVG code.
#
# Usage:
#   ./scripts/regen_svgs.sh [--out <dir>] [--in <config.json>]
#
# Defaults: --in ../house_config.json --out ../docs
#
# Prerequisites:
#   - node + npm (editor already has its deps installed)
#
# The Python reference implementation (regenerate_combined_svgs.py) is
# still callable for parity regression checks — see PLAN_REFACTOR.md.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd -- "${REPO_ROOT}/editor"
# Ensure deps are present the first time this is run on a fresh clone.
if [ ! -d node_modules ]; then
  echo "↳ installing editor dependencies…"
  npm install --silent
fi

# Pass any user args through so --in / --out overrides work.
npx --no-install tsx scripts/dump-svgs.mjs "$@"
