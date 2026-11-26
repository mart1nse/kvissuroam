// Two browsers in the same lobby: does B see A's Rocket fly its kickflip along the plan A sent (one smooth arc
// and one whole turn about its long axis), and its nozzles blow, and stop flying it when A's flight ends at a wall?
// Needs the game served with its server on :8787, with the hidden cars let in:
//   npm run build && npx wrangler dev --port 8787 --var SHOW_HIDDEN:1
// and Playwright. Usage: node tools/rocket-online-test.mjs [folder for the pictures]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const yaw = 2.7085, dir = process.argv[2] || '';
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', car, e.message));
  await p.goto('http://localhost:8787/?q=low&trees=old&hidden=1');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  // (software rendering manages a frame or two a second: draw nothing until a picture is wanted)
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const key = (p, type, code) => p.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), [type, code]);
const place = (p, i, side = 0) => p.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [P[i][0] + Math.cos(yaw) * side, P[i][1] + Math.sin(yaw) * side, yaw]);
let bad = 0;
const check = (name, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  (${note})` : ''}`); if (!ok) bad++; };
const [ba, A] = await open('rocket');
const [bb, B] = await open('w201');
check('A drives the Rocket', await A.evaluate(() => __game.car.spec.id === 'rocket'));
await place(B, 1707, 4); await place(A, 1700, 0);
await A.waitForTimeout(3000);
// B keeps a record of A's car as it draws it, every frame
await B.evaluate(() => {
  window.__seen = [];
  const tick = () => { const r = __game.mp().remotes().find((x) => x.spec.id === 'rocket'); if (r) window.__seen.push([performance.now() / 1000, r.x, r.y, r.z, r.roll, r.noz ? Math.max(...r.noz.slice(0, 4)) : -1, r.noz ? Math.max(...r.noz.slice(4, 8)) : -1]); requestAnimationFrame(tick); };
  tick();
});
// 1: BOOST for a second: B sees the tail nozzles blow
await key(A, 'keydown', 'ShiftLeft');
await A.waitForTimeout(1200);
const boost = await B.evaluate(() => Math.max(...window.__seen.map((s) => s[5])));
await key(A, 'keyup', 'ShiftLeft');
check('B sees the tail nozzles blow on BOOST', boost > 0.9, `level ${boost.toFixed(2)}`);
// 2: the kickflip
await A.waitForTimeout(400);
await B.evaluate(() => { window.__seen.length = 0; });
const y0 = await A.evaluate(() => __game.car.y);
await key(A, 'keydown', 'KeyX'); await A.waitForTimeout(80); await key(A, 'keyup', 'KeyX');
const plan = await A.evaluate(() => { const f = __game.car.rocket.flight; return f && { tl: f.tl, side: f.side }; });
check('A is in the air', !!plan, plan ? `${plan.tl.toFixed(2)} s` : '');
await A.waitForTimeout(900);
if (dir) { await B.evaluate(() => { const g = __game; g.renderer.realRender(g.scene, g.camera); }); await B.screenshot({ path: `${dir}/rocket-online.png` }); }
await A.waitForTimeout(2500);
const seen = await B.evaluate(() => window.__seen);
// (the fastest climb is measured over no less than a sixtieth: the frames come unevenly)
let top = -Infinity, turned = 0, jump = 0, step = 0, down = 0, at = '';
for (let i = 1; i < seen.length; i++) {
  const a = seen[i - 1], b = seen[i], dt = b[0] - a[0];
  top = Math.max(top, b[2]); down = Math.max(down, b[6]);
  let d = b[4] - a[4]; d = Math.atan2(Math.sin(d), Math.cos(d));
  turned += d;
  if (dt > 0 && dt < 0.2) { jump = Math.max(jump, Math.abs(d) / Math.max(dt, 1 / 60)); const st = Math.abs(b[2] - a[2]) / Math.max(dt, 1 / 60); if (st > step) { step = st; at = `${(b[0] - seen[0][0]).toFixed(2)} s in: ${(a[2] - y0).toFixed(2)} to ${(b[2] - y0).toFixed(2)} m in ${(dt * 1000).toFixed(0)} ms`; } }
}
check('B sees it rise', top - y0 > 1.5, `${(top - y0).toFixed(2)} m over the road, ${seen.length} frames`);
check('B sees one whole turn', Math.abs(Math.abs(turned) - 2 * Math.PI) < 0.5, `${(turned / Math.PI * 180).toFixed(0)} degrees`);
check('...turning smoothly', jump < 12, `fastest ${jump.toFixed(1)} rad/s`);
// (the car falls at up to 10.6 m/s before its landing burn; measured over a tenth of a second, as one late frame
// on this page shifts a single frame's reading by half a metre)
let fall = 0;
for (let i = 0, j = 0; i < seen.length; i++) { while (j < seen.length && seen[j][0] - seen[i][0] < 0.1) j++; if (j < seen.length && seen[j][0] - seen[i][0] < 0.3) fall = Math.max(fall, Math.abs(seen[j][2] - seen[i][2]) / (seen[j][0] - seen[i][0])); }
check('...and no step in height', fall < 15, `fastest ${fall.toFixed(1)} m/s over a tenth of a second; in one frame ${step.toFixed(1)} m/s, ${at}`);
check('B sees the nozzles under the floor blow', down > 0.5, `level ${down.toFixed(2)}`);
// 3: a flight that ends against a house: B stops flying the plan there (it sees no landing burn)
await place(A, 1700, 0);
await A.waitForTimeout(2500);
await A.evaluate(() => { const r = __game.car.rocket; r.tank = 10; r.dry = false; });
await key(A, 'keydown', 'KeyX'); await A.waitForTimeout(80); await key(A, 'keyup', 'KeyX');
await A.waitForTimeout(1000);
await A.evaluate(() => { const w = __game.world; w.sdfWas = w.sdfAt; w.roofWas = w.roofAt; w.sdfAt = () => -1; w.roofAt = () => 1e9; });
await A.waitForTimeout(200);
const ended = await A.evaluate(() => { const w = __game.world; w.sdfAt = w.sdfWas; w.roofAt = w.roofWas; return !__game.car.rocket.flight; });
check('A flies into a house: its flight ends there', ended);
await A.waitForTimeout(500);
await B.evaluate(() => { window.__seen.length = 0; });
await A.waitForTimeout(2600);
const burn = await B.evaluate(() => Math.max(0, ...window.__seen.map((s) => s[6])));
check('B stops flying the plan (no landing burn)', burn < 0.05, `level ${burn.toFixed(2)}`);
await ba.close(); await bb.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
