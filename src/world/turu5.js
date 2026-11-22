// Turu tänav, batch 5: the south stretch from Zeppelin to the Sõpruse bridge (Martin, 20 Nov: kaardista).
// His Street View shots stop at Aura, so this stretch is built from the Land Board's oblique air photos of
// 2023/2024 (Tier B): the street-facing walls of the map's own blocks get painted, nothing new is added.
//  - Turu 15, 17 and 19: the three five-storey blocks of flats by the Aida junction (white; cream with the
//    solar roof; white with the red roof);
//  - Aida 11: the tall narrow block end-on to Turu, its name on the end wall;
//  - Turu 21: the white two-storey office with dark window bands and the glass ground floor;
//  - Turu 16 and the Kesklinna külmajaam (Turu 16a) on the river side: grey hut, white plant hall;
//  - Lidl (Turu 25): silver panel box, the glass corner by the car park, the logo to Turu;
//  - Turu 27: the car dealer's showroom, glass below white panels;
//  - Turu 27a: Hansa hotel and tavern, cream plaster and dark timber at the Sõpruse junction.
// The old boiler house chimney in the 2024 photos was blown up in 2024, so it is not built.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { TURU } from './turu.js';

const DEBUG = typeof location !== 'undefined' && /turudebug/.test(location.search);
const S6 = ['4_6', 1760, 3040], S47 = ['4_7', 1760, 3680], S57 = ['5_7', 2400, 3680];
const SANS = '700 %px Arial, sans-serif';
const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const TOWARD_TURU_SW = [0.718, -0.696];       // the face of a house on the south-west side that looks at Turu
const TOWARD_TURU_NE = [-0.718, 0.696];

// [name, sector, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['turu15', S6, 1, [2132, 3438], 30, 0xefeee9, 0x5d6066],
  ['turu17', S6, 28, [2166, 3478], 36, 0xe6d9bb, 0x3a4250],
  ['turu19', S6, 69, [2128, 3504], 34, 0xefece6, 0xb0513c],
  ['aida11', S6, -76, [2212, 3537], 26, 0xe4e3df, 0x55585c],
  ['turu21', S6, -22, [2253, 3561], 34, 0xeef0f0, 0x5a5e63],
  ['turu16', S6, -48, [2264, 3495], 18, 0xb7babd, 0x6a6e73],
  ['kylm', S6, 21, [2316, 3516], 36, 0xe8e9e8, 0x2f3846, (x, z) => TURU.sv(x, z)[1] < 0],
  ['lidl', S47, -135, [2360, 3693], 50, 0xcfd2d4, 0x6c7075],
  ['turu27', S57, 23, [2424, 3772], 42, 0xe6e8e9, 0x3a4250],
  ['turu27a', S57, 27, [2440, 3845], 40, 0xe9e1d0, 0x3b3f45],
];
const CENTRE = [2300, 3640];

export function turu5Walls(walls) {
  for (const S of [S6, S47, S57]) {
    const list = HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r }));
    setHouseColours(walls, S[0], S[1], S[2], list);
  }
}

function glassBand(P, x0, x1, y0, y1, top = '#7f97a8', bottom = '#43586a', mull = '#2f3438', bay = 1.5) {
  P.grad(x0, y0, x1, y1, top, bottom);
  for (let x = x0; x <= x1 + 0.01; x += bay) P.r(x - 0.04, y0, x + 0.04, y1, mull);
}

// ---------------------------------------------------------------- the flats by the Aida junction
function flats(P, W, { wall, plinth, balc = null, seed, doors = true }) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, wall); P.weather(0, P.y0, len, P.y1, 0.3, seed);
  P.r(0, P.y0, len, 1.0, plinth);
  if (len < 14) return;
  for (let y = 1.6; y + 1.5 < top - 0.8; y += 2.8) {
    for (let x = 1.4; x < len - 1.6; x += 3.2) {
      P.win(x, y, x + 1.45, y + 1.45, { frame: '#f6f5f2', glass: '#56677b', fw: 0.07, bars: 1, T: true, surround: 0, sill: 0.06 });
      if (balc && Math.floor((x - 1.4) / 3.2) % 4 === 2 && y > 2) {
        P.r(x - 0.7, y - 0.55, x + 2.15, y + 0.3, balc); P.r(x - 0.7, y + 0.3, x + 2.15, y + 0.4, '#f2f2ee');
      }
    }
  }
  if (doors) for (const x of [len * 0.2, len * 0.5, len * 0.8]) { P.r(x - 1.1, 2.4, x + 1.1, 2.6, '#8d8f91'); P.door(x - 0.7, x + 0.7, 2.2, '#6b4b3a', { frame: '#e8e6e0' }); }
}
const turu15 = (P, W) => flats(P, W, { wall: '#efeee9', plinth: '#a9a8a2', seed: 15 });
const turu17 = (P, W) => flats(P, W, { wall: '#e8dbbd', plinth: '#a8a090', balc: '#d6ccb4', seed: 17 });
const turu19 = (P, W) => flats(P, W, { wall: '#f0ede7', plinth: '#a9a39b', seed: 19 });
function aida11(P, W) {
  if (W.len < 14) {                                                      // the end walls: blank, the name on the Turu end
    P.r(0, P.y0, W.len, P.y1, '#e6e5e1'); P.weather(0, P.y0, W.len, P.y1, 0.3, 111);
    P.r(0, P.y0, W.len, 1.0, '#a4a29c');
    if (dot(W, [0.80, -0.60]) > 0.9) P.text('AIDA 11', W.len / 2, W.peak - 2.2, 1.1, '#3b4a5c', SANS);
    return;
  }
  flats(P, W, { wall: '#e6e5e1', plinth: '#a4a29c', seed: 11, doors: dot(W, [-0.60, -0.80]) > 0.9 });
}

// ---------------------------------------------------------------- Turu 21, Turu 16, the cooling plant
function turu21(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#eef0f0'); P.weather(0, P.y0, len, P.y1, 0.2, 21);
  P.r(0, P.y0, len, 0.4, '#8f9194');
  if (len < 8) return;
  const front = dot(W, TOWARD_TURU_SW) > 0.9;
  glassBand(P, 0.6, len - 0.6, 0.5, 3.4, '#7d93a2', '#3f5262', '#3a3f44', 1.8);   // the shop windows
  for (let y = 4.6; y + 2.2 < top - 0.6; y += 3.4) {                             // the dark window bands of the offices
    P.r(0.4, y, len - 0.4, y + 2.0, '#2e3740');
    for (let x = 0.4; x < len - 0.4; x += 1.35) P.r(x - 0.03, y, x + 0.03, y + 2.0, '#9ea6ad');
  }
  if (front && len > 30) {
    const x = len * 0.42;
    P.r(x - 2.2, 0.4, x + 2.2, 3.6, '#5d87a6'); P.r(x - 1.0, 0.4, x + 1.0, 2.5, '#2b3d4d');
    P.r(x - 2.8, 3.55, x + 2.8, 4.25, '#f8f8f6'); P.text('TURU 21', x, 3.9, 0.5, '#2b3d4d', SANS);
  }
}
function turu16(P, W) {
  P.r(0, P.y0, W.len, P.y1, '#b7babd'); P.weather(0, P.y0, W.len, P.y1, 0.45, 16);
  P.r(0, P.y0, W.len, 0.5, '#8d9093');
  if (W.len < 9) return;
  for (let x = 1.8; x < W.len - 2.5; x += 3.6) P.win(x, 1.1, x + 1.2, 2.4, { frame: '#e9e9e7', glass: '#4f5f6f', fw: 0.06, bars: 0, sill: 0.05 });
  if (W.len > 20) P.door(W.len * 0.5 - 0.6, W.len * 0.5 + 0.6, 2.1, '#56616c', { frame: '#e9e9e7', panels: 1 });
}
function kylm(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#e8e9e8');
  for (let x = 0; x < len; x += 1.0) P.r(x, P.y0, x + 0.03, top, '#cfd2d3');        // ribbed sheet
  P.r(0, P.y0, len, 0.5, '#8f9295');
  if (len > 30) for (let x = 3; x < len - 3; x += 5) P.r(x, top - 1.6, x + 3, top - 0.9, '#4b5864');   // high strip windows
  if (len > 10 && len < 16) {
    P.r(len / 2 - 2, 0.5, len / 2 + 2, 4.4, '#9aa0a6');                                   // a roller door on the ends
    for (let y = 0.7; y < 4.4; y += 0.25) P.r(len / 2 - 2, y, len / 2 + 2, y + 0.03, '#7f858b');
  }
}

// ---------------------------------------------------------------- Lidl
function lidlLogo(P, x, y, s) {
  P.r(x - s / 2, y - s / 2, x + s / 2, y + s / 2, '#0050aa');
  P.arc(x, y, s * 0.42, '#e60a14'); P.arc(x, y, s * 0.38, '#fff000');
  P.text('LIDL', x, y - s * 0.06, s * 0.3, '#0050aa', '900 %px Arial, sans-serif');
}
function lidl(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#d1d4d6');
  for (let x = 0; x < len; x += 3) P.r(x, P.y0, x + 0.04, top, '#b4b8bb');
  for (let y = 1.2; y < top; y += 1.2) P.r(0, y, len, y + 0.03, '#bfc3c6');
  P.r(0, top - 0.5, len, top, '#0050aa');                                 // the blue cornice
  P.r(0, P.y0, len, 0.3, '#7d8186');
  if (len < 20) return;
  if (dot(W, [-0.76, 0.65]) > 0.9) {                                      // the car park side: glass toward the south-east corner
    glassBand(P, len * 0.55, len - 0.4, 0.3, top - 0.8, '#8aa3b3', '#47606f', '#c8ccce', 1.6);
    P.r(len * 0.75 - 1.5, 0.3, len * 0.75 + 1.5, 2.6, '#2e3c48');
    lidlLogo(P, len * 0.3, top * 0.5, Math.min(3.2, top - 1.2));
  } else if (dot(W, [0.64, 0.77]) > 0.9) {
    lidlLogo(P, len * 0.5, top * 0.5, Math.min(3.2, top - 1.2));          // the logo to the south-east (the map's own sign faces Turu)
  }
}

// ---------------------------------------------------------------- Turu 27 and 27a
function turu27(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#e6e8e9');
  for (let x = 0; x < len; x += 2.4) P.r(x, P.y0, x + 0.04, top, '#c8cbcd');
  P.r(0, P.y0, len, 0.3, '#808387');
  if (len < 12) return;
  if (dot(W, TOWARD_TURU_SW) > 0.9 || dot(W, [-0.68, -0.73]) > 0.9) {    // the showroom fronts: glass under the panels
    glassBand(P, 0.5, len - 0.5, 0.3, Math.min(4.6, top - 1.6), '#8aa3b3', '#3e5462', '#2f3438', 2.0);
    P.r(len * 0.35, Math.min(4.6, top - 1.6) + 0.4, len * 0.35 + 5.5, Math.min(4.6, top - 1.6) + 1.5, '#1b2a3c');
    P.text('VOLVO', len * 0.35 + 2.75, Math.min(4.6, top - 1.6) + 0.95, 0.65, '#ffffff', SANS);
  } else {
    for (let x = 2; x < len - 2; x += 6) P.r(x, 1.0, x + 3.5, 3.6, '#5b6670');   // workshop doors and windows
  }
}
function turu27a(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#e9e1d0'); P.weather(0, P.y0, len, P.y1, 0.4, 27);
  P.r(0, P.y0, len, 0.7, '#8b7f70');
  if (len < 8) return;
  for (let y = 1.4; y + 1.4 < top - 0.7; y += 3.0) {
    for (let x = 1.5; x < len - 1.6; x += 3.0) {
      P.win(x, y, x + 1.1, y + 1.5, { frame: '#4a3427', glass: '#4d5a66', fw: 0.08, bars: 1, rails: 1, sill: 0.07 });
    }
  }
  for (let x = 0; x < len; x += 0.9) P.r(x, top - 0.9, x + 0.05, top - 0.2, '#5a4030');   // a timber band under the eaves
  P.r(0, top - 0.95, len, top - 0.85, '#5a4030');
  if (len > 25 && (dot(W, [0.54, 0.84]) > 0.9 || dot(W, TOWARD_TURU_SW) > 0.85)) {
    const x = len * 0.5;
    P.r(x - 3.2, 3.1, x + 3.2, 4.1, '#3a2a1f'); P.text('HANSA', x, 3.6, 0.6, '#e8c77a', '700 %px Georgia, serif');
    P.door(x - 0.8, x + 0.8, 2.4, '#4a3427', { frame: '#3a2a1f', panels: 2 });
  }
}

const PAINT = { turu15, turu17, turu19, aida11, turu21, turu16, kylm, lidl, turu27, turu27a };

export function createTuru5(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const houses = HOUSES.map(([name, S, base, at, r, , , pick]) => ({ name, sec: S[0], base, at, r, pick, spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { label: 'turu5 fronts', shadows, ppm: 10, far: 6, faces: (W) => W.len > 6 && W.foot < 2, debug: DEBUG });
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 400) return;
      if ([[2132, 3438], [2316, 3516], [2360, 3693], [2440, 3845]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
