// Shared procedural car-building toolkit for KvissuRoam.
// Everything is generated in code: lofted body shells, surface-conforming decals
// (glass, lamps, trim, shut lines), wheels, canvas textures.
//
// Conventions: metres, +Y up, car FRONT toward -Z, right side of the car is +X.
import * as THREE from 'three';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- keyed curves
// Monotone cubic interpolation through [[x, v], ...]; numbers become constants.
export function keyed(keys) {
  if (typeof keys === 'number') return () => keys;
  if (typeof keys === 'function') return keys;
  const n = keys.length;
  if (n === 1) return () => keys[0][1];
  const xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ---------------------------------------------------------------- 2D paths
// Fillet the corners of a polyline/polygon. pts: [a, b, r?]; r falls back to opts.r.
export function fillet(pts, { closed = false, r = 0, seg = 5 } = {}) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[i];
    const ri = P[2] !== undefined ? P[2] : r;
    if ((!closed && (i === 0 || i === n - 1)) || !(ri > 0)) { out.push([P[0], P[1]]); continue; }
    const A = pts[(i + n - 1) % n], B = pts[(i + 1) % n];
    const ax = A[0] - P[0], ay = A[1] - P[1], bx = B[0] - P[0], by = B[1] - P[1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const dd = Math.min(ri, 0.45 * la, 0.45 * lb);
    if (dd < 1e-6) { out.push([P[0], P[1]]); continue; }
    const p0 = [P[0] + ax / la * dd, P[1] + ay / la * dd], p1 = [P[0] + bx / lb * dd, P[1] + by / lb * dd];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * P[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * P[1] + t * t * p1[1]]);
    }
  }
  return out;
}
export const rpoly = (pts, r = 0.02, seg = 4) => fillet(pts, { closed: true, r, seg });
export const rect = (a0, b0, a1, b1, r = 0, seg = 4) => {
  const p = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
  return r > 0 ? rpoly(p, r, seg) : p;
};
// Thick polyline -> list of convex quads.
export function stroke(pts, width) {
  const out = [], h = width / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, b0] = pts[i], [a1, b1] = pts[i + 1];
    const dx = a1 - a0, dy = b1 - b0, l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    const ex = dx / l * h, ey = dy / l * h, nx = -dy / l * h, ny = dx / l * h;
    out.push([[a0 - ex + nx, b0 - ey + ny], [a0 - ex - nx, b0 - ey - ny], [a1 + ex - nx, b1 + ey - ny], [a1 + ex + nx, b1 + ey + ny]]);
  }
  return out;
}
function area2(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; }
// Grow (d > 0) or shrink a polygon by moving vertices along averaged edge normals.
export function grow(poly, d) {
  const n = poly.length, sgn = area2(poly) > 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const A = poly[(i + n - 1) % n], P = poly[i], B = poly[(i + 1) % n];
    let e1x = P[0] - A[0], e1y = P[1] - A[1], e2x = B[0] - P[0], e2y = B[1] - P[1];
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    let nx = e1y / l1 + e2y / l2, ny = -e1x / l1 - e2x / l2;
    const l = Math.hypot(nx, ny) || 1;
    out.push([P[0] + sgn * nx / l * d, P[1] + sgn * ny / l * d]);
  }
  return out;
}
function isConvex(p) {
  const n = p.length; let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n], c = p[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-12) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
function convexPieces(poly) {
  let p = poly.map((q) => [q[0], q[1]]);
  if (area2(p) < 0) p.reverse();
  if (isConvex(p)) return [p];
  const v = p.map((q) => new THREE.Vector2(q[0], q[1]));
  return THREE.ShapeUtils.triangulateShape(v, []).map((t) => {
    const tri = [p[t[0]], p[t[1]], p[t[2]]];
    if (area2(tri) < 0) tri.reverse();
    return tri;
  });
}

// ---------------------------------------------------------------- palette
// One texture-palette material covers every plain (non-paint) surface type.
const PALETTE = {
  plastic: ['#0b0b0c', 0.62, 0.0],
  gloss: ['#040405', 0.18, 0.0],
  clad: ['#24262a', 0.78, 0.0],
  bumper: ['#141517', 0.6, 0.0],
  rubber: ['#0a0a0a', 0.92, 0.0],
  chrome: ['#eeeeee', 0.07, 1.0],
  alloy: ['#c2c5c9', 0.28, 1.0],
  darkalloy: ['#34363a', 0.4, 1.0],
  steel: ['#8d8f92', 0.22, 1.0],
  line: ['#000000', 1.0, 0.0],
  well: ['#030303', 1.0, 0.0],
  disc: ['#5c5f63', 0.45, 1.0],
  silver: ['#cfd1d4', 0.3, 0.9],
  reflector: ['#8a0606', 0.2, 0.2],
  amber: ['#d07000', 0.25, 0.2],
  lens: ['#dfe3e6', 0.12, 0.6],
  darkglass: ['#07090b', 0.05, 0.9],
};
const PAL_NAMES = Object.keys(PALETTE);
export function palUV(name) {
  const i = PAL_NAMES.indexOf(name);
  if (i < 0) throw new Error('unknown palette entry ' + name);
  return [(i + 0.5) / PAL_NAMES.length, 0.5];
}
let _shared = null;
function sharedMaterials() {
  if (_shared) return _shared;
  const n = PAL_NAMES.length;
  const mk = (fn) => {
    const c = document.createElement('canvas'); c.width = n * 4; c.height = 4;
    const g = c.getContext('2d');
    PAL_NAMES.forEach((k, i) => { g.fillStyle = fn(PALETTE[k]); g.fillRect(i * 4, 0, 4, 4); });
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  };
  const col = mk((e) => e[0]); col.colorSpace = THREE.SRGBColorSpace;
  const orm = mk((e) => `rgb(255,${Math.round(e[1] * 255)},${Math.round(e[2] * 255)})`);
  orm.colorSpace = THREE.NoColorSpace;
  _shared = {
    paint: new THREE.MeshPhysicalMaterial({
      color: 0x060607, metalness: 0.55, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.035,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0a0e12, metalness: 0.92, roughness: 0.035, envMapIntensity: 1.15,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    pal: new THREE.MeshStandardMaterial({
      map: col, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1,
    }),
  };
  return _shared;
}

// ---------------------------------------------------------------- triangle soup
export class Soup {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  get tris() { return this.p.length / 9; }
  _fillUV() { const need = this.p.length / 3 * 2; while (this.uv.length < need) this.uv.push(0); }
  add(...list) {
    for (const s of list) {
      if (!s) continue;
      this._fillUV(); s._fillUV();
      for (let i = 0; i < s.p.length; i++) { this.p.push(s.p[i]); this.n.push(s.n[i]); }
      for (let i = 0; i < s.uv.length; i++) this.uv.push(s.uv[i]);
    }
    return this;
  }
  clone() { return new Soup().add(this); }
  mirrored() {
    const o = new Soup(); this._fillUV();
    const P = this.p, N = this.n, U = this.uv;
    for (let t = 0; t < P.length; t += 9) {
      for (const k of [0, 2, 1]) {
        const i = t + k * 3, j = (t / 3 + k) * 2;
        o.p.push(-P[i], P[i + 1], P[i + 2]); o.n.push(-N[i], N[i + 1], N[i + 2]); o.uv.push(U[j], U[j + 1]);
      }
    }
    return o;
  }
  sym() { return this.clone().add(this.mirrored()); }
  xform(m) {
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    for (let i = 0; i < this.p.length; i += 3) {
      v.set(this.p[i], this.p[i + 1], this.p[i + 2]).applyMatrix4(m); this.p[i] = v.x; this.p[i + 1] = v.y; this.p[i + 2] = v.z;
      v.set(this.n[i], this.n[i + 1], this.n[i + 2]).applyMatrix3(nm).normalize(); this.n[i] = v.x; this.n[i + 1] = v.y; this.n[i + 2] = v.z;
    }
    return this;
  }
  pal(name) {
    const [u, v] = palUV(name); this.uv.length = 0;
    for (let i = 0; i < this.p.length / 3; i++) this.uv.push(u, v);
    return this;
  }
  // map existing 0..1 uvs into an atlas rectangle [u0, v0, u1, v1]
  uvRect(r) {
    this._fillUV();
    for (let i = 0; i < this.uv.length; i += 2) { this.uv[i] = lerp(r[0], r[2], this.uv[i]); this.uv[i + 1] = lerp(r[1], r[3], this.uv[i + 1]); }
    return this;
  }
  toGeometry() {
    this._fillUV();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

export function M({ p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  return new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), sc);
}
// Any THREE geometry -> Soup (optionally transformed, optionally palette coloured).
export function fromGeo(geo, opts, pal) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const s = new Soup(), P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null;
  for (let i = 0; i < P.length; i++) { s.p.push(P[i]); s.n.push(N[i]); }
  if (U) for (let i = 0; i < U.length; i++) s.uv.push(U[i]);
  if (opts) s.xform(opts.isMatrix4 ? opts : M(opts));
  if (pal) s.pal(pal);
  geo.dispose();
  return s;
}
export const box = (w, h, d, opts, pal) => fromGeo(new THREE.BoxGeometry(w, h, d), opts, pal);
// rounded "pill" box: a sphere-ish superellipsoid, good for mirrors/handles
export function blob(w, h, d, opts, pal, e = 4, seg = 12) {
  const g = new THREE.SphereGeometry(1, seg * 2, seg);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = Math.pow(Math.abs(x) ** e + Math.abs(y) ** e + Math.abs(z) ** e, -1 / e);
    P.setXYZ(i, x * k * w / 2, y * k * h / 2, z * k * d / 2);
  }
  g.computeVertexNormals();
  return fromGeo(g, opts, pal);
}
export const cyl = (r0, r1, h, seg, opts, pal, open = false) => fromGeo(new THREE.CylinderGeometry(r0, r1, h, seg, 1, open), opts, pal);
// tube along a 3D polyline
export function tube(points, radius, opts, pal, seg = 6, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  return fromGeo(new THREE.TubeGeometry(c, Math.max(4, points.length * 3), radius, seg, closed), opts, pal);
}
// flat textured quad: corners a,b,c,d counter-clockwise seen from the front; uv rect optional
export function quad(a, b, c, d, uvr = [0, 0, 1, 1]) {
  const s = new Soup();
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), vd = new THREE.Vector3(...d);
  const n = vb.clone().sub(va).cross(vd.clone().sub(va)).normalize();
  const put = (q, u, v) => { s.p.push(...q); s.n.push(n.x, n.y, n.z); s.uv.push(u, v); };
  put(a, uvr[0], uvr[1]); put(b, uvr[2], uvr[1]); put(c, uvr[2], uvr[3]);
  put(a, uvr[0], uvr[1]); put(c, uvr[2], uvr[3]); put(d, uvr[0], uvr[3]);
  return s;
}

// ---------------------------------------------------------------- body loft
function outline(pts) {
  const dense = fillet(pts, { seg: 6 });
  for (let i = 1; i < dense.length; i++) if (dense[i][0] <= dense[i - 1][0]) dense[i][0] = dense[i - 1][0] + 1e-5;
  return {
    pts: dense,
    eval(z) {
      const p = dense;
      if (z <= p[0][0]) return p[0][1];
      if (z >= p[p.length - 1][0]) return p[p.length - 1][1];
      let lo = 0, hi = p.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] <= z) lo = m; else hi = m; }
      const t = (z - p[lo][0]) / (p[hi][0] - p[lo][0]);
      return lerp(p[lo][1], p[hi][1], t);
    },
  };
}
function walkStations(p, ds, dzMax) {
  const out = [{ z: p[0][0], sp: ds }];
  let accL = 0, accA = 0, lastZ = p[0][0], prevDir = null;
  for (let i = 0; i < p.length - 1; i++) {
    const dz = p[i + 1][0] - p[i][0], dy = p[i + 1][1] - p[i][1], L = Math.hypot(dz, dy);
    if (L < 1e-9) continue;
    const dir = Math.atan2(dy, dz);
    if (prevDir !== null) accA += Math.abs(dir - prevDir);
    prevDir = dir;
    if (accA > 0.2 && p[i][0] > lastZ) { out.push({ z: p[i][0], sp: Math.max(p[i][0] - lastZ, 1e-4) }); lastZ = p[i][0]; accL = 0; accA = 0; }
    const steep = Math.abs(dy) / L;
    const sp = lerp(dzMax, ds, smooth(steep * 1.6));
    const n = Math.max(1, Math.ceil((L + accL) / sp - 0.3));
    for (let k = 1; k <= n; k++) {
      const z = p[i][0] + dz * k / n;
      if (k < n || accL + L >= sp * 0.6 || i === p.length - 2) {
        if (z > lastZ) { out.push({ z, sp: Math.max(z - lastZ, 1e-4) }); lastZ = z; accL = 0; accA = 0; }
      } else accL += L;
    }
  }
  return out;
}

const NF = 6, NS = 4, SIDE = [5, 5, 2, 6], NR = 6, NT = 12;
const BODY_DEFAULTS = { w: 0.85, yWaist: 0.6, tuck: 0.05, yBelt: 0.95, sh: 0.02, ledge: 0.012, th: 0.38, thc: 0, rr: 0.07, rs: 0.06, crown: 0.03, bow: 0, bowN: 3 };

// Lofts a symmetric car shell from a side profile (top + bottom outlines, both running
// front tip -> rear tip with strictly increasing z) and keyed section parameters.
export function buildBody(spec) {
  const f = {};
  for (const k in BODY_DEFAULTS) f[k] = keyed(spec[k] !== undefined ? spec[k] : BODY_DEFAULTS[k]);
  const top = outline(spec.top), bot = outline(spec.bottom);
  const ySill = spec.ySill !== undefined ? spec.ySill : 0.2, ledgeH = spec.ledgeH || 0.03;
  const ds = spec.ds || 0.05, dzMax = spec.dzMax || 0.11;
  const cand = walkStations(top.pts, ds, dzMax).concat(walkStations(bot.pts, ds, dzMax)).sort((a, b) => a.z - b.z);
  const zEnd = top.pts[top.pts.length - 1][0];
  const zs = [cand[0].z];
  for (const c of cand) if (c.z - zs[zs.length - 1] >= Math.max(0.0012, 0.4 * Math.min(c.sp, dzMax))) zs.push(c.z);
  if (zEnd - zs[zs.length - 1] < 5e-4) zs[zs.length - 1] = zEnd; else zs.push(zEnd);

  const Mn = 1 + NF + NS + SIDE.reduce((a, b) => a + b, 0) + NR + NT;
  const rows = [];
  for (const z of zs) {
    const yb = bot.eval(z), yt = Math.max(top.eval(z), yb + 1e-5);
    const w = f.w(z), yWaist = f.yWaist(z), tuck = f.tuck(z), yBelt = f.yBelt(z), sh = f.sh(z), ledge = f.ledge(z), th = f.th(z), thc = f.thc(z);
    const crown = Math.min(f.crown(z), 0.35 * (yt - yb));
    const yE = yt - crown, H = yE - yb;
    const sideX = (y) => {
      let x = w;
      if (y < yWaist) { const u = Math.min(1.4, (yWaist - y) / Math.max(0.05, yWaist - ySill)); x -= tuck * u * u; }
      else if (y < yBelt) { const u = (y - yWaist) / Math.max(0.05, yBelt - yWaist); x -= sh * u * u; }
      else { const h = y - yBelt; x -= sh + ledge * smooth(h / ledgeH) + th * h + thc * h * h; }
      return Math.max(x, 0.02);
    };
    const rs = Math.min(f.rs(z), 0.45 * H), rr = Math.min(f.rr(z), 0.45 * H);
    const xs = sideX(yb), xr = sideX(yE);
    const B = f.bow(z), bn = f.bowN(z), dir = z < 0 ? 1 : -1;
    const row = new Float64Array(Mn * 3); let c = 0;
    const put = (x, y, t) => {
      t = clamp(t, 0, 1);
      const g = B > 0 ? 1 - Math.pow(Math.max(0, 1 - Math.pow(t, bn)), 1 / bn) : 0;
      row[c++] = x; row[c++] = y; row[c++] = z + dir * B * g;
    };
    // floor
    const fx = Math.max(xs - rs, 0);
    for (let k = 0; k <= NF; k++) { const s = 1 - Math.pow(1 - k / NF, 1.5); put(fx * s, yb, fx * s / xs); }
    // sill corner
    const s1x = sideX(yb + rs), s1y = yb + rs;
    for (let k = 1; k <= NS; k++) {
      const t = k / NS, u = 1 - t;
      const x = u * u * fx + 2 * u * t * xs + t * t * s1x, y = u * u * yb + 2 * u * t * yb + t * t * s1y;
      put(x, y, x / xs);
    }
    // side
    const y0 = yb + rs, y1 = yE - rr;
    const bp = [y0, clamp(yWaist, y0, y1), clamp(yBelt, y0, y1), clamp(yBelt + ledgeH, y0, y1), y1];
    for (let s = 0; s < SIDE.length; s++) for (let k = 1; k <= SIDE[s]; k++) { const y = lerp(bp[s], bp[s + 1], k / SIDE[s]); put(sideX(y), y, 1); }
    // rail corner + top (with crown)
    const q0x = sideX(y1), q1x = xr - Math.min(Math.max(rr, 0.02), 0.5 * xr);
    const cr = (x) => (x < xr ? crown * (1 - (x / xr) * (x / xr)) : 0);
    for (let k = 1; k <= NR; k++) {
      const t = k / NR, u = 1 - t;
      const x = u * u * q0x + 2 * u * t * xr + t * t * q1x, y = u * u * y1 + 2 * u * t * yE + t * t * yE;
      put(x, y + cr(x), x / xr);
    }
    for (let k = 1; k <= NT; k++) { const x = q1x * (1 - Math.pow(k / NT, 1.35)); put(x, yE + cr(x), x / xr); }
    rows.push(row);
  }

  // normals: area-weighted face normals accumulated on the grid, welded where points coincide
  const R = rows.length, nrm = rows.map(() => new Float64Array(Mn * 3));
  const acc = (i, j, x, y, z) => { nrm[i][j * 3] += x; nrm[i][j * 3 + 1] += y; nrm[i][j * 3 + 2] += z; };
  const tri = (i0, j0, i1, j1, i2, j2) => {
    const a = rows[i0], b = rows[i1], c = rows[i2];
    const ux = b[j1 * 3] - a[j0 * 3], uy = b[j1 * 3 + 1] - a[j0 * 3 + 1], uz = b[j1 * 3 + 2] - a[j0 * 3 + 2];
    const vx = c[j2 * 3] - a[j0 * 3], vy = c[j2 * 3 + 1] - a[j0 * 3 + 1], vz = c[j2 * 3 + 2] - a[j0 * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    acc(i0, j0, nx, ny, nz); acc(i1, j1, nx, ny, nz); acc(i2, j2, nx, ny, nz);
    return nx * nx + ny * ny + nz * nz;
  };
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < Mn - 1; j++) { tri(i, j, i, j + 1, i + 1, j); tri(i, j + 1, i + 1, j + 1, i + 1, j); }
  for (let i = 0; i < R; i++) {
    const r = rows[i], n = nrm[i];
    let j = 0;
    while (j < Mn) {
      let k = j, sx = n[j * 3], sy = n[j * 3 + 1], sz = n[j * 3 + 2];
      while (k + 1 < Mn && Math.hypot(r[(k + 1) * 3] - r[k * 3], r[(k + 1) * 3 + 1] - r[k * 3 + 1], r[(k + 1) * 3 + 2] - r[k * 3 + 2]) < 1e-6) { k++; sx += n[k * 3]; sy += n[k * 3 + 1]; sz += n[k * 3 + 2]; }
      for (let q = j; q <= k; q++) { n[q * 3] = sx; n[q * 3 + 1] = sy; n[q * 3 + 2] = sz; }
      j = k + 1;
    }
    n[0] = 0; n[(Mn - 1) * 3] = 0;
    for (let q = 0; q < Mn; q++) {
      const l = Math.hypot(n[q * 3], n[q * 3 + 1], n[q * 3 + 2]) || 1;
      n[q * 3] /= l; n[q * 3 + 1] /= l; n[q * 3 + 2] /= l;
    }
  }
  const half = new Soup();
  const emit = (i0, j0, i1, j1, i2, j2) => {
    const a = rows[i0], b = rows[i1], c = rows[i2];
    const ux = b[j1 * 3] - a[j0 * 3], uy = b[j1 * 3 + 1] - a[j0 * 3 + 1], uz = b[j1 * 3 + 2] - a[j0 * 3 + 2];
    const vx = c[j2 * 3] - a[j0 * 3], vy = c[j2 * 3 + 1] - a[j0 * 3 + 1], vz = c[j2 * 3 + 2] - a[j0 * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-16) return;
    for (const [i, j] of [[i0, j0], [i1, j1], [i2, j2]]) {
      half.p.push(rows[i][j * 3], rows[i][j * 3 + 1], rows[i][j * 3 + 2]);
      half.n.push(nrm[i][j * 3], nrm[i][j * 3 + 1], nrm[i][j * 3 + 2]);
    }
  };
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < Mn - 1; j++) { emit(i, j, i, j + 1, i + 1, j); emit(i, j + 1, i + 1, j + 1, i + 1, j); }
  return { soup: half.sym(), stations: R, top, bot };
}

// ---------------------------------------------------------------- clipping
function clipPolygon(poly, fn, refine) {
  // poly: array of Float64Array vertices (x,y,z,nx,ny,nz); keeps fn(v) >= 0
  const out = [], n = poly.length, fv = poly.map(fn);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], fa = fv[i], fb = fv[(i + 1) % n];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      let t = fa / (fa - fb);
      const mix = (tt) => { const v = new Float64Array(6); for (let k = 0; k < 6; k++) v[k] = a[k] + (b[k] - a[k]) * tt; return v; };
      if (refine) {
        let lo = 0, hi = 1;
        for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if ((fn(mix(m)) >= 0) === (fa >= 0)) lo = m; else hi = m; }
        t = (lo + hi) / 2;
      }
      out.push(mix(t));
    }
  }
  return out;
}
function triVerts(s, t) {
  const v = [];
  for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; v.push(Float64Array.of(s.p[i], s.p[i + 1], s.p[i + 2], s.n[i], s.n[i + 1], s.n[i + 2])); }
  return v;
}
// Keep the part of the soup where fn(vertex) >= 0 (fn gets [x,y,z,...]).
export function clipSoup(soup, fn) {
  const out = new Soup();
  for (let t = 0; t < soup.tris; t++) {
    const v = triVerts(soup, t);
    const f0 = fn(v[0]) >= 0, f1 = fn(v[1]) >= 0, f2 = fn(v[2]) >= 0;
    let poly = v;
    if (!f0 && !f1 && !f2) continue;
    if (!(f0 && f1 && f2)) poly = clipPolygon(v, fn, true);
    for (let k = 1; k < poly.length - 1; k++) for (const q of [poly[0], poly[k], poly[k + 1]]) {
      out.p.push(q[0], q[1], q[2]);
      const l = Math.hypot(q[3], q[4], q[5]) || 1; out.n.push(q[3] / l, q[4] / l, q[5] / l);
    }
  }
  return out;
}

// Nearest ray hit against a soup (brute force). Returns { t, p:[x,y,z], n:[x,y,z] } or null.
export function raycast(soup, o, d) {
  const P = soup.p; let best = null, bt = Infinity, bu = 0, bv = 0, bi = -1;
  for (let i = 0; i < P.length; i += 9) {
    const e1x = P[i + 3] - P[i], e1y = P[i + 4] - P[i + 1], e1z = P[i + 5] - P[i + 2];
    const e2x = P[i + 6] - P[i], e2y = P[i + 7] - P[i + 1], e2z = P[i + 8] - P[i + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det, tx = o[0] - P[i], ty = o[1] - P[i + 1], tz = o[2] - P[i + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -1e-9 || u > 1 + 1e-9) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (v < -1e-9 || u + v > 1 + 1e-9) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 1e-6 && t < bt) { bt = t; bu = u; bv = v; bi = i; }
  }
  if (bi < 0) return null;
  const N = soup.n, w = 1 - bu - bv, n = [0, 0, 0];
  for (let k = 0; k < 3; k++) n[k] = N[bi + k] * w + N[bi + 3 + k] * bu + N[bi + 6 + k] * bv;
  const l = Math.hypot(...n) || 1;
  best = { t: bt, p: [o[0] + d[0] * bt, o[1] + d[1] * bt, o[2] + d[2] * bt], n: n.map((x) => x / l) };
  return best;
}
// convenience probes on a body soup
export const probe = (soup) => ({
  sideX: (z, y) => { const h = raycast(soup, [3, y, z], [-1, 0, 0]); return h ? h.p[0] : 0; },
  rearZ: (x, y) => { const h = raycast(soup, [x, y, 6], [0, 0, -1]); return h ? h.p[2] : 0; },
  frontZ: (x, y) => { const h = raycast(soup, [x, y, -6], [0, 0, 1]); return h ? h.p[2] : 0; },
  topY: (x, z) => { const h = raycast(soup, [x, 4, z], [0, -1, 0]); return h ? h.p[1] : 0; },
  side: (z, y) => raycast(soup, [3, y, z], [-1, 0, 0]),
  rear: (x, y) => raycast(soup, [x, y, 6], [0, 0, -1]),
  front: (x, y) => raycast(soup, [x, y, -6], [0, 0, 1]),
  top: (x, z) => raycast(soup, [x, 4, z], [0, -1, 0]),
});

// Cut circular wheel arches (through the outer `depth` of the body) and build the dark liners.
// arches: [{ z, y, r }] on the +x side (mirrored automatically). Returns { soup, liner }.
export function cutArches(body, arches, { halfWidth, depth = 0.34 }) {
  const xWall = halfWidth - depth;
  let soup = body;
  const liner = new Soup();
  for (const a of arches) {
    soup = clipSoup(soup, (v) => Math.max((v[2] - a.z) ** 2 + (v[1] - a.y) ** 2 - a.r * a.r, xWall - Math.abs(v[0])));
    const pts = [];
    for (let deg = -60; deg <= 240; deg += 6) {
      const th = deg * Math.PI / 180, z = a.z + a.r * Math.cos(th), y = a.y + a.r * Math.sin(th);
      const h = raycast(body, [3, y, z], [-1, 0, 0]);
      if (h && h.p[0] > xWall + 0.04) pts.push([h.p[0], y, z, Math.cos(th), Math.sin(th)]);
    }
    const half = new Soup();
    const pv = (x, y, z, nx, ny, nz) => { half.p.push(x, y, z); half.n.push(nx, ny, nz); };
    const rI = 1.004;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1];
      const ay = a.y + (A[1] - a.y) * rI, az = a.z + (A[2] - a.z) * rI, by = a.y + (B[1] - a.y) * rI, bz = a.z + (B[2] - a.z) * rI;
      // tunnel strip (faces the wheel)
      pv(A[0], ay, az, 0, -A[4], -A[3]); pv(xWall, ay, az, 0, -A[4], -A[3]); pv(B[0], by, bz, 0, -B[4], -B[3]);
      pv(B[0], by, bz, 0, -B[4], -B[3]); pv(xWall, ay, az, 0, -A[4], -A[3]); pv(xWall, by, bz, 0, -B[4], -B[3]);
      // inner wall
      pv(xWall, a.y, a.z, 1, 0, 0); pv(xWall, by, bz, 1, 0, 0); pv(xWall, ay, az, 1, 0, 0);
    }
    if (pts.length > 2) {
      const A = pts[pts.length - 1], B = pts[0];
      pv(xWall, a.y, a.z, 1, 0, 0); pv(xWall, B[1], B[2], 1, 0, 0); pv(xWall, A[1], A[2], 1, 0, 0);
    }
    liner.add(half.sym());
  }
  return { soup, liner: liner.pal('well') };
}

// ---------------------------------------------------------------- decals
// Projects 2D polygon(s) onto the body along -out and returns the covered surface, lifted
// by `offset` along the surface normals. u/v are the 2D axes in world space.
// uv: polygon bbox (or o.box = [a0,b0,a1,b1]) mapped to 0..1.
export function decal(soup, o) {
  const { u, v, out, origin = [0, 0, 0], offset = 0.004, minFacing = 0.12, filter } = o;
  const polys = o.polys || [o.poly];
  const res = new Soup();
  let A0 = Infinity, B0 = Infinity, A1 = -Infinity, B1 = -Infinity;
  for (const p of polys) for (const q of p) { A0 = Math.min(A0, q[0]); A1 = Math.max(A1, q[0]); B0 = Math.min(B0, q[1]); B1 = Math.max(B1, q[1]); }
  const bx = o.box || [A0, B0, A1, B1];
  const pieces = [];
  for (const p of polys) for (const c of convexPieces(p)) {
    let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
    for (const q of c) { a0 = Math.min(a0, q[0]); a1 = Math.max(a1, q[0]); b0 = Math.min(b0, q[1]); b1 = Math.max(b1, q[1]); }
    pieces.push({ c, a0, b0, a1, b1 });
  }
  const P = soup.p, N = soup.n;
  const pa = (q) => (q[0] - origin[0]) * u[0] + (q[1] - origin[1]) * u[1] + (q[2] - origin[2]) * u[2];
  const pb = (q) => (q[0] - origin[0]) * v[0] + (q[1] - origin[1]) * v[1] + (q[2] - origin[2]) * v[2];
  for (let t = 0; t < P.length; t += 9) {
    const e1x = P[t + 3] - P[t], e1y = P[t + 4] - P[t + 1], e1z = P[t + 5] - P[t + 2];
    const e2x = P[t + 6] - P[t], e2y = P[t + 7] - P[t + 1], e2z = P[t + 8] - P[t + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-12 || (nx * out[0] + ny * out[1] + nz * out[2]) / nl < minFacing) continue;
    const verts = [];
    let ta0 = Infinity, tb0 = Infinity, ta1 = -Infinity, tb1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const i = t + k * 3, q = Float64Array.of(P[i], P[i + 1], P[i + 2], N[i], N[i + 1], N[i + 2]);
      const a = pa(q), b = pb(q);
      ta0 = Math.min(ta0, a); ta1 = Math.max(ta1, a); tb0 = Math.min(tb0, b); tb1 = Math.max(tb1, b);
      verts.push(q);
    }
    if (ta1 < A0 || ta0 > A1 || tb1 < B0 || tb0 > B1) continue;
    if (filter && !filter(verts[0])) continue;
    for (const pc of pieces) {
      if (ta1 < pc.a0 || ta0 > pc.a1 || tb1 < pc.b0 || tb0 > pc.b1) continue;
      let poly = verts;
      const c = pc.c;
      for (let e = 0; e < c.length && poly.length >= 3; e++) {
        const p0 = c[e], p1 = c[(e + 1) % c.length], ex = p1[0] - p0[0], ey = p1[1] - p0[1];
        poly = clipPolygon(poly, (q) => ex * (pb(q) - p0[1]) - ey * (pa(q) - p0[0]), false);
      }
      if (poly.length < 3) continue;
      for (let k = 1; k < poly.length - 1; k++) for (const q of [poly[0], poly[k], poly[k + 1]]) {
        const l = Math.hypot(q[3], q[4], q[5]) || 1, qx = q[3] / l, qy = q[4] / l, qz = q[5] / l;
        res.p.push(q[0] + qx * offset, q[1] + qy * offset, q[2] + qz * offset);
        res.n.push(qx, qy, qz);
        res.uv.push((pa(q) - bx[0]) / (bx[2] - bx[0]), (pb(q) - bx[1]) / (bx[3] - bx[1]));
      }
    }
  }
  return res;
}
// Decal helpers bound to a body. Side decals are authored on the right side in (z, y).
export function decals(soup) {
  const one = (frame) => (poly, o = {}) => decal(soup, { ...frame, ...(Array.isArray(poly[0][0]) ? { polys: poly } : { poly }), ...o });
  return {
    side: one({ u: [0, 0, 1], v: [0, 1, 0], out: [1, 0, 0] }),          // (z, y), right side only
    rear: one({ u: [1, 0, 0], v: [0, 1, 0], out: [0, 0, 1] }),          // (x, y) seen from behind
    front: one({ u: [-1, 0, 0], v: [0, 1, 0], out: [0, 0, -1] }),       // (-x, y) seen from the front
    top: one({ u: [1, 0, 0], v: [0, 0, 1], out: [0, 1, 0] }),           // (x, z) seen from above
    // rotated about Y: yaw 0 = rear view, yaw > 0 turns the projector toward the right side
    yaw: (deg) => { const a = deg * Math.PI / 180; return one({ u: [Math.cos(a), 0, -Math.sin(a)], v: [0, 1, 0], out: [Math.sin(a), 0, Math.cos(a)] }); },
    any: (frame) => one(frame),
  };
}

// ---------------------------------------------------------------- wheels
function windowHoles(shape, n, r1, r2, spokeHalf, round, phase = 0, innerHalf) {
  for (let i = 0; i < n; i++) {
    const a0 = phase + (i + 0.5) * Math.PI * 2 / n, pts = [];
    const hw = (r, sw) => Math.max(0.02, Math.PI / n - Math.asin(Math.min(0.95, sw / r)));
    const h1 = hw(r1, innerHalf !== undefined ? innerHalf : spokeHalf), h2 = hw(r2, spokeHalf);
    for (let k = 0; k <= 2; k++) { const a = a0 - h1 + 2 * h1 * k / 2; pts.push([r1 * Math.cos(a), r1 * Math.sin(a)]); }
    for (let k = 0; k <= 6; k++) { const a = a0 + h2 - 2 * h2 * k / 6; pts.push([r2 * Math.cos(a), r2 * Math.sin(a)]); }
    const rp = rpoly(pts, round, 3);
    const path = new THREE.Path();
    rp.forEach((p, k) => (k ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    path.closePath();
    shape.holes.push(path);
  }
}
function faceSoup(shape, depth, x, pal, bevel = 0.003) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 7 });
  g.rotateY(Math.PI / 2); g.translate(x, 0, 0);
  return fromGeo(g, null, pal);
}
function lathe(prof, pal, seg = 40) {
  const g = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  g.rotateZ(-Math.PI / 2);
  return fromGeo(g, null, pal);
}
// Wheel with its axis on X, outer face toward +X, centred on the origin.
export function buildWheel({ R, width, rimR, style }) {
  const s = new Soup(), hw = width / 2, sh = R - rimR;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.014, -hw * 0.9], [R - 0.003, -hw * 0.76], [R, -hw * 0.5], [R, hw * 0.5],
    [R - 0.003, hw * 0.76], [R - 0.014, hw * 0.9], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 44));
  // tread grooves (dark rings slightly sunk are invisible on black rubber; skip)
  const dark = style === 'aero';
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.004, hw * 0.86], [rimR - 0.004, hw * 0.9], [rimR - 0.016, hw * 0.84], [rimR - 0.02, hw * 0.55]], dark ? 'gloss' : 'alloy', 44));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.008, 32), { p: [-hw * 0.5, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(cyl(rimR * 0.74, rimR * 0.74, 0.024, 32, { p: [hw * 0.05, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  s.add(cyl(rimR * 0.3, rimR * 0.34, hw * 0.9, 20, { p: [hw * 0.25, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  const disc = (r) => { const sp = new THREE.Shape(); sp.absarc(0, 0, r, 0, Math.PI * 2, false); return sp; };
  const rf = rimR - 0.017;
  if (style === 'gulli') {
    // Mercedes 15-hole "Gullideckel"
    const sp = disc(rf);
    for (let i = 0; i < 15; i++) {
      const a = i * Math.PI * 2 / 15, h = new THREE.Path();
      h.absellipse(Math.cos(a) * rf * 0.8, Math.sin(a) * rf * 0.8, rf * 0.085, rf * 0.062, 0, Math.PI * 2, true, a);
      sp.holes.push(h);
    }
    s.add(faceSoup(sp, 0.014, hw * 0.62, 'alloy', 0.003));
    s.add(lathe([[rf * 0.96, hw * 0.62 + 0.017], [rf * 0.99, hw * 0.62 + 0.03], [rf * 1.03, hw * 0.62 + 0.034]].reverse().map(p => p), 'alloy', 44));
    s.add(cyl(rf * 0.4, rf * 0.43, 0.014, 28, { p: [hw * 0.62 + 0.024, 0, 0], r: [0, 0, -Math.PI / 2] }, 'alloy'));
    s.add(cyl(rf * 0.2, rf * 0.22, 0.01, 20, { p: [hw * 0.62 + 0.034, 0, 0], r: [0, 0, -Math.PI / 2] }, 'chrome'));
  } else if (style === 'spoke5') {
    const sp = disc(rf);
    windowHoles(sp, 5, rf * 0.34, rf * 0.9, rf * 0.15, rf * 0.09, Math.PI / 2, rf * 0.11);
    s.add(faceSoup(sp, 0.022, hw * 0.5, 'alloy', 0.005));
    s.add(cyl(rf * 0.2, rf * 0.23, 0.02, 20, { p: [hw * 0.5 + 0.034, 0, 0], r: [0, 0, -Math.PI / 2] }, 'silver'));
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + Math.PI / 2; s.add(cyl(0.011, 0.011, 0.012, 8, { p: [hw * 0.5 + 0.03, Math.sin(a) * rf * 0.27, Math.cos(a) * rf * 0.27], r: [0, 0, -Math.PI / 2] }, 'chrome')); }
  } else {
    // Enyaq-style two-tone aero wheel: bright 5 twin-spoke face over a gloss-black aero plate
    const back = disc(rf);
    windowHoles(back, 5, rf * 0.5, rf * 0.8, rf * 0.3, rf * 0.05, Math.PI / 2 + Math.PI / 5, rf * 0.3);
    s.add(faceSoup(back, 0.012, hw * 0.5, 'gloss', 0.002));
    const sp = disc(rf * 0.985);
    windowHoles(sp, 5, rf * 0.36, rf * 0.93, rf * 0.2, rf * 0.06, Math.PI / 2, rf * 0.12);
    // slit in every spoke
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + i * Math.PI * 2 / 5, c = Math.cos(a), sn = Math.sin(a), h = new THREE.Path();
      const pts = rpoly([[rf * 0.45, -rf * 0.035], [rf * 0.9, -rf * 0.075], [rf * 0.9, rf * 0.075], [rf * 0.45, rf * 0.035]], rf * 0.03, 3);
      pts.forEach((p, k) => { const x = p[0] * c - p[1] * sn, y = p[0] * sn + p[1] * c; k ? h.lineTo(x, y) : h.moveTo(x, y); });
      h.closePath(); sp.holes.push(h);
    }
    s.add(faceSoup(sp, 0.014, hw * 0.5 + 0.016, 'alloy', 0.003));
    s.add(cyl(rf * 0.19, rf * 0.21, 0.012, 20, { p: [hw * 0.5 + 0.04, 0, 0], r: [0, 0, -Math.PI / 2] }, 'gloss'));
  }
  return s;
}

// ---------------------------------------------------------------- textures
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// Estonian plate: white, black border, blue EU strip with "EST". Draws into rect (x,y,w,h).
export function drawPlate(g, x, y, w, h, text) {
  g.save(); g.translate(x, y);
  const r = h * 0.1;
  g.fillStyle = '#111'; g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill();
  const b = h * 0.035;
  g.fillStyle = '#f4f4f1'; g.beginPath(); g.roundRect(b, b, w - 2 * b, h - 2 * b, r * 0.7); g.fill();
  const sw = w * 0.085;
  g.save(); g.beginPath(); g.roundRect(b, b, w - 2 * b, h - 2 * b, r * 0.7); g.clip();
  g.fillStyle = '#12399c'; g.fillRect(0, 0, sw + b, h);
  g.restore();
  g.fillStyle = '#f5c400';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(b + sw / 2 + Math.cos(a) * sw * 0.27, h * 0.33 + Math.sin(a) * sw * 0.27, sw * 0.045, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = `bold ${h * 0.2}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('EST', b + sw / 2, h * 0.76);
  g.fillStyle = '#0c0c0c'; g.font = `bold ${h * 0.74}px "DIN Alternate", "Arial Narrow", Arial, Helvetica, sans-serif`;
  const tx = sw + b + (w - sw - 2 * b) / 2;
  g.save(); g.translate(tx, h * 0.54); g.scale(0.86, 1); g.fillText(text, 0, 0); g.restore();
  g.restore();
}
// Number plate as geometry: returns { face (atlas uv), back (palette) } at position p, facing +z
// when yaw = 0 (rear) or -z when front = true; tilt leans the top toward the car.
export function plate(p, uvr, { front = false, tilt = 0, w = 0.52, h = 0.113 } = {}) {
  const m = M({ p, r: [front ? tilt : -tilt, front ? Math.PI : 0, 0] });
  const face = quad([-w / 2, -h / 2, 0.006], [w / 2, -h / 2, 0.006], [w / 2, h / 2, 0.006], [-w / 2, h / 2, 0.006], uvr).xform(m);
  const back = box(w + 0.012, h + 0.012, 0.01, null, 'plastic').xform(m);
  return { face, back };
}

// ---------------------------------------------------------------- assembly
// parts: soups keyed by material: paint, glass, pal, tail, chmsl, reverse, head, atlas
// tex: { tailMap, tailGlow, headMap, headGlow, atlas }
export function assembleCar({ id, dims, parts, tex = {}, wheel }) {
  const sh = sharedMaterials();
  const group = new THREE.Group(); group.name = id;
  const mats = {
    paint: sh.paint, glass: sh.glass, pal: sh.pal,
    tail: new THREE.MeshStandardMaterial({ map: tex.tailMap || null, emissiveMap: tex.tailGlow || null, emissive: 0xff0000, emissiveIntensity: 0, roughness: 0.22, metalness: 0.1 }),
    chmsl: new THREE.MeshStandardMaterial({ color: 0x4a0505, emissive: 0xff0000, emissiveIntensity: 0, roughness: 0.25 }),
    reverse: new THREE.MeshStandardMaterial({ color: 0xc9cdd0, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.18, metalness: 0.3 }),
    head: new THREE.MeshStandardMaterial({ map: tex.headMap || null, emissiveMap: tex.headGlow || null, emissive: 0xfff4dd, emissiveIntensity: 0, roughness: 0.12, metalness: 0.5 }),
    atlas: new THREE.MeshStandardMaterial({ map: tex.atlas || null, alphaTest: 0.5, roughness: 0.45, metalness: 0.15 }),
  };
  for (const k of ['tail', 'chmsl', 'reverse', 'head', 'atlas']) { mats[k].polygonOffset = true; mats[k].polygonOffsetFactor = -2; mats[k].polygonOffsetUnits = -2; }
  let triangles = 0;
  for (const k of Object.keys(mats)) {
    const s = parts[k];
    if (!s || !s.tris) continue;
    const mesh = new THREE.Mesh(s.toGeometry(), mats[k]);
    mesh.name = `${id}_${k}`; mesh.castShadow = true; mesh.receiveShadow = k === 'paint';
    group.add(mesh); triangles += s.tris;
  }
  const wgeo = wheel.soup.toGeometry();
  const wheels = {};
  const hz = dims.wheelbase / 2, hx = dims.track / 2;
  for (const [name, x, z] of [['fl', -hx, -hz], ['fr', hx, -hz], ['rl', -hx, hz], ['rr', hx, hz]]) {
    const steer = new THREE.Object3D(); steer.name = `${id}_steer_${name}`; steer.position.set(x, dims.wheelRadius, z);
    const spin = new THREE.Object3D(); spin.name = `${id}_spin_${name}`;
    const mesh = new THREE.Mesh(wgeo, sh.pal); mesh.name = `${id}_wheel_${name}`; mesh.castShadow = true;
    if (x < 0) mesh.rotation.y = Math.PI;
    spin.add(mesh); steer.add(spin); group.add(steer);
    wheels[name] = { steer, spin };
    triangles += wheel.soup.tris;
  }
  const state = { brake: false, reverse: false, headlights: false };
  const setLights = (o = {}) => {
    Object.assign(state, o);
    mats.tail.emissiveIntensity = state.brake ? 1.2 : state.headlights ? 0.35 : 0;
    mats.chmsl.emissiveIntensity = state.brake ? 1.2 : 0;
    mats.reverse.emissiveIntensity = state.reverse ? 2.2 : 0;
    mats.head.emissiveIntensity = state.headlights ? 2.4 : 0;
  };
  setLights();
  return {
    group, wheels,
    wheelRadius: dims.wheelRadius, wheelbase: dims.wheelbase, track: dims.track,
    size: { length: dims.length, width: dims.width, height: dims.height },
    setLights, triangles,
  };
}

// ---------------------------------------------------------------- small shared helpers
export const arcPts = (cz, cy, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cz + r * Math.cos(a), cy + r * Math.sin(a)]; });
// decal frame looking at the front corner: yaw 0 = straight front view, yaw > 0 turns toward the right side.
// 2D coords: a = -(x cos) - (z - oz) sin (so inboard is toward 0, right side negative), b = y.
export const frontYaw = (deg, oz) => { const a = deg * Math.PI / 180; return { u: [-Math.cos(a), 0, -Math.sin(a)], v: [0, 1, 0], out: [Math.sin(a), 0, -Math.cos(a)], origin: [0, 0, oz] }; };
// rear wiper lying on the glass: from pivot (x0,y0) to tip (x1,y1), z probed on the body
export function rearWiper(pr, x0, y0, x1, y1) {
  const s = new Soup(), pts = [];
  for (let i = 0; i <= 4; i++) { const x = x0 + (x1 - x0) * i / 4, y = y0 + (y1 - y0) * i / 4; pts.push([x, y, pr.rearZ(x, y) + 0.022]); }
  s.add(tube(pts, 0.007, null, 'plastic', 5));
  s.add(tube(pts.slice(2), 0.011, null, 'rubber', 5));
  s.add(cyl(0.022, 0.026, 0.035, 12, { p: [x0, y0, pr.rearZ(x0, y0) + 0.012], r: [Math.PI / 2, 0, 0] }, 'plastic'));
  return s;
}
