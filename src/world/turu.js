// Turu tänav, batch 1: the Turu / Soola corner (Martin, 20 Nov: kaardista with his Street View screenshots of
// Aug 2024 and Jun 2023, and the Land Board's oblique air photos of Apr 2024).
//  - Turu 1, Swedbank: the glass corner on Turu and Soola with the orange band over the dark stone ground
//    floor and the orange letters on top, the dark cladding further along Soola, white render behind;
//  - Turu 3: the white five-storey block behind;
//  - Turu 5: pale render, terracotta window surrounds, red ends, the stair glazing, the low shop annex
//    in front (the sushi bar, Henna's canopy);
//  - Turu 7: orange render with white stair strips;
//  - Circle K (Turu 6): the dark shop with its red band, the canopy with its red fascia, the pumps, the
//    tall K by Soola, the flags along Turu;
//  - McDonald's (Turu 6a): brown slats under the dark top band, the tall M by Turu;
//  - the lime row on the Circle K side, the map's verge trees in front of Turu 5 and 7 turned back into
//    the birches and limes they are, a steel rail in the median between Riia and Soola.
// The map's own blocks keep their shapes and get painted walls. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const DEBUG = typeof location !== 'undefined' && /turudebug/.test(location.search);
const S6 = ['4_6', 1760, 3040];
// Turu's frame: s metres along the street to the south-east from the Soola junction, v + = the south-west
// side (Swedbank, Turu 5 and 7), v - = the Circle K side
export const TURU = frame([1920.3, 3176.0], [0.696, 0.718]);
const L = TURU.at;

// the Swedbank block shares its LOD base with Kvartal across Soola: only its own side
const pastSoola = (x, z) => (x - 1907) * 0.71 + (z - 3171) * 0.70 > 0;
// [name, sector, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['swed', S6, 69, [1900, 3214], 28, 0x9fb0be, 0x5d6066, pastSoola],
  ['turu3', S6, 119, [1895.5, 3257], 23, 0xecebe6, 0x6d7076, (x) => x < 1915],
  ['turu5', S6, -6, [1947, 3243], 26, 0xd9d4cb, 0x8a8d92],
  ['turu7', S6, 80, [1976, 3282], 36, 0xd9692f, 0x8a8d92],
  ['circlek', S6, 5, [1977, 3155], 18, 0x4a4c51, 0x6d7076],
  ['mcd', S6, 34, [2014, 3208], 22, 0x7a5238, 0x3a3b3f],
];

export function turuWalls(walls) {
  setHouseColours(walls, S6[0], S6[1], S6[2], [
    ...HOUSES.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })),
  ]);
  // the map's Circle K canopy, a flat black plate (the map takes it for a carport): built again with its fascia
  addHouseColours(walls, S6[0], S6[1], S6[2], [{ base: 555, x: 1965, z: 3165, hide: true, reach: 14 }, { base: 555, x: 1965, z: 3165, hide: true, shelter: true, reach: 14 }]);
}

const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const SANS = '700 %px Arial, sans-serif';

// a glass curtain wall: the sky in it, floor lines and mullions
function curtain(P, x0, x1, y0, y1, { top = '#a9bccb', bottom = '#5f7587', mull = '#3d434a', floor = 3.4, bay = 1.6 } = {}) {
  P.grad(x0, y0, x1, y1, top, bottom);
  for (let x = x0 + 2.5; x < x1 - 2; x += 7.3) P.grad(x, y0, x + 2.2, y1, 'rgba(235,240,245,0.35)', 'rgba(235,240,245,0.05)');
  for (let y = y0; y < y1 + 0.01; y += floor) P.r(x0, y - 0.07, x1, y + 0.07, mull);
  for (let x = x0; x <= x1 + 0.01; x += bay) P.r(x - 0.04, y0, x + 0.04, y1, mull);
}
function shopGlass(P, x0, x1, y0, y1, frameCol = '#2b2d31', tint = '#4f6272') {
  P.r(x0, y0, x1, y1, frameCol);
  P.grad(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, tint, '#2e3946');
  for (let x = x0 + 1.4; x < x1 - 0.3; x += 1.4) P.r(x - 0.04, y0, x + 0.04, y1, frameCol);
}
function swedLetters(P, x, y, s) {
  P.text('Swedbank', x, y, s, '#c45a28', '700 %px Georgia, serif');
  P.arc(x + s * 3.2, y + s * 0.1, s * 0.62, '#d9772f');
  P.arc(x + s * 3.2, y + s * 0.1, s * 0.48, '#e98b3c');
}

// ---------------------------------------------------------------- Turu 1, Swedbank
function swed(P, W) {
  const len = W.len, top = W.peak;
  if (W.foot > 12) { P.r(0, P.y0, len, P.y1, '#8f9398'); for (let x = 0.5; x < len; x += 0.6) P.r(x, P.y0, x + 0.05, P.y1, '#80848a'); return; }
  const turu = dot(W, [0.72, -0.69]) > 0.95, soola = dot(W, [-0.69, -0.72]) > 0.95 && len > 30;
  if (turu || soola) {
    // the glass corner: on Turu the whole face (x = 0 at the south-east end), on Soola the first 27 m
    const g0 = turu ? 1.3 : 0, g1 = turu ? len : 27;
    P.r(0, P.y0, len, 3.8, '#55575c');
    for (let x = 1.2; x < len; x += 1.2) P.r(x - 0.02, 0.4, x + 0.02, 3.8, '#4a4c51');
    if (turu) { P.r(0, P.y0, 1.3, top, '#6c6f74'); shopGlass(P, 2.5, len - 1.5, 0.2, 3.6); P.r(len * 0.42, 0, len * 0.42 + 2.4, 2.6, '#3a3d42'); for (const x of [len * 0.42 + 0.6, len * 0.42 + 1.8]) P.r(x - 0.5, 0.05, x + 0.5, 2.5, '#5e7383'); }
    else { shopGlass(P, 1.5, 6.5, 0.2, 3.6); P.r(7, 0, 10, 2.7, '#3a3d42'); P.r(7.2, 0.05, 9.8, 2.6, '#5e7383'); shopGlass(P, 10.5, g1 - 0.5, 0.2, 3.6); }
    P.r(g0, 3.8, g1, 4.15, '#ee7023');
    curtain(P, g0, g1, 4.15, top - 0.25);
    P.r(g0, top - 0.25, g1, top, '#3d434a');
    // the letters on top, and the small ones over the ground floor
    if (turu) { swedLetters(P, len * 0.45, top + 0.2 - 1.4, 1.15); swedLetters(P, len * 0.3, 3.1, 0.5); }
    else { swedLetters(P, 10, top + 0.2 - 1.4, 1.15); swedLetters(P, 15, 3.1, 0.5); }
    if (soola) {
      // past the glass: dark brown-grey cladding with rows of windows, a door to the yard
      P.r(g1, P.y0, len, top, '#4b4643');
      for (let x = g1 + 0.6; x < len; x += 0.9) P.r(x, 0.6, x + 0.03, top, '#433e3b');
      for (let y = 4.6; y < top - 2.4; y += 3.4) for (let x = g1 + 1.4; x < len - 1.2; x += 2.6) P.win(x, y, x + 1.5, y + 1.6, { frame: '#2c2a29', glass: '#5c6c7a', fw: 0.06, bars: 0, T: false, sill: 0, surround: 0 });
      shopGlass(P, g1 + 1, len - 2, 0.3, 3.2, '#2c2a29');
    }
    return;
  }
  // the back: white render, the dark grey end panel on the court side next to Turu
  P.r(0, P.y0, len, P.y1, '#ecebe7');
  P.weather(0, P.y0, len, P.y1, 0.6, 7);
  P.r(0, P.y0, len, 0.5, '#9a989e');
  const dark = dot(W, [0.69, 0.72]) > 0.95 && len > 20 ? [len - 7, len] : null;
  if (dark) P.r(dark[0], P.y0, dark[1], top, '#55585e');
  for (let y = 4.4; y < top - 2.2; y += 3.4) {
    for (let x = 1.4; x < len - 1.6; x += 2.4) {
      if (dark && x > dark[0] - 1) continue;
      P.win(x, y, x + 1.6, y + 1.7, { frame: '#d8d8d6', glass: '#5d6f80', fw: 0.06, bars: 1, T: false, sill: 0.05, surround: 0 });
    }
  }
  for (let x = 1.4; x < len - 1.6; x += 2.4) if (!dark || x < dark[0] - 1) P.win(x, 0.9, x + 1.6, 3.0, { frame: '#d8d8d6', glass: '#56677a', fw: 0.06, bars: 0, T: false, sill: 0.05, surround: 0 });
}

// ---------------------------------------------------------------- Turu 5
function turu5(P, W) {
  const len = W.len, top = W.peak, red = '#bd5539';
  if (len < 12) {                                              // the red ends
    P.r(0, P.y0, len, P.y1, red); P.weather(0, P.y0, len, P.y1, 0.5, 3);
    P.r(0, P.y0, len, 0.6, '#8d8a86');
    for (let y = 2.0; y < top - 2; y += 2.85) P.win(len / 2 - 0.5, y, len / 2 + 0.5, y + 1.2, { frame: '#efece4', glass: '#5a6878', fw: 0.06, bars: 0, T: false, surround: 0 });
    return;
  }
  P.r(0, P.y0, len, P.y1, '#d9d4cb'); P.weather(0, P.y0, len, P.y1, 0.5, 5);
  P.r(0, P.y0, len, 0.65, '#8d8a86');
  P.r(0, 0.65, 0.55, top, red); P.r(len - 0.55, 0.65, len, top, red);
  // the stair glazing, 11 m in from the north-west end on the Turu side
  const toTuru = dot(W, [0.85, -0.52]) > 0.9, sx = toTuru ? len - 11 : 11;
  P.r(sx - 0.75, 1.0, sx + 0.75, top - 0.6, '#a24b33');
  for (let y = 1.3; y < top - 0.9; y += 1.45) P.r(sx - 0.55, y, sx + 0.55, y + 1.3, '#6d7f8f');
  P.r(sx - 0.6, 0, sx + 0.6, 2.2, '#3c3a38');
  for (let k = 0; k < 4; k++) {
    const y = 1.35 + k * 2.85;
    if (y + 1.4 > top - 0.3) break;
    for (let x = 1.6; x < len - 1.2; x += 3.05) {
      if (Math.abs(x + 0.65 - sx) < 1.6) continue;
      if (toTuru && k === 0 && x > 14 && x < 28.5) continue;                 // the shop annex stands in front here
      P.win(x, y, x + 1.3, y + 1.4, { frame: '#f3f1ec', glass: '#5b6a7c', fw: 0.07, bars: 1, T: false, surround: 0.13, sc: '#a75b3f', sill: 0.07 });
    }
  }
}

// ---------------------------------------------------------------- Turu 7
function turu7(P, W) {
  const len = W.len, top = W.peak, orange = '#d8692f';
  P.r(0, P.y0, len, P.y1, orange); P.weather(0, P.y0, len, P.y1, 0.6, 9);
  P.r(0, P.y0, len, 0.6, '#7f7b77');
  if (len < 20) {                                              // the gable end
    for (let y = 1.4; y < top - 2.2; y += 2.9) P.win(len / 2 + 2, y, len / 2 + 3.2, y + 1.3, { frame: '#f2efe8', glass: '#55667a', fw: 0.07, bars: 0, T: false, surround: 0 });
    P.win(len / 2 - 0.5, top - 3.0, len / 2 + 0.5, top - 2.2, { frame: '#f2efe8', glass: '#55667a', fw: 0.07, bars: 0, T: false, surround: 0 });
    return;
  }
  const strips = [];
  for (let x = 6.5; x < len - 3; x += 12.2) strips.push(x);
  for (const x of strips) {
    P.r(x - 1.25, 0.6, x + 1.25, top - 0.3, '#eeece6');
    for (let y = 1.3; y < top - 1; y += 1.45) P.r(x - 0.35, y, x + 0.35, y + 1.25, '#64778a');
    P.r(x - 0.7, 0, x + 0.7, 2.3, '#3b3936');
    P.r(x - 1.0, 2.5, x + 1.0, 2.7, '#5d5f63');
  }
  for (let k = 0; k < 5; k++) {
    const y = 1.3 + k * 2.9;
    if (y + 1.35 > top - 0.4) break;
    for (let x = 1.3; x < len - 1.6; x += 2.95) {
      if (strips.some((s) => Math.abs(x + 0.7 - s) < 2.0)) continue;
      P.win(x, y, x + 1.4, y + 1.35, { frame: '#f2efe8', glass: '#56677b', fw: 0.07, bars: 1, T: false, surround: 0, sill: 0.08 });
    }
  }
}

// ---------------------------------------------------------------- Circle K
function circlek(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#4a4c51');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, 0, x + 0.04, top, '#42444a');
  if (dot(W, [-0.70, 0.71]) > 0.9 && len > 20) {                // the front, under the canopy
    P.r(0, top - 1.2, len, top, '#e3262e');
    P.r(0, top - 1.42, len, top - 1.2, '#f39200');
    P.text('CIRCLE K', len * 0.36, top - 0.6, 0.8, '#ffffff', SANS);
    P.arc(len * 0.62, top - 0.6, 0.48, '#ffffff'); P.text('K', len * 0.62, top - 0.6, 0.62, '#e3262e', SANS);
    shopGlass(P, 1.5, len - 1.5, 0.15, top - 1.7, '#2f3135', '#55697b');
    P.r(len * 0.5 - 1.1, 0, len * 0.5 + 1.1, 2.4, '#2f3135'); P.r(len * 0.5 - 1.0, 0.05, len * 0.5 + 1.0, 2.35, '#6f8597');
    for (const [x, c] of [[4, '#f39200'], [8, '#e3262e'], [20, '#2f5fa8'], [24, '#e3262e']]) if (x < len - 2) P.r(x, 0.6, x + 1.8, 2.0, c);
  } else {
    P.r(0, top - 0.45, len, top, '#e3262e');
    if (len > 20) { P.r(len * 0.3, 0, len * 0.3 + 1.1, 2.2, '#3a3c41'); P.r(len * 0.7, 0, len * 0.7 + 2.6, 2.8, '#5b5e64'); for (let y = 0.3; y < 2.8; y += 0.3) P.r(len * 0.7, y, len * 0.7 + 2.6, y + 0.04, '#4d5055'); }
  }
}

// ---------------------------------------------------------------- McDonald's
function mcd(P, W) {
  const len = W.len, top = W.peak;
  if (W.foot > 2) { P.r(0, P.y0, len, P.y1, '#3a3b3f'); return; }
  P.boards(0, P.y0, len, P.y1, [122, 82, 56], 0.11, true);
  P.r(0, top - 1.7, len, top, '#36373b');
  if (len > 20) {
    shopGlass(P, 1.5, len - 1.5, 0.1, Math.min(3.0, top - 2.4), '#2b2c30', '#5a6a77');
    P.r(len * 0.25 - 1.0, top - 1.55, len * 0.25 + 1.0, top - 0.15, '#da291c');
    P.text('M', len * 0.25, top - 0.85, 1.3, '#ffc72c', '900 %px Arial, sans-serif');
    P.text("McDonald's", len * 0.58, top - 0.85, 0.9, '#ffffff', SANS);
  } else {
    shopGlass(P, 1.2, len - 1.2, 0.1, 2.4, '#2b2c30', '#5a6a77');
    P.text('M', len / 2, top - 0.85, 1.2, '#ffc72c', '900 %px Arial, sans-serif');
  }
}

const PAINT = { swed, turu5, turu7, circlek, mcd };

// the verge trees on the south-west side: the map had most as spruces; they are birches and limes.
// [x, z, height, crown, type]
const VERGE = [
  [1945.5, 3224.5, 18.7, 6.0, 0], [1953.6, 3233.2, 12.1, 7.4, 0], [1958.0, 3238.2, 10.9, 5.2, 0], [1960.2, 3245.9, 9.7, 4.9, 0],
  [1964.0, 3242.5, 9.2, 6.4, 0], [1999.8, 3280.2, 18.7, 9.2, 0], [2005.6, 3287.6, 22.1, 9.1, 0],
];
// the young limes along the Circle K side, in the paving between the road and the cycle path
const LIMES = [];
for (let s = 14; s <= 99; s += 8.4) LIMES.push([...L(s, -13.8), 8.2 + ((s * 7) % 3) * 0.5, 4.4, 0]);
const inVerge = (x, z) => { const [s, v] = TURU.sv(x, z); return s > 15 && s < 150 && v > 9.5 && v < 33; };

export const TURU_CARS = [
  [1999.5, 3196.5, Math.atan2(0.71, -0.71), 'passat', 'silver', 0.03],
  [2003.4, 3192.6, Math.atan2(0.71, -0.71), 'rav4', 'white', 0.03],
  [2011.2, 3184.8, Math.atan2(0.71, -0.71), 'mazda6', 'grey', 0.03],
  [1966.2, 3163.6, Math.atan2(0.72, 0.70), 'model3', 'white', 0.03],
  [1961.0, 3156.0, Math.atan2(-0.72, -0.70), 'f31', 'black', 0.03],
];

// a canopy's fascia: a band round four corners, painted by `tex`
function fascia(group, gy, corners, y0, y1, tex, shadows) {
  const m = new THREE.MeshLambertMaterial({ map: tex });
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, y1 - y0, 0.3), m);
    mesh.position.set((a[0] + b[0]) / 2, gy + (y0 + y1) / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    mesh.castShadow = shadows;
    group.add(mesh);
  }
}

export function createTuru(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addClearing({ test: inVerge });
  world.addTrees([...VERGE, ...LIMES]);
  let built = false;
  const CENTRE = L(55, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const faces = (W) => W.foot < 2 && W.len > 8;
    const houses = HOUSES.map(([name, S, base, at, r, , , pick]) => {
      const H = { name, sec: S[0], base, at, r, pick, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false } };
      if (PAINT[name]) H.walls = [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }];
      else H.spec = { kind: 'plaster', wall: [236, 235, 230], trim: '#f4f2ec', storey: 2.9, maxFloors: 5, win: { w: 1.3, pitch: 3.0, T: false, bars: 1, surround: 0, frame: '#f2f1ee', glass: '#5b6a7c' }, attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8f8d8a' }, weather: 0.4 };
      return H;
    });
    skinHouses(world, group, houses, { label: 'turu fronts', shadows, ppm: 14, far: 6, faces, debug: DEBUG });

    // ---- Circle K: the canopy (white roof, red fascia), its posts, the pumps, the tall K by Soola, flags
    const C = [[1964.4, 3177.3], [1977.5, 3163.8], [1965.8, 3152.4], [1952.6, 3165.9]];
    const cg = Math.min(...C.map((q) => h(q[0], q[1])));
    const ck = paintTexture(19, 0, 1.0, 24, (P) => { P.r(0, 0, 19, 1.0, '#e3262e'); P.r(0, 0, 19, 0.16, '#f39200'); P.text('CIRCLE K', 9.5, 0.56, 0.62, '#ffffff', SANS); });
    fascia(group, cg, C, 4.9, 5.9, ck, shadows);
    const CF = frame(C[3], [C[0][0] - C[3][0], C[0][1] - C[3][1]]);       // s along the Turu side, v - toward the shop
    const [cx, cz] = CF.at(8.2, -9.45);
    p.box(16.4, 0.18, 18.9, 0xe8e8e6, cx, cg + 5.85, cz, CF.YAW);
    p.box(16.0, 0.05, 18.5, 0xd2d3d5, cx, cg + 4.92, cz, CF.YAW);
    for (const [s, v] of [[3, -4.5], [13.4, -4.5], [3, -14.4], [13.4, -14.4]]) A.box(CF, s, v, 0.45, 0.45, -0.05, 4.95, 0xdedfe1, cg);
    for (const v of [-6.3, -12.6]) {
      A.box(CF, 8.2, v, 9.0, 1.1, -0.05, 0.22, 0xb9bbbd, cg);
      for (const s of [5.2, 11.2]) { A.box(CF, s, v, 0.9, 0.6, 0.2, 1.95, 0xe9e9e7, cg); A.box(CF, s, v, 0.92, 0.62, 1.95, 2.3, 0xe3262e, cg); }
    }
    const tall = (x, z, w, hh, d, tex, yaw) => {
      const dark = new THREE.MeshLambertMaterial({ color: 0x2b2c30 }), t = new THREE.MeshLambertMaterial({ map: tex });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), [dark, dark, dark, dark, t, t]);
      m.position.set(x, h(x, z) + hh / 2, z); m.rotation.y = yaw; m.castShadow = shadows; group.add(m);
    };
    tall(1953.5, 3151.5, 1.7, 9, 0.5, paintTexture(1.7, 0, 9, 24, (P) => {
      P.r(0, 0, 1.7, 9, '#e3262e'); P.r(0, 0, 1.7, 2.0, '#2b2c30'); P.arc(0.85, 7.8, 0.64, '#ffffff'); P.text('K', 0.85, 7.8, 0.82, '#e3262e', SANS);
      [['95', '1.759'], ['98', '1.820'], ['D', '2.026'], ['AUTOPESU', '']].forEach(([a, b], k) => { P.r(0.1, 5.9 - k * 1.05, 1.6, 6.7 - k * 1.05, '#1d1e21'); P.text(b ? a + ' ' + b : a, 0.85, 6.3 - k * 1.05, b ? 0.42 : 0.3, '#ffd23f', SANS); });
    }), Math.atan2(-0.94, 0.33));                                             // the prices face the junction
    const pole = new THREE.CylinderGeometry(0.05, 0.07, 8, 6), flag = new THREE.BoxGeometry(0.03, 2.4, 0.9);
    for (let s = 34; s <= 64; s += 6) {
      const [x, z] = L(s, -21.6);
      p.add(pole, 0xf0f0ee, x, h(x, z) + 4, z);
      p.add(flag, s % 12 < 6 ? 0xe3262e : 0xf39200, x + TURU.U[0] * 0.5, h(x, z) + 6.6, z + TURU.U[1] * 0.5, TURU.YAW);
    }

    // ---- McDonald's: the tall M by Turu, the clipped thujas along the terrace
    tall(2003.6, 3227.5, 2.0, 11, 0.45, paintTexture(2.0, 0, 11, 22, (P) => {
      P.r(0, 0, 2.0, 11, '#55585c'); P.r(0, 7.6, 2.0, 11, '#da291c'); P.text('M', 1.0, 9.3, 2.4, '#ffc72c', '900 %px Arial, sans-serif');
      P.r(0.1, 6.3, 1.9, 7.4, '#2b2c30'); P.text('McDrive', 1.0, 6.85, 0.42, '#ffffff', SANS);
    }), TURU.YAW);
    const thuja = [];
    for (let k = 0; k < 7; k++) { const [x, z] = L(97 + k * 1.6, -26.5); thuja.push([x, z, 0.9, 2.2, [0.42, 0.62, 0.45]]); }
    A.bushes(thuja);

    // ---- Turu 5: the low shop annex on the Turu side and Henna's canopy
    const T5 = frame([1957.9, 3256.9], [1936.8 - 1957.9, 3222.4 - 3256.9]);   // s from the south-east end, v + out to Turu
    const g5 = h(...T5.at(20, 2));
    A.box(T5, 21.5, 2.2, 13, 4.4, -0.3, 3.3, 0xc9c3b8, g5);
    A.box(T5, 21.5, 2.2, 13.4, 4.8, 3.3, 3.55, 0x6f6c69, g5);
    const annex = paintTexture(13, 0, 3.3, 22, (P) => {
      P.r(0, 0, 13, 3.3, '#c9c3b8');
      for (const x0 of [0.8, 5.2, 9.6]) { P.r(x0, 0.6, x0 + 2.8, 2.6, '#2f3134'); P.grad(x0 + 0.08, 0.68, x0 + 2.72, 2.52, '#73879a', '#3d4b58'); }
      P.r(4.0, 0, 5.0, 2.3, '#3a3a3c');
      P.r(3.2, 2.75, 7.6, 3.2, '#c4502a'); P.text('USABI', 5.4, 2.97, 0.36, '#ffffff', SANS);
    });
    {
      const [x, z] = T5.at(21.5, 4.43);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.3), new THREE.MeshLambertMaterial({ map: annex }));
      m.position.set(x, g5 + 1.65, z); m.rotation.y = Math.atan2(T5.V[0], T5.V[1]); group.add(m);
    }
    A.box(T5, 34.0, 1.2, 4.2, 2.4, 2.75, 2.9, 0x8e9196, g5);                      // Henna's canopy by the north-west end
    for (const ds of [-1.6, 1.6]) A.box(T5, 34.0 + ds, 2.4, 0.1, 0.1, 0.0, 2.3, 0xa0322a, g5);         // the red arch at the door
    A.box(T5, 34.0, 2.4, 3.3, 0.1, 2.25, 2.4, 0xa0322a, g5);

    // ---- the steel rail between the carriageways, Riia junction to Soola
    A.guardrail([[1852.0, 3105.5], [1873.5, 3127.3], [1894.0, 3148.9]]);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(0, 0), L(100, -30), L(120, 30), [1897, 3212]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
