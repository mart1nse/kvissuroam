// Keyboard (arrow keys) and on-screen touch pedals. Both write into one state object.

export function createInput(root) {
  // (boost and flip: a car with thrusters, src/cars/thrust.js; they do nothing in any other car)
  const state = { up: 0, down: 0, left: 0, right: 0, handbrake: 0, look: 0, boost: 0, flip: 0 };
  // Arrow keys drive. By default A and Z shift gears (see main.js); WASD mode (the options panel) makes
  // W/A/S/D drive instead and leaves the gearbox to the automatic. B is held to look back.
  const keys = new Map([
    ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
    ['Space', 'handbrake'], ['KeyB', 'look'], ['ShiftLeft', 'boost'], ['ShiftRight', 'boost'], ['KeyQ', 'boost'], ['KeyX', 'flip'],
  ]);
  const WASD = [['KeyW', 'up'], ['KeyA', 'left'], ['KeyS', 'down'], ['KeyD', 'right']];
  let wasd = false;
  const actions = new Map();   // code -> callback
  let enabled = false;

  // (what the keys hold and what the pointers hold are kept apart: a mouse press on BOOST in the rev counter must
  // not let go of the arrow key that is held meanwhile)
  const typed = new Set();
  const held = new Map();      // pointerId -> control (the pointers, further down)
  window.addEventListener('keydown', (e) => {
    if (!enabled) return;
    const k = keys.get(e.code);
    if (k) { typed.add(e.code); state[k] = 1; e.preventDefault(); return; }
    const a = actions.get(e.code);
    if (a && !e.repeat) { a(); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = keys.get(e.code);
    typed.delete(e.code);
    if (k) state[k] = byKey(k) || new Set(held.values()).has(k) ? 1 : 0;
  });
  window.addEventListener('blur', () => { typed.clear(); for (const k in state) state[k] = 0; });
  const byKey = (k) => { for (const c of typed) if (keys.get(c) === k) return true; return false; };

  // touch pedals: any element with data-ctl="up|down|left|right" (and a Rocket's BOOST and FLIP, which are also in
  // the rev counter for a mouse)
  const refresh = () => {
    const on = new Set(held.values());
    for (const k of ['up', 'down', 'left', 'right', 'boost', 'flip']) {
      state[k] = on.has(k) || byKey(k) ? 1 : 0;
      for (const el of root.querySelectorAll(`[data-ctl="${k}"]`)) el.classList.toggle('held', on.has(k));
    }
  };
  const ctlAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-ctl]')?.dataset.ctl;
  root.addEventListener('pointerdown', (e) => {
    const c = e.target.closest?.('[data-ctl]')?.dataset.ctl;
    if (!c) return;
    e.preventDefault();
    held.set(e.pointerId, c);
    refresh();
  });
  // sliding a thumb between the two steering buttons switches direction
  window.addEventListener('pointermove', (e) => {
    if (!held.has(e.pointerId)) return;
    const cur = held.get(e.pointerId);
    const c = ctlAt(e.clientX, e.clientY);
    const steer = (v) => v === 'left' || v === 'right';
    if (c && c !== cur && steer(c) === steer(cur)) { held.set(e.pointerId, c); refresh(); }
  });
  const release = (e) => { if (held.delete(e.pointerId)) refresh(); };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  // Holding a pedal is a long press to a phone's browser: Chrome on Android (and the Xiaomi browser)
  // buzzes the phone for it, and may try to select text or drag the button. Cancelling the touch where
  // it starts on a pedal stops the browser from treating it as a press at all; the pointer events above
  // still come. Only the pedals: taps elsewhere (the HUD buttons, the hologram on the 3D view) need
  // their clicks. The game itself never vibrates.
  const onPedal = (e) => e.target.closest?.('[data-ctl], .pad');
  root.addEventListener('touchstart', (e) => { if (e.cancelable && onPedal(e)) e.preventDefault(); }, { passive: false });
  for (const ev of ['selectstart', 'dragstart']) root.addEventListener(ev, (e) => { if (onPedal(e)) e.preventDefault(); });

  return {
    state,
    on(code, fn) { actions.set(code, fn); },
    // a controller button standing in for a key (src/controls/pads.js)
    press(code) { if (enabled) actions.get(code)?.(); },
    get wasd() { return wasd; },
    setWasd(v) {
      wasd = !!v;
      for (const [code, k] of WASD) { if (wasd) keys.set(code, k); else keys.delete(code); }
      typed.clear();
      for (const k in state) state[k] = 0;
    },
    enable(v) { enabled = v; if (!v) { typed.clear(); for (const k in state) state[k] = 0; held.clear(); refresh(); } },
  };
}
