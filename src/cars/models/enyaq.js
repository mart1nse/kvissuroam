// 2023 Skoda Enyaq iV 80x - mid-size electric SUV in Black Magic pearl: high beltline rising to a kinked rear
// quarter window, raked tailgate under a matt black roof spoiler, slim crystalline LED lamps with a C-shaped
// signature and ŠKODA block lettering between them, black arch, sill and lower bumper cladding.
// Fitted with black aero roof bars on the flush roof rails carrying two empty upright bike carriers.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, fromGeo, canvasTex, drawPlate, plate, assembleCar, arcPts, frontYaw, rearWiper } from './kit.js';

// real car: 4649 x 1879 x 1616 mm, wheelbase 2765, track 1587 front / 1566 rear, overhangs 860 / 1024,
// ground clearance 186 mm, 235/45 R21 front and 255/40 R21 rear on 21-inch turbine wheels
const DIMS = { length: 4.649, width: 1.879, height: 1.616, wheelbase: 2.765, track: 1.567, trackFront: 1.587, wheelRadius: 0.369, wheelRadiusFront: 0.3715 };
const HZ = DIMS.wheelbase / 2, ZF = -HZ - 0.86, ZR = HZ + 1.024;
const AY = 0.38, AR = 0.43;

// ------------------------------------------------------------------ small geometry helpers
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
// triangle with per-vertex normals, wound so that it faces along the normals
function tri(s, A, B, C, nA, nB, nC) {
  const g = v3.cross(v3.sub(B, A), v3.sub(C, A)), n = v3.add(v3.add(nA, nB), nC);
  if (v3.dot(g, n) < 0) { [B, C] = [C, B]; [nB, nC] = [nC, nB]; }
  s.p.push(...A, ...B, ...C); s.n.push(...nA, ...nB, ...nC);
}
// triangles of a soup whose centroid passes fn(x, y, z): a small target for fast probing
function subSoup(soup, fn) {
  const o = new Soup(), P = soup.p, N = soup.n;
  for (let i = 0; i < P.length; i += 9) {
    if (!fn((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3)) continue;
    for (let k = 0; k < 9; k++) { o.p.push(P[i + k]); o.n.push(N[i + k]); }
  }
  return o;
}
// Turn a decal lifted h off the body into a solid plate: walls from its open boundary back into the body.
function raise(d, h) {
  const P = d.p, N = d.n, key = (i) => `${Math.round(P[i] * 5e4)},${Math.round(P[i + 1] * 5e4)},${Math.round(P[i + 2] * 5e4)}`;
  const edges = new Map();
  for (let t = 0; t < P.length; t += 9) for (let k = 0; k < 3; k++) {
    const a = t + k * 3, b = t + ((k + 1) % 3) * 3, ka = key(a), kb = key(b);
    if (ka === kb) continue;
    const kk = ka < kb ? ka + '|' + kb : kb + '|' + ka, e = edges.get(kk);
    if (e) e.n++; else edges.set(kk, { n: 1, a, b, t });
  }
  const w = new Soup(), pt = (i) => [P[i], P[i + 1], P[i + 2]], nr = (i) => [N[i], N[i + 1], N[i + 2]];
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    const A = pt(e.a), B = pt(e.b), nA = nr(e.a), nB = nr(e.b);
    const A1 = v3.sub(A, v3.mul(nA, h + 0.003)), B1 = v3.sub(B, v3.mul(nB, h + 0.003));
    const out = v3.norm(v3.cross(v3.sub(B, A), v3.norm(v3.add(nA, nB))));
    // make sure the wall faces away from the centroid of the triangle it bounds
    const c = [(P[e.t] + P[e.t + 3] + P[e.t + 6]) / 3, (P[e.t + 1] + P[e.t + 4] + P[e.t + 7]) / 3, (P[e.t + 2] + P[e.t + 5] + P[e.t + 8]) / 3];
    const o = v3.dot(out, v3.sub(A, c)) < 0 ? v3.mul(out, -1) : out;
    tri(w, A, A1, B1, o, o, o); tri(w, A, B1, B, o, o, o);
  }
  return d.add(w);
}
// Sweep a closed 2D profile [s (side), t (up)] along a 3D polyline. scale(i, n) can taper it.
function sweep(path, prof, { up = [0, 1, 0], caps = true, scale = null } = {}) {
  const s = new Soup(), n = path.length, m = prof.length;
  const pn = prof.map((p, i) => {
    const a = prof[(i + m - 1) % m], b = prof[(i + 1) % m];
    const e1 = [p[1] - a[1], a[0] - p[0]], e2 = [b[1] - p[1], p[0] - b[0]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const x = e1[0] / l1 + e2[0] / l2, y = e1[1] / l1 + e2[1] / l2, l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  const area = prof.reduce((acc, p, i) => { const q = prof[(i + 1) % m]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sg = area > 0 ? 1 : -1;
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const T = v3.norm(v3.sub(b, a)), S = v3.norm(v3.cross(T, up)), U = v3.cross(S, T);
    const k = scale ? scale(i, n) : 1;
    return prof.map((q, j) => ({
      P: [p[0] + (S[0] * q[0] + U[0] * q[1]) * k, p[1] + (S[1] * q[0] + U[1] * q[1]) * k, p[2] + (S[2] * q[0] + U[2] * q[1]) * k],
      N: v3.norm(v3.add(v3.mul(S, pn[j][0] * sg), v3.mul(U, pn[j][1] * sg))),
    }));
  });
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) {
    const a = rings[i][j], b = rings[i][(j + 1) % m], c = rings[i + 1][(j + 1) % m], d = rings[i + 1][j];
    tri(s, a.P, b.P, c.P, a.N, b.N, c.N); tri(s, a.P, c.P, d.P, a.N, c.N, d.N);
  }
  if (caps) for (const [i, dir] of [[0, -1], [n - 1, 1]]) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)], T = v3.mul(v3.norm(v3.sub(b, a)), dir);
    const r = rings[i], c = r.reduce((acc, v) => v3.add(acc, v3.mul(v.P, 1 / m)), [0, 0, 0]);
    for (let j = 0; j < m; j++) tri(s, c, r[j].P, r[(j + 1) % m].P, T, T, T);
  }
  return s;
}
const rrect = (w, h, r, seg = 3) => rpoly([[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], r, seg);
function shapeOf(pts) {
  const sh = new THREE.Shape();
  pts.forEach((p, k) => (k ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  sh.closePath();
  return sh;
}
// (z, y) outline extruded along x from x0 to x1
function extrudeX(pts, x0, x1, bevel = 0.002) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: x1 - x0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.rotateY(-Math.PI / 2); g.translate(x1 - bevel, 0, 0);
  return fromGeo(g);
}
// (x, y) outline extruded along z from z0 to z1
function extrudeZ(pts, z0, z1, bevel = 0.002) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: z1 - z0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, z0 + bevel);
  return fromGeo(g);
}

// ------------------------------------------------------------------ wheel
// 21-inch two-tone turbine wheel: five broad swept blades, each with a bright machined face and an
// anthracite flank, over a dark barrel. Axis on X, outer face toward +X.
function lathe(prof, pal, seg = 44) {
  const g = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  g.rotateZ(-Math.PI / 2);
  return fromGeo(g, null, pal);
}
function turbineWheel(R, width, rimR) {
  const s = new Soup(), hw = width / 2, sh = R - rimR, rf = rimR - 0.012;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.014, -hw * 0.94], [R - 0.003, -hw * 0.82], [R, -hw * 0.6], [R, hw * 0.6],
    [R - 0.003, hw * 0.82], [R - 0.014, hw * 0.94], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber'));
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.004, hw * 0.86], [rimR - 0.002, hw * 0.9], [rimR - 0.009, hw * 0.88], [rimR - 0.013, hw * 0.6]], 'alloy'));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.008, 32), { p: [-hw * 0.5, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(cyl(rimR * 0.7, rimR * 0.7, 0.024, 32, { p: [hw * 0.05, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  s.add(cyl(rf * 0.3, rf * 0.34, hw * 0.9, 20, { p: [hw * 0.25, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  const N = 5, r0 = rf * 0.16, r1 = rf * 0.995, twist = 0.44, steps = 10;
  // blade edge at fraction e (-1 = leading edge .. 1 = trailing edge) of its width, as points from hub to rim
  const edge = (i, e) => Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps, r = r0 + (r1 - r0) * t;
    const a = Math.PI / 2 + i * Math.PI * 2 / N + twist * t ** 1.2 + e * (0.026 + 0.07 * t) / r;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const face = (pts, depth, x, pal, bevel) => {
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
    g.rotateY(Math.PI / 2); g.translate(x, 0, 0);
    return fromGeo(g, null, pal);
  };
  const xf = hw * 0.68;
  for (let i = 0; i < N; i++) {
    s.add(face([...edge(i, -1), ...edge(i, 0.25).reverse()], 0.016, xf + 0.006, 'alloy', 0.003));        // machined face
    s.add(face([...edge(i, 0.25), ...edge(i, 1.1).reverse()], 0.016, xf - 0.004, 'darkalloy', 0.003));     // sunk anthracite flank
    // slim gloss black fin filling part of the gap behind each blade
    s.add(face([...edge(i, 1.1), ...edge(i, 1.85).reverse()].filter((p) => Math.hypot(p[0], p[1]) > rf * 0.45), 0.008, xf - 0.012, 'gloss', 0.002));
  }
  s.add(cyl(rf * 0.24, rf * 0.27, 0.03, 24, { p: [xf + 0.012, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  s.add(cyl(rf * 0.13, rf * 0.14, 0.008, 20, { p: [xf + 0.03, 0, 0], r: [0, 0, -Math.PI / 2] }, 'gloss'));
  s.add(cyl(rf * 0.085, rf * 0.085, 0.004, 16, { p: [xf + 0.035, 0, 0], r: [0, 0, -Math.PI / 2] }, 'silver'));
  return s;
}

// ------------------------------------------------------------------ textures
function lampTextures() {
  // Tail lamp, u: 0 = inboard end (on the tailgate) .. 1 = the tip on the flank; canvas top = lamp top.
  // A red light bar runs along the top and round the corner; under it the tailgate part is a clear strip
  // (indicator / reverse, its own mesh) and the flank part is dark red crystal.
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#1c1c1c' : '#3a0407'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 6 : 0; x < w; x += 12) {
      const v = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
      g.fillStyle = glow ? `rgb(${70 + v * 70 | 0},${70 + v * 70 | 0},${70 + v * 70 | 0})` : `rgb(${70 + v * 70 | 0},${6 + v * 8 | 0},${10 + v * 8 | 0})`;
      g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + 6, y); g.lineTo(x + 12, y + 4); g.lineTo(x + 6, y + 8); g.closePath(); g.fill();
    }
    const P = (pts) => { g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h))); g.stroke(); };
    // the light bar: along the top, hooking down at the corner and back inboard (the C signature)
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = glow ? '#fff' : '#e0261f'; g.lineWidth = h * 0.3;
    P([[0.02, 0.2], [0.97, 0.2]]);
    g.strokeStyle = glow ? '#eee' : '#c81d18'; g.lineWidth = h * 0.12;
    P([[0.5, 0.36], [0.47, 0.62], [0.56, 0.84]]);
    if (!glow) {
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, h * 0.06, w, h * 0.07);
      g.strokeStyle = '#140000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  // Headlamp, u: 0 = inboard (by the grille) .. 1 = outboard; DRL along the top, crystal modules and an arrow inside.
  const head = (glow) => (g, w, H) => {
    const h = H * 0.8;
    g.fillStyle = glow ? '#c8d2dc' : '#cfd6dd'; g.fillRect(0, h, w, H - h);
    g.fillStyle = glow ? '#000' : '#14171b'; g.fillRect(0, 0, w, h);
    if (!glow) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a4048'); gr.addColorStop(1, '#0d0f12'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.fillStyle = glow ? '#fff' : '#eef4fa';
    g.beginPath(); g.moveTo(w * 0.02, h * 0.12); g.lineTo(w * 0.98, h * 0.05); g.lineTo(w * 0.98, h * 0.22); g.lineTo(w * 0.05, h * 0.27); g.closePath(); g.fill();
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + i * 0.12);
      g.fillStyle = glow ? '#fff' : '#b9c4cf'; g.fillRect(x, h * 0.42, w * 0.085, h * 0.36);
      if (!glow) { g.fillStyle = '#e9f0f6'; g.fillRect(x + w * 0.01, h * 0.46, w * 0.03, h * 0.12); }
    }
    g.strokeStyle = glow ? '#ddd' : '#9aa6b2'; g.lineWidth = h * 0.06;
    g.beginPath(); g.moveTo(w * 0.17, h * 0.4); g.lineTo(w * 0.06, h * 0.6); g.lineTo(w * 0.17, h * 0.8); g.stroke();
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 80, head(false)), headGlow: canvasTex(256, 80, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_SKODA = uvr(0, 196, 1024, 128), A_80X = uvr(0, 340, 230, 100), A_LOGO = uvr(250, 336, 170, 170);
const A_ENYAQ = uvr(440, 340, 420, 84), A_IV = uvr(880, 340, 130, 100);
function skodaLogo(g, cx, cy, r, col) {
  g.save(); g.translate(cx, cy);
  g.strokeStyle = col; g.lineWidth = r * 0.14; g.beginPath(); g.arc(0, 0, r * 0.9, 0, 7); g.stroke();
  g.fillStyle = col;
  // winged arrow: wing sweeping up-left, arrow pointing right
  g.beginPath(); g.moveTo(-r * 0.62, r * 0.05); g.quadraticCurveTo(-r * 0.3, -r * 0.62, r * 0.12, -r * 0.42); g.lineTo(-r * 0.08, -r * 0.22);
  g.lineTo(r * 0.6, -r * 0.05); g.lineTo(-r * 0.05, r * 0.3); g.quadraticCurveTo(-r * 0.4, r * 0.3, -r * 0.62, r * 0.05); g.fill();
  g.beginPath(); g.arc(r * 0.22, r * 0.18, r * 0.12, 0, 7); g.fill();
  g.restore();
}
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '823 ENQ');
    // chrome lettering with a thin dark edge, so it reads against both the black paint and bright reflections
    const chrome = (txt, x, y, font, sx, edge) => {
      g.save(); g.translate(x, y); g.scale(sx, 1); g.font = font; g.lineJoin = 'round';
      g.strokeStyle = '#1d1f22'; g.lineWidth = edge; g.strokeText(txt, 0, 0);
      const gr = g.createLinearGradient(0, -50, 0, 50);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#c4c8cc'); gr.addColorStop(1, '#eef0f2');
      g.fillStyle = gr; g.fillText(txt, 0, 0); g.restore();
    };
    g.textBaseline = 'middle'; g.textAlign = 'center';
    // ŠKODA: slim, widely spaced block letters
    'ŠKODA'.split('').forEach((c, i) => chrome(c, 96 + i * 208, 266, '600 92px Arial, Helvetica, sans-serif', 1.35, 8));
    chrome('80x', 115, 392, 'bold 80px Arial, Helvetica, sans-serif', 1.1, 8);
    'ENYAQ'.split('').forEach((c, i) => chrome(c, 482 + i * 84, 384, 'bold 70px Arial, Helvetica, sans-serif', 1.25, 7));
    chrome('iV', 945, 392, 'italic bold 84px Arial, Helvetica, sans-serif', 1.0, 8);
    skodaLogo(g, 335, 421, 80, '#d9dcdf');
  });
}

// ------------------------------------------------------------------ roof rack: aero bars on the flush rails + two bike carriers with their arms folded down
function aerofoil(c, t, n = 10) {
  // closed (z, y) section, leading edge toward -z, flat-ish bottom
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, z = -c / 2 + c * u;
    const th = t * (1.4845 * Math.sqrt(u) - 0.63 * u - 1.758 * u * u + 1.4215 * u ** 3 - 0.5075 * u ** 4);
    up.push([z, th * 0.78]); lo.push([z, -th * 0.22]);
  }
  return [...lo, ...up.reverse().slice(1, -1)];
}
function roofRack(pr, railX, zBars) {
  const s = new Soup();
  const barC = 0.082, barT = 0.026, footH = 0.062;
  const tops = [];
  for (const zb of zBars) {
    const rx = railX(zb), yr = pr.topY(rx, zb) + 0.026;   // top of the flush rail
    const yb = yr + footH;                                 // underside of the bar
    // bar: black aerofoil with a rubber T-track strip on top, cut flush with the feet
    s.add(extrudeX(aerofoil(barC, barT * 1.6).map(([z, y]) => [z + zb, y + yb]), -rx - 0.02, rx + 0.02, 0.003).pal('plastic'));
    s.add(box(2 * rx - 0.06, 0.004, 0.018, { p: [0, yb + barT * 0.78 * 0.95 + 0.001, zb - 0.004] }, 'rubber'));
    // feet: sloped covers standing on the rails, the bar running into them
    for (const sx of [-1, 1]) {
      const x = sx * rx;
      // sculpted cover: inner face upright, outer face sloping in to meet the bar end
      const prof = [[-0.034, 0], [0.034, 0], [0.03, 0.03], [0.014, footH + 0.02], [-0.034, footH + 0.02]];
      const foot = extrudeZ((sx > 0 ? prof : prof.map(([a, b]) => [-a, b]).reverse()).map(([a, b]) => [a + x, b + yr - 0.004]), zb - 0.07, zb + 0.075, 0.01);
      s.add(foot.pal('gloss'));
      s.add(box(0.06, 0.012, 0.13, { p: [x, yr + 0.002, zb + 0.003] }, 'rubber'));
      s.add(cyl(0.008, 0.008, 0.006, 10, { p: [x + sx * 0.026, yr + 0.045, zb + 0.003], r: [0, 0, Math.PI / 2 + sx * 0.6] }, 'steel'));
    }
    tops.push(yb + barT * 0.78);
  }
  return { soup: s, barTop: tops };
}
// Roof bike carrier (wheel tray along z, frame-holder arm folded down), centred at x = xc; arm on the side armSide.
function bikeCarrier(xc, zc, yBase, armSide) {
  const s = new Soup(), L = 1.45, z0 = zc - L / 2, z1 = zc + L / 2;
  // wheel tray: a shallow black U-channel, gently curving up at both ends into the wheel holders
  const tray = [[-0.03, 0], [0.03, 0], [0.03, 0.034], [0.021, 0.034], [0.017, 0.012], [-0.017, 0.012], [-0.021, 0.034], [-0.03, 0.034]];
  const lift = (z) => { const e = Math.max(0, Math.abs(z - zc) - 0.5) / 0.225; return yBase + 0.012 + 0.05 * e * e; };
  const path = [];
  for (let i = 0; i <= 24; i++) { const z = z0 + (z1 - z0) * i / 24; path.push([xc, lift(z), z]); }
  s.add(sweep(path, tray).pal('plastic'));
  // wheel holders: wide cradles with a ratchet strap each
  for (const [zw, dir] of [[z0 + 0.13, -1], [z1 - 0.13, 1]]) {
    const yw = lift(zw), cr = [];
    for (let i = 0; i <= 8; i++) { const a = (-24 + 48 * i / 8) * Math.PI / 180; cr.push([xc, yw + 0.34 - 0.34 * Math.cos(a) + 0.008, zw + 0.34 * Math.sin(a)]); }
    s.add(sweep(cr, [[-0.042, 0], [0.042, 0], [0.042, 0.03], [0.034, 0.034], [0.03, 0.012], [-0.03, 0.012], [-0.034, 0.034], [-0.042, 0.03]]).pal('gloss'));
    const st = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; st.push([xc - 0.04 * Math.cos(a), yw + 0.035 + 0.075 * Math.sin(a), zw + dir * 0.02]); }
    s.add(sweep(st, rrect(0.024, 0.003, 0.001, 1), { up: [0, 0, 1] }).pal('rubber'));
    s.add(box(0.022, 0.04, 0.03, { p: [xc + 0.045, yw + 0.05, zw + dir * 0.02] }, 'darkalloy'));
  }
  // frame holder folded down: pivot block near the front of the tray, the black arm lying back along it,
  // claw head with its torque knob resting just above the tray
  const xa = xc + armSide * 0.05, za = zc - 0.4, lean = -1.47, H = 0.56;
  const dY = Math.cos(lean), dZ = -Math.sin(lean);          // arm direction (y, z)
  s.add(box(0.06, 0.04, 0.09, { p: [xc + armSide * 0.03, yBase + 0.045, za] }, 'gloss'));
  const y0a = yBase + 0.062, top = [xa, y0a + H * dY, za + H * dZ];
  s.add(sweep([[xa, y0a, za], top], rrect(0.03, 0.04, 0.008, 2).map(([a, b]) => [a, b - 0.02])).pal('plastic'));
  s.add(box(0.075, 0.06, 0.07, { p: [xa - armSide * 0.035, top[1] + 0.01 * dY, top[2] + 0.01 * dZ], r: [-lean, 0, 0] }, 'plastic'));
  for (const e of [-0.035, 0.035]) s.add(box(0.03, 0.05, 0.05, { p: [xc, top[1] - 0.035 * dY - e * dZ, top[2] - 0.035 * dZ + e * dY], r: [-lean, 0, 0] }, 'rubber'));
  s.add(cyl(0.032, 0.032, 0.03, 16, { p: [xa + armSide * 0.012, top[1] + 0.012 * dY, top[2] + 0.012 * dZ], r: [0, 0, Math.PI / 2] }, 'plastic'));
  s.add(cyl(0.012, 0.012, 0.034, 10, { p: [xa + armSide * 0.014, top[1] + 0.012 * dY, top[2] + 0.012 * dZ], r: [0, 0, Math.PI / 2] }, 'steel'));
  return s;
}

export function buildEnyaq() {
  const body = buildBody({
    top: [[ZF, 0.54], [ZF + 0.005, 0.64, 0.03], [-2.225, 0.76, 0.05], [-2.196, 0.845, 0.05], [-2.14, 0.905, 0.07], [-2.0, 0.952, 0.12], [-1.5, 1.025, 0.25], [-0.97, 1.09, 0.06],
      [-0.08, 1.545, 0.25], [0.45, 1.598, 1.0], [1.6, 1.558, 0.4], [1.98, 1.525, 0.03], [2.05, 1.515, 0.012], [2.055, 1.482, 0.01], [2.335, 1.095, 0.04],
      [2.38, 1.0, 0.04], [2.395, 0.88, 0.05], [ZR - 0.003, 0.68, 0.03], [ZR, 0.52]],
    bottom: [[ZF, 0.54], [ZF + 0.006, 0.42, 0.03], [-2.2, 0.32, 0.04], [-2.1, 0.26, 0.05], [-1.9, 0.205, 0.1], [1.85, 0.205, 0.1], [2.24, 0.29, 0.05], [ZR - 0.012, 0.33, 0.03], [ZR, 0.52]],
    w: [[ZF, 0.8], [-2.12, 0.875], [-1.9, 0.912], [-1.38, 0.925], [-0.6, 0.92], [0.4, 0.92], [1.38, 0.926], [1.95, 0.92], [2.25, 0.905], [ZR, 0.87]],
    yWaist: [[ZF, 0.7], [-1.4, 0.74], [1.4, 0.76], [ZR, 0.78]], tuck: 0.08, ySill: 0.22,
    yBelt: [[ZF, 0.88], [-1.9, 0.92], [-1.0, 0.975], [0.2, 0.995], [1.3, 1.01], [2.0, 1.04], [ZR, 1.06]],
    sh: 0.03, ledge: [[ZF, 0.01], [-1.0, 0.018], [1.0, 0.025], [1.9, 0.05], [ZR, 0.05]], ledgeH: 0.05,
    th: [[ZF, 0.42], [1.2, 0.42], [1.9, 0.54], [2.3, 0.66], [ZR, 0.66]], thc: [[ZF, 0.1], [1.2, 0.12], [2.2, 0.4]],
    rr: [[ZF, 0.05], [-1.0, 0.07], [-0.1, 0.11], [1.9, 0.1], [2.1, 0.08], [2.35, 0.07], [ZR, 0.05]],
    rs: 0.07,
    crown: [[ZF, 0.03], [-1.0, 0.035], [-0.1, 0.05], [1.9, 0.045], [2.1, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.28], [-2.0, 0.18], [-1.6, 0.11], [-1.0, 0.12], [-0.1, 0.07], [0.05, 0], [1.6, 0], [2.0, 0.05], [2.1, 0.07], [2.33, 0.12], [ZR, 0.2]],
    bowN: [[ZF, 2.4], [-1.6, 2.4], [-1.0, 2.2], [1.6, 2.5], [2.1, 3], [ZR, 3.2]],
  });
  const raw = body.soup, pr = probe(raw);
  const prTop = probe(subSoup(raw, (x, y) => y > 1.3)), prRear = probe(subSoup(raw, (x, y, z) => z > 1.8)), prFront = probe(subSoup(raw, (x, y, z) => z < -1.6));
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.94 });
  // decal helpers bound to the part of the shell each projection can reach (keeps the build fast)
  const dcS = decals(subSoup(shell, (x) => x > 0.3)), dcR = decals(subSoup(shell, (x, y, z) => z > 1.6));
  const dcF = decals(subSoup(shell, (x, y, z) => z < -1.6)), dcT = decals(subSoup(shell, (x, y) => y > 0.85));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.7 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glazing: rising window line with the kinked rear quarter glass, chrome surround
  // the sill line rises gently all the way back and the top edge sweeps down to meet it: the quarter glass ends in a
  // rounded point low over the back of the rear wheel, its rear edge leaning forward, leaving a broad body-colour
  // pillar ahead of the tailgate
  const dlo = rpoly([[-0.86, 1.095], [0.2, 1.118], [1.15, 1.152], [1.45, 1.178], [1.72, 1.224, 0.028], [1.53, 1.406, 0.11], [1.15, 1.45, 0.1], [0.5, 1.497], [-0.02, 1.488]], 0.025, 4);
  pal.add(dcS.side(grow(dlo, 0.013), { offset: 0.003 }).pal('chrome').sym());
  glass.add(dcS.side(dlo, { offset: 0.005 }).sym());
  pal.add(dcS.side([rect(0.19, 1.1, 0.265, 1.51), rpoly([[1.13, 1.13], [1.19, 1.13], [1.2, 1.46], [1.14, 1.46]], 0.005)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.74, 1.115], [0.74, 1.115], [0.6, 1.528], [-0.6, 1.528]], 0.05);
  const dcW = decals(subSoup(shell, (x, y, z) => y > 1.0 && z < 0.2));
  pal.add(dcW.front(grow(ws, 0.016), { offset: 0.003 }).pal('gloss'));
  glass.add(dcW.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.6, 1.118], [0.6, 1.118], [0.47, 1.462], [-0.47, 1.462]], 0.06);
  pal.add(dcR.rear(grow(rw, 0.016), { offset: 0.003, ...fr }).pal('gloss'));
  glass.add(dcR.rear(rw, { offset: 0.007, ...fr }));
  // matt black roof spoiler over the rear glass, third brake light under its lip
  pal.add(dcT.top(rpoly([[-0.62, 1.9], [0.62, 1.9], [0.62, 2.2], [-0.62, 2.2]], 0.04), { offset: 0.0035, minFacing: 0.3, filter: (v) => v[1] > 1.475 }).pal('plastic'));
  pal.add(dcR.rear(rect(-0.62, 1.468, 0.62, 1.53), { offset: 0.0035, minFacing: 0.05, filter: (v) => v[2] > 1.95 && v[1] > 1.468 }).pal('plastic'));
  // the spoiler itself: a gloss black blade overhanging the glass, third brake light in its trailing edge,
  // and the black air guides down both sides of the rear window
  {
    const m = new THREE.Matrix4().makeTranslation(0, 1.5, 2.085).multiply(new THREE.Matrix4().makeRotationX(0.13));
    pal.add(blob(1.07, 0.026, 0.18, m, 'gloss', 6, 10));
    chmsl.add(box(0.46, 0.007, 0.006, { p: [0, 1.487, 2.179], r: [0.13, 0, 0] }));
    const fin = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, x = 0.5 + 0.125 * t, y = 1.47 - 0.3 * t; fin.push([x, y, prRear.rearZ(x - 0.03, y) + 0.004]); }
    pal.add(sweep(fin, rrect(0.016, 0.055, 0.004, 1), { up: [0, 0, 1], scale: (i, n) => (i === n - 1 ? 0.35 : 1) }).pal('gloss').sym());
  }
  // black panoramic roof
  pal.add(dcT.top(rpoly([[-0.5, -0.05], [0.5, -0.05], [0.5, 1.55], [-0.5, 1.55]], 0.06), { offset: 0.004, minFacing: 0.6 }).pal('darkglass'));

  // --- black cladding: arches, sills, lower bumpers (raised a little off the paint)
  const ring = (z, a0, a1, r0, r1) => [...arcPts(z, AY, r1, a0, a1, 20), ...arcPts(z, AY, r0, a1, a0, 20)];
  const clad = new Soup();
  clad.add(raise(dcS.side([ring(-HZ, -12, 192, AR - 0.01, AR + 0.055), ring(HZ, -12, 192, AR - 0.01, AR + 0.055)], { offset: 0.016, minFacing: 0.2 }), 0.016));
  clad.add(raise(dcS.side(rect(-HZ + 0.4, 0.19, HZ - 0.4, 0.355, 0.01), { offset: 0.012, minFacing: 0.2 }), 0.012));
  clad.add(raise(dcS.side(rpoly([[HZ + 0.42, 0.25], [2.6, 0.25], [2.6, 0.5], [HZ + 0.45, 0.5]], 0.02), { offset: 0.01, minFacing: 0.15 }), 0.01));
  clad.add(raise(dcS.side(rpoly([[-2.6, 0.24], [-HZ - 0.42, 0.24], [-HZ - 0.45, 0.33], [-2.6, 0.33]], 0.02), { offset: 0.01, minFacing: 0.15 }), 0.01));
  pal.add(clad.pal('plastic').sym());
  const rb = { minFacing: 0.1, filter: (v) => v[2] > 2.15 && v[1] < 0.56 };
  pal.add(raise(dcR.rear(rect(-1, 0.26, 1, 0.52), { offset: 0.01, ...rb }), 0.01).pal('clad'));
  pal.add(raise(dcR.rear(rpoly([[-0.6, 0.3], [0.6, 0.3], [0.54, 0.41], [-0.54, 0.41]], 0.02), { offset: 0.016, ...rb }), 0.006).pal('plastic'));
  pal.add(raise(dcR.rear([rect(-0.66, 0.418, 0.66, 0.436, 0.006), rpoly([[0.6, 0.3], [0.63, 0.3], [0.69, 0.43], [0.66, 0.43]], 0.004), rpoly([[-0.63, 0.3], [-0.6, 0.3], [-0.66, 0.43], [-0.69, 0.43]], 0.004)], { offset: 0.02, ...rb }), 0.004).pal('silver'));
  pal.add(dcR.rear([rect(0.72, 0.39, 0.9, 0.412, 0.006)], { offset: 0.013, minFacing: 0.05, filter: (v) => v[2] > 2.0 }).pal('reflector').sym());
  pal.add(raise(dcF.front(rect(-1, 0.24, 1, 0.33), { offset: 0.01, minFacing: 0.05, filter: (v) => v[2] < -1.95 && v[1] < 0.35 }), 0.01).pal('plastic'));

  // --- shut lines
  const lw = 0.007;
  pal.add(dcS.side([
    ...stroke([[-0.85, 0.37], [-0.85, 1.08]], lw), ...stroke([[0.225, 0.37], [0.225, 1.11]], lw),
    ...stroke([[1.165, 1.14], [1.15, 1.0], [1.08, 0.93], [0.93, 0.88], [0.86, 0.7], [0.86, 0.37]], lw),
    ...stroke([[-0.85, 0.37], [0.86, 0.37]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dcS.side(stroke(rpoly([[1.7, 0.86], [1.9, 0.86], [1.9, 0.98], [1.7, 0.98]], 0.02, 3).concat([[1.7, 0.9]]), 0.005), { offset: 0.0055 }).pal('line'));
  pal.add(dcT.top(stroke([[0.74, -2.08], [0.8, -1.0]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dcR.rear([...stroke([[0.53, 1.47], [0.67, 1.13], [0.645, 1.0], [0.625, 0.64]], 0.0045), ...stroke([[-0.625, 0.64], [0.625, 0.64]], 0.0045)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- tail lamps (wrapping round the corners), lettering, badges, plate
  // yaw frame with a ~ 0.85 x on the tailgate, growing on round the corner onto the flank
  const ty = dcR.yaw(32), to = { minFacing: 0.02, origin: [0, 0, 2.37], ...fr };
  // slim lamp: about 0.1 m tall across the tailgate with a slanted inner end, tapering to a point on the flank
  const lampPoly = rpoly([[0.335, 0.959], [0.6, 0.955], [0.7, 0.977], [0.872, 1.043], [0.876, 1.063], [0.3, 1.063]], 0.006, 3);
  tail.add(ty(lampPoly, { offset: 0.006, ...to }));
  tail.add(tail.mirrored());
  // clear strip (indicator / reverse) under the light bar on the tailgate part
  reverse.add(ty(rpoly([[0.348, 0.968], [0.585, 0.964], [0.6, 1.005], [0.333, 1.007]], 0.004), { offset: 0.0075, ...to }).sym());
  atlas.add(dcR.rear(rect(-0.25, 0.981, 0.25, 1.043), { offset: 0.008, ...fr }).uvRect(A_SKODA));
  atlas.add(dcR.rear(rect(-0.66, 0.885, -0.46, 0.925), { offset: 0.008, ...fr }).uvRect(A_ENYAQ));
  atlas.add(dcR.rear(rect(0.57, 0.885, 0.635, 0.935), { offset: 0.008, ...fr }).uvRect(A_IV));
  atlas.add(dcR.rear(rect(0.555, 0.83, 0.65, 0.871), { offset: 0.008, ...fr }).uvRect(A_80X));
  // plate low on the tailgate in its dark recess, just above the bumper
  const PY = 0.74, pz = prRear.rearZ(0, PY);
  const pl = plate([0, PY, pz + 0.006], A_PLATE, { tilt: 0.1 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(dcR.rear(rpoly([[-0.31, PY - 0.075], [0.31, PY - 0.075], [0.34, PY + 0.08], [-0.34, PY + 0.08]], 0.02), { offset: 0.004, ...fr }).pal('gloss'));
  // rear wiper parked along the top of the glass under the spoiler
  pal.add(rearWiper(prRear, 0.0, 1.448, -0.44, 1.432));

  // --- front: upright chrome-framed grille with crystal slats, slim lamps with DRL, black intake
  const gp = rpoly([[-0.43, 0.6], [0.43, 0.6], [0.47, 0.66], [0.48, 0.815], [0, 0.832], [-0.48, 0.815], [-0.47, 0.66]], 0.04);
  pal.add(raise(dcF.front(grow(gp, 0.02), { offset: 0.008, ...ff }), 0.008).pal('chrome'));
  pal.add(dcF.front(gp, { offset: 0.009, ...ff }).pal('plastic'));
  const ribs = []; for (let i = -12; i <= 12; i++) ribs.push(rect(i * 0.038 - 0.006, 0.615, i * 0.038 + 0.006, 0.815 - 0.05 * (i / 12) ** 4));
  pal.add(dcF.front(rpoly([[-0.62, 0.33], [0.62, 0.33], [0.58, 0.5], [-0.58, 0.5]], 0.04), { offset: 0.006, minFacing: 0.05, ...ff }).pal('well'));
  pal.add(dcF.front(rect(-0.6, 0.322, 0.6, 0.336, 0.004), { offset: 0.008, minFacing: 0.05, ...ff }).pal('chrome'));
  pal.add(dcF.front([rpoly([[0.66, 0.4], [0.7, 0.4], [0.78, 0.56], [0.74, 0.56]], 0.01), rpoly([[-0.66, 0.4], [-0.7, 0.4], [-0.78, 0.56], [-0.74, 0.56]], 0.01)], { offset: 0.007, minFacing: 0.05, ...ff }).pal('well'));
  atlas.add(dcF.front(rect(-0.042, 0.84, 0.042, 0.924), { offset: 0.008, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(30, -2.15);
  head.add(dcF.any(hy)(rpoly([[-0.86, 0.835], [-0.43, 0.792], [-0.41, 0.84], [-0.84, 0.898]], 0.012), { offset: 0.006, minFacing: 0.03, box: [-0.41, 0.792, -0.86, 0.898], ...ff }).uvRect([0, 0.2, 1, 1]));
  head.add(head.mirrored());
  // illuminated crystal slats: lit with the headlamps
  head.add(dcF.front(ribs, { offset: 0.011, ...ff }).uvRect([0.1, 0.03, 0.9, 0.17]));
  const fpz = prFront.frontZ(0, 0.43);
  const fp = plate([0, 0.43, fpz - 0.012], A_PLATE, { front: true, tilt: 0.04 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, roof rails, antenna, wipers
  // door mirrors: body-colour housings (2148 mm across), black sail foot on the door at the window line
  const mz = -0.79, mx = pr.sideX(mz, 1.08);
  paint.add(blob(0.225, 0.122, 0.11, { p: [0.962, 1.15, mz], r: [0, 0.1, 0.04] }, null, 3.2).sym());
  pal.add(blob(0.2, 0.012, 0.06, { p: [0.965, 1.094, mz - 0.03], r: [0, 0.1, 0.04] }, 'lens', 3, 6).sym());
  pal.add(blob(0.16, 0.05, 0.13, { p: [mx + 0.05, 1.105, mz + 0.01], r: [0, 0, -0.15] }, 'plastic', 3, 8).sym());
  for (const z of [-0.12, 0.93]) {
    const hx = pr.sideX(z, 1.0);
    paint.add(blob(0.022, 0.03, 0.18, { p: [hx + 0.004, 1.0, z] }, null, 5, 8).sym());
  }
  const railX = (z) => 0.6 - 0.035 * Math.max(0, z - 0.2) / 1.7;
  const railPath = [];
  for (let i = 0; i <= 20; i++) { const z = -0.1 + 2.0 * i / 20; railPath.push([railX(z), prTop.topY(railX(z), z) - 0.004, z]); }
  pal.add(sweep(railPath, rpoly([[-0.017, 0], [0.017, 0], [0.013, 0.03], [-0.013, 0.03]], 0.008, 2), { scale: (i, n) => (i === 0 || i === n - 1 ? 0.6 : 1) }).pal('silver').sym());
  pal.add(blob(0.055, 0.065, 0.2, { p: [0, prTop.topY(0, 1.85) + 0.025, 1.85] }, 'gloss', 2.5, 8));
  for (const sx of [-1, 1]) pal.add(sweep([[sx * 0.05, 1.11, -0.98], [sx * 0.3, 1.12, -0.96], [sx * 0.55, 1.13, -0.94]], rrect(0.012, 0.012, 0.003, 1)).pal('plastic'));

  // --- roof bars and bike carriers
  const zBars = [0.1, 0.85];
  const rack = roofRack(prTop, railX, zBars);
  pal.add(rack.soup);
  const yTray = Math.max(...rack.barTop);
  const bike = new Soup();
  bike.add(bikeCarrier(0.3, 0.45, yTray, 1));
  for (const zb of zBars) bike.add(box(0.06, 0.02, 0.1, { p: [0.3, yTray - 0.004, zb] }, 'gloss'));
  pal.add(bike.sym());

  // 21-inch wheels: 235/45 R21 front, 255/40 R21 rear. The visible rim runs out to the flange, about 15 mm
  // beyond the 533 mm bead seat diameter.
  const RIM21 = 0.282;
  const wheelFront = { soup: turbineWheel(DIMS.wheelRadiusFront, 0.235, RIM21) };
  const wheel = { soup: turbineWheel(DIMS.wheelRadius, 0.255, RIM21) };
  return assembleCar({ id: 'enyaq', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel, wheelFront });
}
