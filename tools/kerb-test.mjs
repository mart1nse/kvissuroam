// Kerb check: a 14 cm kerb runs north along x = K on the car's right (Emajõe's river-side pavement).
// Rolling the right wheels up it at a fair angle must knock off a little speed and lean the car over
// (about atan(0.2 / track)); a shallow angle must turn the car back off the kerb instead; head-on at
// walking pace it must still climb. Run: node tools/kerb-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const K = 2.0, H = +(process.env.KERB_H || 0.14), EDGE = +(process.env.KERB_EDGE || 0.2);   // Emajõe: 14 cm, rounded over 20 cm
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const kerb = (x) => H * smooth((x - K) / EDGE);
const world = {
  meta: { riverLevel: -100 },
  heightAt: (x) => kerb(x),
  kerbAt: (x) => kerb(x),
  surfaceAt: () => 1,
  sdfAt: () => 100,
  sdfGrad: (x, z, o) => o,
};
const dt = 1 / 120, deg = Math.PI / 180;

function run(spec, kmh, angle, secs, x0 = 0, hold = true) {
  const car = createCar(spec, { x: x0, z: 0, yaw: angle, y: 0 });
  car.vx = kmh / 3.6;
  let maxRoll = 0, hit = 0, upR = 0;
  for (let t = 0; t < secs; t += dt) {
    stepCar(car, { up: hold ? Math.max(0, Math.min(0.5, (kmh / 3.6 - car.vx) * 0.5)) : 0 }, world, dt);
    maxRoll = Math.min(maxRoll, car.roll);
    hit = Math.max(hit, car.kerbHit || 0);
    if (car.kerbS && car.kerbS[1].h > H * 0.75 && car.kerbS[3].h > H * 0.75) upR = 1;
  }
  return { car, maxRoll: -maxRoll / deg, hit, upR };
}

let ok = true;
const check = (cond, msg) => { if (!cond) { ok = false; console.log('  FAIL', msg); } };
const lean = Math.atan2(H, 1.55) / deg;
for (const spec of Object.values(CARS)) {
  const name = spec.short.padEnd(10);
  // 1. right wheels up at 12 degrees, 50 km/h, then the car runs on with them up there
  const a = run(spec, 50, 12 * deg, 1.0, 0.4);
  const lost = 50 - a.car.vx * 3.6 * Math.cos(a.car.yaw);
  console.log(name, `up 12deg 50km/h: roll ${a.maxRoll.toFixed(1)} deg, knock ${a.hit.toFixed(2)}, speed now ${(Math.hypot(a.car.vx, a.car.vy) * 3.6).toFixed(1)} km/h, right wheels up ${a.upR}`);
  check(a.upR === 1 && a.hit > 0.2, `${name} right wheels should be up the kerb`);
  check(a.maxRoll > lean * 0.6 && a.maxRoll < lean * 2.2, `${name} lean ${a.maxRoll.toFixed(1)} should be near ${lean.toFixed(1)}`);
  check(Math.hypot(a.car.vx, a.car.vy) * 3.6 > 38, `${name} lost too much speed`);
  // 2. a shallow angle at 50 km/h: turned back off (2 degrees; 1 on a rounded edge, which is easier to climb)
  const g = EDGE > 0.12 ? 1 : 2;
  const b = run(spec, 50, g * deg, 2.0, 0.9);
  console.log(name, `glance ${g}deg: right front kerb height ${b.car.kerbS[1].h.toFixed(2)}, yaw ${(b.car.yaw / deg).toFixed(1)} deg, x ${b.car.x.toFixed(2)}`);
  check(b.upR === 0, `${name} should glance off at ${g} degrees`);
  check(b.car.yaw < g * deg, `${name} should be turned away from the kerb`);
  // 3. head-on at walking pace: climbs
  const c = run(spec, 6, 90 * deg, 4, K - spec.wheelbase - 0.6);
  console.log(name, `head-on 6 km/h: front kerb ${c.car.kerbS[0].h.toFixed(2)}, x ${c.car.x.toFixed(2)}`);
  check(c.car.kerbS[0].h > H * 0.75, `${name} should climb head-on at walking pace`);
}
console.log(ok ? 'ALL OK' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
