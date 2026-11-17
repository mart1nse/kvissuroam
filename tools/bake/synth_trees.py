"""Trees where the Land Board single-tree layer has none (Äksi and the Saadjärv shore, 2026-11-17).

The single-tree data (vegetatsioon-*.gpkg) has holes. Inside them trees are made up from:
  - ETAK woodland (E_305_puittaimestik_a): a jittered grid, mixed conifers and broadleaves
  - ETAK tree rows (E_305_puittaimestik_j) and groves (E_305_puittaimestik_p)
  - garden trees: dark green, rough patches in the orthophoto mosaic away from roads and houses
Used by bake.py when SYNTH_TREES=1; trees.py's road rules still apply to them afterwards.
Needs the ETAK woodland shapefiles in SRC/etak305/ (from ETAK_Eesti_SHP_kolvikud.zip).
"""
import glob
import math

import fiona
import numpy as np
from scipy import ndimage
from shapely.geometry import Point, shape
from shapely.prepared import prep

from config import E0, N0, MOSAIC_RES

HOLE_R = 40.0          # a spot counts as a hole when no real tree is this close
rng = np.random.default_rng(7)


def _tree(x, y, conifer=None, h=None, c=None):
    con = (rng.random() < 0.55) if conifer is None else conifer
    h = h or (rng.uniform(14, 24) if con else rng.uniform(11, 20))
    c = c or (rng.uniform(2.2, 3.6) if con else rng.uniform(3.2, 5.2))
    return (x - E0, N0 - y, h, c, 1.0 if con else 0.0)


def synth(src, area_en, real_xy, mos, X0, Z0, blocked):
    """area_en: shapely polygon (L-EST97) where trees may go; real_xy: (n, 2) world x, z of real trees;
    mos: orthophoto mosaic over the detail rect (MOSAIC_RES m/px); blocked(x, z) -> True on roads,
    buildings and water (world arrays). Returns a list of tree tuples (x, z, h, crown, conifer)."""
    from scipy.spatial import cKDTree
    real = cKDTree(real_xy) if len(real_xy) else None
    area = prep(area_en)
    bb = area_en.bounds
    out = []

    def keep(x, y):
        if not area.contains(Point(x, y)):
            return False
        if real is not None and real.query([x - E0, N0 - y], distance_upper_bound=HOLE_R)[0] < HOLE_R:
            return False
        return True

    for path in glob.glob(f'{src}/etak305/**/E_305_puittaimestik_*.shp', recursive=True):
        with fiona.open(path) as fs:
            for f in fs.filter(bbox=bb):
                g = shape(f['geometry'])
                if path.endswith('_a.shp'):
                    if not g.intersects(area_en):
                        continue
                    g = g.intersection(area_en.buffer(60))
                    minx, miny, maxx, maxy = g.bounds
                    pg = prep(g)
                    step = 8.5
                    for yy in np.arange(miny, maxy, step):
                        for xx in np.arange(minx, maxx, step):
                            x, y = xx + rng.uniform(-3, 3), yy + rng.uniform(-3, 3)
                            if pg.contains(Point(x, y)) and keep(x, y):
                                out.append(_tree(x, y))
                elif path.endswith('_j.shp'):
                    for part in (g.geoms if hasattr(g, 'geoms') else [g]):
                        L = part.length
                        for d in np.arange(rng.uniform(0, 3), L, 6.5):
                            p = part.interpolate(d)
                            if keep(p.x, p.y):
                                out.append(_tree(p.x + rng.uniform(-0.8, 0.8), p.y + rng.uniform(-0.8, 0.8), conifer=False, h=rng.uniform(9, 16)))
                else:
                    for _ in range(6):
                        a, r = rng.uniform(0, 2 * math.pi), rng.uniform(0, 9)
                        x, y = g.x + r * math.cos(a), g.y + r * math.sin(a)
                        if keep(x, y):
                            out.append(_tree(x, y))
    n_etak = len(out)

    # garden trees from the orthophoto: dark, green, rough
    rgb = mos.astype('float32')
    r, gch, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (r + gch + b) / 3
    rough = ndimage.generic_filter(lum, np.std, size=3) if lum.size < 4e6 else np.full(lum.shape, 10.0)
    canopy = (gch > r + 4) & (gch >= b) & (lum < 105) & (rough > 6)
    canopy = ndimage.binary_opening(canopy, iterations=1)
    canopy = ndimage.binary_closing(canopy, iterations=1)
    dist = ndimage.distance_transform_edt(canopy) * MOSAIC_RES
    peak = (dist == ndimage.maximum_filter(dist, size=5)) & (dist >= 1.8)
    for j, i in zip(*np.nonzero(peak)):
        x, z = X0 + (i + 0.5) * MOSAIC_RES, Z0 + (j + 0.5) * MOSAIC_RES
        if blocked(np.array([x]), np.array([z]))[0]:
            continue
        ex, ny = E0 + x, N0 - z
        if not keep(ex, ny):
            continue
        cr = min(6.0, float(dist[j, i]) + 0.8)
        out.append(_tree(ex, ny, h=rng.uniform(7, 15) * (0.7 + cr / 10), c=cr))
    # thin out garden peaks that ended up too close together
    if len(out) > n_etak:
        pts = np.array([(t[0], t[1]) for t in out])
        tr = cKDTree(pts)
        drop = set()
        for a, bq in sorted(tr.query_pairs(3.5)):
            if a not in drop and bq >= n_etak:
                drop.add(bq)
        out = [t for k, t in enumerate(out) if k not in drop]
    print(' synthetic trees: woodland/rows/groves', n_etak, 'total', len(out))
    return out
