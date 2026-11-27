// Tailpipe flame check (cars with spec.exhaust.flame, the Impreza 22B). Run: node tools/flame-test.mjs
// A downshift's crackle (car.exhaustPop, set by audio.js) must light a few small flame balls at the pipe's
// end that keep up with the car and are gone within a quarter of a second; no crackle, no flame; and a car
// without the flag never makes one. The Focus WRC's anti-lag bangs (car.exhaustBangs, a count the engine sound
// tells of) light a flame each, and its flames (exhaust.flameSize) are a touch bigger than the 22B's.
import { CARS } from '../src/cars/specs.js';
import { createCar } from '../src/cars/physics.js';
import { createSmoke } from '../src/smoke.js';

const world = { groundAt: () => 0, surfaceAt: () => 1 };
const dt = 1 / 60;
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
function run(id, pop, bangEvery = 0) {
  const smoke = createSmoke(world), car = createCar(CARS[id], { x: 0, z: 0, yaw: 0 });
  car.vx = 25; car.y = 0;
  let most = 0, far = 0, big = 0, f = 0;
  const P = smoke.points.geometry.attributes.position.array, S = smoke.points.geometry.attributes.aSize.array;
  for (let t = 0; t < 0.5; t += dt) {
    car.exhaustPop = pop;
    if (bangEvery && ++f % bangEvery === 0) car.exhaustBangs = (car.exhaustBangs || 0) + 1;
    car.z -= car.vx * dt;                     // (yaw 0 faces -z)
    smoke.update(car, dt, true);
    most = Math.max(most, smoke.count);
    const ex = car.spec.exhaust;
    for (let i = 0; i < S.length; i++) big = Math.max(big, S[i]);
    if (ex) for (let i = 0; i < S.length; i++) if (S[i] > 0) {
      // behind the pipe's end, never ahead of it, and close
      const back = P[i * 3 + 2] - (car.z + car.b + ex.back);
      far = Math.max(far, back, -back * 10, Math.abs(P[i * 3] - ex.x) * 4, Math.abs(P[i * 3 + 1] - ex.y) * 4);
    }
  }
  const lit = smoke.count;
  for (let t = 0; t < 0.25; t += dt) { car.exhaustPop = 0; car.z -= car.vx * dt; smoke.update(car, dt, true); }
  return { most, lit, after: smoke.count, far, big };
}
const a = run('impreza', 0.8), b = run('impreza', 0.1), c = run('m3', 0.8);
console.log(`impreza, loud crackle: up to ${a.most} flame balls at once, ${a.after} left 0.25 s after it stops, reaching ${a.far.toFixed(2)} m behind the pipe`);
console.log(`impreza, faint crackle: ${b.most}; a car without the flag: ${c.most}`);
if (!(a.most >= 2 && a.most <= 12)) fail('a loud crackle should show 2 to 12 flame balls at once');
if (a.after !== 0) fail('the flame must be out a quarter of a second after the crackle');
if (!(a.far < 0.55)) fail('the flame must stay at the tailpipe: within 0.55 m behind it, not ahead, not off to a side');
if (b.most !== 0) fail('a faint crackle makes no flame');
if (c.most !== 0) fail('a car without spec.exhaust.flame makes no flame');
const d = run('focus', 0.8), e = run('focus', 0, 6), g = run('impreza', 0, 6);
console.log(`focus, loud crackle: biggest ball ${d.big.toFixed(3)} against the 22B's ${a.big.toFixed(3)}; anti-lag bangs: up to ${e.most} balls, ${e.after} left after, reaching ${e.far.toFixed(2)} m`);
if (!(d.big > a.big * 1.15 && d.big < a.big * 1.6)) fail("the Focus's flames should be a touch bigger than the 22B's (1.15 to 1.6 times)");
if (!(e.most >= 3)) fail('anti-lag bangs should light flames');
if (e.after !== 0) fail('the flame must be out a quarter of a second after the bangs');
if (!(e.far < 0.75)) fail("a bang's flame must stay at the tailpipe (within 0.75 m)");
if (g.most < 3) fail('bangs light a flame on any car with the flag');
console.log(ok ? 'tailpipe flame: PASS' : 'tailpipe flame: FAILED');
process.exit(ok ? 0 : 1);
