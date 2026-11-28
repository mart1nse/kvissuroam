// Pictures of the Pirita-Kose lap's worn line and tyre marks (src/world/tln/piritaline.js), with and without (?pline=0).
//   node tools/pirita-line-shots.mjs <out dir> <lap point>[:view][,...] [base=http://127.0.0.1:5198]
//   view: drv (a driver's height, looking along the lap: the default), air (30 m up, looking down the lap), both
// Needs the vite dev server and Playwright. Files: <point>-<view>.png and off-<point>-<view>.png.
import { createRequire } from 'module';
import { readFileSync, mkdirSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2], places = (process.argv[3] || '380').split(',').map((s) => s.split(':')), base = process.argv[4] || 'http://127.0.0.1:5198';
mkdirSync(out, { recursive: true });
const LAP = JSON.parse(readFileSync(new URL('../src/race/pirita.json', import.meta.url))).pts, N = LAP.length;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [tag, q] of [['', ''], ['off-', '&pline=0']]) {
  if (tag && process.env.NO_OFF) break;
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error' && /shader|program|WebGL/i.test(m.text())) console.log('CONSOLE', m.text().slice(0, 600)); });
  await p.goto(`${base}/?drive&nointro&tln=1&city=tallinn${q}`, { timeout: 240000 });
  await p.waitForFunction(() => window.__game?.world && window.__game.car && window.__game.pirita?.(), null, { timeout: 240000 });
  await p.waitForTimeout(4000);
  await p.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  for (const [pt, view] of places) {
    const i0 = +pt, back = view === 'air' ? 10 : 8, i = ((i0 - back) % N + N) % N, a = LAP[i], c = LAP[(i + 6) % N], m = LAP[i0 % N];
    const yaw = Math.atan2(c[0] - a[0], -(c[1] - a[1]));
    await p.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 400); __game.place({ x, z, yaw }); }, [a[0], a[1], yaw]);
    await p.waitForFunction(([x, z]) => __game.world.ready(x, z), [m[0], m[1]], { timeout: 120000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(12000);
    for (const v of view === 'both' ? ['drv', 'air'] : [view || 'drv']) {
      await p.evaluate(([x, z, yaw, mx, mz, v]) => {
        const g = __game, y = g.car.y, fx = Math.sin(yaw), fz = -Math.cos(yaw);
        g.car.x = x - fx * 25; g.car.z = z - fz * 25;                     // (the car out of the picture, behind)
        window.__cam = v === 'air' ? [x - fx * 6, y + 30, z - fz * 6, mx + fx * 10, y, mz + fz * 10, 50] : [x - fx * 2, y + 1.6, z - fz * 2, x + fx * 40, y + 0.4, z + fz * 40, 60];
      }, [a[0], a[1], yaw, m[0], m[1], v]);
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `${out}/${tag}${pt}-${v}.png`, timeout: 180000 });
      console.log('shot', tag + pt, v, JSON.stringify(await p.evaluate(() => __game.pirita().line.info())));
    }
  }
  await p.close();
}
await b.close();
