// Tesla Roadster Rocket check: the base car's figures, BOOST, the tank and its reload, and the kickflip jump
// on level ground, off a drop, onto a rise, standing still, in a drift, and with the landing spot blocked.
// Run: node tools/rocket-test.mjs   (add --v for every flight's figures)
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
import { TANK_S, JUMP_S, REFILL_S, BOOST_MIN, refillTank, planFlip, flightPose, flightNozzles, NOZ } from '../src/cars/thrust.js';
import { createSmoke } from '../src/smoke.js';

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
    while (t < until) { stepCar(car, input, w, dt); t += dt; const v = speedKmh(car); if (t100 === null && v >= 100) t100 = t; top = Math.max(top, v); if (input.boost && car.rocket.dry) break; }
    return { t100, top, car, t };
  };
  const base = run({ up: 1 }, 60);
  check('0-100 km/h on the motors is 1.6 s', Math.abs(base.t100 - 1.6) < 0.08, `${base.t100.toFixed(2)} s`);
  check('top speed on the motors is about 340 km/h', Math.abs(base.top - 340) < 8, `${base.top.toFixed(0)} km/h`);
  const b = run({ up: 1, boost: 1 });
  check('0-100 km/h with BOOST is under 0.6 s (Tesla: 0-60 mph in under 0.59 s)', b.t100 > 0.5 && b.t100 < 0.6, `${b.t100.toFixed(2)} s`);
  // (the tank blows down: the push follows the gas left, 80 kN on a full tank; 250 kg at 650 m/s is 163 kN s)
  check('BOOST blows a full tank down in under 6 s, then its valves shut', b.t > 5.4 && b.t < 6 && b.car.rocket.dry && !b.car.rocket.on, `${b.t.toFixed(2)} s`);
  check('BOOST tops out near 355 km/h', b.top > 345 && b.top < 370, `${b.top.toFixed(0)} km/h`);
  {
    const wi = world(), ci = fresh(wi);
    let ti = 0, t300 = null, push = 0, first = 0;
    for (; !ci.rocket.dry && ti < 12; ti += dt) { stepCar(ci, { up: 1, boost: 1 }, wi, dt); push += ci.thrustN * dt; if (ti > 0.2 && !first) first = ci.thrustN; if (t300 === null && speedKmh(ci) >= 300) t300 = ti + dt; }
    check('...0-300 km/h in about 2.8 s', t300 > 2.5 && t300 < 3.1, `${t300.toFixed(2)} s`);
    check('...on no more push than 250 kg of gas holds (163 kN s)', push < 163000 && push > 140000 && first > 60000 && first < 80000, `${(push / 1000).toFixed(0)} kN s, ${(first / 1000).toFixed(0)} kN after 0.2 s`);
  }
  // BOOST alone (no throttle key): the motors are held at full power too
  const alone = run({ boost: 1 });
  check('BOOST alone drives the motors too', Math.abs(alone.t100 - b.t100) < 0.02, `${alone.t100.toFixed(2)} s`);
  // the tank fills by itself whenever it is not full (Martin 26 Nov), a whole tank in 60 s (was 120), and nothing is locked:
  // with the button still held after running dry nothing blows, and it fills all the same
  const w = world(), car = b.car;
  let t = 0, moved = false;
  const dry0 = car.rocket.tank;
  for (; t < 15; t += dt) { stepCar(car, { boost: 1 }, w, dt); if (t > 0.3 && car.thrustN > 0) moved = true; }   // (the valves take a moment to shut)
  check('run dry with BOOST still held: nothing blows, and the tank fills', !moved && Math.abs(car.rocket.tank - dry0 - (15 * TANK_S) / REFILL_S) < 0.05, `${dry0.toFixed(2)} to ${car.rocket.tank.toFixed(2)} s of tank in 15 s`);
  // let go and pressed again: BOOST blows on what there is
  stepCar(car, {}, w, dt);
  for (let k = 0; k < 20; k++) stepCar(car, { boost: 1 }, w, dt);
  check('...let go and pressed again, BOOST blows on what there is', car.thrustN > 5000 && car.rocket.on, `${(car.thrustN / 1000).toFixed(0)} kN`);
  {
    // left alone it fills to the top at a whole tank in 60 s (the cars of this file share the one tank, so this car first)
    const from = car.rocket.tank; let tf = 0;
    for (; car.rocket.tank < TANK_S && tf < 200; tf += dt) stepCar(car, {}, w, dt);
    stepCar(car, {}, w, dt);
    check('...and left alone the tank fills to the top, a whole one in 60 s', Math.abs(tf - ((TANK_S - from) / TANK_S) * REFILL_S) < 0.5, `${from.toFixed(2)} s of tank to full in ${tf.toFixed(1)} s`);
    check('...and the car weighs its full 2200 kg again', spec.mass === 2200 && car.gasOut < 1, `${(spec.mass - car.gasOut).toFixed(0)} kg`);
  }
  {
    // a little used: the filling starts at once, and stops for as long as BOOST blows
    const wp = world(), q = fresh(wp);
    for (let k = 0; k < 120; k++) stepCar(q, { up: 1, boost: 1 }, wp, dt);
    const used = q.rocket.tank; let tf = 0;
    for (let k = 0; k < 720; k++) stepCar(q, {}, wp, dt);
    const after6 = q.rocket.tank;
    for (; q.rocket.tank < TANK_S && tf < 200; tf += dt) stepCar(q, {}, wp, dt);
    check('a tank a little used starts filling at once', used < TANK_S - 3 && Math.abs(after6 - used - (6 * TANK_S) / REFILL_S) < 0.02 && Math.abs(tf + 6 - ((TANK_S - used) / TANK_S) * REFILL_S) < 0.5, `${used.toFixed(2)} s left after 1 s of BOOST, ${after6.toFixed(2)} s six seconds on, full ${(tf + 6).toFixed(0)} s after letting go`);
    // from empty: 60 s to full; FLIP works with half a tank in it and not before, BOOST with a tenth
    const we0 = world(), z = fresh(we0); z.rocket.tank = 0;
    let tz = 0, boostAt = null, flipAt = null, early = false;
    for (; z.rocket.tank < TANK_S && tz < 200; tz += dt) {
      if (flipAt === null) {
        // (a tap of each button every half second)
        const tap = Math.round(tz / dt) % 30 === 0;
        stepCar(z, { flip: tap ? 1 : 0, boost: boostAt === null && tap ? 1 : 0 }, we0, dt);
        if (boostAt === null && z.rocket.on) { boostAt = tz; if (z.rocket.tank < BOOST_MIN * TANK_S - 0.01) early = true; }
        if (z.rocket.launched) { flipAt = tz; if (z.rocket.tank < -1e-6) early = true; break; }
      }
    }
    check('from empty: BOOST works with a tenth of a tank in it (6 s), FLIP with half (half a minute)', boostAt > 5.5 && boostAt < 7 && flipAt > 29 && flipAt < 33 && !early, `BOOST after ${boostAt === null ? '-' : boostAt.toFixed(1)} s, FLIP after ${flipAt === null ? '-' : flipAt.toFixed(1)} s`);
    const wf = world(), ff = fresh(wf); ff.rocket.tank = 0; let tfull = 0;
    for (; ff.rocket.tank < TANK_S && tfull < 200; tfull += dt) stepCar(ff, {}, wf, dt);
    check('...and an empty tank is full again in a minute', Math.abs(tfull - REFILL_S) < 0.5, `${tfull.toFixed(1)} s`);
  }
  // offline testing (?off=100): the filling takes 2 s
  { const wq = world(), q = fresh(wq); q.rocket.tank = 0; let tq = 0;
    for (; q.rocket.tank < TANK_S && tq < 10; tq += dt) stepCar(q, { quickRefill: true }, wq, dt);
    check('the quick filling of offline mode takes 2 s', Math.abs(tq - 2) < 0.05 && q.rocket.tank >= TANK_S, `${tq.toFixed(2)} s`); }
  // the gas is weight: with the tank empty the car is 250 kg lighter and a little quicker on the motors (the tank
  // takes in about 6 kg during the run, filling at a whole one a minute)
  const we = world(), e = fresh(we);
  e.rocket.tank = 0;
  let te = 0, e100 = null;
  for (; te < 5 && e100 === null; te += dt) { stepCar(e, { up: 1 }, we, dt); if (speedKmh(e) >= 100) e100 = te + dt; }
  check('an empty tank: 250 kg lighter, 0-100 km/h quicker', Math.abs(e.gasOut - 250) < 9 && e100 < base.t100 - 0.03 && e100 > 1.3, `${(spec.mass - e.gasOut).toFixed(0)} kg, ${e100.toFixed(2)} s against ${base.t100.toFixed(2)} s`);
}

// ---- the suction fans can be switched off (car.fanOff, the fan icon): the tyres carry the weight alone
{
  const go = (fanOff) => { const w = world(), c = fresh(w); c.fanOff = fanOff; let t = 0; while (speedKmh(c) < 100 && t < 10) { stepCar(c, { up: 1 }, w, dt); t += dt; } return t; };
  const stop = (fanOff) => { const w = world(), c = fresh(w, 100); c.fanOff = fanOff; for (let t = 0; t < 0.5; t += dt) { stepCar(c, {}, w, dt); c.vx = 100 / 3.6; } const z0 = c.z; let t = 0; while (c.vx > 0.3 && t < 10) { stepCar(c, { down: 1 }, w, dt); t += dt; } return Math.abs(c.z - z0); };
  const g1 = go(false), g0 = go(true), s1 = stop(false), s0 = stop(true);
  check('fans off: 0-100 km/h takes about 2.5 s, not 1.6', Math.abs(g1 - 1.6) < 0.08 && g0 > 2.3 && g0 < 2.75, `${g1.toFixed(2)} s on, ${g0.toFixed(2)} s off`);
  check('...and stopping from 100 km/h about 36 m, not 21', s1 > 18 && s1 < 24 && s0 > 32 && s0 < 40, `${s1.toFixed(1)} m on, ${s0.toFixed(1)} m off`);
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
    const at = -car.z, crashed = car.rocket.crashed, air = t, tankL = car.rocket.tank;
    for (let u = 0; u < 4; u += dt) stepCar(car, {}, w, dt);
    const down = !car.airborne && Math.abs(car.y - h(-car.z, car.x)) < 0.3 && Math.abs(car.roll) < 0.5 && Number.isFinite(car.x + car.z + car.vx);
    check(name, crashed && down && tankL === tank0 - JUMP_S, `${crashed ? 'let go' : 'not let go'} ${at.toFixed(1)} m on, ${air.toFixed(2)} s in, ${peak.toFixed(1)} m up; ${down ? 'on its wheels after' : 'not settled'}`);
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
  const air = t, tankL = car.rocket.tank;   // (a jump is half a tank, and nothing fills in the air)
  // and the seconds after it: the car must settle without bouncing off or losing its speed
  let bounce = 0, air2 = 0;
  for (let u = 0; u < 1.5; u += dt) { stepCar(car, {}, w, dt); if (car.airborne) air2 += dt; bounce = Math.max(bounce, car.y - h(-car.z, car.x)); }
  // (one whole turn: just before touchdown the roll stands at a full circle, and it never goes past it)
  // (and a little: the 10 to 16 degrees it overshoots by, and its trembling)
  const full = rollMax > 2 * Math.PI * 0.97 && rollMax < 2 * Math.PI * 1.06;
  const pass = Math.abs(rel) < 0.5 && Math.abs(yL - gL) < 0.1 && full && Math.abs(vL - v0) < 0.05 * Math.max(v0, 1) + 0.05 && low > -0.06 && air2 < 0.1 && bounce < 0.12 && tankL === tank0 - JUMP_S;
  check(name, pass, `${air.toFixed(2)} s in the air, ${len.toFixed(1)} m long, ${peak.toFixed(2)} m high, touchdown ${rel.toFixed(2)} m/s against the ground, speed ${(v0 * 3.6).toFixed(0)} to ${(vL * 3.6).toFixed(0)} km/h, lift ${(plan.vl / 10.3).toFixed(2)}x${verbose ? `, roll ${(rollMax * 180 / Math.PI).toFixed(0)} deg, lowest ${low.toFixed(2)} m, after: bounce ${bounce.toFixed(2)} m, air ${air2.toFixed(2)} s` : ''}`);
  return { plan, air, len, peak, car };
}

const level = flip('FLIP on level ground at 100 km/h');
// (the height is that of the car's floor: 2.6 m of flight plus the 0.84 m its floor swings up as it rolls about its middle)
// (Tesla's film: about 3 s in the air, the car's middle 8.7 m up; here the floor is 8.1 m up at the top of the arc
// and, upside down there, 8.95 m)
// (3.1 s and 85 m until 26 Nov, when the last 3 m were made slow: a second more in the air)
check('...is about 4.2 s, 116 m and 8.95 m high at the top of the roll', level && Math.abs(level.air - 4.2) < 0.15 && Math.abs(level.len - 116) < 5 && Math.abs(level.peak - 8.95) < 0.4, level ? `${level.air.toFixed(2)} s, ${level.len.toFixed(0)} m, ${level.peak.toFixed(2)} m` : '');
// ---- the lift-off push and the way down (Martin 26 Nov): a slightly gentler, steady push with all four corner jets
// as one; a quiet moment before the roll; the last 3 m slow and the last metre slower still
{
  const w = world(), car = fresh(w, 100);
  const plan = planFlip(car, w, 1), a = {}, n = new Float32Array(NOZ), l = new Float32Array(4), S = 0.005;
  let gMax = 0, prevV = 0, spread = 0, lo = 9, hi = 0, leanMax = 0, coast = 0, coastN = 0, t3 = null, t1 = null, v3 = 0, v1 = 0, rising = true, prevY = 0, fastLow = 0, endLo = 9, endApart = 0, endNose = 0, downLo = 9;
  for (let k = 0; k * S <= plan.tl; k++) {
    const t = k * S;
    flightPose(plan, t, a); flightNozzles(plan, t, n, spec, l);
    if (k && t < 0.6) gMax = Math.max(gMax, (a.vy - prevV) / S / 9.81);
    prevV = a.vy;
    if (t > 0.18 && t < 0.5) { const c = [n[4], n[5], n[6], n[7]]; spread = Math.max(spread, Math.max(...c) - Math.min(...c)); lo = Math.min(lo, ...c); hi = Math.max(hi, ...c); for (let i = 0; i < 4; i++) leanMax = Math.max(leanMax, Math.abs(Math.abs(l[i]) - 0.2)); }
    if (t > 0.58 && t < 0.66) { coast += n[4] + n[5] + n[6] + n[7] + n[8] + n[9]; coastN++; }
    if (k && a.y < prevY) rising = false;
    if (!rising) { if (t3 === null && a.y <= 3) { t3 = t; v3 = -a.vy; } if (t1 === null && a.y <= 1) { t1 = t; v1 = -a.vy; } if (a.y < 3 && t > plan.tb) fastLow = Math.max(fastLow, -a.vy); }
    // (the last metre, from a moment in; and the whole way down from the landing burn on)
    if (t1 !== null && t > t1 + 0.1 && t < plan.tl - 0.02) { const c = [n[4], n[5], n[6], n[7]]; endLo = Math.min(endLo, ...c); endApart = Math.max(endApart, Math.max(...c) - Math.min(...c)); endNose = Math.max(endNose, n[8], n[9]); }
    if (t > plan.tb + 0.3 && t < plan.tl - 0.02) downLo = Math.min(downLo, n[4], n[5], n[6], n[7]);
    prevY = a.y;
  }
  check('the lift-off push is a little gentler (2 g, was 2.4) and lasts 0.52 s', gMax > 1.85 && gMax < 2.15, `${gMax.toFixed(2)} g at the most`);
  check('...with the four corner jets blowing as one, steadily, straight down', spread < 0.02 && hi - lo < 0.04 && lo > 0.8 && leanMax < 0.05, `${lo.toFixed(2)} to ${hi.toFixed(2)}, ${spread.toFixed(3)} apart at the most, lean ${leanMax.toFixed(3)} rad off its rest`);
  check('...and a quiet moment before the roll starts', coast / coastN < 0.25, `${(coast / coastN).toFixed(2)} of one jet blowing, on average`);
  check('the last 3 m down take about 1.5 s (0.5 s before), the last metre about 0.9 s', plan.tl - t3 > 1.3 && plan.tl - t3 < 1.8 && plan.tl - t1 > 0.75 && plan.tl - t1 < 1.1 && t1 - t3 < plan.tl - t1, `${(plan.tl - t3).toFixed(2)} s and ${(plan.tl - t1).toFixed(2)} s`);
  check('the way down ends in one big burn: all four corner jets hard and as one over the last metre, no small bursts', endLo > 0.82 && endApart < 0.12 && endNose < 0.15 && downLo > 0.45, `at least ${endLo.toFixed(2)}, ${endApart.toFixed(2)} apart at the most, the nose jets ${endNose.toFixed(2)}; never under ${downLo.toFixed(2)} from the landing burn on`);
  check('...at 4.5 m/s through 3 m and 1.9 m/s through 1 m, never faster below', Math.abs(v3 - 4.5) < 0.5 && Math.abs(v1 - 1.9) < 0.3 && fastLow < v3 + 0.05, `${v3.toFixed(2)} and ${v1.toFixed(2)} m/s`);
}
flip('FLIP at a standstill hops in place', { kmh: 0 });
flip('FLIP at 250 km/h', { kmh: 250 });
const film = flip('FLIP at the 47 km/h of Tesla\'s film', { kmh: 47.2 });
// (the film's 40 m, and the second more of being let down slowly)
check('...covers about 55 m', film && Math.abs(film.len - 55) < 3, film ? `${film.len.toFixed(1)} m` : '');
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

// ---- two flips, then none until half a tank is back
{
  const w = world(), car = fresh(w, 60);
  let flips = 0, t = 0, held = false;
  for (; t < 12; t += dt) {
    const press = !car.rocket.flight && !held;
    stepCar(car, { flip: press ? 1 : 0 }, w, dt);
    held = press;
    if (car.rocket.launched) { flips++; car.rocket.launched = null; }
  }
  check('a full tank is two flips, then none until half a tank is back', flips === 2 && car.rocket.tank < JUMP_S, `${flips} flips in 12 s, ${car.rocket.tank.toFixed(2)} s of tank`);
}

// ---- the plan alone gives the same flight (what the other players are sent)
{
  const w = world((s) => -0.05 * s), car = fresh(w, 120, 0);
  car.vx = 120 / 3.6;
  const plan = planFlip(car, w, 1), copy = JSON.parse(JSON.stringify(plan));
  const a = {}, b = {}, na = new Float32Array(NOZ), nb = new Float32Array(NOZ), la = new Float32Array(4), lb = new Float32Array(4);
  let same = true, lit = 0;
  for (let t = 0; t <= plan.tl; t += 0.05) {
    flightPose(plan, t, a); flightPose(copy, t, b);
    flightNozzles(plan, t, na, spec, la); flightNozzles(copy, t, nb, spec, lb);
    for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'roll']) same &&= a[k] === b[k];
    for (let i = 0; i < 4; i++) same &&= la[i] === lb[i];
    for (let i = 0; i < NOZ; i++) { same &&= na[i] === nb[i]; lit = Math.max(lit, na[i]); }
  }
  check('a plan sent as JSON flies the same flight', same && lit > 0.5, `${JSON.stringify(copy).length} bytes`);
}

// ---- nothing in a flight is in balance (Martin 25 Nov, from the stills of Tesla's film): the tail kicks up first,
// the roll goes past level and is hunted for in several unequal swings, the nose nods, and the jets fire in short
// and long bursts on the side the body is being pushed back from. Flights from different spots differ, so several
// are flown.
{
  const D = 180 / Math.PI, STEP = 0.005;
  const spots = [[0, 0], [12.34, -56.7], [-340.2, 88.1], [5.5, 5.5], [1000.01, 2000.02], [77.7, -3.2], [-15.5, 410.9], [3.21, 9.87]];
  const bad = { over: [], swings: [], uneven: 0, swaps: [], end: [], step: [], rear: 0, tail: [], dip: [], order: [], nod: [], nose: [], sync: [], bursts: [], fan: [], yaw: [], pause: [], steady: [], sliver: [] };
  let endSum = 0, shortSum = 0; const pausedAt = [];
  for (const [x, z] of spots) {
    const w = world(), car = fresh(w, 60, 0);
    car.x = x; car.z = z; car.vx = 60 / 3.6;
    const plan = planFlip(car, w, 1), a = {}, n = new Float32Array(NOZ), l = new Float32Array(4), at = `${x},${z}`;
    const tE = 0.65 + Math.min(1.7, plan.tb - 0.65);
    let over = 0, under = 0, swaps = 0, side = 0, maxStep = 0, prev = 0, sgn = 0, t0 = tE, tailUp = 0, dip = 0, orderOk = false;
    let pMin = 9, pMax = -9, burnUp = -9, fanMax = 0, fanBad = false, yawMax = 0, agree = 0, judged = 0;
    const halves = [], rolls = [], ds = [], runs = [[], [], [], []], since = [-1, -1, -1, -1];
    const openT = [-1, -1, -1, -1]; let briefest = 9, quietT = -1, quietDeg = 0, pauses = 0, allT = -1, steady = 0, firstPause = -1, slowest = 1e9;
    for (let k = 0; k * STEP <= plan.tl; k++) {
      const t = k * STEP;
      flightPose(plan, t, a); flightNozzles(plan, t, n, spec, l);
      const off = (a.roll - 2 * Math.PI) * D;                              // degrees past one whole turn
      if (k) maxStep = Math.max(maxStep, Math.abs(a.roll - prev)); prev = a.roll;
      if (t >= tE) {
        over = Math.max(over, off); under = Math.min(under, off);
        const sg = Math.sign(off);
        if (sg && sgn && sg !== sgn) { halves.push(t - t0); t0 = t; }
        if (sg) sgn = sg;
      }
      const d = (n[4] + n[6]) - (n[5] + n[7]), sd = Math.abs(d) > 0.05 ? Math.sign(d) : 0;
      if (t > 2 && sd && side && sd !== side) swaps++;
      if (sd) side = sd;
      rolls.push(a.roll); ds.push(d);
      bad.rear = Math.max(bad.rear, n[0], n[1], n[2], n[3]);
      // lift-off: the axles' heights (the car drives towards -z, level ground)
      const half = spec.wheelbase / 2, yF = a.y + Math.sin(a.pitch) * half, yR = a.y - Math.sin(a.pitch) * half;
      if (t < 0.5) { tailUp = Math.max(tailUp, yR - yF); dip = Math.min(dip, yF); }
      if (Math.abs(t - 0.03) < STEP / 2) orderOk = n[6] > 0.5 && n[7] > 0.5 && n[4] < 0.1 && n[5] < 0.1;
      if (t > 0.7 && t < plan.tb) { pMin = Math.min(pMin, a.pitch * D); pMax = Math.max(pMax, a.pitch * D); }
      if (t > plan.tb) burnUp = Math.max(burnUp, a.pitch * D);
      yawMax = Math.max(yawMax, Math.abs(a.yaw) * D);
      for (let i = 0; i < 4; i++) {
        const lit = n[4 + i] > 0.15, free = t > 0.5 && t < plan.tb;
        if (lit && free && since[i] < 0) since[i] = t;
        if ((!lit || !free) && since[i] >= 0) { runs[i].push(t - since[i]); since[i] = -1; }
        // (an opening from shut to shut, whatever its strength)
        if (n[4 + i] > 0.02 && openT[i] < 0) openT[i] = t;
        if (n[4 + i] <= 0.02 && openT[i] >= 0) { briefest = Math.min(briefest, t - openT[i]); openT[i] = -1; }
        if (n[4 + i] > 0.15) { fanMax = Math.max(fanMax, Math.abs(l[i])); if (Math.sign(l[i]) !== (i % 2 ? 1 : -1) || Math.abs(l[i]) > 1.5) fanBad = true; }
      }
      // a pause: every valve shut for a moment while the car is well into its turn (and still turning: degrees a second)
      const deg = a.roll * D, turning = deg > 20 && deg < 340, quiet = turning && Math.max(n[4], n[5], n[6], n[7], n[8], n[9]) < 0.05;
      if (quiet && quietT < 0) { quietT = t; quietDeg = deg; }
      if (quiet && k) slowest = Math.min(slowest, (a.roll - rolls[k - 1]) * D / STEP);
      if (!quiet && quietT >= 0) { if (t - quietT >= 0.08) { pauses++; if (firstPause < 0) firstPause = quietDeg; } quietT = -1; }
      // a long steady burn: all four corners blowing together in free flight
      const all4 = t > 0.5 && t < plan.tb && Math.min(n[4], n[5], n[6], n[7]) > 0.25;
      if (all4 && allT < 0) allT = t;
      if (!all4 && allT >= 0) { steady = Math.max(steady, t - allT); allT = -1; }
    }
    // the body and the jets go together: where a side's pair clearly blows harder, the roll is being pushed that way
    for (let k = 4; k < rolls.length - 4; k++) {
      const acc = (rolls[k + 4] - 2 * rolls[k] + rolls[k - 4]) / (16 * STEP * STEP);
      if (Math.abs(ds[k]) < 0.3 || Math.abs(acc) < 4) continue;
      judged++; if (Math.sign(acc) === Math.sign(ds[k])) agree++;
    }
    const end = (flightPose(plan, plan.tl, a).roll - 2 * Math.PI) * D, endP = (a.pitch - plan.pl) * D;
    const all = runs.flat(), short = all.filter((v) => v < 0.12).length, long = all.filter((v) => v > 0.25).length;
    endSum += Math.abs(end); shortSum += short; if (firstPause >= 0) pausedAt.push(firstPause);
    const fmt = (v, dec = 1) => `${at}: ${typeof v === 'number' ? v.toFixed(dec) : v}`;
    if (!(over > 8 && over < 20 && under < -2 && under > -10)) bad.over.push(fmt(`${over.toFixed(1)} over, ${(-under).toFixed(1)} under`));
    if (halves.length < 2) bad.swings.push(fmt(halves.length, 0));
    if (halves.length >= 2 && Math.max(...halves) > 1.25 * Math.min(...halves)) bad.uneven++;
    if (swaps < 3) bad.swaps.push(fmt(swaps, 0));
    if (!(Math.abs(end) < 4 && Math.abs(endP) < 1)) bad.end.push(fmt(`roll ${end.toFixed(2)}, nose ${endP.toFixed(2)}`));
    if (maxStep >= 0.06) bad.step.push(fmt(maxStep * D, 2));
    if (!(tailUp > 0.1 && tailUp < 0.25)) bad.tail.push(fmt(tailUp, 3));
    if (dip < -0.005) bad.dip.push(fmt(dip, 3));
    if (!orderOk) bad.order.push(at);
    if (!(pMax - pMin > 1 && pMax - pMin < 6)) bad.nod.push(fmt(pMax - pMin, 2));
    if (!(burnUp > 0.8 && burnUp < 4.5)) bad.nose.push(fmt(burnUp, 2));
    if (!(judged > 60 && agree / judged > 0.9)) bad.sync.push(fmt(`${agree} of ${judged}`));
    if (!(short >= 1 && long >= 2)) bad.bursts.push(fmt(`${short} short, ${long} long of ${all.length}`));
    if (!(pauses >= 1 && pauses <= 3 && slowest > 60)) bad.pause.push(fmt(`${pauses} pauses, turning at ${slowest.toFixed(0)} deg/s at the least`));
    if (!(steady > 0.22)) bad.steady.push(fmt(steady, 2));
    if (briefest < 0.035) bad.sliver.push(fmt(briefest, 3));
    if (!(fanMax > 0.8) || fanBad) bad.fan.push(fmt(fanMax * D, 0));
    if (!(yawMax > 0.3 && yawMax < 2.5)) bad.yaw.push(fmt(yawMax, 2));
    if (verbose) console.log(`     ${at}: over ${over.toFixed(1)}, under ${(-under).toFixed(1)}, swings ${halves.map((v) => v.toFixed(2)).join(' ')} s, end ${end.toFixed(2)} / nose ${endP.toFixed(2)} deg, tail first by ${tailUp.toFixed(2)} m, nod ${(pMax - pMin).toFixed(1)} deg, burn nose-up ${burnUp.toFixed(1)} deg, jets with the body ${agree}/${judged}, bursts ${short} short ${long} long of ${all.length}, ${pauses} pauses (first at ${firstPause.toFixed(0)} deg), steady burn ${steady.toFixed(2)} s, fan ${(fanMax * D).toFixed(0)} deg, yaw ${yawMax.toFixed(1)} deg`);
  }
  const none = (list) => list.length === 0, say = (list) => list.join('; ');
  check('at lift-off the tail leaves the ground first (10 to 25 cm ahead of the nose)', none(bad.tail), say(bad.tail));
  check('...its jets open before the front pair\'s', none(bad.order), say(bad.order));
  check('...and the nose wheels never go under the road', none(bad.dip), say(bad.dip));
  check('the roll goes past level and comes back under it', none(bad.over), say(bad.over));
  check('...in at least three swings, in most flights of unequal length', none(bad.swings) && bad.uneven >= spots.length - 2, `${say(bad.swings)} ${bad.uneven} of ${spots.length} uneven`);
  check('...the side jets swap sides as they hunt for level', none(bad.swaps), say(bad.swaps));
  check('...it lands nearly level, never quite', none(bad.end) && endSum / spots.length > 0.3, `${say(bad.end)} ${(endSum / spots.length).toFixed(2)} deg off at touchdown on average`);
  check('...and turns smoothly all the way', none(bad.step), say(bad.step));
  check('the nose nods all the way (1 to 6 degrees in free flight) and is held up in the landing burn', none(bad.nod) && none(bad.nose), say([...bad.nod, ...bad.nose]));
  check('...and swings a little from side to side', none(bad.yaw), say(bad.yaw));
  check('the jets push the way the body is being turned (9 times in 10 where both are clear)', none(bad.sync), say(bad.sync));
  check('...in short bursts and long ones', none(bad.bursts), say(bad.bursts));
  // (Martin 25 Nov, on seeing it fly: fewer of the smallest bursts, a few longer ones, a pause here or there in the turn)
  check('...the short ones fewer than they were (10.8 a flight before, now 3 to 8), and none a mere flicker', shortSum / spots.length >= 3 && shortSum / spots.length <= 8 && none(bad.sliver), `${(shortSum / spots.length).toFixed(1)} a flight ${say(bad.sliver)}`);
  check('...with a long steady burn of all four corners in every flight', none(bad.steady), say(bad.steady));
  check('...and a pause or two in the turn with every valve shut, the car turning on', none(bad.pause), say(bad.pause));
  check('...at a different place of the turn in each flight', pausedAt.length === spots.length && Math.max(...pausedAt) - Math.min(...pausedAt) > 120 && new Set(pausedAt.map((v) => Math.round(v / 10))).size >= 5, pausedAt.map((v) => v.toFixed(0)).join(', ') + ' deg');
  check('...fanned out: each corner jet leans to its own side, at times far out', none(bad.fan), say(bad.fan));
  check('...and the four tail jets stay shut for the whole flight', bad.rear === 0);
}

// ---- the jets blow (and sound) for as long as BOOST is held, smaller as the tank blows down, never shut
{
  const w = world(), car = fresh(w);
  let low = 1, t = 0, start = 0;
  for (; !car.rocket.dry && t < 12; t += dt) { stepCar(car, { up: 1, boost: 1 }, w, dt); if (t > 0.5 && car.rocket.on) low = Math.min(low, car.rocket.noz[0]); if (t > 0.2 && !start) start = car.rocket.noz[0]; }
  check('BOOST held: the tail jets blow until the tank is down', start > 0.9 && low > 0.2 && low < 0.4, `${start.toFixed(2)} at the start, least ${low.toFixed(2)}, ${t.toFixed(1)} s`);
  const w2 = world(), c2 = fresh(w2);
  for (let k = 0; k < 60; k++) stepCar(c2, { up: 1, boost: 1 }, w2, dt);
  const held = c2.rocket.noz[0];
  for (let k = 0; k < 30; k++) stepCar(c2, { up: 1 }, w2, dt);
  check('...and shut when it is let go', held > 0.8 && c2.rocket.noz[0] < 0.01);
}

// ---- puffs (src/smoke.js): the fans raise dust on loose ground only, and the Rocket's additions leave every
// other car's tyre smoke as it was (25 Nov: the mist's line had come between the tyre smoke and its `else`, and
// no car but the Rocket smoked its own tyres for half a day)
{
  const sw = { groundAt: () => 0, surfaceAt: () => 1 };
  // puffs alive after `secs` of a car standing (or driving at kmh) on a ground, pedal up or down
  const puffs = (sp, over, secs = 2) => {
    const sm = createSmoke(sw), car = { spec: sp, x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, throttle: 0, surface: 1, a: sp.wheelbase * sp.cgFront, b: sp.wheelbase * (1 - sp.cgFront), ...over };
    if (sp.thrusters) car.rocket = { noz: new Float32Array(NOZ) };
    let most = 0;
    for (let t = 0; t < secs; t += 1 / 60) { sm.update(car, 1 / 60, true, []); most = Math.max(most, sm.count); }
    return most;
  };
  const m3 = CARS.m3 || Object.values(CARS).find((c) => !c.thrusters && !c.dpfSmoke);
  const burn = puffs(m3, { rubR: 13, slipVR: 6 }, 3), rocketBurn = puffs(spec, { rubR: 13, slipVR: 6 }, 3);
  check('a burnout on paving smokes, for an ordinary car and for the Rocket', burn > 40 && rocketBurn > 40, `${burn} and ${rocketBurn} puffs`);
  const idle = puffs(spec, { surface: 2 }, 4), full = puffs(spec, { surface: 2, throttle: 1 }, 4), dirt = puffs(spec, { surface: 3, throttle: 1 }, 4);
  check('the fans raise a little dust on gravel standing still, more run up, less on dirt', idle >= 3 && idle <= 18 && full > idle * 2.5 && full <= 60 && dirt > 5 && dirt < full, `${idle} idling, ${full} run up, ${dirt} on dirt (puffs alive)`);
  check('...none on paving or grass, none in the air, none from a car without fans', puffs(spec, { surface: 1, throttle: 1 }) === 0 && puffs(spec, { surface: 0, throttle: 1 }) === 0 && puffs(spec, { surface: 2, throttle: 1, y: 2 }) === 0 && puffs(m3, { surface: 2, throttle: 1 }) === 0);
}

process.exit(ok ? 0 : 1);
