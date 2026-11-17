// Procedural car models. See kit.js for the shared toolkit.
import { buildW201 } from './w201.js';
import { buildCRV } from './crv.js';
import { buildEnyaq } from './enyaq.js';
import { buildRAV4 } from './rav4.js';
import { buildMazda6 } from './mazda6.js';
import { buildBZ4X } from './bz4x.js';
import { buildF40 } from './f40.js';
import { buildAudi200 } from './audi200.js';
import { buildM3 } from './m3.js';
import { buildCGT } from './cgt.js';
import { buildBus } from './bus.js';
import { buildPassat } from './passat.js';
import { buildF31 } from './f31.js';

export const CAR_IDS = ['w201', 'audi200', 'passat', 'crv', 'enyaq', 'rav4', 'mazda6', 'bz4x', 'm3', 'f40', 'cgt', 'bus'];
const BUILDERS = { w201: buildW201, crv: buildCRV, enyaq: buildEnyaq, rav4: buildRAV4, mazda6: buildMazda6, bz4x: buildBZ4X, f40: buildF40, audi200: buildAudi200, m3: buildM3, cgt: buildCGT, bus: buildBus, passat: buildPassat,
  // not drivable: the parked BMW on Jänese tänav (src/world/janese.js)
  f31: buildF31 };

// Returns a fresh model each call:
// { group, wheels: { fl, fr, rl, rr: { steer, spin } }, wheelRadius, wheelbase, track,
//   size: { length, width, height }, setLights({ brake, reverse, headlights }) }
export function buildCarModel(id) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`Unknown car model "${id}"`);
  return build();
}
