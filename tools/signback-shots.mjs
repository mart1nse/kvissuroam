// Pictures of a traffic sign from the front and from behind (grey backs, src/world/signback.js) for
// before/after: node tools/signback-shots.mjs <out dir> <prefix> [query]
// Needs the vite dev server on :5173 and Playwright. Signs: the Kroonuaia 30, the Hariduse no-parking sign
// with its arrow plate, the Catholic school yard sign and a bus stop sign.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, prefix, query = ''] = process.argv.slice(2);
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:5173/?drive&nointro&${query}`);
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(8000);
await p.addStyleTag({ content: '* { visibility: hidden !important } canvas { visibility: visible !important }' });
await p.evaluate(() => { const cs = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height); cs.slice(1).forEach((c) => { c.style.display = 'none'; }); });
// [name, x, z, bearing of the sign's face, plate height]
const signs = await p.evaluate(async () => {
  const kr = (await import('/src/race/kroonuaia.js')).kroonuaiaProps().filter((e) => e[0] === 22)[1];      // the lone 30 at lap index 1158.5
  const bus = (await import('/src/world/busstops.js')).busStopProps?.().find((e) => e[0] === 30);
  const list = [['kroonuaia30', kr[1], kr[2], kr[3], 2.5], ['hariduse-noparking', 3896.6, -2136.5, 0, 2.3]];
  if (bus) list.push(['busstop', bus[1], bus[2], bus[3], 2.5]);
  return list;
});
for (const [name, x, z, brg, ph] of signs) {
  const r = brg * Math.PI / 180, fx = Math.sin(r), fz = -Math.cos(r);       // the way the face looks
  await p.evaluate(async ([x, z]) => { await __game.world.loadAround(x, z, 200); __game.place({ x: x + 12, z: z + 12, yaw: 0 }); }, [x, z]);
  await p.waitForTimeout(12000);
  for (const [view, d] of [['front', 1], ['back', -1]]) {
    const ex = x + fx * d * 6 + fz * 1.6, ez = z + fz * d * 6 - fx * 1.6;
    await p.evaluate(([ex, ez, x, z, ph]) => { const y = __game.world.heightAt(x, z); window.__cam = [ex, y + 2.1, ez, x, y + ph, z, 50]; }, [ex, ez, x, z, ph]);
    await p.waitForTimeout(5000);
    const file = `${out}/${prefix}-${name}-${view}.png`;
    await p.screenshot({ path: file, timeout: 180000 });
    console.log(file);
  }
}
await b.close();
