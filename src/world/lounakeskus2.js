// The Valguse and Optika strip north of Lõunakeskus (Martin, 20 Nov: batch 2 of his pink outline round southern
// Tartu), from his Street View screenshots (Aug 2023) and the Land Board's oblique air photos (Apr 2024):
//  - Bauhof (Lääneringtee 27): the white ribbed front with the orange band and logo, the red VÄLJAMÜÜK box,
//    the banners, the garden centre's side;
//  - Circle K (Lääneringtee 31): the shop and the red and white band round the pump canopy, its price sign;
//  - McDonald's (Lääneringtee 33): dark boards, the grey top band with the name and McCafé, the tall M;
//  - Lääneringtee 35: the beige KFC box on its corner, Handymann, Pet City, Jahipaun, Hawaii Express;
//  - Lidl and Mileedi (Optika 21): the black band along the front with the Lidl square, grey above;
//  - Optika 24 (home4you, Sõbralt Sõbrale), Ränirahu 21 (Masku, IKEA order point), the Jazz car wash.
// The map's own blocks keep their shapes and get painted walls. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const DEBUG = typeof location !== 'undefined' && /lkdebug/.test(location.search);
const S8 = ['-1_8', -1440, 4320], S9 = ['-1_9', -1440, 4960];
// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['bauhof', S9, 3845, [-1275, 5095], 75, 0xeeeeec, 0x55585c],
  ['circlek', S9, 4062, [-1134, 5150], 16, 0xf2f2f0, 0x4e5054],
  ['mcd', S9, 3891, [-1208, 5182], 24, 0x6b4a35, 0x3a3b3f],
  ['l35', S9, 3908, [-1168, 5216], 50, 0x8e9196, 0x55585c],
  ['lidl', S8, 3658, [-1220, 4865], 70, 0x8e9196, 0x55585c],
  ['opt24', S8, 3568, [-1322, 4800], 50, 0x34363b, 0x4e5054],
  ['ranirahu', S8, 3494, [-1425, 4797], 55, 0xc9cbcd, 0x55585c],
  ['wash', S8, 3689, [-1318, 4875], 26, 0xd8dadc, 0x4e5054],
];

export function lounakeskus2Walls(walls) {
  for (const S of [S8, S9]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const SANS = '700 %px Arial, sans-serif', SERIF = 'italic 700 %px Georgia, serif', THIN = '400 %px Arial, sans-serif';
function ribs(P, x0, x1, y0, y1, base, rib, step = 0.5) {
  P.r(x0, y0, x1, y1, base);
  for (let x = x0 + step / 2; x < x1; x += step) P.r(x, y0, x + 0.06, y1, rib);
}
function glass(P, x0, x1, y0, y1, tint = '#4c5d6e', frameCol = '#1c1d20') {
  P.r(x0, y0, x1, y1, frameCol);
  P.grad(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, tint, '#2e3946');
  for (let x = x0 + 1.5; x < x1 - 0.3; x += 1.5) P.r(x - 0.04, y0, x + 0.04, y1, frameCol);
}
function doors(P, len, every, w = 4, hh = 4.2, c = '#9a9ea3') {
  for (let x = every / 2; x < len - w; x += every) { P.r(x, 0, x + w, hh, c); for (let y = 0.35; y < hh; y += 0.35) P.r(x, y, x + w, y + 0.05, '#80848a'); }
}
// the Lidl square: blue, the yellow round, the red name
function lidlLogo(P, x, y, s) {
  P.r(x - s / 2, y - s / 2, x + s / 2, y + s / 2, '#0050aa');
  P.arc(x, y, s * 0.42, '#fff000');
  P.arc(x, y, s * 0.36, '#e60a14'); P.arc(x, y, s * 0.3, '#fff000');
  P.text('Lidl', x, y, s * 0.36, '#0050aa', 'italic 900 %px Arial, sans-serif');
}

function bauhof(P, W) {
  const len = W.len, top = W.peak;
  if (W.foot > 2) { ribs(P, 0, len, P.y0, P.y1, '#e6e6e4', '#d6d6d4', 0.4); return; }
  ribs(P, 0, len, P.y0, P.y1, '#eeeeec', '#dcdcda', 0.4);
  P.r(0, top - 1.0, len, top - 0.4, '#f07d00');
  if (dot(W, [0.96, 0.28]) > 0.9) {                            // the front over the car park (x = 0 at the south end)
    if (len > 60) {
      for (const [x, c1, c2] of [[8, '#4f8f3a', '#d9c25a'], [17, '#c9533c', '#f2d6a0'], [26, '#2c6fa8', '#e8e8e8']]) { P.r(x, 4.6, x + 7.5, top - 1.8, c1); P.r(x + 0.6, 5.2, x + 6.9, 7.2, c2); }
      P.r(44, 2.5, 56, top - 1.4, '#e3262e'); P.r(44.4, 2.9, 55.6, top - 1.8, '#f07d00');
      P.text('VÄLJA-', 50, top - 3.2, 1.6, '#ffffff', SANS); P.text('MÜÜK', 50, top - 5.0, 1.6, '#ffffff', SANS);
      P.text('bauhof', 66, top - 2.8, 3.0, '#f07d00', '900 %px Arial, sans-serif');
      glass(P, 47, 53, 0, 2.5, '#5d7389');
      for (let x = 60; x < len - 2; x += 2.2) P.r(x, 5.4, x + 1.4, 6.6, '#5d6f82');
      doors(P, 40, 20, 4, 4.2);
    } else {
      P.text('bauhof', len / 2, top - 2.8, 2.8, '#f07d00', '900 %px Arial, sans-serif');
      glass(P, len / 2 - 4, len / 2 + 4, 0, 3.2, '#5d7389');
      P.text('Ehitus- ja aiakaubad', len / 2, 4.4, 0.8, '#3d3f44', SANS);
    }
  } else if (len > 40) doors(P, len, 18, 4.4, 4.6);
}

function circlek(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#f2f2f0');
  P.r(0, top - 1.2, len, top, '#e3262e');
  P.r(0, top - 1.45, len, top - 1.2, '#f39200');
  if (len > 20) {
    P.text('CIRCLE K', len / 2, top - 0.6, 0.8, '#ffffff', SANS);
    glass(P, 2, len - 2, 0, top - 1.8, '#56697c', '#3a3c40');
  } else P.r(len / 2 - 0.6, 0, len / 2 + 0.6, 2.2, '#5a5e64');
}

function mcd(P, W) {
  const len = W.len, top = W.peak;
  P.boards(0, P.y0, len, P.y1, [107, 74, 53], 0.12, true);
  if (W.foot > 2) return;
  P.r(0, top - 1.6, len, top, '#3a3b3f');
  glass(P, 1, len - 1, 0, Math.min(3.4, top - 2.2), '#5a6a77', '#2b2c30');
  if (len > 15) {
    P.r(len * 0.3 - 1.0, top - 1.5, len * 0.3 + 1.0, top - 0.1, '#da291c');
    P.text('M', len * 0.3, top - 0.8, 1.3, '#ffc72c', '900 %px Arial, sans-serif');
    P.text("McDonald's", len * 0.62, top - 0.8, 0.9, '#ffffff', SANS);
    if (dot(W, [0.46, -0.89]) > 0.9) P.text('McCafé', len * 0.62, top - 2.6, 0.7, '#e9e2c9', SERIF);
  }
}

function l35(P, W) {
  const len = W.len, top = W.peak;
  if (W.foot > 2) { ribs(P, 0, len, P.y0, P.y1, '#8e9196', '#83868b', 0.5); return; }
  if (dot(W, [0.46, -0.89]) > 0.9 && W.mid[0] > -1145) {         // KFC's corner (x = 0 at the east end)
    P.r(0, P.y0, len, P.y1, '#c9b49a');
    for (let x = 0; x < len; x += 1.1) P.r(x, 3.8, x + 0.05, top, '#b49e84');
    P.text('KFC', len * 0.35, top - 2.2, 2.0, '#e4002b', '900 %px Arial, sans-serif');
    for (let x = len * 0.6; x < len * 0.6 + 4; x += 0.5) P.r(x, top - 3.2, x + 0.25, top - 0.8, '#e4002b');
    glass(P, 1, len - 1, 0, 3.4, '#5a6a77', '#2b2c30');
    return;
  }
  ribs(P, 0, len, P.y0, P.y1, '#8e9196', '#83868b', 0.5);
  P.r(0, top - 0.6, len, top, '#55585c');
  if (dot(W, [0.89, 0.46]) > 0.9 && len > 50) {                 // the shop row to the road (x = 0 at the south end)
    const shops = [[10, 'HAWAII EXPRESS', '#ffd23f', '#0e6e8c'], [22, 'Jahipaun', '#ffffff', '#3d5a2a'], [36, 'pet city', '#ffffff', '#e3262e'], [52, 'Handymann', '#ffffff', '#f07d00'], [len - 8, 'KFC', '#ffffff', '#e4002b']];
    for (const [x, t, fg, bg] of shops) { P.r(x - 5, top - 2.6, x + 5, top - 1.0, bg); P.text(t, x, top - 1.8, 1.0, fg, SANS); glass(P, x - 4, x + 4, 0, 3.2, '#56697c', '#2b2c30'); }
  } else if (len > 25) doors(P, len, 16, 3.6, 4.0);
}

function lidl(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#8e9196', '#83868b', 0.5);
  if (W.foot > 2) return;
  if (dot(W, [1, 0]) > 0.9 && len > 100) {                       // the front to the east (x = 0 at the south end)
    doors(P, 18, 6, 3.4, 4.0);
    P.r(18, 0, len, 4.6, '#1d1e21');
    lidlLogo(P, 30, 2.4, 3.6);
    glass(P, 34, 44, 0, 3.4, '#5a7088', '#2b2c30');
    P.text('MILEEDI', 54, 2.4, 1.2, '#e64fa8', SANS);
    glass(P, 49, 60, 0, 1.6, '#5a7088', '#2b2c30');
    P.r(76, 3.0, 92, 4.4, '#1b3a6b'); P.text('Husqvarna', 84, 3.7, 0.8, '#ffffff', SANS);
    glass(P, 77, 91, 0, 2.8, '#5a7088', '#2b2c30');
  } else if (len > 25) doors(P, len, 20, 3.6, 4.0);
}

function opt24(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#34363b', '#2d2f33', 0.6);
  P.r(0, top - 0.5, len, top, '#1d1e21');
  if (dot(W, [0, 1]) > 0.9 && len > 50) {                         // the front to the car park (x = 0 at the west end)
    glass(P, 6, 22, 0, 4.2, '#5a7088', '#1d1e21'); P.text('home4you', 14, top - 2.2, 1.6, '#ffffff', THIN);
    glass(P, 44, 60, 0, 4.2, '#5a7088', '#1d1e21'); P.r(43, top - 3.2, 61, top - 1.2, '#b7d433'); P.text('Sõbralt Sõbrale', 52, top - 2.2, 1.2, '#2b2c30', SANS);
  } else if (dot(W, [1, 0]) > 0.9 && len > 40) doors(P, len, 18, 3.6, 4.0, '#55585e');
}

function ranirahu(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#c9cbcd', '#b9bbbd', 0.5);
  P.r(0, top - 0.5, len, top, '#55585c');
  if (dot(W, [0, 1]) > 0.9 && len > 60) {                          // the front to the car park
    glass(P, 14, 26, 0, 4.0, '#5a7088', '#3a3c40'); P.text('MASKU', 20, top - 2.4, 2.0, '#b4122a', SANS);
    P.r(52, top - 4.0, 62, top - 1.2, '#0058a3'); P.r(53, top - 3.4, 61, top - 1.8, '#ffdb00'); P.text('IKEA', 57, top - 2.6, 1.1, '#0058a3', '900 %px Arial, sans-serif');
    glass(P, 54, 60, 0, 3.0, '#5a7088', '#3a3c40');
  } else if (len > 40) doors(P, len, 20, 3.8, 4.2);
}

function wash(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#d8dadc');
  P.r(0, top - 1.1, len, top, '#3b2c78');
  if (len > 20) {
    P.text('JAZZ', 5, top - 0.55, 0.8, '#ffffff', '900 %px Arial, sans-serif');
    for (let x = 9; x < len - 4; x += 5.2) { P.r(x, 0, x + 3.8, top - 1.6, '#2a2b30'); P.r(x + 0.2, top - 3.0, x + 3.6, top - 1.7, '#5a6c80'); }
  }
}

const PAINT = { bauhof, circlek, mcd, l35, lidl, opt24, ranirahu, wash };

// a canopy's fascia: a band round four corners, painted with `draw` on each side
function fascia(group, h, corners, y0, y1, tex, shadows) {
  const g = (corners.reduce((a, q) => a + h(q[0], q[1]), 0)) / 4;
  const m = new THREE.MeshLambertMaterial({ map: tex });
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, y1 - y0, 0.3), m);
    mesh.position.set((a[0] + b[0]) / 2, g + (y0 + y1) / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    mesh.castShadow = shadows;
    group.add(mesh);
  }
}

export function createLounakeskus2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [-1260, 5000];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false } }));
    for (const H of houses) { const paint = PAINT[H.name]; H.walls = [{ near: [0, 0], within: 1e9, only: (P, W) => paint(P, W) }]; }
    skinHouses(world, group, houses, { label: 'lounakeskus2 fronts', shadows, ppm: 9, far: 5, faces: (W) => W.foot < 2 && W.len > 15, debug: DEBUG });

    const dark = new THREE.MeshLambertMaterial({ color: 0x2b2c30 });
    const tall = (x, z, w, hh, d, tex, yaw) => {
      const t = new THREE.MeshLambertMaterial({ map: tex });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), [dark, dark, dark, dark, t, t]);
      m.position.set(x, h(x, z) + hh / 2, z); m.rotation.y = yaw; m.castShadow = shadows; group.add(m);
    };
    // Circle K: the band round the pump canopy, the pumps, the price sign
    const ck = paintTexture(18, 0, 1.1, 24, (P) => { P.r(0, 0, 18, 1.1, '#e3262e'); P.r(0, 0, 18, 0.18, '#f39200'); P.text('CIRCLE K', 9, 0.62, 0.7, '#ffffff', SANS); });
    fascia(group, h, [[-1130.4, 5142.1], [-1114.3, 5134.8], [-1107.3, 5150.3], [-1123.4, 5157.6]], 6.6, 7.7, ck, shadows);
    for (const [x, z] of [[-1121.5, 5141.5], [-1118.3, 5148.5], [-1115.1, 5155.5 - 4]]) {
      p.box(0.9, 0.25, 4.2, 0xb9bbbd, x, h(x, z) + 0.12, z, -0.43);
      p.box(0.6, 1.9, 0.9, 0xe9e9e7, x, h(x, z) + 1.2, z, -0.43);
      p.box(0.62, 0.35, 0.92, 0xe3262e, x, h(x, z) + 2.0, z, -0.43);
    }
    tall(-1146, 5128, 1.6, 9, 0.5, paintTexture(1.6, 0, 9, 24, (P) => {
      P.r(0, 0, 1.6, 9, '#e3262e'); P.r(0, 0, 1.6, 2.2, '#2b2c30'); P.arc(0.8, 7.8, 0.62, '#ffffff'); P.text('K', 0.8, 7.8, 0.8, '#e3262e', SANS);
      [['95', '1.759'], ['98', '1.820'], ['D', '2.026']].forEach(([a, b], k) => { P.r(0.1, 5.8 - k * 1.1, 1.5, 6.6 - k * 1.1, '#1d1e21'); P.text(a + ' ' + b, 0.8, 6.2 - k * 1.1, 0.42, '#ffd23f', SANS); });
    }), 0.4);
    // the tall M by McDonald's, on the grass corner north of the drive-through road
    tall(-1185, 5141, 2.2, 12, 0.5, paintTexture(2.2, 0, 12, 22, (P) => {
      P.r(0, 0, 2.2, 12, '#55585c'); P.r(0, 8.4, 2.2, 12, '#da291c'); P.text('M', 1.1, 10.2, 2.6, '#ffc72c', '900 %px Arial, sans-serif');
      P.r(0.1, 7.0, 2.1, 8.2, '#2b2c30'); P.text('McDrive', 1.1, 7.6, 0.45, '#ffffff', SANS);
    }), 0.48);
    // the Neste canopy on Valguse
    const ne = paintTexture(13, 0, 0.9, 24, (P) => { P.r(0, 0, 13, 0.9, '#ffffff'); P.r(0, 0, 13, 0.16, '#00953a'); P.text('neste', 6.5, 0.5, 0.6, '#0f3b84', '900 %px Arial, sans-serif'); });
    fascia(group, h, [[-1251.4, 4993.3], [-1246.8, 4981.4], [-1239.8, 4984.1], [-1244.4, 4996.0]], 4.6, 5.5, ne, shadows);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([[-1275, 5095], [-1220, 4865], [-1168, 5216]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
