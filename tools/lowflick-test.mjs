// Low-speed flick check (Martin 2026-11-21): rolling at 0 to 10 km/h with the wheel at full lock and the throttle
// floored or at 60 % (wheel and pedal together, or the wheel first), the tail may come round but must not be
// flicked out hard: there is no speed to swing it with. Reports, for each car, the sharpest yaw kick into the
// turn over 50 ms while under 15 km/h (deg/s2) and the yaw rate it reached; the rear-driven cars must stay
// under KICK_MAX (the twin-motor EVs are shown: their worst comes mid donut, as the hold brings them round again). Before 2026-11-21 the donut hold went on pushing after the car
// already turned at a donut's rate: 286 to 307 deg/s2 on gravel for the 190E, F40, Carrera GT and M3.
// Run: node tools/lowflick-test.mjs [carId] [v0 for a trace]   (trace options: SEED, PRE, SURF env)
import { CARS } from '../src/cars/specs.js';
const { createCar, stepCar, speedKmh } = await import(process.env.PHYS || '../src/cars/physics.js');
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const only = process.argv[2], verbose = process.argv[3];
const KICK_MAX = 240;   // deg/s2
let ok = true;
for (const [surf, name] of [[1, 'tarmac'], [2, 'gravel']]) {
  console.log(`\n${name}`);
  for (const spec of Object.values(CARS)) {
    if (only && spec.id !== only) continue;
    let worst = { k: 0 }, sumR = 0, nR = 0, sumK = 0;
    for (const v0 of [0, 3, 6, 10]) for (const thr of [1, 0.6]) for (const seed of [0, 1, 2, 3, 4, 5]) for (const pre of [0, 1]) {
      const car = createCar(spec, { x: seed * 41, z: seed * 17, yaw: 0 });
      car.time = seed * 3.3;
      car.vx = v0 / 3.6;
      const w = world(surf);
      let prev = 0, rates = [], peakK = 0, peakR = 0, at = 0;
      for (let t = 0; t < 3; t += dt) {
        // pre: wheel already at lock before the throttle; else wheel and throttle together
        const steer = 1, up = (pre ? t > 0.5 : true) ? thr : 0;
        stepCar(car, { up, steer }, w, dt);
        rates.push(car.yawRate);
        if (rates.length > 6) {
          const k = (car.yawRate - rates[rates.length - 7]) / (6 * dt);   // 50 ms yaw accel into the turn (tail out)
          if (speedKmh(car) < 15 && k > peakK) { peakK = k; at = t; }
        }
        if (speedKmh(car) < 15) peakR = Math.max(peakR, Math.abs(car.yawRate));
        if (verbose && v0 == +verbose && thr === 1 && seed === +(process.env.SEED||0) && pre === +(process.env.PRE||0) && surf === +(process.env.SURF||1) && Math.round(t*120)%3===0) console.log(`t ${t.toFixed(2)} v ${speedKmh(car).toFixed(1)} yaw ${deg(car.yawRate).toFixed(0)} beta ${deg(Math.atan2(car.vy, Math.max(0.3, car.vx))).toFixed(0)} slipR ${car.slipVR.toFixed(1)} steer ${car.steer.toFixed(2)} rpm ${car.rpm.toFixed(0)}`);
      }
      sumR += peakR; sumK += peakK; nR++;
      if (peakK > worst.k) worst = { k: peakK, r: peakR, v0, thr, seed, pre, at };
    }
    const must = spec.drive === 'rwd';
    if (must && deg(worst.k) > KICK_MAX) ok = false;
    console.log(`  ${spec.short.padEnd(13)}${spec.drive} | worst yaw accel ${deg(worst.k).toFixed(0).padStart(5)} deg/s2 (v0 ${worst.v0} thr ${worst.thr} seed ${worst.seed} pre ${worst.pre} t ${worst.at.toFixed(2)}) peak rate ${deg(worst.r).toFixed(0)} | mean of runs: peak rate ${deg(sumR / nR).toFixed(0)} accel ${deg(sumK / nR).toFixed(0)}`);
  }
}
console.log(ok ? '\nok' : '\nFAILED');
process.exit(ok ? 0 : 1);
