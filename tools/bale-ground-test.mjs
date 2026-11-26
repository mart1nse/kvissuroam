// Do the Raadi stage's bales and barriers stand on the ground after coming back to the stage from far away?
// (Martin 26 Nov 2026: "some haybales have sunken". The stage is built once; a later start from the other side of
// town put its bales back on the ground before the park's ground had loaded again, at the map's rough heights.)
// Builds the stage, drives 4 km off until the park's ground is let go, comes back by the start button, and
// measures how far each bale's foot and each barrier is from the ground once the ground is there.
// Needs the dev server (npx vite --port 5198) and Playwright. Usage: node tools/bale-ground-test.mjs [url]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://localhost:5198/?q=low&trees=old';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
await page.evaluate(() => __game.startDriving());
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
await page.evaluate(() => __game.stage().goStart());
await page.waitForFunction(() => __game.stage().bales.built, null, { timeout: 180000, polling: 200 });
await page.waitForTimeout(3000);

// each bale's foot and each barrier against the ground under it, in metres (+ above, - sunk)
const measure = () => page.evaluate(() => {
  const st = __game.stage(), w = __game.world, e = [];
  const out = { bales: [], bars: [], ready: 0, n: st.bales.bales.length };
  for (const b of st.bales.bales) {
    const [mesh, i] = b.slot;
    mesh.getMatrixAt(i, window.__m4 ||= new mesh.matrix.constructor());
    // (only where the ground is there to measure against: the far ground's rough heights are the fault itself)
    if (!w.ready(b.x, b.z)) continue;
    out.ready++;
    out.bales.push(+(__m4.elements[13] - 0.6 - w.heightAt(b.x, b.z)).toFixed(2));
  }
  for (const b of st.barriers || []) if (w.ready(b.px, b.pz)) out.bars.push(+(b.py - w.heightAt(b.px, b.pz)).toFixed(2));
  return out;
});
const worst = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
let bad = 0;
const check = (ok, text) => { if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`); };

const first = await measure();
check(worst(first.bales) < 0.05, `first visit: bales off the ground by at most ${worst(first.bales)} m (${first.bales.length} bales)`);
check(worst(first.bars) < 0.05, `first visit: barriers off the ground by at most ${worst(first.bars)} m (${first.bars.length})`);

// twice: as the game does it (a bale's own place keeps its height), and with those kept heights forgotten, so
// the bales and barriers have to be put down again as the ground arrives
for (const forget of [false, true]) {
  const tag = forget ? 'kept heights forgotten, back at the start' : 'back at the start';
  // away to the far side of town until the park's ground is let go
  const home = await page.evaluate(() => { const s = __game.stage().bales.bales[0].home; return [s.x, s.z]; });
  await page.evaluate(async ([x, z]) => { await __game.world.loadAround(x - 4500, z + 2500, 200); __game.place({ x: x - 4500, z: z + 2500, yaw: 0 }); }, home);
  await page.waitForFunction(() => { const b = __game.stage().bales.bales; return b.every((q) => !__game.world.ready(q.x, q.z)); }, null, { timeout: 120000, polling: 500 }).catch(() => console.log('(the park\'s ground was not let go)'));
  if (forget) await page.evaluate(() => { const st = __game.stage(); for (const b of st.bales.bales) delete b.home.y; for (const b of st.barriers) delete b.py; });
  // back by the start button: measured when the lights go green (nobody drives before) and again later
  await page.evaluate(() => __game.stage().goStart());
  await page.waitForFunction(() => __game.stage().phase === 'run', null, { timeout: 120000, polling: 100 });
  const back = await measure();
  check(worst(back.bales) < 0.05, `${tag}, at green (the ground there under ${back.ready} of ${back.n} bales): bales off the ground by at most ${worst(back.bales)} m; sunk over 0.3 m: ${back.bales.filter((v) => v < -0.3).length}, up over 0.3 m: ${back.bales.filter((v) => v > 0.3).length}`);
  check(worst(back.bars) < 0.05, `${tag}, at green: barriers off the ground by at most ${worst(back.bars)} m`);
  // (and with the ground under all of them, a moment for the next frames to put them down)
  await page.waitForFunction(() => __game.stage().bales.bales.every((q) => __game.world.ready(q.x, q.z)), null, { timeout: 60000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(1500);
  const later = await measure();
  check(later.ready === later.n && worst(later.bales) < 0.05, `${tag}, the ground there under ${later.ready} of ${later.n}: bales off the ground by at most ${worst(later.bales)} m`);
  check(worst(later.bars) < 0.05, `${tag}, then: barriers off the ground by at most ${worst(later.bars)} m (${later.bars.length})`);
}
await browser.close();
process.exit(bad ? 1 : 0);
