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
          metalness: 1, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.08,
        });
        s.dispose();
      }
      return meshes;
    }));
  }
  return cache.get(url);
}

const linerMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1, metalness: 0, side: THREE.DoubleSide });
// tail: emissive intensity with { brake, tail (headlights on) }
export function useGlbBody(car, file, { tail = 0.3, brake = 2, liner = { r: 0.43, len: 0.4, inset: 0.22 } } = {}) {
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
    // dark wheel wells: the scan has no arch liners, so without these you would see through the car
    // only the arch above the axle (a bit past horizontal): a full tube would show below the sills
    const lg = new THREE.CylinderGeometry(liner.r, liner.r, liner.len, 20, 1, true, -0.3, Math.PI + 0.6);
    lg.rotateZ(Math.PI / 2);
    const wg = new THREE.CircleGeometry(liner.r, 20, -0.3, Math.PI + 0.6); wg.rotateY(Math.PI / 2);
    for (const w of Object.values(car.wheels)) {
      const p = w.steer.position, m = new THREE.Mesh(lg, linerMat);
      m.position.set(p.x - Math.sign(p.x) * liner.inset, p.y, p.z);
      car.group.add(m);
      // and a dark wall behind each wheel, so nothing shows through between tyre and bodywork
      const wall = new THREE.Mesh(wg, linerMat);
      wall.position.set(p.x - Math.sign(p.x) * (liner.inset + liner.len / 2), p.y, p.z);
      car.group.add(wall);
    }
  }).catch((e) => console.warn('glb body', file, e));
  return car;
}
