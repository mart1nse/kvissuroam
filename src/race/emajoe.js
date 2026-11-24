// Emajõe tänav along the river, from the Vabadussild junction to Kroonuaia (Martin, 18 Nov, street view
// Aug 2024), in pastel versions of the real colours:
//  - the botanical garden wall on the left: a fieldstone base with a pale rendered top and a red brick
//    coping. It starts at the junction as the low stone wall round the corner from Lai, then a driveway
//    gate between two red brick posts, and after the gate the wall is higher.
//  - the bus stop on the right: a bay beside the lane with a yellow zigzag, the dashed line between bay
//    and lane, a glass shelter with a bench and an advert panel, and the bus stop sign.
//  - the lane markings: a solid centre line (double at the junction),
//    and the pavers on the river side.
// The map's own wall line along the garden (Emajõe and Kroonuaia) is drawn here in the same style instead
// of the plain grey map wall; it stays solid through the baked obstacle field.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { Parts, BOX } from './landmarks.js';
import { drapeSteps } from '../world/drape.js';
import { paverTex, GRASS } from '../world/streetkit.js';
import { breakableShelter, shelterSolids } from '../world/shelter.js';
import { adAtlas, adCell, POSTER, clickablePoster } from '../world/adverts.js';
import { jobs } from '../jobs.js';

const E = { i0: 941, i1: 1032 };                         // the Emajõe stretch of the lap
const LAI_END = 948;                                      // the Lai junction (src/race/lai.js) has its own lines up to here
const BAY = { i0: 959, i1: 989, width: 2.9, taper: 6 };  // the bus bay: track indices, width beyond the road edge
const SHELTER = { i: 973, len: 4.6, depth: 1.55 };
const DASH = { i0: 948, i1: 991 };                       // dashed line along the right edge of the lane
const DOUBLE = [948, 953];                               // double centre line at the junction
const PAVE = { i0: 948, width: 3.4 };                    // river-side pavement, from here to the bridge
// at the Kroonuaia junction the pavement turns right round the corner onto the bridge (Martin, 19 Nov):
// curve radius of its inner (grass) edge, its edges on the bridge (metres from the middle of the deck),
// and how far it runs on along the bridge after the bend
const CORNER = { bridge: 'Kroonuaia sild', from: 1021, r: 2.0, near: 4.1, far: 7.4, on: 3 };
// The river-side pavement stands on a high kerb, 15 cm with a rounded edge (Martin, 19 Nov: first 20, then lower and a touch gentler,
// then the edge rounder still, over 20 cm, so it is easier to drive onto but still knocks and tilts the car,
// and 1 cm lower like every kerb along the lap: 14 cm): the car rolls onto it with a knock
// and leans over when its right wheels are up there. It rises in the first metres of the pavement and comes
// down to the road again before the corner, where the crossing is. edge: the kerb face (m across), back: the
// grass bank behind the pavement down to the ground, stone: width of the kerb stone on top.
const KERB = { i0: 950, up: 3, i1: 1019, down: 5, h: 0.14, edge: 0.2, back: 0.9, stone: 0.18 };
// Its tarmac is newer and smoother than the photo's mottled grey suggests, and about as light as the
// pavements either side (Martin, 19 Nov): [track index, brightness, warmth] as the road tone texture takes
// them (183, 136 typical; Lai ends at 178, 134). Blue 77 marks the fine-grained tarmac (terrain.js).
// It runs on round the Kroonuaia corner (to 1052) so the old square edge line of the photo hardly shows
// there: the corner has its own line round the barrier (src/race/corners.js).
const TONE = [[940, 178, 134, 0], [947, 206, 133, 77], [1024, 206, 133, 77], [1036, 192, 134, 77], [1050, 186, 135, 77], [1056, 183, 135, 0]];
// the map's wall line round the garden (vectors.json walls, game x, z): Emajõe, the Kroonuaia corner, Kroonuaia
const GARDEN_WALL = [[1417.2, 2290.9], [1396.6, 2258.5], [1336.4, 2198.0], [1329.8, 2197.9], [1224.4, 2316.8]];
const GATE = { a: [1437.6, 2321.3], w: 4.4 };            // driveway gate: first post at the end of the low wall
const LOW = { stone: 0.95, cope: 0.13 };                 // the low wall round the corner
const HIGH = { stone: 1.15, render: 0.95, cope: 0.13, thick: 0.62 };

const COL = {
  render: 0xf3e6df, cope: 0xd98d7f, brick: 0xd99282, postCap: 0xb9bac8, iron: 0x3f4a55,
  white: 0xfaf8ff, yellow: 0xffd768, pave: 0xf0c9c0, paveRGB: [226, 208, 218], kerb: 0xdcd8e4, kerbFace: 0xaaa5b8, bank: GRASS.hex,
  frame: 0x464b59, roof: 0x575c6b, bench: 0xa98670, pole: 0x9a9eab,
};

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// rounded fieldstones in pastel ochres, pinks and greys on lilac-grey mortar; 512 px = 2 m by 1 m, tiles
function stoneTex() {
  const t = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#b9aab4'; g.fillRect(0, 0, w, h);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const tones = ['#d8b7a0', '#c9a596', '#e2c9b0', '#bfa7a6', '#d4b9b8', '#c7b29a', '#e0bfb0', '#b8a2a0', '#d9c6bb', '#cba08e'];
    for (let row = 0; row < 7; row++) {
      let x = -r() * 40;
      const y0 = row * (h / 6.4) + 6;
      while (x < w + 30) {
        const sw = 34 + r() * 46, sh = 26 + r() * 16;
        const cx = x + sw / 2, cy = y0 + (r() - 0.5) * 10;
        g.fillStyle = tones[(r() * tones.length) | 0];
        g.beginPath();
        g.ellipse(cx, cy, sw / 2 - 3, sh / 2 - 2, (r() - 0.5) * 0.5, 0, Math.PI * 2);
        g.fill();
        for (const off of [-w, w]) {          // wrap round so the texture tiles
          g.beginPath(); g.ellipse(cx + off, cy, sw / 2 - 3, sh / 2 - 2, 0, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath(); g.ellipse(cx - sw * 0.12, cy - sh * 0.15, sw / 4, sh / 6, 0, 0, Math.PI * 2); g.fill();
        x += sw + 2 + r() * 6;
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a poster-sized plane showing advert k of the shared atlas
function adPlane(w, h, k) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, [u0, v0, u1, v1] = adCell(k);
  for (let n = 0; n < uv.count; n++) uv.setXY(n, u0 + uv.getX(n) * (u1 - u0), v0 + uv.getY(n) * (v1 - v0));
  return g;
}

// the two lamp posts by the bay (Martin, 18 Nov): moved off the bay and its kerb to behind the shelter
// and the two bins that stood in the bay go onto the pavement either side of the shelter
const LIGHT = 0, BIN = 4;
const LAMPS = [
  { kind: LIGHT, from: [1424.6, 2280.4], i: 970, lat: 10.3 }, { kind: LIGHT, from: [1432.9, 2287.2], i: 977, lat: 10.3 },
  { kind: BIN, from: [1425.4, 2281.6], i: 966, lat: 7.6 }, { kind: BIN, from: [1416.7, 2267.3], i: 981, lat: 7.6 },
];

// What the map has on the last 60 m to the Kroonuaia junction but Street View (Aug 2024) does not
// (Martin, 19 Nov): the river side has one lamp post by the pavement, the lamps and a bin down by the
// riverside path, and the traffic light at the corner with its give-way and crossing signs; the map had
// seven lamp posts, five signal heads, six signs, a box and two benches there, most of them the corner's
// own things placed again further back. The same false crossing stood on the garden-wall side.
// [kind, x, z] of the map's props.
const GONE = [
  [3, 1380.0, 2223.9], [0, 1377.3, 2222.7], [0, 1372.7, 2218.2], [0, 1371.5, 2214.0], [11, 1370.1, 2215.5],
  [2, 1366.0, 2211.3], [17, 1365.8, 2211.1], [6, 1365.2, 2210.6], [2, 1358.4, 2203.6], [2, 1357.1, 2202.4],
  [11, 1353.6, 2198.9], [0, 1353.3, 2198.5], [17, 1349.2, 2194.5], [11, 1346.9, 2192.0], [2, 1344.4, 2189.6],
  [3, 1338.3, 2185.9],
  [2, 1358.2, 2218.5], [17, 1356.1, 2219.6], [1, 1357.0, 2217.3], [11, 1348.3, 2211.0], [1, 1349.0, 2210.2],
  [2, 1348.9, 2209.2], [0, 1349.3, 2209.5],
];
const CROSSING = [17, 1340.5, 2185.7, 143, 7];            // the blue crossing sign, on the corner post above the give-way sign

// props layer: leave the map's lamps at the bay out, and the things that are not there ...
export function emajoeClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      const near = ([kind, x, z]) => a[k] === kind && Math.hypot(a[k + 1] - x, a[k + 2] - z) < 0.6;
      if (LAMPS.some((l) => near([l.kind, ...l.from])) || GONE.some(near)) out.add(`${key}:${k / data.stride}`);
    }
  }
}
// ... and stand them behind the shelter, the lamp still reaching over the road
export function emajoeProps() {
  const track = createTrack();
  return [...LAMPS.map(({ kind, i, lat }) => {
    const [tx, tz] = track.tan[i];
    const x = track.P[i][0] - tz * lat, z = track.P[i][1] + tx * lat;
    const b = (Math.atan2(tz, tx) * 180) / Math.PI;      // arm towards the road, as the map lamps had it
    return [kind, x, z, b];
  }), CROSSING, busSign(track)];
}

// the bus stop sign at the start of the bay, on a pole that snaps off when hit like the other signs (Martin, 19 Nov)
const BUS_SIGN = 30;
function busSign(track) {
  const i = BAY.i0 + 4, [tx, tz] = track.tan[i];
  const lat = track.HW[i] + BAY.width * smooth((i - BAY.i0) / BAY.taper) * smooth((BAY.i1 - i) / BAY.taper) + 0.55;
  return [BUS_SIGN, track.P[i][0] - tz * lat, track.P[i][1] + tx * lat, (Math.atan2(-tx, tz) * 180) / Math.PI];
}

// before the road markings and map walls are built: no generated centre line on this stretch (it gets its
// own lines), and the garden wall is drawn by this file instead of as a plain grey map wall
export function emajoeVectors(vectors) {
  const track = createTrack();
  vectors.markSkip = (x, z) => {
    const n = track.nearest(x, z, 990);
    return n.i >= E.i0 && n.i <= E.i1 && n.d < track.HW[n.i] + 1;
  };
  // the lighter, smoother tarmac, over the whole width of the street and the bus bay
  const out = (vectors.toneOver ||= []);
  const side = (i, lat) => { const [tx, tz] = track.tan[i]; return [track.P[i][0] - tz * lat, track.P[i][1] + tx * lat]; };
  const bay = (i) => BAY.width * smooth((i - BAY.i0) / BAY.taper) * smooth((BAY.i1 - i) / BAY.taper);
  for (let i = TONE[0][0]; i < TONE[TONE.length - 1][0]; i++) {
    let k = 0;
    while (TONE[k + 1][0] < i + 0.5) k++;
    const [a, ...ta] = TONE[k], [b, ...tb] = TONE[k + 1], u = (i + 0.5 - a) / (b - a);
    const [l, w, f] = ta.map((v, q) => Math.round(v + (tb[q] - v) * u));
    const L0 = track.HW[i] + 0.6, L1 = track.HW[i + 1] + 0.6;
    out.push({ outer: [side(i, -L0), side(i + 1, -L1), side(i + 1, L1 + bay(i + 1)), side(i, L0 + bay(i))], tone: `rgb(${l},${w},${f})` });
  }
  const first = GARDEN_WALL[GARDEN_WALL.length - 1];
  vectors.walls = (vectors.walls || []).filter((w) => !w.some((p) => Math.hypot(p[0] - first[0], p[1] - first[1]) < 0.5));
}

// The strip between the kerb and the garden wall is laid level with the street, from the gate to the
// corner, so the foot of the wall runs straight: the terrain model had bumps of up to 30 cm along the
// wall, and the ground rose and fell against it (Martin, 19 Nov). Done to the height data as each piece
// of the map loads, after levelTrackShoulders.
export function levelEmajoeWall(world) {
  const track = createTrack();
  const { P } = track;
  const hm = world.meta.height, hn = hm.n, res = hm.res;
  const segs = [[GATE.a, GARDEN_WALL[0]], [GARDEN_WALL[0], GARDEN_WALL[1]], [GARDEN_WALL[1], GARDEN_WALL[2]]];
  const dist = (x, z) => Math.min(...segs.map(([a, b]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
  }));
  const xs = segs.flat().map((p) => p[0]), zs = segs.flat().map((p) => p[1]);
  const box = [Math.min(...xs) - 6, Math.min(...zs) - 6, Math.max(...xs) + 6, Math.max(...zs) + 6];
  world.onSectorLoad((s) => {
    const H = s.H;
    if (!H) return;
    const span = (hn - 1) * res;
    if (s.x0 > box[2] || s.x0 + span < box[0] || s.z0 > box[3] || s.z0 + span < box[1]) return;
    const at = (x, z) => {
      let fx = Math.max(0, Math.min(hn - 1.001, (x - s.x0) / res)), fz = Math.max(0, Math.min(hn - 1.001, (z - s.z0) / res));
      const c = Math.floor(fx), r = Math.floor(fz);
      fx -= c; fz -= r;
      const i = r * hn + c;
      return ((H[i] * (1 - fx) + H[i + 1] * fx) * (1 - fz) + (H[i + hn] * (1 - fx) + H[i + hn + 1] * fx) * fz);
    };
    const edits = [];
    for (let r = 0; r < hn; r++) {
      const z = s.z0 + r * res;
      if (z < box[1] || z > box[3]) continue;
      for (let c = 0; c < hn; c++) {
        const x = s.x0 + c * res;
        if (x < box[0] || x > box[2] || dist(x, z) > 4) continue;
        const n = track.nearest(x, z, 1000);
        if (n.i < E.i0 + 8 || n.i > E.i1 - 3) continue;
        const j = n.i + 1, cx = P[n.i][0] + (P[j][0] - P[n.i][0]) * n.t, cz = P[n.i][1] + (P[j][1] - P[n.i][1]) * n.t;
        const [tx, tz] = track.tan[n.i];
        if ((x - cx) * -tz + (z - cz) * tx > 0) continue;          // the river side
        const behind = n.d - dist(cx, cz);                          // metres past the wall line, away from the street
        const w = behind <= 1 ? 1 : 1 - smooth((behind - 1) / 2.5);
        if (w > 0) edits.push([r * hn + c, at(cx, cz), w]);
      }
    }
    for (const [k, road, w] of edits) H[k] = Math.round(H[k] + (road - H[k]) * w);
  });
}

export function createEmajoe(world, group) {
  const track = createTrack();
  const right = (i) => { const [tx, tz] = track.tan[i]; return [-tz, tx]; };
  const at = (i, lat) => { const [rx, rz] = right(i); return [track.P[i][0] + rx * lat, track.P[i][1] + rz * lat]; };
  const hw = (i) => track.HW[i];
  const bayW = (i) => BAY.width * smooth((i - BAY.i0) / BAY.taper) * smooth((BAY.i1 - i) / BAY.taper);

  // ---- the high kerb: a step in the ground for the cars (world.addBump), drawn in build()
  // (t: a track index with a fraction; lateral offsets from the centre line, + towards the river)
  const lerpT = (t, f) => { const i = Math.floor(t), u = t - i; return f(i) + (f(i + 1) - f(i)) * u; };
  const atT = (t, lat) => {
    const i = Math.floor(t), u = t - i, [ax, az] = track.P[i], [bx, bz] = track.P[i + 1];
    const tx = track.tan[i][0] + (track.tan[i + 1][0] - track.tan[i][0]) * u, tz = track.tan[i][1] + (track.tan[i + 1][1] - track.tan[i][1]) * u;
    const l = Math.hypot(tx, tz) || 1;
    return [ax + (bx - ax) * u - (tz / l) * lat, az + (bz - az) * u + (tx / l) * lat];
  };
  const kerbFace = (t) => lerpT(t, hw) + bayW(t) + 0.12;                   // the face of the kerb, 13 cm in front of the kerb strip's middle
  const KW = 0.13 + PAVE.width;                                              // from the face to the back of the pavement
  const kerbUp = (t) => smooth((t - KERB.i0) / KERB.up) * smooth((KERB.i1 - t) / KERB.down);
  const kerbProfile = (t, d) => {
    if (d <= 0 || d >= KW + KERB.back) return 0;
    return KERB.h * kerbUp(t) * smooth(d / KERB.edge) * (d > KW ? smooth((KW + KERB.back - d) / KERB.back) : 1);
  };
  {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = KERB.i0; i <= KERB.i1; i++) {
      for (const lat of [kerbFace(i), kerbFace(i) + KW + KERB.back]) {
        const [x, z] = atT(i, lat);
        x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
      }
    }
    const hint = Math.round((KERB.i0 + KERB.i1) / 2);
    world.addBump({
      x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1,
      at(x, z) {
        const n = track.nearest(x, z, hint), t = n.i + n.t;
        if (n.i < 0 || t <= KERB.i0 || t >= KERB.i1) return 0;
        const [tx, tz] = track.tan[n.i], P = track.P[n.i];
        return kerbProfile(t, (x - P[0]) * -tz + (z - P[1]) * tx - kerbFace(t));
      },
    });
  }

  const markMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
  // the pavement: concrete pavers, solid now that it stands up on its kerb
  const paveMat = new THREE.MeshLambertMaterial({ map: paverTex(COL.paveRGB, 5), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  const kerbMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex() });
  let built = false, lowBuilt = false;

  // ---- flat things on the ground: a quad strip along a polyline [[x, z, halfWidth], ...]
  function strip(pts, colour, lift, out, heightAt = (x, z) => world.heightAt(x, z)) {
    const c = new THREE.Color(colour);
    const pos = [], col = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az, aw] = pts[k], [bx, bz, bw] = pts[k + 1];
      const p0 = pts[Math.max(0, k - 1)], p3 = pts[Math.min(pts.length - 1, k + 2)];
      const side = (p, q, w0) => { const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [-dz / l * w0, dx / l * w0]; };
      const [na, ma] = side(p0, pts[k + 1], aw), [nb, mb] = side(pts[k], p3, bw);
      const v = (x, z) => [x, heightAt(x, z) + lift, z];
      const A0 = v(ax - na, az - ma), A1 = v(ax + na, az + ma), B0 = v(bx - nb, bz - mb), B1 = v(bx + nb, bz + mb);
      pos.push(...A0, ...B0, ...A1, ...A1, ...B0, ...B1);
      for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
    }
    out.push([pos, col]);
  }
  function meshOf(list, mat, up = false) {
    let n = 0;
    for (const [p] of list) n += p.length;
    if (!n) return null;
    const pos = new Float32Array(n), col = new Float32Array(n);
    let o = 0;
    for (const [p, c] of list) { pos.set(p, o); col.set(c, o); o += p.length; }
    // up: every triangle wound to face the sky, else a double-sided material lights it as if it looked
    // down and the white lines come out dark grey
    if (up) {
      for (let t = 0; t < n; t += 9) {
        const ax = pos[t], az = pos[t + 2], bx = pos[t + 3], bz = pos[t + 5], cx = pos[t + 6], cz = pos[t + 8];
        if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) >= 0) continue;
        for (let q = 0; q < 3; q++) {
          const a = pos[t + 3 + q]; pos[t + 3 + q] = pos[t + 6 + q]; pos[t + 6 + q] = a;
          const b = col[t + 3 + q]; col[t + 3 + q] = col[t + 6 + q]; col[t + 6 + q] = b;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const nor = new Float32Array(n);
    for (let k = 1; k < n; k += 3) nor[k] = 1;                 // flat on the ground: lit from above whichever way it winds
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }
  // a line at a lateral offset over track indices, with dashes of `on` metres every `on + off` (off 0: solid)
  function line(i0, i1, latOf, width, colour, on, off, out) {
    const pts = [];
    for (let i = i0; i <= i1; i++) pts.push(at(i, latOf(i)));
    if (!off) { strip(pts.map(([x, z]) => [x, z, width / 2]), colour, 0.06, out); return; }
    const len = [0];
    for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const pointAt = (d) => {
      let k = 1;
      while (k < pts.length - 1 && len[k] < d) k++;
      const t = (d - len[k - 1]) / ((len[k] - len[k - 1]) || 1);
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t, width / 2];
    };
    for (let d = 0; d + on <= len[len.length - 1]; d += on + off) strip([pointAt(d), pointAt(d + on / 2), pointAt(d + on)], colour, 0.06, out);
  }

  // ---- walls with a fieldstone texture: boxes along a polyline following the ground at each end
  function wallParts(pts, layers, stone, flat) {
    let u = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      const ya = world.heightAt(a[0], a[1]), yb = world.heightAt(b[0], b[1]);
      // where the wall runs straight on into the next piece, no end faces and no overlap there (they
      // showed as seams down the wall)
      const straight = (p, q, r) => p && r && Math.abs((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])) < 0.02 * Math.hypot(q[0] - p[0], q[1] - p[1]) * Math.hypot(r[0] - q[0], r[1] - q[1]);
      const openA = straight(pts[k - 1], a, b), openB = straight(a, b, pts[k + 2]);
      let h0 = -0.4;
      for (const L of layers) {
        const h1 = L.top;
        const t = L.thick / 2, ext = L.ext || 0;
        const nx = -dz / l * t, nz = dx / l * t;
        const ex = dx / l * ext, ez = dz / l * ext;
        const A = openA ? a : [a[0] - ex, a[1] - ez], B = openB ? b : [b[0] + ex, b[1] + ez];
        const P = (p, s, y) => [p[0] + nx * s, y, p[1] + nz * s];
        const corners = [
          P(A, -1, ya + h0), P(B, -1, yb + h0), P(A, -1, ya + h1), P(B, -1, yb + h1),
          P(A, 1, ya + h0), P(B, 1, yb + h0), P(A, 1, ya + h1), P(B, 1, yb + h1),
        ];
        const faces = [[0, 1, 2, 3], [5, 4, 7, 6], [2, 3, 6, 7], [4, 0, 6, 2], [1, 5, 3, 7]];
        for (const f of faces) {
          if ((f === faces[3] && openA) || (f === faces[4] && openB)) continue;
          const [q0, q1, q2, q3] = f.map((i) => corners[i]);
          if (L.tex) {
            const span = f === faces[3] || f === faces[4] ? L.thick : l;
            const u0 = f === faces[1] ? u + l : u, u1 = f === faces[1] ? u : u + l;
            const uu0 = span === l ? u0 / 2 : 0, uu1 = span === l ? u1 / 2 : span / 2;
            const v0 = h0 + 0.4, v1 = h1 + 0.4;
            stone.pos.push(...q0, ...q1, ...q2, ...q2, ...q1, ...q3);
            stone.uv.push(uu0, v0, uu1, v0, uu0, v1, uu0, v1, uu1, v0, uu1, v1);
          } else {
            const c = new THREE.Color(L.colour);
            flat.pos.push(...q0, ...q1, ...q2, ...q2, ...q1, ...q3);
            for (let q = 0; q < 6; q++) flat.col.push(c.r, c.g, c.b);
          }
        }
        h0 = h1;
      }
      u += l;
    }
  }
  function wallMeshes(stone, flat) {
    const out = [];
    if (stone.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(stone.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(stone.uv, 2));
      g.computeVertexNormals();
      out.push(new THREE.Mesh(g, stoneMat));
    }
    if (flat.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(flat.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(flat.col, 3));
      g.computeVertexNormals();
      out.push(new THREE.Mesh(g, solidMat));
    }
    for (const m of out) { m.castShadow = m.receiveShadow = true; group.add(m); }
  }

  // the low wall round the corner from Lai (its line and collisions live in trackside.js)
  function drawLowWall(segs, thick) {
    if (lowBuilt) return;
    lowBuilt = true;
    const stone = { pos: [], uv: [] }, flat = { pos: [], col: [] };
    for (const [a, b] of segs) {
      wallParts([a, b], [
        { top: LOW.stone, thick, tex: true, ext: thick * 0.3 },
        { top: LOW.stone + LOW.cope, thick: thick + 0.1, colour: COL.cope, ext: thick * 0.3 + 0.05 },
      ], stone, flat);
    }
    wallMeshes(stone, flat);
  }

  // The two edges of the pavement round the corner onto the bridge: each runs on straight from the
  // street and from the bridge until they meet, and bends there on a quadratic curve (the kerb on the
  // outside, the grass edge on the inside), then runs CORNER.on metres along the bridge. Null if the
  // bridge is not in the map.
  function cornerEdges() {
    const deck = world.decks.find((d) => d.name === CORNER.bridge);
    if (!deck || deck.pts.length < 3) return null;
    const p0 = deck.pts[0], p1 = deck.pts[2];
    const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const dx = (p1[0] - p0[0]) / l, dz = (p1[1] - p0[1]) / l;          // along the bridge
    let nx = -dz, nz = dx;                                                  // across it, towards Emajõe
    const q = track.P[CORNER.from];
    if ((q[0] - p0[0]) * nx + (q[1] - p0[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const [ux, uz] = track.tan[CORNER.from];
    const a = hw(CORNER.from) + 0.25;
    const one = (lat, off, r) => {
      const [ax, az] = at(CORNER.from, lat), bx = p0[0] + nx * off, bz = p0[1] + nz * off;
      const det = dx * uz - ux * dz;
      const t = ((bz - az) * dx - (bx - ax) * dz) / det;
      const X = [ax + ux * t, az + uz * t];
      const A = [X[0] - ux * r, X[1] - uz * r], B = [X[0] + dx * r, X[1] + dz * r];
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const s = k / 8, w0 = (1 - s) * (1 - s), w1 = 2 * (1 - s) * s, w2 = s * s;
        pts.push([A[0] * w0 + X[0] * w1 + B[0] * w2, A[1] * w0 + X[1] * w1 + B[1] * w2]);
      }
      return { X, u: [ux, uz], r, pts, sB: (B[0] - p0[0]) * dx + (B[1] - p0[1]) * dz };
    };
    const far = one(a + PAVE.width, CORNER.far, CORNER.r);
    const near = one(a + 0.1, CORNER.near, CORNER.r + CORNER.far - CORNER.near);
    const end = Math.max(near.sB, far.sB) + CORNER.on;
    for (const [e, off] of [[near, CORNER.near], [far, CORNER.far]]) {
      for (let s = e.sB + 1.5; s < end + 0.01; s += 1.5) e.pts.push([p0[0] + nx * off + dx * s, p0[1] + nz * off + dz * s]);
    }
    return { near, far };
  }

  function* build() {
    built = true;
    const marks = [], pave = [];
    const edge = (i) => hw(i) - 0.18;

    // ---- markings
    line(LAI_END, E.i1 - 2, () => 0, 0.13, COL.white, 0, 0, marks);                       // solid centre line
    line(DOUBLE[0], DOUBLE[1], () => -0.24, 0.12, COL.white, 0, 0, marks);                  // its twin at the junction
    line(DASH.i0, BAY.i0 + 3, edge, 0.13, COL.white, 1.2, 1.3, marks);                     // short dashes to the bay
    line(BAY.i0 + 3, BAY.i1 - 3, edge, 0.15, COL.white, 2.8, 2.2, marks);                  // along the bay
    line(BAY.i1 - 3, DASH.i1, edge, 0.13, COL.white, 1.2, 1.3, marks);
    // yellow zigzag in the bay: legs between the lane line and the kerb
    {
      const zig = [];
      const a0 = BAY.i0 + BAY.taper - 1, a1 = BAY.i1 - BAY.taper + 1, legs = 7;
      for (let k = 0; k <= legs; k++) {
        const i = Math.round(a0 + (a1 - a0) * k / legs);
        const lat = hw(i) + (k % 2 ? bayW(i) - 0.35 : 0.3);
        zig.push([...at(i, lat), 0.1]);
      }
      for (let k = 0; k < zig.length - 1; k++) strip([zig[k], zig[k + 1]], COL.yellow, 0.065, marks);
    }
    yield;
    // ---- the river-side pavement, the kerb of the bay
    {
      // the pavement is draped in 1.5 m triangles wound to the sky: the old 3.4 m quads let the bank poke
      // through (the holes) and faced down, so they came out dark red; now a light, half see-through pink
      // that lets the ground show through and blends in (Martin, 18 Nov)
      const near = [], far = [], outer = [];
      const turn = cornerEdges();
      // (without the bridge in the map it stops short of the junction, as it did before)
      const before = (p, e) => !e || (p[0] - e.X[0]) * e.u[0] + (p[1] - e.X[1]) * e.u[1] < -e.r;
      let inN = true, inF = true, last = PAVE.i0;
      for (let i = PAVE.i0; i <= (turn ? E.i1 : 1004); i++) {
        const fade = Math.max(0.03, smooth((i - PAVE.i0) / 4) * (turn ? 1 : smooth((1004 - i) / 4)));
        const a = hw(i) + bayW(i) + 0.25, b = a + PAVE.width * fade;
        inN = inN && before(at(i, a + 0.1), turn && turn.near);
        inF = inF && before(at(i, b), turn && turn.far);
        if (inN) { near.push(at(i, a + 0.1)); last = i; }
        if (inF) far.push(at(i, b));
      }
      outer.push([...at(last, hw(last) + bayW(last) + 0.25), 0.14]);
      if (turn) {                                        // round the corner and on along the bridge
        near.push(...turn.near.pts); far.push(...turn.far.pts);
        for (const p of turn.near.pts) outer.push([...p, 0.14]);
      }
      yield;
      const top = { heightAt: (x, z) => world.topAt(x, z, 1) };
      const g = yield* drapeSteps(top, [[[...near, ...far.reverse()]]], 0.05, 1.6, 1.5);
      yield;
      if (g) { const m = new THREE.Mesh(g, paveMat); m.receiveShadow = true; group.add(m); }
      if (outer.length > 1) strip(outer, COL.kerb, 0.06, pave, top.heightAt);
      yield;
      // the kerb along the straight: its face down to the road, the stone on top, and behind the pavement
      // the grass bank down to the ground
      {
        const pos = [], col = [];
        const cK = new THREE.Color(COL.kerb), cF = new THREE.Color(COL.kerbFace), cB = new THREE.Color(COL.bank);
        const quad = (A, B, C, D, c) => { pos.push(...A, ...B, ...C, ...C, ...B, ...D); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b); };
        const P3 = (t, d, lift) => { const [x, z] = atT(t, kerbFace(t) + d); return [x, world.heightAt(x, z) + lift, z]; };
        const step = 0.5;
        for (let t = PAVE.i0; t < last - 1e-6; t += step) {
          if (jobs.late()) yield;                 // (26 ms in one go on the lap check, 24 Nov)
          const u = Math.min(last, t + step);
          // face: from just under the road up the rounded edge (it follows the bump the cars feel), the
          // lower part in the face colour and the round-over in stone, then the stone on top
          const yRoad = (tt) => world.heightAt(...atT(tt, kerbFace(tt) - 0.02));
          const F = (tt, d, y) => { const [x, z] = atT(tt, kerbFace(tt) + d); return [x, y, z]; };
          const R = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((f) => f * KERB.edge);
          quad(F(t, -0.01, yRoad(t) - 0.04), F(u, -0.01, yRoad(u) - 0.04), P3(t, R[0], 0.012), P3(u, R[0], 0.012), cF);
          for (let q = 0; q < R.length - 1; q++) quad(P3(t, R[q], 0.012), P3(u, R[q], 0.012), P3(t, R[q + 1], 0.012), P3(u, R[q + 1], 0.012), q < 2 ? cF : cK);
          quad(P3(t, KERB.edge, 0.012), P3(u, KERB.edge, 0.012), P3(t, KERB.edge + 0.14, 0.055), P3(u, KERB.edge + 0.14, 0.055), cK);
          // the bank: from the back of the pavement down to the ground beside it
          if (t >= PAVE.i0 + 3) for (let k = 0; k < 3; k++) {
            const d0 = KW - 0.05 + (KERB.back + 0.1) * k / 3, d1 = KW - 0.05 + (KERB.back + 0.1) * (k + 1) / 3;
            quad(P3(t, d0, 0.045), P3(u, d0, 0.045), P3(t, d1, 0.04), P3(u, d1, 0.04), cB);
          }
        }
        const kg = new THREE.BufferGeometry();
        kg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        kg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        kg.computeVertexNormals();
        const km = new THREE.Mesh(kg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        km.receiveShadow = true;
        group.add(km);
      }
    }
    for (const [list, mat] of [[marks, markMat], [pave, kerbMat]]) { const m = meshOf(list, mat, true); if (m) group.add(m); }


    yield;
    // ---- the glass shelter, its bench and advert, and the bus stop sign
    const p = new Parts(), solids = [];
    const glass = [], sp = new Parts(), adverts = [], advertGlass = [];
    let shelter = null;
    {
      const i = SHELTER.i, [ux, uz] = track.tan[i], [rx, rz] = right(i);
      const lat = hw(i) + BAY.width + 0.25 + 0.6 + SHELTER.depth / 2;
      const [cx, cz] = at(i, lat);
      const y = Math.max(world.heightAt(cx, cz), world.heightAt(...at(i, hw(i) + BAY.width + 0.3))) + 0.05;
      const yaw = Math.atan2(-uz, ux);
      const W = (lu, lr) => [cx + ux * lu + rx * lr, cz + uz * lu + rz * lr];
      const add = (geo, colour, lu, yy, lr) => { const [x, z] = W(lu, lr); sp.add(geo, colour, x, y + yy, z, yaw); };      // the frame: bends when hit
      const L = SHELTER.len, D = SHELTER.depth, H = 2.45;
      p.box(L + 0.5, 0.12, D + 0.4, COL.pave, cx, y - 0.04, cz, yaw);                    // slab
      for (const lu of [-L / 2, -L / 6, L / 6, L / 2]) {
        add(BOX(0.07, H, 0.07), COL.frame, lu, H / 2, D / 2);                                 // back posts
        if (Math.abs(lu) > L / 3) add(BOX(0.07, H, 0.07), COL.frame, lu, H / 2, -D / 2);      // front posts at the ends
      }
      add(BOX(L + 0.35, 0.1, D + 0.35), COL.roof, 0, H + 0.05, 0);                             // roof
      add(BOX(L + 0.35, 0.18, 0.06), COL.frame, 0, H - 0.04, -D / 2 - 0.17);                  // fascia
      add(BOX(L, 0.06, 0.06), COL.frame, 0, 0.12, D / 2);                                     // bottom rail
      // bench along the back
      add(BOX(L * 0.55, 0.05, 0.38), COL.bench, L * 0.08, 0.46, D / 2 - 0.3);
      add(BOX(L * 0.55, 0.32, 0.04), COL.bench, L * 0.08, 0.7, D / 2 - 0.12);
      for (const lu of [-L * 0.17, L * 0.33]) add(BOX(0.05, 0.46, 0.34), COL.frame, lu, 0.23, D / 2 - 0.3);
      // glass: the back and the downstream end; the advert panel closes the upstream end
      glass.push([W(0, D / 2), L, yaw, y, H]);
      glass.push([W(L / 2, 0), D, yaw + Math.PI / 2, y, H]);
      add(BOX(0.16, H - 0.25, D * 0.92), COL.frame, -L / 2, (H - 0.25) / 2 + 0.1, 0);
      for (const s of [-1, 1]) {
        // the TOREPOOD poster of all the bus shelters on both faces (Martin, 22 Nov; src/world/adverts.js)
        const ad = new THREE.Mesh(adPlane(D * 0.8, 1.75, POSTER), new THREE.MeshBasicMaterial({ map: adAtlas(), fog: true }));
        const [x, z] = W(-L / 2 + s * 0.085, 0);
        ad.position.set(x, y + 1.2, z);
        ad.rotation.y = yaw + (s < 0 ? -Math.PI / 2 : Math.PI / 2);
        adverts.push(ad);
        // the poster is behind glass that shatters too (Martin, 19 Nov)
        advertGlass.push({ a: W(-L / 2 + s * 0.11, -D * 0.43), b: W(-L / 2 + s * 0.11, D * 0.43), y0: y + 0.28, y1: y + 2.12 });
      }
      shelter = { box: { x: cx, z: cz, yaw, hx: L / 2 + 0.1, hz: D / 2 + 0.1 }, y, H };
      solids.push(...shelterSolids(shelter.box));
    }
    // (the bus stop sign is a prop that snaps off when hit: emajoeProps)

    yield;
    // ---- the garden wall: driveway gate, then the high wall along the map's wall line
    const stone = { pos: [], uv: [] }, flat = { pos: [], col: [] };
    const first = GARDEN_WALL[0];
    const gd = [first[0] - GATE.a[0], first[1] - GATE.a[1]], gl = Math.hypot(gd[0], gd[1]);
    const gu = [gd[0] / gl, gd[1] / gl];
    const postB = [GATE.a[0] + gu[0] * GATE.w, GATE.a[1] + gu[1] * GATE.w];
    const high = [
      { top: HIGH.stone, thick: HIGH.thick, tex: true },
      { top: HIGH.stone + HIGH.render, thick: HIGH.thick - 0.04, colour: COL.render },
      { top: HIGH.stone + HIGH.render + HIGH.cope, thick: HIGH.thick + 0.08, colour: COL.cope, ext: 0.04 },
    ];
    // the new piece from the gate to the map's line keeps clear of the garden building beside it
    const lead = [];
    const n = Math.ceil(Math.hypot(first[0] - postB[0], first[1] - postB[1]) / 2);
    for (let k = 0; k <= n; k++) lead.push([postB[0] + (first[0] - postB[0]) * k / n, postB[1] + (first[1] - postB[1]) * k / n]);
    for (let k = 0; k < lead.length - 1; k++) {
      const a = lead[k], b = lead[k + 1];
      const free = k === lead.length - 2 || world.sdfAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) > 0.6;
      if (!free) continue;
      wallParts([a, b], high, stone, flat);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      solids.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: l / 2 + 0.05, hz: HIGH.thick / 2 });
    }
    // along Kroonuaia the wall is field stone to the top, under red tiles (Street View, Aug 2024)
    const stoneHigh = [
      { top: HIGH.stone + HIGH.render, thick: HIGH.thick, tex: true },
      { top: HIGH.stone + HIGH.render + 0.09, thick: HIGH.thick + 0.26, colour: 0xd98d7f, ext: 0.04 },
      { top: HIGH.stone + HIGH.render + 0.17, thick: HIGH.thick - 0.1, colour: 0xc87868, ext: 0.04 },
    ];
    // in pieces of a few metres, so it stands on the levelled strip along Emajõe (levelEmajoeWall)
    const dense = [];
    for (let k = 0; k < 3; k++) {
      const a = GARDEN_WALL[k], b = GARDEN_WALL[k + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
      for (let j = 0; j < n; j++) dense.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    dense.push(GARDEN_WALL[3]);
    wallParts(dense, high, stone, flat);
    wallParts(GARDEN_WALL.slice(3), stoneHigh, stone, flat);
    wallMeshes(stone, flat);
    yield;
    // brick gate posts with grey caps, and the iron gate between them
    const gyaw = Math.atan2(-gu[1], gu[0]);
    for (const [x, z] of [GATE.a, postB]) {
      const y = world.heightAt(x, z);
      p.box(0.72, 2.75, 0.72, COL.brick, x, y + 1.375 - 0.2, z, gyaw);
      p.box(0.86, 0.14, 0.86, COL.postCap, x, y + 2.62, z, gyaw);
      p.add(new THREE.ConeGeometry(0.5, 0.32, 4).rotateY(Math.PI / 4), COL.postCap, x, y + 2.85, z, gyaw);
      solids.push({ x, z, yaw: gyaw, hx: 0.38, hz: 0.38 });
    }
    {
      const mx = (GATE.a[0] + postB[0]) / 2, mz = (GATE.a[1] + postB[1]) / 2, y = world.heightAt(mx, mz);
      const span = GATE.w - 0.72, bars = 16;
      for (const h of [0.15, 1.05, 1.75]) p.box(span, 0.06, 0.05, COL.iron, mx, y + h, mz, gyaw);
      for (let k = 0; k <= bars; k++) {
        const o = -span / 2 + span * k / bars;
        p.box(0.035, 1.95, 0.035, COL.iron, mx + gu[0] * o, y + 0.97, mz + gu[1] * o, gyaw);
      }
      p.box(0.05, 1.8, 0.05, COL.iron, mx, y + 0.95, mz, gyaw);                          // where the leaves meet
      solids.push({ x: mx, z: mz, yaw: gyaw, hx: span / 2, hz: 0.12 });
    }

    yield;
    const m = p.mesh(solidMat);
    if (m) { m.castShadow = m.receiveShadow = true; group.add(m); }
    // the shelter can be smashed: its glass bursts and its frame bends (src/world/shelter.js)
    const panes = glass.map(([[x, z], w, yaw, y, H]) => {
      const ux = Math.cos(yaw) * w / 2, uz = -Math.sin(yaw) * w / 2;
      return { a: [x - ux, z - uz], b: [x + ux, z + uz], y0: y + 0.15, y1: y + H - 0.1 };
    });
    panes.push(...advertGlass);
    const frame = sp.mesh(solidMat);
    if (frame) { frame.castShadow = frame.receiveShadow = true; group.add(frame); }
    for (const ad of adverts) group.add(ad);
    breakableShelter(world, group, { ...shelter, frame, bendAlso: adverts, panes, glass: 0xcfe6f2, opacity: 0.32 });
    for (const ad of adverts) clickablePoster(ad);
    world.addSolids(solids);
  }

  const ref = track.P[SHELTER.i];
  return {
    drawLowWall,
    update(x, z) {
      if (built || Math.hypot(ref[0] - x, ref[1] - z) > 700) return;
      const pts = [...GARDEN_WALL, GATE.a, track.P[E.i0], track.P[E.i1], track.P[SHELTER.i]];
      if (pts.every(([px, pz]) => world.ready(px, pz))) { built = true; jobs.add(build, 'emajoe'); }
    },
  };
}
