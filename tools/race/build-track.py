"""Builds src/race/track.json: Martin's Toomemägi race track, routed along the real streets.

The waypoints below were read off his annotated map (pink line, start/finish on Küüni,
spawn on Uueturu at the Ülikooli crossing) and are joined by shortest paths on the ETAK
street network in public/data/vectors.json. Run: python3 tools/race/build-track.py
"""
import json, heapq, math, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
d = json.load(open(os.path.join(ROOT, 'public/data/vectors.json')))
OK = {'Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Muu tee'}

# in driving order, starting just after the last corner (Uueturu -> Küüni)
WAYPOINTS = [
    (1640, 3095), (1565, 3030), (1530, 2980),            # Küüni, start/finish
    (1470, 3055), (1440, 3095), (1300, 3085), (1130, 3135),  # Vallikraavi
    (1060, 3040), (910, 3015), (845, 2980),              # Lossi / K. E. von Baeri
    (840, 2750), (950, 2605),                            # von Baeri up to Jakobi
    (1065, 2640), (1180, 2500), (1340, 2440), (1430, 2375),  # Jakobi, Lai
    (1450, 2300), (1330, 2185),                          # along the river to the Kroonuaia corner
    (1160, 2385), (1025, 2435), (950, 2605),             # Kroonuaia back down to Jakobi
    (740, 2555), (670, 2640), (660, 2900), (845, 3285),  # Jakobi west, Veski south
    (1020, 3250), (1100, 3245),                          # Kuperjanovi
    (1145, 3300), (1230, 3460),                          # Pepleri
    (1440, 3260), (1585, 3145), (1640, 3095),            # Vanemuise, Ülikooli crossing, Uueturu
]

nodes, coords, adj, width = {}, [], [], {}
def nid(p):
    k = (round(p[0] / 1.5), round(p[1] / 1.5))
    if k not in nodes:
        nodes[k] = len(coords); coords.append(p); adj.append([])
    return nodes[k]
for r in d['roads']:
    if r['type'] not in OK: continue
    pts = r['pts']
    if not any(300 < p[0] < 2000 and 1900 < p[1] < 3900 for p in pts): continue
    ids = [nid(p) for p in pts]
    for a, b in zip(ids, ids[1:]):
        if a == b: continue
        w = math.dist(coords[a], coords[b])
        adj[a].append((b, w)); adj[b].append((a, w))
        width[(a, b)] = width[(b, a)] = r['w']

def snap(p):
    return min((i for i in range(len(coords)) if adj[i]), key=lambda i: math.dist(coords[i], p))

def path(a, b):
    D, P, h = {a: 0}, {}, [(0, a)]
    while h:
        dd, u = heapq.heappop(h)
        if u == b: break
        if dd > D[u]: continue
        for v, w in adj[u]:
            if dd + w < D.get(v, 1e18):
                D[v] = dd + w; P[v] = u; heapq.heappush(h, (dd + w, v))
    out = [b]
    while out[-1] != a: out.append(P[out[-1]])
    return out[::-1]

S = [snap(p) for p in WAYPOINTS]
route = [S[0]]
for a, b in zip(S, S[1:]):
    route += path(a, b)[1:]
route += path(S[-1], S[0])[1:]           # close the loop (no-op: first and last waypoint match)
pts = [coords[i] for i in route]
ws = [width[(route[i], route[i + 1])] for i in range(len(route) - 1)]

# resample every 2 m, carrying the road width
STEP = 2.0
res, rw = [], []
for i in range(len(pts) - 1):
    a, b = pts[i], pts[i + 1]
    L = math.dist(a, b); n = max(1, int(L / STEP))
    for k in range(n):
        t = k / n
        res.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); rw.append(ws[i])
N = len(res)

def smooth(vals, radius):
    out = []
    for i in range(N):
        acc = [0.0] * len(vals[0]); wsum = 0
        for k in range(-radius, radius + 1):
            w = math.exp(-0.5 * (k / (radius / 2)) ** 2)
            v = vals[(i + k) % N]
            for j in range(len(acc)): acc[j] += v[j] * w
            wsum += w
        out.append([a / wsum for a in acc])
    return out

c = smooth(res, 5)                        # rounds the corners a little (about 10 m)
hw = [v[0] / 2 for v in smooth([(min(w, 14.0),) for w in rw], 10)]

# start/finish: 92 m after the last corner along Küüni (Martin's red line)
s = [0.0]
for i in range(1, N): s.append(s[-1] + math.dist(c[i - 1], c[i]))
total = s[-1] + math.dist(c[-1], c[0])
def at(dist):
    dist %= total
    i = max(j for j in range(N) if s[j] <= dist)
    return i
i0 = at(92)
c = c[i0:] + c[:i0]; hw = hw[i0:] + hw[:i0]

# straighten knots: where the street network makes the route run round a tiny loop at a junction
# (Vanemuise at Vallikraavi), the path is far longer than the gap it covers. Replace those points
# with a straight line, keeping the point count so indices elsewhere stay put.
def straighten():
    head = lambda k: math.atan2(c[(k + 1) % N][1] - c[k % N][1], c[(k + 1) % N][0] - c[k % N][0])
    wrap = lambda a: math.atan2(math.sin(a), math.cos(a))
    i = 0
    while i < N:
        for j in range(i + 24, i + 5, -1):
            net = abs(wrap(head(j) - head(i)))
            turn = sum(abs(wrap(head(k + 1) - head(k))) for k in range(i, j))
            if net < 0.35 and turn > 2.0:      # turns a lot but ends up going the same way: a knot
                a, b = c[i % N], c[j % N]
                for k in range(i + 1, j):
                    t = (k - i) / (j - i)
                    c[k % N] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
                print('straightened', i, j)
                i = j
                break
        i += 1
straighten()

# Hand-fitted stretches: where a junction was rebuilt and the street map's centre line no longer runs
# down the middle of the new carriageway, the glowing kerbs are fitted to the real kerbs instead. Each
# entry gives the first and last track index to move and the kerb line on the left and on the right
# (in driving order, starting and ending on the old kerbs). The centre line is slid sideways until it
# sits halfway between them, its half-width set to reach both, and the points spread evenly again.
# The point count of the stretch stays the same, so every index elsewhere (checkpoints, kerbs, signs)
# stays put. Lap order matters for nothing else.
RESHAPE = [
    # Lai -> Vabaduse -> Emajõe: the Lai/Vabaduse junction rebuilt in 2026 (src/race/lai.json, the city's
    # plan). Left: Lai's north kerb, round the corner kerb onto Vabaduse's west kerb, then round the
    # corner by the bridge onto the river road. Right: Lai's south kerb, an arc across the junction
    # mouth that clears the island tip of the southern arm, Vabaduse's east kerb, then an arc across
    # the bridge mouth onto the river road (Martin, 19 Nov).
    (900, 947,
     [(1404.73, 2386.14), (1408.13, 2383.71), (1411.76, 2381.33), (1418.0, 2378.3), (1420.0, 2376.9),
      (1424.0, 2374.4), (1428.0, 2372.2), (1432.0, 2370.0), (1436.0, 2368.1), (1440.0, 2367.1),
      (1443.0, 2365.8), (1444.7, 2364.0), (1445.7, 2362.0), (1446.1, 2360.0), (1446.8, 2356.0),
      (1447.6, 2352.0), (1448.6, 2348.0), (1449.6, 2344.0), (1450.9, 2340.0), (1451.8, 2336.0),
      (1451.6, 2333.0), (1450.5, 2330.0), (1449.0, 2328.0), (1447.1, 2326.0), (1445.4, 2324.0),
      (1443.7, 2322.0), (1441.97, 2320.85), (1439.63, 2317.56)],
     [(1410.41, 2393.88), (1413.57, 2391.61), (1418.0, 2389.0), (1420.0, 2388.3), (1424.0, 2387.2),
      (1428.0, 2386.5), (1432.0, 2386.1), (1436.0, 2385.9), (1440.0, 2385.3), (1444.0, 2383.3),
      (1448.0, 2380.3), (1451.5, 2377.0), (1454.5, 2373.0), (1456.6, 2369.0), (1458.0, 2365.0),
      (1458.4, 2362.0), (1458.6, 2360.0), (1459.0, 2356.0), (1459.5, 2352.0), (1460.2, 2348.0),
      (1461.2, 2344.0), (1462.2, 2340.0), (1462.5, 2337.0), (1461.9, 2333.0), (1459.5, 2329.5),
      (1458.0, 2325.5), (1455.8, 2322.9), (1453.2, 2321.0), (1450.52, 2319.68), (1449.33, 2318.06), (1448.15, 2316.43),
      (1445.83, 2313.18)]),
]

def ray_hit(o, d, line):
    """distance along d from o to the first crossing of the polyline, or None"""
    best = None
    for a, b in zip(line, line[1:]):
        ex, ez = b[0] - a[0], b[1] - a[1]
        den = d[0] * ez - d[1] * ex
        if abs(den) < 1e-9: continue
        wx, wz = a[0] - o[0], a[1] - o[1]
        t = (wx * ez - wz * ex) / den
        u = (wx * d[1] - wz * d[0]) / den
        if t > 0 and -1e-6 <= u <= 1 + 1e-6 and (best is None or t < best): best = t
    return best

def even(pts, n):
    """n points evenly along the polyline, both ends kept"""
    acc = [0.0]
    for a, b in zip(pts, pts[1:]): acc.append(acc[-1] + math.dist(a, b))
    out, j = [], 0
    for k in range(n):
        t = acc[-1] * k / (n - 1)
        while j < len(pts) - 2 and acc[j + 1] < t: j += 1
        f = (t - acc[j]) / ((acc[j + 1] - acc[j]) or 1)
        out.append([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f])
    return out

def reshape(i0, i1, left, right):
    n = i1 - i0 + 1
    pre, post = c[i0 - 2], c[i1 + 2]               # fixed neighbours, for the tangents at both ends
    pts = [list(c[i]) for i in range(i0, i1 + 1)]
    half = [hw[i] for i in range(i0, i1 + 1)]
    for _ in range(60):
        ext = [pre, c[i0 - 1]] + pts + [c[i1 + 1], post]
        new = [pts[0]]
        for k in range(1, n - 1):
            a, b = ext[k + 1], ext[k + 3]
            l = math.dist(a, b) or 1
            tx, tz = (b[0] - a[0]) / l, (b[1] - a[1]) / l
            rn = (-tz, tx)                          # right of the direction of travel
            dl = ray_hit(pts[k], (-rn[0], -rn[1]), left)
            dr = ray_hit(pts[k], rn, right)
            if dl is None or dr is None:
                new.append(pts[k]); continue
            m = (dr - dl) / 2
            new.append([pts[k][0] + rn[0] * m * 0.5, pts[k][1] + rn[1] * m * 0.5])
            half[k] = (dl + dr) / 2
        new.append(pts[-1])
        # a light smoothing pass, then spread the points evenly again
        sm = [new[0]] + [[(new[k - 1][j] + 2 * new[k][j] + new[k + 1][j]) / 4 for j in (0, 1)] for k in range(1, n - 1)] + [new[-1]]
        pts = even(sm, n)
    # half-widths smoothed along the stretch, ends easing into the untouched neighbours
    half[0], half[-1] = hw[i0], hw[i1]
    for _ in range(3):
        half = [half[0]] + [(half[k - 1] + 2 * half[k] + half[k + 1]) / 4 for k in range(1, n - 1)] + [half[-1]]
    for k in range(n):
        c[i0 + k] = pts[k]; hw[i0 + k] = half[k]

for i0, i1, left, right in RESHAPE:
    reshape(i0, i1, left, right)
total = sum(math.dist(c[i - 1], c[i]) for i in range(1, N)) + math.dist(c[-1], c[0])
s = [0.0]
for i in range(1, N): s.append(s[-1] + math.dist(c[i - 1], c[i]))

def near(p):
    return min(range(N), key=lambda i: math.dist(c[i], p))
# checkpoints: Martin's green line (2026-11-17, was the Kroonuaia river corner) and three more
# around the lap, each must be passed before the finish counts
cps = [near(p) for p in [(1009, 3020), (1330, 2185), (660, 2900), (1230, 3460)]]
# spawn: on Uueturu at the Ülikooli crossing (green line), facing along the track
sp = near((1545, 3172))

out = {
    'name': 'Toomemägi',
    'length': round(total, 1),
    'pts': [[round(p[0], 2), round(p[1], 2)] for p in c],
    'hw': [round(h, 2) for h in hw],
    'checkpoints': cps,
    'spawn': sp,
}
json.dump(out, open(os.path.join(ROOT, 'src/race/track.json'), 'w'), separators=(',', ':'))
print('length', round(total), 'points', N, 'checkpoints', cps, 'spawn', sp, c[sp])
