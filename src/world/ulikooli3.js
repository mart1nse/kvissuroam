// Behind and beside the university's main building (Martin, 22 Nov: kaardista, batch 3 of the Ülikooli and
// Jakobi area; Street View shots of Aug 2024 from 19 Ülikooli and 2 and 4 Jakobi, and the air photos).
//  - Ülikooli kohvik (Ülikooli 20): the pale green wing with three arched windows over the café's name under
//    wide dark eaves, the cream main house behind it, the terrace, the cream house on the yard (18a).
//  - The old university church in the yard: pale yellow below, white above, arched windows.
//  - Jakobi 4: the pale green-white house with its tall windows, and the shed behind it.
//  - The iron fence and the white gate posts between the church and the pink wing on Jakobi, two lanterns.
//  - From the air photos only (colours and window counts guessed): the houses across Munga (Munga 4 and its
//    neighbours) and the white house across Ülikooli north of Gildi.
// Nothing stands on a carriageway; no street name on the road. The café's street fence is left out: the map
// draws the yard lane and Ülikooli over where it stands.
//
// Freeze frames: built in the work queue within 330 m, the fronts a wall a step (skinHouses), the fence in two
// steps. No picture of its own: the fronts share the house-front pages.
import { Group } from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { S35, axes, row, classic } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /ulikoolidebug/.test(location.search);
const SERIF = '700 %px Georgia, "Times New Roman", serif';
const TIN = 0x8f98a3, WHT = '#fbfaf6', GLASS = '#3f4853';

// an arched opening: white surround, dark glass, a mullion and a bar at the springing
function arch(P, W, x, y0, y1, w) {
  if (x < w || x > W.len - w || W.topAt(x) < y1 + w / 2 + 0.4 || W.botAt(x) > y0 - 0.2) return;
  P.r(x - w / 2 - 0.15, y0 - 0.1, x + w / 2 + 0.15, y1, WHT); P.arc(x, y1, w / 2 + 0.15, WHT, Math.PI, Math.PI * 2);
  P.r(x - w / 2, y0, x + w / 2, y1, GLASS); P.arc(x, y1, w / 2, GLASS, Math.PI, Math.PI * 2);
  P.r(x - 0.03, y0, x + 0.03, y1 + w / 2, WHT); P.r(x - w / 2, y1 - 0.03, x + w / 2, y1 + 0.03, WHT);
}

const KCREAM = { wall: '#e7dfc0', plinth: [0.9, '#aaa89e'], floors: [[1.6, 2.0], [5.3, 2.2], [9.0, 1.8]], belts: [4.4], pitch: 3.1, seed: 61 };
function kohvik(P, W, name) {
  if (W.peak > 10.6 || W.foot > 2.5) return classic(P, W, KCREAM);          // the main house; the low wing is the café
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05), n = Math.max(1, Math.round((len - 1) / 3.2)), xs = axes(0, len, n);
  P.r(0, P.y0, len, P.y1, '#dfe6d4'); if (W.front) P.weather(0, P.y0, len, P.y1, 0.2, 61);
  P.r(0, P.y0, len, 0.8, '#aeb1ab'); P.r(0, 4.3, len, 4.5, '#f4f5ef');
  row(P, W, xs, 1.5, 2.2, 1.5, { frame: '#2e3230', glass: '#39424a', fw: 0.06, bars: 1, rails: 1, surround: 0.1, sc: '#f4f5ef' });
  for (const x of xs) arch(P, W, x, 5.6, 7.4, 1.2);
  if (name && len > 11) P.text('ÜLIKOOLI KOHVIK', len / 2, 4.98, 0.5, '#3b3430', SERIF);
  if (W.peak - W.eaves < 1.2) { P.r(0, top - 0.5, len, top, '#3b3430'); for (let x = 0.4; x < len; x += 0.9) P.r(x, top - 0.85, x + 0.12, top - 0.5, '#3b3430'); }   // the wide dark eaves on brackets
}
const kohvikFront = (P, W) => kohvik(P, W, true);
const yard18a = (P, W) => classic(P, W, { wall: '#ebe3c6', plinth: [0.9, '#a9aaa4'], floors: [[1.6, 2.0], [5.2, 2.2], [8.8, 1.8]], pitch: 3.2, seed: 62 });
const terrace = (P, W) => { P.r(0, P.y0, W.len, P.y1, '#e9e7dc'); P.r(0, P.y0, W.len, 0.5, '#b5b4ae'); P.r(0, P.y1 - 0.25, W.len, P.y1, '#f6f5ef'); for (let x = 0.5; x < W.len - 0.4; x += 2.4) P.r(x, 0.9, x + 1.9, P.y1 - 0.6, '#dedbcd'); };

function church(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05), n = Math.max(1, Math.round((len - 1) / 4.4)), xs = axes(0, len, n);
  P.r(0, P.y0, len, P.y1, '#f3f0e6'); if (W.front) P.weather(0, P.y0, len, P.y1, 0.2, 63);
  if (W.foot < 2.5) { P.r(0, P.y0, len, 5.6, '#ecdcb4'); P.r(0, P.y0, len, 1.0, '#f1efe9'); P.r(0, 5.6, len, 5.85, WHT); }
  for (const x of xs) { arch(P, W, x, 1.9, 3.9, 1.3); arch(P, W, x, 7.2, 11.4, 1.5); }
  if (W.peak - W.eaves < 1.5 && top > 12) { P.r(0, top - 1.0, len, top, WHT); for (let x = 0.3; x < len - 0.3; x += 0.7) P.arc(x + 0.25, top - 1.0, 0.22, '#e3ddcd', 0, Math.PI); }      // the little arches under the eaves
}
const jak4 = (P, W) => classic(P, W, { wall: '#e3ebe0', plinth: [0.8, '#aab3ba'], ground: [3.6, '#c9d4d6', false], floors: [[1.4, 1.7], [4.6, 2.2], [8.0, 1.7]], pitch: 2.6, w: 1.0, win: { hood: 0.14 }, seed: 64 });
const shed = (P, W) => classic(P, W, { wall: '#e3ebe0', plinth: [0.5, '#aab3ba'], floors: [[1.2, 1.4]], pitch: 3.5, seed: 65 });
const plain = (wall, floors, seed, pitch = 3.1) => (P, W) => classic(P, W, { wall, plinth: [0.8, '#a9a8a4'], floors, pitch, seed });

// [name, base, at, reach, wall colour, roof colour, default painter, walls]
const HOUSES = [
  ['kohvik', 433, [1270, 2675], 21, 0xe7dfc0, 0x6f7379, kohvik, [{ near: [1282.4, 2689.25], within: 3, only: kohvikFront, ppm: 18 }, { near: [1286.5, 2682.0], within: 2.5, only: kohvik, ppm: 16 }, { near: [1279.4, 2666.95], within: 3, only: kohvik, ppm: 14 }]],
  ['u18a', 483, [1244, 2687], 20, 0xebe3c6, TIN, yard18a, []],
  ['terrace', 609, [1264, 2694], 9, 0xe9e7dc, 0xb9b4a8, terrace, []],
  ['church', 803, [1224, 2754], 22, 0xf3f0e6, 0xb9bec4, church, [{ near: [1226.3, 2765.5], within: 3, only: church, ppm: 14 }]],
  ['jak4', 914, [1193, 2781], 15, 0xe3ebe0, TIN, jak4, [{ near: [1202.85, 2775.0], within: 3, only: jak4, ppm: 16 }, { near: [1196.8, 2786.95], within: 3, only: jak4, ppm: 14 }]],
  ['jak4b', 1089, [1168, 2773], 10, 0xe3ebe0, TIN, shed, []],
  ['m550', 550, [1222, 2673], 15, 0xe9e2cf, TIN, plain('#e9e2cf', [[1.5, 1.8], [4.9, 1.9]], 66), []],
  ['m435', 435, [1252, 2655], 19, 0xefe9d8, TIN, plain('#efe9d8', [[1.5, 1.9], [5.0, 2.0], [8.3, 1.6]], 67), []],
  ['m443', 443, [1254, 2635], 14, 0xece6d6, TIN, plain('#ece6d6', [[1.5, 1.9], [5.0, 2.0]], 68), []],
  ['g405', 405, [1320, 2663], 11, 0xf1eee6, 0x5a5d64, plain('#f1eee6', [[1.5, 1.8], [4.8, 1.9]], 69), []],
];
const CENTRE = [1240, 2715];

export function ulikooli3Walls(walls) {
  setHouseColours(walls, S35[0], S35[1], S35[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}
export function ulikooli3Props() {
  return [[9, 1217.2, 2776.6, 0], [9, 1193.3, 2760.5, 0]];                   // lanterns on Jakobi, clear of the carriageway
}

// the fence between the pink wing and the church: s from the wing's corner towards the church
const G = frame([1225.5, 2777.0], [-12, -7.8]);

export function createUlikooli3(scene, world, { shadows = true } = {}) {
  const group = still(new Group());
  scene.add(group);
  let built = false;

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, base, at, r, , , paint, walls]) => ({ name, sec: S35[0], base, at, r, spec: { wall: [230, 228, 218], floors: [], attic: null, eaves: false }, walls: [...walls, { near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 10, far: 5, faces: (W) => W.len > 6 && W.foot < 3, debug: DEBUG, label: 'ulikooli3 fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    yield;
    // white gate posts with caps; the gate between the second and the third stands open
    const POSTS = [0.4, 4.6, 8.4, 14.0];
    for (const s of POSTS) {
      const [x, z] = G.at(s, 0), y = h(x, z);
      p.box(0.8, 2.3, 0.8, 0xdcdcd8, x, y + 1.15, z, G.YAW); p.box(0.95, 0.14, 0.95, 0xc9c9c4, x, y + 2.37, z, G.YAW); p.box(0.6, 0.3, 0.6, 0xdcdcd8, x, y + 2.59, z, G.YAW);
    }
    yield;
    for (const [a, b] of [[0.8, 4.2], [8.8, 13.6]]) {                       // the iron fence on its low wall
      const [x, z] = G.at((a + b) / 2, 0), y = h(x, z);
      p.box(b - a, 0.45, 0.3, 0xbdbdb8, x, y + 0.225, z, G.YAW);
      for (const yy of [0.6, 1.85]) p.box(b - a, 0.05, 0.05, 0x26262a, x, y + yy, z, G.YAW);
      for (let s = a + 0.14; s < b; s += 0.28) { const [px, pz] = G.at(s, 0); p.box(0.03, 1.5, 0.03, 0x26262a, px, y + 1.2, pz, G.YAW); }
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 330) return;
      if ([[1270, 2675], [1224, 2754], [1193, 2781], [1252, 2655]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'ulikooli3'); }
    },
  };
}
