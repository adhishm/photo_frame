#!/usr/bin/env python3
"""
add_border.py

Usage:
    python add_border.py input.jpg [output.jpg] --width 1080 --height 1350 --pad-left 50 --pad-right 50

Description:
    Creates a new image of size (width x height) with a white background and places
    the input image centered inside it, preserving aspect ratio. Left and right
    padding (in pixels) are required; top/bottom padding are computed so the image
    is vertically centered (or can be provided explicitly).

    This script avoids quality degradation by using a high-quality resampling
    filter and by passing reasonable JPEG save options (quality=95, subsampling=0).

Improvements in this version:
- Preserve EXIF and ICC profile metadata when saving JPEG output (unless disabled).
- Optionally auto-orient images according to their EXIF Orientation tag (default: enabled).
- If output path is omitted, the script generates a filename by appending a configurable
  suffix before the input file's extension (default suffix: "-border").
- Defaults target an Instagram Portrait output (1080x1350) and preserve metadata by default.
- All behaviors are adjustable via command-line flags with sensible defaults.
"""

from PIL import Image, ImageOps
import argparse
import os
import sys


def parse_args():
    p = argparse.ArgumentParser(description='Add a white border to an image while preserving aspect ratio.')
    p.add_argument('input', help='Input image path')
    p.add_argument('output', nargs='?', default=None, help='Output image path (optional). If omitted, input name + suffix is used')
    p.add_argument('--width', type=int, default=1080, help='Final image width in pixels (default: 1080 - Instagram portrait)')
    p.add_argument('--height', type=int, default=1350, help='Final image height in pixels (default: 1350 - Instagram portrait)')
    p.add_argument('--pad-left', type=int, default=0, help='Padding on the left in pixels')
    p.add_argument('--pad-right', type=int, default=0, help='Padding on the right in pixels')
    p.add_argument('--pad-top', type=int, default=None, help='Explicit padding on the top in pixels (optional)')
    p.add_argument('--pad-bottom', type=int, default=None, help='Explicit padding on the bottom in pixels (optional)')
    p.add_argument('--bg-color', default='white', help='Background color (default: white)')
    p.add_argument('--quality', type=int, default=95, help='JPEG quality when saving (default: 95)')
    p.add_argument('--suffix', default='-border', help='Suffix to add to filename when output omitted (default: "-border")')
    p.add_argument('--no-preserve-exif', dest='preserve_exif', action='store_false', help='Do not preserve EXIF metadata when saving JPEG')
    p.add_argument('--no-preserve-icc', dest='preserve_icc', action='store_false', help='Do not preserve ICC profile when saving')
    p.add_argument('--no-auto-orient', dest='auto_orient', action='store_false', help='Do not auto-orient the image according to EXIF Orientation (default: auto-orient)')
    return p.parse_args()


def make_output_path(input_path, output_path, suffix):
    if output_path:
        return output_path
    base, ext = os.path.splitext(input_path)
    if not ext:
        ext = '.jpg'
    return f"{base}{suffix}{ext}"


def add_border(input_path, output_path, final_w, final_h, pad_left, pad_right, pad_top=None, pad_bottom=None, bg_color='white', quality=95, suffix='-border', preserve_exif=True, preserve_icc=True, auto_orient=True):
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if final_w <= 0 or final_h <= 0:
        raise ValueError("Final width and height must be positive integers")

    if pad_left < 0 or pad_right < 0:
        raise ValueError("Padding values must be non-negative")

    if pad_left + pad_right >= final_w:
        raise ValueError("Left + right padding must be less than final width")

    # Prepare output path (if not provided)
    out_path = make_output_path(input_path, output_path, suffix)

    # Open original and capture metadata early
    with Image.open(input_path) as orig_im:
        # Capture EXIF and ICC profile from the original before any conversions
        exif_obj = None
        exif_bytes = None
        try:
            exif_obj = orig_im.getexif()  # returns an Exif object (may be empty)
            if exif_obj and len(exif_obj) > 0:
                exif_bytes = exif_obj.tobytes()
        except Exception:
            exif_obj = None
            exif_bytes = None

        icc_profile = orig_im.info.get('icc_profile') if preserve_icc else None

        # Optionally auto-orient according to EXIF
        im = orig_im
        if auto_orient:
            try:
                im = ImageOps.exif_transpose(orig_im)
                # If we auto-oriented, remove the Orientation tag from exif_obj so we
                # don't leave a stale Orientation instruction in the saved EXIF.
                if exif_obj is not None and 274 in exif_obj:
                    try:
                        exif_obj.pop(274, None)
                        exif_bytes = exif_obj.tobytes() if len(exif_obj) > 0 else None
                    except Exception:
                        # If for some reason we can't modify exif, fall back to original bytes
                        pass
            except Exception:
                # If exif_transpose fails for any reason, continue with the original image
                im = orig_im

        # Ensure image is in RGB (for JPEG). If it has alpha, composite onto background
        has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
        if has_alpha:
            alpha = im.convert('RGBA')
            bg = Image.new('RGBA', im.size, bg_color)
            composed = Image.alpha_composite(bg, alpha).convert('RGB')
            im = composed
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

        # Prepare save kwargs
        save_kwargs = {}
        ext = os.path.splitext(out_path)[1].lower()
        if ext in ('.jpg', '.jpeg'):
            # Use high-quality JPEG settings
            save_kwargs.update({
                'format': 'JPEG',
                'quality': quality,
                'optimize': True,
                'subsampling': 0,
            })
            if preserve_exif and exif_bytes:
                save_kwargs['exif'] = exif_bytes
            if preserve_icc and icc_profile:
                save_kwargs['icc_profile'] = icc_profile
        else:
            # For non-JPEG, rely on format inference from extension or Pillow defaults
            save_kwargs.update({
                'format': None,
            })

        # Save
        canvas.save(out_path, **save_kwargs)


def main():
    args = parse_args()
    try:
        out = make_output_path(args.input, args.output, args.suffix)
        add_border(
            args.input,
            out,
            args.width,
            args.height,
            args.pad_left,
            args.pad_right,
            pad_top=args.pad_top,
            pad_bottom=args.pad_bottom,
            bg_color=args.bg_color,
            quality=args.quality,
            suffix=args.suffix,
            preserve_exif=args.preserve_exif,
            preserve_icc=args.preserve_icc,
            auto_orient=args.auto_orient,
        )
        print(f"Saved: {out}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
