// Laps while the server is full or gone (Martin 2026-11-25): with SERVER FULL a page drives offline but must
// still be able to pick either track, drive a Raadi stage and a Toomemägi lap, and get both onto the board
// (laps go by plain HTTP, not the full socket). Offline (no server at all) the laps wait in the browser.
//   npm run build, then node tools/full-laps-test.mjs   (starts wrangler dev on 8788 with MAX_ONLINE 1 itself)
import { createRequire } from 'module';
import fs from 'fs';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 8788, base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url)));
const T = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts, N = T.length;
function along(a, b) {
  const out = [];
  for (let i = a; i !== b; i++) {
    const p = D.pts[i], q = D.pts[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    for (let d = 0; d < l; d += 2) out.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l]);
  }
  return out;
}
const stagePath = [...along(D.start, D.finish), ...along(D.finish, Math.min(D.finish + 12, D.pts.length - 1))];
const lapPath = []; for (let k = N - 30; k < N + N + 40; k++) lapPath.push(T[k % N]);

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--var', `MAX_ONLINE:${process.env.CAP || 1}`, '--persist-to', `/tmp/full-laps-${process.pid}`],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let t0 = Date.now(); ; await sleep(500)) {
  try { if ((await fetch(`${base}/api/online`)).ok) break; } catch { /* not yet */ }
  if (Date.now() - t0 > 180000) throw new Error('wrangler dev did not start');
}
// somebody already has the one place
const holder = new WebSocket(`ws://127.0.0.1:${PORT}/api/ws?w=holder01`);
holder.onopen = () => holder.send(JSON.stringify({ t: 'hello', b: 1, name: 'Holder', car: 'w201', w: 'map' }));
const pinger = setInterval(() => holder.readyState === 1 && holder.send('ping'), 20000);
await sleep(1500);

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {};
for (const mode of (process.env.MODES || 'full,offline').split(',')) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
  if (mode === 'offline') {
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 500, body: 'Error 1103' }));
    await ctx.routeWebSocket('**/api/ws**', (ws) => ws.close({ code: 1006 }));
  }
  const p = await ctx.newPage();
  const errs = [], lapRes = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('response', async (res) => { if (res.url().endsWith('/api/lap')) lapRes.push(`${res.status()} ${(await res.text().catch(() => '')).slice(0, 300)}`); });
  await p.goto(`${base}/?raadi=1&q=low&trees=old`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.stage?.() && window.__game.race?.(), null, { timeout: 240000 });
  await p.evaluate(() => { __game.setCar('impreza', true); __game.startDriving(); });
  await p.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
  await sleep(3000);
  const r = { state: await p.evaluate(() => ({ online: __game.mp().online, full: __game.mp().full })) };
  // the Raadi stage, start to finish
  await p.evaluate(() => __game.stage().goStart());
  await p.waitForFunction(() => { const s = __game.stage(); s.countLeft = 0; return s.phase === 'run'; }, null, { timeout: 180000, polling: 200 });
  r.stage = await p.evaluate(({ path }) => {
    const s = __game.stage(), up = s.update; s.update = () => {};
    const car = __game.car; let time = car.time;
    for (let k = 0; k < path.length && s.phase === 'run'; k++) { car.x = path[k][0]; car.z = path[k][1]; car.time = time += 0.1; up.call(s, car, 'impreza', 'IMPREZA', 0.1, 'kb'); }
    s.update = up;
    return { phase: s.phase, runs: s.runs.length, msg: document.querySelector('#stage .msg')?.textContent || '' };
  }, { path: stagePath });
  // a lap of Toomemägi on the same page
  r.lap = await p.evaluate(({ path }) => {
    const rc = __game.race(), up = rc.update, n0 = rc.laps.length; rc.update = () => {};
    let time = 1000; for (const [x, z] of path) { time += 0.1; up.call(rc, { x, z, time, vx: 30 }, 'impreza', 'IMPREZA'); }
    rc.update = up; return rc.laps.length - n0;
  }, { path: lapPath });
  await sleep(4000);
  r.pending = await p.evaluate(() => JSON.parse(localStorage.getItem('kvissuroam.pendingLaps') || '[]').map((l) => `${l.track || 'toomemagi'} ${l.ms}`));
  r.name = await p.evaluate(() => localStorage.getItem('kvissuroam.name'));
  r.errors = errs.slice(0, 4);
  r.lapRes = lapRes;
  out[mode] = r;
  await ctx.close();
}
// (the made-up runs are refused by the lap checks, as from an online page: what matters is that they were sent)
const bad = [];
if (out.full) { const f = out.full; if (!f.state.full || f.stage.phase !== 'done' || f.lap !== 1 || f.pending.length || f.lapRes.length < 1) bad.push('full'); }
if (out.offline) { const f = out.offline; if (f.stage.phase !== 'done' || f.lap !== 1 || f.pending.length !== 2) bad.push('offline'); }
console.log(JSON.stringify(out, null, 1));
console.log(bad.length ? `FAIL ${bad.join(', ')}` : 'laps while full and offline: ok');
clearInterval(pinger); holder.close(); await b.close(); stop();
process.exit(bad.length ? 1 : 0);
