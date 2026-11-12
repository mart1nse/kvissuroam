# Map bake

Turns Maa- ja Ruumiamet open data into the compact files in `public/data/`.
Needs Python 3 with `numpy scipy pillow rasterio fiona shapely pyproj`.

Downloads (all from https://geoportaal.maaruum.ee, put them in one folder, `SRC` below):

1. Elevation → DTM 1 m GeoTIFF, map sheet `54754` → `dtm_54754.tif`
2. Estonian Topographic Database → thematic SHP sets *Transportation*, *Waterbodies*, *Land use types*
   (unzip into `SRC/etak/`) and *Buildings* (unzip into `SRC/etak_e/`)
3. 3D data → *Buildings LOD2* and *Roofed areas LOD1* as OBJ for Tartu linn and Tartu vald (unzip)
4. 3D data → *Vegetation* GPKG for Tartu linn and Tartu vald (unzip)

Then:

```sh
cd SRC && python3 /path/to/repo/tools/bake/extract_etak.py     # writes etak_bbox.json
cd /path/to/repo
python3 tools/bake/fetch_ortho.py public/data/ortho            # orthophoto tiles from the public WMS
python3 tools/bake/bake.py SRC public/data
```

The area, origin and start position are set in `config.py`.
World frame: x = east − E0, z = −(north − N0), y = height − H0, in L-EST97 metres.
