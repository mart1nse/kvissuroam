// Anonymous game stats (see worker/stats.js for what the server keeps, and /stats for the page).
//
// The game counts a few things as it runs (seconds in the menu and driving, km, cars, laps, where on
// the map, frame rate ...) and sends what changed every five minutes and when the page is hidden or
// closed. Nothing identifies the player: no name, no ID, no cookie. Only on www.linnaring.com, and
// never from the automated test runs; ?stats=1 sends from any address (for trying it locally).

const HEAT = 250;                // heat map squares, metres (the same as HEAT in worker/stats.js)

const params = new URLSearchParams(location.search);
// (never in stealth mode, ?off=100: see net/stealth.js)
const on = params.get('off') !== '100' && (params.get('stats') === '1' || (location.hostname === 'www.linnaring.com' && !navigator.webdriver && params.get('stats') !== '0'));
const EVERY = 300000;

const fresh = () => ({ v: 1, menu: 0, drive: 0, km: 0, car: {}, inp: {}, view: {}, gfx: {}, fps: {}, heat: {}, laps: {}, quit: {}, lapCar: {}, lapTry: {}, smash: {}, misc: {}, trouble: {}, death: {}, frz: {}, hit: {}, hitT: {}, stage: {}, stageCar: {}, runT: {}, runKm: {}, ad: {}, err: [] });
let b = fresh();
let first = null, sent = 0, loadMs = 0, loaded = false, drove = false, peak = 0, lapCp = -1, dev = '', wallAt = 0, perfAt = 0, driveAt = 0, frzN = 0, hitN = 0, onStage = false;
const once = new Set();
const errSeen = new Set();

const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };

function device(isTouch) {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS'
    : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS' : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'other';
  const br = /SamsungBrowser/.test(ua) ? 'Samsung' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'other';
  const short = Math.min(screen.width, screen.height);
  const dev = !isTouch ? 'desktop' : short >= 600 ? 'tablet' : 'phone';
  const l = (navigator.language || '').slice(0, 2).toLowerCase();
  const lang = ['et', 'en', 'ru', 'fi', 'lv', 'de'].includes(l) ? l : 'other';
  return { dev, os, br, lang };
}

const empty = (o) => !first && !o.menu && !o.drive && !o.err.length
  && ['laps', 'smash', 'misc', 'death', 'frz', 'stage', 'ad'].every((k) => !Object.keys(o[k]).length)
  && !(loadMs && !once.has('load')) && !(loaded && !once.has('loaded')) && !(drove && !once.has('drove'));

function send(leaving = false, closing = false) {
  if (!on) return;
  // a lap still running as the page closes was given up
  if (closing && lapCp >= 0) { stats.lap('quit', lapCp); lapCp = -1; }
  if (closing && onStage) { inc(b.stage, 'x:quit'); onStage = false; }
  if (empty(b)) return;
  const out = b;
  b = fresh();
  if (first) { out.first = first; }
  if (loadMs && !once.has('load')) { out.load = loadMs; }
  if (loaded && !once.has('loaded')) out.loaded = true;
  if (drove && !once.has('drove')) out.drove = true;
  if (peak) out.peak = peak;
  out.dev = dev;
  out.km = Math.round(out.km * 100) / 100;
  for (const k of ['menu', 'drive']) out[k] = Math.round(out[k] * 10) / 10;
  for (const k of ['car', 'inp', 'view', 'gfx', 'fps', 'heat', 'hitT', 'runT', 'ad']) for (const [kk, v] of Object.entries(out[k])) out[k][kk] = Math.round(v * 10) / 10;
  for (const [kk, v] of Object.entries(out.runKm)) out.runKm[kk] = Math.round(v * 100) / 100;
  const body = JSON.stringify(out);
  sent = performance.now();
  const ok = () => {
    first = null;
    if (out.load) once.add('load');
    if (out.loaded) once.add('loaded');
    if (out.drove) once.add('drove');
  };
  // (keepalive lets the last bundle go out as the page closes)
  try {
    fetch('/api/stats', { method: 'POST', body, keepalive: leaving && body.length < 60000, headers: { 'content-type': 'application/json' } })
      .then((r) => { if (r.ok) ok(); else if (r.status !== 429 && r.status !== 400) putBack(out); }, () => putBack(out));
    if (leaving) ok();     // (the page may be gone before the answer comes)
  } catch { putBack(out); }
}
// a bundle that did not get through goes out with the next one
function putBack(o) {
  for (const k of ['menu', 'drive', 'km']) b[k] += o[k] || 0;
  for (const k of ['car', 'inp', 'view', 'gfx', 'fps', 'heat', 'laps', 'quit', 'lapCar', 'lapTry', 'smash', 'misc', 'trouble', 'death', 'frz', 'hit', 'hitT', 'stage', 'stageCar', 'runT', 'runKm', 'ad']) for (const [kk, v] of Object.entries(o[k] || {})) inc(b[k], kk, v);
  b.err.push(...(o.err || []));
}

// ---- What a freeze was (Martin 2026-11-24: 41 in 100 phone drivers froze for 1 s or more, and the test
// drives, headless on a fast machine, never see over 0.1 s). For each felt freeze of 1 s or more (up to 8 a
// visit) the bundle's `frz` counts a few plain facts, each as "device:kind:value", so /stats can show what
// most freezes had in common:
//   why  game:build | game:draw | game:other  the game's own frame code took most of the gap (queued building,
//                                             handing the picture to the graphics card, the rest)
//        page:<what>                          the page's thread was busy outside the game's frame: loading
//                                             callbacks, network, garbage collection (Chrome names the caller)
//        paint                                the page's thread was free and still no picture came: the
//                                             graphics card (or the phone itself) held it
//   new  shaders | pictures | none            what the frame before the gap sent to the graphics card first
//   kpc  yes | no                           the browser can build shaders aside and say when they are done
//   gc   yes                                  script memory fell by over 30 MB across the gap (Chrome only)
//   os, mem (GB), lvl (graphics level), on (others online), t (since DRIVE), len, do (free, hotlap, race,
//   stage), kmh, at (the 250 m square)
// The page's thread is watched by a timer every 100 ms that does nothing but note the time: a gap between
// its ticks as long as the freeze means the thread was busy. Nothing of it runs while stats are off.
const beat = new Float64Array(64);
let beatI = 0;
if (on) setInterval(() => { beat[beatI++ & 63] = performance.now(); }, 100);
// the longest stretch with no tick between a and b (a and b count as ticks: the frames around the gap)
function beatGap(a, b) {
  const t = [];
  for (const x of beat) if (x > a && x < b) t.push(x);
  t.sort((p, q) => p - q);
  let prev = a, most = 0;
  for (const x of [...t, b]) { most = Math.max(most, x - prev); prev = x; }
  return most;
}
// Chrome 123 and later: the long animation frames and which script call took them (no names of the game's
// own functions survive the build, but the kind of call does: a fetch's answer, a worker's message ...)
// (the observer hears of a long frame a moment after it, so the freeze is written down a second later)
const loaf = [];
let loafObs = null;
const keep = (l) => { for (const e of l) { loaf.push(e); if (loaf.length > 30) loaf.shift(); } };
if (on) try {
  loafObs = new PerformanceObserver((l) => keep(l.getEntries()));
  loafObs.observe({ type: 'long-animation-frame', buffered: false });
} catch { loafObs = null; /* not this browser */ }
function caller(a, b) {
  if (loafObs) keep(loafObs.takeRecords());
  let best = null;
  for (const e of loaf) {
    if (e.startTime + e.duration < a || e.startTime > b) continue;
    for (const sc of e.scripts || []) if (sc.invoker !== 'FrameRequestCallback' && (!best || sc.duration > best.duration)) best = sc;
  }
  if (!best || best.duration < 200) return '?';
  const inv = String(best.invoker || '');
  // (a URL says only "a script file": keep the kind of call)
  const name = /^https?:/.test(inv) ? best.invokerType : inv;
  return String(name || best.invokerType || '?').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 40) || '?';
}
const bucket = (v, cuts, names) => { for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return names[i]; return names[cuts.length]; };
function freeze(s, ms) {
  const f = s.fz || {}, from = s.from || 0, now = performance.now();
  const busy = beatGap(from, now);
  let why;
  if (f.js >= ms * 0.5) why = f.build >= f.draw && f.build >= f.js * 0.4 ? 'game:build' : f.draw >= f.js * 0.4 ? 'game:draw' : 'game:other';
  else if (busy >= Math.max(400, ms * 0.5)) why = 'page';
  else why = 'paint';
  const heap = performance.memory?.usedJSHeapSize;
  const os = first?.os || device(true).os;
  const dm = navigator.deviceMemory > 0 ? String(navigator.deviceMemory) : '?';
  const since = driveAt ? (now - driveAt) / 1000 : 0;
  const facts = {
    why,
    new: f.progs > 0 ? 'shaders' : f.tex > 0 ? 'pictures' : 'none',
    kpc: f.kpc ? 'yes' : 'no',
    os, mem: dm, lvl: String(s.gfx ?? '?'),
    on: bucket(s.others || 0, [1, 10, 30], ['0', '1-9', '10-29', '30+']),
    t: bucket(since, [30, 120, 600], ['<30s', '30s-2m', '2-10m', '10m+']),
    len: bucket(ms / 1000, [3, 10], ['1-3s', '3-10s', '10s+']),
    do: s.doing || 'free',
    kmh: bucket(s.kmh || 0, [5, 50], ['<5', '5-50', '50+']),
    at: `${Math.floor(s.x / HEAT)},${Math.floor(s.z / HEAT)}`,
  };
  if (heap && f.heap && f.heap - heap > 30e6) facts.gc = 'yes';
  setTimeout(() => {
    if (why === 'page') facts.why = `page:${caller(from, now)}`;
    for (const [k, v] of Object.entries(facts)) inc(b.frz, `${dev || 'other'}:${k}:${v}`);
  }, 1000);
}

// ---- Short hitches while driving (src/hitches.js; Martin 2026-11-25: stutters with 85 to 95 online that the
// frame times on his screen did not show, and that no headless test drive can feel). Each late frame while
// plain driving (up to 60 a visit) counts as "device:kind:value" in the bundle's `hit`:
//   why  build | draw | online | game | card | page:net | page:car | page:sound   what the frame before was busy with
//   new  shaders | pictures | car | none      what that frame sent to the graphics card first
//   len (ms), on (others online), t (since DRIVE or since the car was last put somewhere)
// and `hitT` the seconds of such driving per "device:others online", so /stats can say hitches per 10 minutes
// alone and in a crowd. `hitT`'s "device:uneven" is the part of those seconds with an uneven frame rate (four
// or more of the last 120 frames late: not counted as single hitches since 26 Nov 2026).
const crowd = (n) => bucket(n || 0, [1, 10, 30, 60], ['0', '1-9', '10-29', '30-59', '60+']);
function hitch(h) {
  const d = dev || 'other';
  if (hitN++ >= 60) return;
  const facts = {
    why: h.why, new: h.news, on: crowd(h.others),
    len: bucket(h.ms, [50, 100, 250], ['<50', '50-100', '100-250', '250+']),
    t: bucket(h.since, [30, 120, 600], ['<30s', '30s-2m', '2-10m', '10m+']),
  };
  for (const [k, v] of Object.entries(facts)) inc(b.hit, `${d}:${k}:${v}`);
}

let fpsT = 0, fpsN = 0;
export const stats = {
  on,
  // a short hitch while driving (src/hitches.js)
  hitch(h) { if (on) try { hitch(h); } catch { /* never in the way of the game */ } },
  // once, at the start: what kind of device this is
  start({ isTouch, lite, software, death }) {
    if (!on) return;
    let ret = false, crash = '';
    try {
      ret = !!(localStorage.getItem('kvissuroam.name') || localStorage.getItem('kvissuroam.car'));
      // The page was open in this tab and never closed properly: it crashed, and this is the page
      // loading again (a phone out of memory reloads it by itself; after a desktop's "Aw, Snap" the
      // player reloads it). The flag says where the game was then: loading, garage or driving.
      const was = sessionStorage.getItem('kvissuroam.alive');
      crash = was === '1' ? 'drive' : ['load', 'menu', 'drive'].includes(was) ? was : '';
    } catch { /* storage blocked */ }
    first = { ...device(isTouch), ret, crash, lite: !!lite, sw: !!software };
    dev = first.dev;
    // The graphics crash guard found that the last visit died on screen (src/quality.js): one line of
    // clues, so /stats can tell a phone out of memory from a page killed for something else (Martin
    // 2026-11-24). 'tab': the guard saw it but this tab did not (opened afresh after the death).
    if (death) {
      const dm = navigator.deviceMemory > 0 ? String(navigator.deviceMemory) : '?';
      const t = death.s == null ? '?' : death.s < 60 ? '<1' : death.s < 300 ? '1-5' : death.s < 900 ? '5-15' : '15+';
      const h = death.heap == null ? '?' : death.heap < 200 ? '<200' : death.heap < 400 ? '200-400' : death.heap < 700 ? '400-700' : '700+';
      const x = death.tex == null ? '?' : death.tex < 150 ? '<150' : death.tex < 300 ? '150-300' : death.tex < 500 ? '300-500' : '500+';
      inc(b.death, [first.dev, first.os, `m${dm}`, `L${death.level + 1}`, `c${death.cap + 1}`, crash || 'tab', `t${t}`, `h${h}`, `x${x}`].join('|'));
    }
    this.phase('load');
    addEventListener('error', (e) => this.error(`${e.message || 'error'}${e.filename ? ` @ ${e.filename}:${e.lineno}` : ''}`));
    addEventListener('unhandledrejection', (e) => this.error(`promise: ${e.reason?.message || e.reason}`));
    addEventListener('pagehide', () => { try { sessionStorage.removeItem('kvissuroam.alive'); } catch {} send(true, true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) send(true); });
    setTimeout(() => send(), 20000);
    setInterval(() => { if (!document.hidden && performance.now() - sent > EVERY - 1000) send(); }, 30000);
  },
  // where the game is, kept in the tab for the crash check above (cleared when the page closes properly)
  phase(p) { if (on) try { sessionStorage.setItem('kvissuroam.alive', p); } catch {} },
  ready() { if (on && !loaded) { loaded = true; loadMs = Math.round(performance.now()); this.phase('menu'); } },
  drive() {
    if (!on) return;
    inc(b.misc, 'drives');
    drove = true;
    driveAt = performance.now();
    this.phase('drive');
  },
  // something went wrong: glLost (the browser took the 3D picture away), frz1 and frz3 (froze 1 or 3 s while driving)
  trouble(k) { if (on) inc(b.trouble, k); },
  count(k, n = 1) { if (on) inc(b.misc, k, n); },
  // an advert in the world seen (src/adviews.js), by its id: 'wb:v' a view, 'wb:s' seconds on screen, 'wb:u' the first view of
  // a visit, 'wb:c' a tap that opened its site
  ad(k, n = 1) { if (on) inc(b.ad, k, n); },
  smash(k, n = 1) { if (on && n > 0) inc(b.smash, k, n); },
  // The Toomemägi lap (src/race/race.js onEvent, through main.js). In the bundle's `laps`: start (the lap clock started
  // at the line on Küüni), finish, missed (over the line with a checkpoint missed), off and cut (the lap's rules: off the
  // track; a short cut or the wrong way), jump (the car moved in one go: START or H, the map, the garage), reset
  // (another car, or watching someone), quit (the page closed mid-lap); `lapCar` the finishes per car; `quit` how many
  // checkpoints a lap ended without a finish had passed. From 27 Nov 2026 (Martin: the Majoraadi stage's kind of counts
  // for the lap too): cp1 (a lap reached its first checkpoint) with `lapTry` the same per car (and <car>:f its finishes,
  // so the two start together and a car's finish rate holds over any period), j:<why> beside each jump
  // (home: START, H or the TOOMEMÄGI button; map; garage; other), r (R in a lap: it goes on from the spot) and crash
  // (a hard crash in a lap, +5 s). extra: the car for finish and cp1, else the checkpoints passed.
  lap(k, extra, why) {
    if (!on) return;
    inc(b.laps, k);
    if (k === 'finish' && extra) { inc(b.lapCar, extra); inc(b.lapTry, `${extra}:f`); }
    if (k === 'cp1' && extra) inc(b.lapTry, extra);
    if (k === 'jump' && why) inc(b.laps, `j:${why}`);
    if ((k === 'off' || k === 'cut' || k === 'jump' || k === 'reset' || k === 'quit') && extra != null) inc(b.quit, String(Math.min(6, extra)));
  },
  // The Majoraadi stage (src/race/raadi.js onRun; Martin 2026-11-26, at its launch: "Make sure stats start coming
  // through"). In the bundle's `stage`: line (put on the start line, the lights counting), start (green), finish,
  // x:<why> for a run that ended without a finish (the stage's rules: cut, off, wrong, corner; the player: garage,
  // race, moved (the map, a jump), restart (H or the pill: back on the line), quit (the page closed); lights: left
  // before green), reset (R in a run), crash (a hard crash in a run), and for each finished run its tyres
  // (ty:gravel, ty:road) and penalty seconds in steps (pen:0, pen:1-4, pen:5-9, pen:10+); `stageCar` the finishes
  // per car. The times themselves are on the lap board.
  stage(k, x) {
    if (!on) return;
    try {
      // (back on the line in the middle of a run, H or the pill: that run was given up for a new one)
      if (k === 'line' && onStage) { inc(b.stage, 'x:restart'); onStage = false; }
      if (k === 'line' || k === 'reset' || k === 'crash') { inc(b.stage, k); return; }
      if (k === 'start') { inc(b.stage, 'start'); onStage = true; return; }
      if (k === 'finish') {
        onStage = false;
        inc(b.stage, 'finish');
        if (x?.car) inc(b.stageCar, x.car);
        inc(b.stage, `ty:${x?.ty === 'gravel' ? 'gravel' : 'road'}`);
        const p = x?.pen || 0;
        inc(b.stage, `pen:${p <= 0 ? '0' : p < 5 ? '1-4' : p < 10 ? '5-9' : '10+'}`);
        return;
      }
      if (k === 'cancel') {
        const w = String(x || '');
        const why = !onStage ? 'lights' : /SHORT CUT/.test(w) ? 'cut' : /OFF THE STAGE/.test(w) ? 'off' : /WRONG WAY/.test(w) ? 'wrong'
          : /MISSED A CORNER/.test(w) ? 'corner' : /GARAGE/.test(w) ? 'garage' : /RACE/.test(w) ? 'race' : 'moved';
        onStage = false;
        inc(b.stage, `x:${why}`);
      }
    } catch { /* never in the way of the game */ }
  },
  error(msg) {
    if (!on || errSeen.size >= 10) return;
    const m = String(msg).slice(0, 200);
    if (errSeen.has(m)) return;
    if (!errSeen.size) inc(b.trouble, 'err');     // (visits with an error)
    errSeen.add(m);
    b.err.push(m);
  },
  // every frame. s: { mode, dt, raw, felt, car, x, z, kmh, inp, view, gfx, others, lapCp, from, fz, doing, run }
  // (from: when the frame before began; fz: what that frame did, see freeze() above; doing: free, hotlap, race, stage;
  // run: what is on the clock, '' for nothing: stage (a Majoraadi run from green), lap (a Toomemägi lap), race (a lap of
  // an online race), whose seconds and km go into `runT` and `runKm`, from 27 Nov 2026: Martin, "add hours and km driven")
  // (lapCp: checkpoints passed on the running lap, -1 when no lap is running)
  frame(s) {
    if (!on || document.hidden) return;
    lapCp = s.lapCp ?? -1;
    // (the frame's real length: the game's own step is capped, which would undercount slow devices)
    const dt = Math.min(s.raw, 1);
    // A freeze a player feels: one picture took 1 s (3 s) or more while driving, the window in front and
    // nothing else going on (felt: see quietAt in main.js; not the garage, GETTING READY, a map jump, the
    // map or options open). Counted once a visit: the page shows visits that drove with such a freeze.
    // (Until 23 Nov 2026 every frame of 3 s anywhere but the loading screen was counted, as "stall": the
    // garage's first pictures, GETTING READY and other windows in front made most of them.)
    // The game's clock and the wall clock drifting apart over a frame: a computer that slept, not a freeze.
    const wall = Date.now(), now = performance.now(), drift = Math.abs((wall - wallAt) - (now - perfAt));
    wallAt = wall; perfAt = now;
    if (s.felt && s.raw >= 1 && s.raw < 60 && drift < 500) {
      for (const [k, t] of [['frz1', 1], ['frz3', 3]]) if (s.raw >= t && !once.has(k)) { once.add(k); inc(b.trouble, k); }
      if (frzN < 8) { frzN++; try { freeze(s, s.raw * 1000); } catch { /* never in the way of the game */ } }
    }
    if (s.mode === 'menu') { b.menu += dt; return; }
    if (s.mode !== 'drive') return;
    b.drive += dt;
    if (s.felt && s.raw < 1) inc(b.hitT, `${dev || 'other'}:${crowd(s.others)}`, dt);
    if (s.felt && s.raw < 1 && s.uneven) inc(b.hitT, `${dev || 'other'}:uneven`, dt);
    inc(b.car, s.car, dt);
    inc(b.inp, s.inp, dt);
    inc(b.view, s.view, dt);
    inc(b.gfx, String(s.gfx), dt);
    inc(b.heat, `${Math.floor(s.x / HEAT)},${Math.floor(s.z / HEAT)}`, dt);
    b.km += s.kmh / 3600 * dt;
    if (s.run) { inc(b.runT, s.run, dt); inc(b.runKm, s.run, s.kmh / 3600 * dt); }
    for (const v of [100, 150, 200, 250]) if (s.kmh >= v && !once.has(`v${v}`)) { once.add(`v${v}`); inc(b.misc, `speed${v}`); }
    if (s.others > 0) {
      peak = Math.max(peak, s.others + 1);
      if (!once.has('mp')) { once.add('mp'); inc(b.misc, 'mp'); }
    }
    // frame rate, judged a second at a time
    fpsT += dt; fpsN++;
    if (fpsT >= 1) {
      const f = fpsN / fpsT;
      inc(b.fps, f < 20 ? '<20' : f < 30 ? '20-30' : f < 45 ? '30-45' : f < 58 ? '45-60' : '60+', fpsT);
      fpsT = 0; fpsN = 0;
    }
  },
};
