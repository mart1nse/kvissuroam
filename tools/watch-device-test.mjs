// The mark of what a watched player drives with, after their car in the WATCHING bar (Martin 27 Nov: "add the same
// controller icon that was added to replays also to watching text"; flags 1024-4096 of a car's position,
// multiplayer.js INP_KINDS, shown by src/spectate.js). Three browsers in one lobby: A (desktop) watches B (a desktop,
// keyboard) and then C (a touch screen); the bar shows a keyboard and then a touch screen mark with their names, and
// a position from a page from before this (no such flags) shows none. Needs the game and its server on :8787
// (npx wrangler dev --port 8787) and Playwright. Usage: node tools/watch-device-test.mjs [picture dir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = process.argv[2] || '';
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
let bad = 0;
const ok = (cond, what) => { console.log(cond ? 'ok  ' : 'FAIL', what); if (!cond) bad++; };
const browser = await chromium.launch({ args });
const open = async (car, name, touch = false) => {
  const ctx = await browser.newContext(touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: dir ? 2 : 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => ok(false, `no page error (${name}): ${e.message}`));
  await p.addInitScript((n) => { localStorage.setItem('kvissuroam.name', n); }, name);
  await p.goto('http://localhost:8787/?q=low&trees=old&lite=1', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return p;
};
const A = await open('w201', 'Watcher'), B = await open('m3', 'Driver'), C = await open('golf', 'Phone', true);
const idOf = (n) => A.evaluate((name) => __game.mp().roster().find((r) => r.name === name)?.id, n);
await A.waitForFunction(() => __game.mp().roster().filter((r) => r.name === 'Driver' || r.name === 'Phone').length === 2, null, { timeout: 60000 });
const bar = () => A.evaluate(() => ({ title: document.querySelector('#watch .who .dev svg title')?.textContent || '', who: document.querySelector('#watch .who')?.textContent }));
for (const [n, want] of [['Driver', 'DRIVING WITH A KEYBOARD'], ['Phone', 'DRIVING WITH A TOUCH SCREEN']]) {
  const id = await idOf(n);
  await A.evaluate((i) => __game.watch().start(i), id);
  await A.waitForFunction(() => __game.watch().view, null, { timeout: 120000 });
  await A.waitForTimeout(1500);
  const got = await bar();
  ok(got.title === want, `watching ${n}: "${want}" (${JSON.stringify(got)})`);
  if (dir && n === 'Driver') {
    await A.evaluate(() => { const r = __game.renderer; r.realRender(__game.scene, __game.camera); });
    const b = await A.locator('#watch').boundingBox();
    await A.screenshot({ path: `${dir}/watch-device-bar.png`, clip: { x: 0, y: Math.max(0, b.y - 10), width: 1280, height: Math.min(140, b.height + 20) } });
  }
}
// a page from before this sends no such flags: C's position as it would be from such a page shows no mark
const id = await idOf('Phone');
await A.evaluate((i) => { const o = __game.mp().remote(i); const keep = o.pose; Object.defineProperty(o, 'pose', { configurable: true, get: () => keep && keep.map((v, k) => (k === 20 ? v & 1023 : v)), set: () => {} }); }, id);
await A.waitForTimeout(1500);
const old = await bar();
ok(old.title === '', `a position without the flags: no mark (${JSON.stringify(old)})`);
await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
