// Pictures of bus stops (src/world/busstops.js) for before/after: node tools/busstop-shots.mjs <out dir> <query> <stop index>...
// Needs the vite dev server on :5173 and Playwright. Each stop is seen from the road, a little before it.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, query, ...idx] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(new URL('../src/world/busstops.json', import.meta.url)));
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:5173/?drive&nointro&${query}`);
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(8000);
for (const spec of idx) {
  if (spec === 'atlas') {          // the adverts and the timetable, as painted
    const url = await p.evaluate(async () => (await import('/src/world/adverts.js')).adAtlas().image.toDataURL('image/png'));
    fs.writeFileSync(`${out}/adverts.png`, Buffer.from(url.split(',')[1], 'base64'));
    continue;
  }
  const [i, view = 'road'] = spec.split(':');
  const [x, z, yaw, L, gap, side, hw] = D.stops[+i];
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  const W = (s, n) => [x + ux * s + nx * n, z + uz * s + nz * n];
  const kerb = -(1.55 / 2 + gap);
  const [cx, cz] = W(-14, kerb - hw * 0.5);           // the car in the lane before the stop
  await p.evaluate(async ([cx, cz, yaw]) => { await __game.world.loadAround(cx, cz, 300); __game.place({ x: cx, z: cz, yaw }); }, [cx, cz, Math.atan2(ux, -uz)]);
  await p.waitForTimeout(15000);
  let cam;
  if (view === 'road') { const [ex, ez] = W(-13, kerb - hw * 0.9); const [tx, tz] = W(0, 0); cam = [ex, 2.2, ez, tx, 1.2, tz, 55]; }
  else if (view === 'near') { const [ex, ez] = W(-5.5, kerb - 1.6); const [tx, tz] = W(0.5, 0.3); cam = [ex, 1.8, ez, tx, 1.2, tz, 60]; }
  else if (view === 'front') { const [ex, ez] = W(0, kerb - hw * 0.6); const [tx, tz] = W(0, 0); cam = [ex, 1.9, ez, tx, 1.3, tz, 60]; }
  else if (view === 'top') { const [ex, ez] = W(-16, kerb - 12); const [tx, tz] = W(-2, kerb); cam = [ex, 16, ez, tx, 0, tz, 55]; }
  await p.evaluate(([cam]) => { const g = __game, y = g.world.heightAt(cam[3], cam[5]); window.__cam = [cam[0], cam[1] + y, cam[2], cam[3], cam[4] + y, cam[5], cam[6]]; }, [cam]);
  await p.waitForTimeout(9000);
  const file = `${out}/stop${i}-${view}.png`;
  await p.screenshot({ path: file, timeout: 180000 });
  console.log(file, D.names[D.stops[+i][7]], JSON.stringify(await p.evaluate(() => __game.busStops?.()?.info())));
}
await b.close();
