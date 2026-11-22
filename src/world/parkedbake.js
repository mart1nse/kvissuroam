// The parts of a parked car's model that are worked out once per model (src/world/parked.js): the pieces of
// the built car, the near version (one merged mesh), the far version (flattened to coloured vertices and
// simplified) and the very far one. Kept apart from parked.js so that the worker that builds car models
// (src/cars/models/worker.js) can do all of it away from the page: on the page it was 0.2 to 0.4 s of
// standstill per model, one after another while driving into a street with parked cars (Martin, 20 Nov).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { palAt } from '../cars/models/kit.js';
import { serializeCar, deserializeCar } from '../cars/models/serial.js';
import { jobs } from '../jobs.js';

export const simplifierReady = () => MeshoptSimplifier.ready.catch(() => {});

// the model's shown meshes, each in the car's own frame. tint: a scanned body whose white is its paint
export function takeParts(id, model, tint = false) { return jobs.run(takePartsSteps(id, model, tint)); }
// (in steps for the work queue: a scanned body's meshes are big, 50 ms together on the test drive)
export function* takePartsSteps(id, model, tint = false) {
  model.setLights?.({ headlights: false });
  model.group.updateMatrixWorld(true);
  const parts = [];
  const take = (o) => {
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const scan = !!model.glbLoaded && o.name.endsWith('_glb') && !o.material.name.startsWith('ov_');
    parts.push({ geo, mat: o.material, paint: o.name === `${id}_paint`, scan, tint: scan && tint });
  };
  const meshes = [];
  if (model.glbLoaded) {
    // the drawn body is hidden under the scan (whole branches of it): leave out what is not shown
    const walk = (o) => { if (!o.visible) return; if (o.isMesh) meshes.push(o); for (const c of o.children) walk(c); };
    walk(model.group);
  } else model.group.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  let n = 0;
  for (const o of meshes) {
    take(o);
    n += o.geometry.attributes.position.count;
    if (n > 20000) { n = 0; yield; }
  }
  return parts;
}

// the near version: the parts merged into one geometry with a group per material. Lets the parts go.
export function mergeNear(parts) {
  const byMat = new Map();
  for (const p of parts) { let l = byMat.get(p.mat); if (!l) byMat.set(p.mat, (l = [])); l.push(p.geo); }
  const geos = [], mats = [];
  for (const [m, l] of byMat) {
    for (const g of l) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    geos.push(l.length > 1 ? mergeGeometries(l) : l[0]); mats.push(m);
  }
  const near = mergeGeometries(geos, true);
  near.computeBoundingSphere();
  for (const p of parts) p.geo.dispose();
  return { near, mats };
}

// The merged near version holds a corner once for every triangle that meets there, about 150 000 corners a
// car at 32 bytes each: 5 MB a model, 76 MB for the fifteen models met on a drive through the centre, kept
// for good and again on the graphics card for the ones shown (21 Nov 2026). With each different corner
// once and an index it is a third of that. Corners count as the same within a tenth of a millimetre, a
// hundredth of the normal and a ten-thousandth of the picture. Takes 0.1 s or more: for the worker.
export function shareCorners(g) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, n = P.length / 3;
  const seen = new Map(), idx = new Uint32Array(n), src = [];
  for (let i = 0; i < n; i++) {
    const a = i * 3, b = i * 2;
    const key = `${Math.round(P[a] * 1e4)},${Math.round(P[a + 1] * 1e4)},${Math.round(P[a + 2] * 1e4)},${Math.round(N[a] * 100)},${Math.round(N[a + 1] * 100)},${Math.round(N[a + 2] * 100)},${Math.round(U[b] * 1e4)},${Math.round(U[b + 1] * 1e4)}`;
    let k = seen.get(key);
    if (k === undefined) { k = src.length; seen.set(key, k); src.push(i); }
    idx[i] = k;
  }
  const m = src.length, p = new Float32Array(m * 3), nn = new Float32Array(m * 3), u = new Float32Array(m * 2);
  for (let k = 0; k < m; k++) {
    const a = src[k] * 3, b = src[k] * 2;
    p[k * 3] = P[a]; p[k * 3 + 1] = P[a + 1]; p[k * 3 + 2] = P[a + 2];
    nn[k * 3] = N[a]; nn[k * 3 + 1] = N[a + 1]; nn[k * 3 + 2] = N[a + 2];
    u[k * 2] = U[b]; u[k * 2 + 1] = U[b + 1];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(u, 2));
  out.setIndex(new THREE.BufferAttribute(m > 65535 ? idx : Uint16Array.from(idx), 1));
  for (const x of g.groups) out.addGroup(x.start, x.count, x.materialIndex);   // (the index runs in the old order)
  out.boundingSphere = g.boundingSphere; out.boundingBox = g.boundingBox;
  g.dispose();
  return out;
}

// ---- for the worker: everything about one model as plain data, and back on the page
const geoData = (g, transfer) => {
  const attrs = {};
  for (const [k, a] of Object.entries(g.attributes)) { attrs[k] = { array: a.array, itemSize: a.itemSize }; transfer.push(a.array.buffer); }
  const s = g.boundingSphere, b = g.boundingBox;
  return { attrs, sphere: [s.center.x, s.center.y, s.center.z, s.radius], box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z] };
};
export function packParked(id, model, { tint = false, tris, lowTris, pack = false }) {
  model.setLights?.({ headlights: false });
  model.setSoot?.(0);
  const parts = takeParts(id, model, tint);
  const paint = parts.find((p) => p.paint), paintPart = parts.find((p) => p.paint || p.tint);
  const own = paint ? { color: paint.mat.color.toArray(), roughness: paint.mat.roughness, metalness: paint.mat.metalness } : null;
  const lod = bakeLod(parts, id, tris), low = lowLod(lod, lowTris);
  const merged = mergeNear(parts), mats = merged.mats;
  merged.near.computeBoundingBox();
  const near = shareCorners(merged.near);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(near, mats));
  const { data, transfer, packs } = serializeCar({ group: g }, pack);
  const lowIndex = low === lod ? null : low.index.array;
  const lodIndex = lod.index.array;
  const out = {
    near: data, paintAt: paintPart ? mats.indexOf(paintPart.mat) : -1, tinted: !!paintPart?.tint, own,
    lod: geoData(lod, transfer), lodIndex, lowIndex,
    size: model.size, wheelbase: model.wheelbase, track: model.track,
  };
  transfer.push(lodIndex.buffer);
  if (lowIndex) transfer.push(lowIndex.buffer);
  return { data: out, transfer: [...new Set(transfer)], packs };
}
export function unpackParked(d) {
  const mesh = deserializeCar(d.near).group.children[0];
  const lod = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(d.lod.attrs)) lod.setAttribute(k, new THREE.BufferAttribute(a.array, a.itemSize));
  lod.setIndex(new THREE.BufferAttribute(d.lodIndex, 1));
  const s = d.lod.sphere, b = d.lod.box;
  lod.boundingSphere = new THREE.Sphere(new THREE.Vector3(s[0], s[1], s[2]), s[3]);
  lod.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
  let low = lod;
  if (d.lowIndex) {
    low = new THREE.BufferGeometry();
    for (const k of Object.keys(lod.attributes)) low.setAttribute(k, lod.attributes[k]);
    low.setIndex(new THREE.BufferAttribute(d.lowIndex, 1));
    low.boundingSphere = lod.boundingSphere; low.boundingBox = lod.boundingBox;
  }
  return { near: mesh.geometry, nearMats: Array.isArray(mesh.material) ? mesh.material : [mesh.material], lod, low,
    paintAt: d.paintAt, tinted: d.tinted, own: d.own, size: d.size, wheelbase: d.wheelbase, track: d.track };
}

// ---------------------------------------------------------------- the far versions
const pixels = new Map();
function sampler(tex) {
  if (!tex || !tex.image) return null;
  let p = pixels.get(tex);
  if (!p) {
    const im = tex.image;
    // (a model that came from the worker has its pictures as pixels already)
    if (im.data && !im.getContext) { pixels.set(tex, (p = { d: im.data, w: im.width, h: im.height, flip: tex.flipY !== false })); return at(p); }
    // (a scanned body's 2048 picture is read at 512: one colour per triangle does not need more)
    const k = Math.min(1, 512 / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, c.width, c.height);
    p = { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, flip: tex.flipY !== false };
    pixels.set(tex, p);
  }
  return at(p);
}
const at = (p) => (u, v, out) => {
  u -= Math.floor(u); v -= Math.floor(v);
  const px = Math.min(p.w - 1, Math.floor(u * p.w)), py = Math.min(p.h - 1, Math.floor((p.flip ? 1 - v : v) * p.h));
  const i = (py * p.w + px) * 4;
  out[0] = p.d[i]; out[1] = p.d[i + 1]; out[2] = p.d[i + 2]; out[3] = p.d[i + 3];
};

// The far version: every surface of the model flattened to coloured vertices (palette and lamp textures
// are read per triangle), welded and simplified. aMat = (is paint, roughness, metalness).
// (Typed arrays sized up front and a numeric weld table: building it with growing number lists and a
// text key per vertex made about a gigabyte of garbage per car park, and an iPhone gave up on the page.)
// (in steps for the page's work queue, src/jobs.js: `yield` is where it may wait for the next frame)
// (In two halves, with the thinning between them: `bakeLodFront` gathers and welds, `thin` takes triangles
// away, `bakeLodBack` packs what is left. On the page the thinning of a scanned body, 100 thousand triangles,
// was one step of 30 to 70 ms, a pause at the start of a first lap: there it is handed to the car worker,
// see src/world/parked.js.)
export function bakeLod(parts, id, tris) { return jobs.run(bakeLodSteps(parts, id, tris)); }
export function* bakeLodSteps(parts, id, tris) {
  const st = yield* bakeLodFront(parts, id, tris);
  yield;
  const idx = thin(st.index, st.vp, st.target);
  yield;
  return bakeLodBack(st, idx);
}
// the triangle list thinned to `target` corners (as it was where the simplifier is missing)
export function thin(index, vp, target) {
  return MeshoptSimplifier.supported && vp ? MeshoptSimplifier.simplify(index, vp, 3, target, 0.03, ['ErrorAbsolute'])[0] : index;
}
export function* bakeLodFront(parts, id, tris) {
  let cap = 0;
  for (const { geo } of parts) cap += geo.attributes.position.count;
  const pos = new Float64Array(cap * 3), nrm = new Float64Array(cap * 3), col = new Float64Array(cap * 3), mat = new Float64Array(cap * 3);
  let n = 0;                                   // vertices written
  const c = new THREE.Color(), px = [0, 0, 0, 0];
  for (const { geo, mat: m, paint, scan, tint } of parts) {
    if (m.transparent && m.opacity < 0.5) continue;
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv?.array;
    const isPal = !!(m.map && m.metalnessMap && m.map.magFilter === THREE.NearestFilter);
    const tex = !paint && !isPal && U ? sampler(m.map) : null;
    // decals lie a few millimetres off the body: lift them clear of the simplified shell
    const puff = paint || scan ? 0 : isPal ? 0.006 : 0.014;
    for (let t = 0; t < P.length; t += 9) {
      if (t % 73728 === 73719) yield;          // (every 8192 triangles: a scanned body is one part of 100 thousand)
      let r = m.roughness ?? 0.5, mt = m.metalness ?? 0, isPaint = 0;
      if (paint) { c.setRGB(1, 1, 1); isPaint = 1; }
      else if (isPal) { const e = palAt(U[t / 9 * 6]); c.set(e[0]); r = e[1]; mt = e[2]; }
      else if (tex) {
        tex((U[t / 9 * 6] + U[t / 9 * 6 + 2] + U[t / 9 * 6 + 4]) / 3, (U[t / 9 * 6 + 1] + U[t / 9 * 6 + 3] + U[t / 9 * 6 + 5]) / 3, px);
        if (m.alphaTest > 0 && px[3] < m.alphaTest * 255) continue;
        // a scanned body that takes paint: its white parts are the paint
        if (tint && Math.min(px[0], px[1], px[2]) > 150) { c.setRGB(1, 1, 1); isPaint = 1; }
        else c.setRGB(px[0] / 255, px[1] / 255, px[2] / 255, THREE.SRGBColorSpace).multiply(m.color);
      } else c.copy(m.color);
      for (let k = 0; k < 9; k += 3) {
        const a = n * 3;
        pos[a] = P[t + k] + N[t + k] * puff; pos[a + 1] = P[t + k + 1] + N[t + k + 1] * puff; pos[a + 2] = P[t + k + 2] + N[t + k + 2] * puff;
        nrm[a] = N[t + k]; nrm[a + 1] = N[t + k + 1]; nrm[a + 2] = N[t + k + 2];
        col[a] = c.r; col[a + 1] = c.g; col[a + 2] = c.b; mat[a] = isPaint; mat[a + 1] = r; mat[a + 2] = mt;
        n++;
      }
    }
    yield;
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
    if ((i & 4095) === 4095) yield;
  }
  yield;
  const target = Math.round(tris * (id === 'bus' ? 0.85 : 1)) * 3;
  let vp = null;
  if (MeshoptSimplifier.supported) {
    vp = new Float32Array(u * 3);
    for (let v = 0; v < u; v++) { const a = first[v] * 3; vp[v * 3] = pos[a]; vp[v * 3 + 1] = pos[a + 1]; vp[v * 3 + 2] = pos[a + 2]; }
  }
  return { index, vp, target, first, pos, nrm, col, mat, u };
}
export function bakeLodBack({ first, pos, nrm, col, mat, u }, idx) {
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

// The very far version (the Kaluri car park, 20 Nov: fifty cars side by side): the far version's own vertices
// with a much shorter triangle list, so it costs no memory to speak of. A car 100 m off is a few pixels high.
export function lowLod(lod, tris) {
  if (!MeshoptSimplifier.supported || !lod.index || lod.index.count <= tris * 3) return lod;
  const idx = MeshoptSimplifier.simplifySloppy(new Uint32Array(lod.index.array), lod.attributes.position.array, 3, null, tris * 3, 0.08)[0];
  if (!idx.length) return lod;
  const g = new THREE.BufferGeometry();
  for (const k of Object.keys(lod.attributes)) g.setAttribute(k, lod.attributes[k]);
  g.setIndex(new THREE.BufferAttribute(lod.attributes.position.count > 65535 ? idx : new Uint16Array(idx), 1));
  g.boundingSphere = lod.boundingSphere; g.boundingBox = lod.boundingBox;
  return g;
}
