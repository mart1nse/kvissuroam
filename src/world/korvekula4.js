// Kõrveküla, the north outline, part three (Martin, 20 Nov): the old village row along Hariduse tn east of the
// pond (Hariduse 10 to 20) and Pärna 33 at the far end, dressed from the Land Board's oblique air photos (2023,
// 2024). The map's own blocks keep their shapes; their walls are painted and their roofs coloured:
//  - (Hariduse 10, the house with the solar panels by the pond lane, is built by hand in hariduse10.js);
//  - Hariduse 12: the cream house, the grey board house beside it, the small red-roofed house and the
//    red-roofed barn behind;
//  - Hariduse 14: the white house with the dark roof and the grey board house and shed behind;
//  - Hariduse 16: the white house with the dark roof and its older neighbour;
//  - Hariduse 18: the red-roofed house, the long grey barn and the two small houses;
//  - Hariduse 20: the white house with the grey roof and the glazed porch;
//  - Pärna 33: the big cream two-storey house with the terracotta roof and its garage.
// Seen from the air only, so window counts, doors and the backs are guessed; the old houses are boarded.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit } from './handbuilt.js';

const CENTRE = [4010, -2120];

// ---------------------------------------------------------------- what the map's own data needs
export function korve4Walls(walls) {
  setHouseColours(walls, '7_-3', 3680, -2720, [
    { base: 2591, x: 3949.3, z: -2130.8, wall: 0xe8dccb, roof: 0x4a4c50, reach: 10 },   // Hariduse 12
    { base: 2556, x: 3943.8, z: -2147.7, wall: 0xbfb8a8, roof: 0x5c5e62, reach: 10 },   // its board house
    { base: 2623, x: 3966.5, z: -2141.6, wall: 0xdccfb6, roof: 0x8c3b33, reach: 10 },   // the small red-roofed house
    { base: 2567, x: 3956.5, z: -2154.4, wall: 0x7d6a58, roof: 0x7a3a36, reach: 10 },   // the barn
    { base: 2641, x: 3981.7, z: -2128.2, wall: 0xeeeeea, roof: 0x3e4045, reach: 10 },   // Hariduse 14
    { base: 2638, x: 3989.6, z: -2138.0, wall: 0xa49a8c, roof: 0x6b6d70, reach: 11 },
    { base: 2619, x: 3976.3, z: -2144.1, wall: 0x7f6c5a, roof: 0x606265, reach: 7 },
    { base: 2702, x: 4012.0, z: -2122.9, wall: 0xcfc6b4, roof: 0x6c6e72, reach: 9 },    // Hariduse 16
    { base: 2649, x: 4005.6, z: -2142.5, wall: 0xf0efe9, roof: 0x3b3d42, reach: 9 },
    { base: 2721, x: 4039.4, z: -2117.1, wall: 0xece6d6, roof: 0xa23a30, reach: 10 },   // Hariduse 18
    { base: 2683, x: 4027.2, z: -2131.9, wall: 0x857766, roof: 0x77797c, reach: 14 },   // its long barn
    { base: 2709, x: 4041.4, z: -2132.3, wall: 0xd8d2c4, roof: 0x5d5f63, reach: 6 },
    { base: 2706, x: 4051.4, z: -2130.4, wall: 0xe6e3dc, roof: 0x4d4f54, reach: 8 },
    { base: 2754, x: 4068.7, z: -2110.2, wall: 0xeeece6, roof: 0x6d7075, reach: 9 },    // Hariduse 20
    { base: 2900, x: 4171.0, z: -2090.2, wall: 0xebe3c8, roof: 0xb0583f, reach: 12 },   // Pärna 33
  ]);
  setHouseColours(walls, '7_-2', 3680, -2080, [
    { base: 2889, x: 4157.4, z: -2076.8, wall: 0xebe3c8, roof: 0xb0583f, reach: 8 },    // Pärna 33's garage
  ]);
}

export const KORVE4_CARS = [
  [4163.0, -2083.0, Math.PI * 0.25, 'rav4', 'white', 0.03],    // on Pärna 33's yard
];

// ---------------------------------------------------------------- the painted walls
const C = { glass: '#46525f' };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: '#f3f2ee', weather: 0.35, ...o });
const boards = (wall, o = {}) => ({ kind: 'wood', wall, pitch: 0.15, trim: '#f1eee6', weather: 0.4, ...o });
const old = (o = {}) => ({ w: 1.0, pitch: 2.5, T: true, surround: 0.09, sc: '#f4f1ea', frame: '#f4f1ea', glass: C.glass, ...o });
const dark = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: '#3b3d42', glass: C.glass, sill: 0.05, w: 1.3, pitch: 2.7, ...o });
const house = (name, sec, base, at, r, spec, walls = []) => ({ name, sec, base, at, r, spec, walls });
const shed = (wall) => boards(wall, { upright: true, plinth: { h: 0.3, col: '#77736d' }, win: old({ w: 0.7, pitch: 4.5 }), attic: null });

function houses() {
  const S = '7_-3';
  return [
    house('hariduse12', S, 2591, [3949.3, -2130.8], 9, plaster([232, 220, 203], { storey: 2.8, maxFloors: 1, plinth: { h: 0.6, col: '#8f8b85' }, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [3948.5, -2127.7], within: 2, doors: [{ x: 3.6, w: 1.0, h: 2.1, col: '#6b4c3a', steps: 2, canopy: '#4a4c50' }] }]),
    house('hariduse12b', S, 2556, [3943.8, -2147.7], 9, boards([191, 184, 168], { plinth: { h: 0.55, type: 'rubble' }, win: old({ pitch: 2.4 }), attic: { w: 0.8, h: 0.9 } })),
    house('hariduse12c', S, 2623, [3966.5, -2141.6], 9, boards([220, 207, 182], { plinth: { h: 0.5, col: '#7f7a73' }, win: old(), attic: { w: 0.8, h: 0.9 } })),
    house('hariduse12barn', S, 2567, [3956.5, -2154.4], 9, shed([125, 106, 88])),
    house('hariduse14', S, 2641, [3981.7, -2128.2], 9, plaster([238, 238, 234], { storey: 2.8, maxFloors: 1, plinth: { h: 0.5, col: '#7d7b78' }, win: dark(), attic: { w: 1.0, h: 1.0 } }), [{ near: [3979.0, -2123.3], within: 2, doors: [{ x: 4.0, w: 1.0, h: 2.1, col: '#3b3d42', steps: 2 }] }]),
    house('hariduse14b', S, 2638, [3989.6, -2138.0], 10, boards([164, 154, 140], { plinth: { h: 0.5, type: 'rubble' }, win: old({ pitch: 2.4 }), attic: { w: 0.8, h: 0.9 } })),
    house('hariduse14shed', S, 2619, [3976.3, -2144.1], 6, shed([127, 108, 90])),
    house('hariduse16', S, 2702, [4012.0, -2122.9], 8, boards([207, 198, 180], { plinth: { h: 0.5, col: '#7f7a73' }, win: old(), attic: { w: 0.8, h: 0.9 } }), [{ near: [4011.2, -2117.3], within: 2, doors: [{ x: 4.4, w: 1.0, h: 2.1, col: '#7a3b30', steps: 2 }] }]),
    house('hariduse16b', S, 2649, [4005.6, -2142.5], 8, plaster([240, 239, 233], { storey: 2.8, maxFloors: 1, plinth: { h: 0.5, col: '#7d7b78' }, win: dark({ frame: '#2f6f6a' }), attic: { w: 1.0, h: 1.0 } })),
    house('hariduse18', S, 2721, [4039.4, -2117.1], 10, plaster([236, 230, 214], { storey: 2.8, maxFloors: 2, plinth: { h: 0.55, col: '#8f8b85' }, win: old({ w: 1.1 }), attic: null }), [{ near: [4037.8, -2109.5], within: 2, doors: [{ x: 2.0, w: 1.0, h: 2.1, col: '#5d4636', steps: 2 }] }]),
    house('hariduse18barn', S, 2683, [4027.2, -2131.9], 13, shed([133, 119, 102])),
    house('hariduse18b', S, 2709, [4041.4, -2132.3], 6, boards([216, 210, 196], { plinth: { h: 0.4, col: '#7f7a73' }, win: old({ w: 0.9 }), attic: null })),
    house('hariduse18c', S, 2706, [4051.4, -2130.4], 8, plaster([230, 227, 220], { storey: 2.8, maxFloors: 1, plinth: { h: 0.5, col: '#7d7b78' }, win: old(), attic: { w: 0.9, h: 1.0 } })),
    house('hariduse20', S, 2754, [4068.7, -2110.2], 9, plaster([238, 236, 230], { storey: 2.8, maxFloors: 1, plinth: { h: 0.55, col: '#8f8b85' }, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [4069.0, -2104.4], within: 2, doors: [{ x: 3.3, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('parna33', S, 2900, [4171.0, -2090.2], 12, plaster([235, 227, 200], { storey: 2.9, maxFloors: 2, plinth: { h: 0.5, col: '#8f8b85' }, win: dark({ frame: '#f2f1ec', w: 1.4 }), attic: null }), [{ near: [4164.6, -2091.0], within: 2, doors: [{ x: 4.6, w: 1.0, h: 2.1, col: '#4d4b50', steps: 2, canopy: '#b0583f' }] }]),
    house('parna33garage', '7_-2', 2889, [4157.4, -2076.8], 8, plaster([235, 227, 200], { storey: 2.8, maxFloors: 1, plinth: { h: 0.3, col: '#8f8b85' }, win: dark({ frame: '#f2f1ec', pitch: 4 }), attic: null })),
  ];
}

// ---------------------------------------------------------------- the build
export function createKorvekula4(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const debug = /kdebug/.test(location.search);
    skinHouses(world, group, houses(), { label: 'korvekula4 fronts', shadows, ppm: 22, far: 12, debug });
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 520) return;
      if ([[3949, -2131], [3982, -2128], [4039, -2117], [4069, -2110], [4171, -2090]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
