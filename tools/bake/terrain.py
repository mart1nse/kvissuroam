"""Terrain heights shared by bake.py and reheight.py: the 1 m terrain model, water beds, bridge
decks over water, tunnel cuts, and the "decks" that carry a road over another level.

The map is one height field plus decks. A deck is a ribbon (stations along a centre line, each with a
left and a right height) that lies above the height field: the span of an overpass, or the lid over a
tunnel that is cut into an embankment. The game drives on a deck when the car is level with it and
on the height field below it otherwise.
"""
import glob
import json

import numpy as np
import rasterio
import rasterio.features
import rasterio.windows
from rasterio.transform import from_origin
from scipy import ndimage
from scipy.spatial import cKDTree
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import linemerge, unary_union
from shapely.strtree import STRtree

from config import *  # noqa

X0, Z0, X1, Z1 = detail_rect()
W1, H1 = int(X1 - X0), int(Z1 - Z0)
CLEAR = 2.3            # a deck needs at least this much room under it (m)
etak = {}


def setup(src):
    etak.update(json.load(open(f'{src}/etak_bbox.json')))


def wbox(x0, z0, x1, z1):
    """World-space rectangle as an L-EST97 polygon."""
    return box(E0 + x0, N0 - z1, E0 + x1, N0 - z0)


detail_box = wbox(X0, Z0, X1, Z1)


def feats(layer, clip=None):
    out = []
    for f in etak.get(layer, []):
        g = shape(f['g'])
        if not g.is_valid:
            g = g.buffer(0)
        if g.is_empty or (clip is not None and not g.intersects(clip)):
            continue
        out.append((f['p'], g))
    return out


def rast(shapes, x0, z0, nx, nz, res, all_touched=False):
    """Rasterise L-EST97 shapes; out[r, c] is the cell at x0 + c*res, z0 + r*res."""
    shapes = [(mapping(g), 1) for g in shapes if not g.is_empty]
    if not shapes:
        return np.zeros((nz, nx), 'uint8')
    return rasterio.features.rasterize(shapes, out_shape=(nz, nx), transform=from_origin(E0 + x0, N0 - z0, res, res),
                                       fill=0, dtype='uint8', all_touched=all_touched)


def road_width(p):
    w = float(p.get('laius') or 0)
    return (w if w > 0 else 1.2) + 0.6               # kerb / shoulder


def flat(g):
    return [LineString([(x, y) for x, y, *_ in part.coords]) for part in (g.geoms if hasattr(g, 'geoms') else [g])]


def road_level(p):
    """1 for a road on a bridge, -1 for one in a tunnel, 0 otherwise."""
    a, l = int(p.get('a_tasand') or 0), int(p.get('l_tasand') or 0)
    return 1 if max(a, l) > 0 else -1 if min(a, l) < 0 else 0


def mark_water_crossings(roads, river_u):
    """ETAK has some bridges at ground level (Kaarsild): a road that runs over the river is a bridge."""
    k = 0
    for p, g in roads:
        if road_level(p) == 0 and g.intersects(river_u) and g.intersection(river_u).length > 30:
            p['a_tasand'] = p['l_tasand'] = 1
            k += 1
    return k


def merge_twin_decks(decks):
    """Two carriageways of one bridge over water (Sõpruse sild, Kaarsild) become one wide deck."""
    out, used = [], set()
    wd = [i for i, d in enumerate(decks) if d.get('w')]
    for i in wd:
        if i in used:
            continue
        a = decks[i]
        A = np.array(a['pts'])
        for j in wd:
            if j <= i or j in used:
                continue
            b = decks[j]
            lb = LineString([p[:2] for p in b['pts']])
            la = LineString([p[:2] for p in a['pts']])
            near = np.array([lb.project(Point(p[:2])) for p in a['pts']])
            q = np.array([lb.interpolate(t).coords[0] for t in near])
            dist = np.hypot(A[:, 0] - q[:, 0], A[:, 1] - q[:, 1])
            sep = float(np.median(dist))
            if sep > a['hw'] + b['hw'] + 3 or not 0.6 < lb.length / la.length < 1.6:
                continue
            sb = np.array([lb.project(Point(p[:2])) for p in b['pts']])
            if sb[0] > sb[-1]:
                sb = sb[::-1]
            yb = np.interp(near, sb, np.array(sorted(zip([lb.project(Point(p[:2])) for p in b['pts']], [p[2] for p in b['pts']])))[:, 1])
            ok = dist < sep + 2
            mid = np.where(ok[:, None], (A[:, :2] + q) / 2, np.nan)
            off = np.nanmedian(mid - A[:, :2], 0)                    # past the end of the twin: keep the offset
            mid = np.where(ok[:, None], mid, A[:, :2] + off)
            y = np.where(ok, np.maximum(A[:, 2], yb), A[:, 2])
            a = dict(a, hw=round(sep / 2 + max(a['hw'], b['hw']), 2),
                     pts=[[round(float(m[0]), 2), round(float(m[1]), 2), round(float(v), 2), round(float(v), 2)] for m, v in zip(mid, y)])
            A = np.array(a['pts'])
            used.add(j)
        decks[i] = a
    return [d for k, d in enumerate(decks) if k not in used]


def load_dtm(src):
    """1 m terrain model over the coarse rectangle, and the node heights of the detail rectangle."""
    cw, chh = int(CX1 - CX0), int(CZ1 - CZ0)
    D = np.full((chh, cw), np.nan, 'float32')
    for path in sorted(glob.glob(f'{src}/dtm_*.tif')):
        with rasterio.open(path) as ds:
            b = ds.bounds
            xa, xb = max(E0 + CX0, b.left), min(E0 + CX1, b.right)
            ya, yb = max(N0 - CZ1, b.bottom), min(N0 - CZ0, b.top)
            if xa >= xb or ya >= yb:
                continue
            a = ds.read(1, window=rasterio.windows.from_bounds(xa, ya, xb, yb, ds.transform)).astype('float32')
            a[a < -100] = np.nan
            c0, r0 = int(round(xa - (E0 + CX0))), int(round((N0 - CZ0) - yb))
            D[r0:r0 + a.shape[0], c0:c0 + a.shape[1]] = a
    # sheets do not cover the far west/south of the scenery rectangle: extend the edges
    cols = np.nonzero(~np.isnan(D).all(0))[0]
    rows = np.nonzero(~np.isnan(D).all(1))[0]
    D[:, :cols[0]] = D[:, cols[0]:cols[0] + 1]
    D[:, cols[-1] + 1:] = D[:, cols[-1]:cols[-1] + 1]
    D[:rows[0]] = D[rows[0]]
    D[rows[-1] + 1:] = D[rows[-1]]
    if np.isnan(D).any():
        D[np.isnan(D)] = np.nanmedian(D)
    # node heights of the detail rectangle: integer metres, mean of the 4 surrounding pixels
    ox, oz = int(X0 - CX0), int(Z0 - CZ0)
    hN = (D[oz - 1:oz + H1, ox - 1:ox + W1] + D[oz:oz + H1 + 1, ox - 1:ox + W1]
          + D[oz - 1:oz + H1, ox:ox + W1 + 1] + D[oz:oz + H1 + 1, ox:ox + W1 + 1]) / 4.0
    assert hN.shape == (H1 + 1, W1 + 1)
    return D, hN


def sample(a, xs, zs):
    """Nearest node of a detail-rectangle grid."""
    r = np.clip(np.round(np.asarray(zs) - Z0).astype(int), 0, H1)
    c = np.clip(np.round(np.asarray(xs) - X0).astype(int), 0, W1)
    return a[r, c]


def bilinear(a, xs, zs):
    fx = np.clip(np.asarray(xs) - X0, 0, W1 - 1e-3)
    fz = np.clip(np.asarray(zs) - Z0, 0, H1 - 1e-3)
    c, r = fx.astype(int), fz.astype(int)
    fx, fz = fx - c, fz - r
    return (a[r, c] * (1 - fx) + a[r, c + 1] * fx) * (1 - fz) + (a[r + 1, c] * (1 - fx) + a[r + 1, c + 1] * fx) * fz


def water(hN):
    """Dig the water beds: the Emajõgi at one level, everything else at its own level."""
    streams = feats('E_203_vooluveekogu_a')
    ponds = feats('E_202_seisuveekogu_a', detail_box)
    main = [g for p, g in streams if 'Emaj' in (p.get('nimetus') or '')]
    if not main:
        main = [max((g for p, g in streams), key=lambda g: g.area)]
    river_u = unary_union(main)
    others = [g for p, g in streams if g.intersects(detail_box) and not g.intersects(river_u.buffer(-1))] + [g for p, g in ponds]
    others = [g for g in others if g.area > 12]
    other_u = unary_union(others)
    rv = rast([river_u], X0 - 0.5, Z0 - 0.5, W1 + 1, H1 + 1, 1.0)
    ot = rast([other_u], X0 - 0.5, Z0 - 0.5, W1 + 1, H1 + 1, 1.0)
    ot[rv > 0] = 0
    river_level = float(np.median(hN[rv > 0]))
    wm = (rv > 0) | (ot > 0)
    dist = ndimage.distance_transform_edt(wm).astype('float32')
    depth = np.where(rv > 0, np.minimum(4.0, 0.45 * dist), np.minimum(1.2, 0.35 * dist))
    return np.where(wm, hN - depth, hN).astype('float32'), wm, river_u, others, river_level


def _runs(mask):
    lab, k = ndimage.label(mask)
    return [np.nonzero(lab == i)[0] for i in range(1, k + 1)]


def _ribbon(kind, px, pz, idx, half, ys, rail=None):
    """Deck record: stations [x, z, heights from the left edge to the right edge]; ys is (stations,
    samples), evenly spaced across the width, and left is the side of (-dz, dx)."""
    step = 2
    keep = list(range(0, len(idx), step))
    if keep[-1] != len(idx) - 1:
        keep.append(len(idx) - 1)
    d = {'k': kind, 'hw': round(float(half), 2),
         'pts': [[round(float(px[idx[j]]), 2), round(float(pz[idx[j]]), 2)] + [round(float(v) - H0, 2) for v in ys[j]] for j in keep]}
    if rail is not None:
        on = [n for n, j in enumerate(keep) if rail[j]]
        if on:
            d['rail'] = [on[0], on[-1]]
    return d


def crossings(hN, hG, wm, roads):
    """Bridges and tunnels. The terrain model has bridges removed and tunnels filled in.

    A bridge becomes a deck, over water (marked w: 1) as over dry land, and the ground or the river
    bed below is left alone. Only a dip too low to drive under is levelled in the height field. A tunnel is cut through its embankment as an
    open trench, with a deck over it wherever there is headroom, carrying whatever crosses above.

    Returns (decks, bridge_cells); hN is changed in place.
    """
    bridge_cells = np.zeros((H1 + 1, W1 + 1), bool)
    decks = []

    cur = {'name': ''}
    parts = [part for p, g in roads for part in flat(g)]
    ptree = STRtree(parts)

    def follow(ch, dist):
        """World points (x, z) every metre along the roads that continue a chain, before and after it."""
        def walk(pt, prev):
            cur_, d0, got, seen, out = np.array(pt), np.array(pt) - np.array(prev), 0.0, set(), [np.array(pt)]
            d0 = d0 / (np.linalg.norm(d0) + 1e-9)
            while got < dist:
                best = None
                for i in ptree.query(Point(cur_).buffer(0.3)):
                    c = np.array(parts[i].coords)
                    for arr in (c, c[::-1]):
                        if i not in seen and len(arr) > 1 and np.hypot(*(arr[0] - cur_)) < 0.3:
                            d = arr[min(len(arr) - 1, 2)] - arr[0]
                            d = d / (np.linalg.norm(d) + 1e-9)
                            if best is None or d @ d0 > best[0]:
                                best = (d @ d0, i, arr)
                if best is None or best[0] < 0.75:
                    break
                seen.add(best[1]); out += list(best[2][1:]); got += parts[best[1]].length
                d0 = best[2][-1] - best[2][-2]; d0 = d0 / (np.linalg.norm(d0) + 1e-9); cur_ = best[2][-1]
            if len(out) < 2:
                return np.zeros((0, 2))
            ln = LineString(out)
            pts = np.array([ln.interpolate(t).coords[0] for t in np.arange(1.0, min(ln.length, dist), 1.0)]).reshape(-1, 2)
            return np.stack([pts[:, 0] - E0, N0 - pts[:, 1]], 1)
        c = list(ch.coords)
        return walk(c[0], c[1])[::-1], walk(c[-1], c[-2])

    def chains(level):
        segs, widths, names = [], [], []
        for p, g in roads:
            if road_level(p) == level:
                for part in flat(g):
                    segs.append(part); widths.append(road_width(p)); names.append(p.get('nimetus') or '')
        if not segs:
            return
        tree = STRtree(segs)
        merged = linemerge(segs)
        for ch in (list(merged.geoms) if hasattr(merged, 'geoms') else [merged]):
            if ch.length < 4:
                continue
            on = [i for i in tree.query(ch) if segs[i].distance(ch) < 0.01]
            w = max(widths[i] for i in on) + 1.0
            cur['name'] = max((names[i] for i in on), key=len)
            n = int(ch.length) + 1
            pts = np.array([ch.interpolate(d).coords[0] for d in np.linspace(0, ch.length, n)])
            yield ch, w, n, pts[:, 0] - E0, N0 - pts[:, 1]

    def stamp(ch, w, px, pz, sel, target, raise_):
        """Write target heights into the corridor cells whose nearest station is selected."""
        cor = ch.buffer(w / 2, cap_style=2)
        minx, miny, maxx, maxy = cor.bounds
        c0, c1 = int(minx - E0 - X0) - 1, int(maxx - E0 - X0) + 2
        r0, r1 = int(N0 - maxy - Z0) - 1, int(N0 - miny - Z0) + 2
        c0, r0, c1, r1 = max(c0, 0), max(r0, 0), min(c1, W1 + 1), min(r1, H1 + 1)
        if c1 <= c0 or r1 <= r0:
            return
        m = rast([cor], X0 + c0 - 0.5, Z0 + r0 - 0.5, c1 - c0, r1 - r0, 1.0, all_touched=True) > 0
        rr, cc = np.nonzero(m)
        _, idx = cKDTree(np.stack([px, pz], 1)).query(np.stack([X0 + c0 + cc, Z0 + r0 + rr], 1))
        s = sel[idx]
        sub = hN[r0:r1, c0:c1]
        if raise_:
            sub[rr[s], cc[s]] = np.maximum(sub[rr[s], cc[s]], target[idx[s]])
            bridge_cells[r0 + rr[s], c0 + cc[s]] = True
        else:
            sub[rr[s], cc[s]] = np.minimum(sub[rr[s], cc[s]], target[idx[s]])

    def normals(px, pz):
        dx, dz = np.gradient(px), np.gradient(pz)
        l = np.hypot(dx, dz) + 1e-9
        return -dz / l, dx / l

    n_bridge = n_tunnel = 0
    for ch, w, n, px, pz in chains(1):
        n_bridge += 1
        fill = np.zeros(n, bool)
        target = sample(hG, px, pz).astype('float64')
        # The road is followed a little past both ends of the bridge, where the abutments often are.
        E = 15
        ex = np.concatenate([px[0] + (px[0] - px[min(3, n - 1)]) / min(3, n - 1) * np.arange(E, 0, -1), px,
                             px[-1] + (px[-1] - px[-min(4, n)]) / min(3, n - 1) * np.arange(1, E + 1)])
        ez = np.concatenate([pz[0] + (pz[0] - pz[min(3, n - 1)]) / min(3, n - 1) * np.arange(E, 0, -1), pz,
                             pz[-1] + (pz[-1] - pz[-min(4, n)]) / min(3, n - 1) * np.arange(1, E + 1)])
        q = sample(hG, ex, ez).astype('float64')
        ne = len(q)
        taken = np.zeros(ne, bool)
        # water: a span from bank to bank over the widest gaps, slightly humped like the real ones.
        # The bed under it stays as water() dug it, so the river runs through.
        if sample(wm, px, pz).any():
            # The real bridge can be longer than the stretch ETAK marks: follow the road on both
            # sides, and where the ground climbs an abutment face, the span runs up to its top.
            pre, post = follow(ch, 400)
            fx = np.concatenate([pre[:, 0], px, post[:, 0]]); fz = np.concatenate([pre[:, 1], pz, post[:, 1]])
            fq = sample(hG, fx, fz).astype('float64')
            fw = sample(wm, fx, fz)
            Ea, nf = len(pre), len(fq)
            lo, hi = max(Ea - E, 0), min(Ea + n + E, nf)
            cw = np.zeros(nf); cw[lo:hi] = ndimage.grey_closing(fq[lo:hi], size=hi - lo, mode='nearest') - fq[lo:hi]
            for m in _runs(cw > 1.2):
                if not fw[m].any():
                    continue
                a, b = m[0], m[-1]
                while a > 0 and (cw[a - 1] > 0.15 or fw[a - 1]):
                    a -= 1
                while b < nf - 1 and (cw[b + 1] > 0.15 or fw[b + 1]):
                    b += 1
                a, b = max(a - 2, 0), min(b + 2, nf - 1)
                for i in range(a, 6, -1):                # abutment face on the near side
                    if fq[i - 6] - fq[i] > 2.5 and fq[i - 6] > fq[a] + 3:
                        a = i - 6
                        k = 0
                        while a > 0 and fq[a - 1] > fq[a] + 0.1 and k < 15:
                            a -= 1; k += 1
                        break
                for i in range(b, nf - 6):               # and on the far side
                    if fq[i + 6] - fq[i] > 2.5 and fq[i + 6] > fq[b] + 3:
                        b = i + 6
                        k = 0
                        while b < nf - 1 and fq[b + 1] > fq[b] + 0.1 and k < 15:
                            b += 1; k += 1
                        break
                idx = np.arange(a, b + 1)
                t = (idx - a) / max(b - a, 1)
                y = np.interp(idx, [a, b], [fq[a], fq[b]]) + 4 * min(1.2, 0.007 * (b - a)) * t * (1 - t)
                y = np.maximum(y, fq[idx])
                ta, tb = a - Ea + E, b - Ea + E          # the same stretch on the short profile
                taken[max(ta, 0):max(tb + 1, 0)] = True
                d = _ribbon(1, fx, fz, idx, w / 2, np.stack([y, y], 1), rail=(y - fq[idx] > 0.7) | fw[idx])
                d['w'] = 1                               # over water
                if cur['name']:
                    d['n'] = cur['name']
                decks.append(d)
        # dry land: a span is a dip shorter than a long bridge, between the two abutments.
        c2 = ndimage.grey_closing(q, size=min(ne, 121), mode='nearest')
        for m in _runs((c2 - q > 1.2) & ~taken):
            if m[-1] < E or m[0] >= E + n:
                continue
            a, b = m[0], m[-1]
            while a > 0 and c2[a - 1] - q[a - 1] > 0.15 and not taken[a - 1]:
                a -= 1
            while b < ne - 1 and c2[b + 1] - q[b + 1] > 0.15 and not taken[b + 1]:
                b += 1
            # up the face of the higher abutment to where the road levels out
            k = 0
            while a > 0 and q[max(a - 3, 0):a].max() > q[a] + 0.15 and not taken[a - 1] and k < E:
                a -= 1; k += 1
            k = 0
            while b < ne - 1 and q[b + 1:b + 4].max() > q[b] + 0.15 and not taken[b + 1] and k < E:
                b += 1; k += 1
            a, b = max(a - 1, 0), min(b + 1, ne - 1)
            idx = np.arange(a, b + 1)
            y = np.maximum(np.interp(idx, [a, b], [q[a], q[b]]), q[idx])
            if (y - q[idx]).max() < CLEAR:               # too low to drive under: just level it
                lo, hi = max(a - E, 0), min(b - E, n - 1)
                if hi >= lo:
                    fill[lo:hi + 1] = True
                    target[lo:hi + 1] = y[lo + E - a:hi + E - a + 1]
                continue
            decks.append(_ribbon(1, ex, ez, idx, w / 2, np.stack([y, y], 1), rail=y - q[idx] > 0.7))
        if fill.any():
            stamp(ch, w, px, pz, fill, target, True)

    for ch, w, n, px, pz in chains(-1):
        n_tunnel += 1
        p = sample(hG, px, pz).astype('float64')
        o = ndimage.grey_opening(p, size=min(n, 120), mode='nearest')
        cut = ndimage.binary_dilation(p - o > 1.0, iterations=4)
        if not cut.any():
            continue
        floor = ndimage.uniform_filter1d(np.where(cut, o, p), 9, mode='nearest')
        stamp(ch, w, px, pz, cut, floor, False)
        nx, nz = normals(px, pz)
        half = w / 2 + 5.2                               # past the trench walls, also on the 4 m grid of low quality
        core = p - floor >= CLEAR
        lat = np.linspace(half, -half, 9)
        for m in _runs(cut & ndimage.binary_dilation(p - o > 1.0)):
            if core[m].sum() < 3:
                continue
            # the lid is the ground as the terrain model has it, and never lower than a straight
            # line between the two rims of the cut, so it sits flush with what crosses above
            ys = np.stack([bilinear(hG, px[m] + nx[m] * t, pz[m] + nz[m] * t) for t in lat], 1)
            line = ys[:, :1] + (ys[:, -1:] - ys[:, :1]) * np.linspace(0, 1, len(lat))[None, :]
            ys[:, 1:-1] = np.maximum(ys[:, 1:-1], line[:, 1:-1]) + 0.04
            decks.append(_ribbon(0, px, pz, m, half, ys))
    decks = merge_twin_decks(decks)
    print(' bridge chains', n_bridge, 'tunnel chains', n_tunnel, 'decks', len(decks), 'causeway cells', int(bridge_cells.sum()))
    return decks, bridge_cells
