// The start screen's track picker (?raadi=1 while Raadi is tried out; Martin's plan of 23 Nov 2026): a card
// per circuit in place of the Toomemägi outline. Each shows the circuit's outline, its length and surface in
// one word; the picked one is bigger and shows the record and your best. On phones a row of pills under the
// logo. DRIVE then starts at the picked circuit (main.js); the line under DRIVE says which.
// Each outline is drawn as the old Toomemägi map was (src/race/outline.js: a thin neon tube, the start line
// across it) with its bright dot and tail going round, Raadi's from the start to the finish and again
// (Martin 23 Nov: "the same old animation should be there going through the lap ... also the raadi one").
import TRACK from './track.json';
import { stagePath, STAGE_KM } from './raadi.js';
import { fmtTime, escapeHtml } from './race.js';


// a circuit's outline as SVG path data, north up, in a box `size` across
function loopPath(pts, size = 1000, pad = 60, step = 3, close = true) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const k = (size - pad * 2) / Math.max(x1 - x0, z1 - z0);
  let d = '';
  for (let i = 0; i < pts.length; i += step) d += `${i ? 'L' : 'M'}${((pts[i][0] - x0) * k + pad).toFixed(1)} ${((pts[i][1] - z0) * k + pad).toFixed(1)}`;
  // the start and finish line, across the track
  const [ax, az] = pts[0], [bx, bz] = pts[6], l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * 34 * k, nz = (bx - ax) / l * 34 * k;
  const sx = (ax - x0) * k + pad, sz = (az - z0) * k + pad;
  return { d: d + (close ? 'Z' : ''), w: ((x1 - x0) * k + pad * 2).toFixed(1), h: ((z1 - z0) * k + pad * 2).toFixed(1), sf: [sx - nx, sz - nz, sx + nx, sz + nz].map((v) => v.toFixed(1)) };
}
const TAIL = 70;               // length of the dot's tail, in thousandths of the way round

const toome = loopPath(TRACK.pts);
const raadi = stagePath();
// the small marks used beside a lap in the lists (as big as the controller marks)
export const TRACK_ICON = {
  toome: `<svg class="trk" viewBox="0 0 ${toome.w} ${toome.h}" role="img" aria-label="TOOMEMÄGI"><title>TOOMEMÄGI</title><path d="${toome.d}"/></svg>`,
  raadi: `<svg class="trk rd" viewBox="0 0 ${raadi.w} ${raadi.h}" role="img" aria-label="RAADI"><title>RAADI</title><path d="${raadi.d}"/></svg>`,
};

export const TRACKS = [
  { id: 'toome', name: 'TOOMEMÄGI', km: (TRACK.length / 1000).toFixed(1), surface: 'ASPHALT', meta: 'OLD TOWN · START ON KÜÜNI', modes: [['race', 'ONLINE RACES'], ['', 'TIME ATTACK']], path: toome, loop: true, secs: 7 },
  { id: 'raadi', name: 'RAADI', km: STAGE_KM, surface: 'GRAVEL', meta: 'RALLY ESTONIA SS16', modes: [['', 'RALLY STAGE']], path: raadi, secs: 5 },
];

// A fresh page always opens with Toomemägi picked (Martin 23 Nov: the last pick is not remembered); a link
// with ?track=raadi opens with that one.
export function pickedTrack() {
  const t = new URLSearchParams(location.search).get('track');
  return TRACKS.some((x) => x.id === t) ? t : 'toome';
}

// record(id): the best time of all { ms, name, car } or null; mine(id): this player's best { ms } or null
export function createTrackPicker({ after, record, mine, onOpenBoard, onPick }) {
  let picked = pickedTrack();
  const el = document.createElement('div');
  el.id = 'trackpick';
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', 'Track');
  after.after(el);
  let shown = '';
  function render() {
    const html = TRACKS.map((t) => {
      const on = t.id === picked, r = record(t.id), m = on ? mine?.(t.id) : null, p = t.path;
      // the dot and its tail going round (t.secs a time), the start line across a lap, a start mark on a stage
      const tail = `<path d="${p.d}" class="tail" pathLength="1000" stroke-dasharray="${TAIL} ${1000 - TAIL}"><animate attributeName="stroke-dashoffset" from="${TAIL}" to="${TAIL - 1000}" dur="${t.secs}s" repeatCount="indefinite"/></path>`
        + `<g class="dot"><circle r="44" class="glow"/><circle r="19"/><animateMotion dur="${t.secs}s" repeatCount="indefinite" path="${p.d}"/></g>`;
      const sf = p.start ? `<circle class="sf" cx="${p.start[0]}" cy="${p.start[1]}" r="9"/>` : `<line class="sf" x1="${p.sf[0]}" y1="${p.sf[1]}" x2="${p.sf[2]}" y2="${p.sf[3]}"/>`;
      return `<button class="tcard${on ? ' on' : ''}" data-track="${t.id}" role="radio" aria-checked="${on}">
        <svg viewBox="0 0 ${p.w} ${p.h}" aria-hidden="true"><path class="halo" d="${p.d}"/><path class="tube" d="${p.d}"/><path class="core" d="${p.d}"/>${sf}${tail}</svg>
        <span class="tx"><b class="nm">${t.name}</b><small class="meta">${t.km} KM · <i>${t.surface}</i>${on ? `<u style="text-decoration:none"> · ${t.meta}</u>` : ''}</small>
        <span class="modes">${t.modes.map(([c, w]) => `<i class="${c}">${w}</i>`).join('')}</span>
        <span class="dl"><em>RECORD</em><span>${r ? `<b>${fmtTime(r.ms / 1000)}</b>${on ? `<small>${escapeHtml(r.name || '')}${r.car ? ` · ${escapeHtml(r.car)}` : ''}</small>` : ''}` : '<small>NO TIME YET</small>'}</span>
        ${on ? `<em>YOUR BEST</em><span>${m ? `<b>${fmtTime(m.ms / 1000)}</b>` : '<small>–</small>'}</span>` : ''}</span>
        </span>
      </button>`;
    }).join('');
    if (html !== shown) { shown = html; el.innerHTML = html; }
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-track]');
    if (!b) return;
    b.blur();
    if (b.dataset.track === picked) return;          // (a click only picks: the lap times are on their own button, Martin 23 Nov)
    picked = b.dataset.track;
    render();
    onPick?.(picked);
  });
  render();
  return { get picked() { return picked; }, render, el };
}
