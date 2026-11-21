#!/usr/bin/python3
"""Render laundry icons from the 512px S1 source with local librsvg/Cairo.

The separate spa app's icons and all OG/cover assets are never overwritten.
"""
from pathlib import Path
import base64
import io
import struct
import cairo
import gi

gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg

ICONS = Path(__file__).resolve().parents[1] / 'public' / 'icons'


def raster_svg(png, size):
    encoded = base64.b64encode(png).decode('ascii')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<image width="{size}" height="{size}" xlink:href="data:image/png;base64,{encoded}"/></svg>\n')


source = (ICONS / 'sources' / 'saebyeok_S1.png').read_bytes()
assert source[:8] == b'\x89PNG\r\n\x1a\n'
assert struct.unpack('>II', source[16:24]) == (512, 512), 'Keep the S1 source at 512px'
handle = Rsvg.Handle.new_from_data(raster_svg(source, 512).encode())


def render(size):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    viewport = Rsvg.Rectangle()
    viewport.x, viewport.y, viewport.width, viewport.height = 0, 0, size, size
    handle.render_document(cairo.Context(surface), viewport)
    output = io.BytesIO()
    surface.write_to_png(output)
    return output.getvalue()


for name, size in [('icon-192', 192), ('icon-512', 512), ('maskable-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)]:
    (ICONS / f'{name}.png').write_bytes(render(size))
    print(f'{name}.png: {size}x{size}')
# The favicon embeds only a small raster, never the full application icon source.
(ICONS / 'favicon.svg').write_text(raster_svg(render(64), 64))
print('favicon.svg: 64x64 embedded PNG')
