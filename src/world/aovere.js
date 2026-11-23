// Kaardista "Aovere junction" (Martin, 23 Nov), batch 1: the three houses on Aasa tee by the Haava junction that
// he circled in blue. No Street View passes in front of them: built from the Land Board's oblique air photos
// (2021 to 2024, from all four sides), the 10 cm orthophoto for the ground, and his far shots from roads 43 and
// 44 (Aug 2024, Sept 2023).
//  - the white modern house: a two-storey flat-roofed cube at the south-east end and a long one-storey wing,
//    white render, the dark glazing of the wing to the garden, the slit windows of the cube, the wooden deck
//    with its planters and rail on the garden side, the pergola where the cube meets the wing;
//  - the white house at the end of the lane: two hipped parts under a dark grey standing-seam roof, the big
//    dark window to the south, the gravel turning place by its door;
//  - the dark green house to the north: an L under a grey-blue standing-seam roof with skylights and a chimney,
//    the matching garage, the pale concrete drive with its loop, the greenhouse, raised beds and playhouse;
//  - between them: the rows of ground-mounted solar panels, trampolines, the mesh fences on wooden posts, the
//    row of young thujas along the lane, and the cars on the drives.
// Guessed: door and window places on the sides the photos see only at a slant, and the backs. Nothing is put on
// the lane or Aasa tee. Built only when the car is within 420 m: far from the centre drives and the lap.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame, cellKit } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /aovdebug/.test(location.search);
const S = ['11_-7', 6240, -5280];
const CENTRE = [6605, -5005];

// [name, base, at, reach, wall, roof]
const HOUSES = [
  ['white', 1573, [6554, -5022], 14, 0xedece7, 0x4a4e55],
  ['green', 1485, [6649, -5039], 18, 0x486454, 0x5b6468],
  ['garage', 1545, [6651, -5008], 9, 0x486454, 0x5b6468],
];

export function aovereWalls(walls) {
  setHouseColours(walls, S[0], S[1], S[2], [
    ...HOUSES.map(([, base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })),
    { base: 1635, x: 6600, z: -4977, hide: true, reach: 18 },                     // the modern house: built here (the map's cube was 10 m high)
  ]);
}

// cars on the drives, all BMWs (Martin, 23 Nov): [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw))
export const AOVERE_CARS = [
  [6601.5, -4995.5, -2.47, 'f31', 'black', 0.03],
  [6597.0, -4992.0, -2.47, 'f31', 'white', 0.03],
  [6645.5, -5016.5, 0.67, 'f31', 'cyan', 0.03],
  [6567.0, -5023.5, -1.57, 'f31', 'black', 0.03],
];

// ---------------------------------------------------------------- the painters
const WHITE = '#eeede8';
const DARKWIN = { frame: '#2d2f33', glass: '#3c4652', fw: 0.06, bars: 0, T: false, sill: 0.04, surround: 0, sc: '#d9d8d2' };
const WHITEWIN = { frame: '#f3f2ee', glass: '#4b5868', fw: 0.07, bars: 1, T: false, sill: 0.06, surround: 0 };
const dot = (W, n) => W.nx * n[0] + W.nz * n[1];

function render(P, W, col, seed) {
  P.r(0, P.y0, W.len, P.y1, col);
  P.weather(0, P.y0, W.len, P.y1, 0.18, seed);
  P.r(0, P.y0, W.len, 0.35, '#8e8f91');                                          // the plinth
}
// windows spread along a wall at a pitch, kept off the corners
function row(P, W, y, h, w, pitch, opt, skip = () => false) {
  const n = Math.max(1, Math.round((W.len - 1.6) / pitch));
  for (let k = 0; k < n; k++) {
    const x = (W.len / n) * (k + 0.5);
    if (skip(x)) continue;
    P.win(x - w / 2, y, x + w / 2, y + h, opt);
  }
}

// The white house: walls along x and z. Door to the gravel to the east, the big dark window to the south.
function white(P, W) {
  render(P, W, '#edece7', 57);
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, top - 0.22, len, top, '#3e4248');                                           // the fascia under the eaves
  if (W.nx > 0.9) {
    P.door(len * 0.45, len * 0.45 + 1.0, 2.15, '#3b3d42', { frame: '#f3f2ee', light: 0, panels: 1 });
    row(P, W, 1.0, 1.3, 1.2, 3.4, WHITEWIN, (x) => Math.abs(x - len * 0.45 - 0.5) < 1.6);
  } else if (W.nz > 0.9 && len > 8) {
    P.win(len * 0.5 - 1.6, 0.3, len * 0.5 + 1.6, 2.4, { ...DARKWIN, bars: 2 });
    row(P, W, 1.0, 1.3, 1.2, 3.4, WHITEWIN, (x) => Math.abs(x - len * 0.5) < 2.4);
  } else row(P, W, 1.0, 1.3, 1.2, 3.4, WHITEWIN);
}

// The green house and its garage: dark green boards, white frames. The door to the drive's loop (south-east).
function green(P, W) {
  P.boards(0, P.y0, W.len, P.y1, [72, 100, 84], 0.14);
  P.weather(0, P.y0, W.len, P.y1, 0.15, 73);
  P.r(0, P.y0, W.len, 0.4, '#7f8183');
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05), se = dot(W, [0.64, 0.77]);
  P.r(0, top - 0.25, len, top, '#e9e7e0');
  if (se > 0.85 && len > 5) {
    P.door(len * 0.5 - 0.55, len * 0.5 + 0.55, 2.2, '#efeee8', { frame: '#f3f2ee', light: 0.4, panels: 2 });
    row(P, W, 0.9, 1.4, 1.3, 3.2, WHITEWIN, (x) => Math.abs(x - len * 0.5) < 1.5);
  } else row(P, W, 0.9, 1.4, 1.3, 3.2, WHITEWIN);
}
function garage(P, W) {
  P.boards(0, P.y0, W.len, P.y1, [72, 100, 84], 0.14);
  P.r(0, P.y0, W.len, 0.3, '#7f8183');
  const top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, top - 0.22, W.len, top, '#e9e7e0');
  if (dot(W, [0.8, 0.6]) > 0.7) {                                                      // the door to the drive
    P.r(W.len * 0.5 - 1.5, 0, W.len * 0.5 + 1.5, 2.3, '#e9e7e0');
    for (let y = 0.3; y < 2.3; y += 0.32) P.r(W.len * 0.5 - 1.45, y, W.len * 0.5 + 1.45, y + 0.03, '#c4c3bd');
  } else if (W.len > 4) P.win(W.len * 0.5 - 0.5, 1.2, W.len * 0.5 + 0.5, 1.9, WHITEWIN);
}
const PAINT = { white, green, garage };

// ---------------------------------------------------------------- the build
export function createAovere(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, base, at, r]) => ({ name, sec: S[0], base, at, r, spec: { wall: [236, 236, 232], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { label: 'aovere fronts', shadows, ppm: 16, far: 6, faces: (W) => W.len > 3, debug: DEBUG });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const strip = (pts, hw, kind, lift) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        A.pave(frame(a, [b[0] - a[0], b[1] - a[1]]), -hw * 0.6, len + hw * 0.6, -hw, hw, kind, lift);
      }
    };

    // ---- the ground: the green house's concrete drive and loop, the gravel by the white house and the modern one
    strip([[6670.5, -4990.5], [6662, -5000], [6654, -5010], [6645, -5020], [6637, -5027], [6632, -5032.5]], 2.2, 'slabs', 0.06);
    strip([[6637, -5027], [6630, -5024], [6626, -5029], [6628.5, -5036]], 1.6, 'slabs', 0.06);
    strip([[6654, -5010], [6648, -5005.5]], 3.0, 'slabs', 0.06);                                 // in front of the garage
    A.pave(frame([6562, -5032], [1, 0]), 0, 8.5, 0, 14, 'gravel', 0.07);                             // the turning place by the white house
    A.pave(frame([6592, -4993], [0.78, 0.62]), 0, 14, -7, 0.5, 'gravel', 0.07);                      // the modern house's parking
    yield;

    // ---- the modern house, built here: the wing (s 0..19, v 0..11) and the cube (s 19..26.8, v 0..12.2) in the
    // frame along its long side (v + to the garden, south-west), white render, flat dark roofs with light copings
    {
      const M = frame([6593.3, -4990.3], [0.784, 0.62]);
      const corners = [[0, 0], [26.8, 0], [26.8, 12.2], [0, 11]].map(([s, v]) => h(...M.at(s, v)));
      const g = Math.min(...corners) - 0.05, WH = 3.4, CH = 6.6;
      const C = cellKit(group, { shadows, size: 1024 });
      const base = (P, w, top) => { P.r(0, -0.6, w, top, WHITE); P.weather(0, -0.6, w, top, 0.15, Math.round(w * 13)); P.r(0, -0.6, w, 0.3, '#8e8f91'); P.r(0, top - 0.14, w, top, '#d2d1cc'); };
      C.cell('wingSW', 19, -0.6, WH, WHITE, (P, w) => {                      // to the garden: one band of dark glass, the door to the deck
        base(P, w, WH);
        P.r(1.2, 0.3, 15.6, 2.75, '#2b2d31');
        for (let x = 1.25; x < 15.5; x += 1.8) P.grad(x + 0.05, 0.36, Math.min(15.55, x + 1.75), 2.69, '#5f7080', '#36414d');
        P.r(16.6, 0, 19, 3.25, '#26272b'); P.grad(16.7, 0.05, 18.9, 3.1, '#4f5d6b', '#2c343d');     // the recess at the cube
      }, 18);
      C.cell('wingNE', 19, -0.6, WH, WHITE, (P, w) => {                      // to the lane: the garage door, two strips, the front door
        base(P, w, WH);
        P.r(1.0, 0.05, 4.2, 2.4, '#7d7f83');
        for (let y = 0.3; y < 2.4; y += 0.3) P.r(1.0, y, 4.2, y + 0.03, '#6b6d71');
        P.win(6.0, 1.7, 10.5, 2.4, DARKWIN); P.win(12.0, 1.7, 14.5, 2.4, DARKWIN);
        P.r(16.2, 0, 17.4, 2.35, '#3a3b3f'); P.r(16.35, 0.95, 16.4, 1.45, '#c9c9c9');
      }, 18);
      C.cell('wingNW', 11, -0.6, WH, WHITE, (P, w) => { base(P, w, WH); P.win(4.0, 1.0, 7.0, 2.3, DARKWIN); }, 18);
      C.cell('cubeSW', 7.8, -0.6, CH, WHITE, (P, w) => {
        base(P, w, CH);
        P.win(0.4, 0.3, 3.4, 2.7, { ...DARKWIN, bars: 1 });                    // the sliding doors to the deck
        P.win(4.6, 3.8, 6.2, 5.3, DARKWIN);
        P.win(6.9, 1.0, 7.35, 5.8, DARKWIN);                                      // the slit by the corner
      }, 18);
      C.cell('cubeSE', 12.2, -0.6, CH, WHITE, (P, w) => {
        base(P, w, CH);
        P.win(3.4, 3.6, 3.85, 6.0, DARKWIN);
        P.win(6.5, 1.0, 10.8, 1.9, DARKWIN);
        P.win(7.6, 4.2, 8.6, 5.2, DARKWIN);
      }, 18);
      C.cell('cubeNE', 7.8, -0.6, CH, WHITE, (P, w) => {
        base(P, w, CH);
        P.win(1.4, 1.2, 1.9, 6.0, DARKWIN);                                       // the stair window
        P.win(4.2, 3.8, 6.2, 5.0, DARKWIN); P.win(4.2, 1.0, 6.2, 2.0, DARKWIN);
      }, 18);
      C.cell('cubeNW', 12.2, -0.6, CH, WHITE, (P, w) => { base(P, w, CH); P.win(4.5, 4.0, 6.0, 5.2, DARKWIN); }, 18);
      const put = (s0, v0, s1, v1, key) => C.put(M.at(s0, v0), M.at(s1, v1), g, key);
      put(0, 11, 19, 11, 'wingSW'); put(19, 0, 0, 0, 'wingNE'); put(0, 0, 0, 11, 'wingNW');
      put(19, 12.2, 26.8, 12.2, 'cubeSW'); put(26.8, 12.2, 26.8, 0, 'cubeSE'); put(26.8, 0, 19, 0, 'cubeNE'); put(19, 0, 19, 12.2, 'cubeNW');
      C.put(M.at(19, 11), M.at(19, 12.2), g, 'wingNW');                          // the cube's step out past the wing
      yield;
      A.box(M, 9.5, 5.5, 18.96, 10.96, -0.6, WH - 0.02, 0xe9e8e3, g);
      A.box(M, 22.9, 6.1, 7.76, 12.16, -0.6, CH - 0.02, 0xe9e8e3, g);
      A.box(M, 9.5, 5.5, 18.6, 10.6, WH - 0.02, WH + 0.02, 0x3f4247, g);       // the roofs' membrane inside the copings
      A.box(M, 22.9, 6.1, 7.4, 11.8, CH - 0.02, CH + 0.02, 0x3f4247, g);
      A.box(M, 21.5, 4.0, 1.2, 1.2, CH, CH + 0.6, 0xd8d7d2, g);                // the hatch to the cube's roof
      C.finish();
      // the deck along the cube's garden side, its planters and black rail
      const dg = h(...M.at(22, 14));
      A.box(M, 22.6, 14.3, 8.6, 4.2, -0.3, 0.4, 0x8b6e52, dg);
      for (let s = 18.4; s < 26.9; s += 0.15) A.box(M, s, 14.3, 0.02, 4.22, 0.4, 0.41, 0x6f573f, dg);
      for (const [s, v] of [[19.2, 16.0], [20.8, 16.0], [22.4, 16.0], [24.0, 16.0], [25.6, 16.0]]) {
        A.box(M, s, v, 1.1, 0.5, 0.4, 0.82, 0x7a5f45, dg);
        A.bushes([[...M.at(s, v), 0.9, 0.6, [0.82, 0.95, 0.72]]]);
      }
      for (const s of [18.4, 21.2, 24.0, 26.8]) A.box(M, s, 16.4, 0.08, 0.08, 0, 1.3, 0x2e2f33, dg);
      A.box(M, 22.6, 16.4, 8.4, 0.05, 1.25, 1.31, 0x2e2f33, dg);
      A.box(M, 22.6, 16.4, 8.4, 0.04, 0.75, 0.79, 0x2e2f33, dg);
    }
    yield;

    // ---- the solar panels on their racks, tilted to the south (the low edge on the v + side)
    const solar = (a, b, depth = 4.2) => {
      const F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]), tilt = 0.52;
      const [cx, cz] = F.at(len / 2, 0), g = h(cx, cz), rise = Math.sin(tilt) * depth;
      p.add(new THREE.BoxGeometry(len, 0.06, depth).rotateX(tilt), 0x232838, cx, g + 0.6 + rise / 2, cz, F.YAW);
      for (let k = 0; k < Math.round(len / 1.05); k++) {                                              // the gaps between the modules
        const s = (k + 0.5) * len / Math.round(len / 1.05);
        if (k) A.box(F, s - len / Math.round(len / 1.05) / 2, 0, 0.03, depth * Math.cos(tilt), 0.6 + rise / 2 - 0.02, 0.6 + rise / 2 + 0.06, 0x9aa0a8, g);
      }
      for (let s = 0.4; s < len; s += 3.0) {
        A.box(F, s, depth * Math.cos(tilt) / 2 - 0.2, 0.08, 0.08, 0, 0.6, 0x8d9096, g);
        A.box(F, s, -depth * Math.cos(tilt) / 2 + 0.2, 0.08, 0.08, 0, 0.6 + rise, 0x8d9096, g);
      }
    };
    solar([6531.5, -5003], [6543.5, -4993]);
    solar([6544.5, -4992], [6556, -4982.5]);
    solar([6591.5, -5016.8], [6601.5, -5009.3]);
    solar([6606, -5008], [6617.5, -5012.4]);
    yield;

    // ---- the gardens: trampolines, the greenhouse, raised beds, the playhouse, a shed, a swing
    A.trampoline(6551.5, -4996.5, 1.6);
    A.trampoline(6592.0, -4967.5, 1.3);
    A.greenhouse(frame([6671.5, -5046.7], [0.97, -0.25]), 0, 0, 6.5, 3.0);
    for (let k = 0; k < 4; k++) for (const v of [0, 1.6]) A.box(frame([6669.5, -5062], [0.97, -0.25]), k * 2.4, v, 1.9, 1.0, 0, 0.35, 0x7e6248);
    A.shed(frame([6663.5, -5057], [0.97, -0.25]), 0, 0, 2.0, 1.6, 1.4, 2.1, 0x8a6a4c, 0x3d3f44);
    A.shed(frame([6586.0, -4978.5], [0.78, 0.62]), 0, 0, 3.0, 2.2, 2.0, 2.6, 0x9c8a74, 0x45484d);
    A.swing(frame([6612, -4960], [0.78, 0.62]), 0, 0);
    A.gazebo(6547.5, -5000.5, 1.0, 0xdfdcd3, 0x55585e);                                              // the white house's little play hut
    yield;

    // ---- fences: mesh on wooden posts along Aasa tee and round the plots; the young thujas by the lane
    const mesh = (pts) => {
      A.mesh(pts, 1.2, 0x7a6450);
      A.walk(pts, 3, ([x, z]) => p.box(0.12, 1.35, 0.12, 0x7a6450, x, h(x, z) + 0.6, z));
    };
    mesh([[6634.5, -4944], [6649.0, -4963.0]]);                                                      // the modern plot to Aasa tee
    mesh([[6649.8, -4973.5], [6622.0, -4987.5], [6608.5, -4995.2]]);                                 // the modern plot to the lane
    mesh([[6666.6, -4993.2], [6695.0, -5030.5]]);                                                     // the green plot to Aasa tee
    mesh([[6553.0, -4979.0], [6580.0, -5009.0]]);                                                     // between the white and the modern plots
    for (let k = 0; k <= 11; k++) {
      const x = 6622.5 + k * 2.4, z = -4988.0 + k * 1.22;
      A.K.thuja(x, z, 1.0 + ((k * 7) % 3) * 0.12, 0.32, k);
    }
    A.hedge([[6555.0, -4980.5], [6566, -4993], [6577.5, -5006]], 1.3, 1.0, [0.62, 0.78, 0.55]);
    // the post box stand at the lane's mouth, and the power pole by the green house's gate
    { const x = 6650.6, z = -4975.2, g = h(x, z);
      p.box(0.08, 1.1, 0.08, 0x3a3b3f, x, g + 0.55, z);
      p.box(0.32, 0.38, 0.5, 0x2c5a3a, x, g + 1.25, z, 0.66); p.box(0.32, 0.38, 0.5, 0x8a8c90, x + 0.42, g + 1.25, z - 0.25, 0.66); }
    { const x = 6669.2, z = -4999.5, g = h(x, z);
      p.add(new THREE.CylinderGeometry(0.12, 0.15, 9, 8), 0x6e5a45, x, g + 4.5, z);
      p.box(1.6, 0.1, 0.1, 0x6e5a45, x, g + 8.4, z, 0.66); }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if (![[6600, -4977], [6554, -5022], [6649, -5039], [6670, -4995]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'aovere');
    },
  };
}
