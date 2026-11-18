// Sireli 7a in Kõrveküla, built by hand from Martin's photos (2022-2023), the Land Board's oblique photos and
// the orthophoto, in place of the map's blocks: the white two-storey gable house with its dark shingled east
// side, the low annex with the open gable porch and the glazed gable wall, dark tiled roofs with sun panels,
// the terrace with its canopy and furniture, the flat-roofed carport with slatted stores, the paved drive
// with the sliding gate, black mesh fences with thuja rows, the spruce hedge along the north side and the
// garden: garden house, apple trees, play set, swings, rotary dryer, sandpit and trampoline.
// Everything is measured in the house's own frame: e metres along the south gable (east +), n metres along
// the west wall (north +), from the main house's south-west corner; y above the ground at the house.
import * as THREE from 'three';
import { streetKit, addHouseColours } from './streetkit.js';
import { Parts, BOX } from '../race/landmarks.js';
import { realTreeKit } from './scenery.js';
import { buildCarModel } from '../cars/models/index.js';

const A = [4020.25, -2310.75], ROT = (10 * Math.PI) / 180, C = Math.cos(ROT), S = Math.sin(ROT);
const at = (e, n) => [A[0] + e * C + n * S, A[1] + e * S - n * C];
const CENTRE = at(-8, 6);
const FE = { at: (t, lat) => at(t, lat) }, FN = { at: (t, lat) => at(lat, t) };       // frames for the street kit: along e, along n

const MAIN = { w: 6.6, l: 12.3, eaves: 6.0, ridge: 8.1 };
const ANNEX = { e0: -9.4, wall: -7.0, n0: 4.78, n1: 10.58, eaves: 2.9, ridge: 4.75 };
const PORT = { y0: 2.78, y1: 3.02, e1: 9.0, n0: -5.7 };                              // the carport's flat roof
const FENCE = { s: -14.2, w: -30, e: 12.5, n: 25.6 };
const COL = {
  render: 0xf4f2ee, boards: 0xf1efe8, dark: 0x3d3e46, trim: 0x34353c, frame: 0x2c2d33, glass: 0x5f7889, glassBig: 0x6b8799,
  roof: 0x3f4048, deckSide: 0x5a4034, plinth: 0x8a8990, wood: 0xc9a274, woodDark: 0x8a6a4a, white: 0xf3f2ee, fence: 0x30323a,
  gardenHouse: 0x5c5e68, gardenRoof: 0x97a2b4, sand: 0xe6d6ab, metal: 0xb9bcc4, pipe: 0x2f3036,
};

export function sireliWalls(walls) {
  // the map's house and its carport are hidden: both are modelled here
  addHouseColours(walls, '7_-3', 3680, -2720, [
    { base: 2641, x: 4021, z: -2317, wall: COL.render, hide: true, reach: 13 },
    { base: 2955, x: 4023.6, z: -2307.3, wall: COL.dark, hide: true, reach: 8, shelter: true },
  ]);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const grey = (v, b = 1.06) => `rgb(${v | 0},${v | 0},${Math.min(255, v * b) | 0})`;
// the surfaces that carry a pattern: [texture, tile size in metres (u, v)]
function textures() {
  return {
    // dark sawn shingles: courses 25 cm high, joints staggered
    shingle: [canvasTex(256, 256, (g, w) => {
      const r = rnd(3);
      g.fillStyle = grey(52); g.fillRect(0, 0, w, w);
      for (let row = 0; row < 8; row++) for (let k = -1; k < 6; k++) {
        g.fillStyle = grey(74 + r() * 22);
        g.fillRect(k * 51.2 + (row % 2) * 25.6 + 1, row * 32 + 3, 49, 29);
      }
      for (let row = 0; row < 8; row++) { g.fillStyle = 'rgba(20,20,26,0.55)'; g.fillRect(0, row * 32, w, 3); }
    }), [2, 2]],
    // white boards, upright
    boards: [canvasTex(128, 64, (g, w, h) => {
      const r = rnd(5);
      g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 8; k++) {
        const v = 236 + r() * 14;
        g.fillStyle = `rgb(${v | 0},${v - 2 | 0},${v - 8 | 0})`; g.fillRect(k * 16 + 1, 0, 14, h);
        g.fillStyle = 'rgba(150,146,150,0.8)'; g.fillRect(k * 16, 0, 1.5, h);
      }
    }), [1.12, 1]],
    // dark upright battens with gaps
    slat: [canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = grey(30); g.fillRect(0, 0, w, h);
      for (let k = 0; k < 8; k++) { g.fillStyle = grey(72 + (k % 3) * 5); g.fillRect(k * 16 + 2, 0, 11, h); }
    }), [0.72, 1]],
    // flat dark roof tiles in courses
    tile: [canvasTex(256, 256, (g, w) => {
      const r = rnd(8);
      g.fillStyle = grey(44); g.fillRect(0, 0, w, w);
      for (let row = 0; row < 8; row++) for (let k = -1; k < 5; k++) {
        g.fillStyle = grey(64 + r() * 12);
        g.fillRect(k * 64 + (row % 2) * 32 + 1, row * 32 + 4, 62, 28);
      }
      for (let row = 0; row < 8; row++) { g.fillStyle = 'rgba(128,130,146,0.5)'; g.fillRect(0, row * 32 + 4, w, 2); }
    }), [2.4, 2.8]],
    // terrace boards
    deck: [canvasTex(128, 128, (g, w) => {
      const r = rnd(11);
      for (let k = 0; k < 8; k++) {
        const v = 0.9 + r() * 0.2;
        g.fillStyle = `rgb(${132 * v | 0},${96 * v | 0},${78 * v | 0})`; g.fillRect(0, k * 16, w, 16);
        g.fillStyle = 'rgba(60,40,34,0.9)'; g.fillRect(0, k * 16, w, 1.5);
      }
    }), [1.1, 1.1]],
    // one sun panel per tile: black cells, thin pale lines, a dark rim
    solar: [canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#2a2d3a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b2233'; g.fillRect(3, 3, w - 6, h - 6);
      g.fillStyle = 'rgba(120,136,176,0.35)';
      for (let k = 1; k < 12; k++) g.fillRect(3 + (k * (w - 6)) / 12, 3, 1, h - 6);
      for (let k = 1; k < 6; k++) g.fillRect(3, 3 + (k * (h - 6)) / 6, w - 6, 1);
      const sh = g.createLinearGradient(0, 0, w, h);
      sh.addColorStop(0, 'rgba(150,170,230,0.20)'); sh.addColorStop(0.5, 'rgba(150,170,230,0)');
      g.fillStyle = sh; g.fillRect(3, 3, w - 6, h - 6);
    }), [1.75, 1.1]],
  };
}

export function createSireli(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows, fenceColour: COL.fence });       // ground covers, fences, thujas (map coordinates)
    // the house stands level at the highest ground under it
    let Y0 = -1e9;
    for (const [e, n] of [[0, 0], [MAIN.w, 0], [MAIN.w, MAIN.l], [0, MAIN.l], [ANNEX.e0, ANNEX.n0], [ANNEX.e0, ANNEX.n1], [PORT.e1, PORT.n0]]) Y0 = Math.max(Y0, world.heightAt(...at(e, n)));
    Y0 += 0.06;
    const local = new THREE.Group();                 // the house frame: x = e, z = -n
    local.position.set(A[0], Y0, A[1]);
    local.rotation.y = -ROT;
    group.add(local);
    const gy = (e, n) => world.heightAt(...at(e, n)) - Y0;       // the ground in the house's heights

    const p = new Parts();
    const add = (geo, hex) => p.add(geo, hex, 0, 0, 0, 0);
    const box = (e0, e1, n0, n1, y0, y1, hex) => add(BOX(Math.abs(e1 - e0), Math.abs(y1 - y0), Math.abs(n1 - n0)).translate((e0 + e1) / 2, (y0 + y1) / 2, -(n0 + n1) / 2), hex);
    // a box turned about the upright axis, centred on (e, n), standing on y0
    const boxAt = (e, n, w, hgt, d, hex, yaw = 0, y0 = 0) => add(BOX(w, hgt, d).rotateY(yaw).translate(e, y0 + hgt / 2, -n), hex);
    // a thin bar between two points
    const bar = (a, b, t, hex) => {
      const va = new THREE.Vector3(a[0], a[1], -a[2]), vb = new THREE.Vector3(b[0], b[1], -b[2]), d = vb.clone().sub(va), len = d.length();
      const g = BOX(t, len, t);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      add(g, hex);
    };

    // ---- patterned surfaces: quads with the pattern laid in metres
    const TEX = textures(), quads = {};
    for (const k of Object.keys(TEX)) quads[k] = { pos: [], uv: [] };
    // a, b, d: three corners (e, y, n); the pattern's u runs a -> b, v runs a -> d
    const quad = (kind, a, b, d) => {
      const Q = quads[kind], [tu, tv] = TEX[kind][1];
      const P = [a, b, d].map((q) => new THREE.Vector3(q[0], q[1], -q[2])), c = P[1].clone().add(P[2]).sub(P[0]);
      const u = P[1].distanceTo(P[0]) / tu, v = P[2].distanceTo(P[0]) / tv;
      for (const [q, uu, vv] of [[P[0], 0, 0], [P[1], u, 0], [c, u, v], [P[0], 0, 0], [c, u, v], [P[2], 0, v]]) { Q.pos.push(q.x, q.y, q.z); Q.uv.push(uu, vv); }
    };
    // an upright patterned wall from (e0, n0) to (e1, n1)
    const wall = (kind, e0, n0, e1, n1, y0, y1) => quad(kind, [e0, y0, n0], [e1, y0, n1], [e0, y1, n0]);

    // a pentagon (gabled) solid: cross-section over `a` (a0..a1, eaves, ridge at the middle), extruded b0..b1
    const gabled = (alongN, a0, a1, b0, b1, yBase, yE, yR, hex) => {
      const s = new THREE.Shape();
      s.moveTo(a0, yBase); s.lineTo(a1, yBase); s.lineTo(a1, yE); s.lineTo((a0 + a1) / 2, yR); s.lineTo(a0, yE); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: b1 - b0, bevelEnabled: false });
      if (alongN) g.translate(0, 0, -b1);                         // section in e, ridge along n
      else g.rotateY(Math.PI / 2).translate(b0, 0, 0);            // section in n, ridge along e
      add(g, hex);
    };
    // one roof slope, 14 cm thick: ridge along n (axisN) at e = ridge, or along e at n = ridge; eave at `eave`, y0 -> y1,
    // from a0 to a1 along the ridge. Returns pt(u, v): the point u along the ridge, v metres up the slope, lifted `up`.
    const slope = (axisN, ridge, eave, y0, y1, a0, a1) => {
      const run = ridge - eave, len = Math.hypot(run, y1 - y0), ang = Math.atan2(y1 - y0, Math.abs(run)), T = 0.14, sg = Math.sign(run);
      const lift = T / 2 / Math.cos(ang);
      const g = axisN ? BOX(len, T, a1 - a0).rotateZ(sg * ang).translate((eave + ridge) / 2, (y0 + y1) / 2 + lift, -(a0 + a1) / 2)
        : BOX(a1 - a0, T, len).rotateX(sg * ang).translate((a0 + a1) / 2, (y0 + y1) / 2 + lift, -(eave + ridge) / 2);
      add(g, COL.roof);
      const pt = (u, v, up = 0) => {
        const h = eave + sg * v * Math.cos(ang), y = y0 + v * Math.sin(ang) + (2 * lift) + up / Math.cos(ang);
        return axisN ? [h, y, u] : [u, y, h];
      };
      quad('tile', pt(a0, 0, 0.012), pt(a1, 0, 0.012), pt(a0, len, 0.012));
      return { pt, len };
    };
    // sun panels on a slope: a block of whole panels from u0, v0
    const panels = (sl, u0, v0, cols, rows) => {
      const u1 = u0 + cols * 1.75, v1 = v0 + rows * 1.1;
      quad('solar', sl.pt(u0, v0, 0.07), sl.pt(u1, v0, 0.07), sl.pt(u0, v1, 0.07));
      for (const [ua, ub, va, vb] of [[u0, u1, v0, v0], [u0, u1, v1, v1], [u0, u0, v0, v1], [u1, u1, v0, v1]]) bar(sl.pt(ua, va, 0.035), sl.pt(ub, vb, 0.035), 0.06, COL.frame);
    };
    // a window in an upright wall. axisN: the wall runs along n at e = pos (else along e at n = pos); out: +1 / -1,
    // the side it faces; a0..a1 along the wall
    const win = (axisN, pos, out, a0, a1, y0, y1, { bars = 0, rails = 0, fw = 0.07, glass = COL.glass, frame = COL.frame } = {}) => {
      const slab = (b0, b1, v0, v1, d0, d1, hex) => (axisN ? box(pos + out * d0, pos + out * d1, b0, b1, v0, v1, hex) : box(b0, b1, pos + out * d0, pos + out * d1, v0, v1, hex));
      slab(a0 - fw, a1 + fw, y0 - fw, y1 + fw, -0.02, 0.06, frame);
      slab(a0, a1, y0, y1, 0, 0.075, glass);
      for (let k = 1; k <= bars; k++) { const s = a0 + ((a1 - a0) * k) / (bars + 1); slab(s - 0.03, s + 0.03, y0, y1, 0, 0.09, frame); }
      for (let k = 1; k <= rails; k++) { const y = y0 + ((y1 - y0) * k) / (rails + 1); slab(a0, a1, y - 0.03, y + 0.03, 0, 0.09, frame); }
    };

    // ================= the main house =================
    const M = MAIN, tanM = (M.ridge - M.eaves) / (M.w / 2);
    gabled(true, 0, M.w, 0, M.l, -1, M.eaves, M.ridge, COL.render);
    box(-0.03, M.w + 0.03, -0.03, M.l + 0.03, -1, 0.22, COL.plinth);
    {
      const ov = 0.3, g = 0.28;       // eaves and gable overhangs
      const west = slope(true, M.w / 2, -ov, M.eaves - ov * tanM, M.ridge, -g, M.l + g);
      const east = slope(true, M.w / 2, M.w + ov, M.eaves - ov * tanM, M.ridge, -g, M.l + g);
      panels(west, 0.9, 0.5, 6, 3);
      panels(east, 0.7, 1.35, 5, 2);
      box(M.w / 2 - 0.12, M.w / 2 + 0.12, -g, M.l + g, M.ridge + 0.1, M.ridge + 0.24, COL.roof);      // ridge cap
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 10).translate(M.w / 2 + 0.9, M.ridge - 0.1, -(M.l - 1.3)), COL.pipe);     // flue
      // gutters and downpipes
      for (const e of [-ov - 0.06, M.w + ov + 0.06]) box(e - 0.07, e + 0.07, -g, M.l + g, M.eaves - ov * tanM - 0.04, M.eaves - ov * tanM + 0.08, COL.trim);
      box(-0.16, -0.06, 0.1, 0.2, 2.7, M.eaves - 0.2, COL.trim);
    }
    // the east side and its corners are clad in dark shingles
    wall('shingle', M.w + 0.035, 0, M.w + 0.035, M.l, PORT.y1, M.eaves);
    wall('shingle', M.w + 0.035, 0, M.w + 0.035, M.l, 0, PORT.y0);
    for (const n of [0, M.l]) {                       // dark corner boards on both gables, up to the roof
      const s = n ? 1 : -1;
      box(M.w - 0.22, M.w + 0.05, n, n + s * 0.05, 0, M.eaves + 0.1, COL.dark);
      box(-0.05, 0.14, n, n + s * 0.045, 0, M.eaves - 0.05, COL.trim);
    }
    // windows. South gable: one upstairs west of the middle, a glazed door under the carport
    win(false, 0, -1, 1.5, 2.9, 3.9, 5.3, {});
    win(false, 0, -1, 3.9, 4.85, 0.25, 2.25, {});
    // north gable: slim window and the back door, wall lamps
    win(false, M.l, 1, 4.95, 5.55, 0.3, 2.1, {});
    win(false, M.l, 1, 1.2, 2.1, 0.22, 2.3, { glass: 0x6a6c76, frame: 0x55565f });
    for (const e of [0.75, 2.6]) box(e - 0.08, e + 0.08, M.l, M.l + 0.1, 2.5, 2.66, COL.frame);
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).rotateX(Math.PI / 2).translate(M.w / 2, M.ridge - 0.9, -(M.l + 0.03)), COL.metal);
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).rotateX(Math.PI / 2).translate(M.w / 2 - 0.2, M.ridge - 0.9, 0.03), COL.metal);
    // west wall: two-pane windows upstairs (one over the terrace, one over the annex), sliding door to the terrace
    win(true, 0, -1, 1.9, 3.4, 3.9, 5.3, { bars: 1 });
    win(true, 0, -1, 8.5, 10.1, 4.15, 5.45, { bars: 1 });
    win(true, 0, -1, 1.75, 4.1, 0.38, 2.5, { bars: 1 });
    // east wall: three windows in a row upstairs with dark reveals, the front door under the canopy
    for (const n of [4.6, 6.8, 9.0]) {
      box(M.w + 0.03, M.w + 0.07, n - 0.22, n + 1.42, 4.05, 5.45, 0x26272c);
      win(true, M.w + 0.04, 1, n, n + 1.2, 4.2, 5.3, { bars: 1 });
    }
    win(true, M.w + 0.04, 1, 7.2, 8.2, 0.12, 2.25, { glass: 0x6b4a3c, frame: COL.frame });
    win(true, M.w + 0.04, 1, 8.35, 8.7, 0.12, 2.25, {});
    box(M.w + 0.04, M.w + 1.1, 6.9, 9.0, -0.3, 0.12, 0x9a99a2);        // door step

    // ================= the annex =================
    const X = ANNEX, nR = (X.n0 + X.n1) / 2, tanA = (X.ridge - X.eaves) / (nR - X.n0);
    const under = (n) => X.eaves + (nR - X.n0 - Math.abs(n - nR)) * tanA;          // underside of the roof at n
    gabled(false, X.n0, X.n1, X.wall, 0.05, -1, X.eaves, X.ridge, COL.boards);
    box(X.wall - 0.02, 0.02, X.n0 - 0.03, X.n1 + 0.03, -1, 0.2, COL.plinth);
    {
      const ov = 0.3, a0 = X.e0 - 0.15;
      const south = slope(false, nR, X.n0 - ov, X.eaves - ov * tanA, X.ridge, a0, 0);
      slope(false, nR, X.n1 + ov, X.eaves - ov * tanA, X.ridge, a0, 0);
      panels(south, -8.8, 1.9, 4, 1);
      panels(south, -8.8, 0.72, 3, 1);
      box(a0, 0, nR - 0.12, nR + 0.12, X.ridge + 0.1, X.ridge + 0.24, COL.roof);
      box(a0, 0, X.n0 - ov - 0.13, X.n0 - ov + 0.01, X.eaves - ov * tanA - 0.04, X.eaves - ov * tanA + 0.08, COL.trim);       // gutters
      box(a0, 0, X.n1 + ov - 0.01, X.n1 + ov + 0.13, X.eaves - ov * tanA - 0.04, X.eaves - ov * tanA + 0.08, COL.trim);
      box(-6.5, -6.4, X.n0 - 0.14, X.n0 - 0.04, 0.35, X.eaves - 0.2, COL.trim);                                                // downpipe
      // the porch: the roof runs on past the glazed wall. Dark frame at the front, the north side closed
      // (shingles outside, white boards inside), white board ceiling
      for (const n of [X.n0, X.n1 - 0.2]) box(X.e0 - 0.02, X.e0 + 0.2, n, n + 0.2, -0.5, under(n + 0.1) + 0.02, COL.dark);
      box(X.e0 + 0.2, X.wall, X.n1 - 0.16, X.n1, -0.5, X.eaves + 0.02, COL.boards);
      wall('boards', X.e0 + 0.2, X.n1 - 0.17, X.wall, X.n1 - 0.17, 0.32, X.eaves);
      for (const s of [-1, 1]) {
        const nE = nR + s * (nR - X.n0 + ov);
        quad('boards', [X.e0 - 0.1, X.eaves - ov * tanA - 0.012, nE], [X.e0 - 0.1, X.ridge - 0.012, nR], [X.wall, X.eaves - ov * tanA - 0.012, nE]);
        // dark barge board along the rake, front and back faces
        bar([X.e0 - 0.16, X.eaves - ov * tanA + 0.02, nE], [X.e0 - 0.16, X.ridge + 0.02, nR], 0.26, COL.dark);
      }
      box(X.e0 - 0.24, X.e0 - 0.14, nR - 0.06, nR + 0.06, X.ridge - 0.75, X.ridge - 0.1, COL.white);       // the white drop at the ridge
    }
    // walls: shingles on the north side, white boards to the terrace
    wall('shingle', X.e0, X.n1 + 0.03, 0, X.n1 + 0.03, 0.2, X.eaves);
    wall('boards', X.wall, X.n0 - 0.03, 0, X.n0 - 0.03, 0.2, X.eaves);
    // the glazed gable: a wall of glass under the roof line with a door, uprights and a transom
    {
      const g0 = X.n0 + 0.5, g1 = X.n1 - 0.5, yb = 0.36, e = X.wall;
      const s = new THREE.Shape();
      s.moveTo(g0, yb); s.lineTo(g1, yb); s.lineTo(g1, under(g1) - 0.12); s.lineTo(nR, under(nR) - 0.12); s.lineTo(g0, under(g0) - 0.12); s.closePath();
      add(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }).rotateY(Math.PI / 2).translate(e - 0.07, 0, 0), COL.glassBig);
      const F = (n0, n1, y0, y1) => box(e - 0.1, e - 0.02, n0, n1, y0, y1, COL.frame);
      for (const n of [g0, g0 + (g1 - g0) / 4, nR, g1 - (g1 - g0) / 4, g1]) F(n - 0.045, n + 0.045, yb, under(n) - 0.1);
      F(g0, g1, 2.2, 2.29); F(g0, g1, yb - 0.08, yb + 0.02);
      for (const sg of [-1, 1]) bar([e - 0.06, under(g0) - 0.14, nR + sg * (nR - g0)], [e - 0.06, under(nR) - 0.14, nR], 0.09, COL.frame);
      // the door in the second bay from the north
      const d1 = nR + 0.95;
      F(d1 - 0.05, d1, yb, 2.2); box(e - 0.14, e - 0.1, d1 - 0.16, d1 - 0.12, 1.25, 1.42, COL.metal);
    }
    // south wall to the terrace: a tall slim window, the wide sliding door under the canopy
    win(false, X.n0 - 0.03, -1, -5.75, -5.0, 0.38, 2.45, {});
    win(false, X.n0 - 0.03, -1, -4.2, -1.3, 0.38, 2.5, { bars: 1 });
    // north wall: two small windows and a slim tall one
    win(false, X.n1 + 0.03, 1, -2.6, -1.8, 1.1, 2.0, {});
    win(false, X.n1 + 0.03, 1, -4.1, -3.3, 1.1, 2.0, {});
    win(false, X.n1 + 0.03, 1, -5.6, -5.25, 0.4, 2.2, {});

    // ================= terrace, canopy and furniture =================
    const DECK = 0.32;
    {
      const d = (e0, e1, n0, n1) => {
        box(e0, e1, n0, n1, -0.6, DECK - 0.01, COL.deckSide);
        quad('deck', [e0, DECK, n0], [e1, DECK, n0], [e0, DECK, n1]);
      };
      d(-10.4, 0, 1.55, X.n0);                        // along the annex and into the corner by the main house
      d(-10.4, X.wall, X.n0, X.n1 - 0.16);            // the porch floor and on past it to the west
      box(-10.75, 0, 1.2, 1.55, -0.6, DECK / 2, COL.deckSide);         // a step all round
      box(-10.75, -10.4, 1.2, X.n1 - 0.16, -0.6, DECK / 2, COL.deckSide);
      // the canopy in the corner: a thin dark roof on slim posts
      box(-5.6, -0.02, 1.45, X.n0 - 0.02, 2.56, 2.68, COL.trim);
      box(-5.6, -0.02, 1.45, 1.55, 2.46, 2.56, COL.trim);
      for (const e of [-4.7, -3.15, -1.6, -0.12]) box(e - 0.045, e + 0.045, 1.5, 1.59, DECK, 2.56, COL.trim);
      // table and six chairs under it
      const tE = -2.9, tN = 3.15;
      box(tE - 0.95, tE + 0.95, tN - 0.45, tN + 0.45, DECK + 0.7, DECK + 0.75, COL.woodDark);
      for (const [de, dn] of [[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]]) box(tE + de - 0.035, tE + de + 0.035, tN + dn - 0.035, tN + dn + 0.035, DECK, DECK + 0.7, COL.woodDark);
      const chair = (e, n, yaw, hex = COL.woodDark) => {
        boxAt(e, n, 0.46, 0.05, 0.46, hex, yaw, DECK + 0.42);
        boxAt(e - Math.sin(yaw) * 0.22, n - Math.cos(yaw) * 0.22, 0.46, 0.5, 0.05, hex, yaw, DECK + 0.45);
        for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) boxAt(e + a * Math.cos(yaw) - b * Math.sin(yaw), n - a * Math.sin(yaw) - b * Math.cos(yaw), 0.04, 0.42, 0.04, hex, yaw, DECK);
      };
      for (const de of [-0.6, 0, 0.6]) { chair(tE + de, tN - 0.75, 0); chair(tE + de, tN + 0.75, Math.PI); }
      for (const [e, n] of [[-0.75, 3.9], [-0.75, 4.4]]) chair(e, n, -Math.PI / 2, COL.white);       // two white chairs by the wall
      // two loungers west of the canopy
      for (const [e, n, yaw] of [[-6.6, 2.5, 0.25], [-7.5, 2.7, 0.1]]) {
        boxAt(e, n, 0.6, 0.06, 1.25, 0x9a968c, yaw, DECK + 0.32);
        add(BOX(0.6, 0.06, 0.8).rotateX(-0.9).translate(0, 0.3, -0.25).rotateY(yaw).translate(e + Math.sin(yaw) * -0.75, DECK + 0.4, -(n + Math.cos(yaw) * 0.75)), 0x9a968c);
        boxAt(e, n, 0.5, 0.3, 0.9, COL.frame, yaw, DECK);
      }
      // kettle barbecue
      add(new THREE.SphereGeometry(0.3, 12, 8).scale(1, 0.85, 1).translate(-0.75, DECK + 0.85, -2.2), 0x1d1e22);
      for (const a of [0, 2.1, 4.2]) bar([-0.75 + Math.cos(a) * 0.12, DECK + 0.7, 2.2 + Math.sin(a) * 0.12], [-0.75 + Math.cos(a) * 0.28, DECK, 2.2 + Math.sin(a) * 0.28], 0.03, COL.metal);
      // bench and wooden boxes on the porch side, a white planter
      box(-6.0, -4.9, 4.2, 4.6, DECK + 0.38, DECK + 0.44, COL.woodDark);
      for (const e of [-5.9, -5.0]) box(e - 0.04, e + 0.04, 4.22, 4.58, DECK, DECK + 0.38, COL.woodDark);
      box(-8.6, -8.0, 5.3, 5.7, DECK, DECK + 0.26, COL.woodDark);
      box(-1.3, -0.5, 1.7, 2.0, DECK, DECK + 0.24, COL.white);
      // toy digger on the deck
      box(-5.5, -5.1, 2.0, 2.2, DECK, DECK + 0.2, 0xf1c232);
    }

    // ================= carport, stores and the canopy along the east side =================
    {
      const R = PORT, slatBox = (e0, e1, n0, n1, y1 = R.y0) => {
        box(e0 + 0.02, e1 - 0.02, n0 + 0.02, n1 - 0.02, -0.5, y1, 0x2a2b31);
        wall('slat', e0, n0, e1, n0, -0.1, y1); wall('slat', e1, n0, e1, n1, -0.1, y1);
        wall('slat', e1, n1, e0, n1, -0.1, y1); wall('slat', e0, n1, e0, n0, -0.1, y1);
      };
      // the roof: over the cars in front of the south gable, then a strip along the east wall
      box(-0.12, R.e1, R.n0, 0, R.y0, R.y1, COL.trim);
      box(M.w + 0.05, R.e1, 0, M.l + 0.1, R.y0, R.y1, COL.trim);
      box(M.w + 0.6, R.e1 - 0.5, 3.0, 5.4, R.y1, R.y1 + 0.05, 0xd9dde4);          // the clear roof light
      // stores: the big one at the south-west corner, one at the far end of the east strip
      slatBox(-0.05, 2.75, R.n0 + 0.08, -1.55);
      slatBox(M.w + 0.08, R.e1 - 0.06, 9.7, M.l + 0.04);
      // slatted screens at the south-east corner
      box(7.0, R.e1 - 0.05, R.n0 + 0.06, R.n0 + 0.14, 0, R.y0, 0x2a2b31);
      wall('slat', 7.0, R.n0 + 0.05, R.e1 - 0.05, R.n0 + 0.05, 0, R.y0); wall('slat', 7.0, R.n0 + 0.15, R.e1 - 0.05, R.n0 + 0.15, 0, R.y0);
      box(R.e1 - 0.13, R.e1 - 0.05, R.n0 + 0.06, -3.0, 0, R.y0, 0x2a2b31);
      wall('slat', R.e1 - 0.04, R.n0 + 0.06, R.e1 - 0.04, -3.0, 0, R.y0); wall('slat', R.e1 - 0.14, R.n0 + 0.06, R.e1 - 0.14, -3.0, 0, R.y0);
      // posts
      for (const [e, n] of [[R.e1 - 0.1, 0.4], [R.e1 - 0.1, 3.4], [R.e1 - 0.1, 6.4], [2.85, R.n0 + 0.12], [2.85, -1.6]]) box(e - 0.05, e + 0.05, n - 0.05, n + 0.05, -0.3, R.y0, COL.trim);
      // a child's balance bike by the door
      boxAt(7.6, 5.6, 0.7, 0.06, 0.05, 0x2f6fd0, 0.3, 0.38);
      for (const de of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 12).rotateX(Math.PI / 2).rotateY(0.3).translate(7.6 + de * Math.cos(0.3), 0.19, -(5.6 - de * Math.sin(0.3))), 0x1a1a1e);
    }

    // ================= the garden house (stands square to the map, not to the house) =================
    {
      const [ce, cn] = [-25, 18.2], y = gy(ce, cn), w = 5.6, l = 8.6, h0 = 2.45, h1 = 3.05;
      const put = (g, hex) => add(g.rotateY(ROT).translate(ce, y, -cn), hex);
      put(BOX(w, h1, l).translate(0, h1 / 2 - 0.3, 0), COL.gardenHouse);
      // one-pitch roof, high on the east side
      put(BOX(w + 0.7, 0.14, l + 0.6).rotateZ(Math.atan2(h1 - h0, w)).translate(0, (h0 + h1) / 2 + 0.42, 0), COL.gardenRoof);
      // east face: glazed door, a wide window; a window to the south
      put(BOX(0.06, 2.0, 1.7).translate(w / 2 + 0.02, 1.1, 1.6), COL.frame); put(BOX(0.06, 1.86, 1.56).translate(w / 2 + 0.035, 1.1, 1.6), COL.glass);
      put(BOX(0.06, 1.1, 1.5).translate(w / 2 + 0.02, 1.5, -1.8), COL.frame); put(BOX(0.06, 0.96, 1.36).translate(w / 2 + 0.035, 1.5, -1.8), COL.glass);
      put(BOX(1.4, 1.0, 0.06).translate(0, 1.5, l / 2 + 0.02), COL.frame); put(BOX(1.26, 0.86, 0.06).translate(0, 1.5, l / 2 + 0.035), COL.glass);
      // pale terrace at the south end
      put(BOX(w - 1.2, 0.5, 2.0).translate(0.4, -0.12, l / 2 + 1.0), 0xe4dfd2);
    }

    // ================= the garden =================
    // play set: timber swing frame with two swings, a tower with a yellow slide, a white frame swing
    {
      const [e0, n0] = [-12.2, 23.3], y = gy(e0 + 1.6, n0), H = 2.25, L = 3.2;
      for (const e of [e0, e0 + L]) for (const s of [-1, 1]) bar([e, y, n0 + s * 0.95], [e, y + H, n0], 0.09, COL.wood);
      bar([e0 - 0.15, y + H, n0], [e0 + L + 0.15, y + H, n0], 0.11, COL.wood);
      for (const [e, hex] of [[e0 + 0.9, 0x2f6fd0], [e0 + 2.2, 0xd8413a]]) {
        for (const s of [-0.2, 0.2]) bar([e + s, y + H, n0], [e + s, y + 0.5, n0 + 0.12], 0.02, 0x565861);
        boxAt(e, n0 + 0.12, 0.46, 0.05, 0.2, hex, 0, y + 0.47);
      }
      // tower at the west end: platform, rails, ladder, slide to the south
      const te = e0 - 1.0, P = 1.25;
      for (const de of [-0.55, 0.55]) for (const dn of [-0.55, 0.55]) boxAt(te + de, n0 + dn, 0.08, 2.1, 0.08, COL.wood, 0, y);
      boxAt(te, n0, 1.2, 0.06, 1.2, COL.wood, 0, y + P);
      for (const dn of [-0.58, 0.58]) boxAt(te, n0 + dn, 1.2, 0.06, 0.04, COL.wood, 0, y + P + 0.7);
      for (const s of [-0.25, 0.25]) bar([te + s, y, n0 + 1.25], [te + s, y + P, n0 + 0.6], 0.05, COL.wood);
      for (let k = 1; k < 5; k++) bar([te - 0.25, y + (P * k) / 5, n0 + 1.25 - (0.65 * k) / 5], [te + 0.25, y + (P * k) / 5, n0 + 1.25 - (0.65 * k) / 5], 0.04, COL.wood);
      add(BOX(0.5, 0.05, 2.6).rotateX(Math.atan2(P, 2.3)).translate(te, y + P / 2 + 0.03, -(n0 - 0.6 - 1.15)), 0xf2d032);
      for (const s of [-0.25, 0.25]) add(BOX(0.04, 0.16, 2.6).rotateX(Math.atan2(P, 2.3)).translate(te + s, y + P / 2 + 0.1, -(n0 - 0.6 - 1.15)), 0xf2d032);
      // the white frame swing a few metres west
      const we = e0 - 4.6, wn = n0 - 0.6, wy = gy(we, wn);
      for (const e of [we, we + 1.9]) for (const s of [-1, 1]) bar([e, wy, wn + s * 0.8], [e, wy + 2.0, wn], 0.07, COL.white);
      bar([we - 0.1, wy + 2.0, wn], [we + 2.0, wy + 2.0, wn], 0.08, COL.white);
      for (const s of [-0.2, 0.2]) bar([we + 0.95 + s, wy + 2.0, wn], [we + 0.95 + s, wy + 0.5, wn], 0.02, 0x565861);
      boxAt(we + 0.95, wn, 0.46, 0.05, 0.2, 0xd8413a, 0, wy + 0.47);
    }
    // rotary dryer: white mast, four arms, three rounds of line
    {
      const [e, n] = [0.9, 23.8], y = gy(e, n), top = 1.95, mast = [e, y + 1.0, n];
      bar([e, y, n], [e, y + top, n], 0.06, COL.white);
      const tip = (k, f) => { const a = 0.5 + (k * Math.PI) / 2; return [e + Math.cos(a) * 1.55 * f, y + 1.0 + (top - 1.0) * f, n + Math.sin(a) * 1.55 * f]; };
      for (let k = 0; k < 4; k++) {
        bar(mast, tip(k, 1), 0.035, COL.white);
        for (const f of [0.45, 0.72, 1]) bar(tip(k, f), tip(k + 1, f), 0.014, 0xe9ecf2);
      }
    }
    // sandpit with a timber rim, a raised bed further east
    {
      const [e, n] = [-15.6, 18.6], y = gy(e, n);
      boxAt(e, n, 1.9, 0.22, 1.9, COL.wood, 0.3, y - 0.02);
      boxAt(e, n, 1.66, 0.2, 1.66, COL.sand, 0.3, y + 0.02);
      boxAt(e + 0.4, n - 0.2, 0.22, 0.16, 0.2, 0xd8413a, 0.9, y + 0.2);
      boxAt(4.6, 21.8, 1.6, 0.3, 0.9, COL.woodDark, 0.1, gy(4.6, 21.8));
      boxAt(4.6, 21.8, 1.44, 0.3, 0.74, 0x5d4a3e, 0.1, gy(4.6, 21.8) + 0.02);
    }
    // trampoline on the south lawn (it shows in the newest aerial photo)
    {
      const [e, n] = [-10.4, -9.1], y = gy(e, n), r = 2.05;
      add(new THREE.CylinderGeometry(r, r, 0.05, 28).translate(e, y + 0.78, -n), 0x1c1d22);
      add(new THREE.TorusGeometry(r - 0.16, 0.17, 6, 28).rotateX(Math.PI / 2).scale(1, 0.35, 1).translate(e, y + 0.82, -n), 0x2f8f6a);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3, q = [e + Math.cos(a) * r, 0, n + Math.sin(a) * r];
        bar([q[0], y, q[2]], [q[0], y + 2.5, q[2]], 0.05, 0x3a3c44);
      }
      add(new THREE.TorusGeometry(r, 0.03, 5, 28).rotateX(Math.PI / 2).translate(e, y + 2.5, -n), 0x3a3c44);
    }

    // ================= ground: drive, paths, fences, the gate, thujas =================
    K.ribbon(FE, -0.3, 7.4, FENCE.s - 0.2, PORT.n0, 'dark', true);                 // the paved drive
    K.ribbon(FE, -0.2, PORT.e1 + 0.3, PORT.n0, 0, 'dark', true);                   // under the carport
    K.ribbon(FE, MAIN.w, PORT.e1 + 0.5, 0, MAIN.l + 1.6, 'dark', true);            // along the east side
    K.ribbon(FE, -0.6, MAIN.w, MAIN.l, MAIN.l + 1.6, 'dark', true);                // behind the north gable
    K.ribbon(FE, -0.3, 7.4, FENCE.s - 1.6, FENCE.s - 0.2, 'concrete', true);       // apron to the road
    const FH = 1.5;
    K.fence(FE, FENCE.w, -0.6, FENCE.s, FH, COL.fence);
    K.fence(FE, 7.7, FENCE.e, FENCE.s, FH, COL.fence);
    K.fence(FN, FENCE.s, FENCE.n, FENCE.w, FH, COL.fence);
    K.fence(FN, FENCE.s, FENCE.n, FENCE.e, FH, COL.fence);
    // the sliding gate stands open, drawn back behind the fence west of the drive; its posts either side of the drive
    {
      const n = FENCE.s + 0.35, g0 = -8.9, g1 = -0.7, y = Math.max(gy(g0, n), gy(g1, n)) + 0.1, H = 1.55;
      box(g0, g1, n - 0.04, n + 0.04, y, y + 0.1, COL.frame); box(g0, g1, n - 0.03, n + 0.03, y + H - 0.07, y + H, COL.frame);
      for (const e of [g0, g1 - 0.06, (g0 + g1) / 2]) box(e, e + 0.06, n - 0.03, n + 0.03, y, y + H, COL.frame);
      for (let e = g0 + 0.16; e < g1 - 0.1; e += 0.16) box(e, e + 0.02, n - 0.012, n + 0.012, y + 0.1, y + H - 0.07, COL.frame);
      bar([g0 + 0.05, y + 0.1, n], [(g0 + g1) / 2, y + H - 0.05, n], 0.045, COL.frame); bar([(g0 + g1) / 2, y + H - 0.05, n], [g1 - 0.05, y + 0.1, n], 0.045, COL.frame);
      for (const e of [-0.55, 7.65]) boxAt(e, FENCE.s, 0.14, 1.85, 0.14, COL.frame, 0, gy(e, FENCE.s));
      boxAt(7.65, FENCE.s - 0.25, 0.3, 0.4, 0.2, 0x8f9199, 0, gy(7.65, FENCE.s) + 0.9);       // the gate motor's box
    }
    // thuja rows: inside the street fence, young ones east of the drive and along the east fence, two on the lawn
    const r = rnd(41);
    const OLIVE = [0x6f8a4a, 0x7d9853, 0x64803f];                 // young thujas, yellower than the street kit's
    const thuja = (e, n, hgt, rad, c) => {
      const [x, z] = at(e, n), y = world.heightAt(x, z), hex = OLIVE[Math.abs(c) % 3];
      K.p.add(new THREE.CylinderGeometry(rad * 0.8, rad, hgt * 0.5, 8), hex, x, y + hgt * 0.25, z, c);
      K.p.add(new THREE.ConeGeometry(rad * 0.8, hgt * 0.5, 8), hex, x, y + hgt * 0.75, z, c);
    };
    for (let e = FENCE.w + 0.7; e < -1.3; e += 0.98) thuja(e, FENCE.s + 0.75, 1.45 + r() * 0.35, 0.4, Math.round(e * 3));
    for (let e = 8.4; e < FENCE.e - 0.4; e += 1.05) thuja(e, FENCE.s + 0.75, 1.0 + r() * 0.2, 0.3, Math.round(e * 3));
    for (let n = FENCE.s + 1.8; n < 12; n += 1.7) thuja(FENCE.e - 0.8, n, 0.9 + r() * 0.25, 0.28, Math.round(n * 3));
    for (const [e, n] of [[-2.4, -7.6], [-5.6, -8.0]]) thuja(e, n, 1.35, 0.36, 1);
    K.finish();

    // ---- trees: the spruce hedge along the north side, apple trees round the lawn
    const kit = realTreeKit();
    const plant = (sp, list) => {
      if (!sp || !sp.near) return false;
      const im = new THREE.InstancedMesh(sp.near, sp.soloMat, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
      list.forEach((t, k) => {
        const [x, z] = at(t[0], t[1]);
        m.compose(new THREE.Vector3(x, world.heightAt(x, z) - 0.1, z), q.setFromAxisAngle(up, t[4] * 6.283), new THREE.Vector3(t[3], t[2], t[3]));
        im.setMatrixAt(k, m);
        im.setColorAt(k, col.setScalar(0.9 + t[4] * 0.16));
      });
      im.castShadow = shadows;
      im.frustumCulled = false;
      group.add(im);
      return true;
    };
    const hedge = [], apples = [[-18.6, 20.4, 3.6, 4.4], [-13.2, 15.6, 3.9, 4.8], [-7.6, 15.0, 3.5, 4.2], [-3.0, 18.2, 3.8, 4.6], [7.2, 22.6, 3.6, 4.4]].map((t) => [...t, r()]);
    for (let e = -28.6, k = 0; e < 23; e += 1.2, k++) hedge.push([e, 28.2 + (k % 2 ? 0.7 : -0.7) + r() * 0.4, 4.6 + r() * 1.1, 4.0 + r() * 0.8, r()]);
    if (!plant(kit && kit.species[4], hedge)) for (const t of hedge) { const q = at(t[0], t[1]); K.thuja(q[0], q[1], t[2], 1.4, 0); }
    plant(kit && kit.species[0], apples);

    // ---- assemble
    for (const k of Object.keys(quads)) {
      const Q = quads[k];
      if (!Q.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(Q.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(Q.uv, 2));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: TEX[k][0], side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      mesh.receiveShadow = true;
      local.add(mesh);
    }
    const body = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.castShadow = shadows; body.receiveShadow = true;
    local.add(body);

    // ---- what a car cannot drive through (the house itself is solid in the map already)
    const solid = (e, n, he, hn, yaw = -ROT) => { const [x, z] = at(e, n); return { x, z, yaw, hx: he, hz: hn }; };
    world.addSolids([
      solid(1.35, -3.6, 1.4, 2.05), solid(7.85, 11.0, 1.15, 1.35), solid(8.0, PORT.n0 + 0.1, 1.0, 0.1), solid(-25, 18.2, 2.8, 4.3, 0),
      solid(-10.4, -9.1, 1.8, 1.8), solid(-5.2, 3.1, 5.2, 1.6), solid(-8.7, 7.6, 1.7, 2.9),
    ]);

    // ---- the family car on the drive, nose under the carport roof
    setTimeout(() => {
      const [x, z] = at(4.9, -7.3), yaw = ROT, wb = 2.69;
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);
      world.addSolids([{ x, z, yaw: Math.atan2(-fz, fx), hx: 2.3, hz: 0.93 }]);
      const model = buildCarModel('rav4');
      model.setLights({ headlights: false });
      model.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
      model.group.position.set(x, (world.heightAt(x + fx * wb / 2, z + fz * wb / 2) + world.heightAt(x - fx * wb / 2, z - fz * wb / 2)) / 2 + 0.085, z);
      model.group.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = true; } });
      group.add(model.group);
    }, 500);
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if ([[0, 0], [-30, 30], [20, 30], [-30, -16], [14, -16]].every((q) => world.ready(...at(q[0], q[1])))) build();
    },
  };
}
