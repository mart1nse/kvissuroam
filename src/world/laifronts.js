// Racetrack fronts, part 1: Jakobi from Orident to the Lai corner and the whole of Lai tänav up to the botanical
// garden (Martin, 21 Nov: kaardista, "mainly focus on the facades on the racetrack", 16 Street View shots of Aug 2024
// from 38 Jakobi to 41 Tartu-Tiksoja). The map's own blocks keep their shapes; every wall that faces the lap gets a
// painted front, and the garden fences and walls along the pavement are added. The road itself is not touched.
//  - Jakobi: the yellow-green timber house opposite Orident, the tall olive timber house with the white shop floor,
//    the grey timber house under ivy and the small grey timber houses at the Lai corner.
//  - Lai, right-hand side going up: the orange corner house (black railing), the dark timber house with the glass
//    stair, the glass office, the cream house with the dormers and the white houses behind brown board fences with
//    white posts, the white house with the brown gate, the white block with the balconies, the grey office block
//    over the dark shop floor (cafés), the pink house with the pilasters, Tartu Uus Teater (red brick, arched
//    windows, iron fence on stone posts) and the new brick flats at the end.
//  - Lai, left-hand side: the white three-storey house behind the grey picket fence, the old red brick garden
//    wall, the white wall with the tiled cap, the low pink house with the red roof, the ochre house (Lai 26), the
//    grey ornate houses and the botanical garden's long pink house with its poster, behind the pink garden wall.
// Window counts, door places and the colours of walls no shot shows are guessed. No street name on the road.
//
// Freeze frames (Martin's first rule): the fronts are painted a wall at a time in the work queue (skinHouses), the
// fences are laid a few metres a step, and everything goes into the scene inside the work queue (held unseen by the
// warmer until its shaders and pictures are ready). Three small fence pictures (256 px) are shared by all fences.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { Parts } from '../race/landmarks.js';
import { createTrack } from '../race/race.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

const S25 = ['2_5', 480, 2400], S35 = ['3_5', 1120, 2400], S34 = ['3_4', 1120, 1760];
const CENTRE = [1190, 2520];
const I0 = 630, I1 = 912;                         // the lap indexes of this stretch

// ---------------------------------------------------------------- roof colours of the map's blocks
// [base, x, z, wall, roof, reach] (wall colours matter only for the far shapes: the walls are painted over)
const ROOFS = [
  [S25, 1029, 983.6, 2634.8, 0x7e785c, 0x8f929c, 14],
  [S25, 990, 1040.8, 2622, 0xbab3ab, 0x8f919d, 5],
  [S25, 995, 1041.9, 2615.6, 0xbab3ab, 0x8f919d, 5],
  [S25, 734, 1074.1, 2601.3, 0xeceae4, 0x8d9099, 16],
  [S25, 676, 1114.4, 2598.4, 0x4a403a, 0x5a5c63, 22],
  [S35, 643, 1133.8, 2573, 0xb9bcc0, 0x6d7079, 14],
  [S35, 582, 1151.1, 2551.2, 0xe2d6b2, 0x9a9ca6, 10],
  [S35, 543, 1163.6, 2531.4, 0xece9e2, 0xa8665a, 9],
  [S35, 485, 1181.2, 2528.9, 0xece8de, 0x9fa2aa, 14],
  [S35, 495, 1172.1, 2492.4, 0xdeaaa0, 0xb45f4c, 12],
  [S35, 515, 1207, 2523.1, 0xe8e4dc, 0x9a9ca6, 9],
  [S35, 324, 1225.8, 2508.2, 0xeeeae2, 0xa45c4a, 14],
  [S35, 351, 1260.5, 2490.5, 0xf0f0ee, 0x6c6f77, 34],
  [S35, 384, 1218.4, 2465.8, 0xbebab0, 0x8e929b, 18],
  [S35, 335, 1268.6, 2449.2, 0xc8c8c4, 0x8e929b, 28],
  [S35, 311, 1313, 2472.5, 0xd6d7d9, 0x55585f, 22],
  [S35, 300, 1333.6, 2462.2, 0xecccc6, 0x9a9eab, 14],
  [S35, 239, 1368.9, 2440.3, 0x96483a, 0x7d8088, 22],
  [S35, 171, 1404.2, 2411.7, 0x7a3e34, 0x55585f, 12],
];
export function laiFrontsWalls(walls) {
  for (const S of [S25, S35, S34]) {
    const list = ROOFS.filter((r) => r[0] === S).map(([, base, x, z, wall, roof, reach]) => ({ base, x, z, wall, roof, reach }));
    if (list.length) setHouseColours(walls, S[0], S[1], S[2], list);
  }
}

// ---------------------------------------------------------------- the painted fronts
const TRIM = '#f4f1ea';
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: TRIM, weather: 0.45, ...o });
const wood = (wall, o = {}) => ({ kind: 'wood', wall, trim: '#efebe0', weather: 0.5, pitch: 0.16, ...o });
const tw = (o = {}) => ({ w: 1.0, pitch: 2.3, T: true, surround: 0.1, sc: TRIM, ...o });
const sq = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.05, frame: '#f2f0ea', glass: '#4f5c6d', ...o });
// extras only on the wall that faces the lap
const front = (fn) => [{ near: [0, 0], within: 1e9, draw: (P, W) => { if (W.front && W.len > 5) fn(P, W); } }];
const only = (fn) => [{ near: [0, 0], within: 1e9, only: (P, W) => fn(P, W) }];

function ivy(P, W) {                              // the grey timber house under ivy (17 Jakobi)
  const r = rnd(977);
  for (let k = 0; k < 140; k++) {
    const x = r() * W.len * 0.55, y = r() * Math.min(W.eaves + 1.5, P.y1) * (1 - x / W.len);
    P.arc(x, y, 0.25 + r() * 0.45, ['#4f6b3a', '#5e7b45', '#3f5a30', '#6c8a4c'][k % 4]);
  }
}
function shopFloor(P, W) {                         // the white shop floor under the olive timber (17 Jakobi)
  P.r(0, P.y0, W.len, 3.2, '#efede6');
  P.r(0, 3.2, W.len, 3.36, '#dcd8cc');
  const n = Math.max(2, Math.round(W.len / 2.6));
  for (let k = 0; k < n; k++) { const x = (k + 0.5) * W.len / n; P.win(x - 0.55, 0.8, x + 0.55, 2.5, { frame: '#f4f2ec', glass: '#56647c', T: false, bars: 1, rails: 1, sill: 0.06 }); }
  const dx = W.len * 0.62;
  P.door(dx - 0.6, dx + 0.6, 2.3, '#e9e5da', { frame: '#f4f2ec', panels: 3, light: 0.4 });
  P.poly([[dx - 1.0, 2.55], [dx + 1.0, 2.55], [dx + 0.8, 2.95], [dx - 0.8, 2.95]], '#c4423b');
  P.r(dx - 2.6, 2.6, dx - 1.3, 3.0, '#f7f6f1'); P.text('TOYS', dx - 1.95, 2.8, 0.3, '#3b4a6b');
}
function darkTimber(P, W) {                        // 6 Lai: dark boards, a white rendered part, the glass stair, parking under
  const len = W.len, top = P.y1;
  P.boards(0, P.y0, len, top, [74, 64, 58], 0.12, true);
  P.weather(0, P.y0, len, top, 0.3, 676);
  if (!W.front || len < 8) return;
  P.r(len * 0.66, P.y0, len, top, '#ecebe7');
  P.grad(len * 0.56, 0.4, len * 0.64, top - 0.3, '#8fa5b6', '#4d6073');
  for (let y = 0.4; y < top - 0.3; y += 1.5) P.r(len * 0.56, y, len * 0.64, y + 0.06, '#e6e6e2');
  P.r(len * 0.56, 0.4, len * 0.565, top - 0.3, '#e6e6e2'); P.r(len * 0.635, 0.4, len * 0.64, top - 0.3, '#e6e6e2');
  P.r(0, P.y0, len * 0.56, 2.4, '#2f2c2b');                                      // the parking under the house
  for (let x = 0.2; x < len * 0.56; x += 5.2) P.r(x, P.y0, x + 0.35, 2.4, '#b7b3ab');
  P.r(len * 0.4, 2.8, len * 0.48, 4.6, '#9a4c34');                              // the rust-red panel by the door
  for (let y = 5.5; y < top - 2; y += 3.1) for (const f of [0.12, 0.3]) P.win(len * f, y, len * f + 1.1, y + 1.6, sq({ frame: '#2b2a2a' }));
}
function glassOffice(P, W) {                       // 8 Lai: two floors of glass between grey bands
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#bfc1c3');
  P.r(0, P.y0, len, 0.5, '#8d8f91');
  for (const [a, b] of [[0.5, 3.4], [3.9, top - 0.9]]) {
    if (b - a < 1) continue;
    P.grad(0.2, a, len - 0.2, b, '#7d93a6', '#3f5162');
    for (let x = 0.2; x <= len - 0.1; x += 1.6) P.r(x - 0.04, a, x + 0.04, b, '#d9dadc');
    P.r(0.2, b - 0.06, len - 0.2, b, '#d9dadc');
  }
  if (W.front) for (let x = 1.6; x < len - 1; x += 4.8) P.r(x, 4.5, x + 1.7, 5.3, '#f2f0e6');      // lamps over the desks
}
function pilasters(P, W) {                          // 33 Tartu-Tiksoja: pink with white pilasters and a pediment
  const len = W.len;
  for (let x = 0.25; x < len; x += Math.max(3.4, len / Math.max(1, Math.round(len / 4.2)))) P.r(x - 0.25, 0.7, x + 0.25, W.eaves, '#f5f2ec');
  P.r(0, W.eaves - 0.5, len, W.eaves, '#f5f2ec');
}
function gate(P, W) {                               // 23 Tartu-Tiksoja: the big brown gate into the yard
  const x = W.len * 0.72;
  P.r(x - 1.55, 0, x + 1.55, 3.15, '#f4f1ea');
  P.r(x - 1.4, 0, x + 1.4, 3.0, '#6e4a33');
  P.arc(x, 3.0, 1.4, '#6e4a33', Math.PI, Math.PI * 2);
  for (let k = -1.2; k <= 1.2; k += 0.2) P.r(x + k - 0.015, 0, x + k + 0.015, 3.0, '#5a3b28');
  P.r(x - 0.02, 0, x + 0.02, 3.6, '#4a3020');
}
function balconies(P, W) {                          // 28 Lai: white block with black railings at the tall windows
  const len = W.len, n = Math.max(1, Math.round((len - 0.6) / 2.6));
  for (let y = 3.3; y + 2.2 < W.eaves; y += 3.0) for (let k = 0; k < n; k += 2) {
    const x = (k + 0.5) * len / n;
    P.r(x - 0.95, y, x + 0.95, y + 0.06, '#26272b'); P.r(x - 0.95, y + 1.0, x + 0.95, y + 1.06, '#26272b');
    for (let b = -0.9; b <= 0.92; b += 0.15) P.r(x + b, y, x + b + 0.025, y + 1.0, '#26272b');
  }
}
function office(P, W) {                             // 29 to 34 Lai: grey bands of windows over a dark shop floor
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#d8d9db');
  P.weather(0, P.y0, len, top, 0.2, 311);
  P.r(0, P.y0, len, 4.0, '#3d3e45');
  if (len < 4) return;
  for (let x = 1.0; x < len - 2.4; x += 5.2) { P.grad(x, 0.5, x + 3.4, 3.4, '#5a4c3a', '#2a2a2e'); P.r(x, 0.5, x + 3.4, 0.58, '#77787c'); }
  if (W.front && len > 20) {
    P.r(len * 0.3, 3.2, len * 0.3 + 2.4, 3.9, '#222326'); P.text('DUO', len * 0.3 + 1.2, 3.55, 0.45, '#e9dfc8');
  }
  for (let y = 4.6; y + 1.8 < top - 0.4; y += 3.1) {
    P.r(0, y - 0.3, len, y + 2.0, '#d8d9db');
    for (let x = 0.4; x < len - 0.8; x += 2.2) { P.r(x, y, x + 1.6, y + 1.75, '#3e4855'); P.r(x + 1.6, y, x + 2.2, y + 1.75, '#55585f'); }
  }
}
function uusTeater(P, W) {                          // 37 Lai, Tartu Uus Teater: red brick, round-headed windows, posters
  const len = W.len, top = P.y1;
  P.brick(0, P.y0, len, top, [146, 66, 52], 239);
  P.r(0, P.y0, len, 0.8, '#7d776f');
  P.r(0, top - 0.5, len, top, '#7f3a2e');
  if (len < 4) return;
  const n = Math.max(1, Math.round(len / 3.6));
  for (let k = 0; k < n; k++) {
    const x = (k + 0.5) * len / n, y0 = 1.4, y1 = Math.min(4.6, W.eaves - 1.2);
    if (y1 - y0 < 1) continue;
    P.r(x - 0.8, y0, x + 0.8, y1, '#e9e6df'); P.arc(x, y1, 0.8, '#e9e6df', Math.PI, Math.PI * 2);
    P.r(x - 0.68, y0 + 0.08, x + 0.68, y1, '#46505e'); P.arc(x, y1, 0.68, '#46505e', Math.PI, Math.PI * 2);
    P.r(x - 0.03, y0, x + 0.03, y1 + 0.68, '#e9e6df');
    if (W.front && k % 3 === 1) { P.r(x - 0.6, y0 + 0.3, x + 0.6, y1 - 0.2, '#d9d2b8'); P.r(x - 0.5, y0 + 0.5, x + 0.5, y1 - 0.9, '#3d6b7c'); }   // the posters
  }
  if (W.front && len > 10) {                       // the arched red door under a brick pediment
    const x = len * 0.15;
    P.poly([[x - 1.5, 3.4], [x + 1.5, 3.4], [x, 4.4]], '#8b3c2e');
    P.r(x - 1.2, 0, x + 1.2, 3.4, '#8b3c2e');
    P.r(x - 0.75, 0, x + 0.75, 2.6, '#7a2228'); P.arc(x, 2.6, 0.75, '#7a2228', Math.PI, Math.PI * 2);
  }
}
function flats(P, W) {                              // 39/41 Tartu-Tiksoja: new brick flats, tall windows with black railings
  const len = W.len, top = P.y1;
  P.brick(0, P.y0, len, top, [118, 62, 54], 171);
  P.r(0, P.y0, len, 0.5, '#5a5552');
  if (len < 4) return;
  const glassTop = W.eaves > 11;
  for (let y = 0.9; y + 2.3 < (glassTop ? W.eaves - 2.8 : W.eaves - 0.4); y += 3.0) {
    for (let x = 1.4; x < len - 1.2; x += 3.2) {
      P.win(x - 0.6, y, x + 0.6, y + 2.3, { frame: '#3a3533', glass: '#4f5b69', T: false, bars: 0, rails: 0, sill: 0 });
      if (y > 2) { P.r(x - 0.65, y, x + 0.65, y + 0.05, '#1f1f22'); P.r(x - 0.65, y + 1.0, x + 0.65, y + 1.05, '#1f1f22'); for (let b = -0.6; b <= 0.62; b += 0.12) P.r(x + b, y, x + b + 0.02, y + 1.0, '#1f1f22'); }
    }
  }
  if (glassTop) { P.r(0, W.eaves - 2.8, len, top, '#3a3d44'); for (let x = 0.3; x < len; x += 1.4) P.r(x, W.eaves - 2.5, x + 1.2, top - 0.3, '#64798c'); }
}
function botanical(P, W) {                          // the botanical garden's poster on the long pink house's end
  const x = W.len / 2, y = Math.min(5.2, W.eaves - 2.2);
  if (W.len < 7 || y < 2.5) return;
  P.r(x - 2.4, y - 1.4, x + 2.4, y + 1.6, '#f6f6f2');
  P.grad(x - 2.25, y - 1.25, x + 2.25, y + 1.45, '#6c9a52', '#2f5c35');
  P.poly([[x - 2.25, y - 1.25], [x + 2.25, y - 1.25], [x + 2.25, y - 0.2], [x - 0.2, y - 0.9]], '#1f5aa6');
  P.r(x - 2.0, y - 0.15, x - 0.1, y + 0.45, '#f7f6f2');
  P.text('BOTAANIKAAED', x - 1.05, y + 0.15, 0.22, '#21422b');
}

const TOWARD_START = (W) => W.back;
function houses() {
  return [
    // ---- Jakobi
    { name: 'j820', sec: '2_5', base: 820, at: [994.2, 2605.9], r: 22, spec: wood([204, 196, 142], { storey: 3.0, maxFloors: 2, plinth: { h: 0.7, col: '#8f8a80' }, win: tw() }) },
    { name: 'j1029', sec: '2_5', base: 1029, at: [983.6, 2634.8], r: 14,
      spec: wood([126, 118, 88], { storey: 3.1, maxFloors: 3, plinth: { h: 0.4, col: '#a19d95' }, win: tw({ w: 1.1, pitch: 2.2, T: false, bars: 1, rails: 2, surround: 0.08 }) }), walls: front(shopFloor) },
    { name: 'j977', sec: '2_5', base: 977, at: [1024.5, 2615.2], r: 12, spec: wood([156, 148, 134], { storey: 2.8, maxFloors: 2, plinth: { h: 0.6, type: 'rubble' }, win: tw({ w: 0.9, pitch: 2.0 }) }), walls: front(ivy) },
    ...[[934, 1052.7, 2621.2, 8], [857, 1055.3, 2609.9, 9], [990, 1040.8, 2622, 4], [995, 1041.9, 2615.6, 4]].map(([base, x, z, r]) =>
      ({ name: 'j' + base, sec: '2_5', base, at: [x, z], r, spec: wood([184, 177, 167], { storey: 2.8, maxFloors: 2, plinth: { h: 0.5, col: '#8f8b86' }, win: tw({ w: 0.9, pitch: 2.1 }) }) })),
    // ---- Lai, the right-hand side going up
    { name: 'l831', sec: '2_5', base: 831, at: [1089.6, 2632.3], r: 12, spec: plaster([236, 172, 92], { storey: 3.2, maxFloors: 2, plinth: { h: 0.6, col: '#8e8478' }, win: tw({ w: 1.15, pitch: 2.6, surround: 0.12 }) }) },
    { name: 'l676', sec: '2_5', base: 676, at: [1114.4, 2598.4], r: 22, spec: {}, walls: only(darkTimber) },
    { name: 'l643', sec: '3_5', base: 643, at: [1133.8, 2573], r: 14, spec: {}, walls: only(glassOffice) },
    { name: 'l582', sec: '3_5', base: 582, at: [1151.1, 2551.2], r: 10, spec: plaster([228, 214, 176], { storey: 3.3, maxFloors: 2, plinth: { h: 0.7, col: '#9a907c' }, win: tw({ w: 1.1, pitch: 2.4, surround: 0.12 }), attic: { w: 1.0, h: 1.1 } }) },
    { name: 'l485', sec: '3_5', base: 485, at: [1181.2, 2528.9], r: 14, spec: plaster([236, 232, 222], { storey: 3.2, maxFloors: 2, plinth: { h: 0.7, col: '#9b968e' }, win: tw({ w: 0.95, T: false, bars: 1, rails: 1, frame: '#7a4a32', surround: 0.14 }), attic: { w: 1.0, h: 1.0, round: true } }) },
    { name: 'l515', sec: '3_5', base: 515, at: [1207, 2523.1], r: 9, spec: plaster([232, 228, 220], { storey: 3.0, maxFloors: 2, win: tw() }) },
    { name: 'l324', sec: '3_5', base: 324, at: [1225.8, 2508.2], r: 14, spec: plaster([238, 234, 226], { storey: 3.2, maxFloors: 2, plinth: { h: 0.6, col: '#9d9890' }, win: tw({ w: 1.0, T: false, bars: 1, rails: 1, frame: '#6e4a33', surround: 0.12 }) }), walls: front(gate) },
    { name: 'l351', sec: '3_5', base: 351, at: [1260.5, 2490.5], r: 34, spec: plaster([240, 240, 238], { storey: 3.0, maxFloors: 4, plinth: { h: 0.5, col: '#6f7178' }, win: sq({ w: 1.4, pitch: 2.6, frame: '#3a3d44' }), weather: 0.2 }), walls: front(balconies) },
    { name: 'l311', sec: '3_5', base: 311, at: [1313, 2472.5], r: 22, spec: {}, walls: only(office) },
    { name: 'l300', sec: '3_5', base: 300, at: [1333.6, 2462.2], r: 14, spec: plaster([238, 206, 198], { storey: 3.7, maxFloors: 2, plinth: { h: 0.8, col: '#a09a94' }, win: tw({ w: 1.05, pitch: 2.6, surround: 0.14, hood: 0.15 }) }), walls: front(pilasters) },
    { name: 'l239', sec: '3_5', base: 239, at: [1368.9, 2440.3], r: 22, spec: {}, walls: only(uusTeater) },
    { name: 'l171', sec: '3_5', base: 171, at: [1404.2, 2411.7], r: 12, spec: {}, walls: only(flats) },
    // ---- Lai, the left-hand side
    { name: 'l734', sec: '2_5', base: 734, at: [1074.1, 2601.3], r: 16, spec: plaster([236, 234, 228], { storey: 3.2, maxFloors: 3, plinth: { h: 0.6, col: '#9a978f' }, win: tw({ w: 1.1, pitch: 2.4 }) }) },
    { name: 'l543', sec: '3_5', base: 543, at: [1163.6, 2531.4], r: 9, spec: plaster([236, 233, 226], { storey: 3.0, maxFloors: 1, win: tw({ w: 0.9 }) }) },
    { name: 'l495', sec: '3_5', base: 495, at: [1172.1, 2492.4], r: 12, spec: plaster([222, 172, 160], { storey: 3.0, maxFloors: 1, plinth: { h: 0.5, col: '#c49a8e' }, win: tw({ w: 0.9, pitch: 2.0, frame: '#f1ece4' }), shutters: '#9c5a4c' }) },
    { name: 'l372', sec: '3_5', base: 372, at: [1199.4, 2473.1], r: 16, spec: plaster([216, 190, 138], { trim: '#efe6d2', storey: 3.5, maxFloors: 3, belts: [3.9], plinth: { h: 0.9, col: '#8c7f6a', vents: 2.6 }, win: tw({ w: 1.15, pitch: 2.4, surround: 0.14, hood: 0.18, sc: '#efe6d2' }) }) },
    { name: 'l384', sec: '3_5', base: 384, at: [1218.4, 2465.8], r: 18, spec: plaster([192, 188, 178], { trim: '#e9e6de', storey: 3.6, maxFloors: 3, belts: [4.0], plinth: { h: 1.0, col: '#857f76', vents: 2.4 }, win: tw({ w: 1.15, pitch: 2.5, surround: 0.15, hood: 0.2, sc: '#e9e6de' }) }) },
    { name: 'l335', sec: '3_5', base: 335, at: [1268.6, 2449.2], r: 28, spec: plaster([202, 202, 198], { trim: '#efefec', storey: 3.7, maxFloors: 3, belts: [4.1], plinth: { h: 0.9, col: '#8a8986', vents: 2.6 }, win: tw({ w: 1.15, pitch: 2.5, surround: 0.15, hood: 0.18, sc: '#efefec' }) }) },
    { name: 'l32', sec: '3_4', base: 32, at: [1401.4, 2372], r: 24, spec: plaster([242, 206, 192], { storey: 3.4, maxFloors: 2, plinth: { h: 0.7, col: '#a5948c' }, win: tw({ w: 1.05, pitch: 2.6, surround: 0.12 }) }),
      walls: [{ near: [0, 0], within: 1e9, draw: (P, W) => { if (TOWARD_START(W)) botanical(P, W); } }] },
  ];
}

// ---------------------------------------------------------------- fences and garden walls along the pavement
// [i0, i1, side (1 right going up the lap, -1 left), kind, height, pavement from the kerb (m)]
const FENCES = [
  [656, 661, -1, 'boards', 1.8, 1.6],          // the old board fence by the ivy house (17 Jakobi)
  [700, 713, 1, 'rail', 0.9, 2.0],             // the black railing along the orange house
  [734, 770, 1, 'slats', 1.25, 2.2],           // brown boards between white posts (8 and 15 Lai)
  [736, 766, -1, 'brick', 2.0, 2.2],           // the old red brick garden wall (15 Lai)
  [767, 775, -1, 'white', 2.2, 2.0],           // the white wall with the tiled cap (23 Tartu-Tiksoja)
  [800, 812, 1, 'rail', 1.0, 2.2],             // the black railing in front of the white block (28 Lai)
  [852, 870, 1, 'iron', 1.6, 2.4],             // the iron fence on stone posts round Uus Teater (38 Lai)
  [846, 906, -1, 'pink', 2.3, 2.2],            // the botanical garden's pink wall (37 to 41 Tartu-Tiksoja)
];
// The grey picket fence on the inside of the Jakobi to Lai turn (1 Tartu-Tiksoja; Martin, 22 Nov: from the corner of the
// timber house to the white house in one curve, a touch lower, and it breaks when a car drives into it). A curve from
// a through c to b; panels of about 1.6 m, each one its own piece that flies off when hit.
const CORNER = { a: [1056.3, 2627.4], c: [1068.45, 2627.0], b: [1073.2, 2616.2], h: 0.9, panel: 1.6 };
const WALLS = { brick: [0xa65a48, 0x8e4c3e], white: [0xf1eee8, 0xb4604c], pink: [0xeab3a4, 0xd9a090] };   // [wall, cap]

function fenceTextures() {
  const opts = { repeat: true, alpha: true };
  return {
    picket: paintTexture(2, 0, 1.1, 96, (P) => { for (let x = 0.03; x < 2; x += 0.13) P.r(x, 0, x + 0.08, 1.1, '#a9a7a2'); P.r(0, 0.22, 2, 0.3, '#8f8d88'); P.r(0, 0.8, 2, 0.88, '#8f8d88'); }, opts),
    slats: paintTexture(2, 0, 1.25, 96, (P) => { for (let x = 0.02; x < 2; x += 0.16) P.r(x, 0.05, x + 0.12, 1.2, '#6a4b3a'); P.r(0, 0.25, 2, 0.32, '#5a3f31'); P.r(0, 0.95, 2, 1.02, '#5a3f31'); }, opts),
    rail: paintTexture(2, 0, 1.0, 96, (P) => { for (let x = 0.05; x < 2; x += 0.12) P.r(x, 0, x + 0.025, 1.0, '#26272b'); P.r(0, 0.05, 2, 0.1, '#26272b'); P.r(0, 0.92, 2, 1.0, '#26272b'); }, opts),
    boards: paintTexture(2, 0, 1.8, 64, (P) => { P.boards(0, 0, 2, 1.8, [128, 116, 100], 0.14, true); }, { repeat: true }),
  };
}

export function createLaiFronts(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  const track = createTrack();
  const P = track.P;
  // the nearest lap point of this stretch and which way the wall faces it
  function lapNear(x, z) {
    let best = 1e9, bi = I0;
    for (let i = I0; i <= I1; i += 2) { const d = (P[i][0] - x) ** 2 + (P[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } }
    return [bi, Math.sqrt(best)];
  }
  const faces = (W) => {
    const [i, d] = lapNear(W.mid[0], W.mid[1]);
    const tx = P[i][0] - W.mid[0], tz = P[i][1] - W.mid[1], l = Math.hypot(tx, tz) || 1;
    W.back = W.len > 6 && W.nx * track.tan[i][0] + W.nz * track.tan[i][1] < -0.7;   // looks back down the lap
    return d < 36 && (W.nx * tx + W.nz * tz) / l > 0.35;
  };

  function* fences() {
    const p = new Parts(), T = fenceTextures(), quads = { picket: [], slats: [], rail: [], boards: [] };
    const h = (x, z) => world.heightAt(x, z);
    for (const [i0, i1, side, kind, H, pav] of FENCES) {
      // where the fence runs: the pavement's width out from the kerb, but never into a house
      const line = [];
      for (let i = i0; i <= i1; i++) {
        const nx = -track.tan[i][1] * side, nz = track.tan[i][0] * side, hw = track.HW[i];
        let lat = hw + pav;
        let d = hw + 0.5;
        while (d < lat + 0.6 && world.sdfAt(P[i][0] + nx * d, P[i][1] + nz * d) > 0.5) d += 0.25;
        lat = Math.min(lat, d - 0.6);
        line.push(lat > hw + 1.2 ? [P[i][0] + nx * lat, P[i][1] + nz * lat] : null);
      }
      for (let k = 0; k + 1 < line.length; k++) {
        const a = line[k], b = line[k + 1];
        if (!a || !b) continue;
        const ya = h(a[0], a[1]), yb = h(b[0], b[1]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.2 || len > 4) continue;
        const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, yaw = Math.atan2(uz, -ux), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, ym = Math.min(ya, yb);
        if (WALLS[kind]) {
          const [wc, cc] = WALLS[kind];
          p.box(len + 0.05, H + 0.4, 0.3, wc, mx, ym - 0.4 + (H + 0.4) / 2, mz, yaw);
          p.box(len + 0.08, 0.12, 0.42, cc, mx, ym + H + 0.06, mz, yaw);
          if (kind === 'brick' && k % 2 === 0) p.box(0.5, H + 0.6, 0.5, 0x9a5142, a[0], ya - 0.4 + (H + 1.0) / 2, a[1], yaw);
          continue;
        }
        if (kind === 'iron') {
          p.box(len + 0.05, 0.5, 0.35, 0x8b857c, mx, ym - 0.2 + 0.35, mz, yaw);                         // the stone plinth
          if (k % 2 === 0) p.box(0.5, H + 0.2, 0.5, 0xcfc9bd, a[0], ya + (H + 0.2) / 2, a[1], yaw);       // stone posts
          quads.rail.push([a, b, ya + 0.45, yb + 0.45, H - 0.45]);
          continue;
        }
        const post = kind === 'slats' ? 0xf1eee6 : kind === 'rail' ? 0x26272b : kind === 'boards' ? 0x6f6458 : 0x8f8d88;
        const pw = kind === 'slats' ? 0.14 : 0.08;
        if (kind !== 'boards' || k % 2 === 0) p.box(pw, H + 0.1, pw, post, a[0], ya + (H + 0.1) / 2, a[1], yaw);
        quads[kind].push([a, b, ya, yb, H]);
      }
      yield;
    }
    // the fence pictures on upright strips, one mesh a kind
    for (const kind of Object.keys(quads)) {
      const Q = quads[kind];
      if (!Q.length) continue;
      const pos = [], uv = [];
      let u = 0;
      for (const [a, b, ya, yb, H] of Q) {
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]), u1 = u + l / 2;
        pos.push(a[0], ya, a[1], b[0], yb, b[1], a[0], ya + H, a[1], a[0], ya + H, a[1], b[0], yb, b[1], b[0], yb + H, b[1]);
        uv.push(u, 0, u1, 0, u, 1, u, 1, u1, 0, u1, 1);
        u = u1;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: T[kind], alphaTest: kind === 'boards' ? 0 : 0.5, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      group.add(m);
      yield;
    }
    for (const k of Object.keys(T)) if (!quads[k].length) T[k].dispose();
    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; group.add(m); }
  }


  // ---- the breakable picket fence round the corner (an InstancedMesh: a panel is one instance)
  const corner = { mesh: null, panels: [], flying: 0, at: null };
  function* cornerFence() {
    const { a, b, c, h: H, panel } = CORNER, pts = [];
    const bez = (t) => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]];
    let len = 0, q = bez(0);
    for (let k = 1; k <= 40; k++) { const r = bez(k / 40); len += Math.hypot(r[0] - q[0], r[1] - q[1]); q = r; }
    const n = Math.max(2, Math.round(len / panel));
    for (let k = 0; k <= n; k++) pts.push(bez(k / n));          // (even enough spacing on this gentle curve)
    const tex = paintTexture(panel, 0, H, 128, (P) => {
      for (let x = 0.04; x < panel - 0.05; x += 0.13) { P.r(x, 0.04, x + 0.08, H - 0.07, '#a9a7a2'); P.poly([[x, H - 0.07], [x + 0.08, H - 0.07], [x + 0.04, H - 0.01]], '#a9a7a2'); }
      P.r(0, 0.17, panel, 0.24, '#8f8d88'); P.r(0, H - 0.3, panel, H - 0.23, '#8f8d88');
      P.r(0, 0, 0.08, H, '#7f7d78');
    }, { alpha: true });
    const geo = new THREE.PlaneGeometry(panel, H).translate(0, H / 2, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), n);
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < n; k++) {
      const p0 = pts[k], p1 = pts[k + 1], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const ux = (p1[0] - p0[0]) / l, uz = (p1[1] - p0[1]) / l, mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
      const y = Math.min(world.heightAt(p0[0], p0[1]), world.heightAt(p1[0], p1[1]));
      const yaw = Math.atan2(-uz, ux);
      const pn = { p0, p1, mx, mz, y, yaw, sx: l / panel, down: false, rest: false, pos: [mx, y, mz], v: [0, 0, 0], ang: 0, spin: 0, tilt: 0 };
      qt.setFromAxisAngle(up, yaw);
      mesh.setMatrixAt(k, m4.compose(new THREE.Vector3(mx, y, mz), qt, new THREE.Vector3(pn.sx, 1, 1)));
      corner.panels.push(pn);
    }
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    corner.mesh = mesh;
    corner.at = bez(0.5);
    if (typeof window !== 'undefined') window.__laiCorner = corner;      // (for tests: panels, which are down)
    group.add(mesh);
    yield;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function tick(car, dt) {
    const C = corner;
    if (!C.mesh || !car) return;
    if (!C.flying && Math.hypot(car.x - C.at[0], car.z - C.at[1]) > 30) return;
    dt = Math.min(dt || 0.016, 0.05);
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz, speed = Math.hypot(wvx, wvz);
    const inside = (x, z) => { const dx = x - car.x, dz = z - car.z, l = dx * fx + dz * fz, t = dx * rx + dz * rz; return Math.abs(l) < (car.halfLen || 2.2) + 0.15 && Math.abs(t) < (car.halfWid || 0.9) + 0.15; };
    let moved = false;
    for (let k = 0; k < C.panels.length; k++) {
      const p = C.panels[k];
      if (!p.down) {
        if (speed < 0.8 || Math.abs((car.y ?? p.y) - p.y) > 2.5) continue;
        if (!inside(p.p0[0], p.p0[1]) && !inside(p.p1[0], p.p1[1]) && !inside(p.mx, p.mz)) continue;
        // knocked off its posts: thrown the way the car goes, tumbling
        p.down = true; C.flying++;
        const push = 0.55 + Math.random() * 0.25;
        p.v = [wvx * push + (Math.random() - 0.5) * 1.5, 1.2 + Math.min(speed, 20) * 0.12 + Math.random(), wvz * push + (Math.random() - 0.5) * 1.5];
        p.spin = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5); p.tilt = (Math.random() - 0.5) * 0.8;
        car.hit = Math.max(car.hit || 0, Math.min(2.5, speed * 0.08));
        car.vx *= 0.985;
      }
      if (p.rest) continue;
      p.v[1] -= 9.81 * dt;
      p.pos[0] += p.v[0] * dt; p.pos[1] += p.v[1] * dt; p.pos[2] += p.v[2] * dt;
      p.ang += p.spin * dt;
      p.yaw += p.tilt * dt;
      const g = world.heightAt(p.pos[0], p.pos[2]) + 0.03;
      if (p.pos[1] < g) {
        p.pos[1] = g; p.v[1] *= -0.2; p.v[0] *= 0.5; p.v[2] *= 0.5; p.spin *= 0.5;
        if (Math.abs(p.v[1]) < 0.5 && Math.hypot(p.v[0], p.v[2]) < 0.3) { p.rest = true; p.ang = Math.PI / 2 * Math.sign(Math.sin(p.ang) || 1); C.flying--; }
      }
      // turned to its heading, then tumbling round its own length
      _q.setFromAxisAngle(_up, p.yaw);
      _ax.set(1, 0, 0).applyQuaternion(_q);
      _q2.setFromAxisAngle(_ax, p.ang);
      _q2.multiply(_q);
      C.mesh.setMatrixAt(k, _m.compose(_v.set(p.pos[0], p.pos[1], p.pos[2]), _q2, _s.set(p.sx, 1, 1)));
      moved = true;
    }
    if (moved) { C.mesh.instanceMatrix.needsUpdate = true; C.mesh.frustumCulled = C.flying === 0; if (!C.flying) C.mesh.computeBoundingSphere(); }
  }

  return {
    tick,
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if (![P[I0], P[770], P[I1]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      skinHouses(world, group, houses(), { label: 'laifronts fronts', faces, shadows, ppm: 18, far: 5 });
      jobs.add(fences, 'lai fences');
      jobs.add(cornerFence, 'lai corner fence');
    },
  };
}

function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
