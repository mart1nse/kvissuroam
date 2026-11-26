// The Roadster Rocket against the server (worker/index.js, worker/stagecheck.js), on a Lobby over node:sqlite that
// lets hidden cars in (26 Nov 2026, Martin: "make all the checks of hacking to this or any other hack scenario (or
// enabling jump ...) and fix them"):
//   a lap in the Rocket whose page told of a kickflip while the lap was on is not a record ('flight')
//   a lap whose drive has a kickflip in it, told of or not, is not a record ('car', air)
//   an honest lap in it is, with the drive held against the Rocket's own limits
//   a made-up flight plan (somewhere else on the map, or faster than any car) is not passed on to the others
//   the Rocket's standing start on the Raadi stage, BOOST held from the green light, is not 'a flying start'
//   (it was: no other car leaves a standstill at 4 g)
// What the car and its gas can do is judged in tools/rocket-judge-test.mjs; that it races nobody in
// tools/rocket-norace-test.mjs.
//   node tools/rocket-server-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';
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
const { stageCheck } = await import(root + '/worker/stagecheck.js');
const { CARS } = await import(root + '/src/cars/specs.js');
const { createCar, stepCar } = await import(root + '/src/cars/physics.js');
const { planFlip, packPlan, flightPose, refillTank } = await import(root + '/src/cars/thrust.js');
const { carLimits } = await import(root + '/src/race/plausible.js');

let clock = Date.UTC(2026, 10, 26, 9, 0, 0);
Date.now = () => clock;
globalThis.WebSocketRequestResponsePair = class {};
const sock = (ip) => ({ a: { at: clock, ip }, got: [], send(m) { this.got.push(m); }, close() {}, accept() {}, deserializeAttachment() { return this.a; }, serializeAttachment(x) { this.a = x; } });
const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const sockets = [];
const ctx = { storage: { sql, setAlarm: () => Promise.resolve() }, setWebSocketAutoResponse() {}, getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock), waitUntil() {} };
const env = { SHOW_HIDDEN: '1', STATS: { idFromName: () => 1, get: () => ({ addLoad: () => Promise.resolve(true), addRace: () => Promise.resolve() }) } };
const L = new Lobby(ctx, env);
const call = async (path, body, ip = '1.1.1.1') => {
  const r = await L.fetch(new Request('https://www.linnaring.com' + path, { method: body ? 'POST' : 'GET', headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
  return { status: r.status, j: await r.json().catch(() => null) };
};
const lastWhy = () => db.prepare('SELECT why FROM replay_refused ORDER BY id DESC LIMIT 1').get()?.why;

// ---- a drive round the lap: the Carrera GT's record of 26 Nov 2026 as it came from a player's browser. Nothing in
// it is more than a Rocket can do, so as a Rocket's lap it is an honest one.
const FLD = 21, DEC = [2, 2, 2, 3, 3, 3, 2, 2, 3, 0, 0, 2, 2, 2, 0, 1, 1, 1, 1, 1, 0];
const raw = (dir, name) => gunzipSync(readFileSync(new URL(`./fixtures/${dir}/${name}.gz`, import.meta.url))).toString().split(',').map(Number);
function samples(a) {
  const n = a[3], run = new Array(FLD).fill(0), out = [];
  for (let i = 0; i < n; i++) { const p = []; for (let k = 0; k < FLD; k++) { run[k] += a[4 + i * FLD + k]; p.push(run[k] / 10 ** DEC[k]); } out.push(p); }
  return out;
}
const pack = (ms, list) => {
  const out = [1, FLD, ms, list.length], prev = new Array(FLD).fill(0);
  for (const p of list) for (let k = 0; k < FLD; k++) { const v = Math.round(p[k] * 10 ** DEC[k]); out.push(v - prev[k]); prev[k] = v; }
  return gzipSync(out.join(',')).toString('base64');
};
const CGT = raw('replays', 'cgt'), MS = CGT[2], LAP = samples(CGT);

// a flight plan as the game makes one, from a car at p
const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
function planAt(p, kmh = 120) {
  refillTank('rocket');
  const car = createCar(CARS.rocket, { x: p[0], z: p[1], yaw: p[3], y: 0 });
  car.vx = kmh / 3.6;
  return planFlip(car, flat, 1);
}

// One page drives the lap in the Rocket, in real time by the server's clock: connected, its lap's start told,
// its place sent ten times a second, the finish told, then the lap and its replay sent in.
// during(i, send): what else the page says at sample i
let who = 0;
async function lap(name, replay, during = null) {
  const ip = `7.7.7.${++who}`;
  const k = (await call('/api/ticket', null, ip)).j.key;
  clock += 5 * 60000;
  const A = sock(ip), B = sock(`8.8.8.${who}`);
  sockets.push(A, B);
  await L.webSocketMessage(A, JSON.stringify({ t: 'hello', name, car: 'rocket', b: 1, k }));
  await L.webSocketMessage(B, JSON.stringify({ t: 'hello', name: `Sees${who}`, car: 'w201' }));
  assert.equal(A.a.car, 'rocket', 'the hidden car is let in on this test server');
  const say = (m) => L.webSocketMessage(A, JSON.stringify(m));
  let stamp = 5000;
  await say({ t: 'lm', e: 's' });
  for (let i = 0; i < LAP.length; i++) {
    await say({ t: 's', p: [...LAP[i], stamp] });
    clearInterval(L.timer); L.timer = 1;
    if (during) await during(i, say, B);
    if (i < LAP.length - 1) { clock += 100; stamp = (stamp + 100) % 60000; }
  }
  clock += MS - (LAP.length - 1) * 100;
  await say({ t: 'lm', e: 'f', ms: MS });
  const r = await call('/api/lap', { name, car: 'rocket', ms: MS, k, ago: 0 }, ip);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.deepEqual(r.j.hold, [{ car: 'rocket', ms: MS }], `${name}: a car's best is held until its drive has come`);
  const rp = await call('/api/replay', { k, car: 'rocket', ms: MS, z: replay }, ip);
  sockets.length = 0;
  return rp;
}
const onBoard = async () => (await call('/api/board')).j.allTime.find((x) => x.car === 'rocket');

// 1) a kickflip told of during the lap: the page let FLIP through once the lap was on
{
  let heard = 0;
  const r = await lap('Flipper', pack(MS, LAP), async (i, say, B) => {
    if (i !== 600) return;
    B.got.length = 0;
    await say({ t: 'jmp', p: packPlan(planAt(LAP[i])), c: 1234 });
    heard = B.got.map((m) => JSON.parse(m)).filter((m) => m.t === 'jmp').length;
  });
  assert.equal(heard, 1, 'the others are told of the flight');
  assert.equal(r.status, 400, JSON.stringify(r.j));
  assert.equal(r.j.error, 'replay refused: flight');
  assert.match(lastWhy(), /^flight: 1 kickflip told of during the lap/);
  assert.equal(await onBoard(), undefined, 'not on the board');
}
console.log('ok  a lap with a kickflip told of while it was on: refused (flight)');

// 2) a kickflip in the drive itself, and the page silent about it: the car goes over as it flies
{
  const list = LAP.map((p) => p.slice()), at = 600, plan = planAt(LAP[at]), pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vy: 0 };
  // (the flight's height and roll laid over the drive's own samples; its way over the ground left as it was)
  for (let i = 0; i * 0.1 < plan.tl; i++) { flightPose(plan, i * 0.1, pose); list[at + i][2] += pose.y; list[at + i][5] = pose.roll; }
  const r = await lap('Silent', pack(MS, list));
  assert.equal(r.status, 400, JSON.stringify(r.j));
  assert.equal(r.j.error, 'replay refused: car', 'the sender is not told which limit');
  assert.match(lastWhy(), /^car: air \(s over: .* s of a kickflip\)/, lastWhy());
  assert.equal(await onBoard(), undefined);
}
console.log('ok  a lap with a kickflip in its drive: refused (car: air)');

// 3) flight plans that are not the car's own flight are not passed on, and mark no lap
{
  const heard = [];
  const r = await lap('Honest', pack(MS, LAP), async (i, say, B) => {
    if (i !== 300 && i !== 302 && i !== 304) return;
    B.got.length = 0;
    const p = LAP[i];
    // somewhere else on the map; faster than any car; not numbers
    const plan = i === 300 ? packPlan(planAt([p[0] + 400, p[1] - 300, 0, p[3]])) : i === 302 ? packPlan(planAt(p, 600)) : packPlan(planAt(p)).map((v, n) => (n === 5 ? 'x' : v));
    await say({ t: 'jmp', p: plan, c: 1234 });
    heard.push(B.got.map((m) => JSON.parse(m)).filter((m) => m.t === 'jmp').length);
  });
  assert.deepEqual(heard, [0, 0, 0], 'a made-up flight plan is not passed on');
  // 4) ...and this one's lap is honest: on the board, its drive kept
  assert.equal(r.status, 200, JSON.stringify(r.j) + lastWhy());
  assert.equal((await onBoard())?.ms, MS, 'the honest lap is on the board');
  assert.equal((await call('/api/board')).j.rp.toomemagi?.rocket, MS, 'its drive kept');
  const m = (await call('/api/margins')).j.kinds;
  assert.ok(m.gas.n >= 2 && m.gas.max === 0, `the gas each Rocket drive used over its tank is kept for the nightly look (${JSON.stringify(m.gas)})`);
}
console.log('ok  made-up flight plans are dropped; an honest lap in the Rocket is taken, judged as a Rocket');

// 5) the Raadi stage's standing start. The Impreza's stage record of 26 Nov, its first metres driven as the Rocket
// leaves the line: on the motors, and with BOOST held from the green light.
{
  const run = samples(raw('replays-raadi', 'impreza')), cum = [0];
  for (let i = 1; i < run.length; i++) cum.push(cum[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]));
  const along = (s) => { let k = 0; while (k < cum.length - 2 && cum[k + 1] < s) k++; const f = (s - cum[k]) / (cum[k + 1] - cum[k] || 1); return [run[k][0] + (run[k + 1][0] - run[k][0]) * f, run[k][1] + (run[k + 1][1] - run[k][1]) * f]; };
  const lim = carLimits(CARS.rocket);
  for (const boost of [0, 1]) {
    refillTank('rocket');
    const car = createCar(CARS.rocket, { x: 0, z: 0, yaw: 0, y: 0 }), xs = [], zs = [];
    let t = 0, next = 0, far = 0;
    for (; t < 1.8; t += 1 / 120) { if (t >= next - 1e-9) { const [x, z] = along(far = Math.hypot(car.x, car.z)); xs.push(x); zs.push(z); next += 0.1; } stepCar(car, { up: 1, boost }, flat, 1 / 120); }
    // (and on from where the Impreza was that far along)
    let k = 0; while (cum[k] < far) k++;
    for (let i = k; i < run.length; i++) { xs.push(run[i][0]); zs.push(run[i][1]); }
    const X = Float64Array.from(xs), Z = Float64Array.from(zs);
    // (on the motors alone it is within what any car may do; with BOOST it was 'a flying start' until 26 Nov)
    assert.equal(stageCheck(X, Z, 0), boost ? 'a flying start' : '', boost ? 'as any other car it would be a flying start' : 'on the motors');
    assert.equal(stageCheck(X, Z, 0, lim.gas.launch), '', `the Rocket's own start${boost ? ' with BOOST' : ''} holds`);
    if (boost) console.log(`ok  the Rocket's standing start on the stage holds: ${far.toFixed(0)} m in 1.8 s with BOOST, as hard as ${lim.gas.launch.toFixed(0)} m/s2 allowed (other cars 14)`);
  }
  // (twice as hard as that is still a flying start)
  const X = [], Z = [];
  for (let i = 0; i < 12; i++) { const [x, z] = along(0.5 * 2 * lim.gas.launch * (i * 0.1) ** 2); X.push(x); Z.push(z); }
  let k = 0; while (cum[k] < 0.5 * 2 * lim.gas.launch * 1.1 ** 2) k++;
  for (let i = k; i < run.length; i++) { X.push(run[i][0]); Z.push(run[i][1]); }
  assert.equal(stageCheck(Float64Array.from(X), Float64Array.from(Z), 0, lim.gas.launch), 'a flying start');
}
console.log('ok  rocket and the server');
