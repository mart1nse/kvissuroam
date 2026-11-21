// The graphics lost in the background and the game brought back whole (src/gfxloss.js):
// node tools/context-loss-test.mjs [out dir]   (vite dev server on :5198, or PORT=...)
//
// Why: Martin's Android phone, 21 Nov 2026: lap times screen, another app, back, and the houses, the ground
// and the cars were black. Chrome had lost the WebGL context and cleared the painted canvases.
// Headless Chromium cannot lose a 2D canvas, so the test does what Chrome does: it loses the WebGL context
// with WEBGL_lose_context, clears every canvas a texture is drawn from, and gives the context back.
//   1. ?glreload=0 (the old way): the picture after it, for comparison (black where the canvases were);
//   2. the game as it is: the page must load again by itself, the car where it was, and the picture after
//      DRIVE must look like the one before;
//   3. a 2D canvas alone telling it lost its picture (Chrome's contextlost event) must also bring a reload.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const PORT = process.env.PORT || 5198;
fs.mkdirSync(out, { recursive: true });
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const POSE = { x: 1724, z: 3085, yaw: 2.2 };

async function open(query) {
  const p = await b.newPage({ viewport: { width: 960, height: 440 } });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto(`http://127.0.0.1:${PORT}/?nointro&smalltex&${query}`);
  await ready(p);
  await p.evaluate(async (P) => { await __game.world.loadAround(P.x, P.z, 400); __game.startDriving(); __game.place(P); }, POSE);
  await p.waitForTimeout(20000);                     // (the small pictures' canvases are let go after 3 s on the card)
  return p;
}
const ready = (p) => p.waitForFunction(() => window.__game?.world && window.__game.car && window.__game.mode !== 'loading', null, { timeout: 240000 });
// the share of the picture's middle band that is (nearly) black
const dark = (p) => p.evaluate(() => {
  const c = __game.renderer.domElement, w = 240, h = 110;
  const k = document.createElement('canvas'); k.width = w; k.height = h;
  const g = k.getContext('2d', { willReadFrequently: true });
  __game.renderer.render(__game.scene, __game.camera);
  g.drawImage(c, 0, 0, w, h);
  const d = g.getImageData(0, h * 0.2, w, h * 0.6).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 24) n++;
  return n / (d.length / 4);
});
// what Chrome on Android does in the background: the WebGL context lost, painted canvases cleared
const loseAll = (p) => p.evaluate(async () => {
  const gl = __game.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context');
  const seen = new Set();
  __game.scene.traverse((o) => { for (const m of [o.material].flat()) if (m) for (const v of Object.values(m)) if (v?.isTexture && v.image instanceof HTMLCanvasElement) seen.add(v.image); });
  ext.loseContext();
  await new Promise((r) => setTimeout(r, 300));
  for (const c of seen) { const w = c.width; c.width = 0; c.width = w; }    // (blank, as Chrome leaves a lost 2D canvas)
  await new Promise((r) => setTimeout(r, 300));
  ext.restoreContext();
  return seen.size;
}).catch(() => -1);                                   // (the fixed game loads the page again in the middle of it)

// 1. the old way
{
  const p = await open('glreload=0');
  const d0 = await dark(p);
  await p.screenshot({ path: `${out}/1-before.png` });
  const n = await loseAll(p);
  await p.waitForTimeout(6000);
  const d1 = await dark(p);
  await p.screenshot({ path: `${out}/1-old-after.png` });
  console.log(`old way: ${n} canvases cleared, black ${(d0 * 100).toFixed(1)}% before, ${(d1 * 100).toFixed(1)}% after`);
  check(d1 > d0 + 0.05, 'the old way shows the black scenery (the test reproduces the fault)');
  await p.close();
}
// 2. the game as it is
{
  const p = await open('');
  const d0 = await dark(p);
  const nav = p.waitForEvent('framenavigated', { timeout: 30000 }).then(() => true, () => false);
  await loseAll(p);
  check(await nav, 'the page loads again by itself');
  await ready(p);
  const st = await p.evaluate(() => ({ mode: __game.mode, x: __game.car.x, z: __game.car.z, msg: document.querySelector('#loadmsg').textContent }));
  check(st.mode === 'menu', `back at the menu (${st.mode})`);
  check(Math.hypot(st.x - POSE.x, st.z - POSE.z) < 3, `the car where it was (${st.x.toFixed(1)}, ${st.z.toFixed(1)})`);
  await p.evaluate(() => __game.startDriving());
  await p.waitForTimeout(20000);
  const d1 = await dark(p);
  await p.screenshot({ path: `${out}/2-fixed-after.png` });
  console.log(`fixed: black ${(d0 * 100).toFixed(1)}% before, ${(d1 * 100).toFixed(1)}% after the reload`);
  check(d1 < d0 + 0.02, 'the picture after it is as before (no black scenery)');
  await p.close();
}
// 3. a 2D canvas alone
{
  const p = await open('');
  const nav = p.waitForEvent('framenavigated', { timeout: 30000 }).then(() => true, () => false);
  await p.evaluate(() => {
    let c = null;
    __game.scene.traverse((o) => { for (const m of [o.material].flat()) if (!c && m?.map?.image instanceof HTMLCanvasElement) c = m.map.image; });
    if (!c) { c = document.createElement('canvas'); c.getContext('2d'); }
    c.dispatchEvent(new Event('contextlost'));
  });
  check(await nav, 'a lost 2D canvas also loads the page again');
  await ready(p);
  await p.close();
}
await b.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
