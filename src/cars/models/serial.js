// A built car as plain data and back: the worker (worker.js) builds a car and posts it to the page,
// where it becomes the template for other players' cars (instanceCarModel in index.js). Covers what the
// car models are made of: groups and meshes, buffer geometry, standard and physical materials, and
// canvas or data textures (sent as pixels).
import * as THREE from 'three';

const SKIP = new Set(['id', 'uuid', 'version', '_listeners']);
// (by name, so that the bundle keeps only these of three.js)
const MATERIALS = { MeshStandardMaterial: THREE.MeshStandardMaterial, MeshPhysicalMaterial: THREE.MeshPhysicalMaterial, MeshBasicMaterial: THREE.MeshBasicMaterial, MeshLambertMaterial: THREE.MeshLambertMaterial };

export function serializeCar(car) {
  const geos = [], mats = [], texs = [], transfer = [];
  const gi = new Map(), mi = new Map(), ti = new Map(), ni = new Map();
  // (copies: the worker keeps some of these in caches for the next car)
  const own = (a) => { const c = a.slice(); transfer.push(c.buffer); return c; };
  const tex = (t) => {
    if (!ti.has(t)) {
      const img = t.image;
      let data;
      if (t.isDataTexture) data = own(img.data);
      else { const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; data = new Uint8Array(d.buffer); transfer.push(d.buffer); }
      const p = {};
      for (const k of ['name', 'colorSpace', 'anisotropy', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'generateMipmaps', 'flipY', 'premultiplyAlpha', 'unpackAlignment', 'rotation', 'mapping']) p[k] = t[k];
      for (const k of ['repeat', 'offset', 'center']) p[k] = [t[k].x, t[k].y];
      ti.set(t, texs.length);
      texs.push({ data, w: img.width, h: img.height, format: t.isDataTexture ? t.format : THREE.RGBAFormat, type: t.isDataTexture ? t.type : THREE.UnsignedByteType, p });
    }
    return ti.get(t);
  };
  const val = (v) => {
    if (v === null || ['number', 'boolean', 'string'].includes(typeof v)) return { v };
    if (v.isColor) return { c: [v.r, v.g, v.b] };
    if (v.isVector2) return { v2: [v.x, v.y] };
    if (v.isEuler) return { e: [v.x, v.y, v.z, v.order] };
    if (v.isTexture) return { t: tex(v) };
    if (Array.isArray(v) && v.every((x) => typeof x === 'number')) return { a: v.slice() };
    return undefined;
  };
  const mat = (m) => {
    if (!mi.has(m)) {
      const props = {};
      for (const k of Object.keys(m)) {
        if (SKIP.has(k) || typeof m[k] === 'function') continue;
        if (k === 'userData' || k === 'defines') { props[k] = { j: JSON.parse(JSON.stringify(m[k] ?? null)) }; continue; }
        const x = val(m[k]);
        if (x) props[k] = x;
      }
      mi.set(m, mats.length);
      mats.push({ type: m.type, props });
    }
    return mi.get(m);
  };
  const geo = (g) => {
    if (!gi.has(g)) {
      const attrs = {};
      for (const [k, a] of Object.entries(g.attributes)) attrs[k] = { array: own(a.array), itemSize: a.itemSize, normalized: a.normalized };
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingBox) g.computeBoundingBox();
      const s = g.boundingSphere, b = g.boundingBox;
      gi.set(g, geos.length);
      geos.push({ attrs, index: g.index ? own(g.index.array) : null, groups: g.groups.map((x) => ({ ...x })), drawRange: { ...g.drawRange },
        sphere: [s.center.x, s.center.y, s.center.z, s.radius], box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z], name: g.name });
    }
    return gi.get(g);
  };
  let n = 0;
  const node = (o) => {
    ni.set(o, n++);
    const r = o.rotation;
    const out = { type: o.isMesh ? 'Mesh' : o.isGroup ? 'Group' : 'Object3D', name: o.name, p: o.position.toArray(), r: [r.x, r.y, r.z, r.order], s: o.scale.toArray(),
      visible: o.visible, castShadow: o.castShadow, receiveShadow: o.receiveShadow, renderOrder: o.renderOrder, frustumCulled: o.frustumCulled, layers: o.layers.mask,
      userData: JSON.parse(JSON.stringify(o.userData)) };
    if (o.isMesh) { out.geo = geo(o.geometry); out.mat = Array.isArray(o.material) ? o.material.map(mat) : mat(o.material); }
    out.children = o.children.map(node);
    return out;
  };
  const root = node(car.group);
  const ref = (o) => ni.get(o);
  const data = {
    root, geos, mats, texs,
    wheels: Object.fromEntries(Object.entries(car.wheels || {}).map(([k, w]) => [k, { steer: ref(w.steer), spin: ref(w.spin) }])),
    lit: car.lit ? Object.fromEntries(Object.entries(car.lit).map(([k, m]) => [k, mat(m)])) : null,
    soot: car.soot ? { k: car.soot.k, mesh: ref(car.soot.mesh) } : null,
    fields: { wheelRadius: car.wheelRadius, wheelbase: car.wheelbase, track: car.track, size: car.size, triangles: car.triangles, lights: car.lights, glbGlow: car.glbGlow },
    glbArgs: car.glbArgs ? JSON.parse(JSON.stringify(car.glbArgs)) : null,
  };
  return { data, transfer };
}

export function deserializeCar(data) {
  const texs = data.texs.map((d) => {
    const t = new THREE.DataTexture(d.data, d.w, d.h, d.format, d.type);
    for (const [k, v] of Object.entries(d.p)) { if (Array.isArray(v)) t[k].set(v[0], v[1]); else t[k] = v; }
    t.needsUpdate = true;
    return t;
  });
  const val = (x) => {
    if ('v' in x) return x.v;
    if (x.c) return new THREE.Color().setRGB(x.c[0], x.c[1], x.c[2], THREE.LinearSRGBColorSpace);
    if (x.v2) return new THREE.Vector2(x.v2[0], x.v2[1]);
    if (x.e) return new THREE.Euler(...x.e);
    if ('t' in x) return texs[x.t];
    if (x.a) return x.a;
    if ('j' in x) return x.j;
    return undefined;
  };
  const mats = data.mats.map((d) => {
    const M = MATERIALS[d.type];
    if (!M) throw new Error(`car material ${d.type}`);
    const m = new M();
    for (const [k, x] of Object.entries(d.props)) m[k] = val(x);
    m.needsUpdate = true;
    return m;
  });
  const geos = data.geos.map((d) => {
    const g = new THREE.BufferGeometry();
    g.name = d.name;
    for (const [k, a] of Object.entries(d.attrs)) g.setAttribute(k, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
    if (d.index) g.setIndex(new THREE.BufferAttribute(d.index, 1));
    for (const x of d.groups) g.addGroup(x.start, x.count, x.materialIndex);
    g.setDrawRange(d.drawRange.start, d.drawRange.count);
    const s = d.sphere, b = d.box;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(s[0], s[1], s[2]), s[3]);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    return g;
  });
  const nodes = [];
  const node = (d) => {
    const o = d.type === 'Mesh' ? new THREE.Mesh(geos[d.geo], Array.isArray(d.mat) ? d.mat.map((i) => mats[i]) : mats[d.mat])
      : d.type === 'Group' ? new THREE.Group() : new THREE.Object3D();
    nodes.push(o);
    o.name = d.name; o.position.fromArray(d.p); o.rotation.set(...d.r); o.scale.fromArray(d.s);
    o.visible = d.visible; o.castShadow = d.castShadow; o.receiveShadow = d.receiveShadow; o.renderOrder = d.renderOrder;
    o.frustumCulled = d.frustumCulled; o.layers.mask = d.layers; o.userData = d.userData;
    for (const c of d.children) o.add(node(c));
    return o;
  };
  const group = node(data.root);
  const car = { ...data.fields, group, lights: { ...data.fields.lights } };
  car.wheels = Object.fromEntries(Object.entries(data.wheels).map(([k, w]) => [k, { steer: nodes[w.steer], spin: nodes[w.spin] }]));
  car.lit = data.lit && Object.fromEntries(Object.entries(data.lit).map(([k, i]) => [k, mats[i]]));
  if (data.soot) car.soot = { k: data.soot.k, mesh: nodes[data.soot.mesh], shell: null };
  car.glbArgs = data.glbArgs;
  return car;
}
