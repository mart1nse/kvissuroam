#!/usr/bin/env python3
"""Real wall colours for the buildings, sampled from Mapillary street photos.

Usage:  python3 tools/realism/colours.py IMAGES.jsonl WORKDIR [--sheet N]

IMAGES.jsonl comes from list_images.py. For every building wall that a photo sees squarely and with
nothing built in between, the part of the wall above car and hedge height is projected into the photo
(256 px thumbnails are enough) and the dominant colour there is taken; photos from different drives are
combined. Buildings no photo sees borrow the colour of a similar building nearby, so a street keeps its
look. Writes public/data/walls.json: per sector a flat list of
  base (the building's base height as stored in the sector file), x, z (centre, decimetres in the sector),
  colour 0xRRGGBB (+ 0x1000000 when it was really sampled from photos).
Photos (c) Mapillary contributors, CC BY-SA.
"""
import io, json, math, os, pickle, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from scipy.spatial import cKDTree
from pyproj import Transformer
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world

E0, N0 = world.META['origin']['e'], world.META['origin']['n']
S, G0 = world.S, world.G0
T = Transformer.from_crs(4326, 3301, always_xy=True)
CAM_H = 1.5          # assumed camera height above the ground
MAX_D = 42.0
PER_BUILDING = 5
CELL = 16.0


def rodrigues(r):
    r = np.asarray(r, float); th = np.linalg.norm(r)
    if th < 1e-9: return np.eye(3)
    k = r / th
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K


def load_images(path):
    """-> dict of arrays; only photos with a reconstructed pose."""
    rows = []
    for line in open(path):
        r = json.loads(line)
        if not r[3] or not r[7] or not r[11]: continue
        rows.append(r)
    lon = np.array([r[1] for r in rows]); lat = np.array([r[2] for r in rows])
    E, N = T.transform(lon, lat)
    E2, N2 = T.transform(lon, lat + 1e-4)
    g = np.arctan2(E2 - E, N2 - N)                       # bearing of true north in the grid
    R = np.zeros((len(rows), 3, 3))
    for i, r in enumerate(rows):
        Rw = rodrigues(r[7])                             # world (east, north, up) -> camera
        cg, sg = math.cos(g[i]), math.sin(g[i])
        e, n, u = Rw[:, 0], Rw[:, 1], Rw[:, 2]
        R[i] = np.stack([e * cg + n * sg, u, -(-e * sg + n * cg)], 1)     # columns: game x, y, z
    cp = np.array([(r[6] or [0.85, 0, 0])[:3] for r in rows], float)
    return dict(id=[r[0] for r in rows], x=E - E0, z=N0 - N, R=R, f=cp[:, 0], k1=cp[:, 1], k2=cp[:, 2],
                fish=np.array([r[5] == 'fisheye' for r in rows]), sph=np.array([r[5] in ('spherical', 'equirectangular') for r in rows]),
                aspect=np.array([r[11] / r[12] for r in rows]), seq=[r[9] for r in rows],
                t=np.array([r[8] or 0 for r in rows], float), url=[r[10] for r in rows])


def project(P, R, f, k1, k2, fish, aspect):
    """World points (n,3) -> (u, v) in 0..1 (v down) and a mask of points in front of the camera."""
    p = P @ R.T
    ok = p[:, 2] > 0.3
    z = np.where(ok, p[:, 2], 1.0)
    if fish:
        l = np.maximum(np.hypot(p[:, 0], p[:, 1]), 1e-6); th = np.arctan2(l, z); t2 = th * th
        s = th * (1 + t2 * (k1 + k2 * t2)) / l
        nx, ny = p[:, 0] * s, p[:, 1] * s
    else:
        nx, ny = p[:, 0] / z, p[:, 1] / z
        r2 = nx * nx + ny * ny
        ok &= r2 < 3
        d = 1 + r2 * (k1 + k2 * r2)
        nx, ny = nx * d, ny * d
    return nx * f + 0.5, ny * f * aspect + 0.5, ok


class Ground:
    def __init__(self, heights): self.h = heights; self.res = world.META['height']['res']
    def __call__(self, x, z):
        sx, sz = int((x - G0) // S), int((z - G0) // S)
        H = self.h.get((sx, sz))
        if H is None: return None
        i = min(H.shape[1] - 1, int((x - G0 - sx * S) / self.res)); j = min(H.shape[0] - 1, int((z - G0 - sz * S) / self.res))
        return float(H[j, i])


def blocked(cx, cz, px, pz, segs):
    """Is the sight line camera -> point cut by any wall segment? Arrays (n,) against segs (m,4) -> (n,)."""
    if not len(segs): return np.zeros(len(px), bool)
    dx, dz = (px - cx) * 0.97, (pz - cz) * 0.97
    ax, az = segs[:, 0][None], segs[:, 1][None]
    ex, ez = (segs[:, 2] - segs[:, 0])[None], (segs[:, 3] - segs[:, 1])[None]
    den = dx[:, None] * ez - dz[:, None] * ex
    den = np.where(np.abs(den) < 1e-9, 1e-9, den)
    qx, qz = ax - np.asarray(cx).reshape(-1, 1), az - np.asarray(cz).reshape(-1, 1)
    t = (qx * ez - qz * ex) / den
    s = (qx * dz[:, None] - qz * dx[:, None]) / den
    return ((t > 0.0) & (t < 1.0) & (s > 0.0) & (s < 1.0)).any(1)


def select(B, heights, im):
    """For each building the photos to look at: list of (image index, wall index, score)."""
    ground = Ground(heights)
    tree = cKDTree(np.c_[im['x'], im['z']])
    # all walls in a grid, for sight lines
    allw = np.concatenate([b['walls'][:, :4] for b in B])
    grid = {}
    mx, mz = (allw[:, 0] + allw[:, 2]) / 2, (allw[:, 1] + allw[:, 3]) / 2
    ln = np.hypot(allw[:, 2] - allw[:, 0], allw[:, 3] - allw[:, 1])
    for i in np.flatnonzero(ln > 1.0):
        n = max(1, int(ln[i] / CELL) + 1)
        for k in range(n + 1):
            c = (int((allw[i, 0] + (allw[i, 2] - allw[i, 0]) * k / n) // CELL), int((allw[i, 1] + (allw[i, 3] - allw[i, 1]) * k / n) // CELL))
            grid.setdefault(c, set()).add(i)
    picks = []
    for bi, b in enumerate(B):
        W = b['walls']
        L = np.hypot(W[:, 2] - W[:, 0], W[:, 3] - W[:, 1])
        order = [i for i in np.argsort(-L) if L[i] >= 3.0][:8]
        cand = {}
        if order:
            near = set()
            for cx_ in range(int((b['x0'] - MAX_D) // CELL), int((b['x1'] + MAX_D) // CELL) + 1):
                for cz_ in range(int((b['z0'] - MAX_D) // CELL), int((b['z1'] + MAX_D) // CELL) + 1):
                    near |= grid.get((cx_, cz_), set())
            segs = allw[sorted(near)]
        for wi in order:
            x1, z1, x2, z2, nx, nz, top = W[wi]
            mxw, mzw = (x1 + x2) / 2, (z1 + z2) / 2
            idx = np.array(tree.query_ball_point([mxw, mzw], MAX_D), int)
            if not len(idx): continue
            cx, cz = im['x'][idx], im['z'][idx]
            dxm, dzm = cx - mxw, cz - mzw
            dist = np.hypot(dxm, dzm)
            cosi = (dxm * nx + dzm * nz) / np.maximum(dist, 1e-6)
            keep = (dist > 5.0) & (cosi > 0.3) & ~im['sph'][idx]
            idx, dist, cosi = idx[keep], dist[keep], cosi[keep]
            if not len(idx): continue
            gy = ground(mxw, mzw)
            if gy is None: continue
            topy = b['base'] + top
            y = min(topy - 0.4, gy + max(1.7, 0.5 * (topy - gy)))
            # not the wall itself
            others = segs[~((np.abs(segs[:, 0] - x1) < 0.06) & (np.abs(segs[:, 1] - z1) < 0.06) & (np.abs(segs[:, 2] - x2) < 0.06) & (np.abs(segs[:, 3] - z2) < 0.06)) &
                          ~((np.abs(segs[:, 0] - x2) < 0.06) & (np.abs(segs[:, 1] - z2) < 0.06) & (np.abs(segs[:, 2] - x1) < 0.06) & (np.abs(segs[:, 3] - z1) < 0.06))]
            for k, i in enumerate(idx):
                gc = ground(im['x'][i], im['z'][i])
                if gc is None: continue
                C = np.array([im['x'][i], gc + CAM_H, im['z'][i]])
                fr = np.array([0.15, 0.5, 0.85])
                P = np.stack([x1 + (x2 - x1) * fr, np.full(3, y), z1 + (z2 - z1) * fr], 1)
                u, v, ok = project(P - C, im['R'][i], im['f'][i], im['k1'][i], im['k2'][i], im['fish'][i], im['aspect'][i])
                ok &= (u > 0.04) & (u < 0.96) & (v > 0.05) & (v < 0.8)
                if ok.sum() < 2: continue
                ok &= ~blocked(np.full(3, C[0]), np.full(3, C[2]), P[:, 0], P[:, 2], others)
                if ok.sum() < 2: continue
                score = ok.sum() * cosi[k] * min(1.0, 16.0 / dist[k]) * min(1.0, L[wi] / 8.0) * (1.0 if im['t'][i] > 1.56e12 else 0.8)
                if score > cand.get(i, (0, 0))[0]: cand[i] = (score, wi)
        chosen, seqs = [], {}
        for i, (score, wi) in sorted(cand.items(), key=lambda kv: -kv[1][0]):
            s = im['seq'][i]
            if seqs.get(s, 0) >= (1 if len(chosen) < PER_BUILDING - 1 else 2): continue
            seqs[s] = seqs.get(s, 0) + 1
            chosen.append((int(i), int(wi), float(score)))
            if len(chosen) >= PER_BUILDING: break
        picks.append(chosen)
        if bi % 2000 == 0: print('select', bi, len(B), flush=True)
    return picks


def download(im, need, folder):
    os.makedirs(folder, exist_ok=True)
    def one(i):
        p = os.path.join(folder, im['id'][i] + '.jpg')
        if os.path.exists(p): return
        for k in range(3):
            try:
                with urllib.request.urlopen(im['url'][i], timeout=40) as r: data = r.read()
                open(p, 'wb').write(data); return
            except Exception:
                pass
    with ThreadPoolExecutor(24) as ex: list(ex.map(one, need))


def to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def to_rgb(lab):
    fy = (lab[:, 0] + 16) / 116; fx = fy + lab[:, 1] / 500; fz = fy - lab[:, 2] / 200
    f = np.stack([fx, fy, fz], 1)
    xyz = np.where(f > 0.2069, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.9505, 1.0, 1.089])
    M = np.linalg.inv(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]))
    c = np.clip(xyz @ M.T, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.round(c * 255), 0, 255).astype(int)


def dominant(lab):
    """Dominant colour of a pixel set: the fullest 10-unit Lab bin and its neighbourhood. -> (lab, share)"""
    q = np.floor(lab / 10).astype(int)
    keys, inv, cnt = np.unique(q, axis=0, return_inverse=True, return_counts=True)
    k = keys[cnt.argmax()]
    m = (np.abs(q - k) <= 1).all(1)
    return np.median(lab[m], 0), m.mean()


def wall_pixels(b, wi, i, im, ground, img, segs=None):
    """Pixels of wall wi of building b in photo i (as an array), above car and hedge height. -> (rgb (n,3), uv)"""
    x1, z1, x2, z2, nx, nz, top = b['walls'][wi]
    L = math.hypot(x2 - x1, z2 - z1)
    gy = ground((x1 + x2) / 2, (z1 + z2) / 2); gc = ground(im['x'][i], im['z'][i])
    topy = b['base'] + top
    lo = gy + max(1.5, 0.3 * (topy - gy)); hi = topy - 0.35
    if hi - lo < 0.3: lo = hi - 0.3
    na = max(4, int(L / 0.35)); nh = max(3, int((hi - lo) / 0.3))
    fr = np.linspace(0.08, 0.92, na); hs = np.linspace(lo, hi, nh)
    F, Hh = np.meshgrid(fr, hs)
    P = np.stack([x1 + (x2 - x1) * F.ravel(), Hh.ravel(), z1 + (z2 - z1) * F.ravel()], 1)
    C = np.array([im['x'][i], gc + CAM_H, im['z'][i]])
    u, v, ok = project(P - C, im['R'][i], im['f'][i], im['k1'][i], im['k2'][i], im['fish'][i], im['aspect'][i])
    ok &= (u > 0.02) & (u < 0.98) & (v > 0.03) & (v < 0.85)
    if segs is not None and ok.any():
        ok &= ~blocked(np.full(len(P), C[0]), np.full(len(P), C[2]), P[:, 0], P[:, 2], segs)
    h, w = img.shape[:2]
    px = np.clip((u[ok] * w).astype(int), 0, w - 1); py = np.clip((v[ok] * h).astype(int), 0, h - 1)
    pix, first = np.unique(py * w + px, return_index=True)
    return img[py[first], px[first]].astype(float), (u[ok], v[ok])


def estimate(B, heights, im, picks, folder):
    ground = Ground(heights)
    out = {}
    cache, bright = {}, {}
    def load(i):
        if i not in cache:
            try: cache[i] = np.asarray(Image.open(os.path.join(folder, im['id'][i] + '.jpg')).convert('RGB'))
            except Exception: cache[i] = None
            if len(cache) > 3000: cache.pop(next(iter(cache)))
        return cache[i]
    for bi, (b, ch) in enumerate(zip(B, picks)):
        votes = []
        for i, wi, score in ch:
            img = load(i)
            if img is None: continue
            if i not in bright: bright[i] = float(np.median(img[: int(img.shape[0] * 0.8)].mean(2)))
            if bright[i] < 62: continue                                # night or dusk
            rgb, _ = wall_pixels(b, wi, i, im, ground, img)
            if len(rgb) < 60: continue                                 # the wall is too small in this photo
            lab = to_lab(rgb)
            # leaves, sky and deep shadow are not wall
            leaf = (lab[:, 1] < -7) & (lab[:, 2] > 6)
            sky = (lab[:, 0] > 70) & (lab[:, 2] < -8)
            dark = lab[:, 0] < 20
            good = lab[~(leaf | sky | dark)]
            if len(good) < 20 or len(good) < 0.4 * len(lab): continue
            d, share = dominant(good)
            share *= len(good) / len(lab)
            if share < 0.25 or d[0] < 24: continue
            votes.append((d, share * score * min(1.0, len(rgb) / 120.0), share, len(rgb)))
        if not votes: continue
        labs = np.array([v[0] for v in votes]); w = np.array([v[1] for v in votes])
        # photos from different drives have to agree; one photo alone counts only when the wall fills it clearly
        near = np.linalg.norm(labs[:, None] - labs[None], axis=2) < 16
        k = int((near * w[None]).sum(1).argmax())
        m = near[k]
        if m.sum() < 2 and not (votes[k][2] > 0.45 and votes[k][3] >= 150): continue
        mean = (labs[m] * w[m, None]).sum(0) / w[m].sum()
        mean[0] = max(mean[0], 40.0)                 # walls in shade read too dark
        out[bi] = (mean, float(w[m].sum()), int(m.sum()))
    return out


def main():
    images, work = sys.argv[1], sys.argv[2]
    os.makedirs(work, exist_ok=True)
    bp = os.path.join(work, 'buildings.pkl')
    if os.path.exists(bp): B, heights = pickle.load(open(bp, 'rb'))
    else:
        B, heights = world.all_buildings(); pickle.dump((B, heights), open(bp, 'wb'))
    im = load_images(images)
    print(len(B), 'buildings,', len(im['id']), 'photos with a pose', flush=True)
    sp = os.path.join(work, 'picks.pkl')
    if os.path.exists(sp): picks = pickle.load(open(sp, 'rb'))
    else:
        picks = select(B, heights, im); pickle.dump(picks, open(sp, 'wb'))
    need = sorted({i for ch in picks for i, _, _ in ch})
    print(sum(1 for ch in picks if ch), 'buildings seen by a photo,', len(need), 'photos needed', flush=True)
    download(im, need, os.path.join(work, 'thumbs'))
    est = estimate(B, heights, im, picks, os.path.join(work, 'thumbs'))
    print(len(est), 'buildings with a sampled colour', flush=True)
    pickle.dump(est, open(os.path.join(work, 'est.pkl'), 'wb'))
    write(B, est)


def write(B, est):
    # borrow for the rest: one of the nearest sampled buildings of the same kind
    xy = np.array([[(b['x0'] + b['x1']) / 2, (b['z0'] + b['z1']) / 2] for b in B])
    lab = {bi: v[0] for bi, v in est.items()}
    out, n_real, n_borrow = {}, 0, 0
    trees = {}
    for st in (0, 1, 2):
        ids = np.array([bi for bi in lab if B[bi]['style'] == st and B[bi]['area'] > 50], int)
        if len(ids): trees[st] = (cKDTree(xy[ids]), ids)
    anyids = np.array(sorted(lab), int)
    anytree = cKDTree(xy[anyids]) if len(anyids) else None
    for bi, b in enumerate(B):
        real = bi in lab
        c = None
        if real: c = lab[bi]
        elif b['area'] < 50 and anytree is not None:           # sheds and garages go with the house next to them
            d, j = anytree.query(xy[bi])
            if d < 40: c = lab[int(anyids[j])]
        if c is None and b['style'] in trees:
            tr, ids = trees[b['style']]
            d, j = tr.query(xy[bi], k=min(5, len(ids)))
            d, j = np.atleast_1d(d), np.atleast_1d(j)
            ok = j[d < 400]
            if len(ok): c = lab[int(ids[ok[(int(xy[bi][0] * 7) ^ int(xy[bi][1] * 13)) % len(ok)]])]
        if c is None: continue
        r, g, bl = to_rgb(np.array([c]))[0]
        n_real += real; n_borrow += not real
        out.setdefault(f"{b['sx']}_{b['sz']}", []).extend(
            [b['bq'], int(round(b['cx'] * 10)), int(round(b['cz'] * 10)), (int(r) << 16) | (int(g) << 8) | int(bl) | (0x1000000 if real else 0)])
    json.dump({'stride': 4, 'credit': 'Wall colours sampled from Mapillary street photos, CC BY-SA', 'sectors': out},
              open(os.path.join(world.DATA, 'walls.json'), 'w'), separators=(',', ':'))
    print(n_real, 'sampled,', n_borrow, 'borrowed,', len(B) - n_real - n_borrow, 'left as they were')


if __name__ == '__main__':
    main()
