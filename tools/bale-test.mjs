// Straw bales of the Raadi stage (src/race/bales.js): drives the car into one bale in several ways (square on
// the nose, half off, by the corner; walking pace to 90 km/h; throttle held) and prints what each hit costs:
// the car's speed just after, its speed 1 s later with the throttle down, how far the bale went, whether it
// fell over, how deep its dent is and how many bits of straw flew. Run before and after a change to the bales'
// weight to see what it does.
// Needs the dev server (npx vite --port 5198) and Playwright. Usage: node tools/bale-test.mjs [url]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://localhost:5198/?raadi=1&q=low&trees=old';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
await page.evaluate(() => __game.startDriving());
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
await page.evaluate(() => __game.stage().goStart());
await page.waitForFunction(() => __game.stage().bales.built, null, { timeout: 180000, polling: 200 });

const cases = [];
for (const kmh of [8, 30, 60, 90]) for (const [name, off] of [['square on', 0], ['half off', 0.5], ['by the corner', 0.95]]) cases.push({ kmh, name, off });
const rows = await page.evaluate((cases) => {
  const s = __game.stage(), car = __game.car, B = s.bales, out = [];
  const upd = s.update; s.update = () => {};          // (the stage's own frames stay out of it)
  // a bale on level ground with room behind it: the one whose surroundings are flattest
  const flat = (b) => { let m = 0; for (let a = 0; a < 8; a++) m = Math.max(m, Math.abs(__game.world.heightAt(b.x + Math.cos(a) * 9, b.z + Math.sin(a) * 9) - __game.world.heightAt(b.x, b.z))); return m; };
  const b = B.bales.slice().sort((p, q) => flat(p) - flat(q))[0];
  for (const c of cases) {
    B.reset();
    const yaw = 0.6, fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    const v0 = c.kmh / 3.6, back = car.halfLen + 0.6 + 2.5, side = -c.off * car.halfWid;
    Object.assign(car, { x: b.x - fx * back + rx * side, z: b.z - fz * back + rz * side, yaw, vx: v0, vy: 0, yawRate: 0, hit: 0 });
    __game.sim(0.05, { up: 1 });                       // (settles on its wheels)
    car.vx = v0;
    let after = null, t = 0, tHit = null, v1 = null;
    for (; t < 4; t += 1 / 60) {
      const before = Math.hypot(car.vx, car.vy);
      __game.sim(1 / 60, { up: 1 });
      B.update(car, 1 / 60);
      if (tHit === null && b.awake) { tHit = t; after = Math.hypot(car.vx, car.vy); }
      if (tHit !== null && v1 === null && t - tHit >= 1) v1 = Math.hypot(car.vx, car.vy);
      void before;
    }
    // (the car away, the bale left to come to rest)
    car.x += 500;
    for (let k = 0; k < 600 && b.awake; k++) B.update(car, 1 / 60);
    car.x -= 500;
    out.push({ ...c, mass: car.spec.mass, after: after && after * 3.6, v1: v1 && v1 * 3.6, went: Math.hypot(b.x - b.home.x, b.z - b.home.z), down: b.down, dent: b.sq, straw: B.straw ? B.straw.count : null });
  }
  B.reset();
  s.update = upd;
  return out;
}, cases);
console.log(`car ${rows[0].mass} kg`);
for (const r of rows) console.log(`${String(r.kmh).padStart(3)} km/h ${r.name.padEnd(14)} after ${r.after == null ? '  -  ' : r.after.toFixed(1).padStart(5)}  1 s on ${r.v1 == null ? '  -  ' : r.v1.toFixed(1).padStart(5)} km/h  bale went ${r.went.toFixed(2).padStart(5)} m${r.down ? ' (over)' : ''}  dent ${(r.dent * 100).toFixed(0)} %${r.straw == null ? '' : `  straw ${r.straw}`}`);
await browser.close();
