// Top 10 by driving time on /stats (Martin 2026-11-26): the lobby (worker/index.js loadTick) names who is driving
// once a minute, worker/stats.js gives each name the minute and answers with the ten longest.
// A Lobby's minute tick into a real Stats object over node:sqlite.
//   node tools/top-drivers-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');
const { Stats, addDrivers, driversFrom, driversText, topDrivers } = await import(root + '/worker/stats.js');

let clock = Date.UTC(2026, 10, 26, 18, 0, 5);
Date.now = () => clock;
const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
let writes = 0;
const sql = { exec: (q, ...a) => { const st = db.prepare(q); if (/^\s*INSERT/i.test(q)) writes++; return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const mkStats = () => new Stats({ storage: { sql } }, {});
let S = mkStats();

const sockets = [];
const L = Object.create(Lobby.prototype);
L.env = { STATS: { idFromName: () => 1, get: () => ({ addLoad: (s) => Promise.resolve(S.addLoad(JSON.parse(JSON.stringify(s)))) }) } };
L.ctx = { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock) };
L.race = { live: () => true };
L.initLoad();
const add = (id, name, o = {}) => { const s = { a: { id, name, at: clock, ...o }, deserializeAttachment() { return this.a; } }; sockets.push(s); return s; };
const get = async (q) => (await S.fetch(new Request('https://x/api/stats?' + q, { headers: { 'cf-connecting-ip': String(Math.random()) } }))).json();
const tick = (min = 1) => { for (let i = 0; i < min; i++) { clock += 60000; L.loadTick(clock); } };

// who counts: driving, or on the map on a stage run; not the garage, a spectator or a ghost
const martin = add('a', 'Martin', { drv: true });
add('b', 'Garage Gary', { w: 'garage' });
add('c', 'StageSam', { w: 'map' });
add('d', 'Ghost', { drv: true, ghost: true });
add('e', 'Watcher', { w: 'watch' });
const kiire = add('f', 'KiireJuku', { drv: true });
tick(10);
let r = await get('hours=24');
assert.equal(r.drivers.n, 3, JSON.stringify(r.drivers));
assert.deepEqual(r.drivers.top.map((p) => [p.name, p.sec]).sort(), [['KiireJuku', 600], ['Martin', 600], ['StageSam', 600]]);

// the same name in other capitals is the same driver (shown as last written), a rename is a new line
martin.a.name = 'MARTIN';
kiire.a.drv = false; kiire.a.w = 'garage';
S.cache.clear();
tick(5);
r = await get('hours=24');
assert.deepEqual(r.drivers.top[0], { name: 'MARTIN', sec: 900 });
assert.equal(r.drivers.top.find((p) => p.name === 'KiireJuku').sec, 600);
martin.a.name = 'Someone Else';
S.cache.clear();
tick(2);
r = await get('days=7');
assert.equal(r.drivers.n, 4);
assert.deepEqual(r.drivers.top.map((p) => p.name), ['StageSam', 'MARTIN', 'KiireJuku', 'Someone Else']);
assert.equal(r.drivers.top[0].sec, 17 * 60);
// names are in the stats answer only as the top list (the totals stay without them)
assert.ok(!JSON.stringify(r.total).includes('StageSam'));

// a deploy: both objects start afresh and the lobby's first tick lands in a minute already counted: not twice
S = mkStats();
L.initLoad();
L.loadTick(clock + 5000);
r = await get('days=7');
assert.equal(r.drivers.top[0].sec, 17 * 60, 'a minute is not counted twice after a restart');
tick(1);
S.cache.clear();
r = await get('days=7');
assert.equal(r.drivers.top[0].sec, 18 * 60);

// two rows written a minute for the drivers, however many drive (and none when nobody does)
for (let i = 0; i < 60; i++) add('x' + i, 'Crowd' + i, { drv: true });
let w0 = writes; tick(1);
assert.equal(writes - w0, 4, 'day and hour row for the drivers, day and hour row for the load');
for (const s of sockets) { s.a.drv = false; s.a.w = 'garage'; }
w0 = writes; tick(1);
assert.equal(writes - w0, 2, 'nobody driving: only the load rows');
S.cache.clear();
r = await get('hours=24');
assert.equal(r.drivers.top.length, 10);
assert.equal(r.drivers.n, 64);

// the next hour and the next day: a new row each, the old hours leave the 24 h answer, days add up
sockets.length = 0;
add('a', 'martin', { drv: true });
clock += 26 * 3600000;
tick(3);
S.cache.clear();
r = await get('hours=24');
assert.deepEqual(r.drivers, { n: 1, top: [{ name: 'martin', sec: 180 }] });
r = await get('days=7');
assert.deepEqual(r.drivers.top[0], { name: 'StageSam', sec: 19 * 60 });
assert.deepEqual(r.drivers.top.find((p) => p.name.toLowerCase() === 'martin'), { name: 'martin', sec: 900 + 180 });
// hours older than two days are dropped as a new hour begins
clock += 49 * 3600000; tick(1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM drive_hours').get().n, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM drive_days').get().n, 3);

// the rows themselves: a full day takes no new names but keeps counting the ones it has; odd names
const t = driversFrom('');
assert.equal(addDrivers(t, ['A', 'a', ' B ', '', 7, '__proto__', 'x'.repeat(40), '<b>'], 10, 3), true);
assert.deepEqual([...t.map.values()], [['A', 60], ['B', 60], ['__proto__', 60]]);
assert.equal(addDrivers(t, ['A', 'New'], 10, 3), false, 'the same minute again');
assert.equal(addDrivers(t, ['New'], 11, 3), false, 'full: no new names');
assert.equal(addDrivers(t, ['A', 'New'], 12, 3), true);
assert.deepEqual(driversFrom(driversText(t)), t);
assert.deepEqual(topDrivers([t, driversFrom('{"m":1,"d":[["b",30],["bad"],[5,5]]}')], 2), { n: 3, top: [{ name: 'A', sec: 120 }, { name: 'b', sec: 90 }] });
assert.deepEqual(driversFrom('nonsense'), { m: 0, map: new Map() });
console.log('top drivers: ok', JSON.stringify(r.drivers.top.slice(0, 3)));
