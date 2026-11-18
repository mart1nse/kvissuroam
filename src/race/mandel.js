// Mandel kohvik-koogipood at Veski 7 and the stretch of Veski before it on the lap (Martin, 18 Nov, from
// his Google street views of Aug 2024), in pastel colours.
//   the cafe: white rough-rendered front over a red-brown plinth, the painted "KOOGIPOOD Mandel KOOGIPOOD"
//   band with a coffee cup, two blue-and-white striped awnings over the latticed windows, window boxes and
//   big baskets of pink petunias, wall lamps, red-brown downpipes, the brick-paved terrace with white
//   metal tables and chairs, a white bench, a pot of blue flowers, two loop bike racks, the chalk A-board
//   by the hedge, the black iron side gate with its "SALAAD" board and the cream picket fence beyond
//   the street before it: the raised crossing with its checkered ramp markings and the blue and white
//   posts at the kerbs, the low red brick wall with pillars and a gate on the right, the cream picket
//   fences on concrete posts (left before the crossing, the villa garden on the right after it), the bike
//   symbols on the road and the 30 sign
// The map's lit box sign for Mandel is left out: the real name is painted on the wall.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX } from './landmarks.js';
import { streetKit, wallOf, setHouseColours } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';

// the cafe front from the LOD2 model (game x, z), left to right seen from the street; base and eave (world y)
const FRONT = { a: [653.65, 2659.8], b: [659.9, 2651.45], y: 29.89, top: 36.7 };
const SIGN = [656.7, 2655.9];                       // the map's box sign, not drawn
const CENTRE = [680, 2630];
const ZEBRA = { c: [686.8, 2625.5], i: 1474 };      // the crossing on the lap (map prop)
const COL = {
  render: 0xf4f1ec, plinth: 0xa9655d, pipe: 0xa45f55, door: 0x8e4f4b, frame: 0xf6f4f0, glass: 0x7f8fa3, lattice: 0x4a4650,
  awning: 0x6f7fa8, metal: 0xf4f2f0, board: 0x2d2a30, iron: 0x26252b, box: 0x7d5b4c, soil: 0x5e4a40,
  pink: [0xe0559e, 0xf07ab8, 0xc94a8c], leaf: [0x4f8a4a, 0x5f9a52, 0x3f7a44], blue: [0x7f7fe0, 0x9a8cf0],
  hedge: [0x4c7f4f, 0x5a8c55, 0x426f46], brick: 0xc98a7a, brickDark: 0xb27466, coping: 0xc9c5cc,
  picket: 0xefe8d0, villaPicket: 0xe6e0b6, concrete: 0xbdbcc4, white: 0xfaf8ff, blueStripe: 0x2f5fb8,
};

export function mandelWalls(walls) {
  setHouseColours(walls, '2_5', 480, 2400, [{ base: 2989, x: 646.5, z: 2653.1, wall: 0xf4f1ec, reach: 14 }]);
}
// the box sign for Mandel stays off: the name is painted on the wall
export function mandelSignSkip(world) {
  const prev = world.signSkip;
  world.signSkip = (x, z) => Math.hypot(x - SIGN[0], z - SIGN[1]) < 1.5 || (prev ? prev(x, z) : false);
}
// the 30 sign on the right just after the crossing, facing the cars coming along the lap
export function mandelProps() {
  const track = createTrack();
  const i = 1478, [tx, tz] = track.tan[i], hw = track.HW[i];
  const x = track.P[i][0] - tz * (hw + 0.9), z = track.P[i][1] + tx * (hw + 0.9);
  return [[22, x, z, (Math.atan2(-tx, tz) * 180) / Math.PI]];
}

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// the painted name band: KOOGIPOOD  Mandel  KOOGIPOOD, a coffee cup at the right end, a cake at the left
function bandTex() {
  return canvasTex(1024, 112, (c, w, h) => {
    c.fillStyle = '#f2eee8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d9d2ca'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#5b3a31'; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.font = '600 34px Georgia, serif';
    c.fillText('KOOGIPOOD', 250, h / 2 + 8); c.fillText('KOOGIPOOD', 770, h / 2 + 8);
    c.font = 'italic 76px "Brush Script MT", "Segoe Script", cursive';
    c.fillText('Mandel', 512, h / 2 + 2);
    // cup with steam
    c.lineWidth = 5; c.strokeStyle = '#5b3a31';
    c.beginPath(); c.moveTo(925, 52); c.lineTo(931, 86); c.lineTo(967, 86); c.lineTo(973, 52); c.closePath(); c.stroke();
    c.beginPath(); c.arc(978, 64, 9, -1.4, 1.4); c.stroke();
    c.beginPath(); c.moveTo(915, 92); c.lineTo(985, 92); c.stroke();
    for (const x of [940, 958]) { c.beginPath(); c.moveTo(x, 44); c.bezierCurveTo(x - 7, 36, x + 7, 30, x, 20); c.stroke(); }
    // cake slice
    c.beginPath(); c.moveTo(40, 84); c.lineTo(100, 84); c.lineTo(100, 56); c.lineTo(40, 70); c.closePath(); c.stroke();
    c.beginPath(); c.arc(98, 48, 5, 0, 7); c.fill();
  });
}
function stripeTex() {
  return canvasTex(64, 8, (c, w, h) => {
    for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#f4f2f6' : '#6f7fa8'; c.fillRect(k * 8, 0, 8, h); }
  });
}
function chalkTex(lines) {
  return canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = '#2a282e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ece8f0'; c.textAlign = 'center';
    lines.forEach((l, k) => { c.font = `${k ? 18 : 24}px "Segoe Script", cursive`; c.fillText(l, w / 2, 34 + k * 30); });
  });
}

export function createMandel(world, group, { shadows = true } = {}) {
  const track = createTrack();
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const solids = [];
    const extra = [];                                       // textured meshes: [geometry, material]

    // ================= the cafe =================
    const W = wallOf(FRONT.a, FRONT.b, FRONT.top);
    W.y = FRONT.y;
    const along = { at: (s, n) => W.at(s, n) };
    const put = (geo, hex, s, y, n, yaw = W.yaw) => { const [x, z] = W.at(s, n); p.add(geo, hex, x, W.y + y, z, yaw); };
    const ground = (s, n) => { const [x, z] = W.at(s, n); return h(x, z) - W.y; };

    K.face(W, COL.render, -0.6);
    K.slab(W, -0.06, W.len + 0.06, -0.6, 0.42, 0.11, 0.06, COL.plinth);                   // red-brown plinth
    // ground floor: the door on the left, two latticed windows
    K.slab(W, 0.32, 1.18, -0.05, 2.15, 0.11, 0.08, COL.frame);
    K.slab(W, 0.4, 1.1, 0, 2.08, 0.15, 0.06, COL.door);
    K.slab(W, 0.42, 1.08, 1.15, 1.95, 0.19, 0.03, COL.glass);
    K.win(W, 1.42, 2.62, 0.72, 2.28, { bars: 3, rails: 4, frame: COL.lattice, glass: COL.glass, fw: 0.06, off: 0.12 });
    K.slab(W, 1.32, 2.72, 2.28, 2.38, 0.11, 0.08, COL.frame);
    K.win(W, 3.62, 6.02, 0.72, 2.28, { bars: 6, rails: 4, frame: COL.lattice, glass: COL.glass, fw: 0.06, off: 0.12 });
    K.slab(W, 3.52, 6.12, 2.28, 2.38, 0.11, 0.08, COL.frame);
    // upper floor: two white-framed windows
    K.win(W, 0.62, 1.72, 4.1, 5.55, { bars: 1, rails: 1, frame: COL.frame, glass: COL.glass, fw: 0.08 });
    K.win(W, 4.05, 6.05, 4.1, 5.55, { bars: 1, rails: 1, frame: COL.frame, glass: COL.glass, fw: 0.08 });
    for (const [s0, s1] of [[0.52, 1.82], [3.95, 6.15]]) K.slab(W, s0, s1, 4.0, 4.1, 0.11, 0.18, COL.frame);   // sills
    // downpipes at both ends
    for (const s of [-0.12, W.len - 1.0]) {
      put(new THREE.CylinderGeometry(0.055, 0.055, W.top - W.y - 0.1, 8), COL.pipe, s, (W.top - W.y) / 2 - 0.1, 0.22);
      put(BOX(0.14, 0.12, 0.3), COL.pipe, s, W.top - W.y - 0.15, 0.12);
    }
    // wall lamps: white shade on a little arm, lit
    const glow = [];
    for (const s of [1.0, 3.15, 7.35]) {
      put(BOX(0.06, 0.06, 0.28), COL.iron, s, 2.62, 0.25);
      put(new THREE.CylinderGeometry(0.07, 0.11, 0.22, 10), COL.metal, s, 2.52, 0.38, 0);
      const [x, z] = W.at(s, 0.38);
      glow.push(new THREE.SphereGeometry(0.075, 10, 8).translate(x, W.y + 2.42, z));
    }
    // the name band and its little bracket sign (a cup) above the door
    {
      const s0 = 0.05, s1 = 8.65, y0 = 2.72, y1 = 3.55;
      const [x, z] = W.at((s0 + s1) / 2, 0.15);
      const g = new THREE.PlaneGeometry(s1 - s0, y1 - y0).rotateY(Math.atan2(W.nx, W.nz)).translate(x, W.y + (y0 + y1) / 2, z);
      extra.push([g, new THREE.MeshLambertMaterial({ map: bandTex() })]);
    }
    // the two striped awnings: sloped canvas from the wall, a short valance, closed ends
    {
      const geo = { pos: [], uv: [] };
      const v = (s, y, n, u, w) => { const [x, z] = W.at(s, n); geo.pos.push(x, W.y + y, z); geo.uv.push(u, w); };
      const quad = (A, B, C, D) => { for (const q of [A, B, C, A, C, D]) v(...q); };
      for (const [s0, s1] of [[1.22, 2.82], [3.42, 6.22]]) {
        const u = (s1 - s0) / 0.5, yT = 2.62, yF = 2.05, nF = 0.95;
        quad([s0, yT, 0.13, 0, 1], [s1, yT, 0.13, u, 1], [s1, yF, nF, u, 0], [s0, yF, nF, 0, 0]);
        quad([s0, yF, nF, 0, 0], [s1, yF, nF, u, 0], [s1, yF - 0.22, nF + 0.02, u, 0.3], [s0, yF - 0.22, nF + 0.02, 0, 0.3]);
        for (const s of [s0, s1]) { v(s, yT, 0.13, 0, 1); v(s, yF, nF, 0.3, 0); v(s, yF, 0.13, 0, 0); }
        // the iron arms under it
        for (const s of [s0 + 0.05, s1 - 0.05]) put(BOX(0.03, 0.03, 1.0), COL.iron, s, 2.12, 0.55, W.yaw);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(geo.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(geo.uv, 2));
      g.computeVertexNormals();
      extra.push([g, new THREE.MeshLambertMaterial({ map: stripeTex(), side: THREE.DoubleSide })]);
    }
    // flowers: window boxes under both windows, big hanging petunia baskets
    const bloom = (s, y, n, r, k) => {
      put(new THREE.IcosahedronGeometry(r, 1).scale(1.15, 0.8, 0.9), COL.pink[k % 3], s, y, n, k);
      put(new THREE.IcosahedronGeometry(r * 0.55, 1), COL.leaf[k % 3], s + r * 0.4, y - r * 0.4, n + 0.05, k);
    };
    for (const [s0, s1] of [[1.38, 2.66], [3.58, 6.06]]) {
      K.slab(W, s0, s1, 0.48, 0.72, 0.11, 0.32, COL.box);
      for (let s = s0 + 0.2, k = 0; s < s1 - 0.1; s += 0.34, k++) bloom(s, 0.82, 0.3, 0.2, k);
    }
    for (const [s, y, r] of [[0.15, 1.05, 0.42], [1.95, 2.0, 0.3], [4.85, 2.0, 0.32], [6.3, 1.0, 0.3]]) {
      bloom(s, y, 0.45, r, Math.round(s * 7));
      bloom(s - r * 0.6, y - r * 0.5, 0.5, r * 0.7, Math.round(s * 7) + 1);
      bloom(s + r * 0.6, y - r * 0.4, 0.5, r * 0.7, Math.round(s * 7) + 2);
    }
    put(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 12), COL.metal, 0.15, ground(0.15, 0.45) + 0.21, 0.45);      // urn under the left basket
    put(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), COL.metal, 0.15, ground(0.15, 0.45) + 0.65, 0.45);

    // the brick terrace from the wall to the pavement
    K.ribbon(along, -1.2, 9.2, 0.12, 2.75, 'red', true);
    // white metal tables and chairs, a bench under the right window
    const metal = (geo, s, y, n, yaw = W.yaw) => put(geo, COL.metal, s, ground(s, n) + y, n, yaw);
    const table = (s, n) => {
      metal(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18), s, 0.72, n);
      metal(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), s, 0.36, n);
      for (const a of [0, 2.1, 4.2]) { const [x, z] = W.at(s, n); p.add(BOX(0.36, 0.025, 0.03), COL.metal, x + Math.cos(a) * 0.15, W.y + ground(s, n) + 0.02, z + Math.sin(a) * 0.15, a); }
      const [x, z] = W.at(s, n);
      solids.push({ x, z, yaw: 0, hx: 0.38, hz: 0.38 });
    };
    const chair = (s, n, face) => {       // face: angle of the seat's front in the wall frame (0: towards the street)
      const [x, z] = W.at(s, n), yaw = W.yaw + face, y = W.y + ground(s, n);
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      const at = (lx, lz) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz];
      p.add(BOX(0.4, 0.03, 0.4), COL.metal, x, y + 0.46, z, yaw);
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) { const q = at(lx, lz); p.add(BOX(0.025, 0.46, 0.025), COL.metal, q[0], y + 0.23, q[1], yaw); }
      const b = at(0, -0.19);
      p.add(BOX(0.4, 0.42, 0.02), COL.metal, b[0], y + 0.7, b[1], yaw);
      for (const lx of [-0.12, 0, 0.12]) { const q = at(lx, -0.205); p.add(BOX(0.012, 0.36, 0.012), COL.lattice, q[0], y + 0.7, q[1], yaw); }
    };
    table(0.95, 1.35);
    chair(0.35, 1.25, Math.PI / 2); chair(1.55, 1.25, -Math.PI / 2); chair(0.95, 1.95, Math.PI);
    table(2.55, 1.75);
    chair(1.95, 1.8, Math.PI / 2); chair(3.15, 1.8, -Math.PI / 2); chair(2.55, 1.15, 0); chair(2.55, 2.35, Math.PI);
    // the bench: lattice seat and back, scrolled arms
    {
      const s = 4.75, n = 0.55;
      metal(BOX(1.45, 0.04, 0.42), s, 0.44, n);
      metal(BOX(1.45, 0.38, 0.03), s, 0.72, 0.36);
      for (let k = 0; k < 9; k++) metal(BOX(0.015, 0.32, 0.015), 4.1 + k * 0.16, 0.72, 0.38);
      for (const d of [-0.7, 0.7]) { metal(BOX(0.04, 0.44, 0.42), s + d, 0.22, n); metal(new THREE.TorusGeometry(0.1, 0.018, 6, 12, Math.PI), s + d, 0.6, n + 0.1, W.yaw + Math.PI / 2); }
      const [x, z] = W.at(s, n);
      solids.push({ x, z, yaw: Math.atan2(-W.uz, W.ux), hx: 0.75, hz: 0.25 });
    }
    // the pot of blue flowers and the two loop bike racks
    put(new THREE.CylinderGeometry(0.24, 0.2, 0.34, 12), 0x8f7a9a, 5.9, ground(5.9, 1.85) + 0.17, 1.85);
    for (let k = 0; k < 5; k++) put(new THREE.IcosahedronGeometry(0.16, 1), COL.blue[k % 2], 5.9 + (k - 2) * 0.09, ground(5.9, 1.85) + 0.42 + (k % 2) * 0.06, 1.85 + ((k * 7) % 3 - 1) * 0.08, k);
    for (const s of [6.9, 8.05]) {
      put(new THREE.TorusGeometry(0.38, 0.025, 6, 20, Math.PI * 1.55).rotateZ(-Math.PI * 0.27), COL.iron, s, ground(s, 1.45) + 0.36, 1.45, W.yaw + Math.PI / 2);
      const [x, z] = W.at(s, 1.45);
      solids.push({ x, z, yaw: Math.atan2(-W.nz, W.nx), hx: 0.4, hz: 0.06 });
    }
    // the chalk A-board by the hedge on the left
    {
      const s = -1.55, n = 2.1, y = ground(s, n);
      const [x, z] = W.at(s, n);
      for (const d of [-0.16, 0.16]) { const q = W.at(s, n + d); p.add(BOX(0.62, 0.92, 0.03).rotateX(d > 0 ? 0.17 : -0.17), COL.board, q[0], W.y + y + 0.46, q[1], W.yaw); }
      const g = new THREE.PlaneGeometry(0.52, 0.66).rotateX(-0.17).rotateY(Math.atan2(W.nx, W.nz));
      const q = W.at(s, n + 0.19);
      g.translate(q[0], W.y + y + 0.5, q[1]);
      extra.push([g, new THREE.MeshLambertMaterial({ map: chalkTex(['Mandel', 'kohvik', 'koogid', 'salatid']) })]);
      solids.push({ x, z, yaw: 0, hx: 0.3, hz: 0.3 });
    }
    // the hedge to the left of the terrace
    for (let s = -4.6, k = 0; s < -0.7; s += 0.55, k++) K.shrub(...W.at(s, 0.6 + (k % 2) * 0.25), 0.55, COL.hedge[k % 3], 0.9);
    // the side gate: black iron, a board with the day's salads, then the cream picket fence and the ivy
    {
      const s0 = W.len + 0.15, s1 = W.len + 1.3, n = 0.35;
      put(BOX(0.06, 1.55, 0.06), COL.iron, s0, ground(s0, n) + 0.78, n); put(BOX(0.06, 1.55, 0.06), COL.iron, s1, ground(s1, n) + 0.78, n);
      for (const y of [0.12, 0.75, 1.42]) put(BOX(s1 - s0, 0.04, 0.03), COL.iron, (s0 + s1) / 2, ground(s0, n) + y, n);
      for (let s = s0 + 0.1; s < s1; s += 0.11) put(BOX(0.015, 1.3, 0.015), COL.iron, s, ground(s, n) + 0.77, n);
      const g = new THREE.PlaneGeometry(0.42, 0.5).rotateY(Math.atan2(W.nx, W.nz));
      const q = W.at((s0 + s1) / 2, n + 0.03);
      g.translate(q[0], W.y + ground(s0, n) + 1.15, q[1]);
      extra.push([g, new THREE.MeshLambertMaterial({ map: chalkTex(['SALAAD', 'täna', '9.50']) })]);
      const [x, z] = W.at((s0 + s1) / 2, n);
      solids.push({ x, z, yaw: Math.atan2(-W.uz, W.ux), hx: (s1 - s0) / 2, hz: 0.08 });
    }

    // ================= the street before it =================
    const T = (i, lat) => {                                 // track frame at a fractional index; lat > 0 to the right
      const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1];
      const [tx, tz] = track.tan[k];
      return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
    };
    const hwAt = (i) => track.HW[Math.round(i)];
    // a line along the road at `off` metres beyond the kerb (side +1 right, -1 left), points every `step` metres
    const edgeLine = (i0, i1, side, off, step) => {
      const raw = [];
      for (let i = i0; i <= i1 + 1e-6; i += 0.25) raw.push(T(i, side * (hwAt(i) + off)));
      const out = [raw[0]];
      let acc = 0;
      for (let k = 1; k < raw.length; k++) {
        const d = Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]);
        acc += d;
        if (acc >= step) { out.push(raw[k]); acc = 0; }
      }
      return out;
    };
    const free = (x, z, r = 0.5) => world.sdfAt(x, z) > r;
    const seg = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return { l, ux: dx / l, uz: dz / l, yaw: Math.atan2(-dz, dx), mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2 }; };

    // the low brick wall on the right before the crossing, pillars every third panel, a gate near the end
    {
      const pts = edgeLine(1455, 1471.2, 1, 2.35, 2.2);
      pts.forEach((q, k) => {
        if (k < pts.length - 1) {
          const S = seg(q, pts[k + 1]);
          if (!free(S.mx, S.mz)) return;
          const y = h(S.mx, S.mz);
          if (k === pts.length - 3) {             // the gate: dark iron between two pillars
            p.add(BOX(S.l - 0.5, 1.05, 0.05), COL.iron, S.mx, y + 0.6, S.mz, S.yaw);
            for (let d = -S.l / 2 + 0.4; d < S.l / 2 - 0.3; d += 0.13) p.add(BOX(0.02, 1.25, 0.02), COL.iron, S.mx + S.ux * d, y + 0.72, S.mz + S.uz * d, S.yaw);
          } else {
            p.add(BOX(S.l + 0.02, 0.95, 0.36), COL.brick, S.mx, y + 0.47, S.mz, S.yaw);
            p.add(BOX(S.l + 0.02, 0.08, 0.36), COL.brickDark, S.mx, y + 0.12, S.mz, S.yaw);
            p.add(BOX(S.l + 0.04, 0.07, 0.46), COL.coping, S.mx, y + 0.98, S.mz, S.yaw);
          }
          solids.push({ x: S.mx, z: S.mz, yaw: S.yaw, hx: S.l / 2, hz: 0.25 });
        }
        if (k % 3 === 0 || k >= pts.length - 3) {
          if (!free(q[0], q[1])) return;
          const y = h(q[0], q[1]), yaw = k < pts.length - 1 ? seg(q, pts[k + 1]).yaw : seg(pts[k - 1], q).yaw;
          p.add(BOX(0.55, 1.5, 0.55), COL.brick, q[0], y + 0.75, q[1], yaw);
          p.add(new THREE.ConeGeometry(0.46, 0.22, 4).rotateY(Math.PI / 4), COL.coping, q[0], y + 1.61, q[1], yaw);
        }
      });
    }
    // picket fences on concrete posts: slats every 15 cm, two rails
    const picket = (pts, colour, height = 1.1) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const S = seg(pts[k], pts[k + 1]);
        if (!free(S.mx, S.mz, 0.4)) continue;
        const ya = h(pts[k][0], pts[k][1]);
        p.add(BOX(0.2, height + 0.25, 0.2), COL.concrete, pts[k][0], ya + (height + 0.25) / 2, pts[k][1], S.yaw);
        p.add(BOX(0.24, 0.06, 0.24), COL.concrete, pts[k][0], ya + height + 0.28, pts[k][1], S.yaw);
        for (const y of [0.28, height - 0.2]) p.add(BOX(S.l, 0.07, 0.03), colour, S.mx - S.uz * 0.05, h(S.mx, S.mz) + y, S.mz + S.ux * 0.05, S.yaw);
        for (let d = 0.16; d < S.l - 0.08; d += 0.15) {
          const x = pts[k][0] + S.ux * d, z = pts[k][1] + S.uz * d;
          p.add(BOX(0.075, height - 0.1, 0.022), colour, x - S.uz * 0.075, h(x, z) + 0.08 + (height - 0.1) / 2, z + S.ux * 0.075, S.yaw);
        }
        solids.push({ x: S.mx, z: S.mz, yaw: S.yaw, hx: S.l / 2, hz: 0.12 });
      }
      const q = pts[pts.length - 1];
      if (free(q[0], q[1], 0.4)) p.add(BOX(0.2, height + 0.25, 0.2), COL.concrete, q[0], h(q[0], q[1]) + (height + 0.25) / 2, q[1], 0);
    };
    picket(edgeLine(1452, 1471, -1, 4.2, 2.4), COL.picket);                   // left, behind the grass, before the crossing
    picket(edgeLine(1477.5, 1488.5, 1, 2.3, 2.4), COL.villaPicket, 1.15);     // the villa garden, right, after it
    // the cafe's own cream fence beyond the gate
    {
      const pts = [];
      for (let s = W.len + 1.45; s <= W.len + 9.5; s += 2.0) pts.push(W.at(s, 0.35));
      picket(pts, COL.picket, 1.2);
      for (let k = 0; k < pts.length - 1; k += 1) K.shrub(...W.at(W.len + 2.2 + k * 2, -0.25), 0.7, COL.hedge[k % 3], 1.1);
    }

    // the raised crossing: checkered ramp markings either side of the zebra, the blue and white posts
    {
      const i = ZEBRA.i, [tx, tz] = track.tan[i], rx = -tz, rz = tx;
      const c = track.P[i], dc = (ZEBRA.c[0] - c[0]) * tx + (ZEBRA.c[1] - c[1]) * tz;
      const o = [c[0] + tx * dc, c[1] + tz * dc];
      const hw = track.HW[i], sq = 0.5, shapes = [];
      const square = (d, l) => {
        const pt = (a, b) => [o[0] + tx * a + rx * b, o[1] + tz * a + rz * b];
        shapes.push([[pt(d, l), pt(d + sq, l), pt(d + sq, l + sq), pt(d, l + sq)]]);
      };
      const rows = [-6.2, -5.7, -2.75, 2.25, 5.2, 5.7];
      rows.forEach((d, r) => { for (let l = -hw + 0.15, k = 0; l < hw - 0.3; l += sq, k++) if ((k + r) % 2 === 0) square(d, l); });
      const g = drapeGeometry(world, shapes, 0.07, 1, 1.5);
      if (g) extra.push([g, new THREE.MeshLambertMaterial({ color: COL.white, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide })]);
      for (const side of [-1, 1]) {
        const q = [o[0] - tx * 3.4 + rx * side * (hw + 0.35), o[1] - tz * 3.4 + rz * side * (hw + 0.35)], y = h(q[0], q[1]);
        for (let k = 0; k < 7; k++) p.add(BOX(0.13, 0.13, 0.13), k % 2 ? COL.white : COL.blueStripe, q[0], y + 0.07 + k * 0.13, q[1], 0.3);
        p.add(BOX(0.15, 0.04, 0.15), COL.iron, q[0], y + 0.93, q[1], 0.3);
        solids.push({ x: q[0], z: q[1], yaw: 0, hx: 0.08, hz: 0.08 });
      }
    }
    // bike symbols on the left of the lane (white lines, 9 cm)
    {
      const shapes = [];
      const lineOf = (pts, w) => {
        for (let k = 0; k < pts.length - 1; k++) {
          const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = Math.hypot(bx - ax, bz - az);
          if (l < 1e-3) continue;
          const nx = (-(bz - az) / l) * w / 2, nz = ((bx - ax) / l) * w / 2;
          shapes.push([[[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]]]);
        }
      };
      for (const i of [1462, 1482]) {
        const [tx, tz] = track.tan[i], rx = -tz, rz = tx, c = T(i, -(hwAt(i) - 0.95));
        // picture x along the road, picture y towards the left kerb
        const pt = (u, v) => [c[0] + tx * u * 1.3 - rx * v * 1.3, c[1] + tz * u * 1.3 - rz * v * 1.3];
        const wheel = (cu) => { const q = []; for (let k = 0; k <= 14; k++) q.push(pt(cu + Math.cos(k / 14 * 6.283) * 0.3, Math.sin(k / 14 * 6.283) * 0.3)); return q; };
        lineOf(wheel(-0.5), 0.08); lineOf(wheel(0.5), 0.08);
        lineOf([pt(-0.5, 0), pt(-0.1, 0.42), pt(0.38, 0.42), pt(0.5, 0)], 0.08);
        lineOf([pt(-0.5, 0), pt(0, 0), pt(0.38, 0.42)], 0.08);
        lineOf([pt(0, 0), pt(-0.16, 0.55)], 0.08); lineOf([pt(-0.27, 0.56), pt(-0.04, 0.56)], 0.08);
        lineOf([pt(0.38, 0.42), pt(0.33, 0.62), pt(0.46, 0.64)], 0.08);
      }
      const g = drapeGeometry(world, shapes, 0.07, 1, 1.5);
      if (g) extra.push([g, new THREE.MeshLambertMaterial({ color: COL.white, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide })]);
    }

    K.finish();
    for (const [g, m] of extra) { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = shadows && !m.polygonOffset; group.add(mesh); }
    if (glow.length) {
      const g = glow.length > 1 ? mergeAll(glow) : glow[0];
      group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe6b0 })));
    }
    world.addSolids(solids);
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - CENTRE[0], z - CENTRE[1]) > 600) return;
      if ([[650, 2655], [690, 2620], [720, 2590], [740, 2565]].every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}

function mergeAll(list) {
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
