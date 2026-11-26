// Bus shelters that a car can damage (Martin, 19 Nov): hit one and the glass panes near the impact burst
// into small pieces that rain onto the pavement and stay there, and the frame (posts, roof, bench, advert
// panel) bends away from the car, more the harder the hit (Martin, 20 Nov: much more at high speed, and a
// frame already bent gives way more easily to the next hit), up to a limit where it is nearly flattened. Each hand-built shelter (Emajõe,
// Lai, Kroonuaia) hands its frame and its panes to breakableShelter(); updateShelters() runs every frame
// after the car has moved. The back and the ends stay solid for the car (the posts hold; shelterSolids); the damage lasts
// until the page is loaded again.
// Martin, 20 Nov: hit one of the long sides (the open front or the glass back) at 20 km/h or more and the car
// crashes through: the posts snap half way up and fold over, all the glass bursts, the bench flies off and
// the car goes on, slowed. Slower than that only the glass breaks (from the front the car noses in to the
// bench first). The short ends stay as before: they bend and the car bounces off.
import * as THREE from 'three';
import { stats } from '../stats.js';
import { glassShards } from './shards.js';

const shelters = [];
const SHATTER = 2.2;        // m/s into the shelter: below this the frame only shakes and bends a touch
const ALL = 7.5;            // m/s: every pane goes
const BEND_MAX = 2.2;       // m, how far the top of the frame can be pushed over in all (2.45 m high: nearly flat)
const BEND_HIT = 1.4;       // m, the most one hit can push it
const REACH = 2.3;          // m along the shelter: how far the bend spreads either side of a slow impact
// how far one hit at speed v (m/s into the shelter) pushes the top over: grows with the energy, so
// 5 m/s about 0.17 m, 10 m/s about 0.6 m, 15 m/s about 1.4 m; a frame bent already gives way more
// (bent half a metre, the next hit bends it 1.6 times as far)
const bendFor = (v, bent) => Math.min(BEND_HIT, (0.02 + 0.006 * v * v) * (1 + 1.2 * Math.min(bent, 1.5)));
const SHARDS = 150;         // pieces per pane
const THROUGH = 30 / 3.6;   // m/s across a long side: the car crashes through
const SNAP = 1.5;           // m the snapped top of the frame is thrown over
const KEEP = 0.72;          // of its speed the car keeps when it crashes through

// box: { x, z, yaw, hx, hz } the shelter's footprint as given to world.addSolids (local x = cos yaw, -sin yaw)
// y: the ground under it, H: its height
// frame: a Mesh (vertex-coloured, world coordinates), bent as one piece
// bendAlso: other meshes to bend with it (e.g. the advert); their transforms are baked into their vertices
// panes: [{ a: [x, z], b: [x, z], y0, y1 }] vertical glass between two ground points
// loose: meshes that fly off when a car crashes through (the bench); world coordinates like the frame
// The solid parts of a shelter for the cars (Martin, 20 Nov: a car may nose a little way in from the open
// side that faces the road): the back with the bench in front of it, and the two ends. In the box's own
// axes (s along, n across, +n the back): [s0, s1, n0, n1]. The open front is at -n.
const BACK = 0.6, END = 0.2;
const pieces = (box) => [
  [-box.hx, box.hx, box.hz - BACK, box.hz],
  [-box.hx, -box.hx + END, -box.hz, box.hz],
  [box.hx - END, box.hx, -box.hz, box.hz],
];
// ... as boxes for world.addSolids (the same objects every time: the back is taken away again when a car
// crashes through, world.removeSolids)
export function shelterSolids(box) {
  if (box.solids) return box.solids;
  const ux = Math.cos(box.yaw), uz = -Math.sin(box.yaw), nx = Math.sin(box.yaw), nz = Math.cos(box.yaw);
  box.solids = pieces(box).map(([s0, s1, n0, n1], k) => {
    const s = (s0 + s1) / 2, n = (n0 + n1) / 2;
    return { x: box.x + ux * s + nx * n, z: box.z + uz * s + nz * n, yaw: box.yaw, hx: (s1 - s0) / 2, hz: (n1 - n0) / 2, removable: k === 0, tall: 2.6 };   // (tall: up to the roof, which a car may land on)
  });
  Object.defineProperty(box, 'solids', { enumerable: false });
  return box.solids;
}

export function breakableShelter(world, group, { box, y, H, frame, bendAlso = [], loose = [], panes, glass = 0xcfe6f2, opacity = 0.32 }) {
  const ux = Math.cos(box.yaw), uz = -Math.sin(box.yaw);          // along the shelter
  const nx = Math.sin(box.yaw), nz = Math.cos(box.yaw);           // across it
  const local = (x, z) => [(x - box.x) * ux + (z - box.z) * uz, (x - box.x) * nx + (z - box.z) * nz];
  const solid = pieces(box);           // (the back, solid[0], goes when a car crashes through)
  let through = false;

  // ---- the frame and anything bent with it: remember where every vertex started
  const bent = [];
  for (const m of [frame, ...bendAlso]) {
    if (!m) continue;
    m.updateMatrix();
    m.geometry = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    m.geometry.applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    m.updateMatrix();
    const pos = m.geometry.attributes.position;
    pos.setUsage(THREE.DynamicDrawUsage);
    const base = Float32Array.from(pos.array), s = new Float32Array(pos.count);
    for (let k = 0; k < pos.count; k++) s[k] = local(base[k * 3], base[k * 3 + 2])[0];
    bent.push({ m, base, s });
    if (m.parent !== group && !m.parent) group.add(m);
  }

  // ---- what flies off: baked into world coordinates like the frame, centred when it is launched
  const flyers = [];
  for (const m of loose) {
    m.updateMatrix();
    m.geometry.applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    if (!m.parent) group.add(m);
  }

  // ---- the glass: one mesh per pane, so a pane can go on its own
  const glassMat = new THREE.MeshLambertMaterial({ color: glass, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const P = panes.map((q) => {
    const { a, b, y0, y1 } = q;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]], 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, glassMat);
    group.add(mesh);
    const sa = local(...a)[0], sb = local(...b)[0];
    bent.push({ m: mesh, base: Float32Array.from(g.attributes.position.array), s: Float32Array.from([sa, sb, sb, sa, sb, sa]) });
    return { ...q, mesh, s0: Math.min(sa, sb), s1: Math.max(sa, sb), broken: false };
  });

  // ---- shards: little triangles, flying, then lying on the ground
  const shards = glassShards(world, group, SHARDS * panes.length);

  // ---- damage state: the bend's top displacement (world x, z), where along the shelter it centres,
  // and the hits still settling (each eases in with a little wobble)
  const hits = [];
  let total = 0, cool = 0;

  function shatter(q, dirX, dirZ, speed) {
    q.broken = true;
    q.mesh.visible = false;
    shards.burst(q.a, q.b, q.y0, q.y1, dirX, dirZ, speed, SHARDS);
  }

  // a slower knock across a long side: the glass breaks, the frame holds
  function glassOnly(px, pz, dirX, dirZ, speed, sound) {
    const sHit = local(px, pz)[0];
    let broke = 0;
    for (const q of P) {
      if (q.broken || speed < SHATTER) continue;
      const gap = sHit < q.s0 ? q.s0 - sHit : sHit > q.s1 ? sHit - q.s1 : 0;
      if (gap < 0.5) { shatter(q, dirX, dirZ, speed); broke++; }
    }
    sound?.smash?.(broke, Math.min(1.5, speed / 8));
    stats.smash('glass', broke);
  }

  function hit(px, pz, dirX, dirZ, speed, sound) {
    const sHit = local(px, pz)[0];
    const amount = Math.min(BEND_MAX - total, bendFor(Math.max(0, speed - 0.5), total));
    // a harder hit bends a longer stretch of the frame
    if (amount > 0.002) { total += amount; hits.push({ dx: dirX * amount, dz: dirZ * amount, s: sHit, r: REACH * Math.min(2.2, 0.85 + speed / 12), t: 0 }); }
    let broke = 0;
    for (const q of P) {
      if (q.broken) continue;
      const gap = sHit < q.s0 ? q.s0 - sHit : sHit > q.s1 ? sHit - q.s1 : 0;
      if (speed >= ALL || (speed >= SHATTER && gap < 1.2 + 0.25 * speed)) { shatter(q, dirX, dirZ, speed); broke++; }
    }
    sound?.smash?.(broke, Math.min(1.5, speed / 8));
    stats.smash('glass', broke);
  }

  // the car goes through a long side: every pane bursts, the posts snap half way up and the top is thrown
  // over the way the car goes, the bench flies, the back is no longer solid, and the car goes on slower
  function breakThrough(px, pz, dirX, dirZ, speed, car, wvx, wvz, sound) {
    through = true;
    const sHit = local(px, pz)[0];
    let broke = 0;
    for (const q of P) if (!q.broken) { shatter(q, dirX, dirZ, speed); broke++; }
    total += SNAP;
    hits.push({ dx: dirX * SNAP, dz: dirZ * SNAP, s: sHit, r: 2.0, t: 0, snap: true });
    for (const m of loose) {
      const g = m.geometry;
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new THREE.Vector3());
      g.translate(-c.x, -c.y, -c.z);
      m.position.copy(c);
      const v = speed * (0.55 + Math.random() * 0.2);
      flyers.push({ m, half: (g.boundingBox.max.y - g.boundingBox.min.y) / 2, v: new THREE.Vector3(dirX * v + (Math.random() - 0.5), 1.6 + Math.random() * 1.5, dirZ * v + (Math.random() - 0.5)),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(3 + speed * 0.4), rest: false });
    }
    solid.shift();
    world.removeSolids?.([shelterSolids(box)[0]]);
    // the car loses some of its speed in it and feels the knock
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    car.vx = (wvx * fx + wvz * fz) * KEEP; car.vy = (wvx * rx + wvz * rz) * KEEP;
    car.hit = Math.max(car.hit || 0, speed * (1 - KEEP));
    sound?.smash?.(broke, 1.5);
    stats.smash('glass', broke);
  }

  const tmpQ = new THREE.Quaternion(), vp = new THREE.Vector3();
  function moveFlyers(dt) {
    let moving = false;
    for (const f of flyers) {
      if (f.rest) continue;
      moving = true;
      f.v.y -= 9.81 * dt;
      f.m.position.addScaledVector(f.v, dt);
      const wl = f.w.length();
      if (wl > 1e-3) { tmpQ.setFromAxisAngle(vp.copy(f.w).divideScalar(wl), wl * dt); f.m.quaternion.premultiply(tmpQ); }
      const g = world.heightAt(f.m.position.x, f.m.position.z) + f.half * 0.6;
      if (f.m.position.y < g) {
        f.m.position.y = g;
        f.v.y = Math.abs(f.v.y) * 0.3; f.v.x *= 0.55; f.v.z *= 0.55; f.w.multiplyScalar(0.5);
        if (f.v.y < 0.6 && Math.hypot(f.v.x, f.v.z) < 0.3) f.rest = true;
      }
    }
    return moving;
  }

  // (a hit that has settled is folded into each mesh's settled offsets and dropped, so many hits in a row
  // cost no more per frame than one)
  function bendFrames(dt) {
    let busy = false;
    for (const h of hits) { h.t += dt; busy = true; }
    if (!busy) return;
    for (const B of bent) {
      const pos = B.m.geometry.attributes.position, a = pos.array, base = B.base;
      const set = (B.set ||= new Float32Array(pos.count * 3));
      for (let k = 0; k < pos.count; k++) {
        const up = Math.max(0, Math.min(1, (base[k * 3 + 1] - y) / H)) ** 1.4;
        const mid = Math.max(0, Math.min(1, ((base[k * 3 + 1] - y) / H - 0.38) / 0.17));      // above where the posts snap
        if (up === 0) { a[k * 3] = base[k * 3]; a[k * 3 + 1] = base[k * 3 + 1]; a[k * 3 + 2] = base[k * 3 + 2]; continue; }
        let ox = set[k * 3], oy = set[k * 3 + 1], oz = set[k * 3 + 2];
        for (const h of hits) {
          const done = h.t >= 0.9;
          const e = done ? 1 : Math.min(1, 1 - Math.exp(-h.t * 22) * Math.cos(h.t * 34));   // eases in, wobbles once
          // a snap throws everything above the break over, the stumps below only lean
          const f = Math.exp(-(((B.s[k] - h.s) / h.r) ** 2)) * e * (h.snap ? mid + (1 - mid) * 0.25 * up : up);
          const sag = Math.hypot(h.dx, h.dz) * (h.snap ? 0.25 : 0.2 * up) * f;               // the roof sags where it is pushed
          ox += h.dx * f; oz += h.dz * f; oy -= sag;
          if (done) { set[k * 3] += h.dx * f; set[k * 3 + 1] -= sag; set[k * 3 + 2] += h.dz * f; }
        }
        // the posts lean over rather than stretch: what is pushed sideways comes down as well
        const rise = base[k * 3 + 1] - y, side = Math.hypot(ox, oz);
        if (rise > 0 && side > 0) oy -= rise - Math.sqrt(Math.max(rise * rise * 0.04, rise * rise - side * side));
        a[k * 3] = base[k * 3] + ox; a[k * 3 + 1] = base[k * 3 + 1] + oy; a[k * 3 + 2] = base[k * 3 + 2] + oz;
      }
      pos.needsUpdate = true;
      B.m.geometry.computeVertexNormals();
      B.m.geometry.computeBoundingSphere();
    }
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].t >= 0.9) hits.splice(i, 1);
  }

  // ---- the car against the shelter: the closest point of its outline to the box; a hit is when it is up
  // against it and was coming in at speed the frame before
  let prev = null, settled = true;
  function update(car, dt, sound) {
    cool = Math.max(0, cool - dt);
    const dx = car.x - box.x, dz = car.z - box.z;
    const near = dx * dx + dz * dz < 100;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const vx = car.vx * fx + car.vy * rx, vz = car.vx * fz + car.vy * rz;
    if (near && prev && cool === 0 && Math.abs(car.y - y) < 2.5) {
      let best = Infinity, bx = 0, bz = 0, cx = 0, cz = 0, piece = null;
      for (const [l, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [0.5, 1], [0.5, -1], [-0.5, 1], [-0.5, -1]]) {
        const px = car.x + fx * l * car.halfLen + rx * t * car.halfWid, pz = car.z + fz * l * car.halfLen + rz * t * car.halfWid;
        const [ls, ln] = local(px, pz);
        for (const [s0, s1, n0, n1] of solid) {            // (the open front lets a car in: only the solid parts count)
          const qs = Math.max(s0, Math.min(s1, ls)), qn = Math.max(n0, Math.min(n1, ln));
          const d = Math.hypot(ls - qs, ln - qn);
          if (d < best) { best = d; bx = box.x + ux * qs + nx * qn; bz = box.z + uz * qs + nz * qn; cx = px; cz = pz; piece = s0 === -box.hx && s1 === box.hx ? 'back' : 'end'; }
        }
      }
      if (best < 0.35) {
        // how fast it was closing on the box, and how much of that it lost against it
        let ddx = bx - cx, ddz = bz - cz, dl = Math.hypot(ddx, ddz);
        if (dl < 1e-3) { ddx = box.x - car.x; ddz = box.z - car.z; dl = Math.hypot(ddx, ddz) || 1; }
        ddx /= dl; ddz /= dl;
        const closing = prev[0] * ddx + prev[1] * ddz, now = vx * ddx + vz * ddz;
        const speed = closing - Math.max(0, now);
        if (closing > 1.2 && speed > 1.0) {
          const pv = Math.hypot(prev[0], prev[1]) || 1;
          // bent along the way the car was going, leaning towards the side it hit
          const dirX = 0.6 * prev[0] / pv + 0.4 * ddx, dirZ = 0.6 * prev[1] / pv + 0.4 * ddz, l = Math.hypot(dirX, dirZ) || 1;
          // across a long side (into the open front, or into the glass back from behind)?
          const across = prev[0] * nx + prev[1] * nz;
          const longSide = piece === 'back' && Math.abs(across) > 0.6 * pv;
          if (longSide && Math.abs(across) >= THROUGH) breakThrough(bx, bz, prev[0] / pv, prev[1] / pv, pv, car, prev[0], prev[1], sound);
          else if (longSide) glassOnly(bx, bz, dirX / l, dirZ / l, speed, sound);
          else hit(bx, bz, dirX / l, dirZ / l, speed, sound);
          cool = 0.35;
          settled = false;
        }
      }
    }
    prev = near ? [vx, vz] : null;
    if (!settled) {
      bendFrames(dt);
      const moving = shards.update(dt);
      const flying = flyers.length ? moveFlyers(dt) : false;
      if (!moving && !flying && hits.length === 0) settled = true;
    }
  }

  // its roof, for a car to come down on (src/cars/tops.js; Martin, 26 Nov: "I would like to land on bus shelters
  // too"): flat, the sheet over the box a hand's width all round
  const top = { x: box.x, z: box.z, y, yaw: -box.yaw, hl: box.hz + 0.08, hw: box.hx + 0.08, h: H + 0.1, flat: true, dx: 0, dz: 0, dyaw: 0, vx: 0, vz: 0 };
  topWorld = world;
  const info = () => ({ box, y, broken: P.filter((q) => q.broken).length, panes: P.length, bend: total, shards: shards.count, through });
  const rec = { update, hit, box, info, top };
  // has it been hit at all (a damaged shelter is kept as it is while its piece of the map is loaded)
  rec.damaged = () => total > 0 || shards.count > 0;
  rec.through = () => through;
  // take it out of the list and free what it made (the bus stops build one when a car comes near)
  rec.remove = () => {
    const k = shelters.indexOf(rec);
    if (k >= 0) shelters.splice(k, 1);
    shards.dispose(); glassMat.dispose();
    for (const q of P) { group.remove(q.mesh); q.mesh.geometry.dispose(); }
  };
  shelters.push(rec);
  return rec;
}

// (and the roofs of those near the car, as tops it can stand on; one crashed through has none)
const roofs = [];
let topWorld = null;
export function updateShelters(car, dt, sound) {
  roofs.length = 0;
  for (const s of shelters) {
    s.update(car, dt, sound);
    if (!s.through() && Math.abs(s.box.x - car.x) < 25 && Math.abs(s.box.z - car.z) < 25) roofs.push(s.top);
  }
  topWorld?.setTops?.('shelters', roofs);
}

// (for the tools: where the shelters are and how broken)
export function shelterInfo() {
  return shelters.map((s) => s.info());
}
