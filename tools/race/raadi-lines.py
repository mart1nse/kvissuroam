"""The Raadi stage's painted line, made from how people really drive it (Martin 26 Nov 2026).

The game writes every timed run down (src/race/linelog.js) and the server keeps them (worker/index.js, /api/lines).
This tool fetches the runs, draws the four wheel paths of each one again, and sums them on the ground.

  python3 tools/race/raadi-lines.py fetch [dir]            new runs from the live site into dir/runs.ndjson
  python3 tools/race/raadi-lines.py map [dir] [out.png]    the worn ground as a picture over the stage (to look at)
  python3 tools/race/raadi-lines.py bake [dir]             src/race/raadi-line.json and public/raadi-line.png (what the game draws)
  python3 tools/race/raadi-lines.py synth [dir] [n]        made-up runs to try the tool with (never used for the real line)

dir: /mnt/project-files/raadi-lines unless given. Options after the command: since=2026-11-26T12:00 (runs from then
on), done=1 (finished runs only).

How the runs are merged. Each wheel leaves wear along its path: 1 a metre for rolling, up to SLIDE more where its
axle slides (as hard as the game's own tyre marks are drawn). The sum over all runs, per run, on a CELL grid of the
ground, smoothed over BLUR metres, is the wear W. On the stage's gravel (the map's paths, the stage's own width,
the park's wider gravel) the worn band is swept darker, and what is swept off lies beside it (the smoothed wear
further out, less the wear itself); on grass and dirt light wear presses the grass and heavier wear takes it to
soil. The game lays the result along the stage as one strip of picture (see bake).
"""
import base64, gzip, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../')
SITE = 'https://www.linnaring.com'
R = json.load(open(ROOT + 'src/race/raadi.json'))
P = np.array(R['pts'], float); HW = np.array(R['hw'], float); N = len(P); START = R['start']; FIN = R['finish']
F = 10                                   # values a sample (src/race/linelog.js)
CELL = 0.2                               # metres a cell of the ground grid
PAD = 22                                 # metres of grid round the stage
SLIDE = 3.0                              # a wheel sliding at full strength wears this much more than rolling
BLUR_MIN = 0.25                          # metres: the least the summed wear is smoothed over
X0 = math.floor(P[:, 0].min() - PAD); Z0 = math.floor(P[:, 1].min() - PAD)
GW = int(math.ceil((P[:, 0].max() + PAD - X0) / CELL)); GH = int(math.ceil((P[:, 1].max() + PAD - Z0) / CELL))


def args():
    a = [x for x in sys.argv[2:] if '=' not in x]
    o = dict(x.split('=', 1) for x in sys.argv[2:] if '=' in x)
    return a, o


def runs_path(d):
    return os.path.join(d, 'runs.ndjson')


def load_runs(d, o):
    out = []
    p = runs_path(d)
    if not os.path.exists(p):
        return out
    for line in open(p):
        r = json.loads(line)
        if o.get('since') and r['at'] < o['since']: continue
        if o.get('done') == '1' and not r['done']: continue
        out.append(r)
    return out


def samples(r):
    """a run's samples as an (n, F) array of whole numbers, or None when it is not what it says"""
    try:
        a = np.array(gzip.decompress(base64.b64decode(r['z'])).decode().split(','), dtype=np.int64)
    except Exception:
        return None
    if a.size != r['n'] * F: return None
    return np.cumsum(a.reshape(-1, F), axis=0)


# ---------------------------------------------------------------- fetch
def fetch(d):
    os.makedirs(d, exist_ok=True)
    have = load_runs(d, {})
    after = max([r['id'] for r in have], default=0)
    got = 0
    with open(runs_path(d), 'a') as f:
        while True:
            req = urllib.request.Request(f'{SITE}/api/lines?track=raadi&after={after}&limit=60', headers={'user-agent': 'linnaring-lines'})
            j = json.load(urllib.request.urlopen(req, timeout=60))
            if not j['rows']: break
            for r in j['rows']:
                f.write(json.dumps(r) + '\n'); after = r['id']; got += 1
    print(f'{got} new runs, {len(have) + got} in {runs_path(d)}')


# ---------------------------------------------------------------- the wheels' wear on the ground
def wheel_paths(s, m):
    """the four wheels of a run: [(x, z, slide)], each an array along the run; m: [a, b, track, tyre] in cm"""
    x = s[:, 0] / 100; z = s[:, 1] / 100; yaw = s[:, 2] / 1000
    a = (m[0] or 125) / 100; b = (m[1] or 140) / 100; ht = (m[2] or 150) / 200
    fx = np.sin(yaw); fz = -np.cos(yaw); sx = np.cos(yaw); sz = np.sin(yaw)
    air = (s[:, 9] & 2) > 0
    out = []
    for front in (True, False):
        k = s[:, 5 if front else 6] / 50; rub = s[:, 7 if front else 8] / 10
        k1 = np.clip((k - 0.08) / 0.55, 0, 1)
        slide = k1 * k1 * (3 - 2 * k1) * (0.5 + 0.5 * np.minimum(1, rub / 7))      # (as src/skidmarks.js draws a mark)
        slide = np.where(air, 0, slide)
        al = a if front else -b
        for sd in (-ht, ht):
            out.append((x + fx * al + sx * sd, z + fz * al + sz * sd, slide, air))
    return out


def splat(grid, x, z, w):
    """adds the weights w at the points (x, z), shared between the four cells round each"""
    gx = (x - X0) / CELL - 0.5; gz = (z - Z0) / CELL - 0.5
    ix = np.floor(gx).astype(int); iz = np.floor(gz).astype(int)
    tx = gx - ix; tz = gz - iz
    ok = (ix >= 0) & (iz >= 0) & (ix < GW - 1) & (iz < GH - 1)
    ix, iz, tx, tz, w = ix[ok], iz[ok], tx[ok], tz[ok], w[ok]
    np.add.at(grid, (iz, ix), w * (1 - tx) * (1 - tz)); np.add.at(grid, (iz, ix + 1), w * tx * (1 - tz))
    np.add.at(grid, (iz + 1, ix), w * (1 - tx) * tz); np.add.at(grid, (iz + 1, ix + 1), w * tx * tz)


def wear(runs):
    """(roll, slide, n): wheel passes and sliding per cell, summed over the runs; n: the runs that counted"""
    roll = np.zeros((GH, GW)); slide = np.zeros((GH, GW)); n = 0
    for r in runs:
        s = samples(r)
        if s is None or len(s) < 100: continue
        n += 1
        for (x, z, sl, air) in wheel_paths(s, r.get('m') or [0, 0, 0, 0]):
            dx = np.diff(x); dz = np.diff(z); d = np.hypot(dx, dz)
            ok = (d > 1e-3) & (d < 5) & ~air[1:]                  # (not across a jump of the car, not in the air)
            k = np.maximum(1, np.ceil(d / (CELL * 0.5))).astype(int)
            idx = np.repeat(np.nonzero(ok)[0], k[ok])
            if not len(idx): continue
            # each step in k pieces, the weight of a piece its length in cells
            first = np.r_[0, np.cumsum(k[ok])[:-1]]
            t = (np.arange(len(idx)) - np.repeat(first, k[ok]) + 0.5) / k[idx]
            px = x[idx] + dx[idx] * t; pz = z[idx] + dz[idx] * t
            w = d[idx] / k[idx] / CELL
            splat(roll, px, pz, w)
            splat(slide, px, pz, w * (sl[idx] + (sl[idx + 1] - sl[idx]) * t))
    return roll, slide, n


def blur(a, sigma):
    """a Gaussian blur of sigma metres"""
    r = max(1, int(math.ceil(3 * sigma / CELL)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) * CELL / sigma) ** 2); k /= k.sum()
    out = np.zeros_like(a)
    for i, kv in enumerate(k):
        o = i - r
        if o < 0: out[:, :o] += kv * a[:, -o:]
        elif o > 0: out[:, o:] += kv * a[:, :-o]
        else: out += kv * a
    a = out; out = np.zeros_like(a)
    for i, kv in enumerate(k):
        o = i - r
        if o < 0: out[:o] += kv * a[-o:]
        elif o > 0: out[o:] += kv * a[:-o]
        else: out += kv * a
    return out


def gravel_mask():
    """where the game's ground is gravel round the stage (the map's roads there at their widths, the stage at its
    own, the park's wider gravel), as tools/race/raadi-gravel.py takes it"""
    V = json.load(open(ROOT + 'public/data/vectors.json')); PA = json.load(open(ROOT + 'src/world/raadipaths.json'))
    S = 2                                        # (drawn at twice the grid, for smooth edges)
    im = Image.new('L', (GW * S, GH * S), 0); d = ImageDraw.Draw(im)
    px = lambda p: ((p[0] - X0) / CELL * S, (p[1] - Z0) / CELL * S)
    def band(pts, w):
        q = [px(p) for p in pts]
        d.line(q, fill=255, width=max(1, int(round(w / CELL * S))), joint='curve')
        r = w / CELL * S / 2
        for a in q: d.ellipse([a[0] - r, a[1] - r, a[0] + r, a[1] + r], fill=255)
    x0, x1, z0, z1 = X0, X0 + GW * CELL, Z0, Z0 + GH * CELL
    for r in V['roads'] + PA['add']:
        if r.get('s') not in (2, 3): continue                     # (gravel and dirt roads only)
        xs = [p[0] for p in r['pts']]; zs = [p[1] for p in r['pts']]
        if max(xs) < x0 or min(xs) > x1 or max(zs) < z0 or min(zs) > z1: continue
        band(r['pts'], r.get('w', 4))
    for g in PA['gravel']: band(g['line'], g['w'])
    for i in range(R.get('gravelFrom', 0), N - 1): band([P[i], P[i + 1]], 2 * HW[i])
    for a in PA['aprons']:
        q = a if isinstance(a, list) else a.get('pts') or a.get('ring')
        pts = [px((q[i], q[i + 1])) for i in range(0, len(q), 2)] if not isinstance(q[0], list) else [px(p) for p in q]
        d.polygon(pts, fill=255)
    return np.asarray(im.resize((GW, GH), Image.BOX), float) / 255


def worn(runs, o):
    """the worn ground: W (wear per run, smoothed), the same on a level scale 0..1, and the runs that counted"""
    roll, slide, n = wear(runs)
    if not n: sys.exit('no runs')
    # (smoothed more while the runs are few, as an estimate of where the many will drive: 0.6 m for 3 runs, 0.47 m
    # for 10, 0.3 m for 100, never under BLUR_MIN)
    sig = float(o['blur']) if 'blur' in o else min(0.7, max(BLUR_MIN, 0.75 * n ** -0.2))
    W = blur(roll + SLIDE * slide, sig) / n
    print(f'{n} runs, smoothed over {sig:.2f} m')
    return W, n


# ---------------------------------------------------------------- a picture to look at
def draw_map(d, out, o):
    runs = load_runs(d, o)
    W, n = worn(runs, o)
    g = gravel_mask()
    top = np.percentile(W[W > 0.02], 97) if (W > 0.02).any() else 1
    v = np.clip(W / top, 0, 1) ** 0.6
    img = np.zeros((GH, GW, 3))
    base = np.where(g[..., None] > 0.5, np.array([196, 178, 140.]), np.array([92, 128, 70.]))
    dark = np.where(g[..., None] > 0.5, np.array([90, 72, 55.]), np.array([70, 50, 30.]))
    img = base + (dark - base) * v[..., None]
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(im)
    q = lambda p: ((p[0] - X0) / CELL, (p[1] - Z0) / CELL)
    for i in (START, FIN):
        x, z = q(P[i]); dr.ellipse([x - 6, z - 6, x + 6, z + 6], outline=(255, 60, 60) if i == FIN else (60, 220, 60), width=2)
    im.save(out)
    print(f'{n} runs, wear at the 97th percentile {top:.2f} passes a run, {out} {im.size}')


# ---------------------------------------------------------------- what the game draws
# One strip of picture laid along the stage: across it u = 0..1 is E metres left to E metres right of the centre
# line, along it v = 0..1 is the stage's points I0 to I1. TW x TH texels, each holding how worn the ground is there
# as three shares 0..255: R gravel swept, G loose gravel lying beside the swept band, B grass worn to soil. The
# game turns each into a factor on the ground's colour, factor = colour ^ share (src/race/raadi-line.js), so shares
# add up where the strip lies on itself: the stage crosses its own path and drives one stretch twice, and inside a
# tight corner a strip this wide folds over itself. There each layer gets its part of the wear, by a weight that
# fades to nothing at the strip's own edges (so no layer ends at a visible line) and the parts sum to the whole.
E = 9.0                                  # metres either side of the centre line
K = 12                                   # quads across the strip (the mesh; 1.5 m each)
TW, TH = 64, 4096
EDGE_M, END_M = 2.0, 4.0                 # the weight fades over this at the strip's sides and its two ends
TAN = np.array([(P[min(N - 1, i + 1)] - P[max(0, i - 1)]) for i in range(N)]); TAN /= np.hypot(TAN[:, 0], TAN[:, 1])[:, None]
I0 = max(START - 3, R.get('gravelFrom', 0)); I1 = N - 1


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def strip_pos(fi, d):
    """the ground under the strip at stage index fi (may be fractional) and d metres right of the centre line"""
    i = np.clip(np.floor(fi).astype(int), 0, N - 2); t = fi - i
    ax = P[i, 0] - TAN[i, 1] * d; az = P[i, 1] + TAN[i, 0] * d
    bx = P[i + 1, 0] - TAN[i + 1, 1] * d; bz = P[i + 1, 1] + TAN[i + 1, 0] * d
    return ax + (bx - ax) * t, az + (bz - az) * t


CUM = np.r_[0, np.cumsum(np.hypot(np.diff(P[:, 0]), np.diff(P[:, 1])))]


def weight(fi, d):
    """a layer's weight: 1 in the strip, fading out at its sides and ends"""
    m = np.interp(fi, np.arange(N), CUM)
    return sstep(0, EDGE_M, E - np.abs(d)) * sstep(0, END_M, m - CUM[I0]) * sstep(0, END_M, CUM[I1] - m)


def sample(grid, x, z):
    gx = np.clip((x - X0) / CELL - 0.5, 0, GW - 1.001); gz = np.clip((z - Z0) / CELL - 0.5, 0, GH - 1.001)
    ix = np.floor(gx).astype(int); iz = np.floor(gz).astype(int); tx = gx - ix; tz = gz - iz
    return (grid[iz, ix] * (1 - tx) + grid[iz, ix + 1] * tx) * (1 - tz) + (grid[iz + 1, ix] * (1 - tx) + grid[iz + 1, ix + 1] * tx) * tz


def layers():
    """the sum of the weights of the strip's layers over each cell of the ground: every triangle of the game's mesh
    that faces up, drawn into the grid with its weight"""
    Hs = np.zeros((GH, GW))
    ds = -E + 2 * E * np.arange(K + 1) / K
    for i in range(I0, I1):
        for j in range(K):
            # the quad's corners as the game orders them: (i, j), (i, j+1), (i+1, j), (i+1, j+1)
            c = [(i, ds[j]), (i, ds[j + 1]), (i + 1, ds[j]), (i + 1, ds[j + 1])]
            xy = [strip_pos(np.array(float(q[0])), q[1]) if q[0] < N - 1 else (P[q[0], 0] - TAN[q[0], 1] * q[1], P[q[0], 1] + TAN[q[0], 0] * q[1]) for q in c]
            for tri in ((0, 1, 2), (2, 1, 3)):
                (x0, z0), (x1, z1), (x2, z2) = [(float(xy[k][0]), float(xy[k][1])) for k in tri]
                area = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0)
                if area >= -1e-9: continue                          # (folded over: it faces down, and the game does not draw it)
                gx0 = int(math.floor((min(x0, x1, x2) - X0) / CELL - 0.5)); gx1 = int(math.ceil((max(x0, x1, x2) - X0) / CELL - 0.5))
                gz0 = int(math.floor((min(z0, z1, z2) - Z0) / CELL - 0.5)); gz1 = int(math.ceil((max(z0, z1, z2) - Z0) / CELL - 0.5))
                gx0 = max(gx0, 0); gz0 = max(gz0, 0); gx1 = min(gx1, GW - 1); gz1 = min(gz1, GH - 1)
                if gx1 < gx0 or gz1 < gz0: continue
                X, Z = np.meshgrid(X0 + (np.arange(gx0, gx1 + 1) + 0.5) * CELL, Z0 + (np.arange(gz0, gz1 + 1) + 0.5) * CELL)
                w1 = ((X - x0) * (z2 - z0) - (x2 - x0) * (Z - z0)) / area
                w2 = ((x1 - x0) * (Z - z0) - (X - x0) * (z1 - z0)) / area
                w0 = 1 - w1 - w2
                inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
                if not inside.any(): continue
                fi = w0 * c[tri[0]][0] + w1 * c[tri[1]][0] + w2 * c[tri[2]][0]
                dd = w0 * c[tri[0]][1] + w1 * c[tri[1]][1] + w2 * c[tri[2]][1]
                Hs[gz0:gz1 + 1, gx0:gx1 + 1] += np.where(inside, weight(fi, dd), 0)
    return Hs


def looks(W, g):
    """the three shares over the ground: gravel swept, loose gravel beside the swept band, grass worn to soil"""
    on = W[(W > 0.02) & (g > 0.5)]
    top = float(np.percentile(on, 97)) if on.size else 1.0
    wn = W / top
    wide = blur(W, 0.75) / top
    swept = g * (1 - np.exp(-2.2 * wn))
    loose = g * np.clip(2.2 * wide - 1.6 * wn, 0, 1) * sstep(0.02, 0.12, wide)
    soil = (1 - g) * np.clip(0.75 * wn, 0, 1) ** 0.8
    return swept, loose, soil, top


def bake(d, o):
    runs = load_runs(d, o)
    W, n = worn(runs, o)
    g = gravel_mask()
    swept, loose, soil, top = looks(W, g)
    Hs = layers()
    fi = I0 + (np.arange(TH) + 0.5) / TH * (I1 - I0)
    dd = -E + 2 * E * (np.arange(TW) + 0.5) / TW
    FI, DD = np.meshgrid(fi, dd, indexing='ij')                      # (TH, TW): a row of the picture is a place along the stage
    x, z = strip_pos(FI, DD)
    h = weight(FI, DD); H = sample(Hs, x, z)
    part = np.where(H > 1e-3, np.minimum(1, h / np.maximum(H, 1e-3)), 1.0)
    img = np.stack([sample(a, x, z) * part for a in (swept, loose, soil)], -1)
    img8 = np.round(np.clip(img, 0, 1) * 255).astype(np.uint8)
    # which quads of each row of the mesh have anything on them (the others are left out)
    cols = []
    rows_per = TH / (I1 - I0); cpq = TW / K
    live = img8.max(-1) > 2
    for i in range(I0, I1):
        r0 = max(0, int(math.floor((i - I0) * rows_per)) - 1); r1 = min(TH, int(math.ceil((i + 1 - I0) * rows_per)) + 1)
        c = np.nonzero(live[r0:r1].any(0))[0]
        if not len(c): cols.append([0, 0]); continue
        cols.append([max(0, int(math.floor((c[0] - 1) / cpq))), min(K, int(math.floor((c[-1] + 1) / cpq)) + 1)])
    Image.fromarray(img8, 'RGB').save(ROOT + 'src/race/raadi-line.png', optimize=True)
    when = max((r['at'] for r in runs), default='')
    json.dump({'v': 1, 'i0': I0, 'i1': I1, 'e': E, 'k': K, 'runs': n, 'until': when, 'cols': cols}, open(ROOT + 'src/race/raadi-line.json', 'w'), separators=(',', ':'))
    quads = sum(b - a for a, b in cols)
    print(f'{n} runs (the last at {when}), full wear {top:.2f} passes a run; {quads} quads of {len(cols) * K}; '
          f'picture {TW}x{TH}, {os.path.getsize(ROOT + "src/race/raadi-line.png") // 1024} KB; layers up to {Hs.max():.2f}')


# ---------------------------------------------------------------- made-up runs to try the tool with
def synth(d, n):
    os.makedirs(d, exist_ok=True)
    rng = np.random.default_rng(5)
    L = np.array(R['line'], float)
    tan = np.gradient(P, axis=0); tan /= np.hypot(tan[:, 0], tan[:, 1])[:, None]
    work = np.zeros(N); sign = np.zeros(N)
    for ap in R['apex']:
        k, sd = ap[0], ap[1]
        for i in range(max(0, k - 14), min(N, k + 10)):
            t = np.exp(-((i - k) / 6) ** 2)
            if t > work[i]: work[i] = t; sign[i] = sd
    with open(runs_path(d), 'w') as f:
        for j in range(n):
            wob = np.convolve(rng.normal(0, 1, N), np.ones(25) / 25, 'same') * 3.2
            off = L + wob + sign * work * rng.uniform(-0.6, 1.8)
            cx = P[:, 0] - tan[:, 1] * off; cz = P[:, 1] + tan[:, 0] * off
            # every 0.75 m along that line, pointing along it and turned in where the corners work the car
            seg = np.hypot(np.diff(cx), np.diff(cz)); cum = np.r_[0, np.cumsum(seg)]
            sd_ = np.arange(cum[START], cum[min(N - 1, FIN + 20)], 0.75)
            x = np.interp(sd_, cum, cx); z = np.interp(sd_, cum, cz)
            hd = np.arctan2(np.gradient(x), -np.gradient(z))
            wk = np.interp(sd_, cum, work) * rng.uniform(0.5, 1.2); sg = np.interp(sd_, cum, sign)
            yaw = hd + sg * wk * rng.uniform(0.15, 0.5)
            s = np.zeros((len(x), F), np.int64)
            s[:, 0] = np.round(x * 100); s[:, 1] = np.round(z * 100); s[:, 2] = np.round(yaw * 1000)
            s[:, 3] = 180; s[:, 5] = np.round(np.clip(wk * 0.9, 0, 1) * 50); s[:, 6] = np.round(np.clip(wk * 1.2, 0, 1) * 50)
            s[:, 7] = np.round(wk * 60); s[:, 8] = np.round(wk * 80); s[:, 9] = 2 << 4
            dlt = np.diff(s, axis=0, prepend=np.zeros((1, F), np.int64))
            zt = base64.b64encode(gzip.compress(','.join(map(str, dlt.flatten())).encode())).decode()
            f.write(json.dumps({'id': j + 1, 'at': '2026-11-26T00:00:00.000Z', 'car': 'synth', 'done': 1, 'ms': 100000, 'pen': 0, 'n': len(x), 'ty': 'gravel', 'm': [125, 141, 150, 20], 'z': zt}) + '\n')
    print(f'{n} made-up runs in {runs_path(d)}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    a, o = args()
    d = a[0] if a else '/mnt/project-files/raadi-lines'
    if cmd == 'fetch': fetch(d)
    elif cmd == 'map': draw_map(d, a[1] if len(a) > 1 else os.path.join(d, 'map.png'), o)
    elif cmd == 'synth': synth(d, int(a[1]) if len(a) > 1 else 12)
    elif cmd == 'bake': bake(d, o)
    else: sys.exit(__doc__)
