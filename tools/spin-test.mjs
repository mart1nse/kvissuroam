// Wheelspin check. Launches every car flat out on tarmac, gravel and grass and
// reports how far the revs run ahead of the road speed, then floors each car
// mid-corner to see whether the tail (or nose) steps out and whether easing
// the throttle brings it back. Run: node tools/spin-test.mjs
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
const deg = (r) => (r * 180) / Math.PI;
const SURFS = [[1, 'tarmac'], [2, 'gravel'], [0, 'grass']];
let ok = true;

console.log('Launch, full throttle from rest (first 4 s)');
for (const [surf, name] of SURFS) {
  console.log(`\n  ${name}`);
  for (const spec of Object.values(CARS)) {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    const w = world(surf);
    let maxSlip = 0, spinT = 0, t50 = null, maxRpm = 0, maxYaw = 0, yaw3 = 0, rpm1 = 0, v1 = 0;
    for (let t = 0; t < 12; t += dt) {
      stepCar(car, { up: 1 }, w, dt);
      if (t < 4) {
        maxSlip = Math.max(maxSlip, car.slipV * 3.6);
        if (car.spin > 0.05) spinT += dt;
        maxRpm = Math.max(maxRpm, car.rpm);
        maxYaw = Math.max(maxYaw, Math.abs(deg(car.yaw)));
        if (t < 3) yaw3 = maxYaw;
      }
      if (Math.abs(t - 1) < dt / 2) { rpm1 = car.rpm; v1 = speedKmh(car); }
      if (t50 === null && speedKmh(car) >= 50) t50 = t;
    }
    // nobody steers here: a launch may tug the car off line, but must not swing
    // it round before a driver could react. Three seconds of a floored F40 on
    // gravel with the wheel held straight is plenty to start a slide.
    if (!Number.isFinite(car.vx) || yaw3 > 15) ok = false;
    console.log(`    ${spec.short.padEnd(13)}${spec.drive} | wheels up to ${maxSlip.toFixed(0).padStart(3)} km/h faster than the road, spinning ${spinT.toFixed(1)} s | after 1 s: ${v1.toFixed(0)} km/h at ${rpm1.toFixed(0)} rpm | 0-50 ${t50 ? t50.toFixed(1) : '>12'} s | pulled ${maxYaw.toFixed(1)} deg off line`);
  }
}

// Mid-corner: settle into a steady turn, floor it for 2.5 s with the steering
// held, then lift for 2 s. Body slip is the angle between heading and travel.
console.log('\nFloor it mid-corner (steady turn, then 2.5 s flat out, then lift)');
for (const [surf, name, kmh] of [[1, 'tarmac', 40], [2, 'gravel', 35]]) {
  console.log(`\n  ${name}, entering at ${kmh} km/h`);
  for (const spec of Object.values(CARS)) {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    const w = world(surf);
    car.vx = kmh / 3.6;
    const slip = () => deg(Math.atan2(car.vy, Math.max(Math.abs(car.vx), 2)));
    for (let t = 0; t < 2; t += dt) stepCar(car, { up: speedKmh(car) < kmh ? 0.5 : 0, steer: 0.55 }, w, dt);
    const s0 = slip(), v0 = speedKmh(car);
    let peak = 0, maxSpin = 0;
    for (let t = 0; t < 2.5; t += dt) { stepCar(car, { up: 1, steer: 0.55 }, w, dt); if (Math.abs(slip()) > Math.abs(peak)) peak = slip(); maxSpin = Math.max(maxSpin, car.slipV * 3.6); }
    const v1 = speedKmh(car);
    for (let t = 0; t < 2; t += dt) stepCar(car, { steer: 0.2 }, w, dt);
    const s2 = slip();
    if (!Number.isFinite(car.vx)) ok = false;
    console.log(`    ${spec.short.padEnd(13)}${spec.drive} | body slip ${s0.toFixed(1)} -> peak ${peak.toFixed(1)} deg under power (wheelspin ${maxSpin.toFixed(0)} km/h, ${v0.toFixed(0)} -> ${v1.toFixed(0)} km/h) -> ${s2.toFixed(1)} deg after lifting`);
  }
}
console.log(ok ? '\nok' : '\nFAILED');
process.exit(ok ? 0 : 1);
