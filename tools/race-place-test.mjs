// Racers' places seen by a player who is not in the race (Martin 2026-11-26: "if you come across a racer you see the
// position they are in"). Two pages race from the grid, each car moved in real time along a record lap of 26 Nov
// (tools/fixtures/replays, as in race-live-test.mjs); a third page stays out of the race and stands by the lap, first
// a few hundred metres in, then at the finish. Nothing new is sent for it: each page works the order out from the
// positions it already gets.
// Wanted, on the page that is not racing: every racer has a place from the lights on, the same places the racers'
// own pages give, each racer about where the racers' own pages put them on the lap; P1 / P2 over the racers' cars as
// they pass, the winner's P1 kept after the finish and WINNER once the race is over; and after 15 s of not following
// (a hidden tab) the racers found again at once. Also how long the page's race part takes a frame.
//   npm run build, then node tools/race-place-test.mjs   (starts wrangler dev on 8794 itself; about 5 minutes)
import { createRequire } from 'module';
import fs from 'fs';
import { gunzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 8794, base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drive = (name) => {
  const a = gunzipSync(fs.readFileSync(new URL(`./fixtures/replays/${name}.gz`, import.meta.url))).toString().split(',').map(Number);
  const pts = []; let x = 0, z = 0;
  for (let i = 0; i < a[3]; i++) { x += a[4 + i * 21] / 100; z += a[4 + i * 21 + 1] / 100; pts.push([+x.toFixed(2), +z.toFixed(2)]); }
  return pts;
};
const CARS = ['f40', 'm3'];

const LOG = `/tmp/race-place-${process.pid}.log`;
const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/race-place-${process.pid}`],
  { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', fs.openSync(LOG, 'w'), fs.openSync(LOG, 'a')], detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let t0 = Date.now(); ; await sleep(500)) {
  try { if ((await fetch(`${base}/api/online`)).ok) break; } catch { /* not yet */ }
  if (Date.now() - t0 > 180000) throw new Error('wrangler dev did not start');
}

const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(car) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
  const p = await ctx.newPage();
  p.car = car; p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(`${base}/?q=low&trees=old`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 240000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.render = () => {}; });
  p.id = await p.evaluate(() => __game.mp().id);
  console.log(car, 'driving', p.id, process.uptime() | 0);
  return p;
}
const racers = [];
for (const c of CARS) racers.push(await open(c));
const look = await open('passat');
const ids = racers.map((p) => p.id);
const lap = drive('f40');

// the onlooker: held still beside the lap (its own position is not raced; stand(): to another spot)
const stand = async (i, side) => {
  const a = lap[i], q = lap[i + 5], L = Math.hypot(q[0] - a[0], q[1] - a[1]) || 1, ux = (q[0] - a[0]) / L, uz = (q[1] - a[1]) / L;
  const x = a[0] - uz * side, z = a[1] + ux * side;
  await look.evaluate(async ([x, z, yaw]) => {
    await __game.world.loadAround(x, z, 300);
    const car = __game.car, v = { x: () => x, z: () => z, yaw: () => yaw, vx: () => 0, vy: () => 0, yawRate: () => 0 };
    for (const k in v) Object.defineProperty(car, k, { get: v[k], set() {}, configurable: true });
  }, [x, z, Math.atan2(-ux, uz)]);
};
await stand(350, 4);
// the race part of the onlooker's frame, timed
await look.evaluate(() => {
  const rm = __game.raceMode(), up = rm.update.bind(rm);
  window.__rmT = { n: 0, ms: 0, max: 0 };
  rm.update = (car, dt) => { const t0 = performance.now(); up(car, dt); const d = performance.now() - t0; const s = window.__rmT; if (rm.view()?.on) { s.n++; s.ms += d; s.max = Math.max(s.max, d); } };
  window.__rmUp = rm.update;
});

// both racers vote; the onlooker does not
for (const p of racers) await p.evaluate(() => __game.raceMode().act());
const raceOf = (p) => p.evaluate(() => __game.raceMode().view());
for (let t0 = Date.now(); !(await raceOf(look))?.on; await sleep(300)) if (Date.now() - t0 > 20000) throw new Error('no race');
console.log('race on', process.uptime() | 0);

for (const p of racers) {
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
        path.push(...pts);
        const e = pts.at(-1), q = pts.at(-2);
        for (let i = 1; i <= 40; i++) path.push([e[0] + (e[0] - q[0]) * i, e[1] + (e[1] - q[1]) * i]);
        t0 = performance.now(); yaw = car.yaw;
        const v = { x: () => cur.x, z: () => cur.z, yaw: () => yaw, vx: () => cur.v, vy: () => 0, yawRate: () => 0 };
        cur = at(0);
        for (const k in v) Object.defineProperty(car, k, { get: v[k], set() {}, configurable: true });
      }
      cur = at((performance.now() - t0) / 1000);
      if (cur.yaw != null) yaw = cur.yaw;
    };
    requestAnimationFrame(tick);
    setInterval(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); }, 5000);
  }, { pts: drive(p.car) });
}

// what a page makes of the race now
const read = (p) => p.evaluate((ids) => {
  const rm = __game.raceMode(), r = rm.view();
  return {
    t: __game.mp().serverNow(), on: !!r?.on, green: r?.tGreen || 0, fin: ids.map((id) => r?.racers?.find((x) => x.id === id)?.ms ?? null),
    pl: ids.map((id) => rm.place(id)), pr: ids.map((id) => rm.prog(id)),
    tags: [...document.querySelectorAll('#names .pname')].map((e) => ({ n: e.firstChild?.textContent || e.textContent, pos: e.dataset.pos || '', won: e.classList.contains('won'), on: e.style.display !== 'none' })),
  };
}, ids);

const rows = [], bad = [];
let moved = false, froze = 0, thawed = 0, over = 0;
for (let t0 = Date.now(); Date.now() - t0 < 360000; await sleep(1000)) {
  const [s0, s1, sl] = await Promise.all([read(racers[0]), read(racers[1]), read(look)]);
  const rt = sl.green ? (sl.t - sl.green) / 1000 : -1;
  rows.push({ rt, s0, s1, sl });
  const tagTxt = sl.tags.filter((g) => g.on || g.pos || g.won).map((g) => `${g.n}${g.pos ? `[${g.pos}]` : ''}${g.won ? '[WINNER]' : ''}${g.on ? '' : '(off)'}`).join(' ');
  console.log(`[${rt.toFixed(0).padStart(4)}] ${sl.on ? 'on ' : 'off'} onlooker P ${sl.pl.join('/')} prog ${sl.pr.map((v) => (v == null ? '-' : v.toFixed(0))).join('/')} | racers' own: ${s0.pl.join('/')} ${s1.pl.join('/')} prog ${s0.pr[0]?.toFixed(0)}/${s1.pr[1]?.toFixed(0)} | tags ${tagTxt}`);
  // 50 s after the lights: the onlooker's tab "hidden" for 15 s (the race part not run)
  if (rt > 50 && !froze) { froze = Date.now(); await look.evaluate(() => { __game.raceMode().update = () => {}; }); console.log('  onlooker stops following'); }
  if (froze && !thawed && Date.now() - froze > 15000) { thawed = Date.now(); await look.evaluate(() => { __game.raceMode().update = window.__rmUp; }); console.log('  onlooker follows again'); }
  // once the winner is about 40 s from the line: the onlooker goes to stand at the finish
  if (!moved && rt > lap.length / 10 - 45) { moved = true; await stand(lap.length - 30, 5); console.log('  onlooker to the finish'); }
  if (!sl.on && sl.green && rt > 30) { if (++over > 6) break; }
}

// ---- judging
const racing = rows.filter((x) => x.sl.on && x.rt > 3);
const following = racing.filter((x) => !(froze && x.s0.t >= froze - 2000 && x.s0.t <= (thawed || Infinity) + 1500));
const noPlace = following.filter((x) => x.sl.pl.some((v, i) => !v && x.sl.fin[i] == null) || new Set(x.sl.pl).size !== 2);
if (!racing.length) bad.push('the race never ran');
if (noPlace.length) bad.push(`${noPlace.length} looks without a place for each racer (first at ${noPlace[0].rt.toFixed(0)} s: ${noPlace[0].sl.pl})`);
// the order as it was on the road: each racer where its own page put it (the freshest word on it). Closer than 40 m
// (under a second) it is too close to call: the racers' own pages disagree then too, each sees itself a moment
// ahead of the positions it gets of the other.
const called = following.filter((x) => x.sl.fin.every((v) => v == null) && x.s0.pr[0] != null && x.s1.pr[1] != null && Math.abs(x.s0.pr[0] - x.s1.pr[1]) > 40);
const differ = called.filter((x) => x.sl.pl.join() !== (x.s0.pr[0] > x.s1.pr[1] ? '1,2' : '2,1'));
if (called.length < 20) bad.push(`only ${called.length} looks with the racers 40 m or more apart`);
if (differ.length > 2) bad.push(`${differ.length} of ${called.length} looks with places other than the racers' order on the road`);
// where on the lap: each racer as its own page puts itself (looks a second apart: about one second of driving)
const far = [];
for (const x of following) for (let i = 0; i < 2; i++) {
  const own = (i ? x.s1 : x.s0).pr[i], seen = x.sl.pr[i];
  if (own != null && seen != null && x.sl.fin[i] == null && Math.abs(own - seen) > 150) far.push(`${CARS[i]} ${x.rt.toFixed(0)} s: ${seen.toFixed(0)} vs ${own.toFixed(0)}`);
}
if (far.length > 2) bad.push(`the onlooker had racers far from where they were: ${far.slice(0, 4).join('; ')}`);
// back after the hidden tab
if (!thawed) bad.push('the hidden-tab part never ran');
else {
  const after = rows.filter((x) => x.s0.t > thawed + 1500 && x.s0.t < thawed + 6000 && x.sl.on);
  const lost = after.filter((x) => [0, 1].some((i) => x.sl.fin[i] == null && x.sl.pr[i] != null && (i ? x.s1 : x.s0).pr[i] != null && Math.abs(x.sl.pr[i] - (i ? x.s1 : x.s0).pr[i]) > 150));
  if (!after.length || lost.length) bad.push(`after the hidden tab the racers were not found again (${lost.length} of ${after.length} looks)`);
}
// the tags: P1 and P2 seen over the racers' cars, the winner's P1 kept after the line, WINNER once it is over
const seen = new Set();
for (const x of racing) for (const g of x.sl.tags) if (g.pos) seen.add(g.pos);
if (!seen.has('P1') || !seen.has('P2')) bad.push(`tags over the racers' cars: ${[...seen].join(', ') || 'none'}`);
const winner = rows.find((x) => x.sl.on && x.sl.fin.some((v) => v != null));
const wi = winner ? winner.sl.fin.findIndex((v) => v != null) : -1;
if (wi < 0) bad.push('nobody finished');
else {
  const keep = rows.filter((x) => x.sl.on && x.sl.fin[wi] != null);
  if (keep.some((x) => x.sl.pl[wi] !== 1)) bad.push('the winner lost P1 after the line');
  const ended = rows.filter((x) => !x.sl.on && x.rt > 30);
  if (!ended.some((x) => x.sl.tags.some((g) => g.won))) bad.push('no WINNER tag after the race');
  if (ended.some((x) => x.sl.tags.some((g) => g.pos))) bad.push('a place tag stayed after the race');
}
const cost = await look.evaluate(() => window.__rmT);
console.log(`onlooker's race part: ${cost.n} frames, ${(cost.ms / Math.max(1, cost.n)).toFixed(3)} ms a frame on average, longest ${cost.max.toFixed(2)} ms (software GL page, test machine)`);
for (const p of [...racers, look]) if (p.errs.length) bad.push(`${p.car}: page errors ${p.errs.slice(0, 2).join(' | ')}`);
if (far.length) console.log('far:', far.slice(0, 6).join('; '));
if (differ.length) console.log('differ at', differ.map((x) => `${x.rt.toFixed(0)}s ${x.sl.pl} (${x.s0.pr[0].toFixed(0)} / ${x.s1.pr[1].toFixed(0)})`).slice(0, 8).join('; '));
const both = following.filter((x) => x.s0.pl.join() === x.s1.pl.join());
console.log(`places as the racers' order on the road: ${called.length - differ.length} of ${called.length} looks; the same as both racers' own pages where those agree: ${both.filter((x) => x.sl.pl.join() === x.s0.pl.join()).length} of ${both.length}`);
console.log(bad.length ? `FAIL ${bad.join('; ')}` : `ok: the page out of the race followed both racers (${following.length} looks), P1/P2 over their cars, WINNER after`);
await b.close(); stop();
process.exit(bad.length ? 1 : 0);
