// A deploy in the middle of a race, on the real lobby (Martin 2026-11-26 20:46: every connection dropped, the race was
// gone and a new vote was needed). Under `wrangler dev` a change to a worker file restarts the Durable Object as a
// deploy does. Three bare pages on the map, two of them race; after the lights the server is stopped and started
// again on the same storage (as a deploy: every socket gone, the race and its alarm read back), the pages come back
// (the roamer first; src/net/multiplayer.js asks again after 2, 4, 8 s), and the race must still be on with both
// racers in it. Fast part: tools/race-deploy-test.mjs.
//   node tools/race-deploy-live-test.mjs        (starts wrangler dev on port 8791 itself; about a minute)
import { spawn } from 'node:child_process';

const PORT = 8791;
const root = new URL('..', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function page(name, key) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws?w=${name.padEnd(8, '0')}&i=1&r=1`);
    const me = { name, ws, race: null, closed: null };
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', b: 1, name, car: 'w201', w: 'map', k: key })); };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'race') me.race = m.r;
      if (m.t === 'welcome') { me.id = m.id; me.key = m.key; ws.send(JSON.stringify({ t: 'drv', on: 1 })); resolve(me); }
    };
    ws.onclose = (e) => { me.closed = e.code; };
    ws.onerror = () => reject(new Error('no connection'));
  });
}
let dev = null, log = '';
const start = () => {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/race-deploy-live-${process.pid}`],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  dev.stdout.on('data', (d) => { log += d; }); dev.stderr.on('data', (d) => { log += d; });
};
const stop = () => { try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* gone */ } };
process.on('exit', stop);
start();
const up = async () => {
  for (const t0 = Date.now(); Date.now() - t0 < 180000; await sleep(300)) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/online`)).ok) return; } catch { /* not yet */ }
  }
  console.log(log); throw new Error('wrangler dev did not start');
};
let fail = 0;
try {
  await up();
  const pages = [await page('Roamer'), await page('RacerA'), await page('RacerB')];
  const [roamer, a, b] = pages;
  await sleep(300);
  a.ws.send(JSON.stringify({ t: 'rv', on: 1 })); b.ws.send(JSON.stringify({ t: 'rv', on: 1 }));
  await sleep(500);
  const r0 = a.race;
  if (!r0?.on) throw new Error(`no race started: ${JSON.stringify(r0)}`);
  console.log(`  race ${r0.id} on with ${r0.racers.map((r) => r.name).join(', ')}; lights out in ${((r0.tGreen - r0.now) / 1000).toFixed(1)} s`);
  // past the lights and the 10 s every racer has after them (quiet() in worker/race.js)
  await sleep(r0.tGreen - r0.now + 12000);
  if (a.race.racers.some((r) => r.out)) throw new Error(`a racer out before the restart: ${JSON.stringify(a.race.racers)}`);
  // the deploy: the server goes down at once and comes up again on the same storage
  stop();
  for (const t0 = Date.now(); pages.some((p) => p.closed == null) && Date.now() - t0 < 10000;) await sleep(50);
  const t1 = Date.now();
  start();
  await up();
  console.log(`  server restarted (sockets closed ${pages.map((p) => p.closed).join(', ')}), up again after ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  // back in, the roamer first
  const back = [];
  for (const p of pages) { back.push(await page(p.name, p.key)); await sleep(150); }
  await sleep(20000);
  const r1 = back[1].race;
  const same = back.every((p, i) => p.id === pages[i].id);
  console.log(`  after the restart: race ${r1?.id} ${r1?.on ? 'on' : 'off'}, ${(r1?.racers || []).map((r) => `${r.name} ${r.out || 'in'}`).join(', ') || 'no racers'}; same ids ${same}`);
  if (!(r1?.on && r1.id === r0.id && r1.racers.length === 2 && r1.racers.every((r) => !r.out) && same)) { fail = 1; console.log('FAIL the race did not survive the restart'); }
  else console.log('ok the race went on through the restart');
  for (const p of back) p.ws.close();
} catch (err) { fail = 1; console.log('FAIL', err.message); }
stop();
process.exit(fail);
