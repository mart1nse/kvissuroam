# KvissuRoam

A free-driving browser game set in Kvissentali, Tartu, Estonia. You start in a driveway on
Kvissentali tee and can roam about 1.6 km × 1.6 km of real streets, lawns and the bank of the
Emajõgi in one of three black cars.

| Car | Power | 0–100 km/h (factory / in game) | Top speed (factory / in game) |
| --- | --- | --- | --- |
| 1987 Mercedes-Benz 190E 2.6 (W201), 4-speed automatic | 118 kW | 9.2 s / 9.1 s | 210 / 214 km/h |
| 2007 Honda CR-V 2.0 i-VTEC, 5-speed automatic | 110 kW | 12.2 s / 11.9 s | 177 / 175 km/h |
| 2023 Škoda Enyaq 80x | 195 kW | 6.9 s / 6.9 s | 160 / 159 km/h |

The in-game figures come from `node tools/perf-test.mjs`, which floors each car on a flat dry road.

## Controls

- **Desktop:** arrow keys (or WASD). Down brakes, then reverses. Space is the handbrake.
  `R` puts the car back on the last intact spot, `H` back in the driveway, `G` opens the garage, `M` toggles sound.
- **Phone / tablet:** open the same link, hold the device in landscape, and use the on-screen pedals.

Driving into the Emajõgi (or a pond) sinks the car; use the reset buttons to carry on.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in ./dist
node tools/perf-test.mjs
```

Useful URL flags: `?drive` skips the menu, `?q=low` forces low graphics quality.

## Deploy (Cloudflare)

The site is fully static. `wrangler.jsonc` serves `./dist` as Workers static assets.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

## How the world is made

Everything under `public/data/` is baked from open data by the scripts in `tools/bake/`
(see `tools/bake/README.md`): a 1 m terrain model, orthophotos, the Estonian Topographic
Database (roads, water, buildings, fences), LOD2 3D buildings and individual trees measured by
laser scanning. The 3D car models are generated in code (`src/cars/models/`).

## Data credits

Orthophoto, elevation model, Estonian Topographic Database (ETAK), 3D building models and
single-tree data: **Maa- ja Ruumiamet (Republic of Estonia Land and Spatial Development Board), 2026**,
used under the [open data licence](https://geoportaal.maaruum.ee/avaandmete-litsents).

Car names are used descriptively; this is a fan project with no affiliation to the manufacturers.
