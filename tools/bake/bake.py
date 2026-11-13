"""Bake Maa- ja Ruumiamet open data into compact game assets.

Inputs (see tools/bake/README.md for where to download them), expected in SRC:
  dtm_54754.tif                       1 m terrain model, map sheet 54754
  etak_bbox.json                      ETAK features clipped to the scenery box (extract.py)
  hooned_lod2-Tartu_{linn,vald}.obj   LOD2 buildings (+ .fwt offsets)
  katusealused_lod1-Tartu_{linn,vald}.obj  roofed areas (carports)
  vegetatsioon-Tartu_{linn,vald}-*.gpkg    single trees
Ortho tiles are fetched separately by fetch_ortho.py (it must run first: roofs
take their colour from the overview image).

Usage: python3 tools/bake/bake.py SRC_DIR public/data
"""
import json
import struct
import sys
import glob
import os

import numpy as np
import rasterio
import rasterio.features
import rasterio.windows
from rasterio.transform import from_origin
from scipy import ndimage
from shapely.geometry import shape, box, Point, LineString, mapping
from shapely.ops import unary_union
from PIL import Image
import fiona

sys.path.insert(0, os.path.dirname(__file__))
from config import *  # noqa

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

inner_box = box(E0 - INNER, N0 - INNER, E0 + INNER, N0 + INNER)
outer_box = box(E0 - OUTER, N0 - OUTER, E0 + OUTER, N0 + OUTER)
etak = json.load(open(f'{SRC}/etak_bbox.json'))


def feats(layer, clip=outer_box):
    out = []
    for f in etak.get(layer, []):
        g = shape(f['g'])
        if not g.is_valid:
            g = g.buffer(0)
        if g.intersects(clip):
            out.append((f['p'], g))
    return out


def raster(shapes, half, res, value=1, dtype='uint8', all_touched=False):
    """Rasterise shapes on a north-up grid covering the +-half square."""
    n = int(round(2 * half / res))
    tr = from_origin(E0 - half, N0 + half, res, res)
    shapes = [(mapping(g), value) for g in shapes if not g.is_empty]
    if not shapes:
        return np.zeros((n, n), dtype)
    return rasterio.features.rasterize(shapes, out_shape=(n, n), transform=tr,
                                       fill=0, dtype=dtype, all_touched=all_touched)


# ---------------------------------------------------------------- terrain
print('terrain')
dtm = rasterio.open(f'{SRC}/dtm_54754.tif')


def read_dtm(half):
    w = rasterio.windows.from_bounds(E0 - half, N0 - half, E0 + half, N0 + half, dtm.transform)
    a = dtm.read(1, window=w).astype('float32')
    a[a < -100] = np.nan
    if np.isnan(a).any():
        a[np.isnan(a)] = np.nanmedian(a)
    return a


d_in = read_dtm(INNER + 2)     # 1 m pixels, 2 m margin for corner sampling
d_out = read_dtm(OUTER + 16)

river = [g for p, g in feats('E_203_vooluveekogu_a')]
ponds = [g for p, g in feats('E_202_seisuveekogu_a')]
river_u = unary_union(river)
ponds_u = unary_union(ponds)
water_u = unary_union([river_u, ponds_u])

# water level of the Emajõgi = median DTM value on the river
rm = raster([river_u], INNER, 1.0)
river_level = float(np.median(d_in[2:-2, 2:-2][rm > 0]))
print(' river level', river_level)

# 1 m grid -> height at integer metres (pixel corners) by 2x2 mean


def corner_grid(a, margin, step):
    c = (a[:-1, :-1] + a[1:, :-1] + a[:-1, 1:] + a[1:, 1:]) / 4.0
    c = c[margin - 1:-(margin - 1) or None, margin - 1:-(margin - 1) or None]
    return c[::step, ::step]


h1 = corner_grid(d_in, 2, 1)                 # (1601, 1601) at 1 m
assert h1.shape == (int(2 * INNER) + 1,) * 2, h1.shape

# carve a bed under the water so cars can sink: depth grows with distance from shore
wm1 = raster([water_u], INNER + 0.5, 1.0)     # 1601 px, centres on integer metres
assert wm1.shape == h1.shape
rv1 = raster([river_u], INNER + 0.5, 1.0)
dist_in = ndimage.distance_transform_edt(wm1 > 0)
depth = np.where(rv1 > 0, np.minimum(4.0, 0.45 * dist_in), np.minimum(1.2, 0.35 * dist_in))
# surface level per water body: river = river_level, ponds = local DTM
h_bed = np.where(wm1 > 0, h1 - depth, h1)
hm = h_bed[::int(HM_RES), ::int(HM_RES)]
print(' inner heightmap', hm.shape, hm.min(), hm.max())

Q = 0.01
hq = np.clip(np.round((hm - H0 + 100.0) / Q), 0, 65535).astype('<u2')
hq.tofile(f'{OUT}/height.bin')

# outer coarse grid, with the ring that touches the inner square matched exactly
ho_full = corner_grid(d_out, 16, 1)
ho = ndimage.uniform_filter(ho_full, 9)[::int(HM_OUTER_RES), ::int(HM_OUTER_RES)].copy()
k0 = int((OUTER - INNER) / HM_OUTER_RES)
k1 = k0 + int(2 * INNER / HM_OUTER_RES)
step = int(HM_OUTER_RES / HM_RES)
ho[k0:k1 + 1, k0:k1 + 1] = hm[::step, ::step]
np.clip(np.round((ho - H0 + 100.0) / Q), 0, 65535).astype('<u2').tofile(f'{OUT}/height_outer.bin')
print(' outer heightmap', ho.shape)

# ---------------------------------------------------------------- surface classes
print('surface')
GRASS, PAVED, GRAVEL, DIRT, WATER = 0, 1, 2, 3, 4
roads = feats('E_501_tee_j')
road_shapes = {PAVED: [], GRAVEL: [], DIRT: []}
road_lines = []
for p, g in roads:
    w = float(p.get('laius') or 0)
    kate = p.get('teekate_t')
    cls = PAVED if kate == 'Püsikate' else GRAVEL if kate == 'Kruuskate' else DIRT
    if w <= 0:
        w = 1.2
    w += 0.6  # kerb / shoulder
    road_shapes[cls].append(g.buffer(w / 2, cap_style=1, join_style=1))
    if g.intersects(inner_box.buffer(200)):
        for part in (g.geoms if hasattr(g, 'geoms') else [g]):
            road_lines.append({
                'name': p.get('nimetus') or '',
                'type': p.get('tyyp_t'),
                'w': round(w, 1),
                'pts': [[round(x - E0, 1), round(-(y - N0), 1)] for x, y, *_ in part.coords],
            })
areas = [g for p, g in feats('E_501_tee_a')]
n_s = int(2 * INNER / SURF_RES)
surf = np.zeros((n_s, n_s), 'uint8')
for cls in (DIRT, GRAVEL, PAVED):
    m = raster(road_shapes[cls], INNER, SURF_RES)
    surf[m > 0] = cls
surf[raster(areas, INNER, SURF_RES) > 0] = PAVED

# driveways and yards are not in ETAK: pick up grey, unsaturated ortho pixels
ov = np.asarray(Image.open(f'{OUT}/ortho/overview.jpg').convert('RGB')).astype('float32')
try:
    tiles_n = int(2 * INNER / TILE)
    px = TILE_PX // 4
    mos = np.zeros((tiles_n * px, tiles_n * px, 3), 'float32')
    for ty in range(tiles_n):
        for tx in range(tiles_n):
            im = Image.open(f'{OUT}/ortho/t_{tx}_{ty}.jpg').convert('RGB').resize((px, px), Image.BILINEAR)
            mos[ty * px:(ty + 1) * px, tx * px:(tx + 1) * px] = np.asarray(im)
    mos_img = Image.fromarray(mos.astype('uint8')).resize((n_s, n_s), Image.BILINEAR)
    rgb = np.asarray(mos_img).astype('float32')
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    grey = (sat < 0.12) & (mx > 95) & (mx < 235)
    grey = ndimage.binary_opening(grey, iterations=2)
    grey = ndimage.binary_closing(grey, iterations=1)
    bld = raster([g.buffer(2.5) for p, g in feats('E_401_hoone_ka')] +
                 [g.buffer(1.0) for p, g in feats('E_403_muu_rajatis_ka')], INNER, SURF_RES)
    grey &= bld == 0
    surf[(surf == GRASS) & grey] = PAVED
except FileNotFoundError:
    print(' (no ortho tiles yet, skipping driveway detection)')
surf[raster([water_u], INNER, SURF_RES) > 0] = WATER
Image.fromarray(surf, 'L').save(f'{OUT}/surface.png', optimize=True)
print(' classes', np.bincount(surf.ravel(), minlength=5))

# ---------------------------------------------------------------- trees
print('trees')
trees = []
tb = (E0 - OUTER, N0 - OUTER, E0 + OUTER, N0 + OUTER)
for f in glob.glob(f'{SRC}/vegetatsioon-*.gpkg'):
    with fiona.open(f, layer='yksikpuud_keskpunkt') as src:
        for ft in src.filter(bbox=tb):
            x, y = ft['geometry']['coordinates'][:2]
            p = ft['properties']
            trees.append((x, y, float(p['korgus'] or 8), float(p['puukroon'] or 4),
                          1 if p['puutyyp'] == 'Okaspuu' else 0, int(p['puu_id'])))
# de-duplicate across the two municipality files
seen, uniq = set(), []
for t in trees:
    if t[5] not in seen:
        seen.add(t[5])
        uniq.append(t)
trees = uniq
tx = np.array([t[0] for t in trees]); ty = np.array([t[1] for t in trees])
th = np.array([t[2] for t in trees]); tc = np.array([t[3] for t in trees])
tk = np.array([t[4] for t in trees])
far = (np.abs(tx - E0) > INNER + 250) | (np.abs(ty - N0) > INNER + 250)
keep = (~far) | (th > 14)          # far away only the tall ones matter for the skyline
# no trees standing in the water or on paved roads
print(' total', len(trees), 'kept', int(keep.sum()), 'inner', int((~far).sum()))
tx, ty, th, tc, tk = tx[keep], ty[keep], th[keep], tc[keep], tk[keep]
# ground height under each tree
w_o = rasterio.windows.from_bounds(E0 - OUTER - 16, N0 - OUTER - 16, E0 + OUTER + 16, N0 + OUTER + 16, dtm.transform)
col = np.clip((tx - (E0 - OUTER - 16)).astype(int), 0, d_out.shape[1] - 1)
row = np.clip(((N0 + OUTER + 16) - ty).astype(int), 0, d_out.shape[0] - 1)
tg = d_out[row, col]
rec = np.zeros(len(tx), dtype=[('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('h', '<f4'), ('c', '<f4'), ('k', '<f4')])
rec['x'] = tx - E0; rec['z'] = -(ty - N0); rec['y'] = tg - H0
rec['h'] = th; rec['c'] = np.clip(tc, 1.5, 16); rec['k'] = tk
rec.tofile(f'{OUT}/trees.bin')

# ---------------------------------------------------------------- buildings
print('buildings')
ov_img = Image.open(f'{OUT}/ortho/overview.jpg').convert('RGB')
ov_np = np.asarray(ov_img).astype('float32')


def ortho_colour(poly):
    """Median overview colour inside a footprint (roof colour)."""
    minx, miny, maxx, maxy = poly.bounds
    s = OVERVIEW_PX / (2 * OUTER)
    c0 = int((minx - (E0 - OUTER)) * s); c1 = int((maxx - (E0 - OUTER)) * s) + 1
    r0 = int(((N0 + OUTER) - maxy) * s); r1 = int(((N0 + OUTER) - miny) * s) + 1
    patch = ov_np[max(r0, 0):max(r1, 1), max(c0, 0):max(c1, 1)]
    if patch.size == 0:
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


keep_box = (E0 - INNER - 450, N0 - INNER - 450, E0 + INNER + 450, N0 + INNER + 450)
WALLS = [(236, 234, 228), (222, 218, 208), (200, 198, 196), (168, 160, 150), (120, 96, 78),
         (90, 92, 98), (232, 222, 196), (190, 170, 150), (245, 245, 245), (150, 110, 90)]
tri_pos, tri_nrm, tri_col, tri_kind, tri_base = [], [], [], [], []
n_b = 0


def add_mesh(V, tris, wall_rgb, roof_rgb, extend=2.0, slab=None):
    """V: (n,3) world E,N,H. Emits flat-shaded triangles in game coordinates."""
    global n_b
    V = V.copy()
    zmin, zmax = V[:, 2].min(), V[:, 2].max()
    area = (V[:, 0].max() - V[:, 0].min()) * (V[:, 1].max() - V[:, 1].min())
    windows = slab is None and extend >= 2.0 and (zmax - zmin) > 3.3 and area > 45
    if slab is not None:                       # keep only a thin roof slab
        V[:, 2] = np.maximum(V[:, 2], zmax - slab)
    else:
        V[V[:, 2] < zmin + 0.05, 2] -= extend  # push the base into the ground
    P = np.stack([V[:, 0] - E0, V[:, 2] - H0, -(V[:, 1] - N0)], 1)
    for a, b, c in tris:
        pa, pb, pc = P[a], P[b], P[c]
        n = np.cross(pb - pa, pc - pa)
        l = np.linalg.norm(n)
        if l < 1e-9:
            continue
        n /= l
        # E,N,H -> x,y,z flips handedness: swap winding
        n = -n
        if n[1] < -0.7 and slab is None:
            continue                            # drop floors
        roof = n[1] > 0.25
        tri_pos.append((pa, pc, pb)); tri_nrm.append(n)
        tri_col.append(roof_rgb if roof else wall_rgb); tri_kind.append(1 if roof else (2 if windows else 0))
        tri_base.append(zmin - H0)
    n_b += 1


fp_by_centroid = [(g, p) for p, g in feats('E_401_hoone_ka')]
for name in ('Tartu_linn', 'Tartu_vald'):
    V, groups = load_obj(f'{SRC}/hooned_lod2-{name}.obj')
    for mtl, tris in groups.items():
        if not tris:
            continue
        ids = np.unique(np.array(tris).ravel())
        bv = V[ids]
        cx, cy = bv[:, 0].mean(), bv[:, 1].mean()
        if not (keep_box[0] < cx < keep_box[2] and keep_box[1] < cy < keep_box[3]):
            continue
        remap = {int(i): k for k, i in enumerate(ids)}
        t2 = [(remap[a], remap[b], remap[c]) for a, b, c in tris]
        hull = box(bv[:, 0].min(), bv[:, 1].min(), bv[:, 0].max(), bv[:, 1].max())
        roof = ortho_colour(hull)
        hsh = (int(cx * 7) ^ int(cy * 13)) % len(WALLS)
        add_mesh(bv, t2, WALLS[hsh], roof)
print(' lod2 buildings', n_b)
n_house = n_b
post_boxes = []
for name in ('Tartu_linn', 'Tartu_vald'):
    V, groups = load_obj(f'{SRC}/katusealused_lod1-{name}.obj')
    for mtl, tris in groups.items():
        if not tris:
            continue
        ids = np.unique(np.array(tris).ravel())
        bv = V[ids]
        cx, cy = bv[:, 0].mean(), bv[:, 1].mean()
        if not (keep_box[0] < cx < keep_box[2] and keep_box[1] < cy < keep_box[3]):
            continue
        remap = {int(i): k for k, i in enumerate(ids)}
        t2 = [(remap[a], remap[b], remap[c]) for a, b, c in tris]
        add_mesh(bv, t2, (70, 70, 74), (70, 70, 74), slab=0.22)
        # corner posts
        zmin, zmax = bv[:, 2].min(), bv[:, 2].max()
        from shapely.geometry import MultiPoint
        rect = MultiPoint([(x, y) for x, y, _ in bv]).minimum_rotated_rectangle
        if rect.geom_type != 'Polygon':
            continue
        ctr = rect.centroid
        for x, y in list(rect.exterior.coords)[:4]:
            # pull the post slightly inside
            x += (ctr.x - x) * 0.06; y += (ctr.y - y) * 0.06
            s = 0.07
            pv = np.array([[x - s, y - s, zmin], [x + s, y - s, zmin], [x + s, y + s, zmin], [x - s, y + s, zmin],
                           [x - s, y - s, zmax - 0.2], [x + s, y - s, zmax - 0.2], [x + s, y + s, zmax - 0.2], [x - s, y + s, zmax - 0.2]])
            pt = [(0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
            add_mesh(pv, pt, (60, 60, 64), (60, 60, 64), extend=1.0)
            n_b -= 1
print(' roofed areas', n_b - n_house)

pos = np.array(tri_pos, 'float32').reshape(-1, 3)
nrm = np.repeat(np.array(tri_nrm, 'float32'), 3, 0)
colr = np.repeat(np.array(tri_col, 'float32'), 3, 0)
kind = np.repeat(np.array(tri_kind, 'uint8'), 3, 0)
base = np.clip(np.round(np.repeat(np.array(tri_base, 'float32'), 3, 0) / 0.01), -32767, 32767).astype('<i2')
nv = len(pos)
pq = np.zeros((nv, 3), '<i2')
pq[:, 0] = np.clip(np.round(pos[:, 0] / 0.05), -32767, 32767)
pq[:, 1] = np.clip(np.round(pos[:, 1] / 0.01), -32767, 32767)
pq[:, 2] = np.clip(np.round(pos[:, 2] / 0.05), -32767, 32767)
nq = np.clip(np.round(nrm * 127), -127, 127).astype('i1')
cq = np.clip(colr, 0, 255).astype('u1')
with open(f'{OUT}/buildings.bin', 'wb') as fh:
    fh.write(struct.pack('<I', nv))
    fh.write(pq.tobytes()); fh.write(nq.tobytes()); fh.write(cq.tobytes()); fh.write(kind.tobytes()); fh.write(base.tobytes())
print(' triangles', nv // 3)

# ---------------------------------------------------------------- obstacle distance field
print('sdf')
solid = [g for p, g in feats('E_401_hoone_ka', inner_box.buffer(20)) if p.get('tyyp_t') != 'Vundament']
fences = [g.buffer(0.12) for p, g in feats('E_405_piire_j', inner_box.buffer(20))]
fine = 0.25
n_f = int(2 * INNER / fine)
occ = raster(solid + fences, INNER, fine, all_touched=True)
# tree trunks
tr_f = from_origin(E0 - INNER, N0 + INNER, fine, fine)
m_in = (np.abs(tx - E0) < INNER) & (np.abs(ty - N0) < INNER)
trunks = [Point(x, y).buffer(min(0.45, max(0.14, 0.035 * h)), 6) for x, y, h in zip(tx[m_in], ty[m_in], th[m_in])]
# trees on roads/paved surfaces are canopy overhang artefacts: skip those trunks
surf_big = np.kron(surf, np.ones((4, 4), 'uint8'))
occ_t = raster(trunks, INNER, fine, all_touched=True)
occ_t[(surf_big == PAVED) | (surf_big == GRAVEL) | (surf_big == WATER)] = 0
occ = (occ > 0) | (occ_t > 0)
d_out_ = ndimage.distance_transform_edt(~occ) * fine
d_in_ = ndimage.distance_transform_edt(occ) * fine
sd = d_out_ - d_in_
sd = sd.reshape(n_f // 2, 2, n_f // 2, 2).mean((1, 3))     # -> 0.5 m
# 8-bit: -4 m .. +12 m
sdq = np.clip(np.round((sd + 4.0) / 16.0 * 255), 0, 255).astype('uint8')
Image.fromarray(sdq, 'L').save(f'{OUT}/sdf.png', optimize=True)
print(' sdf', sdq.shape, 'solid frac', float(occ.mean()))

# ---------------------------------------------------------------- vectors + meta
print('meta')


def rings(g):
    out = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type != 'Polygon' or p.is_empty:
            continue
        p = p.simplify(0.5)
        out.append({
            'outer': [[round(x - E0, 1), round(-(y - N0), 1)] for x, y, *_ in p.exterior.coords],
            'holes': [[[round(x - E0, 1), round(-(y - N0), 1)] for x, y, *_ in r.coords] for r in p.interiors],
        })
    return out


water = []
for g in river:
    water.append({'level': round(river_level - H0, 2), 'river': True, 'polys': rings(g.intersection(outer_box))})
for g in ponds:
    if not g.intersects(inner_box.buffer(300)):
        continue
    c = g.representative_point()
    r_, c_ = dtm.index(c.x, c.y)
    lvl = float(dtm.read(1, window=rasterio.windows.Window(c_, r_, 1, 1))[0, 0])
    water.append({'level': round(lvl - H0, 2), 'river': False, 'polys': rings(g)})

r_, c_ = dtm.index(START_E, START_N)
meta = {
    'origin': {'e': E0, 'n': N0, 'h': H0, 'crs': 'EPSG:3301'},
    'inner': INNER, 'outer': OUTER,
    'height': {'res': HM_RES, 'n': int(hm.shape[0]), 'outerRes': HM_OUTER_RES, 'outerN': int(ho.shape[0]),
               'scale': Q, 'offset': -100.0},
    'surface': {'res': SURF_RES, 'n': n_s, 'classes': ['grass', 'paved', 'gravel', 'dirt', 'water']},
    'sdf': {'res': SDF_RES, 'n': int(sdq.shape[0]), 'min': -4.0, 'max': 12.0},
    'ortho': {'tile': TILE, 'n': int(2 * INNER / TILE), 'px': TILE_PX},
    'trees': int(len(rec)),
    'riverLevel': round(river_level - H0, 2),
    'start': {'x': START_E - E0, 'z': -(START_N - N0), 'heading': 0.0},
    'attribution': 'Ortofoto, kõrgusmudel, ETAK, hoonete 3D mudel ja üksikpuud: Maa- ja Ruumiamet 2026',
}
json.dump(meta, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False)
json.dump({'water': water, 'roads': road_lines}, open(f'{OUT}/vectors.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    if os.path.isfile(p):
        print(f'  {f:22s} {os.path.getsize(p) / 1e6:.2f} MB')
