"""Builds src/race/pirita.json: Tallinn's Pirita-Kose-Kloostrimetsa circuit, routed along the real streets.

Martin's red trace (27 Nov 2026, /mnt/project-files/tallinn-plan/pirita-circuit-route-martin.png), driven
counterclockwise: the start/finish straight on Rummu tee (the Kose straight: Rummu tee runs on into Kose tee), right
onto Lükati tee by Kose tee 64, down over the Lükati bridge and along the river, north up Lükati tee through the pines,
the link road round onto Kloostrimetsa tee, west through its curves to Merivälja tee, south over the Pirita bridge on
Pirita tee and left onto Rummu tee by the velodrome. The waypoints are joined by shortest paths on the ETAK street
network of the Tallinn bake (public/data/tln/vectors.json, world x east, z south). The output has the same shape as
src/race/track.json (Toomemägi's), so the game's lap logic, gates and the server's checks take it as they are.
Run: python3 tools/race/build-pirita.py
"""
import json, heapq, math, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
d = json.load(open(os.path.join(ROOT, 'public/data/tln/vectors.json')))
OK = {'Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Muu tee'}

# in driving order, starting at the start/finish line on Rummu tee
START = (-450, 342)
WAYPOINTS = [
    START, (0, 430), (300, 490),                                  # Rummu tee into Kose tee, the Kose straight
    (370, 380), (496, 271), (700, 330), (1000, 275),              # Lükati tee down over the bridge, along the river
    (1150, 150), (1170, -100), (1240, -350), (1270, -440),        # north up Lükati tee
    (1265, -500), (1100, -495), (960, -490),                      # the link round onto Kloostrimetsa tee
    (700, -390), (560, -370), (300, -420), (100, -520), (-140, -534), (-220, -624), (-500, -600), (-714, -570),
    (-726, -480), (-763, -366), (-828, -296),                     # Merivälja tee south, the Pirita bridge
    (-962, -156), (-1030, -78), (-1100, 0),                       # Pirita tee
    (-1050, 40), (-840, 140), (-760, 210), (-600, 310), START,    # Rummu tee
]
# the lap's own streets: waypoints snap only onto these, and the way between them keeps to them (any other street
# costs four times its length). Along Merivälja tee, over the Pirita bridge and down Pirita tee the lap keeps to
# the inner carriageway, the one on the left of the green strip as the lap runs (the map's Tallinna-Viimsi-Randvere
# tee, today's northbound one), so it never crosses the strip (Martin 28 Nov 2026: "move the merivälja tee part to
# the inside track indeed"; the air photos of 1994 to 2008 show the strip was there in the circuit's last years).
# Until then it ran on the outer one ('Merivälja tee 2', 'Pirita tee').
# NB the lap's dressing (src/world/tln/pirita.js) names lap points by number: a rebuild that changes the number of
# points needs those moved. The change of 28 Nov was spliced in with the count kept.
LAP_ROADS = {'Rummu tee', 'Kose tee', 'Lükati tee', 'Lükati tee MS Kloostrimetsa teele', 'Kloostrimetsa tee', 'Tallinna-Viimsi-Randvere tee'}

nodes, coords, adj, width, name = {}, [], [], {}, {}
def nid(p):
    k = (round(p[0] / 1.5), round(p[1] / 1.5))
    if k not in nodes:
        nodes[k] = len(coords); coords.append(p); adj.append([])
    return nodes[k]
for r in d['roads']:
    if r['type'] not in OK: continue
    pts = r['pts']
    if not any(-1600 < p[0] < 1800 and -1400 < p[1] < 1000 for p in pts): continue
    ids = [nid(p) for p in pts]
    pen = 1.0 if r['name'] in LAP_ROADS else 4.0
    for a, b in zip(ids, ids[1:]):
        if a == b: continue
        w = math.dist(coords[a], coords[b]) * pen
        adj[a].append((b, w)); adj[b].append((a, w))
        width[(a, b)] = width[(b, a)] = r['w']
        name[(a, b)] = name[(b, a)] = r['name'] or r['type']

on_lap = set()
for (a, b), n in name.items():
    if n in LAP_ROADS: on_lap.add(a)
def snap(p):
    return min(on_lap, key=lambda i: math.dist(coords[i], p))

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
if route[-1] == route[0]: route.pop()
pts = [coords[i] for i in route]
if os.environ.get('NAMES'):
    run, acc = None, 0.0
    for i in range(len(route)):
        a, b = route[i], route[(i + 1) % len(route)]
        n = name.get((a, b), '?')
        if n != run:
            if run: print(f'  {run}: {acc:.0f} m')
            run, acc = n, 0.0
            print('   at', [round(v) for v in coords[a]])
        acc += math.dist(coords[a], coords[b])
    print(f'  {run}: {acc:.0f} m')
ws = [width.get((route[i], route[(i + 1) % len(route)]), 7.6) for i in range(len(route))]

# resample every 2 m, carrying the road width
STEP = 2.0
res, rw = [], []
for i in range(len(pts)):
    a, b = pts[i], pts[(i + 1) % len(pts)]
    L = math.dist(a, b); n = max(1, int(L / STEP))
    if L < 0.01: continue
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
# half the road's width (the map's widths are the paved width plus 0.6 m), no less than a lane each way
hw = [max(3.4, v[0] / 2) for v in smooth([(min(w - 0.6, 14.0),) for w in rw], 10)]

# straighten knots, as for Toomemägi: where the street network runs round a tiny loop at a junction
def straighten():
    head = lambda k: math.atan2(c[(k + 1) % N][1] - c[k % N][1], c[(k + 1) % N][0] - c[k % N][0])
    wrap = lambda a: math.atan2(math.sin(a), math.cos(a))
    i = 0
    while i < N:
        for j in range(i + 24, i + 5, -1):
            net = abs(wrap(head(j) - head(i)))
            turn = sum(abs(wrap(head(k + 1) - head(k))) for k in range(i, j))
            if net < 0.35 and turn > 2.0:
                a, b = c[i % N], c[j % N]
                for k in range(i + 1, j):
                    t = (k - i) / (j - i)
                    c[k % N] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
                print('straightened', i, j)
                i = j
                break
        i += 1
straighten()

# the start/finish line at index 0
i0 = min(range(N), key=lambda i: math.dist(c[i], START))
c = c[i0:] + c[:i0]; hw = hw[i0:] + hw[:i0]
# the lap keeps its 2941 points: the dressing, the checkpoints and the spawn name them by number. The stretch that
# moved to the inner carriageway on 28 Nov (points 2192 to 2582, Kloostrimetsa tee's end to Rummu tee) is shorter
# than the old one, so its points are spread evenly over it, 1.92 m apart instead of 2.06
KEEP_N, K0, K1 = 2941, 2192, 2582
if N != KEEP_N:
    e = K1 + N - KEEP_N
    seg, sh = c[K0:e + 1], hw[K0:e + 1]
    cum = [0.0]
    for a_, b_ in zip(seg, seg[1:]): cum.append(cum[-1] + math.dist(a_, b_))
    np_, nh, j = [], [], 0
    for k in range(K1 - K0 + 1):
        s = cum[-1] * k / (K1 - K0)
        while j < len(cum) - 2 and cum[j + 1] < s: j += 1
        t = (s - cum[j]) / (cum[j + 1] - cum[j]) if cum[j + 1] > cum[j] else 0
        np_.append([seg[j][0] + t * (seg[j + 1][0] - seg[j][0]), seg[j][1] + t * (seg[j + 1][1] - seg[j][1])])
        nh.append(sh[j] + t * (sh[j + 1] - sh[j]))
    c = c[:K0] + np_ + c[e + 1:]; hw = hw[:K0] + nh + hw[e + 1:]
    N = len(c)
    assert N == KEEP_N
total = sum(math.dist(c[i - 1], c[i]) for i in range(1, N)) + math.dist(c[-1], c[0])

def near(p):
    return min(range(N), key=lambda i: math.dist(c[i], p))
# checkpoints, at the lap's own places and not by distance (Martin 28 Nov 2026: "4 splits in some nice logical
# places"; seven for half an hour that morning): over the Lükati bridge, onto Kloostrimetsa tee, out of the big S,
# out of Rummu kurv onto the finish straight
cps = [638, 1360, 1990, 2590]
# spawn: back up Rummu tee, about 620 m before the line, past the setts by the Pirita tee lights, facing along the
# lap (Martin 28 Nov 2026: "bring the spawning area back so i can get a faster speed right away over the line";
# it was 200 m, as Toomemägi's is)
back, sp = 0.0, N - 1
while back < 619:
    back += math.dist(c[sp], c[sp - 1]); sp -= 1

out = {
    'name': 'Pirita-Kose',
    'length': round(total, 1),
    'pts': [[round(p[0], 2), round(p[1], 2)] for p in c],
    'hw': [round(h, 2) for h in hw],
    'checkpoints': cps,
    'spawn': sp,
}
json.dump(out, open(os.path.join(ROOT, 'src/race/pirita.json'), 'w'), separators=(',', ':'))
print('length', round(total), 'points', N, 'checkpoints', cps, 'spawn', sp, c[sp])
