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
          metalness: s.metalness, roughness: s.roughness, clearcoat: 0.5, clearcoatRoughness: 0.08,
        });
        s.dispose();
      }
      return meshes;
    }));
  }
  return cache.get(url);
}

const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
function archLiner(meshes, p, { r, len, inset, steps = 28 }, rMin) {
  const probe = meshes.map((m) => new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const sx = Math.sign(p.x), x0 = p.x - sx * inset, x1 = x0 - sx * len;
  const a0 = -0.35, a1 = Math.PI + 0.35, rad = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * i / steps;
    _d.set(0, Math.sin(a), -Math.cos(a));
    let best = r;
    for (let k = 0; k <= 4; k++) { const x = x0 + (x1 - x0) * k / 4;
      _ray.set(_o.set(x, p.y, p.z), _d); _ray.far = r + 0.02;
      const hit = _ray.intersectObjects(probe, false)[0];
      if (hit) best = Math.min(best, hit.distance - 0.012);
    }
    rad.push(Math.max(best, rMin));   // hits inside that are scan bits in the arch, not bodywork
  }
  for (const m of probe) m.material.dispose();
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
  return new THREE.Mesh(g, linerMat);
}
const linerMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1, metalness: 0, side: THREE.DoubleSide });
// tail: emissive intensity with { brake, tail (headlights on) }
export function useGlbBody(car, file, { tail = 0.3, brake = 2, liner = { r: 0.5, len: 0.42, inset: 0.12 } } = {}) {
  if (typeof window === 'undefined') return car;
  const state = { brake: false, headlights: false };
  let mat = null;
  const glow = () => { if (mat) mat.emissiveIntensity = state.brake ? brake : state.headlights ? tail : 0; };
  const setLights = car.setLights;
  car.setLights = (o = {}) => { Object.assign(state, o); setLights(o); glow(); };
  load(`${import.meta.env.BASE_URL}models/${file}`).then((meshes) => {
    if (!meshes.length) return;
    const keep = new Set(Object.values(car.wheels).map((w) => w.steer));
    for (const o of car.group.children) if (!keep.has(o)) o.visible = false;
    for (const src of meshes) {
      const lit = !!src.material.emissiveMap;
      const m = new THREE.Mesh(src.geometry, lit ? src.material.clone() : src.material);
      if (lit) mat = m.material;
      m.name = `${car.group.name}_glb`; m.castShadow = true; m.receiveShadow = true;
      car.group.add(m);
      car.triangles = (car.triangles || 0) + src.geometry.index.count / 3;
    }
    glow();
    // dark wheel wells: the scan has no arch liners, so without these you would see through the car.
    // Each liner is shaped to the arch: rays from the hub find the bodywork, so it never pokes through.
    if (liner) for (const w of Object.values(car.wheels)) car.group.add(archLiner(meshes, w.steer.position, liner, w.steer.position.y + 0.035));
  }).catch((e) => console.warn('glb body', file, e));
  return car;
}
