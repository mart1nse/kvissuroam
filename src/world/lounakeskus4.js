// Riia 128-140, K-Rauta and the Aardla side east of the Ringtee (Martin, 20 Nov: batch 4 of his pink outline round
// southern Tartu), from the Land Board's oblique air photos (Apr 2024); no Street View of this part:
//  - K-Rauta (Riia 140E): the long grey hall with the blue band and name over the car park, the blue drum entrance;
//  - the Riia 140 yard: grey ribbed halls with roller doors, Tevo (140b), Hydroscand (140f);
//  - Selver Teemandi (Teemandi 2): the yellow, orange, grey and blue tiles, the red name on yellow, the roof cube;
//  - Tammetõru 3 by the ring road: grey with the blue and red bands and the corner tower; Tammetõru 1;
//  - Aasta Auto (Aardla 101): the glass showroom and the grey workshop.
// The map's own blocks keep their shapes and get painted walls. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit } from './handbuilt.js';

const DEBUG = typeof location !== 'undefined' && /lkdebug/.test(location.search);
const T9 = ['0_9', -800, 4960], T10 = ['0_10', -800, 5600];
// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['krauta', T9, 4326, [-530, 5556], 60, 0xc9ccd0, 0x55585c],
  ['tevo', T9, 4532, [-605, 5466], 22, 0xc4c7ca, 0x5f6266],
  ['hall', T9, 4453, [-575, 5508], 22, 0xc4c7ca, 0x5f6266],
  ['hall', T9, 4492, [-592, 5486], 18, 0xa9adb2, 0x8d9196],
  ['hall', T9, 4544, [-624, 5441], 22, 0xa9adb2, 0x8d9196],
  ['hall', T9, 4516, [-528, 5448], 20, 0xc4c7ca, 0x5f6266],
  ['hydro', T9, 4380, [-486, 5486], 25, 0xc4c7ca, 0x5f6266],
  ['hall', T9, 4261, [-455, 5603], 25, 0xc4c7ca, 0x5f6266],
  ['selver', T10, 3912, [-563, 5944], 50, 0x8d939a, 0x4e5054],
  ['tamm3', T10, 3708, [-380, 6009], 60, 0xb4b8bc, 0x4e5054],
  ['tamm1', T10, 3793, [-430, 5931], 20, 0x9a9ea3, 0x4e5054],
  ['aasta', T10, 4198, [-431, 5740], 32, 0xc4c7ca, 0x4e5054],
];

export function lounakeskus4Walls(walls) {
  for (const S of [T9, T10]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const SANS = '700 %px Arial, sans-serif', BOLD = '900 %px Arial, sans-serif';
const rnd = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function ribs(P, x0, x1, y0, y1, base, rib, step = 0.5) {
  P.r(x0, y0, x1, y1, base);
  for (let x = x0 + step / 2; x < x1; x += step) P.r(x, y0, x + 0.06, y1, rib);
}
function glass(P, x0, x1, y0, y1, tint = '#4c5d6e', frameCol = '#1c1d20') {
  P.r(x0, y0, x1, y1, frameCol);
  P.grad(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, tint, '#2e3946');
  for (let x = x0 + 1.5; x < x1 - 0.3; x += 1.5) P.r(x - 0.04, y0, x + 0.04, y1, frameCol);
}
function roller(P, x, w = 4, hh = 4.2, c = '#9a9ea3') {
  P.r(x, 0, x + w, hh, c);
  for (let y = 0.3; y < hh; y += 0.3) P.r(x, y, x + w, y + 0.04, '#80848a');
}
function board(P, x, y, w, h, bg, text, fg, size) { P.r(x - w / 2, y, x + w / 2, y + h, bg); P.text(text, x, y + h / 2, size || h * 0.55, fg, BOLD); }

// a plain yard hall: ribbed sheet, roller doors on the long sides, a small door on the ends
function hall(P, W) {
  const len = W.len, top = W.peak;
  const [base, rib] = W.foot > 2 ? ['#b9bcc0', '#abaeb2'] : ['#c4c7ca', '#b4b7ba'];
  ribs(P, 0, len, P.y0, P.y1, base, rib, 0.4);
  P.r(0, top - 0.35, len, top, '#7d8186');
  if (W.foot > 2) return;
  if (len > 30) for (let x = 5 + rnd(len) * 4; x < len - 5; x += 11 + rnd(x) * 4) roller(P, x, 4, Math.min(4.4, top - 1.2));
  else if (len > 12) { P.r(len / 2 - 0.55, 0, len / 2 + 0.55, 2.2, '#6d7176'); P.r(len / 2 - 1.6, 2.6, len / 2 + 1.6, 3.4, '#f2f2f0'); }
  P.weather(0, 0, len, top, 0.12, Math.round(len));
}

function krauta(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#c9ccd0', '#bcc0c4', 0.5);
  P.r(0, top - 0.4, len, top, '#7d8186');
  if (dot(W, [-0.59, 0.81]) > 0.9 && len > 60) {                 // the front to the car park (x = 0 at the drum end)
    P.r(0, top - 3.6, len, top - 0.4, '#1d3f8f');
    P.r(8, top - 3.3, 11.4, top - 0.7, '#c8d400');
    P.text('K-RAUTA', 21, top - 2.0, 2.2, '#ffffff', BOLD);
    P.text('K-RAUTA', len - 14, top - 2.0, 1.6, '#ffffff', BOLD);
    glass(P, 2, 14, 0, 4.0, '#56697c', '#1d3f8f');
    for (let x = 20; x < len - 8; x += 16) glass(P, x, x + 6, 1.0, 3.4, '#56697c', '#2b2c30');
  } else if (dot(W, [-0.81, -0.59]) > 0.9 && len > 30) {          // the end to Riia 140
    P.r(len - 16, top - 3.6, len, top - 0.4, '#1d3f8f'); P.text('K-RAUTA', len - 8, top - 2.0, 1.6, '#ffffff', BOLD);
    P.r(4, 0, 14, 4.2, '#6d7176'); P.text('Puidukeskus', 9, 5.0, 0.8, '#1d3f8f', SANS);
  } else if (len > 25) for (let x = 6; x < len - 6; x += 12) roller(P, x, 4.2, 4.6);
}

function tevo(P, W) {
  hall(P, W);
  if (dot(W, [-0.80, 0.61]) > 0.9 && W.len > 12) {              // the end to the yard road
    const top = W.peak, len = W.len;
    P.r(1, top - 4.2, len - 1, top - 1.2, '#ffffff');
    P.text('TEVO', len * 0.38, top - 2.7, 2.0, '#e3262e', BOLD);
    P.r(len * 0.62, top - 3.7, len * 0.62 + 3, top - 1.7, '#0d4a96');
    P.text('ehituskaup', len / 2, top - 4.9, 0.7, '#1d1e21', SANS);
    glass(P, len / 2 - 3, len / 2 + 3, 0, 3.0, '#56697c', '#2b2c30');
  }
}
function hydro(P, W) {
  hall(P, W);
  const top = W.peak, len = W.len;
  if ((dot(W, [-0.81, -0.59]) > 0.9 || dot(W, [-0.59, 0.81]) > 0.9) && len > 20) {
    board(P, len / 2, top - 3.4, 18, 2.2, '#00599c', 'HYDROSCAND', '#ffffff', 1.1);
    glass(P, len / 2 - 3, len / 2 + 3, 0, 3.0, '#56697c', '#2b2c30');
  }
}

function selver(P, W) {
  const len = W.len, top = W.peak;
  const cols = ['#f2c230', '#e8a03a', '#8d939a', '#2f5d9e', '#f2c230', '#b9bcc0'];
  P.r(0, P.y0, len, P.y1, '#8d939a');
  let k = Math.round(W.mid[0] * 7 + W.mid[1]);
  for (let x = 0; x < len; x += 1.25) for (let y = 3.6; y < top; y += 1.25) { k++; P.r(x + 0.03, y + 0.03, x + 1.22, y + 1.22, cols[Math.floor(rnd(k) * cols.length)]); }
  P.r(0, 0, len, 3.6, '#3a3c40');
  P.r(0, top - 0.4, len, top, '#2b2c30');
  if ((W.nx > 0.5 || W.nz > 0.5) && len > 18) {                   // the faces to the junction and the car park
    const x = len / 2;
    P.r(x - 8, top - 4.4, x + 8, top - 1.0, '#ffd200');
    P.text('SELVER', x, top - 2.7, 2.4, '#e2001a', BOLD);
    if (W.nx > 0.5) glass(P, x - 6, x + 6, 0, 3.4, '#56697c', '#1d1e21');
  } else if (len > 30) for (let x = 6; x < len - 6; x += 18) roller(P, x, 3.4, 3.4, '#6d7176');
}

function tamm3(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#b4b8bc', '#a7abaf', 0.5);
  P.r(0, top - 0.4, len, top, '#55585c');
  if (W.foot > 2) return;
  if (dot(W, [-0.83, 0.55]) > 0.9 && len > 60) {                 // the long side to the ring road (x = 0 at the south end)
    P.r(0, 2.0, 22, top - 0.4, '#c8202c');
    P.r(22, 2.0, len - 20, top - 0.4, '#1f4f99');
    for (let x = 22.25; x < len - 20; x += 0.5) P.r(x, 2.0, x + 0.05, top - 0.4, '#1b468a');
    P.r(len - 14, 0, len, top, '#e9eaec'); P.r(len - 11, top - 6, len - 3, top - 1.5, '#1f4f99');
  } else if (dot(W, [0.83, -0.55]) > 0.9 && len > 40) {           // the car park side
    P.r(0, 3.6, len, 4.2, '#c8202c');
    for (let x = 4; x < len - 8; x += 14) glass(P, x, x + 8, 0, 3.4, '#56697c', '#2b2c30');
  }
}
function tamm1(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#9a9ea3');
  for (let x = 1.2; x < len; x += 1.2) P.r(x, 0, x + 0.04, top, '#8f9398');
  P.r(0, top - 0.4, len, top, '#55585c');
  if (dot(W, [0.79, -0.61]) > 0.9 && len > 20) {
    P.r(4, top - 3.0, len - 4, top - 1.4, '#c8202c');
    glass(P, 3, len - 3, 0, 3.4, '#56697c', '#2b2c30');
  } else if (len > 15) glass(P, len / 2 - 3, len / 2 + 3, 0, 3.0, '#56697c', '#2b2c30');
}

function aasta(P, W) {
  const len = W.len, top = W.peak;
  if (W.mid[0] < -440 || top > 9.6) {                             // the glass showroom to the west
    P.r(0, P.y0, len, P.y1, '#e9eaec');
    glass(P, 0.4, len - 0.4, 0, top - 1.6, '#5f7488', '#c9ccd0');
    P.r(0, top - 1.4, len, top, '#f4f4f2');
    if (dot(W, [-0.99, 0.13]) > 0.9 && len > 20) { P.arc(len / 2, top - 0.7, 0.6, '#1e3c78'); P.text('AASTA AUTO', len / 2 + 4.5, top - 0.7, 0.7, '#1e3c78', SANS); }
    return;
  }
  P.r(0, P.y0, len, P.y1, '#9fa3a8');
  for (let x = 1.2; x < len; x += 1.2) P.r(x, 0, x + 0.04, top, '#93979c');
  P.r(0, top - 0.4, len, top, '#55585c');
  if (len > 30) for (let x = 4; x < len - 5; x += 7) roller(P, x, 4, 4.0, '#c9ccd0');
}

const PAINT = { krauta, tevo, hydro, hall, selver, tamm3, tamm1, aasta };

export function createLounakeskus4(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [-520, 5650];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { h } = A;
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false } }));
    for (const H of houses) { const paint = PAINT[H.name]; H.walls = [{ near: [0, 0], within: 1e9, only: (P, W) => paint(P, W) }]; }
    skinHouses(world, group, houses, { label: 'lounakeskus4 fronts', shadows, ppm: 7, far: 5, faces: (W) => W.foot < 2 && W.len > 8 && W.peak > 3, debug: DEBUG });

    // K-Rauta's blue drum at the entrance corner
    const [dx, dz] = [-558.7, 5559.7];
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 9.6, 20, 1, false), new THREE.MeshLambertMaterial({ color: 0x1d3f8f }));
    drum.position.set(dx, h(dx, dz) + 4.8, dz); drum.castShadow = shadows; group.add(drum);
    // Selver's white cube on the roof with the name
    const cube = paintTexture(4, 0, 4, 24, (P) => { P.r(0, 0, 4, 4, '#ffffff'); P.r(0.3, 1.3, 3.7, 2.7, '#ffd200'); P.text('SELVER', 2, 2.0, 0.7, '#e2001a', BOLD); });
    const cm = new THREE.MeshLambertMaterial({ map: cube });
    const c = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), [cm, cm, new THREE.MeshLambertMaterial({ color: 0xf2f2f0 }), cm, cm, cm]);
    c.position.set(-540, 47.9 + 2.0, 5942); c.rotation.y = Math.atan2(0.55, 0.84); c.castShadow = shadows; group.add(c);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[-530, 5556], [-563, 5944], [-605, 5466]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
