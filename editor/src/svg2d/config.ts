// Mirror of the Python `config.GLOBAL_CONFIG.dimensions` and the
// wall-thickness default. The full GLOBAL_CONFIG lives in house_config.py
// (with tuple color values, layer configs, etc.) — but the SVG generators
// only read the dimensions sub-dict and `wall_thickness`. Rather than
// serialize GLOBAL_CONFIG to JSON on the Python side (Phase 0's scope),
// we hard-code the defaults here so the editor stays fully client-side.
// Keep this in sync with `config.py::GLOBAL_CONFIG['dimensions']` and the
// override in house_config.py's `GLOBAL_CONFIG.update({...})` block.

export interface DimensionConfig {
  show_outer_dimensions: boolean;
  show_inner_dimensions: boolean;
  show_room_dimensions: boolean;
  show_opening_dimensions: boolean;
  dimension_offset: number;
  dimension_offset_increment: number;
  inner_dimension_offset: number;
  opening_dimension_offset: number;
  min_dimension_length: number;
  unit_display: "feet" | string;
  unit_conversion: number;
  precision: number;
  use_feet_inches: boolean;
  text_size: number;
  room_text_size: number;
  opening_text_size: number;
}

export interface GlobalConfig {
  wall_thickness: number;
  plinth_height: number;
  floor_slab_thickness: number;
  roof_thickness: number;
  beam_size: number;
  floor_heights: Record<number, number>;
  elevation_rendering_priority: Record<string, number>;
  dimensions: DimensionConfig;
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  wall_thickness: 8,
  plinth_height: 30,
  floor_slab_thickness: 8,
  roof_thickness: 3,
  beam_size: 8,
  floor_heights: {
    0: 100.0,
    1: 90.0,
    2: 70.0,
  },
  elevation_rendering_priority: {
    beam: 0,
    floor_slab: 1,
    room: 2,
    wall: 2,
    pillar: 3,
  },
  dimensions: {
    show_outer_dimensions: true,
    show_inner_dimensions: true,
    show_room_dimensions: true,
    show_opening_dimensions: true,
    dimension_offset: 30,
    dimension_offset_increment: 20,
    inner_dimension_offset: 15,
    opening_dimension_offset: 8,
    min_dimension_length: 10,
    unit_display: "feet",
    unit_conversion: 10.0,
    precision: 1,
    use_feet_inches: true,
    text_size: 10,
    room_text_size: 12,
    opening_text_size: 8,
  },
};
