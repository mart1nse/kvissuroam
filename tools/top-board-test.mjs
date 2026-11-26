// LAP TIMES with each car's five best (board.js, worker/tops.js; Martin 26 Nov 2026) in the real page: the server's
// answers come from a Lobby over node:sqlite holding the live site's laps (only read from it), this browser has a
// few laps of its own. Checks that the picked car's row opens with the board, a click opens and closes a row (in
// both circuits' tables), your place shows after your best, the rows stay as left when the board is shown again,
// and takes pictures on a computer and on phones.
//   npm run build && npx vite preview --port 4173, then node tools/top-board-test.mjs [port=4173] [laps=laps.json] [out=folder]
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
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const port = +arg('port', 4173), out = arg('out', null);
if (out) mkdirSync(out, { recursive: true });
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');

const laps = arg('laps') ? JSON.parse(readFileSync(arg('laps'), 'utf8')) : await (await fetch('https://www.linnaring.com/api/laps.json')).json();
globalThis.WebSocketRequestResponsePair = class {};
const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const ctxDO = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => [], getWebSocketAutoResponseTimestamp: () => new Date(), waitUntil() {} };
const L = new Lobby(ctxDO, { STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true), addRace: () => Promise.resolve() }) } });
for (const l of laps) {
  sql.exec('INSERT INTO laps (id, track, name, car, ms, at, day, splits, cp, inp, ty, pen, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ...[l.id, l.track, l.name, l.car, l.ms, l.at, l.day, l.splits, l.cp, l.inp, l.ty, l.pen, l.hold].map((v) => v ?? null));
}
sql.exec("DELETE FROM meta WHERE k = 'board'");
L.cache = null;

// this browser's own laps (Martin's bests as his board showed them on 26 Nov) and a name on the board
const ME = 'Martin';
const own = { w201: 190000, audi200: 176420, passat: 193030, crv: 195000, enyaq: 179150, rav4: 190630, mazda6: 191140, bz4x: 174000, m3: 171840, impreza: 168060, f40: 168930, cgt: 173850, bus: 293060 };
const at = (d) => `2026-11-${d}T12:00:00.000Z`;
const ownLaps = Object.entries(own).map(([car, ms], i) => ({ ms, car, carShort: car, at: at(17 + (i % 8)), inp: 'kb' }));
const ownRuns = [{ ms: 124120, car: 'impreza', at: at(26), ty: 'gravel', inp: 'kb' }, { ms: 129800, car: 'audi200', at: at(26), ty: 'gravel', inp: 'kb' }];

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const asked = [];
async function open(name, ctxOpts, { raadi = false } = {}) {
  const ctx = await b.newContext(ctxOpts);
  await ctx.addInitScript(([laps, runs, me]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('kvissuroam.laps', JSON.stringify(laps));
    localStorage.setItem('kvissuroam.raadi', JSON.stringify(runs));
    localStorage.setItem('kvissuroam.name', me);
    localStorage.setItem('kvissuroam.car', 'impreza');
    sessionStorage.setItem('seeded', '1');
  }, [ownLaps, ownRuns, ME]);
  await ctx.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/board' || u.pathname === '/api/top') {
      if (u.pathname === '/api/top') asked.push(u.search);
      const res = await L.fetch(new Request(`https://www.linnaring.com${u.pathname}${u.search}`, { headers: { 'cf-connecting-ip': `10.1.${asked.length % 250}.1` } }));
      return r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
    }
    if (u.pathname === '/api/name') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: ME }) });
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not here"}' });
  });
  await ctx.routeWebSocket('**/api/ws', (ws) => ws.close({ code: 1006 }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${port}/?q=low&trees=old&fixedintro&shot=0.3${raadi ? '&raadi=1' : ''}`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.board?.(), null, { timeout: 240000 });
  await p.evaluate(() => __game.board().show());
  await p.waitForFunction(() => document.querySelector('#board tbody.car.open tr.more'), null, { timeout: 20000 });
  await p.waitForTimeout(400);
  return { ctx, p, errors, name };
}
const state = (p) => p.evaluate(() => [...document.querySelectorAll('#board table')].map((t) => [...t.querySelectorAll('tbody.car')].map((g) => `${g.dataset.car}${g.classList.contains('open') ? '+' : ''}${g.classList.contains('nomore') ? '.' : ''}`).join(' ')));
const shot = async (p, file, sel) => {
  if (!out) return;
  if (sel) await p.evaluate((s) => { const bd = document.querySelector('#board'), el = document.querySelector(s); bd.scrollTop = el.getBoundingClientRect().top + bd.scrollTop - 36; }, sel);
  await p.screenshot({ path: `${out}/${file}` });
};

// 1) a computer, Toomemägi only (as live now)
{
  const { ctx, p, errors } = await open('desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  let s = await state(p);
  assert.match(s[0], /impreza\+/, 'the picked car opens with the board');
  assert.equal((s[0].match(/\+/g) || []).length, 1, 'only it');
  const lines = await p.$$eval('#board tbody[data-car="impreza"] tr.more', (t) => t.map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
  assert.equal(lines.length, 4, 'four more lines under it');
  assert.ok(lines.every((l, i) => l.startsWith(String(i + 2))), 'numbered 2 to 5');
  const pills = await p.$$eval('#board em.pl', (e) => e.map((x) => x.textContent));
  assert.ok(pills.length >= 10, `a place after your best (${pills.join(' ')})`);
  // a click on a car opens it (and on a time without a replay too), again closes it; the picked car stays open
  await p.click('#board tbody[data-car="bz4x"] tr.main th');
  s = await state(p);
  assert.match(s[0], /bz4x\+/, 'a click opens a row');
  assert.match(s[0], /impreza\+/, 'the others stay open');
  const plain = await p.$('#board tbody[data-car="m3"] tr.main td.td b:not(.rp)');
  if (plain) { await plain.click(); assert.match((await state(p))[0], /m3\+/, 'a click on a time with no replay opens the row'); await plain.click(); }
  await shot(p, '11-desktop-toomemagi.png');
  await p.click('#board tbody[data-car="bz4x"] tr.main th');
  assert.doesNotMatch((await state(p))[0], /bz4x\+/, 'a second click closes it');
  // shown again: the rows as left, the picked car open
  await p.click('#board tbody[data-car="f40"] tr.main th');
  await p.click('#board .bclose');
  await p.evaluate(() => __game.board().show());
  await p.waitForTimeout(300);
  s = await state(p);
  assert.match(s[0], /f40\+/, 'rows stay as left while the page is open');
  assert.ok(asked.some((q) => q.includes('me=Martin') && q.includes('impreza.168060')), 'asks with your name and your bests');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('desktop:', s[0]);
  await ctx.close();
}
// 2) both circuits (?raadi=1): one click opens the car in both tables
{
  const { ctx, p, errors } = await open('both', { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 }, { raadi: true });
  await p.click('#board .bcol:first-child tbody[data-car="bz4x"] tr.main th');
  const s = await state(p);
  assert.equal(s.length, 2, 'two tables');
  assert.match(s[0], /bz4x\+/, 'opened in the first');
  assert.match(s[1], /impreza\+/, 'the picked car open in the stage table too');
  const side = await p.evaluate(() => { const [a, c] = document.querySelectorAll('#board .bcol'); return a.getBoundingClientRect().top === c.getBoundingClientRect().top; });
  assert.ok(side, 'the two tables side by side at 1600 wide');
  await shot(p, '12-desktop-both-tracks.png');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('both:', s.join(' | '));
  await ctx.close();
}
// 3) phones
for (const [file, dev] of [['13-phone-844x390.png', { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } }], ['14-phone-800x304.png', { ...devices['iPhone 13 landscape'], viewport: { width: 800, height: 304 } }]]) {
  const { ctx, p, errors } = await open(file, dev);
  await p.tap('#board tbody[data-car="bz4x"] tr.main th');
  assert.match((await state(p))[0], /bz4x\+/, 'a tap opens a row');
  const wide = await p.evaluate(() => document.querySelector('#board table').getBoundingClientRect().width <= innerWidth);
  assert.ok(wide, 'the table fits the screen');
  await shot(p, file, 'tbody[data-car="impreza"]');
  assert.deepEqual(errors, [], 'no page errors');
  await ctx.close();
}
await b.close();
console.log('top-board-test: all passed');
