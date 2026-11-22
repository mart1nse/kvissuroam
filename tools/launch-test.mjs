// Race grid launch check (Martin 2026-11-22): on the grid a four-wheel-drive car with an engine waits with the
// clutch in, the throttle revving it against the limiter with the wheels still; at the lights the clutch drops.
// Rear- and front-driven cars keep spinning their wheels on the grid, as before; four-wheel-drive EVs wait still.
// The car is held on the spot as main.js holds it (car.gridHold, position put back each frame).
// Run: node tools/launch-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 60;

let ok = true;
for (const spec of Object.values(CARS)) {
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  const e = spec.engine, awd = spec.drive === 'awd', ice = e.type !== 'ev';
  // a second settling, then 3 s flat out on the grid
  let lo = 1e9, hi = 0, cuts = 0, wasCut = false, spin = 0;
  for (let t = 0; t < 4; t += dt) {
    car.gridHold = true;
    stepCar(car, t < 1 ? {} : { up: 1 }, world, dt);
    car.x = 0; car.z = 0; car.yaw = 0; car.vx = car.vy = car.yawRate = 0;
    if (t > 2.5) { lo = Math.min(lo, car.rpm); hi = Math.max(hi, car.rpm); }
    if (t > 1) spin = Math.max(spin, Math.abs(car.slipV || 0));
    if (car.revCut > 0 && !wasCut) cuts++;
    wasCut = car.revCut > 0;
  }
  // lights out, flat out
  car.gridHold = false;
  let slip0 = 0, at1 = 0;
  for (let t = 0; t < 1; t += dt) { stepCar(car, { up: 1 }, world, dt); slip0 = Math.max(slip0, Math.abs(car.slipV || 0)); }
  at1 = speedKmh(car);
  let pass = true, note = '';
  if (awd && ice) {
    // on the limiter (bouncing), wheels still, then a launch with the tyres lit
    pass = hi > e.redline - 150 && cuts >= 3 && spin < 0.1 && slip0 > 1;
    note = pass ? '  OK' : '  OFF';
  } else if (awd) { pass = spin < 0.1; note = pass ? '  OK (held still)' : '  OFF'; }
  ok &&= pass;
  console.log(`${spec.short.padEnd(12)} ${spec.drive} ${ice ? 'ice' : 'ev '} grid: rpm ${ice ? `${lo.toFixed(0)}-${hi.toFixed(0)} of ${e.redline}, ${cuts} limiter cuts` : '-'}, wheelspin ${spin.toFixed(1)} m/s | go: spin ${slip0.toFixed(1)} m/s, ${at1.toFixed(0)} km/h after 1 s${note}`);
}
console.log(ok ? 'launch: 4WD cars rev on the limiter with the wheels still and drop the clutch at the lights' : 'launch check FAILED');
process.exit(ok ? 0 : 1);
