// Pictures along the Pirita-Kose lap from a driver's height (Tallinn, ?tln=1): the 2000s race dressing of
// src/world/tln/pirita.js (corner boards, striped rails, spectators' tape) and tln/treebags.js (trees in straw sacks).
//   node tools/pirita-period-shots.mjs <out dir> <lap point>[,<lap point>...] [back = 0]
// Needs the vite dev server on :5173 and Playwright. Each picture looks along the lap from `back` points behind.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2], pts = (process.argv[3] || '300').split(',').map(Number), back = +process.argv[4] || 0;
const LAP = JSON.parse(readFileSync(new URL('../src/race/pirita.json', import.meta.url))).pts, N = LAP.length;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:5173/?drive&nointro&tln=1&city=tallinn', { timeout: 240000 });
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(4000);
for (const i0 of pts) {
  const i = ((i0 - back) % N + N) % N, a = LAP[i], c = LAP[(i + 6) % N];
  const yaw = Math.atan2(c[0] - a[0], -(c[1] - a[1]));
  await p.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 400); __game.place({ x, z, yaw }); }, [a[0], a[1], yaw]);
  await p.waitForTimeout(14000);
  await p.evaluate(([x, z, yaw]) => {
    const g = __game, y = g.car.y, fx = Math.sin(yaw), fz = -Math.cos(yaw);
    window.__cam = [x - fx * 2, y + 1.7, z - fz * 2, x + fx * 40, y + 0.8, z + fz * 40, 60];
  }, [a[0], a[1], yaw]);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/lap-${i0}.png`, timeout: 180000 });
  console.log('shot', i0);
}
await b.close();
