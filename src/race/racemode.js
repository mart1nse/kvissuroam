// The online race (Martin, 2026-11-21): vote, TO RACE START (the countdown), the grid behind the line on Küüni, five
// red lights, one lap, results. The rules and the clock live on the server (worker/race.js); this is
// what a player sees and does, and the live order of the racers worked out from their positions.
//
// Light on purpose: a few DOM boxes whose text is only rewritten when it changes (four times a
// second at most), positions looked up ten times a second with a hint, no canvas, no 3D.
import { fmtTime, escapeHtml } from './race.js';

const STEP = 100;                 // metres between the timing points the gaps are measured at
const LIST_MS = 10000;            // results shown this long, then tucked into the LAST RACE chip
const ROW = 5;                    // cars side by side on the grid
const MAX_MS = 7 * 60000;
const LATE_MS = 150000;           // a late joiner may come in up to this long after the lights (worker/race.js)
const MAX_RACERS = 30;

const hash = (seed, id) => {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  return h;
};
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const OUT_TEXT = { off: 'off track', cut: 'short cut', jump: 'reset', car: 'car change', start: 'START', map: 'map drop', left: 'left', time: 'out of time', quit: 'retired' };

export function createRaceMode({ mp, track, cars, isTouch, toast, chime, place, isDriving, halo, busy = () => false, unbusy }) {
  const { P, N, s: S, length: LEN } = track;
  // the grid: Küüni carries on straight behind the corner into the start straight, so the line is on
  // that line, ~95 m before the start/finish (Martin's green line, 21 Nov), cars facing up it
  const a = P[N - 30], b = P[0], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux;
  const LINE = -34;                                   // metres from P[N-30] along the straight
  const gridYaw = Math.atan2(ux, -uz);
  function gridPose(k, spec) {
    const row = Math.floor(k / ROW), col = [2, 1, 3, 0, 4][k % ROW];
    const half = spec?.halfLen ?? (spec?.wheelbase ?? 2.7) / 2 + 0.85;
    const t = LINE - 0.6 - half - row * 7.5, lat = (col - 2) * 2.7;
    return { x: a[0] + ux * t + nx * lat, z: a[1] + uz * t + nz * lat, yaw: gridYaw };
  }

  // ---- the page parts
  const hud = document.querySelector('#hud');
  const box = document.createElement('div');
  box.id = 'racebox';
  box.innerHTML = '<button id="rbtn" class="hidden"></button><div id="rsub"></div><button id="rchip" class="hidden"></button>';
  hud.appendChild(box);
  const btn = box.querySelector('#rbtn'), sub = box.querySelector('#rsub'), chip = box.querySelector('#rchip');
  const list = document.createElement('div');
  list.id = 'rlist'; list.className = 'hidden';
  hud.appendChild(list);
  const count = document.createElement('div');
  count.id = 'rcount'; count.className = 'hidden';
  count.innerHTML = `<div class="big"><span class="t1">TO RACE START</span><span class="t2"></span></div><div class="rcard"><div class="names"></div><div class="btns"><button data-r="join"></button><button data-r="no">✕ NOT INTERESTED${isTouch ? '' : ' <small>ESC</small>'}</button></div></div>`;
  hud.appendChild(count);
  const lights = document.createElement('div');
  lights.id = 'rlights'; lights.className = 'hidden';
  lights.innerHTML = `<div class="lamps">${'<i></i>'.repeat(5)}</div><div class="cap"></div>`;
  hud.appendChild(lights);
  // the finish splash: big, in the middle, for a few seconds after crossing the line
  const splash = document.createElement('div');
  splash.id = 'rsplash'; splash.className = 'hidden';
  hud.appendChild(splash);
  let splashTimer = 0;
  function showSplash(html, ms, kind) {
    splash.innerHTML = html;
    splash.className = kind || '';
    splash.style.animationDuration = `${ms}ms`;
    void splash.offsetWidth; splash.classList.add('go');
    document.body.classList.add('racesplash');
    clearTimeout(splashTimer); splashTimer = setTimeout(() => { splash.classList.add('hidden'); document.body.classList.remove('racesplash'); }, ms);
    chime?.(kind === 'rec' ? 'record' : 'join');
  }
  // the record line: the car, and by how much the old best fell (and whose it was)
  function recLine(lap, prev) {
    const car = (cars[lap.car]?.short || lap.car || '').toUpperCase();
    let gain = 'FIRST LAP IN THIS CAR';
    if (prev?.ms > lap.ms) gain = `−${((prev.ms - lap.ms) / 1000).toFixed(2)}${prev.name && prev.name !== mp.name ? ` · BEAT ${escapeHtml(prev.name).toUpperCase()}` : ''}`;
    return { car: escapeHtml(car), gain };
  }
  const lamps = [...lights.querySelectorAll('.lamps i')], lCap = lights.querySelector('.cap');

  let r = null;                   // the server's latest word on the race (between messages the phase follows mp.serverNow)
  let placedFor = 0, pin = null, dismissed = 0, finishedMs = null, outSent = 0, askQuit = 0, quitFor = 0, hidFor = 0;
  let listUntil = 0, listOpen = false, showLast = false;
  const track_ = new Map();       // racer id -> { hint, prog, crossed, marks[], t }
  let tick = 0, sample = 0;

  const now = () => mp.serverNow();
  const phaseOf = (t = now()) => (!r?.on ? 'idle' : t < r.tGrid ? 'count' : t < r.tGreen ? 'grid' : 'race');
  // A late joiner (Martin 2026-11-22: missed the countdown, or came along during the race) gets a start of
  // their own: g on the grid, go lights out, their race time counted from there. Others race the race's clock.
  const gridT = (x) => x?.g ?? r.tGrid, greenT = (x) => x?.go ?? r.tGreen;
  const phaseFor = (x, t = now()) => (!x ? phaseOf(t) : !r?.on ? 'idle' : t < gridT(x) ? 'count' : t < greenT(x) ? 'grid' : 'race');
  // the race can still be joined: on the grid, or up to LATE_MS after the lights (time left for a lap)
  const lateOk = (t = now()) => !!r?.on && t >= r.tGrid && t < r.tGreen + LATE_MS && r.racers.length < MAX_RACERS;
  const me = () => r?.racers?.find((x) => x.id === mp.id) || null;
  const active = (x) => x && !x.out && x.ms == null;

  function setText(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }
  function show(el, on) { el.classList.toggle('hidden', !on); }

  // ---- the one action (the button, key 1)
  function act() {
    if (!r || !mp.online || mp.stealth) return;
    const mine = me(), ph = phaseFor(mine);
    const voteOpen = r.vote.kind !== 'none';
    // on a Raadi stage run (Martin, 2026-11-23): left out of the vote, the button only joins a race that is starting
    if (busy()) {
      if (!mine && joinable(ph)) { unbusy?.(); mp.raceSend({ t: 'rj', on: 1 }); dismissed = 0; }
      return;
    }
    if (ph === 'count') { mp.raceSend({ t: 'rj', on: mine ? 0 : 1 }); dismissed = 0; return; }
    if (ph === 'grid') { if (mine) { mp.raceSend({ t: 'rj', on: 0 }); pin = null; } else if (lateOk()) mp.raceSend({ t: 'rj', on: 1 }); return; }
    if (ph === 'race' && !mine && lateOk() && r.vote.kind !== 'start') { mp.raceSend({ t: 'rj', on: 1 }); return; }
    // the last one still in, with others about: the button ends the race (no restart into a race of one)
    if (ph === 'race' && loneRacer()) { mp.raceSend({ t: 'rj', on: 0 }); quitFor = r.id; toast('RACE ENDED', 2000); return; }
    // (the lights just went out and the server's word on the restart vote is still on its way: it judges by the clock)
    if (ph === 'race' && !voteOpen && mine && active(mine)) { mp.raceSend({ t: 'rv', on: 1 }); return; }
    if (voteOpen && r.vote.kind === 'restart' && !(mine && !mine.out)) return;
    if (voteOpen) {
      if (!isDriving()) return;
      // (voted, and drivers left so the votes in are enough now: pressing again starts it, START NOW)
      const voted = r.vote.ids.includes(mp.id), enough = r.vote.ids.length >= r.vote.need;
      mp.raceSend({ t: 'rv', on: voted && !enough ? 0 : 1 });
    }
  }
  const joinable = (ph) => ph === 'count' || (ph === 'grid' && lateOk()) || (ph === 'race' && lateOk() && r.vote.kind !== 'start');
  btn.addEventListener('click', act);
  chip.addEventListener('click', () => { showLast = true; listOpen = true; listUntil = Infinity; render(); });
  // the ✕ on the live list leaves the race (alone: ends it), after a second tap to confirm;
  // otherwise it tucks the list away
  // racing and the only one still in the race (finished ones count as in), while others drive about
  const loneRacer = () => { const m = me(); return phaseFor(m) === 'race' && !!m && active(m) && finishedMs == null && r.racers.filter((x) => !x.out).length === 1 && mp.drivers().length > 0; };
  const racingNow = () => { const m = me(); return phaseFor(m) === 'race' && !!m && active(m) && finishedMs == null; };
  list.addEventListener('click', (e) => {
    if (!e.target.closest('[data-r="x"]')) return;
    if (racingNow()) {
      if (now() < askQuit) {
        const solo = r.racers.filter(active).length <= 1;
        askQuit = 0; quitFor = r.id;
        mp.raceSend({ t: 'rj', on: 0 });
        toast(solo ? 'RACE CANCELLED' : 'LEFT THE RACE', 2000);
        listOpen = false; showLast = false; hidFor = r.id;
      } else askQuit = now() + 4000;
      render(); return;
    }
    listOpen = false; showLast = false; hidFor = r?.id || 0; render();
  });
  // Esc while TO RACE START is up = NOT INTERESTED (Martin 2026-11-22: finish the hotlap you are on);
  // ahead of the game's own Esc (the garage)
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || count.classList.contains('hidden') || !r) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (me()) mp.raceSend({ t: 'rj', on: 0 });
    dismissed = r.id; render();
  }, true);
  count.addEventListener('click', (e) => {
    const k = e.target.closest('[data-r]')?.dataset.r;
    if (k === 'join') { if (!me()) mp.raceSend({ t: 'rj', on: 1 }); }
    else if (k === 'no') { if (me()) mp.raceSend({ t: 'rj', on: 0 }); dismissed = r?.id || 0; }
  });

  // ---- live order: each racer's distance along the lap, and when they passed each timing point
  function progress(id, x, z, t) {
    let p = track_.get(id);
    if (!p) track_.set(id, (p = { hint: -1, prog: null, crossed: false, marks: [], t: 0 }));
    const n = track.nearest(x, z, p.hint, 80);
    if (n.i < 0 || n.d > 80) return p;
    p.hint = n.d < 30 ? n.i : -1;
    const j = (n.i + 1) % N, seg = j ? S[j] - S[n.i] : LEN - S[n.i];
    const s = S[n.i] + seg * n.t;
    let prog;
    if (!p.crossed) {
      if (s < LEN / 2 && p.prog != null && p.prog > -250 && t > 0) { p.crossed = true; prog = s; } else prog = s > LEN / 2 ? s - LEN : (p.prog ?? -100);
    } else prog = s;
    if (p.prog != null && p.crossed && (prog - p.prog > 400 || prog < p.prog - 400)) return p;     // a jump (the lap crosses itself at Jakobi)
    if (p.crossed && p.prog != null && prog > p.prog) {
      for (let k = Math.floor(Math.max(0, p.prog) / STEP) + 1; k <= Math.floor(prog / STEP); k++) {
        if (p.marks[k] == null) p.marks[k] = p.t + ((k * STEP - p.prog) / (prog - p.prog)) * (t - p.t);
      }
    }
    p.prog = prog; p.t = t;
    return p;
  }
  // the racers in order: finished by time, then on the road by distance, then those out
  function standings(rs, live) {
    const rows = rs.map((x) => ({ ...x, p: live ? track_.get(x.id) : null }));
    const score = (x) => (x.ms != null ? 3e9 - x.ms : x.out ? -3e9 : (x.p?.prog ?? -1000));
    rows.sort((p, q) => score(q) - score(p));
    const lead = rows[0];
    for (const x of rows) {
      if (x.out) { x.gap = 'OUT'; x.where = OUT_TEXT[x.out] || 'out'; continue; }
      if (x.ms != null) { x.gap = x === lead ? fmtTime(x.ms / 1000) : `+${((x.ms - lead.ms) / 1000).toFixed(2)}`; x.where = 'FINISHED'; continue; }
      x.where = x.p?.prog != null ? (x.p.prog < 0 ? 'START' : `${(x.p.prog / 1000).toFixed(1)} KM`) : '';
      if (x === lead) { x.gap = 'LEADER'; continue; }
      const k = x.p?.marks?.length - 1, lm = lead.p?.marks;
      // (never below zero: one who led at that mark and has just been passed is level, not -0.86 behind)
      x.gap = k > 0 && lm?.[k] != null && x.p.marks[k] != null ? `+${(Math.max(0, x.p.marks[k] - lm[k]) / 1000).toFixed(2)}` : '';
    }
    return rows;
  }

  // compact (the live list in a race, Martin 2026-11-21): position, name, car and gap only
  function rowsHtml(rows, compact) {
    let pos = 0, prevMs = null;
    return rows.map((x, i) => {
      if (!x.out && (x.ms == null || x.ms !== prevMs)) pos = i + 1;
      prevMs = x.ms;
      const carShort = cars[x.car]?.short || x.car;
      return `<tr class="${x.id === mp.id ? 'me' : ''}${x.out ? ' out' : ''}"><td class="p">${x.out ? '–' : pos}</td><td class="n">${escapeHtml(x.name)}${x.id === mp.id && !compact ? ' (you)' : ''}</td><td class="c">${escapeHtml(carShort)}</td><td class="g">${x.gap}</td>${compact ? '' : `<td class="w">${x.where}</td>`}</tr>`;
    }).join('');
  }

  // phones: the live standings sit over the gas pedal in a short box that scrolls (Martin 2026-11-22). The
  // box is drawn anew with the list, so it keeps where a finger left it, and otherwise follows your own row.
  let fingerAt = -1e9;
  for (const ev of ['touchstart', 'wheel']) list.addEventListener(ev, () => { fingerAt = performance.now(); }, { passive: true });
  function keepScroll(top) {
    const tb = list.querySelector('.tb');
    if (!tb || tb.scrollHeight <= tb.clientHeight + 1) return;
    if (performance.now() - fingerAt < 4000) { tb.scrollTop = top; return; }
    const meRow = tb.querySelector('tr.me');
    tb.scrollTop = meRow ? meRow.offsetTop - (tb.clientHeight - meRow.offsetHeight) / 2 : top;
  }

  // ---- drawn four times a second (and at once after a click or a message)
  function render() {
    const t = now(), mine = me(), ph = phaseOf(t), mph = phaseFor(mine, t);
    show(btn, !!r && mp.online);
    // the finish glows for everyone once the racers are away from the start (not at their first pass)
    halo?.(!!r && mp.online && r.on && ph === 'race' && t - r.tGreen > 25000);
    if (!r || !mp.online) { show(list, false); show(count, false); show(lights, false); show(chip, false); setText(sub, ''); return; }
    const v = r.vote, voted = v.ids.includes(mp.id), n = v.ids.length;
    const pips = (k, of) => `<span class="pips">${Array.from({ length: Math.min(of, 8) }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>`;
    const key = isTouch ? 'TAP' : 'PRESS 1';
    let label, cls = '', line;
    const late = !mine && lateOk(t) && v.kind !== 'start';
    if (mph === 'count') {
      if (mine) { label = "YOU'RE IN"; cls = 'voted'; line = isTouch ? 'TAP TO LEAVE' : 'PRESS 1 TO LEAVE'; }
      else { label = 'JOIN RACE'; cls = 'lit'; line = `${r.racers.length} IN · ${key} TO JOIN`; }
    } else if (mph === 'grid') {
      if (mine) { label = isTouch ? 'ON GRID' : 'ON THE GRID'; cls = 'voted'; line = isTouch ? 'TAP TO LEAVE' : 'PRESS 1 TO LEAVE'; }
      else if (late) { label = 'JOIN RACE'; cls = 'lit'; line = `${r.racers.length} ON THE GRID · ${key} TO JOIN`; }
      else { label = 'RACE ON'; cls = 'dim'; line = `${r.racers.length} ON THE GRID`; }
    } else if (late) {
      // (the race is on: join with a start of your own from the grid, your time from your lights)
      label = 'JOIN RACE'; cls = 'lit';
      line = `${r.racers.filter(active).length} RACING · ${clock(t - r.tGreen)} / 7:00 · ${key} TO JOIN`;
    } else if (mph === 'race' && loneRacer()) {
      label = 'END RACE'; cls = '';
      line = `LAST ONE IN THE RACE · ${key} TO END`;
    } else if (v.kind === 'restart' && mine && !mine.out) {
      label = 'RESTART'; cls = voted ? 'pink on' : 'pink';
      line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> ${isTouch ? 'RACERS' : `RACER VOTES TO RESTART${voted ? ' · YOU VOTED' : ''}`}`;
      if (voted && n >= v.need) { label = 'RESTART NOW'; cls = 'pink'; line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> ${key} TO RESTART`; }
    } else if (v.kind === 'start') {
      // (enough votes only because drivers left: nothing starts by itself, the voters confirm it)
      if (voted && n >= v.need) { label = 'START NOW'; cls = 'lit'; line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> VOTES · ${key} TO START`; }
      else if (voted) { label = 'VOTED'; cls = 'voted'; line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> VOTES${isTouch ? '' : ' · PRESS 1 TO TAKE BACK'}`; }
      else if (n) { label = 'VOTE START'; cls = 'lit'; line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> VOTES${isTouch ? '' : ' · PRESS 1 TO RACE'}`; }
      else { label = 'START RACE'; line = `${pips(0, v.need)}<b>0 / ${v.need}</b> VOTES${isTouch ? '' : ' TO START · PRESS 1'}`; }
      if (ph === 'race' && !isTouch) line += ' · RACE STILL ON';
      // drivers on the map the server does not count: a page from before race mode (it cannot vote
      // until it is reloaded)
      const old = mp.drivers().length + (mp.counted ? 1 : 0) - v.of;
      if (old > 0) line += isTouch ? ` · ${old} OLD PAGE${old > 1 ? 'S' : ''}` : ` · ${old} ON AN OLD PAGE`;
    } else {
      label = 'RACE ON'; cls = 'dim';
      const on = r.racers.filter(active).length;
      line = `${on} RACING · ${clock(t - r.tGreen)} / 7:00`;
    }
    // ?off=100 (Martin 2026-11-22): never in the vote pool or a race; the button only tells what the others do
    // on a Raadi stage run: nothing but a small JOIN while a race starts or can still be joined
    const away = busy() && !mine;
    if (away) { label = ph === 'count' ? 'RACE STARTING' : 'RACE ON'; cls = 'lit'; line = `${r.racers.length} IN · JOIN?`; }
    if (mp.stealth) {
      label = 'HIDDEN'; cls = 'dim';
      line = ph === 'count' || ph === 'grid' ? `${r.racers.length} ON THE GRID` : ph === 'race' ? `${r.racers.filter(active).length} RACING · ${clock(t - r.tGreen)} / 7:00`
        : `<b>${n} / ${v.need}</b> VOTES`;
      line += isTouch ? '' : ' · NOT IN THE VOTE';
    }
    const lab = isTouch ? label.replace(' ', '<br>') : label;
    if (btn._h !== lab + cls) { btn._h = lab + cls; btn.innerHTML = lab; btn.className = cls; }
    btn.classList.toggle('away', away);
    show(btn, !away || joinable(ph));
    setText(sub, away && !joinable(ph) ? '' : line);

    // TO RACE START (the countdown)
    const cnt = ph === 'count' && dismissed !== r.id && !mp.stealth && !(busy() && !mine);
    show(count, cnt);
    if (cnt) {
      setText(count.querySelector('.t2'), String(Math.max(1, Math.ceil((r.tGrid - t) / 1000))));
      setText(count.querySelector('.names'), r.racers.map((x) => `<span class="${x.id === mp.id ? 'me' : ''}">${escapeHtml(x.name)}${x.id === mp.id ? ' (you)' : ''}</span>`).join('') + (mine ? '' : '<span class="wait">+ you?</span>'));
      const j = count.querySelector('[data-r="join"]');
      setText(j, mine ? "✓ YOU'RE IN" : 'JOIN RACE');
      j.className = mine ? 'in' : 'go';
    }

    // the lights, for racers on the grid
    const lit = mine && (mph === 'grid' || (mph === 'race' && t - greenT(mine) < 1500));
    show(lights, !!lit);
    document.body.classList.toggle('racegrid', !!lit);
    if (lit) {
      // (one light a second from five seconds on the grid; all five stay lit through the random hold, then out)
      const e = t - gridT(mine), n5 = mph === 'race' ? 0 : Math.max(0, Math.min(5, Math.floor((e - 5000) / 1000) + 1));
      lamps.forEach((l, i) => l.classList.toggle('on', i < n5));
      setText(lCap, mph === 'race' ? 'GO!' : n5 ? 'WAIT FOR LIGHTS OUT' : `LIGHTS IN ${Math.max(1, Math.ceil((5000 - e) / 1000))}`);
      lights.classList.toggle('go', mph === 'race');
    }

    // the list: live during the race for racers, results after
    const live = mph === 'race' && mine;
    // still racing: the live order, never an older race's results (Martin 2026-11-22: a LAST RACE list opened
    // before the vote stayed up through his race)
    if (live && active(mine) && finishedMs == null) showLast = false;
    if (live && !listOpen && finishedMs == null && !showLast && hidFor !== r.id) { listOpen = true; listUntil = Infinity; }
    if (listOpen && t > listUntil) { listOpen = false; showLast = false; }
    let rows = null, head = '', foot = '', compact = false;
    if (listOpen && live && !showLast) {
      rows = standings(r.racers, true);
      const myRow = rows.findIndex((x) => x.id === mp.id);
      const done = r.racers.filter((x) => x.ms != null).length;
      compact = finishedMs == null;
      head = compact ? `<span class="pos"><b class="dot">●</b> P${myRow + 1}<small> / ${rows.length}</small></span><em class="rt">${fmtTime(Math.max(0, t - greenT(mine)) / 1000)}</em>` : '<h3><i class="flag"></i> RACE RESULTS</h3>';
      foot = compact ? '' : `${done} OF ${r.racers.length} FINISHED · RACE CLOCK ${clock(t - r.tGreen)} / 7:00`;
    } else if (listOpen && r.last) {
      rows = standings(r.last.racers, false);
      head = '<h3><i class="flag"></i> RACE RESULTS</h3>';
      foot = `TOOMEMÄGI · 1 LAP · ${new Date(r.last.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }
    show(list, !!rows);
    document.body.classList.toggle('racelist', !!rows);
    list.classList.toggle('live', compact);
    const asking = compact && t < askQuit;
    const xBtn = asking ? `<button data-r="x" class="ask">${r.racers.filter(active).length <= 1 ? 'END RACE?' : 'LEAVE RACE?'}</button>` : '<button data-r="x">✕</button>';
    if (rows) {
      const top = list.querySelector('.tb')?.scrollTop || 0;
      setText(list, `<div class="hd">${head}${xBtn}</div><div class="tb"><table>${compact ? '' : '<tr class="th"><td></td><td>DRIVER</td><td>CAR</td><td>GAP</td><td class="w">WHERE</td></tr>'}${rowsHtml(rows, compact)}</table></div>${foot ? `<div class="ft">${foot}</div>` : ''}`);
      keepScroll(top);
    }
    // the LAST RACE chip, when the list is tucked away
    const lastRows = r.last ? standings(r.last.racers, false) : null;
    const myPos = lastRows ? lastRows.findIndex((x) => x.id === mp.id) : -1;
    show(chip, !!r.last && !rows && ph !== 'count' && ph !== 'grid');
    if (r.last) setText(chip, `<i class="flag"></i> LAST RACE · ${myPos >= 0 && !lastRows[myPos].out ? `<em>P${myPos + 1}</em>` : `${escapeHtml(lastRows[0]?.name || '')} WON`} ›`);
  }

  return {
    // a word from the server
    message(m) {
      const prevId = r?.id, prevLast = r?.last?.id, prevN = r?.vote?.ids?.length || 0;
      r = m;
      if (r.id !== prevId) { track_.clear(); finishedMs = null; outSent = 0; dismissed = 0; if (!r.on) pin = null; else if (prevId !== undefined) { showLast = false; listOpen = false; } }
      // someone started a vote: tell the others
      const v = r.vote, n = v?.ids?.length || 0;
      if (v && v.kind !== 'none' && n > prevN && !v.ids.includes(mp.id) && phaseOf() !== 'count' && !mp.stealth && !busy()) {
        const who = mp.nameOf(v.ids[v.ids.length - 1]);
        if (who && prevN === 0) { toast(`${who.toUpperCase()} WANTS TO ${v.kind === 'restart' ? 'RESTART' : 'RACE'} · ${isTouch ? 'TAP' : 'PRESS 1'}`, 4000); chime?.('join'); }
      }
      // a race just ended: show its results to those in it
      if (r.last && r.last.id !== prevLast && prevLast !== undefined && r.last.id !== quitFor && r.last.racers.some((x) => x.id === mp.id)) {
        showLast = true; listOpen = true; listUntil = now() + LIST_MS;
      }
      render();
    },
    act,
    // racing: other cars pass through ours (and ours through theirs)
    get ghost() { const m = me(), ph = phaseFor(m); return !!m && active(m) && (ph === 'grid' || ph === 'race'); },
    // another player who is in the race, from the grid until they finish or drop out: nobody bumps them
    // (Martin, 2026-11-22: from lights out, not only from the start line)
    racing(id) { const ph = phaseOf(); if (ph !== 'grid' && ph !== 'race') return false; const x = r.racers.find((q) => q.id === id); return active(x); },
    // on the grid list before the lights: counted as driving even from the garage (a car change is allowed until then)
    get holding() { const m = me(), ph = phaseFor(m); return !!m && active(m) && (ph === 'count' || ph === 'grid'); },
    // where the car is held on the grid, or null
    get pin() { return pin; },
    // the player lists' vote marks (Martin, 2026-11-23): while a vote has at least one vote in, who has
    // voted and who may still vote; null otherwise. can(id): a start vote is everyone's, a restart only
    // for racers still in.
    voteMarks() {
      const v = r?.vote;
      if (!v || v.kind === 'none' || !v.ids?.length) return null;
      const ids = new Set(v.ids);
      const can = v.kind === 'restart' ? (id) => !!r.racers.find((x) => x.id === id && !x.out) : () => true;
      return { kind: v.kind, key: `${v.kind}:${v.ids.join(',')}`, has: (id) => ids.has(id), can: (id) => can(id) && !(id === mp.id && mp.stealth) };
    },
    // our lap timer finished a lap
    // a lap was completed (race.js); info.rec: it is a lap record for the car, info.prev: the best it beat
    lap(lap, info) {
      const rec = info?.rec ? recLine(lap, info.prev) : null;
      const m = me();
      if (!r || !m || !active(m) || phaseFor(m) !== 'race' || finishedMs != null) {
        if (rec) showSplash(`<div class="k">NEW LAP RECORD</div><div class="p tm">${fmtTime(lap.ms / 1000)}</div><div class="t">${rec.car} <em>${rec.gain}</em></div>`, 3600, 'rec');
        return;
      }
      finishedMs = Math.round(now() - greenT(m));
      mp.raceSend({ t: 'rf', ms: finishedMs });
      listOpen = true; showLast = false; listUntil = now() + LIST_MS;
      // place: those already through with a better time, plus one (nobody still out there can beat it)
      const ahead = r.racers.filter((x) => x.id !== mp.id && x.ms != null && x.ms < finishedMs).length;
      const pos = ahead + 1, n = r.racers.length;
      const word = pos === 1 ? (n > 1 ? 'WINNER!' : 'RACE COMPLETE') : `${pos}${['ST', 'ND', 'RD'][pos - 1] || 'TH'} OF ${n}`;
      showSplash(`<div class="k">RACE OVER · YOU FINISHED</div><div class="p">P${pos}</div><div class="t">${fmtTime(finishedMs / 1000)} <em>${word}</em></div>${
        rec ? `<div class="k rk">NEW LAP RECORD</div><div class="p tm rtm">${fmtTime(lap.ms / 1000)}</div>` : ''}`, rec ? 5600 : 4800, rec ? 'rec' : '');
    },
    // out of the race: kind 'off' (off the track), 'cut' (a short cut), 'jump' (a reset), 'car', 'start', 'map'
    out(kind) {
      const m = me(), ph = phaseFor(m);
      if (!m) return;
      if (ph === 'count' || ph === 'grid') {
        if (kind === 'start' || kind === 'map') { mp.raceSend({ t: 'rj', on: 0 }); pin = null; toast('LEFT THE RACE', 2000); }
        return;
      }
      if (ph !== 'race' || !active(m) || finishedMs != null || outSent === r.id) return;
      outSent = r.id;
      mp.raceSend({ t: 'rd', why: kind });
      toast(`OUT OF THE RACE · ${(OUT_TEXT[kind] || kind).toUpperCase()}`, 3000);
    },
    update(car, dt) {
      if (!r) return;
      const t = now(), ph = phaseOf(t), m = me(), mph = phaseFor(m, t);
      // onto the grid when the countdown runs out (in a random order; a late joiner at the back, by the order of joining)
      if (mph === 'grid' && m && placedFor !== r.id) {
        placedFor = r.id;
        const order = r.racers.filter((x) => !x.late).map((x) => x.id).sort((p, q) => hash(r.seed, p) - hash(r.seed, q));
        pin = gridPose(Math.max(0, m.late ? r.racers.indexOf(m) : order.indexOf(mp.id)), car.spec);
        place(pin);
      }
      if (mph !== 'grid' || !m) pin = null;
      if (!m) placedFor = 0;                                  // (left on the grid, then back in late: placed again)
      // the race closed by the clock without a word from the server yet
      if (ph === 'race' && t > r.tGreen + MAX_MS + 3000) r.on = false;
      // live order: positions ten times a second
      sample -= dt;
      if (ph === 'race' && m && sample <= 0) {
        sample = 0.1;
        for (const x of r.racers) {
          if (!active(x)) continue;
          const rt = t - greenT(x);                           // (each by their own lights: a late joiner's gaps are fair too)
          if (x.id === mp.id) { progress(x.id, car.x, car.z, rt); continue; }
          const p = mp.poseOf(x.id);
          if (p) progress(x.id, p[0], p[1], rt);
        }
      }
      tick -= dt;
      if (tick <= 0) { tick = 0.25; render(); }
    },
  };
}
