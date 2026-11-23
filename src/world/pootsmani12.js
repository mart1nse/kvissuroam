// Pootsmani 12, on the east arm of the Pootsmani loop, built by hand from two Street View shots (July 2024,
// from the north-west and the south-west), the Land Board's 2023/2024 oblique photos and the map's own LOD2
// block (base 35) and carport (base 271), which are hidden: a white brick house of two floors under a dark
// metal-tile roof with its ridge along the street, a carport wing in front of its north end under a gable of
// its own (white boards, a slatted screen, the white SUV inside), a porch on two white brick pillars along the
// front, dark brown window frames and a brown front door; a low annex behind the carport; the mesh fence along
// the road with the drive gate, the bin, the young fruit trees on the front lawn, the row of tall thujas on the
// south boundary and the children's play tower in the garden to the north.
// House frame: s metres along the street (south, the ridge direction), v metres across it (east, away from the
// road), from the north-west corner of the carport. The road's centre is at v = -11.3, its east edge at -8.5.
// Guessed (not in the photos): the garden (east) side, the inside of the carport, the window heights upstairs.
import * as THREE from 'three';
import { streetKit, setHouseColours } from './streetkit.js';
import { Parts, BOX } from '../race/landmarks.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

const D = [0.16164, 0.98685], E = [0.98685, -0.16164], O = [-123.2, 153.6];
const L = (s, v) => [O[0] + s * D[0] + v * E[0], O[1] + s * D[1] + v * E[1]];
const TURN = Math.atan2(-D[1], D[0]);                    // the local group: x = s, z = -v
const FENCE = -6.2, EDGE = -8.5;
const COL = {
  brick: 0xf3f1ec, course: 0xdcd9d3, boards: 0xf5f4f1, line: 0xdddbd8, roof: 0x4b4d5a, row: 0x3c3e4a, plinth: 0xb9b7bf,
  frame: 0x5b3f37, glass: 0x6f8c9a, door: 0x8f5040, slat: 0xf1f0ee, concrete: 0xcfccd4, chimney: 0xddd5cc, cap: 0x55565f,
  gutter: 0x52545f, rail: 0xd9dade, wood: 0xa0755a, slide: 0x5fb36c, post: 0x8d989a, bin: 0x4e5560, mail: 0x6d7378,
};

// the map's block and carport are modelled by hand here; no. 14 next door in its pale yellow under a dark roof
export function pootsmani12Walls(walls) {
  setHouseColours(walls, '1_1', -160, -160, [
    { base: 35, x: -114.4, z: 163.4, hide: true, reach: 12 },
    { base: 271, x: -120.2, z: 159.6, hide: true, shelter: true, reach: 9 },
    { base: 24, x: -105.6, z: 184.6, wall: 0xf1e2a8, roof: 0x575a68, reach: 14 },
  ]);
}

// the white SUV in the carport, nose to the road
export const POOTSMANI12_CARS = [
  [...L(3.9, 3.2), Math.atan2(-E[0], E[1]), 'rav4', 'white', 0.17],
];

export function createPootsmani12(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());           // nothing here moves once built (src/still.js)
  scene.add(group);
  let built = false;

  // young fruit trees on the front lawn (planted before the map squares load)
  world.addTrees([
    [...L(-1.5, -3.2), 3.0, 1.0, 0], [...L(0.4, -4.6), 2.6, 0.8, 0], [...L(16.5, -3.6), 2.9, 0.9, 0], [...L(10.6, -4.4), 2.5, 0.75, 0],
  ]);
  // no map trees inside the house, the carport or on the drive
  world.addClearing({ test: (x, z) => {
    const dx = x - O[0], dz = z - O[1], s = dx * D[0] + dz * D[1], v = dx * E[0] + dz * E[1];
    return s > 0.5 && s < 18.6 && v > -8.6 && v < 13.3 && !(s > 12.8 && v < 0);
  } });

  function* build() {
    const K = streetKit(world, group, { shadows, fenceColour: 0xaab5b2 });
    const F = { at: L };
    const gh = (s, v) => world.heightAt(...L(s, v));
    const Y = gh(12, 6) + 0.15;                          // the floor
    const local = new THREE.Group();
    local.position.set(O[0], 0, O[1]);
    local.rotation.y = TURN;
    group.add(local);

    const p = new Parts();
    const add = (geo, hex) => p.add(geo, hex, 0, 0, 0, 0);
    // a box between s0..s1, v0..v1 and heights y0..y1 above the floor
    const box = (s0, s1, v0, v1, y0, y1, hex) => add(BOX(Math.abs(s1 - s0), Math.abs(y1 - y0), Math.abs(v1 - v0)).translate((s0 + s1) / 2, Y + (y0 + y1) / 2, -(v0 + v1) / 2), hex);
    // a convex solid from corner points [s, v, y]; faces are lists of corner numbers, turned outwards
    const solid = (pts, faces, hex) => {
      const P = pts.map((q) => new THREE.Vector3(q[0], Y + q[2], -q[1])), c = P.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(P.length);
      const pos = [], n = new THREE.Vector3(), m = new THREE.Vector3();
      for (const f of faces) for (let k = 1; k < f.length - 1; k++) {
        let t = [P[f[0]], P[f[k]], P[f[k + 1]]];
        n.subVectors(t[1], t[0]).cross(m.subVectors(t[2], t[0]));
        if (n.dot(m.copy(t[0]).sub(c)) < 0) t = [t[0], t[2], t[1]];
        for (const q of t) pos.push(q.x, q.y, q.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      add(g, hex);
    };
    // a prism along s (s0..s1) over a convex outline [[v, y], ...] in the plane across it
    const prismS = (s0, s1, outline, hex) => {
      const n = outline.length, pts = [...outline.map(([v, y]) => [s0, v, y]), ...outline.map(([v, y]) => [s1, v, y])];
      const faces = [[...Array(n).keys()], [...Array(n).keys()].map((k) => k + n)];
      for (let k = 0; k < n; k++) faces.push([k, (k + 1) % n, (k + 1) % n + n, k + n]);
      solid(pts, faces, hex);
    };
    // a roof plate from the eave (v0, y0) to the ridge (v1, y1) along s0..s1, 0.12 thick, with rows of tiles
    const plate = (s0, s1, v0, y0, v1, y1, rows = true) => {
      prismS(s0, s1, [[v0, y0], [v1, y1], [v1, y1 + 0.12], [v0, y0 + 0.12]], COL.roof);
      if (!rows) return;
      const n = Math.floor(Math.hypot(v1 - v0, y1 - y0) / 0.36);
      for (let k = 1; k < n; k++) { const f = k / n, v = v0 + (v1 - v0) * f, y = y0 + (y1 - y0) * f + 0.12; box(s0, s1, v - 0.03, v + 0.03, y, y + 0.035, COL.row); }
    };
    // windows in a wall facing -v (sign -1) or +v at v, and in a wall facing -s or +s at s
    const winV = (s0, s1, y0, y1, v, sign, { mull = 0, hex = COL.glass } = {}) => {
      box(s0 - 0.08, s1 + 0.08, v, v + sign * 0.06, y0 - 0.08, y1 + 0.08, COL.frame);
      box(s0, s1, v, v + sign * 0.09, y0, y1, hex);
      for (let k = 1; k <= mull; k++) { const s = s0 + (s1 - s0) * k / (mull + 1); box(s - 0.04, s + 0.04, v, v + sign * 0.11, y0, y1, COL.frame); }
      box(s0 - 0.12, s1 + 0.12, v, v + sign * 0.14, y0 - 0.13, y0 - 0.08, COL.concrete);           // sill
    };
    const winS = (v0, v1, y0, y1, s, sign, { mull = 0 } = {}) => {
      box(s, s + sign * 0.06, v0 - 0.08, v1 + 0.08, y0 - 0.08, y1 + 0.08, COL.frame);
      box(s, s + sign * 0.09, v0, v1, y0, y1, COL.glass);
      for (let k = 1; k <= mull; k++) { const v = v0 + (v1 - v0) * k / (mull + 1); box(s, s + sign * 0.11, v - 0.04, v + 0.04, y0, y1, COL.frame); }
      box(s, s + sign * 0.14, v0 - 0.12, v1 + 0.12, y0 - 0.13, y0 - 0.08, COL.concrete);
    };

    // ================= the main house: s 6.45..18, v 1.4..12.8; eaves 4.3 (street) and 3.6 (garden), ridge 6.5
    const S0 = 6.45, S1 = 18, V0 = 1.4, V1 = 12.8, RV = 6.33, RY = 6.5, WY = 4.3, EY = 3.6, PITCH = (RY - WY) / (RV - V0);
    box(S0, S1, V0, V1, -0.6, EY, COL.brick);
    prismS(S0, S1, [[V0, EY], [V1, EY], [RV, RY], [V0, WY]], COL.brick);
    box(S0 - 0.03, S1 + 0.03, V0 - 0.03, V1 + 0.03, -0.6, 0.3, COL.plinth);
    for (let y = 0.75; y < WY; y += 0.45) box(S0, S1, V0 - 0.02, V0, y, y + 0.025, COL.course);          // brick courses, street side
    for (let y = 0.75; y < EY; y += 0.45) box(S1, S1 + 0.02, V0, V1, y, y + 0.025, COL.course);         // and the south gable
    plate(S0 - 0.35, S1 + 0.35, V0 - 0.45, WY - 0.45 * PITCH, RV, RY + 0.02);
    plate(S0 - 0.35, S1 + 0.35, V1 + 0.45, EY - 0.45 * PITCH, RV, RY + 0.02);
    box(S0 - 0.35, S1 + 0.35, RV - 0.12, RV + 0.12, RY + 0.08, RY + 0.22, COL.row);                   // ridge cap
    box(S0 - 0.35, S1 + 0.35, V0 - 0.62, V0 - 0.47, WY - 0.6, WY - 0.45, COL.gutter);                // gutters, downpipes
    box(S0 - 0.35, S1 + 0.35, V1 + 0.47, V1 + 0.62, EY - 0.6, EY - 0.45, COL.gutter);
    for (const s of [S0 + 0.15, S1 - 0.15]) { box(s - 0.05, s + 0.05, V0 - 0.6, V0 - 0.5, 0, WY - 0.5, COL.gutter); box(s - 0.05, s + 0.05, V1 + 0.5, V1 + 0.6, 0, EY - 0.5, COL.gutter); }
    yield;
    // street side: the front door between the porch pillars, narrow windows beside it, wide pairs at the south end
    winV(7.0, 7.45, 0.95, 2.15, V0, -1);
    box(8.2, 9.2, V0, V0 - 0.07, 0.15, 2.3, COL.frame); box(8.28, 9.12, V0, V0 - 0.1, 0.15, 2.22, COL.door);
    box(8.5, 8.9, V0, V0 - 0.12, 1.2, 2.05, COL.glass);
    for (const s of [8.62, 8.78]) box(s - 0.02, s + 0.02, V0, V0 - 0.14, 1.2, 2.05, COL.door);
    box(8.9, 9.0, V0, V0 - 0.16, 1.0, 1.1, 0xc9b27a);                                                 // handle
    for (const s of [7.85, 9.55]) { box(s - 0.08, s + 0.08, V0, V0 - 0.12, 1.85, 2.15, 0xf6f6f2); box(s - 0.05, s + 0.05, V0 - 0.12, V0 - 0.14, 1.9, 2.1, 0xfff4cf); }
    winV(10.3, 10.8, 0.95, 2.15, V0, -1);
    winV(14.3, 16.1, 0.95, 2.15, V0, -1, { mull: 1 });
    winV(7.3, 8.5, 3.05, 3.95, V0, -1, { mull: 1 });
    winV(9.95, 10.4, 3.4, 3.95, V0, -1);
    winV(12.6, 13.5, 3.05, 3.95, V0, -1);
    winV(14.3, 16.1, 3.05, 3.95, V0, -1, { mull: 1 });
    // south gable: two windows downstairs, one in the gable, the small balcony with its door, the dish
    winS(2.8, 4.4, 0.95, 2.15, S1 + 0.02, 1, { mull: 1 }); winS(7.8, 9.2, 0.95, 2.15, S1 + 0.02, 1, { mull: 1 });
    winS(4.6, 5.8, 3.1, 4.3, S1 + 0.02, 1, { mull: 1 });
    box(S1, S1 + 0.08, 9.35, 10.35, 2.95, 4.55, COL.frame); box(S1, S1 + 0.1, 9.45, 10.25, 3.05, 4.45, COL.glass);
    box(S1, S1 + 0.95, 9.0, 11.3, 2.8, 2.95, COL.concrete);
    for (const [a, b, c, d] of [[S1 + 0.9, S1 + 0.95, 9.0, 11.3], [S1, S1 + 0.95, 9.0, 9.05], [S1, S1 + 0.95, 11.25, 11.3]]) box(a, b, c, d, 3.9, 3.96, COL.rail);
    for (let v = 9.1; v < 11.3; v += 0.12) box(S1 + 0.9, S1 + 0.93, v, v + 0.02, 2.95, 3.9, COL.rail);
    for (let s = S1 + 0.1; s < S1 + 0.9; s += 0.12) { box(s, s + 0.02, 9.0, 9.03, 2.95, 3.9, COL.rail); box(s, s + 0.02, 11.27, 11.3, 2.95, 3.9, COL.rail); }
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16).rotateZ(Math.PI / 2).translate(S1 + 0.28, Y + 4.6, -11.6), 0xe9e9ec);
    box(S1, S1 + 0.25, 11.57, 11.63, 4.55, 4.65, COL.gutter);
    // north gable over the carport and the annex; garden side (guessed): windows and the terrace door
    winS(7.6, 8.6, 3.1, 3.95, S0 - 0.02, -1, { mull: 1 });
    winV(8.0, 9.4, 0.95, 2.15, V1, 1, { mull: 1 }); winV(13.2, 15.2, 0.1, 2.15, V1, 1, { mull: 1 }); winV(16.2, 17.2, 0.95, 2.15, V1, 1);
    box(12.8, 16.2, V1, V1 + 3.0, -0.3, 0.05, COL.wood);                                                // terrace deck
    // chimneys and the aerial mast
    for (const [s, v, top] of [[9.0, 6.05, 7.35], [7.1, 3.4, 6.9]]) { box(s - 0.3, s + 0.3, v - 0.3, v + 0.3, 3.5, top, COL.chimney); box(s - 0.36, s + 0.36, v - 0.36, v + 0.36, top, top + 0.08, COL.cap); box(s - 0.18, s + 0.18, v - 0.18, v + 0.18, top + 0.08, top + 0.28, COL.cap); }
    box(12.0, 12.05, 6.6, 6.65, RY - 0.2, RY + 2.0, COL.gutter); box(11.4, 12.6, 6.6, 6.65, RY + 1.7, RY + 1.73, COL.gutter); box(12.0, 12.05, 6.1, 7.2, RY + 1.9, RY + 1.93, COL.gutter);
    yield;

    // ================= carport wing: s 1.0..6.45, v -0.1..6.4, eaves 2.5, its own gable to the north (ridge 4.45)
    const CS = 1.0, CV0 = -0.1, CV1 = 6.4, CE = 2.5, CR = 4.45, CRV = (CV0 + CV1) / 2;
    box(CS, CS + 0.15, CV0, CV1, -0.4, CE, COL.boards);                                                // closed north end
    prismS(CS, S0, [[CV0, CE], [CV1, CE], [CRV, CR]], COL.boards);                                    // the gable and the carport's ceiling
    for (let y = 0.2; y < CR - 0.15; y += 0.22) {                                                     // board lines
      const w = y < CE ? 0 : (y - CE) / (CR - CE) * (CRV - CV0);
      box(CS - 0.02, CS, CV0 + w + 0.05, CV1 - w - 0.05, y, y + 0.02, COL.line);
    }
    for (const v of [1.2, 4.9]) add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).rotateZ(Math.PI / 2).translate(CS - 0.02, Y + 3.0, -v), 0x55575f);   // round vents
    const CP = (CR - CE) / (CRV - CV0);
    plate(CS - 0.3, S0, CV0 - 0.4, CE - 0.4 * CP, CRV, CR + 0.02);
    plate(CS - 0.3, S0, CV1 + 0.4, CE - 0.4 * CP, CRV, CR + 0.02);
    box(CS - 0.3, S0, CRV - 0.1, CRV + 0.1, CR + 0.08, CR + 0.2, COL.row);
    box(CS - 0.3, S0, CV0 - 0.55, CV0 - 0.42, CE - 0.5, CE - 0.37, COL.gutter);
    box(CS + 0.05, CS + 0.15, CV0 - 0.55, CV0 - 0.45, 0, CE - 0.5, COL.gutter);
    // brick pillars at the open front, the slatted screen between the first two
    for (const s of [CS + 0.18, 3.55, 6.25]) box(s - 0.19, s + 0.19, CV0, CV0 + 0.38, -0.3, CE, COL.brick);
    for (let y = 0.1; y < 1.95; y += 0.14) box(CS + 0.37, 3.36, CV0 + 0.14, CV0 + 0.24, y, y + 0.1, COL.slat);
    box(CS, S0, CV0, CV1, -0.4, 0.02, COL.concrete);                                                   // the carport floor
    yield;

    // ================= the porch along the front, s 6.45..12.6: lean-to roof from under the upstairs windows
    const PS1 = 12.6, PV = -0.15, PY = 2.45, PW = 2.85;
    box(S0, PS1, PV, V0, -0.4, 0.15, COL.concrete);
    box(7.4, 9.9, PV - 0.45, PV, -0.4, 0.0, COL.concrete);                                            // step
    prismS(S0, PS1 + 0.3, [[PV - 0.35, PY - 0.08], [V0, PW], [V0, PW + 0.12], [PV - 0.35, PY + 0.04]], COL.roof);
    box(S0, PS1 + 0.3, PV - 0.5, PV - 0.37, PY - 0.25, PY - 0.1, COL.gutter);
    for (const s of [7.05, 12.25]) box(s - 0.19, s + 0.19, PV + 0.02, PV + 0.4, 0.15, PY - 0.06, COL.brick);
    // flowers in pots by the door
    for (const [s, v, hex] of [[11.6, 0.2, 0x9a6ac4], [11.9, 0.55, 0xc46aa0], [7.55, 0.3, 0xd8708a]]) { box(s - 0.17, s + 0.17, v - 0.17, v + 0.17, 0.15, 0.5, 0x6d6f78); add(new THREE.IcosahedronGeometry(0.26, 0).scale(1, 0.75, 1).translate(s, Y + 0.68, -v), hex); }

    // ================= the low annex behind the carport: s 1.07..6.45, v 6.4..10.4, flat roof
    box(1.07, S0, CV1, 10.4, -0.4, 2.6, COL.boards);
    box(0.85, S0, CV1, 10.62, 2.6, 2.74, COL.roof);
    for (let y = 0.2; y < 2.6; y += 0.22) box(1.05, 1.07, CV1 + 0.05, 10.35, y, y + 0.02, COL.line);
    winS(7.9, 9.0, 1.0, 1.8, 1.05, -1);
    yield;

    // ================= the garden: play tower with a slide and a swing (north, behind the carport line)
    {
      const ps = -2.8, pv = 5.2, py = gh(ps, pv) - Y;
      for (const [a, b] of [[0, 0], [1.4, 0], [0, 1.4], [1.4, 1.4]]) box(ps + a - 0.05, ps + a + 0.05, pv + b - 0.05, pv + b + 0.05, py, py + 2.4, COL.wood);
      box(ps - 0.05, ps + 1.45, pv - 0.05, pv + 1.45, py + 1.2, py + 1.28, COL.wood);
      box(ps, ps + 1.4, pv, pv + 0.04, py + 1.28, py + 1.9, COL.wood); box(ps, ps + 1.4, pv + 1.36, pv + 1.4, py + 1.28, py + 1.9, COL.wood);
      prismS(ps - 0.15, ps + 1.55, [[pv - 0.2, py + 2.35], [pv + 1.6, py + 2.35], [pv + 0.7, py + 3.05]], 0x6a5550);
      solid([[ps - 0.05, pv - 0.3, py + 1.28], [ps - 0.05, pv + 0.25, py + 1.28], [ps - 2.4, pv - 0.3, py + 0.12], [ps - 2.4, pv + 0.25, py + 0.12],
        [ps - 0.05, pv - 0.3, py + 1.34], [ps - 0.05, pv + 0.25, py + 1.34], [ps - 2.4, pv - 0.3, py + 0.18], [ps - 2.4, pv + 0.25, py + 0.18]],
      [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]], COL.slide);
      const sv = pv + 1.45;                                                                          // swing beam on A legs
      for (const s of [ps - 0.1, ps + 1.5]) for (const dv of [-0.45, 0.45]) {
        const g = BOX(0.07, 2.25, 0.07).rotateX(dv > 0 ? -0.2 : 0.2).translate(s, Y + py + 1.1, -(sv + 1.2 + dv)); add(g, COL.wood);
      }
      box(ps - 0.15, ps + 1.55, sv + 1.15, sv + 1.25, py + 2.15, py + 2.25, COL.wood);
      for (const s of [ps + 0.3, ps + 1.1]) { box(s - 0.01, s + 0.01, sv + 1.19, sv + 1.21, py + 0.45, py + 2.15, 0x8b8f96); box(s - 0.22, s + 0.22, sv + 1.08, sv + 1.32, py + 0.42, py + 0.47, 0x3f7fc0); }
    }
    yield;

    // ================= the street front: lawn, the drive and path, the fence and gate, bin and mailbox
    K.ribbon(F, -4, 1.3, EDGE + 0.1, -0.2, 'lawn', true);
    K.ribbon(F, 6.4, 21.5, EDGE + 0.1, PV - 0.5, 'lawn', true);
    K.ribbon(F, 1.3, 6.4, EDGE + 0.05, CV0, 'paver', true);                                          // the drive
    K.ribbon(F, 6.4, 12.9, PV - 1.1, PV - 0.5, 'paver', true);                                       // path along the porch
    K.ribbon(F, 12.9, 18.4, PV - 1.0, V0 - 0.2, 'paver', true);
    K.fence(F, -4, 1.3, FENCE, 1.2, COL.post);
    K.fence(F, 6.4, 21.5, FENCE, 1.2, COL.post);
    for (const [a, b] of [[[-4, FENCE], [-4, 2.0]], [[-4, 2.0], [-4, 12]], [[-4, 12], [-4, 22]]]) K.panel(L(...a), L(...b), 1.2);   // north boundary
    // the sliding gate stands open behind the fence, south of the drive
    { const a = L(6.5, FENCE + 0.25), b = L(11.4, FENCE + 0.25); K.panel(a, b, 1.15); }
    for (const s of [1.3, 6.4]) { const q = L(s, FENCE); K.box(q[0], q[1], 0.1, 1.4, 0.1, COL.post); }
    { const q = L(6.95, FENCE - 0.35), yaw = TURN; K.box(q[0], q[1], 0.06, 1.0, 0.06, COL.post); K.box(q[0], q[1], 0.42, 0.32, 0.22, COL.mail, yaw, 1.0); }
    { const q = L(7.4, FENCE - 1.0), yaw = TURN; K.box(q[0], q[1], 0.58, 0.95, 0.58, COL.bin, yaw); K.box(q[0], q[1], 0.64, 0.07, 0.64, COL.bin, yaw, 0.95); }
    // plants: the flower bed under the south windows, a mountain pine by the porch, the thuja row to the south
    const T = (s, v) => L(s, v);
    for (const [s, v, r, h, tint] of [[13.4, -0.4, 0.55, 0.7, [1.25, 1.15, 0.45]], [14.6, -0.45, 0.5, 0.6, [1.1, 0.7, 1.1]], [15.8, -0.4, 0.55, 0.75, [0.9, 1.05, 0.85]], [17.0, -0.45, 0.5, 0.65, [1.3, 1.0, 0.5]], [13.0, -0.9, 0.95, 1.2, [0.7, 0.85, 0.7]]]) {
      const [x, z] = T(s, v); K.leafy.bush(x, gh(s, v) - 0.05, z, r * 2.4, h, s * 7, tint);
    }
    for (const [s, v] of [[-0.6, -0.5], [-2.2, -0.6], [1.9, 7.2]]) { const [x, z] = T(s, v); K.leafy.bush(x, gh(s, v) - 0.05, z, 1.9, 1.3, s * 5, [0.8, 0.95, 0.8]); }
    for (let k = 0, v = -0.6; v < 19; v += 0.85, k++) { const [x, z] = T(21.8 + (k % 2) * 0.15, v); K.thuja(x, z, 3.6 + ((k * 7) % 5) * 0.22, 0.5, k); }
    { const [x, z] = T(12.9, -0.3); K.thuja(x, z, 1.4, 0.65, 2); }
    yield;

    // ---- one mesh for all the boxes, then the ground, fence and plants
    const body = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.castShadow = shadows; body.receiveShadow = true;
    local.add(body);
    K.finish();

    // (nothing added to what a car hits: the map's own block and carport stay solid under the hand-built ones)
  }

  const C = L(9, 0);
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - C[0], car.z - C[1]) > 450) return;
      if ([[0, -11], [20, -11], [9, 12], [-4, 6]].every((q) => world.ready(...L(q[0], q[1])))) { built = true; jobs.add(build, 'pootsmani12'); }
    },
  };
}
