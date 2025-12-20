#!/usr/bin/env python3
"""
add_border.py

Usage:
    python add_border.py input.jpg output.jpg --width 1200 --height 900 --pad-left 50 --pad-right 50

Description:
    Creates a new image of size (width x height) with a white background and places
    the input image centered inside it, preserving aspect ratio. Left and right
    padding (in pixels) are required; top/bottom padding are computed so the image
    is vertically centered (or can be provided explicitly).

    The script tries to avoid quality degradation by using a high-quality resampling
    filter and by passing reasonable JPEG save options (quality=95, subsampling=0).
"""

from PIL import Image
import argparse
import os
import sys


def parse_args():
    p = argparse.ArgumentParser(description='Add a white border to a JPG while preserving aspect ratio.')
    p.add_argument('input', help='Input JPG path')
    p.add_argument('output', help='Output image path (JPG)')
    p.add_argument('--width', type=int, required=True, help='Final image width in pixels')
    p.add_argument('--height', type=int, required=True, help='Final image height in pixels')
    p.add_argument('--pad-left', type=int, default=0, help='Padding on the left in pixels')
    p.add_argument('--pad-right', type=int, default=0, help='Padding on the right in pixels')
    p.add_argument('--pad-top', type=int, default=None, help='Explicit padding on the top in pixels (optional)')
    p.add_argument('--pad-bottom', type=int, default=None, help='Explicit padding on the bottom in pixels (optional)')
    p.add_argument('--bg-color', default='white', help='Background color (default: white)')
    p.add_argument('--quality', type=int, default=95, help='JPEG quality when saving (default: 95)')
    return p.parse_args()


def add_border(input_path, output_path, final_w, final_h, pad_left, pad_right, pad_top=None, pad_bottom=None, bg_color='white', quality=95):
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if final_w <= 0 or final_h <= 0:
        raise ValueError("Final width and height must be positive integers")

    if pad_left < 0 or pad_right < 0:
        raise ValueError("Padding values must be non-negative")

    if pad_left + pad_right >= final_w:
        raise ValueError("Left + right padding must be less than final width")

    with Image.open(input_path) as im:
        # Ensure image is in RGB (JPG) - if it has alpha, composite onto background
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            alpha = im.convert('RGBA')
            bg = Image.new('RGBA', im.size, bg_color)
            alpha = Image.alpha_composite(bg, alpha).convert('RGB')
            im = alpha
        else:
            im = im.convert('RGB')

        orig_w, orig_h = im.size

        available_w = final_w - pad_left - pad_right
        if available_w <= 0:
            raise ValueError('Not enough horizontal space for the image after applying left and right padding')

        # If explicit top/bottom provided, compute available_h accordingly.
        if pad_top is not None and pad_bottom is not None:
            if pad_top < 0 or pad_bottom < 0:
                raise ValueError('Top/bottom padding must be non-negative')
            if pad_top + pad_bottom >= final_h:
                raise ValueError('Top + bottom padding must be less than final height')
            available_h = final_h - pad_top - pad_bottom
        else:
            # No explicit top/bottom: allow image to take up full height, then center vertically.
            available_h = final_h

        # Compute scale to fit into available box while preserving aspect ratio
        scale = min(available_w / orig_w, available_h / orig_h)
        new_w = max(1, int(round(orig_w * scale)))
        new_h = max(1, int(round(orig_h * scale)))

        # Resize using high-quality resampling
        resized = im.resize((new_w, new_h), resample=Image.LANCZOS)

        # Create final canvas
        canvas = Image.new('RGB', (final_w, final_h), bg_color)

        # Compute positions (center horizontally between left and right padding, vertically depending on top/bottom)
        x_offset = pad_left + (available_w - new_w) // 2
        if pad_top is not None and pad_bottom is not None:
            y_offset = pad_top + (available_h - new_h) // 2
        else:
            y_offset = (final_h - new_h) // 2

        canvas.paste(resized, (x_offset, y_offset))

        # Preserve EXIF if present
        exif = im.info.get('exif')

        save_kwargs = {}
        ext = os.path.splitext(output_path)[1].lower()
        if ext in ('.jpg', '.jpeg'):
            # Use high-quality JPEG settings
            save_kwargs.update({
                'format': 'JPEG',
                'quality': quality,
                'optimize': True,
                'subsampling': 0,
            })
            if exif:
                save_kwargs['exif'] = exif

        # Save
        canvas.save(output_path, **save_kwargs)


def main():
    args = parse_args()
    try:
        add_border(
            args.input,
            args.output,
            args.width,
            args.height,
            args.pad_left,
            args.pad_right,
            pad_top=args.pad_top,
            pad_bottom=args.pad_bottom,
            bg_color=args.bg_color,
            quality=args.quality,
        )
        print(f"Saved: {args.output}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
