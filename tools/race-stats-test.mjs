// Race stats for /stats: worker/race.js reports each race (and lapsed START votes) to worker/stats.js.
// Plays a few races on a RaceDesk with a fake lobby and checks what reaches the day's totals.
//   node tools/race-stats-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject {}', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { RaceDesk } = await import(root + '/worker/race.js');
const { addRace, sumDays } = await import(root + '/worker/stats.js');

let clock = 1_800_000_000_000;
Date.now = () => clock;
const reports = [];
function mkLobby(people) {
  const meta = {};
  const sockets = people.map((p) => ({ a: { id: p.id, name: p.id, car: p.car, drv: true, at: clock }, send() {}, deserializeAttachment() { return this.a; }, serializeAttachment(a) { this.a = a; } }));
  return {
    sockets,
    meta: (k) => meta[k] ?? null, setMeta: (k, v) => { meta[k] = v; },
    broadcast() {},
    raceStat: (r) => reports.push(JSON.parse(JSON.stringify(r))),
    ctx: { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock), storage: { setAlarm: () => Promise.resolve() } },
  };
}
const L = mkLobby([{ id: 'a', car: 'w201' }, { id: 'b', car: 'f40' }, { id: 'c', car: 'w201' }, { id: 'd', car: 'f40' }]);
for (const s of L.sockets) s.a.at = clock;
const desk = new RaceDesk(L);
const msg = (i, m) => { L.sockets[i].a.at = clock; desk.message(L.sockets[i], L.sockets[i].a, m); };
// (the server saw that racer's car go round and cross the line at that time: worker/follow.js, tools/follow-test.mjs)
const over = (i, ms) => { const r = desk.s.racers.find((x) => x.id === L.sockets[i].a.id); r.fs = (r.go || desk.s.tGreen) + ms + 50; };

// 1) one start vote lapses
msg(0, { t: 'rv', on: 1 });
clock += 121000;
msg(1, { t: 'rv', on: 1 });      // lapse of a's vote is found here; b's vote counted
assert.equal(reports.length, 1, 'lapse reported');
assert.equal(reports[0].votes.lapsed, 1);
// 2) a and b vote -> race (2 of 4)
msg(0, { t: 'rv', on: 1 });
assert.equal(desk.s.phase, 'on');
msg(2, { t: 'rj', on: 1 });     // c joins in the countdown
clock = desk.s.tGrid + 100;
msg(3, { t: 'rj', on: 1 });     // d late on the grid
clock = desk.s.tGreen + 150000;
over(0, 148000); msg(0, { t: 'rf', ms: 148000 });
msg(1, { t: 'rd', why: 'off' });
over(2, 149500); msg(2, { t: 'rf', ms: 149500 });
over(3, 150000); msg(3, { t: 'rf', ms: 150000 });
assert.equal(desk.s.phase, 'idle');
const r1 = reports[1];
assert.equal(r1.ran, true); assert.equal(r1.end, 'done'); assert.equal(r1.racers.length, 4);
assert.equal(r1.votes.start, 2);
// 3) race 2, restarted by vote
msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 });
clock = desk.s.tGreen + 40000;
msg(1, { t: 'rd', why: 'cut' });
msg(0, { t: 'rv', on: 1 });   // restart: a alone in... rs = [a] and others driving -> none
msg(1, { t: 'rv', on: 1 });
// a is the only one in; ballot none; end via quit
msg(0, { t: 'rj', on: 0 });
const r2 = reports.at(-1);
assert.equal(r2.end, 'empty');
// 4) race called off before the lights
msg(2, { t: 'rv', on: 1 }); msg(3, { t: 'rv', on: 1 });
assert.equal(desk.s.phase, 'on');
msg(2, { t: 'rj', on: 0 }); msg(3, { t: 'rj', on: 0 });
assert.equal(desk.s.phase, 'idle');
assert.equal(reports.at(-1).ran, false);
// 5) a restart that passes: 4 racers, two vote restart (need 3) -> three
msg(0, { t: 'rv', on: 1 }); msg(1, { t: 'rv', on: 1 });
for (const i of [2, 3]) msg(i, { t: 'rj', on: 1 });
clock = desk.s.tGreen + 30000;
msg(3, { t: 'rd', why: 'car' });
for (const i of [0, 1, 2]) msg(i, { t: 'rv', on: 1 });
const r5 = reports.at(-1);
assert.equal(r5.end, 'restart', JSON.stringify(r5));
assert.equal(r5.votes.restart, 2);
assert.deepEqual(r5.racers.map((x) => x.out).sort(), ['car', 'restart', 'restart', 'restart']);

// into stats
const days = [{}, {}];
reports.forEach((r, i) => assert.ok(addRace(days[i % 2], r, clock)));
const tot = sumDays(days);
assert.equal(tot.race.n, 3);
assert.equal(tot.race.cancel, 1);
assert.equal(tot.raceBest.w201, 148000);
assert.equal(tot.raceBest.f40, 150000);
assert.equal(tot.race.wins, 1);
assert.equal(tot.race.late, 1);
assert.equal(addRace({}, { v: 2 }), false);
// junk is dropped
const j = {}; addRace(j, { v: 1, ran: true, end: 'x', racers: [{ car: 'nope', ms: 5, out: 'evil' }, null] }, clock);
assert.deepEqual(j.race.out, { quit: 1 });
assert.equal(j.race.car, undefined);
console.log('ok', reports.length, 'reports');
