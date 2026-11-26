// Pictures of a car going slowly over an edge (src/cars/tip.js): off the south side of ERM's roof.
//   node tools/edge-shots.mjs <out dir> [km/h = 8]
// Needs the vite dev server on :5173 and Playwright. The drive is stepped with __game.sim and held still for
// each picture, looked at from beside the car.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2], kmh = +process.argv[3] || 8;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:5173/?drive&nointro');
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(5000);
// ERM's frame (src/world/erm.js): s along the hall, v across it; the roof's south edge is at v = 39.4
const O = [2738.89, 1050.59], U = [0.9007143, -0.43441195], V = [-U[1], U[0]];
const at = (s, v) => [O[0] + U[0] * s + V[0] * v, O[1] + U[1] * s + V[1] * v];
const [x, z] = at(20, 27), yaw = Math.atan2(V[0], -V[1]);
await p.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 300); __game.place({ x, z, yaw }); }, [x, z, yaw]);
await p.waitForTimeout(25000);                       // (the museum builds itself as the car is put there)
const top = await p.evaluate(([x, z, yaw, v]) => {
  const g = __game, y = g.world.groundAt(x, z, 999);
  g.place({ x, z, yaw, y });
  g.car.vx = v;
  return [y, g.world.heightAt(x, z)];
}, [x, z, yaw, kmh / 3.6]);
console.log('roof', top[0].toFixed(1), 'ground', top[1].toFixed(1));
// run on until each moment, hold the car there, look from the side
const moments = [
  ['1-belly-on-the-edge', (c) => c.tip && c.tip.d > 0.07],
  ['2-tipping-over', (c) => c.tip && c.tip.d > 0.3],
  ['3-in-the-air', (c) => !c.tip && c.airborne && c.pitch < -0.8],
  ['4-on-its-nose', (c) => !c.airborne && c.tipped && c.pitch < -0.5],
  ['5-back-on-its-wheels', (c) => !c.airborne && !c.tipped && !c.tip && c.y < 0],
];
for (const [name, when] of moments) {
  const got = await p.evaluate(([src, v, roofY]) => {
    const g = __game, c = g.car, when = eval(src);
    cancelAnimationFrame(window.__hold);
    let n = 0;
    const rel = { tip: c.tip, airborne: c.airborne, tipped: c.tipped, pitch: c.pitch, y: c.y - roofY + 3 };
    for (; n < 3000; n++) {
      g.sim(1 / 60, { up: c.vx < v ? 0.3 : 0 });
      rel.tip = c.tip; rel.airborne = c.airborne; rel.tipped = c.tipped; rel.pitch = c.pitch; rel.y = c.y - roofY + 3;
      if (when(rel)) break;
    }
    const keep = { ...c, tip: c.tip ? { ...c.tip } : null };
    const hold = () => { Object.assign(c, keep, { tip: keep.tip ? { ...keep.tip } : null }); window.__hold = requestAnimationFrame(hold); };
    hold();
    const fx = Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = Math.sin(c.yaw);
    window.__cam = [c.x + rx * 9 - fx * 1.5, c.y + 1.6, c.z + rz * 9 - fz * 1.5, c.x + fx * 0.5, c.y + 0.3, c.z + fz * 0.5, 45];
    return [n, c.pitch * 57.3, c.y, Math.hypot(c.vx, c.vy) * 3.6];
  }, [when.toString(), kmh / 3.6, top[0]]);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  console.log(name, `after ${got[0]} steps: nose ${got[1].toFixed(0)} deg, height ${got[2].toFixed(1)}, ${got[3].toFixed(0)} km/h`);
}
await b.close();
