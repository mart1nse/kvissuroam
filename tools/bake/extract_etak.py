"""Clip the national ETAK shapefiles to the game's sector rectangle -> etak_bbox.json.

Run in the folder that holds the unzipped ETAK themes (etak/ and etak_e/).
"""
import glob
import json
import os
import sys

import fiona

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import E0, N0, detail_rect  # noqa

x0, z0, x1, z1 = detail_rect()
BB = (E0 + x0 - 200, N0 - z1 - 200, E0 + x1 + 200, N0 - z0 + 200)
out = {}
for path in sorted(glob.glob('etak/**/*.shp', recursive=True) + glob.glob('etak_e/**/*.shp', recursive=True)):
    key = os.path.basename(path)[:-4]
    with fiona.open(path) as src:
        out[key] = [{'p': dict(f['properties']), 'g': dict(f['geometry'].__geo_interface__)} for f in src.filter(bbox=BB)]
    print(key, len(out[key]))
json.dump(out, open('etak_bbox.json', 'w'), default=str)
