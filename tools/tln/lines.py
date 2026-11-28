#!/usr/bin/env python3
"""Road markings of Tallinn's centre, measured on the Land Board's orthophoto (28 Nov 2026).

Usage:  python3 tools/tln/lines.py CACHE_DIR [AREA.json]      -> public/data/tln/lines.json

Only measured here; nothing of the photo is copied into the game (Martin, 18 Nov 2026: copied ortho pixels
look worse than drawn lines). Every street of the map in the area is straightened: the photo is read across
the street every 0.25 m, 0.05 m apart, from kerb to kerb. White paint is a narrow bright ridge on the grey
tarmac: brighter than the street round it, grey, and no wider than 0.45 m across. Along each offset from the
street's middle the ridges make runs: long ones are solid lines, short ones in a steady rhythm dashes. A ridge
that stretches across most of the street at one place is a stop line or a crossing, and nothing along the street
is taken there. What is found is written as bars [x1, z1, x2, z2, width] (game metres), per map square, in
lines.json, and the streets looked at are listed with what was found on them (`seen`): a street whose photo was
clear and showed no paint really has none, and the game then draws none (src/world/tln/centre.js).

Photo: kaart.maaamet.ee WMS fotokaart, layer EESTIFOTO, asked at 0.1 m a pixel in squares of 64 m (cached).
"""
import io, json, math, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DATA = os.path.join(ROOT, 'public', 'data', 'tln')
E0, N0 = 548000.0, 6592000.0
S, G0 = 640.0, -800.0
RES = 0.1                      # m a pixel asked for
TILE = 64.0                    # m a cached square
WMS = ('https://kaart.maaamet.ee/wms/fotokaart?service=WMS&version=1.1.1&request=GetMap&layers=EESTIFOTO&styles='
       '&srs=EPSG:3301&format=image/jpeg')
CAR = {'Tänav', 'Põhimaantee', 'Kõrvalmaantee', 'Tugimaantee', 'Ramp või ühenduste', 'Muu tee'}
CACHE = sys.argv[1]
os.makedirs(CACHE, exist_ok=True)


def tile(i, j):
    path = f'{CACHE}/{i}_{j}.jpg'
    if not os.path.exists(path):
        x0, z0 = i * TILE, j * TILE
        n = int(TILE / RES)
        url = f'{WMS}&bbox={E0 + x0},{N0 - z0 - TILE},{E0 + x0 + TILE},{N0 - z0}&width={n}&height={n}'
        for k in range(6):
            try:
                data = urllib.request.urlopen(url, timeout=120).read()
                Image.open(io.BytesIO(data)).convert('RGB').save(path, quality=92)
                break
            except Exception as ex:          # noqa
                time.sleep(2 + 3 * k)
        else:
            return None
    return path


_cache = {}


def img(i, j):
    k = (i, j)
    if k not in _cache:
        if len(_cache) > 400: _cache.clear()
        p = tile(i, j)
        _cache[k] = np.asarray(Image.open(p), dtype=np.float32) if p else None
    return _cache[k]


def sample(xs, zs):
    """RGB at game points (bilinear), NaN where no photo."""
    out = np.full((len(xs), 3), np.nan, np.float32)
    ti = np.floor(xs / TILE).astype(int); tj = np.floor(zs / TILE).astype(int)
    for (i, j) in set(zip(ti.tolist(), tj.tolist())):
        m = (ti == i) & (tj == j)
        a = img(i, j)
        if a is None: continue
        u = (xs[m] - i * TILE) / RES - 0.5; v = (zs[m] - j * TILE) / RES - 0.5
        n = a.shape[0]
        u = np.clip(u, 0, n - 1.001); v = np.clip(v, 0, n - 1.001)
        u0 = u.astype(int); v0 = v.astype(int); fu = (u - u0)[:, None]; fv = (v - v0)[:, None]
        out[m] = (a[v0, u0] * (1 - fu) * (1 - fv) + a[v0, u0 + 1] * fu * (1 - fv) + a[v0 + 1, u0] * (1 - fu) * fv + a[v0 + 1, u0 + 1] * fu * fv)
    return out


def walk(pts, step):
    """Points every `step` m along a polyline, with unit tangents."""
    P = np.array(pts, float)
    seg = np.diff(P, axis=0); L = np.hypot(seg[:, 0], seg[:, 1]); cum = np.concatenate([[0], np.cumsum(L)])
    s = np.arange(0, cum[-1], step)
    k = np.clip(np.searchsorted(cum, s, 'right') - 1, 0, len(L) - 1)
    t = (s - cum[k]) / np.maximum(L[k], 1e-9)
    xy = P[k] + seg[k] * t[:, None]
    tan = seg[k] / np.maximum(L[k], 1e-9)[:, None]
    return s, xy, tan


DS, DO = 0.25, 0.05


def measure(r):
    w = r['w']
    s, xy, tan = walk(r['pts'], DS)
    if len(s) < 16: return None
    half = w / 2 - 0.15
    offs = np.arange(-half, half + 1e-6, DO)
    nrm = np.stack([-tan[:, 1], tan[:, 0]], 1)            # left of the direction of travel (x, z frame)
    X = xy[:, 0, None] + nrm[:, 0, None] * offs[None]
    Z = xy[:, 1, None] + nrm[:, 1, None] * offs[None]
    rgb = sample(X.ravel(), Z.ravel()).reshape(len(s), len(offs), 3)
    lum = rgb.mean(2); sat = (np.nanmax(rgb, 2) - np.nanmin(rgb, 2)) / np.maximum(np.nanmax(rgb, 2), 1)
    # the street round each point: a running median over 3 m across and 2 m along
    base = ndimage.median_filter(np.nan_to_num(lum, nan=0), size=(9, 41), mode='nearest')
    ridge = lum - ndimage.grey_opening(np.nan_to_num(lum, nan=0), size=(1, 11))       # bright and under 0.5 m wide
    paint = (ridge > 28) & (lum > base + 30) & (sat < 0.22) & (lum > 150)
    paint = ndimage.binary_opening(paint, structure=np.ones((2, 1)))                  # (at least 0.5 m long)
    # clear: not in deep shadow and not under trees (green), where nothing could be seen
    green = (rgb[..., 1] > rgb[..., 0] + 6) & (rgb[..., 1] > rgb[..., 2] + 6)
    clear = (base > 70) & ~green & ~np.isnan(lum)
    # across the street at one place (stop lines, crossings): not taken as lines
    acrossf = paint.mean(1)
    across = ndimage.binary_dilation(acrossf > 0.35, iterations=6)
    raw = paint.copy()
    paint[across] = False
    return s, xy, nrm, offs, paint, clear, raw, acrossf


def runs(mask):
    """(start, end) index pairs of True runs."""
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    return list(zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]))


def lines_of(r):
    m = measure(r)
    if m is None: return None
    s, xy, nrm, offs, paint, clear, raw, acrossf = m
    n = len(s)
    w_half = r['w'] / 2
    clear_frac = clear.mean()
    # offsets that carry paint along the street: coverage per 0.05 m column, smoothed across 0.15 m
    cov = ndimage.uniform_filter1d(paint.mean(0), 3)
    peaks = [k for k in range(1, len(offs) - 1) if cov[k] >= cov[k - 1] and cov[k] > cov[k + 1] and cov[k] > 0.06]
    # keep the best peak within 0.4 m
    peaks.sort(key=lambda k: -cov[k])
    keep = []
    for k in peaks:
        if all(abs(offs[k] - offs[q]) > 0.4 for q in keep): keep.append(k)
    bars, found = [], []
    for k in keep:
        band = paint[:, max(0, k - 3):k + 4].any(1)
        band = ndimage.binary_closing(band, iterations=2)                  # (gaps under 0.5 m: one mark)
        rs = [(a, b) for a, b in runs(band) if (b - a) * DS >= 0.8]
        if len(rs) < 2 and not any((b - a) * DS > 12 for a, b in rs): continue
        total = sum(b - a for a, b in rs) * DS
        found.append({'o': round(float(offs[k]), 2), 'cov': round(float(cov[k]), 2), 'n': len(rs), 'm': round(total, 1)})
        for a, b in rs:
            b = min(b, n - 1)
            # (a long solid line in pieces of 3 m at most, so it follows the bend and the ground)
            cuts = np.linspace(a, b, max(2, int(np.ceil((b - a) / 12)) + 1)).round().astype(int)
            for a2, b2 in zip(cuts[:-1], cuts[1:]):
                p = xy[a2] + nrm[a2] * offs[k]; q = xy[b2] + nrm[b2] * offs[k]
                bars.append([round(float(p[0]), 2), round(float(p[1]), 2), round(float(q[0]), 2), round(float(q[1]), 2), 0.13])
    lane_bars, bars = bars, []
    # complete enough to stand in for the made-up lines? As many lane lines (not the edge lines) as the street has
    # lanes less one; else the photo hid some (a pale street, low sun) and the made-up ones stay (28 Nov: Mere pst)
    inner = [f for f in found if abs(f['o']) < w_half - 1.0]
    want = max(1, round(2 * w_half / 3.3) - 1)
    ok = len(inner) >= want
    # stop lines: a run across the street at one place that is not a crossing (crossings are their own props)
    for a, b in runs(acrossf > 0.35):
        if b - a > 3: continue                     # (wider than 0.75 m along: a crossing's stripes)
        c = (a + b) // 2
        # only the painted part across (a stop line covers the lanes of one way, not the whole street)
        span = ndimage.binary_closing(raw[a:b + 1].any(0), iterations=6)    # (gaps under 0.3 m: one line)
        rs = max(runs(span), key=lambda t: t[1] - t[0], default=None)
        if rs is None or (rs[1] - rs[0]) * DO < 1.5: continue
        lo, hi = offs[rs[0]], offs[rs[1] - 1]
        p = xy[c] + nrm[c] * lo; q = xy[c] + nrm[c] * hi
        bars.append([round(float(p[0]), 2), round(float(p[1]), 2), round(float(q[0]), 2), round(float(q[1]), 2), 0.4, 'stop'])
    return {'clear': round(float(clear_frac), 2), 'lines': found if ok else [], 'part': bool(found) and not ok,
            'bars': (lane_bars if ok else []) + bars}


def main():
    area = None
    if len(sys.argv) > 2:
        from shapely.geometry import Polygon, Point
        poly = Polygon([(e - E0, N0 - n) for e, n in json.load(open(sys.argv[2]))])
        area = lambda x, z: poly.contains(Point(x, z))
    v = json.load(open(os.path.join(DATA, 'vectors.json')))
    todo = []
    for idx, r in enumerate(v['roads']):
        if r['type'] not in CAR or r.get('s') in (1, 2, 3) or r['w'] < 5 or len(r['pts']) < 2: continue
        if r.get('e'): continue                    # (bridges and tunnels: the photo shows what is on top)
        mid = r['pts'][len(r['pts']) // 2]
        if area and not area(*mid): continue
        todo.append((idx, r))
    print(len(todo), 'streets', flush=True)
    # fetch the photo squares first, in parallel
    need = set()
    for _, r in todo:
        P = np.array(r['pts'])
        for i in range(int(math.floor((P[:, 0].min() - 12) / TILE)), int(math.floor((P[:, 0].max() + 12) / TILE)) + 1):
            for j in range(int(math.floor((P[:, 1].min() - 12) / TILE)), int(math.floor((P[:, 1].max() + 12) / TILE)) + 1):
                need.add((i, j))
    with ThreadPoolExecutor(8) as ex:
        for k, _ in enumerate(ex.map(lambda t: tile(*t), sorted(need))):
            if k % 200 == 0: print('photo', k, '/', len(need), flush=True)
    sectors, seen = {}, {}
    for k, (idx, r) in enumerate(todo):
        res = lines_of(r)
        if res is None: continue
        key = f"{r['pts'][0][0]:.1f},{r['pts'][0][1]:.1f},{r['pts'][-1][0]:.1f},{r['pts'][-1][1]:.1f}"   # (both ends: streets share a first point)
        seen[key] = {'clear': res['clear'], 'lines': -1 if res['part'] else len(res['lines'])}   # (-1: some found, not all)
        for b in res['bars']:
            sk = f'{int((b[0] - G0) // S)}_{int((b[1] - G0) // S)}'
            sectors.setdefault(sk, []).extend(b[:5])
        if k % 200 == 0: print('street', k, '/', len(todo), flush=True)
    json.dump({'credit': 'Measured on the Maa- ja Ruumiamet orthophoto', 'seen': seen, 'sectors': sectors},
              open(os.path.join(DATA, 'lines.json'), 'w'), separators=(',', ':'))
    print('bars', sum(len(x) for x in sectors.values()) // 5)


if __name__ == '__main__':
    main()
