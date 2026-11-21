// Riia tänav past Pepleri (Martin, 20 Nov: kaardista "riiastrip", a map with the strip marked plus his Street View
// shots of Jun and Aug 2024; the Land Board's oblique air photos of Apr 2024 for the roofs and backs).
// Batch 1, from the Pepleri junction to Pauluse church:
//  - Riia Kvartal (Riia 20 and 22), which the map's 3D data still has as a building site: the dark gabled block
//    by the road and the round-ended tower on the corner of the side lane, its red brick front with the
//    balconies, the shop windows and the sales banners, its dark board walls and tall narrow windows; the dark
//    and brick towers behind (Riia 22a and the others) in their colours; the old ambulance station (Riia 18) in
//    cream with its grey roof and its car park full of cars.
//  - Riia 24: grey, the tall dark window strips between light piers, the shops under them (STANDARD on the
//    corner), the tall OVERALL sign; Riia 24A beside it in pale beige.
//  - Pauluse church (Riia 27): red brick, arched windows, its red tile roofs, and the copper-green spire on the
//    tower, which the map leaves flat; the black steel railing along its pavement.
//  - Across the road (from the air photos only): Riia 15b and 17 (the ochre five-storey blocks with the mauve
//    roof), the white university buildings of Riia 23 and 25.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame, cellKit } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const DEBUG = typeof location !== 'undefined' && /riia2debug/.test(location.search);
const S36 = ['3_6', 1120, 3040], S37 = ['3_7', 1120, 3680], S27 = ['2_7', 480, 3680];
// Riia's frame from the Pepleri junction: s metres along the street to the south-west, v + = the north-west side
// (the university, the church), v - = the south-east side (Riia Kvartal, Riia 24)
export const RIIA2 = frame([1331.8, 3636.5], [-0.766, 0.642]);
const L = RIIA2.at;
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const NW = RIIA2.V, SE = [-RIIA2.V[0], -RIIA2.V[1]], SW = RIIA2.U;
const SANS = '700 %px Arial, sans-serif';

// the new buildings of Riia Kvartal, in the frame: the gabled block (Riia 20) and the corner tower (Riia 22)
const G20 = { s0: 115, s1: 149, vf: -10.5, vb: -23, eaves: 12.5, ridge: 16.5 };
const T22 = { s0: 157.5, s1: 181, vf: -12.5, vr: -32, r: 11.75, top: 19.6 };
const inNew = (x, z) => {
  const [s, v] = RIIA2.sv(x, z);
  if (s > G20.s0 - 1 && s < G20.s1 + 1 && v < G20.vf + 1 && v > G20.vb - 1) return true;
  if (s > T22.s0 - 1 && s < T22.s1 + 1 && v < T22.vf + 1 && v > T22.vr - T22.r - 1) return true;
  return false;
};

// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['r15b', S36, 2498, [1306.7, 3619.2], 22, 0xd0b360, 0x7b625f],
  ['r17', S36, 2567, [1288.2, 3643.0], 40, 0xd0b360, 0x7b625f],
  ['r23', S37, 2398, [1206.7, 3688.4], 30, 0xe9e7e1, 0x6d7076],
  ['r25', S37, 2521, [1121.6, 3765.3], 36, 0xecebe6, 0x4b4f55],
  ['kirik', S27, 2456, [1067.4, 3796.0], 46, 0x9c5c44, 0xae5f40],
  ['r18', S37, 2408, [1277.0, 3711.5], 18, 0xe6dcc2, 0x8f9398],
  ['r24', S37, 2411, [1152.1, 3812.5], 25, 0xbdbcb7, 0x5d6066],
  ['r24a', S27, 2427, [1112.8, 3852.0], 32, 0xdad3c4, 0x606368],
  ['kv22a', S37, 2341, [1239.7, 3807.7], 22, 0x2d2d31, 0x3a3b3f],
  ['kvb', S37, 2323, [1297.5, 3792.5], 22, 0x8c4430, 0x3a3b3f],
];

export function riia2Walls(walls) {
  setHouseColours(walls, S37[0], S37[1], S37[2], [
    // the building site the map still shows where the gabled block and the corner tower stand
    { base: 2109, x: 1223.1, z: 3773.5, hide: true, reach: 30 },
    { base: 2440, x: 1264.9, z: 3730.3, hide: true, reach: 60 },
    ...HOUSES.filter((q) => q[1] === S37).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })),
  ]);
  for (const S of [S36, S27]) setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((q) => q[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// ---------------------------------------------------------------- painted walls on the map's blocks
const ochre = { kind: 'plaster', wall: [208, 179, 96], trim: '#efe6cf', storey: 2.95, maxFloors: 5, weather: 0.5,
  win: { w: 1.35, pitch: 3.1, T: false, bars: 1, surround: 0.06, sc: '#e9dfc4', frame: '#f4f2ec', glass: '#56677a' }, attic: null, plinth: { h: 0.7, type: 'plaster', col: '#8e8a84' } };
const whiteUni = (floors, storey = 3.5) => ({ kind: 'plaster', wall: [234, 232, 226], trim: '#f6f5f1', storey, maxFloors: floors, weather: 0.35,
  win: { w: 1.4, pitch: 3.2, T: false, bars: 1, surround: 0.1, sc: '#dcd9d2', frame: '#f4f3ef', glass: '#56667a' }, attic: null, plinth: { h: 0.8, type: 'plaster', col: '#9a9893' } });
const SPEC = {
  r15b: ochre, r17: ochre, r23: whiteUni(3), r25: whiteUni(4, 3.8),
  r18: { kind: 'plaster', wall: [230, 220, 194], trim: '#f1ebdc', storey: 3.3, maxFloors: 2, weather: 0.5,
    win: { w: 1.3, pitch: 3.0, T: false, bars: 1, surround: 0.1, sc: '#d8ccb0', frame: '#f4f1ea', glass: '#5a6878' }, attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' } },
  r24a: { kind: 'plaster', wall: [218, 211, 196], trim: '#efebe2', storey: 3.2, maxFloors: 4, weather: 0.4,
    win: { w: 1.5, pitch: 2.9, T: false, bars: 1, surround: 0, frame: '#f1f0ec', glass: '#55667a' }, attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' } },
};

// Riia 24: light grey piers and tall dark window strips to Riia, ribbon windows round the sides, shops below
function r24(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#bdbcb7'); P.weather(0, P.y0, len, P.y1, 0.4, 3);
  P.r(0, top - 0.6, len, top, '#a9a8a3');
  const front = dot(W, NW) > 0.9 && len > 25;
  // the shops: dark frames, glass, a dark fascia with the names
  P.r(0, P.y0, len, 4.1, '#3a3c41');
  for (let x = 0.6; x < len - 0.6; x += 3.1) { P.r(x, 0.25, x + 2.9, 3.25, '#2a2c30'); P.grad(x + 0.07, 0.3, x + 2.83, 3.2, '#5e7182', '#2f3b47'); }
  if (front) {
    P.r(0, 3.35, len, 4.1, '#2d2f33');
    [['PLASTO', 0.18, '#e2231a'], ['AKNAD', 0.34, '#ffffff'], ['PLASTO', 0.5, '#e2231a'], ['UKSED', 0.64, '#ffffff']].forEach(([t, f, c]) => P.text(t, len * f, 3.72, 0.5, c, SANS));
    P.r(len - 7.5, 3.3, len - 0.4, 4.15, '#1d4f9e'); P.text('STANDARD', len - 3.95, 3.72, 0.55, '#ffffff', SANS);
    // the piers and the window strips over three floors, the top floor in a band of its own
    for (let x = 1.0; x < len - 2.5; x += 3.0) {
      P.r(x + 0.75, 4.5, x + 2.65, top - 3.6, '#2c3138');
      for (let y = 4.5; y < top - 3.7; y += 3.3) { P.grad(x + 0.85, y + 0.9, x + 2.55, y + 2.9, '#7a8c9c', '#3d4b58'); P.r(x + 1.68, y + 0.9, x + 1.72, y + 2.9, '#1f2226'); P.r(x + 0.75, y + 0.7, x + 2.65, y + 0.85, '#8d8f92'); }
      P.win(x + 0.9, top - 3.0, x + 2.5, top - 1.4, { frame: '#e9e9e6', glass: '#55667a', fw: 0.06, bars: 1, T: false, sill: 0.05, surround: 0 });
    }
    // OVERALL down a tall dark panel, a coloured flag on the north-east corner
    const ox = len * 0.78;
    P.r(ox, 6.0, ox + 1.1, top - 2.2, '#1f2024');
    P.text('OVERALL', ox + 0.55, (6.0 + top - 2.2) / 2, 0.8, '#f2f2f2', SANS, 'center', -Math.PI / 2);
    P.r(2.0, 7.0, 2.6, 13.5, '#d2a23a'); P.r(2.0, 9.0, 2.6, 11.0, '#3f7cc2'); P.r(2.0, 11.0, 2.6, 12.4, '#c2453f');
    return;
  }
  for (let y = 4.6; y < top - 2.0; y += 3.3) {
    P.r(0.6, y + 0.8, len - 0.6, y + 2.5, '#3b434c');
    for (let x = 0.6; x < len - 0.6; x += 1.5) { P.grad(x + 0.06, y + 0.86, x + 1.44, y + 2.44, '#768899', '#3e4b57'); }
  }
}

// Riia 24A: a pale four-storey office block; windows in plain rows painted straight (its map wall is uneven at the top)
function r24a(P, W) {
  const len = W.len, top = W.eaves > 6 ? W.eaves : W.peak - 0.6;
  P.r(0, P.y0, len, P.y1, '#dad3c4'); P.weather(0, P.y0, len, P.y1, 0.35, 11);
  P.r(0, P.y0, len, 0.6, '#8e8a84');
  const nf = Math.max(1, Math.min(4, Math.round((top - 0.8) / 3.2))), sh = (top - 0.8) / nf;
  const n = Math.max(1, Math.round((len - 0.6) / 2.9));
  for (let f = 0; f < nf; f++) for (let k = 0; k < n; k++) {
    const x = (k + 0.5) * len / n, y = 0.6 + f * sh + 0.9;
    P.win(x - 0.75, y, x + 0.75, y + Math.min(1.6, sh - 1.2), { frame: '#f1f0ec', glass: '#55667a', bars: 1, T: false, sill: 0.06, surround: 0 });
  }
}

// Pauluse church: red brick, tall arched windows, a granite plinth; the tower's long slit windows
function kirik(P, W) {
  const len = W.len, top = W.peak;
  P.brick(0, P.y0, len, P.y1, [160, 94, 70], Math.round(W.mid[0]));
  P.weather(0, P.y0, len, P.y1, 0.35, 5);
  P.r(0, P.y0, len, 0.9, '#8e8a86'); P.r(0, 0.9, len, 1.0, '#7b7672');
  const arch = (x0, y0, x1, y1, glass = '#3c4652') => {
    const r = (x1 - x0) / 2;
    P.r(x0 - 0.15, y0 - 0.15, x1 + 0.15, y1, '#b9765c'); P.arc((x0 + x1) / 2, y1, r + 0.15, '#b9765c', Math.PI, Math.PI * 2);
    P.r(x0, y0, x1, y1, glass); P.arc((x0 + x1) / 2, y1, r, glass, Math.PI, Math.PI * 2);
    P.r((x0 + x1) / 2 - 0.03, y0, (x0 + x1) / 2 + 0.03, y1 + r, '#6d4a3c');
    for (let y = y0 + 0.6; y < y1; y += 0.6) P.r(x0, y - 0.02, x1, y + 0.02, '#6d4a3c');
  };
  if (top > 22 && len < 14) {                                            // the tower
    for (const f of [0.3, 0.7]) { const x = len * f; P.r(x - 0.35, 3.0, x + 0.35, top - 6, '#6e3526'); P.r(x - 0.2, 3.2, x + 0.2, top - 6.2, '#2f343b'); }
    for (const f of [0.3, 0.7]) arch(len * f - 0.55, top - 4.6, len * f + 0.55, top - 2.6, '#1e2126');
    P.r(0, top - 1.1, len, top - 0.8, '#7a3a2a');
    return;
  }
  if (len < 4) return;
  const n = Math.max(1, Math.floor((len - 2) / 3.4)), pitch = (len - 2) / n;
  const tall = Math.min(top - 2.5, 7.5);
  for (let k = 0; k < n; k++) {
    const x = 1 + pitch * (k + 0.5);
    if (tall > 4) arch(x - 0.6, 2.2, x + 0.6, tall - 0.7);
    else arch(x - 0.45, 1.6, x + 0.45, Math.max(2.4, top - 1.2));
    if (top > 11 && tall > 4) P.arc(x, Math.min(top - 1.6, tall + 1.7), 0.45, '#3c4652');
  }
  P.r(0, Math.min(top, tall + 0.4), len, Math.min(top, tall + 0.6), '#b07055');
}

// the Riia Kvartal towers the map does have: dark board walls with tall narrow windows; the stepped one in brick
function kvDark(P, W, brick = false) {
  const len = W.len, top = W.peak;
  if (brick) P.brick(0, P.y0, len, P.y1, [140, 64, 46], 7); else P.boards(0, P.y0, len, P.y1, [44, 44, 48], 0.12, true);
  for (let y = 0.6, k = 0; y < top - 2.4; y += 3.0, k++) {
    for (let x = 0.9 + (k % 2) * 0.7; x < len - 1.2; x += 2.6) {
      if (brick) { P.r(x - 0.3, y + 0.1, x + 1.9, y + 2.4, '#2b2d31'); P.grad(x - 0.2, y + 0.2, x + 1.8, y + 2.3, '#73879a', '#34414d'); P.r(x - 0.5, y + 1.1, x + 2.1, y + 1.18, '#202124'); }
      else { P.r(x - 0.06, y + 0.3, x + 0.96, y + 2.5, '#18191b'); P.grad(x, y + 0.36, x + 0.9, y + 2.44, '#7c8fa1', '#38454f'); }
    }
  }
}

const PAINT = { r24, r24a, kirik, kv22a: (P, W) => kvDark(P, W), kvb: (P, W) => kvDark(P, W, true) };

// ---------------------------------------------------------------- Riia Kvartal's new fronts (cells)
function kvCells(CK) {
  // the corner tower's brick front: shops and banners below, five floors of balcony doors over them
  CK.cell('f22', T22.s1 - T22.s0, 0, T22.top, '#8e4430', (P, w) => {
    P.brick(0, 0, w, T22.top, [142, 66, 46], 22);
    P.r(0, 0, w, 4.0, '#2b2c30');
    for (let x = 0.5; x < w - 0.5; x += 3.6) { P.r(x, 0.1, x + 3.4, 3.2, '#202124'); P.grad(x + 0.08, 0.15, x + 3.32, 3.12, '#647889', '#2c3843'); }
    P.r(0.4, 3.3, 3.3, 3.95, '#3a4fa3'); P.text('riiakvartal.ee', 1.85, 3.62, 0.36, '#ffffff', SANS);
    P.r(3.5, 3.3, 6.4, 3.95, '#3a4fa3'); P.text('viimased', 4.95, 3.62, 0.38, '#ffffff', SANS);
    P.r(6.6, 3.3, 9.6, 3.95, '#d4504a'); P.text('korterid', 8.1, 3.62, 0.42, '#ffffff', SANS);
    P.r(10.2, 3.25, w - 0.6, 4.0, '#d4504a'); P.text('riiakvartal.ee', (10.2 + w - 0.6) / 2, 3.62, 0.55, '#ffffff', SANS);
    for (let y = 4.0; y < T22.top - 2.5; y += 3.0) {
      for (let x = 0.7; x < w - 1.2; x += 2.35) { P.r(x, y + 0.25, x + 1.85, y + 2.65, '#1e1f22'); P.grad(x + 0.07, y + 0.3, x + 1.78, y + 2.6, '#7b8da0', '#36434e'); P.r(x + 0.9, y + 0.3, x + 0.95, y + 2.6, '#1e1f22'); }
    }
    P.r(0, T22.top - 0.6, w, T22.top, '#2a2a2d');
  }, 26);
  // a bay of the dark board walls: one tall narrow window a floor
  CK.cell('dk', 3.0, 0, T22.top, '#2c2c30', (P, w) => {
    P.boards(0, 0, w, T22.top, [44, 44, 48], 0.12, true);
    P.r(0, 0, w, 0.5, '#202024');
    for (let y = 4.0; y < T22.top - 2.5; y += 3.0) { P.r(1.0, y + 0.3, 2.0, y + 2.6, '#151618'); P.grad(1.06, y + 0.36, 1.94, y + 2.54, '#7c8fa1', '#38454f'); }
    P.r(0.7, 0.3, 2.3, 3.4, '#151618'); P.grad(0.78, 0.38, 2.22, 3.32, '#62778a', '#2c3843');
    P.r(0, T22.top - 0.6, w, T22.top, '#232326');
  }, 26);
  // the gabled block: near-black ribbed cladding to the road (Street View), rows of tall narrow windows, glass doors below
  CK.cell('g20f', G20.s1 - G20.s0, 0, G20.eaves, '#303135', (P, w) => {
    P.boards(0, 0, w, G20.eaves, [48, 49, 53], 0.1, true);
    P.r(0, 0, w, 0.5, '#3a3b3e');
    for (let x = 1.2; x < w - 1; x += 2.8) {
      for (let y = 3.7; y < G20.eaves - 1.8; y += 2.95) { P.r(x, y + 0.2, x + 1.0, y + 2.2, '#1b1c1f'); P.grad(x + 0.06, y + 0.26, x + 0.94, y + 2.14, '#7b8ea0', '#38454f'); }
      if (x % 8.4 < 2.8) { P.r(x - 0.3, 0.5, x + 1.3, 3.0, '#1b1c1f'); P.grad(x - 0.22, 0.56, x + 1.22, 2.94, '#5f7385', '#2a3540'); }
      else { P.r(x, 0.9, x + 1.0, 2.9, '#1b1c1f'); P.grad(x + 0.06, 0.96, x + 0.94, 2.84, '#6f8293', '#33404b'); }
    }
  }, 22);
  // its back to the courtyard: dark walls, stacked timber balconies
  CK.cell('g20b', G20.s1 - G20.s0, 0, G20.eaves, '#2f3033', (P, w) => {
    P.boards(0, 0, w, G20.eaves, [48, 49, 52], 0.12, true);
    for (let x = 0.8; x < w - 2; x += 4.2) {
      for (let y = 0.4; y < G20.eaves - 2; y += 2.95) {
        P.r(x, y + 0.1, x + 3.4, y + 2.5, '#a3673c');
        for (let b = x + 0.1; b < x + 3.4; b += 0.16) P.r(b, y + 0.1, b + 0.06, y + 2.5, '#8a5430');
        P.r(x + 0.6, y + 0.3, x + 2.8, y + 2.3, '#3a4752');
      }
    }
  }, 22);
  CK.cell('g20e', G20.vf - G20.vb, 0, G20.ridge, '#2f3033', (P, w) => {
    P.boards(0, 0, w, G20.ridge, [52, 53, 56], 0.12, true);
    for (let y = 3.7; y < G20.eaves - 1.8; y += 2.95) for (const x of [2.5, w - 3.5]) { P.r(x, y + 0.2, x + 1.0, y + 2.2, '#1b1c1f'); P.grad(x + 0.06, y + 0.26, x + 0.94, y + 2.14, '#7b8ea0', '#38454f'); }
  }, 22);
}

// map points of the corner tower's outline, outside on the right going round
function towerOutline() {
  const pts = [[T22.s0, T22.vf], [T22.s1, T22.vf], [T22.s1, T22.vr]];
  const cs = (T22.s0 + T22.s1) / 2;
  for (let k = 1; k < 12; k++) { const a = k / 12 * Math.PI; pts.push([cs + Math.cos(a) * T22.r, T22.vr - Math.sin(a) * T22.r]); }
  pts.push([T22.s0, T22.vr]);
  return pts.map(([s, v]) => L(s, v));
}

// steel railing bars on a shared see-through texture; returns add(a, b, y0, height) and finish()
export function railings(group, col = '#1d1e21') {
  const tex = paintTexture(1, 0, 1, 64, (P) => {
    P.r(0, 0.92, 1, 1, col); P.r(0, 0, 1, 0.06, col);
    for (let x = 0.02; x < 1; x += 0.125) P.r(x, 0, x + 0.025, 1, col);
  }, { repeat: true, alpha: true });
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const pos = [], uv = [];
  return {
    add(a, b, y0a, y0b, hh) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const q = [[a[0], y0a, a[1], 0, 0], [b[0], y0b, b[1], len, 0], [b[0], y0b + hh, b[1], len, 1], [a[0], y0a + hh, a[1], 0, 1]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4]); }
    },
    finish() {
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })));
    },
  };
}

// the cars in the old ambulance station's yard and along the lane by the tower
const yawTo = (d) => Math.atan2(d[0], -d[1]);
export const RIIA2_CARS = [];
{
  const ids = ['rav4', 'passat', 'mazda6', 'ceedsw', 'passat', 'rav4', 'mazda6', 'model3', 'passat', 'rav4', 'mazda6', 'passat'];
  const paints = ['red', 'silver', 'black', 'white', 'grey', 'black', 'silver', 'white', 'red', 'grey', 'black', 'silver'];
  let k = 0;
  for (let s = 66; s <= 98; s += 2.9) { RIIA2_CARS.push([...L(s, -15.6), yawTo(NW), ids[k % 12], paints[k % 12], 0.03]); k++; }
}

export function createRiia2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addClearing({ test: inNew });
  let built = false;
  const CENTRE = L(190, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    // ---- the map's blocks with painted walls
    const faces = (W) => W.foot < 2 && W.len > 6;
    const houses = HOUSES.map(([name, S, base, at, r]) => {
      const H = { name, sec: S[0], base, at, r, spec: SPEC[name] || { wall: [200, 200, 200], floors: [], attic: null, eaves: false } };
      if (PAINT[name]) H.walls = [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }];
      return H;
    });
    skinHouses(world, group, houses, { shadows, ppm: 14, far: 6, faces, debug: DEBUG });

    // ---- Riia Kvartal: the gabled block and the corner tower
    const CK = cellKit(group, { shadows });
    kvCells(CK);
    const R = railings(group);
    {
      const g = h(...L((G20.s0 + G20.s1) / 2, (G20.vf + G20.vb) / 2)) - 0.3;
      const a = L(G20.s0, G20.vf), b = L(G20.s1, G20.vf), c = L(G20.s1, G20.vb), d = L(G20.s0, G20.vb);
      CK.put(a, b, g, 'g20f');
      CK.put(c, d, g, 'g20b');
      const gable = [[0, 0], [G20.vf - G20.vb, 0], [G20.vf - G20.vb, G20.eaves], [(G20.vf - G20.vb) / 2, G20.ridge], [0, G20.eaves]];
      CK.put(b, c, g, 'g20e', gable);
      CK.put(d, a, g, 'g20e', gable);
      // the roof: two slopes with 0.4 m eaves, the solar collectors along the ridge
      const vm = (G20.vf + G20.vb) / 2, o = 0.45, Y = (q) => g + q;
      const P3 = (s, v, y) => { const [x, z] = L(s, v); return [x, Y(y), z]; };
      const slope = (v0) => [P3(G20.s0 - o, v0, G20.eaves - 0.3), P3(G20.s1 + o, v0, G20.eaves - 0.3), P3(G20.s1 + o, vm, G20.ridge), P3(G20.s0 - o, vm, G20.ridge)];
      const pos = [];
      for (const q of [slope(G20.vf + o), slope(G20.vb - o)]) for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...q[k]);
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const rm = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0x3d3e42, side: THREE.DoubleSide }));
      rg.computeVertexNormals(); rm.castShadow = shadows; rm.receiveShadow = true; group.add(rm);
      const [cx, cz] = L((G20.s0 + G20.s1) / 2, vm + 2.2);
      p.add(BOX(G20.s1 - G20.s0 - 6, 0.25, 1.4).rotateX(-0.55), 0xe8e8e6, cx, g + G20.ridge - 1.0, cz, RIIA2.YAW);
    }
    {
      const g = h(...L((T22.s0 + T22.s1) / 2, -25)) - 0.3;
      const pts = towerOutline();
      CK.put(pts[0], pts[1], g, 'f22');
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        // long sides in bays of 3 m, the round end one bay per piece
        const n = Math.max(1, Math.round(len / 3.0));
        for (let k = 0; k < n; k++) CK.put([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n], g, 'dk');
      }
      // the flat roof with its plant boxes
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const rg = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, g + T22.top, 0);
      p.add(rg, 0x47484c, 0, 0, 0);
      for (const [s, v, w, d] of [[165, -22, 5, 3], [173, -30, 3, 6]]) { const [x, z] = L(s, v); p.box(w, 1.4, d, 0xb9babd, x, g + T22.top + 0.7, z, RIIA2.YAW); }
      // the balconies on the brick front: slabs and railings, floors 2 to 5
      for (let y = 7.0; y <= 16.0; y += 3.0) {
        const [x, z] = L((T22.s0 + T22.s1) / 2, T22.vf + 0.8);
        p.box(T22.s1 - T22.s0 - 1.4, 0.2, 1.6, 0x2a2a2d, x, g + y - 0.1, z, RIIA2.YAW);
        R.add(L(T22.s0 + 0.7, T22.vf + 1.58), L(T22.s1 - 0.7, T22.vf + 1.58), g + y, g + y, 1.05);
      }
      // the house number by the door on the lane
      const [nx, nz] = L(T22.s1 + 0.05, -16);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshLambertMaterial({ map: paintTexture(0.9, 0, 0.3, 120, (P) => { P.r(0, 0, 0.9, 0.3, '#1f2023'); P.text('RIIA 22', 0.45, 0.15, 0.17, '#f2f2f2', SANS); }) }));
      plate.position.set(nx, g + 3.0, nz); plate.rotation.y = Math.atan2(SW[0], SW[1]); group.add(plate);
    }
    // ---- Pauluse church: the copper spire the map leaves off the tower, with its cross
    {
      const top = 54.1, c = [1077.1, 3800.6];
      p.add(new THREE.ConeGeometry(4.7, 12.5, 4, 1).rotateY(Math.PI / 4), 0x4f6e64, c[0], top + 6.25, c[1], RIIA2.YAW);
      p.box(6.8, 0.35, 6.8, 0x7a3a2a, c[0], top + 0.15, c[1], RIIA2.YAW);
      p.box(0.12, 2.0, 0.12, 0x3a3b3d, c[0], top + 13.4, c[1]);
      p.box(0.9, 0.12, 0.12, 0x3a3b3d, c[0], top + 13.8, c[1], RIIA2.YAW);
    }
    // the black steel railing along the church's pavement
    for (let s = 268; s < 342; s += 6) R.add(L(s, 12.6), L(s + 6, 12.6), h(...L(s, 12.6)) - 0.02, h(...L(s + 6, 12.6)) - 0.02, 1.2);
    R.finish();
    CK.finish();
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(0, 0), L(170, -40), L(330, 30), L(250, -20)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
