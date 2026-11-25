// Big map online list (Martin, 2026-11-25): the first click on a name centres the map on that car, a second
// click on the same name closes the map and watches it; a click on another name only centres; on your own
// line, while watching, a second click takes you back. Needs the game and server on :8787
// (npx wrangler dev --port 8787). Usage: node tools/map-watch-test.mjs [picture dir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const dir = process.argv[2] || '.';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car, name, vp = { width: 1280, height: 720 }, touch = false) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: vp, hasTouch: touch, isMobile: touch });
  p.on('pageerror', (e) => console.log('PAGEERR', name, e.message));
  await p.addInitScript((n) => { localStorage.setItem('kvissuroam.name', n); }, name);
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
  return [b, p];
};
const place = (p, i) => p.evaluate(([x, z, a, b]) => __game.place({ x, z, yaw: Math.atan2(a - x, -(b - z)) }), [P[i][0], P[i][1], P[i + 3][0], P[i + 3][1]]);
const ok = (cond, what) => { console.log(cond ? 'PASS' : 'FAIL', what); if (!cond) process.exitCode = 1; };
const st = (p) => p.evaluate(() => ({ watching: __game.watch()?.id || null, map: __game.bigmap().isOpen,
  rows: [...document.querySelectorAll('#roster li')].map((l) => l.className + '|' + l.textContent) }));
const row = (name) => `#roster li:has-text("${name}")`;

const [ba, A] = await open('w201', 'Watcher');
const [bb, B] = await open('m3', 'Driver');
const [bc, C] = await open('f40', 'Third');
await place(A, 100); await place(B, 1500); await place(C, 800);
await A.waitForTimeout(5000);
await A.evaluate(() => __game.openMap());
await A.waitForFunction(() => [...document.querySelectorAll('#roster li')].filter((l) => !l.classList.contains('idle')).length >= 3, null, { timeout: 60000 });
await A.waitForTimeout(800);
await A.click(row('Driver'));
await A.waitForTimeout(500);
let s = await st(A);
ok(s.map && !s.watching, 'first click: map stays open, not watching');
ok(s.rows.some((r) => /sel/.test(r) && /Driver.*CLICK AGAIN TO WATCH/.test(r)), 'picked row says CLICK AGAIN TO WATCH');
await A.screenshot({ path: `${dir}/map-watch-picked.png` });
await A.click(row('Third'));
await A.waitForTimeout(500);
s = await st(A);
ok(s.map && !s.watching && s.rows.some((r) => /sel/.test(r) && /Third/.test(r)) && !s.rows.some((r) => /sel/.test(r) && /Driver/.test(r)), 'another name: only centres, the pick moves');
await A.click(row('Third'));
await A.waitForTimeout(1500);
s = await st(A);
const cId = await C.evaluate(() => __game.mp().id);
ok(!s.map && s.watching === cId, 'second click on the same name: map closed, watching Third');
// own line: back
await A.evaluate(() => __game.openMap());
await A.waitForSelector('#roster li.me');
await A.click('#roster li.me'); await A.waitForTimeout(400);
s = await st(A);
ok(s.watching === cId && s.rows.some((r) => /me.*sel/.test(r) && /CLICK AGAIN TO DRIVE/.test(r)), 'own line once: still watching, says CLICK AGAIN TO DRIVE');
await A.click('#roster li.me'); await A.waitForTimeout(800);
s = await st(A);
ok(!s.watching && !s.map, 'own line twice: back in own car, map closed');
// reopened map: no pick left over
await A.evaluate(() => __game.openMap()); await A.waitForTimeout(400);
s = await st(A);
ok(!s.rows.some((r) => /sel/.test(r)), 'reopened map: nothing picked');
// phones: a second tap only centres (no watching on phones)
for (const vp of [{ width: 844, height: 390 }, { width: 800, height: 304 }]) {
  const [bp, Ph] = await open('w201', 'Phone', vp, true);
  await place(Ph, 300); await Ph.waitForTimeout(4000);
  await Ph.evaluate(() => __game.openMap());
  await Ph.waitForSelector(row('Driver'));
  await Ph.tap(row('Driver')); await Ph.waitForTimeout(300); await Ph.tap(row('Driver')); await Ph.waitForTimeout(800);
  s = await st(Ph);
  ok(s.map && !s.watching && !s.rows.some((r) => /CLICK AGAIN/.test(r)), `phone ${vp.width}x${vp.height}: second tap only centres, no hint`);
  await Ph.screenshot({ path: `${dir}/map-watch-phone-${vp.width}.png` });
  await bp.close();
}
await Promise.all([ba.close(), bb.close(), bc.close()]);
