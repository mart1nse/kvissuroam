// Loose straw out of a bale that a car hits (Martin 26 Nov 2026: "have some straws fall or fly out"): wisps of
// a few stalks that burst from where the bale was struck, fly with the car's speed, slow in the air and flutter
// down, and then lie on the grass until the next run. A car driving through the lying ones whirls them up again.
// One InstancedMesh of small flat strips for all of them (eight triangles a wisp), made with the bales and empty
// until the first hit: nothing is built or compiled when it happens. When all are out the oldest is taken again.
import * as THREE from 'three';

const G = 9.81;
const COLORS = [0xf0d588, 0xe6c76e, 0xf7e6a8, 0xdcb85c, 0xfbefc0];     // dry straw, light to dark
const WRAP = 0xf1f3f4;                                                  // a shred of white wrap

// a wisp: four stalks lying nearly the same way, fanned a little, each a thin flat strip up to 0.34 m long
function wispGeometry(W) {
  const pos = [], nor = [], idx = [];
  const e = new THREE.Euler(), q = new THREE.Quaternion(), v = new THREE.Vector3(), n = new THREE.Vector3();
  // [length, turned about the upright, tipped up at one end, rolled about itself, moved by x, y, z]
  const stalks = [[0.34, 0, 0, 0, 0, 0, 0], [0.27, 0.42, 0.1, 0.8, 0.03, 0.006, 0.02], [0.3, -0.3, -0.14, 1.4, -0.03, 0.01, -0.025], [0.2, 0.95, 0.05, 0.4, -0.05, 0.004, 0.03]];
  for (const [len, ry, rz, rx, ox, oy, oz] of stalks) {
    q.setFromEuler(e.set(rx, ry, rz, 'YZX'));
    n.set(0, 1, 0).applyQuaternion(q);
    const b = pos.length / 3;
    for (const [x, z] of [[-len / 2, -W], [len / 2, -W], [len / 2, W], [-len / 2, W]]) {
      v.set(x, 0, z).applyQuaternion(q);
      pos.push(v.x + ox, v.y + oy, v.z + oz); nor.push(n.x, n.y, n.z);
    }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

// max: how many wisps at most, all bales together; wide: thicker stalks (a small screen, where thin ones flicker)
export function createStraw({ world, group, max = 240, wide = false }) {
  let mesh = null, used = 0, next = 0, flying = 0, resting = 0;
  // per wisp: place, speed, the axis it turns about, angle and spin, size, how the air holds it; state 0 none, 1 in the air, 2 lying
  const P = new Float32Array(max * 3), V = new Float32Array(max * 3), AX = new Float32Array(max * 3);
  const ang = new Float32Array(max), spin = new Float32Array(max), size = new Float32Array(max), drag = new Float32Array(max), sway = new Float32Array(max);
  const state = new Uint8Array(max);
  const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), vp = new THREE.Vector3(), axis = new THREE.Vector3(), col = new THREE.Color();
  const eul = new THREE.Euler();
  let clock = 0;

  function build() {
    if (mesh) return;
    mesh = new THREE.InstancedMesh(wispGeometry(wide ? 0.014 : 0.009), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), max);
    mesh.setColorAt(0, col.set(COLORS[0]));          // (its colours are there from the start: the same shader before and after the first hit)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = 'bale straw';
    group.add(mesh);
  }

  function put(k) {
    if (state[k] === 2) {
      // lying: flat on the ground, turned any way
      eul.set((sway[k] - 0.5) * 0.3, ang[k], (drag[k] % 1 - 0.5) * 0.3);
      quat.setFromEuler(eul);
    } else {
      quat.setFromAxisAngle(axis.set(AX[k * 3], AX[k * 3 + 1], AX[k * 3 + 2]), ang[k]);
    }
    scl.setScalar(size[k]);
    mtx.compose(vp.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]), quat, scl);
    mesh.setMatrixAt(k, mtx);
  }

  // n wisps from about (x, y, z), thrown with the speed (vx, vz) and `out` m/s of scatter; `white`: some are wrap
  function burst(x, y, z, vx, vz, out, n, white = false) {
    if (!mesh) return;
    for (let i = 0; i < n; i++) {
      const k = next; next = (next + 1) % max;
      if (state[k] === 1) flying--; else if (state[k] === 2) resting--;
      used = Math.max(used, k + 1);
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.3, share = 0.25 + Math.random() * 0.75;
      P[k * 3] = x + Math.cos(a) * r; P[k * 3 + 1] = y + (Math.random() - 0.3) * 0.5; P[k * 3 + 2] = z + Math.sin(a) * r;
      V[k * 3] = vx * share + Math.cos(a) * out * Math.random();
      V[k * 3 + 1] = (0.6 + Math.random() * 1.6) * (1 + out * 0.4);
      V[k * 3 + 2] = vz * share + Math.sin(a) * out * Math.random();
      axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      AX[k * 3] = axis.x; AX[k * 3 + 1] = axis.y; AX[k * 3 + 2] = axis.z;
      ang[k] = Math.random() * 6.3; spin[k] = (Math.random() - 0.5) * 22;
      size[k] = 0.5 + Math.random() * 0.8;
      // (the small ones are chaff: the air holds them longer)
      drag[k] = 1.6 + (1.3 - size[k]) * 2.4 + Math.random() * 0.8;
      sway[k] = Math.random();
      state[k] = 1; flying++;
      mesh.setColorAt(k, col.set(white && Math.random() < 0.4 ? WRAP : COLORS[(Math.random() * COLORS.length) | 0]));
      put(k);
    }
    mesh.count = used;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  // each frame: the ones in the air fall; a car going through the ones on the ground lifts them again
  function update(car, dt) {
    if (!mesh || !used || dt <= 0) return;
    clock += dt;
    let moved = false;
    if (resting) {
      const sp = Math.hypot(car.vx, car.vy);
      if (sp > 4) {
        const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), hl = car.halfLen + 0.3, hw = car.halfWid + 0.25;
        const wvx = car.vx * fx + car.vy * -fz, wvz = car.vx * fz + car.vy * fx;
        for (let k = 0; k < used; k++) {
          if (state[k] !== 2) continue;
          const dx = P[k * 3] - car.x, dz = P[k * 3 + 2] - car.z;
          if (dx * dx + dz * dz > 9 || Math.abs(dx * fx + dz * fz) > hl || Math.abs(-dx * fz + dz * fx) > hw) continue;
          const s = 0.15 + Math.random() * 0.3;
          V[k * 3] = wvx * s + (Math.random() - 0.5) * 3; V[k * 3 + 1] = 0.8 + Math.random() * Math.min(3, sp * 0.15); V[k * 3 + 2] = wvz * s + (Math.random() - 0.5) * 3;
          spin[k] = (Math.random() - 0.5) * 20;
          P[k * 3 + 1] += 0.08;
          state[k] = 1; resting--; flying++;
        }
      }
    }
    if (flying) {
      for (let k = 0; k < used; k++) {
        if (state[k] !== 1) continue;
        const i = k * 3, d = Math.exp(-drag[k] * dt);
        // (a flat thing falling: it slows in the air and slides from side to side on the way down)
        const sw = Math.sin(clock * 5 + sway[k] * 40) * 2.5 * dt;
        V[i] = V[i] * d + sw * AX[i + 2]; V[i + 2] = V[i + 2] * d + sw * AX[i];
        V[i + 1] = (V[i + 1] - G * dt) * d;
        P[i] += V[i] * dt; P[i + 1] += V[i + 1] * dt; P[i + 2] += V[i + 2] * dt;
        ang[k] += spin[k] * dt;
        spin[k] *= Math.exp(-0.8 * dt);
        if (V[i + 1] < 0) {
          const g = world.heightAt(P[i], P[i + 2]) + 0.03;
          if (P[i + 1] <= g) { P[i + 1] = g; V[i] = V[i + 1] = V[i + 2] = 0; state[k] = 2; flying--; resting++; }
        }
        put(k);
        moved = true;
      }
    }
    if (moved) mesh.instanceMatrix.needsUpdate = true;
  }

  // all of it away (a new run)
  function clear() {
    state.fill(0);
    used = next = flying = resting = 0;
    if (mesh) mesh.count = 0;
  }

  return { build, burst, update, clear, max, get count() { return flying + resting; }, get flying() { return flying; }, get mesh() { return mesh; } };
}
