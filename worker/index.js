// LINNARING server: the static game is served as assets; this Worker answers /api/*.
//
// One Durable Object ("lobby") holds everyone who has the game open. Each browser keeps a
// WebSocket to it and sends its car's position about ten times a second while someone else is
// online; the lobby passes positions on to the others and announces joins, leaves and name
// changes. The sockets use the hibernation API, so an idle lobby costs nothing.
//
// Lap times live in the lobby's SQLite storage (table `laps`). GET /api/laps.csv downloads all
// of them; GET /api/board gives the best lap per car, all time and today (Tartu time). The times of
// the Raadi rally stage are kept in the same table (track 'raadi', Martin 23 Nov 2026) and go out in
// the same board, under `raadi`.
//
// Nobody logs in, so everything a browser sends is treated as hostile: see "Limits" and "Lap
// tickets" below for what keeps one visitor from spoiling the board, freezing the other players'
// games or using up the free plan's daily allowance.
import { DurableObject } from 'cloudflare:workers';
import { moved } from './moved.js';
export { Stats } from './stats.js';
import { CARS } from '../src/cars/specs.js';
import { RaceDesk } from './race.js';
import LAP from '../src/race/track.json';
import STAGE from '../src/race/raadi.json';
import { lapGates, throughGate } from '../src/race/lapgates.js';

const TRACK = 'toomemagi';
// The other circuits whose times are kept, with the shortest time that is believed. Raadi's stage is
// 1.73 km of gravel: 45 s would be 138 km/h on average (the lap of Toomemägi, 4.9 km, has 60 s).
const STAGES = { raadi: 45000 };
const cleanTrack = (s) => (typeof s === 'string' && Object.hasOwn(STAGES, s) ? s : TRACK);
const ADJ = ['Neon', 'Chrome', 'Turbo', 'Pastel', 'Laser', 'Sunset', 'Retro', 'Velvet', 'Cosmic', 'Digital', 'Synth', 'Vapor', 'Electric', 'Midnight', 'Magenta', 'Cyber'];
const NOUN = ['Otter', 'Falcon', 'Lynx', 'Comet', 'Dolphin', 'Palm', 'Flamingo', 'Tiger', 'Wave', 'Fox', 'Moose', 'Heron', 'Beaver', 'Hedgehog', 'Stork', 'Badger'];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const tartuDay = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(d);   // YYYY-MM-DD
// A driver name: no control characters or angle brackets, none of the invisible characters that
// reverse or hide text, at most two stacked accents on a letter, 20 characters.
const cleanName = (s) => String(s ?? '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f<>­؜᠎​-‏‪-‮⁠-⁯﻿￹-￻]/g, '')
  .replace(/(\p{M}{2})\p{M}+/gu, '$1')
  .replace(/\s+/g, ' ').trim().slice(0, 20).trim();
// only cars the game has (anything else, such as "constructor", broke the other browsers)
const cleanCar = (s) => (typeof s === 'string' && Object.hasOwn(CARS, s) ? s : '');
const cleanWhere = (w) => (w === 'map' || w === 'garage' || w === 'away' || w === 'watch' ? w : '');
// whom a spectator watches (Martin, 2026-11-23): another player's id, short letters and digits only
// one received thumbs up: [sender id, their name then, when (ms)]; a bare id from pages before 24 Nov
const cleanKudo = (v) => {
  if (typeof v === 'string') { const id = cleanOn(v); return id ? [id, '', 0] : null; }
  if (!Array.isArray(v)) return null;
  const id = cleanOn(v[0]);
  return id ? [id, cleanName(v[1]) || '', Number.isFinite(v[2]) ? Math.max(0, Math.floor(v[2])) : 0] : null;
};
const cleanOn = (v) => (typeof v === 'string' && /^[\w-]{1,16}$/.test(v) ? v : '');

// ---- Limits
const MAX_SOCKETS = 100;          // everyone with the game open (150 until 2026-11-24: Martin capped online play at 100, about the most
                                  // one lobby carries smoothly); the next one is told FULL and drives offline until a place frees
const IDLE_MS = 120000;           // in the garage, the menu or another tab this long: gives up the place when the server is full (seats)
const WAIT_GONE = 90000;           // a refused page asks again every 20 to 40 s (longer in a hidden tab): quiet this long, it gave up
const MAX_SOCKETS_IP = 30;        // from one address (a household, a LAN party, a school or office behind one address: 12 until 2026-11-24)
const MSG_WINDOW = 2000, MSG_MAX = 60;   // messages a socket may send in two seconds (the game sends 20)
const DAY = 86400000;
// Positions in bundles (Martin 2026-11-23, 22 online and more coming): a page that says so in its hello
// (b: 1) gets every other car's newest position in ONE message ten times a second, instead of one
// message per car per update. 22 players: 210 messages a second into each browser and 4,600 out of here
// become 10 and 220. Cars far from the receiving one go less often (they are a block on its horizon or an
// arrow on its map). Each entry carries how long ago its position came in, so the page puts it at its
// true moment and the car glides as smoothly as before. Pages from before this get single messages at once.
const TICK = 100;                                     // ms between bundles
const POSE_FAR = 600, POSE_FAR_MS = 300;              // further than this from the receiver: about 3 a second
const POSE_VFAR = 2000, POSE_VFAR_MS = 1000;          // and once a second this far
const POSE_KEEP = 5000;                               // a car that has not sent for this long is left out
const KUDOS_GAP = 30000, KUDOS_MAX = 8, KUDOS_KEEP = 24;   // a thumbs up: one sender to one receiver once in 30 s, at most 8 a minute from one sender
const BOARD_V = 3;                // raise when the stored lap board gets a new shape, so it is worked out afresh
// what drove a lap: keyboard, gamepad, steering wheel, touch screen. Laps from before this was kept
// have none and count as keyboard.
const INPUTS = ['kb', 'pad', 'wheel', 'touch'];
const cleanInp = (s) => (INPUTS.includes(s) ? s : null);

// A car's position as the other browsers get it: numbers only, within sane bounds. One word where
// a number belongs stopped every nearby player's picture, and a huge speed threw their cars away.
function cleanPose(p) {
  if (!Array.isArray(p) || p.length < 9 || p.length > 24) return null;
  const out = new Array(p.length);
  for (let i = 0; i < p.length; i++) {
    const v = p[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    const lim = i === 6 || i === 7 ? 150 : i === 14 ? 20000 : 100000;   // speed m/s, engine rpm, the rest
    out[i] = Math.max(-lim, Math.min(lim, v));
  }
  return out;
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sameText = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      // the page itself never gets here (a static asset; index.html moves the old addresses on), but
      // other paths on the old address go to www.linnaring.com (worker/moved.js)
      return moved(req, url) || (env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 }));
    }
    // the game only ever calls its own address: another website may not use a visitor's browser to
    // post laps or open sockets here
    const origin = req.headers.get('origin');
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { /* not a URL */ }
      if (host !== url.host) return json({ error: 'forbidden' }, 403);
    }
    if (url.pathname === '/api/stats') {
      // anonymous game stats (worker/stats.js): their own object, so they never slow the lobby down.
      // The country Cloudflare sees the visitor in goes along; the address does not.
      const fwd = new Request(req);
      fwd.headers.set('x-country', String(req.cf?.country || ''));
      return env.STATS.get(env.STATS.idFromName('stats')).fetch(fwd);
    }
    const stub = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
    return stub.fetch(req);
  },
};

// ---- Replays: unpacking and checking (the packing is in src/race/replay.js)
async function gunzip(bytes, max) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) { reader.cancel(); throw new Error('too big'); }
    parts.push(value);
  }
  const all = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return new TextDecoder().decode(all);
}
// the places a replay has to pass, in order, and how near: Toomemägi's checkpoints and hidden gates (the game's
// own, src/race/lapgates.js) and its start/finish line (the lap is flying: it starts and ends there); the Raadi
// stage's start, a point every 80 along it, its finish
const near = (i, P, r) => ({ x: P[i][0], z: P[i][1], r });
const GATES = {
  toomemagi: { first: near(0, LAP.pts, 30), pass: [...lapGates(LAP), near(0, LAP.pts, 30)] },
  raadi: { first: near(STAGE.start, STAGE.pts, 30),
    pass: [...Array.from({ length: Math.floor((STAGE.finish - STAGE.start - 80) / 80) }, (_, k) => near(STAGE.start + 80 * (k + 1), STAGE.pts, STAGE.hw[STAGE.start + 80 * (k + 1)] + 45)), near(STAGE.finish, STAGE.pts, 30)] },
};
// the move from (ax, az) to (bx, bz) through a gate: across the line of a lap gate, or within a circle
function thru(q, ax, az, bx, bz) {
  if (q.ax != null) return throughGate(q, ax, az, bx, bz);
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t - q.x, az + dz * t - q.z) < q.r;
}
// what is wrong with a replay's samples ('' for nothing): driving ms is the time without penalty seconds
function checkTrace(text, track, driving) {
  const a = text.split(',').map(Number);
  const [v, f, ms, n] = a;
  if (v !== 1 || f !== 21 || !Number.isInteger(n) || a.length !== 4 + n * f || !a.every(Number.isInteger)) return 'shape';
  if (Math.abs(ms - driving) > 2) return 'time';
  if (Math.abs(n - (Math.ceil(ms / 100) + 1)) > 1) return 'samples';
  const g = GATES[track];
  let x = 0, z = 0, px = 0, pz = 0, gate = 0;
  for (let i = 0; i < n; i++) {
    x += a[4 + i * f] / 100; z += a[4 + i * f + 1] / 100;
    if (i === 0 && Math.hypot(x - g.first.x, z - g.first.z) > g.first.r) return 'start';
    if (i && Math.hypot(x - px, z - pz) > 12) return 'speed';
    // (on the line between two samples, as the game judges a frame: at 10 a second a fast car moves 8 m)
    // (one gate missed is forgiven when the next is passed, as in the game: running wide onto the grass)
    for (;;) {
      const last = (k) => k < g.pass.length - 1 || i > n - 4;
      if (i && g.pass[gate] && thru(g.pass[gate], px, pz, x, z) && last(gate)) gate++;
      else if (i && g.pass[gate + 1] && thru(g.pass[gate + 1], px, pz, x, z) && last(gate + 1)) gate += 2;
      else break;
    }
    if (i === 0 && Math.hypot(x - g.pass[0].x, z - g.pass[0].z) < g.pass[0].r) gate++;
    px = x; pz = z;
  }
  return gate < g.pass.length ? 'route' : '';
}

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS laps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track TEXT NOT NULL, name TEXT NOT NULL, car TEXT NOT NULL, ms INTEGER NOT NULL,
      at TEXT NOT NULL, day TEXT NOT NULL)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS laps_car ON laps (track, car, ms)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS laps_name ON laps (name COLLATE NOCASE)');
    // checkpoint split times (JSON list of ms) and which checkpoints they belong to (the client's
    // CP_KEY), so a driver without a lap of their own can race the record's splits
    const cols = this.sql.exec('PRAGMA table_info(laps)').toArray().map((c) => c.name);
    if (!cols.includes('splits')) this.sql.exec('ALTER TABLE laps ADD COLUMN splits TEXT');
    if (!cols.includes('cp')) this.sql.exec('ALTER TABLE laps ADD COLUMN cp TEXT');
    // which lap ticket the lap came in on (see "Lap tickets"); laps from before tickets have none
    if (!cols.includes('sid')) this.sql.exec('ALTER TABLE laps ADD COLUMN sid TEXT');
    this.sql.exec('CREATE INDEX IF NOT EXISTS laps_sid ON laps (sid)');
    // what the lap was driven with (INPUTS); null on laps from before it was kept (keyboard)
    if (!cols.includes('inp')) this.sql.exec('ALTER TABLE laps ADD COLUMN inp TEXT');
    // the tyres the lap was driven on: 'gravel', or null for road tyres (and every lap from before 23 Nov 2026)
    if (!cols.includes('ty')) this.sql.exec('ALTER TABLE laps ADD COLUMN ty TEXT');
    // penalty seconds that are part of a stage time (Raadi: apex cut, wide entry, off the path); null without
    if (!cols.includes('pen')) this.sql.exec('ALTER TABLE laps ADD COLUMN pen INTEGER');
    // small values kept between wake-ups: the signing secret and the finished lap board
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    // the record lap of each car on each circuit as movement, to be watched (see "Replays"); one row a car and circuit
    this.sql.exec('CREATE TABLE IF NOT EXISTS replays (track TEXT NOT NULL, car TEXT NOT NULL, ms INTEGER NOT NULL, name TEXT NOT NULL, at TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (track, car))');
    this.rpIndex = null;          // track -> { car: ms } of the replays kept (with the board)
    // One-off (Martin, 24 Nov 2026, there being no ADMIN_KEY): the 42 Toomemägi laps driven up Kroonuaia and back
    // (checkpoint 2 about 10 s early, the audi200 record's replay shows the route) and the replay of that record.
    // The new gates (src/race/lapgates.js) stop such laps; the lap board is made again from what is left.
    if (!this.meta('cleanup-2026-11-24')) {
      const CHEATS = [60, 138, 152, 363, 410, 413, 434, 437, 444, 504, 515, 519, 550, 602, 608, 617, 625, 635, 665, 681, 808, 819, 832, 846, 876, 892, 911, 942, 945, 949, 960, 964, 979, 998, 1001, 1002, 1018, 1025, 1028, 1054, 1069, 1120];
      for (const id of CHEATS) this.sql.exec("DELETE FROM laps WHERE id = ? AND track = 'toomemagi'", id);
      this.sql.exec("DELETE FROM replays WHERE track = 'toomemagi' AND car = 'audi200' AND ms = 168444");
      this.sql.exec("DELETE FROM meta WHERE k = 'board'");
      this.setMeta('cleanup-2026-11-24', '1');
    }
    // keep-alive pings are answered without waking the object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.rl = new Map();          // rate limit counters (in memory: they only matter while it is busy)
    this.rate = new WeakMap();    // messages per socket
    this.cache = null;            // the lap board
    this.hmac = null;
    this.race = new RaceDesk(this);   // the online race (worker/race.js)
    this.initPoses();
    this.initLoad();
  }

  // ---- Demand (Martin 2026-11-24: how many would play online if the cap let them): once a minute the lobby
  // tells the stats object how many are online and driving, how many pages are waiting outside (SERVER FULL,
  // still asking every 20 to 40 s), how many were turned away and how many got in after waiting. Kept in
  // memory only and sent from what already runs (the position bundles, sockets opening, messages), so it
  // never keeps the object awake on its own.
  initLoad() {
    this.waiting = new Map();     // page id (?w= on the socket address, else the address) -> { first, last } asked while full
    this.loadMin = 0;             // the minute last sent
    this.load = { ref: 0, away: 0, joined: 0, waitMs: 0 };
  }
  waitKey(url, ip) {
    const w = url.searchParams.get('w');
    return typeof w === 'string' && /^[a-z0-9]{6,16}$/.test(w) ? `w|${w}` : `i|${ip}`;
  }
  // a page refused with SERVER FULL: a new waiting player unless it already asked within WAIT_GONE
  refused(key, now) {
    this.load.ref++;
    const e = this.waiting.get(key);
    if (e && now - e.last < WAIT_GONE) { e.last = now; return; }
    if (this.waiting.size >= 2000) this.waitClean(now);
    if (this.waiting.size >= 2000) return;
    this.waiting.set(key, { first: now, last: now });
    this.load.away++;
  }
  // a page that waited outside got its place
  admitted(key, now) {
    const e = this.waiting.get(key);
    if (!e) return;
    this.waiting.delete(key);
    if (now - e.last < WAIT_GONE) { this.load.joined++; this.load.waitMs += now - e.first; }
  }
  waitClean(now) { for (const [k, e] of this.waiting) if (now - e.last >= WAIT_GONE) this.waiting.delete(k); }
  loadTick(now = Date.now()) {
    const min = Math.floor(now / 60000);
    if (min === this.loadMin) return;
    this.loadMin = min;
    const st = this.env?.STATS;
    if (!st) return;
    this.waitClean(now);
    let on = 0, drv = 0;
    const seen = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a?.id || a.ghost || seen.has(a.id) || !this.race.live(ws, a, now)) continue;
      seen.add(a.id); on++;
      if (a.drv) drv++;
    }
    const max = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS));
    const s = { v: 1, t: now, on, drv, wait: this.waiting.size, cap: max, ...this.load };
    this.load = { ref: 0, away: 0, joined: 0, waitMs: 0 };
    const p = st.get(st.idFromName('stats')).addLoad(s).catch(() => {});
    this.ctx.waitUntil?.(p);
  }

  // ---- Positions (see TICK): kept in memory only, they are stale a moment later anyway
  initPoses() {
    this.poses = new Map();       // player id -> { p, j: p as JSON, t: when it came in, n: how many so far, ws }
    this.bund = new WeakMap();    // socket -> takes bundles (from its hello; read from the attachment after a wake-up)
    this.sentTo = new WeakMap();  // socket -> Map(player id -> { n, t }): what that page has had of each car
    this.timer = 0;
  }
  takesBundles(ws) {
    let b = this.bund.get(ws);
    if (b === undefined) { b = !!ws.deserializeAttachment()?.b; this.bund.set(ws, b); }
    return b;
  }
  // a car's new position: to older pages at once, to the others with the next bundle
  pose(ws, id, p) {
    const now = Date.now();
    const j = JSON.stringify(p);
    const e = this.poses.get(id);
    if (e) { e.p = p; e.j = j; e.t = now; e.n++; e.ws = ws; } else this.poses.set(id, { p, j, t: now, n: 1, ws });
    let one = null;
    for (const o of this.ctx.getWebSockets()) {
      if (o === ws || this.takesBundles(o)) continue;
      one ??= `{"t":"s","id":"${id}","p":${j}}`;
      try { o.send(one); } catch { /* closing */ }
    }
    if (!this.timer) this.timer = setInterval(() => { try { this.bundle(); } catch (err) { console.error('bundle', err); } }, TICK);
  }
  dropPose(ws, id) {
    const e = id && this.poses.get(id);
    if (e && e.ws === ws) this.poses.delete(id);
  }
  bundle() {
    const now = Date.now();
    if (now - this.loadMin * 60000 >= 60000) this.loadTick(now);
    for (const [id, e] of this.poses) if (now - e.t > POSE_KEEP) this.poses.delete(id);
    if (!this.poses.size) { clearInterval(this.timer); this.timer = 0; return; }   // (nobody driving: the object may sleep)
    const own = new Map();
    for (const e of this.poses.values()) own.set(e.ws, e);
    const frag = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      if (!this.takesBundles(ws)) continue;
      let sent = this.sentTo.get(ws);
      if (!sent) this.sentTo.set(ws, sent = new Map());
      // where this page's own car is (none: in the menu, the garage or watching someone: it gets everything)
      const me = own.get(ws), here = me && now - me.t < 2000 ? me.p : null;
      let out = '';
      for (const [id, e] of this.poses) {
        if (e.ws === ws) continue;
        const s = sent.get(id);
        if (s && s.n === e.n) continue;                 // nothing new from that car
        if (s && here) {
          const d = Math.hypot(e.p[0] - here[0], e.p[1] - here[1]);
          if (now - s.t < (d > POSE_VFAR ? POSE_VFAR_MS : d > POSE_FAR ? POSE_FAR_MS : 0)) continue;
        }
        if (s) { s.n = e.n; s.t = now; } else sent.set(id, { n: e.n, t: now });
        let f = frag.get(id);
        if (f === undefined) frag.set(id, f = `["${id}",${e.j},${now - e.t}]`);
        out += out ? `,${f}` : f;
      }
      if (sent.size > this.poses.size + 32) for (const id of sent.keys()) if (!this.poses.has(id)) sent.delete(id);
      if (out) try { ws.send(`{"t":"S","b":[${out}]}`); } catch { /* closing */ }
    }
  }

  async alarm() { this.race.alarm(); }

  // a race that closed (or start votes that lapsed) for the stats page: a call to the stats object,
  // not waited for, so a slow or failing stats object never holds the race up
  raceStat(r) {
    const st = this.env?.STATS;
    if (!st) return;
    const p = st.get(st.idFromName('stats')).addRace(r).catch(() => {});
    this.ctx.waitUntil?.(p);
  }

  meta(k) { return this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v ?? null; }
  setMeta(k, v) { this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, v); }

  // true when `key` has been used more than `max` times within `ms`
  over(key, max, ms) {
    const now = Date.now();
    let e = this.rl.get(key);
    if (!e || now - e.t > ms) {
      if (this.rl.size > 4000) for (const [k, v] of this.rl) if (now - v.t > 600000) this.rl.delete(k);
      if (this.rl.size > 8000) this.rl.clear();
      e = { t: now, n: 0 }; this.rl.set(key, e);
    }
    return ++e.n > max;
  }

  // ---- Lap tickets
  // A lap time is only as honest as the browser that reports it, and there are no accounts. What
  // the server can know is when a browser first showed up: as the page opens it gets a signed
  // ticket holding that moment (/api/ticket, or with its first hello), and sends the ticket along
  // with every lap. A lap is stored only
  // if it began after its ticket was issued and after the ticket's previous lap ended, so a
  // ticket cannot report more lap time than has really passed. A forger now has to connect and
  // wait out each lap instead of posting any number of them in one request.
  async sign(text) {
    if (!this.hmac) {
      let secret = this.meta('secret');
      if (!secret) { secret = b64(crypto.getRandomValues(new Uint8Array(32))); this.setMeta('secret', secret); }
      this.hmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    }
    return b64(await crypto.subtle.sign('HMAC', this.hmac, new TextEncoder().encode(text))).slice(0, 27);
  }
  async newTicket() {
    const body = `${Date.now().toString(36)}.${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return `${body}.${await this.sign(body)}`;
  }
  // { t0: when it was issued, sid } for a ticket of ours, else null
  async readTicket(k) {
    if (typeof k !== 'string' || k.length > 80) return null;
    const m = /^([0-9a-z]{6,12})\.([0-9a-f]{16})\.([\w-]{27})$/.exec(k);
    if (!m || !sameText(m[3], await this.sign(`${m[1]}.${m[2]}`))) return null;
    const t0 = parseInt(m[1], 36);
    return t0 > 0 && t0 <= Date.now() ? { t0, sid: m[2] } : null;
  }

  // (wn: how many spectators watch that player, told to everyone; whom a spectator watches is never told:
  // Martin 2026-11-23, spectating stays anonymous)
  players() {
    const out = [], wn = this.watchCounts();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.id && !a.ghost) out.push({ id: a.id, name: a.name, car: a.car, ...(a.w ? { w: a.w } : {}), ...(wn.get(a.id) ? { wn: wn.get(a.id) } : {}), ...(a.kn ? { kn: a.kn, kf: a.kf } : {}) });
    }
    return out;
  }

  // spectators per watched player id (except: a socket that is closing)
  watchCounts(except) {
    const n = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a?.id && !a.ghost && a.w === 'watch' && a.on) n.set(a.on, (n.get(a.on) || 0) + 1);
    }
    return n;
  }
  // tell everyone the new spectator count of these players
  watchTold(ids, except) {
    const n = this.watchCounts(except);
    for (const id of new Set(ids)) if (id) this.broadcast({ t: 'wn', id, n: n.get(id) || 0 });
  }

  // Drop sockets that have gone silent: every browser pings each 25 s, so one that has neither
  // pinged nor said hello for 80 s is a dead connection (a phone that went to sleep, a lost
  // network) that would otherwise stay in everyone's player list.
  prune(except) {
    const now = Date.now(), gone = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      const ping = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
      if (Math.max(ping, a?.at || 0) > now - 80000) continue;
      this.release(ws, a, 1001, 'stale');
      gone.add(ws);
    }
    return gone;
  }

  // a socket closed by the server (gone silent, or idle in the garage while the server is full), told to the others
  release(ws, a, code, why) {
    try { ws.close(code, why); } catch { /* already closed */ }
    this.dropPose(ws, a?.id);
    if (a?.id && !a.ghost) { this.broadcast({ t: 'leave', id: a.id }, ws); this.race.gone(a, ws); if (a.on) this.watchTold([a.on], ws); }
  }

  // The places taken toward the cap (Martin 2026-11-24: SERVER FULL with about 60 drivers on the map). Not
  // counted: sockets gone silent (a phone asleep, a closed laptop: they were only dropped when somebody said
  // hello, so a newcomer was counted against them first) and ghosts. If that is still the cap, the player who
  // has sat longest in the garage, the menu or another tab (over IDLE_MS) gives up the place: their page
  // knows why (code 4002) and joins again as soon as it is back on the map.
  seats(max) {
    const gone = this.prune();
    const now = Date.now(), idleMs = (Number(this.env?.IDLE_S) || IDLE_MS / 1000) * 1000;   // (IDLE_S on the Worker changes it without a deploy)
    let n = 0, idle = null, idleAt = Infinity;
    for (const ws of this.ctx.getWebSockets()) {
      if (gone.has(ws)) continue;
      const a = ws.deserializeAttachment();
      if (a?.ghost) continue;
      n++;
      if (!a?.id || (a.w !== 'garage' && a.w !== 'away') || this.race.racing(a.id)) continue;
      const since = a.wt || a.at || now;
      if (since < now - idleMs && since < idleAt) { idle = { ws, a }; idleAt = since; }
    }
    if (n >= max && idle) { this.release(idle.ws, idle.a, 4002, 'idle'); n--; }
    return n;
  }

  broadcast(msg, except) {
    const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(s); } catch { /* closing */ }
    }
  }

  nameTaken(name) {
    if (this.sql.exec('SELECT 1 FROM laps WHERE name = ? COLLATE NOCASE LIMIT 1', name).toArray().length) return true;
    return this.players().some((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  freshName() {
    for (let k = 0; k < 200; k++) {
      const n = `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}${k < 100 ? '' : Math.floor(Math.random() * 90 + 10)}`;
      if (!this.nameTaken(n)) return n;
    }
    return `Driver${Math.floor(Math.random() * 900000 + 100000)}`;
  }

  // ---- The lap board
  // Worked out from the whole table once (and again after laps are deleted), then kept: each new
  // lap only updates it. It used to be worked out from every lap on every page load, which read
  // the table four times over and would have run into the daily allowance as the laps piled up.
  // one circuit's part of the board: the best per car of all time and of today, how many were driven, the
  // latest by anyone (newest first: the desktop board lists them) and every kind of control any was driven
  // with (the board only marks laps once there is more than one)
  boardOf(track, day) {
    const best = (where, ...args) => this.sql.exec(
      `SELECT car, name, MIN(ms) AS ms, at, inp, ty, pen FROM laps WHERE track = ? ${where} GROUP BY car`, track, ...args).toArray();
    const count = this.sql.exec('SELECT COUNT(*) AS n FROM laps WHERE track = ?', track).one().n;
    const recent = this.sql.exec('SELECT name, car, ms, at, inp, ty, pen FROM laps WHERE track = ? ORDER BY at DESC, id DESC LIMIT 20', track).toArray();
    const inputs = this.sql.exec("SELECT DISTINCT COALESCE(inp, 'kb') AS k FROM laps WHERE track = ?", track).toArray().map((r) => r.k);
    return { allTime: best(''), today: best('AND day = ?', day), laps: count, recent, inputs };
  }
  // Toomemägi's part is the board itself, as it always was (a page opened before a deploy still reads it);
  // each stage's part hangs under its name.
  rebuildBoard() {
    const day = tartuDay();
    // the fastest lap with split times per car and checkpoint layout: what a driver with no lap of
    // their own in that car compares their checkpoint times with
    const refs = this.sql.exec(
      `SELECT car, cp, name, MIN(ms) AS ms, splits FROM laps WHERE track = ? AND splits IS NOT NULL AND cp IS NOT NULL GROUP BY car, cp`, TRACK)
      .toArray().map((r) => ({ ...r, splits: JSON.parse(r.splits) }));
    const b = { v: BOARD_V, track: TRACK, day, ...this.boardOf(TRACK, day), refs };
    for (const t of Object.keys(STAGES)) b[t] = this.boardOf(t, day);
    return b;
  }
  saveBoard() { this.setMeta('board', JSON.stringify(this.cache)); }
  board() {
    if (!this.cache) {
      try { this.cache = JSON.parse(this.meta('board')); } catch { this.cache = null; }
      if (this.cache?.v !== BOARD_V || this.cache.track !== TRACK) { this.cache = this.rebuildBoard(); this.saveBoard(); }
    }
    const day = tartuDay();
    if (this.cache.day !== day) {                                 // past midnight in Tartu
      this.cache.day = day; this.cache.today = [];
      for (const t of Object.keys(STAGES)) this.cache[t].today = [];
      this.saveBoard();
    }
    // which records can be watched: { toomemagi: { car: ms }, raadi: {...} } (a replay whose ms is no longer the
    // car's best is of an older record, and the board does not offer it)
    if (!this.rpIndex) {
      this.rpIndex = {};
      for (const r of this.sql.exec('SELECT track, car, ms FROM replays').toArray()) (this.rpIndex[r.track] ||= {})[r.car] = r.ms;
    }
    this.cache.rp = this.rpIndex;
    return this.cache;
  }
  // a lap that has just been stored
  addToBoard(l) {
    const day = this.board().day, b = l.track === TRACK ? this.cache : this.cache[l.track];
    const faster = (list, same) => {
      const i = list.findIndex(same);
      if (i < 0) list.push(null);
      else if (list[i].ms <= l.ms) return null;
      return i < 0 ? list.length - 1 : i;
    };
    b.laps++;
    const row = { car: l.car, name: l.name, ms: l.ms, at: l.at, inp: l.inp, ty: l.ty, ...(l.pen ? { pen: l.pen } : {}) };
    b.recent.push(row);
    const k = l.inp || 'kb';
    if (!b.inputs.includes(k)) b.inputs.push(k);
    b.recent.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
    b.recent.length = Math.min(b.recent.length, 20);
    let i = faster(b.allTime, (r) => r.car === l.car);
    if (i !== null) b.allTime[i] = row;
    if (l.day === day) { i = faster(b.today, (r) => r.car === l.car); if (i !== null) b.today[i] = row; }
    if (l.track === TRACK && l.splits && l.cp) {
      i = faster(b.refs, (r) => r.car === l.car && r.cp === l.cp);
      if (i !== null) b.refs[i] = { car: l.car, cp: l.cp, name: l.name, ms: l.ms, splits: l.splits };
    }
  }

  // ---- Replays (Martin 2026-11-24): the record lap of each car, as movement (src/race/replay.js). A browser sends
  // one only for a lap of its own that the board has as the car's record: the lap must be stored under the same
  // ticket, car and time, still be the car's best, and its samples must hold up: as many as the time takes, the
  // car never faster than 430 km/h between two, from the start line through every checkpoint in order to the
  // finish. A forger now has to make up a whole drive, not one number; and a record can be watched.
  async takeReplay(req, ip) {
    if (this.over(`r|${ip}`, 6, 60000)) return json({ error: 'too many requests' }, 429);
    const text = await req.text();
    if (text.length > 400000) return json({ error: 'too big' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
    const car = cleanCar(body?.car), track = cleanTrack(body?.track), ms = Math.round(Number(body?.ms));
    const tk = await this.readTicket(body?.k);
    if (!car || !tk || !(ms > 0) || typeof body?.z !== 'string') return json({ error: 'invalid' }, 400);
    const lap = this.sql.exec('SELECT name, at, pen FROM laps WHERE sid = ? AND car = ? AND ms = ? AND track = ? LIMIT 1', tk.sid, car, ms, track).toArray()[0];
    if (!lap) return json({ error: 'no such lap' }, 400);
    const best = this.sql.exec('SELECT MIN(ms) AS m FROM laps WHERE track = ? AND car = ?', track, car).one().m;
    if (best !== ms) return json({ error: 'not the record' }, 400);
    const had = this.sql.exec('SELECT ms FROM replays WHERE track = ? AND car = ?', track, car).toArray()[0];
    if (had && had.ms <= ms) return json({ ok: true });              // (that record's replay came already)
    let bytes, why;
    try {
      bytes = Uint8Array.from(atob(body.z), (c) => c.charCodeAt(0));
      why = checkTrace(await gunzip(bytes, 2000000), track, ms - (lap.pen || 0) * 1000);
    } catch { why = 'unreadable'; }
    if (why) return json({ error: `replay refused: ${why}` }, 400);
    this.sql.exec('INSERT OR REPLACE INTO replays (track, car, ms, name, at, data) VALUES (?, ?, ?, ?, ?, ?)', track, car, ms, lap.name, lap.at, bytes);
    this.rpIndex = null;
    this.broadcast({ t: 'board', board: this.board() });
    return json({ ok: true });
  }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const busy = () => json({ error: 'too many requests' }, 429);
    if (this.over(`a|${ip}`, 300, 60000)) return busy();

    if (path === '/api/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      if (this.over(`c|${ip}`, 60, 300000)) return busy();
      // (a MAX_ONLINE variable on the Worker, set in the Cloudflare dashboard, overrides the cap without a deploy)
      const max = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS));
      const wk = this.waitKey(url, ip), now = Date.now();
      if (this.seats(max) >= max) {
        this.refused(wk, now);
        this.loadTick(now);
        // full: a socket of its own (not one of the lobby's) that says so and closes, since a browser cannot
        // read why an upgrade was refused; the game then drives offline and asks again now and then
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ t: 'full', max }));
        pair[1].close(4001, 'full');
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      let mine = 0;
      for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.ip === ip) mine++;
      if (mine >= MAX_SOCKETS_IP) return busy();
      this.admitted(wk, now);
      this.loadTick(now);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ at: Date.now(), ip });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (path === '/api/name') {
      // a default name nobody has finished a lap with (and nobody online is using)
      return json({ name: this.freshName() });
    }

    if (path === '/api/board') return json(this.board());

    if (path === '/api/online') {
      // who is online now, for the stats page (Martin 2026-11-22: "sometimes check out of curiosity"):
      // the names, cars and race places everyone in the game already sees, no ids or addresses.
      // Ghosts (stealth) and sockets silent for 80 s are left out, like in the game's own list.
      const now = Date.now(), race = this.race, seen = new Set(), players = [];
      const on = race.s.phase === 'on';
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (!a?.id || a.ghost || seen.has(a.id) || !race.live(ws, a, now)) continue;
        seen.add(a.id);
        const r = on && race.s.racers.find((x) => x.id === a.id);
        players.push({ name: a.name, car: a.car, drv: !!a.drv, since: a.at || now, race: r ? (r.ms != null ? 'fin' : r.out ? 'out' : 'in') : null });
      }
      players.sort((x, y) => (y.drv - x.drv) || (x.since - y.since));
      const ph = race.phase(now);
      // (total and drv count everyone: the list shows the first 60, and the page once counted only those, 24 Nov)
      // pages waiting outside after SERVER FULL (asked again within WAIT_GONE), and the cap
      this.waitClean(now);
      const cap = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS));
      return json({ now, total: players.length, drv: players.filter((p) => p.drv).length, waiting: this.waiting.size, cap, players: players.slice(0, 60), more: Math.max(0, players.length - 60),
        race: on ? { phase: ph, racers: race.s.racers.length, racing: race.active().filter((r) => r.ms == null).length, finished: race.finished().length, green: race.s.tGreen } : null });
    }

    if (path === '/api/ticket') {
      // the page asks for its lap ticket as soon as it opens, well before anyone can drive
      if (this.over(`t|${ip}`, 30, 600000)) return busy();
      return json({ key: await this.newTicket() });
    }

    if (path === '/api/lap' && req.method === 'POST') {
      // one lap {name, car, ms, k, ago, splits?, cp?, inp?, ty?, track?, pen?}, or a batch {laps: [...]} of laps a
      // browser kept and resends. track: 'raadi' for a time of the Raadi stage (none: a lap of Toomemägi), pen: the
      // penalty seconds in that time. k is the browser's lap ticket and ago how many ms ago the lap ended, by the
      // browser's own clock (so a wrong clock does not matter). A lap already stored (same ticket,
      // car and time) is not stored twice, so a browser can safely send again everything it has no
      // confirmation for.
      if (this.over(`l|${ip}`, 30, 60000)) return busy();
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const list = Array.isArray(body?.laps) ? body.laps.slice(0, 50) : [body];
      const now = Date.now();
      const added = [], ok = [], tickets = new Map();
      for (const l of list) {
        const name = cleanName(l?.name), car = cleanCar(l?.car), ms = Math.round(Number(l?.ms)), track = cleanTrack(l?.track);
        // (penalty seconds: whole, and the driving itself must still be a believable time)
        const pen = track !== TRACK && Number.isInteger(l?.pen) && l.pen > 0 && l.pen <= 600 ? l.pen : 0;
        if (!name || !car || !(ms - pen * 1000 >= (STAGES[track] || 60000) && ms <= 3600000)) continue;
        if (!tickets.has(l.k)) tickets.set(l.k, await this.readTicket(l.k));
        const tk = tickets.get(l.k);
        if (!tk) continue;
        if (this.sql.exec('SELECT 1 FROM laps WHERE sid = ? AND car = ? AND ms = ? AND track = ? LIMIT 1', tk.sid, car, ms, track).toArray().length) { ok.push(ms); continue; }
        // when it was driven: it has to fit between the ticket being issued (or the ticket's last
        // lap ending) and now. 5 s of slack for the trip here. (Penalty seconds were not driven.)
        const ago = Number(l?.ago);
        const end = now - (ago > 0 ? ago : 0), start = end - (ms - pen * 1000);
        const last = this.sql.exec('SELECT at FROM laps WHERE sid = ? ORDER BY id DESC LIMIT 1', tk.sid).toArray()[0];
        if (!(ago <= 30 * DAY || !(ago > 0)) || start < tk.t0 - 5000 || (last && start < Date.parse(last.at) - 5000)) continue;
        ok.push(ms);
        const at = new Date(end);
        // split times: rising whole milliseconds inside the lap, with the checkpoint list they are for
        const sp = Array.isArray(l?.splits) && l.splits.length && l.splits.length <= 12 ? l.splits.map((v) => Math.round(Number(v))) : null;
        const cp = typeof l?.cp === 'string' && /^[0-9,]{1,80}$/.test(l.cp) ? l.cp : null;
        const good = track === TRACK && sp && cp && sp.length === cp.split(',').length && sp.every((v, k) => v > (k ? sp[k - 1] : 0) && v < ms);
        const row = { track, name, car, ms, at: at.toISOString(), day: tartuDay(at), splits: good ? sp : null, cp: good ? cp : null, inp: cleanInp(l?.inp), ty: l?.ty === 'gravel' ? 'gravel' : null, pen: pen || null };
        this.sql.exec('INSERT INTO laps (track, name, car, ms, at, day, splits, cp, sid, inp, ty, pen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          track, name, car, ms, row.at, row.day, good ? JSON.stringify(sp) : null, row.cp, tk.sid, row.inp, row.ty, row.pen);
        this.addToBoard(row);
        added.push({ name, car, ms, track });
      }
      if (!ok.length) return json({ error: 'invalid lap' }, 400);
      const board = this.board();
      if (added.length) {
        this.saveBoard();
        // (a stage time goes out as `run`, not `lap`: a page opened before stage times were kept would
        // announce it as a lap record of Toomemägi)
        const lap = added.findLast((a) => a.track === TRACK), run = added.findLast((a) => a.track !== TRACK);
        this.broadcast({ t: 'board', board, ...(lap ? { lap: { name: lap.name, car: lap.car, ms: lap.ms } } : {}), ...(run ? { run } : {}) });
      }
      return json({ ok: true, saved: ok, board });
    }

    if (path === '/api/replay' && req.method === 'POST') return this.takeReplay(req, ip);
    if (path === '/api/replay') {
      // a record's replay: the gzipped samples as they came, with whose lap it is and its time in headers
      const track = cleanTrack(url.searchParams.get('track')), car = cleanCar(url.searchParams.get('car'));
      const r = car && this.sql.exec('SELECT ms, name, data FROM replays WHERE track = ? AND car = ?', track, car).toArray()[0];
      if (!r) return json({ error: 'no replay' }, 404);
      return new Response(r.data, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-ms': String(r.ms), 'x-name': encodeURIComponent(r.name) } });
    }

    if (path === '/api/laps.csv' || path === '/api/laps.json') {
      if (this.over(`d|${ip}`, 6, 60000)) return busy();
      // the .json is the complete record (the nightly backup saves it, see .github/workflows/backup-laps.yml)
      if (path.endsWith('.json')) return json(this.sql.exec('SELECT id, track, name, car, ms, at, day, splits, cp, inp, ty, pen FROM laps ORDER BY id').toArray());
      const rows = this.sql.exec("SELECT id, track, name, car, ms, at, COALESCE(inp, 'kb') AS input, COALESCE(ty, 'road') AS tyres, COALESCE(pen, 0) AS pen FROM laps ORDER BY id").toArray();
      // (a name that starts like a formula gets an apostrophe, so a spreadsheet shows it as text
      // instead of running it)
      const q = (v) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
      const csv = ['track,driver,car,lap_ms,lap_time,date_utc,id,input,tyres,penalty_s']
        .concat(rows.map((r) => [r.track, q(r.name), r.car, r.ms, `${Math.floor(r.ms / 60000)}:${((r.ms % 60000) / 1000).toFixed(2).padStart(5, '0')}`, r.at, r.id, r.input, r.tyres, r.pen].join(',')))
        .join('\n');
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'inline; filename="linnaring-laps.csv"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    }

    if (path === '/api/admin/delete-laps' && req.method === 'POST') {
      // Remove laps: {ids: [...]} (the id column of laps.csv) or {name: "..."} for all laps under a
      // name. Works only once the Worker has a secret called ADMIN_KEY, sent as
      // "Authorization: Bearer <key>"; without the secret this address does not exist.
      const key = this.env.ADMIN_KEY;
      if (!key) return json({ error: 'not found' }, 404);
      if (this.over(`x|${ip}`, 5, 600000)) return busy();
      if (!sameText(req.headers.get('authorization') || '', `Bearer ${key}`)) return json({ error: 'forbidden' }, 403);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const before = this.sql.exec('SELECT COUNT(*) AS n FROM laps').one().n;
      if (Array.isArray(body?.ids)) for (const id of body.ids.slice(0, 500)) { if (Number.isInteger(id)) this.sql.exec('DELETE FROM laps WHERE id = ?', id); }
      else if (typeof body?.name === 'string' && body.name) this.sql.exec('DELETE FROM laps WHERE name = ? COLLATE NOCASE', body.name);
      else return json({ error: 'ids or name' }, 400);
      const deleted = before - this.sql.exec('SELECT COUNT(*) AS n FROM laps').one().n;
      this.cache = this.rebuildBoard(); this.saveBoard();
      if (deleted) this.broadcast({ t: 'board', board: this.cache });
      return json({ ok: true, deleted, board: this.cache });
    }

    return json({ error: 'not found' }, 404);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    // a socket that talks far faster than the game does is shut
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r || now - r.t > MSG_WINDOW) { r = { t: now, n: 0 }; this.rate.set(ws, r); }
    if (++r.n > MSG_MAX) {
      if (r.n === MSG_MAX + 1) {
        const a = ws.deserializeAttachment();
        try { ws.close(1008, 'too many messages'); } catch { /* already closed */ }
        if (a?.id) { this.dropPose(ws, a.id); if (!a.ghost) { this.broadcast({ t: 'leave', id: a.id }, ws); this.race.gone(a, ws); } ws.serializeAttachment({ at: a.at, ip: a.ip }); }
      }
      return;
    }
    if (now - this.loadMin * 60000 >= 60000) this.loadTick(now);
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    let me = ws.deserializeAttachment();

    // A ghost (the game's stealth mode, ?off=100) hears everything but is never heard: it is left out
    // of the player list, its join and leave are not announced and nothing it sends is passed on.
    if (m.t === 's' && me?.id) {
      if (me.ghost) return;
      // position: checked, then passed on
      const p = cleanPose(m.p);
      if (p) this.pose(ws, me.id, p);
      return;
    }
    if (m.t === 'hello') {
      this.prune(ws);
      // the lap ticket: the one this browser already has (it reconnected), else a new one
      const ip = me?.ip || 'local';
      let key = (await this.readTicket(m.k)) ? m.k : null;
      if (!key && !this.over(`t|${ip}`, 30, 600000)) key = await this.newTicket();
      me = ws.deserializeAttachment();
      // A page keeps its id for as long as it is open, through lost connections and server restarts (a
      // deploy): the id comes from its lap ticket. Martin 2026-11-22: a reconnect in the middle of a race
      // gave him a new id, so his finish was not his and the race ran on to 7:00 with "1 RACING".
      const tk = key ? await this.readTicket(key) : null;
      let id = me?.id;
      if (!id && tk) {
        id = (await this.sign(`id.${tk.sid}`)).slice(0, 8);
        // the same page's old connection, not closed yet: it is this one now
        for (const old of this.ctx.getWebSockets()) {
          if (old === ws) continue;
          const oa = old.deserializeAttachment();
          if (oa?.id !== id) continue;
          this.dropPose(old, id);
          old.serializeAttachment({ at: oa.at, ip: oa.ip });
          try { old.close(1000, 'reconnected'); } catch { /* already closed */ }
        }
      }
      if (!id) id = crypto.randomUUID().slice(0, 8);
      const name = cleanName(m.name) || this.freshName();
      // (once a ghost, always a ghost on this socket: a later hello cannot announce it)
      const ghost = !!m.ghost || !!me?.ghost;
      const w = cleanWhere(m.w) || me?.w;
      const on = w === 'watch' ? cleanOn(m.on) || me?.on || '' : '';
      const b = m.b === 1 || !!me?.b;              // takes positions in bundles (see TICK)
      this.bund.set(ws, b);
      // thumbs up received today: the page's own count (kept in its browser till midnight, so a reload or a
      // lost connection keeps it), or what this socket had
      const kn = Math.max(me?.kn || 0, Number.isInteger(m.kn) ? Math.min(999, Math.max(0, m.kn)) : 0);
      const kf = (me?.kn || 0) >= kn ? me?.kf : Array.isArray(m.kf) ? m.kf.map(cleanKudo).filter(Boolean).slice(-KUDOS_KEEP) : [];
      const a = { id, name, car: cleanCar(m.car) || 'w201', at: Date.now(), ip, ...(kn ? { kn, kf: kf || [] } : {}), ...(b ? { b: 1 } : {}), ...(ghost ? { ghost: true } : {}), ...(me?.drv ? { drv: true } : {}), ...(w ? { w, wt: w === me?.w && me?.wt ? me.wt : Date.now() } : {}), ...(on ? { on } : {}) };
      ws.serializeAttachment(a);
      ws.send(JSON.stringify({ t: 'welcome', id, key, players: this.players().filter((p) => p.id !== id), wn: this.watchCounts().get(id) || 0, board: this.board() }));
      if (!me?.id && !ghost) { this.broadcast({ t: 'join', id, name, car: a.car, ...(w ? { w } : {}), ...(kn ? { kn, kf: a.kf } : {}) }, ws); this.race.back(a); }
      // (a spectator back on: the count of whom they watch)
      if (!ghost && (me?.on || '') !== on) this.watchTold([me?.on, on]);
      this.race.sendTo(ws);
      return;
    }
    if (!me?.id) return;
    if (this.race.message(ws, me, m)) return;
    if (m.t === 'name') {
      const name = cleanName(m.name);
      if (!name || name === me.name || now - (me.nt || 0) < 1500) return;   // (and not a stream of renames)
      me.name = name; me.nt = now; ws.serializeAttachment(me);
      if (!me.ghost) { this.broadcast({ t: 'name', id: me.id, name }, ws); this.race.changed(me); }
    } else if (m.t === 'car') {
      const car = cleanCar(m.car);
      if (!car || car === me.car) return;
      me.car = car; ws.serializeAttachment(me);
      if (!me.ghost) { this.broadcast({ t: 'car', id: me.id, car }, ws); this.race.changed(me); }
    } else if (m.t === 'at') {
      // where a player is (map, garage, away in another tab), for the others' lists (Martin, 2026-11-23);
      // 'watch' with on: following another player's car as a spectator
      const w = cleanWhere(m.w), on = w === 'watch' ? cleanOn(m.on) : '';
      if (!w || (w === me.w && on === (me.on || ''))) return;
      const was = me.on, wasW = me.w;
      if (w !== me.w) me.wt = now;
      me.w = w; me.on = on || undefined; ws.serializeAttachment(me);
      if (!me.ghost) this.race.moved(me, wasW);
      // (everyone hears "watching", and the watched players' new counts, never who watches whom)
      if (!me.ghost) { this.broadcast({ t: 'at', id: me.id, w }, ws); if (was !== me.on) this.watchTold([was, me.on]); }
    } else if (m.t === 'ku') {
      // a thumbs up for another player (Martin, 2026-11-23): told to everyone, sender too, since all who are
      // near see it as a sign in the receiver's back window (src/kudos.js). Not from or to a ghost or oneself.
      const to = cleanOn(m.to);
      if (me.ghost || !to || to === me.id || !this.players().some((p) => p.id === to)) return;
      if (this.over(`k|${me.id}`, KUDOS_MAX, 60000) || this.over(`k|${me.id}|${to}`, 1, KUDOS_GAP)) return;
      // the receiver's count for this session and the last senders, for those who come later (src/kudos.js:
      // the small thumbs on that car's back window)
      for (const w of this.ctx.getWebSockets()) {
        const a = w.deserializeAttachment();
        if (a?.id !== to || a.ghost) continue;
        a.kn = (a.kn || 0) + 1; a.kf = [...(a.kf || []), [me.id, me.name, now]].slice(-KUDOS_KEEP);
        w.serializeAttachment(a);
      }
      this.broadcast({ t: 'ku', id: me.id, to });
    }
  }

  async webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    try { ws.close(); } catch { /* already closed */ }
    this.dropPose(ws, me?.id);
    if (me?.id && !me.ghost) { this.broadcast({ t: 'leave', id: me.id }, ws); this.race.gone(me, ws); if (me.on) this.watchTold([me.on], ws); }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}
