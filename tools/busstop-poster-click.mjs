// The TOREPOOD poster on the bus shelters opens the shop (src/world/busstops.js bindClicks). Drives up to a stop
// as a desktop (mouse) and as a landscape phone (real touches), and checks: a click or tap on the poster opens
// the shop once, the mouse shows a hand over it, a tap beside it, a drag across it and a held pedal open nothing,
// and the pedals still drive. Needs the vite dev server: node tools/busstop-poster-click.mjs [base] [stop]
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const STOP = +(process.argv[3] || 143);
const D = JSON.parse(fs.readFileSync(new URL('../src/world/busstops.json', import.meta.url)));
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };

async function run(phone) {
  const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail('page error ' + e.message));
  await p.goto(`${base}/?drive&nointro`);
  await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
  await p.waitForTimeout(6000);
  const [x, z, yaw, L, gap, side, hw] = D.stops[STOP];
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  const W = (s, n) => [x + ux * s + nx * n, z + uz * s + nz * n];
  const kerb = -(1.55 / 2 + gap);
  const [cx, cz] = W(-12, kerb - hw * 0.5);
  await p.evaluate(async ([cx, cz, yaw]) => { await __game.world.loadAround(cx, cz, 300); __game.place({ x: cx, z: cz, yaw }); }, [cx, cz, Math.atan2(ux, -uz)]);
  await p.waitForTimeout(12000);
  // a camera standing in front of the poster
  const [ex, ez] = W(-L / 2 - 4.5, kerb + 0.2), [tx, tz] = W(-L / 2, 0);
  await p.evaluate(([ex, ez, tx, tz]) => { const y = __game.world.heightAt(tx, tz); window.__cam = [ex, y + 1.6, ez, tx, y + 1.3, tz, 55]; }, [ex, ez, tx, tz]);
  await p.waitForTimeout(4000);
  await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  // the poster's middle and a point a metre beside it, on the screen
  const [px, pz] = W(-L / 2 - 0.085, 0), [qx, qz] = W(-L / 2 - 0.085, 1.6);
  const pts = await p.evaluate(([px, pz, qx, qz]) => {
    const g = __game, cam = g.camera(), st = g.busStops().stops[+document.body.dataset.stop || 0];
    const r = document.getElementById('view').getBoundingClientRect();
    const scr = (x, y, z) => { const v = cam.position.clone().set(x, y, z).project(cam); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
    const y = g.world.heightAt(px, pz);
    return { on: scr(px, y + 1.25, pz), beside: scr(qx, y + 1.25, qz) };
  }, [px, pz, qx, qz]);
  const opened = () => p.evaluate(() => window.__opened.length);
  const tap = async (pt) => {
    if (phone) await p.touchscreen.tap(pt.x, pt.y);
    else await p.mouse.click(pt.x, pt.y);
    await p.waitForTimeout(400);
  };
  const tag = phone ? 'phone' : 'desktop';
  // 1. on the poster
  await tap(pts.on);
  let n = await opened();
  console.log(`${tag}: ${phone ? 'tap' : 'click'} on the poster opens ${n}`, n ? await p.evaluate(() => window.__opened[0]) : '');
  if (n !== 1) fail(`${tag}: poster did not open the shop once`);
  // 2. beside it
  await tap(pts.beside);
  if (await opened() !== 1) fail(`${tag}: a tap beside the poster opened it`);
  else console.log(`${tag}: beside the poster opens nothing`);
  // 3. a drag across the poster
  if (phone) {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts.on.x - 60, y: pts.on.y, id: 5 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts.on.x - 60 + i * 20, y: pts.on.y, id: 5 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await p.mouse.move(pts.on.x - 60, pts.on.y); await p.mouse.down();
    for (let i = 1; i <= 6; i++) await p.mouse.move(pts.on.x - 60 + i * 20, pts.on.y);
    await p.mouse.up();
  }
  await p.waitForTimeout(400);
  if (await opened() !== 1) fail(`${tag}: a drag across the poster opened it`);
  else console.log(`${tag}: a drag across the poster opens nothing`);
  // 4. the hand over it (desktop) / the pedals (phone)
  if (!phone) {
    await p.mouse.move(pts.on.x, pts.on.y); await p.waitForTimeout(200); await p.mouse.move(pts.on.x + 2, pts.on.y); await p.waitForTimeout(200);
    const c1 = await p.evaluate(() => document.getElementById('view').style.cursor);
    await p.mouse.move(pts.beside.x, pts.beside.y); await p.waitForTimeout(200); await p.mouse.move(pts.beside.x + 2, pts.beside.y); await p.waitForTimeout(200);
    const c2 = await p.evaluate(() => document.getElementById('view').style.cursor);
    console.log(`desktop: cursor over the poster "${c1}", beside it "${c2}"`);
    if (c1 !== 'pointer' || c2 === 'pointer') fail('desktop: hover hand wrong');
  } else {
    const box = await p.locator('[data-ctl="up"]').boundingBox();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 7 }] });
    await p.waitForTimeout(600);
    const up = await p.evaluate(() => __game.ctl.up);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(300);
    console.log(`phone: GAS held gives up=${up}, opened ${await opened() - 1} more`);
    if (up !== 1) fail('phone: GAS did not drive');
    if (await opened() !== 1) fail('phone: the pedal opened the shop');
  }
  await ctx.close();
}
await run(false);
await run(true);
await b.close();
console.log(ok ? 'ALL OK' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
