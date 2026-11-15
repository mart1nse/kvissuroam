"""Rebuild the obstacle field, the surface under bridges and the road data of already baked sectors.

Needs etak_bbox.json (ETAK Transportation, Waterbodies and Buildings) and the terrain model sheets
in SRC, and the orthophoto tiles in OUT. Trees are taken from the sector files. Writes the roads
(with surface type and photo colour), paved areas and walls into vectors.json; decks are kept.
Run reheight.py first when terrain.py changed.

Usage: python3 tools/bake/resurface.py SRC_DIR public/data
"""
import gzip
import json
import os
import struct
import sys

import numpy as np
from shapely.geometry import Polygon
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import surface as SF
import terrain as T
from config import *  # noqa

SRC, OUT = sys.argv[1], sys.argv[2]
T.setup(SRC)
meta = json.load(open(f'{OUT}/meta.json'))
HN, SN, DN = meta['height']['n'], meta['surface']['n'], meta['sdf']['n']
poly_en = Polygon(BOUNDARY)
near = poly_en.buffer(150)
MARGIN = 16.0
WATER, PAVED = 4, 1

_, hN = T.load_dtm(SRC)
roads = T.feats('E_501_tee_j', T.detail_box.buffer(100))
hG = hN.copy()
hN, wm, river_u, *_ = T.water(hN)
T.mark_water_crossings(roads, river_u)
_, bridge_cells = T.crossings(hN, hG, wm, roads)
wet = wm[:-1, :-1] & wm[1:, 1:]
bc = bridge_cells[:-1, :-1] | bridge_cells[1:, :-1] | bridge_cells[:-1, 1:] | bridge_cells[1:, 1:]
wet &= ~bc
del hN, hG, _

solid = SF.solid_shapes(T.feats)
tree = STRtree(solid)
S = int(SECTOR)
n_sdf = n_surf = 0
for sx, sz, _ in meta['sector']['list']:
    path = f'{OUT}/sec/{sx}_{sz}.kvs'
    b = gzip.open(path).read()
    nv, nt = struct.unpack_from('<2I', b, 16)
    o_s = 32 + HN * HN * 2
    o_d = o_s + SN * SN
    o_t = o_d + DN * DN + nv * 15
    x0, z0 = GRID0 + sx * SECTOR, GRID0 + sz * SECTOR
    # water under a bridge span is water again (it used to be the top of a causeway)
    sf = np.frombuffer(b, 'uint8', SN * SN, o_s).reshape(SN, SN).copy()
    c0, r0 = int(x0 - T.X0), int(z0 - T.Z0)
    w = wet[r0:r0 + S, c0:c0 + S] & (sf != WATER)
    sf[w] = WATER
    n_surf += int(w.sum())
    # obstacles: buildings, walls, tree trunks, the map edge
    wb = T.wbox(x0 - MARGIN, z0 - MARGIN, x0 + SECTOR + MARGIN, z0 + SECTOR + MARGIN)
    shapes = [solid[i] for i in tree.query(wb)]
    trees = np.frombuffer(b, '<f4', nt * 6, o_t).reshape(-1, 6)
    shapes += [SF.trunk(t[0], t[2], t[3]) for t in trees]
    outside = wb.difference(poly_en)
    if not outside.is_empty:
        shapes.append(outside)
    sdq = SF.sector_sdf(shapes, x0, z0, MARGIN).tobytes()
    if sdq != b[o_d:o_d + DN * DN] or w.any():
        n_sdf += sdq != b[o_d:o_d + DN * DN]
        open(path, 'wb').write(gzip.compress(b[:o_s] + sf.tobytes() + sdq + b[o_d + DN * DN:], 6))
print('sectors with a new obstacle field', n_sdf, 'cells back to water', n_surf)

ortho = SF.Ortho(OUT)
vec = json.load(open(f'{OUT}/vectors.json'))
vec['roads'] = SF.road_lines(roads, near, ortho)
vec['areas'] = SF.areas(T.feats, near, ortho)
vec['walls'] = SF.walls(T.feats, near)
vec = {k: vec[k] for k in ('water', 'roads', 'areas', 'walls', 'decks')}
print('roads', len(vec['roads']), 'with colour', sum('c' in r for r in vec['roads']), 'areas', len(vec['areas']), 'walls', len(vec['walls']))
json.dump(vec, open(f'{OUT}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('vectors.json %.2f MB' % (os.path.getsize(f'{OUT}/vectors.json') / 1e6))
