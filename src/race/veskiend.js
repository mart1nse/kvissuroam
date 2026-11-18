// The end of Veski at the Kuperjanovi junction (Martin, 18 Nov, from his street views of Aug 2024 and a
// kaldaerofoto), in pastel colours. Left to right in the direction of the lap Veski is: pavement, a strip
// of wild grass, the reddish cycle lane, the car lane, pavement (veski.js). Here:
//   - the orange board fence behind the left pavement, along the green up to the corner
//   - the kerbed island of wild grass, shrubs and a young tree on the right before the junction
//   - the give-way triangles across the lane at the mouth of the junction and the yield sign
//   - the two houses across the junction: the white functionalist house with the round corner on the left,
//     the red-brown brick block (the ALKO shop) in front
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX } from './landmarks.js';
import { streetKit, setHouseColours } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';

const CENTRE = [830, 3245];
const FENCE = { i0: 1772, i1: 1805, off: 3.4, height: 1.2, colour: 0xd98a68, dark: 0xbd7254 };
const ISLAND = { i0: 1797, i1: 1809.5, lat0: 0.25, lat1: 2.1 };
const YIELD_AT = 1810.5;                                   // the give-way line across the lane
const COL = {
  grass: [0x7fa86a, 0x93b874, 0x6f9a60], shrub: [0x4f8a55, 0x5f9a5c, 0x6aa866], kerb: 0xd2cfd8, trunk: 0x7a6152,
  stake: 0xc9b49a, white: 0xfaf8ff, crown: [0x6fae6a, 0x7cba72],
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
          p.add(BOX(0.12, FENCE.height, 0.025), (Math.round(d * 7.4) + k) % 5 ? FENCE.colour : FENCE.dark, x, h(x, z) + 0.06 + FENCE.height / 2, z, yaw);
        }
        for (const y of [0.3, FENCE.height - 0.2]) p.add(BOX(l, 0.08, 0.04), FENCE.dark, mx + uz * 0.03, h(mx, mz) + y, mz - ux * 0.03, yaw);
        p.add(BOX(0.1, FENCE.height + 0.12, 0.1), FENCE.dark, a[0], h(a[0], a[1]) + (FENCE.height + 0.12) / 2, a[1], yaw);
        solids.push({ x: mx, z: mz, yaw, hx: l / 2, hz: 0.08 });
      }
    }

    // ---- the island on the right: a low kerb round wild grass, shrubs and a young tree on stakes
    {
      const { i0, i1, lat0, lat1 } = ISLAND;
      K.ribbon({ at: (t, lat) => T(t, hwAt(t) + lat) }, i0, i1, lat0, lat1, 'lawn');
      // kerb all round
      const ring = [];
      for (let i = i0; i <= i1; i += 0.5) ring.push(T(i, hwAt(i) + lat0));
      for (let i = i1; i >= i0; i -= 0.5) ring.push(T(i, hwAt(i) + lat1));
      ring.push(ring[0]);
      for (let k = 0; k < ring.length - 1; k++) {
        const a = ring[k], b = ring[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        if (l < 0.05) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        p.add(BOX(l + 0.04, 0.14, 0.14), COL.kerb, mx, h(mx, mz) + 0.07, mz, Math.atan2(-dz, dx));
      }
      // tall grass tufts and shrubs
      for (let k = 0; k < 70; k++) {
        const i = i0 + 0.3 + rnd() * (i1 - i0 - 0.6), lat = lat0 + 0.2 + rnd() * (lat1 - lat0 - 0.4);
        const [x, z] = T(i, hwAt(i) + lat);
        const tall = 0.35 + rnd() * 0.45;
        p.add(new THREE.ConeGeometry(0.12 + rnd() * 0.1, tall, 5), COL.grass[k % 3], x, h(x, z) + tall / 2, z, rnd() * 6);
      }
      for (let k = 0; k < 9; k++) {
        const i = i0 + 1 + k * (i1 - i0 - 2) / 8, lat = lat0 + 0.45 + rnd() * (lat1 - lat0 - 0.9);
        const [x, z] = T(i, hwAt(i) + lat);
        K.shrub(x, z, 0.38 + rnd() * 0.3, COL.shrub[k % 3], 0.85);
      }
      // the young tree with its three stakes
      const [x, z] = T(i0 + (i1 - i0) * 0.62, hwAt(i0) + (lat0 + lat1) / 2), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 7), COL.trunk, x, y + 1.2, z);
      p.add(new THREE.IcosahedronGeometry(0.95, 1).scale(0.9, 1.25, 0.9), COL.crown[0], x, y + 3.0, z, 0.4);
      p.add(new THREE.IcosahedronGeometry(0.6, 1), COL.crown[1], x + 0.35, y + 2.5, z - 0.2, 1.1);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094, sx = x + Math.cos(a) * 0.3, sz = z + Math.sin(a) * 0.3;
        p.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), COL.stake, sx, y + 0.8, sz);
      }
      for (const yy of [0.9, 1.45]) p.add(new THREE.TorusGeometry(0.3, 0.015, 4, 12).rotateX(Math.PI / 2), COL.stake, x, y + yy, z);
      solids.push({ x, z, yaw: 0, hx: 0.25, hz: 0.25 });
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
