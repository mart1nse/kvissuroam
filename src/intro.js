import * as THREE from 'three';

// Drone shot behind the opening menu: a slow closed loop along the Emajõgi through the city centre
// (past Kaarsild, along the river bend, back over the old town and Toomemägi). World x is east and
// z is south; each point is [x, z, height above the ground below].
const PATH = [
  [1000, 1950, 85],     // over the river north-west of the centre, heading downstream into town
  [1330, 2330, 75],
  [1560, 2620, 65],     // Kaarsild
  [1820, 2800, 70],
  [2120, 2860, 75],     // river bend by Vabadussild
  [2330, 3080, 85],
  [2200, 3380, 95],
  [1800, 3300, 100],    // back west over the old town
  [1420, 3020, 95],     // Raekoja plats, Toomemägi on the left
  [1120, 2720, 95],
  [920, 2320, 95],
];
const SPEED = 15;        // m/s along the loop
const LOOK_AHEAD = 150;  // metres ahead along the loop the camera looks at, down on the ground

export function createIntro(world) {
  const ground = (x, z) => Math.max(world.meta.riverLevel ?? -2.5, world.coarseHeight(x, z));
  const curve = new THREE.CatmullRomCurve3(
    PATH.map(([x, z, h]) => new THREE.Vector3(x, ground(x, z) + h, z)), true, 'centripetal');
  const len = curve.getLength();
  let dist = 0;
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  const focus = { x: 0, z: 0 };

  function at(d, out) { return curve.getPointAt((((d / len) % 1) + 1) % 1, out); }

  return {
    // advance the drone and write where the camera is and what it looks at
    step(dt, pos, look) {
      dist += dt * SPEED;
      at(dist, pos);
      at(dist + LOOK_AHEAD, q);
      look.set(q.x, ground(q.x, q.z) + 6, q.z);
      // keep at least 40 m over whatever is below (Toomemägi, the hospital blocks)
      pos.y = Math.max(pos.y, ground(pos.x, pos.z) + 40);
      focus.x = (pos.x + q.x) / 2; focus.z = (pos.z + q.z) / 2;
      return focus;
    },
    // the point to stream map sectors around before the drone gets there
    start() { at(0, p); at(LOOK_AHEAD, q); return { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }; },
  };
}
