// Tallinn's centre streets up close (Martin 28 Nov 2026: "the look of the tarmac, patching ... all the traffic
// furniture"): the wear of the asphalt, the manhole lids and drain grates, the tram rails. Tallinn only.
//
// All of it darkens or lightens the road where it lies (src/world/tln/multiply.js), in squares of 160 m built through
// the work queue as the car comes within 340 m and let go again past 700 m:
//  - wheel paths: two faint darker bands in every lane, where the tyres have polished the tarmac;
//  - patches of newer or older tarmac: across a lane, a trench across the whole street, a long strip by the kerb
//    where a pipe was laid, a square by a hatch; crack seals along the lane joints and across. Placed by a seeded
//    random along each street (the same every visit), styled on the centre's Mapillary photos: not measured;
//  - manhole lids and drain grates where Mapillary's detections put them (tools/tln/marks.py, marks.json), and a lid
//    in the middle of a lane every 40 to 70 m on the asphalt streets where there are none, as in the photos;
//  - the tram rails along OpenStreetMap's tram lines, 1067 mm apart, grooved rails flush with the road.
// The arrows Mapillary saw are painted with the lines (src/world/tln/centre.js).
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import * as THREE from 'three';
import { markMesh } from './multiply.js';
import { centreMarksData } from './centre.js';

const CELL = 160, NEAR = 340, SHOW = 480, DROP = 700;
const CAR = new Set(['Tänav', 'Põhimaantee', 'Kõrvalmaantee', 'Tugimaantee', 'Ramp või ühenduste', 'Muu tee']);
// the yellow area's box (Kalamaja's port edge to Kadriorg, the sea to Liivalaia)
const inArea = (x, z) => x > -6800 && x < -1800 && z > 900 && z < 4400;
const GAUGE = 1.067 + 0.07;                  // between the rails' middles

function rng(seed) {
  let a = seed * 2654435761 >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a street's line: metres along it, and the point s metres along, o to the right of its way ([x, z])
function line(pts) {
  const S = [0];
  for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = S[S.length - 1];
  const at = (s, o = 0) => {
    s = Math.max(0, Math.min(len, s));
    let i = 0, hi = S.length - 2;
    while (i < hi) { const m = (i + hi + 1) >> 1; if (S[m] <= s) i = m; else hi = m - 1; }
    const a = pts[i], b = pts[i + 1], l = (S[i + 1] - S[i]) || 1, t = (s - S[i]) / l;
    const tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    return [a[0] + (b[0] - a[0]) * t - tz * o, a[1] + (b[1] - a[1]) * t + tx * o];
  };
  return { len, at };
}

// the factors a look turns the asphalt's colour by
const PATCH = [[0.8, 0.8, 0.82], [0.86, 0.86, 0.88], [0.72, 0.72, 0.75], [1.1, 1.09, 1.07]];   // newer, older, fresh black, pale old repair
const SEAL = [0.64, 0.64, 0.67];
const WHEEL = [0.93, 0.93, 0.94];
const IRON = [1, 1, 1.03];

export function createCentreMarks(scene, world) {
  const data = centreMarksData();
  const group = still(new THREE.Group());
  scene.add(group);
  const cells = new Map();
  const cellOf = (x, z) => {
    const k = `${Math.floor(x / CELL)}_${Math.floor(z / CELL)}`;
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { cx: (Math.floor(x / CELL) + 0.5) * CELL, cz: (Math.floor(z / CELL) + 0.5) * CELL, roads: [], holes: [], rails: [], built: false, mesh: null }));
    return c;
  };

  // the asphalt streets, cut into the stretches each square holds
  const roads = [];
  for (const r of world.vectors.roads) {
    if (!CAR.has(r.type) || r.s === 1 || r.s === 2 || r.s === 3 || r.e || r.w < 4 || r.pts.length < 2) continue;
    const m = r.pts[r.pts.length >> 1];
    if (!inArea(m[0], m[1])) continue;
    const L = line(r.pts);
    if (L.len < 6) continue;
    const road = { r, L, seed: (Math.round(r.pts[0][0] * 10) * 73856093) ^ (Math.round(r.pts[0][1] * 10) * 19349663) };
    roads.push(road);
    let prev = null, s0 = 0;
    for (let s = 0; ; s += 8) {
      const e = Math.min(s, L.len), p = L.at(e), c = cellOf(p[0], p[1]);
      if (c !== prev) { if (prev) prev.roads.push([road, s0, e]); prev = c; s0 = e; }
      if (e >= L.len) { prev.roads.push([road, s0, L.len]); break; }
    }
  }
  // the lids and grates
  let found = 0;
  for (const a of Object.values(data?.holes || {})) {
    for (let i = 0; i + 3 < a.length; i += 4) { cellOf(a[i + 1], a[i + 2]).holes.push(a[i], a[i + 1], a[i + 2], a[i + 3]); found++; }
  }
  // the tram lines, resampled every 2 m and cut by square
  for (const list of Object.values(data?.trams || {})) {
    for (const pts of list) {
      const L = line(pts), n = Math.max(1, Math.ceil(L.len / 2));
      let run = [], prev = null;
      for (let k = 0; k <= n; k++) {
        const p = L.at((k / n) * L.len), c = cellOf(p[0], p[1]);
        if (c !== prev && prev) { run.push(p); prev.rails.push(run); run = [run[run.length - 2]]; }
        prev = c; run.push(p);
      }
      if (prev && run.length > 1) prev.rails.push(run);
    }
  }

  const y = (x, z) => world.topAt(x, z, 0);
  function* build(c) {
    const gen = c.gen;
    const M = markMesh(y);
    const spots = [];                                     // where lids are, so a made-up one keeps clear of them
    for (let i = 0; i < c.holes.length; i += 4) spots.push(c.holes[i + 1], c.holes[i + 2]);
    for (const [road, sa, sb] of c.roads) {
      const { r, L } = road, h = r.w / 2;
      const along = (a, b, o, step = 1.5) => {
        const out = [];
        for (let s = a; s < b; s += step) out.push(L.at(s, typeof o === 'function' ? o(s) : o));
        out.push(L.at(b, typeof o === 'function' ? o(b) : o));
        return out;
      };
      const lanes = Math.max(1, Math.round(r.w / 3.3)), lw = r.w / lanes;
      // wheel paths, the length of the stretch
      if (sb - sa > 3) for (let k = 0; k < lanes; k++) for (const d of [-0.85, 0.85]) M.ribbon(along(sa, sb, -h + (k + 0.5) * lw + d, 3), 0.7, WHEEL, 1);
      // the street's own sequence, kept where it starts on this stretch
      const R = rng(road.seed);
      for (let s = R() * 30; s < L.len; s += 20 + R() * 45) {
        const look = R(), kind = R(), side = R() < 0.5 ? 1 : -1, a = R(), b = R();
        if (s < sa || s >= sb) continue;
        const F = PATCH[look < 0.12 ? 3 : look < 0.35 ? 2 : look < 0.65 ? 1 : 0];
        if (kind < 0.35) {                                   // one lane, 1.5 to 5 m long
          const k = Math.floor(a * lanes), len = 1.5 + b * 3.5;
          M.ribbon(along(s, Math.min(L.len, s + len), -h + (k + 0.5) * lw, 1.2), lw - 0.3, F, 0);
        } else if (kind < 0.55) {                            // a trench across the whole street
          const len = 0.9 + a * 1.4, pts = [];
          for (let o = -h + 0.15; o <= h - 0.15 + 1e-6; o += (2 * h - 0.3) / 4) pts.push(L.at(s, o));
          M.ribbon(pts, len, F, 0);
        } else if (kind < 0.75) {                            // a strip by the kerb where a pipe went in
          const len = 8 + a * 30, wd = 0.7 + b * 0.6;
          M.ribbon(along(s, Math.min(L.len, s + len), side * (h - wd / 2 - 0.1), 1.5), wd, F, 0);
        } else {                                             // a square round a hatch
          const len = 1.2 + a * 1.4;
          M.ribbon(along(s, Math.min(L.len, s + len), side * (0.5 + b * Math.max(0, h - 1.6)), 0.6), 1 + a * 1.2, F, 0);
        }
      }
      if (jobs.late()) yield;
      // crack seals: along a lane joint in long broken runs, and across every so often
      const R2 = rng(road.seed ^ 0x5bd1e995);
      for (let s = R2() * 30; s < L.len; ) {
        const len = 10 + R2() * 40, j = Math.floor(R2() * (lanes + 1)), wob = R2() * 6, gap = 10 + R2() * 50;
        if (s >= sa && s < sb && j > 0 && j < lanes) {
          const o0 = -h + j * lw;
          M.ribbon(along(s, Math.min(L.len, s + len), (q) => o0 + 0.15 * Math.sin((q - s) * 0.11 + wob) + 0.06 * Math.sin((q - s) * 0.47), 1.2), 0.08, SEAL, 1);
        }
        s += len + gap;
      }
      for (let s = R2() * 15; s < L.len; s += 12 + R2() * 40) {
        const full = R2() < 0.4, wob = R2() * 6, pick = R2();
        if (s < sa || s >= sb) continue;
        const a = full ? -h + 0.3 : (pick < 0.5 ? -h + 0.3 : 0.1), b = full ? h - 0.3 : a + h - 0.4, pts = [];
        for (let o = a; o <= b + 1e-6; o += (b - a) / 6) pts.push(L.at(s + 0.35 * Math.sin(o * 1.3 + wob) + (o - a) * 0.06, o));
        M.ribbon(pts, 0.08, SEAL, 1);
      }
      // a lid in a lane every 40 to 70 m where Mapillary's drives saw none near
      const R3 = rng(road.seed ^ 0x27d4eb2f);
      for (let s = 10 + R3() * 40; s < L.len - 5; s += 40 + R3() * 30) {
        const k = Math.floor(R3() * lanes), o = -h + (k + 0.5) * lw + (R3() - 0.5) * 0.8;
        if (s < sa || s >= sb) continue;
        const p = L.at(s, o);
        let near = false;
        for (let i = 0; i < spots.length && !near; i += 2) near = Math.hypot(spots[i] - p[0], spots[i + 1] - p[1]) < 25;
        if (near) continue;
        spots.push(p[0], p[1]);
        M.square(p[0], p[1], 0, 1.32, 1.32, IRON, 3);
      }
      if (jobs.late()) yield;
    }
    for (let i = 0; i < c.holes.length; i += 4) {
      const [kind, x, z, yaw] = [c.holes[i], c.holes[i + 1], c.holes[i + 2], c.holes[i + 3]];
      if (kind === 0) M.square(x, z, yaw, 1.32, 1.32, IRON, 3);
      else M.square(x, z, yaw, 0.8, 0.5, IRON, 4);
    }
    for (const run of c.rails) {
      // each rail: its groove on the track's inner side
      const off = (pts, o) => pts.map((p, k) => {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [p[0] - ((b[1] - a[1]) / l) * o, p[1] + ((b[0] - a[0]) / l) * o];
      });
      M.ribbon(off(run, GAUGE / 2), 0.16, [1, 1, 1], 5, 0.035);
      M.ribbon(off(run, -GAUGE / 2), 0.16, [1, 1, 1], 6, 0.035);
      if (jobs.late()) yield;
    }
    if (!c.built || c.gen !== gen) return;                // (let go while it was being made)
    c.mesh = M.mesh();
    if (c.mesh) group.add(c.mesh);
  }

  let lastX = Infinity, lastZ = Infinity;
  return {
    // (for the tests: how much is known and built)
    info: () => ({ cells: cells.size, roads: roads.length, holes: found, built: [...cells.values()].filter((c) => c.mesh).length }),
    update(car) {
      if (!car || Math.hypot(car.x - lastX, car.z - lastZ) < 12) return;
      lastX = car.x; lastZ = car.z;
      for (const c of cells.values()) {
        const d = Math.hypot(c.cx - car.x, c.cz - car.z);
        if (!c.built && d < NEAR) { c.built = true; c.gen = (c.gen || 0) + 1; jobs.add(function* centreMarks() { yield* build(c); }, 'centre marks'); }
        else if (c.built && d > DROP) {
          c.built = false;
          if (c.mesh) { group.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
        }
        if (c.mesh) c.mesh.visible = d < SHOW;
      }
    },
  };
}
