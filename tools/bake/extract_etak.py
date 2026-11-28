"""Clip the national ETAK shapefiles to the game's sector rectangle -> etak_bbox.json.

Run in the folder that holds the unzipped ETAK themes (etak/ and etak_e/).
"""
import glob
import json
import os
import sys

import fiona
from shapely.geometry import box, mapping, shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import E0, N0, detail_rect  # noqa

x0, z0, x1, z1 = detail_rect()
BB = (E0 + x0 - 200, N0 - z1 - 200, E0 + x1 + 200, N0 - z0 + 200)
out = {}
for path in sorted(glob.glob('etak/**/*.shp', recursive=True) + glob.glob('etak_e/**/*.shp', recursive=True)):
    key = os.path.basename(path)[:-4]
    with fiona.open(path) as src:
        out[key] = [{'p': dict(f['properties']), 'g': dict(f['geometry'].__geo_interface__)} for f in src.filter(bbox=BB)]
    if key == 'E_201_meri_a':
        # the sea is a few polygons the size of the coast: only the part near the map (Tallinn, 28 Nov 2026)
        bb = box(BB[0] - 3000, BB[1] - 3000, BB[2] + 3000, BB[3] + 3000)
        out[key] = [dict(f, g=mapping(shape(f['g']).buffer(0).intersection(bb))) for f in out[key]]
    print(key, len(out[key]))
json.dump(out, open('etak_bbox.json', 'w'), default=str)
