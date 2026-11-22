"""Roads over streams and ditches: python3 tools/bake/stream_crossings.py ETAK_DIR public/data [--write]

The Land Board's terrain model has bridges and culverts taken out, and only the wider streams are water
shapes in the map, so where a road crosses a ditch or a brook the game's ground dips into the ditch: a
hole in the road up to 2 m deep (Kõrveküla-Lähte tee over the Vasula peakraav, Martin 22 Nov 2026).

ETAK_DIR holds the stream lines of ETAK, E_203_vooluveekogu_j.shp (from ETAK_Eesti_SHP_veekogud.zip, see
README.md). For every drivable road that crosses one, the road is followed 45 m to each side (on along
the straightest road at its ends) and where it sinks into a short, steep-sided hole at the stream, the road
is laid straight across it again:
  - over a ditch (kraav): the ground under the road and its shoulders is filled up to that line, with
    1:1.5 sides down to the ditch, as a road over a culvert looks;
  - over a brook, a river or a main ditch (oja, jõgi, peakraav) as deep as 0.8 m or more: the same
    embankment, but the channel itself is left open and a small bridge (deck with b: 'small', railings,
    red and white posts at the ends; drawn by src/world/decks.js) spans it.
A road on a deck already (e) or a crossing under an existing deck is left alone. Nothing is ever dug.

Always writes tools/bake/stream_crossings.json, the crossings that tools/road-dip-test.mjs checks (PROF=1
prints the road profile of each one changed, before and after).
With --write it changes the sector heights (trees standing on changed ground follow it) and adds the
bridges to vectors.json. Run it after any reheight / lidar_decks run (they rebuild the ground and decks).
"""
import gzip
import json
import os
import struct
import sys

import numpy as np
import shapefile
from scipy.spatial import cKDTree
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import E0, N0  # noqa

ETAK, DATA = sys.argv[1], sys.argv[2]
WRITE = '--write' in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(f'{DATA}/meta.json'))
vec = json.load(open(f'{DATA}/vectors.json'))
S, G0 = meta['sector']['size'], meta['sector']['grid0']
HN, HQ, HOFF = meta['height']['n'], meta['height']['scale'], meta['height']['offset']
SECTORS = {(sx, sz) for sx, sz, _ in meta['sector']['list']}

REACH = 45          # metres of road looked at on each side of the stream
WIN = 15            # a hole is what a closing with this half width fills: no wider than about 30 m
MIN_FILL = 0.25     # shallower than this is the road's own unevenness
MIN_SLOPE = 0.1     # a hole with gentler sides (or wider) is a real dip of the road (a valley), left as it is
MAX_WIDTH = 26
BRIDGE_KINDS = ('Jõgi', 'Oja', 'Peakraav')
BRIDGE_DEPTH = 0.8
SIDE = 1.5          # embankment sides, 1 up : 1.5 across
CHANNEL = {'Jõgi': 3.5, 'Oja': 2.0, 'Peakraav': 1.8, 'Kraav': 1.5}   # half width of the open channel under a bridge


# ---- the game's ground: sector heights, kept in memory and changed in place
_sec = {}


def sector(sx, sz):
    k = (sx, sz)
    if k not in _sec:
        p = f'{DATA}/sec/{sx}_{sz}.kvs'
        if k not in SECTORS or not os.path.exists(p):
            _sec[k] = None
        else:
            b = open(p, 'rb').read()
            if b[:2] == b'\x1f\x8b':
                b = gzip.decompress(b)
            _sec[k] = np.frombuffer(b, '<u2', HN * HN, 32).reshape(HN, HN) * HQ + HOFF
    return _sec[k]


def terrain(x, z):
    x, z = np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float))
    out = np.full(x.shape, np.nan)
    sx, sz = np.floor((x - G0) / S).astype(int), np.floor((z - G0) / S).astype(int)
    for k in set(zip(sx.ravel().tolist(), sz.ravel().tolist())):
        H = sector(*k)
        if H is None:
            continue
        m = (sx == k[0]) & (sz == k[1])
        fx, fz = (x[m] - G0 - k[0] * S) / 2, (z[m] - G0 - k[1] * S) / 2
        c, r = np.minimum(fx.astype(int), HN - 2), np.minimum(fz.astype(int), HN - 2)
        fx, fz = fx - c, fz - r
        out[m] = (H[r, c] * (1 - fx) + H[r, c + 1] * fx) * (1 - fz) + (H[r + 1, c] * (1 - fx) + H[r + 1, c + 1] * fx) * fz
    return out


def node_height(x, z):
    sx, sz = int(np.floor((x - G0) / S)), int(np.floor((z - G0) / S))
    H = sector(sx, sz)
    if H is None:
        return None
    return H[int(round((z - G0 - sz * S) / 2)), int(round((x - G0 - sx * S) / 2))]


changed = {}        # (x, z) of a node -> new height


def raise_node(x, z, h):
    old = node_height(x, z)
    if old is None or h <= old + 0.02:
        return
    key = (round(x, 1), round(z, 1))
    changed[key] = max(changed.get(key, -1e9), h)


# ---- streams
def streams():
    r = shapefile.Reader(os.path.join(ETAK, 'E_203_vooluveekogu_j.shp'), encoding='utf-8')
    xs = [G0 + sx * S for sx, _ in SECTORS] + [G0 + (sx + 1) * S for sx, _ in SECTORS]
    zs = [G0 + sz * S for _, sz in SECTORS] + [G0 + (sz + 1) * S for _, sz in SECTORS]
    bb = (E0 + min(xs), N0 - max(zs), E0 + max(xs), N0 - min(zs))
    out = []
    for sr in r.iterShapeRecords(bbox=bb):
        p = sr.record.as_dict()
        if p.get('telje_ty00') == 'Mõtteline telg':          # a line drawn through a lake, not a channel
            continue
        pts = [(x - E0, N0 - y) for x, y in sr.shape.points]
        parts = list(sr.shape.parts) + [len(pts)]
        for a, b in zip(parts[:-1], parts[1:]):
            if b - a > 1:
                out.append((p, LineString(pts[a:b])))
    return out


# ---- roads
DRIVABLE = lambda r: r['type'] not in ('Rada', 'Kergliiklustee') and len(r['pts']) > 1
R = vec['roads']
ends = {}
ek = lambda p: (round(p[0] * 2), round(p[1] * 2))
for i, r in enumerate(R):
    if DRIVABLE(r):
        for p in (r['pts'][0], r['pts'][-1]):
            ends.setdefault(ek(p), []).append(i)


def carry_on(i, p, d, length):
    """Up to `length` metres of the straightest road that goes on from the end p (arriving along d)."""
    best, bc = None, np.cos(np.pi / 5)
    for j in ends.get(ek(p), []):
        if j == i:
            continue
        q = R[j]['pts']
        pts = q if ek(q[0]) == ek(p) else q[::-1]
        v = np.subtract(pts[1], p)
        c = float(v @ d) / (np.linalg.norm(v) or 1)
        if c > bc:
            bc, best = c, pts
    if best is None:
        return []
    out, run = [], 0.0
    for k in range(1, len(best)):
        if run >= length:
            break
        run += float(np.hypot(*np.subtract(best[k], best[k - 1])))
        out.append(best[k])
    return out


def along(i, x, z):
    """Points every metre along road i (carried on past its ends) from REACH before the point x, z to REACH after it,
    and the index of the point itself."""
    p = R[i]['pts']
    d0 = np.subtract(p[0], p[1]); d0 = d0 / (np.linalg.norm(d0) or 1)
    d1 = np.subtract(p[-1], p[-2]); d1 = d1 / (np.linalg.norm(d1) or 1)
    line = carry_on(i, p[0], d0, REACH + 5)[::-1] + [list(q) for q in p] + carry_on(i, p[-1], d1, REACH + 5)
    ln = LineString(line)
    s0 = ln.project(Point(x, z))
    ss = np.arange(max(0.0, s0 - REACH), min(ln.length, s0 + REACH) + 1e-6, 1.0)
    pts = np.array([ln.interpolate(s).coords[0] for s in ss])
    return pts, int(np.argmin(np.abs(ss - s0)))


def main():
    st = streams()
    tree = STRtree([g for _, g in st])
    dk = [(d, LineString([q[:2] for q in d['pts']]).buffer(max(d.get('ws') or [d['hw']]) + 3)) for d in vec.get('decks', []) if len(d['pts']) > 1 and d.get('b') != 'small']
    dtree = STRtree([g for _, g in dk])
    crossings, seen = [], set()
    for i, r in enumerate(R):
        if not DRIVABLE(r) or r.get('e'):
            continue
        ln = LineString(r['pts'])
        for k in tree.query(ln):
            props, g = st[k]
            hit = ln.intersection(g)
            for q in getattr(hit, 'geoms', [hit]):
                if q.geom_type != 'Point':
                    continue
                key = (round(q.x), round(q.y))
                if key in seen:
                    continue
                seen.add(key)
                under = any(dk[j][1].contains(q) for j in dtree.query(q))
                crossings.append(dict(i=i, x=q.x, z=q.y, kind=props['tyyp_t'], name=props['nimetus'] or '',
                                      axis=props['telje_ty00'], stream=g, under=under))
    # and the water shapes of the map (wider streams, ponds) that a road runs over where no stream line does
    polys = []
    for w in vec.get('water', []):
        if w.get('river'):
            continue
        for pl in w['polys']:
            g = Polygon(pl['outer'], pl.get('holes') or []).buffer(0)
            if not g.is_empty:
                polys.append(g)
    ptree = STRtree(polys)
    near = STRtree([Point(c['x'], c['z']) for c in crossings]) if crossings else None
    for i, r in enumerate(R):
        if not DRIVABLE(r) or r.get('e'):
            continue
        ln = LineString(r['pts'])
        for k in ptree.query(ln):
            hit = ln.intersection(polys[k])
            for q in getattr(hit, 'geoms', [hit]):
                if q.is_empty or q.length < 1:
                    continue
                mid = q.interpolate(0.5, normalized=True)
                if near is not None and len(near.query(mid.buffer(12))):
                    continue
                under = any(dk[j][1].contains(mid) for j in dtree.query(mid))
                crossings.append(dict(i=i, x=mid.x, z=mid.y, kind='Vesi', name='', axis='', stream=polys[k].boundary, under=under))
    print('road and stream crossings', len(crossings), 'of them under a deck', sum(c['under'] for c in crossings))

    new_decks, fixes = [], []
    for c in crossings:
        if c['under']:
            c['fix'] = 'deck'
            continue
        r = R[c['i']]
        pts, k0 = along(c['i'], c['x'], c['z'])
        if len(pts) < 16:
            c['fix'] = 'short'
            continue
        h = terrain(pts[:, 0], pts[:, 1])
        if np.isnan(h).any():
            c['fix'] = 'off map'
            continue
        # how far below the lower of the highest points within WIN on each side (none at a dead end)
        n = len(h)
        lmax = np.array([h[max(0, q - WIN):q + 1].max() for q in range(n)])
        rmax = np.array([h[q:q + WIN + 1].max() for q in range(n)])
        fill = np.minimum(lmax, rmax) - h
        lo, hi = max(0, k0 - 6), min(len(h), k0 + 7)
        m = lo + int(np.argmax(fill[lo:hi]))
        depth = float(fill[m])
        c['depth'] = round(depth, 2)
        if depth < MIN_FILL:
            c['fix'] = 'none'
            continue
        a, b = m, m
        while a > 0 and fill[a - 1] > 0.04:
            a -= 1
        while b < len(h) - 1 and fill[b + 1] > 0.04:
            b += 1
        a, b = max(a - 1, 0), min(b + 1, len(h) - 1)
        dh = np.diff(h)
        steep = -dh[a:m].min(initial=0) >= MIN_SLOPE and dh[m:b].max(initial=0) >= MIN_SLOPE
        if b - a > MAX_WIDTH or not (steep or depth >= 0.4):
            c['fix'] = 'gentle'
            if os.environ.get('PROF'):
                print('  gentle', round(depth, 2), b - a, round(c['x']), round(c['z']), ' '.join(f'{v:.1f}' for v in h[max(0, a - 3):b + 4]))
            continue
        idx = np.arange(a, b + 1)
        y = np.maximum(np.interp(idx, [a, b], [h[a], h[b]]), h[idx])
        bridge = c['kind'] in BRIDGE_KINDS and depth >= BRIDGE_DEPTH and c['axis'] != 'Maa-alune telg'
        c['fix'] = 'bridge' if bridge else 'fill'
        c['prof'] = f'k0 {k0} m {m} a {a} b {b} n {len(h)}: ' + ' '.join(f'{v:.1f}' for v in h[max(0, a - 3):b + 4])
        c['new'] = ' '.join(f'{v:.1f}' for v in np.concatenate([h[max(0, a - 3):a], y, h[b + 1:b + 4]]))
        fixes.append(c)
        hw = r['w'] / 2
        cw = CHANNEL.get(c['kind'], 1.5)
        # the ground nodes around the stretch: nearest station, how far to the side, how far past the ends
        sp = pts[a:b + 1]
        kd = cKDTree(sp)
        reach = hw + 0.5 + depth * SIDE + 2
        x0, z0 = sp.min(0) - reach
        x1, z1 = sp.max(0) + reach
        gx = np.arange(np.floor((x0 - G0) / 2) * 2 + G0, x1 + 2, 2.0)
        gz = np.arange(np.floor((z0 - G0) / 2) * 2 + G0, z1 + 2, 2.0)
        X, Z = np.meshgrid(gx, gz)
        X, Z = X.ravel(), Z.ravel()
        dist, j = kd.query(np.stack([X, Z], 1))
        tang = pts[np.minimum(a + j + 1, len(pts) - 1)] - pts[np.maximum(a + j - 1, 0)]
        tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
        rel = np.stack([X, Z], 1) - sp[j]
        past = np.abs((rel * tang).sum(1))                      # beyond the first or last station
        lat = np.abs(rel[:, 0] * -tang[:, 1] + rel[:, 1] * tang[:, 0])
        ok = (past < 1.2) & (dist < reach)
        tgt = y[j] - np.maximum(0, lat - (hw + 0.5)) / SIDE
        if bridge:
            open_ = np.array([c['stream'].distance(Point(px, pz)) < cw for px, pz in zip(X, Z)])
            ok &= ~open_
        for px, pz, t in zip(X[ok], Z[ok], tgt[ok]):
            raise_node(px, pz, t)
        if bridge:
            # the span: over the channel, a couple of metres onto the embankment at each end
            ds = np.array([c['stream'].distance(Point(px, pz)) for px, pz in sp])
            wet = np.nonzero(ds < cw + 2.5)[0]
            if len(wet) == 0:
                wet = np.array([m - a])
            s0, s1 = max(int(wet.min()) - 1, 0), min(int(wet.max()) + 1, len(sp) - 1)
            if s1 - s0 < 6:
                s0, s1 = max(0, (s0 + s1) // 2 - 3), min(len(sp) - 1, (s0 + s1) // 2 + 3)
            dhw = round(min(hw, 4.2) + 0.3, 2)
            P = [[round(float(sp[q, 0]), 2), round(float(sp[q, 1]), 2), round(float(y[q]), 2), round(float(y[q]), 2)] for q in range(s0, s1 + 1)]
            new_decks.append({'k': 1, 'hw': dhw, 'pts': P, 'rail': [0, len(P) - 1], 'w': 1, 'b': 'small', 'n': r.get('name', '')})

    by = {}
    for c in crossings:
        by[c['fix']] = by.get(c['fix'], 0) + 1
    print('crossings by what was done:', by)
    for c in sorted(fixes, key=lambda c: -c['depth']):
        print(f"  {c['fix']:6s} {c['depth']:5.2f} m  {c['x']:8.1f} {c['z']:8.1f}  {R[c['i']].get('name') or R[c['i']]['type']}  over {c['kind']} {c['name']}")
        if os.environ.get('PROF'):
            print('         ', c['prof']); print('         ', c['new'])
    print('ground nodes raised', len(changed), ' bridges', len(new_decks))

    # the list the road check walks (tools/road-dip-test.mjs)
    json.dump([[round(c['x'], 1), round(c['z'], 1), c['kind'], c['name']] for c in crossings],
              open(os.path.join(HERE, 'stream_crossings.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    if not WRITE:
        return
    secs = write_heights(changed)
    print('sectors written', len(secs))
    # (a rerun on top of its own output finds nothing left to fill: the old small bridges are dropped first)
    vec['decks'] = [d for d in vec.get('decks', []) if d.get('b') != 'small'] + new_decks
    txt = json.dumps(vec, ensure_ascii=False, separators=(',', ':'))
    open(f'{DATA}/vectors.json', 'w').write(txt)


def write_heights(changed):
    """Node heights into the sector files (a node on a sector edge is in both); trees on changed ground follow it."""
    per = {}
    for (x, z), h in changed.items():
        fx, fz = (x - G0) / S, (z - G0) / S
        for sx in {int(np.floor(fx)), int(np.floor(fx - 1e-9))}:
            for sz in {int(np.floor(fz)), int(np.floor(fz - 1e-9))}:
                c, r = int(round((x - G0 - sx * S) / 2)), int(round((z - G0 - sz * S) / 2))
                if 0 <= c < HN and 0 <= r < HN and (sx, sz) in SECTORS:
                    per.setdefault((sx, sz), []).append((r, c, h))
    for (sx, sz), lst in per.items():
        p = f'{DATA}/sec/{sx}_{sz}.kvs'
        raw = open(p, 'rb').read()
        b = bytearray(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
        H = np.frombuffer(b, '<u2', HN * HN, 32).reshape(HN, HN)
        old = H * HQ + HOFF
        for r, c, h in lst:
            H[r, c] = int(np.clip(round((h - HOFF) / HQ), 0, 65535))
        new = H * HQ + HOFF
        # trees: the ground under a tree that stood on it moved with it
        nv, nt = struct.unpack_from('<2I', b, 16)
        o_t = 32 + HN * HN * 2 + meta['surface']['n'] ** 2 + meta['sdf']['n'] ** 2 + nv * 15
        tr = np.frombuffer(b, '<f4', nt * 6, o_t).reshape(-1, 6)
        x0, z0 = G0 + sx * S, G0 + sz * S

        def at(A, x, z):
            fx, fz = np.clip((x - x0) / 2, 0, HN - 1.001), np.clip((z - z0) / 2, 0, HN - 1.001)
            c, r = fx.astype(int), fz.astype(int)
            fx, fz = fx - c, fz - r
            return (A[r, c] * (1 - fx) + A[r, c + 1] * fx) * (1 - fz) + (A[r + 1, c] * (1 - fx) + A[r + 1, c + 1] * fx) * fz
        if nt:
            g0, g1 = at(old, tr[:, 0], tr[:, 2]), at(new, tr[:, 0], tr[:, 2])
            mv = (np.abs(g1 - g0) > 0.01) & (np.abs(tr[:, 1] - g0) < 0.1)
            if mv.any():
                tr[mv, 1] = g1[mv]
        open(p, 'wb').write(gzip.compress(bytes(b), 6))
    return sorted(per)


main()
