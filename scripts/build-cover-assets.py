#!/usr/bin/python3
"""Render the approved GPT-authored SVGs with locally installed librsvg/Cairo."""
from pathlib import Path
import shutil
import cairo
import gi

gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg

ICONS = Path(__file__).resolve().parents[1] / 'public' / 'icons'

def render(source, output, width, height):
    handle = Rsvg.Handle.new_from_file(str(ICONS / 'sources' / source))
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
    viewport = Rsvg.Rectangle()
    viewport.x, viewport.y, viewport.width, viewport.height = 0, 0, width, height
    handle.render_document(cairo.Context(surface), viewport)
    surface.write_to_png(str(ICONS / output))
    print(f'{output}: {width}x{height}')

for prefix, source in [('', '03_moon_icon.svg'), ('spa-', 'ttasun_spa_icon.svg')]:
    for name, size in [('icon-192', 192), ('icon-512', 512), ('maskable-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)]:
        render(source, f'{prefix}{name}.png', size, size)
    shutil.copyfile(ICONS / 'sources' / source, ICONS / f'{prefix}favicon.svg')
render('03_moon_og.svg', '03_moon_og.png', 1200, 630)
