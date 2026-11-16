// Who is online, next to the minimap: "3 ONLINE" plus small notes as people join and leave.
// On the big map a list of everyone online; tapping a name centres the map on that car.
import { escapeHtml } from '../race/race.js';

const NOTE_MS = 6000;

export function createPeople({ mp, onFocus }) {
  const box = document.createElement('div');
  box.id = 'people';
  box.innerHTML = '<div class="count hidden"><i></i><span></span></div><ul class="feed"></ul>';
  document.querySelector('#hud').appendChild(box);
  const elCount = box.querySelector('.count'), elNum = elCount.querySelector('span'), feed = box.querySelector('.feed');

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

  let last = -1;
  function refresh() {
    const n = mp.online ? mp.count + 1 : 0;
    if (n === last) return;
    last = n;
    elCount.classList.toggle('hidden', n === 0);
    elNum.textContent = `${n} ONLINE`;
    elCount.classList.toggle('solo', n === 1);
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
        last = -1; refresh();
        if (myCar && document.querySelector('#bigmap:not(.hidden)')) this.showRoster();
      });
    },
    update: refresh,
    // big map opened: list everyone online (only when someone else is)
    showRoster(car = myCar) {
      myCar = car;
      const others = mp.roster();
      if (!mp.online || !others.length) { list.classList.add('hidden'); return; }
      shown = [{ name: `${mp.name} (you)`, me: true, x: car?.x, z: car?.z }, ...others];
      list.innerHTML = `<h4>${shown.length} ONLINE</h4><ul>${shown.map((p, i) => `<li data-i="${i}" class="${p.me ? 'me' : p.x === undefined ? 'idle' : ''}">${p.me ? '<b>▲</b>' : '<b>●</b>'} ${escapeHtml(p.name)}</li>`).join('')}</ul>`;
      list.classList.remove('hidden');
    },
    hideRoster() { list.classList.add('hidden'); },
  };
}
