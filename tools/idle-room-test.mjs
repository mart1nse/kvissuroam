// With room on the server a car may stand on the map for as long as it likes; over 90 % full the idle rule is on
// for everyone, and a bus is judged always (Martin 26 Nov; room() and idleCars in worker/index.js, src/idlepark.js
// on the page). The server's half: it tells every page whether it is tight (with the welcome, and { t: 'room' }
// when that changes), and judges the old pages' cars by it. The page's half is in tools/idle-park-test.mjs.
// The real lobby under `wrangler dev` with a cap of 5 (tight: all 5 taken), 6 s of idling and 5 s kept out:
//   node tools/idle-room-test.mjs            (starts wrangler dev on port 8790 itself; port=8790 to change)
//   node tools/idle-room-test.mjs nostart    (a wrangler dev already running there with MAX_ONLINE 5, MAP_IDLE_S 6, MAP_OUT_S 5)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const PORT = +arg('port', 8790), CAP = 5, IDLE = 6000, OUT = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
// a page: old (no i=1) or new, on the map; sends its car's position five times a second while `drive` is set
// ('idle': nobody at the controls, 'gas': a pedal down)
function page({ fresh = false, name = `Bot${seq + 1}`, car = 'w201' } = {}) {
  const w = `r${Date.now().toString(36)}${++seq}`.padEnd(8, '0');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws?w=${w}${fresh ? '&i=1' : ''}`);
    const me = { w, name, ws, msgs: [], closed: null, drive: null, x: 100 + seq * 20, t0: Date.now() };
    const tick = setInterval(() => {
      if (!me.drive || ws.readyState !== 1) return;
      const p = new Array(22).fill(0);
      p[0] = me.x; p[1] = 50; p[14] = 800;
      if (me.drive === 'gas') p[12] = 0.6;
      p[21] = Date.now() % 60000;
      ws.send(JSON.stringify({ t: 's', p }));
    }, 200);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', b: 1, name, car, w: 'map' }));
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      me.msgs.push(m);
      if (m.t === 'welcome') { me.id = m.id; me.welcome = m; resolve(me); }
      if (m.t === 'full') { me.full = true; resolve(me); }
    };
    ws.onclose = (e) => { clearInterval(tick); me.closed = { code: e.code, at: Date.now() }; };
    ws.onerror = () => reject(new Error('no connection'));
    me.gone = async (ms) => { const t0 = Date.now(); while (!me.closed && Date.now() - t0 < ms) await sleep(50); return me.closed; };
    // the last word on room this page heard (null: none)
    me.room = () => { const m = me.msgs.findLast((x) => x.t === 'room' || x.t === 'welcome'); return m ? (m.tight === 1 ? 'tight' : 'room') : null; };
    me.close = () => ws.close();
  });
}

let dev = null;
if (!process.argv.includes('nostart')) {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--var', `MAX_ONLINE:${CAP}`, '--var', `MAP_IDLE_S:${IDLE / 1000}`, '--var', `MAP_OUT_S:${OUT / 1000}`, '--persist-to', `/tmp/idle-room-test-${process.pid}`],
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
  // 1. room (4 of 5): an old page's idle car stays, an old page's idle bus goes as before
  const eye = await page({ fresh: true, name: 'Eye' }); eye.drive = 'gas';
  const car = await page({ name: 'OldCar' }); car.drive = 'idle';
  const driver = await page({ name: 'OldDriver' }); driver.drive = 'gas';
  const bus = await page({ name: 'OldBus', car: 'bus' }); bus.drive = 'idle';
  for (const p of [eye, car, driver, bus]) assert.equal(p.room(), 'room', `${p.name} was told the server is tight at 4 of ${CAP}`);
  let c = await bus.gone(IDLE + 8000);
  assert.equal(c?.code, 4002, 'the idle bus was not put off the map while there is room');
  ok(`room on the server: an idle bus is still off the map after ${secs(c.at - bus.t0)}`);
  await sleep(Math.max(0, IDLE + 8000 - (Date.now() - car.t0)));
  assert.ok(!car.closed, `an idle car was put off the map with room on the server: ${JSON.stringify(car.closed)}`);
  ok(`room on the server: an idle car stays (${secs(Date.now() - car.t0)} so far)`);

  // 2. the server fills (5 of 5): everyone hears it, the newcomers with their welcome, and the car that has stood
  // its time goes within the server's next look (5 s); a new page's idle car is the page's own business
  const fresh = await page({ fresh: true, name: 'NewIdle' }); fresh.drive = 'idle';
  assert.equal(fresh.room(), 'room', 'tight at 4 of 5');
  const fifth = await page({ fresh: true, name: 'Fifth' }); fifth.drive = 'gas';
  const fullAt = Date.now();
  assert.equal(fifth.welcome.tight, 1, 'the page that filled the server was not told it is tight');
  await sleep(300);
  for (const p of [eye, car, driver, fresh]) assert.equal(p.room(), 'tight', `${p.name} did not hear the server turn tight`);
  ok('the server over 90 % full: every page hears it, the newcomer with its welcome');
  c = await car.gone(8000);
  assert.equal(c?.code, 4002, 'tight, and the old page\'s idle car was not put off the map');
  ok(`tight: the car that had stood its time is off the map ${secs(c.at - fullAt)} later (4002)`);

  // 3. that freed a place: room again, told to everyone, and nobody else was touched
  await sleep(300);
  for (const p of [eye, driver, fresh, fifth]) assert.equal(p.room(), 'room', `${p.name} did not hear there is room again`);
  ok('a place freed: every page hears there is room again');
  // one who arrives now is told so too, and tight again with it there; when it leaves, room once more
  const sixth = await page({ fresh: true, name: 'Sixth' });
  assert.ok(sixth.id && sixth.welcome.tight === 1, 'the page that filled the server again was not told');
  await sleep(300);
  assert.equal(eye.room(), 'tight');
  sixth.close();
  await sleep(600);
  for (const p of [eye, driver, fresh, fifth]) assert.equal(p.room(), 'room', `${p.name} did not hear there is room after a page left`);
  ok('a page leaving brings room back');
  // (each change was told once, not with every arrival. The first: the lobby's first look since it woke, which it
  // always tells, as it does not remember what the pages last heard)
  assert.deepEqual(eye.msgs.filter((m) => m.t === 'room').map((m) => m.tight), [0, 1, 0, 1, 0], 'told more or less often than it changed');
  ok('told once for each change');

  // 4. with room, the new page's idle car and the drivers stayed all along
  await sleep(Math.max(0, IDLE + 4000 - (Date.now() - fresh.t0)));
  for (const p of [eye, driver, fresh, fifth]) assert.ok(!p.closed, `${p.name} was put off the map: ${JSON.stringify(p.closed)}`);
  ok(`the drivers and a new page's idle car stayed (${secs(Date.now() - driver.t0)})`);
  console.log('OK');
} catch (e) { console.log('FAILED', e.message); process.exitCode = 1; }
stop();
setTimeout(() => process.exit(), 300);
