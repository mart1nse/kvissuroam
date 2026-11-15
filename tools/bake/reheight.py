"""Rebuild the terrain heights and the bridge/tunnel decks of already baked sectors.

Needs only the terrain model sheets and etak_bbox.json in SRC (see README.md). Trees are put back
on the ground; everything else in the sector files is kept. Writes the decks into vectors.json and marks the road centre lines that
run on a bridge (e: 1) or in a tunnel (e: -1).

Usage: python3 tools/bake/reheight.py SRC_DIR public/data
"""
import gzip
import json
import os
import struct
import sys

import numpy as np
from shapely.geometry import LineString
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T
from config import *  # noqa

SRC, OUT = sys.argv[1], sys.argv[2]
T.setup(SRC)
meta = json.load(open(f'{OUT}/meta.json'))
HN, Q = meta['height']['n'], meta['height']['scale']
S = int(SECTOR)

hN = T.load_dtm(SRC)[1]
roads = T.feats('E_501_tee_j', T.detail_box.buffer(100))
hG = hN.copy()
hN, wm, river_u, *_ = T.water(hN)
T.mark_water_crossings(roads, river_u)
decks, _ = T.crossings(hN, hG, wm, roads)
T.grade_roads(hN, roads, wm, also=hG)            # roads level from edge to edge; trees beside them follow

changed = 0
for sx, sz, _ in meta['sector']['list']:
    path = f'{OUT}/sec/{sx}_{sz}.kvs'
    b = orig = gzip.open(path).read()
    c0, r0 = int(GRID0 + sx * SECTOR - T.X0), int(GRID0 + sz * SECTOR - T.Z0)
    hm = hN[r0:r0 + S + 1:int(HM_RES), c0:c0 + S + 1:int(HM_RES)]
    hq = np.clip(np.round((hm - H0 + 100.0) / Q), 0, 65535).astype('<u2').tobytes()
    assert len(hq) == HN * HN * 2
    # trees stand on the ground as it is now
    nv, nt = struct.unpack_from('<2I', b, 16)
    o_t = 32 + len(hq) + meta['surface']['n'] ** 2 + meta['sdf']['n'] ** 2 + nv * 15
    tr = np.frombuffer(b, '<f4', nt * 6, o_t).reshape(-1, 6).copy()
    g = T.sample(hG, tr[:, 0], tr[:, 2]) - H0
    tr[:, 1] = np.where(np.abs(g - tr[:, 1]) > 0.03, g, tr[:, 1])
    b = b[:o_t] + tr.astype('<f4').tobytes() + b[o_t + nt * 24:]
    if hq != b[32:32 + len(hq)]:
        d = np.frombuffer(hq, '<u2').astype(int) - np.frombuffer(b, '<u2', HN * HN, 32)
        print(f'  {sx},{sz}: {int((d != 0).sum())} nodes, {d.min() * Q:+.1f} .. {d.max() * Q:+.1f} m')
    new = b[:32] + hq + b[32 + len(hq):]
    if new != orig:
        open(path, 'wb').write(gzip.compress(new, 6))
        changed += 1
print('sectors changed', changed)

vec = json.load(open(f'{OUT}/vectors.json'))
vec['decks'] = decks
lv = [(T.road_level(p), part) for p, g in roads if T.road_level(p) for part in T.flat(g)]
tree = STRtree([g for _, g in lv])
n = 0
for r in vec['roads']:
    r.pop('e', None)
    if len(r['pts']) < 2:
        continue
    line = LineString([(E0 + x, N0 - z) for x, z in r['pts']])
    for i in tree.query(line):
        if line.hausdorff_distance(lv[i][1]) < 0.8:
            r['e'] = lv[i][0]; n += 1
            break
print('decks', len(decks), 'road lines on a bridge or in a tunnel', n)
json.dump(vec, open(f'{OUT}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
