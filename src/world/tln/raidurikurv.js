// The way out of the left bend on Kloostrimetsa tee before the Raiduri tee crossing (Martin, 28 Nov 2026, two marked
// air photos: "there is some room for outside going wide, perhaps lets detail that part a bit. lets add a kerb stone
// in the pink ... 5 sec cutting penalty for the yellow line crossing. also tyre barrier in blue. you can hit into
// them but quite a rough impact"). The outside there is a grass strip between Raiduri tee and the clinic's drive.
//  - a 15 cm kerb along the strip's road edge, hooked round its two ends (the lawn behind it raised to the stone)
//  - a wall of tyre stacks across the drive's mouth: solid, it stops a car dead
//  - the yellow line itself, and its 5 seconds, are in src/race/piritacuts.js (the page and the server share it)
// Nothing on the carriageway.
import * as THREE from 'three';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { raiduriEdge } from '../../race/piritacuts.js';
import { createKerb, shaped } from './kerb.js';
import { tyreStack } from './rummukurv.js';

const MID = [-318, -626];
const KERB = [[-335.5, -629.0], [-335.1, -624.8], [-333.6, raiduriEdge(-333.6)], [-305.8, raiduriEdge(-305.8)], [-304.9, -628.2], [-304.8, -631.5]];
const TYRES = [[-304.3, -627.4], [-299.9, -632.6]];      // the blue line: across the mouth of the drive

export function createRaiduriKurv(scene, world) {
  const group = still(new THREE.Group());
  scene.add(group);
  const run = shaped(KERB, 0.7, 2);
  run.grass = true;
  const kerb = createKerb(world, group, [run], { H: 0.15, name: 'raiduri kerb' });
  // the tyre stacks, 0.66 m apart, and what stops the car: boxes half a metre thick behind the tyres' faces (a wall
  // as thin as the tyres lets a car through, see rummukurv.js)
  const [a, b] = TYRES, len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
  const wall = [];
  for (let d = 0; d <= len + 0.01; d += 0.66) wall.push([a[0] + ux * d, a[1] + uz * d]);
  // (the road is to the wall's right as it runs east, the drive behind it to its left)
  world.addSolids([{ x: (a[0] + b[0]) / 2 + uz * 0.2, z: (a[1] + b[1]) / 2 - ux * 0.2, yaw: Math.atan2(-uz, ux), hx: len / 2 + 0.3, hz: 0.52 }]);
  let built = false;
  return {
    kerbAt: kerb.kerbAt, wall,
    update(car) {
      if (!car) return;
      kerb.update(car);
      if (built || Math.hypot(car.x - MID[0], car.z - MID[1]) > 330 || !world.ready(MID[0], MID[1])) return;
      built = true;
      jobs.add(function* raiduriTyres() {
        const im = new THREE.InstancedMesh(tyreStack(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), wall.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
        wall.forEach(([x, z], k) => {
          p.set(x, world.heightAt(x, z) - 0.02, z);
          q.setFromAxisAngle(up, k * 2.4);
          im.setMatrixAt(k, m.compose(p, q, s));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = true;
        im.matrixAutoUpdate = false;
        yield;
        group.add(im);
      }, 'raiduri tyres');
    },
  };
}
