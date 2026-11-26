// The race ends when everyone is through (Martin 2026-11-24): racers whose page went quiet (no live socket, or
// off the map past the page's grace) are put out, so they do not hold the race open to 7:00.
//   node tools/race-end-test.mjs
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
const ids = ['a', 'b', 'c', 'd'];
const meta = {};
const sockets = ids.map((id) => ({ a: { id, name: id, car: 'w201', drv: true, at: clock }, ping: clock, send() {}, deserializeAttachment() { return this.a; }, serializeAttachment(a) { this.a = a; } }));
const L = {
  meta: (k) => meta[k] ?? null, setMeta: (k, v) => { meta[k] = v; }, broadcast() {},
  ctx: { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: (ws) => new Date(ws.ping), storage: { setAlarm: () => Promise.resolve() } },
};
const desk = new RaceDesk(L);
const alive = () => { for (const s of sockets) { s.ping = clock; } };
const msg = (i, m) => { sockets[i].a.at = clock; desk.message(sockets[i], sockets[i].a, m); };
// (the server saw that racer's car go round and cross the line at that time: worker/follow.js, tools/follow-test.mjs)
const over = (i, ms) => { const r = desk.s.racers.find((x) => x.id === sockets[i].a.id); r.fs = (r.go || desk.s.tGreen) + ms + 50; };
msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 }); msg(2, { t: 'rj', on: 1 }); msg(3, { t: 'rj', on: 1 });
assert.equal(desk.s.racers.length, 4);
assert.equal(desk.s.phase, 'on');
clock = desk.s.tGreen + 150000; alive();
// c's page goes to sleep (no ping, no hello for 80 s); d is in another tab (drv off)
sockets[2].ping = clock - 90000; sockets[2].a.at = clock - 90000;
msg(3, { t: 'drv', on: 0 });
assert.equal(desk.s.racers.find((r) => r.id === 'd').out, 'left', 'off the map: out');
over(0, 150000); msg(0, { t: 'rf', ms: 150000 });
assert.equal(desk.s.racers.find((r) => r.id === 'c').out, 'left', 'asleep: out');
assert.equal(desk.s.phase, 'on', 'b still racing');
// b's finish is lost; the alarm alone does not close a race with b connected and driving
clock += 15000; alive(); sockets[2].ping = 0; sockets[2].a.at = 0; desk.alarm();
assert.equal(desk.s.phase, 'on');
// b's page resends it when it sees it is still racing
over(1, 160000); msg(1, { t: 'rf', ms: 160000 });
assert.equal(desk.s.phase, 'idle', 'all through: closed');
assert.deepEqual(desk.s.last.racers.map((r) => [r.id, r.ms, r.out]), [['a', 150000, null], ['b', 160000, null], ['c', null, 'left'], ['d', null, 'left']]);

// a racer just away from their lights is not put out (the grace after their own go)
for (const s of sockets) s.a.drv = true;
alive();
msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 }); msg(2, { t: 'rj', on: 1 }); msg(3, { t: 'rj', on: 1 });
assert.equal(desk.s.racers.length, 4);
clock = desk.s.tGreen + 3000; alive();
sockets[3].a.drv = false;
desk.alarm();
assert.ok(!desk.s.racers.find((r) => r.id === 'd').out, 'inside the grace');
clock += 10000; alive(); desk.alarm();
assert.equal(desk.s.racers.find((r) => r.id === 'd').out, 'left');
// the car stays the one raced in: a change after the finish is not shown in the results
{
  const r = desk.s.racers.find((x) => x.id === 'a') || null;
  if (desk.s.phase === 'on' && r) {
    sockets[0].a.car = 'citywide'; desk.changed(sockets[0].a);
    assert.equal(r.car, 'w201', 'car kept after the lights');
  }
}
console.log('ok race end');
