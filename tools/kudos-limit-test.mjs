// Thumbs up limits end to end (Martin 2026-11-26: one player gave another about 30): the real Worker and lobby
// under `wrangler dev`, with WebSocket players, no browsers. About 2 min (the 30 s gap is real).
//   node tools/kudos-limit-test.mjs            (starts wrangler dev on port 8791 itself; port=8791 to change)
//   node tools/kudos-limit-test.mjs nostart    (a wrangler dev already running there)
// Checks (src/net/kudosrules.js): one player to the same player once in 30 s and three a day, the fourth
// refused and nobody told; another player's thumbs up still goes through; the same name from a new tab (a new
// id) is refused as the same player; a day saved before the rule (26 from one player) comes back as three of
// theirs with the count lowered, for everyone who joins later.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { KUDOS_PAIR } from '../src/net/kudosrules.js';

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const PORT = +arg('port', 8791);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function player(name, extra = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws`);
    const me = { ws, msgs: [], closed: null, name };
    ws.onmessage = (e) => { try { me.msgs.push(JSON.parse(e.data)); } catch { /* not ours */ } };
    ws.onclose = (e) => { me.closed = { code: e.code, why: e.reason }; };
    ws.onerror = () => { if (!me.id) reject(new Error('socket error')); };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name, car: 'w201', w: 'map', b: 1, ...extra }));
    me.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    const keep = setInterval(() => (ws.readyState === 1 ? ws.send('ping') : clearInterval(keep)), 5000);   // (as a page does: else 'stale')
    me.wait = async (pred, ms = 3000) => {
      const t0 = Date.now();
      for (;;) {
        const m = me.msgs.find(pred);
        if (m) return m;
        if (Date.now() - t0 > ms) return null;
        await sleep(30);
      }
    };
    me.wait((m) => m.t === 'welcome').then((w) => { if (!w) return reject(new Error('no welcome')); me.id = w.id; me.welcome = w; resolve(me); });
  });
}

let dev = null;
if (!process.argv.includes('nostart')) {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/kudos-limit-test-${process.pid}`],
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

// thumbs up from `from` to `to` as a third player C hears them (count so far)
const heard = (C, from, to) => C.msgs.filter((m) => m.t === 'ku' && m.id === from.id && m.to === to.id).length;

try {
  const A = await player('bus'), B = await player('Abadiats'), C = await player('Ann');
  await sleep(300);

  // 1. A to B: the first goes through, a second at once is refused (30 s)
  A.send({ t: 'ku', to: B.id });
  assert.ok(await C.wait((m) => m.t === 'ku' && m.id === A.id), 'the first thumbs up was not passed on');
  A.send({ t: 'ku', to: B.id });
  await sleep(600);
  assert.equal(heard(C, A, B), 1, 'a second thumbs up at once went through');
  ok('one player to another: the first goes through, a second within 30 s does not');

  // 2. every 31 s: the second and third go through, the fourth does not; Ann's still does
  for (let i = 2; i <= KUDOS_PAIR + 1; i++) {
    await sleep(31000);
    A.send({ t: 'ku', to: B.id });
    await sleep(600);
    console.log(`      after ${i} sent 31 s apart: ${heard(C, A, B)} passed on`);
  }
  assert.equal(heard(C, A, B), KUDOS_PAIR, `not ${KUDOS_PAIR} passed on from one player`);
  C.send({ t: 'ku', to: B.id });
  assert.ok(await A.wait((m) => m.t === 'ku' && m.id === C.id && m.to === B.id), 'another player could not give one');
  ok(`one player to the same player: ${KUDOS_PAIR} a day, the next refused; another player's still goes through`);

  // 3. the same name from a new tab (new id): refused as the same player
  const A2 = await player('bus');
  await sleep(300);
  A2.send({ t: 'ku', to: B.id });
  await sleep(800);
  assert.equal(heard(C, A2, B), 0, 'the same name with a new id went through');
  ok('the same name from a new tab is the same player');

  // 4. a day saved before the rule: 26, the last 24 of them from "bus"
  const kf = [...Array(24)].map((_, i) => ['busid' + (i % 2), 'bus', Date.now() - (24 - i) * 30000]);
  const D = await player('Flooded', { kn: 26, kf });
  await sleep(300);
  const E = await player('Later');
  const d = E.welcome.players.find((p) => p.id === D.id);
  const fromBus = d.kf.filter((k) => k[1] === 'bus').length;
  console.log(`      a later player sees: kn ${d.kn}, ${d.kf.length} listed, ${fromBus} from "bus"`);
  assert.equal(fromBus, KUDOS_PAIR, 'the saved day still lists more than the share from one player');
  assert.equal(d.kn, 26 - (24 - KUDOS_PAIR), 'the count was not lowered by those dropped');
  ok('a flooded day saved before the rule comes back with three of theirs');

  for (const p of [A, B, C, A2, D, E]) assert.equal(p.closed, null, `${p.name} was shut: ${JSON.stringify(p.closed)}`);
  console.log('kudos limit test: all ok');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  stop();
  setTimeout(() => process.exit(process.exitCode || 0), 200);
}
