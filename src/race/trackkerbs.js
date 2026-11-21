// Pavements along the lap stand on a 9 cm kerb (Martin, 19 Nov: "a 10 cm kerb at most pavements, mainly
// on the race track"). Where they are comes from src/race/kerbs.json, found from the map: for each lap index
// and side, the paved strip that starts at the road's edge, left out at junction mouths, where cars are
// parked at the kerb, and where a hand-made kerb is already in place. Each run of it is
//   { s: side (-1 left, 1 right), i0: first lap index, f: [kerb face, metres past the road's half width],
//     w: [pavement width from the face], b: [how far behind it the ground comes back down] } per index.
// The physics feels it through world.addBump (and the knock of rolling up a kerb, src/cars/physics.js),
// the ground tiles draw its top with their own look 10 cm up (world.bumpTops), and this file draws the
// kerb stones: the face down to the road and a narrow stone along the top. At the ends of a run the
// kerb comes down to the road over a few metres, as at a crossing.
import * as THREE from 'three';
import KERBS from './kerbs.json';
import { createTrack, cellKey } from './race.js';
import { junctionCorners, cornerAt } from './junctionkerbs.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

const H = KERBS.h;            // 0.09 m (Martin, 19 Nov: first 10, then 1 cm lower with a smoother edge)
const EDGE = 0.1;             // the rounded edge of the kerb stone
const TAPER = 2;              // lap indices (about 4 m) for the kerb to come down at the end of a run
const STONE = EDGE + 0.12;    // the kerb stone's top, drawn in stone colour
const COL = { face: 0xa9a5b5, stone: 0xc9c5d3 };
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function createTrackKerbs(world, scene) {
  const track = createTrack();
  const { P, HW, tan, N } = track;
  const runs = KERBS.runs.map((r) => ({ ...r, i1: r.i0 + r.w.length - 1, built: false }));
  const by = { '-1': new Int16Array(N).fill(-1), 1: new Int16Array(N).fill(-1) };
  runs.forEach((r, k) => { for (let i = r.i0; i <= r.i1; i++) by[r.s][i] = k; });
  // the round kerbs at the big junction (src/race/junctionkerbs.js) take over from the runs there
  const corners = junctionCorners().map((c) => ({ ...c, built: false }));
  const skipped = new Set();
  for (const c of corners) for (const [s, i0, i1] of c.skip) for (let i = i0; i <= i1; i++) { by[s][i] = -1; skipped.add(`${s}:${i}`); }
  const skip = (r, t) => skipped.has(`${r.s}:${Math.floor(t + 1e-6)}`);

  // a run's values at a lap index with a fraction (held at the last index)
  const val = (r, key, t) => {
    const a = Math.max(0, Math.min(r.w.length - 1, Math.floor(t - r.i0))), b = Math.min(r.w.length - 1, a + 1), u = Math.max(0, Math.min(1, t - r.i0 - a));
    return r[key][a] + (r[key][b] - r[key][a]) * u;
  };
  const up = (r, t) => smooth((t - r.i0) / TAPER) * smooth((r.i1 - t) / TAPER);
  const hwAt = (t) => { const i = Math.floor(t), u = t - i; return HW[i] + (HW[Math.min(N - 1, i + 1)] - HW[i]) * u; };
  const at = (t, lat) => {                     // lat + to the right of the direction of travel
    const i = Math.min(N - 2, Math.floor(t)), u = t - i, [ax, az] = P[i], [bx, bz] = P[i + 1];
    const tx = tan[i][0] + (tan[i + 1][0] - tan[i][0]) * u, tz = tan[i][1] + (tan[i + 1][1] - tan[i][1]) * u, l = Math.hypot(tx, tz) || 1;
    return [ax + (bx - ax) * u - (tz / l) * lat, az + (bz - az) * u + (tx / l) * lat];
  };
  // height of the kerb at d metres past its face
  const profile = (d, w, b) => (d <= 0 || d >= w + b ? 0 : smooth(d / EDGE) * (d > w ? smooth((w + b - d) / b) : 1));

  // ---- where to look at all: a 10 m grid of the cells the kerbs cover, so the ground elsewhere costs nothing
  const CELL = 10, cells = new Set();
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of runs) {
    r.box = [Infinity, Infinity, -Infinity, -Infinity];       // where this run is, for `top` below
    for (let t = r.i0; t <= r.i1; t += 0.5) {
      const base = hwAt(t) + val(r, 'f', t), far = val(r, 'w', t) + val(r, 'b', t);
      for (let d = -0.5; d <= far + 0.5; d += 2) {
        const [x, z] = at(t, r.s * (base + d));
        for (const ox of [-3, 3]) for (const oz of [-3, 3]) cells.add(cellKey(Math.floor((x + ox) / CELL), Math.floor((z + oz) / CELL)));
        x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
        r.box[0] = Math.min(r.box[0], x); r.box[1] = Math.min(r.box[1], z); r.box[2] = Math.max(r.box[2], x); r.box[3] = Math.max(r.box[3], z);
      }
    }
  }
  for (const c of corners) {
    const [bx0, bz0, bx1, bz1] = c.box;
    for (let x = bx0; x <= bx1 + CELL; x += CELL) for (let z = bz0; z <= bz1 + CELL; z += CELL) cells.add(cellKey(Math.floor(Math.min(x, bx1) / CELL), Math.floor(Math.min(z, bz1) / CELL)));
    x0 = Math.min(x0, bx0); z0 = Math.min(z0, bz0); x1 = Math.max(x1, bx1); z1 = Math.max(z1, bz1);
  }
  // a run's kerb at (x, z)
  const runAt = (x, z) => {
    // (the nearest piece of the lap anywhere: a hint can settle on another stretch that passes within 30 m)
    const n = track.nearest(x, z, -1, 14);
    if (n.i < 0 || n.d > 14) return 0;
    const [tx, tz] = tan[n.i], p = P[n.i];
    const lat = (x - p[0]) * -tz + (z - p[1]) * tx, s = lat > 0 ? 1 : -1;
    const k = by[s][n.i];
    if (k < 0) return 0;
    const r = runs[k], t = n.i + n.t;
    const d = Math.abs(lat) - hwAt(t) - val(r, 'f', t);
    return H * up(r, t) * profile(d, val(r, 'w', t), val(r, 'b', t));
  };
  world.addBump({
    x0: x0 - 5, z0: z0 - 5, x1: x1 + 5, z1: z1 + 5,
    at(x, z) {
      if (!cells.has(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)))) return 0;
      let v = runAt(x, z);
      for (const c of corners) v = Math.max(v, cornerAt(c, x, z));     // where a corner and a run meet, the higher
      return v;
    },
    // the raised ground, for the ground tiles to draw in their own look: quads of half a lap index along
    // and up to a metre across, from the top of the rounded edge to the foot of the back slope
    top(tx0, tz0, size, out) {
      const inTile = (p) => p[0] >= tx0 && p[0] < tx0 + size && p[1] >= tz0 && p[1] < tz0 + size;
      // (a point is a corner of up to six triangles, and a ground height here asks the kerbs themselves,
      // which look up the nearest piece of the lap: each point's height is worked out once. A map square
      // with kerbs took 20 to 60 ms in one step of its ground tile before, 21 Nov 2026.)
      const seen = new Map();
      const y = (p) => {
        const k = Math.round(p[0] * 64) * 4194304 + Math.round(p[1] * 64);
        let v = seen.get(k);
        if (v === undefined) seen.set(k, (v = world.heightAt(Math.max(tx0, Math.min(tx0 + size, p[0])), Math.max(tz0, Math.min(tz0 + size, p[1]))) + 0.012));
        return v;
      };
      for (const r of runs) {
        // (only the runs near this tile: every tile of every map square within the lap's outline walked the
        // whole lap's kerbs before, half a metre at a time: 20 ms a tile on a fast processor, 100 on an old
        // one, also for a tile with no kerb in it. And a run's middles are worked out once.)
        if (r.box[2] < tx0 - 12 || r.box[0] > tx0 + size + 12 || r.box[3] < tz0 - 12 || r.box[1] > tz0 + size + 12) continue;
        if (!r.mids) {
          r.mids = [];
          for (let t = r.i0; t < r.i1 - 1e-6; t += 0.5) r.mids.push(skip(r, t) ? null : at((t + Math.min(r.i1, t + 0.5)) / 2, r.s * (hwAt(t) + val(r, 'f', t) + 1)));
        }
        let n = -1;
        for (let t = r.i0; t < r.i1 - 1e-6; t += 0.5) {
          const mid = r.mids[++n];
          if (!mid) continue;
          const u = Math.min(r.i1, t + 0.5);
          if (mid[0] < tx0 - 12 || mid[0] > tx0 + size + 12 || mid[1] < tz0 - 12 || mid[1] > tz0 + size + 12) continue;
          const w = val(r, 'w', t), b = val(r, 'b', t);
          const ds = [EDGE];
          for (let d = 1; d < w; d += 1) ds.push(d);
          ds.push(w, w + b * 0.5, w + b);
          const pt = (tt, d) => at(tt, r.s * (hwAt(tt) + val(r, 'f', tt) + d));
          for (let q = 0; q < ds.length - 1; q++) {
            const A = pt(t, ds[q]), B = pt(u, ds[q]), C = pt(t, ds[q + 1]), D = pt(u, ds[q + 1]);
            if (!inTile([(A[0] + D[0]) / 2, (A[1] + D[1]) / 2])) continue;
            for (const [a, bb, c] of [[A, B, C], [C, B, D]]) {
              const tri = (bb[1] - a[1]) * (c[0] - a[0]) - (bb[0] - a[0]) * (c[1] - a[1]) >= 0 ? [a, bb, c] : [a, c, bb];
              for (const p of tri) out.push(p[0], y(p), p[1]);
            }
          }
        }
      }
      for (const c of corners) {
        const [bx0, bz0, bx1, bz1] = c.box;
        if (bx1 < tx0 || bx0 > tx0 + size || bz1 < tz0 || bz0 > tz0 + size) continue;
        const ds = [c.edge];
        for (let d = 1; d < c.w; d += 1) ds.push(d);
        ds.push(c.w, c.w + c.b * 0.5, c.w + c.b);
        const pt = (j, d) => { const q = c.pts[j], n = c.vN[j], dd = Math.min(d, c.clamp[j]); return [q[0] + n[0] * dd, q[1] + n[1] * dd]; };
        for (let j = 0; j < c.pts.length - 1; j++) {
          if (!c.draw[j] || !c.draw[j + 1]) continue;
          for (let q = 0; q < ds.length - 1; q++) {
            const A = pt(j, ds[q]), B = pt(j + 1, ds[q]), C = pt(j, ds[q + 1]), D = pt(j + 1, ds[q + 1]);
            if (!inTile([(A[0] + D[0]) / 2, (A[1] + D[1]) / 2])) continue;
            for (const [a, bb, cc] of [[A, B, C], [C, B, D]]) {
              const tri = (bb[1] - a[1]) * (cc[0] - a[0]) - (bb[0] - a[0]) * (cc[1] - a[1]) >= 0 ? [a, bb, cc] : [a, cc, bb];
              for (const p of tri) out.push(p[0], y(p), p[1]);
            }
          }
        }
      }
    },
  });

  // ---- the kerb stones, drawn per run once the ground there has loaded and the car is near
  const group = still(new THREE.Group());       // nothing here moves once built (src/still.js)
  scene.add(group);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const cF = new THREE.Color(COL.face), cS = new THREE.Color(COL.stone);
  // (queued, in steps: a run of kerb was up to 24 ms in one frame on a fast processor, 120 on an old one)
  function* build(r) {
    const pos = [], col = [];
    const quad = (A, B, C, D, c) => { pos.push(...A, ...B, ...C, ...C, ...B, ...D); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b); };
    const P3 = (t, d, lift) => { const [x, z] = at(t, r.s * (hwAt(t) + val(r, 'f', t) + d)); return [x, world.heightAt(x, z) + lift, z]; };
    // the face: from just under the road up the rounded edge as the cars feel it, then the stone on top.
    // (The nine points across the kerb at one place along it are worked out once and shared by the quads
    // before and after: each height asks the kerbs for the nearest piece of the lap, and four points per
    // quad made this 30 ms a run, 160 ms on a slow computer.)
    const R = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((f) => f * EDGE);
    const across = (t) => [P3(t, -0.03, -0.03), ...R.map((d) => P3(t, d, 0.012)), P3(t, STONE, 0.016)];
    let at0 = NaN, row0 = null, n = 0;
    for (let t = r.i0; t < r.i1 - 1e-6; t += 0.5) {
      if ((++n & 7) === 0 && jobs.late()) yield;
      if (skip(r, t)) continue;
      const u = Math.min(r.i1, t + 0.5);
      const A = at0 === t ? row0 : across(t), B = across(u);
      for (let q = 0; q < 8; q++) quad(A[q], B[q], A[q + 1], B[q + 1], q < 4 ? cF : cS);
      at0 = u; row0 = B;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // a corner's kerb stones, the same profile along its own line
  function* buildCorner(c) {
    const pos = [], col = [];
    const quad = (A, B, C, D, k) => { pos.push(...A, ...B, ...C, ...C, ...B, ...D); for (let q = 0; q < 6; q++) col.push(k.r, k.g, k.b); };
    const P3 = (j, d, lift) => { const q = c.pts[j], n = c.vN[j], x = q[0] + n[0] * d, z = q[1] + n[1] * d; return [x, world.heightAt(x, z) + lift, z]; };
    const E = c.edge, R = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((f) => f * E), ST = E + 0.12;
    // (the points across the kerb once per place along it, as in build)
    const across = (j) => [P3(j, -0.03, -0.03), ...R.map((d) => P3(j, d, 0.012)), P3(j, ST, 0.016)];
    let at0 = -1, row0 = null;
    for (let j = 0; j < c.pts.length - 1; j++) {
      if ((j & 7) === 7 && jobs.late()) yield;
      if (!c.draw[j] || !c.draw[j + 1]) continue;
      const A = at0 === j ? row0 : across(j), B = across(j + 1);
      for (let q = 0; q < 8; q++) quad(A[q], B[q], A[q + 1], B[q + 1], q < 4 ? cF : cS);
      at0 = j + 1; row0 = B;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
  }

  return {
    update(x, z) {
      for (const c of corners) {
        if (c.built) continue;
        const q = c.pts[c.nC0];
        if (Math.hypot(q[0] - x, q[1] - z) < 300 && world.ready(...c.pts[0]) && world.ready(...c.pts[c.pts.length - 1])) { c.built = true; jobs.add(function* () { yield* buildCorner(c); }, 'track kerbs'); }
      }
      for (const r of runs) {
        if (r.built) continue;
        let near = false, ready = true;
        for (let i = r.i0; i <= r.i1; i += 8) {
          const p = P[Math.min(i, r.i1)];
          if (Math.hypot(p[0] - x, p[1] - z) < 300) near = true;
          if (!world.ready(...p)) ready = false;
        }
        if (near && ready && world.ready(...P[r.i1])) { r.built = true; jobs.add(function* () { yield* build(r); }, 'track kerbs'); }
      }
    },
  };
}
