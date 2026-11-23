// Red and white barrier tape on plain wooden sticks, where the Raadi stage's penalties begin (Martin, 23 Nov
// 2026, with a photo of the tape: "instead of the red halo, use the white and red tape on simple wood sticks. I
// can bump into them and they break and the tape is flying where it was cut from").
//
// A stick every 4 m along each line, the tape from top to top with a little sag. A car through a span cuts the
// tape there: the two ends are thrown the way the car goes and then hang from their sticks and wave in the wind
// and in the car's wake. A stick that is hit goes over and takes its ends of tape down with it. Tape weighs
// nothing to a car: it is not slowed. reset() ties everything up again (at every start of the stage).
//
// Three draw calls: the sticks (instanced), the whole tape (one mesh; a cut span is folded away) and the loose
// ends (a pool of ENDS ribbons of NODES points, moved as chains of points). Nothing runs while the car is away
// from the tape and no end is moving.
import * as THREE from 'three';

const STEP = 4;                    // metres between sticks
const STICK = 1.08, TIE = 0.92;    // a stick's height, and where the tape is tied
const WIDE = 0.085;                // the tape's width
const STRIPE = 0.34;               // metres of tape per picture (two red stripes)
const ENDS = 32, NODES = 9;        // loose ends at once, points in each
const WIND = [0.8, 0, 0.45];       // the breeze, m/s

function tapeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#d2141c';
  for (let x = -16; x < 80; x += 32) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 16); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// world: heightAt. wood(kind, level): the snap of a stick. lines: lists of [x, z] points along each line (a
// list's own `step` sets its sticks closer than STEP).
export function createTape({ world, group, wood }) {
  const sticks = [];               // { x, y, z, lean (quaternion), down, t, dx, dz, sp: spans tied to it }
  const spans = [];                // { a, b (sticks), len, cut, v (first vertex), u (texture start) }
  const ends = [];                 // the pool: { live, pin (stick or null), p, q (points now and before), seg, age, nx, nz, calm }
  let stickMesh = null, tapeMesh = null, endMesh = null, rest = null, dirty = false, moving = 0, clock = 0, snapT = -1, cx = 0, cz = 0, cr = 0;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), qa = new THREE.Quaternion(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), axis = new THREE.Vector3();
  const tie = (s, out, o = 0) => { out[o] = s.x; out[o + 1] = s.y + TIE; out[o + 2] = s.z; };

  function drawStick(s, n) {
    // standing with the lean it was hammered in with; down: over about its foot, the way it was knocked
    q4.copy(s.lean);
    if (s.t > 0) {
      const k = Math.min(1, s.t / 0.3), a = (1 - (1 - k) * (1 - k)) * 1.5;
      q4.premultiply(qa.setFromAxisAngle(axis.set(s.dz, 0, -s.dx), a));
    }
    stickMesh.setMatrixAt(n, m4.compose(v3.set(s.x, s.y - 0.02, s.z), q4, one));
    stickMesh.instanceMatrix.needsUpdate = true;
  }

  function build(lines, clear) {
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const line of lines) {
      // the line by its length, a stick every STEP or a little less
      const acc = [0];
      for (let i = 1; i < line.length; i++) acc.push(acc[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
      const total = acc.at(-1), n = Math.max(1, Math.round(total / (line.step || STEP)));
      let prev = null, j = 0, u = 0;
      for (let k = 0; k <= n; k++) {
        const d = total * k / n;
        while (j < line.length - 2 && acc[j + 1] < d) j++;
        const f = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
        const x = line[j][0] + (line[j + 1][0] - line[j][0]) * f, z = line[j][1] + (line[j + 1][1] - line[j][1]) * f;
        if (!clear(x, z)) { prev = null; continue; }
        const s = { x, y: world.heightAt(x, z), z, down: false, t: 0, dx: 0, dz: 0, sp: [], n: sticks.length,
          lean: new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.07, rnd() * 3, (rnd() - 0.5) * 0.07)) };
        sticks.push(s);
        if (prev) {
          const len = Math.hypot(s.x - prev.x, s.z - prev.z);
          if (len > 0.6 && len < STEP * 1.6) { const sp = { a: prev, b: s, len, cut: false, v: spans.length * 6, u }; spans.push(sp); prev.sp.push(sp); s.sp.push(sp); u += len / STRIPE; }
        }
        prev = s;
      }
    }
    // (a stick left with no tape to hold, where its neighbours would have stood on the road, is not put in)
    for (let k = sticks.length - 1; k >= 0; k--) if (!sticks[k].sp.length) sticks.splice(k, 1);
    sticks.forEach((s, k) => { s.n = k; });
    if (!sticks.length) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const s of sticks) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    cx = (x0 + x1) / 2; cz = (z0 + z1) / 2; cr = Math.hypot(x1 - x0, z1 - z0) / 2 + 12;

    // the sticks: sawn softwood, 40 x 28 mm
    const sg = new THREE.BoxGeometry(0.04, STICK, 0.028).translate(0, STICK / 2, 0);
    stickMesh = new THREE.InstancedMesh(sg, new THREE.MeshLambertMaterial({ color: 0xc9a66f }), sticks.length);
    stickMesh.frustumCulled = false;
    sticks.forEach(drawStick);
    group.add(stickMesh);

    // the tape: per span three pairs of points (stick, sagging middle, stick)
    const pos = new Float32Array(spans.length * 18), nor = new Float32Array(spans.length * 18), uv = new Float32Array(spans.length * 12), idx = [];
    spans.forEach((sp, k) => {
      const { a, b } = sp, nx = (b.z - a.z) / sp.len, nz = -(b.x - a.x) / sp.len;
      for (let q = 0; q < 3; q++) {
        const f = q / 2, x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, y = a.y + (b.y - a.y) * f + TIE - (q === 1 ? 0.012 * sp.len : 0);
        for (let e = 0; e < 2; e++) {
          const o = k * 18 + (q * 2 + e) * 3;
          pos[o] = x; pos[o + 1] = y + (e ? WIDE / 2 : -WIDE / 2); pos[o + 2] = z;
          nor[o] = nx; nor[o + 1] = 0.25; nor[o + 2] = nz;
          uv[k * 12 + (q * 2 + e) * 2] = sp.u + f * sp.len / STRIPE; uv[k * 12 + (q * 2 + e) * 2 + 1] = e;
        }
      }
      for (let q = 0; q < 2; q++) { const v = k * 6 + q * 2; idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
    });
    rest = pos.slice();
    const map = tapeTexture();
    const mat = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    tg.setIndex(idx);
    tapeMesh = new THREE.Mesh(tg, mat);
    tapeMesh.frustumCulled = false;
    group.add(tapeMesh);

    // the loose ends
    const ep = new Float32Array(ENDS * NODES * 6), en = new Float32Array(ENDS * NODES * 6), eu = new Float32Array(ENDS * NODES * 4), ei = [];
    for (let e = 0; e < ENDS; e++) {
      ends.push({ live: false, pin: null, p: new Float32Array(NODES * 3), q: new Float32Array(NODES * 3), seg: 0, age: 0, nx: 0, nz: 1, calm: 0, u: 0, n: e });
      for (let k = 0; k < NODES; k++) {
        en[(e * NODES + k) * 6 + 1] = en[(e * NODES + k) * 6 + 4] = 1;
        if (k) { const v = (e * NODES + k - 1) * 2; ei.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
      }
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(ep, 3).setUsage(THREE.DynamicDrawUsage));
    eg.setAttribute('normal', new THREE.BufferAttribute(en, 3).setUsage(THREE.DynamicDrawUsage));
    eg.setAttribute('uv', new THREE.BufferAttribute(eu, 2).setUsage(THREE.DynamicDrawUsage));
    eg.setIndex(ei);
    endMesh = new THREE.Mesh(eg, mat);
    endMesh.frustumCulled = false;
    group.add(endMesh);
  }

  // a loose end of tape from stick `pin` towards (tx, ty, tz), len metres of it, thrown at (vx, vz)
  function loose(pin, tx, ty, tz, len, vx, vz, u, back) {
    if (len < 0.25) return;
    let e = ends.find((q) => !q.live);
    if (!e) { e = ends.reduce((a, b) => (b.age > a.age ? b : a)); if (!e.calm) moving--; }
    e.live = true; e.pin = pin; e.seg = len / (NODES - 1); e.age = 0; e.calm = 0; moving++;
    const l = Math.hypot(tx - pin.x, tz - pin.z) || 1;
    e.nx = (tz - pin.z) / l; e.nz = -(tx - pin.x) / l;
    const uv = endMesh.geometry.attributes.uv, nor = endMesh.geometry.attributes.normal;
    for (let k = 0; k < NODES * 2; k++) nor.setXYZ(e.n * NODES * 2 + k, e.nx, 0.25, e.nz);
    nor.needsUpdate = true;
    for (let k = 0; k < NODES; k++) {
      const f = k / (NODES - 1), o = k * 3;
      e.p[o] = pin.x + (tx - pin.x) * f; e.p[o + 1] = pin.y + TIE + (ty - pin.y - TIE) * f; e.p[o + 2] = pin.z + (tz - pin.z) * f;
      // (the further from the stick, the more of the car's speed it took before it gave)
      const w = f * f * 0.9, dt = 1 / 60;
      e.q[o] = e.p[o] - vx * w * dt; e.q[o + 1] = e.p[o + 1] - (0.6 + 1.6 * f) * dt; e.q[o + 2] = e.p[o + 2] - vz * w * dt;
      const uu = u + (back ? -1 : 1) * f * len / STRIPE, v = (e.n * NODES + k) * 2;
      uv.setXY(v, uu, 0); uv.setXY(v + 1, uu, 1);
    }
    uv.needsUpdate = true;
  }

  function cut(sp, f, vx, vz) {
    if (sp.cut) return;
    sp.cut = true;
    const { a, b } = sp, pos = tapeMesh.geometry.attributes.position;
    const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, y = a.y + (b.y - a.y) * f + TIE;
    for (let k = 0; k < 6; k++) pos.setXYZ(sp.v + k, a.x, a.y - 5, a.z);
    pos.needsUpdate = true; dirty = true;
    if (!a.down) loose(a, x, y, z, sp.len * f, vx, vz, sp.u, false);
    if (!b.down) loose(b, x, y, z, sp.len * (1 - f), vx, vz, sp.u + sp.len / STRIPE, true);
  }

  function reset() {
    if (!tapeMesh || !dirty) return;
    dirty = false; moving = 0;
    tapeMesh.geometry.attributes.position.array.set(rest);
    tapeMesh.geometry.attributes.position.needsUpdate = true;
    for (const sp of spans) sp.cut = false;
    sticks.forEach((s, n) => { if (s.down) { s.down = false; s.t = 0; drawStick(s, n); } });
    for (const e of ends) e.live = false;
    endMesh.geometry.attributes.position.array.fill(0);
    endMesh.geometry.attributes.position.needsUpdate = true;
  }

  function update(car, dt) {
    if (!tapeMesh) return;
    const far = Math.hypot(car.x - cx, car.z - cz) > cr;
    if (far && !moving) return;
    dt = Math.min(dt || 0.016, 0.05);
    clock += dt;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz, speed = Math.hypot(wvx, wvz);
    const hl = (car.halfLen || 2.2) + 0.03, hw = (car.halfWid || 0.9) + 0.03;
    let snapped = 0;
    if (!far && speed > 0.4) {
      const reach = (hl + STEP * 1.6 + 0.5) ** 2;
      for (const s of sticks) {
        const dx = s.x - car.x, dz = s.z - car.z;
        if (dx * dx + dz * dz > reach) continue;
        const lf = dx * fx + dz * fz, ll = dx * rx + dz * rz;
        // the stick itself: over it goes, the way the car is going, with the tape tied to it
        if (!s.down && Math.abs(lf) < hl && Math.abs(ll) < hw) {
          s.down = true; s.t = 1e-3; s.dx = wvx / speed; s.dz = wvz / speed; snapped++;
          for (const e of ends) if (e.live && e.pin === s) { e.pin = null; if (e.calm) { e.calm = 0; moving++; } }
          for (const sp of s.sp) cut(sp, sp.a === s ? 0.02 : 0.98, wvx, wvz);
        }
        // and the tape from it to the next: where the car's outline crosses the span (clipped in the car's own frame)
        for (const sp of s.sp) {
          if (sp.cut || sp.a !== s) continue;
          const ex = sp.b.x - car.x, ez = sp.b.z - car.z, bf = ex * fx + ez * fz, bl = ex * rx + ez * rz;
          let t0 = 0, t1 = 1, ok = true;
          for (const [p, d, h] of [[lf, bf - lf, hl], [ll, bl - ll, hw]]) {
            if (Math.abs(d) < 1e-6) { if (Math.abs(p) > h) ok = false; continue; }
            let ta = (-h - p) / d, tb = (h - p) / d;
            if (ta > tb) [ta, tb] = [tb, ta];
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          }
          if (ok && t0 < t1) cut(sp, Math.max(0.06, Math.min(0.94, (t0 + t1) / 2)), wvx, wvz);
        }
      }
    }
    if (snapped && clock - snapT > 0.07) { snapT = clock; wood?.('snap', Math.min(0.8, 0.25 + speed / 30)); }
    // sticks going over
    for (const s of sticks) if (s.down && s.t < 0.3) { s.t = Math.min(0.3, s.t + dt); drawStick(s, s.n); }
    // the loose ends: chains of points (each keeps its distance to the one before), gravity, a lot of air for
    // their weight, the breeze, and the wake of a car going by
    const pos = endMesh.geometry.attributes.position, A = pos.array;
    const drag = Math.exp(-2.2 * dt), g = 9.81 * dt * dt;
    let drawn = false;
    for (const e of ends) {
      if (!e.live) continue;
      const p = e.p, q = e.q;
      const d2 = (p[(NODES - 1) * 3] - car.x) ** 2 + (p[(NODES - 1) * 3 + 2] - car.z) ** 2, wake = d2 < 36 ? (1 - d2 / 36) * 0.5 : 0;
      // (lying or hanging with the car far off: left as it is until the car is back)
      if (e.calm) { if (d2 > 45 * 45) continue; e.calm = 0; moving++; }
      else if (e.age > 5 && d2 > 60 * 60) { e.calm = 1; moving--; continue; }
      e.age += dt; drawn = true;
      const low = (e.pin ? e.pin.y : p[1]) + 0.4;
      for (let k = e.pin ? 1 : 0; k < NODES; k++) {
        const o = k * 3, f = k / (NODES - 1);
        const gust = 0.6 + 0.4 * Math.sin(clock * 1.3 + e.n) + 0.25 * Math.sin(clock * 7.1 + k * 1.7 + e.n * 2.3);
        const flap = Math.sin(clock * 9.3 + k * 1.1 + e.n) * 1.4 * f;
        const ax = (WIND[0] * gust + e.nx * flap + wvx * wake) * 2.2, az = (WIND[2] * gust + e.nz * flap + wvz * wake) * 2.2, ay = (0.9 * gust * f + speed * wake * 0.35) * 2.2;
        let vx = (p[o] - q[o]) * drag + ax * dt * dt, vy = (p[o + 1] - q[o + 1]) * drag - g + ay * dt * dt, vz = (p[o + 2] - q[o + 2]) * drag + az * dt * dt;
        q[o] = p[o]; q[o + 1] = p[o + 1]; q[o + 2] = p[o + 2];
        p[o] += vx; p[o + 1] += vy; p[o + 2] += vz;
        if (p[o + 1] < low) {
          const gy = world.heightAt(p[o], p[o + 2]) + 0.03;
          if (p[o + 1] < gy) { p[o + 1] = gy; q[o] = p[o] - vx * 0.5; q[o + 2] = p[o + 2] - vz * 0.5; }
        }
      }
      if (e.pin) tie(e.pin, p);
      for (let it = 0; it < 3; it++) {
        for (let k = 1; k < NODES; k++) {
          const a = (k - 1) * 3, b = k * 3;
          let dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
          const l = Math.hypot(dx, dy, dz) || 1e-6, c = (l - e.seg) / l;
          if (k === 1 && e.pin) { p[b] -= dx * c; p[b + 1] -= dy * c; p[b + 2] -= dz * c; }
          else { p[a] += dx * c * 0.5; p[a + 1] += dy * c * 0.5; p[a + 2] += dz * c * 0.5; p[b] -= dx * c * 0.5; p[b + 1] -= dy * c * 0.5; p[b + 2] -= dz * c * 0.5; }
        }
      }
      // the ribbon: its width across the way it runs, turning as it flaps
      for (let k = 0; k < NODES; k++) {
        const a = Math.max(0, k - 1) * 3, b = Math.min(NODES - 1, k + 1) * 3, o = k * 3;
        let tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], tz = p[b + 2] - p[a + 2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        const tw = k ? Math.sin(clock * 6.1 + k * 0.9 + e.n) * 0.9 * (k / (NODES - 1)) : 0, cs = Math.cos(tw), sn = Math.sin(tw);
        // (across: the tape's flat side keeps facing the way it did on the sticks, e.nx/e.nz, then twists by tw)
        let wx = ty * e.nz - tz * 0, wy = tz * e.nx - tx * e.nz, wz = tx * 0 - ty * e.nx;
        let wl = Math.hypot(wx, wy, wz);
        if (wl < 0.2) { wx = 0; wy = 1; wz = 0; wl = 1; }
        wx /= wl; wy /= wl; wz /= wl;
        const ux = wx * cs + e.nx * sn, uy = wy * cs, uz = wz * cs + e.nz * sn, h = WIDE / 2, v = (e.n * NODES + k) * 6;
        A[v] = p[o] - ux * h; A[v + 1] = p[o + 1] - uy * h; A[v + 2] = p[o + 2] - uz * h;
        A[v + 3] = p[o] + ux * h; A[v + 4] = p[o + 1] + uy * h; A[v + 5] = p[o + 2] + uz * h;
      }
    }
    if (drawn) pos.needsUpdate = true;
  }

  return {
    build, reset, update,
    get built() { return !!tapeMesh; },
    get sticks() { return sticks; },
    get spans() { return spans; },
    get ends() { return ends; },
  };
}
