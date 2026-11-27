// Handbrake turn on the four-wheel-drive cars (Martin 2026-11-26: as on a WRC car, the handbrake opens the centre
// coupling, the rear wheels lock and the engine or front motor keeps driving the fronts, so the throttle sets how
// fast they turn through the turn). From a steady speed the wheel goes to full lock and the handbrake is held for
// HOLD s at a fixed throttle, then let go with the wheel straightened and the throttle floored.
// Per car, surface, speed and throttle: the front tread's speed over the road while the handbrake is held (mean and
// most, m/s), the revs as it is let go, how far the car turned and how much speed it kept, and the rear wheels' spin
// just after (m/s). The front spin must grow with the throttle on every combustion car: that is the gas pedal
// setting the front wheel speed. Then the hairpin pivot from a standstill or a crawl (see the end). Run: node tools/handbrake-test.mjs [carId]
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI, HOLD = 0.8;
const only = process.argv[2];
let bad = 0;
for (const [surf, name] of [[1, 'tarmac'], [2, 'gravel']]) {
  for (const kmh of [40, 70]) {
    console.log(`\n${name}, ${kmh} km/h, ${HOLD} s on the handbrake at full lock`);
    for (const spec of Object.values(CARS)) {
      if (spec.drive !== 'awd' || (only && spec.id !== only)) continue;
      const rows = [];
      for (const thr of [0, 0.5, 1]) {
        const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
        const w = world(surf);
        car.vx = kmh / 3.6;
        // (settle at that speed first: the gear, the revs and the tyres' creep)
        for (let t = 0; t < 1.5; t += dt) { stepCar(car, { up: 0.3 }, w, dt); car.vx = kmh / 3.6; car.vy = 0; car.yawRate = 0; car.yaw = 0; }
        const v0 = speedKmh(car);
        let sumF = 0, maxF = 0, n = 0;
        for (let t = 0; t < HOLD; t += dt) {
          stepCar(car, { up: thr, steer: 1, handbrake: 1 }, w, dt);
          sumF += car.slipVF; maxF = Math.max(maxF, car.slipVF); n++;
        }
        const rpm = car.rpm, turned = deg(car.yaw), vHb = speedKmh(car);
        let rearMax = 0;
        for (let t = 0; t < 0.3; t += dt) { stepCar(car, { up: 1, steer: 0 }, w, dt); rearMax = Math.max(rearMax, car.slipVR); }
        rows.push({ thr, mean: sumF / n, maxF, rpm, turned, kept: vHb / v0, rearMax });
      }
      const ice = spec.engine.type === 'ice';
      // (the throttle must turn the fronts faster: more spin at full throttle than at none)
      const grows = rows[2].mean > rows[0].mean + 0.5;
      if (ice && !grows) bad++;
      console.log(`  ${spec.short.padEnd(13)}${spec.engine.type.padEnd(4)}` + rows.map((r) =>
        ` | thr ${r.thr.toFixed(1)}: front ${r.mean.toFixed(1)}/${r.maxF.toFixed(1)} m/s, ${String(Math.round(r.rpm)).padStart(4)} rpm, turned ${r.turned.toFixed(0).padStart(3)} deg, kept ${(r.kept * 100).toFixed(0)} %, rear after ${r.rearMax.toFixed(1)}`).join('')
        + (ice && !grows ? '  FRONTS NOT DRIVEN' : ''));
    }
  }
}
if (bad) { console.log(`\n${bad} rows where the throttle did not turn the fronts faster`); process.exitCode = 1; }

// The hairpin pivot (Martin 2026-11-27: "at very low speeds and also standing still, when I have the handbrake on,
// turn full lock, give it the beans, it should start dragging the front around quicker"). From a standstill or a crawl,
// handbrake, full lock and full throttle all at once for 2 s: how far round the car has come after 1 and 2 s and how
// far its middle has gone. Judged on the rally cars with an engine (22B, Focus WRC, 200 Avant): at least PIVOT_MIN
// degrees in the 2 s from a standstill on tarmac and on gravel, no car past PIVOT_MAX (a spin on the spot, not a turn).
const PIVOT_MIN = 150, PIVOT_MAX = 270, RALLY = ['impreza', 'focus', 'audi200'];
let badPivot = 0;
for (const [surf, name] of [[1, 'tarmac'], [2, 'gravel']]) {
  for (const kmh of [0, 5, 10]) {
    console.log(`\npivot, ${name}, from ${kmh} km/h: handbrake, full lock, floored for 2 s`);
    for (const spec of Object.values(CARS)) {
      if (spec.drive !== 'awd' || (only && spec.id !== only)) continue;
      const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
      const w = world(surf);
      for (let t = 0; t < 1; t += dt) { stepCar(car, kmh ? { up: 0.3 } : {}, w, dt); car.vx = kmh / 3.6; car.vy = 0; car.yawRate = 0; car.yaw = 0; car.x = car.z = 0; }
      let at1 = 0;
      for (let i = 1; i <= 240; i++) { stepCar(car, { up: 1, steer: 1, handbrake: 1 }, w, dt); if (i === 120) at1 = deg(car.yaw); }
      const at2 = deg(car.yaw), gone = Math.hypot(car.x, car.z);
      const low = kmh === 0 && RALLY.includes(spec.id) && at2 < PIVOT_MIN, high = at2 > PIVOT_MAX;
      if (low || high) badPivot++;
      console.log(`  ${spec.short.padEnd(13)}${spec.engine.type.padEnd(4)} | 1 s: ${at1.toFixed(0).padStart(3)} deg | 2 s: ${at2.toFixed(0).padStart(3)} deg, ${speedKmh(car).toFixed(0).padStart(2)} km/h, middle moved ${gone.toFixed(1)} m${low ? '  TOO SLOW' : high ? '  TOO FAR' : ''}`);
    }
  }
}
if (badPivot) { console.log(`\n${badPivot} pivots too slow or too far`); process.exitCode = 1; }
