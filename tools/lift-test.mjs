// Lift-off check: hold a corner on the edge of grip, lift off the throttle with the wheel held, and
// see how far the tail eases out. Cars with their own engine braking (engine.brakeTorque) are judged:
// the tail must come out, but not snap, and a lift in a straight line must not turn the car at all.
// The other cars are only shown. Run: node tools/lift-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const slide = (car) => -deg(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 1)));
const upTo = (car, kmh) => { for (let t = 0; t < 40 && speedKmh(car) < kmh; t += dt) stepCar(car, { up: 1 }, world, dt); };

let ok = true;
for (const spec of Object.values(CARS)) {
  if (spec.engine.type === 'ev' || (spec.ref.top ?? 0) < 150) continue;
  const judged = !!spec.engine.brakeTorque;
  const out = [];
  let pass = true;
  for (const kmh of [60, 100]) {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    upTo(car, kmh);
    // (a light throttle holds the speed with the wheel hard over, then the lift)
    for (let t = 0; t < 5; t += dt) stepCar(car, { up: Math.max(0.02, Math.min(1, (kmh - speedKmh(car)) * 0.3 + 0.25)), steer: 1 }, world, dt);
    const at = {};
    for (let k = 1; k <= 120; k++) { stepCar(car, { steer: 1 }, world, dt); if (k === 60 || k === 120) at[k] = slide(car); }
    out.push(`${kmh} km/h: ${at[60].toFixed(0)} deg after 0.5 s, ${at[120].toFixed(0)} after 1 s`);
    // out by 1 s, not snapped round in half a second
    if (judged && !(at[120] > (kmh === 100 ? 11 : 15) && at[120] < (kmh === 100 ? 30 : 50) && at[60] < 20)) pass = false;
  }
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  upTo(car, 100);
  const v0 = car.vx;
  let yaw = 0;
  for (let t = 0; t < 1; t += dt) { stepCar(car, {}, world, dt); yaw = Math.max(yaw, Math.abs(deg(car.yawRate))); }
  const slows = (v0 - car.vx) / 9.81;
  if (judged && !(yaw < 1 && slows > 0.08 && slows < 0.3)) pass = false;
  ok &&= pass;
  console.log(`${spec.short.padEnd(12)} ${out.join(' | ')} | straight lift from 100: slows ${slows.toFixed(2)} g, turns ${yaw.toFixed(1)} deg/s${judged ? (pass ? '  OK' : '  OFF') : ''}`);
}
console.log(ok ? 'lift-off: the tail eases out and a straight lift stays straight' : 'lift-off check FAILED');
process.exit(ok ? 0 : 1);
