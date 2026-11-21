// Who is online, next to the minimap: "3 ONLINE" plus small notes as people join and leave.
// Only players whose car is on the map count (Martin, 2026-11-17: the count showed people who sat in
// the menu or had the game in a background tab). On desktop every driver is listed above the count,
// growing upwards, so a glance tells 2 from 20. On phones (Martin, 2026-11-21) a short list sits under
// the count, in the gap between the minimap and the rev counter: four names, then "+N MORE".
// On the big map a list of everyone online; tapping a name centres the map on that car.
import { escapeHtml } from '../race/race.js';

const NOTE_MS = 6000;
const LIST_MAX = 24;              // names listed on desktop before "+N MORE"
const LIST_MAX_PHONE = 5;         // rows on a phone, "+N MORE" included

export function createPeople({ mp, onFocus }) {
  const box = document.createElement('div');
  box.id = 'people';
  box.innerHTML = '<ul class="who hidden"></ul><div class="count hidden"><i></i><span></span></div><div class="me"></div><ul class="feed"></ul>';
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
  let shown = [], myCar = null;
  const listMax = document.body.classList.contains('touch') ? LIST_MAX_PHONE : LIST_MAX;

  const elMe = box.querySelector('.me');
  let last = '';
  function refresh() {
    // (stealth, ?off=100: a reminder that nobody else can see us)
    const myRec = mp.name ? mp.recordOf(mp.name) : '';
    const nm = mp.name ? `YOU: ${mp.name}${mp.stealth ? ' · HIDDEN' : ''}${myRec ? ` · ${myRec}` : ''}` : '';
    if (elMe.textContent !== nm) elMe.textContent = nm;
    const drivers = mp.online ? mp.players() : [];
    const n = mp.online ? drivers.length + 1 : 0;
    const key = `${n}|${mp.name}|${drivers.map((p) => p.name + p.colour + mp.recordOf(p.name)).join('|')}`;
    if (key === last) return;
    last = key;
    elCount.classList.toggle('hidden', n === 0);
    elNum.textContent = `${n} ONLINE`;
    elCount.classList.toggle('solo', n === 1);
    // the list of drivers, shown once somebody else is driving
    if (n < 2) { elWho.classList.add('hidden'); elWho.innerHTML = ''; return; }
    // each name's dot has the colour of that player's arrow on the maps (Martin, 2026-11-21)
    const sorted = drivers.slice().sort((a, b) => a.name.localeCompare(b.name));
    const more = sorted.length > listMax ? sorted.length - listMax + 1 : 0;
    const rows = sorted.slice(0, more ? listMax - 1 : listMax).map((p) => { const r = mp.recordOf(p.name); return `<li><i style="--c:${p.colour}"></i>${escapeHtml(p.name)}${r ? ` <small class="rec">${r}</small>` : ''}</li>`; });
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

  return {
    // multiplayer events
    event(kind, name, old) {
      if (kind === 'join') note(`${name} joined`, 'join');
      else if (kind === 'leave') note(`${name} left`, 'leave');
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
      const others = mp.roster();
      if (!mp.online || !others.length) { list.classList.add('hidden'); return; }
      const driving = others.filter((p) => p.x !== undefined), away = others.filter((p) => p.x === undefined);
      shown = [{ name: `${mp.name} (you)`, me: true, x: car?.x, z: car?.z }, ...driving, ...away];
      const row = (p, i) => `<li data-i="${i}" class="${p.me ? 'me' : p.x === undefined ? 'idle' : ''}">${p.me ? '<b>▲</b>' : `<b style="color:${p.colour}">●</b>`} ${escapeHtml(p.name)}${p.x === undefined && !p.me ? ' <small>AWAY</small>' : ''}</li>`;
      list.innerHTML = `<h4>${driving.length + 1} ONLINE</h4><ul>${shown.map(row).join('')}</ul>`;
      list.classList.remove('hidden');
    },
    hideRoster() { list.classList.add('hidden'); },
  };
}
