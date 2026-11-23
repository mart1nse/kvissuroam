// Kaardista "Aovere junction" (Martin, 23 Nov), batch 3: the farms round the Haava junction that face the roads
// out of it, built from the Land Board's oblique air photos (2018 to 2024, from all four sides) and the 10 cm
// orthophoto for the ground. No Street View passes close to any of them.
//  - Alrey on road 43: the red board barn with its white trim and a slate-blue standing-seam roof, the house of
//    dark brown boards with the round turret and the same roof, the grey carport between them, the little red
//    shed under the birches; the row of young spruces along the field edge, the round flower beds and the
//    planted island in the loop of the drive;
//  - the farm on Kiigi tee in its ring of spruce hedges: the white house under a red roof with its porch, the
//    long red barn under a pale metal roof, the white garage, the metal-roofed shed the map has no block for,
//    the row of solar panels by the field and the cars by the drive;
//  - the farm in the wood at the end of Aasa tee: the cream house under brown roofs, the board sheds and the
//    junk barn by the track, a trampoline, a caravan, the small sheds and the wood piles.
// Guessed: windows and doors on the sides the photos see only at a slant. Nothing is put on a road or a track.
// Each farm is built only when the car is within 380 m of it, in small steps through the work queue.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /aovdebug/.test(location.search);
const SEC = { '10_-7': [5600, -5280], '11_-7': [6240, -5280], '12_-7': [6880, -5280], '12_-6': [6880, -4640] };

// [farm, name, sector, base, at, reach, wall, roof, painter or null (colour only)]
const HOUSES = [
  ['alrey', 'redBarn', '10_-7', 1694, [6171, -5209], 16, 0x8c2a26, 0x3e4a5c, 'barn'],
  ['alrey', 'house', '10_-7', 1697, [6196, -5196], 16, 0x5b4334, 0x3e4a5c, 'brown'],
  ['alrey', 'carport', '10_-7', 1641, [6199, -5224], 12, 0x6f757c, 0x6b737c, null],
  ['alrey', 'carport2', '10_-7', 1989, [6196, -5218], 8, 0x6f757c, 0x6b737c, null],
  ['alrey', 'shed', '10_-7', 1562, [6187, -5248], 7, 0x8c2a26, 0x4b5462, null],
  ['kiigi', 'house', '12_-7', 2069, [6932, -4668], 10, 0xeeeeea, 0xa3302b, 'white'],
  ['kiigi', 'porch', '12_-7', 2580, [6926, -4666], 5, 0xeeeeea, 0x9aa0a6, null],
  ['kiigi', 'garage', '12_-7', 2252, [6970, -4655], 7, 0xe6e6e2, 0xdcdcdc, null],
  ['kiigi', 'barn', '12_-6', 2132, [6932, -4637], 16, 0x8a2b25, 0xb8bcc0, 'barn'],
  ['aasa', 'house', '11_-7', 1277, [6874, -5096], 16, 0xd9c99a, 0x5a3f33, 'cream'],
  ['aasa', 'junk', '11_-7', 1438, [6844, -5072], 9, 0x6e665c, 0x5e4436, null],
  ['aasa', 'ruin', '11_-7', 1444, [6810, -5068], 9, 0x7a6e60, 0x5d5349, null],
  ['aasa', 'store', '11_-7', 1449, [6877, -5115], 6, 0x8a7560, 0xb9b9b9, null],
  ['aasa', 'hut', '11_-7', 1544, [6878, -5081], 5, 0x7a6a58, 0x5a3f33, null],
  ['aasa', 'woodshed', '12_-7', 1267, [6897, -5079], 7, 0x4e4239, 0x4a3b33, null],
];

export function aovere3Walls(walls) {
  for (const [key, [x0, z0]] of Object.entries(SEC)) {
    const list = HOUSES.filter((e) => e[2] === key).map(([, , , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach }));
    if (list.length) setHouseColours(walls, key, x0, z0, list);
  }
}

// cars by the Kiigi tee farm's drive: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw))
export const AOVERE3_CARS = [
  [6960.0, -4628.5, 1.57, 'mazda6', 'red', 0.03],
  [6960.3, -4624.5, 1.57, 'ceedsw', 'red', 0.03],
  [6960.6, -4620.5, 1.57, 'passat', 'black', 0.03],
  [6203.5, -5212.0, 0.6, 'rav4', 'grey', 0.03],
];

// ---------------------------------------------------------------- the painters
const WHITEWIN = { frame: '#f3f2ee', glass: '#4b5868', fw: 0.07, bars: 1, T: false, sill: 0.06, surround: 0 };
const BROWNWIN = { frame: '#efe9dc', glass: '#46525f', fw: 0.07, bars: 1, T: true, sill: 0.06, surround: 0 };
// windows spread along a wall at a pitch, kept off the corners
function row(P, W, y, h, w, pitch, opt, skip = () => false) {
  const n = Math.max(1, Math.round((W.len - 1.6) / pitch));
  for (let k = 0; k < n; k++) {
    const x = (W.len / n) * (k + 0.5);
    if (!skip(x)) P.win(x - w / 2, y, x + w / 2, y + h, opt);
  }
}
const top = (P, W) => Math.min(P.y1, W.eaves + 0.05);

// a red board barn: white corner boards and trim, the big door in the middle of a long side or a gable
function barn(P, W) {
  P.boards(0, P.y0, W.len, P.y1, [140, 44, 38], 0.12);
  P.weather(0, P.y0, W.len, P.y1, 0.2, 31);
  P.r(0, P.y0, W.len, 0.3, '#77787a');
  P.r(0, P.y0, 0.18, P.y1, '#efeee8'); P.r(W.len - 0.18, P.y0, W.len, P.y1, '#efeee8');
  P.r(0, top(P, W) - 0.2, W.len, top(P, W), '#efeee8');
  if (W.len > 6) {
    const m = W.len / 2;
    P.r(m - 1.5, 0, m + 1.5, 2.8, '#7c2622');
    P.r(m - 1.6, 2.8, m + 1.6, 2.95, '#efeee8'); P.r(m - 1.6, 0, m - 1.45, 2.95, '#efeee8'); P.r(m + 1.45, 0, m + 1.6, 2.95, '#efeee8');
    P.r(m - 0.04, 0, m + 0.04, 2.8, '#efeee8');                                  // the two leaves of the door
    row(P, W, 1.3, 0.8, 0.9, 5.5, WHITEWIN, (x) => Math.abs(x - m) < 2.4);
  } else if (W.len > 3) P.win(W.len / 2 - 0.45, 1.3, W.len / 2 + 0.45, 2.1, WHITEWIN);
}
// Alrey's house: dark brown boards, white frames, the door to the yard (north)
function brown(P, W) {
  P.boards(0, P.y0, W.len, P.y1, [91, 67, 52], 0.12);
  P.weather(0, P.y0, W.len, P.y1, 0.15, 47);
  P.r(0, P.y0, W.len, 0.4, '#7f8183');
  P.r(0, top(P, W) - 0.22, W.len, top(P, W), '#efe9dc');
  if (W.nz < -0.8 && W.len > 6) {
    P.door(W.len * 0.4 - 0.55, W.len * 0.4 + 0.55, 2.2, '#efe9dc', { frame: '#efe9dc', light: 0.3, panels: 2 });
    row(P, W, 0.9, 1.4, 1.2, 3.2, BROWNWIN, (x) => Math.abs(x - W.len * 0.4) < 1.5);
  } else row(P, W, 0.9, 1.4, 1.2, 3.2, BROWNWIN);
}
// the Kiigi tee house: white boards and frames, red-brown door to the barn yard (south)
function white(P, W) {
  P.boards(0, P.y0, W.len, P.y1, [236, 236, 232], 0.12);
  P.weather(0, P.y0, W.len, P.y1, 0.15, 63);
  P.r(0, P.y0, W.len, 0.45, '#8e8f91');
  if (W.nz > 0.8 && W.len > 6) {
    P.door(W.len * 0.5 - 0.5, W.len * 0.5 + 0.5, 2.1, '#7a3a2c', { frame: '#f3f2ee', light: 0.3, panels: 2 });
    row(P, W, 0.9, 1.3, 1.1, 3.0, WHITEWIN, (x) => Math.abs(x - W.len * 0.5) < 1.4);
  } else row(P, W, 0.9, 1.3, 1.1, 3.0, WHITEWIN);
}
// the house in the wood: cream render above, a white plinth storey, brown frames
function cream(P, W) {
  P.r(0, P.y0, W.len, P.y1, '#d9c99a');
  P.weather(0, P.y0, W.len, P.y1, 0.2, 83);
  P.r(0, P.y0, W.len, 0.5, '#e8e6df');
  P.r(0, top(P, W) - 0.25, W.len, top(P, W), '#5a3f33');
  const opt = { frame: '#5a3f33', glass: '#3f4a55', fw: 0.07, bars: 1, T: false, sill: 0.05, surround: 0 };
  if (W.nz < -0.8 && W.len > 6) {
    P.door(W.len * 0.55 - 0.5, W.len * 0.55 + 0.5, 2.1, '#5a3f33', { frame: '#5a3f33', light: 0.3, panels: 1 });
    row(P, W, 0.9, 1.3, 1.2, 3.2, opt, (x) => Math.abs(x - W.len * 0.55) < 1.4);
  } else row(P, W, 0.9, 1.3, 1.2, 3.2, opt);
}
const PAINT = { barn, brown, white, cream };

// ---------------------------------------------------------------- the build
export function createAovere3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // the solar panels on their racks, tilted to the south (the low edge on the v + side)
  const solar = (A, a, b, depth = 4.2) => {
    const { p, h } = A;
    const F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]), tilt = 0.52;
    const [cx, cz] = F.at(len / 2, 0), g = h(cx, cz), rise = Math.sin(tilt) * depth, n = Math.round(len / 1.05);
    p.add(new THREE.BoxGeometry(len, 0.06, depth).rotateX(tilt), 0x232838, cx, g + 0.6 + rise / 2, cz, F.YAW);
    for (let k = 1; k < n; k++) A.box(F, k * len / n, 0, 0.03, depth * Math.cos(tilt), 0.6 + rise / 2 - 0.02, 0.6 + rise / 2 + 0.06, 0x9aa0a8, g);
    for (let s = 0.4; s < len; s += 3.0) {
      A.box(F, s, depth * Math.cos(tilt) / 2 - 0.2, 0.08, 0.08, 0, 0.6, 0x8d9096, g);
      A.box(F, s, -depth * Math.cos(tilt) / 2 + 0.2, 0.08, 0.08, 0, 0.6 + rise, 0x8d9096, g);
    }
  };
  const paint = (farm) => {
    const houses = HOUSES.filter((e) => e[0] === farm && e[8]).map(([, name, sec, base, at, r, , , pt]) => ({ name, sec, base, at, r, spec: { wall: [236, 236, 232], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[pt](P, W) }] }));
    skinHouses(world, group, houses, { label: `aovere3 ${farm} fronts`, shadows, ppm: 14, far: 6, faces: (W) => W.len > 3, debug: DEBUG });
  };

  const FARMS = [
    { name: 'alrey', at: [6190, -5215], check: [[6171, -5209], [6196, -5196]], *build() {
      paint('alrey');
      yield;
      const A = areaKit(world, group, { shadows });
      // the row of young spruces along the field edge, north and east of the yard
      A.walk([[6197, -5257], [6213, -5252], [6226, -5236], [6232, -5222]], 2.6, ([x, z]) => A.K.thuja(x, z, 1.6 + ((x * 13 + z * 7) % 1) * 0.5, 0.55, Math.round(x + z)));
      yield;
      // the round flower beds by the house and the planted island in the loop of the drive
      const bed = (x, z, r) => {
        A.pave(frame([x - r, z], [1, 0]), 0, 2 * r, -r * 0.8, r * 0.8, 'soil', 0.05);
        A.bushes([[x - r * 0.35, z, r * 0.7, 0.6, [0.62, 0.8, 0.5]], [x + r * 0.3, z + r * 0.2, r * 0.6, 0.8, [0.86, 0.82, 0.5]], [x, z - r * 0.3, r * 0.5, 0.5, [0.5, 0.72, 0.52]]]);
      };
      bed(6209, -5191, 1.6);
      bed(6182, -5200, 1.4);
      bed(6224, -5203, 4.5);
      yield;
      A.finish();
    } },
    { name: 'kiigi', at: [6935, -4650], check: [[6932, -4668], [6932, -4637]], *build() {
      paint('kiigi');
      yield;
      const A = areaKit(world, group, { shadows });
      // the metal-roofed shed west of the house (no block on the map for it)
      A.shed(frame([6916.5, -4655], [0.3, 0.954]), 0, 0, 13, 7, 2.6, 4.2, 0x9a9a96, 0xc6c9cc);
      yield;
      solar(A, [6927.5, -4607], [6940.5, -4607], 4.6);
      yield;
      A.finish();
    } },
    { name: 'aasa', at: [6865, -5095], check: [[6874, -5096], [6844, -5072]], *build() {
      paint('aasa');
      yield;
      const A = areaKit(world, group, { shadows });
      const { p, h } = A;
      A.trampoline(6839, -5109, 1.8);
      // the caravan by the junk barn, white with a dark window band
      { const F = frame([6845.8, -5082.7], [1, 0]);
        A.box(F, 0, 0, 6.2, 2.3, 0.35, 2.75, 0xe9e7e0); A.box(F, 0.4, 0, 3.6, 2.32, 1.5, 2.0, 0x3d4650);
        A.box(F, -2.4, 0, 0.12, 0.12, 0, 0.35, 0x333333); A.box(F, 2.4, 0, 0.12, 0.12, 0, 0.35, 0x333333); }
      // the small sheds north of the track
      A.shed(frame([6801.5, -5123.5], [1, 0]), 0, 0, 3.0, 4.0, 2.0, 2.8, 0x4e4239, 0x3d3a38);
      A.shed(frame([6850, -5122.5], [1, 0]), 0, 0, 4.6, 4.0, 2.1, 3.0, 0x7d7468, 0x5a3f33);
      // the round metal tank and the garden table in the yard
      { const x = 6838.8, z = -5126.5; p.add(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 12), 0xb9bcc0, x, h(x, z) + 1.2, z); }
      { const F = frame([6852.5, -5111.5], [1, 0]);
        A.box(F, 0, 0, 1.8, 0.8, 0.72, 0.78, 0x8a6b4e); A.box(F, 0, 0.75, 1.8, 0.3, 0.42, 0.47, 0x8a6b4e); A.box(F, 0, -0.75, 1.8, 0.3, 0.42, 0.47, 0x8a6b4e); }
      yield;
      // the wood piles and the board stacks by the junk barn
      for (const [x, z, yaw] of [[6830.5, -5070.5, 0.2], [6826, -5065.5, -0.4], [6855.5, -5066, 1.3]]) {
        p.box(2.6, 1.1, 1.2, 0x7a5a3e, x, h(x, z) + 0.5, z, yaw);
        p.box(2.7, 0.06, 1.3, 0x55585e, x, h(x, z) + 1.08, z, yaw);
      }
      A.finish();
    } },
  ];

  return {
    update(car) {
      if (!car) return;
      for (const f of FARMS) {
        if (f.built || Math.hypot(car.x - f.at[0], car.z - f.at[1]) > 380) continue;
        if (!f.check.every((q) => world.ready(q[0], q[1]))) continue;
        f.built = true;
        jobs.add(f.build, `aovere3 ${f.name}`);
      }
    },
  };
}
