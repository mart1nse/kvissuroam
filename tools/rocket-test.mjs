// Tesla Roadster Rocket check: the base car's figures, BOOST, the tank and its reload, and the kickflip jump
// on level ground, off a drop, onto a rise, standing still, in a drift, and with the landing spot blocked.
// Run: node tools/rocket-test.mjs   (add --v for every flight's figures)
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
import { TANK_S, JUMP_S, REFILL_S, refillTank, planFlip, flightPose, flightNozzles, NOZ } from '../src/cars/thrust.js';

const spec = CARS.rocket;
const verbose = process.argv.includes('--v');
const dt = 1 / 120;
// the car drives north (towards -z); h(s) is the ground s metres up the road
const world = (h = () => 0, extra = {}) => ({
  meta: { riverLevel: -100 },
  heightAt: (x, z) => h(-z, x),
  surfaceAt: () => 1,
  sdfAt: () => 100,
  sdfGrad: (x, z, o) => o,
  ...extra,
});
const fresh = (w, kmh = 0, y = 0) => { refillTank('rocket'); const c = createCar(spec, { x: 0, z: 0, yaw: 0, y }); c.vx = kmh / 3.6; return c; };
let ok = true;
const check = (name, pass, detail = '') => { ok &&= !!pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

// ---- the base car and BOOST
{
  const run = (input, until = 30) => {
    const w = world(), car = fresh(w);
    let t = 0, t100 = null, top = 0;
    while (t < until) { stepCar(car, input, w, dt); t += dt; const v = speedKmh(car); if (t100 === null && v >= 100) t100 = t; top = Math.max(top, v); if (input.boost && car.rocket.reload) break; }
    return { t100, top, car, t };
  };
  const base = run({ up: 1 }, 60);
  check('0-100 km/h on the motors is 1.6 s', Math.abs(base.t100 - 1.6) < 0.08, `${base.t100.toFixed(2)} s`);
  check('top speed on the motors is about 340 km/h', Math.abs(base.top - 340) < 8, `${base.top.toFixed(0)} km/h`);
  const b = run({ up: 1, boost: 1 });
  check('0-100 km/h with BOOST is about 0.5 s (Tesla: 0-60 mph in under 0.59 s)', b.t100 > 0.45 && b.t100 < 0.6, `${b.t100.toFixed(2)} s`);
  // (the tank blows down: the push follows the gas left, 80 kN on a full tank; 250 kg at 650 m/s is 163 kN s)
  check('BOOST blows a full tank down in under 6 s, then the reload starts', b.t > 5.4 && b.t < 6 && b.car.rocket.reload, `${b.t.toFixed(2)} s`);
  check('BOOST tops out near 370 km/h', b.top > 355 && b.top < 385, `${b.top.toFixed(0)} km/h`);
  {
    const wi = world(), ci = fresh(wi);
    let ti = 0, t300 = null, push = 0, first = 0;
    for (; !ci.rocket.reload && ti < 12; ti += dt) { stepCar(ci, { up: 1, boost: 1 }, wi, dt); push += ci.thrustN * dt; if (ti > 0.2 && !first) first = ci.thrustN; if (t300 === null && speedKmh(ci) >= 300) t300 = ti + dt; }
    check('...0-300 km/h in about 2.6 s', t300 > 2.3 && t300 < 2.9, `${t300.toFixed(2)} s`);
    check('...on no more push than 250 kg of gas holds (163 kN s)', push < 163000 && push > 140000 && first > 60000 && first < 80000, `${(push / 1000).toFixed(0)} kN s, ${(first / 1000).toFixed(0)} kN after 0.2 s`);
  }
  // BOOST alone (no throttle key): the motors are held at full power too
  const alone = run({ boost: 1 });
  check('BOOST alone drives the motors too', Math.abs(alone.t100 - b.t100) < 0.02, `${alone.t100.toFixed(2)} s`);
  // the reload: nothing works for 120 s, then a full tank
  const w = world(), car = b.car;
  let t = 0, moved = false;
  const v0 = car.vx;
  for (; car.rocket.reload && t < 200; t += dt) { stepCar(car, { boost: 1, flip: (t * 2) % 1 < 0.5 }, w, dt); if (t > 0.3 && car.rocket.reload && (car.rocket.flight || car.thrustN > 0)) moved = true; }   // (the valves take a moment to shut)
  check('the reload takes 120 s and locks both buttons', Math.abs(t - REFILL_S) < 0.5 && !moved && car.rocket.tank >= TANK_S - JUMP_S, `${t.toFixed(1)} s`);
  void v0;
  // offline testing (?off=100): the reload takes 2 s
  { const wq = world(), q = fresh(wq); q.rocket.tank = 0; q.rocket.reload = true; let tq = 0;
    for (; q.rocket.reload && tq < 10; tq += dt) stepCar(q, { quickRefill: true }, wq, dt);
    check('the quick reload of offline mode takes 2 s', Math.abs(tq - 2) < 0.05 && q.rocket.tank >= TANK_S, `${tq.toFixed(2)} s`); }
  check('...and the car weighs its full 1950 kg again', car.gasOut < 1, `${(spec.mass - car.gasOut).toFixed(0)} kg`);
  // the gas is weight: with the tank empty the car is 250 kg lighter and a little quicker on the motors
  const we = world(), e = fresh(we);
  e.rocket.tank = 0; e.rocket.reload = true;
  let te = 0, e100 = null;
  for (; te < 5 && e100 === null; te += dt) { stepCar(e, { up: 1 }, we, dt); if (speedKmh(e) >= 100) e100 = te + dt; }
  check('an empty tank: 250 kg lighter, 0-100 km/h quicker', Math.abs(e.gasOut - 250) < 6 && e100 < base.t100 - 0.03 && e100 > 1.3, `${(spec.mass - e.gasOut).toFixed(0)} kg, ${e100.toFixed(2)} s against ${base.t100.toFixed(2)} s`);
}

// ---- one FLIP: fly it and report
function flip(name, { h = () => 0, kmh = 100, extra = {}, side = 0, slide = 0, expect = 'lands', run = 60 } = {}) {
  const w = world(h, extra), car = fresh(w, kmh, h(0, 0));
  // settle on the springs at the entry speed first
  for (let t = 0; t < 0.5; t += dt) { stepCar(car, { up: 0 }, w, dt); car.vx = kmh / 3.6; car.x = 0; car.z = 0; car.lastGround = null; }
  if (slide) car.vy = slide;
  const tank0 = car.rocket.tank, v0 = Math.hypot(car.vx, car.vy);
  const in0 = { flip: 1, left: side < 0 ? 1 : 0, right: side > 0 ? 1 : 0 };
  stepCar(car, in0, w, dt);
  const plan = car.rocket.launched;
  if (!plan) { check(name, false, 'no jump'); return null; }
  if (expect === 'crash') {
    // it flies until something is in the way, is let go there, and ends up on the ground on its wheels
    let t = dt, peak = 0;
    while (car.rocket.flight && t < 20) { stepCar(car, {}, w, dt); t += dt; peak = Math.max(peak, car.y - h(-car.z, car.x)); }
    const at = -car.z, crashed = car.rocket.crashed, air = t;
    for (let u = 0; u < 4; u += dt) stepCar(car, {}, w, dt);
    const down = !car.airborne && Math.abs(car.y - h(-car.z, car.x)) < 0.3 && Math.abs(car.roll) < 0.5 && Number.isFinite(car.x + car.z + car.vx);
    check(name, crashed && down && car.rocket.tank === tank0 - JUMP_S, `${crashed ? 'let go' : 'not let go'} ${at.toFixed(1)} m on, ${air.toFixed(2)} s in, ${peak.toFixed(1)} m up; ${down ? 'on its wheels after' : 'not settled'}`);
    return { at, air, car };
  }
  let t = dt, peak = 0, rollMax = 0, low = Infinity, nozMax = 0;
  const s0 = -car.z;
  while (car.rocket.flight && t < 20) {
    stepCar(car, {}, w, dt); t += dt;
    const g = h(-car.z, car.x);
    peak = Math.max(peak, car.y - g); low = Math.min(low, car.y - g);
    for (let i = 0; i < NOZ; i++) nozMax = Math.max(nozMax, car.rocket.noz[i]);
    rollMax = Math.max(rollMax, Math.abs(car.roll));
  }
  // the moment of touchdown
  const len = -car.z - s0, gL = h(-car.z, car.x);
  const slopeRate = (h(-car.z + 0.05, car.x) - h(-car.z - 0.05, car.x)) / 0.1 * Math.hypot(car.vx, car.vy);
  const rel = car.vyUp - slopeRate;
  const vL = Math.hypot(car.vx, car.vy), yL = car.y;
  const air = t;
  // and the seconds after it: the car must settle without bouncing off or losing its speed
  let bounce = 0, air2 = 0;
  for (let u = 0; u < 1.5; u += dt) { stepCar(car, {}, w, dt); if (car.airborne) air2 += dt; bounce = Math.max(bounce, car.y - h(-car.z, car.x)); }
  // (one whole turn: just before touchdown the roll stands at a full circle, and it never goes past it)
  const full = rollMax > 2 * Math.PI * 0.97 && rollMax < 2 * Math.PI * 1.03;
  const pass = Math.abs(rel) < 0.5 && Math.abs(yL - gL) < 0.1 && full && Math.abs(vL - v0) < 0.05 * Math.max(v0, 1) + 0.05 && low > -0.06 && air2 < 0.1 && bounce < 0.12 && car.rocket.tank === tank0 - JUMP_S;
  check(name, pass, `${air.toFixed(2)} s in the air, ${len.toFixed(1)} m long, ${peak.toFixed(2)} m high, touchdown ${rel.toFixed(2)} m/s against the ground, speed ${(v0 * 3.6).toFixed(0)} to ${(vL * 3.6).toFixed(0)} km/h, lift ${(plan.vl / 10.6).toFixed(2)}x${verbose ? `, roll ${(rollMax * 180 / Math.PI).toFixed(0)} deg, lowest ${low.toFixed(2)} m, after: bounce ${bounce.toFixed(2)} m, air ${air2.toFixed(2)} s` : ''}`);
  return { plan, air, len, peak, car };
}

const level = flip('FLIP on level ground at 100 km/h');
// (the height is that of the car's floor: 2.6 m of flight plus the 0.84 m its floor swings up as it rolls about its middle)
// (Tesla's film: about 3 s in the air, the car's middle 8.7 m up; here the floor is 8.1 m up at the top of the arc
// and, upside down there, 8.95 m)
check('...is about 3.1 s, 85 m and 8.95 m high at the top of the roll', level && Math.abs(level.air - 3.1) < 0.15 && Math.abs(level.len - 85) < 5 && Math.abs(level.peak - 8.95) < 0.4);
flip('FLIP at a standstill hops in place', { kmh: 0 });
flip('FLIP at 250 km/h', { kmh: 250 });
const film = flip('FLIP at the 47 km/h of Tesla\'s film', { kmh: 47.2 });
check('...covers about 40 m', film && Math.abs(film.len - 40) < 3, film ? `${film.len.toFixed(1)} m` : '');
flip('FLIP rolling left', { side: -1 });
flip('FLIP in a slide flies along the slide', { kmh: 80, slide: 6 });
// a 4 m drop 20 to 40 m ahead: lands lower, later
const drop = flip('FLIP off a 4 m drop', { h: (s) => (s < 20 ? 0 : s < 40 ? -(s - 20) * 0.2 : -4) });
check('...flies longer than on the level', drop && level && drop.air > level.air + 0.2, drop ? `${drop.air.toFixed(2)} s` : '');
flip('FLIP off a 12 m drop', { h: (s) => (s < 15 ? 0 : s < 45 ? -(s - 15) * 0.4 : -12) });
// a 1.2 m rise: lands higher, sooner
const up = flip('FLIP onto a 1.2 m rise', { h: (s) => (s < 15 ? 0 : s < 27 ? (s - 15) * 0.1 : 1.2) });
check('...lands sooner than on the level', up && level && up.air < level.air - 0.1, up ? `${up.air.toFixed(2)} s` : '');
// downhill and uphill all the way: touches down at the slope's own angle
const downhill = flip('FLIP down an 8 % hill', { h: (s) => -0.08 * s });
check('...lands tilted to the slope', downhill && Math.abs(downhill.plan.pl - Math.atan(-0.08)) < 0.02, downhill ? `${(downhill.plan.pl * 180 / Math.PI).toFixed(1)} deg` : '');
flip('FLIP up an 8 % hill', { h: (s) => 0.08 * s });
flip('FLIP across a slope leaning 6 %', { h: (s, x) => 0.06 * x });
// ground higher than the roll leaves time for: flown into
const bank = flip('a 5 m bank ahead: lands on top of it', { h: (s) => (s < 20 ? 0 : s < 30 ? (s - 20) * 0.5 : 5) });
check('...sooner than on the level', bank && level && bank.air < level.air - 0.3, bank ? `${bank.air.toFixed(2)} s` : '');
flip('a 16 m bank ahead: flies into it', { h: (s) => (s < 20 ? 0 : s < 52 ? (s - 20) * 0.5 : 16), expect: 'crash' });
// what stands in the way is hit (Martin 2026-11-25: "allow to jump and crash")
const wall = flip('a house across the flight: hits it', { extra: { sdfAt: (x, z) => Math.abs(-z - 25) - 3 }, expect: 'crash' });
check('...at its wall, not past it', wall && wall.at < 22.5 && wall.at > 15, wall ? `${wall.at.toFixed(1)} m` : '');
// (where the world knows how high its houses stand: over a low one, into a tall one, and a wall with no house to it only low down)
const house = (at, half, top) => ({ sdfAt: (x, z) => Math.abs(-z - at) - half, roofAt: (x, z) => (top !== null && Math.abs(-z - at) < half + 1 ? top : -1e9) });
flip('a 5 m house under the top of the arc is flown over', { extra: house(42, 4, 5) });
flip('a 12 m house under the top of the arc: hits it', { extra: house(42, 4, 12), expect: 'crash' });
flip('a garden wall under the arc is flown over', { extra: house(42, 0.3, null) });
flip('a garden wall just after lift-off: hits it', { extra: house(7, 0.3, null), expect: 'crash' });
flip('a house on the landing spot: hits it', { extra: { sdfAt: (x, z) => Math.abs(-z - 84.7) - 4 }, expect: 'crash' });
const trunk = (at) => ({ trunksNear: (x, z, reach, out) => { out.length = 0; if (Math.hypot(x - 0.3, z + at) < reach) out.push(0.3, -at, 0.3); return out; } });
flip('a tree on the landing spot: hits it', { extra: trunk(84.7), expect: 'crash' });
flip('a tree under the top of the arc is flown over', { extra: trunk(42) });
flip('a guard rail under the top of the arc is flown over', { extra: { solidsNear: (x, z, reach, out) => { out.length = 0; out.push({ x: 0, z: -42, yaw: 0, hx: 6, hz: 0.15 }); return out; } } });

// ---- FLIP switched off (a race, a timed lap): nothing happens and no gas goes; BOOST works as ever
{
  const w = world(), car = fresh(w, 100);
  const tank0 = car.rocket.tank;
  stepCar(car, { flip: 1, flipOff: true }, w, dt);
  check('FLIP switched off: no jump, no gas used', !car.rocket.flight && car.rocket.tank === tank0);
  for (let t = 0; t < 1; t += dt) stepCar(car, { boost: 1, flipOff: true }, w, dt);
  check('...and BOOST still works', car.thrustN > 0 && car.rocket.tank < tank0 - 0.9, `${car.rocket.tank.toFixed(2)} s left`);
}

// ---- two flips, then nothing until the reload is over
{
  const w = world(), car = fresh(w, 60);
  let flips = 0, t = 0, held = false;
  for (; t < 12; t += dt) {
    const press = !car.rocket.flight && !held;
    stepCar(car, { flip: press ? 1 : 0 }, w, dt);
    held = press;
    if (car.rocket.launched) { flips++; car.rocket.launched = null; }
  }
  check('a full tank is two flips, then the reload', flips === 2 && car.rocket.reload, `${flips} flips`);
}

// ---- the plan alone gives the same flight (what the other players are sent)
{
  const w = world((s) => -0.05 * s), car = fresh(w, 120, 0);
  car.vx = 120 / 3.6;
  const plan = planFlip(car, w, 1), copy = JSON.parse(JSON.stringify(plan));
  const a = {}, b = {}, na = new Float32Array(NOZ), nb = new Float32Array(NOZ);
  let same = true, lit = 0;
  for (let t = 0; t <= plan.tl; t += 0.05) {
    flightPose(plan, t, a); flightPose(copy, t, b);
    flightNozzles(plan, t, na, spec); flightNozzles(copy, t, nb, spec);
    for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'roll']) same &&= a[k] === b[k];
    for (let i = 0; i < NOZ; i++) { same &&= na[i] === nb[i]; lit = Math.max(lit, na[i]); }
  }
  check('a plan sent as JSON flies the same flight', same && lit > 0.5, `${JSON.stringify(copy).length} bytes`);
}

// ---- the roll is not perfect: it goes past level, the side jets catch it and keep hunting to the ground
{
  const w = world(), car = fresh(w, 60, 0);
  car.vx = 60 / 3.6;
  const plan = planFlip(car, w, 1), a = {}, n = new Float32Array(NOZ);
  let rear = 0, over = 0, under = 0, was = 0, swaps = 0, side = 0, maxStep = 0, prev = 0;
  for (let t = 0; t <= plan.tl; t += 0.005) {
    const off = (flightPose(plan, t, a).roll - 2 * Math.PI) * 180 / Math.PI;   // degrees past one whole turn
    if (t > 0) maxStep = Math.max(maxStep, Math.abs(a.roll - prev)); prev = a.roll;
    if (t > 1.5) { over = Math.max(over, off); if (was > 0) under = Math.min(under, off); if (off > 0) was = 1; }
    flightNozzles(plan, t, n, spec);
    const d = (n[4] + n[6]) - (n[5] + n[7]), sd = Math.abs(d) > 0.05 ? Math.sign(d) : 0;
    if (t > 2 && sd && side && sd !== side) swaps++;
    if (sd) side = sd;
    rear = Math.max(rear, n[0], n[1], n[2], n[3]);
  }
  const end = (flightPose(plan, plan.tl, a).roll - 2 * Math.PI) * 180 / Math.PI;
  check('the roll goes past level and comes back under it', over > 8 && over < 18 && under < -2 && under > -10, `${over.toFixed(1)} deg over, ${(-under).toFixed(1)} deg back under`);
  check('...the side jets swap sides as they hunt for level', swaps >= 3, `${swaps} swaps after 2 s`);
  check('...it lands nearly level, never quite', Math.abs(end) > 0.1 && Math.abs(end) < 4, `${end.toFixed(2)} deg at touchdown`);
  check('...and the four tail jets stay shut for the whole flight', rear === 0);
  check('...and turns smoothly all the way', maxStep < 0.06, `${(maxStep * 180 / Math.PI).toFixed(2)} deg in 5 ms at most`);
}

// ---- the jets blow (and sound) for as long as BOOST is held, smaller as the tank blows down, never shut
{
  const w = world(), car = fresh(w);
  let low = 1, t = 0, start = 0;
  for (; !car.rocket.reload && t < 12; t += dt) { stepCar(car, { up: 1, boost: 1 }, w, dt); if (t > 0.5 && !car.rocket.reload) low = Math.min(low, car.rocket.noz[0]); if (t > 0.2 && !start) start = car.rocket.noz[0]; }
  check('BOOST held: the tail jets blow until the tank is down', start > 0.9 && low > 0.2 && low < 0.4, `${start.toFixed(2)} at the start, least ${low.toFixed(2)}, ${t.toFixed(1)} s`);
  const w2 = world(), c2 = fresh(w2);
  for (let k = 0; k < 60; k++) stepCar(c2, { up: 1, boost: 1 }, w2, dt);
  const held = c2.rocket.noz[0];
  for (let k = 0; k < 30; k++) stepCar(c2, { up: 1 }, w2, dt);
  check('...and shut when it is let go', held > 0.8 && c2.rocket.noz[0] < 0.01);
}

process.exit(ok ? 0 : 1);
