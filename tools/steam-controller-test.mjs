// A Steam Controller read directly by the browser (src/controls/steamhid.js), with a made-up controller
// standing in for the real one: the page's navigator.hid is replaced by one that hands out a device
// sending Valve's state reports (layout from SDL's SDL_hidapi_steam_triton.c).
// Checks: the report is read right (every button, the triggers, the sticks, a tap shorter than a frame);
// CONNECT in the CONTROLS screen brings it into the list and tells it to stop being a mouse, again
// every 3 s; in the garage its d-pad picks the car and A drives; driving, the stick steers, R2 is the
// throttle and L2 the brake, gradually; in the Rocket R4 is BOOST and L4 is FLIP and the hint says so;
// a controller seen twice (directly and as Steam's stand-in pad) does not swap every frame; unplugged,
// it leaves the list.
// Run with the dev server on 5198: node tools/steam-controller-test.mjs [folder for pictures]
import { createRequire } from 'node:module';
import { readState, createSteamHid } from '../src/controls/steamhid.js';
import { family, buttonName } from '../src/controls/pads.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:5198', shots = process.argv[2] || '';
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
const check = (what, cond, note = '') => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${note ? ` (${note})` : ''}`); if (!cond) ok = false; };

// ---- 1. the report, without a browser
const BIT = { A: 0x1, B: 0x2, X: 0x4, Y: 0x8, QAM: 0x10, R3: 0x20, VIEW: 0x40, R4: 0x80, R5: 0x100, R: 0x200, DOWN: 0x400, RIGHT: 0x800, LEFT: 0x1000, UP: 0x2000, MENU: 0x4000, L3: 0x8000, STEAM: 0x10000, L4: 0x20000, L5: 0x40000, L: 0x80000 };
function report({ buttons = 0, lt = 0, rt = 0, lx = 0, ly = 0, rx = 0, ry = 0 } = {}) {
  const v = new DataView(new ArrayBuffer(52));
  v.setUint32(1, buttons, true);
  v.setInt16(5, Math.round(lt * 32767), true); v.setInt16(7, Math.round(rt * 32767), true);
  v.setInt16(9, Math.round(lx * 32767), true); v.setInt16(11, Math.round(ly * 32767), true);
  v.setInt16(13, Math.round(rx * 32767), true); v.setInt16(15, Math.round(ry * 32767), true);
  return v;
}
console.log('the report');
{
  const gp = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 24 }, () => ({ pressed: false, touched: false, value: 0 })) };
  const want = { A: 0, B: 1, X: 2, Y: 3, L: 4, R: 5, MENU: 8, VIEW: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, STEAM: 16, L4: 17, R4: 18, L5: 19, R5: 20, QAM: 21 };
  let wrong = '';
  for (const [name, i] of Object.entries(want)) {
    readState(report({ buttons: BIT[name] }), gp);
    const on = gp.buttons.map((b, k) => (b.pressed ? k : -1)).filter((k) => k >= 0);
    if (on.length !== 1 || on[0] !== i) wrong += ` ${name}->${on}`;
  }
  check('each of the 20 buttons lands on its own place in the standard layout', !wrong, wrong);
  readState(report({ lt: 0.25, rt: 1, lx: -1, ly: 1, rx: 0.5, ry: -0.5 }), gp);
  check('triggers 0..1 on buttons 6 and 7', Math.abs(gp.buttons[6].value - 0.25) < 0.001 && gp.buttons[7].value === 1 && gp.buttons[7].pressed && !gp.buttons[6].pressed);
  check('sticks -1..1, up is minus as on a gamepad', gp.axes[0] === -1 && gp.axes[1] === -1 && Math.abs(gp.axes[2] - 0.5) < 0.001 && Math.abs(gp.axes[3] - 0.5) < 0.001, gp.axes.join(' '));
  readState(report(), gp, BIT.B);
  check('a tap that came and went between two frames still counts once', gp.buttons[1].pressed);
  check('a report cut short is left alone', readState(new DataView(new ArrayBuffer(8)), gp) === false);
  check('names: Steam\'s own', family('Microsoft X-Box 360 pad 0 (STANDARD GAMEPAD Vendor: 28de Product: 11ff)') === 'steam'
    && buttonName({ mapping: 'standard', id: 'Steam Controller (direct · Vendor: 28de Product: 1302)' }, 18) === 'R4'
    && buttonName({ mapping: 'standard', id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)' }, 4) === 'LB');
  check('no WebHID (Safari, Firefox): nothing offered, nothing breaks', createSteamHid().supported === false);
}

// ---- 2. in the game
// the made-up controller, put in before the page's own scripts. `kinds`: its parts as the browser would
// hand them out (the real one also has a mouse and a keyboard part, which must be left alone).
const fakeHid = () => {
  const listeners = {};
  const mk = (usagePage, productId = 0x1302) => {
    const d = new EventTarget();
    Object.assign(d, { vendorId: 0x28de, productId, productName: 'Steam Controller', opened: false, collections: [{ usagePage, usage: 1 }], sent: [],
      open: async () => { d.opened = true; }, close: async () => { d.opened = false; },
      sendFeatureReport: async (id, data) => { d.sent.push({ id, bytes: [...new Uint8Array(data.buffer || data)].slice(0, 5), at: performance.now() }); } });
    return d;
  };
  const pad = mk(0xff00), mouse = mk(0x01);
  const st = { buttons: 0, lt: 0, rt: 0, lx: 0, ly: 0 };
  let timer = 0;
  const send = (over) => {
    const s = { ...st, ...over };
    const v = new DataView(new ArrayBuffer(52));
    v.setUint32(1, s.buttons, true);
    v.setInt16(5, Math.round(s.lt * 32767), true); v.setInt16(7, Math.round(s.rt * 32767), true);
    v.setInt16(9, Math.round(s.lx * 32767), true); v.setInt16(11, Math.round(s.ly * 32767), true);
    const e = new Event('inputreport'); e.reportId = 0x42; e.data = v; e.device = pad;
    pad.dispatchEvent(e);
  };
  window.__sc = {
    pad, mouse, st, send, asked: 0, allowed: false,
    on() { if (!timer) timer = setInterval(() => { if (pad.opened) send(); }, 4); },
    off() { clearInterval(timer); timer = 0; },
    unplug() { this.off(); const e = new Event('disconnect'); e.device = pad; (listeners.disconnect || []).forEach((f) => f(e)); },
  };
  Object.defineProperty(navigator, 'hid', { configurable: true, value: {
    getDevices: async () => (window.__sc.allowed ? [pad, mouse] : []),
    requestDevice: async (o) => { window.__sc.asked++; window.__sc.filters = o.filters; window.__sc.allowed = true; return [mouse, pad]; },
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
  } });
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const until = (p, fn, ms, arg = null) => p.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true, () => false);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: shots ? 2 : 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail(`page error: ${e.message}`));
await p.addInitScript(fakeHid);
await p.goto(`${base}/?off=100&q=low&trees=old`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
// (drawing without a graphics card takes seconds a frame: only the frames a picture needs are drawn)
await p.evaluate(() => { const r = __game.renderer, real = r.render.bind(r); window.__draw = 0; r.render = (...a) => { if (window.__draw > 0) { window.__draw--; real(...a); } }; });
const shot = async (f) => {
  if (!shots) return;
  await p.evaluate(() => { window.__draw = 2; });
  await until(p, () => window.__draw === 0, 120000);
  await p.screenshot({ path: `${shots}/steam-controller-${f}.png`, timeout: 120000 });
};
const toast = () => p.evaluate(() => document.querySelector('#toast.show')?.textContent || '');

console.log('the CONTROLS screen');
await p.evaluate(() => __game.setup.open());
let row = await p.evaluate(() => document.querySelector('#ctlsetup [data-s=steam]')?.closest('.srow')?.textContent || '');
check('a Steam Controller row with CONNECT', /STEAM CONTROLLER/.test(row) && /CONNECT/.test(row));
await shot('1-controls');
await p.click('#ctlsetup [data-s=steam]');
await p.evaluate(() => __sc.on());
check('the controller shows in the list after its first report', await until(p, () => __game.pads.list().some((g) => g.direct), 5000));
await p.waitForTimeout(200);
let s = await p.evaluate(() => ({ asked: __sc.asked, filters: __sc.filters.map((f) => `${f.vendorId.toString(16)}:${f.productId.toString(16)}`).join(' '), mouseOpened: __sc.mouse.opened, sent: __sc.pad.sent,
  dev: document.querySelector('#ctlsetup .dev')?.textContent || '', row: !!document.querySelector('#ctlsetup [data-s=steam]'), n: __game.pads.list().length }));
check('asked the browser once, for Valve\'s four products', s.asked === 1 && s.filters === '28de:1302 28de:1303 28de:1304 28de:1305', s.filters);
check('its mouse and keyboard part left closed', !s.mouseOpened);
check('told to stop being a mouse: feature report 1 = 87 03 09 00 00', s.sent.length >= 1 && s.sent[0].id === 1 && s.sent[0].bytes.join(' ') === '135 3 9 0 0', JSON.stringify(s.sent[0]));
check('listed once as "Steam Controller · DIRECT · READY", the row gone', s.n === 1 && /Steam Controller/.test(s.dev) && /DIRECT · READY/.test(s.dev) && !s.row, s.dev);
console.log(`  toast: "${await toast()}"`);
await shot('2-connected');
// the buttons page names the grips
await p.evaluate(() => { document.querySelector('#ctlsetup .steps li[data-i="2"]').click(); });
const maps = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#ctlsetup .map')].map((b) => [b.dataset.a, b.querySelector('b').textContent])));
check('BOOST on R4, FLIP on L4, the rest as on any pad', maps.boost === 'R4' && maps.flip === 'L4' && maps.handbrake === 'A' && maps.gearUp === 'B' && maps.look === 'R1', JSON.stringify(maps));
await p.evaluate(() => { __sc.st.lx = -0.5; __sc.st.rt = 0.6; });
await p.waitForTimeout(300);
const bars = await p.evaluate(() => ({ thr: parseFloat(document.querySelector('#lthr').style.width), steer: parseFloat(document.querySelector('#lsteer').style.width) }));
check('the live bars follow the stick and the trigger', bars.thr > 50 && bars.thr < 70 && bars.steer > 5, JSON.stringify(bars));
await shot('3-buttons');
await p.evaluate(() => { __sc.st.lx = 0; __sc.st.rt = 0; });
await p.waitForTimeout(3300);
const again = await p.evaluate(() => __sc.pad.sent.length);
check('told again within 3 s (it turns back into a mouse otherwise)', again >= 2, `${again} times`);
await p.evaluate(() => __game.setup.close());

console.log('the garage');
const tap = async (bit) => { await p.evaluate((b) => { __sc.st.buttons |= b; }, bit); await p.waitForTimeout(250); await p.evaluate((b) => { __sc.st.buttons &= ~b; }, bit); await p.waitForTimeout(250); };
const hint0 = await p.evaluate(() => document.querySelector('#menu .keys')?.textContent || '');
check('the hint line names the controller\'s buttons', /R2 throttle/.test(hint0) && /L2 brake/.test(hint0) && /A handbrake/.test(hint0), hint0.slice(0, 90));
const picked = () => p.evaluate(() => localStorage.getItem('kvissuroam.car'));
const car0 = await picked();
await tap(BIT.RIGHT);
const car1 = await picked();
check('d-pad right picks the next car', car1 !== car0, `${car0} -> ${car1}`);
await p.evaluate(() => __game.setCar('rocket', true));
await tap(BIT.A);
check('A starts driving', await until(p, () => __game.mode === 'drive', 60000));

console.log('driving');
const drive = () => p.evaluate(() => { const c = __game.ctl; return { pad: c === __game.pads.state, up: c.up, down: c.down, steer: c.steer, boost: c.boost, flip: c.flip, hb: c.handbrake, car: __game.car.spec?.id }; });
await p.evaluate(() => { Object.assign(__sc.st, { rt: 0.5, lx: 0.6 }); });
await p.waitForTimeout(600);
s = await drive();
check('the controller drives: half throttle, steering right, gradually', s.pad && s.up > 0.4 && s.up < 0.6 && s.steer > 0.2 && s.steer < 0.9 && s.down === 0, JSON.stringify(s));
await p.evaluate(() => { Object.assign(__sc.st, { rt: 0, lt: 1, lx: -1, buttons: 0x1 }); });
await p.waitForTimeout(600);
s = await drive();
check('full brake, full left, A is the handbrake', s.down === 1 && s.steer === -1 && s.up === 0 && s.hb === 1, JSON.stringify(s));
await p.evaluate(() => { Object.assign(__sc.st, { lt: 0, lx: 0, buttons: 0x80 }); });
await p.waitForTimeout(600);
s = await drive();
check('R4 is BOOST', s.boost === 1 && s.flip === 0, JSON.stringify(s));
await p.evaluate(() => { __sc.st.buttons = 0x20000; });
await p.waitForTimeout(600);
s = await drive();
check('L4 is FLIP', s.flip === 1 && s.boost === 0, JSON.stringify(s));
await p.evaluate(() => { __sc.st.buttons = 0; });
console.log(`  car: ${s.car}`);
await shot('4-driving');

console.log('seen twice (directly and as Steam\'s stand-in pad)');
await p.evaluate(() => {
  // Steam's stand-in mirrors the same stick and triggers
  const twin = { id: 'Microsoft X-Box 360 pad 0 (STANDARD GAMEPAD Vendor: 28de Product: 11ff)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    get axes() { return [__sc.st.lx, 0, 0, 0]; },
    get buttons() { return Array.from({ length: 17 }, (_, i) => ({ pressed: false, touched: false, value: i === 7 ? __sc.st.rt : i === 6 ? __sc.st.lt : 0 })); } };
  navigator.getGamepads = () => [twin, null, null, null];
  const e = new Event('gamepadconnected'); e.gamepad = twin; dispatchEvent(e);
  window.__swaps = 0; __game.pads.onChange(() => { window.__swaps++; });
  Object.assign(__sc.st, { rt: 0.7, lx: 0.5 });
});
await p.waitForTimeout(1500);
s = await p.evaluate(() => ({ swaps: __swaps, active: __game.pads.active?.gp.id, n: __game.pads.list().length, up: __game.ctl.up }));
// (the stand-in may get its first move in a frame ahead and take over once; after that nothing changes hands)
check('two in the list, and they do not take turns every frame', s.n === 2 && s.swaps <= 1 && s.up > 0.6, JSON.stringify(s));
await p.evaluate(() => { Object.assign(__sc.st, { rt: 0, lx: 0 }); navigator.getGamepads = () => [null, null, null, null]; });

console.log('unplugged');
await p.evaluate(() => __sc.unplug());
await p.waitForTimeout(300);
s = await p.evaluate(() => ({ n: __game.pads.list().length, pad: __game.ctl === __game.pads.state, toast: document.querySelector('#toast.show')?.textContent || '' }));
check('gone from the list, the keys drive again', s.n === 0 && !s.pad && /DISCONNECTED/.test(s.toast), JSON.stringify(s));

await browser.close();
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
