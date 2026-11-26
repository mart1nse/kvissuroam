// A deploy in the middle of a race (Martin 2026-11-26 20:46: everyone lost the connection, the race was gone and a
// new vote was needed). The server restarts: its sockets are gone, the race is read back from storage, and the
// pages come back two seconds later (src/net/multiplayer.js). The race must still be on when they are back.
//   node tools/race-deploy-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { RaceDesk } = await import(root + '/worker/race.js');

let clock = 1_800_000_000_000;
Date.now = () => clock;
const meta = {};
const sock = (id, drv = true) => ({ a: { id, name: id, car: 'w201', drv, at: clock }, ping: clock, send() {}, deserializeAttachment() { return this.a; }, serializeAttachment(a) { this.a = a; } });
let sockets = ['a', 'b', 'c', 'x'].map((id) => sock(id));
const L = {
  meta: (k) => meta[k] ?? null, setMeta: (k, v) => { meta[k] = v; }, broadcast() {},
  ctx: { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: (ws) => new Date(ws.ping), storage: { setAlarm: () => Promise.resolve() } },
};
const lobby = () => ({ ...L, ctx: { ...L.ctx } });
let desk = new RaceDesk(lobby());
const msg = (ws, m) => { ws.a.at = clock; desk.message(ws, ws.a, m); };
const find = (id) => sockets.find((s) => s.a.id === id);
msg(find('a'), { t: 'rv', on: 1 }); msg(find('b'), { t: 'rv', on: 1 }); msg(find('c'), { t: 'rj', on: 1 });
assert.equal(desk.s.phase, 'on');
assert.deepEqual(desk.s.racers.map((r) => r.id), ['a', 'b', 'c'], 'x drives about, not racing');
clock = desk.s.tGreen + 60000;
desk.alarm();
assert.equal(desk.s.phase, 'on');
const raceId = desk.s.id;

const scenario = (name, before) => {
  // the deploy: the server starts again with no sockets; what it had is read back from storage
  const saved = meta.race;
  sockets = [];
  clock += 1;
  desk = new RaceDesk(lobby());
  before?.();
  // two seconds later the pages say hello again (index.js: back() for each), then drv on
  clock += 2000;
  const back = ['x', 'a', 'b', 'c'].map((id) => sock(id, false));
  for (const ws of back) {
    sockets.push(ws);
    desk.back(ws.a);
    msg(ws, { t: 'drv', on: 1 });
  }
  clock += 15000; desk.alarm();
  const ok = desk.s.phase === 'on' && desk.s.id === raceId && desk.s.racers.every((r) => !r.out);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: phase ${desk.s.phase}, race ${desk.s.id}, ${desk.s.racers.map((r) => `${r.id} ${r.out || 'in'}`).join(', ') || 'no racers'}`);
  meta.race = saved;
  return ok;
};
const results = [
  scenario('the pages come back first (a driver who is not racing says drv first)'),
  scenario('the alarm fires before anyone is back', () => desk.alarm()),
];
// the old server is told of each socket closing as it goes down (if it is): the racers are 'left' for a moment
{
  const saved = meta.race;
  for (const ws of [...sockets]) { sockets = sockets.filter((x) => x !== ws); desk.gone(ws.a, ws); }
  results.push(scenario('the old server hears every socket close first', null));
  meta.race = saved;
}
// a racer who is really gone (closed the tab during the deploy) is out once the time to come back is over,
// and the race ends when the rest are through
{
  sockets = []; clock += 1; desk = new RaceDesk(lobby());
  clock += 2000;
  for (const id of ['a', 'b']) { const ws = sock(id, false); sockets.push(ws); desk.back(ws.a); msg(ws, { t: 'drv', on: 1 }); }
  clock += 15000; desk.alarm();
  assert.ok(!desk.s.racers.find((r) => r.id === 'c').out, 'c may still come back');
  clock += 30000; desk.alarm();
  assert.equal(desk.s.racers.find((r) => r.id === 'c').out, 'left', 'c is out once the time to come back is over');
  assert.equal(desk.s.phase, 'on', 'a and b race on');
  console.log('ok   a racer who does not come back is out after', 45, 's; the rest race on');
  // the last racers' tabs close: the race waits for them a moment, then ends
  for (const id of ['a', 'b']) { const ws = find(id); sockets = sockets.filter((x) => x !== ws); desk.gone(ws.a, ws); }
  assert.equal(desk.s.phase, 'on', 'held open for them to come back');
  clock += 46000; desk.alarm();
  assert.equal(desk.s.phase, 'idle', 'nobody came back: closed');
  console.log('ok   everyone gone: the race closes', 45, 's later');
}
process.exit(results.every(Boolean) ? 0 : 1);
