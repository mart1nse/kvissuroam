// StreetLap server: the static game is served as assets; this Worker answers /api/*.
//
// One Durable Object ("lobby") holds everyone who has the game open. Each browser keeps a
// WebSocket to it and sends its car's position about ten times a second while someone else is
// online; the lobby passes positions on to the others and announces joins, leaves and name
// changes. The sockets use the hibernation API, so an idle lobby costs nothing.
//
// Lap times live in the lobby's SQLite storage (table `laps`). GET /api/laps.csv downloads all
// of them; GET /api/board gives the best lap per car, all time and today (Tartu time).
import { DurableObject } from 'cloudflare:workers';

const TRACK = 'toomemagi';
const ADJ = ['Neon', 'Chrome', 'Turbo', 'Pastel', 'Laser', 'Sunset', 'Retro', 'Velvet', 'Cosmic', 'Digital', 'Synth', 'Vapor', 'Electric', 'Midnight', 'Magenta', 'Cyber'];
const NOUN = ['Otter', 'Falcon', 'Lynx', 'Comet', 'Dolphin', 'Palm', 'Flamingo', 'Tiger', 'Wave', 'Fox', 'Moose', 'Heron', 'Beaver', 'Hedgehog', 'Stork', 'Badger'];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const tartuDay = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(d);   // YYYY-MM-DD
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
const cleanCar = (s) => String(s ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 16);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
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
    // keep-alive pings are answered without waking the object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  players() {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.id) out.push(a);
    }
    return out;
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

  board() {
    const day = tartuDay();
    const best = (where, ...args) => this.sql.exec(
      `SELECT car, name, MIN(ms) AS ms, at FROM laps WHERE track = ? ${where} GROUP BY car`, TRACK, ...args).toArray();
    const count = this.sql.exec('SELECT COUNT(*) AS n FROM laps WHERE track = ?', TRACK).one().n;
    return { track: TRACK, day, allTime: best(''), today: best('AND day = ?', day), laps: count };
  }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/api/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (path === '/api/name') {
      // a default name nobody has finished a lap with (and nobody online is using)
      return json({ name: this.freshName() });
    }

    if (path === '/api/board') return json(this.board());

    if (path === '/api/lap' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const name = cleanName(body.name), car = cleanCar(body.car), ms = Math.round(Number(body.ms));
      if (!name || !car || !(ms >= 60000 && ms <= 3600000)) return json({ error: 'invalid lap' }, 400);
      const now = new Date();
      this.sql.exec('INSERT INTO laps (track, name, car, ms, at, day) VALUES (?, ?, ?, ?, ?, ?)', TRACK, name, car, ms, now.toISOString(), tartuDay(now));
      const board = this.board();
      this.broadcast({ t: 'board', board, lap: { name, car, ms } });
      return json({ ok: true, board });
    }

    if (path === '/api/laps.csv' || path === '/api/laps.json') {
      const rows = this.sql.exec('SELECT track, name, car, ms, at FROM laps ORDER BY id').toArray();
      if (path.endsWith('.json')) return json(rows);
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = ['track,driver,car,lap_ms,lap_time,date_utc']
        .concat(rows.map((r) => [r.track, q(r.name), r.car, r.ms, `${Math.floor(r.ms / 60000)}:${((r.ms % 60000) / 1000).toFixed(2).padStart(5, '0')}`, r.at].join(',')))
        .join('\n');
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'inline; filename="streetlap-laps.csv"', 'cache-control': 'no-store' } });
    }

    return json({ error: 'not found' }, 404);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment();

    if (m.t === 's' && me?.id) {
      // position: pass straight on
      if (Array.isArray(m.p) && m.p.length <= 12) this.broadcast(`{"t":"s","id":"${me.id}","p":${JSON.stringify(m.p)}}`, ws);
      return;
    }
    if (m.t === 'hello') {
      const id = me?.id || crypto.randomUUID().slice(0, 8);
      const name = cleanName(m.name) || this.freshName();
      const a = { id, name, car: cleanCar(m.car) || 'w201' };
      ws.serializeAttachment(a);
      ws.send(JSON.stringify({ t: 'welcome', id, players: this.players().filter((p) => p.id !== id), board: this.board() }));
      if (!me?.id) this.broadcast({ t: 'join', ...a }, ws);
      return;
    }
    if (!me?.id) return;
    if (m.t === 'name') {
      const name = cleanName(m.name);
      if (!name) return;
      me.name = name; ws.serializeAttachment(me);
      this.broadcast({ t: 'name', id: me.id, name }, ws);
    } else if (m.t === 'car') {
      me.car = cleanCar(m.car) || me.car; ws.serializeAttachment(me);
      this.broadcast({ t: 'car', id: me.id, car: me.car }, ws);
    }
  }

  async webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    try { ws.close(); } catch { /* already closed */ }
    if (me?.id) this.broadcast({ t: 'leave', id: me.id }, ws);
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}
