// Riia tänav, batch 5 of the "riiastrip" kaardista (Martin, 20 Nov): from Suur kaar to the Ravila / Sõinaste lights,
// Riia 78 to 95. Street View: the shots "85 Jõhvi-Tartu-Valga" (Riia 87 behind its stone-footed board fence) and
// "93 Riia" (the old rubble wall along the north-west side before Sõinaste I); the rest from the Land Board's oblique
// air photos of 2023 and 2024.
//  - Riia 87: the sage green board house, the dark board fence on a field stone plinth, the thuja columns behind it.
//  - Riia 93-95: the old rubble wall with its piers and plaster cap along the pavement.
//  - Oak rows in both verges, where the map had a few spruces between the road and the paths.
//  - The houses in their colours and roofs: Riia 78-92 and Nikolai Lunini 2 to Ravila 1.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, cellKit } from './handbuilt.js';
import { RIIA2 } from './riia2.js';

const DEBUG = typeof location !== 'undefined' && /riia6debug/.test(location.search);
const S18 = ['1_8', -160, 4320];
const L = RIIA2.at, sv = RIIA2.sv, U = RIIA2.U;
const rect = (s0, s1, v0, v1) => (x, z) => { const [s, v] = sv(x, z); return s > s0 && s < s1 && v > v0 && v < v1; };
const lerpTab = (tab) => (s) => {
  if (s <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (s <= tab[i][0]) { const [a, va] = tab[i - 1], [b, vb] = tab[i]; return va + (vb - va) * (s - a) / (b - a); }
  return tab[tab.length - 1][1];
};
// the carriageway from the map's road lines: centre and half width along s; the south-east cycle path's centre
const CEN = lerpTab([[1387, -4.0], [1405, -4.3], [1534, -6.9], [1562, -8.4], [1590, -7.5], [1615, -5.0], [1637, -1.1]]);
const HW = lerpTab([[1404, 7.3], [1412, 5.3], [1555, 5.3], [1568, 7.3]]);
const PATH = lerpTab([[1405, -15.9], [1417, -16.6], [1523, -17.2], [1549, -18.3], [1563, -17.6], [1590, -17.6], [1626, -13.1]]);
const nwEdge = (s) => CEN(s) + HW(s), seEdge = (s) => CEN(s) - HW(s);

const win = (o = {}) => ({ w: 1.2, pitch: 2.7, T: false, bars: 1, surround: 0.1, sc: '#ebe6da', frame: '#f4f2ec', glass: '#55667a', ...o });
const plaster = (wall, floors, o = {}) => ({ kind: 'plaster', wall, trim: '#efebe2', storey: 3.0, maxFloors: floors, weather: 0.4,
  win: win(o.win), attic: null, plinth: { h: 0.6, type: 'plaster', col: '#8e8a84' }, ...o.spec });
const boards = (wall, floors, o = {}) => ({ kind: 'boards', wall, pitch: 0.16, trim: '#f1ece0', storey: 3.0, maxFloors: floors, weather: 0.35,
  win: win({ w: 1.1, pitch: 2.6, T: true, surround: 0.12, sc: '#f1ece0', ...o.win }), attic: null, plinth: { h: 0.6, type: 'rubble' }, ...o.spec });

// [name, base, at, reach, wall, roof, pick, spec]
const HOUSES = [
  // north-west side
  ['lunini2', 3455, L(1401, 27), 14, 0xe2d8b4, 0x6e6a66, rect(1391, 1418, 17, 39), plaster([226, 216, 180], 2)],
  ['r83', 3453, L(1428, 19), 12, 0xe8e6de, 0xa5463a, rect(1421, 1434, 8, 30), plaster([232, 230, 222], 2)],
  ['r85', 3486, L(1449, 15), 12, 0xe0d8c4, 0x6b4a3a, rect(1441, 1457, 7, 23), plaster([224, 216, 196], 2)],
  ['r85b', 3472, L(1443, 24), 8, 0xe0d8c4, 0x6b4a3a, rect(1439, 1449, 20, 38), plaster([224, 216, 196], 1)],
  ['r87', 3482, L(1472, 18), 12, 0xbac0a4, 0x4f4038, rect(1466, 1479, 8, 28), boards([186, 192, 164], 2)],
  ['r89', 3500, L(1489, 30), 12, 0xd6c8aa, 0x6e7277, rect(1479, 1498, 21, 40), plaster([214, 200, 170], 2)],
  ['r93', 3721, L(1549, 18), 14, 0xa8968a, 0x45474b, rect(1538, 1561, 4, 27), plaster([168, 150, 130], 3)],
  ['r95', 3852, L(1596, 29), 12, 0xe4ce78, 0x4a4c50, rect(1589, 1604, 23, 37), plaster([228, 206, 120], 2)],
  ['ravila1', 3843, L(1618, 20), 12, 0x9eb094, 0x4a4440, rect(1610, 1627, 10, 30), boards([160, 176, 150], 2)],   // green boards ("1 Ravila", "97" shots)
  // south-east side
  ['r78', 3591, L(1439, -39), 14, 0xe2dac6, 0x6b4a3a, rect(1428, 1448, -52, -30), plaster([226, 218, 198], 3)],
  ['r80', 3578, L(1468, -39), 12, 0xd0cec8, 0x50607a, rect(1460, 1477, -48, -30), plaster([208, 206, 200], 3)],
  ['r82', 3632, L(1491, -40), 12, 0xdaccb0, 0x7a7e84, rect(1482, 1501, -52, -31), plaster([218, 204, 176], 3)],
  ['r86', 3686, L(1531, -40), 12, 0xe8e2d0, 0x4a4c50, rect(1521, 1538, -48, -31), plaster([232, 226, 208], 3)],
  ['r88', 3715, L(1544, -39), 12, 0xe8e2d0, 0x4a4c50, rect(1536, 1553, -48, -31), plaster([232, 226, 208], 3)],
  ['r90', 3776, L(1578, -39), 12, 0xb0c8c4, 0x7a7e84, rect(1569, 1589, -46, -31), plaster([176, 200, 196], 2)],
  ['r92', 3857, L(1620, -37), 12, 0xece8e2, 0xa5463a, rect(1611, 1629, -45, -28), plaster([236, 232, 226], 2)],
];

// the old rubble wall along Riia 93-95, and Riia 87's fence line (v from the street side)
const WALL = { s0: 1561, s1: 1601, v: 7.6, top: 2.8, t: 0.6 };
const F87 = { s0: 1462, s1: 1483, v: 8.6 };

export function riia6Walls(walls) {
  setHouseColours(walls, S18[0], S18[1], S18[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

function wallCells(CK) {
  // the rubble wall's street face: field stones, a lighter pier at the left, patches of old render, the plaster cap
  CK.cell('rw', 8, -0.3, WALL.top, '#7c766c', (P, w) => {
    P.rubble(0, -0.3, w, WALL.top - 0.3, 5, '#77706a');
    P.rubble(0, -0.3, 0.7, WALL.top - 0.3, 9, '#8a837a', [[196, 188, 172], [180, 172, 160], [206, 196, 180]], 0.8);
    P.r(2.6, 1.2, 4.1, 2.1, 'rgba(176,168,154,0.75)');
    P.r(5.6, 0.4, 6.4, 1.0, 'rgba(160,154,142,0.7)');
    P.r(0, WALL.top - 0.3, w, WALL.top, '#a9a398');
    P.r(0, -0.3, w, 0.05, '#4e4a44');
  }, 22);
  // the same with a blind window in it
  CK.cell('rwn', 8, -0.3, WALL.top, '#7c766c', (P, w) => {
    P.rubble(0, -0.3, w, WALL.top - 0.3, 13, '#77706a');
    P.rubble(0, -0.3, 0.7, WALL.top - 0.3, 17, '#8a837a', [[196, 188, 172], [180, 172, 160], [206, 196, 180]], 0.8);
    P.r(3.4, 1.0, 5.2, 2.15, '#b2aa9c'); P.r(3.55, 1.12, 5.05, 2.0, '#5e584f');
    P.r(0, WALL.top - 0.3, w, WALL.top, '#a9a398');
    P.r(0, -0.3, w, 0.05, '#4e4a44');
  }, 22);
}

export function createRiia6(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- the oaks: the map's verge trees out of the strips between the road and the paths, regular rows in
  world.addClearing({ test: (x, z) => {
    const [s, v] = sv(x, z);
    if (s < 1408 || s > 1634) return false;
    if (v < 0) return v > PATH(s) + 1.8 && v < seEdge(s) + 0.5;
    return (v > nwEdge(s) - 0.5 && v < nwEdge(s) + 5.0) ||
      (s > WALL.s0 - 1 && s < WALL.s1 + 1 && v > WALL.v - 1.2 && v < WALL.v + 1.2) ||
      (s > F87.s0 - 1 && s < F87.s1 + 1 && v > F87.v - 1.2 && v < F87.v + 1.4);
  } });
  const oaks = [];
  let k = 0;
  const gapsSE = [[1400, 1416], [1555, 1571], [1579, 1597], [1622, 1640]];       // Suur kaar, the Elva lane, Sõinaste I stop, the lights
  const gapsNW = [[1380, 1416], [1527, 1542], [1626, 1640]];                     // Lunini, Säde, the lights
  for (let s = 1420; s < 1626; s += 12.5, k++) {
    if (gapsSE.some(([a, b]) => s > a && s < b)) continue;
    const [x, z] = L(s + ((k * 37) % 5) * 0.3 - 0.6, (seEdge(s) + PATH(s) + 1.8) / 2);
    oaks.push([x, z, 15 + ((k * 7) % 5) * 0.9, 7.2 + ((k * 3) % 4) * 0.5, 0]);
  }
  for (let s = 1419; s < 1628; s += 13, k++) {
    if (gapsNW.some(([a, b]) => s > a && s < b)) continue;
    const [x, z] = L(s + ((k * 13) % 5) * 0.3 - 0.6, nwEdge(s) + 2.4);
    oaks.push([x, z, 15.5 + ((k * 5) % 4) * 1.0, 7.4 + ((k * 3) % 3) * 0.5, 0]);
  }
  world.addTrees(oaks);
  // the rubble wall is solid
  { const [x, z] = L((WALL.s0 + WALL.s1) / 2, WALL.v); world.addSolids([{ x, z, yaw: Math.atan2(-U[1], U[0]), hx: (WALL.s1 - WALL.s0) / 2, hz: WALL.t / 2 }]); }

  let built = false;
  const CENTRE = L(1520, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { h } = A;
    const faces = (W) => W.foot < 2 && W.len > 5;
    const houses = HOUSES.map(([name, base, at, r, , , pick, spec]) => ({ name, sec: S18[0], base, at, r, pick, spec }));
    skinHouses(world, group, houses, { label: 'riia6 fronts', shadows, ppm: 12, far: 6, faces, debug: DEBUG });

    // ---- the rubble wall: a core, the painted street face in 8 m bays following the ground, a cap
    const CK = cellKit(group, { shadows, size: 512 });
    wallCells(CK);
    const n = Math.round((WALL.s1 - WALL.s0) / 8);
    for (let i = 0; i < n; i++) {
      const sa = WALL.s0 + (WALL.s1 - WALL.s0) * i / n, sb = WALL.s0 + (WALL.s1 - WALL.s0) * (i + 1) / n, g = Math.min(h(...L(sa, WALL.v)), h(...L(sb, WALL.v)));
      CK.put(L(sb, WALL.v - WALL.t / 2), L(sa, WALL.v - WALL.t / 2), g, i === 2 ? 'rwn' : 'rw');
      A.box(RIIA2, (sa + sb) / 2, WALL.v, sb - sa + 0.02, WALL.t - 0.04, -0.3, WALL.top - 0.02, 0x7a746a, g);
      A.box(RIIA2, (sa + sb) / 2, WALL.v, sb - sa + 0.02, WALL.t + 0.12, WALL.top - 0.02, WALL.top + 0.1, 0xa9a398, g);
    }
    for (const s of [WALL.s0, WALL.s1]) A.box(RIIA2, s, WALL.v, 0.8, WALL.t + 0.2, -0.3, WALL.top + 0.15, 0x8a837a);   // end piers
    CK.finish();

    // ---- Riia 87: the dark board fence on its field stone plinth, the gate gap, thuja columns behind
    const gate = 1471.5;
    for (const [a, b] of [[F87.s0, gate - 1.6], [gate + 1.6, F87.s1]]) {
      A.box(RIIA2, (a + b) / 2, F87.v, b - a, 0.5, -0.2, 0.45, 0x8a847b);
      A.picket([L(a, F87.v + 0.1), L(b, F87.v + 0.1)], 1.45, [70, 54, 44]);
    }
    A.gate(L(gate - 1.5, F87.v), L(gate + 1.5, F87.v), 1.3, 0x3a2e28);
    const thuja = [];
    for (let s = F87.s0 + 1.2; s < F87.s1 - 0.5; s += 2.4) if (Math.abs(s - gate) > 2.2) { const [x, z] = L(s, F87.v + 1.1); thuja.push([x, z, 0.9, 3.0 + ((s * 7) % 3) * 0.3, [0.42, 0.66, 0.48]]); }
    A.bushes(thuja);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([L(1428, 19), L(1520, 0), L(1580, 8), L(1620, -37)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
