#!/usr/bin/env python3
"""Shops and other named places from an OpenStreetMap extract, for the shop signs.

Usage:  python3 tools/realism/osm_pois.py estonia-latest.osm.pbf OUT.json

Keeps shops, fuel stations, cafes, restaurants, pharmacies, banks, hotels and the like inside the
drivable boundary, as points in L-EST97 (ways and areas by their centre).
Data (c) OpenStreetMap contributors, ODbL.
"""
import json, os, sys
import osmium
from pyproj import Transformer
from shapely.geometry import Polygon, Point

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
T = Transformer.from_crs(4326, 3301, always_xy=True)
TL = Transformer.from_crs(3301, 4326, always_xy=True)
AMENITY = {'fuel', 'restaurant', 'cafe', 'fast_food', 'pharmacy', 'bank', 'pub', 'bar', 'cinema', 'theatre',
           'post_office', 'car_wash', 'nightclub', 'ice_cream', 'veterinary', 'dentist', 'clinic', 'library'}
TOURISM = {'hotel', 'hostel', 'guest_house', 'museum', 'motel'}
KEYS = ('name', 'brand', 'shop', 'amenity', 'tourism', 'building', 'addr:street', 'addr:housenumber', 'level', 'operator')


def wanted(t):
    if not ('name' in t or 'brand' in t): return False
    return 'shop' in t or t.get('amenity') in AMENITY or t.get('tourism') in TOURISM


class H(osmium.SimpleHandler):
    def __init__(self, area, bbox):
        super().__init__(); self.out = []; self.poly = area; self.bbox = bbox
    def add(self, kind, oid, lon, lat, t):
        w, s, e, n = self.bbox
        if not (w <= lon <= e and s <= lat <= n): return
        E, N = T.transform(lon, lat)
        if not self.poly.contains(Point(E, N)): return
        self.out.append({'osm': f'{kind}{oid}', 'e': round(E, 2), 'n': round(N, 2), **{k: t[k] for k in KEYS if k in t}})
    def node(self, n):
        if wanted(n.tags): self.add('n', n.id, n.location.lon, n.location.lat, n.tags)
    def area(self, a):
        if not wanted(a.tags): return
        try:
            pts = [(p.lon, p.lat) for ring in a.outer_rings() for p in ring]
        except Exception:
            return
        if not pts: return
        lon = sum(p[0] for p in pts) / len(pts); lat = sum(p[1] for p in pts) / len(pts)
        self.add('w' if a.from_way() else 'r', a.orig_id(), lon, lat, a.tags)


def main():
    b = json.load(open(os.path.join(ROOT, 'tools/bake/boundary.json')))
    area = Polygon(b).buffer(30)
    lons, lats = TL.transform([p[0] for p in b], [p[1] for p in b])
    h = H(area, (min(lons) - 0.01, min(lats) - 0.01, max(lons) + 0.01, max(lats) + 0.01))
    h.apply_file(sys.argv[1], locations=True)
    json.dump(h.out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
    print(len(h.out), 'places')


if __name__ == '__main__':
    main()
