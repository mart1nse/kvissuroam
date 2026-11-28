// Granite kerbs along given lines, for the Tallinn lap's hand-dressed corners (first made for the Rummu corner,
// rummukurv.js). A run is a polyline [[x, z], ...] with the pavement or lawn on its LEFT; the stone's face is on
// the line and its top behind it. The cars feel it (world.addBump); the stones are built near the car, a stretch
// at a time through the work queue.
//   createKerb(world, group, runs, { H: height in metres, name: the queue's name for it })
//     -> { kerbAt(x, z), pieces, update(car) }
import * as THREE from 'three';
import { jobs } from '../../jobs.js';

const EDGE = 0.06, TOP = 0.2, BACK = 0.12;      // the stone's rounded face, its top, the fall behind it
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// a polyline's bends rounded (Chaikin), `times` over
export function rounded(line, times = 2) {
  for (let k = 0; k < times; k++) {
    const out = [line[0]];
    for (let j = 0; j < line.length - 1; j++) { const a = line[j], b = line[j + 1]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    out.push(line[line.length - 1]);
    line = out;
  }
  return line;
}

export function createKerb(world, group, runs, { H = 0.12, name = 'kerb' } = {}) {
  // each run: its length along, and its pieces in a grid of 4 m cells for the cars' wheels
  const CELL = 4, cells = new Map();
  const key = (cx, cz) => cx * 100003 + cz;
  runs.forEach((r, rk) => {
    r.cum = [0];
    for (let j = 1; j < r.length; j++) r.cum.push(r.cum[j - 1] + Math.hypot(r[j][0] - r[j - 1][0], r[j][1] - r[j - 1][1]));
    for (let j = 0; j < r.length - 1; j++) {
      const a = r[j], b = r[j + 1];
      for (let cx = Math.floor((Math.min(a[0], b[0]) - 1) / CELL); cx <= Math.floor((Math.max(a[0], b[0]) + 1) / CELL); cx++) {
        for (let cz = Math.floor((Math.min(a[1], b[1]) - 1) / CELL); cz <= Math.floor((Math.max(a[1], b[1]) + 1) / CELL); cz++) {
          let l = cells.get(key(cx, cz));
          if (!l) cells.set(key(cx, cz), (l = []));
          l.push(rk, j);
        }
      }
    }
  });
  // the kerb's height at d metres behind its face (it comes down over 2 m at a run's ends)
  const profile = (d) => (d <= 0 || d >= TOP + BACK ? 0 : d < EDGE ? smooth(d / EDGE) : d <= TOP ? 1 : smooth((TOP + BACK - d) / BACK));
  // (the ground's height is asked a hundred thousand times as a map square is built, and every one within the kerb's
  // 800 m box comes here: a table of which cells have kerb answers "none" without a look-up)
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of runs) for (const p of r) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
  x0 -= 2 * CELL; z0 -= 2 * CELL; x1 += 2 * CELL; z1 += 2 * CELL;
  const gx0 = Math.floor(x0 / CELL), gz0 = Math.floor(z0 / CELL), gw = Math.floor(x1 / CELL) - gx0 + 1, gh = Math.floor(z1 / CELL) - gz0 + 1;
  const has = new Uint8Array(gw * gh);
  for (const k of cells.keys()) { const cx = Math.round(k / 100003), cz = k - cx * 100003; has[(cz - gz0) * gw + (cx - gx0)] = 1; }
  const kerbAt = (x, z) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), gx = cx - gx0, gz = cz - gz0;
    if (gx < 0 || gz < 0 || gx >= gw || gz >= gh || !has[gz * gw + gx]) return 0;
    const l = cells.get(key(cx, cz));
    if (!l) return 0;
    let best = 0;
    for (let n = 0; n < l.length; n += 2) {
      const r = runs[l[n]], j = l[n + 1], a = r[j], b = r[j + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
      const t = (x - a[0]) * ux + (z - a[1]) * uz;
      if (t < -0.05 || t > len + 0.05) continue;
      const d = (x - a[0]) * uz - (z - a[1]) * ux;                 // to the left of the run
      const along = r.cum[j] + t, v = H * profile(d) * smooth(along / 2) * smooth((r.cum[r.length - 1] - along) / 2);
      if (v > best) best = v;
    }
    return best;
  };
  world.addBump({ x0, z0, x1, z1, at: kerbAt });

  const stoneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // the kerb stones of one stretch of a run (about 100 m a mesh)
  function* buildKerb(r, j0, j1) {
    const pos = [], col = [], idx = [];
    const cF = new THREE.Color(0xa9a5b5), cS = new THREE.Color(0xc9c5d3), cB = new THREE.Color(0x8f8c98);
    const total = r.cum[r.length - 1];
    let n = 0;
    for (let j = j0; j <= j1; j++) {
      const a = r[Math.max(0, j - 1)], b = r[Math.min(r.length - 1, j + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = (b[1] - a[1]) / l, nz = -(b[0] - a[0]) / l;             // to the lawn
      const up = H * smooth(r.cum[j] / 2) * smooth((total - r.cum[j]) / 2);
      const gy = world.heightAt(r[j][0] - nx * 0.1, r[j][1] - nz * 0.1) - kerbAt(r[j][0] - nx * 0.1, r[j][1] - nz * 0.1);
      for (const [d, y, c] of [[-0.02, -0.04, cF], [EDGE * 0.6, up, cF], [EDGE * 0.6, up, cS], [TOP, up, cS], [TOP, up, cB], [TOP + BACK, -0.02, cB]]) {
        pos.push(r[j][0] + nx * d, gy + y + 0.012, r[j][1] + nz * d);
        col.push(c.r, c.g, c.b);
      }
      if (j > j0) for (const q of [0, 2, 4]) { const A = n - 6 + q, B = n + q; idx.push(A, B, A + 1, A + 1, B, B + 1); }
      n += 6;
      if ((j & 15) === 15 && jobs.late()) yield;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, stoneMat);
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    group.add(m);
  }
  const pieces = [];
  for (const r of runs) for (let j0 = 0; j0 < r.length - 1; j0 += 60) { const j1 = Math.min(r.length - 1, j0 + 60); pieces.push({ r, j0, j1, m: r[(j0 + j1) >> 1], built: false }); }

  return {
    kerbAt, pieces,
    update(car) {
      for (const pc of pieces) {
        if (pc.built || Math.hypot(pc.m[0] - car.x, pc.m[1] - car.z) > 330 || !world.ready(pc.m[0], pc.m[1])) continue;
        pc.built = true;
        jobs.add(function* kerbStones() { yield* buildKerb(pc.r, pc.j0, pc.j1); }, name);
      }
    },
  };
}
