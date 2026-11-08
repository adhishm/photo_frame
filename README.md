# photo_frame

Add a frame to a photo.

Example CLI usage:
```shell
python3 -m add_border input.jpg output.jpg --width 1080 --height 1080 --pad-left 40 --pad-right 40 --bg-color white --quality 95
```

Static web app:
- Open `index.html` in a browser to upload an image and apply frame settings without installing Python.
- Single-image mode supports Instagram presets (square, portrait, landscape), custom canvas size, padding, background color, and JPEG quality.
- Tiling mode lets you choose 1–6 rows and columns, drop or browse for one image per cell, set outer margins and spacing between cells, preview the grid, and download a JPEG.
- Each tile is scaled to fit its cell while preserving aspect ratio; images are not cropped or distorted.
- The Instagram portrait checkbox fixes the tiling output to 1080×1350 pixels (4:5 ratio).
- Browser downloads do not retain EXIF/ICC metadata. Use the CLI when metadata preservation is needed.
- You can deploy the repo on GitHub Pages from the repository root.
