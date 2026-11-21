// LINNARING server: the static game is served as assets; this Worker answers /api/*.
//
// One Durable Object ("lobby") holds everyone who has the game open. Each browser keeps a
// WebSocket to it and sends its car's position about ten times a second while someone else is
// online; the lobby passes positions on to the others and announces joins, leaves and name
// changes. The sockets use the hibernation API, so an idle lobby costs nothing.
//
// Lap times live in the lobby's SQLite storage (table `laps`). GET /api/laps.csv downloads all
// of them; GET /api/board gives the best lap per car, all time and today (Tartu time).
//
// Nobody logs in, so everything a browser sends is treated as hostile: see "Limits" and "Lap
// tickets" below for what keeps one visitor from spoiling the board, freezing the other players'
// games or using up the free plan's daily allowance.
import { DurableObject } from 'cloudflare:workers';
import { moved } from './moved.js';
export { Stats } from './stats.js';
import { CARS } from '../src/cars/specs.js';

const TRACK = 'toomemagi';
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

// ---- Limits
const MAX_SOCKETS = 150;          // everyone with the game open
const MAX_SOCKETS_IP = 12;        // from one address (a household, a LAN party)
const MSG_WINDOW = 2000, MSG_MAX = 60;   // messages a socket may send in two seconds (the game sends 20)
const DAY = 86400000;
const BOARD_V = 2;                // raise when the stored lap board gets a new shape, so it is worked out afresh
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
      // page loads on the old address go to www.linnaring.com (worker/moved.js)
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
    // small values kept between wake-ups: the signing secret and the finished lap board
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    // keep-alive pings are answered without waking the object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.rl = new Map();          // rate limit counters (in memory: they only matter while it is busy)
    this.rate = new WeakMap();    // messages per socket
    this.cache = null;            // the lap board
    this.hmac = null;
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

  players() {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.id && !a.ghost) out.push({ id: a.id, name: a.name, car: a.car });
    }
    return out;
  }

  // Drop sockets that have gone silent: every browser pings each 25 s, so one that has neither
  // pinged nor said hello for 80 s is a dead connection (a phone that went to sleep, a lost
  // network) that would otherwise stay in everyone's player list.
  prune(except) {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      const ping = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
      if (Math.max(ping, a?.at || 0) > now - 80000) continue;
      try { ws.close(1001, 'stale'); } catch { /* already closed */ }
      if (a?.id && !a.ghost) this.broadcast({ t: 'leave', id: a.id }, ws);
    }
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
  rebuildBoard() {
    const day = tartuDay();
    const best = (where, ...args) => this.sql.exec(
      `SELECT car, name, MIN(ms) AS ms, at, inp FROM laps WHERE track = ? ${where} GROUP BY car`, TRACK, ...args).toArray();
    const count = this.sql.exec('SELECT COUNT(*) AS n FROM laps WHERE track = ?', TRACK).one().n;
    // the latest laps by anyone, newest first (the desktop board lists them)
    const recent = this.sql.exec('SELECT name, car, ms, at, inp FROM laps WHERE track = ? ORDER BY at DESC, id DESC LIMIT 20', TRACK).toArray();
    // every kind of control any lap has been driven with (the board only marks laps once there is more than one)
    const inputs = this.sql.exec("SELECT DISTINCT COALESCE(inp, 'kb') AS k FROM laps WHERE track = ?", TRACK).toArray().map((r) => r.k);
    // the fastest lap with split times per car and checkpoint layout: what a driver with no lap of
    // their own in that car compares their checkpoint times with
    const refs = this.sql.exec(
      `SELECT car, cp, name, MIN(ms) AS ms, splits FROM laps WHERE track = ? AND splits IS NOT NULL AND cp IS NOT NULL GROUP BY car, cp`, TRACK)
      .toArray().map((r) => ({ ...r, splits: JSON.parse(r.splits) }));
    return { v: BOARD_V, track: TRACK, day, allTime: best(''), today: best('AND day = ?', day), laps: count, recent, refs, inputs };
  }
  saveBoard() { this.setMeta('board', JSON.stringify(this.cache)); }
  board() {
    if (!this.cache) {
      try { this.cache = JSON.parse(this.meta('board')); } catch { this.cache = null; }
      if (this.cache?.v !== BOARD_V || this.cache.track !== TRACK) { this.cache = this.rebuildBoard(); this.saveBoard(); }
    }
    const day = tartuDay();
    if (this.cache.day !== day) { this.cache.day = day; this.cache.today = []; this.saveBoard(); }   // past midnight in Tartu
    return this.cache;
  }
  // a lap that has just been stored
  addToBoard(l) {
    const b = this.board();
    const faster = (list, same) => {
      const i = list.findIndex(same);
      if (i < 0) list.push(null);
      else if (list[i].ms <= l.ms) return null;
      return i < 0 ? list.length - 1 : i;
    };
    b.laps++;
    b.recent.push({ name: l.name, car: l.car, ms: l.ms, at: l.at, inp: l.inp });
    const k = l.inp || 'kb';
    if (!b.inputs.includes(k)) b.inputs.push(k);
    b.recent.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
    b.recent.length = Math.min(b.recent.length, 20);
    const row = { car: l.car, name: l.name, ms: l.ms, at: l.at, inp: l.inp };
    let i = faster(b.allTime, (r) => r.car === l.car);
    if (i !== null) b.allTime[i] = row;
    if (l.day === b.day) { i = faster(b.today, (r) => r.car === l.car); if (i !== null) b.today[i] = row; }
    if (l.splits && l.cp) {
      i = faster(b.refs, (r) => r.car === l.car && r.cp === l.cp);
      if (i !== null) b.refs[i] = { car: l.car, cp: l.cp, name: l.name, ms: l.ms, splits: l.splits };
    }
  }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const busy = () => json({ error: 'too many requests' }, 429);
    if (this.over(`a|${ip}`, 300, 60000)) return busy();

    if (path === '/api/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const open = this.ctx.getWebSockets();
      if (open.length >= MAX_SOCKETS) return json({ error: 'full' }, 503);
      if (this.over(`c|${ip}`, 60, 300000)) return busy();
      let mine = 0;
      for (const ws of open) if (ws.deserializeAttachment()?.ip === ip) mine++;
      if (mine >= MAX_SOCKETS_IP) return busy();
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

    if (path === '/api/ticket') {
      // the page asks for its lap ticket as soon as it opens, well before anyone can drive
      if (this.over(`t|${ip}`, 30, 600000)) return busy();
      return json({ key: await this.newTicket() });
    }

    if (path === '/api/lap' && req.method === 'POST') {
      // one lap {name, car, ms, k, ago, splits?, cp?, inp?}, or a batch {laps: [...]} of laps a browser kept
      // and resends. k is the browser's lap ticket and ago how many ms ago the lap ended, by the
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
        const name = cleanName(l?.name), car = cleanCar(l?.car), ms = Math.round(Number(l?.ms));
        if (!name || !car || !(ms >= 60000 && ms <= 3600000)) continue;
        if (!tickets.has(l.k)) tickets.set(l.k, await this.readTicket(l.k));
        const tk = tickets.get(l.k);
        if (!tk) continue;
        if (this.sql.exec('SELECT 1 FROM laps WHERE sid = ? AND car = ? AND ms = ? LIMIT 1', tk.sid, car, ms).toArray().length) { ok.push(ms); continue; }
        // when it was driven: it has to fit between the ticket being issued (or the ticket's last
        // lap ending) and now. 5 s of slack for the trip here.
        const ago = Number(l?.ago);
        const end = now - (ago > 0 ? ago : 0), start = end - ms;
        const last = this.sql.exec('SELECT at FROM laps WHERE sid = ? ORDER BY id DESC LIMIT 1', tk.sid).toArray()[0];
        if (!(ago <= 30 * DAY || !(ago > 0)) || start < tk.t0 - 5000 || (last && start < Date.parse(last.at) - 5000)) continue;
        ok.push(ms);
        const at = new Date(end);
        // split times: rising whole milliseconds inside the lap, with the checkpoint list they are for
        const sp = Array.isArray(l?.splits) && l.splits.length && l.splits.length <= 12 ? l.splits.map((v) => Math.round(Number(v))) : null;
        const cp = typeof l?.cp === 'string' && /^[0-9,]{1,80}$/.test(l.cp) ? l.cp : null;
        const good = sp && cp && sp.length === cp.split(',').length && sp.every((v, k) => v > (k ? sp[k - 1] : 0) && v < ms);
        const row = { name, car, ms, at: at.toISOString(), day: tartuDay(at), splits: good ? sp : null, cp: good ? cp : null, inp: cleanInp(l?.inp) };
        this.sql.exec('INSERT INTO laps (track, name, car, ms, at, day, splits, cp, sid, inp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          TRACK, name, car, ms, row.at, row.day, good ? JSON.stringify(sp) : null, row.cp, tk.sid, row.inp);
        this.addToBoard(row);
        added.push({ name, car, ms });
      }
      if (!ok.length) return json({ error: 'invalid lap' }, 400);
      const board = this.board();
      if (added.length) { this.saveBoard(); this.broadcast({ t: 'board', board, lap: added[added.length - 1] }); }
      return json({ ok: true, saved: ok, board });
    }

    if (path === '/api/laps.csv' || path === '/api/laps.json') {
      if (this.over(`d|${ip}`, 6, 60000)) return busy();
      // the .json is the complete record (the nightly backup saves it, see .github/workflows/backup-laps.yml)
      if (path.endsWith('.json')) return json(this.sql.exec('SELECT id, track, name, car, ms, at, day, splits, cp, inp FROM laps ORDER BY id').toArray());
      const rows = this.sql.exec("SELECT id, track, name, car, ms, at, COALESCE(inp, 'kb') AS input FROM laps ORDER BY id").toArray();
      // (a name that starts like a formula gets an apostrophe, so a spreadsheet shows it as text
      // instead of running it)
      const q = (v) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
      const csv = ['track,driver,car,lap_ms,lap_time,date_utc,id,input']
        .concat(rows.map((r) => [r.track, q(r.name), r.car, r.ms, `${Math.floor(r.ms / 60000)}:${((r.ms % 60000) / 1000).toFixed(2).padStart(5, '0')}`, r.at, r.id, r.input].join(',')))
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
        if (a?.id) { if (!a.ghost) this.broadcast({ t: 'leave', id: a.id }, ws); ws.serializeAttachment({ at: a.at, ip: a.ip }); }
      }
      return;
    }
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
      if (p) this.broadcast(`{"t":"s","id":"${me.id}","p":${JSON.stringify(p)}}`, ws);
      return;
    }
    if (m.t === 'hello') {
      this.prune(ws);
      // the lap ticket: the one this browser already has (it reconnected), else a new one
      const ip = me?.ip || 'local';
      let key = (await this.readTicket(m.k)) ? m.k : null;
      if (!key && !this.over(`t|${ip}`, 30, 600000)) key = await this.newTicket();
      me = ws.deserializeAttachment();
      const id = me?.id || crypto.randomUUID().slice(0, 8);
      const name = cleanName(m.name) || this.freshName();
      // (once a ghost, always a ghost on this socket: a later hello cannot announce it)
      const ghost = !!m.ghost || !!me?.ghost;
      const a = { id, name, car: cleanCar(m.car) || 'w201', at: Date.now(), ip, ...(ghost ? { ghost: true } : {}) };
      ws.serializeAttachment(a);
      ws.send(JSON.stringify({ t: 'welcome', id, key, players: this.players().filter((p) => p.id !== id), board: this.board() }));
      if (!me?.id && !ghost) this.broadcast({ t: 'join', id, name, car: a.car }, ws);
      return;
    }
    if (!me?.id) return;
    if (m.t === 'name') {
      const name = cleanName(m.name);
      if (!name || name === me.name || now - (me.nt || 0) < 1500) return;   // (and not a stream of renames)
      me.name = name; me.nt = now; ws.serializeAttachment(me);
      if (!me.ghost) this.broadcast({ t: 'name', id: me.id, name }, ws);
    } else if (m.t === 'car') {
      const car = cleanCar(m.car);
      if (!car || car === me.car) return;
      me.car = car; ws.serializeAttachment(me);
      if (!me.ghost) this.broadcast({ t: 'car', id: me.id, car }, ws);
    }
  }

  async webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    try { ws.close(); } catch { /* already closed */ }
    if (me?.id && !me.ghost) this.broadcast({ t: 'leave', id: me.id }, ws);
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}
