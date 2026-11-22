// Kaardista "Tartu Airport at Ülenurme" (Martin, 22 Nov), batch 2: the Estonian Aviation Academy and the way
// to the airport, from his Street View shots of June 2023 and the Land Board's oblique air photos (2023, 2024).
//  - Eesti Lennuakadeemia (Lennu 40): the three-winged building in silver grey panels, its tall narrow windows
//    in three rows, the glazed wing ends in their white frames, EESTI LENNUAKADEEMIA over the entrance, the
//    canopy and the wide steps with their rails, the glass dome in the middle of the roof, the sun panels on
//    the roof, the flags, the clipped conical thujas on the lawn along the loop, cars in the loop;
//  - Lennu 42 by the road to the terminal: the white three-storey house with its grey roof, the steel flue on
//    its north end, the entrance with the ramp and rails, the bench, the green bins on the gravel by the road;
//  - Lennu tn (road 22132) from the Tõrvandi roundabout to the airport: white posts with a black band along
//    both verges every 50 m, the blue and white striped posts at the academy's way in.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /lakdebug/.test(location.search);
const S1 = ['1_17', -160, 10080];
const HOUSES = [
  ['lak', S1, 2662, [40, 10640], 60, 0xd6d9dc, 0xb9bcc0],
  ['dorm', S1, 2862, [-86, 10580], 32, 0xf1f0ec, 0x5d6066],
];

export function lennuakadeemiaWalls(walls) {
  setHouseColours(walls, S1[0], S1[1], S1[2], HOUSES.map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
}

// the wing ends: the west, east and south tips of the Y
const TIPS = [[-2, 10614], [81, 10618], [38.5, 10683]];
function lak(P, W) {
  const len = W.len, top = W.peak;
  const end = TIPS.some(([x, z]) => Math.hypot(W.mid[0] - x, W.mid[1] - z) < 9) && len < 20;
  P.r(0, P.y0, len, top, '#d4d7da');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, P.y0, x + 0.04, top, '#c3c7cb');
  P.r(0, P.y0, len, 0.6, '#9fa3a8');
  if (end) {                                                       // glazed, in a broad white frame
    P.r(0, P.y0, len, top, '#f3f4f5');
    P.grad(0.9, 0.6, len - 0.9, top - 1.4, '#8fb0b8', '#4d6b75');
    for (let x = 0.9; x < len - 0.8; x += (len - 1.8) / Math.max(1, Math.round((len - 1.8) / 2.2))) P.r(x - 0.05, 0.6, x + 0.05, top - 1.4, '#e8ebed');
    for (const y of [3.6, 7.0]) if (y < top - 1.6) P.r(0.9, y - 0.05, len - 0.9, y + 0.05, '#e8ebed');
    return;
  }
  if (len < 2.5) return;
  // tall narrow windows in columns, three rows; the top row a little shorter
  const rows = [[0.9, 2.9], [3.9, 6.1], [7.1, 8.9]].filter(([, b]) => b < top - 0.9);
  const n = Math.max(1, Math.floor((len - 0.8) / 1.6)), x0 = (len - n * 1.6) / 2;
  for (let k = 0; k < n; k++) for (const [a, b] of rows) P.win(x0 + k * 1.6 + 0.35, a, x0 + k * 1.6 + 1.25, b, { frame: '#9aa1a8', glass: '#3f5160', fw: 0.06, bars: 0, rails: 1, sill: 0.04, sc: '#b4b9be' });
  P.r(0, top - 0.7, len, top, '#c9cdd1');
}
function dorm(P, W) {
  const len = W.len, top = W.peak, gable = Math.abs(W.nz) > 0.7;
  P.r(0, P.y0, len, top, '#f1f0ec'); P.weather(0, P.y0, len, top, 0.25, 31);
  P.r(0, P.y0, len, 0.7, '#a7a6a2');
  if (len < 4) return;
  const rows = [1.2, 4.0, 6.8].filter((y) => y + 1.3 < W.eaves - 0.2);
  if (gable) {
    for (const y of rows) for (const x of [len * 0.3, len * 0.7]) P.win(x - 0.65, y, x + 0.65, y + 1.3, { frame: '#fafaf8', glass: '#4e5f73', fw: 0.07, bars: 1, sill: 0.06 });
    return;
  }
  const n = Math.max(1, Math.round(len / 3.1)), step = len / n;
  for (let k = 0; k < n; k++) for (const y of rows) {
    const x = step * (k + 0.5);
    if (W.nx < -0.7 && Math.abs(x - len * 0.52) < 1.6 && y < 2) continue;          // the entrance
    P.win(x - 0.65, y, x + 0.65, y + 1.3, { frame: '#fafaf8', glass: '#4e5f73', fw: 0.07, bars: 1, sill: 0.06, lit: (k * 7 + y) % 11 === 0 ? 1 : 0 });
  }
  if (W.nx < -0.7) { const d = len * 0.52; P.r(d - 1.5, 0.35, d + 1.5, 2.9, '#3a3c40'); P.grad(d - 1.4, 0.4, d + 1.4, 2.8, '#76889a', '#3d4a58'); P.r(d - 0.04, 0.4, d + 0.04, 2.8, '#3a3c40'); }
}
const PAINT = { lak, dorm };

// Lennu tn from the Tõrvandi roundabout to the airport and on west (the map's own centre line)
const LENNU = [[1233.4, 10296.6], [1039.3, 10400.5], [990.4, 10424.9], [927.4, 10454.9], [873.0, 10479.5], [818.0, 10503.5], [776.7, 10519.3], [733.0, 10533.7], [659.7, 10555.2], [636.5, 10561.2], [580.9, 10572.6], [515.7, 10581.6], [488.1, 10583.7], [462.6, 10585.2], [432.0, 10586.1], [397.6, 10585.9], [356.1, 10583.8], [317.5, 10580.0], [129.8, 10555.6], [112.1, 10553.4], [77.5, 10548.9], [-59.7, 10531.2], [-97.7, 10528.4], [-128.6, 10528.0], [-180.6, 10531.0], [-236.7, 10535.9], [-270.2, 10540.4], [-307.8, 10546.8], [-341.1, 10553.8], [-363.8, 10559.0], [-392.1, 10566.7], [-509.5, 10602.1]];
// where side roads come in: no posts there
const MOUTHS = [[112.1, 10553.4], [-128.6, 10528.0], [-100, 10530], [78.6, 10536.5], [-420, 10575], [1233.4, 10296.6]];
// the academy's loop, the cars in it ([x, z, yaw, id, paint, lift]; forward = (sin yaw, -cos yaw))
export const LENNUAKADEEMIA_CARS = [
  [25.0, 10577.5, Math.PI, 'passat', 'grey'], [31.0, 10576.2, Math.PI, 'rav4', 'white'], [43.5, 10576.2, Math.PI, 'mazda6', 'red'],
  [49.5, 10577.6, Math.PI, 'passat', 'black'], [55.4, 10579.8, Math.PI - 0.35, 'ceedsw', 'grey'], [66.0, 10584.0, Math.PI - 0.6, 'bz4x', 'white'],
  [14.0, 10582.2, Math.PI + 0.45, 'rav4', 'black'], [8.5, 10585.6, Math.PI + 0.6, 'passat', 'silver'],
  [30.0, 10601.5, 0, 'mazda6', 'white'], [45.5, 10601.5, 0, 'passat', 'grey'], [-89.5, 10571.0, -Math.PI / 2, 'ceedsw', 'red'],
].map((c) => [...c, 0]);
const CENTRE = [40, 10600];

export function createLennuakadeemia(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  // the clipped thujas on the lawn along the loop (the map has none there)
  world.addTrees([[-30, 10585], [-20, 10577], [-9, 10571], [2, 10566], [13, 10562], [24, 10559], [35, 10557], [46, 10558], [56, 10561], [65, 10565], [73, 10571],
    [6, 10606], [16, 10598], [60, 10597], [70, 10603], [26, 10612], [50, 10612]].map(([x, z], k) => [x, z, 3.6 + (k % 3) * 0.6, 1.3, 1]));
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 220], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: (W) => W.len > 5 && W.ylo - W.yref < 2, debug: DEBUG, label: 'lennuakadeemia fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const RT = 24.6 + 13.9;                                        // the academy's roof, from the map's block
    // the entrance: canopy, the wide steps from the loop, rails, the lettering above
    const ey = h(38, 10618);
    p.box(9.0, 0.45, 3.4, 0xeceeef, 38, ey + 3.6, 10617.9);
    for (const x of [34.2, 41.8]) p.box(0.16, 3.4, 0.16, 0xb4b9be, x, ey + 1.7, 10616.5);
    for (let k = 0; k < 6; k++) p.box(10.0, 0.16, 1.0, 0xc9c8c4, 38, h(38, 10611 + k) + 0.08 + Math.max(0, ey - h(38, 10611 + k)) * (k / 6), 10610.5 + k);
    for (const x of [33.2, 38, 42.8]) A.bar([x, 10609.8], [x, 10616.2], 0.05, 0.9, 0.95, 0x9aa1a8);
    { const tex = paintTexture(17, 0, 1.2, 30, (P) => P.text('EESTI LENNUAKADEEMIA', 8.5, 0.6, 1.0, '#4b5058', '700 %px Arial, sans-serif'), { alpha: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.2), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
      m.position.set(38, RT - 2.2, 10619.1); m.rotation.y = Math.PI; group.add(m); }
    // three flags west of the steps: Estonia, the EU, the academy (white with its blue sign, guessed)
    const pole = new THREE.CylinderGeometry(0.05, 0.08, 9, 6);
    [[24.5, 10607.5, ['#0072ce', '#000000', '#ffffff']], [27.0, 10606.5, ['eu']], [29.5, 10605.8, ['lak']]].forEach(([x, z, cols]) => {
      const y = h(x, z);
      p.add(pole, 0xeceeef, x, y + 4.5, z);
      const tex = paintTexture(1.5, 0, 1.0, 40, (P) => {
        if (cols[0] === 'eu') { P.r(0, 0, 1.5, 1, '#003399'); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.arc(0.75 + Math.cos(a) * 0.33, 0.5 + Math.sin(a) * 0.33, 0.035, '#ffcc00'); } }
        else if (cols[0] === 'lak') { P.r(0, 0, 1.5, 1, '#f4f5f7'); P.r(0, 0, 1.5, 0.16, '#1d4f9c'); P.arc(0.75, 0.56, 0.25, '#1d4f9c'); P.arc(0.75, 0.56, 0.17, '#f4f5f7'); P.r(0.42, 0.53, 1.08, 0.59, '#1d4f9c'); }
        else cols.forEach((c, i) => P.r(0, 1 - (i + 1) / cols.length, 1.5, 1 - i / cols.length, c));
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      m.position.set(x + 0.8, y + 8.2, z); m.rotation.y = 0.2; group.add(m);
    });
    yield;
    // the glass dome over the middle, white ribs
    { const tex = paintTexture(12, 0, 3, 24, (P) => { P.grad(0, 0, 12, 3, '#9fc3dc', '#4f7896'); for (let x = 0; x < 12; x += 1) P.r(x, 0, x + 0.06, 3, '#f2f4f6'); for (const y of [0.9, 1.8, 2.5]) P.r(0, y, 12, y + 0.05, '#f2f4f6'); });
      const g = new THREE.SphereGeometry(4.4, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex })); m.position.set(38.5, RT + 0.6, 10631.5); m.scale.set(1, 0.7, 1); group.add(m);
      p.add(new THREE.CylinderGeometry(4.6, 4.6, 0.6, 12), 0xd9dcdf, 38.5, RT + 0.3, 10631.5); }
    // the sun panels on the roof: short tilted rows on each wing
    const pan = (x, z) => p.box(2.0, 0.05, 1.1, 0x26304c, x, RT + 0.45, z);
    for (let x = 4; x < 30; x += 3.2) for (const z of [10614.5, 10618.5]) pan(x, z + (x - 4) * 0.2);
    for (let x = 50; x < 76; x += 3.2) for (const z of [10619.5, 10623.5]) pan(x, z - (x - 50) * 0.12);
    for (let z = 10642; z < 10678; z += 2.6) for (const x of [36.6, 40.4]) pan(x, z);
    yield;

    // ---- Lennu 42: the flue, the ramp and its rails, the bench, the bins on the gravel
    { const x = -97.2, z = 10557.5, y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.22, 0.22, 14.5, 10), 0xb9bdc2, x, y + 7.25, z);
      for (const k of [3, 7, 11]) p.box(0.9, 0.06, 0.06, 0x9aa1a8, x + 0.45, y + k, z); }
    { const ex = -96.9, ez = 10580.4, y = h(ex, ez);
      p.box(1.8, 0.35, 4.0, 0xc9c8c4, ex - 1.0, y + 0.17, ez);
      p.box(1.4, 0.2, 6.5, 0xb9b8b4, ex - 1.0, y + 0.1, ez - 5.2);
      for (const d of [-0.9, 0.9]) A.bar([ex - 1.0 + d, ez - 8.4], [ex - 1.0 + d, ez + 1.8], 0.05, 0.85, 0.9, 0x8d9096);
      p.box(1.7, 0.08, 0.45, 0x7a5230, ex - 3.5, y + 0.45, ez + 3.5); p.box(1.7, 0.4, 0.06, 0x7a5230, ex - 3.75, y + 0.75, ez + 3.5);
      for (const [x, z] of [[-104.5, 10567.0], [-104.5, 10569.6], [-104.5, 10572.2]]) { const yy = h(x, z); p.box(1.3, 1.25, 2.1, 0x3d7a46, x, yy + 0.62, z); p.box(1.4, 0.12, 2.2, 0x2f6238, x, yy + 1.3, z); } }
    yield;

    // ---- Lennu tn: white posts with a black band every 50 m on both verges; striped posts at the academy's way in
    const spots = [];
    let t = 0, next = 25;
    for (let i = 0; i < LENNU.length - 1; i++) {
      const [ax, az] = LENNU[i], [bx, bz] = LENNU[i + 1], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      while (next <= t + len) {
        const d = next - t, x = ax + ux * d, z = az + uz * d;
        for (const side of [-1, 1]) spots.push([x - uz * 5.4 * side, z + ux * 5.4 * side]);
        next += 50;
      }
      t += len;
    }
    // only where the ground has loaded (the far end towards Tõrvandi is over a kilometre off)
    const keep = spots.filter(([x, z]) => world.ready(x, z) && MOUTHS.every(([mx, mz]) => Math.hypot(x - mx, z - mz) > 22));
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.8, 0.11), new THREE.MeshLambertMaterial({ color: 0xf2f2f0 }), keep.length);
    const band = new THREE.InstancedMesh(new THREE.BoxGeometry(0.115, 0.25, 0.115), new THREE.MeshLambertMaterial({ color: 0x202124 }), keep.length);
    const M = new THREE.Matrix4();
    keep.forEach(([x, z], i) => { const y = h(x, z); body.setMatrixAt(i, M.makeTranslation(x, y + 0.4, z)); band.setMatrixAt(i, M.makeTranslation(x, y + 0.925, z)); });
    group.add(body, band);
    for (const [x, z] of [[104.5, 10557.8], [120.0, 10559.6], [104.8, 10546.6], [120.4, 10548.6]]) {
      const y = h(x, z);
      for (let k = 0; k < 6; k++) p.box(0.16, 0.2, 0.16, k % 2 ? 0xf4f4f2 : 0x2f5fb8, x, y + 0.1 + k * 0.2, z);
      p.box(0.17, 0.05, 0.17, 0x202124, x, y + 1.22, z);
    }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 600) return;
      if ([[40, 10640], [-86, 10580], [112, 10553], [-130, 10530]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'lennuakadeemia'); }
    },
  };
}
