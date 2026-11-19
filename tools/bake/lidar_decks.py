"""Overpass decks from the laser scan: python3 tools/bake/lidar_decks.py GRIDS public/data [--write]

The terrain model has bridges removed, and it does not know how high a bridge is, how wide, or where
it ends; a viaduct on long walled ramps is missing from it altogether. The Land Board's lidar point
cloud does: bridge decks are their own class (17), and the top of a walled ramp is "unclassified".

GRIDS holds one file per 1 km lidar sheet, written by lidar_grid.py. For every road that the map
data marks as elevated (e: 1 in vectors.json), followed some way past both ends, this finds
  - the stretches on a bridge (class 17 under the centre line): an open deck, as wide as the
    structure really is and at its real height, with piers where no road runs below;
  - the stretches on a walled ramp up to it (road surface well above the terrain of the game):
    a deck with solid walls down to the ground (wall: 1).
They replace the dry-land spans that terrain.py made (k: 1 without w). A river bridge that the map starts in the junction
before it is cut back to where the scan finds the bridge, and the street there is laid to the scanned ground (trim_land_ends).
Where a river bridge still runs over land at its ends,
the ground under it is raised into an earth bank (fill_ends), so the deck does not start as a bare slab over
the slope down to the water. Road lines that run along a
new deck are marked e: 1, so their lane lines are drawn on it. A new deck over water keeps the name and the look (w, n, b) of the bridge it replaces. Tunnel lids (k: 0) are laid on the first run and kept on later ones.
"""
import gzip
import json
import os
import sys

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, unary_union
from shapely.strtree import STRtree

from config import E0, N0, H0

GRIDS, DATA = sys.argv[1], sys.argv[2]
WRITE = '--write' in sys.argv
meta = json.load(open(f'{DATA}/meta.json'))
vec = json.load(open(f'{DATA}/vectors.json'))
S, G0 = meta['sector']['size'], meta['sector']['grid0']
HN = meta['height']['n']
OFF = np.arange(-22, 23)            # metres to the left of the centre line


# ---- the game's terrain and the lidar grids
_sec, _lid = {}, {}


def sector(sx, sz):
    k = (sx, sz)
    if k not in _sec:
        p = f'{DATA}/sec/{sx}_{sz}.kvs'
        if not os.path.exists(p):
            _sec[k] = None
        else:
            b = open(p, 'rb').read()
            if b[:2] == b'\x1f\x8b':
                b = gzip.decompress(b)
            _sec[k] = np.frombuffer(b, '<u2', HN * HN, 32).reshape(HN, HN) * meta['height']['scale'] + meta['height']['offset']
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


def lidar(name, x, z):
    """Grid value (game height) at world points; NaN where the lidar has none."""
    x, z = np.asarray(x, float), np.asarray(z, float)
    e, n = E0 + x, N0 - z
    out = np.full(x.shape, np.nan)
    ke, kn = np.floor(e / 1000).astype(int), np.floor(n / 1000).astype(int)
    for k in set(zip(kn.ravel().tolist(), ke.ravel().tolist())):
        sheet = (k[0] - 6000) * 1000 + k[1]
        if sheet not in _lid:
            p = f'{GRIDS}/{sheet}.npz'
            _lid[sheet] = dict(np.load(p)) if os.path.exists(p) else None
            if _lid[sheet] is not None:                       # class 17 is sparse: fill 1-cell holes from the neighbours
                b = _lid[sheet]['b']
                pad = np.pad(b, 1, constant_values=np.nan)
                nb = np.stack([pad[1 + i:1001 + i, 1 + j:1001 + j] for i in (-1, 0, 1) for j in (-1, 0, 1) if i or j])
                with np.errstate(all='ignore'):
                    _lid[sheet]['b'] = np.where(np.isfinite(b), b, np.nanmedian(nb, 0))
        g = _lid[sheet]
        if g is None:
            continue
        m = (kn == k[0]) & (ke == k[1])
        col = np.clip((e[m] - k[1] * 1000).astype(int), 0, 999)
        row = np.clip(((k[0] + 1) * 1000 - n[m]).astype(int), 0, 999)
        out[m] = g[name][row, col] - H0
    return out


def surface(x, z):
    """Top of the built ground: bridge deck, else ground, else unclassified (the top of a walled ramp)."""
    b, g, u = lidar('b', x, z), lidar('g', x, z), lidar('u', x, z)
    return np.where(np.isfinite(b), b, np.where(np.isfinite(g), g, u))


# ---- road graph
R = vec['roads']
nodes = {}
for i, r in enumerate(R):
    p = r['pts']
    for end, a in ((0, p[0]), (1, p[-1])):
        nodes.setdefault((round(a[0] * 2) / 2, round(a[1] * 2) / 2), []).append((i, end))


def walk(pt, prev, dist):
    """Points along the straightest continuation of a road beyond pt (coming from prev)."""
    out, seen = [np.array(pt, float)], set()
    d0 = np.array(pt, float) - np.array(prev, float)
    d0 /= np.linalg.norm(d0) + 1e-9
    while dist > 0:
        best = None
        for j, e2 in nodes.get((round(out[-1][0] * 2) / 2, round(out[-1][1] * 2) / 2), []):
            if j in seen or R[j]['type'] == 'Rada' and False:
                continue
            q = np.array(R[j]['pts'], float)
            q = q if e2 == 0 else q[::-1]
            if np.hypot(*(q[0] - out[-1])) > 0.6 or len(q) < 2:
                continue
            d = q[min(2, len(q) - 1)] - q[0]
            d /= np.linalg.norm(d) + 1e-9
            if best is None or d @ d0 > best[0]:
                best = (d @ d0, j, q)
        if best is None or best[0] < 0.8:
            break
        seen.add(best[1])
        out += list(best[2][1:])
        dist -= LineString(best[2]).length
        d0 = best[2][-1] - best[2][-2]
        d0 /= np.linalg.norm(d0) + 1e-9
    return out[1:]


def chains():
    segs = [LineString(r['pts']) for r in R if r.get('e') == 1 and len(r['pts']) > 1]
    info = [r for r in R if r.get('e') == 1 and len(r['pts']) > 1]
    tree = STRtree(segs)
    merged = linemerge(segs)
    for ch in sorted(merged.geoms if hasattr(merged, 'geoms') else [merged], key=lambda g: -g.length):
        on = [i for i in tree.query(ch) if segs[i].distance(ch) < 0.01 and segs[i].length > 0 and ch.buffer(0.05).contains(segs[i])]
        if not on:
            continue
        c = [np.array(q[:2], float) for q in ch.coords]
        EXT = 350
        pre, post = walk(c[0], c[1], EXT)[::-1], walk(c[-1], c[-2], EXT)
        ln = LineString(pre + c + post)
        n = int(ln.length) + 1
        pts = np.array([ln.interpolate(d).coords[0] for d in np.linspace(0, ln.length, n)])
        s0 = LineString(pre + [c[0]]).length if pre else 0.0
        # a line that comes back beside itself (the two sides of one bridge joined at an end): stop there
        tr = cKDTree(pts)
        lo, hi = 0, n - 1
        mid = int(s0 + ch.length / 2)
        for i in range(mid, n):
            if any(abs(j - i) > 40 for j in tr.query_ball_point(pts[i], 7.0)):
                hi = i - 8
                break
        for i in range(mid, -1, -1):
            if any(abs(j - i) > 40 and j < hi for j in tr.query_ball_point(pts[i], 7.0)):
                lo = i + 8
                break
        if hi - lo < 10:
            continue
        pts, s0 = pts[lo:hi + 1], s0 - lo
        yield dict(name=max((info[i]['name'] for i in on), key=len), type=info[max(on, key=lambda i: segs[i].length)]['type'],
                   w=max(info[i]['w'] for i in on), pts=pts, core=(s0, s0 + ch.length))


def smooth(a, med=5, mean=5):
    a = np.asarray(a, float)
    if len(a) < 3:
        return a
    a = ndimage.median_filter(a, min(med, len(a) // 2 * 2 - 1 or 1), mode='nearest')
    return ndimage.uniform_filter1d(a, min(mean, len(a)), mode='nearest')


def runs(mask):
    lab, k = ndimage.label(mask)
    return [np.nonzero(lab == i)[0] for i in range(1, k + 1)]


def extent(ok):
    """How far the True cells reach to each side of the middle column, bridging gaps of 2 cells."""
    n, m = ok.shape
    mid = m // 2
    L, Rr = np.zeros(n), np.zeros(n)
    for i in range(n):
        for side, out in ((1, L), (-1, Rr)):
            k, gap, last = 0, 0, 0
            while mid + side * (k + 1) in range(m) and gap <= 2:
                k += 1
                if ok[i, mid + side * k]:
                    last, gap = k, 0
                else:
                    gap += 1
            out[i] = last
    return L, Rr


road_lines = [LineString(r['pts']) for r in R]
road_tree = STRtree(road_lines)
landings = []
made = []                 # ribbons made so far: (polygon, height interpolator points)


def covered(x, z, y):
    for poly, tree, hs in made:
        if poly.contains(Point(x, z)):
            _, j = tree.query([x, z])
            if abs(hs[j] - y) < 0.8:
                return True
    return False


def build(ch):
    P = ch['pts']
    n = len(P)
    dx, dz = np.gradient(P[:, 0]), np.gradient(P[:, 1])
    l = np.hypot(dx, dz) + 1e-9
    nx, nz = -dz / l, dx / l                                       # left of the direction of travel
    X = P[:, :1] + nx[:, None] * OFF[None, :]
    Z = P[:, 1:] + nz[:, None] * OFF[None, :]
    B = lidar('b', X, Z)
    Sf = surface(X, Z)
    T = terrain(X.ravel(), Z.ravel()).reshape(X.shape)
    mid = len(OFF) // 2
    near = slice(mid - 2, mid + 3)
    cb = np.nanmedian(B[:, near], 1)                               # bridge deck under the centre line
    with np.errstate(all='ignore'):
        cs = ndimage.median_filter(np.nan_to_num(np.nanmedian(Sf[:, near], 1), nan=-999), 7, mode='nearest')
        ct = np.nanmedian(T[:, near], 1)
    cs[cs < -900] = np.nan
    fin = np.isfinite(cs)
    if fin.sum() > 2:                                              # no lidar under a truck or on fresh tarmac: bridge the gap
        gap = ~fin & (ndimage.binary_closing(np.pad(fin, 70), iterations=70)[70:-70])
        cs[gap] = np.interp(np.nonzero(gap)[0], np.nonzero(fin)[0], cs[fin])
    on_b = np.isfinite(cb) & (np.isfinite(B[:, near]).sum(1) >= 2)
    on_b = ndimage.binary_closing(np.pad(on_b, 8), iterations=6)[8:-8] & (ndimage.binary_dilation(on_b, iterations=6))
    for m in runs(on_b):                                           # a few metres of something else's class 17
        if len(m) < 6:
            on_b[m] = False
    # walled ramp: the road surface is well above the terrain of the game, next to a bridge of this road
    diff = np.where(np.isfinite(cs) & np.isfinite(ct), cs - ct, 0.0)
    kind = np.where(on_b, 1, 0)
    for m in runs((diff > 0.12) | on_b):
        if on_b[m].any() and (diff[m][~on_b[m]] > 0.45).any():
            for r in runs(~on_b[m]):
                rr = m[r]
                if (diff[rr] > 0.45).any():
                    kind[rr] = 2
    # a step between the end of a bridge and the terrain: carry the deck on over the ground until they meet
    for m in runs(on_b):
        for end, step in ((m[0], -1), (m[-1], 1)):
            i = end + step
            k = 0
            while 0 <= i < n and kind[i] == 0 and diff[i] > 0.12 and k < 12:
                kind[i] = 2 if diff[i] > 0.45 else 3
                i += step; k += 1
    kind[kind == 3] = 2
    used = made_union()
    out = []
    for whole in runs(kind > 0):
        if not (kind[whole] == 1).any() or whole[-1] < ch['core'][0] - 60 or whole[0] > ch['core'][1] + 60:
            continue
        subs = []
        for k in (1, 2):
            for r in runs(kind[whole] == k):
                subs.append((k, whole[r]))
        subs.sort(key=lambda t: t[1][0])
        for si, (k, m) in enumerate(subs):
            if k == 1 and len(m) < 6:
                continue
            if k == 2:                                           # share a station with the bridge next to it
                if m[0] - 1 >= 0 and kind[m[0] - 1] == 1:
                    m = np.r_[m[0] - 1, m]
                if m[-1] + 1 < n and kind[m[-1] + 1] == 1:
                    m = np.r_[m, m[-1] + 1]
            ref = np.where(kind[m] == 1, cb[m], cs[m])
            fin = np.isfinite(ref)
            if not fin.any():
                continue
            ref = np.interp(np.arange(len(m)), np.nonzero(fin)[0], ref[fin])
            src = np.where((kind[m] == 1)[:, None], B[m], Sf[m])
            ok = np.abs(src - ref[:, None]) < 0.8
            if k == 2:
                ok &= src - T[m] > 0.35
            if ch.get('others') is not None:                     # the other carriageway of a twin bridge has its own half
                do, _ = ch['others'].query(np.stack([X[m].ravel(), Z[m].ravel()], 1))
                ok &= do.reshape(X[m].shape) + 1.5 >= np.abs(OFF)[None, :]     # (they overlap by a metre or two)
            if used is not None:                                 # not what an earlier deck already carries
                import shapely
                ok &= ~(shapely.contains_xy(used[0], X[m], Z[m]) & (np.abs(used[1](X[m], Z[m]) - ref[:, None]) < 0.8))
            L, Rr = extent(ok)
            if k == 2:                                           # a ramp fades into the ground: keep the width it had higher up
                hi = (ref - ct[m]) > 1.0
                if hi.any():
                    L = np.where(hi, L, np.interp(np.arange(len(m)), np.nonzero(hi)[0], L[hi]))
                    Rr = np.where(hi, Rr, np.interp(np.arange(len(m)), np.nonzero(hi)[0], Rr[hi]))
            if (L + Rr).max() < 2:
                continue
            L, Rr = smooth(L, 15, 9), smooth(Rr, 15, 9)
            lo = max(1.0, ch['w'] / 2 - 0.5)                      # never narrower than the road it carries
            L, Rr = np.maximum(L, lo), np.maximum(Rr, lo)
            hw = (L + Rr) / 2 + 0.5
            sh = (L - Rr) / 2
            cx, cz = P[m, 0] + nx[m] * sh, P[m, 1] + nz[m] * sh
            if len(m) > 12:                                      # a smooth centre line: no kinks from the measured edges
                cx[3:-3], cz[3:-3] = ndimage.uniform_filter1d(cx, 9, mode='nearest')[3:-3], ndimage.uniform_filter1d(cz, 9, mode='nearest')[3:-3]

            def band(lo, hi_):
                v = np.full(len(m), np.nan)
                for i in range(len(m)):
                    o = OFF - sh[i]
                    sel = ok[i] & (o >= lo * hw[i]) & (o <= hi_ * hw[i])
                    if sel.any():
                        v[i] = np.median(src[i][sel])
                good = np.isfinite(v)
                if not good.any():
                    return ref.copy()
                return smooth(np.interp(np.arange(len(m)), np.nonzero(good)[0], v[good]), 7, 7)
            hL, hC, hR = band(0.35, 1.0), band(-0.3, 0.3), band(-1.0, -0.35)
            hL, hR = hC + np.clip(hL - hC, -0.5, 0.5), hC + np.clip(hR - hC, -0.5, 0.5)
            h = np.stack([hL, hC, hR], 1)
            # free ends: three more stations that come down to (or up to) the terrain
            for free, at, step in ((m[0] == whole[0], 0, -1), (m[-1] == whole[-1], -1, 1)):
                if not free:
                    continue
                far = m[at] + step * 6
                span = 6
                if 0 <= far < n:                                   # the bridge stops in mid-air (its real way down is a stair
                    t6 = terrain([P[far, 0]], [P[far, 1]])[0]      # or a side ramp): a 10 % slope down to the ground instead
                    if np.isfinite(t6) and abs(h[at, 1] - t6) > 0.6:
                        span = int(np.ceil(abs(h[at, 1] - t6) / 0.10 / 2) * 2)
                        landings.append((round(float(cx[at])), round(float(cz[at])), round(float(h[at, 1] - t6), 1)))
                end_row, end_sh, end_hw = h[at].copy(), sh[at], hw[at]
                for j in range(2, span + 1, 2):
                    i = m[at] + step * j
                    if not 0 <= i < n:
                        break
                    px, pz = P[i, 0] + nx[i] * end_sh, P[i, 1] + nz[i] * end_sh
                    tt = np.repeat(terrain([P[i, 0]], [P[i, 1]]), 3)        # the road itself; the edges may hang over its bank
                    if not np.isfinite(tt).all():
                        break
                    w8 = j / span
                    row = end_row * (1 - w8) + tt * w8
                    ins = 0 if step < 0 else len(cx)
                    cx, cz, hw = np.insert(cx, ins, px), np.insert(cz, ins, pz), np.insert(hw, ins, end_hw)
                    h = np.insert(h, ins, row, 0)
            cl = h[:, 1] - terrain(cx, cz)
            out.append(dict(kind='bridge' if k == 1 else 'ramp', a=int(m[0]), b=int(m[-1]), x=cx, z=cz, hw=hw, h=h, clear=cl))
    return out, dict(cb=cb, cs=cs, ct=ct, on_b=on_b, kind=kind)


def made_union():
    if not made:
        return None
    polys = [p for p, _, _ in made]
    allp = np.concatenate([t.data for _, t, _ in made])
    allh = np.concatenate([h for _, _, h in made])
    tree = cKDTree(allp)
    return unary_union(polys), lambda x, z: allh[tree.query(np.stack([np.ravel(x), np.ravel(z)], 1))[1]].reshape(np.shape(x))


def ribbon(d, name):
    """Game deck record from a run; every second station."""
    n = len(d['x'])
    keep = list(range(n)) if n < 12 else sorted(set(range(3, n - 3, 2)) | {0, 1, 2, n - 3, n - 2, n - 1})
    hw = d['hw']
    rec = {'k': 1, 'hw': round(float(hw.max()), 2),
           'pts': [[round(float(d['x'][i]), 2), round(float(d['z'][i]), 2)] + [round(float(v), 2) for v in d['h'][i]] for i in keep]}
    if hw.max() - hw.min() > 0.5:
        rec['ws'] = [round(float(hw[i]), 2) for i in keep]
    if d['kind'] == 'ramp':
        rec['wall'] = 1
    if name:
        rec['n'] = name
    return rec


def edge_pts(rec, out=0.0):
    """Left and right edge points of every station, moved out sideways: (n, 2) each, and the edge heights."""
    pts = np.array([q[:2] for q in rec['pts']])
    ws = np.array(rec.get('ws') or [rec['hw']] * len(pts)) + out
    gx, gz = np.gradient(pts[:, 0]), np.gradient(pts[:, 1])
    gl = np.hypot(gx, gz) + 1e-9
    lx, lz = -gz / gl * ws, gx / gl * ws
    return np.c_[pts[:, 0] + lx, pts[:, 1] + lz], np.c_[pts[:, 0] - lx, pts[:, 1] - lz], np.array([q[2] for q in rec['pts']]), np.array([q[-1] for q in rec['pts']])


def ribbon_poly(rec, out=0.0):
    L, Rr, _, _ = edge_pts(rec, out)
    return Polygon(np.r_[L, Rr[::-1]]).buffer(0)


def deck_height(rec):
    pts = np.array([q[:2] for q in rec['pts']])
    tree, h = cKDTree(pts), np.array([q[2 + (len(q) - 3) // 2] if len(q) > 4 else q[2] for q in rec['pts']])
    return lambda x, z: h[tree.query(np.stack([np.ravel(x), np.ravel(z)], 1))[1]].reshape(np.shape(x))


def railings(decks):
    """rs: which sides of each station have a railing (1 left, 2 right). None where another deck carries on
    at the same height, or where the ground beside the deck is level with it."""
    polys = [d['_poly'] for d in decks]
    hts = [deck_height(d) for d in decks]
    for k, d in enumerate(decks):
        L, Rr, hl, hr = edge_pts(d, 1.3)
        rs = np.zeros(len(L), int)
        for bit, E, h in ((1, L, hl), (2, Rr, hr)):
            t = terrain(E[:, 0], E[:, 1])
            open_ = np.nan_to_num(h - t, nan=9) > 0.6
            for j, poly in enumerate(polys):
                if j == k:
                    continue
                for i in np.nonzero(open_)[0]:
                    if poly.contains(Point(E[i])) and abs(float(hts[j](E[i, 0], E[i, 1])) - h[i]) < 0.7:
                        open_[i] = False
            rs |= np.where(open_, bit, 0)
        d['rs'] = [int(v) for v in rs]


def piers(decks):
    """Where a long open deck stands on a pier: a wall across under it, clear of every road below."""
    for d in decks:
        if d.get('wall') or d.get('w'):
            continue
        pts = np.array([q[:2] for q in d['pts']])
        cum = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
        if cum[-1] < 34:
            continue
        ws = np.array(d.get('ws') or [d['hw']] * len(pts))
        hc = deck_height(d)
        n = max(1, int(round(cum[-1] / 26)))
        out = []
        for k in range(1, n):
            for shift in (0, 4, -4, 8, -8):
                t = cum[-1] * k / n + shift
                i = int(np.clip(np.searchsorted(cum, t), 1, len(pts) - 1))
                u = (t - cum[i - 1]) / max(cum[i] - cum[i - 1], 1e-6)
                c = pts[i - 1] + (pts[i] - pts[i - 1]) * u
                dv = (pts[i] - pts[i - 1]) / max(cum[i] - cum[i - 1], 1e-6)
                half = ws[i] * 0.8
                line = LineString([c + np.array([-dv[1], dv[0]]) * half, c - np.array([-dv[1], dv[0]]) * half])
                if float(hc(c[0], c[1])) - float(terrain(c[0], c[1])[0]) < 2.6:
                    continue
                if any(road_lines[j].distance(line) < R[j]['w'] / 2 + 1.6 and R[j].get('e') != 1 for j in road_tree.query(line.buffer(12))):
                    continue
                out.append([round(float(c[0]), 1), round(float(c[1]), 1)])
                break
        if out:
            d['pr'] = out


def mark_roads(decks):
    """Road lines that run along a new deck become e: 1 (lane lines are drawn on the deck), cut at its ends."""
    k = 0
    area = unary_union([d['_poly'].buffer(0.5) for d in decks])
    dtree = STRtree([d['_poly'] for d in decks])
    new = []
    for i, r in enumerate(R):
        if r.get('e') or len(r['pts']) < 2:
            new.append(r)
            continue
        ln = road_lines[i]
        if not ln.intersects(area):
            new.append(r)
            continue
        inside = ln.intersection(area)
        parts = [g for g in (inside.geoms if hasattr(inside, 'geoms') else [inside]) if g.geom_type == 'LineString' and g.length > 12]
        # along the deck, not across under it
        keep = []
        for g in parts:
            mid = g.interpolate(0.5, normalized=True)
            a, b = g.interpolate(max(g.length / 2 - 3, 0)), g.interpolate(min(g.length / 2 + 3, g.length))
            v = np.array([b.x - a.x, b.y - a.y]); v /= np.linalg.norm(v) + 1e-9
            for j in dtree.query(mid):
                d = decks[j]
                if not d['_poly'].buffer(0.5).contains(mid):
                    continue
                P = np.array([q[:2] for q in d['pts']])
                q = int(np.argmin(np.hypot(P[:, 0] - mid.x, P[:, 1] - mid.y)))
                t = P[min(q + 1, len(P) - 1)] - P[max(q - 1, 0)]; t /= np.linalg.norm(t) + 1e-9
                if abs(t @ v) > 0.9:
                    keep.append(g)
                    break
        if not keep:
            new.append(r)
            continue
        cuts = sorted(sum([[ln.project(Point(g.coords[0])), ln.project(Point(g.coords[-1]))] for g in keep], []))
        from shapely.ops import substring
        bounds = [0.0] + cuts + [ln.length]
        for a, b in zip(bounds[:-1], bounds[1:]):
            if b - a < 0.3:
                continue
            piece = substring(ln, a, b)
            rr = dict(r, pts=[[round(x, 1), round(z, 1)] for x, z in piece.coords])
            if any(abs(a - min(ln.project(Point(g.coords[0])), ln.project(Point(g.coords[-1])))) < 0.01 for g in keep):
                rr['e'] = 1
                rr['el'] = 1
                k += 1
            new.append(rr)
    vec['roads'] = new
    return k


def repair_under(decks):
    """Under a new open deck the terrain of the game is whatever the old bake left (a bank pushed up to a
    bridge it took for a low one). Where the lidar saw no ground there, the ground is laid between
    the ground it did see on both sides."""
    from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
    changed = {}
    for d in decks:
        if d.get('wall'):
            continue
        poly = d['_poly']
        x0, z0, x1, z1 = poly.buffer(14).bounds
        gx, gz = np.meshgrid(np.arange(np.floor(x0), x1 + 1), np.arange(np.floor(z0), z1 + 1))
        import shapely
        g = lidar('g', gx, gz)
        # ground the lidar saw, but not the abutment faces right under the edge of the deck
        hc = deck_height(d)
        ins1 = shapely.contains_xy(poly.buffer(1.0), gx, gz)
        good = np.isfinite(g) & ~ins1
        if good.sum() < 20:
            continue
        lin = LinearNDInterpolator(np.c_[gx[good], gz[good]], g[good])
        nea = NearestNDInterpolator(np.c_[gx[good], gz[good]], g[good])
        nx0, nz0 = np.ceil((x0 - G0) / 2) * 2 + G0, np.ceil((z0 - G0) / 2) * 2 + G0
        NX, NZ = np.meshgrid(np.arange(nx0, x1, 2.0), np.arange(nz0, z1, 2.0))
        sel = shapely.contains_xy(poly.buffer(1.5), NX, NZ)
        if not sel.any():
            continue
        # not at the two ends, where the bank comes up to the deck under it
        P2 = np.array([q[:2] for q in d['pts']])
        cum = np.r_[0, np.cumsum(np.hypot(*np.diff(P2, axis=0).T))]
        st = cum[cKDTree(P2).query(np.c_[NX[sel], NZ[sel]])[1]]
        inner = (st > 14) & (st < cum[-1] - 14)
        px, pz = NX[sel][inner], NZ[sel][inner]
        if len(px) == 0:
            continue
        v = lin(px, pz)
        v = np.where(np.isfinite(v), v, nea(px, pz))
        v = np.minimum(v, hc(px, pz) - 0.05)
        old = terrain(px, pz)
        for x, z, a, b in zip(px, pz, v, old):
            if not np.isfinite(b) or b - a < 0.25:                 # only ever lowered
                continue
            changed[(float(x), float(z))] = float(a)
    return changed


_surf = {}


def water(x, z):
    """The game's own water (surface class 4) at world points."""
    x, z = np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float))
    out = np.zeros(x.shape, bool)
    sx, sz = np.floor((x - G0) / S).astype(int), np.floor((z - G0) / S).astype(int)
    SN = meta['surface']['n']
    for k in set(zip(sx.ravel().tolist(), sz.ravel().tolist())):
        if k not in _surf:
            p = f'{DATA}/sec/{k[0]}_{k[1]}.kvs'
            if not os.path.exists(p):
                _surf[k] = None
            else:
                b = open(p, 'rb').read()
                b = gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b
                _surf[k] = np.frombuffer(b, 'u1', SN * SN, 32 + HN * HN * 2).reshape(SN, SN)
        g = _surf[k]
        if g is None:
            continue
        m = (sx == k[0]) & (sz == k[1])
        c = np.clip(((x[m] - G0 - k[0] * S) / S * SN).astype(int), 0, SN - 1)
        r = np.clip(((z[m] - G0 - k[1] * S) / S * SN).astype(int), 0, SN - 1)
        out[m] = g[r, c] == 4
    return out


def set_node(x, z, h):
    """Change one node of the terrain cache (a node on a sector edge is in both), so later steps see it."""
    fx, fz = (x - G0) / S, (z - G0) / S
    for sx in {int(np.floor(fx)), int(np.floor(fx - 1e-9))}:
        for sz in {int(np.floor(fz)), int(np.floor(fz - 1e-9))}:
            H = sector(sx, sz)
            c, r = int(round((x - G0 - sx * S) / 2)), int(round((z - G0 - sz * S) / 2))
            if H is not None and 0 <= c < HN and 0 <= r < HN:
                H[r, c] = h


def ground_at(x, z):
    """The ground the laser scan saw, as a 3 x 3 m median (no single kerb or drain): ground class, else
    unclassified, else bridge deck."""
    x, z = np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float))
    out = np.full(x.shape, np.nan)
    for name in ('g', 'u', 'b'):
        v = np.stack([lidar(name, x + i, z + j) for i in (-1, 0, 1) for j in (-1, 0, 1)])
        with np.errstate(all='ignore'):
            m = np.where(np.isfinite(v).sum(0) >= 3, np.nanmedian(v, 0), np.nan)
        out = np.where(np.isfinite(out), out, m)
    return out


def trim_land_ends(decks):
    """The map data often starts a river bridge in the middle of the junction before it (Kroonuaia sild
    at Emajõe), so its deck rose out of the street as a slab with a dark side. The deck is cut back to
    where the laser scan finds the bridge itself (class 17) under its centre line, if it lay on the
    ground anyway over the part cut off; that part of the street, its corners and a few metres round it
    are laid to the ground the scan saw, rising to the end of the deck. Returns the terrain edits."""
    import shapely
    changed = {}
    for d in decks:
        if not d.get('w') or d.get('wall'):
            continue
        pts = d['pts']
        P = np.array([q[:2] for q in pts])
        n = len(P)
        if n < 10:
            continue
        gx, gz = np.gradient(P[:, 0]), np.gradient(P[:, 1])
        gl = np.hypot(gx, gz) + 1e-9
        o = np.array([-1.0, 0.0, 1.0])
        has_b = np.isfinite(lidar('b', P[:, :1] - gz[:, None] / gl[:, None] * o, P[:, 1:] + gx[:, None] / gl[:, None] * o)).sum(1) >= 2
        wet = water(P[:, 0], P[:, 1])
        hc = np.array([q[2 + (len(q) - 3) // 2] for q in pts])
        gnd = ground_at(P[:, 0], P[:, 1])
        a, b = 0, n - 1
        while a < n and not has_b[a] and not wet[a]:
            a += 1
        while b > a and not has_b[b] and not wet[b]:
            b -= 1
        cut = []
        for lo, hi in ((0, a), (b + 1, n)):
            if hi - lo < 1:
                cut.append(False)
                continue
            g = gnd[lo:hi]
            ok = np.isfinite(g)
            cut.append(ok.mean() >= 0.5 and bool((np.abs(g[ok] - hc[lo:hi][ok]) < 0.4).all()))
        a = a if cut[0] else 0
        b = b if cut[1] else n - 1
        if (a == 0 and b == n - 1) or b - a < 6:
            continue
        ws = np.array(d.get('ws') or [d['hw']] * n)
        parts = ([(0, a, a)] if a > 0 else []) + ([(b, n - 1, b)] if b < n - 1 else [])
        print('river bridge cut back to the laser scan: %-22s %d + %d stations, now (%.0f, %.0f) to (%.0f, %.0f)' % (
            d.get('n', ''), a, n - 1 - b, P[a, 0], P[a, 1], P[b, 0], P[b, 1]))
        off_cuts = []
        for lo, hi, end in parts:
            rec = {'pts': pts[lo:hi + 1], 'hw': d['hw'], 'ws': list(ws[lo:hi + 1])}
            off_cuts.append((ribbon_poly(rec), end))
        d['pts'] = pts[a:b + 1]
        if d.get('ws'):
            d['ws'] = d['ws'][a:b + 1]
            d['hw'] = round(float(max(d['ws'])), 2)
        d['_poly'] = ribbon_poly(d)
        for poly, end in off_cuts:
            x0, z0, x1, z1 = poly.buffer(4).bounds
            nx0, nz0 = np.ceil((x0 - G0) / 2) * 2 + G0, np.ceil((z0 - G0) / 2) * 2 + G0
            NX, NZ = np.meshgrid(np.arange(nx0, x1, 2.0), np.arange(nz0, z1, 2.0))
            NX, NZ = NX.ravel(), NZ.ravel()
            # along: metres into the deck from its new end (negative: in the street before it); side: to the left
            j = end + 1 if end == a else end - 1
            ex, ez = P[end]
            tx, tz = P[j] - P[end]
            tl = np.hypot(tx, tz) + 1e-9
            tx, tz = tx / tl, tz / tl
            along = (NX - ex) * tx + (NZ - ez) * tz
            side = -(NX - ex) * tz + (NZ - ez) * tx
            if end != a:                                       # the deck runs the other way: its left is on our right
                side = -side
            half = ws[end]
            under = np.abs(side) < half + 0.3
            sel = shapely.contains_xy(poly.buffer(4), NX, NZ) & ~(under & (along > 2.5))
            NX, NZ, along, side, under = NX[sel], NZ[sel], along[sel], side[sel], under[sel]
            if not len(NX):
                continue
            out = np.array([poly.distance(Point(x, z)) for x, z in zip(NX, NZ)])
            w = 1 - np.clip((out - 0.5) / 3.5, 0, 1) ** 2 * (3 - 2 * np.clip((out - 0.5) / 3.5, 0, 1))
            want = ground_at(NX, NZ)

            def deck_y(k, sd):                                 # deck top at station k, sd metres to its left
                q = pts[k]
                u = np.clip(sd / ws[k], -1, 1)
                return q[3] + (q[2] - q[3]) * np.maximum(u, 0) + (q[4] - q[3]) * np.maximum(-u, 0)
            # the first metres of the deck lie just under the ground, so its end and its sides there are
            # buried and the street runs on onto it without a step; before it, the street rises to it
            top = deck_y(end, np.clip(side, -half, half)) + 0.04
            step = np.hypot(*(P[j] - P[end])) + 1e-9
            on = deck_y(end, side) + (deck_y(j, side) - deck_y(end, side)) * np.clip(along / step, 0, 1) + 0.04
            ramp = under & (along > -4) & (along <= 0) & np.isfinite(want)
            want = np.where(ramp, want + (top - want) * (1 + along / 4), want)
            want = np.where(under & (along > 0), on, want)
            w = np.where(under & (along > -4), 1.0, w)
            old = terrain(NX, NZ)
            for x, z, h, o_, ww in zip(NX, NZ, want, old, w):
                if not (np.isfinite(h) and np.isfinite(o_)):
                    continue
                v = o_ + (h - o_) * ww
                if abs(v - o_) < 0.02:
                    continue
                changed[(float(x), float(z))] = float(v)
                set_node(float(x), float(z), float(v))
    return changed


def fill_ends(decks, changed):
    """A river bridge comes off the bank on an earth ramp. Where the deck still runs over land at its two
    ends, the terrain under it is raised to just below the deck, with a bank falling 1:1 beside it, so that
    the deck does not rise from the road as a bare slab over a slope down to the water; towards the water
    the bank falls 1:1 too. A path that comes
    up onto the deck from the bank climbs the bank at 1:4; a road or path that passes beside or under the
    bridge end stays as it is."""
    import shapely
    beside = [r for r in R if r.get('e') != 1 and len(r['pts']) > 1]
    under = [LineString([p[:2] for p in r['pts']]) for r in beside]
    reach = [r.get('w', 4) / 2 + 1.5 for r in beside]
    tree = STRtree(under)
    n = 0
    for d in decks:
        if not d.get('w') or d.get('wall'):
            continue
        poly = d['_poly']
        P2 = np.array([q[:2] for q in d['pts']])
        cum = np.r_[0, np.cumsum(np.hypot(*np.diff(P2, axis=0).T))]
        wet = water(P2[:, 0], P2[:, 1])
        if not wet.any():
            continue
        first, last = np.argmax(wet), len(wet) - 1 - np.argmax(wet[::-1])
        lo, hi = min(cum[first] - 2, 30), max(cum[last] + 2, cum[-1] - 30)   # the land ends, 30 m at most
        hc = deck_height(d)
        end_of = lambda x, z: (lambda s: (s <= lo) | (s >= hi))(cum[cKDTree(P2).query(np.c_[np.ravel(x), np.ravel(z)])[1]])
        # paths that come up onto a land end of the deck
        joins = set()
        for i, r in enumerate(beside):
            if r['type'] not in ('Kergliiklustee', 'Rada'):
                continue
            ends = [p[:2] for p in (r['pts'][0], r['pts'][-1]) if poly.buffer(0.5).contains(Point(p[:2]))]
            if not ends or not end_of(*np.array(ends).T).all():
                continue
            joins.add(i)
        x0, z0, x1, z1 = poly.buffer(14).bounds
        nx0, nz0 = np.ceil((x0 - G0) / 2) * 2 + G0, np.ceil((z0 - G0) / 2) * 2 + G0
        NX, NZ = np.meshgrid(np.arange(nx0, x1, 2.0), np.arange(nz0, z1, 2.0))
        NX, NZ = NX.ravel(), NZ.ravel()
        st = cum[cKDTree(P2).query(np.c_[NX, NZ])[1]]
        beyond = np.maximum(0, np.minimum(st - lo, hi - st))   # how far past a land end, towards the water
        near = shapely.contains_xy(poly.buffer(14), NX, NZ) & (beyond < 14)
        NX, NZ, beyond = NX[near], NZ[near], beyond[near]
        out = np.array([poly.exterior.distance(Point(x, z)) for x, z in zip(NX, NZ)]) * ~shapely.contains_xy(poly, NX, NZ)
        out = np.maximum(out, beyond)                          # the bank falls away beside the deck and in front of it
        top = hc(NX, NZ) - 0.12
        old = terrain(NX, NZ)
        # metres to the water's edge, on a 1 m grid: the bank comes down to the water at 1:1.5 at most
        WX, WZ = np.meshgrid(np.arange(x0 - 20, x1 + 21), np.arange(z0 - 20, z1 + 21))
        dw = ndimage.distance_transform_edt(~water(WX.ravel(), WZ.ravel()).reshape(WX.shape))
        dw = dw[np.clip(np.round(NZ - (z0 - 20)).astype(int), 0, WX.shape[0] - 1), np.clip(np.round(NX - (x0 - 20)).astype(int), 0, WX.shape[1] - 1)]
        for x, z, t, o, w, e in zip(NX, NZ, top, old, dw, out):
            k = (float(x), float(z))
            # on a second run the bank of the first is already in the terrain, and repair_under has just
            # taken it down again where it runs under the deck: from that ground, the bank goes back up
            o = min(o, changed.get(k, o))
            if w < 1.5 or not np.isfinite(o):
                continue
            hits = [i for i in tree.query(Point(x, z).buffer(8)) if under[i].distance(Point(x, z)) < reach[i]]
            lip = e == 0 and t - o < 1.0                       # under the deck, too low for anything to pass
            if any(i not in joins for i in hits) and not lip:
                continue                                       # a road or path past or under the bridge end
            t = t - (e * 0.25 if hits else e)                  # the bank 1:1, a path on it 1:4
            t = min(t, o + (w - 1.5) / 1.5)
            if t - o < 0.1 and k not in changed:
                continue
            changed[k] = max(changed.get(k, -1e9), float(t))
            n += 1
    return n


def write_heights(changed):
    """Write node heights into the sector files (a node on a sector edge is in both)."""
    per = {}
    for (x, z), h in changed.items():
        fx, fz = (x - G0) / S, (z - G0) / S
        for sx in {int(np.floor(fx)), int(np.floor(fx - 1e-9))}:
            for sz in {int(np.floor(fz)), int(np.floor(fz - 1e-9))}:
                c, r = int(round((x - G0 - sx * S) / 2)), int(round((z - G0 - sz * S) / 2))
                if 0 <= c < HN and 0 <= r < HN:
                    per.setdefault((sx, sz), []).append((r, c, h))
    for (sx, sz), lst in per.items():
        p = f'{DATA}/sec/{sx}_{sz}.kvs'
        if not os.path.exists(p):
            continue
        raw = open(p, 'rb').read()
        b = bytearray(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
        H = np.frombuffer(b, '<u2', HN * HN, 32).reshape(HN, HN)
        for r, c, h in lst:
            H[r, c] = int(np.clip(round((h - meta['height']['offset']) / meta['height']['scale']), 0, 65535))
        open(p, 'wb').write(gzip.compress(bytes(b), 6))
    return sorted(per)


def lay_lids():
    """Tunnel lids, laid again. terrain.py only put a lid where the trench under it had full headroom, so
    the sloping ends of a trench stayed open across the edge of the road above (a ditch up to 2 m deep in
    the slip roads of the Riia roundabout), and its lids stand proud of roads that were levelled later.
    Now there is a lid wherever a tunnel runs under a road or path, and where there was one before; each
    is a straight line across, between the terrain at its two edges (the trench is only in its middle)."""
    old = [d for d in vec['decks'] if d['k'] == 0]
    old_u = unary_union([ribbon_poly(d) for d in old]) if old else Polygon()
    tun = [(i, r) for i, r in enumerate(R) if r.get('e') == -1 and len(r['pts']) > 1]
    if not tun:
        return 0
    merged = linemerge([road_lines[i] for i, _ in tun])
    lids = []
    for ch in (merged.geoms if hasattr(merged, 'geoms') else [merged]):
        if ch.length < 4:
            continue
        w = max((r['w'] for i, r in tun if road_lines[i].distance(ch) < 0.01), default=4.6)
        half = (w + 1.0) / 2 + 5.2
        n = int(ch.length) + 1
        P = np.array([ch.interpolate(t).coords[0] for t in np.linspace(0, ch.length, n)])
        over = []
        for j in road_tree.query(ch.buffer(20)):
            r = R[j]
            if r.get('e') == -1:
                continue
            over.append(road_lines[j].buffer(r['w'] / 2 + (1.5 if r['type'] not in ('Kergliiklustee', 'Rada') else 0.3)))
        over_u = unary_union(over + [old_u]) if over else old_u
        import shapely
        need = shapely.contains_xy(over_u, P[:, 0], P[:, 1])
        need = ndimage.binary_dilation(need, iterations=1)
        gx, gz = np.gradient(P[:, 0]), np.gradient(P[:, 1])
        gl = np.hypot(gx, gz) + 1e-9
        lx, lz = -gz / gl * half, gx / gl * half
        tl, tr = terrain(P[:, 0] + lx, P[:, 1] + lz), terrain(P[:, 0] - lx, P[:, 1] - lz)
        tc = terrain(P[:, 0], P[:, 1])
        need &= np.isfinite(tl) & np.isfinite(tr)
        # an edge that is itself in a trench or down a bank would sink the lid: take the higher edge for both
        low = np.abs(tl - tr) > 1.2
        tl, tr = np.where(low, np.maximum(tl, tr), tl), np.where(low, np.maximum(tl, tr), tr)
        for m in runs(need):
            if len(m) < 3:
                continue
            keep = sorted(set(range(0, len(m), 2)) | {len(m) - 1})
            ys = tl[m][:, None] + (tr[m] - tl[m])[:, None] * np.linspace(0, 1, 9)[None, :]
            lids.append({'k': 0, 'hw': round(float(half), 2),
                         'pts': [[round(float(P[m[i], 0]), 2), round(float(P[m[i], 1]), 2)] + [round(float(v), 2) for v in ys[i]] for i in keep]})
    vec['decks'] = [d for d in vec['decks'] if d['k'] != 0] + lids
    return len(lids), len(old)


def main():
    # start from the map as it was before an earlier run of this tool
    for r in R:
        if r.pop('el', None):
            r.pop('e', None)
    # (a bridge over water takes its name and look from the deck it replaces, which on a second run is
    # the one this tool made the first time)
    olds = [(LineString([p[:2] for p in d['pts']]), d) for d in vec['decks'] if d['k'] == 1]
    rerun = any(d.get('src') == 'lidar' for d in vec['decks'])
    vec['decks'] = [d for d in vec['decks'] if d.get('src') != 'lidar']
    decks, log = [], []
    chs = list(chains())
    car = [c for c in chs if c['type'] not in ('Kergliiklustee', 'Rada')]
    for c in car:
        a, b = int(max(c['core'][0], 0)), int(min(c['core'][1], len(c['pts']) - 1))
        oth = [o['pts'][int(max(o['core'][0], 0)):int(min(o['core'][1], len(o['pts']) - 1)) + 1] for o in car if o is not c]
        # stations of the other carriageways, but not where they are this same road carrying on
        own = cKDTree(c['pts'])
        oth = [q[own.query(q)[0] > 2.5] for q in oth]
        oth = np.concatenate(oth) if oth else np.zeros((0, 2))
        c['others'] = cKDTree(oth) if len(oth) else None
    for ch in chs:
        parts, dbg = build(ch)
        for d in parts:
            mid = len(d['x']) // 2
            if covered(d['x'][mid], d['z'][mid], d['h'][mid, 1]):
                continue
            rec = ribbon(d, ch['name'] if ch['type'] not in ('Kergliiklustee', 'Rada') else '')
            rec['src'] = 'lidar'
            poly = ribbon_poly(rec)
            if poly.is_empty or poly.area < 20:
                continue
            made.append((poly, cKDTree(np.array([p[:2] for p in rec['pts']])), np.array([p[3] for p in rec['pts']])))
            rec['_poly'], rec['_kind'], rec['_type'] = poly, d['kind'], ch['type']
            if d['kind'] == 'bridge':                              # a bridge over water keeps its name and its look
                best = max(olds, key=lambda o: o[0].intersection(poly).length, default=None)
                if best and best[1].get('w') and best[0].intersection(poly).length > 8:
                    rec['w'] = 1
                    rec['n'] = best[1].get('n', '')
                    rec['b'] = best[1].get('b', 'girder')
            decks.append(rec)
            log.append('%-6s %-34s %-14s (%6.0f,%6.0f)-(%6.0f,%6.0f) len %4d  hw %4.1f-%4.1f  y %5.1f..%5.1f  clear %4.1f..%4.1f' % (
                d['kind'], ch['name'][:34], ch['type'], d['x'][0], d['z'][0], d['x'][-1], d['z'][-1], len(d['x']), d['hw'].min(), d['hw'].max(),
                d['h'][:, 1].min(), d['h'][:, 1].max(), d['clear'].min(), d['clear'].max()))
    print('\n'.join(log))
    trimmed = trim_land_ends(decks)
    # the old dry-land spans that a new deck replaces
    area = unary_union([d['_poly'] for d in decks]) if decks else Polygon()
    kept = []
    for d in vec['decks']:
        if d['k'] == 1:
            ln = LineString([p[:2] for p in d['pts']])
            if ln.intersection(area).length > min(0.4 * ln.length, 20):
                continue
            print('old span kept (no lidar bridge there):', d.get('n', ''), d['pts'][0][:2], d['pts'][-1][:2])
        kept.append(d)
    railings(decks)
    piers(decks)
    marked = mark_roads(decks)
    changed = repair_under(decks)
    changed.update({k: v for k, v in trimmed.items() if k not in changed})
    print('terrain nodes laid to the scanned ground where river bridges were cut back:', len(trimmed))
    print('terrain nodes raised under river bridge ends:', fill_ends(decks, changed))
    print('made-up slopes down from a bridge end (x, z, drop):', landings)
    print(len(decks), 'new decks;', len(vec['decks']) - len(kept), 'old spans replaced;', marked, 'road pieces marked;', len(changed), 'terrain nodes repaired')
    vec['decks'] = kept + [{k: v for k, v in d.items() if not k.startswith('_')} for d in decks]
    if rerun:                                                  # the lids were laid on the first run
        print('tunnel lids kept as they are')
    else:
        print('tunnel lids laid (new, old):', lay_lids())
    if WRITE:
        secs = write_heights(changed)
        json.dump(vec, open(f'{DATA}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
        print('written; sectors changed:', ' '.join(f'{a}_{b}' for a, b in secs))
    return decks


if __name__ == '__main__':
    main()
