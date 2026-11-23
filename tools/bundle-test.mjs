// Positions in bundles (worker/index.js, TICK): the lobby with fake sockets and a fake clock.
//   node tools/bundle-test.mjs
// Checks: a page that asked for bundles gets one message a tick with every other car's news (never its
// own, never the same position twice, with its age); far cars less often; a page with no car of its own
// (menu, garage, watching) gets everything; older pages still get single messages at once; a car that
// leaves or goes quiet drops out, and the timer stops when nobody drives.
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject {}', shortCircuit: true };
  return n(s, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Lobby } = await import(root + '/worker/index.js');

let clock = 1_800_000_000_000;
Date.now = () => clock;
let timers = 0, cleared = 0;
globalThis.setInterval = () => ++timers;
globalThis.clearInterval = () => { cleared++; };

const sockets = [];
const sock = (id, b) => {
  const s = { a: { id, name: id, car: 'w201', at: clock, ...(b ? { b: 1 } : {}) }, got: [],
    send(m) { this.got.push(JSON.parse(m)); }, deserializeAttachment() { return this.a; }, serializeAttachment(a) { this.a = a; }, close() {} };
  sockets.push(s);
  return s;
};
const L = Object.create(Lobby.prototype);
L.ctx = { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock) };
L.rate = new WeakMap();
L.race = { gone() {}, message() { return false; } };
L.initPoses();

const A = sock('a', true), B = sock('b', true), C = sock('c', true), OLD = sock('old', false), MENU = sock('menu', true);
const pose = (x, z) => [x, z, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0.5, 0, 3000, 0, 0, 0, 0, 0, 4];
const say = async (s, p) => L.webSocketMessage(s, JSON.stringify({ t: 's', p }));
const take = (s) => { const g = s.got; s.got = []; return g; };
const ids = (m) => m.b.map((e) => e[0]).sort().join(',');

// a and b near each other, c 1 km away
await say(A, pose(0, 0)); await say(B, pose(50, 0)); await say(C, pose(1000, 0));
assert.equal(timers, 1, 'one timer');
// the older page got all three at once, one message each; the bundle pages nothing yet
assert.deepEqual(take(OLD).map((m) => `${m.t}:${m.id}`), ['s:a', 's:b', 's:c']);
for (const s of [A, B, C, MENU]) assert.equal(s.got.length, 0, 'bundles wait for the tick');
clock += 40;
L.bundle();
let a = take(A), b = take(B), c = take(C), menu = take(MENU);
assert.equal(a.length, 1); assert.equal(a[0].t, 'S'); assert.equal(ids(a[0]), 'b,c', 'never its own car');
assert.equal(ids(b[0]), 'a,c'); assert.equal(ids(c[0]), 'a,b'); assert.equal(ids(menu[0]), 'a,b,c');
assert.deepEqual(a[0].b.find((e) => e[0] === 'b')[1], pose(50, 0));
assert.equal(a[0].b.find((e) => e[0] === 'b')[2], 40, 'age in ms');
assert.equal(take(OLD).length, 0, 'older pages get no bundles');
// nothing new: nothing sent
clock += 100; L.bundle();
for (const s of [A, B, C, MENU]) assert.equal(take(s).length, 0, 'no repeats');
// everyone moves every 100 ms: near cars each tick, the far one about every 300 ms, the menu everything
const n = { a: { b: 0, c: 0 }, c: { a: 0 }, menu: 0 };
for (let k = 0; k < 30; k++) {
  await say(A, pose(k, 0)); await say(B, pose(50 + k, 0)); await say(C, pose(1000 + k, 0));
  clock += 100; L.bundle();
  for (const m of take(A)) for (const e of m.b) n.a[e[0]]++;
  for (const m of take(C)) for (const e of m.b) if (e[0] === 'a') n.c.a++;
  for (const m of take(MENU)) n.menu += m.b.length;
  take(B);
}
assert.equal(n.a.b, 30, 'a near car: every tick');
assert.ok(n.a.c >= 9 && n.a.c <= 11, `far car about 3 a second (${n.a.c} in 3 s)`);
assert.ok(n.c.a >= 9 && n.c.a <= 11, 'both ways');
assert.equal(n.menu, 90, 'no car of its own: everything');
// very far (over 2 km): once a second
await say(C, pose(5000, 0));
let vf = 0;
for (let k = 0; k < 30; k++) { await say(C, pose(5000 + k, 0)); await say(A, pose(k, 0)); clock += 100; L.bundle(); for (const m of take(A)) vf += m.b.filter((e) => e[0] === 'c').length; }
assert.ok(vf >= 2 && vf <= 4, `very far car once a second (${vf} in 3 s)`);
// a page that leaves drops out of the bundles
take(B); take(C); take(MENU);
await L.webSocketClose(B);
sockets.splice(sockets.indexOf(B), 1);
await say(A, pose(1, 1)); clock += 100; L.bundle(); take(A);
const m1 = take(C).concat(take(MENU));
assert.ok(m1.some((m) => m.t === 'leave') && m1.filter((m) => m.t === 'S').every((m) => m.b.every((e) => e[0] !== 'b')), 'b gone');
// nobody sends for 5 s: the timer stops (the object can sleep), and starts again with the next position
const before = cleared;
clock += 6000; L.bundle();
assert.equal(cleared, before + 1, 'timer stopped');
assert.equal(L.timer, 0);
await say(A, pose(2, 2));
assert.equal(timers, 2, 'timer again');
// after a wake-up (memory empty) the page's wish is read from its attachment
L.initPoses(); take(OLD);
await say(A, pose(3, 3)); clock += 50; L.bundle();
assert.equal(take(C).length, 1); assert.equal(take(OLD).filter((m) => m.t === 's').length, 1);
// size: 22 players in one bundle
console.log('bundle of 21 cars:', `{"t":"S","b":[${Array.from({ length: 21 }, (_, i) => `["${'x'.repeat(8)}",${JSON.stringify(pose(1234.56 + i, -2345.67))},37]`).join(',')}]}`.length, 'bytes');
console.log('bundle test: all ok');
