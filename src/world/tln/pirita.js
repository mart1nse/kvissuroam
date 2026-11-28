// The Pirita-Kose-Kloostrimetsa lap's roads as they are (Martin, 28 Nov 2026: "make sure the streets look very similar
// in terms of pavement, its color, its patches ... the white marking needs to be very accurate. signs etc."). Tallinn only.
//
// From his Street View shots along the whole lap (June and August 2024) and the Maa-amet orthophoto straightened along the
// lap line (tools: the shots and strips are in the project's tallinn-plan folder):
//  - The two-lane roads through the woods and past the houses (Kose, Lükati, Kloostrimetsa, Rummu): a broken
//    centre line of long dashes, 3 m with 1 m gaps, and broken edge lines, 3 m and 3 m, 3.1 m out from the middle (the
//    autocorrelation of the photo along each line: a period of 4.0 m and 5.9 m). The asphalt is about a metre wider than
//    the edge lines each side and ends in sand and pine needles in the woods, with no kerb.
//  - Merivälja tee, the Pirita bridge and Pirita tee: the inner carriageway of the divided road, the one left of the
//    green strip as the lap runs (Martin 28 Nov: "move the merivälja tee part to the inside track indeed"; the lap ran
//    on the outer one before). Lane lines of short dashes (1.3 m, 2.7 m gaps), two lanes on the bridge and three
//    where the road is wider, solid edge lines, granite kerbs, tall galvanised lamps on its outer edge.
//  - Light grey, slightly cool, much patched old asphalt: dark rectangles of newer tarmac across a lane or along an
//    edge, black crack seals along the lane joints and across, black tyre marks (Rummu tee has plenty).
//  - On the bend of Kloostrimetsa past the houses a low concrete gutter of slabs along the inside of the corner.
//
// Three parts, as the map's own things are made:
//  piritaVectors(vectors): the lap's road pieces get their tone (no kerb where the woods are, smoother tarmac so the
//    photo's tree shadows do not blotch the road), no generated lines (the lap draws its own, in one phase along each
//    stretch, with gaps where side roads join), and sand along their edges in the woods. Before the map is painted.
//  piritaProps(): the zebra crossings measured on the photo, signs, and lamps along the lap (the Tallinn map had none).
//  createPirita(scene, world): what is built as the car comes near, through the work queue: the patches, crack seals
//    and tyre marks (one multiplied mesh per 200 m of the lap), guard rails, the gutter.
import * as THREE from 'three';
import LAP from '../../race/pirita.json';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { areaKit } from '../handbuilt.js';
import { multiplyMaterial } from './multiply.js';

const P = LAP.pts, N = P.length;
// metres along the lap at each point, and the way it runs there
const SS = new Float64Array(N + 1);
for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N]; SS[i + 1] = SS[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
const LEN = SS[N];
const TAN = P.map((_, i) => {
  const a = P[(i - 1 + N) % N], b = P[(i + 1) % N], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
});
const wrapI = (i) => ((i % N) + N) % N;
const wrapS = (s) => ((s % LEN) + LEN) % LEN;
// the lap point at s metres, o metres to the right of the way the lap is driven: [x, z, tx, tz, i]
function at(s, o = 0) {
  s = wrapS(s);
  let lo = 0, hi = N - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SS[m] <= s) lo = m; else hi = m - 1; }
  const i = lo, j = (i + 1) % N, t = (s - SS[i]) / ((SS[i + 1] - SS[i]) || 1);
  let tx = TAN[i][0] + (TAN[j][0] - TAN[i][0]) * t, tz = TAN[i][1] + (TAN[j][1] - TAN[i][1]) * t;
  const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  const x = P[i][0] + (P[j][0] - P[i][0]) * t, z = P[i][1] + (P[j][1] - P[i][1]) * t;
  return [x - tz * o, z + tx * o, tx, tz, i];
}
const bearing = (tx, tz) => (Math.atan2(tx, -tz) * 180) / Math.PI;

// a small seeded random, the same each visit
function rng(seed) {
  let a = seed * 2654435761 >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The stretches, by lap point (the lap's points are about 2.06 m apart; the start is on Rummu tee). tone: brightness and
// warmth as roadtex.js reads them (183 a typical Tartu street); fine: the tone's blue, 46 to 56 from worn to newer tarmac
// (smoother grain, and the photo's tree shadows show through the less: terrain.js).
// centre / lane: [dash, gap]; edge: how far from the middle the edge lines are, and their [dash, gap] or null for solid.
const ZONES = [
  { id: 'kose', i0: 75, i1: 381, tone: [177, 123], fine: 46, centre: [3, 1], edge: 3.1, edgeDash: [3, 3], woods: true, lamps: 'LIGHT' },
  { id: 'lukati', i0: 381, i1: 1343, tone: [185, 124], fine: 46, centre: [3, 1], edge: 3.1, edgeDash: [3, 3], woods: true, lamps: 'LIGHT', lampGap: 46 },
  { id: 'kloosF', i0: 1343, i1: 1899, tone: [184, 123], fine: 46, centre: [3, 1], edge: 3.1, edgeDash: [3, 3], woods: true, lamps: 'LIGHT', lampGap: 46 },
  { id: 'kloosU', i0: 1899, i1: 2198, tone: [171, 124], fine: 46, centre: [3, 1], edge: 3.1, edgeDash: [3, 3], kerb: true, lamps: 'LIGHT', lampSide: -1 },
  { id: 'meri', i0: 2198, i1: 2312, tone: [165, 123], fine: 54, centre: [1.3, 2.7], lanes: true, edge: 3.25, edgeDash: null, kerb: true, lamps: 'ROADLAMP', lampSide: -1, lampGap: 36 },
  { id: 'pirita', i0: 2312, i1: 2573, tone: [161, 122], fine: 56, centre: [1.3, 2.7], lanes: true, edge: 3.25, edgeDash: null, kerb: true, lamps: 'ROADLAMP', lampSide: -1, lampGap: 36 },
  { id: 'rummu', i0: 2573, i1: 75 + N, tone: [173, 123], fine: 46, centre: [3, 1], edge: 3.1, edgeDash: [3, 3], woods: true, lamps: 'LIGHT', lampGap: 38 },
];
const zoneAt = (i) => { i = wrapI(i); return ZONES.find((z) => (i >= z.i0 && i < z.i1) || (i + N >= z.i0 && i + N < z.i1)); };
const BRIDGE_TONE = [150, 121];          // the decks of the Pirita bridge and Lükati's: darker, newer
// where the lap turns off one road onto another: no lines of its own across the junction
const BOXES = [[372, 392], [1333, 1352], [2186, 2216], [2562, 2578]];
const inBox = (i) => BOXES.some(([a, b]) => i >= a && i <= b);
// a paved strip down the middle of Rummu tee from the Pirita tee lights (Street View: grey setts between the lanes)
const MEDIAN = [2578, 2612];

const DRIVE = new Set(['Tänav', 'Muu tee', 'Põhimaantee', 'Kõrvalmaantee', 'Tugimaantee', 'Ramp või ühenduste']);
const PATHS = new Set(['Kergliiklustee', 'Rada']);

// What the lap's pieces are, worked out once from the map's roads (after snapRoadsToTrack): each lap point's road width
// and level (1 on a bridge), and a grid of the other roads, to leave the edge lines open where one joins.
let laid = null;
function lay(vectors) {
  if (laid) return laid;
  const CELL = 20, grid = new Map(), paths = new Map(), lapGrid = new Map();
  // the lap's points in 20 m cells: the nearest one within reach of (x, z), [index, distance] or [-1, Infinity]
  const lapCells = new Map();
  for (let i = 0; i < N; i++) {
    const key = Math.floor(P[i][0] / CELL) * 100003 + Math.floor(P[i][1] / CELL);
    let list = lapCells.get(key);
    if (!list) lapCells.set(key, (list = []));
    list.push(i);
  }
  const nearLap = (x, z) => {
    let best = Infinity, bi = -1;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = lapCells.get((cx + a) * 100003 + cz + b);
      if (list) for (const i of list) { const d = (P[i][0] - x) ** 2 + (P[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } }
    }
    return [bi, Math.sqrt(best)];
  };
  const W = new Float32Array(N).fill(8.6), LV = new Uint8Array(N), lapRoads = new Set();
  const cover = new Float32Array(N);
  for (const r of vectors.roads) {
    if (!r.pts || r.pts.length < 2 || !DRIVE.has(r.type)) continue;
    // a piece of the lap: most of it lies on the lap line
    let on = 0, all = 0;
    const hits = [];
    for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < l; t += 3) {
        const x = a[0] + (b[0] - a[0]) * (t / l), z = a[1] + (b[1] - a[1]) * (t / l);
        const [i, d] = nearLap(x, z);
        all++;
        if (d < 2.5) { on++; hits.push(i); }
      }
    }
    if (all && on / all > 0.6) {
      lapRoads.add(r);
      for (const i of hits) if (r.w > cover[i]) { cover[i] = r.w; W[i] = r.w; LV[i] = r.e === 1 ? 1 : 0; }
    }
  }
  // the gaps between hits take the width of their neighbours, and the width is smoothed along 30 m
  let last = 8.6;
  for (let i = 0; i < N; i++) { if (cover[i]) last = W[i]; else W[i] = last; }
  const WS = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -7; k <= 7; k++) s += W[wrapI(i + k)]; WS[i] = s / 15; }
  for (const r of vectors.roads) {
    if (!r.pts || r.pts.length < 2) continue;
    const into = lapRoads.has(r) ? lapGrid : DRIVE.has(r.type) && r.w >= 2.6 ? grid : PATHS.has(r.type) ? paths : null;
    if (!into) continue;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1];
      const seg = { ax: a[0], az: a[1], bx: b[0], bz: b[1], hw: r.w / 2 };
      for (let cx = Math.floor(Math.min(a[0], b[0]) / CELL) - 1; cx <= Math.floor(Math.max(a[0], b[0]) / CELL) + 1; cx++) {
        for (let cz = Math.floor(Math.min(a[1], b[1]) / CELL) - 1; cz <= Math.floor(Math.max(a[1], b[1]) / CELL) + 1; cz++) {
          const key = cx * 100003 + cz;
          let list = into.get(key);
          if (!list) into.set(key, (list = []));
          list.push(seg);
        }
      }
    }
  }
  // is (x, z) within reach of another road's carriageway (or of a path, with paths)? If so its direction is returned
  const reach = (g, x, z, margin) => {
    const list = g.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
    if (!list) return null;
    for (const q of list) {
      const dx = q.bx - q.ax, dz = q.bz - q.az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - q.ax) * dx + (z - q.az) * dz) / l2));
      if (Math.hypot(q.ax + dx * t - x, q.az + dz * t - z) < q.hw + margin) return q;
    }
    return null;
  };
  // another road joins here: the point o metres out, and one 2 m further out, both on it, running across the lap
  const joins = (s, o, margin = 1.2) => {
    const p = at(s, o), q = reach(grid, p[0], p[1], margin);
    if (!q) return false;
    const l = Math.hypot(q.bx - q.ax, q.bz - q.az) || 1;
    if (Math.abs(((q.bx - q.ax) * p[2] + (q.bz - q.az) * p[3]) / l) > 0.9) return false;     // a piece running along the lap
    const p2 = at(s, o + Math.sign(o || 1) * 2);
    return !!reach(grid, p2[0], p2[1], margin);
  };
  const crossing = (s, minW) => {
    const p = at(s, 0), q = reach(grid, p[0], p[1], 1.5);
    if (!q || q.hw * 2 < minW) return false;
    const l = Math.hypot(q.bx - q.ax, q.bz - q.az) || 1;
    return Math.abs(((q.bx - q.ax) * p[2] + (q.bz - q.az) * p[3]) / l) < 0.9;
  };
  const onRoad = (x, z, margin) => !!reach(grid, x, z, margin) || !!reach(lapGrid, x, z, margin);
  const onPath = (x, z, margin) => !!reach(paths, x, z, margin);
  return (laid = { W: WS, LV, lapRoads, joins, crossing, onRoad, onPath });
}
const iOf = (s) => at(s)[4];

// ---------------------------------------------------------------------------------------------------------------------
// The map: before it is painted (main.js, after snapRoadsToTrack)
export function piritaVectors(vectors) {
  const L = lay(vectors);
  // the lap's pieces: their own tone, no generated lines, no kerb in the woods
  for (const r of L.lapRoads) {
    const mid = r.pts[Math.floor(r.pts.length / 2)];
    let bi = 0, bd = Infinity;
    for (let i = 0; i < N; i++) { const d = (P[i][0] - mid[0]) ** 2 + (P[i][1] - mid[1]) ** 2; if (d < bd) { bd = d; bi = i; } }
    const z = zoneAt(bi);
    const [lum, warm] = r.e === 1 ? BRIDGE_TONE : z.tone;
    r.tone = `rgb(${lum},${warm},${z.fine})`;
    r.nomark = true;
    if (!z.kerb) r.noKerb = true;
  }
  const bars = (vectors.extraBars ||= []);
  const bar = (a, b, w, lv) => bars.push(a[0], a[1], b[0], b[1], w, lv);
  const lvAt = (s) => L.LV[iOf(s)];
  const half = (s) => L.W[iOf(s)] / 2;

  // the lines: each stretch walked from its start, its dashes in one phase along it
  for (const z of ZONES) {
    const s0 = SS[z.i0 % N] + (z.i0 >= N ? LEN : 0), s1 = z.i1 > N ? SS[z.i1 - N] + LEN : SS[z.i1 % N] + (z.i1 === N ? LEN : 0);
    const end = s1 < s0 ? s1 + LEN : s1;
    const line = (o, [on, gap], keep, w = 0.13) => {
      for (let s = s0; s + on <= end; s += on + gap) {
        const sm = s + on / 2, i = iOf(sm);
        if (inBox(i) || !keep(sm, i)) continue;
        bar(at(s, o), at(s + on, o), w, lvAt(sm));
      }
    };
    // centre (or Pirita tee's lane line): not through a crossing of a big road nor on Rummu's paved middle
    // (the divided road's carriageway: one lane line down the middle of two lanes, two where it is over 9 m wide)
    const mid = (s, i) => !L.crossing(s, 9) && !(i >= MEDIAN[0] && i <= MEDIAN[1]);
    if (z.lanes) {
      for (let s = s0; s + z.centre[0] <= end; s += z.centre[0] + z.centre[1]) {
        const sm = s + z.centre[0] / 2, i = iOf(sm);
        if (inBox(i) || !mid(sm, i)) continue;
        const h = half(sm), o3 = (h - 0.6) / 3;
        for (const o of h > 4.5 ? [-o3, o3] : [0]) bar(at(s, o), at(s + z.centre[0], o), 0.13, lvAt(sm));
      }
    } else line(0, z.centre, mid);
    // edges, out from the middle by the zone's measure (further where the road widens for turning lanes)
    for (const side of [1, -1]) {
      const off = (s) => side * Math.max(z.edge, half(s) - 1.2);
      const keep = (s) => !L.joins(s, off(s));
      // (an edge walked at a fixed offset: the widening approaches ease out over the smoothed width)
      const walk = (on, gap) => {
        for (let s = s0; s + on <= end; s += on + gap) {
          const sm = s + on / 2, i = iOf(sm);
          if (inBox(i) || !keep(sm)) continue;
          bar(at(s, off(sm)), at(s + on, off(sm)), 0.13, lvAt(sm));
        }
      };
      if (z.edgeDash) walk(...z.edgeDash); else walk(2, 0);
    }
  }
  // the median's two sides on Rummu tee: solid lines, and the setts between them
  const mS0 = SS[MEDIAN[0]], mS1 = SS[MEDIAN[1]];
  for (let s = mS0; s + 2 <= mS1; s += 2) for (const o of [-1.15, 1.15]) bar(at(s, o), at(s + 2, o), 0.13, 0);
  const tone = (vectors.toneOver ||= []);
  const ring = [];
  for (let s = mS0; s <= mS1; s += 2) { const t = Math.min(1, (s - mS0) / 6, (mS1 - s) / 6); ring.push(at(s, -1.05 * Math.max(0.2, t))); }
  for (let s = mS1; s >= mS0; s -= 2) { const t = Math.min(1, (s - mS0) / 6, (mS1 - s) / 6); ring.push(at(s, 1.05 * Math.max(0.2, t))); }
  tone.push({ outer: ring.map(([x, z]) => [x, z]), tone: 'rgb(150,126,255)' });

  // stop lines (0.5 m) at the Kloostrimetsa lights (down the inner carriageway the lap meets the lights from behind), from the middle to the right edge; a give-way line of 1 m dashes where Lükati's
  // link road meets Kloostrimetsa
  const across = (i, o0, o1, w, dash = null) => {
    const s = SS[i];
    if (!dash) { bar(at(s, o0), at(s, o1), w, 0); return; }
    // (a bar along the lap at each dash, w long across it: put() takes a centre line and a width)
    for (let o = o0; o + dash[0] <= o1; o += dash[0] + dash[1]) { const a = at(s - w / 2, o + dash[0] / 2), b = at(s + w / 2, o + dash[0] / 2); bar(a, b, dash[0], 0); }
  };
  // (a stop line is a bar across the lane: its centre line runs across, its width along the lap)
  const stop = (i) => { const s = SS[i], h = half(s); bar(at(s, 0.1), at(s, h - 0.3), 0.5, 0); };
  stop(2185);
  across(1332, 0.15, half(SS[1332]) - 0.3, 0.4, [1, 0.5]);

  // sand and needles along the asphalt in the woods: a strip 0.2 to 1.3 m wide, broken where a road or a drive joins
  const over = (vectors.overPaint ||= []);
  for (const z of ZONES) {
    if (!z.woods) continue;
    const s0 = SS[z.i0 % N] + (z.i0 >= N ? LEN : 0);
    let s1 = z.i1 > N ? SS[z.i1 - N] + LEN : SS[z.i1 % N];
    if (s1 < s0) s1 += LEN;
    for (const side of [1, -1]) {
      const R = rng(z.i0 * 7 + (side > 0 ? 1 : 2));
      let run = [];
      const flush = () => {
        if (run.length > 2) {
          const outer = [...run.map((p) => p[0]), ...run.slice().reverse().map((p) => p[1])];
          over.push({ cover: 'rgb(0,0,255)', outer });
        }
        run = [];
      };
      let wave = R() * 10;
      for (let s = s0; s <= s1; s += 2.5) {
        const i = iOf(s), h = half(s);
        if (inBox(i) || L.LV[i] === 1 || L.joins(s, side * (h + 0.6), 1.5)) { flush(); continue; }
        wave += 0.25 + R() * 0.2;
        const w = 0.2 + 1.1 * Math.max(0, 0.5 + 0.35 * Math.sin(wave) + 0.25 * Math.sin(wave * 2.7 + 1.3));
        run.push([at(s, side * (h + 0.05)), at(s, side * (h + 0.05 + w))]);
        if (run.length >= 16) { const last = run[run.length - 1]; flush(); run.push(last); }
      }
      flush();
    }
  }
  for (const a of over) a.outer = a.outer.map(([x, z]) => [x, z]);
}

// ---------------------------------------------------------------------------------------------------------------------
// Props: [kind, x, z, bearing, extra] (src/world/props.js). Signs face the traffic they are for; a lamp's arm reaches
// along its bearing.
const LIGHT = 0, ZEBRA = 7, SIGN0 = 10, ROADLAMP = 43;
const SIGN = { speed: 0, warning: 4, yield: 5, priority: 6, crossing: 7, speed40: 10, parking: 11, busStop: 20 };
// the crossings, measured on the orthophoto: centre, the road's bearing, the crossing's width
const ZEBRAS = [[281.3, 491.3, 99.9, 8], [320.9, 435.5, 10.4, 8], [-1126.9, -19.5, 225, 10], [-1107.1, 1.5, 45, 9],
  [-1097.5, 11.7, 110, 10], [-775.7, -374.5, 210, 8], [-763.7, -366.7, 30, 8], [-1144.9, -11.1, 315, 6]];

let propsMade = null;
export function piritaPropsFor(vectors) {
  if (propsMade) return propsMade;
  const L = lay(vectors), out = [];
  // a post's spot beside the road: pushed out until it is clear of every carriageway and path, or none
  const clear = (s, o, extra = 0) => {
    for (let k = 0; k < 4; k++) {
      const oo = o + Math.sign(o) * k * 0.7, p = at(s, oo);
      if (!L.onRoad(p[0], p[1], 0.6 + extra) && !L.onPath(p[0], p[1], 0.5) && !(Math.abs(oo) < L.W[p[4]] / 2 + 0.8)) return p;
    }
    return null;
  };
  for (const [x, z, b, w] of ZEBRAS) {
    out.push([ZEBRA, x, z, b, w]);
    // the crossing signs either side, each facing its own traffic
    const r = (b * Math.PI) / 180, fx = Math.sin(r), fz = -Math.cos(r), rx = -fz, rz = fx;
    for (const side of [1, -1]) {
      for (let d = w / 2 + 0.9; d < w / 2 + 9; d += 0.5) {
        const px = x + rx * side * d - fx * side * 1.5, pz = z + rz * side * d - fz * side * 1.5;
        if (L.onRoad(px, pz, 0.4) || L.onPath(px, pz, 0.3)) continue;
        out.push([SIGN0 + SIGN.crossing, px, pz, side > 0 ? b + 180 : b, 0]);
        break;
      }
    }
  }
  const sign = (i, side, face, lift = 0, forLap = side > 0) => {
    const s = SS[i], p = clear(s, side * (L.W[i] / 2 + 1.1));
    if (!p) return;
    const b = bearing(p[2], p[3]);
    out.push([SIGN0 + face, p[0], p[1], forLap ? b + 180 : b, lift]);
  };
  // Kloostrimetsa from Lükati: crossroads ahead over 40 (Street View at 34 Kloostrimetsa tee), and the same the other
  // way where the woods begin past the houses
  sign(1372, 1, SIGN.speed40); sign(1372, 1, SIGN.warning, 7);
  sign(1905, -1, SIGN.speed40, 0, false); sign(1905, -1, SIGN.warning, 7, false);
  sign(1330, 1, SIGN.yield);                       // Lükati's link road gives way to Kloostrimetsa
  sign(1356, 1, SIGN.priority);
  sign(2722, 1, SIGN.parking); sign(2752, -1, SIGN.parking, 0, false);   // the car parks by the underpass on Rummu tee
  sign(2030, -1, SIGN.busStop, 0, false); sign(2460, -1, SIGN.busStop, 0, false);

  // lamps: one side, a pole every 38 to 46 m; on Pirita tee along its outer edge, the arm over the carriageway
  for (const z of ZONES) {
    const gap = z.lampGap || 40, side = z.lampSide || 1;
    const s0 = SS[z.i0 % N] + (z.i0 >= N ? LEN : 0);
    let s1 = z.i1 > N ? SS[z.i1 - N] + LEN : SS[z.i1 % N];
    if (s1 < s0) s1 += LEN;
    for (let s = s0 + gap / 2; s < s1 - 6; s += gap) {
      const i = iOf(s);
      if (inBox(i) || (i >= MEDIAN[0] - 4 && i <= MEDIAN[1] + 4)) continue;
      const p = clear(s, side * (L.W[i] / 2 + (z.lamps === 'ROADLAMP' ? 1.6 : 1.4)), 0.2);
      if (!p) continue;
      const b = bearing(p[2], p[3]) + (side > 0 ? -90 : 90);        // the arm towards the road
      out.push([z.lamps === 'ROADLAMP' ? ROADLAMP : LIGHT, p[0], p[1], b, 0]);
    }
  }
  return (propsMade = out);
}

// ---------------------------------------------------------------------------------------------------------------------
// Built near the car: the road's patches and marks, guard rails, the gutter.
// (the shader: src/world/tln/multiply.js, shared with the centre)
const material = multiplyMaterial;

// the factors a look turns the asphalt's colour by
const PATCH = [[0.78, 0.78, 0.8], [0.84, 0.84, 0.86], [0.72, 0.72, 0.75], [1.1, 1.09, 1.07]];   // newer, older, fresh black, pale old repair
const SEAL = [0.66, 0.66, 0.69];
const TYRE = [0.64, 0.64, 0.66];
const CHUNK = 96;                            // lap points a mesh covers (about 200 m)

export function createPirita(scene, world, { shadows = true } = {}) {
  const L = lay(world.vectors);
  const group = still(new THREE.Group());
  scene.add(group);
  const chunks = [];
  for (let c = 0; c * CHUNK < N; c++) chunks.push({ c, i0: c * CHUNK, i1: Math.min(N, (c + 1) * CHUNK), built: false, mesh: null });

  // the marks of one stretch: ribbons of [x, z] centre points, w wide, each vertex on the road there
  function* buildChunk(ch) {
    const pos = [], uv = [], fa = [], ka = [], idx = [];
    let n = 0;
    const ribbon = (pts, w, F, kind, lv) => {
      if (pts.length < 2) return;
      let along = 0;
      for (let k = 0; k < pts.length; k++) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        if (k) along += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        for (const sd of [-1, 1]) {
          const x = pts[k][0] - (dz / l) * (w / 2) * sd, z = pts[k][1] + (dx / l) * (w / 2) * sd;
          pos.push(x, world.topAt(x, z, lv) + 0.03, z);
          uv.push(sd < 0 ? 0 : 1, along);
          fa.push(...F); ka.push(kind);
        }
        if (k) idx.push(n - 2, n - 1, n, n, n - 1, n + 1);
        n += 2;
      }
    };
    const R = rng(1000 + ch.c);
    const s0 = SS[ch.i0], s1 = SS[ch.i1 === N ? 0 : ch.i1] + (ch.i1 === N ? LEN : 0);
    const along = (sa, sb, o, step = 1.5) => { const out = []; for (let s = sa; s < sb; s += step) out.push(at(s, typeof o === 'function' ? o(s) : o)); out.push(at(sb, typeof o === 'function' ? o(sb) : o)); return out; };
    const lvAt = (s) => L.LV[iOf(s)];
    // patches: across a lane, across the whole road, or a strip along an edge
    for (let s = s0 + R() * 25; s < s1; s += 18 + R() * 34) {
      const i = iOf(s), z = zoneAt(i), h = L.W[i] / 2;
      if (inBox(i) || L.LV[i] === 1) continue;
      const F = PATCH[R() < 0.15 ? 3 : R() < 0.35 ? 2 : R() < 0.6 ? 1 : 0], kind = R();
      if (kind < 0.4) {                                          // one lane, 1.5 to 5 m long
        const side = R() < 0.5 ? 1 : -1, len = 1.5 + R() * 3.5;
        ribbon(along(s, s + len, side * (h / 2 - 0.1), 1.2), h - 0.3 + R() * 0.3, F, 0, 0);
      } else if (kind < 0.62) {                                  // a trench across the whole road
        const len = 0.9 + R() * 1.4, pts = [];
        for (let o = -h + 0.1; o <= h - 0.1 + 1e-6; o += (2 * h - 0.2) / 4) pts.push(at(s, o));
        ribbon(pts, len, F, 0, 0);
      } else if (kind < 0.85 && z.woods) {                       // along an edge, where the verge has broken it
        const side = R() < 0.5 ? 1 : -1, len = 6 + R() * 22, wd = 0.7 + R() * 0.8;
        ribbon(along(s, s + len, side * (h - wd / 2 - 0.05), 1.5), wd, F, 0, 0);
      } else {                                                   // a square by a manhole or a gully
        const side = R() < 0.5 ? 1 : -1, len = 1.2 + R() * 1.6;
        ribbon(along(s, s + len, side * (0.6 + R() * (h - 1.8)), 0.6), 1 + R() * 1.4, F, 0, 0);
      }
      if (jobs.late()) yield;
    }
    // crack seals: along the joint by the middle in long broken runs, and across, every so often
    for (let s = s0 + R() * 30; s < s1; ) {
      const len = 12 + R() * 50, o0 = (R() - 0.5) * 0.5, wob = R() * 6;
      const sb = Math.min(s1, s + len);
      if (!inBox(iOf(s)) && L.LV[iOf(s)] !== 1 && zoneAt(iOf(s)).woods) ribbon(along(s, sb, (q) => o0 + 0.18 * Math.sin((q - s) * 0.11 + wob) + 0.07 * Math.sin((q - s) * 0.47), 1.2), 0.08, SEAL, 1, 0);
      s = sb + 8 + R() * 45;
    }
    for (let s = s0 + R() * 12; s < s1; s += 7 + R() * 26) {
      const i = iOf(s), h = L.W[i] / 2;
      if (inBox(i) || L.LV[i] === 1 || (!zoneAt(i).woods && R() < 0.6)) continue;      // (fewer on the newer tarmac by the houses)
      const full = R() < 0.45, a = full ? -h + 0.3 : (R() < 0.5 ? -h + 0.3 : 0.1), b = full ? h - 0.3 : a + h - 0.4, pts = [], wob = R() * 6;
      for (let o = a; o <= b + 1e-6; o += (b - a) / 6) pts.push(at(s + 0.35 * Math.sin(o * 1.3 + wob) + (o - a) * 0.06, o));
      ribbon(pts, 0.08, SEAL, 1, 0);
    }
    if (jobs.late()) yield;
    // tyre marks: pairs of black streaks 1.55 m apart, swinging a little, where people play (Rummu tee has plenty) and
    // out of the corners
    const sets = zoneAt(ch.i0 + CHUNK / 2).id === 'rummu' ? 4 : 1;
    for (let k = 0; k < sets; k++) {
      const s = s0 + R() * (s1 - s0), i = iOf(s);
      if (inBox(i) || L.LV[i] === 1) continue;
      const len = 10 + R() * 30, base = (R() < 0.75 ? 1 : -1) * (0.9 + R() * 0.9), amp = 0.2 + R() * 0.7, per = 10 + R() * 20, ph = R() * 6;
      const sway = (q) => base + amp * Math.sin((q - s) * (Math.PI * 2 / per) + ph);
      for (const d of [-0.78, 0.78]) ribbon(along(s, s + len, (q) => sway(q) + d, 1.0), 0.22, TYRE, 2, lvAt(s));
      if (jobs.late()) yield;
    }
    if (!idx.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('f', new THREE.Float32BufferAttribute(fa, 3));
    geo.setAttribute('k', new THREE.Float32BufferAttribute(ka, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material());
    mesh.renderOrder = 2;
    mesh.matrixAutoUpdate = false;
    ch.mesh = mesh;
    group.add(mesh);
  }

  // guard rails (Street View and the photo: Lükati down to the river and up from it, Rummu tee over the underpass) and
  // the concrete gutter round the inside of Kloostrimetsa's bend
  const RAILS = [[502, 527, 4.7], [552, 582, 4.7], [552, 582, -5.6], [2696, 2718, 5.0], [2696, 2718, -5.0]];
  const GUTTER = [1938, 1986, -1];
  const parts = [{ i: 540, built: false, make: (A) => RAILS.slice(0, 3).forEach(rail(A)) },
    { i: 2707, built: false, make: (A) => RAILS.slice(3).forEach(rail(A)) },
    { i: 1962, built: false, make: (A) => gutter(A) }];
  function rail(A) {
    return ([i0, i1, o]) => {
      const pts = [];
      for (let i = i0; i <= i1; i += 2) {
        // (the ends bend away from the road, as the real ones are)
        const t = Math.min(1, (i - i0) / 4, (i1 - i) / 4);
        pts.push(at(SS[i], o + Math.sign(o) * (1 - t) * 0.8).slice(0, 2));
      }
      A.guardrail(pts);
    };
  }
  function gutter(A) {
    // slabs a metre long: a flat run 0.32 m wide level with the road and a lip rising to the grass, joints between
    const [i0, i1, side] = GUTTER;
    for (let s = SS[i0]; s < SS[i1]; s += 1.0) {
      const i = iOf(s), h = L.W[i] / 2;
      for (const [o, wd, y0, y1, c] of [[h + 0.16, 0.32, -0.04, 0.025, 0xb8b6b0], [h + 0.38, 0.14, -0.04, 0.08, 0xaeaca6]]) {
        const p = at(s + 0.49, side * o), gy = world.heightAt(p[0], p[1]);
        A.p.box(0.96, y1 - y0, wd, c, p[0], gy + (y0 + y1) / 2, p[1], Math.atan2(-p[3], p[2]));
      }
    }
  }

  return {
    // (for the tests: how much is built)
    info: () => ({ marks: chunks.filter((c) => c.mesh).length, parts: parts.filter((q) => q.built).length, children: group.children.map((o) => o.children.length || 1) }),
    update(car) {
      if (!car) return;
      for (const ch of chunks) {
        const m = P[Math.min(N - 1, (ch.i0 + ch.i1) >> 1)], d = Math.hypot(m[0] - car.x, m[1] - car.z);
        if (!ch.built && d < 360) { ch.built = true; jobs.add(function* piritaMarks() { yield* buildChunk(ch); }, 'pirita marks'); }
        if (ch.mesh) ch.mesh.visible = d < 520;
      }
      for (const q of parts) {
        if (q.built) continue;
        const m = P[q.i];
        if (Math.hypot(m[0] - car.x, m[1] - car.z) > 320) continue;
        q.built = true;
        jobs.add(function* piritaParts() {
          const sub = still(new THREE.Group());
          const A = areaKit(world, sub, { shadows });
          q.make(A);
          yield;
          A.finish();
          group.add(sub);
        }, 'pirita rails');
      }
    },
  };
}
