"""Merge a partial bake (an extension of the map) into public/data without re-baking the rest.

  BAKE_ONLY=only.json RIVER_LEVEL=31.5 python3 tools/bake/bake.py SRC OUT     # only.json: new + touched sectors
  python3 tools/bake/merge_extension.py OUT public/data secs.json

secs.json is {"new": [[sx, sz], ...], "touched": [[sx, sz], ...]}. New sectors are copied whole.
Touched sectors are existing ones next to the extension: only their obstacle distance field is
replaced (the old one had the old map edge as a wall), so their buildings, trees, hedges and
everything keyed to them (walls.json, signs.json) stay as they were.
meta.json gets the new sectors, the new boundary and a taller coarse grid (the rows the extension
added at the north are prepended to coarse.bin); vectors.json gets the roads, areas, walls, decks and
water of the extension that it did not already have.
Used for the northern extension to Äksi and Kukulinna (2026-11-17) and the southern one round the
airport (2026-11-23). Lines and shapes that lie wholly within 150 m of the old edge were in the old
bake already (it keeps everything near its boundary), so a changed copy of them is not added twice.
"""
import gzip
import json
import os
import shutil
import struct
import sys

import numpy as np

NEW, OUT, SECS = sys.argv[1], sys.argv[2], sys.argv[3]
secs = json.load(open(SECS))
mo = json.load(open(f'{OUT}/meta.json'))
mn = json.load(open(f'{NEW}/meta.json'))


def parts(blob):
    raw = gzip.decompress(blob)
    magic, hn, sn, nd, nv, nt, nb, nf = struct.unpack('<4s7I', raw[:32])
    o = 32
    a = o + hn * hn * 2           # heights
    b = a + sn * sn               # surface classes
    c = b + nd * nd               # distance field (uint8)
    return raw, a, b, c, nd


# ---- sectors
for sx, sz in secs['new']:
    shutil.copy(f'{NEW}/sec/{sx}_{sz}.kvs', f'{OUT}/sec/{sx}_{sz}.kvs')
for sx, sz in secs['touched']:
    ro, _, bo, co, ndo = parts(open(f'{OUT}/sec/{sx}_{sz}.kvs', 'rb').read())
    rn, _, bn, cn, ndn = parts(open(f'{NEW}/sec/{sx}_{sz}.kvs', 'rb').read())
    assert ndo == ndn and co - bo == cn - bn
    out = ro[:bo] + rn[bn:cn] + ro[co:]
    open(f'{OUT}/sec/{sx}_{sz}.kvs', 'wb').write(gzip.compress(out, 6))
print('sectors: new', len(secs['new']), 'touched', len(secs['touched']))

# ---- coarse grid: prepend the northern rows
co, cn = mo['coarse'], mn['coarse']
assert co['x0'] == cn['x0'] and co['x1'] == cn['x1'] and co['res'] == cn['res'] and co['z1'] == cn['z1']
add = int(round((co['z0'] - cn['z0']) / co['res']))
if add > 0:
    old = np.fromfile(f'{OUT}/coarse.bin', '<u2').reshape(co['nz'], co['nx'])
    new = np.fromfile(f'{NEW}/coarse.bin', '<u2').reshape(cn['nz'], cn['nx'])
    # the old grid's northern rows past its terrain sheets were copies of the last real row: take
    # SEAM rows more from the new bake, which has the sheets there
    SEAM = 8
    print('coarse: rows added', add, 'step at the seam (cm)', int(np.abs(new[add + SEAM].astype(int) - old[SEAM]).mean()))
    np.concatenate([new[:add + SEAM], old[SEAM:]]).astype('<u2').tofile(f'{OUT}/coarse.bin')
    mo['coarse'] = dict(co, z0=cn['z0'], nz=co['nz'] + add)

# ---- meta
mo_boundary_old = mo['boundary']
have = {(s[0], s[1]) for s in mo['sector']['list']}
mo['sector']['list'] += [s for s in mn['sector']['list'] if (s[0], s[1]) not in have]
mo['boundary'] = mn['boundary']
json.dump(mo, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False)

# ---- vectors
from shapely.geometry import Point, Polygon
old_near = Polygon(mo_boundary_old).buffer(150)


def baked_before(r):
    pts = r['pts'] if isinstance(r, dict) and 'pts' in r else r['outer'] if isinstance(r, dict) else r
    return all(old_near.contains(Point(p[:2])) for p in pts)


vo = json.load(open(f'{OUT}/vectors.json'))
vn = json.load(open(f'{NEW}/vectors.json'))
key = lambda r: json.dumps(r, sort_keys=True)
for k in ('roads', 'areas', 'walls', 'decks'):
    seen = {key(r.get('pts', r.get('outer')) if isinstance(r, dict) else r) for r in vo[k]}
    add_k = [r for r in vn[k] if key(r.get('pts', r.get('outer')) if isinstance(r, dict) else r) not in seen and not baked_before(r)]
    vo[k] += add_k
    print(k, 'added', len(add_k))
seen = {key(w['polys']) for w in vo['water']}
add_w = [w for w in vn['water'] if not w['river'] and w['polys'] and key(w['polys']) not in seen
         and not all(baked_before(q) for q in w['polys'])]
vo['water'] += add_w
print('water added', len(add_w))
json.dump(vo, open(f'{OUT}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
