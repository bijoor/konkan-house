# New wall rendering logic to replace lines 2856-2986

# Step 1: Extract all walls from rooms into a flat array
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

            # Calculate wall depth based on view type and direction
            if view_type == 'left':  # Looking east from west
                if direction == 'west':  # West walls are visible
                    walls_to_draw.append({
                        'type': 'room_wall',
                        'room_name': room_name,
                        'direction': direction,
                        'depth': room_x,  # Depth for left view is x coordinate
                        'x': room_y,  # SVG x coordinate (mapped from y)
                        'width': room_length,  # SVG width
                        'height': wall_height,
                        'openings': wall_openings.get(wall_key, []),
                        'opening_coord_getter': lambda dw: dw.get('y', 0)
                    })
            elif view_type == 'right':  # Looking west from east
                if direction == 'east':  # East walls are visible
                    walls_to_draw.append({
                        'type': 'room_wall',
                        'room_name': room_name,
                        'direction': direction,
                        'depth': -(room_x + room_width),  # Depth for right view is -x
                        'x': room_y,  # SVG x coordinate (mapped from y)
                        'width': room_length,  # SVG width
                        'height': wall_height,
                        'openings': wall_openings.get(wall_key, []),
                        'opening_coord_getter': lambda dw: dw.get('y', 0)
                    })
            elif view_type == 'front':  # Looking south from north
                if direction == 'north':  # North walls are visible
                    walls_to_draw.append({
                        'type': 'room_wall',
                        'room_name': room_name,
                        'direction': direction,
                        'depth': room_y,  # Depth for front view is y coordinate
                        'x': room_x,  # SVG x coordinate
                        'width': room_width,  # SVG width
                        'height': wall_height,
                        'openings': wall_openings.get(wall_key, []),
                        'opening_coord_getter': lambda dw: dw.get('x', 0)
                    })
            elif view_type == 'back':  # Looking north from south
                if direction == 'south':  # South walls are visible
                    walls_to_draw.append({
                        'type': 'room_wall',
                        'room_name': room_name,
                        'direction': direction,
                        'depth': -(room_y + room_length),  # Depth for back view is -y
                        'x': room_x,  # SVG x coordinate
                        'width': room_width,  # SVG width
                        'height': wall_height,
                        'openings': wall_openings.get(wall_key, []),
                        'opening_coord_getter': lambda dw: dw.get('x', 0)
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
            depth = start_y if view_type == 'front' else -(start_y)

            walls_to_draw.append({
                'type': 'standalone_wall',
                'name': wall_name,
                'depth': depth,
                'x': wall_pos,
                'width': wall_length,
                'height': wall_height_val,
                'height_end': wall_height_end,
                'openings': wall_openings.get(wall_name, []),
                'opening_coord_getter': lambda dw: dw.get('x', 0)
            })
        elif view_type in ['left', 'right'] and is_vertical:
            wall_length = abs(end_y - start_y)
            wall_pos = min(start_y, end_y)
            depth = start_x if view_type == 'left' else -(start_x)

            walls_to_draw.append({
                'type': 'standalone_wall',
                'name': wall_name,
                'depth': depth,
                'x': wall_pos,
                'width': wall_length,
                'height': wall_height_val,
                'height_end': wall_height_end,
                'openings': wall_openings.get(wall_name, []),
                'opening_coord_getter': lambda dw: dw.get('y', 0)
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

# Step 2: Sort walls by depth (back to front, so deeper/further walls draw first)
walls_to_draw.sort(key=lambda w: w['depth'])

# Step 3: Draw each wall with its associated openings
for wall in walls_to_draw:
    # Draw the wall rectangle/polygon
    if wall.get('height_end') and wall['height'] != wall.get('height_end'):
        # Sloping wall - draw as polygon
        x = wall['x']
        width = wall['width']
        h1 = wall['height']
        h2 = wall['height_end']
        svg += f'<polygon points="{x},{current_z} {x},{current_z + h1} {x + width},{current_z + h2} {x + width},{current_z}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'
    else:
        # Regular wall - draw as rectangle
        svg += f'<rect x="{wall["x"]}" y="{current_z}" width="{wall["width"]}" height="{wall["height"]}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'

    # Draw openings (doors/windows) for this wall
    for opening in wall['openings']:
        opening_type = opening.get('type')
        opening_width = opening['width']
        opening_height = opening['height']
        opening_x = wall['opening_coord_getter'](opening)

        if opening_type == 'window':
            sill_height = opening.get('sill_height', 30)
            opening_bottom = current_z + sill_height
        else:  # door
            opening_bottom = current_z

        fill_color = "#87CEEB" if opening_type == 'window' else "#D2691E"
        svg += f'<rect x="{opening_x}" y="{opening_bottom}" width="{opening_width}" height="{opening_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'
