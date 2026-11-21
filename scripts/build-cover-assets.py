#!/usr/bin/python3
"""Render the approved S1 PNG through the existing local librsvg/Cairo pipeline.

Only icons are generated; preserved OG/cover assets are never overwritten.
"""
from pathlib import Path
import base64
import cairo
import gi

gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg

ICONS = Path(__file__).resolve().parents[1] / 'public' / 'icons'
source = (ICONS / 'sources' / 'saebyeok_S1.png').read_bytes()
encoded = base64.b64encode(source).decode('ascii')
# Keep the existing SVG favicon filenames with a self-contained raster image.
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
       f'width="1024" height="1024" viewBox="0 0 1024 1024">'
       f'<image width="1024" height="1024" xlink:href="data:image/png;base64,{encoded}"/></svg>\n')
handle = Rsvg.Handle.new_from_data(svg.encode())

def render(output, size):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    viewport = Rsvg.Rectangle()
    viewport.x, viewport.y, viewport.width, viewport.height = 0, 0, size, size
    handle.render_document(cairo.Context(surface), viewport)
    surface.write_to_png(str(ICONS / output))
    print(f'{output}: {size}x{size}')

for prefix in ('', 'spa-'):
    for name, size in [('icon-192', 192), ('icon-512', 512), ('maskable-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)]:
        render(f'{prefix}{name}.png', size)
    (ICONS / f'{prefix}favicon.svg').write_text(svg)
