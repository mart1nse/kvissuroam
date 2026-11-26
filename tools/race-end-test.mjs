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

// Standing still (Martin 2026-11-26): all through but one who started and stood; out after a minute, the race ends
{
  if (desk.s.phase === 'on') desk.close('restart', clock);
  for (const s of sockets) s.a.drv = true;
  clock += 60000; alive();
  msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 });
  assert.equal(desk.s.racers.length, 2);
  const A = () => desk.s.racers.find((r) => r.id === 'a'), B = () => desk.s.racers.find((r) => r.id === 'b');
  const pos = (i, x, z) => desk.seen(sockets[i].a.id, [x, z, 0], clock);
  // on the grid from its start to the lights, b standing: not counted (standing there is the rule)
  clock = desk.s.tGrid; alive();
  for (; clock < desk.s.tGreen; clock += 1000) pos(1, 0, 0);
  // b drives off for 80 s at 20 m/s, then stops; a keeps going at 3 m/s on its way round
  const g = desk.s.tGreen;
  for (clock = g; clock < g + 80000; clock += 500) { alive(); pos(1, (clock - g) / 50, 0); pos(0, 0, (clock - g) * 0.003); }
  const stop = clock, bx = (stop - g) / 50;
  for (; clock < stop + 59000; clock += 500) { alive(); pos(1, bx + 3, 2); pos(0, 0, (clock - g) * 0.003); }
  assert.ok(!B().out, 'b inside the minute');
  assert.ok(!A().out, 'a slow but moving: in');
  assert.ok(B().still && desk.view().racers.every((x) => !('still' in x)), 'what the server keeps of the standing is not sent');
  // a finishes; b still standing: the race is on until b's minute is up
  over(0, clock - g); msg(0, { t: 'rf', ms: clock - g });
  assert.equal(A().ms, clock - g);
  assert.equal(desk.s.phase, 'on', 'b still in');
  for (; clock < stop + 61000; clock += 500) { alive(); pos(1, bx, 0); }
  assert.equal(desk.s.phase, 'idle', 'b out for standing: all through, closed');
  assert.deepEqual(desk.s.last.racers.map((r) => [r.id, r.out]), [['a', null], ['b', 'still']]);

  // a gap in the positions starts the minute again; a racer standing right after the lights is out a minute after them
  clock += 60000; alive();
  msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 }); msg(2, { t: 'rj', on: 1 });
  clock = desk.s.tGrid; alive();
  for (; clock < desk.s.tGreen; clock += 1000) { pos(0, 10, 10); pos(1, 20, 20); pos(2, 30, 30); }
  const g2 = desk.s.tGreen;
  for (clock = g2; clock < g2 + 40000; clock += 500) { alive(); pos(0, 10, 10); pos(1, 20, 20); pos(2, 30 + (clock - g2) / 20, 30); }
  // a's page sends nothing for 10 s (a stall on the way), then the same place again
  for (; clock < g2 + 50000; clock += 500) { alive(); pos(1, 20, 20); pos(2, 30 + (clock - g2) / 20, 30); }
  for (; clock < g2 + 61000; clock += 500) { alive(); pos(0, 10, 10); pos(1, 20, 20); pos(2, 30 + (clock - g2) / 20, 30); }
  const R = (id) => desk.s.racers.find((r) => r.id === id);
  assert.equal(R('b').out, 'still', 'b stood from the lights: out a minute after them');
  assert.ok(!R('a').out, 'a: the gap started its minute again');
  for (; clock < g2 + 109000; clock += 500) { alive(); pos(0, 10, 10); pos(2, 30 + (clock - g2) / 20, 30); }
  assert.ok(!R('a').out, 'a: not yet a minute since the gap');
  for (; clock < g2 + 111000; clock += 500) { alive(); pos(0, 10, 10); pos(2, 30 + (clock - g2) / 20, 30); }
  assert.equal(R('a').out, 'still', 'a: a minute of positions after the gap');
  assert.ok(!R('c').out, 'c driving: in');
  // seen over the line and standing there, its "finished" not here yet: not put out, the finish is settled
  for (; clock < g2 + 125000; clock += 500) { alive(); pos(2, 30 + (clock - g2) / 20, 30); }
  const cm = clock - g2;
  over(2, cm);
  for (const end = clock + 70000; clock < end; clock += 500) { alive(); pos(2, 500, 500); }
  assert.ok(!R('c').out, 'c over the line: not out for standing');
  msg(2, { t: 'rf', ms: cm });
  assert.equal(desk.s.phase, 'idle');
  assert.equal(desk.s.last.racers.find((r) => r.id === 'c').ms != null, true, 'c finished');
}

// Idle once the winner is through (Martin 2026-11-26 22:34: the racer at 0.1 km stalling the race again): a minute
// after the first finish, a racer who has passed no gate of the lap for a minute is out, whether their car stands,
// potters about or sends nothing; one getting on with the lap stays in
{
  if (desk.s.phase === 'on') desk.close('restart', clock);
  for (const s of sockets) s.a.drv = true;
  clock += 60000; alive();
  msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 }); msg(2, { t: 'rj', on: 1 }); msg(3, { t: 'rj', on: 1 });
  assert.equal(desk.s.racers.length, 4);
  const R = (id) => desk.s.racers.find((r) => r.id === id);
  const pos = (i, x, z) => desk.seen(sockets[i].a.id, [x, z, 0], clock);
  const g = desk.s.tGreen;
  // b potters about near the start (30 m out and back every 20 s: never a minute within 25 m, so never 'still');
  // c gets on with the lap (a gate every few seconds, as follow.js would mark it); d's page sends no positions
  const step = () => { alive(); pos(1, Math.floor((clock - g) / 20000) % 2 ? 30 : 0, 0); if ((clock - g) % 4000 === 0) R('c').gs = clock; };
  for (clock = g; clock < g + 150000; clock += 500) step();
  assert.ok(!R('b').out && !R('c').out && !R('d').out, 'nobody through: nobody out for idling');
  over(0, 150000); msg(0, { t: 'rf', ms: 150000 });
  assert.equal(R('a').ms, 150000, 'a wins');
  for (; clock < g + 150000 + 59000; clock += 500) { step(); if (clock % 15000 < 500) desk.alarm(); }
  assert.ok(!R('b').out && !R('d').out, 'inside the minute after the winner');
  for (; clock < g + 150000 + 76000; clock += 500) { step(); if (clock % 15000 < 500) desk.alarm(); }
  assert.equal(R('b').out, 'idle', 'b pottering about, no gate: out');
  assert.equal(R('d').out, 'idle', 'd sending nothing: out');
  assert.ok(!R('c').out, 'c on its way round: in');
  assert.equal(desk.s.phase, 'on', 'c still racing');
  // c stops getting on with the lap: out a minute after its last gate, and the race ends
  const lastGate = R('c').gs;
  for (; clock < lastGate + 76000; clock += 500) { alive(); if (clock % 15000 < 500) desk.alarm(); }
  assert.equal(desk.s.phase, 'idle', 'all through or out: closed');
  assert.deepEqual(desk.s.last.racers.map((r) => [r.id, r.ms != null, r.out]), [['a', true, null], ['b', false, 'idle'], ['c', false, 'idle'], ['d', false, 'idle']]);
}
console.log('ok race end');
