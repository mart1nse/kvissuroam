// Lift-off check: hold a corner on the edge of grip, lift off the throttle with the wheel held, and
// see how far the tail eases out. Cars with their own engine braking (engine.brakeTorque) are judged:
// the tail must come out further than it does on the gentle drag every other car has, but not snap,
// and a lift in a straight line must not turn the car at all. The other cars are only shown.
// Run: node tools/lift-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const slide = (car) => -deg(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 1)));
const upTo = (car, kmh) => { for (let t = 0; t < 40 && speedKmh(car) < kmh; t += dt) stepCar(car, { up: 1 }, world, dt); };

// Hold the corner at kmh with the wheel at `steer`, lift, and give the slide after 0.5 and 1 s, or null when
// the hold itself was not steady (already sliding on the power, or bleeding off speed).
function lift(spec, kmh, steer) {
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  upTo(car, kmh);
  // (a light throttle holds the speed with the wheel hard over, then the lift)
  for (let t = 0; t < 5; t += dt) stepCar(car, { up: Math.max(0.02, Math.min(1, (kmh - speedKmh(car)) * 0.3 + 0.25)), steer }, world, dt);
  if (slide(car) > 8 || speedKmh(car) < kmh - 4) return null;
  const at = {};
  for (let k = 1; k <= 120; k++) { stepCar(car, { steer }, world, dt); if (k === 60 || k === 120) at[k] = slide(car); }
  return at;
}

let ok = true;
for (const spec of Object.values(CARS)) {
  if (spec.engine.type === 'ev' || (spec.ref.top ?? 0) < 150) continue;
  const judged = !!spec.engine.brakeTorque;
  const gentle = { ...spec, engine: { ...spec.engine, brakeTorque: undefined } };
  const out = [];
  let pass = true;
  for (const kmh of [60, 100]) {
    // A car that cannot hold the corner steady with the wheel hard over (the 190E at 60 km/h slides out on
    // the power and slows into 1st) is held with a little less lock, so the lift starts from a steady corner.
    let steer = 1, at = null;
    for (; steer > 0.7 && !(at = lift(spec, kmh, steer)); steer -= 0.05);
    if (!at) { out.push(`${kmh} km/h: no steady corner to lift from`); if (judged) pass = false; continue; }
    const lock = steer < 1 ? ` (wheel at ${steer.toFixed(2)})` : '';
    if (!judged) { out.push(`${kmh} km/h${lock}: ${at[60].toFixed(0)} deg after 0.5 s, ${at[120].toFixed(0)} after 1 s`); continue; }
    const g = lift(gentle, kmh, steer);
    out.push(`${kmh} km/h${lock}: ${at[60].toFixed(0)} deg after 0.5 s, ${at[120].toFixed(0)} after 1 s (${g ? g[120].toFixed(0) : '?'} on the gentle drag)`);
    // out further than on the gentle drag by 1 s, not snapped round in half a second
    if (!(g && at[120] > g[120] + 2 && at[120] < (kmh === 100 ? 30 : 50) && at[60] < 20)) pass = false;
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
