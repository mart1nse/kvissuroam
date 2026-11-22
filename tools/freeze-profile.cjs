// Where does the game stand still during a drive?   node tools/freeze-profile.cjs [route=centre] [step=0.8] [touch] [slow=5] [port=5198] [out=file.json]
//
// Needs the dev server (npx vite --port 5198). Drawing is switched off, so frames run at 60 a second even
// without a graphics card, and the car is moved along a line of map points (no physics), `step` metres a
// frame. A CPU profile runs meanwhile. Printed: the gaps between frames, and every stretch of over 25 ms in
// which the page was busy, by what ran in it, the short hitches (over 16, 25 and 33 ms), and what was sent
// to the graphics card on the way: megapixels of pictures frame by frame and new shader programs (how long
// a real card takes over them is not seen: the counts are), with the house fronts each place painted.
//   routes: tools/freeze-routes.cjs, and `lap` (the race track). touch: as a phone (light mode, small pictures).
//   slow=5: as an old computer: the processor five times slower, 15 frames a second, light mode and extra low.
//           Then the thing to read is how long queued building work had to wait (the city standing empty).
// tools/perf-budget.cjs drives the centre route and the lap with this as part of the budget check (drive, summarise, report).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROUTES = require('./freeze-routes.cjs');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };

const FLY = require('./freeze-fly.cjs');

// One test drive. Returns { errs, slow, profile, fr, tStart, stat }: page errors, the queue's slow steps, the
// CPU profile, each frame as [time, game code ms, x, z], and how far it got.
async function drive({ port = 5198, route: name = 'centre', step = 0.8, touch = false, slow: slowBy = 0 } = {}) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await b.newContext(touch ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } : { viewport: { width: 640, height: 360 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
    await p.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); });
    await p.addInitScript(FLY);
    await p.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__fr = [];
      // (__every: only every so many screen refreshes get a frame, for a slow machine's frame rate)
      window.__every = 1; let tick = 0;
      window.requestAnimationFrame = (f) => {
        const run = (ts) => {
          if (f.name === 'frame' && window.__every > 1 && ++tick % window.__every) return raf(run);
          const t0 = performance.now(); f(ts); const d = performance.now() - t0;
          if (window.__rec && f.name === 'frame') { const g = __game; __fr.push([t0, d, g.car?.x | 0, g.car?.z | 0, g.jobs?.pending | 0, g.warmer?.waiting | 0, Math.round(Math.max(g.jobs?.waited || 0, g.warmer?.waited || 0)), Math.round(sent.px / 1e4) / 100, sent.link, Math.round(sent.ms * 10) / 10]); }
          sent.px = sent.link = sent.ms = 0;
        };
        return raf(run);
      };
      // what goes to the graphics card in each frame: megapixels of pictures and new shader programs. Drawing is
      // off, but the game still sends its pictures and has its shaders compiled ahead of showing a thing
      // (src/warm.js, jobs.upload), so these counts are the real ones, whatever the card. The time is the
      // software card's and means little; the counts are what a real card has to take in that frame.
      const sent = (window.__sent = { px: 0, link: 0, ms: 0 });
      const GL = WebGL2RenderingContext.prototype;
      const wrap = (name, fn) => { const o = GL[name]; GL[name] = function (...a) { const t0 = performance.now(); const r = o.apply(this, a); sent.ms += performance.now() - t0; fn(a); return r; }; };
      const area = (a, k) => { const s = a[a.length - 1]; return typeof a[k] === 'number' && typeof a[k + 1] === 'number' && a.length >= 9 ? a[k] * a[k + 1] : s && s.width ? (s.videoWidth || s.width) * (s.videoHeight || s.height) : 0; };
      // (pictures of a fifth of a megapixel and up are listed too: [frame, megapixels, what it was sent from])
      window.__pics = [];
      const note = (a, k) => { if (a[1] !== 0) return; const n = area(a, k); sent.px += n; if (n >= 2e5 && window.__rec) { const s = a[a.length - 1]; __pics.push([__fr.length, Math.round(n / 1e4) / 100, s && s.constructor ? s.constructor.name : 'data']); } };
      wrap('texImage2D', (a) => note(a, 3));
      wrap('texSubImage2D', (a) => note(a, 4));
      wrap('linkProgram', () => { sent.link++; });
    });
    await p.goto(`http://localhost:${port}/${slowBy ? '?lite&xlow' : ''}`, { timeout: 180000 });
    await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
    await p.waitForTimeout(2000);
    const ROUTE = name === 'lap' ? await p.evaluate(() => __game.race().track.P.filter((_, i) => i % 4 === 0).map((q) => [q[0], q[1]])) : ROUTES[name];
    if (!ROUTE) throw new Error(`no route "${name}": ${Object.keys(ROUTES).join(', ')}, lap`);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    if (slowBy) { await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowBy }); await p.evaluate(() => { window.__every = 4; }); }
    // start: drive, jump to the first point, let it settle, then record
    await p.evaluate(async (r) => { __game.renderer.render = () => {}; __game.startDriving(); await __game.world.loadAround(r[0][0], r[0][1], 260); __game.place({ x: r[0][0], z: r[0][1], yaw: 0 }); }, ROUTE);
    await p.waitForTimeout(touch ? 14000 : 6000);
    await cdp.send('Profiler.start');
    const tStart = await p.evaluate(() => performance.now());
    await p.evaluate(({ r, step }) => { window.__rec = true; __fly(r, step); }, { r: ROUTE, step });
    await p.waitForFunction(() => __flyStat.done, null, { timeout: 1800000, polling: 1000 });
    await p.waitForTimeout(3000);
    const { profile } = await cdp.send('Profiler.stop');
    const { fr, stat, slow, doubles, skins, pics } = await p.evaluate(() => ({ fr: __fr, pics: window.__pics || [], stat: __flyStat, slow: __game.jobs?.slow || [], doubles: __game.jobs?.doubles || 0, skins: __game.skins?.() || [] }));
    return { errs, slow, doubles, profile, fr, tStart, stat, skins, pics };
  } finally { await b.close(); }
}

// The stretches in which the page itself was busy without a break (game code and its calls into the
// browser), from the CPU profile: [{ t0, dur (both in microseconds), by: Map(what ran -> microseconds) }].
// The list's `ok` is false when the profile cannot be used for this: now and then (one drive in ten) the
// browser's profiler takes no samples while the page is idle, and the whole drive then looks like one
// busy stretch.
function stretches(profile) {
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
  runs.ok = runs.reduce((a, r) => a + r.dur, 0) < 0.5 * (t - profile.startTime);
  return runs;
}

// The figures of a drive. Two kinds of standing still are counted apart:
//   busy...  stretches in which the page itself was busy without a break (from the CPU profile). This is
//            what a change to the game moves, and what the budget judges.
//   pauses.. gaps between two frames, whatever the reason. In a browser without a graphics card these also
//            hold stalls of the software drawing process while the page sat idle (about one drive in four
//            has one of 0.2 to 0.5 s), so they are reported and not judged.
function summarise({ fr, stat, profile, runs, skins }) {
  const d = fr.map((f) => f[1]).sort((a, c) => a - c), q = (x) => +d[Math.floor(d.length * x)].toFixed(1);
  const iv = []; for (let i = 1; i < fr.length; i++) iv.push(fr[i][0] - fr[i - 1][0]);
  const over = (n) => iv.filter((x) => x > n).length;
  // without a usable profile, the busy figures are the game code's time in each frame: that leaves out
  // what runs between frames (a loaded map square's first handling), so `busyFrom` says which it was
  const R = runs || (profile ? stretches(profile) : null), usable = !!(R && R.ok);
  const b = usable ? R.map((r) => r.dur / 1000) : fr.map((f) => f[1]), bover = (n) => b.filter((x) => x > n).length;
  return {
    km: +(stat.dist / 1000).toFixed(2), seconds: Math.round((fr[fr.length - 1][0] - fr[0][0]) / 1000), frames: fr.length,
    jsMedian: q(0.5), jsP95: q(0.95), jsP99: q(0.99), jsMax: Math.round(d[d.length - 1]),
    js17: d.filter((x) => x > 16.7).length, js33: d.filter((x) => x > 33).length, js50: d.filter((x) => x > 50).length, js100: d.filter((x) => x > 100).length,
    busy16: bover(16), busy25: bover(25), busy33: bover(33),
    busy50: bover(50), busy100: bover(100), busy200: bover(200), busyLongest: Math.round(Math.max(0, ...b)),
    busyS: +(b.filter((x) => x > 50).reduce((a, c) => a + c, 0) / 1000).toFixed(2), busyFrom: usable ? 'profile' : 'frames',
    pauses50: over(50), pauses100: over(100), pauses200: over(200), longest: Math.round(Math.max(...iv)),
    frozen: +(iv.filter((x) => x > 50).reduce((a, c) => a + c, 0) / 1000).toFixed(1),
    // queued building work and things held back from the picture: how much on average, and the longest wait (s)
    queueMean: +(fr.reduce((a, f) => a + (f[4] || 0), 0) / fr.length).toFixed(1), queueMax: Math.max(...fr.map((f) => f[4] || 0)),
    heldMean: +(fr.reduce((a, f) => a + (f[5] || 0), 0) / fr.length).toFixed(1), heldMax: Math.max(...fr.map((f) => f[5] || 0)),
    waitedMax: +(Math.max(...fr.map((f) => f[6] || 0)) / 1000).toFixed(1),
    waitedOver4S: +(fr.reduce((a, f, i) => a + (i && (f[6] || 0) > 4000 ? f[0] - fr[i - 1][0] : 0), 0) / 1000).toFixed(1),
    // what went to the graphics card: megapixels of pictures in all, the frames that sent over 1.1 megapixels
    // (one 1024 px picture is 1.05) and over 2.2, the most in one frame, and the frames that linked shaders
    sentMP: Math.round(fr.reduce((a, f) => a + (f[7] || 0), 0)), sent11: fr.filter((f) => f[7] > 1.1).length, sent22: fr.filter((f) => f[7] > 2.2).length,
    sentMax: +Math.max(0, ...fr.map((f) => f[7] || 0)).toFixed(2), linkFrames: fr.filter((f) => f[8] > 0).length,
    // house fronts painted on the way (megapixels): the same on every drive of a build, unlike the timings
    frontsMP: skins ? +(skins.reduce((a, k) => a + k.px, 0) / 1e6).toFixed(1) : null,
  };
}

if (require.main === module) (async () => {
  const step = +arg('step', 0.8), touch = process.argv.includes('touch'), port = arg('port', 5198), name = arg('route', 'centre'), slow = +arg('slow', 0);
  const out = arg('out', path.join(os.tmpdir(), `freeze-${name}${touch ? '-phone' : ''}.json`));
  const r = await drive({ port, route: name, step, touch, slow });
  fs.writeFileSync(out, JSON.stringify({ profile: r.profile, fr: r.fr, tStart: r.tStart, stat: r.stat, skins: r.skins, slow: r.slow, pics: r.pics }));
  console.log(`${touch ? 'phone' : 'desktop'}, route ${name}: ${(r.stat.dist / 1000).toFixed(2)} km, errors ${r.errs.length} ${r.errs.slice(0, 3).join(' | ')}`);
  console.log('queued steps over 20 ms [label, step, ms]: ' + JSON.stringify(r.slow));
  if (r.doubles) console.log(`building work queued again while it was still waiting: ${r.doubles} times (set the place's built flag before jobs.add)`);
  console.log(report(r).join('\n'));
  console.log(`\n(profile kept in ${out})`);
})().catch((e) => { console.error(e); process.exit(1); });

module.exports = { drive, summarise, report, stretches };

// The report of a drive as lines of text: three lines of figures, then every stretch of over 25 ms in which the page
// was busy, by what ran in it.
function report({ profile, fr, tStart, stat, pics, skins }, topN = 30) {
  const L = [], runs = stretches(profile), S = summarise({ fr, stat: stat || { dist: 0 }, runs, skins });
  L.push(`frames ${S.frames}: game code median ${S.jsMedian} ms, p95 ${S.jsP95}, p99 ${S.jsP99}, max ${S.jsMax}; over 16.7 ms: ${S.js17}, over 33: ${S.js33}, over 50: ${S.js50}, over 100: ${S.js100}`);
  L.push(`the page busy without a break for over 50 ms: ${S.busy50}, over 100 ms: ${S.busy100}, over 200: ${S.busy200}, longest ${S.busyLongest} ms; ${S.busyS} s in stretches over 50 ms`);
  L.push(`gaps between frames over 50 ms: ${S.pauses50}, over 100 ms: ${S.pauses100}, over 200: ${S.pauses200}, longest ${S.longest} ms; frozen time over 50 ms gaps: ${S.frozen} s of ${S.seconds} s`);
  if (S.queueMax || S.heldMax) L.push(`queued building work: ${S.queueMean} pieces on average, ${S.queueMax} at most; held back from the picture: ${S.heldMean} on average, ${S.heldMax} at most; longest wait ${S.waitedMax} s, ${S.waitedOver4S} s of the drive with something waiting over 4 s`);
  // (kept after the first three lines: tools/perf-budget.cjs prints the report from its fourth line on)
  L.push(`short hitches: the page busy without a break for over 16 ms: ${S.busy16}, over 25 ms: ${S.busy25}, over 33 ms: ${S.busy33}`);
  L.push(`sent to the graphics card: ${S.sentMP} megapixels of pictures; frames with over 1.1 megapixels: ${S.sent11}, over 2.2: ${S.sent22}, most in one frame ${S.sentMax}; frames that linked new shaders: ${S.linkFrames}`);
  const heavy = fr.map((f, i) => [i, f[7] || 0, f[2], f[3]]).filter((f) => f[1] > 1.1).sort((a, c) => c[1] - a[1]).slice(0, 6);
  for (const [i, mp, x, z] of heavy) L.push(`   ${mp} megapixels in one frame at (${x}, ${z}): ${(pics || []).filter((q) => q[0] === i).map((q) => `${q[1]} ${q[2]}`).join(', ')}`);
  if (skins && skins.length) {
    // house fronts painted on the way (src/world/houseskin.js keeps the list): the places that painted most
    const by = new Map();
    for (const k of skins) { const o = by.get(k.label) || { px: 0, ms: 0, walls: 0, longest: 0 }; o.px += k.px; o.ms += k.ms; o.walls += k.walls; o.longest = Math.max(o.longest, k.longest); by.set(k.label, o); }
    const all = [...by.values()].reduce((a, o) => ({ px: a.px + o.px, ms: a.ms + o.ms, walls: a.walls + o.walls }), { px: 0, ms: 0, walls: 0 });
    L.push(`house fronts painted: ${all.walls} walls, ${(all.px / 1e6).toFixed(1)} megapixels, ${Math.round(all.ms)} ms; most: ${[...by].sort((a, c) => c[1].px - a[1].px).slice(0, 6).map(([k, o]) => `${k || 'unnamed'} ${(o.px / 1e6).toFixed(1)} MP (longest wall ${Math.round(o.longest)} ms)`).join(', ')}`);
  }
  if (!runs.ok) { L[1] += ' (from the frames\' game code only)'; L.push('\nthe profile of this drive has no idle samples, so what ran in the busy stretches cannot be told: drive again'); return L; }
  const long = runs.filter((r) => r.dur > 25000).sort((a, c) => c.dur - a.dur);
  L.push(`\nbusy stretches of the main thread over 25 ms: ${long.length} (over 50: ${long.filter((r) => r.dur > 50000).length}, over 100: ${long.filter((r) => r.dur > 100000).length}, over 200: ${long.filter((r) => r.dur > 200000).length}); total ${(long.reduce((a, r) => a + r.dur, 0) / 1e6).toFixed(1)} s`);
  const tot = new Map(), cnt = new Map(), mx = new Map();
  for (const r of long) for (const [k, v] of r.by) { if (v < 8000) continue; tot.set(k, (tot.get(k) || 0) + v); cnt.set(k, (cnt.get(k) || 0) + 1); mx.set(k, Math.max(mx.get(k) || 0, v)); }
  L.push('what ran in them (times, total ms, longest):');
  for (const [k, v] of [...tot].sort((a, c) => c[1] - a[1]).slice(0, topN)) L.push(`${String(cnt.get(k)).padStart(4)} ${(v / 1000).toFixed(0).padStart(6)} ms  max ${(mx.get(k) / 1000).toFixed(0).padStart(4)}  ${k}`);
  L.push('\nthe 20 longest:');
  for (const r of long.slice(0, 20)) {
    const at = tStart + (r.t0 - profile.startTime) / 1000; let f = fr[0]; for (const x of fr) { if (x[0] > at) break; f = x; }
    L.push(`${(r.dur / 1000).toFixed(0).padStart(5)} ms at ${((r.t0 - profile.startTime) / 1e6).toFixed(1).padStart(6)} s (${f[2]}, ${f[3]})  ${[...r.by].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k, v]) => `${(v / 1000).toFixed(0)} ${k}`).join(' | ')}`);
  }
  return L;
}
