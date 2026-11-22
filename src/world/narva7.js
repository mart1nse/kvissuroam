// Narva mnt from Peetri kirik to Raadi Maxima, batch 7 of the Narva mnt kaardista (Martin, 22 Nov: Street View
// shots 11.12.40 to 11.14.22, 2023 and 2024).
// Seen in his shots:
//  - Peetri kirik (Narva 104): orange-red brick, tall pointed windows with white tracery, buttresses, the tower
//    to the junction and its slate spires, the brick posts and iron rails of its fence to Narva mnt;
//  - Narva 108 at the Peetri junction: white plaster, three floors under a red roof;
//  - Narva 161: red brick, two floors and a glass floor on top;
//  - Raadi Maxima (Narva 112): the long wall of folded copper-coloured panels to Narva mnt, the MAXIMA letters
//    and the XX over the entrance to the car park, Apotheka beside it;
//  - Narva 165a: dark blue-grey brick flats with white windows;
//  - Narva 167: dark brown weatherboards; across the road the yellow-grey boarded house and the white houses
//    under red roofs.
// Guessed: the backs. Nothing on a carriageway, no street names on the road. Built only near the church or the
// Maxima (110 m), far from the centre test drive and the race lap.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
const S33 = ['3_3', 1120, 1120], S43 = ['4_3', 1760, 1120];
const SANS = '700 %px Arial, sans-serif';
const WIN = { frame: '#f4f1ea', glass: '#4f5d72', fw: 0.08, bars: 1, T: true, surround: 0, sill: 0.07 };
const TRIGGERS = [[1760, 1700, 110], [1850, 1520, 110]];

function floors(P, W, first, step, h, w, pitch, opt = WIN) {
  const t = Math.min(P.y1, W.eaves + 0.05), xs = axes(0, W.len, Math.max(1, Math.round(W.len / pitch)));
  for (let s = first; s + h < t - 0.3; s += step) row(P, W, xs, s, h, w, opt);
  return xs;
}

// ---------------------------------------------------------------- Peetri kirik
function church(P, W) {
  const len = W.len, t = Math.min(P.y1, W.eaves + 0.05);
  P.brick(0, P.y0, len, P.y1, [178, 84, 58], 104);
  P.r(0, P.y0, len, 0.9, '#8f8a86');
  const arch = (x, y, w, h, c) => { P.r(x - w / 2, y, x + w / 2, y + h - w * 0.6, c); P.poly([[x - w / 2, y + h - w * 0.6], [x, y + h], [x + w / 2, y + h - w * 0.6]], c); };
  const n = Math.max(1, Math.round(len / 4.2)), xs = axes(0, len, n);
  // buttresses between the bays
  for (let k = 0; k <= n; k++) { const x = len * k / n; P.r(Math.max(0, x - 0.35), 0, Math.min(len, x + 0.35), t - 1, '#9c4a33'); }
  if (W.foot > 12) {                                                          // up the tower: louvred openings
    for (const x of axes(0, len, Math.max(1, Math.round(len / 3)))) { arch(x, W.foot + 1.5, 1.4, 4.0, '#efe9df'); arch(x, W.foot + 1.65, 1.1, 3.7, '#3a3431'); }
    return;
  }
  const tall = t > 12;
  for (const x of xs) {
    if (x < 1.2 || x > len - 1.2) continue;
    const h = tall ? Math.min(9, t - 3.5) : Math.min(5.5, t - 2);
    arch(x, 2.4, 2.0, h, '#efe9df'); arch(x, 2.55, 1.7, h - 0.25, '#3c4656');
    P.r(x - 0.05, 2.55, x + 0.05, 2.55 + h - 1.2, '#efe9df'); P.r(x - 0.85, 2.55 + h * 0.5, x + 0.85, 2.55 + h * 0.5 + 0.08, '#efe9df');
  }
  if (W.nz > 0.8 && len > 9 && len < 13) {                                    // the tower's front: the portal
    arch(len / 2, 0, 3.0, 5.4, '#efe9df'); arch(len / 2, 0.05, 2.4, 5.0, '#4b3326');
  }
  P.r(0, t - 0.5, len, t, '#efe9df');
  if (P.y1 - t > 12) { P.r(0, t, len, P.y1, '#4a4e55'); for (let y = t; y < P.y1; y += 0.5) P.r(0, y, len, y + 0.05, '#3c3f45'); }   // the slate spire
}

// ---------------------------------------------------------------- Narva 108, 161, 165a, 167, 122
function white108(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#efeee8'); P.weather(0, 0, len, P.y1, 0.3, 108);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 0.8, '#a4a3a0'); P.r(0, 3.3, len, 3.42, '#d9d6cc'); P.r(0, 6.4, len, 6.52, '#d9d6cc');
  floors(P, W, 1.2, 3.1, 1.6, 1.2, 2.9);
}
function brick161(P, W) {
  const len = W.len, t = Math.min(P.y1, W.eaves + 0.05);
  P.brick(0, P.y0, len, P.y1, [150, 70, 54], 161);
  if (W.foot > 3) return;
  P.r(0, P.y0, len, 0.6, '#8b8886');
  const xs = axes(0, len, Math.max(1, Math.round(len / 2.6)));
  row(P, W, xs, 1.0, 1.6, 1.2, WIN); row(P, W, xs, 4.0, 1.6, 1.2, WIN);
  if (t > 8) { P.r(0, 6.6, len, t, '#9db0bd'); for (let x = 0; x < len; x += 1.2) P.r(x, 6.6, x + 0.06, t, '#e8ecee'); P.r(0, 6.6, len, 6.75, '#e8ecee'); }
}
function flats165(P, W) {
  const len = W.len;
  P.brick(0, P.y0, len, P.y1, [62, 70, 92], 165);
  if (W.foot > 6) return;
  P.r(0, P.y0, len, 0.7, '#6f7176');
  floors(P, W, 1.1, 2.9, 1.5, 1.3, 3.0, { ...WIN, T: false, frame: '#ede9e0', glass: '#3e4757' });
}
function boards(rgb, seed) {
  return (P, W) => {
    P.boards(0, P.y0, W.len, P.y1, rgb, 0.16); P.weather(0, 0, W.len, P.y1, 0.5, seed);
    if (W.foot > 3) return;
    P.r(0, P.y0, W.len, 0.55, '#7f7e80');
    floors(P, W, 1.0, 3.1, 1.5, 1.1, 2.6);
  };
}
function whiteRed(P, W) {
  P.r(0, P.y0, W.len, P.y1, '#f0eeea'); if (W.foot > 3) return; P.r(0, P.y0, W.len, 0.5, '#a3a2a0'); floors(P, W, 1.0, 3.0, 1.4, 1.1, 2.6);
}

// ---------------------------------------------------------------- Raadi Maxima
const COP = ['#b5653c', '#9c5232', '#c9794a', '#a95d38'];
function copper(P, x0, x1, y0, y1) {
  const s = 2.4;
  for (let x = x0, i = 0; x < x1; x += s, i++) for (let y = y0, j = 0; y < y1; y += s, j++) {
    const xa = x, xb = Math.min(x1, x + s), ya = y, yb = Math.min(y1, y + s), m = [(xa + xb) / 2, (ya + yb) / 2];
    const c = (i * 3 + j * 5) % 4;
    P.poly([[xa, ya], [xb, ya], m], COP[c]); P.poly([[xb, ya], [xb, yb], m], COP[(c + 1) % 4]);
    P.poly([[xb, yb], [xa, yb], m], COP[(c + 2) % 4]); P.poly([[xa, yb], [xa, ya], m], COP[(c + 3) % 4]);
  }
}
function maxima(P, W) {
  const len = W.len, t = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, '#8e8c8a');
  if (W.foot > 3) { copper(P, 0, len, P.y0, P.y1); return; }
  copper(P, 0, len, 0, t);
  P.r(0, P.y0, len, 0.35, '#5f5d5c');
  const toRoad = W.nx > 0.8, toPark = W.nz < -0.75 && len > 50;
  if (toPark) {
    // the entrance at the car park's end: glass under the copper, MAXIMA and XX above, Apotheka along
    const e0 = len - 22;
    P.r(e0, 0.3, len - 2, 3.4, '#2b3038'); P.grad(e0 + 0.2, 0.4, len - 2.2, 3.3, '#6a7b8c', '#2f3a46');
    for (const x of axes(e0, len - 2, 8)) P.r(x - 0.05, 0.4, x + 0.05, 3.3, '#c8ccd0');
    P.text('MAXIMA', len - 13, 5.3, 1.9, '#1c56b8', '900 %px Arial Black, Arial, sans-serif');
    P.r(len - 6.0, 4.3, len - 4.0, 6.3, '#ffffff'); P.r(len - 3.8, 4.3, len - 1.8, 6.3, '#ffffff');
    P.text('X', len - 5.0, 5.3, 1.6, '#e2231a', '900 %px Arial, sans-serif'); P.text('X', len - 2.8, 5.3, 1.6, '#e2231a', '900 %px Arial, sans-serif');
    P.r(e0 - 14, 0.3, e0 - 1, 2.9, '#2d333b'); P.grad(e0 - 13.8, 0.4, e0 - 1.2, 2.8, '#6a7b8c', '#2f3a46');
    P.r(e0 - 14, 3.2, e0 - 4, 4.1, '#f4f4f2'); P.text('Apotheka', e0 - 9, 3.65, 0.6, '#3d3d3f', SANS);
  } else if (toRoad && len > 30) {
    for (const x of axes(0, len, Math.round(len / 9))) { P.r(x - 1.3, 0.6, x + 1.3, 2.4, '#3a3f46'); }
  }
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['peetri kirik', S33, 1597, [1736, 1698], 28, 0xb2543a, 0x4a4e55, church],
  ['narva 108', S43, 1729, [1778, 1628], 22, 0xefeee8, 0x9a4a3c, white108],
  ['narva 161', S43, 1843, [1848, 1606], 12, 0x964636, 0x5b5d63, brick161],
  ['raadi maxima', S43, 1865, [1807, 1525], 55, 0xa95d38, 0x8f9196, maxima],
  ['narva 165a', S43, 1930, [1896, 1520], 16, 0x3e465c, 0x4b4f57, flats165],
  ['narva 167', S43, 1854, [1915, 1489], 16, 0x5a4434, 0x3c4048, boards([92, 70, 54], 167)],
  ['narva 122', S43, 1672, [1882, 1467], 14, 0xb3ad94, 0x55585e, boards([180, 172, 146], 122)],
  ['narva 124', S43, 1466, [1863, 1456], 10, 0xf0eeea, 0xa2483a, whiteRed],
  ['narva 124b', S43, 1573, [1858, 1469], 8, 0xf0eeea, 0xa2483a, whiteRed],
];
const FINE = [[1748.4, 1704.3], [1723.0, 1714.5], [1728.0, 1713.2], [1784.3, 1631.3], [1787.0, 1613.9], [1843.9, 1603.7],
  [1831.8, 1550.3], [1845.9, 1529.3], [1821.2, 1503.7], [1888.3, 1521.7], [1912.2, 1483.5], [1907.6, 1494.4], [1879.6, 1472.3],
  [1861.8, 1454.7], [1856.7, 1468.0]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < 3);

export function narva7Walls(walls) {
  for (const S of [S33, S43]) {
    const hs = HOUSES.filter((h) => h[1] === S);
    setHouseColours(walls, S[0], S[1], S[2], hs.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

export function createNarva7(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva7 fronts' });
    yield 'frame';
    // the church's fence to Narva mnt: brick posts, iron rails and bars, 3 m in front of the wall and clear of
    // the footway (1.9 m) and the carriageway (5.5 m)
    const A = areaKit(world, group, { shadows });
    const { p, h, bar } = A;
    // the main spire in slate over the map's red one: eight sides from the tower top at 50 m to the tip at 75 m
    { const r = 4.7, y0 = 49.6, y1 = 75.6, c = [1728.3, 1713.0], tip = [1729.5, 1709.8];
      const g = new THREE.ConeGeometry(r, y1 - y0, 8), pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > (y1 - y0) / 2 - 1e-3) { pos.setX(i, pos.getX(i) + tip[0] - c[0]); pos.setZ(i, pos.getZ(i) + tip[1] - c[1]); }
      g.computeVertexNormals();
      p.add(g, 0x4a4e55, c[0], (y0 + y1) / 2, c[1]);
      p.box(0.12, 1.6, 0.12, 0xc9a54a, tip[0], y1 + 0.8, tip[1]); p.box(0.8, 0.12, 0.12, 0xc9a54a, tip[0], y1 + 1.1, tip[1]);
    }
    { const a = [1740.3, 1727.0], b = [1761.0, 1686.1], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.2);
      const at = (k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
      for (let k = 0; k <= n; k++) { const q = at(k), g = h(q[0], q[1]); p.box(0.5, 1.7, 0.5, 0xa4513a, q[0], g + 0.85, q[1]); p.box(0.6, 0.12, 0.6, 0x8f8a86, q[0], g + 1.76, q[1]); }
      for (let k = 0; k < n; k++) {
        const q = at(k), r = at(k + 1), g = Math.min(h(q[0], q[1]), h(r[0], r[1]));
        bar(q, r, 0.3, -0.1, 0.4, 0x8f8a86, g); bar(q, r, 0.05, 1.3, 1.36, 0x2b2c30, g);
        for (let j = 1; j < 14; j++) { const m = [q[0] + (r[0] - q[0]) * j / 14, q[1] + (r[1] - q[1]) * j / 14]; p.box(0.025, 0.95, 0.025, 0x2b2c30, m[0], g + 0.85, m[1]); }
      }
      world.addSolids?.([{ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, hz: 0.3 }]);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (!TRIGGERS.some(([x, z, r]) => Math.hypot(car.x - x, car.z - z) < r)) return;
      if (![[1736, 1698], [1807, 1525], [1915, 1489], [1848, 1606]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva7');
    },
  };
}
