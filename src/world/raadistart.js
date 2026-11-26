// Narva mnt beside the start of the Raadi rally stage (Martin, 26 Nov 2026: "Check the street light and signage
// situation on the left street from ortos etc, seems to be quite a lot of it ... looks to be a kergliiklustee as
// well on the left"), from his three Street View shots off the start lane (June 2023), Mapillary's drives of May
// 2024 in both directions and the Land Board's air photo (lamp posts placed by the foot of their shadows).
// The map had the road as one plain slab with the lines of any four-lane street, Mapillary's lamps doubled and
// its signs scattered. Along 230 m of it, from before the bus stop to the Tartu vald sign:
//  - the street lights: tall galvanised posts with a long bent arm, alternating down both sides about 35 m apart;
//    at the crossing a post with two short arms on the stage's side and a short one on each end of the island's
//    gap; one more with two arms on the island in the mouth of the stub to the park road;
//  - the signs: the crossing's blue squares on its posts (both faces on the island's), keep right on a blue and
//    white striped post at each nose of the middle island, pass either side on the nose of the paved triangle,
//    the crossings of the stub, give way where it meets the road, the shared path's round signs, the lane board
//    on the lamp before the crossing, the 50 on a lamp north of it;
//  - the road: the paved island down the middle with its gap at the zebra, the paved triangle that parts the
//    right-turn lane, the island in the stub's mouth; the hatched taper south of the island, lane and edge lines
//    as they are, the turn lane's box and lines north of it, arrows; zebras in the four places they are;
//  - the light-traffic path along the stage's side: a band of darker, redder tarmac between two strips of
//    grass, as in his shots, and the paving of the pavement and bus bay across the road;
//  - the guard rail along the far side from the crossing north (solid), the blue TARTU vald / RAADI board and the
//    blue TARTU VALD letters on the grass beyond the path.
// Everything stands across Narva mnt from the stage or north of its first corner; nothing is nearer than 6 m to
// the start lane. No street name is painted on the road.
import * as THREE from 'three';
import { areaKit, frame } from './handbuilt.js';
import { paintTexture } from './houseskin.js';
import { markGround, LOOK } from './groundlook.js';
import { surfaceStrip, SURFACE } from './data.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

// s metres north-east along the road from the crossing, v metres across it towards the stage (south-east)
const F = frame([2376.9, 446.6], [0.5966, -0.8026]);
const HEAD = 36.6;                                          // compass bearing of +s
const N_ = HEAD, S_ = HEAD + 180, E_ = HEAD + 90, W_ = HEAD + 270;      // E_: towards the stage, W_: away from it
const S0 = -131, S1 = 100;                                  // the stretch whose lines are painted here
const ZEBRA = 7, CROSSING = 17, YIELD = 15, SHARED = 31, LANES = 33, SPEED50 = 10;
const ROADLAMP = 43, CROSSLAMP = 44, ISLELAMP = 45, KEEPPOST = 46, EITHERPOST = 47;

// ---------------------------------------------------------------- lamps and signs (props: they fall when hit)
const LAMPS = [
  // the stage's side, arms over the road
  [ROADLAMP, -109.2, 9.0, W_], [ROADLAMP, -71.5, 9.0, W_], [ROADLAMP, -37.2, 9.6, W_],
  [CROSSLAMP, -2.1, 11.1, W_],
  [ROADLAMP, 23.8, 13.0, W_], [CROSSLAMP, 23.5, 19.3, S_],                 // on the island in the stub's mouth
  [ROADLAMP, 44.7, 9.6, W_], [ROADLAMP, 77.2, 9.6, W_], [ROADLAMP, 111.6, 9.8, W_],
  // the far side
  [ROADLAMP, -90.1, -5.4, E_], [ROADLAMP, -47.8, -8.7, E_], [ROADLAMP, -13.8, -8.9, E_],
  [ROADLAMP, 21.9, -9.1, E_], [ROADLAMP, 57.5, -8.4, E_], [ROADLAMP, 92.8, -8.4, E_],
  // the crossing's own, either side of the gap in the middle island
  [ISLELAMP, -2.9, 0.0, N_], [ISLELAMP, 2.5, -0.1, S_],
];
// [kind, s, v, the way its face looks, dm above the usual height, on a lamp post (stands just in front of it)]
const SIGNS = [
  [CROSSING, -2.1, 11.1, S_, 0, 1],
  [CROSSING, -2.9, 0.0, S_, 0, 1], [CROSSING, -2.9, 0.0, N_, 0, 1], [CROSSING, 2.5, -0.1, S_, 0, 1], [CROSSING, 2.5, -0.1, N_, 0, 1],
  [CROSSING, 2.3, -9.2, N_], [CROSSING, 2.3, -9.26, S_],
  [SHARED, -5.6, 10.9, S_], [SHARED, -5.6, 10.84, N_], [SHARED, 34.2, 17.4, S_],
  [KEEPPOST, -24.3, -0.1, S_], [KEEPPOST, 17.3, -0.3, N_], [EITHERPOST, 3.0, 7.3, S_], [KEEPPOST, 24.0, 21.7, E_],
  [CROSSING, 12.6, 12.2, S_], [CROSSING, 31.5, 20.7, E_], [CROSSING, 23.5, 19.3, E_, 0, 1], [CROSSING, 23.5, 19.3, W_, 0, 1],
  [YIELD, 34.8, 11.8, E_], [YIELD, 23.8, 13.0, E_, 0, 1],
  [LANES, -71.5, 9.0, S_, 5, 1], [SPEED50, 57.5, -8.4, N_, 9, 1],
];
// [s, v, bearing along the road it crosses, width across that road]
const ZEBRAS = [[-0.35, -4.75, HEAD, 6.6], [-0.35, 5.5, HEAD, 8], [17.0, 17.8, E_, 5], [27.8, 17.8, E_, 6.4]];

export function raadiStartProps() {
  const out = [];
  const r2 = (v) => Math.round(v * 100) / 100;
  for (const [kind, s, v, b] of LAMPS) { const [x, z] = F.at(s, v); out.push([kind, r2(x), r2(z), b % 360]); }
  for (const [kind, s, v, b, up = 0, onPost = 0] of SIGNS) {
    const a = b * Math.PI / 180, d = onPost ? 0.13 : 0, [x, z] = F.at(s, v);
    out.push([kind, r2(x + Math.sin(a) * d), r2(z - Math.cos(a) * d), b % 360, up]);
  }
  for (const [s, v, b, w] of ZEBRAS) { const [x, z] = F.at(s, v); out.push([ZEBRA, r2(x), r2(z), b % 360, w]); }
  return out;
}

// what the survey put along this stretch (its lamps, signs and zebras) makes way; the start lane's side beyond
// the path and the bus stop's lamp north of the stub stay as they are
const inStretch = (s, v) => s > S0 && s < 125 && v > -14 && v < (s < 40 ? 27 : 13);
export function raadiStartClear(data) {
  const out = [];
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      const x = a[k + 1], z = a[k + 2];
      if (x < 2250 || x > 2500 || z < 320 || z > 580) continue;
      const [s, v] = F.sv(x, z);
      if (inStretch(s, v)) out.push(`${key}:${k / data.stride}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- lines on the road, the path
const lerpAt = (pts, s) => {
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) if (s <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (s - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
  return pts[pts.length - 1][1];
};
// the two sides of the hatched taper south of the middle island, and the edges of the road
const HATCH_L = [[-88, 0.3], [-70, -0.3], [-50, -0.9], [-24.6, -1.2]], HATCH_R = [[-88, 0.3], [-70, 0.9], [-24.6, 1.0]];
const EDGE_W = [[S0, -2.7], [-90, -4.5], [-58, -7.65], [-3, -7.65]], EDGE_E = [[S0, 7.9], [-60, 8.6], [-20, 9.3], [-3, 9.4]];

// the light-traffic path on the stage's side: its middle, south of the crossing and on across the stub's zebras,
// and north of the stub; 2.6 m of tarmac. The grass between it and the road is stamped as grass for the tyres.
const PATH_S = [[-153, 11.3], [-59.5, 12.7], [-8, 13.6], [-2.5, 13.8], [2, 14.9], [7, 16.9], [11, 17.7], [14.4, 17.8]];
const PATH_N = [[31.1, 17.9], [34, 19.3], [38, 20.0], [125, 20.0]];
const PATH_W = 2.6;
surfaceStrip([[S0, 10.0], [-60, 10.5], [-8, 11.0]].map(([s, v]) => F.at(s, v)), 0.6, SURFACE.GRASS);

export function raadiStartVectors(vectors) {
  // the roads of the stretch keep their own lines only outside it
  const outside = (x, z) => { const [s, v] = F.sv(x, z); return s < S0 || s > S1 || v < -12 || v > 26; };
  for (const r of vectors.roads) {
    if (r.pts.length < 2 || r.s === 2 || r.s === 3) continue;
    if (!r.pts.some(([x, z]) => x > 2250 && x < 2470 && z > 350 && z < 580 && !outside(x, z))) continue;
    if (r.type === 'Tänav') r.markKeep = outside;
    // the path along the stage's side: the map bends it towards the road south of the bus stop (1.5 m too near
    // at one corner); it runs straight
    if (r.type === 'Kergliiklustee') for (const q of r.pts) if (Math.hypot(q[0] - 2308.5, q[1] - 555.2) < 0.3) [q[0], q[1]] = F.at(-128, 11.6);
  }
  const L = (vectors.extraLines ||= []);
  const seg = (s0, v0, s1, v1) => { const a = F.at(s0, v0), b = F.at(s1, v1); L.push(a[0], a[1], b[0], b[1]); };
  // a line along s whose v is read off a list of [s, v], solid or in dashes
  const run = (pts, s0, s1, on = 4, off = 0) => {
    for (let s = s0; s + on <= s1 + 0.01; s += on + off) seg(s, lerpAt(pts, s), s + on, lerpAt(pts, s + on));
  };
  // ---- south of the crossing
  run(EDGE_W, S0, -3); run(EDGE_E, S0, -3);
  run([[-90, -3.5], [-45, -4.7], [-3, -4.7]], -90, -4, 3, 6);                    // the far carriageway's lanes
  run([[S0, 4.4], [-30, 4.5]], S0, -31, 3, 6);                                   // this side's, then solid to the zebra
  run([[-28, 5.1], [-2.4, 5.3]], -28, -2.6, 3.2);
  run(HATCH_L, -88, -24.6, 3.17); run(HATCH_R, -88, -24.6, 3.17);
  for (let s = -84; s + 2 < -25; s += 3) {
    const a = lerpAt(HATCH_L, s), b = lerpAt(HATCH_R, s + 2);
    if (b - a > 0.5) seg(s, a, s + 2, b);
  }
  // ---- beside the middle island (broken at the zebra) and round the paved triangle
  for (const v of [-1.5, 1.3]) { run([[0, v]], -24.5, -2.5, 3.667); run([[0, v]], 1.6, 17.2, 3.9); }
  seg(2.3, 5.4, 18.6, 5.4);
  // ---- north of it: the dotted line across the stub's mouth, the box before the turn lane, the turn lane
  run([[12, -1.3], [33, -1.0]], 18, 33, 1, 1);
  run([[0, -1.0]], 33, 66, 3.3); run([[0, -1.0]], 66, S1, 3, 3);
  seg(33, -1.0, 33, 2.6);
  run([[33, 2.6], [50, 2.9]], 33, S1, 3.35);
  run([[22, 5.9], [60, 6.6], [100, 6.8]], 22, 38, 1, 1); run([[22, 5.9], [60, 6.6], [100, 6.8]], 40, S1, 3, 6);
  run([[41, 8.9], [60, 9.2]], 41, S1, 3.9);                                      // the edges
  run([[4, -7.6], [40, -7.4], [100, -6.6]], 4, S1, 4);
}

// ---------------------------------------------------------------- the islands, the rail, the board, the letters
const KERB = 0xd2cfd8, PINK = 0xd9b3ae, TARMAC = 0x978b8c, RAIL_TO = 188;
const RAIL = [[4.5, -8.5], [40, -8.1], [100, -7.4], [RAIL_TO, -7.4]];

export function createRaadiStart(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  const rail = RAIL.map(([s, v]) => F.at(s, v));
  world.addSolids(rail.slice(1).map((b, i) => {
    const a = rail[i], dx = b[0] - a[0], dz = b[1] - a[1];
    return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-dz, dx), hx: Math.hypot(dx, dz) / 2, hz: 0.12 };
  }));

  function* build() {
    const A = areaKit(world, group, { shadows }), { p, h, K } = A;
    // ---- the middle island: kerb stones and pink paving, level with the road where the zebra goes through
    const slab = (s0, s1, v0, v1) => {
      A.box(F, (s0 + s1) / 2, (v0 + v1) / 2, s1 - s0, v1 - v0, -0.15, 0.13, KERB);
      A.box(F, (s0 + s1) / 2, (v0 + v1) / 2, s1 - s0 - 0.3, v1 - v0 - 0.3, 0.13, 0.15, PINK);
    };
    const nose = (s, v, r) => { const [x, z] = F.at(s, v), y = h(x, z); p.add(new THREE.CylinderGeometry(r, r, 0.28, 12), KERB, x, y - 0.01, z); p.add(new THREE.CylinderGeometry(r - 0.15, r - 0.15, 0.02, 12), PINK, x, y + 0.14, z); };
    slab(-23.4, -2.3, -1.25, 1.05); nose(-23.4, -0.1, 1.15);
    slab(1.4, 16.3, -1.25, 1.05); nose(16.3, -0.1, 1.15);
    K.ribbon(F, -2.3, 1.4, -1.25, 1.05, 'red', true);
    yield;
    // ---- the paved triangle between the lane straight on and the turn into the stub; the island in the stub
    const TRI = [[2.3, 5.6], [5.5, 6.6], [9.5, 7.9], [13.2, 9.2], [16.4, 9.5], [18.4, 5.6]];
    K.ribbon(F, 2.3, 18.4, 5.6, (s) => lerpAt(TRI, s), 'red', true);
    for (let i = 0; i < TRI.length; i++) A.bar(F.at(...TRI[i]), F.at(...TRI[(i + 1) % TRI.length]), 0.16, -0.1, 0.12, KERB);
    const G = frame(F.at(22.7, 11.1), F.V), half = (t) => 2.3 * Math.min(1, (t + 0.4) / 1.6, (11.9 - t) / 1.6);
    K.ribbon(G, 0, 11.5, (t) => -half(t), half, 'red', true);
    for (const k of [-1, 1]) for (let t = 0; t < 11.5; t += 2.3) A.bar(G.at(t, k * half(t)), G.at(t + 2.3, k * half(Math.min(11.5, t + 2.3))), 0.16, -0.1, 0.12, KERB);
    for (const t of [0, 11.5]) A.bar(G.at(t, -half(t)), G.at(t, half(t)), 0.16, -0.1, 0.12, KERB);
    // ---- the pavement and bus bay across the road
    K.ribbon(F, -58, 4, -10.3, -8.1, 'paver', true);
    yield;
    // ---- the light-traffic path: kerb stones along the road, a strip of grass, the path's own darker tarmac
    const edge = (s) => lerpAt(EDGE_E, s) + 0.3, mid = (s) => lerpAt(PATH_S, s);
    K.ribbon(F, S0, -3, edge, (s) => edge(s) + 0.28, 'kerb', true);
    K.ribbon(F, S0, -3.2, (s) => edge(s) + 0.28, (s) => mid(s) - PATH_W / 2, 'lawn', true);
    K.ribbon(F, S0, -9, (s) => mid(s) + PATH_W / 2, (s) => mid(s) + PATH_W / 2 + 0.9, 'lawn', true);
    const tar = [];
    const strip = (pts, w, s0, s1, step = 2) => {
      const at = (s, k) => {
        const d = (lerpAt(pts, s + 0.5) - lerpAt(pts, s - 0.5)), l = Math.hypot(1, d), [x, z] = F.at(s - k * w / 2 * d / l, lerpAt(pts, s) + k * w / 2 / l);
        return [x, h(x, z) + 0.07, z];
      };
      for (let s = s0; s < s1 - 0.01; s += step) {
        const t = Math.min(s1, s + step), q = [at(s, -1), at(s, 1), at(t, -1), at(t, 1)];
        for (const k of [0, 1, 2, 2, 1, 3]) tar.push(...q[k]);
      }
    };
    strip(PATH_S, PATH_W, S0, 14.4); strip(PATH_N, PATH_W, 31.1, 125);
    { // the short piece from the path to the kerb at the zebra
      const q = [[-2.3, 9.75], [-2.3, 12.6], [1.5, 9.75], [1.5, 13.4]].map(([s, v]) => { const [x, z] = F.at(s, v); return [x, h(x, z) + 0.07, z]; });
      for (const k of [0, 1, 2, 2, 1, 3]) tar.push(...q[k]);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tar, 3));
    const up = new Float32Array(tar.length); for (let k = 1; k < up.length; k += 3) up[k] = 1;
    tg.setAttribute('normal', new THREE.BufferAttribute(up, 3));
    const tm = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: TARMAC, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide }));
    tm.receiveShadow = true;
    group.add(tm);
    markGround(tar, LOOK.PAVED, 0.07);
    yield;
    // ---- arrows: straight on and "move over to the left" before the crossing, left turn and straight on north of it
    const arrow = (s, v, dir, bend = 0) => {
      // dir: +1 pointing north-east; bend: the head leans that many metres towards +v over its length
      const a = s, b = s + dir * 2.2, c = s + dir * 3.6;
      K.ribbon(F, a, b, v - 0.09, v + 0.09, 'white', true);
      if (!bend) { K.ribbon(F, b, c, (t) => v - 0.32 * (c - t) / (c - b), (t) => v + 0.32 * (c - t) / (c - b), 'white', true); return; }
      const m = (t) => v + bend * (t - b) / (c - b);
      K.ribbon(F, b, b + (c - b) * 0.55, (t) => m(t) - 0.09, (t) => m(t) + 0.09, 'white', true);
      const d = b + (c - b) * 0.55;
      K.ribbon(F, d, c, (t) => m(t) - 0.34 * (c - t) / (c - d), (t) => m(t) + 0.34 * (c - t) / (c - d), 'white', true);
    };
    for (const s of [-70, -50, -30.5]) { arrow(s, 2.9, 1); arrow(s, 7.0, 1, -1.5); }
    for (const s of [68, 91]) { arrow(s, 0.9, -1, 1.5); arrow(s, -3.4, -1); }
    yield;
    // ---- the guard rail along the far side, from the crossing to the next junction north
    A.guardrail(rail);
    yield;
    // ---- the blue board (TARTU vald / RAADI) and the blue letters on the grass beyond the path, on one picture
    const BW = 1.9, BH = 0.82, LW = 8.8, LH = 1.3, PW = LW, PH = BH + LH + 0.06;
    const tex = paintTexture(PW, 0, PH, 44, (P) => {
      const SANS = '700 %px Arial, Helvetica, sans-serif';
      P.r(0, LH + 0.06, BW, PH, '#f4f4f6'); P.r(0.03, LH + 0.09, BW - 0.03, PH - 0.03, '#1f5fb8');
      P.r(0.1, LH + 0.5, 0.36, LH + 0.76, '#f4f4f6');                                      // the commune's emblem box
      P.text('TARTU vald', 1.1, LH + 0.63, 0.25, '#ffffff', SANS);
      P.r(0.06, LH + 0.44, BW - 0.06, LH + 0.455, '#ffffff');
      P.text('RAADI', BW / 2, LH + 0.25, 0.27, '#ffffff', SANS);
      P.text('TARTU VALD', LW / 2, LH / 2, 1.52, '#2a66c8', '900 %px Arial, Helvetica, sans-serif');
    }, { alpha: true });
    const pos = [], uv = [];
    // a standing rectangle from map point a to b, y0..y1, showing the picture's u0..u1, v0..v1 (both faces)
    const sheet = (a, b, y0, y1, u0, u1, w0, w1) => {
      const q = [[a[0], y0, a[1], u0, w0], [b[0], y0, b[1], u1, w0], [a[0], y1, a[1], u0, w1], [b[0], y1, b[1], u1, w1]];
      for (const k of [0, 1, 2, 2, 1, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4]); }
    };
    { // the board, for those driving north: on two posts beyond the kerb
      const a = F.at(69, 10.3), b = F.at(69, 10.3 + BW), y = h(...F.at(69, 11.2));
      sheet(a, b, y + 1.95, y + 1.95 + BH, 0, BW / PW, (LH + 0.06) / PH, 1);
      for (const q of [F.at(69.05, 10.55), F.at(69.05, 11.95)]) p.box(0.07, 2.8, 0.07, 0x9a9da4, q[0], y + 1.4, q[1], F.YAW);
      A.box(F, 69.04, 11.25, 0.03, BW, 1.95, 1.95 + BH, 0x9a9da4, y);
    }
    { // the letters: 8.8 m of them, from by the path out across the grass, read from the south
      const a = F.at(108.4, 26.2), b = F.at(104.4, 34.0), y = Math.min(h(...a), h(...b));
      sheet(a, b, y + 0.05, y + 0.05 + LH, 0, 1, 0, LH / PH);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })));
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - F.O[0], car.z - F.O[1]) > 520) return;
      if (![[-100, 0], [0, 0], [100, 0]].every(([s, v]) => world.ready(...F.at(s, v)))) return;
      built = true;
      jobs.add(build, 'raadi start street');
    },
  };
}
