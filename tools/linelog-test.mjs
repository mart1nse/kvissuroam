// Where the cars drive the Raadi stage (src/race/linelog.js, worker/index.js /api/line and /api/lines; Martin
// 26 Nov 2026: the painted wheel tracks are to be made from real driving).
//  1) the server, a Lobby over node:sqlite: a run is kept and read back whole, nonsense is refused, an address may
//     not flood it, and a full stage answers 410;
//  2) with `drive` (needs the dev server, npx vite --port 5198, and Playwright): a run driven along the stage
//     in the game is written down every 0.75 m, packed and posted once, with the metres past the finish; a run
//     cancelled after 300 m is posted as not finished, one of 60 m is not posted.
//   node tools/linelog-test.mjs [drive] [url]
import assert from 'node:assert/strict';
import { register, createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync, gunzipSync } from 'node:zlib';
import fs from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');
const { lineSamples, LINE_FIELDS } = await import(root + '/src/race/linelog.js');

{
  let clock = Date.UTC(2026, 10, 26, 9, 0, 0);
  Date.now = () => clock;
  globalThis.WebSocketRequestResponsePair = class {};
  const db = new DatabaseSync(':memory:');
  const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
  const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
  const ctx = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => [], getWebSocketAutoResponseTimestamp: () => new Date(clock), waitUntil() {} };
  const L = new Lobby(ctx, { STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true) }) } });
  const req = (path, body, ip = '1.1.1.1') => new Request('https://www.linnaring.com' + path, { method: body ? 'POST' : 'GET', headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const call = async (path, body, ip) => { const r = await L.fetch(req(path, body, ip)); return { status: r.status, j: await r.json().catch(() => null) }; };

  const n = 400, rows = [];
  for (let i = 0; i < n; i++) rows.push([i ? 75 : 250000, i ? 3 : 50000, i ? 1 : 1570, 0, 0, i % 7 ? 0 : 5, 0, 0, 0, 0].join(','));
  const z = gzipSync(rows.join(',')).toString('base64');
  const run = { v: 1, track: 'raadi', car: 'impreza', done: 1, ms: 95432, pen: 2, ty: 'gravel', m: [121, 140, 148, 21], n, z };

  assert.deepEqual((await call('/api/lines?track=raadi')).j, { track: 'raadi', total: 0, max: 8000 });
  assert.equal((await call('/api/line', run)).status, 200);
  assert.equal((await call('/api/line', { ...run, done: 0, ms: 0, pen: 0, car: 'w201' })).status, 200);
  // refused: no such stage, no such car, too few samples, not gzip, another version
  for (const bad of [{ track: 'toomemagi' }, { car: 'constructor' }, { n: 20 }, { z: 'aGVsbG8=' }, { v: 2 }, { z: 'H4sI' + 'A'.repeat(119000) + '!' }]) {
    assert.equal((await call('/api/line', { ...run, ...bad }, '9.9.9.9')).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal((await call('/api/line', { ...run, z: 'H4sI' + 'A'.repeat(130000) }, '9.9.9.9')).status, 413);
  let r = (await call('/api/lines?track=raadi&after=0')).j;
  assert.equal(r.total, 2);
  assert.deepEqual(r.rows.map((x) => [x.id, x.car, x.done, x.ms, x.pen, x.n, x.ty, x.m.join()]), [[1, 'impreza', 1, 95432, 2, n, 'gravel', '121,140,148,21'], [2, 'w201', 0, 0, 0, n, 'gravel', '121,140,148,21']]);
  const back = lineSamples(gunzipSync(Buffer.from(r.rows[0].z, 'base64')).toString(), n);
  assert.equal(back.length, n * LINE_FIELDS);
  assert.deepEqual([back[0], back[1], back[2]], [250000, 50000, 1570]);
  assert.deepEqual([back[(n - 1) * 10], back[(n - 1) * 10 + 1]], [250000 + 75 * (n - 1), 50000 + 3 * (n - 1)]);
  assert.equal((await call('/api/lines?track=raadi&after=1')).j.rows.length, 1);
  assert.equal((await call('/api/lines?track=nowhere')).status, 404);
  // one address: 12 runs in ten minutes, then wait
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/line', run)).status, 200);
  assert.equal((await call('/api/line', run)).status, 429);
  assert.equal((await call('/api/line', run, '2.2.2.2')).status, 200);
  clock += 11 * 60000;
  assert.equal((await call('/api/line', run)).status, 200);
  // the stage has enough: 410, and nothing more is kept
  L.lineN.raadi = 8000;
  assert.equal((await call('/api/line', run, '3.3.3.3')).status, 410);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM lines').get().n, 14);
  console.log('server: ok');
}

if (process.argv[2] === 'drive') {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const D = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url)));
  const P = D.pts, S0 = D.start, F = D.finish;
  const url = process.argv[3] || 'http://localhost:5198/?raadi=1&q=low&trees=old&linelog=1';
  // points 0.5 m apart along the stage from index a to b, with the way the road runs there
  function along(a, b) {
    const out = [];
    for (let i = a; i < b; i++) {
      const p = P[i], q = P[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, yaw = Math.atan2(q[0] - p[0], -(q[1] - p[1]));
      for (let d = 0; d < l; d += 0.5) out.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l, yaw]);
    }
    return out;
  }
  const len = (pts) => pts.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const posts = [];
  await page.route('**/api/line', (route) => { posts.push(JSON.parse(route.request().postData())); route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
  await page.evaluate(() => __game.startDriving());
  await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
  // a run along `path`, the stage's own frames held off meanwhile; then the game's frames run on (the work queue packs)
  async function drive(path) {
    await page.evaluate(() => { const s = __game.stage(); if (window.__stUpdate) s.update = window.__stUpdate; s.goStart(); });
    await page.waitForFunction(() => { const s = __game.stage(); s.countLeft = 0; return s.phase === 'run'; }, null, { timeout: 180000, polling: 200 });
    return page.evaluate(({ path }) => {
      const s = __game.stage();
      window.__stUpdate ||= s.update;
      s.update = () => {};
      const car = __game.car;
      let time = car.time, k = 0;
      for (; k < path.length && (s.phase === 'run' || s.log.on); k++) {
        car.x = path[k][0]; car.z = path[k][1]; car.yaw = path[k][2]; car.time = time += 0.03;
        window.__stUpdate.call(s, car, 'impreza', 'IMPREZA', 0.03, 'kb');
      }
      s.update = window.__stUpdate;        // (the game's own frames again: the log's last seconds past the finish run out)
      return { phase: s.phase, k, on: s.log.on, msg: document.querySelector('#stage .msg')?.textContent || '' };
    }, { path });
  }
  const unpack = (p) => lineSamples(gunzipSync(Buffer.from(p.z, 'base64')).toString(), p.n);

  // 1) a whole run and 200 m on: posted once, finished, every 0.75 m, 150 m past the line
  const full = [...along(S0, F), ...along(F, P.length - 1)];
  let r = await drive(full);
  await page.waitForFunction(() => __game.stage().log.last, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  assert.equal(posts.length, 1, `one post (${JSON.stringify(r)})`);
  let p = posts[0], d = unpack(p);
  const stageM = len(along(S0, F));
  console.log(`run: ${p.n} samples, ${p.z.length} characters packed, stage ${stageM.toFixed(0)} m, done ${p.done}, ms ${p.ms}, m ${p.m}`);
  assert.equal(p.track, 'raadi'); assert.ok(p.car); assert.equal(p.done, 1); assert.ok(p.ms > 0);
  assert.ok(p.m[0] > 80 && p.m[1] > 80 && p.m[2] > 120, 'the car\'s measures');
  const got = [];
  for (let i = 0; i < p.n; i++) got.push([d[i * 10] / 100, d[i * 10 + 1] / 100]);
  const tail = Math.min(150, len(along(F, P.length - 1)));
  assert.ok(Math.abs(len(got) - (stageM + tail)) < 12, `length ${len(got).toFixed(0)} against ${(stageM + tail).toFixed(0)}`);
  assert.ok(p.n > (stageM + tail) / 1.1 && p.n < (stageM + tail) / 0.45, 'a sample every 0.75 m or so (the test moves the car in 0.5 m steps: every metre)');
  assert.ok(Math.hypot(got[0][0] - P[S0][0], got[0][1] - P[S0][1]) < 3, 'starts at the line');
  assert.ok(p.z.length < 60000, 'small');

  // 2) cancelled after 300 m: posted as not finished; 3) after 60 m: not posted
  posts.length = 0;
  const part = (m) => { const a = along(S0, F), out = []; for (const q of a) { out.push(q); if (len(out) >= m) break; } return out; };
  r = await drive(part(300));
  await page.evaluate(() => { const s = __game.stage(); s.update = window.__stUpdate; s.goStart(); });      // (back to the start: the run is over)
  await page.waitForTimeout(1500);
  assert.equal(posts.length, 1, 'the cancelled run is posted');
  p = posts[0];
  assert.equal(p.done, 0); assert.ok(p.n > 300 && p.n < 700, `${p.n} samples for 300 m`);
  posts.length = 0;
  await page.waitForFunction(() => { const s = __game.stage(); s.countLeft = 0; return s.phase === 'run'; }, null, { timeout: 180000, polling: 200 });
  r = await drive(part(60));
  await page.evaluate(() => { const s = __game.stage(); s.update = window.__stUpdate; s.goStart(); });
  await page.waitForTimeout(1500);
  assert.equal(posts.length, 0, 'a 60 m run is not posted');
  await browser.close();
  console.log('drive: ok');
}
