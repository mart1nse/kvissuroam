// Drag strip launch check (src/race/drag.js): each car revved in neutral to a range of revs, the clutch dropped into
// first flat out (A at green), shifted up at its shift point, timed to 60 ft, 1/8 and 1/4 mile. A good launch must
// be worth something: some revs between idle and the limiter give a better 60 ft than both a bog off idle and a
// launch off the limiter (unless the car is four-wheel drive with grip to spare, where more revs only ever help a little).
// Run: node tools/drag-launch-test.mjs [car]
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh, stickShift } from '../src/cars/physics.js';
const world = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const dt = 1 / 120;
const only = process.argv[2];
const FT60 = 18.288, EIGHTH = 201.168, QUARTER = 402.336;

function run(spec, rpm) {
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  car.stick = true; car.neutral = true;
  for (let t = 0; t < 1; t += dt) stepCar(car, {}, world, dt);          // settle
  // rev it in neutral to `rpm` (the test holds the free revs there; the throttle is down at the drop)
  for (let t = 0; t < 0.5; t += dt) { stepCar(car, { up: 1 }, world, dt); car.free = rpm; car.x = car.z = 0; car.vx = car.vy = car.yawRate = 0; }
  car.free = rpm; car.rpm = rpm;
  stickShift(car, 1);
  let t = 0, d = 0, t60 = 0, t8 = 0, tq = 0, v8 = 0, vq = 0, x0 = car.x, z0 = car.z;
  const ev = spec.engine.type === 'ev';
  while (t < 40 && !tq) {
    stepCar(car, { up: 1 }, world, dt);
    t += dt;
    // shift up at the shift point (a driver watching the shift light)
    // (on the road's revs, not the spinning tyres': with the tyres lit the revs fly up long before the gear is used)
    const road = (Math.abs(car.vx) / spec.wheelRadius) * spec.gears[car.gear - 1] * spec.finalDrive * (60 / (2 * Math.PI));
    if (!ev && car.shiftTimer <= 0 && road >= spec.engine.shiftRpm * 0.9 && car.gear < spec.gears.length) stickShift(car, 1);
    d = Math.hypot(car.x - x0, car.z - z0);
    if (!t60 && d >= FT60) t60 = t;
    if (!t8 && d >= EIGHTH) { t8 = t; v8 = speedKmh(car); }
    if (!tq && d >= QUARTER) { tq = t; vq = speedKmh(car); }
  }
  return { t60, t8, tq, v8, vq };
}

let ok = true;
for (const spec of Object.values(CARS)) {
  if (only && spec.id !== only) continue;
  if (spec.thrusters) continue;
  const e = spec.engine, ev = e.type === 'ev';
  const revs = ev ? [0] : [];
  if (!ev) for (let r = e.idle; r <= e.redline; r += (e.redline - e.idle) / 8) revs.push(Math.round(r));
  const res = revs.map((r) => ({ r, ...run(spec, r) }));
  const best = res.reduce((a, b) => (b.tq && b.tq < a.tq ? b : a), res[0]);
  const lo = res[0], hi = res[res.length - 1];
  const line = res.map((x) => `${ev ? 'EV' : x.r}:${x.t60.toFixed(2)}/${x.tq.toFixed(2)}`).join(' ');
  const sweet = !ev && best.r > lo.r && best.r < hi.r;
  console.log(`${spec.short.padEnd(14)} ${spec.drive} best ${ev ? '' : `${best.r} rpm `}60ft ${best.t60.toFixed(2)} 1/8 ${best.t8.toFixed(2)} @${best.v8.toFixed(0)} 1/4 ${best.tq.toFixed(2)} @${best.vq.toFixed(0)} km/h ${ev ? '' : sweet ? 'sweet spot' : 'edge'}\n   ${line}`);
}

// with `band`: the revs whose quarter mile is within 0.05 s of the best, for the dial's green arc (LAUNCH in src/race/drag.js)
if (process.argv.includes('band')) {
  const out = {};
  for (const spec of Object.values(CARS)) {
    const e = spec.engine;
    if (spec.thrusters || e.type === 'ev') continue;
    const res = [];
    for (let r = e.idle; r <= e.redline; r += 250) res.push({ r, ...run(spec, r) });
    const best = Math.min(...res.map((x) => x.tq));
    const good = res.filter((x) => x.tq <= best + 0.05).map((x) => x.r);
    out[spec.id] = [Math.min(...good), Math.max(...good)];
  }
  console.log(JSON.stringify(out));
}
