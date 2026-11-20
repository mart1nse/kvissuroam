"""Bus stops for the bus shelters (src/world/busstops.js): every OpenStreetMap bus stop platform
(highway=bus_stop) inside the map, moved to the pavement of the road it serves, with the shelter
turned to face that road and put where it has room (no building, wall, fence, water, road or cycle path
under it, flat ground). Writes src/world/busstops.json.

    pip install osmium pyproj numpy
    python3 tools/bake/busstops.py /path/to/estonia-latest.osm.pbf

Each stop: [x, z, yaw, L, gap, side, hw, name, sign, bin]
  x, z   the shelter's centre (world metres, x east, z south)
  yaw    rotation of its local x axis (along the road, pointing the way the buses go): local x = (cos, -sin)
  L      its length (m)
  gap    from the kerb (road edge) to the shelter's front (m)
  side   +1 / -1: which way from the road centre line the shelter is (to the right of the buses)
  hw     the road's half width there (m), for the kerb paint
  name   index into names
  sign   [along, across] of the bus stop sign in the shelter's axes, or null where it found no spot
  bin    1 when the bin by the far end has room
"""
import json, math, os, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DATA = os.path.join(ROOT, 'public', 'data')
MAIN = {'Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Ramp või ühenduste'}
D = 1.55            # shelter depth
LENS = [4.6, 3.6]   # tried in turn
# the hand-built shelters already standing: no second one there (Emajõe, Lai, Kroonuaia)
HAND = [(1416.2, 2277.6), (1205.4, 2493.9), (1228.4, 2302.6)]
HAND_R = 30


def osm_stops(pbf):
    import osmium
    from pyproj import Transformer
    T = Transformer.from_crs(4326, 3301, always_xy=True)
    meta = json.load(open(os.path.join(DATA, 'meta.json')))
    E0, N0 = meta['origin']['e'], meta['origin']['n']
    out = []

    class H(osmium.SimpleHandler):
        def node(self, n):
            t = n.tags
            if t.get('highway') != 'bus_stop':
                return
            if t.get('disused') or t.get('abandoned'):
                return
            e, nn = T.transform(n.location.lon, n.location.lat)
            out.append({'id': n.id, 'x': e - E0, 'z': N0 - nn, 'name': t.get('name', '')})
    H().apply_file(pbf)
    return out


class Sectors:
    def __init__(self):
        self.meta = json.load(open(os.path.join(DATA, 'meta.json')))
        m = self.meta
        self.S, self.G0 = m['sector']['size'], m['sector']['grid0']
        self.hn, self.hres = m['height']['n'], m['height']['res']
        self.hs, self.hoff = m['height']['scale'], m['height']['offset']
        self.sn, self.sres = m['surface']['n'], m['surface']['res']
        self.dn, self.dres = m['sdf']['n'], m['sdf']['res']
        self.dmin, self.dspan = m['sdf']['min'], m['sdf']['max'] - m['sdf']['min']
        self.lres = m.get('lowres', 0.5)
        self.cache = {}

    def sector(self, x, z):
        sx, sz = math.floor((x - self.G0) / self.S), math.floor((z - self.G0) / self.S)
        k = (sx, sz)
        if k not in self.cache:
            p = os.path.join(DATA, 'sec', f'{sx}_{sz}.kvs')
            if not os.path.exists(p):
                self.cache[k] = None
            else:
                b = open(p, 'rb').read()
                if b[:2] == b'\x1f\x8b':
                    import gzip
                    b = gzip.decompress(b)
                o = 32
                H = np.frombuffer(b, np.uint16, self.hn * self.hn, o).reshape(self.hn, self.hn); o += self.hn * self.hn * 2
                Sf = np.frombuffer(b, np.uint8, self.sn * self.sn, o).reshape(self.sn, self.sn); o += self.sn * self.sn
                Dd = np.frombuffer(b, np.uint8, self.dn * self.dn, o).reshape(self.dn, self.dn); o += self.dn * self.dn
                nv, nt, nb = np.frombuffer(b, np.uint32, 8, 0)[4:7]
                o += int(nv) * 15 + int(nt) * 24
                bush = np.zeros((int(self.S / self.lres) + 1,) * 2, bool)             # cells with a bush or hedge
                Bu = np.frombuffer(b, np.uint16, int(nb) * 3, o).reshape(-1, 3)
                bush[np.minimum(Bu[:, 1], bush.shape[0] - 1), np.minimum(Bu[:, 0], bush.shape[1] - 1)] = True
                self.cache[k] = (self.G0 + sx * self.S, self.G0 + sz * self.S, H, Sf, Dd, bush)
        return self.cache[k]

    def sample(self, x, z):
        """(height, surface class, sdf) or None outside the map"""
        s = self.sector(x, z)
        if s is None:
            return None
        x0, z0, H, Sf, Dd, bush = s
        fx, fz = (x - x0) / self.hres, (z - z0) / self.hres
        c, r = min(int(fx), self.hn - 2), min(int(fz), self.hn - 2)
        fx -= c; fz -= r
        h = ((H[r, c] * (1 - fx) + H[r, c + 1] * fx) * (1 - fz) + (H[r + 1, c] * (1 - fx) + H[r + 1, c + 1] * fx) * fz) * self.hs + self.hoff
        surf = Sf[min(int((z - z0) / self.sres), self.sn - 1), min(int((x - x0) / self.sres), self.sn - 1)]
        d = Dd[min(int(round((z - z0) / self.dres)), self.dn - 1), min(int(round((x - x0) / self.dres)), self.dn - 1)]
        bi, bj = int((z - z0) / self.lres), int((x - x0) / self.lres)
        hedge = bool(bush[min(bi, bush.shape[0] - 1), min(bj, bush.shape[1] - 1)])
        return h, int(surf), self.dmin + d / 255 * self.dspan, hedge


class Roads:
    CELL = 32

    def __init__(self, roads):
        self.grid = {}
        for r in roads:
            P = r['pts']
            if len(P) < 2:
                continue
            for i in range(1, len(P)):
                ax, az = P[i - 1]; bx, bz = P[i]
                m = r['w'] / 2 + 3
                seg = (ax, az, bx, bz, r['w'] / 2, r['name'])
                for gx in range(math.floor((min(ax, bx) - m) / self.CELL), math.floor((max(ax, bx) + m) / self.CELL) + 1):
                    for gz in range(math.floor((min(az, bz) - m) / self.CELL), math.floor((max(az, bz) + m) / self.CELL) + 1):
                        self.grid.setdefault((gx, gz), []).append(seg)

    def near(self, x, z, reach=0):
        out = set()
        for gx in range(math.floor((x - reach) / self.CELL), math.floor((x + reach) / self.CELL) + 1):
            for gz in range(math.floor((z - reach) / self.CELL), math.floor((z + reach) / self.CELL) + 1):
                for s in self.grid.get((gx, gz), ()):
                    out.add(s)
        return out


def to_seg(s, x, z):
    ax, az, bx, bz = s[:4]
    dx, dz = bx - ax, bz - az
    l2 = dx * dx + dz * dz
    t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / l2)) if l2 > 0 else 0
    px, pz = ax + dx * t, az + dz * t
    return math.hypot(x - px, z - pz), px, pz, t


def main(pbf):
    vec = json.load(open(os.path.join(DATA, 'vectors.json')))
    meta = json.load(open(os.path.join(DATA, 'meta.json')))
    B = meta['boundary']

    def inside(x, z):
        c = False; j = len(B) - 1
        for i in range(len(B)):
            xi, zi = B[i]; xj, zj = B[j]
            if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
                c = not c
            j = i
        return c

    stops = [s for s in osm_stops(pbf) if inside(s['x'], s['z'])]
    print(len(stops), 'bus stops in the map', file=sys.stderr)
    main_roads = Roads([r for r in vec['roads'] if r['type'] in MAIN])
    hard = Roads([r for r in vec['roads'] if r['type'] != 'Rada'])           # roads, cycle paths, yards
    soft = Roads([r for r in vec['roads'] if r['type'] == 'Rada'])           # foot paths: better not, but allowed
    sec = Sectors()

    def on_road(lookup, x, z, margin):
        worst = -1e9
        for s in lookup.near(x, z, 10):
            d = to_seg(s, x, z)[0]
            worst = max(worst, s[4] + margin - d)
        return worst

    def footprint(cx, cz, ux, uz, nx, nz, L, pad):
        pts = []
        nl, nd = max(2, int((L + 2 * pad) / 0.5)), max(2, int((D + 2 * pad) / 0.5))
        for i in range(nl + 1):
            for j in range(nd + 1):
                a = -L / 2 - pad + (L + 2 * pad) * i / nl
                b = -D / 2 - pad + (D + 2 * pad) * j / nd
                pts.append((cx + ux * a + nx * b, cz + uz * a + nz * b))
        return pts

    placed, report = [], {'no_road': 0, 'no_room': 0, 'hand': 0, 'dupe': 0}
    for st in stops:
        x, z = st['x'], st['z']
        if any(math.hypot(x - hx, z - hz) < HAND_R for hx, hz in HAND):
            report['hand'] += 1
            continue
        best = None
        for s in main_roads.near(x, z, 30):
            d, px, pz, t = to_seg(s, x, z)
            if d < 30 and (best is None or d - s[4] < best[0]):
                best = (d - s[4], s, px, pz, d)
        if best is None:
            report['no_road'] += 1
            continue
        _, s, px, pz, d = best
        ax, az, bx, bz, hw, road = s
        l = math.hypot(bx - ax, bz - az)
        ux, uz = (bx - ax) / l, (bz - az) / l
        nx, nz = -uz, ux                                         # one side of the road
        lat = (x - px) * nx + (z - pz) * nz
        sides = [1, -1] if lat > 0.3 else [-1, 1] if lat < -0.3 else [1, -1]
        found = None
        for side in sides[:1] if abs(lat) > 0.3 else sides:
            sx, sz = nx * side, nz * side                        # from the road to the shelter
            # the buses go so that the shelter is on their right: x east, z south, right of (dx, dz) is (-dz, dx)
            dx, dz = (ux, uz) if (-uz * sx + ux * sz) > 0 else (-ux, -uz)
            pref = max(1.0, abs(lat) - hw - D / 2)
            cands = []
            for L in LENS:
                for gap in [0.9, 1.3, 1.8, 2.4, 3.0, 3.8, 4.8, 6.0, 7.5]:
                    for al in [0, 1.5, -1.5, 3, -3, 5, -5, 7.5, -7.5, 10, -10]:
                        cost = abs(al) * 0.5 + abs(gap - min(pref, 3.0)) * 0.6 + (4.6 - L) * 1.5
                        cands.append((cost, L, gap, al))
            cands.sort()
            for cost, L, gap, al in cands:
                # the road's own centre line there (it may bend): find it again from the trial point
                cx0, cz0 = px + dx * al, pz + dz * al
                cx, cz = cx0 + sx * (hw + gap + D / 2), cz0 + sz * (hw + gap + D / 2)
                ok, hs, soft_hit = True, [], 0
                for qx, qz in footprint(cx, cz, dx, dz, -dz, dx, L, 0.25):
                    smp = sec.sample(qx, qz)
                    if smp is None or smp[1] == 4 or smp[2] < 0.35 or smp[3]:
                        ok = False
                        break
                    hs.append(smp[0])
                if not ok or max(hs) - min(hs) > 0.55:
                    continue
                # no road, yard or cycle path under it, nor right in front of it
                if any(on_road(hard, qx, qz, 0.15) > 0 for qx, qz in footprint(cx, cz, dx, dz, -dz, dx, L, 0.1)):
                    continue
                # the kerb in front: the main road must be its nearest road (not a side street)
                kx, kz = cx - sx * (D / 2 + gap), cz - sz * (D / 2 + gap)
                if on_road(main_roads, kx - sx * 0.3, kz - sz * 0.3, 0) < 0:
                    continue
                kerb = sec.sample(kx + sx * 0.3, kz + sz * 0.3)
                if kerb is None or abs(kerb[0] - min(hs)) > 0.7:
                    continue
                if any(on_road(soft, qx, qz, 0) > 0 for qx, qz in footprint(cx, cz, dx, dz, -dz, dx, L, 0)):
                    soft_hit = 1
                    if cost < 99 and gap < 7.5:
                        continue                                  # try the others first
                found = (cx, cz, dx, dz, L, gap, side)
                break
            if found:
                break
        if not found:
            report['no_room'] += 1
            continue
        cx, cz, dx, dz, L, gap, side = found
        if any(math.hypot(cx - p[0], cz - p[1]) < 9 for p in placed):
            report['dupe'] += 1
            continue
        yaw = math.atan2(-dz, dx)
        # the sign: at the kerb before the shelter, or by the shelter's front when the kerb is far or taken;
        # the bin by the far end, unless that is on a path
        ux, uz, nx, nz = dx, dz, -dz, dx
        W = lambda a, b: (cx + ux * a + nx * b, cz + uz * a + nz * b)
        sign = None
        for n in ([-(D / 2 + gap) + 0.5] if gap <= 2.4 else []) + [-D / 2 - 0.5, -D / 2 - 0.25]:
            for a in (-L / 2 - 0.8, -L / 2 - 0.4, -L / 2 + 0.3):
                qx, qz = W(a, n)
                smp = sec.sample(qx, qz)
                if on_road(hard, qx, qz, 0.1) <= 0 and smp and smp[2] > 0.3:
                    sign = (round(a, 2), round(n, 2))
                    break
            if sign:
                break
        bx, bz = W(L / 2 + 0.55, D / 2 - 0.35)
        smp = sec.sample(bx, bz)
        binok = int(on_road(hard, bx, bz, 0.25) <= 0 and smp is not None and smp[2] > 0.4 and smp[1] != 4)
        placed.append([round(cx, 2), round(cz, 2), round(yaw, 4), L, gap, side, round(hw, 2), st['name'], sign, binok])
    print(len(placed), 'shelters;', report, file=sys.stderr)
    names = sorted({p[7] for p in placed})
    idx = {n: i for i, n in enumerate(names)}
    out = {'names': names, 'stops': [p[:7] + [idx[p[7]], p[8], p[9]] for p in placed]}
    json.dump(out, open(os.path.join(ROOT, 'src', 'world', 'busstops.json'), 'w'), separators=(',', ':'), ensure_ascii=False)


if __name__ == '__main__':
    main(sys.argv[1])
