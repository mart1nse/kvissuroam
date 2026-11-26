// A car left standing with nobody at the controls goes back to the garage (src/idlepark.js; Martin 25 Nov: buses
// parked across the entrances and left there). With ?idle=6 the countdown comes after 6 s and lasts 5 s.
// Checks, on a desktop and on a landscape phone: the countdown shows and the garage follows with its note; a key,
// a mouse move or a touch calls the countdown off; a held key keeps it away; a car that is moved about with nobody
// at its controls (shoved by others, rolling down a slope) is still sent; DRIVE puts the car back where it stood.
// Then the room on the server (Martin 26 Nov; ?idle=6&room=1 takes the server's word, here a stand-in for the
// server that says what the test wants): with room a car stands as long as it likes, the server turning tight
// brings the countdown within 3 s more (each car at a moment of its own), room again calls it off, and a bus is
// judged whatever the server says. (The server's half: tools/idle-room-test.mjs.)
// And the limits with room (Martin 26 Nov): a car standing ?loose= goes to the garage, nobody there for ?rest= puts
// the page offline (from the garage and from a hidden tab) until somebody is back.
// Run with the dev server on 5198: node tools/idle-park-test.mjs [folder for pictures]   (`room`, `rest`: only that part)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:5198', shots = process.argv.slice(2).find((a) => a !== 'room' && a !== 'rest') || '';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
const state = (p) => p.evaluate(() => ({ mode: __game.mode, toast: document.querySelector('#toast.show')?.textContent || '', note: !document.querySelector('#idlenote').classList.contains('hidden'), x: __game.car.x, z: __game.car.z }));
const until = (p, fn, ms) => p.waitForFunction(fn, null, { timeout: ms, polling: 100 }).then(() => true, () => false);
const counting = () => /^IDLE · BACK TO GARAGE IN \d+$/.test(document.querySelector('#toast.show')?.textContent || '');

async function run(name, opts, touch) {
  console.log(name);
  const ctx = await browser.newContext({ deviceScaleFactor: shots ? 2 : 1, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`page error: ${e.message}`));
  await p.goto(`${base}/?idle=6&off=100&q=low&trees=old`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
  // (drawing without a graphics card takes seconds a frame: only the frames a picture needs are drawn)
  await p.evaluate(() => { const r = __game.renderer, real = r.render.bind(r); window.__draw = 0; r.render = (...a) => { if (window.__draw > 0) { window.__draw--; real(...a); } }; });
  const shot = async (f, ready) => {
    if (!shots) return;
    await p.evaluate(() => { window.__draw = 2; });
    await until(p, () => window.__draw === 0, 120000);
    if (ready) await until(p, ready, 5000);
    await p.screenshot({ path: `${shots}/idle-${name}-${f}.png`, timeout: 120000 });
  };
  await p.waitForTimeout(8000);
  let s = await state(p);
  if (s.mode !== 'menu' || s.toast) fail(`the menu was judged: ${JSON.stringify(s)}`);
  await p.evaluate(() => __game.startDriving());
  await until(p, () => __game.mode === 'drive', 60000);
  // 1. nobody there: the countdown, then the garage with its note
  if (!(await until(p, counting, 12000))) fail('no countdown');
  s = await state(p);
  console.log(`  countdown: "${s.toast}"`);
  await shot('countdown', counting);
  // 2. somebody is back: called off at once
  if (touch) await p.touchscreen.tap(opts.viewport.width / 2, opts.viewport.height / 2); else await p.mouse.move(300, 300);
  await p.waitForTimeout(300);
  s = await state(p);
  if (s.toast || s.mode !== 'drive') fail(`${touch ? 'a touch' : 'a mouse move'} did not call it off: ${JSON.stringify(s)}`);
  if (!touch) {
    if (!(await until(p, counting, 12000))) fail('no second countdown');
    await p.keyboard.press('KeyB');
    await p.waitForTimeout(300);
    s = await state(p);
    if (s.toast || s.mode !== 'drive') fail(`a key did not call it off: ${JSON.stringify(s)}`);
    // 3. a held key (the handbrake: the car stands) for longer than the whole wait
    await p.keyboard.down('Space');
    await p.waitForTimeout(13000);
    s = await state(p);
    if (s.toast || s.mode !== 'drive') fail(`a held key was taken for nobody there: ${JSON.stringify(s)}`);
    await p.keyboard.up('Space');
    // 4. shoved about with nobody at the controls (as a bus left on the race road is): still the countdown
    await p.evaluate(() => { const c = __game.car, x = c.x, z = c.z, t0 = performance.now(); window.__seen = ''; (function tick() { const t = (performance.now() - t0) / 1000; window.__seen ||= document.querySelector('#toast.show')?.textContent || ''; if (window.__seen || t > 13) { __game.place({ x, z, yaw: c.yaw }); window.__moved = true; return; } requestAnimationFrame(tick); __game.place({ x: x + Math.sin(t) * 6, z, yaw: c.yaw }); })(); });
    await until(p, () => window.__moved, 20000);
    const seen = await p.evaluate(() => window.__seen);
    if (!seen.startsWith('IDLE')) fail('a car shoved about was taken for a driven one');
  }
  // 5. left alone again: the garage
  const t0 = Date.now();
  if (!(await until(p, () => __game.mode === 'menu', 20000))) fail('not sent to the garage');
  await p.waitForTimeout(400);
  s = await state(p);
  console.log(`  garage after ${((Date.now() - t0) / 1000).toFixed(1)} s alone, note ${s.note ? 'shown' : 'missing'}`);
  if (!s.note) fail('no note in the garage');
  const stood = s;
  await shot('garage');
  // 6. not judged in the garage; DRIVE: back where it stood, the note gone
  await p.waitForTimeout(12000);
  s = await state(p);
  if (s.mode !== 'menu' || s.toast) fail(`judged in the garage: ${JSON.stringify(s)}`);
  await p.evaluate(() => __game.startDriving());
  await p.waitForTimeout(500);
  s = await state(p);
  const d = Math.hypot(s.x - stood.x, s.z - stood.z);
  console.log(`  DRIVE: ${d.toFixed(1)} m from where it stood`);
  if (s.mode !== 'drive' || s.note || d > 2) fail(`DRIVE after the garage: ${JSON.stringify(s)}`);
  await ctx.close();
}

async function room() {
  console.log('room');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`page error: ${e.message}`));
  // the server's stand-in: welcomes the page (room: no `tight`), then says what `say` is given
  let sock = null;
  await p.routeWebSocket(/\/api\/ws/, (ws) => {
    sock = ws;
    ws.onMessage((raw) => { if (raw === 'ping') return ws.send('pong'); let m; try { m = JSON.parse(raw); } catch { return; } if (m.t === 'hello') ws.send(JSON.stringify({ t: 'welcome', id: 'me000001', key: null, players: [], wn: 0 })); });
  });
  const say = (tight) => sock.send(JSON.stringify({ t: 'room', tight }));
  await p.goto(`${base}/?idle=6&room=1&q=low&trees=old`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
  await p.evaluate(() => { const r = __game.renderer; r.render = () => {}; });
  if (!(await until(p, () => __game.mp()?.online, 30000))) fail('not online with the stand-in server');
  await p.evaluate(() => __game.startDriving());
  await until(p, () => __game.mode === 'drive', 60000);
  // every countdown figure seen from here on
  await p.evaluate(() => { window.__idle = 0; setInterval(() => { if (/^IDLE · /.test(document.querySelector('#toast.show')?.textContent || '')) window.__idle++; }, 100); });
  // 1. room: twice the whole wait and nothing
  await p.waitForTimeout(24000);
  let s = await state(p);
  if (s.mode !== 'drive' || (await p.evaluate(() => window.__idle))) fail(`judged with room on the server: ${JSON.stringify(s)}`);
  else console.log('  room on the server: stood 24 s, no countdown');
  // 2. the server turns tight: the countdown within the spread (3 s), from its first figure
  let t0 = Date.now();
  say(1);
  if (!(await until(p, counting, 6000))) fail('tight, and no countdown for a car that had stood its time');
  s = await state(p);
  console.log(`  tight: "${s.toast}" after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!/IN [45]$/.test(s.toast)) fail(`the countdown did not start from its first figure: "${s.toast}"`);
  // 3. room again before it is over: called off, and the car stays
  say(0);
  await p.waitForTimeout(400);
  s = await state(p);
  if (s.toast || s.mode !== 'drive') fail(`room again did not call the countdown off: ${JSON.stringify(s)}`);
  await p.waitForTimeout(9000);
  s = await state(p);
  if (s.mode !== 'drive' || s.toast) fail(`sent to the garage with room on the server: ${JSON.stringify(s)}`);
  else console.log('  room again: called off, the car stays');
  // 4. tight and it stays so: the garage with its note
  t0 = Date.now();
  say(1);
  if (!(await until(p, () => __game.mode === 'menu', 14000))) fail('tight, and not sent to the garage');
  await p.waitForTimeout(400);
  s = await state(p);
  console.log(`  tight: the garage ${((Date.now() - t0) / 1000).toFixed(1)} s later, note ${s.note ? 'shown' : 'missing'}`);
  if (!s.note) fail('no note in the garage');
  // 5. a bus is judged with room too
  say(0);
  await p.evaluate(() => __game.setCar('bus'));
  await until(p, () => __game.car.spec.id === 'bus', 120000);
  await p.evaluate(() => __game.startDriving());
  await until(p, () => __game.mode === 'drive', 60000);
  t0 = Date.now();
  if (!(await until(p, () => __game.mode === 'menu', 20000))) fail('a bus was left standing with room on the server');
  else console.log(`  room on the server, a bus: the garage ${((Date.now() - t0) / 1000).toFixed(1)} s later`);
  // (and a disconnected page told SERVER FULL is as tight: nothing to check in the page beyond the flag)
  await ctx.close();
}

// With room still a limit (Martin 26 Nov, tabs open for days): a car standing `loose` goes to the garage, and with
// nobody there for `rest` the page goes offline, from the garage and from a hidden tab, and is back online the
// moment somebody is. ?loose=50&rest=40 for 20 minutes each (standing longer than the page's own rest, so the
// map is seen not to put it offline).
async function rest() {
  console.log('rest');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`page error: ${e.message}`));
  let opens = 0, closes = 0;
  await p.routeWebSocket(/\/api\/ws/, (ws) => {
    opens++;
    ws.onClose(() => { closes++; });
    ws.onMessage((raw) => { if (raw === 'ping') return ws.send('pong'); let m; try { m = JSON.parse(raw); } catch { return; } if (m.t === 'hello') ws.send(JSON.stringify({ t: 'welcome', id: 'me000001', key: null, players: [], wn: 0 })); });
  });
  await p.goto(`${base}/?idle=6&room=1&loose=50&rest=40&q=low&trees=old`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
  await p.evaluate(() => { const r = __game.renderer; r.render = () => {}; });
  if (!(await until(p, () => __game.mp()?.online, 30000))) fail('not online with the stand-in server');
  await p.evaluate(() => __game.startDriving());
  await until(p, () => __game.mode === 'drive', 60000);
  // 1. room, standing: the garage after 50 s and its countdown, online all the while
  let t0 = Date.now();
  if (!(await until(p, () => __game.mode === 'menu', 65000))) fail('with room, a car stood past the loose limit');
  else console.log(`  room, standing: the garage ${((Date.now() - t0) / 1000).toFixed(1)} s later, still online: ${await p.evaluate(() => !__game.mp().resting)}`);
  if ((Date.now() - t0) / 1000 < 53) fail('with room, sent to the garage before the loose limit and its countdown');
  // 2. not offline while standing on the map (the page opened 40 s and more ago by now), and in the garage with
  // nobody there: offline 40 s after the car was sent there, not sooner (Martin 26 Nov: 20 min, then 20 more)
  const parkedAt = Date.now();
  if (await p.evaluate(() => __game.mp().resting)) fail('offline before the garage\'s own wait');
  await p.waitForTimeout(30000);
  if (await p.evaluate(() => __game.mp().resting)) fail('offline 30 s into the garage, before its 40 s');
  if (!(await until(p, () => __game.mp().resting, 15000)) || !closes) fail(`nobody there, and the page stayed online (socket closed: ${closes})`);
  else console.log(`  nobody there: offline ${((Date.now() - parkedAt) / 1000).toFixed(1)} s after the garage (socket closed: ${closes})`);
  const before = opens;
  await p.waitForTimeout(6000);
  if (opens !== before) fail(`resting, and it asked the server again (${opens - before} times)`);
  // 3. somebody is back (a key): online again at once
  await p.keyboard.press('KeyB');
  if (!(await until(p, () => __game.mp().online && !__game.mp().resting, 5000))) fail('somebody back, and not online again');
  else console.log('  a key: online again');
  // 4. a hidden tab: its time counts, offline, and back when it shows again
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  t0 = Date.now();
  // (a hidden tab runs no frames: only the 30 s look)
  if (!(await until(p, () => __game.mp().resting, 90000))) fail('a hidden tab with nobody there stayed online');
  else console.log(`  hidden tab: offline ${((Date.now() - t0) / 1000).toFixed(1)} s after it was hidden`);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  if (!(await until(p, () => __game.mp().online && !__game.mp().resting, 5000))) fail('the tab shown again, and not online again');
  else console.log('  shown again: online again');
  await ctx.close();
}

if (!process.argv.includes('room') && !process.argv.includes('rest')) {
  await run('desktop', { viewport: { width: 1440, height: 810 } }, false);
  await run('phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, true);
  await run('phone-small', { viewport: { width: 800, height: 304 }, hasTouch: true, isMobile: true }, true);
}
if (!process.argv.includes('rest')) await room();
if (!process.argv.includes('room')) await rest();
await browser.close();
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
