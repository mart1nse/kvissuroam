// A tap or click outside the open OPTIONS panel closes it and does nothing else (Martin 2026-11-23): not the
// gas pedal, not the MAP or GARAGE button under it. A tap inside the panel keeps it open, the OPTIONS button
// still toggles it, and once it is shut the pedals and buttons work again. Desktop, 844x390 and 800x304 phones.
// Needs the vite dev server: node tools/options-outside-tap.mjs [base] [shotdir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const shots = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
async function run(name, vp, phone) {
  console.log(name);
  const ctx = await b.newContext(phone ? { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: vp });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail('page error ' + e.message));
  await p.goto(`${base}/?drive&nointro`);
  await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
  await p.waitForTimeout(4000);
  const open = () => p.evaluate(() => !document.getElementById('options').classList.contains('hidden'));
  const show = () => p.evaluate(() => document.querySelector('[data-act="options"]').click());
  const box = async (sel) => { const r = await p.locator(sel).first().boundingBox(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const tap = async (pt) => { if (phone) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300); };
  const mapOpen = () => p.evaluate(() => !document.getElementById('bigmap')?.classList.contains('hidden') && !!document.querySelector('#bigmap:not(.hidden)'));
  await show(); await p.waitForTimeout(300);
  if (!(await open())) fail('options did not open');
  if (shots) await p.screenshot({ path: `${shots}/${name}-open.png` });
  // inside the panel: a choice keeps it open
  // (the sections start shut, Martin 2026-11-27: a tap on a title opens one and keeps the panel open)
  await tap(await box('#options .opthead')); if (!(await open())) fail('tap inside closed the panel');
  await tap(await box('#opt-sound button')); if (!(await open())) fail('tap on a choice closed the panel');
  // empty spot on the 3D view, left middle
  await tap({ x: vp.width * 0.3, y: vp.height * 0.45 });
  if (await open()) fail('tap on the view did not close'); else console.log('  view tap closes');
  // over the MAP button: closes, map stays shut
  await show(); await p.waitForTimeout(200);
  await tap(await box('[data-act="map"]'));
  if (await open()) fail('tap on MAP did not close');
  if (await mapOpen()) fail('tap on MAP also opened the map'); else console.log('  MAP tap closes only');
  // the OPTIONS button still toggles
  if (!phone) { await show(); await p.waitForTimeout(200); await tap(await box('[data-act="options"]')); if (await open()) fail('OPTIONS button did not close'); else console.log('  OPTIONS button toggles'); }
  if (phone) {
    // the steering pad (hidden under the open panel) held: closes, no steering
    await show(); await p.waitForTimeout(200);
    const g = await box('[data-ctl="left"]');
    if (!g) { fail('no pedal'); } else {
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.x, y: g.y, id: 1 }] });
      await p.waitForTimeout(400);
      const gas = await p.evaluate(() => document.querySelector('[data-ctl="left"]').classList.contains('held'));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(200);
      if (await open()) fail('pedal tap did not close');
      if (gas) fail('pedal took the closing tap as steering'); else console.log('  pedal tap closes, no steering');
      // and afterwards the pedal works
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.x, y: g.y, id: 2 }] });
      await p.waitForTimeout(300);
      const gas2 = await p.evaluate(() => document.querySelector('[data-ctl="left"]').classList.contains('held'));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (!gas2) fail('pedal dead after closing'); else console.log('  pedal works after');
    }
  }
  // a button works right after the panel shut
  await p.waitForTimeout(200);
  await tap(await box('[data-act="map"]'));
  if (!(await mapOpen())) fail('MAP did not open after the panel was shut'); else console.log('  MAP works after');
  await ctx.close();
}
await run('desktop', { width: 1280, height: 720 }, false);
await run('phone844', { width: 844, height: 390 }, true);
await run('phone800', { width: 800, height: 304 }, true);
await b.close();
console.log(ok ? 'PASS' : 'FAILED');
process.exit(ok ? 0 : 1);
