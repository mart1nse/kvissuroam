// Understeer push check (Martin 2026-11-20): a powerful rear-driven car floored at full lock with its
// rear wheels spinning, at 20-60 km/h (rolling into it, or picking up speed out of a donut), must keep
// turning into the lock. It used to run nearly straight for a second or more now and then, when the donut
// keeper's wander (sway, tuck) pushed against the rotation outside a donut.
// Each case starts at a range of clock times, since the wander follows car.time.
// Measures the longest stretch with the path turning less than 20 deg/s (a radius of 30-80 m at these
// speeds) while floored at full lock on spinning rear wheels, with the tail out less than 45 deg (after the
// first second, which a car rolling in straight needs to turn in).
// Run: node tools/exit-push-test.mjs [carId] (verbose)
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const only = process.argv[2];
const LIMIT = 0.6;     // s
let ok = true;
const cases = [
  ['roll 30', (car, run) => { car.vx = 30 / 3.6; run(6, 1); }],
  ['roll 45', (car, run) => { car.vx = 45 / 3.6; run(6, 1); }],
  ['donut exit', (car, run) => { run(5, 1); run(0.5, 0); run(6, 1); }],
];
for (const [surf, sname] of [[1, 'tarmac'], [2, 'gravel']]) {
  for (const id of ['w201', 'f40', 'cgt', 'm3']) {
    if (only && id !== only) continue;
    const row = [];
    for (const [cname, drive] of cases) {
      let worst = 0, worstT0 = 0;
      for (let t0 = 0; t0 < 48; t0 += 2) {
        const car = createCar(CARS[id], { x: 0, z: 0, yaw: 0 });
        car.time = t0;
        const w = world(surf);
        let run = 0, longest = 0, prevC = null;
        drive(car, (secs, up) => {
          for (let t = 0; t < secs; t += dt) {
            stepCar(car, { up, steer: 1 }, w, dt);
            const c = car.yaw + Math.atan2(car.vy, car.vx);
            const rate = prevC === null ? 1 : (c - prevC) / dt;
            prevC = c;
            const v = speedKmh(car);
            // (a car swung round past 45 deg, or spun, is not pushing wide)
            const slide = -deg(Math.atan2(car.vy, car.vx));
            if (up && t > 1 && car.slipVR > 2 && v > 20 && v < 60 && slide < 45 && deg(rate) < 20) run += dt;
            else run = 0;
            longest = Math.max(longest, run);
          }
        });
        if (longest > worst) { worst = longest; worstT0 = t0; }
      }
      if (worst > LIMIT) ok = false;
      row.push(`${cname} ${worst.toFixed(2)} s${worst > 0 ? ` (t0 ${worstT0})` : ''}`);
    }
    console.log(`${sname.padEnd(7)} ${CARS[id].short.padEnd(12)} | longest push: ${row.join(' | ')}`);
  }
}
console.log(ok ? '\nok' : '\nFAILED');
process.exit(ok ? 0 : 1);
