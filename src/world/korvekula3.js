// Kõrveküla, the north outline, part two (Martin, 20 Nov): the flats round the Kubjaringi green and along
// Hariduse tn by the pond, dressed from the Land Board's oblique air photos (2023, 2024) and the orthophoto.
// The map's own blocks keep their shapes; their walls are painted and their roofs coloured:
//  - Kubjaringi 1 and 3: the two ochre two-storey blocks on the north side of the green, grey roofs, wooden
//    balconies facing the green, stair doors on the street side;
//  - Hariduse 4: the long white two-storey block with the dark brown roof;
//  - Hariduse 6: the pale yellow three-storey block by the pond, two stairs;
//  - Hariduse 7: the white house with the hall behind it, across the road;
//  - Kubjaringi 2 and 4: the white houses north of the street (the grey roof, the dark hipped roof).
// The play place in the middle of the green, its boulders, cars in the yards. Doors, window counts and the backs
// are guessed.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { frame, areaKit } from './handbuilt.js';

const CENTRE = [3730, -2210];

// ---------------------------------------------------------------- what the map's own data needs
export function korve3Walls(walls) {
  setHouseColours(walls, '7_-3', 3680, -2720, [
    { base: 2252, x: 3684.0, z: -2245.2, wall: 0xd9b968, roof: 0x8d969f, reach: 20 },  // Kubjaringi 1
    { base: 2242, x: 3727.9, z: -2247.4, wall: 0xd9b968, roof: 0x8d969f, reach: 20 },  // Kubjaringi 3
    { base: 2355, x: 3753.6, z: -2167.7, wall: 0xe6e3da, roof: 0x5a4d48, reach: 24 },  // Hariduse 4
    { base: 2331, x: 3776.5, z: -2209.0, wall: 0xebe5b5, roof: 0x8e949b, reach: 22 },  // Hariduse 6
    { base: 2228, x: 3798.3, z: -2112.7, wall: 0xeeeeea, roof: 0x5d6066, reach: 18 },  // Hariduse 7
    { base: 2237, x: 3686.1, z: -2292.8, wall: 0xedede8, roof: 0x5a5d63 },             // Kubjaringi 2
    { base: 2246, x: 3718.8, z: -2290.2, wall: 0xf0efea, roof: 0x3c3d42 },             // Kubjaringi 4
  ]);
}

export const KORVE3_CARS = [
  [3752.5, -2254.5, Math.PI / 2, 'passat', 'silver', 0.03],   // the yard east of Kubjaringi 3
  [3752.5, -2245.5, Math.PI / 2, 'mazda6', 'grey', 0.03],
  [3753.5, -2239.0, Math.PI / 2, 'ceedsw', 'white', 0.03],
  [3765.0, -2213.0, Math.PI / 2, 'rav4', 'black', 0.03],      // in front of Hariduse 6
  [3765.0, -2203.5, Math.PI / 2, 'mazda6', 'white', 0.03],
];

// ---------------------------------------------------------------- the painted walls
const C = { glass: '#46525f' };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: '#f3f2ee', weather: 0.35, ...o });
const flats = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.06, sc: '#f2f1ec', frame: '#f2f1ec', glass: C.glass, sill: 0.05, w: 1.4, pitch: 3.0, ...o });
const stair = (x, o = {}) => ({ x, w: 1.3, h: 2.2, col: '#6a4b38', steps: 2, canopy: '#8d969f', ...o });

function houses() {
  return [
    { name: 'kubjaringi1', sec: '7_-3', base: 2252, at: [3684, -2245.2], r: 20,
      spec: plaster([217, 185, 104], { storey: 2.8, maxFloors: 2, plinth: { h: 0.7, col: '#8f8b85', vents: 4 }, win: flats(), attic: null }),
      walls: [{ near: [3681.0, -2251.2], within: 3, doors: [stair(7.5), stair(21.5)] }] },
    { name: 'kubjaringi3', sec: '7_-3', base: 2242, at: [3727.9, -2247.4], r: 20,
      spec: plaster([217, 185, 104], { storey: 2.8, maxFloors: 2, plinth: { h: 0.7, col: '#8f8b85', vents: 4 }, win: flats(), attic: null }),
      walls: [{ near: [3730.2, -2253.6], within: 3, doors: [stair(7.5), stair(21.5)] }] },
    { name: 'hariduse4', sec: '7_-3', base: 2355, at: [3753.6, -2167.7], r: 24,
      spec: plaster([230, 227, 218], { storey: 2.8, maxFloors: 2, plinth: { h: 0.6, col: '#8a867f', vents: 6 }, win: flats({ w: 1.3, pitch: 2.9 }), attic: null }),
      walls: [{ near: [3753.6, -2173.0], within: 3, doors: [stair(7.2, { canopy: '#5a4d48' }), stair(19.2, { canopy: '#5a4d48' }), stair(31.2, { canopy: '#5a4d48' })] }] },
    { name: 'hariduse6', sec: '7_-3', base: 2331, at: [3776.5, -2209], r: 22,
      spec: plaster([235, 229, 181], { storey: 2.8, maxFloors: 3, plinth: { h: 0.7, col: '#8f8b85', vents: 4 }, win: flats(), attic: null }),
      walls: [{ near: [3769.6, -2218.4], within: 2, doors: [stair(8.3)] }, { near: [3770.2, -2200.6], within: 2, doors: [stair(9.5)] }] },
    { name: 'hariduse7', sec: '7_-3', base: 2228, at: [3798.3, -2112.7], r: 18,
      spec: plaster([238, 238, 234], { storey: 3.0, maxFloors: 2, plinth: { h: 0.5, col: '#7d7b78' }, win: flats({ w: 1.3, pitch: 2.8 }), attic: null }),
      walls: [{ near: [3787.4, -2114.0], within: 2, doors: [{ x: 10.2, w: 1.6, h: 2.3, col: '#4d5057', steps: 2, canopy: '#5d6066' }] }] },
    { name: 'kubjaringi2', sec: '7_-3', base: 2237, at: [3686.1, -2292.8], r: 12,
      spec: plaster([237, 237, 232], { storey: 2.9, maxFloors: 1, plinth: { h: 0.45, col: '#7d7b78' }, win: flats({ w: 1.3, pitch: 2.7, frame: '#3b3d42', sc: '#3b3d42', surround: 0 }), attic: { w: 0.9, h: 1.0 } }),
      walls: [{ near: [3685.4, -2287.7], within: 2, doors: [{ x: 8.0, w: 1.0, h: 2.1, col: '#3b3d42', steps: 2, canopy: '#5a5d63' }] }] },
    { name: 'kubjaringi4', sec: '7_-3', base: 2246, at: [3718.8, -2290.2], r: 14,
      spec: plaster([240, 239, 234], { storey: 2.9, maxFloors: 1, plinth: { h: 0.45, col: '#7d7b78' }, win: flats({ w: 1.4, pitch: 2.8, frame: '#3b3d42', sc: '#3b3d42', surround: 0 }), attic: null }),
      walls: [{ near: [3717.5, -2282.7], within: 2, doors: [{ x: 8.3, w: 1.0, h: 2.1, col: '#3b3d42', steps: 2, canopy: '#3c3d42' }] }] },
  ];
}

// ---------------------------------------------------------------- the build
export function createKorvekula3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const debug = /kdebug/.test(location.search);
    skinHouses(world, group, houses(), { shadows, ppm: 22, far: 12, debug });

    // the wooden balconies on the green side of Kubjaringi 1 and 3, two floors
    for (const [mid, n] of [[[3687.0, -2239.1], [0.45, 0.89]], [[3725.6, -2241.1], [-0.35, 0.94]]]) {
      const F = frame(mid, [n[1], -n[0]]), g = world.heightAt(mid[0], mid[1]);
      for (const s of [-9.5, -3.2, 3.2, 9.5]) for (const y of [0.75, 3.55]) {
        A.box(F, s, 0.62, 2.8, 1.2, y - 0.15, y, 0x9a958d, g);              // the slab
        A.box(F, s, 1.2, 2.8, 0.06, y, y + 1.0, 0x7a5a42, g);              // the board front
        for (const e of [-1.37, 1.37]) A.box(F, s + e, 0.62, 0.06, 1.2, y, y + 1.0, 0x7a5a42, g);
      }
    }

    // the play place in the middle of the green: swing, a little tower with a roof, the sand box
    const R = frame([3715.5, -2217.5], [1, 0]);
    A.swing(R, -2.5, -1.2, 2.6);
    const gy = world.heightAt(3718.5, -2215.5);
    for (const [ds, dv] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) A.box(R, 3 + ds, 2 + dv, 0.1, 0.1, 0, 2.6, 0x8a6b4e, gy);
    A.box(R, 3, 2, 1.7, 1.7, 1.05, 1.2, 0x8a6b4e, gy);
    A.box(R, 3, 2, 1.9, 1.9, 2.6, 2.7, 0xb04a3a, gy);
    A.box(R, 3, 3.6, 0.6, 1.6, 0.4, 0.5, 0xd0c56a, gy);                  // the slide
    A.box(R, -1.5, 2.5, 2.2, 0.12, 0, 0.3, 0x8a6b4e); A.box(R, -1.5, 4.5, 2.2, 0.12, 0, 0.3, 0x8a6b4e);
    A.box(R, -2.6, 3.5, 0.12, 2.1, 0, 0.3, 0x8a6b4e); A.box(R, -0.4, 3.5, 0.12, 2.1, 0, 0.3, 0x8a6b4e);
    // the field boulders north-east and south-west of the sand circle
    for (const [x, z, r] of [[3718.0, -2227.5, 0.7], [3721.5, -2228.5, 0.55], [3724.5, -2226.5, 0.65], [3720.5, -2225.0, 0.45],
      [3702.0, -2206.5, 0.6], [3704.5, -2204.5, 0.7], [3707.5, -2205.5, 0.5], [3705.5, -2208.5, 0.55], [3709.0, -2203.5, 0.45]]) {
      const geo = new THREE.IcosahedronGeometry(r, 0).scale(1.15, 0.7, 1).rotateY(x * 1.7);
      A.p.add(geo, 0x8d8a83, x, world.heightAt(x, z) + r * 0.35, z);
    }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if ([[3684, -2245], [3728, -2247], [3754, -2168], [3777, -2209], [3798, -2113], [3700, -2291]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
