// Garage additions: the driver name (changeable, never required) and the lap times board,
// best lap per car of all time and of today, plus this browser's last laps.
import { fmtTime, escapeHtml } from './race.js';
import { createOutline } from './outline.js';

export function createBoard({ mp, race, cars, order }) {
  const menu = document.querySelector('#menu');
  const drive = document.querySelector('#drive');

  const row = document.createElement('div');
  row.id = 'menurow';
  row.innerHTML = `<label id="driver"><span>DRIVER</span><span class="field"><input id="drivername" maxlength="20" spellcheck="false" autocomplete="off" /><i class="caret"></i></span></label>`;
  drive.replaceWith(row);
  row.appendChild(drive);
  const btn = document.createElement('button');
  btn.id = 'boardbtn'; btn.className = 'neon alt'; btn.textContent = 'LAP TIMES';
  row.appendChild(btn);

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
  const commit = () => { input.value = mp.setName(input.value) || mp.name; };
  input.addEventListener('change', commit);
  input.addEventListener('blur', () => { unfresh(); commit(); });
  input.addEventListener('pointerdown', unfresh);
  input.addEventListener('input', unfresh);
  // typing a name must not drive the menu (arrows switch cars, Enter / Space start)
  input.addEventListener('keydown', (e) => {
    if (fresh && ['ArrowLeft', 'ArrowRight', 'Enter', 'Space'].includes(e.code)) {
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

  function render() {
    if (panel.classList.contains('hidden')) return;
    const b = mp.board;
    const pick = (list, id) => list?.find((r) => r.car === id);
    const day = (at) => new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' });
    // (the best ever also says the day the record was set)
    const cell = (r, dated) => (r ? `<b>${fmtTime(r.ms / 1000)}</b><small>${escapeHtml(r.name)}</small>${dated && r.at ? `<small class="date">${day(r.at)}</small>` : ''}` : '<small class="none">–</small>');
    const rows = order.map((id) => `<tr><th>${escapeHtml(cars[id].short)}</th><td>${cell(pick(b?.allTime, id), true)}</td><td>${cell(pick(b?.today, id))}</td></tr>`).join('');
    const todayBest = (b?.today || []).reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
    const when = (at) => new Date(at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const mine = race.laps.slice(-5).reverse()
      .map((l) => `<li><b>${fmtTime(l.ms / 1000)}</b> ${escapeHtml(cars[l.car]?.short || l.car)} <small>${when(l.at)}</small></li>`).join('');
    // latest laps by anyone (desktop only: hidden on small screens in style.css)
    const recent = (b?.recent || []).slice(0, 20)
      .map((l) => `<li><b>${fmtTime(l.ms / 1000)}</b> <i>${escapeHtml(l.name)}</i> ${escapeHtml(cars[l.car]?.short || l.car)} <small>${day(l.at)}</small></li>`).join('');
    // (a close button that stays in the corner while the board scrolls; BACK is at the very bottom)
    panel.innerHTML = `<button class="bclose" data-board="close" aria-label="Back">✕</button><h2>TOOMEMÄGI · LAP TIMES</h2>
      <p class="small">${(race.track.length / 1000).toFixed(1)} km around Toomemägi · start and finish on Küüni${b ? ` · ${b.laps} lap${b.laps === 1 ? "" : "s"} driven` : ' · lap times are offline'}</p>
      ${todayBest ? `<p class="today">FASTEST TODAY <b>${fmtTime(todayBest.ms / 1000)}</b> ${escapeHtml(todayBest.name)} · ${escapeHtml(cars[todayBest.car]?.short || todayBest.car)}</p>` : ''}
      <table><thead><tr><th>CAR</th><th>BEST EVER</th><th>BEST TODAY</th></tr></thead><tbody>${rows}</tbody></table>
      ${mine || recent ? `<div class="lastlaps">${mine ? `<div class="mine"><span>YOUR LAST LAPS</span><ol>${mine}</ol></div>` : ''}${recent ? `<div class="mine recent"><span>LATEST LAPS · EVERYONE</span><ol>${recent}</ol></div>` : ''}</div>` : ''}
      <div class="row"><button class="neon" data-board="close">BACK</button>${b ? '<a class="small dl" href="/api/laps.csv" target="_blank" rel="noopener">ALL LAPS (CSV)</a>' : ''}</div>`;
  }

  function show() {
    panel.classList.remove('hidden');
    render();
    mp?.refreshBoard?.();        // the live updates may have missed a lap (a dropped connection)
  }
  btn.addEventListener('click', show);
  createOutline({ after: menu.querySelector('.tag'), onOpen: show });
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-board="close"]')) panel.classList.add('hidden'); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); e.stopImmediatePropagation(); } }, true);

  return { render, show, hide: () => panel.classList.add('hidden'), get open() { return !panel.classList.contains('hidden'); } };
}
