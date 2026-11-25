// Many players online: does the picture hitch?   node tools/crowd-hitch.cjs [n=60] [secs=30] [port=5198] [touch] [top=12] [churn=2]
//
// Martin 2026-11-24: with 55 to 78 online, desktop at 59 FPS and the top level, "late frames 1 per 2 s,
// longest 67 ms". Needs the dev server (npx vite --port 5198). No game server: the page's WebSocket is a fake
// lobby that welcomes n made-up drivers and sends their positions in bundles ten times a second, as the real one
// does (worker/index.js TICK), and keeps the crowd moving the way a full server does: every `churn` seconds one
// driver leaves or another joins in a random car, now and then one changes car, steps into the garage and
// back, or gets a spectator. Drawing is off (as in freeze-profile.cjs), so frames run at 60 a second without
// a graphics card, and our car stands on the race track with the pack around it. A CPU profile runs meanwhile.
// Printed: the gaps between frames, the stretches of over 25 ms in which the page was busy, and what ran in them.
// tools/perf-budget.cjs runs this as its many-players part (crowd()).
const { chromium, devices } = require('playwright');
const { stretches } = require('./freeze-profile.cjs');

const CARS = ['impreza', 'f40', 'w201', 'm3', 'cgt', 'audi200', 'enyaq', 'passat', 'rav4', 'bz4x', 'crv', 'mazda6'];

async function crowd({ port = 5198, n = 60, secs = 30, touch = false, churn = 2, draw = false, shot = '', race = 0, slowLink = 0, menu = false } = {}) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await b.newContext(touch ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } : { viewport: draw ? { width: 480, height: 270 } : { width: 1280, height: 720 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); localStorage.setItem('kvissuroam.name', 'Tester'); });
    // shader programs linked while drawing (draw only): when, how long the link and its first check took, and
    // what three.js named it (a phone links them on its own thread only where the browser can, and iPhones
    // cannot: 24 Nov 2026, 172 of 235 phone freezes of 1 s or more drew new shaders, 30+ others online)
    // slowLink: a graphics driver like an iPhone's (draw only): no KHR_parallel_shader_compile, and the first
    // question about a new program (its build, its uniforms, its first use) waits `slowLink` ms for the build
    if (slowLink) await p.addInitScript((ms) => {
      const G = window.WebGL2RenderingContext?.prototype;
      if (!G) return;
      const ext = G.getExtension, sup = G.getSupportedExtensions, built = new WeakSet();
      G.getExtension = function (n) { return n === 'KHR_parallel_shader_compile' ? null : ext.call(this, n); };
      G.getSupportedExtensions = function () { return (sup.call(this) || []).filter((n) => n !== 'KHR_parallel_shader_compile'); };
      window.__waits = []; Error.stackTraceLimit = 40;
      // (where each wait came: inside the drawing of a frame, or ahead in the game's own first use, src/warm.js)
      const wait = (prog) => {
        if (!prog || built.has(prog)) return;
        built.add(prog);
        const st = new Error().stack || '', where = /useFirsts/.test(st) ? 'ahead' : /\.render \(|at render /.test(st) ? 'draw' : 'other';
        const t = performance.now(); while (performance.now() - t < ms);
        __waits.push([t, where, prog]);
      };
      for (const k of ['getProgramParameter', 'getProgramInfoLog', 'getActiveUniform', 'getUniformLocation', 'getActiveAttrib', 'getAttribLocation', 'useProgram']) {
        const f = G[k];
        G[k] = function (prog, ...a) { wait(prog); return f.call(this, prog, ...a); };
      }
    }, slowLink);
    await p.addInitScript(() => {
      window.__links = [];
      const G = window.WebGL2RenderingContext?.prototype;
      if (!G) return;
      const link = G.linkProgram;
      G.linkProgram = function (prog) {
        let name = '?';
        try { for (const sh of this.getAttachedShaders(prog) || []) { const m = (this.getShaderSource(sh) || '').match(/#define SHADER_NAME (\S+)/); if (m) { name = m[1]; break; } } } catch {}
        __links.push([performance.now(), name]);
        return link.call(this, prog);
      };
    });
    await p.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__fr = [];
      // long animation frames (Chrome): how much of each went to scripts and how much to the page's style and
      // layout, and which scripts (invoker, function, source)
      window.__loaf = [];
      try {
        new PerformanceObserver((l) => {
          if (!window.__rec) return;
          for (const e of l.getEntries()) {
            __loaf.push({ dur: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.startTime + e.duration - e.renderStart), style: Math.round(e.startTime + e.duration - e.styleAndLayoutStart),
              scripts: e.scripts.map((x) => ({ inv: x.invoker, fn: x.sourceFunctionName, src: (x.sourceURL || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*/, '') + ':' + x.sourceCharPosition, dur: Math.round(x.duration), layout: Math.round(x.forcedStyleAndLayoutDuration) })) });
          }
        }).observe({ type: 'long-animation-frame', buffered: false });
      } catch { /* not in this browser */ }
      window.requestAnimationFrame = (f) => raf((ts) => {
        const t0 = performance.now(); f(ts);
        if (window.__rec && f.name === 'frame') __fr.push([t0, performance.now() - t0]);
      });
    });
    const P = await (async () => JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../src/race/track.json'))).pts)();
    await p.addInitScript(([P, N, CARS, CHURN, RACE]) => {
      const I0 = 1700;
      let seq = 0;
      const bots = [];
      const mk = (k) => {
        const id = `bot${seq++}`;
        // a pack around us (16 to 130 m), the rest spread round the lap
        const pack = k < 8, at = pack ? 8 + k * 7 : Math.round(Math.random() * (P.length - 120)) + 60;
        // (each with a number plate of their own, 25 Nov: a picture per car on the page)
        return { id, name: `Driver${String(seq).padStart(3, '0')}`, car: CARS[(seq * 7) % CARS.length], pl: `${String(100 + (seq % 900))} ÄBC`, w: 'map', pack, at, speed: pack ? 6 : 12 + (seq % 5) * 3, ph: Math.random() * 6 };
      };
      for (let k = 0; k < N; k++) bots.push(mk(k));
      const pub = (o) => ({ id: o.id, name: o.name, car: o.car, pl: o.pl, w: o.w });
      class FakeWS {
        constructor() {
          this.readyState = 0;
          window.__fakeWs = this;
          setTimeout(() => {
            this.readyState = 1;
            this.onopen?.();
            const msg = (m) => this.onmessage?.({ data: JSON.stringify(m) });
            msg({ t: 'welcome', id: 'me', players: bots.map(pub) });
            const t0 = performance.now();
            let lastChurn = 0, step = 0;
            this.timer = setInterval(() => {
              const t = (performance.now() - t0) / 1000;
              const g = window.__game;
              const out = [];
              for (const o of bots) {
                if (o.w !== 'map') continue;
                const f = o.pack ? I0 + o.at + 6 + 5 * Math.sin(t * 0.25 + o.ph) : I0 + o.at + (t * o.speed) / 2.045;
                const i = Math.floor(f) % P.length, j = (i + 1) % P.length, u = f - Math.floor(f);
                const x = P[i][0] + (P[j][0] - P[i][0]) * u, z = P[i][1] + (P[j][1] - P[i][1]) * u;
                const yaw = Math.atan2(P[j][0] - P[i][0], -(P[j][1] - P[i][1])), side = ((o.at % 3) - 1) * 2.5;
                const y = g?.world?.heightAt ? g.world.heightAt(x, z) : 0;
                // (the pack slides now and then, as people do: tyre marks, smoke and squeal for their cars)
                const sl = o.pack && Math.sin(t * 0.7 + o.ph * 3) > 0.4 ? 1 : 0;
                out.push([o.id, [x + Math.cos(yaw) * side, z + Math.sin(yaw) * side, y, yaw, 0, 0, Math.sin(yaw) * o.speed, -Math.cos(yaw) * o.speed, 0.1 * sl, 0, 0, 0, 0.6 + 0.4 * sl, 0, 4000 + 2500 * sl, 3 * sl, 0.3 * sl, 0.8 * sl, 0.4 * sl, 0.9 * sl, 4, Date.now() % 60000], 20]);
              }
              msg({ t: 'S', b: out });
              // a race vote filling up, one vote a second, then over (each vote changes every row's mark in the list)
              // or (race=N) a race of N under way, us in it, as the server tells it: started 10 s ago
              if (RACE && !this.raced) {
                this.raced = true;
                const g = Date.now() - 10000;
                const racers = [{ id: 'me', name: 'Tester', car: 'm3' }, ...bots.slice(0, RACE - 1).map((o) => ({ id: o.id, name: o.name, car: o.car }))];
                msg({ t: 'race', r: { id: 1, on: true, seed: 1, tGrid: g - 10000, tGreen: g, racers, vote: { kind: 'none', ids: [], need: 1 } } });
              }
              const vt = Math.floor(t) % 20;
              if (!RACE && vt !== this.vt) {
                this.vt = vt;
                const ids = vt < 12 ? bots.slice(0, vt).map((o) => o.id) : [];
                msg({ t: 'race', r: { id: 1, on: false, racers: [], vote: { kind: ids.length ? 'start' : 'none', ids, need: 12 } } });
              }
              // a full server: people come and go, change cars, step into the garage, get watched
              if (CHURN > 0 && t - lastChurn >= CHURN) {
                lastChurn = t; step++;
                const r = step % 4;
                if (r === 0 || r === 2) {       // one leaves, another joins (the pack stays a pack)
                  const k = 8 + Math.floor(Math.random() * (bots.length - 8));
                  const gone = bots[k];
                  msg({ t: 'leave', id: gone.id });
                  const nb = mk(k); nb.car = CARS[Math.floor(Math.random() * CARS.length)];
                  bots[k] = nb;
                  msg({ t: 'join', ...pub(nb) });
                } else if (r === 1) {           // someone changes car
                  const o = bots[Math.floor(Math.random() * bots.length)];
                  o.car = CARS[(CARS.indexOf(o.car) + 1 + Math.floor(Math.random() * 5)) % CARS.length];
                  msg({ t: 'car', id: o.id, car: o.car });
                  // and someone else their plate (a new picture for that car)
                  const q = bots[Math.floor(Math.random() * 8)];
                  q.pl = `${String(100 + Math.floor(Math.random() * 900))} XYZ`;
                  msg({ t: 'plate', id: q.id, pl: q.pl });
                } else {                        // into the garage and back, or a spectator
                  const o = bots[8 + Math.floor(Math.random() * (bots.length - 8))];
                  o.w = o.w === 'map' ? 'garage' : 'map';
                  msg({ t: 'at', id: o.id, w: o.w });
                  msg({ t: 'wn', id: bots[Math.floor(Math.random() * bots.length)].id, n: step % 3 });
                }
              }
            }, 100);
          }, 300);
        }
        send() {}
        close() { clearInterval(this.timer); this.readyState = 3; }
      }
      window.WebSocket = FakeWS;
    }, [P, n, CARS, churn, race]);
    await p.goto(`http://localhost:${port}/`, { timeout: 180000 });
    await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
    const I0 = 1700, yaw0 = Math.atan2(P[I0 + 1][0] - P[I0][0], -(P[I0 + 1][1] - P[I0][1]));
    // menu: as a player comes in, the menu's warm-up frames first, then DRIVE where the game puts the car
    if (menu) {
      await p.waitForFunction(() => __game.warm >= 20, null, { timeout: 120000 });
      await p.waitForTimeout(3000);
      await p.evaluate(() => { window.__drive0 = performance.now(); __game.startDriving(); });
    } else await p.evaluate(async ([x, z, yaw, draw]) => { if (!draw) __game.renderer.render = () => {}; window.__drive0 = performance.now(); window.__progs0 = __game.renderer.info.programs?.length || 0; __game.startDriving(); await __game.world.loadAround(x, z, 260); __game.place({ x, z, yaw }); }, [P[I0][0], P[I0][1], yaw0, draw]);
    await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
    // the place built and the first cars of each kind made (worker build, warm-up)
    await p.waitForTimeout(touch ? 25000 : 20000);
    // (and the place around has finished building, so what is left to see is the other players)
    await p.waitForFunction(() => !__game.jobs?.pending && !__game.warmer?.waiting, null, { timeout: 60000, polling: 500 }).catch(() => {});
    await p.waitForTimeout(2000);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
    const linksBefore = await p.evaluate(() => __links.length);
    const tStart = await p.evaluate(() => { window.__rec = true; return performance.now(); });
    await p.waitForTimeout(secs * 1000);
    const { profile } = await cdp.send('Profiler.stop');
    if (shot) await p.screenshot({ path: shot });
    const { fr, online, loaf, links, t0, progs, waits } = await p.evaluate(() => { window.__rec = false; return { fr: __fr, online: __game.mp().count, loaf: __loaf, links: __links, t0: window.__drive0 || 0, waits: (window.__waits || []).map(([t, w, g]) => { const q = (__game.renderer.info.programs || []).find((x) => x.program === g); return [t, w, q ? `${q.name || ''} ${String(q.cacheKey).split(',').filter((x) => x && x !== 'false' && x !== 'undefined' && x !== '0').slice(0, 3).join(' ')} ${String(q.cacheKey).slice(-60).replace(/\s+/g, ' ')}` : '(gone)']; }),
      progs: (__game.renderer.info.programs || []).slice(window.__progs0 || 0).map((q) => [q.name, q.cacheKey.split(',').filter((x) => x && x !== 'false' && x !== 'undefined' && x !== '0').slice(0, 40).join(' ')]) }; });
    return { errs, fr, profile, tStart, online, secs, loaf, links, linksBefore, t0, progs, waits };
  } finally { await b.close(); }
}

// the online code's part of a busy stretch: the player list, the other cars (positions, copies, name tags, the
// minimap's arrows), their sounds and tyre marks
const ONLINE = /src\/net\/|src\/race\/racemode|updateRemotes|updateOthers|setOverlay|playerArrow/;
const onlineMs = (r) => { let t = 0; for (const [k, v] of r.by) if (ONLINE.test(k)) t += v; return t / 1000; };

// gaps between frames, busy stretches and the short hitches, as freeze-profile.cjs counts them for a drive
function summarise({ fr, profile, secs }) {
  const all = stretches(profile);
  const on = all.map(onlineMs);
  const gaps = [];
  for (let i = 1; i < fr.length; i++) gaps.push(fr[i][0] - fr[i - 1][0]);
  const runs = all;
  const busy = runs.filter((r) => r.dur > 25000);
  const longest = busy.reduce((a, r) => Math.max(a, r.dur), 0) / 1000;
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    frames: fr.length, secs,
    over33: gaps.filter((g) => g > 33).length, over50: gaps.filter((g) => g > 50).length,
    longestGap: Math.round(sorted[sorted.length - 1] || 0), p99: Math.round(sorted[Math.floor(sorted.length * 0.99)] || 0),
    busy25: busy.length, busyLongest: Math.round(longest), profileOk: runs.ok,
    // (stretches in which the online code alone kept the page for over 5 ms, and its most in one stretch)
    online5: on.filter((x) => x > 5).length, onlineMax: +Math.max(0, ...on).toFixed(1),
    onlineMsPerFrame: +(on.reduce((a, x) => a + x, 0) / (fr.length || 1)).toFixed(2),
    frameMsAvg: +(fr.reduce((a, f) => a + f[1], 0) / (fr.length || 1)).toFixed(2),
  };
}

// what ran in the busy stretches, in all (top functions by time)
function report({ profile }, top = 12) {
  const runs = stretches(profile).filter((r) => r.dur > 25000);
  const by = new Map();
  for (const r of runs) for (const [k, v] of r.by) by.set(k, (by.get(k) || 0) + v);
  const lines = [...by].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => `  ${(v / 1000).toFixed(0).padStart(5)} ms  ${k}`);
  const each = runs.sort((a, b) => b.dur - a.dur).slice(0, 6).map((r) => `  ${(r.dur / 1000).toFixed(0)} ms: ${[...r.by].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v / 1000).toFixed(0)}`).join(' | ')}`);
  const onl = stretches(profile).filter((r) => onlineMs(r) > 5).sort((a, b) => onlineMs(b) - onlineMs(a)).slice(0, 6)
    .map((r) => `  ${onlineMs(r).toFixed(1)} ms of ${(r.dur / 1000).toFixed(1)}: ${[...r.by].filter(([k]) => ONLINE.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}`).join(' | ')}`);
  return `the online code over 5 ms in one stretch:\n${onl.join('\n')}\nbusy stretches over 25 ms, by what ran in them:\n${lines.join('\n')}\nlongest ones:\n${each.join('\n')}`;
}

module.exports = { crowd, summarise, report };

if (require.main === module) {
  const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };
  (async () => {
    const r = await crowd({ port: +arg('port', 5198), n: +arg('n', 60), secs: +arg('secs', 30), touch: process.argv.includes('touch'), churn: +arg('churn', 2), draw: process.argv.includes('draw'), shot: arg('shot', ''), race: +arg('race', 0), slowLink: +arg('slowLink', 0), menu: process.argv.includes('menu') });
    if (r.errs.length) console.log('PAGE ERRORS', r.errs.slice(0, 5));
    console.log(JSON.stringify({ online: r.online, ...summarise(r) }));
    console.log(report(r, +arg('top', 12)));
    const lf = r.loaf.filter((e) => e.dur > 33).sort((a, b) => b.dur - a.dur);
    console.log(`long animation frames over 33 ms: ${lf.length}`);
    for (const e of lf.slice(0, +arg('loaf', 8))) console.log(`  ${e.dur} ms (render ${e.render}, style+layout ${e.style}): ${e.scripts.filter((x) => x.dur >= 2).map((x) => `${x.inv} ${x.fn} ${x.src} ${x.dur}${x.layout ? ` [forced layout ${x.layout}]` : ''}`).join(' | ')}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
