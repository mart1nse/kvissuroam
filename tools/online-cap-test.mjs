// The online cap end to end (Martin 2026-11-25: "server getting full and allowing players in afterwards, make
// it sturdy"): the real lobby under `wrangler dev` with a cap of 3 and 4 s of idling, and WebSocket bots.
//   node tools/online-cap-test.mjs            (starts wrangler dev on port 8788 itself; port=8788 to change)
//   node tools/online-cap-test.mjs nostart    (a wrangler dev already running there with MAX_ONLINE 3, IDLE_S 4)
// The bots speak raw WebSocket over TCP, so one can go silent the way a phone that lost its network does: its
// connection stays open, it never pings, and it never answers the server's close.
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const PORT = +arg('port', 8788), IDLE_S = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- a WebSocket client small enough to misbehave on purpose
let seq = 0;
function bot(w, label = `b${++seq}`) {
  return new Promise((resolve, reject) => {
    const s = net.connect(PORT, '127.0.0.1');
    const me = { label, w, msgs: [], closed: null, sock: s, silent: false };
    let buf = Buffer.alloc(0), open = false;
    const key = crypto.randomBytes(16).toString('base64');
    s.on('connect', () => s.write(`GET /api/ws${w ? `?w=${w}` : ''} HTTP/1.1\r\nHost: 127.0.0.1:${PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    s.on('error', (e) => { if (!open) reject(e); });
    s.on('close', () => { me.ended = true; });
    s.on('data', (d) => {
      if (me.silent) return;                       // a dead phone hears nothing either
      buf = Buffer.concat([buf, d]);
      if (!open) {
        const i = buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        const head = buf.subarray(0, i).toString();
        buf = buf.subarray(i + 4);
        if (!/^HTTP\/1\.1 101/.test(head)) { me.status = head.split('\r\n')[0]; resolve(me); s.destroy(); return; }
        open = true; resolve(me);
      }
      while (buf.length >= 2) {
        const op = buf[0] & 15;
        let n = buf[1] & 127, o = 2;
        if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4; }
        else if (n === 127) { if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); o = 10; }
        if (buf.length < o + n) return;
        const p = buf.subarray(o, o + n);
        buf = buf.subarray(o + n);
        if (op === 1) { if (p.toString() !== 'pong') { try { me.msgs.push(JSON.parse(p.toString())); } catch { /* not ours */ } } }
        else if (op === 8) {
          me.closed = { code: p.length >= 2 ? p.readUInt16BE(0) : 1005, why: p.subarray(2).toString() };
          if (!me.deaf) { frame(s, 8, p.subarray(0, 2)); s.end(); }
        }
      }
    });
    me.send = (m) => { if (!me.silent) frame(s, 1, Buffer.from(typeof m === 'string' ? m : JSON.stringify(m))); };
    me.close = () => { frame(s, 8, Buffer.from([0x03, 0xe8])); };
    me.wait = async (t, ms = 4000) => {
      const t0 = Date.now();
      for (;;) {
        const m = me.msgs.find((x) => x.t === t);
        if (m) return m;
        if (Date.now() - t0 > ms) return null;
        await sleep(25);
      }
    };
    me.waitClose = async (ms = 4000) => { const t0 = Date.now(); while (!me.closed && Date.now() - t0 < ms) await sleep(25); return me.closed; };
  });
}
function frame(s, op, p) {
  const mask = crypto.randomBytes(4), n = p.length;
  const head = n < 126 ? Buffer.from([0x80 | op, 0x80 | n]) : Buffer.from([0x80 | op, 0x80 | 126, n >> 8, n & 255]);
  const body = Buffer.from(p.map((b, i) => b ^ mask[i % 4]));
  try { s.write(Buffer.concat([head, mask, body])); } catch { /* gone */ }
}
const W = () => crypto.randomBytes(6).toString('hex').slice(0, 10);
// a page: connects with its page id and says hello; resolves with the bot and its welcome (or 'full')
async function page({ w = W(), k, where = 'map', name } = {}) {
  const b = await bot(w);
  if (b.status) return { b, full: false, err: b.status };
  b.send({ t: 'hello', b: 1, name: name || `Bot${seq}`, car: 'w201', k, w: where });
  const t0 = Date.now();
  for (;;) {
    const m = b.msgs.find((x) => x.t === 'welcome' || x.t === 'full');
    if (m) return { b, w, full: m.t === 'full', id: m.id, key: m.key, max: m.max };
    if (Date.now() - t0 > 5000) throw new Error(`${b.label}: no welcome or full`);
    await sleep(25);
  }
}
const online = async () => (await fetch(`http://127.0.0.1:${PORT}/api/online?t=${Date.now()}`)).json();   // (past the 10 s cache)

// ---- the server
let dev = null;
if (!process.argv.includes('nostart')) {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--var', 'MAX_ONLINE:3', '--var', `IDLE_S:${IDLE_S}`, '--persist-to', `/tmp/online-cap-test-${process.pid}`],
    { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  dev.stdout.on('data', (d) => { log += d; });
  dev.stderr.on('data', (d) => { log += d; });
  const t0 = Date.now();
  for (;;) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/online`)).ok) break; } catch { /* not yet */ }
    if (Date.now() - t0 > 180000) { console.log(log); throw new Error('wrangler dev did not start'); }
    await sleep(500);
  }
}
const stop = () => { if (dev) try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);

const ok = (s) => console.log(`  ok  ${s}`);
try {
  // 0. a lap ticket from the Worker in front (not the lobby) is one the lobby takes as its own
  const tk = (await (await fetch(`http://127.0.0.1:${PORT}/api/ticket`)).json()).key;
  const T = await page({ k: tk, name: 'Tess' });
  assert.equal(T.key, tk, 'the lobby keeps a ticket the Worker made');
  T.b.close(); await T.b.waitClose(); await sleep(200);
  ok('a lap ticket made in the Worker is valid in the lobby');

  // 1. fill up, the next one is told FULL (and closed with 4001), not shown as a player
  const A = await page({ name: 'Anna' }), B = await page({ name: 'Bert' }), C = await page({ name: 'Cara' });
  assert.ok(!A.full && !B.full && !C.full, 'three get in');
  let D = await page({ name: 'Dora' });
  assert.ok(D.full && D.max === 3, 'the fourth is told FULL');
  assert.equal((await D.b.waitClose())?.code, 4001);
  let o = await online();
  assert.equal(o.total, 3); assert.equal(o.cap, 3); assert.equal(o.waiting, 1);
  assert.ok(!B.b.msgs.some((m) => m.t === 'join' && m.name === 'Dora'), 'a refused page is never announced');
  ok('3 fill the cap, the 4th gets SERVER FULL (4001), counted as waiting, never announced');

  // 2. somebody leaves: the waiting page gets in when it asks again
  C.b.close(); await C.b.waitClose();
  await sleep(200);
  const D2 = await page({ w: D.w, name: 'Dora' });
  assert.ok(!D2.full, 'the waiting page gets the freed place');
  assert.ok(await A.b.wait('join'), 'the others hear Dora joined');
  o = await online();
  assert.equal(o.total, 3); assert.equal(o.waiting, 0);
  ok('one leaves, the waiting page gets in on its next try (no longer counted as waiting)');

  // 3. a phone loses its network while the server is full: its old connection stays open and silent, it comes
  //    back on a new one with the same page id and ticket. It must get its place back, with the same id, and
  //    nobody hears it left.
  A.b.silent = true; A.b.deaf = true;
  const A2 = await page({ w: A.w, k: A.key, name: 'Anna' });
  assert.ok(!A2.full, 'a lost connection coming back is not kept out by its own dead socket');
  assert.equal(A2.id, A.id, 'same id after the reconnect');
  await sleep(300);
  assert.ok(!B.b.msgs.some((m) => m.t === 'leave' && m.id === A.id), 'nobody hears it left');
  o = await online();
  assert.equal(o.total, 3, 'still 3 online, not 4');
  const E = await page({ name: 'Emil' });
  assert.ok(E.full, 'and the server is still full for a newcomer');
  ok('a dropped connection coming back at full gets its place and id back; the dead socket holds no second place');

  // 4. a tab reloaded while full (its old socket not closed yet): the new page has the same page id (kept in
  //    sessionStorage over the reload) but a new ticket, so a new id. It gets in, the old one is shown as left.
  B.b.deaf = true;
  const B2 = await page({ w: B.w, name: 'Bert' });
  assert.ok(!B2.full, 'a reloaded tab is not kept out by its own old socket');
  assert.notEqual(B2.id, B.id);
  assert.ok(await A2.b.wait('leave'), 'the others hear the old page left');
  assert.equal(A2.b.msgs.find((m) => m.t === 'leave').id, B.id);
  o = await online();
  assert.equal(o.total, 3);
  assert.equal(o.players.filter((p) => p.name === 'Bert').length, 1, 'shown once');
  const E4 = await page({ name: 'Emma' });
  assert.ok(E4.full, 'still full');
  assert.deepEqual([E.full && E4.full, E4.b.msgs.find((m) => m.t === 'full').q], [true, 2], 'Emma waits second in the queue, behind Emil');
  ok('a reloaded tab gets back in, shown once, its old socket closed and announced as left');

  // 5. a spectator and a driver on the map keep their places however long; one in the garage past IDLE_S gives
  //    it up to a newcomer (4002), and exactly one newcomer gets in for it, even when the idle page never
  //    answers the close
  D2.b.send({ t: 'at', w: 'watch', on: A.id });
  B2.b.deaf = true;
  B2.b.send({ t: 'at', w: 'garage' });
  await sleep(IDLE_S * 1000 + 600);
  const E2 = await page({ w: E.w, name: 'Emil' });
  assert.ok(!E2.full, 'the first in the queue gets the idle place');
  assert.equal((await B2.b.waitClose())?.code, 4002, 'the idle page is told why (4002)');
  assert.ok(!D2.b.closed && !A2.b.closed, 'the spectator and the driver keep theirs');
  const F = await page({ name: 'Finn' });
  assert.ok(F.full, 'one place freed lets one in, not two (the released socket still open)');
  o = await online();
  assert.equal(o.total, 3);
  ok('garage past IDLE_S frees one place (4002) for one newcomer; spectator and driver keep theirs');

  // 6. the queue: a place frees while Emma and Finn wait; eight pages that just opened all get FULL with places
  //    behind them (the place is kept for the front), Emma gets in, then Finn is first
  E2.b.close(); await E2.b.waitClose();
  await sleep(200);
  const rush = await Promise.all(Array.from({ length: 8 }, (_, i) => page({ name: `Rush${i}` })));
  assert.equal(rush.filter((r) => !r.full).length, 0, 'a place kept for the queue is not taken by pages that just opened');
  assert.deepEqual(rush.map((r) => r.b.msgs.find((m) => m.t === 'full').q).sort((x, y) => x - y), [3, 4, 5, 6, 7, 8, 9, 10], 'each told its place in the queue');
  o = await online();
  assert.equal(o.queue, 10);
  const E5 = await page({ w: E4.w, name: 'Emma' });
  assert.ok(!E5.full, 'the front of the queue gets the kept place');
  const F2 = await page({ w: F.w, name: 'Finn' });
  assert.equal(F2.b.msgs.find((m) => m.t === 'full')?.q, 1, 'Finn is next');
  // a rush for one place among pages all in the queue: only the front gets it
  E5.b.close(); await E5.b.waitClose(); await sleep(200);
  const again = await Promise.all([...rush.slice(0, 4).map((r) => page({ w: r.w })), page({ w: F.w, name: 'Finn' })]);
  assert.deepEqual(again.map((r) => r.full), [true, true, true, true, false], 'of five asking at once, the front of the queue gets in');
  o = await online();
  assert.equal(o.total, 3);
  ok('queue: a freed place is kept for the front; 8 new pages told places 3-10; Emma, then Finn, in order');

  // 7. a page that goes silent while the server is not full keeps no place for long: after 80 s without a ping
  //    the next newcomer takes it (slow: only with `slow`)
  if (process.argv.includes('slow')) {
    const winner = again[4];
    winner.b.silent = true; winner.b.deaf = true;
    await sleep(82000);
    for (const p of [A2, D2]) p.b.send('ping');
    const G = await page({ name: 'Gus' });
    assert.ok(!G.full, 'a silent socket gives its place up after 80 s');
    ok('a page silent for 80 s gives its place to the next one');
  }
  console.log('online cap: ok');
} finally {
  stop();
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}
