"""Roads, paved areas, walls and obstacles shared by bake.py and resurface.py.

Road lines carry what the game needs to draw a street as what it is: the ETAK surface type
(s: 1 stone, 2 gravel, 3 dirt, 4 wood; asphalt when absent) and c, the colour of the road in the
aerial photo, so that tarmac has the shade it really has (fresh and dark, or old and pale).
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import Point

from config import *  # noqa
import terrain as T

Image.MAX_IMAGE_PIXELS = None
KATE = {'Kivikate': 1, 'Kruuskate': 2, 'Pinnas': 3, 'Puit': 4}
AREA = {'Parkla': 0, 'Liiklusala': 1, 'Jalakäijate ala': 2, 'Muu': 3, 'Sport': 4}
# Fences are in ETAK but nothing in the game shows them, so they do not stop a car either:
# car parks, stadiums and yards stay open. Walls are drawn (vectors.json "walls") and stay solid.
WALLS = ('Tehissein', 'Müür', 'Kiviaed')


class Ortho:
    """Colour of the baked orthophoto tiles at world points."""

    def __init__(self, out):
        self.dir, self.cache, self.div = f'{out}/ortho', {}, {}

    def _tile(self, sx, sz, i, j):
        k = (sx, sz, i, j)
        if k not in self.cache:
            if len(self.cache) > 48:
                self.cache.pop(next(iter(self.cache)))
            p = f'{self.dir}/{sx}_{sz}_{i}_{j}.jpg'
            self.cache[k] = np.asarray(Image.open(p).convert('RGB')) if os.path.exists(p) else None
        return self.cache[k]

    def at(self, xs, zs):
        """(n, 3) colours, NaN where there is no tile."""
        out = np.full((len(xs), 3), np.nan)
        for n, (x, z) in enumerate(zip(xs, zs)):
            sx, sz = int((x - GRID0) // SECTOR), int((z - GRID0) // SECTOR)
            if (sx, sz) not in self.div:
                self.div[(sx, sz)] = next((d for d in (4, 2, 1) if os.path.exists(f'{self.dir}/{sx}_{sz}_{d - 1}_{d - 1}.jpg')), 0)
            d = self.div[(sx, sz)]
            if not d:
                continue
            t = SECTOR / d
            fx, fz = (x - GRID0 - sx * SECTOR) / t, (z - GRID0 - sz * SECTOR) / t
            img = self._tile(sx, sz, min(int(fx), d - 1), min(int(fz), d - 1))
            if img is None:
                continue
            h, w = img.shape[:2]
            out[n] = img[min(int((fz % 1) * h), h - 1), min(int((fx % 1) * w), w - 1)]
        return out


def _tone(ortho, xs, zs):
    c = ortho.at(xs, zs)
    c = c[~np.isnan(c[:, 0])]
    if len(c) < 6:
        return None
    # leave out painted lines, cars and tree crowns: the middle of the brightness range, grey pixels first
    sat = (c.max(1) - c.min(1)) / np.maximum(c.max(1), 1)
    g = c[sat < 0.16] if (sat < 0.16).sum() >= 6 else c
    lum = g.mean(1)
    lo, hi = np.percentile(lum, [25, 75])
    g = g[(lum >= lo) & (lum <= hi)]
    return [int(round(v)) for v in np.median(g, 0)]


def road_lines(roads, near, ortho=None):
    """Centre lines for vectors.json. Roads are (properties, geometry) in L-EST97."""
    out = []
    for p, g in roads:
        if not g.intersects(near):
            continue
        w = T.road_width(p)
        s = KATE.get(p.get('teekate_t'), 0)
        for part in T.flat(g):
            part = part.simplify(0.4)
            r = {**({'e': T.road_level(p)} if T.road_level(p) else {}),     # on a bridge (1) or in a tunnel (-1)
                 'name': p.get('nimetus') or '', 'type': p.get('tyyp_t'), 'w': round(w, 1),
                 **({'s': s} if s else {}),
                 'pts': [[round(x - E0, 1), round(-(y - N0), 1)] for x, y in part.coords]}
            if ortho is not None and s < 2 and part.length > 6:
                d = np.arange(2.0, part.length - 1.0, 3.0)
                xs, zs = [], []
                for side in (-1, 1):
                    off = part.parallel_offset(max(w / 4 - 0.2, 0.3), 'left' if side < 0 else 'right') if w > 3 else part
                    if off.is_empty or off.geom_type != 'LineString':
                        off = part
                    for t in d:
                        q = off.interpolate(t * off.length / part.length)
                        xs.append(q.x - E0); zs.append(N0 - q.y)
                c = _tone(ortho, xs, zs)
                if c:
                    r['c'] = c
            out.append(r)
    return out


def _ring(coords):
    return [[round(x - E0, 1), round(-(y - N0), 1)] for x, y, *_ in coords]


def areas(feats, near, ortho=None):
    """Car parks, squares and other paved areas as polygons."""
    out = []
    for p, g in feats('E_501_tee_a'):
        if not g.intersects(near):
            continue
        for poly in (g.geoms if hasattr(g, 'geoms') else [g]):
            poly = poly.simplify(0.3)
            if poly.geom_type != 'Polygon' or poly.is_empty or poly.area < 12:
                continue
            a = {'t': AREA.get(p.get('tyyp_t'), 3), 'outer': _ring(poly.exterior.coords),
                 **({'holes': [_ring(r.coords) for r in poly.interiors]} if poly.interiors else {})}
            if ortho is not None:
                x0, y0, x1, y1 = poly.bounds
                n = int(np.clip(np.sqrt(poly.area) / 3, 4, 14))
                pts = [(x, y) for x in np.linspace(x0, x1, n) for y in np.linspace(y0, y1, n) if poly.contains(Point(x, y))]
                c = _tone(ortho, [x - E0 for x, y in pts], [N0 - y for x, y in pts]) if pts else None
                if c:
                    a['c'] = c
            out.append(a)
    return out


def walls(feats, near):
    """Walls that are drawn and solid: [[x, z], ...] lines."""
    out = []
    for p, g in feats('E_405_piire_j'):
        if p.get('tyyp_t') in WALLS and g.intersects(near):
            out += [[[round(x - E0, 1), round(-(y - N0), 1)] for x, y in part.simplify(0.2).coords] for part in T.flat(g)]
    return out


def solid_shapes(feats):
    """What a car cannot drive through, besides trees and the map edge."""
    solid = [g for p, g in feats('E_401_hoone_ka') if p.get('tyyp_t') != 'Vundament']
    solid += [g.buffer(0.3) for p, g in feats('E_405_piire_j') if p.get('tyyp_t') in WALLS]
    return solid


def sector_sdf(shapes, x0, z0, margin=16.0, fine=0.25):
    """Quantised obstacle distance field of one sector from the L-EST97 shapes that touch it."""
    nf = int((SECTOR + 2 * margin) / fine)
    occ = T.rast(shapes, x0 - margin, z0 - margin, nf, nf, fine, all_touched=True) > 0
    if occ.any():
        sd = (ndimage.distance_transform_edt(~occ) - ndimage.distance_transform_edt(occ)) * fine
    else:
        sd = np.full(occ.shape, 99.0)
    s4 = (sd[:-1, :-1] + sd[1:, :-1] + sd[:-1, 1:] + sd[1:, 1:]) / 4.0
    b = int(margin / fine) - 1
    nd = int(SECTOR / SDF_RES) + 1
    sdn = s4[b:b + 2 * nd - 1:2, b:b + 2 * nd - 1:2]
    sdq = np.clip(np.round((sdn + 4.0) / 16.0 * 255), 0, 255).astype('uint8')
    assert sdq.shape == (nd, nd)
    return sdq


def trunk(x, z, h):
    return Point(E0 + x, N0 - z).buffer(min(0.45, max(0.14, 0.035 * h)), 6)
