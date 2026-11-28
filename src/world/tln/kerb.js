// Granite kerbs along given lines, for the Tallinn lap's hand-dressed corners (first made for the Rummu corner,
// rummukurv.js). A run is a polyline [[x, z], ...] with the pavement or lawn on its LEFT; the stone's face is on
// the line and its top behind it. The cars feel it (world.addBump); the stones are built near the car, a stretch
// at a time through the work queue.
// Behind the stone the ground stays up at the kerb's height (Martin, 28 Nov 2026: "kerbs should get a sidewalk too.
// the kerbs that are near grass then the grass part is then higher than the road from the kerb up"): `walk` metres
// of it level, then down to the ground over `fall` metres. The ground tiles draw that raised ground in their own
// look (world.bumpTops, as the Tartu lap's pavements, src/race/trackkerbs.js), and on it lies a paved footway,
// unless the run says `run.grass = true` (the lawn itself is then what is higher). `run.walk` and `run.fall` set
// a run's own widths; `run.walk = 0` is a bare stone as before.
//   createKerb(world, group, runs, { H: height in metres, name: the queue's name for it })
//     -> { kerbAt(x, z), pieces, update(car) }
import * as THREE from 'three';
import { jobs } from '../../jobs.js';

const EDGE = 0.06, TOP = 0.2, BACK = 0.12;      // the stone's rounded face, its top, the fall behind a bare one
const WALK = 1.8, FALL = 2.5, PAVED = 1.6;      // the raised ground behind the stone, its way down, the footway on it
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

// a polyline's sharp corners cut back r metres each way, then no piece longer than `step`
export function shaped(line, r = 0.5, step = 2) {
  const cut = [line[0]];
  for (let j = 1; j < line.length - 1; j++) {
    const a = line[j - 1], v = line[j], b = line[j + 1], la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ra = Math.min(r, la / 2.5), rb = Math.min(r, lb / 2.5);
    cut.push([v[0] + ((a[0] - v[0]) / la) * ra, v[1] + ((a[1] - v[1]) / la) * ra], [v[0] + ((b[0] - v[0]) / lb) * rb, v[1] + ((b[1] - v[1]) / lb) * rb]);
  }
  cut.push(line[line.length - 1]);
  const out = [cut[0]];
  for (let j = 1; j < cut.length; j++) {
    const a = cut[j - 1], b = cut[j], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

export function createKerb(world, group, runs, { H = 0.12, name = 'kerb' } = {}) {
  // each run: its length along, and its pieces in a grid of 4 m cells for the cars' wheels
  const CELL = 4, cells = new Map();
  const key = (cx, cz) => cx * 100003 + cz;
  runs.forEach((r, rk) => {
    if (r.walk === undefined) r.walk = WALK;
    if (r.fall === undefined) r.fall = r.walk > 0 ? FALL : BACK;
    r.far = TOP + r.walk + r.fall;
    const M = r.far + 0.4;
    r.box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of r) { r.box[0] = Math.min(r.box[0], p[0]); r.box[1] = Math.min(r.box[1], p[1]); r.box[2] = Math.max(r.box[2], p[0]); r.box[3] = Math.max(r.box[3], p[1]); }
    // the way to the lawn at each point
    r.nrm = r.map((_, j) => { const a = r[Math.max(0, j - 1)], b = r[Math.min(r.length - 1, j + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]; });
    r.cum = [0];
    for (let j = 1; j < r.length; j++) r.cum.push(r.cum[j - 1] + Math.hypot(r[j][0] - r[j - 1][0], r[j][1] - r[j - 1][1]));
    for (let j = 0; j < r.length - 1; j++) {
      const a = r[j], b = r[j + 1];
      for (let cx = Math.floor((Math.min(a[0], b[0]) - M) / CELL); cx <= Math.floor((Math.max(a[0], b[0]) + M) / CELL); cx++) {
        for (let cz = Math.floor((Math.min(a[1], b[1]) - M) / CELL); cz <= Math.floor((Math.max(a[1], b[1]) + M) / CELL); cz++) {
          let l = cells.get(key(cx, cz));
          if (!l) cells.set(key(cx, cz), (l = []));
          l.push(rk, j);
        }
      }
    }
  });
  // the kerb's height at d metres behind its face (it comes down over 2 m at a run's ends)
  const profile = (d, r) => (d <= 0 || d >= r.far ? 0 : d < EDGE ? smooth(d / EDGE) : d <= TOP + r.walk ? 1 : smooth((r.far - d) / r.fall));
  // (the ground's height is asked a hundred thousand times as a map square is built, and every one within the kerb's
  // 800 m box comes here: a table of which cells have kerb answers "none" without a look-up)
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of runs) for (const p of r) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
  x0 -= 3 * CELL; z0 -= 3 * CELL; x1 += 3 * CELL; z1 += 3 * CELL;
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
      const t0 = (x - a[0]) * ux + (z - a[1]) * uz, t = t0 < 0 ? 0 : t0 > len ? len : t0;
      let d = (x - a[0]) * uz - (z - a[1]) * ux;                 // to the left of the run
      // (past a piece's end, behind the kerb: round its end point, so that the raised ground has no gaps where
      // the run bends away from it)
      if (t !== t0) { if (d <= EDGE || (t0 < -0.05 && j === 0) || (t0 > len + 0.05 && j === r.length - 2)) { if (t0 < -0.05 || t0 > len + 0.05) continue; } else d = Math.hypot(x - a[0] - ux * t, z - a[1] - uz * t); }
      const along = r.cum[j] + t, v = H * profile(d, r) * smooth(along / 2) * smooth((r.cum[r.length - 1] - along) / 2);
      if (v > best) best = v;
    }
    return best;
  };
  world.addBump({
    x0, z0, x1, z1, at: kerbAt,
    // the raised ground behind the stones, for the ground tiles to draw in their own look
    top(tx0, tz0, size, out) {
      const seen = new Map();
      const y = (p) => {
        const k = Math.round(p[0] * 64) * 4194304 + Math.round(p[1] * 64);
        let v = seen.get(k);
        if (v === undefined) seen.set(k, (v = world.heightAt(Math.max(tx0, Math.min(tx0 + size, p[0])), Math.max(tz0, Math.min(tz0 + size, p[1]))) + 0.012));
        return v;
      };
      for (const r of runs) {
        if (!(r.walk > 0) || r.box[2] < tx0 - 6 || r.box[0] > tx0 + size + 6 || r.box[3] < tz0 - 6 || r.box[1] > tz0 + size + 6) continue;
        const ds = [TOP * 0.9];
        for (let d = TOP + 1; d < TOP + r.walk; d += 1) ds.push(d);
        ds.push(TOP + r.walk, TOP + r.walk + r.fall * 0.25, TOP + r.walk + r.fall * 0.5, TOP + r.walk + r.fall * 0.75, r.far);
        const pt = (j, d) => [r[j][0] + r.nrm[j][0] * d, r[j][1] + r.nrm[j][1] * d];
        for (let j = 0; j < r.length - 1; j++) {
          const mx = (r[j][0] + r[j + 1][0]) / 2, mz = (r[j][1] + r[j + 1][1]) / 2;
          if (mx < tx0 - 6 || mx > tx0 + size + 6 || mz < tz0 - 6 || mz > tz0 + size + 6) continue;
          for (let q = 0; q < ds.length - 1; q++) {
            const A = pt(j, ds[q]), B = pt(j + 1, ds[q]), C = pt(j, ds[q + 1]), D = pt(j + 1, ds[q + 1]);
            const cx = (A[0] + D[0]) / 2, cz = (A[1] + D[1]) / 2;
            if (cx < tx0 || cx >= tx0 + size || cz < tz0 || cz >= tz0 + size) continue;
            for (const [a, b, c] of [[A, B, C], [C, B, D]]) {
              const tri = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) >= 0 ? [a, b, c] : [a, c, b];
              for (const p of tri) out.push(p[0], y(p), p[1]);
            }
          }
        }
      }
    },
  });

  const stoneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // the kerb stones of one stretch of a run (about 100 m a mesh)
  function* buildKerb(r, j0, j1) {
    const pos = [], col = [], idx = [];
    const cF = new THREE.Color(0xa9a5b5), cS = new THREE.Color(0xc9c5d3), cB = new THREE.Color(0x8f8c98), cP = new THREE.Color(0xb3b0ba), cQ = new THREE.Color(0xa7a4ae);
    const paved = r.walk > 0 && !r.grass, pw = Math.min(PAVED, r.walk - 0.1), strips = r.walk > 0 && !paved ? [0, 2] : [0, 2, 4];
    const total = r.cum[r.length - 1];
    let n = 0;
    for (let j = j0; j <= j1; j++) {
      const [nx, nz] = r.nrm[j];                                         // to the lawn
      const up = H * smooth(r.cum[j] / 2) * smooth((total - r.cum[j]) / 2);
      const gy = world.heightAt(r[j][0] - nx * 0.1, r[j][1] - nz * 0.1) - kerbAt(r[j][0] - nx * 0.1, r[j][1] - nz * 0.1);
      // (the footway: slabs a touch darker every other piece, lying on the raised ground)
      const last = paved ? [[TOP, up + 0.012, j & 1 ? cP : cQ], [TOP + pw, world.heightAt(r[j][0] + nx * (TOP + pw), r[j][1] + nz * (TOP + pw)) - gy + 0.012, j & 1 ? cP : cQ]] : [[TOP, up, cB], [TOP + BACK, -0.02, cB]];
      for (const [d, y, c] of [[-0.02, -0.04, cF], [EDGE * 0.6, up + 0.01, cF], [EDGE * 0.6, up + 0.01, cS], [TOP, up + 0.01, cS], ...last]) {
        pos.push(r[j][0] + nx * d, gy + y + 0.012, r[j][1] + nz * d);
        col.push(c.r, c.g, c.b);
      }
      if (j > j0) for (const q of strips) { const A = n - 6 + q, B = n + q; idx.push(A, B, A + 1, A + 1, B, B + 1); }
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
