# Map bake

Turns Maa- ja Ruumiamet open data into the compact files in `public/data/`.
Needs Python 3 with `numpy scipy pillow rasterio fiona shapely pyproj`.

Downloads (all from https://geoportaal.maaruum.ee, put them in one folder, `SRC` below):

1. Elevation → DTM 1 m GeoTIFF, all four quarters of map sheets `5465 5466 5475 5476 5485 5486` (`54651` ... `54864`, 24 files) → `dtm_<sheet>.tif`
2. Estonian Topographic Database → thematic SHP sets *Transportation*, *Waterbodies*, *Land use types*
   (unzip into `SRC/etak/`) and *Buildings* (unzip into `SRC/etak_e/`)
3. 3D data → *Buildings LOD2* and *Roofed areas LOD1* as OBJ for Tartu linn, Tartu vald, Kambja vald and Luunja vald (unzip)
4. 3D data → *Vegetation* GPKG for the same four municipalities (unzip)

Then:

```sh
cd SRC && python3 /path/to/repo/tools/bake/extract_etak.py     # writes etak_bbox.json
cd /path/to/repo
python3 tools/bake/rural.py SRC                                # open-country sectors -> rural_sectors.json
python3 tools/bake/fetch_ortho.py public/data/ortho SRC        # orthophoto tiles from the public WMS
python3 tools/bake/lidar_bushes.py SRC      # optional: hedges, bushes, fences (needs laspy[lazrs])
python3 tools/bake/bake.py SRC public/data
```

The drivable area is the polygon in `boundary.json` (L-EST97 coordinates); origin, sector size and
start position are in `config.py`. The area is cut into 640 m sectors. Each sector becomes one
gzip file `sec/{sx}_{sz}.kvs` (height grid, surface classes, obstacle distance field, buildings,
trees) plus 2x2 orthophoto tiles (4x4 for the sectors listed in `HI_SECTORS`, one tile for the
open-country sectors in `rural_sectors.json`), which the game
streams in around the car. `coarse.bin` and `ortho/overview.jpg` are the far scenery.

Bridges and tunnels (`terrain.py`): the terrain model has bridges removed and tunnels filled in.
Roads that ETAK marks as elevated, and roads that run over the river, become a "deck": a ribbon
above the height field, stored in `vectors.json`, that the game drives on when the car is level
with it, so the road or the river below stays open. A deck over water is marked `w: 1` and, for the
bridges of the Emajõgi listed in `BRIDGES`, carries the name and the look the game draws it with.
Tunnels are cut through their embankment as a trench with a deck as the lid, which carries the road
above. After that the terrain is levelled across every road (`grade_roads`), so road edges are
straight on the 2 m grid of the game.
`python3 tools/bake/reheight.py SRC public/data` rebuilds only the heights and the decks of the
existing sector files; it needs the terrain model sheets and `etak_bbox.json` (ETAK
*Transportation* and *Waterbodies*).
Decks from the laser scan (`lidar_decks.py`, after the bake or after `reheight.py`): the terrain model does
not know how high or how wide a bridge is, and a viaduct on walled ramps is missing from it. The lidar point
cloud has bridge decks as their own class. `lidar_grid.py` turns one 1 km lidar tile into height grids (the
download address is in its header; all sheets of the map are about 6 GB), and
`python3 tools/bake/lidar_decks.py GRIDS public/data --write` then replaces the spans of `terrain.py` with decks
at their real height and width, adds walled ramps (`wall: 1`), piers (`pr`), per-side railings (`rs`), clears
the terrain under open spans and lays a lid (`k: 0`) wherever a tunnel road passes under another road or path.
A river bridge is cut back to where the scan finds the bridge itself (the street before it is laid to the
scanned ground and rises to it), and its land ends get an earth bank.
It can be run again on its own output (start from the committed data: a second run on top of a first one
lets the banks near the water creep up a little). Check with `node tools/overpass-test.mjs --drive`, which walks every
road near a deck for steps, ditches and obstacles and drives a car over and under each span.
World frame: x = east − E0, z = −(north − N0), y = height − H0, in L-EST97 metres.

Detail area: `detail_area.json` outlines a zone (Kvissentali) that gets extra-sharp orthophoto
tiles (`ortho/x/`, 0.10 m/px, swapped in close to the car) and, from the low-altitude lidar
point clouds (Elevation data → Raw LiDAR data, 1:2000 sheets `476657 476658 477657 477658`,
saved as `las_<sheet>.laz`), hedges, bushes and garden fences. These are drawn but not solid.

Buildings and trees only: `python3 tools/bake/repack.py SRC public/data` rebuilds the buildings
(`buildings.py`) and re-applies the tree rules (`trees.py`) in the existing sector files. It needs
only the building OBJ files from step 3. Tree crown points that fall on a paved or gravel road are
moved to the verge when it is within reach of the crown, and dropped otherwise.

The full bake of the 163 km2 area needs about 8 GB of memory and 10 minutes. The single-tree data has
holes (for example a strip of Tartu vald between N 6479100 and 6480000, and Haage west of E 652000);
those places have no trees in the game. Without `SRC/bushes.npz` the bake writes no hedges; the
Kvissentali ones were carried over from the previous sector files.

Real wall colours (`tools/realism/`): `list_images.py CACHE.jsonl` lists the Mapillary photos of the area,
`colours.py CACHE.jsonl WORKDIR` samples the wall colour of every building a photo sees squarely and
writes `public/data/walls.json`; the other buildings borrow the colour of a similar building nearby.
It reads the buildings back from the sector files, so run it again after the sectors are re-baked.
`sheet.py` makes a contact sheet for checking the result by eye.

Roads, obstacles and fences (`surface.py`): road lines in `vectors.json` carry the ETAK surface type
(`s`: 1 stone, 2 gravel, 3 dirt, 4 wood) and `c`, the colour of that road in the orthophoto tiles,
which the game uses for the shade of the tarmac. Car parks and squares are in `areas`. Fences
(`Piirdeaed`) are not obstacles, because the game does not show them; walls are, and are drawn
from `walls`. `python3 tools/bake/resurface.py SRC public/data` rebuilds the obstacle field and
these lists in existing sector files; run it after `reheight.py`. It needs ETAK *Buildings* too.

Shop signs (`tools/realism/`): `osm_pois.py estonia-latest.osm.pbf POIS.json` keeps the named shops, cafes,
fuel stations and so on inside the boundary (OpenStreetMap extract from download.geofabrik.de, about 2 min).
`signs.py POIS.json SRC/etak_e/E_401_hoone_ka` puts each on its building (by the Land Board address when
that building is near, otherwise the building the map point is in), on the wall nearest the shop that faces
a street, and writes `public/data/signs.json`. Fuel stations, and big stores with no building in the map
data, get a pylon by the road. Like `walls.json`, re-run it after the sectors are re-baked.
