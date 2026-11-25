// Game stats: anonymous daily totals of how LINNARING is played (Martin's ask, 2026-11-20).
//
// Each open game sends a small bundle (POST /api/stats) about every five minutes and when it is
// closed or hidden: what changed since its last bundle (seconds driven, km, laps, cars, where on the
// map ...) and, in its first bundle only, what kind of device it is. Nothing is kept per visitor:
// the bundle is added into one row of totals for the day (Tartu time) and then forgotten, so there
// are no names, addresses, cookies or IDs to keep or leak. GET /api/stats?days=30 gives the totals
// of the last days added together, for the open page at /stats (public/stats.html).
// Each bundle also goes into a row of totals for its hour (UTC), kept two days, so that
// GET /api/stats?hours=24 gives a rolling last 24 hours (Martin 2026-11-24: "24 h", not since midnight).
//
// One bundle is one row written, far inside the free plan's 100,000 a day. Everything in a bundle is
// checked against fixed lists and limits, because anyone can post one: a made-up bundle can at worst
// add a few minutes to a day's totals.
import { DurableObject } from 'cloudflare:workers';
import { CARS } from '../src/cars/specs.js';

export const HEAT = 250;                       // heat map squares, metres
const KEEP_DAYS = 400;
const KEEP_HOURS = 48;
const HOUR = 3600000;
const hourKey = (t = Date.now()) => new Date(Math.floor(t / HOUR) * HOUR).toISOString().slice(0, 13);   // '2026-11-24T08', UTC
const tartuDay = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(d);
const tartuHour = (d = new Date()) => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tallinn', hour: '2-digit', hourCycle: 'h23' }).format(d);

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});

// what each part of a bundle may hold: allowed keys and the most one bundle may add to one key
const LIST = (...k) => (s) => k.includes(s);
const SEC = 400, KM = 60, N = 40;
const FIRST = {
  dev: LIST('desktop', 'phone', 'tablet'),
  os: LIST('Windows', 'macOS', 'iOS', 'Android', 'Linux', 'ChromeOS', 'other'),
  br: LIST('Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung', 'Opera', 'other'),
  lang: LIST('et', 'en', 'ru', 'fi', 'lv', 'de', 'other'),
};
const MAPS = {
  car: [(k) => Object.hasOwn(CARS, k), SEC],
  inp: [LIST('kb', 'pad', 'wheel', 'touch'), SEC],
  view: [LIST('chase', 'drone'), SEC],
  gfx: [(k) => /^(1[0-5]|[0-9])$/.test(k), SEC],
  fps: [LIST('<20', '20-30', '30-45', '45-60', '60+'), SEC],
  heat: [(k) => /^-?\d{1,3},-?\d{1,3}$/.test(k), SEC],
  laps: [LIST('start', 'finish', 'missed', 'off', 'cut', 'jump', 'reset', 'quit'), N],
  quit: [LIST('0', '1', '2', '3', '4', '5', '6'), N],         // checkpoints passed when a lap was given up
  lapCar: [(k) => Object.hasOwn(CARS, k), N],                  // finished laps per car
  smash: [LIST('prop', 'glass'), 200],
  // a page that died on screen, found by the graphics crash guard: device|os|memory GB|level|cap after|
  // where (load, menu, drive; tab: a new tab)|time on screen|script memory MB|pictures on the card (src/stats.js)
  death: [(k) => /^(desktop|phone|tablet)\|(Windows|macOS|iOS|Android|Linux|ChromeOS|other)\|m(\?|0\.25|0\.5|1|2|4|8|16|32)\|L\d{1,2}\|c\d{1,2}\|(load|menu|drive|tab)\|t(\?|<1|1-5|5-15|15\+)\|h(\?|<200|200-400|400-700|700\+)\|x(\?|<150|150-300|300-500|500\+)$/.test(k), 2],
  // what each freeze of 1 s or more while driving had going on (src/stats.js freeze()): "device:kind:value"
  frz: [(k) => /^(desktop|phone|tablet|other):(why:(game:(build|draw|other)|page:[A-Za-z0-9._:-]{1,40}|paint)|new:(shaders|pictures|none)|kpc:(yes|no)|gc:yes|os:(Windows|macOS|iOS|Android|Linux|ChromeOS|other)|mem:(\?|0\.25|0\.5|1|2|4|8|16|32)|lvl:(\?|1[0-5]|[0-9])|on:(0|1-9|10-29|30\+)|t:(<30s|30s-2m|2-10m|10m\+)|len:(1-3s|3-10s|10s\+)|do:(free|hotlap|race|stage)|kmh:(<5|5-50|50\+)|at:-?\d{1,3},-?\d{1,3})$/.test(k), 8],
  // short hitches while driving and what each had going on, and the seconds driven per crowd (src/stats.js hitch())
  hit: [(k) => /^(desktop|phone|tablet|other):(why:(build|draw|online|game|card|page:(net|car))|new:(shaders|pictures|car|none)|len:(<50|50-100|100-250|250\+)|on:(0|1-9|10-29|30-59|60\+)|t:(<30s|30s-2m|2-10m|10m\+)|pace:(0|1-9|10-29|30-59|60\+))$/.test(k), 400],
  hitT: [(k) => /^(desktop|phone|tablet|other):(0|1-9|10-29|30-59|60\+)$/.test(k), SEC],
  misc: [LIST('drives', 'water', 'mapjump', 'garage', 'idle', 'glLost', 'speed100', 'speed150', 'speed200', 'speed250', 'mp'), N],
};
const TIMES = { menu: SEC, drive: SEC, km: KM };

// keep the numbers in a bundle sane: v rounded, between 0 and max
const num = (v, max, dp = 0) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return 0;
  const f = 10 ** dp;
  return Math.round(Math.min(v, max) * f) / f;
};
const add = (o, k, v) => { if (v) o[k] = Math.round(((o[k] || 0) + v) * 1000) / 1000; };
const cleanErr = (s) => String(s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/https?:\/\/[^\s)]+\/([^/\s)?#]+)(\?[^\s)]*)?/g, '$1').slice(0, 160).trim();

// Adds one bundle b into the day's totals t (both plain objects). Returns false if b is no bundle.
export function addBundle(t, b, { country = '', hour = 0 } = {}) {
  if (!b || typeof b !== 'object' || b.v !== 1) return false;
  for (const [k, max] of Object.entries(TIMES)) add(t, k, num(b[k], max, k === 'km' ? 2 : 1));
  for (const [name, [ok, max]] of Object.entries(MAPS)) {
    const src = b[name];
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    const dst = (t[name] ||= {});
    let n = 0;
    for (const [k, v] of Object.entries(src)) {
      if (++n > 120) break;
      if (!ok(k)) continue;
      if (name === 'heat' && !dst[k] && Object.keys(dst).length >= 4000) continue;
      if (name === 'death' && !dst[k] && Object.keys(dst).length >= 300) continue;
      if (name === 'frz' && !dst[k] && Object.keys(dst).length >= 1500) continue;
      add(dst, k, num(v, max, 1));
    }
  }
  if (typeof b.peak === 'number') t.peak = Math.max(t.peak || 0, num(b.peak, 150));
  // trouble per kind of device (crashes, freezes, lost 3D picture, errors): kept as "phone:stall"
  const dev = FIRST.dev(b.dev) ? b.dev : 'other';
  const tr = b.trouble;
  if (tr && typeof tr === 'object' && !Array.isArray(tr)) {
    for (const k of ['glLost', 'stall', 'frz1', 'frz3', 'err', 'cap', 'vpWide']) { const v = num(tr[k], N); if (v) add((t.trouble ||= {}), `${dev}:${k}`, v); }
  }
  // the seconds driven per kind of device (every bundle names its device), for the Devices card on /stats
  // (Martin 2026-11-25: devices by time spent driving, not only by visits)
  const drv = num(b.drive, SEC, 1);
  if (drv) add((t.driveBy ||= {}), dev, drv);
  if (b.loaded === true) { add(t, 'loaded', 1); add((t.loadedBy ||= {}), dev, 1); }
  if (b.drove === true) add((t.droveBy ||= {}), dev, 1);
  if (b.drove === true) add(t, 'drove', 1);
  if (Array.isArray(b.err)) {
    const e = (t.err ||= {});
    for (const m of b.err.slice(0, 5)) {
      if (typeof m !== 'string' || !m) continue;
      const k = cleanErr(m);
      if (k && (e[k] || Object.keys(e).length < 100)) add(e, k, 1);
    }
  }
  const f = b.first;
  if (f && typeof f === 'object') {
    add(t, 'sessions', 1);
    for (const [k, ok] of Object.entries(FIRST)) add((t[k] ||= {}), ok(f[k]) ? f[k] : 'other', 1);
    add((t.ret ||= {}), f.ret === true ? 'back' : 'new', 1);
    if (/^[A-Z]{2}$/.test(country)) add((t.country ||= {}), country, 1);
    add((t.hour ||= {}), String(hour), 1);
    // a crash found as the page loaded again, and where the game was then (true: from the first version)
    const crash = f.crash === true ? 'drive' : ['load', 'menu', 'drive'].includes(f.crash) ? f.crash : '';
    if (crash) { add(t, 'crash', 1); add((t.trouble ||= {}), `${FIRST.dev(f.dev) ? f.dev : 'other'}:crash-${crash}`, 1); }
    if (f.lite === true) add(t, 'lite', 1);
    if (f.sw === true) add(t, 'sw', 1);
  }
  if (typeof b.load === 'number' && b.load > 0) {
    const s = b.load / 1000;
    add((t.load ||= {}), s < 5 ? '<5' : s < 10 ? '5-10' : s < 20 ? '10-20' : s < 40 ? '20-40' : '40+', 1);
  }
  return true;
}

// One online race, or start votes that lapsed, added into the day's totals t.race (Martin 2026-11-22).
// It comes from the lobby (worker/race.js), never from a browser: a race's cars, finish times and
// why racers dropped out, without names. Finish times are the browsers' own, like lap times.
const RACE_OUT = ['off', 'cut', 'jump', 'car', 'start', 'map', 'left', 'time', 'quit', 'restart'];
const RACE_END = ['done', 'time', 'restart', 'empty'];
export const raceSize = (n) => (n <= 3 ? String(n) : n <= 5 ? '4-5' : n <= 9 ? '6-9' : '10+');
export function addRace(t, r, now = Date.now()) {
  if (!r || typeof r !== 'object' || r.v !== 1) return false;
  const R = (t.race ||= {});
  const v = r.votes && typeof r.votes === 'object' ? r.votes : {};
  for (const k of ['start', 'restart', 'lapsed']) { const n = num(v[k], 200); if (n) add((R.votes ||= {}), k, n); }
  if (r.ran === false) add(R, 'cancel', 1);
  if (r.ran !== true || !Array.isArray(r.racers) || !r.racers.length) return true;
  const rs = r.racers.slice(0, 30);
  add(R, 'n', 1);
  add(R, 'racers', rs.length);
  add((R.size ||= {}), raceSize(rs.length), 1);
  add((R.end ||= {}), RACE_END.includes(r.end) ? r.end : 'done', 1);
  const at = typeof r.at === 'number' && Math.abs(r.at - now) < 86400000 ? new Date(r.at) : new Date(now);
  add((R.hour ||= {}), String(tartuHour(at)), 1);
  let win = null;
  for (const x of rs) {
    if (!x || typeof x !== 'object') continue;
    const car = Object.hasOwn(CARS, x.car) ? x.car : null;
    if (car) add((R.car ||= {}), car, 1);
    if (x.late) add(R, 'late', 1);
    const ms = typeof x.ms === 'number' && x.ms >= 30000 && x.ms <= 420000 ? Math.round(x.ms) : null;
    if (ms != null) {
      add(R, 'fin', 1);
      if (x.late) add(R, 'lateFin', 1);
      if (car) {
        add((R.carFin ||= {}), car, 1);
        const best = (t.raceBest ||= {});
        if (!best[car] || ms < best[car]) best[car] = ms;
      }
      if (!win || ms < win.ms) win = { ms, car };
    } else add((R.out ||= {}), RACE_OUT.includes(x.out) ? x.out : 'quit', 1);
  }
  if (win) {
    add(R, 'wins', 1);
    add(R, 'winMs', win.ms);
    if (win.car) add((R.carWin ||= {}), win.car, 1);
  }
  return true;
}

// One minute of the online lobby (worker/index.js loadTick, Martin 2026-11-24: how many would play online
// if the cap let them in): online, of them driving, pages waiting outside after SERVER FULL, and since the
// last minute the refusals, new players turned away, and those who got in after waiting (and how long).
// Kept in t.load as sums over the minutes sampled plus the highest minute; averages divide the sums by
// the minutes of the period (a minute without a sample had nobody driving and nobody waiting).
const LOAD_SUM = ['on', 'drv', 'wait', 'ref', 'away', 'joined', 'waitMs'];
export function addLoad(t, s) {
  if (!s || typeof s !== 'object' || s.v !== 1) return false;
  const L = (t.load ||= {});
  const v = {};
  for (const k of LOAD_SUM) v[k] = num(s[k], k === 'waitMs' ? 86400000 : k === 'ref' ? 100000 : 5000);
  v.tot = v.on + v.wait;
  add(L, 'min', 1);
  for (const k of LOAD_SUM) add(L, k, v[k]);
  if (v.wait || v.ref) add(L, 'full', 1);
  for (const k of ['on', 'drv', 'wait', 'tot']) L[k + 'Max'] = Math.max(L[k + 'Max'] || 0, v[k]);
  if (typeof s.t === 'number') L.t0 = Math.min(L.t0 || Infinity, Math.floor(s.t / 60000) * 60000);
  const cap = num(s.cap, 1000);
  if (cap) L.cap = cap;
  // stealth mode (?off=100, worker/index.js ghostHello): minutes online summed, connections, the most at once, and
  // which pages (player ids, kept per day and hour only to count them; the answer gives the count, never the ids)
  const gh = num(s.gh, 5000), ghc = num(s.ghc, 5000);
  if (gh) { add(L, 'gh', gh); L.ghMax = Math.max(L.ghMax || 0, gh); }
  if (ghc) add(L, 'ghc', ghc);
  if (Array.isArray(s.ghIds)) {
    const ids = (t.ghostIds ||= {});
    for (const id of s.ghIds.slice(0, 200)) if (typeof id === 'string' && /^[\w-]{1,16}$/.test(id) && (ids[id] || Object.keys(ids).length < 1000)) ids[id] = 1;
  }
  return true;
}
const mergeLoad = (d, s) => {
  for (const [k, v] of Object.entries(s)) {
    if (typeof v !== 'number') continue;
    if (k.endsWith('Max')) d[k] = Math.max(d[k] || 0, v);
    else if (k === 't0') d.t0 = Math.min(d.t0 || Infinity, v);
    else if (k === 'cap') d.cap = v;
    else add(d, k, v);
  }
};
// the minutes of a period [from, to) that the load counts cover (none before its first sample)
export const loadSpan = (L, from, to) => (L?.t0 ? Math.max(1, Math.round((to - Math.max(from, L.t0)) / 60000)) : 0);
// when a Tartu day starts (epoch ms)
export const tartuStart = (day) => { const t = Date.parse(day + 'T00:00:00Z'); return t - tartuHour(new Date(t)) * HOUR; };
// the load figures the page shows: averages over the period and the highest minute
export function loadView(L, span) {
  if (!L?.min || !span) return null;
  const avg = (k) => Math.round((L[k] || 0) / span * 10) / 10;
  return {
    min: L.min, span, cap: L.cap || 0,
    on: avg('on'), drv: avg('drv'), wait: avg('wait'), tot: Math.round(((L.on || 0) + (L.wait || 0)) / span * 10) / 10,
    onMax: L.onMax || 0, drvMax: L.drvMax || 0, waitMax: L.waitMax || 0, totMax: L.totMax || 0,
    ref: L.ref || 0, away: L.away || 0, joined: L.joined || 0, waitAvg: L.joined ? Math.round(L.waitMs / L.joined / 1000) : 0,
    full: L.full || 0,          // minutes with somebody waiting outside
    gh: avg('gh'), ghMax: L.ghMax || 0, ghMin: L.gh || 0, ghc: L.ghc || 0,   // stealth: on average, most at once, minutes, connections
  };
}

// several days' totals added together
export function sumDays(rows) {
  const out = {};
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (k === 'peak') dst.peak = Math.max(dst.peak || 0, v);
      else if (k === 'load') mergeLoad((dst.load ||= {}), v);
      else if (k === 'raceBest') { const b = (dst.raceBest ||= {}); for (const [c, ms] of Object.entries(v)) if (!b[c] || ms < b[c]) b[c] = ms; }
      else if (typeof v === 'number') add(dst, k, v);
      else if (v && typeof v === 'object') merge((dst[k] ||= {}), v);
    }
  };
  for (const r of rows) merge(out, r);
  return out;
}

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, data TEXT NOT NULL)');
    const fresh = !this.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'hours'").toArray().length;
    this.sql.exec('CREATE TABLE IF NOT EXISTS hours (hour TEXT PRIMARY KEY, data TEXT NOT NULL)');
    if (fresh) {
      // the hours start now: today's totals so far count as the hour of Tartu midnight, so the
      // 24 h view is whole from the first day and they leave it 24 h after that midnight
      const now = Date.now();
      const row = this.sql.exec('SELECT data FROM days WHERE day = ?', tartuDay(new Date(now))).toArray()[0];
      if (row) this.sql.exec('INSERT INTO hours (hour, data) VALUES (?, ?)', hourKey(Math.floor(now / HOUR) * HOUR - tartuHour(new Date(now)) * HOUR), row.data);
    }
    this.today = null;            // { day, data } kept in memory between bundles
    this.thisHour = null;         // { hour, data }, the same for the hour
    this.rl = new Map();
    this.cache = new Map();       // GET answers, a minute each
  }

  over(key, max, ms) {
    const now = Date.now();
    let r = this.rl.get(key);
    if (!r || now - r.t > ms) { r = { t: now, n: 0 }; this.rl.set(key, r); }
    if (this.rl.size > 5000) for (const [k, v] of this.rl) if (now - v.t > ms) this.rl.delete(k);
    return ++r.n > max;
  }

  dayRow(day) {
    if (this.today?.day !== day) {
      const row = this.sql.exec('SELECT data FROM days WHERE day = ?', day).toArray()[0];
      let data = {};
      try { data = row ? JSON.parse(row.data) : {}; } catch { /* start the day afresh */ }
      this.today = { day, data };
      // a new day: forget days older than KEEP_DAYS
      const old = tartuDay(new Date(Date.now() - KEEP_DAYS * 86400000));
      this.sql.exec('DELETE FROM days WHERE day < ?', old);
    }
    return this.today;
  }

  hourRow(hour) {
    if (this.thisHour?.hour !== hour) {
      const row = this.sql.exec('SELECT data FROM hours WHERE hour = ?', hour).toArray()[0];
      let data = {};
      try { data = row ? JSON.parse(row.data) : {}; } catch { /* start the hour afresh */ }
      this.thisHour = { hour, data };
      this.sql.exec('DELETE FROM hours WHERE hour < ?', hourKey(Date.now() - KEEP_HOURS * HOUR));
    }
    return this.thisHour;
  }

  // adds into the day's and the hour's totals and writes both rows: add(data) returns false for no bundle
  addNow(fn, now = new Date()) {
    const t = this.dayRow(tartuDay(now));
    if (!fn(t.data)) return false;
    const h = this.hourRow(hourKey(now.getTime()));
    fn(h.data);
    this.sql.exec('INSERT INTO days (day, data) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET data = excluded.data', t.day, JSON.stringify(t.data));
    this.sql.exec('INSERT INTO hours (hour, data) VALUES (?, ?) ON CONFLICT (hour) DO UPDATE SET data = excluded.data', h.hour, JSON.stringify(h.data));
    return true;
  }

  // a race from the lobby (worker/index.js raceStat): Durable Object RPC, so no browser can call it
  addRace(r) {
    if (!this.addNow((d) => addRace(d, r))) return false;
    this.cache.clear();
    return true;
  }

  // a minute of the online lobby (worker/index.js loadTick): RPC like addRace
  addLoad(s) {
    const now = typeof s?.t === 'number' && Math.abs(s.t - Date.now()) < 300000 ? new Date(s.t) : new Date();
    return this.addNow((d) => addLoad(d, s), now);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    if (req.method === 'POST') {
      // a game sends one bundle every five minutes; a household or a classroom shares an address
      if (this.over(`p|${ip}`, 60, 600000)) return json({ error: 'too many requests' }, 429);
      const text = await req.text();
      if (text.length > 16000) return json({ error: 'too big' }, 413);
      let b;
      try { b = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
      const now = new Date();
      const opt = { country: req.headers.get('x-country') || '', hour: tartuHour(now) };
      if (!this.addNow((d) => addBundle(d, b, opt), now)) return json({ error: 'bad bundle' }, 400);
      return json({ ok: true });
    }
    if (req.method === 'GET') {
      if (this.over(`g|${ip}`, 60, 60000)) return json({ error: 'too many requests' }, 429);
      // The script errors are not on /stats (Martin 2026-11-24: "not needed there"): ?errors=1 gives only them,
      // for the unlisted page /stats-errors; the stats answer leaves them out
      const errs = !!url.searchParams.get('errors');
      const answer = (body) => {
        if (errs) {
          const e = Object.entries(body.total.err || {}).sort((a, b) => b[1] - a[1]).slice(0, 100);
          return json({ days: body.days, hours: body.hours, from: body.from, to: body.to, visits: body.total.sessions || 0, err: e });
        }
        // (stealth pages: how many different ones, not which)
        const { err, ghostIds, ...total } = body.total;
        return json({ ...body, total: { ...total, ghosts: Object.keys(ghostIds || {}).length } });
      };
      if (url.searchParams.get('hours')) {
        // the last 24 hours: this hour so far and the 23 before it
        const hit = this.cache.get('h24');
        if (hit && Date.now() - hit.at < 60000) return answer(hit.body);
        const from = hourKey(Date.now() - 23 * HOUR);
        const now = Date.now();
        const hrs = this.sql.exec('SELECT hour, data FROM hours WHERE hour >= ? ORDER BY hour', from).toArray()
          .map((r) => { try { return { hour: r.hour, data: JSON.parse(r.data) }; } catch { return { hour: r.hour, data: {} }; } });
        const rows = hrs.map((r) => r.data);
        const names = Object.fromEntries(Object.entries(CARS).map(([id, c]) => [id, c.short || c.name || id]));
        const total = sumDays(rows);
        const t0 = Date.parse(from + ':00:00Z');
        // online demand hour by hour (the hour starts as a UTC hour; the page shows it in Tartu time)
        const hourly = hrs.filter((r) => r.data.load).map((r) => {
          const a = Date.parse(r.hour + ':00:00Z');
          return { at: a, ...loadView(r.data.load, loadSpan(r.data.load, a, Math.min(now, a + HOUR))) };
        });
        // visits hour by hour, the 24 h tab's columns (the other tabs have them per day)
        const visits = hrs.map((r) => ({ at: Date.parse(r.hour + ':00:00Z'), sessions: r.data.sessions || 0, drove: r.data.drove || 0, drive: r.data.drive || 0, laps: r.data.laps?.finish || 0, races: r.data.race?.n || 0 }));
        const body = { days: 1, hours: 24, from: from + ':00Z', to: new Date(now).toISOString(), heat: HEAT, total, daily: [], names,
          load: loadView(total.load, loadSpan(total.load, t0, now)), hourly, visits };
        this.cache.set('h24', { at: Date.now(), body });
        return answer(body);
      }
      const days = Math.max(1, Math.min(KEEP_DAYS, parseInt(url.searchParams.get('days'), 10) || 30));
      const hit = this.cache.get(days);
      if (hit && Date.now() - hit.at < 60000) return answer(hit.body);
      const from = tartuDay(new Date(Date.now() - (days - 1) * 86400000));
      const rows = this.sql.exec('SELECT day, data FROM days WHERE day >= ? ORDER BY day', from).toArray()
        .map((r) => { try { return { day: r.day, data: JSON.parse(r.data) }; } catch { return { day: r.day, data: {} }; } });
      const now = Date.now();
      const daySpan = (day, L) => { const a = tartuStart(day); return loadSpan(L, a, Math.min(now, a + 86400000)); };
      const daily = rows.map((r) => {
        const lv = loadView(r.data.load, daySpan(r.day, r.data.load));
        return { day: r.day, sessions: r.data.sessions || 0, drove: r.data.drove || 0, drive: r.data.drive || 0, laps: r.data.laps?.finish || 0, races: r.data.race?.n || 0, peak: r.data.peak || 0,
          load: lv && { on: lv.on, onMax: lv.onMax, wait: lv.wait, waitMax: lv.waitMax, tot: lv.tot, totMax: lv.totMax, away: lv.away } };
      });
      const names = Object.fromEntries(Object.entries(CARS).map(([id, c]) => [id, c.short || c.name || id]));
      const total = sumDays(rows.map((r) => r.data));
      const body = { days, from, to: tartuDay(), heat: HEAT, total, daily, names, load: loadView(total.load, loadSpan(total.load, tartuStart(from), now)) };
      this.cache.set(days, { at: Date.now(), body });
      return answer(body);
    }
    return json({ error: 'not found' }, 404);
  }
}
