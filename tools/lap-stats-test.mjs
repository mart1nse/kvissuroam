// The Toomemägi lap on /stats (Martin 27 Nov 2026: "the stats has cool majoraadi stage starts etc. can you also give this
// for toomemägi"; and "add hours and km driven").
// 1) The lap boards' summary (worker/lapsum.js) from a Lobby over node:sqlite holding the live site's laps (only read
//    from it): every lap on the board counted, drivers by name whatever the capitals, each car's record, one reading of
//    the table for it and the five best per car, a new lap added. The Stats object asks the lobby for it and sends it
//    with the totals; days=all starts at the first day kept; the new bundle keys are kept and made-up ones dropped.
// 2) With the dev server (npx vite --port 5198): a page with ?stats=1 drives a lap through the lap's own judge, H, R and
//    the garage in laps, and the bundles it sends hold what was driven; /stats is drawn from them with the board, and
//    pictures are taken on a computer and a phone.
//   node tools/lap-stats-test.mjs [base=http://localhost:5198] [laps=laps.json] [out=folder] [browser=0]
import assert from 'node:assert/strict';
import { register, createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const base = arg('base', 'http://localhost:5198'), out = arg('out', null);
if (out) mkdirSync(out, { recursive: true });
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');
const { Stats, addBundle } = await import(root + '/worker/stats.js');

// ---- 1) the server
const laps = arg('laps') ? JSON.parse(readFileSync(arg('laps'), 'utf8')) : await (await fetch('https://www.linnaring.com/api/laps.json')).json();
globalThis.WebSocketRequestResponsePair = class {};
const mkSql = () => {
  const db = new DatabaseSync(':memory:'), seen = [];
  const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
  return { seen, exec: (q, ...a) => { seen.push(q); const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
};
const sql = mkSql();
const ctxDO = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => [], getWebSocketAutoResponseTimestamp: () => new Date(), waitUntil() {} };
const L = new Lobby(ctxDO, { STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true), addRace: () => Promise.resolve() }) } });
for (const l of laps) {
  sql.exec('INSERT INTO laps (id, track, name, car, ms, at, day, splits, cp, inp, ty, pen, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ...[l.id, l.track, l.name, l.car, l.ms, l.at, l.day, l.splits, l.cp, l.inp, l.ty, l.pen, l.hold].map((v) => v ?? null));
}
sql.exec("DELETE FROM meta WHERE k = 'board'");
L.cache = null;

// what the summary must say, worked out here from the laps themselves
const want = {};
for (const l of laps) {
  if (l.hold != null) continue;
  const T = (want[l.track] ||= { laps: 0, names: new Set(), first: l.at, pen: 0, inp: {}, cars: {} });
  T.laps++; T.names.add(l.name.toLowerCase()); if (l.at < T.first) T.first = l.at; if (l.pen) T.pen++;
  T.inp[l.inp || 'kb'] = (T.inp[l.inp || 'kb'] || 0) + 1;
  const c = (T.cars[l.car] ||= { laps: 0, names: new Set(), pen: 0, ms: Infinity, at: '' });
  c.laps++; c.names.add(l.name.toLowerCase()); if (l.pen) c.pen++;
  if (l.ms < c.ms || (l.ms === c.ms && l.at < c.at)) Object.assign(c, { ms: l.ms, name: l.name, at: l.at });
}
const reads0 = sql.seen.length;
L.topsNow();
const sum = L.lapSummary();
const fullReads = sql.seen.slice(reads0).filter((q) => /FROM laps WHERE hold IS NULL$/.test(q.trim())).length;
assert.equal(fullReads, 1, 'one reading of the whole table for the five best and the summary');
assert.ok(want.toomemagi && sum.toomemagi, 'Toomemägi laps on the board');
for (const [t, W] of Object.entries(want)) {
  const S = sum[t];
  assert.equal(S.laps, W.laps, `${t}: every lap on the board`);
  assert.equal(S.drivers, W.names.size, `${t}: drivers`);
  assert.equal(S.first, W.first, `${t}: since`);
  assert.equal(S.pen, W.pen, `${t}: with penalty seconds`);
  assert.deepEqual(S.inp, W.inp, `${t}: controls`);
  for (const [car, c] of Object.entries(W.cars)) {
    assert.deepEqual(S.cars[car], { laps: c.laps, drivers: c.names.size, pen: c.pen, ms: c.ms, name: c.name }, `${t} ${car}`);
  }
  assert.equal(Object.keys(S.cars).length, Object.keys(W.cars).length);
}
// the board's own count agrees
assert.equal(L.board().laps, sum.toomemagi.laps, 'the same number as the lap board');
console.log('board summary', JSON.stringify({ laps: sum.toomemagi.laps, drivers: sum.toomemagi.drivers, first: sum.toomemagi.first, raadi: sum.raadi && sum.raadi.laps }));

// a new lap goes on the board: counted (once the minute's answer is up), a new driver, a new record for its car
const realNow = Date.now;
const car = 'w201', rec = sum.toomemagi.cars[car].ms - 1000;
L.addToBoard({ track: 'toomemagi', name: 'Lap Stats Test', car, ms: rec, at: new Date().toISOString(), day: L.board().day, inp: 'wheel' });
assert.equal(L.lapSummary().toomemagi.laps, sum.toomemagi.laps, 'kept a minute');
Date.now = () => realNow() + 61000;
const s2 = L.lapSummary().toomemagi;
Date.now = realNow;
assert.equal(s2.laps, sum.toomemagi.laps + 1);
assert.equal(s2.drivers, sum.toomemagi.drivers + 1);
assert.deepEqual([s2.cars[car].ms, s2.cars[car].name], [rec, 'Lap Stats Test']);
assert.equal(s2.inp.wheel, (sum.toomemagi.inp.wheel || 0) + 1);
// laps taken off the board: the summary is made again from the table
L.cache = L.rebuildBoard();
assert.equal(L.lapSummary().toomemagi.laps, sum.toomemagi.laps, 'made again from the table (the test lap was never stored)');

// the stats object: bundles over three days, then the answers
const SQ = mkSql();
let asked = 0;
const S = new Stats({ storage: { sql: SQ } }, { LOBBY: { idFromName: () => 1, get: () => ({ lapSummary: () => { asked++; return Promise.resolve(L.lapSummary()); } }) } });
const day = (d) => new Date(`2026-11-${d}T10:00:00Z`);
const bundle = (o) => ({ v: 1, ...o });
S.addNow((t) => addBundle(t, bundle({ laps: { start: 10, finish: 2, jump: 5, off: 1 }, lapCar: { impreza: 2 }, quit: { 0: 4, 2: 2 } })), day(20));
S.addNow((t) => addBundle(t, bundle({ laps: { start: 4, finish: 1 }, lapCar: { audi200: 1 } })), day(25));
const today = bundle({
  laps: { start: 6, cp1: 4, finish: 2, jump: 2, 'j:home': 1, 'j:garage': 1, r: 3, crash: 1, 'j:hack': 9 },
  lapCar: { impreza: 2 }, lapTry: { impreza: 3, 'impreza:f': 2, audi200: 1, 'nocar:f': 5, nocar: 2 },
  runT: { lap: 250, race: 60, stage: 90, free: 400 }, runKm: { lap: 7.5, race: 2, stage: 1.6 }, stage: { start: 2, finish: 1 },
});
S.addNow((t) => addBundle(t, today));
const get = async (q) => (await S.fetch(new Request('https://x/api/stats?' + q, { headers: { 'cf-connecting-ip': String(Math.random()) } }))).json();
const all = await get('days=all');
assert.equal(all.all, true);
assert.equal(all.from, '2026-11-20', 'all time starts at the first day kept');
assert.ok(all.days >= 8 && all.days === Math.round((Date.parse(all.to) - Date.parse(all.from)) / 864e5) + 1, `days ${all.days}`);
const T = all.total;
assert.deepEqual([T.laps.start, T.laps.finish, T.laps.jump, T.laps.cp1, T.laps['j:home'], T.laps['j:garage'], T.laps.r, T.laps.crash], [20, 5, 7, 4, 1, 1, 3, 1]);
assert.equal(T.laps['j:hack'], undefined, 'a made-up lap key is dropped');
assert.deepEqual(T.lapTry, { impreza: 3, 'impreza:f': 2, audi200: 1 }, 'tries per car, only cars the game has');
assert.deepEqual(T.runT, { lap: 250, race: 60, stage: 90 }, 'seconds on the clock (free driving is not one)');
assert.deepEqual(T.runKm, { lap: 7.5, race: 2, stage: 1.6 });
assert.deepEqual(all.daily.map((r) => [r.day, r.ls, r.laps]).slice(0, 2), [['2026-11-20', 10, 2], ['2026-11-25', 4, 1]], 'laps started and finished per day');
assert.equal(all.board.toomemagi.laps, sum.toomemagi.laps, 'the board summary comes along');
// (one bundle adds at most so much)
const big = {};
addBundle(big, bundle({ runT: { lap: 1e6 }, runKm: { stage: 1e6 }, lapTry: { impreza: 1e6 } }));
assert.deepEqual([big.runT.lap, big.runKm.stage, big.lapTry.impreza], [400, 60, 40]);
const h24 = await get('hours=24');
assert.equal(h24.board.toomemagi.laps, sum.toomemagi.laps);
assert.equal(h24.visits.reduce((a, r) => a + r.ls, 0), 6, 'laps started hour by hour');
const d7 = await get('days=7');
assert.equal(d7.total.laps.start, 10, 'seven days leave out the 20th');
assert.equal(asked, 1, 'the lobby is asked once a minute, whatever the period');
// a lobby that does not answer: the stats still come, without the board
const S2 = new Stats({ storage: { sql: mkSql() } }, { LOBBY: { idFromName: () => 1, get: () => ({ lapSummary: () => Promise.reject(new Error('down')) }) } });
const origErr = console.error; console.error = () => {};
const r2 = await (await S2.fetch(new Request('https://x/api/stats?days=all', { headers: { 'cf-connecting-ip': '1' } }))).json();
console.error = origErr;
assert.equal(r2.board, null);
console.log('OK: the server side');

// ---- 2) the game and the page
if (arg('browser', '1') === '0') process.exit(0);
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const P = JSON.parse(readFileSync(new URL('../src/race/track.json', import.meta.url))).pts, N = P.length;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 } });
const bundles = [];
await ctx.route('**/api/stats', (r) => {
  if (r.request().method() === 'POST') { try { bundles.push(JSON.parse(r.request().postData())); } catch { /* not ours */ } }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});
await ctx.routeWebSocket('**/api/ws', (ws) => ws.close({ code: 1006 }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message); });
await page.goto(`${base}/?q=low&trees=old&stats=1`, { timeout: 180000 });
await page.waitForFunction(() => window.__game?.race?.(), null, { timeout: 240000 });
await page.evaluate(() => { __game.setCar('impreza', true); __game.startDriving(); });
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
// (a path through the lap's own judge in one go; the real frames leave it alone meanwhile, and the car is left where it ends)
const drive = (from, to) => page.evaluate(({ path }) => {
  const rc = __game.race(), up = rc.update; rc.update = () => {};
  let time = 1000 + performance.now() / 1000;
  for (const [x, z] of path) { time += 0.1; up.call(rc, { x, z, time, vx: 30 }, 'impreza', 'IMPREZA'); }
  rc.update = up;
  const [x, z] = path[path.length - 1], [x0, z0] = path[path.length - 2];
  __game.place({ x, z, yaw: Math.atan2(x - x0, -(z - z0)) }); rc.hopped(x, z);
  return rc.running;
}, { path: Array.from({ length: to - from }, (_, k) => P[(from + k + N) % N]) });
const key = (code) => page.evaluate((c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); }, code);
// a) a whole lap, over the line into the next one: finished, and the next one running
assert.equal(await drive(-30, N + 40), true, 'the next lap runs after the finish');
await page.waitForTimeout(1500);                    // (a second and a half on the clock)
// b) H: back to the lap's start, which ends the running lap
await key('KeyH');
await page.waitForFunction(() => !__game.race().running, null, { timeout: 20000 });
// c) a lap begun again, R in it (it goes on), then the garage
assert.equal(await drive(-30, 400), true);          // (past the first checkpoint, at point 342)
await key('KeyR');
await page.waitForTimeout(1500);
const goesOn = await page.evaluate(() => __game.race().running);
await key('KeyG');
await page.waitForTimeout(800);
await page.evaluate(() => dispatchEvent(new Event('pagehide')));
await page.waitForTimeout(1500);
const t = {};
for (const b of bundles) assert.ok(addBundle(t, b, { hour: 12 }), 'the server takes the bundle');
const Lp = t.laps || {};
console.log('laps', JSON.stringify(Lp), 'tries', JSON.stringify(t.lapTry), 'runT', JSON.stringify(t.runT), 'runKm', JSON.stringify(t.runKm), 'R kept the lap going', goesOn);
assert.equal(Lp.finish, 1, 'one finished');
assert.equal(t.lapCar?.impreza, 1);
assert.ok(Lp.start >= 3, 'three laps started');
assert.ok(Lp.cp1 >= 2, 'two laps past the first checkpoint');
assert.equal(t.lapTry?.['impreza:f'], 1, 'its finish beside its tries');
assert.ok(t.lapTry?.impreza >= 2);
assert.equal(Lp['j:home'], 1, 'H ended one');
assert.equal(Lp['j:garage'], 1, 'the garage the other');
assert.equal(Lp.jump, 2);
assert.equal(Lp.r, 1, 'R in a lap');
assert.ok(goesOn, 'the lap went on after R');
assert.ok(t.runT?.lap > 1, 'seconds on the lap clock');
assert.ok(t.runKm?.lap === undefined || t.runKm.lap >= 0);

// /stats drawn from those totals, with what the live site has kept so far and the board
const live = await (await fetch('https://www.linnaring.com/api/stats?days=90')).json().catch(() => null);
const merged = live ? live.total : {};
for (const k of ['laps', 'lapTry', 'runT', 'runKm', 'lapCar', 'quit']) { merged[k] ||= {}; for (const [kk, v] of Object.entries(t[k] || {})) merged[k][kk] = (merged[k][kk] || 0) + v; }
// (a few made-up hours of driving on the clock, so the page shows them as it will in a day or two)
for (const [k, v] of Object.entries({ lap: 7200, race: 1800, stage: 3600 })) merged.runT[k] = (merged.runT[k] || 0) + v;
for (const [k, v] of Object.entries({ lap: 300, race: 60, stage: 90 })) merged.runKm[k] = (merged.runKm[k] || 0) + v;
const body = { ...(live || { from: '2026-11-20', to: '2026-11-27', heat: 250, names: {}, daily: [] }), days: live ? live.daily.length : 8, all: true, total: merged, daily: (live && live.daily.map((r) => ({ ...r, ls: r.ls ?? Math.round(r.laps * 5.6) }))) || [],
  board: L.lapSummary(), drivers: { n: 0, top: [] } };
const shot = async (name, opts) => {
  const c = await browser.newContext(opts);
  const st = await c.newPage();
  await st.route('**/api/stats?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
  await st.route('**/api/online**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"n":0,"people":[]}' }));
  st.on('pageerror', (e) => { errors.push(`stats: ${e.message}`); console.log('STATS PAGEERR', e.message); });
  await st.goto(`${base}/stats.html#days=all`);
  await st.waitForSelector('.tiles', { timeout: 30000 });
  const text = await st.evaluate(() => document.body.innerText.toUpperCase());
  for (const w of ['Toomemägi lap', 'past the first checkpoint', 'How Toomemägi laps ended', 'START or H', 'to the garage', 'Toomemägi laps per day',
    'Toomemägi laps per car', 'Of those finished', 'Toomemägi lap board, all time', 'Driven with', 'driven on laps', 'driven on runs', 'Majoraadi board, all time', 'All time']) {
    assert.ok(text.includes(w.toUpperCase()), `/stats shows "${w}"`);
  }
  assert.equal(await st.evaluate(() => document.querySelector('.range [aria-pressed="true"]').textContent), 'All time');
  const wide = await st.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(wide <= 0, `${name}: no sideways scroll (${wide} px)`);
  if (out) {
    const top = await st.evaluate(() => { const h = [...document.querySelectorAll('.card h2')].find((e) => /Toomemägi lap$/i.test(e.textContent)); return h.closest('.card').getBoundingClientRect().top + scrollY - 10; });
    const end = await st.evaluate(() => { const h = [...document.querySelectorAll('.card h2')].find((e) => /Majoraadi board/i.test(e.textContent)); const r = h.closest('.card').getBoundingClientRect(); return r.bottom + scrollY + 10; });
    const vw = await st.evaluate(() => innerWidth);
    await st.screenshot({ path: `${out}/stats-laps-${name}.png`, clip: { x: 0, y: top, width: vw, height: end - top }, fullPage: true });
  }
  await c.close();
};
await shot('desktop', { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await shot('phone', { ...devices['iPhone 13'] });
await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('OK: the Toomemägi lap counts reach /stats');
