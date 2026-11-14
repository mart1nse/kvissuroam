# Map bake

Turns Maa- ja Ruumiamet open data into the compact files in `public/data/`.
Needs Python 3 with `numpy scipy pillow rasterio fiona shapely pyproj`.

Downloads (all from https://geoportaal.maaruum.ee, put them in one folder, `SRC` below):

1. Elevation → DTM 1 m GeoTIFF, map sheets `54752 54754 54761 54763 54852 54861` → `dtm_<sheet>.tif`
2. Estonian Topographic Database → thematic SHP sets *Transportation*, *Waterbodies*, *Land use types*
   (unzip into `SRC/etak/`) and *Buildings* (unzip into `SRC/etak_e/`)
3. 3D data → *Buildings LOD2* and *Roofed areas LOD1* as OBJ for Tartu linn and Tartu vald (unzip)
4. 3D data → *Vegetation* GPKG for Tartu linn and Tartu vald (unzip)

Then:

```sh
cd SRC && python3 /path/to/repo/tools/bake/extract_etak.py     # writes etak_bbox.json
cd /path/to/repo
python3 tools/bake/fetch_ortho.py public/data/ortho SRC        # orthophoto tiles from the public WMS
python3 tools/bake/lidar_bushes.py SRC      # optional: hedges, bushes, fences (needs laspy[lazrs])
python3 tools/bake/bake.py SRC public/data
```

The drivable area is the polygon in `boundary.json` (L-EST97 coordinates); origin, sector size and
start position are in `config.py`. The area is cut into 640 m sectors. Each sector becomes one
gzip file `sec/{sx}_{sz}.kvs` (height grid, surface classes, obstacle distance field, buildings,
trees) plus 2x2 orthophoto tiles (4x4 for the sectors listed in `HI_SECTORS`), which the game
streams in around the car. `coarse.bin` and `ortho/overview.jpg` are the far scenery.

Bridges and tunnels (`terrain.py`): the terrain model has bridges removed and tunnels filled in.
Roads that ETAK marks as elevated get a causeway in the height field where they cross water, and
a "deck" where they cross dry land: a ribbon above the height field, stored in `vectors.json`, that
the game drives on when the car is level with it, so the road below stays open. Tunnels are cut
through their embankment as a trench with a deck as the lid, which carries the road above.
`python3 tools/bake/reheight.py SRC public/data` rebuilds only the heights and the decks of the
existing sector files; it needs the terrain model sheets and `etak_bbox.json` (ETAK
*Transportation* and *Waterbodies*).
World frame: x = east − E0, z = −(north − N0), y = height − H0, in L-EST97 metres.

Detail area: `detail_area.json` outlines a zone (Kvissentali) that gets extra-sharp orthophoto
tiles (`ortho/x/`, 0.10 m/px, swapped in close to the car) and, from the low-altitude lidar
point clouds (Elevation data → Raw LiDAR data, 1:2000 sheets `476657 476658 477657 477658`,
saved as `las_<sheet>.laz`), hedges, bushes and garden fences. These are drawn but not solid.

Buildings and trees only: `python3 tools/bake/repack.py SRC public/data` rebuilds the buildings
(`buildings.py`) and re-applies the tree rules (`trees.py`) in the existing sector files. It needs
only the building OBJ files from step 3. Tree crown points that fall on a paved or gravel road are
moved to the verge when it is within reach of the crown, and dropped otherwise.
