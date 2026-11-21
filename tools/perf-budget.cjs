// Memory and frame-cost budget check: node tools/perf-budget.cjs [--force] [--json out.json] [--port 5197]
//
// It takes about two minutes, so it does not run after every merge: when any thread (or the nightly
// run) ran it less than 2 hours ago, it prints that result and stops (Martin, 20 Nov 2026). --force
// runs it anyway: when Martin asks, or for a change that is likely to weigh (new painted streets, car
// models, many objects). The last run is kept in the project's shared folder (perf/last-run.json);
// a skipped run with --json writes that last run's figures there.
//
// Starts the game (vite) and measures it in headless Chromium the way a phone sees it (iPhone 13
// emulation: light mode, small pictures) and the way a desktop does:
//   phone:   at the menu, the peak in the first 5 s after DRIVE (garbage not yet collected included), 15 s after DRIVE, after three car changes, and the peak during a map jump to
//            Kvissentali: live canvases, textures and buffers on the graphics card, JS heap.
//   desktop: the game code's milliseconds per frame while driving (full settings), the drawing call left out.
// Each figure is compared with tools/perf-budget.json; the script exits 1 when one is over, and then
// lists the biggest canvas makers so the cause is easy to find.
//
// Why: an iPhone 13 reloads the page when it runs out of memory (Martin's son's phone, 20 Nov 2026,
// after one morning of new hand-painted streets). Every addition should fit the budget; the check also
// runs every night (a scheduled task) and its history is kept on the perf-reports branch.
// Headless draws without a graphics card (SwiftShader), so frame rates mean nothing here: memory and the
// game code's own work per frame are what is measured.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

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
  const out = { when: new Date().toISOString(), commit: '', phone: {}, desktop: {}, over: [] };
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
    for (const id of ['f40', 'enyaq', 'audi200']) { await p.evaluate((i) => __game.setCar(i, true), id); await p.waitForTimeout(2500); }
    out.phone.cars = await take();
    await p.evaluate(() => __perfPeak());
    await p.evaluate(() => __game.dropAt(70, 0));                 // Kvissentali, across the city
    await p.waitForTimeout(15000);
    out.phone.jump = await take();
    out.phone.errors = errors;
    await ctx.close();

    // ---- desktop: the game code's work per frame while driving
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const d = await dctx.newPage();
    await d.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__js = [];
      window.__draw = 0;
      window.requestAnimationFrame = (f) => raf((ts) => { const t0 = performance.now(), d0 = window.__draw; f(ts); window.__js.push(performance.now() - t0 - (window.__draw - d0)); });
    });
    await d.goto(`${url}?drive`, { timeout: 180000 });
    await d.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
    // The drawing call is left out of the figure (Martin's go-ahead, 21 Nov 2026). Without a graphics card
    // these 15 s are about fifteen frames, and what a frame's drawing costs here (new pictures sent and
    // shaders compiled in software) says nothing about a real machine: whether new things arrived in one
    // frame or spread over five moved the median from 10 to 25 ms with the same game code per frame.
    await d.evaluate(() => { const r = window.__game.renderer, draw = r.render.bind(r); r.render = (...a) => { const t = performance.now(); try { return draw(...a); } finally { window.__draw += performance.now() - t; } }; });
    await d.waitForTimeout(10000);
    await d.evaluate(() => { window.__js.length = 0; });
    await d.waitForTimeout(15000);
    const js = (await d.evaluate(() => window.__js.slice())).filter((x) => x > 0.3).sort((a, b) => a - b);
    out.desktop.jsMedian = js.length ? +js[js.length >> 1].toFixed(1) : null;
    out.desktop.frames = js.length;
    await dctx.close();
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
    ['phone graphics card growth over 3 car changes', out.phone.cars && out.phone.cars.gl - out.phone.drive.gl, budget.phone.carChangeGrowthMB],
    ['desktop game code per frame (ms)', out.desktop.jsMedian, budget.desktop.jsMedianMs],
  ];
  console.log(`perf budget, commit ${out.commit}, ${out.when}`);
  for (const [name, v, max] of checks) {
    const bad = v == null || v > max;
    if (bad) out.over.push(name);
    console.log(`${bad ? 'OVER' : 'ok  '} ${name}: ${v ?? 'not measured'} (budget ${max})`);
  }
  if (out.phone.errors?.length) console.log('page errors:', out.phone.errors.slice(0, 5).join(' | '));
  console.log('phone', JSON.stringify({ menu: out.phone.menu, driveSpike: out.phone.driveSpike, drive: out.phone.drive, cars: out.phone.cars, jump: out.phone.jump }));
  if (out.over.length) console.log('biggest canvas makers at DRIVE:\n' + (out.phone.canvases || []).join('\n'));
  try {
    fs.mkdirSync(path.dirname(STAMP), { recursive: true });
    const d = out.phone.drive;
    fs.writeFileSync(STAMP, JSON.stringify({ when: out.when, commit: out.commit, over: out.over, total: d ? d.canvas + d.gl + d.heap : null, full: out }, null, 1));
  } catch (e) { console.warn('could not save the last-run note:', e.message); }
  const json = opt('--json');
  if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
  process.exit(out.over.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
