"""Fetch orthophoto tiles for the game area from the Maa- ja Ruumiamet WMS.

Usage: python3 tools/bake/fetch_ortho.py public/data/ortho SRC_DIR
Writes the tiles and overview into the first folder and a working mosaic
(ortho_mosaic.npy, used by bake.py) into SRC_DIR.
"""
import io
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *  # noqa

OUT, SRC = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
WMS = ('https://kaart.maaamet.ee/wms/fotokaart?service=WMS&version=1.1.1&request=GetMap'
       '&layers=EESTIFOTO&styles=&srs=EPSG:3301&format=image/png')


def fetch(x0, z0, x1, z1, w, h):
    """World-space box -> RGB image."""
    url = f'{WMS}&bbox={E0 + x0},{N0 - z1},{E0 + x1},{N0 - z0}&width={w}&height={h}'
    for attempt in range(6):
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
            return Image.open(io.BytesIO(data)).convert('RGB')
        except Exception as ex:  # noqa
            print('  retry', ex, flush=True)
            time.sleep(2 + attempt * 4)
    raise SystemExit('failed ' + url)


if not os.path.exists(f'{OUT}/overview.jpg'):
    W, H = OVERVIEW_PX
    ov = Image.new('RGB', (W, H))
    mx, mz = (CX0 + CX1) / 2, (CZ0 + CZ1) / 2
    for j, (za, zb) in enumerate(((CZ0, mz), (mz, CZ1))):
        for i, (xa, xb) in enumerate(((CX0, mx), (mx, CX1))):
            ov.paste(fetch(xa, za, xb, zb, W // 2, H // 2), (i * W // 2, j * H // 2))
    ov.save(f'{OUT}/overview.jpg', quality=84)
    print('overview done', flush=True)

jobs = []
for sx, sz in sectors():
    div = 4 if (sx, sz) in HI_SECTORS else 2
    t = SECTOR / div
    for j in range(div):
        for i in range(div):
            jobs.append((sx, sz, i, j, GRID0 + sx * SECTOR + i * t, GRID0 + sz * SECTOR + j * t, t))


def run(job):
    sx, sz, i, j, x0, z0, t = job
    path = f'{OUT}/{sx}_{sz}_{i}_{j}.jpg'
    if not os.path.exists(path):
        fetch(x0, z0, x0 + t, z0 + t, TILE_PX, TILE_PX).save(path, quality=80)
    return job


x0, z0, x1, z1 = detail_rect()
mw, mh = int((x1 - x0) / MOSAIC_RES), int((z1 - z0) / MOSAIC_RES)
mos = np.zeros((mh, mw, 3), 'uint8')
with ThreadPoolExecutor(5) as ex:
    for k, (sx, sz, i, j, tx, tz, t) in enumerate(ex.map(run, jobs)):
        px = int(t / MOSAIC_RES)
        im = Image.open(f'{OUT}/{sx}_{sz}_{i}_{j}.jpg').resize((px, px), Image.BILINEAR)
        c, r = int((tx - x0) / MOSAIC_RES), int((tz - z0) / MOSAIC_RES)
        mos[r:r + px, c:c + px] = np.asarray(im)
        if k % 40 == 0:
            print(k, '/', len(jobs), flush=True)
np.save(f'{SRC}/ortho_mosaic.npy', mos)
print('tiles', len(jobs))
