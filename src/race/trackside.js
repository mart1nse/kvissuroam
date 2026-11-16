// Hand-made changes around the race track, from Martin's notes and street view:
//  1. von Baeri -> Jakobi (right turn): the inside of the corner cleared of street furniture, one
//     pedestrian-crossing sign left.
//  2. Jakobi -> Lai (left turn): the inside cleared, one small sign left, and the inside kerb made a
//     10 cm mountable kerb with rounded edges.
//  3. The end of Lai at the Emajõgi: the clutter of signs and posts thinned to a few, and a low
//     plastered wall along the inside of the left turn (the botanical garden wall).
// Everything left standing can be knocked over (src/world/props.js).
import * as THREE from 'three';
import { createTrack } from './race.js';
import { findCorners } from './decor.js';

const SIGN0 = 10, ZEBRA = 7, CROSSING = SIGN0 + 7;

// special corners; every other corner of the lap gets the default treatment (inside cleared, one sign left)
const SPECIAL = {
  628: { side: 1, out: 12, keep: (k) => k === CROSSING, keepN: 1 },                      // von Baeri -> Jakobi
  920: { i0: 870, i1: 965, side: 0, out: 16, keep: (k) => k >= SIGN0, keepN: 4, spacing: 15 },   // Lai at the Emajõgi
};
function zones(track) {
  const out = [];
  for (const c of findCorners(track)) {
    const sp = SPECIAL[c.i] || {};
    out.push({ i0: c.i - 25, i1: c.i + 25, apex: c.i, side: c.dir, out: 12, keep: (k) => k >= SIGN0, keepN: 1, ...sp });
  }
  return out;
}
const KERB = { i0: 672, i1: 702, side: -1, width: 5, height: 0.1 };
const WALL = { i0: 878, i1: 934, side: -1, gap: 2.2, height: 1.0, thick: 0.45 };

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// nearest track point in [i0, i1] and the signed distance to the right of the direction of travel
function lateral(track, i0, i1, x, z) {
  let best = Infinity, bi = i0;
  for (let i = i0; i <= i1; i++) {
    const d = (track.P[i][0] - x) ** 2 + (track.P[i][1] - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  const [tx, tz] = track.tan[bi];
  return { i: bi, lat: (x - track.P[bi][0]) * -tz + (z - track.P[bi][1]) * tx, d: Math.sqrt(best) };
}

// ids ("sx_sz:n") of the props to leave out
export function clearProps(data) {
  const track = createTrack();
  const out = new Set();
  // anything standing in the road itself, anywhere on the lap
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (a[k] === ZEBRA) continue;
      const n = track.nearest(a[k + 1], a[k + 2]);
      if (n.i >= 0 && n.d < track.HW[n.i] - 0.4) out.add(`${key}:${k / data.stride}`);
    }
  }
  for (const zn of zones(track)) {
    if (zn.i0 < 0 || zn.i1 >= track.N) continue;
    const hits = [];
    for (const [key, a] of Object.entries(data.sectors)) {
      for (let k = 0; k < a.length; k += data.stride) {
        const kind = a[k], x = a[k + 1], z = a[k + 2];
        if (kind === ZEBRA) continue;
        const ax = track.P[zn.apex][0], az = track.P[zn.apex][1];
        if (Math.hypot(x - ax, z - az) > 80) continue;
        const L = lateral(track, zn.i0, zn.i1, x, z);
        if (L.i === zn.i0 || L.i === zn.i1) continue;                 // beyond the ends of the zone
        const hw = track.HW[L.i];
        const side = Math.sign(L.lat);
        if (zn.side && side !== zn.side) continue;
        if (Math.abs(L.lat) > hw + zn.out) continue;
        hits.push({ id: `${key}:${k / data.stride}`, kind, x, z, lat: Math.abs(L.lat) - hw, apex: Math.hypot(x - ax, z - az) });
      }
    }
    // keep the nearest suitable posts (to the apex, or spread along the zone), drop the rest
    const keep = [];
    const cand = hits.filter((h) => zn.keep(h.kind) && h.lat > 0.3 && h.lat < 5).sort((a, b) => a.apex - b.apex);
    for (const h of cand) {
      if (keep.length >= zn.keepN) break;
      if (zn.spacing && keep.some((q) => Math.hypot(q.x - h.x, q.z - h.z) < zn.spacing)) continue;
      keep.push(h);
    }
    for (const h of hits) if (!keep.includes(h)) out.add(h.id);
  }
  return out;
}

// a kerb-side line: offset from the centre line to one side, holding its place where it would fold back
function sideLine(track, i0, i1, side, extra) {
  const pts = [];
  let prev = null;
  for (let i = i0; i <= i1; i++) {
    const [tx, tz] = track.tan[i];
    const nx = -tz * side, nz = tx * side, o = track.HW[i] + extra;
    let p = [track.P[i][0] + nx * o, track.P[i][1] + nz * o];
    if (prev && (p[0] - prev[0]) * tx + (p[1] - prev[1]) * tz < 0.3) continue;
    pts.push(p); prev = p;
  }
  return pts;
}

// distance along the normal (positive away from the road, given which side the road is on) to a polyline
function polyDist(pts, x, z) {
  let best = Infinity, lat = 0, along = 0, total = 0, at = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (l * l)));
    const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (d < best) { best = d; lat = ((x - a[0]) * -dz + (z - a[1]) * dx) / l; at = total + t * l; }
    total += l;
  }
  along = at;
  return { d: best, lat, along, total };
}

export function createTrackside(world, scene) {
  const track = createTrack();
  const group = new THREE.Group();
  scene.add(group);

  // ---- 2. the mountable kerb: physics through world.addBump, drawn as a low rounded slab
  const kerb = sideLine(track, KERB.i0, KERB.i1, KERB.side, 0);
  // the road is on the right of the line for a left-side kerb (lat < 0 inward means away from the road)
  const inward = KERB.side < 0 ? -1 : 1;
  const kb = kerb.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
  const kerbProfile = (d, along, total) => KERB.height * smooth(d / 0.3) * smooth((KERB.width - d) / 0.5) * smooth(along / 1.5) * smooth((total - along) / 1.5);
  world.addBump({
    x0: kb[0] - KERB.width - 1, z0: kb[1] - KERB.width - 1, x1: kb[2] + KERB.width + 1, z1: kb[3] + KERB.width + 1,
    at(x, z) {
      const q = polyDist(kerb, x, z);
      const d = q.lat * inward;
      if (d <= 0 || d >= KERB.width || q.d > KERB.width + 0.1) return 0;
      return kerbProfile(d, q.along, q.total);
    },
  });

  // ---- 3. the low wall, as segments (for collisions) and boxes (to draw)
  const wallLine = sideLine(track, WALL.i0, WALL.i1, WALL.side, WALL.gap);
  const segs = [];
  for (let i = 0; i < wallLine.length - 1; i++) segs.push([wallLine[i], wallLine[i + 1]]);
  let wallSegs = null;           // the ones clear of buildings, once the ground is loaded

  let kerbMesh = null, wallMesh = null;
  function buildKerb() {
    // cross-section across the kerb, from the road edge inwards, heights from the profile
    const D = [0, 0.1, 0.2, 0.3, 0.6, KERB.width - 0.5, KERB.width - 0.25, KERB.width];
    const pos = [], idx = [];
    let total = 0;
    const along = [0];
    for (let i = 1; i < kerb.length; i++) { total += Math.hypot(kerb[i][0] - kerb[i - 1][0], kerb[i][1] - kerb[i - 1][1]); along.push(total); }
    for (let i = 0; i < kerb.length; i++) {
      const a = kerb[Math.max(0, i - 1)], b = kerb[Math.min(kerb.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const nx = (dz / l) * inward, nz = (-dx / l) * inward;     // away from the road
      for (const d of D) {
        const x = kerb[i][0] + nx * d, z = kerb[i][1] + nz * d;
        const base = world.heightAt(x, z) - kerbProfile(d, along[i], total);
        pos.push(x, base + kerbProfile(d, along[i], total) + 0.02, z);
      }
      if (i) {
        const n = D.length, r0 = (i - 1) * n, r1 = i * n;
        for (let k = 0; k < n - 1; k++) idx.push(r0 + k, r1 + k, r0 + k + 1, r0 + k + 1, r1 + k, r1 + k + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    kerbMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xbdb6c8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    kerbMesh.receiveShadow = true;
    group.add(kerbMesh);
  }

  function buildWall() {
    wallSegs = segs.filter(([a, b]) => world.sdfAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) > 0.8);
    const geos = [];
    for (const [a, b] of wallSegs) {
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const y = Math.min(world.heightAt(a[0], a[1]), world.heightAt(b[0], b[1]));
      const box = new THREE.BoxGeometry(l + WALL.thick * 0.6, WALL.height + 0.3, WALL.thick);
      box.rotateY(-Math.atan2(dz, dx));
      box.translate((a[0] + b[0]) / 2, y + (WALL.height + 0.3) / 2 - 0.3, (a[1] + b[1]) / 2);
      geos.push(box.toNonIndexed());
      const cap = new THREE.BoxGeometry(l + WALL.thick * 0.6 + 0.1, 0.1, WALL.thick + 0.12);
      cap.rotateY(-Math.atan2(dz, dx));
      cap.translate((a[0] + b[0]) / 2, y + WALL.height + 0.05, (a[1] + b[1]) / 2);
      geos.push(cap.toNonIndexed());
    }
    if (!geos.length) return;
    // merge by hand (no BufferGeometryUtils import needed for two attributes)
    let n = 0;
    for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    const plaster = new THREE.Color(0xe9b9a6), capC = new THREE.Color(0xc79888);
    geos.forEach((g, k) => {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      const c = k % 2 ? capC : plaster;
      for (let v = 0; v < g.attributes.position.count; v++) col.set([c.r, c.g, c.b], (o + v) * 3);
      o += g.attributes.position.count;
      g.dispose();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    wallMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    group.add(wallMesh);
  }

  const readyAll = (pts) => pts.every(([x, z]) => world.ready(x, z));

  return {
    update(x, z) {
      if (!kerbMesh && Math.hypot(kerb[0][0] - x, kerb[0][1] - z) < 800 && readyAll(kerb)) buildKerb();
      if (!wallMesh && wallSegs === null && Math.hypot(wallLine[0][0] - x, wallLine[0][1] - z) < 800 && readyAll(wallLine)) buildWall();
    },
    // keep the car out of the wall
    collide(car) {
      if (!wallSegs || !wallSegs.length) return;
      const w0 = wallLine[0];
      if (Math.abs(car.x - w0[0]) > 160 || Math.abs(car.z - w0[1]) > 160) return;
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
      const hl = car.halfLen, hw = car.halfWid, half = WALL.thick / 2;
      for (let k = 0; k < 10; k++) {
        const lx = k < 4 ? (k < 2 ? hl : -hl) : k < 6 ? 0 : k < 8 ? (k === 6 ? hl : -hl) : (k === 8 ? hl * 0.5 : -hl * 0.5);
        const ly = k < 4 ? (k % 2 ? hw : -hw) : k < 6 ? (k === 4 ? hw : -hw) : k < 8 ? 0 : (k === 8 ? hw : -hw);
        const px = car.x + fx * lx + rx * ly, pz = car.z + fz * lx + rz * ly;
        for (const [a, b] of wallSegs) {
          const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
          const cx = a[0] + dx * t, cz = a[1] + dz * t;
          const ox = px - cx, oz = pz - cz, d = Math.hypot(ox, oz);
          if (d >= half || d < 1e-6) continue;
          const nx = ox / d, nz = oz / d, pen = half - d;
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
