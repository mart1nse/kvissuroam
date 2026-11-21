// Memory and freeze-frame budget check: node tools/perf-budget.cjs [--force] [--json out.json] [--port 5197]
//
// It takes about six minutes, so it does not run after every merge: when any thread (or the nightly
// run) ran it less than 2 hours ago, it prints that result and stops (Martin, 20 Nov 2026). --force
// runs it anyway: when Martin asks, or for a change that is likely to weigh (new painted streets, car
// models, many objects, anything built while driving). The last run is kept in the project's shared
// folder (perf/last-run.json); a skipped run with --json writes that last run's figures there.
//
// Starts the game (vite) and measures it in headless Chromium. Each part is there because of something
// that went wrong for a player; when a new kind of trouble turns up, add a part that would have caught it.
//   phone memory (iPhone 13 emulation: light mode, small pictures): at the menu, the peak in the first 5 s
//            after DRIVE (garbage not yet collected included), 15 s after DRIVE, after three car changes and
//            back to the first car, and the peak during a map jump to Kvissentali: live canvases, textures and buffers on the
//            graphics card, JS heap.
//            Why: an iPhone 13 reloads the page when it runs out of memory (Martin's son's phone, 20 Nov
//            2026, after one morning of new hand-painted streets; again 1-2 s after DRIVE while parked car
//            models were being built).
//            Then 2 km through the centre in hops, and what the phone holds at the end: a phone that
//            starts fine and reloads some minutes into a drive (21 Nov 2026). That day's cause was the
//            saved graphics cap of the crash guard, dropped by an update: tools/quality-test.mjs is run
//            here too, and a failing test in it is over budget.
//   test drive (tools/freeze-profile.cjs, once as a desktop and once as a phone): 4.5 km through the
//            centre at 48 m/s. Judged: the stretches in which the page itself was busy without a break
//            (how many over 0.1 s, the longest, the time in those over 50 ms), the gaps between frames
//            over 0.1 s, the game code's time per frame, page errors. The longest gap between frames is
//            shown and not judged: without a graphics card the software drawing process now and then
//            stalls for 0.2 to 0.5 s while the page sits idle (about one drive in four).
//            Why: freeze frames while driving (Martin's Xiaomi, 20 Nov 2026: smooth at 60 to 120 FPS and
//            then standing still for 0.1 to 1 s): places, painted house fronts and map squares built in one
//            go as the car came near. Before the fix (PR #372) the game was busy for over 0.1 s 12 times
//            on this drive, the longest 379 ms; after it, not once (longest about 70 ms).
//   an old computer (light mode, the extra low setup, GRAPHICS LOW): the pieces drawn and the triangles in
//            one frame at the Riia and Turu junction.
//            Why: a ThinkPad T440s and a 2019 MacBook Air (two processor cores, Intel graphics) ran at 10
//            to 18 FPS on the lowest level (Martin, 21 Nov 2026). The lowest level then drew 461 pieces
//            and 957 thousand triangles at this junction; with the extra low level 383 and 577 thousand
//            (this check's own view of it reads 386 and 634). New things
//            must not make the lowest level heavier again (far-away things, things without a simple far
//            form, shadows that ignore the level).
// Each figure is compared with tools/perf-budget.json; the script exits 1 when one is over, and then lists
// the biggest canvas makers (memory) or what the page was busy with in those stretches (drive), so the cause
// is easy to find. The figures are also written as a list (`checks` in the JSON) for the nightly's table.
//
// What it cannot see: headless draws without a graphics card (SwiftShader), so real frame rates, the
// graphics card's own time and what a real card does when new things arrive (pictures sent, shaders
// compiled: tools/gpu-burst.cjs counts those) are not measured, the phone is Chromium dressed as an
// iPhone and not Safari's engine, and other players joining are not played through.
// The check runs every night after a day with changes (a scheduled task); its history is kept on the
// perf-reports branch.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { drive, summarise, report } = require('./freeze-profile.cjs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = +opt('--port', 5197);
const ROOT = path.resolve(__dirname, '..');
const FORCE = args.includes('--force');
const SHARED = '/mnt/project-files';
const STAMP = fs.existsSync(SHARED) ? path.join(SHARED, 'perf', 'last-run.json') : path.join(ROOT, '.perf-last-run.json');
const EVERY_MS = 2 * 3600e3;
if (!FORCE) {
  try {
    const last = JSON.parse(fs.readFileSync(STAMP, 'utf8'));
    const ago = Date.now() - Date.parse(last.when);
    if (ago >= 0 && ago < EVERY_MS) {
      if (opt('--json') && last.full) fs.writeFileSync(opt('--json'), JSON.stringify(last.full, null, 1));
      console.log(`perf check skipped: last run ${Math.round(ago / 60000)} min ago at commit ${last.commit}, ${last.over?.length ? 'OVER: ' + last.over.join(', ') : 'all within budget'}${last.total ? ` (phone total at DRIVE ${last.total} MB)` : ''}. Runs again after 2 h; --force runs it now.`);
      process.exit(last.over?.length ? 1 : 0);
    }
  } catch { /* never run, or unreadable: run */ }
}
const budget = JSON.parse(fs.readFileSync(path.join(__dirname, 'perf-budget.json'), 'utf8'));

// counts what the page holds: canvases (CPU pictures), texture and buffer bytes on the graphics card
const tracker = () => {
  const sizes = new WeakMap(); let tex = 0, buf = 0, peak = 0;
  const note = () => { peak = Math.max(peak, tex + buf); };
  const P = WebGL2RenderingContext.prototype;
  const tI = P.texImage2D, tS = P.texStorage2D, bD = P.bufferData, dT = P.deleteTexture, dB = P.deleteBuffer;
  P.texImage2D = function (...a) {
    const t = this.getParameter(this.TEXTURE_BINDING_2D);
    let w, h;
    if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s?.width || s?.videoWidth || 0; h = s?.height || s?.videoHeight || 0; }
    if (t && a[1] === 0) { tex -= sizes.get(t) || 0; const n = w * h * 4 * 1.33; sizes.set(t, n); tex += n; note(); }
    return tI.apply(this, a);
  };
  P.texStorage2D = function (target, levels, fmt, w, h) {
    const t = this.getParameter(this.TEXTURE_BINDING_2D);
    if (t) { tex -= sizes.get(t) || 0; const n = w * h * 4 * (levels > 1 ? 1.33 : 1); sizes.set(t, n); tex += n; note(); }
    return tS.apply(this, arguments);
  };
  P.bufferData = function (target, data) {
    const b = this.getParameter(target === this.ELEMENT_ARRAY_BUFFER ? this.ELEMENT_ARRAY_BUFFER_BINDING : this.ARRAY_BUFFER_BINDING);
    const n = typeof data === 'number' ? data : data?.byteLength || 0;
    if (b) { buf -= sizes.get(b) || 0; sizes.set(b, n); buf += n; note(); }
    return bD.apply(this, arguments);
  };
  P.deleteTexture = function (t) { if (t) { tex -= sizes.get(t) || 0; sizes.delete(t); } return dT.apply(this, arguments); };
  P.deleteBuffer = function (b) { if (b) { buf -= sizes.get(b) || 0; sizes.delete(b); } return dB.apply(this, arguments); };
  const cvs = []; const cE = Document.prototype.createElement;
  Document.prototype.createElement = function (n, ...r) {
    const e = cE.call(this, n, ...r);
    if (String(n).toLowerCase() === 'canvas') {
      const st = (new Error().stack || '').split('\n').slice(2, 4).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '').replace(/:\d+\)?$/, '')).join(' < ');
      cvs.push([new WeakRef(e), st]);
    }
    return e;
  };
  const MB = (n) => Math.round(n / 1e6);
  window.__perf = () => {
    let c = 0; for (const [r] of cvs) { const e = r.deref(); if (e) c += e.width * e.height * 4; }
    return { canvas: MB(c), gl: MB(tex + buf), tex: MB(tex), buf: MB(buf), heap: MB(performance.memory.usedJSHeapSize), glPeak: MB(peak) };
  };
  window.__perfPeak = () => { peak = tex + buf; };
  window.__perfCanvases = () => {
    const by = new Map();
    for (const [r, st] of cvs) { const e = r.deref(); if (e) by.set(st, (by.get(st) || 0) + e.width * e.height * 4); }
    return [...by].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${String(MB(v)).padStart(5)} MB  ${k}`);
  };
};

async function waitForServer(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no game server at ${url}`);
}

(async () => {
  const vite = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: ROOT, env: { ...process.env, NO_HMR: '1' }, stdio: 'ignore' });
  const url = `http://localhost:${PORT}/`;
  const out = { when: new Date().toISOString(), commit: '', phone: {}, drive: {}, driveReport: {}, checks: [], over: [] };
  try { out.commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}
  let browser;
  try {
    await waitForServer(url, 60000);
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });

    // ---- phone
    const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    await ctx.addInitScript(tracker);
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const take = async () => { await p.evaluate(() => window.gc && gc()); return p.evaluate(() => __perf()); };
    await p.goto(`${url}?gfx=auto`, { timeout: 180000 });
    await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
    await p.waitForTimeout(8000);
    out.phone.menu = await take();
    // the first 5 s after DRIVE, sampled every 50 ms without collecting garbage: the iPhone 13 reloaded
    // the page 1-2 s after DRIVE while the figures 15 s later were fine (parked car models being built)
    await p.evaluate(() => {
      __perfPeak(); window.__spike = 0;
      const t0 = performance.now();
      const id = setInterval(() => {
        const f = __perf(); __spike = Math.max(__spike, f.canvas + f.glPeak + f.heap);
        if (performance.now() - t0 > 5000) clearInterval(id);
      }, 50);
      __game.startDriving();
    });
    await p.waitForTimeout(5500);
    out.phone.driveSpike = await p.evaluate(() => __spike);
    await p.waitForTimeout(9500);
    out.phone.drive = await take();
    out.phone.canvases = await p.evaluate(() => __perfCanvases());
    // three other cars and back to the first: what is still held then was not given back. (Read right after
    // the third change, as it was until 21 Nov, the figure was 1 MB or 17 MB by chance: the Audi's scanned
    // body arrives a few seconds after the car. It is waited for here, and counted in the peak.)
    const firstCar = await p.evaluate(() => __game.car.spec.id);
    await p.evaluate(() => __perfPeak());
    for (const [id, ms] of [['f40', 2500], ['enyaq', 2500], ['audi200', 8000], [firstCar, 6000]]) { await p.evaluate((i) => __game.setCar(i, true), id); await p.waitForTimeout(ms); }
    out.phone.cars = await take();
    await p.evaluate(() => __perfPeak());
    await p.evaluate(() => __game.dropAt(70, 0));                 // Kvissentali, across the city
    await p.waitForTimeout(15000);
    out.phone.jump = await take();
    // through the centre, the part of the map with the most painted houses: 2 km of the test drive's route
    // in hops of about 120 m, 4 s at each for the places there to build themselves and for what was left
    // behind to be let go. What the page holds at the end is what a phone holds some minutes into a drive
    // ("can drive for a bit, then crash", Martin's son's iPhone 13, 21 Nov 2026: the figures at DRIVE were
    // fine that day, and nothing here looked further than the start).
    try {
      const R = require('./freeze-routes.cjs').centre, hops = [];
      for (let i = 1, far = 0; i < R.length && far < 2000; i++) {
        const [x0, z0] = R[i - 1], [x1, z1] = R[i], d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 120);
        for (let k = 1; k <= n; k++) hops.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, Math.atan2(x1 - x0, -(z1 - z0))]);
        far += d;
      }
      await p.evaluate(() => __perfPeak());
      for (const [x, z, yaw] of hops) {
        await p.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 260); __game.place({ x, z, yaw }); }, [x, z, yaw]);
        await p.waitForTimeout(4000);
      }
      out.phone.centre = await take();
      out.phone.centreCanvases = await p.evaluate(() => __perfCanvases());
    } catch (e) { out.phone.centre = null; console.warn('the phone pass through the centre failed:', e.message); }
    out.phone.errors = errors;
    await ctx.close();

    // ---- an old computer: what the lowest graphics level asks to be drawn
    // (light mode + the extra low setup + GRAPHICS LOW, standing at the Riia and Turu junction, the heaviest
    // view of the centre: pieces drawn and triangles in one frame. No frame rate can be measured without
    // a graphics card, but these two are what an old laptop's chip pays for.)
    try {
      const old = await browser.newContext({ viewport: { width: 1366, height: 700 } });
      await old.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); localStorage.setItem('kvissuroam.gfx', 'low'); });
      const q = await old.newPage();
      await q.goto(`${url}?lite&xlow`, { timeout: 180000 });
      await q.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
      await q.evaluate(() => __game.startDriving());
      await q.waitForTimeout(6000);
      await q.evaluate(async () => { await __game.world.loadAround(1930, 3160, 260); __game.place({ x: 1930, z: 3160, yaw: Math.atan2(-50, 50) }); });
      // until nothing more is being built or let into the picture
      let same = 0, last = '';
      for (let k = 0; k < 30 && same < 3; k++) {
        await q.waitForTimeout(2000);
        const st = await q.evaluate(() => [__game.jobs.pending, __game.renderer.info.render.calls, __game.renderer.info.memory.geometries].join('|'));
        same = st === last ? same + 1 : 0; last = st;
      }
      out.lowest = await q.evaluate(() => { const i = __game.renderer.info, l = __game.gfx.levels[__game.gfx.level]; return { calls: i.render.calls, ktris: Math.round(i.render.triangles / 1000), level: __game.gfx.level, dpr: l.dpr, far: __game.camera.far }; });
      await old.close();
    } catch (e) { out.lowest = null; console.warn('the lowest level pass failed:', e.message); }

    await browser.close(); browser = null;

    // ---- the test drive: does the game stand still on the way through the centre?
    // (tools/freeze-profile.cjs: the car is moved 4.5 km through the centre at 48 m/s with drawing switched
    // off, so frames run at 60 a second without a graphics card; once with a desktop's settings and once
    // with a phone's. What the graphics card itself does with new things is not seen here.)
    for (const [who, touch] of [['desktop', false], ['phone', true]]) {
      try {
        // (a drive whose profile came without idle samples cannot tell busy from waiting: once more, and
        // if that one is the same, the frames' game code time stands in, which the printout says)
        let r = await drive({ port: PORT, route: 'centre', touch });
        if (summarise(r).busyFrom !== 'profile') r = await drive({ port: PORT, route: 'centre', touch });
        out.drive[who] = { ...summarise(r), errors: r.errs.slice(0, 5), slow: r.slow, doubles: r.doubles || 0 };
        out.driveReport[who] = report(r, 12).slice(3);
      } catch (e) { out.drive[who] = null; out.driveReport[who] = [`the ${who} drive failed: ${e.message}`]; }
    }
  } finally {
    await browser?.close();
    vite.kill();
  }

  // ---- compare with the budget
  const checks = [
    ['phone canvases at DRIVE', out.phone.drive?.canvas, budget.phone.driveCanvasMB],
    ['phone graphics card at DRIVE', out.phone.drive?.gl, budget.phone.driveGlMB],
    ['phone JS heap at DRIVE', out.phone.drive?.heap, budget.phone.driveHeapMB],
    ['phone total at DRIVE', out.phone.drive && out.phone.drive.canvas + out.phone.drive.gl + out.phone.drive.heap, budget.phone.driveTotalMB],
    ['phone peak in the 5 s after DRIVE, garbage included', out.phone.driveSpike, budget.phone.driveSpikeMB],
    ['phone graphics card peak in a map jump', out.phone.jump?.glPeak, budget.phone.jumpGlPeakMB],
    ['phone graphics card growth after 3 car changes and back to the first car', out.phone.cars && out.phone.cars.gl - out.phone.drive.gl, budget.phone.carChangeGrowthMB],
    ['phone graphics card peak during the car changes', out.phone.cars?.glPeak, budget.phone.carChangeGlPeakMB],
  ];
  // (tools/quality-test.mjs: the level a device held and the crash guard's cap must still be there on the
  // next visit. The iPhone 13 of 21 Nov crashed again and again because an update had dropped the saved cap.)
  let lost = null;
  try {
    const t = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'quality-test.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
    if (/^ok /m.test(t.stdout || '')) { lost = (t.stdout.match(/^FAIL.*$/gm) || []); out.levelTests = lost; lost = lost.length + (t.status && !lost.length ? 1 : 0); }
  } catch { /* stays not measured */ }
  checks.push(
    ['phone total after 2 km through the centre', out.phone.centre && out.phone.centre.canvas + out.phone.centre.gl + out.phone.centre.heap, budget.phone.centreTotalMB],
    ['phone graphics card peak through the centre', out.phone.centre?.glPeak, budget.phone.centreGlPeakMB],
    ['graphics level tests failing (saved level, crash guard)', lost, 0],
  );
  checks.push(
    ['lowest graphics level at the Riia and Turu junction: pieces drawn in a frame', out.lowest?.calls, budget.lowest.calls],
    ['lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands)', out.lowest?.ktris, budget.lowest.kTriangles],
  );
  for (const who of ['desktop', 'phone']) {
    const D = out.drive[who], B = budget.drive[who];
    checks.push(
      [`${who} drive through the centre: times the game was busy for over 0.1 s`, D?.busy100, B.busyOver100ms],
      [`${who} drive: longest the game was busy without a break (ms)`, D?.busyLongest, B.busyLongestMs],
      [`${who} drive: time in busy stretches over 50 ms (s)`, D?.busyS, B.busyS],
      [`${who} drive: gaps between frames over 0.1 s`, D?.pauses100, B.gapsOver100ms],
      [`${who} drive: game code per frame, 95th percentile (ms)`, D?.jsP95, B.jsP95Ms],
      [`${who} drive: page errors`, D ? D.errors.length : null, 0],
      // (a place queued again while its build still waited: its `built` flag is set too late, and where the
      // queue is slow to reach it the place is built several times over. Katoliku, Delta and Pepleri, 21 Nov 2026)
      [`${who} drive: building work queued twice`, D ? D.doubles : null, 0],
      // shown, not judged (budget null): see the note on the software drawing process at the top
      [`${who} drive: longest gap between frames (ms), not judged`, D?.longest, null],
    );
  }
  console.log(`perf budget, commit ${out.commit}, ${out.when}`);
  for (const [name, v, max] of checks) {
    const bad = v == null || (max != null && v > max);
    if (bad) out.over.push(name);
    out.checks.push({ name, figure: v ?? null, budget: max, ok: !bad });
    console.log(`${bad ? 'OVER' : max == null ? 'info' : 'ok  '} ${name}: ${v ?? 'not measured'}${max == null ? '' : ` (budget ${max})`}`);
  }
  for (const who of ['desktop', 'phone']) {
    const D = out.drive[who];
    if (D) console.log(`${who} drive ${JSON.stringify({ km: D.km, seconds: D.seconds, frames: D.frames, jsMedian: D.jsMedian, jsP95: D.jsP95, jsP99: D.jsP99, busy50: D.busy50, busy100: D.busy100, busyLongest: D.busyLongest, busyS: D.busyS, busyFrom: D.busyFrom, gaps50: D.pauses50, gaps100: D.pauses100, longestGap: D.longest, gapsS: D.frozen })}`);
    if (D?.errors.length) console.log(`${who} drive errors: ${D.errors.join(' | ')}`);
    // what ran in the busy stretches, when a drive figure is over (or the drive failed)
    if (out.over.some((n) => n.startsWith(who + ' drive')) && out.driveReport[who]) console.log(`what the page was busy with on the ${who} drive:\n` + out.driveReport[who].join('\n'));
  }
  if (out.phone.errors?.length) console.log('page errors:', out.phone.errors.slice(0, 5).join(' | '));
  console.log('lowest level', JSON.stringify(out.lowest));
  console.log('phone', JSON.stringify({ menu: out.phone.menu, driveSpike: out.phone.driveSpike, drive: out.phone.drive, cars: out.phone.cars, jump: out.phone.jump }));
  if (out.over.some((n) => n.startsWith('phone ') && !n.startsWith('phone drive'))) console.log('biggest canvas makers at DRIVE:\n' + (out.phone.canvases || []).join('\n'));
  if (out.over.some((n) => n.includes('through the centre'))) console.log('biggest canvas makers after the centre:\n' + (out.phone.centreCanvases || []).join('\n'));
  if (out.levelTests?.length) console.log(out.levelTests.join('\n'));
  try {
    fs.mkdirSync(path.dirname(STAMP), { recursive: true });
    const d = out.phone.drive;
    fs.writeFileSync(STAMP, JSON.stringify({ when: out.when, commit: out.commit, over: out.over, total: d ? d.canvas + d.gl + d.heap : null, full: out }, null, 1));
  } catch (e) { console.warn('could not save the last-run note:', e.message); }
  const json = opt('--json');
  if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
  process.exit(out.over.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
