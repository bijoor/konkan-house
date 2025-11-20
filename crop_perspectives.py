#!/usr/bin/env python3
"""
Auto-crop white space from perspective PNG images
"""

from PIL import Image
import os

def auto_crop_image(image_path):
    """
    Automatically crop white/transparent borders from an image
    """
    print(f"Processing: {image_path}")

    # Open image
    img = Image.open(image_path)

    # Get original size
    original_size = img.size
    print(f"  Original size: {original_size[0]}x{original_size[1]}")

    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Get the bounding box of non-transparent pixels
    # For images with white background, we need to check RGB values
    bbox = img.getbbox()

    if bbox:
        # Crop to the bounding box with a small margin
        margin = 50  # pixels of padding to keep
        bbox_with_margin = (
            max(0, bbox[0] - margin),
            max(0, bbox[1] - margin),
            min(img.size[0], bbox[2] + margin),
            min(img.size[1], bbox[3] + margin)
        )

        cropped_img = img.crop(bbox_with_margin)

        # Get new size
        new_size = cropped_img.size
        print(f"  Cropped size: {new_size[0]}x{new_size[1]}")
        print(f"  Reduction: {original_size[0] - new_size[0]}x{original_size[1] - new_size[1]} pixels")

        # Save the cropped image
        cropped_img.save(image_path, 'PNG', optimize=True)
        print(f"  ✓ Saved cropped image")

        return True
    else:
        print(f"  ⚠ Could not determine crop bounds")
        return False

def main():
    """Crop all perspective images"""

    # Directory containing the images
    docs_dir = os.path.join(os.path.dirname(__file__), 'docs')

    # List of perspective images
    perspective_images = [
        'perspective_front_left_corner.png',
        'perspective_front_right_corner.png',
        'perspective_back_left_corner.png',
        'perspective_back_right_corner.png',
        'perspective_aerial.png',
        'perspective_eye_level_south.png',
        'perspective_eye_level_north.png'
    ]

    print("="*70)
    print("AUTO-CROPPING PERSPECTIVE IMAGES")
    print("="*70)
    print()

    success_count = 0
    for image_name in perspective_images:
        image_path = os.path.join(docs_dir, image_name)

        if os.path.exists(image_path):
            if auto_crop_image(image_path):
                success_count += 1
            print()
        else:
            print(f"⚠ File not found: {image_path}")
            print()

    print("="*70)
    print(f"✓ CROPPING COMPLETE: {success_count}/{len(perspective_images)} images processed")
    print("="*70)

if __name__ == '__main__':
    main()
