// Turu tänav, batch 6: the Aleksandri side of the block and the Dorpat hotel (Martin, 20 Nov: kaardista).
// Built from the Land Board's oblique air photos of 2024 (Tier B); the map's own blocks get painted walls:
//  - Aleksandri 8a/8b: the yellow L-shaped house with the red roof behind Turu 3;
//  - Aleksandri 10: ochre, three floors, grey roof;
//  - Aleksandri 12: the long grey five-storey block with the solar roof, behind Turu 13;
//  - Dorpat hotel (Soola 6) by the bus station: dark red-brown brick grid with dark glass, its name on top.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';

const DEBUG = typeof location !== 'undefined' && /turudebug/.test(location.search);
const S6 = ['4_6', 1760, 3040], S5 = ['4_5', 1760, 2400];
const SANS = '700 %px Arial, sans-serif';
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];

// [name, sector, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['alek8b', S6, 119, [1938, 3306], 30, 0xe0bf72, 0xa94b38, (x) => x > 1915],
  ['alek8a', S6, 165, [1919, 3311], 18, 0xe0bf72, 0xa94b38],
  ['alek10', S6, 245, [1950, 3346], 26, 0xc98f55, 0x6a6763],
  ['alek12', S6, 215, [2002, 3441], 36, 0xd8d8d3, 0x3a4250],
  ['dorpat', S5, -68, [2032, 2981], 46, 0x633a31, 0x55585c],
];
const CENTRE = [1990, 3180];

export function turu6Walls(walls) {
  for (const S of [S6, S5]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

function plaster(P, W, { wall, plinth, frame = '#f6f4ee', glass = '#55667a', step = 3.0, pitch = 3.0, seed, doors = 2 }) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, wall); P.weather(0, P.y0, len, P.y1, 0.35, seed);
  P.r(0, P.y0, len, 0.9, plinth);
  if (len < 8) return;
  for (let y = 1.5; y + 1.5 < top - 0.7; y += step) {
    for (let x = 1.3; x < len - 1.5; x += pitch) P.win(x, y, x + 1.2, y + 1.5, { frame, glass, fw: 0.08, bars: 1, rails: 1, sill: 0.07 });
  }
  if (len > 20 && doors) for (let k = 1; k <= doors; k++) { const x = len * k / (doors + 1); P.door(x - 0.65, x + 0.65, 2.3, '#5a4434', { frame }); }
}
const alek8b = (P, W) => plaster(P, W, { wall: '#e2c178', plinth: '#9b8a6a', seed: 81 });
const alek8a = (P, W) => plaster(P, W, { wall: '#e2c178', plinth: '#9b8a6a', seed: 82, doors: 1 });
const alek10 = (P, W) => plaster(P, W, { wall: '#cb915a', plinth: '#8a6b55', seed: 10, step: 3.2 });
function alek12(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#dadad5'); P.weather(0, P.y0, len, P.y1, 0.3, 12);
  P.r(0, P.y0, len, 1.0, '#9fa09c');
  if (len < 14) return;
  for (let y = 1.6; y + 1.5 < top - 0.8; y += 2.8) {
    for (let x = 1.4; x < len - 1.6; x += 3.2) P.win(x, y, x + 1.45, y + 1.45, { frame: '#f6f5f2', glass: '#56677b', fw: 0.07, bars: 1, T: true, sill: 0.06 });
  }
  if (dot(W, [-0.72, 0.69]) > 0.9) for (const x of [len * 0.2, len * 0.5, len * 0.8]) P.door(x - 0.7, x + 0.7, 2.2, '#6b4b3a', { frame: '#e8e6e0' });
}
function dorpat(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#633a31'); P.weather(0, P.y0, len, P.y1, 0.25, 6);
  if (len < 8) return;
  P.r(0, P.y0, len, 0.4, '#3d3a38');
  glassBand_(P, 0.4, len - 0.4, 0.4, 3.6);                                 // the glass ground floor
  for (let y = 4.4; y + 1.9 < top - 1.2; y += 3.0) {                        // a dark glass grid in the brick
    for (let x = 0.9; x < len - 1.2; x += 2.0) P.r(x, y, x + 1.45, y + 2.0, '#2c3540');
  }
  P.r(0, top - 1.0, len, top, '#5e2d24');
  if (len > 40 && dot(W, [-0.71, 0.71]) > 0.9) {
    P.r(len * 0.5 - 6, top - 2.9, len * 0.5 + 6, top - 1.2, '#2b211d');
    P.text('DORPAT', len * 0.5, top - 2.05, 1.3, '#f2e6c9', '700 %px Georgia, serif');
  }
}
function glassBand_(P, x0, x1, y0, y1) {
  P.grad(x0, y0, x1, y1, '#7f97a8', '#43586a');
  for (let x = x0; x <= x1 + 0.01; x += 1.8) P.r(x - 0.04, y0, x + 0.04, y1, '#2f3438');
}

const PAINT = { alek8b, alek8a, alek10, alek12, dorpat };

export function createTuru6(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const houses = HOUSES.map(([name, S, base, at, r, , , pick]) => ({ name, sec: S[0], base, at, r, pick, spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 10, far: 6, faces: (W) => W.len > 6 && W.foot < 2, debug: DEBUG });
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 400) return;
      if ([[1938, 3306], [2002, 3441], [2032, 2981]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
