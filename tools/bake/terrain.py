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
from shapely.geometry import LineString, box, mapping, shape
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

    Over water a bridge becomes a causeway in the height field (hN is raised). Over dry land it
    becomes a deck and the ground below is left alone. A tunnel is cut through its embankment as an
    open trench, with a deck over it wherever there is headroom, carrying whatever crosses above.

    Returns (decks, bridge_cells); hN is changed in place.
    """
    bridge_cells = np.zeros((H1 + 1, W1 + 1), bool)
    decks = []

    def chains(level):
        segs, widths = [], []
        for p, g in roads:
            if road_level(p) == level:
                for part in flat(g):
                    segs.append(part); widths.append(road_width(p))
        if not segs:
            return
        tree = STRtree(segs)
        merged = linemerge(segs)
        for ch in (list(merged.geoms) if hasattr(merged, 'geoms') else [merged]):
            if ch.length < 4:
                continue
            w = max(widths[i] for i in tree.query(ch) if segs[i].distance(ch) < 0.01) + 1.0
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
        p = sample(hG, px, pz).astype('float64')
        inwater = sample(wm, px, pz)
        # water: fill the widest gaps to the level of the banks
        c = ndimage.grey_closing(p, size=min(n, 260), mode='nearest')
        fill = np.zeros(n, bool)
        for m in _runs(c - p > 1.2):
            if inwater[m].any():
                fill[m] = True
        fill = ndimage.binary_dilation(fill, iterations=3)
        target = c.copy()
        # dry land: a span is a dip shorter than a long bridge, between the two abutments. The road
        # is followed a little past both ends of the bridge, where the abutments often are.
        E = 15
        ex = np.concatenate([px[0] + (px[0] - px[min(3, n - 1)]) / min(3, n - 1) * np.arange(E, 0, -1), px,
                             px[-1] + (px[-1] - px[-min(4, n)]) / min(3, n - 1) * np.arange(1, E + 1)])
        ez = np.concatenate([pz[0] + (pz[0] - pz[min(3, n - 1)]) / min(3, n - 1) * np.arange(E, 0, -1), pz,
                             pz[-1] + (pz[-1] - pz[-min(4, n)]) / min(3, n - 1) * np.arange(1, E + 1)])
        q = sample(hG, ex, ez).astype('float64')
        ne = len(q)
        taken = np.concatenate([np.zeros(E, bool), fill, np.zeros(E, bool)])
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
    print(' bridge chains', n_bridge, 'tunnel chains', n_tunnel, 'decks', len(decks), 'causeway cells', int(bridge_cells.sum()))
    return decks, bridge_cells
