// Two browsers in the same lobby: A starts a lap, does B see the HOTLAP glow and tag, and do the two cars
// pass through each other while it runs (and still bump when it does not)?
// Needs the game served with its server on :8787 (npm run build && npx wrangler dev --port 8787) and
// Playwright. Usage: node tools/hotlap-test.mjs [folder for the pictures]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const dir = process.argv[2] || '.';
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', car, e.message));
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const key = (p, type, code) => p.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), [type, code]);
const N = P.length;
const at = (i, side = 0, back = 0) => {
  const a = P[(i + N) % N], b = P[(i + 1 + N) % N];
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz);
  const ux = tx / l, uz = tz / l;
  return { x: a[0] - uz * side - ux * back, z: a[1] + ux * side - uz * back, yaw: Math.atan2(ux, -uz) };
};
// (a hop, as the R key does, so a lap in progress carries on)
const place = (p, pose) => p.evaluate((q) => { __game.place(q); __game.race().hopped(q.x, q.z); }, pose);
const pos = (p) => p.evaluate(() => { const c = __game.car; return { x: +c.x.toFixed(2), z: +c.z.toFixed(2), v: +Math.hypot(c.vx, c.vy).toFixed(2), hit: +(c.hit || 0).toFixed(2), lap: __game.race().running }; });
const sees = (p) => p.evaluate(() => [...document.querySelectorAll('.pname')].map((e) => `${e.textContent}${e.classList.contains('hot') ? ' [HOTLAP]' : ''}${e.style.display === 'none' ? ' (hidden)' : ''}`));
const [ba, A] = await open('f40');
const [bb, B] = await open('w201');
console.log('both driving', process.uptime() | 0);

// 1: two cars put half on top of each other, nobody on a lap: they should push apart
const bumpTest = async (label) => {
  const a0 = at(30);
  await place(A, a0); await place(B, at(30, 1.2, 1.5));
  await A.waitForTimeout(2500);
  const a = await pos(A), b = await pos(B);
  const d = Math.hypot(a.x - a0.x, a.z - a0.z), bd = Math.hypot(b.x - at(30, 1.2, 1.5).x, b.z - at(30, 1.2, 1.5).z);
  console.log(label, 'A moved', d.toFixed(2), 'm, B moved', bd.toFixed(2), 'm', JSON.stringify(a), JSON.stringify(b));
};
if (!process.env.SHOTS) await bumpTest('no lap:');

// 2: A crosses the start line (lap starts), stops just past it
await place(A, at(N - 12));
await A.waitForTimeout(800);
await key(A, 'keydown', 'ArrowUp');
await A.waitForFunction(() => __game.race().running, null, { timeout: 30000 });
await key(A, 'keyup', 'ArrowUp');
console.log('A on a lap:', JSON.stringify(await pos(A)));
await bumpTest('A on lap:');
if (!process.env.SHOTS) {
// B drives into A from behind at speed
await place(A, at(60)); await place(B, at(40));
await A.waitForTimeout(1500);
await key(B, 'keydown', 'ArrowUp');
for (let k = 0; k < 10; k++) { await B.waitForTimeout(400); const a = await pos(A), b = await pos(B); console.log('drive through', JSON.stringify(a), JSON.stringify(b)); }
await key(B, 'keyup', 'ArrowUp');
}
console.log('B sees names', JSON.stringify(await sees(B)), 'A sees', JSON.stringify(await sees(A)));

// pictures from B: A parked 14 m ahead on its lap
const shot = async (name, w, h) => {
  await B.setViewportSize({ width: w, height: h });
  // (handbrakes on: an automatic creeps)
  await key(A, 'keydown', 'Space'); await key(B, 'keydown', 'Space');
  await place(A, at(80)); await place(B, at(80, 0, 11));
  await B.waitForTimeout(1500);
  await B.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
  await B.waitForTimeout(6000);
  await B.screenshot({ path: `${dir}/${name}.png` });
  await B.evaluate(() => { __game.renderer.render = () => {}; });
  await key(A, 'keyup', 'Space'); await key(B, 'keyup', 'Space');
};
await shot('hot-desktop', 1000, 600);
await shot('hot-phone', 844, 390);
// the same with no lap running: A drives off the track far enough to cancel? simpler: A teleports (cancels)
await A.evaluate(() => __game.race().teleported());
console.log('A lap after cancel:', JSON.stringify(await pos(A)));
await shot('idle-desktop', 1000, 600);
await bumpTest('after cancel:');
await ba.close(); await bb.close();
