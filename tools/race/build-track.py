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
