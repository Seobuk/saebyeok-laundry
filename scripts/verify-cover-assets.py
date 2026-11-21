#!/usr/bin/python3
"""Check built HTML/manifest image references and PNG dimensions without packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import base64
import hashlib
import json
import xml.etree.ElementTree as ET
import struct

DIST = Path(__file__).resolve().parents[1] / 'dist'
checked = set()

def check_ref(base, value):
    url = urlsplit(value)
    assert not url.scheme and not url.netloc, f'Expected local image: {value}'
    target = (DIST / unquote(url.path).lstrip('/') if url.path.startswith('/') else base / unquote(url.path)).resolve()
    assert target.is_relative_to(DIST.resolve()), f'Outside dist: {value}'
    assert target.is_file(), f'Missing asset: {target}'
    checked.add(str(target.relative_to(DIST)))

class Images(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        rel = attrs.get('rel', '').split()
        if tag == 'link' and set(rel) & {'icon', 'apple-touch-icon', 'apple-touch-startup-image', 'manifest'}:
            check_ref(DIST, attrs['href'])
        if tag == 'img' and 'src' in attrs:
            check_ref(DIST, attrs['src'])
        if tag == 'meta' and (attrs.get('property') == 'og:image' or attrs.get('name') == 'twitter:image'):
            check_ref(DIST, attrs['content'])

for html in DIST.glob('*.html'):
    text = html.read_text()
    assert '{{' not in text, f'Unexpanded template: {html}'
    Images().feed(text)
for manifest in DIST.glob('*.webmanifest'):
    data = json.loads(manifest.read_text())
    for icon in data['icons']:
        check_ref(manifest.parent, icon['src'])
        with (manifest.parent / icon['src']).open('rb') as f:
            header = f.read(24)
        assert 'x'.join(map(str, struct.unpack('>II', header[16:24]))) == icon['sizes']

expected = {'03_moon_og.png': (1200, 630)}
for prefix in ('', 'spa-'):
    for name, size in [('icon-192', 192), ('icon-512', 512), ('maskable-512', 512), ('apple-touch-icon', 180), ('favicon-32', 32)]:
        expected[f'{prefix}{name}.png'] = (size, size)
actual = {p.name for p in (DIST / 'icons').glob('*.png')}
assert actual == set(expected), f'Unexpected/missing PNGs: {actual ^ set(expected)}'
for name, dimensions in expected.items():
    with (DIST / 'icons' / name).open('rb') as f:
        header = f.read(24)
    assert header[:8] == b'\x89PNG\r\n\x1a\n'
    size = struct.unpack('>II', header[16:24])
    assert size == dimensions, f'{name}: {size} != {dimensions}'
    print(f'PASS {name}: {size[0]}x{size[1]}')
print(f'PASS {len(checked)} distinct HTML/manifest references exist; {len(expected)} PNG dimensions verified')

# Preserve the separate spa app's approved bytes from 9786ba4 without requiring Git.
preserved = {
    'spa-icon-192.png': '74cd3a201932a526ed9d9fca680bcaf960bb30f261bc1208040f8e0b0e55d3e0',
    'spa-icon-512.png': '7a1d6a73f46a023911cf593ef2b3ba73c5ea5a64cb02036b2616a16b292f9baf',
    'spa-maskable-512.png': '7a1d6a73f46a023911cf593ef2b3ba73c5ea5a64cb02036b2616a16b292f9baf',
    'spa-apple-touch-icon.png': 'c951cc37b7ad466ea63956dea874bbec9d06e2f998d847b4808ceb383d7824af',
    'spa-favicon-32.png': '83227c2270f3d2666a7deb3d9ceacaefef509b89ff2c861199dcd14c399ace59',
    'spa-favicon.svg': 'c4f8499999f11e6a9d267dc6331bda1be6504530ad749cbbc588bfd0a48fddfb',
    '03_moon_og.png': '90b84d8aa89e8ab9d3b0122524477ecc077230fc552d6b8c122cd3048ce211b8',
}
for name, digest in preserved.items():
    assert hashlib.sha256((DIST / 'icons' / name).read_bytes()).hexdigest() == digest, f'Preserved asset changed: {name}'
print(f'PASS {len(preserved)} preserved spa/cover assets match 9786ba4')

favicon = (DIST / 'icons' / 'favicon.svg').read_bytes()
assert len(favicon) <= 32 * 1024, 'SVG favicon exceeds 32 KiB'
svg = ET.fromstring(favicon)
images = svg.findall('{http://www.w3.org/2000/svg}image')
assert len(images) == 1
href = images[0].attrib['{http://www.w3.org/1999/xlink}href']
assert href.startswith('data:image/png;base64,')
png = base64.b64decode(href.split(',', 1)[1], validate=True)
assert png[:8] == b'\x89PNG\r\n\x1a\n'
assert all(0 < size <= 64 for size in struct.unpack('>II', png[16:24])), 'Favicon raster exceeds 64px'
source = (DIST / 'icons' / 'sources' / 'saebyeok_S1.png').read_bytes()
assert source[:8] == b'\x89PNG\r\n\x1a\n'
assert struct.unpack('>II', source[16:24]) == (512, 512)
assert len(source) <= 256 * 1024, 'S1 source exceeds 256 KiB'
print(f'PASS compact favicon ({len(favicon)} bytes) and 512px S1 source ({len(source)} bytes)')
