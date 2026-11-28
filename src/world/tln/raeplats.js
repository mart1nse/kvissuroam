// Tallinn's Raekoja plats and its town hall (Martin's landmark list, 28 Nov 2026), from Mapillary photos of the
// square (July 2022 front on, 2019 and 2014 Christmas markets, 2025 from Vana turg), the LOD2 model and OpenStreetMap:
//   - the town hall keeps its LOD2 body (roof, the west end's stepped gable) with plain walls, and gets what the photo
//     of its front shows: the arcade of eight pointed arches with the small door and the big portal at the west end,
//     the hall's windows (small ones east, pairs of tall traceried ones west), the clock, the crenellated parapet with
//     its corner piers, three chimneys and the two flags; its dark tiled roof is set in centre.js LANDMARKS;
//   - the tower (64 m, 4.5 m in from the east end): the octagonal shaft over the roof, two tiers of slit windows, the
//     corbelled top and the gallery, the open lantern, the two bulbs of the late Renaissance spire, the needle and
//     Vana Toomas with his flag on the top;
//   - the Christmas market (?xmas=0 hides it): the spruce in the middle with warm lights and red baubles, about forty
//     pine huts with burgundy roofs in two rings round it, the aisle between them wide enough to drive, garlands of
//     green with bulbs along every eave, and strings of bulbs from ten poles to the tree.
// Built in steps through the work queue when the car comes within 450 m; the huts, poles and the tree's fence are
// solid from the start.
import * as THREE from 'three';
import { Parts } from '../../race/landmarks.js';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { xmasTree } from '../xmastree.js';

// the town hall's front on the square: its east corner, its west corner (the square on the left going west)
const EAST = [-5686.1, 2967.0], WEST = [-5721.4, 2955.6], DEPTH = 15.4;
const HALL_KEY = '-8_5', HALL_BASE = 1325;                      // its LOD2 house in that map square
const EAVES = 13.3;                                             // the wall top behind the parapet (LOD2)
const TOWER = { s: 4.5, n: -6.6 };
const TREE = [-5708, 2927];
const XMAS = typeof location === 'undefined' || !/[?&]xmas=0/.test(location.search);
// the square's outline (OpenStreetMap), the huts stay 4 m inside it
const SQUARE = [[-5759.0, 2903.1], [-5712.1, 2896.8], [-5664.1, 2889.2], [-5667.8, 2913.2], [-5670.9, 2933.1], [-5674.5, 2955.8],
  [-5675.7, 2969.5], [-5723.2, 2954.7], [-5728.4, 2970.1], [-5739.9, 2966.4], [-5746.5, 2958.6], [-5756.6, 2931.9], [-5755.1, 2928.2]];

const COL = {
  stone: 0xd9d3c9, stoneDark: 0xbcb5ab, glass: 0x3d3b52, recess: 0x4a4554, door: 0x5a3e38, clock: 0xf6f2e8, clockRing: 0x4b6aa6,
  copper: 0x3b4a47, iron: 0x2e2c36, gold: 0xf0cf7a, chimney: 0xe8e3dc, pole: 0xf2f0ee,
  pine: [0xe4bf8c, 0xd9b07a, 0xeacb98], roof: [0x7c2f36, 0x6e2a33, 0x86393a], garland: 0x2f5c44, lamp: 0xfff0c4, warm: 0xffc27a,
};

const inPoly = (x, z, r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const edgeDist = (x, z, r) => {
  let d = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[j], b = r[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    d = Math.min(d, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return d;
};

// the huts: [x, z, yaw] (local +z is the side they sell from). Two squares of straight rows round the tree, set square
// to the town hall: the inner one selling outward, the outer one inward across a 6.8 m aisle, a way in through the
// middle of every side and at the corners
const HUT_W = 3.0, HUT_D = 2.2;
const HALL_U = (() => { const l = Math.hypot(WEST[0] - EAST[0], WEST[1] - EAST[1]); return [(WEST[0] - EAST[0]) / l, (WEST[1] - EAST[1]) / l]; })();
function huts() {
  const out = [], [ux, uz] = HALL_U, nx = -uz, nz = ux;            // u: along the hall to the west, n: north, away from it
  const put = (a, b, fa, fb) => {
    const x = TREE[0] + ux * a + nx * b, z = TREE[1] + uz * a + nz * b;
    if (!inPoly(x, z, SQUARE) || edgeDist(x, z, SQUARE) < 4.2) return;
    out.push([x, z, Math.atan2(ux * fa + nx * fb, uz * fa + nz * fb)]);
  };
  // a row from a0 to a1 at b (or, across, from b0 to b1 at a), a gap of `gap` in its middle, `corner` clear at the ends
  const row = (from, to, at, along, face, gap, corner) => {
    const len = to - from - corner * 2, n = Math.floor((len - gap) / 2 / (HUT_W + 0.15));
    for (const side of [-1, 1]) for (let k = 0; k < n; k++) {
      const t = (from + to) / 2 + side * (gap / 2 + (HUT_W + 0.15) * (k + 0.5));
      along ? put(t, at, face[0], face[1]) : put(at, t, face[0], face[1]);
    }
  };
  row(-8.5, 8.5, 8.2, true, [0, 1], 5, 1.2); row(-8.5, 8.5, -8.2, true, [0, -1], 5, 1.2);
  row(-7.5, 7.5, 9.6, false, [1, 0], 5, 0.4); row(-7.5, 7.5, -9.6, false, [-1, 0], 5, 0.4);
  row(-21, 21, 16.2, true, [0, -1], 7, 3); row(-21, 21, -17.5, true, [0, 1], 7, 3);
  row(-15, 14, 22.5, false, [-1, 0], 7, 1.5); row(-15, 14, -22, false, [1, 0], 7, 1.5);
  return out;
}
// ten poles for the strings of bulbs, just outside the outer rows
const POLES = Array.from({ length: 10 }, (_, k) => {
  const a = ((k + 0.25) / 10) * Math.PI * 2, r = 26;
  return [TREE[0] + Math.cos(a) * r * 0.95, TREE[1] + Math.sin(a) * r * 0.8];
}).filter(([x, z]) => inPoly(x, z, SQUARE) && edgeDist(x, z, SQUARE) > 1.5);

// the town hall's house: plain walls (its windows are drawn here), dark tiles
export function raeplatsWalls(walls) {
  const a = walls && walls.sectors && walls.sectors[HALL_KEY];
  if (!a) return;
  const extra = ((walls.extra ||= {})[HALL_KEY] ||= {});
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] === HALL_BASE && Math.hypot(a[i + 1] / 10 - 5920 + 5705, a[i + 2] / 10 + 2400 - 2968) < 20) { extra[i / 4] = { ...extra[i / 4], plain: true, reach: 30 }; a[i + 3] = (a[i + 3] & 0x1000000) | 0xcfc8bc; }
  }
}
// the map's own lamps, benches and bins in the market make way
export function raeplatsClear(data) {
  const out = new Set();
  if (!XMAS) return out;
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) if (Math.hypot(a[k + 1] - TREE[0], a[k + 2] - TREE[1]) < 25.5) out.add(`${key}:${k / data.stride}`);
  }
  return out;
}

export function createRaeplats(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const HUTS = XMAS ? huts() : [];
  if (XMAS) {
    const solids = HUTS.map(([x, z, yaw]) => ({ x, z, yaw, hx: HUT_W / 2, hz: HUT_D / 2 + 0.1 }));
    for (const [x, z] of POLES) solids.push({ x, z, yaw: 0, hx: 0.14, hz: 0.14 });
    solids.push({ x: TREE[0], z: TREE[1], yaw: 0, hx: 3.6, hz: 3.6 });
    world.addSolids(solids);
  }

  // the front's frame: s from the east corner westward, n out onto the square, y up from the arcade's floor
  const L = Math.hypot(WEST[0] - EAST[0], WEST[1] - EAST[1]), ux = (WEST[0] - EAST[0]) / L, uz = (WEST[1] - EAST[1]) / L;
  const at = (s, n) => [EAST[0] + ux * s - uz * n, EAST[1] + uz * s + ux * n];
  const YAW = Math.atan2(-uz, ux);

  function* build() {
    const h = (x, z) => world.heightAt(x, z);
    const p = new Parts(), glow = new Parts();
    const Y0 = Math.min(h(...at(1, 1)), h(...at(L / 2, 1)), h(...at(L - 1, 1)));
    // a box in the front's frame
    const B = (s0, s1, n0, n1, y0, y1, hex, parts = p) => { const [x, z] = at((s0 + s1) / 2, (n0 + n1) / 2); parts.box(s1 - s0, y1 - y0, n1 - n0, hex, x, Y0 + (y0 + y1) / 2, z, YAW); };
    // a flat shape on the front (x along s, y up), n out
    const F = (geo, hex, s, n, y, parts = p) => { const [x, z] = at(s, n); parts.add(geo, hex, x, Y0 + y, z, YAW); };
    const arch = (w, spring, rise) => {           // a pointed arch's opening, w wide, its feet at 0
      const sh = new THREE.Shape(), R = w * 0.7, cx = -w / 2 + R;
      sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, spring);
      const top = Math.acos(-cx / R);
      for (let k = 1; k <= 6; k++) { const t = Math.PI - (Math.PI - top) * (k / 6); sh.lineTo(cx + Math.cos(t) * R, spring + Math.sin(t) * R * (rise / (R * Math.sin(top)))); }
      for (let k = 5; k >= 0; k--) { const t = Math.PI - (Math.PI - top) * (k / 6); sh.lineTo(-(cx + Math.cos(t) * R), spring + Math.sin(t) * R * (rise / (R * Math.sin(top)))); }
      sh.lineTo(w / 2, 0);
      return new THREE.ShapeGeometry(sh);
    };

    // ---- the arcade: eight pointed arches from the east end, framed in lighter stone, with piers
    const A1 = arch(2.5, 2.3, 1.5), A1f = arch(2.95, 2.3, 1.75);
    const ARCH_S = [1.9, 5.2, 8.4, 11.7, 15.2, 19.0, 22.7, 26.8];
    for (const s of ARCH_S) { F(A1f, COL.stone, s, 0.05, 0); F(A1, COL.recess, s, 0.08, 0); }
    for (let k = 0; k <= ARCH_S.length; k++) {
      const s = k === 0 ? 0.35 : k === ARCH_S.length ? 28.6 : (ARCH_S[k - 1] + ARCH_S[k]) / 2;
      B(s - 0.32, s + 0.32, 0, 0.22, -0.4, 3.0, COL.stoneDark);
    }
    B(-0.1, L + 0.1, 0, 0.12, -0.4, 0.25, COL.stoneDark);                 // the plinth
    B(-0.1, L + 0.1, 0, 0.16, 4.15, 4.35, COL.stone);                      // a string course over the arches
    // the small door and the big portal at the west end
    B(29.9, 31.1, 0, 0.06, 0, 2.4, COL.door);
    F(arch(3.5, 3.0, 1.9), COL.stone, 33.9, 0.05, 0); F(arch(2.8, 3.0, 1.6), COL.door, 33.9, 0.09, 0);
    B(33.85, 33.95, 0.09, 0.11, 0, 3.0, 0x3a2a28);

    // ---- the hall's windows: small single ones in the east part, pairs of tall traceried ones in the west
    const win = (s, w, y0, y1, mullion) => {
      B(s - w / 2 - 0.18, s + w / 2 + 0.18, 0, 0.07, y0 - 0.2, y1 + 0.18, COL.stone);
      B(s - w / 2, s + w / 2, 0.07, 0.09, y0, y1, COL.glass);
      if (mullion) { B(s - 0.05, s + 0.05, 0.09, 0.12, y0, y1, COL.stone); for (const f of [0.33, 0.66]) B(s - w / 2, s + w / 2, 0.09, 0.12, y0 + (y1 - y0) * f - 0.04, y0 + (y1 - y0) * f + 0.04, COL.stone); }
    };
    for (const s of [2.8, 5.6, 10.2, 12.5, 14.9]) win(s, 0.9, 5.5, 7.6, false);
    for (const s of [19.2, 21.3, 24.8, 27.0, 30.7]) win(s, 1.35, 5.9, 9.3, true);
    // the clock between the rows and the parapet
    { const [x, z] = at(15.0, 0.07); p.add(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 20).rotateX(Math.PI / 2), COL.clockRing, x, Y0 + 11.6, z, YAW);
      const [x2, z2] = at(15.0, 0.11); p.add(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 20).rotateX(Math.PI / 2), COL.clock, x2, Y0 + 11.6, z2, YAW);
      B(14.97, 15.03, 0.13, 0.15, 11.6, 12.05, COL.iron); B(15.0, 15.33, 0.13, 0.15, 11.57, 11.63, COL.iron); }
    yield;

    // ---- the parapet: a band on corbels, merlons on it, front and back; tall piers at the front corners
    for (const [n0, n1] of [[-0.45, 0.2], [-DEPTH - 0.2, -DEPTH + 0.45]]) {
      B(-0.1, L + 0.1, n0, n1, EAVES - 0.5, EAVES + 0.7, COL.stone);
      B(-0.1, L + 0.1, n1 - 0.02, n1 + 0.04, EAVES - 0.62, EAVES - 0.5, COL.stoneDark);
      for (let s = 1.0; s < L - 0.5; s += 2.3) B(s - 0.6, s + 0.6, n0 + 0.05, n1 - 0.05, EAVES + 0.7, EAVES + 1.6, COL.stone);
    }
    for (const s of [0.45, L - 0.45]) B(s - 0.45, s + 0.45, -0.7, 0.2, EAVES - 0.5, EAVES + 3.2, COL.stone);
    // three chimneys on the front slope and two flags on the parapet (Estonia's, Tallinn's)
    const roofAt = (n) => EAVES + (-n) * 1.72;
    for (const s of [11.1, 19.5]) B(s - 0.4, s + 0.4, -4.9, -4.1, roofAt(-4.1) - 0.5, roofAt(-4.9) + 1.5, COL.chimney);
    B(34.8, 35.6, -9.2, -8.4, roofAt(-7.7) - 1, roofAt(-7.7) + 1.4, COL.chimney);
    const flag = (s, stripes) => {
      B(s - 0.04, s + 0.04, 0.0, 0.08, EAVES + 0.7, EAVES + 4.4, COL.pole);
      const n = stripes.length, hh = 1.0 / n;
      stripes.forEach((c, k) => { const [x, z] = at(s + 0.85, 0.04); p.box(1.6, hh, 0.03, c, x, Y0 + EAVES + 4.3 - hh * (k + 0.5), z, YAW + 0.35); });
    };
    flag(14.5, [0x2f7fd6, 0x1d1c22, 0xf8f8f6]);
    flag(17.0, [0x2f7fd6, 0xf8f8f6, 0x2f7fd6, 0xf8f8f6, 0x2f7fd6, 0xf8f8f6, 0x2f7fd6, 0xf8f8f6]);
    yield;

    // ---- the tower
    const [tx, tz] = at(TOWER.s, TOWER.n), TY = Y0;
    const oct = (r0, r1, y0, y1, hex, parts = p) => parts.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, 8), hex, tx, TY + (y0 + y1) / 2, tz, YAW - Math.PI / 8);
    oct(2.3, 2.3, 10, 31.6, COL.stone);
    // slit windows in two tiers on each face, and the corbelled top with its little arches
    // (a face of these octagons looks out at YAW + k/8 of a turn: its way out is (sin, cos) of that)
    for (let k = 0; k < 8; k++) {
      const f = YAW + (k / 8) * Math.PI * 2, ox = Math.sin(f), oz = Math.cos(f);
      for (const [y0, y1, r] of [[26.2, 27.9, 2.14], [32.6, 33.8, 2.45]]) p.box(0.32, y1 - y0, 0.08, COL.glass, tx + ox * r, TY + (y0 + y1) / 2, tz + oz * r, f);
      for (const d of [-0.42, 0.42]) p.box(0.5, 0.42, 0.1, COL.stoneDark, tx + ox * 2.17 + oz * d, TY + 31.3, tz + oz * 2.17 - ox * d, f);
    }
    oct(2.3, 2.62, 31.6, 32.2, COL.stone);
    oct(2.62, 2.62, 32.2, 34.3, COL.stone);
    oct(2.95, 2.95, 34.3, 34.6, COL.stoneDark);                           // the gallery's floor
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; p.box(0.06, 0.95, 0.06, COL.iron, tx + Math.cos(a) * 2.88, TY + 35.08, tz + Math.sin(a) * 2.88); }
    p.add(new THREE.TorusGeometry(2.88, 0.05, 4, 24).rotateX(Math.PI / 2), COL.iron, tx, TY + 35.55, tz);
    // the lantern: an octagon of piers round a dark core, a cornice
    oct(1.55, 1.55, 34.6, 39.0, COL.iron);
    for (let k = 0; k < 8; k++) { const f = YAW + Math.PI / 8 + (k / 8) * Math.PI * 2; p.box(0.32, 4.4, 0.32, COL.stone, tx + Math.sin(f) * 1.75, TY + 36.8, tz + Math.cos(f) * 1.75, f); }
    oct(2.0, 2.0, 39.0, 39.5, COL.stone);
    // the spire: a bell, an open lantern, a second bulb, the needle with a gold ball, and Vana Toomas
    const lathe = (prof, y0, hex) => { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 8); p.add(g, hex, tx, TY + y0, tz, YAW - Math.PI / 8); };
    lathe([[1.95, 0], [2.05, 0.8], [1.85, 1.8], [1.3, 3.0], [0.8, 4.4], [0.6, 5.6], [0.62, 6.0]], 39.5, COL.copper);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.box(0.13, 2.6, 0.13, COL.copper, tx + Math.cos(a) * 0.55, TY + 46.8, tz + Math.sin(a) * 0.55); }
    p.add(new THREE.CylinderGeometry(0.26, 0.26, 2.6, 8), COL.iron, tx, TY + 46.8, tz);
    oct(0.8, 0.8, 45.4, 45.6, COL.copper); oct(0.8, 0.8, 48.1, 48.3, COL.copper);
    lathe([[0.75, 0], [1.0, 1.0], [0.85, 1.9], [0.42, 2.9], [0.2, 3.6]], 48.3, COL.copper);
    p.add(new THREE.CylinderGeometry(0.03, 0.2, 7.2, 8), COL.copper, tx, TY + 51.9 + 3.6, tz);
    glow.add(new THREE.SphereGeometry(0.3, 10, 8), COL.gold, tx, TY + 53.4, tz);
    p.add(new THREE.SphereGeometry(0.2, 8, 6), COL.gold, tx, TY + 59.2, tz);
    // Vana Toomas, the old soldier with his flag, the town's weather vane since 1530 (2.1 m here, to read from below)
    { const v = TY + 59.4, a = YAW + 0.6, c = Math.cos(a), sn = Math.sin(a), Q = (dx, y, dz) => [tx + c * dx + sn * dz, v + y, tz - sn * dx + c * dz];
      p.box(0.14, 0.75, 0.14, COL.copper, ...Q(-0.1, 0.38, 0), a); p.box(0.14, 0.75, 0.14, COL.copper, ...Q(0.1, 0.38, 0), a);
      p.box(0.42, 0.75, 0.24, COL.copper, ...Q(0, 1.12, 0), a);
      p.add(new THREE.SphereGeometry(0.15, 8, 6), COL.copper, ...Q(0, 1.66, 0));
      p.add(new THREE.ConeGeometry(0.2, 0.22, 8), COL.copper, ...Q(0, 1.86, 0));
      p.box(0.06, 1.5, 0.06, COL.copper, ...Q(0.3, 1.5, 0), a);                           // the flagstaff
      p.box(0.9, 0.5, 0.03, COL.copper, ...Q(0.75, 1.95, 0), a);                          // his flag
      glow.box(0.12, 0.06, 0.05, COL.gold, ...Q(0, 1.4, 0.13), a); }
    yield 'frame';

    // ---- the Christmas market
    if (XMAS) {
      const ty = Math.min(h(TREE[0] - 3, TREE[1]), h(TREE[0] + 3, TREE[1]), h(TREE[0], TREE[1] - 3), h(TREE[0], TREE[1] + 3));
      xmasTree(p, glow, TREE[0], ty, TREE[1], { top: 17.5, R0: 4.5, seed: 41, baubles: 0xd8323e });
      yield;
      // one hut's sloped roof halves, gable ends and a garland bulb, shared
      const rise = 0.8, run = HUT_D / 2 + 0.5, slope = Math.atan2(rise, run), len = Math.hypot(rise, run);
      const roofF = new THREE.BoxGeometry(HUT_W + 0.4, 0.07, len).rotateX(slope).translate(0, rise / 2, run / 2);
      const roofB = new THREE.BoxGeometry(HUT_W + 0.4, 0.07, len).rotateX(-slope).translate(0, rise / 2, -run / 2);
      const eave = rise * (1 - HUT_D / 2 / run);
      const gable = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-HUT_D / 2, 0), new THREE.Vector2(HUT_D / 2, 0), new THREE.Vector2(HUT_D / 2, eave), new THREE.Vector2(0, rise), new THREE.Vector2(-HUT_D / 2, eave)])).rotateY(Math.PI / 2);
      const bulb = new THREE.OctahedronGeometry(0.07, 0);
      HUTS.forEach(([x, z, yaw], k) => {
        const y = Math.min(h(x - 1.4, z), h(x + 1.4, z), h(x, z - 1.2), h(x, z + 1.2)) - 0.05;
        const c = Math.cos(yaw), sn = Math.sin(yaw), Q = (dx, dz) => [x + c * dx + sn * dz, z - sn * dx + c * dz];
        const bx = (w, hh, d, hex, dx, y0, dz, parts = p) => { const [qx, qz] = Q(dx, dz); parts.box(w, hh, d, hex, qx, y + y0 + hh / 2, qz, yaw); };
        const wall = COL.pine[k % 3], roof = COL.roof[(k * 7) % 3], W = HUT_W, D = HUT_D;
        bx(W, 0.25, D, 0x8a6a56, 0, 0, 0);                                                   // the floor on its sleepers
        bx(W, 2.2, 0.08, wall, 0, 0.25, -D / 2 + 0.04);                                      // back
        for (const sx of [-1, 1]) bx(0.08, 2.2, D, wall, sx * (W / 2 - 0.04), 0.25, 0);     // sides
        bx(W, 0.85, 0.08, wall, 0, 0.25, D / 2 - 0.04);                                      // under the counter
        bx(W + 0.1, 0.06, 0.45, 0xc99c6a, 0, 1.1, D / 2 - 0.1);                              // the counter
        bx(W, 0.32, 0.08, 0xf3e6c8, 0, 2.13, D / 2 - 0.04);                                  // the sign board
        for (const sz of [-1, 1]) bx(W, eave, 0.08, wall, 0, 2.45, sz * (D / 2 - 0.04));      // up to the roof, front and back
        for (const sx of [-1, 1]) bx(0.1, 2.2, 0.1, wall, sx * (W / 2 - 0.05), 0.25, D / 2 - 0.05);
        bx(W - 0.3, 0.95, 0.05, COL.warm, 0, 1.15, -D / 2 + 0.12, glow);                    // the lit wares at the back
        for (let j = 0; j < 4; j++) bx(0.42, 0.18, 0.3, [0xd8323e, 0xf6e7c4, 0x8a5a3c, 0xe8a23a][(j + k) % 4], -1.05 + j * 0.7, 1.16, D / 2 - 0.2);
        const [rx, rz] = Q(0, 0);
        p.add(roofF, roof, rx, y + 2.45, rz, yaw); p.add(roofB, roof, rx, y + 2.45, rz, yaw);
        for (const sx of [-1, 1]) { const [gx, gz] = Q(sx * (W / 2 - 0.02), 0); p.add(gable, wall, gx, y + 2.45, gz, yaw); }
        // the garland along the front eave, bulbs on it
        bx(W + 0.3, 0.16, 0.16, COL.garland, 0, 2.3, D / 2 + 0.45);
        for (let j = 0; j < 9; j++) { const [gx, gz] = Q(-W / 2 + 0.1 + j * (W - 0.2) / 8, D / 2 + 0.55); glow.add(bulb, j % 4 === 3 ? 0xff7b6b : COL.lamp, gx, y + 2.33 + (j % 2) * 0.08, gz); }
      });
      yield;
      // strings of bulbs from the poles to the tree, sagging
      const tyre = (a) => [TREE[0] + Math.cos(a) * 2.7, TREE[1] + Math.sin(a) * 2.7];
      for (const [x, z] of POLES) {
        const y = h(x, z);
        p.add(new THREE.CylinderGeometry(0.07, 0.1, 7.2, 6), COL.iron, x, y + 3.6, z);
        glow.add(new THREE.SphereGeometry(0.16, 8, 6), COL.lamp, x, y + 7.25, z);
        const [ex, ez] = tyre(Math.atan2(z - TREE[1], x - TREE[0])), ey = ty + 10.2;
        const n = Math.round(Math.hypot(ex - x, ez - z) / 0.75);
        for (let j = 1; j < n; j++) { const t = j / n; glow.add(bulb, j % 5 === 0 ? 0xffd9a0 : COL.lamp, x + (ex - x) * t, y + 7.1 + (ey - y - 7.1) * t - 1.7 * 4 * t * (1 - t), z + (ez - z) * t); }
      }
      for (const g of [roofF, roofB, gable, bulb]) g.dispose();
    }
    yield 'frame';
    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) { gm.matrixAutoUpdate = false; group.add(gm); }
  }

  let built = false;
  const C = [-5706, 2945];
  return {
    info: () => ({ built, huts: HUTS.length, poles: POLES.length }),
    update(car) {
      if (built || !car || Math.hypot(car.x - C[0], car.z - C[1]) > 450 || !world.ready(EAST[0], EAST[1]) || !world.ready(WEST[0], WEST[1]) || !world.ready(TREE[0], TREE[1])) return;
      built = true;
      jobs.add(build, 'raekoja plats');
    },
  };
}
