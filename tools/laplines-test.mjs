// Fast Toomemägi laps' drives for the painted racing line (src/race/laplines.js; Martin 27 Nov 2026).
// 1) The server (a Lobby over node:sqlite): a drive is kept only for a lap it has from that ticket, on the board and
//    at most 5 % slower than its car's best, once a lap; its head must be that lap's; GET /api/lines counts and gives
//    the rows back; 410 once there are enough.
// 2) With the dev server (npx vite --port 5198), unless browser=0: a page with ?linelog=1 drives two Toomemägi laps
//    through the lap's own timer against a made-up server, one fast and one slow: only the fast one's drive is sent,
//    once the lap is stored; how long the page was busy packing it.
//    With city=tallinn the page is Tallinn's: both laps' drives go, to Tallinn's lobby.
//   node tools/laplines-test.mjs [base=http://localhost:5198] [browser=0] [city=tallinn]
import assert from 'node:assert/strict';
import { register, createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');
const { pack, unpack, unb64, FIELDS } = await import(root + '/src/race/replay.js');
const { LINES_MAX, lineWorth } = await import(root + '/src/race/laplines.js');

// ---- 1) the server
globalThis.WebSocketRequestResponsePair = class {};
const db = new DatabaseSync(':memory:');
const sql = { exec: (q, ...a) => { const st = db.prepare(q); const rows = /^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), []); return { toArray: () => rows, one: () => rows[0] }; } };
const ctxDO = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => [], getWebSocketAutoResponseTimestamp: () => new Date(), waitUntil() {} };
const L = new Lobby(ctxDO, { STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true), addRace: () => Promise.resolve() }) } });
const at = new Date().toISOString();
const lap = (sid, car, ms, pen = null, hold = null) => sql.exec('INSERT INTO laps (track, name, car, ms, at, day, sid, pen, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 'toomemagi', 'T', car, ms, at, at.slice(0, 10), sid, pen, hold);
const sid = (k) => k.toString(16).padStart(16, '0');
lap(sid(1), 'impreza', 157000);              // the record
lap(sid(2), 'impreza', 164000);              // 4.5 % slower
lap(sid(3), 'impreza', 166000);              // 5.7 % slower
lap(sid(4), 'impreza', 150000, null, 2);     // taken off the board
lap(sid(5), 'audi200', 172000, 5);           // its car's record, 5 s of it a crash
lap(sid(6), 'impreza', 158000, null, null);
sql.exec("INSERT INTO laps (track, name, car, ms, at, day, sid) VALUES ('raadi', 'T', 'impreza', 110000, ?, ?, ?)", at, at.slice(0, 10), sid(7));
const ticket = async (k) => { const t0 = (Date.now() - 5000).toString(36), s = sid(k); return `${t0}.${s}.${await L.sign(`${t0}.${s}`)}`; };
const drive = (ms) => {                                       // a lap's drive as replay.js keeps it
  const n = Math.floor(ms / 100) + 1, data = new Int32Array(n * FIELDS);
  for (let i = 0; i < n; i++) { data[i * FIELDS] = Math.round(1000 * Math.cos(i / 300)); data[i * FIELDS + 1] = Math.round(1000 * Math.sin(i / 300)); data[i * FIELDS + 16] = i % 40 < 3 ? 6 : 0; }
  return { n, ms, data };
};
let ipN = 0;
const post = async (body, ip = `10.0.0.${++ipN}`) => {
  const r = await L.fetch(new Request('https://x/api/line', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }));
  return [r.status, (await r.json()).error || 'ok'];
};
const get = async (q = '') => (await L.fetch(new Request(`https://x/api/lines${q}`, { headers: { 'cf-connecting-ip': 'reader' } }))).json();
const z157 = await pack(drive(157000));
console.log('a lap of 2:37 packed', z157.length, 'characters');
assert.ok(z157.length < 60000);
assert.deepEqual(await post({ k: await ticket(1), car: 'impreza', ms: 157000, z: z157 }), [200, 'ok'], 'the record');
assert.deepEqual(await post({ k: await ticket(1), car: 'impreza', ms: 157000, z: z157 }), [200, 'ok'], 'the same again: ok');
assert.deepEqual(await post({ k: await ticket(2), car: 'impreza', ms: 164000, z: await pack(drive(164000)) }), [200, 'ok'], '4.5 % slower');
assert.deepEqual(await post({ k: await ticket(3), car: 'impreza', ms: 166000, z: await pack(drive(166000)) }), [400, 'not fast enough'], '5.7 % slower');
assert.deepEqual(await post({ k: await ticket(4), car: 'impreza', ms: 150000, z: await pack(drive(150000)) }), [400, 'no such lap'], 'off the board');
assert.deepEqual(await post({ k: await ticket(5), car: 'audi200', ms: 172000, z: await pack(drive(167000)) }), [200, 'ok'], 'penalty seconds: the drive is the clock\'s time');
assert.deepEqual(await post({ k: await ticket(6), car: 'impreza', ms: 158000, z: await pack(drive(150000)) }), [400, 'invalid'], 'a drive of another length');
assert.deepEqual(await post({ k: await ticket(2), car: 'audi200', ms: 164000, z: z157 }), [400, 'no such lap'], 'another car');
assert.deepEqual(await post({ k: (await ticket(6)).replace(/.$/, 'x'), car: 'impreza', ms: 158000, z: await pack(drive(158000)) }), [400, 'invalid'], 'a made-up ticket');
assert.deepEqual(await post({ k: await ticket(7), car: 'impreza', ms: 110000, z: await pack(drive(110000)) }), [400, 'invalid'], 'a Raadi run');
assert.deepEqual(await post({ v: 1, track: 'raadi', car: 'impreza', n: 900, z: 'H4sIAAAA' }), [410, 'gone'], 'an old page\'s Raadi run');
const c = await get();
assert.deepEqual([c.total, c.max, c.cars], [3, LINES_MAX, { impreza: 2, audi200: 1 }]);
const rows = (await get('?after=0&limit=2')).rows;
assert.deepEqual(rows.map((r) => [r.car, r.ms, r.best, r.n]), [['impreza', 157000, 157000, 1571], ['impreza', 164000, 157000, 1641]]);
const back = await unpack(unb64(rows[0].z));
assert.equal(back.n, 1571); assert.equal(back.frames[40][16], 0.6, 'the slides come back');
assert.equal((await get(`?after=${rows[1].id}`)).rows.length, 1);
// rate: 20 an hour from one address
for (let i = 0; i < 20; i++) await post({}, 'busy');
assert.equal((await post({}, 'busy'))[0], 429);
// enough
L.lineN = LINES_MAX;
assert.deepEqual(await post({ k: await ticket(6), car: 'impreza', ms: 158000, z: await pack(drive(158000)) }), [410, 'enough']);
L.lineN = null;
assert.ok(lineWorth(164850, 157000) && !lineWorth(164851, 157000) && !lineWorth(160000, undefined));
// Tallinn's lobby (Pirita-Kose, Martin 28 Nov: every lap of his test runs): a slow lap too, and one the server did not keep
L.city = 'tallinn';
assert.deepEqual(await post({ k: await ticket(3), car: 'impreza', ms: 166000, z: await pack(drive(166000)) }), [200, 'ok'], 'Tallinn: 5.7 % slower');
assert.deepEqual(await post({ k: await ticket(9), car: 'impreza', ms: 200000, z: await pack(drive(200000)) }), [200, 'ok'], 'Tallinn: a lap not kept');
assert.deepEqual(await post({ k: await ticket(4), car: 'impreza', ms: 150000, z: await pack(drive(150000)) }), [400, 'no such lap'], 'Tallinn: off the board still not');
assert.deepEqual(await post({ k: await ticket(9), car: 'impreza', ms: 200000, z: await pack(drive(190000)) }), [400, 'invalid'], 'Tallinn: a drive of another length');
assert.deepEqual((await get('?after=0&limit=60')).rows.slice(-2).map((r) => [r.ms, r.lap < 0]), [[166000, false], [200000, true]]);
L.city = 'tartu';
console.log('OK: the server side');

// ---- 2) a page
if (arg('browser', '1') !== '0') {
  const base = arg('base', 'http://localhost:5198');
  const { chromium } = createRequire(import.meta.url)('playwright');
  const TLN = arg('city', 'tartu') === 'tallinn';      // city=tallinn: Pirita-Kose, where every lap's drive goes
  const T = JSON.parse(readFileSync(new URL(`../src/race/${TLN ? 'pirita' : 'track'}.json`, import.meta.url))).pts, N = T.length;
  const lapPath = []; for (let k = N - 30; k < N + N + 40; k++) lapPath.push(T[k % N]);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
  const board = { v: 5, track: 'toomemagi', day: at.slice(0, 10), allTime: [{ car: 'impreza', name: 'Someone', ms: 157000, at }], today: [], laps: 1, recent: [], inputs: [], refs: [], raadi: { allTime: [], today: [], laps: 0, recent: [] }, rp: {} };
  const lines = [], laps = [];
  await ctx.routeWebSocket('**/api/ws**', (ws) => ws.close({ code: 1006 }));
  await ctx.route('**/api/**', async (r) => {
    const u = new URL(r.request().url()), p = u.pathname; if (process.env.DBG) console.log('req', r.request().method(), u.pathname + u.search);
    if (p === '/api/ticket') return r.fulfill({ json: { key: `${Date.now().toString(36)}.0123456789abcdef.${'a'.repeat(27)}` } });
    if (p === '/api/board') return r.fulfill({ json: board });
    if (p === '/api/lap') { const j = r.request().postDataJSON(); laps.push(...(j.laps || [j]).map((l) => (process.env.DBG ? JSON.stringify({ ...l, splits: undefined }) : l.ms))); return r.fulfill({ json: { ok: true, saved: 1, board } }); }
    if (p === '/api/line') { lines.push({ ...r.request().postDataJSON(), city: u.searchParams.get('city') }); return r.fulfill({ json: { ok: true } }); }
    return r.fulfill({ json: {} });
  });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto(`${base}/?linelog=1&q=low&trees=old${TLN ? '&tln=1&city=tallinn' : ''}`, { timeout: 180000 });
  await pg.waitForFunction(() => window.__game?.race?.(), null, { timeout: 240000 });
  await pg.evaluate(() => { __game.setCar('impreza', true); __game.startDriving(); });
  await pg.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3000));
  // two laps through the lap's own timer: the first at 2:40 (1.9 % over the record), the next at 2:50 (8 % over)
  const out = [];
  for (const secs of [160, 170]) {
    out.push(await pg.evaluate(({ path, secs }) => {
      const rc = __game.race(), up = rc.update, n0 = rc.laps.length; rc.update = () => {};
      const dt = secs / (path.length - 70);
      let time = 1000 + Math.random() * 1000;
      for (const [x, z] of path) { time += dt; up.call(rc, { x, z, y: 0, yaw: 0, pitch: 0, roll: 0, vx: 30, vy: 0, steer: 0, time, skidF: 0.3, skidR: 0 }, 'impreza', 'IMPREZA'); }
      rc.update = up; const l = rc.laps.slice(n0); return l.map((x) => x.ms);
    }, { path: lapPath, secs }));
    await new Promise((r) => setTimeout(r, 6000));
  }
  const jobsBusy = await pg.evaluate(() => __game.jobs?.stats?.() || null);
  console.log(JSON.stringify({ laps: out, stored: laps, lines: lines.map((l) => [l.car, l.ms, l.z.length]), sent: await pg.evaluate(() => __game.mp().linesSent), jobs: jobsBusy, errors: errs.slice(0, 4) }));
  assert.equal(lines.length, TLN ? 2 : 1, TLN ? 'Tallinn: both laps\' drives' : 'one drive sent: the fast lap\'s');
  assert.ok(lines.every((l) => l.city === (TLN ? 'tallinn' : null)), 'to the city\'s own lobby');
  assert.ok(Math.abs(lines[0].ms - out[0][0]) < 1 && lines[0].car === 'impreza' && /^H4sI/.test(lines[0].z) && lines[0].k);
  const back2 = await unpack(unb64(lines[0].z));
  assert.ok(Math.abs(back2.ms - lines[0].ms) <= 1, 'the drive is that lap\'s');
  assert.deepEqual(errs, []);
  await b.close();
  console.log(TLN ? 'OK: a Tallinn page sends every lap\'s drive to its own lobby' : 'OK: the page sends only the fast lap\'s drive');
}
process.exit(0);
