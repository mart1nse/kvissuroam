// Who is online, next to the minimap: "3 ONLINE" plus small notes as people join and leave.
// Only players whose car is on the map count (Martin, 2026-11-17: the count showed people who sat in
// the menu or had the game in a background tab). On desktop every driver is listed above the count,
// growing upwards, so a glance tells 2 from 20. On phones (Martin, 2026-11-21) a short list sits under
// the count, in the gap between the minimap and the rev counter: four names, then "+N MORE".
// On the big map a list of everyone online; tapping a name centres the map on that car.
// While a race vote has votes in (Martin, 2026-11-23), each name that may vote gets a small mark in
// front: a lit tick when voted, a faint ring when not. Gone again when the vote is over.
// On desktop (Martin, 2026-11-23) a name in the list is a button: it follows that player's car as a spectator
// (src/spectate.js); your own line takes you back to your car. Spectators are listed like those in the garage,
// with whom they watch, and a player being watched sees "N WATCHING" on their own line.
import { escapeHtml } from '../race/race.js';
import { CARS } from '../cars/specs.js';

const NOTE_MS = 6000;
const LIST_MAX = 24;              // names listed on desktop before "+N MORE"
const LIST_MAX_PHONE = 5;
const ME_COLOUR = '#ffd45e';    // your own arrow on the maps         // rows on a phone, "+N MORE" included

export function createPeople({ mp, onFocus, votes, onWatch, watching = () => null }) {
  // a vote mark for one player id ('' when no vote is open or they may not vote)
  // the car a player drives, short (Martin, 2026-11-23: STI, M3, F40, ...)
  const carTag = (id) => { const t = id && CARS[id]?.tag; return t ? ` <small class="car">${escapeHtml(t)}</small>` : ''; };
  const mark = (vm, id) => (vm && id && vm.can(id) ? (vm.has(id) ? '<u class="vt on"></u>' : '<u class="vt"></u>') : '');
  const box = document.createElement('div');
  box.id = 'people';
  // (Martin, 2026-11-23: the count on top, then you, then the others; no light before the count)
  box.innerHTML = '<div class="count hidden"><span></span></div><div class="me"></div><ul class="who hidden"></ul><ul class="feed"></ul>';
  document.querySelector('#hud').appendChild(box);
  const elCount = box.querySelector('.count'), elNum = elCount.querySelector('span'), feed = box.querySelector('.feed');
  const elWho = box.querySelector('.who');

  const list = document.createElement('div');
  list.id = 'roster';
  list.className = 'hidden';
  document.querySelector('#bigmap').appendChild(list);
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (!li) return;
    const p = shown[+li.dataset.i];
    if (p && p.x !== undefined) onFocus(p.x, p.z);
  });
  let shown = [], myCar = null, rosterKey = '';
  const touch = document.body.classList.contains('touch');
  const listMax = touch ? LIST_MAX_PHONE : LIST_MAX;
  // (desktop: click a name to watch that car, your own line to come back)
  if (!touch && onWatch) box.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id], .me');
    if (!li) return;
    e.stopPropagation();
    onWatch(li.classList.contains('me') ? null : li.dataset.id);
  });
  // not on the map: in the garage, or watching somebody else's car
  const idle = (p) => p.w === 'garage' || p.w === 'watch';
  const nameOf = (id) => (id === mp.id ? 'YOU' : mp.nameOf(id) || '');

  const elMe = box.querySelector('.me');
  let last = '', meLast = '';
  function refresh() {
    // (stealth, ?off=100: a reminder that nobody else can see us)
    const myRec = mp.name ? mp.recordOf(mp.name) : '';
    const nm = mp.name ? `YOU: ${mp.name}` : '';
    const wn = mp.online ? mp.watchers() : 0;
    const nmMore = `${mp.stealth ? ' · HIDDEN' : ''}${mp.online ? '' : ' · OFFLINE'}${myRec ? ` · ${myRec}` : ''}${wn ? ` · ${wn} WATCHING` : ''}`;
    const sp = watching();
    const vm = mp.online ? votes?.() : null;
    const meHtml = nm ? `${mark(vm, mp.id)}<i style="--c:${ME_COLOUR}"></i>${escapeHtml(nm)}${carTag(mp.car)}${escapeHtml(nmMore)}` : '';
    if (meHtml !== meLast) { meLast = meHtml; elMe.innerHTML = meHtml; }
    elMe.classList.toggle('back', !!sp);
    const drivers = mp.online ? mp.drivers() : [];
    const n = mp.online ? drivers.filter((p) => !idle(p)).length + 1 : 0;   // (the garage ones are listed, not counted)
    // (Martin, 2026-11-23) those in the garage are listed too, greyed, after the drivers on the map
    const inGarage = mp.online ? mp.roster().filter(idle) : [];
    const key = `${n}|${mp.name}|${vm?.key || ''}|${sp}|${drivers.map((p) => p.name + p.colour + p.car + p.w + p.on + mp.recordOf(p.name)).join('|')}|${inGarage.map((p) => p.id + p.on).join(',')}`;
    if (key === last) return;
    last = key;
    // the city map's list follows the connection (lost, back) and the vote while the map is open
    if (myCar && rosterKey && rosterKey !== `${mp.online}|${mp.online ? mp.roster().length : 0}|${vm?.key || ''}` && !list.classList.contains('hidden')) api.showRoster();
    elCount.classList.toggle('hidden', n === 0);
    elNum.textContent = `${n} ONLINE`;
    elCount.classList.toggle('solo', n === 1);
    // the list of drivers, shown once somebody else is driving
    if (n < 2 && !inGarage.length) { elWho.classList.add('hidden'); elWho.innerHTML = ''; return; }
    // each name's dot has the colour of that player's arrow on the maps (Martin, 2026-11-21)
    const ids = new Set(drivers.map((p) => p.id));
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sorted = [...drivers.filter((p) => !idle(p)).sort(byName), ...drivers.filter(idle).sort(byName), ...inGarage.filter((p) => !ids.has(p.id)).sort(byName)];
    const more = sorted.length > listMax ? sorted.length - listMax + 1 : 0;
    const rows = sorted.slice(0, more ? listMax - 1 : listMax).map((p) => {
      const r = mp.recordOf(p.name), g = idle(p), cls = `${g ? 'gar' : ''}${p.id === sp ? ' on' : ''}`.trim();
      const at = p.w === 'watch' ? `(watching${p.on && nameOf(p.on) ? ` ${escapeHtml(nameOf(p.on))}` : ''})` : '(garage)';
      return `<li data-id="${escapeHtml(p.id)}"${cls ? ` class="${cls}"` : ''}>${mark(vm, p.id)}<i style="--c:${p.colour}"></i>${escapeHtml(p.name)}${carTag(p.car)}${g ? ` <small class="at">${at}</small>` : ''}${r && !g ? ` <small class="rec">${r}</small>` : ''}</li>`;
    });
    if (more) rows.push(`<li class="more">+${more} MORE</li>`);
    elWho.innerHTML = rows.join('');
    elWho.classList.remove('hidden');
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
      const row = (p, i) => `<li data-i="${i}" class="${p.me ? 'me' : p.x === undefined || idle(p) ? 'idle' : ''}">${mark(vm, p.id)}${p.me ? '<b>▲</b>' : `<b style="color:${p.colour}">●</b>`} ${escapeHtml(p.name)}${carTag(p.car)}${p.w === 'garage' && !p.me ? ' <small>GARAGE</small>' : p.w === 'watch' && !p.me ? ' <small>WATCHING</small>' : p.x === undefined && !p.me ? ' <small>AWAY</small>' : ''}${p.me && mp.stealth ? ' <small>HIDDEN</small>' : ''}</li>`;
      const head = mp.online ? `${driving.length + 1} ONLINE` : 'OFFLINE · RECONNECTING';
      list.innerHTML = `<h4${mp.online ? '' : ' class="off"'}>${head}</h4><ul>${shown.map(row).join('')}</ul>`;
      list.classList.remove('hidden');
      rosterKey = `${mp.online}|${others.length}|${vm?.key || ''}`;
    },
    hideRoster() { list.classList.add('hidden'); },
  };
  return api;
}
