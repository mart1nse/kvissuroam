// Vallikraavi (Martin, 16 Nov): the entry from Küüni and its first right corner
//   - the Wilde and Vilde statue (two men on a bench, on stepped granite) by the brick corner house
//   - the red no-entry and no-stopping signs on the right at the entry
//   - at the right corner: a stone wall with a flight of steps rising along the house front, so the
//     road meets a wall instead of the sharp edge of the house
import * as THREE from 'three';
import { createTrack } from './race.js';

const SIGN0 = 10, PROHIBIT = SIGN0 + 1, NO_ENTRY = SIGN0 + 2;
const ENTRY_SIGN = 47;                       // lap index of the signs, right side
const STATUE = { near: 33, side: -1, minSdf: 2.4, maxSdf: 3.6 };      // by the corner house, left of the entry
const STEPS = { i0: 94, i1: 118, side: 1, off: 0.25, depth: 1.7, flight: [95, 104], rise: 0.17, top: 1.25 };
const STONE = 0x8a7764, GRANITE = 0x9b8f8c, BRONZE = 0x4a3a2c, RAIL = 0x9aa0a8;

const bearing = (dx, dz) => (Math.atan2(dx, -dz) * 180) / Math.PI;

function edgePoint(track, i, side, off) {
  const k = ((i % track.N) + track.N) % track.N;
  const [tx, tz] = track.tan[k], o = track.HW[k] + off;
  return [track.P[k][0] - tz * side * o, track.P[k][1] + tx * side * o];
}

export function valliProps() {
  const track = createTrack();
  const back = bearing(-track.tan[ENTRY_SIGN][0], -track.tan[ENTRY_SIGN][1]);
  const a = edgePoint(track, ENTRY_SIGN, 1, 0.7), b = edgePoint(track, ENTRY_SIGN + 1, 1, 0.7);
  return [[NO_ENTRY, a[0], a[1], back], [PROHIBIT, b[0], b[1], back]];
}

export function createValli(world, group, merged) {
  const track = createTrack();
  const solids = [];             // [a, b, half thickness] segments the car bumps into
  const circles = [];            // {x, z, r}
  let statue = null, steps = null;

  function buildStatue() {
    // a spot about 3 m off the corner house, off the road, nearest the entry corner
    const ref = edgePoint(track, STATUE.near, STATUE.side, 0);
    let best = null, bd = Infinity;
    for (let dx = -16; dx <= 16; dx += 0.5) {
      for (let dz = -16; dz <= 16; dz += 0.5) {
        const x = ref[0] + dx, z = ref[1] + dz, sd = world.sdfAt(x, z);
        if (sd < STATUE.minSdf || sd > STATUE.maxSdf) continue;
        const n = track.nearest(x, z);
        if (n.i >= 0 && n.d < track.HW[n.i] + 2.2) continue;
        const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = [x, z]; }
      }
    }
    if (!best) { statue = new THREE.Group(); return; }
    const [x, z] = best;
    // face away from the house: down the gradient of the distance field
    const e = 0.5, gx = world.sdfAt(x + e, z) - world.sdfAt(x - e, z), gz = world.sdfAt(x, z + e) - world.sdfAt(x, z - e);
    const yaw = Math.atan2(gx, gz);
    const y = world.heightAt(x, z);
    const parts = [];
    const put = (g, lx, ly, lz, c) => {          // local: x across, z forward (away from the house)
      g.rotateY(yaw);
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      g.translate(x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs);
      parts.push([g, c]);
    };
    // three granite steps, widest at the bottom
    put(new THREE.BoxGeometry(4.2, 0.16, 3.0), 0, 0.08, 0.3, GRANITE);
    put(new THREE.BoxGeometry(3.6, 0.16, 2.4), 0, 0.24, 0.1, GRANITE);
    put(new THREE.BoxGeometry(3.0, 0.16, 1.8), 0, 0.4, -0.1, GRANITE);
    // the bench between them and the two seated men facing each other across it
    put(new THREE.BoxGeometry(0.9, 0.08, 0.45), 0, 0.82, -0.3, BRONZE);
    put(new THREE.BoxGeometry(0.08, 0.34, 0.4), -0.4, 0.65, -0.3, BRONZE);
    put(new THREE.BoxGeometry(0.08, 0.34, 0.4), 0.4, 0.65, -0.3, BRONZE);
    for (const s of [-1, 1]) {
      const sx = s * 0.75;
      put(new THREE.BoxGeometry(0.42, 0.45, 0.42), sx, 0.71, -0.3, BRONZE);               // seat block
      put(new THREE.BoxGeometry(0.36, 0.62, 0.26), sx, 1.24, -0.38, BRONZE);              // torso
      put(new THREE.BoxGeometry(0.4, 0.16, 0.24), sx - s * 0.22, 0.98, -0.25, BRONZE);    // thighs, towards the bench
      put(new THREE.BoxGeometry(0.14, 0.48, 0.14), sx - s * 0.38, 0.72, -0.2, BRONZE);    // shins
      const head = new THREE.IcosahedronGeometry(0.13, 1);
      put(head, sx, 1.68, -0.38, BRONZE);
      put(new THREE.CylinderGeometry(0.15, 0.16, 0.06, 10), sx, 1.82, -0.38, BRONZE);    // hat brim
    }
    // the lamp post behind them
    put(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), 0, 1.68, -1.1, BRONZE);
    put(new THREE.BoxGeometry(0.2, 0.3, 0.2), 0, 2.95, -1.1, 0x2e2a26);
    statue = merged(parts);
    statue.castShadow = statue.receiveShadow = true;
    group.add(statue);
    circles.push({ x, z, r: 1.3 });
  }

  // ---- steps and stone wall on the right of the first right corner
  const front = [];
  for (let i = STEPS.i0; i <= STEPS.i1; i++) {
    const p = edgePoint(track, i, STEPS.side, STEPS.off);
    if (front.length) {
      const q = front[front.length - 1];
      const [tx, tz] = track.tan[i];
      if ((p[0] - q.x) * tx + (p[1] - q.z) * tz < 0.3) continue;
    }
    const [tx, tz] = track.tan[i];
    front.push({ x: p[0], z: p[1], i, nx: -tz * STEPS.side, nz: tx * STEPS.side });       // n: away from the road
  }
  function buildSteps() {
    const parts = [];
    const [f0, f1] = STEPS.flight;
    const ground = (x, z) => world.heightAt(x, z);
    for (let k = 0; k < front.length - 1; k++) {
      const a = front[k], b = front[k + 1];
      // how far back the wall reaches: to the house, at most `depth`
      let depth = STEPS.depth;
      for (let d = 0.3; d < STEPS.depth; d += 0.1) if (world.sdfAt(a.x + a.nx * d, a.z + a.nz * d) < 0.05) { depth = d + 0.15; break; }
      const t = (a.i - f0) / (f1 - f0);
      const h = a.i < f0 ? 0.18 : a.i > f1 ? STEPS.top : Math.max(0.18, Math.ceil(t * (STEPS.top / STEPS.rise)) * STEPS.rise);
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
      const y = Math.min(ground(a.x, a.z), ground(b.x, b.z));
      const nx = (a.nx + b.nx) / 2, nz = (a.nz + b.nz) / 2;
      const cx = mx + nx * depth / 2, cz = mz + nz * depth / 2;
      const box = new THREE.BoxGeometry(l + 0.04, h + 0.3, depth);
      box.rotateY(-Math.atan2(dz, dx));
      box.translate(cx, y - 0.3 + (h + 0.3) / 2, cz);
      parts.push([box, a.i >= f0 && a.i <= f1 ? GRANITE : STONE]);
      // a coping stone on the wall part, a hand rail up the flight
      if (a.i > f1) {
        const cap = new THREE.BoxGeometry(l + 0.04, 0.08, 0.5);
        cap.rotateY(-Math.atan2(dz, dx));
        cap.translate(mx + nx * 0.22, y + h + 0.04, mz + nz * 0.22);
        parts.push([cap, 0xa59a8e]);
      }
      if (a.i >= f0 - 1) {
        const ry = y + h + 0.9;
        const rail = new THREE.BoxGeometry(l + 0.02, 0.05, 0.05);
        rail.rotateY(-Math.atan2(dz, dx));
        rail.translate(mx + nx * 0.12, ry, mz + nz * 0.12);
        parts.push([rail, RAIL]);
        if (k % 3 === 0) {
          const post = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6);
          post.translate(a.x + a.nx * 0.12, y + h + 0.45, a.z + a.nz * 0.12);
          parts.push([post, RAIL]);
        }
      }
      if (h > 0.3) solids.push([[a.x, a.z], [b.x, b.z], 0.12]);
    }
    steps = merged(parts);
    if (steps) { steps.castShadow = steps.receiveShadow = true; group.add(steps); }
  }

  const near = (x, z, px, pz) => Math.hypot(px - x, pz - z) < 700;
  const statueRef = edgePoint(track, STATUE.near, STATUE.side, 0);
  return {
    update(x, z) {
      if (!statue && near(x, z, ...statueRef) && world.ready(...statueRef)) buildStatue();
      if (!steps && near(x, z, front[0].x, front[0].z) && front.every((p) => world.ready(p.x, p.z))) buildSteps();
    },
    collide(car, pushOutOfCircles) {
      if (Math.hypot(car.x - front[0].x, car.z - front[0].z) > 200) return;
      if (circles.length) pushOutOfCircles(car, circles, circles[0].r);
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
      const hl = car.halfLen, hw = car.halfWid;
      for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw], [hl, 0], [-hl, 0]]) {
        const px = car.x + fx * lx + rx * ly, pz = car.z + fz * lx + rz * ly;
        for (const [a, b, half] of solids) {
          const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
          const ox = px - (a[0] + dx * t), oz = pz - (a[1] + dz * t), d = Math.hypot(ox, oz);
          // the wall's road face: push back towards the road side only
          const l = Math.sqrt(l2), nx = dz / l, nz = -dx / l;
          const side = ox * nx + oz * nz;
          if (d > half + 1.2 || t <= 0 || t >= 1) continue;
          // which side is the road: the side the track centre is on
          const n = track.nearest(a[0], a[1]);
          const cs = (track.P[n.i][0] - a[0]) * nx + (track.P[n.i][1] - a[1]) * nz > 0 ? 1 : -1;
          const pen = half - side * cs;
          if (pen <= 0 || pen > 1.4) continue;
          car.x += nx * cs * pen; car.z += nz * cs * pen;
          const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
          const vn = wvx * nx * cs + wvz * nz * cs;
          if (vn < 0) {
            const nvx = wvx - 1.25 * vn * nx * cs, nvz = wvz - 1.25 * vn * nz * cs;
            car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
            car.yawRate *= 0.6;
            car.hit = Math.max(car.hit, -vn);
          }
        }
      }
    },
  };
}
