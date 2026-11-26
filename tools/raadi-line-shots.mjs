// Pictures of the Raadi stage's worn line (src/race/raadi-line.js, made from real runs by tools/race/raadi-lines.py):
// at a few places along the stage, from the air and from behind a car's roof, with the line and (old-<name>.png)
// with the wheel tracks it replaces.
//   node tools/raadi-line-shots.mjs <out dir> [places] [url]
//   places: name:point[:view] separated by commas; view air (40 m up, the default pair is both), low
// Needs the dev server (npx vite --port 5198) and Playwright.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const places = (process.argv[3] || 'start:40,first:82,pond:370,junction:402,east:500,loop:612,west:700,last:854,finish:875').split(',').map((s) => s.split(':'));
const base = process.argv[4] || 'http://localhost:5198/?raadi=1';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [tag, q] of [['', ''], ['old-', '&tracks=old']]) {
  if (tag && process.env.NO_OLD) break;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(base + q);
  await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
  await page.evaluate(() => __game.startDriving());
  await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
  await page.evaluate(() => __game.stage().goStart());
  await page.waitForFunction(() => { const s = __game.stage(); return s.bales.built && (s.line ? !!s.line.mesh.parent : true); }, null, { timeout: 180000, polling: 200 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { __game.stage().update = () => {}; });
  for (const [name, pt, view] of places) {
    for (const v of view ? [view] : ['air', 'low']) {
      await page.evaluate(([i, v]) => {
        const s = __game.stage(), P = s.data.pts, w = __game.world, car = __game.car;
        const a = P[Math.max(0, i - 4)], b = P[Math.min(P.length - 1, i + 4)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
        const [x, z] = P[i], h = w.heightAt(x, z);
        // the car a little back along the stage, standing
        const c = P[Math.max(0, i - 6)];
        Object.assign(car, { x: c[0], z: c[1], yaw: Math.atan2(tx, -tz), vx: 0, vy: 0, yawRate: 0 });
        window.__cam = v === 'air' ? [x - tx * 14, h + 38, z - tz * 14, x + tx * 4, h, z + tz * 4, 50] : [c[0] - tx * 7, h + 2.6, c[1] - tz * 7, x + tx * 14, h, z + tz * 14, 60];
      }, [+pt, v]);
      await page.waitForFunction(() => __game.world.ready(__game.car.x, __game.car.z), null, { timeout: 120000, polling: 250 });
      await page.waitForTimeout(tag || name !== places[0][0] ? 4000 : 12000);
      await page.screenshot({ path: `${out}/${tag}${name}-${v}.png` });
    }
  }
  if (!tag) console.log('line:', JSON.stringify(await page.evaluate(() => { const l = __game.stage().line; return l && { quads: l.quads, verts: l.verts, runs: l.runs, shown: !!l.mesh.parent }; })));
  await page.close();
}
await browser.close();
