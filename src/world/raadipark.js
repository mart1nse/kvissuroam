// Raadi manor park, round the Majoraadi ponds (Martin 23 Nov 2026: "various trees also aside the road ... mimic it
// as close as possible ... also various stones", for the Raadi rally stage that runs through it). Both lists in
// raadipark.json were read off the Land Board's air photo at 10 cm a pixel (tools/race/raadi-park.py: the
// shadows for the trees, the small bright blobs for the stones), within 70 m of the stage:
//  - trees the map lacks: the lidar map has the old big trees, but not the young ones planted in the park's
//    lawns or some of the middle-sized ones. Each is [x, z, height, crown], the height from the length of
//    its shadow; all broadleaved (the game makes them limes and birches by their shape). Planted through
//    world.addTrees, so they are ordinary map trees (levels of detail, trunks solid).
//  - stones: the boulder field west of the middle pond, the boulders along the ponds and the ones beside the
//    paths, each [x, z, radius]. One InstancedMesh of one rock shape, turned, squashed and tinted per stone; a
//    stone is set on the ground when the ground under it has loaded. Stones of 0.4 m and up are solid; none
//    reaches nearer than 0.3 m to the stage's gravel.
// Round the south loop (the pond in the wood) the photo is harder to read (sunlit leaves, a rough mound): there
// only the stones in the open are taken, and three boulders at the path corners set by hand.
import * as THREE from 'three';
import PARK from './raadipark.json';
import { still } from '../still.js';

const CENTRE = [2650, 440], NEAR = 620;

export function raadiParkTrees(world) { world.addTrees(PARK.trees); }

// one boulder, 1 m in radius before it is squashed: a 80-sided ball with its corners pushed in and out, flat below
function rockGeometry(lite) {
  const g = new THREE.IcosahedronGeometry(1, lite ? 0 : 1), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const bump = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return 0.82 + 0.3 * (s - Math.floor(s)); };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = bump(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
    pos.setXYZ(i, x * k, Math.max(-0.35, y * k), z * k);
  }
  g.computeVertexNormals();                                  // (not indexed: each face its own shade)
  for (let f = 0; f < pos.count; f += 3) {
    const up = (g.attributes.normal.getY(f) + 1) / 2, v = 0.55 + 0.33 * up + 0.08 * bump(f, 1, 2);
    for (let k = 0; k < 3; k++) col.set([v, v * 0.985, v * 0.95], (f + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function createRaadiPark(scene, world, { lite = false } = {}) {
  const S = PARK.stones, n = S.length;
  let mesh = null, todo = null, solid = false, wait = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const rnd = (k, j) => { const v = Math.sin(k * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  return {
    update(car) {
      if (!car) return;
      const d = Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]);
      if (mesh) mesh.visible = d < NEAR + 80;
      if (d > NEAR) return;
      if (!mesh) {
        mesh = new THREE.InstancedMesh(rockGeometry(lite), new THREE.MeshLambertMaterial({ vertexColors: true }), n);
        mesh.name = 'raadi park stones';
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        m4.makeScale(0, 0, 0);
        for (let k = 0; k < n; k++) {
          mesh.setMatrixAt(k, m4);
          const v = 0.56 + 0.24 * rnd(k, 1), warm = rnd(k, 2) * 0.1;          // granite grey, some of it pinkish
          mesh.setColorAt(k, c.setRGB(v, v * (1 - warm * 0.4), v * (1 - warm)));
        }
        still(mesh);
        scene.add(mesh);
        todo = S.map((_, k) => k);
      }
      if (!solid) {
        solid = true;
        world.addSolids(S.filter((t) => t[2] >= 0.4).map(([x, z, r]) => ({ x, z, yaw: 0, hx: r * 0.72, hz: r * 0.72 })));
      }
      if (!todo.length || (wait > 0 && wait--)) return;
      // a few each frame, where the ground has loaded
      let set = 0;
      for (let i = todo.length - 1; i >= 0 && set < 48; i--) {
        const k = todo[i], [x, z, r] = S[k];
        if (!world.ready(x, z)) continue;
        todo.splice(i, 1); set++;
        q.setFromEuler(e.set((rnd(k, 3) - 0.5) * 0.5, rnd(k, 4) * Math.PI * 2, (rnd(k, 5) - 0.5) * 0.5));
        const tall = 0.6 + 0.35 * rnd(k, 6);
        mesh.setMatrixAt(k, m4.compose(p.set(x, world.heightAt(x, z) + r * tall * 0.3, z), q, s.set(r * (1 + 0.25 * rnd(k, 7)), r * tall, r * (0.85 + 0.25 * rnd(k, 8)))));
      }
      if (set) mesh.instanceMatrix.needsUpdate = true; else wait = 20;
    },
  };
}
