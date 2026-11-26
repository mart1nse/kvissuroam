// The Majoraadi launch's one-off (Martin 26 Nov 2026: "Delete all raadi lap times"): a lobby that wakes up with the
// new code drops every stage time and stage replay once, and nothing of Toomemägi's. Runs the real Lobby over
// node:sqlite with the live site's laps (only read from it, or a laps.json given), as tools/top-board-test.mjs does.
//   node tools/raadi-launch-test.mjs [laps=laps.json]
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
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');
const laps = arg('laps') ? JSON.parse(readFileSync(arg('laps'), 'utf8')) : await (await fetch('https://www.linnaring.com/api/laps.json')).json();

globalThis.WebSocketRequestResponsePair = class {};
const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const ctxDO = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => [], getWebSocketAutoResponseTimestamp: () => new Date(), waitUntil() {} };
const env = { STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true), addRace: () => Promise.resolve() }) } };
const wake = () => new Lobby(ctxDO, env);
const count = (track) => sql.exec('SELECT COUNT(*) AS n FROM laps WHERE track = ?', track).one().n;
const board = async (L) => (await L.fetch(new Request('https://www.linnaring.com/api/board', { headers: { 'cf-connecting-ip': '10.0.0.1' } }))).json();

// the store as it is live before the deploy: the tables and the earlier one-offs done, the launch's not yet
wake();
sql.exec("DELETE FROM meta WHERE k = 'cleanup-raadi-launch'");
for (const l of laps) {
  sql.exec('INSERT INTO laps (id, track, name, car, ms, at, day, splits, cp, inp, ty, pen, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ...[l.id, l.track, l.name, l.car, l.ms, l.at, l.day, l.splits, l.cp, l.inp, l.ty, l.pen, l.hold].map((v) => v ?? null));
}
const blob = new Uint8Array([1, 2, 3]);
for (const [track, car, ms] of [['toomemagi', 'impreza', 168000], ['toomemagi', 'f40', 169000], ['raadi', 'impreza', 113540], ['raadi', 'audi200', 116921]]) {
  sql.exec('INSERT INTO replays (track, car, ms, name, at, data) VALUES (?, ?, ?, ?, ?, ?)', track, car, ms, 'x', '2026-11-26T00:00:00Z', blob);
}
sql.exec("INSERT INTO meta (k, v) VALUES ('board', '{}') ON CONFLICT (k) DO UPDATE SET v = excluded.v");
const toome = count('toomemagi'), raadi = count('raadi');
assert.ok(raadi > 0, 'there are stage times to drop');
console.log(`before: ${toome} Toomemägi laps, ${raadi} stage times`);

// the deploy: the lobby wakes up with the new code
const L = wake();
assert.equal(count('raadi'), 0, 'every stage time gone');
assert.equal(count('toomemagi'), toome, 'every Toomemägi lap kept');
const rp = sql.exec('SELECT track, car FROM replays ORDER BY track, car').toArray();
assert.deepEqual(rp.map((r) => `${r.track}/${r.car}`), ['toomemagi/f40', 'toomemagi/impreza'], 'only the stage replays gone');
const b = await board(L);
assert.deepEqual(b.raadi.allTime, [], 'no stage records');
assert.deepEqual(b.raadi.recent, [], 'no recent stage times');
assert.equal(b.raadi.laps, 0, 'no stage times counted');
assert.ok(b.allTime.length > 0 && b.laps > 0, 'the Toomemägi board still has its records');
assert.ok(!b.rp?.raadi, 'no stage replay offered');
console.log('after the deploy:', count('toomemagi'), 'Toomemägi laps,', count('raadi'), 'stage times; board:', b.laps, 'Toomemägi laps,', b.allTime.length, 'records; stage', b.raadi.laps);

// a run after the launch stays through the next wake-ups (the one-off is done once)
sql.exec("INSERT INTO laps (track, name, car, ms, at, day, inp, ty) VALUES ('raadi', 'Player', 'impreza', 118000, '2026-11-26T17:00:00Z', '2026-11-26', 'kb', 'gravel')");
wake(); wake();
assert.equal(count('raadi'), 1, 'a run after the launch is kept');
console.log('OK: the launch drops the stage times once and keeps Toomemägi as it was');
