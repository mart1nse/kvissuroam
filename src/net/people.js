// Who is online, next to the minimap: "3 ONLINE" plus small notes as people join and leave.
// Only players whose car is on the map count (Martin, 2026-11-17: the count showed people who sat in
// the menu or had the game in a background tab). On desktop (Martin, 2026-11-24) the list grows up from
// the minimap: the count, your line over it, then the names going up as far as there is room under the race
// button (its vote line and chip), then "+N MORE". While the race list or results show there, the race
// panel comes first (down to your line at most) and the names fill what is left under it (Martin, 24 Nov). On phones (Martin, 2026-11-21) a short list sits under
// the count, in the gap between the minimap and the rev counter: four names, then "+N MORE".
// On the big map a list of everyone online; tapping a name centres the map on that car.
// While a race vote has votes in (Martin, 2026-11-23), each name that may vote gets a small mark in
// front: a lit tick when voted, a faint ring when not. Gone again when the vote is over.
// On desktop (Martin, 2026-11-23) a name in the list is a button: it follows that player's car as a spectator
// (src/spectate.js); your own line takes you back to your car. Spectators are listed like those in the garage,
// as "(watching)", never whom (Martin, 2026-11-23: anonymous); a player being watched has "WATCHED · N" after
// their name in everyone's list (their own line too), without names, and a spectator sees "WATCHING" on theirs.
// In front of each colour dot of a player on the map (Martin, 2026-11-23) a small thumb: a thumbs up for them,
// shown as a neon sign in their back window (src/kudos.js); faint for 30 s after sending.
import { escapeHtml } from '../race/race.js';
import { CARS } from '../cars/specs.js';

const NOTE_MS = 6000;
const LIST_MAX = 60;              // rows of room on desktop at most (the list scrolls past them)
const LIST_ALL = 120;             // names listed on desktop at most (the server lets 100 in)
const LIST_MAX_PHONE = 5;
export const ME_COLOUR = '#ffd45e';
// the thumbs up button (src/kudos.js), the same neon thumb as the sign in the back window
export const THUMB = '<svg viewBox="8 8 86 86" aria-hidden="true"><path d="M30 46L42 22Q46 11 53 15Q59 20 56 31L53 42L80 42Q88 42 87 49Q87 54 82 55Q87 57 86 62Q85 67 80 67Q85 69 84 73Q83 78 78 78Q82 80 81 84Q80 88 74 88L30 88ZM15 46L25 46L25 90L15 90Z"/></svg>';    // your own arrow on the maps         // rows on a phone, "+N MORE" included

export function createPeople({ mp, onFocus, votes, onWatch, watching = () => null, onKudos }) {
  // a thumbs up button for a player on the map: lit, or faint while the last one to them is under 30 s old
  const kuBtn = (p) => (onKudos && !mp.stealth ? `<b class="ku${mp.kudosWait(p.id) > 0 ? ' wait' : ''}" data-ku="${escapeHtml(p.id)}" title="Thumbs up">${THUMB}</b>` : '');
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
  box.innerHTML = '<div class="count hidden"><span></span></div><div class="me"></div><ul class="who hidden"></ul><div class="up hidden"></div><ul class="feed"></ul>';
  document.querySelector('#hud').appendChild(box);
  const elCount = box.querySelector('.count'), elNum = elCount.querySelector('span'), feed = box.querySelector('.feed');
  const elWho = box.querySelector('.who'), elUp = box.querySelector('.up');   // (desktop: "+N MORE" over the names)

  const list = document.createElement('div');
  list.id = 'roster';
  list.className = 'hidden';
  document.querySelector('#bigmap').appendChild(list);
  list.addEventListener('click', (e) => {
    if (kuClick(e)) { api.showRoster(); return; }
    const li = e.target.closest('[data-i]');
    if (!li) return;
    const p = shown[+li.dataset.i];
    if (p && p.x !== undefined) onFocus(p.x, p.z);
  });
  let shown = [], myCar = null, rosterKey = '';
  const touch = document.body.classList.contains('touch');
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
  let upN = -1;
  function edges() {
    const over = elWho.scrollHeight - elWho.clientHeight;
    const up = -elWho.scrollTop;
    elWho.classList.toggle('more-up', over > 2 && up < over - 2);
    elWho.classList.toggle('more-down', over > 2 && up > 2);
    // the names out of view above (all rows are the same height)
    const step = elWho.firstElementChild ? elWho.firstElementChild.offsetHeight + 1 : 0;
    const n = over > 2 && step && !elWho.classList.contains('hidden') ? Math.ceil((over - up - 2) / step) : 0;
    if (n !== upN) { upN = n; elUp.textContent = `+${n} MORE`; elUp.classList.toggle('hidden', n <= 0); }
  }
  if (!touch) elWho.addEventListener('scroll', edges, { passive: true });
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
  let last = '', meLast = '';
  function refresh() {
    if (!touch) fit();
    const listMax = touch ? LIST_MAX_PHONE : fitRows;
    // (stealth, ?off=100: a reminder that nobody else can see us)
    const myRec = mp.name ? mp.recordOf(mp.name) : '';
    const nm = mp.name ? `YOU: ${mp.name}` : '';
    const wn = mp.online ? mp.watchers() : 0, sp = watching();
    const nmMore = `${mp.stealth ? ' · HIDDEN' : ''}${mp.online ? '' : mp.full ? ' · SERVER FULL' : ' · OFFLINE'}${wn ? ` · WATCHED · ${wn}` : ''}${sp ? ' · WATCHING' : ''}`;
    const vm = mp.online ? votes?.() : null;
    const meHtml = nm ? `${mark(vm, mp.id)}<i style="--c:${ME_COLOUR}"></i>${escapeHtml(nm)}${carTag(mp.car)}${escapeHtml(nmMore)}${myRec ? ` ${recTag(myRec, mp.recordTime(mp.name))}` : ''}` : '';
    if (meHtml !== meLast) { meLast = meHtml; elMe.innerHTML = meHtml; }
    elMe.classList.toggle('back', !!sp);
    const drivers = mp.online ? mp.drivers() : [];
    const n = mp.online ? drivers.filter((p) => !idle(p)).length + 1 : 0;   // (the garage ones are listed, not counted)
    // (Martin, 2026-11-23) those in the garage are listed too, greyed, after the drivers on the map
    const inGarage = mp.online ? mp.roster().filter(idle) : [];
    const kuKey = onKudos ? drivers.filter((p) => mp.kudosWait(p.id) > 0).map((p) => p.id).join(',') : '';
    const key = `${listMax}|${n}|${mp.name}|${kuKey}|${vm?.key || ''}|${sp}|${drivers.map((p) => p.name + p.colour + p.car + p.w + p.wn + mp.recordOf(p.name)).join('|')}|${inGarage.map((p) => p.id + p.w).join(',')}`;
    if (key === last) return;
    last = key;
    // the city map's list follows the connection (lost, back) and the vote while the map is open
    if (myCar && rosterKey && rosterKey !== `${mp.online}|${mp.online ? mp.roster().length : 0}|${vm?.key || ''}` && !list.classList.contains('hidden')) api.showRoster();
    elCount.classList.toggle('hidden', n === 0);
    elNum.textContent = `${n} ONLINE`;
    elCount.classList.toggle('solo', n === 1);
    // the list of drivers, shown once somebody else is driving
    if ((n < 2 && !inGarage.length) || !listMax) { elWho.classList.add('hidden'); elWho.innerHTML = ''; if (!touch) edges(); return; }
    // each name's dot has the colour of that player's arrow on the maps (Martin, 2026-11-21)
    const ids = new Set(drivers.map((p) => p.id));
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sorted = [...drivers.filter((p) => !idle(p)).sort(byName), ...drivers.filter(idle).sort(byName), ...inGarage.filter((p) => !ids.has(p.id)).sort(byName)];
    // (desktop: every name, scrolled with the wheel; phones: a few, then "+N MORE")
    const cap = touch ? listMax : LIST_ALL;
    const more = sorted.length > cap ? sorted.length - cap + 1 : 0;
    if (!touch && sorted.length !== nNames) { nNames = sorted.length; fitAt = 0; }
    const rows = sorted.slice(0, more ? cap - 1 : cap).map((p) => {
      const r = mp.recordOf(p.name), g = idle(p), cls = `${g ? 'gar' : ''}${p.id === sp ? ' on' : ''}`.trim();
      const at = p.w === 'watch' ? '(watching)' : '(garage)';
      return `<li data-id="${escapeHtml(p.id)}"${cls ? ` class="${cls}"` : ''}>${mark(vm, p.id)}${g ? '' : kuBtn(p)}<i style="--c:${p.colour}"></i>${escapeHtml(p.name)}${carTag(p.car)}${g ? ` <small class="at">${at}</small>` : ''}${p.wn && !g ? ` <small class="wn">WATCHED · ${p.wn}</small>` : ''}${r && !g ? ` ${recTag(r, mp.recordTime(p.name))}` : ''}</li>`;
    });
    if (more) rows.push(`<li class="more">+${more} MORE</li>`);
    elWho.innerHTML = rows.join('');
    elWho.classList.remove('hidden');
    if (!touch) edges();
  }

  function note(text, kind) {
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
      // the player list changes right after this event; look once it has
      queueMicrotask(() => {
        last = ''; refresh();
        if (myCar && document.querySelector('#bigmap:not(.hidden)')) this.showRoster();
      });
    },
    update: refresh,
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
      const row = (p, i) => `<li data-i="${i}" class="${p.me ? 'me' : p.x === undefined || idle(p) ? 'idle' : ''}">${mark(vm, p.id)}${p.me ? '<b>▲</b>' : `${onMap(p) ? kuBtn(p) : ''}<b style="color:${p.colour}">●</b>`} ${escapeHtml(p.name)}${carTag(p.car)}${p.wn && !p.me && onMap(p) ? ` <small class="wn">WATCHED · ${p.wn}</small>` : ''}${p.w === 'garage' && !p.me ? ' <small>GARAGE</small>' : p.w === 'watch' && !p.me ? ' <small>WATCHING</small>' : p.x === undefined && !p.me ? ' <small>AWAY</small>' : ''}${p.me && mp.stealth ? ' <small>HIDDEN</small>' : ''}</li>`;
      const head = mp.online ? `${driving.length + 1} ONLINE` : mp.full ? 'SERVER FULL · DRIVING OFFLINE' : 'OFFLINE · RECONNECTING';
      list.innerHTML = `<h4${mp.online ? '' : ' class="off"'}>${head}</h4><ul>${shown.map(row).join('')}</ul>`;
      list.classList.remove('hidden');
      rosterKey = `${mp.online}|${others.length}|${vm?.key || ''}`;
    },
    hideRoster() { list.classList.add('hidden'); },
  };
  return api;
}
