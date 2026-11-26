// Positions that hang together, and places per address (worker/index.js, 26 Nov 2026), on a Lobby over node:sqlite:
// a car that jumps is flagged as just put there (every page passes through it), a speed a car claims is cut to
// what it is seen to move at, and an honest drive (a record lap of 26 Nov as it came from a player's browser,
// tools/fixtures/replays, also arriving in bunches) goes through untouched. Then: one address may hold 30 places
// while there is room and 8 once the server is 80 % full.
//   node tools/pose-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
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

let clock = Date.UTC(2026, 10, 26, 9, 0, 0);
Date.now = () => clock;
globalThis.WebSocketRequestResponsePair = class {};
const sock = (ip = '1.1.1.1') => ({ a: { at: clock, ip }, got: [], send(m) { this.got.push(m); }, close() {}, accept() {}, deserializeAttachment() { return this.a; }, serializeAttachment(x) { this.a = x; } });
globalThis.WebSocketPair = class { constructor() { this[0] = {}; this[1] = sock(); } };
const Res = globalThis.Response;
globalThis.Response = class extends Res { constructor(b, init) { if (init?.status === 101) { super(null, { status: 200 }); this.upgraded = true; } else super(b, init); } };
function lobby() {
  const db = new DatabaseSync(':memory:');
  const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
  const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
  const sockets = [];
  const ctx = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock), waitUntil() {}, acceptWebSocket: (ws) => sockets.push(ws) };
  const L = new Lobby(ctx, {});
  return { L, sockets };
}

// ---- positions
const FLD = 21, DEC = [2, 2, 2, 3, 3, 3, 2, 2, 3, 0, 0, 2, 2, 2, 0, 1, 1, 1, 1, 1, 0];
function drive(name) {
  const a = gunzipSync(readFileSync(new URL(`./fixtures/replays/${name}.gz`, import.meta.url))).toString().split(',').map(Number);
  const n = a[3], run = new Array(FLD).fill(0), out = [];
  for (let i = 0; i < n; i++) { const p = []; for (let k = 0; k < FLD; k++) { run[k] += a[4 + i * FLD + k]; p.push(run[k] / 10 ** DEC[k]); } out.push(p); }
  return out;
}
const F40 = drive('f40');
// one driver (its positions sent) and one page from before bundles, which hears each position as it comes
async function pair(car = 'f40') {
  const w = lobby(), A = sock('2.2.2.2'), B = sock('3.3.3.3');
  w.sockets.push(A, B);
  await w.L.webSocketMessage(A, JSON.stringify({ t: 'hello', name: 'Driver', car, b: 1 }));
  await w.L.webSocketMessage(B, JSON.stringify({ t: 'hello', name: 'Watcher', car: 'w201' }));
  B.got.length = 0;
  let stamp = 5000;
  // taken dtS after the last one by the driver's clock, here dtA after the last
  const send = async (p, dtA = 100, dtS = dtA) => {
    clock += dtA; stamp = (stamp + dtS) % 60000;
    B.got.length = 0;
    await w.L.webSocketMessage(A, JSON.stringify({ t: 's', p: [...p, stamp] }));
    clearInterval(w.L.timer); w.L.timer = 1;
    const m = B.got.map((x) => JSON.parse(x)).find((x) => x.t === 's');
    return m ? m.p : null;
  };
  return { ...w, A, B, send, entry: () => w.L.poses.get(A.a.id) };
}
const fresh = (p) => !!(p[20] & 64), speed = (p) => Math.hypot(p[6], p[7]);

// 1) an honest lap: flagged while it has just appeared, then never, and its speed as sent
{
  const w = await pair();
  let flagged = 0, cut = 0, late = 0;
  for (let i = 0; i < F40.length; i++) {
    const got = await w.send(F40[i]);
    assert.ok(got, 'passed on');
    if (fresh(got)) { flagged++; if (i > 25) late++; }
    if (Math.abs(speed(got) - speed(F40[i])) > 0.02) cut++;
  }
  assert.ok(flagged >= 19 && flagged <= 21, `flagged for its first 2 s (${flagged})`);
  assert.equal(late, 0, 'never after');
  assert.equal(cut, 0, 'speed untouched');
}
// 2) the same lap through a bad connection: nothing for 1.2 s every 8 s, then the 12 positions at once
{
  const w = await pair();
  let late = 0, cut = 0;
  const t0 = clock;
  for (let i = 0; i < F40.length; i++) {
    const k = i % 80, got = await w.send(F40[i], k === 0 ? 1200 : k < 12 ? 0 : 100, 100);
    if (clock - t0 > 3300 && fresh(got)) late++;
    if (clock - t0 > 3300 && Math.abs(speed(got) - speed(F40[i])) > 0.02) cut++;
  }
  assert.equal(late, 0, `bunches are not jumps (${late})`);
  assert.equal(cut, 0, `nor is their speed cut (${cut})`);
}
// 3) a jump of 200 m in the middle of a drive: flagged for 2 s from there
{
  const w = await pair();
  for (let i = 0; i < 300; i++) await w.send(F40[i]);
  let n = 0;
  for (let i = 0; i < 60; i++) { const p = F40[300 + i].slice(); p[0] += 200; if (fresh(await w.send(p))) n++; }
  assert.ok(n >= 19 && n <= 21, `a jump: flagged 2 s (${n})`);
}
// 4) a car that stands and says it does 100 m/s; one that shakes 5 m to and fro
{
  const w = await pair();
  let top = 0;
  for (let i = 0; i < 60; i++) { const p = F40[0].slice(); p[6] = 100; p[7] = 0; const got = await w.send(p); if (i > 25) top = Math.max(top, speed(got)); }
  assert.ok(top <= 4.01, `standing: ${top} m/s passed on`);
  top = 0;
  for (let i = 0; i < 60; i++) { const p = F40[0].slice(); p[0] += i % 2 ? 5 : 0; p[6] = 100; p[7] = 0; const got = await w.send(p); if (i > 25) top = Math.max(top, speed(got)); }
  assert.ok(top <= 18, `shaking: ${top} m/s passed on`);
}
// 5) stamps that run ahead of the clock (each position "a second after the last", ten a second, 100 m on): jumps
{
  const w = await pair();
  for (let i = 0; i < 30; i++) await w.send(F40[i]);
  let n = 0;
  for (let i = 0; i < 40; i++) { const p = F40[30].slice(); p[0] += 100 * (i + 1); if (fresh(await w.send(p, 100, 1000))) n++; }
  assert.equal(n, 40, 'stamps ahead of the clock are not believed');
}
// 6) a car jumping about, twice a second for half a minute: after a dozen jumps its positions are not passed on
{
  const w = await pair();
  let passed = 0;
  for (let i = 0; i < 300; i++) { const p = F40[0].slice(); p[0] += 300 * Math.floor(i / 5); if (await w.send(p)) passed++; }
  assert.ok(passed >= 60 && passed < 150, `jumping about: ${passed} of 300 passed on`);
  // ... and once it drives on properly it is seen again
  clock += 60000;
  let back = 0;
  for (let i = 0; i < 50; i++) if (await w.send(F40[i])) back++;
  assert.equal(back, 50);
}
// 7) a bus at 60 m/s: held to a bus's top speed once that has been looked up
{
  const w = await pair('bus');
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const p = F40[0].slice(); p[0] += 6 * i; p[6] = 60; p[7] = 0;
    const got = await w.send(p);
    if (i > 25 && got && fresh(got)) n++;
    if (w.entry().vm === -1) await new Promise((go) => setTimeout(go, 30));
  }
  assert.ok(w.entry().vm > 20 && w.entry().vm < 60, `bus top ${w.entry().vm}`);
  assert.ok(n > 100, `a bus at 216 km/h is flagged (${n})`);
}

// ---- places per address
{
  const { L, sockets } = lobby();
  const open = async (ip, w) => {
    const r = await L.fetch(new Request(`https://www.linnaring.com/api/ws?w=${w}`, { headers: { 'cf-connecting-ip': ip, Upgrade: 'websocket' } }));
    if (!r.upgraded) return false;
    const ws = sockets.at(-1);
    if (!ws.a?.ip) return false;                                      // (told FULL on a socket of its own)
    ws.a = { ...ws.a, id: w, name: w, car: 'w201', w: 'map', drv: true };
    return true;
  };
  const many = async (ip, n, tag) => { let ok = 0; for (let i = 0; i < n; i++) if (await open(ip, `${tag}${String(i).padStart(5, '0')}`)) ok++; return ok; };
  assert.equal(await many('9.9.9.9', 40, 'aaa'), 30, '30 from one address while there is room');
  for (let i = 0; i < 46; i++) assert.ok(await open(`10.0.0.${i}`, `bbbb${String(i).padStart(4, '0')}`));
  assert.equal(sockets.length, 76);
  // 76 in: a new address gets in 4 more times with room, and then only as long as it has under 8
  assert.equal(await many('11.11.11.11', 20, 'ccc'), 8, 'from 80 % full: 8 from one address');
  assert.equal(await many('12.12.12.12', 20, 'ddd'), 8);
  assert.equal(await many('9.9.9.9', 5, 'eee'), 0, 'the address with 30 gets no more, and keeps what it has');
  assert.equal(sockets.filter((s) => s.a.ip === '9.9.9.9').length, 30);
}
console.log('ok: honest positions untouched (also in bunches); jumps flagged, claimed speed cut, places per address tightened when nearly full');
process.exit(0);
