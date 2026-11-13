import * as THREE from 'three';

// Simple stand-in used only if a detailed model fails to build.
export function buildPlaceholder(spec) {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.25, metalness: 0.6, clearcoat: 1 });
  const L = spec.wheelbase + 1.7, W = spec.track + 0.25, r = spec.wheelRadius;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, L), paint);
  body.position.y = r + 0.35;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.5, L * 0.5), paint);
  cabin.position.set(0, r + 0.9, 0.2);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff0020, emissiveIntensity: 0.6 });
  const lamps = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.12, 0.05), lampMat);
  lamps.position.set(0, r + 0.45, L / 2);
  group.add(body, cabin, lamps);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 });
  const wheels = {};
  for (const [k, sx, sz] of [['fl', -1, -1], ['fr', 1, -1], ['rl', -1, 1], ['rr', 1, 1]]) {
    const steer = new THREE.Object3D();
    steer.position.set((sx * spec.track) / 2, r, (sz * spec.wheelbase) / 2);
    const spin = new THREE.Object3D();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 18), tyre);
    m.rotation.z = Math.PI / 2;
    spin.add(m); steer.add(spin); group.add(steer);
    wheels[k] = { steer, spin };
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    group, wheels, wheelRadius: r, wheelbase: spec.wheelbase, track: spec.track,
    size: { length: L, width: W, height: r + 1.15 },
    setLights({ brake }) { lampMat.emissiveIntensity = brake ? 3 : 0.6; },
  };
}
