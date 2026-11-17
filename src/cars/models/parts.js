// Shared modelling helpers for the detailed car models: surface lines, swept profiles (bumpers, lamp lenses,
// rubbing strips), extruded plates, flank folds and lathes. See kit.js for the base toolkit.
import * as THREE from 'three';
import { Soup, raycast, fromGeo, smooth } from './kit.js';

// Triangles of a soup whose centroid passes pred(x, y, z): a small soup for fast raycasts.
export function part(soup, pred) {
  const s = new Soup(), P = soup.p, N = soup.n;
  for (let i = 0; i < P.length; i += 9) {
    if (!pred((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3)) continue;
    for (let k = 0; k < 9; k++) { s.p.push(P[i + k]); s.n.push(N[i + k]); }
  }
  return s;
}
// Polyline in plan view [{x, z, nx, nz}] with arc-length lookup.
export function polyline(pts) {
  const S = [0];
  for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const L = S[S.length - 1];
  const at = (s) => {
    s = Math.min(L, Math.max(0, s));
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const t = (s - S[lo]) / ((S[hi] - S[lo]) || 1), A = pts[lo], B = pts[hi];
    const nx = A.nx + (B.nx - A.nx) * t, nz = A.nz + (B.nz - A.nz) * t, l = Math.hypot(nx, nz) || 1;
    return { x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t, nx: nx / l, nz: nz / l };
  };
  // arc length where fn(point) crosses zero (fn < 0 at the start, > 0 at the end)
  const where = (fn) => { let lo = 0, hi = L; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fn(at(m)) < 0) lo = m; else hi = m; } return (lo + hi) / 2; };
  return { pts, L, at, where };
}
// Plan-view line on the surface at height y, from rays fanned out of (0, y, zc) over a0..a1 degrees
// (0 = along dir * z, 90 = toward +x).
export function planLine(soup, y, zc, dir, a0, a1, n = 140) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    const h = raycast(soup, [0, y, zc], [Math.sin(a), 0, dir * Math.cos(a)]);
    if (!h) continue;
    const l = Math.hypot(h.n[0], h.n[2]) || 1;
    pts.push({ x: h.p[0], z: h.p[2], nx: h.n[0] / l, nz: h.n[2] / l });
  }
  return polyline(pts);
}
// Side line on the right flank at height y between z0 and z1.
export function sideLine(soup, y, z0, z1, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * i / n, h = raycast(soup, [3, y, z], [-1, 0, 0]);
    if (!h) continue;
    const l = Math.hypot(h.n[0], h.n[2]) || 1;
    pts.push({ x: h.p[0], z, nx: h.n[0] / l, nz: h.n[2] / l });
  }
  return polyline(pts);
}
export function pushTri(s, a, b, c) {
  const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2], vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
  const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
  if (fx * fx + fy * fy + fz * fz < 1e-18) return;
  const nx = a.n[0] + b.n[0] + c.n[0], ny = a.n[1] + b.n[1] + c.n[1], nz = a.n[2] + b.n[2] + c.n[2];
  const list = fx * nx + fy * ny + fz * nz >= 0 ? [a, b, c] : [a, c, b];
  for (const v of list) { s.p.push(...v.p); s.n.push(...v.n); s.uv.push(...v.uv); }
}
// Sweeps a profile [[d, h], ...] (d out from the surface line, h up from y0; listed so that the outside is on
// the right-hand side, e.g. bottom-inner -> out -> up -> top-inner) along a plan line between arc lengths s0..s1.
// taper(t) scales d along the run. hard: flat normals per profile segment. uv: u = position along uS, v along vH.
export function sweep(line, y0, prof, o = {}) {
  const { s0 = 0, s1 = line.L, n = 24, taper = null, hard = false } = o;
  const uS = o.uS || [s0, s1], hs = prof.map((p) => p[1]), vH = o.vH || [Math.min(...hs), Math.max(...hs)];
  const steps = o.steps || Array.from({ length: n + 1 }, (_, i) => s0 + (s1 - s0) * i / n);
  const segN = [];
  for (let k = 0; k < prof.length - 1; k++) {
    const dd = prof[k + 1][0] - prof[k][0], dh = prof[k + 1][1] - prof[k][1], l = Math.hypot(dd, dh) || 1;
    segN.push([dh / l, -dd / l]);
  }
  const ptN = prof.map((_, k) => {
    const a = segN[Math.max(0, k - 1)], b = segN[Math.min(segN.length - 1, k)], x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  const s = new Soup();
  const V = (st, k, nn) => {
    const p = line.at(st), t = (st - s0) / ((s1 - s0) || 1), m = taper ? taper(t) : 1, d = prof[k][0] * m;
    return { p: [p.x + p.nx * d, y0 + prof[k][1], p.z + p.nz * d], n: [p.nx * nn[0], nn[1], p.nz * nn[0]], uv: [(st - uS[0]) / ((uS[1] - uS[0]) || 1), (prof[k][1] - vH[0]) / ((vH[1] - vH[0]) || 1)] };
  };
  for (let i = 0; i < steps.length - 1; i++) {
    for (let k = 0; k < prof.length - 1; k++) {
      const na = hard ? segN[k] : ptN[k], nb = hard ? segN[k] : ptN[k + 1];
      const a = V(steps[i], k, na), b = V(steps[i + 1], k, na), c = V(steps[i + 1], k + 1, nb), d = V(steps[i], k + 1, nb);
      pushTri(s, a, b, c); pushTri(s, a, c, d);
    }
  }
  return s;
}
// Extruded 2D shape in the x-y plane (front face at z = 0, extruding toward +z by depth).
export function plateShape(pts, holes, depth, bevel = 0.002, pal = null) {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  for (const h of holes || []) sh.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  return fromGeo(g, null, pal);
}
// 2D polygon clipped to the half-plane a*x + b*y + c >= 0 (Sutherland-Hodgman).
export function clip2(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], fp = a * P[0] + b * P[1] + c, fq = a * Q[0] + b * Q[1] + c;
    if (fp >= 0) out.push(P);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  return out;
}

// Folds the flanks along a raised character line at height yc(z): the sides are pushed out by A at the
// fold and blend back over wa above / wb below; the normals take the slope of the fold so it reads crisply.
export function foldFlanks(soup, yc, A, wa, wb, zf, zr) {
  const P = soup.p, N = soup.n;
  const prof = (d) => {
    if (d >= 0) { const s = Math.min(1, d / wa); return [A * (1 - s) * (1 - s), -2 * A * (1 - s) / wa]; }
    const s = Math.min(1, -d / wb); return [A * (1 - s) * (1 - s), 2 * A * (1 - s) / wb];
  };
  for (let t = 0; t < P.length; t += 9) {
    const cy = (P[t + 1] + P[t + 4] + P[t + 7]) / 3;
    for (let k = 0; k < 3; k++) {
      const i = t + k * 3, x = P[i], y = P[i + 1], z = P[i + 2];
      const w = smooth((z - zf) / 0.22) * smooth((zr - z) / 0.22) * smooth((Math.abs(x) - 0.6) / 0.12);
      if (w <= 0) continue;
      const c = yc(z), onFold = Math.abs(y - c) < 0.003;
      const [dx, slope] = prof(onFold ? (cy > c ? 1e-6 : -1e-6) : y - c);
      if (dx <= 0 && !onFold) continue;
      P[i] = x + Math.sign(x) * dx * w;
      N[i + 1] -= slope * w * Math.abs(N[i]);
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
      N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
    }
  }
}
// Lathe about the X axis from [radius, x] pairs.
export function lathe(prof, pal, seg = 40) {
  const g = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  g.rotateZ(-Math.PI / 2);
  return fromGeo(g, null, pal);
}
// A patch of skin lifted off the body, for lamp lenses whose height changes along their length. For
// positions along a plan line (arc lengths s0..s1) and heights between y0(u) and y1(u), u = 0..1 along the run,
// rays are cast outward along the line's normal to find the surface, and the patch sits `offset` proud of it.
// uv: u along the run; v 0 = bottom .. 1 = top of the local height, or of the absolute span vH = [ya, yb].
export function skinPatch(soup, line, { s0 = 0, s1 = line.L, y0, y1, nu = 24, nv = 4, offset = 0.004, vH = null }) {
  const s = new Soup(), rows = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, p = line.at(s0 + (s1 - s0) * u), ya = y0(u), yb = y1(u), row = [];
    for (let j = 0; j <= nv; j++) {
      const y = ya + (yb - ya) * j / nv;
      const h = raycast(soup, [p.x - p.nx * 0.4, y, p.z - p.nz * 0.4], [p.nx, 0, p.nz]);
      const q = h ? h.p : [p.x, y, p.z], n = h ? h.n : [p.nx, 0, p.nz];
      row.push({ p: [q[0] + n[0] * offset, q[1] + n[1] * offset, q[2] + n[2] * offset], n, uv: [u, vH ? (y - vH[0]) / (vH[1] - vH[0]) : j / nv] });
    }
    rows.push(row);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { pushTri(s, rows[i][j], rows[i + 1][j], rows[i + 1][j + 1]); pushTri(s, rows[i][j], rows[i + 1][j + 1], rows[i][j + 1]); }
  return s;
}
// Raises a smooth bulge on upward-facing skin: dy = h(x, z) for vertices above yMin (power domes, humps).
export function bulge(soup, yMin, h) {
  const P = soup.p;
  for (let i = 0; i < P.length; i += 3) if (P[i + 1] > yMin && soup.n[i + 1] > 0.3) P[i + 1] += h(P[i], P[i + 2]);
}
// Wheel face with n pairs of twin spokes (or n single spokes when slit = 0), as an extruded, dished disc.
// rf: face radius; r1 / r2: inner and outer radius of the windows; big / slit: half-angles (rad) of the windows
// between the pairs and of the slits inside them; x0 / x1: face position at the hub and at the rim.
export function spokeFace({ n, rf, r1, r2, big, slit = 0, slitR1 = null, round = 0.012, depth = 0.02, x0, x1, pal = 'alloy', phase = Math.PI / 2 }) {
  const sp = new THREE.Shape(); sp.absarc(0, 0, rf, 0, Math.PI * 2, false);
  const hole = (a0, half1, half2, ra, rb) => {
    const pts = [];
    for (let k = 0; k <= 2; k++) { const a = a0 - half1 + half1 * k; pts.push([ra * Math.cos(a), ra * Math.sin(a)]); }
    for (let k = 0; k <= 8; k++) { const a = a0 + half2 - 2 * half2 * k / 8; pts.push([rb * Math.cos(a), rb * Math.sin(a)]); }
    // fillet the corners
    const out = [], m = pts.length;
    for (let i = 0; i < m; i++) {
      const A = pts[(i + m - 1) % m], Pt = pts[i], B = pts[(i + 1) % m];
      const la = Math.hypot(A[0] - Pt[0], A[1] - Pt[1]), lb = Math.hypot(B[0] - Pt[0], B[1] - Pt[1]), d = Math.min(round, 0.45 * la, 0.45 * lb);
      if (d < 1e-5) { out.push(Pt); continue; }
      const p0 = [Pt[0] + (A[0] - Pt[0]) / la * d, Pt[1] + (A[1] - Pt[1]) / la * d], p1 = [Pt[0] + (B[0] - Pt[0]) / lb * d, Pt[1] + (B[1] - Pt[1]) / lb * d];
      for (let k = 0; k <= 3; k++) { const t = k / 3, w = 1 - t; out.push([w * w * p0[0] + 2 * w * t * Pt[0] + t * t * p1[0], w * w * p0[1] + 2 * w * t * Pt[1] + t * t * p1[1]]); }
    }
    const path = new THREE.Path();
    out.forEach((p, k) => (k ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    path.closePath(); sp.holes.push(path);
  };
  for (let i = 0; i < n; i++) {
    const a = phase + i * Math.PI * 2 / n;
    hole(a + Math.PI / n, big * 0.72, big, r1, r2);
    if (slit > 0) hole(a, slit * 0.6, slit, slitR1 ?? r1 * 1.25, r2);
  }
  const g = new THREE.ExtrudeGeometry(sp, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 12 });
  g.rotateY(Math.PI / 2);
  const f = fromGeo(g, null, pal), P = f.p;
  for (let i = 0; i < P.length; i += 3) { const q = Math.min(1, Math.hypot(P[i + 1], P[i + 2]) / rf); P[i] += x0 + (x1 - x0) * Math.pow(q, 1.4) - depth / 2; }
  return f;
}
// Tyre with a rim barrel, flange and brake disc behind the face: the common part of every detailed wheel.
export function tyreAndRim(R, width, rimR, { lip = 'alloy', disc = 0.74, caliper = null } = {}) {
  const s = new Soup(), hw = width / 2, sh = R - rimR;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.014, -hw * 0.93], [R - 0.003, -hw * 0.8], [R, -hw * 0.55],
    [R, hw * 0.55], [R - 0.003, hw * 0.8], [R - 0.014, hw * 0.93], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 48));
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.005, hw * 0.85], [rimR, hw * 0.91], [rimR - 0.01, hw * 0.89], [rimR - 0.015, hw * 0.6]], lip, 48));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.5, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(fromGeo(new THREE.CylinderGeometry(rimR * disc, rimR * disc, 0.028, 36), { p: [hw * 0.1, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  s.add(fromGeo(new THREE.CylinderGeometry(rimR * 0.3, rimR * 0.34, hw * 0.8, 20), { p: [hw * 0.3, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  // brake caliper at the back of the wheel (palette name), clamped over the disc
  if (caliper) s.add(fromGeo(new THREE.BoxGeometry(0.06, rimR * 0.34, rimR * 0.62), { p: [hw * 0.1 + 0.012, rimR * 0.02, rimR * 0.62] }, caliper));
  return s;
}
