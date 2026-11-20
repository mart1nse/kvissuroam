// Ravila tänav, batch 9 of the "riiastrip" kaardista (Martin, 20 Nov): from Tulika to the Viljandi mnt lights.
// Street View: "31 Viljandi mnt", "33 Viljandi mnt", "14 Ravila" (three shots along the birch rows to the lights) for
// the Maarjamõisa Coop: a long low box of ribbed silver metal with the COOP | Konsum 9-22 letters to the junction,
// Apotheka's glass front at the Ravila end, glass and orange door panels along Ravila. The houses on the north-east
// side from the Land Board's oblique air photos (2023/2024), their fronts in the street's look: hedges and a dark
// board fence behind the path. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { RV } from './ravila.js';

const DEBUG = typeof location !== 'undefined' && /raviladebug/.test(location.search);
const S07 = ['0_7', -800, 3680];
const L = RV.at, sv = RV.sv, U = RV.U, V = RV.V;
const rect = (s0, s1, v0, v1) => (x, z) => { const [s, v] = sv(x, z); return s > s0 && s < s1 && v > v0 && v < v1; };
const dotN = (W, D) => W.nx * D[0] + W.nz * D[1];

// ---- the Coop: ribbed silver-grey metal, a dark band along the top
function ribs(P, x0, x1, y0, y1) {
  P.r(x0, y0, x1, y1, '#b4b8bc');
  for (let x = x0; x < x1; x += 0.3) P.r(x, y0, x + 0.06, y1, '#9a9ea2');
}
function coop(P, W) {
  const len = W.len, top = P.y1;
  ribs(P, 0, len, P.y0, top);
  P.r(0, top - 0.5, len, top, '#2e3236');
  P.r(0, P.y0, len, 0.25, '#5c6064');
  const toJunction = dotN(W, U) > 0.7, toRavila = dotN(W, V) > 0.7;
  if (!toJunction && !toRavila) return;
  // which end of the wall is the Ravila corner: x grows towards it when the wall runs that way
  const ne = W.ux * V[0] + W.uz * V[1] > 0;
  if (toJunction) {
    // Apotheka's glass front at the Ravila corner, under its dark fascia with the white name
    const a = ne ? Math.max(0, len - 14) : 0, b = ne ? len : Math.min(len, 14);
    P.r(a, 0.25, b, top - 0.5, '#2e3236');
    P.grad(a + 0.3, 0.3, b - 0.3, 3.1, '#5a7088', '#2c3a48');
    for (let x = a + 0.3; x < b - 0.2; x += 1.5) P.r(x - 0.04, 0.3, x + 0.04, 3.1, '#8e959c');
    P.text('Apotheka', (a + b) / 2, top - 1.15, 0.7, '#f2f2f2', '700 %px Arial, sans-serif');
    // the COOP | Konsum 9-22 letters, light grey on the ribs
    const cx = ne ? len * 0.42 : len * 0.58;
    P.text('coop', cx - 2.6, top - 1.6, 1.7, '#e6e8ea', '800 italic %px Arial, sans-serif');
    P.r(cx - 0.05, top - 2.4, cx + 0.05, top - 0.9, '#e6e8ea');
    P.text('Konsum', cx + 2.2, top - 1.6, 0.75, '#e6e8ea', '600 %px Arial, sans-serif');
    P.text('9-22', cx + 6.2, top - 1.6, 1.2, '#e6e8ea', '700 %px Arial, sans-serif');
  }
  if (toRavila) {
    // glass and dark panels with the orange doors along Ravila
    for (let x = 1.5; x < len - 3; x += 9) {
      P.grad(x, 0.3, x + 5.2, 3.0, '#4e6378', '#26323e');
      for (let k = 1; k < 4; k++) P.r(x + k * 1.3 - 0.04, 0.3, x + k * 1.3 + 0.04, 3.0, '#8e959c');
      P.r(x + 5.8, 0.25, x + 7.6, 2.6, '#e0662e');
    }
  }
}

const win = (o = {}) => ({ w: 1.2, pitch: 2.7, T: false, bars: 1, surround: 0.1, sc: '#ebe6da', frame: '#f4f2ec', glass: '#55667a', ...o });
const plaster = (wall, floors, o = {}) => ({ kind: 'plaster', wall, trim: '#efebe2', storey: 2.9, maxFloors: floors, weather: 0.35,
  win: win(o.win), attic: { w: 0.9, h: 1.0 }, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' }, ...o.spec });

// [name, base, at, reach, wall, roof, pick, spec]
const HOUSES = [
  ['t602', 3256, L(602, 25), 9, 0xe8e6e0, 0x5a5050, rect(596, 609, 17, 33), plaster([232, 230, 224], 2)],
  ['t640', 3239, L(640, 22), 9, 0xe4ce9e, 0x4a4a4e, rect(631, 647, 13, 30), plaster([228, 206, 160], 2)],
  ['t678', 3209, L(677, 20), 10, 0xeeece6, 0x5a4a44, rect(667, 686, 13, 27), plaster([238, 236, 230], 2)],
  ['t708', 3201, L(707, 24), 11, 0xf0eeea, 0xa03838, rect(696, 719, 14, 40), plaster([240, 238, 234], 2)],
  ['t749', 3161, L(749, 26), 9, 0xe6e6e2, 0x6a7480, rect(741, 756, 18, 34), plaster([230, 230, 226], 2)],
];

export function ravila3Walls(walls) {
  setHouseColours(walls, S07[0], S07[1], S07[2], [
    ...HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })),
    { base: 3214, x: L(770, -66)[0], z: L(770, -66)[1], wall: 0xb4b8bc, roof: 0x5a5e62, reach: 30 },
  ]);
}

// the fronts behind the path on the north-east side: [s0, s1, kind]
const VF = 11.0;
const FRONTS = [[590, 612, 'hedge'], [628, 656, 'hedge'], [665, 690, 'dark'], [694, 727, 'hedge'], [738, 760, 'hedge']];

export function createRavila3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addClearing({ test: (x, z) => { const [s, v] = sv(x, z); return FRONTS.some(([a, b]) => s > a - 1 && s < b + 1 && Math.abs(v - VF) < 1.4); } });
  let built = false;
  const CENTRE = L(700, 0);

  function build() {
    built = true;
    const houses = [
      ...HOUSES.map(([name, base, at, r, , , pick, spec]) => ({ name, sec: S07[0], base, at, r, pick, spec })),
      { name: 'coop', sec: S07[0], base: 3214, at: L(770, -66), r: 40, pick: rect(745, 796, -95, -38), spec: { kind: 'plaster', wall: [180, 184, 188] },
        walls: [{ near: [0, 0], within: 1e9, only: (P, W) => coop(P, W) }] },
    ];
    skinHouses(world, group, houses, { shadows, ppm: 10, far: 5, faces: (W) => W.len > 5, debug: DEBUG });
    const A = areaKit(world, group, { shadows });
    for (const [s0, s1, kind] of FRONTS) {
      if (kind === 'hedge') A.hedge([L(s0, VF), L(s1, VF)], 1.6, 0.8);
      else A.picket([L(s0, VF), L(s1, VF)], 1.5, [60, 54, 50]);
    }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(600, 0), L(770, -66), L(750, 20)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
