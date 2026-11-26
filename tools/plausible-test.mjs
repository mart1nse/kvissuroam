// Is a record's drive this car's drive? (src/race/plausible.js, 26 Nov 2026: two Audi 200 records driven with the
// car's figures changed in the browser.) The check must never refuse an honest drive, and must refuse a car made
// much stronger.
//   node tools/plausible-test.mjs
// 1) The records of 26 Nov as they came from players' browsers (tools/fixtures/replays, one a car): none over a
//    limit for more than a second, and the tuned Audi 200 record refused.
// 2) Every car driven hard by the game's own physics on a flat road, on road and on gravel tyres: flat out from a
//    standstill, full stops, held full lock at speed, a slalom, into a wall, and over steep hills with crests
//    it leaves the ground on: nothing over.
// 3) The same drive with twice the grip, with twice the engine on top of it, and under another, slower car's
//    name: refused each time.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { carLimits, carLimitsSteps, judgeDrive, STEP, OVER_MAX } from '../src/race/plausible.js';

const show = (j) => `pull ${j.pull} grip ${j.grip} stop ${j.stop} top ${j.top}`;

// ---- 1) real drives
const dir = new URL('./fixtures/replays/', import.meta.url);
for (const file of readdirSync(dir).sort()) {
  const car = file.replace(/(-tuned)?\.gz$/, ''), tuned = file.includes('-tuned');
  const a = gunzipSync(readFileSync(new URL(file, dir))).toString().split(',').map(Number);
  const [, f, , n] = a;
  const xs = new Float64Array(n), zs = new Float64Array(n), ys = new Float64Array(n);
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < n; i++) { x += a[4 + i * f]; z += a[5 + i * f]; y += a[6 + i * f]; xs[i] = x / 100; zs[i] = z / 100; ys[i] = y / 100; }
  const j = judgeDrive(xs, zs, ys, carLimits(CARS[car]));
  console.log(`${file.padEnd(18)} ${show(j)}${j.why ? `  REFUSED (${j.why})` : ''}`);
  if (tuned) assert.equal(j.why, 'pull', `${file}: the tuned record must be refused`);
  else assert.ok(Math.max(j.pull, j.grip, j.stop, j.top) <= 1, `${file}: an honest record reads ${show(j)}`);
}

// ---- 2) and 3) drives on the physics
// a flat dry road with a wall across it at z = -WALL (the car starts at 0 heading for it, yaw 0 looks down -z)
const WALL = 2600;
const road = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: (x, z) => z + WALL, sdfGrad: (x, z, o) => { o.x = 0; o.z = 1; return o; }, gravelAt: () => 0 };
// the same road over hills: 12 m up and down every 250 m, as steep as 15 in 100, with crests a fast car leaves the ground on
const hills = { ...road, heightAt: (x, z) => 6 * Math.sin(z / 40) + 1.5 * Math.sin(z / 9) };
function drive(spec, tyres, plan, world = road) {
  const road = world;
  const car = createCar(spec, { x: 0, z: 0, yaw: 0, y: world.heightAt(0, 0) });
  car.tyres = tyres;
  const xs = [], zs = [], ys = [], dt = 1 / 60;
  let t = 0, next = 0;
  for (const [secs, inp] of plan) {
    for (const end = t + secs; t < end; t += dt) {
      stepCar(car, typeof inp === 'function' ? inp(t, car) : inp, road, dt);
      if (t >= next) { xs.push(car.x); zs.push(car.z); ys.push(car.y); next += STEP; }
    }
  }
  return [Float64Array.from(xs), Float64Array.from(zs), Float64Array.from(ys)];
}
const PLAN = [
  [14, { up: 1 }], [4, { down: 1 }],                              // flat out from a standstill, a full stop
  [9, { up: 1 }], [9, { up: 1, right: 1 }], [9, { up: 1, left: 1 }],   // up to speed, full lock held each way
  [8, (t) => ({ up: 1, steer: Math.sin(t * 2.2) })],              // a slalom
  [3, { down: 1, left: 1 }],                                      // braking into a bend
  [10, (t, car) => ({ up: 1, steer: Math.max(-1, Math.min(1, -car.yaw * 2)) })],   // straighten up, flat out
  [3, { down: 1 }], [12, (t, car) => ({ up: 1, steer: Math.max(-1, Math.min(1, -car.yaw * 2)) })],
];
// (and one straight into the wall at speed, then on: a knock is not tuning)
const CRASH = [[60, (t, car) => ({ up: 1, steer: Math.max(-1, Math.min(1, -car.yaw * 2)) })], [6, { up: 1, right: 1 }], [6, { up: 1 }]];
// (over the hills: flat out, stops on the way down, a weave)
const HILLS = [[25, { up: 1 }], [3, { down: 1 }], [20, (t) => ({ up: 1, steer: 0.25 * Math.sin(t * 1.3) })], [3, { down: 1 }], [15, (t, car) => ({ up: 1, steer: Math.max(-1, Math.min(1, -car.yaw * 2)) })]];
const copy = (spec, change) => { const s = structuredClone(spec); change(s); return s; };
let worst = 0;
for (const spec of Object.values(CARS)) {
  const lim = carLimits(spec);
  if (!lim) { console.log(`${spec.id.padEnd(8)} not judged (thrusters)`); continue; }
  for (const tyres of ['road', 'gravel']) {
    for (const [name, plan, world] of [['hard', PLAN], ['wall', CRASH], ['hills', HILLS, hills]]) {
      const j = judgeDrive(...drive(spec, tyres, plan, world), lim);
      worst = Math.max(worst, j.pull, j.grip, j.stop, j.top);
      assert.equal(j.why, '', `${spec.id} on ${tyres} tyres, ${name}: an honest drive refused (${show(j)})`);
      assert.ok(Math.max(j.pull, j.grip, j.stop, j.top) <= 1, `${spec.id} on ${tyres} tyres, ${name}: ${show(j)}`);
    }
  }
  // grip as suction fans give it, the car's own weight again pressing on the tyres: bends and stops at 2 g, and
  // the keyboard's steering follows it (the tuned record of 26 Nov read 2 to 2.3 g in both)
  const sticky = copy(spec, (s) => { s.fanDown = (s.fanDown || 0) + s.mass * 9.81; });
  // and with that grip twice the engine or the motors (alone it only spins the wheels of the strong cars)
  const strong = copy(sticky, (s) => {
    for (const e of [s.engine, s.engine.turbo]) for (const k of ['torque', 'torqueOff']) if (e?.[k]) e[k] = e[k].map(([r, t]) => [r, t * 2]);
    for (const k of ['maxPowerKw', 'maxWheelForce']) if (s.engine[k]) s.engine[k] *= 2;
  });
  const a = judgeDrive(...drive(strong, 'road', PLAN), lim), b = judgeDrive(...drive(sticky, 'road', PLAN), lim);
  console.log(`${spec.id.padEnd(8)} honest ok | twice the pull: ${show(a)} | twice the grip: ${show(b)}`);
  assert.ok(a.pull > OVER_MAX, `${spec.id} with twice the pull must be refused for it (${show(a)})`);
  assert.ok(b.grip > OVER_MAX, `${spec.id} with twice the grip must be refused for it (${show(b)})`);
}
// a fast car's drive under a slow car's name
for (const [drove, said] of [['f40', 'audi200'], ['cgt', 'm3'], ['impreza', 'passat'], ['m3', 'bus']]) {
  const j = judgeDrive(...drive(CARS[drove], 'road', PLAN), carLimits(CARS[said]));
  assert.ok(j.why, `${drove} driven as ${said} must be refused (${show(j)})`);
}
// the limits worked out in slices (the server) are the same as all at once
{
  const it = carLimitsSteps({ ...structuredClone(CARS.w201), id: 'w201 again' }, 150), whole = carLimits(CARS.w201);
  let r, stops = 0;
  do { r = it.next(); stops++; } while (!r.done);
  assert.ok(stops > 10, 'in slices');
  assert.deepEqual([...r.value.pull], [...whole.pull]);
}
console.log(`ok: honest drives at most ${worst} s over a limit (refused past ${OVER_MAX} s)`);
