"""Buildings (LOD2) and roofed areas (LOD1) from the Maa- ja Ruumiamet OBJ files.

The source meshes are closed solids, triangles wound counter-clockwise seen from outside
in (E, N, H). The game frame (x, y, z) = (E, H, -N) is a rotation of that, so winding and
normals carry over unchanged.
"""
import numpy as np
from shapely.geometry import MultiPoint

from config import E0, N0, H0, GRID0, SECTOR

WALLS = [(236, 234, 228), (222, 218, 208), (200, 198, 196), (168, 160, 150), (120, 96, 78),
         (90, 92, 98), (232, 222, 196), (190, 170, 150), (245, 245, 245), (150, 110, 90)]
CARPORT = (70, 70, 74)
POST = (60, 60, 64)


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


def sector_of(e, n_):
    return (int((e - E0 - GRID0) // SECTOR), int((N0 - n_ - GRID0) // SECTOR))


def emit(bsec, key, V, tris, wall_rgb, roof_rgb, extend=2.0, slab=None):
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
    n = np.cross(pb - pa, pc - pa)             # outward
    l = np.linalg.norm(n, axis=1)
    ok = l > 1e-9
    n = n / np.maximum(l, 1e-12)[:, None]
    if slab is None:
        ok &= n[:, 1] >= -0.7                  # drop floors
    roof = n[:, 1] > 0.25
    col = np.where(roof[:, None], np.array(roof_rgb, 'float32'), np.array(wall_rgb, 'float32'))
    kind = np.where(roof, 1, 2 if windows else 0)
    pos = np.stack([pa, pb, pc], 1)
    m = int(ok.sum())
    bsec.setdefault(key, []).append((pos[ok], n[ok], col[ok], kind[ok], np.full(m, zmin - H0)))


def build(src, secset, roof_colour):
    """Returns ({sector: [parts]}, number of buildings, number of roofed areas).

    roof_colour(V, tris) -> (r, g, b) for one building; V is (n,3) E,N,H.
    """
    bsec = {}          # sector -> list of (pos(m,3,3), nrm(m,3), col(m,3), kind(m), base(m))
    n_b = n_c = 0
    for name in ('Tartu_linn', 'Tartu_vald'):
        V, groups = load_obj(f'{src}/hooned_lod2-{name}.obj')
        for mtl, tris in groups.items():
            if not tris:
                continue
            t = np.array(tris)
            ids = np.unique(t)
            bv = V[ids]
            key = sector_of(bv[:, 0].mean(), bv[:, 1].mean())
            if key not in secset:
                continue
            t2 = np.searchsorted(ids, t)
            cx, cy = bv[:, 0].mean(), bv[:, 1].mean()
            emit(bsec, key, bv, t2, WALLS[(int(cx * 7) ^ int(cy * 13)) % len(WALLS)], roof_colour(bv, t2))
            n_b += 1
        del V, groups
        V, groups = load_obj(f'{src}/katusealused_lod1-{name}.obj')
        for mtl, tris in groups.items():
            if not tris:
                continue
            t = np.array(tris)
            ids = np.unique(t)
            bv = V[ids]
            key = sector_of(bv[:, 0].mean(), bv[:, 1].mean())
            if key not in secset:
                continue
            emit(bsec, key, bv, np.searchsorted(ids, t), CARPORT, CARPORT, slab=0.22)
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
                emit(bsec, key, pv, pt, POST, POST, extend=1.0)
        del V, groups
    return bsec, n_b, n_c


def pack(bsec, key, sx0, sz0):
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
