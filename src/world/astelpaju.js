// Kaardista "Raadi, Mööbliait and Kvissentali tee" (Martin, 21 Nov), batch 1: Astelpaju by road 3, from his
// Street View shots of July 2024 and the Land Board's oblique air photos of April 2024.
//  - Mööbliait (Astelpaju 1): the dark charcoal hall, upright panel seams, the white portal at the north end
//    of the road front, MÖÖBLIAIT in white letters on that front, the big M in a ring on the north end;
//  - Circle K (Astelpaju 2a): the shop in dark grey with its glass front, the canopy with the red fascia and
//    the orange line under it, pumps, the tall red K with its prices by road 3, the three flags, the red
//    CIRCLE K / ADBLUE / TRUCKDIESEL sign on the grass by the way in, the two parasols at the corner;
//  - Magaziin (Astelpaju 2b): built since the map's survey (2025), outline from the Land Board's 2026 data;
//    its front from Martin's photos of 22 Nov: the raised red corner with the opening hours, the grey
//    slatted wedge above it, the blue perforated triangle standing before it, dark slatted walls, the glass
//    entrance under a steel canopy with crossed braces, the light grey panel with the red MAGAZIIN;
//  - the corner house across road 3 (Aruküla tee 46): cream walls, red roof; the Tartu city sign with the
//    coat of arms, the map board and the three flags at the road's west side north of Kvissentali tee.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /astdebug/.test(location.search);
const S21 = ['2_1', 480, -160], S11 = ['1_1', -160, -160];
const SANS = '700 %px Arial, sans-serif', SERIF = '400 %px Georgia, "Times New Roman", serif';

// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['moob', S21, 832, [563, 20], 62, 0x3a3c43, 0xb6b9bf],
  ['ck', S21, 1015, [549.5, -82], 15, 0x45474d, 0xd9dadc],
  ['corner', S11, 1155, [458, -49], 9, 0xece5d6, 0xb23a2f],
  ['annex', S11, 1178, [459.5, -60], 8, 0xece5d6, 0xb23a2f],
];

export function astelpajuWalls(walls) {
  for (const S of [S21, S11]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
  }
  // the map's canopy, a flat plate: built again with its fascia and posts
  addHouseColours(walls, S21[0], S21[1], S21[2], [{ base: 1541, x: 540, z: -85, hide: true, reach: 16 }, { base: 1541, x: 540, z: -85, hide: true, shelter: true, reach: 16 }]);
}

// ---------------------------------------------------------------- the painters (W: one wall, x = 0 at its start)
function moob(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#383a41');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, P.y0, x + 0.035, top, '#2f3137');
  P.r(0, top - 0.35, len, top, '#4a4d55');                       // the coping
  P.r(0, P.y0, len, 0.35, '#6c6e74');                            // the concrete foot
  if (len < 12) return;
  if (W.nx < -0.9 && len > 50) {                                   // the road front: x = 0 at its north end
    P.text('MÖÖBLIAIT', Math.min(22, len * 0.4), top - 2.6, 2.0, '#f2f2f0', SERIF);
    for (const x of [len * 0.62, len * 0.86]) { P.r(x - 0.6, 0, x + 0.6, 2.4, '#2a2b30'); P.r(x - 0.5, 0.05, x + 0.5, 2.3, '#4b4e56'); }
  } else if (W.nz < -0.9) {                                        // the north end: x = 0 at its east corner
    const g0 = len * 0.3;
    P.r(g0, 0.1, g0 + 2.2, top - 0.6, '#1d2126');                  // the tall dark glass strip
    for (let y = 1.2; y < top - 0.6; y += 1.2) P.r(g0, y - 0.03, g0 + 2.2, y + 0.03, '#3b4048');
    const mx = len * 0.62, my = top - 4.4;
    P.arc(mx, my, 2.7, '#f2f2f0'); P.arc(mx, my, 2.4, '#383a41'); P.arc(mx, my, 2.2, '#f2f2f0'); P.arc(mx, my, 2.0, '#383a41');
    P.text('M', mx, my - 0.1, 2.9, '#f2f2f0', SERIF);
  } else if (len > 25) {                                           // the back and the south: a loading door
    P.r(len * 0.5 - 2, 0, len * 0.5 + 2, 4, '#55575e');
    for (let y = 0.3; y < 4; y += 0.3) P.r(len * 0.5 - 2, y, len * 0.5 + 2, y + 0.04, '#4a4c52');
  }
}
function ck(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#45474d');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, P.y0, x + 0.04, top, '#3d3f45');
  P.r(0, top - 0.45, len, top, '#e3262e');
  if (W.nx < -0.9 && len > 12) {                                   // the glass front under the canopy
    P.r(0, top - 0.65, len, top - 0.45, '#f39200');
    P.r(1.0, 0.1, len - 1.0, 3.2, '#2f3135'); P.grad(1.1, 0.2, len - 1.1, 3.1, '#6f8597', '#3c4a56');
    for (let x = 2.4; x < len - 1.2; x += 1.4) P.r(x - 0.04, 0.1, x + 0.04, 3.2, '#2f3135');
    P.r(len * 0.5 - 1.0, 0, len * 0.5 + 1.0, 2.4, '#2f3135'); P.r(len * 0.5 - 0.9, 0.05, len * 0.5 + 0.9, 2.3, '#7d93a5');
    for (const [x, c] of [[2.2, '#f39200'], [4.4, '#e3262e'], [len - 5, '#2f5fa8']]) P.r(x, 0.7, x + 1.5, 2.0, c);
  } else if (len > 8) {                                            // the grey slatted store on the side
    P.r(len * 0.25, 0, len * 0.75, 2.9, '#5b5e64');
    for (let y = 0.3; y < 2.9; y += 0.3) P.r(len * 0.25, y, len * 0.75, y + 0.04, '#4d5055');
  }
}
function cream(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#ece5d6'); P.weather(0, P.y0, len, P.y1, 0.3, 46);
  P.r(0, P.y0, len, 0.5, '#9d968a');
  if (len < 5) return;
  for (let x = 1.4; x + 1.3 < len - 0.8; x += 3.2) P.win(x, 0.9, x + 1.4, 2.3, { frame: '#3b3433', glass: '#55667a', fw: 0.07, bars: 1, sill: 0.06 });
  if (top > 4.5 && len > 8) P.win(len / 2 - 0.9, 3.4, len / 2 + 0.9, 4.6, { frame: '#3b3433', glass: '#55667a', fw: 0.07, bars: 1, sill: 0.05 });
}
const PAINT = { moob, ck, corner: cream, annex: cream };

// ---------------------------------------------------------------- the frames
// Circle K's canopy: s along its south side to the east, v + = south
const CAN = frame([532.4, -72.0], [546.8 - 532.4, -72.7 + 72.0]);
// Magaziin: s along its south front to the east from the south-west corner, v + = south (out)
const MAG = frame([542.7, -114.9], [578.9 - 542.7, -118.6 + 114.9]);
const MAG_W = 36.4, MAG_D = 40.4, MAG_H = 6.9, MAG_TOP = 8.6;   // the wall, the raised north corner
// its front faces road 3: s from the north-west corner to the south, v + = west (out)
const F = frame(MAG.at(0, -MAG_D), [MAG.V[0] * MAG_D, MAG.V[1] * MAG_D]), FL = MAG_D;
const CENTRE = [540, -60];

export function createAstelpaju(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  // the new hall and its car park: no trees, and the hall is solid
  world.addClearing({ test: (x, z) => { const [s, v] = MAG.sv(x, z); return s > -21 && s < MAG_W + 3 && v > -MAG_D - 3 && v < 3; } });
  { const [x, z] = MAG.at(MAG_W / 2, -MAG_D / 2); world.addSolids([{ x, z, yaw: MAG.YAW, hx: MAG_W / 2, hz: MAG_D / 2 }]); }
  let built = false;

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r]) => ({ name, sec: S[0], base, at, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { label: 'astelpaju fronts', shadows, ppm: 10, far: 5, faces: (W) => W.len > 6 && W.foot < 2, debug: DEBUG });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b2c30 });
    const board = (x, z, w, hh, d, y0, tex, yaw, both = true) => {        // a painted sign board, both faces or one
      const t = new THREE.MeshLambertMaterial({ map: tex });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), [dark, dark, dark, dark, t, both ? t : dark]);
      m.position.set(x, h(x, z) + y0 + hh / 2, z); m.rotation.y = yaw; m.castShadow = shadows; group.add(m);
    };

    // ---- Mööbliait: the white portal at the north end of the road front
    for (const z of [-21.6, -14.0]) p.box(2.6, 6.0, 0.7, 0xf1f1ef, 547.0, h(547, z) + 3.0, z);
    p.box(2.6, 0.8, 8.3, 0xf1f1ef, 547.0, h(547, -17.8) + 5.6, -17.8);
    p.box(0.1, 4.9, 6.6, 0x2b2e34, 548.3, h(548, -17.8) + 2.45, -17.8);               // the dark glass inside it
    yield;

    // ---- Circle K: the canopy (white roof, red fascia with the orange line), posts, pumps
    const cg = Math.min(...[[0, 0], [14.4, 0], [14.4, -25.3], [0, -25.3]].map(([s, v]) => h(...CAN.at(s, v))));
    const fasc = paintTexture(25.3, 0, 1.2, 22, (P) => {
      P.r(0, 0, 25.3, 1.2, '#e3262e'); P.r(0, 0, 25.3, 0.18, '#f39200');
      P.text('CIRCLE', 11.2, 0.66, 0.62, '#ffffff', SANS);
      P.arc(14.2, 0.66, 0.42, '#ffffff'); P.text('K', 14.2, 0.64, 0.56, '#e3262e', SANS);
    });
    const fm = new THREE.MeshLambertMaterial({ map: fasc });
    for (const [s0, v0, s1, v1] of [[0, 0, 14.4, 0], [14.4, -25.3, 0, -25.3], [0, -25.3, 0, 0]]) {      // the three open sides
      const [ax, az] = CAN.at(s0, v0), [bx, bz] = CAN.at(s1, v1), len = Math.hypot(bx - ax, bz - az);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 1.2, 0.3), fm);
      m.position.set((ax + bx) / 2, cg + 6.25 + 0.6, (az + bz) / 2); m.rotation.y = Math.atan2(-(bz - az), bx - ax); m.castShadow = shadows; group.add(m);
    }
    A.box(CAN, 7.2, -12.65, 14.4, 25.3, 7.3, 7.45, 0xe8e8e6, cg);
    A.box(CAN, 7.2, -12.65, 14.1, 25.0, 6.2, 6.25, 0xd2d3d5, cg);
    for (const [s, v] of [[4.2, -5.5], [4.2, -12.6], [4.2, -19.7]]) A.box(CAN, s, v, 0.45, 0.45, -0.05, 6.25, 0xdedfe1, cg);
    for (const v of [-5.5, -12.6, -19.7]) {
      A.box(CAN, 4.2, v, 1.3, 6.4, -0.05, 0.2, 0xb9bbbd, cg);                            // the island
      for (const dv of [-1.9, 1.9]) { A.box(CAN, 4.2, v + dv, 0.6, 0.9, 0.2, 1.95, 0xe9e9e7, cg); A.box(CAN, 4.2, v + dv, 0.62, 0.92, 1.95, 2.35, 0xe3262e, cg); }
    }
    yield;

    // ---- the tall K by road 3, its prices to the road, both faces
    board(515.2, -89.2, 1.6, 8.0, 0.5, 0, paintTexture(1.6, 0, 8, 24, (P) => {
      P.r(0, 0, 1.6, 8, '#e3262e'); P.r(0, 0, 1.6, 1.4, '#2b2c30');
      P.arc(0.8, 7.05, 0.62, '#ffffff'); P.text('K', 0.8, 7.0, 0.8, '#e3262e', SANS);
      [['95', '1.759'], ['98', '1.820'], ['D', '2.026'], ['LPG', '1.041']].forEach(([a, b], k) => { P.r(0.1, 5.4 - k * 0.95, 1.5, 6.15 - k * 0.95, '#1d1e21'); P.text(a + ' ' + b, 0.8, 5.78 - k * 0.95, 0.36, '#ffd23f', SANS); });
      P.r(0.1, 1.6, 1.5, 1.95, '#ffffff'); P.text('AUTOPESU', 0.8, 1.78, 0.2, '#e3262e', SANS);
    }), Math.PI / 2 + 0.05);
    // the three flags
    const pole = new THREE.CylinderGeometry(0.05, 0.07, 8, 6), flag = new THREE.BoxGeometry(0.03, 2.4, 0.9);
    [[519.6, -70.4, 0xe3262e], [519.0, -74.6, 0xf39200], [518.4, -78.8, 0x2f5fa8]].forEach(([x, z, c]) => {
      p.add(pole, 0xf0f0ee, x, h(x, z) + 4, z);
      p.add(flag, c, x, h(x, z) + 6.6, z + 0.5);
    });
    // CIRCLE K / ADBLUE / TRUCKDIESEL on the grass by the way in, to road 3
    board(508.5, -64.5, 2.0, 1.15, 0.12, 0.45, paintTexture(2.0, 0, 1.15, 40, (P) => {
      P.r(0, 0, 2.0, 1.15, '#d8232a'); P.r(0.06, 0.06, 1.94, 1.09, '#e3262e');
      P.text('CIRCLE K', 1.0, 0.92, 0.2, '#ffffff', SANS); P.line(0.15, 0.78, 1.85, 0.78, '#ffffff', 0.015);
      P.text('ADBLUE  ›', 1.0, 0.6, 0.2, '#ffffff', SANS); P.line(0.15, 0.45, 1.85, 0.45, '#ffffff', 0.015);
      P.text('TRUCKDIESEL  ›', 1.0, 0.27, 0.18, '#ffffff', SANS);
    }), -0.8);
    for (const d of [-0.85, 0.85]) p.box(0.1, 1.6, 0.1, 0x8c8e93, 508.5 + d * 0.70, h(508.5, -64.5) + 0.8, -64.5 + d * 0.72);
    // the two black parasols at the shop's north-west corner
    for (const [x, z] of [[524.0, -101.5], [528.5, -102.5]]) {
      p.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), 0x2b2c30, x, h(x, z) + 1.2, z);
      p.add(new THREE.ConeGeometry(1.7, 0.6, 8), 0x26272b, x, h(x, z) + 2.45, z);
    }
    yield;

    // ---- Magaziin (Martin's photos of 22 Nov), its front faces road 3 (Martin, 22 Nov), north end first
    const mg = Math.min(...[[0, 0], [MAG_W, 0], [MAG_W, -MAG_D], [0, -MAG_D]].map(([s, v]) => h(...MAG.at(s, v)))) - 0.15;
    A.box(MAG, MAG_W / 2, -MAG_D / 2, MAG_W, MAG_D, 0, MAG_H, 0x3a3c41, mg);
    A.box(MAG, MAG_W / 2, -MAG_D / 2, MAG_W - 0.6, MAG_D - 0.6, MAG_H, MAG_H + 0.05, 0x8d9096, mg);
    const RED = '#d4202e', K = FL / 36.4, BLUE_S = 13.3 * K;
    const slats = (P, x0, x1, y0, y1, base, line, step = 0.3) => { P.r(x0, y0, x1, y1, base); for (let x = x0 + step / 2; x < x1; x += step) P.r(x, y0, x + 0.06, y1, line); };
    const topAt = (x) => (x < BLUE_S ? MAG_TOP - (MAG_TOP - 8.0) * x / BLUE_S : MAG_H);
    const front = paintTexture(FL, 0, MAG_TOP, 16, (P) => {
      slats(P, BLUE_S, FL, 0, MAG_H, '#2c2e33', '#43464d', 0.25);                 // dark slatted wall
      P.grad(BLUE_S, 0.4, 16.2 * K, MAG_H - 0.15, '#4b5866', '#252b33');                  // the glass curtain at the entrance
      for (let x = BLUE_S + 0.95; x < 16.2 * K; x += 0.95) P.r(x - 0.03, 0.4, x + 0.03, MAG_H - 0.15, '#1b1d21');
      P.r(18.2, 0.4, 20.6, 2.6, '#1d2127'); P.grad(18.3, 0.45, 20.5, 2.5, '#6d8295', '#33404d');   // the doors
      P.r(28.1, 3.2, FL, MAG_H, '#b9bcc2'); P.r(28.1, 3.15, FL, 3.25, '#9a9da3');            // the sign panel
      P.text('MAGAZIIN', 34.25, 4.95, 2.0, '#e0202e', '900 italic %px Arial Black, Arial, sans-serif');
      P.poly([[0, 0], [0, MAG_TOP], [BLUE_S, 8.0], [BLUE_S, 0]], '#9a9ca2');           // the grey wedge with its slats
      for (let x = 0.5; x < BLUE_S; x += 0.32) P.r(x, 0, x + 0.12, topAt(x), '#6d7076');
      P.poly([[0, 0], [0, MAG_TOP], [1.45, 8.1], [8.4, 1.5], [8.4, 0]], RED);           // the red corner under its diagonal
      for (let x = 1.2; x < 8.4; x += 1.2) P.r(x, 0.4, x + 0.03, Math.min(MAG_TOP - 0.1, 8.1 - (x - 1.45) * 0.95), '#b81a27');
      P.text('E-R 9-19', 3.3, 5.25, 0.62, '#ffffff', SANS); P.text('L-P  9-17', 3.3, 4.35, 0.62, '#ffffff', SANS);
      P.r(0, 0, FL, 0.4, '#c9c9c6');                                                     // the concrete plinth
    }, { alpha: true });
    const frontMat = new THREE.MeshLambertMaterial({ map: front, alphaTest: 0.5 });
    { const [x, z] = F.at(FL / 2, 0.03); const m = new THREE.Mesh(new THREE.PlaneGeometry(FL, MAG_TOP), frontMat); m.position.set(x, mg + MAG_TOP / 2, z); m.rotation.y = F.YAW; group.add(m); }
    // the wedge's back and top above the roof, plain grey
    { const sh = new THREE.Shape([[0, MAG_H], [0, MAG_TOP], [BLUE_S, 8.0], [BLUE_S, MAG_H]].map(([a, b]) => new THREE.Vector2(a, b)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false });
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x8d9096 }));
      const [x, z] = F.at(0, -0.53); m.position.set(x, mg, z); m.rotation.y = F.YAW; group.add(m); }
    // the blue perforated triangle standing 0.6 m before the wall
    { const dots = paintTexture(1, 0, 1, 24, (P) => { P.r(0, 0, 1, 1, '#2648c8'); for (let x = 0.1; x < 1; x += 0.2) for (let y = 0.1; y < 1; y += 0.2) P.r(x - 0.05, y - 0.05, x + 0.05, y + 0.05, '#7d2f8e'); }, { repeat: true });
      dots.wrapT = THREE.RepeatWrapping;
      const sh = new THREE.Shape([[3.1, 0.3], [BLUE_S, 0.3], [BLUE_S, 8.15]].map(([a, b]) => new THREE.Vector2(a, b)));
      const g = new THREE.ShapeGeometry(sh);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: dots, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
      const [x, z] = F.at(0, 0.65); m.position.set(x, mg, z); m.rotation.y = F.YAW; group.add(m);
      A.box(F, (3.1 + BLUE_S) / 2 + 0.02, 0.65, Math.hypot(BLUE_S - 3.1, 7.85), 0.1, 0, 0.12, 0x1f3db0, mg + 0.3);   // (its edge, only a hint)
      A.box(F, BLUE_S, 0.65, 0.12, 0.12, 0.3, 8.15, 0x1f3db0, mg); }
    // the low wall, the grass bed with junipers before the triangle, the paving before the red corner
    const bg = h(...F.at(9.5, 1.5));
    A.box(F, 9.5, 2.0, 11.0, 0.3, -0.5, 0.45, 0xc9c9c6, bg);
    A.box(F, 9.5, 1.0, 11.0, 1.7, -0.5, 0.35, 0x6f9a45, bg);
    for (let s = 5; s < 14.8; s += 1.5) p.add(new THREE.ConeGeometry(0.3, 0.55, 6), 0x3f6b3a, ...((q) => [q[0], bg + 0.6, q[1]])(F.at(s, 1.0 + (s % 3 ? 0.3 : -0.3))));
    // the steel canopy over the entrance: flat roof, crossed braces on its outer posts, a perforated end panel
    { const c0 = 16.2, c1 = 23.8, d = 4.2, y = 3.3;
      A.box(F, (c0 + c1) / 2, d / 2, c1 - c0, d, y, y + 0.22, 0x8b8e94, mg);
      for (const s of [c0 + 0.1, (c0 + c1) / 2, c1 - 0.5]) A.box(F, s, d - 0.1, 0.1, 0.1, 0, y, 0x5c5f66, mg);
      for (const [sa, sb] of [[c0 + 0.1, (c0 + c1) / 2], [(c0 + c1) / 2, c1 - 0.5]]) {
        for (const k of [1, -1]) {
          const [x, z] = F.at((sa + sb) / 2, d - 0.1), ang = Math.atan2(y, (sb - sa) / 2) * k;
          const m = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(sb - sa, y), 0.07, 0.07), new THREE.MeshLambertMaterial({ color: 0x5c5f66 }));
          m.position.set(x, mg + y / 2, z); m.rotation.set(0, F.YAW, ang, 'YZX'); group.add(m);
        }
      }
      A.box(F, c1 - 0.2, d / 2, 0.12, d, 0, y, 0xa3a6ab, mg);
      for (let s = c0 + 1.2; s < c1 - 1; s += 1.1) A.box(F, s, 1.7, 0.05, 0.9, 0, 0.8, 0x9fa2a8, mg);           // bike stands
    }
    // the side to Astelpaju and Circle K: dark slats; the red turns round the north-west corner
    { const tex = paintTexture(MAG_W, 0, MAG_H, 8, (P) => { slats(P, 0, MAG_W, 0, MAG_H, '#3d4046', '#4f525a', 0.6); P.r(0, 0, MAG_W, 0.4, '#c9c9c6'); });
      const [x, z] = MAG.at(MAG_W / 2, 0.03); const m = new THREE.Mesh(new THREE.PlaneGeometry(MAG_W, MAG_H), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(x, mg + MAG_H / 2, z); m.rotation.y = MAG.YAW; group.add(m); }
    A.box(MAG, 0.3, -MAG_D - 0.03, 0.6, 0.06, 0, MAG_TOP - 0.05, 0xd4202e, mg);
    // the car park before it, with its bays
    A.pave(F, -2, FL + 2, 0.2, 18, 'asphalt');
    for (let s = 6.0; s < FL - 1; s += 2.6) if (s < 15 || s > 25) A.box(F, s, 7.5, 0.1, 5.0, 0.07, 0.09, 0xf2f2f0);
    yield;

    // ---- across road 3: the Tartu city sign, the map board, three flags
    board(466.4, -130.2, 1.5, 2.2, 0.12, 0.9, paintTexture(1.5, 0, 2.2, 40, (P) => {
      P.r(0, 0, 1.5, 2.2, '#c9ccd2'); P.r(0.05, 1.75, 1.45, 2.15, '#eef0f2'); P.text('TARTU LINN', 0.75, 1.95, 0.17, '#3b3f48', SANS);
      P.poly([[0.25, 1.6], [1.25, 1.6], [1.25, 0.75], [0.75, 0.15], [0.25, 0.75]], '#c4262e');
      P.r(0.5, 0.75, 1.0, 1.35, '#f2f2f0'); P.poly([[0.5, 1.35], [0.62, 1.48], [0.75, 1.35], [0.88, 1.48], [1.0, 1.35]], '#f2f2f0');
      P.text('1030', 0.75, 0.48, 0.16, '#f2f2f0', SANS);
    }), Math.PI);
    for (const dx of [-0.85, 0.85]) p.box(0.14, 3.2, 0.14, 0x9a9da4, 466.4 + dx, h(466.4, -130.2) + 1.6, -130.2);
    board(470.5, -96.0, 2.6, 1.7, 0.12, 0.8, paintTexture(2.6, 0, 1.7, 30, (P) => {
      P.r(0, 0, 2.6, 1.7, '#7a2a2e'); P.r(0.1, 0.1, 2.5, 1.45, '#e9e3cf');
      for (const [x0, y0, x1, y1, c] of [[0.2, 0.3, 1.2, 0.9, '#b9d39b'], [1.3, 0.2, 2.3, 0.7, '#c7c2b6'], [0.4, 1.0, 2.2, 1.3, '#9fc0d6']]) P.r(x0, y0, x1, y1, c);
      P.line(0.1, 0.95, 2.5, 0.75, '#d9a23c', 0.03); P.line(1.2, 0.1, 1.35, 1.55, '#d9a23c', 0.03);
      P.r(0.1, 1.48, 2.5, 1.62, '#7a2a2e'); P.text('VAHI', 1.3, 1.55, 0.12, '#ffffff', SANS);
    }), Math.PI + 0.2, false);
    for (const dx of [-1.1, 1.1]) p.box(0.1, 2.5, 0.1, 0x6f7076, 470.5 + dx, h(470.5, -96) + 1.25, -95.8);
    [[471.5, -82.5, 0xe9e6e2, 0xc63a3a], [470.7, -86.5, 0xf0c419, 0xf0c419], [469.9, -90.5, 0xe9e6e2, 0xc63a3a]].forEach(([x, z, c0, c1]) => {
      p.add(pole, 0xf0f0ee, x, h(x, z) + 4, z);
      p.add(new THREE.BoxGeometry(0.03, 1.2, 0.9), c0, x, h(x, z) + 7.2, z + 0.5);
      p.add(new THREE.BoxGeometry(0.03, 1.2, 0.9), c1, x, h(x, z) + 6.0, z + 0.5);
    });
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[563, 20], [549, -82], [460, -50], [560, -137]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'astelpaju'); }
    },
  };
}
