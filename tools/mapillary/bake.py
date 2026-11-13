#!/usr/bin/env python3
"""Bake Mapillary street photos for a stretch of road into public/data/mly/.

Usage:  MAPILLARY_TOKEN=... python3 tools/mapillary/bake.py NAME W S E N SEQ [SEQ ...]

W S E N is a WGS84 bounding box, SEQ are Mapillary sequence ids to keep. Write
SEQ:0.8 to say that the capturing car's bonnet or dashboard starts at 80 % of
the picture height; everything below that line is ignored in the game.
Writes public/data/mly/NAME.json (camera poses in game coordinates) and
public/data/mly/img/<image id>.jpg (1024 px wide). Photos are CC BY-SA,
(c) Mapillary contributors; the usernames are kept in the index for attribution.

If MAPILLARY_TOKEN is not set, the request is sent without one (this works
where a proxy adds the Authorization header).
"""
import io, json, math, os, sys, time, urllib.request
from pyproj import Transformer
from PIL import Image

E0, N0 = 657800.0, 6477150.0          # world origin, same as tools/bake/config.py
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data', 'mly')
API = 'https://graph.mapillary.com'
TOKEN = os.environ.get('MAPILLARY_TOKEN')
T = Transformer.from_crs(4326, 3301, always_xy=True)


def get(url, raw=False):
    req = urllib.request.Request(url)
    if TOKEN and url.startswith(API):
        req.add_header('Authorization', 'OAuth ' + TOKEN)
    for k in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
            return b if raw else json.loads(b)
        except Exception as ex:           # the API throws transient 500s
            err = ex
            time.sleep(2 + 3 * k)
    raise err


def rodrigues(r):
    th = math.sqrt(sum(c * c for c in r))
    if th < 1e-9:
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    x, y, z = (c / th for c in r)
    c, s, C = math.cos(th), math.sin(th), 1 - math.cos(th)
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]


def main():
    name = sys.argv[1]
    w, s, e, n = map(float, sys.argv[2:6])
    crop = {a.split(':')[0]: float(a.split(':')[1]) if ':' in a else 0.8 for a in sys.argv[6:]}
    keep = set(crop)
    os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)

    ids = []
    steps = max(1, math.ceil((n - s) / 0.003))
    for i in range(steps):                # small boxes: the API caps a reply at 2000
        s0, n0 = s + (n - s) * i / steps, s + (n - s) * (i + 1) / steps
        d = get(f'{API}/images?bbox={w},{s0},{e},{n0}&limit=2000&fields=id,sequence')['data']
        ids += [x['id'] for x in d if x['sequence'] in keep]
    ids = sorted(set(ids))
    print(len(ids), 'images')

    fields = ('id,sequence,captured_at,computed_geometry,geometry,computed_rotation,'
              'camera_parameters,camera_type,width,height,creator,thumb_1024_url')
    rows = []
    for i in range(0, len(ids), 40):
        rows += get(f'{API}/images?image_ids={",".join(ids[i:i + 40])}&fields={fields}')['data']

    frames, users = [], set()
    for x in rows:
        if 'computed_rotation' not in x or 'computed_geometry' not in x:
            continue                      # no reconstructed pose: unusable
        lon, lat = x['computed_geometry']['coordinates']
        E, N = T.transform(lon, lat)
        E2, N2 = T.transform(lon, lat + 1e-4)
        g = math.atan2(E2 - E, N2 - N)    # bearing of true north in the grid
        cg, sg = math.cos(g), math.sin(g)
        R = rodrigues(x['computed_rotation'])   # world (east, north, up) -> camera
        axes = []
        for row in R:                     # camera right, down, forward in ENU
            ee, nn, uu = row
            Eg, Ng = ee * cg + nn * sg, -ee * sg + nn * cg
            axes += [round(Eg, 5), round(uu, 5), round(-Ng, 5)]   # game: x east, y up, z south
        path = os.path.join(OUT, 'img', x['id'] + '.jpg')
        if not os.path.exists(path):
            im = Image.open(io.BytesIO(get(x['thumb_1024_url'], raw=True))).convert('RGB')
            im.save(path, quality=72, optimize=True, progressive=True)
        cp = x.get('camera_parameters') or [0.85, 0, 0]
        users.add(x['creator']['username'])
        frames.append({
            'id': x['id'], 'seq': x['sequence'], 't': x['captured_at'],
            'x': round(E - E0, 2), 'z': round(N0 - N, 2), 'r': axes,
            'f': round(cp[0], 5), 'k1': round(cp[1], 5), 'k2': round(cp[2], 5),
            'fish': 1 if x['camera_type'] == 'fisheye' else 0,
            'a': round(x['width'] / x['height'], 4), 'c': crop[x['sequence']],
        })
    frames.sort(key=lambda f: (f['seq'], f['t']))
    json.dump({'credit': sorted(users), 'frames': frames},
              open(os.path.join(OUT, name + '.json'), 'w'), separators=(',', ':'))
    print(len(frames), 'frames with poses,', sorted(users))


if __name__ == '__main__':
    main()
