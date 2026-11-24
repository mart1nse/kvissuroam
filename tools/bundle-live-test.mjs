// Positions in bundles, end to end: the real server (npx wrangler dev --port 8787), made-up drivers as
// WebSocket bots and the game in a browser.   node tools/bundle-live-test.mjs [bots=9] [old]
// The bots drive along the race track near the game's car, ten positions a second, one of them as a page
// from before bundles (it must still see the others). The game is measured twice: asking for bundles, and
// as an older page (the hello's b taken out). Printed: messages a second into the page, and how smoothly
// the nearest bot glides (its speed frame to frame: spread around the true speed, and the worst jump).
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const NB = +arg('bots', 9), port = +arg('port', 8787);
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const I0 = 1700, SPEED = 15;

// ---- bots
const bots = [];
const at = (k, t) => {
  const f = I0 + 10 + k * 6 + (t * SPEED) / 2.045;
  const i = Math.floor(f) % P.length, j = (i + 1) % P.length, u = f - Math.floor(f);
  const x = P[i][0] + (P[j][0] - P[i][0]) * u, z = P[i][1] + (P[j][1] - P[i][1]) * u;
  const yaw = Math.atan2(P[j][0] - P[i][0], -(P[j][1] - P[i][1]));
  return [+x.toFixed(2), +z.toFixed(2), 0, +yaw.toFixed(3), 0, 0, +(Math.sin(yaw) * SPEED).toFixed(2), +(-Math.cos(yaw) * SPEED).toFixed(2), 0, 0, 0, 0, 0.5, 0, 3000, 0, 0, 0, 0, 0, 4];
};
const t0 = Date.now();
let oldGot = { s: 0, S: 0 };
const got = { n: 0, cars: 0, age: 0, maxAge: 0, bytes: 0, t: Date.now() };
for (let k = 0; k < NB; k++) {
  const old = k === NB - 1;
  // (each bot from an address of its own, as players are: the server lets 30 in from one)
  const ws = new WebSocket(`ws://localhost:${port}/api/ws`, { headers: { 'cf-connecting-ip': `10.0.${k >> 8}.${k & 255}` } });
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: 'hello', ...(old ? {} : { b: 1 }), name: `Bot${k}${old ? 'Old' : ''}`, car: ['impreza', 'f40', 'm3'][k % 3] }));
    ws.send(JSON.stringify({ t: 'drv', on: 1 }));
    // (a real page's send timer drifts a little against the server's ticks)
    const tick = () => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 's', p: at(k, (Date.now() - t0) / 1000) })); setTimeout(tick, 95 + Math.random() * 10); };
    setTimeout(tick, Math.random() * 100);
  };
  if (old) ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t in oldGot) oldGot[m.t]++; };
  // the first bot keeps count of its bundles: how many, how full, how old their positions were at the server
  if (k === 0) ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t !== 'S') return; got.n++; got.cars += m.b.length; for (const x of m.b) { got.age += x[2]; got.maxAge = Math.max(got.maxAge, x[2]); } got.bytes += e.data.length; };
  bots.push(ws);
}

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function run(asOld) {
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.addInitScript((asOld) => {
    window.__wsIn = { s: 0, S: 0, all: 0 };
    const Real = window.WebSocket;
    window.WebSocket = class extends Real {
      constructor(...a) {
        super(...a);
        this.addEventListener('message', (e) => { window.__wsIn.all++; const t = /^\{"t":"(\w)"/.exec(e.data)?.[1]; if (t && t in window.__wsIn) window.__wsIn[t]++; });
      }
      send(m) { super.send(asOld && typeof m === 'string' ? m.replace('"b":1,', '') : m); }
    };
  }, asOld);
  await p.goto(`http://localhost:${port}/?q=low&trees=old&stats=0`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  console.log('loaded', process.uptime() | 0);
  await p.evaluate(() => { __game.setCar('w201', true); __game.startDriving(); });
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
  await p.evaluate(() => { __game.renderer.render = () => {}; });
  console.log('driving', process.uptime() | 0);
  // (our car 30 m behind the bots as they are now: they drive on, about 150 m in the 10 s measured)
  const b0 = at(0, (Date.now() - t0) / 1000 + 4), yaw = b0[3];
  await p.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [b0[0] - Math.sin(yaw) * 30, b0[1] + Math.cos(yaw) * 30, yaw]);
  await p.waitForTimeout(4000);
  const r = await p.evaluate(async () => {
    const mp = __game.mp(), out = { frames: 0, sp: [], dbg: [], in0: { ...window.__wsIn } };
    const id = mp.roster().find((q) => /^Bot0$/.test(q.name))?.id;
    // (each frame's position next to the moment the game worked it out: mp.update reads the clock itself)
    let last = null, lt = 0;
    const upd = mp.update;
    mp.update = function (...a) {
      const ts = performance.now(); const v = upd.apply(this, a);
      const pz = mp.poseOf(id);
      if (pz && last && ts > lt) { out.sp.push(Math.hypot(pz[0] - last[0], pz[1] - last[1]) / ((ts - lt) / 1000)); if (out.dbg.length < 400) out.dbg.push([+(ts - lt).toFixed(1), +pz[0].toFixed(2), +pz[1].toFixed(2)]); }
      if (pz) { last = [pz[0], pz[1]]; lt = ts; }
      out.frames++;
      return v;
    };
    await new Promise((res) => setTimeout(res, 10000));
    mp.update = upd;
    out.in1 = { ...window.__wsIn };
    out.others = mp.roster().length;
    return out;
  });
  await ctx.close();
  if (process.argv.includes('dbg')) { const big = r.sp.map((v, i) => [v, i]).filter(([v]) => Math.abs(v - SPEED) > 8).slice(0, 8); console.log('jumps', JSON.stringify(big.map(([v, i]) => [Math.round(v), r.dbg.slice(Math.max(0, i - 2), i + 2)]))); }
  const sp = r.sp.filter((v) => v > 0.5), mean = sp.reduce((a, v) => a + v, 0) / sp.length;
  const sd = Math.sqrt(sp.reduce((a, v) => a + (v - mean) ** 2, 0) / sp.length);
  const worst = Math.max(...sp.map((v) => Math.abs(v - SPEED)));
  return { page: asOld ? 'older page' : 'bundles', others: r.others, msgsPerSec: +((r.in1.all - r.in0.all) / 10).toFixed(1), single: r.in1.s - r.in0.s, bundles: r.in1.S - r.in0.S,
    fps: +(r.frames / 10).toFixed(0), speedMean: +mean.toFixed(2), speedSpread: +(sd / SPEED * 100).toFixed(1) + '%', worstJump: +(worst).toFixed(1) + ' m/s' };
}
const order = process.argv.includes('oldfirst') ? [true, false] : [false, true];
for (const asOld of order) { oldGot = { s: 0, S: 0 }; console.log(JSON.stringify(await run(asOld))); }
console.log('old bot meanwhile got', JSON.stringify(oldGot));
{ const s = (Date.now() - got.t) / 1000; console.log('bot 0 got', JSON.stringify({ bundlesPerSec: +(got.n / s).toFixed(1), carsPerBundle: +(got.cars / got.n).toFixed(1), meanAgeMs: Math.round(got.age / got.cars), maxAgeMs: got.maxAge, kbPerSec: +(got.bytes / s / 1000).toFixed(1) })); }
for (const w of bots) w.close();
await b.close();
