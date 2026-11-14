#!/usr/bin/env python3
"""Bake Mapillary map features (street lights, signs, crossings ...) into public/data/props.json.

Usage:  MAPILLARY_TOKEN=... python3 tools/mapillary/features.py [CACHE.json]

Downloads every detected map feature inside the drivable boundary (cached in
CACHE.json so the processing can be re-run), keeps the kinds the game draws,
moves anything that landed on a carriageway to the roadside, lines crossings up
with the road they cross, and writes them per sector. Data (c) Mapillary, CC BY-SA.
"""
import json, math, os, sys, time, urllib.request
from pyproj import Transformer

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
E0, N0 = 657800.0, 6477150.0
SECTOR, GRID0 = 640.0, -800.0
API = 'https://graph.mapillary.com'
TOKEN = os.environ.get('MAPILLARY_TOKEN')
TO_LL = Transformer.from_crs(3301, 4326, always_xy=True)
TO_EST = Transformer.from_crs(4326, 3301, always_xy=True)

# kind ids used by src/world/props.js
LIGHT, POLE, SIGNAL, BENCH, BIN, RACK, BOX, ZEBRA = 0, 1, 2, 3, 4, 5, 6, 7
SIGN0 = 10          # 10 + sign face
FACES = ['speed', 'prohibit', 'noentry', 'mandatory', 'warning', 'yield', 'priority', 'crossing', 'info', 'stop']


def classify(v):
    if v == 'object--street-light': return LIGHT
    if v == 'object--support--utility-pole': return POLE
    if v.startswith('object--traffic-light--general'): return SIGNAL
    if v == 'object--bench': return BENCH
    if v == 'object--trash-can': return BIN
    if v == 'object--bike-rack': return RACK
    if v == 'object--junction-box': return BOX
    if v == 'marking--discrete--crosswalk-zebra': return ZEBRA
    if v.startswith('regulatory--maximum-speed-limit'): return SIGN0 + 0
    if v.startswith('regulatory--no-entry'): return SIGN0 + 2
    if v.startswith('regulatory--yield'): return SIGN0 + 5
    if v.startswith('regulatory--stop'): return SIGN0 + 9
    if v.startswith('regulatory--priority-road'): return SIGN0 + 6
    if v.startswith(('regulatory--keep-', 'regulatory--go-', 'regulatory--turn-', 'regulatory--roundabout',
                     'regulatory--dual-path', 'regulatory--shared-path', 'regulatory--pedestrians-only',
                     'regulatory--bicycles-only')): return SIGN0 + 3
    if v.startswith('regulatory--'): return SIGN0 + 1
    if v.startswith('warning--'): return SIGN0 + 4
    if v.startswith('information--pedestrians-crossing'): return SIGN0 + 7
    if v.startswith('information--') and 'general-directions' not in v: return SIGN0 + 8
    return None


def get(url):
    req = urllib.request.Request(url)
    if TOKEN: req.add_header('Authorization', 'OAuth ' + TOKEN)
    for k in range(5):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())['data']
        except Exception as ex:
            err = ex
            time.sleep(2 + 3 * k)
    print('giving up on', url, err)
    return []


def download(cache):
    b = json.load(open(os.path.join(ROOT, 'tools/bake/boundary.json')))
    lons, lats = zip(*[TO_LL.transform(e, n) for e, n in b])
    w, e, s, n = min(lons), max(lons), min(lats), max(lats)
    out = {}
    def fetch(w, s, e, n, depth=0):
        d = get(f'{API}/map_features?bbox={w:.6f},{s:.6f},{e:.6f},{n:.6f}&limit=2000'
                '&fields=id,object_value,geometry,aligned_direction')
        if len(d) >= 2000 and depth < 3:           # the reply is capped: split the box
            mx, my = (w + e) / 2, (s + n) / 2
            for bb in ((w, s, mx, my), (mx, s, e, my), (w, my, mx, n), (mx, my, e, n)):
                fetch(*bb, depth + 1)
            return
        for x in d:
            out[x['id']] = [x['object_value'], *x['geometry']['coordinates'], x.get('aligned_direction')]
    nx, ny = math.ceil((e - w) / 0.012), math.ceil((n - s) / 0.007)
    for j in range(ny):
        for i in range(nx):
            fetch(w + (e - w) * i / nx, s + (n - s) * j / ny, w + (e - w) * (i + 1) / nx, s + (n - s) * (j + 1) / ny)
        print(f'row {j + 1}/{ny}: {len(out)} features', flush=True)
    json.dump(out, open(cache, 'w'))


def inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else '/tmp/mapillary_features.json'
    if not os.path.exists(cache):
        download(cache)
    raw = json.load(open(cache))
    boundary = json.load(open(os.path.join(ROOT, 'tools/bake/boundary.json')))
    roads = json.load(open(os.path.join(ROOT, 'public/data/vectors.json')))['roads']
    # road segments in a 40 m grid: (x1, z1, x2, z2, width, drivable)
    grid = {}
    for r in roads:
        car = r['type'] not in ('Rada', 'Kergliiklustee')
        for (x1, z1), (x2, z2) in zip(r['pts'], r['pts'][1:]):
            seg = (x1, z1, x2, z2, r['w'], car)
            for gx in range(int(min(x1, x2) // 40) - 1, int(max(x1, x2) // 40) + 2):
                for gz in range(int(min(z1, z2) // 40) - 1, int(max(z1, z2) // 40) + 2):
                    grid.setdefault((gx, gz), []).append(seg)

    def nearest(x, z):
        best = None
        for seg in grid.get((int(x // 40), int(z // 40)), ()):
            x1, z1, x2, z2, w, car = seg
            if not car: continue
            dx, dz = x2 - x1, z2 - z1
            l2 = dx * dx + dz * dz or 1e-9
            t = max(0, min(1, ((x - x1) * dx + (z - z1) * dz) / l2))
            px, pz = x1 + dx * t, z1 + dz * t
            d = math.hypot(x - px, z - pz)
            if best is None or d < best[0]:
                l = math.sqrt(l2)
                best = (d, px, pz, dx / l, dz / l, w)
        return best

    sectors, counts, seen = {}, {}, {}
    for v, lon, lat, direction in raw.values():
        kind = classify(v)
        if kind is None: continue
        E, N = TO_EST.transform(lon, lat)
        if not inside(boundary, E, N): continue
        x, z = E - E0, N0 - N
        E2, N2 = TO_EST.transform(lon, lat + 1e-4)
        conv = math.degrees(math.atan2(E2 - E, N2 - N))
        yaw = ((direction if direction is not None else 0) + conv) % 360      # compass bearing in the game grid
        near = nearest(x, z)
        extra = 0
        if kind == ZEBRA:
            if not near or near[0] > 9: continue
            _, x, z, dx, dz, w = near
            yaw = math.degrees(math.atan2(dx, -dz)) % 360                      # along the road
            extra = round(min(w, 16), 1)
        if kind == LIGHT and near and near[0] < 30:
            yaw = math.degrees(math.atan2(near[1] - x, -(near[2] - z))) % 360   # the arm reaches over the road
        if kind == ZEBRA:
            pass
        elif near and near[0] < near[5] / 2 + 1.2:
            # on the carriageway: step out to the verge on the side it was detected
            d, px, pz, dx, dz, w = near
            side = 1 if (x - px) * -dz + (z - pz) * dx >= 0 else -1
            x, z = px - dz * side * (w / 2 + 1.5), pz + dx * side * (w / 2 + 1.5)
        # one prop of a kind per 3 m cell (the same pole is often detected twice)
        cell = (kind if kind < SIGN0 else SIGN0, round(x / (5 if kind == ZEBRA else 3)), round(z / (5 if kind == ZEBRA else 3)))
        if cell in seen: continue
        seen[cell] = 1
        key = f'{int((x - GRID0) // SECTOR)}_{int((z - GRID0) // SECTOR)}'
        sectors.setdefault(key, []).extend([kind, round(x, 1), round(z, 1), round(yaw), extra])
        counts[kind] = counts.get(kind, 0) + 1
    json.dump({'faces': FACES, 'stride': 5, 'sectors': sectors},
              open(os.path.join(ROOT, 'public/data/props.json'), 'w'), separators=(',', ':'))
    print(sorted(counts.items()), sum(counts.values()))


if __name__ == '__main__':
    main()
