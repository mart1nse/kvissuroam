// Garage additions: the driver name (changeable, never required) and the lap times board,
// best lap per car of all time and of today, plus this browser's last laps.
import { tyreIcon } from '../hud.js';
import { fmtTime, escapeHtml } from './race.js';
import { createOutline } from './outline.js';
import { createTrackPicker, TRACK_ICON, TRACKS } from './trackpick.js';

// small marks for what drove a lap; laps from before this was kept count as keyboard
const INP = {
  kb: ['KEYBOARD', '<rect x="1.5" y="5" width="21" height="11" rx="1.5"/><path d="M5 8.5h1M8.5 8.5h1M12 8.5h1M15.5 8.5h1M19 8.5h0M7 12.5h10"/>'],
  pad: ['GAMEPAD', '<path d="M7 5h10c3 0 5 3 5.5 7s-1 6-3 6-3-3-5-3h-5c-2 0-3 3-5 3s-3.5-2-3-6S4 5 7 5z"/><path d="M7 9v4M5 11h4M16 10h0M18 12h0"/>'],
  wheel: ['WHEEL', '<circle cx="12" cy="10.5" r="8.5"/><circle cx="12" cy="10.5" r="2"/><path d="M3.6 9.5l6.4 1M20.4 9.5l-6.4 1M12 12.5V19"/>'],
  touch: ['TOUCH SCREEN', '<rect x="6.5" y="1.5" width="11" height="17" rx="2"/><path d="M10.5 15.5h3"/>'],
};
const tyreMark = (k) => `<i class="tymark ${k}" title="${k === 'gravel' ? 'Gravel' : 'Road'} tyres">${tyreIcon(k)}</i>`;
const inpIcon = (k) => { const [name, d] = INP[k] || INP.kb; return `<svg class="inp" viewBox="0 0 24 20" role="img" aria-label="${name}"><title>${name}</title>${d}</svg>`; };

// stage: the Raadi rally stage (?raadi=1): then a track picker in place of the outline, and both circuits' times
// onWatch(track, car): watch a record's replay (desktop; none on phones)
export function createBoard({ mp, race, cars, order, stage, onTrack, onWatch = null }) {
  const menu = document.querySelector('#menu');
  const drive = document.querySelector('#drive');

  const row = document.createElement('div');
  row.id = 'menurow';
  // the row under the cars: DRIVE in the middle, the driver's name to its left and the lap times to its right
  row.innerHTML = `<label id="driver" title="Your name on the lap times: type to change it"><span class="lbl">DRIVER</span><span class="field"><input id="drivername" maxlength="20" spellcheck="false" autocomplete="off" aria-label="Driver name" /><i class="caret"></i></span>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17l1-4L14 3l3 3L7 16z M12 5l3 3"/></svg></label>`;
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
  // blinks twice, with no message)
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
  // pick the name every time the menu opens (start and back to the garage)
  new MutationObserver(() => requestAnimationFrame(preselect)).observe(menu, { attributes: true, attributeFilter: ['class'] });
  requestAnimationFrame(preselect);
  input.addEventListener('keyup', (e) => e.stopPropagation());

  const panel = document.createElement('div');
  panel.id = 'board';
  panel.className = 'screen hidden';
  document.body.appendChild(panel);

  // Your own best in each car, beside the records (Martin, 23 Nov 2026: when others were faster his times
  // were nowhere on the board). From this browser's laps, with the day it was set.
  function own(list, id, ic, track = 'toomemagi') {
    const r = list.reduce((m, l) => (l.car === id && (!m || l.ms < m.ms) ? l : m), null);
    if (!r) return '<small class="none">–</small>';
    const d = r.at ? new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
    return `${ic(r)}${time(track, r)}${d ? `<small class="date">${d}</small>` : ''}`;
  }

  // A record lap whose replay the server keeps (src/race/replay.js) can be watched by clicking its time (Martin,
  // 2026-11-24: no underline or button, something people find as they click around): wherever that time shows.
  // track: the server's name for the circuit ('toomemagi' or 'raadi')
  const watchable = (track, r) => !!(onWatch && r && mp.board?.rp?.[track]?.[r.car] === r.ms);
  const time = (track, r) => (watchable(track, r) ? `<b class="rp" data-rp="${track}|${escapeHtml(r.car)}">${fmtTime(r.ms / 1000)}</b>` : `<b>${fmtTime(r.ms / 1000)}</b>`);
  const srv = (t) => (t === 'raadi' ? 'raadi' : 'toomemagi');

  function render() {
    if (panel.classList.contains('hidden')) return;
    const b = mp.board;
    const pick = (list, id) => list?.find((r) => r.car === id);
    const day = (at) => new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' });
    // which controller drove each lap shows only once laps exist with more than one kind
    const kinds = new Set([...(b?.inputs || []), ...(b?.raadi?.inputs || []), ...race.laps.map((l) => l.inp || 'kb'), ...(stage?.runs || []).map((l) => l.inp || 'kb')]);
    // the tyres, marked where they are not the circuit's usual ones: gravel on Toomemägi, road at Raadi
    // (Raadi runs from before tyres were kept carry none and get no mark)
    const ty = (r) => (r?.track === 'raadi' ? r.ty === 'road' : r?.ty === 'gravel') ? tyreMark(r.ty) : '';
    const ic = (r) => (kinds.size > 1 ? inpIcon(r?.inp || 'kb') : '') + ty(r);
    // (the best ever also says the day the record was set)
    const cell = (r, dated, track = 'toomemagi') => (r ? `${ic(r)}${time(track, r)}<small>${escapeHtml(r.name)}</small>${dated && r.at ? `<small class="date">${day(r.at)}</small>` : ''}` : '<small class="none">–</small>');
    const rows = order.map((id) => `<tr><th>${escapeHtml(cars[id].short)}</th><td>${cell(pick(b?.allTime, id), true)}</td><td>${cell(pick(b?.today, id))}</td><td class="you">${own(race.laps, id, ic)}</td></tr>`).join('');
    const todayBest = (b?.today || []).reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
    const when = (at) => new Date(at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const mine = race.laps.slice(-5).reverse()
      .map((l) => `<li>${ic(l)}${time('toomemagi', l)} ${escapeHtml(cars[l.car]?.short || l.car)} <small>${when(l.at)}</small></li>`).join('');
    // latest laps by anyone (20 on desktop, the 5 newest on phones: style.css)
    const recent = (b?.recent || []).slice(0, 20)
      .map((l) => `<li>${ic(l)}${time('toomemagi', l)} <i>${escapeHtml(l.name)}</i> ${escapeHtml(cars[l.car]?.short || l.car)} <small>${day(l.at)}</small></li>`).join('');
    if (stage) { renderBoth({ b, pick, day, ic, cell, when }); return; }
    // (a close button that stays in the corner while the board scrolls; BACK is at the very bottom)
    panel.innerHTML = `<button class="bclose" data-board="close" aria-label="Back">✕</button><h2>TOOMEMÄGI · LAP TIMES</h2>
      <p class="small">${(race.track.length / 1000).toFixed(1)} km around Toomemägi · start and finish on Küüni${b ? ` · ${b.laps} lap${b.laps === 1 ? "" : "s"} driven` : ' · lap times are offline'}</p>
      ${todayBest ? `<p class="today">FASTEST TODAY ${ic(todayBest)}${time('toomemagi', todayBest)} ${escapeHtml(todayBest.name)} · ${escapeHtml(cars[todayBest.car]?.short || todayBest.car)}</p>` : ''}
      <div class="tablelaps"><table><thead><tr><th>CAR</th><th>BEST EVER</th><th>BEST TODAY</th><th class="you">YOUR BEST</th></tr></thead><tbody>${rows}</tbody></table>
      ${mine || recent ? `<div class="lastlaps">${mine ? `<div class="mine"><span>YOUR LAST LAPS</span><ol>${mine}</ol></div>` : ''}${recent ? `<div class="mine recent"><span>LATEST LAPS · EVERYONE</span><ol>${recent}</ol></div>` : ''}</div>` : ''}</div>
      <div class="row"><button class="neon" data-board="close">BACK</button>${b ? '<a class="small dl" href="/api/laps.csv" target="_blank" rel="noopener">ALL LAPS (CSV)</a>' : ''}</div>`;
  }

  // Toomemägi and Raadi side by side (Martin, 23 Nov 2026), and one list of the latest laps on both, each
  // with the circuit's small outline. Raadi's times come from the server like Toomemägi's (its part of the
  // board, `raadi`); while the server cannot be reached the table shows this browser's own runs.
  function renderBoth({ b, pick, day, ic, cell, when }) {
    const me = mp.name, R0 = b?.raadi;
    const runs = stage.runs.map((r) => ({ ...r, name: me, track: 'raadi' }));
    // (the server keeps the tyres as gravel or nothing: nothing is road tyres there)
    const net = (list) => (list || []).map((r) => ({ ...r, track: 'raadi', ty: r.ty || 'road' }));
    const today = new Date().toDateString();
    const bestOf = (list, id) => list.filter((r) => r.car === id).reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
    const kept = runs.filter((r) => r.inp);                      // (the ones that count: see best() in raadi.js)
    const everR = R0 ? net(R0.allTime) : kept, todayR = R0 ? net(R0.today) : kept.filter((r) => new Date(r.at).toDateString() === today);
    const rowsT = order.map((id) => `<tr><th>${escapeHtml(cars[id].short)}</th><td>${cell(pick(b?.allTime, id), true)}</td><td>${cell(pick(b?.today, id))}</td><td class="you">${own(race.laps, id, ic)}</td></tr>`).join('');
    const rowsR = order.map((id) => `<tr><th>${escapeHtml(cars[id].short)}</th><td>${cell(bestOf(everR, id), true, 'raadi')}</td><td>${cell(bestOf(todayR, id), false, 'raadi')}</td><td class="you">${own(kept, id, ic, 'raadi')}</td></tr>`).join('');
    const [T, R] = TRACKS;
    const head = (t, sub) => `<h3>${TRACK_ICON[t.id]}${t.name} <small>${t.km} KM · ${t.surface}${sub ? ` · ${sub}` : ''}</small></h3>`;
    const table = (rows) => `<table><thead><tr><th>CAR</th><th>BEST EVER</th><th>BEST TODAY</th><th class="you">YOUR BEST</th></tr></thead><tbody>${rows}</tbody></table>`;
    const tag = (l) => TRACK_ICON[l.track || 'toome'];
    const mine = [...race.laps.map((l) => ({ ...l, track: 'toome' })), ...runs].sort((p, q) => (p.at < q.at ? 1 : -1)).slice(0, 5)
      .map((l) => `<li>${tag(l)}${ic(l)}${time(srv(l.track), l)} ${escapeHtml(cars[l.car]?.short || l.car)} <small>${when(l.at)}</small></li>`).join('');
    const recent = [...(b?.recent || []).map((l) => ({ ...l, track: 'toome' })), ...(R0 ? net(R0.recent) : runs)].sort((p, q) => (p.at < q.at ? 1 : -1)).slice(0, 20)
      .map((l) => `<li>${tag(l)}${ic(l)}${time(srv(l.track), l)} <i>${escapeHtml(l.name)}</i> ${escapeHtml(cars[l.car]?.short || l.car)} <small>${day(l.at)}</small></li>`).join('');
    panel.innerHTML = `<button class="bclose" data-board="close" aria-label="Back">✕</button><h2>TARTU · LAP TIMES</h2>
      <p class="small">${b ? `${b.laps} lap${b.laps === 1 ? '' : 's'} of Toomemägi${R0 ? ` and ${R0.laps} run${R0.laps === 1 ? '' : 's'} of the Raadi stage` : ''} driven` : 'lap times are offline'}</p>
      <div class="boards"><div class="bcol">${head(T, 'LAP')}${table(rowsT)}</div><div class="bcol">${head(R, 'STAGE')}${table(rowsR)}</div></div>
      ${mine || recent ? `<div class="lastlaps">${mine ? `<div class="mine"><span>YOUR LAST LAPS</span><ol>${mine}</ol></div>` : ''}${recent ? `<div class="mine recent"><span>LATEST LAPS · EVERYONE</span><ol>${recent}</ol></div>` : ''}</div>` : ''}
      <div class="row"><button class="neon" data-board="close">BACK</button>${b ? '<a class="small dl" href="/api/laps.csv" target="_blank" rel="noopener">ALL LAPS (CSV)</a>' : ''}</div>`;
  }

  function show() {
    panel.classList.remove('hidden');
    render();
    mp?.refreshBoard?.();        // the live updates may have missed a lap (a dropped connection)
  }
  btn.addEventListener('click', show);
  const least = (list) => list.reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
  const record = (id) => {
    if (id === 'raadi') {
      // (the server's, or this browser's own best while a run of its is still on the way there)
      const own = stage.best().any, net = least(mp.board?.raadi?.allTime || []);
      const r = net && (!own || net.ms <= own.ms) ? net : own && { ...own, name: mp.name };
      return r ? { ms: r.ms, name: r.name, car: cars[r.car]?.short } : null;
    }
    const r = least(mp.board?.allTime || []);
    return r ? { ms: r.ms, name: r.name, car: cars[r.car]?.short } : null;
  };
  const mine = (id) => (id === 'raadi' ? stage.best().any : least(race.laps));
  const picker = stage ? createTrackPicker({ after: menu.querySelector('.tag'), record, mine, onOpenBoard: show, onPick: onTrack }) : null;
  if (!stage) createOutline({ after: menu.querySelector('.tag'), onOpen: show });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-board="close"]')) panel.classList.add('hidden');
    const rp = e.target.closest('[data-rp]');
    if (rp) { const [track, car] = rp.dataset.rp.split('|'); onWatch(track, car); }
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); e.stopImmediatePropagation(); } }, true);

  return { render: () => { render(); picker?.render(); }, get track() { return picker?.picked || 'toome'; }, show, hide: () => panel.classList.add('hidden'), get open() { return !panel.classList.contains('hidden'); } };
}
