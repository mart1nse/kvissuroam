// Game stats: anonymous daily totals of how LINNARING is played (Martin's ask, 2026-11-20).
//
// Each open game sends a small bundle (POST /api/stats) about every five minutes and when it is
// closed or hidden: what changed since its last bundle (seconds driven, km, laps, cars, where on the
// map ...) and, in its first bundle only, what kind of device it is. Nothing is kept per visitor:
// the bundle is added into one row of totals for the day (Tartu time) and then forgotten, so there
// are no names, addresses, cookies or IDs to keep or leak. GET /api/stats?days=30 gives the totals
// of the last days added together, for the open page at /stats (public/stats.html).
//
// One bundle is one row written, far inside the free plan's 100,000 a day. Everything in a bundle is
// checked against fixed lists and limits, because anyone can post one: a made-up bundle can at worst
// add a few minutes to a day's totals.
import { DurableObject } from 'cloudflare:workers';
import { CARS } from '../src/cars/specs.js';

export const HEAT = 250;                       // heat map squares, metres
const KEEP_DAYS = 400;
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
  misc: [LIST('drives', 'water', 'mapjump', 'garage', 'glLost', 'speed100', 'speed150', 'speed200', 'speed250', 'mp'), N],
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
      add(dst, k, num(v, max, 1));
    }
  }
  if (typeof b.peak === 'number') t.peak = Math.max(t.peak || 0, num(b.peak, 150));
  // trouble per kind of device (crashes, freezes, lost 3D picture, errors): kept as "phone:stall"
  const dev = FIRST.dev(b.dev) ? b.dev : 'other';
  const tr = b.trouble;
  if (tr && typeof tr === 'object' && !Array.isArray(tr)) {
    for (const k of ['glLost', 'stall', 'err', 'cap']) { const v = num(tr[k], N); if (v) add((t.trouble ||= {}), `${dev}:${k}`, v); }
  }
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

// several days' totals added together
export function sumDays(rows) {
  const out = {};
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (k === 'peak') dst.peak = Math.max(dst.peak || 0, v);
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
    this.today = null;            // { day, data } kept in memory between bundles
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
      const t = this.dayRow(tartuDay(now));
      if (!addBundle(t.data, b, { country: req.headers.get('x-country') || '', hour: tartuHour(now) })) return json({ error: 'bad bundle' }, 400);
      this.sql.exec('INSERT INTO days (day, data) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET data = excluded.data', t.day, JSON.stringify(t.data));
      return json({ ok: true });
    }
    if (req.method === 'GET') {
      if (this.over(`g|${ip}`, 60, 60000)) return json({ error: 'too many requests' }, 429);
      const days = Math.max(1, Math.min(KEEP_DAYS, parseInt(url.searchParams.get('days'), 10) || 30));
      const hit = this.cache.get(days);
      if (hit && Date.now() - hit.at < 60000) return json(hit.body);
      const from = tartuDay(new Date(Date.now() - (days - 1) * 86400000));
      const rows = this.sql.exec('SELECT day, data FROM days WHERE day >= ? ORDER BY day', from).toArray()
        .map((r) => { try { return { day: r.day, data: JSON.parse(r.data) }; } catch { return { day: r.day, data: {} }; } });
      const daily = rows.map((r) => ({ day: r.day, sessions: r.data.sessions || 0, drove: r.data.drove || 0, drive: r.data.drive || 0, laps: r.data.laps?.finish || 0, peak: r.data.peak || 0 }));
      const names = Object.fromEntries(Object.entries(CARS).map(([id, c]) => [id, c.short || c.name || id]));
      const body = { days, from, to: tartuDay(), heat: HEAT, total: sumDays(rows.map((r) => r.data)), daily, names };
      this.cache.set(days, { at: Date.now(), body });
      return json(body);
    }
    return json({ error: 'not found' }, 404);
  }
}
