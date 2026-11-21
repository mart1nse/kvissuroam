// Low-speed flick check (Martin 2026-11-21): rolling at 0 to 10 km/h with the wheel at full lock and the throttle
// floored or at 60 % (wheel and pedal together, or the wheel first), the tail may come round but must not be
// flicked out hard: there is no speed to swing it with. Reports, for each car, the sharpest yaw kick into the
// turn over 50 ms while under 15 km/h (deg/s2) and the yaw rate it reached; the rear-driven cars must stay
// under KICK_MAX (the twin-motor EVs are shown: their worst comes mid donut, as the hold brings them round again). Before 2026-11-21 the donut hold went on pushing after the car
// already turned at a donut's rate: 286 to 307 deg/s2 on gravel for the 190E, F40, Carrera GT and M3.
// Run: node tools/lowflick-test.mjs [carId] [v0 for a trace]   (trace options: SEED, PRE, SURF env)
import { CARS } from '../src/cars/specs.js';
const { createCar, stepCar, speedKmh } = await import(process.env.PHYS || '../src/cars/physics.js');
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const only = process.argv[2], verbose = process.argv[3];
const KICK_MAX = 240;   // deg/s2
let ok = true;
for (const [surf, name] of [[1, 'tarmac'], [2, 'gravel']]) {
  console.log(`\n${name}`);
  for (const spec of Object.values(CARS)) {
    if (only && spec.id !== only) continue;
    let worst = { k: 0 }, sumR = 0, nR = 0, sumK = 0;
    for (const v0 of [0, 3, 6, 10]) for (const thr of [1, 0.6]) for (const seed of [0, 1, 2, 3, 4, 5]) for (const pre of [0, 1]) {
      const car = createCar(spec, { x: seed * 41, z: seed * 17, yaw: 0 });
      car.time = seed * 3.3;
      car.vx = v0 / 3.6;
      const w = world(surf);
      let prev = 0, rates = [], peakK = 0, peakR = 0, at = 0;
      for (let t = 0; t < 3; t += dt) {
        // pre: wheel already at lock before the throttle; else wheel and throttle together
        const steer = 1, up = (pre ? t > 0.5 : true) ? thr : 0;
        stepCar(car, { up, steer }, w, dt);
        rates.push(car.yawRate);
        if (rates.length > 6) {
          const k = (car.yawRate - rates[rates.length - 7]) / (6 * dt);   // 50 ms yaw accel into the turn (tail out)
          if (speedKmh(car) < 15 && k > peakK) { peakK = k; at = t; }
        }
        if (speedKmh(car) < 15) peakR = Math.max(peakR, Math.abs(car.yawRate));
        if (verbose && v0 == +verbose && thr === 1 && seed === +(process.env.SEED||0) && pre === +(process.env.PRE||0) && surf === +(process.env.SURF||1) && Math.round(t*120)%3===0) console.log(`t ${t.toFixed(2)} v ${speedKmh(car).toFixed(1)} yaw ${deg(car.yawRate).toFixed(0)} beta ${deg(Math.atan2(car.vy, Math.max(0.3, car.vx))).toFixed(0)} slipR ${car.slipVR.toFixed(1)} steer ${car.steer.toFixed(2)} rpm ${car.rpm.toFixed(0)}`);
      }
      sumR += peakR; sumK += peakK; nR++;
      if (peakK > worst.k) worst = { k: peakK, r: peakR, v0, thr, seed, pre, at };
    }
    const must = spec.drive === 'rwd';
    if (must && deg(worst.k) > KICK_MAX) ok = false;
    console.log(`  ${spec.short.padEnd(13)}${spec.drive} | worst yaw accel ${deg(worst.k).toFixed(0).padStart(5)} deg/s2 (v0 ${worst.v0} thr ${worst.thr} seed ${worst.seed} pre ${worst.pre} t ${worst.at.toFixed(2)}) peak rate ${deg(worst.r).toFixed(0)} | mean of runs: peak rate ${deg(sumR / nR).toFixed(0)} accel ${deg(sumK / nR).toFixed(0)}`);
  }
}
// Out of a burnout on full lock (brake let go) or a slide braked to a stop and then driven off: the car stands
// still with its rear wheels already spinning, and before 2026-11-21 (second ask) the donut hold pushed the tail
// round at once, 7 to 19 km/h sideways and up to 136 deg/s before the car had reached 12 km/h. Now the tail
// may come out only as the car gathers pace: the rear axle's sideways speed and the yaw rate are reported up
// to 12 km/h, and the strong rear-driven cars must stay under TAIL_MAX.
const TAIL_MAX = 8, YAW_MAX = 95;   // km/h, deg/s
console.log('\nfrom a standstill with the rears spinning (tail sideways km/h / yaw deg/s before 12 km/h)');
for (const [surf, name] of [[1, 'tarmac'], [2, 'gravel']]) {
  const row = [];
  for (const spec of Object.values(CARS)) {
    if (only && spec.id !== only) continue;
    if (spec.drive !== 'rwd' || spec.ref.powerKw / spec.mass < 0.03) continue;
    let tail = 0, yaw = 0;
    for (const [tm, inp] of [[3, (t) => ({ up: 1, steer: 1, down: t < 3 ? 1 : 0 })], [11.5, (t) => ({ up: 1, steer: 1, down: t > 5 && t < 11.5 ? 1 : 0 })]])
      for (const seed of [0, 1, 2, 3]) {
        const car = createCar(spec, { x: seed * 41, z: seed * 17, yaw: 0 }); car.time = seed * 3.3;
        let fast = false;
        for (let t = 0; t < tm + 2; t += dt) {
          stepCar(car, inp(t), world(surf), dt);
          if (t < tm || fast || (fast = speedKmh(car) > 12)) continue;
          tail = Math.max(tail, Math.abs(car.vy - car.b * car.yawRate) * 3.6); yaw = Math.max(yaw, Math.abs(deg(car.yawRate)));
        }
      }
    if (tail > TAIL_MAX || yaw > YAW_MAX) ok = false;
    row.push(`${spec.short} ${tail.toFixed(1)} / ${yaw.toFixed(0)}`);
  }
  console.log(`  ${name}: ${row.join(' | ')}`);
}
// The start of the step-out (Martin 2026-11-21, third ask: the beginning of the flick was abrupt, "Audi on grass
// and the rwd ones"): from 0, 3 or 6 km/h or out of a burnout on full lock, the sharpest yaw kick over 50 ms
// until the tail is 30 deg out (and 0.3 s after). Before, the donut hold's start-up push came on in about a
// third of a second: 203-237 deg/s2 for these cars; now it is gentler until a donut is under way.
const ONSET_MAX = 185;   // deg/s2
console.log('\nstart of the step-out: sharpest yaw kick until the tail is 30 deg out (deg/s2)');
for (const [surf, name] of [[0, 'grass'], [1, 'tarmac'], [2, 'gravel']]) {
  const row = [];
  for (const id of ['w201', 'f40', 'cgt', 'm3', 'audi200']) {
    const spec = CARS[id];
    if (only && id !== only) continue;
    let worst = 0;
    for (const sc of [0, 3, 6, 'burn']) for (const seed of [0, 1, 2]) {
      const car = createCar(spec, { x: seed * 41, z: seed * 17, yaw: 0 }); car.time = seed * 3.3;
      if (sc !== 'burn') car.vx = sc / 3.6;
      const t0 = sc === 'burn' ? 3 : 0, ys = []; let got = null;
      for (let t = 0; t < t0 + 4; t += dt) {
        stepCar(car, sc === 'burn' ? { up: 1, steer: 1, down: t < 3 ? 1 : 0 } : { up: 1, steer: 1 }, world(surf), dt);
        ys.push(car.yawRate); if (t < t0) continue;
        if (ys.length > 6 && (got === null || t - t0 < got + 0.3)) worst = Math.max(worst, deg(car.yawRate - ys[ys.length - 7]) / (6 * dt));
        if (got === null && Math.abs(Math.atan2(car.vy, Math.abs(car.vx))) > 30 / 57.3 && speedKmh(car) > 3) got = t - t0;
      }
    }
    if (worst > ONSET_MAX) ok = false;
    row.push(`${spec.short} ${worst.toFixed(0)}`);
  }
  console.log(`  ${name}: ${row.join(' | ')}`);
}
// Mid donut (Martin 2026-11-21, fourth ask, two videos of the 190E on grass): (a) a brief lift of the throttle
// with the wheel held at full lock, then floored again; (b) figure eights, the wheel swapped from full lock one
// way to the other. In both the donut hold pushed at full strength at once: the slide slowed or reversed, then
// the tail was flung out at 300-420 deg/s2 (figure eights) and up to 210 (after a lift). Reported: the sharpest
// 50 ms yaw kick in the way the car already turns (over 30 deg/s and 1.5 km/h) after the lift or the first swap.
// Judged on grass and gravel; on tarmac a figure eight above 15 km/h swings the car round on its tyres alone
// (180-270 deg/s2, the hold adds nothing there), so tarmac is shown only for the figure eights.
const MID_MAX = 185;   // deg/s2
console.log('\nmid donut: sharpest kick after a brief lift / in figure eights (deg/s2)');
for (const [surf, name] of [[0, 'grass'], [1, 'tarmac'], [2, 'gravel']]) {
  const row = [];
  for (const id of ['w201', 'f40', 'cgt', 'm3', 'audi200']) {
    const spec = CARS[id];
    if (only && id !== only) continue;
    const kick = (inp, T0, end, seed) => {
      const car = createCar(spec, { x: seed * 41, z: seed * 17, yaw: 0 }); car.time = seed * 3.3;
      const ys = []; let worst = 0;
      for (let t = 0; t < end; t += dt) {
        stepCar(car, inp(t), world(surf), dt); ys.push(car.yawRate);
        if (t > T0 && Math.abs(car.yawRate) > 0.5 && speedKmh(car) > 1.5) worst = Math.max(worst, deg(Math.sign(car.yawRate) * (car.yawRate - ys[ys.length - 7])) / (6 * dt));
      }
      return worst;
    };
    let lift = 0, fig = 0;
    for (const seed of [0, 1, 2]) for (const T0 of [5, 6.2, 7.4]) {
      for (const L of [0.15, 0.3, 0.5]) lift = Math.max(lift, kick((t) => ({ up: t > T0 && t < T0 + L ? 0 : 1, steer: 1 }), T0, T0 + L + 2.5, seed));
      for (const P of [1.5, 2.5, 3.5]) fig = Math.max(fig, kick((t) => ({ up: 1, steer: t < T0 || Math.floor((t - T0) / P) % 2 ? 1 : -1 }), T0, T0 + 2 * P, seed));
    }
    if (lift > MID_MAX || (surf !== 1 && fig > MID_MAX)) ok = false;
    row.push(`${spec.short} ${lift.toFixed(0)} / ${fig.toFixed(0)}`);
  }
  console.log(`  ${name}: ${row.join(' | ')}`);
}
console.log(ok ? '\nok' : '\nFAILED');
process.exit(ok ? 0 : 1);
