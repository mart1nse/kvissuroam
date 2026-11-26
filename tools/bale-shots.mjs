// Pictures of a Raadi stage bale being hit (src/race/bales.js, straw.js): the car into one bale at a few speeds,
// a picture just after the hit (the straw in the air), a moment later, and when all has come to rest.
//   node tools/bale-shots.mjs <out dir> [url]
// Needs the dev server (npx vite --port 5198) and Playwright.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.', url = process.argv[3] || 'http://localhost:5198/?raadi=1';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
await page.goto(url);
await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
await page.evaluate(() => __game.startDriving());
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
await page.evaluate(() => __game.stage().goStart());
await page.waitForFunction(() => __game.stage().bales.built, null, { timeout: 180000, polling: 200 });
await page.waitForTimeout(8000);

// steps the car and the bales by hand for `s` seconds (throttle down until `lift`), then holds the car still
const step = (s, up) => page.evaluate(([s, up]) => {
  const st = __game.stage(), car = __game.car;
  window.__stUpd ||= st.update; st.update = () => {};
  if (window.__held) { car.vx = __held[0]; car.vy = __held[1]; car.yawRate = __held[2]; }
  for (let t = 0; t < s; t += 1 / 60) { __game.sim(1 / 60, { up }); st.bales.update(car, 1 / 60); }
  window.__held = [car.vx, car.vy, car.yawRate];
  car.vx = car.vy = car.yawRate = 0;
  return { straw: st.bales.straw.count, flying: st.bales.straw.flying };
}, [s, up]);

for (const [name, kmh, off, pick] of [['30-square', 30, 0, 0], ['60-square', 60, 0, 0], ['90-half', 90, 0.5, 0], ['60-white', 60, 0.2, 1], ['twice', 45, 0, 0]]) {
  const info = await page.evaluate(([kmh, off, pick]) => {
    const st = __game.stage(), car = __game.car, B = st.bales, w = __game.world;
    window.__stUpd ||= st.update; st.update = () => {};
    B.reset();
    const flat = (b) => { let m = 0; for (let a = 0; a < 8; a++) m = Math.max(m, Math.abs(w.heightAt(b.x + Math.cos(a) * 9, b.z + Math.sin(a) * 9) - w.heightAt(b.x, b.z))); return m; };
    const b = B.bales.filter((q) => !!q.white === !!pick).sort((p, q) => flat(p) - flat(q))[0];
    // (from the side the banner faces)
    const yaw = Math.atan2(b.home.tx, -b.home.tz), fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    const back = car.halfLen + 0.6 + 1.2, side = -off * car.halfWid;
    Object.assign(car, { x: b.x - fx * back + rx * side, z: b.z - fz * back + rz * side, yaw, vx: kmh / 3.6, vy: 0, yawRate: 0, hit: 0 });
    window.__held = [kmh / 3.6, 0, 0];
    window.__bale = b;
    const h = w.heightAt(b.x, b.z);
    // from the side and a little ahead, at a standing person's height
    window.__cam = [b.x + rx * 6.5 + fx * 2.5, h + 1.9, b.z + rz * 6.5 + fz * 2.5, b.x + fx * 1.5, h + 0.6, b.z + fz * 1.5, 50];
    return { x: b.x, z: b.z, white: b.white };
  }, [kmh, off, pick]);
  const shot = async (tag) => { await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/${name}-${tag}.png` }); };
  const lead = (1.2 + 0.1) / (kmh / 3.6);
  let r = await step(lead + 0.12, 1); await shot('1-hit');
  r = await step(0.35, 0); await shot('2-air');
  console.log(name, JSON.stringify(info), JSON.stringify(r));
  await step(3, 0);
  if (name === 'twice') {
    // a second hit from another side
    await page.evaluate(() => {
      const car = __game.car, b = __bale, yaw = __game.car.yaw + 1.8, fx = Math.sin(yaw), fz = -Math.cos(yaw);
      Object.assign(car, { x: b.x - fx * (car.halfLen + 1.8), z: b.z - fz * (car.halfLen + 1.8), yaw, vx: 14, vy: 0, yawRate: 0 });
      window.__held = [14, 0, 0];
    });
    await step(0.3, 1); await step(3, 0);
  }
  // the bale where it came to rest, close
  await page.evaluate(() => {
    const b = __bale, w = __game.world, car = __game.car, lie = b.down ? 1.2 : 0, bx = b.x + b.tdx * lie, bz = b.z + b.tdz * lie, h = w.heightAt(bx, bz);
    const dx = car.x - bx, dz = car.z - bz, l = Math.hypot(dx, dz) || 1;
    // (from where the car came, a little to one side)
    const a = Math.atan2(__bale.home.tx, -__bale.home.tz), fx = Math.sin(a), fz = -Math.cos(a);
    window.__cam = [bx - fx * 3.2 + fz * 1.6, h + 1.5, bz - fz * 3.2 - fx * 1.6, bx, h + 0.55, bz, 45];
    car.x += 60;
  });
  await shot('3-rest');
  await page.evaluate(() => { __game.car.x -= 60; });
}
await page.evaluate(() => { const st = __game.stage(); st.bales.reset(); st.update = window.__stUpd; window.__cam = null; });
await browser.close();
