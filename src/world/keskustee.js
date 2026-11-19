// Ground at Kaubamaja, laid over the map's surface (Martin, 18 Nov): the grass of the Riia median under its
// limes, the lane lines of Riia on both sides of it with the stop lines at the junction, and the red brick
// paving of the Küüni plaza. Measured from the 2024 orthophoto. No names or numbers are painted on the road.
import * as THREE from 'three';
import { roadFrame, streetKit } from './streetkit.js';

const S = [1713.8, 3144.9], UB = [0.7189, -0.6951];      // Kaubamaja's south corner, along its Riia face towards the junction
const CENTRE = [1750, 3120];

export function createKeskusTee(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    // Riia: t is the map x along the face, `out` metres from the roof edge towards Kvartal
    const F = roadFrame([[S[0] - UB[0] * 20, S[1] - UB[1] * 20], [S[0] + UB[0] * 130, S[1] + UB[1] * 130]], 0);
    const x = (s) => S[0] + UB[0] * s;
    const strip = (s0, s1, o0, o1, kind) => K.ribbon(F, x(s0), x(s1), -o0, -o1, kind, true);
    strip(3, 103, 17.7, 20.7, 'lawn');                                       // the median
    strip(3, 103, 17.45, 17.7, 'concrete'); strip(3, 103, 20.7, 20.95, 'concrete');
    const dashes = (s0, s1, o) => { for (let s = s0; s < s1; s += 6) strip(s, s + 2, o - 0.06, o + 0.06, 'white'); };
    dashes(4, 84, 14.9);                                                     // Kaubamaja side: two lanes
    for (const o of [24.0, 27.3, 30.6]) dashes(4, 78, o);                    // Kvartal side: four lanes
    for (const o of [24.0, 27.3, 30.6]) strip(78, 99, o - 0.06, o + 0.06, 'white');      // solid before the lights
    strip(84, 99, 14.84, 14.96, 'white');
    strip(99, 99.45, 21.2, 33.6, 'white');                                   // stop line towards the junction
    strip(1.5, 1.95, 12.4, 17.3, 'white');                                   // and the one before the Küüni crossing
    // the Küüni plaza: red brick from the columns out to the kiosk row
    const W = [1659.6, 3088.7], UA = [0.6943, 0.7197];
    const FK = roadFrame([[W[0] - UA[0] * 14, W[1] - UA[1] * 14], [W[0] + UA[0] * 92, W[1] + UA[1] * 92]], 0);
    K.ribbon(FK, W[0] - UA[0] * 10, W[0] + UA[0] * 84, -0.4, -20.5, 'red', true);
    K.finish();
  }
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 900) return;
      if ([[1650, 3080], [1720, 3160], [1805, 3085], [1770, 3110]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
