// Hand-made details at two corners of the lap (Martin, 16 Nov):
//   Jakobi -> Lai: two traffic islands with keep-right signs, the bush moved against the house corner
//   Emajõe -> Kroonuaia: the inside pavement corner rounded, a low barrier along it that the car can
//   drive through with a jolt, and the bench on the right taken away
import * as THREE from 'three';
import { createTrack, ROUND } from './race.js';

const SIGN0 = 10, KEEP_RIGHT = SIGN0 + 13, BENCH = 3;
const KROON = 1035;
const LINE = { from: 1029.6, to: 1052 };      // the white edge line round the Kroonuaia corner: after the crossing, on up Kroonuaia
// raised islands down the middle of the road: i0, i1 along the lap, half-width, lateral offset (+ right)
const ISLANDS = [
  { i0: 675, i1: 681, hw: 0.75, off: 0 },        // Jakobi, before the Lai junction
  { i0: 693, i1: 698, hw: 0.7, off: 0 },         // the mouth of Lai
];
const ISLAND = { height: 0.12, edge: 0.1, top: 0xaea7b2, kerb: 0xd0ccd6 };
// street furniture to take away: [kind, x, z]
const REMOVE = [[BENCH, 1338.3, 2185.9]];          // the bench on the right before Kroonuaia
const BARRIER = { off: 0.5, height: 0.32, width: 1.4, ramp: 0.35, rail: 0.52 };      // wide enough that one side of the car rides up on it (Martin, 17 Nov: more tilt; 20 Nov: a tad lower)

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const bearing = (dx, dz) => (Math.atan2(dx, -dz) * 180) / Math.PI;

// the rounded inside kerb at a corner, exactly as race.js draws its glow: corner point and curve
function fillet(track, apex) {
  const R = ROUND.find((r) => r[0] === apex);
  const [, W, sgn] = R;
  const { P, HW, tan, N } = track;
  const kerb = (i) => { const k = (i + N) % N; return [P[k][0] - tan[k][1] * sgn * HW[k], P[k][1] + tan[k][0] * sgn * HW[k]]; };
  const a = kerb(apex - W), c = kerb(apex), b = kerb(apex + W);
  const curve = [];
  for (let j = 0; j <= 24; j++) {
    const t = j / 24, u = 1 - t;
    curve.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return { a, b, c, curve };
}

// extra paved areas for the road painter (game x, z rings), added before the ground is built
export function pavedPatches() {
  const track = createTrack();
  const f = fillet(track, KROON);
  // the corner of the pavement between the two kerb lines and the curve becomes road;
  // pushed out half a metre past the old corner so no sliver of kerb is left
  const dx = f.c[0] - (f.a[0] + f.b[0]) / 2, dz = f.c[1] - (f.a[1] + f.b[1]) / 2, l = Math.hypot(dx, dz) || 1;
  const c = [f.c[0] + (dx / l) * 0.5, f.c[1] + (dz / l) * 0.5];
  return [{ t: 1, outer: [c, ...f.curve, c] }];
}

// the same corner painted as kerbed street (cover R+G, src/world/roadtex.js), so the ground's kerb line
// runs round the curve along the low barrier instead of in the old square corner (Martin, 19 Nov)
export function cornerOverPaint() {
  return pavedPatches().map((a) => ({ outer: a.outer, cover: '#ff0' }));
}

// ids to drop from the props layer
export function cornerClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      for (const [kind, x, z] of REMOVE) if (a[k] === kind && Math.hypot(a[k + 1] - x, a[k + 2] - z) < 1.5) out.add(`${key}:${k / data.stride}`);
    }
  }
}

function islandLine(track, I) {
  const pts = [];
  for (let i = I.i0; i <= I.i1; i++) {
    const [tx, tz] = track.tan[i];
    pts.push({ x: track.P[i][0] - tz * I.off, z: track.P[i][1] + tx * I.off, tx, tz });
  }
  return pts;
}

// keep-right signs at the front of each island
export function cornerProps() {
  const track = createTrack();
  return ISLANDS.map((I) => {
    const p = islandLine(track, I)[0], q = islandLine(track, I)[1];
    const fx = q.x - p.x, fz = q.z - p.z, l = Math.hypot(fx, fz);
    return [KEEP_RIGHT, p.x + (fx / l) * 0.9, p.z + (fz / l) * 0.9, bearing(-p.tx, -p.tz)];
  });
}

export function createCorners(world, group, merged) {
  const track = createTrack();
  // ground height without our own bumps: the mean of two points either side, `d` metres off along (nx, nz)
  const bare = (x, z, nx, nz, d) => (world.heightAt(x + nx * d, z + nz * d) + world.heightAt(x - nx * d, z - nz * d)) / 2;

  // ---- traffic islands: a low raised slab with a kerb all round
  const islands = ISLANDS.map((I) => {
    const line = islandLine(track, I);
    let len = 0;
    const along = [0];
    for (let i = 1; i < line.length; i++) along.push((len += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z)));
    const halfAt = (s) => I.hw * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.min(s, len - s) / 2.4) / 2)));   // rounded ends
    const x0 = Math.min(...line.map((p) => p.x)) - 2, x1 = Math.max(...line.map((p) => p.x)) + 2;
    const z0 = Math.min(...line.map((p) => p.z)) - 2, z1 = Math.max(...line.map((p) => p.z)) + 2;
    const local = (x, z) => {
      let best = Infinity, s = 0, lat = 0;
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
        const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
        if (d < best) { best = d; s = along[i] + t * (along[i + 1] - along[i]); lat = d; }
      }
      return { s, lat };
    };
    world.addBump({
      x0, z0, x1, z1,
      at(x, z) {
        const q = local(x, z);
        if (q.s <= 0 || q.s >= len) return 0;
        const h = halfAt(q.s);
        return h > 0.05 ? ISLAND.height * smooth((h - q.lat) / ISLAND.edge) : 0;
      },
    });
    return { I, line, len, along, halfAt, built: false };
  });

  function buildIsland(k) {
    const { I, line, along, halfAt } = k;
    const base = [];
    for (const p of line) base.push(bare(p.x, p.z, -p.tz, p.tx, I.hw + 1.2));
    const n = line.length, pos = [], idx = [];
    // cross-section points at each station: left foot, left top, right top, right foot
    for (let i = 0; i < n; i++) {
      const p = line[i], h = Math.max(0.02, halfAt(along[i])), nx = -p.tz, nz = p.tx, y = base[i];
      const top = Math.max(y + ISLAND.height, world.heightAt(p.x, p.z)) + 0.04;     // the ground mesh carries the bump too
      for (const [d, up] of [[-h - 0.05, 0], [-h, 1], [h, 1], [h + 0.05, 0]]) pos.push(p.x + nx * d, up ? top : y + 0.01, p.z + nz * d);
    }
    for (let i = 1; i < n; i++) {
      const a = (i - 1) * 4, b = i * 4;
      for (let q = 0; q < 3; q++) idx.push(a + q, b + q, a + q + 1, a + q + 1, b + q, b + q + 1);
    }
    // the top in grey setts, the kerbs in lighter granite: split by colouring vertices per face
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    const top = new THREE.Color(ISLAND.top), kerb = new THREE.Color(ISLAND.kerb);
    const col = new Float32Array(flat.attributes.position.count * 3);
    for (let v = 0; v < flat.attributes.position.count; v += 3) {
      const c = Math.abs(flat.attributes.normal.getY(v)) > 0.9 ? top : kerb;
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (v + j) * 3);
    }
    flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    group.add(m);
    k.built = true;
  }

  // ---- Kroonuaia: a low barrier along the rounded pavement edge, mountable with a jolt
  const f = fillet(track, KROON);
  const bline = [];
  for (let j = 0; j < f.curve.length; j++) {
    const a = f.curve[Math.max(0, j - 1)], b = f.curve[Math.min(f.curve.length - 1, j + 1)], q = f.curve[j];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]);
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    if (nx * (q[0] - f.c[0]) + nz * (q[1] - f.c[1]) < 0) { nx = -nx; nz = -nz; }     // away from the road
    bline.push([q[0] + nx * BARRIER.off, q[1] + nz * BARRIER.off]);
  }
  const bTotal = bline.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - bline[i - 1][0], p[1] - bline[i - 1][1]) : 0), 0);
  {
    const xs = bline.map((p) => p[0]), zs = bline.map((p) => p[1]);
    world.addBump({
      x0: Math.min(...xs) - 1, z0: Math.min(...zs) - 1, x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1,
      at(x, z) {
        let best = Infinity, s = 0, acc = 0;
        for (let i = 0; i < bline.length - 1; i++) {
          const a = bline[i], b = bline[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (l * l)));
          const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
          if (d < best) { best = d; s = acc + t * l; }
          acc += l;
        }
        const w = BARRIER.width / 2;
        if (best >= w) return 0;
        return BARRIER.height * smooth((w - best) / BARRIER.ramp) * smooth(s / 0.8) * smooth((bTotal - s) / 0.8);
      },
    });
  }
  let barrier = null;
  function buildBarrier() {
    const parts = [];
    for (let i = 0; i < bline.length - 1; i++) {
      const a = bline[i], b = bline[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const y = bare((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, -dz / l, dx / l, 1.0);
      const rail = new THREE.BoxGeometry(l + 0.05, 0.3, 0.08);
      rail.rotateY(-Math.atan2(dz, dx));
      rail.translate((a[0] + b[0]) / 2, y + BARRIER.rail, (a[1] + b[1]) / 2);
      parts.push([rail, 0xb9bec8]);
      if (i % 2 === 0) {
        const post = new THREE.BoxGeometry(0.1, BARRIER.rail + 0.15, 0.1);
        post.translate(a[0], y + (BARRIER.rail + 0.15) / 2, a[1]);
        parts.push([post, 0x9a9eaa]);
      }
    }
    const last = bline[bline.length - 1], prev = bline[bline.length - 2];
    const ex = last[0] - prev[0], ez = last[1] - prev[1], el = Math.hypot(ex, ez) || 1;
    const y = bare(last[0], last[1], -ez / el, ex / el, 1.0);
    const post = new THREE.BoxGeometry(0.1, BARRIER.rail + 0.15, 0.1);
    post.translate(last[0], y + (BARRIER.rail + 0.15) / 2, last[1]);
    parts.push([post, 0x9a9eaa]);
    barrier = merged(parts);
    if (barrier) { barrier.castShadow = barrier.receiveShadow = true; group.add(barrier); }
    // the white edge line round the corner, 30 cm in from the kerb, from past the crossing on Emajõe on up
    // Kroonuaia (Martin, 19 Nov: the line follows the low fence, the kerb stones between them)
    {
      const pos = [], W = 0.07, IN = 0.3;
      const pts = [];
      for (let j = 0; j < f.curve.length; j++) {
        const q = f.curve[j], b = bline[j], l = Math.hypot(b[0] - q[0], b[1] - q[1]) || 1;
        const p = [q[0] - (b[0] - q[0]) / l * IN, q[1] - (b[1] - q[1]) / l * IN];
        const n = track.nearest(p[0], p[1], KROON);
        if (n.i + n.t >= LINE.from) pts.push(p);
      }
      const { P, HW, tan } = track;
      for (let i = KROON + 9; i <= LINE.to; i++) pts.push([P[i][0] + tan[i][1] * (HW[i] - IN), P[i][1] - tan[i][0] * (HW[i] - IN)]);
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l * W, nz = dx / l * W;
        const A = [a[0] - nx, a[1] - nz], B = [b[0] - nx, b[1] - nz], C = [a[0] + nx, a[1] + nz], D = [b[0] + nx, b[1] + nz];
        const y = (q) => world.heightAt(q[0], q[1]) + 0.02;
        for (const [u, v, w] of [[A, B, C], [C, B, D]]) {
          const up = (v[1] - u[1]) * (w[0] - u[0]) - (v[0] - u[0]) * (w[1] - u[1]) >= 0;
          for (const q of up ? [u, v, w] : [u, w, v]) pos.push(q[0], y(q), q[1]);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xfaf8ff, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      m.receiveShadow = true;
      group.add(m);
    }
    // kerb stones over the whole hump the cars feel, from its foot on the road side over the top and down
    // behind the barrier, so it is closed from every side (Martin, 20 Nov: it was see-through from the side)
    {
      const pos = [], up = (a, b, c) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) >= 0;
      const P3 = (p) => [p[0], world.heightAt(p[0], p[1]) + 0.015, p[1]];
      const w = BARRIER.width / 2 + 0.03, D = [];
      for (let k = 0; k <= 12; k++) D.push(-w + (2 * w * k) / 12);
      const at = (j, d) => {
        const q = f.curve[j], b = bline[j], l = Math.hypot(b[0] - q[0], b[1] - q[1]) || 1;
        return [b[0] + ((b[0] - q[0]) / l) * d, b[1] + ((b[1] - q[1]) / l) * d];
      };
      for (let j = 0; j < f.curve.length - 1; j++) {
        for (let k = 0; k < D.length - 1; k++) {
          const A = at(j, D[k]), B = at(j + 1, D[k]), C = at(j, D[k + 1]), D2 = at(j + 1, D[k + 1]);
          for (const [a, b, c] of [[A, B, C], [C, B, D2]]) for (const q of up(a, b, c) ? [a, b, c] : [a, c, b]) pos.push(...P3(q));
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: ISLAND.kerb, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.receiveShadow = true;
      group.add(m);
    }
  }

  const near = (x, z, px, pz) => Math.hypot(px - x, pz - z) < 700;
  return {
    update(x, z) {
      for (const k of islands) if (!k.built && near(x, z, k.line[0].x, k.line[0].z) && k.line.every((p) => world.ready(p.x, p.z))) buildIsland(k);
      if (!barrier && near(x, z, ...bline[0]) && bline.every((p) => world.ready(p[0], p[1]))) buildBarrier();
    },
  };
}
