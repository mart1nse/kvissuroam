// Ülikooli tänav before the university's main building (Martin, 22 Nov: kaardista, batch 2 of the Ülikooli and
// Jakobi area; Street View shots of Aug 2024 from 13, 15, 18 and 19 Ülikooli).
//  - The main building (Ülikooli 18): pale grey-blue over a banded ground floor and a pink plinth, white window
//    surrounds, the yellow ornament panels between the upper floors, the entablature; the porch of six white
//    columns under its pediment with the round window, the doors behind, the pedestal walls with the two names.
//    The pink wings behind it get their own plain fronts.
//  - The forecourt: the old stone wall along the pavement with its granite posts and chains, the lawn behind it,
//    gravel up to the house, the steps, bike hoops, benches, two flower pyramids and two lanterns.
//  - Opposite: Ülikooli 13 (pale pink, the iron balcony), 15 (pink, the red awning), 17 (cream with white strips
//    between dark windows) and 19 at the Gildi corner (yellow under white ornament, arched windows, a balcony).
// Window counts follow the shots where they show; the back walls are guessed. No street name on the road, and
// nothing stands on the carriageway (the cars parked along the kerb in the shots are left out for that reason).
//
// Freeze frames: built in the work queue when the car is within 330 m, the fronts a wall a step (skinHouses), the
// forecourt in six steps. Nothing here has a picture of its own: the fronts share the house-front pages.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { S35, axes, bands, row, classic, fineWalls } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /ulikoolidebug/.test(location.search);
const SERIF = '700 %px Georgia, "Times New Roman", serif';
const TIN = 0x8f98a3;
const GB = '#dfe2e6', GBD = '#b9bec6', PL = '#e2bfae', WHT = '#fbfaf7', ORN = '#e0b060';
const MWIN = { frame: WHT, glass: '#5a6577', fw: 0.07, bars: 1, rails: 2, surround: 0.14, sc: WHT, sill: 0.08 };

// ---------------------------------------------------------------- the main building
function entablature(P, len, y0, y1) {
  P.r(0, y0, len, y1, WHT); P.r(0, y0 + 0.45, len, y0 + 1.25, GB);
  for (let x = 0.5; x < len - 0.6; x += 1.1) P.r(x, y0 + 0.58, x + 0.62, y0 + 1.12, WHT);
  P.r(0, y0, len, y0 + 0.06, 'rgba(60,60,70,0.28)'); P.r(0, y0 + 1.25, len, y0 + 1.31, 'rgba(60,60,70,0.22)');
}
function mainWall(P, W, xs) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, GB); if (W.front && W.nx > 0.5) P.weather(0, P.y0, len, P.y1, 0.18, 41);
  if (W.foot < 2.5) {
    P.r(0, 1.3, len, 4.9, GBD); bands(P, 0, len, 1.3, 4.9, 0.45, 'rgba(60,64,76,0.28)');
    P.r(0, 4.9, len, 5.12, WHT); P.r(0, P.y0, len, 1.3, PL); P.r(0, 1.22, len, 1.3, 'rgba(90,60,50,0.25)');
    row(P, W, xs, 2.1, 2.1, 1.3, MWIN);
    for (const x of xs) if (x > 1 && x < len - 1 && W.botAt(x) < 0.3) P.r(x - 0.6, 0.35, x + 0.6, 0.95, '#d3ad9b');
  }
  row(P, W, xs, 6.0, 2.7, 1.3, MWIN); row(P, W, xs, 10.4, 2.1, 1.3, { ...MWIN, rails: 1 });
  for (const x of xs) if (x > 1 && x < len - 1 && W.topAt(x) > 13 && W.botAt(x) < 6) { P.r(x - 0.7, 9.25, x + 0.7, 9.75, ORN); P.r(x - 0.5, 9.36, x - 0.12, 9.64, GB); P.r(x + 0.12, 9.36, x + 0.5, 9.64, GB); }
  if (W.peak - W.eaves < 1.2 && top > 12.6) entablature(P, len, top - 2.0, top);
}
function mainSide(P, W) {
  if (W.foot > 12) { P.r(0, P.y0, W.len, P.y1, '#c5cad2'); return; }           // the boxes on the roof
  // the two ends are as the front; the yard side and the wings are pink between white bands (Jakobi, the air photos)
  const end = Math.abs(W.nz) > 0.9 && W.len > 20 && W.peak > 14 && (W.mid[1] > 2779 || W.mid[1] < 2712), tall = W.peak > 11.6;
  if (W.nx > 0.5 || end) return mainWall(P, W, axes(0, W.len, Math.max(1, Math.round((W.len - 0.8) / 3.5))));
  classic(P, W, { wall: '#ebbbae', plinth: [1.0, '#cbb5ab'], ground: tall ? [4.9, '#d9c9c2', true] : [4.3, '#c9c6c4', true], floors: tall ? [[2.1, 2.0], [6.0, 2.6], [10.4, 2.0]] : [[1.9, 1.8], [5.5, 2.2]], belts: tall ? [9.3] : [], pitch: 3.4, w: 1.25, seed: 43, cornice: tall ? 1.2 : 0.5 });
}
function porch(P, W) {
  const len = W.len, pk = W.peak, e = Math.min(W.eaves, pk - 2.5), arch = e - 2.1, ped = 2.3;
  const cols = Array.from({ length: 6 }, (_, k) => 1.5 + (len - 3) * k / 5), gap = cols.slice(1).map((x, k) => (x + cols[k]) / 2);
  const SW = { ...MWIN, glass: '#4b5565', sc: '#e9eaeb', frame: '#eeeeec' };
  P.r(0, P.y0, len, P.y1, GB);
  P.grad(0, 1.3, len, arch, '#8f96a2', '#a9afb9');                         // the wall behind, in the porch's shade
  P.r(0, 1.3, len, 4.9, '#a3a8b2'); bands(P, 0, len, 1.3, 4.9, 0.45, 'rgba(50,54,66,0.3)'); P.r(0, 4.9, len, 5.1, '#e6e7e8');
  for (const x of gap) { P.win(x - 0.65, 6.0, x + 0.65, 8.7, SW); P.win(x - 0.65, 10.4, x + 0.65, 12.4, { ...SW, rails: 1 }); P.r(x - 0.7, 9.25, x + 0.7, 9.72, '#c9a35a'); }
  P.win(gap[0] - 0.65, 2.3, gap[0] + 0.65, 4.4, SW); P.win(gap[4] - 0.65, 2.3, gap[4] + 0.65, 4.4, SW);
  for (const k of [1, 2, 3]) {                                              // three doors, the middle one pale blue
    const x = gap[k];
    P.r(x - 0.85, 1.3, x + 0.85, 4.5, '#eeeeec'); P.r(x - 0.7, 1.3, x + 0.7, 3.6, k === 2 ? '#b9cfd6' : '#e9e6df');
    P.r(x - 0.012, 1.3, x + 0.012, 3.6, '#8d979c'); P.r(x - 0.7, 3.7, x + 0.7, 4.35, '#4b5565');
  }
  const s0 = cols[1] + 0.9, s1 = cols[4] - 0.9;                             // the steps between the pedestal walls
  P.r(s0, P.y0, s1, 1.3, '#b9b4ae'); for (let y = 0.16; y < 1.3; y += 0.16) P.r(s0, y - 0.03, s1, y, 'rgba(50,45,40,0.35)');
  for (const [a, b, t] of [[cols[0] - 0.95, cols[1] + 0.9, 'TARTU ÜLIKOOL'], [cols[4] - 0.9, cols[5] + 0.95, 'UNIVERSITAS TARTUENSIS']]) {
    P.r(a, P.y0, b, ped, '#c9a79b'); P.r(a, ped - 0.14, b, ped, '#dcc3b9'); P.r(a, P.y0, b, 0.35, '#b08f84');
    P.text(t, (a + b) / 2, 1.25, t.length > 14 ? 0.34 : 0.46, '#5a4038', SERIF);
  }
  for (const k of [2, 3]) { P.r(cols[k] - 0.9, 1.3, cols[k] + 0.9, ped, '#c9a79b'); P.r(cols[k] - 0.9, ped - 0.14, cols[k] + 0.9, ped, '#dcc3b9'); }
  for (const x of cols) {                                                   // six columns, lit from the left
    P.r(x - 0.62, ped, x + 0.62, arch - 0.3, WHT); P.r(x + 0.3, ped, x + 0.62, arch - 0.3, '#dfe0e1'); P.r(x - 0.62, ped, x - 0.48, arch - 0.3, '#eeeeed');
    P.r(x - 0.78, ped, x + 0.78, ped + 0.3, '#f3f2ee'); P.r(x - 0.8, arch - 0.3, x + 0.8, arch, '#f6f5f1');
  }
  entablature(P, len, arch, e + 0.05);
  P.poly([[0, e], [len / 2, pk], [len, e]], WHT); P.poly([[1.8, e + 0.35], [len / 2, pk - 0.75], [len - 1.8, e + 0.35]], GB);
  P.arc(len / 2, e + (pk - e) * 0.42, 0.42, WHT); P.arc(len / 2, e + (pk - e) * 0.42, 0.3, '#4b5565');
}
function mainAny(P, W) {
  if (W.len > 60 && W.nx > 0.5) return mainWall(P, W, [...axes(0.6, 25.0, 7), ...axes(48.6, W.len - 0.6, 7)]);    // the street front: seven windows either side of the porch
  if (W.len > 20 && W.len < 26 && W.peak > 17 && W.nx > 0.5 && W.foot < 2.5) return porch(P, W);
  mainSide(P, W);
}

// ---------------------------------------------------------------- the houses opposite
const CREAM = '#e7dcc3', STRIP = '#f4f0e6';
const BWIN = { frame: '#4a3328', glass: '#3d4450', fw: 0.07, bars: 1, rails: 2, surround: 0, sill: 0.07, sc: WHT };
const paabelSide = (P, W) => classic(P, W, { wall: CREAM, plinth: [1.1, '#a9b0bb'], floors: [[1.9, 2.3], [6.4, 2.4]], belts: [5.0], pitch: 3.3, w: 1.2, win: BWIN, seed: 52 });
function paabelFront(P, W) {                                                // Ülikooli 17 and 19
  if (W.len < 14 || W.foot > 2.5 || W.eaves < 9.5) return paabelSide(P, W);
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05), n = Math.max(2, Math.round(len / 3.3)), xs = axes(0, len, n), d = xs[Math.floor(n / 2)];
  P.r(0, P.y0, len, P.y1, CREAM); if (W.front) P.weather(0, P.y0, len, P.y1, 0.25, 51);
  P.r(0, P.y0, len, 1.1, '#a9b0bb');
  for (let k = 0; k <= n; k++) { const x = len * k / n; P.r(x - 0.28, 1.1, x + 0.28, top - 0.5, STRIP); }
  P.r(0, 5.0, len, 5.16, STRIP); P.r(0, top - 0.6, len, top, STRIP); P.r(0, top - 0.6, len, top - 0.54, 'rgba(60,60,70,0.25)');
  for (const x of xs) { P.r(x - 0.8, 5.5, x + 0.8, 6.1, '#efe7d3'); P.r(x - 0.8, 5.5, x + 0.8, 5.54, 'rgba(90,80,60,0.25)'); if (top > 10.9) P.r(x - 0.8, 9.7, x + 0.8, 10.3, '#efe7d3'); }
  row(P, W, xs.filter((x) => x !== d), 1.9, 2.5, 1.3, BWIN); row(P, W, xs, 6.5, 2.6, 1.3, BWIN);
  P.r(d - 0.9, P.y0, d + 0.9, 3.4, STRIP); P.arc(d, 3.4, 0.9, STRIP, Math.PI, Math.PI * 2);        // the arched doorway
  P.r(d - 0.7, P.y0, d + 0.7, 3.4, '#4a3328'); P.arc(d, 3.4, 0.7, '#3d4450', Math.PI, Math.PI * 2); P.r(d - 0.012, P.y0, d + 0.012, 3.4, '#2f211b');
}
function gildi1Front(P, W) {                                                // Ülikooli 19, the corner of Gildi: yellow under white ornament
  if (W.len < 14 || W.foot > 2.5 || W.eaves < 9.5) return classic(P, W, { wall: '#e6d8a6', plinth: [1.0, '#a9aeb6'], floors: [[1.8, 2.3], [6.3, 2.5]], belts: [5.0], pitch: 3.2, w: 1.2, seed: 55 });
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05), n = Math.max(3, Math.round(len / 3.2)), xs = axes(0, len, n), b = xs[Math.floor(n / 2)];
  P.r(0, P.y0, len, P.y1, '#e6d8a6'); if (W.front) P.weather(0, P.y0, len, P.y1, 0.2, 55);
  P.r(0, 1.0, len, 5.0, '#f1ede2'); bands(P, 0, len, 1.0, 5.0, 0.5, 'rgba(120,110,90,0.25)'); P.r(0, 5.0, len, 5.3, WHT); P.r(0, P.y0, len, 1.0, '#a9aeb6');
  for (const x of xs) {                                                     // arched windows below, tall ones between white columns above
    P.r(x - 0.6, 1.7, x + 0.6, 3.6, '#3d4450'); P.arc(x, 3.6, 0.6, '#3d4450', Math.PI, Math.PI * 2); P.r(x - 0.03, 1.7, x + 0.03, 4.2, WHT);
    P.win(x - 0.6, 6.4, x + 0.6, 9.0, { frame: WHT, glass: '#3d4450', bars: 1, rails: 1, surround: 0.16, sc: WHT, hood: 0.2 });
    P.r(x - 1.25, 5.3, x - 1.0, top - 1.0, WHT); P.r(x + 1.0, 5.3, x + 1.25, top - 1.0, WHT);
  }
  P.r(0, top - 1.0, len, top, WHT); for (let x = 0.3; x < len - 0.3; x += 0.6) P.r(x, top - 1.0, x + 0.22, top - 0.6, '#d9d2bd');     // the bracket cornice
  P.r(0, top - 0.12, len, top, '#6b4a3c');
  P.r(b - 1.7, 5.3, b + 1.7, 5.55, '#f4f1e8'); for (let x = b - 1.65; x < b + 1.7; x += 0.2) P.r(x, 5.55, x + 0.04, 6.4, '#2e2c2f'); P.r(b - 1.7, 6.4, b + 1.7, 6.47, '#2e2c2f');     // the balcony
}
const u15Side = (P, W) => classic(P, W, { wall: '#e9bfb4', plinth: [0.9, '#a9a6aa'], floors: [[1.6, 2.0], [5.4, 2.2], [9.2, 1.8]], pitch: 3.3, w: 1.15, seed: 53 });
function u15Front(P, W) {                                                   // Ülikooli 15
  if (W.len < 14 || W.foot > 2.5) return u15Side(P, W);
  classic(P, W, { wall: '#e9bfb4', plinth: [0.9, '#a9a6aa'], ground: [4.3, '#e2b3a6', true], floors: [[1.6, 2.2], [5.4, 2.3], [9.2, 1.9]], pitch: 3.3, w: 1.2, belts: [8.5], seed: 53, win: { hood: 0.12 } });
  const d = W.len / 2;
  P.r(d - 1.0, P.y0, d + 1.0, 4.1, '#e2b3a6'); P.door(d - 0.75, d + 0.75, 2.9, '#6b3f33', { frame: WHT, light: 0.5 });
  P.poly([[d - 1.5, 3.95], [d + 1.5, 3.95], [d + 1.75, 3.2], [d - 1.75, 3.2]], '#b32f36'); P.r(d - 1.75, 3.08, d + 1.75, 3.2, '#8f2228');     // the red awning
}
const K4 = { wall: '#eddcd2', plinth: [1.3, '#a4a8b3'], floors: [[2.2, 2.4], [6.3, 2.6]], pitch: 3.2, w: 1.15, belts: [5.2], seed: 54, win: { frame: '#6b4636', glass: '#444b58', hood: 0.14, T: true }, cornice: 0.7 };
const k4Side = (P, W) => classic(P, W, K4);
function k4Front(P, W) {                                                    // Ülikooli 13, the corner of Küütri
  if (W.len < 15 || W.foot > 2.5) return k4Side(P, W);
  classic(P, W, K4);
  const n = Math.max(1, Math.round((W.len - 0.8) / 3.2)), xs = axes(0, W.len, n), m = xs[Math.floor(n / 2)], IRON = '#2e2c2f';
  for (const x of xs) { P.r(x - 0.5, 0.3, x + 0.5, 0.95, '#5b4a44'); if (W.topAt(x) > 10.4) P.r(x - 0.5, 9.4, x + 0.5, 9.8, '#f6f1ea'); }
  P.r(m - 1.6, 5.75, m + 1.6, 5.95, IRON); for (let x = m - 1.55; x < m + 1.6; x += 0.2) P.r(x, 5.95, x + 0.04, 6.95, IRON); P.r(m - 1.6, 6.95, m + 1.6, 7.02, IRON);
  P.poly([[m - 1.4, 5.75], [m - 1.1, 5.75], [m - 1.4, 5.1]], IRON); P.poly([[m + 1.4, 5.75], [m + 1.1, 5.75], [m + 1.4, 5.1]], IRON);
}

// [name, base, at, reach, wall colour, roof colour, default painter, walls]
const HOUSES = [
  // (the main building has 42 walls, most on its yards: only the ones Ülikooli sees are painted finely)
  ['main', 519, [1255, 2750], 55, 0xdfe2e6, TIN, mainAny, [{ near: [1284.1, 2743.1], within: 1.3, only: mainAny, ppm: 14 }, { near: [1281.15, 2743.55], within: 1.3, only: mainAny, ppm: 11 },
    { near: [1277.35, 2781.2], within: 2, only: mainAny, ppm: 9 }, { near: [1263.65, 2709.8], within: 2, only: mainAny, ppm: 9 }], 6],
  ['kuutri4', 458, [1330, 2754], 25, 0xeddcd2, TIN, k4Side, [{ near: [1310.05, 2760.5], within: 3, only: k4Front, ppm: 14 }]],
  ['ulik15', 558, [1322, 2739], 16, 0xe9bfb4, TIN, u15Side, [{ near: [1307.0, 2742.8], within: 3, only: u15Front, ppm: 14 }]],
  ['paabel', 536, [1325, 2722], 26, 0xe7dcc3, TIN, paabelFront, [{ near: [1303.7, 2720.95], within: 3, only: paabelFront, ppm: 14 }]],
  ['gildi1', 416, [1318, 2698], 22, 0xe6d8a6, TIN, gildi1Front, [{ near: [1300.4, 2699.5], within: 3, only: gildi1Front, ppm: 14 }]],
];
const CENTRE = [1292, 2742];

export function ulikooli2Walls(walls) {
  setHouseColours(walls, S35[0], S35[1], S35[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// the forecourt: s north along Ülikooli from the Jakobi corner, v to the east (the forecourt is at negative v)
const FC = frame([1306.95, 2774], [-0.165, -0.986]);
const WALL_V = -6.95, S0 = 3, S1 = 67;       // (the wall starts clear of Jakobi tänav, which the map draws wider than it is)
export function ulikooli2Props() {
  return [[9, ...FC.at(22, -8.9), 0], [9, ...FC.at(48, -8.9), 0]];        // the two lanterns behind the wall
}

export function createUlikooli2(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, base, at, r, , , paint, walls, ppm]) => ({ name, sec: S35[0], base, at, r, spec: { wall: [225, 226, 230], floors: [], attic: null, eaves: false, ppm }, walls: [...walls, { near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 11, far: 6, faces: fineWalls(houses), debug: DEBUG, label: 'ulikooli2 fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    yield;
    // ---- the old wall along the pavement: stone to the height of the forecourt, a mossy cap, granite posts, chains
    const topAt = (s) => h(...FC.at(s, -9.8)) + 0.1;
    for (let s = S0 + 2; s < S1; s += 4) {
      const [x, z] = FC.at(s, WALL_V), y0 = h(...FC.at(s, -5.4)) - 0.4, y1 = topAt(s);
      p.box(4.03, y1 - y0, 0.9, 0xb7b3aa, x, (y0 + y1) / 2, z, FC.YAW); p.box(4.03, 0.14, 1.12, 0x7e7d74, x, y1 + 0.07, z, FC.YAW);
    }
    for (const s of [S0 + 0.2, S1 - 0.2]) {                                      // its two ends turn in towards the house
      const [x, z] = FC.at(s, WALL_V - 2.6), y0 = h(...FC.at(s, -5.4)) - 0.4, y1 = topAt(s);
      p.box(0.9, y1 - y0, 4.6, 0xb7b3aa, x, (y0 + y1) / 2, z, FC.YAW); p.box(1.12, 0.14, 4.6, 0x7e7d74, x, y1 + 0.07, z, FC.YAW);
    }
    yield;
    const posts = []; for (let s = S0 + 1.0; s < S1; s += 5.67) posts.push(s);
    posts.forEach((s, k) => {
      const [x, z] = FC.at(s, WALL_V), y = topAt(s) + 0.14;
      p.box(0.5, 0.72, 0.5, 0x8f8c88, x, y + 0.36, z, FC.YAW); p.box(0.42, 0.1, 0.42, 0x7c7975, x, y + 0.77, z, FC.YAW);
      if (k === posts.length - 1) return;
      const s2 = posts[k + 1], yb = topAt(s2) + 0.14;                        // the chain to the next post, hanging
      for (let j = 0; j < 5; j++) {
        const t = (j + 0.5) / 5, sm = s + 0.3 + (s2 - s - 0.6) * t, [cx, cz] = FC.at(sm, WALL_V);
        p.box((s2 - s - 0.6) / 5 + 0.02, 0.05, 0.05, 0x2b2b2e, cx, y + (yb - y) * t + 0.58 - 0.3 * (1 - (2 * t - 1) ** 2), cz, FC.YAW);
      }
    });
    { const [x, z] = FC.at(S0 + 0.4, WALL_V + 0.1); p.box(0.6, 0.05, 0.9, 0xd9d9d6, x, topAt(S0 + 1) + 0.3, z, FC.YAW); }    // the plaque at the corner
    yield;
    // ---- the ground: lawn behind the wall, gravel up to the house
    A.pave(FC, S0 + 0.8, S1 - 0.8, -10.3, -7.45, 'lawn');
    A.pave(FC, S0 + 0.8, S1 - 0.8, -16.4, -10.3, 'gravel');
    yield;
    A.pave(FC, S0 + 0.8, 22.4, -19.5, -16.4, 'gravel'); A.pave(FC, 47.2, S1 - 0.8, -19.5, -16.4, 'gravel');
    for (let k = 0; k < 4; k++) A.box(FC, 34.8, -15.3 - k * 0.5, 10.6, 0.52, 0, 0.3 * (k + 1), 0xb9b4ae);       // the steps to the porch
    yield;
    // ---- bike hoops along the path, benches by the steps, the flower pyramids
    for (const [a, b] of [[6, 20.5], [49.5, 64]]) for (let s = a; s < b; s += 0.95) {
      const y = h(...FC.at(s, -11.3));
      for (const v of [-11.0, -11.6]) { const [x, z] = FC.at(s, v); p.box(0.05, 0.75, 0.05, 0xa4a9af, x, y + 0.375, z, FC.YAW); }
      const [x, z] = FC.at(s, -11.3); p.box(0.05, 0.05, 0.65, 0xa4a9af, x, y + 0.75, z, FC.YAW);
    }
    const bench = (s, v) => {
      const [x, z] = FC.at(s, v), y = h(x, z), yaw = FC.YAW;
      p.box(1.9, 0.07, 0.5, 0x3d3a38, x, y + 0.46, z, yaw); p.box(1.9, 0.5, 0.06, 0x3d3a38, x - Math.sin(yaw) * 0.26, y + 0.78, z - Math.cos(yaw) * 0.26, yaw);
      for (const e of [-0.85, 0.85]) p.box(0.07, 0.46, 0.46, 0x2c2c31, x + Math.cos(yaw) * e, y + 0.23, z - Math.sin(yaw) * e, yaw);
    };
    for (const s of [24.2, 26.6, 43.0, 45.4]) bench(s, -15.6);
    for (const s of [28.6, 41.0]) {
      const [x, z] = FC.at(s, -14.9), y = h(x, z);
      p.add(new THREE.ConeGeometry(0.75, 1.9, 8), 0x4f8a4a, x, y + 0.95, z); p.add(new THREE.ConeGeometry(0.6, 0.9, 8), 0xc93a52, x, y + 0.62, z); p.add(new THREE.CylinderGeometry(0.8, 0.7, 0.3, 8), 0x6b6d72, x, y + 0.15, z);
    }
    for (const s of [22, 48]) { const [x, z] = FC.at(s, -8.9), y = h(x, z); p.add(new THREE.IcosahedronGeometry(0.45, 1), 0xe6c84a, x, y + 1.7, z); }     // the yellow flowers on the lanterns
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 330) return;
      if ([[1255, 2750], [1330, 2754], [1318, 2698], [1300, 2740]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'ulikooli2'); }
    },
  };
}
