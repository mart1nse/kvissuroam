// Tartu Katoliku Hariduskeskus, the Catholic school at Oru 3 (Joosepi maja), and its yard between Veski and Oru
// (Martin, 20 Nov), from his 21 Google Street View screenshots (Aug 2023 and Aug 2024), the Land Board's air
// photos (Apr 2024, six sides) and its orthophoto.
//  - The school: a long two-storey house on a limestone plinth, pale yellow render, white windows in dark
//    red frames, a steep red tiled hip roof with a long dormer along both slopes of each wing and one on each
//    hip end, chimneys. In the middle, toward the yard, a wider and taller block with white pilasters, a
//    white cornice, an attic storey and an arched parapet, the main door with its steps; its own red roof
//    crosses the main one, a little lantern on the ridge, a gable to the back. A red tiled canopy over the
//    cellar steps by the Oru end, galvanised gutters and downpipes, the red cellar door at the far end.
//  - The grey annex behind the far end (flat roof, big windows in dark red frames) and its bridge over the
//    passage to the back yard; a low terrace block at the back of the middle.
//  - The yard: tarmac in front of the house, red brick paving along the wings and a red band curving to
//    the playground, the grass strip by the wall with stepping stones, concrete dome bollards, two rows of
//    bike hoops, the spruce in its round bed, the red rubber mound and the red playground (swing frame,
//    climbing frame, spinner), white benches, black lamp posts, the park of limes toward Veski with its
//    sand paths.
//  - Round it: the cream picket fence on grey rendered posts along Veski and Oru with the gate and mailbox,
//    globe lamps along Oru, the corner steps, the lane along the yard's north-east side with its green mesh
//    fence, the ochre board fence of the neighbours and the three deep waste bins at its mouth.
// The back yard and the annex's far side are not in the pictures and are kept plain (guessed).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { frame, areaKit, cellKit } from './handbuilt.js';
import { BOX, rnd } from '../race/landmarks.js';

// The school's frame: s along the yard front to the north-east (from the corner at the Oru end), v across it
// to the back (south-east); the yard is at v < 0
const S = frame([729.86, 2669.29], [0.668, -0.744]);
const CENTRE = [740, 2630];

// heights above the house's ground line (metres)
const PL = 2.0, EAVE = 9.6, RIDGE = 17.0, D = 9.8, KR = (RIDGE - EAVE) / (D / 2);
const CS0 = 22.7, CS1 = 43.1, CV0 = -4.9, CEAVE = 12.6, CRIDGE = 17.8;     // the middle block
const SE = 66.5;                                                         // the far (north-east) end
const BAY = 3.55;

// ---------------------------------------------------------------- what the map's own data needs
export function katolikuWalls(walls) {
  setHouseColours(walls, '2_5', 480, 2400, [
    { base: 2479, x: 776, z: 2624, hide: true, reach: 80 },          // the school and its annex: built by hand below
    { base: 2589, x: 766, z: 2657, hide: true, reach: 10 },          // the terrace block at its back
    { base: 2968, x: 733, z: 2664, hide: true, reach: 7 },           // a cellar porch at the Oru end, shared base with Oru's houses
  ]);
}

// Veski has no painted centre line from the Oru corner up past the school (the Street View shots show
// bare asphalt, only the zebra by the church): the map's centre dashes go from there
export function katolikuVectors(vectors) {
  const prev = vectors.markSkip, V = frame([675.9, 2638.2], [736.1 - 675.9, 2569.4 - 2638.2]), len = Math.hypot(60.2, 68.8);
  vectors.markSkip = (x, z) => {
    const [s, v] = V.sv(x, z);
    return (s > -12 && s < len + 8 && Math.abs(v) < 5) || (prev ? prev(x, z) : false);
  };
}

// ---------------------------------------------------------------- colours
const COL = {
  render: [236, 214, 150], white: '#f3f0e6', frame: '#7a2f2b', sash: '#f6f4ee', glass: '#4a5866', stone: [196, 194, 184],
  annex: [184, 187, 190],
  roof: 0xb4553f, fascia: 0xf1eee6, gutter: 0x9ea3a8, white3: 0xf2efe6, yellow3: 0xe2cd8d, stone3: 0xbab7ad,
  picket: [238, 230, 196], post: 0xa9abad, cap: 0x9c9fa3, iron: 0x26272b, red: 0xb1352c, redTube: 0xb8322b,
  rubber: [176, 72, 62], board: [196, 132, 62], bin: 0x585d63, lid: 0x3b3f45, bench: 0xf1f0ec,
};
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// ---------------------------------------------------------------- the paint
// limestone ashlar: courses of pale grey blocks of varied length
function limestone(P, x0, y0, x1, y1, seed = 1) {
  const r = rnd(seed);
  P.r(x0, y0, x1, y1, '#8e8b84');
  for (let y = y0, row = 0; y < y1; row++) {
    const h = 0.26 + r() * 0.14, yb = Math.min(y1, y + h);
    for (let x = x0 - r() * 0.4; x < x1;) {
      const w = 0.45 + r() * 0.55, v = 0.88 + r() * 0.18, t = COL.stone.map((c) => Math.min(255, c * v) | 0);
      P.r(Math.max(x0, x + 0.02), y + 0.02, Math.min(x1, x + w - 0.02), yb - 0.02, rgb(t));
      if (r() < 0.3) P.r(Math.max(x0, x + 0.05), yb - 0.07, Math.min(x1, x + w * 0.6), yb - 0.04, 'rgba(255,255,255,0.18)');
      x += w;
    }
    y = yb;
  }
}
// pale yellow render, lightly weathered
function render(P, x0, y0, x1, y1, seed = 2, base = COL.render) {
  P.r(x0, y0, x1, y1, rgb(base));
  P.weather(x0, y0, x1, y1, 0.35, seed);
}
// a window: dark red outer frame, white sashes: two leaves under a top light, each leaf in three panes
function window(P, cx, y0, w, h, { panes = 3, top = true } = {}) {
  const x0 = cx - w / 2, x1 = cx + w / 2, f = 0.07;
  P.r(x0 - 0.06, y0 - 0.12, x1 + 0.06, y0 - 0.02, '#9a9a96');                        // the tin sill
  P.r(x0 - 0.02, y0 - 0.02, x1 + 0.02, y0 + h + 0.03, 'rgba(90,70,40,0.18)');         // the reveal's shade
  P.r(x0, y0, x1, y0 + h, COL.frame);
  P.grad(x0 + f, y0 + f, x1 - f, y0 + h - f, COL.glass, '#2c343d');
  const yt = top ? y0 + h * 0.72 : y0 + h;
  const s = (a, b, c, d) => P.r(a, b, c, d, COL.sash);
  if (top) s(x0 + f, yt - 0.035, x1 - f, yt + 0.035);
  s(cx - 0.04, y0 + f, cx + 0.04, yt);                                                // the meeting stiles
  for (const [a, b] of [[x0 + f, cx - 0.04], [cx + 0.04, x1 - f]]) {
    s(a, y0 + f, a + 0.045, yt); s(b - 0.045, y0 + f, b, yt);
    for (let k = 1; k < panes; k++) { const y = y0 + f + (yt - y0 - f) * k / panes; s(a, y - 0.02, b, y + 0.02); }
  }
  if (top) { s(cx - 0.025, yt, cx + 0.025, y0 + h - f); s(x0 + f, y0 + h - f - 0.04, x1 - f, y0 + h - f); }
}
// a small cellar or attic window: two panes
function smallWindow(P, cx, y0, w, h) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  P.r(x0, y0, x1, y0 + h, COL.frame);
  P.grad(x0 + 0.06, y0 + 0.06, x1 - 0.06, y0 + h - 0.06, COL.glass, '#2c343d');
  P.r(cx - 0.03, y0 + 0.06, cx + 0.03, y0 + h - 0.06, COL.sash);
  P.r(x0 + 0.06, y0 + h / 2 - 0.02, x1 - 0.06, y0 + h / 2 + 0.02, COL.sash);
}
// plinth, sill course and render: the ground of every wall of the house
function wallBase(P, w, top = EAVE, seed = 1) {
  render(P, 0, PL, w, top, seed);
  limestone(P, 0, -1.8, w, PL, seed + 10);
  P.r(0, PL - 0.04, w, PL + 0.12, '#a8a59c');
  P.r(0, PL - 0.06, w, PL - 0.03, 'rgba(40,36,30,0.35)');
  P.grad(0, top - 0.5, w, top, 'rgba(70,56,30,0.32)', 'rgba(70,56,30,0)');             // the shade under the eaves
}
const F1 = 3.15, F2 = 6.45, WH = 2.0, WW = 1.35;                                     // the floors' windows: sill heights, size
function bayWindows(P, cx) {
  smallWindow(P, cx, 0.45, 0.95, 0.95);
  window(P, cx, F1, WW, WH); window(P, cx, F2, WW, WH);
}

// ---------------------------------------------------------------- the build
export function createKatoliku(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // keep the map's trees out of the house and its annex; plant what the photos show and the map lacks
  const inHouse = (x, z) => {
    const [s, v] = S.sv(x, z);
    return (s > -1 && s < SE + 1 && v > -1 && v < 11) || (s > CS0 && s < CS1 && v > CV0 - 1 && v < 23.5) || (s > 52 && s < 77 && v > 11 && v < 50);
  };
  world.addClearing({ test: (x, z) => inHouse(x, z) });
  const trees = [];
  const atS = (s, v) => S.at(s, v);
  trees.push([...atS(29, -14), 6.5, 1.7, 1]);                                       // the spruce in its round bed
  trees.push([...atS(36.5, -18.5), 3.2, 0.9, 1], [...atS(52.5, -28.5), 3.6, 1.0, 1]);  // two little spruces by the playground
  trees.push([...atS(39.2, -6.6), 4.2, 1.1, 0], [...atS(26.5, -6.6), 4.0, 1.0, 0]);    // the young trees on stakes by the middle block
  world.addTrees(trees);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows, fenceColour: 0x34503f });
    const { p, h, box, pave } = A;
    const CK = cellKit(group, { shadows });
    const at = S.at;
    let G = 1e9;
    for (const [s, v] of [[0, 0], [CS0, CV0], [CS1, CV0], [SE, 0]]) G = Math.min(G, h(...at(s, v)));
    G -= 0.05;
    const blk = (s0, s1, v0, v1, y0, y1, c) => box(S, (s0 + s1) / 2, (v0 + v1) / 2, Math.abs(s1 - s0), Math.abs(v1 - v0), y0, y1, c, G);
    // a wall piece of the house from (sa, va) to (sb, vb) in the frame, outside on the right going a -> b
    const wall = (sa, va, sb, vb, key, outline) => CK.put(at(sa, va), at(sb, vb), G, key, outline);
    const ppm = 34;

    // ---- the cells
    CK.cell('bay', BAY, -1.8, EAVE, rgb(COL.render), (P, w) => { wallBase(P, w, EAVE, 3); bayWindows(P, w / 2); }, ppm);
    CK.cell('plain', 1.0, -1.8, EAVE, rgb(COL.render), (P, w) => wallBase(P, w, EAVE, 5), ppm);
    CK.cell('end', D / 2, -1.8, EAVE, rgb(COL.render), (P, w) => { wallBase(P, w, EAVE, 7); bayWindows(P, w / 2); }, ppm);
    // the far end: the red cellar door under a lamp
    CK.cell('endDoor', D / 2, -1.8, EAVE, rgb(COL.render), (P, w) => {
      wallBase(P, w, EAVE, 9);
      window(P, w / 2, F1, WW, WH); window(P, w / 2, F2, WW, WH);
      P.r(w / 2 - 0.62, -0.1, w / 2 + 0.62, 2.05, '#cfcabf');
      P.r(w / 2 - 0.5, -0.1, w / 2 + 0.5, 1.95, '#8e2b28');
      for (let k = 0; k < 3; k++) P.r(w / 2 - 0.4, 0.15 + k * 0.6, w / 2 + 0.4, 0.55 + k * 0.6, '#7a2421');
      P.arc(w / 2, 2.35, 0.16, '#f4f2ee');
    }, ppm);
    // the long dormer's front: a bay with one window, and its plain end
    CK.cell('dorm', BAY, 0, 2.4, rgb(COL.render), (P, w) => { render(P, 0, 0, w, 2.4, 11); window(P, w / 2, 0.55, 1.05, 1.35, { panes: 2, top: false }); P.grad(0, 2.1, w, 2.4, 'rgba(70,56,30,0.3)', 'rgba(70,56,30,0)'); }, ppm);
    CK.cell('dormPlain', 1.0, 0, 2.4, rgb(COL.render), (P, w) => render(P, 0, 0, w, 2.4, 13), ppm);
    // the middle block: its front with the pilasters, the door and the attic storey
    const CW = CS1 - CS0;
    const pil = [[0, 0.9], [6.3, 7.2], [13.2, 14.1], [19.5, 20.4]];
    CK.cell('front', CW, -1.8, CEAVE, rgb(COL.render), (P, w) => {
      render(P, 0, PL, w, CEAVE, 21);
      limestone(P, 0, -1.8, w, PL, 22);
      P.r(0, PL - 0.04, w, PL + 0.12, '#a8a59c');
      for (const [a, b] of pil) { P.r(a, PL, b, 9.6, COL.white); P.r(a - 0.08, 9.15, b + 0.08, 9.6, '#e9e5da'); P.r(a, PL, a + 0.06, 9.15, 'rgba(0,0,0,0.06)'); }
      P.r(0, 9.6, w, 10.25, COL.white); P.r(0, 9.6, w, 9.68, 'rgba(60,50,30,0.25)');                 // the cornice
      P.r(0, CEAVE - 0.25, w, CEAVE, COL.white);
      for (const x of [2.25, 4.95, 15.45, 18.15]) { smallWindow(P, x, 0.45, 0.95, 0.95); window(P, x, F1, WW, WH); window(P, x, F2, WW, WH); smallWindow(P, x, 10.75, 0.9, 1.0); }
      // the middle: the main door in a white surround, a narrow window either side; three windows above
      const c = w / 2;
      P.r(c - 1.25, PL + 0.1, c + 1.25, 5.2, COL.white);
      P.r(c - 0.95, PL + 0.1, c + 0.95, 4.95, '#6e2622');
      P.r(c - 0.95, 4.15, c + 0.95, 4.95, COL.frame); P.grad(c - 0.88, 4.2, c + 0.88, 4.88, COL.glass, '#2c343d');
      for (const x of [c - 0.5, c + 0.5]) P.r(x - 0.38, PL + 0.35, x + 0.38, 3.95, '#5c1f1c');
      P.r(c - 0.02, PL + 0.1, c + 0.02, 4.15, '#3e1513');
      for (const x of [c - 2.0, c + 2.0]) window(P, x, F1 + 0.2, 0.95, 1.8, { panes: 3, top: true });
      for (const x of [c - 2.0, c, c + 2.0]) window(P, x, F2 - 0.2, 1.15, 2.4);
      smallWindow(P, c, 10.75, 1.2, 1.0);
      P.weather(0, PL, w, CEAVE, 0.25, 23);
    }, 30);
    // the arched parapet over the front: a segment of a circle, white coping, a half-round window
    const RISE = 2.6, RAD = (CW * CW / 4 + RISE * RISE) / (2 * RISE);
    const arcY = (s) => CEAVE + Math.sqrt(Math.max(0, RAD * RAD - (s - CW / 2) ** 2)) - (RAD - RISE);
    const arcPts = [];
    for (let k = 0; k <= 16; k++) { const s = CW * k / 16; arcPts.push([s, arcY(s)]); }
    CK.cell('parapet', CW, CEAVE - 0.05, CEAVE + RISE, rgb(COL.render), (P, w) => {
      render(P, 0, CEAVE - 0.05, w, CEAVE + RISE, 25);
      P.poly([[0, CEAVE + RISE + 1], ...arcPts.map(([s, y]) => [s, y - 0.3]), [w, CEAVE + RISE + 1]], COL.white);
      P.arc(w / 2, CEAVE + 0.2, 0.95, COL.white, Math.PI, Math.PI * 2);
      P.arc(w / 2, CEAVE + 0.2, 0.8, COL.frame, Math.PI, Math.PI * 2);
      P.arc(w / 2, CEAVE + 0.2, 0.72, COL.glass, Math.PI, Math.PI * 2);
      for (const a of [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.75]) P.line(w / 2, CEAVE + 0.2, w / 2 + Math.cos(a) * 0.72, CEAVE + 0.2 + Math.sin(a) * 0.72, COL.sash, 0.04);
    }, 30);
    CK.cell('parBack', CW, CEAVE - 0.05, CEAVE + RISE, rgb(COL.render), (P, w) => { render(P, 0, CEAVE - 0.05, w, CEAVE + RISE, 26); P.poly([[0, CEAVE + RISE + 1], ...arcPts.map(([s, y]) => [s, y - 0.3]), [w, CEAVE + RISE + 1]], COL.white); }, 8);
    // the middle block's sides: three white pilasters below the cornice, an attic window above
    CK.cell('side', 4.9, -1.8, CEAVE, rgb(COL.render), (P, w) => {
      render(P, 0, PL, w, CEAVE, 27);
      limestone(P, 0, -1.8, w, PL, 28);
      P.r(0, PL - 0.04, w, PL + 0.12, '#a8a59c');
      for (const a of [0, 2.07, 4.15]) P.r(a, PL, a + 0.75, 9.6, COL.white);
      P.r(0, 9.6, w, 10.25, COL.white); P.r(0, CEAVE - 0.25, w, CEAVE, COL.white);
      smallWindow(P, w / 2, 10.75, 0.9, 1.0);
    }, ppm);
    CK.cell('attic', 2.0, EAVE - 0.2, CEAVE, rgb(COL.render), (P, w) => { render(P, 0, EAVE - 0.2, w, CEAVE, 29); P.r(0, 9.6, w, 10.25, COL.white); P.r(0, CEAVE - 0.25, w, CEAVE, COL.white); }, ppm);
    // its back: two storeys and the attic, a door to the terrace, the gable with a half-round window
    const BW = 41.6 - 23.4, GT = CRIDGE - 0.15;
    CK.cell('back', BW, -1.8, GT, rgb(COL.render), (P, w) => {
      wallBase(P, w, CEAVE, 31);
      P.r(0, 9.6, w, 10.25, COL.white); P.r(0, CEAVE - 0.25, w, CEAVE, COL.white);
      for (const x of [1.8, 4.6, 13.6, 16.4]) { smallWindow(P, x, 0.45, 0.95, 0.95); window(P, x, F1, WW, WH); window(P, x, F2, WW, WH); smallWindow(P, x, 10.75, 0.9, 1.0); }
      for (const x of [7.6, 10.6]) { window(P, x, F1, 1.2, WH); window(P, x, F2, 1.2, WH); }
      P.r(w / 2 - 0.6, 0.2, w / 2 + 0.6, 2.6, '#cfcabf'); P.r(w / 2 - 0.5, 0.2, w / 2 + 0.5, 2.5, '#6e2622');
      render(P, 0, CEAVE, w, GT, 33);
      P.arc(w / 2, CEAVE + 0.6, 1.0, COL.frame, Math.PI, Math.PI * 2); P.arc(w / 2, CEAVE + 0.6, 0.9, COL.glass, Math.PI, Math.PI * 2);
      P.r(w / 2 - 1.05, CEAVE + 0.5, w / 2 + 1.05, CEAVE + 0.62, COL.white);
    }, 26);
    CK.cell('ret', 2.9, -1.8, CEAVE, rgb(COL.render), (P, w) => { wallBase(P, w, CEAVE, 35); P.r(0, 9.6, w, 10.25, COL.white); P.r(0, CEAVE - 0.25, w, CEAVE, COL.white); }, ppm);
    // the dormers on the hip ends: one window
    CK.cell('hipDorm', 2.2, 0, 2.3, rgb(COL.render), (P, w) => { render(P, 0, 0, w, 2.3, 37); window(P, w / 2, 0.5, 1.0, 1.3, { panes: 2, top: false }); }, ppm);
    // the annex: grey render, big windows of four panes in dark red frames
    const AH = 8.3;
    const annexBay = (P, w, seed) => {
      render(P, 0, -3, w, AH, seed, COL.annex);
      P.r(0, AH - 0.35, w, AH, '#e4e4e2');
      for (const y of [0.9, 4.6]) {
        const x0 = w / 2 - 0.85, x1 = w / 2 + 0.85;
        P.r(x0 - 0.05, y - 0.12, x1 + 0.05, y - 0.02, '#9a9a96');
        P.r(x0, y, x1, y + 1.7, COL.frame);
        P.grad(x0 + 0.08, y + 0.08, x1 - 0.08, y + 1.62, '#6f8396', '#3b4651');
        P.r(w / 2 - 0.045, y, w / 2 + 0.045, y + 1.7, COL.frame); P.r(x0, y + 0.81, x1, y + 0.89, COL.frame);
      }
    };
    CK.cell('annex', 4.0, -3, AH, rgb(COL.annex), (P, w) => annexBay(P, w, 41), 26);
    CK.cell('annexPlain', 2.0, -3, AH, rgb(COL.annex), (P, w) => { render(P, 0, -3, w, AH, 43, COL.annex); P.r(0, AH - 0.35, w, AH, '#e4e4e2'); }, 16);

    // ---- the walls
    // a long wall from s0 to s1 at v (outside: -V when front, +V when back): margins of plain render, bays
    const longWall = (s0, s1, v, front, nb, dorm) => {
      const span = nb * BAY, m = (s1 - s0 - span) / 2;
      const piece = (a, b, key) => (front ? wall(b, v, a, v, key) : wall(a, v, b, v, key));
      for (let a = s0; a < s0 + m - 1e-3; a += 1) piece(a, Math.min(a + 1, s0 + m), 'plain');
      for (let k = 0; k < nb; k++) piece(s0 + m + k * BAY, s0 + m + (k + 1) * BAY, 'bay');
      for (let a = s0 + m + span; a < s1 - 1e-3; a += 1) piece(a, Math.min(a + 1, s1), 'plain');
      return s0 + m;
    };
    const sw0 = longWall(0, CS0, 0, true, 6), ne0 = longWall(CS1, SE, 0, true, 6);
    longWall(0, CS0, D, false, 6); longWall(CS1, SE, 9.05, false, 6);
    // the ends: two bays each; the far end has the cellar door
    wall(0, 0, 0, D / 2, 'end'); wall(0, D / 2, 0, D, 'end');
    wall(SE, 9.05, SE, 4.5, 'end'); wall(SE, 4.5, SE, 0, 'endDoor');
    // the middle block
    wall(CS1, CV0, CS0, CV0, 'front');
    wall(CS0, CV0, CS0, 0, 'side'); wall(CS1, 0, CS1, CV0, 'side');
    wall(CS0, 0, CS0, 2.0, 'attic'); wall(CS1, 2.0, CS1, 0, 'attic');
    wall(CS0, D - 2.0, CS0, D, 'attic'); wall(CS1, D, CS1, D - 2.0, 'attic');
    wall(23.4, D, 23.4, 12.7, 'ret'); wall(41.6, 12.7, 41.6, D, 'ret');
    wall(CS0, D, 23.4, D, 'plain'); wall(41.6, D, CS1, D, 'plain');
    {
      const kS = (CRIDGE - CEAVE) / (CW / 2), y0 = CEAVE + (23.4 - CS0) * kS;
      wall(23.4, 12.7, 41.6, 12.7, 'back', [[0, -1.8], [BW, -1.8], [BW, CEAVE], [BW, y0], [BW / 2, GT], [0, y0], [0, CEAVE]]);
    }
    // the parapet, a white back to it
    {
      const out = [[0, CEAVE - 0.05], [CW, CEAVE - 0.05], ...arcPts.slice().reverse()];
      wall(CS1, CV0, CS0, CV0, 'parapet', out);
      CK.put(at(CS0, CV0 + 0.08), at(CS1, CV0 + 0.08), G, 'parBack', out.map(([s, y]) => [CW - s, y]));
    }

    // ---- the body: boxes behind the painted walls
    const Y0 = -1.8;
    blk(0, CS0, 0, D, Y0, EAVE, COL.yellow3);
    blk(CS1, SE, 0, 9.05, Y0, EAVE, COL.yellow3);
    blk(CS0, CS1, CV0, D, Y0, CEAVE, COL.yellow3);
    blk(23.4, 41.6, D, 12.7, Y0, CEAVE, COL.yellow3);
    blk(CS0 - 0.15, CS1 + 0.15, CV0 - 0.15, D - 2, 9.6, 10.25, COL.white3);                       // the cornice
    blk(CS0 - 0.1, CS1 + 0.1, CV0 - 0.1, D - 2, CEAVE - 0.25, CEAVE + 0.05, COL.white3);
    for (const [a, b] of pil) blk(CS1 - b, CS1 - a, CV0 - 0.12, CV0, PL, 9.6, COL.white3);       // the pilasters stand out a little
    // the parapet's coping along its arc
    // the parapet's coping along its arc: short tilted pieces, so it reads as one smooth curve
    for (let k = 0; k < 32; k++) {
      const sa = CW * k / 32, sb = CW * (k + 1) / 32, ya = arcY(sa), yb = arcY(sb);
      const [x, z] = at(CS1 - (sa + sb) / 2, CV0 + 0.05), run = sb - sa;
      p.add(BOX(Math.hypot(run, yb - ya) + 0.04, 0.16, 0.38).rotateZ(-Math.atan2(yb - ya, run)), COL.white3, x, G + (ya + yb) / 2 + 0.03, z, S.YAW);
    }

    // ---- the roofs: red tiles (a small repeating picture), white fascias, grey gutters
    const roof = { pos: [], uv: [] };
    // a roof triangle in (s, v, y) with its slope k (rise per metre) and the direction it faces (ds, dv): the
    // tile picture runs along the eaves and up the slope
    const rtri = (q, k, ds, dv) => {
      const P3 = q.map(([s, v, y]) => { const [x, z] = at(s, v); return [x, G + y, z]; });
      const n = [P3[1][0] - P3[0][0], P3[1][1] - P3[0][1], P3[1][2] - P3[0][2]], m = [P3[2][0] - P3[0][0], P3[2][1] - P3[0][1], P3[2][2] - P3[0][2]];
      const ny = n[2] * m[0] - n[0] * m[2];
      const order = ny > 0 ? [0, 1, 2] : [0, 2, 1];
      const slope = Math.sqrt(1 + 1 / (k * k));
      for (const i of order) {
        const [s, v, y] = q[i];
        roof.pos.push(...P3[i]);
        roof.uv.push((s * -dv + v * ds) / 0.3, y * slope / 0.36);
      }
    };
    const rquad = (a, b, c, d, k, ds, dv) => { rtri([a, b, c], k, ds, dv); rtri([a, c, d], k, ds, dv); };
    // a hip roof over s0..s1, v0..v1 with eaves at ye (at the wall line) and slope k, overhang o
    const hipRoof = (s0, s1, v0, v1, ye, k, o = 0.5) => {
      const half = (v1 - v0) / 2, top = ye + half * k, e = ye - o * k;
      const S0 = s0 - o, S1 = s1 + o, V0 = v0 - o, V1 = v1 + o, vm = (v0 + v1) / 2, r0 = s0 + half, r1 = s1 - half;
      rquad([S0, V0, e], [S1, V0, e], [r1, vm, top], [r0, vm, top], k, 0, -1);
      rquad([S1, V1, e], [S0, V1, e], [r0, vm, top], [r1, vm, top], k, 0, 1);
      rtri([[S0, V1, e], [S0, V0, e], [r0, vm, top]], k, -1, 0);
      rtri([[S1, V0, e], [S1, V1, e], [r1, vm, top]], k, 1, 0);
      // fascia and gutter round the eaves
      for (const [a, b] of [[[S0, V0], [S1, V0]], [[S0, V1], [S1, V1]], [[S0, V0], [S0, V1]], [[S1, V0], [S1, V1]]]) {
        A.bar(at(...a), at(...b), 0.06, e - 0.22, e + 0.02, COL.fascia, G);
        A.bar(at(a[0] + (a[0] === b[0] ? (a[0] < (s0 + s1) / 2 ? -0.08 : 0.08) : 0), a[1] + (a[1] === b[1] ? (a[1] < vm ? -0.08 : 0.08) : 0)),
          at(b[0] + (a[0] === b[0] ? (a[0] < (s0 + s1) / 2 ? -0.08 : 0.08) : 0), b[1] + (a[1] === b[1] ? (a[1] < vm ? -0.08 : 0.08) : 0)), 0.14, e - 0.24, e - 0.1, COL.gutter, G);
      }
      blk(S0, S1, V0, V1, e - 0.02, e, COL.fascia);                                          // the soffit
      return top;
    };
    hipRoof(0, SE, 0, D, EAVE, KR);
    // the middle block's roof: a hip to the yard, a gable to the back, its ridge across the main one
    {
      const o = 0.4, kS = (CRIDGE - CEAVE) / (CW / 2), e = CEAVE - o * kS, sm = (CS0 + CS1) / 2;
      const S0 = CS0 - o, S1 = CS1 + o, V0 = CV0 - o, V1 = 12.7 + o, vr = V0 + (CRIDGE - e) / kS;
      rquad([S0, V0, e], [sm, vr, CRIDGE], [sm, V1, CRIDGE], [S0, V1, e], kS, -1, 0);
      rquad([S1, V0, e], [S1, V1, e], [sm, V1, CRIDGE], [sm, vr, CRIDGE], kS, 1, 0);
      rtri([[S0, V0, e], [S1, V0, e], [sm, vr, CRIDGE]], kS, 0, -1);
      blk(S0, S1, V0, V1, e - 0.02, e, COL.fascia);
      for (const [a, b] of [[[S0, V0], [S1, V0]], [[S0, V0], [S0, V1]], [[S1, V0], [S1, V1]]]) A.bar(at(...a), at(...b), 0.06, e - 0.22, e + 0.02, COL.fascia, G);
      blk(sm - 0.12, sm + 0.12, vr, V1, CRIDGE - 0.05, CRIDGE + 0.12, 0x8d3a2c);                 // the ridge tiles
      // the lantern on the ridge: a white drum, a grey cap
      const [x, z] = at(sm, 8.2);
      p.add(new THREE.CylinderGeometry(0.75, 0.8, 1.3, 8), COL.white3, x, G + CRIDGE + 0.45, z);
      p.add(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 8), COL.white3, x, G + CRIDGE + 1.12, z);
      p.add(new THREE.ConeGeometry(0.92, 1.1, 8), 0x7f878e, x, G + CRIDGE + 1.7, z);
      p.add(new THREE.SphereGeometry(0.12, 8, 6), 0x7f878e, x, G + CRIDGE + 2.32, z);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; p.add(BOX(0.28, 0.6, 0.04), 0x39424a, x + Math.cos(a) * 0.79, G + CRIDGE + 0.5, z + Math.sin(a) * 0.79, -a + Math.PI / 2); }
    }
    blk(SE / 2 - 28.7, SE / 2 + 28.7, D / 2 - 0.12, D / 2 + 0.12, RIDGE - 0.05, RIDGE + 0.12, 0x8d3a2c);    // the main ridge tiles

    // the long dormers: front and back of each wing; their faces painted, their roofs nearly flat
    const DV = 0.6, DT = EAVE + DV * KR - 0.2;                     // the dormer face stands DV in from the wall
    const dormer = (s0, s1, back) => {
      const v = back ? D - DV : DV, top = DT + 2.4, vIn = back ? D - (top + 0.2 - EAVE) / KR : (top + 0.2 - EAVE) / KR;
      blk(s0, s1, Math.min(v, vIn), Math.max(v, vIn), EAVE, top, COL.yellow3);
      const n = Math.floor((s1 - s0) / BAY), m = (s1 - s0 - n * BAY) / 2;
      const piece = (a, b, key) => (back ? CK.put(at(a, v), at(b, v), G + DT, key) : CK.put(at(b, v), at(a, v), G + DT, key));
      for (let a = s0; a < s0 + m - 1e-3; a += 1) piece(a, Math.min(a + 1, s0 + m), 'dormPlain');
      for (let k = 0; k < n; k++) piece(s0 + m + k * BAY, s0 + m + (k + 1) * BAY, 'dorm');
      for (let a = s0 + m + n * BAY; a < s1 - 1e-3; a += 1) piece(a, Math.min(a + 1, s1), 'dormPlain');
      // the cheeks: plain render
      for (const s of [s0, s1]) {
        const out = back ? s === s0 : s === s1;
        const va = back ? vIn : v, vb = back ? v : vIn;
        const tri = [[0, 0], [Math.abs(vb - va), 0], [Math.abs(vb - va), 2.4]];
        if (out === !back) CK.put(at(s, back ? vb : va), at(s, back ? va : vb), G + DT, 'dormPlain', back ? tri.map(([a, y]) => [1 - a / Math.abs(vb - va), y]) : tri.map(([a, y]) => [a / Math.abs(vb - va), y]));
      }
      // the dormer roof: tiles from just over the face back into the main roof
      const o = 0.35, vf = back ? v + o : v - o, yf = top + 0.08, yb = top + 0.3;
      rquad([s0 - o, vf, yf], [s1 + o, vf, yf], [s1 + o, vIn, yb], [s0 - o, vIn, yb], 0.2, 0, back ? 1 : -1);
      A.bar(at(s0 - o, vf), at(s1 + o, vf), 0.05, yf - 0.2, yf + 0.02, COL.fascia, G);
      A.bar(at(s0 - o, vf + (back ? 0.08 : -0.08)), at(s1 + o, vf + (back ? 0.08 : -0.08)), 0.12, yf - 0.22, yf - 0.1, COL.gutter, G);
    };
    dormer(sw0 + BAY, CS0, false); dormer(CS1, ne0 + 5 * BAY, false);
    dormer(sw0 + BAY, CS0, true); dormer(CS1, ne0 + 5 * BAY, true);
    // the hip end dormers: a little gabled box with one window, facing along the ridge
    const hipDormer = (end) => {
      const sgn = end ? 1 : -1, sf = end ? SE - 1.15 : 1.15, sb = end ? SE - 3.4 : 3.4, v0 = D / 2 - 1.1, v1 = D / 2 + 1.1;
      const yf = EAVE + 1.15 * KR - 0.15;
      blk(Math.min(sf, sb), Math.max(sf, sb), v0, v1, EAVE, yf + 2.3, COL.yellow3);
      if (end) CK.put(at(sf, v1), at(sf, v0), G + yf, 'hipDorm'); else CK.put(at(sf, v0), at(sf, v1), G + yf, 'hipDorm');
      const yt = yf + 2.3, yr = yt + 1.0, o = 0.3, sF = sf + sgn * o;
      rquad([sF, v0 - o, yt], [sb, v0 - o, yt], [sb, D / 2, yr], [sF, D / 2, yr], 1.0 / 1.1, 0, -1);
      rquad([sb, v1 + o, yt], [sF, v1 + o, yt], [sF, D / 2, yr], [sb, D / 2, yr], 1.0 / 1.1, 0, 1);
      CK.put(at(sf, end ? v1 : v0), at(sf, end ? v0 : v1), G + yt, 'dormPlain', [[0, 0], [1, 0], [0.5, 0.95]]);
    };
    hipDormer(false); hipDormer(true);
    // chimneys: white render, a grey cap
    for (const [s, v] of [[7.5, 6.3], [15.8, 3.6], [50.6, 3.6], [59.2, 6.3]]) {
      blk(s - 0.35, s + 0.35, v - 0.45, v + 0.45, EAVE + 3, RIDGE + 0.9, COL.white3);
      blk(s - 0.45, s + 0.45, v - 0.55, v + 0.55, RIDGE + 0.9, RIDGE + 1.02, 0x8d9196);
    }
    // downpipes on the yard side and the back
    for (const s of [0.35, 11.35, 22.35, 43.45, 55.0, 66.15]) for (const v of [-0.12, D + 0.12]) {
      const vv = s > CS1 && v > 1 ? 9.05 + 0.12 : v;
      blk(s - 0.055, s + 0.055, vv - 0.055, vv + 0.055, 0.15, EAVE - 0.6, COL.gutter);
      blk(s - 0.1, s + 0.1, vv - 0.1, vv + 0.1, 0, 0.3, COL.gutter);
    }

    // ---- the steps up to the main door, the cellar canopy at the Oru end
    for (let k = 0; k < 4; k++) blk(CS0 + 7.7 - (3 - k) * 0.3, CS1 - 7.7 + (3 - k) * 0.3, CV0 - 2.0 + k * 0.45, CV0, -0.3, 0.16 + k * 0.16, 0xc9c7c0);
    {
      // a lean-to of red tiles on white posts over the steps down to the cellar, along the wall
      const s0 = 0.1, s1 = 10.6, vo = -2.25, yw = 2.85, yo = 2.2, k = (yw - yo) / 2.25;
      rquad([s0, vo - 0.25, yo - 0.25 * k], [s1, vo - 0.25, yo - 0.25 * k], [s1, -0.05, yw], [s0, -0.05, yw], k, 0, -1);
      A.bar(at(s0, vo - 0.25), at(s1, vo - 0.25), 0.06, yo - 0.25 * k - 0.22, yo - 0.25 * k + 0.02, COL.fascia, G);
      for (const s of [s0 + 0.15, (s0 + s1) / 2, s1 - 0.15]) blk(s - 0.08, s + 0.08, vo - 0.08, vo + 0.08, -1.2, yo, COL.white3);
      blk(s0, s1, vo - 0.05, vo + 0.05, 0, 0.9, 0xd8d6cf);                                      // the low wall at the stair's edge
      for (let i = 0; i < 6; i++) blk(1.5 + i * 1.2, 2.7 + i * 1.2, -1.95, -0.1, -1.4, -0.1 - i * 0.22, 0xbcbab3);  // the steps going down
      blk(s1 - 0.6, s1, -2.0, -0.05, -1.4, -0.1, 0xbcbab3);
    }
    // ---- the low terrace block at the back of the middle, a railing on its roof
    {
      blk(28.8, 36.2, 12.7, 22.6, -2.5, 3.0, 0xd9d0ab);
      blk(28.7, 36.3, 12.6, 22.7, 3.0, 3.15, 0xe9e7e0);
      for (const [a, b] of [[[28.8, 22.6], [36.2, 22.6]], [[28.8, 12.8], [28.8, 22.6]], [[36.2, 12.8], [36.2, 22.6]]]) {
        A.bar(at(...a), at(...b), 0.06, 4.0, 4.08, 0x5b4636, G);
        A.walk([at(...a), at(...b)], 1.2, ([x, z]) => p.add(BOX(0.06, 0.9, 0.06), 0x5b4636, x, G + 3.6, z));
      }
    }

    // ---- the annex: two storeys of grey, a flat roof, the bridge over the passage to the back yard
    {
      const blkA = (s0, s1, v0, v1, y0) => { blk(s0, s1, v0, v1, y0, AH, 0xb6b9bc); blk(s0 - 0.1, s1 + 0.1, v0 - 0.1, v1 + 0.1, AH, AH + 0.2, 0xdedfdd); };
      blkA(53.8, 63.0, 15.7, 29.4, -3); blkA(60.2, 75.5, 20.6, 48.6, -3); blkA(63.0, 65.95, 15.7, 20.6, -3);
      blkA(62.95, 65.95, 11.95, 15.7, 3.2);
      for (const v of [12.3, 15.3]) blk(64.3, 64.6, v - 0.15, v + 0.15, -1, 3.2, 0xb6b9bc);           // the posts under the bridge
      const awall = (sa, va, sb, vb) => {
        const len = Math.hypot(sb - sa, vb - va), n = Math.max(1, Math.round(len / 4.0)), m = (len - n * 4) / 2;
        const pt = (t) => [sa + (sb - sa) * t / len, va + (vb - va) * t / len];
        if (len < 4) { CK.put(at(...pt(0)), at(...pt(len)), G, 'annexPlain'); return; }
        if (m > 0.05) { CK.put(at(...pt(0)), at(...pt(m)), G, 'annexPlain'); CK.put(at(...pt(len - m)), at(...pt(len)), G, 'annexPlain'); }
        for (let k = 0; k < n; k++) CK.put(at(...pt(m + k * 4)), at(...pt(m + (k + 1) * 4)), G, 'annex');
      };
      awall(53.8, 15.7, 62.95, 15.7); awall(53.8, 29.4, 53.8, 15.7); awall(65.95, 20.6, 75.5, 20.6); awall(75.5, 20.6, 75.5, 48.6);
      awall(60.2, 29.4, 53.8, 29.4); awall(60.2, 48.6, 60.2, 29.4); awall(75.5, 48.6, 60.2, 48.6);
      CK.put(at(62.95, 15.7), at(65.95, 15.7), G + 3.2, 'annexPlain', [[0, 0], [2, 0], [2, AH - 3.2], [0, AH - 3.2]]);
      CK.put(at(65.95, 11.95), at(62.95, 11.95), G + 3.2, 'annexPlain', [[0, 0], [2, 0], [2, AH - 3.2], [0, AH - 3.2]]);
      CK.put(at(65.95, 15.7), at(65.95, 11.95), G + 3.2, 'annexPlain', [[0, 0], [2, 0], [2, AH - 3.2], [0, AH - 3.2]]);
    }

    // ---- the yard: tarmac, red brick paving and a red band to the playground, grass by the wall
    pave(S, 0.5, 64, -24, -6.3, 'tarmac', 0.06);
    pave(S, 0.2, CS0, -6.3, -3.4, 'red', 0.07); pave(S, CS1, 69, -6.3, -3.4, 'red', 0.07);
    pave(S, CS0, CS1, -6.3, CV0 - 2.0, 'red', 0.07);
    pave(S, 0.2, CS0 - 0.1, -3.4, -0.05, 'lawn'); pave(S, CS1 + 0.1, SE, -3.4, -0.05, 'lawn');
    // the red band curving from the far end round to the playground
    const band = (pts, wid, kind) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = at(...pts[i]), b = at(...pts[i + 1]), F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        pave(F, -0.3, len + 0.3, -wid / 2, wid / 2, kind, 0.075);
      }
    };
    band([[63, -7.5], [58.5, -11], [54, -14.6], [50.5, -17.5], [46.5, -19.5]], 3.0, 'red');
    band([[14, -7.5], [12.5, -12], [12.5, -18], [15, -22.5], [21, -25.5]], 2.6, 'red');
    // the stepping stones in the grass
    for (let s = 1.5; s < SE - 1; s += 0.9) if (s < CS0 - 0.6 || s > CS1 + 0.6) blk(s - 0.3, s + 0.3, -2.0, -1.55, -0.05, 0.08, 0xc7c5bf);
    // the grass of the park toward Veski, and its sand paths
    pave(S, -5.5, 70, -52.5, -24, 'lawn');
    pave(S, -4.5, 0.4, -24, -0.5, 'lawn');
    const PATH = [[54.8, -9.8], [56.6, -17.9], [63.4, -41.7], [61.5, -43.9], [38, -43.6], [35.9, -41.2], [32.7, -40.6], [30.2, -42.1], [29.1, -43.2], [3, -43], [1.6, -41], [3.8, -8.8]];
    band(PATH, 1.6, 'gravel');
    band([[33.2, -40.9], [33.2, -35.5]], 1.4, 'gravel');
    // the round bed of the spruce: a kerb ring and its grass
    {
      const [x, z] = at(29, -14), y = h(x, z);
      p.add(new THREE.TorusGeometry(1.75, 0.09, 4, 28).rotateX(Math.PI / 2), 0xc4c2bc, x, y + 0.07, z);
      p.add(new THREE.CylinderGeometry(1.72, 1.72, 0.1, 28), 0x6d8a50, x, y + 0.05, z);
    }

    // ---- the playground: red rubber, the mound, the red tube frames
    const rubberT = rubberTex();
    A.pave(S, 35, 54, -27.5, -18.5, rubberT, 0.08);
    {
      const [x, z] = at(33.3, -32.4), y = h(x, z);
      p.add(new THREE.SphereGeometry(1, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(3.3, 1.25, 3.3), 0xb34a3e, x, y - 0.05, z);
      p.add(new THREE.TorusGeometry(3.4, 0.16, 4, 32).rotateX(Math.PI / 2), 0x9c3f35, x, y + 0.04, z);
    }
    const tube = (a, b, r = 0.05, c = COL.redTube) => {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
      const g = new THREE.CylinderGeometry(r, r, len, 6).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      p.add(g, c, a[0], a[1], a[2]);
    };
    const P3 = (s, v, y) => { const [x, z] = at(s, v); return [x, h(x, z) + y, z]; };
    // the swing frame: two red A-frames and the beam, a black nest swing and a flat seat
    {
      const s0 = 40.5, s1 = 44.5, v = -24.5;
      for (const s of [s0, s1]) { tube(P3(s, v - 1.0, 0), P3(s, v, 2.5), 0.06); tube(P3(s, v + 1.0, 0), P3(s, v, 2.5), 0.06); }
      tube(P3(s0 - 0.2, v, 2.5), P3(s1 + 0.2, v, 2.5), 0.07);
      for (const s of [41.5, 42.2]) tube(P3(s, v, 0.65), P3(s, v, 2.5), 0.012, 0x2a2a2e);
      for (const s of [43.0, 43.6]) tube(P3(s, v, 0.55), P3(s, v, 2.5), 0.012, 0x2a2a2e);
      const n = P3(41.85, v, 0.62);
      p.add(new THREE.TorusGeometry(0.42, 0.07, 6, 16).rotateX(Math.PI / 2), 0x232326, ...n);
      p.add(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), 0x2e2e33, n[0], n[1] - 0.02, n[2]);
      blk(43.0, 43.6, v - 0.12, v + 0.12, 0.5, 0.56, 0x26262a);
    }
    // the climbing frame: a ridge of red tubes with ladders and bars, a net between
    {
      const pts = [[46.5, -22.5], [49, -20.8], [51.5, -22.6], [53, -20.4]];
      for (let i = 0; i < pts.length; i++) {
        const [s, v] = pts[i], hh = i % 2 ? 2.6 : 2.1;
        tube(P3(s - 0.5, v - 0.9, 0), P3(s, v, hh)); tube(P3(s + 0.5, v + 0.9, 0), P3(s, v, hh));
        if (i) tube(P3(...pts[i - 1], i % 2 ? 2.1 : 2.6), P3(s, v, hh));
        if (i) for (let k = 1; k < 4; k++) tube(P3(pts[i - 1][0] + (s - pts[i - 1][0]) * k / 4, pts[i - 1][1] + (v - pts[i - 1][1]) * k / 4, 0.8), P3(pts[i - 1][0] + (s - pts[i - 1][0]) * k / 4, pts[i - 1][1] + (v - pts[i - 1][1]) * k / 4, 2.0), 0.02, 0x8b7a5a);
      }
      for (let k = 0; k < 5; k++) tube(P3(46.0 + k * 0.4, -23.9, 0.3 + k * 0.38), P3(46.8 + k * 0.4, -23.9, 0.3 + k * 0.38), 0.03);
    }
    // the spinner disc
    { const q = P3(38.5, -21.5, 0); p.add(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), 0x4d4f55, q[0], q[1] + 0.25, q[2]); p.add(new THREE.CylinderGeometry(0.65, 0.6, 0.08, 18), 0x9aa0a6, q[0], q[1] + 0.5, q[2]); }

    // ---- benches (white seats on black frames), bike hoops, dome bollards, black lamp posts
    const bench = (x, z, yaw) => {
      const y = h(x, z), dx = Math.cos(yaw), dz = -Math.sin(yaw), nx = -dz, nz = dx;
      p.add(BOX(1.8, 0.06, 0.45), COL.bench, x, y + 0.45, z, yaw);
      p.add(BOX(1.8, 0.38, 0.05), COL.bench, x - nx * 0.22, y + 0.72, z - nz * 0.22, yaw);
      for (const e of [-0.75, 0.75]) p.add(BOX(0.06, 0.45, 0.45), COL.iron, x + dx * e, y + 0.22, z + dz * e, yaw);
    };
    for (const [x, z] of [[724, 2618.4], [745.4, 2598.6], [752, 2608.6], [699.8, 2635.1], [704.9, 2646.7], [714.2, 2654.0], [723.7, 2647.6]]) bench(x, z, S.YAW + Math.PI / 2 + (x * 7 % 1) * 0.2);
    for (const s0 of [12.6, 47.0]) for (let k = 0; k < 8; k++) {
      const s = s0 + k * 0.75;
      tube(P3(s, -6.45, 0), P3(s, -6.45, 0.75), 0.025, COL.iron); tube(P3(s, -5.55, 0), P3(s, -5.55, 0.75), 0.025, COL.iron);
      tube(P3(s, -6.45, 0.75), P3(s, -5.55, 0.75), 0.025, COL.iron);
    }
    const dome = (s, v) => { const [x, z] = at(s, v); p.add(new THREE.SphereGeometry(0.34, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xb9b7b0, x, h(x, z) - 0.02, z); };
    for (const [s, v] of [[57.4, -3.0], [58.6, -3.1], [59.8, -3.2], [9.5, -3.0], [10.7, -3.1], [66.5, -10.5], [67.6, -9.0], [68.7, -7.5]]) dome(s, v);
    const blackLamp = (s, v, hh = 4.6) => {
      const [x, z] = at(s, v), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.05, 0.07, hh, 8), 0x1f2024, x, y + hh / 2, z);
      p.add(new THREE.CylinderGeometry(0.16, 0.12, 0.42, 10), 0x1f2024, x, y + hh + 0.2, z);
      p.add(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), 0xfff3d2, x, y + hh - 0.02, z);
    };
    for (const [s, v] of [[54.5, -24.5], [46.5, -29.5], [28.5, -25], [60.5, -13]]) blackLamp(s, v);
    // a few round bushes and the stakes of the young trees
    A.bushes([[...at(5.5, -1.6), 1.5, 1.2], [...at(52.3, -1.5), 1.4, 1.2], [...at(64.5, -1.5), 1.3, 1.0]]);
    for (const [s, v] of [[39.2, -6.6], [26.5, -6.6]]) for (const e of [-0.35, 0.35]) blk(s + e - 0.03, s + e + 0.03, v - 0.03, v + 0.03, 0, 1.7, 0x9b7a55);
    // signs in the yard: no stopping by the far wing
    signPost(A, at(55.2, -3.6), 0, 'stop');
    signPost(A, at(13.2, -3.6), 0, 'stop');

    // ---- the fences: cream pickets between grey rendered posts on a low concrete curb
    const solids = [];
    const VESKI = [[740.25, 2579.0], [737.46, 2582.15], [711.47, 2611.43], [687.09, 2638.86]];
    const ORU = [[687.09, 2638.86], [719.05, 2663.96], [719.4, 2664.5]];
    const ORU2 = [[723.6, 2670.3], [731.92, 2681.2], [735.81, 2677.18], [737.22, 2675.71]];
    const pk = picketKit(group, shadows);
    const picketLine = (pts, step = 2.65) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / step));
        const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, yaw = Math.atan2(-uz, ux);
        for (let k = 0; k < n; k++) {
          const qa = [a[0] + ux * len * k / n, a[1] + uz * len * k / n], qb = [a[0] + ux * len * (k + 1) / n, a[1] + uz * len * (k + 1) / n];
          const ya = h(...qa), yb = h(...qb), y = Math.min(ya, yb);
          pk.panel([qa[0] + ux * 0.2, qa[1] + uz * 0.2], [qb[0] - ux * 0.2, qb[1] - uz * 0.2], y + 0.22);
          A.bar(qa, qb, 0.24, -0.2, 0.24, 0xbdbcb6, y);                                             // the curb
          solids.push({ x: (qa[0] + qb[0]) / 2, z: (qa[1] + qb[1]) / 2, yaw, hx: len / n / 2, hz: 0.15 });
        }
        for (let k = 0; k <= n; k++) {
          if (k === n && i < pts.length - 2) continue;
          const q = [a[0] + ux * len * k / n, a[1] + uz * len * k / n], y = h(...q);
          p.add(BOX(0.38, 1.5, 0.38), COL.post, q[0], y + 0.75, q[1], yaw);
          p.add(BOX(0.46, 0.08, 0.46), COL.cap, q[0], y + 1.54, q[1], yaw);
          solids.push({ x: q[0], z: q[1], yaw, hx: 0.2, hz: 0.2 });
        }
      }
    };
    picketLine(VESKI); picketLine(ORU); picketLine(ORU2);
    // the gate: two big rendered posts, the leaves open against the fence, the mailbox and the school's plate
    {
      const ga = [719.4, 2664.5], gb = [723.6, 2670.3], ux = (gb[0] - ga[0]) / 7.15, uz = (gb[1] - ga[1]) / 7.15;
      for (const q of [ga, gb]) {
        const y = h(...q);
        p.add(BOX(0.5, 1.75, 0.5), COL.post, q[0], y + 0.87, q[1], Math.atan2(-uz, ux));
        p.add(BOX(0.6, 0.1, 0.6), COL.cap, q[0], y + 1.8, q[1], Math.atan2(-uz, ux));
        solids.push({ x: q[0], z: q[1], yaw: Math.atan2(-uz, ux), hx: 0.27, hz: 0.27 });
      }
      // the leaves stand open, turned in against the yard side of the fence
      const [nx, nz] = [-uz, ux];                                     // into the yard (the school side)
      const ya = h(...ga), yb = h(...gb);
      pk.panel([ga[0] + nx * 0.35, ga[1] + nz * 0.35], [ga[0] + nx * 0.35 - ux * 2.2, ga[1] + nz * 0.35 - uz * 2.2], ya + 0.08, 1.3);
      pk.panel([gb[0] + nx * 0.35, gb[1] + nz * 0.35], [gb[0] + nx * 0.35 + ux * 2.2, gb[1] + nz * 0.35 + uz * 2.2], yb + 0.08, 1.3);
      const mb = [ga[0] - nx * 0.28 + ux * 0.0, ga[1] - nz * 0.28];
      p.add(BOX(0.36, 0.42, 0.18), 0x6b4130, mb[0], ya + 1.1, mb[1], Math.atan2(-uz, ux));
      p.add(BOX(0.4, 0.05, 0.22), 0x4f2f23, mb[0], ya + 1.33, mb[1], Math.atan2(-uz, ux));
      const pl = [ga[0] - ux * 2.5 - nx * 0.12, ga[1] - uz * 2.5 - nz * 0.12];
      p.add(BOX(0.42, 0.55, 0.03), 0x22252c, pl[0], ya + 0.95, pl[1], Math.atan2(-uz, ux));
      p.add(BOX(0.2, 0.26, 0.035), 0xb79a52, pl[0], ya + 1.0, pl[1], Math.atan2(-uz, ux));
    }
    // the pavement and verge along Oru on the school's side, the globe lamps
    {
      const a = [680.3, 2644.4], b = [715.4, 2671.9], F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // F's v is to the left of a -> b on the map: the school side is v < 0
      pave(F, 2, len + 2, -4.7, -3.1, 'slabs', 0.1);
      pave(F, 2, len + 2, -8.2, -4.7, 'lawn');
      A.bar(F.at(2, -3.05), F.at(len + 2, -3.05), 0.22, -0.2, 0.18, 0xc4c3be);
      for (const t of [7, 21, 35]) globeLamp(A, F.at(t, -5.1));
      globeLamp(A, [725.6, 2678.0]);
    }
    // along Veski: the verge and the slab footway in front of the fence
    {
      const a = [675.9, 2638.2], b = [736.1, 2569.4], F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      pave(F, 9, len + 4, 7.4, 8.9, 'slabs', 0.1);
    }

    // ---- the lane along the yard's north-east side: tarmac, the green mesh fence, the neighbours' board
    // fence, the three deep waste bins on their slab
    const LANE = [[735.23, 2569.92], [739.84, 2575.12], [740.93, 2576.36], [761.59, 2609.39], [765.94, 2614.1], [775.06, 2618.23], [784.67, 2624.9]];
    for (let i = 0; i < LANE.length - 1; i++) {
      const a = LANE[i], b = LANE[i + 1], F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      pave(F, -0.4, len + 0.4, -1.8, 1.8, 'tarmac', 0.07);
    }
    A.mesh([[737.46, 2582.15], [758.51, 2616.57]], 1.25, 0x2f4a38);
    const BOARD = [[743.12, 2575.35], [763.44, 2608.8], [767.72, 2612.35], [772.27, 2614.55], [785.45, 2621.76], [789.03, 2620.49]];
    for (let i = 0; i < BOARD.length - 1; i++) {
      pk.panel(BOARD[i], BOARD[i + 1], h(...BOARD[i]) - 0.05, 1.45, 'board');
      const len = Math.hypot(BOARD[i + 1][0] - BOARD[i][0], BOARD[i + 1][1] - BOARD[i][1]);
      solids.push({ x: (BOARD[i][0] + BOARD[i + 1][0]) / 2, z: (BOARD[i][1] + BOARD[i + 1][1]) / 2, yaw: Math.atan2(-(BOARD[i + 1][1] - BOARD[i][1]), BOARD[i + 1][0] - BOARD[i][0]), hx: len / 2, hz: 0.06 });
      A.walk([BOARD[i], BOARD[i + 1]], 2.4, ([x, z]) => p.add(BOX(0.1, 1.55, 0.1), 0x8a5a2c, x, h(x, z) + 0.75, z));
    }
    {
      // the bins stand in a row along the lane, between it and the mesh fence
      const d = [0.53, 0.848], n = [-0.848, 0.53], c = [744.6, 2589.4];
      const F = frame(c, d);
      A.pave(F, -2.9, 2.9, -1.2, 1.2, 'slabs', 0.1);
      for (const t of [-1.75, 0, 1.75]) {
        const [x, z] = F.at(t, 0), y = h(x, z);
        const ribs = new THREE.CylinderGeometry(0.72, 0.72, 1.25, 20, 1, true);
        p.add(ribs, COL.bin, x, y + 0.62, z);
        for (let k = 0; k < 20; k += 2) { const a = k / 20 * Math.PI * 2; p.add(BOX(0.07, 1.2, 0.05), 0x4a4e54, x + Math.cos(a) * 0.73, y + 0.62, z + Math.sin(a) * 0.73, -a); }
        p.add(new THREE.CylinderGeometry(0.74, 0.74, 0.07, 20), 0x9aa0a6, x, y + 0.1, z);
        p.add(new THREE.SphereGeometry(0.76, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.42, 1), COL.lid, x, y + 1.24, z);
        p.add(BOX(0.5, 0.1, 0.12), 0x26292d, x + n[0] * 0.45, y + 1.5, z + n[1] * 0.45, Math.atan2(-d[1], d[0]));
        p.add(BOX(0.22, 0.32, 0.02), t ? 0xd9c43a : 0x5aa055, x - n[0] * 0.735, y + 0.75, z - n[1] * 0.735, Math.atan2(-n[1], n[0]) + Math.PI / 2);
        solids.push({ x, z, yaw: 0, hx: 0.7, hz: 0.7 });
      }
    }

    pk.finish();
    CK.finish();
    A.finish();
    // the roof's tiles
    {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(roof.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(roof.uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tileTex(), side: THREE.DoubleSide }));
      m.castShadow = shadows; m.receiveShadow = true;
      group.add(m);
    }
    world.addSolids(solids);
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([[700, 2630], [760, 2640], [790, 2660], [740, 2580]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}

// ---------------------------------------------------------------- small pieces
export function canvasTex(w, h, draw, repeat = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// red clay roof tiles: one tile 0.3 m wide, a course 0.36 m up the slope (the picture holds 2 x 2)
export function tileTex() {
  return canvasTex(64, 64, (c, w, hh) => {
    const r = rnd(7);
    c.fillStyle = '#8e3a2b'; c.fillRect(0, 0, w, hh);
    for (let row = 0; row < 2; row++) for (let k = 0; k < 2; k++) {
      const v = 0.9 + r() * 0.2, x = k * 32, y = row * 32;
      const g = c.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, `rgb(${150 * v | 0},${62 * v | 0},${44 * v | 0})`);
      g.addColorStop(0.5, `rgb(${196 * v | 0},${92 * v | 0},${64 * v | 0})`);
      g.addColorStop(1, `rgb(${160 * v | 0},${68 * v | 0},${48 * v | 0})`);
      c.fillStyle = g; c.fillRect(x + 1, y + 3, 30, 28);
      c.fillStyle = 'rgba(60,20,14,0.55)'; c.fillRect(x, y + 28, 32, 4);
    }
  });
}
// red rubber playground surface
function rubberTex() {
  const map = canvasTex(64, 64, (c, w, hh) => {
    const r = rnd(5);
    c.fillStyle = `rgb(${COL.rubber.join(',')})`; c.fillRect(0, 0, w, hh);
    for (let k = 0; k < 500; k++) { const v = 0.8 + r() * 0.4; c.fillStyle = `rgb(${COL.rubber.map((x) => Math.min(255, x * v) | 0).join(',')})`; c.fillRect(r() * w, r() * hh, 1.5, 1.5); }
  });
  return { map, tile: 1.5 };
}
// fences of one small repeating picture: cream pickets, or the ochre boards of the neighbours' fence
function picketKit(group, shadows) {
  const lists = { picket: { pos: [], uv: [] }, board: { pos: [], uv: [] } };
  // a panel from a to b, its feet at y0, `hh` high (one picture = 1 m along it)
  function panel(a, b, y0, hh = 1.18, kind = 'picket') {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), L = lists[kind];
    const q = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], len, 0], [b[0], y0 + hh, b[1], len, 1], [a[0], y0 + hh, a[1], 0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { L.pos.push(q[k][0], q[k][1], q[k][2]); L.uv.push(q[k][3], q[k][4]); }
  }
  function finish() {
    const tex = {
      picket: canvasTex(64, 96, (c, w, hh) => {
        const r = rnd(3);
        c.clearRect(0, 0, w, hh);
        c.fillStyle = 'rgb(206,198,166)'; for (const y of [0.22, 0.78]) c.fillRect(0, hh - y * hh - 4, w, 5);
        for (let k = 0; k < 8; k++) {
          const x0 = k * 8, v = 0.9 + r() * 0.12;
          c.fillStyle = `rgb(${COL.picket.map((x) => Math.min(255, x * v) | 0).join(',')})`;
          c.beginPath(); c.moveTo(x0 + 1, hh); c.lineTo(x0 + 1, 7); c.quadraticCurveTo(x0 + 3.5, 2, x0 + 6, 7); c.lineTo(x0 + 6, hh); c.closePath(); c.fill();
          c.fillStyle = 'rgba(120,110,80,0.25)'; c.fillRect(x0 + 5, 8, 1, hh - 8);
        }
      }),
      board: canvasTex(64, 96, (c, w, hh) => {
        const r = rnd(4);
        for (let k = 0; k < 6; k++) {
          const v = 0.86 + r() * 0.2;
          c.fillStyle = `rgb(${COL.board.map((x) => Math.min(255, x * v) | 0).join(',')})`;
          c.fillRect(k * 10.67, 0, 10.2, hh);
          c.fillStyle = 'rgba(70,40,10,0.35)'; c.fillRect(k * 10.67 + 9.6, 0, 1, hh);
        }
      }),
    };
    for (const kind of ['picket', 'board']) {
      const L = lists[kind];
      if (!L.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex[kind], alphaTest: 0.5, side: THREE.DoubleSide }));
      m.castShadow = shadows; m.receiveShadow = true;
      group.add(m);
    }
  }
  return { panel, finish };
}
// a globe lamp on a grey post (Oru tänav): a white ball with a dark band, a little cap
function globeLamp(A, [x, z]) {
  const y = A.h(x, z), p = A.p;
  p.add(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 8), 0x9ea2a6, x, y + 1.7, z);
  p.add(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 8), 0x8d9196, x, y + 0.25, z);
  p.add(new THREE.SphereGeometry(0.27, 14, 10), 0xf6f1e4, x, y + 3.62, z);
  p.add(new THREE.TorusGeometry(0.27, 0.025, 4, 16).rotateX(Math.PI / 2), 0x6a5444, x, y + 3.62, z);
  p.add(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 10), 0x6a5444, x, y + 3.9, z);
}
// a sign post with one round plate facing yaw
function signPost(A, [x, z], yaw, kind) {
  const y = A.h(x, z), p = A.p;
  p.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), 0x9ea2a6, x, y + 1.3, z);
  if (kind === 'stop') {
    p.add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 18).rotateX(Math.PI / 2), 0xc8202b, x, y + 2.3, z, yaw);
    p.add(new THREE.CylinderGeometry(0.22, 0.22, 0.035, 18).rotateX(Math.PI / 2), 0x2a5aa8, x, y + 2.3, z, yaw);
    p.add(BOX(0.42, 0.06, 0.04).rotateZ(0.785), 0xc8202b, x, y + 2.3, z, yaw);
    p.add(BOX(0.42, 0.06, 0.04).rotateZ(-0.785), 0xc8202b, x, y + 2.3, z, yaw);
  }
}
