// Parked cars and standing buses (Martin, 18 Nov): every parked car in the city is one of the game's own
// car models, and all of them can be shoved. Drive into one and it slides away as a flat rigid body with
// its handbrake on, scrubbing to a stop; it knocks on into its neighbours, stops against walls and trees,
// and stays where it ended up for the browser session (like the BMW on Jänese tänav, janese.js).
//
// To keep a car park of fifty from costing fifty full models, each model is built once and shared:
//  - near the camera a parked car is drawn with the model's own geometry and materials (one merged mesh),
//  - further away with a simplified copy of it (a few thousand triangles, one material, one draw call)
//    whose paint colour is a uniform, so every colour shares the same geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { buildCarModel } from '../cars/models/index.js';
import { CEED_GREEN } from '../cars/models/ceed.js';
import { palAt } from '../cars/models/kit.js';
import { CARS } from '../cars/specs.js';
import { createTrack } from '../race/race.js';
import { PARKING, rnd } from '../race/landmarks.js';
import { uueturuParked } from '../race/uueturu.js';
import { AKSI_CARS } from './aksi.js';
import { SIRELI_CARS } from './sireli.js';
import { COOP_CARS } from './coop.js';
import { PEPLERI_CARS } from './pepleri.js';
import { JAAAEG_CARS } from './jaaaeg.js';
import { ARHITEKTI_CARS } from './arhitekti.js';
import { ELVA_CARS } from './elva.js';
import { VANEMUISE_CARS } from './vanemuise.js';
import { KORVE_CARS } from './korvekula.js';
import { KORVE2_CARS } from './korvekula2.js';
import { RIIA_CARS } from './riia.js';
import { TEATRI_CARS } from './teatripark.js';
import { KORVE3_CARS } from './korvekula3.js';
import { KORVE4_CARS } from './korvekula4.js';
import { HARIDUSE10_CARS } from './hariduse10.js';
import { NOELA_CARS } from './noela.js';
import { RAADI_CARS } from './raadi.js';
import { RAADI2_CARS } from './raadi2.js';
import { LOUNA_CARS } from './lounakeskus.js';
import { TURU_CARS } from './turu.js';
import { TURU2_CARS } from './turu2.js';
import { RIIA2_CARS } from './riia2.js';

// ---------------------------------------------------------------- what stands where
// paint: colour, and solid (not metallic) for the plain whites
const PAINT = {
  white: [0xe8e9e8, true], black: [0x0b0b0d], silver: [0xb3b7bc], grey: [0x3a3d42], bronze: [0x86704f],
  blue: [0x1d3c6e], red: [0x5a0f15], cyan: [0x1fa9cf], lilac: [0x50294e],
  sage: [CEED_GREEN],                          // Kia's Experience Green, a muted grey-green
};
// the mix Martin asked for: mostly Passat, Mazda and RAV4, a few bZ4X and BMW, and (19 Nov) Tesla Model 3 and
// 2010 Honda Accord saloons
const MODELS = [['passat', 22], ['mazda6', 21], ['rav4', 21], ['bz4x', 7], ['f31', 7], ['model3', 9], ['accord', 9]];
// ordinary colours first, a few bronze and blue, fewer dark red
const COLOURS = [['white', 20], ['black', 16], ['silver', 20], ['grey', 18], ['bronze', 6], ['blue', 6], ['red', 3]];
// models that come only in some colours (taken in turn)
const ONLY = { f31: ['cyan', 'white', 'black'], model3: ['white', 'black', 'blue'], accord: ['white', 'silver', 'black', 'blue'] };
// the two or three Audis: which car of the list (in order) becomes one, and its colour
const AUDIS = [[9, 'lilac'], [37, 'silver'], [61, 'black']];
// Kia Ceed Sportswagons in Experience Green (Martin, 20 Nov), one in each of several car parks: by the columns
// at Kaubamaja, the cross street north of the spawn, two in the river car park, Vallikraavi. (More stand
// outside Elva 35b and at the Coop in Kvissentali, see elva.js and coop.js.)
const KIAS = [14, 46, 70, 104, 117];
const OPTS = { passat: { scan: false }, audi200: { scan: false }, enyaq: { rack: false } };
const MASS = { f31: 1580, model3: 1850, accord: 1530, ceedsw: 1390 };
// buses at stops (bus stop places from OpenStreetMap, moved to the kerb seen in the orthophoto):
// x, z, heading. Ten in the centre and one at Klaose in Kvissentali.
const BUS_STOPS = [
  [1681.4, 3189.8, -2.357], [1736.2, 3132.3, -2.338], [1698.9, 3205.7, 0.784], [1761.7, 3149.8, 0.795],   // Kesklinn VI, V, I, II
  [1712.0, 2951.9, -0.761], [1621.6, 2880.0, 2.406],                                                       // Vabaduse puiestee, Raeplats
  [1875.7, 3149.8, 2.387], [1979.1, 3044.7, -2.32], [2002.7, 3033.1, 0.821],                               // Soola I, Tartu bussijaam (2)
  [1418.2, 3549.0, -2.303],                                                                                // Riiamäe
  [167.9, -35.7, -1.698],                                                                                  // Klaose
];

// n items in the proportions of list ([name, weight] pairs), shuffled the same way every time
function deck(list, n, seed) {
  const total = list.reduce((s, e) => s + e[1], 0), out = [];
  list.forEach(([name, w]) => { for (let i = Math.round(n * w / total); i > 0; i--) out.push(name); });
  while (out.length < n) out.push(list[out.length % list.length][0]);
  const r = rnd(seed);
  for (let i = out.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [out[i], out[k]] = [out[k], out[i]]; }
  return out;
}

// every place something stands: { key, x, z, yaw (forward = sin yaw, -cos yaw), id, paint, lift, row }
function allSpots() {
  const out = [];
  for (const row of PARKING) {
    const dx = row.b[0] - row.a[0], dz = row.b[1] - row.a[1];
    const along = Math.atan2(-dz, dx);
    const r = rnd(row.seed);
    for (let i = 0; i < row.n; i++) {
      if (r() < (row.perp ? 0.22 : 0.15)) continue;              // an empty bay
      const t = (i + 0.5) / row.n, x = row.a[0] + dx * t, z = row.a[1] + dz * t;
      const cy = row.head ? Math.atan2(-row.head[1], row.head[0]) + (r() - 0.5) * 0.06
        : along + (row.perp ? Math.PI / 2 : 0) + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.08;
      out.push({ key: `r${row.seed}.${i}`, x, z, yaw: Math.PI / 2 - cy, row: true });
    }
  }
  const ids = deck(MODELS, out.length, 5), paints = deck(COLOURS, out.length, 9);
  const turn = {};
  out.forEach((s, i) => {
    s.id = ids[i];
    const only = ONLY[s.id];
    s.paint = only ? only[(turn[s.id] = (turn[s.id] ?? -1) + 1) % only.length] : paints[i];
  });
  for (const [k, paint] of AUDIS) if (out[k]) Object.assign(out[k], { id: 'audi200', paint });
  for (const k of KIAS) if (out[k]) Object.assign(out[k], { id: 'ceedsw', paint: 'sage' });
  uueturuParked().forEach((c, i) => out.push({ key: `u${i}`, ...c }));
  AKSI_CARS.forEach(([x, z, yaw, id, paint], i) => out.push({ key: `a${i}`, x, z, yaw, id, paint }));
  SIRELI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `s${i}`, x, z, yaw, id, paint, lift }));
  COOP_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `c${i}`, x, z, yaw, id, paint, lift }));
  PEPLERI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `p${i}`, x, z, yaw, id, paint, lift }));
  JAAAEG_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `j${i}`, x, z, yaw, id, paint, lift }));
  ARHITEKTI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ar${i}`, x, z, yaw, id, paint, lift }));
  ELVA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `el${i}`, x, z, yaw, id, paint, lift }));
  VANEMUISE_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `vm${i}`, x, z, yaw, id, paint, lift }));
  KORVE_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kv${i}`, x, z, yaw, id, paint, lift }));
  KORVE2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kw${i}`, x, z, yaw, id, paint, lift }));
  RIIA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ri${i}`, x, z, yaw, id, paint, lift }));
  TEATRI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tp${i}`, x, z, yaw, id, paint, lift }));
  KORVE3_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kx${i}`, x, z, yaw, id, paint, lift }));
  KORVE4_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ky${i}`, x, z, yaw, id, paint, lift }));
  HARIDUSE10_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kz${i}`, x, z, yaw, id, paint, lift }));
  NOELA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `no${i}`, x, z, yaw, id, paint, lift }));
  RAADI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `rd${i}`, x, z, yaw, id, paint, lift }));
  RAADI2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `re${i}`, x, z, yaw, id, paint, lift }));
  LOUNA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `lk${i}`, x, z, yaw, id, paint, lift }));
  TURU_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tu${i}`, x, z, yaw, id, paint, lift }));
  TURU2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tv${i}`, x, z, yaw, id, paint, lift }));
  RIIA2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `r2${i}`, x, z, yaw, id, paint, lift }));
  BUS_STOPS.forEach(([x, z, yaw], i) => out.push({ key: `b${i}`, x, z, yaw, id: 'bus', paint: null, bus: true }));
  return out;
}

// ---------------------------------------------------------------- one model, shared by all its parked copies
const pixels = new Map();
function sampler(tex) {
  if (!tex || !tex.image) return null;
  let p = pixels.get(tex);
  if (!p) {
    const im = tex.image;
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    p = { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, flip: tex.flipY !== false };
    pixels.set(tex, p);
  }
  return (u, v, out) => {
    u -= Math.floor(u); v -= Math.floor(v);
    const px = Math.min(p.w - 1, Math.floor(u * p.w)), py = Math.min(p.h - 1, Math.floor((p.flip ? 1 - v : v) * p.h));
    const i = (py * p.w + px) * 4;
    out[0] = p.d[i]; out[1] = p.d[i + 1]; out[2] = p.d[i + 2]; out[3] = p.d[i + 3];
  };
}

// The far version: every surface of the model flattened to coloured vertices (palette and lamp textures
// are read per triangle), welded and simplified. aMat = (is paint, roughness, metalness).
// (Typed arrays sized up front and a numeric weld table: building it with growing number lists and a
// text key per vertex made about a gigabyte of garbage per car park, and an iPhone gave up on the page.)
export function bakeLod(parts, id, tris) {
  let cap = 0;
  for (const { geo } of parts) cap += geo.attributes.position.count;
  const pos = new Float64Array(cap * 3), nrm = new Float64Array(cap * 3), col = new Float64Array(cap * 3), mat = new Float64Array(cap * 3);
  let n = 0;                                   // vertices written
  const c = new THREE.Color(), px = [0, 0, 0, 0];
  for (const { geo, mat: m, paint } of parts) {
    if (m.transparent && m.opacity < 0.5) continue;
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv?.array;
    const isPal = !!(m.map && m.metalnessMap && m.map.magFilter === THREE.NearestFilter);
    const tex = !paint && !isPal && U ? sampler(m.map) : null;
    // decals lie a few millimetres off the body: lift them clear of the simplified shell
    const puff = paint ? 0 : isPal ? 0.006 : 0.014;
    for (let t = 0; t < P.length; t += 9) {
      let r = m.roughness ?? 0.5, mt = m.metalness ?? 0, isPaint = 0;
      if (paint) { c.setRGB(1, 1, 1); isPaint = 1; }
      else if (isPal) { const e = palAt(U[t / 9 * 6]); c.set(e[0]); r = e[1]; mt = e[2]; }
      else if (tex) {
        tex((U[t / 9 * 6] + U[t / 9 * 6 + 2] + U[t / 9 * 6 + 4]) / 3, (U[t / 9 * 6 + 1] + U[t / 9 * 6 + 3] + U[t / 9 * 6 + 5]) / 3, px);
        if (m.alphaTest > 0 && px[3] < m.alphaTest * 255) continue;
        c.setRGB(px[0] / 255, px[1] / 255, px[2] / 255, THREE.SRGBColorSpace).multiply(m.color);
      } else c.copy(m.color);
      for (let k = 0; k < 9; k += 3) {
        const a = n * 3;
        pos[a] = P[t + k] + N[t + k] * puff; pos[a + 1] = P[t + k + 1] + N[t + k + 1] * puff; pos[a + 2] = P[t + k + 2] + N[t + k + 2] * puff;
        nrm[a] = N[t + k]; nrm[a + 1] = N[t + k + 1]; nrm[a + 2] = N[t + k + 2];
        col[a] = c.r; col[a + 1] = c.g; col[a + 2] = c.b; mat[a] = isPaint; mat[a + 1] = r; mat[a + 2] = mt;
        n++;
      }
    }
  }
  // weld: same place, colour and (roughly) normal. Each vertex gets ten whole numbers (position to
  // 0.2 mm, normal in thirds, colour in sixtieths, paint or not), kept in an open hash table that
  // holds the first vertex of each kind (its numbers are worked out again to compare).
  const index = new Uint32Array(n), first = new Int32Array(n), Q = new Int32Array(10), R = new Int32Array(10);
  const quant = (a, o) => {
    o[0] = Math.round(pos[a] * 5000); o[1] = Math.round(pos[a + 1] * 5000); o[2] = Math.round(pos[a + 2] * 5000);
    o[3] = Math.round(nrm[a] * 3); o[4] = Math.round(nrm[a + 1] * 3); o[5] = Math.round(nrm[a + 2] * 3);
    o[6] = Math.round(col[a] * 60); o[7] = Math.round(col[a + 1] * 60); o[8] = Math.round(col[a + 2] * 60); o[9] = mat[a];
  };
  let size = 1024;
  while (size < n * 2) size *= 2;
  const table = new Int32Array(size).fill(-1), maskT = size - 1;
  let u = 0;                                   // distinct vertices
  for (let i = 0; i < n; i++) {
    quant(i * 3, Q);
    let h = 0x811c9dc5;
    for (let k = 0; k < 10; k++) h = Math.imul(h ^ Q[k], 0x01000193);
    h = (h ^ (h >>> 15)) & maskT;
    let v;
    for (;;) {
      v = table[h];
      if (v < 0) { v = u++; table[h] = v; first[v] = i; break; }
      quant(first[v] * 3, R);
      let same = true;
      for (let k = 0; k < 10; k++) if (R[k] !== Q[k]) { same = false; break; }
      if (same) break;
      h = (h + 1) & maskT;
    }
    index[i] = v;
  }
  let idx = index;
  if (MeshoptSimplifier.supported) {
    const target = Math.round(tris * (id === 'bus' ? 0.85 : 1)) * 3;
    const vp = new Float32Array(u * 3);
    for (let v = 0; v < u; v++) { const a = first[v] * 3; vp[v * 3] = pos[a]; vp[v * 3 + 1] = pos[a + 1]; vp[v * 3 + 2] = pos[a + 2]; }
    idx = MeshoptSimplifier.simplify(index, vp, 3, target, 0.03, ['ErrorAbsolute'])[0];
  }
  // keep only the vertices still in use
  const remap = new Int32Array(u).fill(-1), oi = new Uint32Array(idx.length), keep = [];
  for (let i = 0; i < idx.length; i++) {
    let v = remap[idx[i]];
    if (v < 0) { v = remap[idx[i]] = keep.length; keep.push(first[idx[i]]); }
    oi[i] = v;
  }
  const w = keep.length, op = new Float32Array(w * 3), on = new Float32Array(w * 3), oc = new Float32Array(w * 3), om = new Float32Array(w * 3);
  for (let v = 0; v < w; v++) {
    const a = keep[v] * 3, b = v * 3;
    for (let k = 0; k < 3; k++) { op[b + k] = pos[a + k]; on[b + k] = nrm[a + k]; oc[b + k] = col[a + k]; om[b + k] = mat[a + k]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(op, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(on, 3));
  g.setAttribute('color', new THREE.BufferAttribute(oc, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(om, 3));
  g.setIndex(new THREE.BufferAttribute(w > 65535 ? oi : new Uint16Array(oi), 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// far material: vertex colours, with the paint colour and its finish as uniforms
const lodMats = new Map();
function lodMaterial(name, own = null) {
  let m = lodMats.get(name);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true });
  const uPaint = { value: new THREE.Color() }, uFinish = { value: new THREE.Vector2(0.34, 0.55) };
  if (own) { uPaint.value.copy(own.color); uFinish.value.set(own.roughness, own.metalness); }   // the model's own paint (bus livery)
  else { uPaint.value.set(PAINT[name][0]); if (PAINT[name][1]) uFinish.value.set(0.38, 0.05); }
  m.onBeforeCompile = (s) => {
    s.uniforms.uPaint = uPaint; s.uniforms.uFinish = uFinish;
    s.vertexShader = `attribute vec3 aMat;\nuniform vec3 uPaint;\nuniform vec2 uFinish;\nvarying vec2 vFinish;\n${s.vertexShader}`
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix( vColor.rgb, uPaint, aMat.x );\nvFinish = mix( aMat.yz, uFinish, aMat.x );');
    s.fragmentShader = `varying vec2 vFinish;\n${s.fragmentShader}`
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vFinish.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vFinish.y;');
  };
  m.customProgramCacheKey = () => 'parked-lod';
  lodMats.set(name, m);
  return m;
}

const templates = new Map();
function buildTemplate(id) {
  const model = buildCarModel(id, OPTS[id]);
  model.setLights?.({ headlights: false });
  model.setSoot?.(0);
  model.group.updateMatrixWorld(true);
  const parts = [];
  model.group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    parts.push({ geo, mat: o.material, paint: o.name === `${id}_paint` });
  });
  const T = {
    id, lod: null, parts, near: null, nearMats: null, paints: new Map(),
    hl: model.size.length / 2, hw: model.size.width / 2, wb: model.wheelbase, tr: model.track,
    mass: MASS[id] || CARS[id]?.mass || 1500,
    ownPaint: parts.find((p) => p.paint)?.mat || { color: new THREE.Color(0xffffff), roughness: 0.4, metalness: 0.3 },
  };
  // the near version is put together the first time a car of this model is close enough to need it
  T.needNear = () => {
    if (T.near) return;
    const byMat = new Map();
    for (const p of T.parts) { let l = byMat.get(p.mat); if (!l) byMat.set(p.mat, (l = [])); l.push(p.geo); }
    const geos = [], mats = [];
    for (const [m, l] of byMat) {
      for (const g of l) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      geos.push(l.length > 1 ? mergeGeometries(l) : l[0]); mats.push(m);
    }
    T.near = mergeGeometries(geos, true);
    T.near.computeBoundingSphere();
    T.nearMats = mats;
    T.paintAt = mats.indexOf(T.parts.find((p) => p.paint)?.mat);
    for (const p of T.parts) p.geo.dispose();
    T.parts = null;
  };
  // the model's materials, with the body in this colour
  T.materials = (name) => {
    if (!name || T.paintAt < 0) return T.nearMats;
    let l = T.paints.get(name);
    if (!l) {
      const [hex, solid] = PAINT[name];
      const m = T.nearMats[T.paintAt].clone();
      m.color.set(hex);
      if (solid) Object.assign(m, { metalness: 0.05, roughness: 0.38 });
      l = T.nearMats.slice(); l[T.paintAt] = m;
      T.paints.set(name, l);
    }
    return l;
  };
  return T;
}

// ---------------------------------------------------------------- boxes that bump
const axes = (yaw) => [Math.sin(yaw), -Math.cos(yaw), Math.cos(yaw), Math.sin(yaw)];
// separating-axis test of two boxes {x, z, yaw, hl, hw}: overlap and the normal pushing a out of b
function overlap(a, b) {
  const [fx, fz, rx, rz] = axes(a.yaw), [gx, gz, sx, sz] = axes(b.yaw);
  const dx = a.x - b.x, dz = a.z - b.z;
  let best = Infinity, nx = 0, nz = 0;
  for (const [ax, az] of [[fx, fz], [rx, rz], [gx, gz], [sx, sz]]) {
    const ra = a.hl * Math.abs(fx * ax + fz * az) + a.hw * Math.abs(rx * ax + rz * az);
    const rb = b.hl * Math.abs(gx * ax + gz * az) + b.hw * Math.abs(sx * ax + sz * az);
    const d = dx * ax + dz * az, pen = ra + rb - Math.abs(d);
    if (pen <= 0) return null;
    if (pen < best) { best = pen; const sg = d >= 0 ? 1 : -1; nx = ax * sg; nz = az * sg; }
  }
  return { pen: best, nx, nz };
}
// roughly where two overlapping boxes touch: the average of the corners of each inside the other
function contact(a, b) {
  let cx = 0, cz = 0, n = 0;
  const inside = (p, o) => {
    const [fx, fz, rx, rz] = axes(o.yaw), dx = p[0] - o.x, dz = p[1] - o.z;
    return Math.abs(dx * fx + dz * fz) <= o.hl && Math.abs(dx * rx + dz * rz) <= o.hw;
  };
  for (const [o, other] of [[a, b], [b, a]]) {
    const [fx, fz, rx, rz] = axes(o.yaw);
    for (const [l, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = [o.x + fx * o.hl * l + rx * o.hw * t, o.z + fz * o.hl * l + rz * o.hw * t];
      if (inside(p, other)) { cx += p[0]; cz += p[1]; n++; }
    }
  }
  return n ? [cx / n, cz / n] : [(a.x + b.x) / 2, (a.z + b.z) / 2];
}

const KEY = 'streetlap.parked';
const MU_G = 4.2;                 // handbrake on, in gear: scrubs to a stop at about 0.43 g
const SPIN_DECEL = 3.0;           // rad/s^2 of scrub when it is twisted round
const E = 0.15;                   // bounce

export function createParked(scene, world, opts = {}) {
  const track = createTrack();
  const touch = !!opts.touch;
  const VIEW = touch ? 240 : 520;                      // drawn within this distance of the camera
  const tris = touch ? 3200 : 6000;                    // triangles of the far version
  const tune = { near: touch ? 26 : 45, nearMax: touch ? 3 : 10 };   // full models: how close, and how many at once
  const spots = allSpots(), bodies = [];
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { /* none */ }
  const group = new THREE.Group();
  group.name = 'parked';
  scene.add(group);

  // models are built one at a time, with a pause between, so that no frame waits long (on a phone a
  // longer pause, so the memory each build churns through is given back before the next one)
  // On a phone no model is built before DRIVE nor in the seconds after it or after a map jump (hold): a
  // build throws away 100-250 MB, and builds running into DRIVE and its first frames behind the car are
  // what made an iPhone 13 reload the page 1-2 s after DRIVE (20 Nov). The cars stand there from then on.
  const queue = [];
  let building = false, holdUntil = touch ? Infinity : 0;
  const gap = touch ? 1200 : 150;
  function want(id) {
    if (templates.has(id)) return templates.get(id);
    templates.set(id, null);
    queue.push(id);
    pump();
    return null;
  }
  function pump() {
    if (building || !queue.length) return;
    building = true;
    const run = () => {
      const wait = holdUntil - performance.now();
      if (wait > 0) { setTimeout(run, Math.min(wait, 500)); return; }
      const id = queue.shift();
      const fail = (e) => { console.warn('parked', id, e); templates.set(id, false); building = false; pump(); };
      let T;
      try { T = buildTemplate(id); } catch (e) { fail(e); return; }
      // the far version in a frame of its own
      setTimeout(() => {
        try { T.lod = bakeLod(T.parts, id, tris); templates.set(id, T); } catch (e) { fail(e); return; }
        building = false;
        pump();
      }, touch ? 300 : 120);
    };
    MeshoptSimplifier.ready.then(() => setTimeout(run, gap), () => setTimeout(run, gap));
  }

  const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), v1 = new THREE.Vector3(), qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  // sit it on the ground under its four wheels
  function setPose(b) {
    const [fx, fz, rx, rz] = axes(b.yaw);
    const h = (l, t) => world.heightAt(b.x + fx * l + rx * t, b.z + fz * l + rz * t);
    const fl = h(b.wb / 2, -b.tr / 2), fr = h(b.wb / 2, b.tr / 2), rl = h(-b.wb / 2, -b.tr / 2), rr = h(-b.wb / 2, b.tr / 2);
    if (![fl, fr, rl, rr].every(Number.isFinite)) return;
    nrm.set(0, 1, 0)
      .addScaledVector(v1.set(fx, 0, fz), -(fl + fr - rl - rr) / 2 / b.wb)
      .addScaledVector(v1.set(rx, 0, rz), -(fr + rr - fl - rl) / 2 / b.tr).normalize();
    qYaw.setFromAxisAngle(up, -b.yaw);
    qTilt.setFromUnitVectors(up, nrm);
    b.g.quaternion.copy(qTilt).multiply(qYaw);
    b.y = (fl + fr + rl + rr) / 4;
    b.g.position.set(b.x, b.y + b.lift, b.z);
  }

  function spawn(s, T) {
    s.done = true;
    if (s.row) {
      // never on the race line or inside a building
      const n = track.nearest(s.x, s.z, -1);
      if (n.d < (track.HW[n.i] ?? 6) + 2 || world.sdfAt(s.x, s.z) < 1.6) return;
    } else if (s.bus && world.sdfAt(s.x, s.z) < 0.6) return;
    const b = {
      s, T, x: s.x, z: s.z, yaw: s.yaw, hl: T.hl, hw: T.hw, wb: T.wb, tr: T.tr, mass: T.mass,
      inertia: T.mass * ((2 * T.hl) ** 2 + (2 * T.hw) ** 2) / 12,
      vx: 0, vz: 0, w: 0, moving: false, y: 0, lift: s.lift || 0, moved: false,
      g: new THREE.Group(), far: null, near: null, isNear: false,
    };
    const at = saved[s.key];
    if (at && Number.isFinite(at[0])) { b.x = at[0]; b.z = at[1]; b.yaw = at[2]; b.moved = true; }
    b.far = new THREE.Mesh(T.lod, s.paint ? lodMaterial(s.paint) : lodMaterial(`own.${T.id}`, T.ownPaint));
    b.far.castShadow = !!opts.shadows; b.far.receiveShadow = true;
    b.g.add(b.far);
    setPose(b);
    group.add(b.g);
    bodies.push(b);
  }
  function showNear(b, on) {
    if (b.isNear === on) return;
    b.isNear = on;
    if (on && !b.near) {
      b.T.needNear();
      b.near = new THREE.Mesh(b.T.near, b.T.materials(b.s.paint));
      b.near.castShadow = !!opts.shadows; b.near.receiveShadow = true;
      b.g.add(b.near);
    }
    if (b.near) b.near.visible = on;
    b.far.visible = !on;
  }

  // ---- the player's car (as a box) against a parked one: share the overlap by mass and swap momentum
  function hitByCar(car, cb, b) {
    const o = overlap(cb, b);
    if (!o) return;
    const M = car.spec.mass || 1500, m = b.mass;
    const [fx, fz, rx, rz] = axes(car.yaw);
    car.x += o.nx * o.pen * m / (M + m); car.z += o.nz * o.pen * m / (M + m);
    b.x -= o.nx * o.pen * M / (M + m); b.z -= o.nz * o.pen * M / (M + m);
    cb.x = car.x; cb.z = car.z;
    const [px, pz] = contact(cb, b);
    const rbx = px - b.x, rbz = pz - b.z;
    const cvx = car.vx * fx + car.vy * rx, cvz = car.vx * fz + car.vy * rz;
    const bvx = b.vx - b.w * rbz, bvz = b.vz + b.w * rbx;             // its velocity at the contact
    const vrel = (cvx - bvx) * o.nx + (cvz - bvz) * o.nz;
    b.moving = true; b.moved = true;
    if (vrel >= 0) return;
    const lever = -rbz * o.nx + rbx * o.nz;                           // perp(r) . n
    const j = -(1 + E) * vrel / (1 / M + 1 / m + lever * lever / b.inertia);
    const nvx = cvx + j * o.nx / M, nvz = cvz + j * o.nz / M;
    car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
    b.vx -= j * o.nx / m; b.vz -= j * o.nz / m;
    b.w -= lever * j / b.inertia;
    // a glancing knock turns the player's car a little, as against another player
    const dx = car.x - b.x, dz = car.z - b.z;
    car.yawRate += Math.max(-1.2, Math.min(1.2, -(o.nx * rx + o.nz * rz) * (dx * fx + dz * fz) * j / M * 0.25));
    car.hit = Math.max(car.hit, j / M);
  }
  // ---- a sliding parked car against another one
  function knock(a, b) {
    const o = overlap(a, b);
    if (!o) return;
    const s = a.mass + b.mass;
    a.x += o.nx * o.pen * b.mass / s; a.z += o.nz * o.pen * b.mass / s;
    b.x -= o.nx * o.pen * a.mass / s; b.z -= o.nz * o.pen * a.mass / s;
    const [px, pz] = contact(a, b);
    const rax = px - a.x, raz = pz - a.z, rbx = px - b.x, rbz = pz - b.z;
    const vrel = (a.vx - a.w * raz - b.vx + b.w * rbz) * o.nx + (a.vz + a.w * rax - b.vz - b.w * rbx) * o.nz;
    if (!b.moving) { b.moving = true; b.moved = true; b.vx = b.vz = b.w = 0; }
    if (vrel >= 0) return;
    const la = rax * o.nz - raz * o.nx, lb = rbx * o.nz - rbz * o.nx;
    const j = -(1 + E) * vrel / (1 / a.mass + 1 / b.mass + la * la / a.inertia + lb * lb / b.inertia);
    a.vx += j * o.nx / a.mass; a.vz += j * o.nz / a.mass; a.w += la * j / a.inertia;
    b.vx -= j * o.nx / b.mass; b.vz -= j * o.nz / b.mass; b.w -= lb * j / b.inertia;
  }
  const grad = [0, 0], trunks = [];
  let saveIn = 0;
  function step(b, dt) {
    b.x += b.vx * dt; b.z += b.vz * dt; b.yaw += b.w * dt;
    // tyres scrubbing: a steady friction deceleration of the slide and of the spin
    const sp = Math.hypot(b.vx, b.vz);
    const k = sp > 1e-6 ? Math.max(0, sp - MU_G * dt) / sp : 0;
    b.vx *= k; b.vz *= k;
    b.w = Math.sign(b.w) * Math.max(0, Math.abs(b.w) - SPIN_DECEL * dt);
    // buildings, walls and the map edge: keep its edges out, stop the motion into them
    const [fx, fz, rx, rz] = axes(b.yaw);
    const n = Math.max(1, Math.ceil(b.hl / 1.5));
    for (let i = -n; i <= n; i++) for (const t of [1, -1]) {
      const px = b.x + fx * b.hl * i / n + rx * b.hw * t, pz = b.z + fz * b.hl * i / n + rz * b.hw * t;
      const d = world.sdfAt(px, pz);
      if (!(d < 0)) continue;
      world.sdfGrad(px, pz, grad);
      b.x -= grad[0] * d; b.z -= grad[1] * d;
      const vn = b.vx * grad[0] + b.vz * grad[1];
      if (vn < 0) { b.vx -= 1.2 * vn * grad[0]; b.vz -= 1.2 * vn * grad[1]; b.w *= 0.5; }
    }
    // tree trunks: round posts against the box
    world.trunksNear(b.x, b.z, b.hl + 1.5, trunks);
    for (let i = 0; i < trunks.length; i += 3) {
      const dx = trunks[i] - b.x, dz = trunks[i + 1] - b.z, r = trunks[i + 2];
      const l = dx * fx + dz * fz, t = dx * rx + dz * rz;
      const ql = Math.max(-b.hl, Math.min(b.hl, l)), qt = Math.max(-b.hw, Math.min(b.hw, t));
      let ex = l - ql, ez = t - qt, d = Math.hypot(ex, ez);
      if (d >= r) continue;
      if (d < 1e-4) {                                                 // trunk centre inside the box: out through the nearest side
        if (b.hl - Math.abs(l) < b.hw - Math.abs(t)) { ex = Math.sign(l) || 1; ez = 0; d = -(b.hl - Math.abs(l)); }
        else { ex = 0; ez = Math.sign(t) || 1; d = -(b.hw - Math.abs(t)); }
      } else { ex /= d; ez /= d; }
      const nx = -(ex * fx + ez * rx), nz = -(ex * fz + ez * rz), pen = r - d;   // pushes the box off the trunk
      b.x += nx * pen; b.z += nz * pen;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= 1.2 * vn * nx; b.vz -= 1.2 * vn * nz; b.w *= 0.5; }
    }
    for (const o of bodies) {
      if (o === b) continue;
      const reach = b.hl + o.hl + 1;
      if (Math.abs(o.x - b.x) < reach && Math.abs(o.z - b.z) < reach && Math.abs(o.y - b.y) < 2.5) knock(b, o);
    }
    if (Math.hypot(b.vx, b.vz) < 0.02 && Math.abs(b.w) < 0.02) {
      b.vx = b.vz = b.w = 0; b.moving = false;
      saveIn = 0.3;
    }
  }
  function save() {
    for (const b of bodies) if (b.moved) saved[b.s.key] = [+b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(4)];
    try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ }
  }

  let scanIn = 0, lodIn = 0;
  const order = [];
  // car: the player's car; eye: the camera position (the drone intro looks at places far from the car)
  function update(car, dt, eye = car) {
    const ex = eye.x, ez = eye.z;
    // ---- stand cars where the ground has loaded, nearest models first
    if ((scanIn -= dt) <= 0) {
      scanIn = 0.4;
      for (const s of spots) {
        if (s.done) continue;
        const d = Math.min(Math.hypot(s.x - ex, s.z - ez), Math.hypot(s.x - car.x, s.z - car.z));
        if (d > VIEW + 60 || !world.ready(s.x, s.z)) continue;
        const T = want(s.id);
        if (T) spawn(s, T); else if (T === false) s.done = true;
      }
    }
    // ---- bumps
    const cb = { x: car.x, z: car.z, yaw: car.yaw, hl: car.halfLen, hw: car.halfWid };
    for (const b of bodies) {
      const reach = b.hl + cb.hl + 1;
      if (Math.abs(b.x - car.x) < reach && Math.abs(b.z - car.z) < reach && Math.abs(car.y - b.y) < 2.5) hitByCar(car, cb, b);
    }
    for (const b of bodies) {
      if (!b.moving) continue;
      for (let i = 0; i < 2; i++) if (b.moving) step(b, dt / 2);
      setPose(b);
    }
    if (saveIn > 0 && (saveIn -= dt) <= 0) save();
    // ---- which are drawn, and which of them in full
    if ((lodIn -= dt) <= 0) {
      lodIn = 0.2;
      order.length = 0;
      for (const b of bodies) {
        const d = Math.hypot(b.x - ex, b.z - ez);
        b.g.visible = d < VIEW;
        b.d = d;
        if (d < tune.near * (b.isNear ? 1.15 : 1) * (b.s.bus ? 1.6 : 1)) order.push(b); else showNear(b, false);
      }
      order.sort((a, b) => a.d - b.d);
      order.forEach((b, i) => showNear(b, i < tune.nearMax));
    }
  }
  // no new models for s seconds from now (phones only; the first call, at DRIVE, lets them start)
  const hold = (s) => {
    const t = performance.now() + s * 1000;
    if (touch) holdUntil = holdUntil === Infinity ? t : Math.max(holdUntil, t);
  };
  return { update, bodies, spots, group, templates, tune, hold };
}
