"""lidar_grid.py SHEET.laz OUT.npz : 1 m grids of a 1 km lidar tile for lidar_decks.py: median height of the
bridge-deck points (class 17), of the ground points (2), of the water points (9) and the low surface of the
unclassified points (1, 30th percentile: the top of a walled ramp). NaN where a cell has no points.

Tiles: Land Board lidar, standard flight ("tava"), one LAZ per 1 km sheet, sheet id = (N km - 6000) * 1000 + E km.
  list: https://geoportaal.maaruum.ee/index.php?lang_id=1&plugin_act=otsing&kaardiruut=<sheet>&andmetyyp=lidar_laz_tava&page_id=614
  file: the same address with &dl=1&f=<sheet>_<year>_tava.laz
Name the output <sheet>.npz and put all of them in one folder."""
import sys, numpy as np, laspy
src, out = sys.argv[1:3]
l = laspy.read(src)
x, y, z, c = np.asarray(l.x), np.asarray(l.y), np.asarray(l.z), np.asarray(l.classification)
e0, n0 = np.floor(np.median(x) / 1000) * 1000, np.floor(np.median(y) / 1000) * 1000
col = np.clip((x - e0).astype(int), 0, 999); row = np.clip((n0 + 1000 - y).astype(int), 0, 999)   # row 0 = north
def grid(mask, q):
    g = np.full(1000 * 1000, np.nan, 'float32')
    k = (row[mask] * 1000 + col[mask]); v = z[mask]
    if len(k) == 0: return g.reshape(1000, 1000)
    o = np.lexsort((v, k)); k, v = k[o], v[o]
    st = np.r_[0, np.nonzero(np.diff(k))[0] + 1]; en = np.r_[st[1:], len(k)]
    g[k[st]] = v[(st + (en - st - 1) * q).astype(int)]
    return g.reshape(1000, 1000)
np.savez_compressed(out, e0=e0, n0=n0, b=grid(c == 17, 0.5), g=grid(c == 2, 0.5), u=grid(c == 1, 0.3), w=grid(c == 9, 0.5))
