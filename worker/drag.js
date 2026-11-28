// The drag strip at Ülenurme (src/race/drag.js; tried out behind ?drag=1 from 27 Nov 2026): its two lanes.
//
// A driver who pulls into a lane's box on the strip says so ('in'), and leaves it again ('out', also at the end
// of a run). Everyone is told who holds which lane ('lanes'), so a taken lane's box does not take a second car
// and the tree's pre-stage and stage lamps show for it. When both lanes are held and neither is on a run, the
// race of two starts by itself: 'go' with the moment of green on the server's clock (a little ahead, so that
// both pages have it before the first amber), told to everyone, so that whoever is near sees the tree run.
// A driver on the line alone may PRACTICE: 'solo' with their own green, passed on the same way, and their lane
// is busy until they are done.
// Each runner sends their run's figures at its end ('end'), passed on to all as 'res': each page judges the race
// from the two runs (the first over the line, each by their own reaction and run; a red light loses).
// While the tree and the run are on, each sends its place on the strip about 30 times a second ('dp'), passed on
// at once to the other driver only (feed): their car is drawn where it is on the other screen, not 0.1 s late as
// the ordinary positions are. That stream has its own allowance and does not count against the socket's.
// Who holds a lane (and its run) is also written on that driver's socket (dl, dr, da, dg, do in its attachment), so a
// lobby woken from hibernation with its pages still connected has its lanes back; after a restart (every socket gone)
// the pages say 'in' again when they are on a line (on 'welcome').
// After a race of two either driver may ask the other for a rematch ('re'): passed on to that driver only, and only
// when they were the asker's last opponent here, at most one a few seconds; 'reno' takes their no back the same way.
// (The asker is back on their line by then; the other's yes is them pulling into their lane, and the race starts as any.)
// A clean quarter mile, practice or race, goes on the drag strip's board (the lobby's laps table, track 'drag'; Martin
// 27 Nov 2026) when it is a run this desk started for that socket, the server's own clock has run at least its
// R/T + ET since its green, and the car could have done it (src/race/dragrules.js).
// a race of two: green this long after both are in (+ up to RAND_MS), the first amber 1.5 s before it; was 2.6 s until 28 Nov,
// when the pages began to hold the start a few seconds over both cars first (src/race/drag.js HOLD_S)
const LEAD_MS = 7000;
const RAND_MS = 900;
const SOLO_MIN = 400, SOLO_MAX = 6000;     // a practice's green: this soon and no later
const FEED_MAX = 45;            // place messages a second a socket may send (it sends 30)
const CLOCK_SLACK = 1500;       // a run's figures may come this much before its R/T + ET after green has passed here (the page's estimate of this clock)
const TIME_MAX = 120000;        // and no later than this after green
// a lane on a run longer than this is freed (a page gone quiet): not before its figures could still come, since a page
// under 20 frames a second drives in slow motion (a quarter mile of 18 s took 87 s on a test machine, 27 Nov 2026,
// and its lane had been freed at 60 s with the run, so the time never reached the board)
const RUN_MAX = TIME_MAX + SOLO_MAX + 2000;
const RE_GAP = 4000;            // ms between one driver's rematch questions

import { dragRefused } from '../src/race/dragrules.js';

export class DragDesk {
  constructor(lobby) {
    this.lobby = lobby;
    this.lanes = [null, null];  // { id, name, ws, run, at, go, opp, kept }
    this.n = 0;
    this.rate = new WeakMap();
    this.last = new Map();      // id: the id of the last driver they raced, and when they last asked for a rematch { opp, re }
    // (woken from hibernation: the lanes as their sockets hold them)
    for (const ws of lobby.ctx?.getWebSockets?.() || []) {
      let a = null;
      try { a = ws.deserializeAttachment(); } catch { /* closing */ }
      if (a?.id && !a.x && (a.dl === 1 || a.dl === 2) && !this.lanes[a.dl - 1]) this.lanes[a.dl - 1] = { id: a.id, name: a.name, ws, run: a.dr || '', at: a.da || Date.now(), go: a.dg || 0, opp: a.do || '' };
    }
  }
  // a lane's holder written on their socket (k: the lane, or -1 for none)
  mark(ws, k) {
    if (!ws) return;
    try {
      const a = ws.deserializeAttachment();
      if (!a?.id) return;
      const l = this.lanes[k];
      delete a.dl; delete a.dr; delete a.da; delete a.dg; delete a.do;
      if (l && l.ws === ws) { a.dl = k + 1; if (l.run) { a.dr = l.run; a.da = l.at; a.dg = l.go; } if (l.opp) a.do = l.opp; }
      ws.serializeAttachment(a);
    } catch { /* closing */ }
  }
  view() { return this.lanes.map((l) => l && { id: l.id, name: l.name, run: l.run ? 1 : 0 }); }
  tell() { this.lobby.broadcast({ t: 'drag', op: 'lanes', l: this.view() }); }
  sendTo(ws) { if (this.lanes.some(Boolean)) try { ws.send(JSON.stringify({ t: 'drag', op: 'lanes', l: this.view() })); } catch { /* closing */ } }
  // lanes on a run for too long are freed
  sweep(now) {
    let changed = false;
    for (let k = 0; k < 2; k++) { const l = this.lanes[k]; if (l?.run && now - l.at > RUN_MAX) { this.lanes[k] = null; this.mark(l.ws, -1); changed = true; } }
    return changed;
  }
  out(id) {
    let changed = false;
    for (let k = 0; k < 2; k++) { const l = this.lanes[k]; if (l?.id === id) { this.lanes[k] = null; this.mark(l.ws, -1); changed = true; } }
    return changed;
  }
  // both lanes held and free: the race of two
  pair(now) {
    const [a, b] = this.lanes;
    if (!a || !b || a.run || b.run || a.id === b.id) return;
    const run = `d${++this.n}${now % 100000}`, go = now + LEAD_MS + Math.round(Math.random() * RAND_MS);
    a.run = b.run = run; a.at = b.at = now; a.go = b.go = go; a.kept = b.kept = false; a.opp = b.id; b.opp = a.id;
    if (this.last.size > 500) this.last.clear();
    this.last.set(a.id, { opp: b.id, re: 0 }); this.last.set(b.id, { opp: a.id, re: 0 });
    this.mark(a.ws, 0); this.mark(b.ws, 1);
    this.lobby.broadcast({ t: 'drag', op: 'go', run, go, l: [a.id, b.id] });
  }
  // true when the message was a drag one
  message(ws, me, m) {
    if (m.t !== 'drag') return false;
    if (me.ghost) return true;
    const now = Date.now();
    let changed = this.sweep(now);
    if (m.op === 'in' && (m.l === 0 || m.l === 1)) {
      const held = this.lanes[m.l];
      if (held && held.id !== me.id) { try { ws.send(JSON.stringify({ t: 'drag', op: 'no', l: m.l })); } catch { /* closing */ } }
      else if (held && !held.run && held.ws === ws) {
        // (said again: after a reconnect, or as the page's own check; nothing changes)
        if (changed) this.tell();
        return true;
      } else {
        this.out(me.id);
        this.lanes[m.l] = { id: me.id, name: me.name, ws, run: '', at: now, go: 0, opp: '' };
        this.mark(ws, m.l);
        this.tell();
        this.pair(now);
        return true;
      }
    } else if (m.op === 'out') {
      changed = this.out(me.id) || changed;
    } else if (m.op === 'solo' && Number.isFinite(m.go)) {
      const k = this.lanes.findIndex((l) => l?.id === me.id);
      const l = this.lanes[k];
      if (l && !l.run) {
        const go = Math.max(now + SOLO_MIN, Math.min(now + SOLO_MAX, Math.round(m.go)));
        l.run = `p${++this.n}${now % 100000}`; l.at = now; l.go = go; l.kept = false; l.opp = '';
        this.mark(ws, k);
        const ids = [null, null];
        ids[k] = me.id;
        this.lobby.broadcast({ t: 'drag', op: 'go', run: l.run, go, l: ids });
        changed = true;
      }
    } else if ((m.op === 're' || m.op === 'reno') && typeof m.id === 'string') {
      const l = this.last.get(me.id);
      if (l && l.opp === m.id && (m.op === 'reno' || now - l.re > RE_GAP)) {
        if (m.op === 're') l.re = now;
        this.to(m.id, { t: 'drag', op: m.op, id: me.id, name: me.name });
      }
    } else if (m.op === 'end' && typeof m.run === 'string' && m.run.length < 24 && m.r && typeof m.r === 'object') {
      const r = {};
      for (const k of ['rt', 'et', 't60', 't330', 't8', 't1000', 'v8', 'vq', 'tot']) { const v = m.r[k]; r[k] = Number.isFinite(v) && Math.abs(v) < 1000 ? v : null; }
      for (const k of ['red', 'foul', 'dnf']) r[k] = m.r[k] ? 1 : 0;
      const l = this.lanes.find((x) => x?.ws === ws && x.run === m.run);
      // (a race of two's figures to both pages: each judges the race from the two runs)
      if (m.run.startsWith('d')) this.lobby.broadcast({ t: 'drag', op: 'res', id: me.id, run: m.run, r });
      // the board: once a run, one this desk started for this socket, not sooner after its green than it took
      if (l && l.go && !l.kept) {
        l.kept = true;
        const took = now - l.go, need = ((r.rt ?? 0) + (r.et ?? 0)) * 1000;
        const why = took < need - CLOCK_SLACK || took > TIME_MAX ? 'clock' : dragRefused(me.car, r);
        if (!why) this.lobby.dragTime?.({ name: me.name, car: me.car, ip: me.ip, inp: m.inp, r });
        else if (why !== 'not clean') this.lobby.dragRefused?.(me, r, why);
      }
    }
    if (changed) this.tell();
    return true;
  }
  // a place on the strip, 30 times a second, from a driver on a race of two: on to the other driver at once
  feed(ws, raw) {
    const me = ws.deserializeAttachment();
    if (!me?.id || me.ghost) return;
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r) { r = { t: now, n: 0 }; this.rate.set(ws, r); }
    if (now - r.t > 1000) { r.t = now; r.n = 0; }
    if (++r.n > FEED_MAX) return;
    const l = this.lanes.find((x) => x?.id === me.id);
    if (!l?.opp) return;
    const o = this.lanes.find((x) => x?.id === l.opp);
    if (!o?.ws) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const a = m?.a;
    if (!Array.isArray(a) || a.length > 6 || !a.every((v) => typeof v === 'number' && Number.isFinite(v))) return;
    try { o.ws.send(JSON.stringify({ t: 'dp', id: me.id, a })); } catch { /* closing */ }
  }
  // a message to one driver, by their id
  to(id, msg) {
    const s = JSON.stringify(msg);
    for (const ws of this.lobby.ctx?.getWebSockets?.() || []) {
      let a = null;
      try { a = ws.deserializeAttachment(); } catch { continue; }
      if (a?.id === id && !a.ghost) { try { ws.send(s); } catch { /* closing */ } }
    }
  }
  gone(me) { if (me?.id && this.out(me.id)) this.tell(); }
  // the same page on a new connection (a lost one taken over): its lane follows it
  back(id, ws) { for (let k = 0; k < 2; k++) { const l = this.lanes[k]; if (l?.id === id) { l.ws = ws; this.mark(ws, k); } } }
}
