// Automatic downshifts under braking. Run: node tools/downshift-test.mjs [car ids]
// Each car is floored for 20 s on a flat road (or to 260 km/h), then braked flat out down to 30 km/h;
// every gear change is listed with the speed and the revs before and after it. Under braking the gearbox
// should come down early, landing the engine in the upper part of its range (at least 60 % of the shift
// point, not dragged down near idle before it changes), and never above the redline. (First gear is left
// until the car is nearly stopped, so 2>1 is not counted.)
import { CARS, CAR_ORDER } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';

const w = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120;
const ids = process.argv[2] ? process.argv[2].split(',') : CAR_ORDER.filter((id) => CARS[id].engine.type !== 'ev');
let ok = true;
for (const id of ids) {
  const spec = CARS[id], e = spec.engine, car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  for (let t = 0; t < 20 && speedKmh(car) < 260; t += dt) stepCar(car, { up: 1 }, w, dt);
  const v0 = speedKmh(car), out = [];
  let g = car.gear, before = car.rpm, t = 0, minLand = Infinity, maxRpm = 0, minBefore = Infinity;
  while (speedKmh(car) > 30 && t < 30) {
    const r0 = car.rpm;
    stepCar(car, { down: 1 }, w, dt); t += dt;
    maxRpm = Math.max(maxRpm, car.rpm);
    if (car.gear !== g) {
      before = r0;
      // the revs it lands on, once the shift is done
      const gg = car.gear;
      let k = 0; while (car.shiftTimer > 0 && k++ < 120) { stepCar(car, { down: 1 }, w, dt); t += dt; }
      out.push(`${g}>${gg} at ${speedKmh(car).toFixed(0)} km/h ${before.toFixed(0)}>${car.rpm.toFixed(0)}`);
      if (gg >= 2) { minLand = Math.min(minLand, car.rpm / e.shiftRpm); minBefore = Math.min(minBefore, before / e.shiftRpm); }
      maxRpm = Math.max(maxRpm, car.rpm);
      g = car.gear;
    }
  }
  if (maxRpm > e.redline + 1 || minLand < 0.6) ok = false;
  console.log(`${id.padEnd(8)} from ${v0.toFixed(0)} km/h, stop in ${t.toFixed(1)} s | shifts at ${(minBefore * 100).toFixed(0)}%+ of the shift point, land ${(minLand * 100).toFixed(0)}%+ | ${out.join(', ')}`);
}
console.log(ok ? 'ok' : 'FAILED: over the redline, or landing low');
