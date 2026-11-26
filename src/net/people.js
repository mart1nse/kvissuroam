// Who is online, next to the minimap: "3 ONLINE" plus small notes as people join and leave.
// Only players whose car is on the map count (Martin, 2026-11-17: the count showed people who sat in
// the menu or had the game in a background tab). On desktop (Martin, 2026-11-24) the list grows up from
// the minimap: the count, your line over it, then the names going up as far as there is room under the race
// button (its vote line and chip), then "+N MORE". While the race list or results show there, the race
// panel comes first (down to your line at most) and the names fill what is left under it (Martin, 24 Nov).
// On phones (Martin, 2026-11-24) the list sits on the right, beside the race button and down to the gas pedal:
// the count, your line, then as many names as fit there (a name with a lap record takes its line and a bit),
// then "+N MORE". No joined/left notes on phones (no room there for them).
// On the big map a list of everyone online; tapping a name centres the map on that car. On desktop (Martin,
// 2026-11-25) a second click on the same name closes the map and watches that car (src/spectate.js), and a
// second click on your own line, while watching, takes you back to your car; the picked row says so. The car
// icons on the map itself do not start watching (Martin: only the list).
// While a race vote has votes in (Martin, 2026-11-23), each name that may vote gets a small mark in
// front: a lit tick when voted, a faint ring when not. Gone again when the vote is over.
// On desktop (Martin, 2026-11-23) a name in the list is a button: it follows that player's car as a spectator
// (src/spectate.js); your own line takes you back to your car. Spectators are listed like those in the garage,
// as "(watching)", never whom (Martin, 2026-11-23: anonymous); a player being watched has "WATCHED · N" after
// their name in everyone's list (their own line too), without names, and a spectator sees "WATCHING" on theirs.
// In front of each colour dot of a player on the map (Martin, 2026-11-23) a small thumb: a thumbs up for them,
// shown as a neon sign in their back window (src/kudos.js); faint for 30 s after sending, and for the rest of the
// day once three went to the same player (src/net/kudosrules.js).
// On desktop (Martin, 2026-11-26) those on a timed Majoraadi run are listed under the MAJORAADI pill instead, the
// same rows (click to watch, the thumb, the car, the record): only their place changes.
import { escapeHtml } from '../race/race.js';
import { CARS } from '../cars/specs.js';
import { KUDOS_PAIR } from './kudosrules.js';

const NOTE_MS = 6000;
const LIST_MAX = 60;              // rows of room on desktop at most (the list scrolls past them)
const LIST_ALL = 120;             // names listed on desktop at most (the server lets 100 in)
export const ME_COLOUR = '#ffd45e';
// the thumbs up button (src/kudos.js), the same neon thumb as the sign in the back window
export const THUMB = '<svg viewBox="8 8 86 86" aria-hidden="true"><path d="M30 46L42 22Q46 11 53 15Q59 20 56 31L53 42L80 42Q88 42 87 49Q87 54 82 55Q87 57 86 62Q85 67 80 67Q85 69 84 73Q83 78 78 78Q82 80 81 84Q80 88 74 88L30 88ZM15 46L25 46L25 90L15 90Z"/></svg>';    // your own arrow on the maps         // rows on a phone, "+N MORE" included

export function createPeople({ mp, onFocus, votes, onWatch, watching = () => null, onKudos, staged = null }) {
  // a thumbs up button for a player on the map: lit, or faint while the last one to them is under 30 s old or
  // they had their share from us today
  const kuBtn = (p) => {
    if (!onKudos || mp.stealth) return '';
    const w = mp.kudosWait(p.id);
    return `<b class="ku${w > 0 ? ' wait' : ''}" data-ku="${escapeHtml(p.id)}" title="${w === Infinity ? `Thumbs up: ${KUDOS_PAIR} given today` : 'Thumbs up'}">${THUMB}</b>`;
  };
  const kuClick = (e) => {
    const b = e.target.closest('[data-ku]');
    if (!b) return false;
    e.stopImmediatePropagation(); e.preventDefault();
    if (mp.kudos(b.dataset.ku)) { onKudos(b.dataset.ku); b.classList.add('wait', 'sent'); last = ''; }
    return true;
  };
  // a vote mark for one player id ('' when no vote is open or they may not vote)
  // the car a player drives, short (Martin, 2026-11-23: STI, M3, F40, ...)
  const carTag = (id) => { const t = id && CARS[id]?.tag; return t ? ` <small class="car">${escapeHtml(t)}</small>` : ''; };
  const mark = (vm, id) => (vm && id && vm.can(id) ? (vm.has(id) ? '<u class="vt on"></u>' : '<u class="vt"></u>') : '');
  const box = document.createElement('div');
  box.id = 'people';
  // (Martin, 2026-11-23: the count on top, then you, then the others; no light before the count)
  box.innerHTML = '<div class="count hidden"><span></span></div><div class="me"></div><ul class="who hidden"></ul><div class="up hidden"></div><ul class="feed"></ul><ul class="who st hidden"></ul>';
  document.querySelector('#hud').appendChild(box);
  const elCount = box.querySelector('.count'), elNum = elCount.querySelector('span'), feed = box.querySelector('.feed');
  const elWho = box.querySelector('.who'), elUp = box.querySelector('.up');   // (desktop: "+N MORE" over the names)
  const elSt = box.querySelector('.who.st');      // (desktop: those on a Majoraadi run, under its pill: src/style.css)

  const list = document.createElement('div');
  list.id = 'roster';
  list.className = 'hidden';
  document.querySelector('#bigmap').appendChild(list);
  list.addEventListener('click', (e) => {
    if (kuClick(e)) { api.showRoster(); return; }
    const li = e.target.closest('[data-i]');
    if (!li) return;
    const p = shown[+li.dataset.i];
    if (!p || p.x === undefined) return;
    const key = p.me ? 'me' : p.id;
    if (picked === key && canWatch(p)) { picked = null; onWatch(p.me ? null : p.id); return; }
    onFocus(p.x, p.z);
    if (picked !== key) { picked = key; api.showRoster(); }
  });
  let shown = [], myCar = null, rosterKey = '';
  let picked = null;                // big map, desktop: the row clicked once ('me' or a player id); a second click watches
  // (a second click watches a player on the map, or on your own line takes you back while watching)
  const canWatch = (p) => !touch && !!onWatch && (p.me ? !!watching() : p.x !== undefined && !idle(p));
  const touch = document.body.classList.contains('touch');
  // phones: the room for the names, from under your line down to the gas pedal, and a row's height (read from the
  // page once a second at most, at the start of a frame before anything is written; the pedal and the list stand still)
  let phoneAt = 0, phoneRoom = 0, phoneRh = 13, phonePush = 0;
  const gas = touch ? document.querySelector('[data-ctl="up"]') : null;
  function fitPhone() {
    const t = performance.now();
    if (t < phoneAt) return;
    phoneAt = t + 1000;
    const g = gas?.getBoundingClientRect();
    if (!g || !g.height) return;
    phoneRh = (parseFloat(getComputedStyle(elWho).fontSize) || 10) * 1.45;
    // (the names start under the count and your line; on a short phone those two share a row)
    let under = Math.max(elCount.getBoundingClientRect().bottom, elMe.getBoundingClientRect().bottom);
    // (Martin 2026-11-25: the race button stands a little into the list's width on a taller phone; the names go
    // under it, only the count and your line beside it)
    const b = document.getElementById('rbtn')?.getBoundingClientRect(), bx = box.getBoundingClientRect();
    const push = b && b.height && b.right > bx.left ? Math.max(0, Math.ceil(b.bottom + 4 - under)) : 0;
    if (push !== phonePush) { phonePush = push; elWho.style.marginTop = push ? `${push + 3}px` : ''; }
    under += push;
    const room = Math.max(0, Math.floor(g.top - 6 - (under + 4)));
    if (room !== phoneRoom) { phoneRoom = room; elWho.style.maxHeight = `${room}px`; }
  }
  // phones: how many rows go in that room ("+N MORE" counted in when not all do); a lap record goes on a line under
  // its name, so that row is 1.8 rows high (src/style.css gives the rows these heights)
  const rowH = (p) => phoneRh * (mp.recordOf(p.name) ? 1.8 : 1);
  function phoneCap(sorted) {
    let h = 0, k = 0;
    for (; k < sorted.length; k++) { const a = rowH(sorted[k]); if (h + a > phoneRoom + 0.5) break; h += a; }
    if (k === sorted.length) return k;
    while (k > 0 && h + phoneRh > phoneRoom + 0.5) h -= rowH(sorted[--k]);
    return k + 1;
  }
  // desktop: how many rows fit between your line and the race button, and whether the race list is up
  // (read from the page at most three times a second, never every frame)
  let fitAt = 0, fitRows = LIST_MAX, raceList = false, nNames = 0;
  function fit() {
    const t = performance.now();
    if (t < fitAt) return;
    fitAt = t + 330;
    const rl = document.getElementById('rlist'), rb = document.getElementById('racebox');
    raceList = !!rl && !rl.classList.contains('hidden');
    const bottom = box.getBoundingClientRect().bottom;
    if (!bottom) return;
    const fs = parseFloat(getComputedStyle(box).fontSize) || 12;
    const rowH = elWho.firstElementChild?.getBoundingClientRect().height || fs * 1.35;
    rowPx = rowH + 1;                      // (the gap between rows: 1px)
    const under = elCount.offsetHeight + elMe.offsetHeight + feed.offsetHeight + 6;   // count, you, notes
    // the race panel ends above the count and your line at the lowest, and with others online takes at most
    // about 60% of the room (it scrolls to your row); the names fill what is left under it
    if (raceList) {
      const room = bottom - under - rl.getBoundingClientRect().top - 10;
      rl.style.maxHeight = `${Math.max(fs * 10, mp.online && mp.count > 0 ? room * 0.6 : room)}px`;
    }
    const top = raceList ? rl.getBoundingClientRect().bottom + 10 : rb ? rb.getBoundingClientRect().bottom + 12 : 12;
    fitRows = Math.max(0, Math.min(LIST_MAX, Math.floor((bottom - under - top) / rowH)));
    // (Martin, 2026-11-24: all names listed, the mouse wheel scrolls those that do not fit; no scrollbar)
    // (Martin, 24 Nov: "+N MORE" kept, over the names, when they do not all fit; it takes one row)
    const mh = `${Math.round((nNames > fitRows ? fitRows - 1 : fitRows) * rowH)}px`;
    if (elWho.style.maxHeight !== mh) { elWho.style.maxHeight = mh; edges(); }
  }
  // a soft fade at the end that has more names past it (desktop: first name at the bottom, so scrollTop
  // is 0 there and negative scrolled up)
  // (Martin 2026-11-24, 55 online: reading the list's height straight after changing it made the browser lay the
  // page out there and then, 5 to 15 ms each time somebody came, went or voted. The fade and the "+N MORE" go by
  // the rows' count and height and by where the wheel left the list, which the scroll event gives when it is laid out.)
  let scrolled = 0, rowPx = 0, upN = -1;
  function edges() {
    const step = rowPx || 16, room = nNames > fitRows ? fitRows - 1 : fitRows;
    const over = elWho.classList.contains('hidden') ? 0 : (rowCount - room) * step;
    const up = -scrolled;
    const a = over > 2 && up < over - 2, b = over > 2 && up > 2;
    if (a !== elWho.classList.contains('more-up')) elWho.classList.toggle('more-up', a);
    if (b !== elWho.classList.contains('more-down')) elWho.classList.toggle('more-down', b);
    // the names out of view above (all rows are the same height)
    const n = over > 2 ? Math.ceil((over - up - 2) / step) : 0;
    if (n !== upN) { upN = n; elUp.textContent = `+${n} MORE`; elUp.classList.toggle('hidden', n <= 0); }
  }
  if (!touch) elWho.addEventListener('scroll', () => { scrolled = elWho.scrollTop; edges(); }, { passive: true });
  // (the thumbs up button, before the click to watch: on a phone too)
  box.addEventListener('click', kuClick);
  // (desktop: click a name to watch that car, your own line to come back)
  if (!touch && onWatch) box.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id], .me');
    if (!li) return;
    e.stopPropagation();
    onWatch(li.classList.contains('me') ? null : li.dataset.id);
  });
  // not on the map: in the garage, or watching somebody else's car
  const idle = (p) => p.w === 'garage' || p.w === 'watch';

  // "22B STI LAP RECORD 1:23.45" in the list, the time in its own colour; phones' rows are narrow, so
  // there it goes on a line of its own under the name, "LAP RECORD 1:23.45" (the row shows the car
  // already), and the time is not cut off (Martin, 2026-11-23)
  const recTag = (r, tm) => {
    const words = tm && r.endsWith(` ${tm}`) ? r.slice(0, -tm.length - 1) : r;
    const i = words.lastIndexOf('LAP RECORD');
    const car = i > 0 ? words.slice(0, i) : '';
    return `<small class="rec">${car ? `<span class="rc">${escapeHtml(car)}</span>` : ''}${escapeHtml(words.slice(car.length))}${tm ? ` <b>${tm}</b>` : ''}</small>`;
  };
  const elMe = box.querySelector('.me');
  let last = '', meLast = '', dirty = false, lookAt = 0;
  function refresh() {
    if (!touch) fit(); else fitPhone();
    const listMax = touch ? (phoneRoom >= phoneRh ? 1 : 0) : fitRows;
    // (stealth, ?off=100: a reminder that nobody else can see us)
    const myRec = mp.name ? mp.recordOf(mp.name) : '';
    const nm = mp.name ? `YOU: ${mp.name}` : '';
    const wn = mp.online ? mp.watchers() : 0, sp = watching();
    const nmMore = `${mp.stealth ? ' · HIDDEN' : ''}${mp.online ? '' : mp.full ? (mp.queuePos ? ` · SERVER FULL · QUEUE ${mp.queuePos}` : ' · SERVER FULL') : ' · OFFLINE'}${wn ? ` · WATCHED · ${wn}` : ''}${sp ? ' · WATCHING' : ''}`;
    const vm = mp.online ? votes?.() : null;
    // (phones, Martin 2026-11-24: the list is lined up on the right, so the colour dot goes at the right end of the
    // name; the thumb stays in front of it. The name in its own box, cut short there, so the dot is never cut off.)
    const row = (lead, dot, words, rec) => (touch ? `${lead}<span class="nm">${words}</span>${dot}${rec}` : `${lead}${dot}${words}${rec}`);
    const meHtml = nm ? row(mark(vm, mp.id), `<i style="--c:${ME_COLOUR}"></i>`, `${escapeHtml(nm)}${carTag(mp.car)}${escapeHtml(nmMore)}`, myRec ? ` ${recTag(myRec, mp.recordTime(mp.name))}` : '') : '';
    if (meHtml !== meLast) { meLast = meHtml; elMe.innerHTML = meHtml; }
    elMe.classList.toggle('back', !!sp);
    const drivers = mp.online ? mp.drivers() : [];
    const n = mp.online ? drivers.filter((p) => !idle(p)).length + 1 : 0;   // (the garage ones are listed, not counted)
    // (Martin, 2026-11-23) those in the garage are listed too, greyed, after the drivers on the map
    const inGarage = mp.online ? mp.roster().filter(idle) : [];
    const kuKey = onKudos ? drivers.filter((p) => mp.kudosWait(p.id) > 0).map((p) => p.id).join(',') : '';
    const onRun = !touch && staged ? staged() : null;
    const run = (p) => !!onRun?.size && !idle(p) && onRun.has(p.id);
    const key = `${listMax}|${phoneRoom}|${n}|${mp.name}|${kuKey}|${vm?.key || ''}|${sp}|${onRun?.size ? [...onRun].join(',') : ''}|${drivers.map((p) => p.name + p.colour + p.car + p.w + p.wn + mp.recordOf(p.name)).join('|')}|${inGarage.map((p) => p.id + p.w).join(',')}`;
    if (key === last) return;
    last = key;
    // the city map's list follows the connection (lost, back) and the vote while the map is open
    if (myCar && rosterKey && rosterKey !== `${mp.online}|${mp.online ? mp.roster().length : 0}|${vm?.key || ''}` && !list.classList.contains('hidden')) api.showRoster();
    elCount.classList.toggle('hidden', n === 0);
    elNum.textContent = `${n} ONLINE`;
    elCount.classList.toggle('solo', n === 1);
    // each name's dot has the colour of that player's arrow on the maps (Martin, 2026-11-21)
    const ids = new Set(drivers.map((p) => p.id));
    const byName = (a, b) => a.name.localeCompare(b.name);
    const all = n < 2 && !inGarage.length ? [] : [...drivers.filter((p) => !idle(p)).sort(byName), ...drivers.filter(idle).sort(byName), ...inGarage.filter((p) => !ids.has(p.id)).sort(byName)];
    const rowOf = (p) => {
      const r = mp.recordOf(p.name), g = idle(p), cls = `${g ? 'gar' : ''}${p.id === sp ? ' on' : ''}`.trim();
      const at = p.w === 'watch' ? '(watching)' : '(garage)';
      return { id: p.id, cls, html: row(`${mark(vm, p.id)}${g ? '' : kuBtn(p)}`, `<i style="--c:${p.colour}"></i>`, `${escapeHtml(p.name)}${carTag(p.car)}${g ? ` <small class="at">${at}</small>` : ''}${p.wn && !g ? ` <small class="wn">WATCHED · ${p.wn}</small>` : ''}`, r && !g ? ` ${recTag(r, mp.recordTime(p.name))}` : '') };
    };
    // (desktop: those on a Majoraadi run under its pill, out of the list here)
    const st = onRun?.size ? all.filter(run) : [];
    place(st.map(rowOf), elSt, stRows);
    elSt.classList.toggle('hidden', !st.length);
    const sorted = st.length ? all.filter((p) => !run(p)) : all;
    // the list of drivers, shown once somebody else is driving
    if (!sorted.length || !listMax) { elWho.classList.add('hidden'); clearRows(); if (!touch) edges(); return; }
    // (desktop: every name, scrolled with the wheel; phones: as many as fit, then "+N MORE")
    const cap = touch ? phoneCap(sorted) : LIST_ALL;
    const more = sorted.length > cap ? sorted.length - cap + 1 : 0;
    if (!touch && sorted.length !== nNames) { nNames = sorted.length; fitAt = 0; }
    const want = sorted.slice(0, more ? cap - 1 : cap).map(rowOf);
    if (more) want.push({ id: '', cls: 'more', html: `+${more} MORE` });
    place(want);
    elWho.classList.remove('hidden');
    if (!touch) edges();
  }
  // The rows, each kept from one change to the next (Martin 2026-11-24, 55 online: the whole list was made anew,
  // sixty rows with a thumb picture each, whenever anybody came, went, changed car or voted, and the picture
  // hitched). Only a row whose words changed is rewritten, and rows are moved only when the order changed.
  const rowsById = new Map();          // id ('' the "+N MORE" line) -> { li, cls, html }
  const stRows = new Map();            // (the same for the rows under the MAJORAADI pill)
  let rowCount = 0;
  function place(want, ul = elWho, rows = rowsById) {
    const keep = new Set();
    let at = ul.firstChild;
    for (const w of want) {
      keep.add(w.id);
      let r = rows.get(w.id);
      if (!r) {
        const li = document.createElement('li');
        if (w.id) li.dataset.id = w.id;
        r = { li, cls: null, html: null };
        rows.set(w.id, r);
      }
      if (r.cls !== w.cls) { r.cls = w.cls; r.li.className = w.cls; }
      if (r.html !== w.html) { r.html = w.html; r.li.innerHTML = w.html; }
      if (r.li !== at) ul.insertBefore(r.li, at);
      else at = at.nextSibling;
    }
    for (const [id, r] of rows) if (!keep.has(id)) { r.li.remove(); rows.delete(id); }
    if (ul === elWho) rowCount = want.length;
  }
  function clearRows() { if (rowsById.size) { for (const r of rowsById.values()) r.li.remove(); rowsById.clear(); } rowCount = 0; }

  function note(text, kind) {
    if (touch) return;
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = text;
    feed.appendChild(li);
    while (feed.children.length > 4) feed.firstChild.remove();
    setTimeout(() => { li.classList.add('out'); setTimeout(() => li.remove(), 600); }, NOTE_MS);
  }

  const api = {
    // multiplayer events
    event(kind, name, old) {
      // the same name as ours: the game open in another tab or on another device (not us leaving)
      const twin = name === mp.name ? ' (other tab)' : '';
      if (kind === 'join') note(`${name}${twin} joined`, 'join');
      else if (kind === 'leave') note(`${name}${twin} left`, 'leave');
      else if (kind === 'rename') note(`${old} is now ${name}`, 'rename');
      else if (kind === 'kudos') { note(`${name} gave you a thumbs up`, 'kudos'); return; }
      // the player list changes right after this event: looked at in the next frame, once for all the events
      // that came in the meantime (with many online several come in one frame)
      dirty = true;
    },
    // (Martin 2026-11-25, 90 online: the list was looked over every frame, everybody's name, car and place put
    // together to see whether anything had changed. Now at once after an event, else five times a second.)
    update() {
      const t = performance.now();
      if (dirty) {
        dirty = false; last = '';
        if (myCar && !list.classList.contains('hidden')) api.showRoster();
      } else if (t < lookAt) return;
      lookAt = t + 200;
      refresh();
    },
    // big map opened: list everyone driving, then those connected but not on the map (menu,
    // background tab), greyed out and not counted
    showRoster(car = myCar) {
      myCar = car;
      // always listed, alone too (Martin, 2026-11-23: alone on the map the list was hidden, so it looked
      // as if he had dropped out); with the connection down it says so instead of a count
      const others = mp.online ? mp.roster() : [];
      const vm = mp.online ? votes?.() : null;
      const onMap = (p) => p.x !== undefined && !idle(p);
      const driving = others.filter(onMap), away = others.filter((p) => !onMap(p));
      shown = [{ id: mp.id, name: `${mp.name || 'YOU'} (you)`, me: true, car: mp.car, x: car?.x, z: car?.z }, ...driving, ...away];
      const sel = (p) => picked === (p.me ? 'me' : p.id) && canWatch(p);
      const tail = (p) => (sel(p) ? ` <small class="go">${p.me ? 'CLICK AGAIN TO DRIVE' : 'CLICK AGAIN TO WATCH'}</small>` : '');
      const row = (p, i) => `<li data-i="${i}" class="${p.me ? 'me' : p.x === undefined || idle(p) ? 'idle' : ''}${sel(p) ? ' sel' : ''}"${sel(p) ? ` title="${p.me ? 'Click again to drive your car' : 'Click again to watch'}"` : ''}>${mark(vm, p.id)}${p.me ? '<b>▲</b>' : `${onMap(p) ? kuBtn(p) : ''}<b style="color:${p.colour}">●</b>`} ${escapeHtml(p.name)}${carTag(p.car)}${p.wn && !p.me && onMap(p) ? ` <small class="wn">WATCHED · ${p.wn}</small>` : ''}${p.w === 'garage' && !p.me ? ' <small>GARAGE</small>' : p.w === 'watch' && !p.me ? ' <small>WATCHING</small>' : p.x === undefined && !p.me ? ' <small>AWAY</small>' : ''}${p.me && mp.stealth ? ' <small>HIDDEN</small>' : ''}${tail(p)}</li>`;
      const head = mp.online ? `${driving.length + 1} ONLINE` : mp.full ? `SERVER FULL · ${mp.queuePos ? `QUEUE ${mp.queuePos} · ` : ''}DRIVING OFFLINE` : 'OFFLINE · RECONNECTING';
      list.innerHTML = `<h4${mp.online ? '' : ' class="off"'}>${head}</h4><ul>${shown.map(row).join('')}</ul>`;
      list.classList.remove('hidden');
      rosterKey = `${mp.online}|${others.length}|${vm?.key || ''}`;
    },
    hideRoster() { list.classList.add('hidden'); picked = null; },
  };
  return api;
}
