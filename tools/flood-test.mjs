// Flood and spam limits end to end (Martin 2026-11-25: DDoS and spam protection): the real Worker and lobby
// under `wrangler dev`, with WebSocket players that play normally and one that spams.
//   node tools/flood-test.mjs            (starts wrangler dev on port 8789 itself; port=8789 to change)
//   node tools/flood-test.mjs nostart    (a wrangler dev already running there)
// Checks: a normal player (20 positions a second, a few car and place changes) is never shut; a socket that
// sends more than 30 changes in 15 s is shut with 1008 and the others hear it left; a socket sending positions
// far too fast is shut too; /api on the old workers.dev address answers 410; over 300 API requests a minute
// from one address get 429 from the Worker (run last, it uses up this address's minute).
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import http from 'node:http';

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const PORT = +arg('port', 8789);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function player(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws`);
    const me = { ws, msgs: [], closed: null, name };
    ws.onmessage = (e) => { try { me.msgs.push(JSON.parse(e.data)); } catch { /* not ours */ } };
    ws.onclose = (e) => { me.closed = { code: e.code, why: e.reason }; };
    ws.onerror = () => { if (!me.id) reject(new Error('socket error')); };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name, car: 'w201', w: 'map', b: 1 }));
    me.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    me.wait = async (pred, ms = 4000) => {
      const t0 = Date.now();
      for (;;) {
        const m = me.msgs.find(pred);
        if (m) return m;
        if (Date.now() - t0 > ms) return null;
        await sleep(30);
      }
    };
    me.wait((m) => m.t === 'welcome').then((w) => { if (!w) return reject(new Error('no welcome')); me.id = w.id; resolve(me); });
  });
}
const pose = (i) => ({ t: 's', p: { x: i, y: 0, z: i, h: 0, v: 10 } });

let dev = null;
if (!process.argv.includes('nostart')) {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/flood-test-${process.pid}`],
    { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  dev.stdout.on('data', (d) => { log += d; });
  dev.stderr.on('data', (d) => { log += d; });
  const t0 = Date.now();
  for (;;) {
    try { if ((await fetch(`${BASE}/api/board`)).ok) break; } catch { /* not yet */ }
    if (Date.now() - t0 > 180000) { console.log(log); throw new Error('wrangler dev did not start'); }
    await sleep(500);
  }
}
const stop = () => { if (dev) try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
const ok = (s) => console.log(`  ok  ${s}`);

try {
  // 1. a normal player for 4 s: 20 positions a second, a clock ask, car picks, garage and back, driving on
  const A = await player('Anna'), B = await player('Bert');
  const cars = ['w201', 'e30', 'f40', 'w201'];
  for (let i = 0; i < 80; i++) {
    A.send(pose(i));
    if (i % 20 === 0) A.send({ t: 'clock', c: Date.now() });
    if (i % 10 === 5) A.send({ t: 'car', car: cars[(i / 10 | 0) % cars.length] });
    if (i % 20 === 7) { A.send({ t: 'at', w: 'garage' }); A.send({ t: 'at', w: 'map' }); A.send({ t: 'drv', on: 1 }); }
    await sleep(50);
  }
  await sleep(300);
  assert.equal(A.closed, null, `a normal player was shut: ${JSON.stringify(A.closed)}`);
  ok('a normal player (20 positions a second, car and place changes) stays on');

  // 2. a socket that flips its place 40 times at once: shut after 30, the others hear it left, and the 31st on is not passed on
  const S = await player('Spam');
  await B.wait((m) => m.t === 'join' && m.id === S.id);
  const before = B.msgs.filter((m) => m.t === 'at' && m.id === S.id).length;
  for (let i = 0; i < 40; i++) S.send({ t: 'at', w: i % 2 ? 'map' : 'garage' });
  const left = await B.wait((m) => m.t === 'leave' && m.id === S.id);
  await sleep(300);
  assert.ok(left, 'the others did not hear the spammer leave');
  assert.equal(S.closed?.code, 1008, `spammer not shut with 1008: ${JSON.stringify(S.closed)}`);
  const heard = B.msgs.filter((m) => m.t === 'at' && m.id === S.id).length - before;
  assert.ok(heard <= 30, `the others heard ${heard} place changes`);
  ok(`a socket sending 40 place changes at once is shut (1008), others heard ${heard} and then that it left`);

  // 3. positions far too fast (100 at once): shut by the per-message limit
  const P = await player('Fast');
  for (let i = 0; i < 100; i++) P.send(pose(i));
  await sleep(600);
  assert.equal(P.closed?.code, 1008, `fast sender not shut: ${JSON.stringify(P.closed)}`);
  ok('a socket sending 100 positions at once is shut (1008)');
  assert.equal(A.closed, null, 'the normal player was shut along the way');
  A.ws.close(); B.ws.close();

  // 4. the old workers.dev address: /api answers 410 and never reaches the lobby
  const status410 = await new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/api/board', headers: { host: 'kvissuroam.parttime.workers.dev' } }, (r) => { r.resume(); res(r.statusCode); }).on('error', rej);
  });
  assert.equal(status410, 410, `old address answered ${status410}`);
  ok('/api on the old workers.dev address answers 410');

  // 5. over 300 API requests a minute from one address: 429 from the Worker before the lobby
  let n429 = 0, okN = 0;
  for (let i = 0; i < 330; i++) {
    const r = await fetch(`${BASE}/api/board`);
    if (r.status === 429) n429++; else if (r.ok) okN++;
    await r.arrayBuffer();
  }
  assert.ok(n429 > 0, 'no 429 after 330 requests');
  ok(`330 API requests in a row: ${okN} answered, ${n429} refused with 429`);
  console.log('flood test: all ok');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  stop();
  setTimeout(() => process.exit(process.exitCode || 0), 200);
}
