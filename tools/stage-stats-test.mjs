// The Majoraadi stage's counts on /stats (Martin 26 Nov 2026, at the stage's launch: "Make sure stats start coming
// through"). A page with no flag (the stage is on for everyone) and ?stats=1 drives made-up runs through the stage's
// own judge, as tools/raadi-wrongway-test.mjs does: a clean run, one the wrong way, one given up with H, a count left
// before green and a run going on as the page closes. The bundles it sends go through worker/stats.js as the server
// takes them, and /stats is drawn from the totals: the Majoraadi cards must show what was driven.
// Needs the dev server (npx vite --port 5198) and Playwright. Usage: node tools/stage-stats-test.mjs
import { createRequire } from 'module';
import { register } from 'node:module';
import fs from 'fs';
import assert from 'node:assert/strict';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject {}', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const { chromium } = createRequire(import.meta.url)('playwright');
const { addBundle } = await import(new URL('../worker/stats.js', import.meta.url).href);
const D = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url)));
const P = D.pts, S0 = D.start, F = D.finish;
const base = process.argv[2] || 'http://localhost:5198';

// points 2 m apart along the stage from index a to b (either way)
function along(a, b) {
  const out = [], st = a <= b ? 1 : -1;
  for (let i = a; i !== b; i += st) {
    const p = P[i], q = P[i + st], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    for (let d = 0; d < l; d += 2) out.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l]);
  }
  return out;
}
const tail = along(F, Math.min(F + 12, P.length - 1));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 } });
const bundles = [];
await ctx.route('**/api/stats', (r) => {
  if (r.request().method() === 'POST') { try { bundles.push(JSON.parse(r.request().postData())); } catch { /* not ours */ } }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});
await ctx.routeWebSocket('**/api/ws', (ws) => ws.close({ code: 1006 }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message); });
await page.goto(`${base}/?q=low&trees=old&stats=1`, { timeout: 180000 });
await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
await page.evaluate(() => __game.startDriving());
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });

// onto the line (a 'line'), the lights to green (a 'start')
async function toGreen() {
  await page.evaluate(() => { const s = __game.stage(); if (window.__stUpdate) s.update = window.__stUpdate; s.goStart(); });
  await page.waitForFunction(() => { const s = __game.stage(); s.countLeft = 0; return s.phase === 'run'; }, null, { timeout: 180000, polling: 200 });
}
// drive a path through the stage's judge in one go (the stage's own frames leave it alone meanwhile)
const drive = (path) => page.evaluate(({ path }) => {
  const s = __game.stage();
  window.__stUpdate ||= s.update;
  s.update = () => {};
  const car = __game.car;
  let time = car.time;
  for (let k = 0; k < path.length && s.phase === 'run'; k++) {
    car.x = path[k][0]; car.z = path[k][1]; car.time = time += 0.1;
    window.__stUpdate.call(s, car, 'impreza', 'IMPREZA', 0.1, 'kb');
  }
  s.update = window.__stUpdate;
  return s.phase;
}, { path });

// 1) a clean run: finished
await toGreen();
assert.equal(await drive([...along(S0, F), ...tail]), 'done', 'the clean run finishes');
// 2) 120 m backwards: WRONG WAY
await toGreen();
assert.equal(await drive([...along(S0, 250), ...along(250, 190)]), 'done', 'the wrong way run ends');
// 3) given up with H in the middle of a run (back on the line)
await toGreen();
await drive(along(S0, 120));
// 4) the count left before green (the garage's cancel would do the same; here straight away)
await page.evaluate(() => { const s = __game.stage(); s.goStart(); s.cancel('STAGE CANCELLED'); });
// 5) a run going on as the page closes
await toGreen();
await drive(along(S0, 60));
await page.evaluate(() => dispatchEvent(new Event('pagehide')));
await page.waitForTimeout(1500);

// what the server would keep: every bundle through worker/stats.js
const t = {};
for (const b of bundles) assert.ok(addBundle(t, b, { hour: 12 }), 'the server takes the bundle');
const S = t.stage || {};
console.log('stage', JSON.stringify(S), 'cars', JSON.stringify(t.stageCar));
assert.equal(S.line, 5, 'five times on the line');
assert.equal(S.start, 4, 'four runs started');
assert.equal(S.finish, 1, 'one finished');
assert.equal(S['x:wrong'], 1, 'one the wrong way');
assert.equal(S['x:restart'], 1, 'one given up with H');
assert.equal(S['x:lights'], 1, 'one left before green');
assert.equal(S['x:quit'], 1, 'one going on as the page closed');
assert.equal(t.stageCar?.impreza, 1, 'the finish in its car');
assert.equal((S['ty:gravel'] || 0) + (S['ty:road'] || 0), 1, 'its tyres');
assert.equal(Object.keys(S).filter((k) => k.startsWith('pen:')).reduce((a, k) => a + S[k], 0), 1, 'its penalty step');
// (a made-up key is dropped)
const junk = {};
addBundle(junk, { v: 1, stage: { 'x:hack': 5, finish: 1e6 }, stageCar: { nocar: 3 } });
assert.equal(junk.stage['x:hack'], undefined);
assert.equal(junk.stage.finish, 40, 'one bundle adds at most 40');
assert.deepEqual(junk.stageCar || {}, {}, 'no made-up car');

// /stats drawn from those totals
const st = await ctx.newPage();
await st.route('**/api/stats?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ days: 1, hours: 24, from: '', to: '', heat: 250, total: t, daily: [], visits: [], hourly: [], names: { impreza: 'IMPREZA' }, load: null, drivers: { n: 0, top: [] } }) }));
await st.route('**/api/online', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"n":0,"people":[]}' }));
st.on('pageerror', (e) => { errors.push(`stats: ${e.message}`); console.log('STATS PAGEERR', e.message); });
await st.goto(`${base}/stats.html`);
await st.waitForSelector('.tiles', { timeout: 30000 });
const text = await st.evaluate(() => document.body.innerText);
for (const want of ['Majoraadi runs finished', 'MAJORAADI STAGE', 'HOW MAJORAADI RUNS ENDED', 'wrong way', 'back to the start (H)', 'page closed mid-run', 'MAJORAADI RUNS FINISHED PER CAR', 'IMPREZA']) {
  assert.ok(text.toUpperCase().includes(want.toUpperCase()), `/stats shows "${want}"`);
}
await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('OK: the Majoraadi stage counts reach /stats');
