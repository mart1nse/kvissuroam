// Procedural car models. See kit.js for the shared toolkit.
import { buildW201 } from './w201.js';
import { buildCRV } from './crv.js';
import { buildEnyaq } from './enyaq.js';

export const CAR_IDS = ['w201', 'crv', 'enyaq'];
const BUILDERS = { w201: buildW201, crv: buildCRV, enyaq: buildEnyaq };

// Returns a fresh model each call:
// { group, wheels: { fl, fr, rl, rr: { steer, spin } }, wheelRadius, wheelbase, track,
//   size: { length, width, height }, setLights({ brake, reverse, headlights }) }
export function buildCarModel(id) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`Unknown car model "${id}"`);
  return build();
}
