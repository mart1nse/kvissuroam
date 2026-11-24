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
//    stone is set on the ground when the ground under it has loaded, and from then the cars feel its shape
//    (world.addStones, src/cars/stones.js): wheels ride up it, the floor and the bumpers meet it; none
//    reaches nearer than 0.3 m to the stage's gravel.
// Round the south loop (the pond in the wood) the photo is harder to read (sunlit leaves, a rough mound): there
// only the stones in the open are taken, and three boulders at the path corners set by hand.
import * as THREE from 'three';
import PARK from './raadipark.json';
import { still } from '../still.js';

const CENTRE = [2650, 440], NEAR = 620;
// and stones set by hand where Martin asked for one: [x, z, radius] (24 Nov, "perhaps add a small stone here":
// on the inside of the S before the bale at point 187, between the road and the way-in tape, at point 175, 1.7 m off the gravel: 24 Nov "1m inside")
// and one just outside the tape of the bend north of the boulder field, at point 290, by its end near the road
// (24 Nov, "small stone here too")
// and two 0.5 m outside the tape of the bend after the east loop's crossing, a bigger and a smaller one
// (24 Nov "two stones here, one bigger one smaller ... 0,5 m to the left of the tape")
// and a small rock left of the road in the wood loop's last bend, 1.4 m off it (24 Nov "Add rock (red circle)"), and a
// boulder before it just short of where the tape on that side begins (24 Nov 12:04 "add one boulder, in greencircle")
const HAND = [[2557.9, 393.9, 0.32], [2705.6, 355.0, 0.3], [2861.8, 454.1, 0.5], [2864.1, 452.1, 0.3], [2832.9, 624.2, 0.45], [2838.6, 618.6, 0.6],
  // two on the outside of the way in to the left-hander by the lake (Martin 24 Nov 14:50): one off the edge, one by the tape
  // (15:15: the bigger one 3 m further along and 1 m further from the edge)
  [2776.1, 489.8, 0.5], [2765.9, 487.4, 0.45]];
// Stones of the air photo moved where Martin asked: [x, z of the stone, new x, z] (24 Nov "move boulder (green
// arrow)": the boulder by the wood loop's right-hand bend, up the road to just before its tape, 0.9 m off the gravel)
const MOVED = [[2858.1, 554.3, 2863.1, 558.3]];
for (const [x, z, nx, nz] of MOVED) { const s = PARK.stones.find((q) => Math.abs(q[0] - x) < 0.05 && Math.abs(q[1] - z) < 0.05); if (s) { s[0] = nx; s[1] = nz; } }

export function raadiParkTrees(world) { world.addTrees(PARK.trees); }

// The park's lamp posts and a bench (Martin 24 Nov, dots on four air photos and a picture from the stage: "You can
// place the roughly 1.5m from the edge of the road, and lets finetune form there on"). Each [x, z, bearing to the
// road], read off his photos by matching their paths to the Land Board's; the ones by the stage set 1.5 m off its
// gravel at the point marked, the four by the other paths 1.5 m off theirs. Thin 6 m poles that snap
// (src/world/props.js PARK). The one beside the stage north of the junction east of the pond carries the red
// dog-waste bin ("only one of them has the dog poop orange container attached to it"; first on the shore after the
// left turn by the pond, then 24 Nov 11:08 "move the trashbin to the post with th eorange square").
const LAMPS = [
  [2656.6, 333.1, 203], [2678.2, 343.9, 212], [2703.5, 355.8, 190], [2727.5, 359.0, 189],   // north of the boulder field
  [2749.6, 367.7, 208], [2780.4, 368.1, 170], [2820.3, 386.8, 261],                          // round the middle pond's north
  [2816.7, 423.4, 264], [2840.0, 448.2, 248],                                                // the S path across it (not the stage)
  [2822.7, 505.7, 116], [2824.7, 517.0, 25], [2790.8, 490.0, 214],                           // its east side, the junction, the shore
  [2847.3, 528.8, 37], [2862.3, 550.7, 77], [2861.2, 575.7, 114], [2838.6, 603.3, 132],      // inside the S down to the woods
  [2820.2, 636.5, 110], [2790.6, 671.5, 168],
  [2815.1, 718.9, 27], [2791.2, 696.0, 326],                                                 // the path east from its foot (not the stage)
];
const BIN_LAMP = [2839.3, 478.6, 290];
// the bench by the road down from the junction west of the middle pond (his green circle, then 24 Nov "move the
// bench 20m further along the road, curenlty it is between rocks")
const BENCH = [2757.4, 444.1, 92];
export function raadiParkProps() {
  return [...LAMPS.map(([x, z, b]) => [41, x, z, b]), [42, ...BIN_LAMP], [3, ...BENCH]];
}

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
  const S = PARK.stones.concat(HAND), n = S.length;
  let mesh = null, todo = null, wait = 0;
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
      if (!todo.length || (wait > 0 && wait--)) return;
      // a few each frame, where the ground has loaded
      let set = 0;
      const felt = [];
      for (let i = todo.length - 1; i >= 0 && set < 48; i--) {
        const k = todo[i], [x, z, r] = S[k];
        if (!world.ready(x, z)) continue;
        todo.splice(i, 1); set++;
        q.setFromEuler(e.set((rnd(k, 3) - 0.5) * 0.5, rnd(k, 4) * Math.PI * 2, (rnd(k, 5) - 0.5) * 0.5));
        const tall = 0.6 + 0.35 * rnd(k, 6), gy = world.heightAt(x, z), yaw = rnd(k, 4) * Math.PI * 2;
        s.set(r * (1 + 0.25 * rnd(k, 7)), r * tall, r * (0.85 + 0.25 * rnd(k, 8)));
        mesh.setMatrixAt(k, m4.compose(p.set(x, gy + r * tall * 0.3, z), q, s));
        // (what the cars feel: the same shape as a dome, a little inside the drawn one's corners)
        felt.push({ x, z, a: s.x * 0.95, b: s.z * 0.95, cs: Math.cos(yaw), sn: Math.sin(yaw), h: r * tall, gy });
      }
      if (felt.length) world.addStones(felt);
      if (set) mesh.instanceMatrix.needsUpdate = true; else wait = 20;
    },
  };
}
