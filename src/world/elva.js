// Elva tänav 35b in Tartu and its neighbours 35c and 37, built by hand from the Land Board's oblique air
// photos (April/May 2023 and 2024, from all four sides) in place of the map's blocks:
//  - 35b: the white two-storey house with the low dark hipped roof, two plastered chimneys, brown window
//    frames, the flat canopy over the front window and door, the rear wing on its south-west half with its
//    gable to the back garden and the little side porch towards the lane. Its garden behind a low white
//    rendered wall that turns the corner into the lane to Riia street, a dark metal gate and car gate, the lawn,
//    the tall spruce at the east corner, the row of thujas between it and 35c, and the long white polytunnel
//    in the back garden. A dark saloon stands outside the car gate in the lane.
//  - 35c: the big cream house with its hipped roofs (the main block and the deep wing at its north-east end),
//    the low carport in front of the wing, the low mesh fence on posts, the round shrub bed and the flagpole.
//  - 37: across the lane, the small white one-and-a-half storey house with its steep grey gable roof, half hidden
//    in its trees, the low rear annex and the shed, the weathered picket fence, the trampoline; a white estate at
//    the kerb before it.
// What the photos do not show (door and gate colours, the exact window panes) is guessed. No street name is
// painted on the road.
// Everything is laid out in a street frame: s metres along Elva (positive to the south-west, s = 0 opposite the
// middle of 35b's front) and v metres from the map's centre line of the road towards the odd-numbered side.
import * as THREE from 'three';
import { streetKit, setHouseColours } from './streetkit.js';
import { facadeKit, render, win, door, lantern, groundTextures, groundLayer, fenceMesh, signPlate, planks } from './arhitekti.js';
import { BOX } from '../race/landmarks.js';

// the street frame
const O = [238.18, 4755.58];                         // on the centre line, opposite the middle of 35b's front
const D = [-0.775, 0.632], N = [-0.632, -0.775];     // along the street (south-west), across it (to 35b)
const L = (s, v) => [O[0] + D[0] * s + N[0] * v, O[1] + D[1] * s + N[1] * v];
const F = { at: (s, v) => L(s, v) };                 // the frame for streetKit and the ground layers
const YAW = Math.atan2(N[0], N[1]);                  // a box turned so that its x runs along s and its z along v
const CENTRE = L(0, 14);

// ---------------------------------------------------------------- what the map's own data needs
// The map's blocks for the three houses (LOD2 bases in cm, sector 1_8) are replaced by the ones built here.
export function elvaWalls(walls) {
  setHouseColours(walls, '1_8', -160, 4320, [
    { base: 3804, x: 228.4, z: 4744.0, wall: 0xeceae2, hide: true, reach: 11 },        // 35b
    { base: 3648, x: 247.0, z: 4724.7, wall: 0xece6d2, hide: true, reach: 14 },        // 35c
    { base: 3953, x: 256.0, z: 4730.6, wall: 0xece6d2, hide: true, reach: 6 },         // 35c's carport
    { base: 3953, x: 256.0, z: 4730.6, wall: 0xece6d2, hide: true, reach: 6, shelter: true },   // (its roof and posts)
    { base: 3906, x: 206.8, z: 4760.8, wall: 0xe8e6de, hide: true, reach: 11 },        // 37
  ]);
}
// Parked cars for src/world/parked.js: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw)).
// The dark saloon outside 35b's car gate in the lane, facing up it; a white estate at the kerb before 37
// (in the photo it is a small white van), facing south-west.
const UP_LANE = Math.atan2(N[0], -N[1]), SOUTH_WEST = Math.atan2(D[0], -D[1]);
export const ELVA_CARS = [
  [...L(12.75, 17.2), UP_LANE, 'mazda6', 'grey', 0.03],
  [...L(35.5, 3.15), SOUTH_WEST, 'passat', 'white', 0.03],
];

// ---------------------------------------------------------------- colours
const COL = {
  white: '#eceae2', white2: '#e4e2da', cream: '#ece6d2', cream2: '#e3dcc6', white37: '#e9e7df',
  plinth: '#a9a59c', frameBrown: '#6e4b3a', glass: '#4d5866', frameWhite: '#f3f2ee',
  roof: 0x58575d, roofC: 0x55545b, roof37: 0x707075, fascia: 0x4b4a50, chimney: 0xd9d5cc, cap: 0x8e8c91,
  wall: 0xeeece6, wallCap: 0xb9b6b0, gate: [62, 64, 70], gateHex: 0x3d3f45, post: 0x5d5f64,
  picket: [150, 140, 122], shed: [92, 78, 66], canopy: 0xd6d4ce, flag: 0xf2f2f0,
};

// ---------------------------------------------------------------- the build
export function createElva(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // keep the map's trees out of 35b's and 35c's gardens (37 keeps its own, they are its real trees); the
  // spruce and the thujas are planted here instead
  world.addClearing({ test: (x, z) => {
    const rx = x - O[0], rz = z - O[1], s = rx * D[0] + rz * D[1], v = rx * N[0] + rz * N[1];
    return s > -33.5 && s < 11.4 && v > 3.2 && v < 34;
  } });
  const TREES = [
    [...L(-12.2, 7.0), 12.5, 5.2, 1],                // the tall spruce between the two front gardens
    [...L(-34.6, 7.5), 10.5, 4.6, 1],                // and one at 35c's north-east corner
    [...L(-12.5, 27.5), 6.2, 4.8, 0],                // a fruit tree in 35c's back garden, white with blossom in May
    // 37 stands half hidden in its trees: birches by the lane, a broad tree before the house
    [...L(18.8, 7.2), 13, 3.4, 0], [...L(20.6, 11.8), 12, 3.0, 0], [...L(19.6, 20.5), 11, 3.2, 0],
    [...L(26.8, 6.4), 11, 7.5, 0], [...L(32.2, 6.2), 9, 6, 0],
  ];
  world.addTrees(TREES);

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows, fenceColour: 0x6b6d72 });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const hl = (s, v) => h(...L(s, v));
    const FK = facadeKit(group, shadows);
    // a box by its extents in the frame; y0, y1 above gy
    const block = (s0, s1, v0, v1, gy, y0, y1, c) => { const [x, z] = L((s0 + s1) / 2, (v0 + v1) / 2); p.add(BOX(s1 - s0, y1 - y0, v1 - v0), c, x, gy + (y0 + y1) / 2, z, YAW); };
    // a painted wall from frame point a to b (seen from outside, a on the left)
    const wall = (a, b, gy, y0, y1, base, draw, opts) => FK.wall(L(...a), L(...b), gy, y0, y1, base, draw, opts);
    // triangles (both windings, so roofs show from below too) from frame points [s, v, y]
    const tris = (list, c) => {
      const pos = [];
      for (const t of list) {
        const q = t.map(([s, v, y]) => { const [x, z] = L(s, v); return [x, y, z]; });
        pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      p.add(g, c, 0, 0, 0);
    };
    const quad = (a, b, c2, d) => [[a, b, c2], [a, c2, d]];
    // a hipped roof over s0..s1, v0..v1 (eaves at ye, ridge at yr, both above gy), eaves overhanging by ov
    const hipRoof = (s0, s1, v0, v1, gy, ye, yr, ov, c) => {
      const along = s1 - s0 >= v1 - v0, half = (along ? v1 - v0 : s1 - s0) / 2 + ov, k = (yr - ye) / (half - ov);
      const y = gy + ye - ov * k, R = gy + yr;
      const a = [s0 - ov, v0 - ov, y], b = [s1 + ov, v0 - ov, y], cc = [s1 + ov, v1 + ov, y], d = [s0 - ov, v1 + ov, y];
      const list = [];
      if (along) {
        const vm = (v0 + v1) / 2, r1 = [s0 - ov + half, vm, R], r2 = [s1 + ov - half, vm, R];
        list.push(...quad(a, b, r2, r1), [b, cc, r2], ...quad(cc, d, r1, r2), [d, a, r1]);
      } else {
        const sm = (s0 + s1) / 2, r1 = [sm, v0 - ov + half, R], r2 = [sm, v1 + ov - half, R];
        list.push(...quad(d, a, r1, r2), [a, b, r1], ...quad(b, cc, r2, r1), [cc, d, r2]);
      }
      tris(list, c);
      block(s0 - ov, s1 + ov, v0 - ov, v1 + ov, gy, ye - ov * k - 0.05, ye - ov * k - 0.01, 0xd9d6cf);     // the soffit under the eaves
      // the fascia boards round the eaves
      block(s0 - ov, s1 + ov, v0 - ov - 0.03, v0 - ov + 0.03, gy, ye - ov * k - 0.16, ye - ov * k + 0.01, COL.fascia);
      block(s0 - ov, s1 + ov, v1 + ov - 0.03, v1 + ov + 0.03, gy, ye - ov * k - 0.16, ye - ov * k + 0.01, COL.fascia);
      block(s0 - ov - 0.03, s0 - ov + 0.03, v0 - ov, v1 + ov, gy, ye - ov * k - 0.16, ye - ov * k + 0.01, COL.fascia);
      block(s1 + ov - 0.03, s1 + ov + 0.03, v0 - ov, v1 + ov, gy, ye - ov * k - 0.16, ye - ov * k + 0.01, COL.fascia);
    };
    // a gable roof with its ridge along v at sm, from va to vb (the gable end at vb), eaves at ye
    const gableRoof = (s0, s1, va, vb, gy, ye, yr, ov, c, gableCol) => {
      const sm = (s0 + s1) / 2, k = (yr - ye) / (sm - s0), y = gy + ye - ov * k, R = gy + yr;
      const a = [s0 - ov, va, y], b = [s1 + ov, va, y], cc = [s1 + ov, vb + ov, y], d = [s0 - ov, vb + ov, y], r1 = [sm, va, R], r2 = [sm, vb + ov, R];
      tris([...quad(a, r1, r2, d), ...quad(r1, b, cc, r2)], c);
      tris([[[s0, vb, gy + ye], [s1, vb, gy + ye], [sm, vb, R - 0.05]]], gableCol);     // the gable wall
    };
    const flatRoof = (s0, s1, v0, v1, gy, y, c = 0x7c7b80) => {
      block(s0, s1, v0, v1, gy, y, y + 0.08, c);
      block(s0 - 0.04, s1 + 0.04, v0 - 0.04, v0 + 0.05, gy, y - 0.1, y + 0.12, 0x6c6b70);
      block(s0 - 0.04, s1 + 0.04, v1 - 0.05, v1 + 0.04, gy, y - 0.1, y + 0.12, 0x6c6b70);
      block(s0 - 0.04, s0 + 0.05, v0, v1, gy, y - 0.1, y + 0.12, 0x6c6b70);
      block(s1 - 0.05, s1 + 0.04, v0, v1, gy, y - 0.1, y + 0.12, 0x6c6b70);
    };
    const chimney = (s, v, gy, y0, y1, w = 0.6) => {
      block(s - w / 2, s + w / 2, v - w / 2, v + w / 2, gy, y0, y1, COL.chimney);
      block(s - w / 2 - 0.06, s + w / 2 + 0.06, v - w / 2 - 0.06, v + w / 2 + 0.06, gy, y1, y1 + 0.08, COL.cap);
    };
    const winB = (P, x0, ya, x1, yb, o = {}) => win(P, x0, ya, x1, yb, { frame: COL.frameBrown, glass: COL.glass, ...o });
    const winW = (P, x0, ya, x1, yb, o = {}) => win(P, x0, ya, x1, yb, { frame: COL.frameWhite, glass: COL.glass, ...o });
    const plinth = (P, len, top = 0.45) => P.r(0, -0.4, len, top, COL.plinth);

    // ================= 35b =================
    const G = hl(0, 15) - 0.02, E = 6.35;               // ground line, eaves
    const S0 = -6.65, S1 = 6.65, V0 = 10.05, V1 = 20.1, W0 = 0.6, W1 = 23.6;    // main block, rear wing (s W0..S1, v V1..W1)
    block(S0, S1, V0, V1, G, -0.6, E, 0xeceae2);
    block(W0, S1, V1 - 0.1, W1, G, -0.6, E, 0xeceae2);
    hipRoof(S0, S1, V0, V1, G, E, 7.75, 0.45, COL.roof);
    gableRoof(W0, S1, 16.0, W1, G, E, 7.45, 0.45, COL.roof, 0xe9e7df);
    chimney(3.2, 15.3, G, 6.5, 8.45);
    chimney(-3.4, 13.4, G, 6.5, 8.3, 0.55);
    // the front: two windows upstairs, the window on the left downstairs, the flat canopy over the wide
    // window and the door
    wall([S1, V0], [S0, V0], G, -0.35, E, COL.white, (P, len) => {
      render(P, len, -0.35, E, COL.white, 101, 0.6);
      plinth(P, len);
      winB(P, 1.7, 3.95, 3.45, 5.3, { bars: 1 });
      winB(P, 5.7, 3.95, 7.55, 5.3, { bars: 1 });
      winB(P, 1.7, 0.95, 3.45, 2.3, { bars: 1 });
      winB(P, 5.35, 0.9, 8.35, 2.3, { bars: 2 });
      door(P, 8.75, 9.6, 0.45, 2.05, '#5f3f2f', { frame: '#4a3226', boards: 0.11, handle: '#c8c3b8' });
      lantern(P, 10.05, 2.25);
    });
    block(S1 - 9.65, S1 - 4.15, V0 - 1.05, V0, G, 2.62, 2.74, COL.canopy);                 // the canopy
    block(S1 - 9.65, S1 - 4.15, V0 - 1.08, V0 - 1.02, G, 2.55, 2.76, 0x9d9a95);
    for (let k = 0; k < 2; k++) block(S1 - 9.7, S1 - 8.65, V0 - 0.35 - k * 0.32, V0 - k * 0.32, G, -0.2, 0.45 - k * 0.15, 0xb3afa8);   // the door steps
    // north-east end
    wall([S0, V0], [S0, V1], G, -0.35, E, COL.white, (P, len) => {
      render(P, len, -0.35, E, COL.white, 103, 0.6);
      plinth(P, len);
      for (const x of [1.0, 4.3]) winB(P, x, 3.95, x + 1.3, 5.2);
      for (const x of [1.0, 4.3, 7.6]) winB(P, x, 1.0, x + 1.3, 2.25);
    });
    // the back of the main block, with the garden door
    wall([S0, V1], [W0, V1], G, -0.35, E, COL.white, (P, len) => {
      render(P, len, -0.35, E, COL.white, 105, 0.7);
      plinth(P, len);
      winB(P, 1.6, 3.95, 2.85, 5.2); winB(P, 4.2, 3.95, 5.45, 5.2);
      winB(P, 1.6, 1.0, 2.85, 2.25);
      door(P, 4.4, 5.25, 0.45, 2.05, '#5f3f2f', { frame: '#4a3226', glass: '#55606b' });
    });
    block(S0 + 4.25, S0 + 5.4, V1, V1 + 0.6, G, -0.2, 0.42, 0xb3afa8);
    // the rear wing: its side to the garden and its gable end
    wall([W0, V1], [W0, W1], G, -0.35, E, COL.white, (P, len) => { render(P, len, -0.35, E, COL.white, 107, 0.6); plinth(P, len); winB(P, 1.2, 4.0, 2.3, 5.1); });
    wall([W0, W1], [S1, W1], G, -0.35, E, COL.white, (P, len) => {
      render(P, len, -0.35, E, COL.white, 109, 0.7);
      plinth(P, len);
      winB(P, 1.4, 3.95, 3.6, 5.2, { bars: 2 });
      winB(P, 1.0, 1.4, 1.8, 2.1, { bars: 0 }); winB(P, 2.7, 1.4, 3.5, 2.1, { bars: 0 });
    });
    // the south-west end towards the lane
    wall([S1, W1], [S1, V0], G, -0.35, E, COL.white, (P, len) => {
      render(P, len, -0.35, E, COL.white, 111, 0.6);
      plinth(P, len);
      for (const x of [3.6, 9.0]) winB(P, x, 3.95, x + 1.25, 5.2);
      winB(P, 9.3, 1.0, 10.6, 2.25);
    });
    // the little side porch with its door to the drive
    const PS = 8.35, PV0 = 16.4, PV1 = 21.4, PH = 2.85;
    block(S1, PS, PV0, PV1, G, -0.5, PH, 0xe4e2da);
    flatRoof(S1 - 0.05, PS + 0.12, PV0 - 0.12, PV1 + 0.12, G, PH);
    wall([PS, PV1], [PS, PV0], G, -0.3, PH, COL.white2, (P, len) => {
      render(P, len, -0.3, PH, COL.white2, 113, 0.5); plinth(P, len, 0.35);
      door(P, 1.6, 2.5, 0.35, 2.05, '#6a4634', { frame: '#4a3226', glass: '#59646f' });
      winB(P, 3.4, 1.1, 4.3, 2.0, { bars: 0 });
    });
    wall([S1, PV0], [PS, PV0], G, -0.3, PH, COL.white2, (P, len) => { render(P, len, -0.3, PH, COL.white2, 115, 0.5); plinth(P, len, 0.35); });
    wall([PS, PV1 - 0.001], [S1, PV1], G, -0.3, PH, COL.white2, (P, len) => { render(P, len, -0.3, PH, COL.white2, 117, 0.5); plinth(P, len, 0.35); });
    for (let k = 0; k < 2; k++) block(PS, PS + 0.7 - k * 0.32, PV1 - 3.0, PV1 - 1.8, G, -0.2, 0.32 - k * 0.14, 0xb3afa8);

    // ================= 35c =================
    const GC = hl(-23, 18) - 0.02, EC = 6.1;
    // A: the main block; B: the deep wing at the north-east end; C: the low back room; the carport before B
    block(-26.0, -16.4, 13.15, 22.0, GC, -0.6, EC, 0xece6d2);
    block(-32.2, -26.0, 11.1, 26.25, GC, -0.6, EC, 0xece6d2);
    block(-26.0, -22.6, 22.0, 26.25, GC, -0.6, 3.0, 0xe3dcc6);
    hipRoof(-26.0, -16.4, 13.15, 22.0, GC, EC, 8.2, 0.5, COL.roofC);
    hipRoof(-32.2, -26.0, 11.1, 26.25, GC, EC, 8.3, 0.5, COL.roofC);
    hipRoof(-26.0, -22.6, 22.0, 26.25, GC, 3.0, 3.9, 0.35, COL.roofC);
    chimney(-21.2, 17.6, GC, 7.0, 9.0);
    wall([-16.4, 13.15], [-26.0, 13.15], GC, -0.35, EC, COL.cream, (P, len) => {
      render(P, len, -0.35, EC, COL.cream, 121, 0.5); plinth(P, len);
      winW(P, 1.6, 3.9, 2.9, 5.2); winW(P, 5.0, 3.9, 6.3, 5.2); winW(P, 8.0, 3.9, 9.0, 5.2);
      winW(P, 1.6, 0.95, 2.9, 2.25); winW(P, 4.6, 0.95, 6.6, 2.25, { bars: 2 });
      door(P, 7.9, 8.85, 0.45, 2.1, '#7a5a40', { frame: '#e8e4da', glass: '#5a6570' });
    });
    hipRoof(-25.6, -23.9, 12.0, 13.15, GC, 2.75, 3.15, 0.15, COL.roofC);               // the canopy over the door
    for (let k = 0; k < 2; k++) block(-25.5, -24.1, 12.6 - k * 0.32, 13.15, GC, -0.2, 0.45 - k * 0.15, 0xb3afa8);
    wall([-26.0, 11.1], [-32.2, 11.1], GC, -0.35, EC, COL.cream, (P, len) => {
      render(P, len, -0.35, EC, COL.cream, 123, 0.5); plinth(P, len);
      winW(P, 1.3, 3.9, 2.6, 5.2); winW(P, 3.8, 3.9, 5.1, 5.2);
      door(P, 2.6, 3.5, 0.45, 2.05, '#7a5a40', { frame: '#e8e4da', boards: 0.12 });
    });
    wall([-32.2, 11.1], [-32.2, 26.25], GC, -0.35, EC, COL.cream, (P, len) => {
      render(P, len, -0.35, EC, COL.cream, 125, 0.5); plinth(P, len);
      for (const x of [1.8, 5.6, 9.4, 12.6]) winW(P, x, 3.9, x + 1.2, 5.15);
      for (const x of [5.6, 9.4, 12.6]) winW(P, x, 1.0, x + 1.2, 2.25);
    });
    wall([-32.2, 26.25], [-22.6, 26.25], GC, -0.35, EC, COL.cream, (P, len) => {
      render(P, len, -0.35, EC, COL.cream, 127, 0.6); plinth(P, len);
      winW(P, 2.2, 3.9, 3.5, 5.15); winW(P, 2.2, 1.0, 3.5, 2.25);
      winW(P, 7.0, 1.0, 8.4, 2.25);
    }, { off: 0.025 });
    wall([-22.6, 26.25], [-22.6, 22.0], GC, -0.35, 3.0, COL.cream2, (P, len) => { render(P, len, -0.35, 3.0, COL.cream2, 129, 0.5); plinth(P, len); winW(P, 1.4, 1.0, 2.8, 2.2); });
    wall([-22.6, 22.0], [-16.4, 22.0], GC, -0.35, EC, COL.cream, (P, len) => {
      render(P, len, -0.35, EC, COL.cream, 131, 0.6); plinth(P, len);
      winW(P, 1.0, 3.9, 2.3, 5.15); winW(P, 3.9, 3.9, 5.2, 5.15); winW(P, 2.4, 1.0, 3.7, 2.25);
    });
    wall([-16.4, 22.0], [-16.4, 13.15], GC, -0.35, EC, COL.cream, (P, len) => {
      render(P, len, -0.35, EC, COL.cream, 133, 0.5); plinth(P, len);
      winW(P, 2.0, 3.9, 3.2, 5.15); winW(P, 5.5, 3.9, 6.7, 5.15); winW(P, 3.5, 1.0, 4.7, 2.25);
    });
    // the carport: a low hipped roof on four posts before the wing
    hipRoof(-32.6, -26.0, 5.9, 11.1, GC, 2.6, 3.45, 0.3, COL.roofC);
    for (const [s, v] of [[-32.45, 6.05], [-26.15, 6.05], [-32.45, 10.95], [-26.15, 10.95]]) block(s - 0.08, s + 0.08, v - 0.08, v + 0.08, GC, -0.2, 2.6, 0xe8e4da);

    // ================= 37 =================
    const G7 = hl(28.5, 14) - 0.02, E7 = 3.15, R7 = 7.3;
    const A0 = 23.2, A1 = 33.85, B0 = 9.45, B1 = 18.85, BM = (B0 + B1) / 2;
    block(A0, A1, B0, B1, G7, -0.6, E7, 0xe9e7df);
    { // the steep gable roof, its ridge along the street, the gables at the two ends
      const ov = 0.4, k = (R7 - E7) / (BM - B0), y = G7 + E7 - ov * k, R = G7 + R7;
      const a = [A0 - ov, B0 - ov, y], b = [A1 + ov, B0 - ov, y], c = [A1 + ov, B1 + ov, y], d = [A0 - ov, B1 + ov, y], r1 = [A0 - ov, BM, R], r2 = [A1 + ov, BM, R];
      tris([...quad(a, b, r2, r1), ...quad(c, d, r1, r2)], COL.roof37);
      for (const s of [A0, A1]) tris([[[s, B0, G7 + E7], [s, B1, G7 + E7], [s, BM, R - 0.05]]], 0xe6e4dc);
      block(A0 - ov, A1 + ov, B0 - ov - 0.03, B0 - ov + 0.03, G7, E7 - ov * k - 0.15, E7 - ov * k, COL.fascia);
      block(A0 - ov, A1 + ov, B1 + ov - 0.03, B1 + ov + 0.03, G7, E7 - ov * k - 0.15, E7 - ov * k, COL.fascia);
      // the attic windows in the gables
      for (const [s, sg] of [[A0, -1], [A1, 1]]) {
        const [x, z] = L(s + sg * 0.04, BM), [xg, zg] = L(s + sg * 0.08, BM), [xb, zb] = L(s + sg * 0.1, BM);
        p.add(BOX(0.06, 1.15, 1.5), 0xf3f2ee, x, G7 + E7 + 1.05, z, YAW);
        p.add(BOX(0.06, 0.95, 1.3), 0x4d5866, xg, G7 + E7 + 1.05, zg, YAW);
        p.add(BOX(0.05, 0.95, 0.07), 0xf3f2ee, xb, G7 + E7 + 1.05, zb, YAW);
      }
    }
    chimney(27.6, BM, G7, 5.5, 8.0, 0.55);
    wall([A1, B0], [A0, B0], G7, -0.35, E7, COL.white37, (P, len) => {
      render(P, len, -0.35, E7, COL.white37, 141, 0.8); plinth(P, len, 0.4);
      for (const x of [1.5, 4.6, 7.8]) winW(P, x, 0.85, x + 1.2, 2.2);
    });
    wall([A0, B0], [A0, B1], G7, -0.35, E7, COL.white37, (P, len) => {
      render(P, len, -0.35, E7, COL.white37, 143, 0.8); plinth(P, len, 0.4);
      door(P, 4.2, 5.1, 0.4, 2.05, '#6d6a5e', { frame: '#e8e6de', glass: '#5a6570' });
      winW(P, 1.5, 0.9, 2.5, 2.1); winW(P, 6.8, 0.9, 7.8, 2.1);
    });
    for (let k = 0; k < 2; k++) block(A0 - 0.65 + k * 0.3, A0, BM - 0.5, BM + 0.5, G7, -0.2, 0.36 - k * 0.15, 0xb3afa8);
    wall([A1, B1], [A1, B0], G7, -0.35, E7, COL.white37, (P, len) => { render(P, len, -0.35, E7, COL.white37, 145, 0.8); plinth(P, len, 0.4); winW(P, 2.0, 0.9, 3.2, 2.1); winW(P, 6.2, 0.9, 7.4, 2.1); });
    wall([A0, B1], [A1, B1], G7, -0.35, E7, COL.white37, (P, len) => { render(P, len, -0.35, E7, COL.white37, 147, 0.8); plinth(P, len, 0.4); winW(P, 6.6, 0.9, 7.8, 2.1); winW(P, 8.6, 0.9, 9.6, 2.1); });
    // the rear annex and the shed
    block(23.4, 28.6, B1, 25.0, G7, -0.5, 2.7, 0xe2e0d8);
    flatRoof(23.3, 28.7, B1 - 0.05, 25.1, G7, 2.7, 0x6f6e73);
    wall([23.4, B1], [23.4, 25.0], G7, -0.3, 2.7, '#e2e0d8', (P, len) => { render(P, len, -0.3, 2.7, '#e2e0d8', 149, 0.8); winW(P, 2.4, 0.95, 3.5, 2.0); });
    wall([23.4, 25.0], [28.6, 25.0], G7, -0.3, 2.7, '#e2e0d8', (P, len) => { render(P, len, -0.3, 2.7, '#e2e0d8', 151, 0.8); door(P, 2.0, 2.85, 0.1, 1.95, '#6d6a5e', { frame: '#cfccc2', boards: 0.1 }); });
    wall([28.6, 25.0], [28.6, B1], G7, -0.3, 2.7, '#e2e0d8', (P, len) => { render(P, len, -0.3, 2.7, '#e2e0d8', 153, 0.8); winW(P, 2.2, 0.95, 3.2, 2.0); });
    block(23.95, 30.4, 26.1, 29.6, G7, -0.4, 2.25, 0x5c4e42);
    flatRoof(23.85, 30.5, 26.0, 29.7, G7, 2.25, 0x5b5a5f);
    for (const [a, b] of [[[23.95, 26.1], [23.95, 29.6]], [[30.4, 26.1], [23.95, 26.1]], [[23.95, 29.6], [30.4, 29.6]], [[30.4, 29.6], [30.4, 26.1]]]) {
      wall(a, b, G7, -0.3, 2.25, '#5c4e42', (P, len) => { planks(P, 0, -0.3, len, 2.25, COL.shed, 157 + a[0], 0.14); });
    }

    // ================= the ground =================
    const TX = groundTextures(), lay = groundLayer(world, group);
    const LANE = 11.85;                                 // the lane's north-east edge (its other edge is at s 16.4)
    // the gravel edge of the road and the grass verge, both sides of the lane mouth
    for (const [a, b] of [[-36, LANE], [16.4, 42]]) {
      lay(TX.gravel, F, a, b, 2.85, 3.5, 0.05);
      K.ribbon(F, a, b, 3.45, 4.35, 'lawn', true);
    }
    // 35b: the front lawn, the side yard and drive, the back garden; the slab path to the door
    K.ribbon(F, -8.2, 10.9, 4.65, V0, 'lawn', true);
    K.ribbon(F, S1, 10.9, V0, 12.4, 'lawn', true);
    K.ribbon(F, S1, 10.9, 17.6, PV1, 'lawn', true);
    K.ribbon(F, -8.2, 10.9, W1, 33.5, 'lawn', true);
    K.ribbon(F, -8.2, W0, V1, W1, 'lawn', true);
    K.ribbon(F, PS, 10.9, PV1, W1, 'lawn', true);
    lay(TX.gravel, F, S1, 10.95, 12.4, 17.6, 0.07);     // the gravel drive from the car gate to the porch
    lay(TX.slabs, F, -2.95, -1.85, 4.55, V0 - 0.05, 0.085);
    lay(TX.slabs, F, S0 - 1.0, S1, V0 - 1.1, V0 - 0.05, 0.085);
    // 35c: the lawn, the paved drive under the carport
    K.ribbon(F, -33.4, -8.5, 4.65, 13.0, 'lawn', true);
    K.ribbon(F, -26.0, -8.5, 13.0, 33.5, 'lawn');
    K.ribbon(F, -33.4, -26.0, 26.3, 33.5, 'lawn', true);
    lay(TX.pavers, F, -32.9, -25.9, 2.85, 11.1, 0.085);
    lay(TX.slabs, F, -25.7, -24.0, 4.55, 12.6, 0.085);
    // 37: the lawn round the house (its trees stay)
    K.ribbon(F, 16.8, 40, 4.65, 30, 'lawn');

    // ================= walls, fences and gates =================
    // 35b: the low white rendered wall along the street and down the lane, with its grey cap
    const wallRun = (a, b, height = 0.88, thick = 0.24) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 1.5));
      for (let i = 0; i < n; i++) {
        const s = a[0] + (b[0] - a[0]) * (i + 0.5) / n, v = a[1] + (b[1] - a[1]) * (i + 0.5) / n, [x, z] = L(s, v), y = h(x, z);
        const along = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]), w = len / n + 0.02;
        p.add(along ? BOX(w, height + 0.4, thick) : BOX(thick, height + 0.4, w), COL.wall, x, y + (height - 0.4) / 2, z, YAW);
        p.add(along ? BOX(w, 0.06, thick + 0.06) : BOX(thick + 0.06, 0.06, w), COL.wallCap, x, y + height + 0.03, z, YAW);
      }
    };
    const WV = 4.45, WS = 11.05;
    wallRun([-8.2, WV], [-3.0, WV]);
    wallRun([-1.8, WV], [WS + 0.12, WV]);
    wallRun([WS, WV], [WS, 12.6]);
    wallRun([WS, 17.4], [WS, 33.5]);
    // gate pillars and the gates: a dark metal one to the path, two leaves to the drive
    for (const [s, v] of [[-3.1, WV], [-1.7, WV], [WS, 12.45], [WS, 17.55]]) {
      const [x, z] = L(s, v); p.add(BOX(0.34, 1.55, 0.34), COL.wall, x, h(x, z) + 0.375, z, YAW);
      p.add(BOX(0.4, 0.06, 0.4), COL.wallCap, x, h(x, z) + 1.18, z, YAW);
    }
    const gy = (s, v) => hl(s, v) + 0.04;
    fenceMesh(group, L(-2.9, WV), L(-1.9, WV), gy(-2.4, WV), () => 1.05, COL.gate, 3, { gap: 0.07, width: 0.035, rails: '#3d3f45' }, shadows);
    fenceMesh(group, L(WS, 12.65), L(WS, 15.0), gy(WS, 13.8), (u) => 1.1 + 0.08 * Math.sin(Math.PI * u), COL.gate, 5, { gap: 0.08, width: 0.035, rails: '#3d3f45' }, shadows);
    fenceMesh(group, L(WS, 15.0), L(WS, 17.35), gy(WS, 16.2), (u) => 1.1 + 0.08 * Math.sin(Math.PI * u), COL.gate, 7, { gap: 0.08, width: 0.035, rails: '#3d3f45' }, shadows);
    // the grey mailbox on the wall by the gate and the house number on its pillar
    { const [x, z] = L(-3.75, WV - 0.2); p.add(BOX(0.36, 0.42, 0.2), 0x8a8d93, x, h(x, z) + 0.82, z, YAW); p.add(BOX(0.4, 0.04, 0.24), 0x6f7277, x, h(x, z) + 1.05, z, YAW); }
    { const [x, z] = L(-3.1, WV - 0.19); signPlate(group, x, h(x, z) + 1.12, z, YAW + Math.PI, 0.26, 0.16, (g, w, hh) => {
      g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#2b2d33'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, hh - 6);
      g.fillStyle = '#2b2d33'; g.font = `700 ${hh * 0.62 | 0}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('35b', w / 2, hh * 0.54);
    }); }
    // 35c: the low mesh fence on dark posts along the street
    K.fence(F, -26.2, -8.6, WV, 1.0, COL.post);
    // 37: a weathered picket fence along the street and down the lane, in short runs
    const pickets = (a, b, seed) => fenceMesh(group, L(...a), L(...b), gy((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), (u) => 1.05 + 0.02 * Math.sin(u * 9), COL.picket, seed, { rails: '#857a68' }, shadows);
    for (let s = 16.7, k = 0; s < 39.9; s += 2.6, k++) pickets([Math.min(s + 2.6, 40), WV], [s, WV], 20 + k);
    for (let v = WV, k = 0; v < 25.9; v += 2.6, k++) pickets([16.55, v], [16.55, Math.min(v + 2.6, 26)], 40 + k);
    for (let s = 16.7; s <= 40.1; s += 2.6) { const [x, z] = L(Math.min(s, 40), WV); p.add(BOX(0.09, 1.2, 0.09), 0x6d6352, x, h(x, z) + 0.55, z, YAW); }

    // ================= plants and things in the gardens =================
    const Lf = K.leafy;
    const bush = (s, v, w, ht, tint = [0.82, 0.98, 0.78], depth = w) => { const [x, z] = L(s, v); if (Lf.ok) Lf.bush(x, h(x, z) - 0.05, z, w, ht, s * 1.7 + v, tint, depth); else p.add(new THREE.IcosahedronGeometry(w / 2, 1).scale(1, ht / w, 1), 0x5f9a5c, x, h(x, z) + ht / 2, z); };
    // the thuja row between 35b and 35c, from behind the spruce to the back of the garden
    for (let v = 9.6, k = 0; v < 33.2; v += 0.95, k++) { const [x, z] = L(-8.45, v); K.thuja(x, z, 3.6 + (k % 3) * 0.25, 0.62, k); }
    // 35b: low shrubs at the foot of the front wall, a small round conifer in the back lawn
    bush(-6.8, 5.4, 1.4, 1.0); bush(9.4, 5.4, 1.6, 1.1); bush(8.9, 9.0, 1.2, 0.9, [0.7, 0.9, 0.72]);
    { const [x, z] = L(-4.0, 26.3); K.thuja(x, z, 1.8, 0.75, 4); }
    // the long white polytunnel in the back garden
    {
      const len = 12.0, r = 1.05, tall = 1.75, [x, z] = L(0, 29.2), y = h(x, z);
      const g = new THREE.CylinderGeometry(r, r, len, 18, 1, true, 0, Math.PI);
      g.rotateZ(Math.PI / 2); g.scale(1, tall / r, 1);  // its axis along x, the arch up
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xf1f1ee, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      mesh.rotation.y = YAW; mesh.position.set(x, y, z); mesh.castShadow = shadows; mesh.receiveShadow = true;
      group.add(mesh);
      for (const s of [-6, 6]) for (const turn of [0.5, -0.5]) { const [x2, z2] = L(s, 29.2); p.add(new THREE.CircleGeometry(r, 18, 0, Math.PI).scale(1, tall / r, 1), 0xe9e9e6, x2, y, z2, YAW + Math.PI * turn); }
    }
    // 35c: the round bed of shrubs in the front lawn, the flagpole, bushes by the house
    for (const [s, v, w] of [[-20.6, 9.2, 1.5], [-19.2, 10.1, 1.2], [-21.8, 10.3, 1.3], [-20.2, 11.2, 1.0]]) bush(s, v, w, w * 0.75, [0.78, 0.96, 0.76]);
    bush(-17.3, 12.3, 1.3, 1.1, [0.62, 0.42, 0.6]);
    { const [x, z] = L(-21.0, 6.0), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.04, 0.06, 7.2, 10), COL.flag, x, y + 3.6, z);
      p.add(new THREE.SphereGeometry(0.08, 10, 8), 0xd9c46a, x, y + 7.28, z); }
    // 37: the blue trampoline behind the trees
    { const [x, z] = L(36.2, 15.0), y = h(x, z);
      p.add(new THREE.CylinderGeometry(1.8, 1.8, 0.08, 28), 0x23272e, x, y + 0.9, z);
      p.add(new THREE.TorusGeometry(1.8, 0.07, 6, 28).rotateX(Math.PI / 2), 0x2a6fb3, x, y + 0.93, z);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; p.add(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), 0x9aa0a8, x + Math.cos(a) * 1.75, y + 0.45, z + Math.sin(a) * 1.75); }
    }

    FK.finish();
    lay.finish();
    K.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([L(-34, 3), L(-34, 30), L(40, 3), L(40, 30)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
