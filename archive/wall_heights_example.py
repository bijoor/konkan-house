# Example: Using wall_heights parameter in create_room()
#
# This demonstrates how to create rooms with different heights for each wall,
# allowing for sloped roofs and custom wall configurations.

# Example 1: Simple room with different wall heights (gable roof)
{
    'type': 'room',
    'name': 'GableRoom',
    'x': 100,
    'y': 100,
    'width': 200,
    'height': 150,
    'walls': ['north', 'south', 'east', 'west'],
    'wall_heights': {
        'north': 100,    # North wall: 10 feet
        'south': 100,    # South wall: 10 feet
        'east': 150,     # East wall: 15 feet (taller for gable)
        'west': 150,     # West wall: 15 feet (taller for gable)
    }
}

# Example 2: Room with sloped walls (hip roof)
{
    'type': 'room',
    'name': 'HipRoofRoom',
    'x': 100,
    'y': 100,
    'width': 200,
    'height': 150,
    'walls': ['north', 'south', 'east', 'west'],
    'wall_heights': {
        'north': {'start': 100, 'end': 150},  # Slopes from 10ft to 15ft (left to right)
        'south': {'start': 150, 'end': 100},  # Slopes from 15ft to 10ft (left to right)
        'east': 150,                          # Flat wall at 15ft
        'west': 100,                          # Flat wall at 10ft
    }
}

# Example 3: Asymmetric room (custom design)
{
    'type': 'room',
    'name': 'CustomRoom',
    'x': 100,
    'y': 100,
    'width': 200,
    'height': 150,
    'walls': ['north', 'south', 'east', 'west'],
    'wall_heights': {
        'north': 120,                         # 12 feet
        'south': 100,                         # 10 feet
        'east': {'start': 100, 'end': 140},   # Slopes from 10ft to 14ft
        'west': 110,                          # 11 feet
    }
}

# Example 4: Mixed - only specify heights for some walls (others use default)
{
    'type': 'room',
    'name': 'PartialCustomRoom',
    'x': 100,
    'y': 100,
    'width': 200,
    'height': 150,
    'height': 100,  # Default height for all walls
    'walls': ['north', 'south', 'east', 'west'],
    'wall_heights': {
        'east': {'start': 100, 'end': 150},   # Only east wall slopes
        'west': {'start': 100, 'end': 150},   # Only west wall slopes
        # north and south will use the default height of 100
    }
}
