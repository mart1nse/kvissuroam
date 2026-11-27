// NICE CUT! between the two trees on the lawn at the start of Baeri (src/race/nicecut.js): driven through them on
// free drive nothing shows, on a hotlap the sign shows and the lap carries on, and the wrong way round nothing shows.
// Needs the dev server on :5198 (npx vite --port 5198) and Playwright.
// Usage: node tools/nicecut-test.mjs [folder for pictures] [phone]   (phone: 844x390 with touch)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const dir = process.argv[2] || '.', phone = process.argv[3] === 'phone';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1000, height: 600 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:5198/?q=low');
await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
await p.evaluate(() => { __game.setCar('enyaq', true); __game.startDriving(); });
await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
const N = P.length;
const at = (i, side = 0) => {
  const a = P[(i + N) % N], c = P[(i + 1 + N) % N];
  const tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz), ux = tx / l, uz = tz / l;
  return { x: a[0] - uz * side, z: a[1] + ux * side, yaw: Math.atan2(ux, -uz) };
};
const key = (type, code) => p.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), [type, code]);
const shown = () => p.evaluate(() => { const e = document.querySelector('#nicecut'); return !!e && !e.classList.contains('hidden'); });
const state = () => p.evaluate(() => ({ x: +__game.car.x.toFixed(1), z: +__game.car.z.toFixed(1), lap: __game.race().running }));
// put the car on the lawn east of the gap facing west (or the other way) and drive through
const through = async (back = false) => {
  const pose = back ? { x: 1004, z: 3026, yaw: Math.atan2(0.98, -0.2) } : { x: 1024, z: 3030, yaw: Math.atan2(-0.98, 0.19) };
  await p.evaluate((q) => { __game.place(q); __game.race().hopped(q.x, q.z); }, pose);
  await p.waitForFunction(() => __game.world.ready(__game.car.x, __game.car.z), null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await key('keydown', 'ArrowUp');
  let seen = false;
  for (let k = 0; k < 80 && !seen; k++) { await p.waitForTimeout(100); seen = await shown(); }
  await p.waitForTimeout(500);
  await key('keyup', 'ArrowUp');
  if (process.env.DEBUG) console.log('  through', back ? 'back' : '', JSON.stringify(await state()), seen);
  return seen;
};
let fail = 0;
const ok = (c, what) => { console.log(c ? 'ok  ' : 'FAIL', what); if (!c) fail++; };

ok(!(await through()), 'free drive through the gap: no sign');
// a hotlap: over the line, then along the lap in short hops (every gate in order) to the bend before the gap
await p.evaluate((q) => __game.place(q), at(N - 12));
await p.waitForFunction(() => __game.world.ready(__game.car.x, __game.car.z), null, { timeout: 120000 });
await p.waitForTimeout(1500);
await key('keydown', 'ArrowUp');
await p.waitForFunction(() => __game.race().running, null, { timeout: 30000 });
await key('keyup', 'ArrowUp');
for (let i = 10; i <= 318; i += 6) { await p.evaluate((q) => { __game.place(q); }, at(i)); await p.waitForTimeout(120); }
console.log('on the lap at i 318:', JSON.stringify(await state()));
ok(await through(), 'hotlap through the gap: NICE CUT! shows');
// (for the picture: the sign as it stands in its first seconds; the slow test browser takes long over a frame)
await p.evaluate(() => { const e = document.querySelector('#nicecut'); e.classList.remove('go', 'hidden'); void e.offsetWidth; e.classList.add('go'); });
await p.waitForTimeout(600);
await p.screenshot({ path: `${dir}/nicecut-${phone ? 'phone' : 'desktop'}.png` });
const st = await state();
ok(st.lap, `the lap still runs after the cut ${JSON.stringify(st)}`);
await p.waitForTimeout(4500);
ok(!(await shown()), 'gone after 3.8 s');
ok(!(await through(true)), 'the wrong way through the gap: no sign');
await b.close();
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
