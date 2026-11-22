// Round kerbs at the four corners of the big junction where the lap passes twice (Martin, 19 Nov: "model the
// kerbs also on the big junction where the two roads meet in the circuit"), Baeri / Jakobi / Tähtvere / road 40:
//   Orident (Baeri -> Jakobi, the lap's right turn): the kerb follows the rounded glow of the lap (ROUND 628)
//     instead of running square into the corner with a gap, so its light stones read as one round line
//   Helen Doron (Tähtvere -> Jakobi up the hill): a lower, gentler kerb round the gravel corner, as in his
//     Street View picture, joining the pavement kerb up Jakobi
//   the two corners across (road 40 / Jakobi, Baeri / Jakobi): rounded where the generated kerbs stopped square
// Each corner is a kerb line (two straight legs and the round between them) that src/race/trackkerbs.js feels,
// draws and shows the top of, like its own runs; the runs of src/race/kerbs.json give way to it at `skip`.
import { createTrack, ROUND } from './race.js';

// road edges from the map's centre lines and widths (Tähtvere 7.6 m, road 40 11.6 m), metres in game x, z
const TAHTVERE_W = [[939.43, 2589.6], [942.53, 2598.1]];       // the west kerb of Tähtvere, towards the junction
const ROAD40_E = [[962.58, 2589.59], [957.78, 2600.19]];        // the east kerb of road 40, towards the junction

// legs: lineA [far, near] towards the corner and lineB [near, far] away from it, as points or [side, lap index] of
// the lap's kerb (10 cm past its half width, where the generated kerbs have their face); lenA / lenB how far the
// legs run (metres, or up to a [side, index] of the lap's kerb); drawA / drawB the lap index of the kerb face
// where a generated run takes over drawing it; skip: [side, i0, i1] of kerbs.json runs this corner replaces
const CORNERS = [
  { name: 'orident', fillet: 628, lineA: [[1, 616], [1, 619]], lineB: [[1, 637], [1, 641]], drawB: 638,
    h: 0.09, edge: 0.1, w: 2.6, b: 0.6, skip: [[1, 618, 637]], taperA: true },
  { name: 'helen doron', r: 3, lineA: TAHTVERE_W, lineB: [[1, 1332], [1, 1336]], lenA: 4, lenB: [1, 1336], drawB: 1335,
    h: 0.07, hB: 0.09, edge: 0.14, w: 4.5, b: 0.8, skip: [[1, 1332, 1334]], taperA: true },
  { name: 'road 40', r: 4, lineA: ROAD40_E, lineB: [[-1, 633], [-1, 637]], lenA: 2.5, lenB: [-1, 635], drawB: 634,
    h: 0.09, edge: 0.1, w: 3, b: 0.8, skip: [[-1, 632, 633]], taperA: true },
  { name: 'baeri', r: 3.5, lineA: [[-1, 620], [-1, 623]], lineB: [[-1, 1332], [-1, 1336]], lenA: [-1, 622], drawA: 623, lenB: [-1, 1336], drawB: 1335,
    h: 0.09, edge: 0.1, w: 5.5, b: 0.8, skip: [[-1, 623, 625], [-1, 1332, 1334]] },
  // Vanemuise / Ülikooli by the theatre park (Martin, 20 Nov, Street View and air photos): the pavement corner runs
  // down the lane edge of the Vanemuise parking bays past the zebra, then round into Ülikooli's edge, where it ends in a
  // point at the start of the parking strip (the lap's own kerb line down Vanemuise, v 6.8 along Ülikooli in the teatripark.js frame); it
  // replaces the square raised pavement that ran over the lower bays
  { name: 'vanemuine park', r: 6, lineA: [[1, 2300], [1, 2304]], lineB: [[1583.25, 3155.46], [1586.54, 3159.23]],
    lenA: 4.7, lenB: 3.2, h: 0.09, edge: 0.1, w: 4, b: 0.8, skip: [[1, 2297, 2307]], taperA: true },
];
const OFF = 0.1;           // the generated kerbs' face past the lap's half width

const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
const unit = (p) => { const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l]; };
const perp = (p) => [-p[1], p[0]];

let cache = null;
export function junctionCorners() {
  if (cache) return cache;
  const track = createTrack();
  const { P, HW, tan, N } = track;
  const kerb = (s, i, off = OFF) => { const k = (i + N) % N, h = HW[k] + off; return [P[k][0] - tan[k][1] * s * h, P[k][1] + tan[k][0] * s * h]; };
  const isRef = (q) => q.length === 2 && Math.abs(q[0]) === 1 && Number.isInteger(q[1]);
  const pt = (q) => (isRef(q) ? kerb(q[0], q[1]) : q);
  // points along a leg from `from` in direction `dir`: every metre up to `len`, and exactly at the distances in `at`
  const leg = (from, dir, len, at) => {
    const ds = [];
    for (let d = 1; d < len - 0.3; d++) ds.push(d);
    ds.push(len, ...at.filter((d) => d > 0.3 && d < len - 0.3));
    return [...new Set(ds)].sort((p, q) => p - q).map((d) => add(from, dir, d));
  };

  cache = CORNERS.map((C) => {
    const A = C.lineA.map(pt), B = C.lineB.map(pt);
    const dA = unit(sub(A[1], A[0])), dB = unit(sub(B[1], B[0]));
    const sideB = isRef(C.lineB[0]) ? C.lineB[0][0] : 1, sideA = isRef(C.lineA[0]) ? C.lineA[0][0] : 1;
    let curve, corner, nA, radius = Infinity, TA, TB;
    if (C.fillet) {
      // the lap's own rounded kerb (corners.js and race.js draw it the same way), 10 cm further out
      const [, W, sgn] = ROUND.find((r) => r[0] === C.fillet);
      const a = kerb(sgn, C.fillet - W, 0), c = kerb(sgn, C.fillet, 0), b = kerb(sgn, C.fillet + W, 0);
      const bez = [];
      for (let j = 0; j <= 32; j++) { const t = j / 32, u = 1 - t; bez.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
      nA = unit(sub(bez[16], c));                  // away from the road
      curve = bez.map((q, j) => {
        let n = perp(unit(sub(bez[Math.min(32, j + 1)], bez[Math.max(0, j - 1)])));
        if (dot(n, nA) < 0) n = [-n[0], -n[1]];
        return add(q, n, OFF);
      });
      corner = c;
      TA = curve[0]; TB = curve[curve.length - 1];
    } else {
      // a circle of radius r touching both kerb lines, where they cross: A1 + t dA = B0 + u dB
      const den = -dA[0] * dB[1] + dA[1] * dB[0], r0 = sub(B[0], A[1]);
      const X = add(A[1], dA, (-r0[0] * dB[1] + r0[1] * dB[0]) / den);
      const cs = dot(dA, dB), L = C.r * Math.tan(Math.acos(Math.max(-1, Math.min(1, cs))) / 2);
      TA = add(X, dA, -L); TB = add(X, dB, L);
      nA = unit(sub(dB, [dA[0] * cs, dA[1] * cs]));       // towards the pavement, where the circle's centre is
      const O = add(TA, nA, C.r);
      const a0 = Math.atan2(TA[1] - O[1], TA[0] - O[0]);
      let a1 = Math.atan2(TB[1] - O[1], TB[0] - O[0]);
      while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
      while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
      const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * C.r) / 0.35));
      curve = [];
      for (let j = 0; j <= n; j++) { const g = a0 + ((a1 - a0) * j) / n; curve.push([O[0] + Math.cos(g) * C.r, O[1] + Math.sin(g) * C.r]); }
      corner = X;
      radius = C.r;
    }
    // the legs: back along line A from the round, on along line B after it
    const back = [-dA[0], -dA[1]];
    const lenOf = (v, from, dir, ref) => (v == null ? Math.max(0, dot(sub(ref, from), dir)) : Array.isArray(v) ? Math.max(0, dot(sub(pt(v), from), dir)) : v);
    const la = lenOf(C.lenA, TA, back, A[0]), lb = lenOf(C.lenB, TB, dB, B[1]);
    const cutA = C.drawA != null ? dot(sub(kerb(sideA, C.drawA), TA), back) : -1;
    const cutB = C.drawB != null ? dot(sub(kerb(sideB, C.drawB), TB), dB) : -1;
    const ptsA = leg(TA, back, la, [cutA]).reverse(), ptsB = leg(TB, dB, lb, [cutB]);
    const pts = [...ptsA, ...curve, ...ptsB];
    const nC0 = ptsA.length, nC1 = nC0 + curve.length - 1;     // the round, between these points
    // which points get drawn kerb stones: not on the legs where a generated run draws them
    const draw = pts.map((q, j) => (j < nC0 ? cutA < 0 || dot(sub(q, TA), back) <= cutA + 0.01 : j > nC1 ? cutB < 0 || dot(sub(q, TB), dB) <= cutB + 0.01 : true));
    // the side of the line the pavement is on, the same all along it
    const sgn = dot(perp(unit(sub(pts[nC0 + 1], pts[nC0]))), nA) >= 0 ? 1 : -1;
    const segN = [], segL = [], acc = [0];
    for (let j = 0; j < pts.length - 1; j++) {
      const d = sub(pts[j + 1], pts[j]), l = Math.hypot(d[0], d[1]) || 1e-6;
      segN.push([(-d[1] / l) * sgn, (d[0] / l) * sgn]); segL.push(l); acc.push(acc[j] + l);
    }
    const vN = pts.map((_, j) => unit(add(segN[Math.max(0, j - 1)], segN[Math.min(segN.length - 1, j)])));
    // how far in towards the pavement the line can be offset before it folds over (the inside of the round)
    const clamp = pts.map((_, j) => (j >= nC0 && j <= nC1 ? 0.92 * (C.fillet ? curveRadius(curve, j - nC0) : radius) : Infinity));
    // the height along the line: eased up to hB along the far leg, where the kerb joins a higher one
    const S = acc[acc.length - 1], sB = acc[nC1];
    const hAt = (s) => (C.hB == null || s <= sB ? C.h : C.h + (C.hB - C.h) * Math.min(1, (s - sB) / Math.max(0.5, cutB > 0 ? cutB : S - sB)));
    // the patch of old pavement that becomes road (inside the round), and a band of pavement just outside it
    const tip = add(corner, unit(sub(corner, curve[curve.length >> 1])), 0.5);
    const band = curve.map((q, j) => add(q, vN[nC0 + j], Math.min(1.0, clamp[nC0 + j])));
    return {
      ...C, pts, segN, segL, acc, vN, clamp, draw, S, hAt, nC0, nC1, curve,
      road: [tip, ...curve, tip], pave: [...curve, ...band.reverse()],
      box: bbox(pts, C.w + C.b + 1),
    };
  });
  return cache;
}

function curveRadius(c, j) {
  const a = c[Math.max(0, j - 2)], b = c[j], d = c[Math.min(c.length - 1, j + 2)];
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bd = Math.hypot(d[0] - b[0], d[1] - b[1]), ad = Math.hypot(d[0] - a[0], d[1] - a[1]);
  const area2 = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]));
  return area2 < 1e-6 ? 1e3 : (ab * bd * ad) / (2 * area2);
}

function bbox(pts, m) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  return [x0 - m, z0 - m, x1 + m, z1 + m];
}

// for the road painter: the cut-off corners painted as kerbed street, the band outside as pavement, so the
// ground's own kerb line runs round with the kerb stones (src/world/roadtex.js: R paved, G kerbed street)
export function junctionOverPaint() {
  const out = [];
  for (const k of junctionCorners()) out.push({ outer: k.pave, cover: '#f00' }, { outer: k.road, cover: '#ff0' });
  return out;
}

// the kerb's height at (x, z): 0 past the ends of its line
// (nothing is made on the way: every wheel asks this of every corner several times a frame, and the box taken
// apart into four names plus a small function per call were 80 MB of garbage a lap, 22 Nov 2026)
const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export function cornerAt(k, x, z) {
  const box = k.box;
  if (x < box[0] || x > box[2] || z < box[1] || z > box[3]) return 0;
  let best = Infinity, bj = -1, bt = 0;
  for (let j = 0; j < k.pts.length - 1; j++) {
    const a = k.pts[j], b = k.pts[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
    const t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2, tc = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - a[0] - dx * tc, z - a[1] - dz * tc);
    if (d < best) { best = d; bj = j; bt = t; }
  }
  if ((bj === 0 && bt < 0) || (bj === k.pts.length - 2 && bt > 1)) return 0;
  const tc = Math.max(0, Math.min(1, bt)), a = k.pts[bj], n = k.segN[bj];
  const d = (x - a[0]) * n[0] + (z - a[1]) * n[1];
  const s = k.acc[bj] + k.segL[bj] * tc;
  const w = k.w, b = k.b, e = k.edge;
  if (d <= 0 || d >= w + b) return 0;
  const taper = (k.taperA ? sm(s / 2) : 1) * (k.taperB ? sm((k.S - s) / 2) : 1);
  return k.hAt(s) * taper * sm(d / e) * (d > w ? sm((w + b - d) / b) : 1);
}
