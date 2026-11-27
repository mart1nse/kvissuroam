// The options' sections fold open and shut by their titles, only the titles at first, and which were open is remembered
// over a reload (Martin 2026-11-27). Desktop has KEYBOARD first (every key, src/keylist.js; WASD and ?drag=1 change it),
// then SOUND, GRAPHICS and CONTROLS; phones (844x390, 800x304) SOUND and GRAPHICS only, and the shut panel fits the screen.
// Needs the vite dev server: node tools/options-sections-test.mjs [base] [shotdir]   (about 4 minutes)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5198';
const shots = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
const pass = (m) => console.log('  ok', m);

async function load(p, q = '') {
  await p.goto(`${base}/?drive&nointro${q}`);
  await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-act="options"]').click());
  await p.waitForTimeout(300);
}
// the sections as the player sees them: title shown or not, body shown or not
const state = (p) => p.evaluate(() => [...document.querySelectorAll('#options .optsec')].map((s) => ({
  sec: s.dataset.sec,
  title: s.querySelector('.opthead').getClientRects().length > 0,
  body: s.querySelector('.optbody').getClientRects().length > 0,
})));
async function tapTitle(p, sec, phone) {
  // (with KEYBOARD open the titles under it are further down the panel, which scrolls: bring the title into view first)
  await p.evaluate((k) => document.querySelector(`#options [data-sec="${k}"] .opthead`)?.scrollIntoView({ block: 'nearest' }), sec);
  const r = await p.locator(`#options [data-sec="${sec}"] .opthead`).boundingBox();
  if (!r) return fail(`no ${sec} title to tap`);
  if (phone) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await p.waitForTimeout(300);
}
const keyText = (p) => p.evaluate(() => document.getElementById('opt-keylist').innerText);

// ---- desktop
{
  console.log('desktop');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail('page error ' + e.message));
  await load(p);
  let s = await state(p);
  if (s.map((x) => x.sec).join() !== 'keys,sound,gfx,controls') fail('sections ' + s.map((x) => x.sec).join());
  if (s.every((x) => x.title && !x.body)) pass('four titles, KEYBOARD first, all shut at first'); else fail('first look ' + JSON.stringify(s));
  if (shots) await p.screenshot({ path: `${shots}/desktop-shut.png` });
  await tapTitle(p, 'keys');
  await tapTitle(p, 'sound');
  s = await state(p);
  if (s.find((x) => x.sec === 'keys').body && s.find((x) => x.sec === 'sound').body && !s.find((x) => x.sec === 'gfx').body) pass('a title opens its own section only'); else fail('after opening ' + JSON.stringify(s));
  if (!(await p.evaluate(() => !document.getElementById('options').classList.contains('hidden')))) fail('a title tap closed the panel');
  let t = await keyText(p);
  const want = ['DRIVING', 'Space', 'handbrake', 'A', 'Z', 'CAMERA', 'drone', '5', '6', 'Home', 'R', 'H', 'Esc', 'IN THE GARAGE', 'WATCHING A PLAYER', 'the race button'];
  const missing = want.filter((w) => !t.includes(w));
  if (missing.length) fail('key list lacks ' + missing.join(', ')); else pass('key list has the driving, camera, places, screens, race, garage and watching keys');
  if (/DRAG STRIP|THIS CAR|kickflip/.test(t)) fail('drag or thruster keys listed without ?drag=1 or such a car'); else pass('no drag or thruster keys for this car');
  if (shots) await p.screenshot({ path: `${shots}/desktop-keys.png` });
  await tapTitle(p, 'sound');
  // WASD changes the driving keys
  await tapTitle(p, 'controls');
  await p.locator('#opt-keys [data-keys="wasd"]').click({ force: true, timeout: 5000 }).catch(() => p.evaluate(() => document.querySelector('#opt-keys [data-keys="wasd"]').click()));
  await p.waitForTimeout(300);
  t = await keyText(p);
  if (/W\s*↑/.test(t) && /automatic gearbox/.test(t) && !/one gear up/.test(t)) pass('WASD: W / S / A / D in the list, no A / Z gears'); else fail('WASD list ' + t.slice(0, 200));
  await p.evaluate(() => document.querySelector('#opt-keys [data-keys="az"]').click());
  // remembered over a reload: KEYBOARD and CONTROLS open, the others shut
  await load(p);
  s = await state(p);
  const open = s.filter((x) => x.body).map((x) => x.sec).join();
  if (open === 'keys,controls') pass('open sections remembered over a reload'); else fail('after reload open: ' + open);
  await ctx.close();
}
// ---- the drag strip's keys under ?drag=1
{
  console.log('desktop ?drag=1');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('kvissuroam.optopen', 'keys'); } catch {} });
  await load(p, '&drag=1');
  const t = await keyText(p);
  if (/DRAG STRIP/.test(t) && /practice/.test(t) && /Backspace/.test(t)) pass('DRAG STRIP keys listed'); else fail('drag list ' + t.slice(-300));
  await ctx.close();
}
// ---- phones
for (const [name, vp] of [['phone844', { width: 844, height: 390 }], ['phone800', { width: 800, height: 304 }]]) {
  console.log(name);
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail('page error ' + e.message));
  await load(p);
  let s = await state(p);
  const titles = s.filter((x) => x.title).map((x) => x.sec).join();
  if (titles === 'sound,gfx' && s.every((x) => !x.body)) pass('SOUND and GRAPHICS titles only, shut'); else fail('phone first look ' + JSON.stringify(s));
  const fits = await p.evaluate(() => { const r = document.getElementById('options').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; });
  if (fits) pass('shut panel fits the screen'); else fail('shut panel does not fit');
  if (shots) await p.screenshot({ path: `${shots}/${name}-shut.png` });
  await tapTitle(p, 'gfx', true);
  s = await state(p);
  if (s.find((x) => x.sec === 'gfx').body) pass('a tap on GRAPHICS opens it'); else fail('GRAPHICS did not open');
  const scrolls = await p.evaluate(() => { const o = document.getElementById('options'); return o.scrollHeight <= o.clientHeight + 1 || getComputedStyle(o).overflowY === 'auto'; });
  if (!scrolls) fail('open panel taller than the screen and not scrolling');
  if (shots) await p.screenshot({ path: `${shots}/${name}-gfx.png` });
  await tapTitle(p, 'gfx', true);
  s = await state(p);
  if (!s.find((x) => x.sec === 'gfx').body) pass('a second tap shuts it'); else fail('GRAPHICS did not shut');
  await ctx.close();
}
await b.close();
console.log(ok ? 'PASS' : 'FAILED');
process.exit(ok ? 0 : 1);
