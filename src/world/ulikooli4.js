// Rüütli from Gildi to Raekoja plats, with Küütri and the Gildi corners (Martin, 22 Nov: kaardista, batch 4 of
// the Ülikooli and Jakobi area). No street photos here: colours, floors and roofs from the oblique air photos
// of 2020 to 2024, window counts and the ground floors guessed.
//  - West side of Rüütli: the salmon house north of Gildi (14), the low yellow houses with shop floors (12, 10,
//    8), the white house with red awnings (6), the low cream house and the cream corner of the square (4, 2).
//  - East side: the pale house with six columns at the Gildi corner (11), the white house on the Küütri corner
//    (9), the modern house with its light grid and dark windows (7), the house over a red-brown shop floor (5)
//    and the white corner of the square with red-brown frames.
//  - Küütri: the cream row on the south side, Küütri 6 and the small house beside it; Gildi 3.
// Fronts only: nothing stands in the street, no street name on the road.
//
// Freeze frames: built in the work queue within 300 m, a wall a step (skinHouses). Only the walls that face
// Rüütli, Küütri, Gildi or the square are painted finely; the yard walls are coarse (phones' memory).
import { Group } from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { still } from '../still.js';
import { S35, axes, classic } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /ulikoolidebug/.test(location.search);
const TIN = 0x9aa3ad, TILE = 0xc9785c, DARK = 0x55585e;
const WHT = '#f6f3ec', SHOPGLASS = '#3b424c';

// the streets these houses stand on (the game's own lines), and the fronts of the square's north row
const STREETS = [
  [[1347.9, 2625], [1365.3, 2674.1], [1391.2, 2745.1], [1426.5, 2844.6]],
  [[1307.5, 2777.3], [1391.2, 2745.1], [1472.1, 2713.1]],
  [[1292.6, 2688.1], [1365.3, 2674.1], [1451.4, 2656.4]],
  [[1391.8, 2830.8], [1412.0, 2827.6], [1445.8, 2818.8]],
];
// a test for skinHouses' `faces`: the wall looks onto one of these lines within some 16 m
export function facing(lines) {
  return (W) => {
    if (W.len < 6 || W.ylo - W.yref > 3) return false;                // (asked before skinHouses has measured W.foot: a wall that starts above a roof)
    const px = W.mid[0] + W.nx * 7, pz = W.mid[1] + W.nz * 7;
    for (const line of lines) for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t) < 9) return true;
    }
    return false;
  };
}
const onStreet = facing(STREETS);

// a shop floor: wide dark windows between piers, a door every third bay, a band over them
export function shops(P, W, o) {
  if (W.foot > 2.5 || W.len < 5) return;
  const len = W.len, top = o.top || 3.5, n = Math.max(1, Math.round((len - 0.8) / (o.pitch || 3.4))), xs = axes(0, len, n), w = o.w || 2.3;
  if (o.col) P.r(0, 0.5, len, top + 0.35, o.col);
  xs.forEach((x, k) => {
    if (x - w / 2 < 0.3 || x + w / 2 > len - 0.3 || W.topAt(x) < top + 0.4) return;
    if (k % 3 === 1) P.door(x - 0.65, x + 0.65, top - 0.3, o.door || '#4b3a34', { frame: o.frame || WHT, light: 0.45 });
    else P.win(x - w / 2, 0.75, x + w / 2, top - 0.2, { frame: o.frame || WHT, glass: SHOPGLASS, fw: 0.08, bars: 1, surround: 0, sill: 0 });
    if (o.awning) P.r(x - w / 2 - 0.15, top - 0.15, x + w / 2 + 0.15, top + 0.3, o.awning);
  });
  P.r(0, top + 0.35, len, top + 0.5, o.trim || WHT);
}
// a plastered house over a shop floor on the street side, plain plaster towards the yard
export const house = (o, shop) => (P, W) => {
  // (no rain streaks on these: hundreds of soft strokes a wall, 50 ms and more for a long front on an old computer)
  if (!shop || !W.front) return classic(P, W, { ...o, weather: 0 });
  classic(P, W, { ...o, weather: 0, floors: o.floors.filter(([sill]) => sill > (shop.top || 3.5) + 0.6), doors: [] });
  shops(P, W, shop);
};

const r14 = house({ wall: '#e8c3b2', plinth: [0.6, '#a59a96'], floors: [[1.3, 1.9], [5.1, 2.0], [8.7, 2.0], [12.2, 1.7]], belts: [4.3, 11.5], pitch: 2.7, win: { hood: 0.14 }, cornice: 0.6, seed: 71 }, { top: 3.4, pitch: 3.2 });
const r12 = house({ wall: '#ecdfae', plinth: [0.5, '#a8a294'], floors: [[1.1, 1.8], [4.3, 1.5]], pitch: 2.7, seed: 72 });
const g3 = house({ wall: '#e9e1c8', plinth: [0.7, '#a5a29a'], floors: [[1.4, 1.9], [4.9, 2.0], [8.2, 1.5]], belts: [4.1], pitch: 2.8, seed: 73 });
const r10 = house({ wall: '#f0e2a8', plinth: [0.5, '#a8a294'], floors: [[1.0, 2.0]], pitch: 3.0, w: 1.5, win: { T: false, bars: 2 }, doors: [3.2], cornice: 0.3, seed: 74 });
const r8 = house({ wall: '#efe3a6', plinth: [0.6, '#a8a294'], floors: [[1.2, 1.9], [5.2, 2.0]], belts: [4.3], pitch: 2.9, seed: 75 }, { top: 3.3, pitch: 3.4, frame: '#3a3f46' });
const k6 = house({ wall: '#ece8dc', plinth: [0.7, '#a6a6a2'], floors: [[1.5, 1.9], [5.0, 2.0], [8.2, 1.5]], belts: [4.2], pitch: 2.8, seed: 76 });
const k4b = house({ wall: '#e9e4d4', plinth: [0.6, '#a6a6a2'], floors: [[1.4, 1.8], [4.8, 1.9], [7.9, 1.4]], pitch: 2.6, seed: 77 });
const r6 = house({ wall: '#efe6cc', plinth: [0.7, '#a7a399'], floors: [[1.3, 2.0], [5.0, 2.0], [8.6, 1.9]], belts: [4.3], pitch: 2.7, seed: 78 }, { top: 3.4, pitch: 3.6 });
const r4 = house({ wall: '#f2efe6', plinth: [0.6, '#a6a6a2'], floors: [[1.3, 2.0], [5.4, 2.2], [9.2, 2.1]], belts: [4.6, 8.4], pitch: 2.5, win: { frame: '#4a4440', hood: 0.16 }, cornice: 0.7, seed: 79 }, { top: 3.5, pitch: 3.3, awning: '#c8553d', frame: '#4a4440' });
const R2LOW = { wall: '#f0dcc4', plinth: [0.5, '#a8a39a'], floors: [[1.2, 1.9], [5.2, 1.9]], belts: [4.2], pitch: 2.8, seed: 80 };
const R2 = { wall: '#f3eedf', plinth: [0.7, '#a8a39a'], floors: [[1.3, 2.2], [6.0, 2.3], [10.2, 2.2]], belts: [4.8, 9.3], pitch: 2.9, win: { hood: 0.14 }, cornice: 0.6, seed: 81 };
const r2low = house(R2LOW, { top: 3.3, pitch: 3.6 }), r2high = house(R2, { top: 3.8, pitch: 3.4 });
const r2 = (P, W) => (W.eaves < 11 ? r2low : r2high)(P, W);

// Rüütli 11: six white columns two floors high before the middle of the long front
function r11(P, W) {
  const o = { wall: '#f1e6e2', plinth: [0.7, '#b1aba8'], ground: [4.2, '#f4efec', true], floors: [[1.5, 2.0], [5.4, 2.1]], pitch: 2.8, cornice: 0.5, weather: 0, seed: 82 };
  if (!W.front || W.len < 38 || W.nx > -0.8) return classic(P, W, o);
  const len = W.len, c = len / 2, h0 = 13, top = Math.min(9.3, W.eaves - 0.2);
  classic(P, W, { ...o, xs: axes(0, len, 15).filter((x) => Math.abs(x - c) > h0 / 2 + 0.6) });
  P.r(c - h0 / 2, 0.7, c + h0 / 2, top, '#e9e2df');                         // the wall behind the columns, in shade
  for (const x of axes(c - h0 / 2, c + h0 / 2, 5)) { P.win(x - 0.6, 1.4, x + 0.6, 3.7, { glass: '#4b5566', T: true }); P.win(x - 0.6, 5.3, x + 0.6, 7.5, { glass: '#4b5566', T: true }); }
  for (let k = 0; k < 6; k++) {
    const x = c - h0 / 2 + 0.5 + k * (h0 - 1) / 5;
    P.r(x - 0.42, 0.7, x + 0.42, top - 0.5, WHT); P.r(x + 0.2, 0.7, x + 0.42, top - 0.5, '#dcd8d2'); P.r(x - 0.55, top - 0.75, x + 0.55, top - 0.5, WHT); P.r(x - 0.55, 0.7, x + 0.55, 1.0, '#e6e2dc');
  }
  P.r(c - h0 / 2 - 0.3, top - 0.5, c + h0 / 2 + 0.3, top + 0.25, WHT); P.r(c - h0 / 2 - 0.3, top - 0.5, c + h0 / 2 + 0.3, top - 0.44, 'rgba(60,60,70,0.25)');
}
const r9 = house({ wall: '#f0ede6', plinth: [0.7, '#aaa9a6'], ground: [4.3, '#e9e6de', true], floors: [[1.4, 2.0], [5.3, 2.1], [9.0, 2.1]], belts: [8.2], pitch: 2.7, cornice: 0.6, doors: [11.5], seed: 83 });

// Rüütli 7: a light grid of piers and floors, the windows dark and as tall as the floor, a dark top
function modern(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, '#e4e4e0');
  if (len < 4) return;
  const n = Math.max(1, Math.round((len - 0.6) / 3.1)), xs = axes(0.3, len - 0.3, n);
  for (const [y0, y1] of [[0.25, 3.5], [4.2, 6.8], [7.5, 10.1], [10.8, 13.2]]) {
    if (y1 > top - 0.2 || (W.foot > 2.5 && y0 < W.foot + 0.3)) continue;
    for (const x of xs) if (W.topAt(x) > y1 + 0.2 && W.botAt(x) < y0 + 0.2) { P.r(x - 1.15, y0, x + 1.15, y1, '#2b2f36'); P.r(x - 0.04, y0, x + 0.04, y1, '#4a4f58'); if (y0 > 1) P.r(x - 1.15, y0, x + 1.15, y0 + 0.9, '#3a3f47'); }
  }
  if (W.peak - W.eaves < 1.2) P.r(0, top - 0.3, len, top, '#3a3c42');
}
const r5 = house({ wall: '#efe2c6', plinth: [0.5, '#8b6a5e'], floors: [[1.2, 1.9], [5.3, 1.9]], belts: [4.3], pitch: 2.6, seed: 84 }, { top: 3.3, pitch: 3.0, col: '#9a5a48', frame: '#e9dccb', trim: '#e9dccb' });
const r3 = house({ wall: '#e9dfcf', plinth: [0.5, '#a39c94'], floors: [[1.2, 1.8], [4.9, 1.8], [8.2, 1.6]], pitch: 2.6, seed: 85 });
const rk8 = house({ wall: '#f6f3ee', plinth: [0.7, '#b0a9a4'], floors: [[1.2, 2.2], [5.3, 2.2], [9.1, 2.0]], belts: [4.5, 8.3], pitch: 2.6, win: { frame: '#8a4a3a', hood: 0.16 }, cornice: 0.6, seed: 86 }, { top: 3.6, pitch: 3.3, frame: '#8a4a3a' });

// [name, base, at, reach, wall colour, roof colour (none: the square's own entry keeps its colours), painter]
const HOUSES = [
  ['r14', 319, [1348, 2667], 16, 0xe8c3b2, 0x8a7468, r14],
  ['r12', 341, [1356, 2693], 16, 0xecdfae, DARK, r12],
  ['g3', 382, [1339, 2698], 18, 0xe9e1c8, 0x4f4a48, g3],
  ['r10', 360, [1363, 2718], 16, 0xf0e2a8, TILE, r10],
  ['r8', 377, [1373, 2733], 14, 0xefe3a6, TILE, r8],
  ['k6', 408, [1358, 2743], 12, 0xece8dc, TIN, k6],
  ['k4b', 547, [1339, 2740], 8, 0xe9e4d4, TIN, k4b],
  ['r6', 371, [1367, 2771], 24, 0xefe6cc, 0x5c554a, r6],
  ['r4', 389, [1381, 2781], 18, 0xf2efe6, TIN, r4],
  ['r2', 401, [1398, 2806], 30, 0xf3eedf, null, r2],
  ['r11', 257, [1397, 2698], 30, 0xf1e6e2, 0xb4bcc6, r11],
  ['r9', 256, [1405, 2722], 26, 0xf0ede6, 0xb4bcc6, r9],
  ['r7', 237, [1414, 2755], 28, 0xe4e4e0, 0x2f3136, modern],
  ['r5', 331, [1417, 2785], 12, 0xefe2c6, TIN, r5],
  ['r3', 392, [1428, 2796], 14, 0xe9dfcf, 0x8a6f62, r3],
  ['rk8', 371, [1428, 2811], 22, 0xf6f3ee, null, rk8],
];
const CENTRE = [1385, 2745];

export function ulikooli4Walls(walls) {
  setHouseColours(walls, S35[0], S35[1], S35[2], HOUSES.filter((H) => H[5] !== null).map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

export function createUlikooli4(scene, world, { shadows = true } = {}) {
  const group = still(new Group());
  scene.add(group);
  let built = false;
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 300) return;
      if (![[1356, 2693], [1397, 2698], [1398, 2806], [1414, 2755]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      // (queued by skinHouses itself: a wall a step, see ../jobs.js)
      const houses = HOUSES.map(([name, base, at, r, , , paint]) => ({ name, sec: S35[0], base, at, r, spec: { wall: [236, 230, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
      skinHouses(world, group, houses, { shadows, ppm: 8, far: 4, faces: onStreet, debug: DEBUG, label: 'ulikooli4 fronts' });
    },
  };
}
