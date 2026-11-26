// Raadi stage, R in a run (Martin 26 Nov: "add 5s penalty when clicking R. just in case somebody crashes hard into
// something and presses R and gets a timegain"): the car goes back to a spot of at least 3 s before, the run goes on
// from there as it stood there, 5 s dearer each time. And the server must take such a run: its time with the
// seconds, its replay with the hop in it (worker checkTrace, src/race/plausible.js).
//
// 1) Made-up drives along the stage through the stage's own judge (as tools/raadi-wrongway-test.mjs), at speeds a
//    car can do, with the stage's `reset` called as main.js calls it: a short hop back, a long one (70 m: over 40 m
//    ended the run until now), one back over a bale just passed (that bale is to be passed again), two in one run.
// 2) The last of them sent to the server for real: on the board with its seconds, its replay kept, none refused.
// 3) The real key: a run started, driven down the first straight by the physics, R pressed: the car is back up the
//    road, the run goes on, +5 s on the panel, the toast; R again, +10.
// Needs the game served with its server: npm run build && npx wrangler dev --port 8787 --persist-to <empty dir>
//   node tools/raadi-reset-test.mjs [url] [key]
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const D = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url)));
const P = D.pts, S0 = D.start, F = D.finish;
const KEY_ONLY = process.argv.includes('key');              // only part 3 (parts 1 and 2 take six minutes)
const base = process.argv.slice(2).find((v) => v.startsWith('http')) || 'http://localhost:8787/?raadi=1&q=low&trees=old';

// ---- a drive along the stage from index a to b: places 0.1 s apart, slow where it bends, from a standstill
function drive(a, b) {
  const pts = [];
  for (let i = a; i < b; i++) {
    const p = P[i], q = P[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    for (let d = 0; d < l; d += 0.25) pts.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l, i]);
  }
  const n = pts.length, ds = 0.25, v = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const A = pts[Math.max(0, k - 16)], B = pts[k], C = pts[Math.min(n - 1, k + 16)];
    const h0 = Math.atan2(B[0] - A[0], B[1] - A[1]), h1 = Math.atan2(C[0] - B[0], C[1] - B[1]);
    const turn = Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) / 4 || 1e-6;   // rad per metre
    v[k] = Math.max(3.5, Math.min(17, Math.sqrt(4.5 / turn)));
  }
  v[0] = 0.5;
  for (let k = n - 2; k >= 0; k--) v[k] = Math.min(v[k], Math.sqrt(v[k + 1] ** 2 + 2 * 3.5 * ds));
  for (let k = 1; k < n; k++) v[k] = Math.min(v[k], Math.sqrt(v[k - 1] ** 2 + 2 * 2.2 * ds));
  const out = [];
  let s = 0;
  while (s < (n - 1) * ds) { const k = Math.floor(s / ds); out.push({ x: pts[k][0], z: pts[k][1], i: pts[k][2] }); s += Math.max(0.05, v[k] * 0.1); }
  return out;
}
const stand = (p, steps) => Array.from({ length: steps }, () => ({ ...p }));
// to index `to`, a stop there (the tree), R after `wait` s: back to where the car was `ago` s before the key
// (the game's rule: a spot at least 3 s old), then on to the finish and a little past it
function withResets(list) {
  const out = [];
  let from = S0;
  for (const { to, wait = 1, ago = 3.5 } of list) {
    const leg = drive(from, to);
    out.push(...leg, ...stand(leg.at(-1), Math.round(wait * 10)));
    const spot = out[out.length - 1 - Math.round(ago * 10)];
    out.push({ reset: true, back: Math.round(ago * 10), x: spot.x, z: spot.z, i: spot.i });
    from = spot.i;
  }
  out.push(...drive(from, Math.min(F + 14, P.length - 1)));
  return out;
}
const apex = D.apex.map((a) => a[0]).filter((k) => k > S0 + 60 && k < F - 80);
const bale = apex.find((k) => k > 180);
const cases = [
  { name: 'no reset', path: withResets([]), pen: 0 },
  { name: 'R after a stop, 3.5 s back', path: withResets([{ to: 250 }]), pen: 5 },
  { name: 'R at once after the stop, 9 s back', path: withResets([{ to: 250, wait: 0.2, ago: 9 }]), pen: 5, far: 40 },
  { name: `R just past the bale at ${bale}, back before it`, path: withResets([{ to: bale + 6, wait: 0.5, ago: 5 }]), pen: 5, gateBack: true },
  { name: 'R twice, the first a long way back', path: withResets([{ to: 200, wait: 0.2, ago: 9 }, { to: 420, wait: 2, ago: 4 }]), pen: 10, send: true },
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
const opened = Date.now();
await page.goto(base);
await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
await page.evaluate(() => __game.startDriving());
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
let bad = 0;
const check = (ok, text) => { if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`); };
const toGreen = async () => {
  await page.evaluate(() => { const s = __game.stage(); if (window.__stUpdate) s.update = window.__stUpdate; s.goStart(); });
  await page.waitForFunction(() => { const s = __game.stage(); s.countLeft = 0; return s.phase === 'run'; }, null, { timeout: 180000, polling: 200 });
};

// ---- 1) the judge
let sendLap = null;
for (const c of KEY_ONLY ? [] : cases) {
  await toGreen();
  const res = await page.evaluate(({ path }) => {
    const s = __game.stage(), mp = __game.mp();
    window.__stUpdate ||= s.update;
    window.__submit ||= mp.submitLap;
    let sent = null;
    mp.submitLap = (lap, trace) => { sent = { lap, trace }; };       // (kept: a made-up drive takes no time by the wall clock, the server would not have it)
    s.update = () => {};
    const car = __game.car, id = car.spec.id, times = [], hops = [];
    let time = car.time, msg = '', gates = null;
    car.vx = car.vy = 0;
    for (let k = 0; k < path.length && s.phase === 'run'; k++) {
      const p = path[k];
      if (p.reset) {
        const before = { x: car.x, z: car.z, gate: s.gate, prog: s.prog };
        car.x = p.x; car.z = p.z;
        const on = s.reset(times[times.length - p.back]);
        hops.push({ on, m: Math.hypot(before.x - p.x, before.z - p.z), gate0: before.gate, gate1: s.gate, prog0: before.prog, prog1: s.prog, pen: s.pen });
        continue;
      }
      car.x = p.x; car.z = p.z; car.time = time += 0.1;
      times.push(time);
      window.__stUpdate.call(s, car, id, id.toUpperCase(), 0.1, 'kb');
      if (s.phase !== 'run') msg = document.querySelector('#stage .msg')?.textContent || '';
    }
    window.__sent = sent;
    return { phase: s.phase, msg, hops, run: sent?.lap, hasTrace: !!sent?.trace, resets: s.resets, car: id, toast: document.querySelector('#toast')?.textContent || '' };
  }, { path: c.path });
  const fin = res.phase === 'done' && !!res.run;
  const steps = c.path.filter((p) => !p.reset).length;
  check(fin && (res.run.pen || 0) === c.pen, `${c.name}: ${fin ? `finished, ${(res.run.ms / 1000).toFixed(1)} s incl. +${res.run.pen || 0} s (${(steps / 10).toFixed(0)} s driven)` : `${res.phase} · ${res.msg}`}`);
  if (fin && c.pen) check(Math.abs(res.run.ms - (steps * 100 + c.pen * 1000)) < 3000, `   the time carries the seconds (${res.run.ms} ms against ${steps * 100} + ${c.pen * 1000})`);
  for (const h of res.hops) check(h.on && h.prog1 <= h.prog0, `   hop of ${h.m.toFixed(0)} m: the run goes on, +${h.pen} s so far, place on the stage ${h.prog0} -> ${h.prog1}, checks crossed ${h.gate0} -> ${h.gate1}`);
  if (c.far) check(res.hops[0]?.m > c.far, `   (that hop was over ${c.far} m: it used to end the run)`);
  if (c.gateBack) check(res.hops[0]?.gate1 === res.hops[0]?.gate0 - 1, '   the bale passed after that spot is to be passed again');
  if (c.send && fin) sendLap = res;
}

// ---- 2) the server
if (sendLap) {
  const driven = sendLap.run.ms - (sendLap.run.pen || 0) * 1000;
  const wait = opened + driven + 15000 - Date.now();
  if (wait > 0) { console.log(`     (waiting ${Math.round(wait / 1000)} s: the server wants the run to fit inside the time the page has been open)`); await page.waitForTimeout(wait); }
  await page.evaluate(() => { const mp = __game.mp(), { lap, trace } = window.__sent; mp.submitLap = window.__submit; mp.submitLap({ ...lap, at: new Date().toISOString(), track: 'raadi' }, trace); });
  let row = null;
  for (let k = 0; k < 40 && !row; k++) {
    await page.waitForTimeout(1500);
    const b = await (await fetch(new URL('/api/board', base))).json();
    row = b.raadi?.allTime?.find((r) => r.car === sendLap.car && r.ms === sendLap.run.ms) || null;
  }
  check(!!row && row.pen === sendLap.run.pen, `server: the run is on the board${row ? ` (${(row.ms / 1000).toFixed(2)} s, pen ${row.pen})` : ', NOT'}`);
  const refused = await (await fetch(new URL('/api/replay?refused=1', base))).json().catch(() => null);
  const list = Array.isArray(refused) ? refused : refused?.refused || [];
  check(list.length === 0, `server: no replay refused${list.length ? `: ${JSON.stringify(list)}` : ''}`);
  const rp = await fetch(new URL(`/api/replay?track=raadi&car=${sendLap.car}`, base));
  check(rp.ok, `server: the replay with both hops in it is kept (${rp.status})`);
}

// ---- 3) the key
await toGreen();
const real = await page.evaluate(async () => {
  const s = __game.stage(), car = __game.car, frames = (n) => new Promise((done) => { const go = () => (n-- > 0 ? requestAnimationFrame(go) : done()); go(); });
  if (window.__stUpdate) s.update = window.__stUpdate;
  await frames(3);
  // down the first straight for a while by the physics, the game's own frames in between (they keep the spots R
  // goes back to, and the stage's judge runs in them)
  const log = [];
  for (let k = 0; k < 40 && s.phase === 'run'; k++) { __game.sim(0.1, { up: k < 25 ? 1 : 0, down: k >= 25 ? 1 : 0 }); await frames(2); }
  log.push({ what: 'driven', phase: s.phase, x: car.x, z: car.z, pen: s.pen, prog: s.prog });
  return log;
});
const sp = [P[S0][0], P[S0][1]];
const fromStart = (o) => Math.hypot(o.x - sp[0], o.z - sp[1]);
console.log(`     driven ${fromStart(real[0]).toFixed(0)} m down the first straight (${real[0].phase}, +${real[0].pen} s)`);
const state = () => page.evaluate(() => { const s = __game.stage(), c = __game.car; return { phase: s.phase, pen: s.pen, x: c.x, z: c.z, prog: s.prog, msg: document.querySelector('#stage .msg')?.textContent || '', toast: document.querySelector('#toast')?.textContent || '' }; });
const b0 = await state();
await page.keyboard.press('r');
await page.waitForTimeout(600);
const b1 = await state();
check(b1.phase === 'run' && b1.pen === b0.pen + 5, `R: the run goes on, +${b1.pen - b0.pen} s · "${b1.msg}" · toast "${b1.toast}"`);
// (pressed as the car stops: the newest spot 3 s old is from early on the straight)
check(fromStart(b1) < fromStart(b0) - 3, `R: the car is back up the road (${fromStart(b0).toFixed(1)} m from the line -> ${fromStart(b1).toFixed(1)} m)`);
check(/\+5 S/.test(b1.toast) && /PENALTY \+\d+ S/.test(b1.msg), 'R: the seconds are told as the other penalties are');
await page.keyboard.press('r');
await page.waitForTimeout(600);
const b2 = await state();
check(b2.phase === 'run' && b2.pen === b0.pen + 10 && fromStart(b2) <= fromStart(b1) + 0.5, `R again: +${b2.pen - b0.pen} s, ${fromStart(b2).toFixed(1)} m from the line`);
// (before the lights: R is no penalty, the car stays on the line)
await page.evaluate(() => __game.stage().goStart());
await page.waitForTimeout(300);
await page.keyboard.press('r');
await page.waitForTimeout(600);
const b3 = await state();
check(b3.phase === 'count' && b3.pen === 0 && fromStart(b3) < 4, `R on the line before green: nothing (${b3.phase}, +${b3.pen} s, ${fromStart(b3).toFixed(1)} m from the line)`);
await browser.close();
process.exit(bad ? 1 : 0);
