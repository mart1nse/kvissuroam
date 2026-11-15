"""List the open-country sectors, which get one orthophoto tile instead of 2x2 -> rural_sectors.json.

Usage: python3 tools/bake/rural.py SRC_DIR   (needs etak_bbox.json; run before fetch_ortho.py)
A sector counts as open country when it holds fewer than MIN_BUILDINGS building footprints.
Sectors that already have 2x2 tiles in public/data/ortho keep them.
"""
import json
import os
import sys
from collections import Counter

from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *  # noqa

MIN_BUILDINGS = 12
SRC = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
ortho = os.path.join(here, '..', '..', 'public', 'data', 'ortho')
n = Counter()
for f in json.load(open(f'{SRC}/etak_bbox.json'))['E_401_hoone_ka']:
    c = shape(f['g']).representative_point()
    n[(int((c.x - E0 - GRID0) // SECTOR), int((N0 - c.y - GRID0) // SECTOR))] += 1
rural = [s for s in sectors() if n[s] < MIN_BUILDINGS and s not in HI_SECTORS
         and not os.path.exists(f'{ortho}/{s[0]}_{s[1]}_1_1.jpg')]
json.dump(sorted(rural), open(os.path.join(here, 'rural_sectors.json'), 'w'))
print('sectors', len(sectors()), 'open country', len(rural))
