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
# Tallinn (28 Nov 2026): CITY=tallinn uses its origin, boundary and public/data/tln/. AREA=<json of L-EST97 points>
# limits the features to a part of the map (the Pirita-Kose lap has its own hand-placed lamps and signs).
CITY = os.environ.get('CITY', 'tartu')
E0, N0 = (548000.0, 6592000.0) if CITY == 'tallinn' else (657800.0, 6477150.0)
BOUNDARY = 'tools/bake/boundary' + ('' if CITY == 'tartu' else '_' + CITY) + '.json'
DATA = 'public/data/' + ('tln/' if CITY == 'tallinn' else '')
AREA = os.environ.get('AREA')
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


# the Old Town inside its walls (lon, lat): lamps there are the lantern posts
OLD_TOWN = [(24.7370, 59.4395), (24.7400, 59.4420), (24.7440, 59.4440), (24.7480, 59.4447), (24.7510, 59.4430),
            (24.7525, 59.4395), (24.7515, 59.4365), (24.7490, 59.4348), (24.7445, 59.4342), (24.7400, 59.4345),
            (24.7360, 59.4358), (24.7350, 59.4375)]
LANTERN, BOLLARD = 9, 8


def osm_kind(t):
    if t.get('highway') == 'street_lamp': return LIGHT
    a = t.get('amenity')
    if a == 'bench': return BENCH
    if a == 'waste_basket': return BIN
    if a == 'bicycle_parking': return RACK
    if t.get('barrier') == 'bollard': return BOLLARD
    if t.get('man_made') == 'street_cabinet': return BOX
    if t.get('highway') == 'crossing' or 'crossing' in t:
        c = t.get('crossing') or ''
        if c == 'traffic_signals' or t.get('crossing_ref') == 'pelican': return SIGNAL
        if c in ('marked', 'zebra', 'uncontrolled') or t.get('crossing:markings') in ('zebra', 'yes'): return ZEBRA
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
    b = json.load(open(AREA or os.path.join(ROOT, BOUNDARY)))
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
    # only the cells that touch the drivable area, a few at a time
    from concurrent.futures import ThreadPoolExecutor
    from shapely.geometry import Polygon, box
    area = Polygon([TO_LL.transform(x, y) for x, y in b])
    nx, ny = math.ceil((e - w) / 0.012), math.ceil((n - s) / 0.007)
    cells = [(w + (e - w) * i / nx, s + (n - s) * j / ny, w + (e - w) * (i + 1) / nx, s + (n - s) * (j + 1) / ny)
             for j in range(ny) for i in range(nx)]
    cells = [c for c in cells if area.intersects(box(*c))]
    with ThreadPoolExecutor(4) as ex:
        for k, _ in enumerate(ex.map(lambda c: fetch(*c), cells)):
            if k % 20 == 0:
                print(f'cell {k + 1}/{len(cells)}: {len(out)} features', flush=True)
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
    boundary = json.load(open(AREA or os.path.join(ROOT, BOUNDARY)))
    roads = json.load(open(os.path.join(ROOT, DATA + 'vectors.json')))['roads']
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
    # OSM=<clip json from osm nodes> (Tallinn centre, 28 Nov 2026): OpenStreetMap's mapped lamps, benches, bins,
    # bike racks, bollards, cabinets, crossings and crossing lights go first (they sit where they are, a detection
    # in a photo can be metres off); Mapillary then adds what is not mapped (the signs above all)
    rows = []
    if os.environ.get('OSM'):
        old_town = [TO_EST.transform(lo, la) for lo, la in OLD_TOWN]
        for nd in json.load(open(os.environ['OSM']))['nodes']:
            t = nd['t']
            kind = osm_kind(t)
            if kind is None: continue
            E, N = TO_EST.transform(*nd['ll'])
            if kind == LIGHT and inside(old_town, E, N): kind = LANTERN
            d = t.get('direction')
            try: d = float(d)
            except (TypeError, ValueError): d = None
            rows.append(('osm', kind, nd['ll'][0], nd['ll'][1], d, t))
    rows += [('mly', classify(v), lon, lat, direction, None) for v, lon, lat, direction in raw.values()]
    for src, kind, lon, lat, direction, tags in rows:
        if kind is None: continue
        if src == 'mly' and kind in (LIGHT, POLE, BENCH, BIN, RACK, BOX, ZEBRA, SIGNAL) and os.environ.get('OSM'): continue
        E, N = TO_EST.transform(lon, lat)
        if not inside(boundary, E, N): continue
        x, z = E - E0, N0 - N
        E2, N2 = TO_EST.transform(lon, lat + 1e-4)
        conv = math.degrees(math.atan2(E2 - E, N2 - N))
        yaw = ((direction if direction is not None else 0) + conv) % 360      # compass bearing in the game grid
        near = nearest(x, z)
        extra = 0
        if kind == SIGNAL and src == 'osm':
            # a crossing with lights: a post at each kerb, its head turned to the road
            if not near or near[0] > 6: continue
            _, px, pz, dx, dz, w = near
            for side in (1, -1):
                sx_, sz_ = px - dz * side * (w / 2 + 0.7), pz + dx * side * (w / 2 + 0.7)
                yaw2 = math.degrees(math.atan2(px - sx_, -(pz - sz_))) % 360
                cell = (SIGNAL, round(sx_ / 3), round(sz_ / 3))
                if cell in seen: continue
                seen[cell] = 1
                key = f'{int((sx_ - GRID0) // SECTOR)}_{int((sz_ - GRID0) // SECTOR)}'
                sectors.setdefault(key, []).extend([SIGNAL, round(sx_, 1), round(sz_, 1), round(yaw2), 0])
                counts[SIGNAL] = counts.get(SIGNAL, 0) + 1
            # and the crossing's stripes
            cell = (ZEBRA, round(px / 5), round(pz / 5))
            if cell not in seen:
                seen[cell] = 1
                key = f'{int((px - GRID0) // SECTOR)}_{int((pz - GRID0) // SECTOR)}'
                sectors.setdefault(key, []).extend([ZEBRA, round(px, 1), round(pz, 1), round(math.degrees(math.atan2(dx, -dz)) % 360), round(min(w, 16), 1)])
                counts[ZEBRA] = counts.get(ZEBRA, 0) + 1
            continue
        if kind in (BENCH, BIN, RACK, BOLLARD, BOX) and src == 'osm':
            # where it is mapped; turned to face the nearest street (a bench's seat towards it)
            if near and near[0] < 25: yaw = math.degrees(math.atan2(near[1] - x, -(near[2] - z))) % 360
            if near and near[0] < near[5] / 2 + 0.4: continue        # (mapped on the carriageway itself: a mistake)
            cell = (kind, round(x / 1.5), round(z / 1.5))
            if cell in seen: continue
            seen[cell] = 1
            key = f'{int((x - GRID0) // SECTOR)}_{int((z - GRID0) // SECTOR)}'
            sectors.setdefault(key, []).extend([kind, round(x, 1), round(z, 1), round(yaw), 0])
            counts[kind] = counts.get(kind, 0) + 1
            continue
        if kind == ZEBRA:
            if not near or near[0] > (4 if src == 'osm' else 9): continue
            _, x, z, dx, dz, w = near
            yaw = math.degrees(math.atan2(dx, -dz)) % 360                      # along the road
            extra = round(min(w, 16), 1)
        if kind in (LIGHT, LANTERN) and near and near[0] < 30:
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
              open(os.path.join(ROOT, DATA + 'props.json'), 'w'), separators=(',', ':'))
    print(sorted(counts.items()), sum(counts.values()))


if __name__ == '__main__':
    main()
