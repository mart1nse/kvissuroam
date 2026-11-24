// Online demand for /stats: the lobby (worker/index.js) counts pages refused with SERVER FULL once per wait,
// sends one sample a minute to worker/stats.js, which keeps sums and peaks per hour and day.
//   node tools/online-demand-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject {}', shortCircuit: true };
  return n(s, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');
const { addLoad, sumDays, loadView, loadSpan } = await import(root + '/worker/stats.js');

let clock = Date.UTC(2026, 10, 24, 18, 0, 5);
Date.now = () => clock;
const sent = [];
const sockets = [];
const L = Object.create(Lobby.prototype);
L.env = { MAX_ONLINE: '3', STATS: { idFromName: () => 1, get: () => ({ addLoad: (s) => { sent.push(s); return Promise.resolve(true); } }) } };
L.ctx = { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock) };
L.race = { live: () => true };
L.initLoad();
for (const [id, drv] of [['a', 1], ['b', 0], ['c', 1]]) sockets.push({ a: { id, drv: !!drv, at: clock }, deserializeAttachment() { return this.a; } });
const url = (w) => new URL('https://x/api/ws' + (w ? '?w=' + w : ''));

// first tick sends a sample; same minute again sends nothing
L.loadTick(clock);
assert.equal(sent.length, 1);
assert.deepEqual([sent[0].on, sent[0].drv, sent[0].wait, sent[0].cap], [3, 2, 0, 3]);
L.loadTick(clock + 1000);
assert.equal(sent.length, 1);

// page p1 asks 3 times (every 30 s), p2 once, an old page without ?w= twice: 3 turned away, 6 refusals
const k1 = L.waitKey(url('abcdef12'), '1.1.1.1'), k2 = L.waitKey(url('zzzzzz99'), '1.1.1.1'), k3 = L.waitKey(url(), '2.2.2.2');
assert.equal(L.waitKey(url('BAD!'), '9.9.9.9'), 'i|9.9.9.9');
clock += 60000;
L.refused(k1, clock); L.refused(k2, clock); L.refused(k3, clock);
clock += 30000; L.refused(k1, clock); L.refused(k3, clock);
clock += 30000; L.refused(k1, clock);
L.loadTick(clock);
assert.equal(sent.length, 2);
assert.deepEqual([sent[1].ref, sent[1].away, sent[1].wait], [6, 3, 3]);
// p2 and the old page went quiet for over 90 s: gone; p1 gets in after waiting 90 s
clock += 31000;
L.admitted(k1, clock);
clock += 30000;
L.loadTick(clock);
assert.deepEqual([sent[2].joined, sent[2].waitMs, sent[2].wait, sent[2].away, sent[2].ref], [1, 91000, 0, 0, 0]);
// a page that asks again after giving up is a new wait
clock += 100000; L.refused(k2, clock);
clock += 60000; L.loadTick(clock);
assert.equal(sent[3].away, 1);

// stats side: per-minute sums, peaks, averages over the minutes of the period
const h1 = {}, h2 = {};
for (const s of sent.slice(0, 2)) assert.ok(addLoad(h1, s));
for (const s of sent.slice(2)) addLoad(h2, s);
assert.equal(addLoad(h1, { v: 2 }), false);
assert.equal(h1.load.min, 2); assert.equal(h1.load.onMax, 3); assert.equal(h1.load.totMax, 6); assert.equal(h1.load.full, 1);
const tot = sumDays([h1, h2, { sessions: 4 }]);
assert.equal(tot.load.min, 4); assert.equal(tot.load.away, 4); assert.equal(tot.load.waitMax, 3); assert.equal(tot.load.totMax, 6);
assert.equal(tot.load.t0, Math.floor(sent[0].t / 60000) * 60000);
const span = loadSpan(tot.load, tot.load.t0 - 3600000, tot.load.t0 + 60 * 60000);
assert.equal(span, 60);
const v = loadView(tot.load, span);
assert.equal(v.on, Math.round(12 / 60 * 10) / 10);
assert.equal(v.joined, 1); assert.equal(v.waitAvg, 91);
assert.equal(loadView({}, 10), null);
console.log('online demand: ok', JSON.stringify(v));
