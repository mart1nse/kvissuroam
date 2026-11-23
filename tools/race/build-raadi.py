"""Builds src/race/raadi.json: the Raadi rally stage, a copy of SSS16 "Tartu vald" of Rally Estonia 2026.

The real stage (1.76 km, all gravel, 18 July 2026) ran on the paths of Raadi manor park round the
Majoraadi ponds, north of ERM. tools/race/raadi-traced.json is its line traced from rally-maps.com onto
the Land Board's aerial photo (world x, z). Here it is laid onto the game's own paths in
public/data/vectors.json: the route goes through the traced line's points and the hand-placed points
below, joined by shortest paths on the path network.

The game's map has no path for the stage's cut-through from the stem of the east loop to the road east of
the pond: it is in src/world/raadipaths.json (drawn from the air photo; the game adds it to its map too).

Writes, for src/race/raadi.js:
  pts    centre line every 2 m (world x, z), from the start line to the stop board
  hw     half-width of the path at each point
  start  index of the start line, finish: index of the flying finish (the stop board is the last point)
  gravelFrom: the first straight up to this index is old tarmac (no wheel tracks worn into it)
  line   the racing line: sideways offset from the centre line at each point (+ is right of travel)
  apex   corners: [index, side (1 right, -1 left), cone x, cone z]
  junctions: where other paths meet the route; per side path the point of a barrier across it and the
         index ranges of the stage during which that path is shut (a barrier that moves: the stage passes
         some junctions twice, going another way each time)
Run: python3 tools/race/build-raadi.py
"""
import json, heapq, math, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
d = json.load(open(os.path.join(ROOT, 'public/data/vectors.json')))
traced = json.load(open(os.path.join(os.path.dirname(__file__), 'raadi-traced.json')))
BOX = (2300, 250, 3000, 800)
# paths the map lacks: each end is also put into the path it meets, so that the two join
PATHS = json.load(open(os.path.join(ROOT, 'src/world/raadipaths.json')))
for g in PATHS['gravel']:                            # (the first straight: narrower than the map's street)
    for q in d['roads']:
        if len(q['pts']) == g['n'] and {tuple(q['pts'][0]), tuple(q['pts'][-1])} == {tuple(g['pts'][0]), tuple(g['pts'][1])}: q['w'] = g['w']
for r in PATHS['add']:
    for e in (r['pts'][0], r['pts'][-1]):
        best = None
        for q in d['roads']:
            for i in range(len(q['pts']) - 1):
                a, b = q['pts'][i], q['pts'][i + 1]
                dx, dz = b[0] - a[0], b[1] - a[1]
                t = max(0, min(1, ((e[0] - a[0]) * dx + (e[1] - a[1]) * dz) / (dx * dx + dz * dz or 1)))
                dd = math.dist(e, (a[0] + dx * t, a[1] + dz * t))
                if best is None or dd < best[0]: best = (dd, q, i)
        assert best[0] < 1, best[0]
        best[1]['pts'].insert(best[2] + 1, list(e))
    d['roads'].append(r)

nodes, coords, adj, width = {}, [], [], {}
def nid(p):
    k = (round(p[0] / 1.0), round(p[1] / 1.0))
    if k not in nodes:
        nodes[k] = len(coords); coords.append(tuple(p)); adj.append([])
    return nodes[k]
for r in d['roads']:
    pts = r['pts']
    if not any(BOX[0] < p[0] < BOX[2] and BOX[1] < p[1] < BOX[3] for p in pts): continue
    if r.get('type') in ('Põhimaantee', 'Tugimaantee'): continue      # Narva mnt: the stage only crosses it
    ids = [nid(p) for p in pts]
    for a, b in zip(ids, ids[1:]):
        if a == b or any(v == b for v, _ in adj[a]): continue
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

# in driving order: up the old tarmac lane beside the manor wall and right at the park road's mouth (the
# stage's first straight and corner), the traced line round the west loop and down the west side of the
# ponds, then by hand (the game's paths) round the east loop, back over the top of the ponds, down the
# west side again, and the traced line to the finish; then on down the path to the stop board
WP = [(2374.7, 500.4), (2416.5, 449.6)] + [traced[i] for i in range(4, 45, 2)] + [
    (2790, 495), (2820, 512), (2836, 472), (2858, 461), (2870, 449), (2895, 446), (2912, 410), (2918, 382),
    (2895, 362), (2874, 372), (2871, 392), (2857, 415), (2841, 419), (2826, 415), (2817, 395), (2808, 375),
    (2780, 370), (2762, 382), (2760, 440), (2761, 480), (2790, 495), (2820, 512), (2840, 540), (2856, 572),
    (2830, 618), (2806, 672), (2760, 680), (2738, 652), (2718, 633), (2716, 660), (2712, 700), (2706, 724)]
S = [snap(p) for p in WP]
route = [S[0]]
for a, b in zip(S, S[1:]):
    if a != b: route += path(a, b)[1:]
# a point snapped just past a junction leaves a spur (there and straight back): cut it out
changed = True
while changed:
    changed = False
    for i in range(1, len(route) - 1):
        if route[i - 1] == route[i + 1]:
            del route[i:i + 2]; changed = True; break
pts = [coords[i] for i in route]
ws = [width[(route[i], route[i + 1])] for i in range(len(route) - 1)]

STEP = 2.0
res, rw, rnode = [], [], []
for i in range(len(pts) - 1):
    a, b = pts[i], pts[i + 1]
    L = math.dist(a, b); n = max(1, round(L / STEP))
    for k in range(n):
        t = k / n
        res.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); rw.append(ws[i]); rnode.append(route[i] if k == 0 else -1)
res.append(pts[-1]); rw.append(ws[-1]); rnode.append(route[-1])
N = len(res)

def smooth(vals, radius):
    out = []
    for i in range(N):
        acc = [0.0] * len(vals[0]); wsum = 0
        for k in range(-radius, radius + 1):
            j = min(N - 1, max(0, i + k))
            w = math.exp(-0.5 * (k / (radius / 2)) ** 2)
            for q in range(len(acc)): acc[q] += vals[j][q] * w
            wsum += w
        out.append([a / wsum for a in acc])
    return out

c = smooth(res, 2)                                   # rounds the polyline's knees (a few metres)
c[0], c[-1] = list(res[0]), list(res[-1])
hw = [max(2.3, v[0] / 2) for v in smooth([(w,) for w in rw], 4)]
s = [0.0]
for i in range(1, N): s.append(s[-1] + math.dist(c[i - 1], c[i]))

def at(dist): return min(range(N), key=lambda i: abs(s[i] - dist))
START = at(13.0)                                     # on the lane, 50 m before the corner
GRAVEL = min(range(N), key=lambda i: math.dist(c[i], (2416.5, 449.6))) + 2     # tarmac up to here
# the flying finish: on the path south of the hairpin, where rally-maps puts the finish flag
FIN = min(range(N), key=lambda i: math.dist(c[i], (2716, 662)) if s[i] > s[-1] - 120 else 1e9)
print(f'{N} points, {s[-1]:.0f} m in all, stage {s[FIN] - s[START]:.0f} m (official 1760), start {START}, finish {FIN}')

# tangents and curvature
def tan(i):
    a, b = c[max(0, i - 1)], c[min(N - 1, i + 1)]
    l = math.dist(a, b) or 1
    return ((b[0] - a[0]) / l, (b[1] - a[1]) / l)
T = [tan(i) for i in range(N)]
def head(i): return math.atan2(T[i][1], T[i][0])
def wrap(a): return math.atan2(math.sin(a), math.cos(a))

# ---- the racing line: an elastic band pulled tight within the path, a little in from either edge
off = [0.0] * N
for it in range(400):
    new = off[:]
    for i in range(1, N - 1):
        # where the neighbours' points are, sideways from this centre point
        px = [c[j][0] + (-T[j][1]) * off[j] for j in (i - 1, i + 1)]
        pz = [c[j][1] + T[j][0] * off[j] for j in (i - 1, i + 1)]
        mx, mz = (px[0] + px[1]) / 2, (pz[0] + pz[1]) / 2
        want = (mx - c[i][0]) * (-T[i][1]) + (mz - c[i][1]) * T[i][0]
        lim = max(0.0, hw[i] - 1.05)
        new[i] = max(-lim, min(lim, off[i] + 0.6 * (want - off[i])))
    off = new
for i in range(START + 1): off[i] = 0.0
off = [v[0] for v in smooth([(o,) for o in off], 2)]

# ---- corners: a run of points turning one way; the apex is where the racing line comes nearest the inside
apex = []
turn = [wrap(head(min(N - 1, i + 2)) - head(max(0, i - 2))) / (s[min(N - 1, i + 2)] - s[max(0, i - 2)] or 1) for i in range(N)]   # rad per metre
i = START
while i < FIN:
    if abs(turn[i]) > 0.035:                        # tighter than about 28 m radius
        j = i
        while j < FIN and abs(turn[j]) > 0.02 and (turn[j] > 0) == (turn[i] > 0): j += 1
        total = sum(turn[k] * (s[k + 1] - s[k]) for k in range(i, j))
        if abs(total) > 0.6:                        # more than about 35 degrees
            side = 1 if total > 0 else -1           # (z points south, so a positive turn is to the right)
            k = max(range(i, j + 1), key=lambda q: side * off[q]) if j > i else i
            k = max(range(i, j + 1), key=lambda q: abs(turn[q])) if abs(off[k]) < 0.5 else k
            nx, nz = -T[k][1] * side, T[k][0] * side
            cone = (c[k][0] + nx * (hw[k] + 1.0), c[k][1] + nz * (hw[k] + 1.0))
            apex.append([k, side, round(cone[0], 2), round(cone[1], 2), round(math.degrees(abs(total)))])
        i = j + 1
    else: i += 1
# no two cones closer than 12 m (an S bend's two apexes, the double pass of the west side)
keep = []
for a in apex:
    if all(math.dist(a[2:4], b[2:4]) > 12 for b in keep): keep.append(a)
apex = keep
print('apexes', [(a[0], a[1], a[4]) for a in apex])

# ---- junctions: graph nodes on the route with paths leaving that the route does not take (at that pass)
nodeIdx = {}
for i, n in enumerate(rnode):
    if n >= 0: nodeIdx.setdefault(n, []).append(i)
junctions = []
for n, idxs in nodeIdx.items():
    if len(adj[n]) < 3: continue
    passes = []
    for i in idxs:
        if i < START - 3 or i > FIN + 2: continue
        prv = next((rnode[k] for k in range(i - 1, -1, -1) if rnode[k] >= 0), None)
        nxt = next((rnode[k] for k in range(i + 1, N) if rnode[k] >= 0), None)
        passes.append((i, prv, nxt))
    if not passes: continue
    used = set()
    for _, a, b in passes: used |= {a, b}
    branches = []
    for v, _ in adj[n]:
        # a barrier 5 m down the side path, across it
        px, pz = coords[n]
        # walk 5 m along the branch
        prev, cur, dist = n, v, math.dist(coords[n], coords[v])
        while dist < 5 and len(adj[cur]) == 2:
            nn = [u for u, _ in adj[cur] if u != prev][0]
            dist += math.dist(coords[cur], coords[nn]); prev, cur = cur, nn
        bx, bz = coords[cur]
        l = math.dist((bx, bz), (px, pz)) or 1
        ux, uz = (bx - px) / l, (bz - pz) / l
        k = min(5.0, l)
        x, z = px + ux * k, pz + uz * k
        # shut during each pass that does not use it: the index window round that pass
        shut = [[max(0, i - 40), min(N - 1, i + 12)] for i, a, b in passes if v not in (a, b)]
        if not shut: continue
        branches.append({'x': round(x, 2), 'z': round(z, 2), 'yaw': round(math.atan2(ux, -uz), 3),
                         'w': round(width.get((n, v), 4.6), 1), 'shut': shut, 'always': len(shut) == len(passes)})
    if branches:
        junctions.append({'x': round(coords[n][0], 2), 'z': round(coords[n][1], 2), 'passes': [p[0] for p in passes], 'b': branches})
print('junctions', len(junctions), 'moving', sum(1 for j in junctions for b in j['b'] if not b['always']))

out = {
    'name': 'Raadi', 'stage': 'SSS16 Tartu vald', 'length': round(s[FIN] - s[START], 1),
    'start': START, 'finish': FIN, 'gravelFrom': GRAVEL,
    'pts': [[round(x, 2), round(z, 2)] for x, z in c], 'hw': [round(h, 2) for h in hw],
    'line': [round(o, 2) for o in off], 'apex': apex, 'junctions': junctions,
}
json.dump(out, open(os.path.join(ROOT, 'src/race/raadi.json'), 'w'), separators=(',', ':'))
print('wrote src/race/raadi.json')
