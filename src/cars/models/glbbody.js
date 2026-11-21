// Swaps a procedural car body for a scanned GLB body once the file has loaded.
// The procedural car is shown until then (and stays if loading fails), and its wheels are kept:
// the GLB has its wheels cut out and is already in game axes (metres, front -z, ground y = 0).
// The GLB's emissive texture holds the tail lamps; they follow setLights like the procedural lamps.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map();
function load(url) {
  if (!cache.has(url)) {
    cache.set(url, new GLTFLoader().loadAsync(url).then((g) => {
      const meshes = [];
      g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
      // the textured body gets a clear coat like the procedural paint; the glass keeps its own material
      for (const m of meshes) {
        if (!m.material.map) continue;
        const s = m.material;
        m.material = new THREE.MeshPhysicalMaterial({
          map: s.map, metalnessMap: s.metalnessMap, roughnessMap: s.roughnessMap, normalMap: s.normalMap,
          emissiveMap: s.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0,
          metalness: s.metalness, roughness: s.roughness, clearcoat: s.name.startsWith('ov_') ? 0 : 0.5, clearcoatRoughness: 0.08, side: s.side,
          alphaTest: s.alphaTest, name: s.name, specularIntensity: s.name.startsWith('ov_') ? 0.15 : 1,   // matt plates: sky glare greys the lettering
          // plates and badges are flat quads a few mm proud of the body: keep them from z-fighting at a distance
          polygonOffset: s.name.startsWith('ov_'), polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        });
        s.dispose();
      }
      // These pictures belong to every car of this kind (the player's, parked ones, other players') and stay
      // in this cache: when the player changes car they are freed from the graphics card (freeModel in
      // main.js) and sent again from their image when this car is next drawn. So on phones and in light
      // mode the picture shrinker (phonetex.js) must not swap their image for its small stand-in, or the
      // body comes back as a smear of the scan's 256 px pieces (Martin, 2026-11-21).
      for (const m of meshes) for (const v of Object.values(m.material)) if (v?.isTexture) v.userData.keepImage = true;
      return meshes;
    }));
  }
  return cache.get(url);
}

// Only the scan's triangles near this arch can stop a ray (rays start on the hub axis and reach r + 0.02),
// so the rays are tested against those alone, double sided like the old THREE.Raycaster probe: the same
// liner as before in a few milliseconds instead of a second or more (it froze the game when another
// player in one of these cars came online).
function archTris(meshes, p, x0, x1, reach) {
  const lo = [Math.min(x0, x1), p.y - reach, p.z - reach], hi = [Math.max(x0, x1), p.y + reach, p.z + reach];
  const out = [];
  for (const m of meshes) {
    const P = m.geometry.attributes.position.array, I = m.geometry.index?.array;
    const n = I ? I.length : P.length / 3;
    for (let t = 0; t < n; t += 3) {
      const a = (I ? I[t] : t) * 3, b = (I ? I[t + 1] : t + 1) * 3, c = (I ? I[t + 2] : t + 2) * 3;
      let skip = false;
      for (let k = 0; k < 3 && !skip; k++) {
        const va = P[a + k], vb = P[b + k], vc = P[c + k];
        if (Math.max(va, vb, vc) < lo[k] || Math.min(va, vb, vc) > hi[k]) skip = true;
      }
      if (!skip) out.push(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
    }
  }
  return out;
}
// nearest hit distance along d from o within far (either face), or Infinity
function nearestHit(T, ox, oy, oz, dx, dy, dz, far) {
  let best = Infinity;
  for (let i = 0; i < T.length; i += 9) {
    const e1x = T[i + 3] - T[i], e1y = T[i + 4] - T[i + 1], e1z = T[i + 5] - T[i + 2];
    const e2x = T[i + 6] - T[i], e2y = T[i + 7] - T[i + 1], e2z = T[i + 8] - T[i + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tx = ox - T[i], ty = oy - T[i + 1], tz = oz - T[i + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t >= 0 && t <= far && t < best) best = t;
  }
  return best;
}
// a liner's shape depends only on the scan, the hub and the options: worked out once per car type
const liners = new Map();
function archLiner(meshes, p, opts, rMin) {
  const key = `${meshes[0]?.geometry.uuid}|${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}|${JSON.stringify(opts)}|${rMin.toFixed(4)}`;
  let geo = liners.get(key);
  if (!geo) liners.set(key, (geo = archLinerGeometry(meshes, p, opts, rMin)));
  return new THREE.Mesh(geo, linerMat);
}
function archLinerGeometry(meshes, p, { r, len, inset, steps = 28 }, rMin) {
  const sx = Math.sign(p.x), x0 = p.x - sx * inset, x1 = x0 - sx * len;
  const a0 = -0.35, a1 = Math.PI + 0.35, rad = [];
  const far = r + 0.02, T = archTris(meshes, p, x0, x1, far);
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * i / steps;
    const dy = Math.sin(a), dz = -Math.cos(a);
    let best = r;
    for (let k = 0; k <= 4; k++) { const x = x0 + (x1 - x0) * k / 4;
      const hit = nearestHit(T, x, p.y, p.z, 0, dy, dz, far);
      if (hit < Infinity) best = Math.min(best, hit - 0.012);
    }
    rad.push(Math.max(best, rMin));   // hits inside that are scan bits in the arch, not bodywork
  }
  // a ray that slipped through a vent or gap in the scan must not push the liner out through the panel
  const raw = rad.slice();
  for (let i = 0; i <= steps; i++) rad[i] = Math.min(...raw.slice(Math.max(0, i - 2), i + 3));
  // tube strip (x0..x1) plus an end wall at x1, both following rad[]
  const pos = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * i / steps, y = Math.sin(a) * rad[i], z = -Math.cos(a) * rad[i];
    pos.push(x0, p.y + y, p.z + z, x1, p.y + y, p.z + z);
  }
  for (let i = 0; i < steps; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const c = pos.length / 3; pos.push(x1, p.y, p.z);
  for (let i = 0; i < steps; i++) idx.push(c, i * 2 + 1, i * 2 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const linerMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1, metalness: 0, side: THREE.DoubleSide });
// tail: emissive intensity with { brake, tail (headlights on) }
// wheelOut: { front, rear } metres to push the visible wheels outward to sit flush with the scanned arches
// lower: metres to drop the scanned body (and its arch liners) relative to the wheels
// onLoad(meshes, car): called once the scanned body is on the car (for extras shaped to it); a name in
// glbHooks, so that a car built in the worker (worker.js) can have its scan put on in the page
export const glbHooks = {};
export function useGlbBody(car, file, opts = {}) {
  // (no page here, in the worker or in node: the page puts the scan on, see deserializeCar)
  if (typeof window === 'undefined') { car.glbArgs = { file, opts }; return car; }
  const { tail = 0.3, brake = 2, liner = { r: 0.5, len: 0.42, inset: 0.12, gap: 0.035 }, wheelOut = null, lower = 0 } = opts;
  const onLoad = typeof opts.onLoad === 'string' ? glbHooks[opts.onLoad] : opts.onLoad;
  // (setLights is applyLights in kit.js: it lights car.lit.glb, set below, with these intensities)
  car.glbGlow = { tail, brake };
  // resolves once the scanned body is on (or failed to load): instanceCarModel copies the car again then
  car.ready = load(`${import.meta.env.BASE_URL}models/${file}`).then((meshes) => {
    if (!meshes.length) return;
    if (wheelOut) for (const [k, w] of Object.entries(car.wheels)) w.steer.position.x += Math.sign(w.steer.position.x) * (k[0] === 'f' ? wheelOut.front : wheelOut.rear);
    const keep = new Set(Object.values(car.wheels).map((w) => w.steer));
    for (const o of car.group.children) if (!keep.has(o)) o.visible = false;
    car.glbLoaded = true;
    for (const src of meshes) {
      const lit = !!src.material.emissiveMap;
      const m = new THREE.Mesh(src.geometry, lit ? src.material.clone() : src.material);
      if (lit) car.lit.glb = m.material;
      m.name = `${car.group.name}_glb`; m.position.y = -lower; m.castShadow = true; m.receiveShadow = true;
      car.group.add(m);
      car.triangles = (car.triangles || 0) + src.geometry.index.count / 3;
    }
    car.setLights();
    onLoad?.(meshes, car);
    // dark wheel wells: the scan has no arch liners, so without these you would see through the car.
    // Each liner is shaped to the arch: rays from the hub find the bodywork, so it never pokes through.
    if (liner) for (const w of Object.values(car.wheels)) {
      const p = w.steer.position.clone(); p.y += lower;
      const l = archLiner(meshes, p, liner, p.y + (liner.gap ?? 0.035)); l.position.y = -lower;
      car.group.add(l);
    }
  }).catch((e) => console.warn('glb body', file, e));
  return car;
}
