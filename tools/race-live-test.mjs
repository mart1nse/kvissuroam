// A race as real pages drive it, against the real server (26 Nov 2026: the server now follows each racer round the
// lap itself, worker/follow.js, and times record laps by its own clock). Two browsers race from the grid, each car
// moved in real time along a record lap of 26 Nov as it came from a player's browser (tools/fixtures/replays), and
// a third racer over a bare connection says "finished" without ever sending a position.
// Wanted: both pages' finishes taken at the times they drove, the bare one out ("short cut"), and each page's lap
// accepted by the lap clock (its start and finish marks) when it is sent as a lap.
//   npm run build, then node tools/race-live-test.mjs   (starts wrangler dev on 8789 itself; about 5 minutes)
import { createRequire } from 'module';
import fs from 'fs';
import { gunzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 8789, base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (name) => {
  const a = gunzipSync(fs.readFileSync(new URL(`./fixtures/replays/${name}.gz`, import.meta.url))).toString().split(',').map(Number);
  const pts = []; let x = 0, z = 0;
  for (let i = 0; i < a[3]; i++) { x += a[4 + i * 21] / 100; z += a[4 + i * 21 + 1] / 100; pts.push([+x.toFixed(2), +z.toFixed(2)]); }
  return pts;
};
const CARS = (process.env.CARS || 'f40,m3').split(',');

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/race-live-${process.pid}`],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let t0 = Date.now(); ; await sleep(500)) {
  try { if ((await fetch(`${base}/api/online`)).ok) break; } catch { /* not yet */ }
  if (Date.now() - t0 > 180000) throw new Error('wrangler dev did not start');
}

const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pages = [];
for (const car of CARS) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
  const p = await ctx.newPage();
  p.car = car; p.errs = []; p.lapRes = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('response', async (res) => { if (/\/api\/(lap|replay)$/.test(new URL(res.url()).pathname) && res.request().method() === 'POST') p.lapRes.push(`${new URL(res.url()).pathname} ${res.status()} ${(await res.text().catch(() => '')).slice(0, 200)}`); });
  await p.goto(`${base}/?q=low&trees=old`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 240000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.render = () => {}; });
  pages.push(p);
  console.log(car, 'driving', process.uptime() | 0);
}
// the racer that only talks
const liar = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws?w=liar0001`);
let race = null, liarId = null;
liar.onmessage = (e) => {
  if (typeof e.data !== 'string' || e.data[0] !== '{') return;
  const m = JSON.parse(e.data);
  if (m.t === 'race') {
    race = m.r;
    const line = `${m.r.on ? 'on' : 'off'} ${m.r.racers.map((x) => `${x.name}:${x.ms ?? x.out ?? '-'}`).join(' ')} | last ${m.r.last ? m.r.last.racers.map((x) => `${x.name}:${x.ms ?? x.out}`).join(' ') : '-'}`;
    if (line !== liar.line) console.log(`  [${m.r.tGreen ? ((Date.now() - m.r.tGreen) / 1000).toFixed(1) : '-'}] ${liar.line = line}`);
  }
  if (m.id && !liarId && (m.t === 'welcome' || m.t === 'hi' || m.t === 'you')) liarId = m.id;
};
await new Promise((r) => { liar.onopen = r; });
liar.send(JSON.stringify({ t: 'hello', b: 1, name: 'OnlyTalk', car: 'w201' }));
const pinger = setInterval(() => liar.readyState === 1 && liar.send('ping'), 20000);
await sleep(1500);
liar.send(JSON.stringify({ t: 'drv', on: 1 }));

// both pages vote, the liar joins
for (const p of pages) await p.evaluate(() => __game.raceMode().act());
for (let t0 = Date.now(); !race?.on; await sleep(200)) if (Date.now() - t0 > 20000) throw new Error('no race');
liar.send(JSON.stringify({ t: 'rj', on: 1 }));
console.log('race on, racers', race.racers.length);

// each page: from its lights, the car goes at 6 m/s2 from its grid place to the lap's first place, then the lap
for (const p of pages) {
  await p.evaluate(({ pts }) => {
    const car = __game.car, rm = __game.raceMode();
    let wasPin = false, path = null, t0 = 0, cur = null;
    const at = (t) => {
      const k = Math.min(path.length - 1.001, Math.max(0, t / 0.1)), i = Math.floor(k), f = k - i, a = path[i], q = path[i + 1];
      const dx = q[0] - a[0], dz = q[1] - a[1];
      return { x: a[0] + dx * f, z: a[1] + dz * f, yaw: Math.hypot(dx, dz) > 0.01 ? Math.atan2(dx, -dz) : null, v: Math.hypot(dx, dz) / 0.1 };
    };
    let yaw = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      if (!path) {
        if (rm.pin) { wasPin = true; return; }
        if (!wasPin) return;
        const g = [car.x, car.z], to = pts[0], L = Math.hypot(to[0] - g[0], to[1] - g[1]); path = [];
        for (let t = 0; ; t += 0.1) { const d = 3 * t * t; if (d >= L) break; path.push([g[0] + (to[0] - g[0]) * d / L, g[1] + (to[1] - g[1]) * d / L]); }
        window.__launch = path.length;
        path.push(...pts);
        const e = pts.at(-1), q = pts.at(-2);
        for (let i = 1; i <= 40; i++) path.push([e[0] + (e[0] - q[0]) * i, e[1] + (e[1] - q[1]) * i]);
        t0 = performance.now(); yaw = car.yaw;
        const v = { x: () => cur.x, z: () => cur.z, yaw: () => yaw, vx: () => cur.v, vy: () => 0, yawRate: () => 0 };
        cur = at(0);
        for (const k in v) Object.defineProperty(car, k, { get: v[k], set() {}, configurable: true });
        window.__played = { t0: Date.now() };
      }
      cur = at((performance.now() - t0) / 1000);
      if (cur.yaw != null) yaw = cur.yaw;
    };
    requestAnimationFrame(tick);
    // (a key now and then: a car nobody touches for two minutes is parked)
    setInterval(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); }, 5000);
  }, { pts: drive(p.car) });
}
// the liar says it finished 2:05 after the lights
for (let t0 = Date.now(); !(race.tGreen && Date.now() > race.tGreen + 125000); await sleep(500)) if (Date.now() - t0 > 200000) throw new Error('lights never went');
liar.send(JSON.stringify({ t: 'rf', ms: 124000, id: race.id }));
console.log('the liar spoke', process.uptime() | 0);
// until the race is over
const id = race.id;
let last = null;
for (let t0 = Date.now(); ; await sleep(1000)) {
  const r = race.last?.id === id ? race.last : race.id === id && race.racers.length ? race : null;
  if (r) last = r;
  if (race.last?.id === id || (r && r.racers.every((x) => x.ms != null || x.out))) break;
  if (Date.now() - t0 > 330000) break;
}
await sleep(20000);
const out = { racers: last.racers.map((x) => ({ name: x.name, car: x.car, ms: x.ms, out: x.out })), pages: [] };
for (const p of pages) {
  const want = (drive(p.car).length - 1) * 100;
  out.pages.push({ car: p.car, lapOfDrive: want, launch: await p.evaluate(() => window.__launch * 100), laps: await p.evaluate(() => __game.race().laps.slice(-1).map((l) => l.ms)), lapRes: p.lapRes, errs: p.errs.slice(0, 3) });
}
out.replays = {};
for (const c of CARS) out.replays[c] = (await fetch(`${base}/api/replay?track=toomemagi&car=${c}`)).status;
out.refused = await (await fetch(`${base}/api/replay?refused=1`)).json().catch(() => null);
console.log(JSON.stringify(out, null, 1));
const bad = [];
for (const q of out.pages) {
  const r = out.racers.find((x) => x.car === q.car && x.name !== 'OnlyTalk');
  const want = q.launch + q.lapOfDrive;
  if (!r || r.ms == null) bad.push(`${q.car}: no finish (${r?.out})`);
  else if (Math.abs(r.ms - want) > 1500) bad.push(`${q.car}: finish ${r.ms}, drove ${want}`);
  if (q.lapRes.some((l) => /clock/.test(l))) bad.push(`${q.car}: lap refused by the clock`);
  if (q.errs.length) bad.push(`${q.car}: page errors`);
}
const lr = out.racers.find((x) => x.name === 'OnlyTalk');
if (!lr || lr.ms != null || lr.out !== 'cut') bad.push(`the liar: ${JSON.stringify(lr)}`);
console.log(bad.length ? `FAIL ${bad.join('; ')}` : 'ok: two pages raced and were followed to the finish; the racer that only talked is out');
clearInterval(pinger); liar.close(); await b.close(); stop();
process.exit(bad.length ? 1 : 0);
