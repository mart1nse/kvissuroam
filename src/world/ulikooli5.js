// Ülikooli from the town hall down to Poe, and Lossi from the university's language centre up to Inglisild
// (Martin, 22 Nov: kaardista, batch 5 of the Ülikooli and Jakobi area). No street photos of these fronts:
// colours, floors and roofs from the oblique air photos of 2017 to 2024, window counts guessed.
//  - Ülikooli, west side: number 14 with its pink old house on the street and the white new house behind it
//    towards the park (tall dark window slits), the pale yellow 12 and 10 over grey shop floors.
//  - Ülikooli, east side: the cream houses from the square to the Poe corner (Raekoja plats 1, 5, 3).
//  - Lossi: the pink Lossi 9, the cream Lossi 15 with its rust-brown new house behind, the small white house
//    (24), the cream 32 with its low white front, the yellow 34.
// Fronts only: nothing stands in the street, no street name on the road. Not here: Inglisild itself and the
// gunpowder cellar's brick front (the map has no walls for them).
//
// Freeze frames: built in the work queue within 300 m, a wall a step (skinHouses); only the walls that face
// Ülikooli, Poe or Lossi are painted finely.
import { Group } from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { still } from '../still.js';
import { S35, axes } from './ulikooli.js';
import { facing, house } from './ulikooli4.js';

const DEBUG = typeof location !== 'undefined' && /ulikoolidebug/.test(location.search);
const TIN = 0x9aa3ad, TILE = 0xc9785c;

const onStreet = facing([
  [[1336.9, 2836.2], [1347.5, 2850.4], [1383.7, 2893.6], [1390.6, 2902.0], [1411.2, 2930.3], [1434.6, 2964.1], [1446.6, 2982.9]],
  [[1434.6, 2964.1], [1462.6, 2946.4], [1482.2, 2935.2]],
  [[1122.6, 2926.4], [1145.3, 2916.4], [1247.2, 2873.9], [1336.9, 2836.2]],
  [[1383.7, 2893.6], [1413.1, 2877.7]],
]);

// a new house: plain wall, window slits as tall as a floor, here and there one left out
function slits(P, W, wall, glass, top, seed) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, wall);
  if (len < 4) return;
  const n = Math.max(1, Math.round((len - 0.8) / 2.4)), xs = axes(0.4, len - 0.4, n);
  for (let f = 0, y = 0.7; y + 2.5 < Math.min(top, W.eaves) - 0.3; f++, y += 3.25) {
    if (W.foot > 2.5 && y < W.foot + 0.3) continue;
    xs.forEach((x, k) => { if ((k * 7 + f * 3 + seed) % 5 === 0 || W.topAt(x) < y + 2.8 || W.botAt(x) > y + 0.2) return; const w = (k + f + seed) % 3 ? 0.9 : 1.5; P.r(x - w / 2, y, x + w / 2, y + 2.5, glass); });
  }
}
const PINK14 = house({ wall: '#ecd3d8', plinth: [0.8, '#a9a6aa'], floors: [[1.4, 2.0], [5.0, 2.1], [8.6, 1.9]], belts: [4.2], pitch: 2.7, win: { hood: 0.14 }, cornice: 0.6, doors: [12.6], seed: 91 });
const u14 = (P, W) => (Math.abs(Math.abs(W.nx) - 0.76) < 0.03 && Math.abs(Math.abs(W.nz) - 0.65) < 0.03 ? slits(P, W, '#eeeeec', '#2c3038', 16, 1) : PINK14(P, W));
const u12 = house({ wall: '#e8e2c4', plinth: [0.6, '#a5a39c'], floors: [[1.3, 2.0], [5.2, 2.1], [8.9, 2.0]], belts: [4.4], pitch: 2.7, win: { hood: 0.12 }, cornice: 0.5, seed: 92 }, { top: 3.5, pitch: 3.3, col: '#cfcdc4' });
const u10 = house({ wall: '#ebe3bf', plinth: [0.6, '#a5a39c'], floors: [[1.3, 2.0], [5.3, 2.1], [9.0, 2.0]], belts: [4.4], pitch: 2.6, win: { hood: 0.12 }, cornice: 0.5, seed: 93 }, { top: 3.4, pitch: 3.2, col: '#d5d0c4' });
const rk1 = house({ wall: '#f1ead2', plinth: [0.6, '#a8a59c'], floors: [[1.2, 1.9], [4.4, 1.7]], pitch: 2.8, seed: 94 });
const u5 = house({ wall: '#efe6cf', plinth: [0.6, '#a8a59c'], floors: [[1.3, 1.9], [4.8, 2.0], [7.6, 1.5]], belts: [4.0], pitch: 2.8, seed: 95 });
const u3 = house({ wall: '#f0e8d2', plinth: [0.7, '#a8a59c'], floors: [[1.3, 2.0], [5.0, 2.1], [8.6, 1.9]], belts: [4.2], pitch: 2.7, win: { hood: 0.12 }, seed: 96 }, { top: 3.4, pitch: 3.4 });
const l9 = house({ wall: '#e8bfb4', plinth: [0.9, '#a9a3a2'], floors: [[1.6, 1.9], [5.3, 2.0]], belts: [4.4], pitch: 2.6, win: { hood: 0.14 }, cornice: 0.5, seed: 97 });
const CREAM15 = house({ wall: '#efe9c9', plinth: [1.2, '#a9a79c'], floors: [[1.9, 1.8], [4.7, 1.7], [8.0, 1.6]], pitch: 2.9, seed: 98 });
const l15 = (P, W) => (W.mid[1] < 2862 ? slits(P, W, '#8a5a48', '#2a2423', 13, 2) : CREAM15(P, W));
const l24 = house({ wall: '#f1efe8', plinth: [0.5, '#a9a8a2'], floors: [[1.0, 1.5], [4.4, 1.4]], pitch: 2.5, seed: 99 });
const LOW32 = house({ wall: '#f0eee8', plinth: [0.5, '#a9a8a2'], floors: [[1.2, 1.7]], pitch: 2.5, seed: 100 });
const HIGH32 = house({ wall: '#e9d2bd', plinth: [0.6, '#a9a39c'], floors: [[1.4, 1.9], [4.8, 1.9], [8.0, 1.8], [11.0, 1.6]], pitch: 2.7, seed: 101 });
const l32 = (P, W) => (W.eaves < 7 ? LOW32 : HIGH32)(P, W);
const l34 = house({ wall: '#f0dc8c', plinth: [0.5, '#a9a594'], floors: [[1.2, 1.7], [4.2, 1.5]], pitch: 2.4, seed: 102 });

// [name, base, at, reach, wall colour, roof colour (none: the square's own entry keeps its colours), painter]
const HOUSES = [
  ['u14', 664, [1385, 2928], 26, 0xecd3d8, TIN, u14],
  ['u12', 744, [1405, 2950], 20, 0xe8e2c4, TIN, u12],
  ['u10', 821, [1420, 2976], 18, 0xebe3bf, 0x6f7379, u10],
  ['rk1', 532, [1412, 2900], 26, 0xf1ead2, null, rk1],
  ['u5', 593, [1428, 2924], 22, 0xefe6cf, TILE, u5],
  ['u3', 591, [1440, 2947], 12, 0xf0e8d2, TILE, u3],
  ['l9', 1355, [1224, 2869], 10, 0xe8bfb4, TIN, l9],
  ['l15', 1663, [1168, 2874], 42, 0xefe9c9, 0xb4bcc6, l15],
  ['l24', 1459, [1224, 2896], 10, 0xf1efe8, 0xa5604c, l24],
  ['l32', 1604, [1207, 2914], 18, 0xe9d2bd, 0x4f4a48, l32],
  ['l34', 1808, [1179, 2921], 10, 0xf0dc8c, TIN, l34],
];
const CENTRE = [1300, 2905];

export function ulikooli5Walls(walls) {
  setHouseColours(walls, S35[0], S35[1], S35[2], HOUSES.filter((H) => H[5] !== null).map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

export function createUlikooli5(scene, world, { shadows = true } = {}) {
  const group = still(new Group());
  scene.add(group);
  let built = false;
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 300) return;
      if (![[1385, 2928], [1420, 2976], [1168, 2874], [1224, 2896]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      // (queued by skinHouses itself: a wall a step, see ../jobs.js)
      const houses = HOUSES.map(([name, base, at, r, , , paint]) => ({ name, sec: S35[0], base, at, r, spec: { wall: [236, 230, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
      skinHouses(world, group, houses, { shadows, ppm: 8, far: 4, faces: onStreet, debug: DEBUG, label: 'ulikooli5 fronts' });
    },
  };
}
