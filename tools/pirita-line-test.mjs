// The Pirita-Kose lap's worn line and tyre marks (src/world/tln/piritaline.js) while driving: a Tallinn page drives
// the lap at 30 m/s for a minute (the car moved along the lap's line every frame); each step of the line's building
// is timed. Passes when stretches got built ahead of the car, no step took over 8 ms, and the page threw nothing.
//   node tools/pirita-line-test.mjs [base=http://127.0.0.1:5198] [from=lap point] [secs=60]
// Needs the vite dev server and Playwright.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const base = arg('base', 'http://127.0.0.1:5198'), from = +arg('from', 300), secs = +arg('secs', 60);
const LAP = JSON.parse(readFileSync(new URL('../src/race/pirita.json', import.meta.url))).pts;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/?drive&nointro&tln=1&city=tallinn`, { timeout: 240000 });
await p.waitForFunction(() => window.__game?.world && window.__game.car && window.__game.pirita?.(), null, { timeout: 240000 });
const a = LAP[from], c = LAP[from + 3];
await p.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 400); __game.place({ x, z, yaw }); }, [a[0], a[1], Math.atan2(c[0] - a[0], -(c[1] - a[1]))]);
await p.waitForTimeout(8000);
// (a software-drawn page crawls, and the game then runs its queue at once: here it is held live, as on a real device)
await p.evaluate(() => { const J = __game.jobs; J.setLive(true); J.setLive = () => {}; });
const r = await p.evaluate(async ([lap, from, secs]) => {
  const g = __game, J = g.jobs, add = J.add.bind(J), steps = [];
  // (each step of the line's jobs timed)
  J.add = (fn, label) => {
    if (label !== 'pirita line') return add(fn, label);
    return add(function* timed() {
      const it = fn();
      for (;;) { const t = performance.now(); const s = it.next(); steps.push(performance.now() - t); if (s.done) return; yield s.value; }
    }, label);
  };
  const N = lap.length, seg = [];
  let d = 0; for (let i = 0; i < N; i++) { const q = lap[(from + i) % N], n = lap[(from + i + 1) % N]; seg.push([q, n, d]); d += Math.hypot(n[0] - q[0], n[1] - q[1]); }
  const t0 = performance.now(), frames = [];
  let last = t0, k = 0;
  await new Promise((done) => {
    const tick = () => {
      const t = performance.now(), dist = ((t - t0) / 1000) * 30;
      frames.push(t - last); last = t;
      while (k < seg.length - 1 && seg[k + 1][2] <= dist) k++;
      const [q, n, d0] = seg[k], l = Math.hypot(n[0] - q[0], n[1] - q[1]) || 1, f = Math.min(1, (dist - d0) / l);
      Object.assign(g.car, { x: q[0] + (n[0] - q[0]) * f, z: q[1] + (n[1] - q[1]) * f, yaw: Math.atan2(n[0] - q[0], -(n[1] - q[1])), vx: 30, vy: 0 });
      if (t - t0 < secs * 1000) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  J.add = add;
  steps.sort((x, y) => y - x);
  return { info: g.pirita().line.info(), steps: steps.length, top: steps.slice(0, 5).map((v) => +v.toFixed(1)), total: +steps.reduce((x, y) => x + y, 0).toFixed(0), slow: J.slow.filter((s) => s[0] === 'pirita line') };
}, [LAP, from, secs]);
console.log(JSON.stringify({ ...r, errors: errs.slice(0, 4) }));
const bad = [];
if (r.info.built < 3) bad.push('stretches built');
if (r.top[0] > 8) bad.push(`a step of ${r.top[0]} ms`);
if (errs.length) bad.push('page errors');
console.log(bad.length ? `FAIL ${bad.join(', ')}` : 'pirita line while driving: ok');
await b.close();
process.exit(bad.length ? 1 : 0);
