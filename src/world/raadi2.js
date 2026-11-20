// Raadi, batch 2 of Martin's outline (20 Nov): the east end of Keskuse tee (3/1, 3/2, 1/1, 1/2 and the
// three-storey 1/3 round their shared car park) and the houses across the ditch on Mõisapiiri tänav (10, 12,
// 14, 16), dressed from the Land Board's oblique air photos (2024) and the orthophoto. The map's own blocks
// keep their shapes; their walls are painted and their roofs coloured. Window counts and the backs are guessed
// from the air. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, wallPlanes } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';

const DEBUG = typeof location !== 'undefined' && /raadidebug/.test(location.search);
const ORIGINS = { '4_0': [1760, -800], '5_0': [2400, -800] };

// Mõisapiiri tänav past the houses: s along the road to the south-east, v + towards the houses
const MR = frame([2275, -310], [145, 92]);

// name, sector, base, centre, reach, wall, roof, front (the point its doors face)
const HOUSES = [
  ['k3-1', '4_0', 1964, [2318.0, -350.0], 30, 0x60402e, 0x3c3e42, [2332, -343]],
  ['k3-2', '4_0', 1977, [2347.0, -333.0], 26, 0x60402e, 0x3c3e42, [2332, -343]],
  ['k1-1', '4_0', 1919, [2372.0, -313.5], 34, 0xeeeee8, 0x3c3e42, [2392, -302]],
  ['k1-2', '4_0', 1943, [2403.5, -274.0], 34, 0xeeeee8, 0x3c3e42, [2402, -296]],
  ['k1-3', '5_0', 1926, [2413.5, -309.0], 22, 0xf0f0ec, 0x3c3e42, [2390, -322]],
  ['m10', '4_0', 1884, [2286.0, -285.0], 22, 0xf0eee8, 0x3e4146],
  ['m12', '4_0', 1950, [2317.5, -261.0], 16, 0xece8e0, 0x5a3c30],
  ['m14', '4_0', 1991, [2362.5, -236.0], 18, 0xf0eee8, 0x3e4146],
  ['m16', '4_0', 1972, [2399.0, -205.0], 24, 0xe2e2de, 0x393b41],
  ['m16b', '4_0', 2005, [2382.5, -223.5], 8, 0xe2e2de, 0x393b41],
];
export function raadi2Walls(walls) {
  for (const sec of Object.keys(ORIGINS)) {
    const list = HOUSES.filter((H) => H[1] === sec);
    setHouseColours(walls, sec, ...ORIGINS[sec], list.map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

const modern = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: '#2f3136', glass: '#3f4b58', sill: 0.04, w: 1.4, pitch: 3.1, ...o });
const brown = { kind: 'wood', upright: true, pitch: 0.12, wall: [80, 56, 42], trim: '#2c2a29', weather: 0.12 };
const SPEC = {
  // dark brown boards on the long walls, white render on the ends
  'k3-1': { kind: 'plaster', wall: [240, 240, 236], trim: '#f4f4f0', weather: 0.1, plinth: { h: 0.3, col: '#55575c' }, win: modern(), storey: 2.9, maxFloors: 2, attic: null, door: '#2c2a29', unit: 6.0, long: brown },
  'k3-2': { kind: 'plaster', wall: [240, 240, 236], trim: '#f4f4f0', weather: 0.1, plinth: { h: 0.3, col: '#55575c' }, win: modern(), storey: 2.9, maxFloors: 2, attic: null, door: '#2c2a29', unit: 6.0, long: brown },
  // white render, the ground floor of the car park side in brown boards round each door (the store boxes)
  'k1-1': { kind: 'plaster', wall: [238, 238, 234], trim: '#f4f4f0', weather: 0.1, plinth: { h: 0.3, col: '#6f7276' }, win: modern(), storey: 2.9, maxFloors: 2, attic: null, door: '#3a3c40', unit: 6.2, box: '#7a5236' },
  'k1-2': { kind: 'plaster', wall: [238, 238, 234], trim: '#f4f4f0', weather: 0.1, plinth: { h: 0.3, col: '#6f7276' }, win: modern(), storey: 2.9, maxFloors: 2, attic: null, door: '#3a3c40', unit: 6.2, box: '#7a5236' },
  // three storeys of flats, brown boarded balconies at the corners
  'k1-3': { kind: 'plaster', wall: [240, 240, 236], trim: '#f4f4f0', weather: 0.08, plinth: { h: 0.4, col: '#6f7276' }, win: modern({ w: 1.5, pitch: 3.0 }), storey: 2.9, maxFloors: 3, attic: null, door: '#3a3c40', unit: 14, corners: '#7a5236' },
  m10: { kind: 'plaster', wall: [240, 238, 232], trim: '#f4f2ee', weather: 0.1, plinth: { h: 0.4, col: '#7c7b7a' }, win: modern({ w: 1.6 }), storey: 3.0, maxFloors: 2, attic: null, door: '#3a3c40' },
  m12: { kind: 'plaster', wall: [236, 232, 224], trim: '#f2efe8', weather: 0.12, plinth: { h: 0.5, col: '#6a4c3c' }, win: modern({ frame: '#5a3c30', w: 1.3 }), storey: 2.9, maxFloors: 2, attic: null, door: '#5a3c30' },
  m14: { kind: 'plaster', wall: [240, 238, 232], trim: '#f4f2ee', weather: 0.1, plinth: { h: 0.4, col: '#7c7b7a' }, win: modern({ w: 1.5 }), storey: 3.0, maxFloors: 2, attic: null, door: '#3a3c40' },
  m16: { kind: 'plaster', wall: [226, 226, 222], trim: '#ecebe8', weather: 0.06, plinth: { h: 0.4, col: '#8a8a88' }, win: modern({ w: 1.6 }), storey: 3.0, maxFloors: 2, attic: null, door: '#3a3c40' },
  m16b: { kind: 'plaster', wall: [226, 226, 222], trim: '#ecebe8', weather: 0.06, plinth: { h: 0.4, col: '#8a8a88' }, win: modern(), storey: 3.0, maxFloors: 1, attic: null },
};
const facing = (W, p) => { const tx = p[0] - W.mid[0], tz = p[1] - W.mid[1]; return (tx * W.nx + tz * W.nz) / (Math.hypot(tx, tz) || 1); };
const planesOf = (world, H) => wallPlanes(world, H[1], H[2], (x, z) => (x - H[3][0]) ** 2 + (z - H[3][1]) ** 2 < H[4] ** 2);

// ---------------------------------------------------------------- parked cars
// rows along the long walls facing the car parks (wall planes of the map's blocks, cars 3.2 m out, nose in),
// with the second rows across the aisles; about two bays in three taken, as on the 2024 air photos
const MODELS = [['passat', 'silver'], ['rav4', 'black'], ['mazda6', 'grey'], ['rav4', 'white'], ['passat', 'grey'], ['mazda6', 'white'], ['rav4', 'grey'], ['passat', 'white'], ['mazda6', 'red'], ['bz4x', 'silver'], ['model3', 'white'], ['accord', 'black']];
export const RAADI2_CARS = [];
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// wall mid point, its outward normal, from k0 to k1 along it, cars at offset out, nose towards (-1) or away (1)
function row(mid, n, k0, k1, out, nose, fill = 0.65) {
  const t = [-n[1], n[0]];
  for (let k = k0; k <= k1; k += 2.6) {
    if (rnd() > fill) continue;
    const [id, paint] = MODELS[Math.floor(rnd() * MODELS.length)];
    const x = mid[0] + n[0] * out + t[0] * k, z = mid[1] + n[1] * out + t[1] * k;
    RAADI2_CARS.push([+x.toFixed(1), +z.toFixed(1), Math.atan2(n[0] * nose, -n[1] * nose), id, paint, 0.03]);
  }
}
row([2326.3, -346.5], [0.83, 0.56], -16, 16, 3.2, -1, 0.75);          // 3/1, along its front
row([2341.3, -337.0], [-0.83, -0.55], -16, 16, 3.2, -1, 0.45);        // 3/2, along its front
row([2377.8, -310.0], [0.86, 0.51], -22, 22, 3.2, -1, 0.8);           // 1/1, along its front
row([2377.8, -310.0], [0.86, 0.51], -8, 22, 14.2, 1, 0.6);            // across the aisle, past 1/3
row([2407.0, -279.5], [0.51, -0.86], -21, 22, 3.2, -1, 0.75);         // 1/2, along its front
row([2407.0, -279.5], [0.51, -0.86], -8, 22, 14.5, 1, 0.6);           // across the aisle, towards 1/3
{ const q = MR.at(54, 13.5); RAADI2_CARS.push([+q[0].toFixed(1), +q[1].toFixed(1), Math.atan2(-MR.V[0], MR.V[1]), 'rav4', 'silver', 0.03]); }  // the drive at Mõisapiiri 12

// ---------------------------------------------------------------- the Mõisapiiri gardens (MR frame)
// the tall thuja row along the path at the west side of number 10, small trees and the pools
const TREES = [];
for (let v = 10; v <= 44; v += 1.6) TREES.push([...MR.at(3.2, v), 6.5, 1.3, 1]);
const POOLS = [[2268.5, -282.4, 7.0, 3.4, 0], [2301.0, -261.0, 7.2, 3.4, 1]];   // x, z, length, width, along the road (0) or across (1)
const BOUNDS = [42, 88, 134];                                                       // side fences between the plots
const GAPS = [[27, 34], [50, 58], [119, 126]];                                      // the drives

// a terrace or block of flats: a door per home on the long walls facing its car park
function block(world, H) {
  const [name, sec, base, at, r, , , front] = H, spec = SPEC[name];
  const walls = [];
  for (const W of planesOf(world, H)) {
    if (W.foot > 1.2 || W.len < 5) continue;
    const o = { near: W.mid, within: 0.4 };
    if (spec.long && W.len > 12) o.spec = spec.long;
    if (spec.corners && W.len > 12) o.draw = (P) => { for (const [a, b] of [[0, 2.6], [W.len - 2.6, W.len]]) for (let f = 0; f < 3; f++) { const y = 0.6 + f * 2.9; P.r(a, y, b, y + 1.1, spec.corners); P.r(a + 0.3, y + 1.1, b - 0.3, y + 2.4, '#3f4b58'); } };
    if (W.len > 12 && facing(W, front) > 0.5) {
      const n = Math.max(1, Math.round(W.len / (spec.unit || 8))), u = W.len / n, doors = [], xs = [];
      for (let k = 0; k < n; k++) { doors.push({ x: u * k + u * 0.3, w: 1.0, h: 2.2, col: spec.door, frame: spec.trim, light: 0.2, panels: 1 }); xs.push(u * k + u * 0.72); }
      o.doors = doors; o.xs = xs;
      if (spec.box) {
        const prev = o.draw;
        o.draw = (P, W2, sp) => { prev && prev(P, W2, sp); for (let k = 0; k < n; k++) { const x = u * k + u * 0.3; P.boards(x + 0.75, 0.3, x + 2.6, 2.5, [122, 82, 54], 0.12, true); } };
      }
    }
    walls.push(o);
  }
  return { name, sec, base, at, r, spec, walls };
}

// a house: the door on the wall that looks most at Mõisapiiri tänav
function house(world, H) {
  const [name, sec, base, at, r] = H, spec = SPEC[name];
  const out = { name, sec, base, at, r, spec, walls: [] };
  if (!spec.door) return out;
  let best = null, bs = -1;
  for (const W of planesOf(world, H)) {
    if (W.len < 3 || W.foot > 1.2) continue;
    const [, v] = MR.sv(W.mid[0], W.mid[1]), q = MR.at(MR.sv(W.mid[0], W.mid[1])[0], 2.5);
    const f = facing(W, q), score = f > 0.3 ? W.len * f / (1 + v * 0.02) : -1;
    if (score > bs) { bs = score; best = W; }
  }
  if (best) out.walls.push({ near: best.mid, within: 0.4, doors: [{ x: best.len * 0.45, w: 1.1, h: 2.2, col: spec.door, steps: 2, canopy: '#3a3c40' }] });
  return out;
}

export function createRaadi2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addTrees(TREES);
  let built = false;
  const CENTRE = [2350, -280];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map((H) => (H[7] ? block(world, H) : house(world, H)));
    skinHouses(world, group, houses, { shadows, ppm: 14, far: 7, debug: DEBUG });
    // the street fence along the front of 10, 12 and 14 (16 is still a building site) with gaps for the drives
    let s0 = 3;
    for (const [g0, g1] of [...GAPS, [140, 140]]) {
      if (g0 > s0) for (let s = s0; s < g0 - 0.01; s += 4) A.bar(MR.at(s, 8.6), MR.at(Math.min(g0, s + 4), 8.6), 0.05, 0, 1.2, 0x3a3c40);
      s0 = g1;
    }
    for (const [g0, g1] of GAPS) for (const s of [g0, g1]) A.box(MR, s, 8.6, 0.14, 0.14, 0, 1.4, 0x2e3034);
    // dark board fences between the plots, and along the back of them
    for (const b of BOUNDS) for (let v = 8.6; v < 50; v += 4) A.bar(MR.at(b, v), MR.at(b, Math.min(50, v + 4)), 0.06, 0, 1.6, 0x4a3a30);
    for (let s = 3; s < 134; s += 4) A.bar(MR.at(s, 50), MR.at(Math.min(134, s + 4), 50), 0.06, 0, 1.6, 0x4a3a30);
    // the drives: concrete pavers from the road to the carports
    for (const [g0, g1] of GAPS) A.pave(MR, g0, g1, 5.6, 16, 'paver');
    // the pools: a white rim round blue water
    for (const [x, z, l, w, across] of POOLS) {
      const F = frame([x, z], across ? MR.V : MR.U), g = h(x, z);
      A.box(F, 0, 0, l + 0.8, w + 0.8, -0.05, 0.12, 0xf0f0ee, g);
      A.box(F, 0, 0, l, w, -0.05, 0.14, 0x3fb6d8, g);
    }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 300) return;
      if ([[2318, -350], [2413, -309], [2286, -285], [2399, -205]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
