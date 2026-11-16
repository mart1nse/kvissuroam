// 1987 Mercedes-Benz 190E 2.6 (W201), pre-facelift European car in black: compact three-box saloon with a
// short, upright glasshouse, thick C-pillars, a high wedge-shaped boot, a waist fold rising to the ribbed
// tail lamps, anthracite bumpers with a chrome top strip, narrow rubbing strips, chrome-framed grille and star.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, raycast, clipSoup, rpoly, rect, stroke, grow, box, blob, cyl, tube, fromGeo, keyed, smooth, canvasTex, drawPlate, plate, assembleCar, arcPts } from './kit.js';

// real car (factory data): 4428 x 1678 x 1390 mm, wheelbase 2665, track 1437 front / 1418 rear,
// 185/65 R15 on 6J x 15. Overhangs about 785 front / 978 rear.
const DIMS = { length: 4.428, width: 1.678, height: 1.39, wheelbase: 2.665, track: 1.418, trackFront: 1.437, wheelRadius: 0.303 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 0.785, ZR = HZ + 0.978;      // bumper faces
const ZFB = ZF + 0.062, ZRB = ZR - 0.054;      // body shell ends behind the bumpers
const HW = DIMS.width / 2;
const AY = 0.31, AR = 0.355;                 // wheel arches
// waist fold: from the top of the headlamps, rising through the door handles to the top of the tail lamps
const WAIST = [[ZFB, 0.762], [-1.0, 0.792], [1.0, 0.815], [ZRB, 0.83]], FOLD = 0.01;

// ---------------------------------------------------------------- local geometry helpers
// Triangles of a soup whose centroid passes pred(x, y, z): a small soup for fast raycasts.
function part(soup, pred) {
  const s = new Soup(), P = soup.p, N = soup.n;
  for (let i = 0; i < P.length; i += 9) {
    if (!pred((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3)) continue;
    for (let k = 0; k < 9; k++) { s.p.push(P[i + k]); s.n.push(N[i + k]); }
  }
  return s;
}
// Polyline in plan view [{x, z, nx, nz}] with arc-length lookup.
function polyline(pts) {
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
function planLine(soup, y, zc, dir, a0, a1, n = 140) {
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
function sideLine(soup, y, z0, z1, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * i / n, h = raycast(soup, [3, y, z], [-1, 0, 0]);
    if (!h) continue;
    const l = Math.hypot(h.n[0], h.n[2]) || 1;
    pts.push({ x: h.p[0], z, nx: h.n[0] / l, nz: h.n[2] / l });
  }
  return polyline(pts);
}
function pushTri(s, a, b, c) {
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
function sweep(line, y0, prof, o = {}) {
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
function plateShape(pts, holes, depth, bevel = 0.002, pal = null) {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  for (const h of holes || []) sh.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  return fromGeo(g, null, pal);
}
// Three-pointed star in a ring, in the x-y plane (seen from the front and the back). R = ring radius.
function star3d(R, pal, ring = true) {
  const s = new Soup();
  if (ring) s.add(fromGeo(new THREE.TorusGeometry(R, R * 0.085, 6, 36), null, pal));
  const w = R * 0.17;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i * Math.PI * 2 / 3;
    const arm = plateShape([[-w * 0.6, 0], [0, -w], [R * 0.98, 0], [0, w]], null, R * 0.06, R * 0.03, pal);
    arm.xform(new THREE.Matrix4().makeRotationZ(a).multiply(new THREE.Matrix4().makeTranslation(0, 0, -R * 0.03)));
    s.add(arm);
  }
  return s;
}
// 2D polygon clipped to the half-plane a*x + b*y + c >= 0 (Sutherland-Hodgman).
function clip2(poly, a, b, c) {
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
function foldFlanks(soup, yc, A, wa, wb, zf, zr) {
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
function lathe(prof, pal, seg = 40) {
  const g = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  g.rotateZ(-Math.PI / 2);
  return fromGeo(g, null, pal);
}
// 15-hole "Gullideckel" light-alloy wheel with its tyre: flat silver face with a ring of 15 round holes,
// five bolts round a domed centre cap. Axis on X, outer face toward +X.
function gulliWheel(R, width, rimR) {
  const s = new Soup(), hw = width / 2, sh = R - rimR;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.016, -hw * 0.92], [R - 0.004, -hw * 0.76], [R, -hw * 0.45],
    [R, hw * 0.45], [R - 0.004, hw * 0.76], [R - 0.016, hw * 0.92], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 48));
  // rim barrel, polished flange and the dished outer lip
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.006, hw * 0.84], [rimR + 0.002, hw * 0.9], [rimR - 0.012, hw * 0.86], [rimR - 0.02, hw * 0.62], [rimR - 0.026, hw * 0.5]], 'alloy', 48));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.4, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(cyl(rimR * 0.72, rimR * 0.72, 0.02, 32, { p: [-hw * 0.05, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  // face: flat disc with 15 round holes at 72 % radius
  const rf = rimR - 0.022, xf = hw * 0.42;
  const face = new THREE.Shape(); face.absarc(0, 0, rf, 0, Math.PI * 2, false);
  for (let i = 0; i < 15; i++) {
    const a = (i + 0.5) * Math.PI * 2 / 15, h = new THREE.Path();
    h.absarc(Math.cos(a) * rf * 0.74, Math.sin(a) * rf * 0.74, rf * 0.112, 0, Math.PI * 2, true);
    face.holes.push(h);
  }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
  fg.rotateY(Math.PI / 2); fg.translate(xf, 0, 0);
  s.add(fromGeo(fg, null, 'alloy'));
  // raised inner ring, bolts, centre cap
  s.add(lathe([[rf * 0.56, xf + 0.015], [rf * 0.53, xf + 0.024], [rf * 0.42, xf + 0.027], [rf * 0.4, xf + 0.015]], 'alloy', 32));
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + Math.PI / 2;
    s.add(cyl(0.0095, 0.0095, 0.014, 6, { p: [xf + 0.026, Math.sin(a) * rf * 0.3, Math.cos(a) * rf * 0.3], r: [0, 0, -Math.PI / 2] }, 'chrome'));
  }
  s.add(lathe([[rf * 0.2, xf + 0.014], [rf * 0.2, xf + 0.028], [rf * 0.16, xf + 0.036], [rf * 0.06, xf + 0.04], [0.001, xf + 0.041]], 'chrome', 28));
  return s;
}

// ---------------------------------------------------------------- textures
// Ribbed tail lens, u 0 = inboard (plate side) .. 1 = outboard, v 0 = bottom .. 1 = top.
// Upper row: tail/brake inboard, amber indicator outboard. Lower row: rear fog inboard, reverse (its own
// mesh), tail/brake outboard.
const TAIL_SPLIT = 0.5, FOG_SPLIT = 0.29, RIBS = 8;
function lampTextures() {
  const cells = [
    [0, TAIL_SPLIT, 0.5, 1, '#7c0204', true],
    [TAIL_SPLIT, 1, 0.5, 1, '#d85800', false],
    [0, FOG_SPLIT, 0, 0.5, '#6a0204', false],
    [FOG_SPLIT, TAIL_SPLIT, 0, 0.5, '#d9dde0', false],
    [TAIL_SPLIT, 1, 0, 0.5, '#7c0204', true],
  ];
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = '#0d0202'; g.fillRect(0, 0, w, h);
    for (const [u0, u1, v0, v1, c, lit] of cells) {
      g.fillStyle = glow ? (lit ? '#dcdcdc' : '#000000') : c;
      g.fillRect(u0 * w, (1 - v1) * h, (u1 - u0) * w, (v1 - v0) * h);
    }
    const p = h / RIBS;
    for (let i = 0; i < RIBS; i++) {
      const y0 = i * p, gr = g.createLinearGradient(0, y0, 0, y0 + p);
      if (glow) { gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); }
      else { gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.2, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); }
      g.fillStyle = gr; g.fillRect(0, y0, w, p);
    }
    // cell dividers and the dark rim of the housing
    g.fillStyle = '#080101';
    g.fillRect(TAIL_SPLIT * w - 3, 0, 6, h); g.fillRect(FOG_SPLIT * w - 2, h / 2, 4, h / 2); g.fillRect(0, h / 2 - 2, w, 4);
    g.strokeStyle = '#050101'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  };
  const head = (glow) => (g, w, h) => {
    // u 0 = inboard .. 1 = outboard: flat-glass headlamp with the amber indicator at the outer end
    g.fillStyle = glow ? '#000' : '#1a1d20'; g.fillRect(0, 0, w, h);
    const split = 0.76;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#f1f4f6'); gr.addColorStop(0.55, glow ? '#fff' : '#c8d0d5'); gr.addColorStop(1, glow ? '#ddd' : '#8e989f');
    g.fillStyle = gr; g.fillRect(6, 6, split * w - 10, h - 12);
    if (!glow) {
      // reflector bowl and lens prisms
      const rg = g.createRadialGradient(split * w * 0.5, h * 0.5, 4, split * w * 0.5, h * 0.5, h * 0.75);
      rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(0.35, 'rgba(160,170,180,0.25)'); rg.addColorStop(1, 'rgba(60,70,80,0.0)');
      g.fillStyle = rg; g.fillRect(6, 6, split * w - 10, h - 12);
      g.strokeStyle = 'rgba(40,50,60,0.28)'; g.lineWidth = 2;
      for (let x = 12; x < split * w - 6; x += 9) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h - 6); g.stroke(); }
      g.strokeStyle = 'rgba(40,50,60,0.14)'; for (let y = 20; y < h - 6; y += 26) { g.beginPath(); g.moveTo(6, y); g.lineTo(split * w - 6, y); g.stroke(); }
      g.fillStyle = '#e4800f'; g.fillRect(split * w + 4, 6, (1 - split) * w - 10, h - 12);
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      for (let y = 10; y < h - 6; y += 8) { g.beginPath(); g.moveTo(split * w + 4, y); g.lineTo(w - 6, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, h * 0.08);
    }
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 96, head(false)), headGlow: canvasTex(256, 96, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_190 = uvr(0, 200, 440, 110), A_26 = uvr(460, 200, 220, 110);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '190 EEE');
    // chrome model lettering: "190 E" (left of the lid) and "2.6" (right)
    const chromeText = (txt, cx, cy, size, sx) => {
      g.save(); g.translate(cx, cy); g.scale(sx, 1);
      g.font = `bold ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = '#1c1d1f'; g.strokeText(txt, 0, 0);
      const gr = g.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#c9ccd0'); gr.addColorStop(0.55, '#7d8288'); gr.addColorStop(1, '#e8eaec');
      g.fillStyle = gr; g.fillText(txt, 0, 0); g.restore();
    };
    chromeText('190 E', 220, 257, 104, 0.95);
    chromeText('2.6', 570, 257, 104, 0.95);
  });
}

// ---------------------------------------------------------------- the car
export function buildW201() {
  const body = buildBody({
    top: [[ZFB, 0.44], [ZFB + 0.001, 0.55, 0.01], [ZFB + 0.006, 0.765, 0.015], [ZFB + 0.035, 0.787, 0.03], [-1.6, 0.852, 0.4],
      [-1.0, 0.922, 0.25], [-0.78, 0.94, 0.04], [-0.17, 1.362, 0.16], [0.28, 1.39, 0.6], [0.84, 1.35, 0.16],
      [1.34, 0.985, 0.07], [1.8, 0.995, 0.4], [ZRB - 0.042, 1.0, 0.012], [ZRB - 0.026, 0.976, 0.015], [ZRB - 0.002, 0.83, 0.03], [ZRB, 0.44]],
    bottom: [[ZFB, 0.44], [ZFB + 0.002, 0.33, 0.03], [ZFB + 0.12, 0.235, 0.06], [-1.7, 0.215, 0.1], [1.7, 0.215, 0.1], [ZRB - 0.2, 0.27, 0.06], [ZRB - 0.002, 0.37, 0.03], [ZRB, 0.44]],
    w: [[ZFB, 0.78], [-1.95, 0.804], [-1.6, 0.822], [-1.0, 0.83], [0, HW - FOLD], [1.0, HW - FOLD], [1.7, 0.828], [2.1, 0.821], [ZRB, 0.814]],
    yWaist: WAIST, tuck: 0.045, ySill: 0.215,
    yBelt: [[ZFB, 0.86], [-0.78, 0.925], [0.9, 0.955], [ZRB, 0.965]],
    sh: 0.024, ledge: 0.01, ledgeH: 0.025, th: 0.42, thc: 0.1,
    rr: [[ZFB, 0.03], [-1.5, 0.05], [-0.95, 0.05], [-0.5, 0.07], [0.84, 0.07], [1.34, 0.05], [2.0, 0.045], [ZRB, 0.03]],
    rs: 0.05,
    crown: [[ZFB, 0.012], [-1.5, 0.03], [-0.78, 0.03], [-0.2, 0.045], [0.84, 0.045], [1.34, 0.022], [2.0, 0.018], [ZRB, 0.01]],
    bow: [[ZFB, 0.1], [-1.9, 0.05], [-1.7, 0], [-1.08, 0], [-0.78, 0.055], [-0.2, 0.035], [0.0, 0], [0.6, 0], [0.9, 0.035], [1.3, 0.05], [1.55, 0], [2.0, 0], [2.2, 0.04], [ZRB, 0.075]],
    bowN: [[ZFB, 3.2], [-1.7, 3], [-1.08, 2.6], [-0.2, 2.6], [0.9, 2.6], [1.55, 3], [ZRB, 4]],
  });
  const raw = body.soup;
  const yFold = keyed(WAIST);
  foldFlanks(raw, yFold, FOLD, 0.075, 0.2, ZFB, ZRB);
  const rearP = part(raw, (x, y, z) => z > 1.25 && y > 0.18 && y < 1.15);
  const frontP = part(raw, (x, y, z) => z < -1.25 && y > 0.18 && y < 1.0);
  const sideP = part(raw, (x, y, z) => x > 0.45 && y > 0.25 && y < 1.0);
  const cabP = part(raw, (x, y, z) => y > 0.85 && z > -1.1 && z < 1.4);
  const prR = probe(rearP), prF = probe(frontP), prC = probe(cabP);

  const arches = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: HW });
  // recessed number plate in the boot lid between the lamps
  const RX = 0.282, RY0 = 0.608, RY1 = 0.802, RD = 0.03;
  let shell = clipSoup(arches.soup, (v) => Math.max(Math.abs(v[0]) - RX, RY0 - v[1], v[1] - RY1, 1.9 - v[2]));
  // decal frames bound to the parts of the shell they can land on (much faster than the whole shell)
  const dcS = decals(part(shell, (x) => x > 0.35)), dcR = decals(part(shell, (x, y, z) => z > 0.4));
  const dcF = decals(part(shell, (x, y, z) => z < -0.1)), dcT = decals(part(shell, (x, y) => y > 0.7));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(arches.liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();
  const fr = { filter: (v) => v[2] > 1.9 }, ff = { filter: (v) => v[2] < -1.85 };
  const rz = (x, y) => prR.rearZ(x, y);

  {
    const s = new Soup(), nx = 10, ny = 4;
    const P = (x, y, d) => [x, y, rz(x, y) - d];
    const q = (a, b, c, d, n) => { const v = (p) => ({ p, n, uv: [0, 0] }); pushTri(s, v(a), v(b), v(c)); pushTri(s, v(a), v(c), v(d)); };
    for (let i = 0; i < nx; i++) {
      const x0 = -RX + 2 * RX * i / nx, x1 = -RX + 2 * RX * (i + 1) / nx;
      for (let j = 0; j < ny; j++) {
        const y0 = RY0 + (RY1 - RY0) * j / ny, y1 = RY0 + (RY1 - RY0) * (j + 1) / ny;
        q(P(x0, y0, RD), P(x1, y0, RD), P(x1, y1, RD), P(x0, y1, RD), [0, 0, 1]);
      }
      q(P(x0, RY1, -0.001), P(x1, RY1, -0.001), P(x1, RY1, RD), P(x0, RY1, RD), [0, -1, 0]);
      q(P(x0, RY0, -0.001), P(x1, RY0, -0.001), P(x1, RY0, RD), P(x0, RY0, RD), [0, 1, 0]);
    }
    for (let j = 0; j < ny; j++) {
      const y0 = RY0 + (RY1 - RY0) * j / ny, y1 = RY0 + (RY1 - RY0) * (j + 1) / ny;
      q(P(RX, y0, -0.001), P(RX, y1, -0.001), P(RX, y1, RD), P(RX, y0, RD), [-1, 0, 0]);
      q(P(-RX, y0, -0.001), P(-RX, y1, -0.001), P(-RX, y1, RD), P(-RX, y0, RD), [1, 0, 0]);
    }
    paint.add(s);
    const zp = rz(0, 0.705) - RD;
    const pl = plate([0, 0.705, zp + 0.007], A_PLATE, { tilt: 0 });
    atlas.add(pl.face); pal.add(pl.back);
    // plate lamps in the top of the recess
    for (const x of [-0.15, 0.15]) pal.add(box(0.05, 0.005, 0.016, { p: [x, RY1 - 0.003, rz(x, RY1) - 0.012] }, 'lens'));
  }

  // --- glazing: short upright glasshouse, chrome surrounds, black (anodised) door frames
  const dlo = rpoly([[-0.715, 0.928], [0.94, 0.957], [0.635, 1.3], [-0.165, 1.305]], 0.035, 4);
  pal.add(dcS.side(grow(dlo, 0.02), { offset: 0.003 }).pal('chrome').sym());
  pal.add(dcS.side(grow(dlo, 0.009), { offset: 0.0042 }).pal('plastic').sym());
  {
    const inner = grow([[-0.715, 0.928], [0.94, 0.957], [0.635, 1.3], [-0.165, 1.305]], -0.008);
    const gF = clip2(inner, -1, 0, 0.098), gR = clip2(clip2(inner, 1, 0, -0.172), -1, 0, 0.652), gQ = clip2(inner, 1, 0, -0.678);
    glass.add(dcS.side([rpoly(gF, 0.028, 4), rpoly(gR, 0.02, 4), rpoly(gQ, 0.015, 3)], { offset: 0.0058 }).sym());
  }
  const ws = rpoly([[-0.69, 0.962], [0.69, 0.962], [0.575, 1.338], [-0.575, 1.338]], 0.06, 5);
  pal.add(dcF.front(grow(ws, 0.02), { offset: 0.003, filter: (v) => v[2] > -1.0 }).pal('chrome'));
  pal.add(dcF.front(grow(ws, 0.009), { offset: 0.0042, filter: (v) => v[2] > -1.0 }).pal('rubber'));
  glass.add(dcF.front(ws, { offset: 0.0058, filter: (v) => v[2] > -1.0 }));
  const rw = rpoly([[-0.57, 1.012], [0.57, 1.012], [0.48, 1.328], [-0.48, 1.328]], 0.065, 5);
  const rwf = { filter: (v) => v[2] > 0.5 && v[2] < 1.4 };
  pal.add(dcR.rear(grow(rw, 0.02), { offset: 0.003, ...rwf }).pal('chrome'));
  pal.add(dcR.rear(grow(rw, 0.009), { offset: 0.0042, ...rwf }).pal('rubber'));
  glass.add(dcR.rear(rw, { offset: 0.0058, ...rwf }));

  // --- shut lines
  const lw = 0.0065, lo = { offset: 0.0045 };
  const archR = AR + 0.035;
  const doorRear = [[0.985, 0.957], [0.985, 0.62], ...arcPts(HZ, AY, archR, 125, 180, 8).filter((p) => p[1] < 0.62), [HZ - archR, 0.255]];
  pal.add(dcS.side([
    ...stroke([[-0.825, 0.255], [-0.825, 0.93]], lw), ...stroke([[0.135, 0.255], [0.135, 0.945]], lw),
    ...stroke(doorRear, lw), ...stroke([[-0.825, 0.255], [HZ - archR, 0.255]], lw),
  ], { ...lo, minFacing: 0.3 }).pal('line').sym());
  pal.add(dcT.top([...stroke([[0.705, -2.02], [0.715, -0.9]], lw), ...stroke([[-0.715, -0.9], [0.715, -0.9]], lw)], { ...lo, minFacing: 0.4 }).pal('line'));
  pal.add(dcT.top(stroke([[0.705, -2.02], [0.715, -0.9]], lw), { ...lo, minFacing: 0.4 }).pal('line').mirrored());
  // boot lid: deck sides, front edge behind the rear window, then down the tail and round the lamps
  const lid = [[0.67, 1.38], [0.68, 2.22]];
  pal.add(dcT.top([...stroke(lid, lw), ...stroke([[-0.67, 1.38], [0.67, 1.38]], lw)], { ...lo, minFacing: 0.4, filter: (v) => v[2] > 1.0 }).pal('line'));
  pal.add(dcT.top(stroke(lid, lw), { ...lo, minFacing: 0.4, filter: (v) => v[2] > 1.0 }).pal('line').mirrored());
  pal.add(dcR.rear(stroke([[0.68, 1.0], [0.68, 0.824], [0.352, 0.824], [0.352, 0.59]], lw), { ...lo, ...fr }).pal('line').sym());
  // fuel filler flap on the right rear wing
  const flap = rpoly([[1.56, 0.775], [1.68, 0.775], [1.68, 0.885], [1.56, 0.885]], 0.02, 3);
  pal.add(dcS.side(stroke([...flap, flap[0]], 0.005), { ...lo, minFacing: 0.3 }).pal('line'));

  // --- rear lamps: ribbed lenses on a black housing
  const ln = planLine(rearP, 0.69, 1.3, 1, 0, 78);
  const LY0 = 0.603, LH = 0.207, sIn = ln.where((p) => p.x - 0.37), sOut = ln.where((p) => p.nx - 0.86);
  const zOut = ln.at(sOut).z - 0.008;
  pal.add(dcR.rear(rpoly([[0.358, LY0 - 0.009], [ln.at(sOut).x + 0.01, LY0 - 0.009], [ln.at(sOut).x + 0.01, LY0 + LH + 0.009], [0.358, LY0 + LH + 0.009]], 0.008), { offset: 0.0018, minFacing: 0.05, filter: (v) => v[2] > zOut }).pal('gloss').sym());
  {
    const p = LH / RIBS, dB = 0.0025, dep = 0.0085;
    const prof = [[dB, 0]];
    for (let k = 0; k < RIBS; k++) prof.push([dB + dep, k * p + 0.14 * p], [dB + dep * 0.72, (k + 0.97) * p], [dB, (k + 1) * p]);
    const lower = prof.slice(0, RIBS / 2 * 3 + 1), upper = prof.slice(RIBS / 2 * 3);
    const sAt = (u) => sIn + (sOut - sIn) * u;
    const us = new Set(); for (let i = 0; i <= 20; i++) us.add(i / 20);
    for (const u of [FOG_SPLIT, TAIL_SPLIT]) us.add(u);
    const ul = [...us].sort((a, b) => a - b);
    const run = (prf, u0, u1) => {
      const steps = ul.filter((u) => u >= u0 - 1e-9 && u <= u1 + 1e-9).map(sAt);
      return sweep(ln, LY0, prf, { s0: sIn, s1: sOut, steps, uS: [sIn, sOut], vH: [0, LH], hard: true, taper: (t) => Math.min(1, t / 0.03, (1 - t) / 0.03) });
    };
    tail.add(run(upper, 0, 1), run(lower, 0, FOG_SPLIT), run(lower, TAIL_SPLIT, 1));
    reverse.add(run(lower, FOG_SPLIT, TAIL_SPLIT));
    tail.add(tail.mirrored()); reverse.add(reverse.mirrored());
  }

  // --- rear badges and the star on the boot lid
  atlas.add(dcR.rear(rect(-0.64, 0.838, -0.425, 0.878), { offset: 0.0045, ...fr }).uvRect(A_190));
  atlas.add(dcR.rear(rect(0.475, 0.838, 0.58, 0.878), { offset: 0.0045, ...fr }).uvRect(A_26));
  pal.add(star3d(0.036, 'chrome').xform(new THREE.Matrix4().makeTranslation(0, 0.872, rz(0, 0.872) + 0.004)));

  // --- bumpers: black plastic with a chrome top strip, wrapping round to the wheel arches
  const bumper = (lnB, yB, sEnd, profBlack, profChrome) => {
    const tp = (t) => Math.min(1, (1 - t) / 0.06) ** 0.5;
    pal.add(sweep(lnB, yB, profBlack, { s1: sEnd, n: 40, taper: tp }).pal('clad').sym());
    pal.add(sweep(lnB, yB, profChrome, { s1: sEnd, n: 40, taper: tp }).pal('chrome').sym());
  };
  {
    const yB = 0.47, lnB = planLine(rearP, yB, 1.3, 1, 0, 80, 160);
    const sEnd = lnB.where((p) => (HZ + archR + 0.012) - p.z);
    const black = [[-0.03, -0.118], [0.008, -0.121], [0.026, -0.114], [0.04, -0.094], [0.05, -0.058], [0.054, -0.015], [0.054, 0.045], [0.053, 0.083]];
    const chrome = [[0.053, 0.083], [0.0545, 0.094], [0.051, 0.108], [0.042, 0.118], [0.028, 0.122], [-0.03, 0.122]];
    bumper(lnB, yB, sEnd, black, chrome);
  }
  {
    const yB = 0.42, lnB = planLine(frontP, yB, -1.3, -1, 0, 80, 160);
    const sEnd = lnB.where((p) => p.z - (-HZ - archR - 0.012));
    const black = [[-0.03, -0.112], [0.015, -0.116], [0.036, -0.108], [0.05, -0.085], [0.058, -0.045], [0.061, 0.0], [0.061, 0.05], [0.059, 0.088]];
    const chrome = [[0.059, 0.088], [0.0605, 0.099], [0.057, 0.112], [0.046, 0.122], [0.03, 0.126], [-0.03, 0.126]];
    bumper(lnB, yB, sEnd, black, chrome);
  }
  // --- narrow side rubbing strips with a chrome insert (front wing, both doors)
  {
    const yS = 0.462;
    const blk = [[-0.004, -0.021], [0.006, -0.02], [0.011, -0.013], [0.013, 0], [0.011, 0.013], [0.006, 0.02], [-0.004, 0.021]];
    const chr = [[0.0115, -0.0055], [0.0145, -0.0045], [0.0158, 0], [0.0145, 0.0045], [0.0115, 0.0055]];
    for (const [z0, z1] of [[-0.95, -0.835], [-0.815, 0.127], [0.143, 0.945]]) {
      const l = sideLine(sideP, yS, z0, z1, 16), k = 30 * (z1 - z0), tp = (t) => Math.min(1, 0.25 + k * t, 0.25 + k * (1 - t));
      pal.add(sweep(l, yS, blk, { n: 16, taper: tp }).pal('clad').sym());
      pal.add(sweep(l, yS, chr, { n: 16, taper: tp }).pal('chrome').sym());
    }
  }

  // --- exhaust: twin round tailpipes under the right-hand end of the bumper
  for (const x of [0.4, 0.468]) {
    const m = new THREE.Matrix4().makeTranslation(x, 0.27, ZR - 0.1).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.06));
    pal.add(cyl(0.026, 0.026, 0.16, 16, m, 'chrome', true));
    pal.add(cyl(0.021, 0.021, 0.15, 12, m, 'well'));
  }

  // --- front: chrome-framed upright grille with vertical slats, stand-up star, flat-glass headlamps
  {
    const zG = prF.frontZ(0, 0.68), gw = 0.212, gy0 = 0.56, gy1 = 0.8;
    const outer = rpoly([[-gw, gy0], [gw, gy0], [gw + 0.006, gy1], [-gw - 0.006, gy1]], 0.03, 4);
    const inner = grow(outer, -0.024);
    pal.add(plateShape(outer, [inner], 0.04, 0.004, 'chrome').xform(new THREE.Matrix4().makeTranslation(0, 0, zG - 0.03)));
    pal.add(plateShape(inner, null, 0.01, 0, 'well').xform(new THREE.Matrix4().makeTranslation(0, 0, zG - 0.004)));
    const nS = 11, iw = gw - 0.024;
    for (let i = 0; i < nS; i++) {
      const x = -iw + 0.012 + (2 * iw - 0.024) * i / (nS - 1);
      pal.add(box(0.0065, gy1 - gy0 - 0.044, 0.026, { p: [x, (gy0 + gy1) / 2, zG - 0.014] }, 'steel'));
    }
        // stand-up star on the grille shell
    const yT = gy1 + 0.006, zT = zG - 0.012;
    pal.add(cyl(0.017, 0.021, 0.012, 16, { p: [0, yT + 0.006, zT] }, 'chrome'));
    pal.add(cyl(0.004, 0.005, 0.03, 8, { p: [0, yT + 0.026, zT] }, 'chrome'));
    pal.add(star3d(0.032, 'chrome').xform(new THREE.Matrix4().makeTranslation(0, yT + 0.072, zT)));
  }
  {
    const hl = rect(-0.758, 0.586, -0.262, 0.752, 0.01);
    pal.add(dcF.front(grow(hl, 0.011), { offset: 0.0025, minFacing: 0.05, ...ff }).pal('gloss').sym());
    head.add(dcF.front(hl, { offset: 0.0045, minFacing: 0.05, box: [-0.262, 0.586, -0.758, 0.752], ...ff }));
    head.add(head.mirrored());
    // bonnet front edge above the lamps
    pal.add(dcF.front(stroke([[-0.228, 0.77], [-0.8, 0.77]], lw), { ...lo, ...ff }).pal('line').sym());
    // black air dam under the bumper with an intake slot
    pal.add(dcF.front(rect(-0.78, 0.2, 0.78, 0.312), { offset: 0.003, minFacing: -0.6, filter: (v) => v[2] < -1.7 && v[1] < 0.32 }).pal('plastic'));
    const fp = plate([0, 0.41, ZF - 0.001], A_PLATE, { front: true });
    atlas.add(fp.face); pal.add(fp.back);
  }

  // --- single centre wiper parked along the screen base, bonnet nozzles
  {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const x = 0.09 - 0.72 * i / 8, y = 0.982 + 0.012 * i / 8; pts.push([x, y, prC.frontZ(x, y) - 0.014]); }
    pal.add(tube(pts, 0.0065, null, 'plastic', 5));
    pal.add(tube(pts.slice(2).map((p) => [p[0], p[1] - 0.006, p[2] + 0.004]), 0.009, null, 'rubber', 5));
    pal.add(cyl(0.02, 0.024, 0.03, 12, { p: [0.09, 0.975, prC.frontZ(0.09, 0.975) - 0.01], r: [Math.PI / 2 - 0.6, 0, 0] }, 'plastic'));
  }

  // --- door mirrors (black), handles, aerial
  {
    const mz = -0.63, my = 0.985, mx = prC.sideX(mz, 0.97);
    pal.add(blob(0.165, 0.105, 0.075, { p: [mx + 0.105, my, mz + 0.01] }, 'plastic', 3.2).sym());
    pal.add(box(0.07, 0.035, 0.09, { p: [mx + 0.02, my - 0.03, mz + 0.005], r: [0, -0.15, 0] }, 'plastic').sym());
    for (const z of [-0.07, 0.8]) {
      const hy = yFold(z) - 0.014, hx = probe(sideP).sideX(z, hy) || 0.83;
      pal.add(box(0.006, 0.034, 0.165, { p: [hx + 0.0005, hy, z] }, 'plastic').sym());
      pal.add(blob(0.018, 0.024, 0.15, { p: [hx + 0.005, hy, z] }, 'chrome', 5, 8).sym());
    }
    const ax = 0.73, az = 1.98, ay = prR.topY(ax, az);
    pal.add(cyl(0.011, 0.013, 0.02, 10, { p: [ax, ay + 0.006, az] }, 'chrome'));
    pal.add(cyl(0.002, 0.0035, 0.34, 6, { p: [ax, ay + 0.18, az] }, 'chrome'));
  }

  const wheel = { soup: gulliWheel(0.311, 0.19, 0.1905) };
  return assembleCar({ id: 'w201', dims: DIMS, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
}
