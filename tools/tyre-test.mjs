// Road against gravel tyres (Martin 2026-11-23): for a few cars, the stop from 80 km/h, 0-100 km/h on tarmac, gravel, dirt and grass with each tyre. Gravel tyres must stop
// shorter on loose ground and longer on tarmac, and straight-line stops must stay straight on both.
// Run: node tools/tyre-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';

const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120;
const SURFS = [[1, 'tarmac'], [2, 'gravel'], [3, 'dirt'], [0, 'grass']];

function stop(spec, tyres, surf) {
  const w = world(surf), car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  car.tyres = tyres; car.vx = 80 / 3.6;
  for (let t = 0; t < 0.4; t += dt) stepCar(car, { up: 0.2 }, w, dt);
  const x0 = car.x, z0 = car.z, y0 = car.yaw;
  let t = 0;
  while (speedKmh(car) > 2 && t < 20) { stepCar(car, { down: 1 }, w, dt); t += dt; }
  return { d: Math.hypot(car.x - x0, car.z - z0), yaw: Math.abs(car.yaw - y0) * 57.3 };
}
function sprint(spec, tyres, surf) {
  const w = world(surf), car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  car.tyres = tyres;
  for (let t = 0; t < 0.5; t += dt) stepCar(car, {}, w, dt);
  let t = 0;
  while (speedKmh(car) < 100 && t < 30) { stepCar(car, { up: 1 }, w, dt); t += dt; }
  return t;
}

const fmt = (t) => (t >= 30 ? 'spins on' : `${t.toFixed(1)} s`);
let ok = true;
const ids = ['w201', 'impreza', 'f40', 'bz4x'].filter((id) => CARS[id]);
for (const id of ids) {
  const spec = CARS[id];
  console.log(`\n${spec.short}`);
  for (const [surf, name] of SURFS) {
    const r = stop(spec, 'road', surf), g = stop(spec, 'gravel', surf);
    const sr = sprint(spec, 'road', surf), sg = sprint(spec, 'gravel', surf);
    const better = surf === 1 ? g.d > r.d : g.d < r.d;
    if (!better || r.yaw > 15 || g.yaw > 15) ok = false;
    console.log(`  ${name.padEnd(7)} stop 80-0: road ${r.d.toFixed(1)} m, gravel ${g.d.toFixed(1)} m | 0-100 floored: road ${fmt(sr)}, gravel ${fmt(sg)}${better ? '' : '  <- WRONG WAY'}`);
  }
}
console.log(ok ? '\ngravel tyres: better on loose ground, worse on tarmac, stops straight' : '\nTYRE CHECK FAILED');
process.exit(ok ? 0 : 1);
