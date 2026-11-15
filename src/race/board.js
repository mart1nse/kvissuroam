// Garage additions: the driver name (changeable, never required) and the lap times board,
// best lap per car of all time and of today, plus this browser's last laps.
import { fmtTime, escapeHtml } from './race.js';

export function createBoard({ mp, race, cars, order }) {
  const menu = document.querySelector('#menu');
  const drive = document.querySelector('#drive');

  const row = document.createElement('div');
  row.id = 'menurow';
  row.innerHTML = `<label id="driver"><span>DRIVER</span><input id="drivername" maxlength="20" spellcheck="false" autocomplete="off" /></label>`;
  drive.replaceWith(row);
  row.appendChild(drive);
  const btn = document.createElement('button');
  btn.id = 'boardbtn'; btn.className = 'neon alt'; btn.textContent = 'LAP TIMES';
  row.appendChild(btn);

  const input = row.querySelector('#drivername');
  mp.nameReady.then((n) => { if (document.activeElement !== input) input.value = n; });
  const commit = () => { input.value = mp.setName(input.value) || mp.name; };
  input.addEventListener('change', commit);
  input.addEventListener('blur', commit);
  // typing a name must not drive the menu (arrows switch cars, Enter / Space start)
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());

  const panel = document.createElement('div');
  panel.id = 'board';
  panel.className = 'screen hidden';
  document.body.appendChild(panel);

  function render() {
    if (panel.classList.contains('hidden')) return;
    const b = mp.board;
    const pick = (list, id) => list?.find((r) => r.car === id);
    const cell = (r) => (r ? `<b>${fmtTime(r.ms / 1000)}</b><small>${escapeHtml(r.name)}</small>` : '<small class="none">–</small>');
    const rows = order.map((id) => `<tr><th>${escapeHtml(cars[id].short)}</th><td>${cell(pick(b?.allTime, id))}</td><td>${cell(pick(b?.today, id))}</td></tr>`).join('');
    const todayBest = (b?.today || []).reduce((m, r) => (!m || r.ms < m.ms ? r : m), null);
    const mine = race.laps.slice(-5).reverse()
      .map((l) => `<li><b>${fmtTime(l.ms / 1000)}</b> ${escapeHtml(cars[l.car]?.short || l.car)} <small>${new Date(l.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></li>`).join('');
    panel.innerHTML = `<h2>TOOMEMÄGI · LAP TIMES</h2>
      <p class="small">${(race.track.length / 1000).toFixed(1)} km around Toomemägi · start and finish on Küüni${b ? ` · ${b.laps} lap${b.laps === 1 ? "" : "s"} driven` : ' · lap times are offline'}</p>
      ${todayBest ? `<p class="today">FASTEST TODAY <b>${fmtTime(todayBest.ms / 1000)}</b> ${escapeHtml(todayBest.name)} · ${escapeHtml(cars[todayBest.car]?.short || todayBest.car)}</p>` : ''}
      <table><thead><tr><th>CAR</th><th>BEST EVER</th><th>BEST TODAY</th></tr></thead><tbody>${rows}</tbody></table>
      ${mine ? `<div class="mine"><span>YOUR LAST LAPS</span><ol>${mine}</ol></div>` : ''}
      <div class="row"><button class="neon" data-board="close">BACK</button>${b ? '<a class="small dl" href="/api/laps.csv" target="_blank" rel="noopener">ALL LAPS (CSV)</a>' : ''}</div>`;
  }

  btn.addEventListener('click', () => {
    panel.classList.remove('hidden');
    render();
  });
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-board="close"]')) panel.classList.add('hidden'); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); e.stopImmediatePropagation(); } }, true);

  return { render, get open() { return !panel.classList.contains('hidden'); } };
}
