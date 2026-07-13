"""
Combined SVG generation for floor plans and elevations.
Creates composite views showing all floors or all elevation views together.
"""

import os
import re
from xml.etree import ElementTree as ET


def create_combined_floor_plans(output_dir: str = "docs"):
    """
    Create a combined SVG showing all floor plans arranged horizontally.

    Args:
        output_dir: Directory containing individual floor plan SVGs
    """
    # Find all floor plan SVGs in the directory
    floor_pattern = re.compile(r'floor_plan_(\w+)\.svg')
    floor_files = []

    for filename in sorted(os.listdir(output_dir)):
        match = floor_pattern.match(filename)
        if not match:
            continue

        svg_path = os.path.join(output_dir, filename)
        floor_name = match.group(1).replace('_', ' ').title()

        with open(svg_path, 'r', encoding='utf-8') as f:
            svg_content = f.read()

        # Parse SVG to get dimensions and original scale
        root = ET.fromstring(svg_content)
        width = float(root.get('width', 800))
        height = float(root.get('height', 800))

        # Extract the original scale from the g transform attribute
        # Format: <g transform="translate(x, y) scale(sx, sy)">
        import re as regex_module
        scale_match = regex_module.search(r'scale\(([0-9.]+)(?:,\s*([0-9.]+))?\)', svg_content)
        original_scale = float(scale_match.group(1)) if scale_match else 1.0

        floor_files.append({
            'name': floor_name,
            'filename': filename,
            'content': svg_content,
            'width': width,
            'height': height,
            'original_scale': original_scale
        })

    if not floor_files:
        print("No floor plans found to combine")
        return

    print(f"Found {len(floor_files)} floor plans to combine")

    # Calculate layout
    spacing = 40  # Horizontal spacing between floors

    # Use a target scale that will be consistent across all floors
    # We want all floors to use the same scale so 1 world unit = same screen size
    target_scale = 0.25  # Target screen scale

    # Calculate dimensions using the target scale
    # Each floor's screen size = (width/original_scale) * target_scale
    def get_screen_width(f):
        return (f['width'] / f['original_scale']) * target_scale

    def get_screen_height(f):
        return (f['height'] / f['original_scale']) * target_scale

    total_width = sum(get_screen_width(f) for f in floor_files) + spacing * (len(floor_files) - 1)
    max_height = max(get_screen_height(f) for f in floor_files)

    # Add margins
    margin = 50  # Reduced margin
    title_space = 60
    canvas_width = total_width + 2 * margin
    canvas_height = max_height + 2 * margin + title_space

    # Create combined SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_width}" height="{canvas_height}" viewBox="0 0 {canvas_width} {canvas_height}">
<title>All Floor Plans</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
        .floor-label {{ font-size: 14px; font-weight: bold; fill: #333; }}
    </style>
</defs>
'''

    # Add title
    title_y = title_space / 2 + 10
    svg += f'<text x="{canvas_width/2}" y="{title_y}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">All Floor Plans</text>\n'

    # Add each floor plan
    current_x = margin
    for floor_data in floor_files:
        # Calculate this floor's scale to match the target scale
        original_scale = floor_data['original_scale']
        floor_scale = target_scale / original_scale

        floor_width = get_screen_width(floor_data)
        floor_height = get_screen_height(floor_data)

        # Extract the content from the original SVG
        content = floor_data['content']

        # Create a group for this floor with transformation
        # Use floor_scale which normalizes all floors to the same world scale
        svg += f'<g transform="translate({current_x}, {margin + title_space}) scale({floor_scale})">\n'

        # Extract and include the main content (skip the outer svg tag)
        # The pattern matches: <g transform="translate(...) scale(...)">content</g>
        g_match = re.search(r'<g transform="[^"]+">(.+?)</g>\s*<text', content, re.DOTALL)
        if g_match:
            svg += g_match.group(1)

        svg += '</g>\n'

        # Add floor label below
        label_y = margin + title_space + floor_height + 30
        svg += f'<text x="{current_x + floor_width/2}" y="{label_y}" text-anchor="middle" class="floor-label">{floor_data["name"]}</text>\n'

        current_x += floor_width + spacing

    svg += '</svg>'

    # Save combined SVG
    output_path = os.path.join(output_dir, 'floor_plans_combined.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)

    print(f"✓ Combined floor plans saved to: {output_path}")
    return output_path


def create_combined_elevations(output_dir: str = "docs"):
    """
    Create a combined SVG showing all elevation views (left, front, right, back)
    arranged horizontally with bottoms aligned.

    Args:
        output_dir: Directory containing individual elevation SVGs
    """
    # Order: left, front, right, back (standard architectural layout)
    view_order = ['left', 'front', 'right', 'back']
    view_labels = {
        'left': 'Left Elevation',
        'front': 'Front Elevation',
        'right': 'Right Elevation',
        'back': 'Back Elevation'
    }

    # Load all elevation SVGs
    elevation_svgs = []
    for view_type in view_order:
        svg_path = os.path.join(output_dir, f'elevation_{view_type}.svg')

        if not os.path.exists(svg_path):
            print(f"Warning: {svg_path} not found, skipping")
            continue

        with open(svg_path, 'r', encoding='utf-8') as f:
            svg_content = f.read()

        # Parse SVG to get dimensions and original scale
        root = ET.fromstring(svg_content)
        width = float(root.get('width', 800))
        height = float(root.get('height', 800))

        # Extract the original scale from the g transform attribute
        import re as regex_module
        scale_match = regex_module.search(r'scale\(([0-9.]+)(?:,\s*([0-9.-]+))?\)', svg_content)
        original_scale = abs(float(scale_match.group(1))) if scale_match else 1.0

        elevation_svgs.append({
            'view_type': view_type,
            'label': view_labels[view_type],
            'content': svg_content,
            'width': width,
            'height': height,
            'original_scale': original_scale
        })

    if not elevation_svgs:
        print("No elevations found to combine")
        return

    print(f"Found {len(elevation_svgs)} elevations to combine")

    # Calculate layout
    spacing = 40  # Horizontal spacing between elevations

    # Use a target scale that will be consistent across all elevations
    target_scale = 0.25  # Target screen scale

    # Calculate dimensions using the target scale
    def get_screen_width(e):
        return (e['width'] / e['original_scale']) * target_scale

    def get_screen_height(e):
        return (e['height'] / e['original_scale']) * target_scale

    total_width = sum(get_screen_width(e) for e in elevation_svgs) + spacing * (len(elevation_svgs) - 1)
    max_height = max(get_screen_height(e) for e in elevation_svgs)

    # Add margins
    margin = 50  # Reduced margin
    title_space = 60
    canvas_width = total_width + 2 * margin
    canvas_height = max_height + 2 * margin + title_space

    # Create combined SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_width}" height="{canvas_height}" viewBox="0 0 {canvas_width} {canvas_height}">
<title>All Elevations</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
        .view-label {{ font-size: 14px; font-weight: bold; fill: #333; }}
    </style>
</defs>
'''

    # Add title
    title_y = title_space / 2 + 10
    svg += f'<text x="{canvas_width/2}" y="{title_y}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">All Elevations</text>\n'

    # Add each elevation
    current_x = margin
    for elev_data in elevation_svgs:
        # Calculate this elevation's scale to match the target scale
        original_scale = elev_data['original_scale']
        elev_scale = target_scale / original_scale

        elev_width = get_screen_width(elev_data)
        elev_height = get_screen_height(elev_data)

        # Extract the content from the original SVG
        content = elev_data['content']

        # Create a group for this elevation with transformation
        # Align bottoms: place at same Y position
        # Use negative Y-scale to match the original elevation SVGs (which use scale(2.0, -2.0))
        svg += f'<g transform="translate({current_x}, {margin + title_space + elev_height}) scale({elev_scale}, {-elev_scale})">\n'

        # Extract and include the main content (skip the outer svg tag)
        # The pattern matches: <g transform="translate(...) scale(...)">content</g>
        g_match = re.search(r'<g transform="[^"]+">(.+?)</g>\s*<text', content, re.DOTALL)
        if g_match:
            svg += g_match.group(1)

        svg += '</g>\n'

        # Add view label below
        label_y = margin + title_space + elev_height + 30
        svg += f'<text x="{current_x + elev_width/2}" y="{label_y}" text-anchor="middle" class="view-label">{elev_data["label"]}</text>\n'

        current_x += elev_width + spacing

    svg += '</svg>'

    # Save combined SVG
    output_path = os.path.join(output_dir, 'elevations_combined.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)

    print(f"✓ Combined elevations saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    print("="*70)
    print("Generating combined SVGs...")
    print("="*70)

    print("\n1. Combined floor plans...")
    create_combined_floor_plans("docs")

    print("\n2. Combined elevations...")
    create_combined_elevations("docs")

    print("\n" + "="*70)
    print("✓ Done!")
    print("="*70)
