# ============================================================================
# GLOBAL CONFIGURATION OVERRIDES
# ============================================================================

import sys
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')
from konkan_house_lib import GLOBAL_CONFIG

# Override default config values
GLOBAL_CONFIG.update({
    'units_to_meters_ratio': 0.1,   # feet to meters
    'scale_factor': 1.0,
    'ground_level_z': 0.0,
    
    'floor_heights': {
        0: 100.0,   # Ground floor: 10 feet
        1: 100.0,    # First floor: 10 feet
        2: 42.0,    # Second floor: 5 feet
        3: 50.0,    # Second floor: 5 feet
    },
    
    'wall_thickness': 8,     # 8 inches = 0.67 feet
    'floor_slab_thickness': 8,  # 4 inches = 0.33 feet
    'plinth_height': 30,       # 1.5 feet
})

# ============================================================================
# HOUSE CONFIGURATION
# ============================================================================

HOUSE_CONFIG = {
    # Overall dimensions and reference point
    'site': {
        'reference_x': 0,      # Top-left corner X
        'reference_y': 0,      # Top-left corner Y
        'plot_length': 450,     # feet
        'plot_width': 270,      # feet
    },
    
    # Foundation
    'plinth': {
        'x': 0,
        'y': 0,
        'length': 450,
        'width': 270,
        'height': 30,  # 3 feet (10 units = 1 foot)
    },
    
    # Floors configuration - unified object-based structure
    'floors': [
        # ============ GROUND FLOOR ============
        {
            'floor_number': 0,
            'name': 'Ground Floor',

            # List of all objects on this floor
            'objects': [
                # Floor slab
                {
                    'type': 'floor_slab',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 450,
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 4,
                    'name': 'Corner_Pillar_1',
                    'height': 235,
                },
                {
                    'type': 'pillar',
                    'x': 106,
                    'y': 4,
                    'name': 'Entrance_Pillar_1',
                    'height': 235,
                },
                {
                    'type': 'pillar',
                    'x': 164,
                    'y': 4,
                    'name': 'Entrance_Pillar_2',
                    'height': 235,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 4,
                    'name': 'Corner_Pillar_2',
                    'height': 235,
                },
                {
                    'type': 'pillar',
                    'x': 44,
                    'y': 296,
                    'name': 'Staircase_Pillar',
                    'height': 100,
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 84,
                    'name': 'West_Pillar_1',
                    'height': 258,
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 200,
                    'name': 'West_Pillar_2',
                    'height': 313,
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 296,
                    'name': 'West_Pillar_3',
                    'height': 258,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 84,
                    'name': 'East_Pillar_1',
                    'height': 258,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 200,
                    'name': 'East_Pillar_2',
                    'height': 313,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 296,
                    'name': 'East_Pillar_3',
                    'height': 258,
                },

                # Rooms - only create exterior walls, not shared partition walls
                {
                    'type': 'room',
                    'name': 'Verandah',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 88,
                    'height': 30,
                    'material': 'verandah',
                    'walls': ['north', 'east', 'west'],  # South is shared with Bedroom/Workshop
                },
                {
                    'type': 'room',
                    'name': 'Bedroom_1',
                    'x': 0,
                    'y': 80,
                    'width': 124,
                    'length': 124,
                    'material': 'bedroom',
                    'walls': ['north','east','west','south'], # East shared with Workshop, South shared with Living_Kitchen
                },
                {
                    'type': 'room',
                    'name': 'Workshop',
                    'x': 116,
                    'y': 80,
                    'width': 154,
                    'length': 124,
                    'material': 'workshop',
                    'walls': ['north','east','south'],  # West shared with Bedroom
                },
                {
                    'type': 'room',
                    'name': 'Bathroom_1',
                    'x': 176,
                    'y': 196,
                    'width': 94,
                    'length': 104,
                    'material': 'bathroom',
                    'walls': ['west','south'],  # North shared with Workshop, West shared with Living_Kitchen
                },
                {
                    'type': 'room',
                    'name': 'Living_Kitchen',
                    'x': 0,
                    'y': 196,
                    'width': 270,
                    'length': 254,
                    'material': 'living',
                    'walls': ['east','west', 'south'],  # North shared with Bedroom/Bathroom, East shared with Bathroom
                },

                {
                    'type': 'wall',
                    'name': 'Washbasin_Wall',
                    'start_x': 136,
                    'start_y': 296,
                    'end_x': 176,
                    'end_y': 296,
                    'material': 'bathroom',
                },

                # Staircases
                {
                    'type': 'staircase',
                    'start_x': 8,
                    'start_y': 430,
                    'direction': 'north',  # 'north', 'south', 'east', or 'west'
                    'num_steps': 20,
                    'step_width': 30,
                    'step_tread': 10,
                    'step_rise': 5,
                    'material': 'floor',
                },

                # Doors
                {
                    'type': 'door',
                    'name': 'Main_Entry',
                    'x': 110,
                    'y': 0,
                    'width': 50,        # 5 feet wide
                    'height': 70,       # 7 feet tall
                    'direction': 'north',
                    'room': 'Verandah',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Workshop_Entry',
                    'x': 124,
                    'y': 80,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'north',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Workshop_Exit',
                    'x': 124,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_Entry',
                    'x': 90,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_1',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_1_Entry',
                    'x': 176,
                    'y': 228,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'west',
                    'room': 'Bathroom_1',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Living_Kitchen_Exit',
                    'x': 98.5,
                    'y': 442,
                    'width': 75,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Living_Kitchen',  # Which room's wall
                },

                # Windows
                {
                    'type': 'window',
                    'name': 'Bedroom_1_Window_North',
                    'x': 35,
                    'y': 80,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_1',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_1_Window_West',
                    'x': 0,
                    'y': 117,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Bedroom_1',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Workshop_Window_North',
                    'x': 187,
                    'y': 80,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Workshop_Window_East',
                    'x': 262,
                    'y': 115,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': ' Bathroom_1_Window_1',
                    'x': 262,
                    'y': 214,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': ' Bathroom_1_Window_2',
                    'x': 262,
                    'y': 254,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': ' Kitchen_Window',
                    'x': 262,
                    'y': 310,
                    'width': 60,        # 4 feet wide
                    'height': 30,       # 4 feet tall
                    'sill_height': 35,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Staircase_Window_1',
                    'x': 0,
                    'y': 224,
                    'width': 40,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Staircase_Window_2',
                    'x': 0,
                    'y': 386,
                    'width': 40,        # 4 feet wide
                    'height': 30,       # 4 feet tall
                    'sill_height': 35,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Living_Rear_Window_1',
                    'x': 24,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'south',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Living_Rear_Window_2',
                    'x': 187.5,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'south',
                    'room': 'Living_Kitchen',  # Which room's wall
                },

                # Gable roof (example - uncomment to use)
                # {
                #     'type': 'gable_roof',
                #     'ridge_start_x': -2,
                #     'ridge_start_y': 13.5,
                #     'ridge_z': 22,
                #     'ridge_length': 49,
                #     'left_slope_angle': 27,
                #     'left_slope_length': 17,
                #     'right_slope_angle': 27,
                #     'right_slope_length': 17,
                #     'material': 'roof',
                # },
            ],
        },
        # ============ FIRST FLOOR ============
        {
            'floor_number': 1,
            'name': 'First Floor',

            # List of all objects on this floor
            'objects': [
                # Floor slab
                {
                    'type': 'floor_slab',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 234,
                },
                {
                    'type': 'floor_slab',
                    'x': 40,
                    'y': 234,
                    'width': 230,
                    'length': 100,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 230,
                    'width': 8,
                    'length': 220,
                },
                {
                    'type': 'beam',
                    'x': 262,
                    'y': 330,
                    'width': 8,
                    'length': 120,
                },
                {
                    'type': 'beam',
                    'x': 8,
                    'y': 442,
                    'width': 254,
                    'length': 8,
                },

                # Rooms - only create exterior walls, not shared partition walls
                {
                    'type': 'room',
                    'name': 'Upper_Verandah',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 88,
                    'height': 30,
                    'material': 'verandah',
                    'walls': ['north', 'east', 'west'],  # South is shared with Bedroom/Workshop
                },
                {
                    'type': 'room',
                    'name': 'Bedroom_2',
                    'x': 0,
                    'y': 80,
                    'width': 124,
                    'length': 124,
                    'material': 'bedroom',
                    'walls': ['north','east','west','south'], # East shared with Workshop, South shared with Living_Kitchen
                    'wall_heights': {
                        'north': 150,
                        'east': 100,
                        'west': 150,
                        'south': 100,
                    }
                },
                {
                    'type': 'room',
                    'name': 'Bedroom_3',
                    'x': 116,
                    'y': 80,
                    'width': 154,
                    'length': 124,
                    'material': 'workshop',
                    'walls': ['north','east','south'],  # West shared with Bedroom
                    'wall_heights': {
                        'north': 150,
                        'east': 150,
                        'west': 100,
                        'south': 100,
                    }
                },
                {
                    'type': 'room',
                    'name': 'Bathroom_2',
                    'x': 176,
                    'y': 196,
                    'width': 94,
                    'length': 104,
                    'material': 'bathroom',
                    'walls': ['west','south','east'],  # North shared with Workshop, West shared with Living_Kitchen
                    'wall_heights': {
                        'east': 150,
                        'west': 100,
                        'south': 100,
                    }
                },
                {
                    'type': 'wall',
                    'name': 'Staircase_Landing_West',
                    'start_x': 4,
                    'start_y': 200,
                    'end_x': 4,
                    'end_y': 300,
                    'height': 150,
                    'material': 'living',
                },
                # Living_Kitchen_2 area - replaced room with individual walls for sloping roof
                {
                    'type': 'wall',
                    'name': 'Living_Kitchen_2_East',
                    'start_x': 266,
                    'start_y': 300,
                    'end_x': 266,
                    'end_y': 450,
                    'height': 158,
                    'height_end': 85,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Living_Kitchen_2_West',
                    'start_x': 4,
                    'start_y': 300,
                    'end_x': 4,
                    'end_y': 450,
                    'height': 158,
                    'height_end': 85,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Living_Kitchen_2_South',
                    'start_x': 0,
                    'start_y': 446,
                    'end_x': 270,
                    'end_y': 446,
                    'height': 85,
                    'material': 'walls',
                },
                # Doors
                {
                    'type': 'door',
                    'name': 'Bedroom_3_Entry',
                    'x': 124,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_3',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_2_Entry',
                    'x': 90,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_2',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_2_Entry',
                    'x': 176,
                    'y': 228,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'west',
                    'room': 'Bathroom_2',  # Which room's wall
                },

                # Windows
                {
                    'type': 'window',
                    'name': 'Bedroom_2_Window_North',
                    'x': 25,
                    'y': 80,
                    'width': 80,        # 4 feet wide
                    'height': 65,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_2',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_2_Window_West',
                    'x': 0,
                    'y': 115,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Bedroom_2',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_3_Window_North',
                    'x': 135,
                    'y': 80,
                    'width': 80,        # 4 feet wide
                    'height': 65,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_3',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_3_Window_East',
                    'x': 262,
                    'y': 115,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Bedroom_3',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bathroom_2_Window_1',
                    'x': 262,
                    'y': 214,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Bathroom_2',
                },
                {
                    'type': 'window',
                    'name': 'Bathroom_2_Window_2',
                    'x': 262,
                    'y': 254,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Bathroom_2',
                },
                {
                    'type': 'window',
                    'name': 'Above_Kitchen_Window_1',
                    'x': 262,
                    'y': 310,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'east',
                    'wall': 'Living_Kitchen_2_East',
                },
                {
                    'type': 'window',
                    'name': 'Above_Kitchen_Window_2',
                    'x': 262,
                    'y': 375,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'east',
                    'wall': 'Living_Kitchen_2_East',
                },
                {
                    'type': 'window',
                    'name': 'Above_Stairs_Window_1',
                    'x': 0,
                    'y': 310,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'west',
                    'wall': 'Living_Kitchen_2_West',
                },
                {
                    'type': 'window',
                    'name': 'Above_Stairs_Window_2',
                    'x': 0,
                    'y': 375,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'west',
                    'wall': 'Living_Kitchen_2_West',
                },
                {
                    'type': 'window',
                    'name': 'Above_Living_Rear_Window_1',
                    'x': 24,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'south',
                    'wall': 'Living_Kitchen_2_South',
                },
                {
                    'type': 'window',
                    'name': 'Above_Living_Rear_Window_2',
                    'x': 98.5,
                    'y': 442,
                    'width': 75,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'south',
                    'wall': 'Living_Kitchen_2_South',
                },
                {
                    'type': 'window',
                    'name': 'Above_Living_Rear_Window_3',
                    'x': 187.5,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'south',
                    'wall': 'Living_Kitchen_2_South',
                },
            ],
        },
        # ============ LOFT FLOOR ============
        {
            'floor_number': 2,
            'name': 'Loft Floor',
            'objects': [
                # Floor slab
                {
                    'type': 'floor_slab',
                    'x': 8,
                    'y': 88,
                    'width': 252,
                    'length': 120,
                },
                {
                    'type': 'floor_slab',
                    'x': 176,
                    'y': 208,
                    'width': 84,
                    'length': 92,
                },
            ]
        },
        # ============ ROOF FLOOR ============
        {
            'floor_number': 3,
            'name': 'Roof Floor',

            # List of all objects on this floor
            'objects': [
                 # Beams
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 80,
                    'width': 270,
                    'length': 8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 292,
                    'width': 270,
                    'length': 8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 88,
                    'width': 8,
                    'length': 204,
                },
                {
                    'type': 'beam',
                    'x': 262,
                    'y': 88,
                    'width': 8,
                    'length': 204,
                },
                # Walls
                {
                    'type': 'wall',
                    'name': 'Roof_Wall_West_1',
                    'start_x': 4,
                    'start_y': 80,
                    'end_x': 4,
                    'end_y': 196,
                    'height': 0,
                    'height_end': 47,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Roof_Wall_West_2',
                    'start_x': 4,
                    'start_y': 204,
                    'end_x': 4,
                    'end_y': 300,
                    'height': 47,
                    'height_end': 0,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Roof_Wall_East_1',
                    'start_x': 266,
                    'start_y': 80,
                    'end_x': 266,
                    'end_y': 196,
                    'height': 0,
                    'height_end': 47,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Roof_Wall_East_2',
                    'start_x': 266,
                    'start_y': 204,
                    'end_x': 266,
                    'end_y': 300,
                    'height': 47,
                    'height_end': 0,  # Sloping wall
                    'material': 'walls',
                }
           ],
        },
    ],
}