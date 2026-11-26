// What the driver sees of a car's thrusters (src/cars/thrust.js): the tank. On a phone the BOOST and FLIP
// buttons are the gauge, each filling from the bottom (FLIP in two halves, one a jump); on a desktop a slim
// bar under the rev counter with the keys. The tank fills again by itself whenever it is not full; with less
// than a jump's worth in it FLIP shows the time until there is one. Only shown while the car has thrusters; the DOM is touched only when something changes. And the
// small fan in the rev counter of a car with suction fans.
import { TANK_S, JUMP_S, REFILL_S, BOOST_MIN } from './cars/thrust.js';

export function createRocketUi({ pad, bar, fan = null, touch, keys = () => 'SHIFT BOOST · X FLIP' }) {
  const bBoost = pad.querySelector('.boost'), bFlip = pad.querySelector('.flip');
  const fill = { boost: bBoost.querySelector('i'), flip: bFlip.querySelector('i'), bar: bar.querySelector('i') };
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
      if (want !== shown) { shown = want; pad.classList.toggle('hidden', !want || !touch); bar.classList.toggle('hidden', !want || touch); document.body.classList.toggle('rocketpad', want && touch); last = ''; }
      if (!r) return;
      const pct = Math.round((r.tank / TANK_S) * 200) / 2;                 // half a per cent steps
      // (seconds until the tank holds a jump again; it does not fill in a flight or while BOOST blows)
      const short = r.tank < JUMP_S - 1e-6 && !r.flight;
      const left = short ? Math.ceil(((JUMP_S - r.tank) / TANK_S) * (r.refillS || REFILL_S)) : 0;
      const canFlip = !off && !noFlip && r.tank >= JUMP_S - 1e-6, canBoost = !off && (r.on || (!r.dry && r.tank >= BOOST_MIN * TANK_S));
      const key = `${pct}|${left}|${canFlip ? 1 : 0}|${canBoost ? 1 : 0}|${off ? 1 : 0}|${noFlip ? 1 : 0}`;
      if (key === last) return;
      last = key;
      const label = off ? 'OFF' : '';
      if (touch) {
        fill.boost.style.height = fill.flip.style.height = `${pct}%`;
        text.boost.textContent = label;
        text.flip.textContent = noFlip || off ? 'OFF' : short ? mmss(left) : '';
        cls(bBoost, 'no', !canBoost); cls(bFlip, 'no', !canFlip);
        cls(bBoost, 'reload', !canBoost && !off); cls(bFlip, 'reload', short && !off && !noFlip);
      } else {
        fill.bar.style.width = `${pct}%`;
        const k = keys();
        text.bar.textContent = off ? 'THRUSTERS WAIT FOR THE START' : noFlip ? `${k.split(' · ')[0]} · NO FLIP ON A TIMED RUN` : short ? `${k.split(' · ')[0]} · FLIP IN ${mmss(left)}` : k;
        cls(bar, 'reload', !canBoost && !off);
      }
    },
  };
}
