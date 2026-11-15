// Bridge spans and tunnel lids: the "decks" that lie above the height field (see tools/bake/terrain.py).
// The top is drawn with the ground material of the tile it is in, because the aerial photo shows the
// topmost surface. The slab under it, the portal beams and the railings are plain concrete.
import * as THREE from 'three';

const LIFT = 0.03, SLAB = 0.7, RAIL = 1.05;
const mat = (color, extra) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, ...extra });
const MATS = {
  concrete: mat(0x6f6a78), rail: mat(0x8d8799), white: mat(0xd9d4dc), steel: mat(0xb9c2d6), dark: mat(0x3a3846),
  lamp: mat(0xfff2c4, { emissive: 0xffd9a0, emissiveIntensity: 1.6 }),
};

// left and right edge of station i: [xl, zl, xr, zr]
function edges(d, i, out, inset = 0) {
  const P = d.pts, a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, P.length - 1)];
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  const nx = -dz / l * (d.hw - inset), nz = dx / l * (d.hw - inset);
  out[0] = P[i][0] + nx; out[1] = P[i][1] + nz; out[2] = P[i][0] - nx; out[3] = P[i][1] - nz;
  return out;
}

const inRect = (d, i, x0, z0, size) => {
  const P = d.pts, mx = (P[i][0] + P[i + 1][0]) / 2, mz = (P[i][1] + P[i + 1][1]) / 2;
  return mx >= x0 && mx < x0 + size && mz >= z0 && mz < z0 + size;
};

// Top surfaces of the deck segments inside one ground tile, with the tile's texture coordinates.
export function deckTopGeometry(world, x0, z0, size) {
  const pos = [], uv = [], e0 = [0, 0, 0, 0], e1 = [0, 0, 0, 0];
  for (const d of world.decks) {
    if (d.x1 < x0 || d.x0 > x0 + size || d.z1 < z0 || d.z0 > z0 + size) continue;
    const P = d.pts;
    for (let i = 0; i < P.length - 1; i++) {
      if (!inRect(d, i, x0, z0, size)) continue;
      edges(d, i, e0); edges(d, i + 1, e1);
      const a = P[i], b = P[i + 1], m = a.length - 3;
      for (let j = 0; j < m; j++) {                      // strips from the left edge to the right edge
        const u0 = j / m, u1 = (j + 1) / m;
        const at = (e, p, u, k) => [e[0] + (e[2] - e[0]) * u, p[2 + k], e[1] + (e[3] - e[1]) * u];
        const v = [at(e0, a, u0, j), at(e0, a, u1, j + 1), at(e1, b, u0, j), at(e1, b, u1, j + 1)];
        for (const k of [0, 2, 1, 1, 2, 3]) {
          pos.push(v[k][0], v[k][1] + LIFT, v[k][2]);
          uv.push((v[k][0] - x0) / size, 1 - (v[k][2] - z0) / size);
        }
      }
    }
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  return geo;
}

// ---- how each kind of bridge is built (the "b" of a deck over water, set by tools/bake/terrain.py)
//   girder     piers under a beam that is deeper over the piers (Kroonuaia sild, Sõpruse sild)
//   victory    the same on two river piers, with lamp posts on the parapet (Võidu sild)
//   arch       a white concrete arch high over a narrow footbridge (Kaarsild)
//   steelarch  steel arches through the deck of a road bridge (Vabadussild)
//   cable      a footbridge hung by seven pairs of cables from one pylon (Turusild)
const SPAN = { girder: 34, victory: 24 };

function measure(d) {
  if (d.len) return d;
  const P = d.pts, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  d.cum = cum; d.len = cum[cum.length - 1];
  // main span: the middle of the deck for the hung and arched bridges
  const main = d.b === 'cable' ? Math.min(96, d.len) : d.b === 'steelarch' ? d.len * 0.82 : d.len;
  d.main = [(d.len - main) / 2, (d.len + main) / 2];
  d.piers = [];
  if (d.w) {
    if (d.b === 'arch') d.piers = [];
    else if (d.b === 'steelarch') d.piers = [d.main[0], d.main[1]];
    else {
      const step = d.b === 'cable' ? 26 : SPAN[d.b] || 34;
      const n = Math.max(1, Math.round(d.len / step));
      for (let k = 1; k < n; k++) {
        const t = (d.len * k) / n;
        if (d.b === 'cable' && t > d.main[0] + 4 && t < d.main[1] - 4) continue;
        d.piers.push(t);
      }
      if (d.b === 'cable') d.piers.push(d.main[0], d.main[1]);
    }
  }
  return d;
}

// depth of the beam under station i
function depth(d, i) {
  if (!d.w) return SLAB;
  if (d.b === 'arch' || d.b === 'cable') return 0.55;
  if (d.b === 'steelarch') return 1.0;
  let near = Infinity;
  for (const t of d.piers) near = Math.min(near, Math.abs(d.cum[i] - t));
  const half = (SPAN[d.b] || 34) / 2;
  const u = Math.min(1, near / half);
  return 0.95 + 1.25 * (1 - u) * (1 - u);
}

// point on the deck at distance t along it and lat metres to the left of the centre line: [x, y, z]
function at(d, t, lat, out) {
  const P = d.pts, cum = d.cum;
  let i = 0;
  while (i < P.length - 2 && cum[i + 1] < t) i++;
  const a = P[i], b = P[i + 1], l = cum[i + 1] - cum[i] || 1, u = Math.max(0, Math.min(1, (t - cum[i]) / l));
  const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
  out[0] = a[0] + (b[0] - a[0]) * u - dz * lat;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[1] + (b[1] - a[1]) * u + dx * lat;
  out[3] = dx; out[4] = dz;
  return out;
}

const quad = (out, p, q, r, t) => out.push(...p, ...q, ...r, ...r, ...q, ...t);

// a square bar from p to q, w wide and h deep
function bar(out, p, q, w, h) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], l = Math.hypot(dx, dy, dz) || 1;
  let sx = -dz, sz = dx;                                   // sideways, level
  const sl = Math.hypot(sx, sz);
  if (sl < 1e-4) { sx = 1; sz = 0; } else { sx /= sl; sz /= sl; }
  // "up" of the bar: across both its axis and its side
  const ux = (dy * sz) / l, uy = (dz * sx - dx * sz) / l, uz = (-dy * sx) / l;
  const c = (e, k, m) => [e[0] + sx * k * w / 2 + ux * m * h / 2, e[1] + uy * m * h / 2, e[2] + sz * k * w / 2 + uz * m * h / 2];
  for (const [k1, m1, k2, m2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) quad(out, c(p, k1, m1), c(p, k2, m2), c(q, k1, m1), c(q, k2, m2));
}

// an upright box: centre of its foot, half sizes along (dx, dz) and across, height
function block(out, x, y0, z, dx, dz, along, across, y1) {
  const c = (a, b, y) => [x + dx * a * along - dz * b * across, y, z + dz * a * along + dx * b * across];
  for (const [a1, b1, a2, b2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) quad(out, c(a1, b1, y0), c(a2, b2, y0), c(a1, b1, y1), c(a2, b2, y1));
  quad(out, c(-1, -1, y1), c(1, -1, y1), c(-1, 1, y1), c(1, 1, y1));
}

// Everything of a bridge that is not its deck: piers, arches, pylon and cables, lamp posts.
function structure(world, d, out) {
  const o = [0, 0, 0, 0, 0], q = [0, 0, 0, 0, 0];
  const foot = world.meta.riverLevel - 4.5;
  for (const t of d.piers) {
    at(d, t, 0, o);
    const slim = d.b === 'cable' || d.b === 'steelarch';
    block(out.concrete, o[0], foot, o[2], o[3], o[4], slim ? 0.5 : 0.75, d.hw * (slim ? 0.45 : 0.82), o[1] - 0.5);
  }
  if (d.b === 'arch' || d.b === 'steelarch') {
    // two ribs, one along each edge, with hangers down to the deck
    const [t0, t1] = d.main, span = t1 - t0, rise = d.b === 'arch' ? span * 0.16 : span * 0.14;
    const m = d.b === 'arch' ? out.white : out.steel, sec = d.b === 'arch' ? [0.75, 0.9] : [0.6, 0.8];
    const sink = d.b === 'arch' ? 0.3 : 1.6;               // the steel arches spring from below the deck
    const n = 28;
    for (const side of [-1, 1]) {
      const lat = side * (d.hw + (d.b === 'arch' ? 0.1 : -0.45));
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const u = k / n, t = t0 + span * u;
        at(d, t, lat, o);
        const p = [o[0], o[1] - sink + (rise + sink) * 4 * u * (1 - u), o[2]];
        if (prev) bar(m, prev, p, sec[0], sec[1]);
        if (k > 1 && k < n - 1 && k % 2 === 0 && p[1] - o[1] > 1.3) bar(m, [o[0], o[1] + 0.05, o[2]], [p[0], p[1] - 0.3, p[2]], 0.09, 0.09);
        prev = p;
      }
    }
    if (d.b === 'steelarch') {                             // braces between the two ribs over the road
      for (const u of [0.38, 0.5, 0.62]) {
        at(d, t0 + span * u, d.hw - 0.45, o); at(d, t0 + span * u, -(d.hw - 0.45), q);
        const y = rise * 4 * u * (1 - u) - sink * (1 - 4 * u * (1 - u));
        bar(m, [o[0], o[1] + y, o[2]], [q[0], q[1] + y, q[2]], 0.35, 0.35);
      }
    }
  }
  if (d.b === 'cable') {
    // one pylon at the end of the hung span, cables fanning out to both edges of the deck
    const [t0, t1] = d.main, H = 30;
    at(d, t0, 0, o);
    const top = [o[0], o[1] + H, o[2]];
    for (const side of [-1, 1]) {
      at(d, t0, side * (d.hw + 1.6), q);
      bar(out.white, [q[0], foot, q[2]], [q[0], q[1] + 1, q[2]], 1.1, 1.1);
      bar(out.white, [q[0], q[1] + 1, q[2]], top, 0.9, 0.9);
      for (let k = 1; k <= 7; k++) {
        at(d, t0 + ((t1 - t0) * k) / 7.6, side * d.hw, q);
        bar(out.dark, [top[0], top[1] - 1 - k * 0.5, top[2]], [q[0], q[1] + 0.2, q[2]], 0.07, 0.07);
      }
      for (let k = 1; k <= 3; k++) {                       // back stays
        at(d, Math.max(0, t0 - k * 14), side * d.hw, q);
        bar(out.dark, [top[0], top[1] - 1 - k * 0.5, top[2]], [q[0], q[1] + 0.2, q[2]], 0.07, 0.07);
      }
    }
    bar(out.white, top, [top[0], top[1] + 3.5, top[2]], 0.12, 0.12);        // the wind vane mast
  }
  if (d.b === 'victory' || d.b === 'steelarch' || (d.b === 'girder' && d.hw > 4)) {
    const step = d.b === 'victory' ? 16 : 28, h = d.b === 'victory' ? 6.5 : 9;
    for (let t = step / 2; t < d.len; t += step) {
      for (const side of [-1, 1]) {
        at(d, t, side * (d.hw - 0.25), o);
        bar(out.dark, [o[0], o[1], o[2]], [o[0], o[1] + h, o[2]], 0.16, 0.16);
        if (d.b === 'victory') block(out.lamp, o[0], o[1] + h, o[2], 1, 0, 0.28, 0.28, o[1] + h + 0.55);
        else {
          at(d, t, side * (d.hw - 1.6), q);
          bar(out.dark, [o[0], o[1] + h, o[2]], [q[0], o[1] + h + 0.15, q[2]], 0.12, 0.12);
          block(out.lamp, q[0], o[1] + h - 0.02, q[2], 1, 0, 0.3, 0.14, o[1] + h + 0.1);
        }
      }
    }
  }
}

// Slab, portal beams, railings and structure of the decks inside one sector: a group, or null.
export function buildDeckBodies(world, s) {
  const S = world.meta.sector.size;
  const out = { concrete: [], rail: [], white: [], steel: [], dark: [], lamp: [] };
  const body = out.concrete, e0 = [0, 0, 0, 0], e1 = [0, 0, 0, 0];
  for (const d of world.decks) {
    if (d.x1 < s.x0 || d.x0 > s.x0 + S || d.z1 < s.z0 || d.z0 > s.z0 + S) continue;
    measure(d);
    const P = d.pts, last = P.length - 1;
    const rail = d.b === 'arch' || d.b === 'cable' ? out.white : out.rail;
    const beam = (i) => {                                // across the end of a deck
      edges(d, i, e0);
      const q = P[i], r = q.length - 1, h = depth(d, i);
      quad(body, [e0[0], q[2], e0[1]], [e0[2], q[r], e0[3]], [e0[0], q[2] - h, e0[1]], [e0[2], q[r] - h, e0[3]]);
    };
    const mid = Math.floor(last / 2);
    if (d.w && inRect(d, Math.min(mid, last - 1), s.x0, s.z0, S)) structure(world, d, out);
    for (let i = 0; i < last; i++) {
      if (!inRect(d, i, s.x0, s.z0, S)) continue;
      edges(d, i, e0); edges(d, i + 1, e1);
      const a = P[i], b = P[i + 1], r = a.length - 1, ha = depth(d, i), hb = depth(d, i + 1);
      const la = [e0[0], a[2], e0[1]], ra = [e0[2], a[r], e0[3]], lb = [e1[0], b[2], e1[1]], rb = [e1[2], b[r], e1[3]];
      const dn = (p, h) => [p[0], p[1] - h, p[2]];
      quad(body, dn(la, ha), dn(ra, ha), dn(lb, hb), dn(rb, hb));          // underside
      quad(body, la, lb, dn(la, ha), dn(lb, hb));                          // sides
      quad(body, ra, rb, dn(ra, ha), dn(rb, hb));
      if (i === 0) beam(0);
      if (i === last - 1) beam(last);
      if (d.rail && i >= d.rail[0] && i < d.rail[1]) {
        edges(d, i, e0, 0.15); edges(d, i + 1, e1, 0.15);
        for (const [xa, za, ya, xb, zb, yb] of [[e0[0], e0[1], a[2], e1[0], e1[1], b[2]], [e0[2], e0[3], a[r], e1[2], e1[3], b[r]]]) {
          // a low kerb, two bars and a post, instead of a solid wall
          for (const [lo, hi] of [[0, 0.22], [0.5, 0.58], [RAIL - 0.1, RAIL]]) quad(rail, [xa, ya + lo, za], [xb, yb + lo, zb], [xa, ya + hi, za], [xb, yb + hi, zb]);
          const k = 0.1 / (Math.hypot(xb - xa, zb - za) || 1);
          quad(rail, [xa, ya, za], [xa + (xb - xa) * k, ya, za + (zb - za) * k], [xa, ya + RAIL, za], [xa + (xb - xa) * k, ya + RAIL, za + (zb - za) * k]);
        }
      }
    }
  }
  const group = new THREE.Group();
  for (const [name, arr] of Object.entries(out)) {
    if (arr.length === 0) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, MATS[name]);
    mesh.castShadow = name !== 'lamp';
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  if (group.children.length === 0) return null;
  group.userData.dispose = () => { for (const m of group.children) m.geometry.dispose(); };
  return group;
}
