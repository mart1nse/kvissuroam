// Kaardista "Raadi, Mööbliait and Kvissentali tee" (Martin, 21 Nov), batch 2: Kvissentali tee from the Klaose and
// Lootsi corner east to road 3, from his Street View shots of July 2024 ("8", "14", "18" and "2 Kvissentali tee",
// the corner at road 3) and the Land Board's 10 cm air photo for where things stand.
//  - the new houses on the south side (Ignatsi 2 to 8, Kvissentali põik 2): white render with grey or brown-grey
//    parts, wide dark windows, flat roofs; Ignatsi 2's white board fence on the corner, the black fence and the
//    row of young thujas at Ignatsi 4, the grey and the red and yellow cabinets by the path;
//  - Lootsi 1 on the north corner: the white cube behind its tall clipped hedge along both streets;
//  - Kvissentali tee 2: the cream board house with brown trim behind its white picket fence; Kvissentali tee 4;
//    the white house with the red roof and the sun panels; the brown board fence round the corner plot at road 3;
//  - Inox Baltic (Kvissentali tee 1) across the road: a light grey hall.
// Inferred from the shots, not seen in them: the fronts of Ignatsi 8, Kvissentali põik 2 and Kvissentali tee 4.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /kv2debug/.test(location.search);
const S = ['1_1', -160, -160];
// Kvissentali tee: west part from the Klaose corner, east part on to road 3; s along to the east, v + = south
const RW = frame([145.4, -30.6], [333.6 - 145.4, -54.6 + 30.6]);
const RE = frame([333.6, -54.6], [465.3 - 333.6, -73.5 + 54.6]);

// [name, base, at, reach, wall, roof, painter options]
const HOUSES = [
  ['lootsi1', 56, [160, -60], 14, 0xf2f1ee, 0x55585e, { wall: '#f2f1ee', part: '#5d6068', face: 'S' }],
  ['ign2', 117, [174, -8], 12, 0xf1f0ec, 0x4f525a, { wall: '#f1f0ec', part: '#6b6e75', face: 'N' }],
  ['ign4', 24, [207, -13], 10, 0xeeece6, 0x4f525a, { wall: '#eeece6', part: '#8a7f73', face: 'N', lowPart: true }],
  ['ign6', 145, [243, -16], 12, 0xf3f2ef, 0x4f525a, { wall: '#f3f2ef', part: '#64666c', face: 'N' }],
  ['ign8', 102, [274, -20], 12, 0xdcdcd8, 0x56595f, { wall: '#dcdcd8', part: '#6f6a64', face: 'N' }],
  ['kp2', 193, [313, -23], 13, 0xefeeea, 0x45484f, { wall: '#efeeea', part: '#7a6a58', face: 'N' }],
  ['kp2b', 185, [320, -13], 6, 0xefeeea, 0x45484f, { wall: '#efeeea', part: '#7a6a58', face: 'N' }],
  ['kt4', 961, [402, -48], 12, 0xe4dcc4, 0x5a5d63, { wall: '#e4dcc4', boards: [226, 218, 194], trim: '#f4f1ea' }],
  ['kt2', 1100, [425, -52], 7, 0xe6dcc0, 0x4a3b33, { wall: '#e6dcc0', boards: [228, 219, 192], trim: '#6b4a36' }],
  ['solar', 1140, [442, -56], 9, 0xf1efea, 0xb7432f, { wall: '#f1efea', trim: '#f4f1ea' }],
  ['inox', 732, [359, -110], 34, 0xd8dadd, 0xc3c5c9, { hall: true }],
];

export function kvissentali2Walls(walls) {
  setHouseColours(walls, S[0], S[1], S[2], HOUSES.map(([, base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
}

// a new house: white render, a grey part, wide dark windows; `face` is the side to the street
function modern(P, W, o) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, o.wall); P.weather(0, P.y0, len, P.y1, 0.15, Math.round(len * 7));
  P.r(0, P.y0, len, 0.35, '#7d7f84');
  if (len < 4) return;
  const front = (o.face === 'N' && W.nz < -0.8) || (o.face === 'S' && W.nz > 0.8);
  if (o.lowPart) P.r(0, P.y0, len * 0.55, Math.min(3.0, top), o.part);
  else if (len > 7) P.r(len * 0.62, P.y0, len, top, o.part);
  const win = { frame: '#2c2e33', glass: '#4e5d6c', fw: 0.06, bars: 0, T: false, sill: 0, surround: 0 };
  const floors = top > 5 ? [0.5, 3.4] : [0.5];
  for (const y of floors) {
    if (front) {
      P.win(len * 0.12, y + 0.3, len * 0.12 + Math.min(3.6, len * 0.3), y + 2.2, win);
      if (len > 9) P.win(len * 0.66, y + 0.9, len * 0.66 + 1.6, y + 2.2, win);
    } else {
      for (let x = 1.2; x + 1.2 < len - 0.8; x += 3.4) P.win(x, y + 0.9, x + 1.2, y + 2.1, win);
    }
  }
  if (front && len > 8) P.door(len * 0.5 - 0.5, len * 0.5 + 0.5, 2.2, '#3a3c42', { frame: '#2c2e33', panels: 0 });
  if (top > 5) P.r(0, top - 0.25, len, top, '#3c3e44');
}
// a board house: boards, trim at the corners and round the windows
function boardHouse(P, W, o) {
  const len = W.len, top = W.peak;
  if (o.boards) P.boards(0, P.y0, len, P.y1, o.boards, 0.14, false); else { P.r(0, P.y0, len, P.y1, o.wall); P.weather(0, P.y0, len, P.y1, 0.3, 9); }
  P.r(0, P.y0, len, 0.55, '#8d877d');
  P.r(0, P.y0, 0.15, top, o.trim); P.r(len - 0.15, P.y0, len, top, o.trim);
  if (len < 4) return;
  const win = { frame: o.trim, glass: '#56677a', fw: 0.08, bars: 1, sill: 0.08, surround: 0.08, sc: o.trim };
  for (let x = 1.3; x + 1.1 < len - 0.9; x += 3.0) {
    P.win(x, 1.0, x + 1.1, 2.4, win);
    if (top > 5.2) P.win(x, 3.6, x + 1.0, 4.9, win);
  }
}
function hall(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#d8dadd');
  for (let y = 0.9; y < top; y += 0.9) P.r(0, y - 0.02, len, y + 0.02, '#c9cbcf');
  P.r(0, P.y0, len, 0.4, '#8f9196');
  if (len > 15) {
    P.r(len * 0.3, 0, len * 0.3 + 4, 4.4, '#9a9da3');
    for (let y = 0.3; y < 4.4; y += 0.35) P.r(len * 0.3, y, len * 0.3 + 4, y + 0.04, '#8c8f95');
    for (let x = 2; x < len - 2; x += 5) P.win(x, 4.8, x + 2.6, 5.6, { frame: '#7d8086', glass: '#5a6b7b', fw: 0.05, bars: 0, sill: 0, surround: 0 });
  }
}
const paint = (name, o) => (P, W) => (o.hall ? hall(P, W) : o.face ? modern(P, W, o) : boardHouse(P, W, o));

const CENTRE = [300, -50];

export function createKvissentali2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  // the hedges and fences stand clear of map trees
  world.addClearing({ test: (x, z) => {
    const [s, v] = RW.sv(x, z), [s2, v2] = RE.sv(x, z);
    return (s > 2 && s < 30 && Math.abs(v + 9.2) < 1.4) || (Math.abs(x - 151.6) < 1.4 && z < -40 && z > -70) || (s2 > 80 && s2 < 135 && Math.abs(v2 - 8.2) < 1.2) || (x > 466 && x < 469.5 && z > -67 && z < -40);
  } });
  let built = false;

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, base, at, r, , , o]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint(name, o) }] }));
    skinHouses(world, group, houses, { label: 'kvissentali2 fronts', shadows, ppm: 10, far: 5, faces: (W) => W.len > 5 && W.foot < 2, debug: DEBUG });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    // ---- Lootsi 1: the tall clipped hedge along Kvissentali tee and down Lootsi
    A.hedge([RW.at(3, -9.2), RW.at(29, -9.2)], 2.4, 1.0);
    A.hedge([[151.6, -42], [151.6, -69]], 2.4, 1.0);
    yield;
    // ---- Ignatsi 2: the white board fence round the corner, thujas inside it
    // (close boards read as one face: boxes, not a painted fence, so no canvas for them; this place is built at DRIVE)
    const boards = (pts, hh, c, post) => { for (let i = 0; i < pts.length - 1; i++) { A.bar(pts[i], pts[i + 1], 0.05, 0, hh, c); A.bar(pts[i], pts[i + 1], 0.07, hh - 0.04, hh + 0.02, post); } A.walk(pts, 2.4, ([x, z]) => p.box(0.09, hh + 0.06, 0.09, post, x, h(x, z) + (hh + 0.06) / 2, z)); };
    boards([[157.5, -1], [157.5, -25.5], RW.at(13, 8.6), RW.at(26, 8.6)], 1.25, 0xeeeeea, 0xd8d8d4);
    const thujas = [];
    for (let z = -23; z < -2; z += 1.4) thujas.push([159.0, z, 0.8, 1.6 + (z * 7 % 3) * 0.1]);
    // ---- Ignatsi 4: the low black fence, the gate, the row of young thujas behind it
    A.mesh([RW.at(46, 8.8), RW.at(58, 8.8)], 1.1, 0x2a2b2f);
    A.mesh([RW.at(62, 8.8), RW.at(76, 8.8)], 1.1, 0x2a2b2f);
    A.gate(RW.at(58, 8.8), RW.at(62, 8.8), 1.15, 0x2a2b2f);
    for (let s = 46.6; s < 76; s += 1.15) { if (s > 57.5 && s < 62.5) continue; thujas.push([...RW.at(s, 9.7), 0.7, 1.3 + ((s * 13) % 4) * 0.08]); }
    A.bushes(thujas.map(([x, z, w, hh]) => [x, z, w, hh, [0.42, 0.62, 0.45]]));
    // the cabinets by the path: grey at Ignatsi 4/6, red and yellow at Ignatsi 2's drive
    for (const [s, v, c] of [[80, 8.2, 0xc9c9c4], [40, 8.0, 0xd8d3a4], [41.2, 8.0, 0xc9453a]]) A.box(RW, s, v, 0.8, 0.45, 0, 1.35, c);
    yield;
    // ---- Kvissentali tee 2: the white picket fence on a low plinth
    A.picket([RE.at(80, 8.2), RE.at(100, 8.2)], 1.15, [240, 240, 236]);
    A.bar(RE.at(80, 8.3), RE.at(100, 8.3), 0.35, -0.1, 0.25, 0x9a968e);
    // ---- the corner plot at road 3: tall brown boards along Kvissentali tee and down road 3
    boards([RE.at(103, 8.2), RE.at(133, 8.2), [467.8, -66], [467.8, -41]], 1.75, 0x86604a, 0x6e4e3c);
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[160, -60], [207, -13], [313, -23], [425, -52], [359, -110]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'kvissentali2'); }
    },
  };
}
