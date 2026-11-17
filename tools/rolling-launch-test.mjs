// Rolling launch: roll at 10, 20 or 30 km/h with the throttle closed, then floor it on dry tarmac with
// the wheel straight. Prints the revs straight after flooring, the peak wheelspin and the time to
// 60 / 100 km/h, so the feel of the torque converter (rollStallRpm) and traction control (tcSlip) can be compared.
// Run: node tools/rolling-launch-test.mjs [carIds]
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';

const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const ids = process.argv[2] ? process.argv[2].split(',') : ['f40', 'cgt', 'm3', 'audi200', 'w201'];
const dt = 1 / 120;
for (const id of ids) {
  const spec = CARS[id];
  const row = [];
  for (const v0 of [10, 20, 30]) {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    // get up to speed gently, then coast for a moment so the box settles in its gear
    let t = 0;
    while (speedKmh(car) < v0 && t < 30) { stepCar(car, { up: 0.35 }, flat, dt); t += dt; }
    for (let i = 0; i < 60; i++) stepCar(car, {}, flat, dt);
    const gear0 = car.gear;
    let rpm02 = 0, spin = 0, t60 = null, t100 = null;
    for (t = 0; t < 12; t += dt) {
      stepCar(car, { up: 1 }, flat, dt);
      if (t < 0.2) rpm02 = car.rpm;
      spin = Math.max(spin, car.slipV || 0);
      const v = speedKmh(car);
      if (t60 === null && v >= 60) t60 = t;
      if (t100 === null && v >= 100) t100 = t;
    }
    row.push(`${v0} km/h: g${gear0} ${Math.round(rpm02)} rpm at 0.2 s, spin ${(spin * 3.6).toFixed(0)} km/h, ` +
      `60 in ${t60?.toFixed(2) ?? '-'} s, 100 in ${t100?.toFixed(2) ?? '-'} s`);
  }
  console.log(`${spec.short}\n  ${row.join('\n  ')}`);
}
