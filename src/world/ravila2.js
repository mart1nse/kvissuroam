// Ravila tänav, batch 8 of the "riiastrip" kaardista (Martin, 20 Nov): the university campus between Nooruse and
// Tulika. Street View: "24 Nooruse" and "14 Ravila" (the institute on the Nooruse corner: a brick ground floor,
// white floors with tall narrow windows, two floors of dark glass on top), two shots along the service road behind
// the birches (Chemicum: the white lab towers, the low annex of dark glass with the red CHEMICUM letters, and the long
// low hall of glass under a rust-brown fascia) and one at Biomedicum's drive (grey panels with rows of square
// windows round a dark glass atrium). Everything is painted on the map's own buildings; nothing new stands on the
// road or the paths. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { RV } from './ravila.js';

const DEBUG = typeof location !== 'undefined' && /raviladebug/.test(location.search);
const S18 = ['1_8', -160, 4320], S08 = ['0_8', -800, 4320], S07 = ['0_7', -800, 3680];
const L = RV.at, sv = RV.sv;
const rect = (s0, s1, v0, v1) => (x, z) => { const [s, v] = sv(x, z); return s > s0 && s < s1 && v > v0 && v < v1; };
const facesSE = (W) => -(W.nx * RV.U[0] + W.nz * RV.U[1]) > 0.7;   // towards Nooruse, the way the service road comes in

// ---- painters, in metres on the wall: x along it, y up from the ground line
function institute(P, W) {
  const len = W.len, top = P.y1, glass = Math.max(4.2, top - 7.2);
  P.r(0, P.y0, len, top, '#eeeeea');
  P.brick(0, P.y0, len, 3.8, [138, 74, 58], Math.round(W.mid[0] * 3) + 7);
  for (let x = 1.2; x < len - 1.6; x += 3.0) P.win(x, 0.8, x + 1.6, 3.1, { frame: '#3c3f44', glass: '#4d6078', fw: 0.06, bars: 1 });
  P.r(0, 3.8, len, 4.0, '#cfcfca');
  for (let y = 4.6; y + 2.3 < glass - 0.4; y += 3.4) for (let x = 1.0; x < len - 1.3; x += 2.4) P.win(x, y, x + 0.95, y + 2.2, { frame: '#e8e8e4', glass: '#4c5f78', fw: 0.05, bars: 0 });
  P.grad(0, glass, len, top - 0.4, '#5e7590', '#33465c');
  for (let x = 0.4; x < len; x += 1.5) P.r(x - 0.04, glass, x + 0.04, top - 0.4, '#8a96a2');
  for (let y = glass; y < top - 0.4; y += 3.4) P.r(0, y - 0.07, len, y + 0.07, '#8a96a2');
  P.r(0, top - 0.4, len, top, '#3a4048');
  P.weather(0, P.y0, len, top, 0.2, Math.round(W.mid[1]));
}
function labTower(P, W) {
  // Chemicum's white lab blocks: few windows, in narrow columns, grey louvres near the roof
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#f0f0ec');
  for (let y = 4.4; y + 1.6 < top - 3.4; y += 3.6) for (let x = 1.6; x < len - 1.6; x += 4.2) P.win(x, y, x + 0.9, y + 1.6, { frame: '#d6d6d2', glass: '#5a6678', fw: 0.05, bars: 0 });
  for (let x = 2.0; x < len - 3; x += 7.5) P.r(x, top - 3.0, x + 3.2, top - 0.8, '#b9bcbe');
  P.r(0, P.y0, len, 0.5, '#9fa1a3');
  P.weather(0, P.y0, len, top, 0.25, Math.round(W.mid[0]));
}
function annex(P, W, sign) {
  // the low annex: dark glass in steel frames under a white fascia; the red letters on the end that faces the service road's way in
  const len = W.len, top = P.y1, fas = Math.max(3.0, top - 1.0);
  P.r(0, P.y0, len, top, '#efefeb');
  P.grad(0.3, 0.3, len - 0.3, fas - 0.15, '#3a4650', '#1e262e');
  for (let x = 0.3; x < len; x += 1.4) P.r(x - 0.05, 0.3, x + 0.05, fas - 0.15, '#4a4e52');
  P.r(0, fas - 0.15, len, top, '#e9e9e5');
  P.r(0, fas - 0.15, len, fas, '#7a3e2c');
  P.r(0, P.y0, len, 0.3, '#5a5c5e');
  if (sign && len > 9) P.text('CHEMICUM', len / 2, fas - 0.95, 1.25, '#ff3a30', '700 %px Arial, sans-serif');
}
function glassHall(P, W) {
  // the long low hall to the south-east: floor-to-ceiling glass under a rust-brown fascia, white end walls
  const len = W.len, top = P.y1, fas = Math.max(3.4, top - 1.1);
  P.r(0, P.y0, len, top, '#ededea');
  if (len > 8) {
    P.grad(0.6, 0.4, len - 0.6, fas - 0.1, '#46525e', '#262e36');
    for (let x = 0.6; x < len - 0.5; x += 1.6) P.r(x - 0.04, 0.4, x + 0.04, fas - 0.1, '#2a2e32');
    P.r(0.6, 2.2, len - 0.6, 2.26, '#2a2e32');
  }
  P.r(0, fas, len, top, '#8a4a30');
  for (let x = 0; x < len; x += 0.9) P.r(x, fas, x + 0.05, top, '#6e3a26');
}
function metalTower(P, W) {
  // the glass and grey metal block over the hall
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#a4a8ac');
  for (let y = 4.0; y + 2.0 < top - 0.5; y += 3.5) { P.grad(0.5, y, len - 0.5, y + 2.0, '#6f8aa8', '#3e566f'); for (let x = 0.5; x < len - 0.4; x += 1.3) P.r(x - 0.03, y, x + 0.03, y + 2.0, '#c4c8cc'); }
  P.r(0, P.y0, len, 0.4, '#6a6e72');
}
function biomedicum(P, W) {
  const len = W.len, top = P.y1;
  if (len < 14 && top > 14) {                       // the atrium and the stair towers: dark glass
    P.grad(0, P.y0, len, top, '#3f5670', '#1f2c3a');
    for (let x = 0.2; x < len; x += 1.4) P.r(x - 0.04, P.y0, x + 0.04, top, '#7d8b98');
    for (let y = 3.6; y < top; y += 3.6) P.r(0, y - 0.05, len, y + 0.05, '#7d8b98');
    return;
  }
  P.r(0, P.y0, len, top, '#b9b8b2');
  for (let x = 0; x < len; x += 3.0) P.r(x, P.y0, x + 0.04, top, 'rgba(90,90,90,0.25)');
  for (let y = 1.0; y + 1.4 < top - 0.8; y += 3.6) for (let x = 0.9; x < len - 1.2; x += 2.0) P.win(x, y, x + 1.2, y + 1.4, { frame: '#e4e4e0', glass: '#4e5f74', fw: 0.05, bars: 0 });
  P.r(0, top - 0.6, len, top, '#8e8e8a');
  P.r(0, P.y0, len, 0.4, '#6e6e6a');
}

// [name, sector, base, at, reach, wall, roof, pick, paint(P, W)]
const HOUSES = [
  ['institute', S18, 3437, L(296, -52), 40, 0xeeeeea, 0x45484c, rect(276, 318, -86, -18), institute],
  ['chemicum', S08, 3290, L(450, -74), 70, 0xf0f0ec, 0x8c8e90, rect(398, 500, -110, -38),
    (P, W) => (W.eaves < 7 ? annex(P, W, facesSE(W)) : labTower(P, W))],
  ['chemhall', S07, 3441, L(522, -74), 45, 0xededea, 0x6e7074, rect(496, 550, -110, -38),
    (P, W) => (W.eaves < 7 ? glassHall(P, W) : metalTower(P, W))],
  ['biomedicum', S07, 3202, L(512, 72), 60, 0xb9b8b2, 0x6e6e6c, rect(466, 562, 32, 118), biomedicum],
];

export function ravila2Walls(walls) {
  for (const [, sec, base, at, r, wall, roof] of HOUSES) setHouseColours(walls, sec[0], sec[1], sec[2], [{ base, x: at[0], z: at[1], wall, roof, reach: r }]);
}

export function createRavila2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = L(430, 0);

  function build() {
    built = true;
    const houses = HOUSES.map(([name, sec, base, at, r, , , pick, paint]) => ({
      name, sec: sec[0], base, at, r, pick, spec: { kind: 'plaster', wall: [236, 236, 232] },
      walls: [{ near: [0, 0], within: 1e9, only: (P, W) => paint(P, W) }],
    }));
    skinHouses(world, group, houses, { label: 'ravila2 fronts', shadows, ppm: 7, far: 4, faces: (W) => W.len > 6, debug: DEBUG });
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([L(296, -52), L(450, -74), L(512, 72)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
