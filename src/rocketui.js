// What the driver sees of a car's thrusters (src/cars/thrust.js): the tank. On a phone the BOOST and FLIP
// buttons are the gauge, each a glass disc with the tank as a ring round it (Martin's pick of the drafts, 26 Nov).
// BOOST's ring is the whole tank, with its per cent under the name. FLIP's is in two halves, one a jump: a whole
// half is lit, one still filling is pale, and under the name stands "×2" or "×1" (the jumps in the tank) or, with
// less than one in it, the seconds until there is one: the button is dim then, and its ring shows it filling. On
// a desktop the same two discs stand small inside the rev counter, over the speed (Martin 26 Nov: better seen
// than the bar, and they can be clicked; body.rocketdial moves the speed down a touch), and the slim bar under
// it keeps the keys and the count. The tank fills again by itself
// whenever it is not full. Gas going out is seen going (Martin 26 Nov: "when using thrusters or when doing a
// flip, make the levels of the two buttons go down with also animation"): the level shown runs down to the
// tank's, a FLIP's half a tank in under a second and not in one jump, and the rings are white hot while it does
// or while BOOST blows. Only shown while the car has thrusters; the DOM is touched only when something changes.
// And the small fan in the rev counter of a car with suction fans.
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
  // (the level shown, as a share of a full tank, and when it was last moved. It rises with the tank. It falls, each
  // second, by so many times what it is behind and by so much of a tank at the least: [BOOST, which it must keep up
  // with (a full tank loses half of itself in the first second), a FLIP's half tank, run down in a good second])
  const DRAIN_K = [2.5, 1.6], DRAIN_MIN = [0.5, 0.3];
  let seen = -1, seenAt = 0;
  const cls = (el, name, on) => { if (el.classList.contains(name) !== on) el.classList.toggle(name, on); };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return {
    // car: the car being driven (or null: nothing shown); off: neither button works just now (waiting for a
    // start); timed: a timed lap or the Majoraadi stage is on, where there is neither BOOST nor FLIP (Martin 27 Nov)
    update(car, off = false, timed = false) {
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
        document.body.classList.toggle('rocketpad', want && touch); document.body.classList.toggle('rocketdial', want && !touch && !!dial); last = ''; seen = -1;
      }
      if (!r) return;
      const full = r.tank / TANK_S, now = performance.now(), dt = Math.min(0.1, (now - seenAt) / 1000);
      seenAt = now;
      const slow = r.flight ? 1 : 0;
      seen = seen < 0 || full >= seen ? full : Math.max(full, seen - dt * Math.max(DRAIN_MIN[slow], (seen - full) * DRAIN_K[slow]));
      const using = !!r.on || seen > full + 0.004;                          // gas is going out
      const pct = Math.round(seen * 200) / 2;                              // half a per cent steps
      // (seconds until the tank holds a jump again; it does not fill in a flight or while BOOST blows)
      const short = r.tank < JUMP_S - 1e-6 && !r.flight;
      const left = short ? Math.ceil(((JUMP_S - r.tank) / TANK_S) * (r.refillS || REFILL_S)) : 0;
      // (no kickflip from the water, where BOOST still works: src/cars/swim.js)
      const canFlip = !off && !timed && !car.inWater && r.tank >= JUMP_S - 1e-6, canBoost = !off && !timed && (r.on || (!r.dry && r.tank >= BOOST_MIN * TANK_S));
      const jumps = Math.floor(r.tank / JUMP_S + 1e-6);                    // kickflips in the tank
      const key = `${pct}|${left}|${canFlip ? 1 : 0}|${canBoost ? 1 : 0}|${off ? 1 : 0}|${timed ? 1 : 0}|${using ? 1 : 0}`;
      if (key === last) return;
      last = key;
      if (touch || dial) {
        ring.boost.style.strokeDasharray = `${((pct / 100) * RING).toFixed(1)} 400`;
        for (let i = 0; i < ring.flip.length; i++) {
          const share = Math.max(0, Math.min(1, ((pct / 100) * JUMPS) - i));
          ring.flip[i].style.strokeDasharray = `${(share * HALF).toFixed(1)} 400`;
          cls(ring.flip[i], 'part', share < 1);
        }
        text.boost.textContent = off || timed ? 'OFF' : `${Math.round(pct)}%`;
        text.flip.textContent = timed || off ? 'OFF' : short ? (left < 60 ? `${left} s` : mmss(left)) : `×${jumps}`;
        cls(bBoost, 'no', !canBoost); cls(bFlip, 'no', !canFlip);
        cls(bBoost, 'reload', !canBoost && !off && !timed);
        cls(bBoost, 'use', using); cls(bFlip, 'use', using);
      }
      if (!touch) {
        fill.bar.style.width = `${pct}%`;
        const k = keys();
        text.bar.textContent = off ? 'THRUSTERS WAIT FOR THE START' : timed ? 'NO BOOST OR FLIP ON A TIMED RUN' : short ? `${k.split(' · ')[0]} · FLIP IN ${mmss(left)}` : `${k} ×${jumps}`;
        cls(bar, 'reload', !canBoost && !off && !timed); cls(bar, 'use', using);
      }
    },
  };
}
