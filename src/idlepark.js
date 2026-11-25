// A car left standing on the map with nobody at the controls goes back to the garage, where it is off the map for
// everyone (Martin 25 Nov: players park their buses across the entrances and walk away). In the garage the
// server's own rule takes over: with the game nearly full, a garage idle for 30 s gives its place to someone new.
//
// Somebody is there when a key, a touch, the mouse or a controller does something, or when a pedal or a steering
// key is held. The car moving does not count: a bus left on the race road is shoved about by everyone who runs
// into it, and a car left on a slope rolls (Martin's picture of 25 Nov, a bus across Vallikraavi three hours
// after the first version, which took a car moving over 1 m/s for a driven one).
// After IDLE_S without any of that a countdown shows for WARN_S, and anything from the list above calls it off.
// A racer is judged like anyone else once the lights are out. Held on a grid (`wait`) the clock runs on but
// nothing is shown; the countdown then starts when the hold ends, always from its first figure.
// Not judged (`on` false): the garage, a spectator, and while the game itself holds the car (GETTING READY, a
// drop from the map). Pages from before this rule are put off the map by the server (idleCars in worker/index.js).
export const IDLE_S = 120, WARN_S = 15;

export function createIdlePark({ idle = IDLE_S, warn = WARN_S, show, hide, park }) {
  let last = performance.now();   // when somebody was last there
  let prev = last;                // the last frame that looked
  let fresh = false;              // a key, touch or mouse move since then
  let told = 0;                   // the countdown figure on screen (0: none)
  let mx = NaN, my = NaN;
  const calm = () => { if (told) { told = 0; hide(); } };
  const wake = () => { fresh = true; calm(); };
  const opt = { passive: true, capture: true };
  for (const ev of ['keydown', 'pointerdown', 'touchstart', 'wheel']) addEventListener(ev, wake, opt);
  // (the mouse really moved: a browser also sends a move when the page changes under a pointer lying still)
  addEventListener('pointermove', (e) => { if (e.screenX !== mx || e.screenY !== my) { mx = e.screenX; my = e.screenY; wake(); } }, opt);
  document.addEventListener('visibilitychange', wake);

  return {
    get left() { return told; },
    // once a frame. used: a controller did something this frame (src/controls/pads.js acted())
    // wait: held on a race or stage grid
    update(on, ctl, used = false, wait = false) {
      const now = performance.now();
      // (no frames for a while, as in a hidden tab or a sleeping laptop: that time is not counted, so the
      // countdown is always seen in full)
      if (now - prev > 2000) last += now - prev;
      prev = now;
      const act = fresh || used || !on || ctl.up > 0.05 || ctl.down > 0.05 || !!ctl.handbrake || !!ctl.look
        || (ctl.steer === undefined && !!(ctl.left || ctl.right));
      fresh = false;
      if (act) { last = now; calm(); return; }
      if (wait) { calm(); return; }
      if (!told && now - last > idle * 1000) last = now - idle * 1000;
      const quiet = (now - last) / 1000;
      if (quiet < idle) return;
      if (quiet >= idle + warn) { told = 0; hide(); last = now; park(); return; }
      const n = Math.ceil(idle + warn - quiet);
      if (n !== told) { told = n; show(n); }
    },
  };
}
