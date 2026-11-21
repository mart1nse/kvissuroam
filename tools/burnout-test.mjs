// Burnout check (Martin 2026-11-21): brake and throttle together in a rear-driven car under 30 km/h.
//  stand   both pedals from a standstill: how far it lurches before the fronts hold it, how fast it
//          creeps after that, the rear wheelspin and the revs (strong cars at the limiter, the 190E just
//          about spinning with the revs struggling, the bus not at all)
//  first   brake first, then the throttle (at a standstill the brake alone selects reverse)
//  roll    rolling at 20 km/h, both pedals go down: seconds to a halt, rear wheelspin on the way
//  donut   a held donut, then the brake as well: slides on and straightens over 3.5 to 6.5 s
//  tilt    a burnout on a road leaning 4 deg to the right: how far the tail steps out
//  ease    the brake eased off slowly mid burnout until the car goes, then pressed again slowly (reined back)
//  fast    both pedals at 60 km/h: plain braking, as before
// Run: node tools/burnout-test.mjs [carId] [verbose]
import { CARS } from '../src/cars/specs.js';
const { createCar, stepCar, speedKmh } = await import(process.env.PHYS || '../src/cars/physics.js');
const world = (surf, roll = 0) => ({ meta: { riverLevel: -10 }, heightAt: (x, z) => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o,
  ...(roll ? { heightAt: (x, z) => x * Math.tan(roll) * -1 } : {}) });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const [only, verbose] = process.argv.slice(2);
const run = (car, w, secs, inp, each) => { for (let t = 0; t < secs; t += dt) { const i = typeof inp === 'function' ? inp(t) : inp; stepCar(car, i, w, dt); each?.(t, car); } };
let ok = true;
const flat = world(1);
for (const spec of Object.values(CARS)) {
  if (only && spec.id !== only) continue;
  if (spec.drive !== 'rwd') continue;
  const out = [];
  // stand
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    let lurch = 0, creep = 0, spin = 0, rpm = 0, n = 0, rMin = 1e9, rMax = 0;
    run(car, flat, 5, { up: 1, down: 1 }, (t, c) => {
      if (t < 1.5) lurch = Math.max(lurch, -c.z);
      if (verbose && Math.round(t * 120) % 12 === 0) console.log(`  t ${t.toFixed(1)} z ${(-c.z).toFixed(2)} v ${speedKmh(c).toFixed(1)} slipR ${(c.slipVR * 3.6).toFixed(0)} rpm ${c.rpm.toFixed(0)} spin ${c.spin.toFixed(2)} brake ${c.brake} burn ${c.burn.toFixed(2)}`);
      if (t > 2) { spin += c.slipVR * 3.6; rpm += c.rpm; n++; rMin = Math.min(rMin, c.rpm); rMax = Math.max(rMax, c.rpm); creep = Math.max(creep, speedKmh(c)); }
    });
    const weak = spec.ref.powerKw / spec.mass < 0.03;
    out.push(`stand: lurch ${lurch.toFixed(2)} m, creep ${creep.toFixed(1)} km/h, rear tread ${(spin / n).toFixed(0)} km/h, rpm ${rMin.toFixed(0)}..${rMax.toFixed(0)} (avg ${(rpm / n).toFixed(0)}), moved ${(-car.z).toFixed(1)} m, ${speedKmh(car).toFixed(1)} km/h at 5 s, yaw ${deg(car.yaw).toFixed(1)} deg`);
    // (held by the end, not reversing; every car but the bus spinning its rears, the bus not moving off; the
    // F40's turbos take a second to wake, so it rolls a few metres before its rears light up)
    if (!Number.isFinite(car.x + car.z + car.vx + car.rpm) || speedKmh(car) > 1 || car.reversing || -car.z > 6 || (weak ? -car.z > 1 : spin / n < 8)) ok = false;
  }
  // first: brake 0.3 s, then both
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    let spin = 0, n = 0;
    run(car, flat, 4, (t) => ({ up: t > 0.3 ? 1 : 0, down: 1 }), (t, c) => { if (t > 2) { spin += c.slipVR * 3.6; n++; } });
    out.push(`first: moved ${(-car.z).toFixed(2)} m, reversing ${car.reversing}, rear tread ${(spin / n).toFixed(0)} km/h`);
    if (car.z > 0.3 || car.reversing) ok = false;
  }
  // roll: 20 km/h then both
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 }); car.vx = 20 / 3.6;
    let tStop = null, spin = 0, n = 0;
    run(car, flat, 8, { up: 1, down: 1 }, (t, c) => { if (tStop === null && speedKmh(c) < 1) tStop = t; if (t < 1.5) { spin += c.slipVR * 3.6; n++; } });
    out.push(`roll 20: halt in ${tStop === null ? 'never' : tStop.toFixed(1) + ' s'}, rear tread over road ${(spin / n).toFixed(0)} km/h on the way`);
  }
  // donut then brake
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    let tStop = null, v0 = 0;
    run(car, flat, 13, (t) => ({ up: 1, steer: 1, down: t > 5 ? 1 : 0 }), (t, c) => { if (t > 4.9 && t < 5) v0 = speedKmh(c); if (t > 5 && tStop === null && speedKmh(c) < 1) tStop = t - 5; });
    out.push(`donut ${v0.toFixed(0)} km/h: halt in ${tStop === null ? 'never' : tStop.toFixed(1) + ' s'}, rear tread ${(car.slipVR * 3.6).toFixed(0)} km/h at the end`);
    if (spec.ref.powerKw / spec.mass >= 0.03 && (tStop === null || tStop < 3.5 || tStop > 6.5)) ok = false;
  }
  // tilt
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    const w = world(1, 4 * Math.PI / 180);
    run(car, w, 5, { up: 1, down: 1 });
    out.push(`tilt 4 deg: yaw ${deg(car.yaw).toFixed(1)} deg, slid ${car.x.toFixed(2)} m sideways`);
  }
  // ease: held 2 s, then the brake comes off over 3 s until the car gets going, then back on over 2 s
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    let goAt = null, tGo = 0, vMax = 0, tStop = null, b = 1;
    run(car, flat, 12, (t) => {
      if (goAt === null) b = t < 2 ? 1 : Math.max(0, 1 - (t - 2) / 3);
      else if (t > tGo + 1) b = Math.min(1, (t - tGo - 1) / 2);
      return { up: 1, down: b };
    }, (t, c) => {
      const v = speedKmh(c);
      if (goAt === null && t > 2 && v > 3) { goAt = b; tGo = t; }
      if (goAt !== null && t > tGo + 1) { vMax = Math.max(vMax, v); if (tStop === null && v < 1) tStop = t - tGo - 1; }
    });
    out.push(goAt === null ? 'ease: never got going' : `ease: gets going with the brake at ${(goAt * 100).toFixed(0)} %, pressed again it peaks at ${vMax.toFixed(0)} km/h and halts in ${tStop === null ? 'never' : tStop.toFixed(1) + ' s'}`);
  }
  // fast
  {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 }); car.vx = 60 / 3.6; car.gear = 2;
    let tStop = null;
    run(car, flat, 6, { up: 1, down: 1 }, (t, c) => { if (tStop === null && speedKmh(c) < 30) tStop = t; });
    out.push(`fast 60: down to 30 km/h in ${tStop === null ? 'never' : tStop.toFixed(2) + ' s'}`);
  }
  console.log(`${spec.short}\n  ${out.join('\n  ')}`);
}
console.log(ok ? '\nok' : '\nFAILED');
process.exit(ok ? 0 : 1);
