// Turu tänav, batch 3: the AHHAA science centre, the Turu 8 halls and Tigutorn (Martin, 20 Nov: kaardista, his
// Street View shots of Jun 2023 and Aug 2024, the Land Board's oblique air photos of 2023/2024).
//  - AHHAA (Sadama 1): the grey panel walls with their white dots, the orange AHHAA logo over the glass
//    ground floor on the plaza, the red brick block, the canopy with its screen, the garage entrance with
//    the P signs, the silver domes; on the plaza the ESA rocket on its red ring, the giant bench, the flags,
//    the round flower beds and the low benches;
//  - Turu 8: the long grey office front to Turu (a row of white windows, the low cellar windows) behind
//    its clipped hedge, the grey hall along Sadama, the beige barrel vault by the plaza on its dark base;
//  - Tigutorn (Väike-Turu 5): white, with its scatter of small square and round windows, the glass strip
//    on the west side, the glass ground floor, the thujas on the lawn beside it;
//  - Väike-Turu 3: the car park deck behind its dark mesh along the street, the white round stair tower
//    and the fishing and pet shop front at the north-west end.
// The map's own blocks keep their shapes and get painted walls.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { TURU } from './turu.js';

const DEBUG = typeof location !== 'undefined' && /turudebug/.test(location.search);
const S6 = ['4_6', 1760, 3040];
const SANS = '700 %px Arial, sans-serif';
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const ORANGE = '#ec6b2d';

// the barrel vault at the plaza end of Turu 8
const VAULT = [2079, 3214];
const inVault = (x, z) => Math.hypot(x - VAULT[0], z - VAULT[1]) < 17;
// AHHAA's plaza front: from its north corner (x = 0) to the brick block
export const AF = frame([2135.0, 3170.9], [2111.4 - 2135.0, 3210.6 - 3170.9]);   // v + = out on the plaza

// [name, sector, base, at, reach, wall, roof, ppm]
const HOUSES = [
  ['turu8', S6, 7, [2067, 3244], 58, 0xcfcfc9, 0x6c6f73],
  ['ahhaa', S6, -93, [2145, 3220], 75, 0xdfe1e2, 0xcfd3d6],
  ['tigu', S6, -31, [2225, 3213], 22, 0xefefea, 0xdedede, 10],
  ['vt3', S6, -58, [2185, 3168], 45, 0xe9e9e6, 0x55585c],
];

export function turu3Walls(walls) {
  setHouseColours(walls, S6[0], S6[1], S6[2], HOUSES.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  // the vault's own colours: its beige roof over a dark base (its own entry, nearer than the hall's)
  addHouseColours(walls, S6[0], S6[1], S6[2], [{ base: 7, x: VAULT[0], z: VAULT[1], wall: 0x3b3e42, roof: 0xcdbf9e, reach: 15 }]);
}

function glassBand(P, x0, x1, y0, y1, top = '#7f97a8', bottom = '#43586a', mull = '#2f3438', bay = 1.5) {
  P.grad(x0, y0, x1, y1, top, bottom);
  for (let x = x0; x <= x1 + 0.01; x += bay) P.r(x - 0.04, y0, x + 0.04, y1, mull);
}
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- Turu 8
function vaultWall(P, W, x0, x1) {
  P.r(x0, P.y0, x1, P.y1, '#cdbf9e');
  for (let x = x0 + 0.3; x < x1; x += 0.6) P.r(x, 3.8, x + 0.08, P.y1, '#bcae8c');       // the ribs of the cladding
  P.r(x0, P.y0, x1, 3.8, '#3b3e42');                                                // the dark base
  P.r(x0, 3.8, x1, 4.0, '#2b2d30');
}
function turu8(P, W) {
  const len = W.len, top = W.peak;
  // where the wall runs past the vault
  const xa = [0, len].map((x) => inVault(W.a[0] + W.ux * x, W.a[1] + W.uz * x));
  let v0 = len, v1 = 0;
  for (let x = 0; x <= len; x += 0.5) if (inVault(W.a[0] + W.ux * x, W.a[1] + W.uz * x)) { v0 = Math.min(v0, x); v1 = Math.max(v1, x); }
  if (W.foot > 7.5 && (xa[0] || xa[1])) { vaultWall(P, W, 0, len); return; }
  if (dot(W, [-0.72, 0.69]) > 0.9) {
    // the front to Turu: grey render, a row of white windows, the low cellar windows in the rough plinth
    P.r(0, P.y0, len, P.y1, '#c9c9c2'); P.weather(0, P.y0, len, P.y1, 0.35, 7);
    if (W.foot > 2) return;                                                          // the stepped upper block: plain
    P.r(0, P.y0, len, 1.0, '#b8b3a7'); P.r(0, 1.0, len, 1.08, '#a9a49a');
    P.r(0, top - 0.35, len, top, '#b4b5b0');
    for (let x = 2.2; x < len - 2.6; x += 3.15) {
      P.win(x, 1.95, x + 1.9, 3.0, { frame: '#f2f2ee', glass: '#4f5a63', fw: 0.06, bars: 2, T: false, surround: 0, sill: 0.05 });
      P.r(x + 0.1, 0.32, x + 1.7, 0.72, '#f2f2ee'); P.r(x + 0.16, 0.37, x + 1.64, 0.67, '#55606a');
    }
    if (len > 40) { P.r(len - 4.6, 2.2, len - 2.6, 3.1, '#ffffff'); P.text('VO', len - 4.1, 2.65, 0.45, '#d6282e', SANS); P.r(len - 3.6, 2.2, len - 2.6, 3.1, '#c8102e'); }
    return;
  }
  // the hall along Sadama and the back: light grey panels, a strip of windows; the vault where it stands
  P.r(0, P.y0, len, P.y1, '#d3d4d0');
  for (let x = 0; x < len; x += 1.2) P.r(x, 0.6, x + 0.03, P.y1, '#c3c4c0');
  P.r(0, P.y0, len, 0.6, '#9a9b98');
  if (W.foot < 2) {
    const ends = v1 > v0 ? [[0, v0 - 0.5], [v1 + 0.5, len]] : [[0, len]];
    for (const [a, b] of ends) {
      if (b - a < 3) continue;
      if (dot(W, [0.69, 0.72]) > 0.9 || dot(W, [0.72, -0.69]) > 0.9) {             // the office ends: two rows of windows
        for (const y of [1.0, 4.4]) for (let x = a + 1.2; x < b - 1.6; x += 2.6) P.win(x, y, x + 1.6, y + 1.3, { frame: '#f2f2ee', glass: '#4f5a63', fw: 0.06, bars: 1, T: false, surround: 0, sill: 0.04 });
      } else glassBand(P, a + 1, b - 1, Math.min(top - 1.6, 6.4), Math.min(top - 0.4, 7.4), '#8fa4b4', '#566b7a', '#5a5d61', 1.4);
    }
    if (dot(W, [-0.69, -0.72]) > 0.9 && len > 40) {                                  // the doors to Sadama
      P.r(len * 0.62, 0, len * 0.62 + 3.2, 3.4, '#4a4f55'); P.r(len * 0.62 + 0.15, 0, len * 0.62 + 3.05, 3.1, '#c7c9cb');
      for (let y = 0.3; y < 3.0; y += 0.32) P.r(len * 0.62 + 0.15, y, len * 0.62 + 3.05, y + 0.04, '#aeb1b4');
    }
  }
  if (v1 > v0) vaultWall(P, W, Math.max(0, v0), Math.min(len, v1));
}

// ---------------------------------------------------------------- AHHAA
function dots(P, x0, x1, y0, y1, seed) {
  P.r(x0, y0, x1, y1, '#c4c8cc');
  const r = rnd(seed);
  for (let y = y0 + 0.6; y < y1 - 0.4; y += 1.1) for (let x = x0 + 0.5; x < x1 - 0.4; x += 1.1) {
    if (r() < 0.35) continue;
    P.arc(x + (r() - 0.5) * 0.3, y + (r() - 0.5) * 0.3, 0.12 + r() * 0.22, '#f4f5f6');
  }
}
function logo(P, x, y, s) {                                                         // three linked rings and the name
  for (const [dx, dy] of [[0, 0], [0.9, 0.35], [1.8, 0]]) { P.arc(x + dx * s, y + dy * s, 0.55 * s, ORANGE); P.arc(x + dx * s, y + dy * s, 0.33 * s, '#d8dadb'); }
  P.text('AHHAA', x + 2.7 * s, y + 0.1 * s, 1.45 * s, ORANGE, SANS, 'left');
}
function ahhaa(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#dfe1e2');
  for (let x = 0; x < len; x += 1.5) P.r(x, P.y0, x + 0.025, P.y1, '#cfd2d4');
  for (let y = 3; y < top; y += 3) P.r(0, y, len, y + 0.025, '#cfd2d4');
  const seed = Math.round(Math.abs(W.mid[0] * 13 + W.mid[1] * 7)) + 11;
  // the brick block by the plaza
  if (Math.hypot(W.mid[0] - 2103.3, W.mid[1] - 3211) < 9 && W.foot < 2) {
    // the low grey block beside the door: dotted panels, a strip of dark windows
    dots(P, 0, len, P.y0, top, seed);
    glassBand(P, 0.8, len - 0.8, 1.0, 3.0, '#7a8e9e', '#46586a', '#5a5d61', 1.6);
    return;
  }
  if (dot(W, [-0.86, -0.51]) > 0.95 && W.foot < 2 && Math.hypot(W.mid[0] - 2123.2, W.mid[1] - 3190.8) < 3) {
    // the plaza front: the dotted corner, the logo over the glass, the red brick bay, the glass doors under
    // the canopy
    dots(P, 0, 9.5, P.y0, top, seed);
    P.r(9.5, P.y0, len, top, '#d7d9da');
    glassBand(P, 9.8, 25.8, 0.1, 4.0, '#7f95a6', '#3d4f5e', '#33373c', 1.6);
    P.r(9.5, 4.0, 26, 4.25, '#44484d');
    logo(P, 11.6, 6.4, 1.15);
    P.r(14, 0.1, 15.6, 3.6, '#c8352b'); P.text('AHHAA', 14.8, 2.4, 0.32, '#ffffff', SANS);
    P.brick(26, P.y0, 34.5, Math.min(top, 7.6), [176, 86, 58], seed);
    for (let x = 26.8; x < 33.6; x += 2.3) for (const y of [0.9, 4.3]) P.win(x, y, x + 1.4, y + 2.0, { frame: '#3a3d42', glass: '#4e5e6c', fw: 0.07, bars: 1, T: false, surround: 0, sill: 0.05 });
    glassBand(P, 34.8, len - 0.3, 0.1, 4.9, '#6f8596', '#33434f', '#2b2f33', 1.3);
    return;
  }
  if (dot(W, [0.51, -0.86]) > 0.95 && W.foot < 2) {
    // the north front: the garage ramp under the blue AHHAA board, the P signs, the dotted wall
    dots(P, 0, len, P.y0, top, seed);
    if (len > 20) {
      const g = len * 0.55;
      P.r(g, P.y0, g + 6.5, 2.7, '#2a2c30'); for (let k = 0; k < 8; k++) P.r(g + k * 0.85, 2.7, g + k * 0.85 + 0.42, 2.95, k % 2 ? '#ffffff' : '#d6282e');
      P.r(g - 1.5, 3.0, g + 8, 4.4, '#1f5fa8'); P.text('P', g - 0.8, 3.7, 0.9, '#ffffff', SANS);
      P.text('AHHAA PARKLA', g + 3.6, 3.75, 0.42, '#ffffff', SANS);
      P.r(2, 0, 3.4, 2.4, '#3d4045'); glassBand(P, 2.1, 3.3, 0.1, 2.3, '#8aa0b0', '#4b5d6c', '#33373c', 0.6);
    }
    return;
  }
  if (W.foot > 6 && dot(W, [-0.86, -0.51]) > 0.95 && len > 40) {
    // the high hall over the plaza: the big logo
    dots(P, 0, 12, P.y0, top, seed);
    logo(P, len * 0.42, Math.min(top - 2.5, W.foot + 6.5), 1.6);
    return;
  }
  // elsewhere: plain panels, a band of dark windows low down, dotted bays
  if (W.foot < 2 && len > 10) {
    glassBand(P, 1.5, len - 1.5, 1.0, 3.2, '#7a8e9e', '#46586a', '#5a5d61', 1.6);
    if (len > 25) dots(P, len - 9, len, 3.6, top, seed);
  }
}

// ---------------------------------------------------------------- Tigutorn
function tigu(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#efefea'); P.weather(0, P.y0, len, P.y1, 0.3, 5);
  if (W.foot < 2) {                                                                  // the glass ground floor
    P.r(0, P.y0, len, 4.4, '#3b3f44');
    glassBand(P, 0.3, len - 0.3, 0.1, 4.1, '#7d93a3', '#3a4b59', '#2b2f33', 1.4);
    P.r(0, 4.4, len, 4.6, '#d6d6d1');
  }
  const west = W.nx < -0.85 && len > 5;
  const mid = len / 2;
  if (west) {                                                                        // the glass strip up the west side
    P.r(mid - 1.4, 4.6, mid + 1.4, top - 1, '#d9dad6');
    glassBand(P, mid - 1.2, mid + 1.2, 4.7, top - 1.2, '#9fb6c6', '#5d7488', '#4a4f55', 0.8);
    for (let y = 7.6; y < top - 1; y += 3.05) P.r(mid - 1.2, y, mid + 1.2, y + 0.12, '#4a4f55');
  }
  // the scatter of windows: small squares of three sizes, some round, a few tall ones, no two floors alike
  const r = rnd(Math.round(Math.abs(W.mid[0] * 31 + W.mid[1] * 17)) + 7);
  for (let y = Math.max(5.6, W.foot + 0.9); y < top - 1.6; y += 3.05) {
    for (let x = 0.7; x < len - 0.9; x += 1.45) {
      if (west && Math.abs(x + 0.4 - mid) < 2.2) continue;
      const k = r();
      if (k < 0.42) continue;
      const dx = (r() - 0.5) * 0.5, dy = (r() - 0.5) * 0.5;
      if (k < 0.55) { P.arc(x + 0.4 + dx, y + 0.6 + dy, 0.36, '#7c8794'); P.arc(x + 0.4 + dx, y + 0.6 + dy, 0.29, '#3f4c5a'); continue; }
      const s = k < 0.75 ? 0.6 : k < 0.9 ? 0.85 : 0.5, hgt = k > 0.95 ? 1.5 : s;
      P.r(x + dx - 0.05, y + dy - 0.05, x + dx + s + 0.05, y + dy + hgt + 0.05, '#c9cac6');
      P.grad(x + dx, y + dy, x + dx + s, y + dy + hgt, '#7d92a6', '#3a4a5c');
    }
  }
}

// ---------------------------------------------------------------- Väike-Turu 3
function vt3(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#e9e9e6');
  if (dot(W, [0.73, -0.69]) > 0.95 && len > 40) {
    // the street side: the car park deck behind dark mesh, white at the stair tower's end
    P.r(0, P.y0, len - 13, 0.7, '#e2e2de');
    P.r(0, 0.7, len - 13, top - 0.2, '#474c51');
    for (let x = 0; x < len - 13; x += 0.35) P.r(x, 0.7, x + 0.05, top - 0.2, '#5d6268');
    P.r(0, top - 0.2, len - 13, top, '#e2e2de');
    for (let x = 0; x < len - 13; x += 4.2) P.r(x, 0.7, x + 0.12, top - 0.2, '#2b2e31');
    for (const x of [len - 9, len - 6]) { P.arc(x, 2.6, 0.32, '#7d8a96'); P.arc(x, 2.6, 0.25, '#3f4c5a'); }
    return;
  }
  if (dot(W, [-0.69, -0.73]) > 0.95 && len > 12) {
    // the north-west end: the fishing and pet shop
    P.r(5.2, 3.3, len, top - 0.9, '#2f3438');
    glassBand(P, 5.4, len - 0.3, 3.4, top - 1.0, '#6f8798', '#34434f', '#2b2f33', 1.5);
    P.r(5.2, top - 0.9, len, top, '#5a5d61');
    P.grad(5.2, 0, len, 3.3, '#3fae49', '#2b8a37');
    P.r(5.2, 2.55, len, 3.3, '#1e6b2c');
    P.text('KALASTUS', 5.2 + (len - 5.2) * 0.25, 2.92, 0.42, '#ffffff', SANS);
    P.arc(5.2 + (len - 5.2) * 0.5, 2.92, 0.5, '#f6d32d'); P.text('ZOO', 5.2 + (len - 5.2) * 0.5, 2.92, 0.36, '#1e6b2c', SANS);
    P.text('LEMMIKLOOMAD', 5.2 + (len - 5.2) * 0.78, 2.92, 0.36, '#ffffff', SANS);
    P.r(5.2 + (len - 5.2) * 0.42, 0, 5.2 + (len - 5.2) * 0.42 + 1.8, 2.4, '#3a3f44'); glassBand(P, 5.2 + (len - 5.2) * 0.42 + 0.1, 5.2 + (len - 5.2) * 0.42 + 1.7, 0.05, 2.3, '#8aa0b0', '#4b5d6c', '#2b2f33', 0.8);
    for (const x of [1.4, 3.2]) { P.arc(x, 1.6, 0.22, '#7d8a96'); P.arc(x, 1.6, 0.17, '#3f4c5a'); }
    return;
  }
  // the car park side: white, the shop's glass toward the north-west end
  if (W.foot < 2 && len > 30 && dot(W, [-0.73, 0.69]) > 0.95) {
    P.r(len - 18, 0, len - 0.5, 3.6, '#3a3f44'); glassBand(P, len - 17.8, len - 0.7, 0.1, 3.4, '#7a8e9e', '#3d4f5e', '#2b2f33', 1.5);
    P.r(0, 0, len - 19, 0.6, '#cfcfcb');
  }
}

const PAINT = { turu8, ahhaa, tigu, vt3 };

export function createTuru3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [2140, 3215];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map(([name, S, base, at, r, , , ppm]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false, ppm }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 6, faces: (W) => W.len > 5 && (W.foot < 2 || W.peak > 30 || W.len > 30), debug: DEBUG });

    // ---- the AHHAA plaza: the rocket on its red ring
    const R = [2108.5, 3191.5], gr = h(R[0], R[1]);
    p.add(new THREE.RingGeometry(8.2, 10.4, 48).rotateX(-Math.PI / 2), 0xb5675a, R[0], gr + 0.1, R[1]);
    p.add(new THREE.CircleGeometry(8.2, 40).rotateX(-Math.PI / 2), 0xb7aea6, R[0], gr + 0.09, R[1]);
    const white = 0xeeeeec, orange = 0xe8692c;
    p.add(new THREE.CylinderGeometry(1.05, 1.15, 10.6, 18), white, R[0], gr + 5.3, R[1]);
    p.add(new THREE.CylinderGeometry(0.05, 1.05, 3.4, 18), white, R[0], gr + 12.3, R[1]);
    for (const y of [3.4, 6.0, 8.2, 9.9]) p.add(new THREE.CylinderGeometry(1.08, 1.08, 0.3, 18), orange, R[0], gr + y, R[1]);
    for (const s of [-1, 1]) {                                                   // the two boosters
      const bx = R[0] + AF.U[0] * 1.75 * s, bz = R[1] + AF.U[1] * 1.75 * s;
      p.add(new THREE.CylinderGeometry(0.62, 0.66, 4.6, 14), white, bx, gr + 2.3, bz);
      p.add(new THREE.CylinderGeometry(0.05, 0.62, 1.7, 14), white, bx, gr + 5.45, bz);
      p.add(new THREE.CylinderGeometry(0.64, 0.64, 0.25, 14), orange, bx, gr + 3.6, bz);
    }
    // the logo on the rocket's side toward the street
    const rl = paintTexture(1.4, 0, 1.6, 60, (P) => {
      P.r(0, 0, 1.4, 1.6, '#eeeeec');
      for (const [dx, dy] of [[0.45, 1.15], [0.7, 1.25], [0.95, 1.15]]) { P.arc(dx, dy, 0.16, '#e8692c'); P.arc(dx, dy, 0.1, '#eeeeec'); }
      P.text('AHHAA', 0.7, 0.75, 0.24, '#e8692c', SANS); P.text('esa', 0.7, 0.3, 0.26, '#1f4e8c', SANS);
    }, { alpha: false });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshLambertMaterial({ map: rl }));
    lm.position.set(R[0] + AF.V[0] * 1.13, gr + 8.9, R[1] + AF.V[1] * 1.13); lm.rotation.y = Math.atan2(AF.V[0], AF.V[1]); group.add(lm);

    // the giant bench, facing the street
    const BF = frame([2098.5, 3181.5], AF.U);
    const gb = 0x8d9196;
    A.box(BF, 0, 0.0, 4.4, 1.5, 1.45, 1.7, gb);                                    // the seat
    A.box(BF, 0, -0.75, 4.4, 0.18, 1.7, 3.5, gb);                                  // the back, toward the rocket
    for (const s of [-2.0, 2.0]) {
      A.box(BF, s, 0.55, 0.22, 0.22, 0, 1.45, gb); A.box(BF, s, -0.65, 0.22, 0.22, 0, 3.5, gb);
      A.box(BF, s, -0.05, 0.22, 1.45, 2.3, 2.45, gb);                              // the arms
      A.box(BF, s, 0.55, 0.2, 0.2, 1.7, 2.3, gb);
    }
    // the low benches around the ring
    for (const a of [2.8, 4.6, 5.6]) {
      const x = R[0] + Math.cos(a) * 11, z = R[1] + Math.sin(a) * 11;
      p.add(new THREE.BoxGeometry(1.9, 0.45, 0.5), 0x9ea2a6, x, h(x, z) + 0.23, z, -a + Math.PI / 2);
    }
    // the round flower beds
    for (const [x, z, r] of [[2091.6, 3190.0, 2.4], [2115.8, 3175.6, 2.2]]) {
      p.add(new THREE.CylinderGeometry(r, r, 0.3, 28), 0x5e4a3c, x, h(x, z) + 0.12, z);
      const fl = [];
      for (let k = 0; k < 9; k++) { const a = k * 2.4, d = (k % 3) * r * 0.3; fl.push([x + Math.cos(a) * d, z + Math.sin(a) * d, 1.0, 0.45, k % 2 ? [1.0, 0.62, 0.18] : [1.0, 0.82, 0.25]]); }
      A.bushes(fl);
    }
    // the flags at the plaza's street edge
    const pole = new THREE.CylinderGeometry(0.06, 0.08, 10, 6);
    const flags = [[0xec6b2d, 0xec6b2d], [0x0057b7, 0xffd700], [0x0072ce, 0xffffff], [0xec6b2d, 0xec6b2d], [0xd52b1e, 0xffffff]];
    flags.forEach(([c1, c2], k) => {
      const t = k / (flags.length - 1), x = 2083.0 + (2094.0 - 2083.0) * t, z = 3188.5 + (3203.0 - 3188.5) * t;
      p.add(pole, 0xf2f2f0, x, h(x, z) + 5, z);
      const fx = x + AF.V[0] * 0.75, fz = z + AF.V[1] * 0.75, yaw = Math.atan2(AF.V[0], AF.V[1]);
      p.add(new THREE.BoxGeometry(0.03, 0.75, 1.4), c1, fx, h(x, z) + 9.2, fz, yaw);
      p.add(new THREE.BoxGeometry(0.03, 0.75, 1.4), c2, fx, h(x, z) + 8.45, fz, yaw);
    });
    // the canopy over the door, its solar panels and the screen at its edge
    A.box(AF, 38.7, 4.2, 8.5, 8.4, 5.0, 5.35, 0x5b5f64);
    A.box(AF, 38.7, 4.2, 8.1, 8.0, 5.35, 5.45, 0x2a3446);
    for (const s of [34.9, 42.5]) A.box(AF, s, 8.0, 0.25, 0.25, 0, 5.0, 0x6b6f74);
    const scr = paintTexture(3.2, 0, 2.4, 50, (P) => {
      P.r(0, 0, 3.2, 2.4, '#16181c');
      const cs = ['#3da5e0', '#e94e3c', '#f2b632', '#8bc34a', '#c06bd6', '#ec6b2d'];
      for (let k = 0; k < 8; k++) P.arc(0.4 + (k % 4) * 0.8, 1.75 - Math.floor(k / 4) * 0.55, 0.2, cs[k % cs.length]);
      P.text('Arendavad mänguasjad', 1.6, 0.62, 0.17, '#ffffff', SANS); P.text('AHHAA teaduspoest!', 1.6, 0.36, 0.17, '#ffffff', SANS);
    });
    const sm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 0.15), [0x2a2c30, 0x2a2c30, 0x2a2c30, 0x2a2c30].map((c) => new THREE.MeshLambertMaterial({ color: c })).concat([new THREE.MeshLambertMaterial({ map: scr }), new THREE.MeshLambertMaterial({ map: scr })]));
    const [sx, sz] = AF.at(39.0, 8.6);
    sm.position.set(sx, h(sx, sz) + 2.1, sz); sm.rotation.y = AF.YAW; group.add(sm);
    for (const ds of [-1.3, 1.3]) A.box(AF, 39.0 + ds, 8.6, 0.12, 0.12, 0, 0.9, 0x3a3d42);

    // ---- Turu 8: the clipped hedge between the cycle path and its lawn
    A.hedge([TURU.at(114, -21.0), TURU.at(180, -19.65)], 1.15, 1.3, [0.45, 0.66, 0.42]);

    // ---- Tigutorn: the thujas on the lawn beside it
    const th = [];
    for (let k = 0; k < 6; k++) { const t = k / 5; th.push([2199.5 + 8.0 * t, 3209.5 + 4.0 * t, 1.0, 2.6, [0.38, 0.58, 0.42]]); }
    A.bushes(th);

    // ---- Väike-Turu 3: the white round stair tower with the red letters at the north-west corner
    const C = [2164.6, 3139.6], gc = h(C[0], C[1]);
    p.add(new THREE.CylinderGeometry(2.6, 2.6, 11.2, 24), 0xeeeeea, C[0], gc + 5.6, C[1]);
    p.add(new THREE.CylinderGeometry(2.65, 2.65, 0.3, 24), 0xd6d6d1, C[0], gc + 11.2, C[1]);
    const slot = paintTexture(0.7, 0, 7.0, 20, (P) => { P.r(0, 0, 0.7, 7, '#2f3a44'); for (let y = 0.8; y < 7; y += 1.4) P.r(0, y, 0.7, y + 0.06, '#d6d6d1'); });
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 7.0), new THREE.MeshLambertMaterial({ map: slot }));
    const out = [-0.69, -0.73];
    sl.position.set(C[0] + out[0] * 2.62, gc + 6.2, C[1] + out[1] * 2.62); sl.rotation.y = Math.atan2(out[0], out[1]); group.add(sl);
    const krc = paintTexture(2.6, 0, 1.0, 40, (P) => { P.r(0, 0, 2.6, 1.0, '#d6282e'); P.text('KRC', 1.3, 0.5, 0.75, '#ffffff', SANS); });
    const km = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.12), [0xd6282e, 0xd6282e, 0xd6282e, 0xd6282e].map((c) => new THREE.MeshLambertMaterial({ color: c })).concat([new THREE.MeshLambertMaterial({ map: krc }), new THREE.MeshLambertMaterial({ map: krc })]));
    km.position.set(C[0], gc + 11.95, C[1]); km.rotation.y = Math.atan2(out[0], out[1]); group.add(km);

    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([[2067, 3244], [2145, 3220], [2225, 3213], [2185, 3168]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
