// The game with the server gone (a Workers spending limit: Cloudflare answers every /api/ call with
// error 1103 and no socket opens), only the static page and files served.
//   npm run build && npx vite preview --port 4173, then node tools/offline-test.mjs [port=4173] [raadi]
// Checks the flows that touch the server: loading, free drive, a lap of Toomemägi (kept locally and
// queued to send later), the LAP TIMES board, the online list, Raadi, and how often the page asks again.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const port = +arg('port', 4173);
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts, N = P.length;

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
const log = { api: {}, ws: 0, errors: [], console: [] };
const t0 = Date.now();
await ctx.route('**/api/**', (r) => {
  const k = `${r.request().method()} ${new URL(r.request().url()).pathname}`;
  (log.api[k] ||= []).push(((Date.now() - t0) / 1000) | 0);
  return r.fulfill({ status: 500, contentType: 'text/html', body: '<html><body>Error 1103: worker exceeded resource limits</body></html>' });
});
await ctx.routeWebSocket('**/api/ws', (ws) => { log.ws++; ws.close({ code: 1006 }); });
const p = await ctx.newPage();
p.on('pageerror', (e) => log.errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') log.console.push(m.text().slice(0, 160)); });
const res = {};

const raadi = process.argv.includes('raadi');
await p.goto(`http://localhost:${port}/?q=low&trees=old${raadi ? '&raadi=1' : ''}`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.car && window.__game.race?.(), null, { timeout: 240000 });
res.loadedSec = ((Date.now() - t0) / 1000) | 0;
res.loadMsg = await p.evaluate(() => document.querySelector('#loadmsg')?.textContent || '');
res.name = await p.evaluate(() => localStorage.getItem('kvissuroam.name'));

// free drive: 20 s of gas
await p.evaluate(() => { __game.setCar('w201', true); __game.startDriving(); });
await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
const x0 = await p.evaluate(() => [__game.car.x, __game.car.z]);
// (software drawing is slow here: the picture is left out so the car gets its real frame rate)
await p.evaluate(() => { window.__render = __game.renderer.render; __game.renderer.render = () => {}; });
await p.keyboard.down('ArrowUp'); await p.waitForTimeout(8000); await p.keyboard.up('ArrowUp');
const x1 = await p.evaluate(() => [__game.car.x, __game.car.z]);
res.droveMetres = Math.round(Math.hypot(x1[0] - x0[0], x1[1] - x0[1]));
res.fps = await p.evaluate(() => new Promise((ok) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else ok(+(n / 3).toFixed(1)); }; requestAnimationFrame(f); }));

// a lap of Toomemägi through the lap timer (as tools/shortcut-test.mjs drives it)
const path = [];
for (let k = N - 30; k < N + N + 40; k++) { const i = k % N; path.push(P[i]); }
res.lap = await p.evaluate(({ path }) => {
  const r = __game.race(), up = r.update, n0 = r.laps.length;
  r.update = () => {};
  let time = 1000;
  for (const [x, z] of path) { time += 0.1; up.call(r, { x, z, time, vx: 30 }, 'f40', 'F40'); }
  r.update = up;
  return { lapsBefore: n0, lapsAfter: r.laps.length };
}, { path });
await p.waitForTimeout(2000);
res.lapStored = await p.evaluate(() => ({ laps: JSON.parse(localStorage.getItem('kvissuroam.laps') || '[]').length, pending: JSON.parse(localStorage.getItem('kvissuroam.pendingLaps') || '[]').length }));

// the LAP TIMES board and the online list
await p.evaluate(() => { __game.renderer.render = window.__render; });
res.board = await p.evaluate(() => { const bd = __game.board(); bd.show(); const t = document.querySelector('#board'); const txt = t && !t.classList.contains('hidden') ? t.innerText.replace(/\s+/g, ' ').slice(0, 400) : '(not shown)'; return txt; });
await p.screenshot({ path: arg('shot', '/tmp/offline') + '-board.png' });
await p.evaluate(() => __game.board().hide());
res.online = await p.evaluate(() => { const mp = __game.mp(); return { count: mp.count, full: mp.full, roster: mp.roster().length }; });
res.peopleText = await p.evaluate(() => document.querySelector('#people')?.innerText.replace(/\s+/g, ' ').slice(0, 200));
await p.screenshot({ path: arg('shot', '/tmp/offline') + '-drive.png' });

// a minute more: how often does it ask again?
const w0 = log.ws, a0 = Object.values(log.api).flat().length;
await p.waitForTimeout(60000);
res.perMinute = { sockets: log.ws - w0, apiCalls: Object.values(log.api).flat().length - a0 };
res.api = Object.fromEntries(Object.entries(log.api).map(([k, v]) => [k, v.length]));
res.socketTries = log.ws;
res.pageErrors = log.errors;
res.consoleErrors = [...new Set(log.console)].slice(0, 8);
console.log(JSON.stringify(res, null, 1));
await b.close();
