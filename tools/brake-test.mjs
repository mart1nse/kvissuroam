// Braking stability check: brake hard from speed on a flat, dry road after a
// small steering nudge and report how far the car rotates before it stops.
// Straight-line stops must not spin; stops with the wheel held over are listed
// for comparison only. Run: node tools/brake-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';

const world = (surf) => ({
  meta: { riverLevel: -10 },
  heightAt: () => 0,
  surfaceAt: () => surf,
  sdfAt: () => 100,
  sdfGrad: (x, z, o) => o,
});
const dt = 1 / 120;

function run(spec, kmh, surf, mode) {
  const w = world(surf);
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  car.vx = kmh / 3.6;
  // settle, then a short steering nudge: 'straight' releases it before braking,
  // 'turn' keeps steering through the stop
  for (let t = 0; t < 0.5; t += dt) stepCar(car, { up: 0.3 }, w, dt);
  for (let t = 0; t < 0.12; t += dt) stepCar(car, { up: 0.3, right: 1 }, w, dt);
  const yaw0 = car.yaw, x0 = car.x, z0 = car.z;
  let maxYaw = 0, maxSlip = 0, t = 0;
  while (speedKmh(car) > 3 && car.vx > 0.7 && t < 20) {
    stepCar(car, { down: 1, right: mode === 'turn' ? 1 : 0 }, w, dt);
    t += dt;
    maxYaw = Math.max(maxYaw, Math.abs(car.yaw - yaw0));
    maxSlip = Math.max(maxSlip, Math.abs(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 2))));
  }
  const spun = speedKmh(car) > 3;
  return { spun, dist: Math.hypot(car.x - x0, car.z - z0), yaw: (maxYaw * 180) / Math.PI, slip: (maxSlip * 180) / Math.PI, t };
}

let ok = true;
for (const mode of ['straight', 'turn']) {
  for (const [surf, name] of [[1, 'paved'], [2, 'gravel']]) {
    for (const kmh of [60, 120]) {
      console.log(`\n${mode} braking from ${kmh} km/h on ${name}`);
      for (const spec of Object.values(CARS)) {
        const r = run(spec, kmh, surf, mode);
        if (mode === 'straight' && (r.spun || r.yaw > 15)) ok = false;
        console.log(`  ${spec.short.padEnd(10)} stops in ${r.dist.toFixed(1)} m, ${r.t.toFixed(1)} s | heading change ${r.yaw.toFixed(1)} deg | max body slip ${r.slip.toFixed(1)} deg${r.spun ? ' | SPUN' : ''}`);
      }
    }
  }
}
console.log(ok ? '\nstraight-line braking stable' : '\nstraight-line braking UNSTABLE');
process.exit(ok ? 0 : 1);
