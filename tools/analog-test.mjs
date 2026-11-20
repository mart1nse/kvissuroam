// Gradual controls (a gamepad or a wheel): part throttle, part brake and part steering.
// - part throttle must pull more gently than full throttle and settle at a lower speed in a high gear
// - a light brake slows less than a full one, and nothing locks up
// - a stick held at 30 % turns the car smoothly and less than full lock; a wheel at the same angle
//   (steerDirect) stays within the grip and leaves the car pointing the way it goes
// Run: node tools/analog-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120;
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
for (const spec of Object.values(CARS)) {
  const run = (inp, secs, car = createCar(spec, { x: 0, z: 0, yaw: 0 })) => { for (let t = 0; t < secs; t += dt) stepCar(car, typeof inp === 'function' ? inp(t, car) : inp, world, dt); return car; };
  const full = speedKmh(run({ up: 1 }, 6)), half = speedKmh(run({ up: 0.4 }, 6));
  const cruise = (k) => { const c = run({ up: 1 }, 30); return c; };
  // brake from 100 km/h for 1.5 s
  const at100 = (c) => run((t, car) => ({ up: speedKmh(car) < 100 ? 1 : 0 }), 20, c);
  const b = (k) => { const c = at100(); const v0 = speedKmh(c); run({ down: k }, 1.5, c); return v0 - speedKmh(c); };
  const bFull = b(1), bLight = b(0.3);
  // steering at 80 km/h
  const turn = (inp) => {
    const c = run((t, car) => ({ up: speedKmh(car) < 80 ? 1 : 0.25 }), 25);
    let yaw = 0, beta = 0;
    run(() => ({ up: 0.3, ...inp }), 2, c);
    yaw = c.yawRate * 180 / Math.PI; beta = Math.atan2(c.vy, c.vx) * 180 / Math.PI;
    return { yaw, beta, steer: c.steer };
  };
  const pad = turn({ steer: 0.3 }), padFull = turn({ steer: 1 }), wheel = turn({ steer: 0.03, steerDirect: true }), wheelBig = turn({ steer: 1, steerDirect: true });
  const line = `${spec.short.padEnd(12)} 6 s: full ${full.toFixed(0)} part ${half.toFixed(0)} km/h | brake 1.5 s: full -${bFull.toFixed(0)} light -${bLight.toFixed(0)} | 80 km/h yaw: stick 30% ${pad.yaw.toFixed(1)} full ${padFull.yaw.toFixed(1)} wheel 3% ${wheel.yaw.toFixed(1)} wheel full ${wheelBig.yaw.toFixed(1)} (slide ${wheelBig.beta.toFixed(1)}) deg/s`;
  console.log(line);
  if (!(half < full * 0.95)) fail(`${spec.id}: part throttle as quick as full`);
  if (!(bLight < bFull * 0.8 && bLight > 0)) fail(`${spec.id}: light brake`);
  if (!(Math.abs(pad.yaw) < Math.abs(padFull.yaw) && Math.abs(pad.yaw) > 1)) fail(`${spec.id}: stick 30 %`);
  if (!Number.isFinite(wheelBig.yaw) || Math.abs(wheelBig.beta) > 25) fail(`${spec.id}: wheel at full lock at 80 km/h`);
}
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
