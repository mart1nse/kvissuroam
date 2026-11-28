// The start screen's track picker (Martin's plan of 23 Nov 2026; for everyone since the Raadi stage opened on 26 Nov):
// a card per circuit in place of the Toomemägi outline. Each shows the circuit's outline, its length and surface in
// one word; the picked one is bigger and shows the record and your best. On phones a row of pills under the
// logo. DRIVE then starts at the picked circuit (main.js); the line under DRIVE says which.
// Each outline is drawn as the old Toomemägi map was (src/race/outline.js: a thin neon tube, the start line
// across it) with its bright dot and tail going round, Raadi's from the start to the finish and again
// (Martin 23 Nov: "the same old animation should be there going through the lap ... also the raadi one").
import { TOOME as TRACK, PIRITA } from './circuit.js';
import { TALLINN, TLN_FLAG, CITY } from '../city.js';
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
// Tallinn's circuit (src/city.js): its card there, and its outline on the TALLINN card of the choice of city (?tln=1)
const pirita = TLN_FLAG ? loopPath(PIRITA.pts) : null;
// the small marks used beside a lap in the lists (as big as the controller marks)
export const TRACK_ICON = {
  // (in Tallinn the circuit's id stays 'toome': src/race/circuit.js)
  toome: TALLINN ? `<svg class="trk" viewBox="0 0 ${pirita.w} ${pirita.h}" role="img" aria-label="PIRITA-KOSE"><title>PIRITA-KOSE</title><path d="${pirita.d}"/></svg>`
    : `<svg class="trk" viewBox="0 0 ${toome.w} ${toome.h}" role="img" aria-label="TOOMEMÄGI"><title>TOOMEMÄGI</title><path d="${toome.d}"/></svg>`,
  raadi: `<svg class="trk rd" viewBox="0 0 ${raadi.w} ${raadi.h}" role="img" aria-label="MAJORAADI"><title>MAJORAADI</title><path d="${raadi.d}"/></svg>`,
  // (the drag strip: its quarter mile, the start line across its foot)
  drag: '<svg class="trk dg" viewBox="0 0 1000 1000" role="img" aria-label="ÜLENURME"><title>ÜLENURME</title><path d="M500 940L500 60M330 940H670"/></svg>',
};

// (The stage is MAJORAADI to the players since 26 Nov 2026, Martin: "rename raadi to majoraadi all across (except the
// flag to test it)". Its id, the server's track name, saved times and the ?raadi=1 / ?track=raadi links stay 'raadi'.)
const TOOME_CARD = { id: 'toome', name: 'TOOMEMÄGI', km: (TRACK.length / 1000).toFixed(1), surface: 'ASPHALT', meta: 'OLD TOWN · START ON KÜÜNI', modes: [['race', 'ONLINE RACES'], ['', 'TIME ATTACK']], path: toome, loop: true, secs: 7 };
const RAADI_CARD = { id: 'raadi', name: 'MAJORAADI', km: STAGE_KM, surface: 'GRAVEL', meta: 'RALLY ESTONIA SS16', modes: [['', 'RALLY STAGE']], path: raadi, secs: 5 };
// Tallinn's one circuit (Martin 28 Nov 2026), under Toomemägi's id; the dot takes as long a lap as Toomemägi's per km
const PIRITA_CARD = TLN_FLAG && { id: 'toome', name: 'PIRITA-KOSE', km: (PIRITA.length / 1000).toFixed(1), surface: 'ASPHALT', meta: 'START ON RUMMU TEE', modes: [['race', 'ONLINE RACES'], ['', 'TIME ATTACK']], path: pirita, loop: true, secs: 8 };
export const TRACKS = TALLINN ? [PIRITA_CARD] : [TOOME_CARD, RAADI_CARD];
// each city's cards: the other city's are shown in this one's garage too (Martin 28 Nov 2026, see createTrackPicker)
export const CITY_TRACKS = { tartu: [TOOME_CARD, RAADI_CARD], tallinn: PIRITA_CARD ? [PIRITA_CARD] : [] };

// The choice of city (?tln=1, Martin 28 Nov 2026: "opening with this flag will instead of the track options, show two
// cities, when clicking on tartu you see the current options and when clicking on tallinna you see the pirita kose
// kloostrimetsa racetrack option"). A card a city, drawn as the track cards are, with its circuits' names. Either
// city's card shows its tracks, with no reload (Martin 28 Nov: "you are on the tartu garage, go to the city selector,
// choose tallinn, then you can already choose pirita kose etc and clicking drive shows you a loading screen"): the
// other city's cards carry its records, asked of its own room (board.js), and DRIVE then loads the page again there
// and puts the car on the picked track's start (main.js startDriving, src/city.js goCity). A page opened with ?city=
// in its address opens on its tracks; a small pill before them goes back to the cities.
// Since later that day the two cities are a toggle before the tracks, there all the time, and the page opens on its
// own city's tracks (Martin 28 Nov: "perhaps instead of the back pill, just all the time show the tallinn tartu
// toggle?"). The cards of the cities are not shown any more.
const CITIES = TLN_FLAG ? [
  { id: 'tartu', name: 'TARTU', meta: 'TOOMEMÄGI · MAJORAADI', modes: [['race', '2 CIRCUITS']], path: toome, secs: 7 },
  { id: 'tallinn', name: 'TALLINN', meta: 'PIRITA-KOSE', modes: [['race', 'NEW CIRCUIT']], path: pirita, secs: 8 },
] : [];

// The drag strip at Ülenurme (?drag=1, desktop only, Martin 27 Nov 2026: "ÜLENURME TOOMEMÄE MAJORAADI, toomemäe in
// the center and default pick"): a card left of Toomemägi. Its outline is the quarter mile seen from the start line,
// two wide lanes running away into the distance as on the motorway sign without its bridge (Martin 28 Nov: "two wide
// lines going in to the perspective ... still neon and still highlighting two cars going at it"), the start line
// across both. A car in each lane: off the line together, the left one quicker away, the right one through first by
// a nose, both smaller as they go, then a rest at the end.
const DRAG_LANES = 'M50 950L365 950L383 70L318 70Z M435 950L750 950L482 70L417 70Z';
// (a car: its light and a streak behind it, turned along its lane and shrinking with the distance; keyTimes / keySplines
// for both its move and its size, so the two keep together)
function dragCar(cls, path, end, spline, secs) {
  const keys = `keyTimes="0;${end};1" keySplines="${spline};0 0 1 1"`;
  // (the streak grows as the car gets going and goes out once it is through)
  const streak = `<animateTransform attributeName="transform" type="scale" values="0.2 1;1 1;1 1;0 1;0 1" keyTimes="0;0.3;${end};${end + 0.06};1" dur="${secs}s" repeatCount="indefinite"/>`;
  return `<g class="dot ${cls}"><animateMotion rotate="auto" keyPoints="0;1;1" calcMode="spline" ${keys} dur="${secs}s" repeatCount="indefinite" path="${path}"/>`
    + `<g><animateTransform attributeName="transform" type="scale" values="1;0.3;0.3" calcMode="spline" ${keys} dur="${secs}s" repeatCount="indefinite"/>`
    + `<polygon class="streak" points="0,-27 -240,0 0,27">${streak}</polygon><circle r="74" class="glow"/><circle r="30"/></g></g>`;
}
const DRAG_PATH = { w: '800', h: '1000', draw: (secs) => `<svg viewBox="0 0 800 1000" aria-hidden="true"><path class="lane" d="${DRAG_LANES}"/>`
    + `<path class="halo" d="${DRAG_LANES}"/><path class="tube" d="${DRAG_LANES}"/><path class="core" d="${DRAG_LANES}"/><line class="sf" x1="78" y1="860" x2="722" y2="860"/>`
    + dragCar('a', 'M222 860L342 120', 0.75, '0.4 0.08 0.75 0.75', secs)
    + dragCar('b', 'M578 860L458 120', 0.735, '0.55 0.02 0.7 0.68', secs) + '</svg>' };
export const DRAG_CARD = { id: 'drag', name: 'ÜLENURME', km: '0.4', surface: 'ASPHALT', meta: 'DRAG STRIP · 1/4 MILE', modes: [['race', 'DRAG RACE'], ['', 'PRACTICE']], path: DRAG_PATH, secs: 3.6,
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
// recordOf(city, id), mineOf(city, id): the same of the other city's tracks; online(city): how many are online there
// (null: not known); onView(city): the city whose tracks are shown changed
export function createTrackPicker({ after, record, mine, onOpenBoard, onPick, drag = false, recordOf = null, mineOf = null, online = null, onView = null, onCities = null }) {
  const own = drag ? [DRAG_CARD, ...TRACKS] : TRACKS;
  let view = CITY, awayPick = 'toome';           // the city whose tracks are shown, and the track picked of the other city's
  let picked = pickedTrack(drag);
  // the cities first (?tln=1 without a city in the address), else this city's tracks
  const cities = false;
  const el = document.createElement('div');
  el.id = 'trackpick';
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', 'Track');
  after.after(el);
  let shown = '';
  // a card's outline: the tube, the start line across a lap (a start mark on a stage), the dot and its tail going round
  // (t.secs a time; p.draw: a card drawn its own way, the drag strip's)
  function outline(t) {
    const p = t.path;
    if (p.draw) return p.draw(t.secs);               // (the drag strip's own picture: two lanes and two cars)
    const tail = `<path d="${p.d}" class="tail" pathLength="1000" stroke-dasharray="${TAIL} ${1000 - TAIL}"><animate attributeName="stroke-dashoffset" from="${TAIL}" to="${TAIL - 1000}" dur="${t.secs}s" repeatCount="indefinite"/></path>`
        + `<g class="dot"><circle r="44" class="glow"/><circle r="19"/><animateMotion dur="${t.secs}s" repeatCount="indefinite" path="${p.d}"/></g>`;
    const sf = p.start ? `<circle class="sf" cx="${p.start[0]}" cy="${p.start[1]}" r="9"/>` : `<line class="sf" x1="${p.sf[0]}" y1="${p.sf[1]}" x2="${p.sf[2]}" y2="${p.sf[3]}"/>`;
    return `<svg viewBox="0 0 ${p.w} ${p.h}" aria-hidden="true"><path class="halo" d="${p.d}"/><path class="tube" d="${p.d}"/><path class="core" d="${p.d}"/>${sf}${tail}</svg>`;
  }
  function render() {
    // (the cities: this one lit, as a picked track is)
    const away = view !== CITY, cards = away ? CITY_TRACKS[view] : own, sel = away ? awayPick : picked;
    const html = cities ? CITIES.map((c) => { const n = online?.(c.id); return `<button class="tcard city${c.id === view ? ' on' : ''}" data-city="${c.id}" role="radio" aria-checked="${c.id === view}">
        ${outline(c)}<span class="tx"><b class="nm">${c.name}</b><small class="meta">${c.meta}</small>
        <span class="modes">${c.modes.map(([k, w]) => `<i class="${k}">${w}</i>`).join('')}${n != null ? `<i>${n} ONLINE</i>` : ''}</span></span></button>`; }).join('')
      : (TLN_FLAG ? `<span class="tcity" role="radiogroup" aria-label="City">${CITIES.map((c) => { const n = c.id !== CITY ? online?.(c.id) : null; return `<button class="${c.id === view ? 'on' : ''}" data-city="${c.id}" role="radio" aria-checked="${c.id === view}">${c.name}${n != null ? `<i> (${n})</i>` : ''}</button>`; }).join('')}</span>` : '') + cards.map((t) => {
      const on = t.id === sel, r = away ? recordOf?.(view, t.id) : record(t.id), m = !on ? null : away ? mineOf?.(view, t.id) : mine?.(t.id), fmt = t.fmt || ((ms) => fmtTime(ms / 1000));
      return `<button class="tcard${on ? ' on' : ''}" data-track="${t.id}" role="radio" aria-checked="${on}">
        ${outline(t)}
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
    const c = e.target.closest('[data-city]');
    if (c) {
      c.blur();
      if (c.dataset.city === view) return;
      view = c.dataset.city;
      render();
      onView?.(view);
      return;
    }
    const b = e.target.closest('[data-track]');
    if (!b) return;
    b.blur();
    if (b.dataset.track === (view !== CITY ? awayPick : picked)) return;          // (a click only picks: the lap times are on their own button, Martin 23 Nov)
    if (view !== CITY) { awayPick = b.dataset.track; render(); onView?.(view); return; }
    picked = b.dataset.track;
    render();
    onPick?.(picked);
  });
  render();
  // (the other city's records and how many are online there, for its side of the toggle)
  if (TLN_FLAG) setTimeout(() => onCities?.(), 0);
  // (the garage opens on the track the car is at, Martin 26 Nov: the TOOMEMÄGI button or H, then the garage and
  // DRIVE, took the car back to Raadi because the picker still said Raadi. Not a pick: no tyres change.)
  function follow(id) { if (id !== picked) { picked = id; render(); } }
  // away: the other city's track picked here, { city, track, name } (null: this city's tracks are the ones shown)
  return { get picked() { return picked; }, get view() { return view; }, get away() { const t = view !== CITY && (CITY_TRACKS[view].find((x) => x.id === awayPick) || CITY_TRACKS[view][0]); return t ? { city: view, track: t.id, name: t.name } : null; }, follow, render, el };
}
