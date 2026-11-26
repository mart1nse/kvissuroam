// Pictures of a car come down on other vehicles (src/cars/tops.js): on the roof of a bus at a stop, half on a
// parked car's side, square on a parked car, and on a bus shelter's roof.
//   node tools/vehicle-shots.mjs <out dir> [the number of one picture]
// Needs the vite dev server on :5173 and Playwright. Each drop is stepped with __game.sim and held still for its
// picture, looked at from beside and a little above.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2], only = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:5173/?drive&nointro');
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(5000);
// near the Vabaduse puiestee stop: a bus stands there, and parked cars along the streets round it
const STOP = [1712.0, 2951.9];
await p.evaluate(async ([x, z]) => { await __game.world.loadAround(x, z, 300); __game.place({ x: x + 8, z: z + 8, yaw: 0 }); }, STOP);
// (the parked cars come in a few at a time, the nearest first, the buses last)
await p.waitForFunction(([x, z]) => __game.parked()?.bodies.some((b) => b.s.bus && Math.hypot(b.x - x, b.z - z) < 60), STOP, { timeout: 300000, polling: 2000 });
await p.waitForTimeout(5000);
// [name, which vehicle (bus or car), along it, to its right, over its top, camera: to the right, up, back, the car turned from it]
const shots = [
  ['1-on-a-bus-roof', 'bus', 1, 0, 1.2, -10, 6, 6],
  ['2-half-on-a-parked-car', 'car', 0, 1.25, 0.8, -6, 2.2, 4],
  ['3-on-a-parked-car', 'car', 0, 0, 0.6, 6, 2.5, 6],
  ['4-on-a-bus-shelter', 'shelter', 0, 0, 1.2, 3, 3.5, -8, Math.PI / 2],
];
for (const [name, kind, dl, dw, up, cr, cu, cb, turn = 0] of shots) {
  if (only && !name.startsWith(only)) continue;
  // the nearest such vehicle standing, and the car brought next to it so that its top is given to the world
  const v = await p.evaluate(([kind, x, z]) => {
    // (a shelter built near the car: its box, turned to the way the roof's top has it, src/world/shelter.js)
    const shelters = kind === 'shelter' ? __game.busStops().stops.filter((st) => st.br).map((st) => ({ x: st.box.x, z: st.box.z, yaw: -st.box.yaw, s: {} })) : null;
    const list = shelters || __game.parked().bodies.filter((b) => !!b.s.bus === (kind === 'bus') && !b.moving);
    list.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const v = list[0];
    if (!v) return null;
    cancelAnimationFrame(window.__hold);
    __game.place({ x: v.x + Math.cos(v.yaw) * 4, z: v.z + Math.sin(v.yaw) * 4, yaw: v.yaw });
    return { x: v.x, z: v.z, yaw: v.yaw, d: Math.hypot(v.x - x, v.z - z) };
  }, [kind, ...STOP]);
  if (!v) { console.log(name, `no ${kind} found`); continue; }
  await p.waitForTimeout(3000);
  const got = await p.evaluate(([v, dl, dw, up, cr, cu, cb, turn]) => {
    const g = __game, c = g.car, w = g.world;
    const fx = Math.sin(v.yaw), fz = -Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = Math.sin(v.yaw);
    const x = v.x + fx * dl + rx * dw, z = v.z + fz * dl + rz * dw;
    const top = w.groundAt(v.x, v.z, w.heightAt(v.x, v.z) + 6);
    g.place({ x, z, yaw: v.yaw + turn, y: top + up });
    c.airborne = true;
    let n = 0;
    for (; n < 240; n++) g.sim(1 / 60, { handbrake: true });
    const keep = { ...c, tip: c.tip ? { ...c.tip } : null };
    delete keep.roofG;
    const hold = () => { Object.assign(c, keep); window.__hold = requestAnimationFrame(hold); };
    hold();
    window.__cam = [c.x + rx * cr - fx * cb, c.y + cu, c.z + rz * cr - fz * cb, c.x, c.y + 0.6, c.z, 45];
    return [c.y - w.heightAt(c.x, c.z), c.roll * 57.3, c.pitch * 57.3, !!c.onTop || !!w.topHit, top - w.heightAt(v.x, v.z)];
  }, [v, dl, dw, up, cr, cu, cb, turn]);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  console.log(name, `${v.d.toFixed(0)} m from the stop: ${got[0].toFixed(2)} m over the street (its top ${got[4].toFixed(2)}), lean ${got[1].toFixed(0)} deg, nose ${got[2].toFixed(0)} deg, on it ${got[3]}`);
}
await b.close();
