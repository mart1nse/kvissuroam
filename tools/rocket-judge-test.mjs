// The server's car check for a car with thrusters (the Roadster Rocket), src/race/plausible.js: what the tyres and
// motors do not explain must be gas, and a tank holds only so much (26 Nov 2026, Martin: "make all the checks of
// hacking to this or any other hack scenario (or enabling jump ...) and fix them"; until then such a car was not
// judged at all).
// 1) Honest drives on the game's own physics, with BOOST used every way it can be: held from a standstill until the
//    tank is dry, in bursts, in bends and slides, over hills, into a wall, with the fans off, and as greedily as the
//    buttons allow for minutes on end. None may be refused, and none may come near.
// 2) Every way a changed page could make the car more than it is: each must be refused.
//   node tools/rocket-judge-test.mjs   (add --v for every drive's figures)
import assert from 'node:assert/strict';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { TANK_S, BOOST_MIN, REFILL_S, refillTank } from '../src/cars/thrust.js';
import { carLimits, judgeDrive, STEP, OVER_MAX, GAS_OVER } from '../src/race/plausible.js';

const verbose = process.argv.includes('--v');
const spec = CARS.rocket, lim = carLimits(spec);
const show = (j) => `pull ${j.pull} grip ${j.grip} stop ${j.stop} top ${j.top} gas ${j.gas} air ${j.air} (counted ${j.spent} tanks)${j.why ? ` REFUSED: ${j.why}` : ''}`;

// a flat dry road with a wall across it at z = -WALL (the car starts at 0 heading for it, yaw 0 looks down -z)
const WALL = 9000;
const road = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: (x, z) => z + WALL, sdfGrad: (x, z, o) => { o.x = 0; o.z = 1; return o; }, gravelAt: () => 0 };
const near = { ...road, sdfAt: (x, z) => z + 1500 };
const hills = { ...road, heightAt: (x, z) => 6 * Math.sin(z / 40) + 1.5 * Math.sin(z / 9) };

// plan: [[seconds, input or (t, car) => input], ...]; each: done to the car before every step (a changed page)
function drive(s, plan, { world = road, fanOff = false, each = null, tyres = 'road' } = {}) {
  refillTank(s.id);                                      // (the game fills the tank at the line of every timed lap)
  const car = createCar(s, { x: 0, z: 0, yaw: 0, y: world.heightAt(0, 0) });
  car.tyres = tyres; car.fanOff = fanOff;
  const xs = [], zs = [], ys = [], roll = [], dt = 1 / 60;
  let t = 0, next = 0, blown = 0, top = 0, out = 0, was = TANK_S;
  for (const [secs, inp] of plan) {
    for (const end = t + secs; t < end; t += dt) {
      each?.(car);
      stepCar(car, typeof inp === 'function' ? inp(t, car) : inp, world, dt);
      if (car.rocket?.on) blown += dt;
      if (car.rocket) { out += Math.max(0, was - car.rocket.tank); was = car.rocket.tank; }
      top = Math.max(top, Math.hypot(car.vx, car.vy));
      if (t >= next) { xs.push(car.x); zs.push(car.z); ys.push(car.y); roll.push(car.roll || 0); next += STEP; }
    }
  }
  refillTank(s.id);
  return { xs: Float64Array.from(xs), zs: Float64Array.from(zs), ys: Float64Array.from(ys), roll: Float64Array.from(roll), blown, top: top * 3.6, out: out / TANK_S, t };
}
const judge = (d, l = lim) => judgeDrive(d.xs, d.zs, d.ys, l, { roll: d.roll });
const straight = (car) => Math.max(-1, Math.min(1, -car.yaw * 2));
// BOOST as greedily as the button allows: held whenever there is gas to open the valves, let go when it runs dry
const greedy = (car) => !car.rocket.dry && (car.rocket.on || car.rocket.tank >= BOOST_MIN * TANK_S);
// ...or only from a full tank, each time until it is dry: the most push there is to be had
const whenFull = (car) => !car.rocket.dry && (car.rocket.on || car.rocket.tank >= 0.995 * TANK_S);
// ...or from half a tank on
const fromHalf = (car) => !car.rocket.dry && (car.rocket.on || car.rocket.tank >= 0.5 * TANK_S);
// round and round: flat out and BOOST to `hi` m/s, brake to `lo`, weaving
const laps = (lo, hi, boost = greedy) => { let braking = false; return (t, car) => {
  const v = Math.hypot(car.vx, car.vy);
  if (v > hi) braking = true; else if (v < lo) braking = false;
  return braking ? { down: 1, steer: straight(car) } : { up: 1, boost: boost(car, t), steer: straight(car) + 0.15 * Math.sin(t * 0.9) };
}; };

const HONEST = [
  ['BOOST held from a standstill until dry, flat out, a stop', [[25, { up: 1, boost: 1 }], [5, { down: 1 }]]],
  ['flat out on the motors, BOOST at 200 km/h', [[5.5, { up: 1 }], [10, { up: 1, boost: 1 }], [4, { down: 1 }]]],
  ['bursts of a second, weaving', [[60, (t) => ({ up: 1, boost: t % 2 < 1, steer: 0.3 * Math.sin(t * 1.1) })], [5, { down: 1 }]]],
  ['short taps, five a second', [[40, (t) => ({ up: 1, boost: t % 0.2 < 0.1, steer: 0.2 * Math.sin(t * 0.8) })], [5, { down: 1 }]]],
  ['BOOST on full lock, each way', [[3, { up: 1 }], [7, { up: 1, boost: 1, right: 1 }], [3, { up: 1 }], [60, { up: 1, steer: 0 }], [7, { up: 1, boost: 1, left: 1 }], [4, { down: 1 }]], { world: near }],
  ['a slalom on BOOST', [[2, { up: 1 }], [8, (t) => ({ up: 1, boost: 1, steer: Math.sin(t * 2.2) })], [3, { down: 1, left: 1 }], [62, (t, car) => ({ up: 1, steer: straight(car) })], [8, (t) => ({ up: 1, boost: 1, steer: Math.sin(t * 3.1) })], [4, { down: 1 }]]],
  ['a handbrake slide on BOOST', [[4, { up: 1 }], [1.2, { up: 1, right: 1, hb: 1, handbrake: 1 }], [6, { up: 1, boost: 1, left: 0.6 }], [4, (t, car) => ({ up: 1, steer: straight(car) })], [4, { down: 1 }]]],
  ['backwards on BOOST: spun round, the nozzles as a brake', [[6, { up: 1 }], [2.5, { right: 1, hb: 1, handbrake: 1 }], [6, { boost: 1 }], [6, { down: 1 }]]],
  ['as greedily as the button allows, 4 minutes, 80 to 300 km/h', [[240, laps(80 / 3.6, 300 / 3.6)]]],
  ['as greedily as the button allows, 4 minutes, 30 to 150 km/h', [[240, laps(30 / 3.6, 150 / 3.6)]]],
  ['a full tank blown dry every time it is full, 4 minutes', [[240, laps(80 / 3.6, 300 / 3.6, whenFull)]]],
  ['a full tank blown dry every time it is full, slow: 20 to 120 km/h', [[240, laps(20 / 3.6, 120 / 3.6, whenFull)]]],
  ['BOOST from half a tank on, 4 minutes', [[240, laps(80 / 3.6, 300 / 3.6, fromHalf)]]],
  ['every drop of gas at once: BOOST whenever a tenth is in, 3 minutes', [[180, laps(120 / 3.6, 250 / 3.6, (car) => car.rocket.on || car.rocket.tank >= BOOST_MIN * TANK_S)]]],
  ['over the hills on BOOST', [[20, { up: 1, boost: 1 }], [3, { down: 1 }], [60, laps(60 / 3.6, 220 / 3.6)]], { world: hills }],
  ['into the wall on BOOST, and on', [[9, { up: 1, boost: 1 }], [8, { up: 1 }], [6, { up: 1, right: 1 }], [6, { up: 1, boost: 1 }]], { world: { ...road, sdfAt: (x, z) => z + 900 } }],
  ['fans off: to 405 km/h, BOOST from 300', [[13, { up: 1 }], [40, { up: 1, boost: 1 }], [6, { down: 1 }]], { fanOff: true }],
  ['fans off: greedy, 2 minutes', [[120, laps(80 / 3.6, 330 / 3.6)]], { fanOff: true }],
  ['on gravel tyres: greedy, 2 minutes', [[120, laps(40 / 3.6, 200 / 3.6)]], { tyres: 'gravel' }],
  ['no BOOST at all: hard driving', [[14, { up: 1 }], [4, { down: 1 }], [9, { up: 1 }], [9, { up: 1, right: 1 }], [9, { up: 1, left: 1 }], [8, (t) => ({ up: 1, steer: Math.sin(t * 2.2) })], [3, { down: 1, left: 1 }], [10, (t, car) => ({ up: 1, steer: straight(car) })]], { world: near }],
];
let worst = { pull: 0, grip: 0, stop: 0, top: 0, gas: 0, air: 0 };
for (const [name, plan, opt] of HONEST) {
  const d = drive(spec, plan, opt), j = judge(d);
  if (verbose) console.log(`honest  ${name.padEnd(64)} ${show(j)}  (valves open ${d.blown.toFixed(1)} s, ${d.out.toFixed(2)} tanks out, top ${d.top.toFixed(0)} km/h)`);
  for (const k of Object.keys(worst)) worst[k] = Math.max(worst[k], j[k]);
  assert.equal(j.why, '', `honest, ${name}: refused (${show(j)})`);
  assert.ok(Math.max(j.pull, j.grip, j.stop, j.top) <= 1 && j.gas === 0 && j.spent <= 0.8 * (1 + d.t / REFILL_S) && j.air === 0, `honest, ${name}: too near a limit (${show(j)})`);
}
console.log(`ok  ${HONEST.length} honest drives with BOOST: at most ${JSON.stringify(worst)} (refused past ${OVER_MAX} s, gas past ${GAS_OVER} of a tank)`);

// ---- a changed page
const copy = (change) => { const s = structuredClone(spec); change(s); return s; };
const GREEDY = [[150, laps(80 / 3.6, 300 / 3.6, fromHalf)]], DRY = [[25, { up: 1, boost: 1 }], [5, { down: 1 }]];
const CHEATS = [
  // the tank
  ['the tank never empties', spec, [[40, laps(80 / 3.6, 300 / 3.6, () => true)]], { each: (car) => { car.rocket.tank = TANK_S; car.rocket.dry = false; } }, 'gas'],
  ['the 2 second test refill switched on', spec, [[150, ((f) => (t, car) => ({ ...f(t, car), quickRefill: true }))(laps(80 / 3.6, 300 / 3.6, whenFull))]], {}, 'gas'],
  ['the tank fills while BOOST blows', spec, [[60, laps(80 / 3.6, 300 / 3.6, () => true)]], { each: (car) => { car.rocket.tank = Math.min(TANK_S, car.rocket.tank + TANK_S / 60 / 4); car.rocket.dry = false; } }, 'gas'],
  ['twice the gas in the tanks', copy((s) => { s.thrusters.gasKg *= 2; s.mass += 250; }), GREEDY, {}, 'gas'],
  ['half as much gas for the same push', spec, GREEDY, { each: (car) => { if (car.rocket.on) car.rocket.tank = Math.min(TANK_S, car.rocket.tank * (1 + 1 / 60 / 4.06)); } }, 'gas'],
  // the car
  ['thrusters three times as strong, three times the gas', copy((s) => { s.thrusters.rear *= 3; s.thrusters.gasKg *= 3; s.mass += 500; }), GREEDY, {}, ''],
  ['BOOST that does not ease off at the top speed', copy((s) => { s.limiter = s.limiterNoFans = 520; }), [[110, { up: 1, boost: 1 }]], { each: (car) => { car.rocket.tank = Math.max(car.rocket.tank, 4); car.rocket.dry = false; } }, 'speed'],
  // (motors made stronger: since the tank fills in 10 s, not a minute (Martin 27 Nov), honest BOOST can add about
  // 0.8 g on average for as long as a drive lasts, so twice the motors with BOOST never pressed reads as an honest car
  // using it and is not refused; with BOOST used as well it is, and three times the motors without it)
  ['twice the motors, and BOOST', copy((s) => { s.engine.maxPowerKw *= 2; s.engine.maxWheelForce *= 2; s.fanDown += s.mass * 9.81; }), GREEDY, {}, ''],
  ['1.5 times the motors, and BOOST', copy((s) => { s.engine.maxPowerKw *= 1.5; s.engine.maxWheelForce *= 1.5; s.fanDown += 0.5 * s.mass * 9.81; }), GREEDY, {}, ''],
  ['three times the motors', copy((s) => { s.engine.maxPowerKw *= 3; s.engine.maxWheelForce *= 3; s.fanDown += 2 * s.mass * 9.81; }), [[14, { up: 1 }], [4, { down: 1 }], [130, laps(60 / 3.6, 250 / 3.6, () => false)]], {}, ''],
  ['a car 700 kg lighter', copy((s) => { s.mass -= 700; }), GREEDY, {}, ''],
  ['fans that pull twice the car\'s weight down', copy((s) => { s.fanDown += 2 * s.mass * 9.81; }), [[9, { up: 1 }], [9, { up: 1, right: 1 }], [9, { up: 1, left: 1 }], [8, (t) => ({ up: 1, steer: Math.sin(t * 2.2) })]], { world: near }, 'grip'],
];
for (const [name, s, plan, opt, want] of CHEATS) {
  const d = drive(s, plan, opt), j = judge(d);
  if (verbose) console.log(`cheat   ${name.padEnd(64)} ${show(j)}  (valves open ${d.blown.toFixed(1)} s, ${d.out.toFixed(2)} tanks out, top ${d.top.toFixed(0)} km/h)`);
  // (over 432 km/h two samples are more than 12 m apart: the replay check refuses that before the car is judged,
  // worker/index.js checkTrace 'speed', and the judge takes such a step for R)
  let far = 0;
  for (let i = 1; i < d.xs.length; i++) if (Math.hypot(d.xs[i] - d.xs[i - 1], d.zs[i] - d.zs[i - 1]) > 12) far++;
  if (want === 'speed') { assert.ok(far > 0, `${name}: must be refused as too fast for any car (${show(j)})`); continue; }
  assert.equal(far, 0);
  assert.ok(j.why, `${name}: must be refused (${show(j)})`);
  if (want) assert.equal(j.why, want, `${name}: refused for ${j.why}, expected ${want} (${show(j)})`);
}
console.log(`ok  ${CHEATS.length} changed cars and tanks: every one refused`);

// ---- a kickflip inside the drive (the game allows none once a lap or a stage run is on)
const downs = { ...road, heightAt: (x, z) => 5 * Math.sin(z / 90) };   // (long gentle hills: on the steep ones a bank ends the flight at once)
for (const [kmh, world] of [[60, road], [140, road], [280, road], [90, downs], [200, downs]]) {
  // (FLIP pressed again and again until the car is off the ground: over a crest it has to wait for its wheels)
  let flown = false;
  const press = (t, car) => { flown ||= !!car.rocket.flight; return { up: 0.3, flip: !flown && Math.floor(t * 10) % 2 === 0 }; };
  const d = drive(spec, [[kmh / 40 + 1, (t, car) => ({ up: Math.hypot(car.vx, car.vy) < kmh / 3.6 ? 1 : 0.2 })], [9, press], [3, { down: 1 }]], { world });
  assert.ok(flown);
  const j = judge(d);
  if (verbose) console.log(`flight  at ${String(kmh).padStart(3)} km/h${world === downs ? ' over hills' : ''}`.padEnd(72), show(j), `(most roll ${Math.max(...d.roll.map(Math.abs)).toFixed(2)})`);
  assert.equal(j.why, 'air', `a kickflip at ${kmh} km/h must be refused as a flight (${show(j)})`);
  // (told without the samples' roll, as a race lap followed from positions is, it is not judged for that)
  assert.equal(judgeDrive(d.xs, d.zs, d.ys, lim).air, 0);
}
console.log('ok  a kickflip in the drive is refused, at any speed');

// ---- thrown over by a wall (src/cars/crash.js: over 140 km/h, squarely) is not a kickflip: every ending of a crash,
// nose first, sideways and tail first, and on with BOOST from where the car stands again
{
  const wall = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: (x, z) => z, sdfGrad: (x, z, o) => { o[0] = 0; o[1] = 1; return o; } };
  let n = 0, over = 0;
  for (const kmh of [145, 220, 320, 389]) for (const deg of [0, 25]) for (const turn of [0, 90, 180]) for (const dice of [0.3, 0.66, 0.74, 0.9]) {
    refillTank(spec.id);
    const a = (deg * Math.PI) / 180, dir = [Math.sin(a), -Math.cos(a)], yaw = Math.atan2(dir[0], -dir[1]) + (turn * Math.PI) / 180;
    const car = createCar(spec, { x: 0, z: 6 + (kmh / 3.6) * 2.5, yaw });
    car.crashDice = dice;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw), v = kmh / 3.6;
    car.vx = v * (dir[0] * fx + dir[1] * fz); car.vy = v * (dir[0] * rx + dir[1] * rz);
    const xs = [], zs = [], ys = [], roll = [];
    let crashed = false, most = 0;
    for (let t = 0, next = 0; t < 16; t += 1 / 60) {
      stepCar(car, t < 2.4 ? { up: 0.2 } : { up: 1, boost: t > 9 && t < 12, steer: 0.3 }, wall, 1 / 60);
      crashed ||= !!car.crash; most = Math.max(most, Math.abs(car.roll || 0));
      if (t >= next) { xs.push(car.x); zs.push(car.z); ys.push(car.y); roll.push(car.roll || 0); next += STEP; }
    }
    const j = judgeDrive(Float64Array.from(xs), Float64Array.from(zs), Float64Array.from(ys), lim, { roll: Float64Array.from(roll) });
    if (crashed) n++;
    if (most > 1.2) over++;
    assert.equal(j.why, '', `a crash at ${kmh} km/h, ${deg} degrees off, turned ${turn}, dice ${dice}: refused (${show(j)})`);
    assert.equal(j.air, 0);
  }
  assert.ok(n > 60 && over > 40, `${n} crashes, ${over} of them right over`);
  console.log(`ok  ${n} hard crashes into a wall, ${over} of them over onto a side or the roof: none is taken for a kickflip`);
}

// ---- the Rocket's drive under another car's name, and no other car judged by gas
{
  const d = drive(spec, [[25, { up: 1, boost: 1 }], [5, { down: 1 }]]);
  for (const said of ['f40', 'cgt', 'enyaq']) assert.ok(judgeDrive(d.xs, d.zs, d.ys, carLimits(CARS[said])).why, `the Rocket on BOOST driven as ${said} must be refused`);
  assert.equal(carLimits(CARS.f40).gas, undefined);
}
console.log('ok  the Rocket\'s drive under another car\'s name is refused');
