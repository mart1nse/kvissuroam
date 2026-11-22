// Online race mode (Martin, 2026-11-21): one race at a time for everyone in the lobby.
//
// Anyone driving on the map can vote to START a race (key 1 or the button). When half of the drivers
// have voted (both of two, one when alone) the race is on: five seconds of RACE STARTS IN, in which
// anyone can join or leave, then ten seconds on the grid behind the line on Küüni, five red lights
// one a second, and lights out after a short random hold. One lap from there; the first over the
// line wins. While it runs only racers still in it can vote to RESTART (half of them plus one). Once
// half of the racers have finished, a fresh START vote is open to every driver. A race ends when
// everyone has finished or is out, or seven minutes after the lights.
//
// All times are the server's clock (Date.now()); the browsers keep their offset to it (t: 'clock'),
// so the lights go out at the same moment everywhere and the order is by each racer's own time from
// lights out, not by whose message arrives first. Nothing here is trusted more than a lap time is.

const COUNT_MS = 5000;           // RACE STARTS IN
const GRID_MS = 10000;           // on the grid; the five lights come on in its last five seconds
const HOLD_MIN = 300, HOLD_MAX = 1800;   // all five lit, then out after this (random, the same for all)
const MAX_RACE_MS = 7 * 60000;   // a race is closed this long after lights out
const VOTE_MS = 120000;          // a vote lapses after two minutes
const MAX_RACERS = 30;
const OUT = ['off', 'cut', 'jump', 'car', 'start', 'map', 'left', 'time', 'quit'];

// votes needed: start = half of the drivers (at least 2 when 2 or more), restart = half of the racers plus one
export const needStart = (n) => (n <= 1 ? 1 : Math.max(2, Math.ceil(n / 2)));
export const needRestart = (n) => Math.floor(n / 2) + 1;

export class RaceDesk {
  // lobby: the Durable Object (its sockets, meta storage and broadcast)
  constructor(lobby) {
    this.lobby = lobby;
    let s = null;
    try { s = JSON.parse(lobby.meta('race')); } catch { s = null; }
    this.s = s && typeof s === 'object' ? s : { id: 0, phase: 'idle', racers: [], votes: {}, last: null };
    if (!this.s.votes) this.s.votes = {};
  }
  save() { this.lobby.setMeta('race', JSON.stringify(this.s)); }

  // a socket that has neither pinged nor said hello for 80 s is a page that went to sleep (see prune
  // in index.js, which only runs when someone joins): it must not be counted for a vote
  live(ws, a, now = Date.now()) {
    const ping = this.lobby.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
    return Math.max(ping, a?.at || 0) > now - 80000;
  }
  // everyone connected and driving (not a ghost), id -> attachment
  drivers() {
    const out = new Map();
    for (const ws of this.lobby.ctx.getWebSockets()) {
      if (ws === this.skip) continue;
      const a = ws.deserializeAttachment();
      if (!this.live(ws, a)) continue;
      if (a?.id && !a.ghost && a.drv) out.set(a.id, a);
    }
    return out;
  }
  online() {
    const out = new Set();
    for (const ws of this.lobby.ctx.getWebSockets()) { if (ws === this.skip) continue; const a = ws.deserializeAttachment(); if (a?.id && !a.ghost && this.live(ws, a)) out.add(a.id); }
    return out;
  }

  // the phase by the clock: count until tGrid, grid until tGreen, race after
  phase(now = Date.now()) {
    const s = this.s;
    if (s.phase !== 'on') return 'idle';
    return now < s.tGrid ? 'count' : now < s.tGreen ? 'grid' : 'race';
  }
  active() { return this.s.racers.filter((r) => !r.out); }
  finished() { return this.s.racers.filter((r) => r.ms != null); }
  // during a race: may a fresh start vote be held (half of the racers are through)?
  openForStart() {
    const s = this.s;
    return s.phase === 'on' && this.phase() === 'race' && s.racers.length > 0 && this.finished().length * 2 >= s.racers.length;
  }
  // what the votes are for now, who may cast them and how many are needed
  ballot(now = Date.now()) {
    const ph = this.phase(now);
    if (ph === 'idle' || this.openForStart()) {
      const d = this.drivers();
      return { kind: 'start', voters: new Set(d.keys()), need: needStart(d.size), of: d.size };
    }
    if (ph === 'race') {
      const on = this.online();
      const rs = this.s.racers.filter((r) => !r.out && on.has(r.id)).map((r) => r.id);
      return { kind: 'restart', voters: new Set(rs), need: needRestart(rs.length), of: rs.length };
    }
    return { kind: 'none', voters: new Set(), need: 0, of: 0 };
  }

  view(now = Date.now()) {
    const s = this.s, b = this.ballot(now);
    const votes = Object.entries(s.votes).filter(([id, v]) => v.k === b.kind && b.voters.has(id) && now - v.t < VOTE_MS).map(([id]) => id);
    return {
      id: s.id, on: s.phase === 'on', tGrid: s.tGrid, tGreen: s.tGreen, seed: s.seed,
      racers: s.racers, vote: { kind: b.kind, ids: votes, need: b.need, of: b.of }, last: s.last, now,
    };
  }
  send() { this.lobby.broadcast({ t: 'race', r: this.view() }); }
  sendTo(ws) { try { ws.send(JSON.stringify({ t: 'race', r: this.view() })); } catch { /* closing */ } }

  start(ids, now) {
    const s = this.s;
    if (s.phase === 'on') this.close('restart', now);
    const d = this.drivers();
    s.id = (s.id || 0) + 1;
    s.phase = 'on';
    s.tGrid = now + COUNT_MS;
    s.tGreen = s.tGrid + GRID_MS + HOLD_MIN + Math.floor(Math.random() * (HOLD_MAX - HOLD_MIN));
    s.seed = Math.floor(Math.random() * 1e9);
    s.racers = [...ids].slice(0, MAX_RACERS).map((id) => ({ id, name: d.get(id)?.name || '?', car: d.get(id)?.car || 'w201' }));
    s.votes = {};
    this.lobby.ctx.storage.setAlarm(s.tGreen + MAX_RACE_MS).catch?.(() => {});
  }
  // the race is over: what it came to stays as the last race
  close(why, now = Date.now()) {
    const s = this.s;
    if (s.phase !== 'on') return;
    for (const r of s.racers) if (r.ms == null && !r.out) r.out = why === 'restart' ? 'quit' : 'time';
    const results = s.racers.filter((r) => s.tGreen && now >= s.tGreen);
    // (a race nobody finished, e.g. cancelled by its only driver, leaves the last results as they were)
    s.last = results.some((r) => r.ms != null) ? { id: s.id, at: now, racers: results.map((r) => ({ id: r.id, name: r.name, car: r.car, ms: r.ms ?? null, out: r.out || null })) } : s.last;
    s.phase = 'idle';
    s.racers = [];
    s.votes = {};
  }
  // everyone done?
  check(now) {
    const s = this.s;
    if (s.phase !== 'on') return;
    if (now >= s.tGreen + MAX_RACE_MS) { this.close('time', now); return; }
    // nobody left on the grid before the lights: nothing to race
    if (!s.racers.length || (now >= s.tGrid && !this.active().length)) { this.close('empty', now); return; }
    if (now >= s.tGreen && s.racers.every((r) => r.ms != null || r.out)) this.close('done', now);
  }
  tally(now) {
    const b = this.ballot(now);
    if (b.kind === 'none' || !b.of) return false;
    const ids = Object.entries(this.s.votes).filter(([id, v]) => v.k === b.kind && b.voters.has(id) && now - v.t < VOTE_MS).map(([id]) => id);
    if (ids.length < b.need) return false;
    this.start(ids, now);
    return true;
  }

  // a message from a browser (me: its attachment). Returns true when it was a race message.
  message(ws, me, m) {
    const now = Date.now();
    switch (m.t) {
      case 'clock':
        try { ws.send(JSON.stringify({ t: 'clock', c: Number(m.c) || 0, s: now })); } catch { /* closing */ }
        if (m.r) this.sendTo(ws);     // the browser has no race state yet
        return true;
      case 'drv': {
        const on = !!m.on;
        if (!!me.drv === on) return true;
        me.drv = on; ws.serializeAttachment(me);
        this.check(now); this.tally(now); this.save(); this.send();
        return true;
      }
      case 'rv': {          // vote (start or restart, whichever is open), or take it back
        if (me.ghost) return true;
        const b = this.ballot(now);
        if (!b.voters.has(me.id)) { this.sendTo(ws); return true; }
        if (m.on) this.s.votes[me.id] = { k: b.kind, t: now }; else delete this.s.votes[me.id];
        this.tally(now); this.save(); this.send();
        return true;
      }
      case 'rj': {          // join or leave before the lights
        if (me.ghost || this.s.phase !== 'on') return true;
        const ph = this.phase(now), i = this.s.racers.findIndex((r) => r.id === me.id);
        if (m.on && ph === 'count' && i < 0 && this.s.racers.length < MAX_RACERS && me.drv) this.s.racers.push({ id: me.id, name: me.name, car: me.car });
        else if (!m.on && i >= 0 && ph !== 'race') this.s.racers.splice(i, 1);
        else if (!m.on && i >= 0 && !this.s.racers[i].out && this.s.racers[i].ms == null) this.s.racers[i].out = 'quit';
        this.check(now); this.save(); this.send();
        return true;
      }
      case 'rf': {          // finished: ms from lights out, by the browser's (synced) clock
        const r = this.s.phase === 'on' && this.s.racers.find((x) => x.id === me.id);
        const ms = Math.round(Number(m.ms));
        if (!r || r.ms != null || r.out || !(ms >= 30000 && ms <= MAX_RACE_MS) || now < this.s.tGreen + 25000) return true;
        r.ms = ms;
        this.check(now); this.save(); this.send();
        return true;
      }
      case 'rd': {          // out of the race (off the track, a jump, another car)
        const r = this.s.phase === 'on' && this.s.racers.find((x) => x.id === me.id);
        if (!r || r.ms != null || r.out) return true;
        r.out = OUT.includes(m.why) ? m.why : 'quit';
        this.check(now); this.save(); this.send();
        return true;
      }
      default:
        return false;
    }
  }
  // a racer's car or name changed
  changed(me) {
    const r = this.s.phase === 'on' && this.s.racers.find((x) => x.id === me.id);
    if (!r) return;
    r.name = me.name; r.car = me.car;
    this.save(); this.send();
  }
  // a socket went away
  gone(me, ws) {
    if (!me?.id) return;
    this.skip = ws;
    try { this.left(me); } finally { this.skip = null; }
  }
  // a racer's page came back after its connection dropped (same id): still in the race
  back(me) {
    const r = this.s.phase === 'on' && this.phase() === 'race' && this.s.racers.find((x) => x.id === me.id);
    if (!r || r.out !== 'left') return;
    delete r.out;
    this.save(); this.send();
  }
  left(me) {
    const s = this.s, now = Date.now();
    delete s.votes[me.id];
    if (s.phase === 'on') {
      const i = s.racers.findIndex((r) => r.id === me.id);
      if (i >= 0) { if (this.phase(now) === 'race') { if (s.racers[i].ms == null && !s.racers[i].out) s.racers[i].out = 'left'; } else s.racers.splice(i, 1); }
      this.check(now);
    }
    this.tally(now);
    this.save(); this.send();
  }
  alarm() {
    const now = Date.now();
    this.check(now);
    if (this.s.phase === 'on') this.lobby.ctx.storage.setAlarm(Math.max(now + 1000, this.s.tGreen + MAX_RACE_MS));
    this.save(); this.send();
  }
}
