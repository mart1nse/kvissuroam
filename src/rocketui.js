// What the driver sees of a car's thrusters (src/cars/thrust.js): the tank. On a phone the BOOST and FLIP
// buttons are the gauge, each a glass disc with the tank as a ring round it (Martin's pick of the drafts, 26 Nov).
// BOOST's ring is the whole tank, with its per cent under the name. FLIP's is in two halves, one a jump: a whole
// half is lit, one still filling is pale, and under the name stands "×2" or "×1" (the jumps in the tank) or, with
// less than one in it, the seconds until there is one: the button is dim then, and its ring shows it filling. On
// a desktop the same two discs stand small inside the rev counter, over the speed (Martin 26 Nov: better seen
// than the bar, and they can be clicked; body.rocketdial moves the speed down a touch), and the slim bar under
// it keeps the keys and the count. The tank fills again by itself
// whenever it is not full. Only shown while the car has thrusters; the DOM is touched only when something
// changes. And the small fan in the rev counter of a car with suction fans.
import { TANK_S, JUMP_S, REFILL_S, BOOST_MIN } from './cars/thrust.js';

export function createRocketUi({ pad, dial = null, bar, fan = null, touch, keys = () => 'SHIFT BOOST · X FLIP' }) {
  // (the discs in use: the phone's, or the rev counter's)
  const discs = touch || !dial ? pad : dial;
  const bBoost = discs.querySelector('.boost'), bFlip = discs.querySelector('.flip');
  // (the rings: a dash as long as the share that is in, of the circle's 290.6 and of each half's 138.8 units)
  const ring = { boost: bBoost.querySelector('.fg'), flip: [...bFlip.querySelectorAll('.fg')] }, fill = { bar: bar.querySelector('i') };
  const RING = 2 * Math.PI * 46.25, HALF = (172 / 180) * Math.PI * 46.25, JUMPS = Math.round(TANK_S / JUMP_S);
  const text = { boost: bBoost.querySelector('small'), flip: bFlip.querySelector('small'), bar: bar.querySelector('small') };
  let shown = null, last = '', fanOn = null, fanFull = null, fanOff = null;
  const cls = (el, name, on) => { if (el.classList.contains(name) !== on) el.classList.toggle(name, on); };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return {
    // car: the car being driven (or null: nothing shown); off: neither button works just now (waiting for a
    // start); noFlip: no kickflip (a race, a timed lap)
    update(car, off = false, noFlip = false) {
      // (the suction fans, spec.fanDown: they never stop, and are run up by the pedal or by speed, as their
      // sound is in src/audio.js)
      if (fan) {
        // (the icon is their switch, car.fanOff: off, it stands still and is struck through)
        const on = !!(car && car.spec.fanDown), off = on && !!car.fanOff, full = on && !off && Math.max(car.throttle || 0, Math.abs(car.vx) / 14) > 0.5;
        if (on !== fanOn) { fanOn = on; fan.classList.toggle('hidden', !on); }
        if (off !== fanOff) { fanOff = off; fan.classList.toggle('off', off); fan.title = off ? 'Suction fans are OFF: click to switch them on (U)' : 'Suction fans are on: click to switch them off (U)'; }
        if (full !== fanFull) { fanFull = full; fan.classList.toggle('full', full); }
      }
      const r = car && car.rocket;
      const want = !!r;
      // (body.rocketpad: the phone layout makes room for the two buttons, src/style.css)
      if (want !== shown) {
        shown = want; pad.classList.toggle('hidden', !want || !touch); bar.classList.toggle('hidden', !want || touch);
        if (dial) dial.classList.toggle('hidden', !want || touch);
        document.body.classList.toggle('rocketpad', want && touch); document.body.classList.toggle('rocketdial', want && !touch && !!dial); last = '';
      }
      if (!r) return;
      const pct = Math.round((r.tank / TANK_S) * 200) / 2;                 // half a per cent steps
      // (seconds until the tank holds a jump again; it does not fill in a flight or while BOOST blows)
      const short = r.tank < JUMP_S - 1e-6 && !r.flight;
      const left = short ? Math.ceil(((JUMP_S - r.tank) / TANK_S) * (r.refillS || REFILL_S)) : 0;
      const canFlip = !off && !noFlip && r.tank >= JUMP_S - 1e-6, canBoost = !off && (r.on || (!r.dry && r.tank >= BOOST_MIN * TANK_S));
      const jumps = Math.floor(r.tank / JUMP_S + 1e-6);                    // kickflips in the tank
      const key = `${pct}|${left}|${canFlip ? 1 : 0}|${canBoost ? 1 : 0}|${off ? 1 : 0}|${noFlip ? 1 : 0}`;
      if (key === last) return;
      last = key;
      if (touch || dial) {
        ring.boost.style.strokeDasharray = `${((pct / 100) * RING).toFixed(1)} 400`;
        for (let i = 0; i < ring.flip.length; i++) {
          const share = Math.max(0, Math.min(1, ((pct / 100) * JUMPS) - i));
          ring.flip[i].style.strokeDasharray = `${(share * HALF).toFixed(1)} 400`;
          cls(ring.flip[i], 'part', share < 1);
        }
        text.boost.textContent = off ? 'OFF' : `${Math.round(pct)}%`;
        text.flip.textContent = noFlip || off ? 'OFF' : short ? (left < 60 ? `${left} s` : mmss(left)) : `×${jumps}`;
        cls(bBoost, 'no', !canBoost); cls(bFlip, 'no', !canFlip);
        cls(bBoost, 'reload', !canBoost && !off);
      }
      if (!touch) {
        fill.bar.style.width = `${pct}%`;
        const k = keys();
        text.bar.textContent = off ? 'THRUSTERS WAIT FOR THE START' : noFlip ? `${k.split(' · ')[0]} · NO FLIP ON A TIMED RUN` : short ? `${k.split(' · ')[0]} · FLIP IN ${mmss(left)}` : `${k} ×${jumps}`;
        cls(bar, 'reload', !canBoost && !off);
      }
    },
  };
}
