// A Raadi stage run as a real page drives it, against the real server (26 Nov 2026: the server now judges a run by
// the stage's own rules, worker/stagecheck.js, and times it by its own clock). One browser, the car moved in real
// time along the stage record of 26 Nov as it came from a player's browser (tools/fixtures/replays-raadi), from the
// green light to the finish.
// Wanted: the run on the board at the time it was driven, its drive stored (so its start, its way, its penalty
// seconds, its car and its time by the server's clock all held), nothing refused.
//   npm run build, then node tools/stage-live-test.mjs   (starts wrangler dev on 8790 itself; about 3 minutes)
import { createRequire } from 'module';
import fs from 'fs';
import { gunzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 8790, base = `http://127.0.0.1:${PORT}`, CAR = process.env.CAR || 'impreza';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const a = gunzipSync(fs.readFileSync(new URL(`./fixtures/replays-raadi/${CAR}.gz`, import.meta.url))).toString().split(',').map(Number);
const pts = []; { let x = 0, z = 0; for (let i = 0; i < a[3]; i++) { x += a[4 + i * 21] / 100; z += a[5 + i * 21] / 100; pts.push([+x.toFixed(2), +z.toFixed(2)]); } }

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/stage-live-${process.pid}`],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let t0 = Date.now(); ; await sleep(500)) {
  try { if ((await fetch(`${base}/api/online`)).ok) break; } catch { /* not yet */ }
  if (Date.now() - t0 > 180000) throw new Error('wrangler dev did not start');
}
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
const errs = [], posts = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('response', async (res) => { const u = new URL(res.url()); if (/\/api\/(lap|replay|mark)$/.test(u.pathname) && res.request().method() === 'POST') posts.push(`${u.pathname} ${res.status()} ${(await res.text().catch(() => '')).slice(0, 120)}`); });
await p.goto(`${base}/?raadi=1&q=low&trees=old`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.stage?.() && window.__game.race?.(), null, { timeout: 240000 });
await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, CAR);
await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
await p.evaluate(() => { __game.renderer.render = () => {}; });
await sleep(3000);
await p.evaluate(() => __game.stage().goStart());
// from the green light the car goes along the recorded run, in real time
await p.evaluate(({ pts }) => {
  const car = __game.car, s = __game.stage();
  let t0 = 0, cur = null, yaw = 0, on = false;
  const at = (t) => {
    const k = Math.min(pts.length - 1.001, Math.max(0, t / 0.1)), i = Math.floor(k), f = k - i, a = pts[i], q = pts[i + 1];
    const dx = q[0] - a[0], dz = q[1] - a[1];
    return { x: a[0] + dx * f, z: a[1] + dz * f, yaw: Math.hypot(dx, dz) > 0.01 ? Math.atan2(dx, -dz) : null, v: Math.hypot(dx, dz) / 0.1 };
  };
  const tick = () => {
    requestAnimationFrame(tick);
    if (!on) {
      if (s.phase !== 'run') return;
      on = true; t0 = performance.now(); yaw = car.yaw; cur = at(0);
      // (a little past the last place, so the finish line is crossed and not only reached)
      const e = pts.at(-1), q = pts.at(-2); for (let i = 1; i <= 30; i++) pts.push([e[0] + (e[0] - q[0]) * i, e[1] + (e[1] - q[1]) * i]);
      const v = { x: () => cur.x, z: () => cur.z, yaw: () => yaw, vx: () => cur.v, vy: () => 0, yawRate: () => 0 };
      for (const k in v) Object.defineProperty(car, k, { get: v[k], set() {}, configurable: true });
    }
    cur = at((performance.now() - t0) / 1000);
    if (cur.yaw != null) yaw = cur.yaw;
  };
  requestAnimationFrame(tick);
  setInterval(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); }, 5000);
}, { pts });
await p.waitForFunction(() => __game.stage().phase === 'done', null, { timeout: 300000, polling: 500 });
await sleep(15000);
const want = (a[3] - 1) * 100;
const out = {
  msg: await p.evaluate(() => document.querySelector('#stage .msg')?.textContent || ''),
  run: await p.evaluate(() => __game.stage().runs.at(-1)), drove: want, posts, errs: errs.slice(0, 3),
  board: (await (await fetch(`${base}/api/board`)).json()).raadi?.allTime?.find((r) => r.car === CAR) || null,
  replay: (await fetch(`${base}/api/replay?track=raadi&car=${CAR}`)).status,
  refused: await (await fetch(`${base}/api/replay?refused=1`)).json().catch(() => null),
  // (where the server saw the car during the run, against its drive: worker/livecheck.js)
  live: (await (await fetch(`${base}/api/margins`)).json().catch(() => null))?.kinds?.live || null,
};
console.log(JSON.stringify(out, null, 1));
const bad = [];
if (!out.run || Math.abs(out.run.ms - want) > 300 || out.run.pen) bad.push(`the run: ${JSON.stringify(out.run)} for a drive of ${want} ms`);
if (!out.board || out.board.ms !== out.run?.ms) bad.push('not on the board');
if (out.replay !== 200) bad.push(`its drive is not stored (${out.replay})`);
if (out.refused?.length) bad.push('something was refused');
if (!out.live?.n || out.live.max > 0.05) bad.push(`the run was not seen driven as its drive says: ${JSON.stringify(out.live)}`);
if (errs.length) bad.push('page errors');
console.log(bad.length ? `FAIL ${bad.join('; ')}` : 'ok: a stage run by a real page is on the board, its drive judged and stored');
await b.close(); stop();
process.exit(bad.length ? 1 : 0);
