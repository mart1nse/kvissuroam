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
const BARRIER = { off: 0.5, rail: 0.52 };      // the low barrier on the pavement, half a metre behind the kerb (Martin, 20 Nov: a tad lower)
// the kerb round the corner: an ordinary kerb, 20 cm, its face along the rounded line and a flat pavement top
// behind it to past the barrier (Martin, 20 Nov: "make the kerb look like any other kerb ... like 20cm")
const KERB = { h: 0.2, edge: 0.18, w: 1.6, b: 0.6, face: 0xa9a5b5, stone: 0xc9c5d3, top: 0xaea7b2 };

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
  // outward (pavement side) unit normal at each curve point, and the kerb's height at d metres past its face
  const out = f.curve.map((q, j) => { const p = bline[j], l = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1; return [(p[0] - q[0]) / l, (p[1] - q[1]) / l]; });
  const cLen = [0];
  for (let j = 1; j < f.curve.length; j++) cLen.push(cLen[j - 1] + Math.hypot(f.curve[j][0] - f.curve[j - 1][0], f.curve[j][1] - f.curve[j - 1][1]));
  const cTotal = cLen[cLen.length - 1];
  const kerbProfile = (d, s) => (d <= 0 || d >= KERB.w + KERB.b ? 0
    : KERB.h * smooth(d / KERB.edge) * (d > KERB.w ? smooth((KERB.w + KERB.b - d) / KERB.b) : 1) * smooth(s / 1.2) * smooth((cTotal - s) / 1.2));
  {
    const xs = [...f.curve, ...bline].map((p) => p[0]), zs = [...f.curve, ...bline].map((p) => p[1]);
    world.addBump({
      x0: Math.min(...xs) - 3, z0: Math.min(...zs) - 3, x1: Math.max(...xs) + 3, z1: Math.max(...zs) + 3,
      at(x, z) {
        let best = Infinity, bj = -1, bt = 0, braw = 0;
        for (let i = 0; i < f.curve.length - 1; i++) {
          const a = f.curve[i], b = f.curve[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
          const tr = ((x - a[0]) * dx + (z - a[1]) * dz) / l2, t = Math.max(0, Math.min(1, tr));
          const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
          if (d < best) { best = d; bj = i; bt = t; braw = tr; }
        }
        if ((bj === 0 && braw < 0) || (bj === f.curve.length - 2 && braw > 1)) return 0;
        const a = f.curve[bj], n0 = out[bj], n1 = out[bj + 1];
        const nx = n0[0] + (n1[0] - n0[0]) * bt, nz = n0[1] + (n1[1] - n0[1]) * bt;
        const ax = a[0] + (f.curve[bj + 1][0] - a[0]) * bt, az = a[1] + (f.curve[bj + 1][1] - a[1]) * bt;
        const d = (x - ax) * nx + (z - az) * nz;
        return kerbProfile(d, cLen[bj] + (cLen[bj + 1] - cLen[bj]) * bt);
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
    // the kerb: its face up the rounded edge in darker stone, a lighter kerb stone along the top, and the
    // pavement behind it out past the barrier and down again, draped on the ground as the cars feel it
    {
      const pos = [], col = [];
      const at = (j, d, lift) => { const q = f.curve[j], n = out[j], x = q[0] + n[0] * d, z = q[1] + n[1] * d; return [x, world.heightAt(x, z) + lift, z]; };
      const cF = new THREE.Color(KERB.face), cS = new THREE.Color(KERB.stone), cT = new THREE.Color(KERB.top);
      const E = KERB.edge, ST = E + 0.14;
      const bands = [[-0.03, -0.03, 0, 0.012, cF]];
      const R = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((t) => t * E);
      for (let q = 0; q < R.length - 1; q++) bands.push([R[q], 0.012, R[q + 1], 0.012, q < 3 ? cF : cS]);
      bands.push([E, 0.012, ST, 0.016, cS]);
      const D = [ST];
      for (let d = ST + 0.4; d < KERB.w; d += 0.4) D.push(d);
      D.push(KERB.w, KERB.w + KERB.b * 0.5, KERB.w + KERB.b);
      for (let q = 0; q < D.length - 1; q++) bands.push([D[q], 0.012, D[q + 1], 0.012, cT]);
      for (let j = 0; j < f.curve.length - 1; j++) {
        for (const [d0, l0, d1, l1, c] of bands) {
          const A = at(j, d0, l0), B = at(j + 1, d0, l0), C = at(j, d1, l1), D2 = at(j + 1, d1, l1);
          pos.push(...A, ...B, ...C, ...C, ...B, ...D2);
          for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
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
