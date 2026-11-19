// Hand-made changes around the race track, from Martin's notes and street view:
//  1. von Baeri -> Jakobi (right turn): the inside of the corner cleared of street furniture, one
//     pedestrian-crossing sign left.
//  2. Jakobi -> Lai (left turn): the inside cleared, one small sign left, and the inside kerb made a
//     10 cm mountable kerb with rounded edges.
//  3. The end of Lai at the Emajõgi: the clutter of signs and posts thinned to a few, and a low
//     plastered wall along the inside of the left turn (the botanical garden wall).
//  4. Jakobi -> Lai again (Martin, 16 Nov): the kept sign is a 40 sign standing on the kerb, the kerb
//     has sharper edges, and a bush (drive-through) grows on the inside by the house.
//  5. Pepleri -> Vanemuise (left): a raised cobble kerb, low black bollards and the parking bays
//     on the inside of the corner (street view, 12 Pepleri).
//  6. Vanemuise before Ülikooli: the right-hand kerb and pavement, bollards where it curves out, and
//     a parking sign (street view, 6 Vanemuise).
//  7. The start/finish straight on Küüni: lamp posts and a row of trees on the right.
// Everything left standing can be knocked over (src/world/props.js); the new trees are solid.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { realTreeKit } from '../world/scenery.js';
import { findCorners, startBoardSpot } from './decor.js';
import { createCorners, cornerClear, cornerProps } from './corners.js';
import { createValli, valliProps } from './valli.js';
import { createVeski } from './veski.js';
import { createMandel } from './mandel.js';
import { createValliStreet, valliStreetClear } from './vallistreet.js';
import { createBaeriStreet } from './baeristreet.js';
import { createVeskiEnd } from './veskiend.js';
import { createKroonuaia } from './kroonuaia.js';
import { createJakobiLai, jakobiLaiProps } from './jakobilai.js';
import { createEmajoe, emajoeClear, emajoeProps } from './emajoe.js';
import { createLai, laiClear } from './lai.js';
import { raekodaClear } from '../world/raekoda.js';
import { createTennis } from './tennis.js';
import { createUueturu, uueturuClear, uueturuProps } from './uueturu.js';
import { createPlaytech, playtechProps } from './playtech.js';

const LIGHT = 0, BOLLARD = 8, SIGN0 = 10, ZEBRA = 7, CROSSING = SIGN0 + 7, SPEED40 = SIGN0 + 10, PARKING = SIGN0 + 11, SPEED30 = SIGN0 + 12, SPEED50 = SIGN0;

// special corners; every other corner of the lap gets the default treatment (inside cleared, one sign left)
const SPECIAL = {
  628: { side: 1, out: 12, keep: (k) => k === CROSSING, keepN: 1 },                      // von Baeri -> Jakobi
  687: { keepN: 0 },                                                                       // Jakobi -> Lai: our own 40 sign instead
  920: { i0: 870, i1: 965, side: 0, out: 16, keep: (k) => k >= SIGN0, keepN: 4, spacing: 15 },   // Lai at the Emajõgi
};
function zones(track) {
  const out = [];
  for (const c of findCorners(track)) {
    const sp = SPECIAL[c.i] || {};
    out.push({ i0: c.i - 25, i1: c.i + 25, apex: c.i, side: c.dir, out: 12, keep: (k) => k >= SIGN0, keepN: 1, ...sp });
  }
  return out;
}
// mountable kerbs: from the road edge (+off) inwards `width` metres, `height` high, with edges `edge`
// (towards the road) and `back` (the far side) wide; sharp edges make the car hop
// (Martin, 19 Nov: every kerb along the lap 1 cm lower, with a smoother edge)
const KERBS = [
  { i0: 672, i1: 702, side: -1, off: 0, width: 5, height: 0.11, edge: 0.11, back: 0.5, colour: 0xbdb6c8 },        // Jakobi -> Lai
  { i0: 2046, i1: 2104, side: -1, off: 0, width: 1.5, height: 0.13, edge: 0.09, back: 0.35, colour: 0xb2adbb },   // Pepleri corner
  { i0: 1656, i1: 1722, side: -1, off: 0, width: 1.5, height: 0.11, edge: 0.09, back: 0.08, colour: 0x87a07a },    // Veski grass strip up to Juhan Liivi; veski.js lays it from there on
  { i0: 2226, i1: 2297, side: 1, off: 0, width: 3.2, height: 0.12, edge: 0.08, back: 0.6, colour: 0xa7a2b2 },     // Vanemuise, right
];
const JAKOBI_APEX = 687, BUSH_OFF = 3.6, SIGN40_OFF = 1.3;
const PEPLERI = { bollards: [2054, 2102, 1.9], pad: [2080, 2101, 2.6, 7.6] };    // bollards: i0, i1, off; pad: i0, i1, off0, off1
const VANEMUISE = { bollards: [2276, 2299, 0.45], sign: [2262, 1.1] };
const PLAYGROUND = [[1602, 3019, 5.2], [1616, 3031, 4.2]];     // landmarks.js, the Barclay park play area
const STRAIGHT = { i0: 2338, i1: 2389 + 34, side: 1, lampOff: 2.2, treeOff: 3.6, lampEvery: 26, treeEvery: 11, treeFrom: 2354 };
// treeFrom: no trees before this index, the corner by Kaubamaja is open paving (Martin, 19 Nov: none behind the START LINE board)
const WALL = { height: 1.0, thick: 0.45 };
// the botanical garden wall, traced by Martin on the Maa-amet map (16 Nov): from the corner of Lai 40
// along the back of the Lai pavement, round the corner and up Emajõe (game x, z)
const WALL_PTS = [[1414.7, 2377.1], [1429.5, 2368.4], [1437.0, 2358.5], [1442.6, 2348.6], [1445.7, 2334.9], [1443.2, 2328.7], [1437.6, 2321.3]];

// a smooth curve through the points (Catmull-Rom), about every `step` metres
function spline(pts, step = 1.5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// nearest track point in [i0, i1] and the signed distance to the right of the direction of travel
function lateral(track, i0, i1, x, z) {
  let best = Infinity, bi = i0;
  for (let i = i0; i <= i1; i++) {
    const d = (track.P[i][0] - x) ** 2 + (track.P[i][1] - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  const [tx, tz] = track.tan[bi];
  return { i: bi, lat: (x - track.P[bi][0]) * -tz + (z - track.P[bi][1]) * tx, d: Math.sqrt(best) };
}

// speed limits along the lap (Martin): 30 on Jakobi after von Baeri, 40 entering Lai, 30 on Kroonuaia.
// Surveyed 50 signs in these stretches are repainted; one sign is added at each start.
const LIMITS = [
  { i0: 628, i1: 672, kind: SPEED30, at: 640 },       // up Jakobi after the right turn
  { i0: 690, i1: 760, kind: SPEED40, at: 700 },       // entering Lai
  { i0: 1036, i1: 1120, kind: SPEED30, at: 1046 },    // entering Kroonuaia
];

// ids ("sx_sz:n") of the props to leave out (and speed signs repainted in place)
export function clearProps(data) {
  const track = createTrack();
  const out = new Set();
  for (const [, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (a[k] !== SPEED50) continue;
      for (const L of LIMITS) {
        const q = lateral(track, L.i0, L.i1, a[k + 1], a[k + 2]);
        if (q.i > L.i0 && q.i < L.i1 && Math.abs(q.lat) < track.HW[q.i] + 8) a[k] = L.kind;
      }
    }
  }
  // anything standing in the road itself, anywhere on the lap
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (a[k] === ZEBRA) continue;
      const n = track.nearest(a[k + 1], a[k + 2]);
      if (n.i >= 0 && n.d < track.HW[n.i] - 0.4) out.add(`${key}:${k / data.stride}`);
    }
  }
  cornerClear(data, out);
  emajoeClear(data, out);
  laiClear(data, out);
  raekodaClear(data, out);
  uueturuClear(data, out);
  valliStreetClear(data, out);
  for (const zn of zones(track)) {
    if (zn.i0 < 0 || zn.i1 >= track.N) continue;
    const hits = [];
    for (const [key, a] of Object.entries(data.sectors)) {
      for (let k = 0; k < a.length; k += data.stride) {
        const kind = a[k], x = a[k + 1], z = a[k + 2];
        if (kind === ZEBRA) continue;
        const ax = track.P[zn.apex][0], az = track.P[zn.apex][1];
        if (Math.hypot(x - ax, z - az) > 80) continue;
        const L = lateral(track, zn.i0, zn.i1, x, z);
        if (L.i === zn.i0 || L.i === zn.i1) continue;                 // beyond the ends of the zone
        const hw = track.HW[L.i];
        const side = Math.sign(L.lat);
        if (zn.side && side !== zn.side) continue;
        if (Math.abs(L.lat) > hw + zn.out) continue;
        hits.push({ id: `${key}:${k / data.stride}`, kind, x, z, lat: Math.abs(L.lat) - hw, apex: Math.hypot(x - ax, z - az) });
      }
    }
    // keep the nearest suitable posts (to the apex, or spread along the zone), drop the rest
    const keep = [];
    const cand = hits.filter((h) => zn.keep(h.kind) && h.lat > 0.3 && h.lat < 5).sort((a, b) => a.apex - b.apex);
    for (const h of cand) {
      if (keep.length >= zn.keepN) break;
      if (zn.spacing && keep.some((q) => Math.hypot(q.x - h.x, q.z - h.z) < zn.spacing)) continue;
      keep.push(h);
    }
    for (const h of hits) if (!keep.includes(h)) out.add(h.id);
  }
  return out;
}

// a kerb-side line: offset from the centre line to one side, holding its place where it would fold back
function sideLine(track, i0, i1, side, extra) {
  const pts = [];
  let prev = null;
  for (let i = i0; i <= i1; i++) {
    const [tx, tz] = track.tan[i];
    const nx = -tz * side, nz = tx * side, o = track.HW[i] + extra;
    let p = [track.P[i][0] + nx * o, track.P[i][1] + nz * o];
    if (prev && (p[0] - prev[0]) * tx + (p[1] - prev[1]) * tz < 0.3) continue;
    pts.push(p); prev = p;
  }
  return pts;
}

// distance along the normal (positive away from the road, given which side the road is on) to a polyline
function polyDist(pts, x, z) {
  let best = Infinity, lat = 0, along = 0, total = 0, at = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (l * l)));
    const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (d < best) { best = d; lat = ((x - a[0]) * -dz + (z - a[1]) * dx) / l; at = total + t * l; }
    total += l;
  }
  along = at;
  return { d: best, lat, along, total };
}

// a point `off` metres beyond the road edge on one side of track point i (side +1 right, -1 left)
function edgePoint(track, i, side, off) {
  const k = ((i % track.N) + track.N) % track.N;
  const [tx, tz] = track.tan[k], o = track.HW[k] + off;
  return [track.P[k][0] - tz * side * o, track.P[k][1] + tx * side * o];
}
const bearing = (dx, dz) => (Math.atan2(dx, -dz) * 180) / Math.PI;

// points every `step` metres along a polyline
function walk(pts, step, from = step / 2) {
  const out = [];
  let need = from;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (need <= l) { const t = need / l; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); need += step; }
    need -= l;
  }
  return out;
}

// sideLine for index ranges that may run past the end of the lap
function sideLineWrap(track, i0, i1, side, extra) {
  const pts = [];
  let prev = null;
  for (let j = i0; j <= i1; j++) {
    const i = j % track.N;
    const [tx, tz] = track.tan[i];
    const p = edgePoint(track, i, side, extra);
    if (prev && (p[0] - prev[0]) * tx + (p[1] - prev[1]) * tz < 0.3) continue;
    pts.push(p); prev = p;
  }
  return pts;
}

// hand-placed street furniture for the props layer: [kind, x, z, bearing]
export function extraProps() {
  const track = createTrack();
  const out = [];
  const back = (i) => bearing(-track.tan[i % track.N][0], -track.tan[i % track.N][1]);      // facing oncoming cars
  // speed limit signs at the start of each limited stretch, on the right
  for (const L of LIMITS) {
    const p = edgePoint(track, L.at, 1, 0.9);
    out.push([L.kind, p[0], p[1], back(L.at)]);
  }
  // 4. the 40 sign on the Jakobi -> Lai kerb
  const s40 = edgePoint(track, JAKOBI_APEX - 4, -1, SIGN40_OFF);
  out.push([SPEED40, s40[0], s40[1], back(JAKOBI_APEX - 12)]);
  // 5. Pepleri corner bollards
  const [b0, b1, bo] = PEPLERI.bollards;
  for (const [x, z] of walk(sideLine(track, b0, b1, -1, bo), 1.8)) out.push([BOLLARD, x, z, 0]);
  // 6. Vanemuise: bollards where the kerb curves out, and the parking sign
  const [v0, v1, vo] = VANEMUISE.bollards;
  for (const [x, z] of walk(sideLine(track, v0, v1, 1, vo), 1.8)) out.push([BOLLARD, x, z, 0]);
  const [si, so] = VANEMUISE.sign;
  const ps = edgePoint(track, si, 1, so);
  out.push([PARKING, ps[0], ps[1], back(si)]);
  // 7. lamp posts along the right of the start/finish straight, lamps over the road
  const st = STRAIGHT;
  const lampLine = sideLineWrap(track, st.i0, st.i1, st.side, st.lampOff);
  const s0 = track.P[0], board = startBoardSpot(track);
  for (const [x, z] of walk(lampLine, st.lampEvery, 6)) {
    if (Math.hypot(x - s0[0], z - s0[1]) < 6) continue;          // keep clear of the gantry posts
    if (board && Math.hypot(x - board.x, z - board.z) < 12) continue;   // and of the START LINE billboard (Martin, 19 Nov)
    const n = track.nearest(x, z), [tx, tz] = track.tan[n.i];
    out.push([LIGHT, x, z, bearing(tz * st.side, -tx * st.side)]);
  }
  out.push(...cornerProps(), ...valliProps(), ...emajoeProps(), ...jakobiLaiProps(), ...uueturuProps(), ...playtechProps());
  return out;
}

export function createTrackside(world, scene) {
  const track = createTrack();
  const group = new THREE.Group();
  scene.add(group);
  const lambert = (colour, extra = {}) => new THREE.MeshLambertMaterial({ color: colour, ...extra });

  // ---- mountable kerbs: physics through world.addBump, drawn as raised slabs
  const kerbs = KERBS.map((K) => {
    const line = sideLine(track, K.i0, K.i1, K.side, K.off);
    const inward = K.side < 0 ? -1 : 1;
    const bb = line.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
    const profile = (d, along, total) => K.height * smooth(d / K.edge) * smooth((K.width - d) / K.back) * smooth(along / 1.2) * smooth((total - along) / 1.2);
    world.addBump({
      x0: bb[0] - K.width - 1, z0: bb[1] - K.width - 1, x1: bb[2] + K.width + 1, z1: bb[3] + K.width + 1,
      at(x, z) {
        const q = polyDist(line, x, z);
        const d = q.lat * inward;
        if (d <= 0 || d >= K.width || q.d > K.width + 0.1) return 0;
        return profile(d, q.along, q.total);
      },
    });
    return { K, line, inward, profile, mesh: null };
  });

  function buildKerb(k) {
    const { K, line, inward, profile } = k;
    // cross-section across the kerb, from the road edge inwards
    const D = [0, K.edge * 0.5, K.edge, K.edge + 0.12, K.width / 2, K.width - K.back, K.width - K.back / 2, K.width].sort((a, b) => a - b);
    const pos = [], idx = [];
    let total = 0;
    const along = [0];
    for (let i = 1; i < line.length; i++) { total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); along.push(total); }
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const nx = (dz / l) * inward, nz = (-dx / l) * inward;     // away from the road
      for (const d of D) {
        const x = line[i][0] + nx * d, z = line[i][1] + nz * d;
        pos.push(x, world.heightAt(x, z) + 0.02, z);
      }
      if (i) {
        const n = D.length, r0 = (i - 1) * n, r1 = i * n;
        for (let q = 0; q < n - 1; q++) idx.push(r0 + q, r1 + q, r0 + q + 1, r0 + q + 1, r1 + q, r1 + q + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    k.mesh = new THREE.Mesh(g, lambert(K.colour, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    k.mesh.receiveShadow = true;
    group.add(k.mesh);
  }

  // ---- 3. the low wall, as segments (for collisions) and boxes (to draw)
  const wallLine = spline(WALL_PTS);
  const segs = [];
  for (let i = 0; i < wallLine.length - 1; i++) segs.push([wallLine[i], wallLine[i + 1]]);
  let wallSegs = null;           // the ones clear of buildings, once the ground is loaded
  let wallMesh = null;

  // drawn as fieldstone with a brick coping by emajoe.js, like the rest of the garden wall (Martin, 18 Nov)
  function buildWall() {
    wallSegs = segs.filter(([a, b]) => world.sdfAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) > 0.8);
    emajoe.drawLowWall(wallSegs, WALL.thick);
    wallMesh = true;
  }

  // merge [geometry, colour] pairs into one vertex-coloured mesh
  function merged(list, mat) {
    if (!list.length) return null;
    const flat = list.map(([g, c]) => [g.index ? g.toNonIndexed() : g, new THREE.Color(c)]);
    let n = 0;
    for (const [g] of flat) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const [g, c] of flat) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      for (let v = 0; v < g.attributes.position.count; v++) col.set([c.r, c.g, c.b], (o + v) * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(g, mat || new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  }

  // ---- 4. the bush on the inside of Jakobi -> Lai (no collision: the car pushes through it)
  const bushAt = edgePoint(track, JAKOBI_APEX, -1, BUSH_OFF);
  let bush = null;
  function buildBush() {
    // Martin: right against the house corner at the apex. The corner is the building point nearest the
    // inside kerb at the apex; stand the bush just off its wall, between the house and the road.
    const edge = edgePoint(track, JAKOBI_APEX, -1, 0);
    let best = null, bd = Infinity;
    for (let dx = -12; dx <= 12; dx += 0.5) {
      for (let dz = -12; dz <= 12; dz += 0.5) {
        const px = edge[0] + dx, pz = edge[1] + dz, sd = world.sdfAt(px, pz);
        if (sd < 1.0 || sd > 1.5) continue;
        const n = track.nearest(px, pz);
        if (n.i >= 0 && n.d < track.HW[n.i] + 1.2) continue;           // not on the road or its kerb
        const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = [px, pz]; }
      }
    }
    if (best) { bushAt[0] = best[0]; bushAt[1] = best[1]; }
    const [bx, bz] = bushAt, y = world.heightAt(bx, bz);
    // a leafy bush like the trees, unless the simple trees are on
    const kit = realTreeKit();
    bush = kit && kit.bush();
    if (bush) {
      bush.position.set(bx, y - 0.05, bz);
      bush.scale.set(1.15, 1.1, 1.15);
      bush.castShadow = true;
      group.add(bush);
      return;
    }
    const greens = [0x3f7a2e, 0x4f8f35, 0x37692a, 0x5c9a3c, 0x456f2c];
    const parts = [];
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 9; k++) {
      const a = r() * Math.PI * 2, d = r() * 1.1, s = 0.55 + r() * 0.5;
      const g = new THREE.IcosahedronGeometry(s, 0);
      g.scale(1, 0.8 + r() * 0.3, 1);
      g.translate(bx + Math.cos(a) * d, y + 0.35 + s * 0.7 + r() * 0.35, bz + Math.sin(a) * d);
      parts.push([g, greens[k % greens.length]]);
    }
    for (let k = 0; k < 3; k++) {          // a few woody stems at the bottom
      const g = new THREE.CylinderGeometry(0.03, 0.05, 0.6, 5);
      g.translate(bx + (r() - 0.5) * 0.8, y + 0.3, bz + (r() - 0.5) * 0.8);
      parts.push([g, 0x5a4330]);
    }
    bush = merged(parts);
    bush.castShadow = true;
    group.add(bush);
  }

  // ---- 5. parking bays on the inside of the Pepleri corner
  let pad = null;
  function buildPad() {
    const [i0, i1, o0, o1] = PEPLERI.pad;
    const near = sideLine(track, i0, i1, -1, o0), far = sideLine(track, i0, i1, -1, o1);
    const n = Math.min(near.length, far.length);
    const pos = [], idx = [];
    for (let i = 0; i < n; i++) {
      for (const p of [near[i], far[i]]) pos.push(p[0], world.heightAt(p[0], p[1]) + 0.03, p[1]);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const asphalt = new THREE.Mesh(g, lambert(0x8a8594, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    asphalt.receiveShadow = true;
    // white bay lines across the pad every 2.6 m, and one along the far end
    const lines = [];
    const marks = walk(near, 2.6, 0.3);
    for (const [x, z] of marks) {
      const L = lateral(track, i0, i1, x, z), [tx, tz] = track.tan[L.i];
      const nx = tz, nz = -tx;                // left of travel
      const a = [x, z], b = [x + nx * (o1 - o0) * 0.9, z + nz * (o1 - o0) * 0.9];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const line = new THREE.BoxGeometry(0.12, 0.02, len);
      line.rotateY(Math.atan2(b[0] - a[0], b[1] - a[1]));
      line.translate((a[0] + b[0]) / 2, Math.max(world.heightAt(...a), world.heightAt(...b)) + 0.05, (a[1] + b[1]) / 2);
      lines.push([line, 0xf2eff7]);
    }
    pad = new THREE.Group();
    pad.add(asphalt);
    const lm = merged(lines, new THREE.MeshBasicMaterial({ vertexColors: true }));
    if (lm) pad.add(lm);
    group.add(pad);
  }

  // ---- 7. trees on the right of the start/finish straight (solid trunks)
  const trees = [];
  {
    const st = STRAIGHT, s0 = track.P[0];
    const line = sideLineWrap(track, st.i0, st.i1, st.side, st.treeOff);
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x, z] of walk(line, st.treeEvery, 3)) {
      if (Math.hypot(x - s0[0], z - s0[1]) < 7) continue;
      let bi = st.i0, bd = Infinity;
      for (let j = st.i0; j <= st.i1; j++) { const q = track.P[j % track.N], d = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (d < bd) { bd = d; bi = j; } }
      if (bi < st.treeFrom) continue;
      if (PLAYGROUND.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + 1.5)) continue;
      trees.push({ x, z, h: 5.5 + r() * 2, s: 2.1 + r() * 0.8, tint: r() });
    }
  }
  let treeMesh = null;
  function buildTrees() {
    const keep = trees.filter((t) => world.sdfAt(t.x, t.z) > 1.2);
    trees.length = 0;
    trees.push(...keep);
    // limes like the map's trees, each drawn in full; the simple shapes with ?trees=old
    const kit = realTreeKit(), lime = kit && kit.species[0];
    if (lime && lime.near) {
      treeMesh = new THREE.InstancedMesh(lime.near, lime.soloMat, trees.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
      trees.forEach((t, k) => {
        // same height and spread as the simple tree had
        const h = t.h * 0.55 + t.s * 1.9, c = t.s * 2.1;
        m.compose(new THREE.Vector3(t.x, world.heightAt(t.x, t.z) - 0.1, t.z), q.setFromAxisAngle(up, t.tint * 6.283), new THREE.Vector3(c, h, c));
        treeMesh.setMatrixAt(k, m);
        treeMesh.setColorAt(k, col.setScalar(0.92 + t.tint * 0.14));
      });
      treeMesh.castShadow = true;
      treeMesh.frustumCulled = false;
      group.add(treeMesh);
      return;
    }
    const parts = [];
    for (const t of trees) {
      const y = world.heightAt(t.x, t.z);
      const trunk = new THREE.CylinderGeometry(0.13, 0.2, t.h * 0.55, 6);
      trunk.translate(t.x, y + t.h * 0.275, t.z);
      parts.push([trunk, 0x6b4a33]);
      const crown = new THREE.IcosahedronGeometry(t.s, 0);
      crown.scale(1, 1.15, 1);
      crown.translate(t.x, y + t.h * 0.55 + t.s * 0.75, t.z);
      parts.push([crown, t.tint < 0.5 ? 0x4c8a37 : 0x5f9a3e]);
    }
    treeMesh = merged(parts);
    if (treeMesh) { treeMesh.castShadow = true; group.add(treeMesh); }
  }

  const corners = createCorners(world, group, merged);
  const valli = createValli(world, group, merged);
  const veski = createVeski(world, group, merged);
  const mandel = createMandel(world, group);
  const valliStreet = createValliStreet(world, group);
  const baeriStreet = createBaeriStreet(world, group);
  const veskiEnd = createVeskiEnd(world, group);
  const kroonuaia = createKroonuaia(world, group);
  const jakobiLai = createJakobiLai(world, group);
  const emajoe = createEmajoe(world, group);
  const lai = createLai(world, group);
  const tennis = createTennis(world, group);
  const uueturu = createUueturu(world, group);
  const playtech = createPlaytech(world, group);
  const readyAll = (pts) => pts.every(([x, z]) => world.ready(x, z));
  const near = (p, x, z, r = 800) => Math.hypot(p[0] - x, p[1] - z) < r;

  // push the car's corners and sides out of circles (tree trunks)
  function pushOutOfCircles(car, circles, rad) {
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    for (const c of circles) {
      const dx = c.x - car.x, dz = c.z - car.z;
      if (dx * dx + dz * dz > 30) continue;
      // circle centre in the car's frame, clamped to the body box: nearest point of the car
      const lf = dx * fx + dz * fz, lr = dx * rx + dz * rz;
      const cf = Math.max(-car.halfLen, Math.min(car.halfLen, lf)), cr = Math.max(-car.halfWid, Math.min(car.halfWid, lr));
      const ox = (lf - cf), or = (lr - cr), d = Math.hypot(ox, or);
      if (d >= rad) continue;
      let nf, nr, pen;
      if (d > 1e-6) { nf = -ox / d; nr = -or / d; pen = rad - d; }
      else {                      // centre inside the box: out the nearest face
        const pf = car.halfLen - Math.abs(lf), pr = car.halfWid - Math.abs(lr);
        if (pf < pr) { nf = -Math.sign(lf); nr = 0; pen = pf + rad; } else { nf = 0; nr = -Math.sign(lr); pen = pr + rad; }
      }
      const nx = nf * fx + nr * rx, nz = nf * fz + nr * rz;          // world direction to push the car
      car.x += nx * pen; car.z += nz * pen;
      const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
      const vn = wvx * nx + wvz * nz;
      if (vn < 0) {
        const nvx = wvx - 1.3 * vn * nx, nvz = wvz - 1.3 * vn * nz;
        car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
        car.yawRate *= 0.5;
        car.hit = Math.max(car.hit, -vn);
      }
    }
  }

  return {
    update(x, z) {
      corners.update(x, z);
      valli.update(x, z);
      veski.update(x, z);
      mandel.update(x, z);
      valliStreet.update(x, z);
      baeriStreet.update(x, z);
      veskiEnd.update(x, z);
      kroonuaia.update(x, z);
      jakobiLai.update(x, z);
      emajoe.update(x, z);
      lai.update(x, z);
      tennis.update(x, z);
      uueturu.update(x, z);
      playtech.update(x, z);
      for (const k of kerbs) if (!k.mesh && near(k.line[0], x, z) && readyAll(k.line)) buildKerb(k);
      if (!wallMesh && wallSegs === null && near(wallLine[0], x, z) && readyAll(wallLine)) buildWall();
      if (!bush && near(bushAt, x, z) && world.ready(...bushAt)) buildBush();
      if (!pad && near(edgePoint(track, PEPLERI.pad[0], -1, 4), x, z) && readyAll(sideLine(track, PEPLERI.pad[0], PEPLERI.pad[1], -1, PEPLERI.pad[3]))) buildPad();
      if (!treeMesh && trees.length && near([trees[0].x, trees[0].z], x, z) && trees.every((t) => world.ready(t.x, t.z))) buildTrees();
    },
    // keep the car out of the wall and the tree trunks
    collide(car) {
      if (treeMesh) pushOutOfCircles(car, trees, 0.32);
      valli.collide(car, pushOutOfCircles);
      veski.collide(car);
      if (!wallSegs || !wallSegs.length) return;
      const w0 = wallLine[0];
      if (Math.abs(car.x - w0[0]) > 160 || Math.abs(car.z - w0[1]) > 160) return;
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
      const hl = car.halfLen, hw = car.halfWid, half = WALL.thick / 2;
      for (let k = 0; k < 10; k++) {
        const lx = k < 4 ? (k < 2 ? hl : -hl) : k < 6 ? 0 : k < 8 ? (k === 6 ? hl : -hl) : (k === 8 ? hl * 0.5 : -hl * 0.5);
        const ly = k < 4 ? (k % 2 ? hw : -hw) : k < 6 ? (k === 4 ? hw : -hw) : k < 8 ? 0 : (k === 8 ? hw : -hw);
        const px = car.x + fx * lx + rx * ly, pz = car.z + fz * lx + rz * ly;
        for (const [a, b] of wallSegs) {
          const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
          const cx = a[0] + dx * t, cz = a[1] + dz * t;
          const ox = px - cx, oz = pz - cz, d = Math.hypot(ox, oz);
          if (d >= half || d < 1e-6) continue;
          const nx = ox / d, nz = oz / d, pen = half - d;
          car.x += nx * pen; car.z += nz * pen;
          const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
          const vn = wvx * nx + wvz * nz;
          if (vn < 0) {
            const nvx = wvx - 1.25 * vn * nx, nvz = wvz - 1.25 * vn * nz;
            car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
            car.yawRate *= 0.6;
            car.hit = Math.max(car.hit, -vn);
          }
        }
      }
    },
  };
}
