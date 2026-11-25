// Game controllers on desktop: Xbox / PlayStation pads and steering wheels with pedals, read through
// the browser's Gamepad API every frame. They give gradual throttle, brake and steering where the
// keyboard only has full on or off. Phones and touch screens never use any of this.
//
// Every controller has a profile, kept per browser in localStorage (kvissuroam.pads, keyed by the
// controller's id): which axis or button steers, throttles and brakes and its resting and full
// values (from the calibration in the CONTROLS screen, src/controls/setup.js), the dead zone,
// sensitivity and response curve, and which button does what. A pad the browser reports in its
// "standard" layout works straight away with the defaults below; a wheel steers on axis 0 out of the
// box and needs the calibration for its pedals, whose axes differ by model and system.
//
// Which one drives: INPUT in the options (kvissuroam.input). AUTO uses whatever was touched last,
// KEYBOARD ignores controllers, CONTROLLER ignores the driving keys (unless no controller is plugged in).

const STORE = 'kvissuroam.pads';
const MODE_KEY = 'kvissuroam.input';

// what the buttons can do; `held` ones act while the button is down, the rest once per press
export const ACTIONS = [
  { id: 'gearUp', label: 'GEAR UP' },
  { id: 'gearDown', label: 'GEAR DOWN' },
  { id: 'handbrake', label: 'HANDBRAKE', held: true },
  { id: 'look', label: 'LOOK BACK', held: true },
  // (a car with thrusters only, src/cars/thrust.js)
  { id: 'boost', label: 'BOOST (ROCKET)', held: true },
  { id: 'flip', label: 'FLIP (ROCKET)', held: true },
  { id: 'view', label: 'DRONE VIEW' },
  { id: 'reset', label: 'LAST SPOT' },
  { id: 'home', label: 'BACK TO START' },
  { id: 'map', label: 'MAP' },
  { id: 'laps', label: 'LAP TIMES' },
  { id: 'options', label: 'OPTIONS' },
  { id: 'garage', label: 'GARAGE' },
];

// the standard layout: 0 A/✕ 1 B/○ 2 X/□ 3 Y/△ 4 LB 5 RB 6 LT 7 RT 8 View/Share 9 Menu/Options
// 10 L3 11 R3 12-15 d-pad up, down, left, right
const PAD_BUTTONS = { gearUp: 1, gearDown: 2, handbrake: 0, look: 5, view: 3, reset: 4, home: 13, map: 8, laps: 12, options: 9, garage: -1, boost: 11, flip: 15 };
const XBOX = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →', 'HOME'];
const PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →', 'PS'];

const WHEEL_RE = /wheel|racing|G2[579]|G9[0-9]{2}|G923|driving force|thrustmaster|T150|T248|T300|T500|TMX|T-GT|fanatec|moza|simagic|logitech g pro|0+46d.*c2(4f|62|6[0-9a-f])/i;
export function guessKind(id) { return WHEEL_RE.test(id) ? 'wheel' : 'pad'; }
export function family(id) {
  if (/045e|xbox|xinput|x-box/i.test(id)) return 'xbox';
  if (/054c|dualshock|dualsense|playstation|^wireless controller|ps[345]/i.test(id)) return 'ps';
  return '';
}
// a short readable name for the controller ("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)")
export function shortName(id) {
  const s = String(id).replace(/\(.*?\)/g, '').replace(/[0-9a-f]{4}-[0-9a-f]{4}-/i, '').replace(/\s+/g, ' ').trim();
  return (s || 'Controller').slice(0, 40);
}
export function buttonName(gp, i) {
  if (i == null || i < 0) return '–';
  if (gp?.mapping === 'standard') { const f = family(gp.id); return (f === 'ps' ? PS : XBOX)[i] || `BUTTON ${i + 1}`; }
  return `BUTTON ${i + 1}`;
}

export function defaultProfile(gp, kind = guessKind(gp.id)) {
  const std = gp.mapping === 'standard';
  const wheel = kind === 'wheel';
  return {
    kind,
    // steering: the axis, its value at full left, centre and full right
    steer: { src: { t: 'a', i: 0 }, l: -1, c: 0, r: 1 },
    // pedals: an axis or an analogue button, its value at rest and fully pressed
    thr: std ? { src: { t: 'b', i: 7 }, rest: 0, full: 1 } : null,
    brk: std ? { src: { t: 'b', i: 6 }, rest: 0, full: 1 } : null,
    dead: wheel ? 0.01 : 0.08,       // steering dead zone (share of the travel)
    sens: 1,                         // steering sensitivity
    curve: wheel ? 1 : 1.5,          // response curve: 1 straight, higher is gentler round the centre
    pedalDead: 0.04,
    direct: wheel,                   // a wheel turns the front wheels by its own angle; a stick asks for a share of the grip
    bars: wheel,                     // small pedal bars by the rev counter while driving
    btn: std ? { ...PAD_BUTTONS } : Object.fromEntries(ACTIONS.map((a) => [a.id, -1])),
    calibrated: false,
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const readSrc = (gp, src) => {
  if (!src) return null;
  if (src.t === 'a') return gp.axes[src.i] ?? null;
  const b = gp.buttons[src.i];
  return b ? (typeof b === 'object' ? b.value : b) : null;
};
export function pedal(gp, p, dead) {
  if (!p) return 0;
  const v = readSrc(gp, p.src);
  if (v == null || p.full === p.rest) return 0;
  const x = clamp01((v - p.rest) / (p.full - p.rest));
  return x <= dead ? 0 : clamp01((x - dead) / (1 - dead * 2));
}
// the raw steering share, -1 (full left) .. 1 (full right), before dead zone and curve
export function steerRaw(gp, s) {
  if (!s) return 0;
  const v = readSrc(gp, s.src);
  if (v == null) return 0;
  const d = v - s.c, dl = s.l - s.c, dr = s.r - s.c;
  let x = 0;
  if (dl && d * dl > 0) x = -d / dl;
  else if (dr && d * dr > 0) x = d / dr;
  return Math.max(-1, Math.min(1, x));
}
export function shapeSteer(x, prof) {
  const a = Math.abs(x);
  if (a <= prof.dead) return 0;
  const u = Math.min(1, ((a - prof.dead) / (1 - prof.dead)) * prof.sens);
  return Math.sign(x) * Math.pow(u, prof.curve);
}
const pressed = (b) => !!b && (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5);

export function createPads({ enabled = true, toast = () => {} } = {}) {
  let profiles = {};
  try { profiles = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { profiles = {}; }
  let mode = 'auto';
  try { const m = localStorage.getItem(MODE_KEY); if (m === 'kb' || m === 'pad') mode = m; } catch { /* private mode */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(profiles)); } catch { /* private mode */ } };

  const state = { up: 0, down: 0, left: 0, right: 0, steer: 0, handbrake: 0, look: 0, boost: 0, flip: 0, steerDirect: false };
  const prevBtn = new Map();      // gamepad index -> pressed flags of last frame
  const actionFns = new Map();
  const changeFns = [];
  let active = null;               // the controller that last did something: { index, id }
  let padAt = -1, keyAt = 0;       // when a controller / the keyboard was last used (performance.now)
  let capture = null;              // the setup screen wants the next button press
  let quiet = false;               // buttons do nothing (the setup screen is open)
  const known = new Set();

  const list = () => (enabled && navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected !== false) : []);
  const profileOf = (gp) => {
    const prof = profiles[gp.id] || (profiles[gp.id] = defaultProfile(gp));
    // (a profile saved before an action existed gets it: on its usual button when that one is still free)
    for (const a of ACTIONS) {
      if (prof.btn[a.id] !== undefined) continue;
      const d = gp.mapping === 'standard' ? PAD_BUTTONS[a.id] ?? -1 : -1;
      prof.btn[a.id] = d >= 0 && !Object.values(prof.btn).includes(d) ? d : -1;
    }
    return prof;
  };
  const emit = () => { for (const f of changeFns) f(); };

  if (enabled) {
    addEventListener('gamepadconnected', (e) => {
      const gp = e.gamepad;
      if (known.has(gp.id + gp.index)) return;
      known.add(gp.id + gp.index);
      const prof = profileOf(gp);
      const ready = prof.thr && prof.brk;
      toast(ready ? `${prof.kind === 'wheel' ? 'WHEEL' : 'CONTROLLER'} CONNECTED · ${shortName(gp.id).toUpperCase()}`
        : `${prof.kind === 'wheel' ? 'WHEEL' : 'CONTROLLER'} CONNECTED · SET UP ITS PEDALS IN GARAGE › CONTROLS`, 4200);
      emit();
    });
    addEventListener('gamepaddisconnected', (e) => {
      known.delete(e.gamepad.id + e.gamepad.index);
      prevBtn.delete(e.gamepad.index);
      if (active?.index === e.gamepad.index) { active = null; padAt = -1; }
      toast('CONTROLLER DISCONNECTED', 2200);
      emit();
    });
  }

  // read one controller into steer / throttle / brake, plus whether anything on it moved
  function read(gp) {
    const prof = profileOf(gp);
    const steer = shapeSteer(steerRaw(gp, prof.steer), prof);
    const thr = pedal(gp, prof.thr, prof.pedalDead), brk = pedal(gp, prof.brk, prof.pedalDead);
    return { gp, prof, steer, thr, brk };
  }

  function poll(drive) {
    const pads = list();
    const wasPad = padAt > keyAt;
    let use = null, changed = false;
    for (const gp of pads) {
      const r = read(gp);
      const prof = r.prof;
      const was = prevBtn.get(gp.index) || [];
      const now = gp.buttons.map(pressed);
      prevBtn.set(gp.index, now);
      let moved = Math.abs(r.steer) > 0.25 || r.thr > 0.1 || r.brk > 0.1;
      for (let i = 0; i < now.length; i++) {
        if (!now[i] || was[i]) continue;
        // (a pedal on a button, such as a pad's triggers, is not a button press)
        if ((prof.thr?.src.t === 'b' && prof.thr.src.i === i) || (prof.brk?.src.t === 'b' && prof.brk.src.i === i)) continue;
        moved = true;
        if (capture) { const c = capture; capture = null; c(gp, i); continue; }
        if (quiet || mode === 'kb') continue;
        for (const a of ACTIONS) if (!a.held && prof.btn[a.id] === i) actionFns.get(a.id)?.(gp);
        actionFns.get('button')?.(gp, i);
      }
      if (moved) {
        if (active?.index !== gp.index) { active = { index: gp.index, id: gp.id }; changed = true; }
        padAt = performance.now();
      }
      if (active?.index === gp.index) use = r;
    }
    if (!use && pads.length && mode === 'pad') use = read(pads[0]);
    if (changed || wasPad !== padAt > keyAt) emit();
    const padDrives = !!use && mode !== 'kb' && (mode === 'pad' || padAt > keyAt);
    if (padDrives && drive) {
      const p = use.prof, g = use.gp;
      state.up = use.thr; state.down = use.brk; state.steer = use.steer; state.steerDirect = !!p.direct;
      state.left = Math.max(0, -use.steer); state.right = Math.max(0, use.steer);
      state.handbrake = p.btn.handbrake >= 0 && pressed(g.buttons[p.btn.handbrake]) ? 1 : 0;
      state.look = p.btn.look >= 0 && pressed(g.buttons[p.btn.look]) ? 1 : 0;
      state.boost = p.btn.boost >= 0 && pressed(g.buttons[p.btn.boost]) ? 1 : 0;
      state.flip = p.btn.flip >= 0 && pressed(g.buttons[p.btn.flip]) ? 1 : 0;
    }
    return padDrives ? use : null;
  }

  return {
    state,
    poll,
    list,
    profileOf,
    read,
    save,
    on(action, fn) { actionFns.set(action, fn); },
    onChange(fn) { changeFns.push(fn); },
    reset(gp, kind) { profiles[gp.id] = defaultProfile(gp, kind); save(); emit(); return profiles[gp.id]; },
    capture(fn) { capture = fn; },
    cancelCapture() { capture = null; },
    set quiet(v) { quiet = !!v; },
    get mode() { return mode; },
    setMode(m) {
      mode = m === 'kb' || m === 'pad' ? m : 'auto';
      try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode */ }
      emit();
    },
    keyUsed() { const was = padAt > keyAt; keyAt = performance.now(); if (was) emit(); },
    // the controller now driving (or the one to show hints for), and its profile
    get active() {
      if (!enabled || mode === 'kb') return null;
      const pads = list();
      const gp = pads.find((g) => g.index === active?.index) || (mode === 'pad' ? pads[0] : null);
      if (!gp || (mode === 'auto' && !(padAt > keyAt))) return null;
      return { gp, prof: profileOf(gp) };
    },
    get connected() { return list().length; },
  };
}
