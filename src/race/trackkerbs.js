// Pavements along the lap stand on a 10 cm kerb (Martin, 19 Nov: "a 10 cm kerb at most pavements, mainly
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
import { createTrack } from './race.js';

const H = KERBS.h;            // 0.10 m
const EDGE = 0.06;            // the rounded edge of the kerb stone
const TAPER = 2;              // lap indices (about 4 m) for the kerb to come down at the end of a run
const STONE = 0.16;           // the kerb stone's top, drawn in stone colour
const COL = { face: 0xa9a5b5, stone: 0xc9c5d3 };
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function createTrackKerbs(world, scene) {
  const track = createTrack();
  const { P, HW, tan, N } = track;
  const runs = KERBS.runs.map((r) => ({ ...r, i1: r.i0 + r.w.length - 1, built: false }));
  const by = { '-1': new Int16Array(N).fill(-1), 1: new Int16Array(N).fill(-1) };
  runs.forEach((r, k) => { for (let i = r.i0; i <= r.i1; i++) by[r.s][i] = k; });

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
    for (let t = r.i0; t <= r.i1; t += 0.5) {
      const base = hwAt(t) + val(r, 'f', t), far = val(r, 'w', t) + val(r, 'b', t);
      for (let d = -0.5; d <= far + 0.5; d += 2) {
        const [x, z] = at(t, r.s * (base + d));
        for (const ox of [-3, 3]) for (const oz of [-3, 3]) cells.add(`${Math.floor((x + ox) / CELL)},${Math.floor((z + oz) / CELL)}`);
        x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
      }
    }
  }
  world.addBump({
    x0: x0 - 5, z0: z0 - 5, x1: x1 + 5, z1: z1 + 5,
    at(x, z) {
      if (!cells.has(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`)) return 0;
      // (the nearest piece of the lap anywhere: a hint can settle on another stretch that passes within 30 m)
      const n = track.nearest(x, z);
      if (n.i < 0 || n.d > 14) return 0;
      const [tx, tz] = tan[n.i], p = P[n.i];
      const lat = (x - p[0]) * -tz + (z - p[1]) * tx, s = lat > 0 ? 1 : -1;
      const k = by[s][n.i];
      if (k < 0) return 0;
      const r = runs[k], t = n.i + n.t;
      const d = Math.abs(lat) - hwAt(t) - val(r, 'f', t);
      return H * up(r, t) * profile(d, val(r, 'w', t), val(r, 'b', t));
    },
    // the raised ground, for the ground tiles to draw in their own look: quads of half a lap index along
    // and up to a metre across, from the top of the rounded edge to the foot of the back slope
    top(tx0, tz0, size, out) {
      const inTile = (p) => p[0] >= tx0 && p[0] < tx0 + size && p[1] >= tz0 && p[1] < tz0 + size;
      const y = (p) => world.heightAt(Math.max(tx0, Math.min(tx0 + size, p[0])), Math.max(tz0, Math.min(tz0 + size, p[1]))) + 0.012;
      for (const r of runs) {
        for (let t = r.i0; t < r.i1 - 1e-6; t += 0.5) {
          const u = Math.min(r.i1, t + 0.5);
          const mid = at((t + u) / 2, r.s * (hwAt(t) + val(r, 'f', t) + 1));
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
    },
  });

  // ---- the kerb stones, drawn per run once the ground there has loaded and the car is near
  const group = new THREE.Group();
  scene.add(group);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const cF = new THREE.Color(COL.face), cS = new THREE.Color(COL.stone);
  function build(r) {
    r.built = true;
    const pos = [], col = [];
    const quad = (A, B, C, D, c) => { pos.push(...A, ...B, ...C, ...C, ...B, ...D); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b); };
    const P3 = (t, d, lift) => { const [x, z] = at(t, r.s * (hwAt(t) + val(r, 'f', t) + d)); return [x, world.heightAt(x, z) + lift, z]; };
    for (let t = r.i0; t < r.i1 - 1e-6; t += 0.5) {
      const u = Math.min(r.i1, t + 0.5);
      const road = (tt) => P3(tt, -0.03, -0.03);
      const top = (tt) => { const p = P3(tt, EDGE + 0.01, 0.012); p[1] -= 0.008; return p; };
      const base = (tt) => { const [x, , z] = P3(tt, 0, 0); return [x, top(tt)[1], z]; };
      quad(road(t), road(u), base(t), base(u), cF);                                          // the face
      quad(base(t), base(u), P3(t, STONE, 0.016), P3(u, STONE, 0.016), cS);                // the stone on top
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
      for (const r of runs) {
        if (r.built) continue;
        let near = false, ready = true;
        for (let i = r.i0; i <= r.i1; i += 8) {
          const p = P[Math.min(i, r.i1)];
          if (Math.hypot(p[0] - x, p[1] - z) < 300) near = true;
          if (!world.ready(...p)) ready = false;
        }
        if (near && ready && world.ready(...P[r.i1])) build(r);
      }
    },
  };
}
