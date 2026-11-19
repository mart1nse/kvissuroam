// Bus shelters that a car can damage (Martin, 19 Nov): hit one and the glass panes near the impact burst
// into small pieces that rain onto the pavement and stay there, and the frame (posts, roof, bench, advert
// panel) bends away from the car, more the harder the hit, up to a limit. Each hand-built shelter (Emajõe,
// Lai, Kroonuaia) hands its frame and its panes to breakableShelter(); updateShelters() runs every frame
// after the car has moved. The shelter stays a solid box for the car (the posts hold); the damage lasts
// until the page is loaded again.
import * as THREE from 'three';

const shelters = [];
const SHATTER = 2.2;        // m/s into the shelter: below this the frame only shakes and bends a touch
const ALL = 7.5;            // m/s: every pane goes
const BEND_MAX = 0.42;      // m, how far the top of the frame can be pushed over in all
const REACH = 2.3;          // m along the shelter: how far the bend spreads either side of the impact
const SHARDS = 150;         // pieces per pane

// box: { x, z, yaw, hx, hz } the shelter's footprint as given to world.addSolids (local x = cos yaw, -sin yaw)
// y: the ground under it, H: its height
// frame: a Mesh (vertex-coloured, world coordinates), bent as one piece
// bendAlso: other meshes to bend with it (e.g. the advert); their transforms are baked into their vertices
// panes: [{ a: [x, z], b: [x, z], y0, y1 }] vertical glass between two ground points
export function breakableShelter(world, group, { box, y, H, frame, bendAlso = [], panes, glass = 0xcfe6f2, opacity = 0.32 }) {
  const ux = Math.cos(box.yaw), uz = -Math.sin(box.yaw);          // along the shelter
  const nx = Math.sin(box.yaw), nz = Math.cos(box.yaw);           // across it
  const local = (x, z) => [(x - box.x) * ux + (z - box.z) * uz, (x - box.x) * nx + (z - box.z) * nz];

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
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.025, 0, -0.018, 0.028, 0, -0.012, 0.002, 0, 0.03], 3));
  shardGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const shardMat = new THREE.MeshLambertMaterial({ color: 0xe4f6fb, emissive: 0x3a5866, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const nMax = SHARDS * panes.length;
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, nMax);
  shards.count = 0;
  shards.frustumCulled = false;
  group.add(shards);
  const S = [];            // { p, v, axis, ang, spin, rest }
  const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), vp = new THREE.Vector3();

  // ---- damage state: the bend's top displacement (world x, z), where along the shelter it centres,
  // and the hits still settling (each eases in with a little wobble)
  const hits = [];
  let total = 0, cool = 0;

  function shatter(q, dirX, dirZ, speed) {
    q.broken = true;
    q.mesh.visible = false;
    for (let k = 0; k < SHARDS && S.length < nMax; k++) {
      const u = Math.random(), v = Math.random();
      const x = q.a[0] + (q.b[0] - q.a[0]) * u, z = q.a[1] + (q.b[1] - q.a[1]) * u, yy = q.y0 + (q.y1 - q.y0) * v;
      const push = (0.25 + 0.5 * Math.random()) * Math.min(speed, 12) * 0.35;
      S.push({
        p: [x, yy, z],
        v: [dirX * push + (Math.random() - 0.5) * 2.2, 0.4 + Math.random() * 1.8, dirZ * push + (Math.random() - 0.5) * 2.2],
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        ang: Math.random() * 6, spin: (Math.random() - 0.5) * 30, rest: false, size: 0.6 + Math.random() * 0.9,
      });
    }
    shards.count = S.length;
  }

  function hit(px, pz, dirX, dirZ, speed, sound) {
    const sHit = local(px, pz)[0];
    const amount = Math.min(BEND_MAX - total, 0.012 + 0.03 * Math.max(0, speed - 1.5));
    if (amount > 0.002) { total += amount; hits.push({ dx: dirX * amount, dz: dirZ * amount, s: sHit, t: 0 }); }
    let broke = 0;
    for (const q of P) {
      if (q.broken) continue;
      const gap = sHit < q.s0 ? q.s0 - sHit : sHit > q.s1 ? sHit - q.s1 : 0;
      if (speed >= ALL || (speed >= SHATTER && gap < 1.2 + 0.25 * speed)) { shatter(q, dirX, dirZ, speed); broke++; }
    }
    sound?.smash?.(broke, Math.min(1.5, speed / 8));
  }

  function bendFrames(dt) {
    let busy = false;
    for (const h of hits) if (h.t < 0.9) { h.t += dt; busy = true; }
    if (!busy) return;
    for (const B of bent) {
      const pos = B.m.geometry.attributes.position, a = pos.array, base = B.base;
      for (let k = 0; k < pos.count; k++) {
        const up = Math.max(0, Math.min(1, (base[k * 3 + 1] - y) / H)) ** 1.4;
        if (up === 0) { a[k * 3] = base[k * 3]; a[k * 3 + 1] = base[k * 3 + 1]; a[k * 3 + 2] = base[k * 3 + 2]; continue; }
        let ox = 0, oy = 0, oz = 0;
        for (const h of hits) {
          const e = Math.min(1, 1 - Math.exp(-h.t * 22) * Math.cos(h.t * 34));            // eases in, wobbles once
          const f = Math.exp(-(((B.s[k] - h.s) / REACH) ** 2)) * up * e;
          ox += h.dx * f; oz += h.dz * f;
          oy -= Math.hypot(h.dx, h.dz) * 0.35 * f * up;                                     // the roof sags where it is pushed
        }
        a[k * 3] = base[k * 3] + ox; a[k * 3 + 1] = base[k * 3 + 1] + oy; a[k * 3 + 2] = base[k * 3 + 2] + oz;
      }
      pos.needsUpdate = true;
      B.m.geometry.computeVertexNormals();
      B.m.geometry.computeBoundingSphere();
    }
  }

  function moveShards(dt) {
    let moving = false;
    for (let k = 0; k < S.length; k++) {
      const s = S[k];
      if (!s.rest) {
        moving = true;
        s.v[1] -= 9.81 * dt;
        s.p[0] += s.v[0] * dt; s.p[1] += s.v[1] * dt; s.p[2] += s.v[2] * dt;
        s.ang += s.spin * dt;
        const g = world.heightAt(s.p[0], s.p[2]) + 0.012;
        if (s.p[1] < g) {
          s.p[1] = g;
          s.v[1] *= -0.25; s.v[0] *= 0.45; s.v[2] *= 0.45; s.spin *= 0.4;
          if (Math.abs(s.v[1]) < 0.35 && Math.hypot(s.v[0], s.v[2]) < 0.15) { s.rest = true; s.ang = Math.round(s.ang / Math.PI) * Math.PI; s.axis.set(1, 0, 0); }
        }
      }
      quat.setFromAxisAngle(s.axis, s.ang);
      scl.setScalar(s.size);
      mtx.compose(vp.set(s.p[0], s.p[1], s.p[2]), quat, scl);
      shards.setMatrixAt(k, mtx);
    }
    if (moving || S.length) shards.instanceMatrix.needsUpdate = true;
    return moving;
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
      let best = Infinity, bx = 0, bz = 0, cx = 0, cz = 0;
      for (const [l, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [0.5, 1], [0.5, -1], [-0.5, 1], [-0.5, -1]]) {
        const px = car.x + fx * l * car.halfLen + rx * t * car.halfWid, pz = car.z + fz * l * car.halfLen + rz * t * car.halfWid;
        const [ls, ln] = local(px, pz);
        const qs = Math.max(-box.hx, Math.min(box.hx, ls)), qn = Math.max(-box.hz, Math.min(box.hz, ln));
        const d = Math.hypot(ls - qs, ln - qn);
        if (d < best) { best = d; bx = box.x + ux * qs + nx * qn; bz = box.z + uz * qs + nz * qn; cx = px; cz = pz; }
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
          hit(bx, bz, dirX / l, dirZ / l, speed, sound);
          cool = 0.35;
          settled = false;
        }
      }
    }
    prev = near ? [vx, vz] : null;
    if (!settled) {
      bendFrames(dt);
      const moving = moveShards(dt);
      if (!moving && hits.every((h) => h.t >= 0.9)) settled = true;
    }
  }

  const info = () => ({ box, y, broken: P.filter((q) => q.broken).length, panes: P.length, bend: total, shards: S.length });
  const rec = { update, hit, box, info };
  shelters.push(rec);
  return rec;
}

export function updateShelters(car, dt, sound) {
  for (const s of shelters) s.update(car, dt, sound);
}

// (for the tools: where the shelters are and how broken)
export function shelterInfo() {
  return shelters.map((s) => s.info());
}
