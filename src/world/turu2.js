// Turu tänav, batch 2: Soola and Kaluri behind the Circle K corner (Martin, 20 Nov: kaardista, his Street
// View shots of Jul 2023 and Aug 2024, the Land Board's oblique air photos of 2023/2024).
//  - Kaluri 2: the brown brick end to Soola with its scatter of small square windows, the long glass and
//    brown-ribbon side along Kaluri with the GO Travel letters, the dark recessed ground floor on brown
//    columns, the tenants' pylon on the lawn;
//  - Soola 3, the hotel: white render, rows of windows, its name on the top;
//  - the glass office at the north-east end of the same block: green glass ribbons in rust-brown frames;
//  - Tasku's car park on Soola: speckled stone panels, the blue glass strip and band, the canopy over the
//    EuroPark entrance and the car wash doors, the bus station letters further on.
// The map's own blocks keep their shapes and get painted walls (Tasku's other walls are keskus.js's).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';

const DEBUG = typeof location !== 'undefined' && /turudebug/.test(location.search);
const S6 = ['4_6', 1760, 3040];
const SANS = '700 %px Arial, sans-serif';
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];

// the hotel and the office share one LOD base: along the block from Kaluri 2 (p = 0) the office starts at 66 m
const along = (x, z) => (x - 2038) * 0.72 - (z - 3134) * 0.70;
// Tasku's car park face on Soola (Tasku keeps its other walls)
const onSoola = (x, z) => {
  for (const [a, b] of [[[1979.1, 3083.0], [2021.9, 3040.7]], [[1959.1, 3101.7], [1973.6, 3087.5]]]) {
    const ux = b[0] - a[0], uz = b[1] - a[1], l = Math.hypot(ux, uz), t = ((x - a[0]) * ux + (z - a[1]) * uz) / l;
    if (t > -0.5 && t < l + 0.5 && Math.abs(((x - a[0]) * uz - (z - a[1]) * ux) / l) < 0.6) return true;
  }
  return false;
};
// [name, sector, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['kaluri2', S6, -26, [2029, 3130], 26, 0x6b3b2e, 0x4e5054],
  ['hotel', S6, -39, [2075, 3105], 42, 0xeeeeea, 0x5d6066],
  ['park', S6, -38, [1993, 3068], 42, null, null, onSoola],
];

export function turu2Walls(walls) {
  setHouseColours(walls, S6[0], S6[1], S6[2], HOUSES.filter((H) => H[5] !== null).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

function glassBand(P, x0, x1, y0, y1, top = '#7f97a8', bottom = '#43586a', mull = '#2f3438', bay = 1.5) {
  P.grad(x0, y0, x1, y1, top, bottom);
  for (let x = x0; x <= x1 + 0.01; x += bay) P.r(x - 0.04, y0, x + 0.04, y1, mull);
}

// ---------------------------------------------------------------- Kaluri 2
function kaluri2(P, W) {
  const len = W.len, top = W.peak, brown = '#6e3a2b';
  if (W.foot > 12) { P.r(0, P.y0, len, P.y1, '#5a5c60'); return; }
  P.brick(0, P.y0, len, P.y1, [112, 60, 44], 11);
  // the dark recessed ground floor between brown columns
  P.r(0, P.y0, len, 3.9, '#2b2522');
  for (let x = 0.4; x < len - 0.3; x += 5.2) P.r(x, 0, x + 0.7, 3.9, '#6a3a2c');
  for (let x = 1.4; x < len - 1; x += 5.2) glassBand(P, x, Math.min(len - 0.4, x + 3.9), 0.15, 3.6, '#5b6e7e', '#2f3c48');
  if (dot(W, [-0.78, -0.63]) > 0.9 || dot(W, [0.59, 0.81]) > 0.9) {        // the narrow ends: small square windows scattered
    let seed = Math.round(W.mid[0] * 13 + W.mid[1] * 7);
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 4.6; y < top - 1.2; y += 0.95) for (let x = 0.8; x < len - 0.8; x += 1.05) {
      if (r() > 0.3) continue;
      const s = 0.45 + r() * 0.25, dx = (r() - 0.5) * 0.4;
      P.r(x + dx - 0.04, y - 0.04, x + dx + s + 0.04, y + s + 0.04, '#3b2a24');
      P.grad(x + dx, y, x + dx + s, y + s, '#8fa9c2', '#4c6a88');
    }
    return;
  }
  // the long sides: glass ribbons between brown spandrels
  for (let y = 4.2; y < top - 0.6; y += 3.25) {
    glassBand(P, 0.2, len - 0.2, y + 0.75, y + 3.05, '#8aa4b8', '#4a6276', '#3a3634', 1.8);
    P.r(0, y, len, y + 0.75, brown);
  }
  P.r(0, top - 0.6, len, top, '#5a3226');
  if (dot(W, [-0.72, 0.70]) > 0.9 && len > 20) {                            // the Kaluri side, toward Circle K
    P.text('GO Travel', len * 0.3, top - 0.1 + 0.9, 0.9, '#2d3b4f', SANS);
    P.text('KPMG', len * 0.75, top - 4.0 + 0.4, 0.6, '#ffffff', SANS);
    P.text('FINTECH MARKET', len * 0.4, 7.85, 0.42, '#7fbf6a', SANS);
  }
}

// ---------------------------------------------------------------- Soola 3 and the office on its end
function hotel(P, W) {
  const len = W.len, top = W.peak;
  if (W.foot > 12) { P.r(0, P.y0, len, P.y1, '#8f9398'); return; }
  // where along the block each end of the wall stands: the office from 66 m on
  const pa = along(W.a[0], W.a[1]), pb = along(W.b[0], W.b[1]);
  const xo = Math.abs(pb - pa) < 1 ? (pa > 66 ? 0 : len + 1) : Math.min(len, Math.max(0, (66 - pa) / (pb - pa) * len));
  const off = pb > pa ? [xo, len] : [0, xo];                     // the office's stretch of this wall
  // the hotel: white render, a grey plinth, rows of windows
  P.r(0, P.y0, len, P.y1, '#efeeea'); P.weather(0, P.y0, len, P.y1, 0.4, 4);
  P.r(0, P.y0, len, 0.7, '#8e8c8a');
  for (let y = 1.2; y < Math.min(top, 17) - 2; y += 3.0) {
    for (let x = 1.2; x < len - 1.4; x += 2.35) {
      if (x + 1.3 > off[0] - 0.5 && x < off[1] + 0.5) continue;
      P.win(x, y, x + 1.3, y + 1.5, { frame: '#f6f5f2', glass: '#56677b', fw: 0.07, bars: 1, T: false, surround: 0, sill: 0.06 });
    }
  }
  if (dot(W, [-0.70, -0.72]) > 0.9 && len > 20 && off[1] - off[0] < len - 10) {
    const xc = off[0] > 1 ? off[0] / 2 : (off[1] + len) / 2;
    P.r(xc - 5.2, Math.min(top, 16.6) - 1.6, xc + 5.2, Math.min(top, 16.6) - 0.2, '#ffffff');
    P.text('HOTELL TARTU', xc, Math.min(top, 16.6) - 0.9, 1.05, '#c8102e', SANS);
  }
  // the office: green glass ribbons in rust-brown frames
  if (off[1] - off[0] > 0.5) {
    const [x0, x1] = off;
    P.r(x0, P.y0, x1, P.y1, '#8a4a2a');
    for (let y = 3.9; y < top - 0.8; y += 3.4) { P.r(x0, y, x1, y + 0.6, '#9a5532'); glassBand(P, x0 + 0.6, x1 - 0.6, y + 0.6, y + 3.4, '#7fa59b', '#3e5f58', '#2c3a36', 1.6); }
    glassBand(P, x0 + 0.6, x1 - 0.6, 0.2, 3.6, '#5e7a73', '#2f4540', '#2c3a36', 1.6);
    P.r(x0, top - 0.8, x1, top, '#7b4024');
  }
}

// ---------------------------------------------------------------- Tasku's car park on Soola
function park(P, W) {
  const len = W.len, top = W.peak;
  // speckled stone panels in a 1.2 x 3 m grid
  P.r(0, P.y0, len, P.y1, '#d9d3c7');
  let seed = 31;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < len * top * 3; k++) { const x = r() * len, y = r() * top; P.r(x, y, x + 0.05, y + 0.05, r() < 0.5 ? '#bdb6a8' : '#ece7dd'); }
  for (let y = 0; y < top; y += 3.0) P.r(0, y, len, y + 0.03, '#c3bcb0');
  for (let x = 0; x < len; x += 1.2) P.r(x, 4.4, x + 0.025, top, '#c9c2b6');
  P.r(0, 4.1, len, 4.45, '#eeeeec');                                 // the canopy's edge along the ground floor
  if (len < 30) {
    // the Turu end: the EuroPark entrance and the car wash doors
    P.r(len * 0.25, 2.95, len * 0.25 + 8.8, 4.05, '#1f2b46');
    P.arc(len * 0.25 + 0.6, 3.5, 0.38, '#2a63b5'); P.text('P', len * 0.25 + 0.6, 3.5, 0.45, '#ffffff', SANS);
    P.text('EuroPark', len * 0.25 + 2.6, 3.62, 0.45, '#ffffff', SANS); P.text('TASKU PARKIMISMAJA', len * 0.25 + 2.6, 3.2, 0.2, '#ffffff', SANS);
    P.text('AUTOPESULA', len * 0.25 + 6.9, 3.3, 0.26, '#ffffff', SANS);
    for (const x0 of [len * 0.25, len * 0.25 + 4.9]) { P.r(x0 + 0.1, 0, x0 + 3.9, 2.85, '#eeeeec'); for (let y = 0.3; y < 2.8; y += 0.3) P.r(x0 + 0.1, y, x0 + 3.9, y + 0.04, '#cfcfcd'); }
    P.r(len * 0.25 + 4.0, 0, len * 0.25 + 4.8, 2.9, '#1f2b46');
    glassBand(P, 0.4, len * 0.25 - 0.6, 0.1, 3.0, '#8a9ca8', '#4c5d6a', '#5a5d61', 1.4);
    P.boards(len - 4.5, 0, len, top * 0.55, [122, 92, 66], 0.18, true);
    glassBand(P, len * 0.25 - 2.2, len * 0.25 - 1.4, 4.45, top - 0.5, '#4e78b8', '#26457c', '#1e2a40', 0.8);
    return;
  }
  // the long face: the blue glass band along the top, two glass strips, the bus station at the far end
  glassBand(P, 0, len, top - 3.6, top - 0.3, '#4e78b8', '#2b4c86', '#1e2a40', 1.5);
  for (const x of [len * 0.22, len * 0.55]) glassBand(P, x, x + 0.9, 4.45, top - 3.6, '#4e78b8', '#26457c', '#1e2a40', 0.9);
  glassBand(P, 1, len * 0.62, 0.15, 3.6, '#7f92a0', '#46586a', '#5a5d61', 1.6);
  P.r(len * 0.64, P.y0, len, 4.1, '#3a3d42');
  glassBand(P, len * 0.65, len - 0.8, 0.15, 3.0, '#7f92a0', '#3d4e5e', '#2d2f33', 1.6);
  P.text('Tartu Bussijaam', len * 0.82, 3.55, 0.75, '#e2231a', SANS);
}

const PAINT = { kaluri2, hotel, park };

// (the cars that stood along Kaluri here are now in the bays and on the cobbles of kaluri.js)
export const TURU2_CARS = [];

export function createTuru2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [2030, 3090];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const houses = HOUSES.map(([name, S, base, at, r, , , pick]) => ({ name, sec: S[0], base, at, r, pick, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 13, far: 6, faces: (W) => W.foot < 2 && W.len > 8, debug: DEBUG });
    const { p, h } = A;
    // the canopy over the car park's ground floor on Soola
    A.bar([1979.4, 3083.3], [2006, 3057], 1.6, 4.1, 4.4, 0xeeeeec);
    A.bar([1959.4, 3102.0], [1973.9, 3087.8], 1.6, 4.1, 4.4, 0xeeeeec);
    // the tenants' pylon on Kaluri 2's lawn by Soola
    const tex = paintTexture(1.4, 0, 3.6, 40, (P) => {
      P.r(0, 0, 1.4, 3.6, '#7a3f2c'); P.text('KALURI 2', 0.7, 3.35, 0.16, '#e9d8c8', SANS);
      [['CWT', '#ffffff'], ['NOTAR', '#ffffff'], ['Judent', '#ffffff'], ['PZU', '#ffffff']].forEach(([t, c], k) => P.text(t, 0.7, 2.8 - k * 0.62, 0.22, c, SANS));
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.6, 0.3), [0x7a3f2c, 0x7a3f2c, 0x7a3f2c, 0x7a3f2c].map((c) => new THREE.MeshLambertMaterial({ color: c })).concat([new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex })]));
    m.position.set(2004.5, h(2004.5, 3108.5) + 1.8, 3108.5); m.rotation.y = Math.atan2(-0.78, -0.63); m.castShadow = shadows; group.add(m);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([[2029, 3130], [2091, 3080], [1993, 3068]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
