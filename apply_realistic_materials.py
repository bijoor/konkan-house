#!/usr/bin/env python3
"""
Apply Realistic Materials and Lighting to House Model
This script applies PBR (Physically Based Rendering) materials to the house model
with proper textures, lighting, and render settings for photorealistic output.
"""

import bpy
import math

def create_laterite_material():
    """
    Create a realistic laterite stone material.
    Laterite is a reddish-brown porous stone with a rough, matte finish.
    """
    mat = bpy.data.materials.new(name="Laterite_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create nodes
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)

    # Laterite stone properties
    # Base color: warm reddish-brown
    node_bsdf.inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)

    # Roughness: very rough, matte finish
    node_bsdf.inputs['Roughness'].default_value = 0.95

    # Specular: very low reflectivity for stone
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.1
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.1

    # Add subtle subsurface scattering for stone translucency
    node_bsdf.inputs['Subsurface Weight'].default_value = 0.05
    node_bsdf.inputs['Subsurface Radius'].default_value = (0.5, 0.3, 0.2)

    # Add noise texture for variation
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-300, 0)
    node_noise.inputs['Scale'].default_value = 5.0
    node_noise.inputs['Detail'].default_value = 10.0
    node_noise.inputs['Roughness'].default_value = 0.7

    # Color ramp for noise
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].position = 0.4
    node_colorramp.color_ramp.elements[0].color = (0.5, 0.22, 0.12, 1.0)  # Darker brown
    node_colorramp.color_ramp.elements[1].position = 0.6
    node_colorramp.color_ramp.elements[1].color = (0.6, 0.28, 0.18, 1.0)  # Lighter brown

    # Bump map for surface roughness
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.3
    node_bump.inputs['Distance'].default_value = 0.05

    # Voronoi texture for rock-like bumps
    node_voronoi = nodes.new(type='ShaderNodeTexVoronoi')
    node_voronoi.location = (-300, -200)
    node_voronoi.inputs['Scale'].default_value = 15.0
    node_voronoi.feature = 'DISTANCE_TO_EDGE'

    # Connect nodes
    links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_voronoi.outputs['Distance'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Laterite_Realistic material")
    return mat

def create_terracotta_material():
    """
    Create a realistic terracotta tile material.
    Terracotta has an orange-red color with slight glossiness and variation.
    """
    mat = bpy.data.materials.new(name="Terracotta_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create nodes
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)

    # Terracotta properties
    # Base color: warm orange-red
    node_bsdf.inputs['Base Color'].default_value = (0.75, 0.32, 0.22, 1.0)

    # Roughness: slightly rough with some sheen
    node_bsdf.inputs['Roughness'].default_value = 0.6

    # Specular: moderate for glazed tiles
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.4
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.4

    # Add noise for color variation
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-300, 0)
    node_noise.inputs['Scale'].default_value = 8.0
    node_noise.inputs['Detail'].default_value = 5.0

    # Color ramp
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].color = (0.7, 0.28, 0.18, 1.0)
    node_colorramp.color_ramp.elements[1].color = (0.8, 0.36, 0.26, 1.0)

    # Bump for tile texture
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.2

    # Wave texture for tile ridges
    node_wave = nodes.new(type='ShaderNodeTexWave')
    node_wave.location = (-300, -200)
    node_wave.inputs['Scale'].default_value = 20.0
    node_wave.wave_type = 'BANDS'

    # Connect nodes
    links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Terracotta_Realistic material")
    return mat

def create_aluminum_anodized_material():
    """
    Create a realistic golden anodized aluminum material.
    Anodized aluminum has a metallic, reflective finish with golden hue.
    """
    mat = bpy.data.materials.new(name="Aluminum_Golden_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create nodes
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (400, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (200, 0)

    # Anodized aluminum properties
    # Base color: golden
    node_bsdf.inputs['Base Color'].default_value = (0.85, 0.65, 0.35, 1.0)

    # Metallic: full metallic
    node_bsdf.inputs['Metallic'].default_value = 1.0

    # Roughness: slightly brushed metal finish
    node_bsdf.inputs['Roughness'].default_value = 0.25

    # Specular
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.8
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.8

    # Add subtle noise for brushed metal effect
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-200, -100)
    node_noise.inputs['Scale'].default_value = 100.0
    node_noise.inputs['Detail'].default_value = 15.0

    # Use noise to modulate roughness slightly
    node_math = nodes.new(type='ShaderNodeMath')
    node_math.location = (0, -100)
    node_math.operation = 'MULTIPLY'
    node_math.inputs[0].default_value = 0.05  # Scale factor

    node_add = nodes.new(type='ShaderNodeMath')
    node_add.location = (0, -200)
    node_add.operation = 'ADD'
    node_add.inputs[1].default_value = 0.25  # Base roughness

    # Connect nodes
    links.new(node_noise.outputs['Fac'], node_math.inputs[1])
    links.new(node_math.outputs['Value'], node_add.inputs[0])
    links.new(node_add.outputs['Value'], node_bsdf.inputs['Roughness'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Aluminum_Golden_Realistic material")
    return mat

def create_wood_material():
    """
    Create a realistic wood material for doors.
    Natural wood with grain patterns and warm brown color.
    """
    mat = bpy.data.materials.new(name="Wood_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create nodes
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)

    # Wood properties
    # Base color: warm brown
    node_bsdf.inputs['Base Color'].default_value = (0.35, 0.22, 0.12, 1.0)

    # Roughness: semi-glossy finish
    node_bsdf.inputs['Roughness'].default_value = 0.4

    # Specular
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.5
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.5

    # Add subtle sheen for polished wood
    if 'Sheen Weight' in node_bsdf.inputs:
        node_bsdf.inputs['Sheen Weight'].default_value = 0.3

    # Wave texture for wood grain
    node_wave = nodes.new(type='ShaderNodeTexWave')
    node_wave.location = (-500, 0)
    node_wave.inputs['Scale'].default_value = 10.0
    node_wave.inputs['Distortion'].default_value = 3.0
    node_wave.inputs['Detail'].default_value = 5.0
    node_wave.wave_type = 'BANDS'

    # Noise for grain variation
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-700, -200)
    node_noise.inputs['Scale'].default_value = 5.0
    node_noise.inputs['Detail'].default_value = 10.0

    # Mix textures
    node_mix = nodes.new(type='ShaderNodeMix')
    node_mix.location = (-300, 0)
    node_mix.data_type = 'RGBA'
    node_mix.inputs['Factor'].default_value = 0.3

    # Color ramp for wood grain
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].position = 0.4
    node_colorramp.color_ramp.elements[0].color = (0.3, 0.18, 0.1, 1.0)   # Dark grain
    node_colorramp.color_ramp.elements[1].position = 0.6
    node_colorramp.color_ramp.elements[1].color = (0.45, 0.28, 0.16, 1.0)  # Light grain

    # Bump for wood texture
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.15

    # Connect nodes
    links.new(node_wave.outputs['Fac'], node_mix.inputs['A'])
    links.new(node_noise.outputs['Fac'], node_mix.inputs['B'])
    links.new(node_mix.outputs['Result'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Wood_Realistic material")
    return mat

def apply_materials_to_objects():
    """
    Apply the realistic materials to the appropriate objects in the scene.
    """
    print("\n" + "="*70)
    print("APPLYING MATERIALS TO OBJECTS")
    print("="*70)

    laterite_mat = bpy.data.materials.get("Laterite_Realistic")
    terracotta_mat = bpy.data.materials.get("Terracotta_Realistic")
    aluminum_mat = bpy.data.materials.get("Aluminum_Golden_Realistic")
    wood_mat = bpy.data.materials.get("Wood_Realistic")

    walls_count = 0
    roof_count = 0
    window_count = 0
    door_count = 0

    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue

        # Apply laterite to walls
        if any(keyword in obj.name for keyword in ['Wall', 'Verandah', 'Living', 'Kitchen', 'Bathroom', 'Bedroom', 'Workshop']):
            if laterite_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(laterite_mat)
                else:
                    obj.data.materials[0] = laterite_mat
                walls_count += 1

        # Apply terracotta to roof
        elif 'Roof' in obj.name or 'roof' in obj.name.lower():
            if terracotta_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(terracotta_mat)
                else:
                    obj.data.materials[0] = terracotta_mat
                roof_count += 1

        # Apply aluminum to windows
        elif 'Window' in obj.name or 'window' in obj.name.lower():
            if aluminum_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(aluminum_mat)
                else:
                    obj.data.materials[0] = aluminum_mat
                window_count += 1

        # Apply wood to doors
        elif 'Door' in obj.name or 'door' in obj.name.lower():
            if wood_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(wood_mat)
                else:
                    obj.data.materials[0] = wood_mat
                door_count += 1

    print(f"\n  ✓ Applied Laterite to {walls_count} wall objects")
    print(f"  ✓ Applied Terracotta to {roof_count} roof objects")
    print(f"  ✓ Applied Aluminum to {window_count} window objects")
    print(f"  ✓ Applied Wood to {door_count} door objects")
    print()

def setup_world_lighting():
    """
    Set up realistic world lighting using a gradient background
    simulating sky and sun.
    """
    print("\n" + "="*70)
    print("SETTING UP WORLD LIGHTING")
    print("="*70)

    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links

    # Clear existing nodes
    nodes.clear()

    # Create nodes
    node_output = nodes.new(type='ShaderNodeOutputWorld')
    node_output.location = (600, 0)

    node_background = nodes.new(type='ShaderNodeBackground')
    node_background.location = (400, 0)
    node_background.inputs['Strength'].default_value = 1.0

    # Sky texture
    node_sky = nodes.new(type='ShaderNodeTexSky')
    node_sky.location = (200, 0)
    node_sky.sky_type = 'HOSEK_WILKIE'  # Physically accurate sky model
    node_sky.sun_elevation = math.radians(45)  # 45 degrees elevation
    node_sky.sun_rotation = math.radians(30)   # Sun angle
    node_sky.turbidity = 3.0  # Clear sky
    node_sky.ground_albedo = 0.3  # Ground reflectivity

    # Connect nodes
    links.new(node_sky.outputs['Color'], node_background.inputs['Color'])
    links.new(node_background.outputs['Background'], node_output.inputs['Surface'])

    print("  ✓ Created sky lighting with sun at 45° elevation")
    print()

def setup_additional_lights():
    """
    Add additional lights for better illumination.
    """
    import mathutils

    print("\n" + "="*70)
    print("ADDING ADDITIONAL LIGHTS")
    print("="*70)

    # Get scene bounds to position lights appropriately
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')

    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for corner in obj.bound_box:
                world_coord = obj.matrix_world @ mathutils.Vector(corner)
                min_x = min(min_x, world_coord.x)
                max_x = max(max_x, world_coord.x)
                min_y = min(min_y, world_coord.y)
                max_y = max(max_y, world_coord.y)
                min_z = min(min_z, world_coord.z)
                max_z = max(max_z, world_coord.z)

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    center_z = (min_z + max_z) / 2

    # Sun light (main key light)
    bpy.ops.object.light_add(type='SUN', location=(center_x + 10, center_y - 10, center_z + 20))
    sun = bpy.context.active_object
    sun.name = "Sun_Main"
    sun.data.energy = 3.0
    sun.data.angle = math.radians(5)  # Slight soft shadows
    sun.rotation_euler = (math.radians(45), 0, math.radians(135))
    print(f"  ✓ Added Sun light at elevation 45°, energy 3.0")

    # Fill light (softer, from opposite side)
    bpy.ops.object.light_add(type='AREA', location=(center_x - 10, center_y + 10, center_z + 15))
    fill_light = bpy.context.active_object
    fill_light.name = "Fill_Light"
    fill_light.data.energy = 200
    fill_light.data.size = 10
    fill_light.data.color = (0.9, 0.95, 1.0)  # Slightly blue tint for fill
    fill_light.rotation_euler = (math.radians(135), 0, math.radians(-45))
    print(f"  ✓ Added Fill light (area), energy 200")

    # Rim light (highlights edges)
    bpy.ops.object.light_add(type='AREA', location=(center_x, center_y - 15, center_z + 10))
    rim_light = bpy.context.active_object
    rim_light.name = "Rim_Light"
    rim_light.data.energy = 150
    rim_light.data.size = 8
    rim_light.data.color = (1.0, 0.95, 0.8)  # Warm rim light
    rim_light.rotation_euler = (math.radians(60), 0, 0)
    print(f"  ✓ Added Rim light (area), energy 150")
    print()

def configure_render_settings():
    """
    Configure render settings for high-quality output.
    """
    print("\n" + "="*70)
    print("CONFIGURING RENDER SETTINGS")
    print("="*70)

    scene = bpy.context.scene

    # Use Cycles render engine for realistic rendering
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'

    # Render samples
    scene.cycles.samples = 256  # Good quality, reasonable render time
    scene.cycles.preview_samples = 64

    # Denoising for cleaner results
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'

    # Light paths for realistic lighting
    scene.cycles.max_bounces = 12
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 4
    scene.cycles.transmission_bounces = 12
    scene.cycles.volume_bounces = 0
    scene.cycles.transparent_max_bounces = 8

    # Resolution
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100

    # Color management for realistic colors
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'

    # Film
    scene.render.film_transparent = False  # Solid background

    # Set viewport shading to Material Preview
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = True

    print(f"  ✓ Render engine: Cycles (GPU)")
    print(f"  ✓ Samples: 256 (render), 64 (preview)")
    print(f"  ✓ Denoising: Enabled (OpenImageDenoise)")
    print(f"  ✓ Resolution: 1920x1080")
    print(f"  ✓ Color management: Filmic with Medium High Contrast")
    print()

def setup_camera():
    """
    Set up camera for a good view of the house.
    """
    import mathutils

    print("\n" + "="*70)
    print("SETTING UP CAMERA")
    print("="*70)

    # Get scene bounds
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')

    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for corner in obj.bound_box:
                world_coord = obj.matrix_world @ mathutils.Vector(corner)
                min_x = min(min_x, world_coord.x)
                max_x = max(max_x, world_coord.x)
                min_y = min(min_y, world_coord.y)
                max_y = max(max_y, world_coord.y)
                min_z = min(min_z, world_coord.z)
                max_z = max(max_z, world_coord.z)

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    center_z = (min_z + max_z) / 2

    width = max_x - min_x
    depth = max_y - min_y
    height = max_z - min_z

    # Position camera for good 3/4 view
    camera_distance = max(width, depth, height) * 2.5

    # Check if camera already exists
    camera = bpy.data.objects.get('Camera')
    if camera:
        camera.location = (
            center_x + camera_distance * 0.7,
            center_y - camera_distance * 0.7,
            center_z + camera_distance * 0.5
        )
    else:
        bpy.ops.object.camera_add(
            location=(
                center_x + camera_distance * 0.7,
                center_y - camera_distance * 0.7,
                center_z + camera_distance * 0.5
            )
        )
        camera = bpy.context.active_object

    # Point camera at center
    direction = mathutils.Vector((
        center_x - camera.location.x,
        center_y - camera.location.y,
        center_z - camera.location.z
    ))

    # Calculate rotation
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera.rotation_euler = rot_quat.to_euler()

    # Set as active camera
    bpy.context.scene.camera = camera

    # Camera settings
    camera.data.lens = 35  # Wide angle for architecture
    camera.data.sensor_width = 36  # Full frame sensor
    camera.data.clip_end = 1000  # Far clipping plane

    print(f"  ✓ Camera positioned at 3/4 view")
    print(f"  ✓ Lens: 35mm, viewing from {camera_distance:.1f}m distance")
    print()

def render_and_save(output_path=None):
    """
    Render the scene and save the output image.
    """
    import os

    print("\n" + "="*70)
    print("RENDERING IMAGE")
    print("="*70)

    # Set output path
    if output_path is None:
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            blend_dir = os.getcwd()

        output_path = os.path.join(blend_dir, "docs", "realistic_render.png")

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    # Set output path
    scene = bpy.context.scene
    scene.render.filepath = output_path
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.compression = 15  # PNG compression

    print(f"  Output: {output_path}")
    print(f"  Resolution: {scene.render.resolution_x}x{scene.render.resolution_y}")
    print(f"  Samples: {scene.cycles.samples}")
    print()
    print("  Rendering... (this may take a few minutes)")
    print()

    # Render
    bpy.ops.render.render(write_still=True)

    # Get file size
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path) / 1024 / 1024
        print()
        print(f"  ✓ Render complete!")
        print(f"  ✓ Saved to: {output_path}")
        print(f"  ✓ File size: {file_size:.2f} MB")
    else:
        print()
        print(f"  ✗ Error: Render failed or file not saved")

    print("="*70)
    print()

    return output_path

def main():
    """
    Main function to apply all realistic materials and lighting.
    """
    import sys

    print("\n" + "="*70)
    print("APPLYING REALISTIC MATERIALS AND LIGHTING")
    print("="*70)
    print()

    # Create materials
    print("Creating realistic materials...")
    create_laterite_material()
    create_terracotta_material()
    create_aluminum_anodized_material()
    create_wood_material()
    print()

    # Apply materials to objects
    apply_materials_to_objects()

    # Set up lighting
    setup_world_lighting()
    setup_additional_lights()

    # Configure render settings
    configure_render_settings()

    # Set up camera
    setup_camera()

    print("="*70)
    print("✓ REALISTIC MATERIALS AND LIGHTING APPLIED")
    print("="*70)
    print()

    # Check if we should render
    auto_render = True  # Set to True for automatic rendering

    if auto_render:
        # Save the blend file first
        if bpy.data.filepath:
            bpy.ops.wm.save_mainfile()
            print("✓ Saved blend file")
            print()

        # Render and save
        output_path = render_and_save()

        print("="*70)
        print("✓ COMPLETE!")
        print("="*70)
        print()
        print(f"Rendered image saved to:")
        print(f"  {output_path}")
        print()
    else:
        print("Next steps:")
        print("  1. View the model in Material Preview mode (Z key > Material Preview)")
        print("  2. Adjust camera angle if needed")
        print("  3. Render: Render > Render Image (F12)")
        print("  4. For final render, increase samples in Render Properties")
        print()

if __name__ == "__main__":
    main()
