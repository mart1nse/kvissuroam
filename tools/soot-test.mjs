// Passat soot build-up check. Run: node tools/soot-test.mjs
// Floored from rest the smoke must take 1..2.5 s to come up to full, cut on every gear change and build again.
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
import { sootState, sootStep } from '../src/smoke.js';

const w = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120, car = createCar(CARS.passat, { x: 0, z: 0, yaw: 0 }), st = sootState();
let tFull = null, cuts = 0, shifts = 0, gear = car.gear, low = 1, line = '';
for (let t = 0; t < 14; t += dt) {
  stepCar(car, { up: 1 }, w, dt);
  const k = sootStep(st, car, dt);
  if (tFull === null && k > 0.95) tFull = t;
  if (car.gear !== gear) { if (shifts) cuts += low < 0.05; shifts++; gear = car.gear; low = 1; }
  low = Math.min(low, k);
  if (Math.round(t / dt) % 30 === 0) line += `${t.toFixed(2)}s g${car.gear} ${speedKmh(car).toFixed(0)}km/h ${k.toFixed(2)}\n`;
}
cuts += low < 0.05;
console.log(line);
const ok = tFull > 1 && tFull < 2.5 && shifts > 1 && cuts === shifts;
console.log(`full smoke after ${tFull?.toFixed(2)} s, ${cuts}/${shifts} gear changes cut the smoke: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
