// Riia tänav, batch 2 of the "riiastrip" kaardista (Martin, 20 Nov: his Street View shots of 2023 and 2024, the
// Land Board's oblique air photos of Apr and May 2024): from Pauluse church past Kastani to the railway.
//  - Aparaaditehas (Kastani 42) along Riia: four storeys of grey bands and long windows, the shops under them
//    (Trikster, Biit Me, Biblioteek, the rust portal, Puhvet, Vivarec, Ohakas) and three tall spruces at the
//    Kastani end; its glass corner to Kastani with the brick top and the white crosses.
//  - Hektor Design Hostel (Riia 26): slate blue, three floors of white windows, the yellow H signs.
//  - Across the road, from the air photos: Riia 29a (dark brick, red roof), Riia 31 (ochre boards), the yellow
//    house with the red roof and the round tower (Riia 35), the five-storey block on the Vaksali corner, and
//    Riia 43 past the railway (red brick, four floors).
//  - The railway bridge over Riia, which the map's 3D data leaves out: a grey concrete deck on a wall between
//    the two carriageways, the abutment walls, the red and white height bars, the steel railings on top.
//  - The cycle bridge before it gets its stone-mosaic faces; the red and white radio mast on the railway land.
//    (The cycle tunnels under the railway and their stone portals are left out: the ground has no cut for them.)
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintWall, paintTexture } from './houseskin.js';
import { areaKit, cellKit } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';
import { RIIA2, railings } from './riia2.js';

const DEBUG = typeof location !== 'undefined' && /riia3debug/.test(location.search);
const S27 = ['2_7', 480, 3680];
const L = RIIA2.at, sv = RIIA2.sv;
const U = RIIA2.U, V = RIIA2.V;
const NW = V, SE = [-V[0], -V[1]], SW = U, NE = [-U[0], -U[1]];
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const SANS = '700 %px Arial, sans-serif';

// the railway bridge (s along Riia, v across) and the cycle bridge before it
const RB = { s0: 571.5, s1: 594.5, v: 16, wall: 12.2, clear: 4.4, top: 5.75 };
const CB = { s0: 548.4, s1: 555.6, v: 44, top: 29.73, sag: 0.000675, y0: 2.4, y1: 6.0 };   // y0..y1 above the road under it

// [name, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['apa', 2321, L(371, -16), 30, 0x9a9b98, 0x4a4c50, (x, z) => sv(x, z)[1] > -24],
  ['apak', 2321, L(403, -40), 28, 0xb8aa94, 0x4a4c50, (x, z) => { const [s, v] = sv(x, z); return s > 394 && v < -14 && v > -75; }],
  ['hektor', 2481, L(457, -30), 40, 0x7f93a8, 0xa9adb2, (x, z) => sv(x, z)[1] > -60],
  ['r29a', 2477, L(390, 22), 14, 0x7c4636, 0x6e3b30],
  ['r31', 2465, L(423, 21), 13, 0xc48c3c, 0x5a5c60],
  ['r31b', 2476, L(425, 33), 16, 0xe2c548, 0x5a5c60],
  ['r35', 2496, L(462, 40), 26, 0xe6c428, 0x9c2f2a],
  ['vaksali3', 2577, L(496, 72), 36, 0xe2ded6, 0x6b4a3e],
  ['r43', 2628, L(625, 29), 28, 0x9c5a44, 0x6d6f73],
];

export function riia3Walls(walls) {
  setHouseColours(walls, S27[0], S27[1], S27[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// ---------------------------------------------------------------- painted walls
const plaster = (wall, floors, storey, win = {}) => ({ kind: 'plaster', wall, trim: '#efebe2', storey, maxFloors: floors, weather: 0.4,
  win: { w: 1.3, pitch: 2.9, T: false, bars: 1, surround: 0.08, sc: '#e9e4d8', frame: '#f4f2ec', glass: '#55667a', ...win }, attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' } });
const SPEC = {
  hektor: plaster([127, 147, 168], 3, 3.4, { w: 1.4, pitch: 2.8, surround: 0, frame: '#f2f2ef', glass: '#4e5e70' }),
  r29a: { kind: 'brick', wall: [124, 70, 54], trim: '#d9d2c4', storey: 3.1, maxFloors: 3, win: { w: 1.2, pitch: 2.7, T: false, bars: 1, surround: 0, frame: '#ece8de', glass: '#4f5f72' }, attic: null, plinth: { h: 0.6, type: 'plaster', col: '#7f7b76' } },
  r31: { kind: 'boards', wall: [196, 140, 60], pitch: 0.16, trim: '#f1e7cf', storey: 3.0, maxFloors: 2, win: { w: 1.1, pitch: 2.6, T: true, bars: 1, surround: 0.1, sc: '#f1e7cf', frame: '#f4f1ea', glass: '#55667a' }, attic: null, plinth: { h: 0.7, type: 'plaster', col: '#8a857f' } },
  r31b: plaster([226, 197, 72], 2, 3.0),
  r35: plaster([230, 196, 40], 3, 3.2, { w: 1.3, pitch: 2.6, frame: '#ffffff' }),
  vaksali3: plaster([226, 222, 214], 5, 2.9, { w: 1.5, pitch: 3.2, surround: 0 }),
  r43: { kind: 'brick', wall: [160, 90, 68], trim: '#e9e4da', storey: 3.2, maxFloors: 4, win: { w: 1.4, pitch: 3.0, T: false, bars: 1, surround: 0, frame: '#f2efe8', glass: '#55667a' }, attic: null, plinth: { h: 0.8, type: 'plaster', col: '#8e8a84' } },
};

// Aparaaditehas to Riia: grey bands and window ribbons over a row of shops (as the shot from Riia shows them)
function apa(P, W) {
  const len = W.len, top = Math.max(8, W.eaves);
  P.r(0, P.y0, len, P.y1, '#9c9d9a'); P.weather(0, P.y0, len, P.y1, 0.3, 5);
  const front = dot(W, NW) > 0.85 && len > 25;
  const st = Math.max(2.9, (top - 4.6) / 3);
  // three upper floors: a window ribbon each, mullions every 1.6 m, a pale band between
  for (let f = 0; f < 3; f++) {
    const y = 4.6 + f * st;
    if (y + 2.0 > top) break;
    P.r(0.4, y + 0.55, len - 0.4, y + 2.25, '#2c3036');
    P.grad(0.45, y + 0.6, len - 0.45, y + 2.2, '#8296a8', '#3a4652');
    for (let x = 0.4; x < len - 0.4; x += 1.6) P.r(x, y + 0.55, x + 0.07, y + 2.25, '#c9cbcc');
    P.r(0, y + 2.3, len, y + 2.5, '#b9bab7');
  }
  P.r(0, top - 0.5, len, top, '#8a8b88');
  // the shops
  P.r(0, P.y0, len, 4.2, '#3a3d42');
  for (let x = 0.5; x < len - 0.5; x += 3.2) { P.r(x, 0.2, x + 3.0, 3.6, '#24262a'); P.grad(x + 0.08, 0.28, x + 2.92, 3.52, '#5d7183', '#2a3540'); }
  if (!front) return;
  const names = [['Trikster', 0.2, 3.15, 0.75], ['Biit Me', 0.33, 3.55, 0.6], ['Biblioteek', 0.33, 2.75, 0.5], ['Puhvet', 0.6, 3.55, 0.6], ['Vivarec', 0.72, 3.55, 0.6], ['Ohakas', 0.65, 2.75, 0.55]];
  for (const [t, f, y, sz] of names) P.text(t, len * f, y, sz, '#f1efe9', '600 %px Georgia, serif');
  // the rust-red entrance portal with the round sign over it
  const ex = len * 0.47;
  P.r(ex - 1.6, 0, ex + 1.6, 4.6, '#a2552e'); P.r(ex - 0.9, 0.05, ex + 0.9, 2.6, '#2b1e18'); P.grad(ex - 0.82, 0.1, ex + 0.82, 2.55, '#6b7b88', '#2b343c');
  P.arc(ex, 5.4, 0.55, '#f2f2f2'); P.line(ex - 0.7, 5.4, ex + 0.7, 5.4, '#2a2a2a', 0.08); P.line(ex, 4.7, ex, 6.1, '#2a2a2a', 0.08);
}
// the corner to Kastani: three floors of glass, a brick top with big white crosses
function apak(P, W) {
  const len = W.len, top = W.peak;
  if (dot(W, SW) < 0.6 && dot(W, SE) < 0.6) { P.r(0, P.y0, len, P.y1, '#a9a399'); return; }
  P.brick(0, P.y0, len, P.y1, [176, 160, 136], 9);
  const gl = Math.min(top - 2, 12.5);
  P.r(0, P.y0, len, gl, '#33373d');
  for (let y = 0.3; y < gl - 1; y += 3.2) { P.grad(0.3, y, len - 0.3, y + 2.7, '#8aa0b3', '#3d4a57'); P.r(0, y + 2.7, len, y + 3.2, '#c8c9c8'); }
  for (let x = 0.3; x < len; x += 1.5) P.r(x, 0, x + 0.06, gl, '#d0d2d2');
  if (top - gl > 4) for (let x = 2.5; x < len - 2; x += 6) { const y = (gl + top) / 2; P.r(x - 0.35, y - 2, x + 0.35, y + 2, '#f4f3ef'); P.r(x - 2, y - 0.35, x + 2, y + 0.35, '#f4f3ef'); }
}
// Hektor's long front gets its plaster and windows, then the yellow H signs near both ends
function hektor(P, W, spec) {
  paintWall(P, W, spec, {});
  if (!(dot(W, NW) > 0.85 && W.len > 30)) return;
  const y = Math.max(8, W.eaves - 1.6);
  for (const x of [3.2, W.len - 3.2]) {
    P.r(x - 0.7, y - 0.7, x + 0.7, y + 0.7, '#f2c419'); P.text('H', x, y, 1.0, '#1d1d1f', SANS);
    P.r(x - 1.3, y - 1.25, x + 1.3, y - 0.8, '#1d1d1f'); P.text('HEKTOR', x, y - 1.03, 0.32, '#f2c419', SANS);
  }
}
const PAINT = { apa: (P, W) => apa(P, W), apak: (P, W) => apak(P, W), hektor };

// ---------------------------------------------------------------- the bridges' faces (cells)
function bridgeCells(CK) {
  const w = RB.v * 2, d = RB.top - RB.clear;
  // the railway bridge's edge beam: grey concrete, stains under the drips, the red and white bars over the road
  CK.cell('rbF', w, RB.clear, RB.top, '#9d9f9b', (P, ww) => {
    P.r(0, RB.clear, ww, RB.top, '#9fa19d'); P.weather(0, RB.clear, ww, RB.top, 0.5, 3);
    P.r(0, RB.top - 0.25, ww, RB.top, '#b3b5b1');
    for (let x = RB.v - RB.wall + 0.4; x < RB.v + RB.wall - 0.4; x += 0.8) {
      if (Math.abs(x - RB.v) < 0.6) continue;
      P.r(x, RB.clear + 0.05, x + 0.4, RB.clear + 0.3, ((x / 0.8) | 0) % 2 ? '#d22f2a' : '#f2f2f2');
    }
    P.arc(RB.v - 6, RB.clear + 0.85, 0.32, '#f4f4f4'); P.arc(RB.v - 6, RB.clear + 0.85, 0.27, '#d22f2a'); P.arc(RB.v - 6, RB.clear + 0.85, 0.2, '#f4f4f4'); P.text('4,5', RB.v - 6, RB.clear + 0.85, 0.16, '#1d1d1f', SANS);
    P.arc(RB.v + 6, RB.clear + 0.85, 0.32, '#f4f4f4'); P.arc(RB.v + 6, RB.clear + 0.85, 0.27, '#d22f2a'); P.arc(RB.v + 6, RB.clear + 0.85, 0.2, '#f4f4f4'); P.text('4,5', RB.v + 6, RB.clear + 0.85, 0.16, '#1d1d1f', SANS);
  }, 24);
  // the abutment walls along the road: concrete panels, a dark drip line, a drain pipe now and then
  CK.cell('rbW', RB.s1 - RB.s0, 0, RB.clear, '#8f918d', (P, ww) => {
    P.r(0, 0, ww, RB.clear, '#93958f'); P.weather(0, 0, ww, RB.clear, 0.6, 7);
    for (let x = 0; x < ww; x += 3.9) P.r(x, 0, x + 0.05, RB.clear, '#7d7f7b');
    P.r(0, 0, ww, 0.35, '#6f716d'); P.r(0, RB.clear - 0.2, ww, RB.clear, '#7a7c78');
    // small square vents high up in the wall ("43 Riia")
    for (let x = 4.6; x < ww - 2; x += 7.8) { P.r(x, 2.7, x + 0.7, 3.4, '#b2b4b0'); P.r(x + 0.08, 2.78, x + 0.62, 3.32, '#3a3c3e'); }
  }, 14);
  // the pilasters at the corners: a deep square panel
  CK.cell('rbP', 3.8, 0, RB.top, '#9d9f9b', (P, ww) => {
    P.r(0, 0, ww, RB.top, '#a2a4a0'); P.weather(0, 0, ww, RB.top, 0.5, 11);
    P.r(0.5, 1.3, ww - 0.5, 3.9, '#80827e'); P.r(0.65, 1.45, ww - 0.65, 3.75, '#8c8e8a');
    P.r(ww - 0.45, 0, ww - 0.3, RB.top - 0.5, '#2d2f33');
  }, 20);
  // the cycle bridge's face: slabs of stone set on end in greys and browns
  // (the cell spans the face's whole height range; each piece cuts its own arched strip out of it)
  CK.cell('cbF', 11, CB.y0, CB.y1, '#a39581', (P, ww) => {
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const tones = ['#b9ab94', '#8d7f6c', '#a69780', '#c7bba6', '#7a6e60', '#9c917f', '#b3a690'];
    for (let x = 0; x < ww; ) {
      const sw = 0.12 + r() * 0.25, c = tones[(r() * tones.length) | 0];
      for (let y = CB.y0; y < CB.y1; ) { const sh = 0.5 + r() * 1.1; P.r(x, y, x + sw, Math.min(CB.y1, y + sh), c); y += sh + 0.02; }
      x += sw + 0.015;
    }
  }, 36);
}

// ---------------------------------------------------------------- the radio mast: three legs, rings and braces
function mast(p, base, y0, H = 52) {
  const N = 17, rAt = (k) => 2.4 - (2.4 - 0.7) * (k / N), yAt = (k) => y0 + H * (k / N);
  const pt = (k, j) => { const a = j * Math.PI * 2 / 3 + 0.3; return new THREE.Vector3(base[0] + Math.cos(a) * rAt(k), yAt(k), base[1] + Math.sin(a) * rAt(k)); };
  const X = new THREE.Vector3(1, 0, 0);
  const seg = (a, b, t, col) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = BOX(len, t, t).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(X, d.normalize()));
    p.add(g, col, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const band = (y) => (Math.floor((y - y0) / (H / 7)) % 2 ? 0xeeece6 : 0xc8352c);
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < 3; j++) {
      const a = pt(k, j), b = pt(k + 1, j), c = pt(k + 1, (j + 1) % 3), e = pt(k, (j + 1) % 3);
      const col = band((a.y + b.y) / 2);
      seg(a, b, 0.22, col);
      seg(b, c, 0.1, col);
      seg(k % 2 ? a : e, k % 2 ? c : b, 0.07, col);
    }
  }
  p.box(0.12, 6, 0.12, 0xd9d7d1, base[0], y0 + H + 3, base[1]);
  p.add(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 10), 0xe8e6e0, base[0] + 0.5, y0 + H - 2, base[1]);
  p.add(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 10), 0xe8e6e0, base[0] - 0.4, y0 + H - 6, base[1] + 0.3);
}

// road paint (Street View "42 Riia" and "43 Riia"): the map puts zebra crossings just before the railway bridge and
// under it; there are none, the paths cross on the cycle bridge and through the tunnels
export function riia3Clear(data) {
  const out = [], a = data.sectors['2_7'] || [];
  for (let k = 0; k < a.length; k += data.stride) {
    if (a[k] !== 7) continue;
    const [s, v] = RIIA2.sv(a[k + 1], a[k + 2]);
    if (s > 560 && s < 600 && Math.abs(v) < 12) out.push(`2_7:${k / data.stride}`);
  }
  return out;
}

export function createRiia3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  // no map trees on the railway bridge, in the cut under it or in the tunnel mouths
  world.addClearing({ test: (x, z) => { const [s, v] = sv(x, z); return s > RB.s0 - 2 && s < RB.s1 + 2 && Math.abs(v) < RB.v + 1; } });
  world.addTrees([
    // the three tall spruces before Aparaaditehas at the Kastani end
    [...L(386.5, -14.2), 15.5, 3.1, 1], [...L(391.5, -14.0), 14.0, 2.9, 1], [...L(396.0, -14.4), 16.0, 3.2, 1],
  ]);
  // the wall between the carriageways under the railway, and the abutments, are solid
  const solid = (s0, s1, v0, v1) => { const [x, z] = L((s0 + s1) / 2, (v0 + v1) / 2); return { x, z, yaw: Math.atan2(-U[1], U[0]), hx: (s1 - s0) / 2, hz: (v1 - v0) / 2 }; };
  world.addSolids([solid(RB.s0 + 0.3, RB.s1 - 0.3, -0.45, 0.45), solid(RB.s0, RB.s1, -RB.v, -RB.wall), solid(RB.s0, RB.s1, RB.wall, RB.v)]);
  let built = false;
  const CENTRE = L(500, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    // ---- the map's blocks with painted walls
    const faces = (W) => W.foot < 2 && W.len > 6;
    const houses = HOUSES.map(([name, base, at, r, , , pick]) => {
      const H = { name, sec: S27[0], base, at, r, pick, spec: SPEC[name] || { wall: [200, 200, 200], floors: [], attic: null, eaves: false } };
      if (PAINT[name]) H.walls = [{ near: [0, 0], within: 1e9, only: (P, W, spec) => PAINT[name](P, W, spec) }];
      return H;
    });
    skinHouses(world, group, houses, { label: 'riia3 fronts', shadows, ppm: 14, far: 6, faces, debug: DEBUG });

    const CK = cellKit(group, { shadows });
    bridgeCells(CK);
    const R = railings(group, '#5b5e63');
    const gy = (h(...L(583, -4)) + h(...L(583, 4))) / 2;
    const grey = 0x9a9c98;

    // ---- the railway bridge
    {
      const sm = (RB.s0 + RB.s1) / 2, ls = RB.s1 - RB.s0;
      A.box(RIIA2, sm, 0, ls - 0.1, RB.v * 2 - 0.1, RB.clear, RB.top - 0.02, grey, gy);           // the deck
      A.box(RIIA2, sm, 0, ls, RB.v * 2, RB.top - 0.02, RB.top + 0.25, 0x6c6863, gy);              // ballast on it
      // the ribbed soffit ("43 Riia"): cross beams every 1.65 m between the abutments, a deeper beam over each wall
      for (let s = RB.s0 + 0.9; s < RB.s1 - 0.5; s += 1.65) A.box(RIIA2, s, 0, 0.32, RB.wall * 2, RB.clear - 0.34, RB.clear + 0.01, 0x8c8e8a, gy);
      for (const v of [-RB.wall + 0.35, 0, RB.wall - 0.35]) A.box(RIIA2, sm, v, ls - 0.2, 0.7, RB.clear - 0.5, RB.clear + 0.01, 0x969894, gy);
      for (const sg of [-1, 1]) {
        A.box(RIIA2, sm, sg * (RB.wall + RB.v) / 2, ls - 0.1, RB.v - RB.wall - 0.1, -0.6, RB.clear, 0x8f918d, gy);   // abutment
        for (const s of [RB.s0 - 0.25, RB.s1 + 0.25]) A.box(RIIA2, s, sg * (RB.wall + 1.9), 0.5, 3.8, -0.6, RB.top + 0.25, grey, gy);   // pilasters
      }
      A.box(RIIA2, sm, 0, ls - 0.6, 0.9, -0.1, RB.clear, 0x9c9e9a, gy);                            // the wall between the carriageways
      for (const s of [RB.s0 + 0.2, RB.s1 - 0.2]) A.box(RIIA2, s, 0, 0.5, 1.1, -0.1, 1.05, 0xb3b5b1, gy);   // its blunt ends
      // the faces: the edge beam on both sides, the abutment walls, the pilasters
      CK.put(L(RB.s0 - 0.03, -RB.v), L(RB.s0 - 0.03, RB.v), gy, 'rbF');
      CK.put(L(RB.s1 + 0.03, RB.v), L(RB.s1 + 0.03, -RB.v), gy, 'rbF');
      CK.put(L(RB.s0, -RB.wall + 0.03), L(RB.s1, -RB.wall + 0.03), gy, 'rbW');
      CK.put(L(RB.s1, RB.wall - 0.03), L(RB.s0, RB.wall - 0.03), gy, 'rbW');
      for (const sg of [-1, 1]) {
        const v0 = sg * RB.wall, v1 = sg * (RB.wall + 3.8);
        CK.put(L(RB.s0 - 0.52, sg < 0 ? v1 : v0), L(RB.s0 - 0.52, sg < 0 ? v0 : v1), gy, 'rbP');
        CK.put(L(RB.s1 + 0.52, sg < 0 ? v0 : v1), L(RB.s1 + 0.52, sg < 0 ? v1 : v0), gy, 'rbP');
      }
      // keep-right signs and striped posts on the dividing wall's ends
      for (const [s, d] of [[RB.s0 - 0.15, -1], [RB.s1 + 0.15, 1]]) {
        const [x, z] = L(s, 0);
        p.box(0.12, 1.1, 0.12, 0xe9e9e6, x, gy + 1.55, z);
        p.add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20).rotateZ(Math.PI / 2), 0x1f5fb4, x + U[0] * d * 0.08, gy + 2.3, z + U[1] * d * 0.08, RIIA2.YAW);
        for (let k = 0; k < 4; k++) p.box(0.16, 0.24, 0.16, k % 2 ? 0xf2f2f2 : 0xd22f2a, x + U[0] * d * 0.4, gy + 0.12 + k * 0.24, z + U[1] * d * 0.4);
      }
      // the steel railings along both edges
      for (const s of [RB.s0 + 0.15, RB.s1 - 0.15]) R.add(L(s, -RB.v), L(s, RB.v), gy + RB.top + 0.25, gy + RB.top + 0.25, 1.15);
    }

    // ---- the cycle bridge's stone faces, following its gentle arch
    {
      const out = (vFrom, vTo) => {
        const n = 6, pts = [];
        const yTop = (v) => Math.min(CB.y1, CB.top + 0.18 - CB.sag * v * v - gy);
        for (let k = 0; k <= n; k++) { const v = vFrom + (vTo - vFrom) * k / n; pts.push([11 * k / n, Math.max(CB.y0, yTop(v) - 2.0)]); }
        for (let k = n; k >= 0; k--) { const v = vFrom + (vTo - vFrom) * k / n; pts.push([11 * k / n, yTop(v)]); }
        return pts;
      };
      for (let k = 0; k < 8; k++) {
        const va = -CB.v + 11 * k, vb = va + 11;
        CK.put(L(CB.s0 - 0.02, va), L(CB.s0 - 0.02, vb), gy, 'cbF', out(va, vb));
        CK.put(L(CB.s1 + 0.02, -va), L(CB.s1 + 0.02, -vb), gy, 'cbF', out(-va, -vb));
      }
    }

    // ---- the radio mast on the railway land
    {
      const b = L(602, -32);
      mast(p, b, h(b[0], b[1]) - 0.3);
      p.box(5.6, 0.5, 5.6, 0x8d8f8b, b[0], h(b[0], b[1]) - 0.05, b[1], RIIA2.YAW);
    }
    R.finish();
    CK.finish();
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 400) return;
      if ([L(360, -20), L(480, 40), L(583, 0), L(630, 30)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
