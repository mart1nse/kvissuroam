// Thumbs up between two players (src/kudos.js): A taps the thumb in front of B's name in the online list;
// B's car gets the neon sign in its back window for 5 s (B sees it on its own car, A on B's car), B gets the
// note and chime, A's button goes faint for 30 s and a second tap sends nothing. Also how long B's page was
// busy while the sign was painted and put up (render stubbed: the page's own work only).
// Needs the game with its server on :8787 (npx wrangler dev --port 8787) and Playwright.
// Usage: node tools/kudos-test.mjs [folder for pictures]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const P = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const out = process.argv[2] || '.';
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car, name) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', car, e.message));
  await p.addInitScript((n) => { try { localStorage.setItem('kvissuroam.name', n); } catch {} }, name);
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const place = (p, i) => p.evaluate(([x, z, yaw]) => __game.place({ x, z, yaw }), [P[i][0], P[i][1], 2.7085]);   // (the lap's heading there, as in mp-effects-test)
const [ba, A] = await open('impreza', 'TESTA');
const [bb, B] = await open('m3', 'TESTB');
await place(B, 1708); await place(A, 1700);
await A.waitForFunction(() => document.querySelector('#people [data-ku]'), null, { timeout: 60000 });
await A.waitForTimeout(4000);
const sign = (p) => p.evaluate((own) => {
  const s = []; __game.scene.traverse((o) => { if (o.name === 'thumbs up') s.push(o); });
  return s.map((o) => ({ op: +o.material.opacity.toFixed(2), car: o.parent?.userData?.remoteCar ? 'remote' : 'own' }));
});
// B: rAF gaps before and after, from the page's own work
await B.evaluate(() => { window.__gaps = []; let l = performance.now(); const f = (t) => { window.__gaps.push([t, t - l]); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await B.waitForTimeout(2500);
const t0 = await B.evaluate(() => performance.now());
await A.evaluate(() => document.querySelector('#people [data-ku]').click());
await B.waitForFunction(() => __game.kudos().showing > 0, null, { timeout: 20000 });
const t1 = await B.evaluate(() => performance.now());
await B.waitForTimeout(1200);
console.log('B on the sign:', Math.round(t1 - t0), 'ms after the tap; signs in B scene', JSON.stringify(await sign(B)));
console.log('A sees', JSON.stringify(await sign(A)));
console.log('B note:', await B.evaluate(() => [...document.querySelectorAll('#people .feed li')].map((l) => l.textContent).join(' | ')));
console.log('A button:', await A.evaluate(() => document.querySelector('#people [data-ku]').className));
const gaps = await B.evaluate((t0) => { const g = window.__gaps; const before = g.filter(([t]) => t < t0).map(([, d]) => d), after = g.filter(([t]) => t >= t0 && t < t0 + 3000).map(([, d]) => d);
  const st = (a) => ({ n: a.length, max: Math.round(Math.max(...a)), p95: Math.round(a.sort((x, y) => x - y)[Math.floor(a.length * 0.95)]) }); return { before: st(before), after: st(after), slow: __game.jobs.slow.filter((s) => /thumbs/.test(s[0])) }; }, t0);
console.log('B frame gaps (ms, render off):', JSON.stringify(gaps));
// a picture from B's chase view: its own car with the sign (the sign's clock runs on, so straight away)
await B.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
await B.screenshot({ path: `${out}/kudos-own-car.png` });
await B.evaluate(() => { __game.renderer.render = () => {}; });
// a second tap within 30 s: nothing sent
const again = await A.evaluate((id) => __game.mp().kudos(id), await A.evaluate(() => document.querySelector('#people [data-ku]').dataset.ku));
console.log('second tap sent:', again);
await B.waitForTimeout(4500);
console.log('after 5 s, signs in B scene', JSON.stringify(await sign(B)));
await ba.close(); await bb.close();
