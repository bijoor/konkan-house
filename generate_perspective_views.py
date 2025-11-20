#!/usr/bin/env python3
"""
Generate perspective SVG views of the house using Blender Freestyle renderer
"""

import subprocess
import sys
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    """Generate perspective views using Blender"""

    # Output directory
    output_dir = os.path.join(SCRIPT_DIR, 'docs')

    # Create the Blender script content
    blender_script_content = f'''
import bpy
import math
import os
import mathutils

# Configuration
OUTPUT_DIR = {repr(output_dir)}
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Enable Freestyle SVG Exporter add-on
print("Enabling Freestyle SVG Exporter add-on...")
try:
    bpy.ops.preferences.addon_enable(module='render_freestyle_svg')
    print("✓ Freestyle SVG Exporter add-on enabled")
except Exception as e:
    print(f"⚠ Warning: Could not enable SVG exporter add-on: {{e}}")
    print("  Will attempt to continue anyway...")

# Import and build the house first
exec(open({repr(os.path.join(SCRIPT_DIR, 'konkan_house_config.py'))}).read())
build_house(use_explosion=False)

print("\\n" + "="*70)
print("SETTING UP LIGHTING")
print("="*70 + "\\n")

# Add sun light for main illumination
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 2.0  # Bright sunlight
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.location = (to_meters(500), to_meters(200), to_meters(800))
sun_obj.rotation_euler = (math.radians(45), 0, math.radians(45))
print("✓ Added sun light")

# Add ambient light from environment
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world

world.use_nodes = True
nodes = world.node_tree.nodes
nodes.clear()

# Background node for ambient light
bg_node = nodes.new(type='ShaderNodeBackground')
bg_node.inputs['Color'].default_value = (0.9, 0.9, 0.9, 1.0)  # Light gray ambient
bg_node.inputs['Strength'].default_value = 0.8  # Bright ambient light

# Output node
output_node = nodes.new(type='ShaderNodeOutputWorld')

# Connect nodes
world.node_tree.links.new(bg_node.outputs['Background'], output_node.inputs['Surface'])
print("✓ Added ambient environment lighting")

print("\\n" + "="*70)
print("SETTING UP PERSPECTIVE CAMERAS")
print("="*70 + "\\n")

# Get the house bounds to position cameras appropriately
# Calculate building center and bounds
plinth_width = 270  # X dimension in units
plinth_length = 450  # Y dimension in units
building_center_x = plinth_width / 2
building_center_y = plinth_length / 2
building_center_z = 150  # Approximate mid-height in units

# Convert to meters for camera positioning
from blender_3d import to_meters
center_x_m = to_meters(building_center_x)
center_y_m = to_meters(building_center_y)
center_z_m = to_meters(building_center_z)

# Define perspective camera views
# Cameras positioned VERY far back with wide lens (24mm) to capture full house
camera_views = [
    {{
        "name": "front_left_corner",
        "description": "Front Left Corner View (Southwest)",
        "location": (to_meters(-900), to_meters(-800), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    }},
    {{
        "name": "front_right_corner",
        "description": "Front Right Corner View (Southeast)",
        "location": (to_meters(1170), to_meters(-800), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    }},
    {{
        "name": "back_left_corner",
        "description": "Back Left Corner View (Northwest)",
        "location": (to_meters(-900), to_meters(1250), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    }},
    {{
        "name": "back_right_corner",
        "description": "Back Right Corner View (Northeast)",
        "location": (to_meters(1170), to_meters(1250), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    }},
    {{
        "name": "aerial",
        "description": "Aerial View",
        "location": (to_meters(700), to_meters(-200), to_meters(1000)),
        "target": (center_x_m, center_y_m, to_meters(100)),
        "lens": 24
    }},
    {{
        "name": "eye_level_front",
        "description": "Eye Level Front View",
        "location": (center_x_m, to_meters(-900), to_meters(60)),
        "target": (center_x_m, center_y_m, to_meters(150)),
        "lens": 28
    }}
]

# Configure scene for rendering
scene = bpy.context.scene

# Use EEVEE renderer for fast rendering with good lighting
# Note: Blender 4.4+ uses BLENDER_EEVEE_NEXT
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    print("✓ Using EEVEE Next renderer")
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
    print("✓ Using EEVEE renderer")

# Enable ambient occlusion for depth
if hasattr(scene, 'eevee'):
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 10.0

# Enable Freestyle for line art
scene.render.use_freestyle = True
scene.render.line_thickness_mode = 'ABSOLUTE'
scene.render.line_thickness = 2.5  # Increased for 4K resolution

# Set render resolution to 4K for high-quality prints
scene.render.resolution_x = 3840
scene.render.resolution_y = 2160
scene.render.resolution_percentage = 100

# Set output format to PNG (Freestyle will generate SVG separately)
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True

# Enable SVG export via Freestyle
try:
    scene.svg_export.use_svg_export = True
    scene.svg_export.mode = 'FRAME'
    print("✓ SVG export enabled")
except AttributeError:
    print("⚠ Warning: svg_export not available, will render PNG only")
    pass

# Configure Freestyle line settings
view_layer = scene.view_layers[0]
freestyle_settings = view_layer.freestyle_settings

# Use existing lineset or create new one
if len(freestyle_settings.linesets) > 0:
    lineset = freestyle_settings.linesets[0]
else:
    lineset = freestyle_settings.linesets.new("MainLines")

# Enable different line types
lineset.select_silhouette = True
lineset.select_border = True
lineset.select_crease = True
lineset.select_contour = True
lineset.select_edge_mark = True
lineset.select_external_contour = True

# Set line color to black and thickness for 4K
lineset.linestyle.color = (0, 0, 0)
lineset.linestyle.thickness = 3.0  # Increased for 4K resolution

print(f"Configured Freestyle renderer")
print(f"Resolution: {{scene.render.resolution_x}}x{{scene.render.resolution_y}}")

# Create and render each camera view
for view in camera_views:
    print(f"\\n→ Setting up camera: {{view['name']}} - {{view['description']}}")

    # Create camera
    camera_data = bpy.data.cameras.new(name=view["name"])
    camera_data.lens = view.get("lens", 35)  # Use lens from view definition
    camera_obj = bpy.data.objects.new(view["name"], camera_data)
    bpy.context.scene.collection.objects.link(camera_obj)

    # Position camera
    camera_obj.location = view["location"]

    # Point camera at target
    direction = mathutils.Vector(view["target"]) - mathutils.Vector(view["location"])
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera_obj.rotation_euler = rot_quat.to_euler()

    # Set as active camera
    scene.camera = camera_obj

    # Set output path
    output_path = os.path.join(OUTPUT_DIR, f"perspective_{{view['name']}}")
    scene.render.filepath = output_path

    print(f"  Camera location: {{view['location']}}")
    print(f"  Looking at: {{view['target']}}")
    print(f"  Output: {{output_path}}.svg / .png")

    # Render
    try:
        bpy.ops.render.render(write_still=True)

        # Check for SVG output (Freestyle adds frame number like 0001.svg)
        svg_path_with_frame = output_path + "0001.svg"
        svg_path_final = output_path + ".svg"
        png_path = output_path + ".png"

        if os.path.exists(svg_path_with_frame):
            # Rename to remove frame number
            if os.path.exists(svg_path_final):
                os.remove(svg_path_final)
            os.rename(svg_path_with_frame, svg_path_final)
            file_size = os.path.getsize(svg_path_final) / 1024
            print(f"✓ Rendered {{view['name']}} -> {{svg_path_final}} ({{file_size:.1f}} KB)")
        elif os.path.exists(png_path):
            file_size = os.path.getsize(png_path) / 1024
            print(f"✓ Rendered {{view['name']}} -> {{png_path}} ({{file_size:.1f}} KB) [PNG only - SVG not generated]")
        else:
            print(f"⚠ Render completed but no output file found")
    except Exception as e:
        print(f"✗ Error rendering {{view['name']}}: {{e}}")
        import traceback
        traceback.print_exc()

print("\\n" + "="*70)
print("✓ PERSPECTIVE VIEWS GENERATION COMPLETE")
print("="*70)
print(f"\\nCheck the {{OUTPUT_DIR}} folder for output files")
'''

    # Write temporary Blender script
    temp_script = os.path.join(SCRIPT_DIR, 'temp_perspective_script.py')
    with open(temp_script, 'w') as f:
        f.write(blender_script_content)

    print("="*70)
    print("GENERATING PERSPECTIVE VIEWS")
    print("="*70)
    print(f"Output directory: {output_dir}")
    print()

    try:
        # Run Blender in background mode
        result = subprocess.run([
            '/Applications/Blender.app/Contents/MacOS/Blender',
            '--background',
            '--python', temp_script
        ], check=True, capture_output=True, text=True)

        print(result.stdout)
        if result.stderr:
            print("Warnings/Errors:", result.stderr, file=sys.stderr)

        print("\n✓ Perspective views generated successfully!")
        print(f"\nGenerated files in {output_dir}:")
        for view_name in ['front_left_corner', 'front_right_corner', 'back_left_corner',
                          'back_right_corner', 'aerial', 'eye_level_front']:
            svg_file = os.path.join(output_dir, f'perspective_{view_name}.svg')
            png_file = os.path.join(output_dir, f'perspective_{view_name}.png')
            if os.path.exists(svg_file):
                size = os.path.getsize(svg_file)
                print(f"  ✓ perspective_{view_name}.svg ({size/1024:.1f} KB)")
            elif os.path.exists(png_file):
                size = os.path.getsize(png_file)
                print(f"  ✓ perspective_{view_name}.png ({size/1024:.1f} KB)")
            else:
                print(f"  ✗ perspective_{view_name} not found")

    except subprocess.CalledProcessError as e:
        print(f"Error running Blender: {e}", file=sys.stderr)
        print(e.stdout)
        print(e.stderr, file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: Blender not found at /Applications/Blender.app/Contents/MacOS/Blender", file=sys.stderr)
        print("Please ensure Blender is installed", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up temp script
        if os.path.exists(temp_script):
            os.remove(temp_script)

if __name__ == '__main__':
    main()
