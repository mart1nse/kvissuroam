#!/usr/bin/env python3
"""Shop signs on the buildings where the shops really are.

Usage:  python3 tools/realism/signs.py POIS.json [ETAK_BUILDINGS]

POIS.json comes from osm_pois.py (OpenStreetMap). ETAK_BUILDINGS is the Land Board building layer
(E_401_hoone_ka from ETAK_Eesti_SHP_ehitised.zip); with it a shop goes on the building that carries its
address when that building is close, otherwise on the building the map point is in (or next to).
On that building the sign goes on the wall nearest the shop that faces a street, above the ground
floor; large stores get a big sign high on the facade. Fuel stations get a pylon by the road.
Writes public/data/signs.json:
  texts: [text, ...]   styles: see STYLES in src/world/signs.js
  sectors: {"sx_sz": [kind, x, y, z, yaw (deg), w, h, text, style, ...]}   kind 0 wall sign, 1 pylon
Place data (c) OpenStreetMap contributors, ODbL.
"""
import json, math, os, re, sys
import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world

E0, N0 = world.META['origin']['e'], world.META['origin']['n']
S, G0 = world.S, world.G0
STRIDE = 9
DEBUG = set(os.environ.get('SIGN_DEBUG', '').split(','))
BIG = {'supermarket', 'mall', 'department_store', 'doityourself', 'hardware', 'furniture', 'electronics', 'car', 'wholesale', 'garden_centre', 'sports'}

# brand -> (sign text, style); style ids match STYLES in src/world/signs.js
BRANDS = [
    (r'selver', None, 1), (r'konsum', 'Konsum', 2), (r'maksimarket', 'Maksimarket', 2), (r'^coop', 'Coop', 2),
    (r'prisma', 'Prisma', 3), (r'rimi', None, 4), (r'maxima', None, 5), (r'^lidl', 'Lidl', 6),
    (r'circle k', 'Circle K', 7), (r'^neste', 'Neste', 8), (r'olerex', 'Olerex', 9), (r'alexela', 'Alexela', 10),
    (r'terminal', 'Terminal', 11), (r'apotheka', 'Apotheka', 12), (r'benu', 'Benu', 12), (r'euroapteek', 'Euroapteek', 12),
    (r'südameapteek', 'Südameapteek', 12), (r'hesburger', 'Hesburger', 13), (r"mcdonald", "McDonald's", 14),
    (r'swedbank', 'Swedbank', 15), (r'^seb$', 'SEB', 16), (r'jysk', 'JYSK', 17), (r'^k-rauta', 'K-Rauta', 18),
    (r'bauhof', 'Bauhof', 18), (r'ehituse abc', 'Ehituse ABC', 18), (r'^h&m', 'H&M', 19),
]


def sign_text(p):
    name, brand = (p.get('name') or '').strip(), (p.get('brand') or '').strip()
    hay = f'{brand} | {name}'.lower()
    for pat, text, style in BRANDS:
        if re.search(pat, brand.lower()) or re.search(pat, name.lower()):
            if text is None:                # keep the store format: "Selver ABC", "Rimi mini", "Maxima XX"
                m = re.search(r'(selver|rimi|maxima)\b.*', name, re.I)
                text = m.group(0).strip() if m else (brand or name)
                text = re.sub(r'^(selver|rimi|maxima)', lambda k: k.group(0).capitalize(), text, flags=re.I)
            return text, style
    text = brand if brand and len(brand) <= len(name or brand) and brand.lower() in hay and len(brand) > 2 else name
    text = text.split(';')[0].strip()
    if not text or len(text) > 26: return None, None
    return text, 0


def kind_of(p):
    return p.get('shop') or p.get('amenity') or p.get('tourism') or ''


def priority(p):
    k = kind_of(p)
    return (3 if k in ('mall', 'department_store') else 2 if k in BIG else 1) + (0.5 if p.get('brand') else 0)


def norm_addr(street, num):
    if not street or not num: return None
    s = street.lower()
    s = re.sub(r'\b(tn|tänav|pst|puiestee|mnt|maantee|põik)\b\.?', '', s)
    s = re.sub(r'[^a-zõäöüšž0-9]+', '', s)
    return s + '|' + str(num).lower().replace(' ', '')


def etak_addresses(path, B):
    """Address of each game building, from the Land Board building polygons it stands in."""
    import shapefile
    from shapely.geometry import Polygon, Point
    from shapely.strtree import STRtree
    xs = np.array([[(b['x0'] + b['x1']) / 2 + E0, N0 - (b['z0'] + b['z1']) / 2] for b in B])
    lo, hi = xs.min(0) - 50, xs.max(0) + 50
    r = shapefile.Reader(path, encoding='utf-8')
    polys, addrs = [], []
    for sr in r.iterShapeRecords(bbox=(lo[0], lo[1], hi[0], hi[1]), fields=['ads_lahiaa']):
        a = (sr.record['ads_lahiaa'] or '').strip()
        if not a: continue
        m = re.match(r'^(.*?)\s+(\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?)$', a.split(',')[0])
        key = norm_addr(m.group(1), m.group(2)) if m else None
        if not key: continue
        pts = sr.shape.points[:sr.shape.parts[1] if len(sr.shape.parts) > 1 else None]
        if len(pts) < 3: continue
        try: polys.append(Polygon(pts)); addrs.append(key)
        except Exception: pass
    tree = STRtree(polys)
    out = {}
    for bi, b in enumerate(B):
        tests = [((b['x0'] + b['x1']) / 2, (b['z0'] + b['z1']) / 2)]
        for w in b['walls'][:6]:                      # L-shaped buildings: a point just inside a wall
            tests.append(((w[0] + w[2]) / 2 - w[4] * 0.8, (w[1] + w[3]) / 2 - w[5] * 0.8))
        for x, z in tests:
            pt = Point(x + E0, N0 - z)
            hit = [i for i in tree.query(pt) if polys[i].contains(pt)]
            if hit: out[bi] = addrs[hit[0]]; break
    print(len(polys), 'Land Board buildings with an address,', len(out), 'game buildings matched', flush=True)
    return out


def seg_dist(px, pz, W):
    """distance from a point to each wall segment (n,)"""
    ax, az, bx, bz = W[:, 0], W[:, 1], W[:, 2], W[:, 3]
    dx, dz = bx - ax, bz - az
    t = np.clip(((px - ax) * dx + (pz - az) * dz) / np.maximum(dx * dx + dz * dz, 1e-9), 0, 1)
    return np.hypot(ax + dx * t - px, az + dz * t - pz), t


class Roads:
    def __init__(self, vectors):
        a, b, w = [], [], []
        for r in vectors['roads']:
            P = r['pts']
            for i in range(len(P) - 1):
                a.append(P[i][:2]); b.append(P[i + 1][:2]); w.append(r.get('w', 6))
        self.a, self.b, self.w = np.array(a), np.array(b), np.array(w)
        self.tree = cKDTree((self.a + self.b) / 2)
        self.half = np.hypot(*(self.b - self.a).T).max() / 2

    def nearest(self, x, z, r=80):
        idx = self.tree.query_ball_point([x, z], r + self.half)
        if not idx: return None
        idx = np.array(idx)
        a, b = self.a[idx], self.b[idx]
        d = b - a
        t = np.clip(((x - a[:, 0]) * d[:, 0] + (z - a[:, 1]) * d[:, 1]) / np.maximum((d ** 2).sum(1), 1e-9), 0, 1)
        q = a + d * t[:, None]
        dist = np.hypot(q[:, 0] - x, q[:, 1] - z)
        k = dist.argmin()
        if dist[k] > r: return None
        return q[k], dist[k], d[k] / max(np.hypot(*d[k]), 1e-9), self.w[idx[k]]


def main():
    pois = json.load(open(sys.argv[1]))
    B, heights = world.all_buildings()
    print(len(B), 'buildings', flush=True)
    import colours
    ground = colours.Ground(heights)
    roads = Roads(json.load(open(os.path.join(world.DATA, 'vectors.json'))))
    addr = etak_addresses(sys.argv[2], B) if len(sys.argv) > 2 else {}
    by_addr = {}
    for bi, a in addr.items(): by_addr.setdefault(a, []).append(bi)

    # walls of all buildings, for "which building is this point in or next to"
    wb = np.concatenate([np.full(len(b['walls']), bi) for bi, b in enumerate(B)])
    W = np.concatenate([b['walls'] for b in B])
    wtree = cKDTree(np.c_[(W[:, 0] + W[:, 2]) / 2, (W[:, 1] + W[:, 3]) / 2])
    boxes = np.array([[b['x0'], b['z0'], b['x1'], b['z1']] for b in B])

    area = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])

    dirs = np.array([[math.cos(a), math.sin(a)] for a in np.arange(8) * math.pi / 4 + 0.1])

    def contains(bi, x, z):
        """a ray in every direction meets a wall of the building: the point is inside it"""
        Wb = B[bi]['walls']
        ax, az, ex, ez = Wb[:, 0], Wb[:, 1], Wb[:, 2] - Wb[:, 0], Wb[:, 3] - Wb[:, 1]
        for dx, dz in dirs:
            den = dx * ez - dz * ex
            ok = np.abs(den) > 1e-9
            den = np.where(ok, den, 1)
            qx, qz = ax - x, az - z
            t = (qx * ez - qz * ex) / den
            u = (qx * dz - qz * dx) / den
            if not (ok & (t > 0) & (u >= -0.01) & (u <= 1.01)).any(): return False
        return True

    def building_at(x, z, reach=25, big=False):
        """building the point is in (big stores: the largest, others: the smallest), else the nearest one"""
        inside = np.flatnonzero((boxes[:, 0] - 0.5 <= x) & (x <= boxes[:, 2] + 0.5) & (boxes[:, 1] - 0.5 <= z) & (z <= boxes[:, 3] + 0.5) & (area >= 25))
        inside = [i for i in inside if contains(i, x, z)]
        if inside:
            k = max(inside, key=lambda i: area[i]) if big else min(inside, key=lambda i: area[i])
            return int(k), 0.0
        idx = wtree.query_ball_point([x, z], reach + 5)
        if not idx: return None, None
        idx = np.array(idx)
        d, _ = seg_dist(x, z, W[idx])
        if big:
            best = {}
            for j, dj in zip(wb[idx], d):
                if dj < reach and area[j] >= 25: best[j] = min(best.get(j, 1e9), dj)
            if best:
                k = max(best, key=lambda j: min(area[j], 5000) / (1 + best[j] / 10))
                return int(k), float(best[k])
        d = np.where(area[wb[idx]] >= 25, d, d + 30)
        k = d.argmin()
        return (int(wb[idx[k]]), float(d[k])) if d[k] < reach else (None, None)

    texts, tid = [], {}
    per_b, pylons, n_addr, n_skip = {}, [], 0, 0
    for p in pois:
        text, style = sign_text(p)
        if text is None: n_skip += 1; continue
        x, z = p['e'] - E0, N0 - p['n']
        if kind_of(p) == 'fuel':
            pylons.append((x, z, text, style)); continue
        bi, d = building_at(x, z, 25 if p['osm'][0] == 'n' else 45, kind_of(p) in BIG or kind_of(p) in ('mall', 'department_store'))
        key = norm_addr(p.get('addr:street'), p.get('addr:housenumber'))
        big = kind_of(p) in BIG or kind_of(p) in ('mall', 'department_store')
        if key and key in by_addr and (bi is None or (bi in addr and addr[bi] != key)):
            # the map point is on a building with another address: the building with the shop's address wins if it is near
            cands = [c for c in by_addr[key] if area[c] >= 25]
            dd = {c: math.hypot((B[c]['x0'] + B[c]['x1']) / 2 - x, (B[c]['z0'] + B[c]['z1']) / 2 - z) for c in cands}
            cands = [c for c in cands if dd[c] < 150]
            if cands:
                bi = max(cands, key=lambda c: area[c]) if big else min(cands, key=lambda c: dd[c])
                n_addr += 1
        if bi is None:
            if big: pylons.append((x, z, text, style))       # a store with no building in the map data: a pylon by the road
            else: n_skip += 1
            continue
        per_b.setdefault(bi, []).append((priority(p), x, z, text, style, kind_of(p)))
        if text in DEBUG: print('DEBUG assign', text, bi, d, B[bi]['area'], B[bi]['h'], B[bi]['eaves'])
    print(len(per_b), 'buildings with shops,', n_addr, 'placed by address,', len(pylons), 'pylons (fuel stations and stores without a building),', n_skip, 'skipped', flush=True)

    out = {}
    def emit(kind, x, y, z, yaw, w, h, text, style):
        if text not in tid: tid[text] = len(texts); texts.append(text)
        key = f'{int((x - G0) // S)}_{int((z - G0) // S)}'
        out.setdefault(key, []).extend([kind, round(x, 2), round(y, 2), round(z, 2), round(math.degrees(yaw), 1), round(w, 2), round(h, 2), tid[text], style])

    n_signs = 0
    for bi, shops in per_b.items():
        b = B[bi]
        shops.sort(key=lambda s: -s[0])
        seen, keep = set(), []
        for s in shops:
            if s[3].lower() in seen: continue
            seen.add(s[3].lower()); keep.append(s)
        crowded = len(keep) > 5
        if crowded:          # a shopping centre: its name and the big stores, not every boutique inside
            keep = [s for s in keep if s[0] >= 2][:6] or keep[:3]
        else:
            keep = keep[:4]
        Wb = b['walls']
        L = np.hypot(Wb[:, 2] - Wb[:, 0], Wb[:, 3] - Wb[:, 1])
        eaves = max(b['eaves'], 2.4)
        # walls under a gable reach the ridge, so houses use the eaves; complex roofs (eaves far below the top) do not
        top = np.minimum(Wb[:, 6], eaves + 0.3) if eaves > 0.6 * b['h'] else Wb[:, 6]
        mid = np.c_[(Wb[:, 0] + Wb[:, 2]) / 2, (Wb[:, 1] + Wb[:, 3]) / 2]
        street = np.zeros(len(Wb))
        for i in range(len(Wb)):
            if L[i] < 2.2 or top[i] < 2.3: continue
            r = roads.nearest(mid[i, 0] + Wb[i, 4] * 2, mid[i, 1] + Wb[i, 5] * 2, 70)
            if r is None: street[i] = 0.35; continue
            q, dist, _, _ = r
            v = q - mid[i]; nv = np.hypot(*v)
            facing = (v[0] * Wb[i, 4] + v[1] * Wb[i, 5]) / max(nv, 1e-6)
            street[i] = (0.25 + max(facing, 0)) * (1.0 if dist < 45 else 0.6)
        used = {}
        for pri, x, z, text, style, kind in keep:
            big = kind in BIG or kind in ('mall', 'department_store') or b['style'] == 2
            h0 = (2.2 if kind in ('mall', 'department_store') else 1.5) if big and b["area"] > 600 else 1.0 if big else 0.75
            d, t = seg_dist(x, z, Wb)
            score = np.minimum(L, 14) * street / (1 + d / 8)
            placed = False
            if text in DEBUG: print('DEBUG place', text, 'keep', [k[3] for k in keep], 'scores', np.round(np.sort(score)[::-1][:5], 2), 'L', np.round(L[np.argsort(-score)[:5]], 1), 'top', np.round(top[np.argsort(-score)[:5]], 1))
            for i in np.argsort(-score):
                if score[i] <= 0: break
                h = h0
                w = h * (0.5 * len(text) + 0.8)
                if w > 0.85 * L[i]:
                    h *= 0.85 * L[i] / w; w = 0.85 * L[i]
                if h < 0.32: continue
                # along the wall: at the shop if it is next to this wall, else centred
                s = t[i] * L[i] if d[i] < 12 else L[i] / 2
                s = min(max(s, w / 2 + 0.2), L[i] - w / 2 - 0.2)
                busy = used.setdefault(i, [])
                for shift in (0, 1, -1, 2, -2, 3, -3):
                    c = s + shift * (w + 0.4) / 2 if shift else s
                    if c - w / 2 < 0.1 or c + w / 2 > L[i] - 0.1: continue
                    if all(abs(c - u) > (w + uw) / 2 + 0.3 for u, uw in busy): s = c; break
                else:
                    continue
                busy.append((s, w))
                f = s / L[i]
                px, pz = Wb[i, 0] + (Wb[i, 2] - Wb[i, 0]) * f, Wb[i, 1] + (Wb[i, 3] - Wb[i, 1]) * f
                g = ground(px + Wb[i, 4] * 1.0, pz + Wb[i, 5] * 1.0)
                g = b['base'] if g is None else max(b['base'], min(g, b['base'] + 3))
                topy = b['base'] + top[i]
                if big:
                    y = max(g + 2.6 + h / 2, topy - 0.55 - h / 2)
                    y = min(y, g + 11)
                elif b['style'] == 1:
                    y = g + 3.3
                else:
                    y = min(g + 3.0, topy - 0.3 - h / 2)
                    y = max(y, g + 1.9 + h / 2 * 0.5)
                if text in DEBUG: print('DEBUG try', text, i, round(y, 1), round(h, 2), round(topy, 1), round(g, 1))
                if y + h / 2 > topy + 0.2: continue
                emit(0, px + Wb[i, 4] * 0.1, y, pz + Wb[i, 5] * 0.1, math.atan2(Wb[i, 4], Wb[i, 5]), w, h, text, style)
                n_signs += 1; placed = True
                break
            if not placed and (kind in BIG or kind in ('mall', 'department_store')):
                pylons.append((x, z, text, style))

    n_pyl = 0
    for x, z, text, style in pylons:
        r = roads.nearest(x, z, 60)
        if r is not None:
            q, dist, dirv, rw = r
            off = min(dist, rw / 2 + 3.5)
            v = np.array([x, z]) - q; nv = np.hypot(*v)
            if nv > 1e-3: px, pz = q + v / nv * off
            else: px, pz = x, z
            yaw = math.atan2(dirv[0], dirv[1])       # panel faces along the road, both ways
        else:
            px, pz, yaw = x, z, 0.0
        bi, d = building_at(px, pz)
        if bi is not None and d == 0.0: px, pz = x, z
        g = ground(px, pz)
        if g is None: continue
        emit(1, px, g, pz, yaw, 2.6, 1.2, text, style)
        n_pyl += 1
    json.dump({'stride': STRIDE, 'credit': 'Shops (c) OpenStreetMap contributors, ODbL', 'texts': texts, 'sectors': out},
              open(os.path.join(world.DATA, 'signs.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(n_signs, 'wall signs,', n_pyl, 'pylons,', len(texts), 'texts')


if __name__ == '__main__':
    main()
