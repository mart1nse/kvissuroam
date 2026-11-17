// Manual gear keys check (A up, Z down): the picked gear is held until the shift point, then the
// automatic takes over again. Run: node tools/gear-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh, shiftGear } from '../src/cars/physics.js';

const w = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120;
const drive = (car, s, inp) => { for (let t = 0; t < s; t += dt) stepCar(car, inp, w, dt); };
for (const id of ['w201', 'f40', 'bus']) {
  const car = createCar(CARS[id], { x: 0, z: 0, yaw: 0 });
  drive(car, 4, { up: 1 });
  const g0 = car.gear, k0 = speedKmh(car).toFixed(0);
  const ok = shiftGear(car, 1);
  const g1 = car.gear, r1 = Math.round(car.rpm);
  let t = 0;
  while (car.manual && t < 30) { stepCar(car, { up: 1 }, w, dt); t += dt; }
  const upHeld = `${g0}->${g1} at ${k0} km/h, held ${t.toFixed(1)} s, released at ${Math.round(car.rpm)} rpm (shift ${CARS[id].engine.shiftRpm})`;
  drive(car, 1, { up: 0.3 });
  const gd = car.gear, okd = shiftGear(car, -1);
  const gd1 = car.gear;
  drive(car, 0.5, { up: 0.3 });
  console.log(id.padEnd(5), ok, upHeld, `| Z ${gd}->${gd1} ${okd}, 0.5 s later gear ${car.gear} manual ${car.manual}`);
}
