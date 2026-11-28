"""Reads the baked sector files back: buildings as wall segments, and the ground height."""
import gzip, json, os
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CITY = os.environ.get('CITY', 'tartu')          # Tallinn (28 Nov 2026): CITY=tallinn reads public/data/tln/
DATA = os.path.join(ROOT, 'public', 'data', *(['tln'] if CITY == 'tallinn' else []))
META = json.load(open(os.path.join(DATA, 'meta.json')))
S, G0 = META['sector']['size'], META['sector']['grid0']
CARPORT = (70, 70, 74)


def read_sector(sx, sz):
    raw = open(os.path.join(DATA, 'sec', f'{sx}_{sz}.kvs'), 'rb').read()
    if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
    head = np.frombuffer(raw, '<u4', 8)
    nv = int(head[4])
    hn, sn, dn = META['height']['n'], META['surface']['n'], META['sdf']['n']
    o = 32
    H = np.frombuffer(raw, '<u2', hn * hn, o).reshape(hn, hn) * META['height']['scale'] + META['height']['offset']
    o += hn * hn * 2 + sn * sn + dn * dn
    pq = np.frombuffer(raw, '<i2', nv * 3, o).reshape(nv, 3); o += nv * 6
    nq = np.frombuffer(raw, 'i1', nv * 3, o).reshape(nv, 3); o += nv * 3
    cq = np.frombuffer(raw, 'u1', nv * 3, o).reshape(nv, 3); o += nv * 3
    kind = np.frombuffer(raw, 'u1', nv, o); o += nv
    base = np.frombuffer(raw, '<i2', nv, o)
    return H, pq, nq, cq, kind, base


def buildings(sx, sz):
    """Buildings of one sector, grouped the way the game groups them (by base height).

    Each: dict(sx, sz, cx, cz (bbox centre, sector-relative m), x0.. z1 world bbox, base, eaves, top (m, world y),
               style, walls: array (n, 6) of world x1, z1, x2, z2, nx, nz), area)
    """
    H, pq, nq, cq, kind, base = read_sector(sx, sz)
    x0s, z0s = G0 + sx * S, G0 + sz * S
    out = []
    if not len(base): return out, H
    P = np.stack([pq[:, 0] * 0.05, pq[:, 1] * 0.01, pq[:, 2] * 0.05], 1)
    def out_one(m, b):
        p, n, k, c = P[m], nq[m] / 127.0, kind[m], cq[m]
        wallm = k != 1
        if not wallm.any(): return
        if tuple(c[wallm][0]) == CARPORT or (k == 0).all() and (p[:, 0].max() - p[:, 0].min()) < 0.5: return
        by = b * 0.01
        top = p[:, 1].max()
        roofy = p[k == 1][:, 1]
        eaves = min(top - by, (roofy.min() - by) if len(roofy) else top - by)
        bx0, bx1, bz0, bz1 = p[:, 0].min(), p[:, 0].max(), p[:, 2].min(), p[:, 2].max()
        area = (bx1 - bx0) * (bz1 - bz0)
        h = top - by
        style = 1 if h >= 10.5 else 2 if area > 420 else 0
        # wall triangles -> horizontal segments
        tri = p[wallm].reshape(-1, 3, 3); tn = n[wallm].reshape(-1, 3, 3)[:, 0]
        vert = np.abs(tn[:, 1]) < 0.35
        segs = {}
        for t, nn in zip(tri[vert], tn[vert]):
            xs = t[:, [0, 2]]
            d = np.linalg.norm(xs[:, None] - xs[None], axis=2)
            i, j = np.unravel_index(d.argmax(), d.shape)
            a, c2 = xs[i], xs[j]
            if d[i, j] < 0.3: return
            l = np.hypot(nn[0], nn[2])
            key = (round(float(min(a[0], c2[0])), 1), round(float(min(a[1], c2[1])), 1), round(float(max(a[0], c2[0])), 1), round(float(max(a[1], c2[1])), 1))
            segs[key] = (a[0] + x0s, a[1] + z0s, c2[0] + x0s, c2[1] + z0s, nn[0] / l, nn[2] / l, t[:, 1].max() - by)
        if not segs: return
        out.append(dict(sx=sx, sz=sz, cx=(bx0 + bx1) / 2, cz=(bz0 + bz1) / 2, x0=bx0 + x0s, x1=bx1 + x0s, z0=bz0 + z0s, z1=bz1 + z0s,
                        bq=int(b), base=by, eaves=max(float(eaves), 2.4), h=float(h), style=style, area=float(area),
                        windows=bool((k == 2).any()), walls=np.array(list(segs.values()))))

    # triangles that share a base height are one building for the game, but two buildings can share a
    # base by chance: split those by connectivity (triangles of one solid share corners)
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    for b in np.unique(base):
        m0 = np.flatnonzero(base == b)
        _, inv = np.unique(pq[m0], axis=0, return_inverse=True)
        inv = inv.reshape(-1, 3)
        g = coo_matrix((np.ones(len(inv) * 2), (np.r_[inv[:, 0], inv[:, 1]], np.r_[inv[:, 1], inv[:, 2]])), shape=(inv.max() + 1,) * 2)
        ncomp, lab = connected_components(g, directed=False)
        tl = lab[inv[:, 0]]
        for comp in range(ncomp):
            sel = np.repeat(tl == comp, 3)
            if sel.sum() < 12: continue
            out_one(m0[sel], b)
    return out, H


def all_buildings():
    out, heights = [], {}
    for sx, sz, _ in META['sector']['list']:
        if not os.path.exists(os.path.join(DATA, 'sec', f'{sx}_{sz}.kvs')): continue
        b, H = buildings(sx, sz)
        out += b; heights[(sx, sz)] = H
    return out, heights
