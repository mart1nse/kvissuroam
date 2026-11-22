// Narva mnt from the Laulupeomuuseum roundabout to Jaama, batch 5 of the Narva mnt kaardista (Martin, 22 Nov:
// Street View shots 11.12.05 to 11.12.16, July and Aug 2024).
// Seen in his shots:
//  - the student house Narva 89: five floors of red brick and white windows, by the roundabout;
//  - Narva 91: the long grey house under a blue-grey metal roof, white windows and a white door;
//  - Narva 93: the low white house with teal windows and doors;
//  - Narva 97 to 101: the dark and grey weatherboarded houses, Elixir on the corner of 101;
//  - the Tartu Jüri church (Narva 103): pale pink with white pilasters and arched windows, the bell tower over
//    the front with a small grey-green dome and a cross, the light blue panel fence to the south and the white
//    posts and iron rails along the road;
//  - Narva 107: three floors of grey weathered boards over a grey plinth, white windows with tops;
//  - Narva 84 across the road: the white block of flats with its darker top floors.
// Guessed: the backs, and the houses behind on Jaama stay as they were. Nothing on a carriageway, no street names
// on the road. Built only near: within 130 m of the church or 60 m of the student house (the centre test drive's
// last hop at Delta is 131 m from that one, the race lap over 300 m away).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
const S34 = ['3_4', 1120, 1760];
const SANS = '700 %px Arial, sans-serif';
const WIN = { frame: '#f4f1ea', glass: '#4f5d72', fw: 0.08, bars: 1, T: true, surround: 0, sill: 0.07 };
const top = (P, W) => Math.min(P.y1, W.eaves + 0.05);

// ---------------------------------------------------------------- Narva 89, the student house
function dorm89(P, W) {
  const len = W.len;
  P.brick(0, P.y0, len, P.y1, [124, 62, 50], 89);
  if (W.foot > 6) return;
  P.r(0, P.y0, len, 0.6, '#8d8a88');
  const xs = axes(0, len, Math.max(1, Math.round(len / 3.3)));
  for (let k = 0; k < 6; k++) row(P, W, xs, 1.0 + k * 3.0, 1.5, 1.45, { ...WIN, T: false, bars: 1 });
}

// ---------------------------------------------------------------- Narva 91 and 93
function n91(P, W) {
  const len = W.len;
  P.boards(0, P.y0, len, P.y1, [146, 146, 144], 0.17); P.weather(0, 0, len, P.y1, 0.5, 91);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 0.55, '#8b8b8d');
  const xs = axes(0, len, Math.max(1, Math.round(len / 2.6)));
  row(P, W, xs, 0.95, 1.45, 1.15, WIN);
  if (W.nx < -0.9 && len > 12) P.door(len * 0.28 - 0.55, len * 0.28 + 0.55, 2.3, '#f2f2ee', { frame: '#f4f1ea', light: 0.3, panels: 2 });
}
function n93(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#ecebe6'); P.r(0, P.y0, len, 0.4, '#a9a8a6');
  if (W.foot > 2) return;
  for (const x of axes(0, len, Math.max(1, Math.round(len / 2.2)))) { if (x - 0.6 < 0.2 || x + 0.6 > len - 0.2) continue; P.r(x - 0.6, 0.45, x + 0.6, 2.7, '#3f8a86'); P.r(x - 0.5, 0.55, x + 0.5, 2.6, '#5aa6a0'); }
}

// ---------------------------------------------------------------- Narva 97 to 101, the boarded houses
function n101(P, W) {
  const len = W.len, t = top(P, W), grey = W.mid[1] < 2097;
  P.boards(0, P.y0, len, P.y1, grey ? [156, 158, 156] : [92, 84, 78], 0.16); P.weather(0, 0, len, P.y1, 0.6, 101);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 0.6, '#7d7c7e');
  const xs = axes(0, len, Math.max(1, Math.round(len / 2.7)));
  row(P, W, xs, 1.0, 1.5, 1.1, WIN); if (t > 6) row(P, W, xs, 4.0, 1.5, 1.1, WIN);
  // Elixir on the corner to the church, and the house number
  if (grey && W.nx < -0.9 && len > 15) {
    P.r(len - 3.6, 2.95, len - 0.6, 3.7, '#1f3a6b'); P.text('Elixir', len - 2.1, 3.32, 0.42, '#ffffff', SANS);
    P.r(len - 0.9, 2.2, len - 0.3, 2.6, '#1f3a6b'); P.text('101', len - 0.6, 2.4, 0.22, '#ffffff', SANS);
  }
}

// ---------------------------------------------------------------- the Jüri church, Narva 103
const PINK = '#e8c4c9', PILE = '#f6f1ec';
function church(P, W) {
  const len = W.len, t = top(P, W);
  P.r(0, P.y0, len, P.y1, PINK); P.r(0, P.y0, len, 0.5, '#bfb4b2');
  // white pilasters at the corners and every few metres, a white cornice
  for (const x of axes(0, len, Math.max(1, Math.round(len / 3.2)) + 1)) P.r(Math.max(0, x - 0.3), 0.5, Math.min(len, x + 0.3), t, PILE);
  P.r(0, 0, 0.45, P.y1, PILE); P.r(len - 0.45, 0, len, P.y1, PILE);
  if (t - 0.6 > 1) P.r(0, t - 0.6, len, t, PILE);
  const arch = (x, y, w, h, c) => { P.r(x - w / 2, y, x + w / 2, y + h - w / 2, c); P.arc(x, y + h - w / 2, w / 2, c); };
  if (W.foot > 7) {                                                           // the bell tower: arched openings
    for (const x of axes(0, len, Math.max(1, Math.round(len / 2)))) { arch(x, W.foot + 1.0, 1.1, 2.0, PILE); arch(x, W.foot + 1.15, 0.8, 1.7, '#3e3a3c'); }
    return;
  }
  const front = W.nz > 0.8 && len < 12;
  if (front) {                                                                // the front: arched door, a round window
    arch(len / 2, 0.5, 2.0, 3.4, PILE); arch(len / 2, 0.55, 1.5, 3.1, '#5a3b33');
    P.arc(len / 2, 6.3, 0.75, PILE); P.arc(len / 2, 6.3, 0.55, '#495566');
    for (const x of [len / 2 - 2.6, len / 2 + 2.6]) if (x > 0.8 && x < len - 0.8) { arch(x, 2.0, 1.0, 2.4, PILE); arch(x, 2.1, 0.75, 2.2, '#4d5b70'); }
    return;
  }
  for (const x of axes(0, len, Math.max(1, Math.round(len / 3.2)))) {
    if (x < 1 || x > len - 1) continue;
    arch(x, 2.4, 1.3, 3.0, PILE); arch(x, 2.5, 1.0, 2.8, '#4d5b70');
  }
}

// ---------------------------------------------------------------- Narva 107, the tall boarded house
function n107(P, W) {
  const len = W.len;
  P.boards(0, P.y0, len, P.y1, [142, 144, 146], 0.16); P.weather(0, 1.6, len, P.y1, 0.7, 107);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 1.6, '#8e8d8f');
  const xs = axes(0, len, Math.max(1, Math.round(len / 2.6)));
  for (const x of xs) if (x > 0.8 && x < len - 0.8) P.r(x - 0.5, 0.35, x + 0.5, 1.2, '#4a4f58');        // the low windows in the plinth
  for (const s of [2.4, 5.6, 8.8]) { row(P, W, xs, s, 1.75, 1.05, { ...WIN, hood: 0.25 }); }
  P.r(0, 1.6, len, 1.75, '#d8d6d0');
  if (W.nx < -0.9 && len > 20) P.door(len * 0.62 - 0.6, len * 0.62 + 0.6, 2.4, '#e9e7e1', { frame: '#f4f1ea', light: 0.3, panels: 4 });
}

// ---------------------------------------------------------------- Narva 84, the white flats across the road
function n84(P, W) {
  const len = W.len;
  if (W.foot > 15) { P.r(0, P.y0, len, P.y1, '#6c7076'); for (const x of axes(0, len, Math.max(1, Math.round(len / 3)))) P.r(x - 1.1, W.foot + 0.6, x + 1.1, W.foot + 2.6, '#3d4552'); return; }
  P.r(0, P.y0, len, P.y1, '#eeeeea'); P.r(0, P.y0, len, 0.7, '#9fa1a4');
  const xs = axes(0, len, Math.max(1, Math.round(len / 3.0)));
  for (let k = 0; k < 7; k++) row(P, W, xs, 0.9 + k * 2.95, 1.6, 1.4, { frame: '#d2d4d6', glass: '#46505f', fw: 0.06, bars: 1, T: false, surround: 0, sill: 0.05 });
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['narva 89', S34, 24, [1679, 2194], 50, 0x7c3e32, 0x5b5d63, dorm89],
  ['narva 91', S34, 97, [1668, 2144], 20, 0x929290, 0x6c7884, n91],
  ['narva 93', S34, 118, [1660, 2130], 12, 0xecebe6, 0x8d9096, n93],
  ['narva 97-101', S34, 103, [1681, 2100], 30, 0x5c544e, 0x55585e, n101],
  ['narva 99', S34, 77, [1677, 2112], 12, 0x5c544e, 0x55585e, n101],
  ['jüri kirik', S34, 183, [1676, 2056], 20, 0xe8c4c9, 0x7f97a0, church],
  ['narva 107', S34, 264, [1673, 2018], 16, 0x8e9092, 0x5b5e64, n107],
  ['narva 84', S34, 133, [1636, 2014], 25, 0xeeeeea, 0x6c7076, n84],
];
// the walls seen from the road, painted finely (the rest at the coarse far sharpness)
const FINE = [[1676.4, 2181.4], [1686.1, 2154.5], [1653.3, 2143.2], [1654.9, 2128.0], [1661.7, 2091.7], [1656.5, 2110.1],
  [1673.9, 2048.1], [1670.2, 2059.2], [1670.1, 2069.9], [1663.8, 2017.1], [1663.2, 2016.1], [1673.6, 2006.5], [1645.0, 2016.8]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < 3);

export function narva5Walls(walls) {
  setHouseColours(walls, S34[0], S34[1], S34[2], HOUSES.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

const TRIGGERS = [[1676, 2060, 130], [1670, 2170, 60]];

export function createNarva5(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva5 fronts' });
    yield 'frame';
    const A = areaKit(world, group, { shadows });
    const { p, h, bar } = A;

    // ---- the church: grey-green onion domes with crosses on the bell tower and over the nave
    for (const [x, y, z, r] of [[1671.3, 15.0, 2066.8, 0.95], [1678.4, 17.7, 2052.3, 1.3]]) {
      const dome = new THREE.SphereGeometry(r, 10, 7); dome.scale(1, 1.25, 1);
      p.add(dome, 0x7f9a98, x, y + r * 0.9, z);
      p.add(new THREE.ConeGeometry(r * 0.35, r * 0.9, 8), 0x7f9a98, x, y + r * 2.25, z);
      p.add(new THREE.CylinderGeometry(r * 0.55, r * 0.75, 0.5, 10), 0xf6f1ec, x, y + 0.2, z);
      const cy = y + r * 2.7 + 0.6;
      p.box(0.07, 1.2, 0.07, 0x5a5650, x, cy, z); p.box(0.6, 0.07, 0.07, 0x5a5650, x, cy + 0.25, z); p.box(0.4, 0.06, 0.06, 0x5a5650, x, cy - 0.3, z, 0.35);
    }
    yield;

    // ---- the church fences: light blue panels between white posts to the south, white posts and iron rails
    //      along the road (5 m off the carriageway)
    { const a = [1661.2, 2076.4], b = [1687.0, 2079.2], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.6);
      for (let k = 0; k <= n; k++) {
        const q = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], g = h(q[0], q[1]);
        p.box(0.32, 1.9, 0.32, 0xf4f2ee, q[0], g + 0.95, q[1]);
        if (k < n) { const r = [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n]; bar(q, r, 0.06, 0.25, 1.65, 0xa9c4d6, g); }
      }
      const c = [1665.2, 2040.4], m = Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / 3);
      for (let k = 0; k <= m; k++) { const q = [a[0] + (c[0] - a[0]) * k / m, a[1] + (c[1] - a[1]) * k / m]; p.box(0.3, 1.5, 0.3, 0xf4f2ee, q[0], h(q[0], q[1]) + 0.75, q[1]); }
      bar(a, c, 0.05, 0.3, 0.36, 0x2f3034); bar(a, c, 0.05, 1.2, 1.26, 0x2f3034);
      for (let k = 0; k < m * 12; k++) { const q = [a[0] + (c[0] - a[0]) * (k + 0.5) / (m * 12), a[1] + (c[1] - a[1]) * (k + 0.5) / (m * 12)]; p.box(0.025, 0.9, 0.025, 0x2f3034, q[0], h(q[0], q[1]) + 0.78, q[1]); }
      world.addSolids?.([{ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, hz: 0.2 },
        { x: (a[0] + c[0]) / 2, z: (a[1] + c[1]) / 2, yaw: Math.atan2(-(c[1] - a[1]), c[0] - a[0]), hx: Math.hypot(c[0] - a[0], c[1] - a[1]) / 2, hz: 0.2 }]);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (!TRIGGERS.some(([x, z, r]) => Math.hypot(car.x - x, car.z - z) < r)) return;
      if (![[1679, 2194], [1676, 2056], [1636, 2014], [1673, 2018]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva5');
    },
  };
}
