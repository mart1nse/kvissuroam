// Procedural car models. See kit.js for the shared toolkit.
import { buildW201 } from './w201.js';
import { buildCRV } from './crv.js';
import { buildEnyaq } from './enyaq.js';
import { buildRAV4 } from './rav4.js';
import { buildMazda6 } from './mazda6.js';
import { buildBZ4X } from './bz4x.js';

export const CAR_IDS = ['w201', 'crv', 'enyaq', 'rav4', 'mazda6', 'bz4x'];
const BUILDERS = { w201: buildW201, crv: buildCRV, enyaq: buildEnyaq, rav4: buildRAV4, mazda6: buildMazda6, bz4x: buildBZ4X };

// Returns a fresh model each call:
// { group, wheels: { fl, fr, rl, rr: { steer, spin } }, wheelRadius, wheelbase, track,
//   size: { length, width, height }, setLights({ brake, reverse, headlights }) }
export function buildCarModel(id) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`Unknown car model "${id}"`);
  return build();
}
