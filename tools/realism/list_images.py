#!/usr/bin/env python3
"""List every Mapillary photo inside the drivable boundary into CACHE (one JSON line per photo).

Usage:  python3 tools/realism/list_images.py CACHE.jsonl

The API returns only part of the photos in a large or busy box, so the area is asked for in small boxes. Set MAPILLARY_TOKEN, or run
where a proxy adds the Authorization header.
"""
import json, os, sys, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pyproj import Transformer
from shapely.geometry import Polygon, box

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
API = 'https://graph.mapillary.com'
TOKEN = os.environ.get('MAPILLARY_TOKEN')
FIELDS = ('id,computed_geometry,geometry,computed_compass_angle,compass_angle,camera_type,camera_parameters,'
          'computed_rotation,captured_at,sequence,thumb_256_url,width,height')
TO_LL = Transformer.from_crs(3301, 4326, always_xy=True)
TO_EST = Transformer.from_crs(4326, 3301, always_xy=True)


def get(url):
    req = urllib.request.Request(url)
    if TOKEN: req.add_header('Authorization', 'OAuth ' + TOKEN)
    err = None
    for k in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())['data']
        except Exception as ex:
            err = ex
            time.sleep(2 + 3 * k)
    print('giving up on', url[:120], err, flush=True)
    return None


def main():
    out_path = sys.argv[1]
    b = json.load(open(os.path.join(ROOT, 'tools/bake/boundary.json')))
    area = Polygon(b).buffer(60)
    lons, lats = zip(*[TO_LL.transform(e, n) for e, n in b])
    w, e, s, n = min(lons) - 0.001, max(lons) + 0.001, min(lats) - 0.0005, max(lats) + 0.0005
    seen, lock = set(), threading.Lock()
    out = open(out_path, 'w')
    pool = ThreadPoolExecutor(16)
    pending = [0]
    done = threading.Event()

    def inside(w, s, e, n):
        (x0, y0), (x1, y1) = TO_EST.transform(w, s), TO_EST.transform(e, n)
        return area.intersects(box(min(x0, x1) - 30, min(y0, y1) - 30, max(x0, x1) + 30, max(y0, y1) + 30))

    def submit(*bb):
        with lock: pending[0] += 1
        pool.submit(fetch, *bb)

    def fetch(w, s, e, n):
        try:
            if not inside(w, s, e, n): return
            big = (n - s) > 0.0016
            d = None if big else get(f'{API}/images?bbox={w:.6f},{s:.6f},{e:.6f},{n:.6f}&limit=2000&fields={FIELDS}')
            if big or d is None or (len(d) >= 300 and (n - s) > 0.0005):
                mx, my = (w + e) / 2, (s + n) / 2
                for bb in ((w, s, mx, my), (mx, s, e, my), (w, my, mx, n), (mx, my, e, n)): submit(*bb)
                return
            with lock:
                for x in d:
                    if x['id'] in seen or 'thumb_256_url' not in x: continue
                    seen.add(x['id'])
                    g = (x.get('computed_geometry') or x['geometry'])['coordinates']
                    out.write(json.dumps([x['id'], round(g[0], 7), round(g[1], 7), 'computed_geometry' in x,
                                          x.get('computed_compass_angle', x.get('compass_angle')), x.get('camera_type'),
                                          x.get('camera_parameters'), x.get('computed_rotation'), x.get('captured_at'),
                                          x.get('sequence'), x['thumb_256_url'], x.get('width'), x.get('height')]) + '\n')
        finally:
            with lock:
                pending[0] -= 1
                if pending[0] == 0: done.set()

    submit(w, s, e, n)
    while not done.wait(30):
        print(len(seen), 'photos,', pending[0], 'boxes pending', flush=True)
    out.close()
    print(len(seen), 'photos listed')


if __name__ == '__main__':
    main()
