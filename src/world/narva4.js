// Ujula tänav, batch 4 of the Narva mnt kaardista (Martin, 22 Nov: Street View shots of June 2023 to Aug 2024).
// Seen in his shots:
//  - Ujula Konsum (Ujula 2): the grey-green glass flats over a ground floor of pale upright slats, the corner
//    tower with the dark coop box on its top, the REIB | Apotheka band and the coop | Konsum 9-22 panel, the
//    orange parcel lockers by the front;
//  - the university sports hall (Tartu Ülikooli spordihoone, Ujula 4): the long blue-grey ribbed hall, the copper
//    slatted front with TARTU ÜLIKOOLI SPORDIHOONE in white letters, the blue canopy over the glazed entrance,
//    the flags, the advert boards on the side to Ujula tänav.
// Guessed: the backs and the far ends. Nothing on a carriageway, no street names on the road. Built only within
// 110 m of the car park between them: the race lap passes 160 m away and the centre test drive further.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
const S34 = ['3_4', 1120, 1760];
const CENTRE = [1420, 2050];

// ---------------------------------------------------------------- Ujula Konsum, Ujula 2
const SANS = '700 %px Arial, sans-serif';
const GLASSG = '#9fb6b0', SLAT = '#d9cdb5', DARK = '#2a2d33';
function slats(P, x0, x1, y0, y1) { P.r(x0, y0, x1, y1, '#c9bca2'); for (let x = x0 + 0.15; x < x1; x += 0.45) P.r(x, y0, x + 0.22, y1, SLAT); }
function flats(P, W, y0, top) {
  const len = W.len;
  P.r(0, y0, len, top, GLASSG);
  for (let y = y0; y < top; y += 3.0) P.r(0, y, len, y + 0.14, '#6f817e');
  const xs = axes(0, len, Math.max(1, Math.round(len / 4.0)));
  for (let y = y0 + 0.35; y + 2 < top; y += 3.0) for (const x of xs) {
    P.r(x - 1.5, y, x + 1.5, y + 2.45, '#7d9894'); P.grad(x - 1.4, y + 0.08, x + 1.4, y + 2.37, '#5d7779', '#3e5258');
    P.r(x - 0.03, y, x + 0.03, y + 2.45, '#7d9894');
    if ((Math.round(x * 7) % 3) === 0) { P.r(x - 1.3, y, x + 1.3, y + 1.0, '#33393f'); P.r(x - 1.3, y + 0.92, x + 1.3, y + 1.0, '#9aa3a6'); }  // a balcony rail
  }
}
function konsum(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  if (W.foot > 6) { flats(P, W, P.y0, top); return; }
  P.r(0, P.y0, len, P.y1, '#c9bca2');
  slats(P, 0, len, 0, Math.min(top, 4.4));
  if (top > 6) flats(P, W, 4.4, top);
  if (W.nx > 0.5 && W.nz < -0.6 && len > 40) {
    // the front to the car park, x = len at the north-west corner: the coop tower there
    const t0 = len - 9.5;
    P.r(t0, 0, len, top, '#3a3e45');
    P.r(t0 + 0.4, 0.1, len - 0.4, 3.2, '#2a2f37'); P.grad(t0 + 0.5, 0.2, len - 0.5, 3.1, '#6f7f8f', '#3a4651');
    for (const x of axes(t0, len, 4)) P.r(x - 0.04, 0.1, x + 0.04, 3.2, '#1c2026');
    P.r(t0, 3.3, len, 4.5, DARK);
    P.text('coop', t0 + 2.6, 3.9, 0.85, '#ffffff', '800 %px "Arial Rounded MT Bold", Arial, sans-serif'); P.r(t0 + 4.4, 3.5, t0 + 4.45, 4.3, '#ffffff');
    P.text('Konsum', t0 + 4.6, 3.9, 0.4, '#ffffff', '600 %px Arial, sans-serif', 'left'); P.text('9-22', len - 1.2, 3.9, 0.55, '#ffffff', SANS);
    P.r(t0, 7.3, len, 8.3, DARK);
    P.text('REIB', t0 + 2.5, 7.8, 0.6, '#ffffff', '800 %px Arial, sans-serif'); P.text('Apotheka', t0 + 6.4, 7.8, 0.6, '#ffffff', '700 %px Arial, sans-serif');
    for (let x = t0 + 0.6; x < len - 0.4; x += 1.2) P.r(x, 4.6, x + 0.9, 7.1, '#5e6c78');
    for (let x = t0 + 0.6; x < len - 0.4; x += 1.2) P.r(x, 8.5, x + 0.9, top - 0.3, '#5e6c78');
    // the shop windows and the parcel lockers along the rest
    P.r(len * 0.25, 0.3, len * 0.45, 2.5, '#e7e6e2'); P.r(len * 0.47, 0.3, len * 0.66, 2.5, '#e8651e');
    for (let x = len * 0.47 + 0.6; x < len * 0.66; x += 0.6) P.r(x, 0.3, x + 0.03, 2.5, '#c24f12');
  }
}
// the Coop shop itself (the block beside the flats): pale upright slats all round, the glazed shop front and the
// entrance under a dark band on the side to the car park (11.15.15, 11.15.30)
function whiteSlats(P, x0, x1, y0, y1) { P.r(x0, y0, x1, y1, '#d7d9d8'); for (let x = x0 + 0.1; x < x1; x += 0.4) P.r(x, y0, x + 0.24, y1, '#eeeeec'); }
function konsumLow(P, W) {
  const len = W.len;
  whiteSlats(P, 0, len, P.y0, P.y1);
  if (W.foot > 4) return;
  P.r(0, P.y0, len, 0.3, '#8a8c8e');
  if (W.nx > 0.7 && W.nz > 0.5) {                                              // to the car park in front of the flats
    P.r(0, 0.2, len, 4.2, DARK); P.r(0.3, 0.3, len - 0.3, 3.2, '#2a2f37'); P.grad(0.4, 0.4, len - 0.4, 3.1, '#6f7f8f', '#3a4651');
    for (const x of axes(0, len, Math.max(1, Math.round(len / 2.4)))) P.r(x - 0.04, 0.3, x + 0.04, 3.2, '#1c2026');
    P.r(0.3, 3.35, len - 0.3, 4.1, '#22252b');
  }
}

// ---------------------------------------------------------------- the sports hall, Ujula 4
const RIB = '#8ea2b6', RIB2 = '#7b8fa3', COPPER = '#9b5b3d';
function ribbed(P, x0, x1, y0, y1) { P.r(x0, y0, x1, y1, RIB); for (let x = x0 + 0.25; x < x1; x += 0.5) P.r(x, y0, x + 0.12, y1, RIB2); }
function hall(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  ribbed(P, 0, len, P.y0, P.y1);
  P.r(0, P.y0, len, 0.4, '#7a7c80');
  if (W.foot > 6) return;
  if (W.nx > 0.7 && W.nz > 0.5 && len > 70) {
    // the front to the car park, x from its south-west end: white and glass, the copper front, the ribbed hall
    const hi = Math.min(P.y1, 10.6);
    // the lime green block at the south-west end, three rows of windows in white bands (11.15.49)
    P.r(0, 0, 18, hi - 0.4, '#9cc93a');
    for (const y of [0.9, 4.0, 7.0]) { P.r(0.3, y - 0.25, 17.7, y + 1.85, '#eef0ea'); for (const x of axes(0.3, 17.7, 7)) P.r(x - 1.0, y, x + 1.0, y + 1.6, '#3d4855'); }
    const c0 = 18, c1 = 46, top2 = hi;
    P.r(c0, 0, c1, top2, COPPER);
    for (let y = 3.6; y < top2; y += 0.32) P.r(c0, y, c1, y + 0.05, '#7f4730');
    P.text('TARTU ÜLIKOOLI SPORDIHOONE', (c0 + c1) / 2, top2 - 2.0, 1.25, '#ffffff', '800 %px Arial, sans-serif');
    row(P, W, axes(c0 + 4, c1 - 3, 6), 4.4, 1.4, 1.6, { frame: '#e3e6e8', glass: '#46505f', fw: 0.06, bars: 0, T: false, surround: 0, sill: 0 });
    P.r(c0 + 0.4, 0.1, c1 - 0.4, 3.3, '#2a3038'); P.grad(c0 + 0.5, 0.2, c1 - 0.5, 3.2, '#748595', '#3a4551');
    for (const x of axes(c0, c1, 10)) P.r(x - 0.05, 0.1, x + 0.05, 3.3, '#d7dadd');
    return;
  }
  if (W.nx > 0.7 && W.nz > 0.5) return;                                       // the big hall's side above the front: plain ribs
  if (len > 30 && W.foot < 1) {                                               // the long sides: a few windows, two advert boards
    row(P, W, axes(0, len, Math.round(len / 6)), 4.2, 2.2, 0.8, { frame: '#cfd3d6', glass: '#46505f', fw: 0.05, bars: 0, T: false, surround: 0, sill: 0 });
    const b = len * 0.62;
    P.r(b, 5.0, b + 4.6, 8.6, '#f2f2f0'); P.r(b + 0.15, 5.15, b + 4.45, 8.45, '#d4343a');
    P.text('Tartu 2024', b + 2.3, 7.6, 0.55, '#ffffff', SANS); P.text('Euroopa kultuuripealinn', b + 2.3, 6.4, 0.3, '#ffffff', SANS);
    P.r(b, 1.0, b + 4.6, 4.3, '#2b2d34'); P.text('Terviseks', b + 2.3, 2.9, 0.5, '#e05a7a', SANS);
  }
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['ujula konsum', S34, 35, [1476, 2139], 48, 0xa7bbb7, 0x8d9096, konsum],
  ['konsum front', S34, 70, [1475, 2100], 24, 0x3a3e45, 0x8d9096, konsumLow],
  ['spordihoone', S34, -54, [1366, 1941], 100, 0x8ea2b6, 0x9da3a8, hall],
];
const FINE = [[1497.3, 2123.5], [1485.0, 2087.3], [1467.2, 2093.3], [1445.9, 2113.1], [1482.6, 2105.9], [1408.2, 1960.0], [1368.4, 1978.9], [1356.8, 2000.2]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < 3);

export function narva4Walls(walls) {
  setHouseColours(walls, S34[0], S34[1], S34[2], HOUSES.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// the sports hall's front: x from its south-west end, n out to the car park
const HF = { a: [1384, 1990.8], u: [0.62, -0.79], n: [0.79, 0.62] };
const HAT = (x, o) => [HF.a[0] + HF.u[0] * x + HF.n[0] * o, HF.a[1] + HF.u[1] * x + HF.n[1] * o];
// the Konsum's front: x from its south-east end, n out to the car park
const KF = { a: [1514.6, 2137.7], u: [-0.77, -0.63], n: [0.63, -0.77] };

export function createNarva4(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva4 fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const yaw = (u) => Math.atan2(-u[1], u[0]);

    // ---- the sports hall: the blue canopy on two posts over the entrance, three flags
    { const [x, z] = HAT(31, 2.1), g = h(x, z);
      p.box(11.0, 0.35, 4.2, 0x2f5fa8, x, g + 3.5, z, yaw(HF.u));
      for (const s of [26.5, 35.5]) { const [px, pz] = HAT(s, 4.0); p.box(0.18, 3.4, 0.18, 0xd7dadd, px, h(px, pz) + 1.7, pz); }
      [[46, [0x2f6fc6, 0x16171a, 0xf4f4f2]], [48.5, [0x2f6fc6, 0x16171a, 0xf4f4f2]], [51, [0xf4f4f2, 0x2f5fa8, 0xf4f4f2]]].forEach(([s, cols]) => {
        const [fx, fz] = HAT(s, 3.0), fg = h(fx, fz);
        p.add(new THREE.CylinderGeometry(0.05, 0.07, 9, 6), 0xf0f0ee, fx, fg + 4.5, fz);
        cols.forEach((c, k) => p.box(0.03, 0.4, 1.6, c, fx, fg + 8.4 - k * 0.4, fz + 0.0, yaw(HF.u) + Math.PI / 2));
      });
    }
    yield;

    // ---- the Konsum's coop box on the tower's top, its letters to the car park and to the road
    { const tex = paintTexture(7.0, 0, 2.2, 30, (P) => { P.r(0, 0, 7, 2.2, DARK); P.text('coop', 3.5, 1.12, 1.6, '#ffffff', '800 %px "Arial Rounded MT Bold", Arial, sans-serif'); });
      const dm = new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), tm = new THREE.MeshLambertMaterial({ map: tex });
      const m = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.2, 2.0), [dm, dm, dm, dm, tm, tm]);
      const x = KF.a[0] + KF.u[0] * 40.5 - KF.n[0] * 0.6, z = KF.a[1] + KF.u[1] * 40.5 - KF.n[1] * 0.6;
      m.position.set(x, 13.1 + 1.1, z); m.rotation.y = yaw(KF.u); m.castShadow = shadows; m.updateMatrix(); group.add(m);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 110) return;
      if (![[1476, 2139], [1475, 2100], [1352, 1983], [1300, 1960], [1380, 1890]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva4');
    },
  };
}
