// Spectator mode with two browsers in the same lobby (src/spectate.js). Needs the game and its server on
// :8787 (npx wrangler dev --port 8787) and Playwright. Usage: node tools/spectate-test.mjs [picture dir]
// A (desktop) clicks B in the online list: the camera must follow B's car across the map, A's own car stays
// put and stops sending, B's list shows A as watching and B's own line "1 WATCHING"; then B goes to the
// garage and comes back, Esc returns A, and a click on B's arrow on the minimap watches again.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const dir = process.argv[2] || '.';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car, name) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERR', name, e.message));
  await p.addInitScript((n) => { localStorage.setItem('kvissuroam.name', n); }, name);
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const key = (p, type, code) => p.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true })), [type, code]);
const place = (p, i) => p.evaluate(([x, z, a, b]) => __game.place({ x, z, yaw: Math.atan2(a - x, -(b - z)) }), [P[i][0], P[i][1], P[i + 3][0], P[i + 3][1]]);
const shot = async (p, f) => {
  await p.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${dir}/${f}` });
  await p.evaluate(() => { __game.renderer.render = () => {}; });
};
const state = (p) => p.evaluate(() => {
  const g = __game, w = g.watch(), c = g.car, cam = g.camera.position;
  return { watching: w?.id || null, view: !!w?.view, cam: [cam.x | 0, cam.z | 0], car: [c.x | 0, c.z | 0], speed: Math.hypot(c.vx, c.vy).toFixed(2),
    pill: !document.querySelector('#watch')?.classList.contains('hidden'), who: document.querySelector('#watch .who')?.textContent,
    me: document.querySelector('#people .me')?.textContent, list: [...document.querySelectorAll('#people .who li')].map((l) => l.textContent) };
});
const ok = (cond, what) => { console.log(cond ? 'PASS' : 'FAIL', what); if (!cond) process.exitCode = 1; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const [ba, A] = await open('w201', 'Watcher');
const [bb, B] = await open('m3', 'Driver');
console.log('both driving', process.uptime() | 0);
await place(A, 100); await place(B, 1500);
await A.waitForTimeout(4000);
await key(B, 'keydown', 'ArrowUp');
await A.waitForFunction(() => document.querySelector('#people .who li[data-id]'), null, { timeout: 30000 });
await A.click('#people .who li[data-id]');
await A.waitForFunction(() => __game.watch().view, null, { timeout: 120000 });
await A.waitForTimeout(3000);
let a = await state(A), bpos = await B.evaluate(() => [__game.car.x | 0, __game.car.z | 0]);
console.log('A', JSON.stringify(a), 'B at', bpos);
ok(a.watching && a.pill, 'A watches B, pill shown');
ok(dist(a.cam, bpos) < 40, `A's camera follows B (${dist(a.cam, bpos).toFixed(0)} m)`);
ok(dist(a.car, [P[100][0], P[100][1]]) < 3 && +a.speed < 0.1, "A's own car parked where it was");
const b = await state(B);
console.log('B', JSON.stringify(b));
ok(/1 WATCHING/.test(b.me), 'B sees 1 WATCHING');
ok(b.list.some((l) => /watching/i.test(l)), "B's list shows A watching");
await shot(A, 'spectate-a.png');
// B to the garage and back
await key(B, 'keyup', 'ArrowUp');
await B.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' })));
await A.waitForTimeout(8000);
a = await state(A);
console.log('B in garage, A:', JSON.stringify(a));
ok(a.watching && /GARAGE|OFF THE MAP/.test(a.who), 'A waits on B in the garage');
await B.evaluate(() => __game.startDriving());
await A.waitForTimeout(5000);
a = await state(A);
ok(a.watching && !/GARAGE/.test(a.who), 'B back, A follows again');
// Esc back
await key(A, 'keydown', 'Escape');
await A.waitForTimeout(1500);
a = await state(A);
console.log('after Esc', JSON.stringify(a));
ok(!a.watching && !a.pill && dist(a.cam, a.car) < 30 && (await A.evaluate(() => __game.mode)) === 'drive', 'Esc: back in own car, still driving (no garage)');
// B close to A: a click on B's arrow on the minimap
await B.evaluate(([x, z]) => __game.place({ x: x + 30, z, yaw: 0 }), [a.car[0], a.car[1]]);
await A.waitForTimeout(4000);
const clicked = await A.evaluate(() => {
  const c = document.querySelector('#minimap'), r = c.getBoundingClientRect();
  // the overlay's hit list is not exposed: scan the minimap with clicks until one watches
  for (let y = 0; y < r.height; y += 8) for (let x = 0; x < r.width; x += 8) {
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + x, clientY: r.top + y }));
    if (__game.watch().id) return [x, y];
    if (__game.bigmap().isOpen) { __game.bigmap().hide(); }
  }
  return null;
});
ok(!!clicked, `minimap arrow click watches (${clicked})`);
await A.waitForTimeout(1500);
// arrow keys: only one other player, so right goes back to our own car
await key(A, 'keydown', 'ArrowRight');
await A.waitForTimeout(800);
a = await state(A);
ok(!a.watching, 'arrow key cycles back to own car');
await ba.close(); await bb.close();
