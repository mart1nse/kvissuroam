"""Fetch orthophoto tiles for the game area from the Maa- ja Ruumiamet WMS.

Usage: python3 tools/bake/fetch_ortho.py public/data/ortho
"""
import io
import os
import sys
import time
import urllib.request

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from config import *  # noqa

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
WMS = ('https://kaart.maaamet.ee/wms/fotokaart?service=WMS&version=1.1.1&request=GetMap'
       '&layers=EESTIFOTO&styles=&srs=EPSG:3301&format=image/png')


def fetch(w, s, e, n, px):
    url = f'{WMS}&bbox={w},{s},{e},{n}&width={px}&height={px}'
    for attempt in range(5):
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
            return Image.open(io.BytesIO(data)).convert('RGB')
        except Exception as ex:  # noqa
            print('  retry', ex)
            time.sleep(2 + attempt * 3)
    raise SystemExit('failed ' + url)


# overview of the whole scenery square, fetched as 2x2 for sharper downsampling
half = OVERVIEW_PX // 2
ov = Image.new('RGB', (OVERVIEW_PX, OVERVIEW_PX))
for j in range(2):
    for i in range(2):
        w = E0 - OUTER + i * OUTER
        n = N0 + OUTER - j * OUTER
        ov.paste(fetch(w, n - OUTER, w + OUTER, n, half * 2).resize((half, half), Image.LANCZOS), (i * half, j * half))
ov.save(f'{OUT}/overview.jpg', quality=86)
print('overview done')

n_t = int(2 * INNER / TILE)
for ty in range(n_t):
    for tx in range(n_t):
        path = f'{OUT}/t_{tx}_{ty}.jpg'
        if os.path.exists(path):
            continue
        w = E0 - INNER + tx * TILE
        n = N0 + INNER - ty * TILE
        fetch(w, n - TILE, w + TILE, n, TILE_PX).save(path, quality=84)
    print('row', ty)
