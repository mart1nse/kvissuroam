// Pictures of a busy server: 40 online (38 made-up drivers as WebSocket bots and two pages, a desktop
// and a phone) on the real server (npx wrangler dev --port 8787), then a race of 20 cars, running and finished.
//   node tools/crowd-shots.mjs [out=dir] [bots=38] [racers=18] [w=1280 h=720 (the desktop window)]
import { createRequire } from 'module';
import fs from 'fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const NB = +arg('bots', 38), NR = +arg('racers', 18), port = 8787, out = arg('out', '/tmp/shots');
fs.mkdirSync(out, { recursive: true });
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts, N = P.length;
const NAMES = ['Kaarel', 'MariLiis', 'Tonu', 'Siim_R', 'Kristjan', 'Laura', 'Rasmus', 'Getter', 'Ott', 'Hanna', 'Joosep', 'Kertu', 'Mihkel', 'Anu', 'TurboTom', 'Priit', 'Kadri', 'Marten', 'Egert', 'Liisu', 'Rally_Rein', 'Karl', 'Elis', 'Andres', 'Helen', 'Taavi', 'Merilin', 'Uku', 'Triin', 'Sander', 'Kevin', 'Grete', 'Aivar', 'Jaanika', 'Robin', 'Maarja', 'Erki', 'Kristel'];
const CARS = ['impreza', 'f40', 'm3', 'cgt', 'audi200', 'enyaq', 'passat', 'rav4', 'bz4x', 'crv', 'mazda6', 'w201'];
let H = null;                                  // ground height at each track point, from the page
const y = (i) => (H ? H[i % N] : 0);
const yawAt = (i) => { const p = P[i % N], q = P[(i + 1) % N]; return Math.atan2(q[0] - p[0], -(q[1] - p[1])); };
const I0 = 1700;                               // where the pages free-drive at first
function at(f, side, speed) {
  const i = Math.floor(f), u = f - i, p = P[((i % N) + N) % N], q = P[(((i + 1) % N) + N) % N];
  const yw = Math.atan2(q[0] - p[0], -(q[1] - p[1]));
  const x = p[0] + (q[0] - p[0]) * u + Math.cos(yw) * side, z = p[1] + (q[1] - p[1]) * u + Math.sin(yw) * side;
  return [+x.toFixed(2), +z.toFixed(2), +y(((i % N) + N) % N).toFixed(2), +yw.toFixed(3), 0, 0, +(Math.sin(yw) * speed).toFixed(2), +(-Math.cos(yw) * speed).toFixed(2), 0, 0, 0, 0, 0.6, 0, 3500, 0, 0, 0, 0, 0, 3];
}
// the grid, as src/race/racemode.js lays it out
const ga = P[N - 30], gb = P[0], GL = Math.hypot(gb[0] - ga[0], gb[1] - ga[1]);
const ux = (gb[0] - ga[0]) / GL, uz = (gb[1] - ga[1]) / GL, nx = -uz, nz = ux, gYaw = Math.atan2(ux, -uz);
function gridAt(k) {
  const row = Math.floor(k / 5), col = [2, 1, 3, 0, 4][k % 5], t = -34 - 0.6 - 2.2 - row * 7.5, lat = (col - 2) * 2.7;
  const x = ga[0] + ux * t + nx * lat, z = ga[1] + uz * t + nz * lat;
  return [+x.toFixed(2), +z.toFixed(2), +y(N - 30).toFixed(2), +gYaw.toFixed(3), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 900, 0, 0, 0, 0, 0, 1];
}
const hash = (seed, id) => { let h = seed >>> 0; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0; return h; };

// ---- bots
let race = null;
const bots = [];
const t0 = Date.now();
for (let k = 0; k < NB; k++) {
  const ws = new WebSocket(`ws://localhost:${port}/api/ws`, { headers: { 'cf-connecting-ip': `10.1.${k >> 8}.${k & 255}` } });
  const bot = { ws, k, id: null, racer: k < NR, speed: 17 + (k % 7) * 1.3 };
  // (a page says ping every so often; a socket silent for 80 s counts as asleep and gets no vote)
  setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 20000);
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', b: 1, name: NAMES[k % NAMES.length], car: CARS[k % CARS.length] })); tick(); };
  ws.onmessage = (e) => { if (e.data === 'pong') return; const m = JSON.parse(e.data); if (m.t === 'welcome') { bot.id = m.id; ws.send(JSON.stringify({ t: 'drv', on: 1 })); } if (m.t === 'race' && k === 0) race = m.r; };
  const tick = () => {
    if (ws.readyState !== 1) return;
    const t = (Date.now() - t0) / 1000, now = Date.now();
    let p;
    const r = race, mine = r?.on && r.racers.find((x) => x.id === bot.id);
    if (mine && !mine.out && mine.ms == null && now < r.tGreen) {
      const order = r.racers.filter((x) => !x.late).map((x) => x.id).sort((a, b) => hash(r.seed, a) - hash(r.seed, b));
      p = gridAt(order.indexOf(bot.id));
    } else if (mine && !mine.out && now >= r.tGreen) {
      const order = r.racers.filter((x) => !x.late).map((x) => x.id).sort((a, b) => hash(r.seed, a) - hash(r.seed, b));
      const back = Math.floor(order.indexOf(bot.id) / 5) * 3.7, s = (now - r.tGreen) / 1000;
      p = at(N - 30 + 17 - back + (s * bot.speed) / 2.045, ((k % 3) - 1) * 2.2, bot.speed);
    } else if (k < 12) p = at(I0 + 8 + k * 7 + 4 * Math.sin(t * 0.3 + k), ((k % 3) - 1) * 2.5, 6);   // a pack near the pages
    else p = at(I0 + 140 + ((k - 12) / (NB - 12)) * (N - 300) + (t * bot.speed) / 2.045, 0, bot.speed);
    ws.send(JSON.stringify({ t: 's', p }));
    setTimeout(tick, 95 + Math.random() * 10);
  };
  bots.push(bot);
}

// ---- the two pages
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const desk = await (await b.newContext({ viewport: { width: +arg('w', 1280), height: +arg('h', 720) }, deviceScaleFactor: 2 })).newPage();
const phone = await (await b.newContext({ ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
const pages = { desktop: desk, phone };
for (const [n, p] of Object.entries(pages)) p.on('pageerror', (e) => console.log(n, 'PAGEERR', e.message));
await Promise.all(Object.entries(pages).map(async ([n, p]) => {
  await p.addInitScript((n) => { try { localStorage.setItem('kvissuroam.name', n === 'phone' ? 'Martin_phone' : 'Martin'); } catch {} }, n);
  await p.goto(`http://localhost:${port}/?trees=old&q=low`, { timeout: 240000 });
  await p.waitForFunction(() => window.__game?.car && __game.mp?.(), null, { timeout: 240000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, n === 'phone' ? 'impreza' : 'f40');
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 240000 });
}));
H = await desk.evaluate((P) => P.map(([x, z]) => __game.world.heightAt(x, z)), P);
const put = (p, i, side) => p.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [P[i][0] + Math.cos(yawAt(i)) * side, P[i][1] + Math.sin(yawAt(i)) * side, yawAt(i)]);
await put(desk, I0, 0); await put(phone, I0 - 6, 2.5);
const shot = async (name) => { for (const [n, p] of Object.entries(pages)) await p.screenshot({ path: `${out}/${name}-${n}.png`, timeout: 240000 }); console.log('shot', name, ((Date.now() - t0) / 1000) | 0, 's'); };
console.log('waiting for the cars to come in');
await desk.waitForTimeout(35000);
const st = await desk.evaluate(() => ({ online: __game.mp().count, drivers: __game.mp().drivers().length }));
console.log('desktop sees', JSON.stringify(st));
await shot('1-online40');
for (const p of Object.values(pages)) await p.evaluate(() => __game.openMap());
await desk.waitForTimeout(4000);
await shot('2-map-list');
for (const p of Object.values(pages)) await p.keyboard.press('Escape');
await desk.waitForTimeout(1500);

// ---- the race: votes from 8 bots, then the racers and both pages join in the count
for (const bt of bots.slice(0, 8)) bt.ws.send(JSON.stringify({ t: 'rv', on: 1 }));
await desk.waitForFunction(() => document.querySelector('#hud') && __game.raceMode?.() && true, null, { timeout: 5000 });
await desk.waitForTimeout(800);
console.log('race', race?.on, race?.vote && JSON.stringify(race.vote));
for (const bt of bots.slice(0, NR)) bt.ws.send(JSON.stringify({ t: 'rj', on: 1 }));
// (each page presses JOIN until the server has it in the race: a slow page may not have the count up yet)
for (let w = 0; w < 40 && !race?.on; w++) await new Promise((r) => setTimeout(r, 250));
for (let w = 0; w < 12; w++) {
  const missing = Object.entries(pages).filter(([n]) => !race?.racers?.some((x) => x.name === (n === 'phone' ? 'Martin_phone' : 'Martin')));
  if (!missing.length) break;
  for (const [, p] of missing) await p.evaluate(() => __game.raceMode().act());
  await new Promise((r) => setTimeout(r, 700));
}
await desk.waitForTimeout(1500);
await shot('3-race-count');
await desk.waitForFunction(() => Date.now() > 0, null);
console.log('race now', JSON.stringify({ on: race?.on, n: race?.racers?.length, vote: race?.vote }));
for (let w = 0; w < 200 && !(race?.tGreen && Date.now() > race.tGreen - 2500); w++) await new Promise((r) => setTimeout(r, 200));
await shot('4-grid-lights');
while (Date.now() < race.tGreen + 300) await new Promise((r) => setTimeout(r, 100));
// the pages drive off with the pack
for (const p of Object.values(pages)) await p.keyboard.down('ArrowUp');
await desk.waitForTimeout(22000);
for (const p of Object.values(pages)) await p.keyboard.up('ArrowUp');
console.log('racers', race.racers.length);
await shot('5-race-running');
// the finish: the bots cross the line one after another (16 finish, 2 drop out), and the pages finish too
while (Date.now() < race.tGreen + 26000) await new Promise((r) => setTimeout(r, 200));
const done = bots.slice(0, NR);
for (let i = 0; i < done.length; i++) {
  const bt = done[i];
  if (i === 5) bt.ws.send(JSON.stringify({ t: 'rd', why: 'off' }));
  else if (i === 11) bt.ws.send(JSON.stringify({ t: 'rd', why: 'car' }));
  else bt.ws.send(JSON.stringify({ t: 'rf', ms: 178000 + i * 2150 + (i % 4) * 330 }));
}
await desk.evaluate(() => __game.mp().raceSend({ t: 'rf', ms: 186420 }));
await phone.evaluate(() => __game.mp().raceSend({ t: 'rf', ms: 201930 }));
await desk.waitForTimeout(2500);
console.log('race over', !race.on, race.last && race.last.racers.length);
await shot('6-race-results');
for (const w of bots) w.ws.close();
await b.close();
