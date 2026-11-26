// A lap record replay's slider (src/spectate.js; Martin 26 Nov: "some slider which you keep mouse pressed and slide from
// left to right and back and it shows the specific still frame of that place, letting go keep playing from the place
// where it is let go"). Checks, in a desktop browser, with a real record lap from the live site's board:
//  - the replay comes up from a click on its time on LAP TIMES, with the slider under the name, its clock running;
//  - pressed on the slider: the car is put at that moment of the lap and stands there (a still frame: the clock and
//    the car do not move, its engine is not heard), the camera straight behind it;
//  - slid back and forth with the button held: the car follows the pointer each step, the camera with it, and the
//    page does no new work for it: no map piece, ground picture, parked car or other building work starts while it
//    slides, and the frames are no longer than while the replay plays (the figures are printed);
//  - let go: the lap plays on from that moment, heard again;
//  - held still on one spot (SCRUB_REST): the map comes in round the car there;
//  - a finger works the same (touch pointer events), and slid to the end and let go, the replay finishes as before;
//  - the slider's place in three window shapes: 1280x720, 844x390 and 800x304 (pictures with a folder given).
// Run with the dev server on 5198: node tools/replay-scrub-test.mjs [folder for pictures]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:5198', dir = process.argv[2] || '';
const LIVE = 'https://www.linnaring.com';
let bad = 0;
const check = (name, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  (${note})` : ''}`); if (!ok) bad++; };

// the live board, and one record lap's replay of the circuit to slide through
const board = await (await fetch(`${LIVE}/api/board`)).json();
const TRACK = 'toomemagi', CAR = Object.keys(board.rp?.[TRACK] || {}).sort((a, b) => board.rp[TRACK][a] - board.rp[TRACK][b])[0];
if (!CAR) { console.log('FAIL no replay on the live board'); process.exit(1); }
const rpRes = await fetch(`${LIVE}/api/replay?track=${TRACK}&car=${CAR}`);
const rpBody = Buffer.from(await rpRes.arrayBuffer()), rpHead = { 'content-type': 'application/octet-stream', 'x-ms': rpRes.headers.get('x-ms'), 'x-name': rpRes.headers.get('x-name') };
console.log(`     replay: ${TRACK} ${CAR} ${rpHead['x-ms']} ms by ${decodeURIComponent(rpHead['x-name'])}, ${rpBody.length} bytes`);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route('**/api/board', (r) => r.fulfill({ json: board }));
  await ctx.route('**/api/top?**', (r) => r.fulfill({ json: {} }));
  await ctx.route('**/api/replay?**', (r) => r.fulfill({ status: 200, headers: rpHead, body: rpBody }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => check(`no page error: ${e.message}`, false));
  await p.goto(`${base}/?off=100&q=low&trees=old&lite=1&hidden=1`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate(() => __game.startDriving());
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying && __game.mp().board?.rp, null, { timeout: 120000 });
  // (drawing without a graphics card takes seconds a frame: nothing is drawn until a picture is wanted)
  await p.evaluate(() => {
    const g = __game, r = g.renderer; r.realRender = r.render; r.render = () => {};
    // every frame, while asked: the replay's moment, where its car and the camera are, and how long the frame took
    window.__rec = null;
    let last = performance.now();
    const tick = () => {
      const now = performance.now(), o = g.mp().replay, c = g.camera.position;
      if (window.__rec && o) {
        const p = o.pose, f = g.watch().focus;
        window.__rec.push({ dt: now - last, t: o.rp.t, hold: o.rp.hold, live: o.live, x: p[0], z: p[1], yaw: p[3],
          cam: Math.hypot(c.x - p[0], c.z - p[1]), behind: (c.x - p[0]) * Math.sin(p[3]) - (c.z - p[1]) * Math.cos(p[3]), fx: f.x, fz: f.z, scrub: g.watch().scrubbing });
      }
      last = now;
      requestAnimationFrame(tick);
    };
    tick();
    // what starts while asked: building work queued, map pieces and ground pictures loading
    window.__work = null;
    const add = g.jobs.add.bind(g.jobs);
    g.jobs.add = (fn, label) => { if (window.__work) window.__work.jobs.push(label || '?'); return add(fn, label); };
    window.__loads = () => ({ sectors: [...g.world.sectors.values()].filter((s) => s.state === 'loading').length, ground: g.terrain().pending(),
      ready: [...g.world.sectors.values()].filter((s) => s.state === 'ready').length, parked: g.parked().bodies.length });
    // parked cars put down since the last call, and how far the furthest is from where the map is streamed in (or our own car)
    let had = new Set(g.parked().bodies);
    window.__parked = () => {
      const f = g.watch().focus || g.car, c = g.car, add = g.parked().bodies.filter((b) => !had.has(b));
      had = new Set(g.parked().bodies);
      return { n: add.length, far: Math.max(0, ...add.map((b) => Math.min(Math.hypot(b.x - f.x, b.z - f.z), Math.hypot(b.x - c.x, b.z - c.z)))) };
    };
    // pages busy for over 50 ms
    window.__long = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ type: 'longtask', buffered: false }); } catch { /* none */ }
  });
  return p;
};
const shot = async (p, name) => { if (!dir) return; await p.evaluate(() => { const g = __game; g.renderer.realRender(g.scene, g.camera); }); await p.screenshot({ path: `${dir}/${name}.png` }); console.log(`     picture ${name}.png`); };
const state = (p) => p.evaluate(() => { const o = __game.mp().replay, w = __game.watch(); return o && { t: o.rp.t, dur: o.rp.ms / 1000, hold: o.rp.hold, run: o.rp.run, live: o.live, x: o.pose[0], z: o.pose[1], active: w.active, scrubbing: w.scrubbing,
  st: document.querySelector('#watch .who .st').textContent, now: document.querySelector('#watch .scrub .now').textContent, end: document.querySelector('#watch .scrub .end').textContent,
  ready: document.querySelector('#watch .scrub').classList.contains('ready'), shown: !document.querySelector('#watch .scrub').classList.contains('hidden') }; });
const bar = (p) => p.evaluate(() => { const r = document.querySelector('#watch .scrub .rail').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, h: r.height }; });
const record = async (p, during) => { await p.evaluate(() => { window.__rec = []; window.__work = { jobs: [] }; window.__long = []; __parked(); }); const l0 = await p.evaluate(() => __loads()); await during(); return p.evaluate((l0) => { const r = { frames: window.__rec, jobs: window.__work.jobs, long: window.__long, l0, l1: __loads(), parked: __parked() }; window.__rec = null; window.__work = null; return r; }, l0); };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const f1 = (v) => v.toFixed(1);

const p = await open(1280, 720);
// ---- in from the board: a click on the record's time
await p.evaluate(() => __game.board().show());
await p.waitForSelector(`#board [data-rp="${TRACK}|${CAR}"]`, { timeout: 30000 });
await p.click(`#board [data-rp="${TRACK}|${CAR}"]`);
await p.waitForFunction(() => document.querySelector('#watch .scrub.ready') && __game.mp().replay?.rp.run, null, { timeout: 120000 });
let s = await state(p);
check('a replay from the board shows its slider', s.shown && s.ready && s.active, `${s.st} · ${s.now} / ${s.end}`);
await p.waitForTimeout(1500);
const s1 = await state(p);
check('the replay plays and the slider\'s clock runs', s1.t > s.t + 0.5 && s1.now !== s.now, `${f1(s.t)} -> ${f1(s1.t)} s`);
await shot(p, 'scrub-1280-playing');

// ---- pressed at a tenth of the lap: a still frame there
const b = await bar(p);
await p.mouse.move(b.x + b.w * 0.1, b.y);
await p.mouse.down();
await p.waitForTimeout(300);
const h0 = await state(p);
check('pressed: the replay is at that moment', Math.abs(h0.t - h0.dur * 0.1) < h0.dur * 0.01 && h0.hold, `${f1(h0.t)} s of ${f1(h0.dur)}`);
await p.waitForTimeout(1000);
const h1 = await state(p);
check('held: a still frame (the clock and the car stand)', h1.t === h0.t && h1.x === h0.x && h1.z === h0.z && h1.now === h0.now, h1.now);
check('held: the car is not heard', !h1.live);
const cam = await p.evaluate(() => { const o = __game.mp().replay.pose, c = __game.camera.position; return { d: Math.hypot(c.x - o[0], c.z - o[1]), behind: (c.x - o[0]) * Math.sin(o[3]) - (c.z - o[1]) * Math.cos(o[3]) }; });
check('held: the camera is behind the car there', cam.d < 15 && cam.behind < -3, `${f1(cam.d)} m away, ${f1(-cam.behind)} m behind`);
await shot(p, 'scrub-1280-held');

// ---- the replay playing on its own for comparison: frame times without the slider
await p.mouse.up();
await p.waitForTimeout(1500);
const play = await record(p, () => p.waitForTimeout(4000));

// ---- slid back and forth, button held
await p.mouse.move(b.x + b.w * 0.15, b.y);
await p.mouse.down();
const slide = await record(p, async () => {
  const path = [];
  for (let k = 0; k <= 80; k++) path.push(0.15 + 0.75 * k / 80);            // to 90 %
  for (let k = 0; k <= 60; k++) path.push(0.9 - 0.6 * k / 60);              // back to 30 %
  for (const f of path) { await p.mouse.move(b.x + b.w * f, b.y); await p.waitForTimeout(25); }
});
const moving = slide.frames.filter((r) => r.hold);
const ts = moving.map((r) => r.t), dur = (await state(p)).dur;
check('slid: the car followed the pointer across the lap', Math.max(...ts) > dur * 0.85 && Math.min(...ts.slice(-10)) < dur * 0.35, `${f1(Math.min(...ts))} to ${f1(Math.max(...ts))} s`);
const far = moving.filter((r) => r.cam > 15 || r.behind > -3);
check('slid: the camera stayed behind the car every frame', far.length === 0, far.length ? `${far.length} frames off, e.g. ${f1(far[0].cam)} m` : `${moving.length} frames`);
check('slid: the car was not heard', moving.every((r) => !r.live));
const fx = new Set(moving.filter((r) => r.scrub).map((r) => `${f1(r.fx)},${f1(r.fz)}`));
check('slid: the map stayed streamed in where it was', fx.size === 1 && moving.filter((r) => r.scrub).length > moving.length * 0.8, `${fx.size} spots, ${moving.filter((r) => r.scrub).length} of ${moving.length} frames held`);
check('slid: no building work queued', slide.jobs.length === 0, slide.jobs.slice(0, 8).join(', '));
check('slid: no map piece or ground picture started loading', slide.l1.sectors <= slide.l0.sectors && slide.l1.ground <= slide.l0.ground && slide.l1.ready === slide.l0.ready,
  `map pieces loading ${slide.l0.sectors} -> ${slide.l1.sectors}, ready ${slide.l0.ready} -> ${slide.l1.ready}, ground pictures ${slide.l0.ground} -> ${slide.l1.ground}`);
// (those still coming in round the spot the map stays streamed at may go on arriving: none round the still frames)
check('slid: no parked car put down round the still frames', slide.parked.far < 520 + 60 + 1, `${slide.parked.n} put down meanwhile, the furthest ${f1(slide.parked.far)} m from where the map is streamed`);
const dPlay = play.frames.map((r) => r.dt), dSlide = moving.map((r) => r.dt);
console.log(`     frames playing: median ${f1(pct(dPlay, 0.5))} ms, 95th ${f1(pct(dPlay, 0.95))}, longest ${f1(Math.max(...dPlay))}; page busy over 50 ms: ${play.long.length}${play.long.length ? ` (longest ${f1(Math.max(...play.long))})` : ''}`);
console.log(`     frames sliding: median ${f1(pct(dSlide, 0.5))} ms, 95th ${f1(pct(dSlide, 0.95))}, longest ${f1(Math.max(...dSlide))}; page busy over 50 ms: ${slide.long.length}${slide.long.length ? ` (longest ${f1(Math.max(...slide.long))})` : ''}`);
check('slid: frames no longer than while playing', pct(dSlide, 0.95) <= pct(dPlay, 0.95) * 1.25 + 4 && Math.max(...dSlide) <= Math.max(Math.max(...dPlay) * 1.5, 50), `95th ${f1(pct(dSlide, 0.95))} vs ${f1(pct(dPlay, 0.95))} ms`);
await shot(p, 'scrub-1280-slid');

// ---- let go: plays on from there
const g0 = await state(p);
await p.mouse.up();
await p.waitForTimeout(2000);
const g1 = await state(p);
check('let go: the lap plays on from that moment', !g1.hold && g1.t > g0.t + 0.8 && g1.t < g0.t + 3, `${f1(g0.t)} -> ${f1(g1.t)} s, ${g1.st}`);
check('let go: heard again', g1.live);

// ---- held still on one spot: the map comes in round the car there
await p.mouse.move(b.x + b.w * 0.6, b.y);
await p.mouse.down();
await p.waitForTimeout(150);
const r0 = await p.evaluate(() => ({ s: __game.watch().scrubbing, f: { ...__game.watch().focus } }));
await p.waitForTimeout(800);
const r1 = await p.evaluate(() => { const o = __game.mp().replay.pose; return { s: __game.watch().scrubbing, f: { ...__game.watch().focus }, x: o[0], z: o[1] }; });
check('held still: the map is streamed in round the still frame', r0.s && !r1.s && Math.hypot(r1.f.x - r1.x, r1.f.z - r1.z) < 1, `${f1(Math.hypot(r0.f.x - r1.x, r0.f.z - r1.z))} m -> ${f1(Math.hypot(r1.f.x - r1.x, r1.f.z - r1.z))} m`);
await p.mouse.up();

// ---- a finger: the same with touch pointer events
const touch = async (type, f) => p.evaluate(([type, f]) => {
  const el = document.querySelector('#watch .scrub .rail'), r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + r.width * f, clientY: r.top + r.height / 2, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1 }));
}, [type, f]);
await touch('pointerdown', 0.4);
await touch('pointermove', 0.45);
await touch('pointermove', 0.5);
await p.waitForTimeout(300);
const t0 = await state(p);
check('a finger: held, still at the moment under it', t0.hold && Math.abs(t0.t - t0.dur * 0.5) < t0.dur * 0.01, `${f1(t0.t)} s`);
await touch('pointerup', 0.5);
await p.waitForTimeout(1200);
const t1 = await state(p);
check('a finger: let go, plays on', !t1.hold && t1.t > t0.t + 0.5, `${f1(t0.t)} -> ${f1(t1.t)} s`);

// ---- to the end and let go: finished as before
await p.mouse.move(b.x + b.w * 0.5, b.y);
await p.mouse.down();
await p.mouse.move(b.x + b.w + 30, b.y, { steps: 5 });
await p.waitForTimeout(3500);
const e0 = await state(p);
check('held at the end: the replay waits there', e0 && e0.active && e0.hold && e0.t === e0.dur, e0 ? `${f1(e0.t)} s` : 'gone');
await p.mouse.up();
await p.waitForTimeout(3600);
const e1 = await p.evaluate(() => ({ active: __game.watch().active, replay: !!__game.mp().replay }));
check('let go at the end: the replay finishes and the camera comes back', !e1.active && !e1.replay);
await p.close();

// ---- the slider's place in smaller windows
for (const [w, h] of [[844, 390], [800, 304]]) {
  const q = await open(w, h);
  await q.evaluate(([t, c]) => __game.watchReplay(t, c), [TRACK, CAR]);
  await q.waitForFunction(() => document.querySelector('#watch .scrub.ready'), null, { timeout: 120000 });
  await q.waitForTimeout(800);
  const lay = await q.evaluate(() => {
    const box = (sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
    const sc = box('#watch .scrub'), bar = box('#watch .scrub .rail');
    const hit = (o) => o && sc && o.l < sc.r && o.r > sc.l && o.t < sc.b && o.b > sc.t;
    const others = ['#minimap', '#dash', '#street', '#carname', '#topbar', '#people', '#trackpills'].map((s) => [s, box(s)]).filter(([, o]) => o);
    return { sc, bar, over: others.filter(([, o]) => hit(o)).map(([s]) => s), W: innerWidth };
  });
  check(`${w}x${h}: the slider fits, clear of the HUD`, lay.sc && lay.sc.l >= 0 && lay.sc.r <= lay.W && lay.bar.r - lay.bar.l >= 120 && lay.over.length === 0,
    `bar ${f1(lay.bar.r - lay.bar.l)} px wide, ${f1(lay.bar.b - lay.bar.t)} px tall${lay.over.length ? `, over ${lay.over.join(' ')}` : ''}`);
  await shot(q, `scrub-${w}x${h}`);
  await q.close();
}

await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
