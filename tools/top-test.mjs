// The lap board's five best per car (worker/tops.js, GET /api/top; Martin 26 Nov 2026), held against every stored lap:
// a Lobby over node:sqlite is given all the laps of the live site (only read from it, /api/laps.json), and its lists
// are compared with the same lists worked out here the plain way, and with the board's own best per car. Then: a new
// lap updates them as a fresh count would, midnight empties today's, laps held off the board and hidden cars stay out,
// the place of one's own time, and that the address only reads (no POST, odd input, its limit a minute).
//   node tools/top-test.mjs                (downloads the laps from www.linnaring.com)
//   node tools/top-test.mjs laps.json      (a copy)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
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
const { HIDDEN_CARS } = await import(root + '/src/cars/specs.js');

const src = process.argv[2];
const laps = src ? JSON.parse(readFileSync(src, 'utf8')) : await (await fetch('https://www.linnaring.com/api/laps.json')).json();
assert.ok(Array.isArray(laps) && laps.length > 100, 'laps read');
const lastAt = laps.reduce((m, l) => (l.at > m ? l.at : m), '');
let clock = Date.parse(lastAt) + 60000;
// (the lobby's clock, also for a bare new Date(): the test moves it past midnight)
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } };
globalThis.WebSocketRequestResponsePair = class {};

const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const ctx = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => [], getWebSocketAutoResponseTimestamp: () => new Date(clock), waitUntil() {} };
const env = { STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true), addRace: () => Promise.resolve() }) } };
const L = new Lobby(ctx, env);

const ins = (l) => sql.exec('INSERT INTO laps (id, track, name, car, ms, at, day, splits, cp, inp, ty, pen, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ...[l.id, l.track, l.name, l.car, l.ms, l.at, l.day, l.splits, l.cp, l.inp, l.ty, l.pen, l.hold].map((v) => v ?? null));
for (const l of laps) ins(l);
sql.exec("DELETE FROM meta WHERE k = 'board'");
L.cache = null;

let ipN = 0;
const get = async (path, method = 'GET') => {
  const r = await L.fetch(new Request('https://www.linnaring.com' + path, { method, headers: { 'cf-connecting-ip': `10.0.0.${(ipN++ % 200) + 1}` } }));
  return { status: r.status, j: await r.json().catch(() => null) };
};
const tartuDay = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(d);

// the plain way: every lap on the board, one best a driver (names whatever their capitals), fastest first, of two
// equal times the one driven first
function plain(list, track, car, day) {
  const m = new Map();
  for (const l of list) {
    if (l.hold != null || l.track !== track || l.car !== car || (day && l.day !== day)) continue;
    const k = l.name.toLowerCase(), had = m.get(k);
    if (!had || l.ms < had.ms || (l.ms === had.ms && l.at < had.at)) m.set(k, l);
  }
  return [...m.values()].sort((a, b) => a.ms - b.ms || (a.at < b.at ? -1 : 1));
}
const same = (got, want, what) => {
  assert.equal(got.length, Math.min(5, want.length), `${what}: how many`);
  got.forEach((g, i) => {
    assert.equal(g.ms, want[i].ms, `${what} #${i + 1} time`);
    assert.equal(g.name.toLowerCase(), want[i].name.toLowerCase(), `${what} #${i + 1} driver`);
    assert.equal(g.at, want[i].at, `${what} #${i + 1} when`);
  });
  assert.equal(new Set(got.map((g) => g.name.toLowerCase())).size, got.length, `${what}: a driver once`);
};

// 1) every car on both circuits against the plain count and against the board
let { status, j: top } = await get('/api/top');
assert.equal(status, 200);
const { j: board } = await get('/api/board');
const today = tartuDay(new Date(clock));
assert.equal(top.day, today, "today is Tartu's day");
let cars = 0, lines = 0;
for (const track of ['toomemagi', 'raadi']) {
  const part = track === 'toomemagi' ? board : board[track];
  const onBoard = [...new Set(laps.filter((l) => l.track === track && l.hold == null).map((l) => l.car))];
  assert.deepEqual(Object.keys(top[track].top).sort(), onBoard.filter((c) => !HIDDEN_CARS.includes(c)).sort(), `${track}: the cars with laps`);
  for (const [car, t] of Object.entries(top[track].top)) {
    const all = plain(laps, track, car), day = plain(laps, track, car, today);
    same(t.all, all, `${track} ${car} ever`);
    same(t.today, day, `${track} ${car} today`);
    assert.equal(t.n, all.length, `${track} ${car} drivers`);
    const b1 = part.allTime.find((r) => r.car === car);
    assert.equal(t.all[0].ms, b1.ms, `${track} ${car}: the first is the board's best ever`);
    const d1 = part.today.find((r) => r.car === car);
    assert.equal(t.today[0]?.ms, d1?.ms, `${track} ${car}: the first today is the board's best today`);
    cars++; lines += t.all.length + t.today.length;
  }
}
console.log(`1. ${laps.length} laps: ${cars} cars on two circuits, ${lines} lines, all as the plain count and the board`);

// 2) laps off the board (held for their replay, or taken off) and cars not shown are never in the lists
const fastest = plain(laps, 'toomemagi', 'f40')[0];
ins({ id: 900001, track: 'toomemagi', name: 'HeldLap', car: 'f40', ms: fastest.ms - 5000, at: new Date(clock).toISOString(), day: today, hold: 1 });
ins({ id: 900002, track: 'toomemagi', name: 'TakenOff', car: 'f40', ms: fastest.ms - 6000, at: new Date(clock).toISOString(), day: today, hold: 2 });
ins({ id: 900003, track: 'toomemagi', name: 'Rocketeer', car: 'rocket', ms: 120000, at: new Date(clock).toISOString(), day: today, hold: null });
L.tops = null;
({ j: top } = await get('/api/top'));
assert.ok(!top.toomemagi.top.f40.all.some((r) => r.name === 'HeldLap' || r.name === 'TakenOff'), 'held laps stay out');
assert.ok(!top.toomemagi.top.rocket, 'a hidden car stays out');
console.log('2. held laps, laps taken off and hidden cars stay out');

// 3) a new lap (as addToBoard is told of it) updates the lists as a fresh count of the table would
const now = new Date(clock).toISOString();
const add = (l) => { const row = { id: 900100 + lines++, at: now, day: today, inp: 'kb', ty: null, pen: null, hold: null, splits: null, cp: null, ...l }; ins(row); L.addToBoard(row); laps.push(row); };
const m3 = plain(laps, 'toomemagi', 'm3');
add({ track: 'toomemagi', name: 'NewFace', car: 'm3', ms: m3[2].ms - 1 });                 // into third
add({ track: 'toomemagi', name: m3[4].name.toUpperCase(), car: 'm3', ms: m3[0].ms - 1 });  // the fifth, in other capitals, now first
add({ track: 'toomemagi', name: m3[1].name, car: 'm3', ms: m3[1].ms + 5000 });             // slower than their own best: no change
add({ track: 'raadi', name: 'StageNew', car: 'f40', ms: 150000, pen: 5 });                // a car with no stage time yet
({ j: top } = await get('/api/top'));
const kept = JSON.stringify(top);
L.tops = null;
const { j: fresh } = await get('/api/top');
assert.equal(kept, JSON.stringify(fresh), 'kept up to date as a fresh count');
same(top.toomemagi.top.m3.all, plain(laps, 'toomemagi', 'm3'), 'm3 after new laps');
assert.equal(top.toomemagi.top.m3.all[0].name, m3[4].name.toUpperCase(), 'a driver once, by the faster lap, whatever the capitals');
assert.equal(top.raadi.top.f40.all[0].pen, 5, 'penalty seconds carried');
console.log('3. new laps: kept up to date exactly as a fresh count (a new driver, a renamed-capitals best, a slower lap, a new car)');

// 4) the place of one's own time: the other drivers with a faster best, plus one; one's own board times do not count
const imp = plain(laps, 'toomemagi', 'impreza');
const me = imp[10].name, mine = imp[10].ms - 1;
({ j: top } = await get(`/api/top?me=${encodeURIComponent(me)}&toomemagi=impreza.${mine},bus.999999,f40.1&raadi=f40.200000`));
const want = 1 + imp.filter((r) => r.name.toLowerCase() !== me.toLowerCase() && r.ms < mine).length;
assert.deepEqual(top.toomemagi.place.impreza, [want, mine], 'place of a time');
assert.equal(top.toomemagi.place.f40[0], 1, 'faster than all: first');
assert.equal(top.toomemagi.place.bus[0], plain(laps, 'toomemagi', 'bus').length + 1, 'slower than all: last');
assert.equal(top.raadi.place.f40[0], 2, 'on the stage too');
({ j: top } = await get(`/api/top?me=${encodeURIComponent(imp[0].name.toLowerCase())}&toomemagi=impreza.${imp[0].ms + 1}`));
assert.equal(top.toomemagi.place.impreza[0], 1, "one's own faster best does not count against one");
console.log(`4. places: ${me} at ${mine} ms is place ${want} of ${imp.length}, own times not counted`);

// 5) past midnight in Tartu today's lists start again, the ever lists stay
clock += 24 * 3600000;
({ j: top } = await get('/api/top'));
assert.equal(top.day, tartuDay(new Date(clock)));
assert.ok(Object.values(top.toomemagi.top).every((t) => t.today.length === 0), "today's lists empty after midnight");
assert.ok(top.toomemagi.top.m3.all.length === 5, 'the ever lists stay');
add({ track: 'toomemagi', name: 'Early', car: 'm3', ms: 200000, day: tartuDay(new Date(clock)), at: new Date(clock).toISOString() });
({ j: top } = await get('/api/top'));
assert.equal(top.toomemagi.top.m3.today[0]?.name, 'Early', "the new day's first lap");
console.log('5. midnight: today starts again, ever stays');

// 6) only read: no other method, odd input changes nothing and breaks nothing, a limit a minute from one address
const before = JSON.stringify((await get('/api/top')).j.toomemagi.top);
for (const m of ['POST', 'PUT', 'DELETE']) assert.equal((await get('/api/top', m)).status, 404, `${m} is no address`);
for (const q of ['?toomemagi=constructor.5,__proto__.1,rocket.170000,f40.-5,f40.abc,f40.1.2,,.,m3.99999999999', '?me=%3Cscript%3E&toomemagi=' + 'f40.1,'.repeat(500), '?raadi[]=x&me[]=y', '?toomemagi=toString.1&__proto__=1']) {
  const r = await get('/api/top' + q);
  assert.equal(r.status, 200, `odd input answered: ${q.slice(0, 40)}`);
  assert.ok(!r.j.toomemagi.place.constructor || typeof r.j.toomemagi.place.constructor === 'function', 'no place for a made-up car');
  assert.ok(Object.keys(r.j.toomemagi.place).every((c) => ['f40', 'm3'].includes(c)), 'places only for real cars');
}
assert.equal(JSON.stringify((await get('/api/top')).j.toomemagi.top), before, 'asking changes nothing');
const one = async () => (await L.fetch(new Request('https://www.linnaring.com/api/top', { headers: { 'cf-connecting-ip': '9.9.9.9' } }))).status;
const codes = [];
for (let i = 0; i < 45; i++) codes.push(await one());
assert.equal(codes.filter((c) => c === 200).length, 40, '40 a minute from one address');
assert.equal(codes.at(-1), 429, 'then too many');
console.log('6. only read: other methods 404, odd input harmless, 40 a minute from one address');
console.log('top-test: all passed');
