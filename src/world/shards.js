// Broken glass: little triangles that burst out of a pane, fly, bounce and then lie on the ground for good.
// Shared by the bus shelters (shelter.js) and the Orident glass corner (orident.js). One InstancedMesh per
// owner, made the first time something breaks (an unbroken shelter or house costs nothing).
import * as THREE from 'three';

let geo = null;
const shardGeo = () => {
  if (geo) return geo;
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.025, 0, -0.018, 0.028, 0, -0.012, 0.002, 0, 0.03], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  return geo;
};

// max: how many pieces at most (all panes together)
export function glassShards(world, group, max, { color = 0xe4f6fb, emissive = 0x3a5866 } = {}) {
  let mesh = null, mat = null;
  const S = [];            // { p, v, axis, ang, spin, rest, size }
  const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), vp = new THREE.Vector3();

  function make() {
    mat = new THREE.MeshLambertMaterial({ color, emissive, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    mesh = new THREE.InstancedMesh(shardGeo(), mat, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return {
    // n pieces out of the pane between ground points a and b, from height y0 to y1, thrown along (dirX, dirZ)
    // the harder the hit
    burst(a, b, y0, y1, dirX, dirZ, speed, n) {
      if (!mesh) make();
      for (let k = 0; k < n && S.length < max; k++) {
        const u = Math.random(), v = Math.random();
        const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, yy = y0 + (y1 - y0) * v;
        const push = (0.25 + 0.5 * Math.random()) * Math.min(speed, 12) * 0.35;
        S.push({
          p: [x, yy, z],
          v: [dirX * push + (Math.random() - 0.5) * 2.2, 0.4 + Math.random() * 1.8, dirZ * push + (Math.random() - 0.5) * 2.2],
          axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
          ang: Math.random() * 6, spin: (Math.random() - 0.5) * 30, rest: false, size: 0.6 + Math.random() * 0.9,
        });
      }
      mesh.count = S.length;
    },
    // move the flying ones; true while any still move
    update(dt) {
      if (!mesh) return false;
      let moving = false;
      for (let k = 0; k < S.length; k++) {
        const s = S[k];
        if (s.rest) continue;
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
        quat.setFromAxisAngle(s.axis, s.ang);
        scl.setScalar(s.size);
        mtx.compose(vp.set(s.p[0], s.p[1], s.p[2]), quat, scl);
        mesh.setMatrixAt(k, mtx);
      }
      if (moving) mesh.instanceMatrix.needsUpdate = true;
      return moving;
    },
    get count() { return S.length; },
    dispose() {
      if (!mesh) return;
      group.remove(mesh);
      mesh.dispose(); mat.dispose();
      mesh = null; S.length = 0;
    },
  };
}
