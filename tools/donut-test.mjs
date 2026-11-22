// Donut check: full lock, full throttle for a long time on grass, gravel and tarmac.
// The slide should keep going: no snapping straight once the car has scrubbed off
// its speed, and the revs stay up.
// Run: node tools/donut-test.mjs [carId] [surf] (verbose trace) [donut=0: without the donut helper, shown only]
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh, setDonutHelp } from '../src/cars/physics.js';
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const argv = process.argv.slice(2);
const bare = argv.includes('donut=0');
if (bare) setDonutHelp(false);
const [onlyId, onlySurf] = argv.filter((a) => a !== 'donut=0');
let ok = true;
for (const [surf, name] of [[0, 'grass'], [2, 'gravel'], [1, 'tarmac']]) {
  if (onlySurf !== undefined && +onlySurf !== surf) continue;
  console.log(`\n${name}`);
  for (const spec of Object.values(CARS)) {
    if (onlyId && spec.id !== onlyId) continue;
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    const w = world(surf);
    let minYaw = 1e9, maxYaw = 0, lowT = 0, minRpm = 1e9, sumYaw = 0, n = 0, straightT = 0, minB = 1e9, maxB = -1e9, minV = 1e9, maxV = 0;
    for (let t = 0; t < 20; t += dt) {
      stepCar(car, { up: 1, steer: 1 }, w, dt);
      if (t > 4) {
        const y = deg(car.yawRate);
        minYaw = Math.min(minYaw, y); maxYaw = Math.max(maxYaw, y); sumYaw += y; n++;
        if (y < 40) lowT += dt;
        const b = -Math.sign(car.yawRate || 1) * deg(Math.atan2(car.vy, car.vx));
        if (b < 15) straightT += dt;
        minB = Math.min(minB, b); maxB = Math.max(maxB, b);
        minV = Math.min(minV, speedKmh(car)); maxV = Math.max(maxV, speedKmh(car));
        minRpm = Math.min(minRpm, car.rpm);
      }
      if (onlyId && Math.abs(t * 10 - Math.round(t * 10)) < dt * 5 && Math.round(t * 10) % 2 === 0)
        console.log(`  t ${t.toFixed(1)} yaw ${deg(car.yawRate).toFixed(0).padStart(4)} deg/s v ${speedKmh(car).toFixed(0).padStart(3)} vx ${(car.vx*3.6).toFixed(0).padStart(3)} beta ${deg(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 0.5))).toFixed(0).padStart(4)} slipF ${(car.slipVF*3.6).toFixed(0).padStart(3)} slipR ${(car.slipVR*3.6).toFixed(0).padStart(3)} rpm ${car.rpm.toFixed(0).padStart(5)} g ${car.gear} steer ${car.steer.toFixed(2)} cut ${car.revCut>0?1:0}`);
    }
    // rear-driven cars and the twin-motor EVs must hold the donut; the
    // front-biased cars may wash wide and the weak AWD SUVs just circle.
    // (a 13 tonne bus has a sixth of a car's power per tonne: it can swing its tail on grass and
    // gravel but cannot spin its tyres on dry tarmac, so there it only has to circle)
    const weak = spec.ref.powerKw / spec.mass < 0.03 && surf === 1;
    const must = !weak && (spec.drive === 'rwd' || (spec.drive === 'awd' && spec.engine.type === 'ev'));
    if (must && !bare && (straightT > 1 || !Number.isFinite(car.vx))) ok = false;
    console.log(`  ${spec.short.padEnd(13)}${spec.drive} | yaw rate ${minYaw.toFixed(0)}..${maxYaw.toFixed(0)} avg ${(sumYaw / n).toFixed(0)} deg/s | slide ${minB.toFixed(0)}..${maxB.toFixed(0)} deg, straight for ${straightT.toFixed(1)} s of 16 | ${minV.toFixed(0)}..${maxV.toFixed(0)} km/h | rpm min ${minRpm.toFixed(0)}`);
  }
}
console.log(bare ? '\nwithout the donut helper: shown only, not judged' : ok ? '\nok' : '\nFAILED');
process.exit(ok ? 0 : 1);
