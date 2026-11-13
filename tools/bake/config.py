"""Shared constants for the KvissuRoam map bake.

World frame: x = east - E0, z = -(north - N0), y = height - H0 (metres).
Projection: L-EST97 (EPSG:3301).

The drivable area is the polygon in boundary.json (L-EST97 coordinates). It is
cut into square sectors that the game streams in around the car.
"""
import json
import os

E0, N0, H0 = 657800.0, 6477150.0, 34.0
SECTOR = 640.0         # sector size (m)
GRID0 = -800.0         # sector (0,0) starts at x = z = GRID0
HM_RES = 2.0           # sector heightmap resolution (m)
SURF_RES = 1.0         # surface-class mask resolution (m)
SDF_RES = 0.5          # obstacle distance field resolution (m)
TILE_PX = 1024         # orthophoto tile size in pixels
XTILE_PX = 1536        # extra-sharp tiles (0.10 m/px) inside detail_area.json, shown close to the car
BUSH_RES = 0.5         # lidar bush/hedge grid (m)
# coarse far-scenery grid (world x/z, metres)
CX0, CX1, CZ0, CZ1 = -3808.0, 6432.0, -4768.0, 7264.0
COARSE_RES = 32.0
OVERVIEW_PX = (3488, 4096)
MOSAIC_RES = 1.25      # working orthophoto mosaic for roof colours / driveway detection
# start: driveway of Kvissentali tee 8, facing the street (north)
START_E, START_N = 657870.0, 6477151.0

_here = os.path.dirname(os.path.abspath(__file__))
BOUNDARY = json.load(open(os.path.join(_here, 'boundary.json')))
DETAIL_AREA = json.load(open(os.path.join(_here, 'detail_area.json')))   # extra-detail zone (Kvissentali)


def _detail():
    from shapely.geometry import Polygon, box
    poly = Polygon(DETAIL_AREA)
    hi, xt = set(), []
    minx, miny, maxx, maxy = poly.bounds
    for sz in range(int((-(maxy - N0) - GRID0) // SECTOR), int((-(miny - N0) - GRID0) // SECTOR) + 1):
        for sx in range(int((minx - E0 - GRID0) // SECTOR), int((maxx - E0 - GRID0) // SECTOR) + 1):
            x0 = GRID0 + sx * SECTOR; z0 = GRID0 + sz * SECTOR
            if poly.intersection(box(E0 + x0, N0 - z0 - SECTOR, E0 + x0 + SECTOR, N0 - z0)).area < 4000:
                continue
            hi.add((sx, sz))
            t = SECTOR / 4
            for j in range(4):
                for i in range(4):
                    if poly.intersects(box(E0 + x0 + i * t, N0 - z0 - (j + 1) * t, E0 + x0 + (i + 1) * t, N0 - z0 - j * t)):
                        xt.append((sx, sz, i, j))
    return hi, xt


# sectors with 4x4 orthophoto tiles (0.16 m/px) instead of 2x2 (0.31 m/px), and the extra-sharp tiles
HI_SECTORS, XTILES = _detail()
HI_SECTORS |= {(0, 0), (1, 0), (0, 1), (1, 1)}


def sectors():
    """Sector indices (sx, sz) that touch the drivable polygon."""
    from shapely.geometry import Polygon, box
    poly = Polygon(BOUNDARY)
    minx, miny, maxx, maxy = poly.bounds
    out = []
    sx0 = int((minx - E0 - GRID0) // SECTOR); sx1 = int((maxx - E0 - GRID0) // SECTOR)
    sz0 = int((-(maxy - N0) - GRID0) // SECTOR); sz1 = int((-(miny - N0) - GRID0) // SECTOR)
    for sz in range(sz0, sz1 + 1):
        for sx in range(sx0, sx1 + 1):
            x0 = GRID0 + sx * SECTOR; z0 = GRID0 + sz * SECTOR
            if poly.intersects(box(E0 + x0, N0 - z0 - SECTOR, E0 + x0 + SECTOR, N0 - z0)):
                out.append((sx, sz))
    return out


def detail_rect():
    """World-space rectangle (x0, z0, x1, z1) covering all sectors."""
    s = sectors()
    xs = [a for a, _ in s]; zs = [b for _, b in s]
    return (GRID0 + min(xs) * SECTOR, GRID0 + min(zs) * SECTOR,
            GRID0 + (max(xs) + 1) * SECTOR, GRID0 + (max(zs) + 1) * SECTOR)
