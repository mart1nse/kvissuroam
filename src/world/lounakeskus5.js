// The Riia road houses from Riia 128 north-east to Sõinaste (Martin, 20 Nov: batch 5 of his pink outline round
// southern Tartu), dressed from the Land Board's oblique air photos (Apr 2024); there is no Street View of this
// stretch. The map's own blocks keep their shapes; their walls are painted, their roofs coloured, and each front
// to the road gets its door:
//  - the south side, Riia 94 to 128: Riia 94 (white, red roof), 94A, 96 (cream, light tin roof), 96a (pink),
//    98, 102 (brick), 104, 104a, 106, 108, 112, 114, 116, 118 (ochre, brown roof) and its barn, 120 (yellow) and
//    120b (salmon), the new dark house at 120a, 122, 124, 126 and the shop at Riia 128 (red roof);
//  - the north side, Riia 97 to 165: 97, 101, 103, 119, 121 (boards), 123, 125 (red roof), 127, 129 (yellow),
//    155, 157, 161, 163, 165; Ravila 2 and Vapramäe 3, 4a and 6 on the corners.
// Seen from the air only, so window counts, doors and the backs are guessed.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit } from './handbuilt.js';

const CENTRE = [-180, 4890];
const S18 = '1_8', S08 = '0_8', S09 = '0_9';

// ---------------------------------------------------------------- what the map's own data needs
export function lounakeskus5Walls(walls) {
  setHouseColours(walls, S18, -160, 4320, [
    { base: 3894, x: 73.1, z: 4714.6, wall: 0xf0eee8, roof: 0xa83a32, reach: 9.1 },   // riia94
    { base: 3916, x: 70.9, z: 4735.7, wall: 0xd6d6d2, roof: 0x5d6064, reach: 14.9 },   // riia94a
    { base: 3920, x: 46.5, z: 4734.3, wall: 0xece2be, roof: 0x9aa8b4, reach: 10.2 },   // riia96
    { base: 3933, x: 28.6, z: 4749.6, wall: 0xe2b0b6, roof: 0x8f9398, reach: 13.2 },   // riia96a
    { base: 3954, x: 8, z: 4765.5, wall: 0xc4b8a0, roof: 0x4a4c50, reach: 11.7 },   // riia98
    { base: 3870, x: 20.5, z: 4694.9, wall: 0xd6c8b4, roof: 0x6e6066, reach: 14.2 },   // riia97
    { base: 3855, x: 0.4, z: 4709.1, wall: 0xe6dabe, roof: 0x5e4a3e, reach: 11.7 },   // riia101
    { base: 3866, x: -26.4, z: 4727.8, wall: 0xecece8, roof: 0x4f5866, reach: 13.1 },   // riia103
    { base: 3830, x: 46.1, z: 4676.6, wall: 0xdacdb6, roof: 0x6e6066, reach: 12.2 },   // ravila2
    { base: 3973, x: -10.7, z: 4774.3, wall: 0x96523c, roof: 0x9da1a6, reach: 11.4 },   // riia102
    { base: 4001, x: -49.2, z: 4804.7, wall: 0xe8e8e4, roof: 0xa8adb2, reach: 11.0 },   // riia104
    { base: 3872, x: -35.3, z: 4793.8, wall: 0xdededa, roof: 0xb0b4b8, reach: 11.2 },   // riia104a
    { base: 4017, x: -61.1, z: 4810, wall: 0xdcd6cc, roof: 0x45474c, reach: 10.8 },   // riia106
    { base: 3891, x: -52.5, z: 4745.4, wall: 0xd6c6aa, roof: 0x5f5652, reach: 13.5 },   // riia119
    { base: 3946, x: -76.2, z: 4767, wall: 0xaa8c6e, roof: 0x6b6d70, reach: 12.4 },   // riia121
    { base: 3970, x: -98.2, z: 4782, wall: 0xe4dcc8, roof: 0x47494e, reach: 12.4 },   // riia123
    { base: 4044, x: -96, z: 4836.9, wall: 0xeeeeea, roof: 0x3f4146, reach: 12.2 },   // riia108
    { base: 4026, x: -90.2, z: 4853.9, wall: 0xe2d6c0, roof: 0x4a4c50, reach: 9.1 },   // vapra3
    { base: 4064, x: -152.2, z: 4810.9, wall: 0xecece8, roof: 0x6f7e8e, reach: 13.8 },   // vapra6
    { base: 4097, x: -137.9, z: 4888.3, wall: 0xe0ded6, roof: 0x7d8691, reach: 12.5 },   // riia112
    { base: 4039, x: -123.6, z: 4876.8, wall: 0xbeaa8c, roof: 0x7a4a3a, reach: 11.8 },   // vapra4a
  ]);
  setHouseColours(walls, S08, -800, 4320, [
    { base: 4088, x: -179.6, z: 4893.6, wall: 0x802628, roof: 0x3d3a3a, reach: 11.8 },   // riia114: dark red boards (Street View "114")
    { base: 4093, x: -173.4, z: 4827.7, wall: 0xf0eee8, roof: 0xb03a2e, reach: 15.4 },   // riia125
    { base: 4106, x: -189, z: 4841.5, wall: 0xdeceb4, roof: 0x8e3a33, reach: 9.1 },   // riia127
    { base: 4112, x: -197.9, z: 4914.4, wall: 0xdcd2be, roof: 0x6b6d70, reach: 15.6 },   // riia116
    { base: 4152, x: -231.1, z: 4929.6, wall: 0xcd963c, roof: 0x6b3d30, reach: 12.0 },   // riia118
    { base: 4149, x: -219.7, z: 4945.9, wall: 0x6e5541, roof: 0x6b4a3a, reach: 10.8 },   // riia118barn
    { base: 4200, x: -259.8, z: 4948.9, wall: 0xe2c46e, roof: 0xa9b3bd, reach: 11.4 },   // riia120
    { base: 4192, x: -249.8, z: 4958.3, wall: 0xd69682, roof: 0x6b6d70, reach: 9.4 },   // riia120b
    { base: 4166, x: -247.5, z: 4883.9, wall: 0xd6dee4, roof: 0x5d6b7a, reach: 10.1 },   // riia155
    { base: 4176, x: -274.7, z: 4898, wall: 0xd6c8af, roof: 0x6e5a4e, reach: 16.6 },   // riia157
    { base: 4133, x: -222.9, z: 4865.1, wall: 0xdebe6e, roof: 0xb0664e, reach: 12.2 },   // riia129
    { base: 4183, x: -305.3, z: 4922.1, wall: 0xeeece6, roof: 0xa83a32, reach: 12.6 },   // riia161
    { base: 4151, x: -319, z: 4934.7, wall: 0xded2ba, roof: 0xa85e4c, reach: 11.2 },   // riia163
    { base: 4161, x: -339.4, z: 4945.4, wall: 0xe4ded2, roof: 0x5f5a58, reach: 14.5 },   // riia165
  ]);
  setHouseColours(walls, S09, -800, 4960, [
    { base: 3935, x: -291.9, z: 4973.8, wall: 0x404248, roof: 0x2f3034, reach: 14.0 },   // riia120a
    { base: 4202, x: -323.1, z: 5004.3, wall: 0xdcd0aa, roof: 0x7a4a3c, reach: 10.8 },   // riia122: cream boards (Street View "122 Riia")
    { base: 4228, x: -350.4, z: 5039.9, wall: 0xe6e6e2, roof: 0x55585c, reach: 13.5 },   // riia124
    { base: 4248, x: -368.9, z: 5061.1, wall: 0xecece8, roof: 0xa3a7ab, reach: 12.5 },   // riia126
    { base: 4369, x: -425.8, z: 5101.3, wall: 0xece4d2, roof: 0xa8443a, reach: 21.7 },   // riia128
  ]);
}

// ---------------------------------------------------------------- the painted walls
const C = { glass: '#46525f' };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: '#f3f2ee', weather: 0.3, plinth: { h: 0.55, col: '#8f8b85' }, ...o });
const boards = (wall, o = {}) => ({ kind: 'wood', wall, pitch: 0.15, trim: '#f1eee6', weather: 0.4, plinth: { h: 0.5, type: 'rubble' }, ...o });
const old = (o = {}) => ({ w: 1.0, pitch: 2.5, T: true, surround: 0.09, sc: '#f4f1ea', frame: '#f4f1ea', glass: C.glass, ...o });
const dark = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: '#3b3d42', glass: C.glass, sill: 0.05, w: 1.4, pitch: 2.7, ...o });
const house = (name, sec, base, at, r, spec, walls = []) => ({ name, sec, base, at, r, spec, walls });
// Riia 128: shop windows along the ground floor and the blue boards over them
function shopFront(P, W) {
  const len = W.len;
  for (let x = 2; x + 4 < len - 1; x += 6.5) {
    P.r(x - 0.1, 0.3, x + 4.1, 2.9, '#e9e4da');
    P.grad(x, 0.4, x + 4, 2.8, '#56697c', '#2e3946');
    P.r(x + 1.95, 0.4, x + 2.05, 2.8, '#e9e4da');
  }
  for (const x of [len * 0.25, len * 0.62]) P.r(x - 4, 3.0, x + 4, 3.8, '#1f4f99');
}

function houses() {
  return [
    house('riia94', S18, 3894, [73.1, 4714.6], 9.1, plaster([240, 238, 232], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [70.8, 4711.4], within: 2, doors: [{ x: 3.0, w: 1.0, h: 2.1, col: '#6b4c3a', steps: 2 }] }]),
    house('riia94a', S18, 3916, [70.9, 4735.7], 14.9, plaster([214, 214, 210], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [64.7, 4726.2], within: 2, doors: [{ x: 2.7, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia96', S18, 3920, [46.5, 4734.3], 10.2, plaster([236, 226, 190], { storey: 2.8, maxFloors: 2, win: old(), attic: null }), [{ near: [43.7, 4730.3], within: 2, doors: [{ x: 3.5, w: 1.0, h: 2.1, col: '#5b3d2e', steps: 2 }] }]),
    house('riia96a', S18, 3933, [28.6, 4749.6], 13.2, plaster([226, 176, 182], { storey: 2.8, maxFloors: 2, win: dark(), attic: null }), [{ near: [24.9, 4743.6], within: 2, doors: [{ x: 4.8, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia98', S18, 3954, [8, 4765.5], 11.7, boards([196, 184, 160], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [3.3, 4759.6], within: 2, doors: [{ x: 2.9, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia97', S18, 3870, [20.5, 4694.9], 14.2, plaster([214, 200, 180], { storey: 2.8, maxFloors: 2, win: old(), attic: null }), [{ near: [26.1, 4699.5], within: 2, doors: [{ x: 4.0, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia101', S18, 3855, [0.4, 4709.1], 11.7, plaster([230, 218, 190], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [5.2, 4714.1], within: 2, doors: [{ x: 3.1, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia103', S18, 3866, [-26.4, 4727.8], 13.1, plaster([236, 236, 232], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-24.0, 4734.8], within: 2, doors: [{ x: 3.5, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('ravila2', S18, 3830, [46.1, 4676.6], 12.2, plaster([218, 205, 182], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [50.7, 4681.9], within: 2, doors: [{ x: 2.5, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia102', S18, 3973, [-10.7, 4774.3], 11.4, { kind: 'brick', wall: [150, 82, 60], trim: '#e9e4da', storey: 2.8, maxFloors: 2, win: old(), attic: null }, [{ near: [-13.5, 4770.3], within: 2, doors: [{ x: 4.4, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia104', S18, 4001, [-49.2, 4804.7], 11.0, plaster([232, 232, 228], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-53.3, 4798.9], within: 2, doors: [{ x: 2.4, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia104a', S18, 3872, [-35.3, 4793.8], 11.2, plaster([222, 222, 218], { storey: 2.8, maxFloors: 2, win: dark(), attic: null }), [{ near: [-40.6, 4791.7], within: 2, doors: [{ x: 2.0, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia106', S18, 4017, [-61.1, 4810], 10.8, plaster([220, 214, 204], { storey: 2.8, maxFloors: 2, win: dark(), attic: null }), [{ near: [-63.3, 4805.9], within: 2, doors: [{ x: 3.3, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia119', S18, 3891, [-52.5, 4745.4], 13.5, plaster([214, 198, 170], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-49.5, 4752.3], within: 2, doors: [{ x: 3.9, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia121', S18, 3946, [-76.2, 4767], 12.4, boards([170, 140, 110], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-73.5, 4769.0], within: 2, doors: [{ x: 5.3, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia123', S18, 3970, [-98.2, 4782], 12.4, plaster([228, 220, 200], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-95.6, 4783.8], within: 2, doors: [{ x: 5.4, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia108', S18, 4044, [-96, 4836.9], 12.2, plaster([238, 238, 234], { storey: 2.8, maxFloors: 2, win: dark(), attic: null }), [{ near: [-100.8, 4831.9], within: 2, doors: [{ x: 3.5, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('vapra3', S18, 4026, [-90.2, 4853.9], 9.1, plaster([226, 214, 192], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-93.0, 4850.2], within: 2, doors: [{ x: 2.6, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('vapra6', S18, 4064, [-152.2, 4810.9], 13.8, plaster([236, 236, 232], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-146.2, 4819.1], within: 2, doors: [{ x: 2.8, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia112', S18, 4097, [-137.9, 4888.3], 12.5, plaster([224, 222, 214], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-143.1, 4880.9], within: 2, doors: [{ x: 2.4, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('vapra4a', S18, 4039, [-123.6, 4876.8], 11.8, boards([190, 170, 140], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), []),
    house('riia114', S08, 4088, [-179.6, 4893.6], 11.8, boards([128, 38, 40], { trim: '#f4f2ec', storey: 2.8, maxFloors: 2, win: old(), attic: null }), [{ near: [-180.0, 4888.3], within: 2, doors: [{ x: 3.5, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia125', S08, 4093, [-173.4, 4827.7], 15.4, plaster([240, 238, 232], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-170.8, 4836.9], within: 2, doors: [{ x: 3.6, w: 1.0, h: 2.1, col: '#6b4c3a', steps: 2 }] }]),
    house('riia127', S08, 4106, [-189, 4841.5], 9.1, plaster([222, 206, 180], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), []),
    house('riia116', S08, 4112, [-197.9, 4914.4], 15.6, plaster([220, 210, 190], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-206.5, 4906.1], within: 2, doors: [{ x: 3.1, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia118', S08, 4152, [-231.1, 4929.6], 12.0, plaster([205, 150, 60], { storey: 2.8, maxFloors: 2, win: old(), attic: null }), [{ near: [-234.1, 4925.4], within: 2, doors: [{ x: 4.7, w: 1.0, h: 2.1, col: '#5d4636', steps: 2 }] }]),
    house('riia118barn', S08, 4149, [-219.7, 4945.9], 10.8, boards([110, 85, 65], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), []),
    house('riia120', S08, 4200, [-259.8, 4948.9], 11.4, plaster([226, 196, 110], { storey: 2.8, maxFloors: 2, win: old(), attic: null }), [{ near: [-262.3, 4945.3], within: 2, doors: [{ x: 4.6, w: 1.0, h: 2.1, col: '#3b5a7a', steps: 2 }] }]),
    house('riia120b', S08, 4192, [-249.8, 4958.3], 9.4, plaster([214, 150, 130], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-251.4, 4955.9], within: 2, doors: [{ x: 3.7, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia155', S08, 4166, [-247.5, 4883.9], 10.1, plaster([214, 222, 228], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-244.0, 4887.9], within: 2, doors: [{ x: 2.8, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia157', S08, 4176, [-274.7, 4898], 16.6, plaster([214, 200, 175], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-270.9, 4906.8], within: 2, doors: [{ x: 5.3, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia129', S08, 4133, [-222.9, 4865.1], 12.2, plaster([222, 190, 110], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-220.5, 4871.3], within: 2, doors: [{ x: 3.3, w: 1.0, h: 2.1, col: '#5d4636', steps: 2 }] }]),
    house('riia161', S08, 4183, [-305.3, 4922.1], 12.6, plaster([238, 236, 230], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-302.6, 4928.9], within: 2, doors: [{ x: 3.1, w: 1.0, h: 2.1, col: '#7a3b30', steps: 2 }] }]),
    house('riia163', S08, 4151, [-319, 4934.7], 11.2, plaster([222, 210, 186], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-317.7, 4939.6], within: 2, doors: [{ x: 3.0, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia165', S08, 4161, [-339.4, 4945.4], 14.5, plaster([228, 222, 210], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-337.5, 4953.5], within: 2, doors: [{ x: 3.8, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia120a', S09, 3935, [-291.9, 4973.8], 14.0, plaster([64, 66, 72], { storey: 2.8, maxFloors: 2, win: dark(), attic: null }), [{ near: [-297.1, 4970.3], within: 2, doors: [{ x: 3.5, w: 1.0, h: 2.1, col: '#2b2c30', steps: 2 }] }]),
    house('riia122', S09, 4202, [-323.1, 5004.3], 10.8, boards([222, 208, 170], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-329.9, 5001.7], within: 2, doors: [{ x: 2.7, w: 1.0, h: 2.1, col: '#6b4c3a', steps: 2 }] }]),
    house('riia124', S09, 4228, [-350.4, 5039.9], 13.5, plaster([230, 230, 226], { storey: 2.8, maxFloors: 2, win: dark(), attic: null }), [{ near: [-356.9, 5040.6], within: 2, doors: [{ x: 3.3, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia126', S09, 4248, [-368.9, 5061.1], 12.5, plaster([236, 236, 232], { storey: 2.8, maxFloors: 1, win: old(), attic: { w: 0.9, h: 1.0 } }), [{ near: [-374.5, 5057.4], within: 2, doors: [{ x: 3.6, w: 1.0, h: 2.1, col: '#5b5f66', steps: 2 }] }]),
    house('riia128', S09, 4369, [-425.8, 5101.3], 21.7, plaster([236, 228, 210], { storey: 2.8, maxFloors: 2, win: old(), attic: null }), [{ near: [-429.9, 5096.2], within: 3, draw: shopFront }]),
  ];
}

// ---------------------------------------------------------------- the build
export function createLounakeskus5(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const debug = typeof location !== 'undefined' && /lkdebug/.test(location.search);
    skinHouses(world, group, houses(), { shadows, ppm: 16, far: 8, faces: (W) => W.len > 5 && W.foot < 2, debug });
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 430) return;
      if ([[60, 4720], [-180, 4890], [-400, 5080]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
