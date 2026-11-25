// Pages from before the game's own idle rule (src/idlepark.js): the server puts their idle car off the map
// (idleCars in worker/index.js; Martin 25 Nov, a bus across the race road three hours after that rule).
// The real lobby under `wrangler dev` with 6 s of idling and 5 s kept out, and WebSocket bots as pages:
//   node tools/idle-map-test.mjs            (starts wrangler dev on port 8789 itself; port=8789 to change)
//   node tools/idle-map-test.mjs nostart    (a wrangler dev already running there with MAP_IDLE_S 6, MAP_OUT_S 5)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const PORT = +arg('port', 8789), IDLE = 6000, OUT = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
// a page: old (no i=1) or new; sends its car's position five times a second while `drive` is set
// ('idle': nobody at the controls, 'gas': a pedal down, 'steer': only the wheel turned)
function page({ w = `p${Date.now().toString(36)}${++seq}`.padEnd(8, '0'), fresh = false, name = `Bot${seq}` } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws?w=${w}${fresh ? '&i=1' : ''}`);
    const me = { w, name, ws, msgs: [], closed: null, drive: null, x: 100 + seq * 20, t0: Date.now() };
    const tick = setInterval(() => {
      if (!me.drive || ws.readyState !== 1) return;
      const p = new Array(22).fill(0);
      p[0] = me.x + (me.shoved ? Math.sin(Date.now() / 300) * 4 : 0); p[1] = 50; p[14] = 800;
      if (me.drive === 'gas') p[12] = 0.6;
      if (me.drive === 'steer') p[8] = 0.3;
      p[21] = Date.now() % 60000;
      ws.send(JSON.stringify({ t: 's', p }));
    }, 200);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', b: 1, name, car: 'bus', w: 'map' }));
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      me.msgs.push(m);
      if (m.t === 'welcome') { me.id = m.id; resolve(me); }
      if (m.t === 'full') { me.full = true; resolve(me); }
    };
    ws.onclose = (e) => { clearInterval(tick); me.closed = { code: e.code, at: Date.now() }; };
    ws.onerror = () => reject(new Error('no connection'));
    me.gone = async (ms) => { const t0 = Date.now(); while (!me.closed && Date.now() - t0 < ms) await sleep(50); return me.closed; };
    me.close = () => ws.close();
  });
}

let dev = null;
if (!process.argv.includes('nostart')) {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--var', `MAP_IDLE_S:${IDLE / 1000}`, '--var', `MAP_OUT_S:${OUT / 1000}`, '--persist-to', `/tmp/idle-map-test-${process.pid}`],
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
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

try {
  // somebody watching from the garage (a page with the rule): hears who leaves
  const eye = await page({ fresh: true, name: 'Eye' });
  // 1. an old page's car with nobody at its controls, shoved about by the others: off the map
  const bus = await page({ name: 'OldBus' });
  bus.drive = 'idle'; bus.shoved = true;
  // 2. and those that stay: an old page that drives, one that only steers, a new page standing idle
  const driver = await page({ name: 'OldDriver' }); driver.drive = 'gas';
  const steerer = await page({ name: 'OldSteer' }); steerer.drive = 'steer';
  const fresh = await page({ fresh: true, name: 'NewIdle' }); fresh.drive = 'idle';
  let c = await bus.gone(IDLE + 8000);
  assert.equal(c?.code, 4002, 'the old idle page was not closed with 4002');
  assert.ok(c.at - bus.t0 >= IDLE - 500, `closed too soon: ${secs(c.at - bus.t0)}`);
  await sleep(300);
  assert.ok(eye.msgs.some((m) => m.t === 'leave' && m.id === bus.id), 'the others were not told it left');
  ok(`an old page's idle bus, shoved about, is off the map after ${secs(c.at - bus.t0)} (4002, the others hear it left)`);

  // 3. it asks again at once: kept out, told as when the server is full
  const outAt = c.at;
  let again = await page({ w: bus.w, name: 'OldBus' });
  assert.ok(again.full && !again.id, 'let straight back in');
  ok('asking again at once: kept out (told SERVER FULL)');
  // a reload of that tab (the same page id, now with the rule) is let in at once
  const reloaded = await page({ w: bus.w, fresh: true, name: 'OldBus' });
  assert.ok(reloaded.id, 'the reloaded page was kept out');
  reloaded.close();
  ok('the same tab reloaded, now with the game\'s own rule: let in');

  // (the reload cleared its record, so once more from the start for the rest)
  const bus2 = await page({ name: 'OldBus2' }); bus2.drive = 'idle';
  c = await bus2.gone(IDLE + 8000);
  assert.equal(c?.code, 4002);
  again = await page({ w: bus2.w, name: 'OldBus2' });
  assert.ok(again.full, 'let straight back in');
  // 4. after the time out: let in, and still idle it is out again much sooner than a newcomer would be
  await sleep(OUT + 500 - (Date.now() - c.at));
  again = await page({ w: bus2.w, name: 'OldBus2' });
  assert.ok(again.id, `still kept out ${secs(Date.now() - c.at)} after`);
  again.drive = 'idle';
  const c2 = await again.gone(IDLE + 8000);
  assert.equal(c2?.code, 4002, 'back in and still idle: not put off again');
  ok(`let in after ${secs(OUT)}, still idle: off again ${secs(c2.at - again.t0)} later`);
  // 5. the second time out is twice the first
  await sleep(OUT + 500 - (Date.now() - c2.at));
  let third = await page({ w: bus2.w, name: 'OldBus2' });
  assert.ok(third.full, 'the second time out was no longer than the first');
  await sleep(2 * OUT + 500 - (Date.now() - c2.at));
  third = await page({ w: bus2.w, name: 'OldBus2' });
  assert.ok(third.id, 'still kept out after twice the time');
  ok(`the second time out is twice as long (${secs(2 * OUT)})`);
  // 6. back and driving: as anyone again. Idle afterwards, it gets the whole wait, not the short one
  third.drive = 'gas';
  await sleep(6000);
  assert.ok(!third.closed, 'put off the map while driving');
  third.drive = 'idle';
  const idleFrom = Date.now();
  const c3 = await third.gone(IDLE + 8000);
  assert.equal(c3?.code, 4002);
  assert.ok(c3.at - idleFrom >= IDLE - 500, `after driving again, off after only ${secs(c3.at - idleFrom)}`);
  ok(`back and driving: stays. Idle again: off after the whole wait (${secs(c3.at - idleFrom)})`);

  // 2 again: all this time the driver, the steerer and the new page's idle car stayed
  for (const p of [driver, steerer, fresh]) assert.ok(!p.closed, `${p.name} was put off the map: ${JSON.stringify(p.closed)}`);
  ok(`an old page driving, an old page only steering and a new page standing idle all stayed (${secs(Date.now() - driver.t0)})`);
  console.log('OK');
} catch (e) { console.log('FAILED', e.message); process.exitCode = 1; }
stop();
setTimeout(() => process.exit(), 300);
