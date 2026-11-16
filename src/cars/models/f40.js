// 1987 Ferrari F40 - mid-engined twin-turbo V8 berlinetta in Rosso Corsa: low wedge nose with pop-up lamps,
// sharp crease down the flanks, cabin far forward, louvred Lexan engine cover between raised rear wings,
// full-width wing on body-coloured end plates, black mesh tail with four round lamps and three centre exhausts.
import * as THREE from 'three';
import { Soup, keyed, cutArches, clipSoup, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, fromGeo, canvasTex, drawPlate, plate, assembleCar, tintPaint } from './kit.js';

// real car: 4358 x 1970 x 1124 mm, wheelbase 2450, track 1594 front / 1606 rear, overhang 1048 front / 860 rear,
// ground clearance 125 mm; 245/40 ZR17 on 8J front, 335/35 ZR17 on 13J rear, centre-lock five-spoke wheels
const DIMS = { length: 4.358, width: 1.97, height: 1.124, wheelbase: 2.45, track: 1.606, trackFront: 1.594, wheelRadius: 0.334, wheelRadiusFront: 0.314 };
const HZ = DIMS.wheelbase / 2, ZF = -HZ - 1.048, ZR = HZ + 0.86;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------------------------------------------------------------- section loft
// Like kit buildBody, but every section is a chain of key points (bottom centre -> side -> top centre), each a
// keyed (x, y) along z, joined by Hermite segments. Key points flagged sharp keep a hard edge (split normals);
// stations flagged sharp split the normals between rows. Each segment can go to its own material; returns
// right halves (x >= 0) keyed by material.
function loft({ stations, top, bot, kp, segs, bow = 0, bowN = 2.5 }) {
  const K = kp.length;
  const FX = kp.map((k) => keyed(k.x)), FY = kp.map((k) => keyed(k.y));
  const FB = segs.map((s) => keyed(s.bend || 0));
  const T = keyed(top), B = keyed(bot), BW = keyed(bow), BN = keyed(bowN);
  const start = []; let Mc = 0;
  for (const s of segs) { start.push(Mc); Mc += s.n + 1; }
  const hard = new Uint8Array(Mc);
  for (let s = 0; s < segs.length - 1; s++) if (kp[s + 1].sharp) hard[start[s] + segs[s].n] = 1;
  const unit = (x, y) => { const l = Math.hypot(x, y); return l > 1e-9 ? [x / l, y / l] : [0, 0]; };
  const rows = [];
  for (const st of stations) {
    const z = st.z;
    const yt = T(z), yb = Math.min(B(z), yt);
    const P = [];
    for (let i = 0; i < K; i++) {
      const x = i === 0 || i === K - 1 ? 0 : Math.max(0, FX[i](z));
      P.push([x, i === 0 ? yb : clamp(FY[i](z), yb, yt)]);
    }
    const ch = [];
    for (let i = 0; i < K - 1; i++) ch.push(unit(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
    const tan = (i) => {
      if (i === 0) return [1, 0];
      if (i === K - 1) return [-1, 0];
      if (kp[i].sharp) return null;
      return unit(ch[i - 1][0] + ch[i][0], ch[i - 1][1] + ch[i][1]);
    };
    let xmax = 0; for (const p of P) xmax = Math.max(xmax, p[0]);
    const bw = BW(z), bn = BN(z), dir = z < 0 ? 1 : -1;
    const row = new Float64Array(Mc * 3); let c = 0;
    for (let s = 0; s < K - 1; s++) {
      const A = P[s], Bp = P[s + 1], L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), u = ch[s], bend = FB[s](z);
      const rot = (a) => [u[0] * Math.cos(a) - u[1] * Math.sin(a), u[0] * Math.sin(a) + u[1] * Math.cos(a)];
      const t0 = tan(s) || rot(-bend), t1 = tan(s + 1) || rot(bend);
      const n = segs[s].n;
      for (let k = 0; k <= n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        const x = Math.max(0, h00 * A[0] + h10 * L * t0[0] + h01 * Bp[0] + h11 * L * t1[0]);
        const y = Math.min(yt, h00 * A[1] + h10 * L * t0[1] + h01 * Bp[1] + h11 * L * t1[1]);
        const q = xmax > 0 ? clamp(x / xmax, 0, 1) : 0;
        const g = bw > 0 ? 1 - Math.pow(Math.max(0, 1 - Math.pow(q, bn)), 1 / bn) : 0;
        row[c++] = x; row[c++] = y; row[c++] = z + dir * bw * g;
      }
    }
    rows.push(row);
    if (st.sharp) rows.push(row.slice());
  }
  const R = rows.length, nrm = rows.map(() => new Float64Array(Mc * 3));
  const face = (i0, j0, i1, j1, i2, j2, add) => {
    const a = rows[i0], b = rows[i1], c = rows[i2];
    const ux = b[j1 * 3] - a[j0 * 3], uy = b[j1 * 3 + 1] - a[j0 * 3 + 1], uz = b[j1 * 3 + 2] - a[j0 * 3 + 2];
    const vx = c[j2 * 3] - a[j0 * 3], vy = c[j2 * 3 + 1] - a[j0 * 3 + 1], vz = c[j2 * 3 + 2] - a[j0 * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (add) for (const [i, j] of [[i0, j0], [i1, j1], [i2, j2]]) { nrm[i][j * 3] += nx; nrm[i][j * 3 + 1] += ny; nrm[i][j * 3 + 2] += nz; }
    return nx * nx + ny * ny + nz * nz;
  };
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < Mc - 1; j++) { face(i, j, i, j + 1, i + 1, j, true); face(i, j + 1, i + 1, j + 1, i + 1, j, true); }
  for (let i = 0; i < R; i++) {
    const r = rows[i], n = nrm[i];
    let j = 0;
    while (j < Mc) {
      let k = j, sx = n[j * 3], sy = n[j * 3 + 1], sz = n[j * 3 + 2];
      while (k + 1 < Mc && !hard[k] && Math.hypot(r[(k + 1) * 3] - r[k * 3], r[(k + 1) * 3 + 1] - r[k * 3 + 1], r[(k + 1) * 3 + 2] - r[k * 3 + 2]) < 1e-6) { k++; sx += n[k * 3]; sy += n[k * 3 + 1]; sz += n[k * 3 + 2]; }
      for (let q = j; q <= k; q++) { n[q * 3] = sx; n[q * 3 + 1] = sy; n[q * 3 + 2] = sz; }
      j = k + 1;
    }
    n[0] = 0; n[(Mc - 1) * 3] = 0;
    for (let q = 0; q < Mc; q++) { const l = Math.hypot(n[q * 3], n[q * 3 + 1], n[q * 3 + 2]) || 1; n[q * 3] /= l; n[q * 3 + 1] /= l; n[q * 3 + 2] /= l; }
  }
  const out = {};
  const soupOf = (k) => out[k] || (out[k] = new Soup());
  // faces of an 'under' segment that do not face the ground (nose and tail ends) stay paint
  const emit = (mat, i0, j0, i1, j1, i2, j2) => {
    const l2 = face(i0, j0, i1, j1, i2, j2, false);
    if (l2 < 1e-18) return;
    let dst = soupOf(mat);
    if (mat === 'under') {
      const a = rows[i0], b = rows[i1], c = rows[i2];
      const ux = b[j1 * 3] - a[j0 * 3], uz = b[j1 * 3 + 2] - a[j0 * 3 + 2], vx = c[j2 * 3] - a[j0 * 3], vz = c[j2 * 3 + 2] - a[j0 * 3 + 2];
      if ((uz * vx - ux * vz) / Math.sqrt(l2) > -0.6) dst = soupOf('paint');
    }
    for (const [i, j] of [[i0, j0], [i1, j1], [i2, j2]]) {
      dst.p.push(rows[i][j * 3], rows[i][j * 3 + 1], rows[i][j * 3 + 2]);
      dst.n.push(nrm[i][j * 3], nrm[i][j * 3 + 1], nrm[i][j * 3 + 2]);
    }
  };
  segs.forEach((s, si) => {
    const mat = s.mat || 'paint';
    for (let i = 0; i < R - 1; i++) for (let j = start[si]; j < start[si] + s.n; j++) { emit(mat, i, j, i, j + 1, i + 1, j); emit(mat, i, j + 1, i + 1, j + 1, i + 1, j); }
  });
  return out;
}
// triangles with any vertex passing fn(x, y, z): a cheap pre-filter so decals and probes scan only a region
function region(s, fn) {
  const o = new Soup(), P = s.p, N = s.n;
  for (let t = 0; t < P.length; t += 9) {
    if (!fn(P[t], P[t + 1], P[t + 2]) && !fn(P[t + 3], P[t + 4], P[t + 5]) && !fn(P[t + 6], P[t + 7], P[t + 8])) continue;
    for (let k = 0; k < 9; k++) { o.p.push(P[t + k]); o.n.push(N[t + k]); }
  }
  return o;
}

// ---------------------------------------------------------------- body shape
// Key points of the right half, as keyed curves along z.
const KP = {
  floorX: [[ZF, 0.45], [-2.15, 0.66], [-1.9, 0.76], [-1.5, 0.8], [-0.8, 0.83], [0.6, 0.85], [1.6, 0.86], [2.0, 0.84], [ZR, 0.8]],
  sillX: [[ZF, 0.62], [-2.15, 0.79], [-1.9, 0.855], [-1.5, 0.89], [-0.8, 0.915], [0.3, 0.925], [0.8, 0.95], [1.6, 0.963], [2.0, 0.955], [ZR, 0.925]],
  sillY: [[ZF, 0.2], [-2.0, 0.17], [1.6, 0.17], [2.0, 0.3], [ZR, 0.32]],
  lowX: [[ZF, 0.74], [-2.15, 0.85], [-1.9, 0.9], [-1.5, 0.923], [-0.8, 0.932], [0.2, 0.936], [0.5, 0.946], [0.85, 0.97], [1.2, 0.978], [1.6, 0.98], [2.0, 0.972], [ZR, 0.948]],
  lowY: [[ZF, 0.3], [1.6, 0.3], [2.0, 0.36], [ZR, 0.36]],
  // the body-side crease
  crX: [[ZF, 0.8], [-2.15, 0.875], [-1.9, 0.915], [-1.5, 0.935], [-1.0, 0.942], [-0.5, 0.944], [0.2, 0.948], [0.5, 0.958], [0.85, 0.98], [1.2, 0.986], [1.6, 0.986], [2.0, 0.979], [ZR, 0.96]],
  crY: [[ZF, 0.43], [-2.15, 0.45], [-1.9, 0.475], [-1.5, 0.5], [-1.0, 0.52], [-0.5, 0.535], [0.3, 0.55], [1.0, 0.565], [2.0, 0.58], [ZR, 0.58]],
  // shoulder: front wing top edge -> waistline under the side glass -> rear wing top edge
  shX: [[ZF, 0.79], [-2.15, 0.87], [-1.9, 0.91], [-1.5, 0.93], [-1.1, 0.937], [-0.95, 0.93], [-0.8, 0.9], [-0.6, 0.86], [0.0, 0.84], [0.35, 0.845], [0.6, 0.895], [0.9, 0.945], [1.225, 0.966], [1.6, 0.973], [2.0, 0.966], [ZR, 0.95]],
  shY: [[ZF, 0.49], [-2.15, 0.528], [-1.9, 0.578], [-1.5, 0.66], [-1.225, 0.712], [-1.0, 0.742], [-0.85, 0.748], [-0.6, 0.755], [0.0, 0.78], [0.35, 0.8], [0.6, 0.835], [0.9, 0.865], [1.225, 0.885], [1.6, 0.896], [2.0, 0.9], [ZR, 0.9]],
  // inner edge of the wing tops (on the side glass along the cabin)
  inX: [[ZF, 0.58], [-2.15, 0.66], [-1.9, 0.69], [-1.5, 0.7], [-1.0, 0.7], [-0.85, 0.75], [-0.7, 0.815], [-0.4, 0.825], [0.0, 0.802], [0.35, 0.804], [0.6, 0.8], [0.9, 0.77], [1.225, 0.75], [1.6, 0.75], [2.0, 0.76], [ZR, 0.76]],
  inY: [[ZF, 0.49], [-2.15, 0.531], [-1.9, 0.582], [-1.5, 0.664], [-1.225, 0.716], [-1.0, 0.745], [-0.85, 0.757], [-0.7, 0.77], [-0.4, 0.795], [0.0, 0.835], [0.35, 0.853], [0.6, 0.866], [0.9, 0.88], [1.225, 0.895], [1.6, 0.905], [2.0, 0.91], [ZR, 0.91]],
  // bonnet edge -> A-pillar / roof edge -> engine cover edge
  dX: [[ZF, 0.5], [-2.15, 0.6], [-1.9, 0.63], [-1.5, 0.645], [-1.0, 0.65], [-0.85, 0.7], [-0.6, 0.675], [-0.3, 0.64], [-0.1, 0.605], [0.2, 0.585], [0.45, 0.57], [0.7, 0.555], [1.225, 0.55], [1.8, 0.565], [ZR, 0.59]],
  dY: [[ZF, 0.49], [-2.15, 0.515], [-1.9, 0.56], [-1.5, 0.638], [-1.225, 0.692], [-1.0, 0.733], [-0.86, 0.762], [-0.7, 0.83], [-0.4, 0.96], [-0.12, 1.075], [0.1, 1.095], [0.4, 1.083], [0.7, 1.055], [1.225, 0.997], [1.75, 0.942], [2.05, 0.908], [ZR, 0.908]],
  // centre line top
  cY: [[ZF, 0.465], [-2.15, 0.5], [-1.9, 0.548], [-1.5, 0.628], [-1.225, 0.682], [-1.0, 0.725], [-0.88, 0.755], [-0.5, 0.94], [-0.12, 1.105], [0.1, 1.124], [0.4, 1.108], [0.7, 1.078], [1.225, 1.018], [1.75, 0.955], [2.05, 0.918], [ZR, 0.918]],
  top: [[ZF, 0.465], [ZF + 0.006, 0.49], [-2.15, 0.535], [-1.9, 0.585], [-1.5, 0.668], [-1.225, 0.72], [-1.0, 0.75], [-0.88, 0.765], [-0.5, 0.96], [-0.12, 1.11], [0.1, 1.124], [0.4, 1.11], [0.7, 1.08], [1.225, 1.022], [1.75, 0.96], [2.05, 0.922], [2.066, 0.92], [2.074, 0.86], [ZR, 0.32]],
  bot: [[ZF, 0.465], [ZF + 0.006, 0.42], [ZF + 0.02, 0.3], [ZF + 0.035, 0.2], [ZF + 0.05, 0.15], [-2.15, 0.135], [-1.9, 0.128], [-1.5, 0.125], [1.45, 0.125], [1.75, 0.17], [2.0, 0.27], [2.066, 0.3], [ZR, 0.32]],
};
const ZTAIL = 2.066;
function bodyStations() {
  const zs = [], add = (a, b, n) => { for (let i = 0; i < n; i++) zs.push(a + (b - a) * i / n); };
  add(ZF, ZF + 0.012, 3); add(ZF + 0.012, ZF + 0.06, 6); add(ZF + 0.06, ZF + 0.14, 4);
  add(ZF + 0.14, 2.0, Math.round((2.0 - ZF - 0.14) / 0.038)); add(2.0, ZTAIL, 5); add(ZTAIL, ZR, 7); zs.push(ZR);
  return zs.map((z) => ({ z, sharp: Math.abs(z - ZTAIL) < 1e-9 }));
}
function f40Body() {
  return loft({
    stations: bodyStations(), top: KP.top, bot: KP.bot,
    kp: [
      { x: 0, y: 0 },
      { x: KP.floorX, y: 0 },
      { x: KP.sillX, y: KP.sillY },
      { x: KP.lowX, y: KP.lowY },
      { x: KP.crX, y: KP.crY, sharp: true },
      { x: KP.shX, y: KP.shY, sharp: true },
      { x: KP.inX, y: KP.inY },
      { x: KP.dX, y: KP.dY },
      { x: 0, y: KP.cY },
    ],
    segs: [
      { n: 4, mat: 'under' }, { n: 4 }, { n: 3 }, { n: 5, bend: 0.0 }, { n: 6, bend: 0.02 },
      { n: 4, bend: 0.04 }, { n: 6 }, { n: 10 },
    ],
    bow: [[ZF, 0.13], [-2.15, 0.085], [-2.0, 0.04], [-1.8, 0.0], [1.85, 0.0], [ZR, 0.05]],
    bowN: [[ZF, 2.6], [-1.8, 2.8], [1.85, 3.2], [ZR, 3.4]],
  });
}

// ---------------------------------------------------------------- small geometry helpers
// triangle with a wanted facing: winding flipped if needed so the front face looks along n
function triN(s, a, b, c, n) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
  if (fx * n[0] + fy * n[1] + fz * n[2] < 0) [b, c] = [c, b];
  for (const p of [a, b, c]) { s.p.push(p[0], p[1], p[2]); s.n.push(n[0], n[1], n[2]); }
}
const quadN = (s, a, b, c, d, n) => { triN(s, a, b, c, n); triN(s, a, c, d, n); };
// Extruded profile in (z, y), thickness along x, centred on x0.
function finSoup(pts, x0, th, bevel = 0.006) {
  const sh = new THREE.Shape();
  pts.forEach((p, k) => (k ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -th / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(x0, 0, 0);
  return fromGeo(g);
}
const circ = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cy + r * Math.sin(i / n * Math.PI * 2)]);
// disc facing +z (uv 0..1 across it)
const disc = (r, seg, p) => fromGeo(new THREE.CircleGeometry(r, seg), { p });

// ---------------------------------------------------------------- wheels
function lathe(prof, pal, seg = 44) {
  const g = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  g.rotateZ(-Math.PI / 2);
  return fromGeo(g, null, pal);
}
function flatNormals(s) {
  for (let t = 0; t < s.p.length; t += 9) {
    const P = s.p, ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 9; k += 3) { s.n[t + k] = nx; s.n[t + k + 1] = ny; s.n[t + k + 2] = nz; }
  }
  return s;
}
// Two-piece five-spoke star wheel with a centre-lock nut. Axis on X, outer face toward +X.
// face / hub: x of the spoke face at the rim and at the hub (the star is dished between them).
function starWheel({ R, width, rimR, face, hub }) {
  const s = new Soup(), hw = width / 2, sh = R - rimR, rf = rimR - 0.018;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.014, -hw * 0.92], [R - 0.003, -hw * 0.78], [R, -hw * 0.5], [R, hw * 0.5],
    [R - 0.003, hw * 0.78], [R - 0.014, hw * 0.92], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 48));
  // barrel, polished outer lip, the dish down to the spokes, dark well behind them
  s.add(lathe([[rimR - 0.013, hw * 0.78], [rimR - 0.013, -hw * 0.72]], 'darkalloy', 40));
  s.add(lathe([[rimR - 0.004, hw * 0.76], [rimR + 0.007, hw * 0.86], [rimR + 0.001, hw * 0.93], [rimR - 0.012, hw * 0.9], [rimR - 0.016, hw * 0.82], [rf, face + 0.004]], 'alloy', 48));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.55, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  // ventilated disc and hat seen through the spokes
  s.add(cyl(0.165, 0.165, 0.03, 36, { p: [hub - 0.075, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  s.add(cyl(0.09, 0.09, 0.04, 24, { p: [hub - 0.05, 0, 0], r: [0, 0, Math.PI / 2] }, 'darkalloy'));
  // the star: five broad straight spokes with round-cornered windows
  const sp = new THREE.Shape();
  sp.absarc(0, 0, rf, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a0 = Math.PI / 2 + (i + 0.5) * Math.PI * 2 / 5, r1 = rf * 0.4, r2 = rf * 0.9, pts = [];
    const hwA = (r, w) => Math.PI / 5 - Math.asin(Math.min(0.95, w / r));
    const h1 = hwA(r1, rf * 0.15), h2 = hwA(r2, rf * 0.125);
    for (let k = 0; k <= 2; k++) { const a = a0 - h1 + h1 * k; pts.push([r1 * Math.cos(a), r1 * Math.sin(a)]); }
    for (let k = 0; k <= 8; k++) { const a = a0 + h2 - 2 * h2 * k / 8; pts.push([r2 * Math.cos(a), r2 * Math.sin(a)]); }
    const rp = rpoly(pts, rf * 0.1, 4), path = new THREE.Path();
    rp.forEach((p, k) => (k ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    path.closePath(); sp.holes.push(path);
  }
  const g = new THREE.ExtrudeGeometry(sp, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 });
  g.rotateY(Math.PI / 2);
  const star = fromGeo(g, null, 'alloy'), P = star.p, Nn = star.n;
  for (let i = 0; i < P.length; i += 3) {
    const r = Math.hypot(P[i + 1], P[i + 2]), q = clamp(r / rf, 0, 1), d = (face - hub) * 1.3 * Math.pow(q, 0.3) / rf;
    P[i] += hub + (face - hub) * Math.pow(q, 1.3) - 0.011;
    if (Math.abs(Nn[i]) > 0.5 && r > 1e-6) {
      const nx = Nn[i], ny = -nx * d * P[i + 1] / r, nz = -nx * d * P[i + 2] / r, l = Math.hypot(nx, ny, nz);
      Nn[i] = nx / l; Nn[i + 1] = ny / l; Nn[i + 2] = nz / l;
    }
  }
  s.add(star);
  // rim bolts of the two-piece rim
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    s.add(cyl(0.0045, 0.0045, 0.008, 6, { p: [face + 0.012, Math.sin(a) * rf * 0.955, Math.cos(a) * rf * 0.955], r: [0, 0, -Math.PI / 2] }, 'steel'));
  }
  // centre-lock: hub boss, big hexagon nut, cap
  s.add(cyl(0.062, 0.07, 0.03, 24, { p: [hub + 0.02, 0, 0], r: [0, 0, -Math.PI / 2] }, 'alloy'));
  s.add(cyl(0.052, 0.052, 0.036, 6, { p: [hub + 0.05, 0, 0], r: [Math.PI / 6, 0, -Math.PI / 2] }, 'chrome'));
  s.add(cyl(0.032, 0.036, 0.014, 18, { p: [hub + 0.074, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  s.add(cyl(0.018, 0.018, 0.006, 12, { p: [hub + 0.083, 0, 0], r: [0, 0, -Math.PI / 2] }, 'chrome'));
  return s;
}

// ---------------------------------------------------------------- textures
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#140202'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w / 2;
    if (!glow) {
      const gr = g.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 0.92);
      gr.addColorStop(0, '#ff5a4a'); gr.addColorStop(0.35, '#d0100c'); gr.addColorStop(1, '#5a0303');
      g.fillStyle = gr;
    } else g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(cx, cy, R * 0.92, 0, 7); g.fill();
    g.strokeStyle = glow ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.3)'; g.lineWidth = 3;
    for (let r = R * 0.18; r < R * 0.9; r += R * 0.14) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    if (!glow) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - R * 0.3, cy - R * 0.38, R * 0.22, R * 0.1, -0.5, 0, 7); g.fill(); }
  };
  const head = (glow) => (g, w, h) => {
    // u: 0 = inboard, 1 = outboard. Clear cover over the driving/parking lamp (inboard) and the indicator (outboard)
    g.fillStyle = glow ? '#000' : '#1a1d20'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#f2f5f7'); gr.addColorStop(1, glow ? '#ddd' : '#9aa3aa');
    g.fillStyle = gr; g.fillRect(w * 0.03, h * 0.16, w * 0.6, h * 0.68);
    if (!glow) {
      g.strokeStyle = 'rgba(40,50,60,0.45)'; g.lineWidth = 2;
      for (let x = w * 0.05; x < w * 0.63; x += 9) { g.beginPath(); g.moveTo(x, h * 0.16); g.lineTo(x, h * 0.84); g.stroke(); }
      g.fillStyle = '#e8800f'; g.fillRect(w * 0.67, h * 0.16, w * 0.3, h * 0.68);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let y = h * 0.22; y < h * 0.84; y += 8) { g.beginPath(); g.moveTo(w * 0.67, y); g.lineTo(w * 0.97, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, w, h * 0.1);
    }
  };
  return { tailMap: canvasTex(128, 128, tail(false)), tailGlow: canvasTex(128, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}

const AW = 1024, AH = 1024;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_F40 = uvr(0, 190, 300, 110), A_SHIELD = uvr(320, 190, 100, 140);
const A_HORSE = uvr(440, 190, 90, 120), A_SCRIPT = uvr(540, 190, 300, 90);
const A_MESH = uvr(0, 340, 512, 256), A_GRILLE = uvr(520, 340, 256, 128), A_NACAV = uvr(800, 340, 96, 256);
const A_LOUV = uvr(0, 610, 512, 300), A_NACAH = uvr(520, 480, 256, 96), A_VENT = uvr(520, 600, 256, 128), A_FVENT = uvr(800, 620, 96, 192);

function horse(g, x, y, s, col) {
  // stylised prancing horse, drawn in a 100 x 130 box
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.fillStyle = col;
  g.beginPath();
  g.moveTo(48, 6); g.lineTo(58, 2); g.lineTo(62, 10); g.lineTo(72, 16); g.lineTo(70, 24); g.lineTo(60, 22);
  g.lineTo(56, 34); g.lineTo(70, 40); g.lineTo(84, 32); g.lineTo(90, 38); g.lineTo(74, 50); g.lineTo(60, 48);
  g.lineTo(58, 62); g.lineTo(64, 80); g.lineTo(78, 92); g.lineTo(80, 110); g.lineTo(72, 112); g.lineTo(70, 96);
  g.lineTo(56, 88); g.lineTo(46, 96); g.lineTo(52, 120); g.lineTo(44, 122); g.lineTo(36, 98); g.lineTo(38, 84);
  g.lineTo(30, 76); g.lineTo(18, 88); g.lineTo(8, 84); g.lineTo(22, 70); g.lineTo(30, 56); g.lineTo(36, 36);
  g.lineTo(38, 22); g.closePath(); g.fill();
  g.restore();
}
// NACA planform in a w x h box: narrow end at t = 0, mouth at t = 1; at(t, s) maps (along, across in -1..1) to canvas
function naca(g, at) {
  const half = (t) => 0.28 + 0.72 * Math.pow(t, 1.5);
  const edge = (sgn) => Array.from({ length: 21 }, (_, i) => at(i / 20, sgn * half(i / 20)));
  const L = edge(-1), Rr = edge(1).reverse();
  g.beginPath(); [...L, ...Rr].forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  const a = at(0, 0), b = at(1, 0), gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
  gr.addColorStop(0, '#b3130f'); gr.addColorStop(0.5, '#8e0d0b'); gr.addColorStop(0.78, '#4a0606'); gr.addColorStop(0.84, '#1a0202'); gr.addColorStop(0.85, '#030303'); gr.addColorStop(1, '#030303');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = '#250303'; g.lineWidth = 3; g.stroke();
}
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '040 FER');
    // chrome "F40" script
    g.save(); g.translate(150, 248); g.transform(1, 0, -0.22, 1, 0, 0);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic bold 104px Georgia, "Times New Roman", serif';
    g.lineWidth = 8; g.strokeStyle = '#2a2a2a'; g.strokeText('F40', 0, 0);
    g.fillStyle = '#e6e8ea'; g.fillText('F40', 0, 0); g.restore();
    // yellow shield with tricolore and black horse
    g.save(); g.translate(320, 190);
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(2, 2); g.lineTo(98, 2); g.lineTo(98, 90); g.quadraticCurveTo(98, 122, 50, 138); g.quadraticCurveTo(2, 122, 2, 90); g.closePath(); g.fill();
    g.fillStyle = '#f6cf14'; g.beginPath(); g.moveTo(8, 8); g.lineTo(92, 8); g.lineTo(92, 88); g.quadraticCurveTo(92, 116, 50, 131); g.quadraticCurveTo(8, 116, 8, 88); g.closePath(); g.fill();
    g.fillStyle = '#0b8a3a'; g.fillRect(8, 8, 28, 12); g.fillStyle = '#fff'; g.fillRect(36, 8, 28, 12); g.fillStyle = '#d61a1a'; g.fillRect(64, 8, 28, 12);
    horse(g, 22, 28, 58, '#0a0a0a');
    g.restore();
    // chrome horse and script
    horse(g, 444, 192, 88, '#d8dadc');
    g.save(); g.translate(690, 238); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic bold 70px Georgia, "Times New Roman", serif';
    g.lineWidth = 6; g.strokeStyle = '#222'; g.strokeText('Ferrari', 0, 0); g.fillStyle = '#e2e4e6'; g.fillText('Ferrari', 0, 0); g.restore();
    // tail: black diamond mesh
    g.fillStyle = '#050505'; g.fillRect(0, 340, 512, 256);
    g.save(); g.beginPath(); g.rect(0, 340, 512, 256); g.clip();
    g.strokeStyle = '#34363a'; g.lineWidth = 2;
    for (let k = -256; k < 512 + 256; k += 12) {
      g.beginPath(); g.moveTo(k, 340); g.lineTo(k + 256, 596); g.stroke();
      g.beginPath(); g.moveTo(k + 256, 340); g.lineTo(k, 596); g.stroke();
    }
    g.restore();
    // intake grille: fine black honeycomb-ish mesh
    g.fillStyle = '#030303'; g.fillRect(520, 340, 256, 128);
    g.save(); g.beginPath(); g.rect(520, 340, 256, 128); g.clip();
    g.strokeStyle = '#1e2022'; g.lineWidth = 2;
    for (let y = 340; y < 468; y += 8) for (let x = 520 + ((y / 8) % 2) * 5; x < 776; x += 10) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.stroke(); }
    g.restore();
    // NACA ducts: vertical (mouth at the bottom) and horizontal (mouth at the right)
    naca(g, (t, s) => [848 + s * 44, 344 + t * 248]);
    naca(g, (t, s) => [524 + t * 248, 528 + s * 44]);
    // clear Lexan engine cover: the engine bay (red crackle plenums, silver pipework) seen through two banks
    // of louvre slats. Region top = front of the cover, bottom = rear.
    g.save(); g.beginPath(); g.rect(0, 610, 512, 300); g.clip();
    const bay = g.createLinearGradient(0, 610, 0, 910);
    bay.addColorStop(0, '#0c0d0f'); bay.addColorStop(0.5, '#1d1f22'); bay.addColorStop(1, '#101113');
    g.fillStyle = bay; g.fillRect(0, 610, 512, 300);
    g.fillStyle = '#3c3f44'; g.fillRect(226, 640, 60, 250);
    for (const x of [96, 330]) {
      const pg = g.createLinearGradient(x, 0, x + 86, 0);
      pg.addColorStop(0, '#5a0606'); pg.addColorStop(0.5, '#b01512'); pg.addColorStop(1, '#5a0606');
      g.fillStyle = pg; g.beginPath(); g.roundRect(x, 650, 86, 210, 18); g.fill();
      g.save(); g.translate(x + 43, 755); g.rotate(-Math.PI / 2); g.fillStyle = '#e8c96a'; g.font = 'bold 22px Arial, Helvetica, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FERRARI', 0, 0); g.restore();
    }
    g.strokeStyle = '#4a4e54'; g.lineWidth = 5;
    for (const x of [40, 472]) { g.beginPath(); g.moveTo(x, 640); g.bezierCurveTo(x, 760, x === 40 ? 120 : 392, 820, x === 40 ? 150 : 362, 900); g.stroke(); }
    g.restore();
    for (let col = 0; col < 2; col++) for (let i = 0; i < 11; i++) {
      const x0 = 8 + col * 252, y0 = 616 + i * 26.5;
      g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(x0, y0, 244, 13);
      g.fillStyle = 'rgba(190,200,210,0.55)'; g.fillRect(x0, y0 + 13, 244, 2.5);
    }
    g.fillStyle = '#070809'; g.fillRect(254, 610, 6, 300);
    // engine-cover tail vent: black slats
    g.fillStyle = '#060606'; g.fillRect(520, 600, 256, 128);
    for (let i = 0; i < 9; i++) { g.fillStyle = '#2c2e31'; g.fillRect(520, 606 + i * 13.5, 256, 4); }
    g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(520, 600, 256, 128);
    // vertical vent behind the front wheels: horizontal louvres
    g.fillStyle = '#040404'; g.fillRect(800, 620, 96, 192);
    for (let i = 0; i < 9; i++) { g.fillStyle = '#26282b'; g.fillRect(800, 628 + i * 20, 96, 6); }
  });
}


// ---------------------------------------------------------------- the car
const quadUV = (r, a, b, c, d, n) => { const q = new Soup(); quadN(q, a, b, c, d, n); q.uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); return q.uvRect(r); };
export function buildF40() {
  const half = f40Body();
  const AF = { z: -HZ, y: 0.318, r: 0.358 }, AB = { z: HZ, y: 0.34, r: 0.376 };
  const xwF = 0.66, xwR = 0.62;
  const c1 = cutArches(half.paint, [AF], { halfWidth: 0.985, depth: 0.985 - xwF });
  const c2 = cutArches(c1.soup, [AB], { halfWidth: 0.985, depth: 0.985 - xwR });
  const archFn = (a, xw) => (v) => Math.max((v[2] - a.z) ** 2 + (v[1] - a.y) ** 2 - a.r * a.r, xw - Math.abs(v[0]));
  const under = clipSoup(clipSoup(half.under, archFn(AF, xwF)), archFn(AB, xwR)).pal('plastic').sym();

  // tail: open the mesh panel in the rear face
  const TP = { x: 0.912, y0: 0.45, y1: 0.85 };
  const tpy = (TP.y0 + TP.y1) / 2, tph = (TP.y1 - TP.y0) / 2;
  const tpf = (x, y) => Math.pow(Math.pow(Math.abs(x) / TP.x, 10) + Math.pow(Math.abs(y - tpy) / tph, 10), 0.1) - 1;
  const shellH = clipSoup(c2.soup, (v) => (v[2] < 2.0 ? 1 : tpf(v[0], v[1])));

  // probes and decal sets on regions of the right half (results mirrored with sym())
  const reg = (fn) => region(shellH, fn);
  const prTail = probe(region(half.paint, (x, y, z) => z > 1.95));
  const prRear = probe(region(half.paint, (x, y, z) => z > 1.7 && x > 0.7));
  const prNose = probe(region(half.paint, (x, y, z) => z < -1.85));
  const prCab = probe(region(half.paint, (x, y, z) => z > -1.1 && z < -0.4));
  const dS = decals(reg((x) => x > 0.5));
  const dDeck = decals(reg((x, y, z) => z > 0.3 && y > 0.75));
  const dCab = decals(reg((x, y, z) => z > -1.0 && z < -0.05 && y > 0.7));
  const dBon = decals(reg((x, y, z) => z < -0.8 && y > 0.45));
  const dNose = decals(reg((x, y, z) => z < -1.85));
  const dTail = decals(reg((x, y, z) => z > 1.95));

  const paint = new Soup().add(shellH.sym()), glass = new Soup(), pal = new Soup().add(c1.liner, c2.liner, under);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();
  const H = keyed(KP.shY), D = keyed(KP.dY), DX = keyed(KP.dX), CRY = keyed(KP.crY);
  const lw = 0.0065;

  // --- glazing: wrap-round screen drawn in plan between the A-pillars, sliding side windows + fixed quarter light
  const wsR = [];
  for (let z = -0.835; z <= -0.159; z += 0.0525) wsR.push([DX(z) - 0.065, z]);
  const screen = rpoly([...wsR.map(([x, z]) => [-x, z]).reverse(), ...wsR], 0.03, 3);
  const wsO = { minFacing: 0.25, filter: (v) => v[2] > -0.95 && v[2] < -0.05 && v[1] > 0.72 };
  pal.add(dCab.top(grow(screen, 0.016), { offset: 0.003, ...wsO }).pal('plastic').sym());
  glass.add(dCab.top(screen, { offset: 0.005, ...wsO }).sym());
  let zA = -0.82; while (D(zA) - H(zA) < 0.075) zA += 0.01;
  const topE = [], botE = [];
  for (let z = zA; z <= 0.3001; z += 0.05) topE.push([z, D(z) - 0.04]);
  for (let z = 0.62; z >= zA; z -= 0.05) botE.push([z, H(z) + 0.01]);
  const dlo = rpoly([...topE, [0.36, D(0.36) - 0.045], ...botE], 0.02, 3);
  pal.add(dS.side(grow(dlo, 0.011), { offset: 0.003, minFacing: 0.1 }).pal('plastic').sym());
  glass.add(dS.side(dlo, { offset: 0.005, minFacing: 0.1 }).sym());
  // B-post between door glass and quarter light; frame of the small sliding pane in the Lexan door window
  const slide = rpoly([[-0.16, H(-0.16) + 0.045], [0.33, H(0.33) + 0.045], [0.33, D(0.33) - 0.075], [-0.1, D(-0.1) - 0.065]], 0.015, 2);
  pal.add(dS.side([...stroke([[0.4, H(0.4)], [0.38, D(0.38)]], 0.02), ...stroke([...slide, slide[0]], 0.009)], { offset: 0.0065, minFacing: 0.1 }).pal('plastic').sym());

  // --- Lexan engine cover: clear panel with louvre banks, vented tail section under the wing, frame
  const deck = { minFacing: 0.45, filter: (v) => v[2] > 0.35 && Math.abs(v[0]) < 0.62 };
  const lex = rpoly([[-0.47, 0.5], [0.47, 0.5], [0.48, 1.56], [-0.48, 1.56]], 0.04);
  pal.add(dDeck.top(grow(rpoly([[-0.47, 0.42], [0.47, 0.42], [0.48, 1.56], [-0.48, 1.56]], 0.04), 0.016), { offset: 0.003, ...deck }).pal('plastic').sym());
  glass.add(dDeck.top(rpoly([[-0.47, 0.42], [0.47, 0.42], [0.47, 0.52], [-0.47, 0.52]], 0.02), { offset: 0.005, ...deck }).sym());
  atlas.add(dDeck.top(lex, { offset: 0.006, ...deck, box: [-0.48, 1.56, 0.48, 0.46] }).uvRect(A_LOUV).sym());
  atlas.add(dDeck.top(rpoly([[-0.44, 1.64], [0.44, 1.64], [0.44, 1.98], [-0.44, 1.98]], 0.02), { offset: 0.004, ...deck, box: [-0.44, 1.98, 0.44, 1.64] }).uvRect(A_VENT).sym());
  // NACA intakes on the rear wing tops, four louvres behind the rear wheels
  const shelf = { offset: 0.004, minFacing: 0.4, filter: (v) => v[0] > 0.7 && v[2] > 0.5 };
  atlas.add(dDeck.top(rect(0.775, 0.6, 0.945, 1.13), { ...shelf, box: [0.775, 1.13, 0.945, 0.6] }).uvRect(A_NACAV).sym());
  const hl = [];
  for (let i = 0; i < 4; i++) hl.push(rect(0.8, 1.42 + i * 0.065, 0.93, 1.42 + i * 0.065 + 0.03, 0.008));
  pal.add(dDeck.top(hl, { ...shelf }).pal('well').sym());

  // --- flanks: door NACA, big intake behind the door, vent behind the front wheel, indent line, shut lines
  const sideO = { offset: 0.004, minFacing: 0.15 };
  atlas.add(dS.side(rect(-0.34, 0.33, 0.34, 0.47), { ...sideO, box: [-0.34, 0.33, 0.34, 0.47] }).uvRect(A_NACAH).sym());
  const intake = rpoly([[0.45, 0.6], [0.8, 0.612], [0.885, 0.65], [0.87, 0.79], [0.76, 0.845], [0.45, 0.82]], 0.025, 3);
  pal.add(dS.side(grow(intake, 0.012), { ...sideO, offset: 0.003 }).pal('well').sym());
  atlas.add(dS.side(grow(intake, -0.018), { ...sideO, offset: 0.005 }).uvRect(A_GRILLE).sym());
  atlas.add(dS.side(rect(-0.855, 0.3, -0.8, 0.53), { ...sideO, box: [-0.855, 0.3, -0.8, 0.53] }).uvRect(A_FVENT).sym());
  const runs = [], inArch = (z, y) => [AF, AB].some((a) => Math.hypot(z - a.z, y - a.y) < a.r + 0.014);
  let cur = [];
  for (let z = ZF + 0.12; z <= 2.045; z += 0.02) {
    const y = CRY(z) - 0.009;
    if (inArch(z, y)) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push([z, y]);
  }
  if (cur.length > 1) runs.push(cur);
  pal.add(dS.side(runs.flatMap((r) => stroke(r, 0.016)), { offset: 0.0052, minFacing: 0.2 }).pal('plastic').sym());
  pal.add(dS.side([
    ...stroke([[-0.785, 0.2], [-0.785, H(-0.785) + 0.005]], lw), ...stroke([[0.42, 0.2], [0.42, H(0.42) + 0.005]], lw), ...stroke([[-0.785, 0.2], [0.42, 0.2]], lw),
  ], { offset: 0.0055 }).pal('line').sym());

  // --- bonnet: cowl shut line, retracted pop-up lamps, NACA ducts on the lid and the wing tops
  const topF = { offset: 0.004, minFacing: 0.3, filter: (v) => v[2] < -0.8 };
  pal.add(dBon.top(stroke([[-0.7, -0.855], [0.7, -0.855]], lw), { ...topF, offset: 0.0055 }).pal('line').sym());
  const pop = rpoly([[0.6, -1.99], [0.9, -1.93], [0.92, -1.66], [0.62, -1.66]], 0.02, 3);
  pal.add(dBon.top(stroke([...pop, pop[0]], lw), { ...topF, offset: 0.0055 }).pal('line').sym());
  for (const [x0, x1, z0, z1] of [[0.08, 0.26, -1.62, -1.08], [0.74, 0.86, -1.5, -1.2]]) {
    atlas.add(dBon.top(rect(x0, z0, x1, z1), { ...topF, box: [x0, z1, x1, z0] }).uvRect(A_NACAV).sym());
  }

  // --- tail: recessed black mesh panel with four round lamps, plate, badges
  const N = 72, ring = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const x = TP.x * Math.sign(c) * Math.pow(Math.abs(c), 0.2), y = tpy + tph * Math.sign(s) * Math.pow(Math.abs(s), 0.2);
    ring.push([x, y, prTail.rearZ(Math.abs(x) * 0.995, tpy + (y - tpy) * 0.995)]);
  }
  const zMesh = 2.03;
  for (let i = 0; i < N; i++) {
    const A = ring[i], B = ring[(i + 1) % N], nx = -(A[0] + B[0]) / 2, ny = -((A[1] + B[1]) / 2 - tpy) * 2.4, l = Math.hypot(nx, ny) || 1;
    quadN(pal, [A[0], A[1], A[2] + 0.002], [B[0], B[1], B[2] + 0.002], [B[0], B[1], zMesh], [A[0], A[1], zMesh], [nx / l, ny / l, 0]);
  }
  atlas.add(quadUV(A_MESH, [-TP.x, TP.y0, zMesh], [TP.x, TP.y0, zMesh], [TP.x, TP.y1, zMesh], [-TP.x, TP.y1, zMesh], [0, 0, 1]));
  const LR = 0.066, LY = 0.69;
  for (const cx of [0.575, 0.785]) {
    for (const sx of [1, -1]) {
      pal.add(cyl(LR + 0.013, LR + 0.016, 0.03, 32, { p: [sx * cx, LY, zMesh + 0.015], r: [Math.PI / 2, 0, 0] }, 'darkalloy'));
      tail.add(disc(LR, 32, [sx * cx, LY, zMesh + 0.0305]));
      if (cx < 0.6) reverse.add(disc(0.022, 16, [sx * cx, LY, zMesh + 0.032]));
    }
  }
  const pl = plate([0, 0.555, zMesh + 0.012], A_PLATE, {});
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(box(0.2, 0.022, 0.03, { p: [0, 0.626, zMesh + 0.02] }, 'plastic'));
  atlas.add(quadUV(A_SCRIPT, [-0.11, 0.655, zMesh + 0.004], [0.11, 0.655, zMesh + 0.004], [0.11, 0.72, zMesh + 0.004], [-0.11, 0.72, zMesh + 0.004], [0, 0, 1]));
  atlas.add(quadUV(A_HORSE, [-0.028, 0.755, zMesh + 0.004], [0.028, 0.755, zMesh + 0.004], [0.028, 0.83, zMesh + 0.004], [-0.028, 0.83, zMesh + 0.004], [0, 0, 1]));
  // apron: exhaust opening, fog lamps; three centre pipes
  const fr = { filter: (v) => v[2] > 1.98 };
  pal.add(dTail.rear(rpoly([[-0.19, 0.31], [0.19, 0.31], [0.19, 0.425], [-0.19, 0.425]], 0.04), { offset: 0.004, minFacing: 0.1, ...fr }).pal('well').sym());
  pal.add(dTail.rear(rect(0.44, 0.355, 0.6, 0.395, 0.01), { offset: 0.004, minFacing: 0.1, ...fr }).pal('reflector').sym());
  const ez = prTail.rearZ(0.001, 0.368);
  for (const x of [-0.105, 0, 0.105]) {
    pal.add(cyl(0.043, 0.043, 0.16, 20, { p: [x, 0.368, ez - 0.05], r: [Math.PI / 2, 0, 0] }, 'steel', true));
    pal.add(cyl(0.036, 0.036, 0.15, 14, { p: [x, 0.368, ez - 0.055], r: [Math.PI / 2, 0, 0] }, 'well'));
  }

  // --- rear wing on body-coloured end plates rising out of the rear wings
  const plateX = prRear.sideX(1.95, 0.9) - 0.034, thick = 0.06;
  const ep = [[1.3, 0.85], [1.42, 0.9], [1.55, 0.96], [1.66, 1.02], [1.74, 1.068], [1.8, 1.092], [1.88, 1.103], [2.06, 1.112], [2.08, 1.106], [2.076, 0.95], [2.04, 0.85]];
  paint.add(finSoup(ep, plateX, thick).sym());
  const wz0 = 1.775, wz1 = 2.08;
  const foil = [[wz0, 1.058], [wz0 + 0.008, 1.071], [wz0 + 0.03, 1.081], [wz0 + 0.1, 1.087], [wz0 + 0.2, 1.089], [wz1 - 0.035, 1.091], [wz1 - 0.01, 1.099], [wz1 + 0.002, 1.118],
    [wz1 + 0.008, 1.115], [wz1 + 0.004, 1.072], [wz1 - 0.05, 1.062], [wz0 + 0.12, 1.05], [wz0 + 0.03, 1.048], [wz0 + 0.008, 1.05]];
  const wsh = new THREE.Shape();
  foil.forEach((p, k) => (k ? wsh.lineTo(p[0], p[1]) : wsh.moveTo(p[0], p[1])));
  const span = (plateX - thick / 2 + 0.01) * 2;
  const wg = new THREE.ExtrudeGeometry(wsh, { depth: span, bevelEnabled: false, curveSegments: 4 });
  wg.translate(0, 0, -span / 2); wg.rotateY(-Math.PI / 2);
  paint.add(fromGeo(wg));
  const xo = plateX + thick / 2 + 0.0075;
  // F40 script on the outside of each end plate, reading left to right from either side
  atlas.add(quadUV(A_F40, [xo, 1.02, 2.02], [xo, 1.02, 1.86], [xo, 1.075, 1.86], [xo, 1.075, 2.02], [1, 0, 0]));
  atlas.add(quadUV(A_F40, [-xo, 1.02, 1.86], [-xo, 1.02, 2.02], [-xo, 1.075, 2.02], [-xo, 1.075, 1.86], [-1, 0, 0]));

  // --- front: low nose, three intakes, clear-covered lamps, lip spoiler, plate, badge
  const fnose = { filter: (v) => v[2] < -1.95 };
  const mainIn = rpoly([[-0.5, 0.165], [0.5, 0.165], [0.47, 0.32], [-0.47, 0.32]], 0.04);
  pal.add(dNose.front(grow(mainIn, 0.012), { offset: 0.003, minFacing: -0.3, ...fnose }).pal('plastic').sym());
  atlas.add(dNose.front(mainIn, { offset: 0.005, minFacing: -0.3, ...fnose }).uvRect(A_GRILLE).sym());
  const hy = { u: [-Math.cos(0.5), 0, -Math.sin(0.5)], v: [0, 1, 0], out: [Math.sin(0.5), 0, -Math.cos(0.5)], origin: [0, 0, -2.0] };
  const brakeIn = rpoly([[-0.84, 0.17], [-0.64, 0.17], [-0.64, 0.3], [-0.83, 0.3]], 0.03);
  pal.add(dNose.any(hy)(grow(brakeIn, 0.01), { offset: 0.003, minFacing: -0.2, ...fnose }).pal('plastic').sym());
  pal.add(dNose.any(hy)(brakeIn, { offset: 0.005, minFacing: -0.2, ...fnose }).pal('well').sym());
  const lampPoly = rpoly([[-0.95, 0.345], [-0.5, 0.338], [-0.5, 0.435], [-0.94, 0.448]], 0.015);
  pal.add(dNose.any(hy)(grow(lampPoly, 0.012), { offset: 0.004, minFacing: 0.0, ...fnose }).pal('plastic').sym());
  head.add(dNose.any(hy)(lampPoly, { offset: 0.006, minFacing: 0.0, box: [-0.5, 0.338, -0.95, 0.448], ...fnose }).sym());
  // lip spoiler following the nose
  const lip = new Soup(), lipPts = [];
  for (let i = 0; i <= 24; i++) {
    const x = -0.86 + 1.72 * i / 24, h = prNose.front(Math.max(0.001, Math.abs(x)), 0.17);
    if (h) lipPts.push([x, h.p[2]]);
  }
  for (let i = 0; i < lipPts.length - 1; i++) {
    const [xa, za] = lipPts[i], [xb, zb] = lipPts[i + 1];
    quadN(lip, [xa, 0.142, za + 0.02], [xb, 0.142, zb + 0.02], [xb, 0.142, zb - 0.03], [xa, 0.142, za - 0.03], [0, 1, 0]);
    quadN(lip, [xa, 0.142, za - 0.03], [xb, 0.142, zb - 0.03], [xb, 0.118, zb - 0.032], [xa, 0.118, za - 0.032], [0, 0.2, -1]);
    quadN(lip, [xa, 0.118, za - 0.032], [xb, 0.118, zb - 0.032], [xb, 0.118, zb + 0.05], [xa, 0.118, za + 0.05], [0, -1, 0]);
  }
  pal.add(lip.pal('plastic'));
  const ys = prNose.topY(0.001, -2.16);
  atlas.add(quadUV(A_SHIELD, [-0.026, ys + 0.004, -2.125], [0.026, ys + 0.004, -2.125], [0.026, ys - 0.01, -2.19], [-0.026, ys - 0.01, -2.19], [0, 0.6, -0.8]));
  const fp = plate([0, 0.235, prNose.frontZ(0.001, 0.235) - 0.014], A_PLATE, { front: true, tilt: 0.12 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- small mirrors on stalks, single wiper
  const mz = -0.64, mx = prCab.sideX(mz, 0.79);
  paint.add(blob(0.11, 0.064, 0.06, { p: [mx + 0.09, 0.85, mz + 0.02], r: [0, -0.12, 0] }, null, 4.5).sym());
  pal.add(cyl(0.008, 0.01, 0.11, 8, { p: [mx + 0.04, 0.82, mz + 0.02], r: [0, 0, -0.9] }, 'plastic').sym());
  pal.add(cyl(0.006, 0.006, 0.62, 6, { p: [0.05, 0.8, prCab.frontZ(0.05, 0.79) + 0.02], r: [0, 0.12, Math.PI / 2 - 0.1] }, 'plastic'));

  const wheel = { soup: starWheel({ R: DIMS.wheelRadius, width: 0.335, rimR: 0.2159, face: 0.118, hub: 0.07 }) };
  const wheelFront = { soup: starWheel({ R: DIMS.wheelRadiusFront, width: 0.245, rimR: 0.2159, face: 0.086, hub: 0.055 }) };
  const car = assembleCar({ id: 'f40', dims: DIMS, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel, wheelFront });
  return tintPaint(car, 'f40', 0xc4100f, { metalness: 0.0, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.06, envMapIntensity: 0.6 });
}
