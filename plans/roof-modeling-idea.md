The roof of a house can be modeled as a polygon, with each segment having a width perpendicular to the segment.

For example, 
- simple rectangular house: single line segment either e-w or n-s
- L-shaped: two line segments with two open nodes and one joint
- U-shaped: three line segments with two open nodes and two joints
- courtyard configuration: four line segments with four joint nodes
- multi-section configurations: may have multiple polygons in any combination

Each segment can have a different width, which is modeled in a way that the segment is at the center of the width. 

Flat roof: 
- simplest, covers the entire polygon with a flat roof

Shed roof: 
- Slope is perpendicular to the segment and slopes from left to right or right to left
- ends are left open to be covered by wall segments appropriately shaped
- joints are handled by intersecting the planes of adjoining segments

Gable roof:
- two slopes on either side of each segment
- for now, keep the slopes symmetrical on both sides of the center line. later we can create more complex configurations for asymetrical slopes
- ends are left open to be covered by wall segments appropriately shaped
- joints are handled by intersecting the plans of adjoining segments

Hip roof:
- same as gable, except ends have slopes perpendicular to the segment direction

For each slope, we can either specify angle or height of top end to derive the face coordinates
