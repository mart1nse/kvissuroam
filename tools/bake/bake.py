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
import buildings
import terrain as T
import trees as tree_rules

Image.MAX_IMAGE_PIXELS = None
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(f'{OUT}/sec', exist_ok=True)

SECS = sectors()
SECSET = set(SECS)
X0, Z0, X1, Z1 = detail_rect()
W1, H1 = int(X1 - X0), int(Z1 - Z0)
poly_en = Polygon(BOUNDARY)                      # drivable area, L-EST97
print('sectors', len(SECS), 'detail rect', (X0, Z0, X1, Z1))


T.setup(SRC)
wbox, feats, rast, flat, road_width, detail_box = T.wbox, T.feats, T.rast, T.flat, T.road_width, T.detail_box

# ---------------------------------------------------------------- terrain
print('terrain')
cw, chh = int(CX1 - CX0), int(CZ1 - CZ0)
D, hN = T.load_dtm(SRC)                          # 1 m pixels over the coarse rectangle, detail node heights

Q = 0.01
cs = int(COARSE_RES)
cn_x, cn_z = cw // cs + 1, chh // cs + 1
Ds = ndimage.uniform_filter(D, 17)
ci = np.minimum(np.arange(cn_z) * cs, chh - 1)[:, None]
cj = np.minimum(np.arange(cn_x) * cs, cw - 1)[None, :]
np.clip(np.round((Ds[ci, cj] - H0 + 100.0) / Q), 0, 65535).astype('<u2').tofile(f'{OUT}/coarse.bin')
del Ds, D
hG = hN.copy()                                   # untouched ground, for bridges and trees


def ground(xs, zs, a=None):
    return T.sample(hG if a is None else a, xs, zs)


# ---- water: the Emajõgi at one level, everything else at its own level
hN, wm, river_u, others, river_level = T.water(hN)
print(' river level', river_level, 'other water bodies', len(others))

# ---- bridges and tunnels: causeways over water, decks over dry land, lids over tunnels (terrain.py)
roads = feats('E_501_tee_j', detail_box.buffer(100))
decks, bridge_cells = T.crossings(hN, hG, wm, roads)

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
                **({'e': T.road_level(p)} if T.road_level(p) else {}),     # on a bridge (1) or in a tunnel (-1)
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
# crown points over a street: move the tree to the verge, or drop it
n_all = len(T)
T, t_moved = tree_rules.clear_roads(T, surf, X0, Z0, blocked=rast([g for p, g in buildings_fp], X0, Z0, W1, H1, 1.0, all_touched=True) > 0)
print(' trees over roads: moved', int(t_moved.sum()), 'dropped', n_all - len(T))
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


def roof_colour(bv, tris):
    """Median orthophoto colour inside a footprint box."""
    k = MOSAIC_RES
    c0, c1 = int((bv[:, 0].min() - E0 - X0) / k), int((bv[:, 0].max() - E0 - X0) / k) + 1
    r0, r1 = int((N0 - bv[:, 1].max() - Z0) / k), int((N0 - bv[:, 1].min() - Z0) / k) + 1
    patch = mos[max(r0, 0):max(r1, 1), max(c0, 0):max(c1, 1)]
    if patch.size == 0 or patch.max() == 0:
        return (120, 120, 125)
    return tuple(np.median(patch.reshape(-1, 3), 0))


bsec, n_b, n_c = buildings.build(SRC, SECSET, roof_colour)
print(' lod2 buildings', n_b, 'roofed areas', n_c)
del mos


# ---------------------------------------------------------------- sectors
print('sectors')
solid = [g for p, g in buildings_fp if p.get('tyyp_t') != 'Vundament']
solid += [g.buffer(0.12) for p, g in feats('E_405_piire_j')]
solid_tree = STRtree(solid)
trunk_tree = cKDTree(T[:, :2])
trunk_h = T[:, 2]
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
    nv, bbytes = buildings.pack(bsec, (sx, sz), x0, z0)
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
json.dump({'water': water, 'roads': road_lines, 'decks': decks}, open(f'{OUT}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for f in ('meta.json', 'vectors.json', 'coarse.bin'):
    print(f'  {f:14s} {os.path.getsize(os.path.join(OUT, f)) / 1e6:.2f} MB')
