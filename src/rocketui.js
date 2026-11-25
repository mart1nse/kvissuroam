// What the driver sees of a car's thrusters (src/cars/thrust.js): the tank. On a phone the BOOST and FLIP
// buttons are the gauge, each filling from the bottom (FLIP in two halves, one a jump); on a desktop a slim
// bar under the rev counter with the keys. An empty tank reloads: the same shapes fill up again, with the
// time left. Only shown while the car has thrusters; the DOM is touched only when something changes. And the
// small fan in the rev counter of a car with suction fans.
import { TANK_S, JUMP_S, REFILL_S } from './cars/thrust.js';

export function createRocketUi({ pad, bar, fan = null, touch, keys = () => 'SHIFT BOOST · X FLIP' }) {
  const bBoost = pad.querySelector('.boost'), bFlip = pad.querySelector('.flip');
  const fill = { boost: bBoost.querySelector('i'), flip: bFlip.querySelector('i'), bar: bar.querySelector('i') };
  const text = { boost: bBoost.querySelector('small'), flip: bFlip.querySelector('small'), bar: bar.querySelector('small') };
  let shown = null, last = '', fanOn = null, fanFull = null;
  const cls = (el, name, on) => { if (el.classList.contains(name) !== on) el.classList.toggle(name, on); };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return {
    // car: the car being driven (or null: nothing shown); off: neither button works just now (waiting for a
    // start); noFlip: no kickflip (a race, a timed lap)
    update(car, off = false, noFlip = false) {
      // (the suction fans, spec.fanDown: they never stop, and are run up by the pedal or by speed, as their
      // sound is in src/audio.js)
      if (fan) {
        const on = !!(car && car.spec.fanDown), full = on && Math.max(car.throttle || 0, Math.abs(car.vx) / 14) > 0.5;
        if (on !== fanOn) { fanOn = on; fan.classList.toggle('hidden', !on); }
        if (full !== fanFull) { fanFull = full; fan.classList.toggle('full', full); }
      }
      const r = car && car.rocket;
      const want = !!r;
      // (body.rocketpad: the phone layout makes room for the two buttons, src/style.css)
      if (want !== shown) { shown = want; pad.classList.toggle('hidden', !want || !touch); bar.classList.toggle('hidden', !want || touch); document.body.classList.toggle('rocketpad', want && touch); last = ''; }
      if (!r) return;
      const pct = Math.round((r.tank / TANK_S) * 200) / 2;                 // half a per cent steps
      const left = r.reload ? Math.ceil((1 - r.tank / TANK_S) * (r.refillS || REFILL_S)) : 0;
      const canFlip = !off && !noFlip && !r.reload && r.tank >= JUMP_S - 1e-6, canBoost = !off && !r.reload && r.tank > 0;
      const key = `${pct}|${left}|${canFlip ? 1 : 0}|${canBoost ? 1 : 0}|${off ? 1 : 0}|${noFlip ? 1 : 0}`;
      if (key === last) return;
      last = key;
      const label = off ? 'OFF' : r.reload ? mmss(left) : '';
      if (touch) {
        fill.boost.style.height = fill.flip.style.height = `${pct}%`;
        text.boost.textContent = label;
        text.flip.textContent = noFlip ? 'OFF' : label;
        cls(bBoost, 'no', !canBoost); cls(bFlip, 'no', !canFlip);
        cls(bBoost, 'reload', r.reload); cls(bFlip, 'reload', r.reload);
      } else {
        fill.bar.style.width = `${pct}%`;
        const k = keys();
        text.bar.textContent = off ? 'THRUSTERS WAIT FOR THE START' : r.reload ? `REFILL ${mmss(left)}` : noFlip ? `${k.split(' · ')[0]} · NO FLIP ON A TIMED RUN` : k;
        cls(bar, 'reload', r.reload);
      }
    },
  };
}
