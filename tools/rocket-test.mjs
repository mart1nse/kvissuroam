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
  check('0-100 km/h with BOOST is about 0.6 s', b.t100 > 0.5 && b.t100 < 0.72, `${b.t100.toFixed(2)} s`);
  check('BOOST runs for 10 s, then the reload starts', Math.abs(b.t - TANK_S) < 0.05 && b.car.rocket.reload, `${b.t.toFixed(2)} s`);
  check('BOOST tops out near 400 km/h', b.top > 380 && b.top < 405, `${b.top.toFixed(0)} km/h`);
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
  if (expect === 'refused') {
    check(name, !plan && car.rocket.tank === tank0 && car.rocket.deny > 0, plan ? 'it jumped' : 'refused, no gas used');
    return null;
  }
  if (!plan) { check(name, false, 'refused'); return null; }
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
  check(name, pass, `${air.toFixed(2)} s in the air, ${len.toFixed(1)} m long, ${peak.toFixed(2)} m high, touchdown ${rel.toFixed(2)} m/s against the ground, speed ${(v0 * 3.6).toFixed(0)} to ${(vL * 3.6).toFixed(0)} km/h, lift ${(plan.vl / 6).toFixed(2)}x${verbose ? `, roll ${(rollMax * 180 / Math.PI).toFixed(0)} deg, lowest ${low.toFixed(2)} m, after: bounce ${bounce.toFixed(2)} m, air ${air2.toFixed(2)} s` : ''}`);
  return { plan, air, len, peak, car };
}

const level = flip('FLIP on level ground at 100 km/h');
// (the height is that of the car's floor: 2.6 m of flight plus the 0.84 m its floor swings up as it rolls about its middle)
check('...is about 1.8 s, 50 m and 3.4 m high at the top of the roll', level && Math.abs(level.air - 1.8) < 0.15 && Math.abs(level.len - 50) < 5 && Math.abs(level.peak - 3.4) < 0.4);
flip('FLIP at a standstill hops in place', { kmh: 0 });
flip('FLIP at 250 km/h', { kmh: 250 });
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
// ground higher than the arc: no jump
flip('a 5 m bank ahead: refused, no gas used', { h: (s) => (s < 20 ? 0 : s < 30 ? (s - 20) * 0.5 : 5), expect: 'refused' });
// a house across the way at 25 m: no jump (every arc passes through it)
flip('a house across the flight: refused', { extra: { sdfAt: (x, z) => Math.abs(-z - 25) - 3 }, expect: 'refused' });
// a house on the landing spot only (45 to 55 m): a shorter arc is found
const short = flip('a house on the landing spot: a shorter arc', { extra: { sdfAt: (x, z) => Math.abs(-z - 51.5) - 4 } });
check('...lands short of it', short && short.len < 46 && short.plan.vl < 6, short ? `${short.len.toFixed(1)} m` : '');
// a tree on the landing spot
const tree = flip('a tree on the landing spot: another arc', { extra: { trunksNear: (x, z, reach, out) => { out.length = 0; if (Math.hypot(x - 0.3, z + 50) < reach) out.push(0.3, -50, 0.3); return out; } } });
check('...lands clear of it', tree && Math.abs(tree.len - 50) > 2.5, tree ? `${tree.len.toFixed(1)} m` : '');
// a guard rail across the road in mid flight is flown over; one at the landing spot is not landed on
flip('a guard rail under the top of the arc is flown over', { extra: { solidsNear: (x, z, reach, out) => { out.length = 0; out.push({ x: 0, z: -25, yaw: 0, hx: 6, hz: 0.15 }); return out; } } });
const rail = flip('a guard rail on the landing spot: another arc', { extra: { solidsNear: (x, z, reach, out) => { out.length = 0; out.push({ x: 0, z: -50, yaw: 0, hx: 6, hz: 0.15 }); return out; } } });
check('...lands clear of it', rail && Math.abs(rail.len - 50) > 2.5, rail ? `${rail.len.toFixed(1)} m` : '');
// water where it would land
flip('water at the landing spot: another arc or none', { extra: { surfaceAt: (x, z) => (-z > 30 ? 4 : 1) }, expect: 'refused' });

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

process.exit(ok ? 0 : 1);
