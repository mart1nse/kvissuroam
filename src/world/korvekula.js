// Kõrveküla, the south approach (Martin, 20 Nov: a purple outline on a map from the Rähni tn corner across
// the highway and up road 210 to the village centre), dressed from the Land Board's oblique air photos
// (2023 and 2024, all four directions) and the 10 cm orthophoto. There were no street photos of it.
//  - The three new houses by the gravel lane south of the highway (Rähni 2 and its garage, Rähni 4 and the
//    house south of it): painted walls (Rähni 2 tan below and white above, the other two white), their roof
//    colours, paved drives, the thuja hedges between the gardens and along the cycle path, the black bar
//    fences and gates to the lane, a greenhouse, a trampoline and the cars on the drives.
//  - Where road 210 meets the highway: the long red paved island in the mouth of 210, the steel guard rails
//    round the corner and along both sides of the highway over the underpass, the young spruce planting
//    between 210 and the cycle path.
//  - The village centre: Vasula tee 3 (the pale yellow house with the brown tiled roof, its long shed, the
//    garden pavilion, two greenhouses and a swing), Pärna 1 (the three-storey cream block with the brown roof
//    and the cars outside it), the red island with black bollards between road 210 and the bus bay.
// What the photos do not show sharply (window panes, doors, the backs) is guessed. No street name is painted
// on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { frame, areaKit } from './handbuilt.js';

// ---------------------------------------------------------------- frames
// the three gardens by the lane: s along the lane to the north, v east into the gardens
const RAH = frame([3462, -1300], [-0.454, -0.891]);
// the lots' own lines run a little off the houses' walls: along them, east from the lane
const LOT = [0.935, -0.355];
const lot = (O) => frame(O, LOT);
const CENTRE = [3560, -1450];

// ---------------------------------------------------------------- road 210's mouth at the highway
// The map draws road 210 (Kõrveküla-Lähte tee) as one straight 11.6 m road right down to the highway, with
// four-lane lines. In the photos it is a two-lane road that forks about 35 m before the highway: the left
// branch runs straight on to the highway, the right one sweeps round to the east inside the guard rail, and a
// red island lies between them (the white hatching before it is paint). Here the map's line is cut at the
// fork and the two branches are added, the auto lane lines are kept off the fork, and road 210 north of it
// gets one dashed centre line where the photos have it.
const FORK = [3640.2, -1458.0];
export function korveRoads(vectors) {
  const roads = vectors.roads;
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5;
  const i = roads.findIndex((r) => r.name === 'Kõrveküla-Lähte tee' && r.pts.length === 2 &&
    ((near(r.pts[0], [3651.5, -1417.6]) && near(r.pts[1], [3626.1, -1505.4])) || (near(r.pts[1], [3651.5, -1417.6]) && near(r.pts[0], [3626.1, -1505.4]))));
  if (i < 0) return;
  const r = roads[i];
  roads[i] = { ...r, w: 11.4, mark: -1.4, pts: [FORK, [3626.1, -1505.4]] };
  roads.push({ ...r, w: 6.0, mark: 0, pts: [FORK, [3639.4, -1448.0], [3639.4, -1438.0], [3640.6, -1424.0]] });                 // the left branch
  roads.push({ ...r, w: 6.5, mark: 0, pts: [[3641.0, -1458.0], [3644.6, -1451.5], [3648.0, -1446.0], [3651.5, -1441.0], [3656.0, -1437.2],
    [3662.0, -1434.0], [3669.0, -1431.6], [3676.0, -1430.0]] });                                                              // the sweep to the east
  // the rest of road 210 up to the village is a two-lane road too: one dashed centre line
  for (const q of roads) if (q !== roads[i] && q.name === 'Kõrveküla-Lähte tee' && q.w >= 11.5 && q.pts.every((p) => p[0] > 3560 && p[0] < 3660 && p[1] > -1700 && p[1] < -1400)) q.w = 11.4;
  // the left branch flares out to the west for the turn onto the highway
  vectors.overPaint = [...(vectors.overPaint || []), { cover: '#ff0', outer: [[3636.6, -1440], [3635.5, -1433], [3632.5, -1427.5], [3628, -1423.5], [3622, -1419.5], [3622, -1416], [3640, -1416], [3640, -1440]] },
    // and between the island and the sweep it is all tarmac down to the highway
    { cover: '#ff0', outer: [[3645.3, -1441], [3650, -1439.5], [3656, -1435.5], [3664, -1432], [3672, -1430], [3672, -1426], [3648.6, -1426]] }];
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => (x > 3630 && x < 3685 && z > -1462 && z < -1426) || (prev ? prev(x, z) : false);
}

// ---------------------------------------------------------------- what the map's own data needs
export function korveWalls(walls) {
  setHouseColours(walls, '6_-1', 3040, -1440, [
    { base: 1821, x: 3496.0, z: -1301.3, wall: 0xa38f63, roof: 0x4a4547 },    // Rähni 2
    { base: 1829, x: 3483.9, z: -1286.3, wall: 0xa38f63, roof: 0x4a4547 },    // its garage
    { base: 1852, x: 3507.6, z: -1275.6, wall: 0xeeeeea, roof: 0x5e6772 },    // Rähni 4
    { base: 1853, x: 3511.1, z: -1247.2, wall: 0xedecea, roof: 0x4b4c52 },    // the house south of it
  ]);
  setHouseColours(walls, '6_-2', 3040, -2080, [
    { base: 2037, x: 3628.4, z: -1604.7, wall: 0xeadfb4, roof: 0x6e4a3c },    // Vasula tee 3
    { base: 1988, x: 3622.2, z: -1581.0, wall: 0xe6dcb8, roof: 0x8d8f94 },    // its long shed
    { base: 1992, x: 3611.8, z: -1587.5, wall: 0x9b8a72, roof: 0x6a6a6e },    // the little shed
    { base: 2173, x: 3622.7, z: -1662.2, wall: 0xe8dcb6, roof: 0x7a5548 },    // Pärna 1
  ]);
}

// Parked cars for src/world/parked.js: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw))
const IN = Math.atan2(LOT[0], -LOT[1]);          // nose into the gardens, to the east
export const KORVE_CARS = [
  [3475.0, -1284.6, IN, 'rav4', 'black', 0.04],          // before Rähni 2's garage
  [3494.6, -1275.2, IN, 'passat', 'silver', 0.04],       // on Rähni 4's drive
  [3496.0, -1248.2, IN, 'model3', 'black', 0.04],        // two on the drive of the house south of it
  [3499.6, -1243.0, IN, 'mazda6', 'black', 0.04],
  [3615.7, -1640.6, 0, 'passat', 'grey', 0.03],          // outside Pärna 1, noses to the house
  [3622.9, -1640.4, 0, 'rav4', 'white', 0.03],
];

// ---------------------------------------------------------------- the painted walls
const C = { white: [238, 238, 234], tan: [163, 143, 99], yellow: [234, 223, 180], cream: [232, 220, 182], glass: '#46525f' };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: '#f3f2ee', weather: 0.25, ...o });
const modern = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: '#3d4045', glass: C.glass, sill: 0.05, ...o });
// two up-and-over garage doors
const garageDoors = (P, W) => {
  for (const x of [W.len * 0.27, W.len * 0.73]) {
    P.r(x - 1.25, 0, x + 1.25, 2.2, '#5a5550');
    for (let y = 0.2; y < 2.1; y += 0.3) P.r(x - 1.2, y, x + 1.2, y + 0.04, '#46423e');
  }
};
function houses() {
  return [
    // ---- the lane south of the highway
    { name: 'rahni2', sec: '6_-1', base: 1821, at: [3496, -1301.3], r: 14,
      spec: plaster(C.tan, { storey: 2.9, maxFloors: 2, plinth: { h: 0.45, col: '#6f6a62' }, upper: { kind: 'plaster', wall: C.white, from: 3.05 }, belts: [2.95], win: modern({ w: 1.3, pitch: 3.0 }), attic: null }),
      walls: [{ near: [3490.5, -1299], within: 4, doors: [{ x: 4.0, w: 1.1, h: 2.2, col: '#3f3a36', light: 0.4, panels: 1 }] }] },
    { name: 'rahni2garage', sec: '6_-1', base: 1829, at: [3483.9, -1286.3], r: 9,
      spec: plaster(C.tan, { storey: 2.8, maxFloors: 1, plinth: { h: 0.35, col: '#6f6a62' }, win: modern({ w: 1.0, pitch: 3.4 }), attic: null }),
      walls: [{ near: [3479, -1284], within: 3, n: 0, xs: [], only: null, draw: garageDoors, floors: [] }] },
    { name: 'rahni4', sec: '6_-1', base: 1852, at: [3507.6, -1275.6], r: 12,
      spec: plaster(C.white, { storey: 2.9, maxFloors: 2, plinth: { h: 0.4, col: '#8c8b88' }, win: modern({ w: 1.3, pitch: 2.8 }), attic: null }),
      walls: [{ near: [3502.5, -1273], within: 4, doors: [{ x: 3.0, w: 1.0, h: 2.2, col: '#3a3c40', light: 0, panels: 1 }] }] },
    { name: 'rahni6', sec: '6_-1', base: 1853, at: [3511.1, -1247.2], r: 15,
      spec: plaster(C.white, { storey: 3.0, maxFloors: 1, plinth: { h: 0.4, col: '#8c8b88' }, win: modern({ w: 1.4, pitch: 3.0 }), attic: null }),
      walls: [{ near: [3506, -1244.5], within: 5, doors: [{ x: 9.0, w: 1.0, h: 2.2, col: '#3a3c40', light: 0, panels: 1 }] }] },
    // ---- the village centre
    { name: 'vasula3', sec: '6_-2', base: 2037, at: [3628.4, -1604.7], r: 12,
      spec: plaster(C.yellow, { storey: 3.0, maxFloors: 1, plinth: { h: 0.55, col: '#8f8a82' }, win: { w: 1.2, pitch: 2.8, T: true, surround: 0.08, sc: '#f6f3ea', frame: '#f6f3ea', glass: C.glass }, attic: { w: 0.9, h: 1.1 } }),
      walls: [{ near: [3628.5, -1596], within: 4, doors: [{ x: 3.4, w: 1.0, h: 2.1, col: '#6a4b3a', steps: 2 }] }] },
    { name: 'vasula3shed', sec: '6_-2', base: 1988, at: [3622.2, -1581], r: 8,
      spec: plaster([230, 220, 184], { storey: 2.4, maxFloors: 1, plinth: { h: 0.3, col: '#8f8a82' }, win: { w: 0.8, pitch: 3.5, T: false, frame: '#f2efe6', glass: C.glass }, attic: null }),
      walls: [{ near: [3622.5, -1578], within: 3, doors: [{ x: 2.0, w: 1.0, h: 1.95, col: '#7a6a58', light: 0 }, { x: 7.5, w: 2.4, h: 2.0, col: '#7a6a58', light: 0, panels: 1 }] }] },
    { name: 'vasula3hut', sec: '6_-2', base: 1992, at: [3611.8, -1587.5], r: 6,
      spec: { kind: 'wood', wall: [150, 132, 108], pitch: 0.16, upright: true, trim: '#e8e2d4', plinth: { h: 0.2, col: '#77736d' }, win: { w: 0.7, pitch: 4, T: false }, attic: null } },
    { name: 'parna1', sec: '6_-2', base: 2173, at: [3622.7, -1662.2], r: 20,
      spec: plaster(C.cream, { storey: 2.9, maxFloors: 3, plinth: { h: 0.7, col: '#9a948a', vents: 3.1 }, win: { w: 1.2, pitch: 3.0, T: false, bars: 1, surround: 0.06, sc: '#f2ede0', frame: '#f4f2ec', glass: C.glass }, weather: 0.45 }),
      walls: [{ near: [3617.5, -1662.5], within: 4, doors: [{ x: 9.0, w: 1.3, h: 2.3, col: '#5e4d40', steps: 2, canopy: '#7a5548' }, { x: 25.0, w: 1.3, h: 2.3, col: '#5e4d40', steps: 2, canopy: '#7a5548' }] }] },
  ];
}

// ---------------------------------------------------------------- the build
export function createKorvekula(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // the young spruces planted in rows between road 210 and the cycle path, north of the highway
  const plant = [];
  for (let z = -1503; z < -1462; z += 2.9) {
    const xa = 3633.5 + (z + 1505) * 0.17, xb = 3649.5 + (z + 1505) * 0.37;
    for (let x = xa + ((z * 7) % 1.4 + 1.4) % 1.4; x < xb; x += 2.8) plant.push([x, z, 1.9 + ((x * 13 + z * 7) % 1.3 + 1.3) % 1.3, 1.1, 1]);
  }
  world.addTrees(plant);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const faces = (W) => Math.abs(W.nx) + Math.abs(W.nz) > 0;
    skinHouses(world, group, houses(), { faces, shadows, ppm: 24, far: 12 });

    // ================= the lane south of the highway =================
    // the lawns of the three gardens
    A.pave(lot([3463.5, -1316.5]), 1, 72, 0.5, 38.6, 'lawn');
    A.pave(lot([3478.6, -1278.4]), 1, 72, 0.5, 17.6, 'lawn');
    A.pave(lot([3481.8, -1261.4]), 1, 74, 0.5, 30, 'lawn');
    // drives and yards
    A.pave(lot([3470.5, -1288.5]), 0, 9.5, -2.5, 5.5, 'pavers');                 // before the garage
    A.pave(lot([3481.0, -1292.0]), 0, 20, -1.5, 4.8, 'pavers');                 // between the garage and the house
    A.pave(lot([3476.6, -1272.4]), 0, 21, -0.5, 6.2, 'pavers');                 // Rähni 4's drive
    A.pave(frame([3489, -1251.5], [1, 0]), 0, 15.5, 0, 14, 'pavers');          // two cars' width south of it
    A.pave(lot([3503.5, -1291.0]), 0, 6, -1.5, 6.5, 'slabs');                    // terraces behind the houses
    A.pave(lot([3513.5, -1278.6]), 0, 4, -0.5, 7.5, 'slabs');
    A.pave(lot([3519.0, -1250.0]), 0, 4, 0, 9.5, 'slabs');
    // the hedges: along the cycle path, between the gardens and at the south end
    A.hedge([[3463, -1318], [3500, -1332], [3542, -1347]], 1.8, 1.0);
    A.hedge([[3478, -1279.6], [3510, -1291.8], [3548, -1306.2]], 2.1, 0.9);
    A.hedge([[3481, -1262.5], [3515, -1275.4], [3552, -1289.4]], 2.1, 0.9);
    A.hedge([[3492, -1233], [3525, -1245.5], [3560, -1258.8]], 1.9, 0.9);
    // the black bar fence along the lane, open at the drives, the gate leaves pushed aside
    const fence = [[3461.8, -1316.5], [3465.6, -1302.8], [3468.4, -1292.4], [3470.4, -1284.8], [3474.4, -1271.6], [3476.2, -1265.2], [3480.0, -1255.0], [3484.0, -1243.6], [3488.6, -1233.5]];
    for (const [a, b] of [[0, 1], [1, 2], [3, 4], [5, 6], [7, 8]]) A.gate(fence[a], fence[b], 1.15, 0x2c2e33);
    A.gate([3468.6, -1291.4], [3469.8, -1287], 1.4, 0x2c2e33);                  // the sliding gates, slid open
    A.gate([3474.6, -1270.8], [3475.6, -1266.8], 1.4, 0x2c2e33);
    A.gate([3480.4, -1253.8], [3482.4, -1248.6], 1.4, 0x2c2e33);
    A.greenhouse(lot([3522.4, -1298.5]), 2, 1.6, 4.2, 2.8, 2.3);                 // Rähni 2's glasshouse
    A.trampoline(3527.0, -1275.0, 1.8);                                         // in Rähni 4's garden
    // the rockery beds before Rähni 2, low shrubs on gravel
    A.pave(lot([3468.8, -1309.0]), 2, 14, 1, 7, 'gravel');
    A.bushes([[3473, -1307, 1.2, 0.8], [3476.5, -1305, 0.9, 1.1, [0.5, 0.74, 0.56]], [3471, -1302.5, 1.0, 0.7], [3479, -1309.5, 1.3, 0.9],
      [3482, -1304.2, 0.8, 1.4, [0.5, 0.74, 0.56]], [3517, -1312, 1.6, 1.0], [3520, -1309, 1.2, 1.5, [0.5, 0.74, 0.56]], [3523.5, -1313, 1.4, 0.9]]);

    // ================= where road 210 meets the highway =================
    A.island([[3643.1, -1445.8], [3645.6, -1436.4], [3648.1, -1427.2]], 1.0, 'red');
    // the paint at the fork (the map's own lines are kept off it): the hatched wedge before the island, its two
    // edge lines meeting at the fork, and the give-way teeth across both branches at the highway
    {
      const tip = [3640.8, -1456.0], top = [3643.1, -1445.8];
      const ax = [top[0] - tip[0], top[1] - tip[1]], L = Math.hypot(ax[0], ax[1]), U = [ax[0] / L, ax[1] / L];
      const W = frame(tip, U);
      for (const side of [-1, 1]) {                                     // the two edge lines of the wedge
        const end = W.at(L, side * 1.05), d = [end[0] - tip[0], end[1] - tip[1]], l = Math.hypot(d[0], d[1]);
        A.pave(frame(tip, [d[0] / l, d[1] / l]), 0, l, -0.07, 0.07, 'white');
      }
      for (const s of [2.6, 4.9, 7.2, 9.4]) A.pave(W, s, s + 0.5, -1.0 * s / L, 1.0 * s / L, 'white');   // the bars
      const teeth = (a, b) => {                                       // a row of white triangles' bases, 0.5 m every 0.9 m
        const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]), F = frame(a, [d[0] / l, d[1] / l]);
        for (let s = 0.2; s + 0.5 <= l; s += 0.9) A.pave(F, s, s + 0.5, -0.3, 0.3, 'white');
      };
      teeth([3636.8, -1425.4], [3642.4, -1426.2]);                     // the left branch, at the highway
    }
    A.guardrail([[3638.6, -1480.0], [3640.0, -1470.0], [3642.0, -1462.0], [3645.6, -1457.0], [3650.4, -1452.0], [3654.8, -1446.0], [3659.4, -1440.4], [3664.8, -1436.8], [3670.8, -1435.4], [3676.5, -1435.2], [3684.0, -1436.6], [3700.0, -1441.6], [3740.0, -1455.0]]);
    A.guardrail([[3655.0, -1412.6], [3680.0, -1420.6], [3700.0, -1425.8], [3740.0, -1439.2]]);

    // ================= the village centre =================
    // the island between road 210 and the bus bay, red paving and black bollards
    const isl = [[3567.6, -1671.0], [3571.4, -1655.0], [3576.6, -1636.0], [3582.4, -1619.0], [3585.2, -1612.0]];
    A.island(isl, 1.0, 'red');
    A.walk(isl, 5.2, ([x, z]) => A.bollard(x, z));
    // Vasula tee 3's garden
    const V3 = frame([3640, -1600], [1, 0]);
    A.gazebo(3652.9, -1594.3, 1.5, 0xece9e2, 0x5f5f66);
    A.greenhouse(V3, 18.0, 9.0, 5.0, 2.6, 2.4);
    A.greenhouse(V3, 23.5, 8.0, 3.6, 2.4, 2.2);
    A.swing(V3, 0.7, 18.0, 2.4);
    A.hedge([[3608.0, -1609.0], [3607.6, -1600.0], [3607.2, -1594.0]], 1.0, 0.8, [0.62, 0.8, 0.58]);
    A.pave(frame([3601.5, -1612.0], [1, 0]), 0, 21, -1.6, 1.6, 'pavers');        // the drive from road 210 to the house
    A.pave(frame([3612.0, -1644.0], [1, 0]), 0, 16, 0, 7.5, 'tarmac');           // the parking outside Pärna 1
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 520) return;
      if ([[3496, -1290], [3640, -1440], [3620, -1640], [3510, -1250]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
