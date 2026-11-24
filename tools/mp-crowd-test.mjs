// Many players online: what do the other cars cost a frame?   node tools/mp-crowd-test.mjs [n=22] [pack=6] [port=5199] [touch] [secs=12] [models] [shot=file.png]
// Needs the dev server (npx vite --port 5199). No game server: the page's WebSocket is replaced by a fake
// lobby that welcomes n made-up drivers and sends their positions ten times a second, as the real one
// does. They drive along the race track around ours at different distances (a pack near us, the rest
// spread round the lap, up to about 2 km away), the way 22 people online were spread on 23 Nov.
// Our car stands on the track looking along it. Drawing is real (software GL), so the figures are
// relative: draw calls, triangles, name tags shown, and the page's time in mp.update and renderer.render.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const N = +arg('n', 22), PACK = +arg('pack', 6), port = +arg('port', 5199), touch = process.argv.includes('touch'), secs = +arg('secs', 12);
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const I0 = 1700;                       // our spot on the track
const CARS = ['impreza', 'f40', 'w201', 'm3', 'cgt', 'audi200', 'enyaq', 'passat', 'rav4', 'bz4x', 'crv', 'mazda6'];

const VW = +arg('vw', 1000), VH = +arg('vh', 600);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext(touch ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } : { viewport: { width: VW, height: VH } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
// graphics card bytes (textures and buffers), as tools/perf-budget.cjs counts them
await p.addInitScript(() => {
  const sizes = new WeakMap(); let tex = 0, buf = 0;
  const P = WebGL2RenderingContext.prototype, tI = P.texImage2D, tS = P.texStorage2D, bD = P.bufferData, dT = P.deleteTexture, dB = P.deleteBuffer;
  P.texImage2D = function (...a) {
    const t = this.getParameter(this.TEXTURE_BINDING_2D); let w, h;
    if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s?.width || 0; h = s?.height || 0; }
    if (t && a[1] === 0) { tex -= sizes.get(t) || 0; const n = w * h * 4 * 1.33; sizes.set(t, n); tex += n; }
    return tI.apply(this, a);
  };
  P.texStorage2D = function (target, levels, fmt, w, h) { const t = this.getParameter(this.TEXTURE_BINDING_2D); if (t) { tex -= sizes.get(t) || 0; const n = w * h * 4 * (levels > 1 ? 1.33 : 1); sizes.set(t, n); tex += n; } return tS.apply(this, arguments); };
  P.bufferData = function (target, data) { const b = this.getParameter(target === this.ELEMENT_ARRAY_BUFFER ? this.ELEMENT_ARRAY_BUFFER_BINDING : this.ARRAY_BUFFER_BINDING); const n = typeof data === 'number' ? data : data?.byteLength || 0; if (b) { buf -= sizes.get(b) || 0; sizes.set(b, n); buf += n; } return bD.apply(this, arguments); };
  P.deleteTexture = function (t) { if (t) { tex -= sizes.get(t) || 0; sizes.delete(t); } return dT.apply(this, arguments); };
  P.deleteBuffer = function (b) { if (b) { buf -= sizes.get(b) || 0; sizes.delete(b); } return dB.apply(this, arguments); };
  window.__glMB = () => Math.round((tex + buf) / 1e6);
});
await p.addInitScript(([P, I0, N, CARS, PACK]) => {
  // a lobby in the page: the offsets along the track (in points, 2 m each) of each made-up driver
  const at = [];
  for (let k = 0; k < N; k++) {
    if (k < PACK) at.push(8 + Math.round(k * 54 / PACK));          // a pack just ahead of us, 16 to 110 m
    else at.push(Math.round(((k - PACK + 1) / (N - PACK + 1)) * (P.length - 120)) + 60);   // the rest round the lap
  }
  const players = at.map((a, k) => ({ id: `bot${k}`, name: `Driver${String(k).padStart(2, '0')}`, car: CARS[k % CARS.length], w: 'map' }));
  class FakeWS {
    constructor() {
      this.readyState = 0;
      window.__fakeWs = this;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.();
        this.onmessage?.({ data: JSON.stringify({ t: 'welcome', id: 'me', players }) });
        const t0 = performance.now();
        this.timer = setInterval(() => {
          const t = (performance.now() - t0) / 1000;
          for (let k = 0; k < N; k++) {
            // the pack rolls to and fro within 16 to 130 m of us (so it stays near for the whole test); the rest drive on
            const pack = k < PACK, speed = pack ? 6 : 12 + (k % 5) * 3;                          // m/s
            const f = pack ? I0 + at[k] + 6 + 5 * Math.sin(t * 0.25 + k) : I0 + at[k] + (t * speed) / 2.045;
            const i = Math.floor(f) % P.length, j = (i + 1) % P.length, u = f - Math.floor(f);
            const x = P[i][0] + (P[j][0] - P[i][0]) * u, z = P[i][1] + (P[j][1] - P[i][1]) * u;
            const dx = P[j][0] - P[i][0], dz = P[j][1] - P[i][1];
            const yaw = Math.atan2(dx, -dz), side = (k % 3 - 1) * 2.5;
            const g = window.__game, y = g?.world?.heightAt ? g.world.heightAt(x, z) : 0;
            const vx = Math.sin(yaw) * speed, vz = -Math.cos(yaw) * speed;
            const pose = [x + Math.cos(yaw) * side, z + Math.sin(yaw) * side, y, yaw, 0, 0, vx, vz, 0, 0, 0, 0, 0.6, 0, 4000, 0, 0, 0, 0, 0, 1];
            this.onmessage?.({ data: JSON.stringify({ t: 's', id: `bot${k}`, p: pose }) });
          }
        }, 100);
      }, 300);
    }
    send() {}
    close() { clearInterval(this.timer); this.readyState = 3; }
  }
  window.WebSocket = FakeWS;
}, [P, I0, N, CARS, PACK]);
await p.goto(`http://localhost:${port}/?trees=old`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
await p.evaluate(() => { __game.setCar('w201', true); __game.startDriving(); });
await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
const yaw0 = Math.atan2(P[I0 + 1][0] - P[I0][0], -(P[I0 + 1][1] - P[I0][1]));
await p.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [P[I0][0], P[I0][1], yaw0]);
// the cars are built and let into the picture (worker build, warm-up)
await p.waitForTimeout(+arg('wait', 25) * 1000);
const r = await p.evaluate(async (secs) => {
  const g = __game, mp = g.mp(), rd = g.renderer;
  const tm = { mp: 0, render: 0, frames: 0, calls: 0, tris: 0, tags: 0, cars: 0, gaps: [] };
  const upd = mp.update, ren = rd.render;
  mp.update = function (...a) { const t = performance.now(); const v = upd.apply(this, a); tm.mp += performance.now() - t; return v; };
  rd.render = function (...a) {
    const t = performance.now(); const v = ren.apply(this, a); tm.render += performance.now() - t;
    tm.frames++; tm.calls += rd.info.render.calls; tm.tris += rd.info.render.triangles;
    tm.tags += [...document.querySelectorAll('#names .pname')].filter((e) => e.style.display !== 'none').length;
    let n = 0; g.scene.traverseVisible((o) => { if (o.userData?.remoteCar) n++; }); tm.cars += n;
    return v;
  };
  let last = performance.now();
  const loop = () => { const t = performance.now(); tm.gaps.push(t - last); last = t; if (!tm.done) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  await new Promise((res) => setTimeout(res, secs * 1000));
  tm.done = true;
  mp.update = upd; rd.render = ren;
  const f = tm.frames || 1, gaps = tm.gaps.sort((a, b) => a - b);
  return { frames: tm.frames, fps: +(tm.frames / secs).toFixed(1), mpMs: +(tm.mp / f).toFixed(2), renderMs: +(tm.render / f).toFixed(1),
    calls: Math.round(tm.calls / f), ktris: Math.round(tm.tris / f / 1000), tags: +(tm.tags / f).toFixed(1), carsDrawn: +(tm.cars / f).toFixed(1),
    gapP50: +gaps[gaps.length >> 1].toFixed(1), gapP95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1), level: g.gfx?.level, online: mp.count, glMB: window.__glMB(), heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6) };
}, secs);
console.log(JSON.stringify({ n: N, touch, ...r }));
const shot = arg('shot', '');
if (shot) { await p.waitForTimeout(3000); await p.screenshot({ path: shot }); }
if (process.argv.includes('models')) console.log(JSON.stringify(await p.evaluate(() => {
  const out = [];
  __game.scene.traverse((o) => { if (!o.userData?.remoteCar) return; let m = 0, t = 0, sh = 0; o.traverse((c) => { if (c.isMesh) { m++; if (c.castShadow) sh++; const g = c.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3 * (c.count || 1); } }); out.push([m, Math.round(t / 1000), sh]); });
  return out;
})));
await b.close();
