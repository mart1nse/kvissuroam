// The race as the server follows it (worker/follow.js, worker/race.js settle; 26 Nov 2026): a finish counts only
// for a car the server saw stand on the grid, start after its lights, pass the gates in order and cross the line.
// The honest drives are the record laps of 26 Nov as they came from players' browsers (tools/fixtures/replays),
// each behind a standing start from the grid.
//   node tools/follow-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
register('data:text/javascript,' + encodeURIComponent(`export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { RaceDesk } = await import(root + '/worker/race.js');
const { PT, PASS } = await import(root + '/worker/follow.js');
const { OLD_PAGES_UNTIL } = await import(root + '/worker/cutover.js');
const LAP = JSON.parse(readFileSync(new URL('../src/race/track.json', import.meta.url)));
assert.ok(PT, 'worker/pace.json is of the lap\'s gates as they are (else: node tools/make-pace.mjs)');

let clock = Date.UTC(2026, 10, 26, 9, 0, 0);
Date.now = () => clock;

// the fixtures as places ten times a second
const drives = {};
for (const f of readdirSync(new URL('./fixtures/replays/', import.meta.url))) {
  if (!f.endsWith('.gz') || f.includes('tuned')) continue;
  const a = gunzipSync(readFileSync(new URL(`./fixtures/replays/${f}`, import.meta.url))).toString().split(',').map(Number);
  const n = a[3], pts = [];
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) { x += a[4 + i * 21] / 100; z += a[4 + i * 21 + 1] / 100; pts.push([x, z]); }
  drives[f.replace('.gz', '')] = pts;
}
// the grid (src/race/racemode.js gridPose), place k
const P = LAP.pts, N = P.length, A = P[N - 30], GL = Math.hypot(P[0][0] - A[0], P[0][1] - A[1]);
const ux = (P[0][0] - A[0]) / GL, uz = (P[0][1] - A[1]) / GL;
const gridAt = (k) => { const row = Math.floor(k / 5), col = [2, 1, 3, 0, 4][k % 5], t = -34 - 0.6 - 2.2 - row * 7.5, lat = (col - 2) * 2.7; return [A[0] + ux * t - uz * lat, A[1] + uz * t + ux * lat]; };
// a race drive: from the grid place at a m/s2 to the lap's first place, then the lap, then 3 s on past the line
function raceDrive(pts, k = 0, a = 6) {
  const g = gridAt(k), to = pts[0], L = Math.hypot(to[0] - g[0], to[1] - g[1]), out = [];
  for (let t = 0; ; t += 0.1) { const d = 0.5 * a * t * t; if (d >= L) break; out.push([g[0] + (to[0] - g[0]) * d / L, g[1] + (to[1] - g[1]) * d / L]); }
  const launch = out.length;
  out.push(...pts);
  const e = pts.at(-1), b = pts.at(-2);
  for (let i = 1; i <= 30; i++) out.push([e[0] + (e[0] - b[0]) * i, e[1] + (e[1] - b[1]) * i]);
  return { path: out, launch, fin: launch + pts.length - 1, grid: g };
}

// a lobby with n pages
function world(n, cars = []) {
  const meta = {}, refused = [];
  const sockets = Array.from({ length: n }, (_, i) => ({ a: { id: `p${i}`, name: `P${i}`, car: cars[i] || 'f40', drv: true, at: clock }, send() {}, deserializeAttachment() { return this.a; }, serializeAttachment(a) { this.a = a; } }));
  const L = {
    meta: (k) => meta[k] ?? null, setMeta: (k, v) => { meta[k] = v; }, broadcast() {}, raceRefused: (r, ms, why) => refused.push([r.id, why]),
    ctx: { getWebSockets: () => sockets, getWebSocketAutoResponseTimestamp: () => new Date(clock), storage: { setAlarm: () => Promise.resolve() } },
  };
  const w = { L, meta, refused, sockets, desk: new RaceDesk(L) };
  w.msg = (i, m) => { sockets[i].a.at = clock; w.desk.message(sockets[i], sockets[i].a, m); };
  w.racer = (i) => w.desk.s.racers.find((r) => r.id === `p${i}`) || w.desk.s.last?.racers.find((r) => r.id === `p${i}`);
  // everyone votes; the race is on, the clock at the start of the grid time
  w.begin = () => { for (let i = 0; i < n; i++) w.msg(i, { t: i < 2 ? 'rv' : 'rj', on: 1 }); assert.equal(w.desk.s.phase, 'on'); clock = w.desk.s.tGrid; };
  // (a position as a page sends it: the place, and in slot 21 the sender's own stamp of it)
  w.pose = (i, p, st = clock % 60000) => { const a = new Array(22).fill(0); a[0] = p[0]; a[1] = p[1]; a[21] = st; w.desk.seen(`p${i}`, a, clock); };
  return w;
}
// Runs a race: plans[i] = { path, launch, fin, from (index of path sent first, default 0), cut(k, t): false to not
// send position k, claim: ms to claim instead of the true time, claimAt: when (ms after the true finish), stall: [k0, k1]:
// positions k0 to k1 are held up on the way and all arrive with the one after }.
// Positions go ten times a second from the lights (the grid before them); returns each racer's record at the end.
function run(w, plans, { restartAt = -1 } = {}) {
  w.begin();
  const go = w.desk.s.tGreen;
  // on the grid
  for (; clock < go; clock += 100) for (let i = 0; i < plans.length; i++) if (plans[i] && !plans[i].noGrid) w.pose(i, plans[i].early && clock > go - plans[i].early ? plans[i].path[Math.floor((clock - (go - plans[i].early)) / 100)] : plans[i].grid || plans[i].path[0]);
  clock = go;
  const steps = Math.max(...plans.filter(Boolean).map((p) => Math.max(p.path.length, p.fin + (p.claimAt || 0) / 100))) + 80;
  const done = new Set();
  for (let k = 0; k < steps; k++, clock += 100) {
    if (k === restartAt) { w.desk = new RaceDesk(w.L); }        // (a deploy: memory gone, the stored state read again)
    for (let i = 0; i < plans.length; i++) {
      const pl = plans[i];
      if (!pl) continue;
      const kk = k + (pl.early ? Math.floor(pl.early / 100) : 0);
      if (kk < pl.path.length && !(pl.cut && pl.cut(kk) === false)) {
        if (pl.stall && kk >= pl.stall[0] && kk < pl.stall[1]) (pl.q ||= []).push([pl.path[kk], clock % 60000]);
        else { for (const [pp, st] of pl.q || []) w.pose(i, pp, st); pl.q = null; w.pose(i, pl.path[kk]); }
      }
      const at = pl.fin + Math.round((pl.claimAt || 0) / 100);
      if (kk === at && !done.has(i)) { done.add(i); w.msg(i, { t: 'rf', ms: pl.claim ?? (pl.fin - (pl.early ? Math.floor(pl.early / 100) : 0)) * 100 - 30 }); }
    }
    if (k % 20 === 0) w.desk.alarm();
  }
  return plans.map((_, i) => w.racer(i));
}

// 1) every honest drive finishes, at the time it crossed the line
for (const [name, pts] of Object.entries(drives)) {
  const w = world(2, [name, 'w201']), d = raceDrive(pts), slow = raceDrive(drives.bus, 1);
  const [a, b] = run(w, [d, slow]);
  assert.equal(a.out, null, `${name}: ${JSON.stringify(w.refused)}`);
  assert.ok(Math.abs(a.ms - d.fin * 100) <= 100, `${name}: ${a.ms} for ${d.fin * 100}`);
  assert.ok(b.ms > a.ms || name === 'bus');
  assert.equal(w.refused.length, 0);
}
const F40 = drives.f40;

// 2) "finished" without driving: standing on the grid, or sending nothing at all
{
  const w = world(2), d = raceDrive(F40);
  const still = { path: [d.grid], grid: d.grid, fin: 1250, claim: 125000 };
  const [a, b] = run(w, [still, d]);
  assert.equal(a.out, 'cut', 'no lap driven: out'); assert.equal(a.ms, null);
  assert.equal(b.out, null); assert.ok(b.ms > 0);
  assert.match(w.refused[0][1], /start line/);
}
{
  const w = world(2), d = raceDrive(F40);
  const [a] = run(w, [{ path: [], noGrid: 1, fin: 1250, claim: 125000 }, d]);
  assert.equal(a.out, 'cut', 'no positions: out');
  assert.match(w.refused[0][1], /grid/);
}
// 3) a finish shaved by 5 s: taken as when the server saw it, less a moment
{
  const w = world(2), d = raceDrive(F40);
  const [a] = run(w, [{ ...d, claim: d.fin * 100 - 5000 }, raceDrive(drives.bus, 1)]);
  assert.ok(a.ms >= d.fin * 100 - 800 && a.ms <= d.fin * 100, `shaved: ${a.ms} for ${d.fin * 100}`);
}
// 4) a short cut: half a minute of the lap left out by a jump
{
  const w = world(2), d = raceDrive(F40);
  const cutPath = [...d.path.slice(0, d.launch + 400), ...d.path.slice(d.launch + 700)];
  const [a] = run(w, [{ ...d, path: cutPath, fin: d.fin - 300 }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, 'cut', 'short cut: out');
  assert.match(w.refused[0][1], /jumped/);
}
// 5) away before the lights: 3 s early
{
  const w = world(2), d = raceDrive(F40);
  const [a] = run(w, [{ ...d, early: 3000 }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, 'cut', 'early start: out');
}
// 6) a flying start: through the grid at speed as the lights go out
{
  const w = world(2), d = raceDrive(F40), g = d.grid, v = 40;
  const run0 = []; for (let t = -5; t < 0; t += 0.1) run0.push([g[0] + ux * v * t, g[1] + uz * v * t]);
  const L = Math.hypot(F40[0][0] - g[0], F40[0][1] - g[1]), fly = [];
  for (let s = 0; s < L; s += v * 0.1) fly.push([g[0] + (F40[0][0] - g[0]) * s / L, g[1] + (F40[0][1] - g[1]) * s / L]);
  const path = [...fly, ...F40];
  w.begin();
  const go = w.desk.s.tGreen;
  for (let k = 0; clock < go; clock += 100, k++) { const left = Math.max(1, Math.round((go - clock) / 100)); w.pose(0, left <= run0.length ? run0[run0.length - left] : [g[0] + ux * v * -5, g[1] + uz * v * -5]); w.pose(1, gridAt(1)); }
  for (let k = 0; k < path.length; k++, clock += 100) w.pose(0, path[k]);
  w.msg(0, { t: 'rf', ms: path.length * 100 }); clock += 4000; w.desk.alarm();
  assert.equal(w.racer(0).out, 'cut', 'flying start: out');
}
// 7) a lost connection for 6 s in the middle of the lap, and the server restarted by a deploy: both finish
{
  const w = world(2), d = raceDrive(F40), d2 = raceDrive(drives.m3, 1);
  const [a, b] = run(w, [{ ...d, cut: (k) => !(k > d.launch + 600 && k < d.launch + 660) }, d2], { restartAt: 900 });
  assert.equal(a.out, null, JSON.stringify(w.refused)); assert.ok(Math.abs(a.ms - d.fin * 100) <= 100);
  assert.equal(b.out, null); assert.ok(Math.abs(b.ms - d2.fin * 100) <= 100);
}
// 8) the connection down over the finish line (5 s before it to 2 s after): the finish counts, no earlier than the pace allows
{
  const w = world(2), d = raceDrive(F40);
  const [a] = run(w, [{ ...d, cut: (k) => !(k > d.fin - 50 && k < d.fin + 20), claimAt: 2000 }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, null, JSON.stringify(w.refused));
  assert.ok(a.ms >= d.fin * 100 - 2000 && a.ms <= d.fin * 100 + 2000, `gap finish ${a.ms} for ${d.fin * 100}`);
}
// ... but silence over the lap's last minute and then "finished" is not believed
{
  const w = world(2), d = raceDrive(F40);
  const [a] = run(w, [{ ...d, cut: (k) => k < d.fin - 600, claimAt: 0 }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, 'cut', 'a minute unseen: out');
}
// 9) R: back 6 s along its own path, and on from there
{
  const w = world(2), d = raceDrive(F40), at = d.launch + 500;
  const path = [...d.path.slice(0, at), ...d.path.slice(at - 60)];
  const [a] = run(w, [{ ...d, path, fin: d.fin + 60 }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, null, JSON.stringify(w.refused)); assert.ok(Math.abs(a.ms - (d.fin + 60) * 100) <= 100);
}
// 10) a race of one from a page that sends no positions while alone: believed until the old pages are gone
{
  const w = world(1);
  const [a] = run(w, [{ path: [], noGrid: 1, fin: 1600 }]);
  assert.equal(a.out, null, 'old page alone'); assert.ok(a.ms > 150000);
  clock = OLD_PAGES_UNTIL + 60000;
  const w2 = world(1);
  run(w2, [{ path: [], noGrid: 1, fin: 1600 }]);
  assert.equal(w2.refused.length, 1, 'after the cut-over: positions needed');
  const w3 = world(1), d = raceDrive(F40);
  const [c] = run(w3, [d]);
  assert.equal(c.out, null); assert.ok(Math.abs(c.ms - d.fin * 100) <= 100);
}
// 12) hopping forward gate by gate (every gate is passed, most of the road between them is not driven): out
{
  const w = world(2), d = raceDrive(F40), a0 = d.launch + 300, a1 = d.launch + 700;
  const hop = []; for (let k = a0; k < a1; k++) if ((k - a0) % 6 < 2) hop.push(d.path[k]);
  const path = [...d.path.slice(0, a0), ...hop, ...d.path.slice(a1)];
  const [a] = run(w, [{ ...d, path, fin: d.fin - (a1 - a0) + hop.length }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, 'cut', 'hopping forward: out');
  assert.match(w.refused[0][1], /jumped/);
}
// 13) what a bad connection and a slow page do to honest positions. Held up for 1.2 s on the way and then all at
// once, at speed, five times in the lap; the page standing still for a second at speed (no positions from it, and
// the next one 60 m on); the connection gone from a second before the lights to four after. All finish, and the
// first two without using up any of the gaps a race may have.
{
  const w = world(2), d = raceDrive(F40), d2 = raceDrive(drives.m3, 1);
  const stalls = [300, 520, 760, 1010, 1300].map((k) => d.launch + k);
  let q = [];
  w.begin();
  const go = w.desk.s.tGreen;
  for (; clock < go; clock += 100) { w.pose(0, d.grid); w.pose(1, d2.grid); }
  clock = go;
  const stood = d2.launch + 800;
  for (let k = 0; k < Math.max(d.path.length, d2.path.length) + 60; k++, clock += 100) {
    if (k < d.path.length) {
      if (stalls.some((s0) => k >= s0 && k < s0 + 12)) q.push([d.path[k], clock % 60000]);
      else { for (const [pp, st] of q) w.pose(0, pp, st); q = []; w.pose(0, d.path[k]); }
    }
    if (k < d2.path.length && !(k > stood && k <= stood + 10)) w.pose(1, d2.path[k]);
    if (k === d.fin) w.msg(0, { t: 'rf', ms: d.fin * 100 - 30 });
    if (k === d2.fin) w.msg(1, { t: 'rf', ms: d2.fin * 100 - 30 });
    if (k % 20 === 0) w.desk.alarm();
  }
  const a = w.racer(0), b = w.racer(1);
  assert.equal(a.out, null, JSON.stringify(w.refused)); assert.ok(Math.abs(a.ms - d.fin * 100) <= 100, `held up: ${a.ms} for ${d.fin * 100}`);
  assert.equal(b.out, null, JSON.stringify(w.refused)); assert.ok(Math.abs(b.ms - d2.fin * 100) <= 100);
  assert.ok(!a.sk && !b.sk && !a.jp && !b.jp, `no gap used: ${a.sk} ${b.sk}`);
}
{
  const w = world(2), d = raceDrive(F40);
  const [a] = run(w, [{ ...d, cut: (k) => !(k >= 0 && k < 40) }, raceDrive(drives.bus, 1)]);
  assert.equal(a.out, null, `the start in a gap: ${JSON.stringify(w.refused)}`); assert.ok(Math.abs(a.ms - d.fin * 100) <= 100);
}
// 11) what the server keeps of each racer's lap is not told to the pages
{
  const w = world(2), d = raceDrive(F40);
  w.begin();
  for (let k = 0; k < 20; k++, clock += 100) { w.pose(0, d.grid); w.pose(1, gridAt(1)); }
  assert.ok(w.desk.s.racers[0].arm, 'seen on the grid');
  assert.deepEqual(Object.keys(w.desk.view().racers[0]).sort(), ['car', 'id', 'name']);
}
console.log(`ok: ${Object.keys(drives).length} honest drives followed to the finish; made-up, shaved, cut, hopped and early ones refused`);
