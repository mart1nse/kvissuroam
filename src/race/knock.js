// Things by the Raadi stage that a car knocks over and breaks (Martin 24 Nov 2026: "i would like to make the
// signs screen and camera also kickable / breakable"): the signs on their posts, the start clock on its frame and
// the start line camera on its tripod. Each is a few meshes standing in the stage's group; a car that touches one
// sends it flying with the car's speed and a tumble, and the faster it was going the likelier the thing comes
// apart (the board off its post, the clock off its frame, the camera off its tripod, the battery box away). The
// pieces tumble on the ground and come to rest; a car can kick them again. reset() stands everything up again
// (a new run). Nothing is built or compiled when it happens: the meshes only move.
import * as THREE from 'three';
import { stats } from '../stats.js';

const G = 9.81, BOUNCE = 0.25, MU = 0.6;
const t3 = new THREE.Vector3(), v3 = new THREE.Vector3(), r3 = new THREE.Vector3(), w3 = new THREE.Vector3(), q3 = new THREE.Quaternion(), box = new THREE.Box3();

export function createKnocks({ world, group }) {
  const items = [], bodies = [];
  let clock = 0;
  const groundY = (x, z) => world.heightAt(x, z);

  // item: { x, z, reach, parts: [{ objs: [Object3D], mass }] }; the parts are what it breaks into
  function add(it) {
    for (const p of it.parts) p.home = p.objs.map((o) => ({ o, parent: o.parent, pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone() }));
    it.down = false;
    if (it.y == null) it.y = groundY(it.x, it.z);
    items.push(it);
  }

  // a body: a pivot at the middle of its meshes' box, the meshes hung on it, the box's corners for the ground
  function body(parts) {
    box.makeEmpty();
    for (const p of parts) for (const o of p.objs) { o.updateWorldMatrix(true, true); box.expandByObject(o); }
    const piv = new THREE.Object3D();
    box.getCenter(piv.position);
    group.add(piv);
    piv.updateMatrixWorld(true);
    for (const p of parts) for (const o of p.objs) piv.attach(o);
    const s = box.getSize(new THREE.Vector3()).multiplyScalar(0.5), mass = parts.reduce((a, p) => a + p.mass, 0);
    const corners = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) corners.push(new THREE.Vector3(a * s.x, b * s.y, c * s.z));
    // turning inertia of a box this size (one number: the pieces are long and thin, that is near enough)
    const I = mass * (s.x * s.x + s.y * s.y + s.z * s.z) * 4 / 12 + 0.05;
    const b = { piv, parts, mass, I, corners, v: new THREE.Vector3(), w: new THREE.Vector3(), rest: 0, sleep: false, hitT: clock };
    bodies.push(b);
    return b;
  }

  // the car's velocity in the world, and its sides
  function kick(b, car, speed, fx, fz, rx, rz, extra) {
    const vx = car.vx * fx + car.vy * rx, vz = car.vx * fz + car.vy * rz;
    const p = b.piv.position, side = Math.sign((p.x - car.x) * rx + (p.z - car.z) * rz) || (Math.random() < 0.5 ? -1 : 1);
    const k = 1.05 + Math.random() * 0.3 + extra;
    b.v.set(vx * k + rx * side * speed * 0.15, Math.min(4, 0.8 + speed * 0.12) * (0.7 + Math.random() * 0.6), vz * k + rz * side * speed * 0.15);
    // a tumble over the axis across the push, some spin about the upright
    v3.set(vz, 0, -vx).normalize().multiplyScalar(-(1.5 + speed * 0.25) * (0.7 + Math.random() * 0.6));
    b.w.copy(v3).add(w3.set(0, (Math.random() - 0.5) * speed * 0.3, 0));
    b.sleep = false; b.rest = 0;
  }

  function hitItem(it, car, speed, fx, fz, rx, rz) {
    it.down = true;
    // (it comes apart more often the faster the car: from one in five at a crawl to nearly always at 60 km/h)
    const apart = it.parts.length > 1 && Math.random() < Math.min(0.95, Math.max(0.2, (speed - 3) / 14));
    const made = apart ? it.parts.map((p) => body([p])) : [body(it.parts)];
    made.forEach((b, n) => kick(b, car, speed, fx, fz, rx, rz, n * 0.08));
    stats.smash('prop');
    return made.reduce((a, b) => a + b.mass, 0);
  }

  function step(b, dt) {
    const p = b.piv.position, q = b.piv.quaternion;
    b.v.y -= G * dt;
    p.addScaledVector(b.v, dt);
    const wl = b.w.length();
    if (wl > 1e-4) { q3.setFromAxisAngle(w3.copy(b.w).divideScalar(wl), wl * dt); q.premultiply(q3).normalize(); }
    // the ground under each corner: push out of it, bounce a little, rub along it
    let touched = false;
    for (const c of b.corners) {
      r3.copy(c).applyQuaternion(q);
      const cx = p.x + r3.x, cy = p.y + r3.y, cz = p.z + r3.z, gy = groundY(cx, cz), dep = gy - cy;
      if (dep <= 0) continue;
      touched = true;
      p.y += dep;
      // the corner's speed: the body's plus the turn's
      v3.copy(b.w).cross(r3).add(b.v);
      if (v3.y < 0) {
        const rn = w3.set(0, 1, 0).cross(r3);             // r x n
        const j = -(1 + BOUNCE) * v3.y / (1 / b.mass + rn.lengthSq() / b.I);
        b.v.y += j / b.mass;
        b.w.addScaledVector(t3.copy(r3).cross(w3.set(0, j, 0)), 1 / b.I);
        // friction: along the ground, up to MU of the push
        const tx = v3.x, tz = v3.z, tl = Math.hypot(tx, tz);
        if (tl > 1e-3) {
          const jt = Math.min(MU * j, tl / (1 / b.mass + r3.lengthSq() / b.I));
          w3.set(-tx / tl * jt, 0, -tz / tl * jt);
          b.v.addScaledVector(w3, 1 / b.mass);
          b.w.addScaledVector(t3.copy(r3).cross(w3), 1 / b.I);
        }
      }
    }
    if (touched) {
      // (grass and gravel hold it: slow things settle quickly, nothing rocks on for ever)
      const slow = b.v.lengthSq() < 2.25;
      const k = Math.exp(-dt * (slow ? 8 : 3));
      b.v.x *= k; b.v.z *= k; b.w.multiplyScalar(Math.exp(-dt * (slow ? 8 : 2.5)));
      b.rest = b.v.lengthSq() < 0.09 && b.w.lengthSq() < 0.25 ? b.rest + dt : 0;
      if (b.rest > 0.4) { b.sleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); }
    }
  }

  function update(car, dt) {
    if (!items.length || !car) return;
    clock += dt;
    dt = Math.min(dt || 0.016, 0.05);
    const speed = Math.hypot(car.vx, car.vy);
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const touches = (px, py, pz, reach) => {
      const dx = px - car.x, dz = pz - car.z;
      if (dx * dx + dz * dz > 49 || Math.abs(py - car.y) > 3) return false;
      return Math.abs(dx * fx + dz * fz) < car.halfLen + reach && Math.abs(dx * rx + dz * rz) < car.halfWid + reach;
    };
    let took = 0;
    if (speed > 1) {
      for (const it of items) if (!it.down && touches(it.x, it.y, it.z, it.reach)) took += hitItem(it, car, speed, fx, fz, rx, rz) * speed;
      for (const b of bodies) {
        if (clock - b.hitT < 0.6) continue;
        const p = b.piv.position;
        if (!touches(p.x, p.y, p.z, 0.25)) continue;
        b.hitT = clock;
        // (a piece already down is pushed along ahead of the car, or flicked aside, and only lifted a little)
        const vx = car.vx * fx + car.vy * rx, vz = car.vx * fz + car.vy * rz, side = Math.sign((p.x - car.x) * rx + (p.z - car.z) * rz) || 1;
        const along = b.v.x * fx + b.v.z * fz, want = speed * (1.05 + Math.random() * 0.15);
        if (along >= want) continue;
        b.v.set(vx * want / speed + rx * side * speed * 0.3, Math.max(b.v.y, 0.6 + Math.random()), vz * want / speed + rz * side * speed * 0.3);
        b.w.add(w3.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
        b.sleep = false; b.rest = 0;
        took += b.mass * (want - along) * 0.5;
      }
    }
    if (took > 0) {
      // (light things: the car hardly feels them, a knock and a few hundredths of its speed)
      const M = car.spec?.mass || 1300, k = Math.max(0.9, 1 - took / speed / M * 0.6);
      car.vx *= k; car.vy *= k;
      car.hit = Math.max(car.hit || 0, Math.min(2, took / M * 4));
    }
    for (const b of bodies) if (!b.sleep) { step(b, dt / 2); step(b, dt / 2); }
  }

  // everything back up where it stood
  function reset() {
    for (const b of bodies) group.remove(b.piv);
    bodies.length = 0;
    for (const it of items) {
      if (!it.down) continue;
      it.down = false;
      for (const p of it.parts) for (const h of p.home) { h.parent.add(h.o); h.o.position.copy(h.pos); h.o.quaternion.copy(h.quat); h.o.scale.copy(h.scale); }
    }
  }

  return { add, update, reset, items, bodies };
}
