// Real things around the spawn and the start/finish, measured from the Land Board's oblique aerial
// photos (kaldaerofotod, 2024) and orthophoto: the row of white kiosks on Küüni, the café terrace at the start line and
// the Barclay park playground. Modelled geometry only (no photos are pasted). Kiosks are solid.
import * as THREE from 'three';

// Kaubamaja footprint corners from the LOD2 building model (game x, z), and its roof height (world y)
const KM = { N: [1735.2, 3015.6], S: [1713.8, 3144.9], W: [1659.6, 3088.7] };      // Kaubamaja itself: src/world/kaubamaja.js
const KIOSKS = { a: [1652, 3113], b: [1696, 3159], n: 10 };
// parked cars: kerb rows a -> b with the number of bays (some left empty). The cars themselves are
// real models that can be shoved: src/world/parked.js
// (perp: nose-in bays across the row instead of cars nose to tail; head: the heading [x, z] of cars in angled bays)
export const PARKING = [
  // Kaubamaja's car park (keskustee.js draws the bays): the row by the columns, noses in, and the one along the trees
  { a: [1662.4, 3076.6], b: [1716.36, 3024.43], n: 25, head: [0.961, 0.276], seed: 1 },
  { a: [1650.94, 3064.73], b: [1711.38, 3006.3], n: 28, head: [-0.961, -0.276], seed: 41 },
  { a: [1554, 3087], b: [1579, 3120], n: 6, seed: 2 },      // the cross street north of the spawn
  // the car park by the river across from Kaubamaja, around the pavilion
  { a: [1731, 2951], b: [1779, 2943], n: 18, perp: true, seed: 3 },
  { a: [1737, 2961], b: [1778, 2953], n: 15, perp: true, seed: 4 },
  { a: [1744, 2970], b: [1777, 2961], n: 12, perp: true, seed: 5 },
  { a: [1812, 2976], b: [1825, 2994], n: 7, perp: true, seed: 6 },
  { a: [1821, 2962], b: [1839, 2978], n: 8, perp: true, seed: 7 },
  { a: [1801, 3026], b: [1839, 2993], n: 18, perp: true, seed: 8 },
  // Vallikraavi (vallistreet.js): along the kerb under the tower house, the car park under the hill (the
  // asphalt bays after it stay empty as run-off room). The bays on the park side stay empty, they are on the racing line (Martin, 18 Nov):
  // those cars stand along the left of Ülikooli past Vabank instead
  { a: [1463.8, 3018.3], b: [1440.1, 2976.6], n: 8, seed: 31 },
  { a: [1505.7, 3009.1], b: [1492.1, 3021.6], n: 3, seed: 32 },
  // (drop: bays whose car is taken away afterwards, so the cars of every other row keep their model and paint;
  // the BMW estate by the bins stood next to the racing line, Martin 22 Nov)
  { a: [1426, 3102], b: [1440, 3102], n: 5, perp: true, seed: 33, drop: [0] },
];
const TERRACE = [1586, 3046];       // café terrace by the start line (moved to the kerb at run time)
const PLAY = [[1602, 3019, 5.2], [1616, 3031, 4.2]];      // playground rubber discs: x, z, radius

export const CAR_COLOURS = [0xb9bcc2, 0x8d9197, 0x3b3e44, 0x18191c, 0xe9e9e6, 0x23344f, 0x7b1d22, 0x4d5a6b, 0xc8c3b6, 0x2c4a3a];

export function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// collects coloured parts and merges them into one mesh
// (the corners are written straight into plain number lists: one geometry object per part, turned, moved and
// merged afterwards, was most of the time some places took to build: Delta's 2 000 boxes took 0.15 s)
const HEX = new Map();
function rgbOf(hex) {
  if (typeof hex !== 'number' && typeof hex !== 'string') return new THREE.Color(hex);
  let c = HEX.get(hex);
  if (!c) { c = new THREE.Color(hex); if (HEX.size < 4096) HEX.set(hex, c); }
  return c;
}
let UNIT = null;                         // a 1 m cube as 36 corners: [positions, normals]
function unit() {
  if (!UNIT) { const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); UNIT = [g.attributes.position.array, g.attributes.normal.array]; }
  return UNIT;
}
const fr = Math.fround;
export class Parts {
  constructor() { this.P = new Float32Array(0); this.N = this.C = this.P; this.count = 0; }
  // n corners from `pos`/`nor` (through `idx` if given), sized by sx, sy, sz, turned by yaw and moved to x, y, z
  put(pos, nor, idx, n, sx, sy, sz, hex, x, y, z, yaw) {
    const at = this.count * 3, need = at + n * 3;
    if (need > this.P.length) {
      const cap = Math.max(need, this.P.length * 2, 3072);
      for (const k of ['P', 'N', 'C']) { const a = new Float32Array(cap); a.set(this[k].subarray(0, at)); this[k] = a; }
    }
    const P = this.P, N = this.N, C = this.C;
    const c = Math.cos(yaw), s = Math.sin(yaw), col = rgbOf(hex), plain = !yaw, cr = col.r, cg = col.g, cb = col.b;
    for (let i = 0, o = at; i < n; i++, o += 3) {
      const k = (idx ? idx[i] : i) * 3;
      const px = fr(pos[k] * sx), pz = fr(pos[k + 2] * sz);
      // (rounded as three.js would between turning and moving, so that nothing shifts by a hair)
      if (plain) { P[o] = px + x; P[o + 2] = pz + z; } else { P[o] = fr(c * px + s * pz) + x; P[o + 2] = fr(c * pz - s * px) + z; }
      P[o + 1] = fr(pos[k + 1] * sy) + y;
      if (nor) {
        const nx = nor[k], nz = nor[k + 2];
        if (plain) { N[o] = nx; N[o + 2] = nz; } else { N[o] = c * nx + s * nz; N[o + 2] = c * nz - s * nx; }
        N[o + 1] = nor[k + 1];
      } else N[o] = N[o + 1] = N[o + 2] = 0;
      C[o] = cr; C[o + 1] = cg; C[o + 2] = cb;
    }
    this.count += n;
  }
  add(geo, hex, x, y, z, yaw = 0) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
    const ok = (a) => a.isBufferAttribute && !a.isInterleavedBufferAttribute && a.itemSize === 3 && a.array instanceof Float32Array;
    if (ok(pos) && (!nor || ok(nor))) { this.put(pos.array, nor ? nor.array : null, idx ? idx.array : null, idx ? idx.count : pos.count, 1, 1, 1, hex, x, y, z, yaw); return; }
    const g = idx ? geo.toNonIndexed() : geo.clone();          // anything unusual: the long way round
    g.rotateY(yaw).translate(x, y, z);
    this.put(g.attributes.position.array, g.attributes.normal ? g.attributes.normal.array : null, null, g.attributes.position.count, 1, 1, 1, hex, 0, 0, 0, 0);
    g.dispose();
  }
  // a box of w x h x d: the same as add(BOX(w, h, d), ...) without the geometry in between
  box(w, h, d, hex, x, y, z, yaw = 0) { const u = unit(); this.put(u[0], u[1], null, 36, w, h, d, hex, x, y, z, yaw); }
  mesh(mat) {
    if (!this.count) return null;
    const n = this.count * 3, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.slice(0, n), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.slice(0, n), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.slice(0, n), 3));
    this.P = this.N = this.C = new Float32Array(0); this.count = 0;
    return new THREE.Mesh(g, mat);
  }
}

export const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// a generic hatchback / saloon, local +x along the car
export function addCar(p, x, y, z, yaw, colour, r) {
  const L = 4.2 + r() * 0.6, W = 1.78, wagon = r() < 0.35;
  p.box(L, 0.62, W, colour, x, y + 0.58, z, yaw);                                   // body
  const cl = wagon ? L * 0.62 : L * 0.5, cx = wagon ? -L * 0.08 : -L * 0.04;
  const ox = Math.cos(yaw), oz = -Math.sin(yaw);
  p.box(cl, 0.55, W - 0.16, 0x1b1f27, x + ox * cx, y + 1.16, z + oz * cx, yaw);      // glass house
  p.box(cl - 0.3, 0.06, W - 0.2, colour, x + ox * cx, y + 1.46, z + oz * cx, yaw);   // roof
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10).rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * (L / 2 - 0.75), lz = sz * (W / 2 - 0.08);
    p.add(wheel, 0x111113, x + ox * lx + Math.sin(yaw) * lz, y + 0.33, z + oz * lx + Math.cos(yaw) * lz, yaw);
  }
  for (const sz of [-1, 1]) {                                                             // tail lights
    const lx = -L / 2 - 0.01, lz = sz * (W / 2 - 0.22);
    p.box(0.04, 0.12, 0.32, 0x8a1018, x + ox * lx + Math.sin(yaw) * lz, y + 0.75, z + oz * lx + Math.cos(yaw) * lz, yaw);
  }
}

export function createLandmarks(world, track) {
  const group = new THREE.Group();
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  let built = false;

  function onTrack(x, z, margin) {
    const n = track.nearest(x, z, -1);
    return n.d < (track.HW[n.i] ?? 6) + margin;
  }

  function build() {
    built = true;
    const p = new Parts(), solids = [];
    const g = (x, z) => world.heightAt(x, z);

    // ---- white kiosks on Küüni: a row of booths with pointed roofs, serving windows towards Kaubamaja
    {
      const { a, b, n } = KIOSKS;
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const fx = uz, fz = -ux;                     // front: towards Kaubamaja
      const yaw = Math.atan2(-uz, ux);
      const roof = new THREE.ConeGeometry(1.95, 1.5, 4, 1).rotateY(Math.PI / 4);
      const r = rnd(7);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), x = a[0] + dx * t, z = a[1] + dz * t, y = g(x, z);
        p.box(2.5, 2.5, 2.3, 0xf1efe9, x, y + 1.25, z, yaw);
        p.add(roof, 0xfbfaf8, x, y + 2.5 + 0.75, z, yaw);
        p.box(1.7, 0.95, 0.06, 0x262a33, x + fx * 1.17, y + 1.45, z + fz * 1.17, yaw);   // window
        p.box(1.9, 0.08, 0.45, 0xd8d4cc, x + fx * 1.3, y + 0.95, z + fz * 1.3, yaw);    // counter
        if (r() < 0.6) p.box(2.2, 0.3, 0.05, [0xc8323c, 0x2f6f8f, 0x3c8a4f, 0xd8a12c][Math.floor(r() * 4)], x + fx * 1.18, y + 2.25, z + fz * 1.18, yaw);   // name board
        solids.push({ x, z, yaw, hx: 1.3, hz: 1.2 });
      }
    }

    // ---- café terrace beside the start line: parasols, tables and a low fence, on the building side
    {
      const n = track.nearest(TERRACE[0], TERRACE[1], -1), [tx, tz] = track.tan[n.i], P = track.P[n.i];
      const lx = tz, lz = -tx;                                     // left of the direction of travel
      // it stands against the building on the left: find the wall, then step back out of it
      let wall = 4;
      while (wall < 22 && world.sdfAt(P[0] + lx * wall, P[1] + lz * wall) > 0.4) wall += 0.5;
      const cx = P[0] + lx * (wall - 2.2), cz = P[1] + lz * (wall - 2.2);
      const yaw = Math.atan2(-tz, tx);
      const r = rnd(11);
      for (let i = -2; i <= 2; i++) {
        const x = cx + tx * i * 3.2, z = cz + tz * i * 3.2, y = g(x, z);
        p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), 0x777777, x, y + 1.2, z);
        p.add(new THREE.ConeGeometry(1.5, 0.55, 8), i % 2 ? 0xf3d24a : 0xf6f1e4, x, y + 2.55, z);
        p.add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10), 0x2b2b2e, x, y + 0.74, z);
        p.add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), 0x2b2b2e, x, y + 0.37, z);
        for (let c = 0; c < 4; c++) {
          const a = c * Math.PI / 2 + r() * 0.4, chx = x + Math.cos(a) * 0.75, chz = z + Math.sin(a) * 0.75;
          p.box(0.42, 0.45, 0.42, 0x5a3a26, chx, y + 0.22, chz, a);
          p.box(0.42, 0.45, 0.05, 0x5a3a26, chx + Math.cos(a) * 0.2, y + 0.65, chz + Math.sin(a) * 0.2, a + Math.PI / 2);
        }
      }
      // fence on the street side of the terrace
      const fx = cx - lx * 1.7, fz = cz - lz * 1.7;
      p.box(16.5, 0.9, 0.08, 0x3d2f2a, fx, g(fx, fz) + 0.45, fz, yaw);
    }

    // ---- playground in Barclay park: green rubber discs, a climbing frame with a slide, swings
    for (const [x, z, rad] of PLAY) {
      const y = g(x, z);
      p.add(new THREE.CylinderGeometry(rad, rad, 0.12, 28), 0x3c9a5a, x, y + 0.06, z);
    }
    {
      const [x, z] = PLAY[0], y = g(x, z);
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.box(0.12, 2.6, 0.12, 0xd9c08a, x + ox, y + 1.3, z + oz);
      p.box(2.2, 0.12, 2.2, 0xc8402f, x, y + 1.3, z);
      p.add(new THREE.ConeGeometry(1.6, 1.0, 4).rotateY(Math.PI / 4), 0x2d6fb5, x, y + 3.1, z);
      const slide = BOX(0.7, 0.06, 3.2);
      slide.rotateX(0.42);
      p.add(slide, 0xf0c22c, x, y + 0.65, z + 2.55);
      const [sx, sz] = PLAY[1], sy = g(sx, sz);
      for (const s of [-1, 1]) {
        p.box(0.1, 2.5, 0.1, 0x4a4f58, sx + s * 1.6, sy + 1.25, sz - 0.6);
        p.box(0.1, 2.5, 0.1, 0x4a4f58, sx + s * 1.6, sy + 1.25, sz + 0.6);
      }
      p.box(3.4, 0.1, 0.1, 0x4a4f58, sx, sy + 2.5, sz);
      for (const s of [-0.7, 0.7]) p.box(0.5, 0.06, 0.25, 0xd6352f, sx + s, sy + 0.5, sz);
    }

    const m = p.mesh(solidMat);
    if (m) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
    world.addSolids(solids);
  }

  return {
    group,
    update(x, z) {
      if (built) return;
      const [kx, kz] = KM.W;
      if (Math.hypot(kx - x, kz - z) < 900 && world.ready(KM.N[0], KM.N[1]) && world.ready(KM.S[0], KM.S[1])
        && world.ready(TERRACE[0], TERRACE[1]) && world.ready(...PARKING.find((r) => r.seed === 2).a)) build();
    },
  };
}
