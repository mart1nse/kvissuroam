// The start screen's track picker (Martin's plan of 23 Nov 2026; for everyone since the Raadi stage opened on 26 Nov):
// a card per circuit in place of the Toomemägi outline. Each shows the circuit's outline, its length and surface in
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
  raadi: `<svg class="trk rd" viewBox="0 0 ${raadi.w} ${raadi.h}" role="img" aria-label="MAJORAADI"><title>MAJORAADI</title><path d="${raadi.d}"/></svg>`,
  // (the drag strip: its quarter mile, the start line across its foot)
  drag: '<svg class="trk dg" viewBox="0 0 1000 1000" role="img" aria-label="ÜLENURME"><title>ÜLENURME</title><path d="M500 940L500 60M330 940H670"/></svg>',
};

// (The stage is MAJORAADI to the players since 26 Nov 2026, Martin: "rename raadi to majoraadi all across (except the
// flag to test it)". Its id, the server's track name, saved times and the ?raadi=1 / ?track=raadi links stay 'raadi'.)
export const TRACKS = [
  { id: 'toome', name: 'TOOMEMÄGI', km: (TRACK.length / 1000).toFixed(1), surface: 'ASPHALT', meta: 'OLD TOWN · START ON KÜÜNI', modes: [['race', 'ONLINE RACES'], ['', 'TIME ATTACK']], path: toome, loop: true, secs: 7 },
  { id: 'raadi', name: 'MAJORAADI', km: STAGE_KM, surface: 'GRAVEL', meta: 'RALLY ESTONIA SS16', modes: [['', 'RALLY STAGE']], path: raadi, secs: 5 },
];

// The drag strip at Ülenurme (?drag=1, desktop only, Martin 27 Nov 2026: "ÜLENURME TOOMEMÄE MAJORAADI, toomemäe in
// the center and default pick"): a card left of Toomemägi. Its outline is the quarter mile seen from above, the start
// line across its foot; the dot runs it as a car does, slow off the line and faster to the end, then waits there.
const DRAG_PATH = { d: 'M150 960L150 40', w: '300', h: '1000', sf: ['40', '960', '260', '960'],
  // (both of the dot's animations: three quarters of the time to the end, speeding up all the way, then a rest)
  motion: 'calcMode="spline" keyTimes="0;0.75;1" keySplines="0.6 0 0.9 0.55;0 0 1 1"' };
export const DRAG_CARD = { id: 'drag', name: 'ÜLENURME', km: '0.4', surface: 'ASPHALT', meta: 'DRAG STRIP · 1/4 MILE', modes: [['race', 'DRAG RACE'], ['', 'PRACTICE']], path: DRAG_PATH, secs: 3.2,
  // (a drag strip's time is seconds and thousandths, not a lap's minutes)
  fmt: (ms) => (ms / 1000).toFixed(3) };

// A fresh page always opens with Toomemägi picked (Martin 23 Nov: the last pick is not remembered); a link
// with ?track=raadi opens with that one (?track=drag with the drag strip's card there).
export function pickedTrack(drag = false) {
  const t = new URLSearchParams(location.search).get('track');
  return TRACKS.some((x) => x.id === t) || (drag && t === 'drag') ? t : 'toome';
}

// record(id): the best time of all { ms, name, car } or null; mine(id): this player's best { ms } or null;
// drag: the drag strip's card too, first in the row
export function createTrackPicker({ after, record, mine, onOpenBoard, onPick, drag = false }) {
  const cards = drag ? [DRAG_CARD, ...TRACKS] : TRACKS;
  let picked = pickedTrack(drag);
  const el = document.createElement('div');
  el.id = 'trackpick';
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', 'Track');
  after.after(el);
  let shown = '';
  function render() {
    const html = cards.map((t) => {
      const on = t.id === picked, r = record(t.id), m = on ? mine?.(t.id) : null, p = t.path, fmt = t.fmt || ((ms) => fmtTime(ms / 1000));
      // the dot and its tail going round (t.secs a time), the start line across a lap, a start mark on a stage
      // (p.motion: the drag strip's dot speeding up and then resting at the end, the tail with it)
      const tail = `<path d="${p.d}" class="tail" pathLength="1000" stroke-dasharray="${TAIL} ${1000 - TAIL}"><animate attributeName="stroke-dashoffset" ${p.motion ? `values="${TAIL};${TAIL - 1000};${TAIL - 1000}" ${p.motion}` : `from="${TAIL}" to="${TAIL - 1000}"`} dur="${t.secs}s" repeatCount="indefinite"/></path>`
        + `<g class="dot"><circle r="44" class="glow"/><circle r="19"/><animateMotion ${p.motion ? `keyPoints="0;1;1" ${p.motion} ` : ''}dur="${t.secs}s" repeatCount="indefinite" path="${p.d}"/></g>`;
      const sf = p.start ? `<circle class="sf" cx="${p.start[0]}" cy="${p.start[1]}" r="9"/>` : `<line class="sf" x1="${p.sf[0]}" y1="${p.sf[1]}" x2="${p.sf[2]}" y2="${p.sf[3]}"/>`;
      return `<button class="tcard${on ? ' on' : ''}" data-track="${t.id}" role="radio" aria-checked="${on}">
        <svg viewBox="0 0 ${p.w} ${p.h}" aria-hidden="true"><path class="halo" d="${p.d}"/><path class="tube" d="${p.d}"/><path class="core" d="${p.d}"/>${sf}${tail}</svg>
        <span class="tx"><b class="nm">${t.name}</b><small class="meta">${t.km} KM · <i>${t.surface}</i>${on ? `<u style="text-decoration:none"> · ${t.meta}</u>` : ''}</small>
        <span class="modes">${t.modes.map(([c, w]) => `<i class="${c}">${w}</i>`).join('')}</span>
        <span class="dl"><em>RECORD</em><span>${r ? `<b>${fmt(r.ms)}</b>${on ? `<small>${escapeHtml(r.name || '')}${r.car ? ` · ${escapeHtml(r.car)}` : ''}</small>` : ''}` : '<small>NO TIME YET</small>'}</span>
        ${on ? `<em>YOUR BEST</em><span>${m ? `<b>${fmt(m.ms)}</b>` : '<small>–</small>'}</span>` : ''}</span>
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
  // (the garage opens on the track the car is at, Martin 26 Nov: the TOOMEMÄGI button or H, then the garage and
  // DRIVE, took the car back to Raadi because the picker still said Raadi. Not a pick: no tyres change.)
  function follow(id) { if (id !== picked) { picked = id; render(); } }
  return { get picked() { return picked; }, follow, render, el };
}
