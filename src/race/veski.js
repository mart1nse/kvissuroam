// Veski from the Näituse crossing to Kuperjanovi (Martin, 16 Nov), left to right in the direction of
// the lap: pavement, grass strip, a narrow reddish lane, the car lane, pavement. The grass strip is a
// raised kerb (trackside.js KERBS), the red lane a coloured band on the road, and the dashed line moves
// over to the edge of the car lane. A low wooden fence round the inside of the left turn onto
// Kuperjanovi stops the car cutting across the corner.
import * as THREE from 'three';
import { createTrack } from './race.js';

export const VESKI = { i0: 1655, i1: 1810, red: [0.15, 1.9], dash: -1.9 };     // red: from the left road edge inwards
const FENCE = { i0: 1806, i1: 1842, off: 1.6, height: 0.85, colour: 0xb39d8c, post: 0x988376 };
// the Veski centre lines of this stretch in vectors.json (start points)
const VESKI_ROADS = [[694.0, 2974.3], [760.8, 3107.9], [789.3, 3164.6]];

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// before the road markings are built: the dashed line of Veski sits between the car lane and the red lane
export function veskiRoads(vectors) {
  for (const r of vectors.roads) {
    if (r.name !== 'Veski tänav' || !r.pts.length) continue;
    if (VESKI_ROADS.some(([x, z]) => Math.hypot(r.pts[0][0] - x, r.pts[0][1] - z) < 0.5)) r.mark = VESKI.dash;
  }
}

function edgePoint(track, i, side, off) {
  const k = ((i % track.N) + track.N) % track.N;
  const [tx, tz] = track.tan[k], o = track.HW[k] + off;
  return [track.P[k][0] - tz * side * o, track.P[k][1] + tx * side * o];
}

export function createVeski(world, group, merged) {
  const track = createTrack();

  // ---- the red lane: a band along the left edge of the road
  let lane = null;
  function buildLane() {
    const pos = [], idx = [];
    const n = VESKI.i1 - VESKI.i0 + 1;
    for (let j = 0; j < n; j++) {
      const i = VESKI.i0 + j;
      const fade = smooth(j / 4) * smooth((n - 1 - j) / 4);
      const [a, b] = VESKI.red;
      for (const d of [a, a + (b - a) * fade]) {
        const [x, z] = edgePoint(track, i, -1, -d);
        pos.push(x, world.heightAt(x, z) + 0.035, z);
      }
      if (j) { const q = (j - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    lane = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x957d82, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    lane.receiveShadow = true;
    group.add(lane);
  }

  // ---- the fence round the inside of the corner
  const fence = [];
  for (let i = FENCE.i0; i <= FENCE.i1; i++) {
    const p = edgePoint(track, i, -1, FENCE.off);
    const q = fence[fence.length - 1];
    if (q) {
      const [tx, tz] = track.tan[i];
      if ((p[0] - q[0]) * tx + (p[1] - q[1]) * tz < 0.4) continue;
    }
    fence.push(p);
  }
  // round off the corner of the offset line
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 1; k < fence.length - 1; k++) {
      fence[k] = [(fence[k - 1][0] + 2 * fence[k][0] + fence[k + 1][0]) / 4, (fence[k - 1][1] + 2 * fence[k][1] + fence[k + 1][1]) / 4];
    }
  }
  let fenceSegs = null, fenceMesh = null;
  function buildFence() {
    fenceSegs = [];
    const parts = [];
    for (let k = 0; k < fence.length - 1; k++) {
      const a = fence[k], b = fence[k + 1];
      if (world.sdfAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) < 0.6) continue;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const y = Math.min(world.heightAt(a[0], a[1]), world.heightAt(b[0], b[1]));
      // vertical boards in one panel, a top rail and a post at each end
      const panel = new THREE.BoxGeometry(l + 0.02, FENCE.height - 0.08, 0.05);
      panel.rotateY(-Math.atan2(dz, dx));
      panel.translate((a[0] + b[0]) / 2, y + (FENCE.height - 0.08) / 2 + 0.04, (a[1] + b[1]) / 2);
      parts.push([panel, FENCE.colour]);
      const rail = new THREE.BoxGeometry(l + 0.04, 0.06, 0.1);
      rail.rotateY(-Math.atan2(dz, dx));
      rail.translate((a[0] + b[0]) / 2, y + FENCE.height, (a[1] + b[1]) / 2);
      parts.push([rail, FENCE.post]);
      const post = new THREE.BoxGeometry(0.1, FENCE.height + 0.1, 0.1);
      post.translate(a[0], y + (FENCE.height + 0.1) / 2, a[1]);
      parts.push([post, FENCE.post]);
      fenceSegs.push([a, b]);
    }
    fenceMesh = merged(parts);
    if (fenceMesh) { fenceMesh.castShadow = fenceMesh.receiveShadow = true; group.add(fenceMesh); }
  }

  const near = (x, z, p) => Math.hypot(p[0] - x, p[1] - z) < 700;
  const laneRef = edgePoint(track, VESKI.i0, -1, 0);
  return {
    update(x, z) {
      if (!lane && near(x, z, laneRef)) {
        let ok = true;
        for (let i = VESKI.i0; i <= VESKI.i1 && ok; i += 6) ok = world.ready(...track.P[i]);
        if (ok) buildLane();
      }
      if (!fenceSegs && near(x, z, fence[0]) && fence.every((p) => world.ready(p[0], p[1]))) buildFence();
    },
    // the fence is thin and solid, from either side
    collide(car) {
      if (!fenceSegs || !fenceSegs.length || Math.hypot(car.x - fence[0][0], car.z - fence[0][1]) > 150) return;
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
      const hl = car.halfLen, hw = car.halfWid, half = 0.1;
      for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw], [hl, 0], [-hl, 0], [hl * 0.5, hw], [hl * 0.5, -hw]]) {
        const px = car.x + fx * lx + rx * ly, pz = car.z + fz * lx + rz * ly;
        for (const [a, b] of fenceSegs) {
          const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
          if (t <= 0 || t >= 1) continue;
          // one-sided: the road is on the side of the track centre line, push back to that side
          const l = Math.sqrt(l2), mx = dz / l, mz = -dx / l;
          const n = track.nearest((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
          const cs = (track.P[n.i][0] - a[0]) * mx + (track.P[n.i][1] - a[1]) * mz > 0 ? 1 : -1;
          const side = ((px - a[0]) * mx + (pz - a[1]) * mz) * cs;
          if (side >= half || side < -1.5) continue;
          const nx = mx * cs, nz = mz * cs, pen = half - side;
          car.x += nx * pen; car.z += nz * pen;
          const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
          const vn = wvx * nx + wvz * nz;
          if (vn < 0) {
            const nvx = wvx - 1.25 * vn * nx, nvz = wvz - 1.25 * vn * nz;
            car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
            car.yawRate *= 0.6;
            car.hit = Math.max(car.hit, -vn);
          }
        }
      }
    },
  };
}
