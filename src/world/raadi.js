// Raadi, the west end of Keskuse tee (Martin, 20 Nov: a pink outline on a map), dressed from the Land Board's
// oblique air photos (2024) and the orthophoto. The map's own blocks keep their shapes; their walls are painted:
//  - Foxway (Keskuse tee 16): the dark navy box with the white Foxway name and the glass entrance over its car
//    park, the dark annex by the road, the big car park to the west, three flags by the entrance;
//  - the terraces south of the road: Keskuse tee 9/2 and 9/1 (white render), 7/1 and 7/2 (dark brown boards with
//    orange entrance niches, the Honey Glow block), 5/1 and 5/2 (greige boards with yellow entrance niches), each
//    with its car park, the playground by 9/2 and the rows of young trees between the back gardens;
//  - trees where the orthophoto shows crowns and the map had none.
// Window counts, doors and the backs are guessed from the air. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, wallPlanes } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const SEC = '4_0', ORIGIN = [1760, -800];
const DEBUG = typeof location !== 'undefined' && /raadidebug/.test(location.search);

// crowns on the orthophoto with no map tree within 5 m (between the terraces and Mõisapiiri, by the car parks)
const TREES = [[2190.0, -346.5, 16, 7, 0], [2187.5, -351.0, 16, 7, 0], [2082.5, -340.5, 16, 7, 0], [2194.0, -343.5, 18, 7, 1], [2175.5, -331.5, 18, 7, 1], [2140.5, -337.5, 18, 7, 1], [2125.5, -354.5, 14.1, 7, 0], [2251.0, -331.5, 18, 7, 1], [2177.5, -353.0, 13.5, 7, 0], [2160.0, -334.5, 13.5, 7, 0], [2208.0, -345.0, 13.1, 6.7, 0], [2202.5, -354.0, 16.4, 6.2, 1], [2215.0, -351.0, 12.3, 6.2, 0], [2298.0, -376.0, 11.9, 5.9, 0], [2086.0, -344.5, 11.9, 5.9, 0], [2135.5, -331.5, 15.8, 5.9, 1], [2199.5, -342.0, 15.2, 5.6, 1], [2209.0, -340.0, 15.0, 5.5, 1], [2223.5, -349.5, 15.0, 5.5, 1], [2145.5, -357.5, 11.2, 5.5, 0], [2120.5, -354.5, 10.4, 4.9, 0], [2263.0, -337.5, 13.8, 4.9, 1], [2110.5, -363.0, 10.1, 4.7, 0], [2080.5, -370.0, 13.0, 4.5, 1], [2164.0, -354.5, 9.8, 4.5, 0], [2186.0, -343.5, 13.0, 4.5, 1], [2118.5, -342.5, 9.6, 4.4, 0], [2266.0, -333.0, 9.6, 4.4, 0], [2114.0, -374.0, 12.0, 4.0, 1], [2210.0, -350.0, 9.0, 4.0, 0], [2089.5, -352.5, 12.0, 4.0, 1], [2182.5, -352.5, 9.0, 4.0, 0], [2082.0, -335.5, 9.0, 4.0, 0], [2142.0, -332.5, 12.0, 4.0, 1], [2122.0, -363.0, 11.0, 3.5, 1], [2176.5, -358.0, 11.0, 3.5, 1], [2148.5, -361.5, 11.0, 3.5, 1]];

// young trees between the back gardens (9/1 and 7/1, 7/2 and 5/1) and along the south edge of 7/1
const ROWS = [];
const row = (a, b, step, hgt, crown, type) => { const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step); for (let k = 0; k <= n; k++) ROWS.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, hgt, crown, type]); };
row([2136, -381], [2166, -444], 3.2, 4.5, 1.8, 0);
row([2206, -360], [2233, -417], 3.2, 3.2, 1.3, 1);

// ---------------------------------------------------------------- what the map's own data needs
// name, base, centre, reach, wall, roof, the point its doors face (its car park)
const HOUSES = [
  ['foxway', 2000, [2335.0, -478.0], 58, 0x30364a, 0xd8d8d4],
  ['annex', 2024, [2302.5, -421.3], 18, 0x2c2e33, 0x8c8f93],
  ['t9-2', 1645, [2066.0, -386.0], 46, 0xeeeee8, 0x5f6266, [2075, -415]],
  ['t9-1', 1767, [2136.0, -416.0], 40, 0xeeeee8, 0x55585c, [2112, -432]],
  ['t7-1', 1724, [2165.0, -405.0], 40, 0x3c3836, 0x3a3b3f, [2186, -400]],
  ['t7-2', 1752, [2201.0, -395.0], 38, 0x3c3836, 0x3a3b3f, [2183, -402]],
  ['t5-1', 1802, [2238.5, -387.0], 35, 0xaaa48c, 0x3a3b3f, [2253, -376]],
  ['t5-2', 1844, [2271.0, -370.5], 30, 0xaaa48c, 0x3a3b3f, [2252, -374]],
];
export function raadiWalls(walls) {
  setHouseColours(walls, SEC, ...ORIGIN, HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// ---------------------------------------------------------------- parked cars
// [x, z, yaw, model, paint, lift]; forward = (sin yaw, -cos yaw)
const MODELS = [['passat', 'silver'], ['rav4', 'black'], ['mazda6', 'grey'], ['rav4', 'white'], ['passat', 'grey'], ['mazda6', 'white'], ['rav4', 'grey'], ['passat', 'white'], ['mazda6', 'blue'], ['bz4x', 'silver']];
const bays = [];
// a row of bays across a frame: s from s0 every 2.6 m, cars facing +v (nose 1) or -v (nose -1); take marks the taken bays
function bayRow(F, s0, n, v, nose, take) {
  for (let k = 0; k < n; k++) bays.push({ F, s: s0 + 1.3 + k * 2.6, v, nose, car: take[k % take.length] });
}
// frames measured on the orthophoto; v + is to the right of the direction U
const FOXLOT = frame([2329, -428], [57, -59]);          // along the Foxway front (its south-east wall), v + away from it
const LOT9 = frame([2060, -400], [68, -37]);            // between Keskuse tee and 9/2, v - towards the road
const LOT7 = frame([2164, -361], [32, -68]);            // the yard between 7/1 and 7/2, v + towards 7/2
const LOT5 = frame([2241, -349], [24, -51]);            // the yard between 5/1 and 5/2, v + towards 5/2
bayRow(FOXLOT, 5, 14, 3.2, -1, [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0]);
bayRow(FOXLOT, 56, 8, 3.2, -1, [1, 0, 1, 1, 1, 0, 1, 1]);
bayRow(FOXLOT, 4, 29, 15.5, 1, [1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1]);
bayRow(LOT9, 3, 26, -3.5, 1, [1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0]);
bayRow(LOT9, 3, 26, -16, -1, [0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0]);
bayRow(LOT7, 6, 28, -6.5, -1, [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1]);
bayRow(LOT7, 8, 22, 6, 1, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]);
bayRow(LOT5, 4, 20, -7.5, -1, [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1]);
bayRow(LOT5, 6, 18, 7, 1, [0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0]);
// the big gravel car park west of Foxway has no bays: cars stand side by side along its west edge, in a file in
// the middle and by the east kerb (positions from the 2023 orthophoto), and in the marked row by Foxway's west wall
const LOOSE = [
  [2204.3, -493.5], [2203.3, -490.5], [2202.5, -487.8], [2200.7, -485.0], [2199.5, -482.0], [2198.0, -479.2], [2196.2, -476.5], [2194.8, -473.8], [2192.2, -471.5], [2202.8, -466.2],
  [2232.0, -471.5], [2231.0, -467.3], [2230.5, -464.3], [2228.0, -461.7], [2226.2, -457.8], [2225.0, -455.0], [2218.8, -457.8],
  [2249.7, -443.2], [2262.8, -439.5], [2264.0, -442.7], [2264.8, -445.8],
];
const WESTROW = [[2283.0, -455.0], [2282.5, -452.5], [2281.0, -447.8], [2280.0, -445.5], [2279.0, -443.2], [2276.5, -438.0], [2275.0, -435.5], [2273.5, -433.0]];
export const RAADI_CARS = [];
const yawOf = (dx, dz) => Math.atan2(dx, -dz);
let mi = 0;
const pick = () => MODELS[(mi++ * 7) % MODELS.length];
bays.forEach((b) => {
  if (!b.car) return;
  const [x, z] = b.F.at(b.s, b.v), [id, paint] = pick();
  RAADI_CARS.push([+x.toFixed(1), +z.toFixed(1), yawOf(b.F.V[0] * b.nose, b.F.V[1] * b.nose), id, paint, 0.03]);
});
LOOSE.forEach(([x, z], i) => { const [id, paint] = pick(), f = i % 3 ? 1 : -1; RAADI_CARS.push([x, z, yawOf(-0.93 * f, -0.36 * f), id, paint, 0.03]); });
WESTROW.forEach(([x, z]) => { const [id, paint] = pick(); RAADI_CARS.push([x, z, yawOf(0.91, 0.42), id, paint, 0.03]); });

// ---------------------------------------------------------------- the painted walls
const C = { glass: '#3f4b58', trim: '#f2f1ec', dark: '#2f3136' };
const modern = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: C.dark, glass: C.glass, sill: 0.04, w: 1.4, pitch: 3.1, ...o });
const SPEC = {
  annex: { kind: 'wood', upright: true, pitch: 0.4, wall: [44, 46, 51], trim: '#9a9ca0', weather: 0.1, plinth: { h: 0.2, col: '#55575c' }, floors: [], attic: null, eaves: 0.18 },
  't9-2': { kind: 'plaster', wall: [238, 238, 232], trim: '#f4f4f0', weather: 0.12, plinth: { h: 0.35, col: '#6f7276' }, win: modern(), storey: 2.9, maxFloors: 2, attic: null, door: '#3a3c40', unit: 6.1 },
  't9-1': { kind: 'plaster', wall: [238, 238, 232], trim: '#f4f4f0', weather: 0.12, plinth: { h: 0.35, col: '#6f7276' }, win: modern(), storey: 2.9, maxFloors: 2, attic: null, door: '#3a3c40', unit: 6.1 },
  't7-1': { kind: 'wood', upright: true, pitch: 0.12, wall: [62, 56, 52], trim: '#2c2a29', weather: 0.15, plinth: { h: 0.3, col: '#4a4a4c' }, win: modern({ frame: '#1f2023' }), storey: 2.9, maxFloors: 2, attic: null, door: '#c96a26', niche: '#d27a2e', unit: 6.0 },
  't7-2': { kind: 'wood', upright: true, pitch: 0.12, wall: [62, 56, 52], trim: '#2c2a29', weather: 0.15, plinth: { h: 0.3, col: '#4a4a4c' }, win: modern({ frame: '#1f2023' }), storey: 2.9, maxFloors: 2, attic: null, door: '#c96a26', niche: '#d27a2e', unit: 6.0 },
  't5-1': { kind: 'wood', upright: true, pitch: 0.12, wall: [172, 166, 142], trim: '#3a3b3f', weather: 0.15, plinth: { h: 0.3, col: '#55575c' }, win: modern({ frame: '#2c2d31' }), storey: 2.9, maxFloors: 2, attic: null, door: '#d6a62a', niche: '#e0b232', unit: 6.0 },
  't5-2': { kind: 'wood', upright: true, pitch: 0.12, wall: [172, 166, 142], trim: '#3a3b3f', weather: 0.15, plinth: { h: 0.3, col: '#55575c' }, win: modern({ frame: '#2c2d31' }), storey: 2.9, maxFloors: 2, attic: null, door: '#d6a62a', niche: '#e0b232', unit: 6.0 },
};
const facing = (W, p) => { const tx = p[0] - W.mid[0], tz = p[1] - W.mid[1]; return (tx * W.nx + tz * W.nz) / (Math.hypot(tx, tz) || 1); };

// Foxway: ribbed navy cladding all round; the front over the car park has the name and the glass entrance
function foxwayHouse(world) {
  const [name, base, at, r] = HOUSES[0];
  const planes = wallPlanes(world, SEC, base, (x, z) => (x - at[0]) ** 2 + (z - at[1]) ** 2 < r * r);
  const clad = (P, W) => {
    P.r(0, P.y0, W.len, P.y1, '#30364a');
    for (let x = 0.3; x < W.len; x += 0.6) P.r(x, P.y0, x + 0.06, P.y1, '#272c3c');
    P.r(0, P.y0, W.len, 0.35, '#3a3d44');
    P.r(0, W.peak - 0.35, W.len, W.peak, '#3a3d44');
  };
  const walls = planes.map((W) => {
    const front = facing(W, [2378, -430]) > 0.8 && W.len > 30;
    return { near: W.mid, within: 0.4, only: (P) => {
      clad(P, W);
      if (!front) {
        if (W.len > 30) for (let x = 6; x < W.len - 6; x += 18) P.r(x, 0.35, x + 4.2, 4.6, '#3b3e46');      // loading doors
        return;
      }
      // the name and the mark near the west end, high up
      P.text('Foxway', 13.5, 9.4, 3.2, '#ffffff', '700 %px Arial, sans-serif', 'left');
      P.line(8.6, 8.2, 11.4, 11.0, '#ffffff', 0.55); P.line(8.6, 11.0, 11.4, 8.2, '#ffffff', 0.55);
      // the glass entrance block: two storeys of glazing with mullions
      const g0 = W.len * 0.52, g1 = W.len * 0.74;
      P.r(g0, 0.35, g1, 8.2, '#4a5a6c');
      for (let x = g0; x <= g1; x += 1.5) P.r(x - 0.05, 0.35, x + 0.05, 8.2, '#1c1e24');
      for (const y of [3.4, 4.0, 8.0]) P.r(g0, y, g1, y + 0.12, '#1c1e24');
      P.r(g0 + 4, 0.35, g0 + 6.2, 2.6, '#6c7c8e');                                                    // the doors
      // a band of office windows on the other side
      for (let x = g1 + 2; x < W.len - 3; x += 3.2) P.r(x, 4.4, x + 2.4, 6.2, '#4a5a6c');
    } };
  });
  return { name, sec: SEC, base, at, r, spec: { wall: [36, 40, 54], floors: [], attic: null, eaves: false }, walls };
}

// a terrace: the long walls towards its car park get a door per home (in a coloured niche where it has one)
function terrace(world, H) {
  const [name, base, at, r, , , front] = H, spec = SPEC[name];
  const planes = wallPlanes(world, SEC, base, (x, z) => (x - at[0]) ** 2 + (z - at[1]) ** 2 < r * r);
  const walls = [];
  for (const W of planes) {
    if (W.len < 5.5 || W.foot > 1.2 || facing(W, front) < 0.5) continue;
    const n = Math.max(1, Math.round(W.len / spec.unit)), u = W.len / n, doors = [];
    for (let k = 0; k < n; k++) doors.push({ x: u * k + u * 0.28, w: 1.0, h: 2.2, col: spec.door, frame: spec.trim, light: 0.2, panels: 1 });
    const xs = []; for (let k = 0; k < n; k++) xs.push(u * k + u * 0.72);
    walls.push({ near: W.mid, within: 0.4, doors, xs, draw: spec.niche ? (P) => { for (let k = 0; k < n; k++) { const x = u * k + u * 0.28; P.r(x - 0.95, 0, x - 0.6, 2.7, spec.niche); P.r(x + 0.6, 0, x + 0.95, 2.7, spec.niche); P.r(x - 0.95, 2.45, x + 0.95, 2.7, spec.niche); } } : null });
  }
  return { name, sec: SEC, base, at, r, spec, walls };
}

// ---------------------------------------------------------------- the build
export function createRaadi(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addTrees([...TREES, ...ROWS]);
  let built = false;
  const CENTRE = [2200, -420];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const near = (W) => facing(W, [2240, -433]) > -2;
    const houses = [foxwayHouse(world), { name: 'annex', sec: SEC, base: 2024, at: HOUSES[1][2], r: 18, spec: SPEC.annex }, ...HOUSES.slice(2).map((H) => terrace(world, H))];
    skinHouses(world, group, houses, { label: 'raadi fronts', faces: near, shadows, ppm: 14, far: 7, debug: DEBUG });

    // bay lines where the photos show them (the ground under the car parks is the map's own)
    const lines = (F, s0, n, v0, v1) => { for (let k = 0; k <= n; k++) { const s = s0 + k * 2.6; A.pave(F, s - 0.06, s + 0.06, Math.min(v0, v1), Math.max(v0, v1), 'white'); } };
    lines(FOXLOT, 5, 14, 0.9, 5.7); lines(FOXLOT, 56, 8, 0.9, 5.7); lines(FOXLOT, 4, 29, 13.2, 18);
    lines(LOT9, 3, 26, -1.2, -5.9); lines(LOT9, 3, 26, -13.6, -18.4);
    // three flags by the Foxway entrance, and the white kiosk at the car park's corner
    for (let k = 0; k < 3; k++) {
      const [x, z] = FOXLOT.at(40 + k * 2.2, 21);
      p.add(new THREE.CylinderGeometry(0.05, 0.07, 9, 8), 0xe8e8ea, x, h(x, z) + 4.5, z);
      p.box(0.03, 1.2, 1.9, [0xffffff, 0x2c4f9e, 0x2b2b2b][k], x + FOXLOT.U[0] * 0.95, h(x, z) + 8.2, z + FOXLOT.U[1] * 0.95, Math.atan2(-FOXLOT.U[1], FOXLOT.U[0]) + Math.PI / 2);
    }
    A.box(FOXLOT, 4, 22, 2.6, 2.2, 0, 2.4, 0xeeeeea);
    // the playground by 9/2: a sand ring with a play tower
    const [px, pz] = [2099, -406];
    p.add(new THREE.CylinderGeometry(5.5, 5.5, 0.06, 28), 0xc9b48c, px, h(px, pz) + 0.03, pz);
    const FP = frame([px, pz], [1, 0]);
    A.box(FP, 0, 0, 2.2, 2.2, 1.2, 1.3, 0x9a7a5a); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) A.box(FP, a, b, 0.12, 0.12, 0, 2.6, 0x8a6b4e);
    p.add(new THREE.ConeGeometry(1.7, 1.2, 4).rotateY(Math.PI / 4), 0x3d6f9a, px, h(px, pz) + 3.2, pz);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 300) return;
      if ([[2066, -386], [2165, -405], [2335, -478], [2271, -370]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
