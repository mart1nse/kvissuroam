"""Re-pack the buildings and trees of already baked sectors, without the full bake.

Needs only the building OBJ files in SRC (see README.md). Terrain, surfaces, hedges and
fences are kept as they are. Roof colours are taken from the existing sector files, trees
standing on roads are moved to the verge or dropped (see trees.py), and the trunks of the
moved trees are added to the obstacle distance field.

Usage: python3 tools/bake/repack.py SRC_DIR public/data
"""
import gzip
import json
import os
import struct
import sys

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *  # noqa
import buildings
import trees as tree_rules

SRC, OUT = sys.argv[1], sys.argv[2]
meta = json.load(open(f'{OUT}/meta.json'))
HN, SN, DN = meta['height']['n'], meta['surface']['n'], meta['sdf']['n']
DMIN, DSPAN = meta['sdf']['min'], meta['sdf']['max'] - meta['sdf']['min']
SECS = [(sx, sz) for sx, sz, _ in meta['sector']['list']]
X0, Z0, X1, Z1 = detail_rect()
W1, H1 = int(X1 - X0), int(Z1 - Z0)
S = int(SECTOR)

# ---------------------------------------------------------------- read
sec = {}
surf = np.zeros((H1, W1), 'uint8')
blocked = np.ones((H1, W1), bool)                 # outside the sectors, or on a solid obstacle
hgt = np.zeros((H1 // 2 + 1, W1 // 2 + 1), '<u2')
roof_pts, roof_cols, T = [], [], []
for sx, sz in SECS:
    b = gzip.open(f'{OUT}/sec/{sx}_{sz}.kvs').read()
    head = struct.unpack('<4s7I', b[:32])
    assert head[0] == b'KVS1' and head[1:4] == (HN, SN, DN)
    nv, nt = head[4], head[5]
    o = 32
    hq = b[o:o + HN * HN * 2]; o += HN * HN * 2
    sf = b[o:o + SN * SN]; o += SN * SN
    sdq = np.frombuffer(b, 'u1', DN * DN, o).reshape(DN, DN).copy(); o += DN * DN
    bo = o; o += nv * 15
    rec = np.frombuffer(b, '<f4', nt * 6, o).reshape(-1, 6); o += nt * 24
    sec[(sx, sz)] = {'hq': hq, 'sf': sf, 'sdq': sdq, 'low': b[o:], 'head': head}
    x0, z0 = GRID0 + sx * SECTOR, GRID0 + sz * SECTOR
    c0, r0 = int(x0 - X0), int(z0 - Z0)
    surf[r0:r0 + S, c0:c0 + S] = np.frombuffer(sf, 'u1').reshape(SN, SN)
    blocked[r0:r0 + S, c0:c0 + S] = (DMIN + sdq[:-1:2, :-1:2] / 255 * DSPAN) < 0.6
    hgt[r0 // 2:r0 // 2 + HN, c0 // 2:c0 // 2 + HN] = np.frombuffer(hq, '<u2').reshape(HN, HN)
    T.append(rec[:, [0, 2, 3, 4, 5]].astype('float64'))
    # roof colours: centroids of the roof-coloured triangles
    pq = np.frombuffer(b, '<i2', nv * 3, bo).reshape(-1, 3, 3)
    cq = np.frombuffer(b, 'u1', nv * 3, bo + nv * 9).reshape(-1, 3, 3)[:, 0]
    kind = np.frombuffer(b, 'u1', nv, bo + nv * 12)[::3]
    ctr = pq[kind == 1].mean(1)
    roof_pts.append(np.stack([x0 + ctr[:, 0] * 0.05, z0 + ctr[:, 2] * 0.05], 1))
    roof_cols.append(cq[kind == 1])
print('sectors', len(SECS))

# ---------------------------------------------------------------- buildings
roof_pts, roof_cols = np.concatenate(roof_pts), np.concatenate(roof_cols)
roof_tree = cKDTree(roof_pts)


def roof_colour(bv, tris):
    """Colour of the baked triangle that lies exactly over (or under) one of this building's."""
    p = bv[tris]
    n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    flat = np.abs(n[:, 2]) > 0.25 * np.maximum(np.linalg.norm(n, axis=1), 1e-12)
    if not flat.any():
        return (120, 120, 125)
    ctr = p[flat].mean(1)
    d, i = roof_tree.query(np.stack([ctr[:, 0] - E0, N0 - ctr[:, 1]], 1))
    k = int(np.argmin(d))
    return tuple(roof_cols[i[k]]) if d[k] < 0.2 else (120, 120, 125)


bsec, n_b, n_c = buildings.build(SRC, set(SECS), roof_colour)
print('lod2 buildings', n_b, 'roofed areas', n_c)

# ---------------------------------------------------------------- trees
T = np.concatenate(T)
n_all = len(T)
T, moved = tree_rules.clear_roads(T, surf, X0, Z0, blocked=blocked)
print('trees', n_all, 'moved', int(moved.sum()), 'dropped', n_all - len(T))


def ground(x, z):
    fx, fz = (x - X0) / 2, (z - Z0) / 2
    c, r = np.floor(fx).astype(int), np.floor(fz).astype(int)
    fx -= c; fz -= r
    h = hgt.astype('float64')
    return ((h[r, c] * (1 - fx) + h[r, c + 1] * fx) * (1 - fz)
            + (h[r + 1, c] * (1 - fx) + h[r + 1, c + 1] * fx) * fz) * meta['height']['scale'] + meta['height']['offset']


t_y = ground(T[:, 0], T[:, 1])
t_sec = np.stack([np.floor((T[:, 0] - GRID0) / SECTOR), np.floor((T[:, 1] - GRID0) / SECTOR)], 1).astype(int)

# trunks of the moved trees become solid
R = 12.5
for x, z, h in T[moved][:, :3]:
    rad = min(0.45, max(0.14, 0.035 * h))
    for sx in range(int((x - R - GRID0) // SECTOR), int((x + R - GRID0) // SECTOR) + 1):
        for sz in range(int((z - R - GRID0) // SECTOR), int((z + R - GRID0) // SECTOR) + 1):
            s = sec.get((sx, sz))
            if s is None:
                continue
            lx, lz = (x - GRID0 - sx * SECTOR) / SDF_RES, (z - GRID0 - sz * SECTOR) / SDF_RES
            ca, cb = max(int(lx - R / SDF_RES), 0), min(int(lx + R / SDF_RES) + 2, DN)
            ra, rb = max(int(lz - R / SDF_RES), 0), min(int(lz + R / SDF_RES) + 2, DN)
            if ca >= cb or ra >= rb:
                continue
            d = np.hypot(np.arange(ca, cb)[None, :] - lx, np.arange(ra, rb)[:, None] - lz) * SDF_RES - rad
            q = np.clip(np.round((d - DMIN) / DSPAN * 255), 0, 255).astype('uint8')
            s['sdq'][ra:rb, ca:cb] = np.minimum(s['sdq'][ra:rb, ca:cb], q)

# ---------------------------------------------------------------- write
total = 0
for sx, sz in SECS:
    s = sec[(sx, sz)]
    x0, z0 = GRID0 + sx * SECTOR, GRID0 + sz * SECTOR
    m = (t_sec[:, 0] == sx) & (t_sec[:, 1] == sz)
    rec = np.zeros((int(m.sum()), 6), '<f4')
    rec[:, 0] = T[m, 0]; rec[:, 1] = t_y[m]; rec[:, 2] = T[m, 1]
    rec[:, 3] = T[m, 2]; rec[:, 4] = T[m, 3]; rec[:, 5] = T[m, 4]
    nv, bbytes = buildings.pack(bsec, (sx, sz), x0, z0)
    h = s['head']
    head = struct.pack('<4s7I', b'KVS1', HN, SN, DN, nv, len(rec), h[6], h[7])
    blob = gzip.compress(head + s['hq'] + s['sf'] + s['sdq'].tobytes() + bbytes + rec.tobytes() + s['low'], 6)
    open(f'{OUT}/sec/{sx}_{sz}.kvs', 'wb').write(blob)
    total += len(blob)
print(f'sector data {total / 1e6:.1f} MB')
