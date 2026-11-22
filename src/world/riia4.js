// Riia tänav, batch 3 of the "riiastrip" kaardista (Martin, 20 Nov): from the railway past Lembitu to Väike kaar.
// Mostly the regular pass from the Land Board's oblique air photos of Apr and May 2024 (no Street View shots
// reach past Lembitu): the old houses on both sides in their own colours and roofs.
//  - South-east side: Riia 30 (the big yellow house at Raudtee, grey hipped roof), the cream and white houses of
//    Riia 32 and 36, Oskar Luts's house (Riia 38, now the museum) in its pink, the green board house of Riia 40,
//    Riia 42 to 48.
//  - North-west side: the long low Riia 47 with its red roof by the Coop car park, Riia 49 to 59.
//  - From the Street View shot at Lembitu: the Coop pylon on the car park corner, light blue with the white
//    COOP panel on top.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, cellKit } from './handbuilt.js';
import { RIIA2 } from './riia2.js';

const DEBUG = typeof location !== 'undefined' && /riia4debug/.test(location.search);
const S27 = ['2_7', 480, 3680];
const L = RIIA2.at, sv = RIIA2.sv, U = RIIA2.U;
const SANS = '700 %px Arial, sans-serif';
const rect = (s0, s1, v0, v1) => (x, z) => { const [s, v] = sv(x, z); return s > s0 && s < s1 && v > v0 && v < v1; };

const plaster = (wall, floors, storey = 3.1, win = {}) => ({ kind: 'plaster', wall, trim: '#efebe2', storey, maxFloors: floors, weather: 0.45,
  win: { w: 1.2, pitch: 2.7, T: false, bars: 1, surround: 0.1, sc: '#ebe6da', frame: '#f4f2ec', glass: '#55667a', ...win }, attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' } });
const boards = (wall, floors) => ({ kind: 'boards', wall, pitch: 0.16, trim: '#f1ece0', storey: 3.0, maxFloors: floors, weather: 0.4,
  win: { w: 1.1, pitch: 2.6, T: true, bars: 1, surround: 0.12, sc: '#f1ece0', frame: '#f4f1ea', glass: '#55667a' }, attic: null, plinth: { h: 0.7, type: 'plaster', col: '#8a857f' } });

// [name, base, at, reach, wall, roof, pick, spec]
const HOUSES = [
  // south-east side
  ['r30', 2789, L(660, -32), 20, 0xe0cc8c, 0x9ea3a9, rect(640, 682, -45, -18), plaster([224, 204, 140], 2, 3.4)],
  ['r32a', 2940, L(708, -28), 10, 0xe8e4d6, 0x8f9398, null, plaster([232, 228, 214], 2)],
  ['r32b', 2954, L(722, -30), 12, 0xe8e4d6, 0x8f9398, null, plaster([232, 228, 214], 2)],
  ['r36', 3008, L(745, -28), 12, 0xe6e0ce, 0xa7abb0, null, plaster([230, 224, 206], 2)],
  ['r38', 3068, L(770, -28), 10, 0xd8a89c, 0xa36a5e, rect(760, 782, -40, -18), boards([216, 168, 156], 2)],
  ['r40', 3098, L(798, -29), 14, 0x78926c, 0x9ea3a9, null, boards([120, 146, 108], 2)],
  ['r42', 3190, L(827, -34), 14, 0xe2ded6, 0x6e7277, null, plaster([226, 222, 214], 3)],
  ['r44', 3253, L(863, -29), 12, 0x969ca0, 0x5d6166, null, plaster([150, 156, 160], 3)],
  ['r46', 3310, L(893, -34), 16, 0xded6be, 0x8f9398, null, plaster([222, 214, 190], 3)],
  ['r48', 3362, L(926, -34), 14, 0xd6d2c8, 0x7a7e84, null, plaster([214, 210, 200], 3)],
  // north-west side
  ['r47', 2855, L(735, 20), 18, 0xceba96, 0xa83a32, null, plaster([206, 186, 150], 1, 3.2, { w: 1.4 })],
  ['r49', 2945, L(763, 25), 12, 0xe8e0ba, 0x9ea3a9, null, plaster([232, 224, 186], 2)],
  ['r51', 2932, L(801, 24), 14, 0xe0e0de, 0x8f9398, rect(788, 814, 12, 36), plaster([224, 224, 222], 2)],
  ['r53', 3025, L(825, 24), 12, 0xe2c6c4, 0xa84a46, null, plaster([226, 198, 196], 3)],
  ['r55', 2941, L(854, 43), 12, 0xdcd4b4, 0x8a8e94, null, plaster([220, 212, 180], 3)],
  ['r57', 3150, L(891, 21), 12, 0xd2c4a0, 0x6e7277, null, plaster([210, 196, 160], 3)],
  ['r59', 3121, L(922, 22), 12, 0xe2dcce, 0x8a8e94, null, plaster([226, 220, 206], 3)],
];

export function riia4Walls(walls) {
  setHouseColours(walls, S27[0], S27[1], S27[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// the Coop pylon's faces: light blue, the white COOP panel on top, the store's name and the opening hours below
function coopCells(CK) {
  CK.cell('coop', 1.6, 0, 8.6, '#7ea6d4', (P, w) => {
    P.grad(0, 0, w, 8.6, '#8db3de', '#5f8cc2');
    P.r(0.08, 6.6, w - 0.08, 8.5, '#f6f7f9');
    P.text('coop', w / 2, 7.55, 0.62, '#1d5fb0', '800 %px Arial Rounded MT Bold, Arial, sans-serif');
    P.r(0.15, 5.2, w - 0.15, 6.3, '#1d5fb0'); P.text('Lembitu', w / 2, 5.95, 0.26, '#ffffff', SANS); P.text('Konsum', w / 2, 5.55, 0.26, '#ffffff', SANS);
    P.r(0.2, 3.8, w - 0.2, 4.9, '#eef1f5'); P.text('9-22', w / 2, 4.35, 0.42, '#1d5fb0', SANS);
    P.r(0, 0, w, 0.5, '#4a5560');
  }, 40);
}

export function createRiia4(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = L(790, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const faces = (W) => W.foot < 2 && W.len > 5;
    const houses = HOUSES.map(([name, base, at, r, , , pick, spec]) => ({ name, sec: S27[0], base, at, r, pick: pick || undefined, spec }));
    skinHouses(world, group, houses, { label: 'riia4 fronts', shadows, ppm: 12, far: 6, faces, debug: DEBUG });

    // ---- the Coop pylon on the car park corner, its faces to the traffic both ways
    const CK = cellKit(group, { shadows, size: 512 });
    coopCells(CK);
    {
      const s = 672, v = 19.5, [x, z] = L(s, v), g = h(x, z);
      A.box(RIIA2, s, v, 0.5, 1.6, -0.2, 8.6, 0x6f95c4, g);
      CK.put(L(s - 0.27, v - 0.8), L(s - 0.27, v + 0.8), g, 'coop');
      CK.put(L(s + 0.27, v + 0.8), L(s + 0.27, v - 0.8), g, 'coop');
      A.box(RIIA2, s, v, 1.0, 2.2, -0.2, 0.25, 0x8a8c88, g);
      world.addSolids([{ x, z, yaw: Math.atan2(-U[1], U[0]), hx: 0.3, hz: 0.85 }]);
    }
    CK.finish();
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(660, -30), L(735, 20), L(830, 0), L(925, -30)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
