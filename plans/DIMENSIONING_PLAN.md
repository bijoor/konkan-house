# Floor Plan Dimensioning System - Design Plan

## Problem Statement
Add dimensions to SVG floor plans while avoiding duplicate dimensions for shared edges between rooms/walls.

## Core Challenges

1. **Shared Edge Detection**: Walls shared between rooms should only be dimensioned once
2. **Dimension Placement**: Where to place dimension lines without overlapping the drawing
3. **Duplicate Avoidance**: Multiple rooms sharing the same wall edge shouldn't create multiple dimensions
4. **Readability**: Dimensions must be clear and not clutter the drawing

## Proposed Solution

### Phase 1: Edge Collection & Deduplication

#### 1.1 Collect All Edges
For each floor, collect edges from:
- Room walls (north, south, east, west)
- Individual wall objects
- Floor slab perimeter (optional)

Each edge defined by:
```python
{
    'type': 'horizontal' | 'vertical',
    'x1': start_x,
    'y1': start_y,
    'x2': end_x,
    'y2': end_y,
    'layer': 'outer' | 'inner',  # Outer = building perimeter, inner = interior walls
    'source': 'room_name' or 'wall_name'  # For debugging
}
```

#### 1.2 Normalize & Deduplicate Edges
- Sort coordinates so edge (x1,y1)→(x2,y2) is same as (x2,y2)→(x1,y1)
- Group edges by coordinates
- For shared edges, keep only one instance

#### 1.3 Classify Edges
- **Outer edges**: Form the building perimeter (detected by checking if only one side has rooms)
- **Inner edges**: Interior walls between rooms
- We'll primarily dimension outer edges + critical interior dimensions

### Phase 2: Dimension Line Placement Strategy

#### 2.1 Outer Perimeter Dimensions
Place dimension lines outside the building:

**Horizontal dimensions (along X-axis):**
- North side: Place above the building (Y offset: -30 units)
- South side: Place below the building (Y offset: +30 units)

**Vertical dimensions (along Y-axis):**
- West side: Place to the left (X offset: -30 units)
- East side: Place to the right (X offset: +30 units)

#### 2.2 Interior Dimensions
For critical interior walls:
- Place dimension text inside rooms
- Use smaller font size
- Only dimension if space > minimum threshold (e.g., 50 units)
- Priority: room widths and lengths

### Phase 3: Dimension Rendering

#### 3.1 SVG Dimension Line Components
```svg
<!-- Example horizontal dimension -->
<g class="dimension">
    <!-- Main dimension line -->
    <line x1="x1" y1="y_offset" x2="x2" y2="y_offset"
          stroke="#000" stroke-width="0.5"/>

    <!-- Extension lines (witness lines) -->
    <line x1="x1" y1="edge_y" x2="x1" y2="y_offset"
          stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>
    <line x1="x2" y1="edge_y" x2="x2" y2="y_offset"
          stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>

    <!-- Arrowheads -->
    <polygon points="x1,y_offset x1+3,y_offset-2 x1+3,y_offset+2" fill="#000"/>
    <polygon points="x2,y_offset x2-3,y_offset-2 x2-3,y_offset+2" fill="#000"/>

    <!-- Dimension text -->
    <text x="(x1+x2)/2" y="y_offset-5" text-anchor="middle" font-size="10">
        {length}" or {length}cm
    </text>
</g>
```

#### 3.2 Dimension Text Format
- Convert units to readable format (e.g., 200 units → 20.0')
- Options:
  - Feet/inches: "20'-6""
  - Metric: "6.25m" or "625cm"
  - Units: "200 units"

### Phase 4: Implementation Steps

#### Step 1: Edge Extraction Function
```python
def extract_floor_edges(floor_config: dict) -> List[dict]:
    """Extract all edges from floor configuration"""
    edges = []

    # From rooms
    for room in rooms:
        if 'north' in walls:
            edges.append({
                'type': 'horizontal',
                'x1': room.x, 'y1': room.y,
                'x2': room.x + room.width, 'y2': room.y,
                'source': f"{room.name}_north"
            })
        # ... similar for other walls

    # From individual walls
    # ... extract from wall objects

    return edges
```

#### Step 2: Edge Deduplication
```python
def deduplicate_edges(edges: List[dict]) -> List[dict]:
    """Remove duplicate edges"""
    unique = {}
    for edge in edges:
        # Create normalized key
        key = normalize_edge_key(edge)
        if key not in unique:
            unique[key] = edge
    return list(unique.values())
```

#### Step 3: Classify Outer Edges
```python
def classify_outer_edges(edges: List[dict], bounds: dict) -> List[dict]:
    """Identify which edges form the outer perimeter"""
    outer_edges = []

    for edge in edges:
        # Check if edge is on building perimeter
        if is_on_perimeter(edge, bounds):
            edge['layer'] = 'outer'
            edge['side'] = get_perimeter_side(edge, bounds)  # 'north', 'south', etc.
            outer_edges.append(edge)

    return outer_edges
```

#### Step 4: SVG Dimension Drawing
```python
def svg_draw_dimension(edge: dict, offset: float, scale: float) -> str:
    """Draw a dimension line with arrows and text"""
    # Generate SVG for dimension line
    # Include witness lines, arrows, and text
    pass
```

#### Step 5: Integration
```python
def generate_floor_plan_svg(..., show_dimensions: bool = True):
    if show_dimensions:
        # Extract edges
        edges = extract_floor_edges(floor_config)

        # Deduplicate
        edges = deduplicate_edges(edges)

        # Classify outer edges
        outer_edges = classify_outer_edges(edges, bounds)

        # Draw dimensions
        for edge in outer_edges:
            svg += svg_draw_dimension(edge, ...)
```

### Phase 5: Configuration Options

Add dimension control parameters:
```python
dimension_config = {
    'show_outer_dimensions': True,    # Show building perimeter dimensions
    'show_inner_dimensions': False,   # Show interior wall dimensions
    'dimension_offset': 30,            # Distance from building (units)
    'unit_format': 'feet',            # 'feet', 'metric', 'units'
    'text_size': 10,                  # Font size for dimension text
    'min_dimension_length': 20,       # Don't dimension edges shorter than this
}
```

## Benefits of This Approach

1. **No Duplicates**: Deduplication ensures shared edges only get one dimension
2. **Clean Layout**: Outer dimensions don't overlap with the drawing
3. **Readable**: Clear dimension lines with proper formatting
4. **Flexible**: Can enable/disable different dimension types
5. **Scalable**: Easy to add room dimensions, window sizes, etc. later

## Future Enhancements

1. **Room Labels with Dimensions**: "Living Room - 20' × 15'"
2. **Door/Window Dimensions**: Show opening widths
3. **Running Dimensions**: Cumulative dimensions along a side
4. **Area Calculations**: Show room square footage
5. **Dimension Layers**: Toggle different dimension sets

## Example Output

```
         ┌─────── 45' ────────┐
         │                    │
    15'  │  [Floor Plan]      │  15'
         │                    │
         └─────── 45' ────────┘
```

## Questions for Review

1. Should we dimension ALL outer edges, or only major spans?
2. Should interior dimensions be on by default?
3. What unit format should be default (feet, metric, or units)?
4. Should we show room dimensions inside rooms?
5. Minimum edge length to dimension (avoid tiny dimensions)?
6. Should dimensions be in a separate SVG layer (for easy toggling)?

## Next Steps

1. Review and approve this plan
2. Implement Phase 1-3 (basic outer dimensions)
3. Test with current floor plans
4. Add configuration options
5. Add interior dimensions (optional)
6. Add room area labels (optional)
