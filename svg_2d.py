"""
Konkan House 2D SVG Functions
Handles all 2D floor plan and elevation view generation

These functions generate SVG drawings for:
- Floor plans (top view)
- Elevation views (front, back, left, right)
- Dimensions and annotations
"""

import math
from typing import Dict, List, Optional

# Import shared configuration
from config import GLOBAL_CONFIG

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


def svg_draw_staircase(x: float, y: float, width: float, length: float, direction: str = 'up', num_steps: int = None) -> str:
    """
    Generate SVG for a staircase (top view).

    Args:
        x, y: Top-left corner
        width, length: Staircase dimensions
        direction: 'up' or 'down' (direction indicator)
        num_steps: Number of steps to draw (default: auto-calculate based on length)

    Returns:
        SVG string
    """
    svg = '<g class="staircase">\n'

    # Draw outline
    svg += f'<rect x="{x}" y="{y}" width="{width}" height="{length}" fill="#E8D5B7" stroke="#000" stroke-width="1"/>\n'

    # Calculate number of steps if not provided
    if num_steps is None:
        # Assume ~10 inches per step
        num_steps = max(3, int(length / 10))

    # Draw step lines
    step_spacing = length / num_steps
    for i in range(1, num_steps):
        step_y = y + i * step_spacing
        svg += f'<line x1="{x}" y1="{step_y}" x2="{x + width}" y2="{step_y}" stroke="#666" stroke-width="0.5"/>\n'

    # Draw direction arrow
    arrow_start_x = x + width / 2
    arrow_margin = length * 0.15

    if direction == 'up':
        # Arrow pointing up
        arrow_start_y = y + length - arrow_margin
        arrow_end_y = y + arrow_margin
        arrow_tip_y = arrow_end_y
        arrow_tip_left_x = arrow_start_x - 5
        arrow_tip_right_x = arrow_start_x + 5
        arrow_tip_base_y = arrow_end_y + 8
    else:
        # Arrow pointing down
        arrow_start_y = y + arrow_margin
        arrow_end_y = y + length - arrow_margin
        arrow_tip_y = arrow_end_y
        arrow_tip_left_x = arrow_start_x - 5
        arrow_tip_right_x = arrow_start_x + 5
        arrow_tip_base_y = arrow_end_y - 8

    # Draw arrow line
    svg += f'<line x1="{arrow_start_x}" y1="{arrow_start_y}" x2="{arrow_start_x}" y2="{arrow_end_y}" stroke="#000" stroke-width="2"/>\n'

    # Draw arrowhead
    svg += f'<polygon points="{arrow_start_x},{arrow_tip_y} {arrow_tip_left_x},{arrow_tip_base_y} {arrow_tip_right_x},{arrow_tip_base_y}" fill="#000"/>\n'

    svg += '</g>\n'
    return svg


# ============================================================================
# DIMENSIONING FUNCTIONS
# ============================================================================

def format_dimension(length: float) -> str:
    """
    Format a dimension value according to config settings.

    Args:
        length: Length in input units

    Returns:
        Formatted string like "20' 6\"" or "20.5'" or "20.5 feet"
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    converted = length / dim_config['unit_conversion']
    precision = dim_config['precision']
    unit = dim_config['unit_display']
    use_feet_inches = dim_config.get('use_feet_inches', False)

    # If displaying in feet and feet-inches format is enabled
    if unit == 'feet' and use_feet_inches:
        feet = int(converted)
        inches = (converted - feet) * 12

        # Round inches to nearest integer or fraction
        inches_rounded = round(inches)

        if feet > 0 and inches_rounded > 0:
            return f"{feet}' {inches_rounded}\""
        elif feet > 0:
            return f"{feet}'"
        else:
            return f"{inches_rounded}\""
    else:
        # Original decimal format
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
    # Account for up to 3 stacked wall levels + 1 overall floor extent dimension
    if dim_config['show_outer_dimensions']:
        offset_increment = dim_config['dimension_offset_increment']
        # Max stacked levels (3) + base offset + floor extent dimension with extra gap
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

    # Draw staircases (after beams, before walls)
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            if obj.get('type') == 'staircase':
                # Handle both old format (x, y, width, length) and new format (start_x, start_y, step_width, step_tread, direction)
                if 'start_x' in obj:
                    # New format with compass direction
                    start_x = obj['start_x']
                    start_y = obj['start_y']
                    step_width = obj.get('step_width', 30)
                    step_tread = obj.get('step_tread', 10)
                    num_steps = obj.get('num_steps', 10)
                    compass_dir = obj.get('direction', 'north')

                    # Convert compass direction to x, y, width, length, and arrow direction
                    # North = upward (decreasing Y), South = downward (increasing Y)
                    if compass_dir == 'north':
                        x, y = start_x, start_y - num_steps * step_tread
                        width, length = step_width, num_steps * step_tread
                        arrow_dir = 'up'
                    elif compass_dir == 'south':
                        x, y = start_x, start_y
                        width, length = step_width, num_steps * step_tread
                        arrow_dir = 'down'
                    elif compass_dir == 'east':
                        x, y = start_x, start_y
                        width, length = num_steps * step_tread, step_width
                        arrow_dir = 'up'
                    elif compass_dir == 'west':
                        x, y = start_x - num_steps * step_tread, start_y
                        width, length = num_steps * step_tread, step_width
                        arrow_dir = 'down'
                else:
                    # Old format
                    x = obj['x']
                    y = obj['y']
                    width = obj['width']
                    length = obj['length']
                    arrow_dir = obj.get('direction', 'up')
                    num_steps = obj.get('num_steps')

                svg += svg_draw_staircase(x, y, width, length, arrow_dir, num_steps)

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

            # Draw overall floor extent dimensions (outer boundary of this floor)
            # Use maximum offset level + 1 to ensure they're outside all other dimensions
            max_north_level = max(north_levels.values()) if north_levels else 0
            max_south_level = max(south_levels.values()) if south_levels else 0
            max_west_level = max(west_levels.values()) if west_levels else 0
            max_east_level = max(east_levels.values()) if east_levels else 0

            floor_extent_offset_increment = offset_increment * 1.5  # Larger gap for clarity

            # Always draw floor extent dimensions based on calculated bounds
            # North total dimension
            floor_extent_offset = base_offset + (max_north_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(min_x, min_y, max_x, min_y, -floor_extent_offset, True, False, False)

            # South total dimension
            floor_extent_offset = base_offset + (max_south_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(min_x, max_y, max_x, max_y, floor_extent_offset, True, False, False)

            # West total dimension
            floor_extent_offset = base_offset + (max_west_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(min_x, min_y, min_x, max_y, -floor_extent_offset, False, False, False)

            # East total dimension
            floor_extent_offset = base_offset + (max_east_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(max_x, min_y, max_x, max_y, floor_extent_offset, False, False, False)

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

    # Add floor slab dimensions if they differ from overall floor dimensions
    # Position them outside all other dimensions to avoid overlap
    if dim_config['show_outer_dimensions'] and 'objects' in floor_config:
        # Calculate overall floor dimensions
        overall_width = max_x - min_x
        overall_length = max_y - min_y

        # Calculate offset to position slab dimensions relative to floor extent dimensions
        # Position them one level inside (smaller than) the floor extent dimensions
        # Get the same offset levels used for perimeter dimensions
        base_offset = dim_config['dimension_offset']
        offset_increment = dim_config['dimension_offset_increment']

        # Use same levels as calculated for floor extent dimensions
        max_north_level = max(north_levels.values()) if north_levels else 0
        max_south_level = max(south_levels.values()) if south_levels else 0
        max_west_level = max(west_levels.values()) if west_levels else 0
        max_east_level = max(east_levels.values()) if east_levels else 0

        floor_extent_offset_increment = offset_increment * 1.5

        # Position slab dimensions one level inside floor extent dimensions
        # This places them between the perimeter dimensions and the floor extent dimensions
        slab_offset_north = base_offset + (max_north_level + 1) * offset_increment + floor_extent_offset_increment * 0.5
        slab_offset_south = base_offset + (max_south_level + 1) * offset_increment + floor_extent_offset_increment * 0.5
        slab_offset_west = base_offset + (max_west_level + 1) * offset_increment + floor_extent_offset_increment * 0.5
        slab_offset_east = base_offset + (max_east_level + 1) * offset_increment + floor_extent_offset_increment * 0.5

        for obj in floor_config['objects']:
            if obj.get('type') == 'floor_slab':
                slab_x = obj['x']
                slab_y = obj['y']
                slab_width = obj['width']
                slab_length = obj['length']

                # Check if slab dimensions differ from overall floor dimensions
                # Allow small tolerance for floating point comparison
                tolerance = 1.0
                width_differs = abs(slab_width - overall_width) > tolerance or abs(slab_x - min_x) > tolerance
                length_differs = abs(slab_length - overall_length) > tolerance or abs(slab_y - min_y) > tolerance

                if width_differs or length_differs:
                    # Add dimensions for this floor slab
                    # Use a distinct style for floor slab dimensions
                    svg += '<g class="floor-slab-dimension">\n'

                    # Add horizontal dimensions (top and bottom)
                    if width_differs:
                        # Top dimension - positioned outside all other dimensions
                        svg += svg_draw_dimension_line(
                            slab_x, slab_y,
                            slab_x + slab_width, slab_y,
                            -slab_offset_north, True, False, False
                        )
                        # Bottom dimension
                        svg += svg_draw_dimension_line(
                            slab_x, slab_y + slab_length,
                            slab_x + slab_width, slab_y + slab_length,
                            slab_offset_south, True, False, False
                        )

                    # Add vertical dimensions (left and right)
                    if length_differs:
                        # Left dimension
                        svg += svg_draw_dimension_line(
                            slab_x, slab_y,
                            slab_x, slab_y + slab_length,
                            -slab_offset_west, False, False, False
                        )
                        # Right dimension
                        svg += svg_draw_dimension_line(
                            slab_x + slab_width, slab_y,
                            slab_x + slab_width, slab_y + slab_length,
                            slab_offset_east, False, False, False
                        )

                    svg += '</g>\n'

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

    # SVG dimensions - increased margins for dimensions
    dim_config = GLOBAL_CONFIG.get('dimensions', {})
    if dim_config.get('show_outer_dimensions', True):
        # Account for dimension lines and text
        horizontal_margin = 150  # Space for left/right vertical dimensions (increased from 100)
        vertical_margin = 150    # Space for top/bottom horizontal dimensions (increased from 100)
        title_space = 60         # Extra space at top for title
    else:
        horizontal_margin = 50
        vertical_margin = 50
        title_space = 40

    svg_width = width * scale + 2 * horizontal_margin
    svg_height = total_height * scale + 2 * vertical_margin + title_space

    # Helper function to convert world Z to SVG Y (inverted)
    def z_to_y(z):
        """Convert world Z coordinate to SVG Y coordinate (flip vertical axis)"""
        return total_height - z

    # Helper function to convert world X/Y to SVG X based on view type
    def world_to_svg_x(coord, obj_width=0):
        """
        Convert world coordinate to SVG X coordinate (mirror for front and right views).

        Args:
            coord: World X or Y coordinate (left edge of object)
            obj_width: Width of object (needed for proper mirroring)

        Returns:
            SVG X coordinate
        """
        if view_type == 'front':
            # Front view: mirror X so west (0) is on left, east (width) is on right
            # For a rectangle at x with width w, the mirrored position is: width - (x + w)
            return width - (coord + obj_width)
        elif view_type == 'right':
            # Right view: mirror Y so south (0) is on left, north (width) is on right
            # For a rectangle at y with width w, the mirrored position is: width - (y + w)
            return width - (coord + obj_width)
        else:
            # Back, left views: keep as is
            return coord

    # Start SVG
    # Add title_space to vertical translation to push content down
    content_top_margin = vertical_margin + title_space
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}">
<title>{view_name}</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
    </style>
</defs>
<g transform="translate({horizontal_margin}, {content_top_margin}) scale({scale}, {scale})">

'''

    # Draw ground line (at ground level, Z=0)
    ground_y = z_to_y(0)
    svg += f'<line x1="0" y1="{ground_y}" x2="{width}" y2="{ground_y}" stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>\n'

    # Draw plinth (from ground to plinth top)
    plinth_bottom_y = z_to_y(0)
    plinth_top_y = z_to_y(plinth_height)
    svg += f'<rect x="0" y="{plinth_top_y}" width="{width}" height="{plinth_bottom_y - plinth_top_y}" fill="#A0826D" stroke="#000" stroke-width="1"/>\n'

    # Current Z level
    current_z = plinth_height

    # Track floor levels for dimensioning
    floor_levels = [
        {'name': 'Ground Level', 'z': 0, 'height': plinth_height},
        {'name': 'Plinth Top', 'z': plinth_height, 'height': 0}
    ]

    # Track openings for dimensioning
    elevation_openings = []

    # Track walls with non-standard heights for dimensioning
    walls_with_custom_heights = []

    # Draw each floor
    slab_thickness = GLOBAL_CONFIG.get('floor_slab_thickness', 4)
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)
    beam_size = GLOBAL_CONFIG.get('beam_size', 8)

    # Get type priority from config for conflict resolution when objects have same depth
    # Lower number = drawn first (appears underneath), Higher number = drawn last (appears on top)
    type_priority = GLOBAL_CONFIG.get('elevation_rendering_priority', {
        'beam': 0,
        'floor_slab': 1,
        'staircase': 1,
        'room': 2,
        'wall': 2,
        'pillar': 3
    })

    # COLLECT ALL OBJECTS FROM ALL FLOORS FIRST
    # This prevents pillars from being overdrawn by objects from higher floors
    all_objects_to_draw = []

    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_height = GLOBAL_CONFIG['floor_heights'].get(floor_num, 100)

        # Collect all objects with their depth coordinate for sorting
        floor_objects_with_depth = []

        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                obj_type = obj.get('type')
                depth = 0  # Depth coordinate for sorting
                priority = type_priority.get(obj_type, 2)  # Default to wall/room priority

                # Calculate depth based on view type
                # Only walls, rooms, slabs, beams, staircases, and pillars are depth-sorted (NOT doors/windows)
                if view_type == 'front':
                    # Front view: sort by Y (smaller Y = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = obj.get('y', 0)
                    elif obj_type == 'room':
                        depth = obj.get('y', 0)
                    elif obj_type == 'wall':
                        depth = min(obj.get('start_y', 0), obj.get('end_y', 0))
                    elif obj_type == 'pillar':
                        depth = obj.get('y', 0)
                elif view_type == 'back':
                    # Back view: sort by Y (larger Y = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = -obj.get('y', 0)  # Negative to reverse sort
                    elif obj_type == 'room':
                        depth = -obj.get('y', 0)
                    elif obj_type == 'wall':
                        depth = -max(obj.get('start_y', 0), obj.get('end_y', 0))
                    elif obj_type == 'pillar':
                        depth = -obj.get('y', 0)
                elif view_type == 'left':
                    # Left view: sort by X (smaller X = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = obj.get('x', 0)
                    elif obj_type == 'room':
                        depth = obj.get('x', 0)
                    elif obj_type == 'wall':
                        depth = min(obj.get('start_x', 0), obj.get('end_x', 0))
                    elif obj_type == 'pillar':
                        depth = obj.get('x', 0)
                elif view_type == 'right':
                    # Right view: sort by X (larger X = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
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
                    elif 'wall_name' in obj or 'wall' in obj:
                        # Door/window belongs to a standalone wall
                        wall_key = obj.get('wall_name') or obj.get('wall')
                    else:
                        # Skip if no parent wall specified
                        continue

                    if wall_key not in wall_openings:
                        wall_openings[wall_key] = []
                    wall_openings[wall_key].append(obj)

        # UNIFIED RENDERING: Collect ALL objects (slabs, beams, walls, pillars) with depth
        objects_to_draw = []

        # Store the Z positions for slabs and walls
        slab_z = current_z
        wall_z = current_z + slab_thickness
        wall_top = wall_z + floor_height

        # Track floor levels for dimensioning
        # Store the height from TOP of slab to TOP of walls (excluding slab thickness)
        floor_name = floor_config.get('name', f'Floor {floor_num}')
        floor_levels.append({
            'name': floor_name,
            'z_bottom': wall_z,  # Top of slab (where walls start)
            'z_top': wall_top,   # Top of walls
            'height': floor_height  # Wall height only
        })

        for depth, priority, obj in floor_objects_with_depth:
            obj_type = obj.get('type')

            if obj_type == 'floor_slab':
                # Add floor slab to unified rendering
                slab_x = obj['x']
                slab_y = obj['y']
                slab_width = obj['width']
                slab_length = obj['length']
                slab_thick = obj.get('thickness', slab_thickness)

                # Calculate position and depth based on view
                if view_type == 'left':
                    # Left view: Y position, -X depth
                    obj_x = slab_y
                    obj_width = slab_length
                    obj_depth = -slab_x
                elif view_type == 'right':
                    # Right view: Y position, +X depth
                    obj_x = slab_y
                    obj_width = slab_length
                    obj_depth = slab_x + slab_width
                elif view_type == 'front':
                    # Front view: X position, -Y depth
                    obj_x = slab_x
                    obj_width = slab_width
                    obj_depth = -slab_y
                elif view_type == 'back':
                    # Back view: X position, +Y depth
                    obj_x = slab_x
                    obj_width = slab_width
                    obj_depth = slab_y + slab_length
                else:
                    continue

                objects_to_draw.append({
                    'type': 'floor_slab',
                    'name': f"Slab_{obj.get('name', '')}",
                    'depth': obj_depth,
                    'priority': type_priority.get('floor_slab', 1),
                    'x': obj_x,
                    'width': obj_width,
                    'height': slab_thick,
                    'z': slab_z,
                    'fill': '#808080'
                })

            elif obj_type == 'beam':
                # Add beam to unified rendering
                beam_x = obj['x']
                beam_y = obj['y']
                beam_width = obj.get('width', beam_size)
                beam_length = obj.get('length', beam_size)
                beam_height = obj.get('height', beam_size)
                beam_orient = obj.get('orientation', 'horizontal')

                # Calculate position and depth based on view and orientation
                if view_type == 'left':
                    if beam_orient in ['horizontal', 'ns']:
                        obj_x = beam_y
                        obj_width = beam_length
                        obj_depth = -beam_x
                    else:  # ew orientation - not visible or just a point
                        continue
                elif view_type == 'right':
                    if beam_orient in ['horizontal', 'ns']:
                        obj_x = beam_y
                        obj_width = beam_length
                        obj_depth = beam_x + beam_width
                    else:
                        continue
                elif view_type == 'front':
                    if beam_orient in ['horizontal', 'ew']:
                        obj_x = beam_x
                        obj_width = beam_width
                        obj_depth = -beam_y
                    else:
                        continue
                elif view_type == 'back':
                    if beam_orient in ['horizontal', 'ew']:
                        obj_x = beam_x
                        obj_width = beam_width
                        obj_depth = beam_y + beam_length
                    else:
                        continue
                else:
                    continue

                # Place beam at floor slab level (beams support the slab from below)
                beam_z = slab_z

                objects_to_draw.append({
                    'type': 'beam',
                    'name': f"Beam_{obj.get('name', '')}",
                    'depth': obj_depth,
                    'priority': type_priority.get('beam', 0),
                    'x': obj_x,
                    'width': obj_width,
                    'height': beam_height,
                    'z': beam_z,
                    'fill': '#654321'
                })

            elif obj_type == 'staircase':
                # Add staircase to unified rendering
                # Handle both old format (x, y, width, length) and new format (start_x, start_y, step_width, step_tread, direction)
                if 'start_x' in obj:
                    # New format with compass direction
                    start_x = obj['start_x']
                    start_y = obj['start_y']
                    step_width = obj.get('step_width', 30)
                    step_tread = obj.get('step_tread', 10)
                    num_steps = obj.get('num_steps', 10)
                    compass_dir = obj.get('direction', 'north')

                    # Convert compass direction to x, y, width, length
                    # North = upward (decreasing Y), South = downward (increasing Y)
                    if compass_dir == 'north':
                        stair_x, stair_y = start_x, start_y - num_steps * step_tread
                        stair_width, stair_length = step_width, num_steps * step_tread
                    elif compass_dir == 'south':
                        stair_x, stair_y = start_x, start_y
                        stair_width, stair_length = step_width, num_steps * step_tread
                    elif compass_dir == 'east':
                        stair_x, stair_y = start_x, start_y
                        stair_width, stair_length = num_steps * step_tread, step_width
                    elif compass_dir == 'west':
                        stair_x, stair_y = start_x - num_steps * step_tread, start_y
                        stair_width, stair_length = num_steps * step_tread, step_width
                else:
                    # Old format
                    stair_x = obj['x']
                    stair_y = obj['y']
                    stair_width = obj['width']
                    stair_length = obj['length']
                    num_steps = obj.get('num_steps')

                    # Auto-calculate steps if not provided
                    if num_steps is None:
                        num_steps = max(3, int(stair_length / 10))

                # Calculate total rise (vertical height)
                # Use step_rise from config if available, otherwise assume 7 inches (standard)
                step_rise = obj.get('step_rise', 7)
                total_rise = num_steps * step_rise

                # Calculate position and depth based on view
                if view_type == 'left':
                    # Left view: Y position, -X depth
                    obj_x = stair_y
                    obj_width = stair_length
                    obj_depth = -stair_x
                elif view_type == 'right':
                    # Right view: Y position, +X depth
                    obj_x = stair_y
                    obj_width = stair_length
                    obj_depth = stair_x + stair_width
                elif view_type == 'front':
                    # Front view: X position, -Y depth
                    obj_x = stair_x
                    obj_width = stair_width
                    obj_depth = -stair_y
                elif view_type == 'back':
                    # Back view: X position, +Y depth
                    obj_x = stair_x
                    obj_width = stair_width
                    obj_depth = stair_y + stair_length
                else:
                    continue

                objects_to_draw.append({
                    'type': 'staircase',
                    'name': f"Stair_{obj.get('name', '')}",
                    'depth': obj_depth,
                    'priority': type_priority.get('staircase', 1),
                    'x': obj_x,
                    'width': obj_width,
                    'height': total_rise,
                    'z': wall_z,
                    'num_steps': num_steps,
                    'fill': '#C19A6B'
                })

            elif obj_type == 'room':
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
                    # Show ALL walls in each view and let depth sorting handle visibility
                    if view_type in ['left', 'right']:
                        # Left/right views: show both west AND east walls
                        if direction == 'west':
                            depth = -room_x if view_type == 'left' else -(room_x + wall_thickness)
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_y,
                                'width': room_length,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'y',
                                'floor_height_expected': floor_height
                            })
                        elif direction == 'east':
                            depth = (room_x + room_width) if view_type == 'right' else -(room_x + room_width - wall_thickness)
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_y,
                                'width': room_length,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'y',
                                'floor_height_expected': floor_height
                            })
                    elif view_type in ['front', 'back']:
                        # Front/back views: show both north AND south walls
                        if direction == 'north':
                            depth = -room_y if view_type == 'front' else room_y
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_x,
                                'width': room_width,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'x',
                                'floor_height_expected': floor_height
                            })
                        elif direction == 'south':
                            depth = (room_y + room_length) if view_type == 'back' else -(room_y + room_length)
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_x,
                                'width': room_width,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'x',
                                'floor_height_expected': floor_height
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
                    # Front: smaller Y (north) = closer = negative depth
                    # Back: larger Y (south) = closer = positive depth
                    depth = -start_y if view_type == 'front' else start_y

                    objects_to_draw.append({
                        'type': 'wall',
                        'name': wall_name,
                        'depth': depth,
                        'priority': type_priority.get('wall', 2),
                        'x': wall_pos,
                        'width': wall_length,
                        'height': wall_height_val,
                        'height_end': wall_height_end,
                        'z': wall_z,
                        'openings': wall_openings.get(wall_name, []),
                        'coord_key': 'x',  # Use 'x' coordinate for front/back view
                        'floor_height_expected': floor_height
                    })
                elif view_type in ['left', 'right'] and is_vertical:
                    wall_length = abs(end_y - start_y)
                    wall_pos = min(start_y, end_y)
                    # Left view: -X (larger X = further back), Right view: +X (larger X = closer)
                    depth = -start_x if view_type == 'left' else start_x

                    objects_to_draw.append({
                        'type': 'wall',
                        'name': wall_name,
                        'depth': depth,
                        'priority': type_priority.get('wall', 2),
                        'x': wall_pos,
                        'width': wall_length,
                        'height': wall_height_val,
                        'height_end': wall_height_end,
                        'z': wall_z,
                        'openings': wall_openings.get(wall_name, []),
                        'coord_key': 'y',  # Use 'y' coordinate for left/right view
                        'floor_height_expected': floor_height
                    })

            elif obj_type == 'pillar':
                pillar_size = obj.get('size', wall_thickness)
                pillar_height = obj.get('height', floor_height)
                pillar_world_x = obj['x']
                pillar_world_y = obj['y']

                # Calculate depth and position based on view
                # Pillar coords are CENTER, so we need to use nearest edge for depth
                if view_type == 'left':
                    # Left view: looking from west (negative X), nearest edge is at x - size/2
                    pillar_x = pillar_world_y - pillar_size / 2
                    depth = -(pillar_world_x - pillar_size / 2)
                elif view_type == 'right':
                    # Right view: looking from east (positive X), nearest edge is at x + size/2
                    pillar_x = pillar_world_y - pillar_size / 2
                    depth = pillar_world_x + pillar_size / 2
                elif view_type == 'front':
                    # Front view: looking from north (negative Y), nearest edge is at y - size/2
                    pillar_x = pillar_world_x - pillar_size / 2
                    depth = -(pillar_world_y - pillar_size / 2)
                elif view_type == 'back':
                    # Back view: looking from south (positive Y), nearest edge is at y + size/2
                    pillar_x = pillar_world_x - pillar_size / 2
                    depth = pillar_world_y + pillar_size / 2
                else:
                    continue

                # Add pillar to objects array for depth sorting
                objects_to_draw.append({
                    'type': 'pillar',
                    'name': f"Pillar_{obj.get('name', '')}",
                    'depth': depth,
                    'priority': type_priority.get('pillar', 3),
                    'x': pillar_x,
                    'width': pillar_size,
                    'height': pillar_height,
                    'z': wall_z,
                    'openings': [],
                    'coord_key': None  # Pillars don't have openings
                })

        # Step 2: Sort objects by depth (back to front), then by priority
        # Priority ensures correct layering when objects have same depth
        objects_to_draw.sort(key=lambda w: (w['depth'], w.get('priority', 2)))

        # DEBUG: Save objects_to_draw to JSON for examination
        import json
        debug_data = {
            'view_type': view_type,
            'floor_number': floor_num,
            'current_z': current_z,
            'objects': []
        }
        for obj in objects_to_draw:
            # Create a JSON-serializable copy
            obj_copy = {
                'type': obj.get('type', 'unknown'),
                'name': obj.get('name', 'unnamed'),
                'depth': obj['depth'],
                'priority': obj.get('priority', 2),
                'x': obj['x'],
                'width': obj['width'],
                'height': obj['height'],
                'z': obj['z'],
                'height_end': obj.get('height_end'),
                'coord_key': obj.get('coord_key'),
                'num_openings': len(obj.get('openings', [])),
                'openings': []
            }
            # Add opening details for walls
            for opening in obj.get('openings', []):
                obj_copy['openings'].append({
                    'type': opening.get('type'),
                    'wall': obj.get('name', 'unnamed'),  # The wall this opening is associated with
                    'x': opening.get('x'),
                    'y': opening.get('y'),
                    'width': opening['width'],
                    'height': opening['height'],
                    'room': opening.get('room'),
                    'direction': opening.get('direction'),
                    'sill_height': opening.get('sill_height')
                })
            debug_data['objects'].append(obj_copy)

        # Save to docs folder
        try:
            import os
            debug_file = os.path.join(os.path.dirname(output_path) if output_path else '.', f'objects_debug_{view_type}_floor{floor_num}.json')
            with open(debug_file, 'w') as f:
                json.dump(debug_data, f, indent=2)
            print(f"  DEBUG: Saved objects data to {debug_file}")
        except Exception as e:
            print(f"  DEBUG: Could not save debug file: {e}")

        # Step 3: Add objects from this floor to the global collection
        all_objects_to_draw.extend(objects_to_draw)

        # Draw roof if exists
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') == 'gable_roof':
                    import math

                    ridge_z_relative = obj.get('ridge_z', 0)
                    ridge_start_x = obj.get('ridge_start_x', 0)
                    ridge_start_y = obj.get('ridge_start_y', 0)
                    ridge_length = obj.get('ridge_length', 0)
                    left_slope_angle = obj.get('left_slope_angle', 22)
                    left_slope_length = obj.get('left_slope_length', 0)
                    right_slope_angle = obj.get('right_slope_angle', 26)
                    right_slope_length = obj.get('right_slope_length', 0)
                    roof_thickness = GLOBAL_CONFIG.get('roof_thickness', 8)

                    # Ridge Z is relative to the floor's base (current_z), just like in the 3D model
                    # This is the bottom of this floor's slab
                    ridge_z = current_z + ridge_z_relative

                    # Ridge runs along X axis, from (ridge_start_x, ridge_start_y) to (ridge_start_x + ridge_length, ridge_start_y)

                    # Calculate eave positions
                    left_horizontal = left_slope_length * math.cos(math.radians(left_slope_angle))
                    left_drop = left_slope_length * math.sin(math.radians(left_slope_angle))
                    right_horizontal = right_slope_length * math.cos(math.radians(right_slope_angle))
                    right_drop = right_slope_length * math.sin(math.radians(right_slope_angle))

                    left_eave_y = ridge_start_y - left_horizontal
                    left_eave_z = ridge_z - left_drop
                    right_eave_y = ridge_start_y + right_horizontal
                    right_eave_z = ridge_z - right_drop

                    ridge_end_x = ridge_start_x + ridge_length

                    if view_type in ['left', 'right']:
                        # Show gable end (triangle) - looking along X, showing Y-Z
                        # This shows the roof profile with thickness
                        ridge_svg_y = z_to_y(ridge_z + roof_thickness)
                        left_eave_svg_y = z_to_y(left_eave_z)
                        right_eave_svg_y = z_to_y(right_eave_z)

                        ridge_svg_x = world_to_svg_x(ridge_start_y, 0)
                        left_eave_svg_x = world_to_svg_x(left_eave_y, 0)
                        right_eave_svg_x = world_to_svg_x(right_eave_y, 0)

                        # Draw left slope as thick line
                        svg += f'<line x1="{left_eave_svg_x}" y1="{left_eave_svg_y}" x2="{ridge_svg_x}" y2="{ridge_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness}"/>\n'
                        # Draw right slope as thick line
                        svg += f'<line x1="{ridge_svg_x}" y1="{ridge_svg_y}" x2="{right_eave_svg_x}" y2="{right_eave_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness}"/>\n'
                    else:
                        # Front/back view - show ridge as horizontal line at the top
                        # Ridge runs along X from ridge_start_x to ridge_end_x at height ridge_z
                        ridge_svg_y = z_to_y(ridge_z)

                        ridge_start_svg_x = world_to_svg_x(ridge_start_x, 0)
                        ridge_end_svg_x = world_to_svg_x(ridge_end_x, 0)

                        # Draw ridge as horizontal line (coordinates are in world units, SVG transform handles scaling)
                        svg += f'<line x1="{ridge_start_svg_x}" y1="{ridge_svg_y}" x2="{ridge_end_svg_x}" y2="{ridge_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness}"/>\n'

        current_z = wall_top

    # AFTER ALL FLOORS: Sort all objects globally and draw them
    # Sort by depth (back to front), then by priority (for same depth)
    all_objects_to_draw.sort(key=lambda w: (w['depth'], w.get('priority', 2)))

    # Find the MAXIMUM depth among walls (front-most walls only)
    # Objects are sorted by depth: smaller=back, larger=front
    # So maximum depth = closest to viewer = walls we want to dimension
    wall_depths = [obj['depth'] for obj in all_objects_to_draw if obj.get('type') == 'wall']
    max_wall_depth = max(wall_depths) if wall_depths else float('-inf')
    depth_tolerance = 5.0  # Consider walls within this depth range as "front-most"

    # Draw each object in global depth order
    for obj in all_objects_to_draw:
        obj_type = obj.get('type')
        obj_x_world = obj['x']  # World X coordinate
        obj_z = obj['z']  # World Z coordinate (bottom of object)
        obj_width = obj['width']
        obj_height = obj['height']

        # Convert world coordinates to SVG coordinates
        obj_x = world_to_svg_x(obj_x_world, obj_width)  # Convert X with mirroring
        obj_bottom_y = z_to_y(obj_z)
        obj_top_y = z_to_y(obj_z + obj_height)
        obj_svg_height = obj_bottom_y - obj_top_y

        if obj_type == 'floor_slab':
            # Draw floor slab
            fill_color = obj.get('fill', '#808080')
            svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

        elif obj_type == 'beam':
            # Draw beam
            fill_color = obj.get('fill', '#654321')
            svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

        elif obj_type == 'staircase':
            # Draw staircase with steps in elevation view
            num_steps = obj.get('num_steps', 10)
            fill_color = obj.get('fill', '#C19A6B')

            # Draw individual steps (risers and treads)
            tread_run = obj_width / num_steps  # Horizontal depth of each tread
            riser_height = obj_svg_height / num_steps  # Vertical height of each riser

            svg += '<g class="staircase-elevation">\n'
            for i in range(num_steps):
                step_x = obj_x + i * tread_run
                step_bottom_y = obj_bottom_y - i * riser_height
                step_top_y = step_bottom_y - riser_height

                # Draw riser (vertical)
                svg += f'<line x1="{step_x}" y1="{step_bottom_y}" x2="{step_x}" y2="{step_top_y}" stroke="#000" stroke-width="0.5"/>\n'

                # Draw tread (horizontal)
                svg += f'<line x1="{step_x}" y1="{step_top_y}" x2="{step_x + tread_run}" y2="{step_top_y}" stroke="#000" stroke-width="0.5"/>\n'

                # Fill the step
                svg += f'<rect x="{step_x}" y="{step_top_y}" width="{tread_run}" height="{riser_height}" fill="{fill_color}" opacity="0.7"/>\n'

            # Close the staircase outline
            last_step_x = obj_x + num_steps * tread_run
            svg += f'<line x1="{last_step_x}" y1="{obj_top_y}" x2="{last_step_x}" y2="{obj_bottom_y}" stroke="#000" stroke-width="0.5"/>\n'
            svg += f'<line x1="{obj_x}" y1="{obj_bottom_y}" x2="{last_step_x}" y2="{obj_bottom_y}" stroke="#000" stroke-width="0.5"/>\n'
            svg += '</g>\n'

        elif obj_type == 'pillar':
            # Draw pillar as solid black rectangle
            svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="#000" stroke="#000" stroke-width="0.5"/>\n'

        elif obj_type == 'wall':
            # Draw the wall
            # Check if this is a sloping wall (has different height at start vs end)
            # Must explicitly check that height_end key exists AND is different from height
            # Note: height_end can be 0 (valid for walls that slope down to nothing)
            has_height_end = 'height_end' in obj
            height_end_value = obj.get('height_end') if has_height_end else None
            is_sloping = has_height_end and (height_end_value is not None) and (obj_height != height_end_value)

            if is_sloping:
                # Sloping wall - convert all four corners
                # For mirrored views (front, right), swap the heights since we're reversing the wall direction
                if view_type in ['front', 'right']:
                    # Swap heights for mirrored views
                    h_left = obj['height_end']  # What was on right is now on left
                    h_right = obj_height        # What was on left is now on right
                else:
                    # No mirroring, use original heights
                    h_left = obj_height
                    h_right = obj['height_end']

                # Four corners: bottom-left, top-left, top-right, bottom-right
                bl_y = z_to_y(obj_z)
                tl_y = z_to_y(obj_z + h_left)
                tr_y = z_to_y(obj_z + h_right)
                br_y = z_to_y(obj_z)
                # For polygons, we need to convert each X coordinate separately
                x_left = obj_x
                x_right = obj_x + obj_width
                svg += f'<polygon points="{x_left},{bl_y} {x_left},{tl_y} {x_right},{tr_y} {x_right},{br_y}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'
            else:
                # Regular wall
                svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'

            # Check if this wall is at the front (for dimensioning)
            # Front walls have depth close to the maximum (closest to viewer)
            is_front_wall = abs(obj['depth'] - max_wall_depth) <= depth_tolerance

            # Track walls with non-standard heights for dimensioning
            # Check if this wall's height differs from the expected floor height
            if is_front_wall and 'floor_height_expected' in obj:
                expected_height = obj['floor_height_expected']
                actual_height = obj_height
                height_end = obj.get('height_end', actual_height)

                # Check if height differs from expected (tolerance for floating point)
                height_tolerance = 1.0
                has_custom_height = abs(actual_height - expected_height) > height_tolerance
                has_custom_height_end = abs(height_end - expected_height) > height_tolerance

                # Only show dimensions if at least one height differs from expected
                # This excludes sloping walls that slope within the normal floor height range
                if has_custom_height or has_custom_height_end:
                    walls_with_custom_heights.append({
                        'name': obj.get('name', ''),
                        'x': obj_x_world,
                        'width': obj_width,
                        'z': obj_z,
                        'height_start': actual_height,
                        'height_end': height_end,
                        'is_sloping': is_sloping,
                        'expected_height': expected_height
                    })

            # Draw openings for this wall
            for opening in obj.get('openings', []):
                opening_type = opening.get('type')
                opening_width = opening['width']
                opening_height = opening['height']
                # Get the correct coordinate based on view direction
                coord_key = obj['coord_key']
                opening_x_world = opening.get(coord_key, 0)

                # Convert opening X coordinate with mirroring
                opening_x = world_to_svg_x(opening_x_world, opening_width)

                # Calculate opening position in world Z
                if opening_type == 'window':
                    sill_height = opening.get('sill_height', 30)
                    opening_z_bottom = obj_z + sill_height
                else:
                    opening_z_bottom = obj_z

                # Convert to SVG Y coordinates
                opening_svg_bottom_y = z_to_y(opening_z_bottom)
                opening_svg_top_y = z_to_y(opening_z_bottom + opening_height)
                opening_svg_height = opening_svg_bottom_y - opening_svg_top_y

                fill_color = "#87CEEB" if opening_type == 'window' else "#D2691E"
                svg += f'<rect x="{opening_x}" y="{opening_svg_top_y}" width="{opening_width}" height="{opening_svg_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

                # Track opening for dimensioning ONLY if it's on a front-most wall
                if is_front_wall:
                    elevation_openings.append({
                        'type': opening_type,
                        'x': opening_x_world,  # Store world X for dimension calculation
                        'z_bottom': opening_z_bottom,  # World Z coordinate
                        'width': opening_width,
                        'height': opening_height,
                        'sill_height': opening.get('sill_height', 0) if opening_type == 'window' else 0,
                        'wall_start': obj_x_world,  # Wall start position for calculating offsets
                        'wall_width': obj_width,    # Wall width
                        'wall_name': obj.get('name', '')  # Wall name for grouping
                    })

    # ====================================================================
    # ADD DIMENSIONS TO ELEVATION
    # ====================================================================

    dim_config = GLOBAL_CONFIG.get('dimensions', {})
    if dim_config.get('show_outer_dimensions', True):
        base_offset = 30
        offset_increment = 20

        # 1. RIGHT SIDE: Individual floor heights (from slab top to wall top)
        # Show floor heights on the right side only
        right_offset = base_offset
        for level in floor_levels:
            # Skip initial plinth entries that don't have z_bottom/z_top
            if 'z_bottom' not in level or 'z_top' not in level:
                continue

            if level['height'] > 0:
                # Convert world Z to SVG Y
                # z_bottom is top of slab, z_top is top of walls
                y_bottom = z_to_y(level['z_bottom'])
                y_top = z_to_y(level['z_top'])
                svg += svg_draw_dimension_line(
                    width, y_bottom,
                    width, y_top,
                    right_offset,
                    is_horizontal=False,
                    adjust_start=False,
                    adjust_end=False
                )

        # 2. TOP: Overall width
        # Draw overall width dimension at the top (at the highest point)
        top_y = z_to_y(total_height)
        top_offset = -base_offset
        svg += svg_draw_dimension_line(
            0, top_y,
            width, top_y,
            top_offset,
            is_horizontal=True,
            adjust_start=False,
            adjust_end=False
        )

        # 3. OPENING DIMENSIONS: Show offsets and gaps like floor plans
        # Group openings by wall name only (not z_bottom, so doors and windows are together)
        if elevation_openings:
            # Group openings by wall name only
            wall_groups = {}
            for opening in elevation_openings:
                wall_key = opening['wall_name']
                if wall_key not in wall_groups:
                    wall_groups[wall_key] = []
                wall_groups[wall_key].append(opening)

            # Process each wall group separately
            for wall_key, wall_openings in wall_groups.items():
                if not wall_openings:
                    continue

                # Sort openings by x position along the wall
                sorted_openings = sorted(wall_openings, key=lambda o: o['x'])

                # Get wall info from first opening
                wall_start = sorted_openings[0]['wall_start']
                wall_width = sorted_openings[0]['wall_width']

                # Use the minimum z_bottom for dimension line position (typically floor level for doors)
                # This ensures dimension lines don't overlap with the openings themselves
                min_z_bottom = min(opening['z_bottom'] for opening in sorted_openings)
                opening_y = z_to_y(min_z_bottom)

                # Use half the base offset for opening dimensions
                opening_base_offset = base_offset / 2
                offset = opening_base_offset

                # Draw dimensions: offset to first, then gaps and widths
                current_pos = wall_start

                for i, opening in enumerate(sorted_openings):
                    opening_start = opening['x']
                    opening_end = opening['x'] + opening['width']

                    # Dimension from current position to opening start (offset or gap)
                    if opening_start > current_pos:
                        gap = opening_start - current_pos
                        # Convert to SVG coordinates with mirroring
                        start_svg = world_to_svg_x(current_pos, 0)
                        end_svg = world_to_svg_x(opening_start, 0)

                        svg += svg_draw_dimension_line(
                            min(start_svg, end_svg), opening_y,
                            max(start_svg, end_svg), opening_y,
                            offset,
                            is_horizontal=True,
                            adjust_start=False,
                            adjust_end=False
                        )

                    # Dimension for opening width
                    opening_start_svg = world_to_svg_x(opening_start, opening['width'])
                    svg += svg_draw_dimension_line(
                        opening_start_svg, opening_y,
                        opening_start_svg + opening['width'], opening_y,
                        offset,
                        is_horizontal=True,
                        adjust_start=False,
                        adjust_end=False
                    )

                    current_pos = opening_end

        # 4. WALL HEIGHT DIMENSIONS: Show heights for walls with non-standard heights
        # These are walls whose height differs from the expected floor height (especially sloping walls)
        if walls_with_custom_heights:
            # Position these dimensions on the left side
            left_offset = -base_offset

            # Track which height ranges we've already dimensioned to avoid duplicates
            # (e.g., two walls with heights 0→47 and 47→0 have the same range)
            dimensioned_height_ranges = set()

            for wall in walls_with_custom_heights:
                wall_x_world = wall['x']
                wall_width = wall['width']
                wall_z = wall['z']
                height_start = wall['height_start']
                height_end = wall['height_end']
                is_sloping = wall['is_sloping']

                # Create a normalized height range key (min to max) to detect duplicates
                height_range = (min(height_start, height_end), max(height_start, height_end))

                # Skip if we've already dimensioned this height range
                if height_range in dimensioned_height_ranges:
                    continue

                dimensioned_height_ranges.add(height_range)

                # Convert world coordinates to SVG
                wall_x_svg = world_to_svg_x(wall_x_world, wall_width)
                wall_bottom_y = z_to_y(wall_z)

                if is_sloping:
                    # For sloping walls, show dimensions at both ends
                    # Handle mirroring for front/right views
                    if view_type in ['front', 'right']:
                        # Heights are swapped for mirrored views
                        h_left = height_end
                        h_right = height_start
                    else:
                        h_left = height_start
                        h_right = height_end

                    # Left edge dimension
                    wall_top_left_y = z_to_y(wall_z + h_left)
                    svg += svg_draw_dimension_line(
                        wall_x_svg, wall_bottom_y,
                        wall_x_svg, wall_top_left_y,
                        left_offset,
                        is_horizontal=False,
                        adjust_start=False,
                        adjust_end=False
                    )

                    # Right edge dimension
                    wall_top_right_y = z_to_y(wall_z + h_right)
                    svg += svg_draw_dimension_line(
                        wall_x_svg + wall_width, wall_bottom_y,
                        wall_x_svg + wall_width, wall_top_right_y,
                        left_offset,
                        is_horizontal=False,
                        adjust_start=False,
                        adjust_end=False
                    )
                else:
                    # Non-sloping wall with custom height - dimension in the middle
                    wall_top_y = z_to_y(wall_z + height_start)
                    wall_mid_x = wall_x_svg + wall_width / 2
                    svg += svg_draw_dimension_line(
                        wall_mid_x, wall_bottom_y,
                        wall_mid_x, wall_top_y,
                        left_offset,
                        is_horizontal=False,
                        adjust_start=False,
                        adjust_end=False
                    )

    svg += '''</g>
'''

    # Add title in the title space area (vertically centered in the title_space)
    title_y = title_space / 2 + 10  # Centered in title space, slightly offset
    svg += f'<text x="{svg_width/2}" y="{title_y}" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">{view_name}</text>\n'
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
        # Get the blend file directory (if running in Blender) or use current directory
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            # Not running in Blender, use current directory
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
        # Get the blend file directory (if running in Blender) or use current directory
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            # Not running in Blender, use current directory
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



# ============================================================================
# COMBINED VIEW GENERATION
# ============================================================================

def generate_combined_floor_plans(house_config: dict, output_dir: str = None) -> str:
    """
    Generate a single combined SVG showing all floor plans side-by-side.
    Uses consistent scaling across all floors for direct comparison.
    
    Args:
        house_config: Complete house configuration
        output_dir: Directory to save the combined SVG
        
    Returns:
        Path to the generated combined SVG file
    """
    import os
    
    if output_dir is None:
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            blend_dir = os.getcwd()
        output_dir = os.path.join(blend_dir, "docs")
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("\nGenerating combined floor plans...")
    
    floors = house_config['floors']
    
    # Use consistent scale for all floors
    scale = 2.0
    spacing = 100  # Spacing between floor plans (actual visual spacing)
    left_right_margin = 80  # Extra margin on left/right to prevent clipping
    top_margin = 60
    bottom_margin = 120  # Extra space for labels at bottom
    title_space = 40  # Space for main title at top
    label_offset = 30  # Space between content and label

    # Generate content for each floor and calculate dimensions
    floor_data = []
    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_name = floor_config['name']

        # Generate the floor plan SVG content (pass None for output_path to get string only)
        from io import StringIO
        import sys

        # Temporarily capture print output
        old_stdout = sys.stdout
        sys.stdout = StringIO()

        # IMPORTANT: generate_floor_plan_svg takes floor_config (not house_config)
        svg_content = generate_floor_plan_svg(floor_config, output_path=None, scale=scale)

        # Restore stdout
        sys.stdout = old_stdout

        # Extract the entire content group WITH its transform
        import re
        # Find the opening transform tag and extract transform values
        transform_pattern = r'<g transform="translate\(([0-9.]+),\s*([0-9.]+)\)\s*scale\([^)]+\)">'
        transform_match = re.search(transform_pattern, svg_content)

        if not transform_match:
            print(f"Warning: Could not find transform tag for {floor_name}")
            continue

        translate_x = float(transform_match.group(1))
        translate_y = float(transform_match.group(2))
        start_pos = transform_match.end()

        # Find the MATCHING closing </g> tag by counting nested tags
        depth = 1
        pos = start_pos
        while depth > 0 and pos < len(svg_content):
            next_open = svg_content.find('<g ', pos)
            next_close = svg_content.find('</g>', pos)

            if next_close == -1:
                break

            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 3
            else:
                depth -= 1
                if depth == 0:
                    content_only = svg_content[start_pos:next_close]
                    break
                pos = next_close + 4

        if depth != 0:
            print(f"Warning: Could not find matching closing tag for {floor_name}")
            continue

        # Reconstruct with the transform
        drawing_content_with_transform = f'<g transform="translate({translate_x}, {translate_y}) scale(2.0, 2.0)">\n{content_only}\n</g>'

        # Extract SVG dimensions and scale from transform
        svg_match = re.search(r'<svg[^>]+width="([0-9.]+)"[^>]+height="([0-9.]+)"', svg_content)
        scale_match = re.search(r'scale\(([0-9.]+)', drawing_content_with_transform)

        if svg_match:
            svg_width = float(svg_match.group(1))
            svg_height = float(svg_match.group(2))
        else:
            svg_width = 1000
            svg_height = 1000

        if scale_match:
            content_scale = float(scale_match.group(1))
        else:
            content_scale = scale  # use the scale we passed in

        # Calculate actual content bounds
        if 'objects' in floor_config:
            min_x, min_y = float('inf'), float('inf')
            max_x, max_y = float('-inf'), float('-inf')

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

            # Visual dimensions = content_size * scale (without translate offset)
            content_width = (max_x - min_x) * content_scale
            content_height = (max_y - min_y) * content_scale
        else:
            translate_x = 0
            content_width = svg_width

        # Use the actual SVG canvas height (includes dimension lines)
        # instead of just the visual content height
        floor_data.append({
            'name': floor_name,
            'number': floor_num,
            'content': drawing_content_with_transform,
            'canvas_width': svg_width,  # Canvas width for spacing between floors
            'canvas_height': svg_height,  # Full canvas height including dimensions
            'translate_x': translate_x,  # X offset for label centering
            'content_width': content_width,  # Pure content width for centering labels
        })
    
    if not floor_data:
        print("Error: No floor plan data generated")
        return None
    
    # Calculate total dimensions
    max_height = max(f['canvas_height'] for f in floor_data)
    total_width = sum(f['canvas_width'] for f in floor_data) + spacing * (len(floor_data) - 1)

    canvas_width = total_width + 2 * left_right_margin
    # Canvas height needs to accommodate: title + top margin + tallest content + label offset + bottom margin
    canvas_height = title_space + top_margin + max_height + label_offset + bottom_margin

    # Start building the combined SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_width}" height="{canvas_height}" viewBox="0 0 {canvas_width} {canvas_height}">
<title>All Floor Plans</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
        .floor-label {{ font-size: 16px; font-weight: bold; fill: #333; }}
    </style>
</defs>
'''

    # Add main title
    title_y = title_space - 10
    svg += f'<text x="{canvas_width/2}" y="{title_y}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">All Floor Plans</text>\n'

    # Calculate consistent label Y position (same for all floors)
    label_y = title_space + top_margin + max_height + label_offset

    # Add each floor plan
    current_x = left_right_margin
    content_start_y = title_space + top_margin
    for floor in floor_data:
        canvas_width = floor['canvas_width']
        translate_x = floor['translate_x']
        content_width = floor['content_width']

        # Add the floor content (includes its own transform)
        svg += f'<g id="floor_{floor["number"]}">\n'
        svg += f'<g transform="translate({current_x}, {content_start_y})">\n'
        svg += floor['content']
        svg += '</g>\n'

        # Add floor label - centered on visual content (actual building)
        # All labels at same Y position (bottom of canvas)
        label_x = current_x + translate_x + content_width / 2
        svg += f'<text x="{label_x}" y="{label_y}" text-anchor="middle" class="floor-label">{floor["name"]}</text>\n'
        svg += '</g>\n'

        current_x += canvas_width + spacing

    svg += '</svg>'
    
    # Save the combined SVG
    output_path = os.path.join(output_dir, 'floor_plans_combined.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    
    print(f"✓ Combined floor plans saved to: {output_path}")
    return output_path


def generate_combined_elevations(house_config: dict, output_dir: str = None) -> str:
    """
    Generate a single combined SVG showing all elevation views side-by-side.
    Views are in standard architectural order: left, front, right, back.
    Uses consistent scaling across all views for direct comparison.
    
    Args:
        house_config: Complete house configuration
        output_dir: Directory to save the combined SVG
        
    Returns:
        Path to the generated combined SVG file
    """
    import os
    
    if output_dir is None:
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            blend_dir = os.getcwd()
        output_dir = os.path.join(blend_dir, "docs")
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("\nGenerating combined elevations...")
    
    # Standard architectural order
    views = [
        ('left', 'Left Elevation'),
        ('front', 'Front Elevation'),
        ('right', 'Right Elevation'),
        ('back', 'Back Elevation')
    ]
    
    # Use consistent scale for all elevations
    scale = 2.0
    spacing = 100  # Spacing between elevations (actual visual spacing)
    left_right_margin = 80  # Extra margin on left/right to prevent clipping
    top_margin = 60
    bottom_margin = 120  # Extra space for labels at bottom
    title_space = 40  # Space for main title at top
    label_offset = 30  # Space between content and label

    # Generate content for each elevation
    elevation_data = []
    for view_type, view_label in views:
        from io import StringIO
        import sys

        # Temporarily capture print output
        old_stdout = sys.stdout
        sys.stdout = StringIO()

        svg_content = generate_elevation_view(house_config, view_type, scale=scale)

        # Restore stdout
        sys.stdout = old_stdout

        # Extract the entire content group WITH its transform
        import re
        # Find the opening transform tag and extract transform values
        transform_pattern = r'<g transform="translate\(([0-9.]+),\s*([0-9.]+)\)\s*scale\([^)]+\)">'
        transform_match = re.search(transform_pattern, svg_content)

        if not transform_match:
            print(f"Warning: Could not find transform tag for {view_label}")
            continue

        translate_x = float(transform_match.group(1))
        translate_y = float(transform_match.group(2))
        start_pos = transform_match.end()

        # Find the MATCHING closing </g> tag by counting nested tags
        depth = 1
        pos = start_pos
        while depth > 0 and pos < len(svg_content):
            next_open = svg_content.find('<g ', pos)
            next_close = svg_content.find('</g>', pos)

            if next_close == -1:
                break

            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 3
            else:
                depth -= 1
                if depth == 0:
                    content_only = svg_content[start_pos:next_close]
                    break
                pos = next_close + 4

        if depth != 0:
            print(f"Warning: Could not find matching closing tag for {view_label}")
            continue

        # Reconstruct with the transform
        drawing_content_with_transform = f'<g transform="translate({translate_x}, {translate_y}) scale(2.0, 2.0)">\n{content_only}\n</g>'

        # Extract SVG dimensions and scale from transform
        svg_match = re.search(r'<svg[^>]+width="([0-9.]+)"[^>]+height="([0-9.]+)"', svg_content)
        scale_match = re.search(r'scale\(([0-9.]+)', drawing_content_with_transform)

        if svg_match:
            svg_width = float(svg_match.group(1))
            svg_height = float(svg_match.group(2))
        else:
            svg_width = 1000
            svg_height = 800

        if scale_match:
            content_scale = float(scale_match.group(1))
        else:
            content_scale = scale  # use the scale we passed in

        # Calculate actual visual dimensions for elevations
        plinth = house_config.get('plinth', {})

        # Content width depends on view direction
        if view_type in ['front', 'back']:
            base_content_width = plinth.get('width', 0)  # X dimension
        else:  # left, right
            base_content_width = plinth.get('length', 0)  # Y dimension

        # Pure content width (without translate offset)
        scaled_content_width = base_content_width * content_scale

        # Use the actual SVG canvas height (includes dimension lines)
        elevation_data.append({
            'view': view_type,
            'label': view_label,
            'content': drawing_content_with_transform,
            'canvas_width': svg_width,  # Canvas width for spacing between views
            'canvas_height': svg_height,  # Full canvas height including dimensions
            'translate_x': translate_x,  # X offset for label centering
            'content_width': scaled_content_width,  # Pure content width for centering labels
        })
    
    if not elevation_data:
        print("Error: No elevation data generated")
        return None
    
    # Calculate total dimensions
    max_height = max(e['canvas_height'] for e in elevation_data)
    total_width = sum(e['canvas_width'] for e in elevation_data) + spacing * (len(elevation_data) - 1)

    canvas_width = total_width + 2 * left_right_margin
    # Canvas height needs to accommodate: title + top margin + tallest content + label offset + bottom margin
    canvas_height = title_space + top_margin + max_height + label_offset + bottom_margin

    # Start building the combined SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_width}" height="{canvas_height}" viewBox="0 0 {canvas_width} {canvas_height}">
<title>All Elevations</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
        .view-label {{ font-size: 16px; font-weight: bold; fill: #333; }}
    </style>
</defs>
'''

    # Add main title
    title_y = title_space - 10
    svg += f'<text x="{canvas_width/2}" y="{title_y}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">All Elevations</text>\n'

    # Calculate consistent label Y position (same for all elevations)
    label_y = title_space + top_margin + max_height + label_offset

    # Add each elevation
    current_x = left_right_margin
    content_start_y = title_space + top_margin
    for elev in elevation_data:
        canvas_width = elev['canvas_width']
        translate_x = elev['translate_x']
        content_width = elev['content_width']

        # Add the elevation content (includes its own transform)
        svg += f'<g id="elevation_{elev["view"]}">\n'
        svg += f'<g transform="translate({current_x}, {content_start_y})">\n'
        svg += elev['content']
        svg += '</g>\n'

        # Add view label - centered on canvas (entire drawing viewport)
        # All labels at same Y position (bottom of canvas)
        label_x = current_x + canvas_width / 2
        svg += f'<text x="{label_x}" y="{label_y}" text-anchor="middle" class="view-label">{elev["label"]}</text>\n'
        svg += '</g>\n'

        current_x += canvas_width + spacing

    svg += '</svg>'
    
    # Save the combined SVG
    output_path = os.path.join(output_dir, 'elevations_combined.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    
    print(f"✓ Combined elevations saved to: {output_path}")
    return output_path
