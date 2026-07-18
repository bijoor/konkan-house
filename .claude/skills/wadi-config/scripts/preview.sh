#!/usr/bin/env bash
# Render a house_config to PNGs you can Read, so you can VISUALLY verify an edit
# instead of authoring blind:
#   - plans.png      floor plans (room layout, sizes, openings — where Y-down /
#                    units mistakes show up)
#   - elevations.png front/back/left/right elevations (heights + roof profile —
#                    a 2D view of the built model)
#   - roof.png       roof top view
#
# Reuses the app's OWN TypeScript SVG generators (editor/scripts/dump-svgs.mjs)
# rasterized with rsvg-convert. No browser, no new deps; byte-identical to the
# app's Plans/Elevations/Roof tabs.
#
# Usage:
#   .claude/skills/wadi-config/scripts/preview.sh <config.json> [out_dir]
# Then Read the printed PNG paths. Default out_dir: /tmp/wadi-preview.
# Exits non-zero (and prints errors) if the config fails validation.

set -euo pipefail

CONFIG="${1:?usage: preview.sh <config.json> [out_dir]}"
OUT="${2:-/tmp/wadi-preview}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CONFIG_ABS="$(cd "$(dirname "$CONFIG")" && pwd)/$(basename "$CONFIG")"
mkdir -p "$OUT"

# 1. Generate all 2D SVGs from the config (dump-svgs validates first).
( cd "$REPO/editor" && npx tsx scripts/dump-svgs.mjs --in "$CONFIG_ABS" --out "$OUT" ) >/dev/null

# 2. Rasterize the key views to PNG.
if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "SVGs written to $OUT/2d/ (install rsvg-convert to also get PNGs to Read)." >&2
  exit 0
fi
echo "Preview images — Read these:"
for v in "floor_plans/floor_plans_combined:plans" \
         "elevations/elevations_combined:elevations" \
         "roof/roof_top_view:roof"; do
  src="$OUT/2d/${v%%:*}.svg"; png="$OUT/${v##*:}.png"
  [ -f "$src" ] && rsvg-convert -w 1600 "$src" -o "$png" && echo "  $png"
done
echo "All SVGs (per-floor plans, each elevation, roof, pillars): $OUT/2d/"
