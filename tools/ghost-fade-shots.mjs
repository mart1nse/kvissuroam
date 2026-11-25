// Pictures of see-through ghost cars beside ours: made-up drivers on a hotlap (WebSocket bots on the real server,
// npx wrangler dev --port 8787) stand around the page's car, one of each kind asked for, so each is drawn faded.
//   node tools/ghost-fade-shots.mjs [out=dir] [cars=passat,impreza,audi200,w201] [name=label] [w=1280 h=720] [q=low] [phone=1] [info=1] [more=&aatest=1]
// The first car stands to the left and half a length ahead, the second to the right, the third ahead, the fourth behind.
// more=&aatest=1: with edge smoothing, as a desktop with a graphics card draws them (these pictures are drawn in
// software, where the game leaves it off, and a faded car is drawn another way without it: see setFade in
// src/net/multiplayer.js). info=1: what a frame sends to the graphics card with the cars faded, and then with the
// same cars solid (their hotlap flag dropped): fading must not add to it.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const port = 8787, out = arg('out', '/tmp/shots'), label = arg('name', 'ghosts'), CARS = arg('cars', 'passat,impreza,audi200,w201').split(',');
fs.mkdirSync(out, { recursive: true });
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts, N = P.length, I0 = +arg('at', 1700);
const SPOTS = [[-2.3, 2.5], [2.6, -1], [0.4, 7.5], [-0.5, -6], [-4.6, 6], [4.8, 5]];      // metres to the right, ahead

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const phone = arg('phone') === '1';
const page = await (await b.newContext(phone ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 } } : { viewport: { width: +arg('w', 1280), height: +arg('h', 720) }, deviceScaleFactor: +arg('dpr', 2) })).newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(`http://localhost:${port}/?trees=old${arg('q') ? `&q=${arg('q')}` : ''}${arg('more', '')}`, { timeout: 240000 });
await page.waitForFunction(() => window.__game?.car && __game.mp?.(), null, { timeout: 240000 });
await page.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, arg('me', 'impreza'));
await page.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 240000 });
const p0 = P[I0], p1 = P[I0 + 1], yaw = Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1]));
await page.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [p0[0], p0[1], yaw]);
await page.keyboard.down('Space');
const spot = ([r, f]) => [p0[0] + Math.cos(yaw) * r + Math.sin(yaw) * f, p0[1] + Math.sin(yaw) * r - Math.cos(yaw) * f];
const H = await page.evaluate((s) => s.map(([x, z]) => __game.world.heightAt(x, z)), SPOTS.map(spot));

let flags = 8 | 3;      const bots = CARS.map((car, k) => {
  const ws = new WebSocket(`ws://localhost:${port}/api/ws`, { headers: { 'cf-connecting-ip': `10.2.0.${k + 1}` } });
  setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 20000);
  const [x, z] = spot(SPOTS[k]);
  const tick = () => {
    if (ws.readyState !== 1) return;
    // (flag 8: on a hotlap, so we pass through each other and the car fades near ours)
    ws.send(JSON.stringify({ t: 's', p: [+x.toFixed(2), +z.toFixed(2), +H[k].toFixed(2), +(yaw + (k === 0 ? 0.5 : 0)).toFixed(3), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 900, 0, 0, 0, 0, 0, flags] }));
    setTimeout(tick, 100);
  };
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', b: 1, name: `Ghost${k + 1}`, car })); tick(); };
  ws.onmessage = (e) => { if (e.data === 'pong') return; const m = JSON.parse(e.data); if (m.t === 'welcome') ws.send(JSON.stringify({ t: 'drv', on: 1 })); };
  return ws;
});
await page.waitForTimeout(+arg('wait', 45000));
console.log('sees', await page.evaluate(() => __game.mp().players().length), 'drivers');
await page.screenshot({ path: `${out}/${label}.png`, timeout: 240000 });
// what a frame draws: pieces sent to the graphics card (least and most over 12 frames), triangles, shaders
const drawn = () => page.evaluate(async () => {
  const i = __game.renderer.info, calls = [], tris = [];
  for (let k = 0; k < 12; k++) { await new Promise((r) => requestAnimationFrame(r)); calls.push(i.render.calls); tris.push(i.render.triangles); }
  return { calls: [Math.min(...calls), Math.max(...calls)], tris: [Math.min(...tris), Math.max(...tris)], programs: i.programs.length };
});
if (arg('info')) {
  console.log('faded', JSON.stringify(await drawn()));
  flags = 3;
  // (our car held where it is: the solid cars would push it away)
  const hold = setInterval(() => page.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [p0[0], p0[1], yaw]).catch(() => {}), 150);
  await page.waitForTimeout(+arg('settle', 12000));
  console.log('solid', JSON.stringify(await drawn()));
  clearInterval(hold);
  await page.screenshot({ path: `${out}/${label}-solid.png`, timeout: 240000 });
}
for (const ws of bots) ws.close();
await b.close();
process.exit(0);
