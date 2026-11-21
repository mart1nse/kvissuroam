// The end of Veski at the Kuperjanovi junction (Martin, 18 Nov, from his street views of Aug 2024 and a
// kaldaerofoto), in pastel colours. Left to right in the direction of the lap Veski is: pavement, a strip
// of wild grass, the reddish cycle lane, the car lane, pavement (veski.js). Here:
//   - the orange board fence behind the left pavement, along the green up to the corner
//   - the kerbed island on the right up to the junction: wild grass, leafy shrubs, pale grasses and dark
//     red perennials, a young tree and two red benches (nothing in it is solid: a car drives straight through)
//   - the give-way triangles across the lane at the mouth of the junction and the yield sign
//   - the two houses across the junction: the white functionalist house with the round corner on the left,
//     the red-brown brick block (the ALKO shop) in front
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX } from './landmarks.js';
import { streetKit, setHouseColours } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';
import { realTreeKit } from '../world/scenery.js';

const CENTRE = [830, 3245];
const FENCE = { i0: 1772, i1: 1805, off: 3.4, height: 1.2, colour: 0xd98a68, dark: 0xbd7254 };
// the island: from the lane's kerb (lat0) out to lat1, a little wider (+wide[2]) from where the pavement swings out
const ISLAND = { i0: 1797, i1: 1816.5, lat0: 0.25, lat1: 2.1, wide: [1803, 1808, 0.7], tree: 1814.4, benches: [1810.3, 1812.1] };
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const islandOuter = (t) => ISLAND.lat1 + ISLAND.wide[2] * smooth((t - ISLAND.wide[0]) / (ISLAND.wide[1] - ISLAND.wide[0]));
export const ISLAND_END = ISLAND.i1;
// tints of the leafy bush: the pale blue-green grass by the junction and the dark red perennials
const PALE = [1.7, 1.5, 3.2], RED = [1.75, 0.24, 0.95];
const grassy = (t, r) => r < 0.12 + 0.75 * smooth((t - 1811.5) / 3) || (t < ISLAND.i0 + 2.5 && r < 0.6);
const YIELD_AT = 1810.5;                                   // the give-way line across the lane
const COL = {
  grass: [0x7fa86a, 0x93b874, 0x6f9a60], shrub: [0x4f8a55, 0x5f9a5c, 0x6aa866], kerb: 0xd2cfd8, trunk: 0x7a6152,
  stake: 0xc9b49a, white: 0xfaf8ff, crown: [0x6fae6a, 0x7cba72], bench: 0xe2584e, benchDark: 0xb9443e,
};

// the white house on the left, the brick block in front (LOD2 bases in cm, sector 2_6)
export function veskiEndWalls(walls) {
  setHouseColours(walls, '2_6', 480, 3040, [
    { base: 3051, x: 883.3, z: 3292.2, wall: 0xf6f5f7, roof: 0x9fa3b4, reach: 20 },
    { base: 3092, x: 833.6, z: 3310.2, wall: 0xc4867a, roof: 0x9a9cab, reach: 20 },
  ]);
}
// the yield sign on the right at the mouth of the junction, facing the cars coming along the lap
export function veskiEndProps() {
  const track = createTrack();
  const i = Math.round(YIELD_AT) - 1, [tx, tz] = track.tan[i], hw = track.HW[i];
  const x = track.P[i][0] - tz * (hw + 0.8), z = track.P[i][1] + tx * (hw + 0.8);
  return [[15, x, z, (Math.atan2(-tx, tz) * 180) / Math.PI]];
}

export function createVeskiEnd(world, group, { shadows = true } = {}) {
  const track = createTrack();
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const solids = [];
    const T = (i, lat) => {                                 // track frame at a fractional index; lat > 0 to the right
      const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1];
      const [tx, tz] = track.tan[k];
      return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
    };
    const hwAt = (i) => track.HW[Math.round(i)];
    const free = (x, z, r = 0.5) => world.sdfAt(x, z) > r;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    // ---- the orange board fence behind the left pavement: boards 12 cm wide with a hairline gap, posts
    {
      const pts = [];
      for (let i = FENCE.i0; i <= FENCE.i1; i += 1) pts.push(T(i, -(hwAt(i) + FENCE.off)));
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, yaw = Math.atan2(-dz, dx);
        if (!free(mx, mz)) continue;
        for (let d = 0.07; d < l; d += 0.135) {
          const x = a[0] + ux * d, z = a[1] + uz * d;
          p.box(0.12, FENCE.height, 0.025, (Math.round(d * 7.4) + k) % 5 ? FENCE.colour : FENCE.dark, x, h(x, z) + 0.06 + FENCE.height / 2, z, yaw);
        }
        for (const y of [0.3, FENCE.height - 0.2]) p.box(l, 0.08, 0.04, FENCE.dark, mx + uz * 0.03, h(mx, mz) + y, mz - ux * 0.03, yaw);
        p.box(0.1, FENCE.height + 0.12, 0.1, FENCE.dark, a[0], h(a[0], a[1]) + (FENCE.height + 0.12) / 2, a[1], yaw);
        solids.push({ x: mx, z: mz, yaw, hx: l / 2, hz: 0.08 });
      }
    }

    // ---- the island on the right, up to the junction: a low kerb round grasses, perennials and shrubs, a
    // young tree on stakes and two red benches on the pavement side. All the plants are leafy (the foliage
    // of the realistic trees) and nothing here is solid: a car goes straight through.
    {
      const { i0, i1, lat0 } = ISLAND, lat1 = islandOuter;
      const F = (t, u) => T(t, hwAt(t) + lat0 + u * (lat1(t) - lat0));          // u: 0 at the lane, 1 at the pavement
      K.ribbon({ at: F }, i0, i1, 0, 0.5, 'lawn');
      K.ribbon({ at: F }, i0, i1, 0.5, 1, 'lawn');
      // kerb all round
      const ring = [];
      for (let i = i0; i <= i1; i += 0.5) ring.push(F(i, 0));
      for (let i = i1; i >= i0; i -= 0.5) ring.push(F(i, 1));
      ring.push(ring[0]);
      for (let k = 0; k < ring.length - 1; k++) {
        const a = ring[k], b = ring[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        if (l < 0.05) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        p.box(l + 0.04, 0.14, 0.14, COL.kerb, mx, h(mx, mz) + 0.07, mz, Math.atan2(-dz, dx));
      }
      const L = K.leafy, wide = (t) => lat1(t) - lat0;
      const spot = (t, d) => { const q = T(t, hwAt(t) + lat0 + d); return [q[0], h(q[0], q[1]), q[1]]; };
      const byBench = (t) => ISLAND.benches.some((bi) => Math.abs(t - bi) < 0.75);
      if (L.ok) {
        const n = Math.round((i1 - i0) * 1.35);
        for (let k = 0; k < n; k++) {                       // shrubs: knee to chest high, the bigger ones away from the lane
          const t = i0 + 0.9 + k * (i1 - i0 - 1.8) / (n - 1) + (rnd() - 0.5) * 0.5, wd = wide(t) - (byBench(t) ? 0.8 : 0);
          const d = 0.4 + rnd() * (wd - 0.75), big = 0.55 + 0.45 * d / wd;
          const [x, y, z] = spot(t, d);
          const w = (0.8 + rnd() * 0.75) * big, g = 0.82 + rnd() * 0.2;
          // towards the junction the bed is mostly pale blue-green grass, in broad clumps
          if (grassy(t, rnd())) L.bush(x, y - 0.05, z, w * 1.15, (0.5 + rnd() * 0.3) * big, rnd() * 6.3, PALE.map((c) => c * (0.92 + rnd() * 0.16)), w * 1.15);
          else L.bush(x, y - 0.06, z, w, (0.6 + rnd() * 0.65) * big, rnd() * 6.3, [g * (0.86 + rnd() * 0.2), g * (0.96 + rnd() * 0.1), g * (0.8 + rnd() * 0.16)], w * (0.8 + rnd() * 0.4));
        }
        for (let k = 0; k < (i1 - i0) * 5; k++) {           // grass and weeds: slim, paler and yellower
          const t = i0 + 0.35 + rnd() * (i1 - i0 - 0.7);
          const [x, y, z] = spot(t, 0.22 + rnd() * (wide(t) - 0.44 - (byBench(t) ? 0.7 : 0)));
          const w = 0.28 + rnd() * 0.3, g = 0.95 + rnd() * 0.2;
          L.bush(x, y - 0.03, z, w, 0.3 + rnd() * 0.5, rnd() * 6.3, grassy(t, rnd()) ? PALE.map((c) => c * g) : [g * 1.08, g * 1.1, g * (0.62 + rnd() * 0.2)], w);
        }
        for (let k = 0; k < 16; k++) {                      // dark red perennials: slim spikes in twos and threes
          const t = i0 + 1 + rnd() * (i1 - i0 - 2), d0 = 0.3 + rnd() * (wide(t) - 0.6 - (byBench(t) ? 0.7 : 0));
          for (let j = 0; j < 3; j++) {
            const [x, y, z] = spot(t + (rnd() - 0.5) * 0.25, Math.max(0.2, d0 + (rnd() - 0.5) * 0.3));
            L.bush(x, y - 0.02, z, 0.15 + rnd() * 0.08, 0.4 + rnd() * 0.28, rnd() * 6.3, RED, 0.15);
          }
        }
      } else {
        for (let k = 0; k < (i1 - i0) * 5.5; k++) {
          const t = i0 + 0.3 + rnd() * (i1 - i0 - 0.6);
          const [x, y, z] = spot(t, 0.2 + rnd() * (wide(t) - 0.4));
          const tall = 0.35 + rnd() * 0.45;
          p.add(new THREE.ConeGeometry(0.12 + rnd() * 0.1, tall, 5), COL.grass[k % 3], x, y + tall / 2, z, rnd() * 6);
        }
        for (let k = 0; k < 15; k++) {
          const t = i0 + 1 + k * (i1 - i0 - 2) / 14;
          const [x, , z] = spot(t, 0.45 + rnd() * (wide(t) - 0.9));
          K.shrub(x, z, 0.38 + rnd() * 0.3, COL.shrub[k % 3], 0.85);
        }
      }
      // the young tree with its three stakes
      const [x, y, z] = spot(ISLAND.tree, wide(ISLAND.tree) * 0.5);
      const kit = realTreeKit(), lime = kit && kit.species[0];
      if (lime && lime.near) {
        const tree = new THREE.Mesh(lime.near, lime.soloMat);
        tree.position.set(x, y - 0.05, z);
        tree.scale.set(2.3, 4.4, 2.3);
        tree.rotation.y = 1.9;
        tree.castShadow = shadows;
        tree.frustumCulled = false;
        group.add(tree);
      } else {
        p.add(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 7), COL.trunk, x, y + 1.2, z);
        p.add(new THREE.IcosahedronGeometry(0.95, 1).scale(0.9, 1.25, 0.9), COL.crown[0], x, y + 3.0, z, 0.4);
        p.add(new THREE.IcosahedronGeometry(0.6, 1), COL.crown[1], x + 0.35, y + 2.5, z - 0.2, 1.1);
      }
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094, sx = x + Math.cos(a) * 0.3, sz = z + Math.sin(a) * 0.3;
        p.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), COL.stake, sx, y + 0.8, sz);
      }
      for (const yy of [0.9, 1.45]) p.add(new THREE.TorusGeometry(0.3, 0.015, 4, 12).rotateX(Math.PI / 2), COL.stake, x, y + yy, z);
      // the two red slatted benches in the edge of the bed, their backs to the plants
      for (const bi of ISLAND.benches) {
        const k = Math.floor(bi), [tx, tz] = track.tan[k], rx = -tz, rz = tx, yaw = Math.atan2(-tz, tx);
        const c = T(bi, hwAt(bi) + lat1(bi) - 0.42), y0 = h(c[0], c[1]) + 0.08;
        const part = (w, hh, d, hex, a, b, yy) => p.box(w, hh, d, hex, c[0] + tx * a + rx * b, y0 + yy, c[1] + tz * a + rz * b, yaw);
        for (const b of [0.02, 0.15, 0.28]) part(1.7, 0.04, 0.11, COL.bench, 0, b, 0.45);
        for (const yy of [0.62, 0.77]) part(1.7, 0.11, 0.035, COL.bench, 0, -0.1, yy);
        for (const a of [-0.72, 0.72]) {
          part(0.05, 0.43, 0.38, COL.benchDark, a, 0.13, 0.215);
          part(0.05, 0.86, 0.05, COL.benchDark, a, -0.13, 0.43);
        }
      }
    }

    // ---- give-way triangles across the lane at the mouth of the junction, pointing at the driver
    const shapes = [];
    {
      const i = YIELD_AT, k = Math.floor(i), [tx, tz] = track.tan[k], rx = -tz, rz = tx, hw = hwAt(i);
      const c = T(i, 0);
      const pt = (u, v) => [c[0] + tx * u + rx * v, c[1] + tz * u + rz * v];
      for (let v = -hw + 0.3; v < hw - 0.75; v += 0.75) shapes.push([[pt(0, v), pt(0, v + 0.5), pt(-0.6, v + 0.25)]]);
    }
    const g = drapeGeometry(world, shapes, 0.07, 1, 1.5);

    K.finish();
    if (g) {
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COL.white, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      group.add(m);
    }
    world.addSolids(solids);
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - CENTRE[0], z - CENTRE[1]) > 600) return;
      if ([[790, 3170], [810, 3206], [838, 3260], [845, 3280]].every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}
