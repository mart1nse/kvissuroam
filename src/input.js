// Keyboard (arrow keys) and on-screen touch pedals. Both write into one state object.

export function createInput(root) {
  const state = { up: 0, down: 0, left: 0, right: 0, handbrake: 0 };
  const keys = new Map([
    ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
    ['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'], ['Space', 'handbrake'],
  ]);
  const actions = new Map();   // code -> callback
  let enabled = false;

  window.addEventListener('keydown', (e) => {
    if (!enabled) return;
    const k = keys.get(e.code);
    if (k) { state[k] = 1; e.preventDefault(); return; }
    const a = actions.get(e.code);
    if (a && !e.repeat) { a(); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = keys.get(e.code);
    if (k) state[k] = 0;
  });
  window.addEventListener('blur', () => { for (const k in state) state[k] = 0; });

  // touch pedals: any element with data-ctl="up|down|left|right"
  const held = new Map();      // pointerId -> control
  const refresh = () => {
    const on = new Set(held.values());
    for (const k of ['up', 'down', 'left', 'right']) {
      state[k] = on.has(k) ? 1 : 0;
      root.querySelector(`[data-ctl="${k}"]`)?.classList.toggle('held', on.has(k));
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

  return {
    state,
    on(code, fn) { actions.set(code, fn); },
    enable(v) { enabled = v; if (!v) { for (const k in state) state[k] = 0; held.clear(); refresh(); } },
  };
}
