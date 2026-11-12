// Calibration check: floor each car on a flat, dry road and compare 0-100 km/h
// and top speed with the factory figures. Run: node tools/perf-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';

const flat = {
  meta: { riverLevel: -10 },
  heightAt: () => 0,
  surfaceAt: () => 1,
  sdfAt: () => 100,
  sdfGrad: (x, z, o) => o,
};

let ok = true;
for (const spec of Object.values(CARS)) {
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  const dt = 1 / 120;
  let t = 0, t100 = null, t50 = null, top = 0, d400 = null, dist = 0;
  while (t < 150) {
    stepCar(car, { up: 1 }, flat, dt);
    t += dt;
    dist += car.vx * dt;
    const v = speedKmh(car);
    if (t50 === null && v >= 50) t50 = t;
    if (t100 === null && v >= 100) t100 = t;
    if (d400 === null && dist >= 402.3) d400 = t;
    top = Math.max(top, v);
  }
  const e100 = Math.abs(t100 - spec.ref.zeroTo100) / spec.ref.zeroTo100;
  const eTop = Math.abs(top - spec.ref.top) / spec.ref.top;
  const pass = e100 < 0.05 && eTop < 0.04;
  ok &&= pass;
  console.log(`${spec.short.padEnd(10)} 0-50 ${t50.toFixed(1)} s | 0-100 ${t100.toFixed(1)} s (factory ${spec.ref.zeroTo100}) | 400 m ${d400.toFixed(1)} s | top ${top.toFixed(0)} km/h (factory ${spec.ref.top}) ${pass ? 'OK' : 'OFF'}`);
}
process.exit(ok ? 0 : 1);
