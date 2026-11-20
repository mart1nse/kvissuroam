// Upshift hunting check (Martin 2026-11-20): floored from a standstill, straight or turning, on every
// surface, the automatic must not change back down within 1.5 s of an upshift. On spinning tyres (loose
// ground most of all) the early 1>2 used to land under the kick-down point, so it went straight back to
// first and up again, heard as two upshifts in a row.
// Run: node tools/upshift-hunt-test.mjs [carId] (lists every change)
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const dt = 1 / 120;
const only = process.argv[2];
let ok = true, runs = 0;
for (const [surf, sname] of [[1, 'tarmac'], [2, 'gravel'], [0, 'grass'], [3, 'dirt']]) {
  for (const spec of Object.values(CARS)) {
    if (only && spec.id !== only) continue;
    if (spec.engine.type === 'ev') continue;
    for (const steer of [0, 0.5, 1]) for (const t0 of [0, 3, 7]) {
      const w = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
      const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
      car.time = t0;
      let g = car.gear, upAt = -9, bad = '';
      const ev = [];
      for (let t = 0; t < 8; t += dt) {
        stepCar(car, { up: 1, steer: t > 0.5 ? steer : 0 }, w, dt);
        if (car.gear !== g) {
          ev.push(`${t.toFixed(2)} ${g}>${car.gear} ${speedKmh(car).toFixed(0)} km/h`);
          if (car.gear < g && t - upAt < 1.5 && !bad) bad = `${g}>${car.gear} ${(t - upAt).toFixed(2)} s after the upshift`;
          if (car.gear > g) upAt = t;
          g = car.gear;
        }
      }
      runs++;
      if (bad) { ok = false; console.log(`${sname.padEnd(7)} ${spec.short.padEnd(12)} steer ${steer}: ${bad}`); }
      if (only) console.log(`${sname.padEnd(7)} steer ${steer} t0 ${t0}: ${ev.join(', ')}`);
    }
  }
}
console.log(ok ? `\nok (${runs} launches)` : '\nFAILED');
process.exit(ok ? 0 : 1);
