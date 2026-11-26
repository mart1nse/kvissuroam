// Pictures of a car up on the map's roofs (the roofs in src/world/data.js, the walls by height in
// src/cars/physics.js): standing on a flat roof, leaning on a pitched one, its nose over a roof's edge, stopped by
// the higher part of a house, down in a yard between houses that the map has as house.
//   node tools/roof-shots.mjs <out dir> [the number of one picture]
// Needs the vite dev server on :5173 and Playwright. Each drive is stepped with __game.sim and held still for its
// picture, looked at from beside and a little above the car.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:5173/?drive&nointro');
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(5000);
// [name, x, z, heading (degrees), put this far over the roof, km/h, the moment to stop at, camera: to the right, up, back]
const shots = [
  ['1-on-a-flat-roof', 538, 2984.3, 20, 1.5, 0, (c, t) => t > 3, 8, 3.5, 4],
  ['2-on-a-pitched-roof', 715, 2810, 0, 0.3, 0, (c, t) => t > 2, 2.5, 1.6, 9],
  ['3-nose-over-the-edge', 538, 2984.3, 0, 0, 8, (c) => c.tip && c.tip.d > 0.25, 9, 1.6, 1.5],
  ['4-at-a-higher-part-of-the-house', 1598, 2197.4, 90, 0, 30, (c) => c.hit > 1, 5, 3.5, 9],
  ['5-down-in-a-yard-between-houses', 975, 2850, 70, 1.5, 0, (c, t) => t > 3, 0.5, 13, 9],
];
const only = process.argv[3];
for (const [name, x, z, deg, up, kmh, when, cr, cu, cb] of shots) {
  if (only && !name.startsWith(only)) continue;
  await p.evaluate(async ([x, z]) => { await __game.world.loadAround(x, z, 300); __game.place({ x, z, yaw: 0 }); }, [x, z]);
  await p.waitForTimeout(12000);
  const got = await p.evaluate(([x, z, yaw, up, v, src, cr, cu, cb]) => {
    const g = __game, c = g.car, when = eval(src);
    cancelAnimationFrame(window.__hold);
    const roof = g.world.roofTop(x, z);
    g.place({ x, z, yaw, y: roof + up });
    c.vx = v; if (up > 0) c.airborne = true;
    let n = 0;
    for (; n < 3000; n++) {
      g.sim(1 / 60, v ? { up: c.vx < v ? 0.4 : 0 } : { down: 1, handbrake: true });
      if (when({ tip: c.tip, hit: c.hit || 0 }, n / 60)) break;
    }
    const keep = { ...c, tip: c.tip ? { ...c.tip } : null, roofG: null };
    delete keep.roofG;
    const hold = () => { Object.assign(c, keep, { tip: keep.tip ? { ...keep.tip } : null }); window.__hold = requestAnimationFrame(hold); };
    hold();
    // (looked at along the heading it was put with: a car that met a wall has turned)
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    window.__cam = [c.x + rx * cr - fx * cb, c.y + cu, c.z + rz * cr - fz * cb, c.x + fx * 0.5, c.y + 0.3, c.z + fz * 0.5, 45];
    return [n, c.pitch * 57.3, c.roll * 57.3, c.y - g.world.heightAt(c.x, c.z), roof - g.world.heightAt(x, z)];
  }, [x, z, deg / 57.2958, up, kmh / 3.6, when.toString(), cr, cu, cb]);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  console.log(name, `after ${got[0]} steps: nose ${got[1].toFixed(0)} deg, lean ${got[2].toFixed(0)} deg, ${got[3].toFixed(1)} m over the ground (the roof ${got[4].toFixed(1)})`);
}
await b.close();
