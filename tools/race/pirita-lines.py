"""The Pirita-Kose lap's worn line and tyre marks, made from how it is really driven (Martin 28 Nov 2026: "implement the
ideal trajectory darker part and then some tire tracks that fit in nicely and are not too aggressive. to pirita track").

Every finished lap in Tallinn sends its drive (src/race/laplines.js, the lap's replay: 10 samples a second of place,
heading, speed, each axle's slide and rub), and the Tallinn lobby keeps them (GET /api/lines?city=tallinn).
`CITY=tallinn node tools/race/lap-lines.mjs fetch` copies them to /mnt/project-files/pirita-lines/runs.ndjson.

  python3 tools/race/pirita-lines.py bake [dir]       public/data/tln/pirita-line.json (what the game draws)
  python3 tools/race/pirita-lines.py map [dir] [out]  the worn band laid out straight, to look at

How the drives are merged. Each drive is drawn again between its samples (along the speeds at both ends, as the
replays are), every STEP metres, and its four wheel paths are put in the lap's own frame: metres along the lap and
across it (right of the way it is driven). Each wheel wears the road along its path: ROLL a metre for rolling, more
under the brakes and where it slides (as hard as the game's own tyre marks are drawn). Summed over the drives, per
drive that came by, smoothed, that is the wear; the band the game draws is 1 - exp(-k wear / its 97th percentile).
The marks: every stretch a wheel slid hard enough, a ribbon as wide as its tyre (broader when it went sideways).
"""
import base64, gzip, json, math, os, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../')
LAP = json.load(open(ROOT + 'src/race/pirita.json'))
P = np.array(LAP['pts'], float); N = len(P); HW = np.array(LAP['hw'], float)
SEG = np.roll(P, -1, 0) - P; SL = np.hypot(SEG[:, 0], SEG[:, 1])
SS = np.r_[0, np.cumsum(SL)]; LEN = SS[-1]
POSE_DEC = [2, 2, 2, 3, 3, 3, 2, 2, 3, 0, 0, 2, 2, 2, 0, 1, 1, 1, 1, 1, 0]
SC = np.array([10.0 ** d for d in POSE_DEC])
# the cars' measures (src/cars/specs.js: wheelbase, share behind the front axle, track, tyre widths)
CARS = {'w201': (2.665, 0.47, 1.428, None), 'crv': (2.62, 0.42, 1.565, None), 'enyaq': (2.765, 0.51, 1.577, None),
        'rav4': (2.69, 0.42, 1.605, None), 'passat': (2.703, 0.38, 1.499, None), 'mazda6': (2.75, 0.4, 1.59, None),
        'bz4x': (2.85, 0.5, 1.605, None), 'f40': (2.45, 0.58, 1.6, (0.245, 0.335)), 'cgt': (2.73, 0.58, 1.587, (0.265, 0.335)),
        'audi200': (2.687, 0.41, 1.511, None), 'm3': (2.761, 0.5, 1.539, (0.245, 0.265)), 'impreza': (2.52, 0.43, 1.49, (0.235, 0.235)),
        'focus': (2.615, 0.45, 1.55, (0.225, 0.225)), 'rocket': (2.65, 0.52, 1.64, (0.245, 0.325)), 'bus': (5.95, 0.62, 1.98, (0.275, 0.55))}

TURN_M = 8.0                 # metres either side the band's frame is smoothed over
STEP = 0.35                  # metres between the points a drive is drawn at again
E = 7.0                      # the band: metres either side of the lap's line
DS, DD = 1.0, 0.25           # the wear grid: a row a metre along, a column every 0.25 m across
OS, OD = 1.0, 0.5            # what the game gets: a row a metre along, a column every half metre across
ROLL, BRAKE, SLIDE = 1.0, 0.6, 2.0
BLUR_S, BLUR_D = 3.0, 0.75    # the wear smoothed over this along and across (one broad band, not each car's wheels)
OFF = 2.5                    # a drive is off the lap where its middle is this far past the lap's half width
EDGE_M = 2.0                 # the band fades out over this at its sides
K = 1.6                      # how quickly the band darkens with wear
MARK_MIN, MARK_SHOW, MARK_M = 0.1, 0.6, 5.0   # a mark is kept where the slide is over MARK_MIN, if it reaches MARK_SHOW
                             # and is MARK_M metres long; its ends fade in and out
MARK_MAX = 0.5               # the strongest a mark is laid, of 1 (Martin: "not too aggressive")
PATCH = 0.15                 # a tyre's contact patch: a mark's width when it is dragged sideways (src/skidmarks.js)


def load(d):
    p = os.path.join(d, 'runs.ndjson')
    return [json.loads(l) for l in open(p)] if os.path.exists(p) else []


def frames(r):
    """a drive's samples as an (n, 21) array of values, and its time in seconds; None when it is not what it says"""
    try:
        a = np.array(gzip.decompress(base64.b64decode(r['z'])).decode().split(','), dtype=np.float64)
    except Exception:
        return None
    v, f, ms, n = a[:4].astype(int)
    if v != 1 or f != 21 or a.size != 4 + n * 21: return None
    return np.cumsum(a[4:].reshape(n, 21), axis=0) / SC, ms / 1000


def wrap(a):
    return np.arctan2(np.sin(a), np.cos(a))


def redraw(fr, dur):
    """the drive every STEP metres: x, z, yaw, skidF, skidR, rubF, rubR, brake (the place along the speeds at both
    ends of each tenth of a second, as src/race/replay.js replayAt draws it)"""
    n = len(fr); out = []
    for i in range(n - 1):
        A, B = fr[i], fr[i + 1]
        span = min(0.1, dur - i * 0.1) if i == n - 2 else 0.1
        span = max(span, 1e-3)
        d = math.hypot(B[0] - A[0], B[1] - A[1])
        if d > 12: continue                                        # (moved: R, a reset)
        k = max(1, int(math.ceil(d / STEP)))
        f = np.arange(k) / k
        f2 = f * f; f3 = f2 * f
        h10 = f3 - 2 * f2 + f; h11 = f3 - f2; h01 = 3 * f2 - 2 * f3; h00 = 1 - h01
        x = h00 * A[0] + h10 * span * A[6] + h01 * B[0] + h11 * span * B[6]
        z = h00 * A[1] + h10 * span * A[7] + h01 * B[1] + h11 * span * B[7]
        yaw = A[3] + wrap(B[3] - A[3]) * f
        rest = A[[16, 17, 18, 19, 9]][None] + (B[[16, 17, 18, 19, 9]] - A[[16, 17, 18, 19, 9]])[None] * f[:, None]
        out.append(np.c_[x, z, yaw, rest])
    return np.vstack(out) if out else np.zeros((0, 8))


def centre(s):
    """the lap's line at s metres (along its points, as the game reads it)"""
    s = np.mod(s, LEN)
    i = np.clip(np.searchsorted(SS, s, 'right') - 1, 0, N - 1); t = (s - SS[i]) / SL[i]
    return P[i, 0] + SEG[i, 0] * t, P[i, 1] + SEG[i, 1] * t


def frame(s):
    """the band's own frame at s: its way along, smoothed over TURN_M metres either side (so it does not fold inside
    the tight corners), as (tx, tz); right of it is (-tz, tx) (src/world/tln/piritaline.js does the same)"""
    ax, az = centre(s - TURN_M); bx, bz = centre(s + TURN_M)
    l = np.hypot(bx - ax, bz - az)
    return (bx - ax) / l, (bz - az) / l


def to_band(x, z):
    """points into the band's frame: (s, d, i the lap point before)"""
    s, _, i = to_lap(x, z)
    cx, cz = centre(s); tx, tz = frame(s)
    ex, ez = x - cx, z - cz
    return np.mod(s + ex * tx + ez * tz, LEN), ex * -tz + ez * tx, i


def to_lap(x, z, hint=None):
    """points into the lap's frame: (s metres along, d metres right of the line, i the lap point before)"""
    s = np.empty(len(x)); dd = np.empty(len(x)); ii = np.empty(len(x), int)
    for c in range(0, len(x), 4000):
        q = slice(c, c + 4000)
        px = x[q, None] - P[None, :, 0]; pz = z[q, None] - P[None, :, 1]
        t = np.clip((px * SEG[None, :, 0] + pz * SEG[None, :, 1]) / (SL[None] ** 2), 0, 1)
        ex = px - t * SEG[None, :, 0]; ez = pz - t * SEG[None, :, 1]
        e2 = ex * ex + ez * ez
        i = np.argmin(e2, 1); tt = t[np.arange(len(i)), i]
        s[q] = SS[i] + tt * SL[i]
        # right of the way it is driven: (-tz, tx)
        tx = SEG[i, 0] / SL[i]; tz = SEG[i, 1] / SL[i]
        dd[q] = ex[np.arange(len(i)), i] * -tz + ez[np.arange(len(i)), i] * tx
        ii[q] = i
    return s, dd, ii


def wheels(D, car):
    wb, cg, tr, ty = CARS.get(car, (2.65, 0.45, 1.55, None))
    a = wb * cg; b = wb - a; ht = tr / 2; ty = ty or (0.205, 0.205)
    x, z, yaw = D[:, 0], D[:, 1], D[:, 2]
    fx = np.sin(yaw); fz = -np.cos(yaw); sx = np.cos(yaw); sz = np.sin(yaw)
    out = []
    for front in (True, False):
        k = D[:, 3 if front else 4]; rub = D[:, 5 if front else 6]
        k1 = np.clip((k - 0.08) / 0.55, 0, 1)
        sl = k1 * k1 * (3 - 2 * k1) * (0.5 + 0.5 * np.minimum(1, rub / 7))     # (as src/skidmarks.js lays a mark)
        al = a if front else -b
        for sd in (-ht, ht):
            out.append((x + fx * al + sx * sd, z + fz * al + sz * sd, sl, ty[0 if front else 1]))
    return out


def blur1(a, sigma, step, axis, circular):
    r = max(1, int(math.ceil(3 * sigma / step)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) * step / sigma) ** 2); k /= k.sum()
    out = np.zeros_like(a)
    for j, kv in enumerate(k):
        o = j - r
        if circular: out += kv * np.roll(a, o, axis)
        else:
            sh = np.roll(a, o, axis)
            if o > 0: sh[(slice(None),) * axis + (slice(0, o),)] = 0
            elif o < 0: sh[(slice(None),) * axis + (slice(o, None),)] = 0
            out += kv * sh
    return out


def merge(runs):
    rows = int(math.ceil(LEN / DS)); cols = int(round(2 * E / DD)) + 1
    wear = np.zeros((rows, cols)); cover = np.zeros(rows); used = []; marks = []
    for r in runs:
        got = frames(r)
        if got is None: continue
        D = redraw(*got)
        if len(D) < 200: continue
        s, d, i = to_lap(D[:, 0], D[:, 1])
        on = np.abs(d) < HW[i] + OFF
        if on.mean() < 0.9: print(f"  drive {r['id']} ({r['car']}) left out: {100 * (1 - on.mean()):.0f} % of it off the lap"); continue
        used.append(r)
        # which metres of the lap it drove (on the lap)
        cov = np.zeros(rows, bool); cov[np.clip((s[on] / DS).astype(int), 0, rows - 1)] = True
        cover += blur1(cov.astype(float), 3.0, DS, 0, True) > 0.3
        brake = D[:, 7] > 0.5
        for wn, (wx, wz, sl, tyre) in enumerate(wheels(D, r['car'])):
            ws, wd, wi = to_band(wx, wz)
            step = np.r_[np.hypot(np.diff(wx), np.diff(wz)), 0]
            ok = on & (step < 3) & (np.abs(wd) < E)
            w = step * (ROLL + BRAKE * brake + SLIDE * sl)
            ri = np.clip((ws / DS).astype(int), 0, rows - 1); ci = np.clip(np.round((wd + E) / DD).astype(int), 0, cols - 1)
            np.add.at(wear, (ri[ok], ci[ok]), w[ok])
            # its marks: where it slid, a ribbon of [i, x, z, width, strength] points
            live = ok & (sl > MARK_MIN) & (wn >= 2)                       # (the rear wheels' only: what a slide leaves)
            yaw = D[:, 2]; hx = np.sin(yaw); hz = -np.cos(yaw)
            dx = np.gradient(wx); dz = np.gradient(wz); l = np.hypot(dx, dz)
            cb = np.where(l > 0.02, np.abs(dx * hx + dz * hz) / np.maximum(l, 1e-6), 1.0)
            wdt = tyre * cb + PATCH * np.sqrt(np.clip(1 - cb * cb, 0, 1))
            j = 0; n = len(sl)
            while j < n:
                if not live[j]: j += 1; continue
                k = j
                while k + 1 < n and live[k + 1] and step[k] < 3: k += 1
                if sl[j:k + 1].max() >= MARK_SHOW and step[j:k].sum() >= MARK_M:
                    pts = list(range(j, k, 3)) + [k]
                    marks.append([int(wi[j])] + [v for q in pts for v in (int(round((wx[q] - P[0, 0]) * 100)), int(round((wz[q] - P[0, 1]) * 100)),
                                                                          int(round(wdt[q] * 100)), int(round(MARK_MAX * min(1, sl[q] / 0.8) * 100)) if j < q < k else 0)])
                j = k + 1
    # per drive that came by, smoothed a little along and across
    W = blur1(blur1(wear, BLUR_S, DS, 0, True), BLUR_D, DD, 1, False) / np.maximum(1, cover)[:, None] / DS
    return W, used, marks


def band(W):
    top = float(np.percentile(W[W > 0.05], 97)) if (W > 0.05).any() else 1.0
    return 1 - np.exp(-K * W / top), top


def bake(d):
    runs = load(d)
    W, used, marks = merge(runs)
    if not used: sys.exit('no drives')
    B, top = band(W)
    # rows every OS metres, columns every OD across
    rs = np.arange(0, LEN, OS); cs = np.arange(-E, E + 1e-6, OD)
    gi = np.clip(rs / DS, 0, B.shape[0] - 1); gj = (cs + E) / DD
    out = np.empty((len(rs), len(cs)))
    for a, j in enumerate(gj): out[:, a] = np.interp(gi, np.arange(B.shape[0]), B[:, int(round(j))])
    # (faded out over the band's last EDGE_M either side: no edge where a corner's cut reaches past it)
    t = np.clip((E - np.abs(cs)) / EDGE_M, 0, 1)
    out *= (t * t * (3 - 2 * t))[None]
    b8 = np.round(np.clip(out, 0, 1) * 255).astype(np.uint8)
    when = max(r['at'] for r in used)
    o = {'v': 1, 'runs': len(used), 'until': when, 'os': OS, 'od': OD, 'e': E, 'rows': len(rs), 'cols': len(cs),
         'band': base64.b64encode(b8.tobytes()).decode(), 'marks': marks}
    p = ROOT + 'public/data/tln/pirita-line.json'
    json.dump(o, open(p, 'w'), separators=(',', ':'))
    z = len(gzip.compress(open(p, 'rb').read()))
    print(f"{len(used)} drives of {len(runs)} (the last at {when}); full wear {top:.2f} a drive; band {len(rs)}x{len(cs)}, "
          f"{(b8 > 3).mean() * 100:.0f} % of it on; {len(marks)} marks of {sum((len(m) - 1) // 4 for m in marks)} points; "
          f"{os.path.getsize(p) // 1024} KB, {z // 1024} KB gzipped")


def draw_map(d, out):
    from PIL import Image
    W, used, marks = merge(load(d))
    B, top = band(W)
    # the lap laid out straight, in strips of 600 m one under the other (each row a metre, each column 0.25 m)
    L = 600; strips = int(math.ceil(B.shape[0] / L)); h = B.shape[1]
    img = np.full((strips * (h + 6), L), 255.0)
    for k in range(strips):
        part = B[k * L:(k + 1) * L].T
        img[k * (h + 6):k * (h + 6) + h, :part.shape[1]] = 200 - 170 * part
    Image.fromarray(img.astype(np.uint8)).resize((L * 2, strips * (h + 6) * 2), Image.NEAREST).save(out)
    print(f'{len(used)} drives, {out}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    a = sys.argv[2:]
    d = a[0] if a else '/mnt/project-files/pirita-lines'
    if cmd == 'bake': bake(d)
    elif cmd == 'map': draw_map(d, a[1] if len(a) > 1 else os.path.join(d, 'band.png'))
    else: sys.exit(__doc__)
