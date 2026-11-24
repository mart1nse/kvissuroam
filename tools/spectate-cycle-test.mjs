// Spectating on the Raadi page, going from player to player (Martin 2026-11-24: on ?raadi=1, after a few
// players, a Citywide bus was not drawn and nothing moved; the pill said OFF THE MAP, the speedo stood at 52).
// Needs the game and its server on :8787 (npx wrangler dev --port 8787) and Playwright.
//   node tools/spectate-cycle-test.mjs [rounds=3] [shots=dir]
// Bots drive along the Raadi stage (one a bus); a real page drives a bus too (its positions are checked for
// holes); a hidden spectator (?raadi=1&off=100) steps through everyone with the arrow keys and, after each
// step, must see the watched car drawn where it is, moving, with the camera on it.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const ROUNDS = +arg('rounds', 3), SHOTS = arg('shots', ''), port = 8787;
const P = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url))).pts;
const CARS = ['bus', 'm3', 'impreza', 'enyaq', 'passat'];
const SPEED = 14;
const at = (k, t) => {
  const f = (k * 120 + (t * SPEED) / 1.9) % (P.length - 2);
  const i = Math.floor(f), j = i + 1, u = f - i;
  const x = P[i][0] + (P[j][0] - P[i][0]) * u, z = P[i][1] + (P[j][1] - P[i][1]) * u;
  const yaw = Math.atan2(P[j][0] - P[i][0], -(P[j][1] - P[i][1]));
  return [+x.toFixed(2), +z.toFixed(2), 40, +yaw.toFixed(3), 0, 0, +(Math.sin(yaw) * SPEED).toFixed(2), +(-Math.cos(yaw) * SPEED).toFixed(2), 0, 0, 0, 0, 0.5, 0, 1500, 0, 0, 0, 0, 0, 16];
};
const t0 = Date.now();
const quiet = new Set();          // bots that stopped sending (another tab, lost signal), still connected
const bots = CARS.map((car, k) => {
  const ws = new WebSocket(`ws://localhost:${port}/api/ws`, { headers: { 'cf-connecting-ip': `10.1.0.${k}` } });
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: 'hello', b: 1, name: `Bot${k}${car}`, car, w: 'map' }));
    ws.send(JSON.stringify({ t: 'drv', on: 1 }));
    const tick = () => { if (ws.readyState === 1 && !quiet.has(k)) ws.send(JSON.stringify({ t: 's', p: at(k, (Date.now() - t0) / 1000) })); setTimeout(tick, 95 + Math.random() * 10); };
    tick();
  };
  ws.onmessage = () => {};
  return ws;
});

const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
const open = async (q, name, car) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERR', name, e.message));
  await p.addInitScript((n) => {
    localStorage.setItem('kvissuroam.name', n);
    window.__sent = [];
    const Real = window.WebSocket;
    window.WebSocket = class extends Real { send(m) { if (typeof m === 'string' && m.startsWith('{"t":"s"')) window.__sent.push(m); super.send(m); } };
  }, name);
  await p.goto(`http://localhost:${port}/?q=low&trees=old&stats=0${q}`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return p;
};
const ok = (cond, what) => { console.log(cond ? 'PASS' : 'FAIL', what); if (!cond) process.exitCode = 1; };

// a real page in a bus, driving on the Raadi page
const D = await open('&raadi=1', 'LaserBus', 'bus');
await D.evaluate(([x, z, a, c]) => __game.place({ x, z, yaw: Math.atan2(a - x, -(c - z)) }), [P[400][0], P[400][1], P[404][0], P[404][1]]);
await D.waitForTimeout(5000);
await D.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true })));
console.log('bus driving', process.uptime() | 0);

const A = await open('&raadi=1&off=100', 'Watcher', 'm3');
await A.waitForTimeout(6000);
const state = () => A.evaluate(() => {
  const g = __game, w = g.watch(), mp = g.mp(), o = w?.id && mp.remote(w.id), cam = g.camera.position;
  const grp = o?.model?.group;
  return { id: w?.id || null, name: o?.name, view: !!w?.view, pose: !!o?.pose, near: !!o?.near, inScene: !!grp?.parent, visible: !!grp?.visible,
    model: o?.modelCar || null, car: o?.car, buf: o?.buf?.length, age: o?.buf?.length ? +(performance.now() / 1000 - o.buf[o.buf.length - 1].t).toFixed(2) : null,
    camToCar: o?.pose ? +Math.hypot(cam.x - o.pose[0], cam.z - o.pose[1]).toFixed(1) : null,
    st: document.querySelector('#watch .st')?.textContent, ready: o?.pose ? g.world.ready(o.pose[0], o.pose[1]) : null };
});
const key = (code) => A.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);
let bad = 0, n = 0;
// (the first one by a click on the list, as Martin does; the arrow keys work while watching)
await A.waitForFunction(() => document.querySelector('#people .who li[data-id]'), null, { timeout: 30000 });
await A.click('#people .who li[data-id]');
for (let r = 0; r < ROUNDS; r++) {
  for (let s = 0; s < CARS.length + 2; s++) {
    await key('ArrowRight');
    await A.waitForTimeout(r === 0 ? 6000 : 1500 + Math.random() * 1500);
    const st = await state();
    if (!st.id) continue;
    n++;
    const good = st.view && st.pose && st.inScene && st.visible && st.camToCar < 30;
    if (!good) bad++;
    console.log(good ? 'ok ' : 'BAD', JSON.stringify(st));
    if (!good && SHOTS) {
      await A.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
      await A.waitForTimeout(1500);
      await A.screenshot({ path: `${SHOTS}/bad-${n}.png` });
      await A.evaluate(() => { __game.renderer.render = () => {}; });
    }
  }
}
ok(bad === 0, `every watched car drawn with the camera on it (${n - bad} of ${n})`);

// the bus bot goes quiet while watched: its bus stays drawn, parked, the dial at 0, then on to another player
await A.evaluate(() => { const g = __game, mp = g.mp(), b = mp.roster().find((q) => q.name === 'Bot0bus'); if (!g.watch().id) document.querySelector('#people .who li[data-id]')?.click(); g.watch().start(b.id); });
await A.waitForTimeout(5000);
const busId = (await state()).id;
quiet.add(0);
await A.waitForTimeout(7000);
let q = await state();
const kmh = await A.evaluate(() => { const v = __game.watch().view; return v ? Math.hypot(v.vx, v.vy) * 3.6 : -1; });
console.log('quiet', JSON.stringify(q), 'kmh', kmh.toFixed(1));
ok(q.id === busId && q.view && q.inScene && q.visible && q.camToCar < 30, 'a car gone quiet stays drawn, parked, with the camera on it');
ok(kmh < 0.5 && /NO SIGNAL/.test(q.st), `its dial at 0 (${kmh.toFixed(1)} km/h) and the pill says NO SIGNAL (${q.st})`);
await A.waitForTimeout(7000);
q = await state();
console.log('after', JSON.stringify(q));
ok(q.id && q.id !== busId && q.view, 'about 11 s after its last news: watching another player');
// the arrow keys pass the quiet one by
const seen = [];
for (let s = 0; s < CARS.length + 2; s++) { await key('ArrowRight'); await A.waitForTimeout(400); const st = await state(); seen.push(st.id); if (!st.id) break; }
ok(!seen.includes(busId), 'the arrow keys pass by a player gone quiet');
const holes = await D.evaluate(() => window.__sent.filter((m) => /null/.test(m)));
const sent = await D.evaluate(() => window.__sent.length);
ok(sent > 50 && holes.length === 0, `the bus page's positions are whole (${sent} sent, ${holes.length} with a hole${holes[0] ? `: ${holes[0]}` : ''})`);
for (const ws of bots) ws.close();
await b.close();
process.exit();
