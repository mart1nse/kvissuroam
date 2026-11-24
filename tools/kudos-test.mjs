// Thumbs up between players (src/kudos.js): A and C both tap the thumb in front of B's name in the online list.
// B's car shows A's big sign in its back window first, C's waits its turn (one at a time, 5 s each); each then
// shrinks into a small thumb at the top of the window. Checked: B's note, A's faint button and a second tap
// sending nothing (30 s), the small thumbs on B's car as B, A and a player D who joins later see them, and how
// long B's page was busy while the sign was painted and put up (render stubbed: the page's own work only).
// Needs the game with its server on :8787 (npx wrangler dev --port 8787) and Playwright. About 6 min.
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
// thumbs on cars in a page's scene: big signs and small thumbs, own car or another's
const signs = (p) => p.evaluate(() => {
  const s = []; __game.scene.traverse((o) => {
    let c = o.parent; while (c && !c.userData?.remoteCar && c.parent !== __game.scene) c = c.parent;
    const car = c?.userData?.remoteCar ? 'remote' : 'own';
    if (o.name === 'thumbs up') s.push({ big: car, op: +o.material.opacity.toFixed(2) });
    if (o.name === 'thumbs up small' && o.count) s.push({ small: car, n: o.count });
  });
  return s;
});
const tap = (p) => p.evaluate(() => document.querySelector('#people li[data-id] [data-ku]')?.click() ?? 'no button');
const [ba, A] = await open('impreza', 'TESTA');
const [bb, B] = await open('m3', 'TESTB');
const [bc, C] = await open('crv', 'TESTC');
await place(B, 1708); await place(A, 1700); await place(C, 1696);
for (const p of [A, C]) await p.waitForFunction(() => document.querySelector('#people li[data-id] [data-ku]'), null, { timeout: 60000 });
// (A and C: their lists hold B and each other; point each at B's row)
const toB = (p) => p.evaluate(() => { const li = [...document.querySelectorAll('#people li[data-id]')].find((l) => l.textContent.includes('TESTB')); li?.querySelector('[data-ku]')?.click(); return !!li; });
await A.waitForTimeout(3000);
await B.evaluate(() => { window.__gaps = []; let l = performance.now(); const f = (t) => { window.__gaps.push([t, t - l]); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await B.waitForTimeout(2000);
const t0 = await B.evaluate(() => performance.now());
console.log('A taps', await toB(A), '· C taps', await toB(C));
await B.waitForFunction(() => __game.kudos().showing > 0, null, { timeout: 20000 });
await B.waitForTimeout(1500);
console.log('B at 1.5 s (one big, one waiting):', JSON.stringify(await signs(B)), '· notes:', await B.evaluate(() => [...document.querySelectorAll('#people .feed li')].map((l) => l.textContent).join(' | ')));
console.log('A sees:', JSON.stringify(await signs(A)), '· A button', await A.evaluate(() => [...document.querySelectorAll('#people li[data-id]')].find((l) => l.textContent.includes('TESTB'))?.querySelector('[data-ku]')?.className));
const gaps = await B.evaluate((t0) => { const g = window.__gaps; const before = g.filter(([t]) => t < t0).map(([, d]) => d), after = g.filter(([t]) => t >= t0).map(([, d]) => d);
  const st = (a) => ({ n: a.length, max: Math.round(Math.max(...a)), p95: Math.round(a.sort((x, y) => x - y)[Math.floor(a.length * 0.95)]) }); return { before: st(before), after: st(after), slow: __game.jobs.slow.filter((s) => /thumbs/.test(s[0])) }; }, t0);
console.log('B frame gaps (ms, render off):', JSON.stringify(gaps));
await B.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
await B.screenshot({ path: `${out}/kudos-big.png` });
await B.evaluate(() => { __game.renderer.render = () => {}; });
console.log('second tap from A sent:', await A.evaluate((id) => __game.mp().kudos(id), await A.evaluate(() => [...document.querySelectorAll('#people li[data-id]')].find((l) => l.textContent.includes('TESTB')).dataset.id)));
await B.waitForTimeout(5200);
console.log('B at 6.7 s (first small, second big):', JSON.stringify(await signs(B)));
await B.waitForTimeout(6000);
console.log('B at 12.7 s (two small):', JSON.stringify(await signs(B)));
console.log('A sees:', JSON.stringify(await signs(A)));
await B.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
await B.waitForTimeout(1500);
await B.screenshot({ path: `${out}/kudos-collected.png` });
await B.evaluate(() => { __game.renderer.render = () => {}; });
// D comes later: the server tells it B's count
const [bd, D] = await open('w201', 'TESTD');
await place(D, 1702);
await D.waitForFunction(() => __game.mp().kudosCars([]).length, null, { timeout: 60000 }).catch(() => {});
await D.waitForTimeout(1500);
console.log('D (joined later) sees:', JSON.stringify(await signs(D)), '· counts D holds:', await D.evaluate(() => JSON.stringify(__game.mp().roster().map((p) => [p.name, __game.mp().remote(p.id)?.kn]))));
for (const b of [ba, bb, bc, bd]) await b.close();
