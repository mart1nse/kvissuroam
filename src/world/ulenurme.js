// Kaardista "Tartu Airport at Ülenurme" (Martin, 22 Nov), batch 3: the Lennu interchange on the Tallinn–Tartu–
// Võru road (road 2) at Ülenurme, the multi-level crossing on the way to the airport, from his Street View shots
// (June 2023 to June 2025) and the Land Board's orthophoto. The map already has the overpass (a lidar deck with
// its railings), the ramps and the roundabout; this dresses them:
//  - the steel guard rail down the middle of road 2 where its two carriageways run side by side north of the
//    interchange (posts every 2 m, a W-beam on each face), solid to cars;
//  - the red and white height gantry over the Lennu road before it goes under road 2, with its round sign;
//  - the grey concrete slope paving on the embankments under both ends of the overpass;
//  - the paved apron round the roundabout's island inside a kerb ring;
//  - the blue direction sign between the bridge road and the ramp (Külitse, Ülenurme keskus, Lennujaam, Tõrvandi);
//  - the red and white chevron board at the nose where the Lennu road splits under and up;
//  - white posts with a black band along the ramps and road 2 every 50 m, never on a carriageway.
// No street name is painted on the road.
import * as THREE from 'three';
import { paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

// the median of road 2 as the orthophoto shows it (the guard rail on the narrow strip between the carriageways)
const MEDIAN = [[1537.0, 10120], [1539.6, 10140], [1542.5, 10170], [1546.0, 10200], [1549.5, 10240], [1551.4, 10265], [1552.4, 10287]];
// the overpass: road 2's deck over the Lennu road (start and end of the map's lidar deck), half width
const DECK = [[1544.2, 10399.1], [1538.1, 10440.6]], DECK_HW = 8.8;
// the Lennu road under the bridge: the gantry stands across it here
const GANTRY = { at: [1514, 10412.1], dir: [61.5, 5.0], half: 6.0, clear: 4.7 };
const ROUND = { x: 1591.2, z: 10443.6, r0: 6.1, r1: 7.5 };           // the roundabout's island: apron from r0 to the kerb at r1
const SIGN = { at: [1579.0, 10414.0], face: [21, 26], w: 3.0, h: 1.9, y: 1.6 };
const CHEVRON = [1490.0, 10417.6];
// the roads that get the white posts along both verges
const POSTED = ['1.Lennu ühendustee', '2.Lennu ühendustee', '3.Lennu ühendustee'];
const BOX = { x0: 1270, x1: 1700, z0: 10110, z1: 10600 };
const CENTRE = [1560, 10380];

const unit = ([x, z]) => { const l = Math.hypot(x, z); return [x / l, z / l]; };

export function createUlenurme(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);

  // the solid parts go in at once: the median rail in boxes along its line, the gantry's and the sign's posts
  const solids = [];
  for (let i = 0; i < MEDIAN.length - 1; i++) {
    const [ax, az] = MEDIAN[i], [bx, bz] = MEDIAN[i + 1];
    solids.push({ x: (ax + bx) / 2, z: (az + bz) / 2, yaw: Math.atan2(-(bz - az), bx - ax), hx: Math.hypot(bx - ax, bz - az) / 2 + 0.05, hz: 0.22 });
  }
  { const u = unit(GANTRY.dir), v = [-u[1], u[0]];
    for (const s of [-1, 1]) solids.push({ x: GANTRY.at[0] + v[0] * GANTRY.half * s, z: GANTRY.at[1] + v[1] * GANTRY.half * s, yaw: 0, hx: 0.2, hz: 0.2 }); }
  { const f = unit(SIGN.face), a = [f[1], -f[0]];
    for (const s of [-1, 1]) solids.push({ x: SIGN.at[0] + a[0] * SIGN.w * 0.33 * s, z: SIGN.at[1] + a[1] * SIGN.w * 0.33 * s, yaw: 0, hx: 0.1, hz: 0.1 }); }
  world.addSolids(solids);

  let built = false;
  function* build() {
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;

    // ---- the median guard rail: posts every 2 m, a W-beam on each face
    A.walk(MEDIAN, 2, ([x, z]) => p.box(0.14, 0.78, 0.12, 0x8d9096, x, h(x, z) + 0.39, z));
    for (let i = 0; i < MEDIAN.length - 1; i++) {
      const a = MEDIAN[i], b = MEDIAN[i + 1], u = unit([b[0] - a[0], b[1] - a[1]]), n = [-u[1], u[0]];
      for (const s of [-1, 1]) {
        const o = (q) => [q[0] + n[0] * 0.13 * s, q[1] + n[1] * 0.13 * s];
        A.bar(o(a), o(b), 0.05, 0.45, 0.6, 0xc4c8ce);
        A.bar(o(a), o(b), 0.06, 0.6, 0.75, 0xb4b8be);
      }
    }
    // the ends turned down into the ground
    for (const [a, b] of [[MEDIAN[1], MEDIAN[0]], [MEDIAN[MEDIAN.length - 2], MEDIAN[MEDIAN.length - 1]]]) {
      const u = unit([b[0] - a[0], b[1] - a[1]]), e = [b[0] + u[0] * 3, b[1] + u[1] * 3], gy = h(e[0], e[1]);
      p.box(3.2, 0.12, 0.3, 0xb4b8be, (b[0] + e[0]) / 2, gy + 0.32, (b[1] + e[1]) / 2, Math.atan2(-u[1], u[0]));
    }
    yield;

    // ---- the height gantry: red and white striped posts and beam, the round sign under the middle
    { const u = unit(GANTRY.dir), v = [-u[1], u[0]], [gx, gz] = GANTRY.at, yaw = Math.atan2(-v[1], v[0]);
      const g = Math.min(...[-1, 0, 1].map((s) => h(gx + v[0] * GANTRY.half * s, gz + v[1] * GANTRY.half * s)));
      const top = GANTRY.clear + 0.4;
      for (const s of [-1, 1]) {
        const x = gx + v[0] * GANTRY.half * s, z = gz + v[1] * GANTRY.half * s, y0 = h(x, z);
        const n = Math.round((g + top - y0) / 0.5);
        for (let k = 0; k < n; k++) p.box(0.22, (g + top - y0) / n, 0.22, k % 2 ? 0xf4f4f2 : 0xc8262c, x, y0 + (k + 0.5) * (g + top - y0) / n, z);
      }
      const L = GANTRY.half * 2 + 0.3, m = 14;
      for (let k = 0; k < m; k++) {
        const t = -L / 2 + (k + 0.5) * L / m;
        p.box(L / m, 0.32, 0.2, k % 2 ? 0xf4f4f2 : 0xc8262c, gx + v[0] * t, g + GANTRY.clear + 0.16, gz + v[1] * t, yaw);
      }
      const tex = paintTexture(0.9, 0, 0.9, 120, (P) => {
        P.arc(0.45, 0.45, 0.45, '#c8262c'); P.arc(0.45, 0.45, 0.35, '#ffffff');
        P.poly([[0.45, 0.8], [0.37, 0.7], [0.53, 0.7]], '#111111'); P.poly([[0.45, 0.1], [0.37, 0.2], [0.53, 0.2]], '#111111');
        P.text('4,5 m', 0.45, 0.45, 0.22, '#111111');
      }, { alpha: true });
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
      for (const s of [-1, 1]) {           // both faces: the way in and the way out
        const m2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
        m2.position.set(gx - u[0] * 0.12 * s, g + GANTRY.clear - 0.5, gz - u[1] * 0.12 * s);
        m2.rotation.y = Math.atan2(-u[0] * s, -u[1] * s);
        group.add(m2);
      } }
    yield;

    // ---- concrete slope paving on the embankments under both ends of the overpass: where the ground under the
    // deck stands above the road below it, in 1 m strips across the deck's width
    { const F = frame(DECK[0], [DECK[1][0] - DECK[0][0], DECK[1][1] - DECK[0][1]]), len = Math.hypot(DECK[1][0] - DECK[0][0], DECK[1][1] - DECK[0][1]);
      const road = h(1542.3, 10414.5);
      let run = null;
      const flush = (s) => { if (run !== null && s - run > 1.5) A.pave(F, run, s, -DECK_HW - 0.6, DECK_HW + 0.6, 'concrete'); run = null; };
      for (let s = 0; s < len; s += 1) {
        const at = [-DECK_HW, 0, DECK_HW].map((v) => F.at(s + 0.5, v)), ys = at.map(([x, z]) => h(x, z));
        // above the road below, and well under the deck (not the embankment the road on top runs on)
        const up = Math.min(...ys) > road + 0.6 && at.every(([x, z], k) => world.topAt(x, z, 1) - ys[k] > 2.2);
        if (up && run === null) run = s; else if (!up) flush(s);
      }
      flush(len); }
    yield;

    // ---- the roundabout: a paved apron round the island inside a kerb ring
    { const R = (ROUND.r0 + ROUND.r1) / 2, C = 2 * Math.PI * R;
      const ring = { at: (t, r) => [ROUND.x + Math.cos(t / R) * r, ROUND.z + Math.sin(t / R) * r] };
      A.pave(ring, 0, C, ROUND.r0, ROUND.r1 - 0.15, 'paver');
      const n = 40;
      for (let k = 0; k < n; k++) {
        const a = (k + 0.5) / n * Math.PI * 2, x = ROUND.x + Math.cos(a) * ROUND.r1, z = ROUND.z + Math.sin(a) * ROUND.r1;
        p.box(2 * Math.PI * ROUND.r1 / n + 0.02, 0.24, 0.2, 0xc9c6cc, x, h(x, z) + 0.04, z, -a + Math.PI / 2);
      } }
    yield;

    // ---- the blue direction sign on two posts, the chevron board at the split
    { const f = unit(SIGN.face), a = [f[1], -f[0]], [sx, sz] = SIGN.at, y = h(sx, sz);
      for (const s of [-1, 1]) { const x = sx + a[0] * SIGN.w * 0.33 * s, z = sz + a[1] * SIGN.w * 0.33 * s; p.add(new THREE.CylinderGeometry(0.06, 0.06, SIGN.y + SIGN.h, 8), 0x8a8d93, x, h(x, z) + (SIGN.y + SIGN.h) / 2, z); }
      const tex = paintTexture(SIGN.w, 0, SIGN.h, 90, (P) => {
        P.r(0, 0, SIGN.w, SIGN.h, '#ffffff'); P.r(0.04, 0.04, SIGN.w - 0.04, SIGN.h - 0.04, '#1f5fae');
        // the arrows drawn, not typed (a font without them sends the browser looking through its fonts)
        const arrow = (x, y, a) => {
          const c = Math.cos(a), sn = Math.sin(a), q = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
          P.poly([q(-0.13, -0.03), q(0.03, -0.03), q(0.03, -0.09), q(0.14, 0), q(0.03, 0.09), q(0.03, 0.03), q(-0.13, 0.03)], '#ffffff');
        };
        const rows = [['KÜLITSE', '6', Math.PI / 2], ['ÜLENURME keskus', '2,4', Math.PI / 4], ['LENNUJAAM', '2', 0], ['TÕRVANDI', '2', Math.PI]];
        rows.forEach(([t, d, a], i) => {
          const yy = SIGN.h - 0.3 - i * 0.43;
          P.text(t, 0.16, yy, 0.25, '#ffffff', '700 %px Arial, sans-serif', 'left');
          P.text(d, SIGN.w - 0.62, yy, 0.25, '#ffffff', '700 %px Arial, sans-serif', 'right');
          arrow(SIGN.w - 0.28, yy, a);
          if (i) P.r(0.12, yy + 0.215, SIGN.w - 0.12, yy + 0.23, '#ffffff');
        });
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w, SIGN.h), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(sx, y + SIGN.y + SIGN.h / 2, sz); m.rotation.y = Math.atan2(f[0], f[1]); group.add(m);
      p.box(SIGN.w, SIGN.h, 0.04, 0x9aa0a8, sx - f[0] * 0.03, y + SIGN.y + SIGN.h / 2, sz - f[1] * 0.03, Math.atan2(-a[1], a[0])); }
    yield;
    { const [cx, cz] = CHEVRON, y = h(cx, cz);
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), 0x8a8d93, cx, y + 0.8, cz);
      const tex = paintTexture(0.6, 0, 0.8, 120, (P) => {
        P.r(0, 0, 0.6, 0.8, '#c8262c');
        for (const yy of [0.12, 0.4, 0.68]) P.poly([[0.1, yy], [0.3, yy + 0.12], [0.5, yy], [0.5, yy + 0.1], [0.3, yy + 0.22], [0.1, yy + 0.1]], '#ffffff');
      });
      const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), mat);
      m.position.set(cx, y + 1.25, cz); m.rotation.y = -Math.PI / 2; group.add(m); }
    yield;

    // ---- white posts with a black band every 50 m along both verges of the ramps and road 2, never on a road
    const roads = [], all = world.vectors.roads;
    for (let i = 0; i < all.length; i++) {
      const r = all[i];
      if (r.pts.some(([x, z]) => x > BOX.x0 && x < BOX.x1 && z > BOX.z0 && z < BOX.z1)) roads.push(r);
      if ((i & 255) === 0 && jobs.late()) yield;
    }
    const clear = (x, z) => roads.every((r) => {
      const hw = r.w / 2 + 0.7;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) < hw) return false;
      }
      return true;
    });
    const cands = [], spots = [];
    for (const r of roads) {
      if (!(r.type === 'Põhimaantee' || POSTED.includes(r.name))) continue;
      A.walk(r.pts, 50, ([x, z], [ux, uz]) => {
        if (x < BOX.x0 || x > BOX.x1 || z < BOX.z0 || z > BOX.z1) return;
        const d = r.w / 2 + 1.1;
        for (const s of [-1, 1]) cands.push([x - uz * d * s, z + ux * d * s]);
      });
    }
    for (const q of cands) {
      if (world.ready(q[0], q[1]) && world.topAt(q[0], q[1], 1) - h(q[0], q[1]) < 1 && clear(q[0], q[1])) spots.push(q);
      if (jobs.late()) yield;
    }
    if (spots.length) {
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.8, 0.11), new THREE.MeshLambertMaterial({ color: 0xf2f2f0 }), spots.length);
      const band = new THREE.InstancedMesh(new THREE.BoxGeometry(0.115, 0.25, 0.115), new THREE.MeshLambertMaterial({ color: 0x202124 }), spots.length);
      const M = new THREE.Matrix4();
      spots.forEach(([x, z], i) => { const y = h(x, z); body.setMatrixAt(i, M.makeTranslation(x, y + 0.4, z)); band.setMatrixAt(i, M.makeTranslation(x, y + 0.925, z)); });
      group.add(body, band);
    }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 650) return;
      if ([[1545, 10200], [1542, 10414], [1591, 10443], [1430, 10414]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'ulenurme interchange'); }
    },
  };
}
