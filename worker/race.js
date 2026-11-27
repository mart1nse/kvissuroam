// Online race mode (Martin, 2026-11-21): one race at a time for everyone in the lobby.
//
// Anyone driving on the map can vote to START a race (key 1 or the button). When half of the drivers
// have voted (both of two, one when alone; at most 5 to 8 with many on the map, see needStart) the race is on: five seconds of RACE STARTS IN, in which
// anyone can join or leave, then ten seconds on the grid behind the line on Küüni, five red lights
// one a second, and lights out after a short random hold. One lap from there; the first over the
// line wins. While it runs only racers still in it can vote to RESTART (half of them plus one). Once
// half of the racers have finished, a fresh START vote is open to every driver. A race ends when
// everyone has finished or is out, or seven minutes after the lights. A racer whose car has stood still
// for a minute after their lights is out (STILL_MS), and so is one who has not got on with the lap for a
// minute once the winner is through (IDLE_MS).
//
// All times are the server's clock (Date.now()); the browsers keep their offset to it (t: 'clock'),
// so the lights go out at the same moment everywhere and the order is by each racer's own time from
// lights out, not by whose message arrives first.
//
// Since 26 Nov 2026 the server follows each racer round the lap itself, from the positions they send
// (worker/follow.js): a finish is taken only from a car it saw stand on the grid, start after its lights, pass
// the lap's gates in order and cross the line, and at about the moment it saw that. (Until then "finished" was
// the racer's word, and one sent two minutes after the lights won any race.)
import { CARS, HIDDEN_CARS } from '../src/cars/specs.js';
import { follow, newFollow, finishInGap, driven, PASS } from './follow.js';
import { OLD_PAGES_UNTIL } from './cutover.js';
import { judgeDrive } from '../src/race/plausible.js';

const COUNT_MS = 5000;           // RACE STARTS IN
const GRID_MS = 10000;           // on the grid; the five lights come on in its last five seconds
const LATE_MS = 150000;          // join after the lights up to this long (Martin 2026-11-22), with a start of one's own
// a late joiner's own start (Martin 2026-11-23: straight to the lights, no count first; 24 Nov: the race is on,
// in as quickly as possible, one red lamp and go): their grid time is set five seconds back, so the lamp is on
// as they land on the grid, out at LATE_GO (time for the join to reach the page and the car to be put there)
const LATE_GO = 2000;
const HOLD_MIN = 300, HOLD_MAX = 1800;   // all five lit, then out after this (random, the same for all)
const MAX_RACE_MS = 7 * 60000;   // a race is closed this long after lights out
const RACE_MIN_MS = 120000;     // no finish faster than this (a lap of Toomemägi: LAP_MIN in index.js)
const FINISH_EARLY = 3000;      // a finish may claim this much more than the server's clock has run (clock sync)
const FINISH_LATE = 10000;      // and at most this much less (the message on its way, a short dropout)
// (800 until 26 Nov 2026. Martin: "within half a second nobody most likely cares ... even up to 1,5 s might be fine")
export const SEEN_EARLY = 1500; // a finish may be this much before the server saw the car over the line (ten positions a second, and their way here)
const CLAIM_WAIT = 3000;        // "finished" waits this long for the position that shows it
const SAVE_MS = 5000;           // what the server has seen of the racers is written down this often (a deploy restarts it mid-race)
const VOTE_MS = 120000;          // a vote lapses after two minutes
const MAX_RACERS = 30;
// Standing still (Martin 2026-11-26: all through but one who started and then stood, and the race stayed open for the
// rest of the seven minutes): a racer whose positions show the car within STILL_M of one place for STILL_MS after
// their lights is out ('still'). Judged only on positions coming in one after another (a gap over STILL_GAP starts
// the minute again), so a page that went quiet is left to quiet() as before.
const STILL_MS = 60000, STILL_M = 25, STILL_GAP = 5000;
// Not getting on with the lap once the winner is through (Martin 2026-11-26 22:34, the same racer stalling a race at
// 0.1 km again: "inactivity timeout for players who are not actually driving at 1 min after the winner finishes"): a
// minute after the first finish, a racer who has passed none of the lap's gates (follow.js) for IDLE_MS is out
// ('idle'). Unlike 'still' it needs no positions at all (a page that sends none is not driving the lap either), and a
// car that potters about off its way round is caught as well as one that stands.
const IDLE_MS = 60000;
// A deploy restarts the server (Martin 2026-11-26 20:46: every connection dropped mid-race and the race was gone, a
// new vote needed). The race itself is read back from storage, but the server came up with no sockets, so the first
// look at the racers found none of them there, put them all out as 'left' and closed the race as empty before the
// pages were back (they ask again after 2, 4, 8 and 16 s, src/net/multiplayer.js). For BACK_MS after the server
// starts, nobody is put out for a quiet page; and a racer whose socket closed ('left' with lt, the time) still holds
// the race open for BACK_MS, so a page that comes back in that time (back()) is in the race again. (One put out by
// quiet() has had its time already: asleep 80 s, or off the map past the page's own 30 s.)
const BACK_MS = 45000;
const OUT = ['off', 'cut', 'jump', 'car', 'start', 'map', 'left', 'time', 'quit'];   // (what a page may say; 'ref': the server did not take the finish)

// votes needed: start = half of the drivers (at least 2 when 2 or more), restart = half of the racers plus one.
// With many on the map half was too many to get a race going (Martin 2026-11-23): never more than 5 up to
// 15 drivers, 6 for 16 to 20, 7 for 21 to 25, 8 from 26. The restart vote keeps its half plus one.
export const needStart = (n) => {
  if (n <= 1) return 1;
  const half = Math.max(2, Math.ceil(n / 2));
  return Math.min(half, n <= 15 ? 5 : n <= 20 ? 6 : n <= 25 ? 7 : 8);
};
export const needRestart = (n) => Math.floor(n / 2) + 1;

export class RaceDesk {
  // lobby: the Durable Object (its sockets, meta storage and broadcast)
  constructor(lobby) {
    this.lobby = lobby;
    let s = null;
    try { s = JSON.parse(lobby.meta('race')); } catch { s = null; }
    this.s = s && typeof s === 'object' ? s : { id: 0, phase: 'idle', racers: [], votes: {}, last: null };
    if (!this.s.votes) this.s.votes = {};
    this.fol = new Map();         // racer id -> what the server has seen of their lap (follow.js), in memory
    this.savedAt = 0;
    // when the server started with nobody connected (a deploy or another restart: every socket gone, the pages on their
    // way back), else 0 (woken from hibernation with its pages still connected): see BACK_MS
    this.boot = lobby.ctx.getWebSockets().length ? 0 : Date.now();
  }
  save() { this.lobby.setMeta('race', JSON.stringify(this.s)); this.savedAt = Date.now(); }

  // Race stats for /stats (Martin 2026-11-22): votes are counted here and sent to the stats object
  // with each race as it closes, or with the votes that lapsed. One small message per race, no names.
  count(k) { const vc = (this.s.vc ||= {}); vc[k] = (vc[k] || 0) + 1; }
  report(race) {
    const votes = this.s.vc || {};
    this.s.vc = {};
    try { this.lobby.raceStat?.({ v: 1, votes, ...race }); } catch { /* stats are never worth a race */ }
  }
  // start votes older than VOTE_MS are dropped (they no longer count) and counted as lapsed
  lapse(now) {
    let n = 0;
    for (const [id, v] of Object.entries(this.s.votes)) if (now - v.t >= VOTE_MS) { delete this.s.votes[id]; if (v.k === 'start') n++; }
    if (!n) return;
    for (let i = 0; i < n; i++) this.count('lapsed');
    if (this.s.phase !== 'on') this.report({});
  }

  // a socket that has neither pinged nor said hello for 80 s is a page that went to sleep (see prune
  // in index.js, which only runs when someone joins): it must not be counted for a vote
  live(ws, a, now = Date.now()) {
    const ping = this.lobby.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
    return Math.max(ping, a?.at || 0) > now - 80000;
  }
  // in the race now (on the grid or driving it, not finished or out): keeps the place even from the garage
  racing(id) { return this.s.phase === 'on' && this.s.racers.some((r) => r.id === id && !r.out && r.ms == null); }
  // A car with thrusters does not race (Martin 26 Nov: "do not allow the tesla to take part in races"). Whoever sits
  // in one may still vote and join (Martin 27 Nov, "vote, then swap car"): the vote or join names the car they race
  // in instead (sw, the last one their page had before), which goes on the list and their page swaps into on the grid.
  // Without a car to race in they are left off; one who takes such a car before their lights is off the list again
  // (changed), and one still in it at their lights is out (check).
  noRace(car) { return !!CARS[car]?.thrusters; }
  swapCar(sw) { return typeof sw === 'string' && Object.hasOwn(CARS, sw) && !this.noRace(sw) && !HIDDEN_CARS.includes(sw) ? sw : null; }
  // the car a driver goes on the list in: their own, or for one that does not race the one they named
  raceCar(car, sw) { return this.noRace(car) ? this.swapCar(sw) : car; }
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
  // spectators (Martin, 2026-11-24: "allow me to vote for start when i am watching"): following another car,
  // their own off the map, id -> attachment. They may vote to start and join a race; one counts in the start
  // vote's pool only once their vote is in, so a spectator who just watches never makes a start harder.
  watchers() {
    const out = new Map();
    for (const ws of this.lobby.ctx.getWebSockets()) {
      if (ws === this.skip) continue;
      const a = ws.deserializeAttachment();
      if (!this.live(ws, a)) continue;
      if (a?.id && !a.ghost && !a.drv && a.w === 'watch') out.set(a.id, a);
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
  // still in the race, or gone with their connection so lately that they may yet come back (BACK_MS)
  held(r, now = Date.now()) { return !r.out || (r.out === 'left' && now - (r.lt || 0) < BACK_MS); }
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
      const d = this.drivers(), sp = this.watchers();
      const voters = new Set([...d.keys(), ...sp.keys()]);
      let of = d.size;
      for (const id of sp.keys()) { const v = this.s.votes[id]; if (v?.k === 'start' && now - v.t < VOTE_MS) of++; }
      return { kind: 'start', voters, need: needStart(of), of };
    }
    if (ph === 'race') {
      const on = this.online();
      const rs = this.s.racers.filter((r) => !r.out && on.has(r.id)).map((r) => r.id);
      // the last racer left in, with others driving about: no restart into a race of one (Martin 2026-11-22);
      // their button ends the race instead, and then everyone can vote. Alone in the world, a restart is fine.
      if (rs.length === 1 && [...this.drivers().keys()].some((id) => id !== rs[0])) return { kind: 'none', voters: new Set(), need: 0, of: 0 };
      return { kind: 'restart', voters: new Set(rs), need: needRestart(rs.length), of: rs.length };
    }
    return { kind: 'none', voters: new Set(), need: 0, of: 0 };
  }

  view(now = Date.now()) {
    const s = this.s, b = this.ballot(now);
    const votes = Object.entries(s.votes).filter(([id, v]) => v.k === b.kind && b.voters.has(id) && now - v.t < VOTE_MS).map(([id]) => id);
    return {
      id: s.id, on: s.phase === 'on', tGrid: s.tGrid, tGreen: s.tGreen, seed: s.seed,
      // (without what the server keeps of each racer's lap for itself: gates, grid, the line, gaps, a finish not yet seen)
      racers: s.racers.map(({ gt, gs, arm, fs, sk, skm, jp, cl, still, lt, ...r }) => r), vote: { kind: b.kind, ids: votes, need: b.need, of: b.of }, last: s.last, now,
    };
  }
  send() { this.lobby.broadcast({ t: 'race', r: this.view() }); }
  sendTo(ws) { try { ws.send(JSON.stringify({ t: 'race', r: this.view() })); } catch { /* closing */ } }

  start(ids, now) {
    const s = this.s;
    if (s.phase === 'on') this.close('restart', now);
    const d = new Map([...this.watchers(), ...this.drivers()]);
    s.id = (s.id || 0) + 1;
    s.phase = 'on';
    s.tGrid = now + COUNT_MS;
    s.tGreen = s.tGrid + GRID_MS + HOLD_MIN + Math.floor(Math.random() * (HOLD_MAX - HOLD_MIN));
    s.seed = Math.floor(Math.random() * 1e9);
    s.racers = [...ids].map((id) => ({ id, name: d.get(id)?.name || '?', car: this.raceCar(d.get(id)?.car || 'w201', s.votes[id]?.sw), ...(this.noRace(d.get(id)?.car) ? { sw: 1 } : {}) }))
      .filter((r) => r.car).slice(0, MAX_RACERS);
    s.votes = {};
    this.fol.clear();
    // first at the lights (the restart vote opens then, and everyone has to hear it: Martin 2026-11-22
    // saw no RESTART until some other message came), then at the 7:00 cut-off (alarm below)
    this.lobby.ctx.storage.setAlarm(s.tGreen).catch?.(() => {});
  }
  // the race is over: what it came to stays as the last race
  close(why, now = Date.now()) {
    const s = this.s;
    if (s.phase !== 'on') return;
    // for /stats: how it went (called off before the lights: only that)
    this.report(now >= s.tGreen ? {
      ran: true, end: why, at: s.tGreen,
      racers: s.racers.map((r) => ({ car: r.car, ms: r.ms ?? null, out: r.ms != null ? null : r.out || (why === 'restart' ? 'restart' : 'time'), late: r.late ? 1 : 0 })),
    } : { ran: false });
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
    // (on the list from a car that does not race, sw, and still in it at their lights: the page never swapped, out;
    // looked at once, at the lights)
    let d = null;
    for (const r of s.racers) {
      if (!r.sw || now < (r.go || s.tGreen)) continue;
      d ||= new Map([...this.watchers(), ...this.drivers()]);
      if (!r.out && r.ms == null && this.noRace(d.get(r.id)?.car)) r.out = 'car';
      delete r.sw;
    }
    this.quiet(now);
    // nobody left on the grid before the lights: nothing to race
    for (const r of s.racers) if (r.cl) this.settle(r, now);
    if (!s.racers.length || (now >= s.tGrid && !s.racers.some((r) => this.held(r, now)))) { this.close('empty', now); return; }
    if (now >= s.tGreen && s.racers.every((r) => r.ms != null || !this.held(r, now))) this.close('done', now);
  }
  // Racers still in the race whose page is gone quiet (Martin 2026-11-24: all finished or out, yet the race ran on
  // to 7:00): no live socket (asleep, or its 'rf'/'rd' never got through), or off the map for good (another tab,
  // the menu: the page's own 30 s grace has passed). They are out ('left'), so the race ends when the rest are done.
  quiet(now) {
    const s = this.s;
    if (this.phase(now) !== 'race' || now - this.boot < BACK_MS) return;
    // (the winner over the line, by the race's clock: see IDLE_MS; Infinity while nobody is through)
    let win = Infinity;
    for (const r of s.racers) if (r.ms != null && r.ms < win) win = r.ms;
    const winAt = s.tGreen + win;
    let on = null, d = null;
    for (const r of s.racers) {
      if (r.out || r.ms != null || now < (r.go || s.tGreen) + 10000) continue;
      // (the last gate passed, else the racer's own lights; not once seen over the line or with a finish waiting)
      if (r.fs == null && !r.cl && now - Math.max(winAt, r.gs || 0, r.go || s.tGreen) > IDLE_MS) { r.out = 'idle'; continue; }
      on ||= this.online(); d ||= this.drivers();
      if (!on.has(r.id) || !d.has(r.id)) r.out = 'left';
    }
  }
  // A racer's position, as it comes in (index.js pose): their lap is followed (follow.js). What it shows is kept
  // on the racer's record and written down every few seconds, so a restart of the server finds the race as it was.
  seen(id, p, now) {
    const s = this.s;
    if (s.phase !== 'on') return;
    const r = s.racers.find((x) => x.id === id);
    if (!r || r.out || r.ms != null || now < (r.g ?? s.tGrid) - 500) return;
    // (standing still: w = where the car stands [x, z], since when, its last position there; see STILL_MS)
    const w = r.still;
    if (!w || now - w[3] > STILL_GAP || Math.hypot(p[0] - w[0], p[1] - w[1]) > STILL_M) r.still = [Math.round(p[0]), Math.round(p[1]), now, now];
    else {
      w[3] = now;
      // (not once the car was seen over the line, or its "finished" is waiting for that: the finish is settled first)
      if (r.fs == null && !r.cl && now - Math.max(w[2], r.go || s.tGreen) > STILL_MS) { r.out = 'still'; this.check(now); this.save(); this.send(); return; }
    }
    let f = this.fol.get(id);
    // (and what the racer's car can do is worked out meanwhile, for the judging of its drive at the finish)
    if (!f || f.race !== s.id) { this.fol.set(id, f = newFollow(s.id)); this.lobby.carLimit?.(r.car)?.catch?.(() => {}); }
    const ev = follow(r, f, p[0], p[1], now, r.go || s.tGreen, !!CARS[r.car]?.thrusters, Number.isFinite(p[21]) ? p[21] : null, Number(p[2]) || 0);
    if (!ev) return;
    // (over the line with its "finished" already here: that is the finish)
    if (ev === 'finish' && r.cl) { this.settle(r, now); this.check(now); this.save(); this.send(); }
    // (the grid, the start and a jump are written down at once: a deploy right after must not lose them)
    else if (ev !== 'gate' || now - this.savedAt > SAVE_MS) this.save();
  }
  // A racer's word that they finished (r.cl: the time they give, and when it came) against what the server saw.
  // true once it is decided: the finish taken, or the racer out as one whose finish is not counted ('ref').
  settle(r, now) {
    const c = r.cl, s = this.s;
    if (!c || r.ms != null || r.out) { delete r.cl; return true; }
    const go = r.go || s.tGreen, since = c.at - go;
    let fin = null;
    if (r.fs != null) {
      // seen over the line: the racer's own time (their clock is finer than ten positions a second), but not
      // more than a moment before the server saw it, and never after
      const seen = r.fs - go;
      fin = Math.min(Math.max(c.ms, seen - SEEN_EARLY), seen);
      this.lobby.margin?.('fin', seen - c.ms);
    } else if (now - c.at < CLAIM_WAIT) return false;          // (the position that shows it may be a moment behind)
    else {
      // not seen over the line. The connection was down as the car crossed it: as if the positions had come, at
      // the earliest moment the lap's last part allows. Or a race of one from a page that does not send positions
      // while alone (see cutover.js): believed as before.
      const f = this.fol.get(r.id), gap = finishInGap(r, f?.race === s.id ? f : null, c.at, go + c.ms);
      if (gap != null) fin = Math.min(Math.max(c.ms, gap - go, since - FINISH_LATE), since);
      else if (c.at < OLD_PAGES_UNTIL && s.racers.length === 1) fin = Math.min(Math.max(c.ms, since - FINISH_LATE), since);
    }
    delete r.cl;
    if (fin != null && r.jp) fin = null;                      // (moved in a way no car drives)
    // the car itself (26 Nov 2026): the lap as it was followed, held against what this car can do, as a record's
    // drive is (src/race/plausible.js). Not judged when the car's limits are not at hand or the lap was not seen whole.
    let car = '';
    if (fin != null && r.fs != null) {
      try {
        const f = this.fol.get(r.id), lim = this.lobby.limitNow?.get(r.car), d = lim && f?.race === s.id ? driven(f) : null;
        const j = d ? judgeDrive(d.xs, d.zs, d.ys, lim, { hop: d.hop }) : null;
        // (a line in the log for each finish judged: how near honest racers come to the limits is worth knowing)
        if (j) console.log(`race judged ${r.car} ${Math.round(fin)} ms, ${d.xs.length} samples, s over: pull ${j.pull} grip ${j.grip} stop ${j.stop} top ${j.top}${j.why ? ' REFUSED' : ''}`);
        if (j) this.lobby.margin?.('rcar', Math.max(j.pull, j.grip, j.stop, j.top));
        if (j?.why) { car = `car: ${j.why} (s over: pull ${j.pull}, grip ${j.grip}, stop ${j.stop}, top ${j.top})`; fin = null; }
      } catch (err) { console.error('race car check', err); }
    }
    if (fin == null) {
      r.out = 'ref';
      this.lobby.raceRefused?.(r, c.ms, car || (r.jp ? `jumped ${r.jp} times` : r.gt == null ? (r.arm ? 'never over the start line' : 'not seen standing on the grid') : `gates ${r.gt} of ${PASS.length}`));
      return true;
    }
    // (a late joiner's own time plus how late their lights went out: the race's clock, so a late joiner is
    // placed where they crossed the line, Martin 2026-11-23, not ahead of those who started earlier)
    this.lobby.margin?.('gaps', r.sk || 0);
    r.ms = Math.round(Math.min(fin, MAX_RACE_MS)) + (r.go ? Math.max(0, r.go - s.tGreen) : 0);
    return true;
  }
  // A vote (by: who voted) starts the race once enough are in. When drivers leave (by: none) and the
  // votes already in become enough, it starts only if two or more want it (Martin 2026-11-22: five
  // online, two voted, one leaves: fine to race; but three online, only his vote in, one left and he was
  // racing alone): a lone voter sees START NOW and presses once more.
  tally(now, by) {
    this.lapse(now);
    const b = this.ballot(now);
    if (b.kind === 'none' || !b.of) return false;
    const ids = Object.entries(this.s.votes).filter(([id, v]) => v.k === b.kind && b.voters.has(id) && now - v.t < VOTE_MS).map(([id]) => id);
    if (ids.length < b.need || (by ? !ids.includes(by) : ids.length < 2)) return false;
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
        // (off the map for good, after the page's 30 s grace: a start vote goes with the driver)
        // (a spectator keeps theirs: watching another car, they still want the race)
        if (!on && me.w !== 'watch' && this.s.votes[me.id]?.k === 'start') delete this.s.votes[me.id];
        this.check(now); this.tally(now); this.save(); this.send();
        return true;
      }
      case 'rv': {          // vote (start or restart, whichever is open), or take it back
        if (me.ghost) return true;
        const b = this.ballot(now);
        // (from a car that does not race, a vote names the car to race in: a page that sends none is not taken)
        if (!b.voters.has(me.id) || (m.on && b.kind === 'start' && !this.raceCar(me.car, m.sw))) { this.sendTo(ws); return true; }
        this.lapse(now);
        if (m.on && this.s.votes[me.id]?.k !== b.kind) this.count(b.kind);
        // (sw: the car the vote races in, theirs or the one named from a car that does not race, should they be in one at the start)
        if (m.on) { const sw = this.raceCar(me.car, m.sw); this.s.votes[me.id] = { k: b.kind, t: now, ...(sw ? { sw } : {}) }; } else delete this.s.votes[me.id];
        if (m.on) this.tally(now, me.id);
        this.save(); this.send();
        return true;
      }
      case 'rj': {          // join or leave before the lights
        if (me.ghost || this.s.phase !== 'on') return true;
        const ph = this.phase(now), i = this.s.racers.findIndex((r) => r.id === me.id);
        const car = this.raceCar(me.car, m.sw), sw = this.noRace(me.car) ? { sw: 1 } : {};
        const room = i < 0 && this.s.racers.length < MAX_RACERS && (me.drv || me.w === 'watch') && !!car;
        if (m.on && ph === 'count' && room) this.s.racers.push({ id: me.id, name: me.name, car, ...sw });
        // missed the countdown: on the grid at the back; once the race is on, a start of one's own there
        // (g on the grid, go lights out: the race time is counted from go)
        else if (m.on && ph === 'grid' && room) this.s.racers.push({ id: me.id, name: me.name, car, late: 1, ...sw });
        else if (m.on && ph === 'race' && room && now < this.s.tGreen + LATE_MS && !this.openForStart()) this.s.racers.push({ id: me.id, name: me.name, car, late: 1, g: now - 5000, go: now + LATE_GO, ...sw });
        else if (!m.on && i >= 0 && (ph !== 'race' || now < (this.s.racers[i].go || 0))) this.s.racers.splice(i, 1);
        else if (!m.on && i >= 0 && !this.s.racers[i].out && this.s.racers[i].ms == null) this.s.racers[i].out = 'quit';
        this.check(now); this.save(); this.send();
        return true;
      }
      case 'rf': {          // finished: ms from lights out, by the browser's (synced) clock
        const r = this.s.phase === 'on' && this.s.racers.find((x) => x.id === me.id);
        // The time is the browser's own, so the server holds it against its clock (security review 25 Nov 2026: any
        // racer could claim the win with a made-up time): it cannot be more than a moment past the time since that
        // racer's lights went out, and not under a believable lap. And since 26 Nov against the lap as the server
        // followed it (settle): the word waits a moment for the position that shows the car over the line.
        const ms = Math.round(Number(m.ms)), since = now - (r ? r.go || this.s.tGreen : now);
        if (!r || r.ms != null || r.out || !(ms >= RACE_MIN_MS && ms <= MAX_RACE_MS) || ms > since + FINISH_EARLY) return true;
        r.cl ||= { ms, at: now };
        if (!this.settle(r, now)) this.lobby.ctx.storage.setAlarm(now + CLAIM_WAIT + 100).catch?.(() => {});
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
  // a player's page says where they are (index.js 'at'): a spectator who stops watching without coming back to
  // the map (the garage, the menu, another tab) takes their start vote with them, as a driver going off it does
  moved(me, was) {
    if (was !== 'watch' || me.w === 'watch' || me.w === 'map' || me.drv) return;
    if (this.s.votes[me.id]?.k !== 'start') return;
    const now = Date.now();
    delete this.s.votes[me.id];
    this.tally(now); this.save(); this.send();
  }
  // a racer's car or name changed
  changed(me) {
    const r = this.s.phase === 'on' && this.s.racers.find((x) => x.id === me.id);
    if (!r) return;
    r.name = me.name;
    // the car is the one raced in (Martin 2026-11-24: a winner shown in a bus they took after the finish): it
    // may change only until their lights go out; after that a car change is OUT for a racer still on the lap
    const early = Date.now() < (r.go || this.s.tGreen);
    if (early) r.car = me.car;
    // (into a car that does not race: off the list before the lights, out of the race after them)
    if (this.noRace(me.car)) { if (early) this.s.racers.splice(this.s.racers.indexOf(r), 1); else if (!r.out && r.ms == null) r.out = 'car'; this.check(Date.now()); }
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
    delete r.out; delete r.lt;
    this.save(); this.send();
  }
  left(me) {
    const s = this.s, now = Date.now();
    delete s.votes[me.id];
    if (s.phase === 'on') {
      const i = s.racers.findIndex((r) => r.id === me.id);
      if (i >= 0) { if (this.phase(now) === 'race') { if (s.racers[i].ms == null && !s.racers[i].out) { s.racers[i].out = 'left'; s.racers[i].lt = now; } } else s.racers.splice(i, 1); }
      this.check(now);
    }
    this.tally(now);
    this.save(); this.send();
  }
  alarm() {
    const now = Date.now(), s = this.s, was = `${s.phase}${s.id}${JSON.stringify(s.racers)}`;
    this.check(now);
    // (every 15 s while the race runs, so racers gone quiet are found without anyone else's message)
    if (s.phase === 'on') this.lobby.ctx.storage.setAlarm(Math.max(now + 1000, Math.min(now + 15000, s.tGreen + MAX_RACE_MS)));
    // (told to all at the lights, and whenever it changed something)
    if (now < s.tGreen + 5000 || was !== `${s.phase}${s.id}${JSON.stringify(s.racers)}`) { this.save(); this.send(); }
  }
}
