// Drive into one of the map's bus shelters (src/world/busstops.js) at 9 m/s and report the damage:
// node tools/busstop-crash.mjs <out dir> <stop index>. Needs the vite dev server on :5173 and Playwright.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, idx = '143'] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(new URL('../src/world/busstops.json', import.meta.url)));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:5173/?drive&nointro');
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(8000);
const [x, z, yaw, L, gap] = D.stops[+idx];
const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
const W = (s, n) => [x + ux * s + nx * n, z + uz * s + nz * n];
const [cx, cz] = W(0.6, -(1.55 / 2 + gap) - 4.5);
await p.evaluate(async ([cx, cz, cy]) => { await __game.world.loadAround(cx, cz, 300); __game.place({ x: cx, z: cz, yaw: cy }); }, [cx, cz, Math.atan2(nx, -nz)]);
await p.waitForTimeout(12000);
const res = await p.evaluate(async () => {
  const g = __game, { updateShelters, shelterInfo } = await import('/src/world/shelter.js');
  window.requestAnimationFrame = () => 0;                 // stop the frame loop: step by hand
  for (let k = 0; k < 8; k++) g.busStops().update(g.car);
  const before = g.busStops().info();
  g.car.vx = 9;
  let minV = 9;
  for (let k = 0; k < 120; k++) { g.sim(1 / 60, { up: 0 }); updateShelters(g.car, 1 / 60, g.audio); minV = Math.min(minV, g.car.vx); }
  for (let k = 0; k < 120; k++) updateShelters(g.car, 1 / 60, g.audio);
  const near = shelterInfo().map((s) => ({ ...s, d: Math.hypot(s.box.x - g.car.x, s.box.z - g.car.z) })).sort((a, b) => a.d - b.d)[0];
  g.renderer.render(g.scene, g.camera);
  return { before, near, car: { x: g.car.x, z: g.car.z, vx: g.car.vx, minV } };
});
console.log(JSON.stringify(res));
const [ex, ez] = W(-7, -(1.55 / 2 + gap) - 6);
await p.evaluate(([ex, ez, tx, tz]) => {
  const g = __game, y = g.world.heightAt(tx, tz);
  g.camera.position.set(ex, y + 3.2, ez); g.camera.lookAt(tx, y + 0.8, tz); g.camera.updateMatrixWorld();
  g.renderer.render(g.scene, g.camera);
}, [ex, ez, x, z]);
await p.screenshot({ path: `${out}/crash-${idx}.png`, timeout: 180000 });
await b.close();
