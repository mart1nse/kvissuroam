// "Isa ja poeg" (Father and son, Ülo Õun), the bronze of two small naked boys holding hands on the park side
// of the first corner of the lap, where Küüni turns into Vallikraavi (Martin, 21 Nov, from his Street View
// shots of July 2014). They stand on the pavement beyond the start straight's lamps and lindens, looking
// up Küüni towards Poe (Martin: twice the first size): the taller, slimmer boy on their left, the chubby one with the big
// head on their right.
//
// Light on purpose (Martin: the racetrack beside it is not to change, and no freeze frames): one merged mesh
// of about 3,500 triangles in one colour, no pictures; built through the work queue in three small steps
// when the car comes within 400 m, drawn only within 250 m. It stands 5 m or more beyond the lap's edge
// (outside the start straight's row of lamps and lindens) and is solid like a lamp post.
import * as THREE from 'three';
import { Parts } from '../race/landmarks.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

// (Martin, 22 Nov: turned a quarter round to look up Küüni towards Poe, moved a little right and back as seen
// from the corner, and twice the size)
export const ISA_JA_POEG = { x: 1543.7, z: 2969.9, face: [-0.668, -0.744], size: 2 };   // face: the way they look (towards Poe)
const BRONZE = 0x6a5847, PLATE = 0x75685c;
const BUILD_AT = 400, DRAW_TO = 250;

// one boy, built round his feet at (ox, 0, 0), looking along +z; `chub` 0 for the slim one, 1 for the chubby one;
// `inner`: the side (+1 or -1 along x) the other boy stands on
function boy(p, ox, chub, inner) {
  const geo = [];
  const put = (g, x, y, z, rz = 0) => { if (rz) g.rotateZ(rz); g.translate(ox + x, y, z); p.add(g, BRONZE, 0, 0, 0); geo.push(g); };
  const cap = (r, len, sz = 1) => new THREE.CapsuleGeometry(r, len, 3, 8).scale(1, 1, sz);
  const ball = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 10, 7).scale(sx, sy, sz);
  const k = chub ? 0.93 : 1.0, legR = 0.04 + chub * 0.008, hip = 0.055 + chub * 0.008;
  const y = (v) => v * k;
  for (const s of [-1, 1]) {
    put(ball(0.038, 1, 0.5, 2.1), s * hip, 0.02, 0.035);                        // foot
    put(cap(legR, y(0.2)), s * hip, y(0.17), 0);                                 // shin
    put(cap(legR + 0.016, y(0.13)), s * hip, y(0.38), -0.005);                   // thigh
    put(ball(0.068 + chub * 0.01, 1, 1, 0.9), s * 0.048, y(0.5), -0.035);       // seat
  }
  put(ball(0.1 + chub * 0.012, 1.15, 0.8, 0.8), 0, y(0.5), 0);                  // hips
  put(cap(0.095 + chub * 0.02, y(0.19), 0.72), 0, y(0.68), 0);                   // body
  if (chub) put(ball(0.1, 1, 1, 0.85), 0, y(0.6), 0.03);                        // round belly
  put(new THREE.CylinderGeometry(0.033, 0.037, 0.07, 8), 0, y(0.88), 0);        // neck
  const head = chub ? 0.112 : 0.094, hy = y(0.89) + head * 0.95;
  put(ball(head, 0.94, 1.04, 1.08), 0, hy, -0.004);                             // head
  // arms from the shoulders: the outer one hangs by the side, the inner one reaches down to the other boy's hand
  const shY = y(0.85), shX = 0.105 + chub * 0.02, L = 0.17, r = 0.027 + chub * 0.005;
  for (const [side, a] of [[-inner, -inner * 0.09], [inner, inner * 0.27]]) {
    put(cap(r, 0.3), side * shX + Math.sin(a) * L, shY - Math.cos(a) * L, 0.0, a);
    if (side === inner) put(ball(0.032), side * shX + Math.sin(a) * 0.36, shY - Math.cos(a) * 0.36, 0.01);   // the held hand
  }
  return geo;
}

export function createIsaJaPoeg(scene, world, { shadows = true } = {}) {
  const { x: X, z: Z, face, size } = ISA_JA_POEG;
  const yaw = Math.atan2(face[0], face[1]);                 // turns local +z (where they look) to `face`
  const group = still(new THREE.Group());
  group.visible = false;
  scene.add(group);
  let built = false, mesh = null;

  function* build() {
    const p = new Parts();
    const spare = [...boy(p, 0.215, 0, -1)];               // the slim boy on their left (+x: they look along +z)
    yield;
    spare.push(...boy(p, -0.215, 1, 1));                    // the chubby boy on their right
    p.box(0.9, 0.02, 0.45, PLATE, 0, 0.0, 0.0);             // the small bronze plate in the paving
    for (const g of spare) g.dispose();
    yield;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.42 });
    mesh = p.mesh(mat);
    mesh.castShadow = shadows; mesh.receiveShadow = shadows;
    mesh.position.set(X, world.heightAt(X, Z), Z);
    mesh.rotation.y = yaw;
    mesh.scale.setScalar(size);
    mesh.updateMatrix();
    group.add(mesh);
    group.updateMatrixWorld(true);
    world.addSolids([{ x: X, z: Z, yaw, hx: 0.5 * size, hz: 0.3 * size }]);
  }

  return {
    group,
    update(car) {
      if (!car) return;
      const d = Math.hypot(car.x - X, car.z - Z);
      if (!built) {
        if (d < BUILD_AT && world.ready(X, Z)) { built = true; jobs.add(build, 'isapoeg'); }
        return;
      }
      group.visible = d < DRAW_TO;
    },
  };
}
