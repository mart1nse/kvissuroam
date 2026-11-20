// Riia tänav (road 3) in Tartu from the Küüni corner by Kaubamaja towards Pepleri (Martin, 20 Nov: a pink outline
// on a map), dressed from the Land Board's oblique air photos (2024) and Mapillary street photos (2022 to 2024).
// Kaubamaja, Kvartal and the Vanemuine theatre are built elsewhere. Batch 1, the Küüni end down to W. Struve:
//  - Hotel Pallas (Riia 4): the blue glass front to Riia over a sage-grey ground floor with its canopy, the
//    PALLAS sign on the corner, the grey corner to Kalevi with its column of company boards and the round
//    window, white walls with long window bands to the yard and to Küüni.
//  - The court house (Kalevi 1): light grey render with long bands of blue glass, the dark brown base, the black
//    entrance block with TARTU KOHTUMAJA on it, and the steel railing along the Riia pavement.
//  - Riia 3: the taupe six-storey block with its stacks of glazed balconies and the red brick end by the door.
//  - Riia 5: the dark brown-grey 1950s block with its tall pilasters and the shop windows on the ground floor,
//    Riia 5a in the yard behind, and the white back of W. Struve 8.
// Cars parked at the kerb in front of Riia 3 and 5. What the photos do not show sharply (window counts, shop
// signs, the boards' names) is guessed. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

// ---------------------------------------------------------------- the road frame
// s metres along Riia from the Küüni junction towards Pepleri (south-west), v metres across it, + to the
// north-west (the theatre side), - to the south-east (Pallas, the court house, the park).
const RIIA = [[1712.7, 3164.8], [1657.2, 3233.3], [1604.4, 3325.0], [1543.8, 3429.3], [1482.6, 3502.1], [1466.0, 3517.4], [1331.8, 3636.5]];
const SEG = [];
{
  let acc = 0;
  for (let i = 0; i < RIIA.length - 1; i++) {
    const a = RIIA[i], b = RIIA[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    SEG.push({ a, s0: acc, len, u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
    acc += len;
  }
}
// a point s along the centre line and v across it (the corners between straight pieces are blended over 12 m)
function dirAt(s) {
  const k = SEG.findIndex((g) => s < g.s0 + g.len), g = SEG[k < 0 ? SEG.length - 1 : k];
  const nx = SEG[SEG.indexOf(g) + 1], pv = SEG[SEG.indexOf(g) - 1];
  let u = g.u;
  if (nx && s > g.s0 + g.len - 6) { const t = (s - (g.s0 + g.len - 6)) / 12; u = [g.u[0] * (1 - t) + nx.u[0] * t, g.u[1] * (1 - t) + nx.u[1] * t]; }
  else if (pv && s < g.s0 + 6) { const t = 0.5 + (s - g.s0) / 12; u = [pv.u[0] * (1 - t) + g.u[0] * t, pv.u[1] * (1 - t) + g.u[1] * t]; }
  const l = Math.hypot(u[0], u[1]);
  return [u[0] / l, u[1] / l];
}
function L(s, v = 0) {
  const k = SEG.findIndex((g) => s < g.s0 + g.len), g = SEG[k < 0 ? SEG.length - 1 : k];
  const t = s - g.s0, c = [g.a[0] + g.u[0] * t, g.a[1] + g.u[1] * t], u = dirAt(s);
  return [c[0] - u[1] * v, c[1] + u[0] * v];
}
const CENTRE = L(150, 0);
const DEBUG = typeof location !== 'undefined' && /riiadebug/.test(location.search);

// ---------------------------------------------------------------- what the map's own data needs
// Wall and roof colours of the map's blocks (LOD2 bases in cm, sector 3_6); the walls are painted over below.
export function riiaWalls(walls) {
  setHouseColours(walls, '3_6', 1120, 3040, [
    { base: 421, x: 1708.2, z: 3222.6, wall: 0x6f8fb4, roof: 0x5c5f66, reach: 40 },   // Hotel Pallas
    { base: 934, x: 1662.0, z: 3322.0, wall: 0xd4d6d8, roof: 0x55585e, reach: 50 },   // the court house
    { base: 1381, x: 1569.1, z: 3332.0, wall: 0x8c8075, roof: 0x55575c },             // Riia 3
    { base: 1439, x: 1562.0, z: 3365.4, wall: 0x6e645c, roof: 0x8d9198 },             // Riia 5
    { base: 1492, x: 1548.6, z: 3359.8, wall: 0x9a8f86, roof: 0x5d5f64 },             // Riia 5a
    { base: 2005, x: 1519.0, z: 3379.9, wall: 0xe9e8e3, roof: 0x5d5f64 },             // W. Struve 8
  ]);
}

// Parked cars for src/world/parked.js: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw)). Nose to the
// south-west at the kerb in front of Riia 3 and Riia 5.
const yawAlong = (s) => { const u = dirAt(s); return Math.atan2(u[0], -u[1]); };
export const RIIA_CARS = [
  [...L(224, 7.0), yawAlong(224), 'passat', 'silver', 0.03],
  [...L(236, 7.0), yawAlong(236), 'mazda6', 'grey', 0.03],
  [...L(255, 7.0), yawAlong(255), 'rav4', 'white', 0.03],
  [...L(267, 7.0), yawAlong(267), 'model3', 'white', 0.03],
];

// ---------------------------------------------------------------- the painted walls
const C = { glassBlue: '#4c6f9c', glass: '#4a5866', trim: '#f2f1ec', sage: '#7d8a83' };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: C.trim, weather: 0.4, ...o });
const sq = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.05, frame: '#f1f0ec', glass: C.glass, ...o });

// a glass curtain wall: blue panes in a white grid, one row a floor, over a ground floor of sage panels and shop
// glass with a flat canopy
function curtain(P, W, { floor = 3.4, base = 4.4, pitch = 1.5 } = {}) {
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#dfe3e6');
  P.grad(0, base, len, top - 0.6, '#5d84b4', '#3d5f8c');
  for (let y = base; y < top - 0.6; y += floor) {
    P.r(0, y - 0.09, len, y + 0.09, '#e9edf0');
    P.r(0, y + floor * 0.62, len, y + floor * 0.64, 'rgba(235,240,245,0.5)');
    for (let k = 0; k < 5; k++) { const x = (y * 3.7 + k * 9.1) % len; P.r(x, y + 0.2, x + pitch * 0.9, y + floor - 0.3, 'rgba(255,255,255,0.08)'); }
  }
  for (let x = 0.2; x < len; x += pitch) P.r(x - 0.05, base, x + 0.05, top - 0.6, '#e9edf0');
  P.r(0, top - 0.6, len, top, '#cfd4d8');
  // the ground floor: sage panels, shop glass, a door now and then
  P.r(0, P.y0, len, base, C.sage);
  for (let x = 1.2; x < len - 2.5; x += 5.2) { P.r(x, 0.35, x + 3.9, 3.1, '#2f3a42'); P.r(x + 1.9, 0.35, x + 2.0, 3.1, '#8f9a93'); }
  for (let x = 0; x < len; x += 1.2) P.r(x, 3.3, x + 0.03, base, '#6d7972');
  P.r(0, 3.3, len, 3.45, '#3d4247');                            // the canopy's edge
  P.r(0, P.y0, len, 0.3, '#5b625f');
}
// rendered walls with long window bands, one a floor
function ribbon(P, W, { wall = '#f1f1ee', glass = C.glassBlue, floor = 3.4, first = 1.0, band = 1.55, base = null, baseH = 0, stair = null } = {}) {
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, wall);
  if (base) { P.r(0, P.y0, len, baseH, base); for (let x = 1.0; x < len - 2.5; x += 3.2) P.r(x, 0.5, x + 2.4, baseH - 0.6, '#2c3640'); }
  for (let y = first; y + band < Math.min(top, W.eaves) - 0.5; y += floor) {
    if (base && y < baseH) continue;
    P.grad(0.6, y, len - 0.6, y + band, glass, '#2f4560');
    for (let x = 0.6; x < len - 0.6; x += 1.35) P.r(x - 0.04, y, x + 0.04, y + band, '#e6e9ec');
    P.r(0.5, y - 0.12, len - 0.5, y, '#c9ccd0');
  }
  if (stair) { const [x0, x1] = stair; P.grad(x0, 0.3, x1, Math.min(top, W.eaves) - 0.8, '#3d4e60', '#24303c'); for (let y = 1; y < W.eaves - 1; y += 1.7) P.r(x0, y, x1, y + 0.05, '#8e99a4'); }
  P.weather(0, P.y0, len, top, 0.3, Math.round(W.mid[0]));
}

// The houses, with the walls that need more than the house's own spec. `near` points are the walls' middles.
function houses(later) {
  return [
    // ---- Hotel Pallas: blue glass to Riia, the grey corner to Kalevi, white long windows behind
    { name: 'pallas', sec: '3_6', base: 421, at: [1712, 3226], r: 45,
      spec: plaster([240, 240, 236], { storey: 3.4, maxFloors: 8, win: sq({ w: 2.4, pitch: 2.7, bars: 2, glass: '#4f6680' }), plinth: { h: 0.5, col: '#9fa2a5' } }),
      walls: [
        { near: [1697.9, 3222.5], within: 3, only: (P, W) => { curtain(P, W); later.push(() => canopy(W, 0.5, W.len - 0.5, 3.35, 1.6, 0x3a3e44)); } },
        { near: [1719.9, 3210.6], within: 3, only: (P, W) => curtain(P, W, { base: -1 }) },
        { near: [1692.9, 3234.7], within: 3, only: (P, W) => curtain(P, W, { base: -1 }) },
        { near: [1726.1, 3198.8], within: 3, only: (P, W) => ribbon(P, W, { stair: [W.len - 3.2, W.len - 0.6] }) },
        { near: [1689.3, 3248.8], within: 3, only: (P, W) => kalevi(P, W) },
        { near: [1737.0, 3201.6], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9e5ee' }) },
        { near: [1708.9, 3233.8], within: 3, only: (P, W) => ribbon(P, W) },
        { near: [1716.0, 3218.8], within: 3, only: (P, W) => ribbon(P, W) },
      ] },
    // ---- the court house: grey render, bands of blue glass, the dark base; the black entrance block to Kalevi
    { name: 'court', sec: '3_6', base: 934, at: [1665, 3322], r: 50,
      spec: plaster([214, 216, 218], { storey: 3.6, maxFloors: 6, win: sq({ w: 2.0, pitch: 2.6, bars: 1, glass: '#4f6680' }), plinth: { h: 0.6, col: '#5c4a42' } }),
      walls: [
        { near: [1641.4, 3316.2], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9dbdc', floor: 3.6, first: 4.6, band: 1.7, base: '#5e4b42', baseH: 3.8, stair: [W.len * 0.58, W.len * 0.58 + 2.6] }) },
        { near: [1646.2, 3344.7], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9dbdc', floor: 3.6, first: 1.2, band: 1.7 }) },
        { near: [1632.4, 3350.2], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9dbdc', floor: 3.6, first: 1.2, band: 1.7 }) },
        { near: [1671.7, 3294.2], within: 3, only: (P, W) => blackBlock(P, W) },
        { near: [1679.7, 3311.3], within: 3, only: (P, W) => blackBlock(P, W, false) },
        { near: [1668.5, 3299.2], within: 3, only: (P, W) => ribbon(P, W, { wall: '#e4e5e6', floor: 3.6, first: -0.4, band: 1.7 }) },
        { near: [1689.8, 3329.9], within: 3, only: (P, W) => ribbon(P, W, { wall: '#e4e5e6', floor: 3.6, first: 1.2, band: 1.7 }) },
      ] },
    // ---- Riia 3: taupe render, glazed balcony stacks on its long sides, red brick at the door end
    { name: 'riia3', sec: '3_6', base: 1381, at: [1570, 3332], r: 26,
      spec: plaster([146, 140, 133], { storey: 3.0, maxFloors: 6, win: sq({ w: 1.3, pitch: 2.8 }), plinth: { h: 0.9, col: '#6c625b' }, belts: [] }),
      walls: [
        // the end to Kalevi's side: red brick, open concrete balconies by the street corner
        { near: [1573.7, 3321.9], within: 3, only: (P, W) => {
          P.brick(0, P.y0, W.len, P.y1, [156, 78, 60], 33);
          for (let y = 1.5; y < (P.y1 - 0.6) - 1.5; y += 3.0) for (const x of [3.0, W.len - 9.0, W.len - 4.0]) P.win(x - 0.65, y, x + 0.65, y + 1.5, sq({ frame: '#e6e2da' }));
          for (let y = 3.1; y < (P.y1 - 0.6) - 2; y += 3.0) later.box(W, W.len - 2.2, 0.7, y, 2.6, 0.16, 1.4, 0xb9b4ad);
        } },
        { near: [1562.4, 3331.5], within: 3, draw: (P, W) => balconies(P, W, [W.len * 0.25, W.len * 0.62], 1.2) },
        // the street front: glazed balcony stacks, the brick ground floor and the steps up to the door at the north end
        { near: [1581.6, 3343.8], within: 3, only: (P, W) => {
          P.r(0, P.y0, W.len, P.y1, 'rgb(146,140,133)');
          P.weather(0, P.y0, W.len, P.y1, 0.4, 5);
          for (let k = 0; k < 6; k++) { const y = 1.4 + k * 3.0; if (y + 1.6 > (P.y1 - 0.6)) break; for (let x = 7.6; x < W.len - 0.8; x += 2.9) if (Math.abs(x - W.len * 0.62) > 2.2) P.win(x - 0.65, y, x + 0.65, y + 1.55, sq()); }
          balconies(P, W, [W.len * 0.62], 1.2);
          P.brick(0, P.y0, 6.4, 3.4, [158, 76, 56], 31); P.r(0, 3.4, 6.4, 3.55, '#d8d4cc');
          P.door(2.65, 4.15, 2.5, '#4b3530', { light: 0.5, panels: 1 });
          for (let y = 4.4; y < (P.y1 - 0.6) - 1.6; y += 3.0) P.win(2.75, y, 4.05, y + 1.55, sq());
          for (let k = 0; k < 4; k++) P.r(1.9 + k * 0.08, P.y0, 4.9 - k * 0.08, 0.02 - (3 - k) * 0.17, '#a39c98');
          later.push(() => canopy(W, 1.8, 5.0, 3.0, 1.5, 0xe4e1da));
        } },
      ] },
    // ---- Riia 5: the dark 1950s block, pilasters, shops on the ground floor
    { name: 'riia5', sec: '3_6', base: 1439, at: [1562, 3365.4], r: 24,
      spec: plaster([112, 102, 94], { storey: 3.3, maxFloors: 5, win: sq({ w: 1.15, pitch: 2.5, frame: '#ece8e0', glass: '#3e4650' }), plinth: { h: 0.6, col: '#4f4945' }, belts: [4.3], weather: 0.5 }),
      walls: [
        { near: [1567.2, 3368.6], within: 3, floors: [4.9, 8.2, 11.5, 14.8].map((sill) => ({ sill, h: 1.65 })),
          draw: (P, W) => {
            for (let x = 1.25; x < W.len; x += 2.5) P.r(x - 0.2, 4.4, x + 0.2, W.eaves - 0.4, 'rgba(150,138,128,0.55)');
            P.r(0, W.eaves - 0.6, W.len, W.eaves, '#857a72');
            for (const [x0, x1] of [[1.0, 6.4], [8.2, 13.6], [19.6, 25.0], [26.8, 32.2]]) { P.r(x0, 0.45, x1, 3.6, '#2e3236'); P.r((x0 + x1) / 2 - 0.04, 0.45, (x0 + x1) / 2 + 0.04, 3.6, '#7d7670'); P.r(x0, 3.6, x1, 4.1, '#e6e1d8'); }
            P.door(15.7, 17.2, 2.7, '#3d3631', { light: 0.6, panels: 1 });
          } },
      ] },
    { name: 'riia5a', sec: '3_6', base: 1492, at: [1548.6, 3359.8], r: 22, spec: plaster([154, 143, 134], { storey: 3.0, maxFloors: 3, win: sq({ w: 1.2, pitch: 2.6 }) }) },
    { name: 'struve8', sec: '3_6', base: 2005, at: [1519.0, 3379.9], r: 20, spec: plaster([234, 233, 228], { storey: 3.1, maxFloors: 6, win: sq({ w: 1.3, pitch: 2.7 }), plinth: { h: 0.7, col: '#8d8a86' } }) },
  ];

  // the corner to Kalevi: grey stone, the column of company boards, the round window and the steps
  function kalevi(P, W) {
    const len = W.len, top = P.y1;
    P.r(0, P.y0, len, top, '#8f969c');
    for (let y = 0; y < top; y += 1.2) P.r(0, y, len, y + 0.02, '#7c838a');
    for (let x = 0; x < len; x += 2.4) P.r(x, 0, x + 0.02, top, '#7c838a');
    // the grey fins on the corner tower
    for (let x = len - 7; x < len - 0.3; x += 0.9) P.r(x, 4.5, x + 0.35, top - 0.5, '#c9ced2');
    const boards = [['GRANT THORNTON', '#ffffff', '#3b2e6b'], ['GLASAKEN', '#c8282e', '#ffffff'], ['KINNISVARA', '#ffffff', '#163f7a'], ['DOMUS', '#ffffff', '#c47a12'], ['AVAAERE', '#f2e24a', '#2a2a2a'], ['HANSAKESKUS', '#ffffff', '#1d1d1f']];
    boards.forEach(([t, bg, fg], k) => { const y = 6 + k * 1.55; P.r(1.2, y, 7.2, y + 1.3, bg); P.r(1.2, y, 7.2, y + 0.05, '#555'); P.text(t, 4.2, y + 0.65, 0.55, fg); });
    P.arc(10.5, 2.6, 0.9, '#c9ced2'); P.arc(10.5, 2.6, 0.75, '#3a4652');
    P.r(12.5, 0, 15.5, 3.1, '#2f3a44'); P.r(13.95, 0, 14.05, 3.1, '#a9b0b6');
    for (let k = 0; k < 3; k++) P.r(12.0 + k * 0.1, P.y0, 16.0 - k * 0.1, 0.02 - (2 - k) * 0.17, '#a39c98');
    // the red PALLAS box at the top
    P.r(len - 6.5, top - 4.2, len - 1.0, top - 1.4, '#c8323a');
    P.text('PALLAS', len - 3.75, top - 2.8, 1.4, '#ffffff', '700 %px Georgia, serif');
  }
  // the court's entrance block: black panels, the name in white letters
  function blackBlock(P, W, name = true) {
    const len = W.len, top = P.y1;
    P.r(0, P.y0, len, top, '#26272b');
    for (let x = 0; x < len; x += 1.8) P.r(x, P.y0, x + 0.03, top, '#3a3b40');
    if (name) P.text('TARTU KOHTUMAJA', len * 0.5, Math.min(top - 1.2, 6.2), 1.1, '#f1f1ee', '600 %px Georgia, serif');
    P.r(len * 0.35, 0, len * 0.65, 3.0, '#3b4752');
    for (let k = 1; k < 4; k++) P.r(len * (0.35 + k * 0.075) - 0.03, 0, len * (0.35 + k * 0.075) + 0.03, 3.0, '#7d858d');
  }
  // stacks of glazed balconies, one a floor, white frames
  function balconies(P, W, xs, w = 1.2) {
    if (DEBUG) console.log('riia balconies', W.mid.map((v) => v.toFixed(1)).join(','), W.len.toFixed(1), W.eaves.toFixed(1));
    const top = Math.max(W.eaves, P.y1 - 0.6);
    for (const xc of xs) {
      for (let y = 3.3; y < top - 2.6; y += 3.0) {
        P.r(xc - w * 1.6, y - 0.15, xc + w * 1.6, y + 2.6, '#d6d2cc');
        P.r(xc - w * 1.5, y + 0.95, xc + w * 1.5, y + 2.45, '#5a6874');
        for (let k = 0; k <= 4; k++) { const x = xc - w * 1.5 + k * w * 0.75; P.r(x - 0.04, y + 0.95, x + 0.04, y + 2.45, '#f2f1ee'); }
        P.r(xc - w * 1.6, y - 0.15, xc + w * 1.6, y + 0.95, '#bfbab3');
      }
    }
  }
  // a flat canopy sticking out of a wall from x0 to x1 at height y, `depth` deep
  function canopy(W, x0, x1, y, depth, c) {
    later.box(W, (x0 + x1) / 2, depth / 2, y, x1 - x0, 0.2, depth, c);
  }
}

// ---------------------------------------------------------------- the build
export function createRiia(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    // 3D pieces fixed to a painted wall: x along it, out from it, y above its ground line
    const later = [];
    later.box = (W, x, out, y, w, hh, d, c) => later.push(() => {
      const px = W.a[0] + W.ux * x + W.nx * out, pz = W.a[1] + W.uz * x + W.nz * out;
      p.add(BOX(w, hh, d), c, px, W.yref + y, pz, Math.atan2(W.nx, W.nz));
    });
    // the walls that face the road (within 45 m of the centre line) get the sharper pictures
    const faces = (W) => {
      let best = 1e9, bs = 0;
      for (let s = 0; s <= 620; s += 4) { const q = L(s, 0), d = Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]); if (d < best) { best = d; bs = s; } }
      const q = L(bs, 0), tx = q[0] - W.mid[0], tz = q[1] - W.mid[1];
      return best < 45 && (tx * W.nx + tz * W.nz) / (Math.hypot(tx, tz) || 1) > 0.3;
    };
    skinHouses(world, group, houses(later), { faces, shadows, ppm: 22, far: 9, debug: DEBUG });
    for (let k = 0; k < later.length; k++) later[k]();

    // the steel railing along the pavement on the court and park side, from Kalevi to the Riia 8 lane
    const rail = [];
    for (let s = 100; s <= 330; s += 2.5) rail.push(L(s, -8.6));
    A.walk(rail, 2.5, ([x, z]) => p.add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), 0x9a9ea4, x, h(x, z) + 0.5, z));
    for (let i = 0; i < rail.length - 1; i++) { A.bar(rail[i], rail[i + 1], 0.05, 0.95, 1.02, 0xa9adb3); A.bar(rail[i], rail[i + 1], 0.03, 0.45, 0.5, 0x9a9ea4); }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([L(0, -40), L(80, 40), L(200, -60), L(280, 50)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
