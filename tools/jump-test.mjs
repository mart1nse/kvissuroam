// Jump check: drive each car over shaped ground and report air time, jump
// length and peak height. Flat and gently rolling ground must keep the wheels
// down; a sharp crest or a ramp at speed must throw the car, and the flight
// must match a ballistic arc. Run: node tools/jump-test.mjs
// Add --state to print end states for comparing two versions of the physics.
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const G = 9.81;
const world = (h) => ({
  meta: { riverLevel: -100 },
  heightAt: (x, z) => h(-z),          // the car drives north, towards -z
  surfaceAt: () => 1,
  sdfAt: () => 100,
  sdfGrad: (x, z, o) => o,
});
const dt = 1 / 120;

// ground profiles over distance s (m)
const flat = () => 0;
const rolling = (s) => 1.5 * Math.sin(s / 40);                       // crest radius ~1070 m
const ramp = (s) => (s < 100 ? 0 : s < 112 ? (s - 100) * 0.18 : 0);   // 10 degree kicker with a 2.2 m drop behind it
const crest = (s) => {                                                // humpback: 8 % up, 8 % down, 12 m rounding
  const d = Math.abs(s - 150);
  return d > 60 ? 0 : d > 6 ? (60 - d) * 0.08 : 4.56 - (d * d) / 150;
};

// With no input given the car holds its entry speed (light throttle, eased off above it), so a powerful
// car arrives at the obstacle at the stated speed instead of accelerating all the way there.
function run(spec, h, kmh, input = null, dist = 300) {
  const w = world(h);
  const car = createCar(spec, { x: 0, z: 0, yaw: 0, y: h(0) });
  car.vx = kmh / 3.6;
  let air = 0, longest = 0, cur = 0, peak = 0, s0 = 0, len = 0, t = 0, v0 = null, flight = null;
  while (-car.z < dist && t < 60) {
    stepCar(car, input || { up: Math.max(0, Math.min(0.4, (kmh / 3.6 + 1 - car.vx) * 0.4)) }, w, dt);
    t += dt;
    if (car.airborne) {
      if (cur === 0) { s0 = -car.z; v0 = car.vyUp; }
      cur += dt; air += dt;
      peak = Math.max(peak, car.y - h(-car.z));
    } else if (cur > 0) {
      if (cur > longest) { longest = cur; len = -car.z - s0; flight = { v0, t: cur, drop: h(s0) - h(-car.z) }; }
      cur = 0;
    }
  }
  return { air, longest, len, peak, flight, car };
}

if (process.argv.includes('--state')) {
  for (const spec of Object.values(CARS)) {
    for (const [name, h, input] of [['flat', flat, { up: 1 }], ['flat-turn', flat, { up: 1, right: 1 }], ['flat-brake', flat, { down: 1 }], ['rolling', rolling, { up: 1 }]]) {
      const { car } = run(spec, h, 80, input, 250);
      console.log(spec.short.padEnd(10), name.padEnd(10), [car.x, car.z, car.yaw, car.vx, car.vy].map((v) => v.toFixed(3)).join(' '));
    }
  }
  process.exit(0);
}

let ok = true;
const check = (cond, msg) => { if (!cond) { ok = false; console.log(`  FAIL: ${msg}`); } };
for (const spec of Object.values(CARS)) {
  console.log(`\n${spec.short}`);
  for (const [name, h] of [['flat road', flat], ['rolling road', rolling]]) {
    const r = run(spec, h, 120);
    console.log(`  ${name} at 120 km/h: ${r.air.toFixed(2)} s in the air`);
    check(r.air === 0, `${name} must not lift the car`);
  }
  for (const [name, h, kmh, want] of [['ramp', ramp, 90, true], ['humpback', crest, 30, false], ['humpback', crest, 110, true]]) {
    // (the bus is limited to 80 km/h, so it never meets the 110 km/h humpback)
    if (spec.limiter && kmh > spec.limiter + 15) { console.log(`  ${name} at ${kmh} km/h: beyond its ${spec.limiter} km/h limiter`); continue; }
    const r = run(spec, h, kmh);
    console.log(`  ${name} at ${kmh} km/h: ${r.longest.toFixed(2)} s flight, ${r.len.toFixed(1)} m long, ${r.peak.toFixed(2)} m above the ground`);
    check(r.longest > 0.25 === want, want ? 'should jump' : 'should stay down');
    if (want && r.flight) {
      // a body thrown up at v0 that lands `drop` lower flies for t = (v0 + sqrt(v0^2 + 2 g drop)) / g
      const f = r.flight, ideal = (f.v0 + Math.sqrt(Math.max(0, f.v0 * f.v0 + 2 * G * f.drop))) / G;
      check(Math.abs(f.t - ideal) < 0.12 * ideal + 0.05, `flight ${f.t.toFixed(2)} s, ballistic ${ideal.toFixed(2)} s`);
    }
    check(Math.abs(r.car.y - h(-r.car.z)) < 0.02 && Math.abs(r.car.yaw) < 0.05, 'should be settled and straight afterwards');
  }
}
console.log(ok ? '\njumps OK' : '\njumps FAILED');
process.exit(ok ? 0 : 1);
