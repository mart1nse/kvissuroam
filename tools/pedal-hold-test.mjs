// Holding a touch pedal must not look like a long press to the phone's browser (Chrome on Android buzzes
// for a long press, Martin's Xiaomi 2026-11-21). Holds GAS for 1.5 s with a real touch on a landscape
// phone and checks: the pedal stays held, the browser does not cancel the touch or open a context menu,
// and the touch's start was cancelled (which is what keeps the browser from treating it as a press).
// Also slides a thumb from left to right steering and checks the hologram-style canvas still gets clicks.
// Run with the dev server on 5198: node tools/pedal-hold-test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:5198';
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/src/style.css"></head><body class="touch">
<canvas id="view"></canvas>
<div id="touch"><div class="pad left"><button data-ctl="left">◀</button><button data-ctl="right">▶</button></div>
<div class="pad right"><button data-ctl="down" class="brake">▼<small>BRAKE / REVERSE</small></button><button data-ctl="up" class="gas">▲<small>GAS</small></button></div></div>
<script type="module">
import { createInput } from '/src/input.js';
const input = createInput(document.body); input.enable(true);
const log = window.log = { contextmenu: 0, pointercancel: 0, startPrevented: [], viewClicks: 0, up: [], steer: [] };
addEventListener('contextmenu', () => log.contextmenu++, true);
addEventListener('pointercancel', () => log.pointercancel++, true);
addEventListener('touchstart', (e) => setTimeout(() => log.startPrevented.push(e.defaultPrevented)), true);
document.getElementById('view').addEventListener('click', () => log.viewClicks++);
setInterval(() => { log.up.push(input.state.up); log.steer.push(input.state.left ? 'L' : input.state.right ? 'R' : '-'); }, 100);
window.ready = true;
</script></body></html>`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.route('**/__pedal.html', (r) => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(base + '/__pedal.html');
await page.waitForFunction(() => window.ready);
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const mid = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const gas = await mid('[data-ctl="up"]'), left = await mid('[data-ctl="left"]'), right = await mid('[data-ctl="right"]');
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
// 1. hold GAS 1.5 s (a long press is about 0.5 s)
await page.evaluate(() => { log.up.length = 0; });
await touch('touchStart', [{ x: gas.x, y: gas.y, id: 1 }]);
await page.waitForTimeout(1500);
await touch('touchEnd', []);
await page.waitForTimeout(200);
let L = await page.evaluate(() => log);
const held = L.up.slice(1, 13);
console.log(`hold GAS 1.5 s: up ${held.join('')} | contextmenu ${L.contextmenu} | pointercancel ${L.pointercancel} | touch start cancelled ${L.startPrevented.join(',')}`);
if (held.some((v) => v !== 1)) fail('GAS dropped while held');
if (L.contextmenu || L.pointercancel) fail('the browser took the hold as a long press');
if (!L.startPrevented.every(Boolean)) fail('touch start on the pedal not cancelled');
// 2. hold left, slide to right, hold
await page.evaluate(() => { log.steer.length = 0; log.startPrevented.length = 0; });
await touch('touchStart', [{ x: left.x, y: left.y, id: 2 }]);
await page.waitForTimeout(700);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: left.x + (right.x - left.x) * i / 8, y: left.y, id: 2 }]); await page.waitForTimeout(16); }
await page.waitForTimeout(700);
await touch('touchEnd', []);
await page.waitForTimeout(200);
L = await page.evaluate(() => log);
const s = L.steer.join('');
console.log(`slide left > right: ${s} | contextmenu ${L.contextmenu} | pointercancel ${L.pointercancel}`);
if (!/L+.*R+/.test(s)) fail('steering slide did not switch from left to right');
if (L.contextmenu || L.pointercancel) fail('long press on steering');
// 3. a tap on the 3D view still clicks (the hologram links)
await page.touchscreen.tap(422, 120);
await page.waitForTimeout(200);
L = await page.evaluate(() => log);
console.log(`tap on the 3D view: clicks ${L.viewClicks}`);
if (L.viewClicks !== 1) fail('tap on the 3D view lost its click');
await browser.close();
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
