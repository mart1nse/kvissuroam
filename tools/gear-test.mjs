// Manual gear keys check (A up, Z down). Run: node tools/gear-test.mjs
// - A short shift at low revs is held (no automatic downshift) until that gear reaches the shift point.
// - Z may drop up to two gears past the redline and then brakes on the engine with the revs on the limiter.
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh, shiftGear } from '../src/cars/physics.js';

const w = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120;
const drive = (car, s, inp) => { for (let t = 0; t < s; t += dt) stepCar(car, inp, w, dt); };
let ok = true;
for (const id of ['w201', 'audi200', 'm3', 'f40', 'cgt', 'bus']) {
  const spec = CARS[id], e = spec.engine;
  // short shift: 1st to 2nd at 20 km/h, full throttle
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  let t = 0;
  while (speedKmh(car) < 20 && t < 10) { stepCar(car, { up: 1 }, w, dt); t += dt; }
  shiftGear(car, 1);
  const g1 = car.gear;
  let minGear = g1; t = 0;
  while (car.manual && t < 30) { stepCar(car, { up: 1 }, w, dt); t += dt; minGear = Math.min(minGear, car.gear); }
  const held = minGear === g1;
  // engine braking: cruise in a high gear, then Z three times off the throttle
  const c2 = createCar(spec, { x: 0, z: 0, yaw: 0 });
  drive(c2, 12, { up: 1 });
  drive(c2, 0.5, {});
  const g0 = c2.gear, v0 = speedKmh(c2);
  const res = [shiftGear(c2, -1), shiftGear(c2, -1), shiftGear(c2, -1), shiftGear(c2, -1)];
  const gz = c2.gear;
  let maxRpm = 0;
  for (let k = 0; k < 120; k++) { stepCar(c2, {}, w, dt); maxRpm = Math.max(maxRpm, c2.rpm); }
  const v1 = speedKmh(c2);
  if (!held || maxRpm > e.redline + 1) ok = false;
  console.log(`${id.padEnd(8)} short shift to ${g1} held ${held ? 'yes' : 'NO'} (released after ${t.toFixed(1)} s) | ` +
    `Z x4 at ${v0.toFixed(0)} km/h: gear ${g0} -> ${gz} [${res.map((r) => (r ? 'y' : 'n')).join('')}], 1 s later ${v1.toFixed(0)} km/h, revs max ${maxRpm.toFixed(0)} / ${e.redline}`);
}
console.log(ok ? 'ok' : 'FAILED');
