// Memory and freeze-frame budget check: node tools/perf-budget.cjs [--force] [--json out.json] [--port 5197]
//
// It takes about eleven minutes, so it does not run after every merge: when any thread (or the nightly
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
//            And a fresh page at the Raadi rally stage (?raadi=1): in along Narva mnt as the stage builds itself and
//            along the whole stage in hops, what the phone holds at the end and the card's peak (Martin, 24 Nov
//            2026: what the stage weighs on a phone before it leaves its flag).
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
//   a lap of the race track (the same test drive, as a desktop, along the track's own line): the short
//            hitches. Judged: the stretches in which the page was busy for over 25 and over 33 ms, the longest,
//            the frames whose game code took over 33 ms, the megapixels of house fronts painted on the way,
//            and what went to the graphics card: megapixels of pictures in all, the frames that sent over
//            1.1 megapixels, the most in one frame.
//            Why: on a MacBook Pro M3 the lap had been "totally smooth" and after a night of new house fronts
//            along the track came "ever so slight microfreezes", as coming down Vanemuise (Martin, 22 Nov
//            2026). Nothing in the centre drive's figures had moved: they count stops of 0.1 s. The lap sent
//            a quarter more picture to the card than the day before (123 to 154 megapixels, the fronts' pages
//            a megapixel each, a map square's three pictures in one frame) and painted half again as many
//            walls. A fast computer is about twice as fast as this check's, so 25 ms here is a late frame there.
//   a run of the Raadi rally stage (?raadi=1, as a desktop: tools/freeze-profile.cjs route=stage): in along Narva
//            mnt from 740 m out while the stage builds itself (its bales, barriers, tape, start kit, wheel tracks,
//            the park's stones), the start clock, and the whole 1.73 km from the line past the finish. Judged as
//            the lap: the busy stretches over 25 and 33 ms, the longest, the frames over 33 ms, what went to the
//            graphics card; and that the stage counted the run as finished (a run it cancels on the way is not
//            the whole stage measured: then the drive needs to follow the stage's new rules).
//            Why: the stage is driven flat out, one try after another, and a hitch there costs a time (Martin,
//            23 Nov 2026: "add raadi to the nightly check too").
//   an old computer (light mode, the extra low setup, GRAPHICS LOW): the pieces drawn and the triangles in
//            one frame at the Riia and Turu junction.
//            Why: a ThinkPad T440s and a 2019 MacBook Air (two processor cores, Intel graphics) ran at 10
//            to 18 FPS on the lowest level (Martin, 21 Nov 2026). The lowest level then drew 461 pieces
//            and 957 thousand triangles at this junction; with the extra low level 383 and 577 thousand
//            (this check's own view of it reads 386 and 634). New things
//            must not make the lowest level heavier again (far-away things, things without a simple far
//            form, shadows that ignore the level).
//            The same along the Raadi stage (three views, the heaviest counts), and there also at a desktop's top
//            level: the open park shows much of the map's ground at once (Martin, 24 Nov 2026).
//   many players online (tools/crowd-hitch.cjs, as a desktop, drawing off): 60 made-up players, a pack around our
//            standing car and the rest round the lap, positions in bundles ten times a second as the server sends
//            them, someone coming or going every 4 s, changing car, stepping into the garage, a race vote filling up,
//            the pack sliding now and then; 40 s with a CPU profile. Judged: how often the online code (the player
//            list, the other cars, their sounds and tyre marks) kept the page busy for over 5 ms in one go, and its most.
//            Why: with 55 to 78 online the picture hitched now and then on a fast desktop (Martin, 24 Nov 2026: 59
//            FPS, late frames 1 in 2 s, longest 67 ms). The player list was made anew, sixty rows, whenever anybody
//            came, went, changed car or voted, and read back at once: 5 to 15 ms each time, 56 times in 40 s.
//            Then 30 s of a race of 30 under way with us in it (Martin, 24 Nov: "almost 30 in the race"): each kind of
//            car's see-through ghost shaders were made ready in one go when it first came close, 13 to 30 ms.
//            The "online code" counts src/race/racemode.js (the live race list) too.
//   new kinds of car in a crowd (tools/crowd-hitch.cjs kinds=1 dry, as a desktop, 60 online): everybody starts in
//            one kind of car, and every 4 s a driver of the pack around us changes to a kind not met before; 40 s.
//            Everything is made ready and sent to the graphics card as in play, only the draw calls do nothing (so
//            the frames come 60 a second without a card). Judged: the frames that sent over 3 MB of model buffers.
//            Why: Martin, 25 Nov 2026, 85 to 95 online on a fast desktop: stutters now and then that the frame times
//            on his screen did not show. A kind of car's whole model (4 to 6 MB with a scanned body) went to the
//            card in the frame that first drew such a car, each kind once, whenever one first came near.
//   shaders the iPhone way (tools/crowd-hitch.cjs, as a phone, drawing on, 60 online): the menu's warm-up frames,
//            DRIVE, 25 s standing where the game puts the car, with a graphics driver made to behave like an iPhone's:
//            no KHR_parallel_shader_compile, and the first question about each new shader program waits 150 ms for it
//            to be built. Judged: how many programs were first used inside the drawing of a frame after DRIVE (each a
//            wait there), and the most in one frame. Why: on 24 Nov 2026 /stats showed 41 in 100 phone drivers with a
//            freeze of 1 s or more, 172 of 235 of them drawing new shaders, 80% iPhones, mostly at the busy start in
//            the first minutes (src/stats.js freeze()). Before the fix 9 programs, 4 in one frame (the start boards);
//            after it 2, never two in one frame (src/warm.js firstUse, the scene's shaders behind the menu).
// Each figure is compared with tools/perf-budget.json; the script exits 1 when one is over, and then lists
// the biggest canvas makers (memory) or what the page was busy with in those stretches (drive), so the cause
// is easy to find. The figures are also written as a list (`checks` in the JSON) for the nightly's table.
//
// Run it alone. The timing figures (the drives, the online parts) and the phone's memory through the centre
// (pictures left behind rest as time passes) read higher when the machine is busy with something else: on
// 25 Nov 2026 main read over on eight figures in a thread that had other work going beside the check (lap over
// 25 ms 13, 60 online 21 times over 5 ms, a race of 30 16 times) and inside on all of them an hour later, alone
// (2, 3, 0); the race of 30 alone read 0 and 3 times over 5 ms, two of them side by side 5 and 7, and with three
// busy processes beside it 23, most 29.7 ms. So the check watches what the rest of the machine is doing while it
// runs (otherCpu below) and says so, loudly, when other work took over half a processor core on average or over
// a whole core for a minute: such a run is not a reason to blame a commit. It changes no figure and no verdict.
//
// What it cannot see: headless draws without a graphics card (SwiftShader), so real frame rates and the
// graphics card's own time are not measured (what is sent to it on the lap is counted, not how long a
// real card takes over it), the phone is Chromium dressed as an
// iPhone and not Safari's engine, and the other players are a made-up crowd (no real server, no drawing).
// The check runs every night after a day with changes (a scheduled task); its history is kept on the
// perf-reports branch.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { drive, summarise, report } = require('./freeze-profile.cjs');
const { crowd, summarise: crowdSummary, report: crowdReport } = require('./crowd-hitch.cjs');

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
      console.log(`perf check skipped: last run ${Math.round(ago / 60000)} min ago at commit ${last.commit}, ${last.over?.length ? 'OVER: ' + last.over.join(', ') : 'all within budget'}${last.total ? ` (phone total at DRIVE ${last.total} MB)` : ''}${last.busy ? '; THE MACHINE WAS BUSY WITH OTHER WORK during that run, so its timing figures read high: run again alone with --force' : ''}. Runs again after 2 h; --force runs it now.`);
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

// What the rest of the machine is doing while the check runs (Linux: /proc), in processor cores: all the work
// done on the machine less this check's own (this process and everything it started: the game server, the
// browsers; a child that has ended is counted through its parent's record of it).
function otherCpu(everyMs = 5000) {
  const os = require('os');
  const read = () => {
    try {
      const cpu = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
      const all = cpu[0] + cpu[1] + cpu[2] + cpu[5] + cpu[6] + cpu[7];      // user, nice, system, irq, softirq, steal
      const procs = new Map();
      for (const d of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(d)) continue;
        try {
          const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'), f = st.slice(st.lastIndexOf(')') + 2).split(' ');
          procs.set(+d, { ppid: +f[1], t: +f[11] + +f[12] + +f[13] + +f[14] });   // utime, stime and its ended children's
        } catch { /* gone meanwhile */ }
      }
      let own = 0;
      for (const [pid, q] of procs) {
        let k = pid, mine = false;
        for (let n = 0; k > 1 && n < 64; n++) { if (k === process.pid) { mine = true; break; } k = procs.get(k)?.ppid ?? 0; }
        if (mine) own += q.t;
      }
      return { all, own, at: Date.now() };
    } catch { return null; }
  };
  const HZ = 100, samples = [];
  let last = read();
  const timer = last && setInterval(() => {
    const now = read();
    if (!now) return;
    const s = (now.at - last.at) / 1000;
    if (s > 0.5) samples.push({ s, cores: Math.max(0, (now.all - last.all) - (now.own - last.own)) / HZ / s });
    last = now;
  }, everyMs);
  timer?.unref?.();
  return {
    stop() {
      if (!timer) return null;
      clearInterval(timer);
      const secs = samples.reduce((a, x) => a + x.s, 0);
      if (!secs) return null;
      const avg = samples.reduce((a, x) => a + x.cores * x.s, 0) / secs;
      const busySecs = samples.filter((x) => x.cores > 1).reduce((a, x) => a + x.s, 0);
      return { cores: os.cpus().length, othersAvg: +avg.toFixed(2), othersMost: +Math.max(...samples.map((x) => x.cores)).toFixed(2), busySecs: Math.round(busySecs), busy: avg > 0.5 || busySecs >= 60 };
    },
  };
}

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
  const watch = otherCpu();
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

    // ---- the phone at the Raadi rally stage (?raadi=1): a fresh page, DRIVE, then in along Narva mnt as the
    // stage builds itself (bales, barriers, tape, signs, start kit, the light column, the park's stones) and in
    // hops of about 120 m along the whole stage, 4 s at each. What the phone holds at the end, and the peak on
    // the graphics card on the way. Why: before the stage leaves its flag for everyone, its weight on an
    // iPhone 13 was not known (Martin, 24 Nov 2026: "please do test the memory part"). Judged against the same
    // limits as the drive through the centre: what the phone can hold.
    try {
      const rc = await browser.newContext({ ...devices['iPhone 13 landscape'] });
      await rc.addInitScript(tracker);
      const r = await rc.newPage();
      r.on('pageerror', (e) => errors.push('raadi: ' + e.message));
      await r.goto(`${url}?gfx=auto&raadi=1`, { timeout: 180000 });
      await r.waitForFunction(() => window.__game?.car && __game.stage?.(), null, { timeout: 180000 });
      await r.waitForTimeout(8000);
      await r.evaluate(() => __game.startDriving());
      await r.waitForTimeout(15000);
      const R = require('./freeze-routes.cjs').stageIn, hops = [];
      for (let i = 1; i < R.length; i++) {
        const [x0, z0] = R[i - 1], [x1, z1] = R[i], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 120);
        for (let k = 1; k <= n; k++) hops.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, Math.atan2(x1 - x0, -(z1 - z0))]);
      }
      hops.push(...(await r.evaluate(() => {
        const P = __game.stage().data.pts, out = [];
        for (let i = 60; i < P.length; i += 60) { const j = Math.min(i + 3, P.length - 1); out.push([P[i][0], P[i][1], Math.atan2(P[j][0] - P[i][0], -(P[j][1] - P[i][1]))]); }
        return out;
      })));
      await r.evaluate(() => __perfPeak());
      for (const [x, z, yaw] of hops) {
        await r.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 260); __game.place({ x, z, yaw }); }, [x, z, yaw]);
        await r.waitForTimeout(4000);
      }
      out.phone.raadi = await r.evaluate(() => window.gc && gc()).then(() => r.evaluate(() => __perf()));
      out.phone.raadi.built = await r.evaluate(() => !!__game.stage().bales?.built);
      out.phone.raadiCanvases = await r.evaluate(() => __perfCanvases());
      await rc.close();
    } catch (e) { out.phone.raadi = null; console.warn('the phone pass at the Raadi stage failed:', e.message); }

    // ---- an old computer: what the lowest graphics level asks to be drawn
    // (light mode + the extra low setup + GRAPHICS LOW, standing at the Riia and Turu junction, the heaviest
    // view of the centre: pieces drawn and triangles in one frame. No frame rate can be measured without
    // a graphics card, but these two are what an old laptop's chip pays for.)
    // And the same along the Raadi rally stage (?raadi=1), at this level and at a desktop's top level: three
    // views along the stage, the heaviest counts (Martin, 24 Nov 2026: "Raadi additional nightly checks yes").
    // The park is open ground, so far more of the map's ground is in view than in the centre; new scenery
    // there must not quietly make the stage heavier to draw.
    const settle = async (q) => {
      // until nothing more is being built or let into the picture
      let same = 0, last = '';
      for (let k = 0; k < 30 && same < 3; k++) {
        await q.waitForTimeout(2000);
        const st = await q.evaluate(() => [__game.jobs.pending, __game.renderer.info.render.calls, __game.renderer.info.memory.geometries].join('|'));
        same = st === last ? same + 1 : 0; last = st;
      }
      return q.evaluate(() => { const i = __game.renderer.info, l = __game.gfx.levels[__game.gfx.level]; return { calls: i.render.calls, ktris: Math.round(i.render.triangles / 1000), level: __game.gfx.level, dpr: l.dpr, far: __game.camera.far }; });
    };
    const stageViews = async (q) => {
      // the start line, a third and two thirds along (facing the way the stage goes): the heaviest of the three
      const spots = await q.evaluate(() => {
        const s = __game.stage().data, P = s.pts, N = P.length;
        return [s.start, Math.floor(N * 0.35), Math.floor(N * 0.7)].map((i) => { const j = Math.min(i + 3, N - 1); return [P[i][0], P[i][1], Math.atan2(P[j][0] - P[i][0], -(P[j][1] - P[i][1]))]; });
      });
      let worst = null;
      for (const [x, z, yaw] of spots) {
        await q.evaluate(async ([x, z, yaw]) => { await __game.world.loadAround(x, z, 300); __game.place({ x, z, yaw }); }, [x, z, yaw]);
        const r = await settle(q);
        r.at = [Math.round(x), Math.round(z)];
        if (!worst || r.calls > worst.calls) worst = { ...r, ktris: Math.max(r.ktris, worst?.ktris || 0) };
        else worst.ktris = Math.max(worst.ktris, r.ktris);
      }
      return worst;
    };
    try {
      const old = await browser.newContext({ viewport: { width: 1366, height: 700 } });
      await old.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); localStorage.setItem('kvissuroam.gfx', 'low'); });
      const q = await old.newPage();
      await q.goto(`${url}?lite&xlow&raadi=1`, { timeout: 180000 });
      await q.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
      await q.evaluate(() => __game.startDriving());
      await q.waitForTimeout(6000);
      await q.evaluate(async () => { await __game.world.loadAround(1930, 3160, 260); __game.place({ x: 1930, z: 3160, yaw: Math.atan2(-50, 50) }); });
      out.lowest = await settle(q);
      try { out.lowestStage = await stageViews(q); } catch (e) { out.lowestStage = null; console.warn('the lowest level at Raadi failed:', e.message); }
      await old.close();
      // a desktop at its top level along the stage
      try {
        const top = await browser.newContext({ viewport: { width: 1366, height: 700 } });
        await top.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); localStorage.setItem('kvissuroam.gfx', 'high'); });
        const t = await top.newPage();
        await t.goto(`${url}?raadi=1`, { timeout: 180000 });
        await t.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
        await t.evaluate(() => __game.startDriving());
        await t.waitForTimeout(6000);
        out.topStage = await stageViews(t);
        await top.close();
      } catch (e) { out.topStage = null; console.warn('the top level at Raadi failed:', e.message); }
    } catch (e) { out.lowest = null; console.warn('the lowest level pass failed:', e.message); }

    await browser.close(); browser = null;

    // ---- the test drive: does the game stand still on the way through the centre?
    // (tools/freeze-profile.cjs: the car is moved 4.5 km through the centre at 48 m/s with drawing switched
    // off, so frames run at 60 a second without a graphics card; once with a desktop's settings and once
    // with a phone's. What the graphics card itself does with new things is not seen here.)
    for (const [who, touch, route] of [['desktop', false, 'centre'], ['phone', true, 'centre'], ['lap', false, 'lap'], ['stage', false, 'stage']]) {
      try {
        // (a drive whose profile came without idle samples cannot tell busy from waiting: once more, and
        // if that one is the same, the frames' game code time stands in, which the printout says)
        let r = await drive({ port: PORT, route, touch });
        if (summarise(r).busyFrom !== 'profile') r = await drive({ port: PORT, route, touch });
        out.drive[who] = { ...summarise(r), errors: r.errs.slice(0, 5), slow: r.slow, doubles: r.doubles || 0, ...(r.run ? { run: r.run } : {}) };
        out.driveReport[who] = report(r, 12).slice(3);
      } catch (e) { out.drive[who] = null; out.driveReport[who] = [`the ${who} drive failed: ${e.message}`]; }
    }
    // ---- many players online (tools/crowd-hitch.cjs): 60 made-up players around a standing car for 40 s
    try {
      const r = await crowd({ port: PORT, n: 60, secs: 40 });
      out.crowd = { ...crowdSummary(r), errors: r.errs.slice(0, 5) };
      out.crowdReport = crowdReport(r, 8);
    } catch (e) { out.crowd = null; out.crowdReport = `the many-players run failed: ${e.message}`; }
    // ---- and a race of 30 of them under way, us in it (ghost cars, the live race list)
    try {
      const r = await crowd({ port: PORT, n: 60, secs: 30, race: 30 });
      out.crowdRace = { ...crowdSummary(r), errors: r.errs.slice(0, 5) };
      out.crowdRaceReport = crowdReport(r, 8);
    } catch (e) { out.crowdRace = null; out.crowdRaceReport = `the race of 30 failed: ${e.message}`; }
    // ---- new kinds of car arriving in the pack (see the top): what a frame sends to the graphics card
    try {
      const r = await crowd({ port: PORT, n: 60, secs: 40, churn: 1, draw: true, dry: true, kinds: 1 });
      const mb = (r.gl || []).map((g) => g[2]);
      out.newCars = { framesOver3MB: mb.filter((x) => x > 3).length, mostMBInAFrame: +Math.max(0, ...mb).toFixed(2), sentMB: +mb.reduce((a, x) => a + x, 0).toFixed(1), mostMPInAFrame: +Math.max(0, ...(r.gl || []).map((g) => g[1])).toFixed(2), errors: r.errs.slice(0, 5) };
    } catch (e) { out.newCars = null; console.warn(`the new-kinds-of-car run failed: ${e.message}`); }
    // ---- shaders the iPhone way (see the top): programs first used in the drawing of a frame after DRIVE
    try {
      const r = await crowd({ port: PORT, n: 60, secs: 25, touch: true, draw: true, slowLink: 150, menu: true });
      const d = (r.waits || []).filter((w) => w[0] >= r.t0 && w[1] === 'draw').map((w) => w[0]);
      let most = 0;
      for (let i = 0, j = 0; i < d.length; i++) { while (d[i] - d[j] > 200) j++; most = Math.max(most, i - j + 1); }
      out.shaders = { inDrawing: d.length, mostInOneFrame: most, ahead: (r.waits || []).filter((w) => w[0] >= r.t0 && w[1] === 'ahead').length, errors: r.errs.slice(0, 5) };
    } catch (e) { out.shaders = null; console.warn(`the iPhone shaders run failed: ${e.message}`); }
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
    ['phone total at the Raadi stage (?raadi=1)', out.phone.raadi && out.phone.raadi.canvas + out.phone.raadi.gl + out.phone.raadi.heap, budget.phone.raadiTotalMB],
    ['phone graphics card peak at the Raadi stage', out.phone.raadi?.glPeak, budget.phone.raadiGlPeakMB],
    ['graphics level tests failing (saved level, crash guard)', lost, 0],
  );
  checks.push(
    ['lowest graphics level at the Riia and Turu junction: pieces drawn in a frame', out.lowest?.calls, budget.lowest.calls],
    ['lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands)', out.lowest?.ktris, budget.lowest.kTriangles],
    ['lowest graphics level along the Raadi stage, the heaviest of three views: pieces drawn in a frame', out.lowestStage?.calls, budget.stageDraw.lowestCalls],
    ['lowest graphics level along the Raadi stage: triangles in a frame (thousands)', out.lowestStage?.ktris, budget.stageDraw.lowestKTriangles],
    ['top graphics level (desktop) along the Raadi stage, the heaviest of three views: pieces drawn in a frame', out.topStage?.calls, budget.stageDraw.topCalls],
    ['top graphics level along the Raadi stage: triangles in a frame (thousands)', out.topStage?.ktris, budget.stageDraw.topKTriangles],
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
  {
    // the lap of the race track: the short hitches and what went to the graphics card (see the top)
    const D = out.drive.lap, B = budget.drive.lap;
    checks.push(
      ['lap drive round the race track: times the game was busy for over 25 ms', D?.busy25, B.busyOver25ms],
      ['lap drive: times the game was busy for over 33 ms', D?.busy33, B.busyOver33ms],
      ['lap drive: longest the game was busy without a break (ms)', D?.busyLongest, B.busyLongestMs],
      ['lap drive: frames whose game code took over 33 ms', D?.js33, B.framesOver33ms],
      ['lap drive: house fronts painted on the way (megapixels)', D?.frontsMP, B.frontsMP],
      ['lap drive: pictures sent to the graphics card (megapixels)', D?.sentMP, B.sentMP],
      ['lap drive: frames that sent over 1.1 megapixels of pictures', D?.sent11, B.framesOver1MP],
      ['lap drive: most megapixels of pictures sent in one frame', D?.sentMax, B.mostMPInAFrame],
      ['lap drive: page errors', D ? D.errors.length : null, 0],
      ['lap drive: building work queued twice', D ? D.doubles : null, 0],
      // shown, not judged: these two move by a third from one drive to the next
      ['lap drive: times the game was busy for over 16 ms, not judged', D?.busy16, null],
      ['lap drive: frames whose game code took over 16.7 ms, not judged', D?.js17, null],
      ['lap drive: game code in a frame, the longest (ms), not judged', D?.jsMax, null],
    );
  }
  {
    // the Raadi rally stage, from the way in to past the finish (see the top)
    const D = out.drive.stage, B = budget.drive.stage;
    checks.push(
      ['stage drive, a run of the Raadi rally stage: the stage counted the run as finished (runs not finished)', D ? (D.run?.finished ? 0 : 1) : null, 0],
      ['stage drive: times the game was busy for over 25 ms', D?.busy25, B.busyOver25ms],
      ['stage drive: times the game was busy for over 33 ms', D?.busy33, B.busyOver33ms],
      ['stage drive: longest the game was busy without a break (ms)', D?.busyLongest, B.busyLongestMs],
      ['stage drive: frames whose game code took over 33 ms', D?.js33, B.framesOver33ms],
      ['stage drive: pictures sent to the graphics card (megapixels)', D?.sentMP, B.sentMP],
      ['stage drive: frames that sent over 1.1 megapixels of pictures', D?.sent11, B.framesOver1MP],
      ['stage drive: most megapixels of pictures sent in one frame', D?.sentMax, B.mostMPInAFrame],
      ['stage drive: page errors', D ? D.errors.length : null, 0],
      ['stage drive: building work queued twice', D ? D.doubles : null, 0],
      ['stage drive: times the game was busy for over 16 ms, not judged', D?.busy16, null],
      ['stage drive: game code in a frame, the longest (ms), not judged', D?.jsMax, null],
    );
  }
  {
    // many players online (see the top)
    const D = out.crowd, B = budget.crowd;
    checks.push(
      ['60 players online: times the online code kept the page busy for over 5 ms in 40 s', D?.online5, B.onlineOver5ms],
      ['60 players online: the online code\'s most in one stretch (ms)', D?.onlineMax, B.onlineLongestMs],
      ['60 players online: page errors', D ? D.errors.length : null, 0],
      ['60 players online: the online code per frame (ms), not judged', D?.onlineMsPerFrame, null],
      ['60 players online: times the game was busy for over 25 ms, not judged', D?.busy25, null],
    );
    const R = out.crowdRace;
    checks.push(
      ['a race of 30, 60 online: times the online code kept the page busy for over 5 ms in 30 s', R?.online5, B.onlineOver5ms],
      ['a race of 30: the online code\'s most in one stretch (ms)', R?.onlineMax, B.onlineLongestMs],
      ['a race of 30: page errors', R ? R.errors.length : null, 0],
    );
  }
  {
    // new kinds of car in a crowd (see the top)
    const D = out.newCars, B = budget.newCars;
    checks.push(
      ['new kinds of car, 60 online: frames that sent over 3 MB of model to the graphics card', D?.framesOver3MB, B.framesOver3MB],
      ['new kinds of car: page errors', D ? D.errors.length : null, 0],
      ['new kinds of car: most model in one frame (MB), not judged', D?.mostMBInAFrame, null],
      ['new kinds of car: most pictures in one frame (megapixels), not judged', D?.mostMPInAFrame, null],
    );
  }
  {
    // shaders the iPhone way (see the top)
    const S = out.shaders, B = budget.shaders;
    checks.push(
      ['phone, shaders built the iPhone way: programs first used inside the drawing of a frame after DRIVE', S?.inDrawing, B.inDrawing],
      ['phone, shaders built the iPhone way: most such programs in one frame', S?.mostInOneFrame, B.mostInOneFrame],
      ['phone, shaders built the iPhone way: page errors', S ? S.errors.length : null, 0],
    );
  }
  out.machine = watch.stop();
  if (out.machine) checks.push(['the machine: processor cores taken by other work during the check, on average (over 0.5: run it again alone), not judged', out.machine.othersAvg, null]);
  console.log(`perf budget, commit ${out.commit}, ${out.when}`);
  for (const [name, v, max] of checks) {
    const bad = v == null || (max != null && v > max);
    if (bad) out.over.push(name);
    out.checks.push({ name, figure: v ?? null, budget: max, ok: !bad });
    console.log(`${bad ? 'OVER' : max == null ? 'info' : 'ok  '} ${name}: ${v ?? 'not measured'}${max == null ? '' : ` (budget ${max})`}`);
  }
  for (const who of ['desktop', 'phone', 'lap', 'stage']) {
    const D = out.drive[who];
    if (D) console.log(`${who} drive ${JSON.stringify({ km: D.km, seconds: D.seconds, frames: D.frames, jsMedian: D.jsMedian, jsP95: D.jsP95, jsP99: D.jsP99, busy50: D.busy50, busy100: D.busy100, busyLongest: D.busyLongest, busyS: D.busyS, busyFrom: D.busyFrom, busy16: D.busy16, busy25: D.busy25, busy33: D.busy33, js17: D.js17, js33: D.js33, jsMax: D.jsMax, sentMP: D.sentMP, sent11: D.sent11, sent22: D.sent22, sentMax: D.sentMax, frontsMP: D.frontsMP, ...(D.run ? { run: D.run } : {}), gaps50: D.pauses50, gaps100: D.pauses100, longestGap: D.longest, gapsS: D.frozen })}`);
    if (D?.errors.length) console.log(`${who} drive errors: ${D.errors.join(' | ')}`);
    // what ran in the busy stretches, when a drive figure is over (or the drive failed)
    if (out.over.some((n) => n.startsWith(who + ' drive')) && out.driveReport[who]) console.log(`what the page was busy with on the ${who} drive:\n` + out.driveReport[who].join('\n'));
  }
  if (out.machine) console.log(`the machine ${JSON.stringify(out.machine)}`);
  if (out.machine?.busy) console.log(`THE MACHINE WAS BUSY WITH OTHER WORK DURING THIS RUN: ${out.machine.othersAvg} of its ${out.machine.cores} processor cores on average, over one core for ${out.machine.busySecs} s. The timing figures (the drives, the online parts) and the phone's memory through the centre read higher than they are. Run the check again alone (--force) before blaming a commit.`);
  if (out.crowd) console.log(`60 players online ${JSON.stringify(out.crowd)}`);
  if (out.crowdRace) console.log(`a race of 30 ${JSON.stringify(out.crowdRace)}`);
  if (out.newCars) console.log(`new kinds of car in a crowd ${JSON.stringify(out.newCars)}`);
  if (out.over.some((n) => n.startsWith('a race of 30')) && out.crowdRaceReport) console.log(`what the page was busy with, a race of 30:\n${out.crowdRaceReport}`);
  if (out.over.some((n) => n.startsWith('60 players')) && out.crowdReport) console.log(`what the page was busy with, 60 players online:\n${out.crowdReport}`);
  if (out.phone.errors?.length) console.log('page errors:', out.phone.errors.slice(0, 5).join(' | '));
  console.log('lowest level', JSON.stringify(out.lowest));
  console.log('Raadi stage drawn', JSON.stringify({ lowest: out.lowestStage, top: out.topStage }));
  console.log('phone', JSON.stringify({ menu: out.phone.menu, driveSpike: out.phone.driveSpike, drive: out.phone.drive, cars: out.phone.cars, jump: out.phone.jump, raadi: out.phone.raadi }));
  if (out.over.some((n) => n.startsWith('phone ') && !n.startsWith('phone drive'))) console.log('biggest canvas makers at DRIVE:\n' + (out.phone.canvases || []).join('\n'));
  if (out.over.some((n) => n.includes('through the centre'))) console.log('biggest canvas makers after the centre:\n' + (out.phone.centreCanvases || []).join('\n'));
  if (out.over.some((n) => n.includes('Raadi stage') && n.includes('phone'))) console.log('biggest canvas makers at the Raadi stage:\n' + (out.phone.raadiCanvases || []).join('\n'));
  if (out.levelTests?.length) console.log(out.levelTests.join('\n'));
  try {
    fs.mkdirSync(path.dirname(STAMP), { recursive: true });
    const d = out.phone.drive;
    fs.writeFileSync(STAMP, JSON.stringify({ when: out.when, commit: out.commit, over: out.over, busy: !!out.machine?.busy, total: d ? d.canvas + d.gl + d.heap : null, full: out }, null, 1));
  } catch (e) { console.warn('could not save the last-run note:', e.message); }
  const json = opt('--json');
  if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
  process.exit(out.over.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
