// Garage additions: the driver name (changeable, never required) and the lap times board,
// best lap per car of all time and of today, plus this browser's last laps.
import { tyreIcon } from '../hud.js';
import { fmtTime, escapeHtml } from './race.js';
import { createOutline } from './outline.js';
import { createTrackPicker, TRACK_ICON, TRACKS, DRAG_CARD } from './trackpick.js';
import { DRAG_LIMITS } from './dragrules.js';
import { cleanPlate, typedPlate } from '../net/plates.js';
import { OWN_PLATE } from '../cars/plate.js';

// small marks for what drove a lap; laps from before this was kept count as keyboard
const INP = {
  kb: ['KEYBOARD', '<rect x="1.5" y="5" width="21" height="11" rx="1.5"/><path d="M5 8.5h1M8.5 8.5h1M12 8.5h1M15.5 8.5h1M19 8.5h0M7 12.5h10"/>'],
  pad: ['GAMEPAD', '<path d="M7 5h10c3 0 5 3 5.5 7s-1 6-3 6-3-3-5-3h-5c-2 0-3 3-5 3s-3.5-2-3-6S4 5 7 5z"/><path d="M7 9v4M5 11h4M16 10h0M18 12h0"/>'],
  wheel: ['WHEEL', '<circle cx="12" cy="10.5" r="8.5"/><circle cx="12" cy="10.5" r="2"/><path d="M3.6 9.5l6.4 1M20.4 9.5l-6.4 1M12 12.5V19"/>'],
  touch: ['TOUCH SCREEN', '<rect x="6.5" y="1.5" width="11" height="17" rx="2"/><path d="M10.5 15.5h3"/>'],
};
const tyreMark = (k) => `<i class="tymark ${k}" title="${k === 'gravel' ? 'Gravel' : 'Road'} tyres">${tyreIcon(k)}</i>`;
const inpIcon = (k) => { const [name, d] = INP[k] || INP.kb; return `<svg class="inp" viewBox="0 0 24 20" role="img" aria-label="${name}"><title>${name}</title>${d}</svg>`; };

// a place as the board says it: 1ST, 2ND, 3RD, 4TH ... 11TH, 12TH, 13TH ... 21ST
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH'}`;
const TOP_SHOW = 5;              // the lines an opened car shows (worker/tops.js)
const CHEV = '<svg class="chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5L7 5 3 8.5"/></svg>';

// stage: the Raadi rally stage (on unless ?raadi=0): then a track picker in place of the outline, and both circuits' times
// onWatch(track, car): watch a record's replay (desktop; none on phones)
// carNow(): the car picked in the garage, whose row is open when the board opens
// drag: the drag strip (src/race/drag.js) when its card is in the garage (?drag=1 on a desktop), else null
// nearTrack(): the track the car is at ('toome', 'raadi', 'drag') or null, which LAP TIMES opens on
export function createBoard({ mp, race, cars, order, stage, onTrack, onWatch = null, carNow = () => mp.car, drag = null, nearTrack = null }) {
  const menu = document.querySelector('#menu');
  const drive = document.querySelector('#drive');

  const row = document.createElement('div');
  row.id = 'menurow';
  // the row under the cars: DRIVE in the middle, the driver's name to its left and the lap times to its right
  // (Martin 25 Nov: DRIVER sits over the name, which left room in the same box for the number plate, PLATE over it;
  // the plate only on a computer, phones keep each car's own)
  row.innerHTML = `<div id="driver"><label class="col" title="Your name on the lap times: type to change it"><span class="lbl">DRIVER</span><span class="field"><input id="drivername" maxlength="20" spellcheck="false" autocomplete="off" aria-label="Driver name" /><i class="caret"></i></span></label>
    <label class="col plate desktop-only" title="Your number plate, on your car for everyone: 3 digits and 3 letters. Empty: the car's own"><span class="lbl">PLATE</span><span class="field"><input id="plate" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="characters" aria-label="Number plate" /></span></label>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17l1-4L14 3l3 3L7 16z M12 5l3 3"/></svg></div>`;
  drive.replaceWith(row);
  row.appendChild(drive);
  const btn = document.createElement('button');
  btn.id = 'boardbtn';
  btn.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="11.5" r="6.5"/><path d="M10 11.5V8M8 2.5h4M10 2.5V5M15.5 6l1.2-1.2"/></svg><span>LAP TIMES</span>';
  // (on desktop CONTROLS sits beside it: gamepad and wheel setup, src/controls/setup.js)
  const side = document.createElement('div');
  side.id = 'menuside';
  side.appendChild(btn);
  const ctlBtn = document.createElement('button');
  ctlBtn.id = 'ctlbtn';
  ctlBtn.className = 'desktop-only';
  ctlBtn.dataset.act = 'controls';
  ctlBtn.title = 'Set up a gamepad or a steering wheel';
  ctlBtn.innerHTML = '<svg viewBox="0 0 24 20" aria-hidden="true"><path d="M7 5h10c3 0 5 3 5.5 7s-1 6-3 6-3-3-5-3h-5c-2 0-3 3-5 3s-3.5-2-3-6S4 5 7 5z"/><path d="M7 9v4M5 11h4"/><circle cx="16" cy="10" r=".6"/><circle cx="18" cy="12" r=".6"/></svg><span>CONTROLS</span>';
  side.appendChild(ctlBtn);
  row.appendChild(side);

  const input = row.querySelector('#drivername');
  const caret = row.querySelector('.caret');
  const field = row.querySelector('.field');
  // On desktop the name starts selected with a blinking caret after it, so it is plain that it can
  // be typed over. Until the player types, the menu keys (arrows, Enter, Space) still work.
  // Only on the first garage of a visit (Martin 26 Nov): back from a drive nothing is picked, so the
  // garage's keys (L, G, the arrows) do their own work instead of landing in the name; a click picks it.
  const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let fresh = false;
  const measure = document.createElement('canvas').getContext('2d');
  function placeCaret() {
    const cs = getComputedStyle(input);
    measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = measure.measureText(input.value).width + input.value.length * (parseFloat(cs.letterSpacing) || 0);
    caret.style.left = `${Math.min(input.clientWidth - 6, parseFloat(cs.paddingLeft) + w + 3)}px`;
  }
  function preselect() {
    if (!desktop || document.querySelector('#menu').classList.contains('hidden')) return;
    input.focus({ preventScroll: true });
    input.select();
    fresh = true;
    placeCaret();
    field.classList.add('fresh');
  }
  const unfresh = () => { fresh = false; field.classList.remove('fresh'); };
  mp.nameReady.then((n) => {
    if (document.activeElement !== input || fresh) { input.value = n; if (fresh) preselect(); }
  });
  // (a name the server would refuse, a racist slur, Martin 25 Nov: the box goes back to the old name and
  // blinks pink once, with no message)
  const commit = () => {
    const n = mp.setName(input.value);
    input.value = n || mp.name;
    if (n === null) { label.classList.remove('nope'); void label.offsetWidth; label.classList.add('nope'); }
  };
  const label = row.querySelector('#driver');
  label.addEventListener('animationend', (e) => { if (e.animationName === 'nameblink') label.classList.remove('nope'); });
  input.addEventListener('change', commit);
  input.addEventListener('blur', () => { unfresh(); commit(); });
  input.addEventListener('pointerdown', unfresh);
  input.addEventListener('input', unfresh);
  // typing a name must not drive the menu (arrows switch cars, Enter / Space start)
  input.addEventListener('keydown', (e) => {
    if (fresh && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Space'].includes(e.code)) {
      e.preventDefault();          // let the menu have it, the name stays picked while cars switch
      if (e.code === 'Enter' || e.code === 'Space') input.blur();
      return;
    }
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
  });
  // The number plate: typed as "123 ABC" (src/net/plates.js puts the space in and leaves out what cannot be on a
  // plate). Empty is the car's own plate, shown grey in the box. One not whole, or one the server would refuse,
  // goes back to the old one with the same pink blink as a refused name.
  const plateIn = row.querySelector('#plate');
  const platePh = () => { plateIn.placeholder = OWN_PLATE[mp.car] || '123 ABC'; };
  plateIn.value = mp.plate;
  platePh();
  plateIn.addEventListener('focus', platePh);
  // (the grey hint follows the car picked: DRIVE names it)
  new MutationObserver(platePh).observe(drive, { childList: true, subtree: true, characterData: true });
  plateIn.addEventListener('input', () => {
    const v = typedPlate(plateIn.value);
    if (v !== plateIn.value) plateIn.value = v;
  });
  const plateCommit = () => {
    const v = plateIn.value.trim();
    const p = v ? cleanPlate(v) : '';
    const ok = (v === '' || p) && mp.setPlate(p) !== null;
    plateIn.value = mp.plate;
    if (!ok) { label.classList.remove('nope'); void label.offsetWidth; label.classList.add('nope'); }
  };
  plateIn.addEventListener('change', plateCommit);
  plateIn.addEventListener('blur', plateCommit);
  plateIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') plateIn.value = mp.plate; plateIn.blur(); } });
  plateIn.addEventListener('keyup', (e) => e.stopPropagation());

  // pick the name when the menu first opens. Once the menu has closed (a drive began) it is not picked again,
  // and a box still holding the keys lets go of them (DRIVE from a gamepad left the name typing while driving)
  let first = true;
  new MutationObserver((recs) => {
    if (menu.classList.contains('hidden')) {
      if (recs.some((r) => !/\bhidden\b/.test(r.oldValue || ''))) first = false;      // (it was open: a drive began)
      if (document.activeElement === input || document.activeElement === plateIn) document.activeElement.blur();
      return;
    }
    requestAnimationFrame(() => { platePh(); if (first) preselect(); });
  }).observe(menu, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  requestAnimationFrame(preselect);
  input.addEventListener('keyup', (e) => e.stopPropagation());

  const panel = document.createElement('div');
  panel.id = 'board';
  panel.className = 'screen hidden';
  document.body.appendChild(panel);

  // Your own best in each car, beside the records (Martin, 23 Nov 2026: when others were faster his times
  // were nowhere on the board). From this browser's laps, with the day it was set.
  // (Martin 26 Nov: and the place it has among the car's drivers, one line a driver, as the server counts it for
  // this very time; filled in the top five)
  function own(list, id, ic, track = 'toomemagi') {
    const r = list.reduce((m, l) => (l.car === id && (!m || l.ms < m.ms) ? l : m), null);
    if (!r) return '<small class="none">–</small>';
    const d = r.at ? new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
    const pl = top?.[track]?.place?.[id], n = top?.[track]?.top?.[id]?.n;
    const pill = pl && pl[1] === r.ms ? `<em class="pl${pl[0] <= TOP_SHOW ? ' top' : ''}" title="${ordinal(pl[0])} of ${Math.max(n || 0, pl[0])} drivers in this car">${ordinal(pl[0])}</em>` : '';
    return `${ic(r)}${time(track, r)}${pill}${d ? `<small class="date">${d}</small>` : ''}`;
  }

  // ---- The five best per car (Martin 26 Nov 2026): a car's row opens to show its five fastest drivers of all time
  // and of today, one line a driver with their best (from the server: worker/tops.js). The car picked in the garage
  // opens when the board does; a click on any row opens or closes it (a click on a time with a replay plays it),
  // each on its own, and they stay as left while the page is open.
  const opened = new Set();
  let top = null, topBusy = false, topAgain = false, topAt = -1e9, topTimer = 0;
  // own best per car as the server is asked about it: car.ms,car.ms
  const bests = (list) => {
    const m = new Map();
    for (const l of list) if (Number.isInteger(l.ms) && (!m.has(l.car) || l.ms < m.get(l.car))) m.set(l.car, l.ms);
    return [...m].map(([c, ms]) => `${c}.${ms}`).join(',');
  };
  function loadTop() {
    if (topBusy) { topAgain = true; return; }
    topBusy = true; topAt = performance.now();
    const q = new URLSearchParams({ me: mp.name || '', toomemagi: bests(race.laps) });
    if (stage) q.set('raadi', bests(stage.runs.filter((r) => r.inp)));
    if (drag) q.set('drag', bests(dragOwn()));
    fetch(`/api/top?${q}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.toomemagi) { top = j; render(); } }).catch(() => {})
      .finally(() => { topBusy = false; if (topAgain) { topAgain = false; topSoon(); } });
  }
  // (new laps while the board is open: asked again, at most every 3 s)
  function topSoon() {
    if (panel.classList.contains('hidden') || topTimer) return;
    const wait = Math.max(0, 3000 - (performance.now() - topAt));
    topTimer = setTimeout(() => { topTimer = 0; if (!panel.classList.contains('hidden')) loadTop(); }, wait);
  }

  // one car's rows on one circuit: its own line (the best ever, today's best and your best), then up to four more of
  // each list under it, hung between the car's name and YOUR BEST (style.css)
  // ever, today: the car's drivers fastest first (just the best when the server's lists are not here)
  function carRows(id, track, ever, today, mine, cell) {
    const n = Math.min(TOP_SHOW, Math.max(1, ever.length, today.length));
    const open = n > 1 && opened.has(id);
    let h = `<tbody class="car${open ? ' open' : ''}${n === 1 ? ' nomore' : ''}${id === carNow() ? ' cur' : ''}" data-car="${id}"><tr class="main"><th>${CHEV}${escapeHtml(cars[id].short)}</th><td class="rk0"></td><td class="ev">${cell(ever[0], true, track)}</td><td class="td">${cell(today[0], false, track)}</td><td class="you">${mine}</td></tr>`;
    for (let i = 1; i < n; i++) {
      const a = ever[i], t = today[i];
      h += `<tr class="more${i === 1 ? ' first' : ''}${i === n - 1 ? ' last' : ''}"><td class="side"></td><td class="rk">${a || t ? i + 1 : ''}</td><td class="dw">${a ? cell(a, true, track) : '&nbsp;'}</td><td class="dw">${t ? cell(t, false, track) : '&nbsp;'}</td><td class="side"></td></tr>`;
    }
    if (n > 1) h += '<tr class="gap"><td colspan="5"></td></tr>';
    return `${h}</tbody>`;
  }
  // a circuit's lists for a car from the server (with the car in each line, for its replay)
  const topList = (track, id, which, fix = (r) => r) => (top?.[track]?.top?.[id]?.[which] || []).map((r) => fix({ ...r, car: id }));

  // A record lap whose replay the server keeps (src/race/replay.js) can be watched by clicking its time (Martin,
  // 2026-11-24: no underline or button, something people find as they click around): wherever that time shows.
  // track: the server's name for the circuit ('toomemagi' or 'raadi')
  const watchable = (track, r) => !!(onWatch && r && mp.board?.rp?.[track]?.[r.car] === r.ms);
  // (a drag strip's time in seconds and thousandths, as on its timeslip)
  const fmtOf = (track, ms) => (track === 'drag' ? (ms / 1000).toFixed(3) : fmtTime(ms / 1000));
  const time = (track, r) => (watchable(track, r) ? `<b class="rp" data-rp="${track}|${escapeHtml(r.car)}">${fmtOf(track, r.ms)}</b>` : `<b>${fmtOf(track, r.ms)}</b>`);
  const srv = (t) => (t === 'raadi' ? 'raadi' : 'toomemagi');
  const least = (list) => list.reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
  // a circuit's record over all cars: the time (its replay where there is one), the driver and the car
  const rec = (r, track, ic, label = 'RECORD') => (r ? `<span class="rec"><u>${label}</u>${ic(r)}${time(track, r)}<i>${escapeHtml(r.name)}</i><em>${escapeHtml(cars[r.car]?.short || r.car)}</em></span>` : '');

  function render() {
    if (panel.classList.contains('hidden')) return;
    const b = mp.board;
    const pick = (list, id) => list?.find((r) => r.car === id);
    const day = (at) => new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' });
    // which controller drove each lap shows only once laps exist with more than one kind
    const kinds = new Set([...(b?.inputs || []), ...(b?.raadi?.inputs || []), ...(drag ? b?.drag?.inputs || [] : []), ...race.laps.map((l) => l.inp || 'kb'), ...(stage?.runs || []).map((l) => l.inp || 'kb')]);
    // the tyres, marked where they are not the circuit's usual ones: gravel on Toomemägi, road at Raadi
    // (Raadi runs from before tyres were kept carry none and get no mark)
    const ty = (r) => (r?.track === 'raadi' ? r.ty === 'road' : r?.ty === 'gravel') ? tyreMark(r.ty) : '';
    const ic = (r) => (kinds.size > 1 ? inpIcon(r?.inp || 'kb') : '') + ty(r);
    // (the best ever also says the day the record was set)
    // (your own name in the lists in cyan)
    const meName = (mp.name || '').toLowerCase();
    const cell = (r, dated, track = 'toomemagi') => (r ? `${ic(r)}${time(track, r)}<small class="nm${r.name && r.name.toLowerCase() === meName ? ' me' : ''}">${escapeHtml(r.name)}</small>${dated && r.at ? `<small class="date">${day(r.at)}</small>` : ''}` : '<small class="none">–</small>');
    // (the server's five a car once they are here; till then the board's one)
    const both = (track, id, ever1, today1, fix) => (top?.[track] ? [topList(track, id, 'all', fix), topList(track, id, 'today', fix)] : [ever1 ? [ever1] : [], today1 ? [today1] : []]);
    const rows = order.map((id) => { const [e, t] = both('toomemagi', id, pick(b?.allTime, id), pick(b?.today, id)); return carRows(id, 'toomemagi', e, t, own(race.laps, id, ic), cell); }).join('');
    const todayBest = (b?.today || []).reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
    const when = (at) => new Date(at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const mine = race.laps.slice(-5).reverse()
      .map((l) => `<li>${ic(l)}${time('toomemagi', l)} ${escapeHtml(cars[l.car]?.short || l.car)} <small>${when(l.at)}</small></li>`).join('');
    // latest laps by anyone (20 on desktop, the 5 newest on phones: style.css)
    const recent = (b?.recent || []).slice(0, 20)
      .map((l) => `<li>${ic(l)}${time('toomemagi', l)} <i>${escapeHtml(l.name)}</i> ${escapeHtml(cars[l.car]?.short || l.car)} <small>${day(l.at)}</small></li>`).join('');
    if (stage) { renderTabs({ b, pick, day, ic, cell, when, both }); return; }
    // (a close button that stays in the corner while the board scrolls; BACK is at the very bottom)
    panel.innerHTML = `<button class="bclose" data-board="close" aria-label="Back">✕</button><h2>TOOMEMÄGI · LAP TIMES</h2>
      <p class="small">${(race.track.length / 1000).toFixed(1)} km around Toomemägi · start and finish on Küüni${b ? ` · ${b.laps} lap${b.laps === 1 ? "" : "s"} driven` : ' · lap times are offline'}</p>
      ${b?.allTime?.length ? `<p class="today lr">${rec(least(b.allTime), 'toomemagi', ic, 'LAP RECORD')}</p>` : ''}
      ${todayBest ? `<p class="today">FASTEST TODAY ${ic(todayBest)}${time('toomemagi', todayBest)} ${escapeHtml(todayBest.name)} · ${escapeHtml(cars[todayBest.car]?.short || todayBest.car)}</p>` : ''}
      <div class="tablelaps"><table><thead><tr><th colspan="2">CAR</th><th>BEST EVER</th><th>BEST TODAY</th><th class="you">YOUR BEST</th></tr></thead>${rows}</table>
      ${mine || recent ? `<div class="lastlaps">${mine ? `<div class="mine"><span>YOUR LAST LAPS</span><ol>${mine}</ol></div>` : ''}${recent ? `<div class="mine recent"><span>LATEST LAPS · EVERYONE</span><ol>${recent}</ol></div>` : ''}</div>` : ''}</div>
      <div class="row"><button class="neon" data-board="close">BACK</button>${b ? '<a class="small dl" href="/api/laps.csv" target="_blank" rel="noopener">ALL LAPS (CSV)</a>' : ''}</div>`;
  }

  // One tab a track (Martin, 27 Nov 2026: "perhaps worth putting the results page in tabs based on track"; until then
  // Toomemägi and Majoraadi side by side, 23 Nov): the cards' order in the garage, ÜLENURME (the drag strip, with
  // ?drag=1 on a desktop) · TOOMEMÄGI · MAJORAADI, each with its record, its table of cars (the five best a car when
  // a row opens, your best with its place) and its last laps, yours and everyone's. The board opens on the track
  // picked in the garage; a tab picked stays while the page is open. Raadi's and the strip's times come from the
  // server like Toomemägi's (their parts of the board, `raadi` and `drag`); while the server cannot be reached
  // Raadi's table shows this browser's own runs.
  let tab = null;
  function renderTabs({ b, pick, day, ic, cell, when, both }) {
    const me = mp.name, R0 = b?.raadi, D0 = b?.drag;
    const runs = stage.runs.map((r) => ({ ...r, name: me, track: 'raadi' }));
    // (the server keeps the tyres as gravel or nothing: nothing is road tyres there)
    const net = (list) => (list || []).map((r) => ({ ...r, track: 'raadi', ty: r.ty || 'road' }));
    const today = new Date().toDateString();
    const bestOf = (list, id) => list.filter((r) => r.car === id).reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
    const [T, R] = TRACKS;
    const tabs = [...(drag ? [DRAG_CARD] : []), T, R];
    if (!tabs.some((t) => t.id === tab)) tab = 'toome';
    const head = (t, sub, r, track) => `<h3>${TRACK_ICON[t.id]}${t.name} <small>${t.km} KM · ${t.surface}${sub ? ` · ${sub}` : ''}</small>${rec(r, track, ic)}</h3>`;
    const table = (rows, you = 'YOUR BEST') => `<table><thead><tr><th colspan="2">CAR</th><th>BEST EVER</th><th>BEST TODAY</th><th class="you">${you}</th></tr></thead>${rows}</table>`;
    const lists = (mine, recent, what) => (mine || recent ? `<div class="lastlaps">${mine ? `<div class="mine"><span>YOUR LAST ${what}</span><ol>${mine}</ol></div>` : ''}${recent ? `<div class="mine recent"><span>LATEST ${what} · EVERYONE</span><ol>${recent}</ol></div>` : ''}</div>` : '');
    const line = (l, track, who) => `<li>${ic(l)}${time(track, l)} ${who ? `<i>${escapeHtml(l.name)}</i> ` : ''}${escapeHtml(cars[l.car]?.short || l.car)} <small>${who ? day(l.at) : when(l.at)}</small></li>`;
    let body = '', count = '';
    if (tab === 'toome') {
      const rows = order.map((id) => { const [e, t] = both('toomemagi', id, pick(b?.allTime, id), pick(b?.today, id)); return carRows(id, 'toomemagi', e, t, own(race.laps, id, ic), cell); }).join('');
      const mine = race.laps.slice(-5).reverse().map((l) => line(l, 'toomemagi')).join('');
      const recent = (b?.recent || []).slice(0, 20).map((l) => line(l, 'toomemagi', true)).join('');
      body = `${head(T, 'LAP', least(b?.allTime || []), 'toomemagi')}${table(rows)}${lists(mine, recent, 'LAPS')}`;
      count = b ? `${b.laps} lap${b.laps === 1 ? '' : 's'} of Toomemägi driven` : 'lap times are offline';
    } else if (tab === 'raadi') {
      const kept = runs.filter((r) => r.inp);                      // (the ones that count: see best() in raadi.js)
      const everR = R0 ? net(R0.allTime) : kept, todayR = R0 ? net(R0.today) : kept.filter((r) => new Date(r.at).toDateString() === today);
      // (the server's lists of the stage only while it can be reached: offline the table is this browser's own runs)
      const rows = order.map((id) => {
        const [e, t] = R0 && top?.raadi ? both('raadi', id, null, null, (r) => net([r])[0]) : [[bestOf(everR, id)].filter(Boolean), [bestOf(todayR, id)].filter(Boolean)];
        return carRows(id, 'raadi', e, t, own(kept, id, ic, 'raadi'), cell);
      }).join('');
      const mine = [...runs].sort((p, q) => (p.at < q.at ? 1 : -1)).slice(0, 5).map((l) => line(l, 'raadi')).join('');
      const recent = (R0 ? net(R0.recent) : runs).slice().sort((p, q) => (p.at < q.at ? 1 : -1)).slice(0, 20).map((l) => line(l, 'raadi', true)).join('');
      body = `${head(R, 'STAGE', R0 ? least(net(R0.allTime)) : null, 'raadi')}${table(rows)}${lists(mine, recent, 'RUNS')}`;
      count = R0 ? `${R0.laps} run${R0.laps === 1 ? '' : 's'} of the Majoraadi stage driven` : 'stage times are offline';
    } else {
      // the drag strip: the quarter mile's ET (from the car leaving the line, as a timeslip has it), clean runs only
      const ownD = dragOwn();
      const rows = order.filter((id) => DRAG_LIMITS[id]).map((id) => { const [e, t] = both('drag', id, pick(D0?.allTime, id), pick(D0?.today, id)); return carRows(id, 'drag', e, t, own(ownD, id, ic, 'drag'), cell); }).join('');
      const mine = (drag.runs || []).slice(0, 5).map((l) => line(l, 'drag')).join('');
      const recent = (D0?.recent || []).slice(0, 20).map((l) => line(l, 'drag', true)).join('');
      body = `${head(DRAG_CARD, '1/4 MILE ET', least(D0?.allTime || []), 'drag')}${table(rows)}${lists(mine, recent, 'RUNS')}`;
      count = D0 ? `${D0.laps} clean quarter mile${D0.laps === 1 ? '' : 's'} at Ülenurme` : 'drag times are offline';
    }
    const bar = tabs.map((t) => `<button class="btab${t.id === tab ? ' on' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === tab}">${TRACK_ICON[t.id]}<span>${t.name}</span></button>`).join('');
    panel.innerHTML = `<button class="bclose" data-board="close" aria-label="Back">✕</button><h2>TARTU · LAP TIMES</h2>
      <div class="btabs" role="tablist">${bar}</div>
      <p class="small">${count}</p>
      <div class="boards"><div class="bcol">${body}</div></div>
      <div class="row"><button class="neon" data-board="close">BACK</button>${b ? '<a class="small dl" href="/api/laps.csv" target="_blank" rel="noopener">ALL LAPS (CSV)</a>' : ''}</div>`;
  }
  // this browser's best on the strip per car, as the board's laps are
  const dragOwn = () => Object.entries(drag?.best || {}).filter(([, v]) => Number.isFinite(v?.et)).map(([car, v]) => ({ car, ms: Math.round(v.et * 1000), at: v.at, inp: v.inp }));

  function show() {
    opened.add(carNow());
    tab = nearTrack?.() || picker?.picked || 'toome';     // (the track the car is at, else the one picked in the garage)
    panel.classList.remove('hidden');
    render();
    mp?.refreshBoard?.();        // the live updates may have missed a lap (a dropped connection)
    loadTop();
  }
  btn.addEventListener('click', show);
  const record = (id) => {
    if (id === 'raadi') {
      // (the server's, or this browser's own best while a run of its is still on the way there)
      const own = stage.best().any, net = least(mp.board?.raadi?.allTime || []);
      const r = net && (!own || net.ms <= own.ms) ? net : own && { ...own, name: mp.name };
      return r ? { ms: r.ms, name: r.name, car: cars[r.car]?.short } : null;
    }
    const r = least((id === 'drag' ? mp.board?.drag?.allTime : mp.board?.allTime) || []);
    return r ? { ms: r.ms, name: r.name, car: cars[r.car]?.short } : null;
  };
  // (the drag strip's best: this browser's quickest clean quarter mile in any car)
  const dragBest = () => { const l = Object.values(drag?.best || {}).filter((b) => Number.isFinite(b?.et)); return l.length ? { ms: Math.min(...l.map((b) => b.et)) * 1000 } : null; };
  const mine = (id) => (id === 'raadi' ? stage.best().any : id === 'drag' ? dragBest() : least(race.laps));
  const picker = stage ? createTrackPicker({ after: menu.querySelector('.tag'), record, mine, onOpenBoard: show, onPick: onTrack, drag: !!drag }) : null;
  if (!stage) createOutline({ after: menu.querySelector('.tag'), onOpen: show });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-board="close"]')) panel.classList.add('hidden');
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; render(); return; }
    const rp = e.target.closest('[data-rp]');
    if (rp) { const [track, car] = rp.dataset.rp.split('|'); onWatch(track, car); return; }
    // a car's row opens or closes, in both circuits' tables at once
    const g = e.target.closest('tr.main')?.parentNode;
    if (!g?.dataset.car) return;
    const id = g.dataset.car;
    if (opened.has(id)) opened.delete(id); else opened.add(id);
    for (const t of panel.querySelectorAll(`tbody[data-car="${id}"]`)) t.classList.toggle('open', opened.has(id) && !t.classList.contains('nomore'));
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); e.stopImmediatePropagation(); } }, true);

  return { render: () => { render(); picker?.render(); topSoon(); }, get track() { return picker?.picked || 'toome'; }, follow: (id) => picker?.follow(id), show, hide: () => panel.classList.add('hidden'), get open() { return !panel.classList.contains('hidden'); } };
}
