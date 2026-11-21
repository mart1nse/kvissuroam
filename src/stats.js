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

const fresh = () => ({ v: 1, menu: 0, drive: 0, km: 0, car: {}, inp: {}, view: {}, gfx: {}, fps: {}, heat: {}, laps: {}, quit: {}, lapCar: {}, smash: {}, misc: {}, trouble: {}, err: [] });
let b = fresh();
let first = null, sent = 0, loadMs = 0, loaded = false, drove = false, peak = 0, lapCp = -1, dev = '', shownAt = 0;
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
  && ['laps', 'smash', 'misc'].every((k) => !Object.keys(o[k]).length)
  && !(loadMs && !once.has('load')) && !(loaded && !once.has('loaded')) && !(drove && !once.has('drove'));

function send(leaving = false, closing = false) {
  if (!on) return;
  // a lap still running as the page closes was given up
  if (closing && lapCp >= 0) { stats.lap('quit', lapCp); lapCp = -1; }
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
  for (const k of ['car', 'inp', 'view', 'gfx', 'fps', 'heat']) for (const [kk, v] of Object.entries(out[k])) out[k][kk] = Math.round(v * 10) / 10;
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
  for (const k of ['car', 'inp', 'view', 'gfx', 'fps', 'heat', 'laps', 'quit', 'lapCar', 'smash', 'misc', 'trouble']) for (const [kk, v] of Object.entries(o[k] || {})) inc(b[k], kk, v);
  b.err.push(...(o.err || []));
}

let fpsT = 0, fpsN = 0;
export const stats = {
  on,
  // once, at the start: what kind of device this is
  start({ isTouch, lite, software }) {
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
    this.phase('load');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) shownAt = performance.now(); });
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
    this.phase('drive');
  },
  // something went wrong: glLost (the browser took the 3D picture away), stall (the game froze 3 s or more)
  trouble(k) { if (on) inc(b.trouble, k); },
  count(k, n = 1) { if (on) inc(b.misc, k, n); },
  smash(k, n = 1) { if (on && n > 0) inc(b.smash, k, n); },
  lap(k, extra) {
    if (!on) return;
    inc(b.laps, k);
    if (k === 'finish' && extra) inc(b.lapCar, extra);
    if ((k === 'off' || k === 'jump' || k === 'reset' || k === 'quit') && extra != null) inc(b.quit, String(Math.min(6, extra)));
  },
  error(msg) {
    if (!on || errSeen.size >= 10) return;
    const m = String(msg).slice(0, 200);
    if (errSeen.has(m)) return;
    if (!errSeen.size) inc(b.trouble, 'err');     // (visits with an error)
    errSeen.add(m);
    b.err.push(m);
  },
  // every frame. s: { mode, dt, raw, car, x, z, kmh, inp, view, gfx, others, lapCp }
  // (lapCp: checkpoints passed on the running lap, -1 when no lap is running)
  frame(s) {
    if (!on || document.hidden) return;
    lapCp = s.lapCp ?? -1;
    // (the frame's real length: the game's own step is capped, which would undercount slow devices)
    const dt = Math.min(s.raw, 1);
    // a frame of 3 s or more while the page was in view (not the first after coming back to it)
    if (s.raw >= 3 && s.mode !== 'loading' && performance.now() - shownAt > s.raw * 1000 + 500) inc(b.trouble, 'stall');
    if (s.mode === 'menu') { b.menu += dt; return; }
    if (s.mode !== 'drive') return;
    b.drive += dt;
    inc(b.car, s.car, dt);
    inc(b.inp, s.inp, dt);
    inc(b.view, s.view, dt);
    inc(b.gfx, String(s.gfx), dt);
    inc(b.heat, `${Math.floor(s.x / HEAT)},${Math.floor(s.z / HEAT)}`, dt);
    b.km += s.kmh / 3600 * dt;
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
