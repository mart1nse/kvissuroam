// Spectator mode (Martin, 2026-11-23; desktop only, a phone's screen is too small for it): click a player in
// the online list or their arrow on the minimap and the camera follows their car, with the HUD (speed, rev
// counter, street, minimap) showing theirs. A pill at the bottom takes you back to your own car (or Esc); the
// arrow keys go through the others. Your own car waits where it stood, parked, and the others do not see it
// meanwhile (no positions are sent, so nobody runs into an empty car); their lists say whom you watch.
//
// Nothing is built for it: the watched car is the copy multiplayer.js already draws, the world streams in
// around the camera's car instead of yours (main.js asks `focus`), and the HUD is the usual one, fed `view`.
import { CARS } from './cars/specs.js';
import { evKw } from './cars/physics.js';
import { THUMB } from './net/people.js';
import { inpIcon } from './race/inpicons.js';
import { inpOfPose } from './net/multiplayer.js';

const LOST_S = 30;                 // a watched player in the garage this long: on to the next player (or back to your car)
const QUIET_S = 6;                 // and gone quiet any other way (another tab, app or lost signal; Martin 2026-11-24:
                                   // a bus stopped being drawn and the HUD stood at 52 km/h): their car waits parked
                                   // where it was last heard of (multiplayer.js `hold`), at 0 km/h, this long
const END_S = 2.5;                 // a replay's car waits this long past the finish before the camera comes back
const JUMP = 60;                   // m between two frames: they were put somewhere else (map, R, H), the camera cuts
const SCRUB_REST = 0.4;            // s the pointer rests on one spot of a replay's slider before the map comes in there

export function createSpectate({ mp, world, toast, canStart, busy, onStart, onStop, racing = () => false }) {
  let id = null, shown = false, lostAt = 0, uiTimer = 0, uiKey = '', snap = false;
  // a lap record replay's slider while it is held: { id: the pointer, x0, w: the bar on the page, x: where the pointer
  // is, still: since when it has stood there (ms) }; heldT the moment the camera was last cut to; held: the map stays
  // streamed in where it was meanwhile (see frame)
  let scrub = null, heldT = -1, held = false, barF = -1, barTxt = '';
  // the watched car as the camera and the HUD want a car: the fields of our own after its physics step
  const view = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vx: 0, vy: 0, yawRate: 0, hit: 0, rpm: 0, gear: '', manual: false,
    reversing: false, airborne: false, inWater: false, waterTime: 0, spec: null, halfLen: 2.2, halfWid: 0.9, mark: '#2ff3ff' };
  const focus = { x: 0, z: 0 };

  const el = document.createElement('div');
  el.id = 'watch';
  el.className = 'hidden';
  el.innerHTML = '<div class="who"><span class="eye"></span><i></i><b></b><small class="car"></small><small class="dev"></small><small class="st"></small>'
    // a thumbs up for the watched player (Martin, 2026-11-24), as the one in front of their name in the list
    + `<button class="ku" data-act="watch-ku" title="Thumbs up">${THUMB}</button></div>`
    // a lap record replay's slider (Martin, 2026-11-26): see scrubbing below
    + '<div class="scrub hidden"><span class="now"></span><div class="rail" title="Hold and slide to any moment of the lap"><i class="fill"></i><span class="run"><i class="knob"></i></span></div><span class="end"></span></div>'
    + '<button class="back" data-act="watch-back" title="Back to your own car (Esc)">BACK TO MY CAR <kbd>ESC</kbd></button>'
    + '<div class="hint"><kbd>←</kbd><kbd>→</kbd> OTHER PLAYERS</div>';
  document.querySelector('#hud').appendChild(el);
  const elDot = el.querySelector('.who i'), elName = el.querySelector('.who b'), elCar = el.querySelector('.who .car'), elDev = el.querySelector('.who .dev'), elSt = el.querySelector('.who .st');
  const elHint = el.querySelector('.hint');
  el.querySelector('.back').addEventListener('click', (e) => { e.stopPropagation(); stop(); });
  const elKu = el.querySelector('.ku');
  elKu.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!id || !mp.kudos(id)) return;
    elKu.classList.remove('sent'); void elKu.offsetWidth; elKu.classList.add('sent');
    uiKey = ''; uiTimer = 0;
  });

  // ---- A lap record replay's slider (Martin, 2026-11-26: "some slider which you keep mouse pressed and slide from
  // left to right and back and it shows the specific still frame of that place, letting go keep playing from the place
  // where it is let go"). Held, the replay stands still at the moment under the pointer, silent, and the camera cuts
  // to the car there each time it moves; let go, the lap plays on from there. A mouse, a finger or a pen alike.
  // Nothing is built for it and nothing is loaded while it slides: the car's pose is read from the recorded lap
  // (multiplayer.js replayPose), and the map stays streamed in where it was until the pointer rests on one spot for
  // SCRUB_REST or lets go. Only then does the world come in round the car, through the work queue as when driving.
  const elScrub = el.querySelector('.scrub'), elBar = elScrub.querySelector('.rail'), elFill = elScrub.querySelector('.fill');
  const elRun = elScrub.querySelector('.run'), elNow = elScrub.querySelector('.now'), elEnd = elScrub.querySelector('.end');
  const replayCar = () => { const o = id && mp.remote(id); return o?.rp ? o : null; };
  const built = (o) => !!(o.model && o.modelCar === o.car && o.model.warmed !== false);
  function seek(x) {
    const o = replayCar();
    if (!o || !scrub) return;
    o.rp.t = Math.max(0, Math.min(1, (x - scrub.x0) / scrub.w)) * o.rp.ms / 1000;
    o.rp.ended = 0;
  }
  elBar.addEventListener('pointerdown', (e) => {
    const o = replayCar();
    if (!o || !shown || !built(o) || e.button > 0 || scrub) return;
    e.preventDefault(); e.stopPropagation();
    try { elBar.setPointerCapture(e.pointerId); } catch { /* (a pointer already gone) */ }
    const r = elBar.getBoundingClientRect();             // (once a drag: the page is not measured while it slides)
    scrub = { id: e.pointerId, x0: r.left, w: Math.max(1, r.width), x: e.clientX, still: performance.now() };
    o.rp.hold = true;
    seek(e.clientX);
    el.classList.add('scrubbing');
  });
  elBar.addEventListener('pointermove', (e) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    if (Math.abs(e.clientX - scrub.x) < 0.5) return;
    scrub.x = e.clientX; scrub.still = performance.now();
    seek(e.clientX);
  });
  function letGo(e) {
    if (!scrub || (e && e.pointerId !== scrub.id)) return;
    scrub = null;
    const o = replayCar();
    if (o) o.rp.hold = false;
    el.classList.remove('scrubbing');
  }
  for (const k of ['pointerup', 'pointercancel', 'lostpointercapture']) elBar.addEventListener(k, letGo);
  // the slider's fill, knob and clock: moved, not laid out again (only when they change)
  function showBar(o) {
    const dur = o.rp.ms / 1000, f = Math.max(0, Math.min(1, o.rp.t / dur));
    if (Math.abs(f - barF) > 1e-4) {
      barF = f;
      elFill.style.transform = `scaleX(${f.toFixed(4)})`;
      elRun.style.transform = `translateX(${(f * 100).toFixed(2)}%)`;
    }
    const txt = clock(o.rp.t);
    if (txt !== barTxt) { barTxt = txt; elNow.textContent = txt; }
  }

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
    if (was) { const w = mp.remote(was); w?.el.classList.remove('watched'); if (w?.rp) mp.stopReplay(); }
    letGo(); held = false; heldT = -1; barF = -1; barTxt = '';
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
    const o = mp.remote(id);
    o?.el.classList.remove('watched');
    if (o?.rp) mp.stopReplay();                  // (a lap record's replay: gone with the watching)
    letGo(); held = false;
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
    const o = mp.remote(id);
    // a lap record's replay (src/race/replay.js) needs no connection; after the finish line the car waits there a
    // moment before the camera comes back to yours (not while the slider is held there)
    if (o?.rp) {
      if (o.rp.ended && !o.rp.hold && performance.now() / 1000 - o.rp.ended > END_S) return stop('REPLAY FINISHED');
    } else if (!mp.online) return stop('CONNECTION LOST');
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
      const rp = o.rp, hold = !!rp?.hold;
      // (a replay's slider held and moving: the map stays streamed in where it was, see scrubbing above)
      held = hold && !!scrub && performance.now() - scrub.still < SCRUB_REST * 1000;
      if (!held) { focus.x = p[0]; focus.z = p[1]; }
      const ready = world.ready(p[0], p[1]);
      // a replay runs once the camera is on it and the ground where the car is has come in (let go of the slider
      // somewhere not loaded yet, it waits there a moment)
      if (rp) rp.run = shown && ready;
      // (the ground where they are must be in before the camera goes there: until then it stays put. A replay
      // once shown keeps the camera on its car: it waits, or it is a still frame of the slider)
      if (ready || (rp && shown)) {
        const fx = Math.sin(p[3]), fz = -Math.cos(p[3]), rx = Math.cos(p[3]), rz = Math.sin(p[3]);
        // (the slider moved the car: the camera cuts to it there, straight behind, as a still picture)
        if (!shown || Math.hypot(p[0] - view.x, p[1] - view.z) > JUMP || (hold && rp.t !== heldT)) snap = true;
        heldT = hold ? rp.t : -1;
        const s = o.spec || CARS[o.car] || CARS.w201;
        view.x = p[0]; view.z = p[1]; view.y = p[2]; view.yaw = p[3]; view.pitch = p[4]; view.roll = p[5];
        view.vx = p[6] * fx + p[7] * fz; view.vy = p[6] * rx + p[7] * rz;
        view.rpm = p[14] ?? 0; view.reversing = !!p[10]; view.inWater = !!((p[20] || 0) & 2);
        // (an electric car's power dial, from what it sends: pedal, brake light, motor revs and speed)
        view.kw = s.engine.type === 'ev' ? evKw(s, p[12] || 0, p[9] || 0, (view.rpm * Math.PI / 30 / s.gears[0]) * s.wheelRadius, Math.abs(view.vx), view.reversing) : 0;
        view.spec = s; view.halfLen = o.halfLen; view.halfWid = o.halfWid; view.mark = o.colour;
        shown = true;
      }
    } else { view.vx = view.vy = view.rpm = view.kw = 0; }    // (nothing heard of them at all: the dial is not left at their speed)
    if (o.rp) {
      showBar(o);
      const can = shown && built(o);
      if (can !== elScrub.classList.contains('ready')) elScrub.classList.toggle('ready', can);
    }
    if ((uiTimer -= dt) > 0) return;
    uiTimer = 0.25;
    const hot = p && o.live && (p[20] & 8), race = racing(id);
    const lap = mp.lastLap(o.name);
    // (a replay's moment and length are on its slider)
    const wait = o.rp && (!shown || !built(o) || (!o.rp.run && !o.rp.hold && !o.rp.ended));
    const st = o.rp ? (wait ? 'LOADING…' : `${o.rp.track === 'raadi' ? 'STAGE' : 'LAP'} RECORD REPLAY`) : !p || o.held ? (o.w === 'garage' ? 'IN THE GARAGE' : o.w === 'away' ? 'AWAY' : o.w === 'watch' ? 'WATCHING TOO' : 'NO SIGNAL') : !shown ? 'LOADING…' : race ? 'IN THE RACE' : hot ? (Math.hypot(p[0] - 2660, p[1] - 470) < 600 ? 'ON THE STAGE' : 'ON A HOTLAP')
      : lap ? `LAST LAP ${fmt(lap.ms)}` : '';
    const kuWait = mp.kudosWait(id) > 0;
    // what drives the car: a record's lap by the board (multiplayer.js loadReplay), a player by their car's flags
    // (nothing from a page from before that was sent, or while nothing is heard of them)
    const dev = o.rp ? o.rp.inp : p && o.live ? inpOfPose(p) : null;
    const key = `${o.name}|${o.colour}|${o.car}|${st}|${order().length}|${kuWait}|${mp.stealth}|${!!o.rp}|${dev || ''}`;
    if (key === uiKey) return;
    uiKey = key;
    elScrub.classList.toggle('hidden', !o.rp);
    if (o.rp) elEnd.textContent = fmt(o.rp.ms);
    elDot.style.setProperty('--c', o.colour);
    elName.textContent = o.name.toUpperCase();
    elCar.textContent = CARS[o.car]?.short || '';
    // (a small mark of what it is or was driven with, after the car: Martin 27 Nov)
    elDev.innerHTML = dev ? inpIcon(dev, (n) => `${o.rp ? 'DRIVEN' : 'DRIVING'} WITH A ${n}`) : '';
    elSt.textContent = st;
    elSt.classList.toggle('hot', !!(hot || race || o.rp));
    elHint.classList.toggle('hidden', order().length < 2 || !!o.rp);
    elKu.classList.toggle('wait', kuWait);
    elKu.classList.toggle('hidden', !!mp.stealth || !!o.rp);
  }
  // (a moment of a replay, to the tenth: 1:07.4)
  const clock = (t) => { const d = Math.floor(t * 10); return `${Math.floor(d / 600)}:${String(Math.floor((d % 600) / 10)).padStart(2, '0')}.${d % 10}`; };
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
    // a replay's slider is being slid: what streams in round the camera (ground pictures, parked cars) stays where
    // `focus` is meanwhile
    get scrubbing() { return !!id && held; },
  };
}
