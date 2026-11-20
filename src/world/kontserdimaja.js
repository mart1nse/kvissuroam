// The Vanemuine concert house (Vanemuise 6) along Vanemuise tn (Martin, 20 Nov: "detail the vanemuine part here and
// add also the stairs in high detail. Would be cool if one could ride up the stairs and over the border to the right
// fall on to the road"). From his Street View shots (Aug 2024, Vanemuise 4, 6 and 8) and the map's blocks:
//  - the front block: a grey panelled box with a ribbon of glass, held up on round columns over a terrace;
//  - the terrace, held by a limestone wall along the pavement that grows taller as the street falls, reached from
//    the yard under the north-west end by a ramp, and from the park end by 29 steps in two flights with a landing,
//    limestone cheeks with sloping copings and steel handrails;
//  - the dark ground floor with its glass doors under the columns, the light soffit with round lights, green poster
//    stands, the car park gate with its orange posts and the disabled bay.
// Cars can drive up the ramp or the steps onto the terrace and off its street edge onto the road: the terrace and
// the steps are a deck (world.decks), its wall stops only cars below it (world.addLedges), and the map's building
// block is opened up where the terrace runs under it (world.addOpenings, and `cut` on its triangles).
// The brick box above it with the name is painted in vanemuise.js.
import * as THREE from 'three';
import { areaKit, frame } from './handbuilt.js';
import { BOX, rnd } from '../race/landmarks.js';
import { addHouseColours } from './streetkit.js';
import { paintScale } from './paintscale.js';
import { STONE } from '../race/playtech.js';

// s metres along the street from the house's north-west corner towards the park, v metres across it, into the house
const F = frame([1485.0, 3237.5], [0.770, -0.637]);
const TY = 20.0, SY = 23.9, RY = 28.9;          // the terrace floor, the soffit, the top of the front block
const FV = -0.6, BV = -0.8, GV = 5.6;           // the terrace wall's face, the block's face, the ground floor's wall
const S0 = -0.4, S1 = 40.7, BACK = 19.4;        // the block's ends and its back
const YARD = 19.15;                             // the yard under the north-west end, where the ramp starts
// the steps: 14 up from the forecourt to a landing, 15 more to the terrace, all 29 the same height
const Y0 = 15.2, R = (TY - Y0) / 29, T = 5.5 / 14;
const FOOT = 54.0, LAND = [48.5, 46.6];
const SV0 = -0.1, SV1 = 5.25;                   // between the cheeks (the street cheek from FV, the park one to 5.9)

// the surface a car drives on along the deck (the nosings of the steps, which is what wheels roll on)
function deckY(s) {
  if (s <= 4) return YARD;
  if (s <= 9) return YARD + (TY - YARD) * (s - 4) / 5;
  if (s <= LAND[1] - 14 * T) return TY;
  if (s <= LAND[1]) return TY - (s - (LAND[1] - 14 * T)) / T * R;
  if (s <= LAND[1] + 0.4) return Y0 + 15 * R - (s - LAND[1]) / 0.4 * R;
  if (s <= LAND[0] + T) return Y0 + 14 * R;
  if (s <= FOOT) return Y0 + 14 * R - (s - LAND[0] - T) / T * R;
  if (s <= FOOT + 0.4) return Y0 + R - (s - FOOT) / 0.4 * R;
  return Y0;
}

const box = (s0, s1, v0, v1, extra = {}) => { const [x, z] = F.at((s0 + s1) / 2, (v0 + v1) / 2); return { x, z, yaw: F.YAW, hx: (s1 - s0) / 2, hz: (v1 - v0) / 2, ...extra }; };

// The map's front block (base 1627) is modelled here: its triangles under the brick box go.
export function frontCut(x, z, top) {
  const [s, v] = F.sv(x, z);
  return s > -1 && s < 41.5 && v > -1.2 && v < 20 && top < 29.6;
}
export function kontserdimajaWalls(walls) {
  const [x, z] = F.at(20, 9.5);
  addHouseColours(walls, '3_6', 1120, 3040, [{ base: 1627, x, z, wall: 0xc4c3bf, roof: 0x5d5e63, reach: 25, cut: frontCut }]);
}

// The park's retaining wall in the map runs on along the steps: it stops at their foot, the steps' cheek is built here.
// And the forecourt's 11.6 m road meets Vanemuise at its centre line, where its round end was painted as road over
// the far pavement up to the stone wall, a white arc in the kerb line by the foot of the steps: it ends at the edge.
export function kontserdimajaVectors(vectors) {
  const [ex, ez] = F.at(40.7, 5.0), [nx, nz] = F.at(FOOT + 0.4, 5.1);
  for (const w of vectors.walls || []) {
    const k = w.findIndex((p) => Math.hypot(p[0] - ex, p[1] - ez) < 0.8);
    if (k >= 0) w[k] = [nx, nz];
  }
  const [jx, jz] = F.at(66.1, -7.3), [qx, qz] = F.at(66.6, -4.4);
  for (const r of vectors.roads || []) {
    if (r.w < 11 || r.pts.length < 2) continue;
    const last = r.pts[r.pts.length - 1];
    if (Math.hypot(last[0] - jx, last[1] - jz) < 0.8) r.pts[r.pts.length - 1] = [qx, qz, ...last.slice(2)];
  }
}

// Before the ground is built: the pavements level with the road up to the stone wall across the street and up to the
// terrace wall, the yard level with the pavement, and the ground under the ramp, the terrace and the steps kept below
// them. The terrain model rose in waves towards both walls.
export function levelKontserdimaja(world) {
  const hm = world.meta.height, hn = hm.n, res = hm.res, hs = hm.scale, ho = hm.offset;
  const A = STONE.a, B = STONE.b, L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
  const nx = uz, nz = -ux;                                                     // from the wall line towards the street
  // how far the road's edge is from the wall line, along the wall (from the lap's own edge)
  const EDGE = [[-20.4, 1.64], [-0.1, 1.97], [20.1, 2.29], [40.4, 2.64], [60.8, 3.0], [81.3, 3.37], [101.7, 3.71], [122.4, 3.93], [130, 4.05]];
  const edgeAt = (t) => {
    let k = 0;
    while (k < EDGE.length - 2 && t > EDGE[k + 1][0]) k++;
    const [ta, da] = EDGE[k], [tb, db] = EDGE[k + 1];
    return da + (db - da) * Math.max(0, Math.min(1, (t - ta) / (tb - ta)));
  };
  const roadV = (s) => -5.9 - 1.4 * (s + 9.4) / 75.5;                          // the road's centre line by the house
  const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const box2 = [1430, 3150, 1570, 3275];
  world.onSectorLoad((s) => {
    const H = s.H;
    if (!H) return;
    const span = (hn - 1) * res;
    if (s.x0 > box2[2] || s.x0 + span < box2[0] || s.z0 > box2[3] || s.z0 + span < box2[1]) return;
    const raw = (x, z) => {
      let fx = Math.max(0, Math.min(hn - 1.001, (x - s.x0) / res)), fz = Math.max(0, Math.min(hn - 1.001, (z - s.z0) / res));
      const c = Math.floor(fx), r = Math.floor(fz);
      fx -= c; fz -= r;
      const i = r * hn + c;
      return (H[i] * (1 - fx) + H[i + 1] * fx) * (1 - fz) + (H[i + hn] * (1 - fx) + H[i + hn + 1] * fx) * fz;
    };
    const toRaw = (y) => (y - ho) / hs;
    const edits = [];
    for (let r = 0; r < hn; r++) {
      const z = s.z0 + r * res;
      if (z < box2[1] || z > box2[3]) continue;
      for (let c = 0; c < hn; c++) {
        const x = s.x0 + c * res;
        if (x < box2[0] || x > box2[2]) continue;
        const k = r * hn + c;
        // the stone wall's side: from the road's edge to under the wall flat, then back up to the hill behind it
        const t = (x - A[0]) * ux + (z - A[1]) * uz, d = (x - A[0]) * nx + (z - A[1]) * nz;
        if (t > -2 && t < L + 2) {
          const e = edgeAt(t), behind = 0.36 - d;                           // metres behind the wall's face
          if (d < e - 0.1 && behind < 4.9) {
            const ref = raw(x + nx * (e + 1 - d), z + nz * (e + 1 - d));
            const w = behind <= 2.9 ? 1 : 1 - smooth((behind - 2.9) / 2);
            edits.push([k, H[k] + (ref - H[k]) * w]);
            continue;
          }
        }
        // the house's side
        const [fs, fv] = F.sv(x, z);
        if (fs < -2.5 || fs > 56.5 || fv > GV + 0.5) continue;
        const e = roadV(fs) + 3.8;                                           // the road's edge
        if (fv < e + 0.1) continue;
        const ref = raw(...F.at(fs, e - 1));
        let y = fv <= FV + 1.2 || (fs <= 4 && fv <= GV) ? ref : H[k];
        if (fs >= 3.5 && fs <= FOOT + 0.5 && fv > FV - 0.6) y = Math.min(y, toRaw(deckY(fs) - 0.3));
        edits.push([k, y]);
      }
    }
    for (const [k, v] of edits) H[k] = Math.round(v);
  });
}

// limestone in courses: a 4 x 2 m picture that repeats
function limestone() {
  const k = paintScale(), w = Math.max(128, Math.round(512 * k)), hh = w / 2, ppm = w / 4;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hh;
  const c = cv.getContext('2d');
  c.fillStyle = '#6d665c'; c.fillRect(0, 0, w, hh);
  const r = rnd(41), tones = [[178, 170, 152], [163, 155, 139], [188, 180, 162], [151, 144, 129], [171, 161, 141], [196, 189, 172]];
  let y = 0;
  while (y < 1.99) {
    let ch = 0.13 + r() * 0.17;
    if (y + ch > 1.88) ch = 2 - y;
    let x = -r() * 0.6;
    while (x < 4) {
      const cw = 0.3 + r() * 0.75, t = tones[Math.floor(r() * tones.length)], j = (r() - 0.5) * 16;
      c.fillStyle = `rgb(${(t[0] + j) | 0},${(t[1] + j) | 0},${(t[2] + j * 0.8) | 0})`;
      for (const o of [0, 4]) c.fillRect((x + o) * ppm + 1, y * ppm + 1, cw * ppm - 2, ch * ppm - 2);
      c.fillStyle = 'rgba(60,52,44,0.18)';
      for (const o of [0, 4]) c.fillRect((x + o) * ppm + 1, (y + ch) * ppm - 3, cw * ppm - 2, 2);
      x += cw;
    }
    y += ch;
  }
  for (let n = 0; n < 900; n++) { c.fillStyle = `rgba(${r() < 0.5 ? '70,62,52' : '235,230,220'},${0.08 + r() * 0.1})`; c.fillRect(r() * w, r() * hh, 1 + r() * 3, 1 + r() * 3); }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createKontserdimaja(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const h = (x, z) => world.heightAt(x, z);

  // ---- what cars feel, set up at once (the deck and the walls are data only; the ground waits for the sectors)
  // (stations every 40 cm: a car on a deck finds the first segment that reaches it, and a long one reaches a fifth
  // of its length past its ends)
  const ST = [];
  for (let s = 3.8; s < FOOT + 0.9; s += 0.4) ST.push(s);
  ST.push(FOOT + 0.9);
  const pts = ST.map((s) => { const [x, z] = F.at(s, 2.5), y = deckY(s); return [x, z, y, y]; });
  const ws = ST.map((s) => (s <= S1 ? 3.1 : 2.7));
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
  world.decks.push({ kind: 1, hw: 3.1, pts, ws, rs: null, wall: 0, pr: null, rail: null, w: 0, b: '', name: '', own: true, x0: x0 - 5, z0: z0 - 5, x1: x1 + 5, z1: z1 + 5 });
  const ledges = [box(9, S1, FV, 0, { top: TY + 0.05 })];
  for (let s = S1; s < FOOT + 0.4; s += 0.5) ledges.push(box(s, s + 0.5, FV, SV0, { top: deckY(s + 0.5) + 0.25 }));
  world.addLedges(ledges);
  world.addOpenings([box(-2, 41, -2, GV), box(40.5, FOOT + 0.6, -1.2, SV1)]);
  const COLS = [];
  for (let k = 0; k < 9; k++) COLS.push(3.3 + 4.5 * k);
  world.addSolids([
    ...COLS.map((s) => box(s - 0.36, s + 0.36, 1.2 - 0.36, 1.2 + 0.36)),
    box(S1 + 0.5, FOOT - 0.4, 2.44, 2.56),                                   // the handrail up the middle of the steps
    box(S1, FOOT + 0.4, SV1, 5.9),                                           // the park cheek
    box(4, 9, -0.6, -0.3),                                                   // the ramp's wall and railing
    box(9.6, 12.6, 0.25, 0.75), box(55.6, 57.9, 4.35, 4.85),                 // poster stands
    box(42.3, 42.7, 7.4, 7.8),                                               // the lamp by the steps
    box(-11.75, -11.25, 3.05, 3.55),                                         // the car park gate's post
  ]);
  world.addClearing({ test(x, z) { const [s, v] = F.sv(x, z); return (s > -2 && s < 41 && v > -1.5 && v < 20) || (s > 40 && s < FOOT + 1 && v > -1.5 && v < 6); } });

  let built = false;
  const CENTRE = F.at(25, 5), READY = [F.at(-10, 0), F.at(60, 0), F.at(25, -15), F.at(25, 20)];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const at = F.at;
    // a box in the frame at absolute heights
    const blk = (s0, s1, v0, v1, y0, y1, c) => { const [x, z] = at((s0 + s1) / 2, (v0 + v1) / 2); p.add(BOX(s1 - s0, y1 - y0, v1 - v0), c, x, (y0 + y1) / 2, z, F.YAW); };
    // a bar along s from (sa, ya) to (sb, yb) at v, `t` thick
    const slope = (sa, sb, v, ya, yb, t, tv, c) => {
      const len = Math.hypot(sb - sa, yb - ya), [x, z] = at((sa + sb) / 2, v);
      p.add(BOX(len, t, tv).rotateZ(Math.atan2(yb - ya, sb - sa)), c, x, (ya + yb) / 2, z, F.YAW);
    };
    const gy = (s, v) => h(...at(s, v));

    // ---- limestone faces: the terrace wall, the ramp wall, the cheeks of the steps, the plinth at the park end
    const pos = [], uv = [];
    const quad = (a, b, c, d) => { for (const q of [a, b, c, a, c, d]) { pos.push(q[0], q[1], q[2]); uv.push(q[3], q[4]); } };
    // a face at v from sa to sb: bottom and top heights at both ends
    const faceV = (v, sa, sb, ba, bb, ta, tb) => {
      const [ax, az] = at(sa, v), [bx, bz] = at(sb, v);
      quad([ax, ba, az, sa / 4, ba / 2], [bx, bb, bz, sb / 4, bb / 2], [bx, tb, bz, sb / 4, tb / 2], [ax, ta, az, sa / 4, ta / 2]);
    };
    const faceS = (s, va, vb, b, t) => {
      const [ax, az] = at(s, va), [bx, bz] = at(s, vb);
      quad([ax, b, az, va / 4, b / 2], [bx, b, bz, vb / 4, b / 2], [bx, t, bz, vb / 4, t / 2], [ax, t, az, va / 4, t / 2]);
    };
    const STEP = 1;
    // the terrace wall and the ramp's wall, from under the pavement to the lip
    for (let s = 4; s < S1 - 1e-6; s += STEP) {
      const s1 = Math.min(S1, s + STEP), top = (q) => (q <= 9 ? deckY(q) + 0.3 : TY + 0.1);
      faceV(FV, s, s1, gy(s, FV - 0.3) - 0.4, gy(s1, FV - 0.3) - 0.4, top(s), top(s1));
    }
    // the cheeks of the steps: the street one (its outside and inside), the park one (inside and out)
    const CHEEK = 0.45, KEYS = [S1, LAND[1] - 14 * T, LAND[1], LAND[1] + 0.4, LAND[0] + T, FOOT, FOOT + 0.4];
    const cheek = (s) => (s <= LAND[1] - 14 * T ? TY + CHEEK : deckY(s) + CHEEK);
    for (let i = 0; i < KEYS.length - 1; i++) {
      const sa = KEYS[i], sb = KEYS[i + 1];
      const n = Math.max(1, Math.ceil((sb - sa) / 1));
      for (let j = 0; j < n; j++) {
        const a = sa + (sb - sa) * j / n, b = sa + (sb - sa) * (j + 1) / n;
        faceV(FV, a, b, gy(a, FV - 0.3) - 0.4, gy(b, FV - 0.3) - 0.4, cheek(a), cheek(b));
        faceV(SV0, a, b, deckY(a) - 0.4, deckY(b) - 0.4, cheek(a), cheek(b));
        faceV(SV1, a, b, deckY(a) - 0.4, deckY(b) - 0.4, cheek(a), cheek(b));
        faceV(5.9, a, b, gy(a, 6.3) - 0.4, gy(b, 6.3) - 0.4, cheek(a), cheek(b));
      }
      slope(sa, sb, (FV + SV0) / 2, cheek(sa) + 0.05, cheek(sb) + 0.05, 0.1, 0.62, 0xcbc4b4);      // copings
      slope(sa, sb, (SV1 + 5.9) / 2, cheek(sa) + 0.05, cheek(sb) + 0.05, 0.1, 0.77, 0xcbc4b4);
    }
    const end = FOOT + 0.4;
    faceS(end, FV, SV0, gy(end, -0.4) - 0.4, cheek(end));
    faceS(end, SV1, 5.9, gy(end, 5.5) - 0.4, cheek(end));
    faceS(S1, GV, BACK, Math.min(gy(S1 + 0.5, GV + 1), gy(S1 + 0.5, BACK - 1)) - 0.4, TY);          // the plinth under the glass at the park end
    faceS(4, FV, -0.3, gy(4, FV) - 0.4, YARD + 0.3);
    {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: limestone(), side: THREE.DoubleSide }));
      m.receiveShadow = shadows;
      group.add(m);
    }
    blk(9, S1, FV - 0.04, SV0, TY + 0.1, TY + 0.22, 0xc9c2b2);                // the terrace wall's coping
    for (let s = 4; s < 9; s += 1) slope(s, s + 1, -0.35, deckY(s) + 0.36, deckY(s + 1) + 0.36, 0.1, 0.58, 0xc9c2b2);

    // ---- the terrace, the ramp, the yard
    blk(9, S1, FV, GV, TY - 0.35, TY, 0xa7a39b);
    for (let s = 10.2; s < S1; s += 1.2) blk(s - 0.012, s + 0.012, -0.45, GV, TY, TY + 0.004, 0x8b8780);
    for (let v = 0.6; v < GV; v += 1.2) blk(9, S1, v - 0.012, v + 0.012, TY, TY + 0.004, 0x8b8780);
    slope(4, 9, (-0.3 + GV) / 2, YARD - 0.15, TY - 0.15, 0.3, GV + 0.3, 0x9d9992);
    A.pave(F, S0, 4, FV, GV, 'slabs');
    // the ramp's railing: posts and a sloping rail on the wall
    for (let s = 4.3; s < 9; s += 1.15) { const [x, z] = at(s, -0.35); p.add(BOX(0.05, 1.0, 0.05), 0x80858b, x, deckY(s) + 0.4 + 0.5, z); }
    slope(4, 9, -0.35, YARD + 1.4, TY + 1.4, 0.05, 0.06, 0x80858b);
    slope(4, 9, -0.35, YARD + 0.95, TY + 0.95, 0.03, 0.03, 0x80858b);

    // ---- the steps: treads with darker nosings, the landing
    const CONC = 0xb7b3ab, NOSE = 0x8f8b84;
    for (let k = 0; k < 14; k++) {
      const sh = FOOT - k * T, sl = sh - T, top = Y0 + (k + 1) * R;
      blk(sl, sh, SV0, SV1, top - R - 0.25, top, CONC);
      blk(sh - 0.05, sh, SV0, SV1, top - 0.02, top + 0.005, NOSE);
    }
    blk(LAND[1], LAND[0], SV0, SV1, Y0 + 14 * R - 0.6, Y0 + 14 * R, CONC);
    for (let j = 0; j < 15; j++) {
      const sh = LAND[1] - j * T, sl = sh - T, top = Y0 + (15 + j) * R;
      blk(sl, sh, SV0, SV1, top - R - 0.25, top, CONC);
      blk(sh - 0.05, sh, SV0, SV1, top - 0.02, top + 0.005, NOSE);
    }
    // handrails: a double one up the middle, one along the park cheek; posts every flight's third step
    const STEEL = 0xa3a8ad;
    const rail = (v, sa, sb) => {
      slope(sa, sb, v, deckY(sa) + 0.92, deckY(sb) + 0.92, 0.05, 0.05, STEEL);
      slope(sa, sb, v, deckY(sa) + 0.5, deckY(sb) + 0.5, 0.03, 0.03, STEEL);
    };
    for (const v of [2.44, 2.56, 5.05]) {
      rail(v, S1 + 0.5, LAND[1]); rail(v, LAND[1], LAND[0] + T); rail(v, LAND[0] + T, FOOT - 0.3);
      for (let s = S1 + 0.6; s < FOOT; s += 1.3) { const [x, z] = at(s, v); p.add(BOX(0.05, 0.92, 0.05), STEEL, x, deckY(s) + 0.46, z); }
    }

    // ---- the columns, the front block over them, the soffit and its lights
    for (const s of COLS) {
      const [x, z] = at(s, 1.2), base = s < 9 ? deckY(s) - 0.1 : TY;
      p.add(new THREE.CylinderGeometry(0.33, 0.33, SY - base, 16), 0xbdbcb7, x, (SY + base) / 2, z);
    }
    const PANEL = 0x6c7177, GLASS = 0x5b7287, MULL = 0xc8cacc;
    blk(S0, S1, BV, BACK, SY, RY, PANEL);
    blk(S0 - 0.06, S1 + 0.06, BV - 0.06, BACK + 0.06, RY - 0.05, RY + 0.12, 0x55595e);          // the flashing round the top
    blk(S0 + 0.2, S1 - 0.2, BV + 0.3, BACK - 0.3, RY + 0.12, RY + 0.14, 0x5d5e63);
    // the glass ribbon on the street front, the park end and the yard end, mullions every 1.6 m
    blk(S0 + 0.15, S1 - 0.15, BV - 0.05, BV, 25.0, 27.7, GLASS);
    blk(S0 + 0.1, S1 - 0.1, BV - 0.1, BV - 0.02, 24.88, 25.0, 0x9ea3a8);
    blk(S0 + 0.1, S1 - 0.1, BV - 0.1, BV - 0.02, 27.7, 27.82, 0x9ea3a8);
    for (let s = S0 + 0.15; s <= S1 - 0.1; s += 1.6) blk(s - 0.04, s + 0.04, BV - 0.09, BV - 0.02, 25.0, 27.7, MULL);
    for (const [s, dir] of [[S1, 1], [S0, -1]]) {
      const v1 = dir > 0 ? BACK - 0.3 : 8.0;
      blk(s - (dir > 0 ? 0 : 0.05), s + (dir > 0 ? 0.05 : 0), BV + 0.15, v1, 25.0, 27.7, GLASS);
      for (let v = BV + 0.15; v <= v1; v += 1.6) blk(s - (dir > 0 ? -0.02 : 0.09), s + (dir > 0 ? 0.09 : -0.02), v - 0.04, v + 0.04, 25.0, 27.7, MULL);
    }
    blk(S0, S1, BV, GV, SY - 0.06, SY, 0xd9d8d3);
    const disc = new THREE.CylinderGeometry(0.45, 0.45, 0.03, 18);
    for (let s = 5.5; s < S1; s += 4.5) for (const v of [-0.1, 3.4]) { const [x, z] = at(s, v); p.add(disc, 0x2b2c30, x, SY - 0.07, z); }

    // ---- the ground floor: dark panels with glass doors on the terrace, a service door in the yard; glass at the
    // park end, plain walls at the yard end and the back
    const DARK = 0x43464b, DOOR = 0x55687b, FRAME = 0x2a2c30;
    blk(S0, S1, GV, GV + 0.25, YARD - 0.4, SY, DARK);
    for (const [a, b] of [[13.5, 18.3], [24.0, 29.6], [33.6, 37.4]]) {
      blk(a, b, GV - 0.04, GV, TY + 0.05, TY + 2.9, DOOR);
      for (let s = a; s <= b + 1e-6; s += (b - a) / Math.round((b - a) / 1.2)) blk(s - 0.04, s + 0.04, GV - 0.07, GV - 0.03, TY + 0.05, TY + 2.9, FRAME);
      blk(a - 0.04, b + 0.04, GV - 0.07, GV - 0.03, TY + 2.9, TY + 2.98, FRAME);
    }
    blk(0.8, 3.6, GV - 0.04, GV, YARD, YARD + 3.2, 0x6a6d72);                                      // the yard's roller door
    for (let y = YARD + 0.2; y < YARD + 3.2; y += 0.2) blk(0.8, 3.6, GV - 0.06, GV - 0.04, y, y + 0.02, 0x55585c);
    blk(S1 - 0.05, S1, GV + 0.25, BACK, TY, SY, GLASS);
    for (let v = GV + 1.2; v < BACK; v += 1.6) blk(S1 - 0.01, S1 + 0.04, v - 0.04, v + 0.04, TY, SY, MULL);
    blk(S0 - 0.05, S0 + 0.2, GV, BACK, YARD - 0.4, SY, 0x8b8e92);
    blk(S0, S1, BACK - 0.25, BACK, YARD - 0.4, SY, 0x8b8e92);

    // ---- poster stands (dark green, with a little roof) on the terrace and at the foot of the steps
    const stand = (s, v, y) => {
      for (const e of [-0.62, 0.62]) blk(s + e - 0.04, s + e + 0.04, v - 0.04, v + 0.04, y, y + 2.25, 0x23392c);
      blk(s - 0.6, s + 0.6, v - 0.09, v + 0.09, y + 0.45, y + 2.1, 0x2f4d3b);
      blk(s - 0.5, s + 0.5, v - 0.1, v - 0.09, y + 0.6, y + 1.95, 0xd8d2c4);
      blk(s - 0.72, s + 0.72, v - 0.22, v + 0.22, y + 2.18, y + 2.28, 0x23392c);
    };
    stand(10.4, 0.5, TY); stand(11.8, 0.5, TY);
    stand(56.4, 4.6, gy(56.4, 4.6)); stand(57.1, 4.6, gy(57.1, 4.6));

    // ---- the lamp by the top of the steps: a dark mast with three white globes
    {
      const [x, z] = at(42.5, 7.6), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.07, 0.1, 3.9, 8), 0x2b2c30, x, y + 1.95, z);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; p.add(new THREE.SphereGeometry(0.21, 12, 8), 0xf1f0ea, x + Math.cos(a) * 0.3, y + 4.05, z + Math.sin(a) * 0.3); }
      p.add(new THREE.SphereGeometry(0.23, 12, 8), 0xf1f0ea, x, y + 4.35, z);
    }

    // ---- the car park beside it: the gate's orange posts and red and white arm, the disabled bay
    {
      const [x, z] = at(-11.5, 3.3), y = h(x, z);
      p.add(BOX(0.32, 1.05, 0.32), 0xe2672c, x, y + 0.52, z, F.YAW);
      for (let k = 0; k < 9; k++) { const [ax, az] = at(-11.8 - 0.5 * k - 0.25, 3.3); p.add(BOX(0.5, 0.09, 0.07), k % 2 ? 0xf2f0ec : 0xd2312c, ax, y + 0.9, az, F.YAW); }
      const [qx, qz] = at(-11.5, 6.4);
      p.add(BOX(0.32, 0.9, 0.32), 0xe2672c, qx, h(qx, qz) + 0.45, qz, F.YAW);
      const [bx, bz] = at(-6.5, 3.0), by = h(bx, bz);
      p.add(BOX(2.6, 0.03, 5.0), 0x3d67c8, bx, by + 0.03, bz, F.YAW);
      p.add(BOX(0.9, 0.035, 0.9), 0xf1f1ee, bx, by + 0.04, bz, F.YAW);
      for (let k = 0; k < 4; k++) { const [lx, lz] = at(-4.6, 1.0 + k * 1.2); p.add(BOX(1.1, 0.03, 0.12), 0xe7c53a, lx, h(lx, lz) + 0.03, lz, F.YAW + 0.6); }
    }

    A.finish();
  }

  return {
    update(car) {
      if (built || !car || Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if (READY.every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
