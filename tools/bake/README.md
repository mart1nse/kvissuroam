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
python3 tools/bake/bake.py SRC public/data
```

The drivable area is the polygon in `boundary.json` (L-EST97 coordinates); origin, sector size and
start position are in `config.py`. The area is cut into 640 m sectors. Each sector becomes one
gzip file `sec/{sx}_{sz}.kvs` (height grid, surface classes, obstacle distance field, buildings,
trees) plus 2x2 orthophoto tiles (4x4 for the sectors listed in `HI_SECTORS`), which the game
streams in around the car. `coarse.bin` and `ortho/overview.jpg` are the far scenery.

Bridges: the terrain model has bridges removed, so roads that ETAK marks as elevated get a deck
across water, and ramps cut into the embankments where they cross dry land (the map is a single
height field, so there are no real underpasses).
World frame: x = east − E0, z = −(north − N0), y = height − H0, in L-EST97 metres.
