// Bus shelters at every bus stop of the map (Martin, 20 Nov: "add the bus waiting pavilions to all the bus
// stops where the buses stand, detail the bus stops a bit more"). The stops are OpenStreetMap's bus stop
// platforms, moved by tools/bake/busstops.py onto the pavement of the road the buses use, with room
// for the shelter (src/world/busstops.json). Each stop gets:
//  - a glass shelter: posts, roof with a fascia, bench, glass back and end, a lit advert panel at the end
//    the buses come from (the TOREPOOD poster on both faces, Martin 22 Nov, src/world/adverts.js) and a
//    timetable inside; clicking or tapping the poster opens the shop;
//  - the bus stop sign at the kerb and a bin beside the shelter (props, so they snap off when hit);
//  - the yellow zigzag along the kerb where the bus pulls in.
// All shelters of a piece of the map are merged into a few meshes. When the car comes within reach of one
// it is swapped for its own copy that can be smashed like the hand-built ones (src/world/shelter.js),
// with the stop's name on the fascia; undamaged copies go back into the merged mesh when the car is gone.
import * as THREE from 'three';
import DATA from './busstops.json';
import { breakableShelter, shelterSolids } from './shelter.js';
import { adAtlas, adCell, TIMETABLE, POSTER, POSTER_URL, extraPosters } from './adverts.js';

const D = 1.55, H = 2.45;               // depth and height of a shelter
const BUS_SIGN = 30, BIN = 4, ZEBRA = 7;
const NEAR = 38, FAR = 90;              // m: a shelter becomes breakable within NEAR, goes back beyond FAR
const ZIG = { back: 6, ahead: 8, step: 1.45, in: 0.28, out: 1.2, w: 0.13 };   // the zigzag in the road
// frame colours: Tartu's anthracite shelters, a few green ones, a few silver
const STYLES = [
  { frame: 0x2d3038, roof: 0x3b3f48, bench: 0x8a6a48, board: 0x1f55b5 },
  { frame: 0x2d3038, roof: 0x3b3f48, bench: 0x8a6a48, board: 0x1f55b5 },
  { frame: 0x2f5a4c, roof: 0x3c6a5a, bench: 0x9a7a52, board: 0x2f5a4c },
  { frame: 0x9aa0a8, roof: 0x7f858c, bench: 0x6c6f76, board: 0x1f55b5 },
];

export const STOPS = DATA.stops.map(([x, z, yaw, L, gap, side, hw, name, sign, bin], i) => {
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  const h = ((i * 2654435761) >>> 0) / 4294967296;
  return {
    i, x, z, yaw, L, gap, hw, name: DATA.names[name] || '', sign, bin, ux, uz, nx, nz,
    style: STYLES[Math.floor(h * STYLES.length)], ads: [POSTER, POSTER],
    // local (along the road the way the buses go, away from the road) to world
    W: (s, n) => [x + ux * s + nx * n, z + uz * s + nz * n],
    box: { x, z, yaw, hx: L / 2 + 0.1, hz: D / 2 + 0.1 },
  };
});

// the stop whose footprint (plus pad) holds the point, if any
const CELL = 64;
const grid = new Map();
for (const st of STOPS) {
  const k = Math.floor(st.x / CELL) * 100003 + Math.floor(st.z / CELL);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const kk = k + dx * 100003 + dz;
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(st);
  }
}
function stopAt(x, z, pad) {
  for (const st of grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) || []) {
    const dx = x - st.x, dz = z - st.z;
    const s = dx * st.ux + dz * st.uz, n = dx * st.nx + dz * st.nz;
    if (Math.abs(s) < st.L / 2 + pad && Math.abs(n) < D / 2 + pad) return st;
  }
  return null;
}

// the sign at the kerb before the shelter (facing the buses that come) and a bin by its far end
export function busStopProps() {
  const out = [];
  for (const st of STOPS) {
    // (the bake found a free spot for each, off roads and paths: tools/bake/busstops.py)
    if (st.sign) {
      const [sx, sz] = st.W(st.sign[0], st.sign[1]);
      out.push([BUS_SIGN, Math.round(sx * 100) / 100, Math.round(sz * 100) / 100, (Math.atan2(-st.ux, st.uz) * 180) / Math.PI]);
    }
    if (st.bin) {
      const [bx, bz] = st.W(st.L / 2 + 0.55, D / 2 - 0.35);
      out.push([BIN, Math.round(bx * 100) / 100, Math.round(bz * 100) / 100, 0]);
    }
  }
  return out;
}

// the surveyed street furniture standing where a shelter now is makes way (props clear hook)
export function busStopClear(d) {
  const out = new Set();
  for (const [key, a] of Object.entries(d.sectors)) {
    for (let k = 0; k < a.length; k += d.stride) {
      if (a[k] === ZEBRA) continue;
      if (stopAt(a[k + 1], a[k + 2], 0.45)) out.add(`${key}:${k / d.stride}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- geometry, built once per look and length
function part(list, w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute('uv');
  g.translate(x, y, z);
  const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  list.push(g);
}
function merge(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(list[0].attributes)) {
    const size = list[0].attributes[name].itemSize, arr = new Float32Array(n * size);
    let o = 0;
    for (const g of list) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of list) g.dispose();
  return out;
}
// a quad (two triangles) at local x..., facing along normal (nx, nz), with texture cell uv
function quad(pos, nor, uv, cx, cy, cz, w, h, nx, nz, cell) {
  const tx = nz, tz = -nx;                          // right, as seen from the front
  const [u0, v0, u1, v1] = cell;
  const P = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, -1, u0, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
  for (const [a, b, u, v] of P) {
    pos.push(cx + tx * a * w / 2, cy + b * h / 2, cz + tz * a * w / 2);
    nor.push(nx, 0, nz);
    uv.push(u, v);
  }
}

const frames = new Map(), slabs = new Map();
function frameGeo(style, L) {
  const key = `${STYLES.indexOf(style)}:${L}`;
  if (frames.has(key)) return frames.get(key);
  const p = [];
  for (const s of [-L / 2, -L / 6, L / 6, L / 2]) {
    part(p, 0.07, H, 0.07, s, H / 2, D / 2, style.frame);                                   // back posts
    if (Math.abs(s) > L / 3) part(p, 0.07, H, 0.07, s, H / 2, -D / 2, style.frame);         // front posts at the ends
  }
  part(p, L + 0.35, 0.1, D + 0.35, 0, H + 0.05, 0, style.roof);                              // roof
  part(p, L + 0.35, 0.2, 0.06, 0, H - 0.04, -D / 2 - 0.17, style.board);                     // fascia, where the name goes
  part(p, L + 0.35, 0.05, 0.05, 0, H - 0.17, D / 2 + 0.15, style.frame);                     // roof edge at the back
  part(p, L, 0.06, 0.06, 0, 0.12, D / 2, style.frame);                                       // bottom rail
  part(p, L, 0.05, 0.05, 0, H - 0.08, D / 2, style.frame);                                   // top rail
  part(p, 0.05, 0.05, D, L / 2, H - 0.08, 0, style.frame);
  // the advert box at the end the buses come from, and the timetable's frame inside the far end
  part(p, 0.16, H - 0.25, D * 0.92, -L / 2, (H - 0.25) / 2 + 0.1, 0, style.frame);
  part(p, 0.5, 0.68, 0.03, L / 2 - 0.55, 1.45, D / 2 - 0.035, 0xd8dce2);
  const g = merge(p);
  frames.set(key, g);
  return g;
}
// the bench along the back, on two legs (its own piece: it flies off when a car crashes through)
const benches = new Map();
function benchGeo(style, L) {
  const key = `${STYLES.indexOf(style)}:${L}`;
  if (benches.has(key)) return benches.get(key);
  const p = [];
  part(p, L * 0.55, 0.05, 0.38, L * 0.08, 0.46, D / 2 - 0.3, style.bench);
  part(p, L * 0.55, 0.3, 0.04, L * 0.08, 0.7, D / 2 - 0.1, style.bench);
  for (const s of [-L * 0.17, L * 0.33]) part(p, 0.05, 0.46, 0.34, s, 0.23, D / 2 - 0.3, style.frame);
  const g = merge(p);
  benches.set(key, g);
  return g;
}
function slabGeo(L) {
  if (slabs.has(L)) return slabs.get(L);
  const p = [];
  part(p, L + 0.5, 0.6, D + 0.4, 0, -0.28, 0, 0xa7a2a8);           // paving under it, deep enough for a slope
  const g = merge(p);
  slabs.set(L, g);
  return g;
}
// the two adverts (one on each face of the end box) and the timetable
function adGeo(st) {
  const pos = [], nor = [], uv = [], L = st.L;
  quad(pos, nor, uv, -L / 2 - 0.085, 1.2, 0, D * 0.8, 1.75, -1, 0, adCell(st.ads[0]));         // outside, to the buses that come
  quad(pos, nor, uv, -L / 2 + 0.085, 1.2, 0, D * 0.8, 1.75, 1, 0, adCell(st.ads[1]));          // inside
  quad(pos, nor, uv, L / 2 - 0.55, 1.45, D / 2 - 0.055, 0.44, 0.62, 0, -1, adCell(TIMETABLE));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
// the panes: [s0, n0, s1, n1, y0, y1] in the shelter's own axes
function panes(L) {
  return [
    [-L / 2, D / 2, L / 2, D / 2, 0.15, H - 0.1],                       // back
    [L / 2, -D / 2, L / 2, D / 2, 0.15, H - 0.1],                       // far end
    [-L / 2 - 0.11, -D * 0.43, -L / 2 - 0.11, D * 0.43, 0.28, 2.12],    // over the adverts
    [-L / 2 + 0.11, -D * 0.43, -L / 2 + 0.11, D * 0.43, 0.28, 2.12],
  ];
}

// the stop's name on the fascia, painted when the car comes near
function nameMesh(st, y) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 40;
  const g = cv.getContext('2d');
  g.fillStyle = `#${new THREE.Color(st.style.board).getHexString()}`; g.fillRect(0, 0, 512, 40);
  g.fillStyle = '#fff'; g.font = 'bold 28px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const s = st.name.toUpperCase(), m = g.measureText(s).width;
  if (m > 490) { g.translate(256, 0); g.scale(490 / m, 1); g.translate(-256, 0); }
  g.fillText(s, 256, 21);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = Math.min(st.L - 0.2, 3.2);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 40 / 512 * 1.1), new THREE.MeshBasicMaterial({ map: tex }));
  const [px, pz] = st.W(0, -D / 2 - 0.205);
  mesh.position.set(px, y + H - 0.04, pz);
  mesh.rotation.y = st.yaw + Math.PI;
  return mesh;
}

// ---------------------------------------------------------------- per piece of the map
class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  // geometry g (local), placed at (x, y, z) turned by yaw; returns the vertex range it took
  add(g, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), start = this.pos.length / 3;
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color?.array, U = g.attributes.uv?.array;
    for (let k = 0; k < P.length; k += 3) {
      // three.js rotation about y: x' = x cos + z sin, z' = -x sin + z cos
      this.pos.push(x + P[k] * c + P[k + 2] * s, y + P[k + 1], z - P[k] * s + P[k + 2] * c);
      this.nor.push(N[k] * c + N[k + 2] * s, N[k + 1], -N[k] * s + N[k + 2] * c);
      if (C) this.col.push(C[k], C[k + 1], C[k + 2]);
    }
    if (U) for (let k = 0; k < U.length; k++) this.uv.push(U[k]);
    return [start, this.pos.length / 3];
  }
  mesh(mat) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    return m;
  }
}

function inside(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

export function createBusStops(scene, world, opts = {}) {
  const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
  const bySector = new Map();
  for (const st of STOPS) {
    const k = `${Math.floor((st.x - G0) / S)}_${Math.floor((st.z - G0) / S)}`;
    if (!bySector.has(k)) bySector.set(k, []);
    bySector.get(k).push(st);
  }
  // solid for the cars, and no map tree growing through a shelter
  world.addSolids(STOPS.flatMap((st) => shelterSolids(st.box)));
  world.addClearing({ test: (x, z) => !!stopAt(x, z, 0.7) });

  const frameMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const adMat = new THREE.MeshBasicMaterial({ map: adAtlas() });
  const paintMat = new THREE.MeshLambertMaterial({ color: 0xf2c21b, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // hand-made places paint their own road: no zigzag there
  const hand = (world.vectors.overPaint || []).map((a) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of a.outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { a, x0, z0, x1, z1 };
  });
  const handPaint = (x, z) => hand.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1 && inside(h.a.outer, x, z)) || !!world.vectors.markSkip?.(x, z);

  const live = new Map();             // sector key -> { stops, meshes, base, group }
  const active = new Set();

  function build(s) {
    const key = `${s.sx}_${s.sz}`, list = bySector.get(key);
    if (!list) return;
    const slab = new Batch(), frame = new Batch(), glass = new Batch(), ads = new Batch(), paint = new Batch();
    for (const st of list) {
      // standing on the highest ground under it (the slab reaches down to the rest)
      let y = -Infinity;
      for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) y = Math.max(y, world.heightAt(...st.W(a * st.L / 2, b * D / 2)));
      st.y = y + 0.02;
      slab.add(slabGeo(st.L), st.x, st.y, st.z, st.yaw);
      const f0 = frame.add(frameGeo(st.style, st.L), st.x, st.y, st.z, st.yaw)[0];
      st.r = { frame: [f0, frame.add(benchGeo(st.style, st.L), st.x, st.y, st.z, st.yaw)[1]], ads: null, glass: null };
      const ag = adGeo(st);
      st.r.ads = ads.add(ag, st.x, st.y, st.z, st.yaw);
      ag.dispose();
      const g0 = glass.pos.length / 3;
      for (const [s0, n0, s1, n1, y0, y1] of panes(st.L)) {
        const [ax, az] = st.W(s0, n0), [bx, bz] = st.W(s1, n1);
        for (const [px, py, pz] of [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y0, az], [bx, y1, bz], [ax, y1, az]]) { glass.pos.push(px, st.y + py, pz); glass.nor.push(st.nx, 0, st.nz); }
      }
      st.r.glass = [g0, glass.pos.length / 3];
      // the yellow zigzag in the road along the kerb, on streets wide enough for it
      if (st.hw >= 2.8) {
        const kerb = -(D / 2 + st.gap);
        const pts = [];
        const n = Math.round((st.L + ZIG.back + ZIG.ahead) / ZIG.step);
        for (let k = 0; k <= n; k++) {
          const sAlong = -st.L / 2 - ZIG.back + (st.L + ZIG.back + ZIG.ahead) * k / n;
          const [px, pz] = st.W(sAlong, kerb - (k % 2 ? ZIG.out : ZIG.in));
          pts.push([px, pz]);
        }
        if (!pts.some(([px, pz]) => handPaint(px, pz))) {
          for (let k = 0; k < pts.length - 1; k++) {
            const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = Math.hypot(bx - ax, bz - az);
            const ox = -(bz - az) / l * ZIG.w / 2, oz = (bx - ax) / l * ZIG.w / 2;
            const q = [[ax - ox, az - oz], [bx - ox, bz - oz], [bx + ox, bz + oz], [ax + ox, az + oz]].map(([x, z]) => [x, world.topAt(x, z) + 0.05, z]);
            for (const i of [0, 2, 1, 0, 3, 2]) { paint.pos.push(...q[i]); paint.nor.push(0, 1, 0); }
          }
        }
      }
    }
    const group = new THREE.Group();
    const meshes = { slab: slab.mesh(frameMat), frame: frame.mesh(frameMat), glass: glass.mesh(glassMat), ads: ads.mesh(adMat), paint: paint.mesh(paintMat) };
    for (const [k, m] of Object.entries(meshes)) {
      if (!m) continue;
      if (k === 'frame' || k === 'slab') { m.castShadow = !!opts.shadows; m.receiveShadow = true; }
      if (k === 'paint') m.receiveShadow = true;
      if (k === 'glass') m.renderOrder = 1;
      group.add(m);
    }
    scene.add(group);
    const base = {};
    for (const k of ['frame', 'glass', 'ads']) if (meshes[k]) base[k] = meshes[k].geometry.attributes.position.array.slice();
    live.set(key, { stops: list, meshes, base, group });
    for (const st of list) st.rec = live.get(key);
  }

  // hide a stop's part of the merged meshes (or bring it back)
  function show(st, on) {
    const { meshes, base } = st.rec;
    for (const k of ['frame', 'glass', 'ads']) {
      const m = meshes[k], r = st.r[k];
      if (!m) continue;
      const a = m.geometry.attributes.position;
      for (let v = r[0]; v < r[1]; v++) {
        if (on) a.setXYZ(v, base[k][v * 3], base[k][v * 3 + 1], base[k][v * 3 + 2]);
        else a.setXYZ(v, st.x, st.y - 60, st.z);
      }
      a.needsUpdate = true;
    }
  }

  function activate(st) {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(frameGeo(st.style, st.L).clone(), frameMat);
    const bench = new THREE.Mesh(benchGeo(st.style, st.L).clone(), frameMat);
    for (const m of [frame, bench]) { m.castShadow = !!opts.shadows; m.receiveShadow = true; }
    const ad = new THREE.Mesh(adGeo(st), adMat);
    for (const m of [frame, bench, ad]) { m.position.set(st.x, st.y, st.z); m.rotation.y = st.yaw; }
    const bend = [ad];
    let name = null;
    if (st.name) { name = nameMesh(st, st.y); bend.push(name); }
    group.add(frame, bench, ad);
    if (name) group.add(name);
    const P = panes(st.L).map(([s0, n0, s1, n1, y0, y1]) => ({ a: st.W(s0, n0), b: st.W(s1, n1), y0: st.y + y0, y1: st.y + y1 }));
    st.br = breakableShelter(world, group, { box: st.box, y: st.y, H, frame, bendAlso: bend, loose: [bench], panes: P, glass: 0xcfe6f2, opacity: 0.3 });
    st.on = { group, frame, bench, ad, name };
    scene.add(group);
    show(st, false);
    active.add(st);
  }

  function deactivate(st, keepHidden = false) {
    st.br.remove();
    const { group, frame, bench, ad, name } = st.on;
    scene.remove(group);
    frame.geometry.dispose(); bench.geometry.dispose(); ad.geometry.dispose();
    // crashed through: when this piece of the map comes back the shelter stands again, its back solid
    if (st.br.through()) world.addSolids([shelterSolids(st.box)[0]]);
    if (name) { name.geometry.dispose(); name.material.map.dispose(); name.material.dispose(); }
    st.br = st.on = null;
    if (!keepHidden) show(st, true);
    active.delete(st);
  }

  world.onSectorLoad(build);
  world.onSectorUnload((s) => {
    const key = `${s.sx}_${s.sz}`, rec = live.get(key);
    if (!rec) return;
    for (const st of rec.stops) { if (st.on) deactivate(st, true); st.rec = null; }
    scene.remove(rec.group);
    for (const m of Object.values(rec.meshes)) m?.geometry.dispose();
    live.delete(key);
  });

  let tick = 0;
  function update(car) {
    if (++tick % 8) return;
    for (const st of active) {
      if (Math.hypot(st.x - car.x, st.z - car.z) > FAR && !st.br.damaged()) deactivate(st);
    }
    for (const rec of live.values()) {
      for (const st of rec.stops) {
        if (st.on) continue;
        const dx = st.x - car.x, dz = st.z - car.z;
        if (dx * dx + dz * dz < NEAR * NEAR) activate(st);
      }
    }
  }

  // The poster opens the shop (Martin, 22 Nov: "make it possible to click on the bus stop banners"): a short
  // press that does not move, on the 3D view, like the Anderson's hologram (hologram.js). The pedals and
  // the buttons are elements of their own, so driving never counts as a tap. Worked out by hand against
  // the poster's rectangle of the stops within reach (a crashed, bent shelter's own poster mesh is ray-cast);
  // the player's own car in front of the poster takes the tap.
  const ray = new THREE.Ray(), ndc = new THREE.Vector2(), caster = new THREE.Raycaster();
  const REACH = 40, PH = 0.875, PW = D * 0.4;          // m: how far a poster answers; half its height and width
  const PU = adCell(POSTER);
  const shown = (o) => { for (; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };
  function posterAt(camera, el, cx, cy, carNow) {
    const r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    caster.setFromCamera(ndc, camera);
    ray.copy(caster.ray);
    const o = ray.origin, d = ray.direction;
    let best = null, bestT = REACH;
    for (const st of STOPS) {
      if (st.y === undefined || !st.rec) continue;              // (its piece of the map is not built)
      const dx = st.x - o.x, dz = st.z - o.z;
      if (dx * dx + dz * dz > (REACH + 3) ** 2) continue;
      if (st.br?.damaged()) {                                  // a bent shelter: its own bent poster mesh, ray-cast
        const h = st.on && shown(st.on.ad) ? caster.intersectObject(st.on.ad, false).find((h) => h.uv && h.uv.x > PU[0] && h.uv.x < PU[2] && h.uv.y > PU[1] && h.uv.y < PU[3]) : null;
        if (h && h.distance < bestT) { best = st; bestT = h.distance; }
        continue;
      }
      // into the shelter's own axes: s along the road, n away from it
      const os = -dx * st.ux - dz * st.uz, on = -dx * st.nx - dz * st.nz;
      const ds = d.x * st.ux + d.z * st.uz, dn = d.x * st.nx + d.z * st.nz;
      // the two faces of the advert box: outside (towards the buses that come) and inside, each seen from its side
      for (const [face, dir] of [[-st.L / 2 - 0.085, 1], [-st.L / 2 + 0.085, -1]]) {
        if (ds * dir <= 1e-4 || (os - face) * dir > 0) continue;
        const t = (face - os) / ds;
        if (t <= 0 || t >= bestT) continue;
        const n = on + dn * t, y = o.y + d.y * t - st.y - 1.2;
        if (Math.abs(n) < PW && Math.abs(y) < PH) { best = st; bestT = t; }
      }
    }
    // and the posters of the hand-built shelters (clickablePoster in adverts.js): a plane or two each, ray-cast
    // (shelter.js bakes their places into their corners, bent or not; only their fronts answer)
    for (const q of extraPosters) {
      if (!shown(q.mesh)) continue;
      const h = caster.intersectObject(q.mesh, false)[0];
      if (h && h.distance < (best || !q.reach ? bestT : q.reach)) { best = q; bestT = h.distance; }   // (the big ones answer from further)
    }
    if (best && carNow) {
      const vx = carNow.x - o.x, vy = (carNow.y ?? 0) + 0.7 - o.y, vz = carNow.z - o.z, tc = vx * d.x + vy * d.y + vz * d.z;
      if (tc > 0 && tc < bestT && vx * vx + vy * vy + vz * vz - tc * tc < 1.1 * 1.1) return null;
    }
    return best;
  }
  function bindClicks(camera, el, getCar = () => null) {
    let down = null, hoverT = 0, over = false;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
    el.addEventListener('click', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 || performance.now() - down.t > 800) return;
      if (posterAt(camera, el, e.clientX, e.clientY, getCar())) window.open(POSTER_URL, '_blank', 'noopener');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - hoverT > 120) { hoverT = now; const was = over; over = !!posterAt(camera, el, e.clientX, e.clientY, getCar()); if (was && !over) el.style.cursor = ''; }
      if (over) el.style.cursor = 'pointer';                   // (after the hologram's own hover, which clears it)
    }, { passive: true });
  }

  return {
    update,
    bindClicks,
    posterAt,
    extraPosters,                    // (for tests)
    stops: STOPS,
    info: () => ({ stops: STOPS.length, loaded: [...live.values()].reduce((n, r) => n + r.stops.length, 0), active: active.size }),
  };
}
