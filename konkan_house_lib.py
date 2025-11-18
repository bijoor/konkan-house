"""
Konkan House 3D Library
Reusable functions for creating house models in Blender

Coordinate System:
- Input: Inkscape-style (origin top-left, X right, Y down)
- Blender: X right, Y forward, Z up
- Conversion: Blender_X = Input_X, Blender_Y = -Input_Y, Blender_Z = height
"""

import bpy
import math
from typing import Dict, List, Tuple, Optional

# ============================================================================
# GLOBAL CONFIGURATION (Default values - override in your config file)
# ============================================================================

GLOBAL_CONFIG = {
    # Scaling & Units
    'units_to_meters_ratio': 0.3048,  # Default: feet to meters (1 ft = 0.3048 m)
    'scale_factor': 1.0,               # Additional scaling multiplier
    
    # Ground reference
    'ground_level_z': 0.0,             # Ground level Z coordinate in meters
    
    # Floor configuration (heights in input units)
    'floor_heights': {
        0: 10.0,   # Ground floor wall height (feet)
        1: 9.0,    # First floor wall height (feet)
        2: 8.0,    # Second floor wall height (feet)
    },
    
    # Default dimensions (in input units)
    'wall_thickness': 0.67,            # ~8 inches in feet
    'floor_slab_thickness': 0.33,      # ~4 inches in feet
    'plinth_height': 1.5,              # feet
    
    # Materials & Colors
    'colors': {
        'walls': (0.55, 0.25, 0.15, 1.0),      # Laterite: reddish-brown
        'floor': (0.6, 0.55, 0.5, 1.0),
        'plinth': (0.5, 0.45, 0.4, 1.0),
        'roof': (0.7, 0.3, 0.2, 1.0),
        'verandah': (0.5, 0.25, 0.15, 1.0),    # Laterite
        'living': (0.55, 0.25, 0.15, 1.0),     # Laterite
        'kitchen': (0.55, 0.25, 0.15, 1.0),    # Laterite
        'bathroom': (0.55, 0.25, 0.15, 1.0),   # Laterite
        'bedroom': (0.55, 0.25, 0.15, 1.0),    # Laterite
        'workshop': (0.55, 0.25, 0.15, 1.0),   # Laterite
    }
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def to_meters(value: float) -> float:
    """Convert input units to meters with scaling"""
    return value * GLOBAL_CONFIG['units_to_meters_ratio'] * GLOBAL_CONFIG['scale_factor']

def inkscape_to_blender(x: float, y: float, z: float = 0) -> Tuple[float, float, float]:
    """
    Convert Inkscape coordinates (origin top-left, Y down) to Blender coordinates.
    
    Args:
        x: Horizontal position (right positive)
        y: Vertical position (down positive in Inkscape)
        z: Height (up positive)
    
    Returns:
        Tuple of (blender_x, blender_y, blender_z) in meters
    """
    blender_x = to_meters(x)
    blender_y = to_meters(-y)  # Flip Y axis
    blender_z = to_meters(z) + GLOBAL_CONFIG['ground_level_z']
    return (blender_x, blender_y, blender_z)

def get_floor_z_offset(floor_number: int) -> float:
    """
    Calculate Z offset for a given floor number (bottom of floor slab).

    Args:
        floor_number: Floor number (0 = ground floor, 1 = first floor, etc.)

    Returns:
        Z offset in meters from ground level to the bottom of the floor slab
    """
    z_offset = GLOBAL_CONFIG['plinth_height']  # Start with plinth height

    # For each previous floor, add: slab thickness + wall height
    for floor in range(floor_number):
        # Add floor slab thickness
        z_offset += GLOBAL_CONFIG['floor_slab_thickness']

        # Add wall height
        if floor in GLOBAL_CONFIG['floor_heights']:
            wall_height = GLOBAL_CONFIG['floor_heights'][floor]
            z_offset += wall_height
        else:
            # Use ground floor height as default
            wall_height = GLOBAL_CONFIG['floor_heights'].get(0, 10.0)
            z_offset += wall_height

    result = to_meters(z_offset)
    print(f"  DEBUG: Floor {floor_number} Z offset = {z_offset} units = {result} meters", flush=True)
    return result

def create_material(name: str, color: Tuple[float, float, float, float]) -> bpy.types.Material:
    """Create or get a Blender material with the given color"""
    if name in bpy.data.materials:
        return bpy.data.materials[name]

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs['Base Color'].default_value = color

    # Set roughness based on material type
    if 'laterite' in name.lower() or name in ['walls', 'verandah', 'living', 'kitchen', 'bathroom', 'bedroom', 'workshop']:
        # Laterite stone - rough, matte finish
        bsdf.inputs['Roughness'].default_value = 0.95
        # Try to set Specular if it exists (depends on Blender version)
        try:
            bsdf.inputs['Specular'].default_value = 0.1
        except KeyError:
            # Newer Blender versions use 'Specular IOR Level' instead
            try:
                bsdf.inputs['Specular IOR Level'].default_value = 0.1
            except KeyError:
                pass  # Skip if neither exists
    else:
        bsdf.inputs['Roughness'].default_value = 0.7

    return mat

def initialize_materials():
    """Create all materials defined in GLOBAL_CONFIG"""
    for name, color in GLOBAL_CONFIG['colors'].items():
        create_material(name, color)

def get_or_create_collection(name: str) -> bpy.types.Collection:
    """Get or create a Blender collection for organizing objects"""
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection

def add_to_collection(obj: bpy.types.Object, collection_name: str):
    """Add an object to a named collection"""
    collection = get_or_create_collection(collection_name)
    
    # Remove from all other collections
    for coll in obj.users_collection:
        coll.objects.unlink(obj)
    
    # Add to target collection
    collection.objects.link(obj)

def create_box(name: str, location: Tuple[float, float, float],
               dimensions: Tuple[float, float, float],
               material_name: str,
               collection_name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a box mesh with material.

    Args:
        name: Object name
        location: (x, y, z) center position in meters
        dimensions: (width, depth, height) in meters
        material_name: Name of material to apply
        collection_name: Optional collection to add object to

    Returns:
        Created Blender object
    """
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (dimensions[0]/2, dimensions[1]/2, dimensions[2]/2)

    if material_name in bpy.data.materials:
        mat = bpy.data.materials[material_name]
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat

        # Set viewport display color to match material color
        # This makes the object show the color even in solid shading mode
        base_color = mat.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value
        obj.color = (base_color[0], base_color[1], base_color[2], base_color[3])

    if collection_name:
        add_to_collection(obj, collection_name)

    return obj

# ============================================================================
# MAIN CONSTRUCTION FUNCTIONS
# ============================================================================

def create_plinth(x: float, y: float, width: float, length: float,
                  height: Optional[float] = None,
                  material_name: str = 'plinth') -> bpy.types.Object:
    """
    Create a plinth (raised platform foundation).

    Args:
        x, y: Top-left corner position in input units (Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        height: Plinth height (input units), uses config default if None
        material_name: Material to apply

    Returns:
        Created plinth object
    """
    if height is None:
        height = GLOBAL_CONFIG['plinth_height']

    # Convert to Blender coordinates
    # Center of plinth
    center_x = x + width / 2
    center_y = y + length / 2
    center_z = height / 2  # Plinth goes from ground to height

    location = inkscape_to_blender(center_x, center_y, center_z)
    dimensions = (to_meters(width), to_meters(length), to_meters(height))

    plinth = create_box('Plinth', location, dimensions, material_name, 'Foundation')

    plinth_bottom = location[2] - dimensions[2] / 2
    plinth_top = location[2] + dimensions[2] / 2
    print(f"✓ Created plinth: {width}×{length}×{height} units at ({x}, {y})")
    print(f"  Plinth Z: bottom={plinth_bottom:.3f}m, center={location[2]:.3f}m, top={plinth_top:.3f}m", flush=True)
    return plinth

def _create_sloped_wall(start_x: float, start_y: float, end_x: float, end_y: float,
                        bottom_z: float, height_start: float, height_end: float,
                        thickness: float, name: str, material_name: str,
                        collection_name: Optional[str]) -> bpy.types.Object:
    """
    Create a wall with sloping top by building a custom mesh.

    All coordinates in input units.
    """
    import bmesh

    # Calculate perpendicular offset for thickness
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.sqrt(dx**2 + dy**2)

    # Unit perpendicular vector (rotated 90 degrees)
    perp_x = -dy / length
    perp_y = dx / length

    # Half thickness offset
    half_thick = thickness / 2

    # Define 8 vertices of the sloped wall (in input units)
    # Bottom face (4 vertices)
    v0 = (start_x - perp_x * half_thick, start_y - perp_y * half_thick, bottom_z)
    v1 = (start_x + perp_x * half_thick, start_y + perp_y * half_thick, bottom_z)
    v2 = (end_x + perp_x * half_thick, end_y + perp_y * half_thick, bottom_z)
    v3 = (end_x - perp_x * half_thick, end_y - perp_y * half_thick, bottom_z)

    # Top face (4 vertices) - sloped
    v4 = (start_x - perp_x * half_thick, start_y - perp_y * half_thick, bottom_z + height_start)
    v5 = (start_x + perp_x * half_thick, start_y + perp_y * half_thick, bottom_z + height_start)
    v6 = (end_x + perp_x * half_thick, end_y + perp_y * half_thick, bottom_z + height_end)
    v7 = (end_x - perp_x * half_thick, end_y - perp_y * half_thick, bottom_z + height_end)

    # Convert all vertices to Blender coordinates (meters)
    verts = [
        inkscape_to_blender(*v0), inkscape_to_blender(*v1),
        inkscape_to_blender(*v2), inkscape_to_blender(*v3),
        inkscape_to_blender(*v4), inkscape_to_blender(*v5),
        inkscape_to_blender(*v6), inkscape_to_blender(*v7)
    ]

    # Define faces (quad faces, counter-clockwise winding)
    faces = [
        [0, 1, 2, 3],  # Bottom
        [4, 5, 6, 7],  # Top (sloped)
        [0, 4, 5, 1],  # Start face
        [2, 6, 7, 3],  # End face
        [1, 5, 6, 2],  # Right side
        [0, 3, 7, 4],  # Left side
    ]

    # Create mesh
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    # Create object
    obj = bpy.data.objects.new(name, mesh)

    # Add to collection
    if collection_name:
        collection = bpy.data.collections.get(collection_name)
        if not collection:
            collection = bpy.data.collections.new(collection_name)
            bpy.context.scene.collection.children.link(collection)
        collection.objects.link(obj)
    else:
        bpy.context.collection.objects.link(obj)

    # Apply material
    if material_name in bpy.data.materials:
        mat = bpy.data.materials[material_name]
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat

        # Set viewport display color to match material color
        # This makes the object show the color even in solid shading mode
        base_color = mat.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value
        obj.color = (base_color[0], base_color[1], base_color[2], base_color[3])

    return obj

def create_wall(start_x: float, start_y: float, end_x: float, end_y: float,
                floor_number: int = 0,
                height: Optional[float] = None,
                height_end: Optional[float] = None,
                thickness: Optional[float] = None,
                name: str = "Wall",
                material_name: str = 'walls',
                collection_name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a wall between two points, with optional sloping top.

    Args:
        start_x, start_y: Starting point (input units, Inkscape coordinates)
        end_x, end_y: Ending point (input units, Inkscape coordinates)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Wall height at start point (input units), uses floor config if None
        height_end: Wall height at end point (input units). If None, uses 'height' (flat top)
        thickness: Wall thickness (input units), uses config default if None
        name: Wall name
        material_name: Material to apply
        collection_name: Collection to add wall to

    Returns:
        Created wall object
    """
    if height is None:
        height = GLOBAL_CONFIG['floor_heights'].get(floor_number, 10.0)

    # If height_end not specified, use same height as start (flat top)
    if height_end is None:
        height_end = height

    if thickness is None:
        thickness = GLOBAL_CONFIG['wall_thickness']

    # Calculate wall parameters
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.sqrt(dx**2 + dy**2)

    # Debug output
    is_sloped = abs(height_end - height) > 0.01
    slope_indicator = f" (sloped {height}->{height_end})" if is_sloped else ""
    print(f"  Wall '{name}': ({start_x:.3f}, {start_y:.3f}) -> ({end_x:.3f}, {end_y:.3f}), length={length:.3f}{slope_indicator}")

    if length == 0:
        print(f"Warning: Wall {name} has zero length")
        return None

    # Z position: walls sit on top of floor slab
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    z_offset_units = get_floor_z_offset(floor_number) / to_meters(1.0)  # Convert meters back to units
    floor_slab_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    wall_bottom_z_units = z_offset_units + floor_slab_thickness_units

    # Check if wall has sloping top
    if is_sloped:
        # Create sloped wall using custom mesh
        wall = _create_sloped_wall(
            start_x, start_y, end_x, end_y,
            wall_bottom_z_units, height, height_end,
            thickness, name, material_name, collection_name
        )
        wall_top_start = wall_bottom_z_units + height
        wall_top_end = wall_bottom_z_units + height_end
        print(f"    Wall Z: bottom={to_meters(wall_bottom_z_units):.2f}m, top_start={to_meters(wall_top_start):.2f}m, top_end={to_meters(wall_top_end):.2f}m", flush=True)
    else:
        # Create regular flat-top wall
        center_x = (start_x + end_x) / 2
        center_y = (start_y + end_y) / 2
        center_z_units = wall_bottom_z_units + height / 2
        wall_top_z_units = wall_bottom_z_units + height

        # Convert to Blender coordinates
        location = inkscape_to_blender(center_x, center_y, center_z_units)
        dimensions = (to_meters(length), to_meters(thickness), to_meters(height))

        print(f"    Wall Z: bottom={to_meters(wall_bottom_z_units):.2f}m, center={to_meters(center_z_units):.2f}m, top={to_meters(wall_top_z_units):.2f}m", flush=True)

        # Create wall
        wall = create_box(name, location, dimensions, material_name, collection_name)

        # Rotate wall to align with start-end direction
        angle = math.atan2(-dy, dx)  # Negative dy because Y is flipped
        wall.rotation_euler = (0, 0, angle)

    return wall

def create_pillar(x: float, y: float,
                  floor_number: int = 0,
                  height: Optional[float] = None,
                  size: Optional[float] = None,
                  name: Optional[str] = None,
                  material_name: str = 'floor') -> bpy.types.Object:
    """
    Create a square pillar (column).

    Args:
        x, y: Position of pillar center (input units, Inkscape coordinates)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Pillar height (input units), uses floor height if None
        size: Pillar cross-section size (input units), uses wall thickness if None
        name: Optional custom name for the pillar
        material_name: Material to apply (default: 'floor' to match floor slabs)

    Returns:
        Created pillar object
    """
    if height is None:
        height = GLOBAL_CONFIG['floor_heights'].get(floor_number, 10.0)

    if size is None:
        size = GLOBAL_CONFIG['wall_thickness']

    # Generate name
    if name is None:
        pillar_name = f'Pillar_{floor_number}'
    else:
        pillar_name = f'Pillar_{floor_number}_{name}'

    # Z position: pillar sits on top of floor slab
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    z_offset_units = get_floor_z_offset(floor_number) / to_meters(1.0)  # Convert meters back to units
    floor_slab_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    pillar_bottom_z_units = z_offset_units + floor_slab_thickness_units
    center_z_units = pillar_bottom_z_units + height / 2
    pillar_top_z_units = pillar_bottom_z_units + height

    # Convert to Blender coordinates
    location = inkscape_to_blender(x, y, center_z_units)
    dimensions = (to_meters(size), to_meters(size), to_meters(height))

    # Debug output
    print(f"  Pillar '{pillar_name}': {size}×{size}×{height} at ({x}, {y})")
    print(f"    Pillar Z: bottom={to_meters(pillar_bottom_z_units):.2f}m, center={to_meters(center_z_units):.2f}m, top={to_meters(pillar_top_z_units):.2f}m", flush=True)

    # Create pillar
    pillar = create_box(
        pillar_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Structure'
    )

    return pillar

def create_room(name: str, x: float, y: float, width: float, length: float,
                floor_number: int = 0,
                height: Optional[float] = None,
                wall_thickness: Optional[float] = None,
                material_name: str = 'walls',
                walls: Optional[List[str]] = None) -> List[bpy.types.Object]:
    """
    Create a room with specified walls (no floor).

    Args:
        name: Room name
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Wall height (input units), uses floor config if None
        wall_thickness: Wall thickness (input units), uses config default if None
        material_name: Material to apply to walls
        walls: List of walls to create ['north', 'south', 'east', 'west'], or None for all 4

    Returns:
        List of created wall objects
    """
    if wall_thickness is None:
        wall_thickness = GLOBAL_CONFIG['wall_thickness']

    # Default to all 4 walls if not specified
    if walls is None:
        walls = ['north', 'south', 'east', 'west']

    # Convert to lowercase for comparison
    walls = [w.lower() for w in walls]

    collection_name = f"Floor_{floor_number}_{name}"

    # Create specified walls around the perimeter
    # Outer room dimensions (including wall thickness): width × length
    # Room occupies rectangle from (x, y) to (x + width, y + length)
    # Walls are INSIDE this boundary
    # North/South walls span full width, East/West fit between them

    t = wall_thickness
    created_walls = []

    # North wall - outer edge at y, inner edge at y+t
    # Centerline at y + t/2, spans from x to x+width
    if 'north' in walls:
        north_wall = create_wall(
            x, y + t/2,
            x + width, y + t/2,
            floor_number=floor_number,
            height=height,
            thickness=wall_thickness,
            name=f"{name}_North",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(north_wall)

    # South wall - inner edge at y+length-t, outer edge at y+length
    # Centerline at y + length - t/2, spans from x to x+width
    if 'south' in walls:
        south_wall = create_wall(
            x, y + length - t/2,
            x + width, y + length - t/2,
            floor_number=floor_number,
            height=height,
            thickness=wall_thickness,
            name=f"{name}_South",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(south_wall)

    # East wall - inner edge at x+width-t, outer edge at x+width
    # Centerline at x + width - t/2, spans from y+t to y+length-t (fits between N/S)
    if 'east' in walls:
        east_wall = create_wall(
            x + width - t/2, y + t,
            x + width - t/2, y + length - t,
            floor_number=floor_number,
            height=height,
            thickness=wall_thickness,
            name=f"{name}_East",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(east_wall)

    # West wall - outer edge at x, inner edge at x+t
    # Centerline at x + t/2, spans from y+t to y+length-t (fits between N/S)
    if 'west' in walls:
        west_wall = create_wall(
            x + t/2, y + t,
            x + t/2, y + length - t,
            floor_number=floor_number,
            height=height,
            thickness=wall_thickness,
            name=f"{name}_West",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(west_wall)

    walls_str = ', '.join(walls)
    print(f"✓ Created room '{name}': {width}×{length} with walls [{walls_str}] at floor {floor_number}")

    return created_walls

def create_floor_slab(x: float, y: float, width: float, length: float,
                      floor_number: int = 0,
                      thickness: Optional[float] = None,
                      material_name: str = 'floor',
                      name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a rectangular floor slab section.

    Args:
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        thickness: Slab thickness (input units), uses config default if None
        material_name: Material to apply
        name: Optional custom name for the slab

    Returns:
        Created floor slab object
    """
    if thickness is None:
        thickness = GLOBAL_CONFIG['floor_slab_thickness']

    # Center of slab
    center_x = x + width / 2
    center_y = y + length / 2

    # Z position: on top of plinth for ground floor, or on top of previous floor
    # Keep in units until inkscape_to_blender converts to meters
    z_offset_units = get_floor_z_offset(floor_number) / to_meters(1.0)  # Convert meters back to units
    center_z_units = z_offset_units + thickness / 2

    location = inkscape_to_blender(center_x, center_y, center_z_units)
    dimensions = (to_meters(width), to_meters(length), to_meters(thickness))

    # Generate name
    if name is None:
        slab_name = f'Floor_Slab_{floor_number}'
    else:
        slab_name = f'Floor_Slab_{floor_number}_{name}'

    slab = create_box(
        slab_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Structure'
    )

    slab_bottom = location[2] - dimensions[2] / 2
    slab_top = location[2] + dimensions[2] / 2
    print(f"✓ Created floor slab '{slab_name}': {width}×{length}×{thickness} units")
    print(f"  Floor slab Z: bottom={slab_bottom:.3f}m, center={location[2]:.3f}m, top={slab_top:.3f}m", flush=True)
    return slab

def create_staircase(start_x: float, start_y: float,
                     direction: str,
                     num_steps: int,
                     step_width: float,
                     step_tread: float,
                     step_rise: float,
                     floor_number: int = 0,
                     material_name: str = 'floor') -> List[bpy.types.Object]:
    """
    Create a staircase with individual steps along cardinal directions.

    Args:
        start_x, start_y: Bottom left corner of first step (input units, Inkscape coordinates)
        direction: Direction stairs go - 'north', 'south', 'east', or 'west'
        num_steps: Number of steps
        step_width: Width of each step (perpendicular to stair direction, input units)
        step_tread: Depth of each step (along stair direction, input units)
        step_rise: Height of each step (vertical, input units)
        floor_number: Which floor the staircase starts from
        material_name: Material to apply to steps

    Returns:
        List of step objects
    """
    # Map direction to movement vectors
    # In Inkscape coords: X right, Y down
    direction = direction.lower()
    if direction == 'north':
        dir_x, dir_y = 0, -1  # Y decreases going north
        angle = math.radians(90)
    elif direction == 'south':
        dir_x, dir_y = 0, 1   # Y increases going south
        angle = math.radians(-90)
    elif direction == 'east':
        dir_x, dir_y = 1, 0   # X increases going east
        angle = 0
    elif direction == 'west':
        dir_x, dir_y = -1, 0  # X decreases going west
        angle = math.radians(180)
    else:
        print(f"Warning: Invalid direction '{direction}'. Use 'north', 'south', 'east', or 'west'")
        return []

    # Get starting Z position - add floor slab thickness so stairs start above floor
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    z_offset_units = get_floor_z_offset(floor_number) / to_meters(1.0)  # Convert meters back to units
    floor_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    z_start_units = z_offset_units + floor_thickness_units

    print(f"  DEBUG: Staircase starting Z = {z_offset_units:.1f} units + {floor_thickness_units:.1f} units = {z_start_units:.1f} units = {to_meters(z_start_units):.2f}m", flush=True)

    steps = []
    collection_name = f"Floor_{floor_number}_Staircase"

    for i in range(num_steps):
        # Calculate position of this step
        # Center of each step along the stair direction and width
        if direction in ['north', 'south']:
            # Stairs go in Y direction, width is in X direction
            step_center_x = start_x + step_width / 2
            step_center_y = start_y + dir_y * (step_tread * i + step_tread / 2)
        else:  # east or west
            # Stairs go in X direction, width is in Y direction
            step_center_x = start_x + dir_x * (step_tread * i + step_tread / 2)
            step_center_y = start_y + step_width / 2

        # Z position: on floor (above slab) + cumulative rise + half of this step's rise
        step_center_z = z_start_units + step_rise * i + step_rise / 2

        # Convert to Blender coordinates
        location = inkscape_to_blender(step_center_x, step_center_y, step_center_z)

        # Dimensions for create_box: (X_size, Y_size, Z_size)
        # Width is perpendicular to tread direction
        if direction in ['north', 'south']:
            # Stairs go in Y direction: width is X, tread is Y
            blender_x_size = to_meters(step_width)
            blender_y_size = to_meters(step_tread)
        else:  # east or west
            # Stairs go in X direction: tread is X, width is Y
            blender_x_size = to_meters(step_tread)
            blender_y_size = to_meters(step_width)

        dimensions = (blender_x_size, blender_y_size, to_meters(step_rise))

        # Create step box
        step = create_box(
            f'Step_{i+1}',
            location,
            dimensions,
            material_name,
            collection_name
        )

        steps.append(step)

    print(f"✓ Created staircase: {num_steps} steps going {direction}, {step_width}×{step_tread}×{step_rise} each")

    return steps

def create_door(x: float, y: float, width: float, height: float,
                floor_number: int = 0,
                direction: str = 'north',
                wall_name: Optional[str] = None,
                name: Optional[str] = None,
                material_name: str = 'walls') -> bpy.types.Object:
    """
    Create a door opening that cuts through walls using boolean operations.

    Args:
        x, y: Position of door (input units, Inkscape coordinates)
              - For north/south walls: (x, y) is bottom-left corner, door extends in +X direction
              - For east/west walls: (x, y) is top-left corner, door extends in +Y direction
        width: Door width along the wall (input units)
        height: Door height (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        direction: Which wall the door is in - 'north', 'south', 'east', 'west'
        wall_name: Specific wall to cut (e.g., 'Verandah_North'). If None, uses direction to guess.
        name: Optional custom name for the door
        material_name: Material for door frame (if visible)

    Returns:
        Created door opening object (used for boolean subtraction)
    """
    # Get floor Z position
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    z_offset_units = get_floor_z_offset(floor_number) / to_meters(1.0)  # Convert meters back to units
    floor_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    wall_thickness = GLOBAL_CONFIG['wall_thickness']

    # Door starts at floor level (on top of slab)
    z_start_units = z_offset_units + floor_thickness_units
    center_z_units = z_start_units + height / 2

    # Make the opening slightly larger than wall thickness to ensure clean cut
    depth = wall_thickness * 1.5

    # Position and dimensions depend on which wall the door is in
    direction = direction.lower()
    if direction in ['north', 'south']:
        # Door in horizontal wall (north/south)
        # (x, y) is bottom-left corner of door, door width extends in +X direction
        # y is the wall's Y position (north/south coordinate)
        center_x = x + width / 2
        center_y = y + wall_thickness / 2
        dimensions = (to_meters(width), to_meters(depth), to_meters(height))
    else:  # east or west
        # Door in vertical wall (east/west)
        # (x, y) is top-left corner of door, door width extends in +Y direction (downward in Inkscape)
        # x is the wall's X position (east/west coordinate)
        # y is where the door starts along the wall
        center_x = x + wall_thickness / 2
        center_y = y + width / 2
        dimensions = (to_meters(depth), to_meters(width), to_meters(height))

    location = inkscape_to_blender(center_x, center_y, center_z_units)

    # Generate name
    if name is None:
        door_name = f'Door_{floor_number}'
    else:
        door_name = f'Door_{floor_number}_{name}'

    door = create_box(
        door_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Openings'
    )

    print(f"  Door location: ({location[0]:.2f}, {location[1]:.2f}, {location[2]:.2f}), dimensions: ({dimensions[0]:.2f}, {dimensions[1]:.2f}, {dimensions[2]:.2f})", flush=True)

    # Hide the door object (it's just for boolean operations)
    door.hide_viewport = True
    door.hide_render = True

    # Store the wall name as a custom property for later use in apply_openings_to_walls
    if wall_name:
        door['target_wall'] = wall_name

    print(f"✓ Created door opening '{door_name}': {width}×{height} at ({x}, {y}) facing {direction}")
    if wall_name:
        print(f"  Target wall: {wall_name}")
    return door

def create_window(x: float, y: float, width: float, height: float,
                  floor_number: int = 0,
                  sill_height: Optional[float] = None,
                  direction: str = 'north',
                  wall_name: Optional[str] = None,
                  name: Optional[str] = None,
                  material_name: str = 'walls') -> bpy.types.Object:
    """
    Create a window opening that cuts through walls using boolean operations.

    Args:
        x, y: Bottom left corner of window (input units, Inkscape coordinates)
        width: Window width (input units)
        height: Window height (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        sill_height: Height of window sill from floor (input units), default is 3 feet
        direction: Which wall the window is in - 'north', 'south', 'east', 'west'
        wall_name: Specific wall to cut (e.g., 'Verandah_North'). If None, uses direction to guess.
        name: Optional custom name for the window
        material_name: Material for window frame (if visible)

    Returns:
        Created window opening object (used for boolean subtraction)
    """
    if sill_height is None:
        sill_height = 30.0  # Default 3 feet from floor (30 units = 3 feet)

    # Get floor Z position
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    z_offset_units = get_floor_z_offset(floor_number) / to_meters(1.0)  # Convert meters back to units
    floor_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    wall_thickness = GLOBAL_CONFIG['wall_thickness']

    # Window starts at sill height above floor
    z_start_units = z_offset_units + floor_thickness_units + sill_height
    center_z_units = z_start_units + height / 2

    # Make the opening slightly larger than wall thickness to ensure clean cut
    depth = wall_thickness * 1.5

    # Position and dimensions depend on which wall the window is in
    direction = direction.lower()
    if direction in ['north', 'south']:
        # Window in horizontal wall (north/south)
        center_x = x + width / 2
        center_y = y + wall_thickness / 2
        dimensions = (to_meters(width), to_meters(depth), to_meters(height))
    else:  # east or west
        # Window in vertical wall (east/west)
        center_x = x + wall_thickness / 2
        center_y = y + width / 2
        dimensions = (to_meters(depth), to_meters(width), to_meters(height))

    location = inkscape_to_blender(center_x, center_y, center_z_units)

    # Generate name
    if name is None:
        window_name = f'Window_{floor_number}'
    else:
        window_name = f'Window_{floor_number}_{name}'

    window = create_box(
        window_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Openings'
    )

    # Hide the window object (it's just for boolean operations)
    window.hide_viewport = True
    window.hide_render = True

    # Store the wall name as a custom property for later use in apply_openings_to_walls
    if wall_name:
        window['target_wall'] = wall_name

    print(f"✓ Created window opening '{window_name}': {width}×{height} at sill height {sill_height}")
    if wall_name:
        print(f"  Target wall: {wall_name}")
    return window

def apply_openings_to_walls(floor_number: int):
    """
    Apply boolean operations to cut door and window openings from walls.
    Should be called after all walls, doors, and windows are created for a floor.

    Args:
        floor_number: Which floor to process
    """
    # Find all openings for this floor
    openings = []
    for obj in bpy.data.objects:
        # Check for openings
        if obj.name.startswith(f'Door_{floor_number}') or obj.name.startswith(f'Window_{floor_number}'):
            openings.append(obj)
            target_wall = obj.get('target_wall', 'Not specified')
            print(f"  Found opening: {obj.name} -> target wall: {target_wall}", flush=True)

    if len(openings) == 0:
        print(f"  No openings to apply on floor {floor_number}")
        return

    modifiers_applied = 0

    # Process each opening
    for opening in openings:
        # Check if this opening has a target wall specified
        target_wall_name = opening.get('target_wall')

        if not target_wall_name:
            print(f"  ⚠ Warning: Opening '{opening.name}' has no target_wall specified - skipping", flush=True)
            continue

        # Find the wall object
        wall = bpy.data.objects.get(target_wall_name)

        if not wall:
            print(f"  ✗ Error: Wall '{target_wall_name}' not found for opening '{opening.name}'", flush=True)
            continue

        # Add boolean modifier to wall
        mod = wall.modifiers.new(name=f'Cut_{opening.name}', type='BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = opening
        mod.solver = 'EXACT'  # Use EXACT solver for better reliability

        # Apply the modifier immediately to make the cut permanent
        # First, select the wall and make it active
        bpy.context.view_layer.objects.active = wall
        bpy.ops.object.select_all(action='DESELECT')
        wall.select_set(True)

        # Apply the modifier
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
            print(f"  ✓ Cut opening '{opening.name}' from wall '{wall.name}'", flush=True)
            modifiers_applied += 1
        except Exception as e:
            print(f"  ✗ Failed to apply opening '{opening.name}' to wall '{wall.name}': {e}", flush=True)

    print(f"✓ Applied {modifiers_applied} boolean operations on floor {floor_number}", flush=True)

def create_gable_roof(ridge_start_x: float, ridge_start_y: float, ridge_z: float,
                      ridge_length: float,
                      left_slope_angle: float, left_slope_length: float,
                      right_slope_angle: float, right_slope_length: float,
                      material_name: str = 'roof') -> bpy.types.Object:
    """
    Create a gable roof with potentially asymmetric slopes.
    
    The ridge runs parallel to the X axis (perpendicular to Y).
    Slopes extend in the +Y and -Y directions.
    
    Args:
        ridge_start_x, ridge_start_y: Start point of ridge (input units, Inkscape coords)
        ridge_z: Height of ridge above ground (input units)
        ridge_length: Length of ridge in X direction (input units)
        left_slope_angle: Angle of left slope in degrees (0-90)
        left_slope_length: Length of left slope (input units)
        right_slope_angle: Angle of right slope in degrees (0-90)
        right_slope_length: Length of right slope (input units)
        material_name: Material to apply
    
    Returns:
        Created roof mesh object
    """
    # Convert angles to radians
    left_angle_rad = math.radians(left_slope_angle)
    right_angle_rad = math.radians(right_slope_angle)
    
    # Calculate horizontal projections of slopes
    left_horizontal = left_slope_length * math.cos(left_angle_rad)
    right_horizontal = right_slope_length * math.cos(right_angle_rad)
    
    # Calculate vertical drops
    left_drop = left_slope_length * math.sin(left_angle_rad)
    right_drop = right_slope_length * math.sin(right_angle_rad)
    
    # Define vertices for the gable roof
    # We'll create 6 vertices forming a triangular cross-section extruded along ridge
    
    # Ridge points (top)
    ridge_end_x = ridge_start_x + ridge_length
    
    # Left edge points (bottom of left slope)
    left_edge_y = ridge_start_y - left_horizontal
    left_edge_z = ridge_z - left_drop
    
    # Right edge points (bottom of right slope)
    right_edge_y = ridge_start_y + right_horizontal
    right_edge_z = ridge_z - right_drop
    
    # Convert all points to Blender coordinates
    vertices = [
        # Front triangle (at X = ridge_start_x)
        inkscape_to_blender(ridge_start_x, left_edge_y, left_edge_z),      # 0: left bottom
        inkscape_to_blender(ridge_start_x, ridge_start_y, ridge_z),         # 1: ridge top
        inkscape_to_blender(ridge_start_x, right_edge_y, right_edge_z),    # 2: right bottom
        
        # Back triangle (at X = ridge_end_x)
        inkscape_to_blender(ridge_end_x, left_edge_y, left_edge_z),        # 3: left bottom
        inkscape_to_blender(ridge_end_x, ridge_start_y, ridge_z),           # 4: ridge top
        inkscape_to_blender(ridge_end_x, right_edge_y, right_edge_z),      # 5: right bottom
    ]
    
    # Define faces
    faces = [
        # Left slope
        [0, 1, 4, 3],
        # Right slope
        [1, 2, 5, 4],
        # Front gable end
        [0, 1, 2],
        # Back gable end
        [3, 4, 5],
        # Bottom (optional, for closed mesh)
        [0, 3, 5, 2],
    ]
    
    # Create mesh
    mesh = bpy.data.meshes.new('Gable_Roof_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    
    # Create object
    roof_obj = bpy.data.objects.new('Gable_Roof', mesh)
    bpy.context.collection.objects.link(roof_obj)
    
    # Apply material
    if material_name in bpy.data.materials:
        roof_obj.data.materials.append(bpy.data.materials[material_name])
    
    # Add to collection
    add_to_collection(roof_obj, 'Roof')
    
    print(f"✓ Created gable roof: ridge_length={ridge_length}, "
          f"left={left_slope_angle}°/{left_slope_length}, "
          f"right={right_slope_angle}°/{right_slope_length}")
    
    return roof_obj

# ============================================================================
# SCENE SETUP
# ============================================================================

def clear_scene():
    """Clear all objects, meshes, materials, and collections from the scene"""
    # Unhide all objects first to ensure they can be deleted
    for obj in bpy.data.objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False

    # Select and delete all objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clear all mesh data
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

    # Clear all materials
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)

    # Clear collections except default
    for collection in bpy.data.collections:
        bpy.data.collections.remove(collection)

    print("✓ Scene cleared (all objects, meshes, materials, and collections deleted)", flush=True)

def setup_camera_and_lighting(bounds: Dict[str, float]):
    """
    Set up camera and lighting for the scene.
    
    Args:
        bounds: Dictionary with 'min_x', 'max_x', 'min_y', 'max_y', 'max_z' in input units
    """
    # Convert bounds to Blender coordinates
    center_x = (bounds['min_x'] + bounds['max_x']) / 2
    center_y = (bounds['min_y'] + bounds['max_y']) / 2
    center = inkscape_to_blender(center_x, center_y, bounds['max_z'] / 2)
    
    width = to_meters(bounds['max_x'] - bounds['min_x'])
    depth = to_meters(bounds['max_y'] - bounds['min_y'])
    
    # Camera
    camera_distance = max(width, depth) * 1.5
    cam_location = (center[0], center[1] - camera_distance, center[2] + camera_distance * 0.5)
    bpy.ops.object.camera_add(location=cam_location)
    camera = bpy.context.active_object
    camera.rotation_euler = (math.radians(60), 0, 0)
    bpy.context.scene.camera = camera
    
    # Sun light
    bpy.ops.object.light_add(type='SUN', location=(center[0], center[1], 20))
    sun = bpy.context.active_object
    sun.data.energy = 2.0
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    
    # Area light from above
    bpy.ops.object.light_add(type='AREA', location=(center[0], center[1], center[2] + 10))
    area_light = bpy.context.active_object
    area_light.data.energy = 500
    area_light.data.size = 5

def configure_render():
    """Configure render settings"""
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 128
    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080

    # Set viewport shading
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    # Set to solid shading with object colors
                    space.shading.type = 'SOLID'
                    space.shading.color_type = 'OBJECT'
                    # Or use 'MATERIAL' for material preview mode
                    # space.shading.type = 'MATERIAL'

# ============================================================================
# INITIALIZATION
# ============================================================================

def init_scene():
    """Initialize scene with materials and settings"""
    # Reduce Blender's verbose logging
    import logging
    import sys
    logging.getLogger("bpy").setLevel(logging.WARNING)

    # Force stdout to flush immediately so prints appear right away
    sys.stdout.flush()

    clear_scene()
    initialize_materials()

    print("\n" + "="*70, flush=True)
    print("✓ Scene initialized", flush=True)
    print(f"  Units: {GLOBAL_CONFIG['units_to_meters_ratio']} m per unit", flush=True)
    print(f"  Scale factor: {GLOBAL_CONFIG['scale_factor']}x", flush=True)
    print(f"  Ground level Z: {GLOBAL_CONFIG['ground_level_z']} m", flush=True)
    print("="*70 + "\n", flush=True)

def export_to_web(filepath: str = None):
    """
    Export the Blender model to docs/konkan_house.glb for web viewing.
    Static HTML files are already in the docs/ folder.

    Args:
        filepath: Path to save the file. If None, saves to docs/konkan_house.glb

    Returns:
        Path to the exported file
    """
    import os

    if filepath is None:
        # Get the blend file directory
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            # If blend file not saved, use current working directory
            blend_dir = os.getcwd()

        # Export to docs folder
        docs_dir = os.path.join(blend_dir, "docs")
        os.makedirs(docs_dir, exist_ok=True)
        filepath = os.path.join(docs_dir, "konkan_house.glb")

    print("\n" + "="*70, flush=True)
    print("EXPORTING MODEL FOR WEB", flush=True)
    print("="*70, flush=True)

    # Step 1: Apply all boolean modifiers to wall objects
    print("Applying boolean modifiers to walls...", flush=True)
    walls_processed = 0
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and not obj.hide_viewport:
            # Check if object has boolean modifiers
            has_booleans = any(mod.type == 'BOOLEAN' for mod in obj.modifiers)
            if has_booleans:
                # Select the object
                bpy.ops.object.select_all(action='DESELECT')
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)

                # Apply all modifiers
                for modifier in obj.modifiers:
                    try:
                        bpy.ops.object.modifier_apply(modifier=modifier.name)
                        walls_processed += 1
                    except Exception as e:
                        print(f"  Warning: Could not apply modifier {modifier.name} on {obj.name}: {e}", flush=True)

    print(f"  Applied {walls_processed} boolean modifiers", flush=True)

    # Step 2: Delete all hidden objects (door/window cutters)
    print("Removing boolean cutter objects...", flush=True)
    cutters_removed = 0
    objects_to_remove = []
    for obj in bpy.data.objects:
        if obj.hide_viewport or obj.hide_render:
            objects_to_remove.append(obj)

    for obj in objects_to_remove:
        bpy.data.objects.remove(obj, do_unlink=True)
        cutters_removed += 1

    print(f"  Removed {cutters_removed} cutter objects", flush=True)

    # Step 3: Apply flat shading to all remaining mesh objects
    print("Applying flat shading...", flush=True)
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            # Select the object
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)

            # Apply flat shading for sharp architectural edges
            bpy.ops.object.shade_flat()

            # Enable auto-smooth for better edge definition
            if hasattr(obj.data, 'use_auto_smooth'):
                obj.data.use_auto_smooth = True
                obj.data.auto_smooth_angle = 0.523599  # 30 degrees in radians

    # Step 4: Export as GLB
    print("Exporting to GLB format...", flush=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_apply=False,  # Already applied modifiers manually
        export_normals=True,  # Export vertex normals
        export_tangents=True  # Export tangents for lighting
    )

    file_size = os.path.getsize(filepath) / 1024
    print(f"✓ Model exported to: {filepath}", flush=True)
    print(f"  Format: GLB (binary glTF)", flush=True)
    print(f"  File size: {file_size:.1f} KB", flush=True)

    # Check if static files exist
    docs_dir = os.path.dirname(filepath)
    html_path = os.path.join(docs_dir, 'index.html')

    if os.path.exists(html_path):
        print(f"\n✓ Viewer ready at: {html_path}", flush=True)
        print(f"  Open this file in a web browser to view your model", flush=True)
    else:
        print(f"\n⚠ Note: index.html not found in docs/ folder", flush=True)
        print(f"  The static viewer files should be in the docs/ folder", flush=True)

    print("="*70 + "\n", flush=True)

    return filepath

def _create_html_viewer(html_path: str, model_filename: str):
    """Create a standalone HTML file with model viewer"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Konkan House - 3D Model Viewer</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }}
        header {{
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 100;
        }}
        h1 {{
            color: #333;
            font-size: 1.5rem;
            font-weight: 600;
        }}
        .subtitle {{
            color: #666;
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }}
        #viewer-container {{
            flex: 1;
            position: relative;
        }}
        model-viewer {{
            width: 100%;
            height: 100%;
            background-color: #f0f0f0;
        }}
        .controls {{
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 1.5rem;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            gap: 1rem;
            align-items: center;
            z-index: 10;
        }}
        button {{
            background: #667eea;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.3s ease;
        }}
        button:hover {{
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }}
        .loading {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #333;
            font-size: 1.2rem;
            background: white;
            padding: 2rem 3rem;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }}
    </style>
    <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
</head>
<body>
    <header>
        <h1>🏠 Konkan House</h1>
        <div class="subtitle">3D Interactive Model Viewer</div>
    </header>

    <div id="viewer-container">
        <div class="loading" id="loading">Loading 3D model...</div>

        <model-viewer
            id="model"
            src="{model_filename}"
            alt="Konkan House 3D Model"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            camera-orbit="45deg 75deg 50m"
            min-camera-orbit="auto auto 10m"
            max-camera-orbit="auto auto 200m"
            field-of-view="30deg">

            <div class="controls" slot="controls">
                <button onclick="document.getElementById('model').cameraOrbit = '0deg 90deg 50m'">Top View</button>
                <button onclick="document.getElementById('model').cameraOrbit = '0deg 75deg 50m'">Front View</button>
                <button onclick="document.getElementById('model').cameraOrbit = '90deg 75deg 50m'">Side View</button>
                <button onclick="document.getElementById('model').cameraOrbit = '45deg 75deg 50m'">Reset</button>
                <button onclick="toggleAutoRotate()">
                    <span id="rotate-text">⏸ Pause</span>
                </button>
            </div>
        </model-viewer>
    </div>

    <script>
        const modelViewer = document.getElementById('model');
        const loading = document.getElementById('loading');

        // Hide loading message when model loads
        modelViewer.addEventListener('load', () => {{
            loading.style.display = 'none';
        }});

        // Handle loading errors
        modelViewer.addEventListener('error', (event) => {{
            loading.innerHTML = '❌ Error loading model. Please check the file path.';
            loading.style.color = '#d32f2f';
        }});

        // Toggle auto-rotate
        function toggleAutoRotate() {{
            const rotateText = document.getElementById('rotate-text');
            if (modelViewer.autoRotate) {{
                modelViewer.autoRotate = false;
                rotateText.textContent = '▶ Play';
            }} else {{
                modelViewer.autoRotate = true;
                rotateText.textContent = '⏸ Pause';
            }}
        }}
    </script>
</body>
</html>"""

    with open(html_path, 'w') as f:
        f.write(html_content)

def _create_readme(readme_path: str):
    """Create a README.md for the docs folder"""

    readme_content = """# Konkan House - 3D Model Viewer

This folder contains the interactive 3D model viewer for the Konkan House project.

## 🏠 View the Model

**[Open Interactive 3D Viewer](https://YOUR_USERNAME.github.io/YOUR_REPO/)**

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repository name.

## 📁 Files

- **index.html** - Interactive web viewer with controls
- **konkan_house.glb** - 3D model file (glTF binary format)

## 🎮 Viewer Controls

- **Mouse Drag** - Rotate the model
- **Scroll Wheel** - Zoom in/out
- **View Buttons** - Quick camera presets (Top, Front, Side)
- **Auto-Rotate** - Toggle automatic rotation

## 🚀 Local Testing

To view locally:
1. Open `index.html` in any modern web browser
2. The model will load automatically

## 🔧 Technical Details

- **Format**: glTF 2.0 (GLB - binary)
- **Viewer**: Google Model Viewer
- **Browser Support**: Chrome, Firefox, Safari, Edge (modern versions)
- **No plugins required**: Works directly in the browser

## 📝 About

This 3D model was generated using Blender and Python automation scripts.
The house design represents a traditional Konkan-style architecture with modern features.

---

Generated by Konkan House Builder
"""

    with open(readme_path, 'w') as f:
        f.write(readme_content)

def setup_web_viewer(docs_dir: str = None):
    """
    One-time setup: Create static web viewer files.
    Only needs to be run once or when you want to update the HTML/README.

    Args:
        docs_dir: Path to docs folder. If None, creates in current directory.

    Usage:
        setup_web_viewer()  # Creates docs/ folder with static files
    """
    import os

    if docs_dir is None:
        # Get the blend file directory
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            blend_dir = os.getcwd()

        docs_dir = os.path.join(blend_dir, "docs")

    # Create docs directory
    os.makedirs(docs_dir, exist_ok=True)

    print("\n" + "="*70)
    print("SETTING UP WEB VIEWER")
    print("="*70)

    # Create static files
    html_path = os.path.join(docs_dir, 'index.html')
    readme_path = os.path.join(docs_dir, 'README.md')

    # Model filename (will be created by export_to_web)
    model_filename = "konkan_house.glb"

    _create_html_viewer(html_path, model_filename)
    print(f"✓ Created: {html_path}")

    _create_readme(readme_path)
    print(f"✓ Created: {readme_path}")

    print(f"\n📁 Setup complete! Directory: {docs_dir}")
    print(f"   Run export_to_web() to create the 3D model file.")
    print("="*70 + "\n")

    return docs_dir

print("Konkan House Library loaded successfully!")
