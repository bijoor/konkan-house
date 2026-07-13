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

    # Model origin (center of plinth - will be set from house config)
    'model_origin_offset_x': 0.0,      # X offset to center model
    'model_origin_offset_y': 0.0,      # Y offset to center model
    
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
    },

    # SVG Dimension Configuration
    'dimensions': {
        'show_outer_dimensions': True,      # Show building perimeter dimensions
        'show_inner_dimensions': True,      # Show interior wall dimensions
        'show_room_dimensions': True,       # Show room size labels (Width × Length)
        'show_opening_dimensions': True,    # Show door/window dimensions
        'dimension_offset': 30,             # Distance from building edge (in input units)
        'dimension_offset_increment': 20,   # Additional offset for each stacked dimension level
        'inner_dimension_offset': 15,       # Offset for interior dimensions
        'opening_dimension_offset': 8,      # Offset for door/window dimensions
        'min_dimension_length': 20,         # Don't dimension edges shorter than this
        'unit_display': 'feet',             # Display unit name
        'unit_conversion': 10.0,            # Conversion factor (10 units = 1 foot)
        'precision': 1,                     # Decimal places for dimensions
        'text_size': 10,                    # Font size for dimension text
        'room_text_size': 12,               # Font size for room labels
        'opening_text_size': 8,             # Font size for door/window dimensions
    },

    # Elevation View Rendering Order Configuration
    # When objects have the same depth coordinate, this priority determines rendering order
    # Lower number = drawn first (appears underneath)
    # Default order: beam < floor_slab < wall/room < pillar
    'elevation_rendering_priority': {
        'beam': 0,
        'floor_slab': 1,
        'room': 2,
        'wall': 2,
        'pillar': 3
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
    Model is centered at the plinth center for symmetric 3D visualization.

    Args:
        x: Horizontal position (right positive)
        y: Vertical position (down positive in Inkscape)
        z: Height (up positive)

    Returns:
        Tuple of (blender_x, blender_y, blender_z) in meters
    """
    # Apply origin offset to center model at plinth center
    centered_x = x - GLOBAL_CONFIG['model_origin_offset_x']
    centered_y = y - GLOBAL_CONFIG['model_origin_offset_y']

    blender_x = to_meters(centered_x)
    blender_y = to_meters(-centered_y)  # Flip Y axis
    blender_z = to_meters(z) + GLOBAL_CONFIG['ground_level_z']
    return (blender_x, blender_y, blender_z)

def set_model_origin_from_plinth(plinth_config: dict):
    """
    Set the model origin to the center of the plinth for symmetric 3D visualization.
    This only affects the 3D model; SVG floor plans use original coordinates.

    Args:
        plinth_config: Dictionary with 'x', 'y', 'width', 'length' keys
        Note: width is X-direction, length is Y-direction
    """
    # width is X-direction, length is Y-direction
    center_x = plinth_config['x'] + plinth_config['width'] / 2.0
    center_y = plinth_config['y'] + plinth_config['length'] / 2.0

    GLOBAL_CONFIG['model_origin_offset_x'] = center_x
    GLOBAL_CONFIG['model_origin_offset_y'] = center_y

    print(f"Model origin set to plinth center: ({center_x:.1f}, {center_y:.1f})")

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
                walls: Optional[List[str]] = None,
                wall_heights: Optional[dict] = None) -> List[bpy.types.Object]:
    """
    Create a room with specified walls (no floor).

    Args:
        name: Room name
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Default wall height (input units), uses floor config if None
        wall_thickness: Wall thickness (input units), uses config default if None
        material_name: Material to apply to walls
        walls: List of walls to create ['north', 'south', 'east', 'west'], or None for all 4
        wall_heights: Optional dict with individual wall heights, e.g.:
                     {'north': 100, 'south': 150, 'east': {'start': 100, 'end': 150}, 'west': 120}
                     Can specify single height or {'start': height1, 'end': height2} for sloped walls

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

    # Helper function to get wall height
    def get_wall_height(wall_name: str):
        """Get height for a specific wall, returns (height, height_end)"""
        if wall_heights and wall_name in wall_heights:
            wall_config = wall_heights[wall_name]
            if isinstance(wall_config, dict):
                # Sloped wall: {'start': h1, 'end': h2}
                return wall_config.get('start', height), wall_config.get('end', height)
            else:
                # Single height value
                return wall_config, None
        return height, None

    # North wall - outer edge at y, inner edge at y+t
    # Centerline at y + t/2, spans from x to x+width
    if 'north' in walls:
        wall_height, wall_height_end = get_wall_height('north')
        north_wall = create_wall(
            x, y + t/2,
            x + width, y + t/2,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_North",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(north_wall)

    # South wall - inner edge at y+length-t, outer edge at y+length
    # Centerline at y + length - t/2, spans from x to x+width
    if 'south' in walls:
        wall_height, wall_height_end = get_wall_height('south')
        south_wall = create_wall(
            x, y + length - t/2,
            x + width, y + length - t/2,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_South",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(south_wall)

    # East wall - inner edge at x+width-t, outer edge at x+width
    # Centerline at x + width - t/2, spans from y+t to y+length-t (fits between N/S)
    if 'east' in walls:
        wall_height, wall_height_end = get_wall_height('east')
        east_wall = create_wall(
            x + width - t/2, y + t,
            x + width - t/2, y + length - t,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_East",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(east_wall)

    # West wall - outer edge at x, inner edge at x+t
    # Centerline at x + t/2, spans from y+t to y+length-t (fits between N/S)
    if 'west' in walls:
        wall_height, wall_height_end = get_wall_height('west')
        west_wall = create_wall(
            x + t/2, y + t,
            x + t/2, y + length - t,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
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


def create_beam(x: float, y: float, width: float, length: float,
                floor_number: int = 0,
                thickness: Optional[float] = None,
                material_name: str = 'beam',
                name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a structural beam (horizontal element with wall thickness).

    Args:
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        thickness: Beam vertical thickness (input units), uses wall_thickness if None
        material_name: Material to apply
        name: Optional custom name for the beam

    Returns:
        Created beam object
    """
    if thickness is None:
        thickness = GLOBAL_CONFIG['wall_thickness']

    # Center of beam
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
        beam_name = f'Beam_{floor_number}'
    else:
        beam_name = f'Beam_{floor_number}_{name}'

    beam = create_box(
        beam_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Structure'
    )

    beam_bottom = location[2] - dimensions[2] / 2
    beam_top = location[2] + dimensions[2] / 2
    print(f"✓ Created beam '{beam_name}': {width}×{length}×{thickness} units")
    print(f"  Beam Z: bottom={beam_bottom:.3f}m, center={location[2]:.3f}m, top={beam_top:.3f}m", flush=True)
    return beam


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


# ============================================================================
# SVG FLOOR PLAN GENERATION
# ============================================================================

def svg_draw_wall(start_x: float, start_y: float, end_x: float, end_y: float,
                  thickness: float, color: str = "#8B4513") -> str:
    """
    Generate SVG for a wall (top view).

    Args:
        start_x, start_y: Wall start point
        end_x, end_y: Wall end point
        thickness: Wall thickness
        color: Wall fill color

    Returns:
        SVG path string
    """
    # Calculate perpendicular offset for thickness
    import math
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.sqrt(dx*dx + dy*dy)

    if length == 0:
        return ""

    # Perpendicular unit vector
    px = -dy / length
    py = dx / length

    # Wall corners
    offset = thickness / 2
    x1 = start_x + px * offset
    y1 = start_y + py * offset
    x2 = start_x - px * offset
    y2 = start_y - py * offset
    x3 = end_x - px * offset
    y3 = end_y - py * offset
    x4 = end_x + px * offset
    y4 = end_y + py * offset

    return f'<polygon points="{x1},{y1} {x4},{y4} {x3},{y3} {x2},{y2}" fill="{color}" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_room(x: float, y: float, width: float, length: float,
                  thickness: float, name: str = "",
                  walls: list = None) -> str:
    """
    Generate SVG for a room (top view).

    Args:
        x, y: Top-left corner
        width, length: Room dimensions
        thickness: Wall thickness
        name: Room name for label
        walls: List of walls to draw ['north', 'south', 'east', 'west']

    Returns:
        SVG string with walls and label
    """
    if walls is None:
        walls = ['north', 'south', 'east', 'west']

    walls = [w.lower() for w in walls]
    svg = ""
    t = thickness

    # North wall
    if 'north' in walls:
        svg += svg_draw_wall(x, y + t/2, x + width, y + t/2, thickness)

    # South wall
    if 'south' in walls:
        svg += svg_draw_wall(x, y + length - t/2, x + width, y + length - t/2, thickness)

    # East wall
    if 'east' in walls:
        svg += svg_draw_wall(x + width - t/2, y + t, x + width - t/2, y + length - t, thickness)

    # West wall
    if 'west' in walls:
        svg += svg_draw_wall(x + t/2, y + t, x + t/2, y + length - t, thickness)

    # Room label is now added separately with dimensions, so we don't add it here

    return svg


def svg_draw_door(x: float, y: float, width: float, direction: str = 'north') -> str:
    """
    Generate SVG for a door (top view).

    Args:
        x, y: Door position
        width: Door width
        direction: Door direction ('north', 'south', 'east', 'west')

    Returns:
        SVG string
    """
    direction = direction.lower()

    if direction in ['north', 'south']:
        # Horizontal door
        return f'<rect x="{x}" y="{y-2}" width="{width}" height="4" fill="#A0522D" stroke="#000" stroke-width="0.5"/>\n'
    else:
        # Vertical door
        return f'<rect x="{x-2}" y="{y}" width="4" height="{width}" fill="#A0522D" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_window(x: float, y: float, width: float, direction: str = 'north') -> str:
    """
    Generate SVG for a window (top view).

    Args:
        x, y: Window position
        width: Window width
        direction: Window direction ('north', 'south', 'east', 'west')

    Returns:
        SVG string
    """
    direction = direction.lower()

    if direction in ['north', 'south']:
        # Horizontal window
        return f'<rect x="{x}" y="{y-1}" width="{width}" height="2" fill="#87CEEB" stroke="#000" stroke-width="0.5"/>\n'
    else:
        # Vertical window
        return f'<rect x="{x-1}" y="{y}" width="2" height="{width}" fill="#87CEEB" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_floor_slab(x: float, y: float, width: float, length: float) -> str:
    """
    Generate SVG for a floor slab (top view).

    Args:
        x, y: Top-left corner
        width, length: Slab dimensions

    Returns:
        SVG string
    """
    return f'<rect x="{x}" y="{y}" width="{width}" height="{length}" fill="#D3D3D3" stroke="#999" stroke-width="1" opacity="0.6"/>\n'


def svg_draw_pillar(x: float, y: float, size: float = None) -> str:
    """
    Generate SVG for a pillar (top view).

    Args:
        x, y: Center position of pillar
        size: Pillar size (width/height), uses default if None

    Returns:
        SVG string
    """
    if size is None:
        size = GLOBAL_CONFIG.get('wall_thickness', 8)  # Default: same as wall thickness

    # Draw pillar as a filled square centered at (x, y)
    pillar_x = x - size / 2
    pillar_y = y - size / 2

    return f'<rect x="{pillar_x}" y="{pillar_y}" width="{size}" height="{size}" fill="#000" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_beam(x: float, y: float, width: float, length: float) -> str:
    """
    Generate SVG for a beam (top view).

    Beams are structural horizontal elements, similar to floor slabs but with
    wall thickness and distinct color.

    Args:
        x, y: Top-left corner
        width, length: Beam dimensions

    Returns:
        SVG string
    """
    # Use a brown/wood color to distinguish from floor slabs
    return f'<rect x="{x}" y="{y}" width="{width}" height="{length}" fill="#8B4513" stroke="#654321" stroke-width="1" opacity="0.8"/>\n'


# ============================================================================
# DIMENSIONING FUNCTIONS
# ============================================================================

def format_dimension(length: float) -> str:
    """
    Format a dimension value according to config settings.

    Args:
        length: Length in input units

    Returns:
        Formatted string like "20.5'" or "20.5 feet"
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    converted = length / dim_config['unit_conversion']
    precision = dim_config['precision']
    unit = dim_config['unit_display']

    formatted_value = f"{converted:.{precision}f}"
    return f"{formatted_value}'{'' if unit == 'feet' else ' ' + unit}"


def normalize_edge_key(x1: float, y1: float, x2: float, y2: float) -> tuple:
    """
    Create a normalized key for an edge (independent of direction).

    Args:
        x1, y1: Start point
        x2, y2: End point

    Returns:
        Tuple that's the same regardless of edge direction
    """
    # Sort points to create canonical representation
    if (x1, y1) <= (x2, y2):
        return (round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2))
    else:
        return (round(x2, 2), round(y2, 2), round(x1, 2), round(y1, 2))


def extract_floor_edges(floor_config: dict) -> dict:
    """
    Extract all edges from floor configuration.

    Returns:
        Dictionary with 'horizontal' and 'vertical' edge lists
    """
    edges = {'horizontal': {}, 'vertical': {}}

    if 'objects' not in floor_config:
        return edges

    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    for obj in floor_config['objects']:
        obj_type = obj.get('type')

        if obj_type == 'room':
            x, y = obj['x'], obj['y']
            w, h = obj['width'], obj['length']
            t = obj.get('wall_thickness', wall_thickness)
            walls = obj.get('walls', ['north', 'south', 'east', 'west'])
            walls = [w_name.lower() for w_name in walls]

            # North wall (horizontal)
            if 'north' in walls:
                key = normalize_edge_key(x, y, x + w, y)
                edges['horizontal'][key] = {'x1': x, 'y1': y, 'x2': x + w, 'y2': y, 'source': f"{obj['name']}_North"}

            # South wall (horizontal)
            if 'south' in walls:
                key = normalize_edge_key(x, y + h, x + w, y + h)
                edges['horizontal'][key] = {'x1': x, 'y1': y + h, 'x2': x + w, 'y2': y + h, 'source': f"{obj['name']}_South"}

            # East wall (vertical)
            if 'east' in walls:
                key = normalize_edge_key(x + w, y, x + w, y + h)
                edges['vertical'][key] = {'x1': x + w, 'y1': y, 'x2': x + w, 'y2': y + h, 'source': f"{obj['name']}_East"}

            # West wall (vertical)
            if 'west' in walls:
                key = normalize_edge_key(x, y, x, y + h)
                edges['vertical'][key] = {'x1': x, 'y1': y, 'x2': x, 'y2': y + h, 'source': f"{obj['name']}_West"}

        elif obj_type == 'wall':
            x1, y1 = obj['start_x'], obj['start_y']
            x2, y2 = obj['end_x'], obj['end_y']

            # Determine if horizontal or vertical
            if abs(y2 - y1) < 0.01:  # Horizontal wall
                key = normalize_edge_key(x1, y1, x2, y2)
                edges['horizontal'][key] = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'source': obj.get('name', 'Wall')}
            elif abs(x2 - x1) < 0.01:  # Vertical wall
                key = normalize_edge_key(x1, y1, x2, y2)
                edges['vertical'][key] = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'source': obj.get('name', 'Wall')}

    return edges


def classify_perimeter_edges(edges: dict, bounds: dict) -> dict:
    """
    Classify which edges are on the building perimeter.

    Args:
        edges: Dictionary with 'horizontal' and 'vertical' edge dictionaries
        bounds: Bounding box dict with min_x, max_x, min_y, max_y

    Returns:
        Dictionary with perimeter edges classified by side
    """
    tolerance = 2.0  # Tolerance for considering an edge on the perimeter
    perimeter = {'north': [], 'south': [], 'east': [], 'west': []}

    # Horizontal edges
    for edge in edges['horizontal'].values():
        y = edge['y1']
        # North (top)
        if abs(y - bounds['min_y']) < tolerance:
            perimeter['north'].append(edge)
        # South (bottom)
        elif abs(y - bounds['max_y']) < tolerance:
            perimeter['south'].append(edge)

    # Vertical edges
    for edge in edges['vertical'].values():
        x = edge['x1']
        # West (left)
        if abs(x - bounds['min_x']) < tolerance:
            perimeter['west'].append(edge)
        # East (right)
        elif abs(x - bounds['max_x']) < tolerance:
            perimeter['east'].append(edge)

    return perimeter


def assign_dimension_offset_levels(edges: list, is_horizontal: bool = True) -> dict:
    """
    Assign offset levels to edges to prevent overlapping dimension lines.
    Edges that overlap in their span get different offset levels.

    Args:
        edges: List of edge dictionaries
        is_horizontal: True for horizontal edges (check X overlap), False for vertical (check Y overlap)

    Returns:
        Dictionary mapping edge keys to offset levels (0, 1, 2, ...)
    """
    if not edges:
        return {}

    # Small gap tolerance - dimensions closer than this get stacked
    gap_tolerance = 5.0

    # Sort edges by their start coordinate
    if is_horizontal:
        sorted_edges = sorted(edges, key=lambda e: (e['x1'], e['x2']))
    else:
        sorted_edges = sorted(edges, key=lambda e: (e['y1'], e['y2']))

    # Track occupied ranges at each level
    # levels[i] = list of (start, end) ranges at level i
    levels = []
    edge_levels = {}

    for edge in sorted_edges:
        # Get the range for this edge
        if is_horizontal:
            edge_start = min(edge['x1'], edge['x2'])
            edge_end = max(edge['x1'], edge['x2'])
        else:
            edge_start = min(edge['y1'], edge['y2'])
            edge_end = max(edge['y1'], edge['y2'])

        # Find the first level where this edge doesn't overlap with existing edges
        assigned_level = None
        for level_idx, ranges in enumerate(levels):
            # Check if this edge overlaps with any range at this level
            overlaps = False
            for range_start, range_end in ranges:
                # Check for overlap with gap tolerance:
                # Overlap if edge starts before range ends (plus gap) AND ends after range starts (minus gap)
                if edge_start < (range_end + gap_tolerance) and edge_end > (range_start - gap_tolerance):
                    overlaps = True
                    break

            if not overlaps:
                # This level works
                assigned_level = level_idx
                ranges.append((edge_start, edge_end))
                break

        # If no existing level works, create a new level
        if assigned_level is None:
            assigned_level = len(levels)
            levels.append([(edge_start, edge_end)])

        # Store the level for this edge
        edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
        edge_levels[edge_key] = assigned_level

    return edge_levels


def detect_wall_connections(edges: dict) -> dict:
    """
    Detect which edges have walls connecting at their endpoints.
    Returns a dict mapping edge_key to (has_start_connection, has_end_connection).

    Args:
        edges: Dictionary with 'horizontal' and 'vertical' keys containing edge dicts

    Returns:
        Dictionary mapping edge_key to (adjust_start, adjust_end) booleans
    """
    tolerance = 2.0  # Tolerance for considering points as connected
    connections = {}

    # Collect all endpoints
    all_edges = list(edges['horizontal'].values()) + list(edges['vertical'].values())

    for edge in all_edges:
        x1, y1, x2, y2 = edge['x1'], edge['y1'], edge['x2'], edge['y2']
        edge_key = normalize_edge_key(x1, y1, x2, y2)

        # Check for connections at start point (x1, y1)
        has_start_connection = False
        for other_edge in all_edges:
            if other_edge == edge:
                continue

            ox1, oy1, ox2, oy2 = other_edge['x1'], other_edge['y1'], other_edge['x2'], other_edge['y2']

            # Check if other edge's endpoint coincides with this edge's start point
            if (abs(ox2 - x1) < tolerance and abs(oy2 - y1) < tolerance) or \
               (abs(ox1 - x1) < tolerance and abs(oy1 - y1) < tolerance):
                has_start_connection = True
                break

        # Check for connections at end point (x2, y2)
        has_end_connection = False
        for other_edge in all_edges:
            if other_edge == edge:
                continue

            ox1, oy1, ox2, oy2 = other_edge['x1'], other_edge['y1'], other_edge['x2'], other_edge['y2']

            # Check if other edge's endpoint coincides with this edge's end point
            if (abs(ox2 - x2) < tolerance and abs(oy2 - y2) < tolerance) or \
               (abs(ox1 - x2) < tolerance and abs(oy1 - y2) < tolerance):
                has_end_connection = True
                break

        connections[edge_key] = (has_start_connection, has_end_connection)

    return connections


def svg_draw_dimension_line(x1: float, y1: float, x2: float, y2: float,
                            offset: float, is_horizontal: bool = True,
                            adjust_start: bool = False, adjust_end: bool = False) -> str:
    """
    Draw a dimension line with arrows and text.

    Args:
        x1, y1: Start point of edge being dimensioned
        x2, y2: End point of edge being dimensioned
        offset: Distance to offset the dimension line (positive = away from drawing)
        is_horizontal: True for horizontal dimensions, False for vertical
        adjust_start: If True, adjust start point inward by wall thickness (clear span)
        adjust_end: If True, adjust end point inward by wall thickness (clear span)

    Returns:
        SVG string
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    text_size = dim_config['text_size']
    min_length = dim_config['min_dimension_length']
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    # Adjust points for clear span if needed
    if adjust_start:
        if is_horizontal:
            x1 += wall_thickness
        else:
            y1 += wall_thickness

    if adjust_end:
        if is_horizontal:
            x2 -= wall_thickness
        else:
            y2 -= wall_thickness

    # Calculate length
    length = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

    # Skip if too short
    if length < min_length:
        return ""

    # Format dimension text
    dim_text = format_dimension(length)

    svg = '<g class="dimension">\n'

    if is_horizontal:
        # Dimension line offset above or below
        dim_y = y1 + offset

        # Main dimension line
        svg += f'  <line x1="{x1}" y1="{dim_y}" x2="{x2}" y2="{dim_y}" stroke="#000" stroke-width="0.5"/>\n'

        # Extension/witness lines
        svg += f'  <line x1="{x1}" y1="{y1}" x2="{x1}" y2="{dim_y}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'
        svg += f'  <line x1="{x2}" y1="{y2}" x2="{x2}" y2="{dim_y}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'

        # Arrowheads
        arrow_size = 3
        if offset > 0:  # Below
            svg += f'  <polygon points="{x1},{dim_y} {x1+arrow_size},{dim_y-arrow_size} {x1+arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'
            svg += f'  <polygon points="{x2},{dim_y} {x2-arrow_size},{dim_y-arrow_size} {x2-arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'
        else:  # Above
            svg += f'  <polygon points="{x1},{dim_y} {x1+arrow_size},{dim_y-arrow_size} {x1+arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'
            svg += f'  <polygon points="{x2},{dim_y} {x2-arrow_size},{dim_y-arrow_size} {x2-arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'

        # Dimension text
        text_y = dim_y - 5 if offset < 0 else dim_y + text_size + 3
        svg += f'  <text x="{(x1+x2)/2}" y="{text_y}" text-anchor="middle" font-size="{text_size}" fill="#000">{dim_text}</text>\n'

    else:  # Vertical
        # Dimension line offset left or right
        dim_x = x1 + offset

        # Main dimension line
        svg += f'  <line x1="{dim_x}" y1="{y1}" x2="{dim_x}" y2="{y2}" stroke="#000" stroke-width="0.5"/>\n'

        # Extension/witness lines
        svg += f'  <line x1="{x1}" y1="{y1}" x2="{dim_x}" y2="{y1}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'
        svg += f'  <line x1="{x2}" y1="{y2}" x2="{dim_x}" y2="{y2}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'

        # Arrowheads
        arrow_size = 3
        svg += f'  <polygon points="{dim_x},{y1} {dim_x-arrow_size},{y1+arrow_size} {dim_x+arrow_size},{y1+arrow_size}" fill="#000"/>\n'
        svg += f'  <polygon points="{dim_x},{y2} {dim_x-arrow_size},{y2-arrow_size} {dim_x+arrow_size},{y2-arrow_size}" fill="#000"/>\n'

        # Dimension text (rotated for vertical dimensions)
        text_x = dim_x - text_size - 3 if offset < 0 else dim_x + text_size + 3
        svg += f'  <text x="{text_x}" y="{(y1+y2)/2}" text-anchor="middle" font-size="{text_size}" fill="#000" transform="rotate(-90 {text_x} {(y1+y2)/2})">{dim_text}</text>\n'

    svg += '</g>\n'
    return svg


def assign_opening_offset_levels(openings_by_wall: dict) -> dict:
    """
    Assign offset levels to openings on each wall to prevent overlapping dimensions.

    Args:
        openings_by_wall: Dict mapping wall_name to list of opening dicts with 'x', 'y', 'width', 'direction'

    Returns:
        Dictionary mapping (wall_name, opening_index) to offset level
    """
    opening_levels = {}
    gap_tolerance = 5.0

    for wall_name, openings in openings_by_wall.items():
        if not openings:
            continue

        # Determine if this is a horizontal or vertical wall
        direction = openings[0]['direction'].lower()
        is_horizontal = direction in ['north', 'south']

        # Create pseudo-edges for the openings
        edges = []
        for idx, opening in enumerate(openings):
            if is_horizontal:
                # For horizontal walls, openings span along X
                edge = {
                    'x1': opening['x'],
                    'y1': opening['y'],
                    'x2': opening['x'] + opening['width'],
                    'y2': opening['y'],
                    'index': idx
                }
            else:
                # For vertical walls, openings span along Y
                edge = {
                    'x1': opening['x'],
                    'y1': opening['y'],
                    'x2': opening['x'],
                    'y2': opening['y'] + opening['width'],
                    'index': idx
                }
            edges.append(edge)

        # Use the same algorithm as assign_dimension_offset_levels
        if is_horizontal:
            sorted_edges = sorted(edges, key=lambda e: (e['x1'], e['x2']))
        else:
            sorted_edges = sorted(edges, key=lambda e: (e['y1'], e['y2']))

        levels = []
        for edge in sorted_edges:
            if is_horizontal:
                edge_start = min(edge['x1'], edge['x2'])
                edge_end = max(edge['x1'], edge['x2'])
            else:
                edge_start = min(edge['y1'], edge['y2'])
                edge_end = max(edge['y1'], edge['y2'])

            assigned_level = None
            for level_idx, ranges in enumerate(levels):
                overlaps = False
                for range_start, range_end in ranges:
                    if edge_start < (range_end + gap_tolerance) and edge_end > (range_start - gap_tolerance):
                        overlaps = True
                        break

                if not overlaps:
                    assigned_level = level_idx
                    ranges.append((edge_start, edge_end))
                    break

            if assigned_level is None:
                assigned_level = len(levels)
                levels.append([(edge_start, edge_end)])

            opening_levels[(wall_name, edge['index'])] = assigned_level

    return opening_levels


def svg_draw_opening_dimensions(x: float, y: float, width: float, direction: str,
                                wall_start: float, wall_end: float, offset_level: int = 0,
                                reference_point: float = None) -> str:
    """
    Draw dimensions for a door or window opening.

    Args:
        x, y: Opening position
        width: Opening width
        direction: Opening direction ('north', 'south', 'east', 'west')
        wall_start: Start coordinate of the wall (x for vertical, y for horizontal)
        wall_end: End coordinate of the wall (x for vertical, y for horizontal)
        offset_level: Stacking level for overlapping openings (0, 1, 2, ...)
        reference_point: Reference coordinate for measuring position (previous opening end, or wall start)

    Returns:
        SVG string with two dimensions: position from reference point and opening width
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    base_offset = dim_config['opening_dimension_offset']
    offset_increment = dim_config.get('dimension_offset_increment', 20) * 0.5  # Use smaller increment for openings
    text_size = dim_config['opening_text_size']

    # Calculate actual offset based on level
    offset = base_offset + (offset_level * offset_increment)

    direction = direction.lower()
    svg = '<g class="opening-dimension">\n'

    # Use wall_start as reference if not provided
    if reference_point is None:
        reference_point = wall_start

    if direction in ['north', 'south']:
        # Horizontal wall
        # Dimension 1: Position from reference point to opening
        position_offset = -offset if direction == 'north' else offset
        pos_dim_y = y + position_offset

        if abs(x - reference_point) > 5:  # Only show if not at reference point
            pos_length = abs(x - reference_point)
            pos_dim_text = format_dimension(pos_length)

            # Short dimension line from reference point to opening
            svg += f'  <line x1="{reference_point}" y1="{pos_dim_y}" x2="{x}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.3"/>\n'
            svg += f'  <line x1="{reference_point}" y1="{y}" x2="{reference_point}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
            svg += f'  <line x1="{x}" y1="{y}" x2="{x}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

            # Small arrows
            arrow_size = 2
            svg += f'  <polygon points="{reference_point},{pos_dim_y} {reference_point+arrow_size},{pos_dim_y-arrow_size/2} {reference_point+arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'
            svg += f'  <polygon points="{x},{pos_dim_y} {x-arrow_size},{pos_dim_y-arrow_size/2} {x-arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'

            # Text
            text_y = pos_dim_y - 3 if direction == 'north' else pos_dim_y + text_size + 1
            svg += f'  <text x="{(reference_point+x)/2}" y="{text_y}" text-anchor="middle" font-size="{text_size}" fill="#666">{pos_dim_text}</text>\n'

        # Dimension 2: Opening width
        width_offset = -offset * 1.8 if direction == 'north' else offset * 1.8
        width_dim_y = y + width_offset
        width_dim_text = format_dimension(width)

        svg += f'  <line x1="{x}" y1="{width_dim_y}" x2="{x+width}" y2="{width_dim_y}" stroke="#000" stroke-width="0.4"/>\n'
        svg += f'  <line x1="{x}" y1="{y}" x2="{x}" y2="{width_dim_y}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
        svg += f'  <line x1="{x+width}" y1="{y}" x2="{x+width}" y2="{width_dim_y}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

        arrow_size = 2
        svg += f'  <polygon points="{x},{width_dim_y} {x+arrow_size},{width_dim_y-arrow_size/2} {x+arrow_size},{width_dim_y+arrow_size/2}" fill="#000"/>\n'
        svg += f'  <polygon points="{x+width},{width_dim_y} {x+width-arrow_size},{width_dim_y-arrow_size/2} {x+width-arrow_size},{width_dim_y+arrow_size/2}" fill="#000"/>\n'

        text_y = width_dim_y - 3 if direction == 'north' else width_dim_y + text_size + 1
        svg += f'  <text x="{x+width/2}" y="{text_y}" text-anchor="middle" font-size="{text_size}" font-weight="bold" fill="#000">{width_dim_text}</text>\n'

    else:  # Vertical wall (east/west)
        # Dimension 1: Position from reference point to opening
        position_offset = -offset if direction == 'west' else offset
        pos_dim_x = x + position_offset

        if abs(y - reference_point) > 5:  # Only show if not at reference point
            pos_length = abs(y - reference_point)
            pos_dim_text = format_dimension(pos_length)

            svg += f'  <line x1="{pos_dim_x}" y1="{reference_point}" x2="{pos_dim_x}" y2="{y}" stroke="#666" stroke-width="0.3"/>\n'
            svg += f'  <line x1="{x}" y1="{reference_point}" x2="{pos_dim_x}" y2="{reference_point}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
            svg += f'  <line x1="{x}" y1="{y}" x2="{pos_dim_x}" y2="{y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

            arrow_size = 2
            svg += f'  <polygon points="{pos_dim_x},{reference_point} {pos_dim_x-arrow_size/2},{reference_point+arrow_size} {pos_dim_x+arrow_size/2},{reference_point+arrow_size}" fill="#666"/>\n'
            svg += f'  <polygon points="{pos_dim_x},{y} {pos_dim_x-arrow_size/2},{y-arrow_size} {pos_dim_x+arrow_size/2},{y-arrow_size}" fill="#666"/>\n'

            text_x = pos_dim_x - text_size - 2 if direction == 'west' else pos_dim_x + text_size + 2
            svg += f'  <text x="{text_x}" y="{(reference_point+y)/2}" text-anchor="middle" font-size="{text_size}" fill="#666" transform="rotate(-90 {text_x} {(reference_point+y)/2})">{pos_dim_text}</text>\n'

        # Dimension 2: Opening width (height in vertical orientation)
        width_offset = -offset * 1.8 if direction == 'west' else offset * 1.8
        width_dim_x = x + width_offset
        width_dim_text = format_dimension(width)

        svg += f'  <line x1="{width_dim_x}" y1="{y}" x2="{width_dim_x}" y2="{y+width}" stroke="#000" stroke-width="0.4"/>\n'
        svg += f'  <line x1="{x}" y1="{y}" x2="{width_dim_x}" y2="{y}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
        svg += f'  <line x1="{x}" y1="{y+width}" x2="{width_dim_x}" y2="{y+width}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

        arrow_size = 2
        svg += f'  <polygon points="{width_dim_x},{y} {width_dim_x-arrow_size/2},{y+arrow_size} {width_dim_x+arrow_size/2},{y+arrow_size}" fill="#000"/>\n'
        svg += f'  <polygon points="{width_dim_x},{y+width} {width_dim_x-arrow_size/2},{y+width-arrow_size} {width_dim_x+arrow_size/2},{y+width-arrow_size}" fill="#000"/>\n'

        text_x = width_dim_x - text_size - 2 if direction == 'west' else width_dim_x + text_size + 2
        svg += f'  <text x="{text_x}" y="{y+width/2}" text-anchor="middle" font-size="{text_size}" font-weight="bold" fill="#000" transform="rotate(-90 {text_x} {y+width/2})">{width_dim_text}</text>\n'

    svg += '</g>\n'
    return svg


def generate_floor_plan_svg(floor_config: dict, output_path: str = None,
                            scale: float = 2.0) -> str:
    """
    Generate an SVG floor plan from a floor configuration.

    Args:
        floor_config: Floor configuration dictionary
        output_path: Path to save SVG file (if None, returns SVG string only)
        scale: Pixels per unit (default: 2 pixels per unit)

    Returns:
        SVG content as string
    """
    floor_num = floor_config.get('floor_number', 0)
    floor_name = floor_config.get('name', f'Floor {floor_num}')

    # Find bounds
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')

    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type in ['floor_slab', 'beam', 'room']:
                x, y = obj['x'], obj['y']
                w, l = obj['width'], obj['length']
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x + w), max(max_y, y + l)

            elif obj_type == 'wall':
                min_x = min(min_x, obj['start_x'], obj['end_x'])
                max_x = max(max_x, obj['start_x'], obj['end_x'])
                min_y = min(min_y, obj['start_y'], obj['end_y'])
                max_y = max(max_y, obj['start_y'], obj['end_y'])

    # Add margin (extra at top for title and dimensions)
    dim_config = GLOBAL_CONFIG['dimensions']
    base_margin = 20
    # Add extra margin for dimensions if enabled
    # Account for up to 3 stacked wall levels + 1 overall plinth dimension
    if dim_config['show_outer_dimensions']:
        offset_increment = dim_config['dimension_offset_increment']
        # Max stacked levels (3) + base offset + plinth dimension with extra gap
        max_offset = dim_config['dimension_offset'] + (3 * offset_increment) + (offset_increment * 1.5) + 10
        dim_margin = (max_offset + 20) * scale
    else:
        dim_margin = 0
    margin = base_margin + dim_margin
    top_margin = 50 + dim_margin  # Extra space for title and top dimensions

    width = (max_x - min_x) * scale + 2 * margin
    height = (max_y - min_y) * scale + margin + top_margin

    # Start SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<title>{floor_name} - Floor Plan</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
    </style>
</defs>
<g transform="translate({margin - min_x * scale}, {top_margin - min_y * scale}) scale({scale}, {scale})">

'''

    # Draw floor slabs first (lowest layer)
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            if obj.get('type') == 'floor_slab':
                svg += svg_draw_floor_slab(obj['x'], obj['y'], obj['width'], obj['length'])

    # Draw beams next (above floor slabs)
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            if obj.get('type') == 'beam':
                svg += svg_draw_beam(obj['x'], obj['y'], obj['width'], obj['length'])

    # Store pillar data to draw them last
    pillars_to_draw = []

    # Draw walls and rooms
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type == 'room':
                svg += svg_draw_room(
                    obj['x'], obj['y'],
                    obj['width'], obj['length'],
                    obj.get('wall_thickness', wall_thickness),
                    obj.get('name', ''),
                    obj.get('walls')
                )

            elif obj_type == 'wall':
                thickness = obj.get('thickness', wall_thickness)
                svg += svg_draw_wall(
                    obj['start_x'], obj['start_y'],
                    obj['end_x'], obj['end_y'],
                    thickness
                )

            elif obj_type == 'pillar':
                # Store pillar data for drawing later (after all walls and dimensions)
                pillars_to_draw.append({
                    'x': obj['x'],
                    'y': obj['y'],
                    'size': obj.get('size')
                })

    # Draw doors and windows
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type == 'door':
                svg += svg_draw_door(
                    obj['x'], obj['y'],
                    obj['width'],
                    obj.get('direction', 'north')
                )

            elif obj_type == 'window':
                svg += svg_draw_window(
                    obj['x'], obj['y'],
                    obj['width'],
                    obj.get('direction', 'north')
                )

    # Add dimensions
    dim_config = GLOBAL_CONFIG['dimensions']

    # Draw door/window dimensions
    if dim_config['show_opening_dimensions'] and 'objects' in floor_config:
        # First, create a map of wall names to their bounds
        wall_bounds = {}

        for obj in floor_config['objects']:
            if obj.get('type') == 'room':
                room_name = obj['name']
                x, y = obj['x'], obj['y']
                w, h = obj['width'], obj['length']

                wall_bounds[f"{room_name}_North"] = {'start': x, 'end': x + w, 'coord': y, 'direction': 'north'}
                wall_bounds[f"{room_name}_South"] = {'start': x, 'end': x + w, 'coord': y + h, 'direction': 'south'}
                wall_bounds[f"{room_name}_East"] = {'start': y, 'end': y + h, 'coord': x + w, 'direction': 'east'}
                wall_bounds[f"{room_name}_West"] = {'start': y, 'end': y + h, 'coord': x, 'direction': 'west'}

            elif obj.get('type') == 'wall':
                wall_name = obj.get('name', 'Wall')
                x1, y1 = obj['start_x'], obj['start_y']
                x2, y2 = obj['end_x'], obj['end_y']

                if abs(y2 - y1) < 0.01:  # Horizontal wall
                    direction = 'north' if y1 < (min_y + max_y) / 2 else 'south'
                    wall_bounds[wall_name] = {'start': min(x1, x2), 'end': max(x1, x2), 'coord': y1, 'direction': direction}
                elif abs(x2 - x1) < 0.01:  # Vertical wall
                    direction = 'west' if x1 < (min_x + max_x) / 2 else 'east'
                    wall_bounds[wall_name] = {'start': min(y1, y2), 'end': max(y1, y2), 'coord': x1, 'direction': direction}

        # Group openings by wall and collect them
        openings_by_wall = {}

        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type in ['door', 'window']:
                direction = obj.get('direction', 'north').lower()
                room = obj.get('room')
                wall_name = obj.get('wall')

                if room and not wall_name:
                    wall_name = f"{room}_{direction.capitalize()}"

                if wall_name and wall_name in wall_bounds:
                    if wall_name not in openings_by_wall:
                        openings_by_wall[wall_name] = []

                    openings_by_wall[wall_name].append(obj)

        # Sort openings on each wall by position
        for wall_name, openings in openings_by_wall.items():
            wall_info = wall_bounds[wall_name]
            direction = wall_info['direction']

            # Sort by X for horizontal walls, Y for vertical walls
            if direction in ['north', 'south']:
                openings.sort(key=lambda o: o['x'])
            else:
                openings.sort(key=lambda o: o['y'])

        # Assign offset levels to prevent overlapping dimensions
        # Convert to the format expected by assign_opening_offset_levels
        openings_for_levels = {}
        for wall_name, openings in openings_by_wall.items():
            openings_for_levels[wall_name] = [
                {'x': o['x'], 'y': o['y'], 'width': o['width'], 'direction': o.get('direction', 'north').lower()}
                for o in openings
            ]
        opening_levels = assign_opening_offset_levels(openings_for_levels)

        # Draw dimensions for doors and windows with running dimensions
        wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)
        opening_offset = dim_config['opening_dimension_offset']
        opening_text_size = dim_config['opening_text_size']

        for wall_name, openings in openings_by_wall.items():
            wall_info = wall_bounds[wall_name]
            direction = wall_info['direction']

            # Start from inside edge of wall (add wall thickness)
            if direction in ['north', 'south']:
                # Horizontal walls - offset along X axis
                reference_point = wall_info['start'] + wall_thickness
            else:
                # Vertical walls - offset along Y axis
                reference_point = wall_info['start'] + wall_thickness

            for wall_index, obj in enumerate(openings):
                offset_level = opening_levels.get((wall_name, wall_index), 0)

                svg += svg_draw_opening_dimensions(
                    obj['x'], obj['y'],
                    obj['width'],
                    direction,
                    wall_info['start'],
                    wall_info['end'],
                    offset_level,
                    reference_point
                )

                # Update reference point to end of this opening for next opening
                if direction in ['north', 'south']:
                    reference_point = obj['x'] + obj['width']
                else:
                    reference_point = obj['y'] + obj['width']

            # Add final dimension from last opening to inside edge of wall
            if openings:
                last_opening = openings[-1]
                wall_inside_end = wall_info['end'] - wall_thickness

                # Calculate the final span
                if direction in ['north', 'south']:
                    final_start = last_opening['x'] + last_opening['width']
                    final_length = wall_inside_end - final_start

                    if final_length > 5:  # Only show if meaningful distance
                        position_offset = -opening_offset if direction == 'north' else opening_offset
                        pos_dim_y = last_opening['y'] + position_offset
                        final_dim_text = format_dimension(final_length)

                        svg += '<g class="opening-dimension">\n'
                        svg += f'  <line x1="{final_start}" y1="{pos_dim_y}" x2="{wall_inside_end}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.3"/>\n'
                        svg += f'  <line x1="{final_start}" y1="{last_opening["y"]}" x2="{final_start}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
                        svg += f'  <line x1="{wall_inside_end}" y1="{last_opening["y"]}" x2="{wall_inside_end}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

                        arrow_size = 2
                        svg += f'  <polygon points="{final_start},{pos_dim_y} {final_start+arrow_size},{pos_dim_y-arrow_size/2} {final_start+arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'
                        svg += f'  <polygon points="{wall_inside_end},{pos_dim_y} {wall_inside_end-arrow_size},{pos_dim_y-arrow_size/2} {wall_inside_end-arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'

                        text_y = pos_dim_y - 3 if direction == 'north' else pos_dim_y + opening_text_size + 1
                        svg += f'  <text x="{(final_start+wall_inside_end)/2}" y="{text_y}" text-anchor="middle" font-size="{opening_text_size}" fill="#666">{final_dim_text}</text>\n'
                        svg += '</g>\n'

                else:  # Vertical wall (east/west)
                    final_start = last_opening['y'] + last_opening['width']
                    final_length = wall_inside_end - final_start

                    if final_length > 5:  # Only show if meaningful distance
                        position_offset = -opening_offset if direction == 'west' else opening_offset
                        pos_dim_x = last_opening['x'] + position_offset
                        final_dim_text = format_dimension(final_length)

                        svg += '<g class="opening-dimension">\n'
                        svg += f'  <line x1="{pos_dim_x}" y1="{final_start}" x2="{pos_dim_x}" y2="{wall_inside_end}" stroke="#666" stroke-width="0.3"/>\n'
                        svg += f'  <line x1="{last_opening["x"]}" y1="{final_start}" x2="{pos_dim_x}" y2="{final_start}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
                        svg += f'  <line x1="{last_opening["x"]}" y1="{wall_inside_end}" x2="{pos_dim_x}" y2="{wall_inside_end}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

                        arrow_size = 2
                        svg += f'  <polygon points="{pos_dim_x},{final_start} {pos_dim_x-arrow_size/2},{final_start+arrow_size} {pos_dim_x+arrow_size/2},{final_start+arrow_size}" fill="#666"/>\n'
                        svg += f'  <polygon points="{pos_dim_x},{wall_inside_end} {pos_dim_x-arrow_size/2},{wall_inside_end-arrow_size} {pos_dim_x+arrow_size/2},{wall_inside_end-arrow_size}" fill="#666"/>\n'

                        text_x = pos_dim_x - opening_text_size - 2 if direction == 'west' else pos_dim_x + opening_text_size + 2
                        svg += f'  <text x="{text_x}" y="{(final_start+wall_inside_end)/2}" text-anchor="middle" font-size="{opening_text_size}" fill="#666" transform="rotate(-90 {text_x} {(final_start+wall_inside_end)/2})">{final_dim_text}</text>\n'
                        svg += '</g>\n'

    if dim_config['show_outer_dimensions'] or dim_config['show_inner_dimensions']:
        # Extract all edges
        edges = extract_floor_edges(floor_config)

        # Detect wall connections for clear span dimensioning
        wall_connections = detect_wall_connections(edges)

        # Classify perimeter edges
        bounds_dict = {'min_x': min_x, 'max_x': max_x, 'min_y': min_y, 'max_y': max_y}
        perimeter = classify_perimeter_edges(edges, bounds_dict)

        # Draw outer dimensions with stacked offsets for overlapping dimensions
        if dim_config['show_outer_dimensions']:
            base_offset = dim_config['dimension_offset']
            offset_increment = dim_config['dimension_offset_increment']

            # Assign offset levels for each side to prevent overlapping dimensions
            north_levels = assign_dimension_offset_levels(perimeter['north'], is_horizontal=True)
            south_levels = assign_dimension_offset_levels(perimeter['south'], is_horizontal=True)
            west_levels = assign_dimension_offset_levels(perimeter['west'], is_horizontal=False)
            east_levels = assign_dimension_offset_levels(perimeter['east'], is_horizontal=False)

            # North dimensions (above) - negative offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['north']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = north_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], -offset, True, True, True)

            # South dimensions (below) - positive offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['south']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = south_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], offset, True, True, True)

            # West dimensions (left) - negative offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['west']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = west_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], -offset, False, True, True)

            # East dimensions (right) - positive offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['east']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = east_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], offset, False, True, True)

            # Draw overall plinth dimensions (outer building extents)
            # Use maximum offset level + 1 to ensure they're outside all other dimensions
            max_north_level = max(north_levels.values()) if north_levels else 0
            max_south_level = max(south_levels.values()) if south_levels else 0
            max_west_level = max(west_levels.values()) if west_levels else 0
            max_east_level = max(east_levels.values()) if east_levels else 0

            plinth_offset_increment = offset_increment * 1.5  # Larger gap for clarity

            # North total dimension (if there are north edges)
            if perimeter['north']:
                plinth_offset = base_offset + (max_north_level + 1) * offset_increment + plinth_offset_increment
                # Don't adjust for wall thickness - show full outer dimension
                svg += svg_draw_dimension_line(min_x, min_y, max_x, min_y, -plinth_offset, True, False, False)

            # South total dimension (if there are south edges)
            if perimeter['south']:
                plinth_offset = base_offset + (max_south_level + 1) * offset_increment + plinth_offset_increment
                # Don't adjust for wall thickness - show full outer dimension
                svg += svg_draw_dimension_line(min_x, max_y, max_x, max_y, plinth_offset, True, False, False)

            # West total dimension (if there are west edges)
            if perimeter['west']:
                plinth_offset = base_offset + (max_west_level + 1) * offset_increment + plinth_offset_increment
                # Don't adjust for wall thickness - show full outer dimension
                svg += svg_draw_dimension_line(min_x, min_y, min_x, max_y, -plinth_offset, False, False, False)

            # East total dimension (if there are east edges)
            if perimeter['east']:
                plinth_offset = base_offset + (max_east_level + 1) * offset_increment + plinth_offset_increment
                # Don't adjust for wall thickness - show full outer dimension
                svg += svg_draw_dimension_line(max_x, min_y, max_x, max_y, plinth_offset, False, False, False)

        # Draw interior dimensions
        if dim_config['show_inner_dimensions']:
            inner_offset = dim_config['inner_dimension_offset']

            # Draw non-perimeter horizontal edges
            # Always dimension clear interior span (adjust both ends)
            for edge in edges['horizontal'].values():
                key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                is_perimeter = any(
                    normalize_edge_key(e['x1'], e['y1'], e['x2'], e['y2']) == key
                    for e in perimeter['north'] + perimeter['south']
                )
                if not is_perimeter:
                    # Place dimension below the edge with clear span (both ends adjusted)
                    svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], inner_offset, True, True, True)

            # Draw non-perimeter vertical edges
            # Always dimension clear interior span (adjust both ends)
            for edge in edges['vertical'].values():
                key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                is_perimeter = any(
                    normalize_edge_key(e['x1'], e['y1'], e['x2'], e['y2']) == key
                    for e in perimeter['west'] + perimeter['east']
                )
                if not is_perimeter:
                    # Place dimension to the right of the edge with clear span (both ends adjusted)
                    svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], inner_offset, False, True, True)

    # Add room dimension labels
    if dim_config['show_room_dimensions'] and 'objects' in floor_config:
        room_text_size = dim_config['room_text_size']
        wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

        for obj in floor_config['objects']:
            if obj.get('type') == 'room':
                center_x = obj['x'] + obj['width'] / 2
                center_y = obj['y'] + obj['length'] / 2

                # Calculate carpet area (interior dimensions excluding wall thickness)
                # Since we're dimensioning all walls with clear interior spans (both ends adjusted),
                # the room dimensions should match those wall dimensions
                # Always subtract wall thickness from all sides to match the wall dimensioning
                t = obj.get('wall_thickness', wall_thickness)

                # Start with outer dimensions
                # width = X direction (horizontal), length = Y direction (vertical)
                # Subtract wall thickness from both ends of each dimension
                # This matches the clear interior span shown on the wall dimensions
                carpet_width = obj['width'] - (2 * t)
                carpet_length = obj['length'] - (2 * t)

                # Format dimensions
                width_dim = format_dimension(carpet_width)
                length_dim = format_dimension(carpet_length)

                # Room name
                room_name = obj.get('name', 'Room')
                svg += f'<text x="{center_x}" y="{center_y - 8}" text-anchor="middle" font-size="{room_text_size}" font-weight="bold" fill="#333">{room_name}</text>\n'

                # Carpet area dimensions
                svg += f'<text x="{center_x}" y="{center_y + 8}" text-anchor="middle" font-size="{room_text_size - 2}" fill="#666">{width_dim} × {length_dim}</text>\n'

    # Draw all pillars last so they appear on top
    for pillar in pillars_to_draw:
        svg += svg_draw_pillar(pillar['x'], pillar['y'], pillar['size'])

    # Add title
    svg += f'''</g>
<text x="{width/2}" y="30" text-anchor="middle" font-size="16" font-weight="bold">{floor_name}</text>
</svg>'''

    # Save to file if path provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(f"✓ Floor plan saved to: {output_path}")

    return svg


def generate_elevation_view(house_config: dict, view_type: str, output_path: str = None, scale: float = 2.0) -> str:
    """
    Generate an SVG elevation view (front, back, left, right) from house configuration.

    Args:
        house_config: Complete house configuration
        view_type: 'front', 'back', 'left', or 'right'
        output_path: Path to save SVG file (if None, returns SVG string only)
        scale: SVG scaling factor

    Returns:
        SVG string
    """
    # Get site and plinth info
    site = house_config.get('site', {})
    plinth_config = house_config.get('plinth', {})
    floors = house_config.get('floors', [])

    # Get building dimensions for checking exterior walls
    building_width = plinth_config.get('width', 0)   # X dimension
    building_length = plinth_config.get('length', 0)  # Y dimension
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    # Determine building bounds
    if view_type in ['front', 'back']:
        # Front/back views: looking along Y, showing X-Z
        width = building_width  # X dimension
        view_name = "Front Elevation" if view_type == 'front' else "Back Elevation"
    else:
        # Left/right views: looking along X, showing Y-Z
        width = building_length  # Y dimension
        view_name = "Left Elevation" if view_type == 'left' else "Right Elevation"

    # Calculate total height
    plinth_height = plinth_config.get('height', GLOBAL_CONFIG['plinth_height'])
    total_height = plinth_height

    # Add floor heights
    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_height = GLOBAL_CONFIG['floor_heights'].get(floor_num, 100)
        total_height += floor_height

    # Check for roof
    for floor_config in floors:
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') == 'gable_roof':
                    ridge_z = obj.get('ridge_z', 0)
                    total_height = max(total_height, ridge_z)

    # SVG dimensions
    margin = 50
    svg_width = width * scale + 2 * margin
    svg_height = total_height * scale + 2 * margin + 50  # Extra for title

    # Start SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}">
<title>{view_name}</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
    </style>
</defs>
<g transform="translate({margin}, {svg_height - margin}) scale({scale}, {-scale})">

'''

    # Draw ground line
    svg += f'<line x1="0" y1="0" x2="{width}" y2="0" stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>\n'

    # Draw plinth
    svg += f'<rect x="0" y="0" width="{width}" height="{plinth_height}" fill="#A0826D" stroke="#000" stroke-width="1"/>\n'

    # Current Z level
    current_z = plinth_height

    # Draw each floor
    slab_thickness = GLOBAL_CONFIG.get('floor_slab_thickness', 4)

    # Store pillar data to draw them last
    pillars_to_draw = []

    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_height = GLOBAL_CONFIG['floor_heights'].get(floor_num, 100)

        # Collect all objects with their depth coordinate for sorting
        floor_objects_with_depth = []

        # Get type priority from config for conflict resolution when objects have same depth
        # Lower number = drawn first (appears underneath)
        type_priority = GLOBAL_CONFIG.get('elevation_rendering_priority', {
            'beam': 0,
            'floor_slab': 1,
            'room': 2,
            'wall': 2,
            'pillar': 3
        })

        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                obj_type = obj.get('type')
                depth = 0  # Depth coordinate for sorting
                priority = type_priority.get(obj_type, 2)  # Default to wall/room priority

                # Calculate depth based on view type
                # Only walls, rooms, slabs, beams, and pillars are depth-sorted (NOT doors/windows)
                if view_type == 'front':
                    # Front view: sort by Y (smaller Y = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam']:
                        depth = obj.get('y', 0)
                    elif obj_type == 'room':
                        depth = obj.get('y', 0)
                    elif obj_type == 'wall':
                        depth = min(obj.get('start_y', 0), obj.get('end_y', 0))
                    elif obj_type == 'pillar':
                        depth = obj.get('y', 0)
                elif view_type == 'back':
                    # Back view: sort by Y (larger Y = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam']:
                        depth = -obj.get('y', 0)  # Negative to reverse sort
                    elif obj_type == 'room':
                        depth = -obj.get('y', 0)
                    elif obj_type == 'wall':
                        depth = -max(obj.get('start_y', 0), obj.get('end_y', 0))
                    elif obj_type == 'pillar':
                        depth = -obj.get('y', 0)
                elif view_type == 'left':
                    # Left view: sort by X (smaller X = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam']:
                        depth = obj.get('x', 0)
                    elif obj_type == 'room':
                        depth = obj.get('x', 0)
                    elif obj_type == 'wall':
                        depth = min(obj.get('start_x', 0), obj.get('end_x', 0))
                    elif obj_type == 'pillar':
                        depth = obj.get('x', 0)
                elif view_type == 'right':
                    # Right view: sort by X (larger X = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam']:
                        depth = -obj.get('x', 0)
                    elif obj_type == 'room':
                        depth = -obj.get('x', 0)
                    elif obj_type == 'wall':
                        depth = -max(obj.get('start_x', 0), obj.get('end_x', 0))
                    elif obj_type == 'pillar':
                        depth = -obj.get('x', 0)

                # Skip doors and windows - they're not depth sorted
                if obj_type in ['door', 'window']:
                    continue

                floor_objects_with_depth.append((depth, priority, obj))

        # Sort objects by depth (back to front), then by type priority for conflict resolution
        floor_objects_with_depth.sort(key=lambda x: (x[0], x[1]))

        # Pre-group doors/windows with their parent walls for efficient rendering
        # Key format: '{room_name}_{direction}' for room walls, or '{wall_name}' for standalone walls
        wall_openings = {}
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') in ['door', 'window']:
                    # Get the parent wall identifier from the door/window config
                    if 'room' in obj:
                        # Door/window belongs to a specific room's wall
                        room_name = obj['room']
                        direction = obj.get('direction', '').lower()
                        wall_key = f"{room_name}_{direction}"
                    elif 'wall_name' in obj:
                        # Door/window belongs to a standalone wall
                        wall_key = obj['wall_name']
                    else:
                        # Skip if no parent wall specified
                        continue

                    if wall_key not in wall_openings:
                        wall_openings[wall_key] = []
                    wall_openings[wall_key].append(obj)

        # PHASE 1: Draw floor slabs and beams (bottom layer at floor level)
        for depth, priority, obj in floor_objects_with_depth:
            obj_type = obj.get('type')

            # Draw floor slabs
            if obj_type == 'floor_slab':
                slab_x = obj['x']
                slab_y = obj['y']
                slab_width = obj['width']
                slab_length = obj['length']
                slab_thick = obj.get('thickness', slab_thickness)

                # Determine slab position and span based on view
                if view_type in ['front', 'back']:
                    # Front/back views: slab spans X direction
                    svg += f'<rect x="{slab_x}" y="{current_z}" width="{slab_width}" height="{slab_thick}" fill="#888" stroke="#000" stroke-width="0.5"/>\n'
                else:
                    # Left/right views: slab spans Y direction
                    svg += f'<rect x="{slab_y}" y="{current_z}" width="{slab_length}" height="{slab_thick}" fill="#888" stroke="#000" stroke-width="0.5"/>\n'

            # Draw beams
            elif obj_type == 'beam':
                beam_x = obj['x']
                beam_y = obj['y']
                beam_width = obj['width']
                beam_length = obj['length']
                beam_thick = obj.get('thickness', wall_thickness)

                # Determine beam position and span based on view
                if view_type in ['front', 'back']:
                    # Front/back views: beam spans X direction
                    svg += f'<rect x="{beam_x}" y="{current_z}" width="{beam_width}" height="{beam_thick}" fill="#8B4513" stroke="#654321" stroke-width="0.5"/>\n'
                else:
                    # Left/right views: beam spans Y direction
                    svg += f'<rect x="{beam_y}" y="{current_z}" width="{beam_length}" height="{beam_thick}" fill="#8B4513" stroke="#654321" stroke-width="0.5"/>\n'

        # Move up past the slab to where walls start
        current_z += slab_thickness
        wall_top = current_z + floor_height

        # PHASE 2: Extract all walls into a flat array, associate openings, sort by depth, then draw

        # Step 1: Extract all walls from rooms and standalone walls
        walls_to_draw = []

        for depth, priority, obj in floor_objects_with_depth:
            obj_type = obj.get('type')

            if obj_type == 'room':
                room_name = obj.get('name', '')
                walls_list = obj.get('walls', ['north', 'south', 'east', 'west'])
                walls_list = [w.lower() for w in walls_list]
                wall_heights = obj.get('wall_heights', {})
                room_x = obj['x']
                room_y = obj['y']
                room_width = obj['width']
                room_length = obj['length']

                # Extract each wall of the room as a separate entity
                for direction in walls_list:
                    wall_key = f"{room_name}_{direction}"
                    wall_height = wall_heights.get(direction, obj.get('height', floor_height))

                    # Calculate wall depth and position based on view type
                    if view_type == 'left' and direction == 'west':
                        walls_to_draw.append({
                            'depth': -room_x,
                            'x': room_y,
                            'width': room_length,
                            'height': wall_height,
                            'openings': wall_openings.get(wall_key, []),
                            'coord_getter': lambda dw: dw.get('y', 0)
                        })
                    elif view_type == 'right' and direction == 'east':
                        walls_to_draw.append({
                            'depth': -(room_x + room_width),
                            'x': room_y,
                            'width': room_length,
                            'height': wall_height,
                            'openings': wall_openings.get(wall_key, []),
                            'coord_getter': lambda dw: dw.get('y', 0)
                        })
                    elif view_type == 'front' and direction == 'north':
                        walls_to_draw.append({
                            'depth': room_y,
                            'x': room_x,
                            'width': room_width,
                            'height': wall_height,
                            'openings': wall_openings.get(wall_key, []),
                            'coord_getter': lambda dw: dw.get('x', 0)
                        })
                    elif view_type == 'back' and direction == 'south':
                        walls_to_draw.append({
                            'depth': -room_y,
                            'x': room_x,
                            'width': room_width,
                            'height': wall_height,
                            'openings': wall_openings.get(wall_key, []),
                            'coord_getter': lambda dw: dw.get('x', 0)
                        })

            elif obj_type == 'wall':
                wall_name = obj.get('name', '')
                start_x = obj['start_x']
                start_y = obj['start_y']
                end_x = obj['end_x']
                end_y = obj['end_y']
                wall_height_val = obj.get('height', floor_height)
                wall_height_end = obj.get('height_end', wall_height_val)

                is_horizontal = abs(end_y - start_y) < 1
                is_vertical = abs(end_x - start_x) < 1

                # Only add if visible in this view
                if view_type in ['front', 'back'] and is_horizontal:
                    wall_length = abs(end_x - start_x)
                    wall_pos = min(start_x, end_x)
                    depth = start_y if view_type == 'front' else -start_y

                    walls_to_draw.append({
                        'depth': depth,
                        'x': wall_pos,
                        'width': wall_length,
                        'height': wall_height_val,
                        'height_end': wall_height_end,
                        'openings': wall_openings.get(wall_name, []),
                        'coord_getter': lambda dw: dw.get('x', 0)
                    })
                elif view_type in ['left', 'right'] and is_vertical:
                    wall_length = abs(end_y - start_y)
                    wall_pos = min(start_y, end_y)
                    depth = -start_x if view_type == 'left' else start_x

                    walls_to_draw.append({
                        'depth': depth,
                        'x': wall_pos,
                        'width': wall_length,
                        'height': wall_height_val,
                        'height_end': wall_height_end,
                        'openings': wall_openings.get(wall_name, []),
                        'coord_getter': lambda dw: dw.get('y', 0)
                    })

            elif obj_type == 'pillar':
                pillar_size = obj.get('size', wall_thickness)
                pillar_height = obj.get('height', floor_height)

                if view_type in ['front', 'back']:
                    pillar_x = obj['x'] - pillar_size / 2
                else:
                    pillar_x = obj['y'] - pillar_size / 2

                pillars_to_draw.append({
                    'x': pillar_x,
                    'z': current_z,
                    'size': pillar_size,
                    'height': pillar_height
                })

        # Step 2: Sort walls by depth (back to front)
        walls_to_draw.sort(key=lambda w: w['depth'])

        # Step 3: Draw each wall with its associated openings
        for wall in walls_to_draw:
            # Draw the wall
            if wall.get('height_end') and wall['height'] != wall.get('height_end'):
                # Sloping wall
                x = wall['x']
                width = wall['width']
                h1 = wall['height']
                h2 = wall['height_end']
                svg += f'<polygon points="{x},{current_z} {x},{current_z + h1} {x + width},{current_z + h2} {x + width},{current_z}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'
            else:
                # Regular wall
                svg += f'<rect x="{wall["x"]}" y="{current_z}" width="{wall["width"]}" height="{wall["height"]}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'

            # Draw openings for this wall
            for opening in wall['openings']:
                opening_type = opening.get('type')
                opening_width = opening['width']
                opening_height = opening['height']
                opening_x = wall['coord_getter'](opening)

                if opening_type == 'window':
                    sill_height = opening.get('sill_height', 30)
                    opening_bottom = current_z + sill_height
                else:
                    opening_bottom = current_z

                fill_color = "#87CEEB" if opening_type == 'window' else "#D2691E"
                svg += f'<rect x="{opening_x}" y="{opening_bottom}" width="{opening_width}" height="{opening_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

        # Draw roof if exists
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') == 'gable_roof':
                    ridge_z = obj.get('ridge_z', 0)
                    ridge_length = obj.get('ridge_length', width)

                    if view_type in ['front', 'back']:
                        # Show gable end (triangle)
                        left_slope_length = obj.get('left_slope_length', 0)
                        right_slope_length = obj.get('right_slope_length', 0)

                        # Calculate roof profile
                        ridge_start_x = obj.get('ridge_start_x', width / 2)

                        # Draw roof outline
                        svg += f'<polygon points="0,{wall_top} {ridge_start_x},{ridge_z} {width},{wall_top}" fill="#8B4513" stroke="#000" stroke-width="1"/>\n'
                    else:
                        # Side view - show roof slope
                        svg += f'<line x1="0" y1="{wall_top}" x2="{width}" y2="{ridge_z}" stroke="#8B4513" stroke-width="2"/>\n'

        current_z = wall_top

    # Draw all pillars last so they appear on top of walls
    for pillar in pillars_to_draw:
        svg += f'<rect x="{pillar["x"]}" y="{pillar["z"]}" width="{pillar["size"]}" height="{pillar["height"]}" fill="#000" stroke="#000" stroke-width="0.5"/>\n'

    svg += '''</g>
'''

    # Add title
    svg += f'<text x="{svg_width/2}" y="30" text-anchor="middle" font-size="16" font-weight="bold">{view_name}</text>\n'
    svg += '</svg>'

    # Save to file if path provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(f"✓ Elevation view saved to: {output_path}")

    return svg


def generate_all_elevations(house_config: dict, output_dir: str = None):
    """
    Generate SVG elevation views (front, back, left, right) for the house.

    Args:
        house_config: Complete house configuration
        output_dir: Directory to save SVG files (defaults to docs folder for web deployment)
    """
    import os

    if output_dir is None:
        # Get the blend file directory
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            blend_dir = os.getcwd()

        # Save to docs folder for web deployment
        output_dir = os.path.join(blend_dir, "docs")

    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "="*70)
    print("GENERATING ELEVATION VIEWS (SVG)")
    print("="*70)

    # Generate all four elevation views
    for view_type in ['front', 'back', 'left', 'right']:
        print(f"\nGenerating {view_type} elevation...")
        filename = f"elevation_{view_type}.svg"
        filepath = os.path.join(output_dir, filename)

        # Generate SVG
        generate_elevation_view(house_config, view_type, filepath)

    print("\n" + "="*70)
    print("✓ ELEVATION VIEWS GENERATED")
    print("="*70)


def generate_all_floor_plans(house_config: dict, output_dir: str = None):
    """
    Generate SVG floor plans for all floors in the house configuration.

    Args:
        house_config: Complete house configuration
        output_dir: Directory to save SVG files (defaults to docs folder for web deployment)
    """
    import os

    if output_dir is None:
        # Get the blend file directory
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            blend_dir = os.getcwd()

        # Save to docs folder for web deployment
        output_dir = os.path.join(blend_dir, "docs")

    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "="*70)
    print("GENERATING FLOOR PLANS (SVG)")
    print("="*70)

    for floor_config in house_config.get('floors', []):
        floor_num = floor_config.get('floor_number', 0)
        floor_name = floor_config.get('name', f'Floor_{floor_num}')

        # Clean filename
        filename = f"floor_plan_{floor_num}_{floor_name.replace(' ', '_')}.svg"
        filepath = os.path.join(output_dir, filename)

        print(f"\nGenerating {floor_name}...")
        generate_floor_plan_svg(floor_config, filepath)

    print("\n" + "="*70)
    print("✓ ALL FLOOR PLANS GENERATED")
    print("="*70 + "\n")

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
