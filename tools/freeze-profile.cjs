// Where does the game stand still during a drive?   node tools/freeze-profile.cjs [route=centre] [step=0.8] [touch] [port=5198] [out=file.json]
//
// Needs the dev server (npx vite --port 5198). Drawing is switched off, so frames run at 60 a second even
// without a graphics card, and the car is moved along a line of map points (no physics), `step` metres a
// frame. A CPU profile runs meanwhile. Printed: the gaps between frames, and every stretch of over 25 ms in
// which the page was busy, by what ran in it. What the graphics card does (pictures sent, shaders compiled)
// is not seen here: tools/gpu-burst.cjs counts that.
//   routes: tools/freeze-routes.cjs, and `lap` (the race track). touch: as a phone (light mode, small pictures).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROUTES = require('./freeze-routes.cjs');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };

const FLY = require('./freeze-fly.cjs');

(async () => {
  const step = +arg('step', 0.8), touch = process.argv.includes('touch'), port = arg('port', 5198), name = arg('route', 'centre');
  const out = arg('out', path.join(os.tmpdir(), `freeze-${name}${touch ? '-phone' : ''}.json`));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext(touch ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } : { viewport: { width: 640, height: 360 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  await p.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); });
  await p.addInitScript(FLY);
  await p.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__fr = [];
    window.requestAnimationFrame = (f) => raf((ts) => { const t0 = performance.now(); f(ts); const d = performance.now() - t0; if (window.__rec && f.name === 'frame') __fr.push([t0, d, __game.car?.x | 0, __game.car?.z | 0]); });
  });
  await p.goto(`http://localhost:${port}/`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
  await p.waitForTimeout(2000);
  const ROUTE = name === 'lap' ? await p.evaluate(() => __game.race().track.P.filter((_, i) => i % 4 === 0).map((q) => [q[0], q[1]])) : ROUTES[name];
  if (!ROUTE) { console.error(`no route "${name}": ${Object.keys(ROUTES).join(', ')}, lap`); process.exit(1); }
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  // start: drive, jump to the first point, let it settle, then record
  await p.evaluate(async (r) => { __game.renderer.render = () => {}; __game.startDriving(); await __game.world.loadAround(r[0][0], r[0][1], 260); __game.place({ x: r[0][0], z: r[0][1], yaw: 0 }); }, ROUTE);
  await p.waitForTimeout(touch ? 14000 : 6000);
  await cdp.send('Profiler.start');
  const tStart = await p.evaluate(() => performance.now());
  await p.evaluate(({ r, step }) => { window.__rec = true; __fly(r, step); }, { r: ROUTE, step });
  await p.waitForFunction(() => __flyStat.done, null, { timeout: 1800000, polling: 1000 });
  await p.waitForTimeout(3000);
  const { profile } = await cdp.send('Profiler.stop');
  const { fr, stat, slow } = await p.evaluate(() => ({ fr: __fr, stat: __flyStat, slow: __game.jobs?.slow || [] }));
  await b.close();
  fs.writeFileSync(out, JSON.stringify({ profile, fr, tStart, stat }));
  console.log(`${touch ? 'phone' : 'desktop'}, route ${name}: ${(stat.dist / 1000).toFixed(2)} km, errors ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
  console.log('queued steps over 20 ms [label, step, ms]: ' + JSON.stringify(slow));
  report({ profile, fr, tStart });
  console.log(`\n(profile kept in ${out})`);
})();

function report({ profile, fr, tStart }, topN = 30) {
  const d = fr.map((f) => f[1]).sort((a, c) => a - c), q = (x) => d[Math.floor(d.length * x)].toFixed(1);
  const iv = []; for (let i = 1; i < fr.length; i++) iv.push(fr[i][0] - fr[i - 1][0]);
  console.log(`frames ${fr.length}: game code median ${q(0.5)} ms, p95 ${q(0.95)}, p99 ${q(0.99)}, max ${d[d.length - 1].toFixed(0)}; over 16.7 ms: ${d.filter((x) => x > 16.7).length}, over 33: ${d.filter((x) => x > 33).length}, over 50: ${d.filter((x) => x > 50).length}, over 100: ${d.filter((x) => x > 100).length}`);
  console.log(`gaps between frames over 50 ms: ${iv.filter((x) => x > 50).length}, over 100 ms: ${iv.filter((x) => x > 100).length}, over 200: ${iv.filter((x) => x > 200).length}, longest ${Math.max(...iv).toFixed(0)} ms; frozen time over 50 ms gaps: ${(iv.filter((x) => x > 50).reduce((a, c) => a + c, 0) / 1000).toFixed(1)} s of ${((fr[fr.length - 1][0] - fr[0][0]) / 1000).toFixed(0)} s`);
  const nodes = new Map(); for (const n of profile.nodes) nodes.set(n.id, n);
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const label = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/https?:\/\/[^/]+\//, '').replace(/\?.*/, '').replace(/node_modules\/\.vite\/deps\//, '')}:${n.callFrame.lineNumber + 1}`;
  const stackOf = new Map();
  const stack = (id) => { let s = stackOf.get(id); if (!s) { s = []; for (let k = id; k !== undefined; k = parent.get(k)) s.unshift(label(nodes.get(k))); stackOf.set(id, s); } return s; };
  const isIdle = (id) => { const f = nodes.get(id).callFrame.functionName; return f === '(idle)' || f === '(program)'; };
  let t = profile.startTime; const runs = []; let cur = null;
  for (let i = 0; i < profile.samples.length; i++) {
    t += profile.timeDeltas[i];
    const id = profile.samples[i], dt = profile.timeDeltas[i + 1] ?? 500;
    if (isIdle(id)) { if (cur) { runs.push(cur); cur = null; } continue; }
    if (!cur) cur = { t0: t, dur: 0, by: new Map() };
    cur.dur += dt;
    const st = stack(id);
    const fn = nodes.get(id).callFrame.functionName;
    const own = st.filter((x) => x.includes(' src/') && !x.startsWith('frame src/main.js') && !x.startsWith('scope src/warm.js') && !x.startsWith('tick src/jobs.js') && !x.startsWith('(anon) src/main.js'));
    const key = fn === '(garbage collector)' ? '(garbage collector)' : (own.slice(0, 2).join(' > ') || st.slice(1, 3).join(' > '));
    cur.by.set(key, (cur.by.get(key) || 0) + dt);
  }
  if (cur) runs.push(cur);
  const long = runs.filter((r) => r.dur > 25000).sort((a, c) => c.dur - a.dur);
  console.log(`\nbusy stretches of the main thread over 25 ms: ${long.length} (over 50: ${long.filter((r) => r.dur > 50000).length}, over 100: ${long.filter((r) => r.dur > 100000).length}, over 200: ${long.filter((r) => r.dur > 200000).length}); total ${(long.reduce((a, r) => a + r.dur, 0) / 1e6).toFixed(1)} s`);
  const tot = new Map(), cnt = new Map(), mx = new Map();
  for (const r of long) for (const [k, v] of r.by) { if (v < 8000) continue; tot.set(k, (tot.get(k) || 0) + v); cnt.set(k, (cnt.get(k) || 0) + 1); mx.set(k, Math.max(mx.get(k) || 0, v)); }
  console.log('what ran in them (times, total ms, longest):');
  for (const [k, v] of [...tot].sort((a, c) => c[1] - a[1]).slice(0, topN)) console.log(`${String(cnt.get(k)).padStart(4)} ${(v / 1000).toFixed(0).padStart(6)} ms  max ${(mx.get(k) / 1000).toFixed(0).padStart(4)}  ${k}`);
  console.log('\nthe 20 longest:');
  for (const r of long.slice(0, 20)) {
    const at = tStart + (r.t0 - profile.startTime) / 1000; let f = fr[0]; for (const x of fr) { if (x[0] > at) break; f = x; }
    console.log(`${(r.dur / 1000).toFixed(0).padStart(5)} ms at ${((r.t0 - profile.startTime) / 1e6).toFixed(1).padStart(6)} s (${f[2]}, ${f[3]})  ${[...r.by].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k, v]) => `${(v / 1000).toFixed(0)} ${k}`).join(' | ')}`);
  }
}
