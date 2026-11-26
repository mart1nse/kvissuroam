// The Focus WRC's bonnet (src/cars/bonnet.js, Martin 2026-11-26): a hit of 50 km/h or more throws it up against the
// windscreen, it stays there until the car goes over 100 km/h, then it is torn off. Driven on the game's physics:
// the Focus at a wall at speeds either side of 50 (straight and at an angle: what counts is the speed INTO the wall),
// then away from the wall and up past 100. Also: the drag while it is up, and nothing on any other car.
// Run: node tools/bonnet-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
import { POP_KMH, OFF_KMH, fixBonnet } from '../src/cars/bonnet.js';

const mkWorld = () => ({
  meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1,
  sdfAt: (x, z) => z, sdfGrad: (x, z, o) => { o[0] = 0; o[1] = 1; return o; },
});
const open = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
let fails = 0;
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fails++; };

// at kmh, deg off straight at the wall (z < 0 solid), 6 m from it, coasting into it
function hit(id, kmh, deg = 0) {
  const a = (deg * Math.PI) / 180, yaw = a, world = mkWorld();
  const car = createCar(CARS[id], { x: 0, z: 6, yaw });
  car.crashDice = 0.3;                                    // (over 140 a crash ends on its wheels)
  car.vx = kmh / 3.6;
  let peak = 0;
  for (let t = 0; t < 1.5; t += 1 / 60) { stepCar(car, { up: 0 }, world, 1 / 60); peak = Math.max(peak, car.hit); }
  return { car, peak, world };
}

for (const [kmh, deg, want] of [[40, 0, 'shut'], [48, 0, 'shut'], [55, 0, 'up'], [80, 0, 'up'], [90, 60, 'shut'], [120, 60, 'up'], [160, 0, 'up']]) {
  const { car, peak } = hit('focus', kmh, deg);
  check(car.bonnet.state === want, `${kmh} km/h at ${deg} deg off straight: ${(peak * 3.6).toFixed(0)} km/h into the wall -> ${car.bonnet.state} (want ${want})`);
}

// up, then driven away: stays up to 100, torn off past it
{
  const { car } = hit('focus', 60);
  car.yaw = Math.PI; car.vx = 0; car.vy = 0; car.z = 8; car.x = 0; car.yawRate = 0;   // (turned round, away from the wall)
  let at100 = null, offAt = null, max = 0;
  for (let t = 0; t < 12 && offAt == null; t += 1 / 60) {
    stepCar(car, { up: 1 }, open, 1 / 60);
    const v = speedKmh(car); max = Math.max(max, v);
    if (at100 == null && v > OFF_KMH) at100 = t;
    if (car.bonnet.state === 'gone') offAt = { t, v };
    if (car.bonnet.state !== 'up' && car.bonnet.state !== 'gone') break;
    if (v < OFF_KMH - 0.5 && car.bonnet.state === 'gone') break;
  }
  check(offAt && offAt.v > OFF_KMH && offAt.v < OFF_KMH + 6, `driven off: torn off at ${offAt?.v.toFixed(1)} km/h (${OFF_KMH} the line)`);
  // and no faster with the bay open than... it keeps going
  for (let t = 0; t < 2; t += 1 / 60) stepCar(car, { up: 1 }, open, 1 / 60);
  check(car.bonnet.state === 'gone', 'gone stays gone');
  fixBonnet(car);
  check(car.bonnet.state === 'shut' && car.bonnet.drag === 0, 'a fresh bonnet: shut, no drag');
}

// held under 100 it stays up
{
  const { car } = hit('focus', 70);
  car.yaw = Math.PI; car.vx = 0; car.vy = 0; car.z = 8;
  let max = 0;
  for (let t = 0; t < 10; t += 1 / 60) { const v = speedKmh(car); stepCar(car, { up: v < 95 ? 1 : 0 }, open, 1 / 60); max = Math.max(max, speedKmh(car)); }
  check(car.bonnet.state === 'up', `held at ${max.toFixed(0)} km/h for 10 s: still up`);
}

// the bonnet up is an air brake: top speed in a straight line with it up (it would tear off: held 'up' by hand)
{
  const top = (state) => {
    const car = createCar(CARS.focus, { x: 0, z: 0, yaw: 0 });
    let v = 0;
    for (let t = 0; t < 60; t += 1 / 60) { if (state) { car.bonnet.state = state; car.bonnet.drag = state === 'up' ? 0.25 : 0.03; car.bonnet.at = -9; } stepCar(car, { up: 1 }, open, 1 / 60); if (state === 'up') car.bonnet.state = 'up'; v = Math.max(v, speedKmh(car)); }
    return v;
  };
  const a = top(null), g = top('gone');
  console.log(`     top speed: whole ${a.toFixed(0)} km/h, without the bonnet ${g.toFixed(0)} km/h`);
  check(g <= a + 0.5, 'no faster without it');
}

// no other car has one
for (const id of Object.keys(CARS)) if (id !== 'focus') { const c = createCar(CARS[id], { x: 0, z: 0, yaw: 0 }); if (c.bonnet) check(false, `${id} has a bonnet state`); }
check(POP_KMH === 50 && OFF_KMH === 100, 'the lines are 50 and 100 km/h');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
