// Two browsers in the same lobby: does B hear A's engine and see its smoke and tyre marks?
// Needs the game served with its server on :8787 (npm run build && npx wrangler dev --port 8787) and
// Playwright. Usage: node tools/mp-effects-test.mjs [car id for A] [folder for the picture]
// A spins its wheels just behind B (B's smoke puffs, tyre marks and voice level are printed, and a
// picture taken from B's side), then drives past B flat out (prints the pitch shift B hears).
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const yaw = 2.7085;
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', car, e.message));
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  // (software rendering manages a frame or two a second, far too slow for two cars to meet: draw nothing
  // until a picture is wanted)
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const key = (p, type, code) => p.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), [type, code]);
const place = (p, i, side = 0) => p.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [P[i][0] + Math.cos(yaw) * side, P[i][1] + Math.sin(yaw) * side, yaw]);
const [ba, A] = await open(process.argv[2] || 'passat');
const [bb, B] = await open('w201');
console.log('both driving', process.uptime() | 0);
// 1: A does a burnout / donut 14 m behind B
await place(B, 1707, 0); await place(A, 1700, 0);
await A.waitForTimeout(3000);
await key(A, 'keydown', 'ArrowUp'); await key(A, 'keydown', 'ArrowLeft');
await A.waitForTimeout(9000);
const tap = () => B.evaluate(async () => {
  const g = __game, vs = g.audio.remoteVoices;
  const out = { remotes: g.mp().remotes().map((r) => ({ car: r.spec.id, rpm: r.rpm, thr: r.throttle, slipV: r.slipV, skidR: r.skidR, rubR: r.rubR, rubF: r.rubF, soot: r.soot, paved: r.paved })),
    smoke: g.smoke().count, skids: g.skids().count, voices: vs.map(({ node, ...v }) => v) };
  if (vs[0]) {
    const an = vs[0].node.context.createAnalyser(); an.fftSize = 2048; vs[0].node.connect(an);
    await new Promise((r) => setTimeout(r, 500));
    out.own = g.audio.remoteVoices.length;
    const d = new Float32Array(2048); an.getFloatTimeDomainData(d);
    out.rms = Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length); out.ctx = vs[0].node.context.state;
  }
  return out;
});
console.log('A car', JSON.stringify(await A.evaluate(() => { const c = __game.car; return { fps: __game.renderer.info.render.frame, t: performance.now() | 0, x: c.x | 0, z: c.z | 0, rpm: c.rpm, slipV: c.slipV, rubR: c.rubR, rubF: c.rubF, smoke: __game.smoke().count, skids: __game.skids().count }; })));
console.log('B sees', JSON.stringify(await tap()));
// a picture from B's side: the camera a few metres off the other car, looking at it
await B.evaluate(() => { const g = __game, r = g.mp().remotes()[0], c = g.car; if (!r) return; const dx = c.x - r.x, dz = c.z - r.z, d = Math.hypot(dx, dz) || 1; window.__cam = [r.x + dx / d * 11, r.y + 2.6, r.z + dz / d * 11, r.x, r.y + 0.8, r.z, 55]; });
await B.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
await B.waitForTimeout(4000);
await B.screenshot({ path: `${process.argv[3] || '.'}/mp-effects-${process.argv[2] || 'passat'}.png` });
await B.evaluate(() => { window.__cam = null; });
await B.evaluate(() => { __game.renderer.render = () => {}; });
await key(A, 'keyup', 'ArrowLeft'); await key(A, 'keyup', 'ArrowUp');
// 2: A drives past B flat out; pitch factor from the changing delay
await place(B, 1740, 4); await place(A, 1622, 0);
await A.waitForTimeout(1500);
await key(A, 'keydown', 'ArrowUp');
let last = null;
for (let k = 0; k < 24; k++) {
  await B.waitForTimeout(600);
  const v = await B.evaluate(() => { const v = __game.audio.remoteVoices[0]; return v ? { t: performance.now() / 1000, d: +v.d.toFixed(1), delay: v.delay, gain: +v.gain.toFixed(3), pan: +(v.pan ?? 0).toFixed(2) } : null; });
  if (v && last) console.log(JSON.stringify(v), 'pitch x', (1 - (v.delay - last.delay) / (v.t - last.t)).toFixed(3));
  last = v;
}
await ba.close(); await bb.close();
