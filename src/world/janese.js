// Jänese tänav, by the fence past number 1: a dark grey 2012 BMW 320d Touring (F31) parked on the verge,
// and next to it a power rack where a man is doing barbell squats.
// The BMW is a shell, not a car: drive into it and it is shoved along (a flat rigid body with its
// handbrake on, scrubbing to a stop). The rack is bolted down. Where the BMW ends up is remembered for
// the browser session, like knocked-over street furniture (props.js).
import * as THREE from 'three';
import { buildCarModel } from '../cars/models/index.js';
import { buildRack, buildLifter } from './squatter.js';

// road centre line 1955.2,1472.2 -> 2026.2,1533.2 (7.6 m wide), heading south-east
const DIR = [0.758, 0.652], RIGHT = [-0.652, 0.758], ROAD = [1955.2, 1472.2];
const along = (s, o) => [ROAD[0] + DIR[0] * s + RIGHT[0] * o, ROAD[1] + DIR[1] * s + RIGHT[1] * o];
const HEADING = Math.atan2(DIR[0], -DIR[1]);         // yaw: forward = (sin yaw, -cos yaw)
const [BX, BZ] = along(30, 4.5);
const [RX, RZ] = along(22.4, 5.9);
const HOME = { x: BX, z: BZ, yaw: HEADING };
const RACK_YAW = HEADING - Math.PI / 2;               // he faces the road
// its footprint for collisions: the rack and the plate tree on its right (local x from -1.15 to 2.2)
const RACK = { x: RX + Math.cos(RACK_YAW) * 0.52, z: RZ + Math.sin(RACK_YAW) * 0.52, yaw: RACK_YAW, hl: 0.78, hw: 1.68 };
const KEY = 'streetlap.janese';

const MASS = 1580, HL = 2.33, HW = 0.92, WB = 2.81, TR = 1.56;
const INERTIA = MASS * ((2 * HL) ** 2 + (2 * HW) ** 2) / 12;
const MU_G = 4.2;                                      // handbrake on, in gear: scrubs to a stop at about 0.43 g
const SPIN_DECEL = 3.0;                                // rad/s^2 of scrub when it is twisted round

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

export function createJanese(scene, world, opts = {}) {
  const bmw = { ...HOME, hl: HL, hw: HW, vx: 0, vz: 0, w: 0, moving: false };
  try { const s = JSON.parse(sessionStorage.getItem(KEY)); if (s && Number.isFinite(s.x)) Object.assign(bmw, { x: s.x, z: s.z, yaw: s.yaw }); } catch { /* none */ }

  const model = buildCarModel('f31');
  model.setLights({ headlights: false });
  const carG = model.group;
  carG.visible = false;
  scene.add(carG);
  const rack = buildRack(), man = buildLifter();
  const gym = new THREE.Group();
  gym.add(rack, man.group);
  gym.visible = false;
  gym.rotation.y = -RACK_YAW;
  scene.add(gym);
  for (const g of [carG, gym]) g.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.castShadow = !!opts.shadows; o.receiveShadow = true; } });

  const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  let placed = false, saveIn = 0;
  // sit the shell on the ground under its four wheels
  function setPose() {
    const [fx, fz, rx, rz] = axes(bmw.yaw);
    const h = (l, t) => world.heightAt(bmw.x + fx * l + rx * t, bmw.z + fz * l + rz * t);
    const fl = h(WB / 2, -TR / 2), fr = h(WB / 2, TR / 2), rl = h(-WB / 2, -TR / 2), rr = h(-WB / 2, TR / 2);
    const y = (fl + fr + rl + rr) / 4;
    const pitch = Math.atan2((fl + fr - rl - rr) / 2, WB), roll = Math.atan2((fr + rr - fl - rl) / 2, TR);
    // normal from the slopes along the car (forward) and across it (right)
    nrm.set(0, 1, 0)
      .addScaledVector(new THREE.Vector3(fx, 0, fz), -Math.tan(pitch))
      .addScaledVector(new THREE.Vector3(rx, 0, rz), -Math.tan(roll)).normalize();
    qYaw.setFromAxisAngle(up, -bmw.yaw);
    qTilt.setFromUnitVectors(up, nrm);
    carG.quaternion.copy(qTilt).multiply(qYaw);
    carG.position.set(bmw.x, y, bmw.z);
  }
  function place() {
    if (placed || !world.ready(BX, BZ) || !world.ready(RX, RZ)) return;
    placed = true;
    setPose();
    carG.visible = true;
    gym.position.set(RX, world.heightAt(RX, RZ), RZ);
    gym.visible = true;
  }

  // the player's car (as a box) against the BMW: share the overlap by mass and swap momentum
  const E = 0.15;
  function hitBmw(car, cb) {
    const o = overlap(cb, bmw);
    if (!o) return;
    const M = car.spec.mass || 1500;
    const [fx, fz, rx, rz] = axes(car.yaw);
    car.x += o.nx * o.pen * MASS / (M + MASS); car.z += o.nz * o.pen * MASS / (M + MASS);
    bmw.x -= o.nx * o.pen * M / (M + MASS); bmw.z -= o.nz * o.pen * M / (M + MASS);
    const [px, pz] = contact(cb, bmw);
    const rbx = px - bmw.x, rbz = pz - bmw.z;
    const cvx = car.vx * fx + car.vy * rx, cvz = car.vx * fz + car.vy * rz;
    const bvx = bmw.vx - bmw.w * rbz, bvz = bmw.vz + bmw.w * rbx;      // BMW's velocity at the contact
    const vrel = (cvx - bvx) * o.nx + (cvz - bvz) * o.nz;
    bmw.moving = true;
    if (vrel >= 0) return;
    const lever = -rbz * o.nx + rbx * o.nz;                           // perp(r) . n
    const j = -(1 + E) * vrel / (1 / M + 1 / MASS + lever * lever / INERTIA);
    const nvx = cvx + j * o.nx / M, nvz = cvz + j * o.nz / M;
    car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
    bmw.vx -= j * o.nx / MASS; bmw.vz -= j * o.nz / MASS;
    bmw.w -= lever * j / INERTIA;
    // a glancing knock turns the player's car a little, as against another player
    const dx = car.x - bmw.x, dz = car.z - bmw.z;
    car.yawRate += Math.max(-1.2, Math.min(1.2, -(o.nx * rx + o.nz * rz) * (dx * fx + dz * fz) * j / M * 0.25));
    car.hit = Math.max(car.hit, j / M);
  }
  // a box against the bolted-down rack: pushed straight out, the speed into it bounced off
  function offRack(b, vel) {
    const o = overlap(b, RACK);
    if (!o) return;
    b.x += o.nx * o.pen; b.z += o.nz * o.pen;
    const vn = vel[0] * o.nx + vel[1] * o.nz;
    if (vn < 0) { vel[0] -= 1.3 * vn * o.nx; vel[1] -= 1.3 * vn * o.nz; }
    return vn;
  }
  const grad = [0, 0];
  function stepBmw(dt) {
    bmw.x += bmw.vx * dt; bmw.z += bmw.vz * dt; bmw.yaw += bmw.w * dt;
    // tyres scrubbing: a steady friction deceleration of the slide and of the spin
    const sp = Math.hypot(bmw.vx, bmw.vz);
    const k = sp > 1e-6 ? Math.max(0, sp - MU_G * dt) / sp : 0;
    bmw.vx *= k; bmw.vz *= k;
    bmw.w = Math.sign(bmw.w) * Math.max(0, Math.abs(bmw.w) - SPIN_DECEL * dt);
    // buildings, walls and the map edge: keep each corner out, stop the motion into them
    const [fx, fz, rx, rz] = axes(bmw.yaw);
    for (const [l, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1]]) {
      const px = bmw.x + fx * HL * l + rx * HW * t, pz = bmw.z + fz * HL * l + rz * HW * t;
      const d = world.sdfAt(px, pz);
      if (d >= 0) continue;
      world.sdfGrad(px, pz, grad);
      bmw.x -= grad[0] * d; bmw.z -= grad[1] * d;
      const vn = bmw.vx * grad[0] + bmw.vz * grad[1];
      if (vn < 0) { bmw.vx -= 1.2 * vn * grad[0]; bmw.vz -= 1.2 * vn * grad[1]; bmw.w *= 0.5; }
    }
    const v = [bmw.vx, bmw.vz];
    if (offRack(bmw, v) < 0) { bmw.vx = v[0]; bmw.vz = v[1]; bmw.w *= 0.5; }
    if (sp < 0.02 && Math.abs(bmw.w) < 0.02) {
      bmw.vx = bmw.vz = bmw.w = 0; bmw.moving = false;
      saveIn = 0.3;
    }
  }

  function update(car, dt) {
    place();
    if (!placed) return;
    const dx = car.x - BX, dz = car.z - BZ, far = dx * dx + dz * dz > 350 * 350;
    if (!far) man.update(dt);
    if (far && !bmw.moving) return;
    const cb = { x: car.x, z: car.z, yaw: car.yaw, hl: car.halfLen, hw: car.halfWid };
    if (Math.abs(car.y - carG.position.y) < 2.5) {
      hitBmw(car, cb);
      cb.x = car.x; cb.z = car.z;
      const [fx, fz, rx, rz] = axes(car.yaw);
      const v = [car.vx * fx + car.vy * rx, car.vx * fz + car.vy * rz];
      const vn = offRack(cb, v);
      if (vn !== undefined) {
        car.x = cb.x; car.z = cb.z;
        if (vn < 0) { car.vx = v[0] * fx + v[1] * fz; car.vy = v[0] * rx + v[1] * rz; car.yawRate *= 0.6; car.hit = Math.max(car.hit, -vn); }
      }
    }
    if (bmw.moving) {
      const sub = 2;
      for (let i = 0; i < sub; i++) stepBmw(dt / sub);
      setPose();
    }
    if (saveIn > 0 && (saveIn -= dt) <= 0) {
      try { sessionStorage.setItem(KEY, JSON.stringify({ x: +bmw.x.toFixed(2), z: +bmw.z.toFixed(2), yaw: +bmw.yaw.toFixed(4) })); } catch { /* private mode */ }
    }
  }
  return { update, bmw, man, home: HOME, rack: RACK };
}
