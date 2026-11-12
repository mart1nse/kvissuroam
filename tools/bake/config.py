"""Shared constants for the KvissuRoam map bake.

World frame: x = east - E0, z = -(north - N0), y = height - H0 (metres).
Projection: L-EST97 (EPSG:3301).
"""
E0, N0, H0 = 657800.0, 6477150.0, 34.0
INNER = 800.0          # half-size of the drivable square (m)
OUTER = 1600.0         # half-size of the scenery square (m)
HM_RES = 2.0           # inner heightmap resolution (m)
HM_OUTER_RES = 16.0    # outer heightmap resolution (m)
SURF_RES = 1.0         # surface-class mask resolution (m)
SDF_RES = 0.5          # obstacle distance field resolution (m)
TILE = 160.0           # ortho tile size (m)
TILE_PX = 1024
OVERVIEW_PX = 2048
# start: driveway of Kvissentali tee 8, facing the street (north)
START_E, START_N = 657870.0, 6477151.0
