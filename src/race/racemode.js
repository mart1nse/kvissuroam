// The online race (Martin, 2026-11-21): vote, RACE STARTS IN, the grid behind the line on Küüni, five
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

const hash = (seed, id) => {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  return h;
};
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const OUT_TEXT = { off: 'off track', jump: 'reset', car: 'car change', start: 'START', map: 'map drop', left: 'left', time: 'out of time', quit: 'retired' };

export function createRaceMode({ mp, track, cars, isTouch, toast, chime, place, isDriving }) {
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
  count.innerHTML = '<div class="big"><span class="t1">RACE STARTS IN</span><span class="t2"></span></div><div class="rcard"><div class="names"></div><div class="btns"><button data-r="join"></button><button data-r="no">✕ NOT INTERESTED</button></div></div>';
  hud.appendChild(count);
  const lights = document.createElement('div');
  lights.id = 'rlights'; lights.className = 'hidden';
  lights.innerHTML = `<div class="lamps">${'<i></i>'.repeat(5)}</div><div class="cap"></div>`;
  hud.appendChild(lights);
  const lamps = [...lights.querySelectorAll('.lamps i')], lCap = lights.querySelector('.cap');

  let r = null;                   // the server's latest word on the race (between messages the phase follows mp.serverNow)
  let placedFor = 0, pin = null, dismissed = 0, finishedMs = null, outSent = 0, askQuit = 0, quitFor = 0, hidFor = 0;
  let listUntil = 0, listOpen = false, showLast = false;
  const track_ = new Map();       // racer id -> { hint, prog, crossed, marks[], t }
  let tick = 0, sample = 0;

  const now = () => mp.serverNow();
  const phaseOf = (t = now()) => (!r?.on ? 'idle' : t < r.tGrid ? 'count' : t < r.tGreen ? 'grid' : 'race');
  const me = () => r?.racers?.find((x) => x.id === mp.id) || null;
  const active = (x) => x && !x.out && x.ms == null;

  function setText(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }
  function show(el, on) { el.classList.toggle('hidden', !on); }

  // ---- the one action (the button, key 1)
  function act() {
    if (!r || !mp.online) return;
    const ph = phaseOf(), mine = me();
    const voteOpen = r.vote.kind !== 'none';
    if (ph === 'count') { mp.raceSend({ t: 'rj', on: mine ? 0 : 1 }); dismissed = 0; return; }
    if (ph === 'grid') { if (mine) { mp.raceSend({ t: 'rj', on: 0 }); pin = null; } return; }
    if (voteOpen && r.vote.kind === 'restart' && !(mine && !mine.out)) return;
    if (voteOpen) {
      if (!isDriving()) return;
      mp.raceSend({ t: 'rv', on: r.vote.ids.includes(mp.id) ? 0 : 1 });
    }
  }
  btn.addEventListener('click', act);
  chip.addEventListener('click', () => { showLast = true; listOpen = true; listUntil = Infinity; render(); });
  // the ✕ on the live list leaves the race (alone: ends it), after a second tap to confirm;
  // otherwise it tucks the list away
  const racingNow = () => { const m = me(); return phaseOf() === 'race' && !!m && active(m) && finishedMs == null; };
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
      x.gap = k > 0 && lm?.[k] != null && x.p.marks[k] != null ? `+${((x.p.marks[k] - lm[k]) / 1000).toFixed(2)}` : '';
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

  // ---- drawn four times a second (and at once after a click or a message)
  function render() {
    const t = now(), ph = phaseOf(t), mine = me();
    show(btn, !!r && mp.online);
    if (!r || !mp.online) { show(list, false); show(count, false); show(lights, false); show(chip, false); setText(sub, ''); return; }
    const v = r.vote, voted = v.ids.includes(mp.id), n = v.ids.length;
    const pips = (k, of) => `<span class="pips">${Array.from({ length: Math.min(of, 8) }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>`;
    const key = isTouch ? 'TAP' : 'PRESS 1';
    let label, cls = '', line;
    if (ph === 'count') {
      if (mine) { label = "YOU'RE IN"; cls = 'voted'; line = isTouch ? 'TAP TO LEAVE' : 'PRESS 1 TO LEAVE'; }
      else { label = 'JOIN RACE'; cls = 'lit'; line = `${r.racers.length} IN · ${key} TO JOIN`; }
    } else if (ph === 'grid') {
      if (mine) { label = isTouch ? 'ON GRID' : 'ON THE GRID'; cls = 'voted'; line = isTouch ? 'TAP TO LEAVE' : 'PRESS 1 TO LEAVE'; }
      else { label = 'RACE ON'; cls = 'dim'; line = `${r.racers.length} ON THE GRID`; }
    } else if (v.kind === 'restart' && mine && !mine.out) {
      label = 'RESTART'; cls = voted ? 'pink on' : 'pink';
      line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> ${isTouch ? 'RACERS' : `RACER VOTES TO RESTART${voted ? ' · YOU VOTED' : ''}`}`;
    } else if (v.kind === 'start') {
      if (voted) { label = 'VOTED'; cls = 'voted'; line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> VOTES${isTouch ? '' : ' · PRESS 1 TO TAKE BACK'}`; }
      else if (n) { label = 'VOTE START'; cls = 'lit'; line = `${pips(n, v.need)}<b>${n} / ${v.need}</b> VOTES${isTouch ? '' : ' · PRESS 1 TO RACE'}`; }
      else { label = 'START RACE'; line = `${pips(0, v.need)}<b>0 / ${v.need}</b> VOTES${isTouch ? '' : ' TO START · PRESS 1'}`; }
      if (ph === 'race' && !isTouch) line += ' · RACE STILL ON';
    } else {
      label = 'RACE ON'; cls = 'dim';
      const on = r.racers.filter(active).length;
      line = `${on} RACING · ${clock(t - r.tGreen)} / 7:00`;
    }
    const lab = isTouch ? label.replace(' ', '<br>') : label;
    if (btn._h !== lab + cls) { btn._h = lab + cls; btn.innerHTML = lab; btn.className = cls; }
    setText(sub, line);

    // RACE STARTS IN
    const cnt = ph === 'count' && dismissed !== r.id;
    show(count, cnt);
    if (cnt) {
      setText(count.querySelector('.t2'), String(Math.max(1, Math.ceil((r.tGrid - t) / 1000))));
      setText(count.querySelector('.names'), r.racers.map((x) => `<span class="${x.id === mp.id ? 'me' : ''}">${escapeHtml(x.name)}${x.id === mp.id ? ' (you)' : ''}</span>`).join('') + (mine ? '' : '<span class="wait">+ you?</span>'));
      const j = count.querySelector('[data-r="join"]');
      setText(j, mine ? "✓ YOU'RE IN" : 'JOIN RACE');
      j.className = mine ? 'in' : 'go';
    }

    // the lights, for racers on the grid
    const lit = mine && (ph === 'grid' || (ph === 'race' && t - r.tGreen < 1500));
    show(lights, !!lit);
    document.body.classList.toggle('racegrid', !!lit);
    if (lit) {
      // (one light a second from five seconds on the grid; all five stay lit through the random hold, then out)
      const e = t - r.tGrid, n5 = ph === 'race' ? 0 : Math.max(0, Math.min(5, Math.floor((e - 5000) / 1000) + 1));
      lamps.forEach((l, i) => l.classList.toggle('on', i < n5));
      setText(lCap, ph === 'race' ? 'GO!' : n5 ? 'WAIT FOR LIGHTS OUT' : `LIGHTS IN ${Math.max(1, Math.ceil((5000 - e) / 1000))}`);
      lights.classList.toggle('go', ph === 'race');
    }

    // the list: live during the race for racers, results after
    const live = ph === 'race' && mine;
    if (live && !listOpen && finishedMs == null && !showLast && hidFor !== r.id) { listOpen = true; listUntil = Infinity; }
    if (listOpen && t > listUntil) { listOpen = false; showLast = false; }
    let rows = null, head = '', foot = '', compact = false;
    if (listOpen && live && !showLast) {
      rows = standings(r.racers, true);
      const myRow = rows.findIndex((x) => x.id === mp.id);
      const done = r.racers.filter((x) => x.ms != null).length;
      compact = finishedMs == null;
      head = compact ? `<span class="pos"><b class="dot">●</b> P${myRow + 1}<small> / ${rows.length}</small></span><em class="rt">${fmtTime(Math.max(0, t - r.tGreen) / 1000)}</em>` : '<h3><i class="flag"></i> RACE RESULTS</h3>';
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
    if (rows) setText(list, `<div class="hd">${head}${xBtn}</div><table>${compact ? '' : '<tr class="th"><td></td><td>DRIVER</td><td>CAR</td><td>GAP</td><td class="w">WHERE</td></tr>'}${rowsHtml(rows, compact)}</table>${foot ? `<div class="ft">${foot}</div>` : ''}`);
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
      if (r.id !== prevId) { track_.clear(); finishedMs = null; outSent = 0; dismissed = 0; if (!r.on) pin = null; }
      // someone started a vote: tell the others
      const v = r.vote, n = v?.ids?.length || 0;
      if (v && v.kind !== 'none' && n > prevN && !v.ids.includes(mp.id) && phaseOf() !== 'count') {
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
    get ghost() { const ph = phaseOf(), m = me(); return !!m && active(m) && (ph === 'grid' || ph === 'race'); },
    // where the car is held on the grid, or null
    get pin() { return pin; },
    // our lap timer finished a lap
    lap() {
      const m = me();
      if (!m || !active(m) || phaseOf() !== 'race' || finishedMs != null) return;
      finishedMs = Math.round(now() - r.tGreen);
      mp.raceSend({ t: 'rf', ms: finishedMs });
      listOpen = true; showLast = false; listUntil = now() + LIST_MS;
      toast(`FINISHED · ${fmtTime(finishedMs / 1000)}`, 3500);
    },
    // out of the race: kind 'off' (off the track), 'jump' (a reset), 'car', 'start', 'map'
    out(kind) {
      const ph = phaseOf(), m = me();
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
      const t = now(), ph = phaseOf(t), m = me();
      // onto the grid when the countdown runs out
      if (ph === 'grid' && m && placedFor !== r.id) {
        placedFor = r.id;
        const order = r.racers.map((x) => x.id).sort((p, q) => hash(r.seed, p) - hash(r.seed, q));
        pin = gridPose(Math.max(0, order.indexOf(mp.id)), car.spec);
        place(pin);
      }
      if (ph !== 'grid' || !m) pin = null;
      // the race closed by the clock without a word from the server yet
      if (ph === 'race' && t > r.tGreen + MAX_MS + 3000) r.on = false;
      // live order: positions ten times a second
      sample -= dt;
      if (ph === 'race' && m && sample <= 0) {
        sample = 0.1;
        const rt = t - r.tGreen;
        for (const x of r.racers) {
          if (!active(x)) continue;
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
