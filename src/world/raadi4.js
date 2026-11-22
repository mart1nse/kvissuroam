// Raadi, the route 95 roundabout (Martin, 20 Nov: the second outline on his map), dressed from the Land
// Board's oblique air photos (2024): the map's own blocks keep their shapes and get painted walls.
//  - Grossi (Keskuse tee 2): the red front over its car park, red ribbed south wall, the grey corner with the
//    big Grossi script and flowers, black north wall with white pillars;
//  - Terminal (Nõlvakaare 2): teal shop with its dark round tower, the pump canopy, the yellow plane on a pole;
//  - Raadi Selver (Nõlvakaare 4): light grey box with the glass entrance towards its car park;
//  - Cramo (Nõlvakaare 8): black glass front with the red and blue band, white sides with roller doors.
// The shop signs the map already had stay where they are. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const SEC = '5_0', ORIGIN = [2400, -800];
const DEBUG = typeof location !== 'undefined' && /raadidebug/.test(location.search);
const HOUSES = [
  ['grossi', 2462, [2747, -300], 32, 0xc42824, 0x3c3e42],
  ['terminal', 2589, [2887, -291], 26, 0x0f8a96, 0x3a3c40],
  ['selver', 2391, [2941, -388], 60, 0xdcdee0, 0xe2e2e0],
  ['cramo', 2425, [2952, -466], 32, 0xf0f0ee, 0x3a3c40],
];
export function raadi4Walls(walls) {
  setHouseColours(walls, SEC, ...ORIGIN, HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];

// ribbed metal cladding
function ribs(P, W, base, rib, step = 0.5) {
  P.r(0, P.y0, W.len, P.y1, base);
  for (let x = step / 2; x < W.len; x += step) P.r(x, P.y0, x + 0.07, P.y1, rib);
}

function grossi(P, W) {
  const top = W.peak;
  if (dot(W, [-1, 0]) > 0.9) {                                   // the front over the car park
    ribs(P, W, '#c42824', '#a91f1c');
    P.r(0, top - 1.6, W.len, top - 0.3, '#b0201d');
    P.text('Grossi', W.len / 2, top - 1.0, 1.4, '#ffffff', 'italic 700 %px Georgia, serif');
    P.r(W.len * 0.3, 0, W.len * 0.7, 3.4, '#2d3640');
    for (let x = W.len * 0.3; x <= W.len * 0.7; x += 1.5) P.r(x - 0.04, 0, x + 0.04, 3.4, '#1a1c20');
    P.r(W.len * 0.44, 0, W.len * 0.56, 2.4, '#5f7286');
  } else if (dot(W, [-0.2, 0.98]) > 0.9) {                       // the long south wall: red ribs, dark strips
    ribs(P, W, '#c42824', '#a91f1c');
    for (let x = 2; x < W.len; x += 4.4) P.r(x, 0.3, x + 0.6, top - 0.4, '#3a1414');
    P.text('TOIDUKAUBAD', 15, top - 1.0, 0.8, '#ffffff', '700 %px Arial, sans-serif', 'left');
  } else if (dot(W, [0.47, 0.88]) > 0.9) {                       // the grey corner with the script and flowers
    ribs(P, W, '#a8aab0', '#97999f', 0.3);
    for (let k = 0; k < 14; k++) {
      const x = 1.2 + (k * 1.73) % (W.len - 2), y = 1 + ((k * 2.9) % Math.max(1, top - 2.4));
      for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3; P.r(x + Math.cos(t) * 0.45 - 0.17, y + Math.sin(t) * 0.45 - 0.17, x + Math.cos(t) * 0.45 + 0.17, y + Math.sin(t) * 0.45 + 0.17, '#eceef0'); }
    }
    P.text('Grossi', W.len / 2, top * 0.42, top * 0.42, '#3b3f58', 'italic 700 %px Georgia, serif');
  } else if (dot(W, [0, -1]) > 0.9) {                            // the black north wall with white pillars
    P.r(0, P.y0, W.len, P.y1, '#1d1e22');
    for (let x = 3; x < W.len; x += 6.5) P.r(x, 0, x + 0.45, top, '#e8e8e8');
  } else ribs(P, W, '#9c9ea4', '#8a8c92', 0.25);
}

const CANOPY = [2898.7, -283.6];
function terminal(P, W) {
  const top = W.peak;
  if (Math.hypot(W.mid[0] - CANOPY[0], W.mid[1] - CANOPY[1]) < 11.5 && W.len > 12 && W.len < 21) {   // the pump canopy
    P.r(0, P.y0, W.len, P.y1, '#3c4146');
    P.r(0, top - 1.1, W.len, top, '#0f8a96');
    P.r(0, top - 0.75, W.len, top - 0.6, '#ffffff');
    for (let x = 3.5; x < W.len - 2; x += 6) { P.r(x, 0, x + 1.0, 1.9, '#d8dadc'); P.r(x + 0.15, 1.2, x + 0.85, 1.7, '#0f8a96'); }
    return;
  }
  if (W.len < 2) { P.r(0, P.y0, W.len, P.y1, '#24272b'); P.r(0, 1.0, W.len, 2.6, '#3f4b58'); return; }    // the round tower
  P.r(0, P.y0, W.len, P.y1, '#0f8a96');
  P.r(0, top - 0.5, W.len, top, '#0a6f79');
  if (W.len > 5) for (let x = 1.2; x < W.len - 1.5; x += 3) P.r(x, 0.9, x + 2.2, 2.7, '#3f4b58');
  if (dot(W, [0, 1]) > 0.8 && W.len > 8) {
    P.r(W.len * 0.15, top - 2.0, W.len * 0.85, top - 0.7, '#ffffff');
    P.text('Terminal', W.len / 2, top - 1.35, 1.0, '#0f8a96', '700 %px Arial, sans-serif');
  }
}

function selver(P, W) {
  const top = W.peak;
  ribs(P, W, '#dcdee0', '#cdd0d3', 0.6);
  P.r(0, top - 0.6, W.len, top, '#3a3c40');
  if (dot(W, [-0.91, -0.42]) > 0.9 && W.len > 50) {               // the front over the car park
    const g0 = W.len * 0.12, g1 = W.len * 0.34;
    P.r(g0, 0, g1, top - 1.4, '#3f4b58');
    for (let x = g0; x <= g1; x += 1.6) P.r(x - 0.05, 0, x + 0.05, top - 1.4, '#22252a');
    P.r(g0, 3.3, g1, 3.45, '#22252a');
    P.r(g0 + 4, 0, g0 + 7, 2.5, '#6c7c8e');
    P.r(g0 - 1, top - 1.4, g1 + 1, top - 0.6, '#e30613');
  } else if (W.len > 50) for (let x = 8; x < W.len - 8; x += 14) P.r(x, 0, x + 3.6, 4.2, '#9a9ea4');     // loading doors
}

function cramo(P, W) {
  const top = W.peak;
  if (dot(W, [-0.91, -0.42]) > 0.9) {                             // the black glass front
    P.r(0, P.y0, W.len, P.y1, '#1b1d22');
    for (let x = 1.6; x < W.len; x += 1.6) P.r(x - 0.04, 0, x + 0.04, top - 1.3, '#2c3038');
    P.r(0, top - 1.3, W.len * 0.62, top - 0.3, '#d7262e');
    P.r(W.len * 0.62, top - 1.3, W.len, top - 0.3, '#2f6db5');
    P.text('CRAMO', W.len * 0.31, top - 0.8, 0.8, '#ffffff', '700 %px Arial, sans-serif');
    P.r(W.len * 0.45, 0, W.len * 0.55, 2.4, '#4a5562');
    return;
  }
  ribs(P, W, '#f0f0ee', '#e2e2e0', 0.4);
  if (W.len > 20) for (const f of [0.3, 0.6]) P.r(W.len * f, 0, W.len * f + 4, 4.5, '#8e9298');
  if (W.len > 20) P.r(W.len * 0.85, 0, W.len * 0.85 + 1.1, 2.2, '#55595f');
}

const PAINT = { grossi, terminal, selver, cramo };

export function createRaadi4(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [2860, -370];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map(([name, base, at, r]) => ({ name, sec: SEC, base, at, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false },
      only: PAINT[name] }));
    // every wall of these four gets the house's own painter
    for (const H of houses) H.walls = [{ near: [0, 0], within: 1e9, only: (P, W) => H.only(P, W) }];
    skinHouses(world, group, houses, { label: 'raadi4 fronts', shadows, ppm: 12, far: 6, debug: DEBUG });
    // the yellow plane on a pole on the lawn north-west of the Terminal tower, nose to the north
    const [x, z] = [2861.5, -302.0], g = h(x, z), F = frame([x, z], [0, -1]);
    p.add(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), 0x8e9298, x, g + 1.6, z);
    A.box(F, 0, 0, 6.4, 0.9, 3.2, 4.0, 0xf2c522, g);                    // body
    A.box(F, 0.6, 0, 1.3, 9.2, 3.9, 4.05, 0xf2c522, g);                 // wing
    A.box(F, -2.8, 0, 0.8, 3.0, 3.6, 3.7, 0xf2c522, g);                 // tail plane
    A.box(F, -2.9, 0, 0.9, 0.1, 3.7, 4.8, 0x2c8aa0, g);                 // fin
    A.box(F, 3.3, 0, 0.12, 2.0, 3.5, 3.7, 0x2c2c2c, g);                 // propeller
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 300) return;
      if ([[2747, -300], [2941, -388], [2952, -466]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
