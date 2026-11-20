// Riia tänav, batch 4 of the "riiastrip" kaardista (Martin, 20 Nov): from Väike kaar to Suur kaar, Riia 50 to 77.
// Street View reaches four spots here (the shots "65 Riia", "72 Riia", Selver ABC and "81 Riia"); the rest is the
// regular pass from the Land Board's oblique air photos of 2024.
//  - Ümera Selver ABC (Riia 79), built new: the tall brick hall with its light bands and grey door, the low pink shop
//    front with its red skirting, window posters and the red SELVER ABC sign, the entrance and steps at the
//    Suur kaar end, the brick sign tower, the dark flat roofs, the brick paved forecourt.
//  - Riia 65: the white board house behind its white masonry pillar fence with dark bars; the pillar fence with grey
//    panels across the road at Riia 52-54 (both in the "65 Riia" shot).
//  - Riia 72: the brown-grey two storey house, its door and stair window, the clipped hedge along the pavement.
//  - The street's oaks: a row in the south-east verge from Väike kaar towards Kesk kaar and on the north-west side
//    from Ludvig Puusepa to Selver, where the map had a few spruces.
//  - The other houses in their colours and roofs from the air photos.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, cellKit } from './handbuilt.js';
import { RIIA2 } from './riia2.js';

const DEBUG = typeof location !== 'undefined' && /riia5debug/.test(location.search);
const S27 = ['2_7', 480, 3680], S28 = ['2_8', 480, 4320], S18 = ['1_8', -160, 4320];
const L = RIIA2.at, sv = RIIA2.sv, U = RIIA2.U;
const SANS = '700 %px Arial, sans-serif';
const rect = (s0, s1, v0, v1) => (x, z) => { const [s, v] = sv(x, z); return s > s0 && s < s1 && v > v0 && v < v1; };
const lerpTab = (tab) => (s) => {
  if (s <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (s <= tab[i][0]) { const [a, va] = tab[i - 1], [b, vb] = tab[i]; return va + (vb - va) * (s - a) / (b - a); }
  return tab[tab.length - 1][1];
};
// the carriageway's centre (v) along s, from the map's road line, and the south-east cycle path's centre
const CEN = lerpTab([[940, -0.4], [976, -0.5], [1157, -2.4], [1203, -3.2], [1235, -3.6], [1387, -4.0], [1405, -4.3]]);
const PATH = lerpTab([[958, -13.6], [986, -14.2], [1156, -14.4], [1180, -15.9], [1237, -16.1], [1405, -15.9]]);
const HALF = 7.3;

const win = (o = {}) => ({ w: 1.2, pitch: 2.7, T: false, bars: 1, surround: 0.1, sc: '#ebe6da', frame: '#f4f2ec', glass: '#55667a', ...o });
const plaster = (wall, floors, o = {}) => ({ kind: 'plaster', wall, trim: '#efebe2', storey: 3.0, maxFloors: floors, weather: 0.4,
  win: win(o.win), attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' }, ...o.spec });
const boards = (wall, floors, o = {}) => ({ kind: 'boards', wall, pitch: 0.16, trim: '#f1ece0', storey: 3.0, maxFloors: floors, weather: 0.35,
  win: win({ w: 1.1, pitch: 2.6, T: true, surround: 0.12, sc: '#f1ece0', ...o.win }), attic: null, plinth: { h: 0.7, type: 'plaster', col: '#8a857f' }, ...o.spec });
const brick = (wall, floors, o = {}) => ({ kind: 'brick', wall, trim: '#e6e0d4', storey: 3.0, maxFloors: floors, weather: 0.3,
  win: win({ surround: 0, ...o.win }), attic: null, plinth: { h: 0.6, type: 'plaster', col: '#7f7b76' }, ...o.spec });

// [name, sector, base, at, reach, wall, roof, pick, spec, walls]
const HOUSES = [
  // south-east side, Väike kaar to Suur kaar
  ['r50', S27, 3439, L(964, -30), 14, 0xd6c8aa, 0x7d7468, rect(955, 973, -40, -22), plaster([214, 200, 170], 3)],
  ['r52', S27, 3474, L(1019, -35), 16, 0xc8aa6e, 0x8a4e36, rect(995, 1024, -43, -22), plaster([200, 170, 110], 2)],
  ['r54', S28, 3484, L(1038, -30), 14, 0x96705a, 0x7a4a3c, rect(1028, 1050, -46, -22), plaster([150, 112, 90], 2)],
  ['r56', S28, 3547, L(1072, -31), 14, 0xe2c4b4, 0xc06a58, rect(1056, 1090, -42, -22), plaster([226, 196, 180], 2)],
  ['r58', S28, 3566, L(1106, -32), 14, 0xd6aaa0, 0x2c2e33, rect(1095, 1118, -40, -24), plaster([214, 170, 160], 2)],
  ['r60', S18, 3575, L(1139, -33), 16, 0x8c503c, 0x5d6f86, rect(1126, 1153, -40, -24), brick([140, 80, 60], 3)],
  ['r62', S18, 3618, L(1170, -32), 12, 0xd0ccc4, 0x6e7277, rect(1161, 1179, -39, -24), plaster([208, 204, 196], 3)],
  ['r64', S18, 3617, L(1217, -32), 12, 0xeceae4, 0x5f6f80, rect(1208, 1227, -39, -24), plaster([236, 234, 228], 3)],
  ['r66', S18, 3684, L(1254, -38), 12, 0xe0d4aa, 0x8a8e94, rect(1245, 1262, -50, -24), plaster([224, 212, 170], 3)],
  ['r68', S18, 3683, L(1268, -31), 12, 0xa8b2ba, 0x6e7277, rect(1259, 1286, -40, -24), plaster([168, 178, 186], 3)],
  ['r70', S18, 3713, L(1290, -32), 8, 0xe4e0d8, 0x8a8e94, rect(1283, 1297, -41, -24), plaster([228, 224, 216], 2)],
  ['r72', S18, 3724, L(1303, -32), 9, 0x968a78, 0x5f5a55, rect(1297, 1310, -41, -24), plaster([150, 138, 120], 2, {
    win: { w: 1.3, surround: 0, frame: '#f2f1ee', glass: '#4d5a68', bars: 1 }, spec: { storey: 3.1, plinth: { h: 0.5, type: 'plaster', col: '#6e6862' } } }),
  [{ near: L(1303, -27), within: 3, doors: [{ x: 5.0, w: 1.2, h: 2.2, col: '#7a4a2e', steps: 2 }] }]],
  ['r74', S18, 3713, L(1324, -32), 16, 0xeae8e2, 0xa5463a, rect(1310, 1340, -41, -24), plaster([234, 232, 226], 2)],
  ['r76', S18, 3718, L(1362, -32), 14, 0x96543e, 0xa5463a, rect(1352, 1374, -48, -24), brick([150, 84, 62], 2)],
  // north-west side
  ['r61', S27, 3260, L(960, 21), 14, 0xc8c0b0, 0x4f6680, rect(950, 971, 12, 30), plaster([200, 192, 176], 3)],
  ['r63', S27, 3334, L(1004, 20), 12, 0xa05a3c, 0x3f3c3c, rect(994, 1013, 12, 26), plaster([160, 90, 60], 3)],
  ['r65', S27, 3309, L(1037, 21), 16, 0xeeece6, 0x55595e, rect(1023, 1052, 12, 31), boards([236, 234, 228], 3, { win: { frame: '#ffffff', sc: '#ffffff' } })],
  ['r67', S27, 3298, L(1025, 41), 10, 0xd8cebb, 0x7a7e84, null, plaster([216, 206, 187], 3)],
  ['r69', S27, 3402, L(1072, 19), 14, 0x606264, 0x2c2d30, rect(1061, 1083, 12, 30), boards([96, 98, 100], 3, { win: { frame: '#e8e8e4', sc: '#e8e8e4' } })],
  ['r71', S18, 3278, L(1105, 21), 12, 0xdeaa96, 0xa5463a, rect(1096, 1113, 12, 31), plaster([222, 170, 150], 3)],
  ['r73', S18, 3409, L(1138, 19), 14, 0xe8e6e0, 0x8a4a3a, rect(1129, 1150, 12, 29), plaster([232, 230, 224], 3)],
  ['r75', S18, 3665, L(1292, 19), 14, 0x96543e, 0x4a4a4c, rect(1279, 1305, 10, 28), brick([150, 84, 62], 3)],
  ['r77', S18, 3674, L(1329, 18), 14, 0x96604a, 0x5a4a44, rect(1315, 1343, 10, 25), brick([150, 96, 74], 3)],
];
const SECTORS = [S27, S28, S18];

// Selver ABC (Riia 79): the tall hall and the low shop front, s along the street, v from the street front back
const TB = { s0: 1344, s1: 1359, v0: 14, v1: 35, top: 9.0 };
const LF = { s0: 1357, s1: 1374, v0: 11.2, v1: 33, top: 4.4 };

export function riia5Walls(walls) {
  for (const S of SECTORS) {
    const list = HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r }));
    if (S === S18) list.push({ base: 3592, x: L(1359, 23)[0], z: L(1359, 23)[1], hide: true, reach: 30 });   // the map's Selver box
    setHouseColours(walls, S[0], S[1], S[2], list);
  }
}

// ---- Selver's faces. Text reads left to right as seen from outside.
function selverCells(CK) {
  const BR = [132, 86, 76];
  const brickRows = (P, w, y0, y1, seed) => {
    let r = seed;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let y = y0; y < y1; y += 0.15) {
      for (let x = (Math.round(y / 0.15) % 2) * 0.2; x < w; x += 0.4) {
        const k = 0.88 + rnd() * 0.22;
        P.r(x + 0.02, y + 0.02, Math.min(w, x + 0.38), y + 0.13, `rgb(${BR.map((c) => Math.round(c * k)).join(',')})`);
      }
    }
  };
  // the tall hall's street face: brick, three light bands up top, one at the shop roof's height, the grey door at the NE end
  CK.cell('stb', TB.s1 - TB.s0, 0, TB.top + 0.5, '#6e463c', (P, w) => {
    brickRows(P, w, 0, TB.top + 0.5, 7);
    for (const y of [6.4, 7.0, 7.6]) P.r(0, y, w, y + 0.2, '#c9c3b8');
    P.r(0, 3.6, w, 3.8, '#b8b2a8');
    P.r(0, TB.top + 0.25, w, TB.top + 0.5, '#2e2f33');
    P.grad(w - 2.6, 0, w - 0.5, 3.4, '#a7b2bc', '#7f8a94');
    for (let x = w - 2.5; x < w - 0.6; x += 0.18) P.r(x, 0, x + 0.04, 3.4, '#6e7882');
    P.r(0, 0, w, 0.35, '#5c524c');
  }, 16);
  // the tall hall's other faces: plain brick with the bands, put in bays
  CK.cell('sbr', 5, 0, TB.top + 0.5, '#6e463c', (P, w) => {
    brickRows(P, w, 0, TB.top + 0.5, 11);
    for (const y of [6.4, 7.0, 7.6]) P.r(0, y, w, y + 0.2, '#c9c3b8');
    P.r(0, TB.top + 0.25, w, TB.top + 0.5, '#2e2f33');
  }, 16);
  // the low shop front on the street: pink render, red ribbed skirting, four windows with posters, the sign at the SW end
  CK.cell('slf', LF.s1 - LF.s0, 0, LF.top, '#c39182', (P, w) => {
    P.grad(0, 0.7, w, LF.top, '#c99a8a', '#b98676');
    P.r(0, 0, w, 0.75, '#8e4436');
    for (let x = 0.1; x < w; x += 0.22) P.r(x, 0.04, x + 0.08, 0.72, '#a3523f');
    P.r(0, LF.top - 0.5, w, LF.top, '#a87666');
    // the sign: red box with SELVER and the small ABC
    P.r(0.3, 2.3, 3.5, 3.5, '#d4202a');
    P.text('SELVER', 1.75, 2.9, 0.62, '#ffffff', '900 %px Arial Black, Arial, sans-serif');
    P.r(3.0, 3.18, 3.45, 3.45, '#ffffff'); P.text('ABC', 3.22, 3.31, 0.16, '#d4202a', SANS);
    const posters = [['#d9473a', '#f1c23f'], ['#2f6db3', '#e8e2d6'], ['#3a8c4a', '#f3e9d2'], ['#7b2f86', '#f3c6d8']];
    [4.6, 7.6, 10.6, 13.6].forEach((x, k) => {
      P.r(x - 0.1, 1.0, x + 2.0, 3.0, '#ece6dc');
      P.grad(x, 1.1, x + 1.9, 2.9, posters[k][0], '#2a2c33');
      P.r(x + 0.25, 1.5, x + 1.65, 2.6, posters[k][1]);
      P.r(x + 0.4, 1.7, x + 1.5, 2.0, posters[k][0]);
    });
  }, 24);
  // the low front's SW end at Suur kaar: a window, the glass entrance with its red frame, a wide window
  CK.cell('sle', LF.v1 - LF.v0, 0, LF.top, '#c39182', (P, w) => {
    P.grad(0, 0.6, w, LF.top, '#c99a8a', '#b98676');
    P.r(0, 0, w, 0.6, '#8e4436');
    P.r(0, LF.top - 0.5, w, LF.top, '#a87666');
    P.win(2.0, 1.4, 3.6, 2.8, { frame: '#e9e6e0', glass: '#4d5a68', bars: 1, sill: 0.06 });
    P.r(w - 9.6, 0.6, w - 6.4, 3.3, '#a52a2a');
    P.grad(w - 9.4, 0.65, w - 8.05, 3.1, '#4f6070', '#2f3a46'); P.grad(w - 7.95, 0.65, w - 6.6, 3.1, '#4f6070', '#2f3a46');
    P.r(w - 9.8, 3.4, w - 6.2, 3.85, '#d4202a'); P.text('SELVER', w - 8.0, 3.62, 0.3, '#ffffff', '900 %px Arial Black, Arial, sans-serif');
    P.win(w - 5.4, 1.0, w - 2.4, 2.9, { frame: '#e9e6e0', glass: '#4d5a68', bars: 2, sill: 0.06 });
  }, 24);
  // the low front's back and NE end: plain render
  CK.cell('slp', 6, 0, LF.top, '#c39182', (P, w) => {
    P.grad(0, 0.6, w, LF.top, '#c49585', '#b48272');
    P.r(0, 0, w, 0.6, '#7e7470');
    P.r(0, LF.top - 0.5, w, LF.top, '#a87666');
  }, 12);
  // the sign tower's red panel
  CK.cell('ssg', 1.5, 0, 1.3, '#d4202a', (P, w) => {
    P.r(0, 0, w, 1.3, '#d4202a');
    P.text('SELVER', w / 2, 0.72, 0.36, '#ffffff', '900 %px Arial Black, Arial, sans-serif');
    P.r(w - 0.42, 0.12, w - 0.08, 0.36, '#ffffff'); P.text('ABC', w - 0.25, 0.24, 0.13, '#d4202a', SANS);
  }, 60);
}

export function createRiia5(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- the oaks: the map's verge trees (mostly spruces) out, the rows the street photos show in
  const sideNW = (s) => CEN(s) + HALF, sideSE = (s) => CEN(s) - HALF;
  world.addClearing({ test: (x, z) => {
    const [s, v] = sv(x, z);
    if (s < 940 || s > 1420) return false;
    if (v < 0) return v > PATH(s) + 1.8 && v < sideSE(s) + 0.5;                                   // SE verge
    return (s > 1160 && s < 1345 && v > sideNW(s) - 0.5 && v < sideNW(s) + 6) ||                  // NW verge
      (s > 1018 && s < 1058 && v > 9 && v < 14.5) ||                                              // before Riia 65's fence
      (s > 1336 && s < 1380 && v > 2 && v < 36);                                                  // Selver and its forecourt
  } });
  const gaps = [[978, 994], [1150, 1165], [1226, 1246], [1288, 1340], [1392, 1420]];             // side streets, crossings, Riia 72's hedge
  const gapsNW = [[1192, 1230]];
  const oaks = [];
  let k = 0;
  for (let s = 946; s < 1392; s += 12.5, k++) {
    if (gaps.some(([a, b]) => s > a && s < b)) continue;
    const v = (sideSE(s) + PATH(s) + 1.8) / 2;
    const [x, z] = L(s + ((k * 37) % 5) * 0.3 - 0.6, v);
    oaks.push([x, z, 15.5 + ((k * 7) % 5) * 0.9, 7.4 + ((k * 3) % 4) * 0.5, 0]);
  }
  for (let s = 1166; s < 1336; s += 13.5, k++) {
    if (gapsNW.some(([a, b]) => s > a && s < b)) continue;
    const [x, z] = L(s + ((k * 13) % 5) * 0.3 - 0.6, sideNW(s) + 2.6);
    oaks.push([x, z, 16 + ((k * 5) % 4) * 1.0, 7.8 + ((k * 3) % 3) * 0.5, 0]);
  }
  world.addTrees(oaks);

  // Selver is solid
  {
    const box = (s0, s1, v0, v1) => { const [x, z] = L((s0 + s1) / 2, (v0 + v1) / 2); return { x, z, yaw: Math.atan2(-U[1], U[0]), hx: (s1 - s0) / 2, hz: (v1 - v0) / 2 }; };
    world.addSolids([box(TB.s0, TB.s1, TB.v0, TB.v1), box(LF.s0, LF.s1, LF.v0, LF.v1), box(1356.6, 1358.2, 10.3, 11.3)]);
  }

  let built = false;
  const CENTRE = L(1180, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const faces = (W) => W.foot < 2 && W.len > 5;
    const houses = HOUSES.map(([name, S, base, at, r, , , pick, spec, walls]) => ({ name, sec: S[0], base, at, r, pick: pick || undefined, spec, walls }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 6, faces, debug: DEBUG });

    // ---- Selver ABC
    const CK = cellKit(group, { shadows });
    selverCells(CK);
    const g = h(...L(1362, 12)) - 0.15;
    {
      // the tall hall: street face, the SW end above the shop roof, the back and the NE end in bays
      CK.put(L(TB.s1, TB.v0), L(TB.s0, TB.v0), g, 'stb');
      const bays = (a, b, key, y1) => {
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
        for (let i = 0; i < n; i++) {
          const q0 = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n], q1 = [a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n];
          CK.put(q0, q1, g, key, y1 ? [[0, 0], [5, 0], [5, y1], [0, y1]] : null);
        }
      };
      bays(L(TB.s1, TB.v1), L(TB.s1, TB.v0), 'sbr');                          // SW end (the shop's roof hides the lower part)
      bays(L(TB.s0, TB.v1), L(TB.s1, TB.v1), 'sbr');                          // back
      bays(L(TB.s0, TB.v0), L(TB.s0, TB.v1), 'sbr');                          // NE end
      // the hall's flat roof and its dark parapet cap
      A.box(RIIA2, (TB.s0 + TB.s1) / 2, (TB.v0 + TB.v1) / 2, TB.s1 - TB.s0 - 0.1, TB.v1 - TB.v0 - 0.1, TB.top - 0.3, TB.top + 0.2, 0x3a3b3f, g);
      for (const [s, v, ls, lv] of [[(TB.s0 + TB.s1) / 2, TB.v0, TB.s1 - TB.s0 + 0.3, 0.35], [(TB.s0 + TB.s1) / 2, TB.v1, TB.s1 - TB.s0 + 0.3, 0.35], [TB.s0, (TB.v0 + TB.v1) / 2, 0.35, TB.v1 - TB.v0], [TB.s1, (TB.v0 + TB.v1) / 2, 0.35, TB.v1 - TB.v0]])
        A.box(RIIA2, s, v, ls, lv, TB.top + 0.25, TB.top + 0.55, 0x2e2f33, g);
    }
    {
      // the low shop front: street face, SW end with the entrance, back and NE end; the dark roof slab with eaves
      CK.put(L(LF.s1, LF.v0), L(LF.s0, LF.v0), g, 'slf');
      CK.put(L(LF.s1, LF.v1), L(LF.s1, LF.v0), g, 'sle');
      for (let s = LF.s0; s < LF.s1 - 0.1; s += (LF.s1 - LF.s0) / 3) CK.put(L(s, LF.v1), L(s + (LF.s1 - LF.s0) / 3, LF.v1), g, 'slp');
      CK.put(L(LF.s0, LF.v1), L(LF.s0, TB.v1), g, 'slp');
      CK.put(L(LF.s0, LF.v0), L(LF.s0, TB.v0), g, 'slp');
      A.box(RIIA2, (LF.s0 + LF.s1) / 2 + 0.4, (LF.v0 + LF.v1) / 2 - 0.2, LF.s1 - LF.s0 + 0.8, LF.v1 - LF.v0 + 1.4, LF.top, LF.top + 0.35, 0x2f3134, g);
      A.box(RIIA2, (LF.s0 + LF.s1) / 2 + 0.4, LF.v0 - 0.7, LF.s1 - LF.s0 + 0.9, 0.12, LF.top - 0.05, LF.top + 0.4, 0x8b8f94, g);   // the fascia
      // the canopy over the entrance and the steps up to it
      A.box(RIIA2, LF.s1 + 1.4, LF.v1 - 8.0, 2.8, 4.2, 3.35, 3.5, 0x3a3b40, g);
      for (const [d, y] of [[3.1, 0.15], [2.6, 0.3], [2.1, 0.45]]) A.box(RIIA2, LF.s1 + d / 2, LF.v1 - 8.0, d, 5.0, -0.2, y, 0xa9a49c, g);
      // the brick sign tower at the corner of the hall, the red SELVER panel on its street face and SW side
      A.box(RIIA2, 1357.4, 10.8, 1.6, 1.0, 0, 6.2, 0x8a5244, g);
      A.box(RIIA2, 1357.4, 10.8, 1.75, 1.15, 6.2, 6.35, 0x2e2f33, g);
      CK.put(L(1358.2, 10.27), L(1356.6, 10.27), g + 4.6, 'ssg');
      CK.put(L(1358.23, 11.3), L(1358.23, 10.3), g + 4.6, 'ssg');
    }
    CK.finish();
    // the brick paved forecourt with its parking along the shop
    A.pave(RIIA2, 1336, 1381, CEN(1358) + HALF + 0.2, LF.v0, 'red', 0.06);
    A.pave(RIIA2, 1374, 1381, LF.v0, LF.v1, 'red', 0.06);

    // ---- Riia 65: the white masonry pillar fence with dark bars on a low white plinth, and its gate
    const pillarFence = (s0, s1, v, step, panel, slats, skip = []) => {
      const n = Math.round((s1 - s0) / step);
      for (let i = 0; i <= n; i++) {
        const s = s0 + (s1 - s0) * i / n;
        A.box(RIIA2, s, v, 0.48, 0.48, -0.1, 1.55, 0xeceae4);
        A.box(RIIA2, s, v, 0.58, 0.58, 1.55, 1.63, 0xb9bab8);
        if (i === n || skip.some(([a, b]) => s + 0.1 > a && s + 0.1 < b)) continue;
        const sa = s + 0.24, sb = s + (s1 - s0) / n - 0.24;
        A.box(RIIA2, (sa + sb) / 2, v, sb - sa, 0.3, -0.1, 0.42, 0xe4e2dc);
        if (slats) {
          A.box(RIIA2, (sa + sb) / 2, v, sb - sa, 0.05, 1.28, 1.34, panel);
          A.box(RIIA2, (sa + sb) / 2, v, sb - sa, 0.05, 0.5, 0.56, panel);
          for (let q = sa + 0.12; q < sb - 0.06; q += 0.16) A.box(RIIA2, q, v, 0.035, 0.035, 0.42, 1.34, panel);
        } else A.box(RIIA2, (sa + sb) / 2, v, sb - sa, 0.06, 0.42, 1.3, panel);
      }
    };
    pillarFence(1021, 1057, 13.4, 2.8, 0x4a3a32, true, [[1027.5, 1031]]);
    A.gate(L(1027.6, 13.4), L(1030.4, 13.4), 1.35, 0x3d332e);
    // across the road at Riia 52-54: the same pillars with grey panels behind the cycle path
    pillarFence(996, 1050, -18.0, 3.0, 0xb4b6b8, false, [[1022, 1025.5]]);

    // ---- Riia 72: the clipped hedge along the pavement, a gap for the path to the door
    A.hedge([L(1287, -18.6), L(1301.8, -18.6)], 1.5, 0.9);
    A.hedge([L(1304.2, -18.6), L(1339, -18.7)], 1.5, 0.9);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(964, -30), L(1037, 21), L(1180, 0), L(1362, 20)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
