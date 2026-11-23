// The start screen's track picker (?raadi=1 while Raadi is tried out; Martin's plan of 23 Nov 2026): a card
// per circuit in place of the Toomemägi outline. Each shows the circuit's outline, its length and surface in
// one word; the picked one is bigger and shows the record and LAP TIMES. On phones a row of pills under the
// logo. DRIVE then starts at the picked circuit (main.js); the line under DRIVE says which.
import TRACK from './track.json';
import { stagePath, STAGE_KM } from './raadi.js';
import { fmtTime, escapeHtml } from './race.js';

const KEY = 'kvissuroam.track';

// a circuit's outline as SVG path data, north up, in a box `size` across
function loopPath(pts, size = 1000, pad = 60, step = 3, close = true) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const k = (size - pad * 2) / Math.max(x1 - x0, z1 - z0);
  let d = '';
  for (let i = 0; i < pts.length; i += step) d += `${i ? 'L' : 'M'}${((pts[i][0] - x0) * k + pad).toFixed(1)} ${((pts[i][1] - z0) * k + pad).toFixed(1)}`;
  return { d: d + (close ? 'Z' : ''), w: ((x1 - x0) * k + pad * 2).toFixed(1), h: ((z1 - z0) * k + pad * 2).toFixed(1) };
}

const toome = loopPath(TRACK.pts);
const raadi = stagePath();
// the small marks used beside a lap in the lists (as big as the controller marks)
export const TRACK_ICON = {
  toome: `<svg class="trk" viewBox="0 0 ${toome.w} ${toome.h}" role="img" aria-label="TOOMEMÄGI"><title>TOOMEMÄGI</title><path d="${toome.d}"/></svg>`,
  raadi: `<svg class="trk" viewBox="0 0 ${raadi.w} ${raadi.h}" role="img" aria-label="RAADI"><title>RAADI</title><path d="${raadi.d}"/></svg>`,
};

export const TRACKS = [
  { id: 'toome', name: 'TOOMEMÄGI', km: (TRACK.length / 1000).toFixed(1), surface: 'ASPHALT', kind: 'CIRCUIT', path: toome },
  { id: 'raadi', name: 'RAADI', km: STAGE_KM, surface: 'GRAVEL', kind: 'RALLY STAGE', path: raadi },
];

export function pickedTrack() {
  try { const t = localStorage.getItem(KEY); return TRACKS.some((x) => x.id === t) ? t : 'toome'; } catch { return 'toome'; }
}

// record(id): { ms, name } or null
export function createTrackPicker({ after, record, onOpenBoard, onPick }) {
  let picked = pickedTrack();
  const el = document.createElement('div');
  el.id = 'trackpick';
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', 'Track');
  after.after(el);
  function render() {
    el.innerHTML = TRACKS.map((t) => {
      const on = t.id === picked, r = on ? record(t.id) : null;
      return `<button class="tcard${on ? ' on' : ''}" data-track="${t.id}" role="radio" aria-checked="${on}">
        <svg viewBox="0 0 ${t.path.w} ${t.path.h}" aria-hidden="true"><path class="tube" d="${t.path.d}"/><path class="core" d="${t.path.d}"/></svg>
        <span class="tx"><b>${t.name}</b><small>${t.km} KM · ${t.surface}</small>${on ? `<small class="rec">${r ? `RECORD ${fmtTime(r.ms / 1000)} <i>${escapeHtml(r.name || '')}</i>` : 'NO TIME YET'}</small><span class="lt" data-lt="1">LAP TIMES ›</span>` : ''}</span>
      </button>`;
    }).join('');
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-track]');
    if (!b) return;
    b.blur();
    if (e.target.closest('[data-lt]') || b.dataset.track === picked) { onOpenBoard(); return; }
    picked = b.dataset.track;
    try { localStorage.setItem(KEY, picked); } catch { /* private mode */ }
    render();
    onPick?.(picked);
  });
  render();
  return { get picked() { return picked; }, render, el };
}
