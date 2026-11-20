// Ravila tänav, batch 7 of the "riiastrip" kaardista (Martin, 20 Nov): from the Riia lights north-west to Nooruse.
// Street View: "3 Ravila" (the yellow house with the green roof behind its ochre plank fence, and the long hedges
// towards Riia), "4 Ravila" (the white roughcast house with the red door behind its stone posts), "9 Ravila" (the
// old grey-brown house behind a weathered board fence) and "10 Ravila" (the yellow house with the maroon roof in its
// hedge on the Ehitaja corner). The rest from the Land Board's oblique air photos of 2023 and 2024, with the fronts
// in the same street look (hedges, board and picket fences right behind the pavement).
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';

const DEBUG = typeof location !== 'undefined' && /raviladebug/.test(location.search);
const S18 = ['1_8', -160, 4320];
// Ravila from the Riia lights: s along the street to the north-west, v + = the north-east side (odd numbers)
export const RV = frame([77, 4689.6], [-0.5924, -0.8057]);
const L = RV.at, sv = RV.sv;
const rect = (s0, s1, v0, v1) => (x, z) => { const [s, v] = sv(x, z); return s > s0 && s < s1 && v > v0 && v < v1; };

// the fence lines behind the pavements, and the cross streets they stop for
const VE = 7.8, VW = -8.8;
const EHITAJA = [164, 180], NOORUSE = [248, 264];

const win = (o = {}) => ({ w: 1.2, pitch: 2.7, T: false, bars: 1, surround: 0.1, sc: '#ebe6da', frame: '#f4f2ec', glass: '#55667a', ...o });
const plaster = (wall, floors, o = {}) => ({ kind: 'plaster', wall, trim: '#efebe2', storey: 2.9, maxFloors: floors, weather: 0.4,
  win: win(o.win), attic: { w: 0.9, h: 1.0 }, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' }, ...o.spec });
const boards = (wall, floors, o = {}) => ({ kind: 'boards', wall, pitch: 0.16, trim: '#f1ece0', storey: 2.9, maxFloors: floors, weather: 0.35,
  win: win({ w: 1.1, pitch: 2.6, T: true, surround: 0.12, sc: '#f1ece0', ...o.win }), attic: { w: 0.9, h: 1.0 }, plinth: { h: 0.6, type: 'rubble' }, ...o.spec });

// [name, base, at, reach, wall, roof, pick, spec, walls]
const HOUSES = [
  // north-east side
  ['r3', 3816, L(55, 16), 10, 0xe4cc94, 0x4e9a5a, rect(48, 62, 10, 23), plaster([228, 204, 148], 1, { win: { frame: '#f6f4ee' } })],   // "3 Ravila"
  ['r5', 3781, L(76, 15), 12, 0xeceae4, 0x5a5c60, rect(64, 90, 4, 26), plaster([236, 234, 228], 1)],
  ['r7', 3752, L(99, 19), 12, 0xeeece6, 0x3e4044, rect(90, 109, 10, 30), plaster([238, 236, 230], 2)],
  ['r9', 3716, L(122, 16), 10, 0x9e8c78, 0x4a3e36, rect(115, 130, 9, 24), plaster([160, 142, 122], 1, { spec: { weather: 0.6 } })],   // "9 Ravila"
  ['r11', 3669, L(155, 20), 11, 0xeae8e2, 0x44464a, rect(147, 162, 10, 31), plaster([234, 232, 226], 1)],
  ['r13', 3589, L(201, 18), 10, 0xf0eee8, 0x3c3e42, rect(194, 208, 10, 26), plaster([240, 238, 232], 2)],
  ['r15', 3517, L(231, 19), 11, 0xe2dac4, 0x8c9098, rect(223, 240, 10, 27), plaster([226, 218, 196], 2)],
  // south-west side
  ['r4', 3801, L(71, -21), 11, 0xe6e4dc, 0x4c4640, rect(63, 80, -31, -11), plaster([230, 228, 220], 1, { spec: { weather: 0.55 } }),   // "4 Ravila"
    [{ near: L(71, -12.3), within: 6, doors: [{ x: 3.6, w: 1.0, h: 2.1, col: '#9a2f2a', steps: 2 }] }]],
  ['r6', 3781, L(92, -15), 11, 0xe2dccc, 0x5a5c60, rect(80, 104, -26, -4), plaster([226, 220, 204], 1)],
  ['r8', 3760, L(121, -17), 11, 0xc8baa0, 0x3e3a36, rect(110, 131, -23, -11), plaster([200, 186, 160], 1, { spec: { weather: 0.6 } })],
  ['r10', 3735, L(157, -18), 9, 0xdcbc6c, 0x6a2030, rect(151, 163, -25, -11), boards([222, 190, 108], 1)],   // "10 Ravila"
  ['r12', 3666, L(200, -19), 10, 0xbeb8aa, 0x55575a, rect(191, 209, -27, -11), plaster([190, 184, 170], 1)],
  ['r14', 3624, L(234, -19), 10, 0xd6bcaa, 0x5a3a30, rect(227, 242, -28, -10), plaster([214, 188, 170], 2)],
];

export function ravilaWalls(walls) {
  setHouseColours(walls, S18[0], S18[1], S18[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// what stands along the pavement in front of each lot: [s0, s1, kind, side]; side +1 north-east, -1 south-west
const FRONTS = [
  [16, 44, 'hedge', 1],           // Ravila 1: the long hedge to the lights ("3 Ravila")
  [44.5, 62, 'ochre', 1],         // Ravila 3 ("3 Ravila")
  [65, 84, 'mesh', 1],            // Ravila 5
  [87.5, 111, 'hedge', 1],        // Ravila 7, two thujas at the drive
  [112, 124, 'boards', 1],        // Ravila 9 ("9 Ravila"): weathered boards, the gate gap, more boards, then the bush
  [127, 131, 'boards', 1],
  [131.5, 140, 'hedge', 1],
  [141, EHITAJA[0], 'hedge', 1],  // Ravila 11
  [EHITAJA[1] + 1, 213, 'white', 1],   // Ravila 13: low white boards
  [215, NOORUSE[0] - 1, 'hedge', 1],   // Ravila 15
  [16, 46, 'hedge', -1],          // Ravila 2 round the corner
  [47, 69.5, 'posts', -1],        // Ravila 4 ("4 Ravila"): stone posts, a gate in front of the door
  [72.5, 81, 'posts', -1],
  [82, 104, 'dark', -1],          // Ravila 6
  [105, 140, 'hedge', -1],        // Ravila 8
  [141, EHITAJA[0] + 0.5, 'hedge', -1],   // Ravila 10 ("10 Ravila"), on round the Ehitaja corner
  [EHITAJA[1] + 1, 219, 'hedge', -1],     // Ravila 12
  [221, NOORUSE[0] - 1, 'hedge', -1],     // Ravila 14
];

export function createRavila(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const vOf = (side) => (side > 0 ? VE : VW);

  // the map's verge trees out of the strips between the road and the fence lines, and off the fence lines
  world.addClearing({ test: (x, z) => {
    const [s, v] = sv(x, z);
    if (s < 12 || s > NOORUSE[1]) return false;
    if (v > -6 && v < 5) return false;
    return (v > 0 && v < VE + 1.6) || (v < 0 && v > VW - 1.6) || (s > EHITAJA[0] - 3 && s < EHITAJA[0] + 1 && v < VW && v > -32);
  } });
  // two thujas at Ravila 7's drive, a birch over Ravila 9's bush, a lilac clump at Ravila 4
  world.addTrees([
    [...L(109.6, VE + 1.2), 5.5, 1.6, 1], [...L(111.2, VE + 1.2), 5.2, 1.5, 1],
    [...L(137, VE + 2.2), 12, 5.5, 0],
    [...L(52, VW - 2.5), 4.5, 3.5, 0],
  ]);

  let built = false;
  const CENTRE = L(140, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { h } = A;
    const faces = (W) => W.foot < 2 && W.len > 4;
    const houses = HOUSES.map(([name, base, at, r, , , pick, spec, walls]) => ({ name, sec: S18[0], base, at, r, pick, spec, walls }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 6, faces, debug: DEBUG });

    const run = (s0, s1, v) => [L(s0, v), L(s1, v)];
    for (const [s0, s1, kind, side] of FRONTS) {
      const v = vOf(side);
      if (kind === 'hedge') A.hedge([L(s0, v + side * 0.3), L(s1, v + side * 0.3)], 1.8, 1.0);
      else if (kind === 'ochre') A.picket(run(s0, s1, v), 1.2, [196, 158, 98]);
      else if (kind === 'mesh') A.mesh(run(s0, s1, v), 1.15);
      else if (kind === 'boards') A.picket(run(s0, s1, v), 1.5, [118, 104, 90]);
      else if (kind === 'white') A.picket(run(s0, s1, v), 1.0, [236, 236, 232]);
      else if (kind === 'dark') A.picket(run(s0, s1, v), 1.6, [64, 56, 50]);
      else if (kind === 'posts') {
        // grey stone posts with a low dark rail between them, the garden grown up behind
        const n = Math.max(1, Math.round((s1 - s0) / 2.8));
        for (let i = 0; i <= n; i++) A.box(RV, s0 + (s1 - s0) * i / n, v, 0.42, 0.42, -0.2, 1.05, 0x9a958c, h(...L(s0 + (s1 - s0) * i / n, v)));
        A.bar(L(s0, v), L(s1, v), 0.05, 0.62, 0.68, 0x3a3a3c);
        A.bar(L(s0, v), L(s1, v), 0.05, 0.22, 0.27, 0x3a3a3c);
      }
    }
    // Ravila 4's gate between its two taller posts, Ravila 3's and 5's drive gates
    A.gate(L(69.6, VW), L(72.4, VW), 1.1, 0x3a3a3c);
    A.gate(L(84.3, VE), L(87.2, VE), 1.15, 0x484c4e);
    // Ravila 10's hedge on round the Ehitaja corner, and Ravila 4's overgrown front garden
    A.hedge([L(EHITAJA[0] + 0.2, VW - 0.3), L(EHITAJA[0] - 1.0, -30)], 1.9, 1.0);
    A.bushes([
      [...L(55, VW - 1.6), 1.6, 1.3], [...L(60, VW - 2.0), 1.4, 1.0], [...L(66, VW - 1.5), 1.8, 1.2],
      [...L(76, VW - 1.7), 1.5, 1.4], [...L(128.5, VE + 1.4), 2.2, 2.0],
    ]);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(20, 0), L(140, 0), L(250, 0)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
