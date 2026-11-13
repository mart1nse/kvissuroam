"""Hedges and bushes for the detail area, from Maa- ja Ruumiamet lidar point clouds.

Usage: python3 tools/bake/lidar_bushes.py SRC_DIR
Reads SRC_DIR/las_*.laz (low-altitude flight tiles covering detail_area.json) and the
terrain sheets, writes SRC_DIR/bushes.npz: a 0.5 m grid with the height (decimetres) of
low vegetation (0.5 to 3.2 m, not under a tree crown) and of fences (thin lines of
unclassified returns, with their direction). bake.py picks the file up.
Needs `laspy[lazrs]`.
"""
import glob
import json
import os
import sys

import laspy
import numpy as np
import rasterio
import rasterio.windows
import rasterio.features
from rasterio.transform import from_origin
from scipy import ndimage
from shapely.geometry import Polygon, mapping, shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *  # noqa

SRC = sys.argv[1]
area = Polygon(DETAIL_AREA).buffer(15)
minx, miny, maxx, maxy = [float(v) for v in area.bounds]
x0, z0 = np.floor(minx - E0), np.floor(N0 - maxy)            # world-space corner of the grid
nx, nz = int((maxx - minx) / BUSH_RES) + 4, int((maxy - miny) / BUSH_RES) + 4

# terrain under the grid (1 m pixels)
tw, th = int(nx * BUSH_RES) + 2, int(nz * BUSH_RES) + 2
dtm = np.full((th, tw), np.nan, 'float32')
for path in sorted(glob.glob(f'{SRC}/dtm_*.tif')):
    with rasterio.open(path) as ds:
        b = ds.bounds
        xa, xb = max(E0 + x0, b.left), min(E0 + x0 + tw, b.right)
        ya, yb = max(N0 - z0 - th, b.bottom), min(N0 - z0, b.top)
        if xa >= xb or ya >= yb:
            continue
        a = ds.read(1, window=rasterio.windows.from_bounds(xa, ya, xb, yb, ds.transform))
        dtm[int(N0 - z0 - yb):int(N0 - z0 - yb) + a.shape[0], int(xa - E0 - x0):int(xa - E0 - x0) + a.shape[1]] = a

top = np.zeros(nz * nx, 'float32')        # highest vegetation return per cell
cnt = np.zeros(nz * nx, 'int32')          # returns between 0.5 and 3.2 m
ftop = np.zeros(nz * nx, 'float32')       # highest low unclassified return (fences, cars, ...)
fcnt = np.zeros(nz * nx, 'int32')
for path in sorted(glob.glob(f'{SRC}/las_*.laz')):
    las = laspy.read(path)
    cls = np.asarray(las.classification)
    wx, wz, z = np.asarray(las.x) - E0 - x0, (N0 - np.asarray(las.y)) - z0, np.asarray(las.z)
    ok = (wx >= 0) & (wz >= 0) & (wx < nx * BUSH_RES) & (wz < nz * BUSH_RES) & ((cls == 5) | (cls == 1))
    wx, wz, z, cls = wx[ok], wz[ok], z[ok], cls[ok]
    h = z - dtm[wz.astype(int), wx.astype(int)]
    idx = (wz / BUSH_RES).astype(int) * nx + (wx / BUSH_RES).astype(int)
    f = (cls == 1) & (h >= 0.5) & (h <= 2.4)                  # unclassified, fence height
    np.maximum.at(ftop, idx[f], h[f].astype('float32'))
    np.add.at(fcnt, idx[f], 1)
    v = cls == 5                                              # vegetation
    idx, h, ok = idx[v], h[v], v
    good = h > 0.3
    np.maximum.at(top, idx[good], h[good].astype('float32'))
    low = (h >= 0.5) & (h <= 3.2)
    np.add.at(cnt, idx[low], 1)
    print(os.path.basename(path), int(v.sum()), 'vegetation points', int(f.sum()), 'fence-height points', flush=True)
top = top.reshape(nz, nx)
cnt = cnt.reshape(nz, nx)
crown = ndimage.binary_dilation(top > 4.0, iterations=2)
bush = (top >= 0.5) & (top <= 3.2) & (cnt >= 2) & ~crown
bush = ndimage.binary_closing(bush, iterations=1) & ~crown
lab, n = ndimage.label(bush)
size = ndimage.sum(bush, lab, np.arange(n + 1))
bush &= size[lab] >= 4                                       # drop specks under 1 m2
hgt = ndimage.median_filter(np.where(top > 3.2, 0, top), 3)
hgt = np.where(bush, np.clip(np.maximum(hgt, 0.6), 0.6, 3.2), 0)

# ---- fences: thin straight runs of low unclassified returns, away from buildings
ftop = ftop.reshape(nz, nx)
etak = json.load(open(f'{SRC}/etak_bbox.json'))
fps = [shape(f['g']).buffer(1.5) for f in etak['E_401_hoone_ka'] + etak['E_403_muu_rajatis_ka']]
fps = [(mapping(g), 1) for g in fps if g.intersects(area)]
bld = rasterio.features.rasterize(fps, out_shape=(nz, nx), transform=from_origin(E0 + x0, N0 - z0, BUSH_RES, BUSH_RES))
F = (fcnt.reshape(nz, nx) >= 2) & (bld == 0) & (top < 3.5) & ~bush
k = 4
ax = np.arange(-k, k + 1, dtype='float32')
DX, DZ = np.meshgrid(ax, ax)
Ff = F.astype('float32')
m00 = np.maximum(ndimage.correlate(Ff, np.ones_like(DX)), 1e-6)
ex, ez = ndimage.correlate(Ff, DX) / m00, ndimage.correlate(Ff, DZ) / m00
cxx = ndimage.correlate(Ff, DX * DX) / m00 - ex * ex
czz = ndimage.correlate(Ff, DZ * DZ) / m00 - ez * ez
cxz = ndimage.correlate(Ff, DX * DZ) / m00 - ex * ez
disc = np.sqrt(((cxx - czz) / 2) ** 2 + cxz ** 2)
aniso = 2 * disc / np.maximum(cxx + czz, 1e-6)                # 1 = a line, 0 = a blob
ang = 0.5 * np.arctan2(2 * cxz, cxx - czz)                    # direction of the run in the x/z plane
fence = F & (aniso > 0.8) & (m00 >= 5)
lab, n = ndimage.label(fence, structure=np.ones((3, 3)))
size = ndimage.sum(fence, lab, np.arange(n + 1))
fence &= size[lab] >= 8                                      # at least about 4 m long
fh = np.where(fence, np.clip(ndimage.maximum_filter(ftop, 3), 0.9, 2.2), 0)
fa = np.round((ang % np.pi) / np.pi * 255).astype('uint8')
print('fence cells', int(fence.sum()))
np.savez_compressed(f'{SRC}/bushes.npz', h=np.round(hgt * 10).astype('uint8'), fh=np.round(fh * 10).astype('uint8'), fa=fa,
                    x0=x0, z0=z0, res=BUSH_RES)
print('bush cells', int(bush.sum()), 'of', bush.size, 'mean height', float(hgt[bush].mean()))
