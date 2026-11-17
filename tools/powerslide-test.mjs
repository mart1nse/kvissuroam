// Powerslide check: kick the tail out at 40-70 km/h (handbrake flick), then a
// simple driver keeps the throttle floored and works the wheel to hold about
// 25 deg of slide. Reports how long the car stays in the slide (12..50 deg)
// and whether it spun. Run: node tools/powerslide-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
for (const [surf, name] of [[1, 'tarmac'], [2, 'gravel']]) {
  for (const kmh of [40, 70]) {
    console.log(`\n${name}, ${kmh} km/h`);
    for (const spec of Object.values(CARS)) {
      const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
      const w = world(surf);
      car.vx = kmh / 3.6;
      const beta = () => -deg(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 1)));
      let b0 = 0;
      for (let t = 0; t < 2.5 && b0 < 15; t += dt) {
        stepCar(car, { up: t > 0.3 ? 1 : 0, steer: 1, handbrake: t > 0.3 && t < 0.6 ? 1 : 0 }, w, dt);
        b0 = beta();
      }
      let held = 0, spun = false, sum = 0, n = 0, bPrev = beta();
      const KD = +(process.env.KD ?? 0.03);
      for (let t = 0; t < 4; t += dt) {
        const b = beta(), db = (b - bPrev) / dt; bPrev = b;
        stepCar(car, { up: 1, steer: Math.max(-1, Math.min(1, (25 - b) / 20 - KD * db)) }, w, dt);
        if (b > 12 && b < 50 && !spun) held += dt;
        if (b > 90 || car.vx < 0) spun = true;
        sum += b; n++;
      }
      console.log(`  ${spec.short.padEnd(13)}${spec.drive} | ${b0 < 15 ? 'no slide started' : `held ${held.toFixed(1)} s of 4, mean slide ${(sum / n).toFixed(0)} deg${spun ? ', SPUN' : ''}, ${speedKmh(car).toFixed(0)} km/h at the end`}`);
    }
  }
}
