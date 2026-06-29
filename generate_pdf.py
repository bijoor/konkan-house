#!/usr/bin/env python3
"""
Generate a single PDF package containing the combined floor plans,
combined elevations, and 3D perspective renders.

Uses Chrome headless to render an HTML page to PDF (vector-quality SVGs).
Writes docs/konkan_house_ew.pdf.
"""

import datetime
import os
import shutil
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(SCRIPT_DIR, "docs")
RENDER_DIR = os.path.join(DOCS_DIR, "realistic_perspectives")
HTML_PATH = os.path.join(DOCS_DIR, "_pdf_source.html")
PDF_PATH = os.path.join(DOCS_DIR, "konkan_house_ew.pdf")

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

RENDERS = [
    ("aerial.png", "Aerial"),
    ("eye_level_front.png", "Eye-level — Front"),
    ("eye_level_back.png", "Eye-level — Back"),
    ("front_left_corner.png", "Front-left corner"),
    ("front_right_corner.png", "Front-right corner"),
    ("back_left_corner.png", "Back-left corner"),
    ("back_right_corner.png", "Back-right corner"),
]


def check_files():
    """Verify all expected inputs exist before building."""
    required = [
        os.path.join(DOCS_DIR, "floor_plans_combined.svg"),
        os.path.join(DOCS_DIR, "elevations_combined.svg"),
        os.path.join(DOCS_DIR, "roof_plan.svg"),
    ]
    missing = [p for p in required if not os.path.exists(p)]
    for fname, _ in RENDERS:
        if not os.path.exists(os.path.join(RENDER_DIR, fname)):
            missing.append(os.path.join(RENDER_DIR, fname))
    if missing:
        print("Missing inputs:")
        for m in missing:
            print(f"  - {m}")
        print("\nRun ./regenerate_all.sh and ./regenerate_blender.sh first.")
        sys.exit(1)
    if not os.path.exists(CHROME):
        print(f"Chrome not found at {CHROME}")
        sys.exit(1)


def render_cards_html():
    parts = []
    for fname, label in RENDERS:
        src = f"realistic_perspectives/{fname}"
        parts.append(
            f'<figure class="render"><img src="{src}" alt="{label}"><figcaption>{label}</figcaption></figure>'
        )
    return "\n".join(parts)


def build_html():
    today = datetime.date.today().isoformat()
    hero = "realistic_perspectives/eye_level_front.png"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Konkan House — E/W Roof Variant</title>
<style>
  @page {{ size: A3 landscape; margin: 12mm; }}
  html, body {{ margin: 0; padding: 0; font-family: -apple-system, Arial, sans-serif; color: #222; }}
  .page {{ page-break-after: always; height: calc(297mm - 24mm); display: flex; flex-direction: column; }}
  .page:last-child {{ page-break-after: auto; }}
  h1 {{ font-size: 36pt; margin: 0 0 4pt; font-weight: 600; }}
  h2 {{ font-size: 18pt; margin: 0 0 8pt; font-weight: 500; color: #444; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }}
  .meta {{ color: #666; font-size: 11pt; }}

  /* Cover */
  .cover {{ justify-content: center; align-items: center; text-align: center; }}
  .cover .hero {{ max-width: 70%; max-height: 60%; margin-top: 16pt; box-shadow: 0 0 8px rgba(0,0,0,0.15); }}
  .cover .subtitle {{ font-size: 16pt; color: #555; margin-top: 8pt; }}

  /* Drawing pages: SVG fills the available space */
  .drawing {{ flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }}
  .drawing img {{ max-width: 100%; max-height: 100%; object-fit: contain; }}

  /* Render grid */
  .grid {{ flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 10pt; min-height: 0; }}
  .render {{ margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }}
  .render img {{ max-width: 100%; max-height: calc(100% - 20pt); object-fit: contain; box-shadow: 0 0 4px rgba(0,0,0,0.15); }}
  .render figcaption {{ font-size: 10pt; color: #555; margin-top: 4pt; }}
</style>
</head>
<body>

<section class="page cover">
  <h1>Konkan House</h1>
  <div class="subtitle">East–West Roof Variant — Design Package</div>
  <div class="meta">Generated {today}</div>
  <img class="hero" src="{hero}" alt="Hero render">
</section>

<section class="page">
  <h2>Floor Plans — All Floors</h2>
  <div class="drawing"><img src="floor_plans_combined.svg" alt="Combined floor plans"></div>
</section>

<section class="page">
  <h2>Elevations — Front · Back · Left · Right</h2>
  <div class="drawing"><img src="elevations_combined.svg" alt="Combined elevations"></div>
</section>

<section class="page">
  <h2>Roof — Dimensioned Cross Sections</h2>
  <div class="drawing"><img src="roof_plan.svg" alt="Roof sections"></div>
</section>

<section class="page">
  <h2>3D Perspective Renders</h2>
  <div class="grid">
    {render_cards_html()}
  </div>
</section>

</body>
</html>
"""
    with open(HTML_PATH, "w") as f:
        f.write(html)


def render_pdf():
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_PATH}",
        f"file://{HTML_PATH}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    # Chrome headless prints noisy info to stderr; only surface on failure.
    if result.returncode != 0 or not os.path.exists(PDF_PATH):
        sys.stderr.write(result.stderr)
        sys.stderr.write(result.stdout)
        raise RuntimeError(f"Chrome headless failed (exit {result.returncode})")


def main():
    check_files()
    build_html()
    try:
        render_pdf()
    finally:
        if os.path.exists(HTML_PATH):
            os.remove(HTML_PATH)
    size_kb = os.path.getsize(PDF_PATH) / 1024
    print(f"✓ Wrote {PDF_PATH} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
