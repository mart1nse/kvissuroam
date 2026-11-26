// The security review's fixes of 25 Nov 2026 (worker/index.js, worker/stats.js), on a Lobby over node:sqlite:
// believable minimum lap times, a car's new best held off the board until its replay holds up, laps capped per
// address and per name, and stealth-mode use counted for /stats. (Race finishes: tools/race-end-test.mjs.)
//   node tools/security-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
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
const { addLoad, sumDays, loadView } = await import(root + '/worker/stats.js');
const LAP = JSON.parse(readFileSync(new URL('../src/race/track.json', import.meta.url)));

let clock = Date.UTC(2026, 10, 25, 9, 0, 0);
Date.now = () => clock;
globalThis.WebSocketRequestResponsePair = class {};
const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const sockets = [], sent = [];
const ctx = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock), waitUntil() {} };
const env = { STATS: { idFromName: () => 1, get: () => ({ addLoad: (s) => { sent.push(s); return Promise.resolve(true); }, addRace: () => Promise.resolve() }) } };
const L = new Lobby(ctx, env);

const req = (path, body, ip = '1.1.1.1') => new Request('https://www.linnaring.com' + path, { method: body ? 'POST' : 'GET', headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
const call = async (path, body, ip) => { const r = await L.fetch(req(path, body, ip)); return { status: r.status, j: await r.json().catch(() => null) }; };
const ticket = async (ip) => (await call('/api/ticket', null, ip)).j.key;

// a drive around the lap as the replay's samples: the centre line, ms long, 10 a second
function trace(ms) {
  const P = [...LAP.pts, LAP.pts[0]];
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum.at(-1), n = Math.ceil(ms / 100) + 1, out = [1, 21, ms, n];
  let px = 0, pz = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.min(total, (total * i) / (n - 1));
    while (k < cum.length - 2 && cum[k + 1] < d) k++;
    const f = (d - cum[k]) / (cum[k + 1] - cum[k] || 1);
    const x = Math.round((P[k][0] + (P[k + 1][0] - P[k][0]) * f) * 100), z = Math.round((P[k][1] + (P[k + 1][1] - P[k][1]) * f) * 100);
    out.push(x - px, z - pz, ...new Array(19).fill(0));
    px = x; pz = z;
  }
  return gzipSync(out.join(',')).toString('base64');
}

// 1) a hand-made 61 s lap is not believed (the floor is 2:00 now)
let k = await ticket();
clock += 10 * 60000;
let r = await call('/api/lap', { name: 'Faker', car: 'f40', ms: 61000, k, ago: 0 });
assert.equal(r.status, 400, '61 s refused');

// 2) the first lap of a car: its best, so held off the board until its replay comes
// (the drive: the F40's record of 26 Nov 2026 as it came from a player's browser, tools/fixtures/replays)
const fixture = (name) => readFileSync(new URL(`./fixtures/replays/${name}.gz`, import.meta.url)).toString('base64');
const F40 = 153947;
r = await call('/api/lap', { name: 'Real', car: 'f40', ms: F40, k, ago: 0 });
assert.equal(r.status, 200);
assert.deepEqual(r.j.hold, [{ car: 'f40', ms: F40 }]);
assert.ok(!r.j.board.allTime.some((x) => x.car === 'f40'), 'held lap not on the board');
// a replay that does not hold up (1 m from the start line, then nothing): stays held
let bad = await call('/api/replay', { k, car: 'f40', ms: F40, z: gzipSync(`1,21,${F40},2,` + new Array(42).fill(0).join(',')).toString('base64') });
assert.equal(bad.status, 400);
assert.ok(!(await call('/api/board')).j.allTime.some((x) => x.car === 'f40'));
// a drive made up by hand, the lap's centre line at one even speed: through every gate, but no car takes the
// corners of Toomemägi at 115 km/h (26 Nov: the drive is held against the car, src/race/plausible.js)
bad = await call('/api/replay', { k, car: 'f40', ms: F40, z: trace(F40) });
assert.equal(bad.status, 400);
assert.equal(bad.j.error, 'replay refused: car', 'the sender is not told which limit');
assert.equal((await call('/api/replay?refused=1')).j[0].why, 'car', 'the open list does not say which limit either');
assert.match(db.prepare('SELECT why FROM replay_refused ORDER BY id DESC LIMIT 1').get().why, /^car: grip \(s over: pull /, 'the table has the figures');
// (with the admin key the list has them too)
env.ADMIN_KEY = 'k'.repeat(32);
assert.match((await (await L.fetch(new Request('https://www.linnaring.com/api/replay?refused=1', { headers: { authorization: `Bearer ${env.ADMIN_KEY}` } }))).json())[0].why, /^car: grip \(s over/);
delete env.ADMIN_KEY;
assert.ok(!(await call('/api/board')).j.allTime.some((x) => x.car === 'f40'));
// the real drive: on the board, and its replay kept
let twice;
[r, twice] = await Promise.all([0, 1].map(() => call('/api/replay', { k, car: 'f40', ms: F40, z: fixture('f40') })));
assert.equal(r.status, 200, JSON.stringify(r.j) + JSON.stringify((await call('/api/replay?refused=1')).j[0]));
assert.equal(twice.status, 200);
let b = (await call('/api/board')).j;
assert.equal(b.allTime.find((x) => x.car === 'f40')?.ms, F40, 'verified lap on the board');
assert.equal(b.rp.toomemagi?.f40, F40, 'replay kept');
// (the same replay sent twice at once: on the board once)
assert.equal(b.laps, 1);
assert.equal(b.recent.length, 1);

// 2b) the Audi 200 record of 26 Nov 2026, 2:45.29, driven with the car's figures changed in the browser (twice the
// pull, 2 g in the bends): through every gate and under 430 km/h, so it stood. Not that car's drive: stays held.
{
  const k2 = await ticket('5.5.5.5');
  clock += 4 * 60000;
  r = await call('/api/lap', { name: 'Tuned', car: 'audi200', ms: 165288, k: k2, ago: 0 }, '5.5.5.5');
  assert.deepEqual(r.j.hold, [{ car: 'audi200', ms: 165288 }]);
  const [x, y] = await Promise.all([0, 1].map(() => call('/api/replay', { k: k2, car: 'audi200', ms: 165288, z: fixture('audi200-tuned') }, '5.5.5.5')));
  assert.equal(x.status, 400); assert.equal(y.status, 400);
  assert.equal(x.j.error, 'replay refused: car');
  const why = db.prepare('SELECT why FROM replay_refused ORDER BY id DESC LIMIT 1').get().why;
  assert.match(why, /^car: pull /, why);
  b = (await call('/api/board')).j;
  assert.ok(!b.allTime.some((x) => x.car === 'audi200'), 'the tuned lap is not on the board');
  assert.equal(b.rp.toomemagi?.audi200, undefined, 'nor its replay kept');
  // a lap taken off the board for good (hold 2) is not brought back by any replay
  db.prepare("UPDATE laps SET hold = 2 WHERE car = 'f40' AND ms = ?").run(F40);
  r = await call('/api/replay', { k, car: 'f40', ms: F40, z: fixture('f40') });
  assert.equal(r.status, 400);
  db.prepare("UPDATE laps SET hold = NULL WHERE car = 'f40' AND ms = ?").run(F40);
}

// 3) a slower lap of the same car, while it is still among the car's ten best, waits for its replay too (26 Nov:
// Martin, "start checking top ten times per car")
clock += 5 * 60000;
r = await call('/api/lap', { name: 'Real', car: 'f40', ms: 155000, k, ago: 0 });
assert.deepEqual(r.j.hold, [{ car: 'f40', ms: 155000 }], 'a lap among the car\'s ten best is held');
assert.equal(r.j.board.laps, 1);
// ... and one that is not (ten faster laps of the car on the board, and the driver's own best faster) goes straight on
for (let i = 0; i < 10; i++) db.prepare("INSERT INTO laps (track, name, car, ms, at, day, sid, hold) VALUES ('toomemagi', ?, 'f40', ?, ?, ?, 'x', NULL)").run(`Other${i}`, 140000 + i * 1000, new Date(clock).toISOString(), '2026-11-25');
clock += 5 * 60000;
r = await call('/api/lap', { name: 'Real', car: 'f40', ms: 158000, k, ago: 0 });
assert.equal(r.j.hold, undefined, 'the 12th lap of a car, not the driver\'s best, goes straight on');
db.prepare("DELETE FROM laps WHERE name LIKE 'Other%'").run();
// a faster one without a replay never shows
clock += 5 * 60000;
r = await call('/api/lap', { name: 'Faker', car: 'f40', ms: 121000, k: await (async () => { const t = await ticket('2.2.2.2'); clock += 3 * 60000; return t; })(), ago: 0 }, '2.2.2.2');
assert.deepEqual(r.j.hold, [{ car: 'f40', ms: 121000 }]);
assert.equal(r.j.board.allTime.find((x) => x.car === 'f40').ms, F40, 'unverified 2:01 not on the board');
const all = (await call('/api/laps.json')).j;
assert.equal(all.find((x) => x.ms === 121000).hold, 1, 'the export marks it held');

// 3b) laps timed by the server's own clock (26 Nov 2026: under 20 frames a second the game and its lap clock ran in
// slow motion): the page marks a lap's start and finish as they happen, and a car's best counts only if the time
// between the marks agrees with the lap time
{
  const { OLD_PAGES_UNTIL } = await import(root + '/worker/cutover.js');
  const { gunzipSync } = await import('node:zlib');
  const msOf = (name) => Number(gunzipSync(readFileSync(new URL(`./fixtures/replays/${name}.gz`, import.meta.url))).toString().split(',', 3)[2]);
  const ip = '6.6.6.6', k3 = await ticket(ip), M3 = msOf('m3');
  clock += 60000;
  // slow motion: the lap took twice its time between the marks
  await call('/api/mark', { k: k3, e: 's' }, ip);
  clock += 2 * M3;
  assert.equal((await call('/api/mark', { k: k3, e: 'f', ms: M3 }, ip)).status, 200);
  r = await call('/api/lap', { name: 'Slow', car: 'm3', ms: M3, k: k3, ago: 0 }, ip);
  assert.deepEqual(r.j.hold, [{ car: 'm3', ms: M3 }]);
  r = await call('/api/replay', { k: k3, car: 'm3', ms: M3, z: fixture('m3') }, ip);
  assert.equal(r.status, 400); assert.equal(r.j.error, 'replay refused: clock');
  assert.ok(!(await call('/api/board')).j.allTime.some((x) => x.car === 'm3'), 'a lap in slow motion is not on the board');
  // 4 s more than the lap time between the marks: still slow motion, past the 3.5 s of leeway
  await call('/api/mark', { k: k3, e: 's' }, ip);
  clock += M3 + 4000;
  await call('/api/mark', { k: k3, e: 'f', ms: M3 }, ip);
  r = await call('/api/replay', { k: k3, car: 'm3', ms: M3, z: fixture('m3') }, ip);
  assert.equal(r.status, 400); assert.equal(r.j.error, 'replay refused: clock');
  // and 2 s less than it (a start mark sent late by that much): past the 1.5 s of leeway on that side
  await call('/api/mark', { k: k3, e: 's' }, ip);
  clock += M3 - 2000;
  await call('/api/mark', { k: k3, e: 'f', ms: M3 }, ip);
  r = await call('/api/replay', { k: k3, car: 'm3', ms: M3, z: fixture('m3') }, ip);
  assert.equal(r.status, 400); assert.equal(r.j.error, 'replay refused: clock');
  // the same lap time driven in real time (0.4 s between the marks' ways here): on the board
  await call('/api/mark', { k: k3, e: 's' }, ip);
  clock += M3 + 400;
  await call('/api/mark', { k: k3, e: 'f', ms: M3 }, ip);
  r = await call('/api/replay', { k: k3, car: 'm3', ms: M3, z: fixture('m3') }, ip);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal((await call('/api/board')).j.allTime.find((x) => x.car === 'm3')?.ms, M3);
  // once the pages from before the marks are gone, a best with no marks stays off the board ...
  clock = OLD_PAGES_UNTIL + 3600000;
  const PA = msOf('passat'), k4 = await ticket('7.7.7.7');
  clock += PA + 60000;
  r = await call('/api/lap', { name: 'Unmarked', car: 'passat', ms: PA, k: k4, ago: 0 }, '7.7.7.7');
  assert.deepEqual(r.j.hold, [{ car: 'passat', ms: PA }]);
  r = await call('/api/replay', { k: k4, car: 'passat', ms: PA, z: fixture('passat') }, '7.7.7.7');
  assert.equal(r.status, 400); assert.equal(r.j.error, 'replay refused: clock');
  // ... and one marked over the page's connection goes on
  const sock = { a: { at: clock, ip: '8.8.8.8' }, send() {}, close() {}, deserializeAttachment() { return this.a; }, serializeAttachment(x) { this.a = x; } };
  sockets.push(sock);
  const k5 = await ticket('8.8.8.8');
  await L.webSocketMessage(sock, JSON.stringify({ t: 'hello', name: 'Marked', k: k5 }));
  await L.webSocketMessage(sock, JSON.stringify({ t: 'lm', e: 's' }));
  clock += PA + 150;
  await L.webSocketMessage(sock, JSON.stringify({ t: 'lm', e: 'f', ms: PA }));
  r = await call('/api/lap', { name: 'Marked', car: 'passat', ms: PA, k: k5, ago: 0 }, '8.8.8.8');
  r = await call('/api/replay', { k: k5, car: 'passat', ms: PA, z: fixture('passat') }, '8.8.8.8');
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal((await call('/api/board')).j.allTime.find((x) => x.car === 'passat')?.name, 'Marked');
  sockets.length = 0;
  // how near these came to the leeways can be read: five laps by the server's clock, three of them outside
  clock += 61000;
  let mg = (await call('/api/margins')).j.kinds;
  assert.equal(mg.clock.n, 5); assert.equal(mg.clock.out, 3); assert.equal(mg.clock.min, -2000); assert.equal(mg.clock.lo, -1500); assert.equal(mg.clock.hi, 3500);
  // (and the car check's readings of every record drive sent in this test: the honest ones 0, the tuned ones outside)
  assert.ok(mg.car.n >= 3 && mg.car.p50 === 0 && mg.car.out >= 1 && mg.car.hi === 3, JSON.stringify(mg.car));
}

// 3c) a record's drive against where the server saw the car while the lap was driven (26 Nov 2026: the start mark
// is the page's own word, so a changed page could drive in slow motion and send it late; worker/livecheck.js).
// Places come by request here, every 2 s, as from a page with no connection.
{
  const { LIVE_FROM } = await import(root + '/worker/cutover.js');
  const { gunzipSync } = await import('node:zlib');
  const drive = (name) => {
    const a = gunzipSync(readFileSync(new URL(`./fixtures/replays/${name}.gz`, import.meta.url))).toString().split(',').map(Number);
    const [, f, ms, n] = a, xs = [], zs = [];
    let x = 0, z = 0;
    for (let i = 0; i < n; i++) { x += a[4 + i * f]; z += a[5 + i * f]; xs.push(x / 100); zs.push(z / 100); }
    return { ms, xs, zs, at: (t) => { const j = Math.max(0, Math.min(n - 1, Math.round(t * 10))); return { x: xs[j], z: zs[j] }; } };
  };
  // a lap of `d` that takes `slow` times its time on the real clock, its start mark sent `late` ms after the car
  // left the line, the page's own clock `lag` s behind by slow frames; then its replay is sent. The answer.
  let nth = 0;
  const lap = async (car, d, { slow = 1, late = 0, lag = 0, places = true, hop = null } = {}) => {
    const ip = `9.9.${++nth}.9`, k = await ticket(ip), real = Math.round(d.ms * slow) + lag * 1000;
    clock += 60000;
    const t0 = clock;
    let marked = false;
    for (let t = 0; t <= real; t += 2000) {
      clock = t0 + t;
      if (!marked && t >= late) { await call('/api/mark', { k, e: 's' }, ip); marked = true; }
      const q = hop?.(t) || d.at(Math.max(0, t / 1000 - (lag * t) / real) / slow);
      if (places) assert.equal((await call('/api/mark', { k, e: 'p', x: q.x, z: q.z }, ip)).status, 200);
    }
    clock = t0 + real;
    await call('/api/mark', { k, e: 'f', ms: d.ms }, ip);
    const l = await call('/api/lap', { name: `Live${nth}`, car, ms: d.ms, k, ago: 0 }, ip);
    assert.deepEqual(l.j.hold, [{ car, ms: d.ms }], JSON.stringify(l.j));
    return call('/api/replay', { k, car, ms: d.ms, z: fixture(car) }, ip);
  };
  const cgt = drive('cgt'), crv = drive('crv'), rav4 = drive('rav4'), bz = drive('bz4x');
  // slow motion, one tenth slower, the start mark sent late by as much as it takes for the clock to agree
  r = await lap('cgt', cgt, { slow: 1.1, late: Math.round(cgt.ms * 0.1) });
  assert.equal(r.status, 400, JSON.stringify(r.j)); assert.equal(r.j.error, 'replay refused: live');
  // one fiftieth slower: 3 s gained on the lap, still seen
  r = await lap('cgt', cgt, { slow: 1.02, late: Math.round(cgt.ms * 0.02) });
  assert.equal(r.status, 400, JSON.stringify(r.j)); assert.equal(r.j.error, 'replay refused: live');
  // the car standing at the start while a made-up lap is told
  r = await lap('cgt', cgt, { hop: () => cgt.at(0) });
  assert.equal(r.status, 400); assert.equal(r.j.error, 'replay refused: live');
  // not seen at all, after the pages that do not send their places alone are gone
  // (before that day such a lap goes on the board: the passat's above)
  assert.ok(clock < LIVE_FROM); clock = LIVE_FROM + 3600000;
  r = await lap('cgt', cgt, { places: false });
  assert.equal(r.status, 400); assert.equal(r.j.error, 'replay refused: live');
  // the lap as it was driven: on the board
  r = await lap('cgt', cgt);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  // ... also from a page whose clock fell 2 s behind by slow frames, with a mark and places 1.2 s on their way
  r = await lap('crv', crv, { lag: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  // ... and with a few places from elsewhere among them (one every 30 s)
  r = await lap('rav4', rav4, { hop: (t) => (t % 30000 === 0 && t ? { x: 5000, z: 5000 } : null) });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await lap('bz4x', bz, { slow: 1.005 });      // (0.8 s over the lap time on the clock: the leeway)
  assert.equal(r.status, 200, JSON.stringify(r.j));
  clock += 61000;
  const live = (await call('/api/margins')).j.kinds.live;
  assert.ok(live.n >= 7 && live.out >= 3 && live.p1 === 0 && live.hi === 0.15, JSON.stringify(live));
}

// 4) caps: a ticket saved for 10 days posts 3 batches of 50 laps at once: 120 from one address in the hour
k = await ticket('3.3.3.3');
clock += 10 * 86400000;
let stored = 0;
for (let bt = 0; bt < 3; bt++) {
  const laps = Array.from({ length: 50 }, (_, i) => ({ name: 'Flood', car: 'w201', ms: 130000 + bt * 50 + i, k, ago: (150 - (bt * 50 + i)) * 3 * 60000 }));
  r = await call('/api/lap', { laps }, '3.3.3.3');
}
stored = db.prepare("SELECT COUNT(*) AS n FROM laps WHERE name = 'Flood'").get().n;
assert.equal(stored, 120, `flood capped per address (${stored})`);

// 5) stealth: a ghost's hello is counted, and /stats gets the count of pages, not their ids
const ws = (a) => ({ a, send() {}, close() {}, deserializeAttachment() { return this.a; }, serializeAttachment(x) { this.a = x; } });
const g = ws({ at: clock, ip: '4.4.4.4' });
sockets.push(g);
L.race.live = () => true;
await L.webSocketMessage(g, JSON.stringify({ t: 'hello', name: 'Spy', ghost: true }));
assert.ok(g.a.ghost);
clock += 61000;
L.loadTick(clock);
const s = sent.at(-1);
assert.equal(s.gh, 1); assert.equal(s.ghc, 1); assert.deepEqual(s.ghIds, [g.a.id]);
assert.equal(s.on, 0, 'a ghost is not online');
const day = {};
addLoad(day, s); addLoad(day, { ...s, ghc: 0 });
const tot = sumDays([day]);
assert.equal(Object.keys(tot.ghostIds).length, 1);
const v = loadView(tot.load, 2);
assert.deepEqual([v.ghMin, v.ghc, v.ghMax], [2, 1, 1]);
console.log('ok security fixes');
