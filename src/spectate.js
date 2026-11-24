// Spectator mode (Martin, 2026-11-23; desktop only, a phone's screen is too small for it): click a player in
// the online list or their arrow on the minimap and the camera follows their car, with the HUD (speed, rev
// counter, street, minimap) showing theirs. A pill at the bottom takes you back to your own car (or Esc); the
// arrow keys go through the others. Your own car waits where it stood, parked, and the others do not see it
// meanwhile (no positions are sent, so nobody runs into an empty car); their lists say whom you watch.
//
// Nothing is built for it: the watched car is the copy multiplayer.js already draws, the world streams in
// around the camera's car instead of yours (main.js asks `focus`), and the HUD is the usual one, fed `view`.
import { CARS } from './cars/specs.js';
import { THUMB } from './net/people.js';

const LOST_S = 30;                 // a watched player in the garage this long: on to the next player (or back to your car)
const QUIET_S = 6;                 // and gone quiet any other way (another tab, app or lost signal; Martin 2026-11-24:
                                   // a bus stopped being drawn and the HUD stood at 52 km/h): their car waits parked
                                   // where it was last heard of (multiplayer.js `hold`), at 0 km/h, this long
const JUMP = 60;                   // m between two frames: they were put somewhere else (map, R, H), the camera cuts

export function createSpectate({ mp, world, toast, canStart, busy, onStart, onStop, racing = () => false }) {
  let id = null, shown = false, lostAt = 0, uiTimer = 0, uiKey = '', snap = false;
  // the watched car as the camera and the HUD want a car: the fields of our own after its physics step
  const view = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vx: 0, vy: 0, yawRate: 0, hit: 0, rpm: 0, gear: '', manual: false,
    reversing: false, airborne: false, inWater: false, waterTime: 0, spec: null, halfLen: 2.2, halfWid: 0.9, mark: '#2ff3ff' };
  const focus = { x: 0, z: 0 };

  const el = document.createElement('div');
  el.id = 'watch';
  el.className = 'hidden';
  el.innerHTML = '<div class="who"><span class="eye"></span><i></i><b></b><small class="car"></small><small class="st"></small>'
    // a thumbs up for the watched player (Martin, 2026-11-24), as the one in front of their name in the list
    + `<button class="ku" data-act="watch-ku" title="Thumbs up">${THUMB}</button></div>`
    + '<button class="back" data-act="watch-back" title="Back to your own car (Esc)">BACK TO MY CAR <kbd>ESC</kbd></button>'
    + '<div class="hint"><kbd>←</kbd><kbd>→</kbd> OTHER PLAYERS</div>';
  document.querySelector('#hud').appendChild(el);
  const elDot = el.querySelector('.who i'), elName = el.querySelector('.who b'), elCar = el.querySelector('.who .car'), elSt = el.querySelector('.who .st');
  const elHint = el.querySelector('.hint');
  el.querySelector('.back').addEventListener('click', (e) => { e.stopPropagation(); stop(); });
  const elKu = el.querySelector('.ku');
  elKu.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!id || !mp.kudos(id)) return;
    elKu.classList.remove('sent'); void elKu.offsetWidth; elKu.classList.add('sent');
    uiKey = ''; uiTimer = 0;
  });

  // the players that can be watched, in the online list's order (by name), with your own car first
  const order = () => mp.players().filter((p) => p.id).sort((a, b) => a.name.localeCompare(b.name));
  // (one that can be watched now: on the map and sending)
  const live = (pid) => { const o = mp.remote(pid); return !!(o?.pose && !o.held); };

  function start(to) {
    if (!to || to === id) return;
    const o = mp.remote(to);
    if (!o) return;
    if (!o.pose || o.held) { toast(`${o.name.toUpperCase()} IS ${o.w === 'garage' ? 'IN THE GARAGE' : o.w === 'watch' ? 'WATCHING TOO' : 'NOT ON THE MAP'}`, 2000); return; }
    if (!id && !canStart()) return;
    const was = id;
    if (was) mp.remote(was)?.el.classList.remove('watched');
    id = to; lostAt = 0; uiKey = ''; uiTimer = 0;
    mp.hold?.(to);
    o.el.classList.add('watched');                // (their name is in the pill)
    shown = false;                                // the camera stays on the last car until the ground there is in
    focus.x = o.pose[0]; focus.z = o.pose[1];
    el.classList.remove('hidden');
    document.body.classList.add('watching');
    onStart(o, !was);
  }

  function stop(why) {
    if (!id) return;
    mp.remote(id)?.el.classList.remove('watched');
    id = null; shown = false;
    mp.hold?.(null);
    el.classList.add('hidden');
    document.body.classList.remove('watching');
    if (why) toast(why, 2400);
    onStop();
  }

  // the next or previous player (your own car is one of the stops on the way round)
  function step(dir) {
    const list = order();
    const ids = [null, ...list.map((p) => p.id)];
    let i = ids.indexOf(id);
    if (i < 0) i = 0;
    // (past anyone gone quiet: they could not be watched, and the keys would stick on them)
    for (let k = 1; k < ids.length; k++) {
      const n = ids[(i + dir * k + ids.length * k) % ids.length];
      if (!n) return stop();
      if (live(n)) return start(n);
    }
    stop();
  }

  // keys while watching: Esc back, left and right through the players (before the game's own keys)
  addEventListener('keydown', (e) => {
    if (!id || busy()) return;
    if (e.code === 'Escape') stop();
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { if (!e.repeat) step(e.code === 'ArrowRight' ? 1 : -1); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // (by the clock, not the game's frame time, which is held back on a slow frame)
  function lost(o) {
    const now = performance.now() / 1000;
    lostAt ||= now;
    const lostFor = now - lostAt;
    // (whom they watch, if they start watching too, is not told: spectating is anonymous)
    if (lostFor <= (o.w === 'garage' ? LOST_S : QUIET_S)) return;
    const why = `${o.name.toUpperCase()} ${o.w === 'garage' ? 'STAYED IN THE GARAGE' : 'LEFT THE MAP'}`;
    const next = order().find((q) => q.id !== id && live(q.id));
    if (next) { start(next.id); toast(why, 2400); } else stop(why);
  }

  function frame(dt) {
    if (!id) return;
    if (!mp.online) return stop('CONNECTION LOST');
    const o = mp.remote(id);
    if (!o) {
      // gone offline: on to the next one, if there is anyone left to watch
      const name = elName.textContent;
      const next = order().find((q) => live(q.id));
      if (next) { start(next.id); toast(`${name} LEFT`, 2000); } else stop(`${name} LEFT`);
      return;
    }
    const p = o.pose;
    if (!p || o.held) lost(o);
    else lostAt = 0;
    if (!id || id !== o.id) return;               // (moved on)
    if (p) {
      focus.x = p[0]; focus.z = p[1];
      // (the ground where they are must be in before the camera goes there: until then it stays put)
      if (world.ready(p[0], p[1])) {
        const fx = Math.sin(p[3]), fz = -Math.cos(p[3]), rx = Math.cos(p[3]), rz = Math.sin(p[3]);
        if (!shown || Math.hypot(p[0] - view.x, p[1] - view.z) > JUMP) snap = true;
        const s = o.spec || CARS[o.car] || CARS.w201;
        view.x = p[0]; view.z = p[1]; view.y = p[2]; view.yaw = p[3]; view.pitch = p[4]; view.roll = p[5];
        view.vx = p[6] * fx + p[7] * fz; view.vy = p[6] * rx + p[7] * rz;
        view.rpm = p[14] ?? 0; view.reversing = !!p[10]; view.inWater = !!((p[20] || 0) & 2);
        view.spec = s; view.halfLen = o.halfLen; view.halfWid = o.halfWid; view.mark = o.colour;
        shown = true;
      }
    } else { view.vx = view.vy = view.rpm = 0; }    // (nothing heard of them at all: the dial is not left at their speed)
    if ((uiTimer -= dt) > 0) return;
    uiTimer = 0.25;
    const hot = p && o.live && (p[20] & 8), race = racing(id);
    const lap = mp.lastLap(o.name);
    const st = !p || o.held ? (o.w === 'garage' ? 'IN THE GARAGE' : o.w === 'away' ? 'AWAY' : o.w === 'watch' ? 'WATCHING TOO' : 'NO SIGNAL') : !shown ? 'LOADING…' : race ? 'IN THE RACE' : hot ? 'ON A HOTLAP'
      : lap ? `LAST LAP ${fmt(lap.ms)}` : '';
    const wait = mp.kudosWait(id) > 0;
    const key = `${o.name}|${o.colour}|${o.car}|${st}|${order().length}|${wait}|${mp.stealth}`;
    if (key === uiKey) return;
    uiKey = key;
    elDot.style.setProperty('--c', o.colour);
    elName.textContent = o.name.toUpperCase();
    elCar.textContent = CARS[o.car]?.short || '';
    elSt.textContent = st;
    elSt.classList.toggle('hot', !!(hot || race));
    elHint.classList.toggle('hidden', order().length < 2);
    elKu.classList.toggle('wait', wait);
    elKu.classList.toggle('hidden', !!mp.stealth);
  }
  const fmt = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;

  return {
    start, stop, step, frame,
    get id() { return id; },
    get active() { return !!id; },
    // the camera and the HUD follow this car once the ground under it is in (else our own)
    get view() { return id && shown ? view : null; },
    // where the world should be streamed in: the watched car, even before the camera is there
    get focus() { return id ? focus : null; },
    // the camera should cut to the car instead of easing (a new car, or a jump across the map)
    takeSnap() { const s = snap; snap = false; return s; },
  };
}
