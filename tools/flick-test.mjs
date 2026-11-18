// Low-speed flick check: on grass and tarmac, at walking to town speeds, the wheel is thrown from lock to
// lock (as the phone buttons do) with the throttle on and off. The tail may step out, but it must not snap
// round: reports the fastest yaw rate and the sharpest yaw kick (yaw acceleration) below 25 km/h.
// Run: node tools/flick-test.mjs [carId]
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, speedKmh } from '../src/cars/physics.js';
const world = (surf) => ({ meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });
const dt = 1 / 120, deg = (r) => (r * 180) / Math.PI;
const only = process.argv[2];
for (const [surf, name] of [[0, 'grass'], [1, 'tarmac']]) {
  console.log(`\n${name}`);
  for (const spec of Object.values(CARS)) {
    if (only && spec.id !== only) continue;
    let peakRate = 0, peakKick = 0;
    for (const seed of [0, 1, 2, 3]) {
      const car = createCar(spec, { x: seed * 37, z: seed * 11, yaw: 0 });
      const w = world(surf);
      let prev = 0, kickS = [];
      for (let t = 0; t < 14; t += dt) {
        const ph = Math.floor((t + seed * 0.3) / (0.9 + 0.2 * seed));
        const steer = t < 1.5 ? 0 : ph % 2 ? 1 : -1;
        const up = t < 1.5 ? 0.6 : (Math.floor(t * (1.3 + seed * 0.4)) % 3) ? 1 : 0;
        stepCar(car, { up, steer }, w, dt);
        const v = speedKmh(car);
        if (v > 25 && t > 1.5) stepCar(car, { down: 1, steer }, w, dt);   // keep it slow
        const kick = Math.abs(car.yawRate - prev) / dt; prev = car.yawRate;
        if (t > 2 && v < 25) { peakRate = Math.max(peakRate, Math.abs(car.yawRate)); kickS.push(kick); }
      }
      kickS.sort((a, b) => b - a);
      peakKick = Math.max(peakKick, kickS[Math.floor(kickS.length * 0.01)] || 0);   // 99th percentile
    }
    console.log(`  ${spec.short.padEnd(13)}${spec.drive} | peak yaw rate ${deg(peakRate).toFixed(0).padStart(4)} deg/s | yaw kick p99 ${deg(peakKick).toFixed(0).padStart(5)} deg/s2`);
  }
}
