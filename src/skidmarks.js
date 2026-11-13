// Tyre marks: a ring buffer of flat quads laid on the ground behind each wheel
// while its axle is sliding. The oldest marks are overwritten by the newest.
import * as THREE from 'three';

const MAX = 3000;          // quads kept (about 900 m of marks)
const STEP = 0.3;          // metres between ribbon points
const WIDTH = 0.19;
const LIFT = 0.035;        // above the ground, with polygon offset on top

export function createSkidMarks(world) {
  const pos = new Float32Array(MAX * 4 * 3);
  const col = new Float32Array(MAX * 4 * 4);
  const idx = new Uint16Array(MAX * 6);
  for (let q = 0; q < MAX; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], q * 6);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aCol = new THREE.BufferAttribute(col, 4);
  aPos.setUsage(THREE.DynamicDrawUsage); aCol.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('color', aCol);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  let next = 0;
  // per wheel: last ribbon point (centre and its two edges) and whether a strip is open
  const wheels = [0, 1, 2, 3].map(() => ({ on: false, x: 0, z: 0, lx: 0, ly: 0, lz: 0, rx: 0, ry: 0, rz: 0, a: 0 }));

  function quad(w, lx, ly, lz, rx, ry, rz, a, paved) {
    const o = next * 12, c = next * 16;
    pos[o] = w.lx; pos[o + 1] = w.ly; pos[o + 2] = w.lz;
    pos[o + 3] = w.rx; pos[o + 4] = w.ry; pos[o + 5] = w.rz;
    pos[o + 6] = lx; pos[o + 7] = ly; pos[o + 8] = lz;
    pos[o + 9] = rx; pos[o + 10] = ry; pos[o + 11] = rz;
    // black rubber on paving, a darker rut in grass and gravel
    const r = paved ? 0.03 : 0.1, g = paved ? 0.03 : 0.075, b = paved ? 0.04 : 0.05;
    for (let v = 0; v < 4; v++) {
      col[c + v * 4] = r; col[c + v * 4 + 1] = g; col[c + v * 4 + 2] = b;
      col[c + v * 4 + 3] = v < 2 ? w.a : a;
    }
    next = (next + 1) % MAX;
    aPos.needsUpdate = true; aCol.needsUpdate = true;
  }

  function update(car) {
    const live = !car.inWater;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const ht = car.spec.track / 2;
    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      const front = i < 2;
      const k = live ? (front ? car.skidF : car.skidR) || 0 : 0;
      if (k < 0.08) { w.on = false; continue; }
      const along = front ? car.a : -car.b, side = i % 2 ? ht : -ht;
      const x = car.x + fx * along + sx * side, z = car.z + fz * along + sz * side;
      const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
      if (w.on && d < STEP) continue;
      const surf = world.surfaceAt(x, z);
      if (surf === 4) { w.on = false; continue; }
      const paved = surf === 1;
      const a = (paved ? 0.62 : 0.3) * Math.min(1, k * 1.4);
      const y = world.heightAt(x, z) + LIFT;
      // edge points across the direction of travel (across the car when starting a strip)
      let px = sx, pz = sz;
      if (w.on && d < 3) { px = -dz / d; pz = dx / d; }
      const hw = WIDTH / 2;
      const lx = x - px * hw, lz = z - pz * hw, rx = x + px * hw, rz = z + pz * hw;
      if (w.on && d < 3) quad(w, lx, y, lz, rx, y, rz, a, paved);
      w.on = true; w.x = x; w.z = z; w.a = a;
      w.lx = lx; w.ly = y; w.lz = lz; w.rx = rx; w.ry = y; w.rz = rz;
    }
  }

  return { mesh, update, get count() { return next; } };
}
