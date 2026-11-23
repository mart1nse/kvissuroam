// Kaardista "Rehepapi tee, Soinaste" (Martin, 23 Nov 2026), batch 2: Rattasepa tee 5 and the strip of units at
// Rehepapi tee 4, from his Street View shots (Rattasepa tee 3, June 2011; Rehepapi tee, Aug 2024) and the Land
// Board's orthophoto.
//  - Rattasepa tee 5, built here by hand (the map's block was a plain box): the white brick bungalow under its
//    dark tiled hipped roof, white soffits and dark gutters; to the drive (west) the windows, the entrance, the
//    brown garage door, the two small windows and the brown service door; to Rehepapi tee (east) the small
//    window, the wide three-pane window and the two-pane one; the steel flue; the flat-roofed carport on brown
//    posts with braces at the end of the drive, the paved drive and the cars on it;
//  - along Rehepapi tee: the white board fence of no. 5, the young spruces in front of it, the dark grey board
//    fence of no. 3 further south (inferred from the far shot);
//  - Rehepapi tee 4: the long grey strip of units across the road: shop windows below, dark window bands above,
//    the round blue "3" on its north end.
// Guessed: the bungalow's north end and its window sizes on the ends, the strip's back. No street name is painted
// on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame, cellKit } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /rattadebug/.test(location.search);
const S112 = ['1_12', -160, 6880];
const CENTRE = [345, 7240];

// the bungalow's frame: s from the north-east corner south along the east wall, v west across the house
const R = frame([315.7, 7283.7], [0.330, 0.944]);
const LEN = 19.4, DEP = 10.3, EAV = 2.85, RIDGE = 5.15;

export function rattasepaWalls(walls) {
  setHouseColours(walls, S112[0], S112[1], S112[2], [
    { base: 3162, x: 313.8, z: 7294.7, hide: true, reach: 12 },                         // Rattasepa tee 5: built here
    { base: 3334, x: 318.4, z: 7312.5, hide: true, shelter: true, reach: 5 },            // its carport too
    { base: 3081, x: 386, z: 7170, wall: 0x8a8d91, roof: 0x55585d, reach: 40 },            // Rehepapi tee 4
  ]);
}

// the cars on the drive, driven in nose first: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw))
const NOSE_N = Math.atan2(-0.330, 0.944);
export const RATTASEPA_CARS = [
  [...R.at(11, 12.1), NOSE_N, 'passat', 'black', 0.03],
  [...R.at(16.6, 12.1), NOSE_N, 'mazda6', 'blue', 0.03],
  [...R.at(22.4, 12.2), NOSE_N, 'rav4', 'white', 0.03],
];

// the young spruces between the fence and the cycle path
const SPRUCES = [[326.4, 7280.5, 4.2], [327.3, 7286.0, 3.6], [328.2, 7292.0, 4.6], [329.4, 7299.0, 3.9], [330.5, 7305.5, 4.4]];

// ---------------------------------------------------------------- the painters
const DARK = { frame: '#2b2a2a', glass: '#3f4b57', fw: 0.06, bars: 1, T: false, sill: 0.04, surround: 0 };
const BROWN = '#5a3826';
function brickWall(P, w) {
  P.r(0, -0.6, w, EAV, '#ecebe5');
  P.brick(0, 0.35, w, EAV, [236, 234, 228], Math.round(w * 13));
  P.weather(0, -0.6, w, EAV, 0.1, Math.round(w * 7));
  P.r(0, -0.6, w, 0.35, '#9b9a97');                                                        // the plinth
}
// to the drive: x from the north end
function west(P, w) {
  brickWall(P, w);
  P.win(1.1, 0.75, 2.5, 2.25, DARK);
  P.win(3.9, 0.75, 5.3, 2.25, DARK);
  P.win(6.2, 1.75, 6.65, 2.3, { ...DARK, bars: 0 });
  P.r(7.1, 0, 8.9, 2.55, '#d9d8d2');                                                      // the entrance's recess
  P.r(7.35, 0, 8.25, 2.15, BROWN); P.r(8.05, 1.0, 8.12, 1.06, '#c9c9c9');
  P.r(8.5, 0.8, 8.8, 2.35, '#e8e8e6');                                                     // the drainpipe by the door
  P.win(9.6, 0.75, 11.0, 2.25, DARK);
  P.r(11.6, 0, 14.4, 2.3, '#4a2e20');                                                     // the garage door
  for (let y = 0.25; y < 2.3; y += 0.25) P.r(11.6, y, 14.4, y + 0.03, '#3c251a');
  P.r(13.9, 0.35, 14.1, 0.42, '#d0d0cc');
  P.r(14.75, 0, 14.9, EAV - 0.1, '#2a2b2e');                                               // the downpipe
  P.win(15.6, 1.7, 16.2, 2.25, { ...DARK, bars: 0 });
  P.win(17.1, 1.7, 17.7, 2.25, { ...DARK, bars: 0 });
  P.r(18.3, 0, 19.1, 2.1, BROWN);
}
// to Rehepapi tee: x from the south end
function east(P, w) {
  brickWall(P, w);
  P.win(3.6, 1.0, 4.4, 2.25, { ...DARK, bars: 0 });
  P.win(7.2, 0.6, 11.0, 2.25, { ...DARK, bars: 2 });
  P.win(12.8, 0.75, 14.6, 2.25, DARK);
  P.r(w - 0.25, 0, w - 0.1, EAV - 0.1, '#2a2b2e');
}
function southEnd(P, w) { brickWall(P, w); P.win(1.6, 0.75, 3.0, 2.25, DARK); P.win(6.6, 0.75, 8.0, 2.25, DARK); }
function northEnd(P, w) { brickWall(P, w); P.win(4.5, 0.9, 5.8, 2.25, DARK); }

// Rehepapi tee 4: grey cladding, shop windows, dark bands of windows above; the blue "3" on the north end
const SHOP = { frame: '#3a2c24', glass: '#53616e', fw: 0.07, bars: 2, T: false, sill: 0, surround: 0 };
function strip(P, W) {
  const len = W.len, top = W.peak;
  P.boards(0, P.y0, len, top, [138, 141, 145], 0.3);
  P.r(0, P.y0, len, 0.25, '#5d5f63');
  P.r(0, top - 0.3, len, top, '#9a9da1');
  const road = W.nx < -0.9;
  if (road && len > 60) {                                             // to the road: x from the north end
    for (let x = 0.8; x + 5.4 < len; x += 6.0) {
      P.win(x, 0.05, x + 5.2, 2.9, SHOP);
      P.r(x + 3.3, 0.05, x + 4.4, 2.4, '#2e2a28');
      P.r(x + 0.4, 3.0, x + 4.8, 3.45, '#36383c');                                          // the canopy's edge
      P.win(x + 1.0, 4.4, x + 4.2, 5.6, { ...DARK, bars: 1 });
    }
    P.r(len * 0.52, 3.6, len * 0.52 + 2.2, 4.2, '#1d1e22');
    P.text('YLICOOL', len * 0.52 + 1.1, 3.9, 0.3, '#f2f2f0');
    for (const [x, c] of [[len * 0.66, '#2d6fb7'], [len * 0.74, '#d24a2a'], [len * 0.82, '#2d6fb7']]) P.r(x, 3.65, x + 1.6, 4.1, c);
  } else if (W.nz < -0.9 && len > 15) {                               // the north end
    P.win(len - 7.5, 0.05, len - 0.6, 2.9, SHOP);
    P.win(len - 6.5, 4.4, len - 1.5, 5.6, DARK);
    P.arc(len * 0.36, top - 1.6, 0.9, '#f4f4f2'); P.arc(len * 0.36, top - 1.6, 0.8, '#2350a0');
    P.text('3', len * 0.36, top - 1.6, 1.1, '#f4f4f2');
    P.win(2, 4.4, 5, 5.6, DARK);
  } else if (len > 15) for (let x = 2; x + 3 < len - 1; x += 7) P.win(x, 4.4, x + 3, 5.6, DARK);
}

export function createRattasepa(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  world.addClearing({ test(x, z) { const [s, v] = R.sv(x, z); return s > -1 && s < 27 && v > -1 && v < 15; } });
  world.addTrees(SPRUCES.map(([x, z, hh], k) => [x, z, hh, 1.0 + (k % 2) * 0.15, 1]));

  function* build() {
    skinHouses(world, group, [{ name: 'r4', sec: S112[0], base: 3081, at: [386, 7170], r: 40, spec: { wall: [138, 141, 145], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: strip }] }],
      { label: 'rehepapi 4', shadows, ppm: 16, far: 5, faces: (W) => W.len > 8 && (W.nx < -0.9 || W.nz < -0.9), debug: DEBUG });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const g = Math.min(...[[0, 0], [LEN, 0], [LEN, DEP], [0, DEP]].map(([s, v]) => h(...R.at(s, v)))) - 0.05;

    // ---- the walls
    const C = cellKit(group, { shadows, size: 1024 });
    C.cell('w', LEN, -0.6, EAV, '#ecebe5', west, 34);
    C.cell('e', LEN, -0.6, EAV, '#ecebe5', east, 34);
    C.cell('s', DEP, -0.6, EAV, '#ecebe5', southEnd, 30);
    C.cell('n', DEP, -0.6, EAV, '#ecebe5', northEnd, 30);
    yield;
    C.put(R.at(0, DEP), R.at(LEN, DEP), g, 'w');
    C.put(R.at(LEN, 0), R.at(0, 0), g, 'e');
    C.put(R.at(LEN, DEP), R.at(LEN, 0), g, 's');
    C.put(R.at(0, 0), R.at(0, DEP), g, 'n');
    C.finish();
    A.box(R, LEN / 2, DEP / 2, LEN - 0.1, DEP - 0.1, -0.6, EAV, 0xe7e6e0, g);
    yield;

    // ---- the hipped roof: dark tiles, white soffits, dark gutters
    {
      const ov = 0.55, half = DEP / 2 + ov, k = (RIDGE - EAV) / (DEP / 2), y = g + EAV - ov * k, top = g + RIDGE;
      const P3 = (s, v, yy) => { const [x, z] = R.at(s, v); return [x, yy, z]; };
      const a = P3(-ov, -ov, y), b = P3(LEN + ov, -ov, y), c = P3(LEN + ov, DEP + ov, y), d = P3(-ov, DEP + ov, y);
      const r1 = P3(-ov + half, DEP / 2, top), r2 = P3(LEN + ov - half, DEP / 2, top);
      const pos = [];
      for (const t of [[a, b, r2], [a, r2, r1], [b, c, r2], [c, d, r1], [c, r1, r2], [d, a, r1]]) pos.push(...t[0], ...t[1], ...t[2], ...t[0], ...t[2], ...t[1]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      p.add(geo, 0x35373b, 0, 0, 0);
      A.box(R, LEN / 2, DEP / 2, LEN + ov * 2, DEP + ov * 2, EAV - ov * k - 0.16, EAV - ov * k - 0.12, 0xe9e8e3, g);   // the soffit
      for (const [s, v, ls, lv] of [[LEN / 2, -ov, LEN + ov * 2, 0.12], [LEN / 2, DEP + ov, LEN + ov * 2, 0.12], [-ov, DEP / 2, 0.12, DEP + ov * 2], [LEN + ov, DEP / 2, 0.12, DEP + ov * 2]]) A.box(R, s, v, ls, lv, EAV - ov * k - 0.2, EAV - ov * k + 0.02, 0x2b2c30, g);
      const [fx, fz] = R.at(4.5, 2.2);
      p.add(new THREE.CylinderGeometry(0.11, 0.11, 1.6, 10), 0xb9bcc0, fx, g + EAV + 2.2 * k + 0.5, fz);
      p.add(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10), 0x8f9296, fx, g + EAV + 2.2 * k + 1.3, fz);
    }
    yield;

    // ---- the carport at the end of the drive: a flat dark roof on brown posts with braces
    {
      const K = frame([316.6, 7315.9], [0.950, -0.305]), gy = h(...K.at(2.5, -2.5));
      for (const [s, v] of [[0.2, -0.2], [4.9, -0.2], [0.2, -5.0], [4.9, -5.0]]) A.box(K, s, v, 0.14, 0.14, 0, 2.45, 0x4a3428, gy);
      for (const v of [-0.2, -5.0]) {
        A.box(K, 2.55, v, 5.2, 0.16, 2.3, 2.5, 0x4a3428, gy);
        for (const s of [0.75, 4.35]) { const geo = new THREE.BoxGeometry(1.1, 0.08, 0.08).rotateZ(s < 2 ? 0.75 : -0.75); const [x, z] = K.at(s, v); p.add(geo, 0x4a3428, x, gy + 1.95, z, K.YAW); }
      }
      A.box(K, 2.55, -2.6, 5.7, 5.3, 2.5, 2.64, 0x2c2d31, gy);
    }
    // ---- the drive: grey pavers from Rattasepa tee along the west side, the path to the door
    A.pave(R, 6, 33, DEP + 0.2, DEP + 4.0, 'pavers', 0.06);
    A.pave(R, 7, 9, DEP, DEP + 0.2, 'pavers', 0.06);
    yield;

    // ---- the fences along Rehepapi tee: white boards on no. 5, dark grey on no. 3
    A.picket([[325.0, 7276.3], [327.6, 7293.5], [330.3, 7311.0]], 1.75, [226, 226, 221], { gap: 0.02, width: 0.12 });
    A.picket([[330.6, 7313.0], [333.2, 7326.0], [336.0, 7338.0]], 1.7, [74, 77, 82], { gap: 0.015, width: 0.12 });
    A.bushes([[324.3, 7313.0, 1.6, 1.3], [325.4, 7318.5, 1.8, 1.5], [320.4, 7290.0, 1.0, 0.9, [0.66, 0.84, 0.6]], [321.9, 7296.5, 1.0, 0.9, [0.66, 0.84, 0.6]]]);
    // the green bin by the garage
    { const [x, z] = R.at(15.2, DEP + 0.5), y = h(x, z); p.box(0.58, 1.05, 0.72, 0x2f6b3a, x, y + 0.52, z, R.YAW); }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if (![[314, 7295], [386, 7170], [330, 7310]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'rattasepa');
    },
  };
}
