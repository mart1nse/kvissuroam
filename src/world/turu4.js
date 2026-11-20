// Turu tänav, batch 4: Aura, Zeppelin and the flats across Turu (Martin, 20 Nov: kaardista, his Street View
// shots of Jun/Jul 2023 and Aug 2024, the Land Board's oblique air photos of 2023/2024).
//  - Aura veekeskus (Turu 10): glass in silver frames over a white band, the roof line rising to the east
//    over the entrance front, the sloping white band of the stair, the gold letters at the Turu corner, the
//    row of beige flags with the blue ring by Turu;
//  - Zeppelin (Turu 14): silver ribbed sheet, the huge dark ZEPPELIN letters, the Maxima XX band over the
//    shop windows, the steel frame front with the shop signs and the green sale banner;
//  - the car park between them, full of cars;
//  - Turu 9: white, the gold and ochre mural of roots and branches on its end to the north-west;
//  - Turu 11: salmon pink with stacks of red balconies; Turu 13 behind it yellow (colours only).
// The map's own blocks keep their shapes and get painted walls.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { TURU } from './turu.js';

const DEBUG = typeof location !== 'undefined' && /turudebug/.test(location.search);
const S6 = ['4_6', 1760, 3040];
const SANS = '700 %px Arial, sans-serif';
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['aura', S6, -207, [2140, 3320], 62, 0xd9dcde, 0x6f7a88],
  ['zep', S6, -198, [2250, 3415], 62, 0xa9adb1, 0x55585c],
  ['zep2', S6, 416, [2229, 3398], 20, 0x4a4f55, 0x55585c],
  ['turu9', S6, -5, [2037, 3341], 26, 0xeeeee9, 0x5d6066],
  ['turu11', S6, 88, [2071, 3380], 34, 0xd58e78, 0xa8463a],
];
const ZEP = [2250, 3415], AURA = [2140, 3320];

export function turu4Walls(walls) {
  setHouseColours(walls, S6[0], S6[1], S6[2], HOUSES.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  // Turu 13 behind Turu 11: yellow (its base is shared with Aleksandri 14, so an entry of its own)
  addHouseColours(walls, S6[0], S6[1], S6[2], [{ base: 99, x: 2037, z: 3410, wall: 0xe7cf73, roof: 0x5d6066, reach: 30 }]);
}
// the map's own box signs on Zeppelin and Aura give way to the painted ones
export function turu4SignSkip(world) {
  const prev = world.signSkip;
  world.signSkip = (x, z) => Math.hypot(x - ZEP[0], z - ZEP[1]) < 64 || Math.hypot(x - AURA[0], z - AURA[1]) < 58 || (prev ? prev(x, z) : false);
}

function glassBand(P, x0, x1, y0, y1, top = '#7f97a8', bottom = '#43586a', mull = '#2f3438', bay = 1.5) {
  P.grad(x0, y0, x1, y1, top, bottom);
  for (let x = x0; x <= x1 + 0.01; x += bay) P.r(x - 0.04, y0, x + 0.04, y1, mull);
}

// ---------------------------------------------------------------- Aura
function auraGlass(P, W, x0, x1, y0) {
  // tall panes in silver frames up to the roof line, a transom half way
  for (let x = x0; x < x1; x += 0.5) {
    const t = W.topAt(x) - 0.7;
    if (t > y0 + 0.4) { P.grad(x, y0, Math.min(x1, x + 0.5), t, '#9ab3c4', '#4f6878'); P.r(x, t, Math.min(x1, x + 0.5), t + 0.7, '#e9ebec'); }
  }
  for (let x = x0; x < x1; x += 2.4) P.r(x - 0.06, y0, x + 0.06, W.topAt(x) - 0.6, '#c9cdd0');
  for (let x = x0; x < x1; x += 0.6) { const t = W.topAt(x) - 0.7; if (t > y0 + 2.6) P.r(x, y0 + (t - y0) * 0.5 - 0.05, Math.min(x1, x + 0.6), y0 + (t - y0) * 0.5 + 0.05, '#c9cdd0'); }
}
function aura(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#e3e5e6');
  if (W.foot > 2) { auraGlass(P, W, 0, len, Math.max(P.y0, W.foot)); return; }
  P.r(0, P.y0, len, 0.35, '#9a9c9e');
  if (dot(W, [-0.72, 0.69]) > 0.95 && len > 40) {
    // the Turu front: glass at the ground, a white band, tall glass above; the gold letters at the south corner
    glassBand(P, 0.3, len - 0.3, 0.35, 3.0, '#7d93a2', '#3f5262', '#c9cdd0', 1.6);
    P.r(0, 3.0, len, 3.9, '#eceeef');
    auraGlass(P, W, 0.2, len - 0.2, 3.9);
    const t = W.topAt(len - 9) - 0.2;
    P.r(len - 17, t - 1.25, len - 1.5, t + 0.05, '#e9ebec');
    P.text('AURA VEEKESKUS', len - 9.2, t - 0.6, 0.95, '#c79a2e', SANS);
    return;
  }
  if (dot(W, [0.29, 0.96]) > 0.95 && len > 30) {
    // the entrance front: the stair's white band sloping up from the west end, the doors in the middle
    const x1 = len * 0.33;
    glassBand(P, 0.3, len - 0.3, 0.35, 3.6, '#7d93a2', '#3f5262', '#c9cdd0', 1.5);
    P.r(x1, 3.6, len, 4.7, '#eceeef');
    auraGlass(P, W, x1, len - 0.2, 4.7);
    auraGlass(P, W, 0.2, x1, 3.6);
    P.poly([[0.6, 0.35], [1.6, 0.35], [x1 + 0.4, 3.6], [x1 + 0.4, 4.7], [x1 - 0.6, 4.7]], '#eceeef');
    const d = len * 0.55;
    P.r(d - 2.6, 0.35, d + 2.6, 2.9, '#2d3237');
    for (const x of [d - 2.5, d - 1.25, d, d + 1.25]) P.grad(x + 0.08, 0.4, x + 1.17, 2.8, '#8aa1b2', '#4a5e6e');
    P.r(d + 3.2, 1.2, d + 5.4, 2.6, '#1f4f9a'); P.text('AURA', d + 4.3, 2.2, 0.36, '#ffffff', SANS); P.text('VEEKESKUSE PARKLA', d + 4.3, 1.6, 0.16, '#ffffff', SANS);
    return;
  }
  // the back and the north-west end: white panels with a strip of glass
  for (let x = 0; x < len; x += 1.5) P.r(x, 0.35, x + 0.025, P.y1, '#d3d6d8');
  if (len > 8) glassBand(P, 1.0, len - 1.0, Math.min(W.peak - 2.4, 4.2), Math.min(W.peak - 0.6, 6.4), '#8fa6b6', '#55697a', '#c9cdd0', 1.6);
}

// ---------------------------------------------------------------- Zeppelin
function ribs(P, x0, x1, y0, y1, base = '#b3b7bb') {
  P.r(x0, y0, x1, y1, base);
  for (let x = x0; x < x1; x += 0.3) P.r(x, y0, x + 0.09, y1, '#9ea3a8');
}
function zepLetters(P, x0, x1, y0, h) {
  // letter by letter, each as wide as it is in Arial Black, the word fitted to the wall
  const t = 'ZEPPELIN', wd = [0.68, 0.66, 0.66, 0.66, 0.66, 0.6, 0.32, 0.74], sum = wd.reduce((a, b) => a + b, 0) + 0.06 * (t.length - 1);
  const hh = Math.min(h, (x1 - x0) / sum), sp = (x1 - x0 - hh * sum) / 2;
  let x = x0 + sp;
  for (let k = 0; k < t.length; k++) { P.text(t[k], x + wd[k] * hh / 2, y0 + hh * 0.5, hh, '#3c3f44', '900 %px Arial, sans-serif'); x += (wd[k] + 0.06) * hh; }
}
function zep(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1);
  P.r(0, P.y0, len, 0.4, '#6b6f74');
  if (W.foot > 2) return;
  if (dot(W, [-0.70, -0.72]) > 0.95 && len > 60) {
    // the car park front: the letters, the Maxima band over the shop windows, the steel frame front
    zepLetters(P, 1.5, 34, 1.2, Math.min(7.2, top - 2.6));
    P.r(36, top - 3.6, 56, top - 0.8, '#2b2d31');
    P.text('MAXIMA', 43.5, top - 2.2, 1.7, '#1e4fa6', '900 %px Arial, sans-serif');
    P.r(51.5, top - 3.1, 54.5, top - 1.3, '#ffffff'); P.text('XX', 53, top - 2.2, 1.3, '#d6282e', '900 %px Arial, sans-serif');
    glassBand(P, 36, 56, 0.4, 3.6, '#8aa0b0', '#46586a', '#2e3236', 1.6);
    P.r(36, 3.6, 56, 4.4, '#2e3236');
    // the steel frame front: two floors of grey glass behind a grid of steel
    P.r(56, P.y0, len, top, '#55595e');
    glassBand(P, 56.3, len - 0.3, 0.4, top - 0.4, '#7c8d99', '#3c4852', '#2b2e31', 1.2);
    for (let x = 56; x < len; x += 4.1) P.r(x, 0, x + 0.25, top, '#c9ccce');
    for (const y of [4.2, 8.2]) P.r(56, y, len, y + 0.25, '#c9ccce');
    for (let x = 57; x < len - 1; x += 4.1) for (const y of [4.6, 8.6]) { P.line(x, y, x + 3.6, y + 3.3, '#c9ccce', 0.12); }
    const signs = [['POP SPORT', '#ffffff', '#2b2d31'], ['HOME 4 YOU', '#ffffff', '#2b2d31'], ['OHOO', '#ffffff', '#e94e1b'], ['REALISEERIMISKESKUS', '#ffffff', '#2b2d31'], ['BENU Apteek', '#ffffff', '#2f7f3f']];
    signs.forEach(([s, c, b], k) => {
      const x = 59 + (k % 3) * 7.2, y = k < 3 ? 6.2 : 2.7;
      P.r(x - 2.9, y - 0.45, x + 2.9, y + 0.45, b); P.text(s, x, y, s.length > 12 ? 0.32 : 0.55, c, SANS);
    });
    P.r(len - 6.2, top - 6.4, len - 1.2, top - 0.6, '#45a843');
    P.text('-60%', len - 3.7, top - 4.2, 1.5, '#e8262a', '900 %px Arial, sans-serif'); P.text('HOME 4 YOU', len - 3.7, top - 1.4, 0.4, '#ffffff', SANS);
    return;
  }
  if (dot(W, [0.72, -0.70]) > 0.95 && len > 20) { zepLetters(P, 1, len - 1, 1.6, Math.min(5.5, top - 3)); return; }
  if (dot(W, [-0.71, 0.71]) > 0.95 && len > 30) {                                   // the Turu end: a big poster
    P.r(len * 0.55, 2.5, len * 0.55 + 8, 8.5, '#f2f2f0'); P.r(len * 0.55 + 0.4, 2.9, len * 0.55 + 7.6, 8.1, '#2f6fb3');
    P.text('ZEPPELIN', len * 0.55 + 4, 6.6, 1.0, '#ffffff', SANS); P.text('Turu 14', len * 0.55 + 4, 4.6, 0.6, '#ffffff', SANS);
  }
}
function zep2(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#3e4348');
  glassBand(P, 0.2, len - 0.2, 0.3, Math.max(0.8, W.peak - 0.4), '#7c8d99', '#3c4852', '#c9ccce', 1.2);
}

// ---------------------------------------------------------------- Turu 9 and Turu 11
function mural(P, x0, x1, y0, y1, seed) {
  const r = rnd(seed), w = x1 - x0, cx = x0 + w / 2;
  P.r(x0, y0, x1, y1, '#f1efe8');
  const cols = ['#c9a24a', '#e0b85c', '#8a6236', '#b9812f', '#f6e7b8', '#6b5a49', '#d9c08a'];
  for (let k = 0; k < 70; k++) {                                         // the gold and ochre ground of the picture
    const x = x0 + r() * w, y = y0 + r() * (y1 - y0), rr = 0.4 + r() * 1.8, n = 5 + Math.floor(r() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * 0.5; pts.push([x + Math.cos(a) * rr * (0.6 + r() * 0.6), y + Math.sin(a) * rr * (0.6 + r() * 0.6)]); }
    P.poly(pts, cols[Math.floor(r() * cols.length)]);
  }
  // the trunk and its roots and branches
  const branch = (x, y, a, l, wd, d) => {
    if (d > 5 || wd < 0.08) return;
    const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
    P.line(x, y, x2, y2, '#4a3726', wd); P.line(x, y, x2, y2, '#d9b45e', wd * 0.35);
    branch(x2, y2, a + 0.35 + r() * 0.3, l * 0.72, wd * 0.68, d + 1);
    branch(x2, y2, a - 0.35 - r() * 0.3, l * 0.72, wd * 0.68, d + 1);
  };
  branch(cx, y0 + (y1 - y0) * 0.35, Math.PI / 2, (y1 - y0) * 0.22, 1.1, 0);
  branch(cx, y0 + (y1 - y0) * 0.35, -Math.PI / 2 + 0.5, (y1 - y0) * 0.12, 0.7, 2);
  branch(cx, y0 + (y1 - y0) * 0.35, -Math.PI / 2 - 0.5, (y1 - y0) * 0.12, 0.7, 2);
}
function flats(P, W, { wall, plinth, balc = null, seed }) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, wall); P.weather(0, P.y0, len, P.y1, 0.35, seed);
  P.r(0, P.y0, len, 1.0, plinth);
  if (len < 14) return;
  for (let y = 1.6; y + 1.5 < top - 0.8; y += 2.8) {
    for (let x = 1.4; x < len - 1.6; x += 3.2) {
      P.win(x, y, x + 1.45, y + 1.45, { frame: '#f6f5f2', glass: '#56677b', fw: 0.07, bars: 1, T: true, surround: 0, sill: 0.06 });
      if (balc && Math.floor((x - 1.4) / 3.2) % 3 === 1 && y > 2) {         // a stack of balconies
        P.r(x - 0.8, y - 0.55, x + 2.25, y + 0.35, balc); P.r(x - 0.8, y + 0.35, x + 2.25, y + 0.45, '#f2f2ee');
      }
    }
  }
  for (const x of [len * 0.25, len * 0.75]) P.door(x - 0.7, x + 0.7, 2.2, '#6b4b3a', { frame: '#e8e6e0' });
}
function turu9(P, W) {
  if (dot(W, [-0.52, -0.85]) > 0.95) { mural(P, 0, W.len, P.y0, W.peak, 4242); return; }
  flats(P, W, { wall: '#efeee9', plinth: '#a9a8a2', seed: 9 });
}
function turu11(P, W) {
  flats(P, W, { wall: '#d58e78', plinth: '#9b7466', balc: dot(W, [0.85, -0.52]) > 0.95 ? '#c4532f' : null, seed: 11 });
}

const PAINT = { aura, zep, zep2, turu9, turu11 };

// the car park between Aura and Zeppelin: double rows parallel to Aura's entrance front
const CP = frame([2138.8, 3362.8], [0.956, -0.293]);                       // v + = away from Aura, toward Zeppelin
export const TURU4_CARS = [];
{
  const yaw = Math.atan2(CP.V[0], -CP.V[1]);                               // nose toward Zeppelin
  const ids = ['passat', 'rav4', 'mazda6', 'model3', 'accord', 'bz4x', 'f31'], paints = ['grey', 'black', 'white', 'silver', 'blue', 'red'];
  const rows = [[23, [42, 47.5, 53, 58.5, 64, 69.5], 0], [17.5, [45, 56, 61.5, 67], Math.PI], [40, [50, 55.5, 66.5], Math.PI], [45.5, [53, 64, 69.5], 0]];
  let k = 0;
  for (const [v, list, turn] of rows) for (const s of list) { TURU4_CARS.push([...CP.at(s, v), yaw + turn, ids[k % ids.length], paints[(k * 5) % paints.length], 0.03]); k++; }
}

export function createTuru4(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [2150, 3370];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map(([name, S, base, at, r]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 11, far: 6, faces: (W) => W.len > 6 && W.foot < 2, debug: DEBUG });

    // the row of Aura's flags by Turu, south of the building
    const pole = new THREE.CylinderGeometry(0.06, 0.08, 10, 6), flag = new THREE.BoxGeometry(0.03, 2.2, 1.0), ring = new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16).rotateZ(Math.PI / 2);
    for (const s of [289, 293.5, 298, 302.5, 307, 311.5]) {
      const [x, z] = TURU.at(s, -22.5), g = h(x, z);
      p.add(pole, 0xf2f2f0, x, g + 5, z);
      p.add(flag, 0xd9b38a, x + TURU.V[0] * 0.55, g + 8.7, z + TURU.V[1] * 0.55, TURU.YAW);
      p.add(ring, 0x2f6fb3, x + TURU.V[0] * 0.55, g + 8.9, z + TURU.V[1] * 0.55, TURU.YAW);
    }
    pole.dispose(); flag.dispose(); ring.dispose();
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([[2140, 3320], [2250, 3415], [2037, 3341], [2071, 3380]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
