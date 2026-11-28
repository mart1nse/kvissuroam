// Tallinn's own room (?tln=1, src/city.js, Martin 28 Nov 2026): a Tallinn page and a Tartu page on the same server are
// in two lobbies (worker/index.js: ?city=tallinn goes to the 'tallinn' object), see only their own city's players,
// and a lap driven round Pirita-Kose goes to Tallinn's lobby and is judged there against its own lap, not Toomemägi's.
//   npm run build, then node tools/tallinn-room-test.mjs   (starts wrangler dev on 8789 itself)
import { createRequire } from 'module';
import fs from 'fs';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 8789, base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = JSON.parse(fs.readFileSync(new URL('../src/race/pirita.json', import.meta.url))).pts, N = T.length;
const lapPath = []; for (let k = N - 30; k < N + N + 40; k++) lapPath.push(T[k % N]);

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', `/tmp/tallinn-room-${process.pid}`],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let t0 = Date.now(); ; await sleep(500)) {
  try { if ((await fetch(`${base}/api/online`)).ok) break; } catch { /* not yet */ }
  if (Date.now() - t0 > 180000) throw new Error('wrangler dev did not start');
}
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(q, name) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.addInitScript((n) => localStorage.setItem('kvissuroam.name', n), name);
  await p.goto(`${base}/${q}`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.race?.() && __game.mode === 'menu', null, { timeout: 240000 });
  await p.evaluate(() => { __game.setCar('impreza', true); __game.startDriving(); });
  await p.waitForFunction(() => __game.mode === 'drive' && __game.mp().online, null, { timeout: 180000 });
  return p;
}
const tln = await open('?tln=1&city=tallinn&q=low&trees=old', 'TallinnTester');
const tartu = await open('?q=low&trees=old', 'TartuTester');
await sleep(4000);
// who each lobby has online (the list behind /stats' "more")
const online = async (q) => JSON.stringify(await (await fetch(`${base}/api/online${q}`)).json());
const r = { tallinnRoom: await online('?city=tallinn'), tartuRoom: await online('') };
// a lap round Pirita-Kose on the Tallinn page (made up: the server refuses its timing, but it must be Tallinn's lobby
// that answers, and not for the route)
r.lap = await tln.evaluate(({ path }) => {
  // (the lap's POST and the server's answer, read in the page: the page's 'response' event missed it)
  const f0 = window.fetch; window.__lapRes = [];
  window.fetch = async (u, o) => { const r = await f0(u, o); if (String(u).includes('/api/lap')) window.__lapRes.push(`${u} ${r.status} ${(await r.clone().text().catch(() => '')).slice(0, 200)}`); return r; };
  const rc = __game.race(), up = rc.update, n0 = rc.laps.length; rc.update = () => {};
  let time = 1000; for (const [x, z] of path) { time += 0.1; up.call(rc, { x, z, time, vx: 30 }, 'impreza', 'IMPREZA'); }
  rc.update = up; return rc.laps.length - n0;
}, { path: lapPath });
await sleep(8000);
r.lapRes = await tln.evaluate(() => window.__lapRes);
r.pending = await tln.evaluate(() => localStorage.getItem('kvissuroam.pendingLaps'));
r.lastLap = await tln.evaluate(() => JSON.stringify(__game.race().laps.at(-1)).slice(0, 300));
r.boards = {};
for (const q of ['', '?city=tallinn']) { const j = await (await fetch(`${base}/api/board${q}`)).json(); r.boards[q || 'tartu'] = { laps: j.laps, track: j.track }; }
r.errors = [...tln.errs, ...tartu.errs].slice(0, 4);
console.log(JSON.stringify(r, null, 1));
const bad = [];
if (!r.tallinnRoom.includes('TallinnTester') || r.tallinnRoom.includes('TartuTester') || !r.tartuRoom.includes('TartuTester') || r.tartuRoom.includes('TallinnTester')) bad.push('the two cities are not each in their own room');
if (r.lap !== 1) bad.push('no lap timed round Pirita-Kose');
if (!r.lapRes.some((l) => l.startsWith('/api/lap?city=tallinn'))) bad.push('the lap did not go to Tallinn\'s lobby');
if (r.lapRes.some((l) => /route/.test(l))) bad.push('judged against another lap');
if (r.errors.length) bad.push('page errors');
console.log(bad.length ? `FAIL ${bad.join(', ')}` : 'Tallinn room: ok');
await b.close(); stop();
process.exit(bad.length ? 1 : 0);
