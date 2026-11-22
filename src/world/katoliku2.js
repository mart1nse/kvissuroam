// The Catholic church at Veski 3 (Tartu Pühima Neitsi Maarja Pärispatuta Saamise kirik) and the villa at
// Veski 5 between it and Mandel (Martin, 20 Nov), from his Street View screenshots (Aug 2023/2024), the Land
// Board's air photos and OSM.
//  - The church: red brick on a darker plinth, a tall square tower at the front toward the Oru corner with
//    corner buttresses, a pointed portal under a little gable, two lancets, a round window, the bell storey's
//    tall lancet pairs, brick corbel friezes, and a grey metal spire with four corner pinnacles and gabled
//    lucarnes. The nave with stepped buttresses (grey metal weatherings) and big pointed windows of two
//    lancets under a rose, a grey standing-seam roof with small gabled vents, the transept and the
//    five-sided apse, a little spire over the crossing.
//  - Round it: the low brick wall with brick pillars and black iron mesh up the west side (along Veski the
//    race keeps its own wall from race/mandel.js),
//    the iron gate between tall pillars in front of the tower, the path to the door.
//  - The villa: cream render on a grey plinth, a steep red tiled roof that sweeps down low on the Oru side
//    with two dormers there, an eyebrow window in the front hip, the five-sided bay with diamond-paned
//    windows, its dark metal roof and the balcony on it in front of the round-arched loggia, a red tiled
//    pent roof along the rest of the front, the porch at the back, the brick chimney.
// What the photos do not show (the church's west side, the villa's back) is plain and guessed.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { frame, areaKit, cellKit } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';
import { canvasTex, tileTex } from './katoliku.js';
import { jobs } from '../jobs.js';

// the church's frame: s from the main door toward the apse (north), v across it to the east (Veski side)
const C = frame([680.6, 2613.56], [0.27295, -0.96203]);
// the villa's frame: s from its north corner along the Oru side to the front (east), v across to the south
const VF = frame([646.83, 2620.03], [9.76, 8.52]);
const CENTRE = [672, 2610];

// church heights above its ground line
const EV = 9.4, RG = 15.4, TT = 18.6, SPIRE = 29.6;
const NW = [-6.3, 6.1], VM = (NW[0] + NW[1]) / 2, KN = (RG - EV) / ((NW[1] - NW[0]) / 2);  // nave walls, centre, roof slope
const N0 = 1.6, N1 = 18.6, T1 = 25.9;                    // nave from its front to the transept, the transept's far side
const TW = [-11.2, 10.8];                                // the transept's ends
const AP = [[28.6, 5.3], [30.6, 3.6], [31.9, -0.2], [30.6, -4.0], [28.6, -5.8]];     // the apse, east to west
const TOWER = [0, 5.2, -3.0, 3.0];                       // s0, s1, v0, v1

export function katoliku2Walls(walls) {
  setHouseColours(walls, '2_5', 480, 2400, [
    { base: 2847, x: 686.2, z: 2599.9, hide: true, reach: 30 },       // the church: built by hand below
    { base: 2913, x: 647.7, z: 2628.8, hide: true, reach: 12 },       // the villa at Veski 5
  ]);
}

const COL = {
  brick: [156, 80, 62], brickDark: [118, 60, 48], mortar: '#b9a48f', stone: '#c9c3b7', glass: '#3a4652', grey: '#a2a7aa',
  brick3: 0x94503f, brickDark3: 0x7a4234, metal: 0x8e979d, metalDark: 0x6f777d, iron: 0x232528, stone3: 0xbfbab0,
  render: [236, 224, 172], frame: '#f5f3ec', wood: '#7a4a2c', plinth: [160, 158, 150], tile: 0xb4553f, bayRoof: 0x4c5257,
};
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// ---------------------------------------------------------------- painting
// a pointed (equilateral) arch shape: sides from y0 up to the springing ys, the head above; inset shrinks it
function pointedPts(cx, y0, ys, w) {
  const a = w / 2, pts = [[cx - a, y0], [cx - a, ys]];
  for (let k = 1; k <= 8; k++) { const t = (k / 8) * Math.PI / 3; pts.push([cx + a - 2 * a * Math.cos(t), ys + 2 * a * Math.sin(t)]); }
  for (let k = 7; k >= 0; k--) { const t = (k / 8) * Math.PI / 3; pts.push([cx - a + 2 * a * Math.cos(t), ys + 2 * a * Math.sin(t)]); }
  pts.push([cx + a, y0]);
  return pts;
}
const pointed = (P, cx, y0, ys, w, col) => P.poly(pointedPts(cx, y0, ys, w), col);
// a big window: a deep brick reveal, stone tracery, two lancets under a rose, leaded panes
function traceryWindow(P, cx, y0, ys, w) {
  const a = w / 2;
  P.r(cx - a - 0.25, y0 - 0.14, cx + a + 0.25, y0, '#a5a6a2');                          // the metal sill
  pointed(P, cx, y0, ys, w + 0.36, '#6e3324');
  pointed(P, cx, y0, ys, w, COL.stone);
  const lw = w / 2 - 0.16;
  for (const x of [cx - w / 4 + 0.02, cx + w / 4 - 0.02]) {
    pointed(P, x, y0 + 0.1, ys, lw, COL.glass);
    for (let y = y0 + 0.7; y < ys; y += 0.62) P.r(x - lw / 2, y - 0.015, x + lw / 2, y + 0.015, '#8b8780');
    P.r(x - 0.012, y0 + 0.1, x + 0.012, ys + lw * 0.6, '#8b8780');
  }
  const ry = ys + a * 1.05, rr = a * 0.5;
  P.arc(cx, ry, rr, COL.glass);
  for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; P.line(cx, ry, cx + Math.cos(t) * rr, ry + Math.sin(t) * rr, COL.stone, 0.06); }
  P.arc(cx, ry, rr * 0.3, COL.stone);
  P.grad(cx - a, y0, cx + a, ys + a * 1.7, 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.08)');
}
// a plain lancet in a reveal
function lancet(P, cx, y0, ys, w, glass = COL.glass) {
  P.r(cx - w / 2 - 0.12, y0 - 0.1, cx + w / 2 + 0.12, y0, '#a5a6a2');
  pointed(P, cx, y0, ys, w + 0.24, '#6e3324');
  pointed(P, cx, y0, ys, w, glass);
}
// a brick corbel frieze: a band with a row of little round arches
function frieze(P, x0, x1, y, h = 0.45) {
  P.brick(x0, y, x1, y + h, COL.brickDark, 9);
  for (let x = x0 + 0.05; x < x1 - 0.3; x += 0.42) { P.r(x, y + 0.05, x + 0.3, y + h * 0.55, 'rgba(50,18,10,0.45)'); P.arc(x + 0.15, y + h * 0.55, 0.15, 'rgba(50,18,10,0.45)', Math.PI, Math.PI * 2); }
  P.r(x0, y + h - 0.06, x1, y + h, 'rgba(255,230,210,0.15)');
}
// the wall itself: brick over a darker plinth with a grey stone cap
function brickWall(P, w, y1, seed) {
  P.brick(0, 0.6, w, y1, COL.brick, seed);
  P.brick(0, -1.5, w, 0.6, COL.brickDark, seed + 1);
  P.r(0, 0.55, w, 0.68, '#9a958c');
  P.weather(0, -1.5, w, y1, 0.25, seed + 2);
}

// ---------------------------------------------------------------- the build
export function createKatoliku2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // keep the map's trees out of the church and the villa
  const inChurch = (s, v) => (s > -2.4 && s < 32.4 && v > -7.4 && v < 7.2) || (s > 18 && s < 26.6 && v > -11.8 && v < 11.4);
  const inVilla = (s, v) => s > -1 && s < 15.6 && v > -1 && v < 14.5;
  world.addClearing({ test: (x, z) => inChurch(...C.sv(x, z)) || inVilla(...VF.sv(x, z)) });

  function* build() {
    built = true;
    const A = areaKit(world, group, { shadows, fenceColour: COL.iron });
    const { p, h } = A;
    const CK = cellKit(group, { shadows });
    const solids = [];
    const metal = makeRoof(), tiles = makeRoof();

    // ================================================================ the church
    {
      const at = C.at;
      let G = 1e9;
      for (const [s, v] of [[0, -3], [0, 3], [N0, NW[0]], [N0, NW[1]], [18.6, TW[0]], [18.6, TW[1]], [31.9, -0.2]]) G = Math.min(G, h(...at(s, v)));
      G -= 0.05;
      const blk = (s0, s1, v0, v1, y0, y1, c) => A.box(C, (s0 + s1) / 2, (v0 + v1) / 2, Math.abs(s1 - s0), Math.abs(v1 - v0), y0, y1, c, G);
      const wall = (sa, va, sb, vb, key, outline, gy = G) => CK.put(at(sa, va), at(sb, vb), gy, key, outline);
      const ppm = 30;

      // ---- the cells
      const bayW = 5.15;
      CK.cell('nBay', bayW, -1.5, EV, rgb(COL.brick), (P, w) => {
        brickWall(P, w, EV, 3);
        P.r(0, 3.3, w, 3.42, '#9f9b93');                                                      // the sill course
        traceryWindow(P, w / 2, 3.55, 6.6, 2.3);
        frieze(P, 0, w, EV - 0.75);
      }, ppm);
      if (jobs.late()) yield;
      CK.cell('nBayS', 3.0, -1.5, EV, rgb(COL.brick), (P, w) => {
        brickWall(P, w, EV, 5);
        P.r(0, 3.3, w, 3.42, '#9f9b93');
        lancet(P, w / 2, 3.8, 6.8, 0.75);
        frieze(P, 0, w, EV - 0.75);
      }, ppm);
      CK.cell('brick', 1.0, -1.5, EV, rgb(COL.brick), (P, w) => { brickWall(P, w, EV, 7); frieze(P, 0, w, EV - 0.75); }, 24);
      // the tower: its front with the portal, lancets, the round window and the bell storey; its sides
      const tw = TOWER[3] - TOWER[2];
      if (jobs.late()) yield;
      CK.cell('tFront', tw, -1.5, TT, rgb(COL.brick), (P, w) => {
        brickWall(P, w, TT, 11);
        const c = w / 2;
        pointed(P, c, 0, 2.9, 2.5, '#6e3324'); pointed(P, c, 0, 2.9, 2.1, '#8a3e2c'); pointed(P, c, 0, 2.7, 1.6, '#4d3020');
        P.r(c - 0.8, 0, c + 0.8, 2.7, '#5a3522'); P.r(c - 0.02, 0, c + 0.02, 2.7, '#2c1a10');
        for (const x of [c - 0.4, c + 0.4]) for (const y of [0.4, 1.5]) P.r(x - 0.28, y, x + 0.28, y + 0.85, 'rgba(0,0,0,0.18)');
        pointed(P, c, 2.75, 3.15, 1.4, '#3b4652');                                           // the fanlight
        for (const x of [c - 0.62, c + 0.62]) lancet(P, x, 6.1, 8.3, 0.7);
        frieze(P, 0.4, w - 0.4, 9.8, 0.4);
        P.arc(c, 11.4, 0.78, '#6e3324'); P.arc(c, 11.4, 0.62, '#9a9893'); P.arc(c, 11.4, 0.5, '#4a5560');
        for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3; P.line(c, 11.4, c + Math.cos(t) * 0.5, 11.4 + Math.sin(t) * 0.5, '#9a9893', 0.05); }
        frieze(P, 0.3, w - 0.3, 12.7, 0.45);
        for (const x of [c - 0.65, c + 0.65]) { lancet(P, x, 13.6, 16.3, 0.62, '#2b2420'); for (let y = 13.8; y < 16.3; y += 0.3) P.r(x - 0.31, y, x + 0.31, y + 0.06, '#5b4a3e'); }
        frieze(P, 0, w, TT - 0.75, 0.5);
      }, ppm);
      if (jobs.late()) yield;
      CK.cell('tSide', TOWER[1] - TOWER[0], -1.5, TT, rgb(COL.brick), (P, w) => {
        brickWall(P, w, TT, 13);
        const c = w / 2;
        lancet(P, c, 6.4, 8.4, 0.7);
        frieze(P, 0.4, w - 0.4, 9.8, 0.4);
        P.arc(c, 11.4, 0.6, '#6e3324'); P.arc(c, 11.4, 0.45, '#4a5560');
        frieze(P, 0.3, w - 0.3, 12.7, 0.45);
        for (const x of [c - 0.65, c + 0.65]) { lancet(P, x, 13.6, 16.3, 0.62, '#2b2420'); for (let y = 13.8; y < 16.3; y += 0.3) P.r(x - 0.31, y, x + 0.31, y + 0.06, '#5b4a3e'); }
        frieze(P, 0, w, TT - 0.75, 0.5);
      }, ppm);
      // the nave's front either side of the tower: a small lancet, the wall rising with the roof
      const fw = TOWER[2] - NW[0], fTop = EV + fw * KN;
      if (jobs.late()) yield;
      CK.cell('nFront', fw, -1.5, fTop, rgb(COL.brick), (P, w) => {
        brickWall(P, w, fTop, 15);
        lancet(P, w / 2, 3.6, 6.6, 0.8);
        frieze(P, 0, w, EV - 0.75);
      }, ppm);
      // the transept's ends: a gable over one big window
      const trW = T1 - N1, trTop = EV + (trW / 2) * KN;
      if (jobs.late()) yield;
      CK.cell('trEnd', trW, -1.5, trTop, rgb(COL.brick), (P, w) => {
        brickWall(P, w, trTop, 17);
        P.r(0, 3.3, w, 3.42, '#9f9b93');
        traceryWindow(P, w / 2, 3.55, 7.0, 2.6);
        frieze(P, 0, w, EV - 0.75);
        P.arc(w / 2, EV + 2.2, 0.45, '#6e3324'); P.arc(w / 2, EV + 2.2, 0.32, '#4a5560');
      }, ppm);
      if (jobs.late()) yield;
      CK.cell('chBay', 2.6, -1.5, EV, rgb(COL.brick), (P, w) => {
        brickWall(P, w, EV, 19);
        P.r(0, 3.3, w, 3.42, '#9f9b93');
        lancet(P, w / 2, 3.6, 7.0, 0.9);
        frieze(P, 0, w, EV - 0.75);
      }, ppm);

      yield;
      // ---- the walls
      // the nave's sides: a narrow bay by the tower, three big bays, a short one before the transept
      const bays = [[N0, 4.6, 'nBayS'], [4.6, 9.75, 'nBay'], [9.75, 14.9, 'nBay'], [14.9, N1, 'nBay']];
      for (const [a, b, key] of bays) { wall(a, NW[1], b, NW[1], key); wall(b, NW[0], a, NW[0], key); }
      // its front either side of the tower
      const fo = [[0, -1.5], [fw, -1.5], [fw, fTop], [0, EV]];
      wall(N0, NW[0], N0, TOWER[2], 'nFront', fo);
      wall(N0, TOWER[3], N0, NW[1], 'nFront', fo.map(([x, y]) => [fw - x, y]));
      // the transept: its ends, and its walls either side of the nave
      const tro = [[0, -1.5], [trW, -1.5], [trW, EV], [trW / 2, trTop], [0, EV]];
      wall(N1, TW[1], T1, TW[1], 'trEnd', tro);
      wall(T1, TW[0], N1, TW[0], 'trEnd', tro);
      const sideRun = (sa, va, sb, vb) => {                                                  // plain brick pieces 1 m wide
        const len = Math.hypot(sb - sa, vb - va), n = Math.max(1, Math.round(len));
        for (let k = 0; k < n; k++) wall(sa + (sb - sa) * k / n, va + (vb - va) * k / n, sa + (sb - sa) * (k + 1) / n, va + (vb - va) * (k + 1) / n, 'brick');
      };
      sideRun(N1, NW[1], N1, TW[1]); sideRun(N1, TW[0], N1, NW[0]);
      wall(T1, TW[1], T1, TW[1] - 2.7, 'chBay'); sideRun(T1, TW[1] - 2.7, T1, 5.3);
      sideRun(T1, -5.8, T1, TW[0] + 2.7); wall(T1, TW[0] + 2.7, T1, TW[0], 'chBay');
      // the chancel and the apse
      wall(T1, 5.3, AP[0][0], 5.3, 'chBay'); wall(AP[4][0], -5.8, T1, -5.8, 'chBay');
      for (let k = 0; k < AP.length - 1; k++) wall(AP[k][0], AP[k][1], AP[k + 1][0], AP[k + 1][1], 'chBay');
      // the tower
      wall(TOWER[0], TOWER[2], TOWER[0], TOWER[3], 'tFront');
      wall(TOWER[0], TOWER[3], TOWER[1], TOWER[3], 'tSide');
      wall(TOWER[1], TOWER[2], TOWER[0], TOWER[2], 'tSide');
      wall(TOWER[1], TOWER[3], TOWER[1], TOWER[2], 'tSide');

      yield;
      // ---- the bodies behind the painted walls
      blk(N0, N1 + 0.2, NW[0] + 0.1, NW[1] - 0.1, -1.5, EV, COL.brick3);
      blk(N1, T1, TW[0] + 0.1, TW[1] - 0.1, -1.5, EV, COL.brick3);
      blk(T1 - 0.2, AP[0][0], -5.7, 5.2, -1.5, EV, COL.brick3);
      blk(AP[0][0], 30.5, -3.9, 3.5, -1.5, EV, COL.brick3);
      blk(TOWER[0] + 0.05, TOWER[1] - 0.05, TOWER[2] + 0.05, TOWER[3] - 0.05, -1.5, TT, COL.brick3);
      blk(TOWER[0] - 0.12, TOWER[1] + 0.12, TOWER[2] - 0.12, TOWER[3] + 0.12, TT - 0.12, TT + 0.05, COL.brickDark3);

      // ---- buttresses: two set-offs, each with a grey metal weathering
      const buttress = (s, v, ds, dv, wide = 0.8, deep = 0.95, top = EV - 1.2) => {
        // (ds, dv): the way it stands out of the wall; each set-off's weathering slopes down outward
        for (const [d, y0, y1, w] of [[deep, -1.5, top * 0.55, wide], [deep * 0.62, top * 0.55, top, wide * 0.85]]) {
          const [bx, bz] = at(s + ds * d / 2, v + dv * d / 2);
          p.box(ds ? d : w, y1 - y0, dv ? d : w, COL.brick3, bx, G + (y0 + y1) / 2, bz, C.YAW);
          const cap = BOX(ds ? d * 1.12 : w + 0.1, 0.07, dv ? d * 1.12 : w + 0.1);
          if (dv) cap.rotateX(Math.sign(dv) * 0.6); else cap.rotateZ(-Math.sign(ds) * 0.6);
          p.add(cap, COL.metal, bx, G + y1 + d * 0.3, bz, C.YAW);
        }
      };
      for (const s of [4.6, 9.75, 14.9]) { buttress(s, NW[1], 0, 1); buttress(s, NW[0], 0, -1); }
      buttress(N1 + 0.4, TW[1], 0, 1); buttress(T1 - 0.4, TW[1], 0, 1); buttress(N1 + 0.4, TW[0], 0, -1); buttress(T1 - 0.4, TW[0], 0, -1);
      for (const [s, v] of AP.slice(1, -1)) { const n = Math.hypot(s - 28.6, v + 0.2); buttress(s, v, (s - 28.6) / n > 0.5 ? 1 : 0, (s - 28.6) / n > 0.5 ? 0 : Math.sign(v + 0.2), 0.7, 0.8); }
      // the tower's corner buttresses toward the street, the nave's front corners
      for (const v of [TOWER[2] + 0.72, TOWER[3] - 0.72]) {
        blk(-1.8, 0.02, v - 0.72, v + 0.72, -1.5, 7.2, COL.brick3);
        blk(-1.1, 0.02, v - 0.6, v + 0.6, 7.2, 12.4, COL.brick3);
        for (const [s0, y] of [[-1.8, 7.2], [-1.1, 12.4]]) {
          const [x, z] = at((s0 + 0.02) / 2, v);
          p.add(BOX(Math.abs(s0) * 1.12, 0.07, 1.5).rotateZ(0.6), COL.metal, x, G + y + 0.3, z, C.YAW);
        }
      }
      for (const v of [NW[0] + 0.5, NW[1] - 0.5]) {
        blk(N0 - 1.1, N0, v - 0.45, v + 0.45, -1.5, 6.0, COL.brick3);
        const [x, z] = at(N0 - 0.55, v);
        p.add(BOX(1.2, 0.07, 1.0).rotateZ(0.6), COL.metal, x, G + 6.3, z, C.YAW);
      }
      // the little gable over the portal, between the corner buttresses
      {
        const [x, z] = at(-0.5, 0);
        p.add(prism(2.3, 1.5, 0.9).rotateY(Math.PI / 2), COL.brick3, x, G + 4.9, z, C.YAW);
        const [mx, mz] = at(-0.45, 0);
        p.add(prism(2.5, 1.62, 0.92).rotateY(Math.PI / 2), COL.metal, mx, G + 4.92, mz, C.YAW);
      }
      yield;
      // ---- the roofs: grey standing-seam metal
      const o = 0.45, e = EV - o * KN;
      const R = metal.on(at, G);
      // the nave: from the tower to the crossing
      R.quad([N0 - 0.1, NW[0] - o, e], [N1 + 3.6, NW[0] - o, e], [N1 + 3.6, VM, RG], [N0 - 0.1, VM, RG], KN, 0, -1);
      R.quad([N1 + 3.6, NW[1] + o, e], [N0 - 0.1, NW[1] + o, e], [N0 - 0.1, VM, RG], [N1 + 3.6, VM, RG], KN, 0, 1);
      // the transept: its ridge across the nave's
      const sm = (N1 + T1) / 2, kt = (RG - EV) / (trW / 2), et = EV - o * kt;
      R.quad([N1 - o, TW[1] + o, et], [N1 - o, TW[0] - o, et], [sm, TW[0] - o, RG], [sm, TW[1] + o, RG], kt, -1, 0);
      R.quad([T1 + o, TW[0] - o, et], [T1 + o, TW[1] + o, et], [sm, TW[1] + o, RG], [sm, TW[0] - o, RG], kt, 1, 0);
      // the chancel, and the apse's fan of slopes to the ridge's end
      const kc = (RG - EV) / 5.6;
      R.quad([sm, -5.8 - o, EV - o * kc], [AP[0][0], -5.8 - o, EV - o * kc], [AP[0][0], VM, RG], [sm, VM, RG], kc, 0, -1);
      R.quad([AP[0][0], 5.3 + o, EV - o * kc], [sm, 5.3 + o, EV - o * kc], [sm, VM, RG], [AP[0][0], VM, RG], kc, 0, 1);
      const apex = [AP[0][0], VM, RG], ring = [[AP[0][0], 5.3 + o], ...AP.slice(1, -1).map(([s, v]) => [s + 0.4 * (s - 28.6) / 3.3, v + 0.4 * Math.sign(v - VM)]), [AP[4][0], -5.8 - o]];
      for (let k = 0; k < ring.length - 1; k++) {
        const a = ring[k], b = ring[k + 1], ds = b[0] - a[0], dv = b[1] - a[1], n = Math.hypot(ds, dv);
        R.tri([[...a, EV - o * kc], [...b, EV - o * kc], apex], kc, -dv / n, ds / n);
      }
      // gutters along the eaves, the ridge capping
      for (const v of [NW[0] - o - 0.08, NW[1] + o + 0.08]) A.bar(at(N0, v), at(N1 - 0.4, v), 0.14, e - 0.18, e - 0.04, COL.metalDark, G);
      blk(N0 - 0.1, AP[0][0], VM - 0.1, VM + 0.1, RG - 0.05, RG + 0.1, COL.metalDark);
      blk(sm - 0.1, sm + 0.1, TW[0] - o, TW[1] + o, RG - 0.05, RG + 0.1, COL.metalDark);
      // downpipes at the buttresses
      for (const s of [4.0, 15.4]) for (const v of [NW[0] - 0.1, NW[1] + 0.1]) blk(s - 0.06, s + 0.06, v - 0.06, v + 0.06, -0.2, e, COL.metal);
      // small gabled vents on the nave's slopes
      for (const s of [3.8, 7.2, 12.3, 16.6]) for (const sg of [-1, 1]) {
        const v = VM + sg * 3.2, y = RG - 3.2 * KN, [x, z] = at(s, v);
        p.add(prism(0.95, 0.6, 1.1).rotateY(sg > 0 ? 0 : Math.PI), COL.metal, x, G + y - 0.15, z, C.YAW);
        const [fx, fz] = at(s, v + sg * 0.56);
        p.add(prism(0.62, 0.36, 0.03).rotateY(sg > 0 ? 0 : Math.PI), 0x7b3a2a, fx, G + y - 0.08, fz, C.YAW);
      }
      // the little spire over the crossing
      {
        const [x, z] = at(sm, VM);
        p.add(new THREE.CylinderGeometry(0.62, 0.62, 1.6, 8), COL.metal, x, G + RG + 0.6, z);
        p.add(new THREE.ConeGeometry(0.7, 5.0, 8), COL.metal, x, G + RG + 3.9, z);
        p.box(0.06, 0.8, 0.06, COL.iron, x, G + RG + 6.7, z); p.box(0.45, 0.06, 0.06, COL.iron, x, G + RG + 6.85, z, C.YAW);
      }
      yield;
      // ---- the tower's spire: grey metal, four corner pinnacles, a gabled lucarne on each side, the cross
      {
        const sc = (TOWER[0] + TOWER[1]) / 2, vc = (TOWER[2] + TOWER[3]) / 2, [x, z] = at(sc, vc), y0 = G + TT;
        p.add(new THREE.ConeGeometry(2.45, SPIRE - TT, 8).rotateY(Math.PI / 8), COL.metal, x, y0 + (SPIRE - TT) / 2, z, C.YAW);
        p.add(new THREE.CylinderGeometry(2.5, 2.9, 0.4, 8).rotateY(Math.PI / 8), COL.metalDark, x, y0 + 0.2, z, C.YAW);
        for (const [ds, dv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const [qx, qz] = at(sc + ds * 2.55, vc + dv * 2.55);
          p.box(0.6, 0.9, 0.6, COL.brick3, qx, y0 + 0.45, qz, C.YAW);
          p.add(new THREE.ConeGeometry(0.42, 3.4, 4).rotateY(Math.PI / 4), COL.metal, qx, y0 + 2.6, qz, C.YAW);
        }
        for (const [ds, dv] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const [qx, qz] = at(sc + ds * 1.95, vc + dv * 1.95), yaw = C.YAW + (ds ? 0 : Math.PI / 2);
          p.box(0.9, 2.0, 0.9, COL.metal, qx, y0 + 1.6, qz, yaw);
          p.add(prism(1.05, 0.85, 0.95).rotateY(ds ? Math.PI / 2 : 0), COL.brick3, qx, y0 + 2.6, qz, C.YAW);
          const [wx, wz] = at(sc + ds * 2.42, vc + dv * 2.42);
          p.box(0.42, 0.9, 0.42, 0x2d2a28, wx, y0 + 1.55, wz, yaw);
        }
        p.add(new THREE.SphereGeometry(0.16, 8, 6), 0xb59a52, x, G + SPIRE + 0.05, z);
        p.box(0.08, 1.5, 0.08, 0x9c8442, x, G + SPIRE + 0.8, z);
        p.box(0.75, 0.08, 0.08, 0x9c8442, x, G + SPIRE + 1.1, z, C.YAW + Math.PI / 2);
      }
      solids.push(...[[N0, N1, NW[0], NW[1]], [N1, T1, TW[0], TW[1]], [T1, 31.5, -5.8, 5.3], [-1.8, 5.2, -3, 3]].map(([s0, s1, v0, v1]) => {
        const [x, z] = at((s0 + s1) / 2, (v0 + v1) / 2);
        return { x, z, yaw: Math.atan2(-C.U[1], C.U[0]), hx: (s1 - s0) / 2, hz: (v1 - v0) / 2 };
      }));

      // ---- the path from the gate to the door, the steps
      A.pave(C, -12.6, -0.3, -1.3, 1.3, 'slabs', 0.09);
      for (let k = 0; k < 2; k++) blk(-0.9 + k * 0.3, 0.05, -1.3, 1.3, -0.3, 0.12 + k * 0.14, 0xb8b4ab);
    }

    yield;
    // ================================================================ the wall round the churchyard
    {
      const mk = meshKit(group, shadows);
      const brickWallLine = (pts, step = 2.7) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / step));
          const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, yaw = Math.atan2(-uz, ux);
          for (let k = 0; k < n; k++) {
            const qa = [a[0] + ux * len * k / n, a[1] + uz * len * k / n], qb = [a[0] + ux * len * (k + 1) / n, a[1] + uz * len * (k + 1) / n];
            const y = Math.min(h(...qa), h(...qb));
            A.bar(qa, qb, 0.34, -0.3, 0.55, COL.brick3, y);
            A.bar(qa, qb, 0.4, 0.55, 0.62, COL.stone3, y);
            mk.panel([qa[0] + ux * 0.28, qa[1] + uz * 0.28], [qb[0] - ux * 0.28, qb[1] - uz * 0.28], y + 0.62, 0.85);
            A.bar([qa[0] + ux * 0.28, qa[1] + uz * 0.28], [qb[0] - ux * 0.28, qb[1] - uz * 0.28], 0.04, 1.43, 1.48, COL.iron, y);
            solids.push({ x: (qa[0] + qb[0]) / 2, z: (qa[1] + qb[1]) / 2, yaw, hx: len / n / 2, hz: 0.2 });
          }
          for (let k = 0; k <= n; k++) {
            if (k === n && i < pts.length - 2) continue;
            const q = [a[0] + ux * len * k / n, a[1] + uz * len * k / n], y = h(...q);
            p.box(0.52, 1.7, 0.52, COL.brick3, q[0], y + 0.85 - 0.05, q[1], yaw);
            p.box(0.62, 0.1, 0.62, COL.stone3, q[0], y + 1.7, q[1], yaw);
            p.add(new THREE.ConeGeometry(0.42, 0.24, 4).rotateY(Math.PI / 4), COL.stone3, q[0], y + 1.87, q[1], yaw);
            solids.push({ x: q[0], z: q[1], yaw, hx: 0.28, hz: 0.28 });
          }
        }
      };
      // along Veski the race's own low brick wall stays (race/mandel.js): it is the edge of the racing line (Martin, 20 Nov)
      brickWallLine([[675.73, 2624.72], [664.55, 2577.14]]);                     // up the west side
      // the gate: two tall pillars, a pair of iron leaves standing open
      const ga = [675.73, 2624.72], gb = [679.63, 2625.84], len = Math.hypot(gb[0] - ga[0], gb[1] - ga[1]);
      const ux = (gb[0] - ga[0]) / len, uz = (gb[1] - ga[1]) / len, yaw = Math.atan2(-uz, ux), nx = -uz, nz = ux;
      for (const q of [ga, gb]) {
        const y = h(...q);
        p.box(0.7, 2.3, 0.7, COL.brick3, q[0], y + 1.1, q[1], yaw);
        p.box(0.82, 0.12, 0.82, COL.stone3, q[0], y + 2.3, q[1], yaw);
        p.add(new THREE.ConeGeometry(0.55, 0.32, 4).rotateY(Math.PI / 4), COL.stone3, q[0], y + 2.52, q[1], yaw);
        solids.push({ x: q[0], z: q[1], yaw, hx: 0.36, hz: 0.36 });
      }
      // the leaves are swung in toward the church (to the north, -z side of the line)
      const into = nz < 0 ? 1 : -1;
      A.gate([ga[0] + ux * 0.4, ga[1] + uz * 0.4], [ga[0] + ux * 0.4 + nx * into * 1.5, ga[1] + uz * 0.4 + nz * into * 1.5], 1.75, COL.iron);
      A.gate([gb[0] - ux * 0.4, gb[1] - uz * 0.4], [gb[0] - ux * 0.4 + nx * into * 1.5, gb[1] - uz * 0.4 + nz * into * 1.5], 1.75, COL.iron);
      mk.finish();
    }

    yield;
    // ================================================================ Veski 5
    {
      const at = VF.at, L = 12.95, Wd = 12.05;
      let G = 1e9;
      for (const [s, v] of [[0, 0], [L, 0], [L, Wd], [0, Wd]]) G = Math.min(G, h(...at(s, v)));
      G -= 0.05;
      const blk = (s0, s1, v0, v1, y0, y1, c) => A.box(VF, (s0 + s1) / 2, (v0 + v1) / 2, Math.abs(s1 - s0), Math.abs(v1 - v0), y0, y1, c, G);
      const wall = (sa, va, sb, vb, key, outline, gy = G) => CK.put(at(sa, va), at(sb, vb), gy, key, outline);
      const EH = 6.8, EN = 4.3, K = 1.25, KNo = 1.66, RY = EH + (Wd / 2) * K;
      const vSplit = (EH - EN) / KNo;                                        // where the low north slope meets the hips' eaves
      const render = (P, x0, y0, x1, y1, seed) => { P.r(x0, y0, x1, y1, rgb(COL.render)); P.weather(x0, y0, x1, y1, 0.3, seed); };
      const plinth = (P, w) => { P.r(0, -1.2, w, 0.45, rgb(COL.plinth)); P.r(0, 0.4, w, 0.5, '#8f8d86'); };
      const win = (P, cx, y0, w, hh, { bars = 1, rails = 2 } = {}) => {
        P.r(cx - w / 2 - 0.05, y0 - 0.1, cx + w / 2 + 0.05, y0, '#c9c6bd');
        P.win(cx - w / 2, y0, cx + w / 2, y0 + hh, { frame: COL.frame, glass: '#46525e', fw: 0.07, bars, rails, sill: 0 });
      };
      const diamond = (P, cx, y0, w, hh) => {
        P.r(cx - w / 2 - 0.05, y0 - 0.1, cx + w / 2 + 0.05, y0, '#c9c6bd');
        P.r(cx - w / 2, y0, cx + w / 2, y0 + hh, COL.frame);
        P.grad(cx - w / 2 + 0.07, y0 + 0.07, cx + w / 2 - 0.07, y0 + hh - 0.07, '#4c5865', '#36404a');
        P.r(cx - 0.035, y0, cx + 0.035, y0 + hh, COL.frame);
        const yt = y0 + hh * 0.62;
        P.r(cx - w / 2, yt - 0.035, cx + w / 2, yt + 0.035, COL.frame);
        // the leaded upper panes: a red diamond in a white lattice
        for (const x of [cx - w / 4, cx + w / 4]) {
          P.poly([[x, yt + 0.06], [x + w / 4 - 0.08, yt + (hh - (yt - y0)) / 2], [x, y0 + hh - 0.08], [x - w / 4 + 0.08, yt + (hh - (yt - y0)) / 2]], '#f1ede4');
          P.poly([[x, yt + 0.14], [x + w / 4 - 0.18, yt + (hh - (yt - y0)) / 2], [x, y0 + hh - 0.16], [x - w / 4 + 0.18, yt + (hh - (yt - y0)) / 2]], '#a32a2e');
        }
      };
      // the front: the pent-roofed half with its windows, the loggia over the bay
      CK.cell('vFront', Wd, -1.2, EH, rgb(COL.render), (P, w) => {
        render(P, 0, 0.4, w, EH, 51); plinth(P, w);
        win(P, 2.9, 1.2, 1.2, 1.7); win(P, 2.6, 4.6, 1.0, 1.45);
        const c = w - 3.48;                                                    // over the bay
        P.r(c - 1.62, 4.1, c + 1.62, 5.6, '#cfc7a8');
        P.arc(c, 5.6, 1.62, '#cfc7a8', Math.PI, Math.PI * 2);
        P.r(c - 1.45, 4.1, c + 1.45, 5.6, '#f2f0ea'); P.arc(c, 5.6, 1.45, '#f2f0ea', Math.PI, Math.PI * 2);
        P.grad(c - 1.45, 5.2, c + 1.45, 7.05, 'rgba(90,80,60,0.25)', 'rgba(90,80,60,0)');
        P.r(c - 0.5, 4.1, c + 0.5, 6.25, '#7a4a2c'); P.r(c - 0.42, 4.6, c + 0.42, 6.15, '#4a5664');
        P.r(c - 0.03, 4.1, c + 0.03, 6.2, '#7a4a2c'); P.r(c - 0.42, 5.4, c + 0.42, 5.46, '#7a4a2c');
        P.grad(0, EH - 0.4, w, EH, 'rgba(70,56,30,0.3)', 'rgba(70,56,30,0)');
      }, 34);
      if (jobs.late()) yield;
      CK.cell('vBack', Wd, -1.2, EH, rgb(COL.render), (P, w) => {
        render(P, 0, 0.4, w, EH, 53); plinth(P, w);
        for (const x of [3.2, 8.4]) { win(P, x, 1.2, 1.2, 1.7); win(P, x, 4.6, 1.0, 1.45); }
      }, 20);
      if (jobs.late()) yield;
      CK.cell('vSouth', L, -1.2, EH, rgb(COL.render), (P, w) => {
        render(P, 0, 0.4, w, EH, 55); plinth(P, w);
        for (const x of [2.4, 5.2, 10.6]) { win(P, x, 1.2, 1.2, 1.7); win(P, x, 4.6, 1.0, 1.45); }
        P.r(7.2, 0.2, 8.4, 2.6, '#7a4a2c');
      }, 22);
      if (jobs.late()) yield;
      CK.cell('vNorth', L, -1.2, EN, rgb(COL.render), (P, w) => {
        render(P, 0, 0.4, w, EN, 57); plinth(P, w);
        for (const x of [1.8, 4.4, 8.8]) win(P, x, 1.3, 0.9, 1.5);
        P.r(6.2, 0.25, 7.3, 2.55, '#e9e6dd'); P.r(6.3, 0.3, 7.2, 2.5, '#7a4a2c');
        P.grad(0, EN - 0.35, w, EN, 'rgba(70,56,30,0.3)', 'rgba(70,56,30,0)');
      }, 22);
      CK.cell('vBay', 1.0, -1.2, 3.45, rgb(COL.render), (P, w) => { render(P, 0, 0.4, w, 3.45, 59); plinth(P, w); diamond(P, w / 2, 1.0, 0.78, 2.05); }, 40);
      CK.cell('vDorm', 1.1, 0, 1.7, rgb(COL.render), (P, w) => { render(P, 0, 0, w, 1.7, 61); win(P, w / 2, 0.3, 0.62, 1.15, { bars: 1, rails: 1 }); }, 34);

      yield;
      // the walls; the front and back step down where the low north slope comes in
      wall(L, Wd, L, 0, 'vFront', [[0, -1.2], [Wd, -1.2], [Wd, EN], [Wd - vSplit, EH], [0, EH]]);
      wall(0, 0, 0, Wd, 'vBack', [[0, -1.2], [Wd, -1.2], [Wd, EH], [vSplit, EH], [0, EN]]);
      wall(0, Wd, L, Wd, 'vSouth');
      wall(L, 0, 0, 0, 'vNorth');
      blk(0.05, L - 0.05, 0.05, Wd - 0.05, -1.2, EN, 0xe6dcae);
      blk(0.05, L - 0.05, vSplit, Wd - 0.05, EN, EH, 0xe6dcae);
      // the roof
      const o = 0.4, R = tiles.on(at, G), e = EH - o * K, en = EN - o * KNo;
      const R0 = [Wd / 2 * 0 + (RY - EH) / K, Wd / 2, RY], R1 = [L - (RY - EH) / K, Wd / 2, RY];
      const vS = (e - EN) / KNo;                                              // where the low slope reaches the hips' eave height
      R.quad([L + o, Wd + o, e], [-o, Wd + o, e], R0, R1, K, 0, 1);                                    // south
      R.tri([[L + o, vS, e], [L + o, Wd + o, e], R1], K, 1, 0);                                       // front hip
      R.tri([[-o, Wd + o, e], [-o, vS, e], R0], K, -1, 0);                                            // back hip
      const north = [[-o, -o, en], [L + o, -o, en], [L + o, vS, e], R1, R0, [-o, vS, e]];
      for (let k = 1; k < north.length - 1; k++) R.tri([north[0], north[k], north[k + 1]], KNo, 0, -1);
      A.bar(at(-o, -o - 0.08), at(L + o, -o - 0.08), 0.13, en - 0.2, en - 0.06, 0x8e9196, G);
      A.bar(at(-o, Wd + o + 0.08), at(L + o, Wd + o + 0.08), 0.13, e - 0.2, e - 0.06, 0x8e9196, G);
      blk(R0[0] - 0.1, R1[0] + 0.1, Wd / 2 - 0.1, Wd / 2 + 0.1, RY - 0.05, RY + 0.1, 0x8d3a2c);
      blk(5.2, 6.0, Wd / 2 + 0.6, Wd / 2 + 1.4, RY - 1.5, RY + 1.3, 0xa04a36);                        // the chimney
      blk(5.1, 6.1, Wd / 2 + 0.5, Wd / 2 + 1.5, RY + 1.3, RY + 1.42, 0x8a3e2c);
      // the eyebrow window in the front hip
      {
        const s = L + o - 2.4, y = e + 2.4 * K, [x, z] = at(s, Wd / 2 - 0.4);
        p.add(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.75, 1), COL.tile, x, G + y, z, VF.YAW + Math.PI);
        const [wx, wz] = at(s + 0.56, Wd / 2 - 0.4);
        p.add(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.72, 1), 0x2f3740, wx, G + y + 0.02, wz, VF.YAW + Math.PI);
      }
      // two dormers on the low north slope
      for (const s of [4.3, 8.6]) {
        const v = 1.9, y = EN + v * KNo + 0.05;
        blk(s - 0.6, s + 0.6, v, v + 1.6, y - 1.2, y + 1.7, 0xe6dcae);
        wall(s + 0.55, v, s - 0.55, v, 'vDorm', null, G + y);
        const [rx, rz] = at(s, v + 0.75);
        p.add(prism(1.5, 0.8, 1.9), COL.tile, rx, G + y + 1.68, rz, VF.YAW);
      }
      yield;
      // the bay: five faces of diamond-paned windows, a dark metal roof, the balcony on top
      const bc = [L, 3.48], ang = [-90, -54, -18, 18, 54, 90].map((d) => d * Math.PI / 180);
      const bp = ang.map((t) => [bc[0] + 1.85 * Math.cos(t), bc[1] + 2.6 * Math.sin(t)]);
      for (let k = bp.length - 1; k > 0; k--) wall(bp[k][0], bp[k][1], bp[k - 1][0], bp[k - 1][1], 'vBay');
      {
        const shape = new THREE.Shape(bp.map(([s, v]) => new THREE.Vector2(s - L, v - bc[1])));
        const body = new THREE.ExtrudeGeometry(shape, { depth: 4.6, bevelEnabled: false }).rotateX(Math.PI / 2);
        const [x, z] = at(L, bc[1]);
        p.add(body.scale(0.97, 1, 0.97), 0xe6dcae, x, G + 3.4, z, VF.YAW);
        const roofG = new THREE.ExtrudeGeometry(new THREE.Shape(bp.map(([s, v]) => new THREE.Vector2((s - L) * 1.12 + 0.05, (v - bc[1]) * 1.08))), { depth: 0.22, bevelEnabled: false }).rotateX(Math.PI / 2);
        p.add(roofG, COL.bayRoof, x, G + 3.68, z, VF.YAW);
        // the balcony railing round the bay's top
        for (let k = 0; k < bp.length - 1; k++) {
          const a = at(bp[k][0] - 0.12 * Math.cos(ang[k]), bp[k][1] - 0.12 * Math.sin(ang[k])), b = at(bp[k + 1][0] - 0.12 * Math.cos(ang[k + 1]), bp[k + 1][1] - 0.12 * Math.sin(ang[k + 1]));
          A.bar(a, b, 0.05, 4.55, 4.62, COL.iron, G);
          A.bar(a, b, 0.03, 3.85, 3.9, COL.iron, G);
          A.walk([a, b], 0.14, ([qx, qz]) => p.box(0.02, 0.7, 0.02, COL.iron, qx, G + 4.22, qz));
        }
      }
      // the red tiled pent roof along the rest of the front, at the first floor
      {
        const s0 = L, k = 0.5, y = 3.55;
        R.quad([s0 + 0.85, Wd + 0.3, y], [s0 + 0.85, bc[1] + 2.75, y], [s0, bc[1] + 2.75, y + 0.85 * k], [s0, Wd + 0.3, y + 0.85 * k], k, 1, 0);
        A.bar(at(s0 + 0.88, bc[1] + 2.75), at(s0 + 0.88, Wd + 0.3), 0.12, y - 0.16, y - 0.04, 0x8e9196, G);
      }
      // the porch at the back
      blk(7.0, 11.0, Wd, 13.85, -1.2, 3.1, 0xe6dcae);
      blk(6.85, 11.15, Wd, 14.0, 3.1, 3.3, 0x9a9da0);
      CK.put(at(11.0, 13.85), at(7.0, 13.85), G, 'vBack', [[0, -1.2], [4, -1.2], [4, 3.1], [0, 3.1]]);
      solids.push({ ...(() => { const [x, z] = at(L / 2, Wd / 2); return { x, z }; })(), yaw: Math.atan2(-VF.U[1], VF.U[0]), hx: L / 2 + 0.2, hz: Wd / 2 + 0.2 });
      solids.push({ ...(() => { const [x, z] = at(L + 1, bc[1]); return { x, z }; })(), yaw: Math.atan2(-VF.U[1], VF.U[0]), hx: 1.0, hz: 2.4 });
    }

    yield;
    CK.finish();
    A.finish();
    metal.finish(group, metalTex(), shadows);
    tiles.finish(group, tileTex(), shadows);
    world.addSolids(solids);
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([[684, 2600], [650, 2630], [705, 2600]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'katoliku2'); }
    },
  };
}

// ---------------------------------------------------------------- small pieces
// a triangular prism: a gable w wide and hh high (its foot at y 0), len deep along z (centred)
function prism(w, hh, len) {
  const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, hh)]);
  return new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
}
// roof triangles in a frame (s, v, y over its ground line), the picture running along the eaves and up the
// slope; one mesh per roof material
function makeRoof() {
  const pos = [], uv = [];
  return {
    on(at, G) {
      const tri = (q, k, ds, dv) => {
        const P3 = q.map(([s, v, y]) => { const [x, z] = at(s, v); return [x, G + y, z]; });
        const n = [P3[1][0] - P3[0][0], P3[1][1] - P3[0][1], P3[1][2] - P3[0][2]], m = [P3[2][0] - P3[0][0], P3[2][1] - P3[0][1], P3[2][2] - P3[0][2]];
        const order = n[2] * m[0] - n[0] * m[2] > 0 ? [0, 1, 2] : [0, 2, 1];
        const slope = Math.sqrt(1 + 1 / (k * k));
        for (const i of order) { const [s, v, y] = q[i]; pos.push(...P3[i]); uv.push((s * -dv + v * ds) / 0.3, y * slope / 0.36); }
      };
      return { tri, quad: (a, b, c, d, k, ds, dv) => { tri([a, b, c], k, ds, dv); tri([a, c, d], k, ds, dv); } };
    },
    finish(group, map, shadows) {
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }));
      m.castShadow = shadows; m.receiveShadow = true;
      group.add(m);
    },
  };
}
// grey standing-seam metal: a seam every 0.6 m (the picture holds two, its u runs 0.3 m per unit)
function metalTex() {
  const t = canvasTex(64, 32, (c, w, hh) => {
    c.fillStyle = '#8f989e'; c.fillRect(0, 0, w, hh);
    const g = c.createLinearGradient(0, 0, w / 2, 0);
    g.addColorStop(0, '#9aa3a9'); g.addColorStop(0.5, '#8a9399'); g.addColorStop(1, '#949da3');
    for (const x0 of [0, w / 2]) { c.fillStyle = g; c.save(); c.translate(x0, 0); c.fillRect(0, 0, w / 2, hh); c.restore(); c.fillStyle = '#c4cbcf'; c.fillRect(x0, 0, 2, hh); c.fillStyle = '#5f676c'; c.fillRect(x0 + 2, 0, 1, hh); }
  });
  t.repeat.set(1 / 4, 1);
  return t;
}
// a black iron mesh of diamonds in a frame, for the panels between the brick pillars
function meshKit(group, shadows) {
  const pos = [], uv = [];
  function panel(a, b, y0, hh) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const q = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], len / 0.5, 0], [b[0], y0 + hh, b[1], len / 0.5, 1], [a[0], y0 + hh, a[1], 0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4] * hh / 0.5); }
  }
  function finish() {
    if (!pos.length) return;
    const tex = canvasTex(32, 32, (c, w, hh) => {
      c.clearRect(0, 0, w, hh); c.strokeStyle = '#1f2124'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, hh); c.moveTo(w, 0); c.lineTo(0, hh); c.stroke();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide }));
    m.castShadow = shadows;
    group.add(m);
  }
  return { panel, finish };
}
