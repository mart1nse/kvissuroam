// Stones check (src/cars/stones.js): a car on flat gravel meets stones of several sizes in several ways, and what
// it does is printed: speed, how high the body went, how far it pitched, rolled and turned, whether it got past.
// Expected, roughly: a low stone under one wheel hops and tilts that corner and the car goes on; a low stone
// under the middle scrapes the floor; a stone higher than the bumper's lower edge stops the car like a wall;
// with a smaller stone just before it under the front wheels the nose is up and the taller one goes under.
// Run: node tools/stone-test.mjs [car id]
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const dt = 1 / 60;
const pick = process.argv[2];
const stone = (x, z, r, tall = 0.8) => ({ x, z, a: r, b: r * 0.9, cs: 1, sn: 0, h: r * tall, gy: 0 });
function world(stones) {
  return {
    meta: { riverLevel: -100 }, heightAt: () => 0, surfaceAt: () => 2, waterLevelAt: () => -100,
    sdfAt: () => 12, sdfGrad(x, z, o) { o[0] = o[1] = 0; return o; },
    stoneCount: stones.length,
    stonesNear(x, z, reach, out) { out.length = 0; for (const s of stones) if (Math.abs(s.x - x) < reach + 1.8 && Math.abs(s.z - z) < reach + 1.8) out.push(s); return out; },
  };
}
// the car starts at the origin heading north (-z) at v m/s; stones are given as [right of its line, metres ahead, radius, tall]
function run(spec, name, v, stones, { side = 0, throttle = 0 } = {}) {
  const w = world(stones.map(([x, ahead, r, tall]) => stone(x, -ahead, r, tall)));
  const car = createCar(spec, { x: 0, z: 0, yaw: 0, y: 0 });
  car.vx = v; car.vy = side;
  let top = 0, pit = [0, 0], rol = [0, 0], air = 0, vmin = v, knock = 0;
  for (let t = 0; t < 2.5; t += dt) {
    stepCar(car, { up: throttle || (car.vx < v && !side ? 0.7 : 0), down: 0, left: 0, right: 0 }, w, dt);
    top = Math.max(top, car.y); pit = [Math.min(pit[0], car.pitch), Math.max(pit[1], car.pitch)]; rol = [Math.min(rol[0], car.roll), Math.max(rol[1], car.roll)];
    if (car.airborne) air += dt;
    vmin = Math.min(vmin, Math.hypot(car.vx, car.vy)); knock = Math.max(knock, car.hit || 0, car.kerbHit || 0);
    if (!Number.isFinite(car.x + car.y + car.pitch + car.roll)) { console.log(name, 'NOT A NUMBER at', t.toFixed(2)); return; }
  }
  const deg = (r) => (r * 57.3).toFixed(1);
  console.log(`${name.padEnd(44)} v ${v.toFixed(0)} -> low ${vmin.toFixed(1)}, end ${Math.hypot(car.vx, car.vy).toFixed(1)} m/s | went ${(-car.z).toFixed(1)} m, off line ${car.x.toFixed(2)} m, turned ${deg(car.yaw)} | body up ${(top * 100).toFixed(0)} cm, pitch ${deg(pit[0])}..${deg(pit[1])}, roll ${deg(rol[0])}..${deg(rol[1])}, in the air ${air.toFixed(2)} s, knock ${knock.toFixed(2)}`);
}
for (const spec of Object.values(CARS).filter((c) => (pick ? c.id === pick : ['w201', 'rav4', '22b'].includes(c.id)))) {
  const hw = spec.track / 2, c0 = spec.clearance ?? 0.5 * spec.wheelRadius;
  console.log(`\n${spec.id}: floor ${(c0 * 100).toFixed(0)} cm, front bumper ${((c0 + 0.13) * 100).toFixed(0)} cm, wheel ${(spec.wheelRadius * 100).toFixed(0)} cm`);
  for (const v of [6, 14, 25]) {
    run(spec, 'no stone', v, []);
    run(spec, 'low stone (top 20 cm) under the right wheels', v, [[hw, 12, 0.25, 0.63]]);
    run(spec, 'low stone (top 20 cm) under the middle', v, [[0, 12, 0.25, 0.63]]);
    run(spec, 'stone (top 27 cm) under the right wheels', v, [[hw, 12, 0.3, 0.71]]);
    run(spec, 'stone (top 27 cm) under the middle', v, [[0, 12, 0.3, 0.71]]);
    run(spec, 'boulder (top 60 cm) head on', v, [[0, 12, 0.6, 0.79]]);
    run(spec, 'boulder (top 60 cm) at the right corner', v, [[hw + 0.3, 12, 0.6, 0.79]]);
    run(spec, 'stone (top 38 cm) in the middle alone', v, [[0, 13.2, 0.4, 0.75]]);
    run(spec, '  the same after 24 cm stones under both fronts', v, [[-hw, 12, 0.28, 0.68], [hw, 12, 0.28, 0.68], [0, 13.2, 0.4, 0.75]]);
  }
  run(spec, 'sliding sideways onto a low stone (20 cm)', 2, [[3, 2, 0.25, 0.63]], { side: 6 });
  run(spec, 'sliding sideways onto a boulder (60 cm)', 2, [[3.5, 2, 0.6, 0.79]], { side: 6 });
}
