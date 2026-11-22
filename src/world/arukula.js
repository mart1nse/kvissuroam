// Kaardista "Raadi, Mööbliait and Kvissentali tee" (Martin, 21 Nov), batch 3: road 3 (Aruküla tee) from Salvest to
// the Põllu lights, from his Street View shots ("6 Aruküla tee" of June 2023, "2 E264" and the Põllu corner of
// July 2024) and the Land Board's air photos.
//  - the three flats Aruküla tee 2, 4 and 6: terracotta cladding, dark grey stair bays and top floor, dark windows;
//    the two benches on the grass by the path;
//  - Salvesti tehasepood (Aruküla tee 3a): the beige slatted front with TEHASEPOOD, the glass shop corner; the
//    concrete bollards on their round pads along the car park by the road; Salvest's road front pale yellow with
//    rows of white windows;
//  - Olerex (Aruküla tee 1): the canopy with the yellow fascia, yellow pumps, the dark Xpress shop, the dark
//    AUTOPESU wash with its yellow band and glass doors;
//  - Tartu Pihlakodu (Põllu 1a): white with teal and blue strips.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /arudebug/.test(location.search);
const S22 = ['2_2', 480, 480], S12 = ['1_2', -160, 480];
const SANS = '700 %px Arial, sans-serif';

// [name, sector, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['flats', S12, 982, [479, 741], 17, 0xa5503a, 0x55575d],
  ['flats', S22, 1034, [491, 779], 18, 0xa5503a, 0x55575d],
  ['flats', S22, 1123, [506, 813], 18, 0xa5503a, 0x55575d],
  ['shop', S22, 1533, [544.5, 709.5], 13, 0xc9bda5, 0x6d6f74],
  ['salvest', S22, 1247, [560, 690], 140, 0xe6cf92, 0x7c7f85, (x) => x < 600],
  ['xpress', S22, 1575, [587.5, 802.5], 13, 0x3d3f45, 0x55575c],
  ['wash', S22, 1570, [572.7, 793.6], 10, 0x3a3c42, 0x55575c],
  ['pihla', S22, 1468, [625, 871], 34, 0xeeeeea, 0x6a6d73],
];

export function arukulaWalls(walls) {
  for (const S of [S22, S12]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
  }
  // the map's Olerex canopy, a flat plate: built again with its fascia
  addHouseColours(walls, S22[0], S22[1], S22[2], [{ base: 2098, x: 585, z: 814.6, hide: true, reach: 14 }, { base: 2098, x: 585, z: 814.6, hide: true, shelter: true, reach: 14 }]);
}
// the map's box sign for the factory shop: the name is painted on its front instead
export function arukulaSignSkip(world) {
  const prev = world.signSkip;
  world.signSkip = (x, z) => Math.hypot(x - 544.5, z - 709.5) < 15 || Math.hypot(x - 572.7, z - 793.6) < 10 || (prev ? prev(x, z) : false);
}

// ---------------------------------------------------------------- the painters
function flats(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#a5503a');
  for (let y = 0.6; y < top; y += 0.6) P.r(0, y - 0.015, len, y + 0.015, '#97482f');           // the cladding's courses
  P.r(0, P.y0, len, 0.6, '#55575d');
  if (top > 11) P.r(0, top - 3.2, len, top, '#4d5058');                                          // the dark top floor
  if (len < 3) { P.r(0, P.y0, len, top, '#4d5058'); return; }
  const win = { frame: '#2b2d32', glass: '#4f5e6d', fw: 0.07, bars: 0, T: false, sill: 0.05, surround: 0 };
  const bays = len > 20 ? [len * 0.33, len * 0.72] : len > 9 ? [len * 0.5] : [];
  for (const b of bays) P.r(b - 1.4, P.y0, b + 1.4, top, '#4d5058');                            // the dark stair bays
  for (let y = 1.0, k = 0; y + 1.5 < top - 0.4; y += 2.9, k++) {
    for (const b of bays) P.win(b - 0.5, y + 0.4, b + 0.5, y + 1.6, win);
    for (let x = 1.2; x + 1.2 < len - 0.6; x += 2.6) {
      if (bays.some((b) => Math.abs(x + 0.6 - b) < 2.2)) continue;
      P.win(x, y, x + 1.2, y + 1.5, win);
    }
  }
}
function shop(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#c9bda5');
  if (W.nx < -0.9 && len > 15) {                                   // the front to the road: x = 0 at its north end
    P.boards(0, P.y0, len * 0.62, top, [196, 184, 160], 0.16, true);
    P.text('TEHASEPOOD', len * 0.31, top - 1.1, 0.95, '#f6f4ef', SANS);
    P.r(len * 0.08, 0.9, len * 0.5, 1.9, '#3f4248');                                             // the long low window
    P.grad(len * 0.08 + 0.05, 0.95, len * 0.5 - 0.05, 1.85, '#7d93a5', '#46566a');
    P.r(len * 0.62, 0, len, top, '#55585e');                                                     // the glass corner
    P.r(len * 0.64, 0.05, len - 0.2, 3.1, '#2f3236'); P.grad(len * 0.64 + 0.1, 0.12, len - 0.3, 3.0, '#7a90a2', '#3f4e5b');
    for (let x = len * 0.64 + 1.4; x < len - 0.4; x += 1.4) P.r(x - 0.04, 0.05, x + 0.04, 3.1, '#2f3236');
    P.r(len * 0.8 - 0.6, 0.6, len * 0.8 + 0.6, 1.6, '#f2f2ee'); P.text('10.00', len * 0.8, 1.1, 0.22, '#33363b', SANS);
  } else P.boards(0, P.y0, len, top, [196, 184, 160], 0.16, true);
}
function salvest(P, W) {
  const len = W.len, top = W.peak;
  if (W.nx < -0.8) {                                               // the road front: pale yellow, rows of white windows
    P.r(0, P.y0, len, P.y1, '#e6cf92'); P.weather(0, P.y0, len, P.y1, 0.25, Math.round(len));
    P.r(0, P.y0, len, 0.5, '#9a9188');
    for (let y = 1.2; y + 1.4 < top - 0.6; y += 3.3) for (let x = 1.0; x + 2.0 < len - 0.6; x += 2.8) P.win(x, y, x + 2.0, y + 1.4, { frame: '#f4f2ec', glass: '#5d6d7c', fw: 0.08, bars: 1, T: false, sill: 0.04, surround: 0 });
    return;
  }
  P.r(0, P.y0, len, P.y1, '#c7cbd0');
  for (let x = 0.5; x < len; x += 1.0) P.r(x, P.y0, x + 0.03, top, '#bcc0c6');
  P.r(0, P.y0, len, 0.5, '#8f9196');
}
function xpress(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#3d3f45');
  P.r(0, top - 0.5, len, top, '#f5c400');
  if (len > 9) {
    P.r(len * 0.15, 0.1, len * 0.85, 2.9, '#2a2c30'); P.grad(len * 0.15 + 0.1, 0.2, len * 0.85 - 0.1, 2.8, '#73889a', '#3b4955');
    P.r(len * 0.5 - 1.1, top - 1.7, len * 0.5 + 1.1, top - 0.7, '#f2f2ee'); P.text('Xpress', len * 0.5, top - 1.2, 0.55, '#d4202a', 'italic 700 %px Arial, sans-serif');
  }
}
function wash(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#3a3c42');
  for (let x = 0.5; x < len; x += 1.0) P.r(x, P.y0, x + 0.03, top, '#33353a');
  if (len > 8) {
    P.r(len * 0.2, top - 1.6, len * 0.8, top - 0.5, '#f5c400'); P.text('AUTOPESU', len * 0.5, top - 1.05, 0.62, '#202124', SANS);
    for (const x0 of [len * 0.12, len * 0.55]) {                    // the two glass doors
      P.r(x0, 0, x0 + len * 0.33, 3.6, '#2b2d31');
      for (let y = 0.1; y < 3.5; y += 0.5) P.grad(x0 + 0.1, y, x0 + len * 0.33 - 0.1, y + 0.42, '#8ea3b3', '#61768a');
    }
  }
}
function pihla(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#eeeeea'); P.weather(0, P.y0, len, P.y1, 0.2, 31);
  P.r(0, P.y0, len, 0.7, '#7d8085');
  if (len < 6) return;
  for (const [x0, c] of [[0.18, '#3f8f95'], [0.5, '#2f5fa0'], [0.8, '#3f8f95']]) if (len > 14 || x0 === 0.5) P.r(len * x0 - 1.0, 0.7, len * x0 + 1.0, top, c);
  for (let y = 1.2; y + 1.4 < top - 0.5; y += 3.0) for (let x = 1.0; x + 1.4 < len - 0.6; x += 2.4) {
    if ([0.18, 0.5, 0.8].some((f) => Math.abs(x + 0.7 - len * f) < 1.8)) continue;
    P.win(x, y, x + 1.4, y + 1.4, { frame: '#f6f6f2', glass: '#536476', fw: 0.06, bars: 1, T: false, sill: 0.05, surround: 0 });
  }
}
const PAINT = { flats, shop, salvest, xpress, wash, pihla };

// Olerex's canopy: s along (0.86, -0.51), v + = (0.51, 0.86)
const CAN = frame([585 - 0.86 * 6.8 - 0.51 * 8.2, 814.6 + 0.51 * 6.8 - 0.86 * 8.2], [0.86, -0.51]);
const CW = 13.6, CD = 16.4;
const CENTRE = [535, 760];

export function createArukula(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , pick]) => ({ name, sec: S[0], base, at, r, pick, spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    // (the factory's long back and side walls are seen from afar only)
    skinHouses(world, group, houses, { label: 'arukula fronts', shadows, ppm: 10, far: 4, faces: (W) => W.len > 5 && W.foot < 2 && (W.nx < -0.7 || W.len < 40), debug: DEBUG });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;

    // ---- Olerex: the canopy (white roof, yellow fascia with the name), yellow posts and pumps
    const cg = Math.min(...[[0, 0], [CW, 0], [CW, CD], [0, CD]].map(([s, v]) => h(...CAN.at(s, v))));
    const fas = paintTexture(CD, 0, 1.3, 22, (P) => {
      P.r(0, 0, CD, 1.3, '#f5c400'); P.r(0, 0, CD, 0.12, '#2b2c30');
      P.text('OLEREX', CD / 2, 0.68, 0.78, '#1d1e21', '900 %px Arial, sans-serif');
    });
    const fm = new THREE.MeshLambertMaterial({ map: fas });
    for (const [s0, v0, s1, v1] of [[0, 0, CW, 0], [CW, 0, CW, CD], [CW, CD, 0, CD], [0, CD, 0, 0]]) {
      const [ax, az] = CAN.at(s0, v0), [bx, bz] = CAN.at(s1, v1), len = Math.hypot(bx - ax, bz - az);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 1.3, 0.3), fm);
      m.position.set((ax + bx) / 2, cg + 6.2 + 0.65, (az + bz) / 2); m.rotation.y = Math.atan2(-(bz - az), bx - ax); m.castShadow = shadows; group.add(m);
    }
    A.box(CAN, CW / 2, CD / 2, CW, CD, 7.35, 7.5, 0xeeeeec, cg);
    A.box(CAN, CW / 2, CD / 2, CW - 0.3, CD - 0.3, 6.15, 6.2, 0xdcdcda, cg);
    for (const s of [3.4, 10.2]) {
      A.box(CAN, s, CD / 2, 1.2, 7.2, -0.05, 0.2, 0xb9bbbd, cg);
      A.box(CAN, s, CD / 2, 0.42, 0.42, 0.2, 6.2, 0xf5c400, cg);
      for (const dv of [-2.4, 2.4]) { A.box(CAN, s, CD / 2 + dv, 0.6, 0.95, 0.2, 1.9, 0xf5c400, cg); A.box(CAN, s, CD / 2 + dv, 0.62, 0.97, 1.9, 2.25, 0x2b2c30, cg); }
    }
    yield;

    // ---- Salvest: the concrete bollards on their round pads by the road, the factory shop's car park
    for (let z = 676; z <= 716; z += 4.0) {
      const x = 524.2 + (z - 676) * 0.07;
      p.add(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 10), 0x9c9c9a, x, h(x, z) + 0.11, z);
      p.add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), 0x8a8a88, x, h(x, z) + 0.55, z);
    }
    // ---- the flats: two benches on the grass by the path
    for (const [x, z, yaw] of [[486.0, 707.5, 1.95], [489.6, 713.2, 1.95]]) {
      const g = h(x, z), c = Math.cos(yaw), sn = Math.sin(yaw);
      p.box(1.7, 0.06, 0.45, 0x2f2f33, x, g + 0.45, z, yaw);
      p.box(1.7, 0.4, 0.05, 0x2f2f33, x + sn * 0.22, g + 0.7, z + c * 0.22, yaw);
      for (const d of [-0.7, 0.7]) p.box(0.06, 0.45, 0.45, 0x26272b, x + c * d, g + 0.22, z - sn * d, yaw);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[479, 741], [506, 813], [544, 709], [585, 814], [625, 871]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'arukula'); }
    },
  };
}
