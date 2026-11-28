#!/usr/bin/env python3
"""The small things on Tallinn's centre streets (28 Nov 2026), for src/world/tln/centremarks.js and centre.js.

Usage:  python3 tools/tln/marks.py MLY_FEATURES.json OSM_CLIP.json AREA.json     -> public/data/tln/marks.json

- holes: manhole lids and drain grates where Mapillary's detections put them, [kind, x, z, yaw] (kind 0 a lid,
  1 a grate). A grate is moved to the kerb of the nearest street and turned along it.
- bars: the painted arrows Mapillary found, each set on the middle of its lane and turned along the street, as bars
  [x1, z1, x2, z2, width] like lines.json.
- trams: OpenStreetMap's tram lines (1067 mm gauge), as polylines in game metres.
Everything per map square ("sx_sz").
"""
import json, math, os, sys
from collections import defaultdict
import numpy as np
from pyproj import Transformer
from shapely.geometry import Polygon, Point, LineString

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DATA = os.path.join(ROOT, 'public', 'data', 'tln')
E0, N0 = 548000.0, 6592000.0
S, G0 = 640.0, -800.0
CAR = {'Tänav', 'Põhimaantee', 'Kõrvalmaantee', 'Tugimaantee', 'Ramp või ühenduste', 'Muu tee'}
T = Transformer.from_crs('EPSG:4326', 'EPSG:3301', always_xy=True)


def game(lon, lat):
    e, n = T.transform(lon, lat)
    return e - E0, N0 - n


def sec(x, z): return f'{int((x - G0) // S)}_{int((z - G0) // S)}'


feats = json.load(open(sys.argv[1]))
osm = json.load(open(sys.argv[2]))
area = Polygon([(e - E0, N0 - n) for e, n in json.load(open(sys.argv[3]))]).buffer(60)
roads = [r for r in json.load(open(os.path.join(DATA, 'vectors.json')))['roads'] if r['type'] in CAR and len(r['pts']) > 1]

# street segments in 20 m cells
CELL = 20.0
grid = defaultdict(list)
for ri, r in enumerate(roads):
    P = r['pts']
    for i in range(len(P) - 1):
        (ax, az), (bx, bz) = P[i], P[i + 1]
        pad = r['w'] / 2 + 6
        for cx in range(int((min(ax, bx) - pad) // CELL), int((max(ax, bx) + pad) // CELL) + 1):
            for cz in range(int((min(az, bz) - pad) // CELL), int((max(az, bz) + pad) // CELL) + 1):
                grid[(cx, cz)].append((ri, i))


def nearest(x, z):
    """(road, unit tangent, nearest point, distance from the edge, offset right of the tangent) of the nearest street."""
    best = None
    for ri, i in grid.get((int(x // CELL), int(z // CELL)), ()):
        r = roads[ri]; (ax, az), (bx, bz) = r['pts'][i], r['pts'][i + 1]
        dx, dz = bx - ax, bz - az; L = math.hypot(dx, dz) or 1
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (L * L)))
        px, pz = ax + dx * t, az + dz * t
        d = math.hypot(x - px, z - pz)
        edge = d - r['w'] / 2
        if best is None or edge < best[3]:
            ux, uz = dx / L, dz / L
            off = (x - px) * -uz + (z - pz) * ux      # + = right of the direction (x east, z south: (-uz, ux) is to the right)
            best = (r, (ux, uz), (px, pz), edge, off)
    return best


# OpenStreetMap's one-way streets: segments and their way of travel, in the same cells
ONE = defaultdict(list)
for w in osm['ways']:
    tg = w['t']
    if 'highway' not in tg: continue
    ow = tg.get('oneway') or ('yes' if tg.get('junction') in ('roundabout', 'circular') else None)
    if ow not in ('yes', '-1', 'true', '1'): continue
    G = [game(lon, lat) for lon, lat in w['ll']]
    if ow == '-1': G = G[::-1]
    for (ax, az), (bx, bz) in zip(G, G[1:]):
        for cx in range(int((min(ax, bx) - 8) // CELL), int((max(ax, bx) + 8) // CELL) + 1):
            for cz in range(int((min(az, bz) - 8) // CELL), int((max(az, bz) + 8) // CELL) + 1):
                ONE[(cx, cz)].append((ax, az, bx, bz))


def oneway(x, z, ux, uz):
    """+1 / -1 when a one-way street within 8 m runs along (ux, uz) / against it, else 0."""
    best, bd = 0, 8.0
    for ax, az, bx, bz in ONE.get((int(x // CELL), int(z // CELL)), ()):
        dx, dz = bx - ax, bz - az; L = math.hypot(dx, dz) or 1
        if abs(dx * ux + dz * uz) / L < 0.8: continue          # (another street crossing)
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (L * L)))
        d = math.hypot(x - ax - dx * t, z - az - dz * t)
        if d < bd: bd, best = d, (1 if dx * ux + dz * uz > 0 else -1)
    return best


holes, bars, trams = defaultdict(list), defaultdict(list), defaultdict(list)
agree = [0, 0]


def put_bar(p, q, w):
    bars[sec((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)].extend([round(p[0], 2), round(p[1], 2), round(q[0], 2), round(q[1], 2), w])


def arrow(kind, cx, cz, ux, uz):
    """An arrow 5 m long on the lane's middle, pointing (ux, uz): a straight shaft, a bend for the turns, a filled head."""
    lx, lz = uz, -ux                                                   # (to the left)
    P = lambda a, o: (cx + ux * a + lx * o, cz + uz * a + lz * o)       # a along, o to the left
    W = 0.16

    def head(a0, o0, dx, dz, L=1.4, B=0.8):
        # a filled triangle from the base at (a0, o0) pointing (dx, dz) in (along, left) terms, as five bars
        nx, nz = -dz, dx
        for k in range(5):
            o = (k - 2) * B / 5
            ln = L * (1 - abs(o) / (B / 2)) + 0.05
            put_bar(P(a0 + nx * o, o0 + nz * o), P(a0 + nx * o + dx * ln, o0 + nz * o + dz * ln), B / 5 + 0.02)

    turn = 'left' in kind and 'split' not in kind and 1 or 'right' in kind and 'split' not in kind and -1 or 0
    if kind.endswith('straight') and 'split' not in kind:
        put_bar(P(-2.5, 0), P(1.1, 0), W); head(1.1, 0, 1, 0)
    elif turn:
        put_bar(P(-2.5, 0), P(0.4, 0), W)
        prev = (0.4, 0)
        for k in range(1, 5):                                  # a quarter bend of radius 0.6
            th = k / 4 * math.pi / 2
            cur = (0.4 + 0.6 * math.sin(th), turn * 0.6 * (1 - math.cos(th)))
            put_bar(P(*prev), P(*cur), W); prev = cur
        head(prev[0], prev[1], 0, turn, L=1.1, B=0.75)
    else:                                                      # split: straight on and a turn
        side = 1 if 'left' in kind else -1
        put_bar(P(-2.5, 0), P(1.1, 0), W); head(1.1, 0, 1, 0, L=1.2, B=0.7)
        put_bar(P(-1.2, 0), P(-0.2, side * 0.55), W); head(-0.2, side * 0.55, 0.6, side * 0.8, L=0.9, B=0.6)


for fid, (val, lon, lat, al) in feats.items():
    if not (val.startswith('marking--discrete--arrow') or val in ('object--manhole', 'object--catch-basin')): continue
    x, z = game(lon, lat)
    if not area.contains(Point(x, z)): continue
    nb = nearest(x, z)
    if val == 'object--manhole':
        if nb is None or nb[3] > 3: continue           # (on the street or by its kerb)
        if nb[0].get('s') in (1, 2, 3) or nb[0].get('e'): continue
        holes[sec(x, z)].extend([0, round(x, 2), round(z, 2), round(math.atan2(nb[1][1], nb[1][0]), 2)])
    elif val == 'object--catch-basin':
        if nb is None or nb[3] > 4 or nb[0].get('s') in (1, 2, 3) or nb[0].get('e'): continue
        r, (ux, uz), (px, pz), edge, off = nb
        o = math.copysign(r['w'] / 2 - 0.3, off or 1)
        gx, gz = px - uz * o, pz + ux * o
        holes[sec(gx, gz)].extend([1, round(gx, 2), round(gz, 2), round(math.atan2(uz, ux), 2)])
    else:
        if nb is None or nb[3] > 0.5 or nb[0].get('e'): continue
        r, (ux, uz), (px, pz), edge, off = nb
        n = max(1, round(r['w'] / 3.3)); lw = r['w'] / n
        lane = min(n - 1, max(0, int((off + r['w'] / 2) // lw)))
        o = -r['w'] / 2 + (lane + 0.5) * lw
        # which way: the lane's side of the middle on a two-way street (keep right); Mapillary's direction where given
        # (Mapillary's aligned direction agreed with this only half the time: no help)
        sgn = oneway(px, pz, ux, uz)
        if sgn: agree[0] += 1
        else: sgn = 1 if o > 0 else -1; agree[1] += 1      # (o > 0: right of the line's way)
        ax, az = px - uz * o, pz + ux * o
        arrow(val.split('--')[-1], ax, az, ux * sgn, uz * sgn)

print('arrows by one-way street / keep right:', agree)

# tram lines
for w in osm['ways']:
    if w['t'].get('railway') != 'tram': continue
    line = LineString([game(lon, lat) for lon, lat in w['ll']])
    cut = line.intersection(area)
    for g in getattr(cut, 'geoms', [cut]):
        if g.is_empty or g.geom_type != 'LineString' or g.length < 2: continue
        g = g.simplify(0.15)
        pts = [[round(x, 2), round(z, 2)] for x, z in g.coords]
        trams[sec(*pts[len(pts) // 2])].append(pts)

# streets OpenStreetMap says are of stone (setts, cobbles, concrete pavers) that the map has as asphalt: most of their
# length within 4 m of such a way
STONE = {'sett', 'cobblestone', 'unhewn_cobblestone', 'paving_stones'}
SG = defaultdict(list)
for w in osm['ways']:
    tg = w['t']
    if tg.get('surface') not in STONE or tg.get('highway') in (None, 'footway', 'cycleway', 'steps', 'path', 'platform', 'corridor'): continue
    G = [game(lon, lat) for lon, lat in w['ll']]
    for (ax, az), (bx, bz) in zip(G, G[1:]):
        for cx in range(int((min(ax, bx) - 5) // CELL), int((max(ax, bx) + 5) // CELL) + 1):
            for cz in range(int((min(az, bz) - 5) // CELL), int((max(az, bz) + 5) // CELL) + 1):
                SG[(cx, cz)].append((ax, az, bx, bz))


def near_stone(x, z):
    for ax, az, bx, bz in SG.get((int(x // CELL), int(z // CELL)), ()):
        dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L2))
        if math.hypot(x - ax - dx * t, z - az - dz * t) < 4: return True
    return False


stone = []
for r in roads:
    if r.get('s') in (1, 2, 3) or r.get('e'): continue
    mid = r['pts'][len(r['pts']) // 2]
    if not area.contains(Point(*mid)): continue
    L = LineString(r['pts'])
    if L.length < 4: continue
    hits = [near_stone(*L.interpolate(d).coords[0]) for d in np.arange(0, L.length + 1e-6, 2.0)]
    if sum(hits) >= 0.6 * len(hits): stone.append(f"{r['pts'][0][0]:.1f},{r['pts'][0][1]:.1f},{r['pts'][-1][0]:.1f},{r['pts'][-1][1]:.1f}")
print('stone streets', len(stone))

out = {'credit': 'Mapillary detections; OpenStreetMap contributors (ODbL)',
       'holes': holes, 'bars': bars, 'trams': trams, 'stone': stone}
json.dump(out, open(os.path.join(DATA, 'marks.json'), 'w'), separators=(',', ':'))
print('holes', sum(len(v) for v in holes.values()) // 4, 'bars', sum(len(v) for v in bars.values()) // 5,
      'tram lines', sum(len(v) for v in trams.values()), 'size', os.path.getsize(os.path.join(DATA, 'marks.json')))
