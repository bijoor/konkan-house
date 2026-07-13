#!/bin/bash
# Regenerate the design package PDF (docs/konkan_house_ew.pdf).
# Assumes SVGs and PNG renders are already up to date — run
# ./regenerate_all.sh and/or ./regenerate_blender.sh first if not.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Regenerating PDF design package"
echo "=========================================="
echo ""

python3 generate_pdf.py

echo ""
echo "=========================================="
echo "Done. PDF: docs/konkan_house_ew.pdf"
echo "=========================================="
