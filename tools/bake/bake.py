"""Bake Maa- ja Ruumiamet open data into compact, streamable game assets.

Inputs (see tools/bake/README.md for where to download them), expected in SRC:
  dtm_*.tif                           1 m terrain model sheets covering the area
  etak_bbox.json                      ETAK features clipped to the area (extract_etak.py)
  hooned_lod2-Tartu_{linn,vald}.obj   LOD2 buildings (+ .fwt offsets)
  katusealused_lod1-Tartu_{linn,vald}.obj  roofed areas (carports)
  vegetatsioon-Tartu_{linn,vald}-*.gpkg    single trees
  ortho_mosaic.npy                    written by fetch_ortho.py (run it first)

Outputs in OUT: meta.json, vectors.json, coarse.bin and one sec/{sx}_{sz}.kvs
per sector (gzip: height, surface classes, obstacle distance field, buildings, trees,
and in the detail area hedges/bushes and fences from lidar_bushes.py).

Usage: python3 tools/bake/bake.py SRC_DIR public/data
"""
import glob
import gzip
import json
import os
import struct
import sys

import fiona
import numpy as np
import rasterio
import rasterio.features
import rasterio.windows
from PIL import Image
from rasterio.transform import from_origin
from scipy import ndimage
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box, mapping, shape
from shapely.ops import linemerge, unary_union
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *  # noqa

Image.MAX_IMAGE_PIXELS = None
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(f'{OUT}/sec', exist_ok=True)

SECS = sectors()
SECSET = set(SECS)
X0, Z0, X1, Z1 = detail_rect()
W1, H1 = int(X1 - X0), int(Z1 - Z0)
poly_en = Polygon(BOUNDARY)                      # drivable area, L-EST97
etak = json.load(open(f'{SRC}/etak_bbox.json'))
print('sectors', len(SECS), 'detail rect', (X0, Z0, X1, Z1))


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


# ---------------------------------------------------------------- terrain
print('terrain')
cw, chh = int(CX1 - CX0), int(CZ1 - CZ0)
D = np.full((chh, cw), np.nan, 'float32')        # 1 m pixels over the coarse rectangle
for path in sorted(glob.glob(f'{SRC}/dtm_*.tif')):
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

Q = 0.01
cs = int(COARSE_RES)
cn_x, cn_z = cw // cs + 1, chh // cs + 1
Ds = ndimage.uniform_filter(D, 17)
ci = np.minimum(np.arange(cn_z) * cs, chh - 1)[:, None]
cj = np.minimum(np.arange(cn_x) * cs, cw - 1)[None, :]
np.clip(np.round((Ds[ci, cj] - H0 + 100.0) / Q), 0, 65535).astype('<u2').tofile(f'{OUT}/coarse.bin')
del Ds

# node heights of the detail rectangle: integer metres, mean of the 4 surrounding pixels
ox, oz = int(X0 - CX0), int(Z0 - CZ0)
hN = (D[oz - 1:oz + H1, ox - 1:ox + W1] + D[oz:oz + H1 + 1, ox - 1:ox + W1]
      + D[oz - 1:oz + H1, ox:ox + W1 + 1] + D[oz:oz + H1 + 1, ox:ox + W1 + 1]) / 4.0
assert hN.shape == (H1 + 1, W1 + 1)
del D
hG = hN.copy()                                   # untouched ground, for bridges and trees


def ground(xs, zs, a=None):
    a = hG if a is None else a
    r = np.clip(np.round(np.asarray(zs) - Z0).astype(int), 0, H1)
    c = np.clip(np.round(np.asarray(xs) - X0).astype(int), 0, W1)
    return a[r, c]


# ---- water: the Emajõgi at one level, everything else at its own level
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
print(' river level', river_level, 'other water bodies', len(others))
wm = (rv > 0) | (ot > 0)
dist = ndimage.distance_transform_edt(wm).astype('float32')
depth = np.where(rv > 0, np.minimum(4.0, 0.45 * dist), np.minimum(1.2, 0.35 * dist))
hN = np.where(wm, hN - depth, hN).astype('float32')
del dist, depth

# ---- bridges and underpasses: the terrain model has them removed
roads = feats('E_501_tee_j', detail_box.buffer(100))


def road_width(p):
    w = float(p.get('laius') or 0)
    return (w if w > 0 else 1.2) + 0.6               # kerb / shoulder


def flat(g):
    return [LineString([(x, y) for x, y, *_ in part.coords]) for part in (g.geoms if hasattr(g, 'geoms') else [g])]


bridge_cells = np.zeros((H1 + 1, W1 + 1), bool)


def carry(level):
    segs, widths = [], []
    for p, g in roads:
        a, l = int(p.get('a_tasand') or 0), int(p.get('l_tasand') or 0)
        if (level > 0 and max(a, l) > 0) or (level < 0 and min(a, l) < 0):
            for part in flat(g):
                segs.append(part); widths.append(road_width(p))
    if not segs:
        return 0
    tree = STRtree(segs)
    merged = linemerge(segs)
    chains = list(merged.geoms) if hasattr(merged, 'geoms') else [merged]
    for ch in chains:
        if ch.length < 4:
            continue
        w = max(widths[i] for i in tree.query(ch) if segs[i].distance(ch) < 0.01) + 1.0
        n = int(ch.length) + 1
        pts = np.array([ch.interpolate(d).coords[0] for d in np.linspace(0, ch.length, n)])
        px, pz = pts[:, 0] - E0, N0 - pts[:, 1]
        p = ground(px, pz).astype('float64')
        inwater = ground(px, pz, wm)
        if level > 0:
            c = ndimage.grey_closing(p, size=min(n, 260), mode='nearest')
            gap = c - p > 1.2
            lab, k = ndimage.label(gap)
            deck = np.zeros(n, bool)
            cone = np.full(n, 1e9)
            for i in range(1, k + 1):
                m = lab == i
                if inwater[m].any():
                    deck |= m
                else:
                    cone[m] = p[m]
            # ramps cut into the embankments on both sides of a dry gap
            for i in range(1, n):
                cone[i] = min(cone[i], cone[i - 1] + 0.16)
            for i in range(n - 2, -1, -1):
                cone[i] = min(cone[i], cone[i + 1] + 0.16)
            cut = cone < p - 0.2
            deck = ndimage.binary_dilation(deck, iterations=3)
            target = np.where(deck, c, cone)
        else:
            o = ndimage.grey_opening(p, size=min(n, 120), mode='nearest')
            deck = np.zeros(n, bool)
            cut = p - o > 1.0
            cut = ndimage.binary_dilation(cut, iterations=4)
            target = ndimage.uniform_filter1d(np.where(cut, o, p), 9, mode='nearest')
        if not (deck.any() or cut.any()):
            continue
        cor = ch.buffer(w / 2, cap_style=2)
        minx, miny, maxx, maxy = cor.bounds
        c0, c1 = int(minx - E0 - X0) - 1, int(maxx - E0 - X0) + 2
        r0, r1 = int(N0 - maxy - Z0) - 1, int(N0 - miny - Z0) + 2
        c0, r0, c1, r1 = max(c0, 0), max(r0, 0), min(c1, W1 + 1), min(r1, H1 + 1)
        if c1 <= c0 or r1 <= r0:
            continue
        m = rast([cor], X0 + c0 - 0.5, Z0 + r0 - 0.5, c1 - c0, r1 - r0, 1.0, all_touched=True) > 0
        rr, cc = np.nonzero(m)
        _, idx = cKDTree(np.stack([px, pz], 1)).query(np.stack([X0 + c0 + cc, Z0 + r0 + rr], 1))
        sub = hN[r0:r1, c0:c1]
        dk = deck[idx]
        sub[rr[dk], cc[dk]] = np.maximum(sub[rr[dk], cc[dk]], target[idx[dk]])
        bridge_cells[r0 + rr[dk], c0 + cc[dk]] = True
        ct = cut[idx] & ~dk
        sub[rr[ct], cc[ct]] = np.minimum(sub[rr[ct], cc[ct]], target[idx[ct]])
    return len(chains)


print(' bridge chains', carry(1), 'underpass chains', carry(-1), 'deck cells', int(bridge_cells.sum()))

# ---------------------------------------------------------------- surface classes
print('surface')
GRASS, PAVED, GRAVEL, DIRT, WATER = 0, 1, 2, 3, 4
road_shapes = {PAVED: [], GRAVEL: [], DIRT: []}
road_lines = []
near = poly_en.buffer(150)
for p, g in roads:
    kate = p.get('teekate_t')
    cls = GRAVEL if kate == 'Kruuskate' else DIRT if kate == 'Pinnas' else PAVED
    w = road_width(p)
    road_shapes[cls].append(g.buffer(w / 2, cap_style=1, join_style=1))
    if g.intersects(near):
        for part in flat(g):
            part = part.simplify(0.4)
            road_lines.append({
                'name': p.get('nimetus') or '',
                'type': p.get('tyyp_t'),
                'w': round(w, 1),
                'pts': [[round(x - E0, 1), round(-(y - N0), 1)] for x, y in part.coords],
            })
surf = np.zeros((H1, W1), 'uint8')
for cls in (DIRT, GRAVEL, PAVED):
    surf[rast(road_shapes[cls], X0, Z0, W1, H1, 1.0) > 0] = cls
surf[rast([g for p, g in feats('E_501_tee_a')], X0, Z0, W1, H1, 1.0) > 0] = PAVED

# driveways, yards and car parks are not in ETAK: pick up grey, unsaturated ortho pixels
mos = np.load(f'{SRC}/ortho_mosaic.npy')
buildings_fp = feats('E_401_hoone_ka')
bld = rast([g.buffer(2.5) for p, g in buildings_fp] + [g.buffer(1.0) for p, g in feats('E_403_muu_rajatis_ka')], X0, Z0, W1, H1, 1.0)
mos_img = Image.fromarray(mos)
step = 1280
for r0 in range(0, H1, step):
    r1 = min(H1, r0 + step)
    k = MOSAIC_RES
    rgb = np.asarray(mos_img.crop((0, int(r0 / k), mos.shape[1], int(r1 / k))).resize((W1, r1 - r0), Image.BILINEAR)).astype('float32')
    mx, mn = rgb.max(2), rgb.min(2)
    grey = ((mx - mn) / np.maximum(mx, 1) < 0.12) & (mx > 95) & (mx < 235)
    grey = ndimage.binary_closing(ndimage.binary_opening(grey, iterations=2), iterations=1)
    s = surf[r0:r1]
    s[(s == GRASS) & grey & (bld[r0:r1] == 0)] = PAVED
del bld, mos_img
surf[wm[:-1, :-1] & wm[1:, 1:]] = WATER
bc = bridge_cells[:-1, :-1] | bridge_cells[1:, :-1] | bridge_cells[:-1, 1:] | bridge_cells[1:, 1:]
surf[bc] = PAVED
print(' classes', np.bincount(surf.ravel(), minlength=5))

# ---------------------------------------------------------------- trees
print('trees')
trees = {}
tb = detail_box.bounds
for f in glob.glob(f'{SRC}/vegetatsioon-*.gpkg'):
    with fiona.open(f, layer='yksikpuud_keskpunkt') as src:
        for ft in src.filter(bbox=tb):
            x, y = ft['geometry']['coordinates'][:2]
            p = ft['properties']
            trees[int(p['puu_id'])] = (x - E0, N0 - y, float(p['korgus'] or 8), float(p['puukroon'] or 4),
                                       1.0 if p['puutyyp'] == 'Okaspuu' else 0.0)
T = np.array(list(trees.values()), 'float64')
del trees
T = T[(T[:, 0] > X0) & (T[:, 0] < X1 - 0.01) & (T[:, 1] > Z0) & (T[:, 1] < Z1 - 0.01)]
tsurf = surf[(T[:, 1] - Z0).astype(int), (T[:, 0] - X0).astype(int)]
T = T[tsurf != WATER]
tsurf = tsurf[tsurf != WATER]
t_ground = ground(T[:, 0], T[:, 1])
t_sec = np.stack([np.floor((T[:, 0] - GRID0) / SECTOR), np.floor((T[:, 1] - GRID0) / SECTOR)], 1).astype(int)
print(' trees', len(T))

# ---------------------------------------------------------------- hedges, bushes and fences (lidar, detail area only)
low_obj = {}          # sector -> (bush records, fence records), each (n,3) uint16: ix, iz, height dm | angle << 8
if os.path.exists(f'{SRC}/bushes.npz'):
    bz = np.load(f'{SRC}/bushes.npz')
    bx0, bz0, bres = float(bz['x0']), float(bz['z0']), float(bz['res'])
    inside = rast([Polygon(DETAIL_AREA)], bx0, bz0, bz['h'].shape[1], bz['h'].shape[0], bres) > 0
    for kind, arr in ((0, bz['h']), (1, bz['fh'])):
        rr, cc = np.nonzero((arr > 0) & inside)
        wx, wz = bx0 + (cc + 0.5) * bres, bz0 + (rr + 0.5) * bres
        sc = surf[np.clip((wz - Z0).astype(int), 0, H1 - 1), np.clip((wx - X0).astype(int), 0, W1 - 1)]
        ok = (sc == GRASS) | (sc == DIRT)                   # nothing on roads, drives or water
        rr, cc, wx, wz = rr[ok], cc[ok], wx[ok], wz[ok]
        val = arr[rr, cc].astype('uint16') | ((bz['fa'][rr, cc].astype('uint16') << 8) if kind else 0)
        sxs, szs = np.floor((wx - GRID0) / SECTOR).astype(int), np.floor((wz - GRID0) / SECTOR).astype(int)
        for key in set(zip(sxs.tolist(), szs.tolist())):
            m = (sxs == key[0]) & (szs == key[1])
            rec = np.stack([(wx[m] - (GRID0 + key[0] * SECTOR)) / bres, (wz[m] - (GRID0 + key[1] * SECTOR)) / bres, val[m]], 1).astype('<u2')
            low_obj.setdefault(key, [np.zeros((0, 3), '<u2'), np.zeros((0, 3), '<u2')])[kind] = rec
        print(' lidar', 'fence' if kind else 'bush', 'cells', len(rr))

# ---------------------------------------------------------------- buildings
print('buildings')


def roof_colour(minx, miny, maxx, maxy):
    """Median orthophoto colour inside a footprint box."""
    k = MOSAIC_RES
    c0, c1 = int((minx - E0 - X0) / k), int((maxx - E0 - X0) / k) + 1
    r0, r1 = int((N0 - maxy - Z0) / k), int((N0 - miny - Z0) / k) + 1
    patch = mos[max(r0, 0):max(r1, 1), max(c0, 0):max(c1, 1)]
    if patch.size == 0 or patch.max() == 0:
        return (120, 120, 125)
    return tuple(np.median(patch.reshape(-1, 3), 0))


def load_obj(path):
    off = [float(l.split()[3]) for l in open(path[:-4] + '.fwt').read().strip().splitlines()]
    verts = []
    groups = {}
    cur = None
    with open(path) as fh:
        for line in fh:
            if line.startswith('v '):
                _, x, y, z = line.split()
                verts.append((float(x) + off[0], float(y) + off[1], float(z) + off[2]))
            elif line.startswith('usemtl'):
                cur = groups.setdefault(line.split()[1], [])
            elif line.startswith('f '):
                idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
                for i in range(1, len(idx) - 1):
                    cur.append((idx[0], idx[i], idx[i + 1]))
    return np.array(verts), groups


WALLS = [(236, 234, 228), (222, 218, 208), (200, 198, 196), (168, 160, 150), (120, 96, 78),
         (90, 92, 98), (232, 222, 196), (190, 170, 150), (245, 245, 245), (150, 110, 90)]
bsec = {}          # sector -> list of (pos(m,3,3), nrm(m,3), col(m,3), kind(m), base(m))


def emit(key, V, tris, wall_rgb, roof_rgb, extend=2.0, slab=None):
    """V: (n,3) E,N,H. Stores flat-shaded triangles in game coordinates."""
    V = V.copy()
    T_ = np.asarray(tris)
    zmin, zmax = V[:, 2].min(), V[:, 2].max()
    area = (V[:, 0].max() - V[:, 0].min()) * (V[:, 1].max() - V[:, 1].min())
    windows = slab is None and extend >= 2.0 and (zmax - zmin) > 3.3 and area > 45
    if slab is not None:                       # keep only a thin roof slab
        V[:, 2] = np.maximum(V[:, 2], zmax - slab)
    else:
        V[V[:, 2] < zmin + 0.05, 2] -= extend  # push the base into the ground
    P = np.stack([V[:, 0] - E0, V[:, 2] - H0, -(V[:, 1] - N0)], 1)
    pa, pb, pc = P[T_[:, 0]], P[T_[:, 1]], P[T_[:, 2]]
    n = -np.cross(pb - pa, pc - pa)            # E,N,H -> x,y,z flips handedness
    l = np.linalg.norm(n, axis=1)
    ok = l > 1e-9
    n = n / np.maximum(l, 1e-12)[:, None]
    if slab is None:
        ok &= n[:, 1] >= -0.7                  # drop floors
    roof = n[:, 1] > 0.25
    col = np.where(roof[:, None], np.array(roof_rgb, 'float32'), np.array(wall_rgb, 'float32'))
    kind = np.where(roof, 1, 2 if windows else 0)
    pos = np.stack([pa, pc, pb], 1)
    m = int(ok.sum())
    bsec.setdefault(key, []).append((pos[ok], n[ok], col[ok], kind[ok], np.full(m, zmin - H0)))


def sector_of(e, n_):
    return (int((e - E0 - GRID0) // SECTOR), int((N0 - n_ - GRID0) // SECTOR))


n_b = n_c = 0
for name in ('Tartu_linn', 'Tartu_vald'):
    V, groups = load_obj(f'{SRC}/hooned_lod2-{name}.obj')
    for mtl, tris in groups.items():
        if not tris:
            continue
        t = np.array(tris)
        ids = np.unique(t)
        bv = V[ids]
        key = sector_of(bv[:, 0].mean(), bv[:, 1].mean())
        if key not in SECSET:
            continue
        t2 = np.searchsorted(ids, t)
        cx, cy = bv[:, 0].mean(), bv[:, 1].mean()
        emit(key, bv, t2, WALLS[(int(cx * 7) ^ int(cy * 13)) % len(WALLS)],
             roof_colour(bv[:, 0].min(), bv[:, 1].min(), bv[:, 0].max(), bv[:, 1].max()))
        n_b += 1
    del V, groups
    V, groups = load_obj(f'{SRC}/katusealused_lod1-{name}.obj')
    for mtl, tris in groups.items():
        if not tris:
            continue
        t = np.array(tris)
        ids = np.unique(t)
        bv = V[ids]
        key = sector_of(bv[:, 0].mean(), bv[:, 1].mean())
        if key not in SECSET:
            continue
        emit(key, bv, np.searchsorted(ids, t), (70, 70, 74), (70, 70, 74), slab=0.22)
        n_c += 1
        zmin, zmax = bv[:, 2].min(), bv[:, 2].max()
        rect = MultiPoint([(x, y) for x, y, _ in bv]).minimum_rotated_rectangle
        if rect.geom_type != 'Polygon':
            continue
        ctr = rect.centroid
        for x, y in list(rect.exterior.coords)[:4]:      # corner posts, pulled slightly inside
            x += (ctr.x - x) * 0.06; y += (ctr.y - y) * 0.06
            s = 0.07
            pv = np.array([[x - s, y - s, zmin], [x + s, y - s, zmin], [x + s, y + s, zmin], [x - s, y + s, zmin],
                           [x - s, y - s, zmax - 0.2], [x + s, y - s, zmax - 0.2], [x + s, y + s, zmax - 0.2], [x - s, y + s, zmax - 0.2]])
            pt = [(0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
            emit(key, pv, pt, (60, 60, 64), (60, 60, 64), extend=1.0)
    del V, groups
print(' lod2 buildings', n_b, 'roofed areas', n_c)
del mos


def pack_buildings(key, sx0, sz0):
    parts = bsec.get(key)
    if not parts:
        return 0, b''
    pos = np.concatenate([p[0] for p in parts]).reshape(-1, 3).astype('float32')
    nrm = np.repeat(np.concatenate([p[1] for p in parts]), 3, 0)
    col = np.repeat(np.concatenate([p[2] for p in parts]), 3, 0)
    kind = np.repeat(np.concatenate([p[3] for p in parts]), 3, 0).astype('uint8')
    base = np.repeat(np.concatenate([p[4] for p in parts]), 3, 0)
    nv = len(pos)
    pq = np.zeros((nv, 3), '<i2')
    pq[:, 0] = np.clip(np.round((pos[:, 0] - sx0) / 0.05), -32767, 32767)     # sector-relative
    pq[:, 1] = np.clip(np.round(pos[:, 1] / 0.01), -32767, 32767)
    pq[:, 2] = np.clip(np.round((pos[:, 2] - sz0) / 0.05), -32767, 32767)
    nq = np.clip(np.round(nrm * 127), -127, 127).astype('i1')
    cq = np.clip(col, 0, 255).astype('u1')
    bq = np.clip(np.round(base / 0.01), -32767, 32767).astype('<i2')
    return nv, pq.tobytes() + nq.tobytes() + cq.tobytes() + kind.tobytes() + bq.tobytes()


# ---------------------------------------------------------------- sectors
print('sectors')
solid = [g for p, g in buildings_fp if p.get('tyyp_t') != 'Vundament']
solid += [g.buffer(0.12) for p, g in feats('E_405_piire_j')]
solid_tree = STRtree(solid)
hard = (tsurf == PAVED) | (tsurf == GRAVEL)      # trees "on" roads are canopy overhang: no trunk there
trunk_tree = cKDTree(T[~hard][:, :2])
trunk_h = T[~hard][:, 2]
S, FINE, MARGIN = int(SECTOR), 0.25, 16.0
nf = int((SECTOR + 2 * MARGIN) / FINE)
total = 0
sec_meta = []
for k, (sx, sz) in enumerate(SECS):
    x0, z0 = GRID0 + sx * SECTOR, GRID0 + sz * SECTOR
    c0, r0 = int(x0 - X0), int(z0 - Z0)
    hm = hN[r0:r0 + S + 1:int(HM_RES), c0:c0 + S + 1:int(HM_RES)]
    hq = np.clip(np.round((hm - H0 + 100.0) / Q), 0, 65535).astype('<u2')
    sf = surf[r0:r0 + S, c0:c0 + S]
    # obstacle distance field
    wb = wbox(x0 - MARGIN, z0 - MARGIN, x0 + SECTOR + MARGIN, z0 + SECTOR + MARGIN)
    shapes = [solid[i] for i in solid_tree.query(wb)]
    cx, cz = x0 + SECTOR / 2, z0 + SECTOR / 2
    for i in trunk_tree.query_ball_point([cx, cz], (SECTOR / 2 + MARGIN) * 1.42):
        tx, tz = trunk_tree.data[i]
        shapes.append(Point(E0 + tx, N0 - tz).buffer(min(0.45, max(0.14, 0.035 * trunk_h[i])), 6))
    outside = wb.difference(poly_en)
    if not outside.is_empty:
        shapes.append(outside)
    occ = rast(shapes, x0 - MARGIN, z0 - MARGIN, nf, nf, FINE, all_touched=True) > 0
    if occ.any():
        sd = (ndimage.distance_transform_edt(~occ) - ndimage.distance_transform_edt(occ)) * FINE
    else:
        sd = np.full(occ.shape, 99.0)
    s4 = (sd[:-1, :-1] + sd[1:, :-1] + sd[:-1, 1:] + sd[1:, 1:]) / 4.0
    b = int(MARGIN / FINE) - 1
    nd = int(SECTOR / SDF_RES) + 1
    sdn = s4[b:b + 2 * nd - 1:2, b:b + 2 * nd - 1:2]
    sdq = np.clip(np.round((sdn + 4.0) / 16.0 * 255), 0, 255).astype('uint8')
    assert sdq.shape == (nd, nd) and hq.shape == (S // int(HM_RES) + 1,) * 2
    # trees
    m = (t_sec[:, 0] == sx) & (t_sec[:, 1] == sz)
    rec = np.zeros(int(m.sum()), dtype=[('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('h', '<f4'), ('c', '<f4'), ('k', '<f4')])
    rec['x'] = T[m, 0]; rec['z'] = T[m, 1]; rec['y'] = t_ground[m] - H0
    rec['h'] = T[m, 2]; rec['c'] = np.clip(T[m, 3], 1.5, 16); rec['k'] = T[m, 4]
    nv, bbytes = pack_buildings((sx, sz), x0, z0)
    bush, fence = low_obj.get((sx, sz), (np.zeros((0, 3), '<u2'),) * 2)
    head = struct.pack('<4s7I', b'KVS1', hq.shape[0], sf.shape[0], nd, nv, len(rec), len(bush), len(fence))
    blob = gzip.compress(head + hq.tobytes() + sf.tobytes() + sdq.tobytes() + bbytes + rec.tobytes()
                         + bush.tobytes() + fence.tobytes(), 6)
    open(f'{OUT}/sec/{sx}_{sz}.kvs', 'wb').write(blob)
    total += len(blob)
    sec_meta.append([sx, sz, 4 if (sx, sz) in HI_SECTORS else 2])
    if k % 20 == 0:
        print(f'  {k}/{len(SECS)}  {sx},{sz}  {len(blob) / 1e6:.2f} MB  trees {len(rec)}  tris {nv // 3}', flush=True)
print(f' sector data {total / 1e6:.1f} MB')

# ---------------------------------------------------------------- vectors + meta
print('meta')
coarse_box = wbox(CX0, CZ0, CX1, CZ1)


def rings(g, tol=0.7):
    out = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type != 'Polygon' or p.is_empty:
            continue
        p = p.simplify(tol)
        out.append({
            'outer': [[round(x - E0, 1), round(-(y - N0), 1)] for x, y, *_ in p.exterior.coords],
            'holes': [[[round(x - E0, 1), round(-(y - N0), 1)] for x, y, *_ in r.coords] for r in p.interiors],
        })
    return out


water = [{'level': round(river_level - H0, 2), 'river': True, 'polys': rings(river_u.intersection(coarse_box), 1.0)}]
for g in others:
    if not g.intersects(near):
        continue
    c = g.representative_point()
    lvl = float(ground([c.x - E0], [N0 - c.y])[0])
    water.append({'level': round(lvl - H0, 2), 'river': False, 'polys': rings(g)})

bnd = poly_en.simplify(2.0)
meta = {
    'origin': {'e': E0, 'n': N0, 'h': H0, 'crs': 'EPSG:3301'},
    'sector': {'size': SECTOR, 'grid0': GRID0, 'list': sec_meta},
    'coarse': {'x0': CX0, 'z0': CZ0, 'x1': CX1, 'z1': CZ1, 'res': COARSE_RES, 'nx': cn_x, 'nz': cn_z},
    'height': {'res': HM_RES, 'n': S // int(HM_RES) + 1, 'scale': Q, 'offset': -100.0},
    'surface': {'res': SURF_RES, 'n': S, 'classes': ['grass', 'paved', 'gravel', 'dirt', 'water']},
    'sdf': {'res': SDF_RES, 'n': int(SECTOR / SDF_RES) + 1, 'min': -4.0, 'max': 12.0},
    'ortho': {'px': TILE_PX, 'x': ['%d_%d_%d_%d' % t for t in XTILES]},
    'lowres': BUSH_RES,
    'boundary': [[round(x - E0, 1), round(-(y - N0), 1)] for x, y in bnd.exterior.coords],
    'riverLevel': round(river_level - H0, 2),
    'start': {'x': START_E - E0, 'z': -(START_N - N0), 'heading': 0.0},
    'attribution': 'Ortofoto, kõrgusmudel, ETAK, hoonete 3D mudel ja üksikpuud: Maa- ja Ruumiamet 2026',
}
json.dump(meta, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False)
json.dump({'water': water, 'roads': road_lines}, open(f'{OUT}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for f in ('meta.json', 'vectors.json', 'coarse.bin'):
    print(f'  {f:14s} {os.path.getsize(os.path.join(OUT, f)) / 1e6:.2f} MB')
