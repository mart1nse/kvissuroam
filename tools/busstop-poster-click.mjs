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
  p.on('console', (m) => { if (m.type() === 'error') console.log('  console error', m.text().slice(0, 200)); });
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
    const g = __game, cam = g.camera, st = g.busStops().stops[+document.body.dataset.stop || 0];
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
    // the inside face, seen from the bench
    const [ix, iz] = W(-L / 2 + 2.6, 0.25), [jx, jz] = W(-L / 2 + 0.085, 0);
    const pin = await p.evaluate(async ([ix, iz, jx, jz]) => {
      const y = __game.world.heightAt(jx, jz); window.__cam = [ix, y + 1.5, iz, jx, y + 1.25, jz, 55];
      await new Promise((r) => setTimeout(r, 1500));
      const cam = __game.camera, r = document.getElementById('view').getBoundingClientRect(), v = cam.position.clone().set(jx, y + 1.25, jz).project(cam);
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    }, [ix, iz, jx, jz]);
    await p.waitForTimeout(1500);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT.replace('.png', '-inside.png') });
    await p.mouse.click(pin.x, pin.y); await p.waitForTimeout(400);
    const n2 = await opened();
    console.log(`desktop: click on the inside face opens ${n2 - 1}`);
    if (n2 !== 2) fail('desktop: inside face did not open the shop');
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
// the hand-built shelter by the Emajõe on the race track (src/race/emajoe.js) shows it too
async function emajoe() {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail('page error ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('  console error', m.text().slice(0, 200)); });
  await p.goto(`${base}/?drive&nointro`);
  await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
  await p.waitForTimeout(6000);
  await p.evaluate(async () => {
    const t = (await import('/src/race/race.js')).createTrack(), i = 973;
    const [x, z] = t.P[i - 25], [ux, uz] = t.tan[i - 25];
    await __game.world.loadAround(x, z, 700);                 // (the place builds when its garden wall is loaded too)
    __game.place({ x, z, yaw: Math.atan2(ux, -uz) });
  });
  const waited = await p.evaluate(async () => { let k = 0; for (; k < 90 && !__game.busStops().extraPosters.length; k++) await new Promise((r) => setTimeout(r, 1000)); return [k, __game.busStops().extraPosters.length, __game.car.x | 0, __game.car.z | 0]; });
  if (!waited[1]) { fail('emajõe shelter not built ' + waited.join(' ')); await ctx.close(); return; }
  await p.waitForTimeout(6000);
  const pt = await p.evaluate(async () => {
    const { extraPosters } = __game.busStops();
    const m = extraPosters[0].mesh, cam = __game.camera;
    // its corners are in world places (shelter.js bakes them): the middle, and the way its front looks
    m.updateWorldMatrix(true, false);
    const a = m.geometry.attributes.position, P = (k) => m.position.clone().fromBufferAttribute(a, k).applyMatrix4(m.matrixWorld);
    const c = m.position.clone().set(0, 0, 0);
    for (let k = 0; k < a.count; k++) c.add(P(k));
    c.multiplyScalar(1 / a.count);
    const nrm = P(1).sub(P(0)).cross(P(2).sub(P(0))).normalize();
    window.__cam = [c.x + nrm.x * 4.5, c.y + 0.3, c.z + nrm.z * 4.5, c.x, c.y, c.z, 55];
    window.__pos = [c.x, c.y, c.z, nrm.x, nrm.y, nrm.z].map((v) => +v.toFixed(2));
    await new Promise((r) => setTimeout(r, 1500));
    const r = document.getElementById('view').getBoundingClientRect(), v = c.clone().project(cam);
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  });
  await p.waitForTimeout(3000);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(400);
  await p.mouse.click(pt.x + 300, pt.y);
  await p.waitForTimeout(400);
  const n = await p.evaluate(() => window.__opened.length);
  console.log(`emajõe shelter: click on the poster and one beside it open ${n}`, await p.evaluate(() => JSON.stringify(window.__pos)));
  if (n !== 1) fail('emajõe shelter poster');
  await ctx.close();
}
// crash into the shelter first (the frame and the poster bend), then click the bent poster
async function crashed() {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail('page error ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('  console error', m.text().slice(0, 200)); });
  await p.goto(`${base}/?drive&nointro`);
  await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
  await p.waitForTimeout(6000);
  const [x, z, yaw, L, gap] = D.stops[STOP];
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  const W = (s, n) => [x + ux * s + nx * n, z + uz * s + nz * n];
  const [cx, cz] = W(0.6, -(1.55 / 2 + gap) - 4.5), heading = Math.atan2(nx, -nz);   // into the open front, as busstop-crash.mjs
  await p.evaluate(async ([cx, cz, cy]) => { await __game.world.loadAround(cx, cz, 300); __game.place({ x: cx, z: cz, yaw: cy }); }, [cx, cz, heading]);
  await p.waitForTimeout(12000);
  const [ex, ez] = W(-L / 2 - 4.5, -(1.55 / 2 + gap) + 0.2);
  const res = await p.evaluate(async ([cx, cz, cy, i, ex, ez]) => {
    const g = __game, { updateShelters } = await import('/src/world/shelter.js');
    window.requestAnimationFrame = () => 0;                 // stop the frame loop: step by hand (as busstop-crash.mjs)
    for (let k = 0; k < 8; k++) g.busStops().update(g.car);
    g.place({ x: cx, z: cz, yaw: cy }); g.car.vx = 9;
    for (let k = 0; k < 120; k++) { g.sim(1 / 60, { up: 0 }); updateShelters(g.car, 1 / 60, g.audio); }
    for (let k = 0; k < 90; k++) updateShelters(g.car, 1 / 60, g.audio);
    const st = g.busStops().stops[i], ad = st.on.ad, a = ad.geometry.attributes.position;
    // the middle of the bent outside poster (its first six corners), seen from the road
    ad.updateWorldMatrix(true, false);
    const c = g.camera.position.clone().set(0, 0, 0), v = c.clone();
    for (let k = 0; k < 6; k++) c.add(v.fromBufferAttribute(a, k).applyMatrix4(ad.matrixWorld));
    c.multiplyScalar(1 / 6);
    g.camera.position.set(ex, c.y + 0.3, ez); g.camera.lookAt(c); g.camera.updateMatrixWorld();
    g.renderer.render(g.scene, g.camera);
    const el = document.getElementById('view'), r = el.getBoundingClientRect(), q = c.clone().project(g.camera);
    const px = r.left + (q.x + 1) / 2 * r.width, py = r.top + (1 - q.y) / 2 * r.height;
    return { damaged: !!st.br?.damaged(), on: !!g.busStops().posterAt(g.camera, el, px, py, null), beside: !!g.busStops().posterAt(g.camera, el, px + 250, py, null) };
  }, [cx, cz, heading, STOP, ex, ez]);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT.replace('.png', '-crashed.png'), timeout: 120000 });
  console.log(`crashed shelter: damaged ${res.damaged}, the bent poster answers ${res.on}, beside it ${res.beside}`);
  if (!res.damaged) fail('crash did not damage the shelter');
  if (!res.on || res.beside) fail('bent poster click');
  await ctx.close();
}
const only = process.env.ONLY;
if (!only || only.includes('desktop')) await run(false);
if (!only || only.includes('phone')) await run(true);
if (!only || only.includes('crash')) await crashed();
if (!only || only.includes('emajoe')) await emajoe();
await b.close();
console.log(ok ? 'ALL OK' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
