#!/usr/bin/env python3
"""What Tallinn's centre houses are built of (28 Nov 2026), for the building shader (src/world/scenery.js setFacades).

Usage:  python3 tools/tln/facades.py OSM_CLIP.json AREA.json     -> public/data/tln/facades.json

Per map square ("sx_sz") a flat list [x, z, kind, rgb, ...]: a point inside each house (game metres, one decimal),
what it is (below) and its wall colour from OpenStreetMap (-1 when not tagged). Kinds:
  0  only a colour                       1  a wooden house (boards, white trims, a stone ground floor when tall)
  2  limestone, industrial (rows of small windows: the Rotermann mills, Kultuurikatel)
  3  red brick                           4  glass
Sources: OpenStreetMap's building:material and building:colour, plus what Mapillary's street photos show by area:
Kalamaja and Kadriorg are mostly two and three storey wooden houses (photos of Kungla, Vana-Kalamaja and Koidula
streets, 2022-2025), so an untagged low house there is taken as wood (the shader also checks its height); the old
mills and warehouses of Rotermann and the Kalamaja port are limestone (Elevaator, the flour stores, the salt store).
"""
import json, os, sys
from collections import defaultdict
from pyproj import Transformer
from shapely.geometry import Polygon

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'public', 'data', 'tln', 'facades.json')
E0, N0 = 548000.0, 6592000.0
S, G0 = 640.0, -800.0
T = Transformer.from_crs('EPSG:4326', 'EPSG:3301', always_xy=True)


def game(lon, lat):
    e, n = T.transform(lon, lat)
    return e - E0, N0 - n


def sec(x, z): return f'{int((x - G0) // S)}_{int((z - G0) // S)}'


def zone(ll): return Polygon([game(lon, lat) for lon, lat in ll])


# areas of wooden houses (lon, lat)
WOOD = [
    zone([(24.7215, 59.4430), (24.7230, 59.4480), (24.7330, 59.4520), (24.7420, 59.4500), (24.7470, 59.4470), (24.7440, 59.4415),
          (24.7370, 59.4385), (24.7290, 59.4380), (24.7215, 59.4400)]),                                                  # Kalamaja
    zone([(24.7690, 59.4335), (24.7720, 59.4420), (24.7800, 59.4440), (24.7900, 59.4425), (24.7950, 59.4370), (24.7900, 59.4320),
          (24.7790, 59.4310)]),                                                                                          # Kadriorg
]
# old limestone works: Rotermann and the Kalamaja port along Põhja puiestee
STONE = [
    zone([(24.7535, 59.4380), (24.7540, 59.4410), (24.7600, 59.4410), (24.7610, 59.4385), (24.7590, 59.4382)]),          # Rotermann
]
# by address, from the street photos: the Rotermann mills and the salt store, Kultuurikatel (the old power station's
# grey stone halls; its neighbours along Põhja puiestee are new rendered flats, 2018-2026 photos)
STONE_ADDR = {('Rotermanni', '2'), ('Rotermanni', '8'), ('Ahtri', '2'), ('Rotermanni', '12'), ('Põhja pst', '31')}
COLOUR_ADDR = {('Põhja pst', '29'): 0xE3CF8E}          # the power station's long yellow hall with its band of windows
WOODY = {'yes', 'house', 'apartments', 'detached', 'residential', 'semidetached_house', 'terrace'}
NAMED = {'white': 0xEEEEEA, 'yellow': 0xE6CF7A, 'beige': 0xD9CBAE, 'grey': 0x9A9A98, 'gray': 0x9A9A98, 'red': 0x9E3A2E,
         'brown': 0x7A5238, 'green': 0x8FA67E, 'blue': 0x7E93A6, 'pink': 0xD9A3A0, 'orange': 0xD98A4E, 'black': 0x2A2A2A}


def colour(t):
    c = (t.get('building:colour') or '').strip().lower()
    if c.startswith('#') and len(c) in (4, 7):
        if len(c) == 4: c = '#' + ''.join(ch * 2 for ch in c[1:])
        try: return int(c[1:], 16)
        except ValueError: return -1
    return NAMED.get(c, -1)


osm = json.load(open(sys.argv[1]))
area = Polygon([(e - E0, N0 - n) for e, n in json.load(open(sys.argv[2]))]).buffer(60)
out = defaultdict(list)
count = defaultdict(int)
for w in osm['ways']:
    t = w.get('t', {})
    b = t.get('building')
    if not b or b in ('roof', 'construction', 'ruins') or t.get('location') == 'underground' or len(w['ll']) < 4: continue
    try:
        P = Polygon([game(lon, lat) for lon, lat in w['ll']])
        if not P.is_valid: P = P.buffer(0)
        if P.is_empty or P.area < 12: continue
    except Exception:
        continue
    c = P.representative_point()
    if not area.contains(c): continue
    mat = (t.get('building:material') or '').lower()
    rgb = COLOUR_ADDR.get((t.get('addr:street'), t.get('addr:housenumber')), colour(t))
    kind = None
    if mat == 'wood': kind = 1
    elif mat in ('stone', 'limestone'): kind = 2
    elif mat == 'brick': kind = 3
    elif mat == 'glass': kind = 4
    elif (t.get('addr:street'), t.get('addr:housenumber')) in STONE_ADDR: kind = 2
    elif not mat and b == 'industrial' and any(z.contains(c) for z in STONE): kind = 2
    elif not mat and b in WOODY and any(z.contains(c) for z in WOOD):
        lv = t.get('building:levels')
        try: lv = float(lv) if lv else 0
        except ValueError: lv = 0
        if lv <= 3 and t.get('roof:shape', 'gabled') not in ('flat',): kind = 1
    if kind is None:
        if rgb < 0: continue
        kind = 0
    out[sec(c.x, c.y)] += [round(c.x, 1), round(c.y, 1), kind, rgb]
    count[kind] += 1
json.dump(dict(out), open(OUT, 'w'), separators=(',', ':'))
print({k: count[k] for k in sorted(count)}, os.path.getsize(OUT), 'bytes')
