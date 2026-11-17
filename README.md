# LINNARING

A free-driving browser game set in Tartu, Estonia. You start by the Toomemägi race track in the city centre and can roam about 163 km² of Tartu and its surroundings, from Lähte in the north to Ülenurme and Külitse in the south: real streets, lawns and the bank of the
Emajõgi in one of six cars.

| Car | Power | 0–100 km/h (factory / in game) | Top speed (factory / in game) |
| --- | --- | --- | --- |
| 1987 Mercedes-Benz 190E 2.6 (W201), 4-speed automatic | 118 kW | 9.2 s / 9.1 s | 210 / 214 km/h |
| 2007 Honda CR-V 2.0 i-VTEC, 5-speed automatic | 110 kW | 12.2 s / 11.9 s | 177 / 175 km/h |
| 2023 Škoda Enyaq 80x | 195 kW | 6.9 s / 6.9 s | 160 / 159 km/h |

The in-game figures come from `node tools/perf-test.mjs`, which floors each car on a flat dry road.

## Controls

- **Desktop:** arrow keys (or WASD). Down brakes, then reverses. Space is the handbrake.
  `R` puts the car back on the last intact spot, `H` back at the start, `G` opens the garage, `M` toggles sound.
- **Phone / tablet:** open the same link, hold the device in landscape, and use the on-screen pedals.

Driving into the Emajõgi (or a pond) sinks the car; use the reset buttons to carry on.

## Race track

You start on the Toomemägi race track, a 4.9 km lap on real streets around the hill
(Küüni, Vallikraavi, K. E. von Baeri, Jakobi, Lai, along the river to Kroonuaia, Jakobi, Veski,
Kuperjanovi, Pepleri, Vanemuise, Uueturu). The spawn is on Uueturu just before the last corner;
the start/finish line is on Küüni. Crossing the line starts the timer, and the next crossing
finishes the lap if all four checkpoints were passed. More than 300 m off the track in one lap
cancels it. While you are on or near the track its kerbs glow and the lap panel shows the
current lap, the best lap for your car across all players, and your last five laps.

The track centre line is `src/race/track.json`, made by `python3 tools/race/build-track.py`
from waypoints routed over the street network.

## Multiplayer

Everyone with the game open drives in the same world: other cars show with their driver's name
over them and on the maps, a toast says when someone joins, and cars bump off each other. Each
browser gets a default name nobody has finished a lap with; change it in the garage. Lap times
are kept on the server: **LAP TIMES** in the garage shows the best lap per car, all time and today,
and `/api/laps.csv` downloads every lap (driver, car, time, date).

The server is `worker/index.js`: a Worker with one SQLite Durable Object (`Lobby`) that relays
positions over WebSockets (hibernating when idle) and stores laps. It fits the Workers free plan.
To try it locally, `npx wrangler dev` serves the built game and the API on http://localhost:8787
(`npm run dev` still works, offline).

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in ./dist
node tools/perf-test.mjs    # 0-100 and top speed against factory figures
node tools/brake-test.mjs   # straight-line braking stays stable
node tools/spin-test.mjs    # wheelspin on launch and under power in a corner
```

Useful URL flags: `?drive` skips the menu, `?q=low` forces low graphics quality.

## Deploy (Cloudflare)

`wrangler.jsonc` serves `./dist` as Workers static assets and runs `worker/index.js` for `/api/*`.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (also creates the `Lobby` Durable Object on first deploy)

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
