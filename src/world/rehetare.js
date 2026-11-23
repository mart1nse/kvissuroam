// Kaardista "Rehepapi tee, Soinaste" (Martin, 23 Nov 2026), batch 1: Rehetare tee 1 and what stands round it,
// from his Street View shots along Rehepapi tee (Aug 2024) and the Land Board's orthophoto.
//  - Rehetare tee 1: the white four-storey block of flats on the corner of Rehetare tee, built here by hand (the
//    map's block was a red brick box): white render, the low red roof with its dark red boarded gables and brick
//    chimneys, on the car park side (north) the four white porches with dark flat roofs, the stair windows and
//    the French windows with black rails; on the garden side (south) the stacks of black steel balconies on
//    posts; the paved car park and the cars on it, the globe lamps, the grey cabinet at the west gable;
//  - the fenced garden to the south: green mesh fence, the row of thujas on the lot line, two swings and a
//    climbing frame with a slide, benches;
//  - across Rehepapi tee: the blue hall at 37, the long hall at 35 (grey hall, glass, orange-brown wood), and
//    Miridon at 31 (blue, the big white name, the orange office of Veelabor, flags and the pylon sign).
// Guessed: the block's east gable and the halls' backs (not in the shots), the balconies' exact count, the
// window rhythm of the halls' far sides. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame, cellKit } from './handbuilt.js';
import { canvasTex } from './arhitekti.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /rehedebug/.test(location.search);
const S213 = ['2_13', 480, 7520], S113 = ['1_13', -160, 7520];
const CENTRE = [560, 7880];

// the block's frame: s along the north wall from the north-west corner, v towards the garden (south)
const B = frame([591.1, 7937.0], [0.919, -0.393]);
const LEN = 61.8, DEP = 14.1, EAV = 14.2, RISE = 2.4;
const SEC = LEN / 4;                                 // four stairs, one porch each
const FLOORS = [0.9, 4.1, 7.3, 10.5];

// the halls across Rehepapi tee: [name, sector, base, at, reach, wall, roof]
const HALLS = [
  ['h37', S213, 2819, [527, 7966], 26, 0x2a56b4, 0x6d7076],
  ['h35', S213, 2829, [482, 7890], 48, 0xc3c6c9, 0x5f6266],
  ['h31', S113, 2882, [438, 7757], 24, 0x2556b2, 0x9fa2a6],
];

export function rehetareWalls(walls) {
  setHouseColours(walls, S213[0], S213[1], S213[2], [
    { base: 2721, x: 619.8, z: 7926.4, hide: true, reach: 40 },                         // Rehetare tee 1: built here
    ...HALLS.filter((H) => H[1] === S213).map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })),
  ]);
  setHouseColours(walls, S113[0], S113[1], S113[2], HALLS.filter((H) => H[1] === S113).map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
}

// cars on the block's car park: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw))
const NOSE_N = Math.atan2(-0.393, 0.919), NOSE_S = Math.atan2(0.393, -0.919), NOSE_W = Math.atan2(-0.919, -0.393);
const at = (s, v) => B.at(s, v);
export const REHETARE_CARS = [
  ...[[3, 'passat', 'black'], [5.7, 'mazda6', 'silver'], [11, 'rav4', 'white'], [13.7, 'accord', 'silver'], [19, 'passat', 'grey'],
    [27, 'model3', 'black'], [29.7, 'mazda6', 'white'], [35, 'rav4', 'grey'], [43, 'passat', 'silver'], [48.3, 'f31', 'black']]
    .map(([s, id, paint], k) => [...at(s, -13.2), k % 3 ? NOSE_N : NOSE_S, id, paint, 0.03]),
  [...at(-6.5, 6), NOSE_W, 'rav4', 'white', 0.03],
  [...at(-6.5, 11.5), NOSE_W, 'passat', 'black', 0.03],
  [...at(-6.5, -3), NOSE_W, 'mazda6', 'grey', 0.03],
];

// ---------------------------------------------------------------- the hall painters
const WHITEWIN = { frame: '#f2f2ee', glass: '#4d5b6a', fw: 0.07, bars: 1, T: false, sill: 0.05, surround: 0 };
const DARKWIN = { frame: '#2b2c30', glass: '#3e4a57', fw: 0.06, bars: 1, T: false, sill: 0.04, surround: 0 };
const dot = (W, n) => W.nx * n[0] + W.nz * n[1];
const ribs = (P, W, rgb, top = P.y1) => { P.boards(0, P.y0, W.len, top, rgb, 0.3, true); };

// 37: blue profiled sheet, the grey band, roller doors to Rehetare tee, white windows of the office end
function h37(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, W, [42, 86, 180]);
  P.r(0, P.y0, len, 0.3, '#6b6e73');
  if (dot(W, [-0.16, -0.99]) > 0.9 && len > 15) {                 // the north end, to Rehetare tee
    P.boards(0, 0.3, len * 0.32, top, [170, 174, 178], 0.3, true);
    P.r(len * 0.4, 0, len * 0.4 + 4.2, 4.4, '#55585e');
    for (let y = 0.3; y < 4.4; y += 0.3) P.r(len * 0.4, y, len * 0.4 + 4.2, y + 0.04, '#46494e');
    P.door(len * 0.72, len * 0.72 + 1.0, 2.1, '#d9dbde', { frame: '#f2f2ee', light: 0, panels: 1 });
    for (const x of [len * 0.08, len * 0.2]) P.win(x, 4.8, x + 1.4, 5.9, WHITEWIN);
    P.win(len * 0.8, 4.8, len * 0.8 + 1.4, 5.9, WHITEWIN);
  } else if (dot(W, [0.99, -0.16]) > 0.9 && len > 20) {           // the side to the road
    for (let x = len - 2.5; x > len * 0.55; x -= 2.6) { P.win(x - 1.4, 1.0, x, 2.1, WHITEWIN); P.win(x - 1.4, 4.0, x, 5.1, WHITEWIN); }
    P.r(len * 0.3, 0, len * 0.3 + 3.8, 4.2, '#55585e');
    for (let y = 0.3; y < 4.2; y += 0.3) P.r(len * 0.3, y, len * 0.3 + 3.8, y + 0.04, '#46494e');
    P.boards(len * 0.88, 0.3, len, top, [170, 174, 178], 0.3, true);
  }
}
// 35: from the south end, the open timber shed, the light grey hall, then (stepped out to the road) the glass
// and the long orange-brown wood office
const WOOD = [190, 130, 64];
function glass(P, x0, x1, top) {
  P.r(x0, 0, x1, top - 0.3, '#2a2d31');
  for (let x = x0 + 0.1; x < x1 - 0.1; x += 1.6) for (let y = 0.1; y < top - 0.5; y += 1.7) P.grad(x, y, Math.min(x1 - 0.1, x + 1.5), Math.min(top - 0.4, y + 1.6), '#5d6f80', '#34404c');
}
function wood(P, x0, x1, top, seed) {
  P.boards(x0, 0, x1, top, WOOD, 0.16, true);
  P.weather(x0, 0, x1, top, 0.25, seed);
  for (let x = x0 + 1.5; x + 0.9 < x1 - 0.8; x += 3.4) { P.win(x, 1.0, x + 0.9, 2.3, DARKWIN); P.win(x, 4.0, x + 0.9, 5.3, DARKWIN); }
}
function h35(P, W) {
  const len = W.len, top = W.peak, road = dot(W, [0.91, -0.41]) > 0.9;
  P.boards(0, P.y0, len, top, [196, 199, 202], 0.25);
  P.r(0, P.y0, len, 0.3, '#7b7e82');
  if (road && len > 60) {                                              // the back plane: 0 at the south end
    P.boards(0, 0, 4, top, [104, 82, 62], 0.18, true);                                   // the timber shed's slats
    P.r(0, 2.2, 4, 2.4, '#4a3b2d');
    for (let x = 5.2; x < 21; x += 2.1) P.win(x, top - 1.7, x + 0.9, top - 0.7, DARKWIN);   // the high windows
    P.win(9.5, 3.2, 12.2, 4.6, DARKWIN); P.win(16.5, 3.2, 19.2, 4.6, DARKWIN);
    P.r(13.5, 3.4, 15.5, 4.2, '#e3dcc6');                                                // the sign board
    P.door(5.2, 6.2, 2.1, '#6e5444', { frame: '#3a3b3f', light: 0, panels: 1 });
    glass(P, 21.5, 26, top);
    wood(P, 66, len, top, 33);
  } else if (road && len > 30) {                                       // the part stepped out to the road
    glass(P, 0, 7, top);
    P.r(3.2, 0, 4.8, 2.3, '#2a2d31'); P.grad(3.3, 0.05, 4.7, 2.25, '#8d9aa5', '#59656f');
    wood(P, 7, len, top, 31);
    for (const x of [16, 29]) P.r(x, 2.6, x + 0.8, 3.2, '#e8e8e6');                       // the outdoor units
    P.door(19.6, 20.6, 2.2, '#3a3b3f', { frame: '#2b2c30', light: 0.4, panels: 1 });
  } else if (dot(W, [0.41, 0.91]) > 0.9 && len < 8) glass(P, 0, len, top);              // the step's south side
  else if (dot(W, [-0.41, -0.91]) > 0.9 && len < 8) wood(P, 0, len, top, 35);
  else if (len > 8) for (let x = 2; x + 1.3 < len - 1; x += 4) P.win(x, top - 1.6, x + 1.0, top - 0.7, DARKWIN);
}
// 31: Miridon. Blue sheet, the orange fascia and the band of windows under it, the big white name on the road
// side, the glass and the orange office of Veelabor at the north end
function h31(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, W, [37, 86, 178]);
  P.r(0, P.y0, len, 0.3, '#6b6e73');
  P.r(0, top - 0.7, len, top, '#e2672a');
  for (let x = 0.6; x + 1.0 < len - 0.4; x += 1.25) P.grad(x, top - 1.7, x + 1.0, top - 0.95, '#6d7f90', '#3c4855');
  if (dot(W, [0.94, -0.33]) > 0.9 && len > 30) {                  // the road side: 0 at the south end
    P.text('MIRIDON', len * 0.36, 3.4, 4.0, '#f4f4f2', '700 %px Arial, sans-serif');
    P.r(len * 0.62, 0, len * 0.72, top - 1.9, '#2a2d31');
    for (let x = len * 0.62 + 0.1; x < len * 0.72 - 0.2; x += 1.3) for (let y = 0.1; y < top - 2.1; y += 1.5) P.grad(x, y, x + 1.2, y + 1.4, '#6d7f90', '#3c4855');
    P.r(len * 0.72, 0, len, top - 0.7, '#e2672a');
    for (let x = len * 0.72 + 0.8; x + 1.1 < len - 0.4; x += 2.2) { P.win(x, 1.0, x + 1.1, 2.4, DARKWIN); P.win(x, 4.2, x + 1.1, 5.6, DARKWIN); }
    P.text('VEELABOR', len * 0.86, top - 1.3, 0.55, '#f4f4f2', '700 %px Arial, sans-serif');
    P.r(len * 0.18, 0, len * 0.18 + 1.0, 2.2, '#2a2d31');
  } else if (len > 15) {
    P.r(len * 0.4, 0, len * 0.4 + 4, 4.2, '#5b5e63');
    for (let y = 0.3; y < 4.2; y += 0.3) P.r(len * 0.4, y, len * 0.4 + 4, y + 0.04, '#4a4d52');
  }
}
const PAINT = { h37, h35, h31 };

// ---------------------------------------------------------------- the block's walls
const WHITE = '#f1f0eb';
const BWIN = { frame: '#f4f4f1', glass: '#56667a', fw: 0.06, bars: 1, T: false, sill: 0.05, surround: 0 };
function render(P, w, top, seed) {
  P.r(0, -0.6, w, top, WHITE);
  P.weather(0, -0.6, w, top, 0.14, seed);
  P.r(0, -0.6, w, 0.55, '#a7a7a5');                                                     // the plinth
  P.r(0, top - 0.18, w, top, '#e3e2dc');
}
// a French window with its black rail
function french(P, x, y) {
  P.win(x, y, x + 1.0, y + 2.25, { ...BWIN, bars: 1, sill: 0 });
  P.r(x - 0.1, y + 0.95, x + 1.1, y + 1.0, '#1e1f22');
  for (let k = 0; k <= 8; k++) P.r(x - 0.1 + k * 0.15, y, x - 0.07 + k * 0.15, y + 0.97, '#1e1f22');
  P.r(x - 0.1, y, x + 1.1, y + 0.04, '#1e1f22');
}
// one stair's stretch of the north wall: the stair windows over the porch, kitchens and French windows either side
function northBay(P, w) {
  render(P, w, EAV, 11);
  const c = w / 2;
  for (const y of FLOORS.slice(1)) P.win(c - 0.6, y - 1.0, c + 0.6, y + 0.3, { ...BWIN, bars: 0 });   // the landings
  for (const y of FLOORS) for (const sgn of [-1, 1]) {
    P.win(c + sgn * 2.7 - 0.35, y + 1.0, c + sgn * 2.7 + 0.35, y + 2.1, { ...BWIN, bars: 0 });
    french(P, c + sgn * 4.4 - 0.5, y);
    P.win(c + sgn * 6.5 - 0.65, y + 0.75, c + sgn * 6.5 + 0.65, y + 2.15, BWIN);
  }
  P.r(0.05, -0.3, 0.17, EAV - 0.2, '#26272b');                                           // the downpipe
}
// one stair's stretch of the south wall, behind two balcony stacks
function southBay(P, w) {
  render(P, w, EAV, 23);
  const c = w / 2;
  for (const y of FLOORS) {
    for (const sgn of [-1, 1]) {
      const b = c + sgn * 3.9;
      P.win(b - 1.5, y, b - 0.6, y + 2.25, { ...BWIN, bars: 0, sill: 0 });                // the balcony door
      P.win(b - 0.3, y + 0.75, b + 1.4, y + 2.15, BWIN);
      P.win(c + sgn * 7.0 - 0.45, y + 1.0, c + sgn * 7.0 + 0.45, y + 2.1, { ...BWIN, bars: 0 });
    }
    P.win(c - 0.6, y + 0.75, c + 0.6, y + 2.15, BWIN);
  }
}
function gable(P, w, sign) {
  render(P, w, EAV, sign ? 37 : 41);
  P.r(w - 0.17, -0.3, w - 0.05, EAV - 0.2, '#26272b');
  if (sign) { P.r(w * 0.62, 2.7, w * 0.62 + 0.7, 3.0, '#2a5ca8'); P.r(w * 0.62 + 0.03, 2.73, w * 0.62 + 0.67, 2.97, '#3b6fbd'); }
}
function triangle(P, w) {
  P.boards(0, 0, w, RISE + 0.2, [118, 44, 40], 0.13, true);
  P.r(w / 2 - 0.35, RISE * 0.35, w / 2 + 0.35, RISE * 0.35 + 0.45, '#3a2422');               // the vent
}
function porchFront(P, w) {
  P.r(0, -0.6, w, 3.1, WHITE); P.weather(0, -0.6, w, 3.1, 0.12, 5); P.r(0, -0.6, w, 0.3, '#a7a7a5');
  P.r(w / 2 - 0.6, 0.15, w / 2 + 0.6, 2.35, '#e9e8e3');
  P.r(w / 2 - 0.5, 0.15, w / 2 + 0.5, 2.25, '#2f2b29');                                  // the door
  P.grad(w / 2 - 0.36, 1.2, w / 2 + 0.36, 2.1, '#5f6c78', '#38424c');
  P.r(w / 2 + 0.28, 1.0, w / 2 + 0.36, 1.06, '#c9c9c9');
  P.r(w / 2 - 0.25, 2.5, w / 2 + 0.25, 2.8, '#d8d8d4');                                   // the number light
}
function porchSide(P, w) {
  P.r(0, -0.6, w, 3.1, WHITE); P.r(0, -0.6, w, 0.3, '#a7a7a5');
  P.win(w / 2 - 0.3, 1.3, w / 2 + 0.3, 2.3, { ...BWIN, bars: 0 });
}

// the black railings on the balconies: a picture of bars with nothing between them
function railTex() {
  return canvasTex(64, 64, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#1b1c1f';
    for (let x = 1; x < w; x += 8) g.fillRect(x, 0, 2, w);
    g.fillRect(0, 0, w, 5); g.fillRect(0, w - 4, w, 4);
  });
}

// ---------------------------------------------------------------- the build
export function createRehetare(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  // the garden and the car park: the map's trees there were the thujas and the shadows of the cars
  const yard = [[1, 16], [-1.5, 44], [64, 26.6], [61.8, 14.1]];
  const inYard = (s, v) => { let c = false; for (let i = 0, j = yard.length - 1; i < yard.length; j = i++) { const [si, vi] = yard[i], [sj, vj] = yard[j]; if ((vi > v) !== (vj > v) && s < (sj - si) * (v - vi) / (vj - vi) + si) c = !c; } return c; };
  world.addClearing({ test(x, z) { const [s, v] = B.sv(x, z); return (s > -11 && s < 64 && v > -17 && v < 15) || inYard(s, v); } });

  function* build() {
    const halls = HALLS.map(([name, S, base, hat, r]) => ({ name, sec: S[0], base, at: hat, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    // (the sides to the road at the track's 18 pixels a metre, the backs from afar only)
    skinHouses(world, group, halls, { label: 'rehepapi halls', shadows, ppm: 16, far: 5, faces: (W) => W.len > 6 && (W.nx > 0.6 || W.nz < -0.9), debug: DEBUG });
    yield;

    const A = areaKit(world, group, { shadows, fenceColour: 0x3a5f40 });
    const { p, h } = A;
    const corners = [[0, 0], [LEN, 0], [LEN, DEP], [0, DEP]].map(([s, v]) => h(...B.at(s, v)));
    const g = Math.min(...corners) - 0.05;

    // ---- the walls: one picture per kind of bay, hung along the block
    const C = cellKit(group, { shadows, size: 1024 });
    C.cell('north', SEC, -0.6, EAV, WHITE, northBay, 22);
    C.cell('south', SEC, -0.6, EAV, WHITE, southBay, 22);
    yield;
    C.cell('west', DEP, -0.6, EAV, WHITE, (P, w) => gable(P, w, true), 18);
    C.cell('east', DEP, -0.6, EAV, WHITE, (P, w) => gable(P, w, false), 18);
    C.cell('tri', DEP + 0.8, 0, RISE + 0.2, '#762c28', triangle, 18);
    C.cell('pf', 3.7, -0.6, 3.1, WHITE, porchFront, 30);
    C.cell('ps', 3.2, -0.6, 3.1, WHITE, porchSide, 30);
    yield;
    for (let k = 0; k < 4; k++) {
      C.put(B.at(LEN - k * SEC, 0), B.at(LEN - (k + 1) * SEC, 0), g, 'north');            // (outside on the right going a -> b)
      C.put(B.at(k * SEC, DEP), B.at((k + 1) * SEC, DEP), g, 'south');
    }
    C.put(B.at(0, 0), B.at(0, DEP), g, 'west');
    C.put(B.at(LEN, DEP), B.at(LEN, 0), g, 'east');
    const tri = [[0, 0], [DEP + 0.8, 0], [(DEP + 0.8) / 2, RISE + 0.2]];
    C.put(B.at(0, -0.4), B.at(0, DEP + 0.4), g + EAV - 0.05, 'tri', tri);
    C.put(B.at(LEN, DEP + 0.4), B.at(LEN, -0.4), g + EAV - 0.05, 'tri', tri);
    // the porches, at the middle of each stair's stretch
    for (let k = 0; k < 4; k++) {
      const c = (k + 0.5) * SEC;
      C.put(B.at(c + 1.85, -3.2), B.at(c - 1.85, -3.2), g, 'pf');
      C.put(B.at(c - 1.85, -3.2), B.at(c - 1.85, 0), g, 'ps');
      C.put(B.at(c + 1.85, 0), B.at(c + 1.85, -3.2), g, 'ps');
      A.box(B, c, -1.6, 4.3, 3.8, 3.1, 3.38, 0x2d2f33, g);                                  // the flat roof
      A.box(B, c, -3.9, 2.2, 1.2, -0.3, 0.16, 0xb9b7b2, g);                                 // the step
    }
    C.finish();
    yield;

    // ---- the roof: two red slopes over the walls, the ridge, the chimneys
    {
      const tan = RISE / (DEP / 2), tilt = Math.atan(tan), half = DEP / 2 + 0.5, mid = half / 2 - 0.5;
      for (const side of [-1, 1]) {
        const geo = new THREE.BoxGeometry(LEN + 0.8, 0.2, half / Math.cos(tilt)).rotateX(side * tilt);
        const [x, z] = B.at(LEN / 2, DEP / 2 + side * (DEP / 2 - mid));
        p.add(geo, 0x82302a, x, g + EAV + mid * tan + 0.1, z, B.YAW);
        A.box(B, LEN / 2, DEP / 2 + side * (DEP / 2 + 0.45), LEN + 0.8, 0.12, EAV - 0.3, EAV + 0.02, 0x3a2422, g);   // the fascia
      }
      A.box(B, LEN / 2, DEP / 2, LEN + 0.8, 0.35, EAV + RISE - 0.05, EAV + RISE + 0.12, 0x7f2d27, g);              // the ridge
      for (const [s, v] of [[2.2, 6.2], [16.1, 4.8], [31.3, 4.8], [46.1, 4.8]]) {
        A.box(B, s, v, 1.1, 1.3, EAV, EAV + RISE + 1.1, 0x8c3b30, g);
        A.box(B, s, v, 1.3, 1.5, EAV + RISE + 1.1, EAV + RISE + 1.22, 0x3b3c40, g);
      }
    }
    yield;

    // ---- the balconies to the garden: two stacks a stair, black posts and slabs, railings of bars
    const rail = { pos: [], uv: [] };
    const quad = (a, b, y0, y1) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = len / 0.5;
      const V = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], u, 0], [b[0], y1, b[1], u, 1], [a[0], y1, a[1], 0, 1]];
      for (const q of [0, 1, 2, 0, 2, 3]) { rail.pos.push(V[q][0], V[q][1], V[q][2]); rail.uv.push(V[q][3], V[q][4]); }
    };
    for (let k = 0; k < 4; k++) for (const sgn of [-1, 1]) {
      const c = (k + 0.5) * SEC + sgn * 3.9, w = 3.4, d = 1.55, v1 = DEP + d;
      for (const e of [-w / 2, w / 2]) A.box(B, c + e, v1 - 0.05, 0.09, 0.09, -0.2, FLOORS[3] + 1.15, 0x1e1f22, g);
      for (const y of FLOORS) {
        A.box(B, c, DEP + d / 2, w + 0.1, d, y - 0.16, y, 0x3c3e43, g);
        A.box(B, c, v1 - 0.03, w + 0.1, 0.06, y + 1.0, y + 1.06, 0x1e1f22, g);
        quad(B.at(c - w / 2, v1), B.at(c + w / 2, v1), g + y, g + y + 1.02);
        quad(B.at(c - w / 2, DEP), B.at(c - w / 2, v1), g + y, g + y + 1.02);
        quad(B.at(c + w / 2, v1), B.at(c + w / 2, DEP), g + y, g + y + 1.02);
        if ((k * 2 + (sgn > 0) + y) % 3 < 1) A.box(B, c, v1 - 0.08, w - 0.2, 0.04, y + 0.05, y + 0.95, 0x8a6a4a, g);   // a few have boards
      }
    }
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(rail.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(rail.uv, 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: railTex(), alphaTest: 0.5, side: THREE.DoubleSide }));
      m.castShadow = shadows;
      group.add(m);
    }
    yield;

    // ---- the ground: the paved car park round the north and west, the gravel lot to the east
    A.pave(B, 0, LEN + 2, -16.5, -3.2, 'pavers', 0.06);
    A.pave(B, 0, LEN + 2, -3.2, 0, 'pavers', 0.06);
    A.pave(B, -10.5, 0, -16.5, DEP + 1.5, 'pavers', 0.06);
    A.pave(B, LEN + 2, LEN + 22, -16.5, 2, 'gravel', 0.05);
    A.pave(B, -0.6, LEN + 0.6, DEP, DEP + 1.0, 'slabs', 0.07);                              // the path under the balconies
    yield;

    // ---- the garden: fence, thujas, playground, benches
    const Y = (s, v) => B.at(s, v);
    A.mesh([Y(0, 14.1), Y(1, 16), Y(-1.5, 44), Y(64, 26.6), Y(61.8, 14.1)].slice(1), 1.2, 0x3a5f40);
    A.gate(Y(0.05, 14.3), Y(0.95, 15.8), 1.2, 0x3a5f40);
    for (let k = 0; k <= 26; k++) {
      const t = k / 26, s = -1.5 + (64 - -1.5) * t, v = 44 + (26.6 - 44) * t - 0.9;
      const [x, z] = Y(s, v);
      A.K.thuja(x, z, 1.6 + ((k * 7) % 5) * 0.22, 0.42, k);
    }
    for (let k = 0; k < 9; k++) { const [x, z] = Y(0.4 - k * 0.27, 18 + k * 3); A.K.thuja(x, z, 1.4 + (k % 3) * 0.3, 0.38, k + 3); }
    A.swing(B, 20, 27, 2.8);
    A.swing(B, 40, 25, 2.6);
    {                                                                                      // the climbing frame and its slide
      const s = 30, v = 28, y = h(...Y(s, v));
      for (const [ds, dv] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) A.box(B, s + ds, v + dv, 0.1, 0.1, 0, 2.6, 0x8a6b4e, y);
      A.box(B, s, v, 1.8, 1.8, 1.15, 1.25, 0x8a6b4e, y);
      A.box(B, s, v, 2.0, 2.0, 2.6, 2.7, 0xc7412f, y);
      for (const dv of [-0.85, 0.85]) A.box(B, s, v + dv, 1.7, 0.04, 1.25, 1.9, 0x2f7a4a, y);
      const slide = new THREE.BoxGeometry(0.55, 0.06, 2.6).rotateX(-0.45);
      const [x, z] = Y(s + 2.0, v);
      p.add(slide, 0x2f8a52, x, y + 0.65, z, B.YAW + Math.PI / 2);
      A.box(B, 34, 22, 1.4, 1.4, 0, 0.3, 0xcbb994, y);                                     // the sandpit's edge
    }
    for (const [s, v] of [[3, 17.4], [12, 17.2], [26, 20]]) {
      A.box(B, s, v, 1.6, 0.4, 0.42, 0.47, 0x7a5a3c);
      A.box(B, s, v + 0.2, 1.6, 0.06, 0.5, 0.85, 0x7a5a3c);
      for (const e of [-0.7, 0.7]) A.box(B, s + e, v, 0.06, 0.4, 0, 0.42, 0x2c2d30);
    }
    yield;

    // ---- the car park's globe lamps, the cabinet at the west gable
    for (const [s, v] of [[-8, -15.5], [8, -15.5], [24, -15.5], [40, -15.5]]) {
      const [x, z] = Y(s, v), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.05, 0.07, 3.8, 8), 0x9a9da2, x, y + 1.9, z);
      p.add(new THREE.SphereGeometry(0.24, 12, 8), 0xf3f3ef, x, y + 4.0, z);
    }
    A.box(B, -0.5, 9.5, 0.4, 1.2, 0, 1.4, 0xa9aaa6, g + 0.05);
    A.box(B, -0.5, 9.5, 0.45, 1.25, 1.4, 1.48, 0x8e8f8c, g + 0.05);
    yield;

    // ---- Miridon: the three flags and the blue pylon by the road
    {
      const R = frame([470.2, 7736.0], [0.309, 0.951]);
      for (let k = 0; k < 3; k++) {
        const [x, z] = R.at(k * 3.0, 0), y = h(x, z);
        p.add(new THREE.CylinderGeometry(0.05, 0.07, 9, 8), 0xd8dadc, x, y + 4.5, z);
        A.box(R, k * 3.0 + 0.02, 0.45, 0.04, 0.8, 4.2, 8.6, 0x2b58a8, y);
        A.box(R, k * 3.0 + 0.03, 0.45, 0.02, 0.5, 5.0, 7.8, 0xe8ecf2, y);
      }
      const [x, z] = R.at(-6, 0.5), y = h(x, z);
      A.box(R, -6, 0.5, 1.2, 0.45, 0, 4.6, 0x2a62b6, y);
      A.box(R, -6, 0.5, 1.25, 0.5, 3.6, 4.4, 0xeef2f6, y);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if (![[620, 7926], [527, 7966], [482, 7890], [438, 7757]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'rehetare');
    },
  };
}
