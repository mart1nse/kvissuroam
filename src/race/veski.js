// Veski from the Näituse crossing to Kuperjanovi (Martin, 16 Nov), left to right in the direction of
// the lap: pavement, grass strip, a narrow reddish lane, the car lane, pavement. The red lane is a
// coloured band on the road with a line of long dashes between it and the car lane. From the Juhan Liivi
// junction to the end (Martin, 18 Nov, his numbered street view) the rest is laid here as well: the
// kerbed strip of grass beyond the left edge of the road, the tarmac pavement behind it and the pavement
// on the right; before Juhan Liivi the houses stand at the edge of the road and the strip is a plain
// raised kerb (trackside.js KERBS). A low wooden fence round the inside of the left turn onto
// Kuperjanovi stops the car cutting across the corner.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { streetKit } from '../world/streetkit.js';
import { islandOuter, ISLAND_END } from './veskiend.js';
import { drapeGeometry } from '../world/drape.js';
import { jobs } from '../jobs.js';
import { crashHit } from '../cars/crash.js';

export const VESKI = { i0: 1655, i1: 1823, red: [0.15, 1.9], colour: 0xa27c7e };     // red: from the left road edge inwards; it runs out into the junction
const LINE = { i0: 1657.5, i1: 1820.6, dash: 1.65, gap: 0.8, at: [1.9, 2.05] };       // dashes in track points (about 1.8 m each)
// the grass strip beyond the left edge: a mountable kerb, narrow past the houses, wider along the green
// (towards the junction it is a planted bed, a little narrower where the fence comes in, with a rounded end)
const STRIP = { i0: 1730, i1: 1819.8, height: 0.09, edge: 0.18, back: 0.12, wide: [1756, 1764], narrow: [1811, 1818, 0.3], nose: 1.3 };
const LEFT = { i0: 1730, i1: 1821 };                                                 // the pavement, out to the board fence
const RIGHT = { runs: [[1730, 1753.5], [1760.5, ISLAND_END + 1.5]], width: 2.2, island: [1793, 1797.5] };   // it passes behind the island
// the orange board fence round the green (Martin, 18 Nov): it carries on from the fence along the street
// (veskiend.js, 3.4 m off) and comes in to 1.6 m for the inside of the corner
// the bicycle and the arrow painted in the red lane before the junction; the lane is ridden against the lap
const SYMBOL = { bike: 1817.2, arrow: 1815.3, at: 1.02, size: 0.82, long: 1.5, line: 0.09 };
const FENCE = { i0: 1805, i1: 1842, off: [1806, 1818, 3.4, 1.6], height: 1.15, colour: 0xd98a68, post: 0xbd7254 };

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const fenceOff = (t) => FENCE.off[2] + (FENCE.off[3] - FENCE.off[2]) * ramp(t, FENCE.off[0], FENCE.off[1]);
const stripWidth = (t) => (t <= STRIP.i0 || t >= STRIP.i1 ? 0
  : (0.9 + 0.5 * ramp(t, ...STRIP.wide) - STRIP.narrow[2] * ramp(t, STRIP.narrow[0], STRIP.narrow[1])) * ramp(t, STRIP.i0, STRIP.i0 + 1.2) * Math.sqrt(1 - ramp(t, STRIP.i1 - STRIP.nose, STRIP.i1)));

// before the road markings are built: this stretch paints its own line, between the car lane and the red lane
export function veskiRoads(vectors) {
  const track = createTrack(), prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const n = track.nearest(x, z);
    return (n.i >= VESKI.i0 - 1 && n.i <= VESKI.i1 + 1 && n.d < 3.2) || (prev ? prev(x, z) : false);
  };
}

function edgePoint(track, i, side, off) {
  const k = ((i % track.N) + track.N) % track.N;
  const [tx, tz] = track.tan[k], o = track.HW[k] + off;
  return [track.P[k][0] - tz * side * o, track.P[k][1] + tx * side * o];
}

export function createVeski(world, group, merged, { shadows = true } = {}) {
  const track = createTrack();
  // a point at a fractional track index, `lat` metres to the right of the centre line
  const hwAt = (t) => { const k = Math.floor(t); return track.HW[k] + (track.HW[k + 1] - track.HW[k]) * (t - k); };
  const at = (t, lat) => {
    const k = Math.floor(t), f = t - k, a = track.P[k], b = track.P[k + 1], [tx, tz] = track.tan[k];
    return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
  };
  const left = (d) => ({ at: (t, u) => at(t, -(hwAt(t) + d(t, u))) });       // d: metres beyond the left edge of the road
  const right = (d) => ({ at: (t, u) => at(t, hwAt(t) + d(t, u)) });

  // ---- the grass strip is a low kerb the car can mount
  {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = Math.floor(STRIP.i0); i <= Math.ceil(STRIP.i1); i++) {
      const p = at(i, -hwAt(i));
      x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]);
    }
    const hint = Math.round((STRIP.i0 + STRIP.i1) / 2);
    world.addBump({
      x0: x0 - 3, z0: z0 - 3, x1: x1 + 3, z1: z1 + 3,
      at(x, z) {
        const n = track.nearest(x, z, hint), t = n.i + n.t;
        if (n.i < 0 || t <= STRIP.i0 || t >= STRIP.i1) return 0;
        const [tx, tz] = track.tan[n.i], P = track.P[n.i];
        const d = (x - P[0]) * tz - (z - P[1]) * tx - track.HW[n.i], w = stripWidth(t);
        if (d <= 0 || d >= w) return 0;
        return STRIP.height * smooth(d / STRIP.edge) * smooth((w - d) / STRIP.back);
      },
    });
  }

  // ---- from Juhan Liivi to the end: kerb stones, grass, pavements, and the line of the whole stretch
  let street = false;
  function* buildStreet() {
    street = true;
    const K = streetKit(world, group, { shadows });
    // 2 the grass strip: kerb stones on the face towards the road, grass on top and down the back
    const top = (t) => Math.max(0.16, stripWidth(t) - STRIP.back);
    K.ribbon(left((t, u) => -0.03 + u * (Math.min(0.13, stripWidth(t)) + 0.03)), STRIP.i0, STRIP.i1, 0, 1, 'kerb', true);
    K.ribbon(left((t, u) => Math.min(stripWidth(t), 0.13 + u * (top(t) - 0.13))), STRIP.i0, STRIP.i1, 0, 1, 'verge', true);
    K.ribbon(left((t, u) => Math.min(stripWidth(t), top(t) + u * STRIP.back)), STRIP.i0, STRIP.i1, 0, 1, 'verge', true);
    yield;
    // 1 the pavement behind it, out to the houses and then the board fence
    const outer = (t) => fenceOff(t) - 0.1;
    for (let b = 0; b < 5; b++) K.ribbon(left((t, u) => stripWidth(t) + u * (outer(t) - stripWidth(t))), LEFT.i0, LEFT.i1, b / 5, (b + 1) / 5, 'asphalt');
    yield;
    // 5 the pavement on the right, with its kerb; it swings out behind the island at the end
    const out = (t) => (islandOuter(t) - 0.1) * ramp(t, RIGHT.island[0], RIGHT.island[1]);
    for (const [a, b] of RIGHT.runs) {
      K.ribbon(right((t, u) => -0.03 + u * 0.17), a, Math.min(b, RIGHT.island[0] + 1), 0, 1, 'kerb');
      for (let k = 0; k < 4; k++) K.ribbon(right((t, u) => 0.14 + out(t) + u * (RIGHT.width - 0.14)), a, b, k / 4, (k + 1) / 4, 'asphalt');
    }
    yield;
    // the line between the red lane and the car lane: long dashes, short gaps
    const line = left((t, u) => -(LINE.at[0] + u * (LINE.at[1] - LINE.at[0])));
    for (let t = LINE.i0; t + LINE.dash <= LINE.i1; t += LINE.dash + LINE.gap) K.ribbon(line, t, t + LINE.dash, 0, 1, 'white', true);
    yield;
    // the bicycle and the arrow in the red lane, drawn the way a rider coming from the junction reads them:
    // picture x across the lane to the rider's right, picture y along the lane ahead of the rider
    {
      const shapes = [], S = SYMBOL;
      const frame = (t) => {
        const k = Math.floor(t), [tx, tz] = track.tan[k], c = at(t, -(hwAt(t) - S.at));
        return (x, y) => [c[0] + tz * x * S.size - tx * y * S.size * S.long, c[1] - tx * x * S.size - tz * y * S.size * S.long];
      };
      const lineOf = (pts, w) => {
        for (let k = 0; k < pts.length - 1; k++) {
          const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = Math.hypot(bx - ax, bz - az);
          if (l < 1e-3) continue;
          const nx = (-(bz - az) / l) * w / 2, nz = ((bx - ax) / l) * w / 2;
          shapes.push([[[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]]]);
        }
      };
      const pt = frame(S.bike);
      const wheel = (cx) => { const q = []; for (let k = 0; k <= 16; k++) q.push(pt(cx + Math.cos(k / 16 * 6.283) * 0.3, Math.sin(k / 16 * 6.283) * 0.3)); return q; };
      lineOf(wheel(-0.5), S.line); lineOf(wheel(0.5), S.line);
      lineOf([pt(-0.5, 0), pt(-0.1, 0.42), pt(0.38, 0.42), pt(0.5, 0)], S.line);
      lineOf([pt(-0.5, 0), pt(0, 0), pt(0.38, 0.42)], S.line);
      lineOf([pt(0, 0), pt(-0.16, 0.55)], S.line); lineOf([pt(-0.27, 0.56), pt(-0.04, 0.56)], S.line);
      lineOf([pt(0.38, 0.42), pt(0.33, 0.62), pt(0.46, 0.64)], S.line);
      const ar = frame(S.arrow);
      shapes.push([[ar(-0.06, -0.55), ar(0.06, -0.55), ar(0.06, 0.25), ar(-0.06, 0.25)]]);
      shapes.push([[ar(-0.24, 0.2), ar(0.24, 0.2), ar(0, 0.62)]]);
      const g = drapeGeometry(world, shapes, 0.085, 1, 1.5);
      if (g) {
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xf6f3fa, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
        m.receiveShadow = true;
        group.add(m);
      }
    }
    yield;
    // weeds and a few low shrubs in the grass towards the end, where it grows wild, and the planted bed at
    // the junction: shrubs, dark red perennials and a mass of pale blue-green grass at its end (not solid)
    if (K.leafy.ok) {
      let seed = 23;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const spot = (t, d) => { const q = at(t, -(hwAt(t) + d)); return [q[0], world.heightAt(q[0], q[1]), q[1]]; };
      const PALE = [1.7, 1.5, 3.2], RED = [1.75, 0.24, 0.95];
      for (let k = 0; k < 84; k++) {
        const t = 1776 + Math.pow(rnd(), 0.7) * 43, w = stripWidth(t);
        if (w < 0.5) continue;
        const [x, y, z] = spot(t, 0.3 + rnd() * (w - 0.5)), big = k % 9 === 0, s = big ? 0.6 + rnd() * 0.3 : 0.26 + rnd() * 0.26, d = 0.9 + rnd() * 0.22;
        K.leafy.bush(x, y - 0.03, z, s, big ? 0.5 + rnd() * 0.3 : 0.28 + rnd() * 0.4, rnd() * 6.3, big ? [d * 0.9, d, d * 0.84] : [d * 1.08, d * 1.1, d * 0.66], s);
      }
      for (let k = 0; k < 22; k++) {
        const t = 1806.5 + k * 0.58 + (rnd() - 0.5) * 0.3, w = stripWidth(t);
        if (w < 0.6) continue;
        const [x, y, z] = spot(t, 0.4 + rnd() * (w - 0.7)), d = 0.86 + rnd() * 0.2, s = 0.7 + rnd() * 0.45;
        if (t > 1814.5 || k % 5 === 4) K.leafy.bush(x, y - 0.05, z, s * 1.15, 0.5 + rnd() * 0.25, rnd() * 6.3, PALE.map((c) => c * (0.92 + rnd() * 0.16)), s * 1.15);
        else K.leafy.bush(x, y - 0.06, z, s, 0.6 + rnd() * 0.5, rnd() * 6.3, [d * 0.92, d, d * 0.84], s);
      }
      for (let k = 0; k < 8; k++) {
        const t = 1806 + rnd() * 9, w = stripWidth(t);
        for (let j = 0; j < 3; j++) {
          const [x, y, z] = spot(t + (rnd() - 0.5) * 0.25, 0.3 + rnd() * (w - 0.6));
          K.leafy.bush(x, y - 0.02, z, 0.15 + rnd() * 0.08, 0.4 + rnd() * 0.28, rnd() * 6.3, RED, 0.15);
        }
      }
    }
    yield;
    K.finish();
  }

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
    lane = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: VESKI.colour, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    lane.receiveShadow = true;
    group.add(lane);
  }

  // ---- the fence round the inside of the corner
  const fence = [];
  for (let i = FENCE.i0; i <= FENCE.i1; i++) {
    const p = edgePoint(track, i, -1, fenceOff(i));
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
      if (!street && near(x, z, laneRef)) {
        let ok = true;
        for (let i = VESKI.i0; i <= LEFT.i1 && ok; i += 3) ok = world.ready(...at(i, -hwAt(i) - 3)) && world.ready(...at(i, hwAt(i) + 4));
        if (ok) { street = true; jobs.add(buildStreet, 'veski street'); }
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
            crashHit(car, nx, nz, wvx, wvz);          // (fast and square: onto its roof, cars/crash.js)
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
