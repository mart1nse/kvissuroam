// The inside of the left from Kose tee onto Lükati tee (Martin, 28 Nov 2026, with Street View shots at 64 and 25
// Kose tee: "add 2-3 trees and some bush into the corner, but leave roughly 2m from apex"). The map's own trees
// begin 16 m back from the corner, so the grass triangle could be driven straight over. Three broad-leaved trees
// now stand in it (solid, like every tree), the nearest 2.3 m from the road's edge at the apex, with shrubbery
// between and behind them. Nothing on the carriageway.
import * as THREE from 'three';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { leafyPlants } from '../streetkit.js';

const APEX = [304.7, 491.7];                                              // the painted road's inside corner
const TREES = [[303.0, 489.2, 10.5, 5.5], [306.0, 481.5, 12, 6], [296.5, 487.5, 11, 6]];      // [x, z, height, crown]
const SHRUBS = [[300.6, 486.6, 3.2, 2.0], [304.2, 485.3, 3.0, 1.9], [298.4, 484.4, 3.4, 2.2], [302.0, 483.0, 3.2, 2.1], [305.0, 478.0, 2.8, 1.8], [293.6, 486.6, 2.8, 1.7], [300.4, 488.9, 2.2, 1.4]];   // [x, z, width, height]

export function createKoseKurv(scene, world, { shadows = true } = {}) {
  world.addTrees(TREES.map(([x, z, h, c]) => [x, z, h, c, 0]));
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  return {
    update(car) {
      if (built || !car || Math.hypot(car.x - APEX[0], car.z - APEX[1]) > 330 || !world.ready(APEX[0], APEX[1])) return;
      built = true;
      jobs.add(function* koseKurv() {
        yield 'frame';
        const leafy = leafyPlants(group, shadows);
        if (!leafy.ok) return;
        SHRUBS.forEach(([x, z, w, h], k) => leafy.bush(x, world.heightAt(x, z) - 0.05, z, w, h, k * 1.9, [0.78 + (k % 3) * 0.07, 0.9 + (k % 2) * 0.06, 0.8 + (k % 4) * 0.04]));
        leafy.finish();
      }, 'kose kurv');
    },
  };
}
