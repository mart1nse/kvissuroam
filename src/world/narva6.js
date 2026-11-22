// Narva mnt from Jaama up towards Peetri, batch 6 of the Narva mnt kaardista (Martin, 22 Nov: Street View
// shots 11.12.16 to 11.12.34, of 2011 and 2024).
// Seen in his shots:
//  - east side: the brown weatherboarded Narva 111 and 113 under dark metal roofs (the blue pub sign), the
//    brown-red boarded Narva 127 with its blue number plate, the grey four floors of Narva 149 with the
//    furniture shop's sign over the ground floor windows (2011);
//  - west side: the red brick Narva 86, Narva 88 with its plastered ground floor and grey-green boards above
//    and red-brown window surrounds, the red plastered four floors of Narva 92, the cream Narva 96 over a grey
//    ground floor, the terracotta Narva 100 with its paint peeling.
// From the air photos only (Tier B): Narva 94, 98, 121 and 123, plain plaster in the street's colours.
// Guessed: the backs. Nothing on a carriageway, no street names on the road. Built only within 125 m of
// (1695,1905): the centre test drive and the race lap are far away.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
const S34 = ['3_4', 1120, 1760];
const SANS = '700 %px Arial, sans-serif';
const WIN = { frame: '#f4f1ea', glass: '#4f5d72', fw: 0.08, bars: 1, T: true, surround: 0, sill: 0.07 };
const CENTRE = [1695, 1905];

// windows in rows: sills every `step` from `first`, as many as fit under the eaves
function floors(P, W, first, step, h, w, pitch, opt = WIN) {
  const t = Math.min(P.y1, W.eaves + 0.05), xs = axes(0, W.len, Math.max(1, Math.round(W.len / pitch)));
  for (let s = first; s + h < t - 0.3; s += step) row(P, W, xs, s, h, w, opt);
  return xs;
}
function plaster(col, { plinth = 0.6, pc = '#8f8e90', first = 1.0, step = 3.0, h = 1.5, w = 1.25, pitch = 3.0, weather = 0.3, opt = WIN } = {}) {
  return (P, W) => {
    P.r(0, P.y0, W.len, P.y1, col); if (weather) P.weather(0, 0, W.len, P.y1, weather, Math.round(W.len * 7));
    if (W.foot > 3) return;
    P.r(0, P.y0, W.len, plinth, pc);
    floors(P, W, first, step, h, w, pitch, opt);
  };
}
function boarded(rgb, { first = 1.0, step = 3.1, h = 1.5, w = 1.1, pitch = 2.6, weather = 0.5, opt = WIN, extra } = {}) {
  return (P, W) => {
    P.boards(0, P.y0, W.len, P.y1, rgb, 0.16); if (weather) P.weather(0, 0, W.len, P.y1, weather, Math.round(W.len * 11));
    if (W.foot > 3) return;
    P.r(0, P.y0, W.len, 0.55, '#7f7e80');
    floors(P, W, first, step, h, w, pitch, opt);
    if (extra) extra(P, W);
  };
}
const road = (W) => W.nx < -0.85 || W.nx > 0.85;          // the walls along Narva mnt

// ---------------------------------------------------------------- west side
const n86 = (P, W) => {
  P.brick(0, P.y0, W.len, P.y1, [138, 70, 56], 86);
  if (W.foot > 3) return;
  P.r(0, P.y0, W.len, 0.7, '#8d8a88');
  floors(P, W, 1.1, 3.0, 1.5, 1.3, 3.0, { ...WIN, T: false });
};
function n88(P, W) {
  const len = W.len, t = Math.min(P.y1, W.eaves + 0.05);
  P.boards(0, P.y0, len, P.y1, [128, 142, 132], 0.16); P.weather(0, 3.4, len, P.y1, 0.5, 88);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 3.4, '#d9cdb4'); P.r(0, P.y0, len, 0.5, '#8a3a2e'); P.r(0, 3.3, len, 3.45, '#8a3a2e');
  const xs = axes(0, len, Math.max(1, Math.round(len / 2.8)));
  const red = { ...WIN, surround: 0.14, sc: '#8a3a2e' };
  row(P, W, xs, 0.9, 1.6, 1.3, red); if (t > 6) row(P, W, xs, 4.3, 1.5, 1.1, red);
}
const n92 = plaster('#b0544a', { first: 1.0, step: 3.0, pitch: 3.0 });
const n94 = plaster('#d8d2c4', { first: 1.0, step: 3.0, pitch: 3.0 });
function n96(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#e9dcbf'); P.weather(0, 0, len, P.y1, 0.25, 96);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 1.3, '#8d8c8a');
  const xs = floors(P, W, 1.8, 3.0, 1.55, 1.15, 3.2);
  if (road(W)) for (const x of xs.slice(0, 2)) if (x > 1) { for (let k = 0; k < 7; k++) P.line(x - 0.6 + k * 0.2, 1.8, x - 0.6 + (k + 1) * 0.2, 3.3, '#3a3c40', 0.03); }   // the grilles
}
const n98 = plaster('#e2e0da', { first: 1.0, step: 3.0, pitch: 3.0 });
const n100 = plaster('#9a5d4f', { first: 1.2, step: 3.2, h: 1.6, w: 1.3, pitch: 3.2, weather: 0.9 });

// ---------------------------------------------------------------- east side
const pub = (P, W) => { if (road(W) && W.len > 15) { const x = W.len * 0.45; P.r(x, 2.7, x + 1.9, 3.3, '#2b5aa0'); P.text('PUBI', x + 0.95, 3.0, 0.32, '#ffffff', SANS); } };
const n111 = boarded([110, 86, 68], { extra: pub });
const n113 = boarded([102, 80, 64]);
const n121 = plaster('#ebe6d6', { first: 1.0, step: 3.0, pitch: 3.0 });
const n127 = boarded([124, 72, 60], { first: 1.2, step: 3.2, h: 1.75, w: 1.1, pitch: 2.4, weather: 0.6,
  extra: (P, W) => { if (road(W) && W.len > 15) { const x = W.len * 0.55; P.door(x - 0.55, x + 0.55, 2.3, '#6e5a4a', { frame: '#f4f1ea', light: 0.25, panels: 2 }); P.r(x - 0.35, 2.55, x + 0.15, 2.95, '#2c4f8c'); P.text('127', x - 0.1, 2.75, 0.24, '#ffffff', SANS); } } });
function n149(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#c6c8c5'); P.weather(0, 0, len, P.y1, 0.8, 149);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 0.6, '#8e8d8f');
  const xs = axes(0, len, Math.max(1, Math.round(len / 3.0)));
  for (let s = 4.2; s < Math.min(P.y1, W.eaves) - 1.8; s += 3.0) row(P, W, xs, s, 1.5, 1.3, { ...WIN, surround: 0.12, sc: '#e6e6e2' });
  if (!road(W)) { row(P, W, xs, 1.0, 1.5, 1.3, WIN); return; }
  for (const x of xs) if (x > 1.5 && x < len - 1.5) { P.r(x - 1.2, 0.8, x + 1.2, 2.9, '#e6e6e2'); P.r(x - 1.05, 0.9, x + 1.05, 2.8, '#4c5869'); }
  P.r(len * 0.18, 3.05, len * 0.18 + 9, 3.75, '#1d4f9a'); P.r(len * 0.18, 3.05, len * 0.18 + 9, 3.15, '#f2c230');
  P.text('MÖÖBEL', len * 0.18 + 4.5, 3.42, 0.5, '#ffffff', SANS);
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['narva 86', S34, 302, [1647, 1981], 22, 0x8a4638, 0x5b5d63, n86],
  ['narva 88', S34, 417, [1661, 1951], 15, 0x808e84, 0x8a3e34, n88],
  ['narva 92', S34, 507, [1661, 1929], 22, 0xb0544a, 0x6b4a40, n92],
  ['narva 94', S34, 648, [1674, 1918], 10, 0xd8d2c4, 0x5b5d63, n94],
  ['narva 94b', S34, 706, [1677, 1905], 10, 0xd8d2c4, 0x5b5d63, n94],
  ['narva 96', S34, 781, [1682, 1881], 22, 0xe9dcbf, 0x9a9ca0, n96],
  ['narva 98', S34, 1152, [1692, 1845], 16, 0xe2e0da, 0x8f9196, n98],
  ['narva 100', S34, 1246, [1698, 1814], 20, 0x9a5d4f, 0x7a7c80, n100],
  ['narva 111', S34, 325, [1692, 1974], 25, 0x6e5644, 0x3c4048, n111],
  ['narva 113', S34, 410, [1690, 1947], 13, 0x665040, 0x3c4048, n113],
  ['narva 121', S34, 500, [1696, 1926], 14, 0xebe6d6, 0xb9bbbe, n121],
  ['narva 123', S34, 559, [1702, 1911], 12, 0xebe6d6, 0xb9bbbe, n121],
  ['narva 127', S34, 618, [1706, 1894], 13, 0x7c483c, 0x4a4d54, n127],
  ['narva 149', S34, 1117, [1745, 1821], 35, 0xc6c8c5, 0x8f9196, n149],
];
// the walls seen from the road, painted finely (the rest at the coarse far sharpness)
const FINE = [[1655.1, 1988.1], [1648.6, 1970.2], [1666.9, 1953.0], [1673.3, 1934.3], [1678.1, 1919.8], [1682.0, 1907.3], [1690.4, 1883.3],
  [1699.0, 1840.7], [1695.3, 1852.8], [1707.2, 1817.8], [1706.1, 1817.1], [1677.4, 1963.6], [1687.5, 1959.6], [1684.1, 1943.6],
  [1690.4, 1925.0], [1695.2, 1909.3], [1701.1, 1891.9], [1727.8, 1821.2]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < 3);

export function narva6Walls(walls) {
  setHouseColours(walls, S34[0], S34[1], S34[2], HOUSES.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

export function createNarva6(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva6 fronts' });
    yield;
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 125) return;
      if (![[1647, 1981], [1698, 1814], [1745, 1821], [1692, 1974]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva6');
    },
  };
}
