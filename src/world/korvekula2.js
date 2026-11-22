// Kõrveküla, the north outline, part one (Martin, 20 Nov): the Põhikool by road 210 and the houses round the
// Kooli tn and Hariduse tn corners, dressed from the Land Board's oblique air photos (2023, 2024) and the
// orthophoto. The map's own blocks keep their shapes; their walls are painted and their roofs coloured:
//  - the school: the light concrete sports hall with its tall slit windows, the new wing in brown-grey brick
//    with its rows of windows and the name over the door, the old middle in white render under dark roofs,
//    the pale blue block facing road 210;
//  - Kooli 2 (the white house with the grey roof, its barns) and Kooli 4 (the old board house and its shed);
//  - Vasula tee 23 (pale yellow, dark hipped roof), 25 (the dark red board house and its red-roofed barns),
//    27 (the grey-white house with the dormers);
//  - Hariduse 1 (the long barn on the corner), Hariduse 2 (the white two-storey block with the dark roof),
//    2a (the long low sheds), Hariduse 3 (the long white house with the dark roof, its deck and shed).
// Hedges along Kooli tn and Hariduse tn, a car in the yard. Doors, window layouts and the backs are guessed.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { frame, areaKit } from './handbuilt.js';

const CENTRE = [3620, -2120];

// ---------------------------------------------------------------- what the map's own data needs
export function korve2Walls(walls) {
  setHouseColours(walls, '6_-3', 3040, -2720, [
    { base: 2159, x: 3517.6, z: -2165.0, wall: 0xd8d9da, roof: 0xc2c4c7, reach: 40 },   // the sports hall
    { base: 2159, x: 3572.0, z: -2112.0, wall: 0x7d6c61, roof: 0xb4b6b9, reach: 26 },   // the new wing
    { base: 2159, x: 3578.0, z: -2158.0, wall: 0xe8e6e1, roof: 0x55585e, reach: 18 },   // the old middle
    { base: 2159, x: 3618.0, z: -2154.0, wall: 0xb9c6d6, roof: 0x5f636a, reach: 16 },   // the pale blue front block
    { base: 2270, x: 3651.9, z: -2090.7, wall: 0x7f2a26, roof: 0xa4483d },             // Vasula tee 25
    { base: 2304, x: 3656.5, z: -2103.2, wall: 0xe9e6de, roof: 0xa4483d },             // its little shed
    { base: 2309, x: 3671.4, z: -2102.1, wall: 0x6f4f3d, roof: 0xa4483d },             // its barn
    { base: 2345, x: 3660.1, z: -2122.9, wall: 0xdfe1e2, roof: 0x666a71 },             // Vasula tee 27
    { base: 2377, x: 3676.1, z: -2133.8, wall: 0xe4e0d6, roof: 0x9b9fa4 },             // Hariduse 1, the barn
    { base: 2377, x: 3677.0, z: -2174.0, wall: 0xedebe5, roof: 0x4d4949, reach: 20 },  // Hariduse 2
  ]);
  setHouseColours(walls, '7_-3', 3680, -2720, [
    { base: 2315, x: 3687.9, z: -2100.6, wall: 0x7a6656, roof: 0x7d7470 },             // Vasula tee 25's back barn
    { base: 2335, x: 3681.8, z: -2117.8, wall: 0x8a7663, roof: 0x77787c },             // Vasula tee 27's shed
    { base: 2342, x: 3689.5, z: -2199.2, wall: 0xe6e3dc, roof: 0x58585c },             // Hariduse 2a
    { base: 2428, x: 3705.5, z: -2126.1, wall: 0xeeeeea, roof: 0x3f4044 },             // Hariduse 3
  ]);
  setHouseColours(walls, '6_-2', 3040, -2080, [
    { base: 2179, x: 3593.6, z: -2061.0, wall: 0xecebe6, roof: 0x8f9297 },             // Kooli 2
    { base: 2143, x: 3575.1, z: -2066.6, wall: 0x857462, roof: 0x8e9093 },             // its barns
    { base: 2139, x: 3580.0, z: -2057.7, wall: 0x857462, roof: 0x8e9093, reach: 8 },
    { base: 2105, x: 3570.6, z: -2054.7, wall: 0x7d6d5c, roof: 0x8e9093 },
    { base: 2004, x: 3518.7, z: -2054.0, wall: 0xdedbd2, roof: 0x8a8c90 },             // Kooli 4
    { base: 2038, x: 3533.4, z: -2057.7, wall: 0x7c6a58, roof: 0x77787c },             // its shed
    { base: 2215, x: 3640.0, z: -2064.4, wall: 0xece2b8, roof: 0x4d4b50 },             // Vasula tee 23
    { base: 2251, x: 3659.9, z: -2073.8, wall: 0x8c8a86, roof: 0x77787c },             // its shed
  ]);
}

export const KORVE2_CARS = [
  [3686.9, -2124.0, Math.PI, 'passat', 'silver', 0.03],     // in the yard by Hariduse 1's barn
  [3720.0, -2133.0, -Math.PI / 2, 'rav4', 'grey', 0.03],    // by Hariduse 3
];

// ---------------------------------------------------------------- the painted walls
const C = { glass: '#46525f', white: [236, 235, 230] };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: '#f3f2ee', weather: 0.35, ...o });
const boards = (wall, o = {}) => ({ kind: 'wood', wall, pitch: 0.15, trim: '#f1eee6', weather: 0.35, ...o });
const dark = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: '#3b3d42', glass: C.glass, sill: 0.05, ...o });
const old = (o = {}) => ({ w: 1.0, pitch: 2.5, T: true, surround: 0.09, sc: '#f4f1ea', frame: '#f4f1ea', glass: C.glass, ...o });
const SCHOOL = (x, z, r, pick, spec, walls) => ({ sec: '6_-3', base: 2159, at: [x, z], r, pick, spec, walls });
// the sports hall: big light concrete panels, tall narrow windows in pairs
function hall(P, W) {
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#d8d9da');
  for (let x = 0; x < len; x += 6) P.r(x, P.y0, x + 0.03, P.y1, '#b9babd');
  for (let y = 3; y < P.y1; y += 3) P.r(0, y, len, y + 0.03, '#c3c4c6');
  if (W.front && len > 20) for (let x = 4; x < len - 3; x += 7.5) for (const d of [0, 0.9]) P.r(x + d, 0.8, x + d + 0.45, Math.min(P.y1 - 1.2, 7.5), '#3c4550');
  P.r(0, P.y0, len, 0.35, '#a7a8aa');
  P.weather(0, P.y0, len, P.y1, 0.35, 5);
}
// the new wing: brown-grey brick with windows in bands
function wing(P, W) {
  const len = W.len;
  P.brick(0, P.y0, len, P.y1, [125, 108, 97], 21);
  const top = W.eaves;
  for (let y = 0.9; y + 1.6 < top - 0.4; y += 3.4) {
    for (let x = 1.2; x + 1.6 < len - 0.6; x += 2.6) P.win(x, y, x + 1.6, y + 1.7, dark({ bars: 1 }));
  }
  P.r(0, top - 0.35, len, top, '#5d544e');
}

// the wall facing Kooli tn at the tip of the wing: the glazed entrance and the school's name over it
function entrance(P, W) {
  wing(P, W);
  const len = W.len, x0 = len * 0.52, x1 = len * 0.9;
  P.r(x0 - 0.2, 0, x1 + 0.2, 3.5, '#5d544e');
  P.r(x0, 0, x1, 3.3, '#3f4a56');
  for (let x = x0; x <= x1; x += 1.25) P.r(x - 0.04, 0, x + 0.04, 3.3, '#2c2f34');
  P.r(x0, 2.45, x1, 2.52, '#2c2f34');
  P.text('KÕRVEKÜLA PÕHIKOOL', (x0 + x1) / 2, 4.1, 0.62, '#f2f1ec');
}
function houses() {
  return [
    // ---- the school
    SCHOOL(3515, -2165, 40, (x, z) => x < 3543 && z < -2140, { only: true }, [{ near: [3515, -2165], within: 60, only: hall }]),
    SCHOOL(3570, -2112, 34, (x, z) => z > -2140 && x < 3612, { only: true }, [{ near: [3588.9, -2098.1], within: 2, only: entrance }, { near: [3570, -2112], within: 60, only: wing }]),
    SCHOOL(3578, -2158, 30, (x, z) => x >= 3543 && x < 3606 && z <= -2140,
      plaster([232, 230, 225], { storey: 3.4, maxFloors: 3, plinth: { h: 0.6, col: '#8f8d89' }, win: dark({ w: 1.6, pitch: 2.6, frame: '#e9e9e6' }), attic: null })),
    SCHOOL(3618, -2152, 22, (x, z) => x >= 3606 && z <= -2132,
      plaster([185, 198, 214], { storey: 3.4, maxFloors: 2, plinth: { h: 0.6, col: '#8f8d89' }, win: dark({ w: 1.5, pitch: 2.5, frame: '#f2f2f0' }), attic: null }),
      [{ near: [3628, -2150], within: 3, doors: [{ x: 15, w: 2.2, h: 2.6, col: '#3c4048', light: 0.5, panels: 1, steps: 2 }] }]),
    // ---- Kooli tn
    { name: 'kooli2', sec: '6_-2', base: 2179, at: [3593.6, -2061], r: 10,
      spec: plaster([236, 235, 230], { storey: 2.8, maxFloors: 1, plinth: { h: 0.6, col: '#8f8b85' }, win: old(), attic: { w: 0.9, h: 1.0 } }),
      walls: [{ near: [3598.2, -2065.2], within: 2, doors: [{ x: 3.2, w: 1.0, h: 2.1, col: '#6b4c3a', steps: 2 }] }] },
    { name: 'kooli2barn', sec: '6_-2', base: 2143, at: [3575.1, -2067], r: 9, spec: boards([133, 116, 98], { upright: true, plinth: { h: 0.3, col: '#77736d' }, win: old({ w: 0.8, pitch: 4 }), attic: null }) },
    { name: 'kooli2shed', sec: '6_-2', base: 2139, at: [3580, -2057.7], r: 6, spec: boards([133, 116, 98], { upright: true, plinth: { h: 0.3, col: '#77736d' }, win: old({ w: 0.8, pitch: 4 }), attic: null }) },
    { name: 'kooli2shed2', sec: '6_-2', base: 2105, at: [3570.6, -2054.7], r: 8, spec: boards([125, 109, 92], { upright: true, plinth: { h: 0.3, col: '#77736d' }, win: old({ w: 0.8, pitch: 4 }), attic: null }) },
    { name: 'kooli4', sec: '6_-2', base: 2004, at: [3518.7, -2054], r: 12,
      spec: boards([222, 219, 210], { plinth: { h: 0.55, type: 'rubble' }, win: old({ pitch: 2.3 }), attic: { w: 0.8, h: 0.9 } }),
      walls: [{ near: [3518.5, -2060.5], within: 4, doors: [{ x: 11.5, w: 0.95, h: 2.0, col: '#7a3b30', steps: 2 }] }] },
    { name: 'kooli4shed', sec: '6_-2', base: 2038, at: [3533.4, -2057.7], r: 6, spec: boards([124, 106, 88], { upright: true, plinth: { h: 0.25, col: '#77736d' }, win: old({ w: 0.7, pitch: 4 }), attic: null }) },
    // ---- road 210
    { name: 'vasula23', sec: '6_-2', base: 2215, at: [3640, -2064.4], r: 10,
      spec: plaster([236, 226, 184], { storey: 3.0, maxFloors: 1, plinth: { h: 0.6, col: '#8f8b85' }, win: old({ w: 1.2, pitch: 2.6 }), attic: { w: 1.0, h: 1.0 } }),
      walls: [{ near: [3636.6, -2064.8], within: 2, doors: [{ x: 3.5, w: 1.0, h: 2.1, col: '#5d4636', steps: 2, canopy: '#4d4b50' }] }] },
    { name: 'vasula23shed', sec: '6_-2', base: 2251, at: [3659.9, -2073.8], r: 7, spec: boards([140, 138, 134], { upright: true, plinth: { h: 0.25, col: '#77736d' }, win: old({ w: 0.7, pitch: 4 }), attic: null }) },
    { name: 'vasula25', sec: '6_-3', base: 2270, at: [3651.9, -2090.7], r: 10,
      spec: boards([127, 42, 38], { storey: 2.7, maxFloors: 2, trim: '#f2efe6', plinth: { h: 0.55, col: '#7f7a73' }, win: old({ w: 1.0, pitch: 2.3 }), attic: { w: 0.8, h: 1.0 } }),
      walls: [{ near: [3645.5, -2091], within: 3.5, doors: [{ x: 3.0, w: 0.95, h: 2.05, col: '#f0ece2', steps: 2 }] }] },
    { name: 'vasula25shed', sec: '6_-3', base: 2304, at: [3656.5, -2103.2], r: 5, spec: boards([233, 229, 220], { upright: true, plinth: { h: 0.2, col: '#77736d' }, win: old({ w: 0.6, pitch: 4 }), attic: null }) },
    { name: 'vasula25barn', sec: '6_-3', base: 2309, at: [3671.4, -2102.1], r: 12, spec: boards([111, 80, 62], { upright: true, plinth: { h: 0.3, col: '#77736d' }, win: old({ w: 0.7, pitch: 5 }), attic: null }) },
    { name: 'vasula25barn2', sec: '7_-3', base: 2315, at: [3687.9, -2100.6], r: 9, spec: boards([122, 102, 86], { upright: true, plinth: { h: 0.3, col: '#77736d' }, win: old({ w: 0.7, pitch: 5 }), attic: null }) },
    { name: 'vasula27', sec: '6_-3', base: 2345, at: [3660.1, -2122.9], r: 10,
      spec: boards([223, 225, 226], { storey: 2.7, maxFloors: 2, plinth: { h: 0.55, col: '#8f8b85' }, win: old({ w: 1.0, pitch: 2.3 }), attic: { w: 0.8, h: 0.9 } }),
      walls: [{ near: [3654.9, -2122.0], within: 1.5, doors: [{ x: 1.6, w: 0.95, h: 2.05, col: '#5b5f66', steps: 2 }] }] },
    { name: 'vasula27shed', sec: '7_-3', base: 2335, at: [3681.8, -2117.8], r: 7, spec: boards([138, 118, 99], { upright: true, plinth: { h: 0.25, col: '#77736d' }, win: old({ w: 0.7, pitch: 4 }), attic: null }) },
    // ---- Hariduse tn
    { name: 'hariduse1', sec: '6_-3', base: 2377, at: [3676.5, -2134], r: 9, pick: (x, z) => z > -2145,
      spec: boards([224, 220, 210], { upright: true, plinth: { h: 0.35, col: '#8a867f' }, win: old({ w: 0.8, pitch: 4.5 }), attic: null }),
      walls: [{ near: [3678, -2137.8], within: 4, n: 0, xs: [], floors: [], doors: [{ x: 3.5, w: 2.6, h: 2.4, col: '#7d6450', light: 0, panels: 1 }, { x: 9.5, w: 2.6, h: 2.4, col: '#7d6450', light: 0, panels: 1 }] }] },
    { name: 'hariduse2', sec: '6_-3', base: 2377, at: [3677, -2174], r: 22, pick: (x, z) => z < -2150,
      spec: plaster([237, 235, 229], { storey: 2.9, maxFloors: 2, plinth: { h: 0.65, col: '#8f8b85', vents: 3 }, win: old({ w: 1.2, pitch: 2.8, T: false, bars: 1 }) }),
      walls: [{ near: [3667.2, -2177], within: 5, doors: [{ x: 6.0, w: 1.2, h: 2.2, col: '#5b4a3e', steps: 2, canopy: '#4d4949' }, { x: 15.0, w: 1.2, h: 2.2, col: '#5b4a3e', steps: 2, canopy: '#4d4949' }] }] },
    { name: 'hariduse2a', sec: '7_-3', base: 2342, at: [3689.5, -2199.2], r: 16,
      spec: plaster([230, 227, 220], { storey: 2.6, maxFloors: 1, plinth: { h: 0.3, col: '#8a867f' }, win: old({ w: 0.8, pitch: 4 }), attic: null }) },
    { name: 'hariduse3', sec: '7_-3', base: 2428, at: [3705.5, -2126.1], r: 12,
      spec: plaster([238, 238, 234], { storey: 2.9, maxFloors: 1, plinth: { h: 0.45, col: '#7d7b78' }, win: dark({ w: 1.4, pitch: 2.8 }), attic: null }),
      walls: [{ near: [3705.8, -2131.1], within: 4, doors: [{ x: 11.5, w: 1.0, h: 2.2, col: '#3a3c40', light: 0, panels: 1 }] }] },
  ];
}

// ---------------------------------------------------------------- the build
export function createKorvekula2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const debug = /kdebug/.test(location.search);
    // the school's spec `only: true` means: every wall is painted by its wall entry
    const list = houses().map((H) => (H.spec.only ? { ...H, spec: { kind: 'plaster', wall: [200, 200, 200] } } : H));
    skinHouses(world, group, list, { label: 'korvekula2 fronts', shadows, ppm: 22, far: 12, debug });

    // the flag poles by the track
    for (const [x, z] of [[3600.0, -2186.0], [3604.0, -2186.5], [3608.0, -2187.0]]) {
      const y = world.heightAt(x, z);
      A.p.add(new THREE.CylinderGeometry(0.05, 0.07, 9, 10), 0xe9e9e6, x, y + 4.5, z);
    }
    // hedges: along Kooli tn before Kooli 2, along Hariduse tn by Vasula tee 27, round Vasula tee 23
    A.hedge([[3556, -2078.6], [3583, -2075.2], [3611, -2071.4]], 1.6, 0.9);
    A.hedge([[3654.5, -2138.4], [3668.0, -2138.0]], 1.5, 0.8);
    A.hedge([[3630.5, -2072.5], [3630.0, -2056.0]], 1.3, 0.8, [0.6, 0.8, 0.58]);
    // Hariduse 3's deck and its little white shed by the road
    const D = frame([3696.5, -2121.0], [1, 0]);
    A.box(D, 3.5, 2.2, 7.0, 4.4, -0.2, 0.32, 0x8a6a52);
    A.shed(frame([3728.6, -2126.7], [1, 0]), 0, 0, 3.4, 2.8, 2.3, 3.2, 0xeeeeea, 0x45464b);
    A.pave(frame([3682.0, -2128.5], [1, 0]), 0, 13, 0, 9, 'gravel');            // the yard between the barn and Hariduse 3
    // the vegetable field behind Kooli 4
    A.pave(frame([3539.0, -2038.0], [1, 0]), 0, 36, 0, 11.5, 'soil');
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if ([[3510, -2160], [3600, -2120], [3700, -2130], [3530, -2055], [3690, -2195]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
