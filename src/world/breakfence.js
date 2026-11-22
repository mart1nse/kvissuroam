// Picket fences a car can knock down (Martin, 22 Nov: first the grey picket fence on the inside of the Jakobi to
// Lai turn, then the white one in front of Veski 20 on the lap, both with a light sound of snapping wood). Each
// panel between two posts is one instance of a single InstancedMesh (one draw for the whole fence, one small
// picture): when the car's body reaches a panel it is knocked off its posts, thrown the way the car goes,
// tumbling, and lies flat where it lands. updateFences() runs every frame after the car has moved and costs
// nothing while the car is more than a few tens of metres away and nothing is flying; the damage lasts until
// the page is loaded again.
import * as THREE from 'three';
import { paintTexture } from './houseskin.js';

const fences = [];
const SNAP_GAP = 0.07;          // s: panels knocked closer together than this share one snap
const LAND_GAP = 0.05;          // s: and landings one clack

// pts: the posts along the ground ([x, z] each), a panel between each two. h: the panel's height (m).
// draw(P, panel, h): paints one panel (houseskin painter, metres from its bottom left), `panel` metres wide.
export function breakableFence(world, group, pts, { h, draw, ppm = 128, label = 'fence' }) {
  const n = pts.length - 1;
  if (n < 1) return null;
  let sum = 0;
  for (let k = 0; k < n; k++) sum += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
  const panel = sum / n;
  const tex = paintTexture(panel, 0, h, ppm, (P) => draw(P, panel, h), { alpha: true });
  const geo = new THREE.PlaneGeometry(panel, h).translate(0, h / 2, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), n);
  const panels = [], m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let cx = 0, cz = 0;
  for (let k = 0; k < n; k++) {
    const p0 = pts[k], p1 = pts[k + 1], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 0.01;
    const ux = (p1[0] - p0[0]) / l, uz = (p1[1] - p0[1]) / l, mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
    const y = Math.min(world.heightAt(p0[0], p0[1]), world.heightAt(p1[0], p1[1]));
    const yaw = Math.atan2(-uz, ux);
    const pn = { p0, p1, mx, mz, y, yaw, sx: l / panel, down: false, rest: false, pos: [mx, y, mz], v: [0, 0, 0], ang: 0, spin: 0, tilt: 0 };
    qt.setFromAxisAngle(up, yaw);
    mesh.setMatrixAt(k, m4.compose(new THREE.Vector3(mx, y, mz), qt, new THREE.Vector3(pn.sx, 1, 1)));
    panels.push(pn);
    cx += mx / n; cz += mz / n;
  }
  let reach = 0;
  for (const q of pts) reach = Math.max(reach, Math.hypot(q[0] - cx, q[1] - cz));
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  mesh.name = label;
  group.add(mesh);
  const F = { label, world, mesh, panels, at: [cx, cz], reach: reach + 12, flying: 0, snapT: -1, landT: -1, t: 0 };
  fences.push(F);
  return F;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

function tick(F, car, dt, sound) {
  F.t += dt;
  if (!F.flying && Math.hypot(car.x - F.at[0], car.z - F.at[1]) > F.reach) return;
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz, speed = Math.hypot(wvx, wvz);
  const hl = (car.halfLen || 2.2) + 0.15, hw = (car.halfWid || 0.9) + 0.15;
  const inside = (x, z) => { const dx = x - car.x, dz = z - car.z; return Math.abs(dx * fx + dz * fz) < hl && Math.abs(dx * rx + dz * rz) < hw; };
  let moved = false, knocked = 0, landed = 0;
  for (let k = 0; k < F.panels.length; k++) {
    const p = F.panels[k];
    if (!p.down) {
      if (speed < 0.8 || Math.abs((car.y ?? p.y) - p.y) > 2.5) continue;
      if (!inside(p.p0[0], p.p0[1]) && !inside(p.p1[0], p.p1[1]) && !inside(p.mx, p.mz)) continue;
      // knocked off its posts: thrown the way the car goes, tumbling
      p.down = true; F.flying++; knocked++;
      const push = 0.55 + Math.random() * 0.25;
      p.v = [wvx * push + (Math.random() - 0.5) * 1.5, 1.2 + Math.min(speed, 20) * 0.12 + Math.random(), wvz * push + (Math.random() - 0.5) * 1.5];
      p.spin = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5); p.tilt = (Math.random() - 0.5) * 0.8;
      car.hit = Math.max(car.hit || 0, Math.min(2.5, speed * 0.08));
      car.vx *= 0.985;
    }
    if (p.rest) continue;
    p.v[1] -= 9.81 * dt;
    p.pos[0] += p.v[0] * dt; p.pos[1] += p.v[1] * dt; p.pos[2] += p.v[2] * dt;
    p.ang += p.spin * dt;
    p.yaw += p.tilt * dt;
    const g = F.world.heightAt(p.pos[0], p.pos[2]) + 0.03;
    if (p.pos[1] < g) {
      if (p.v[1] < -2) landed = Math.max(landed, -p.v[1]);
      p.pos[1] = g; p.v[1] *= -0.2; p.v[0] *= 0.5; p.v[2] *= 0.5; p.spin *= 0.5;
      if (Math.abs(p.v[1]) < 0.5 && Math.hypot(p.v[0], p.v[2]) < 0.3) { p.rest = true; p.ang = Math.PI / 2 * Math.sign(Math.sin(p.ang) || 1); F.flying--; }
    }
    // turned to its heading, then tumbling round its own length
    _q.setFromAxisAngle(_up, p.yaw);
    _ax.set(1, 0, 0).applyQuaternion(_q);
    _q2.setFromAxisAngle(_ax, p.ang);
    _q2.multiply(_q);
    F.mesh.setMatrixAt(k, _m.compose(_v.set(p.pos[0], p.pos[1], p.pos[2]), _q2, _s.set(p.sx, 1, 1)));
    moved = true;
  }
  if (moved) { F.mesh.instanceMatrix.needsUpdate = true; F.mesh.frustumCulled = F.flying === 0; if (!F.flying) F.mesh.computeBoundingSphere(); }
  // the sound: a light crack of snapping wood for the panels knocked (louder the faster), a soft clack as one lands
  if (!sound || !sound.wood) return;
  if (knocked && F.t - F.snapT > SNAP_GAP) { F.snapT = F.t; sound.wood('snap', Math.min(1.3, (0.35 + speed / 22) * (1 + 0.15 * (knocked - 1)))); }
  if (landed && F.t - F.landT > LAND_GAP) { F.landT = F.t; sound.wood('land', Math.min(1, landed / 6)); }
}

// every frame after the car has moved (sound: the game's audio, for the snap; may be missing)
export function updateFences(car, dt, sound) {
  if (!car || !fences.length) return;
  dt = Math.min(dt || 0.016, 0.05);
  for (const F of fences) tick(F, car, dt, sound);
}

// (for the tools: each fence, its panels and which are down)
export function fenceInfo() {
  return fences.map((F) => ({ label: F.label, at: F.at, panels: F.panels.length, down: F.panels.filter((p) => p.down).length, flying: F.flying,
    posts: F.panels.map((p) => p.p0) }));
}
