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
      let mesh = null;
      g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      return mesh;
    }));
  }
  return cache.get(url);
}

const linerMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1, metalness: 0, side: THREE.DoubleSide });
// tail: emissive intensity with { brake, tail (headlights on) }
export function useGlbBody(car, file, { tail = 0.3, brake = 2, liner = { r: 0.4, len: 0.3, inset: 0.27 } } = {}) {
  if (typeof window === 'undefined') return car;
  const state = { brake: false, headlights: false };
  let mat = null;
  const glow = () => { if (mat) mat.emissiveIntensity = state.brake ? brake : state.headlights ? tail : 0; };
  const setLights = car.setLights;
  car.setLights = (o = {}) => { Object.assign(state, o); setLights(o); glow(); };
  load(`${import.meta.env.BASE_URL}models/${file}`).then((src) => {
    if (!src) return;
    mat = src.material.clone();
    mat.emissive = new THREE.Color(0xffffff);
    glow();
    const body = new THREE.Mesh(src.geometry, mat);
    body.name = `${car.group.name}_glb`; body.castShadow = true; body.receiveShadow = true;
    const keep = new Set(Object.values(car.wheels).map((w) => w.steer));
    for (const o of car.group.children) if (!keep.has(o)) o.visible = false;
    car.group.add(body);
    // dark wheel wells: the scan has no arch liners, so without these you would see through the car
    const lg = new THREE.CylinderGeometry(liner.r, liner.r, liner.len, 20, 1, true);
    lg.rotateZ(Math.PI / 2);
    for (const w of Object.values(car.wheels)) {
      const p = w.steer.position, m = new THREE.Mesh(lg, linerMat);
      m.position.set(p.x - Math.sign(p.x) * liner.inset, p.y, p.z);
      car.group.add(m);
    }
    car.triangles = (car.triangles || 0) + src.geometry.index.count / 3;
  }).catch((e) => console.warn('glb body', file, e));
  return car;
}
