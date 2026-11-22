// Narva maantee from the dormitory at Narva 27 to Narva 69 opposite Delta, batch 3 of the Narva mnt kaardista
// (Martin, 22 Nov: Street View shots of June 2023 to Aug 2024). Seen in his shots:
//  - the student dormitory Narva mnt 27: ten floors, terracotta bands between rows of windows on the long sides,
//    the white stair core with its small square windows, the pale ends with a framed blank panel;
//  - Lemon Gym (Narva mnt 27a): the dark box with slanted piers, the lime LEMON GYM and its rounded square, tall
//    dark windows, the glazed ground floor with lime lines, the INVARU letters in a frame on the roof, the yellow
//    TREENINGUD advert on the side to Mäe tänav;
//  - the low glass pavilion at Narva 27b: dark fascia over shop windows;
//  - Neste (Narva mnt 29, Mäe 1): the small canopy, green over a blue band with the white NESTE, two green and
//    blue Futura posts on one island of pumps;
//  - Narva mnt 69: salmon walls, white pilaster strips, window surrounds and cornice, the red board fence south of it.
// Guessed: the backs and the far sides. Nothing on a carriageway, no street names on the road. Built only within
// 100 m of the Neste corner: Delta, where the centre test drive's phone hops end, is 135 m away (phones are near
// their limit there).
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
const S35 = ['3_5', 1120, 2400], S34 = ['3_4', 1120, 1760];
const CENTRE = [1690, 2340];
const SANS = '700 %px Arial, sans-serif';

// ---------------------------------------------------------------- the dormitory, Narva mnt 27
const TERRA = '#c4673f', TERRA2 = '#a9552f', PALE = '#e4e3df';
function dorm27(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, PALE);
  if (W.foot > 24) { P.r(0, P.y0, len, P.y1, '#c9c9c5'); return; }            // the lift rooms on the roof
  const side = Math.abs(W.nx) > 0.9, floors = [];
  for (let y = 3.3; y + 1.6 < top; y += 2.85) floors.push(y);
  P.r(0, P.y0, len, 0.4, '#8e8f8c');
  if (side && len > 12) {
    // terracotta between the rows of windows, the rows in dark blue frames
    P.r(0, 2.9, len, top, TERRA);
    for (const y of floors) {
      P.r(0.2, y, len - 0.2, y + 1.45, '#323a4a');
      for (let x = 0.2; x < len - 0.2; x += 1.35) P.r(x, y, x + 0.06, y + 1.45, '#5d6b85');
      P.r(0, y - 0.14, len, y, TERRA2);
    }
    P.r(0, top - 0.45, len, top, '#d9d8d4');
    row(P, W, axes(0, len, Math.max(1, Math.round(len / 3.4))), 0.6, 2.1, 2.6, { frame: '#3a3f48', glass: '#46505f', fw: 0.07, bars: 1, T: false, surround: 0, sill: 0 });
    return;
  }
  if (side) {                                                                  // the white stair core
    const xs = axes(0, len, Math.max(1, Math.round(len / 2.2)));
    for (const y of floors) row(P, W, xs, y + 0.2, 1.0, 1.0, { frame: '#cfd0cd', glass: '#46505f', fw: 0.05, bars: 0, T: false, surround: 0, sill: 0 });
    row(P, W, axes(0, len, 2), 0.4, 2.4, 1.6, { frame: '#3a3f48', glass: '#46505f', fw: 0.07, bars: 1, T: false, surround: 0, sill: 0 });
    return;
  }
  // the ends: a framed blank panel, a narrow column of windows by one edge, the dark balcony column by the other
  if (len > 8) {
    P.r(len * 0.25, 9, len * 0.7, 26, '#d2d1cd'); P.r(len * 0.25 + 0.15, 9.15, len * 0.7 - 0.15, 25.85, '#e0dfdb');
    for (let k = 1; k < 4; k++) P.r(len * 0.25, 9 + k * 4.25, len * 0.7, 9.1 + k * 4.25, '#c2c1bd');
    for (const y of floors) P.win(0.9, y + 0.2, 1.6, y + 1.4, { frame: '#cfd0cd', glass: '#46505f', fw: 0.05, bars: 0, sill: 0 });
    P.r(len - 2.4, 2.9, len - 0.3, top - 0.5, '#2f343c');
    for (const y of floors) P.r(len - 2.4, y - 0.12, len - 0.3, y + 0.05, '#9a9b98');
  }
  P.r(0, 0.4, len, 2.9, '#b9bab6');
}

// ---------------------------------------------------------------- Lemon Gym, Narva mnt 27a
const GYM = '#2b2f3a', LIME = '#b8d43a';
function gymLogo(P, x, y, s) {
  P.r(x - 0.75 * s, y - 0.75 * s, x + 0.75 * s, y + 0.75 * s, LIME); P.r(x - 0.58 * s, y - 0.58 * s, x + 0.58 * s, y + 0.58 * s, GYM);
}
function gym(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  if (W.mid[1] < 2353 && W.mid[0] > 1693) {                                     // the low house at Mäe 1 the map joins to it
    P.r(0, P.y0, len, P.y1, '#8b7a6c'); P.r(0, P.y0, len, 0.5, '#6f665e');
    const xs = axes(0, len, Math.max(1, Math.round(len / 3)));
    for (const y of [1.0, 4.0]) if (y + 1.5 < top) row(P, W, xs, y, 1.4, 1.3, { frame: '#e9e6df', glass: '#46505f', fw: 0.06, bars: 1, T: false, surround: 0, sill: 0.06 });
    return;
  }
  P.r(0, P.y0, len, P.y1, GYM);
  for (let y = 4.2; y < top; y += 1.2) P.r(0, y, len, y + 0.03, '#363b47');
  if (W.foot > 7) return;                                                      // the raised roof parts
  const front = (W.nz > 0.9 && len > 15) || (W.nx < -0.9 && len > 8 && len < 15);
  if (front) {
    // tall dark windows between slanted piers, lime lines, the glazed ground floor
    const xs = axes(0, len, Math.max(1, Math.round(len / 3.4)));
    for (const x of xs) {
      P.poly([[x - 1.3, 4.4], [x + 1.0, 4.4], [x + 1.3, top - 1.4], [x - 1.0, top - 1.4]], '#1d222b');
      P.line(x - 0.9, 5.2, x + 0.6, 6.4, LIME, 0.07);
    }
    for (const x of xs) { P.r(x - 1.35, 0.3, x + 1.35, 3.5, '#1c2129'); P.grad(x - 1.25, 0.35, x + 1.25, 3.4, '#3f4b57', '#232a33'); P.r(x - 1.35, 1.3, x + 1.35, 1.38, LIME); }
    P.r(0, 3.6, len, 4.2, '#20242d');
    if (len > 15) { gymLogo(P, len * 0.28, top - 0.85, 0.75); P.text('LEMON GYM', len * 0.28 + 1.0, top - 0.85, 1.05, LIME, '800 %px Arial, sans-serif', 'left'); }
    else { P.text('LEMON GYM', len / 2, top - 0.8, 0.65, LIME, '800 %px Arial, sans-serif'); }
    return;
  }
  if (W.nx > 0.4 && W.nz < -0.7 && len > 30) {                                 // the side to Mäe tänav: x = len at its west end
    P.r(len - 13, 3.2, len - 1.0, 8.6, '#e6d23a'); P.r(len - 12.8, 3.4, len - 1.2, 8.4, '#efdf52');
    P.text('TREENINGUD', len - 7.0, 7.4, 1.0, '#2a2a2a', '900 %px Arial, sans-serif');
    P.text('Lemon Gym', len - 7.0, 5.9, 0.6, '#2a2a2a', '700 %px Arial, sans-serif'); P.text('lemongym.ee', len - 7.0, 4.6, 0.42, '#2a2a2a', '400 %px Arial, sans-serif');
    for (const x of axes(len - 22, len - 14, 3)) { P.r(x - 0.9, 0.4, x + 0.9, 2.4, '#1c2129'); P.grad(x - 0.8, 0.5, x + 0.8, 2.3, '#3f4b57', '#232a33'); }
    P.r(len - 30, 0, len - 26, 2.8, '#3a3e46');                                 // the car park door
  }
}

// ---------------------------------------------------------------- the glass pavilion, Narva mnt 27b
function pavilion(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, '#ddd8cc');
  if (W.nx < -0.9 && len > 15) {
    P.r(0, top - 1.1, len, top, '#2a2d33');
    for (const x of axes(0, len, Math.round(len / 2.6))) { P.r(x - 1.3, 0.25, x + 1.3, top - 1.2, '#2a2d33'); P.grad(x - 1.22, 0.3, x + 1.22, top - 1.25, '#6f7f8f', '#3c4651'); }
  } else { P.r(0, top - 0.6, len, top, '#2a2d33'); P.r(0, P.y0, len, 0.35, '#9a968c'); }
}

// ---------------------------------------------------------------- Narva mnt 69
const SALMON = '#e2a58b', WTRIM = '#f6f2ea';
function narva69(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, SALMON);
  if (W.front) P.weather(0, P.y0, len, P.y1, 0.3, 5);
  P.r(0, P.y0, len, 0.7, '#a8a39b');
  P.r(0, top - 0.55, len, top, WTRIM); P.r(0, top - 0.55, len, top - 0.48, 'rgba(70,60,60,0.3)');
  P.r(0, 3.55, len, 3.7, WTRIM);
  const win = { frame: '#f4f1ea', glass: '#4c5466', fw: 0.07, bars: 1, rails: 1, T: false, surround: 0.12, sc: WTRIM, sill: 0.08 };
  if (len < 16) { const xs = axes(0, len, Math.max(1, Math.round(len / 3))); for (const y of [1.2, 4.6, 7.8]) if (y + 1.7 < top) row(P, W, xs, y, 1.6, 1.0, win); return; }
  for (const x of [0.25, len / 3, len * 2 / 3, len - 0.25]) P.r(x - 0.3, 0.7, x + 0.3, top - 0.55, WTRIM);
  const xs = axes(0, len, 9);
  for (const y of [1.2, 4.6, 7.8]) if (y + 1.7 < top) row(P, W, xs.filter((x) => Math.abs(x - len / 2) > 0.6 || y > 2), y, 1.6, 1.0, win);
  if (W.nx < -0.9) P.door(len / 2 - 0.6, len / 2 + 0.6, 2.6, '#6b4a3a', { frame: WTRIM, light: 0.4 });
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['narva 27', S35, 0, [1703, 2425], 34, 0xc4673f, 0x8e9093, dorm27],
  ['lemon gym', S34, -43, [1694, 2368], 40, 0x2b2f3a, 0x5d6068, gym],
  ['narva 27b', S35, 10, [1724.6, 2456.7], 22, 0xddd8cc, 0x707276, pavilion],
  ['narva 69', S34, -11, [1648, 2281], 16, 0xe2a58b, 0x5f5a58, narva69],
];
const FINE = [[1691.4, 2409.3], [1696.6, 2442.7], [1700.7, 2430.6], [1704.1, 2449.8], [1675.9, 2371.6], [1677.7, 2398.2], [1666.9, 2391.6], [1702.8, 2368.3], [1711.5, 2462.6], [1640.8, 2280.9]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < 3);

export function narva3Walls(walls) {
  for (const S of [S35, S34]) {
    const list = HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r }));
    setHouseColours(walls, S[0], S[1], S[2], list);
  }
  // the map's Neste canopy, a plate on four sticks: built again
  addHouseColours(walls, S34[0], S34[1], S34[2], [{ base: 461, x: 1657.7, z: 2350.4, hide: true, reach: 10 }, { base: 461, x: 1657.7, z: 2350.4, hide: true, shelter: true, reach: 10 }]);
}

// Neste's canopy (the map's four posts): s from the south-west short side along the long side, v + = west
const NES = frame([1655.9, 2345.07], [0.313, 0.950]), NES_L = 11.3;
const FENCE = [[1643.8, 2297], [1643.8, 2322]];

export function createNarva3(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  world.addClearing({ test: (x, z) => { const [s, v] = NES.sv(x, z); return s > -1 && s < NES_L + 1 && v > -4.5 && v < 4.5; } });
  { const [x, z] = NES.at(NES_L / 2, 0); world.addSolids([{ x, z, yaw: NES.YAW, hx: 3.4, hz: 0.65 }]); }
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva3 fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;

    // ---- Neste: green over a blue band, NESTE at the end to Narva mnt, one island with two posts and pumps
    const cg = Math.min(...[[0, -3.4], [0, 3.4], [NES_L, -3.4], [NES_L, 3.4]].map(([s, v]) => h(...NES.at(s, v))));
    const long = paintTexture(12.0, 0, 1.0, 22, (P) => {
      P.r(0, 0, 12, 1.0, '#7cc242'); P.r(0, 0, 12, 0.32, '#1f5fb3');
      P.r(0, 0, 2.6, 1.0, '#1f5fb3'); P.text('NESTE', 1.3, 0.55, 0.5, '#ffffff', '900 italic %px Arial, sans-serif');
      P.r(2.6, 0.62, 3.6, 0.68, '#ffffff');
    });
    const green = new THREE.MeshLambertMaterial({ color: 0x7cc242 }), lm = new THREE.MeshLambertMaterial({ map: long });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(12.0, 1.0, 7.4), [green, green, new THREE.MeshLambertMaterial({ color: 0xe9e9e7 }), new THREE.MeshLambertMaterial({ color: 0xe2e3e5 }), lm, lm]);
    { const [x, z] = NES.at(NES_L / 2, 0); roof.position.set(x, cg + 4.6 + 0.5, z); roof.rotation.y = NES.YAW; roof.castShadow = shadows; roof.updateMatrix(); group.add(roof); }
    const ig = h(...NES.at(NES_L / 2, 0));
    A.box(NES, NES_L / 2, 0, 6.8, 1.3, -0.2, 0.18, 0xb9bbbd, ig);
    for (const s of [NES_L / 2 - 2.7, NES_L / 2 + 2.7]) { A.box(NES, s, 0, 0.55, 0.55, 0.18, 4.6, 0x7cc242, ig); A.box(NES, s, 0, 0.57, 0.57, 1.2, 3.4, 0x1f5fb3, ig); }
    for (const s of [NES_L / 2 - 1.1, NES_L / 2 + 1.1]) { A.box(NES, s, 0, 0.8, 0.5, 0.18, 1.7, 0xeceeef, ig); A.box(NES, s, 0, 0.82, 0.52, 1.7, 2.0, 0x1f5fb3, ig); }
    yield;

    // ---- Lemon Gym's roof sign: INVARU in lime letters in a dark steel frame over the corner to Narva mnt
    { const tex = paintTexture(7.0, 0, 1.6, 30, (P) => { P.text('INVARU', 3.5, 0.8, 1.15, LIME, '900 %px Arial, sans-serif'); }, { alpha: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 1.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
      // over the front to the south (wall 1677.7, 2398.2 facing south), 3 m in from its west corner
      const x = 1672.0, z = 2396.6, g = h(x, z + 2);
      m.position.set(x, g + 11.2, z); m.updateMatrix(); group.add(m);
      for (const dx of [-3.4, 3.4]) { p.box(0.1, 2.4, 0.1, 0x30343c, x + dx, g + 11.0, z); p.box(0.1, 0.1, 3.0, 0x30343c, x + dx, g + 12.2, z - 1.5); }
      p.box(6.9, 0.08, 0.08, 0x30343c, x, g + 12.2, z);
    }

    // ---- the red board fence south of Narva 69, along the road
    { const [a, b] = FENCE, len = Math.hypot(b[0] - a[0], b[1] - a[1]), g = Math.min(h(...a), h(...b));
      A.bar(a, b, 0.04, 0.1, 1.45, 0x8f3d2f, g);
      for (let k = 0; k <= Math.round(len / 2.5); k++) { const t = k / Math.round(len / 2.5), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; p.box(0.1, 1.6, 0.1, 0x6e2d22, x, h(x, z) + 0.8, z); }
      A.bar(a, b, 0.08, 1.4, 1.5, 0x6e2d22, g);
      world.addSolids([{ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: len / 2, hz: 0.1 }]);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 100) return;
      if (![[1703, 2425], [1694, 2368], [1648, 2281], [1657, 2350]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva3');
    },
  };
}
