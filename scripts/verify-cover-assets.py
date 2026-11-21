#!/usr/bin/python3
"""Check built HTML/manifest image references and PNG dimensions without packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
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

expected = {'03_moon_og.png': (1200, 630), 'spa-og.png': (512, 512)}
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
