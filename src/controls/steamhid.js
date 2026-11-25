// Valve's Steam Controller (the 2026 one) read straight from the browser, without Steam.
//
// On its own the controller is a mouse and a keyboard to the computer ("lizard mode") and no browser
// lists it as a gamepad; it only becomes one through Steam (Steam Input makes an Xbox-style pad for a
// program started from Steam, and that one the Gamepad API shows like any other). Chrome and Edge can
// talk to it directly though (WebHID): its own report carries the sticks, the triggers and every
// button including the four back grips, which Steam's stand-in pad does not pass on. This file opens
// the controller the player picks in the CONTROLS screen and shows it to src/controls/pads.js as one
// more gamepad in the standard layout, with the extras after the usual seventeen buttons.
//
// The report layout and the commands are Valve's, as published in SDL (SDL_hidapi_steam_triton.c and
// steam/controller_structs.h): reports 0x42 (cable), 0x45 (Bluetooth) and 0x47 (newer firmware) start
// alike: a count, 32 button bits, two triggers and two sticks as 16-bit numbers. While the game has
// the window, the controller is told every 3 s to stop being a mouse (it goes back by itself a moment
// after the telling stops, so nothing has to be undone when the page closes).
//
// Nothing here runs per frame unless such a controller is connected: a report only leaves its bytes
// behind (and the buttons seen, so a tap shorter than a frame still counts), read once in `sync`.

const VALVE = 0x28de;
// the controller on a cable, over Bluetooth, and the two wireless pucks (one puck serves up to four)
const PRODUCTS = [0x1302, 0x1303, 0x1304, 0x1305];
const STATE = new Set([0x42, 0x45, 0x47]);
const WIRELESS = new Set([0x46, 0x79]);      // a puck saying a controller came (2) or went (1)
const STATE_BYTES = 17;                      // count 1, buttons 4, triggers 2 x 2, sticks 4 x 2

// the report's button bits in the standard layout's order (0 A, 1 B, 2 X, 3 Y, 4 L1, 5 R1, 6 L2, 7 R2,
// 8 View, 9 Menu, 10 L3, 11 R3, 12-15 d-pad, 16 Steam), then the extras: 17 L4, 18 R4, 19 L5, 20 R5
// (the back grips), 21 the "…" button, 22 and 23 the left and right trackpad pressed down
const BITS = [0x1, 0x2, 0x4, 0x8, 0x80000, 0x200, 0, 0, 0x4000, 0x40, 0x8000, 0x20, 0x2000, 0x400, 0x1000, 0x800,
  0x10000, 0x20000, 0x80, 0x40000, 0x100, 0x10, 0x4000000, 0x400000];
export const STEAM_L4 = 17, STEAM_R4 = 18;

const blankPad = (index, product) => ({
  id: `Steam Controller (direct · Vendor: 28de Product: ${product.toString(16).padStart(4, '0')})`,
  index, connected: true, mapping: 'standard', direct: true, timestamp: 0,
  axes: [0, 0, 0, 0],
  buttons: BITS.map(() => ({ pressed: false, touched: false, value: 0 })),
});

// one state report (without its id byte) into a gamepad object; `also` are button bits seen since the
// last reading
export function readState(view, gp, also = 0) {
  if (!view || view.byteLength < STATE_BYTES) return false;
  const bits = (view.getUint32(1, true) | also) >>> 0;
  const b = gp.buttons;
  for (let i = 0; i < BITS.length; i++) {
    if (!BITS[i]) continue;
    const on = (bits & BITS[i]) !== 0;
    b[i].pressed = b[i].touched = on; b[i].value = on ? 1 : 0;
  }
  for (let k = 0; k < 2; k++) {
    const v = Math.max(0, Math.min(1, view.getInt16(5 + k * 2, true) / 32767));
    b[6 + k].value = v; b[6 + k].pressed = b[6 + k].touched = v > 0.5;
  }
  // (the controller counts up as up; a gamepad's axis counts down as up)
  const ax = (o, sign) => Math.max(-1, Math.min(1, (sign * view.getInt16(o, true)) / 32767));
  gp.axes[0] = ax(9, 1); gp.axes[1] = ax(11, -1); gp.axes[2] = ax(13, 1); gp.axes[3] = ax(15, -1);
  return true;
}
function rest(gp) {
  for (const b of gp.buttons) { b.pressed = b.touched = false; b.value = 0; }
  gp.axes.fill(0);
}

// "stop being a mouse": feature report 1, set settings (0x87), 3 bytes: setting 9 (lizard mode) = 0
const CALM = new Uint8Array(63);
CALM.set([0x87, 3, 9, 0, 0]);

export function createSteamHid({ onAdd = () => {}, onRemove = () => {} } = {}) {
  const hid = typeof navigator !== 'undefined' ? navigator.hid : null;
  const pads = [];                 // the controllers now showing, as gamepad objects
  const slots = new Map();         // HIDDevice -> { dev, gp, raw, seen, at }
  let nextIndex = 100;             // well clear of the browser's own gamepad numbers
  let timer = 0;

  const here = () => document.visibilityState === 'visible' && document.hasFocus();
  const calm = (s) => { if (s.dev.opened) s.dev.sendFeatureReport(1, CALM).catch(() => {}); };
  function show(s) {
    if (s.gp) return;
    s.gp = blankPad(nextIndex++, s.dev.productId);
    pads.push(s.gp);
    onAdd(s.gp);
  }
  function hide(s) {
    if (!s.gp) return;
    const gp = s.gp;
    s.gp = null; s.raw = null; s.seen = 0;
    gp.connected = false;
    pads.splice(pads.indexOf(gp), 1);
    onRemove(gp);
  }
  function report(s, e) {
    if (STATE.has(e.reportId)) {
      if (e.data.byteLength < STATE_BYTES) return;
      s.raw = e.data;
      s.seen |= e.data.getUint32(1, true);
      s.at = e.timeStamp;
      if (!s.gp) { show(s); if (here()) calm(s); }
    } else if (WIRELESS.has(e.reportId) && e.data.byteLength >= 1) {
      const st = e.data.getUint8(0);
      if (st === 1) hide(s); else if (st === 2) { show(s); if (here()) calm(s); }
    }
  }
  async function adopt(devices) {
    let n = 0;
    for (const dev of devices) {
      if (dev.vendorId !== VALVE || !PRODUCTS.includes(dev.productId) || slots.has(dev)) continue;
      // (its mouse and keyboard halves are not for us: only the part with Valve's own reports)
      if (dev.collections?.length && !dev.collections.some((c) => c.usagePage >= 0xff00)) continue;
      try { if (!dev.opened) await dev.open(); } catch { continue; }
      const s = { dev, gp: null, raw: null, seen: 0, at: 0 };
      slots.set(dev, s);
      dev.addEventListener('inputreport', (e) => report(s, e));
      n++;
    }
    if (slots.size && !timer) timer = setInterval(() => { if (here()) for (const s of slots.values()) if (s.gp) calm(s); }, 3000);
    return n;
  }
  function drop(dev) {
    const s = slots.get(dev);
    if (!s) return;
    hide(s);
    slots.delete(dev);
    if (!slots.size && timer) { clearInterval(timer); timer = 0; }
  }

  if (hid) {
    // a controller allowed on an earlier visit comes back without asking
    hid.getDevices?.().then(adopt).catch(() => {});
    hid.addEventListener?.('connect', (e) => { adopt([e.device]).catch(() => {}); });
    hid.addEventListener?.('disconnect', (e) => drop(e.device));
    addEventListener('focus', () => { for (const s of slots.values()) if (s.gp) calm(s); });
  }

  return {
    supported: !!hid,
    pads,
    // the browser's own window for picking the controller; needs a click. Resolves to how many parts
    // of it were opened (0: nothing picked, or the browser refused)
    async request() {
      if (!hid) return 0;
      const got = await hid.requestDevice({ filters: PRODUCTS.map((productId) => ({ vendorId: VALVE, productId })) });
      return adopt(got);
    },
    // bring the gamepad objects up to the newest reports (once a frame, from pads.js). A window that is
    // not in front reads as a controller at rest, as the browser's own gamepads do.
    sync() {
      const live = here();
      for (const s of slots.values()) {
        if (!s.gp) continue;
        if (!live) { rest(s.gp); s.seen = 0; continue; }
        if (s.raw && readState(s.raw, s.gp, s.seen)) s.gp.timestamp = s.at;
        s.seen = 0;
      }
    },
  };
}
